export interface Candidate {
  id: string
  name: string
  initials: string
  title: string
  match: number
  recommendation: 'Strong Match' | 'Good Match' | 'Moderate Match' | 'Weak Match'
  experience: string
  skills: string[]
  missingSkills: string[]
  education: string
  location: string
  projects: string[]
  semanticMatch: number
  skillMatch: number
  experienceMatch: number
  aiInsight: string
  email?: string | null
  filename?: string
  analysisId?: string
  isShortlisted?: boolean
  shortlistSource?: 'automatic' | 'manual'
  emailSent?: boolean
  experienceDetails?: any[]
  jobRequirements?: {
    required: string[]
    preferred: string[]
  }
  entities?: {
    emails: string[]
    phones: string[]
    experience_years: number
    organizations: string[]
    locations: string[]
  }
}

export interface SkillCoverage {
  skill: string
  required: boolean
  coverage: number
  missing: number
}

export const CANDIDATES: Candidate[] = [
  {
    id: '1',
    name: 'Rahul Sharma',
    initials: 'RS',
    title: 'Senior ML Engineer',
    match: 94,
    recommendation: 'Strong Match',
    experience: '5 years',
    skills: ['Python', 'Machine Learning', 'TensorFlow', 'SQL', 'Docker', 'PyTorch', 'Scikit-learn'],
    missingSkills: ['Kubernetes', 'AWS'],
    education: 'M.Tech Computer Science, IIT Delhi',
    location: 'Bangalore, India',
    projects: [
      'Recommendation engine serving 50M+ users at 30ms p99 latency',
      'NLP pipeline for multi-lingual sentiment analysis (12 languages)',
      'Real-time fraud detection system — $4M+ in prevented losses',
    ],
    semanticMatch: 94,
    skillMatch: 90,
    experienceMatch: 86,
    aiInsight:
      'Candidate demonstrates strong alignment with the technical requirements, particularly in Python, Machine Learning and SQL. The primary gap is cloud infrastructure experience (Kubernetes, AWS), but solid ML fundamentals and Docker experience suggest a fast learning curve.',
  },
  {
    id: '2',
    name: 'Priya Patel',
    initials: 'PP',
    title: 'Data Scientist',
    match: 91,
    recommendation: 'Strong Match',
    experience: '4 years',
    skills: ['Python', 'Machine Learning', 'Keras', 'SQL', 'Spark', 'R', 'Statistics'],
    missingSkills: ['Docker', 'Kubernetes'],
    education: 'M.Sc Data Science, IISc Bangalore',
    location: 'Hyderabad, India',
    projects: [
      'Customer churn prediction model achieving 98.2% accuracy',
      'Time-series demand forecasting for supply chain optimization',
      'A/B testing framework used across 6 product teams',
    ],
    semanticMatch: 91,
    skillMatch: 87,
    experienceMatch: 88,
    aiInsight:
      'Strong match across core data science competencies. Candidate excels in statistical modeling and the Python ecosystem. Lacks containerization experience but compensates with deep ML knowledge and strong research background from IISc.',
  },
  {
    id: '3',
    name: 'Aman Kumar',
    initials: 'AK',
    title: 'AI Engineer',
    match: 88,
    recommendation: 'Good Match',
    experience: '6 years',
    skills: ['Python', 'TensorFlow', 'Docker', 'SQL', 'Java', 'Spark', 'MLflow'],
    missingSkills: ['AWS', 'PyTorch'],
    education: 'B.Tech Computer Science, NIT Trichy',
    location: 'Pune, India',
    projects: [
      'Computer vision quality control pipeline for manufacturing (99.1% defect detection)',
      'MLOps infrastructure for model versioning and deployment',
      'Distributed training system across 32-GPU cluster',
    ],
    semanticMatch: 88,
    skillMatch: 84,
    experienceMatch: 92,
    aiInsight:
      'Well-rounded AI engineer with strong production experience. Above-average tenure at 6 years compensates for some skill gaps in modern cloud tooling. MLflow and MLOps experience is a strong differentiator for this role.',
  },
  {
    id: '4',
    name: 'Sneha Joshi',
    initials: 'SJ',
    title: 'ML Researcher',
    match: 84,
    recommendation: 'Good Match',
    experience: '3 years',
    skills: ['Python', 'PyTorch', 'Machine Learning', 'Research', 'CUDA', 'HuggingFace'],
    missingSkills: ['Docker', 'AWS', 'SQL'],
    education: 'PhD Computer Science, IIT Bombay',
    location: 'Mumbai, India',
    projects: [
      'Novel attention mechanism for long-context NLP (published at NeurIPS 2023)',
      'Federated learning framework for privacy-preserving model training',
      'Graph neural networks for molecular drug discovery',
    ],
    semanticMatch: 84,
    skillMatch: 79,
    experienceMatch: 76,
    aiInsight:
      'Exceptional academic credentials with strong research depth and a NeurIPS publication. Excellent theoretical foundation and cutting-edge ML knowledge. Production experience gaps may require onboarding investment but ceiling is very high.',
  },
  {
    id: '5',
    name: 'Rohan Mehta',
    initials: 'RM',
    title: 'Data Engineer',
    match: 81,
    recommendation: 'Good Match',
    experience: '5 years',
    skills: ['Python', 'SQL', 'Spark', 'Airflow', 'Docker', 'Kafka', 'dbt'],
    missingSkills: ['Machine Learning', 'TensorFlow', 'PyTorch'],
    education: 'B.E. Information Technology, BITS Pilani',
    location: 'Delhi, India',
    projects: [
      'Real-time data pipeline processing 1B+ events per day',
      'Data lake architecture on AWS reducing storage costs by 40%',
      'Automated ETL orchestration saving 120 engineering hours/month',
    ],
    semanticMatch: 81,
    skillMatch: 76,
    experienceMatch: 88,
    aiInsight:
      'Excellent data engineering skills with strong pipeline and infrastructure expertise. Primary gap is ML modeling experience. An ideal fit for the ML infrastructure layer; less suited for core modeling work.',
  },
  {
    id: '6',
    name: 'Ananya Singh',
    initials: 'AS',
    title: 'Software Engineer',
    match: 74,
    recommendation: 'Moderate Match',
    experience: '3 years',
    skills: ['Python', 'SQL', 'REST APIs', 'Git', 'FastAPI', 'PostgreSQL'],
    missingSkills: ['TensorFlow', 'Docker', 'Spark', 'Deep Learning', 'Scikit-learn'],
    education: 'B.Tech Computer Science, VIT Vellore',
    location: 'Chennai, India',
    projects: [
      'Backend services for internal ML model serving platform',
      'API gateway handling 50K requests/second',
      'Database query optimization reducing latency by 60%',
    ],
    semanticMatch: 74,
    skillMatch: 69,
    experienceMatch: 72,
    aiInsight:
      'Solid software engineering background with growing ML platform exposure. Missing several required technical ML skills. Better suited for ML platform engineering roles rather than core modeling work.',
  },
  {
    id: '7',
    name: 'Vikram Nair',
    initials: 'VN',
    title: 'Backend Engineer',
    match: 68,
    recommendation: 'Moderate Match',
    experience: '4 years',
    skills: ['Python', 'Docker', 'SQL', 'Node.js', 'MongoDB', 'Redis'],
    missingSkills: ['Machine Learning', 'TensorFlow', 'Spark', 'PyTorch', 'Statistics'],
    education: 'B.Tech Information Technology, Anna University',
    location: 'Bangalore, India',
    projects: [
      'Microservices architecture for a 2M-user fintech platform',
      'Container orchestration setup with CI/CD pipelines',
      'High-throughput REST APIs serving 100K concurrent users',
    ],
    semanticMatch: 68,
    skillMatch: 62,
    experienceMatch: 74,
    aiInsight:
      'Strong backend engineering skills but minimal AI/ML exposure. Docker and Python competency are positives. Significant upskilling would be needed for core ML responsibilities. Not recommended for this role.',
  },
  {
    id: '8',
    name: 'Divya Reddy',
    initials: 'DR',
    title: 'Data Analyst',
    match: 62,
    recommendation: 'Weak Match',
    experience: '2 years',
    skills: ['SQL', 'Python', 'Excel', 'Power BI', 'Tableau'],
    missingSkills: ['Machine Learning', 'TensorFlow', 'Docker', 'Spark', 'Statistics', 'PyTorch'],
    education: 'MBA Business Analytics, ISB Hyderabad',
    location: 'Hyderabad, India',
    projects: [
      'Sales analytics dashboard used by 200+ stakeholders',
      'Customer segmentation analysis informing $2M marketing spend',
      'Revenue forecasting model using Excel with 78% accuracy',
    ],
    semanticMatch: 62,
    skillMatch: 54,
    experienceMatch: 58,
    aiInsight:
      'Business analytics background with limited technical ML depth. Strong in data visualization and SQL but lacks the programming depth and ML framework experience required for a Senior ML Engineer role.',
  },
]

export const SKILLS_ANALYSIS: SkillCoverage[] = [
  { skill: 'Python', required: true, coverage: 95, missing: 2 },
  { skill: 'Machine Learning', required: true, coverage: 78, missing: 9 },
  { skill: 'SQL', required: true, coverage: 88, missing: 5 },
  { skill: 'TensorFlow', required: true, coverage: 62, missing: 16 },
  { skill: 'Docker', required: true, coverage: 71, missing: 12 },
  { skill: 'PyTorch', required: false, coverage: 55, missing: 19 },
  { skill: 'Spark', required: false, coverage: 48, missing: 22 },
  { skill: 'AWS', required: false, coverage: 38, missing: 26 },
  { skill: 'Kubernetes', required: false, coverage: 24, missing: 32 },
]

export const MATCH_DISTRIBUTION = [
  { range: '90–100%', count: 2, color: '#10B981' },
  { range: '80–89%', count: 3, color: '#10B981' },
  { range: '70–79%', count: 1, color: '#F59E0B' },
  { range: '60–69%', count: 2, color: '#F59E0B' },
  { range: 'Below 60%', count: 0, color: '#EF4444' },
]

export function getRecommendationColor(rec: Candidate['recommendation']): string {
  switch (rec) {
    case 'Strong Match': return '#10B981'
    case 'Good Match': return '#635BFF'
    case 'Moderate Match': return '#F59E0B'
    case 'Weak Match': return '#EF4444'
  }
}

export function getMatchColor(match: number): string {
  if (match >= 85) return '#10B981'
  if (match >= 70) return '#635BFF'
  if (match >= 60) return '#F59E0B'
  return '#EF4444'
}

export function getInitialsColor(initials: string): string {
  const colors = [
    '#635BFF', '#10B981', '#F59E0B', '#EF4444',
    '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6',
  ]
  const idx = (initials.charCodeAt(0) + initials.charCodeAt(1)) % colors.length
  return colors[idx]
}

import type { CandidateResponse } from '../utils/api'

export function convertToCandidate(response: CandidateResponse, analysisId?: string, jobRequirements?: { required: string[], preferred: string[] }): Candidate {
  const nameParts = response.name.split(' ')
  const initials = nameParts.length >= 2 
    ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
    : nameParts[0]?.substring(0, 2).toUpperCase() || '??'
  
  const experienceYears = response.entities?.experience_years || 0
  const experience = experienceYears > 0 ? `${experienceYears} years` : 'Not specified'
  
  const organizations = response.entities?.organizations || []
  const locations = response.entities?.locations || []
  
  // Better title extraction - filter out non-job titles from organizations
  const jobTitleKeywords = ['developer', 'engineer', 'manager', 'analyst', 'architect', 'consultant', 'lead', 'senior', 'junior', 'principal', 'director']
  const title = organizations.find(org => 
    jobTitleKeywords.some(keyword => org.toLowerCase().includes(keyword))
  ) || organizations[0] || 'Professional'
  
  // Better location extraction - filter out non-locations
  const locationKeywords = ['street', 'road', 'avenue', 'boulevard', 'lane', 'drive', 'court', 'place', 'way', 'st', 'rd', 'ave', 'blvd']
  const location = locations.find(loc => 
    locationKeywords.some(keyword => loc.toLowerCase().includes(keyword)) ||
    loc.match(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,\s*[A-Z]{2}$/) // City, State format
  ) || locations[0] || 'Not specified'
  
  // Use extracted education from backend
  const education = response.education || 'Not specified'
  
  // Use extracted projects from backend
  const projects = response.projects || []
  
  return {
    id: response.id,
    name: response.name,
    initials,
    title,
    match: response.overall_score,
    recommendation: response.recommendation as Candidate['recommendation'],
    experience,
    skills: response.skills,
    missingSkills: response.missing_skills,
    education,
    location,
    projects,
    semanticMatch: response.semantic_score,
    skillMatch: response.keyword_score,
    experienceMatch: response.experience_score,
    aiInsight: response.insight,
    email: response.email,
    filename: response.filename,
    analysisId,
    isShortlisted: response.is_shortlisted ?? false,
    shortlistSource: response.shortlist_source ?? 'automatic',
    emailSent: response.email_sent ?? false,
    experienceDetails: response.experience_details,
    jobRequirements,
    entities: response.entities,
  }
}
