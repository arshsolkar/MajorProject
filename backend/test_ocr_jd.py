import os
import io
import requests

def create_image_pdf():
    # Create an image with text
    img = Image.new('RGB', (400, 200), color=(255, 255, 255))
    # We will just save a blank image or something, but tesseract won't find text.
    # Actually, we can use a small real pdf from the Resumes folder that we know is scanned.
    # If we don't know which is scanned, let's create a PDF that draws an image (not text).
    pass

# We will just send Image_10.pdf to the endpoint and check if it extracts text.
# Some of these Image_*.pdf files are definitely scanned. Let's test a few.
import sys
BASE_URL = "http://127.0.0.1:8000"
RESUMES_DIR = os.path.join(os.path.dirname(__file__), "..", "Resumes")

def test_scanned_pdf():
    for f in os.listdir(RESUMES_DIR):
        if not f.endswith(".pdf"): continue
        path = os.path.join(RESUMES_DIR, f)
        
        # Test directly via python fitz to see if it has text layer
        import fitz
        with fitz.open(path) as doc:
            raw_text = "\n".join(page.get_text("text") for page in doc)
            if len(raw_text.strip()) < 40:
                print(f"Found scanned/image-only PDF: {f}")
                with open(path, "rb") as pdf_f:
                    r = requests.post(f"{BASE_URL}/api/v1/job-descriptions/extract", files={"file": (f, pdf_f, "application/pdf")})
                    print("Status:", r.status_code)
                    if r.status_code == 200:
                        print("Extracted Length:", len(r.json().get("text", "")))
                        print("Extracted Preview:", r.json().get("text", "")[:100].replace("\n", " "))
                    else:
                        print("Error:", r.text)
                return

if __name__ == "__main__":
    test_scanned_pdf()
