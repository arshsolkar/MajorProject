import { useEffect, useState } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'

export const Status = ({ value }) => {
  const tones = { Verified: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', Eligible: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', Published: 'bg-blue-50 text-blue-700 ring-blue-600/20', Pending: 'bg-amber-50 text-amber-700 ring-amber-600/20', Review: 'bg-amber-50 text-amber-700 ring-amber-600/20', Draft: 'bg-slate-100 text-slate-600 ring-slate-500/20', Rejected: 'bg-red-50 text-red-700 ring-red-600/20', 'Not eligible': 'bg-red-50 text-red-700 ring-red-600/20', Active: 'bg-brand-50 text-brand-700 ring-brand-600/20' }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tones[value] || tones.Draft}`}>{value}</span>
}

export const SearchField = ({ value, onChange, placeholder = 'Search...' }) => {
  const [inputValue, setInputValue] = useState(value)

  useEffect(() => setInputValue(value), [value])
  useEffect(() => {
    if (inputValue === value) return undefined
    const timeout = setTimeout(() => onChange(inputValue), 300)
    return () => clearTimeout(timeout)
  }, [inputValue, onChange, value])

  return <label className="relative block min-w-[220px]"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input className="input pl-9" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder={placeholder} /></label>
}

export const Table = ({ columns, rows, render, empty = 'No records found.' }) => <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr>{columns.map((column) => <th className="whitespace-nowrap px-5 py-3.5" key={column}>{column}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.length ? rows.map(render) : <tr><td colSpan={columns.length} className="px-5 py-14 text-center text-slate-500">{empty}</td></tr>}</tbody></table></div>

export const Pagination = ({ page = 1, pageSize = 10, total = 0, onPageChange }) => { const first = total ? (page - 1) * pageSize + 1 : 0; const last = Math.min(page * pageSize, total); const hasPrevious = page > 1; const hasNext = last < total; return <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5 text-sm text-slate-500"><span>Showing {first}–{last} of {total} results</span><div className="flex gap-1"><button disabled={!hasPrevious} onClick={()=>onPageChange?.(page-1)} className="btn-secondary !px-2.5 !py-2 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Previous page"><ChevronLeft className="size-4" /></button><button disabled={!hasNext} onClick={()=>onPageChange?.(page+1)} className="btn-secondary !px-2.5 !py-2 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Next page"><ChevronRight className="size-4" /></button></div></div> }

export const Modal = ({ title, children, onClose }) => <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-6 py-4"><h2 id="modal-title" className="text-lg font-semibold text-ink">{title}</h2><button className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} aria-label="Close"><X className="size-5" /></button></div>{children}</div></div>

export const Empty = ({ title, message }) => <div className="flex flex-col items-center px-6 py-16 text-center"><div className="mb-3 rounded-full bg-slate-100 p-3"><AlertCircle className="size-5 text-slate-500" /></div><h3 className="font-semibold text-ink">{title}</h3><p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p></div>
