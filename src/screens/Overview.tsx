import { useEffect, useState, useRef } from 'react'
import type { SidebarTab } from '../components/Sidebar'
import type { Candidate } from '../data/candidates'
import { Download } from 'lucide-react'
import {
  getRecommendationColor,
  getMatchColor,
  getInitialsColor,
} from '../data/candidates'

interface OverviewProps {
  activeTab: SidebarTab
  candidates: Candidate[]
  onSelectCandidate: (id: string) => void
  currentAnalysis?: any
  onExportReport?: () => void
  onToggleShortlist?: (id: string, value: boolean) => void
}

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0)
  const frame = useRef<number>(0)
  useEffect(() => {
    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [target, duration])
  return value
}

function KpiCard({
  label,
  value,
  suffix = '',
  change,
  icon,
  delay = 0,
}: {
  label: string
  value: number
  suffix?: string
  change?: string
  icon: React.ReactNode
  delay?: number
}) {
  const displayed = useCountUp(value, 900)
  return (
    <div
      className="bg-white rounded-lg border border-[#E5E7EB] p-5 animate-fade-in-up"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-9 h-9 rounded-lg bg-[#F7F8FA] flex items-center justify-center">{icon}</div>
        {change && (
          <span className="text-[11px] font-600 text-[#10B981] bg-[#F0FDF4] px-2 py-0.5 rounded-full">
            {change}
          </span>
        )}
      </div>
      <div className="text-[30px] font-800 text-[#111827] leading-none tracking-tight">
        {displayed}
        <span className="text-[20px] font-700">{suffix}</span>
      </div>
      <div className="mt-1 text-[13px] text-[#6B7280] font-400">{label}</div>
    </div>
  )
}

function BarChart({ distribution }: { distribution: any[] }) {
  const maxCount = Math.max(...distribution.map((d) => d.count))
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 200)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="space-y-3">
      {distribution.map((item) => {
        const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0
        return (
          <div key={item.range} className="flex items-center gap-3">
            <div className="text-[12px] text-[#6B7280] font-400 w-20 flex-shrink-0 text-right">
              {item.range}
            </div>
            <div className="flex-1 bg-[#F3F4F6] rounded-full h-6 overflow-hidden relative">
              <div
                className="h-full rounded-full flex items-center pl-3 transition-all duration-700 ease-out"
                style={{
                  width: mounted ? `${Math.max(pct, item.count > 0 ? 8 : 0)}%` : '0%',
                  backgroundColor: item.color,
                  opacity: 0.85,
                }}
              >
                {item.count > 0 && (
                  <span className="text-[11px] font-700 text-white">{item.count}</span>
                )}
              </div>
              {item.count === 0 && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[#9CA3AF]">0</span>
              )}
            </div>
            <div className="text-[12px] font-600 text-[#374151] w-6 flex-shrink-0">{item.count}</div>
          </div>
        )
      })}
    </div>
  )
}

function RecommendationBadge({ rec }: { rec: string }) {
  const color = getRecommendationColor(rec as any)
  const bg = color === '#10B981' ? '#F0FDF4' : color === '#635BFF' ? '#EEF0FF' : color === '#F59E0B' ? '#FFFBEB' : '#FEF2F2'
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-600 px-2 py-0.5 rounded-full"
      style={{ color, backgroundColor: bg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {rec}
    </span>
  )
}

function SkillPill({ skill, present }: { skill: string; present: boolean }) {
  return (
    <span
      className={`inline-flex text-[11px] font-500 px-2 py-0.5 rounded-md ${
        present
          ? 'bg-[#EEF0FF] text-[#635BFF]'
          : 'bg-[#F3F4F6] text-[#9CA3AF] line-through decoration-[#C4C9D4]'
      }`}
    >
      {skill}
    </span>
  )
}

function matchesCandidateSearch(candidate: Candidate, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true

  const searchableText = [
    candidate.name,
    candidate.title,
    candidate.location,
    candidate.recommendation,
    ...candidate.skills,
  ].join(' ').toLowerCase()

  return searchableText.includes(normalizedQuery)
}

export default function Overview({ activeTab, candidates, onSelectCandidate, currentAnalysis, onExportReport, onToggleShortlist }: OverviewProps) {
  const [candidateQuery, setCandidateQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [recommendationFilter, setRecommendationFilter] = useState<'all' | Candidate['recommendation']>('all')
  const [minMatch, setMinMatch] = useState(0)

  const topCandidates = candidates.slice(0, 5)
  const filteredCandidates = candidates.filter((candidate) => {
    const matchesSearch = matchesCandidateSearch(candidate, candidateQuery)
    const matchesRecommendation =
      recommendationFilter === 'all' || candidate.recommendation === recommendationFilter
    const matchesMinMatch = candidate.match >= minMatch
    return matchesSearch && matchesRecommendation && matchesMinMatch
  })

  const activeFilterCount = (recommendationFilter !== 'all' ? 1 : 0) + (minMatch > 0 ? 1 : 0)
  
  // Calculate derived data from real candidates
  const strongMatches = candidates.filter(c => c.recommendation === 'Strong Match').length
  const avgMatch = candidates.length > 0 
    ? Math.round(candidates.reduce((sum, c) => sum + c.match, 0) / candidates.length)
    : 0
  
  // Calculate match distribution from real candidates
  const distribution = [
    { range: '90–100%', count: candidates.filter(c => c.match >= 90).length, color: '#10B981' },
    { range: '80–89%', count: candidates.filter(c => c.match >= 80 && c.match < 90).length, color: '#10B981' },
    { range: '70–79%', count: candidates.filter(c => c.match >= 70 && c.match < 80).length, color: '#F59E0B' },
    { range: '60–69%', count: candidates.filter(c => c.match >= 60 && c.match < 70).length, color: '#F59E0B' },
    { range: 'Below 60%', count: candidates.filter(c => c.match < 60).length, color: '#EF4444' },
  ]
  
  // Calculate skill coverage from real candidates
  const allSkills = new Set<string>()
  candidates.forEach(c => {
    c.skills.forEach(s => allSkills.add(s))
  })
  
  const skillCoverage = Array.from(allSkills).map(skill => {
    const coverage = candidates.filter(c => c.skills.includes(skill)).length
    const missing = candidates.length - coverage
    return {
      skill,
      required: true,
      coverage: Math.round((coverage / candidates.length) * 100),
      missing,
    }
  }).sort((a, b) => b.coverage - a.coverage).slice(0, 9)

  if (activeTab === 'candidates') {
    return <CandidatesTab onSelectCandidate={onSelectCandidate} candidates={candidates} onToggleShortlist={onToggleShortlist} />
  }

  if (activeTab === 'analytics') {
    return <AnalyticsTab candidates={candidates} />
  }

  // Fallback if something goes wrong
  if (candidates.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-[16px] font-600 text-[#6B7280] mb-2">No candidates found</div>
          <div className="text-[13px] text-[#9CA3AF]">Try starting a new analysis</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in-up">
      {/* Page header */}
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-800 text-[#111827] tracking-tight">Recruitment Overview</h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">
            AI analysis results for{' '}
            <span className="font-500 text-[#374151]">{currentAnalysis?.job_title || 'Job Position'}</span>
          </p>
        </div>
        {onExportReport && (
          <button type="button" onClick={onExportReport} className="btn-secondary">
            <Download className="size-4" />
            Export report
          </button>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="Total Candidates"
          value={candidates.length}
          delay={0}
          icon={
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="7" cy="6" r="3" stroke="#635BFF" strokeWidth="1.4" fill="none" />
              <path d="M2 15c0-3.314 2.239-6 5-6s5 2.686 5 6" stroke="#635BFF" strokeWidth="1.4" strokeLinecap="round" fill="none" />
              <circle cx="13.5" cy="6.5" r="2" stroke="#9CA3AF" strokeWidth="1.2" fill="none" />
              <path d="M12 15c0-2 .9-3.7 2.2-4.6" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" fill="none" />
            </svg>
          }
        />
        <KpiCard
          label="Strong Matches"
          value={strongMatches}
          delay={0.06}
          icon={
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 2L10.73 6.6L15.5 7.35L12.25 10.52L13.09 15.27L9 13L4.91 15.27L5.75 10.52L2.5 7.35L7.27 6.6L9 2Z" stroke="#10B981" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
            </svg>
          }
        />
        <KpiCard
          label="Average Match"
          value={avgMatch}
          suffix="%"
          delay={0.12}
          icon={
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="7" stroke="#F59E0B" strokeWidth="1.4" fill="none" />
              <path d="M9 5v4l2.5 2.5" stroke="#F59E0B" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <KpiCard
          label="Critical Skill Gaps"
          value={skillCoverage.reduce((sum, s) => sum + s.missing, 0)}
          delay={0.18}
          icon={
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 1L11 7H17L12 11L14 17L9 13L4 17L6 11L1 7H7L9 1Z" stroke="#EF4444" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
            </svg>
          }
        />
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-5 gap-4">
        {/* Candidate Fit Matrix */}
        <div
          className="col-span-3 bg-white rounded-lg border border-[#E5E7EB] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[14px] font-700 text-[#111827]">Candidate Fit Matrix</h3>
              <p className="text-[12px] text-[#9CA3AF] mt-0.5">Comprehensive match analysis</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[11px] font-600 text-[#9CA3AF] uppercase tracking-wider">
                  <th className="text-left pb-3 font-500">Candidate</th>
                  <th className="text-right pb-3 font-500">Semantic Fit</th>
                  <th className="text-right pb-3 font-500">Skill Match</th>
                  <th className="text-right pb-3 font-500">Experience</th>
                  <th className="text-right pb-3 font-500">Overall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {topCandidates.map((c, idx) => (
                  <tr
                    key={c.id}
                    onClick={() => onSelectCandidate(c.id)}
                    className="group cursor-pointer hover:bg-[#F7F8FA] transition-all duration-200 hover-scale"
                  >
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 flex-shrink-0 text-[10px] font-700 text-white rounded-full flex items-center justify-center" style={{ backgroundColor: getInitialsColor(c.initials) }}>
                          {c.initials}
                        </div>
                        <span className="text-[12px] font-600 text-[#111827] group-hover:text-[#635BFF] transition-colors">
                          {c.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="text-[12px] font-700" style={{ color: getMatchColor(c.semanticMatch) }}>
                        {c.semanticMatch}%
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="text-[12px] font-700" style={{ color: getMatchColor(c.skillMatch) }}>
                        {c.skillMatch}%
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="text-[12px] font-700" style={{ color: getMatchColor(c.experienceMatch) }}>
                        {c.experienceMatch}%
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="text-[13px] font-800" style={{ color: getMatchColor(c.match) }}>
                        {c.match}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Match Distribution */}
        <div
          className="col-span-2 bg-white rounded-lg border border-[#E5E7EB] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[14px] font-700 text-[#111827]">Match Distribution</h3>
              <p className="text-[12px] text-[#9CA3AF] mt-0.5">{candidates.length} candidates analyzed</p>
            </div>
          </div>
          <BarChart distribution={distribution} />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Candidate ranking table */}
        <div
          className="col-span-2 bg-white rounded-lg border border-[#E5E7EB] overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-[#F3F4F6] flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-700 text-[#111827]">Candidate Ranking</h3>
              <p className="text-[12px] text-[#9CA3AF] mt-0.5">
                {filteredCandidates.length} of {candidates.length} candidates shown
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  value={candidateQuery}
                  onChange={(event) => setCandidateQuery(event.target.value)}
                  placeholder="Search candidates..."
                  className="w-48 pl-8 pr-3 py-1.5 text-[12px] border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#635BFF] focus:ring-1 focus:ring-[#635BFF]"
                />
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="5.5" cy="5.5" r="4" stroke="#9CA3AF" strokeWidth="1.2" fill="none" />
                  <path d="M10 10l-1.5-1.5" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowFilters((current) => !current)}
                  className="flex items-center gap-1.5 text-[12px] text-[#6B7280] bg-[#F7F8FA] px-3 py-1.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1 3h10M3 6h6M5 9h2" stroke="#6B7280" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </button>

                {showFilters && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-lg z-20">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-600 uppercase tracking-wider text-[#9CA3AF] mb-1">
                          Recommendation
                        </label>
                        <select
                          value={recommendationFilter}
                          onChange={(event) => setRecommendationFilter(event.target.value as 'all' | Candidate['recommendation'])}
                          className="w-full rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[12px] text-[#374151] focus:outline-none focus:border-[#635BFF]"
                        >
                          <option value="all">All</option>
                          <option value="Strong Match">Strong Match</option>
                          <option value="Good Match">Good Match</option>
                          <option value="Moderate Match">Moderate Match</option>
                          <option value="Weak Match">Weak Match</option>
                        </select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-600 uppercase tracking-wider text-[#9CA3AF]">
                            Minimum match
                          </label>
                          <span className="text-[11px] font-600 text-[#374151]">{minMatch}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={minMatch}
                          onChange={(event) => setMinMatch(Number(event.target.value))}
                          className="w-full accent-[#635BFF]"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setRecommendationFilter('all')
                          setMinMatch(0)
                        }}
                        className="w-full rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] px-2.5 py-1.5 text-[12px] font-600 text-[#374151] hover:bg-[#F3F4F6]"
                      >
                        Reset filters
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[40px_1fr_100px_1fr_90px_110px] px-5 py-2.5 bg-[#F7F8FA] border-b border-[#F3F4F6] text-[11px] font-600 text-[#9CA3AF] uppercase tracking-wider">
            <span>Rank</span>
            <span>Candidate</span>
            <span>Overall</span>
            <span>Top Skills</span>
            <span>Exp.</span>
            <span>Status</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-[#F3F4F6]">
            {filteredCandidates.length === 0 ? (
              <div className="px-5 py-8 text-center text-[12px] text-[#6B7280]">
                No candidates match the current search and filter settings.
              </div>
            ) : (
              filteredCandidates.map((c, idx) => (
                <button
                  key={c.id}
                  onClick={() => onSelectCandidate(c.id)}
                  className="w-full grid grid-cols-[40px_1fr_100px_1fr_90px_110px] items-center px-5 py-3 hover:bg-[#F7F8FF] transition-all duration-200 text-left group hover-scale"
                >
                  <span className="text-[12px] font-600 text-[#9CA3AF]">{idx + 1}</span>

                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div
                      className="w-7 h-7 flex-shrink-0 text-[11px] font-700 text-white rounded-full flex items-center justify-center"
                      style={{ backgroundColor: getInitialsColor(c.initials) }}
                    >
                      {c.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-600 text-[#111827] truncate group-hover:text-[#635BFF] transition-colors">
                        {c.name}
                      </div>
                      <div className="text-[11px] text-[#9CA3AF] truncate">{c.title}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-[#F3F4F6] rounded-full h-1.5 max-w-[44px] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${c.match}%`, backgroundColor: getMatchColor(c.match) }}
                      />
                    </div>
                    <span className="text-[12px] font-700" style={{ color: getMatchColor(c.match) }}>
                      {c.match}%
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1 pr-2">
                    {c.skills.slice(0, 3).map((s) => (
                      <span key={s} className="text-[10px] font-500 bg-[#F3F4F6] text-[#6B7280] px-1.5 py-0.5 rounded">
                        {s}
                      </span>
                    ))}
                    {c.skills.length > 3 && (
                      <span className="text-[10px] text-[#9CA3AF]">+{c.skills.length - 3}</span>
                    )}
                  </div>

                  <span className="text-[12px] text-[#6B7280]">{c.experience}</span>

                  <RecommendationBadge rec={c.recommendation} />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Skill analysis */}
        <div
          className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-[#F3F4F6]">
            <h3 className="text-[14px] font-700 text-[#111827]">Skill Coverage</h3>
            <p className="text-[12px] text-[#9CA3AF] mt-0.5">Required skills across candidates</p>
          </div>
          <div className="px-5 py-4 space-y-4">
            {skillCoverage.map((item) => (
              <div key={item.skill}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-500 text-[#374151]">{item.skill}</span>
                    {item.required && (
                      <span className="text-[9px] font-600 text-[#635BFF] bg-[#EEF0FF] px-1 py-0.5 rounded">REQ</span>
                    )}
                  </div>
                  <span className="text-[12px] font-600 text-[#374151]">{item.coverage}%</span>
                </div>
                <div className="w-full bg-[#F3F4F6] rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full animate-progress-smooth"
                    style={{
                      '--target-width': `${item.coverage}%`,
                      width: `${item.coverage}%`,
                      backgroundColor: item.required ? '#635BFF' : '#9CA3AF',
                      opacity: item.required ? 1 : 0.6,
                    } as React.CSSProperties}
                  />
                </div>
                <div className="mt-1 text-[10px] text-[#9CA3AF]">
                  {item.missing} candidates missing this skill
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function CandidatesTab({ onSelectCandidate, candidates, onToggleShortlist }: { onSelectCandidate: (id: string) => void; candidates: Candidate[]; onToggleShortlist?: (id:string,value:boolean)=>void }) {
  return (
    <div className="p-6 animate-fade-in-up">
      <div className="mb-5">
        <h1 className="text-[22px] font-800 text-[#111827] tracking-tight">All Candidates</h1>
        <p className="text-[13px] text-[#6B7280] mt-0.5">{candidates.length} candidates · Ranked by AI match score</p>
      </div>
      <div
        className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden"
      >
        <div className="grid grid-cols-[48px_1fr_120px_1fr_100px_120px_140px] px-6 py-3 bg-[#F7F8FA] border-b border-[#E5E7EB] text-[11px] font-600 text-[#9CA3AF] uppercase tracking-wider">
          <span>Rank</span>
          <span>Candidate</span>
          <span>Match</span>
          <span>Skills</span>
          <span>Experience</span>
          <span>Location</span>
          <span>Recommendation</span>
        </div>
        <div className="divide-y divide-[#F3F4F6]">
          {candidates.map((c, idx) => (
            <button
              key={c.id}
              onClick={() => onSelectCandidate(c.id)}
              className="w-full grid grid-cols-[48px_1fr_120px_1fr_100px_120px_140px] items-center px-6 py-4 hover:bg-[#F7F8FF] transition-all duration-200 text-left group hover-scale"
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#F7F8FA] text-[12px] font-700 text-[#6B7280]">
                {idx + 1}
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full text-[12px] font-700 text-white flex items-center justify-center flex-shrink-0" style={{ backgroundColor: getInitialsColor(c.initials) }}>
                  {c.initials}
                </div>
                <div>
                  <div className="text-[13px] font-600 text-[#111827] group-hover:text-[#635BFF] transition-colors">{c.name}</div>
                  <div className="text-[12px] text-[#9CA3AF]">{c.title}</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 bg-[#F3F4F6] rounded-full h-1.5 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${c.match}%`, backgroundColor: getMatchColor(c.match) }} />
                </div>
                <span className="text-[13px] font-700" style={{ color: getMatchColor(c.match) }}>{c.match}%</span>
              </div>
              <div className="flex flex-wrap gap-1 pr-4">
                {c.skills.slice(0, 4).map((s) => (
                  <span key={s} className="text-[11px] bg-[#F3F4F6] text-[#6B7280] px-1.5 py-0.5 rounded font-400">{s}</span>
                ))}
                {c.skills.length > 4 && <span className="text-[11px] text-[#9CA3AF]">+{c.skills.length - 4}</span>}
              </div>
              <span className="text-[13px] text-[#6B7280]">{c.experience}</span>
              <span className="text-[12px] text-[#6B7280]">{c.location}</span>
              <div><RecommendationBadge rec={c.recommendation} /></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function SkillsTab({ candidates }: { candidates: Candidate[] }) {
  // Calculate skill coverage from real candidates
  const allSkills = new Set<string>()
  candidates.forEach(c => {
    c.skills.forEach(s => allSkills.add(s))
  })
  
  const skillCoverage = Array.from(allSkills).map(skill => {
    const coverage = candidates.filter(c => c.skills.includes(skill)).length
    const missing = candidates.length - coverage
    return {
      skill,
      required: true,
      coverage: Math.round((coverage / candidates.length) * 100),
      missing,
    }
  }).sort((a, b) => b.coverage - a.coverage)
  
  const requiredSkills = skillCoverage.slice(0, 6)
  const optionalSkills = skillCoverage.slice(6)

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="mb-5">
        <h1 className="text-[22px] font-800 text-[#111827] tracking-tight">Skills Analysis</h1>
        <p className="text-[13px] text-[#6B7280] mt-0.5">Coverage breakdown across all candidates</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
          <h3 className="text-[14px] font-700 text-[#111827] mb-4">Top Skills Coverage</h3>
          <div className="space-y-5">
            {requiredSkills.map((item) => (
              <div key={item.skill}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-600 text-[#374151]">{item.skill}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[#9CA3AF]">{item.missing} gaps</span>
                    <span className="text-[13px] font-700 text-[#635BFF]">{item.coverage}%</span>
                  </div>
                </div>
                <div className="w-full bg-[#F3F4F6] rounded-full h-2 overflow-hidden">
                  <div className="h-full rounded-full animate-progress-smooth" style={{ '--target-width': `${item.coverage}%`, width: `${item.coverage}%`, backgroundColor: '#635BFF' } as React.CSSProperties} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
          <h3 className="text-[14px] font-700 text-[#111827] mb-4">Other Skills Coverage</h3>
          <div className="space-y-5">
            {optionalSkills.map((item) => (
              <div key={item.skill}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-600 text-[#374151]">{item.skill}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[#9CA3AF]">{item.missing} gaps</span>
                    <span className="text-[13px] font-700 text-[#9CA3AF]">{item.coverage}%</span>
                  </div>
                </div>
                <div className="w-full bg-[#F3F4F6] rounded-full h-2 overflow-hidden">
                  <div className="h-full rounded-full animate-progress-smooth" style={{ '--target-width': `${item.coverage}%`, width: `${item.coverage}%`, backgroundColor: '#9CA3AF' } as React.CSSProperties} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function AnalyticsTab({ candidates }: { candidates: Candidate[] }) {
  // Calculate actual histogram bins from real data
  const matchScores = candidates.map(c => c.match)
  const histogramBins = [
    { range: '60-69', min: 60, max: 69, count: matchScores.filter(s => s >= 60 && s <= 69).length, color: '#EF4444' },
    { range: '70-79', min: 70, max: 79, count: matchScores.filter(s => s >= 70 && s <= 79).length, color: '#F59E0B' },
    { range: '80-89', min: 80, max: 89, count: matchScores.filter(s => s >= 80 && s <= 89).length, color: '#635BFF' },
    { range: '90-100', min: 90, max: 100, count: matchScores.filter(s => s >= 90 && s <= 100).length, color: '#10B981' },
  ]
  
  // Calculate actual statistics
  const mean = matchScores.length > 0 ? matchScores.reduce((a, b) => a + b, 0) / matchScores.length : 0
  const sortedScores = [...matchScores].sort((a, b) => a - b)
  const median = sortedScores.length > 0 ? sortedScores[Math.floor(sortedScores.length / 2)] : 0
  const variance = matchScores.length > 0 ? matchScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / matchScores.length : 0
  const stdDev = Math.sqrt(variance)

  const validCandidates = candidates.filter(c => c.experience && !isNaN(parseInt(c.experience)) && c.match > 0)
  const hasEnoughData = validCandidates.length >= 2

  const allSkills = Array.from(new Set(validCandidates.flatMap(c => c.skills))).slice(0, 9)
  const correlationMatrix = hasEnoughData ? allSkills.slice(0, 4).map(skill1 => {
    return allSkills.slice(0, 4).map(skill2 => {
      if (skill1 === skill2) return 1.0
      
      const candidatesWithSkill1 = validCandidates.filter(c => c.skills.includes(skill1))
      const candidatesWithSkill2 = validCandidates.filter(c => c.skills.includes(skill2))
      const candidatesWithBoth = validCandidates.filter(c => c.skills.includes(skill1) && c.skills.includes(skill2))
      
      if (candidatesWithSkill1.length === 0 || candidatesWithSkill2.length === 0) return 0
      
      // Simple correlation based on co-occurrence
      const expectedBoth = (candidatesWithSkill1.length / validCandidates.length) * (candidatesWithSkill2.length / validCandidates.length) * validCandidates.length
      const actualBoth = candidatesWithBoth.length
      const correlation = actualBoth / Math.max(expectedBoth, 1)
      
      return Math.min(correlation, 1.0)
    })
  }) : []

  // Calculate Experience vs Performance Correlation
  let expPerfCorrelation = 0
  if (hasEnoughData) {
    const meanExp = validCandidates.reduce((sum, c) => sum + parseInt(c.experience), 0) / validCandidates.length
    const meanMatch = validCandidates.reduce((sum, c) => sum + c.match, 0) / validCandidates.length
    let num = 0
    let den1 = 0
    let den2 = 0
    for (const c of validCandidates) {
      const expDiff = parseInt(c.experience) - meanExp
      const matchDiff = c.match - meanMatch
      num += expDiff * matchDiff
      den1 += expDiff * expDiff
      den2 += matchDiff * matchDiff
    }
    if (den1 > 0 && den2 > 0) {
      expPerfCorrelation = num / Math.sqrt(den1 * den2)
    }
  }

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="mb-5">
        <h1 className="text-[22px] font-800 text-[#111827] tracking-tight">Recruitment Analytics</h1>
        <p className="text-[13px] text-[#6B7280] mt-0.5">Advanced insights and hidden patterns in candidate data</p>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* 1. Large Scatter Plot: Multi-dimensional Analysis */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-700 text-[#111827]">Experience vs Performance Correlation</h3>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-[#6B7280]">Correlation:</span>
              <span className="font-700 text-[#635BFF]">{hasEnoughData ? `r = ${expPerfCorrelation.toFixed(2)}` : 'Insufficient data'}</span>
            </div>
          </div>
          <div className="relative h-80 bg-[#F7F8FA] rounded-lg p-4">
            <svg className="w-full h-full" viewBox="0 0 600 280">
              {/* Grid lines */}
              {[0, 20, 40, 60, 80, 100].map((y, idx) => (
                <line
                  key={idx}
                  x1="80"
                  y1={30 + (100 - y) * 2}
                  x2="560"
                  y2={30 + (100 - y) * 2}
                  stroke="#E5E7EB"
                  strokeWidth="0.5"
                />
              ))}
              {[0, 2, 4, 6, 8].map((x, idx) => (
                <line
                  key={idx}
                  x1={80 + x * 60}
                  y1="30"
                  x2={80 + x * 60}
                  y2="230"
                  stroke="#E5E7EB"
                  strokeWidth="0.5"
                />
              ))}
              
              {/* Axis labels */}
              <text x="320" y="275" textAnchor="middle" className="text-[11px] fill-[#6B7280]">Years of Experience</text>
              <text x="25" y="130" textAnchor="middle" transform="rotate(-90, 25, 130)" className="text-[11px] fill-[#6B7280]">Match Score %</text>
              
              {/* Y-axis labels */}
              {[0, 20, 40, 60, 80, 100].map((y, idx) => (
                <text
                  key={idx}
                  x="75"
                  y={34 + (100 - y) * 2}
                  textAnchor="end"
                  className="text-[10px] fill-[#9CA3AF]"
                >
                  {y}%
                </text>
              ))}
              
              {/* X-axis labels */}
              {[0, 2, 4, 6, 8].map((x, idx) => (
                <text
                  key={idx}
                  x={80 + x * 60}
                  y="252"
                  textAnchor="middle"
                  className="text-[10px] fill-[#9CA3AF]"
                >
                  {x}y
                </text>
              ))}
              
              {/* Data points with better spacing */}
              {candidates.map((candidate, idx) => {
                const years = parseInt(candidate.experience) || 0
                const x = 80 + years * 60
                const y = 30 + (100 - candidate.match) * 2
                const size = 14 + (candidate.match / 100) * 10
                const color = getMatchColor(candidate.match)
                
                return (
                  <g key={candidate.id}>
                    <circle
                      cx={x}
                      cy={y}
                      r={size / 2}
                      fill={color}
                      opacity={0.75}
                      className="hover:opacity-100 transition-opacity cursor-pointer"
                    />
                    <text
                      x={x}
                      y={y - size / 2 - 6}
                      textAnchor="middle"
                      className="text-[10px] fill-[#111827] font-700"
                    >
                      {candidate.initials}
                    </text>
                  </g>
                )
              })}
              
              {/* Trend line */}
              <line
                x1="80"
                y1="200"
                x2="560"
                y2="50"
                stroke="#635BFF"
                strokeWidth="2"
                strokeDasharray="6,4"
                opacity={0.5}
              />
            </svg>
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] text-[#6B7280]">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-[#10B981]" />
                <span>Strong (&gt;85%)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-[#635BFF]" />
                <span>Good (70-84%)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                <span>Moderate (60-69%)</span>
              </div>
            </div>
            <span>Bubble size = Match score</span>
          </div>
        </div>

        {/* 2. Enhanced Box Plot with Violin-style Distribution */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-700 text-[#111827]">Skill Dimension Distribution</h3>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-[#6B7280]">Candidates:</span>
              <span className="font-700 text-[#635BFF]">{candidates.length}</span>
            </div>
          </div>
          <div className="relative h-56">
            <svg className="w-full h-full" viewBox="0 0 400 180">
              {/* Background grid */}
              {[50, 60, 70, 80, 90, 100].map((value, idx) => (
                <line
                  key={idx}
                  x1="70"
                  y1={25 + (100 - value) * 1.4}
                  x2="370"
                  y2={25 + (100 - value) * 1.4}
                  stroke="#E5E7EB"
                  strokeWidth="0.5"
                />
              ))}
              
              {/* Y-axis labels */}
              {[50, 60, 70, 80, 90, 100].map((value, idx) => (
                <text
                  key={idx}
                  x="65"
                  y={29 + (100 - value) * 1.4}
                  textAnchor="end"
                  className="text-[9px] fill-[#9CA3AF]"
                >
                  {value}%
                </text>
              ))}
              
              {/* Box plots for each dimension */}
              {[
                { label: 'Semantic', data: candidates.map(c => c.semanticMatch), color: '#635BFF', x: 130 },
                { label: 'Skills', data: candidates.map(c => c.skillMatch), color: '#10B981', x: 220 },
                { label: 'Experience', data: candidates.map(c => c.experienceMatch), color: '#F59E0B', x: 310 },
              ].map((dimension, idx) => {
                const sorted = [...dimension.data].sort((a, b) => a - b)
                const q1 = sorted[Math.floor(sorted.length * 0.25)]
                const median = sorted[Math.floor(sorted.length * 0.5)]
                const q3 = sorted[Math.floor(sorted.length * 0.75)]
                const min = sorted[0]
                const max = sorted[sorted.length - 1]
                
                return (
                  <g key={dimension.label}>
                    {/* Whisker line */}
                    <line
                      x1={dimension.x}
                      y1={25 + (100 - max) * 1.4}
                      x2={dimension.x}
                      y2={25 + (100 - min) * 1.4}
                      stroke="#9CA3AF"
                      strokeWidth="2"
                    />
                    
                    {/* Whisker caps */}
                    <line
                      x1={dimension.x - 15}
                      y1={25 + (100 - max) * 1.4}
                      x2={dimension.x + 15}
                      y2={25 + (100 - max) * 1.4}
                      stroke="#9CA3AF"
                      strokeWidth="2"
                    />
                    <line
                      x1={dimension.x - 15}
                      y1={25 + (100 - min) * 1.4}
                      x2={dimension.x + 15}
                      y2={25 + (100 - min) * 1.4}
                      stroke="#9CA3AF"
                      strokeWidth="2"
                    />
                    
                    {/* Box */}
                    <rect
                      x={dimension.x - 20}
                      y={25 + (100 - q3) * 1.4}
                      width="40"
                      height={(q3 - q1) * 1.4}
                      fill={dimension.color}
                      fillOpacity={0.2}
                      stroke={dimension.color}
                      strokeWidth="2"
                      rx="2"
                    />
                    
                    {/* Median line */}
                    <line
                      x1={dimension.x - 20}
                      y1={25 + (100 - median) * 1.4}
                      x2={dimension.x + 20}
                      y2={25 + (100 - median) * 1.4}
                      stroke="#111827"
                      strokeWidth="2"
                    />
                    
                    {/* Individual data points */}
                    {dimension.data.map((value, pointIdx) => (
                      <circle
                        key={pointIdx}
                        cx={dimension.x + (Math.random() - 0.5) * 30}
                        cy={25 + (100 - value) * 1.4}
                        r="3"
                        fill={dimension.color}
                        opacity={0.4}
                      />
                    ))}
                    
                    {/* Label */}
                    <text
                      x={dimension.x}
                      y="172"
                      textAnchor="middle"
                      className="text-[11px] fill-[#111827] font-600"
                    >
                      {dimension.label}
                    </text>
                    <text
                      x={dimension.x}
                      y="162"
                      textAnchor="middle"
                      className="text-[9px] fill-[#6B7280]"
                    >
                      {median}%
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] text-[#6B7280]">
            <div className="flex items-center gap-4">
              <span>Box: IQR (25-75%)</span>
              <span>Line: Median</span>
              <span>Dots: Individual candidates</span>
            </div>
            <span>Whiskers: Min-Max range</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* 3. Comprehensive Skill Correlation Heatmap */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 flex flex-col">
          <h3 className="text-[15px] font-700 text-[#111827] mb-4">Skill Correlation Matrix</h3>
          {!hasEnoughData ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              Insufficient data for correlation analysis
            </div>
          ) : (
            <>
              <div className="relative">
                <svg className="w-full h-48" viewBox="0 0 280 180">
                  {allSkills.slice(0, 5).map((skill, rowIdx) => (
                    <g key={skill}>
                      {/* Row label */}
                      <text
                        x="25"
                        y={30 + rowIdx * 30}
                        textAnchor="end"
                        className="text-[9px] fill-[#6B7280] font-600"
                      >
                        {skill.slice(0, 6)}
                      </text>
                      
                      {allSkills.slice(0, 5).map((_, colIdx) => {
                        const correlation = correlationMatrix[rowIdx]?.[colIdx] || 0
                        const intensity = Math.abs(correlation)
                        const bgColor = correlation > 0 
                          ? `rgba(16, 185, 129, ${Math.max(intensity, 0.15)})` 
                          : `rgba(239, 68, 68, ${Math.max(intensity, 0.15)})`
                        
                        return (
                          <rect
                            key={colIdx}
                            x={35 + colIdx * 45}
                            y={12 + rowIdx * 30}
                            width="40"
                            height="24"
                            fill={bgColor}
                            rx="2"
                          />
                        )
                      })}
                    </g>
                  ))}
                  
                  {/* Column labels */}
                  {allSkills.slice(0, 5).map((skill, colIdx) => (
                    <text
                      key={skill}
                      x={55 + colIdx * 45}
                      y="10"
                      textAnchor="middle"
                      className="text-[9px] fill-[#6B7280] font-600"
                    >
                      {skill.slice(0, 6)}
                    </text>
                  ))}
                  
                  {/* Correlation values */}
                  {allSkills.slice(0, 5).map((_, rowIdx) => (
                    allSkills.slice(0, 5).map((_, colIdx) => {
                      const correlation = correlationMatrix[rowIdx]?.[colIdx] || 0
                      const intensity = Math.abs(correlation)
                      const textColor = intensity > 0.6 ? 'white' : '#111827'
                      
                      return (
                        <text
                          key={`${rowIdx}-${colIdx}`}
                          x={55 + colIdx * 45}
                          y={28 + rowIdx * 30}
                          textAnchor="middle"
                          className="text-[8px] font-600"
                          style={{ fill: textColor }}
                        >
                          {correlation.toFixed(2)}
                        </text>
                      )
                    })
                  ))}
                </svg>
              </div>
              <div className="mt-4 flex items-center justify-between text-[10px] text-[#6B7280]">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-[#10B981]" />
                    <span>Positive</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-[#EF4444]" />
                    <span>Negative</span>
                  </div>
                </div>
                <span>Based on skill co-occurrence</span>
              </div>
            </>
          )}
        </div>

        {/* 4. Large Radar Chart for Top Candidates */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-6">
          <h3 className="text-[15px] font-700 text-[#111827] mb-4">Top Candidates Comparison</h3>
          <div className="relative h-52">
            <svg className="w-full h-full" viewBox="0 0 300 200">
              {/* Background grid - hexagon for 6 dimensions */}
              {[20, 40, 60, 80, 100].map((radius, idx) => (
                <polygon
                  key={idx}
                  points={[
                    150, 20 + (100 - radius) * 1.6,
                    150 + radius * 1.2, 60,
                    150 + radius * 0.8, 140,
                    150, 180 - (100 - radius) * 0.4,
                    150 - radius * 0.8, 140,
                    150 - radius * 1.2, 60,
                  ].join(',')}
                  fill="none"
                  stroke="#E5E7EB"
                  strokeWidth="0.5"
                />
              ))}
              
              {/* Axis lines */}
              {[0, 1, 2, 3, 4, 5].map((idx) => {
                const angle = (idx * 60 - 90) * Math.PI / 180
                const x1 = 150
                const y1 = 100
                const x2 = 150 + 100 * Math.cos(angle)
                const y2 = 100 + 100 * Math.sin(angle)
                return (
                  <line
                    key={idx}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#E5E7EB"
                    strokeWidth="0.5"
                  />
                )
              })}
              
              {/* Candidate polygons - top 3 */}
              {candidates.slice(0, 3).map((candidate, idx) => {
                const color = idx === 0 ? '#10B981' : idx === 1 ? '#635BFF' : '#F59E0B'
                const semantic = candidate.semanticMatch
                const skills = candidate.skillMatch
                const experience = candidate.experienceMatch
                const overall = candidate.match
                const skillsCount = candidate.skills.length
                const projectCount = candidate.projects.length
                
                // Normalize all to 0-100 scale
                const normalizedSkills = Math.min((skillsCount / 7) * 100, 100)
                const normalizedProjects = Math.min((projectCount / 3) * 100, 100)
                
                const dimensions = [semantic, skills, normalizedSkills, experience, overall, normalizedProjects]
                const points = dimensions.map((value, dimIdx) => {
                  const angle = (dimIdx * 60 - 90) * Math.PI / 180
                  const x = 150 + value * Math.cos(angle)
                  const y = 100 + value * Math.sin(angle)
                  return `${x},${y}`
                }).join(' ')
                
                return (
                  <polygon
                    key={candidate.id}
                    points={points}
                    fill={color}
                    fillOpacity={0.12}
                    stroke={color}
                    strokeWidth="2"
                  />
                )
              })}
              
              {/* Labels */}
              {['Semantic', 'Skills', 'Count', 'Experience', 'Overall', 'Projects'].map((label, idx) => {
                const angle = (idx * 60 - 90) * Math.PI / 180
                const x = 150 + 115 * Math.cos(angle)
                const y = 100 + 115 * Math.sin(angle)
                return (
                  <text
                    key={label}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    className="text-[9px] fill-[#6B7280] font-600"
                  >
                    {label}
                  </text>
                )
              })}
            </svg>
          </div>
          <div className="mt-4 flex items-center justify-center gap-4 text-[10px]">
            {candidates.slice(0, 3).map((candidate, idx) => {
              const color = idx === 0 ? '#10B981' : idx === 1 ? '#635BFF' : '#F59E0B'
              return (
                <div key={candidate.id} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[#6B7280]">{candidate.name.split(' ')[0]}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 5. Match Score Distribution with Density */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-6">
          <h3 className="text-[15px] font-700 text-[#111827] mb-4">Match Score Distribution</h3>
          <div className="relative h-52">
            <svg className="w-full h-full" viewBox="0 0 280 200">
              {/* Background grid */}
              {[0, 1, 2, 3, 4].map((idx) => (
                <line
                  key={idx}
                  x1="40"
                  y1={30 + idx * 30}
                  x2="260"
                  y2={30 + idx * 30}
                  stroke="#E5E7EB"
                  strokeWidth="0.5"
                />
              ))}
              
              {/* Y-axis labels */}
              {[0, 1, 2, 3, 4].map((idx) => (
                <text
                  key={idx}
                  x="35"
                  y={34 + idx * 30}
                  textAnchor="end"
                  className="text-[9px] fill-[#9CA3AF]"
                >
                  {idx}
                </text>
              ))}
              
              {/* Histogram bars */}
              {histogramBins.map((bin, idx) => {
                const maxCount = Math.max(...histogramBins.map(b => b.count))
                const barHeight = maxCount > 0 ? (bin.count / maxCount) * 120 : 0
                const x = 50 + idx * 50
                const y = 150 - barHeight
                
                return (
                  <g key={bin.range}>
                    <rect
                      x={x}
                      y={y}
                      width="40"
                      height={barHeight}
                      fill={bin.color}
                      rx="4"
                      opacity={0.8}
                    />
                    <text
                      x={x + 20}
                      y={y - 8}
                      textAnchor="middle"
                      className="text-[11px] fill-[#111827] font-700"
                    >
                      {bin.count}
                    </text>
                    <text
                      x={x + 20}
                      y={165}
                      textAnchor="middle"
                      className="text-[9px] fill-[#6B7280]"
                    >
                      {bin.range}
                    </text>
                  </g>
                )
              })}
              
              {/* Density curve approximation */}
              <path
                d={`M 70,150 Q 95,150 120,130 T 170,90 T 220,50 T 270,150`}
                fill="none"
                stroke="#635BFF"
                strokeWidth="2"
                strokeDasharray="4,4"
                opacity={0.6}
              />
            </svg>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] text-[#6B7280]">
            <div className="text-center">
              <span className="block text-[#9CA3AF]">Mean</span>
              <span className="font-700 text-[#111827]">{mean.toFixed(1)}%</span>
            </div>
            <div className="text-center">
              <span className="block text-[#9CA3AF]">Median</span>
              <span className="font-700 text-[#111827]">{median}%</span>
            </div>
            <div className="text-center">
              <span className="block text-[#9CA3AF]">Std Dev</span>
              <span className="font-700 text-[#111827]">{stdDev.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function JobAnalysisTab({ currentAnalysis }: { currentAnalysis: any }) {
  // Use real data from the analysis if available
  // Handle both old array format and new dict format
  const requirementsData = currentAnalysis?.requirements
  let requirements = []

  const candidates = currentAnalysis?.candidates || []
  const totalCandidates = candidates.length

  const getMatchCount = (req: string) => {
    let count = 0
    const reqLower = req.toLowerCase()
    for (const c of candidates) {
      if (c.skills?.some((s: string) => s.toLowerCase().includes(reqLower) || reqLower.includes(s.toLowerCase()))) {
        count++
      }
    }
    return count
  }

  if (Array.isArray(requirementsData)) {
    // Old format: simple array
    requirements = requirementsData.map((req: string) => ({
      req,
      weight: 'High' as const,
      matched: getMatchCount(req)
    }))
  } else if (requirementsData && typeof requirementsData === 'object') {
    // New format: dict with required and preferred
    const allReqs = [
      ...(requirementsData.required || []).map((req: string) => ({ req, weight: 'High' as const, matched: getMatchCount(req) })),
      ...(requirementsData.preferred || []).map((req: string) => ({ req, weight: 'Medium' as const, matched: getMatchCount(req) }))
    ]
    requirements = allReqs
  }

  if (requirements.length === 0) {
    requirements = [{ req: 'No requirements extracted', weight: 'Medium' as const, matched: 0 }]
  }

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="mb-5">
        <h1 className="text-[22px] font-800 text-[#111827] tracking-tight">Job Analysis</h1>
        <p className="text-[13px] text-[#6B7280] mt-0.5">{currentAnalysis?.job_title || 'Job Analysis'}</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F3F4F6]">
            <h3 className="text-[14px] font-700 text-[#111827]">Extracted Requirements</h3>
          </div>
          <div className="divide-y divide-[#F3F4F6]">
            {requirements.map((r) => (
              <div key={r.req} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 text-[13px] text-[#374151]">{r.req}</div>
                <span className={`text-[11px] font-600 px-2 py-0.5 rounded-full ${r.weight === 'High' ? 'bg-[#FEF2F2] text-[#EF4444]' : r.weight === 'Medium' ? 'bg-[#FFFBEB] text-[#F59E0B]' : 'bg-[#F3F4F6] text-[#9CA3AF]'}`}>
                  {r.weight}
                </span>
                <div className="flex items-center gap-1.5 text-[12px] text-[#6B7280]">
                  <span className="font-600 text-[#10B981]">{r.matched}</span>
                  <span>/ {totalCandidates} matched</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
          <h3 className="text-[14px] font-700 text-[#111827] mb-4">Role Summary</h3>
          <div className="space-y-3 text-[13px] text-[#6B7280] leading-relaxed">
            <p>AI-powered job analysis based on extracted requirements.</p>
            <p>Skills and requirements are automatically identified from the job description.</p>
            <div className="mt-4 pt-4 border-t border-[#F3F4F6] space-y-2">
              <div className="flex justify-between"><span>Requirements extracted</span><span className="font-600 text-[#111827]">{requirements.length}</span></div>
              <div className="flex justify-between"><span>Candidates analyzed</span><span className="font-600 text-[#10B981]">{currentAnalysis?.candidate_count || 0}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
