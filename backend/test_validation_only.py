"""Test the validation function logic standalone."""
import re

def is_valid_candidate_name(name: str) -> bool:
    """
    Strict validation function for candidate names.
    Enforces character set, length, noise keyword rejection, and blacklist checks.
    """
    if not name or not isinstance(name, str):
        return False
    
    name = name.strip()
    
    # Character Set & Length: letters, spaces, hyphens, apostrophes only
    if not re.match(r"^[A-Za-z\s\-']+$", name):
        return False
    
    # Must be 2 to 4 words
    words = name.split()
    if not (2 <= len(words) <= 4):
        return False
    
    # Length between 3 and 40 characters
    if not (3 <= len(name) <= 40):
        return False
    
    # Noise Keyword Rejection: reject TLDs, web prefixes, template brands
    noise_keywords = ['.com', '.net', '.org', '.io', 'http', 'https', 'www', 'qwikresume', 'resumeworded']
    if any(keyword in name.lower() for keyword in noise_keywords):
        return False
    
    # Exact Phrase Blacklist: generic placeholders and section headers
    blacklist = [
        'first last', 'first name last name', 'your name', 'full name',
        'john doe', 'jane doe', 'candidate name', 'applicant name',
        'java developer', 'senior java developer', 'software engineer', 'junior developer',
        'work experience', 'curriculum vitae', 'resume', 'personal profile',
        'summary of qualifications', 'education'
    ]
    if name.lower() in blacklist:
        return False
    
    # Check for address-related keywords
    address_keywords = ['address', 'road', 'street', 'avenue', 'boulevard', 'lane', 'drive', 'court', 'place', 'way']
    if any(keyword in name.lower() for keyword in address_keywords):
        return False
    
    return True

# Test the validation function with provided test cases
test_cases = [
    # Category A: Valid Real Candidate Names (Should pass)
    ("John Anderson", True),
    ("Laityn Westercamp", True),
    ("Amelia Bones", True),
    ("Peter Connolly", True),
    ("Robert Smith", True),
    ("Jared Arthur Maica", True),
    ("Margot Jenkins", True),
    ("Gary White", True),
    ("Nathanial Hoppe", True),
    ("Victor Lauren", True),
    ("Kevin Edward", True),
    ("Jen Shozu", True),
    ("Stephanie Willis", True),
    ("Randy Brooks", True),
    ("Dan Schabold", True),
    ("Katelynn Tremblay", True),
    
    # Category B: Explicit Generic Placeholders (Should fail)
    ("First Last", False),
    ("First Name Last Name", False),
    ("Your Name", False),
    ("Full Name", False),
    ("John Doe", False),
    ("Jane Doe", False),
    ("Candidate Name", False),
    ("Applicant Name", False),
    
    # Category C: Section Headers & Job Titles (Should fail)
    ("Java Developer", False),
    ("Senior Java Developer", False),
    ("Software Engineer", False),
    ("Junior Developer", False),
    ("Work Experience", False),
    ("Curriculum Vitae", False),
    ("Resume", False),
    ("Personal Profile", False),
    ("Summary of Qualifications", False),
    ("Education", False),
    
    # Category D: Corrupted Header / URL / Contact Noise (Should fail)
    ("Website Andersonjohn.Com", False),
    ("Laityn.Westercampgmail.Com Profile", False),
    ("Address Marshville Road Alabama", False),
    ("Website Www. Qwikre Sume Com", False),
    ("Email Candidate@Gmail.Com", False),
]

print("Testing is_valid_candidate_name function:")
print("=" * 60)

passed = 0
failed = 0

for name, expected in test_cases:
    result = is_valid_candidate_name(name)
    status = "✓" if result == expected else "✗"
    
    if result == expected:
        passed += 1
    else:
        failed += 1
        
    print(f"{status} '{name}': Expected {expected}, Got {result}")

print("=" * 60)
print(f"Results: {passed} passed, {failed} failed")
print(f"Success rate: {passed/len(test_cases)*100:.1f}%")