import { useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BriefcaseBusiness, Building2, ClipboardCheck, FileSearch, MapPin, Pencil, Plus, Trash2, UserCircle, Users, X } from 'lucide-react'
import Sidebar, { type SidebarTab } from './components/Sidebar'
import TopBar from './components/TopBar'
import NewAnalysis from './screens/NewAnalysis'
import AiScanning from './screens/AiScanning'
import Overview from './screens/Overview'
import CandidateAnalysis from './screens/CandidateAnalysis'
import ShortlistedCandidates from './screens/ShortlistedCandidates'
import EmailPage from './screens/EmailPage'
import { createAnalysis, deleteAnalysis, downloadReport, getAnalysis, getAnalyses, getJobs, createJob, updateJob, updateCandidateShortlist, bulkAddToShortlist, bulkRemoveFromShortlist, updateJobShortlistThreshold, getCandidateResume, type AnalysisResponse, type JobRecord } from './utils/api'
import { formatAnalysisTimestamp, sortAnalysisHistory } from './utils/analysisHistory'
import { convertToCandidate } from './data/candidates'
import AdminApp from '../admin_frontend/src/App.jsx'
import { useAuth } from '../admin_frontend/src/auth/AuthContext.jsx'

type Screen = 'dashboard' | 'analysis' | 'create-job' | 'scanning' | 'overview' | 'candidate' | 'shortlisted' | 'email' | 'profile'

type JobOpening = {
  id: string
  title: string
  department: string
  location: string
  type: string
  workMode: string
  experienceLevel: string
  salaryRange: string
  openings: string
  deadline: string
  priority: string
  skills: string
  description: string
  status: string
  shortlist_threshold: number
  createdAt: string
}

const asOpening = (j: JobRecord): JobOpening => ({ id:j.id,title:j.title,department:j.department||'',location:j.location||'',type:j.employment_type||'',workMode:j.work_mode||'',experienceLevel:j.experience_level||'',salaryRange:j.salary_range||'',openings:String(j.openings),deadline:j.application_deadline||'',priority:j.priority||'Medium',skills:(j.required_skills||[]).join(', '),description:j.job_description,status:j.status[0].toUpperCase()+j.status.slice(1),shortlist_threshold:j.shortlist_threshold??75,createdAt:j.created_at.slice(0,10) })
const formFromJob = (job: JobOpening) => ({title:job.title,department:job.department,location:job.location,type:job.type||'Full time',workMode:job.workMode||'Hybrid',experienceLevel:job.experienceLevel,salaryRange:job.salaryRange,openings:job.openings,deadline:job.deadline,priority:job.priority,skills:job.skills,description:job.description})

function JobCard({job,onEdit,onStatusChange}:{job:JobOpening;onEdit:()=>void;onStatusChange:(id:string,status:'open'|'closed')=>Promise<void>}) {
  const [busy,setBusy]=useState(false)
  const [feedback,setFeedback]=useState<{kind:'success'|'error';text:string}|null>(null)
  const isOpen=job.status.toLowerCase()==='open'
  const metadata=[job.department,job.location,job.type,job.workMode].filter(Boolean)
  const details=[job.experienceLevel&&['Experience',job.experienceLevel],job.salaryRange&&['Salary',job.salaryRange],job.openings&&['Openings',`${job.openings} ${Number(job.openings)===1?'position':'positions'}`],job.deadline&&['Apply by',job.deadline]].filter(Boolean) as string[][]
  const changeStatus=async()=>{
    const next=isOpen?'closed':'open'
    const prompt=isOpen?`Close “${job.title}”? New analyses will be blocked until it is reopened.`:`Reopen “${job.title}”? Recruiters will be able to start new analyses.`
    if(!window.confirm(prompt))return
    setBusy(true);setFeedback(null)
    try{await onStatusChange(job.id,next);setFeedback({kind:'success',text:`Job ${next==='open'?'reopened':'closed'}.`})}
    catch(error){setFeedback({kind:'error',text:error instanceof Error?error.message:'Could not update job status.'})}
    finally{setBusy(false)}
  }
  return <article className="panel flex h-full flex-col p-5 shadow-sm transition-shadow hover:shadow-panel">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0"><h4 className="text-base font-semibold text-ink">{job.title}</h4>{metadata.length>0&&<p className="mt-1 text-sm text-slate-500">{metadata.join(' · ')}</p>}</div>
      <span className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${isOpen?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-600'}`}>{isOpen?'Open':'Closed'}</span>
    </div>
    {details.length>0&&<dl className="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2">{details.map(([label,value])=><div key={label}><dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-0.5 text-sm text-slate-700">{value}</dd></div>)}</dl>}
    {job.skills&&<p className="mt-4 text-sm text-slate-600"><span className="font-medium text-slate-700">Required skills:</span> {job.skills}</p>}
    {job.description&&<p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">{job.description}</p>}
    <div className="mt-auto flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between sm:pt-5">
      <span className="text-xs text-slate-400">{job.priority?`${job.priority} priority`:''}</span>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onEdit} className="btn-secondary" disabled={busy}><Pencil className="size-4"/>Edit job</button>
        <button type="button" onClick={()=>void changeStatus()} className={isOpen?'btn-danger':'btn-secondary'} disabled={busy}>{busy?'Saving…':isOpen?'Close job':'Reopen job'}</button>
      </div>
    </div>
    {feedback&&<p role={feedback.kind==='error'?'alert':'status'} className={`mt-3 rounded-lg px-3 py-2 text-xs ${feedback.kind==='error'?'bg-red-50 text-red-700':'bg-emerald-50 text-emerald-700'}`}>{feedback.text}</p>}
  </article>
}

function RecruiterDashboardApp() {
  const { user, logout } = useAuth() as {user?:{id:string;full_name?:string;role?:string;phone?:string;is_approved?:boolean}|null;logout:()=>void}
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [candidateReturnScreen, setCandidateReturnScreen] = useState<Screen>('overview')
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('dashboard')
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('')
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResponse | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [jobOpenings, setJobOpenings] = useState<JobOpening[]>([])
  const [history, setHistory] = useState<AnalysisResponse[]>([])
  const [loadError, setLoadError] = useState('')
  const [jobNotice,setJobNotice]=useState('')
  const [editingJobId, setEditingJobId] = useState<string>()
  const [analysisPendingDelete, setAnalysisPendingDelete] = useState<AnalysisResponse | null>(null)
  const [deletingAnalysisId, setDeletingAnalysisId] = useState<string | null>(null)
  const [analysisHistoryMessage, setAnalysisHistoryMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const analysisSelectionVersion = useRef(0)
  const selectedAnalysisStorageKey = user?.id ? `hiresense:selected-analysis:${user.id}` : ''

  const rememberAnalysis = (id: string) => {
    if (!selectedAnalysisStorageKey) return
    if (id) window.localStorage.setItem(selectedAnalysisStorageKey, id)
    else window.localStorage.removeItem(selectedAnalysisStorageKey)
  }

  const refreshRecords = async () => {
    try { const [jobs, analyses] = await Promise.all([getJobs(), getAnalyses()]); const ordered = sortAnalysisHistory(analyses); setJobOpenings(jobs.map(asOpening)); setHistory(ordered); return ordered }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Unable to load recruiter records'); return [] }
  }
  useEffect(() => {
    let active=true
    void refreshRecords().then(async items=>{
      if(!active||!items.length)return
      const rememberedId = selectedAnalysisStorageKey ? window.localStorage.getItem(selectedAnalysisStorageKey) : null
      const restoreVersion = analysisSelectionVersion.current
      const selectedId = rememberedId || items[0].id
      try {
        let restored: AnalysisResponse
        try { restored = await getAnalysis(selectedId) }
        catch (savedError) {
          if (!rememberedId || selectedId === items[0].id) throw savedError
          restored = await getAnalysis(items[0].id)
          rememberAnalysis(restored.id)
        }
        if(!active || restoreVersion !== analysisSelectionVersion.current)return
        rememberAnalysis(restored.id)
        setCurrentAnalysis(restored)
        if(restored.status==='queued'||restored.status==='processing')setScreen('scanning')
      }
      catch(error) { if(active)setLoadError(error instanceof Error?error.message:'Unable to restore the selected analysis') }
    })
    return ()=>{active=false}
  }, [user?.id])

  const selectedCandidate = currentAnalysis?.candidates.find((c) => c.id === selectedCandidateId)
  const rawReqs = currentAnalysis?.requirements
  const jobRequirements: { required: string[]; preferred: string[] } = Array.isArray(rawReqs)
    ? { required: rawReqs, preferred: [] }
    : rawReqs || { required: [], preferred: [] }
  const candidates = currentAnalysis?.candidates.map(c => convertToCandidate(c, currentAnalysis.id, jobRequirements)) || []

  const handleAnalyze = async (jobId: string, jobDescription: string, files: File[]): Promise<boolean> => {
    try {
      setAnalysisError(null)
      const job = jobOpenings.find(opening => opening.id === jobId)
      if (!job) throw new Error('Select a valid open job before starting analysis.')
      if (job.description.trim() !== jobDescription.trim()) {
        const confirmed = window.confirm('This description differs from the saved job description. Replace the saved description and use it for this analysis?')
        if (!confirmed) return false
        await updateJob(jobId, { job_description: jobDescription.trim() })
        await refreshRecords()
      }
      setUploadedFiles(files)
      const analysis = await createAnalysis({
        job_id: jobId,
        resumes: files,
      })
      setCurrentAnalysis(analysis)
      rememberAnalysis(analysis.id)
      await refreshRecords()
      setScreen('scanning')
      return true
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to start analysis')
    }
  }

  const handleScanComplete = (completedAnalysis: AnalysisResponse) => {
    setCurrentAnalysis(completedAnalysis)
    setScreen('overview')
  }

  const handleNewAnalysis = () => {
    setCurrentAnalysis(null)
    setAnalysisError(null)
    setSelectedCandidateId('')
    setSidebarTab('analysis')
    setScreen('analysis')
  }

  const handleCreateJob = () => {
    setEditingJobId(undefined)
    setJobNotice('')
    setSidebarTab('jobs')
    setScreen('create-job')
  }

  const handleEditJob = (id:string) => { setJobNotice(''); setEditingJobId(id); setSidebarTab('jobs'); setScreen('create-job') }

  const handleSaveJob = async (job: Omit<JobOpening, 'id' | 'createdAt' | 'status' | 'shortlist_threshold'>, id?:string) => {
    const payload={title:job.title,department:job.department,location:job.location,employment_type:job.type,work_mode:job.workMode,experience_level:job.experienceLevel,salary_range:job.salaryRange,openings:Number(job.openings),application_deadline:job.deadline||null,priority:job.priority,required_skills:job.skills.split(',').map(x=>x.trim()).filter(Boolean),job_description:job.description}
    try { if(id) await updateJob(id,payload); else await createJob({...payload,status:'open'}); setEditingJobId(undefined); setLoadError(''); setJobNotice(id?'Job updated successfully.':'Job created successfully.'); const savedJobs=await getJobs(); setJobOpenings(savedJobs.map(asOpening)); await refreshRecords(); setSidebarTab('dashboard'); setScreen('dashboard') }
    catch(error) { const message=error instanceof Error?error.message:'Unable to save job'; setLoadError(message); throw new Error(message) }
  }

  const handleJobStatusChange = async (id:string,status:'open'|'closed') => { try { await updateJob(id,{status}); setLoadError(''); const savedJobs=await getJobs(); setJobOpenings(savedJobs.map(asOpening)); await refreshRecords() } catch(error) { const message=error instanceof Error?error.message:'Unable to update job status'; setLoadError(message); throw new Error(message) } }

  const handleToggleShortlist = async (candidateId: string, value: boolean) => {
    const analysisId = currentAnalysis?.id
    const selectionVersion = analysisSelectionVersion.current
    try {
      await updateCandidateShortlist(candidateId,value)
      if (analysisId) {
        const updated = await getAnalysis(analysisId)
        if (selectionVersion === analysisSelectionVersion.current) setCurrentAnalysis(updated)
      }
      await refreshRecords()
    }
    catch(error) { setLoadError(error instanceof Error?error.message:'Unable to update shortlist'); throw error }
  }

  const loadSelectedAnalysis = async (id: string) => {
    const requestVersion = ++analysisSelectionVersion.current
    if (!id) { setCurrentAnalysis(null); setSelectedCandidateId(''); rememberAnalysis(''); return null }
    setLoadError('')
    try {
      const [item, jobs, analyses] = await Promise.all([getAnalysis(id), getJobs(), getAnalyses()])
      if (requestVersion !== analysisSelectionVersion.current) return null
      setCurrentAnalysis(item)
      setSelectedCandidateId('')
      rememberAnalysis(id)
      setJobOpenings(jobs.map(asOpening))
      setHistory(sortAnalysisHistory(analyses))
      return item
    } catch (error) {
      if (requestVersion === analysisSelectionVersion.current) setLoadError(error instanceof Error ? error.message : 'Unable to load analysis')
      throw error
    }
  }

  const handleShortlistAnalysisChange = async (id: string) => { await loadSelectedAnalysis(id) }

  const handleShortlistJobChange = async (jobId: string) => {
    const latest = history.find(item => item.job_id === jobId && item.status === 'completed')
    await loadSelectedAnalysis(latest?.id || '')
  }

  const handleBulkAddShortlisted = async (analysisId: string, ids: string[]) => {
    const selectionVersion = analysisSelectionVersion.current
    const result = await bulkAddToShortlist(analysisId, ids)
    const updated = await getAnalysis(analysisId)
    if (selectionVersion === analysisSelectionVersion.current) setCurrentAnalysis(updated)
    await refreshRecords()
    return result.updated_count
  }

  const handleBulkRemoveShortlisted = async (analysisId: string, ids: string[]) => {
    const selectionVersion = analysisSelectionVersion.current
    const result = await bulkRemoveFromShortlist(analysisId, ids)
    const updated = await getAnalysis(analysisId)
    if (selectionVersion === analysisSelectionVersion.current) setCurrentAnalysis(updated)
    await refreshRecords()
    return result.updated_count
  }

  const handleShortlistThreshold = async (jobId: string, threshold: number) => {
    await updateJobShortlistThreshold(jobId, threshold)
    setJobOpenings(previous => previous.map(job => job.id === jobId ? { ...job, shortlist_threshold: threshold } : job))
    try { const jobs = await getJobs(); setJobOpenings(jobs.map(asOpening)) } catch { /* The threshold write already succeeded; keep the confirmed value visible. */ }
  }

  const handleRefreshShortlistAnalysis = async (analysisId: string) => {
    const selectionVersion = analysisSelectionVersion.current
    const updated = await getAnalysis(analysisId)
    if (selectionVersion === analysisSelectionVersion.current) setCurrentAnalysis(updated)
    await refreshRecords()
  }

  const handleSelectAnalysis = async (id: string) => {
    try {
      await loadSelectedAnalysis(id)
    } catch { /* loadSelectedAnalysis reports the error without changing the current page. */ }
  }

  const handleDeleteAnalysis = async () => {
    if (!analysisPendingDelete || deletingAnalysisId) return
    const target = analysisPendingDelete
    const deletionSelectionVersion = analysisSelectionVersion.current
    setDeletingAnalysisId(target.id)
    setAnalysisHistoryMessage(null)
    try {
      const result = await deleteAnalysis(target.id)
      setAnalysisPendingDelete(null)
      setHistory(previous => previous.filter(item => item.id !== target.id))

      let remaining: AnalysisResponse[] = []
      let refreshFailed = false
      let refreshError: string | null = null
      let fallbackError: string | null = null
      try {
        const [jobs, analyses] = await Promise.all([getJobs(), getAnalyses()])
        remaining = sortAnalysisHistory(analyses)
        setJobOpenings(jobs.map(asOpening))
        setHistory(remaining)
      } catch (error) {
        refreshFailed = true
        refreshError = error instanceof Error ? error.message : 'Please refresh the page.'
      }

      if (currentAnalysis?.id === target.id && deletionSelectionVersion === analysisSelectionVersion.current) {
        const fallbackSelectionVersion = ++analysisSelectionVersion.current
        setCurrentAnalysis(null)
        setSelectedCandidateId('')
        rememberAnalysis('')
        if (screen === 'candidate' || screen === 'scanning') setScreen('overview')
        if (remaining.length) {
          try {
            if (fallbackSelectionVersion !== analysisSelectionVersion.current) throw new Error('The selected analysis changed while history refreshed.')
            const fallback = await loadSelectedAnalysis(remaining[0].id)
            if (!fallback) throw new Error('The selected analysis changed before the fallback loaded.')
            if (fallback.status === 'queued' || fallback.status === 'processing') setScreen('scanning')
          } catch (error) {
            fallbackError = error instanceof Error ? error.message : 'Please select the newest remaining batch again from history.'
          }
        } else if (!refreshFailed) {
          rememberAnalysis('')
        }
      }

      if (refreshError) {
        setAnalysisHistoryMessage({ tone: 'error', text: `Analysis deleted, but the refreshed history could not be loaded. ${refreshError}` })
      } else if (fallbackError) {
        setAnalysisHistoryMessage({ tone: 'error', text: `Analysis deleted, but the newest remaining batch could not be loaded. ${fallbackError}` })
      } else if (!refreshFailed) {
        setAnalysisHistoryMessage({
          tone: 'success',
          text: result.files_deleted ? 'Analysis and its stored resumes were permanently deleted.' : 'Analysis was deleted, but its stored resume files could not be fully removed. Contact an administrator.',
        })
      }
    } catch (error) {
      setAnalysisHistoryMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to delete this analysis. It remains in history.' })
    } finally {
      setDeletingAnalysisId(null)
    }
  }

  const handleSelectCandidate = (id: string) => {
    setCandidateReturnScreen(screen === 'shortlisted' ? 'shortlisted' : 'overview')
    setSelectedCandidateId(id)
    setScreen('candidate')
  }

  const handleSidebarTabChange = (tab: SidebarTab) => {
    setSidebarTab(tab)
    if (tab === 'dashboard') {
      setScreen('dashboard')
    } else if (tab === 'overview') {
      setScreen('overview')
    } else if (tab === 'analysis') {
      setScreen('analysis')
    } else if (tab === 'jobs') {
      setScreen('create-job')
    } else if (tab === 'shortlisted') {
      setScreen('shortlisted')
    } else if (tab === 'email') {
      setScreen('email')
    } else if (tab === 'profile') {
      setScreen('profile')
    } else {
      setScreen('overview')
    }
  }

  const handleBack = () => setScreen(candidateReturnScreen)

  const handleExportReport = async () => {
    if (!currentAnalysis) return
    try {
      const blob = await downloadReport(currentAnalysis.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hiresense-ai-${currentAnalysis.id}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download report:', error)
    }
  }

  if (screen === 'scanning') {
    return (
      <AiScanning
        analysisId={currentAnalysis?.id || ''}
        uploadedFiles={uploadedFiles}
        onComplete={handleScanComplete}
        onError={(error) => {
          setAnalysisError(error)
          setScreen('analysis')
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        activeTab={sidebarTab}
        onTabChange={handleSidebarTabChange}
        onNewAnalysis={handleNewAnalysis}
        onCreateJob={handleCreateJob}
        onLogout={logout}
        userName={user?.full_name}
      />
      <div className="min-h-screen pl-72">
        <TopBar
          title={
            screen === 'dashboard'
              ? 'Recruiter dashboard'
              : screen === 'analysis'
                ? 'Resume analysis'
                : screen === 'shortlisted'
                  ? 'Shortlisted Candidates'
                : screen === 'create-job'
                  ? 'Create job opening'
              : screen === 'profile'
                    ? 'Profile'
                    : screen === 'overview'
                      ? 'Recruitment overview'
                    : 'Candidate workspace'
          }
          onNewAnalysis={handleNewAnalysis}
          onCreateJob={handleCreateJob}
          onLogout={logout}
        />
        <main className="mx-auto max-w-[1600px] p-8">
          {jobNotice&&<p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{jobNotice}</p>}
          {screen === 'dashboard' && (
            <RecruiterHome
              jobs={jobOpenings}
              candidateCount={candidates.length}
              shortlistedCount={candidates.filter((candidate) => candidate.isShortlisted).length}
              hasAnalysis={Boolean(currentAnalysis)}
              onNewAnalysis={handleNewAnalysis}
              onCreateJob={handleCreateJob}
              onEditJob={handleEditJob}
              onStatusChange={handleJobStatusChange}
              onViewCandidates={() => {
                setSidebarTab('candidates')
                setScreen('overview')
              }}
            />
          )}
          {screen === 'analysis' && (
            <div className="min-h-full bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
              <NewAnalysis jobs={jobOpenings} onAnalyze={handleAnalyze} />
              {analysisError && <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{analysisError}</p>}
            </div>
          )}
          {screen === 'create-job' && (
            <CreateJobOpening jobs={jobOpenings} onSave={handleSaveJob} onStartAnalysis={handleNewAnalysis} onStatusChange={handleJobStatusChange} initialEditingJobId={editingJobId} onCancelEdit={()=>setEditingJobId(undefined)} />
          )}
          {screen === 'overview' && (
            <Overview
              activeTab={sidebarTab}
              candidates={candidates}
              onSelectCandidate={handleSelectCandidate}
              currentAnalysis={currentAnalysis}
              onExportReport={handleExportReport}
              onToggleShortlist={handleToggleShortlist}
            />
          )}
          {screen === 'candidate' && selectedCandidate && currentAnalysis && (
            <CandidateAnalysis
              candidate={convertToCandidate(selectedCandidate, currentAnalysis.id, jobRequirements)}
              onBack={handleBack}
              onToggleShortlist={handleToggleShortlist}
            />
          )}
          {screen === 'shortlisted' && (
            <ShortlistedCandidates
              candidates={candidates}
              currentAnalysisId={currentAnalysis?.id || ''}
              analyses={history}
              jobs={jobOpenings}
              onSelectAnalysis={handleShortlistAnalysisChange}
              onSelectJob={handleShortlistJobChange}
              onToggleShortlist={handleToggleShortlist}
              onBulkAdd={handleBulkAddShortlisted}
              onBulkRemove={handleBulkRemoveShortlisted}
              onThresholdChange={handleShortlistThreshold}
              onRefreshAnalysis={handleRefreshShortlistAnalysis}
              onViewCandidate={handleSelectCandidate}
            />
          )}
          {screen === 'email' && (
            <EmailPage />
          )}
          {screen === 'profile' && (
            <ProfilePage user={user} jobs={jobOpenings} candidateCount={candidates.length} shortlistedCount={candidates.filter((candidate) => candidate.isShortlisted).length} />
          )}
          {loadError && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{loadError}</p>}
          {(history.length > 0 || analysisHistoryMessage) && <section className="mt-6 panel p-5">
            <h2 className="font-semibold">Analysis history · newest first (IST)</h2>
            {analysisHistoryMessage && <p role={analysisHistoryMessage.tone === 'error' ? 'alert' : 'status'} className={`mt-3 rounded-lg px-3 py-2 text-sm ${analysisHistoryMessage.tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{analysisHistoryMessage.text}</p>}
            {history.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{history.map(item=>{
              return <article key={item.id} className={`flex min-w-0 items-stretch gap-2 rounded-xl border p-2 ${currentAnalysis?.id===item.id?'border-violet-300 bg-violet-50':'border-slate-200 bg-white'}`}>
                <button type="button" aria-current={currentAnalysis?.id===item.id?'true':undefined} className="min-w-0 flex-1 rounded-lg p-1 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500" onClick={()=>void handleSelectAnalysis(item.id)}>
                  <span className="block truncate font-medium">{item.job_title||'Job'} · {item.status}</span>
                  <span className="mt-1 block text-xs text-slate-500">{item.run_number == null ? 'Run unavailable' : `Run ${item.run_number}`} · {formatAnalysisTimestamp(item.created_at)} · {item.candidate_count} candidates</span>
                </button>
                <button type="button" aria-label="Delete analysis" title="Delete analysis" disabled={Boolean(deletingAnalysisId)} onClick={()=>{setAnalysisHistoryMessage(null);setAnalysisPendingDelete(item)}} className="grid size-9 shrink-0 place-items-center self-start rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-50">
                  {deletingAnalysisId===item.id ? <span className="text-[10px]">…</span> : <Trash2 className="size-4"/>}
                </button>
              </article>
            })}</div> : <p className="mt-3 text-sm text-slate-500">No analysis batches remain.</p>}
          </section>}
          {analysisPendingDelete && <div role="alertdialog" aria-modal="true" aria-labelledby="delete-analysis-title" aria-describedby="delete-analysis-description" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div><h2 id="delete-analysis-title" className="text-lg font-semibold text-slate-900">Delete analysis permanently?</h2><p className="mt-1 text-sm text-slate-600">{analysisPendingDelete.job_title || 'Untitled job'} · {analysisPendingDelete.status}</p><p className="mt-1 text-xs text-slate-500">{formatAnalysisTimestamp(analysisPendingDelete.created_at)} · {analysisPendingDelete.candidate_count} candidates</p></div>
                <button type="button" aria-label="Cancel deletion" disabled={Boolean(deletingAnalysisId)} onClick={()=>setAnalysisPendingDelete(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="size-4"/></button>
              </div>
              <p id="delete-analysis-description" className="mt-4 rounded-lg bg-red-50 p-3 text-sm leading-5 text-red-800">This permanently deletes the analysis, its candidate scores and shortlist decisions, and its stored resumes. This cannot be undone. The job and its other analysis batches will remain.</p>
              <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={Boolean(deletingAnalysisId)} onClick={()=>setAnalysisPendingDelete(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button><button type="button" onClick={()=>void handleDeleteAnalysis()} disabled={Boolean(deletingAnalysisId)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-50">{deletingAnalysisId ? 'Deleting…' : 'Permanently delete'}</button></div>
            </div>
          </div>}
        </main>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, detail }: { icon: any; label: string; value: string | number; detail: string }) {
  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{value}</p>
          <p className="mt-2 text-xs text-slate-500">{detail}</p>
        </div>
        <div className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  )
}

function RecruiterHome({ jobs, candidateCount, shortlistedCount, hasAnalysis, onNewAnalysis, onCreateJob, onViewCandidates, onEditJob, onStatusChange }: {
  jobs: JobOpening[]
  candidateCount: number
  shortlistedCount: number
  hasAnalysis: boolean
  onNewAnalysis: () => void
  onCreateJob: () => void
  onViewCandidates: () => void
  onEditJob: (id:string)=>void
  onStatusChange: (id:string,status:'open'|'closed')=>Promise<void>
}) {
  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-brand-600">Recruiter workspace</p>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Dashboard</h2>
          <p className="mt-1.5 text-sm text-slate-500">Manage job openings, start AI resume analysis, and track shortlisted candidates.</p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onCreateJob} className="btn-secondary"><Plus className="size-4" />Create job opening</button>
          <button type="button" onClick={onNewAnalysis} className="btn-primary"><FileSearch className="size-4" />Start analysis</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={BriefcaseBusiness} label="Open jobs" value={jobs.filter((job) => job.status === 'Open').length} detail={`${jobs.length} total job records`} />
        <StatCard icon={FileSearch} label="Analysis" value={hasAnalysis ? 'Ready' : 'Not started'} detail="Resume analysis is available from this dashboard" />
        <StatCard icon={Users} label="Candidates" value={candidateCount} detail="From the latest analysis batch" />
        <StatCard icon={ClipboardCheck} label="Shortlisted" value={shortlistedCount} detail="Candidates marked for next steps" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h3 className="font-semibold text-ink">Job openings</h3>
              <p className="mt-1 text-sm text-slate-500">Create an opening before running analysis for the role.</p>
            </div>
            <button type="button" onClick={onCreateJob} className="btn-secondary"><Plus className="size-4" />New job</button>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            {jobs.map((job) => <JobCard key={job.id} job={job} onEdit={()=>onEditJob(job.id)} onStatusChange={onStatusChange} />)}
            {jobs.length===0&&<p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 sm:col-span-2">No job openings yet. Create a job to begin.</p>}
          </div>
        </section>

        <section className="panel p-5">
          <h3 className="font-semibold text-ink">Next actions</h3>
          <div className="mt-4 grid gap-3">
            <button type="button" onClick={onNewAnalysis} className="flex items-center justify-between rounded-xl border border-slate-200 p-4 text-left transition hover:bg-slate-50">
              <span><span className="block font-semibold text-ink">Run resume analysis</span><span className="mt-1 block text-sm text-slate-500">Upload a JD and candidate resumes.</span></span>
              <FileSearch className="size-5 text-brand-600" />
            </button>
            <button type="button" onClick={onViewCandidates} className="flex items-center justify-between rounded-xl border border-slate-200 p-4 text-left transition hover:bg-slate-50">
              <span><span className="block font-semibold text-ink">Review candidates</span><span className="mt-1 block text-sm text-slate-500">Open rankings from latest analysis.</span></span>
              <Users className="size-5 text-brand-600" />
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

function CreateJobOpening({ jobs, onSave, onStartAnalysis, onStatusChange, initialEditingJobId, onCancelEdit }: { jobs: JobOpening[]; onSave: (job: Omit<JobOpening, 'id' | 'createdAt' | 'status' | 'shortlist_threshold'>, id?:string) => Promise<void>; onStartAnalysis: () => void; onStatusChange: (id:string,status:'open'|'closed')=>Promise<void>; initialEditingJobId?:string; onCancelEdit:()=>void }) {
  const [editingId, setEditingId] = useState<string|undefined>(initialEditingJobId)
  const [saving,setSaving]=useState(false)
  const [formError,setFormError]=useState('')
  const [formNotice,setFormNotice]=useState('')
  const [form, setForm] = useState({
    title: '',
    department: '',
    location: '',
    type: 'Full time',
    workMode: 'Hybrid',
    experienceLevel: '',
    salaryRange: '',
    openings: '1',
    deadline: '',
    priority: 'Medium',
    skills: '',
    description: '',
  })
  const canSave = form.title.trim().length>=2 && form.department.trim() && form.location.trim() && form.description.trim().length>=20 && !saving

  useEffect(()=>{
    if(!initialEditingJobId)return
    const job=jobs.find(item=>item.id===initialEditingJobId)
    if(job){setEditingId(job.id);setForm(formFromJob(job))}
  },[initialEditingJobId,jobs])

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <form
        className="panel p-6"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!canSave) return
          setSaving(true);setFormError('');setFormNotice('')
          try { await onSave({
            title: form.title.trim(),
            department: form.department.trim(),
            location: form.location.trim(),
            type: form.type,
            workMode: form.workMode,
            experienceLevel: form.experienceLevel.trim() || 'Not specified',
            salaryRange: form.salaryRange.trim(),
            openings: form.openings.trim() || '1',
            deadline: form.deadline,
            priority: form.priority,
            skills: form.skills.trim(),
            description: form.description.trim(),
          }, editingId);setFormNotice(editingId?'Job updated.':'Job created.') }
          catch(error){setFormError(error instanceof Error?error.message:'Unable to save this job.')}
          finally{setSaving(false)}
        }}
      >
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-brand-600">Job opening</p>
        <h2 className="text-xl font-semibold text-ink">{editingId?'Edit job opening':'Create job opening'}</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Job title</span><input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Software Engineer" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Department</span><input className="input" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} placeholder="Engineering" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Location</span><input className="input" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Mumbai" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Employment type</span><select className="input" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>Full time</option><option>Internship</option><option>Contract</option><option>Part time</option></select></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Work mode</span><select className="input" value={form.workMode} onChange={(event) => setForm({ ...form, workMode: event.target.value })}><option>Hybrid</option><option>On site</option><option>Remote</option></select></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Experience level</span><input className="input" value={form.experienceLevel} onChange={(event) => setForm({ ...form, experienceLevel: event.target.value })} placeholder="2-4 years" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Salary range</span><input className="input" value={form.salaryRange} onChange={(event) => setForm({ ...form, salaryRange: event.target.value })} placeholder="8-12 LPA" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Openings</span><input className="input" type="number" min="1" value={form.openings} onChange={(event) => setForm({ ...form, openings: event.target.value })} /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Application deadline</span><input className="input" type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Priority</span><select className="input" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option>High</option><option>Medium</option><option>Low</option></select></label>
          <label className="block md:col-span-2"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Required skills</span><input className="input" value={form.skills} onChange={(event) => setForm({ ...form, skills: event.target.value })} placeholder="Python, React, SQL" /></label>
          <label className="block md:col-span-2"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Role description</span><textarea className="input min-h-28 resize-none" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Responsibilities, team context, and must-have requirements." /></label>
        </div>
        {formError&&<p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
        {formNotice&&<p role="status" className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{formNotice}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {editingId&&<button type="button" onClick={()=>{setEditingId(undefined);setForm({title:'',department:'',location:'',type:'Full time',workMode:'Hybrid',experienceLevel:'',salaryRange:'',openings:'1',deadline:'',priority:'Medium',skills:'',description:''});setFormError('');setFormNotice('');onCancelEdit()}} className="btn-secondary" disabled={saving}>Cancel edit</button>}
          <button type="button" onClick={onStartAnalysis} className="btn-secondary"><FileSearch className="size-4" />Go to analysis</button>
          <button type="submit" disabled={!canSave} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"><Plus className="size-4" />{saving?'Saving…':editingId?'Save changes':'Create opening'}</button>
        </div>
      </form>

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h3 className="font-semibold text-ink">Job openings</h3>
          <p className="mt-1 text-sm text-slate-500">Persisted jobs available to your recruiter account.</p>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">{jobs.map(job=><JobCard key={job.id} job={job} onEdit={()=>{setEditingId(job.id);setForm(formFromJob(job));setFormError('');setFormNotice('');onCancelEdit()}} onStatusChange={onStatusChange}/>) }{jobs.length===0&&<p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 sm:col-span-2">No persisted jobs yet. Create an opening to get started.</p>}</div>
      </section>
    </div>
  )
}

function ProfilePage({ user, jobs, candidateCount, shortlistedCount }: { user: any; jobs: JobOpening[]; candidateCount: number; shortlistedCount: number }) {
  const initials = (user?.full_name || 'Recruiter')
    .split(' ')
    .map((part: string) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <section className="panel p-6">
        <div className="flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-2xl bg-brand-500 text-xl font-bold text-white">{initials}</div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-600">Recruiter profile</p>
            <h2 className="mt-1 truncate text-2xl font-semibold text-ink">{user?.full_name || 'Recruiter'}</h2>
            <p className="mt-1 text-sm text-slate-500">{user?.email || 'No email available'}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-3">
          <ProfileRow icon={Building2} label="Company" value={user?.company_name || 'Not configured'} />
          <ProfileRow icon={UserCircle} label="Designation" value={user?.designation || 'Recruiter'} />
          <ProfileRow icon={MapPin} label="Location" value={user?.company_address || 'Not configured'} />
        </div>
      </section>

      <section className="panel p-6">
        <h3 className="font-semibold text-ink">Workspace summary</h3>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <StatCard icon={BriefcaseBusiness} label="Jobs managed" value={jobs.length} detail={`${jobs.filter((job) => job.status === 'Open').length} open roles`} />
          <StatCard icon={Users} label="Candidates" value={candidateCount} detail="Latest analysis batch" />
          <StatCard icon={ClipboardCheck} label="Shortlisted" value={shortlistedCount} detail="Ready for outreach" />
        </div>
        <div className="mt-6 rounded-2xl border border-slate-200 p-5">
          <h4 className="font-semibold text-ink">Account details</h4>
          <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
            <div><span className="block text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Module</span>{user?.module || 'recruiter'}</div>
            <div><span className="block text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Role</span>{user?.role || 'recruiter'}</div>
            <div><span className="block text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Phone</span>{user?.phone || 'Not added'}</div>
            <div><span className="block text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Status</span>{user?.is_approved ? 'Approved' : 'Pending approval'}</div>
          </div>
        </div>
      </section>
    </div>
  )
}

function ProfileRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
      <div className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon className="size-5" /></div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-ink">{value}</p>
      </div>
    </div>
  )
}

export default function App() {
  const [searchParams] = useSearchParams()
  const resumeCandidateId = searchParams.get('resume')

  if (resumeCandidateId) return <ResumeAccessPage candidateIdOverride={resumeCandidateId} />

  return (
    <Routes>
      <Route path="/dashboard/resume/:candidateId" element={<ResumeAccessPage />} />
      <Route path="/dashboard" element={<RecruiterDashboardApp />} />
      <Route path="/*" element={<AdminApp />} />
    </Routes>
  )
}

function ResumeAccessPage({ candidateIdOverride }: { candidateIdOverride?: string } = {}) {
  const { candidateId: routeCandidateId } = useParams()
  const candidateId = candidateIdOverride || routeCandidateId
  const navigate = useNavigate()
  const { user, isInitializing } = useAuth() as { user?: { id: string } | null; isInitializing?: boolean }
  const [resumeUrl, setResumeUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user || !candidateId) return
    let active = true
    void getCandidateResume(candidateId).then(blob => {
      if (active) setResumeUrl(URL.createObjectURL(blob))
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to open this resume.')
    })
    return () => { active = false }
  }, [candidateId, user])
  useEffect(() => () => { if (resumeUrl) URL.revokeObjectURL(resumeUrl) }, [resumeUrl])

  if (isInitializing) return <main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">Checking your HireSense session…</main>
  if (!user) return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><section className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm"><h1 className="text-lg font-semibold text-slate-900">Sign in to view this resume</h1><p className="mt-2 text-sm leading-6 text-slate-500">This resume link is protected. Sign in with an authorized HireSense recruiter or admin account, then reopen the workbook link.</p><button type="button" onClick={() => navigate('/login')} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Go to sign in</button></section></main>
  return <main className="flex min-h-screen flex-col bg-slate-100"><header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3"><div><h1 className="font-semibold text-slate-900">Candidate resume</h1><p className="text-xs text-slate-500">Protected HireSense document</p></div><button type="button" onClick={() => navigate('/dashboard')} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Recruiter dashboard</button></header>{error ? <section role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</section> : resumeUrl ? <iframe title={`Resume ${candidateId}`} src={resumeUrl} className="min-h-0 flex-1"/> : <div className="grid flex-1 place-items-center text-sm text-slate-500">Loading resume…</div>}</main>
}
