import {
  BarChart3,
  ChartNoAxesCombined,
  BriefcaseBusiness,
  ClipboardCheck,
  FileSearch,
  LayoutDashboard,
  LogOut,
  Mail,
  Plus,
  UserCircle,
  Users,
} from 'lucide-react'

export type SidebarTab = 'dashboard' | 'overview' | 'analysis' | 'jobs' | 'candidates' | 'shortlisted' | 'email' | 'analytics' | 'profile'

interface SidebarProps {
  activeTab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
  onNewAnalysis: () => void
  onCreateJob: () => void
  onLogout: () => void
  userName?: string
}

const navItems = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['overview', 'Recruitment overview', ChartNoAxesCombined],
  ['analysis', 'Resume analysis', FileSearch],
  ['jobs', 'Job openings', BriefcaseBusiness],
  ['candidates', 'Candidates', Users],
  ['shortlisted', 'Shortlisted', ClipboardCheck],
  ['email', 'Email', Mail],
  ['analytics', 'Analytics', BarChart3],
  ['profile', 'Profile', UserCircle],
] as const

export default function Sidebar({ activeTab, onTabChange, onNewAnalysis, onCreateJob, onLogout, userName }: SidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-ink-admin px-4 py-5">
      <div className="mb-9 flex items-center gap-3 px-3">
        <div className="grid size-9 place-items-center rounded-xl bg-brand-500 font-bold text-white">H</div>
        <div>
          <p className="font-semibold text-white">HireSense AI</p>
          <p className="text-xs text-slate-400">Recruiter Workspace</p>
        </div>
      </div>

      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        Recruitment
      </p>
      <nav className="space-y-1">
        {navItems.map(([id, label, Icon]) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                isActive ? 'bg-brand-500 text-white shadow-lg shadow-blue-950/20' : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="size-[18px]" />
              {label}
            </button>
          )
        })}
      </nav>

      <div className="mt-6 grid gap-2">
        <button type="button" onClick={onNewAnalysis} className="btn-primary w-full py-2.5">
          <FileSearch className="size-4" />
          New analysis
        </button>
        <button type="button" onClick={onCreateJob} className="btn-secondary w-full py-2.5">
          <Plus className="size-4" />
          Create job opening
        </button>
      </div>

      <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs text-slate-400">Signed in as</p>
        <p className="mt-1 truncate text-sm font-medium text-white">{userName || 'Recruiter'}</p>
        <p className="mt-0.5 text-xs text-slate-400">Recruiter module</p>
        <button
          type="button"
          onClick={onLogout}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-4" />
          Logout
        </button>
      </div>
    </aside>
  )
}
