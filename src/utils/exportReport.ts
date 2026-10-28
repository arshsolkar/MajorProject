import * as XLSX from 'xlsx'
import { CANDIDATES, SKILLS_ANALYSIS } from '../data/candidates'

export function generateExcelReport() {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Summary
  const summaryData = [
    ['Job Title', 'Senior Machine Learning Engineer'],
    ['Candidates Analyzed', CANDIDATES.length],
    ['Strong Matches', CANDIDATES.filter(c => c.match >= 85).length],
    ['Average Match Score', Math.round(CANDIDATES.reduce((sum, c) => sum + c.match, 0) / CANDIDATES.length)],
    ['Skills Identified', SKILLS_ANALYSIS.length],
    ['', ''],
    ['Generated Date', new Date().toLocaleDateString()],
  ]
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

  // Sheet 2: Candidate Ranking
  const rankingData = [
    ['Rank', 'Candidate', 'Match Score', 'Semantic Score', 'Skill Score', 'Experience Score', 'Recommendation'],
    ...CANDIDATES.map((c, idx) => [
      idx + 1,
      c.name,
      c.match,
      c.semanticMatch,
      c.skillMatch,
      c.experienceMatch,
      c.recommendation,
    ]),
  ]
  const rankingWs = XLSX.utils.aoa_to_sheet(rankingData)
  XLSX.utils.book_append_sheet(wb, rankingWs, 'Candidate Ranking')

  // Sheet 3: Skill Analysis
  const skillData = [
    ['Required Skill', 'Candidate Coverage', 'Missing Candidate Count'],
    ...SKILLS_ANALYSIS.map(s => [s.skill, `${s.coverage}%`, s.missing]),
  ]
  const skillWs = XLSX.utils.aoa_to_sheet(skillData)
  XLSX.utils.book_append_sheet(wb, skillWs, 'Skill Analysis')

  // Sheet 4: Candidate Details
  const detailsData = [
    ['Candidate', 'Education', 'Experience', 'Matching Skills', 'Missing Skills', 'Match Score', 'AI Recommendation'],
    ...CANDIDATES.map(c => [
      c.name,
      c.education,
      c.experience,
      c.skills.join(', '),
      c.missingSkills.join(', '),
      c.match,
      c.recommendation,
    ]),
  ]
  const detailsWs = XLSX.utils.aoa_to_sheet(detailsData)
  XLSX.utils.book_append_sheet(wb, detailsWs, 'Candidate Details')

  // Sheet 5: Job Analysis
  const jobAnalysisData = [
    ['Category', 'Items'],
    ['Extracted Requirements', '4+ years ML engineering, Python, TensorFlow/PyTorch, SQL, Docker, Kubernetes, AWS/GCP, ML pipeline development'],
    ['Required Skills', SKILLS_ANALYSIS.filter(s => s.required).map(s => s.skill).join(', ')],
    ['Preferred Skills', SKILLS_ANALYSIS.filter(s => !s.required).map(s => s.skill).join(', ')],
  ]
  const jobAnalysisWs = XLSX.utils.aoa_to_sheet(jobAnalysisData)
  XLSX.utils.book_append_sheet(wb, jobAnalysisWs, 'Job Analysis')

  // Generate and download
  XLSX.writeFile(wb, 'hiresense-ai-report.xlsx')
}
