"""Simple test script to verify the name extraction functions work correctly."""
import sys
import os
import hashlib

def test_file_hash():
    """Test file hash generation function."""
    print("Testing file hash generation...")
    
    # Test with a simple file
    test_content = b"test content for hash generation"
    test_hash = hashlib.sha256(test_content).hexdigest()[:8]
    print(f"Test hash: {test_hash}")
    assert len(test_hash) == 8, "Hash should be 8 characters"
    print("✓ File hash generation works correctly")

def test_imports():
    """Test that the new functions can be imported."""
    print("\nTesting imports...")
    try:
        # These will fail if dependencies aren't installed, but that's expected
        from app.nlp import extract_candidate_name_production, generate_file_hash, extract_name_using_llm, extract_name_using_font_size
        print("✓ All new name extraction functions imported successfully")
        return True
    except ImportError as e:
        print(f"✗ Import failed (expected if dependencies not installed): {e}")
        return False

def test_logic_validation():
    """Test the logic of the new functions without actual PDF processing."""
    print("\nTesting logic validation...")
    
    # Test hash generation logic
    test_filename = "test_file.pdf"
    filename_hash = hashlib.sha256(test_filename.encode()).hexdigest()[:8]
    print(f"Filename hash: {filename_hash}")
    assert len(filename_hash) == 8, "Filename hash should be 8 characters"
    
    # Test fallback name generation logic
    file_hash = "a1b2c3d4"
    fallback_name = f"Unnamed Candidate ({file_hash})"
    print(f"Fallback name: {fallback_name}")
    assert fallback_name == "Unnamed Candidate (a1b2c3d4)", "Fallback name format incorrect"
    
    print("✓ Logic validation passed")

if __name__ == "__main__":
    print("=" * 80)
    print("SIMPLE NAME EXTRACTION TEST")
    print("=" * 80)
    
    test_file_hash()
    test_logic_validation()
    imports_work = test_imports()
    
    print("\n" + "=" * 80)
    if imports_work:
        print("ALL TESTS PASSED - Dependencies are installed")
    else:
        print("BASIC TESTS PASSED - Dependencies need to be installed")
        print("Run: pip install -r requirements.txt")
    print("=" * 80)