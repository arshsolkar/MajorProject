import { apiClient } from './apiClient'

export const getDashboardOverview = () => apiClient.get('/admin/dashboard')
export const getRecruitmentJobs = () => apiClient.get('/v1/jobs')
export const getJobAnalyses = (jobId) => apiClient.get(`/v1/jobs/${jobId}/analyses`)
export const getRecruitmentAnalysis = (analysisId) => apiClient.get(`/v1/analyses/${analysisId}`)
const withQuery = (path, params = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value !== undefined))
  return `${path}${query.size ? `?${query}` : ''}`
}
export const getRecruiters = (params = {}) => apiClient.get(withQuery('/admin/recruiters', params))
export const getRecruiter = (recruiterId) => apiClient.get(`/admin/recruiters/${recruiterId}`)
export const getRecruiterVerificationDocument = (recruiterId) => apiClient.download(
  `/admin/recruiters/${recruiterId}/verification-document`,
)
export const updateRecruiterValidation = (recruiterId, isVerified) => (
  apiClient.patch(`/admin/recruiters/${recruiterId}/validation`, { is_verified: isVerified })
)
export const getNotices = (params = {}) => apiClient.get(withQuery('/admin/notices', params))
export const getNotice = (noticeId) => apiClient.get(`/admin/notices/${noticeId}`)
export const createNotice = (data) => apiClient.post('/admin/notices', data)
export const updateNotice = (noticeId, data) => apiClient.patch(`/admin/notices/${noticeId}`, data)
export const publishNotice = (noticeId) => apiClient.patch(`/admin/notices/${noticeId}/publish`, {})
export const deleteNotice = (noticeId) => apiClient.delete(`/admin/notices/${noticeId}`)
export const getStudents = (params = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value !== undefined))
  return apiClient.get(`/admin/students${query.size ? `?${query}` : ''}`)
}
export const getStudent = (studentId) => apiClient.get(`/admin/students/${studentId}`)
export const createStudent = (data) => apiClient.post('/admin/students', data)
export const updateStudent = (studentId, data) => apiClient.patch(`/admin/students/${studentId}`, data)
export const getCompanies = (params = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value !== undefined))
  return apiClient.get(`/admin/companies${query.size ? `?${query}` : ''}`)
}
export const getCompany = (companyId) => apiClient.get(`/admin/companies/${companyId}`)
export const createCompany = (data) => apiClient.post('/admin/companies', data)
export const updateCompany = (companyId, data) => apiClient.patch(`/admin/companies/${companyId}`, data)
export const getEligibility = (params = {}) => { const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value !== undefined)); return apiClient.get(`/admin/eligibility${query.size ? `?${query}` : ''}`) }
export const getEligibilityRecord = (recordId) => apiClient.get(`/admin/eligibility/records/${recordId}`)
export const getEligibilityOptions = () => apiClient.get('/admin/eligibility/form-options')
export const createEligibility = (data) => apiClient.post('/admin/eligibility', data)
export const updateEligibility = (recordId, data) => apiClient.patch(`/admin/eligibility/${recordId}`, data)
export const getAnalytics = () => apiClient.get('/admin/analytics')
export const downloadOverallReport = () => apiClient.download('/admin/analytics/report')
export const getNotifications = (params = {}) => apiClient.get(withQuery('/admin/notifications', params))
export const createNotification = (data) => apiClient.post('/admin/notifications', data)
