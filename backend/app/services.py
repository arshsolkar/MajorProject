from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Tuple
from .database import SessionLocal
from .models import Analysis, Candidate
from .nlp import (
    extract_entities, extract_pdf_text, extract_skills, infer_name,
    recommendation, semantic_similarities, extract_jd_requirements,
    calculate_composite_score, extract_projects, extract_education, extract_experience_details,
    extract_candidate_name_tiered, extract_candidate_name_production, extract_resume_data_ollama,
    normalize_skill_term
)

import concurrent.futures
import os
import time
from .config import settings
from .nlp import extract_pdf_text_cached


def automatically_shortlisted(score: int, threshold: int) -> bool:
    """Both persisted scores and job thresholds use the same 0–100 scale."""
    return max(0, min(100, int(score))) >= max(0, min(100, int(threshold)))


def merge_resume_contact_data(entities: dict | None, *, email: str | None = None, phone: str | None = None) -> dict:
    """Merge structured resume contact fields into the entity payload used for storage and export."""
    merged = dict(entities or {})
    if email:
        merged["emails"] = [email]
    elif "emails" not in merged or not merged["emails"]:
        merged["emails"] = []

    if phone:
        merged["phones"] = [phone]
    elif "phones" not in merged or not merged["phones"]:
        merged["phones"] = []

    for key in ("organizations", "locations"):
        if key not in merged:
            merged[key] = []
    return merged


def analyse_job(analysis_id: str, upload_paths: list[tuple[str, str]]) -> None:
    """Run in FastAPI's background worker; results are persisted for polling."""
    db = SessionLocal()
    try:
        analysis = db.get(Analysis, analysis_id)
        if not analysis:
            return
        analysis.status = "processing"
        analysis.current_phase = "text_extraction"
        analysis.phase_total = len(upload_paths)
        analysis.phase_completed = 0
        db.commit()
        # Parallelize text extraction (IO + CPU heavy for OCR).
        parsed: list[Tuple[str, str, str]] = []
        skipped: list[str] = []

        # Conservative default for workers: min(8, 2 * CPU). Can be overridden in settings.
        if settings.extraction_max_workers and settings.extraction_max_workers > 0:
            max_workers = settings.extraction_max_workers
        else:
            max_workers = min(8, (os.cpu_count() or 2) * 2)

        futures = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            for filename, path in upload_paths:
                # submit cached extraction tasks
                futures[executor.submit(extract_pdf_text_cached, path)] = (filename, path)

            # Process as futures finish and update DB progress in main thread
            for fut in concurrent.futures.as_completed(futures):
                filename, path = futures[fut]
                analysis.current_resume_filename = filename
                analysis.current_resume_candidate_name = None
                analysis.current_resume_started_at = datetime.utcnow()
                analysis.current_stage = "extracting_text"
                db.commit()

                try:
                    start = time.perf_counter()
                    text = fut.result()
                    elapsed = time.perf_counter() - start
                    print(f"Extracted {filename} in {elapsed:.2f}s (thread={max_workers})")
                    if len(text) < 40:
                        raise ValueError("no extractable text after OCR")
                    parsed.append((filename, text, path))
                except Exception as exc:
                    skipped.append(f"{filename}: {exc}")

                analysis.phase_completed += 1
                db.commit()

        if not parsed:
            details = "; ".join(skipped[:5])
            raise ValueError(f"No resumes could be processed. {details}")

        # Extract JD requirements with REQ vs PREF distinction
        required_skills, preferred_skills = extract_jd_requirements(analysis.job_description)
        job_skills = set(required_skills + preferred_skills)
        
        # Store both required and preferred skills for analysis
        analysis.requirements = {
            "required": required_skills,
            "preferred": preferred_skills,
            "all": sorted(job_skills)
        }
        
        # Calculate semantic similarities with normalization
        # Similarities computed in batch (embedder handles vectorization efficiently)
        analysis.current_phase = "calculating_similarities"
        analysis.current_stage = "calculating_similarities"
        analysis.current_resume_filename = None
        analysis.current_resume_candidate_name = None
        analysis.phase_total = len(parsed)
        analysis.phase_completed = 0
        db.commit()

        similarities = semantic_similarities(analysis.job_description, [text for _, text, _ in parsed])

        # Start parallel AI/NLP analysis per candidate but perform DB writes in main thread
        analysis.current_phase = "ai_analysis"
        analysis.phase_total = len(parsed)
        analysis.phase_completed = 0
        db.commit()

        def _process_candidate(item: Tuple[str, str, str, float]) -> Dict:
            """Process a single candidate and return a serializable dict for DB insertion."""
            filename, text, path, similarity = item
            try:
                ollama_data = extract_resume_data_ollama(text, path)
                candidate_name = ollama_data.get("name")
                requires_manual_entry = ollama_data.get("requires_manual_entry")
                experience_years = ollama_data.get("experience_years", 0)
                education = ollama_data.get("education")
                skills = set(ollama_data.get("skills", []))
                projects = ollama_data.get("notable_projects", [])
                experience_details = ollama_data.get("work_experience", [])
                extracted_email = ollama_data.get("email") if isinstance(ollama_data, dict) else None
                extracted_phone = ollama_data.get("phone") if isinstance(ollama_data, dict) else None
                entities = ollama_data.get("entities") if isinstance(ollama_data, dict) else None
            except Exception:
                # Fallback to rule-based extraction
                skills = set(extract_skills(text))
                entities = extract_entities(text)
                candidate_name, requires_manual_entry = extract_candidate_name_production(text, filename, path)
                experience_years = float(entities.get("experience_years", 0))
                education = extract_education(text)
                projects = extract_projects(text)
                experience_details = extract_experience_details(text)
                extracted_email = None
                extracted_phone = None

            if not entities:
                entities = extract_entities(text)
            entities = merge_resume_contact_data(entities, email=extracted_email, phone=extracted_phone)

            # Normalize skills and calculate matching
            normalized_skills = {normalize_skill_term(skill) for skill in skills}
            normalized_required = {normalize_skill_term(skill) for skill in required_skills}
            normalized_preferred = {normalize_skill_term(skill) for skill in preferred_skills}
            matching_required = sorted(normalized_skills & normalized_required)
            matching_preferred = sorted(normalized_skills & normalized_preferred)
            missing_required = sorted(normalized_required - normalized_skills)
            missing_preferred = sorted(normalized_preferred - normalized_skills)

            if normalized_required:
                required_coverage = (len(matching_required) / len(normalized_required)) * 100
            else:
                required_coverage = 100

            if normalized_preferred:
                preferred_coverage = (len(matching_preferred) / len(normalized_preferred)) * 50
            else:
                preferred_coverage = 0

            skill_coverage = min(100, required_coverage + preferred_coverage)

            semantic_fit_raw = similarity * 100
            if normalized_required:
                skill_alignment_boost = (len(matching_required) / len(normalized_required)) * 20
            else:
                skill_alignment_boost = 0
            semantic_fit = min(100, round(semantic_fit_raw * 0.8 + skill_alignment_boost))

            years = int(experience_years) if experience_years else 0
            if years > 0:
                normalized_years = min(years, 15)
                experience_match = min(100, 50 + (normalized_years / 15) * 50)
            else:
                work_history_keywords = ['experience', 'work', 'company', 'role', 'position', 'job']
                has_work_history = any(keyword in text.lower() for keyword in work_history_keywords)
                experience_match = 60 if has_work_history else 40

            education_keywords = ['bachelor', 'master', 'phd', 'degree', 'university', 'college']
            has_education = any(keyword in (education or "").lower() for keyword in education_keywords) if education else False
            education_alignment = 70 if has_education else 50

            overall = calculate_composite_score(
                skill_coverage=skill_coverage,
                semantic_fit=semantic_fit,
                experience_match=experience_match,
                education_role_alignment=education_alignment
            )

            score_label = recommendation(overall)

            # Build insight text minimally here; DB insertion will store it.
            insight_parts = []
            insight_parts.append(f"**Overall Assessment:** {score_label}")
            if matching_required:
                insight_parts.append(f"**Key Strengths:** {', '.join(sorted(matching_required)[:4])}")
            elif matching_preferred:
                insight_parts.append(f"**Key Strengths:** {', '.join(sorted(matching_preferred)[:3])}")
            else:
                insight_parts.append("**Key Strengths:** Transferable experience and relevant background")
            insight_parts.append(f"**Skill Coverage:** {int(skill_coverage)}% of job requirements met")
            if missing_required:
                insight_parts.append(f"**Critical Gaps:** {', '.join(sorted(missing_required)[:3])}")
            elif missing_preferred:
                insight_parts.append(f"**Missing Preferred:** {', '.join(sorted(missing_preferred)[:2])}")
            else:
                insight_parts.append("**Skill Gaps:** None detected")
            if years > 0:
                if years >= 5:
                    exp_assessment = "Strong experience alignment with role requirements"
                elif years >= 3:
                    exp_assessment = "Good experience level for this position"
                else:
                    exp_assessment = "Developing experience with growth potential"
                insight_parts.append(f"**Experience:** {exp_assessment} ({years} years)")
            else:
                insight_parts.append("**Experience:** Experience level not clearly specified")

            if overall >= 85:
                recommendation_text = "Highly recommended for immediate consideration"
            elif overall >= 70:
                recommendation_text = "Good fit worth interviewing"
            elif overall >= 60:
                recommendation_text = "Potential candidate with some skill development needed"
            else:
                recommendation_text = "May require significant skill development for this role"
            insight_parts.append(f"**Recommendation:** {recommendation_text}")

            insight = " | ".join(insight_parts)
            threshold = int((analysis.job_snapshot or {}).get("shortlist_threshold", 75))
            is_shortlisted = automatically_shortlisted(overall, threshold)

            return {
                "filename": filename,
                "path": path,
                "name": candidate_name,
                "email": (entities.get("emails") or [None])[0],
                "text": text,
                "skills": sorted(skills),
                "missing_skills": missing_required + missing_preferred,
                "entities": entities,
                "projects": projects,
                "education": education,
                "experience_details": experience_details if isinstance(experience_details, list) else [],
                "semantic_score": semantic_fit,
                "keyword_score": int(skill_coverage),
                "experience_score": int(experience_match),
                "overall_score": overall,
                "recommendation": score_label,
                "insight": insight,
                "requires_manual_name_entry": requires_manual_entry,
                "is_shortlisted": is_shortlisted,
            }

        # Submit candidate processing tasks and persist results as they complete
        items = [(fn, txt, pth, sim) for (fn, txt, pth), sim in zip(parsed, similarities)]
        # Allow overriding analysis worker pool separately
        if settings.analysis_max_workers and settings.analysis_max_workers > 0:
            analysis_workers = settings.analysis_max_workers
        else:
            analysis_workers = min(6, (os.cpu_count() or 2) * 2)

        with concurrent.futures.ThreadPoolExecutor(max_workers=analysis_workers) as executor:
            fut_to_item = {executor.submit(_process_candidate, item): item for item in items}
            for fut in concurrent.futures.as_completed(fut_to_item):
                item = fut_to_item[fut]
                filename = item[0]
                analysis.current_resume_filename = filename
                analysis.current_resume_candidate_name = None
                analysis.current_resume_started_at = datetime.utcnow()
                analysis.current_stage = "analyzing_skills"
                db.commit()

                try:
                    start = time.perf_counter()
                    result = fut.result()
                    elapsed = time.perf_counter() - start
                    print(f"Processed {filename} in {elapsed:.2f}s (workers={analysis_workers})")
                except Exception as e:
                    # If processing fails unexpectedly, record skip and continue
                    skipped.append(f"{filename}: {e}")
                    analysis.phase_completed += 1
                    db.commit()
                    continue

                # Persist Candidate in DB (main thread)
                db.add(Candidate(
                    analysis_id=analysis.id,
                    filename=result["filename"],
                    stored_filename=Path(result["path"]).name,
                    name=result["name"],
                    email=result["email"],
                    text=result["text"],
                    skills=result["skills"],
                    missing_skills=result["missing_skills"],
                    entities=result["entities"],
                    projects=result["projects"],
                    education=result["education"],
                    experience_details=result["experience_details"],
                    semantic_score=result["semantic_score"],
                    keyword_score=result["keyword_score"],
                    experience_score=result["experience_score"],
                    overall_score=result["overall_score"],
                    recommendation=result["recommendation"],
                    insight=result["insight"],
                    requires_manual_name_entry=result["requires_manual_name_entry"],
                    is_shortlisted=result["is_shortlisted"],
                    shortlist_source="automatic",
                ))

                analysis.phase_completed += 1
                db.commit()
            
        analysis.status = "completed"
        analysis.current_phase = "completed"
        analysis.current_stage = "completed"
        analysis.current_resume_filename = None
        analysis.current_resume_candidate_name = None
        # An analysis can be useful even if individual documents were unreadable.
        analysis.error = f"Skipped {len(skipped)} file(s): " + "; ".join(skipped[:5]) if skipped else None
        analysis.completed_at = datetime.utcnow()
        db.commit()
    except Exception as exc:
        db.rollback()
        analysis = db.get(Analysis, analysis_id)
        if analysis:
            analysis.status = "failed"
            analysis.current_phase = "failed"
            analysis.current_stage = "failed"
            analysis.error = str(exc)
            db.commit()
    finally:
        db.close()
