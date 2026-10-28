import { useEffect, useRef, useState } from 'react'
import type { Candidate } from '../data/candidates'
import { getMatchColor, getInitialsColor } from '../data/candidates'
import { getCandidateResume } from '../utils/api'

interface CandidateAnalysisProps {
  candidate: Candidate | null
  onBack: () => void
  onToggleShortlist?: (id: string, value: boolean) => void
}

function MatchGauge({ match, label }: { match: number; label: string }) {
  const [displayed, setDisplayed] = useState(0)
  const frame = useRef<number>(0)

  useEffect(() => {
    setDisplayed(0)
    const start = performance.now()
    const duration = 1000
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(Math.round(eased * match))
      if (progress < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [match])

  const color = getMatchColor(match)
  const circumference = 2 * Math.PI * 52
  const dashOffset = circumference * (1 - displayed / 100)

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="#F3F4F6" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="52"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.05s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[28px] font-800 tracking-tight leading-none" style={{ color }}>
            {displayed}%
          </span>
          <span className="text-[11px] font-500 text-[#9CA3AF] mt-1">{label}</span>
        </div>
      </div>
    </div>
  )
}

function MatchBar({ label, value, delay = 0 }: { label: string; value: number; delay?: number }) {
  const [mounted, setMounted] = useState(false)
  const color = getMatchColor(value)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 300 + delay)
    return () => clearTimeout(t)
  }, [delay])

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[13px] font-500 text-[#374151]">{label}</span>
        <span className="text-[13px] font-700" style={{ color }}>{value}%</span>
      </div>
      <div className="w-full bg-[#F3F4F6] rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: mounted ? `${value}%` : '0%', backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export default function CandidateAnalysis({ candidate, onBack, onToggleShortlist }: CandidateAnalysisProps) {
  const [isResumeOpen, setIsResumeOpen] = useState(false)
  const [resumeUrl, setResumeUrl] = useState<string | null>(null)
  const [isLoadingResume, setIsLoadingResume] = useState(false)
  const [resumeError, setResumeError] = useState<string | null>(null)

  if (!candidate) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-[16px] font-600 text-[#6B7280] mb-2">No candidate selected</div>
          <button
            onClick={onBack}
            className="text-[13px] text-[#635BFF] font-600 hover:underline"
          >
            Go back to overview
          </button>
        </div>
      </div>
    )
  }
  const initColor = getInitialsColor(candidate.initials)

  const handleViewResume = async () => {
    if (!candidate.id) return
    
    // Clear old state safely just in case
    if (resumeUrl) {
      URL.revokeObjectURL(resumeUrl)
      setResumeUrl(null)
    }

    try {
      setIsLoadingResume(true)
      setResumeError(null)
      setIsResumeOpen(true) // Open immediately to show loading state

      const blob = await getCandidateResume(candidate.id)
      const freshUrl = URL.createObjectURL(blob)
      setResumeUrl(freshUrl)
    } catch (error) {
      console.error('Failed to open resume:', error)
      setResumeError('Failed to load resume. Please try again.')
    } finally {
      setIsLoadingResume(false)
    }
  }

  const handleCloseResume = () => {
    setIsResumeOpen(false)
    setResumeError(null)
    if (resumeUrl) {
      URL.revokeObjectURL(resumeUrl)
      setResumeUrl(null)
    }
  }

  // Use dynamic job requirements from the candidate data
  const allRequirements = [
    ...(candidate.jobRequirements?.required || []).map(skill => ({ skill, required: true })),
    ...(candidate.jobRequirements?.preferred || []).map(skill => ({ skill, required: false }))
  ]

  // Determine status for each requirement based on candidate's skills
  const jobRequirements = allRequirements.length > 0 ? allRequirements.map(req => {
    const hasSkill = candidate.skills.some(skill => 
      skill.toLowerCase() === req.skill.toLowerCase() ||
      skill.toLowerCase().includes(req.skill.toLowerCase()) ||
      req.skill.toLowerCase().includes(skill.toLowerCase())
    )
    
    let status: 'Strong' | 'Good' | 'Limited' | 'Missing'
    if (hasSkill) {
      status = req.required ? 'Strong' : 'Good'
    } else {
      status = req.required ? 'Missing' : 'Limited'
    }
    
    return { skill: req.skill, status }
  }) : [
    // Fallback for demo data when no job requirements are available
    { skill: 'Python', status: 'Strong' as const },
    { skill: 'Machine Learning', status: 'Strong' as const },
    { skill: 'TensorFlow', status: 'Strong' as const },
    { skill: 'SQL', status: 'Strong' as const },
    { skill: 'Docker', status: 'Good' as const },
    { skill: 'AWS', status: 'Limited' as const },
    { skill: 'Kubernetes', status: 'Missing' as const },
  ]

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Strong':
        return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l2.5 2.5 5-5.5" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      case 'Good':
        return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l2.5 2.5 5-5.5" stroke="#635BFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      case 'Limited':
        return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v4M6 8.5v1.5" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" /></svg>
      case 'Missing':
        return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" /></svg>
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Strong': return '#10B981'
      case 'Good': return '#635BFF'
      case 'Limited': return '#F59E0B'
      case 'Missing': return '#EF4444'
    }
  }

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'Strong': return '#F0FDF4'
      case 'Good': return '#EEF0FF'
      case 'Limited': return '#FFFBEB'
      case 'Missing': return '#FEF2F2'
    }
  }

  return (
    <div className="p-6 max-w-none animate-fade-in-up">
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] font-500 text-[#6B7280] hover:text-[#111827] transition-all duration-200 hover-scale"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Overview
        </button>
        <span className="text-[#E5E7EB]">/</span>
        <span className="text-[13px] text-[#9CA3AF]">{candidate.name}</span>
        <button type="button" onClick={()=>onToggleShortlist?.(candidate.id,!candidate.isShortlisted)} className="ml-auto rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700">{candidate.isShortlisted?'Remove shortlist':'Shortlist'}</button>
      </div>

      {/* Candidate hero */}
      <div
        className="bg-white rounded-lg border border-[#E5E7EB] p-6 mb-5 flex items-center gap-6"
      >
        <div
          className="w-16 h-16 rounded-xl text-[20px] font-800 text-white flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: initColor }}
        >
          {candidate.initials}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-800 text-[#111827] tracking-tight">{candidate.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[14px] text-[#6B7280]">{candidate.title}</span>
            <span className="w-1 h-1 rounded-full bg-[#D1D5DB]" />
            <span className="text-[13px] text-[#9CA3AF]">{candidate.location}</span>
            <span className="w-1 h-1 rounded-full bg-[#D1D5DB]" />
            <span className="text-[13px] text-[#9CA3AF]">{candidate.experience} experience</span>
          </div>
          <div className="mt-2 text-[13px] text-[#6B7280]">{candidate.education}</div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-[13px] font-500 text-[#9CA3AF] mb-1">Overall Match</div>
          <div className="text-[36px] font-800 leading-none tracking-tight" style={{ color: getMatchColor(candidate.match) }}>
            {candidate.match}%
          </div>
          <div
            className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-600 px-3 py-1 rounded-full"
            style={{
              color: getMatchColor(candidate.match),
              backgroundColor: candidate.match >= 85 ? '#F0FDF4' : candidate.match >= 70 ? '#EEF0FF' : '#FFFBEB',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getMatchColor(candidate.match) }} />
            {candidate.recommendation}
          </div>
          {candidate.filename && (
            <button
              onClick={handleViewResume}
              className="mt-3 w-full flex justify-center items-center gap-1.5 text-[13px] font-600 text-white bg-[#635BFF] hover:bg-[#524BDE] px-4 py-2 rounded-lg transition-colors shadow-sm hover-lift"
            >
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                <path d="M2 10V3a1 1 0 011-1h4.586a1 1 0 01.707.293L9.707 3.707A1 1 0 0110 4.414V10a1 1 0 01-1 1H3a1 1 0 01-1-1z" stroke="currentColor" strokeWidth="1.2" fill="none" />
                <path d="M7 2v2.5H9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <path d="M6 5.5v3M4.5 7l1.5 1.5 1.5-1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              View Resume
            </button>
          )}
        </div>
      </div>

      {/* Resume Viewer Modal */}
      {isResumeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6] bg-[#F7F8FA]">
              <div>
                <h3 className="text-[16px] font-700 text-[#111827]">{candidate.name}'s Resume</h3>
                <p className="text-[12px] text-[#6B7280]">{candidate.filename}</p>
              </div>
              <button
                onClick={handleCloseResume}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-white border border-transparent hover:border-[#E5E7EB] transition-all shadow-sm"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 w-full bg-[#F3F4F6] relative">
              {isLoadingResume && !resumeUrl && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="w-8 h-8 border-3 border-[#635BFF] border-t-transparent rounded-full animate-spin mb-3"></div>
                  <div className="text-[13px] font-500 text-[#6B7280]">Loading resume...</div>
                </div>
              )}
              
              {resumeError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="w-12 h-12 bg-[#FEF2F2] text-[#EF4444] rounded-full flex items-center justify-center mb-3">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="text-[14px] font-600 text-[#111827] mb-1">Error Loading Resume</div>
                  <div className="text-[13px] text-[#6B7280] mb-4">{resumeError}</div>
                  <button
                    onClick={handleViewResume}
                    className="px-4 py-2 bg-white border border-[#E5E7EB] text-[#374151] text-[13px] font-500 rounded-lg hover:bg-[#F9FAFB] transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {resumeUrl && (
                <iframe
                  src={resumeUrl}
                  className="w-full h-full border-0"
                  title={`${candidate.name} Resume`}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main 3-column layout */}
      <div className="grid grid-cols-3 gap-5 mb-5">
        {/* Match gauge + breakdown */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
          <h3 className="text-[13px] font-700 text-[#111827] mb-1">Match Score</h3>
          <MatchGauge match={candidate.match} label="Overall" />
          <div className="border-t border-[#F3F4F6] pt-4 mt-2 space-y-4">
            <h4 className="text-[12px] font-600 text-[#9CA3AF] uppercase tracking-wider">Match Breakdown</h4>
            <MatchBar label="Semantic Fit" value={candidate.semanticMatch} delay={0} />
            <MatchBar label="Technical Skills" value={candidate.skillMatch} delay={100} />
            <MatchBar label="Experience" value={candidate.experienceMatch} delay={200} />
          </div>
        </div>

        {/* Requirement Coverage */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
          <h3 className="text-[13px] font-700 text-[#111827] mb-4">Requirement Coverage</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
            <div className="grid grid-cols-[1fr_auto] gap-2 text-[11px] font-600 text-[#9CA3AF] uppercase tracking-wider mb-2 sticky top-0 bg-white z-10">
              <span>Job Requirement</span>
              <span>Candidate</span>
            </div>
            {jobRequirements.map((req) => (
              <div key={req.skill} className="flex items-center justify-between py-2 border-b border-[#F3F4F6] last:border-0">
                <span className="text-[12px] font-500 text-[#374151]">{req.skill}</span>
                <div className="flex items-center gap-1.5">
                  <div
                    className="flex items-center justify-center w-5 h-5 rounded"
                    style={{ backgroundColor: getStatusBg(req.status) }}
                  >
                    {getStatusIcon(req.status)}
                  </div>
                  <span
                    className="text-[11px] font-600 px-2 py-0.5 rounded-full"
                    style={{
                      color: getStatusColor(req.status),
                      backgroundColor: getStatusBg(req.status),
                    }}
                  >
                    {req.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Insight */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-[#635BFF]">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1.5L7 4.5H10L7.5 6.5L8.5 9.5L6 7.5L3.5 9.5L4.5 6.5L2 4.5H5L6 1.5Z" fill="white" />
              </svg>
            </div>
            <h3 className="text-[13px] font-700 text-[#111827]">AI Insight</h3>
          </div>

          <div className="rounded-xl p-4 text-[13px] text-[#374151] leading-relaxed bg-[#F7F8FF] border border-[#E0E2FF]">
            <div className="space-y-3">
              {candidate.aiInsight.split(' | ').map((insight, index) => {
                const [label, ...valueParts] = insight.split(':')
                const value = valueParts.join(':').trim()
                return (
                  <div key={index} className="flex items-start gap-2">
                    <span className="font-600 text-[#635BFF] text-[12px] uppercase tracking-wide min-w-fit">
                      {label.replace(/\*\*/g, '').trim()}:
                    </span>
                    <span className="text-[#374151]">{value.replace(/\*\*/g, '').trim()}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[#F3F4F6]">
            <div className="text-[11px] font-600 text-[#9CA3AF] uppercase tracking-wider mb-2">Quick Stats</div>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Skills matched</span>
                <span className="font-600 text-[#111827]">{candidate.skills.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Gaps found</span>
                <span className="font-600 text-[#111827]">{candidate.missingSkills.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Experience</span>
                <span className="font-600 text-[#111827]">{candidate.experience}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Education</span>
                <span className="font-600 text-[#111827]">{candidate.education !== 'Not specified' ? 'Extracted' : 'Not specified'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Education + Experience + Projects */}
      <div className="grid grid-cols-3 gap-5">
        {/* Education */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 rounded bg-[#EEF0FF] flex items-center justify-center">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M5.5 1L10 3.5L5.5 6L1 3.5L5.5 1Z" stroke="#635BFF" strokeWidth="1" fill="none" strokeLinejoin="round" />
                <path d="M1 3.5v4l4.5 2.5L10 7.5v-4" stroke="#635BFF" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            <h3 className="text-[13px] font-700 text-[#111827]">Education</h3>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#F3F4F6] flex items-center justify-center text-[14px] flex-shrink-0">
              🎓
            </div>
            <div>
              <div className="text-[13px] font-600 text-[#111827] leading-snug">{candidate.education}</div>
              {candidate.education !== 'Not specified' && (
                <div className="text-[11px] text-[#9CA3AF] mt-1">Extracted from resume</div>
              )}
            </div>
          </div>
        </div>

        {/* Experience */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 rounded bg-[#EEF0FF] flex items-center justify-center">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <rect x="1" y="3" width="9" height="7" rx="1" stroke="#635BFF" strokeWidth="1" fill="none" />
                <path d="M3.5 3V2a2 2 0 014 0v1" stroke="#635BFF" strokeWidth="1" fill="none" />
              </svg>
            </div>
            <h3 className="text-[13px] font-700 text-[#111827]">Experience</h3>
          </div>
          <div className="space-y-3">
            {candidate.experienceDetails && candidate.experienceDetails.length > 0 ? (
              candidate.experienceDetails.map((exp, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#635BFF] mt-1.5 flex-shrink-0" />
                  <div>
                    <div className="text-[13px] font-600 text-[#111827]">{exp.title || candidate.title}</div>
                    <div className="text-[12px] text-[#9CA3AF]">
                      {exp.organization && `${exp.organization} · `}
                      {candidate.experience}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-[#635BFF] mt-1.5 flex-shrink-0" />
                <div>
                  <div className="text-[13px] font-600 text-[#111827]">{candidate.title}</div>
                  <div className="text-[12px] text-[#9CA3AF]">Current · {candidate.experience}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Projects */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 rounded bg-[#EEF0FF] flex items-center justify-center">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1 8.5V3.5l4.5-2 4.5 2V8.5l-4.5 2L1 8.5Z" stroke="#635BFF" strokeWidth="1" fill="none" strokeLinejoin="round" />
                <path d="M5.5 1.5v9M1 3.5l4.5 2 4.5-2" stroke="#635BFF" strokeWidth="1" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="text-[13px] font-700 text-[#111827]">Notable Projects</h3>
          </div>
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-2">
            {candidate.projects.map((p, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-md bg-[#F3F4F6] text-[9px] font-700 text-[#9CA3AF] flex items-center justify-center flex-shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <p className="text-[12px] text-[#374151] leading-snug">{p}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
