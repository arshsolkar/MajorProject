import { BellRing, FileSearch, LogOut, Plus } from 'lucide-react'

interface TopBarProps {
  title: string
  eyebrow?: string
  onNewAnalysis: () => void
  onCreateJob: () => void
  onLogout: () => void
}

export default function TopBar({ title, eyebrow = 'Recruiter portal', onNewAnalysis, onCreateJob, onLogout }: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-[73px] items-center justify-between border-b border-slate-200 bg-white/90 px-8 backdrop-blur">
      <div>
        <p className="text-xs font-medium text-slate-400">{eyebrow}</p>
        <h1 className="text-lg font-semibold text-ink">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Open notifications">
          <BellRing className="size-5" />
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>
        <button type="button" onClick={onCreateJob} className="btn-secondary">
          <Plus className="size-4" />
          Create job
        </button>
        <button type="button" onClick={onNewAnalysis} className="btn-primary">
          <FileSearch className="size-4" />
          Analysis
        </button>
        <button type="button" onClick={onLogout} title="Log out" aria-label="Log out" className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50">
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  )
}
