import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, BriefcaseBusiness, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Filter, Mail, MoreVertical, Search, Settings, ShieldCheck, Star, Users, Zap } from 'lucide-react'
import type { AnalysisResponse } from '../utils/api'
import { exportAnalysisCandidates, getCandidateResume, sendEmailToCandidates } from '../utils/api'
import type { Candidate } from '../data/candidates'

interface ShortlistedCandidatesProps {
  candidates: Candidate[]
  currentAnalysisId?: string
  analyses: AnalysisResponse[]
  jobs: { id: string; title: string; status: string; shortlist_threshold: number }[]
  onSelectAnalysis: (id: string) => Promise<void>
  onSelectJob: (id: string) => Promise<void>
  onToggleShortlist: (id: string, value: boolean) => Promise<void>
  onBulkAdd: (analysisId: string, ids: string[]) => Promise<number>
  onBulkRemove: (analysisId: string, ids: string[]) => Promise<number>
  onThresholdChange: (jobId: string, threshold: number) => Promise<void>
  onRefreshAnalysis: (id: string) => Promise<void>
  onViewCandidate: (id: string) => void
}

type ShortlistFilter = 'all' | 'shortlisted' | 'not-shortlisted' | 'automatic' | 'manual' | 'manual-removed'
type SortOrder = 'score-desc' | 'score-asc' | 'name' | 'experience'
const PAGE_SIZE = 10

function experienceYears(candidate: Candidate): number | null {
  const value = candidate.entities?.experience_years
  if (typeof value === 'number' && value > 0) return value
  const match = candidate.experience.match(/[\d.]+/)
  return match ? Number(match[0]) : null
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function ShortlistedCandidates({ candidates, currentAnalysisId, analyses, jobs, onSelectAnalysis, onSelectJob, onToggleShortlist, onBulkAdd, onBulkRemove, onThresholdChange, onRefreshAnalysis, onViewCandidate }: ShortlistedCandidatesProps) {
  const currentAnalysis = analyses.find(item => item.id === currentAnalysisId)
  const [jobId, setJobId] = useState(currentAnalysis?.job_id || '')
  const [analysisId, setAnalysisId] = useState(currentAnalysisId || '')
  const [threshold, setThreshold] = useState(75)
  const [thresholdDraft, setThresholdDraft] = useState(75)
  const [thresholdBusy, setThresholdBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [minScore, setMinScore] = useState('')
  const [maxScore, setMaxScore] = useState('')
  const [statusFilter, setStatusFilter] = useState<ShortlistFilter>('all')
  const [skillFilters, setSkillFilters] = useState<string[]>([])
  const [experienceFilter, setExperienceFilter] = useState('any')
  const [educationFilter, setEducationFilter] = useState('')
  const [sort, setSort] = useState<SortOrder>('score-desc')
  const [page, setPage] = useState(1)
  const [busyAction, setBusyAction] = useState<'email' | 'shortlist' | 'export-selected' | 'export-filtered' | 'remove' | null>(null)
  const [emailDialog, setEmailDialog] = useState(false)
  const analysisChangeVersion = useRef(0)
  const [emailSubject, setEmailSubject] = useState('Next steps in your application')
  const [emailBody, setEmailBody] = useState('Hello,\n\nThank you for your interest. We would like to discuss the next steps with you. Please let us know your availability.\n\nBest regards,\nRecruitment Team')

  useEffect(() => {
    if (currentAnalysisId !== undefined) setAnalysisId(currentAnalysisId)
  }, [currentAnalysisId])
  useEffect(() => {
    setSelected(new Set())
    setPage(1)
    setQuery('')
    setMinScore('')
    setMaxScore('')
    setStatusFilter('all')
    setSkillFilters([])
    setExperienceFilter('any')
    setEducationFilter('')
    setSort('score-desc')
  }, [currentAnalysisId])
  useEffect(() => {
    const selectedAnalysis = analyses.find(item => item.id === analysisId) || currentAnalysis
    if (selectedAnalysis?.job_id) setJobId(selectedAnalysis.job_id)
  }, [analysisId, analyses, currentAnalysis])
  useEffect(() => {
    const saved = jobs.find(job => job.id === jobId)?.shortlist_threshold ?? 75
    setThreshold(saved)
    setThresholdDraft(saved)
  }, [jobId, jobs])

  const availableAnalyses = analyses.filter(item => item.job_id === jobId && item.status === 'completed')
  const allSkills = useMemo(() => [...new Set(candidates.flatMap(candidate => candidate.skills || []))].sort((a, b) => a.localeCompare(b)), [candidates])
  const educationOptions = useMemo(() => [...new Set(candidates.map(candidate => candidate.education).filter(value => value && value !== 'Not specified'))].sort(), [candidates])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    const rows = candidates.filter(candidate => {
      if (term && ![candidate.name, candidate.email || '', ...(candidate.skills || [])].join(' ').toLowerCase().includes(term)) return false
      if (minScore !== '' && candidate.match < Number(minScore)) return false
      if (maxScore !== '' && candidate.match > Number(maxScore)) return false
      const shortlisted = Boolean(candidate.isShortlisted)
      if (statusFilter === 'shortlisted' && !shortlisted) return false
      if (statusFilter === 'not-shortlisted' && shortlisted) return false
      if (statusFilter === 'automatic' && !(shortlisted && candidate.shortlistSource === 'automatic')) return false
      if (statusFilter === 'manual' && !(shortlisted && candidate.shortlistSource === 'manual')) return false
      if (statusFilter === 'manual-removed' && !( !shortlisted && candidate.shortlistSource === 'manual')) return false
      if (skillFilters.length && !skillFilters.every(skill => candidate.skills.includes(skill))) return false
      const years = experienceYears(candidate)
      if (experienceFilter === 'unknown' && years !== null) return false
      if (experienceFilter === '0-1' && (years === null || years > 1)) return false
      if (experienceFilter === '2-4' && (years === null || years < 2 || years > 4)) return false
      if (experienceFilter === '5+' && (years === null || years < 5)) return false
      if (educationFilter && !candidate.education.toLowerCase().includes(educationFilter.toLowerCase())) return false
      return true
    })
    return rows.sort((a, b) => sort === 'score-asc' ? a.match - b.match : sort === 'name' ? a.name.localeCompare(b.name) : sort === 'experience' ? (experienceYears(b) ?? -1) - (experienceYears(a) ?? -1) : b.match - a.match)
  }, [candidates, query, minScore, maxScore, statusFilter, skillFilters, experienceFilter, educationFilter, sort])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const shortlisted = candidates.filter(candidate => candidate.isShortlisted)
  const average = shortlisted.length ? Math.round(shortlisted.reduce((sum, candidate) => sum + candidate.match, 0) / shortlisted.length) : 0
  const selectedRows = candidates.filter(candidate => selected.has(candidate.id))
  const selectedWithValidEmail = selectedRows.filter(candidate => candidate.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate.email.trim()))
  const selectedShortlistedCount = selectedRows.filter(candidate => candidate.isShortlisted).length
  const allVisibleSelected = visible.length > 0 && visible.every(candidate => selected.has(candidate.id))
  const currentJob = jobs.find(job => job.id === jobId)

  const setPageSelected = (checked: boolean) => setSelected(previous => {
    const next = new Set(previous)
    visible.forEach(candidate => checked ? next.add(candidate.id) : next.delete(candidate.id))
    return next
  })
  const clearFilters = () => { setQuery(''); setMinScore(''); setMaxScore(''); setStatusFilter('all'); setSkillFilters([]); setExperienceFilter('any'); setEducationFilter(''); setSort('score-desc'); setPage(1) }
  const toggleSkill = (skill: string) => setSkillFilters(previous => previous.includes(skill) ? previous.filter(item => item !== skill) : [...previous, skill])

  const selectJob = async (nextJobId: string) => {
    setJobId(nextJobId); setSelected(new Set()); setPage(1)
    const latest = analyses.find(item => item.job_id === nextJobId && item.status === 'completed')
    setAnalysisId(latest?.id || '')
    if (latest) await onSelectJob(nextJobId)
    else await onSelectAnalysis('')
  }
  const selectAnalysis = async (nextAnalysisId: string) => {
    const requestVersion = ++analysisChangeVersion.current
    setAnalysisId(nextAnalysisId); setSelected(new Set()); setPage(1)
    if (nextAnalysisId) {
      try { await onSelectAnalysis(nextAnalysisId) }
      catch (error) {
        if (requestVersion === analysisChangeVersion.current) {
          setAnalysisId(currentAnalysisId || '')
          setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to load this analysis.' })
        }
      }
    }
  }

  const applyThreshold = async () => {
    if (!jobId || thresholdDraft < 0 || thresholdDraft > 100) return
    const accepted = window.confirm(`Save ${thresholdDraft}% as the automatic shortlist threshold for ${currentJob?.title || 'this job'}? This applies to future analyses only. Existing automatic recommendations and every manual shortlist decision in completed analyses will remain unchanged.`)
    if (!accepted) return
    setThresholdBusy(true); setFeedback(null)
    try { await onThresholdChange(jobId, thresholdDraft); setThreshold(thresholdDraft); setFeedback({ tone: 'success', text: `Threshold saved at ${thresholdDraft}%. Existing candidate decisions were preserved.` }) }
    catch (error) { setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to save the threshold.' }) }
    finally { setThresholdBusy(false) }
  }

  const exportCandidates = async (ids: string[], kind: 'selected' | 'filtered') => {
    if (!analysisId || !ids.length) return
    setBusyAction(kind === 'selected' ? 'export-selected' : 'export-filtered'); setFeedback(null)
    try { const blob = await exportAnalysisCandidates(analysisId, ids); saveBlob(blob, `hiresense-${kind}-candidates-${new Date().toISOString().slice(0, 10)}.xlsx`); setFeedback({ tone: 'success', text: `Exported ${ids.length} ${kind} candidates.` }) }
    catch (error) { setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to export candidates.' }) }
    finally { setBusyAction(null) }
  }
  const removeSelected = async () => {
    if (!analysisId || !selectedRows.length) return
    if (!selectedShortlistedCount) { setFeedback({ tone: 'error', text: 'None of the selected candidates are currently shortlisted.' }); return }
    if (!window.confirm(`Remove ${selectedShortlistedCount} shortlisted candidate${selectedShortlistedCount === 1 ? '' : 's'} from this analysis? This records a manual removal and keeps the candidate and resume.`)) return
    setBusyAction('remove'); setFeedback(null)
    try { const count = await onBulkRemove(analysisId, selectedRows.map(candidate => candidate.id)); setSelected(new Set()); setFeedback({ tone: 'success', text: `${count} candidate${count === 1 ? '' : 's'} removed from the shortlist.` }) }
    catch (error) { setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to update shortlist.' }) }
    finally { setBusyAction(null) }
  }
  const shortlistSelected = async () => {
    if (!analysisId || !selectedRows.length) return
    const toAdd = selectedRows.filter(candidate => !candidate.isShortlisted || candidate.shortlistSource !== 'manual')
    if (!toAdd.length) { setFeedback({ tone: 'success', text: 'All selected candidates already have a manual shortlist decision.' }); return }
    if (!window.confirm(`Manually shortlist ${toAdd.length} selected candidate${toAdd.length === 1 ? '' : 's'} in this analysis?`)) return
    setBusyAction('shortlist'); setFeedback(null)
    try { const count = await onBulkAdd(analysisId, toAdd.map(candidate => candidate.id)); setFeedback({ tone: 'success', text: `${count} candidate${count === 1 ? '' : 's'} manually shortlisted.` }) }
    catch (error) { setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to shortlist selected candidates.' }) }
    finally { setBusyAction(null) }
  }
  const openResume = async (candidate: Candidate) => {
    setFeedback(null)
    const resumeWindow = window.open('about:blank', '_blank')
    if (!resumeWindow) { setFeedback({ tone: 'error', text: 'Allow pop-ups to view the resume.' }); return }
    try { const blob = await getCandidateResume(candidate.id); const url = URL.createObjectURL(blob); resumeWindow.opener = null; resumeWindow.location.href = url; window.setTimeout(() => URL.revokeObjectURL(url), 60_000) }
    catch (error) { resumeWindow.close(); setFeedback({ tone: 'error', text: error instanceof Error ? error.message : `Resume unavailable for ${candidate.name}.` }) }
  }
  const sendEmail = async () => {
    if (!selectedRows.length || !emailSubject.trim() || !emailBody.trim()) return
    setBusyAction('email'); setFeedback(null)
    try {
      const result = await sendEmailToCandidates(selectedRows.map(candidate => candidate.id), 'custom', emailSubject.trim(), emailBody.trim())
      if (analysisId) await onRefreshAnalysis(analysisId)
      const deliveryErrors = result.errors?.map(item => `${item.candidate_name || item.candidate_id || 'Recipient'}: ${item.error}`).join(' · ')
      const outcome = `${result.sent_count} sent · ${result.failed_count} failed · ${result.skipped_count ?? Math.max(0, selectedRows.length - result.sent_count - result.failed_count)} skipped.`
      setFeedback({ tone: result.failed_count || !result.sent_count ? 'error' : 'success', text: `${result.message} ${outcome}${deliveryErrors ? ` ${deliveryErrors}` : ''}` })
      setEmailDialog(false)
    } catch (error) { setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to send selected-candidate email.' }) }
    finally { setBusyAction(null) }
  }

  return (
    <div className="space-y-4 text-slate-800">
      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_minmax(430px,560px)] lg:items-center sm:p-6">
        <div><span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700"><span className="size-1.5 rounded-full bg-violet-500"/>AI-Powered Shortlisting</span><h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Shortlisted Candidates</h1><p className="mt-1 text-sm text-slate-500">Review, manage and take action on the best matching candidates.</p></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center"><span className="grid size-9 place-items-center rounded-lg bg-violet-100 text-violet-600"><BriefcaseBusiness className="size-4"/></span><div className="min-w-0"><label htmlFor="shortlist-job" className="mb-1 block text-[11px] font-semibold text-slate-500">Current job</label><select id="shortlist-job" value={jobId} onChange={event => void selectJob(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"><option value="">Select a job</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}</select></div><span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${currentJob?.status.toLowerCase() === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{currentJob?.status.toLowerCase() === 'open' ? 'Active' : currentJob?.status || 'No job'}</span></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"><div><label htmlFor="shortlist-analysis" className="mb-1 block text-[11px] font-semibold text-slate-500">Analysis batch</label><select id="shortlist-analysis" value={analysisId} onChange={event => void selectAnalysis(event.target.value)} disabled={!availableAnalyses.length} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"><option value="">{availableAnalyses.length ? 'Choose analysis batch' : 'No completed analysis for this job'}</option>{availableAnalyses.map(item => <option key={item.id} value={item.id}>{item.run_number == null ? 'Run unavailable' : `Run ${item.run_number}`} · {item.created_at ? new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Kolkata',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(item.created_at)) : 'Time unavailable'} · {item.candidate_count} candidates</option>)}</select></div><p className="text-xs text-slate-500 sm:pb-2">{shortlisted.length} shortlisted · {candidates.length} candidates · {average}% average match</p></div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric icon={ShieldCheck} value={candidates.length} label="Total Candidates" detail={currentAnalysis ? 'From current analysis' : 'Choose an analysis'} tone="violet"/>
        <Metric icon={Users} value={shortlisted.length} label="Shortlisted Candidates" detail="Above threshold / selected" tone="blue"/>
        <Metric icon={Star} value={`${average}%`} label="Average Match Score" detail="Of shortlisted candidates" tone="amber"/>
        <Metric icon={FileText} value={candidates.filter(candidate => Boolean(candidate.filename)).length} label="Resumes Available" detail="Download or view" tone="blue"/>
        <Metric icon={Mail} value={candidates.filter(candidate => candidate.emailSent).length} label="Emails Sent" detail="For this analysis" tone="red"/>
      </section>

      <section className="grid items-stretch gap-3 xl:grid-cols-[minmax(260px,.9fr)_minmax(360px,1.45fr)_250px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3"><span className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-600"><Settings className="size-4"/></span><div><h2 className="text-sm font-semibold text-slate-900">Shortlisting Threshold</h2><p className="mt-1 text-xs text-slate-500">Minimum score for automatic recommendations</p></div></div>
          <div className="mt-4 flex items-center gap-2"><input type="range" min="0" max="100" value={thresholdDraft} onChange={event => setThresholdDraft(Number(event.target.value))} disabled={!jobId || thresholdBusy} className="min-w-0 flex-1 accent-violet-600" aria-label="Automatic shortlisting threshold"/><input type="number" min="0" max="100" value={thresholdDraft} onChange={event => setThresholdDraft(Math.min(100, Math.max(0, Number(event.target.value))))} disabled={!jobId || thresholdBusy} className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" aria-label="Threshold percent"/><span className="text-sm text-slate-500">%</span></div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400"><span>Saved: {threshold}%</span><button type="button" onClick={() => void applyThreshold()} disabled={!jobId || thresholdBusy || thresholdDraft === threshold} className="rounded-lg bg-violet-600 px-3 py-2 font-semibold text-white transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 disabled:cursor-not-allowed disabled:bg-slate-300">{thresholdBusy ? 'Saving…' : 'Apply'}</button></div>
          <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-[11px] leading-4 text-slate-500">Candidates scored at or above this value are automatically shortlisted in future analyses. Manual shortlist and removal decisions are preserved.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-600"><Filter className="size-4"/></span><h2 className="text-sm font-semibold text-slate-900">Filters</h2></div><button type="button" onClick={clearFilters} className="text-xs font-semibold text-blue-600 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Clear all</button></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs text-slate-500 sm:col-span-2"><span className="mb-1 block">Search candidate</span><span className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5"><Search className="size-4 shrink-0 text-slate-400"/><input value={query} onChange={event => {setQuery(event.target.value);setPage(1)}} placeholder="Name, email, or skills…" className="min-w-0 flex-1 py-2 text-xs text-slate-700 outline-none"/></span></label>
            <label className="text-xs text-slate-500"><span className="mb-1 block">Min score</span><input type="number" min="0" max="100" value={minScore} onChange={event => {setMinScore(event.target.value);setPage(1)}} placeholder="0" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"/></label>
            <label className="text-xs text-slate-500"><span className="mb-1 block">Max score</span><input type="number" min="0" max="100" value={maxScore} onChange={event => {setMaxScore(event.target.value);setPage(1)}} placeholder="100" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"/></label>
            <label className="text-xs text-slate-500"><span className="mb-1 block">Shortlist status</span><select value={statusFilter} onChange={event => {setStatusFilter(event.target.value as ShortlistFilter);setPage(1)}} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"><option value="all">All candidates</option><option value="shortlisted">Shortlisted</option><option value="not-shortlisted">Not shortlisted</option><option value="automatic">Auto shortlisted</option><option value="manual">Manually shortlisted</option><option value="manual-removed">Manually removed</option></select></label>
            <label className="text-xs text-slate-500"><span className="mb-1 block">Experience</span><select value={experienceFilter} onChange={event => {setExperienceFilter(event.target.value);setPage(1)}} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"><option value="any">Any experience</option><option value="unknown">Unknown</option><option value="0-1">0–1 years</option><option value="2-4">2–4 years</option><option value="5+">5+ years</option></select></label>
            <label className="text-xs text-slate-500"><span className="mb-1 block">Education</span><select value={educationFilter} onChange={event => {setEducationFilter(event.target.value);setPage(1)}} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"><option value="">Any education</option>{educationOptions.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="text-xs text-slate-500"><span className="mb-1 block">Sort by</span><select value={sort} onChange={event => setSort(event.target.value as SortOrder)} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"><option value="score-desc">Score (high to low)</option><option value="score-asc">Score (low to high)</option><option value="name">Candidate name</option><option value="experience">Experience</option></select></label>
          </div>
          {allSkills.length > 0 && <details className="mt-2"><summary className="cursor-pointer text-xs font-medium text-slate-500">Skills{skillFilters.length ? ` (${skillFilters.length} selected)` : ''}</summary><div className="mt-2 flex max-h-20 flex-wrap gap-1 overflow-y-auto">{allSkills.map(skill => <button key={skill} type="button" aria-pressed={skillFilters.includes(skill)} onClick={() => {toggleSkill(skill);setPage(1)}} className={`rounded-full border px-2 py-1 text-[11px] ${skillFilters.includes(skill) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}>{skill}</button>)}</div></details>}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-violet-50 text-violet-600"><Zap className="size-4"/></span><h2 className="text-sm font-semibold text-slate-900">Quick Actions</h2></div>
          <div className="mt-3 grid gap-2">
            <button type="button" onClick={() => void shortlistSelected()} disabled={!selectedRows.length || Boolean(busyAction) || !analysisId} className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 disabled:cursor-not-allowed disabled:opacity-45"><Star className="size-4"/>{busyAction === 'shortlist' ? 'Shortlisting…' : `Shortlist Selected (${selectedRows.length})`}</button>
            <button type="button" onClick={() => setEmailDialog(true)} disabled={!selectedRows.length || !selectedWithValidEmail.length || Boolean(busyAction)} title={!selectedRows.length ? 'Select candidates first.' : !selectedWithValidEmail.length ? 'Selected candidates have no valid email addresses.' : undefined} className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-45"><Mail className="size-4 text-blue-600"/>Send Email to Selected ({selectedRows.length})</button>
            {!selectedRows.length && <p className="text-center text-[11px] text-slate-400">Select candidates to enable shortlist and email actions.</p>}
            {selectedRows.length > 0 && !selectedWithValidEmail.length && <p className="text-center text-[11px] text-amber-700">No selected candidate has a valid email address.</p>}
            <button type="button" onClick={() => void exportCandidates(selectedRows.map(candidate => candidate.id), 'selected')} disabled={!selectedRows.length || Boolean(busyAction) || !analysisId} className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-45"><FileSpreadsheet className="size-4 text-emerald-600"/>{busyAction === 'export-selected' ? 'Exporting…' : `Export Selected (${selectedRows.length})`}</button>
            <button type="button" onClick={() => void exportCandidates(filtered.map(candidate => candidate.id), 'filtered')} disabled={!filtered.length || Boolean(busyAction) || !analysisId} className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-45"><FileSpreadsheet className="size-4 text-emerald-600"/>{busyAction === 'export-filtered' ? 'Exporting…' : `Export Filtered to Excel (${filtered.length})`}</button>
            <button type="button" onClick={() => void removeSelected()} disabled={!selectedShortlistedCount || Boolean(busyAction) || !analysisId} className="flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-45">{busyAction === 'remove' ? 'Updating…' : `Remove from Shortlist (${selectedShortlistedCount})`}</button>
          </div>
        </div>
      </section>

      {feedback && <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-2.5 text-sm ${feedback.tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{feedback.text}</p>}
      {!currentAnalysis && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><AlertCircle className="mx-auto size-8 text-slate-400"/><h2 className="mt-3 font-semibold text-slate-800">No completed analysis selected</h2><p className="mt-1 text-sm text-slate-500">Choose another job or run resume analysis to manage candidates here.</p></div>}
      {currentAnalysis && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><h2 className="text-sm font-semibold text-slate-900">Candidates ({filtered.length})</h2><p className="mt-1 text-xs text-slate-500">Showing {filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} matching · {selected.size} selected across filters and pages</p></div><div className="flex items-center gap-2"><span className="text-xs text-slate-500">Page {page} of {pageCount}</span><button type="button" aria-label="Previous page" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="size-4"/></button><span className="grid size-8 place-items-center rounded-lg bg-violet-100 text-sm font-semibold text-violet-700">{page}</span><button type="button" aria-label="Next page" onClick={() => setPage(value => Math.min(pageCount, value + 1))} disabled={page >= pageCount} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="size-4"/></button></div></div>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-xs"><button type="button" onClick={() => setPageSelected(true)} disabled={!visible.length} className="font-semibold text-blue-700 hover:underline disabled:opacity-40">Select this page</button>{pageCount > 1 && <button type="button" onClick={() => {if(window.confirm(`Select all ${filtered.length} candidates matching the current filters across ${pageCount} pages?`))setSelected(new Set(filtered.map(candidate => candidate.id)))}} className="font-semibold text-blue-700 hover:underline">Select all {filtered.length} matching</button>}<button type="button" onClick={() => setSelected(new Set())} disabled={!selected.size} className="text-slate-500 hover:underline disabled:opacity-40">Clear selection</button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1060px] border-collapse text-left text-xs"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3"><input type="checkbox" aria-label="Select candidates on this page" checked={allVisibleSelected} onChange={event => setPageSelected(event.target.checked)} className="size-4 accent-blue-600"/></th><th className="px-2 py-3">#</th><th className="px-3 py-3">Candidate</th><th className="px-3 py-3">Match score</th><th className="px-3 py-3">Key skills</th><th className="px-3 py-3">Experience</th><th className="px-3 py-3">Education</th><th className="px-3 py-3">Shortlist status</th><th className="px-3 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{visible.map((candidate, index) => <tr key={candidate.id} className={selected.has(candidate.id) ? 'bg-blue-50/40' : 'hover:bg-slate-50/70'}><td className="px-4 py-3"><input type="checkbox" aria-label={`Select ${candidate.name}`} checked={selected.has(candidate.id)} onChange={() => setSelected(previous => {const next=new Set(previous);next.has(candidate.id)?next.delete(candidate.id):next.add(candidate.id);return next})} className="size-4 accent-blue-600"/></td><td className="px-2 py-3 text-slate-500">{(page - 1) * PAGE_SIZE + index + 1}</td><td className="px-3 py-3"><div className="flex items-center gap-2.5"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 font-semibold text-slate-600">{candidate.initials}</span><span className="min-w-0"><button type="button" onClick={() => onViewCandidate(candidate.id)} className="block max-w-48 truncate text-left font-semibold text-slate-900 hover:text-blue-700">{candidate.name}</button><span className="block max-w-48 truncate text-[11px] text-slate-500">{candidate.email || 'Email unavailable'}</span></span></div></td><td className="px-3 py-3"><div className="w-28"><div className="font-semibold text-slate-800">{candidate.match}%</div><div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className={`h-full rounded-full ${candidate.match >= 85 ? 'bg-emerald-400' : candidate.match >= 70 ? 'bg-violet-500' : 'bg-amber-400'}`} style={{width:`${Math.max(0,Math.min(100,candidate.match))}%`}}/></div></div></td><td className="px-3 py-3"><div className="flex max-w-56 flex-wrap gap-1">{candidate.skills.slice(0,3).map(skill => <span key={skill} className="rounded-md bg-blue-50 px-1.5 py-1 text-[10px] text-blue-700">{skill}</span>)}{candidate.skills.length>3&&<span className="rounded-md bg-slate-100 px-1.5 py-1 text-[10px] text-slate-600">+{candidate.skills.length-3}</span>}</div></td><td className="px-3 py-3 text-slate-600">{candidate.experience || 'Unknown'}</td><td className="max-w-40 px-3 py-3 text-slate-600"><span className="line-clamp-2">{candidate.education || 'Not specified'}</span></td><td className="px-3 py-3">{candidate.isShortlisted ? <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${candidate.shortlistSource === 'manual' ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700'}`}><Star className="size-3 fill-current"/>{candidate.shortlistSource === 'manual' ? 'Manual' : 'Auto'}</span> : candidate.shortlistSource === 'manual' ? <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-medium text-rose-700">Manually removed</span> : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-500">Not shortlisted</span>}</td><td className="px-3 py-3"><div className="flex items-center gap-1.5"><button type="button" onClick={() => void openResume(candidate)} disabled={!candidate.filename} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><FileText className="size-3.5 text-blue-600"/>View Resume</button><details className="relative"><summary className="grid size-8 cursor-pointer list-none place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><MoreVertical className="size-4"/></summary><div className="absolute right-0 z-10 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"><button type="button" onClick={() => onViewCandidate(candidate.id)} className="w-full rounded-lg px-2.5 py-2 text-left hover:bg-slate-50">View candidate details</button><button type="button" onClick={() => void onToggleShortlist(candidate.id, !candidate.isShortlisted).then(() => setFeedback({tone:'success',text:`${candidate.name} ${candidate.isShortlisted ? 'removed from' : 'added to'} shortlist.`})).catch(error => setFeedback({tone:'error',text:error instanceof Error?error.message:'Unable to update shortlist.'}))} className="w-full rounded-lg px-2.5 py-2 text-left hover:bg-slate-50">{candidate.isShortlisted ? 'Remove from shortlist' : 'Add to shortlist'}</button></div></details></div></td></tr>)}</tbody></table>{filtered.length===0&&<div className="p-10 text-center text-sm text-slate-500">No candidates match these filters.</div>}</div>
      </section>}

      {emailDialog && <div role="dialog" aria-modal="true" aria-labelledby="shortlist-email-title" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-start justify-between gap-3"><div><h2 id="shortlist-email-title" className="text-lg font-semibold text-slate-900">Review email recipients</h2><p className="mt-1 text-sm text-slate-500">Sending to {selectedWithValidEmail.length} selected candidate{selectedWithValidEmail.length===1?'':'s'} with valid email addresses.</p></div><button type="button" onClick={() => setEmailDialog(false)} aria-label="Close email dialog" className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">×</button></div><div className="mt-3 max-h-24 overflow-y-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{selectedWithValidEmail.map(candidate => <div key={candidate.id}>{candidate.name} · {candidate.email}</div>)}{selectedRows.length>selectedWithValidEmail.length&&<div className="mt-1 text-amber-700">{selectedRows.length-selectedWithValidEmail.length} selected candidate(s) have no valid email and will be skipped.</div>}</div><label className="mt-4 block text-sm font-medium text-slate-700">Subject<input value={emailSubject} onChange={event => setEmailSubject(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></label><label className="mt-3 block text-sm font-medium text-slate-700">Message<textarea rows={6} value={emailBody} onChange={event => setEmailBody(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></label><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setEmailDialog(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium">Cancel</button><button type="button" onClick={() => void sendEmail()} disabled={busyAction==='email'||!emailSubject.trim()||!emailBody.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{busyAction==='email'?'Sending…':'Confirm and send'}</button></div></div></div>}
    </div>
  )
}

function Metric({ icon: Icon, value, label, detail, tone }: { icon: typeof Users; value: string | number; label: string; detail: string; tone: 'violet'|'blue'|'amber'|'red' }) {
  const color = { violet:'bg-violet-50 text-violet-600', blue:'bg-blue-50 text-blue-600', amber:'bg-amber-50 text-amber-600', red:'bg-red-50 text-red-500' }[tone]
  return <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><span className={`grid size-11 shrink-0 place-items-center rounded-xl ${color}`}><Icon className="size-5"/></span><div className="min-w-0"><div className="text-xl font-bold leading-tight text-slate-900">{value}</div><div className="truncate text-xs font-medium text-slate-700">{label}</div><div className="truncate text-[11px] text-slate-400">{detail}</div></div></div>
}
