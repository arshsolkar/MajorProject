import { apiClient } from '../../admin_frontend/src/lib/apiClient.js'

export interface JobRecord {
  id: string; title: string; department: string | null; location: string | null
  employment_type: string | null; work_mode: string | null; experience_level: string | null
  salary_range: string | null; openings: number; application_deadline: string | null
  priority: string | null; job_description: string; required_skills: string[]
  preferred_skills: string[]; minimum_experience_years: number | null
  education_requirement: string | null; status: 'draft' | 'open' | 'closed'
  shortlist_threshold: number
  created_at: string; updated_at: string; analysis_count: number
}

export interface AnalysisResponse {
  id: string; job_id: string | null; run_number: number | null; job_snapshot: Record<string, unknown> | null
  job_title: string | null; requirements: { required: string[]; preferred: string[]; all?: string[] } | string[]
  status: 'queued' | 'processing' | 'completed' | 'failed'; error: string | null
  created_at: string | null; completed_at: string | null; candidate_count: number; candidates: CandidateResponse[]
}
export interface CandidateResponse {
  id: string; name: string; email: string | null; filename: string; skills: string[]
  missing_skills: string[]; semantic_score: number; keyword_score: number; experience_score: number
  overall_score: number; recommendation: string; insight: string; is_shortlisted: boolean
  shortlist_source?: 'automatic' | 'manual'; email_sent: boolean
  entities: { emails: string[]; phones: string[]; experience_years: number; organizations: string[]; locations: string[] }
  projects: string[]; education: string | null; experience_details: any[]
}
export interface AnalysisStatusResponse {
  analysis_id: string; status: AnalysisResponse['status']; phase: string | null; current_stage: string | null
  total: number; completed: number; phase_completed: number; phase_total: number
  current_resume: { filename: string; candidate_name: string | null } | null
  completed_resumes: { id: string; filename: string; candidate_name: string; ats_score: number }[]
  started_at: string | null; current_resume_started_at: string | null; completed_at: string | null; error?: string | null
}
export type CreateAnalysisParams = { job_id: string; resumes: File[] }

export const getJobs = () => apiClient.get('/v1/jobs') as Promise<JobRecord[]>
export const createJob = (data: Record<string, unknown>) => apiClient.post('/v1/jobs', data) as Promise<JobRecord>
export const extractJobDescription = (file: File) => { const form=new FormData(); form.append('file',file); return apiClient.postForm('/v1/job-descriptions/extract',form) as Promise<{text:string;filename:string;pages:number}> }
export const updateJob = (id: string, data: Record<string, unknown>) => apiClient.patch(`/v1/jobs/${id}`, data) as Promise<JobRecord>
export const createAnalysis = (params: CreateAnalysisParams): Promise<AnalysisResponse> => {
  const form = new FormData(); form.append('job_id', params.job_id); params.resumes.forEach(file => form.append('resumes', file))
  return apiClient.postForm('/v1/analyses', form) as Promise<AnalysisResponse>
}
export const getAnalyses = () => apiClient.get('/v1/analyses?page_size=100') as Promise<AnalysisResponse[]>
export const getAnalysis = (id: string) => apiClient.get(`/v1/analyses/${id}`) as Promise<AnalysisResponse>
export const deleteAnalysis = (id: string) => apiClient.delete(`/v1/analyses/${id}`, {errorMessages:{409:'This analysis is still running. Wait for it to finish before deleting it.'}}) as Promise<{id:string;deleted:boolean;files_deleted:boolean}>
export const getAnalysisStatus = (id: string) => apiClient.get(`/v1/analyses/${id}/status`) as Promise<AnalysisStatusResponse>
export const downloadReport = async (id: string) => (await apiClient.download(`/v1/analyses/${id}/report.xlsx`)).blob
export const getCandidateResume = async (id: string) => (await apiClient.download(`/v1/candidates/${id}/resume`)).blob
export const updateCandidateShortlist = (id: string, value: boolean, notes?: string) => apiClient.post(`/v1/candidates/${id}/shortlist`, { is_shortlisted: value, notes }) as Promise<CandidateResponse>
export const updateJobShortlistThreshold = (jobId: string, threshold: number) => apiClient.patch(`/v1/jobs/${jobId}/shortlist-threshold`, { threshold }) as Promise<{job_id:string;threshold:number}>
export const bulkRemoveFromShortlist = (analysisId: string, candidateIds: string[]) => apiClient.post(`/v1/analyses/${analysisId}/shortlist/bulk-remove`, { candidate_ids: candidateIds }) as Promise<{updated_count:number;candidate_ids:string[]}>
export const bulkAddToShortlist = (analysisId: string, candidateIds: string[]) => apiClient.post(`/v1/analyses/${analysisId}/shortlist/bulk-add`, { candidate_ids: [...new Set(candidateIds)] }) as Promise<{updated_count:number;candidate_ids:string[]}>
export const exportAnalysisCandidates = async (analysisId: string, candidateIds: string[]) => (await (apiClient.download as unknown as (path: string, options: {method: string; data: {candidate_ids: string[]}}) => Promise<{blob: Blob}>)(`/v1/analyses/${analysisId}/candidates/export.xlsx`, { method:'POST', data:{candidate_ids:candidateIds} })).blob
export const downloadShortlistedReport = async (id: string) => (await apiClient.download(`/v1/analyses/${id}/shortlisted-report.xlsx`)).blob
export const sendEmailToCandidates = (ids?: string[], template = 'procedure', customSubject?:string, customBody?:string) => apiClient.post('/v1/candidates/send-email', {recipient_ids:ids,template_type:template,custom_subject:customSubject,custom_body:customBody}) as Promise<{success:boolean;message:string;sent_count:number;failed_count:number;skipped_count:number;errors?:{candidate_id?:string;candidate_name?:string;error:string;status?:'failed'|'skipped'}[]}>

export async function pollAnalysis(id: string, onUpdate: (analysis: AnalysisResponse) => void, interval = 2000): Promise<AnalysisResponse> {
  while (true) {
    const analysis = await getAnalysis(id); onUpdate(analysis)
    if (analysis.status === 'completed') return analysis
    if (analysis.status === 'failed') throw new Error(analysis.error || 'Analysis failed')
    await new Promise(resolve => setTimeout(resolve, interval))
  }
}
