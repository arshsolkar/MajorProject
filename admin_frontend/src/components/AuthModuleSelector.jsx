const modules = [
  ['candidate', 'Student'],
  ['recruiter', 'Recruiter'],
  ['admin_tpo', 'Admin / TPO'],
]

export default function AuthModuleSelector({ value, onChange }) {
  return <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="HireSense module">
    {modules.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={value === key} onClick={() => onChange(key)} className={`rounded-lg px-2 py-2 text-xs font-semibold transition sm:text-sm ${value === key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{label}</button>)}
  </div>
}
