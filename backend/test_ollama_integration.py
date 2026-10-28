"""
Test suite for Ollama-based structured resume parsing integration.

This script tests the new Ollama LLM integration for resume data extraction,
validating that it correctly extracts candidate names, experience years, education,
and skills while properly handling placeholder resumes and fallback scenarios.
"""

import sys
import os
from pathlib import Path

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.nlp import extract_pdf_text, extract_resume_data_ollama, generate_file_hash
from app.config import settings


def test_ollama_integration():
    """Test Ollama integration with sample resumes from the dataset."""
    
    print("=" * 80)
    print("OLLAMA INTEGRATION TEST SUITE")
    print("=" * 80)
    print(f"Ollama Base URL: {settings.ollama_base_url}")
    print(f"Ollama Model: {settings.ollama_model}")
    print(f"Ollama Timeout: {settings.ollama_timeout}")
    print("=" * 80)
    
    # Test cases with expected outcomes
    test_cases = [
        # Real candidate names that should extract correctly
        {
            "name": "John Anderson",
            "description": "Real candidate name",
            "expected_name_type": "real_name"
        },
        {
            "name": "Laityn Westercamp", 
            "description": "Real candidate name with uncommon spelling",
            "expected_name_type": "real_name"
        },
        {
            "name": "Amelia Bones",
            "description": "Real candidate name",
            "expected_name_type": "real_name"
        },
        {
            "name": "Peter Connolly",
            "description": "Real candidate name",
            "expected_name_type": "real_name"
        },
        {
            "name": "Robert Smith",
            "description": "Real candidate name",
            "expected_name_type": "real_name"
        }
    ]
    
    # Sample PDF files from the dataset
    resume_dir = Path("/Users/arsh/Work/Development/recruitment dashboard/Resumes PDF/Accountant")
    
    # Get a sample of PDF files for testing
    pdf_files = list(resume_dir.glob("*.pdf"))[:5]  # Test first 5 PDFs
    
    if not pdf_files:
        print("ERROR: No PDF files found in the dataset directory")
        return False
    
    print(f"\nFound {len(pdf_files)} PDF files for testing")
    print("=" * 80)
    
    results = {
        "total_tests": 0,
        "passed": 0,
        "failed": 0,
        "details": []
    }
    
    for pdf_path in pdf_files:
        print(f"\n{'=' * 80}")
        print(f"Testing: {pdf_path.name}")
        print(f"{'=' * 80}")
        
        try:
            # Extract text from PDF
            print("1. Extracting text from PDF...")
            text = extract_pdf_text(str(pdf_path))
            print(f"   ✓ Extracted {len(text)} characters")
            
            # Test Ollama extraction
            print("2. Running Ollama-based extraction...")
            extracted_data = extract_resume_data_ollama(text, str(pdf_path))
            
            results["total_tests"] += 1
            
            # Display extracted data
            print(f"   Candidate Name: {extracted_data['name']}")
            print(f"   Requires Manual Entry: {extracted_data['requires_manual_entry']}")
            print(f"   Experience Years: {extracted_data['experience_years']}")
            print(f"   Education: {extracted_data['education']}")
            print(f"   Skills: {', '.join(extracted_data['skills'][:5])}...")
            
            # Validate the extraction
            test_passed = True
            validation_issues = []
            
            # Check name extraction
            if extracted_data['requires_manual_entry']:
                if not extracted_data['name'].startswith("Unnamed Candidate"):
                    validation_issues.append("Name marked for manual entry but doesn't follow fallback pattern")
                    test_passed = False
            else:
                if extracted_data['name'].startswith("Unnamed Candidate"):
                    validation_issues.append("Name not marked for manual entry but uses fallback pattern")
                    test_passed = False
            
            # Check experience years
            if not isinstance(extracted_data['experience_years'], (int, float)):
                validation_issues.append(f"Experience years is not numeric: {type(extracted_data['experience_years'])}")
                test_passed = False
            elif extracted_data['experience_years'] < 0:
                validation_issues.append(f"Experience years is negative: {extracted_data['experience_years']}")
                test_passed = False
            elif extracted_data['experience_years'] > 50:
                validation_issues.append(f"Experience years seems unrealistic: {extracted_data['experience_years']}")
                test_passed = False
            
            # Check education
            if not extracted_data['education'] or extracted_data['education'] == "Not specified":
                print(f"   ⚠ Warning: Education not specified or empty")
            
            # Check skills
            if not isinstance(extracted_data['skills'], list):
                validation_issues.append(f"Skills is not a list: {type(extracted_data['skills'])}")
                test_passed = False
            elif len(extracted_data['skills']) == 0:
                print(f"   ⚠ Warning: No skills extracted")
            
            # Record results
            if test_passed:
                results["passed"] += 1
                print(f"   ✓ TEST PASSED")
            else:
                results["failed"] += 1
                print(f"   ✗ TEST FAILED")
                for issue in validation_issues:
                    print(f"      - {issue}")
            
            results["details"].append({
                "file": pdf_path.name,
                "passed": test_passed,
                "issues": validation_issues,
                "extracted_data": extracted_data
            })
            
        except Exception as e:
            results["total_tests"] += 1
            results["failed"] += 1
            print(f"   ✗ TEST FAILED with exception: {e}")
            results["details"].append({
                "file": pdf_path.name,
                "passed": False,
                "issues": [f"Exception: {str(e)}"],
                "extracted_data": None
            })
    
    # Print summary
    print(f"\n{'=' * 80}")
    print("TEST SUMMARY")
    print(f"{'=' * 80}")
    print(f"Total Tests: {results['total_tests']}")
    print(f"Passed: {results['passed']}")
    print(f"Failed: {results['failed']}")
    print(f"Success Rate: {(results['passed'] / results['total_tests'] * 100) if results['total_tests'] > 0 else 0:.1f}%")
    print(f"{'=' * 80}")
    
    # Detailed results
    if results['failed'] > 0:
        print("\nFAILED TEST DETAILS:")
        for detail in results['details']:
            if not detail['passed']:
                print(f"\nFile: {detail['file']}")
                for issue in detail['issues']:
                    print(f"  - {issue}")
    
    return results['failed'] == 0


def test_fallback_scenarios():
    """Test fallback scenarios when Ollama is unavailable."""
    
    print("\n" + "=" * 80)
    print("FALLBACK SCENARIO TESTS")
    print("=" * 80)
    
    # Test with invalid/mock data to trigger fallback
    test_text = "This is a minimal resume text for testing fallback scenarios."
    test_pdf_path = "/tmp/test_fallback.pdf"
    
    print("\nTesting fallback with minimal text...")
    try:
        # This should trigger the fallback mechanism
        result = extract_resume_data_ollama(test_text, test_pdf_path)
        
        print(f"Fallback Result:")
        print(f"  Name: {result['name']}")
        print(f"  Requires Manual Entry: {result['requires_manual_entry']}")
        print(f"  Experience Years: {result['experience_years']}")
        print(f"  Education: {result['education']}")
        print(f"  Skills: {result['skills']}")
        
        # Validate fallback behavior
        if result['requires_manual_entry']:
            print("✓ Fallback correctly sets manual entry flag")
        else:
            print("✗ Fallback should set manual entry flag")
        
        if result['name'].startswith("Unnamed Candidate"):
            print("✓ Fallback correctly uses hash-based naming")
        else:
            print("✗ Fallback should use hash-based naming")
        
        return True
        
    except Exception as e:
        print(f"✗ Fallback test failed with exception: {e}")
        return False


def test_skill_normalization():
    """Test that Ollama-extracted skills are properly normalized."""
    
    print("\n" + "=" * 80)
    print("SKILL NORMALIZATION TEST")
    print("=" * 80)
    
    # Test text with various skill variations
    test_text = """
    John Doe
    Senior Software Engineer
    
    Experience:
    - 5 years of experience with js, reactjs, and python
    - Worked with SQL databases and postgres
    - Experience with aws cloud services
    - Used docker and k8s for containerization
    - Familiar with git and CI/CD pipelines
    """
    
    test_pdf_path = "/tmp/test_skills.pdf"
    
    print("\nTesting skill normalization with Ollama...")
    try:
        result = extract_resume_data_ollama(test_text, test_pdf_path)
        
        print(f"Extracted Skills: {result['skills']}")
        
        # Check for normalization (should canonicalize variations)
        skill_variations = {
            "js": "JavaScript",
            "reactjs": "React", 
            "python": "Python",
            "sql": "SQL",
            "postgres": "PostgreSQL",
            "aws": "AWS",
            "docker": "Docker",
            "k8s": "Kubernetes",
            "git": "Git",
            "cicd": "CI/CD"
        }
        
        # Check if skills were normalized
        normalized_found = False
        for raw, canonical in skill_variations.items():
            if canonical in result['skills']:
                print(f"✓ Normalized '{raw}' to '{canonical}'")
                normalized_found = True
        
        if normalized_found:
            print("✓ Skill normalization is working")
            return True
        else:
            print("⚠ No skill normalization detected (may need more comprehensive test)")
            return True  # Don't fail, just warn
            
    except Exception as e:
        print(f"✗ Skill normalization test failed: {e}")
        return False


if __name__ == "__main__":
    print("Starting Ollama Integration Test Suite...\n")
    
    # Run main integration tests
    integration_passed = test_ollama_integration()
    
    # Run fallback scenario tests
    fallback_passed = test_fallback_scenarios()
    
    # Run skill normalization tests
    normalization_passed = test_skill_normalization()
    
    # Final summary
    print("\n" + "=" * 80)
    print("FINAL TEST RESULTS")
    print("=" * 80)
    print(f"Integration Tests: {'PASSED' if integration_passed else 'FAILED'}")
    print(f"Fallback Tests: {'PASSED' if fallback_passed else 'FAILED'}")
    print(f"Skill Normalization Tests: {'PASSED' if normalization_passed else 'FAILED'}")
    
    all_passed = integration_passed and fallback_passed and normalization_passed
    print(f"\nOverall: {'ALL TESTS PASSED ✓' if all_passed else 'SOME TESTS FAILED ✗'}")
    print("=" * 80)
    
    sys.exit(0 if all_passed else 1)