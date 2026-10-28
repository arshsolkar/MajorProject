import { useCallback, useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent } from 'react'
import { extractJobDescription } from '../utils/api'

interface UploadedFile {
  name: string
  size: number
  id: string
  file: File
}

interface JobOption {
  id: string
  title: string
  job_description?: string
  description?: string
  status?: string
}

interface NewAnalysisProps {
  jobs: JobOption[]
  onAnalyze: (jobId: string, jobDescription: string, files: File[]) => Promise<boolean>
}

const MAX_RESUMES = 60
const MAX_FILE_SIZE = 5 * 1024 * 1024

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function NewAnalysis({ onAnalyze, jobs }: NewAnalysisProps) {
  const openJobs = jobs.filter(job => !job.status || job.status.toLowerCase() === 'open')
  const [jobId, setJobId] = useState('')
  const [jdText, setJdText] = useState('')
  const [jdMode, setJdMode] = useState<'paste' | 'pdf'>('paste')
  const [jdPdfFile, setJdPdfFile] = useState<File | null>(null)
  const [isExtractingJd, setIsExtractingJd] = useState(false)
  const [jdExtractionError, setJdExtractionError] = useState<string | null>(null)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [invalidFilesCount, setInvalidFilesCount] = useState(0)
  const [duplicateFilesCount, setDuplicateFilesCount] = useState(0)
  const [fileError, setFileError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const jdFileInputRef = useRef<HTMLInputElement>(null)
  const jdRequestCounter = useRef(0)
  const selectedJob = openJobs.find(job => job.id === jobId)
  const savedJobDescription = selectedJob?.job_description ?? selectedJob?.description ?? ''

  const addFiles = useCallback((newFileList: FileList | null) => {
    if (!newFileList) return
    const knownNames = new Set(files.map(file => file.name.toLowerCase()))
    const accepted: UploadedFile[] = []
    let invalid = 0
    let duplicates = 0
    let overLimit = 0

    for (const file of Array.from(newFileList)) {
      if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf') || file.size > MAX_FILE_SIZE) {
        invalid++
        continue
      }
      const normalizedName = file.name.toLowerCase()
      if (knownNames.has(normalizedName)) {
        duplicates++
        continue
      }
      if (files.length + accepted.length >= MAX_RESUMES) {
        overLimit++
        continue
      }
      knownNames.add(normalizedName)
      accepted.push({ name: file.name, size: file.size, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file })
    }

    if (accepted.length) setFiles(previous => [...previous, ...accepted])
    setInvalidFilesCount(previous => previous + invalid)
    setDuplicateFilesCount(previous => previous + duplicates)
    setFileError(overLimit ? `A batch can contain at most ${MAX_RESUMES} resumes.` : '')
  }, [files])

  const handleJdPdfSelected = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf')) {
      setJdExtractionError('Choose a PDF job description.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setJdExtractionError('The job-description PDF must be 5 MB or smaller.')
      return
    }
    const requestId = ++jdRequestCounter.current
    setJdPdfFile(file)
    setIsExtractingJd(true)
    setJdExtractionError(null)
    try {
      const result = await extractJobDescription(file)
      if (requestId !== jdRequestCounter.current) return
      setJdText(result.text)
    } catch (error) {
      if (requestId !== jdRequestCounter.current) return
      setJdExtractionError(error instanceof Error ? error.message : 'Unable to extract text from this PDF.')
    } finally {
      if (requestId === jdRequestCounter.current) setIsExtractingJd(false)
    }
  }

  const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false)
  }, [])

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
    addFiles(event.dataTransfer.files)
  }, [addFiles])

  const removeFile = (id: string) => {
    setFiles(previous => previous.filter(file => file.id !== id))
    setFileError('')
  }

  const clearJd = () => {
    setJdText('')
    setJdPdfFile(null)
    setJdExtractionError(null)
    jdRequestCounter.current++
  }

  const selectJob = (id: string) => {
    jdRequestCounter.current++
    setIsExtractingJd(false)
    setJdPdfFile(null)
    setJdExtractionError(null)
    setJdMode('paste')
    setJobId(id)
    const nextJob = openJobs.find(job => job.id === id)
    setJdText(nextJob?.job_description ?? nextJob?.description ?? '')
  }

  const totalBytes = files.reduce((total, file) => total + file.size, 0)
  const validDescription = jdText.trim().length >= 20
  const canAnalyze = Boolean(selectedJob) && validDescription && files.length > 0 && !isExtractingJd && !isSubmitting
  const uploadMessage = files.length === 0
    ? 'Add PDF resumes to see upload readiness.'
    : invalidFilesCount || duplicateFilesCount
      ? `${files.length} resumes ready${invalidFilesCount ? ` · ${invalidFilesCount} invalid file${invalidFilesCount === 1 ? '' : 's'}` : ''}${duplicateFilesCount ? ` · ${duplicateFilesCount} duplicate${duplicateFilesCount === 1 ? '' : 's'} skipped` : ''}.`
      : 'All selected PDF resumes are ready for analysis.'

  const handleAnalyze = async () => {
    if (!canAnalyze || !selectedJob) return
    setIsSubmitting(true)
    setSubmissionError('')
    try {
      await onAnalyze(jobId, jdText.trim(), files.map(item => item.file))
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Unable to start analysis.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl">
      <header className="mb-7 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#EEF0FF] px-3 py-1 text-xs font-semibold text-[#635BFF]">
          <span className="size-1.5 rounded-full bg-[#635BFF]" />AI-Powered Analysis
        </span>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#111827]">HireSense AI</h2>
        <p className="mt-2 text-sm text-[#6B7280]">Analyze and rank candidates using AI-powered resume matching.</p>
      </header>

      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">Persisted job</span>
        <select className="input" value={jobId} onChange={event => selectJob(event.target.value)}>
          <option value="">Select an open job</option>
          {openJobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}
        </select>
        {openJobs.length === 0 && <span className="mt-1 block text-xs text-amber-700">Create an open job before starting analysis.</span>}
      </label>

      <div className="grid items-stretch gap-4 md:grid-cols-2 md:gap-5">
        <section className="flex min-h-[410px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#E5E7EB] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <h3 className="text-sm font-semibold text-[#111827]">Job Description</h3>
            <div className="flex w-fit rounded-lg bg-[#F3F4F6] p-1" role="tablist" aria-label="Job description input method">
              <button type="button" role="tab" aria-selected={jdMode === 'paste'} onClick={() => setJdMode('paste')} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${jdMode === 'paste' ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280] hover:text-[#374151]'}`}>Paste JD</button>
              <button type="button" role="tab" aria-selected={jdMode === 'pdf'} disabled={!jobId || isExtractingJd} onClick={() => setJdMode('pdf')} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${jdMode === 'pdf' ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280] hover:text-[#374151]'}`}>Upload PDF</button>
            </div>
          </div>

          <div className="flex flex-1 flex-col p-4 sm:p-5">
            {jdMode === 'pdf' && (
              <input ref={jdFileInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void handleJdPdfSelected(file); event.target.value = '' }} />
            )}
            {jdMode === 'pdf' && !jdPdfFile && (
              <button type="button" onClick={() => jdFileInputRef.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) void handleJdPdfSelected(file) }} className="mb-3 flex min-h-24 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#D1D5DB] bg-[#F9FAFB] px-4 py-4 text-center transition hover:border-[#635BFF] hover:bg-[#F7F8FF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#EEF0FF]">
                <span className="text-sm font-semibold text-[#374151]">Upload job-description PDF</span>
                <span className="mt-1 text-xs text-[#9CA3AF]">Drop a PDF here or click to browse · 5 MB max</span>
              </button>
            )}
            {jdMode === 'pdf' && jdPdfFile && (
              <div className="mb-3 flex min-w-0 items-center gap-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#EEF0FF] text-xs font-bold text-[#635BFF]">PDF</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-[#111827]">{jdPdfFile.name}</span><span className="text-xs text-[#9CA3AF]">{formatBytes(jdPdfFile.size)}</span></span>
                <button type="button" onClick={() => jdFileInputRef.current?.click()} className="rounded-lg px-2 py-1 text-xs font-semibold text-[#635BFF] hover:bg-[#EEF0FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF]">Replace</button>
                <button type="button" onClick={clearJd} className="rounded-lg px-2 py-1 text-xs font-semibold text-[#6B7280] hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF]">Remove</button>
              </div>
            )}
            {jdMode === 'pdf' && isExtractingJd && <p role="status" className="mb-2 text-xs font-medium text-[#635BFF]">Extracting text from the PDF…</p>}
            {jdMode === 'pdf' && jdPdfFile && !isExtractingJd && !jdExtractionError && jdText && <p role="status" className="mb-2 text-xs font-medium text-emerald-700">Text extracted. Review it below; the saved job changes only after you confirm analysis.</p>}
            {jdExtractionError && <p role="alert" className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{jdExtractionError}</p>}
            <textarea value={jdText} onChange={event => setJdText(event.target.value)} disabled={isExtractingJd} placeholder={jdMode === 'paste' ? 'Paste or edit the job description for this analysis…' : 'Extracted job description will appear here.'} className="min-h-48 flex-1 resize-none rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-3 text-sm leading-6 text-[#111827] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#635BFF] focus:ring-4 focus:ring-[#EEF0FF] disabled:opacity-60" />
            <div className="mt-2 flex min-h-5 items-center justify-between gap-3 text-xs text-[#9CA3AF]">
              <span>{jdText.length} characters{jdText.trim().length > 0 && jdText.trim().length < 20 ? ' · enter at least 20 characters' : ''}</span>
              {jdText && <button type="button" onClick={clearJd} className="font-semibold text-[#6B7280] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF]">Clear</button>}
            </div>
          </div>
        </section>

        <section className="flex min-h-[410px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-4 sm:px-5">
            <h3 className="text-sm font-semibold text-[#111827]">Resume Upload</h3>
            <span className="rounded-full bg-[#EEF0FF] px-2.5 py-1 text-xs font-semibold text-[#635BFF]">{files.length} selected</span>
          </div>
          <div className="flex flex-1 flex-col p-4 sm:p-5">
            <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={event => { addFiles(event.target.files); event.target.value = '' }} />
            <div role="button" tabIndex={0} onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInputRef.current?.click() } }} onDragEnter={handleDragEnter} onDragOver={event => event.preventDefault()} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()} className={`flex min-h-28 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-4 text-center transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#EEF0FF] ${isDragging ? 'border-[#635BFF] bg-[#F7F8FF]' : 'border-[#D1D5DB] bg-[#F9FAFB] hover:border-[#635BFF] hover:bg-[#F7F8FF]'}`}>
              <span className="grid size-8 place-items-center rounded-full bg-[#EEF0FF] text-lg font-semibold text-[#635BFF]">↑</span>
              <span className="mt-2 text-sm font-semibold text-[#374151]">{isDragging ? 'Release to add resumes' : 'Drop resumes here or click to browse'}</span>
              <span className="mt-1 text-xs text-[#9CA3AF]">PDF files · up to {MAX_RESUMES} resumes · 5 MB each</span>
            </div>
            {fileError && <p role="alert" className="mt-2 text-xs text-red-700">{fileError}</p>}
            <div className="mt-3 max-h-52 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1" aria-label="Selected resumes">
              {files.map(file => <div key={file.id} className="group flex min-w-0 items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white p-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#EEF0FF] text-[10px] font-bold text-[#635BFF]">PDF</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-[#111827]">{file.name}</span><span className="text-[11px] text-[#9CA3AF]">{formatBytes(file.size)} · Ready to upload</span></span>
                <button type="button" aria-label={`Remove ${file.name}`} onClick={() => removeFile(file.id)} className="rounded-lg px-2 py-1 text-xs font-semibold text-[#6B7280] hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF]">Remove</button>
              </div>)}
              {files.length === 0 && <p className="py-4 text-center text-xs text-[#9CA3AF]">Your selected resume PDFs will appear here.</p>}
            </div>
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="text-sm font-semibold text-[#111827]">Resume Insights</h3><p className="mt-1 text-xs text-[#6B7280]">A live summary of the resumes selected for this batch.</p></div><span className="text-xs font-medium text-[#6B7280]">{files.length ? 'Upload status' : 'Waiting for resumes'}</span></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Insight label="Total resumes" value={String(files.length)} />
          <Insight label="Total file size" value={formatBytes(totalBytes)} />
          <Insight label="PDF files" value={String(files.filter(file => file.name.toLowerCase().endsWith('.pdf')).length)} />
          <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3"><div className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">Status</div><div className={`mt-1 text-sm font-semibold ${files.length && !invalidFilesCount ? 'text-emerald-700' : 'text-[#374151]'}`}>{files.length ? 'Ready' : 'Waiting'}</div><p className="mt-1 text-xs leading-5 text-[#6B7280]">{uploadMessage}</p></div>
        </div>
        {(invalidFilesCount > 0 || duplicateFilesCount > 0) && <p className="mt-3 text-xs text-amber-700">{invalidFilesCount > 0 && `${invalidFilesCount} invalid file${invalidFilesCount === 1 ? '' : 's'} skipped. `}{duplicateFilesCount > 0 && `${duplicateFilesCount} duplicate file${duplicateFilesCount === 1 ? '' : 's'} skipped.`}</p>}
      </section>

      <div className="mt-6 flex flex-col items-center gap-3 pb-2 text-center">
        {submissionError && <p role="alert" className="max-w-xl rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{submissionError}</p>}
        <button type="button" onClick={() => void handleAnalyze()} disabled={!canAnalyze} className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#635BFF] to-[#8B84FF] px-8 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(99,91,255,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(99,91,255,0.35)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#C7C3FF] disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-none disabled:bg-slate-300 disabled:shadow-none">
          {isSubmitting ? <><span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"/>Starting analysis…</> : <>✦ Analyze Candidates</>}
        </button>
        <p className="text-xs text-[#9CA3AF]">Semantic matching · Skill analysis · Candidate ranking</p>
      </div>
    </section>
  )
}

function Insight({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3"><div className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">{label}</div><div className="mt-1 text-lg font-bold text-[#111827]">{value}</div></div>
}
