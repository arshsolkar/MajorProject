import { useState, useEffect, useRef } from 'react'
import { getAnalysisStatus, getAnalysis, type AnalysisResponse, type AnalysisStatusResponse } from '../utils/api'

interface AiScanningProps {
  analysisId: string
  uploadedFiles: File[]
  onComplete: (analysis: AnalysisResponse) => void
  onError: (error: string) => void
}

const formatTime = (secs: number) => {
  if (isNaN(secs) || secs < 0 || !isFinite(secs)) return '--:--'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function AiScanning({ analysisId, uploadedFiles, onComplete, onError }: AiScanningProps) {
  const [statusState, setStatusState] = useState<AnalysisStatusResponse | null>(null)
  const [now, setNow] = useState<number>(Date.now())
  const [completedAnalysis, setCompletedAnalysis] = useState<AnalysisResponse | null>(null)
  
  const prevCompletedCountRef = useRef(0)
  const completionTimesRef = useRef<number[]>([])

  // Update time for elapsed counter
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!analysisId) return

    let isMounted = true
    let timeoutId: NodeJS.Timeout | null = null

    const poll = async () => {
      try {
        const state = await getAnalysisStatus(analysisId)
        if (!isMounted) return

        setStatusState(state)

        if (state.status === 'completed') {
          if (!completedAnalysis) {
            const fullAnalysis = await getAnalysis(analysisId)
            if (isMounted) setCompletedAnalysis(fullAnalysis)
          }
        } else if (state.status === 'failed') {
          onError(state.error || 'Analysis failed during processing.')
        } else {
          timeoutId = setTimeout(poll, 750)
        }
      } catch (error: any) {
        if (isMounted) {
          onError(error.message || 'Error polling analysis status')
        }
      }
    }

    poll()

    return () => {
      isMounted = false
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [analysisId, onComplete, onError])

  // Computed properties
  const status = statusState?.status || 'queued'
  const phase = statusState?.phase || 'text_extraction'
  
  const total = statusState?.total || uploadedFiles.length || 0
  const completedCount = statusState?.completed || 0
  const overallProgress = total > 0 ? (completedCount / total) * 100 : 0
  
  const phaseTotal = statusState?.phase_total || 0
  const phaseCompleted = statusState?.phase_completed || 0
  const phaseProgress = phaseTotal > 0 ? (phaseCompleted / phaseTotal) * 100 : 0

  useEffect(() => {
    if (completedCount > prevCompletedCountRef.current) {
      const diff = completedCount - prevCompletedCountRef.current
      for (let i = 0; i < diff; i++) {
        completionTimesRef.current.push(Date.now())
      }
      prevCompletedCountRef.current = completedCount
    }
  }, [completedCount])

  // Time calculations
  let elapsedSeconds = 0
  if (statusState?.started_at) {
    // Backend returns naive datetime from datetime.utcnow(). 
    // We must treat it explicitly as UTC by appending 'Z' to avoid local timezone (e.g. IST) shifts.
    const parseUtc = (dateStr: string) => {
      if (!dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.match(/-\d{2}:\d{2}$/)) {
        return new Date(dateStr + 'Z').getTime()
      }
      return new Date(dateStr).getTime()
    }
    
    const startMs = parseUtc(statusState.started_at)
    
    if (status === 'completed' && statusState.completed_at) {
      // Final frozen elapsed time
      elapsedSeconds = Math.max(0, (parseUtc(statusState.completed_at) - startMs) / 1000)
    } else {
      // Live processing elapsed time
      elapsedSeconds = Math.max(0, (now - startMs) / 1000)
    }
  }

  const avgSecsPerResume = completedCount > 0 ? elapsedSeconds / completedCount : 0
  const remainingResumes = total - completedCount
  
  // Use rolling average if available
  const times = completionTimesRef.current
  let rollingAvgSecs = 0
  if (times.length >= 2) {
    const recent = times.slice(-6)
    let sum = 0
    for(let i=1; i<recent.length; i++) sum += (recent[i] - recent[i-1])/1000
    rollingAvgSecs = sum / (recent.length - 1)
  } else {
    rollingAvgSecs = avgSecsPerResume
  }

  let estimatedRemaining = '--:--'
  let speedValue: string | React.ReactNode = 'Calculating...'
  let speedSuffix = ''

  if (status === 'completed') {
    estimatedRemaining = '00:00'
    speedValue = completedCount > 0 ? ((completedCount / Math.max(elapsedSeconds, 1)) * 60).toFixed(1) : '...'
    speedSuffix = 'candidates/min'
  } else if (completedCount === 0) {
    estimatedRemaining = 'Calculating...'
    speedValue = 'Calculating...'
  } else if (completedCount === 1 && times.length === 1) {
    estimatedRemaining = 'Estimating...'
    speedValue = <span className="text-sm font-normal text-gray-500">Based on 1 completed candidate</span>
  } else {
    if (rollingAvgSecs > 0) {
      estimatedRemaining = '~' + formatTime(rollingAvgSecs * remainingResumes)
      speedValue = `~${(60 / rollingAvgSecs).toFixed(1)}`
      speedSuffix = 'candidates/min'
    } else {
      estimatedRemaining = 'Estimating...'
      speedValue = 'Calculating...'
    }
  }

  if (status === 'failed') {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#E5E7EB] max-w-md w-full text-center">
          <div className="w-16 h-16 bg-[#FEE2E2] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Analysis Interrupted</h2>
          <p className="text-gray-600 mb-6">{statusState?.error || 'Unable to complete resume processing.'}</p>
          <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg mb-6 text-sm">
            <div>
              <div className="text-gray-500">Completed</div>
              <div className="font-semibold">{completedCount} / {total} candidates</div>
            </div>
          </div>
          <button 
            onClick={() => onError(statusState?.error || 'Failed')}
            className="w-full py-2.5 bg-[#635BFF] text-white rounded-lg font-medium hover:bg-[#524BDE] transition-colors"
          >
            Start New Analysis
          </button>
        </div>
      </div>
    )
  }

  // Phase Display formatting
  const phaseLabels: Record<string, string> = {
    'text_extraction': 'Text Extraction',
    'calculating_similarities': 'Semantic Similarity Analysis',
    'ai_analysis': 'AI Candidate Analysis',
    'completed': 'Completed'
  }
  const currentPhaseLabel = phase ? phaseLabels[phase] || phase : 'Preparing'

  // Pipeline Logic
  const pipelineFlow = [
    { id: 'text_extraction', label: 'Extraction' },
    { id: 'calculating_similarities', label: 'Similarity' },
    { id: 'ai_analysis', label: 'AI Analysis' },
    { id: 'completed', label: 'Completed' }
  ]
  
  const currentPhaseIndex = pipelineFlow.findIndex(p => p.id === phase)

  // Current Resume / Stage formatting
  const currentResume = statusState?.current_resume
  const currentStage = statusState?.current_stage

  const stageLabels: Record<string, string> = {
    'extracting_text': 'Extracting resume text...',
    'calculating_similarities': 'Calculating semantic similarities...',
    'analyzing_skills': 'Analyzing Skills',
    'calculating_score': 'Calculating Score',
    'generating_insights': 'Generating Insights',
    'completed': 'Completed'
  }
  
  const displayStage = currentStage ? stageLabels[currentStage] || currentStage : ''

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col items-center py-12 px-6 overflow-y-auto">
      <div className="w-full max-w-5xl flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Scanning</h1>
            <p className="text-gray-500 text-sm mt-1">Analyzing resumes against the provided job description</p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${
            status === 'completed' ? 'bg-[#ECFDF5] text-[#10B981] border-[#A7F3D0]' : 'bg-white text-[#635BFF] border-[#E0E7FF]'
          }`}>
            {status !== 'completed' && <div className="w-2 h-2 rounded-full bg-[#635BFF] animate-pulse" />}
            {status === 'completed' ? 'Completed' : status === 'queued' ? 'Preparing' : 'Processing'}
          </div>
        </div>

        {/* Overall Progress Card */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#E5E7EB]">
          <div className="flex justify-between items-end mb-4">
            <div>
              <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Overall Progress</div>
              <div className="text-4xl font-bold text-gray-900">{Math.round(overallProgress)}%</div>
            </div>
            <div className="text-gray-600 font-medium">
              {completedCount} / {total} candidates completed
            </div>
          </div>
          
          <div className="w-full bg-[#F3F4F6] rounded-full h-3 mb-8 overflow-hidden relative">
            <div 
              className="h-full bg-gradient-to-r from-[#635BFF] to-[#8B84FF] transition-all duration-300 ease-out"
              style={{ width: `${overallProgress}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-6 divide-x divide-[#E5E7EB]">
            <div className="pl-0">
              <div className="text-sm text-gray-500 mb-1">Elapsed Time</div>
              <div className="text-xl font-semibold text-gray-900">{formatTime(elapsedSeconds)}</div>
            </div>
            <div className="pl-6">
              <div className="text-sm text-gray-500 mb-1">Estimated Remaining</div>
              <div className="text-xl font-semibold text-gray-900">{estimatedRemaining}</div>
            </div>
            <div className="pl-6">
              <div className="text-sm text-gray-500 mb-1">Processing Speed</div>
              <div className="text-xl font-semibold text-gray-900">
                {speedValue} {speedSuffix && <span className="text-sm font-normal text-gray-500">{speedSuffix}</span>}
              </div>
            </div>
          </div>
          
          {status === 'completed' && (
             <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center animate-fade-in-up">
             <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Analysis Complete</h3>
                <p className="text-gray-500 mb-4">{total} / {total} candidates analyzed</p>
                <button 
                  onClick={() => completedAnalysis && onComplete(completedAnalysis)}
                  disabled={!completedAnalysis}
                  className="flex items-center gap-2 px-6 py-3 bg-[#635BFF] text-white rounded-xl font-medium hover:bg-[#524BDE] transition-all hover-lift mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  View Results 
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3.33331 8H12.6666" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8 3.33331L12.6667 7.99998L8 12.6666" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
             </div>
           </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Current Phase / Pipeline */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E7EB] flex flex-col gap-6">
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Current Phase</h2>
              <div className="text-xl font-semibold text-[#635BFF] mb-2">{currentPhaseLabel}</div>
              <div className="flex justify-between items-center text-sm font-medium text-gray-600 mb-2">
                <span>{phaseCompleted} / {phaseTotal} {phase === 'text_extraction' ? 'resumes extracted' : 'processed'}</span>
                <span>{Math.round(phaseProgress)}%</span>
              </div>
              <div className="w-full bg-[#E5E7EB] rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-[#635BFF] transition-all duration-300"
                  style={{ width: `${phaseProgress}%` }}
                />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Processing Flow</h3>
              <div className="space-y-4">
                {pipelineFlow.map((step, idx) => {
                  const isComplete = currentPhaseIndex > idx || status === 'completed'
                  const isActive = currentPhaseIndex === idx && status !== 'completed'
                  
                  return (
                    <div key={step.id} className="flex items-center gap-3">
                      <div className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full border-2 ${
                        isComplete ? 'bg-[#10B981] border-[#10B981]' : isActive ? 'bg-white border-[#635BFF]' : 'bg-white border-gray-200'
                      }`}>
                         {isComplete && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                         {isActive && <div className="w-2.5 h-2.5 rounded-full bg-[#635BFF]" />}
                      </div>
                      <span className={`text-sm font-medium ${isComplete || isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                        {step.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Currently Processing Resume */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E7EB] flex flex-col">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6">Currently Processing</h2>
            
            {status === 'completed' ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                <div className="w-16 h-16 bg-[#ECFDF5] rounded-full flex items-center justify-center mb-4">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900">All resumes processed</h3>
              </div>
            ) : currentResume == null ? (
               <div className="flex-1 flex flex-col justify-center items-center text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200 p-6">
                 <div className="text-gray-500 font-medium mb-2">No individual resume currently active</div>
                 <div className="text-sm text-gray-400">{displayStage || 'Batch operation in progress...'}</div>
               </div>
            ) : (
              <div className="border border-[#E5E7EB] rounded-xl p-5 flex-1 relative overflow-hidden bg-gray-50/50">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#635BFF]"></div>
                
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-xs text-gray-500 font-medium mb-1">FILE</div>
                    <div className="font-mono text-sm font-semibold text-gray-900 bg-white px-2 py-1 border border-gray-200 rounded inline-block truncate max-w-[250px]">
                      {currentResume.filename}
                    </div>
                  </div>
                </div>
                
                <div className="mb-6">
                  <div className="text-xs text-gray-500 font-medium mb-1">CANDIDATE</div>
                  <div className="text-base font-medium text-gray-900">
                    {currentResume.candidate_name || 'Candidate information being extracted...'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                   <div className="w-2.5 h-2.5 rounded-full bg-[#635BFF] animate-pulse" />
                   <span className="text-sm font-medium text-[#635BFF]">{displayStage}</span>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Bottom row: Queue & Completed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Queue */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E7EB] lg:col-span-1">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex justify-between">
              <span>Processing Queue</span>
              <span className="text-gray-500 font-medium">{uploadedFiles.length} files</span>
            </h2>
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-2">
              {uploadedFiles.map((file, idx) => {
                const isCompleted = (statusState?.completed_resumes || []).some(r => r.filename === file.name)
                const isCurrent = currentResume?.filename === file.name
                
                return (
                  <div key={idx} className={`flex items-center gap-3 p-2 rounded-lg text-sm ${
                    isCurrent ? 'bg-[#EEF0FF] border border-[#C7D2FE]' : 'border border-transparent'
                  }`}>
                    {isCompleted ? (
                      <div className="text-[#10B981] flex-shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                    ) : isCurrent ? (
                      <div className="text-[#635BFF] flex-shrink-0">
                        <div className="w-3 h-3 bg-[#635BFF] rounded-full mx-0.5 animate-pulse"></div>
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-[#E5E7EB] flex-shrink-0"></div>
                    )}
                    <span className={`truncate font-mono text-xs ${
                      isCurrent ? 'text-[#635BFF] font-semibold' : 
                      isCompleted ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      {file.name}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recently Completed */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E7EB] lg:col-span-2">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
              Recently Completed
            </h2>
            {!(statusState?.completed_resumes?.length) ? (
              <div className="flex flex-col items-center justify-center h-[200px] text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <p className="text-sm">Candidates will appear here as they complete</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                      <th className="pb-3 font-medium">Candidate</th>
                      <th className="pb-3 font-medium">Match Score</th>
                      <th className="pb-3 font-medium">Source File</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {statusState.completed_resumes.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50 animate-fade-in-up">
                        <td className="py-3 font-medium text-gray-900 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#10B981]/10 text-[#10B981] flex items-center justify-center flex-shrink-0">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </div>
                          {c.candidate_name || 'Unknown Candidate'}
                        </td>
                        <td className="py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#EEF0FF] text-[#635BFF]">
                            {c.ats_score}% ATS
                          </span>
                        </td>
                        <td className="py-3 font-mono text-xs text-gray-500 truncate max-w-[150px]">
                          {c.filename}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
