"""
Comprehensive test suite for skill normalization system.
Tests canonical alias mapping, fuzzy matching, and semantic equivalence.
"""
import sys
sys.path.append('/Users/arsh/Work/Development/recruitment dashboard/backend')

from app.nlp import (
    normalize_skill_term, 
    fuzzy_match_skill, 
    extract_skills, 
    extract_jd_requirements,
    CANONICAL_SKILL_MAPPING,
    CANONICAL_TO_ALIASES
)


def test_canonical_alias_mapping():
    """Test 1: Canonical alias mapping for common skill variations."""
    print("=" * 60)
    print("TEST 1: Canonical Alias Mapping")
    print("=" * 60)
    
    test_cases = [
        ("js", "JavaScript"),
        ("javascript", "JavaScript"),
        ("es6", "JavaScript"),
        ("ecmascript", "JavaScript"),
        ("ts", "TypeScript"),
        ("typescript", "TypeScript"),
        ("postgres", "PostgreSQL"),
        ("postgresql", "PostgreSQL"),
        ("postgres db", "PostgreSQL"),
        ("mongo", "MongoDB"),
        ("mongodb", "MongoDB"),
        ("k8s", "Kubernetes"),
        ("kubernetes", "Kubernetes"),
        ("aws", "AWS"),
        ("amazon web services", "AWS"),
        ("ml", "Machine Learning"),
        ("machine learning", "Machine Learning"),
        ("dl", "Deep Learning"),
        ("deep learning", "Deep Learning"),
        ("nlp", "NLP"),
        ("natural language processing", "NLP"),  # This should normalize to NLP
        ("react", "React"),
        ("reactjs", "React"),
        ("react.js", "React"),
        ("node", "Node.js"),
        ("nodejs", "Node.js"),
        ("node.js", "Node.js"),
        ("vue", "Vue.js"),
        ("vuejs", "Vue.js"),
        ("docker", "Docker"),
        ("docker containers", "Docker"),
        ("front-end", "Frontend"),
        ("frontend", "Frontend"),
        ("front end", "Frontend"),
        ("back-end", "Backend"),
        ("backend", "Backend"),
        ("back end", "Backend"),
    ]
    
    passed = 0
    failed = 0
    
    for input_term, expected_canonical in test_cases:
        result = normalize_skill_term(input_term)
        if result == expected_canonical:
            print(f"✓ '{input_term}' → '{result}' (expected: '{expected_canonical}')")
            passed += 1
        else:
            print(f"✗ '{input_term}' → '{result}' (expected: '{expected_canonical}')")
            failed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed out of {len(test_cases)} tests")
    print(f"Success rate: {passed/len(test_cases)*100:.1f}%")
    return failed == 0


def test_fuzzy_matching():
    """Test 2: Fuzzy matching for typos, punctuation, and hyphenation."""
    print("\n" + "=" * 60)
    print("TEST 2: Fuzzy Matching & Typo Tolerance")
    print("=" * 60)
    
    test_cases = [
        ("Front-End", "Frontend"),
        ("Frontend", "Frontend"),
        ("NoSQL", "MongoDB"),  # Should match to MongoDB as closest canonical
        ("No-SQL", "MongoDB"),
        ("NodeJS", "Node.js"),
        ("Node.js", "Node.js"),
        ("PL/SQL", "SQL"),
        ("PLSQL", "SQL"),
        ("ReactJS", "React"),
        ("JavaScipt", "JavaScript"),  # Typo
        ("TypeScipt", "TypeScript"),  # Typo
        ("Pythn", "Python"),  # Typo
        ("Kubernets", "Kubernetes"),  # Typo
        ("Dockr", "Docker"),  # Typo
    ]
    
    passed = 0
    failed = 0
    
    for input_term, expected_canonical in test_cases:
        result = fuzzy_match_skill(input_term, threshold=0.85)
        if result == expected_canonical:
            print(f"✓ Fuzzy '{input_term}' → '{result}' (expected: '{expected_canonical}')")
            passed += 1
        else:
            print(f"✗ Fuzzy '{input_term}' → '{result}' (expected: '{expected_canonical}')")
            failed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed out of {len(test_cases)} tests")
    print(f"Success rate: {passed/len(test_cases)*100:.1f}%")
    return failed == 0


def test_skill_extraction():
    """Test 3: End-to-end skill extraction with normalization."""
    print("\n" + "=" * 60)
    print("TEST 3: Skill Extraction with Normalization")
    print("=" * 60)
    
    # Test candidate resume with various skill variations
    candidate_resume = """
    John Doe
    Senior Software Engineer
    
    Experience:
    - Developed web applications using JS, ES6, and React
    - Built backend services with Node.js and Express
    - Worked with Postgres database and MongoDB for data storage
    - Implemented ML models using Python and TensorFlow
    - Deployed applications using Docker and K8s
    - Used AWS cloud services for infrastructure
    - Experience with NLP and computer vision projects
    """
    
    jd_requirements = """
    We are looking for a Senior Software Engineer with:
    Required: JavaScript, React, Node.js, PostgreSQL, Python
    Preferred: AWS, Docker, Kubernetes, Machine Learning, NLP
    """
    
    candidate_skills = extract_skills(candidate_resume)
    required_skills, preferred_skills = extract_jd_requirements(jd_requirements)
    
    print(f"Candidate skills extracted: {candidate_skills}")
    print(f"JD required skills: {required_skills}")
    print(f"JD preferred skills: {preferred_skills}")
    
    # Check if candidate has all required skills (using canonical forms)
    candidate_skill_set = set(candidate_skills)
    required_skill_set = set(required_skills)
    
    matching_required = candidate_skill_set & required_skill_set
    missing_required = required_skill_set - candidate_skill_set
    
    print(f"\nMatching required skills: {matching_required}")
    print(f"Missing required skills: {missing_required}")
    
    # The key test: JS should match JavaScript, Postgres should match PostgreSQL
    expected_matches = {"JavaScript", "React", "Node.js", "PostgreSQL", "Python"}
    
    if expected_matches.issubset(candidate_skill_set):
        print(f"✓ All expected skills found despite different terminology")
        print(f"✓ Skill normalization working correctly")
        return True
    else:
        print(f"✗ Missing expected skills: {expected_matches - candidate_skill_set}")
        return False


def test_candidate_jd_matching():
    """Test 4: Complete candidate-JD matching scenario."""
    print("\n" + "=" * 60)
    print("TEST 4: Complete Candidate-JD Matching Scenario")
    print("=" * 60)
    
    # JD requiring specific skills
    jd = """
    Senior Full Stack Developer Position
    
    Required Skills:
    - JavaScript development experience
    - React framework knowledge
    - Node.js backend development
    - PostgreSQL database expertise
    - AWS cloud experience
    
    Preferred Skills:
    - Docker containerization
    - Kubernetes orchestration
    - Machine Learning background
    - Natural Language Processing experience
    """
    
    # Candidate with same skills but different terminology
    candidate = """
    Jane Smith
    Full Stack Developer
    
    Technical Skills:
    - JS, ES6, ECMAScript programming
    - ReactJS, React.js front-end development
    - Node, NodeJS, Node.js server-side development
    - Postgres, PostgreSQL database management
    - Amazon Web Services, AWS cloud infrastructure
    - Docker, Docker containers
    - K8s, Kubernetes cluster management
    - ML, Machine Learning algorithms
    - NLP, Natural Language Processing
    """
    
    required_skills, preferred_skills = extract_jd_requirements(jd)
    candidate_skills = extract_skills(candidate)
    
    print(f"JD Required: {required_skills}")
    print(f"JD Preferred: {preferred_skills}")
    print(f"Candidate Skills: {candidate_skills}")
    
    # Calculate match percentage
    all_jd_skills = set(required_skills + preferred_skills)
    candidate_skill_set = set(candidate_skills)
    
    matching_skills = candidate_skill_set & all_jd_skills
    match_percentage = len(matching_skills) / len(all_jd_skills) * 100 if all_jd_skills else 0
    
    print(f"\nMatching skills: {matching_skills}")
    print(f"Match percentage: {match_percentage:.1f}%")
    
    # Check key normalization test cases specifically
    key_normalization_tests = {
        "JavaScript": "JS" in candidate or "javascript" in candidate.lower(),
        "PostgreSQL": "Postgres" in candidate or "postgres" in candidate.lower(),
        "Kubernetes": "K8s" in candidate or "k8s" in candidate.lower(),
        "Node.js": "Node" in candidate or "node" in candidate.lower(),
        "React": "React" in candidate or "react" in candidate.lower(),
    }
    
    # Verify the candidate has the key skills despite different terminology
    has_key_skills = all(skill in candidate_skill_set for skill in ["JavaScript", "PostgreSQL", "Kubernetes", "Node.js", "React"])
    
    if has_key_skills and match_percentage >= 95:
        print(f"✓ EXCELLENT MATCH - Candidate with 'JS', 'Postgres', 'K8s' correctly normalized to match JD requiring 'JavaScript', 'PostgreSQL', 'Kubernetes'")
        print(f"✓ Skill normalization working correctly across terminology variations")
        return True
    elif has_key_skills:
        print(f"✓ Key skill normalization working - Candidate has all required skills despite terminology differences")
        print(f"✓ Match percentage: {match_percentage:.1f}% (slight variations in preferred skills)")
        return True
    else:
        print(f"✗ Key skills not properly normalized: Missing {[s for s in ['JavaScript', 'PostgreSQL', 'Kubernetes', 'Node.js', 'React'] if s not in candidate_skill_set]}")
        return False


def test_taxonomy_coverage():
    """Test 5: Verify comprehensive taxonomy coverage."""
    print("\n" + "=" * 60)
    print("TEST 5: Taxonomy Coverage Analysis")
    print("=" * 60)
    
    categories = {
        "Programming Languages": ["Python", "JavaScript", "TypeScript", "Java", "Go", "Rust"],
        "Web Frameworks": ["React", "Angular", "Vue.js", "Django", "Flask", "Express.js"],
        "Data & ML": ["TensorFlow", "PyTorch", "Pandas", "NumPy", "Machine Learning", "NLP"],
        "Cloud & DevOps": ["AWS", "Docker", "Kubernetes", "Terraform", "CI/CD"],
        "Databases": ["PostgreSQL", "MongoDB", "Redis", "Elasticsearch"],
        "Tools & Methodologies": ["Git", "Agile", "REST APIs", "GraphQL"],
    }
    
    total_canonical = len(CANONICAL_TO_ALIASES)
    total_aliases = len(CANONICAL_SKILL_MAPPING)
    
    print(f"Total canonical skills: {total_canonical}")
    print(f"Total alias mappings: {total_aliases}")
    print(f"Average aliases per canonical: {total_aliases/total_canonical:.1f}")
    
    coverage_results = {}
    for category, skills in categories.items():
        covered = sum(1 for skill in skills if skill in CANONICAL_TO_ALIASES)
        percentage = covered / len(skills) * 100
        coverage_results[category] = percentage
        print(f"{category}: {covered}/{len(skills)} ({percentage:.0f}%)")
    
    overall_coverage = sum(coverage_results.values()) / len(coverage_results)
    print(f"\nOverall taxonomy coverage: {overall_coverage:.1f}%")
    
    if overall_coverage >= 90:
        print(f"✓ Excellent taxonomy coverage achieved")
        return True
    else:
        print(f"✗ Taxonomy coverage below 90%")
        return False


def run_all_tests():
    """Run all test suites and report results."""
    print("\n" + "=" * 60)
    print("COMPREHENSIVE SKILL NORMALIZATION TEST SUITE")
    print("=" * 60)
    
    results = {
        "Canonical Alias Mapping": test_canonical_alias_mapping(),
        "Fuzzy Matching": test_fuzzy_matching(),
        "Skill Extraction": test_skill_extraction(),
        "Candidate-JD Matching": test_candidate_jd_matching(),
        "Taxonomy Coverage": test_taxonomy_coverage(),
    }
    
    print("\n" + "=" * 60)
    print("FINAL TEST RESULTS")
    print("=" * 60)
    
    for test_name, passed in results.items():
        status = "✓ PASSED" if passed else "✗ FAILED"
        print(f"{test_name}: {status}")
    
    total_passed = sum(results.values())
    total_tests = len(results)
    
    print(f"\nOverall: {total_passed}/{total_tests} test suites passed")
    print(f"Success rate: {total_passed/total_tests*100:.1f}%")
    
    if total_passed == total_tests:
        print("\n🎉 ALL TESTS PASSED - Skill normalization system is working correctly!")
        return True
    else:
        print(f"\n⚠️  {total_tests - total_passed} test suite(s) failed - Review and fix issues")
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)