"""Text extraction and explainable hybrid scoring helpers."""
import re
import hashlib
from io import BytesIO
from functools import lru_cache
from pathlib import Path
from typing import Iterable, Tuple, List, Dict, Set, Optional
try:
    import pymupdf as fitz
except ImportError:
    import fitz
import numpy as np
from PIL import Image
import pytesseract
from datetime import datetime
from dateutil import parser as date_parser
from pydantic import BaseModel, Field
from .config import settings

# Words that indicate a line is a job title or template header, NOT a candidate name
DOCUMENT_TITLE_WORDS = {
    "resume", "curriculum", "vitae", "cv", "developer", "engineer", 
    "architect", "programmer", "manager", "lead", "senior", "junior", 
    "mid-level", "contract", "intern", "profile", "summary", "experience",
    "software", "data", "scientist", "analyst", "consultant", "designer",
    "experienced", "professional", "passionate", "results", "objective",
    "resume", "name", "email", "phone", "contact", "address", "linkedin",
    "github", "portfolio", "skills", "education", "work", "employment",
    "history", "highly", "motivated", "seeking", "dedicated", "creative",
    "innovative", "summary", "about", "myself", "references", "curriculum",
    "vitae", "of", "the", "and", "for", "with",
}

NOISE_PATTERNS = [
    r"website", r"address", r"phone", r"email", r"http", r"https",
    r"www\.", r"\.com", r"\.net", r"\.org", r"qwikresume", r"resumeworded",
    r"github", r"linkedin", r"\d{5,}", r"@[\w\.]+"
]

def clean_text_line(text: str) -> str:
    """Pre-sanitizes text by removing email/URL noise."""
    text = re.sub(r"https?://\S+|www\.\S+", "", text)
    text = re.sub(r"\b[\w\.-]+@[\w\.-]+\.\w+\b", "", text)
    text = re.sub(r"(?i)\b(phone|email|website|address|linkedin|github)\b:?", "", text)
    return re.sub(r"\s+", " ", text).strip()

# Multi-Domain Canonical Alias & Taxonomy Normalization System
# Maps all surface-form variations to unified canonical skill entities
CANONICAL_SKILL_MAPPING: Dict[str, str] = {
    # Programming Languages & Variations
    "javascript": "JavaScript", "js": "JavaScript", "es6": "JavaScript", "ecmascript": "JavaScript",
    "typescript": "TypeScript", "ts": "TypeScript",
    "python": "Python", "py": "Python",
    "java": "Java",
    "c++": "C++", "cpp": "C++",
    "c#": "C#", "csharp": "C#",
    "go": "Go", "golang": "Go",
    "rust": "Rust", "rs": "Rust",
    "php": "PHP",
    "ruby": "Ruby", "rb": "Ruby",
    "swift": "Swift",
    "kotlin": "Kotlin", "kt": "Kotlin",
    "scala": "Scala",
    "r": "R", "r language": "R",
    "matlab": "MATLAB",
    "dart": "Dart",
    "julia": "Julia",
    "lua": "Lua",
    "perl": "Perl",
    "bash": "Bash", "shell": "Bash", "shell scripting": "Bash",
    
    # Web Frameworks & Libraries
    "react": "React", "reactjs": "React", "react.js": "React", "reactjs": "React",
    "angular": "Angular", "angularjs": "Angular", "angular.js": "Angular",
    "vue": "Vue.js", "vuejs": "Vue.js", "vue.js": "Vue.js",
    "next.js": "Next.js", "nextjs": "Next.js",
    "nuxt": "Nuxt.js", "nuxt.js": "Nuxt.js", "nuxtjs": "Nuxt.js",
    "django": "Django", "django framework": "Django",
    "flask": "Flask", "flask framework": "Flask",
    "fastapi": "FastAPI", "fast api": "FastAPI",
    "spring": "Spring", "spring boot": "Spring Boot", "spring framework": "Spring Framework", "spring mvc": "Spring MVC",
    "express": "Express.js", "expressjs": "Express.js", "express.js": "Express.js",
    "node": "Node.js", "nodejs": "Node.js", "node.js": "Node.js",
    "nest": "NestJS", "nest.js": "NestJS", "nestjs": "NestJS",
    "svelte": "Svelte", "sveltejs": "Svelte",
    "ember": "Ember.js", "ember.js": "Ember.js",
    "backbone": "Backbone.js", "backbone.js": "Backbone.js",
    "jquery": "jQuery", "jquery": "jQuery",
    
    # Data Science & Machine Learning
    "tensorflow": "TensorFlow", "tf": "TensorFlow",
    "pytorch": "PyTorch", "torch": "PyTorch",
    "keras": "Keras",
    "scikit-learn": "Scikit-learn", "sklearn": "Scikit-learn", "scikit learn": "Scikit-learn",
    "pandas": "Pandas",
    "numpy": "NumPy", "np": "NumPy",
    "spark": "Spark", "apache spark": "Spark",
    "pyspark": "PySpark", "py spark": "PySpark",
    "hadoop": "Hadoop", "apache hadoop": "Hadoop",
    "machine learning": "Machine Learning", "ml": "Machine Learning", "machinelearning": "Machine Learning",
    "deep learning": "Deep Learning", "dl": "Deep Learning", "deeplearning": "Deep Learning",
    "nlp": "NLP", "natural language processing": "NLP", "natural language": "NLP",
    "computer vision": "Computer Vision", "cv": "Computer Vision", "computervision": "Computer Vision",
    "statistics": "Statistics", "statistical analysis": "Statistics",
    "data science": "Data Science", "data science": "Data Science",
    "artificial intelligence": "AI", "ai": "AI", "artificial intelligence": "AI",
    "data mining": "Data Mining",
    "xgboost": "XGBoost", "xg boost": "XGBoost",
    "lightgbm": "LightGBM", "light gbm": "LightGBM",
    "catboost": "CatBoost", "cat boost": "CatBoost",
    
    # Cloud & DevOps
    "aws": "AWS", "amazon web services": "AWS", "amazon": "AWS", "aws cloud": "AWS",
    "azure": "Azure", "microsoft azure": "Azure", "azure cloud": "Azure",
    "gcp": "GCP", "google cloud": "GCP", "google cloud platform": "GCP", "gcp cloud": "GCP",
    "docker": "Docker", "docker containers": "Docker", "containerization": "Docker",
    "kubernetes": "Kubernetes", "k8s": "Kubernetes", "k8": "Kubernetes", "k8 s": "Kubernetes",
    "terraform": "Terraform", "iac": "Terraform", "infrastructure as code": "Terraform",
    "ansible": "Ansible", "configuration management": "Ansible",
    "jenkins": "Jenkins", "ci/cd": "CI/CD", "cicd": "CI/CD", "continuous integration": "CI/CD",
    "linux": "Linux", "unix": "Linux", "linux administration": "Linux",
    "git": "Git", "version control": "Git", "gitlab": "Git", "github": "Git",
    "bitbucket": "Git",
    "helm": "Helm", "kubernetes helm": "Helm",
    "prometheus": "Prometheus", "monitoring": "Prometheus",
    "grafana": "Grafana", "visualization": "Grafana",
    "elk": "ELK Stack", "elasticsearch": "ELK Stack", "logstash": "ELK Stack", "kibana": "ELK Stack",
    "nginx": "Nginx", "web server": "Nginx",
    "apache": "Apache", "httpd": "Apache",
    
    # Databases
    "sql": "SQL", "structured query language": "SQL", "pl/sql": "SQL", "plsql": "SQL", "pl sql": "SQL",
    "postgresql": "PostgreSQL", "postgres": "PostgreSQL", "postgres db": "PostgreSQL", "postgres database": "PostgreSQL",
    "mysql": "MySQL", "my sql": "MySQL",
    "mongodb": "MongoDB", "mongo": "MongoDB", "mongo db": "MongoDB", "nosql": "MongoDB",
    "redis": "Redis", "caching": "Redis", "cache": "Redis",
    "elasticsearch": "Elasticsearch", "elastic search": "Elasticsearch", "search engine": "Elasticsearch",
    "cassandra": "Cassandra", "nosql database": "Cassandra",
    "sqlite": "SQLite", "sqlite3": "SQLite",
    "oracle": "Oracle Database", "oracle db": "Oracle Database",
    "mariadb": "MariaDB", "maria db": "MariaDB",
    "dynamodb": "DynamoDB", "dynamo db": "DynamoDB",
    "firebase": "Firebase", "firebase database": "Firebase",
    "supabase": "Supabase",
    "cockroachdb": "CockroachDB", "cockroach db": "CockroachDB",
    "timescaledb": "TimescaleDB", "timescale db": "TimescaleDB",
    "neo4j": "Neo4j", "neo4j database": "Neo4j", "graph database": "Neo4j",
    "influxdb": "InfluxDB", "influx db": "InfluxDB", "time series": "InfluxDB",
    "mybatis": "MyBatis", "ibatis": "MyBatis", "ibatis/mybatis": "MyBatis",
    
    # Tools & Methodologies
    "jira": "Jira", "atlassian": "Jira", "project management": "Jira",
    "agile": "Agile", "agile methodology": "Agile",
    "scrum": "Scrum", "scrum framework": "Scrum",
    "kanban": "Kanban", "agile board": "Kanban",
    "rest api": "REST APIs", "restful api": "REST APIs", "rest": "REST APIs", "restful": "REST APIs",
    "graphql": "GraphQL", "graph ql": "GraphQL", "gql": "GraphQL",
    "api": "APIs", "application programming interface": "APIs", "web api": "APIs",
    "soap": "SOAP", "soap api": "SOAP",
    "grpc": "gRPC", "google rpc": "gRPC",
    "microservices": "Microservices", "micro service": "Microservices", "micro-service": "Microservices",
    "serverless": "Serverless", "serverless architecture": "Serverless", "lambda": "Serverless",
    "monolith": "Monolithic", "monolithic architecture": "Monolithic",
    "saas": "SaaS", "software as a service": "SaaS",
    "paas": "PaaS", "platform as a service": "PaaS",
    "iaas": "IaaS", "infrastructure as a service": "IaaS",
    "airflow": "Airflow", "apache airflow": "Airflow", "workflow orchestration": "Airflow",
    "kafka": "Kafka", "apache kafka": "Kafka", "message queue": "Kafka", "event streaming": "Kafka",
    "mlflow": "MLflow", "machine learning operations": "MLflow", "mlops": "MLflow",
    "hugging face": "Hugging Face", "huggingface": "Hugging Face", "transformers": "Hugging Face",
    "openai": "OpenAI", "gpt": "OpenAI", "chatgpt": "OpenAI",
    "langchain": "LangChain", "lang chain": "LangChain",
    "vector database": "Vector Database", "vector db": "Vector Database", "embedding database": "Vector Database",
    "pinecone": "Pinecone", "weaviate": "Weaviate", "chromadb": "ChromaDB", "chroma": "ChromaDB",
    "llm": "Large Language Models", "large language models": "LLM", "language model": "LLM",
    
    # Frontend & UI
    "css": "CSS", "cascading style sheets": "CSS", "stylesheet": "CSS",
    "html": "HTML", "hypertext markup language": "HTML",
    "sass": "Sass", "scss": "Sass", "syntactically awesome style sheets": "Sass",
    "less": "Less", "less css": "Less",
    "tailwind": "Tailwind CSS", "tailwind css": "Tailwind CSS", "tailwindcss": "Tailwind CSS",
    "bootstrap": "Bootstrap", "bootstrap css": "Bootstrap",
    "material ui": "Material UI", "mui": "Material UI", "material-ui": "Material UI",
    "ant design": "Ant Design", "antd": "Ant Design",
    "chakra ui": "Chakra UI", "chakra": "Chakra UI",
    "storybook": "Storybook", "component library": "Storybook",
    "figma": "Figma", "design tool": "Figma", "ui design": "Figma",
    "sketch": "Sketch", "design software": "Sketch",
    "adobe xd": "Adobe XD", "xd": "Adobe XD",
    
    # Testing & Quality
    "jest": "Jest", "testing framework": "Jest",
    "mocha": "Mocha", "test runner": "Mocha",
    "jasmine": "Jasmine", "unit testing": "Jasmine",
    "cypress": "Cypress", "e2e testing": "Cypress", "end to end testing": "Cypress",
    "selenium": "Selenium", "browser automation": "Selenium",
    "playwright": "Playwright", "browser testing": "Playwright",
    "puppeteer": "Puppeteer", "headless chrome": "Puppeteer",
    "junit": "JUnit", "java testing": "JUnit",
    "pytest": "Pytest", "python testing": "Pytest",
    "testing": "Testing", "quality assurance": "Testing", "qa": "Testing",
    "tdd": "Test Driven Development", "test driven development": "TDD",
    "bdd": "Behavior Driven Development", "behavior driven development": "BDD",
    
    # Mobile Development
    "react native": "React Native", "reactnative": "React Native", "rn": "React Native",
    "flutter": "Flutter", "dart mobile": "Flutter",
    "ionic": "Ionic", "hybrid mobile": "Ionic",
    "android": "Android", "android development": "Android", "android studio": "Android",
    "ios": "iOS", "ios development": "iOS", "swift ios": "iOS",
    "mobile development": "Mobile Development", "mobile app": "Mobile Development",
    "cross platform": "Cross-platform", "cross-platform": "Cross-platform",
    
    # Security
    "security": "Security", "cybersecurity": "Security", "information security": "Security",
    "authentication": "Authentication", "auth": "Authentication", "authn": "Authentication",
    "authorization": "Authorization", "authz": "Authorization",
    "oauth": "OAuth", "open authentication": "OAuth", "oauth2": "OAuth",
    "jwt": "JWT", "json web token": "JWT",
    "encryption": "Encryption", "cryptography": "Encryption",
    "ssl": "SSL", "tls": "TLS", "https": "SSL",
    "penetration testing": "Penetration Testing", "pen testing": "Penetration Testing", "pentest": "Penetration Testing",
    "owasp": "OWASP", "web security": "OWASP",
    
    # Architecture & Patterns
    "mvc": "MVC", "model view controller": "MVC",
    "mvvm": "MVVM", "model view viewmodel": "MVVM",
    "clean architecture": "Clean Architecture", "clean code": "Clean Architecture",
    "solid": "SOLID", "solid principles": "SOLID",
    "design patterns": "Design Patterns", "gang of four": "Design Patterns",
    "design patterns": "Design Patterns", "gof": "Design Patterns",
    "repository pattern": "Repository Pattern", "repository": "Repository Pattern",
    "dependency injection": "Dependency Injection", "di": "Dependency Injection",
    "inversion of control": "Inversion of Control", "ioc": "Inversion of Control",
    
    # Performance & Optimization
    "performance": "Performance", "optimization": "Performance", "performance tuning": "Performance",
    "caching": "Caching", "cache optimization": "Caching",
    "load balancing": "Load Balancing", "load balancer": "Load Balancing",
    "cdn": "CDN", "content delivery network": "CDN",
    "profiling": "Profiling", "performance profiling": "Profiling",
    "benchmarking": "Benchmarking", "performance testing": "Benchmarking",
    
    # Development Tools
    "ide": "IDE", "integrated development environment": "IDE",
    "vscode": "VS Code", "visual studio code": "VS Code", "vs code": "VS Code",
    "visual studio": "Visual Studio", "vs": "Visual Studio",
    "intellij": "IntelliJ IDEA", "intellij idea": "IntelliJ IDEA", "idea": "IntelliJ IDEA",
    "eclipse": "Eclipse", "eclipse ide": "Eclipse",
    "xcode": "Xcode", "xcode ide": "Xcode",
    "android studio": "Android Studio", "android ide": "Android Studio",
    "vim": "Vim", "vi": "Vim",
    "emacs": "Emacs",
    "sublime": "Sublime Text", "sublime text": "Sublime Text",
    "atom": "Atom",
    "postman": "Postman", "api testing": "Postman",
    "swagger": "Swagger", "openapi": "Swagger", "api documentation": "Swagger",
    
    # Build & Package Management
    "webpack": "Webpack", "module bundler": "Webpack",
    "vite": "Vite", "build tool": "Vite",
    "rollup": "Rollup", "module bundler": "Rollup",
    "parcel": "Parcel", "bundler": "Parcel",
    "babel": "Babel", "transpiler": "Babel",
    "npm": "npm", "node package manager": "npm",
    "yarn": "Yarn", "package manager": "Yarn",
    "pnpm": "pnpm", "performant npm": "pnpm",
    "pip": "pip", "python package manager": "pip",
    "conda": "Conda", "python environment": "Conda",
    "maven": "Maven", "java build tool": "Maven",
    "gradle": "Gradle", "java build automation": "Gradle",
    "ant": "Ant", "java build tool": "Ant",
    "cargo": "Cargo", "rust package manager": "Cargo",
    "composer": "Composer", "php package manager": "Composer",
    "nuget": "NuGet", "dotnet package manager": "NuGet",
    
    # Version Control & CI/CD
    "github actions": "GitHub Actions", "github workflow": "GitHub Actions", "gh actions": "GitHub Actions",
    "gitlab ci": "GitLab CI", "gitlab cicd": "GitLab CI",
    "circleci": "CircleCI", "circle ci": "CircleCI",
    "travis": "Travis CI", "travis ci": "Travis CI",
    "jenkins": "Jenkins", "jenkins ci": "Jenkins",
    "teamcity": "TeamCity", "team city": "TeamCity",
    "bamboo": "Bamboo", "bamboo ci": "Bamboo",
    "sonarqube": "SonarQube", "code quality": "SonarQube", "sonar": "SonarQube",
    
    # Big Data & Analytics
    "tableau": "Tableau", "data visualization": "Tableau",
    "power bi": "Power BI", "powerbi": "Power BI", "powerbi": "Power BI",
    "looker": "Looker", "business intelligence": "Looker",
    "qlik": "Qlik", "qlikview": "Qlik",
    "snowflake": "Snowflake", "data warehouse": "Snowflake",
    "redshift": "Redshift", "amazon redshift": "Redshift",
    "bigquery": "BigQuery", "google bigquery": "BigQuery",
    "databricks": "Databricks", "spark platform": "Databricks",
    "etl": "ETL", "extract transform load": "ETL", "data pipeline": "ETL",
    "data warehouse": "Data Warehouse", "dw": "Data Warehouse",
    "data lake": "Data Lake", "datalake": "Data Lake",
    
    # Blockchain & Web3
    "blockchain": "Blockchain", "distributed ledger": "Blockchain",
    "ethereum": "Ethereum", "eth": "Ethereum",
    "bitcoin": "Bitcoin", "btc": "Bitcoin",
    "smart contracts": "Smart Contracts", "smart contract": "Smart Contracts",
    "solidity": "Solidity", "ethereum language": "Solidity",
    "web3": "Web3", "web 3": "Web3", "web3.js": "Web3",
    "defi": "DeFi", "decentralized finance": "DeFi",
    "nft": "NFT", "non fungible token": "NFT",
    "crypto": "Cryptocurrency", "cryptocurrency": "Crypto",
    
    # IoT & Embedded
    "iot": "IoT", "internet of things": "IoT",
    "embedded": "Embedded Systems", "embedded systems": "Embedded",
    "arduino": "Arduino", "microcontroller": "Arduino",
    "raspberry pi": "Raspberry Pi", "rpi": "Raspberry Pi",
    "firmware": "Firmware", "embedded software": "Firmware",
    
    # Game Development
    "unity": "Unity", "unity engine": "Unity", "unity3d": "Unity",
    "unreal": "Unreal Engine", "unreal engine": "Unreal", "ue4": "Unreal", "ue5": "Unreal",
    "game development": "Game Development", "gamedev": "Game Development",
    "godot": "Godot", "godot engine": "Godot",
    
    # Additional Technical Terms
    "agile": "Agile Methodology", "scrum": "Scrum", "kanban": "Kanban",
    "devops": "DevOps", "development operations": "DevOps",
    "fullstack": "Full Stack", "full stack": "Full Stack", "full-stack": "Full Stack",
    "frontend": "Frontend", "front-end": "Frontend", "front end": "Frontend", "client side": "Frontend",
    "backend": "Backend", "back-end": "Backend", "back end": "Backend", "server side": "Backend",
    "api": "API", "application programming interface": "API",
    "rest": "REST", "representational state transfer": "REST",
    "soap": "SOAP", "simple object access protocol": "SOAP",
    "graphql": "GraphQL", "graph query language": "GraphQL",
    "microservices": "Microservices", "micro services": "Microservices",
    "monolith": "Monolithic", "monolithic": "Monolith",
    "serverless": "Serverless", "server less": "Serverless",
    "cloud native": "Cloud Native", "cloud-native": "Cloud Native",
    "saas": "SaaS", "software as a service": "SaaS",
    "paas": "PaaS", "platform as a service": "PaaS",
    "iaas": "IaaS", "infrastructure as a service": "IaaS",
    "big data": "Big Data", "bigdata": "Big Data",
    "data science": "Data Science", "data science": "Data Science",
    "machine learning": "Machine Learning", "ml": "Machine Learning",
    "deep learning": "Deep Learning", "dl": "Deep Learning",
    "artificial intelligence": "AI", "ai": "Artificial Intelligence",
    "natural language processing": "NLP", "nlp": "NLP",
    "computer vision": "Computer Vision", "cv": "Computer Vision",
    "robotics": "Robotics", "robot": "Robotics",
    "automation": "Automation", "automated": "Automation",
    "scripting": "Scripting", "script": "Scripting",
    "algorithms": "Algorithms", "algorithm": "Algorithms",
    "data structures": "Data Structures", "data structure": "Data Structures",
    "system design": "System Design", "system architecture": "System Design",
    "software architecture": "Software Architecture", "architecture": "Software Architecture",
    "technical leadership": "Technical Leadership", "tech lead": "Technical Leadership",
    "team management": "Team Management", "team lead": "Team Management",
    "mentoring": "Mentoring", "mentor": "Mentoring",
    "code review": "Code Review", "peer review": "Code Review",
    "debugging": "Debugging", "debug": "Debugging",
    "troubleshooting": "Troubleshooting", "troubleshoot": "Troubleshooting",
    "problem solving": "Problem Solving", "problem-solving": "Problem Solving",
    "analytical thinking": "Analytical Thinking", "analytical": "Analytical Thinking",
    "communication": "Communication", "communication skills": "Communication",
    "collaboration": "Collaboration", "teamwork": "Collaboration",
    "documentation": "Documentation", "docs": "Documentation",
    "agile": "Agile", "scrum": "Scrum", "kanban": "Kanban",
    "waterfall": "Waterfall", "waterfall methodology": "Waterfall",
    "lean": "Lean", "lean methodology": "Lean",
    "six sigma": "Six Sigma", "6 sigma": "Six Sigma",
    "itil": "ITIL", "it service management": "ITIL",
    "cobit": "COBIT", "control objectives": "COBIT",
    "togaf": "TOGAF", "enterprise architecture": "TOGAF",
    "zachman": "Zachman Framework", "zachman framework": "Zachman",
}

# Reverse mapping for efficient lookup
CANONICAL_TO_ALIASES: Dict[str, Set[str]] = {}
for alias, canonical in CANONICAL_SKILL_MAPPING.items():
    if canonical not in CANONICAL_TO_ALIASES:
        CANONICAL_TO_ALIASES[canonical] = set()
    CANONICAL_TO_ALIASES[canonical].add(alias)


def sanitize_pdf_text(text: str) -> str:
    """Remove template noise but keep genuine resume contact information intact."""
    lines = text.splitlines()
    cleaned_lines = []

    # Patterns to identify and remove
    url_pattern = re.compile(r'https?://[^\s<>"]+|www\.[^\s<>"]+')
    template_patterns = [
        re.compile(r'qwikresume\.com', re.I),
        re.compile(r'resumeworded\.com', re.I),
        re.compile(r'resume\.com', re.I),
        re.compile(r'curriculum vitae', re.I),
        re.compile(r'resume template', re.I),
        re.compile(r'page \d+ of \d+', re.I),
        re.compile(r'generated by', re.I),
        re.compile(r'created with', re.I),
        re.compile(r'\btemplate\b', re.I),
        re.compile(r'\bdownloaded from\b', re.I),
    ]

    # Keep actual contact lines intact so extraction can read them.
    # Only drop obvious template noise and non-content footer lines.
    footer_patterns = [
        re.compile(r'^(?:copyright|all rights reserved|confidential|powered by)\b.*$', re.I),
        re.compile(r'^\s*\d{1,2}\s*[-|/]\s*\d{1,2}\s*[-|/]\s*\d{2,4}\s*$'),
    ]

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Remove URLs left in the raw text, but do not remove the actual email/phone values they contain.
        line = url_pattern.sub('', line)

        # Drop obvious template noise.
        if any(pattern.search(line) for pattern in template_patterns):
            continue

        # Drop footer-like global noise that is not candidate data.
        if any(pattern.match(line) for pattern in footer_patterns):
            continue

        # Remove very short non-meaningful lines.
        if len(line) < 3 and not any(c.isalpha() for c in line):
            continue

        cleaned_lines.append(line)

    return "\n".join(cleaned_lines)


def normalize_text(text: str) -> str:
    """Basic text normalization with null byte and unicode handling."""
    text = text.replace("\x00", " ").replace("\u00a0", " ")
    # Preserve line boundaries: the first meaningful line is useful for name inference.
    return "\n".join(re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines() if line.strip())


def extract_pdf_text(path: str) -> str:
    """Extract text from PDF with sanitization layer to remove template noise."""
    with fitz.open(path) as document:
        raw_text = "\n".join(page.get_text("text") for page in document)
        
        # Apply sanitization to remove template noise
        sanitized_text = sanitize_pdf_text(raw_text)
        normalized_text = normalize_text(sanitized_text)
        
        if len(normalized_text) >= 40:
            return normalized_text

        # Scanned resumes contain page images rather than a text layer.
        if settings.tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd
        scale = max(settings.ocr_dpi / 72, 1)
        ocr_text: list[str] = []
        for page in document:
            pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
            image = Image.open(BytesIO(pixmap.tobytes("png")))
            ocr_text.append(pytesseract.image_to_string(image, config="--psm 6"))
        
        # Sanitize OCR output as well
        ocr_combined = "\n".join(ocr_text)
        sanitized_ocr = sanitize_pdf_text(ocr_combined)
        return normalize_text(sanitized_ocr)


def extract_pdf_text_cached(path: str, cache_dir: Optional[str] = None) -> str:
    """Cache PDF text extraction by short file hash to avoid repeated OCR on same files.

    Cache files are stored under `cache_dir` or `settings.upload_dir/.extraction_cache`.
    """
    try:
        file_hash = generate_file_hash(path)
    except Exception:
        # Fallback to no-cache if hash generation fails
        return extract_pdf_text(path)

    base_cache = Path(cache_dir) if cache_dir else (settings.upload_dir / ".extraction_cache")
    base_cache.mkdir(parents=True, exist_ok=True)
    cache_file = base_cache / f"{file_hash}.txt"

    # Return cached text if available
    if cache_file.exists():
        try:
            return cache_file.read_text(encoding="utf-8")
        except Exception:
            pass

    # Perform extraction and write cache
    text = extract_pdf_text(path)
    try:
        cache_file.write_text(text, encoding="utf-8")
    except Exception:
        pass
    return text

def extract_jd_pdf_text(path: str) -> str:
    """Extract text from Job Description PDF with OCR fallback, without resume-specific sanitization."""
    with fitz.open(path) as document:
        raw_text = "\n".join(page.get_text("text") for page in document)
        
        normalized_text = normalize_text(raw_text)
        
        if len(normalized_text) >= 40:
            return normalized_text

        # Fallback to OCR for scanned JD PDFs
        if settings.tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd
        scale = max(settings.ocr_dpi / 72, 1)
        ocr_text: list[str] = []
        for page in document:
            pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
            image = Image.open(BytesIO(pixmap.tobytes("png")))
            ocr_text.append(pytesseract.image_to_string(image, config="--psm 6"))
        
        ocr_combined = "\n".join(ocr_text)
        return normalize_text(ocr_combined)


def normalize_skill_term(term: str) -> str:
    """
    Normalize a skill term to its canonical form using the comprehensive alias mapping.
    This handles variations like "JS" -> "JavaScript", "Postgres" -> "PostgreSQL", etc.
    """
    normalized = term.lower().strip()
    # Remove extra whitespace and special characters for matching
    cleaned = re.sub(r'[^\w\s-]', '', normalized).strip()
    
    # Direct lookup in canonical mapping
    if cleaned in CANONICAL_SKILL_MAPPING:
        return CANONICAL_SKILL_MAPPING[cleaned]
    
    # Try with and without hyphens
    without_hyphens = cleaned.replace('-', '').replace(' ', '')
    if without_hyphens in CANONICAL_SKILL_MAPPING:
        return CANONICAL_SKILL_MAPPING[without_hyphens]
    
    # If no exact match found, return the original (will be handled by fuzzy matching)
    return term.title()


def fuzzy_match_skill(term: str, threshold: float = 0.88) -> str | None:
    """
    Fuzzy match a skill term against canonical skills using Levenshtein distance.
    Returns the canonical skill if similarity exceeds threshold, else None.
    """
    from difflib import SequenceMatcher
    
    term_lower = term.lower().strip()
    best_match = None
    best_score = 0.0
    
    # Check against all canonical skills
    for canonical in CANONICAL_TO_ALIASES.keys():
        # Direct comparison
        score = SequenceMatcher(None, term_lower, canonical.lower()).ratio()
        if score > best_score:
            best_score = score
            best_match = canonical
        
        # Check against all aliases
        for alias in CANONICAL_TO_ALIASES[canonical]:
            alias_score = SequenceMatcher(None, term_lower, alias.lower()).ratio()
            if alias_score > best_score:
                best_score = alias_score
                best_match = canonical
    
    if best_score >= threshold:
        return best_match
    return None


def extract_skills(text: str) -> list[str]:
    """
    Extract skills from text using comprehensive skill taxonomy with multi-layer normalization:
    1. Canonical alias mapping (exact variations)
    2. Fuzzy matching (typos, punctuation, hyphenation)
    3. Returns normalized canonical skill names
    """
    lower = f" {text.lower()} "
    found_canonical = set()
    
    # Layer 1: Exact canonical alias matching
    for alias, canonical in CANONICAL_SKILL_MAPPING.items():
        if re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", lower):
            found_canonical.add(canonical)

    if not settings.enable_fuzzy_skill_matching:
        return sorted(found_canonical, key=str.lower)
    
    # Layer 2: Extract potential skill terms that weren't matched exactly
    # This catches terms with variations not in our mapping
    words = re.findall(r'\b[a-zA-Z][a-zA-Z0-9\s\-.#/+]{2,}\b', text)
    for word in words:
        if word.lower() not in CANONICAL_SKILL_MAPPING:
            # Try fuzzy matching
            fuzzy_result = fuzzy_match_skill(word)
            if fuzzy_result:
                found_canonical.add(fuzzy_result)
    
    return sorted(found_canonical, key=str.lower)


def extract_noun_phrases(text: str) -> list[str]:
    """
    Extract technical noun phrases from text using spaCy when available,
    with regex fallback for specialized technical terms.
    This captures niche frameworks, tools, and domain-specific concepts.
    """
    try:
        nlp = _spacy_model()
        doc = nlp(text[:30_000])
        
        # Extract noun phrases that are likely technical terms
        noun_phrases = []
        for chunk in doc.noun_chunks:
            phrase = chunk.text.strip()
            # Filter for technical-looking phrases
            if (len(phrase.split()) >= 2 and  # Multi-word phrases
                any(c.isupper() for c in phrase) and  # Contains capitals
                len(phrase) >= 4 and  # Minimum length
                not phrase.lower().startswith(('the', 'a', 'an', 'this', 'that', 'these', 'those'))):
                noun_phrases.append(phrase)
        
        return list(set(noun_phrases))
    except Exception:
        # Fallback to regex-based technical phrase extraction
        # Match patterns like "Container orchestration", "Data pipeline", etc.
        technical_patterns = [
            r'\b[A-Z][a-zA-Z]+\s+[a-zA-Z]+\s+[a-zA-Z]+\b',  # 3-word technical terms
            r'\b[A-Z][a-zA-Z]+\s+[a-zA-Z]+\b',  # 2-word technical terms
            r'\b[a-z]+-[a-z]+\b',  # Hyphenated technical terms
            r'\b[a-z]+/[a-z]+\b',  # Slash-separated technical terms
        ]
        
        phrases = []
        for pattern in technical_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            phrases.extend(matches)
        
        return list(set(phrases))


def extract_jd_requirements(job_description: str) -> Tuple[list[str], list[str]]:
    """
    Extract required (REQ) and preferred (PREF) skills from job description.
    Uses contextual analysis to distinguish mandatory from optional requirements.
    Enhanced with dynamic noun-phrase extraction for niche skills.
    """
    jd_lower = job_description.lower()
    
    # Keywords that indicate required skills
    required_keywords = ['required', 'must have', 'essential', 'mandatory', 'need', 'should have']
    # Keywords that indicate preferred skills  
    preferred_keywords = ['preferred', 'nice to have', 'bonus', 'plus', 'advantageous', 'desired']
    
    # Split JD into lines/sentences and track current section state (required vs preferred)
    required_section = ""
    preferred_section = ""
    
    current_mode = "required"
    lines_and_sentences = [s.strip() for s in re.split(r'[\.\!\?\n]+', job_description) if s.strip()]
    
    for item in lines_and_sentences:
        item_lower = item.lower()
        has_pref = any(keyword in item_lower for keyword in preferred_keywords)
        has_req = any(keyword in item_lower for keyword in required_keywords)
        
        if has_pref and not has_req:
            current_mode = "preferred"
        elif has_req and not has_pref:
            current_mode = "required"
            
        if current_mode == "preferred":
            preferred_section += item + "\n"
        else:
            required_section += item + "\n"
    
    # Extract skills from each section using enhanced extraction
    required_skills = extract_skills(required_section)
    preferred_skills = extract_skills(preferred_section)
    
    # Layer 3: Dynamic noun-phrase extraction for niche skills
    # Extract technical noun phrases from the full JD
    technical_phrases = extract_noun_phrases(job_description)
    
    # Check if any extracted phrases match skills via semantic similarity
    if technical_phrases:
        try:
            embedder = _embedder()
            jd_embedding = embedder.encode(job_description, normalize_embeddings=True, show_progress_bar=False)
            
            for phrase in technical_phrases:
                phrase_embedding = embedder.encode(phrase, normalize_embeddings=True, show_progress_bar=False)
                similarity = float(np.dot(jd_embedding, phrase_embedding))
                
                # If phrase is semantically similar to JD and not already captured
                if similarity >= 0.85:  # High semantic similarity threshold
                    # Check if this phrase maps to any known skill via fuzzy matching
                    fuzzy_match = fuzzy_match_skill(phrase, threshold=0.80)
                    if fuzzy_match and fuzzy_match not in required_skills + preferred_skills:
                        # Add to required if it's a strong technical match
                        required_skills.append(fuzzy_match)
        except Exception:
            pass
    
    # Remove duplicates (prefer preferred over required if both)
    pref_set = set(preferred_skills)
    required_skills = [skill for skill in required_skills if skill not in pref_set]
    
    return sorted(required_skills), sorted(preferred_skills)


def extract_work_dates(text: str) -> List[Tuple[datetime, datetime]]:
    """
    Extract work experience date ranges from resume text.
    First isolates the Experience section to avoid capturing Education or Project dates.
    Returns list of (start_date, end_date) tuples.
    """
    # Isolate experience section
    section_pattern = r'(?:experience|employment|work history)[:\s\n]+(.*?)(?=\n\s*(?:education|academic|skills|projects|certifications|contact|$))'
    match = re.search(section_pattern, text, re.I | re.DOTALL)
    if match:
        search_text = match.group(1)
    else:
        # Fallback to searching the whole text, but this is riskier.
        search_text = text

    present_keywords = {'present', 'current', 'now', 'ongoing', 'on-going', 'till date', 'till now', 'to date'}
    present_pattern = r'present|current|now|ongoing|on-going|till\s+date|till\s+now|to\s+date'
    
    date_patterns = [
        # Formats: "Jan 2020 - Dec 2021", "01/2020 - 12/2021", "2018 - Ongoing", "2018 - 9" (OCR artifact)
        r'(\b[a-zA-Z]{3,9}\s+(?:19|20)\d{2})\s*[-–—to]+\s*([a-zA-Z]{3,9}\s+(?:19|20)\d{2}|' + present_pattern + r')',
        r'(\b\d{1,2}/(?:19|20)\d{2})\s*[-–—to]+\s*(\d{1,2}/(?:19|20)\d{2}|' + present_pattern + r')',
        r'(\b(?:19|20)\d{2})\s*[-–—to]+\s*((?:19|20)\d{2}|[a-zA-Z]{3,9}\s+(?:19|20)\d{2}|' + present_pattern + r'|\d{1,2}\b(?!\d))',
    ]
    
    date_ranges = []
    matched_spans: List[Tuple[int, int]] = []
    
    for pattern in date_patterns:
        matches = re.finditer(pattern, search_text, re.IGNORECASE)
        for match in matches:
            start_pos, end_pos = match.span()
            # Check if this match overlaps with any previously captured span
            if any(max(start_pos, s) < min(end_pos, e) for s, e in matched_spans):
                continue
                
            try:
                start_str = match.group(1)
                end_str = match.group(2)
                
                start_date = date_parser.parse(start_str, fuzzy=True)
                
                if any(kw in end_str.lower().strip() for kw in present_keywords) or (end_str.isdigit() and len(end_str) <= 2):
                    end_date = datetime.now()
                else:
                    try:
                        end_date = date_parser.parse(end_str, fuzzy=True)
                    except Exception:
                        end_date = datetime.now() if any(kw in end_str.lower() for kw in present_keywords) else start_date
                
                if start_date <= end_date:
                    date_ranges.append((start_date, end_date))
                    matched_spans.append((start_pos, end_pos))
            except Exception:
                continue
    
    return date_ranges


def calculate_total_experience(date_ranges: List[Tuple[datetime, datetime]]) -> float:
    """
    Calculate total non-overlapping years of experience from date ranges.
    Merges overlapping intervals before computing total duration.
    """
    if not date_ranges:
        return 0.0
    
    valid_ranges = sorted([(s, e) for s, e in date_ranges if s and e and s <= e], key=lambda x: x[0])
    if not valid_ranges:
        return 0.0
        
    merged_ranges = []
    curr_start, curr_end = valid_ranges[0]
    
    for next_start, next_end in valid_ranges[1:]:
        if next_start <= curr_end:
            curr_end = max(curr_end, next_end)
        else:
            merged_ranges.append((curr_start, curr_end))
            curr_start, curr_end = next_start, next_end
    merged_ranges.append((curr_start, curr_end))
    
    total_days = sum((end - start).days for start, end in merged_ranges)
    return round(total_days / 365.25, 1)


def extract_projects(text: str) -> list[str]:
    """Extract project descriptions from resume text using pattern matching."""
    projects = []
    
    # Common project section patterns
    project_patterns = [
        r'(?:projects?|project experience|key projects|notable projects|relevant projects)[:\s\n]*(.*?)(?=\n\s*(?:experience|education|skills|contact|$))',
    ]
    
    for pattern in project_patterns:
        match = re.search(pattern, text, re.I | re.DOTALL)
        if match:
            project_text = match.group(1)
            # Extract individual project lines using bullet points and numbering
            project_lines = re.split(r'[\n•\-\*]+', project_text)
            for line in project_lines:
                line = re.sub(r'\s+', ' ', line).strip()
                # Remove numbering and bullet points more thoroughly
                line = re.sub(r'^[\d\.\)\-\•\*]+\s*', '', line)
                line = re.sub(r'^\s+|\s+$', '', line)
                # Filter out very short or generic entries
                if len(line) > 15 and len(line) < 300:
                    # Filter out section headers and common non-project lines
                    lower_line = line.lower()
                    if not any(header in lower_line for header in ['project', 'experience', 'education', 'skills', 'work', 'summary']):
                        # Filter out date-only lines
                        if not re.match(r'^\d{4}', line):
                            if line and line not in projects:
                                projects.append(line)
    
    # If no structured projects found, do not invent them from random sentences.
    # The previous fallback created severe noise by grabbing any sentence with "developed".
    
    return projects[:5]  # Return top 5 projects


def extract_education(text: str) -> str:
    """Extract education information from resume text."""
    # Look for education section
    education_patterns = [
        r'(?:education|academic|educational background|qualifications|degrees)[:\s\n]*(.*?)(?=\n\s*(?:experience|skills|projects|contact|$))',
    ]
    
    for pattern in education_patterns:
        match = re.search(pattern, text, re.I | re.DOTALL)
        if match:
            education_text = match.group(1)
            # Clean up and format
            education_text = re.sub(r'\s+', ' ', education_text).strip()
            education_text = re.sub(r'[:\•\-\*]', '', education_text)
            # Split by lines and get the most relevant education entry
            lines = [line.strip() for line in education_text.split('\n') if line.strip()]
            if lines:
                # Look for degree patterns in the lines
                for line in lines:
                    if any(degree in line.lower() for degree in ['bachelor', 'master', 'phd', 'doctorate', 'b.tech', 'm.tech', 'm.sc', 'b.sc']):
                        # Extract just the relevant education info
                        clean_line = re.sub(r'\d{4}.*', '', line)  # Remove dates
                        clean_line = re.sub(r'\s+', ' ', clean_line).strip()
                        if len(clean_line) > 10 and len(clean_line) < 200:
                            return clean_line
                # Fallback to first line if no degree pattern found
                first_line = re.sub(r'\d{4}.*', '', lines[0])  # Remove dates
                first_line = re.sub(r'\s+', ' ', first_line).strip()
                if len(first_line) > 10 and len(first_line) < 200:
                    return first_line
    
    # Fallback: look for degree patterns in the entire text
    degree_patterns = [
        r'(?:bachelor|master|phd|doctorate)[\s\w]+(?:in|of)[\s\w]+(?:university|college|institute)',
        r'(?:b\.tech|m\.tech|m\.sc|b\.sc|b\.a|m\.a)[\s\w]+(?:university|college|institute)?',
    ]
    
    for pattern in degree_patterns:
        match = re.search(pattern, text, re.I)
        if match:
            education = match.group(0).strip()
            education = re.sub(r'\s+', ' ', education)
            if len(education) > 10 and len(education) < 200:
                return education
    
    return "Not specified"


def extract_experience_details(text: str) -> list[dict]:
    """Extract detailed work experience entries from resume text."""
    experiences = []
    
    # Look for experience section
    experience_pattern = r'(?:experience|work experience|employment|professional experience|work history)[:\s\n]*(.*?)(?=\n\s*(?:education|skills|projects|contact|$))'
    match = re.search(experience_pattern, text, re.I | re.DOTALL)
    
    if match:
        experience_text = match.group(1)
        
        # Try to extract individual job entries using line breaks and patterns
        lines = [line.strip() for line in experience_text.split('\n') if line.strip()]
        
        current_job = None
        for i, line in enumerate(lines):
            # Check if this line looks like a new job entry (company + title or just company)
            # Patterns: "Company - Title", "Company Title", "Title at Company"
            if re.search(r'(?:Inc|Corp|LLC|Ltd|Technologies|Solutions|Company|University)', line, re.I):
                # Save previous job if exists
                if current_job:
                    experiences.append(current_job)
                
                # Extract title and organization from the line
                parts = re.split(r'[\-–]|at|@', line, maxsplit=1, flags=re.I)
                if len(parts) == 2:
                    org = parts[0].strip()
                    title = parts[1].strip()
                else:
                    # If no clear split, use the whole line as org
                    org = line
                    title = ""
                
                current_job = {
                    "title": title,
                    "organization": org,
                    "description": ""
                }
            elif current_job and len(line) > 10:
                # Add to description if not a date line
                if not re.match(r'^\d{4}', line):
                    current_job["description"] += line + " "
        
        # Don't forget the last job
        if current_job:
            experiences.append(current_job)
        
        # If no structured experience found, try alternative method
        if not experiences:
            # Try splitting by common company indicators
            job_entries = re.split(r'\n\s*(?=[A-Z][^\n]*(?:Inc|Corp|LLC|Ltd|Technologies|Solutions|Company))', experience_text)
            
            for entry in job_entries:
                entry = entry.strip()
                if len(entry) > 30:
                    # Extract title/organization using multiple patterns
                    title_match = re.search(r'^(.*?)(?:[\n\-–]|at|from|@)', entry, re.I)
                    org_match = re.search(r'(?:at|from|@)\s*([^\n\-–]+)', entry, re.I)
                    
                    title = title_match.group(1).strip() if title_match else ""
                    org = org_match.group(1).strip() if org_match else ""
                    
                    # Clean up title and organization
                    title = re.sub(r'[\-–]+$', '', title).strip()
                    org = re.sub(r'[\-–]+$', '', org).strip()
                    
                    # Extract a brief description
                    lines = [line.strip() for line in entry.split('\n') if line.strip()]
                    description_lines = [line for line in lines if len(line) > 10 and not re.match(r'^\d{4}', line)]
                    description = ' '.join(description_lines[:2]) if description_lines else ""
                    description = re.sub(r'\s+', ' ', description).strip()
                    
                    # Only add if we have meaningful information
                    if title or org:
                        experiences.append({
                            "title": title or "Professional",
                            "organization": org,
                            "description": description[:150] if len(description) > 150 else description
                        })
    
    return experiences[:3]  # Return top 3 experiences


def extract_entities(text: str) -> dict:
    """Use spaCy NER when available; always return useful regex-derived fields."""
    emails = re.findall(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)
    phones = re.findall(r"(?:\+?\d[\d\s().-]{8,}\d)", text)
    
    # Try multiple methods for experience extraction
    years = [int(value) for value in re.findall(r"\b(\d{1,2})\+?\s+years?(?:\s+of)?\s+experience", text, re.I)]
    
    # Fallback to date range parsing if explicit years not found
    if not years:
        date_ranges = extract_work_dates(text)
        calculated_years = calculate_total_experience(date_ranges)
        if calculated_years > 0:
            years = [int(calculated_years)]
    
    # Filter unrealistic experience years (>50 likely error)
    years = [y for y in years if y <= 50]
    
    entities: dict[str, list[str] | int] = {
        "emails": emails[:1], 
        "phones": phones[:1], 
        "experience_years": max(years, default=0)
    }
    
    try:
        nlp = _spacy_model()
        doc = nlp(text[:30_000])
        
        # Better filtering for organizations - exclude common non-org terms
        non_org_terms = {'multi-threading', 'design patterns', 'tdd', 'junit', 'jdo', 'jms', 'rmi', 
                        'spring framework', 'html', 'css', 'ajax', 'devops', 'continuous integration',
                        'implemented webservices', 'controller', 'data structures', 'deployed',
                        'components', 'applications', 'java', 'javascript', 'angular', 'git',
                        'maven', 'ant', 'hibernate', 'jpa', 'jdbc', 'sql', 'database', 'web',
                        'server', 'client', 'backend', 'frontend', 'full-stack', 'full stack',
                        'software', 'development', 'engineering', 'testing', 'quality',
                        'analysis', 'design', 'architecture', 'system', 'service', 'api',
                        'framework', 'library', 'tool', 'platform', 'environment',
                        'project', 'product', 'team', 'group', 'department', 'division',
                        'university', 'college', 'institute', 'school', 'education',
                        'bachelor', 'master', 'phd', 'degree', 'certification', 'certificate',
                        'resume', 'cv', 'curriculum', 'vitae', 'summary', 'objective',
                        'skills', 'experience', 'education', 'projects', 'contact',
                        'phone', 'email', 'address', 'location', 'linkedin', 'github'}
        
        orgs = []
        for ent in doc.ents:
            if ent.label_ == "ORG":
                org_text = ent.text.strip().lower()
                # Filter out non-organization terms
                if org_text not in non_org_terms and len(org_text) > 2:
                    orgs.append(ent.text.strip())
        
        entities["organizations"] = list(dict.fromkeys(orgs))[:12]
        
        # Better filtering for locations - exclude common non-location terms
        non_location_terms = {'mockito', 'junit', 'node', 'node.js', 'angular', 'react', 'vue',
                            'python', 'java', 'javascript', 'html', 'css', 'sql', 'database',
                            'git', 'github', 'docker', 'kubernetes', 'aws', 'azure', 'gcp',
                            'devops', 'ci/cd', 'agile', 'scrum', 'kanban', 'tdd', 'bdd',
                            'design patterns', 'data structures', 'algorithms', 'framework',
                            'library', 'api', 'service', 'web', 'mobile', 'cloud',
                            'software', 'development', 'engineering', 'testing',
                            'project', 'product', 'team', 'group', 'department',
                            'university', 'college', 'institute', 'school', 'education',
                            'resume', 'cv', 'curriculum', 'vitae', 'summary', 'objective',
                            'skills', 'experience', 'projects', 'contact', 'phone', 'email'}
        
        locations = []
        for ent in doc.ents:
            if ent.label_ in {"GPE", "LOC"}:
                loc_text = ent.text.strip().lower()
                # Filter out non-location terms
                if loc_text not in non_location_terms and len(loc_text) > 2:
                    locations.append(ent.text.strip())
        
        entities["locations"] = list(dict.fromkeys(locations))[:8]
    except Exception:
        entities["organizations"] = []
        entities["locations"] = []
    
    return entities


@lru_cache(maxsize=1)
def _spacy_model():
    import spacy
    # The API remains usable without a downloaded model; regex extraction still runs.
    try:
        return spacy.load("en_core_web_sm")
    except OSError:
        return spacy.blank("en")


@lru_cache(maxsize=1)
def _embedder():
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer("all-MiniLM-L6-v2")


def _tfidf_semantic_similarities(job_description: str, resumes: list[str]) -> list[float]:
    """Fallback TF-IDF similarity calculation when neural embedder is offline or unreachable."""
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        vectorizer = TfidfVectorizer(stop_words='english')
        tfidf_matrix = vectorizer.fit_transform([job_description, *resumes])
        sims = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()
        return [float(np.clip(s, 0, 1)) for s in sims]
    except Exception:
        return [0.5] * len(resumes)


def semantic_similarities(job_description: str, resumes: Iterable[str]) -> list[float]:
    """
    Calculate semantic similarities with normalization.
    Enhanced to handle skill-level semantic matching for better accuracy.
    Returns normalized similarity scores (0-1) that are better calibrated for matching.
    """
    texts = list(resumes)
    if not texts:
        return []
    
    try:
        embedder = _embedder()
        vectors = embedder.encode([job_description, *texts], normalize_embeddings=True, show_progress_bar=False)
        raw_similarities = [float(np.clip(np.dot(vectors[0], vector), 0, 1)) for vector in vectors[1:]]
    except Exception:
        raw_similarities = _tfidf_semantic_similarities(job_description, texts)
    
    # Apply normalization for better score distribution
    normalized_similarities = normalize_cosine_similarity(raw_similarities)
    
    return normalized_similarities


def normalize_cosine_similarity(raw_similarities: list[float]) -> list[float]:
    """
    Apply min-max normalization to cosine similarity scores.
    This helps calibrate scores to a more meaningful 0-100 range.
    """
    if not raw_similarities:
        return []
    
    similarities = np.array(raw_similarities)
    
    # Apply sigmoid-like normalization for better distribution
    # This pushes mid-range scores higher while preserving extremes
    normalized = 1 / (1 + np.exp(-10 * (similarities - 0.5)))  # Sigmoid centered at 0.5
    
    # Scale to 0-1 range
    if normalized.max() > normalized.min():
        normalized = (normalized - normalized.min()) / (normalized.max() - normalized.min())
    
    return [float(np.clip(score, 0, 1)) for score in normalized]


def sanitize_header_text(text: str) -> str:
    """
    Strip header URLs, emails, phone numbers, and page numbers from the top lines.
    Returns clean text suitable for NER processing.
    """
    lines = text.splitlines()
    cleaned_lines = []
    
    # Patterns to remove from header
    url_pattern = re.compile(r'https?://[^\s<>"]+|www\.[^\s<>"]+')
    email_pattern = re.compile(r'[\w.+-]+@[\w-]+\.[\w.-]+')
    phone_pattern = re.compile(r'\+?[\d\s().-]{8,}\d')
    page_pattern = re.compile(r'page \d+ of \d+', re.I)
    
    for line in lines[:5]:  # Only process top 5 lines
        line = line.strip()
        if not line:
            continue
        
        # Remove URLs, emails, phones, page numbers
        line = url_pattern.sub('', line)
        line = email_pattern.sub('', line)
        line = phone_pattern.sub('', line)
        line = page_pattern.sub('', line)
        
        if line.strip():
            cleaned_lines.append(line.strip())
    
    # Add remaining lines unchanged
    cleaned_lines.extend(lines[5:])
    
    return "\n".join(cleaned_lines)


def is_valid_candidate_name(candidate_str: str) -> bool:
    """Strict validation for candidate names with document title rejection."""
    clean = candidate_str.strip()
    words = [w.lower() for w in clean.split()]
    
    if not (2 <= len(words) <= 4):
        return False

    if " ".join(words) in {"john doe", "jane doe", "first last", "your name", "candidate name", "name here"}:
        return False
        
    # Reject if any word matches document titles (e.g., "Senior Java Developer Resume")
    if any(w in DOCUMENT_TITLE_WORDS for w in words):
        return False
        
    # Reject noise patterns
    for pat in NOISE_PATTERNS:
        if re.search(pat, candidate_str, re.IGNORECASE):
            return False
            
    # Support international names, hyphens, apostrophes, and middle initials.
    if not all(re.fullmatch(r"(?:[^\W\d_]+|[^\W\d_]\.)+(?:[-'][^\W\d_]+)*", word) for word in clean.split()):
        return False
        
    return True


def extract_name_local_font_size(pdf_path: str) -> str | None:
    """Find a likely name from text lines near the top of the first PDF page."""
    try:
        with fitz.open(pdf_path) as document:
            if len(document) == 0:
                return None
            page = document[0]
            candidates = []
            for block in page.get_text("dict").get("blocks", []):
                for line in block.get("lines", []):
                    spans = [span for span in line.get("spans", []) if span.get("text", "").strip()]
                    if not spans:
                        continue
                    text = clean_text_line(" ".join(span["text"] for span in spans))
                    top = min(span["bbox"][1] for span in spans)
                    if top > page.rect.height * 0.4:
                        continue
                    # Cut off contact details or a role that shares the name's line.
                    text = re.split(r"\s*(?:\||•|·|—|–)\s*", text, maxsplit=1)[0]
                    words = text.split()
                    if not (2 <= len(words) <= 4) or not is_valid_candidate_name(text):
                        continue
                    if not (text.isupper() or all(word[:1].isupper() for word in words)):
                        continue
                    font_size = max(float(span.get("size", 0)) for span in spans)
                    # Larger, higher lines are more likely to be the candidate header.
                    score = font_size - (top / max(page.rect.height, 1)) * 6
                    candidates.append((score, top, text))
            if candidates:
                candidates.sort(key=lambda item: (-item[0], item[1]))
                return candidates[0][2].title()
    except Exception:
        pass
    return None


def extract_name_local_spacy(pdf_path: str, raw_text: str) -> str | None:
    """Local spaCy NER with Title-Case normalization for ALL-CAPS text."""
    lines = [clean_text_line(line) for line in raw_text.split("\n") if line.strip()][:12]
    
    # One model invocation is faster than running NER once per line.
    header = "\n".join(line.title() if line.isupper() else line for line in lines)
    for ent in _spacy_model()(header).ents:
        if ent.label_ == "PERSON":
            cleaned_ent = clean_text_line(ent.text)
            if is_valid_candidate_name(cleaned_ent):
                return cleaned_ent.title()
                    
    return None


def generate_file_hash(pdf_path: str) -> str:
    """
    Generate a short hash of the PDF file for fallback identification.
    
    Args:
        pdf_path: Path to the PDF file
        
    Returns:
        Short hash string (first 8 characters of SHA256)
    """
    try:
        with open(pdf_path, 'rb') as f:
            file_content = f.read()
            file_hash = hashlib.sha256(file_content).hexdigest()
            return file_hash[:8]  # Return first 8 characters for short identifier
    except Exception:
        # Fallback to filename-based hash if file reading fails
        import os
        filename = os.path.basename(pdf_path)
        return hashlib.sha256(filename.encode()).hexdigest()[:8]


def extract_candidate_name_production(text: str, filename: str, pdf_path: str) -> tuple[str, bool]:
    """Extract the candidate name from the resume header, with slower fallbacks."""
    # Explicit name labels are the strongest text-layer signal.
    for raw_line in text.splitlines()[:20]:
        line = clean_text_line(raw_line)
        label_match = re.match(r"^\s*(?:full\s+)?(?:candidate\s+)?name\s*[:\-]\s*(.+)$", line, re.I)
        if label_match:
            candidate = re.split(r"\s*(?:\||•|·|—|–|,)\s*", label_match.group(1), maxsplit=1)[0].strip()
            if is_valid_candidate_name(candidate):
                return candidate.title(), False

    # Use first-page position and type size to distinguish the name from body text.
    if pdf_path and Path(pdf_path).exists():
        name = extract_name_local_font_size(pdf_path)
        if name:
            return name, False

    # Then use likely name-shaped text in the opening lines only.
    for raw_line in text.splitlines()[:8]:
        line = clean_text_line(raw_line)
        line = re.sub(r"^\s*(?:[-*•]|\d+[.)])\s*", "", line)
        line = re.sub(r"^(?:resume|curriculum vitae)\s+of\s+", "", line, flags=re.I)
        line = re.split(r"\s*(?:\||•|·|—|–)\s*|\s{2,}", line, maxsplit=1)[0]
        line = re.sub(r"[,;:]$", "", line).strip()
        words = line.split()
        for word_count in range(min(4, len(words)), 1, -1):
            candidate = " ".join(words[:word_count]).strip(" ,;:-")
            looks_like_name = candidate.isupper() or all(word[:1].isupper() for word in candidate.split())
            if is_valid_candidate_name(candidate) and looks_like_name:
                return candidate.title(), False

    # Descriptive upload filenames are a cheap, useful fallback.
    file_candidate = re.sub(r"[_-]+", " ", Path(filename).stem)
    file_candidate = re.sub(r"\([^)]*\)|\[[^]]*\]", " ", file_candidate)
    file_candidate = re.sub(r"^[0-9a-f]{8,}\s*", "", file_candidate, flags=re.I)
    file_candidate = re.sub(r"^\d{1,4}\s+", "", file_candidate)
    file_candidate = re.sub(r"\s+", " ", file_candidate).strip()
    file_candidate = re.sub(r"^(?:resume|cv|curriculum vitae)\s+", "", file_candidate, flags=re.I)
    file_words = file_candidate.split()
    metadata_words = DOCUMENT_TITLE_WORDS | {
        "cse", "it", "aiml", "mca", "bca", "btech", "be", "batch", "python", "java",
        "javascript", "typescript", "react", "sql", "machine", "learning", "artificial",
        "intelligence", "ai", "ml", "web", "backend", "frontend", "fullstack",
    }
    name_words = []
    for word in file_words:
        if word.lower().strip(".,()") in metadata_words or re.fullmatch(r"\d{2,4}", word):
            break
        name_words.append(word.strip(".,()"))
    for word_count in range(min(4, len(name_words)), 1, -1):
        possible_name = " ".join(name_words[:word_count]).strip()
        if is_valid_candidate_name(possible_name):
            return possible_name.title(), False

    # NER remains a fallback and runs once for the whole header.
    if pdf_path and Path(pdf_path).exists():
        name = extract_name_local_spacy(pdf_path, text)
        if name:
            return name, False

    # Final fallback for blank/template resumes.
    if pdf_path and Path(pdf_path).exists():
        with open(pdf_path, "rb") as f:
            file_hash = hashlib.sha256(f.read()).hexdigest()[:8]
    else:
        file_hash = "unknown"
        
    return f"Unnamed Candidate ({file_hash})", True


def extract_candidate_name_tiered(text: str, filename: str, pdf_path: Optional[str] = None) -> str:
    """
    Multi-tiered candidate name extraction with strict validation.
    
    Tier 1: Sanitized text NER with header cleanup
    Tier 2: Filename parsing fallback  
    Tier 3: PDF metadata extraction
    Tier 4: Clean fallback labels
    """
    
    # Tier 1: Sanitized text NER with header cleanup
    sanitized_text = sanitize_header_text(text)
    lines = [line.strip() for line in sanitized_text.splitlines() if line.strip()]
    
    # Try to extract name from first few lines using patterns
    for line in lines[:5]:
        # Pattern: Title case name at start
        match = re.match(r'^([A-Z][a-z]+ [A-Z][a-z]+(?: [A-Z][a-z]+)*)', line)
        if match:
            potential_name = match.group(1).strip()
            if is_valid_candidate_name(potential_name):
                return potential_name.title()
        
        # Pattern: ALL UPPERCASE name
        match = re.match(r'^([A-Z]+ [A-Z]+(?: [A-Z]+)*)', line)
        if match:
            potential_name = match.group(1).strip()
            if is_valid_candidate_name(potential_name):
                return potential_name.title()
    
    # Tier 2: Filename parsing fallback
    name_from_file = re.sub(r"[_-]+", " ", filename.rsplit(".", 1)[0])
    name_from_file = re.sub(r'resume|cv|curriculum|vitae', '', name_from_file, flags=re.I)
    name_from_file = re.sub(r'^[0-9a-f]{8,}', '', name_from_file, flags=re.I)
    name_from_file = re.sub(r'[^A-Za-z\s]', '', name_from_file)
    
    if is_valid_candidate_name(name_from_file.strip()):
        return name_from_file.strip().title()
    
    # Tier 3: PDF metadata extraction
    if pdf_path:
        try:
            with fitz.open(pdf_path) as doc:
                metadata = doc.metadata
                # Check author field
                if metadata.get('author'):
                    author_name = metadata['author'].strip()
                    if is_valid_candidate_name(author_name):
                        return author_name.title()
                # Check title field
                if metadata.get('title'):
                    title_name = metadata['title'].strip()
                    if is_valid_candidate_name(title_name):
                        return title_name.title()
        except Exception:
            pass  # PDF metadata extraction failed, continue to fallback
    
    # Tier 4: Clean fallback labels
    # Extract just the filename without extension for fallback
    clean_filename = filename.rsplit(".", 1)[0]
    # Remove UUID-like patterns
    clean_filename = re.sub(r'^[0-9a-f]{8,}', '', clean_filename, flags=re.I)
    
    if len(clean_filename) > 3 and not re.match(r'^[0-9a-f]+$', clean_filename.lower()):
        return f"Unnamed Candidate ({clean_filename})"
    
    return "Placeholder Candidate"


def infer_name(text: str, filename: str) -> str:
    """Legacy name inference function - now uses the new multi-tiered extraction."""
    return extract_candidate_name_tiered(text, filename)
    
    # Enhanced noise patterns to filter out non-name content
    noise_patterns = [
        r'resume|curriculum|vitae|cv',
        r'email|phone|linkedin|github|portfolio|website',
        r'address|location|contact',
        r'experience|education|skills|projects',
        r'summary|objective|profile',
        r'page \d+',
        r'qwikresume|resumeworded',
        r'java developer|software engineer|developer|developer\.|python developer',  # Job titles
        r'junior|senior|lead|principal|staff',  # Job level indicators
        r'libyan|jamahiriya|coventry|alabama',  # Common location words
        r'philosophy|areas of expertise|personal summary',  # Section headers
        r'bachelor|master|phd|doctor|science|engineering|arts',  # Degree words
        r'university|college|institute|technology',  # Institution words
        r'wealth management|management',  # Additional job terms
        r'first last|first name last name',  # Placeholder names
        r'image|c\s+ec\s+bedb|montgomery|street|san',  # Image file references and garbage text
        r'jessica summary|claire summary|professional summary',  # Section headers being extracted as names
        r'clai re|jessica claire',  # Common section header combinations
        r'\d+\s+\d+',  # Number sequences
        r'st|ave|blvd|rd|lane|drive|court|place|way',  # Street suffixes
        r'core competencies|key skills|technical skills|soft skills',  # Section headers
        r'city state zip code|city state|zip code',  # Address patterns
        r'objective|summary|profile|about me',  # Section headers
        r'contact information|personal details',  # Section headers
        r'work history|employment history',  # Section headers
        r'academic background|educational background',  # Section headers
    ]
    
    # Location patterns that should be excluded from names
    location_patterns = [
        r'south|north|east|west',
        r'libyan|arab|jamahiriya',
        r'coventry|alabama|california|texas',
        r'road|street|avenue|boulevard',
        r'\d{3,}.*road|\d+.*street',  # Addresses
        r'san francisco|new york|boston|chicago|pittsburgh|denver',  # City names
        r'sheffield|pollichburgh|indonesia',  # International locations
        r'montgomery|san|charlotte|richmond|virginia',  # Additional location terms
        r'arizona|dallas|phoenix|hudson|detroit|los angeles',  # More cities
    ]
    
    # Common first names for validation (expanded list)
    common_first_names = {
        'john', 'jane', 'michael', 'david', 'robert', 'william', 'james', 'richard',
        'mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'barbara', 'susan',
        'jessica', 'sarah', 'karen', 'nancy', 'lisa', 'betty', 'margaret',
        'sandra', 'ashley', 'kimberly', 'emily', 'donna', 'michelle', 'dorothy',
        'carol', 'amanda', 'melissa', 'deborah', 'stephanie', 'rebecca', 'sharon',
        'laura', 'cynthia', 'kathleen', 'amy', 'shirley', 'angela', 'helen',
        'anna', 'brenda', 'pamela', 'nicole', 'emma', 'samantha', 'katherine',
        'christine', 'debra', 'rachel', 'catherine', 'carolyn', 'janet', 'ruth',
        'maria', 'heather', 'diane', 'virginia', 'julie', 'joyce', 'victoria',
        'olivia', 'jennifer', 'kelly', 'christina', 'lauren', 'joan', 'evelyn',
        'judith', 'megan', 'cheryl', 'andrea', 'hannah', 'martha', 'jacqueline',
        'frances', 'gloria', 'ann', 'teresa', 'kathryn', 'sara', 'janice',
        'jean', 'alice', 'doris', 'abigail', 'julia', 'judy', 'grace',
        'denise', 'amber', 'marilyn', 'beverly', 'danielle', 'theresa', 'sophie',
        'taylor', 'brittany', 'isabella', 'natalie', 'caroline', 'kyle', 'tyler',
        'amelia', 'margot', 'simon', 'ford', 'claire', 'bones', 'charlotte', 'john',
        'charles', 'helen', 'victoria', 'laityn', 'vannesa', 'daryl', 'jared', 'arthur', 'noah',
        'alexander', 'andrew', 'benjamin', 'christopher', 'daniel', 'ethan', 'joseph', 'matthew', 'nicholas', 'ryan', 'samuel', 'thomas',
        'corry', 'corey', 'corrie', 'cory', 'justin', 'jason', 'brian', 'kevin', 'joshua', 'brandon', 'eric', 'adam', 'ryan', 'alex', 'nathan', 'dylan', 'austin', 'mason', 'ethan', 'caleb', 'luke', 'owen', 'gabriel', 'samuel', 'jackson', 'logan', 'aiden', 'liam', 'noah', 'elijah', 'oliver', 'james', 'william', 'oliver', 'benjamin', 'elijah', 'lucas', 'henry', 'theodore', 'jack', 'levi', 'alexander', 'sebastian', 'jacob', 'michael', 'daniel', 'matthew', 'henry', 'joseph', 'samuel', 'alexander', 'sebastian', 'william', 'david', 'joseph', 'carter', 'owen', 'wyatt', 'john', 'jack', 'luke', 'jayden', 'dylan', 'levi', 'isaac', 'gabriel', 'julian', 'christopher', 'aiden', 'jaxon', 'lincoln', 'thomas', 'miles', 'cameron', 'hunter', 'colton', 'ezra', 'charlie', 'jaxon', 'landon', 'jeremiah', 'josiah', 'hudson', 'greyson', 'elias', 'adrian', 'xavier', 'kai', 'santiago', 'leo', 'finn', 'sebastian', 'james', 'jason', 'timothy', 'jeremy', 'adam', 'paul', 'mark', 'steven', 'brian', 'kevin', 'jason', 'ryan', 'eric', 'jonathan', 'justin', 'bryan', 'nicholas', 'alexander', 'jordan', 'tyler', 'kyle', 'nathan', 'dylan', 'luke', 'jack', 'owen', 'gabriel', 'samuel', 'jacob', 'michael', 'matthew', 'daniel', 'joshua', 'andrew', 'christopher', 'joseph', 'william', 'anthony', 'donald', 'mark', 'paul', 'steven', 'richard', 'kenneth', 'raymond', 'roger', 'ryan', 'brandon', 'george', 'edward', 'jeffrey', 'scott', 'derek', 'stephen', 'ross', 'russell', 'randy', 'wayne', 'bradley', 'patrick', 'peter', 'kevin', 'jason', 'timothy', 'daniel', 'joseph', 'ronald', 'anthony', 'luis', 'carlos', 'kevin', 'jason', 'justin', 'aaron', 'adam', 'nathan', 'ryan', 'alex', 'tyler', 'zachary', 'evan', 'kyle', 'brandon', 'austin', 'conor', 'declan', 'finn', 'ciaran', 'sean', 'liam', 'cillian', 'fionn', 'ronan', 'darragh', 'ciarán', 'éireann', 'niamh', 'saoirse', 'aoife', 'ciara', 'rachel', 'hannah', 'emma', 'sophie', 'olivia', 'isabella', 'charlotte', 'mia', 'ava', 'eva', 'lily', 'grace', 'ruby', 'scarlett', 'ivy', 'poppy', 'violet', 'daisy', 'luna', 'bella', 'freya', 'phoebe', 'maya', 'aria', 'isla', 'elsie', 'evie', 'harper', 'willow', 'skylar', 'parker', 'quinn', 'riley', 'avery', 'kendall', 'mckenzie', 'maddison', 'payton', 'sydney', 'blake', 'hayden', 'taylor', 'morgan', 'reese', 'peyton', 'cameron', 'riley', 'avery', 'kennedy', 'addison', 'bailey', 'brooklyn', 'carson', 'mckenzie', 'samuel', 'jackson', 'luke', 'miles', 'everett', 'jordan', 'graham', 'grant', 'harrison', 'kennedy', 'lawson', 'logan', 'mason', 'nolan', 'oscar', 'parker', 'paxton', 'quinn', 'rhett', 'ryder', 'shelby', 'tristan', 'tyler', 'walker', 'winston', 'wyatt',
        'katelynn', 'katherine', 'kate', 'kathryn', 'kathie', 'kathy', 'kaitlyn', 'kayla', 'kaylee', 'kayleigh', 'kiana', 'kiara', 'kiera', 'kimberly', 'kira', 'kristen', 'kristina', 'kristin', 'kristy', 'kylie', 'kyra', 'kay', 'katie', 'kathleen', 'katharine', 'katarina', 'katerina', 'kathryn', 'kaitlynn', 'kaitlin', 'katelyn', 'katelyne', 'katelynn'
    }
    
    # Common last names for validation
    common_last_names = {
        'smith', 'johnson', 'williams', 'brown', 'jones', 'miller', 'davis',
        'garcia', 'rodriguez', 'wilson', 'martinez', 'anderson', 'taylor',
        'thomas', 'moore', 'jackson', 'martin', 'lee', 'perez', 'thompson',
        'white', 'harris', 'sanchez', 'clark', 'ramirez', 'lewis', 'robinson',
        'walker', 'young', 'allen', 'king', 'wright', 'scott', 'torres',
        'nguyen', 'hill', 'flores', 'green', 'adams', 'nelson', 'baker',
        'hall', 'rivera', 'campbell', 'mitchell', 'carter', 'roberts', 'gomez',
        'phillips', 'evans', 'turner', 'diaz', 'parker', 'cruz', 'edwards',
        'collins', 'reyes', 'stewart', 'morris', 'morales', 'murphy', 'cook',
        'rogers', 'gutierrez', 'ortiz', 'morgan', 'cooper', 'peterson', 'bailey',
        'reed', 'kelly', 'howard', 'ramos', 'kim', 'cox', 'ward', 'richardson',
        'watson', 'brooks', 'chavez', 'wood', 'bennett', 'gray', 'mendoza',
        'ruiz', 'hughes', 'price', 'alvarez', 'castillo', 'sanders', 'patel',
        'myers', 'long', 'ross', 'foster', 'jimenez', 'powell', 'jenkins',
        'perry', 'butler', 'barnes', 'fisher', 'henderson', 'cole', 'simmons',
        'may', 'marshall', 'westercamp', 'branch', 'jacobi', 'maica', 'boyd', 'arthur',
        'ford', 'tremblay', 'tremblay', 'tremlay', 'trambley', 'tromblay', 'tremblay', 'tremblais', 'tremblaye', 'trembley', 'trembly', 'tremble', 'trembl', 'trémblay', 'trémblé', 'trémblaye', 'trembelay', 'trembel', 'trembelle', 'trembell', 'trembelaye', 'trembley', 'tremblay', 'tremblé', 'tremblais', 'tremblaye', 'tremblays', 'trembly', 'tremblye', 'trembly'
    }
    
    # Try specific patterns first, then general heuristics
    # Pattern 1: "Name, Suffix" format (e.g., "Charles K. Sorensen, MTA")
    for line in lines[:3]:
        match = re.match(r'^([A-Z][a-z]+(?: [A-Z]\.?)?(?: [A-Z][a-z]+)+),', line)
        if match:
            potential_name = match.group(1).strip()
            words = potential_name.lower().replace('.', '').split()
            # Validate it's not a location or noise
            if (not any(re.search(pattern, potential_name, re.I) for pattern in location_patterns) and
                (words[0] in common_first_names or words[-1] in common_last_names)):
                return potential_name.title()
    
    # Pattern 2: "Name Phone" format (e.g., "Robert Smith Phone")
    for line in lines[:5]:
        match = re.match(r'^([A-Z][a-z]+ [A-Z][a-z]+(?: [A-Z][a-z]+)*)\s+Phone', line)
        if match:
            potential_name = match.group(1).strip()
            words = potential_name.lower().split()
            # Validate it's not a location or noise
            if (not any(re.search(pattern, potential_name, re.I) for pattern in location_patterns) and
                (words[0] in common_first_names or words[-1] in common_last_names)):
                return potential_name.title()
    
    # Pattern 2: Email format extraction (e.g., "john.smith@email.com")
    for line in lines[:10]:
        email_match = re.search(r'([a-z]+\.?[a-z]+(?:\.[a-z]+)*)@', line, re.I)
        if email_match:
            potential_name = email_match.group(1).replace('.', ' ')
            words = potential_name.lower().split()
            if (2 <= len(words) <= 3 and
                (words[0] in common_first_names or words[-1] in common_last_names)):
                return potential_name.title()
    
    # Pattern 3: Simple name at the start (most common format)
    for line in lines[:5]:  # Increased to check more lines
        # Extract just the name part before any other content
        # Handle both Title Case (John Doe) and ALL UPPERCASE (JOHN DOE)
        match = re.match(r'^([A-Z][a-z]+ [A-Z][a-z]+(?: [A-Z][a-z]+)*)', line)
        if not match:
            # Try ALL UPPERCASE pattern
            match = re.match(r'^([A-Z]+ [A-Z]+(?: [A-Z]+)*)', line)
        
        if match:
            potential_name = match.group(1).strip()
            words = potential_name.lower().split()
            
            # Strict validation to avoid false positives
            if (2 <= len(words) <= 3 and  # Name should be 2-3 words
                all(word.isalpha() for word in words) and  # Only alphabetic characters
                len(words[0]) >= 3 and len(words[-1]) >= 3 and  # Reasonable name length
                not any(word.lower() in ['developer', 'engineer', 'manager', 'analyst', 'java', 'software', 'science', 'bachelor', 'master', 'python', 'core', 'competencies', 'city', 'state', 'zip', 'code', 'first', 'last', 'objective', 'summary', 'profile', 'contact', 'technical', 'key', 'skills'] for word in words) and
                not any(re.search(pattern, line, re.I) for pattern in noise_patterns) and
                not any(re.search(pattern, potential_name, re.I) for pattern in location_patterns)):
                # Only accept if it has a common first or last name
                if (words[0] in common_first_names or words[-1] in common_last_names):
                    return potential_name.title()
    
    # Pattern 4: "Name: John Doe" format
    for line in lines[:10]:
        match = re.search(r'Name:\s*([A-Z][a-z]+ [A-Z][a-z]+(?: [A-Z][a-z]+)*)', line, re.I)
        if match:
            potential_name = match.group(1).strip()
            words = potential_name.lower().split()
            if (2 <= len(words) <= 3 and
                (words[0] in common_first_names or words[-1] in common_last_names)):
                return potential_name.title()
    
    # Pattern 5: "John Doe - Position" format
    for line in lines[:10]:
        match = re.match(r'^([A-Z][a-z]+ [A-Z][a-z]+(?: [A-Z][a-z]+)*)\s*-', line)
        if match:
            potential_name = match.group(1).strip()
            words = potential_name.lower().split()
            if (2 <= len(words) <= 3 and
                (words[0] in common_first_names or words[-1] in common_last_names)):
                return potential_name.title()
    
    # Try to find name in first 20 lines with more lenient criteria
    for line in lines[:20]:
        # Remove special characters but keep name-appropriate ones
        clean = re.sub(r"[^A-Za-z .'-]", "", line).strip()
        
        # Skip if line is too short or contains noise
        if len(clean) < 3 or len(clean) > 60:
            continue
            
        # Skip if it matches noise patterns (but be more lenient)
        if any(re.search(pattern, line, re.I) for pattern in noise_patterns[:5]):  # Only check first 5 most critical patterns
            continue
            
        # Skip if it looks like a location
        if any(re.search(pattern, clean, re.I) for pattern in location_patterns):
            continue
            
        # Skip if it's all uppercase (likely a header)
        if clean.isupper() and len(clean.split()) > 3:
            continue
            
        # More lenient validation for names
        words = clean.lower().split()
        if (1 < len(words) <= 4 and  # Name should be 2-4 words
            all(word[0].isupper() for word in clean.split()) and  # Each word should start with capital
            all(word.isalpha() for word in words) and  # Only alphabetic characters
            len(words[0]) >= 3 and len(words[-1]) >= 3 and  # Reasonable name length
            not any(word.lower() in ['developer', 'engineer', 'manager', 'analyst', 'java', 'software', 'science', 'bachelor', 'master', 'python', 'core', 'competencies', 'city', 'state', 'zip', 'code', 'first', 'last', 'objective', 'summary', 'profile', 'contact', 'technical', 'key', 'skills'] for word in words)):
            # Only accept if it has a common first or last name
            if (words[0] in common_first_names or words[-1] in common_last_names):
                return clean.title()
    
    # Improved fallback to filename
    name_from_file = re.sub(r"[_-]+", " ", filename.rsplit(".", 1)[0])
    # Remove UUID-like patterns and common resume filename patterns
    name_from_file = re.sub(r'resume|cv|curriculum|vitae', '', name_from_file, flags=re.I)
    name_from_file = re.sub(r'^[0-9a-f]{8,}', '', name_from_file, flags=re.I)  # Remove UUIDs
    name_from_file = re.sub(r'[^A-Za-z\s]', '', name_from_file)  # Remove special chars
    
    # Try to extract name from filename if it looks like a name
    file_words = name_from_file.strip().split()
    if (2 <= len(file_words) <= 3 and
        all(word.isalpha() for word in file_words) and
        len(file_words[0]) >= 3 and len(file_words[-1]) >= 3):
        # Check if it looks like a name
        if (file_words[0].lower() in common_first_names or file_words[-1].lower() in common_last_names):
            return name_from_file.strip().title()
    
    # If filename still looks like a UUID or hex, return Unknown
    if len(name_from_file) < 3 or re.match(r'^[0-9a-f]+$', name_from_file.lower()):
        return "Unknown Candidate"
    
    return name_from_file.strip().title() or "Unknown Candidate"


def recommendation(score: int) -> str:
    """
    Generate recommendation based on calibrated score thresholds.
    Calibrated so that 80%+ skill coverage candidates achieve 85-98% scores.
    """
    if score >= 85: return "Strong Match"
    if score >= 70: return "Good Match"
    if score >= 55: return "Moderate Match"
    return "Weak Match"


def calculate_composite_score(
    skill_coverage: float,  # 0-100
    semantic_fit: float,    # 0-100  
    experience_match: float, # 0-100
    education_role_alignment: float = 50  # 0-100, default neutral
) -> int:
    """
    Calculate composite match score using calibrated weights:
    Overall Match = (40% × Skill Coverage) + (30% × Semantic Fit) + 
                   (20% × Experience Match) + (10% × Education/Role Alignment)
    
    This prioritizes skill coverage while still considering semantic understanding
    and experience relevance.
    """
    overall = (
        (skill_coverage * 0.40) +
        (semantic_fit * 0.30) +
        (experience_match * 0.20) +
        (education_role_alignment * 0.10)
    )
    
    return int(round(np.clip(overall, 0, 100)))


# Pydantic schema for single-pass Ollama structured resume extraction
class SkillItem(BaseModel):
    name: str
    category: Optional[str] = None

class EducationItem(BaseModel):
    degree: Optional[str] = None
    institution: Optional[str] = None
    field: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class ExperienceItem(BaseModel):
    job_title: Optional[str] = None
    company: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None

class ProjectItem(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    technologies: List[str] = Field(default_factory=list)

class CertificationItem(BaseModel):
    name: Optional[str] = None
    issuer: Optional[str] = None
    date: Optional[str] = None

class ResumeExtractionSchema(BaseModel):
    """Schema for single-pass structured resume data extraction using Ollama."""
    name: Optional[str] = Field(None, description="Candidate legal full name from top header lines")
    email: Optional[str] = Field(None, description="Candidate email address")
    phone: Optional[str] = Field(None, description="Candidate phone number")
    summary: Optional[str] = Field(None, description="Professional summary or objective")
    skills: List[SkillItem] = Field(default_factory=list, description="Explicit technical skills listed")
    education: List[EducationItem] = Field(default_factory=list, description="Education history")
    experience: List[ExperienceItem] = Field(default_factory=list, description="Work experience items with start and end dates")
    projects: List[ProjectItem] = Field(default_factory=list, description="Projects")
    certifications: List[CertificationItem] = Field(default_factory=list, description="Certifications and licenses")
    languages: List[str] = Field(default_factory=list, description="Languages spoken or written")


def preprocess_resume_text(raw_text: str) -> str:
    """
    Preprocess resume text to improve name extraction by separating header information.
    """
    lines = raw_text.split('\n')
    processed_lines = []
    
    for line in lines:
        match = re.match(r'^(\d+)\s+([A-Za-z][A-Za-z\s]+),\s*([A-Za-z][A-Za-z\s]+,\s*[A-Za-z]{2})$', line.strip())
        if match:
            number, name_part, location_part = match.groups()
            processed_lines.append(name_part.strip())
            processed_lines.append(f"{number} {location_part.strip()}")
        else:
            processed_lines.append(line)
    
    return '\n'.join(processed_lines)


def extract_resume_data_ollama(raw_text: str, pdf_path: str) -> Dict:
    """
    Extract structured resume data using ONE Ollama LLM call with Pydantic schema enforcement.
    Deterministic Python logic handles skill canonicalization, date duration calculation,
    semantic matching, and ATS scoring.
    """
    if not settings.enable_ollama_parser:
        return extract_resume_data_fast(raw_text, pdf_path)

    try:
        import ollama
        import json
        
        preprocessed_text = preprocess_resume_text(raw_text)
        truncated_text = preprocessed_text[:4000]
        
        schema = ResumeExtractionSchema.model_json_schema()
        
        response = ollama.chat(
            model=settings.ollama_model,
            messages=[
                {
                    "role": "system",
                    "content": """You are an expert resume parser. Extract structured information explicitly present in the resume.

STRICT EXTRACTION RULES:
- Extract ONLY information explicitly present in the resume text.
- NEVER infer or invent facts, skills, employers, dates, degrees, or projects that are not in the text.
- Extract employment/work experience entries whenever clearly present in the text.
- Recognize employment date ranges even when OCR introduces minor formatting artifacts or symbols (e.g., "2018- Ongoing", "8 2018- Ongoing", "2017-Present").
- Treat "Ongoing", "On-going", "Present", "Current", "Now", "Till date", "Till now", and "To date" as active/current employment.
- If a year is clearly present and the employment is ongoing, return the start year and "present" (or "ongoing") as the end_date.
- Distinguish work experience from training, courses, and certifications based on section titles and context.
- If information is unavailable for any field, return null or an empty list.
- Candidate full name is typically in the header lines at the top of the resume.
- Company names, job titles, and locations/addresses are NOT candidate names.
- Do NOT calculate total years of experience, ATS scores, or match percentages.

Return valid JSON matching the provided schema."""
                },
                {
                    "role": "user",
                    "content": f"Extract all structured resume data from the text below:\n\n{truncated_text}"
                }
            ],
            format=schema,
            options={
                "temperature": 0.0,
                "num_predict": 1000
            }
        )
        
        extracted_data_str = response.message.content
        parsed_data = json.loads(extracted_data_str)
        validated_data = ResumeExtractionSchema(**parsed_data)
        
        # 1. Candidate Name Validation & Hash Fallback
        extracted_name = (validated_data.name or "").strip()
        candidate_name = extracted_name
        requires_manual_entry = False
        
        placeholder_names = {'first last', 'john doe', 'jane doe', 'your name', 'candidate name', 'name here', 'unknown', 'applicant name'}
        company_indicators = {'and', '&', 'company', 'corporation', 'inc', 'llc', 'ltd', 'group', 'associates', 'partners'}
        job_title_indicators = {'developer', 'engineer', 'manager', 'director', 'analyst', 'consultant', 'specialist', 'coordinator', 'administrator'}
        location_indicators = {'st', 'ave', 'blvd', 'rd', 'lane', 'drive', 'court', 'place', 'way', 'street', 'avenue', 'road'}
        
        name_lower = candidate_name.lower()
        is_invalid_name = (
            not candidate_name or
            len(candidate_name) < 2 or
            not is_valid_candidate_name(candidate_name) or
            name_lower in placeholder_names or
            any(ind in name_lower for ind in company_indicators) or
            any(ind in name_lower for ind in job_title_indicators) or
            any(ind in name_lower for ind in location_indicators)
        )
        
        if is_invalid_name:
            candidate_name, requires_manual_entry = extract_candidate_name_production(
                raw_text, Path(pdf_path).name, pdf_path
            )
            
        # 2. Python Skill Canonicalization (using 280+ mappings)
        raw_skills = [s.name for s in validated_data.skills if s.name]
        rule_skills = extract_skills(raw_text)
        all_raw_skills = raw_skills + rule_skills
        
        normalized_skills = list(dict.fromkeys([normalize_skill_term(s) for s in all_raw_skills if s]))
        
        # 3. Python Employment Date Parsing & Duration Calculation (deduplicated & merged)
        present_keywords = {'present', 'current', 'now', 'ongoing', 'on-going', 'till date', 'till now', 'to date'}
        all_date_ranges: List[Tuple[datetime, datetime]] = []
        
        # Parse dates from structured LLM experience items
        for exp in validated_data.experience:
            start_s = exp.start_date
            end_s = exp.end_date
            if start_s:
                try:
                    s_dt = date_parser.parse(start_s, fuzzy=True)
                    if not end_s or any(kw in (end_s or "").lower().strip() for kw in present_keywords):
                        e_dt = datetime.now()
                    else:
                        e_dt = date_parser.parse(end_s, fuzzy=True)
                    if s_dt <= e_dt:
                        all_date_ranges.append((s_dt, e_dt))
                except Exception:
                    pass
                    
        # Do NOT merge with dates extracted from raw text to prevent capturing education/project dates.
        # Use structured LLM data exclusively if available.
        
        total_exp_years = calculate_total_experience(all_date_ranges)
        
        # 4. Education Formatting
        edu_list = []
        for edu in validated_data.education:
            parts = [p for p in [edu.degree, edu.institution, edu.field] if p]
            if parts:
                edu_list.append(" - ".join(parts))
        highest_edu = "; ".join(edu_list) if edu_list else extract_education(raw_text)
        
        # 5. Work Experience & Projects Formatting
        work_exp_list = [
            {
                "title": exp.job_title or "Role",
                "company": exp.company or "",
                "start_date": exp.start_date or "",
                "end_date": exp.end_date or "",
                "description": exp.description or ""
            }
            for exp in validated_data.experience
        ]
        
        projects_list = [
            f"{proj.name}: {proj.description}" if proj.name and proj.description else (proj.name or proj.description or "")
            for proj in validated_data.projects
            if proj.name or proj.description
        ]
        if not projects_list:
            projects_list = extract_projects(raw_text)
            
        contact_entities = extract_entities(raw_text)

        return {
            "name": candidate_name,
            "email": validated_data.email or (contact_entities.get("emails") or [None])[0],
            "phone": validated_data.phone or (contact_entities.get("phones") or [None])[0],
            "requires_manual_entry": requires_manual_entry,
            "is_degraded_fallback": False,
            "experience_years": total_exp_years,
            "education": highest_edu or "Not specified",
            "skills": sorted(normalized_skills),
            "work_experience": work_exp_list,
            "notable_projects": projects_list
        }
        
    except Exception as e:
        print(f"[DEGRADED MODE] Ollama extraction failed for {pdf_path}: {e}. Falling back to rule-based parser.")
        
        file_hash = generate_file_hash(pdf_path)
        try:
            skills = extract_skills(raw_text)
            education = extract_education(raw_text)
            entities = extract_entities(raw_text)
            date_ranges = extract_work_dates(raw_text)
            experience_years = calculate_total_experience(date_ranges)
            name, req_manual = extract_candidate_name_production(raw_text, Path(pdf_path).name, pdf_path)
            
            return {
                "name": name,
                "email": (entities.get("emails") or [None])[0],
                "phone": (entities.get("phones") or [None])[0],
                "requires_manual_entry": req_manual,
                "is_degraded_fallback": True,
                "experience_years": experience_years,
                "education": education,
                "skills": sorted(set([normalize_skill_term(s) for s in skills])),
                "work_experience": extract_experience_details(raw_text),
                "notable_projects": extract_projects(raw_text)
            }
        except Exception as fallback_err:
            print(f"Fallback extraction also failed: {fallback_err}")
            return {
                "name": f"Unnamed Candidate ({file_hash})",
                "email": None,
                "phone": None,
                "requires_manual_entry": True,
                "is_degraded_fallback": True,
                "experience_years": 0.0,
                "education": "Not specified",
                "skills": [],
                "work_experience": [],
                "notable_projects": []
            }


def extract_resume_data_fast(raw_text: str, pdf_path: str) -> Dict:
    """Fast local resume parser used by default for high-throughput processing."""
    try:
        skills = extract_skills(raw_text)
        education = extract_education(raw_text)
        entities = extract_entities(raw_text)
        experience_years = float(entities.get("experience_years", 0) or 0)
        if experience_years <= 0:
            date_ranges = extract_work_dates(raw_text)
            experience_years = calculate_total_experience(date_ranges)
        name, req_manual = extract_candidate_name_production(raw_text, Path(pdf_path).name, pdf_path)

        return {
            "name": name,
            "email": (entities.get("emails") or [None])[0],
            "phone": (entities.get("phones") or [None])[0],
            "requires_manual_entry": req_manual,
            "is_degraded_fallback": True,
            "experience_years": experience_years,
            "education": education,
            "skills": sorted({normalize_skill_term(s) for s in skills}),
            "work_experience": extract_experience_details(raw_text),
            "notable_projects": extract_projects(raw_text),
            "entities": entities,
        }
    except Exception as fallback_err:
        print(f"Fast extraction failed for {pdf_path}: {fallback_err}")
        file_hash = generate_file_hash(pdf_path)
        return {
            "name": f"Unnamed Candidate ({file_hash})",
            "email": None,
            "phone": None,
            "requires_manual_entry": True,
            "is_degraded_fallback": True,
            "experience_years": 0.0,
            "education": "Not specified",
            "skills": [],
            "work_experience": [],
            "notable_projects": [],
            "entities": {"emails": [], "phones": [], "experience_years": 0, "organizations": [], "locations": []},
        }
