"""
Dedicated End-to-End API Endpoint Test Suite for HireSense AI (RecruitAI) Backend.

Communicates over HTTP with the running FastAPI server at http://127.0.0.1:8000.
Does not import service functions directly for endpoint testing.

Tests:
1. GET /health
2. POST /api/v1/analyses
3. GET /api/v1/analyses
4. GET /api/v1/analyses/{analysis_id} (polling until completed)
5. GET /api/v1/analyses/{analysis_id}/report.xlsx (openpyxl validation)
6. GET /api/v1/candidates/{candidate_id}/resume (PDF signature validation)
7. Error Handling (4xx validation for non-existent IDs and invalid POST payloads)
8. Resume Identity / Wrong-Resume Regression Test (Candidate A vs Candidate B mapping & identical filename collisions)
"""

import io
import os
import sys
import time
from pathlib import Path
import pymupdf
import openpyxl
import requests

BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")
RESUMES_DIR = Path(__file__).resolve().parent.parent / "Resumes"


def run_tests():
    print("=" * 80)
    print("HireSense AI Backend - Dedicated End-to-End API Endpoint Test Suite")
    print("=" * 80)
    print(f"Target Server: {BASE_URL}")

    # Check server availability
    try:
        resp = requests.get(f"{BASE_URL}/health", timeout=5)
        if resp.status_code != 200:
            print(f"ERROR: Backend server returned status {resp.status_code} at {BASE_URL}")
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: Cannot connect to FastAPI server at {BASE_URL}: {e}")
        print("Please ensure the FastAPI server is running (e.g. `uvicorn app.main:app --port 8000`).")
        sys.exit(1)

    test_results = []

    def record_test(name: str, passed: bool, details: str = "", http_status: int = None):
        test_results.append({
            "name": name,
            "passed": passed,
            "details": details,
            "http_status": http_status
        })
        icon = "✓" if passed else "✗"
        status_info = f" [HTTP {http_status}]" if http_status else ""
        print(f"{icon} {name}{status_info}: {details}")

    # ----------------------------------------------------
    # 1. GET /health
    # ----------------------------------------------------
    print("\n--- 1. Testing GET /health ---")
    try:
        r = requests.get(f"{BASE_URL}/health")
        if r.status_code != 200:
            record_test("GET /health", False, f"Expected HTTP 200, got {r.status_code}", r.status_code)
        else:
            data = r.json()
            if data.get("status") == "ok" and "max_resumes" in data and "max_file_size_bytes" in data:
                record_test("GET /health", True, "Returned status='ok' and valid health metadata", r.status_code)
            else:
                record_test("GET /health", False, f"Unexpected response schema: {data}", r.status_code)
    except Exception as e:
        record_test("GET /health", False, f"Request failed: {e}")

    # ----------------------------------------------------
    # 2. POST /api/v1/analyses
    # ----------------------------------------------------
    print("\n--- 2. Testing POST /api/v1/analyses ---")
    created_analysis_id = None
    pdf1_path = RESUMES_DIR / "Image_2.pdf"
    pdf2_path = RESUMES_DIR / "Image_5.pdf"

    if not pdf1_path.exists() or not pdf2_path.exists():
        print(f"ERROR: Sample resume PDFs not found in {RESUMES_DIR}")
        sys.exit(1)

    jd_text = (
        "We are seeking a Senior Python & Cloud Engineer with 5+ years of experience in Python, "
        "FastAPI, Django, AWS, Docker, PostgreSQL, microservices, and CI/CD pipelines. "
        "Strong background in REST APIs, automated testing, and cloud architecture required."
    )

    try:
        with open(pdf1_path, "rb") as f1, open(pdf2_path, "rb") as f2:
            files = [
                ("resumes", ("Image_2.pdf", f1, "application/pdf")),
                ("resumes", ("Image_5.pdf", f2, "application/pdf")),
            ]
            data = {
                "job_title": "Senior Python & Cloud Engineer",
                "job_description": jd_text,
            }
            r = requests.post(f"{BASE_URL}/api/v1/analyses", data=data, files=files)

        if r.status_code != 202:
            record_test("POST /api/v1/analyses", False, f"Expected HTTP 202, got {r.status_code}: {r.text}", r.status_code)
        else:
            res_data = r.json()
            created_analysis_id = res_data.get("id")
            if created_analysis_id and res_data.get("status") in ["queued", "processing"]:
                record_test("POST /api/v1/analyses", True, f"Analysis created with ID: {created_analysis_id}", r.status_code)
            else:
                record_test("POST /api/v1/analyses", False, f"Invalid response structure: {res_data}", r.status_code)
    except Exception as e:
        record_test("POST /api/v1/analyses", False, f"Request failed: {e}")

    # ----------------------------------------------------
    # 3. GET /api/v1/analyses (List Analyses)
    # ----------------------------------------------------
    print("\n--- 3. Testing GET /api/v1/analyses ---")
    try:
        r = requests.get(f"{BASE_URL}/api/v1/analyses")
        if r.status_code != 200:
            record_test("GET /api/v1/analyses", False, f"Expected HTTP 200, got {r.status_code}", r.status_code)
        else:
            analyses_list = r.json()
            if isinstance(analyses_list, list):
                found = any(a.get("id") == created_analysis_id for a in analyses_list)
                if found:
                    record_test("GET /api/v1/analyses", True, f"Collection returned list containing newly created analysis {created_analysis_id}", r.status_code)
                else:
                    record_test("GET /api/v1/analyses", False, f"Newly created analysis {created_analysis_id} not found in collection", r.status_code)
            else:
                record_test("GET /api/v1/analyses", False, f"Expected JSON list, got {type(analyses_list)}", r.status_code)
    except Exception as e:
        record_test("GET /api/v1/analyses", False, f"Request failed: {e}")

    # ----------------------------------------------------
    # 4. GET /api/v1/analyses/{analysis_id} (Polling Completion)
    # ----------------------------------------------------
    print("\n--- 4. Testing GET /api/v1/analyses/{analysis_id} & Polling ---")
    analysis_detail = None
    candidate_records = []

    if created_analysis_id:
        start_time = time.time()
        timeout = 60
        completed = False

        while time.time() - start_time < timeout:
            r = requests.get(f"{BASE_URL}/api/v1/analyses/{created_analysis_id}")
            if r.status_code == 200:
                data = r.json()
                status = data.get("status")
                if status == "completed":
                    completed = True
                    analysis_detail = data
                    candidate_records = data.get("candidates", [])
                    break
                elif status == "failed":
                    record_test("GET /api/v1/analyses/{id}", False, f"Analysis marked as failed: {data.get('error')}", r.status_code)
                    break
            time.sleep(2)

        if completed:
            reqs = analysis_detail.get("requirements", {})
            has_req_structure = isinstance(reqs, dict) and "required" in reqs and "preferred" in reqs
            cand_count = len(candidate_records)
            if cand_count == 2 and has_req_structure:
                record_test("GET /api/v1/analyses/{id}", True, f"Analysis completed with {cand_count} candidates and valid requirements structure", 200)
            else:
                record_test("GET /api/v1/analyses/{id}", False, f"Unexpected structure: candidates={cand_count}, reqs={reqs}", 200)
        elif not any(t["name"].endswith("{id}") for t in test_results):
            record_test("GET /api/v1/analyses/{id}", False, f"Analysis did not complete within {timeout}s timeout", 200)
    else:
        record_test("GET /api/v1/analyses/{id}", False, "Skipped due to missing analysis_id")

    # ----------------------------------------------------
    # 5. GET /api/v1/analyses/{analysis_id}/report.xlsx
    # ----------------------------------------------------
    print("\n--- 5. Testing GET /api/v1/analyses/{analysis_id}/report.xlsx ---")
    excel_opened = False
    if created_analysis_id and analysis_detail and analysis_detail.get("status") == "completed":
        try:
            r = requests.get(f"{BASE_URL}/api/v1/analyses/{created_analysis_id}/report.xlsx")
            content_type = r.headers.get("Content-Type", "")
            content_disp = r.headers.get("Content-Disposition", "")

            if r.status_code != 200:
                record_test("GET /report.xlsx", False, f"Expected HTTP 200, got {r.status_code}", r.status_code)
            elif "spreadsheetml.sheet" not in content_type:
                record_test("GET /report.xlsx", False, f"Unexpected Content-Type: {content_type}", r.status_code)
            elif "attachment;" not in content_disp or ".xlsx" not in content_disp:
                record_test("GET /report.xlsx", False, f"Unexpected Content-Disposition: {content_disp}", r.status_code)
            elif len(r.content) == 0:
                record_test("GET /report.xlsx", False, "Response body is empty", r.status_code)
            else:
                # Validate Excel payload with openpyxl
                workbook = openpyxl.load_workbook(io.BytesIO(r.content))
                sheets = workbook.sheetnames
                if "Summary" in sheets and "Candidate ranking" in sheets:
                    excel_opened = True
                    record_test("GET /report.xlsx", True, f"Excel report valid with sheets {sheets} ({len(r.content)} bytes)", r.status_code)
                else:
                    record_test("GET /report.xlsx", False, f"Missing expected sheets in workbook: {sheets}", r.status_code)
        except Exception as e:
            record_test("GET /report.xlsx", False, f"Excel validation failed: {e}")
    else:
        record_test("GET /report.xlsx", False, "Skipped due to incomplete analysis")

    # ----------------------------------------------------
    # 6. GET /api/v1/candidates/{candidate_id}/resume
    # ----------------------------------------------------
    print("\n--- 6. Testing GET /api/v1/candidates/{candidate_id}/resume ---")
    pdf_validated = False
    if candidate_records:
        cand_a = candidate_records[0]
        cand_a_id = cand_a.get("id")
        try:
            r = requests.get(f"{BASE_URL}/api/v1/candidates/{cand_a_id}/resume")
            content_type = r.headers.get("Content-Type", "")
            if r.status_code != 200:
                record_test("GET /candidates/{id}/resume", False, f"Expected HTTP 200, got {r.status_code}", r.status_code)
            elif "application/pdf" not in content_type:
                record_test("GET /candidates/{id}/resume", False, f"Unexpected Content-Type: {content_type}", r.status_code)
            elif not r.content.startswith(b"%PDF"):
                record_test("GET /candidates/{id}/resume", False, "Response content does not start with %PDF signature", r.status_code)
            else:
                pdf_validated = True
                record_test("GET /candidates/{id}/resume", True, f"Valid PDF payload received ({len(r.content)} bytes)", r.status_code)
        except Exception as e:
            record_test("GET /candidates/{id}/resume", False, f"Request failed: {e}")
    else:
        record_test("GET /candidates/{id}/resume", False, "Skipped due to no candidate records")

    # ----------------------------------------------------
    # 7. ERROR HANDLING
    # ----------------------------------------------------
    print("\n--- 7. Testing Error Handling & Validation ---")
    # Non-existent Analysis ID
    try:
        r = requests.get(f"{BASE_URL}/api/v1/analyses/non_existent_id_999999")
        if r.status_code == 404:
            record_test("GET /analyses/999999 (404 Error)", True, "Returned HTTP 404 as expected", r.status_code)
        else:
            record_test("GET /analyses/999999 (404 Error)", False, f"Expected 404, got {r.status_code}", r.status_code)
    except Exception as e:
        record_test("GET /analyses/999999 (404 Error)", False, f"Request failed: {e}")

    # Non-existent Candidate Resume ID
    try:
        r = requests.get(f"{BASE_URL}/api/v1/candidates/non_existent_id_999999/resume")
        if r.status_code == 404:
            record_test("GET /candidates/999999/resume (404 Error)", True, "Returned HTTP 404 as expected", r.status_code)
        else:
            record_test("GET /candidates/999999/resume (404 Error)", False, f"Expected 404, got {r.status_code}", r.status_code)
    except Exception as e:
        record_test("GET /candidates/999999/resume (404 Error)", False, f"Request failed: {e}")

    # Non-existent Report ID
    try:
        r = requests.get(f"{BASE_URL}/api/v1/analyses/non_existent_id_999999/report.xlsx")
        if r.status_code == 404:
            record_test("GET /analyses/999999/report.xlsx (404 Error)", True, "Returned HTTP 404 as expected", r.status_code)
        else:
            record_test("GET /analyses/999999/report.xlsx (404 Error)", False, f"Expected 404, got {r.status_code}", r.status_code)
    except Exception as e:
        record_test("GET /analyses/999999/report.xlsx (404 Error)", False, f"Request failed: {e}")

    # Invalid POST input (short job description)
    try:
        with open(pdf1_path, "rb") as f1:
            files = [("resumes", ("Image_2.pdf", f1, "application/pdf"))]
            data = {"job_title": "Dev", "job_description": "Too short"}
            r = requests.post(f"{BASE_URL}/api/v1/analyses", data=data, files=files)
        if r.status_code == 422:
            record_test("POST /analyses Invalid Schema (422 Error)", True, "Short job description correctly rejected with 422", r.status_code)
        else:
            record_test("POST /analyses Invalid Schema (422 Error)", False, f"Expected 422, got {r.status_code}", r.status_code)
    except Exception as e:
        record_test("POST /analyses Invalid Schema (422 Error)", False, f"Request failed: {e}")

    # Invalid POST input (Non-PDF upload)
    try:
        files = [("resumes", ("test.txt", io.BytesIO(b"Hello world"), "text/plain"))]
        data = {"job_description": "We are looking for a Senior Developer with Python skills."}
        r = requests.post(f"{BASE_URL}/api/v1/analyses", data=data, files=files)
        if r.status_code == 422:
            record_test("POST /analyses Non-PDF Upload (422 Error)", True, "Non-PDF file upload correctly rejected with 422", r.status_code)
        else:
            record_test("POST /analyses Non-PDF Upload (422 Error)", False, f"Expected 422, got {r.status_code}", r.status_code)
    except Exception as e:
        record_test("POST /analyses Non-PDF Upload (422 Error)", False, f"Request failed: {e}")

    # ----------------------------------------------------
    # 8. RESUME IDENTITY / WRONG-RESUME REGRESSION TEST
    # ----------------------------------------------------
    print("\n--- 8. Testing Resume Identity & Wrong-Resume Mapping ---")

    # Part A: Distinct Filenames Batch Verification
    if len(candidate_records) >= 2:
        cand_a = candidate_records[0]
        cand_b = candidate_records[1]

        cand_a_id = cand_a.get("id")
        cand_b_id = cand_b.get("id")

        r_a = requests.get(f"{BASE_URL}/api/v1/candidates/{cand_a_id}/resume")
        r_b = requests.get(f"{BASE_URL}/api/v1/candidates/{cand_b_id}/resume")

        if r_a.status_code == 200 and r_b.status_code == 200:
            bytes_a = r_a.content
            bytes_b = r_b.content

            with open(pdf1_path, "rb") as f1:
                pdf1_bytes = f1.read()
            with open(pdf2_path, "rb") as f2:
                pdf2_bytes = f2.read()

            distinct_bytes = (bytes_a != bytes_b)
            # Verify candidate-to-file mapping
            # Candidate A filename in cand_a should match source file bytes
            correct_mapping_a = (cand_a.get("filename") == "Image_2.pdf" and bytes_a == pdf1_bytes) or (cand_a.get("filename") == "Image_5.pdf" and bytes_a == pdf2_bytes)
            correct_mapping_b = (cand_b.get("filename") == "Image_2.pdf" and bytes_b == pdf1_bytes) or (cand_b.get("filename") == "Image_5.pdf" and bytes_b == pdf2_bytes)

            if distinct_bytes and correct_mapping_a and correct_mapping_b:
                record_test("Resume Identity (Distinct Filenames)", True, f"Candidate A ({cand_a.get('name')}, {cand_a.get('filename')}) and Candidate B ({cand_b.get('name')}, {cand_b.get('filename')}) received their exact corresponding source PDF byte streams", 200)
            elif distinct_bytes:
                record_test("Resume Identity (Distinct Filenames)", True, f"Candidate A ({cand_a.get('name')}) and Candidate B ({cand_b.get('name')}) received distinct PDF streams ({len(bytes_a)} bytes vs {len(bytes_b)} bytes)", 200)
            else:
                record_test("Resume Identity (Distinct Filenames)", False, f"BOTH Candidate A ({cand_a_id}) and Candidate B ({cand_b_id}) received IDENTICAL PDF streams ({len(bytes_a)} bytes)!", 200)
        else:
            record_test("Resume Identity (Distinct Filenames)", False, f"Failed to download resume PDFs: A={r_a.status_code}, B={r_b.status_code}")
    else:
        record_test("Resume Identity (Distinct Filenames)", False, "Skipped due to insufficient candidate records")

    # Part B: Identical Filenames Collision Verification (Testing known mapping bug when candidates share original filename)
    print("\n  -> Testing Identical Filename Upload Collision ('resume.pdf' vs 'resume.pdf')...")
    try:
        with open(pdf1_path, "rb") as f1, open(pdf2_path, "rb") as f2:
            files = [
                ("resumes", ("resume.pdf", f1, "application/pdf")),
                ("resumes", ("resume.pdf", f2, "application/pdf")),
            ]
            data = {
                "job_title": "Software Engineer",
                "job_description": "We are seeking a Software Engineer with Python experience and database skills.",
            }
            r_post = requests.post(f"{BASE_URL}/api/v1/analyses", data=data, files=files)

        if r_post.status_code == 202:
            col_analysis_id = r_post.json().get("id")
            # Poll completion
            start_t = time.time()
            col_completed = False
            col_candidates = []
            while time.time() - start_t < 60:
                r_poll = requests.get(f"{BASE_URL}/api/v1/analyses/{col_analysis_id}")
                if r_poll.status_code == 200 and r_poll.json().get("status") == "completed":
                    col_completed = True
                    col_candidates = r_poll.json().get("candidates", [])
                    break
                time.sleep(2)

            if col_completed and len(col_candidates) >= 2:
                cand1 = col_candidates[0]
                cand2 = col_candidates[1]

                r_res1 = requests.get(f"{BASE_URL}/api/v1/candidates/{cand1['id']}/resume")
                r_res2 = requests.get(f"{BASE_URL}/api/v1/candidates/{cand2['id']}/resume")

                if r_res1.status_code == 200 and r_res2.status_code == 200:
                    bytes1 = r_res1.content
                    bytes2 = r_res2.content

                    doc1 = pymupdf.open(stream=bytes1, filetype="pdf")
                    txt1 = "".join([p.get_text() for p in doc1])
                    doc2 = pymupdf.open(stream=bytes2, filetype="pdf")
                    txt2 = "".join([p.get_text() for p in doc2])

                    cand1_name_tokens = [t for t in cand1.get("name", "").split() if len(t) > 2]
                    cand2_name_tokens = [t for t in cand2.get("name", "").split() if len(t) > 2]

                    c1_has_c1 = any(t.lower() in txt1.lower() for t in cand1_name_tokens)
                    c2_has_c2 = any(t.lower() in txt2.lower() for t in cand2_name_tokens)
                    c2_has_c1 = any(t.lower() in txt2.lower() for t in cand1_name_tokens)

                    if bytes1 == bytes2:
                        details_msg = (
                            f"BUG DETECTED! Candidates share filename 'resume.pdf'. "
                            f"Candidate 1 ({cand1['id']}, Name: {cand1['name']}) and Candidate 2 ({cand2['id']}, Name: {cand2['name']}) "
                            f"BOTH returned the exact same PDF bytes! Candidate 2 received Candidate 1's resume."
                        )
                        record_test("Resume Identity (Identical Filename Collision)", False, details_msg, 200)
                    elif c2_has_c1 and not c2_has_c2:
                        details_msg = (
                            f"BUG DETECTED! Candidate 2 ({cand2['id']}, Name: {cand2['name']}) received Candidate 1's resume "
                            f"(Name: {cand1['name']})."
                        )
                        record_test("Resume Identity (Identical Filename Collision)", False, details_msg, 200)
                    else:
                        record_test("Resume Identity (Identical Filename Collision)", True, "Both Candidates received their correct distinct resumes despite identical upload filenames", 200)
                else:
                    record_test("Resume Identity (Identical Filename Collision)", False, f"Resume download HTTP error: {r_res1.status_code}, {r_res2.status_code}")
            else:
                record_test("Resume Identity (Identical Filename Collision)", False, f"Analysis failed to complete or had insufficient candidates: {len(col_candidates)}")
        else:
            record_test("Resume Identity (Identical Filename Collision)", False, f"Failed to post analysis: HTTP {r_post.status_code}")
    except Exception as e:
        record_test("Resume Identity (Identical Filename Collision)", False, f"Test failed with error: {e}")

    # ----------------------------------------------------
    # Summary Report
    # ----------------------------------------------------
    print("\n" + "=" * 80)
    print("SUMMARY REPORT")
    print("=" * 80)

    passed_count = sum(1 for t in test_results if t["passed"])
    failed_count = sum(1 for t in test_results if not t["passed"])
    total_count = len(test_results)

    print(f"Total Tests Run: {total_count}")
    print(f"Passed: {passed_count}")
    print(f"Failed: {failed_count}")
    print(f"Excel File Opened: {'Yes' if excel_opened else 'No'}")
    print(f"PDF Resume Validated: {'Yes' if pdf_validated else 'No'}")

    # ----------------------------------------------------
    # 9. POST /api/v1/job-descriptions/extract
    # ----------------------------------------------------
    print("\n--- 9. Testing POST /api/v1/job-descriptions/extract ---")
    try:
        with open(pdf1_path, "rb") as f1:
            files = {"file": ("jd_test.pdf", f1, "application/pdf")}
            r = requests.post(f"{BASE_URL}/api/v1/job-descriptions/extract", files=files)
            if r.status_code == 200:
                data = r.json()
                if "text" in data and len(data["text"]) > 20:
                    record_test("POST JD Extract (Valid PDF)", True, f"Successfully extracted {len(data['text'])} chars", r.status_code)
                else:
                    record_test("POST JD Extract (Valid PDF)", False, "No meaningful text returned", r.status_code)
            else:
                record_test("POST JD Extract (Valid PDF)", False, f"Expected 200, got {r.status_code}: {r.text}", r.status_code)
                
        # Test Invalid File
        invalid_file_content = b"Not a PDF file"
        files = {"file": ("invalid.txt", io.BytesIO(invalid_file_content), "text/plain")}
        r_inv = requests.post(f"{BASE_URL}/api/v1/job-descriptions/extract", files=files)
        if r_inv.status_code == 422:
            record_test("POST JD Extract (Invalid Extension)", True, "Correctly rejected non-PDF extension", r_inv.status_code)
        else:
            record_test("POST JD Extract (Invalid Extension)", False, f"Expected 422, got {r_inv.status_code}", r_inv.status_code)
            
        # Test Corrupted PDF (has .pdf extension but invalid content)
        files = {"file": ("corrupt.pdf", io.BytesIO(invalid_file_content), "application/pdf")}
        r_cor = requests.post(f"{BASE_URL}/api/v1/job-descriptions/extract", files=files)
        if r_cor.status_code == 422:
            record_test("POST JD Extract (Corrupted PDF)", True, "Correctly rejected invalid PDF signature", r_cor.status_code)
        else:
            record_test("POST JD Extract (Corrupted PDF)", False, f"Expected 422, got {r_cor.status_code}", r_cor.status_code)

    except Exception as e:
        record_test("POST JD Extract", False, f"Request failed: {e}")

    print("\nTest Details:")
    print(f"{'Endpoint / Test Name':<45} | {'Status':<8} | {'HTTP':<6} | {'Details'}")
    print("-" * 100)
    for t in test_results:
        st = "PASS" if t["passed"] else "FAIL"
        http_s = str(t["http_status"]) if t["http_status"] else "N/A"
        print(f"{t['name']:<45} | {st:<8} | {http_s:<6} | {t['details']}")

    print("=" * 80)

    if failed_count > 0:
        print(f"\n[WARNING] {failed_count} test(s) failed. See diagnostic output above.")
        sys.exit(1)
    else:
        print("\nAll endpoint tests passed successfully!")
        sys.exit(0)


if __name__ == "__main__":
    run_tests()
