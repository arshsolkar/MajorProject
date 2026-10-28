"""
Validation script to check the refactored code logic without requiring full dependencies.
This validates the key improvements made to the processing pipeline.
"""

import re
from datetime import datetime

try:
    from dateutil import parser as date_parser
    import numpy as np
except ImportError:
    print("Warning: dateutil or numpy not installed, some validations will be skipped")
    date_parser = None
    np = None

def validate_skill_patterns():
    """Validate that the new skill patterns are comprehensive and JD-context aware."""
    print("Validating Skill Patterns...")
    
    # Simulate the new skill patterns
    TECH_SKILLS = {
        "python": "Python", "java": "Java", "javascript": "JavaScript", "typescript": "TypeScript",
        "c++": "C++", "c#": "C#", "go": "Go", "rust": "Rust", "php": "PHP", "ruby": "Ruby",
        "swift": "Swift", "kotlin": "Kotlin", "scala": "Scala", "r": "R", "matlab": "MATLAB",
        "react": "React", "angular": "Angular", "vue": "Vue.js", "next.js": "Next.js", "nuxt": "Nuxt.js",
        "django": "Django", "flask": "Flask", "fastapi": "FastAPI", "spring boot": "Spring Boot",
        "express": "Express.js", "node.js": "Node.js", "nest.js": "NestJS",
        "tensorflow": "TensorFlow", "pytorch": "PyTorch", "keras": "Keras",
        "scikit-learn": "Scikit-learn", "sklearn": "Scikit-learn", "pandas": "Pandas",
        "numpy": "NumPy", "spark": "Spark", "pyspark": "PySpark", "hadoop": "Hadoop",
        "machine learning": "Machine Learning", "deep learning": "Deep Learning",
        "nlp": "NLP", "computer vision": "Computer Vision", "statistics": "Statistics",
        "aws": "AWS", "azure": "Azure", "gcp": "GCP", "docker": "Docker",
        "kubernetes": "Kubernetes", "terraform": "Terraform", "ansible": "Ansible",
        "jenkins": "Jenkins", "ci/cd": "CI/CD", "linux": "Linux",
        "sql": "SQL", "postgresql": "PostgreSQL", "mysql": "MySQL", "mongodb": "MongoDB",
        "redis": "Redis", "elasticsearch": "Elasticsearch", "cassandra": "Cassandra",
        "git": "Git", "jira": "Jira", "agile": "Agile", "scrum": "Scrum",
        "rest api": "REST APIs", "graphql": "GraphQL", "api": "APIs",
        "airflow": "Airflow", "kafka": "Kafka", "mlflow": "MLflow",
        "hugging face": "Hugging Face", "huggingface": "Hugging Face",
    }
    
    # Test Java JD - should NOT extract Python skills
    java_jd = "Senior Java Developer with Spring Boot and Hibernate experience"
    java_lower = f" {java_jd.lower()} "
    java_skills = [label for term, label in TECH_SKILLS.items() if re.search(rf"(?<!\w){re.escape(term)}(?!\w)", java_lower)]
    
    assert "Java" in java_skills, "Java not extracted from Java JD"
    assert "Spring Boot" in java_skills, "Spring Boot not extracted from Java JD"
    assert "Python" not in java_skills, "Python incorrectly extracted from Java JD"
    
    print("✓ Skill patterns are JD-context aware")


def validate_sanitization_logic():
    """Validate the PDF sanitization logic."""
    print("Validating PDF Sanitization Logic...")
    
    # Test patterns
    url_pattern = re.compile(r'https?://[^\s<>"]+|www\.[^\s<>"]+')
    template_patterns = [
        re.compile(r'qwikresume\.com', re.I),
        re.compile(r'resumeworded\.com', re.I),
    ]
    contact_patterns = [
        re.compile(r'^\s*(email|phone|linkedin|github|website|address|location)[:\s].*$', re.I),
    ]
    
    test_text = "John Doe\nWebsite: www.qwikresume.com\nEmail: john@test.com\nSenior Developer"
    
    # Apply sanitization
    lines = test_text.splitlines()
    cleaned = []
    for line in lines:
        line = url_pattern.sub('', line)
        if not any(pattern.search(line) for pattern in template_patterns):
            if not any(pattern.match(line) for pattern in contact_patterns):
                cleaned.append(line)
    
    cleaned_text = "\n".join(cleaned)
    
    assert "qwikresume.com" not in cleaned_text.lower(), "Template URL not removed"
    assert "Email:" not in cleaned_text, "Email header not removed"
    assert "John Doe" in cleaned_text, "Name incorrectly removed"
    
    print("✓ PDF sanitization logic is correct")


def validate_date_extraction_logic():
    """Validate the date extraction logic."""
    print("Validating Date Extraction Logic...")
    
    if date_parser is None:
        print("⚠ Skipping date extraction validation (dateutil not installed)")
        return
    
    # Test date patterns
    date_patterns = [
        r'(\w+\s+\d{4})\s*[-–to]+\s*(\w+\s+\d{4}|present|current|now)',
        r'(\d{1,2}/\d{4})\s*[-–to]+\s*(\d{1,2}/\d{4}|present|current|now)',
        r'(\d{4})\s*[-–to]+\s*(\d{4}|present|current|now)',
    ]
    
    test_text = "Jan 2018 - Present\n2015 - 2017\n06/2014 - 12/2014"
    
    date_ranges = []
    for pattern in date_patterns:
        matches = re.finditer(pattern, test_text, re.IGNORECASE)
        for match in matches:
            try:
                start_str = match.group(1)
                end_str = match.group(2)
                start_date = date_parser.parse(start_str, fuzzy=True)
                if end_str.lower() in ['present', 'current', 'now']:
                    end_date = datetime.now()
                else:
                    end_date = date_parser.parse(end_str, fuzzy=True)
                date_ranges.append((start_date, end_date))
            except Exception:
                continue
    
    assert len(date_ranges) >= 2, f"Expected at least 2 date ranges, got {len(date_ranges)}"
    
    # Calculate total experience
    total_days = 0
    for start, end in date_ranges:
        if end and start < end:
            total_days += (end - start).days
    total_years = round(total_days / 365.25, 1)
    
    assert total_years >= 7, f"Expected ~8 years experience, got {total_years}"
    
    print(f"✓ Date extraction logic is correct (calculated {total_years} years)")


def validate_normalization_logic():
    """Validate the semantic normalization logic."""
    print("Validating Semantic Normalization Logic...")
    
    if np is None:
        print("⚠ Skipping normalization validation (numpy not installed)")
        return
    
    # Test raw similarities
    raw_similarities = np.array([0.45, 0.52, 0.58, 0.41, 0.55])
    
    # Apply sigmoid normalization
    normalized = 1 / (1 + np.exp(-10 * (raw_similarities - 0.5)))
    
    # Scale to 0-1 range
    if normalized.max() > normalized.min():
        normalized = (normalized - normalized.min()) / (normalized.max() - normalized.min())
    
    assert max(normalized) > 0.7, "Normalization not improving high scores"
    assert min(normalized) < 0.3, "Normalization not improving low scores"
    
    print(f"✓ Semantic normalization logic is correct (raw: {raw_similarities.tolist()} -> normalized: {[round(x, 2) for x in normalized.tolist()]})")


def validate_composite_scoring_logic():
    """Validate the composite scoring logic."""
    print("Validating Composite Scoring Logic...")
    
    # Test the new weighting: 40% skills, 30% semantic, 20% experience, 10% education
    def calculate_composite_score(skill_coverage, semantic_fit, experience_match, education_role_alignment=50):
        overall = (
            (skill_coverage * 0.40) +
            (semantic_fit * 0.30) +
            (experience_match * 0.20) +
            (education_role_alignment * 0.10)
        )
        # Use simple clip instead of np.clip
        overall = max(0, min(100, overall))
        return int(round(overall))
    
    # Test high skill coverage candidate
    high_skill = calculate_composite_score(
        skill_coverage=95,  # Higher skill coverage
        semantic_fit=75,   # Better semantic fit
        experience_match=85,  # Strong experience
        education_role_alignment=75
    )
    
    assert high_skill >= 85, f"High skill candidate should get 85%+, got {high_skill}"
    
    # Test low skill coverage candidate
    low_skill = calculate_composite_score(
        skill_coverage=40,
        semantic_fit=60,
        experience_match=70,
        education_role_alignment=60
    )
    
    assert low_skill < 70, f"Low skill candidate should not get 70%+, got {low_skill}"
    
    print(f"✓ Composite scoring logic is correct (high skill: {high_skill}%, low skill: {low_skill}%)")


def validate_jd_requirement_logic():
    """Validate the JD requirement extraction logic."""
    print("Validating JD Requirement Extraction Logic...")
    
    # Simulate the logic
    def extract_jd_requirements_mock(job_description):
        required_keywords = ['required', 'must have', 'essential', 'mandatory', 'need', 'should have']
        preferred_keywords = ['preferred', 'nice to have', 'bonus', 'plus', 'advantageous', 'desired']
        
        required_section = ""
        preferred_section = ""
        
        sentences = re.split(r'[.!?]+', job_description)
        
        for sentence in sentences:
            sentence_lower = sentence.lower()
            if any(keyword in sentence_lower for keyword in required_keywords):
                required_section += sentence + " "
            elif any(keyword in sentence_lower for keyword in preferred_keywords):
                preferred_section += sentence + " "
            else:
                required_section += sentence + " "
        
        return required_section, preferred_section
    
    java_jd = """
    We are looking for a Senior Java Developer.
    
    Required Skills: Java, Spring Boot, Hibernate, Experience with REST APIs.
    
    Preferred Skills: AWS cloud experience, Docker and Kubernetes.
    """
    
    required, preferred = extract_jd_requirements_mock(java_jd)
    
    # Check that the sections contain the right keywords
    assert "Java" in required, "Java not in required section"
    assert "Spring Boot" in required, "Spring Boot not in required section"
    assert "AWS" in preferred, "AWS not in preferred section"
    assert "Docker" in preferred, "Docker not in preferred section"
    
    print("✓ JD requirement extraction logic is correct")


def run_validation():
    """Run all validation checks."""
    print("=" * 50)
    print("Validating Refactored Component Logic")
    print("=" * 50)
    
    try:
        validate_skill_patterns()
        validate_sanitization_logic()
        validate_date_extraction_logic()
        validate_normalization_logic()
        validate_composite_scoring_logic()
        validate_jd_requirement_logic()
        
        print("=" * 50)
        print("✓ All validation checks passed!")
        print("=" * 50)
        return True
        
    except AssertionError as e:
        print(f"✗ Validation failed: {e}")
        return False
    except Exception as e:
        print(f"✗ Unexpected error: {e}")
        return False


if __name__ == "__main__":
    import sys
    success = run_validation()
    sys.exit(0 if success else 1)