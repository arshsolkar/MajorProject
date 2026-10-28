# New endpoints - to be added to main.py after extract_job_description

@app.post("/api/v1/candidates/{candidate_id}/shortlist", response_model=CandidateOut)
def update_shortlist(candidate_id: str, update: ShortlistUpdateIn, db: Session = Depends(get_db)):
    """Update shortlist status for a candidate."""
    candidate = db.scalar(select(Candidate).where(Candidate.id == candidate_id))
    if not candidate:
        raise HTTPException(404, "Candidate not found.")
    
    candidate.is_shortlisted = update.is_shortlisted
    if update.notes is not None:
        candidate.notes = update.notes
    
    db.commit()
    db.refresh(candidate)
    return CandidateOut.model_validate(candidate)


@app.get("/api/v1/analyses/{analysis_id}/shortlisted", response_model=list[ShortlistedCandidateOut])
def get_shortlisted_candidates(analysis_id: str, db: Session = Depends(get_db)):
    """Get all shortlisted candidates for an analysis."""
    candidates = db.scalars(
        select(Candidate)
        .where(Candidate.analysis_id == analysis_id)
        .where(Candidate.is_shortlisted == True)
        .order_by(Candidate.overall_score.desc())
    ).all()
    
    return [ShortlistedCandidateOut.model_validate(c) for c in candidates]


@app.post("/api/v1/analyses/{analysis_id}/filtered-candidates", response_model=list[CandidateOut])
def get_filtered_candidates(analysis_id: str, filters: FilterCriteriaIn, db: Session = Depends(get_db)):
    """Get candidates with applied filters."""
    query = select(Candidate).where(Candidate.analysis_id == analysis_id)
    
    if filters.min_score is not None:
        query = query.where(Candidate.overall_score >= filters.min_score)
    
    if filters.max_score is not None:
        query = query.where(Candidate.overall_score <= filters.max_score)
    
    if filters.recommendation:
        query = query.where(Candidate.recommendation == filters.recommendation)
    
    if filters.is_shortlisted is not None:
        query = query.where(Candidate.is_shortlisted == filters.is_shortlisted)
    
    if filters.email_sent is not None:
        query = query.where(Candidate.email_sent == filters.email_sent)
    
    query = query.order_by(Candidate.overall_score.desc())
    candidates = db.scalars(query).all()
    
    # Filter by skills if provided
    if filters.skills_filter:
        filtered_list = []
        for candidate in candidates:
            candidate_skills = set(s.lower() for s in (candidate.skills or []))
            search_skills = set(s.lower() for s in filters.skills_filter)
            if search_skills.issubset(candidate_skills):
                filtered_list.append(candidate)
        candidates = filtered_list
    
    return [CandidateOut.model_validate(c) for c in candidates]


@app.post("/api/v1/candidates/send-email", response_model=EmailResponseOut)
def send_email_to_candidates(email_request: SendEmailIn, db: Session = Depends(get_db)):
    """Send email to selected candidates."""
    
    # Get candidates
    if email_request.recipient_ids:
        candidates = db.scalars(
            select(Candidate).where(Candidate.id.in_(email_request.recipient_ids))
        ).all()
    else:
        # Send to all shortlisted
        candidates = db.scalars(
            select(Candidate).where(Candidate.is_shortlisted == True)
        ).all()
    
    if not candidates:
        return EmailResponseOut(
            success=False,
            message="No candidates found to send emails to.",
            sent_count=0,
            failed_count=0
        )
    
    sent_count = 0
    failed_count = 0
    errors = []
    
    for candidate in candidates:
        if not candidate.email:
            failed_count += 1
            errors.append({
                "candidate_id": candidate.id,
                "candidate_name": candidate.name,
                "error": "No email address on file"
            })
            continue
        
        # Determine template
        if email_request.template_type == "procedure":
            template = EmailService.get_procedure_email_template(candidate.name)
        elif email_request.template_type == "rejection":
            template = EmailService.get_rejection_email_template(candidate.name)
        elif email_request.template_type == "custom":
            template = {
                "subject": email_request.custom_subject or "Message from HireSense AI",
                "body": email_request.custom_body or "",
                "html_body": email_request.custom_html_body
            }
        else:
            failed_count += 1
            errors.append({
                "candidate_id": candidate.id,
                "candidate_name": candidate.name,
                "error": "Unknown template type"
            })
            continue
        
        # Send email
        result = EmailService.send_email(
            recipient_email=candidate.email,
            recipient_name=candidate.name,
            subject=template["subject"],
            body=template["body"],
            html_body=template.get("html_body")
        )
        
        if result["success"]:
            candidate.email_sent = True
            candidate.email_sent_at = datetime.utcnow()
            db.commit()
            sent_count += 1
        else:
            failed_count += 1
            errors.append({
                "candidate_id": candidate.id,
                "candidate_name": candidate.name,
                "error": result["message"]
            })
    
    return EmailResponseOut(
        success=sent_count > 0,
        message=f"Sent {sent_count} emails successfully" + (f"; {failed_count} failed" if failed_count > 0 else ""),
        sent_count=sent_count,
        failed_count=failed_count,
        errors=errors
    )


@app.post("/api/v1/candidates/{candidate_id}/schedule-call", response_model=CandidateOut)
def schedule_call(candidate_id: str, call_request: CallProcedureIn, db: Session = Depends(get_db)):
    """Schedule a call/procedure for a candidate."""
    candidate = db.scalar(select(Candidate).where(Candidate.id == candidate_id))
    if not candidate:
        raise HTTPException(404, "Candidate not found.")
    
    candidate.call_scheduled = True
    candidate.call_scheduled_at = call_request.scheduled_at or datetime.utcnow()
    if call_request.notes:
        candidate.notes = call_request.notes
    
    db.commit()
    db.refresh(candidate)
    return CandidateOut.model_validate(candidate)


@app.get("/api/v1/analyses/{analysis_id}/shortlisted-report.xlsx")
def download_shortlisted_report(analysis_id: str, db: Session = Depends(get_db)):
    """Download Excel report of only shortlisted candidates."""
    analysis = db.scalar(select(Analysis).options(selectinload(Analysis.candidates)).where(Analysis.id == analysis_id))
    if not analysis:
        raise HTTPException(404, "Analysis not found.")
    
    # Filter only shortlisted candidates
    shortlisted = [c for c in analysis.candidates if c.is_shortlisted]
    if not shortlisted:
        raise HTTPException(404, "No shortlisted candidates found.")
    
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Shortlisted Candidates"
    
    # Headers
    sheet.append([
        "Rank", "Candidate", "Email", "Phone", "Overall Score", "Semantic", "Keyword", "Experience",
        "Recommendation", "Education", "Skills", "Missing Skills", "Experience Years", "Location"
    ])
    
    # Data rows
    for rank, candidate in enumerate(sorted(shortlisted, key=lambda c: c.overall_score, reverse=True), 1):
        contact_fields = _export_candidate_fields(candidate)
        entities = getattr(candidate, "entities", {}) or {}
        
        sheet.append([
            rank,
            candidate.name,
            contact_fields["email"],
            contact_fields["phone"],
            candidate.overall_score,
            candidate.semantic_score,
            candidate.keyword_score,
            candidate.experience_score,
            candidate.recommendation,
            contact_fields["education"],
            ", ".join(candidate.skills),
            ", ".join(candidate.missing_skills),
            entities.get("experience_years", ""),
            contact_fields["location"],
        ])
    
    # Format sheet
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions
    for column in sheet.columns:
        width = min(max(len(str(cell.value or "")) for cell in column) + 2, 60)
        sheet.column_dimensions[column[0].column_letter].width = width
    
    from io import BytesIO
    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="hiresense-ai-shortlisted-{analysis_id}.xlsx"'}
    )


@app.get("/api/v1/candidates/strong-matches")
def get_strong_matches(analysis_id: str = None, db: Session = Depends(get_db)):
    """Get all 'Strong Match' candidates for outreach."""
    if analysis_id:
        candidates = db.scalars(
            select(Candidate)
            .where(Candidate.analysis_id == analysis_id)
            .where(Candidate.recommendation == "Strong Match")
            .order_by(Candidate.overall_score.desc())
        ).all()
    else:
        # Get strong matches from latest analyses
        candidates = db.scalars(
            select(Candidate)
            .where(Candidate.recommendation == "Strong Match")
            .order_by(Candidate.overall_score.desc())
        ).all()
    
    return [CandidateOut.model_validate(c) for c in candidates]


# Import datetime for timestamps
from datetime import datetime
