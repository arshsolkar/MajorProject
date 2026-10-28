"""Test script for the new production-grade name extraction engine."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.nlp import extract_pdf_text, extract_candidate_name_production, generate_file_hash
from app.config import settings

# Test cases with different types of PDFs
test_cases = []

# Add hash filename cases
hash_files = [
    "/Users/arsh/Work/Development/recruitment dashboard/Resumes PDF/Accountant/0287439839da10d2.pdf",
    "/Users/arsh/Work/Development/recruitment dashboard/Resumes PDF/Accountant/0452d98376727179.pdf",
]

for file_path in hash_files:
    if os.path.exists(file_path):
        test_cases.append({
            "pdf_path": file_path,
            "description": f"Hash filename ({os.path.basename(file_path)})"
        })

# Add normal numbered filename
normal_file = "/Users/arsh/Work/Development/recruitment dashboard/Resumes PDF/Accountant/1.pdf"
if os.path.exists(normal_file):
    test_cases.append({
        "pdf_path": normal_file,
        "description": "Normal numbered filename (1.pdf)"
    })

# If no test cases found, add a fallback
if not test_cases:
    print("No test PDFs found. Please add PDF paths to test_cases.")
    sys.exit(1)

def test_name_extraction():
    """Test the 100% local name extraction engine."""
    print("=" * 80)
    print("100% LOCAL NAME EXTRACTION ENGINE TEST")
    print("=" * 80)
    print("Extraction Methods:")
    print("1. Local font-size extraction via pdfplumber (primary)")
    print("2. Local spaCy NER extraction (secondary)")
    print("3. Clean SHA256 hash fallback")
    print("=" * 80)
    
    for i, test_case in enumerate(test_cases, 1):
        pdf_path = test_case["pdf_path"]
        description = test_case["description"]
        
        if not os.path.exists(pdf_path):
            print(f"\nTest {i}: SKIPPED - File not found: {pdf_path}")
            continue
        
        print(f"\nTest {i}: {description}")
        print(f"File: {os.path.basename(pdf_path)}")
        print("-" * 80)
        
        try:
            # Extract text from PDF
            text = extract_pdf_text(pdf_path)
            print(f"Text length: {len(text)} characters")
            print(f"Text preview: {text[:200]}...")
            
            # Get filename
            filename = os.path.basename(pdf_path)
            
            # Test file hash generation
            file_hash = generate_file_hash(pdf_path)
            print(f"File hash: {file_hash}")
            
            # Test production name extraction
            extracted_name, requires_manual_entry = extract_candidate_name_production(text, filename, pdf_path)
            
            print(f"Extracted name: {extracted_name}")
            print(f"Requires manual entry: {requires_manual_entry}")
            
            # Test old method for comparison
            from app.nlp import extract_candidate_name_tiered
            old_name = extract_candidate_name_tiered(text, filename, pdf_path)
            print(f"Old method result: {old_name}")
            
        except Exception as e:
            print(f"ERROR: {e}")
            import traceback
            traceback.print_exc()
        
        print("-" * 80)
    
    print("\n" + "=" * 80)
    print("TEST COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    test_name_extraction()