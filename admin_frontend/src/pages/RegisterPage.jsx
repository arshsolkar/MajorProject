import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, CheckCircle2, ShieldCheck, Upload, X } from 'lucide-react'
import { register, registerRecruiterWithDocument } from '../lib/authApi'
import AuthModuleSelector from '../components/AuthModuleSelector'

const initialForm = { full_name: '', student_id: '', email: '', phone: '', company_name: '', company_identifier: '', company_website: '', company_email: '', company_phone: '', company_address: '', designation: '', institution_name: '', institution_identifier: '', password: '', confirmPassword: '' }
const copy = { candidate: ['Create your student account', 'Set up your placement workspace access.', 'Use your institution-issued student email.', 'Create student account'], recruiter: ['Create your recruiter account', 'Set up your employer workspace access.', 'Use your official company email.', 'Create recruiter account'], admin_tpo: ['Create your Admin / TPO account', 'Set up your institutional placement workspace access.', 'Use your official institutional email.', 'Create Admin / TPO account'] }
const extras = { candidate: [['student_id', 'Student/Enrollment ID'], ['phone', 'Phone number']], recruiter: [['phone', 'Phone'], ['designation', 'Designation'], ['company_name', 'Company name'], ['company_identifier', 'Company registration/identifier'], ['company_email', 'Company email/domain', false, 'email'], ['company_phone', 'Company phone'], ['company_address', 'Company address'], ['company_website', 'Company website', true]], admin_tpo: [['phone', 'Phone'], ['institution_name', 'Institution/College name'], ['institution_identifier', 'Institution identifier/code'], ['designation', 'Designation']] }
const allowedDocumentTypes = ['application/pdf', 'image/jpeg', 'image/png']

function Field({ name, label, type = 'text', optional = false, form, update }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}{optional ? ' (Optional)' : ''}</span><input required={!optional} type={type} value={form[name]} onChange={update(name)} className="input" autoComplete={type === 'password' ? 'new-password' : type === 'email' ? 'email' : undefined} /></label>
}

export default function RegisterPage() {
  const [form, setForm] = useState(initialForm), [module, setModule] = useState('candidate'), [submitted, setSubmitted] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState(''), [document, setDocument] = useState(null), [documentError, setDocumentError] = useState('')
  const navigate = useNavigate(); const [title, subtitle, helper, button] = copy[module]
  const update = (name) => (event) => setForm({ ...form, [name]: event.target.value })
  const documentValid = module !== 'recruiter' || Boolean(document)
  const valid = form.full_name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && form.password.length >= 8 && form.password === form.confirmPassword && extras[module].every(([name, , optional]) => optional || form[name].trim()) && documentValid
  const chooseDocument = (event) => {
    const file = event.target.files?.[0]; setDocumentError('')
    if (!file) return
    if (!allowedDocumentTypes.includes(file.type) || !/\.(pdf|jpe?g|png)$/i.test(file.name)) { setDocument(null); setDocumentError('Choose a PDF, JPG, JPEG, or PNG document.'); return }
    if (file.size > 10 * 1024 * 1024) { setDocument(null); setDocumentError('The verification document must be 10 MB or smaller.'); return }
    setDocument(file)
  }
  async function submit(event) {
    event.preventDefault(); setSubmitted(true); setError(''); if (!valid) return; setLoading(true)
    try {
      const base = { module, full_name: form.full_name, email: form.email, password: form.password }
      if (module === 'candidate') await register({ ...base, student_id: form.student_id, phone: form.phone })
      else if (module === 'recruiter') await registerRecruiterWithDocument({ ...base, phone: form.phone, designation: form.designation, company_name: form.company_name, company_identifier: form.company_identifier, company_email: form.company_email, company_phone: form.company_phone, company_address: form.company_address, company_website: form.company_website || null }, document)
      else await register({ ...base, phone: form.phone, institution_name: form.institution_name, institution_identifier: form.institution_identifier, designation: form.designation })
      navigate('/login', { replace: true, state: { registered: true } })
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to create your account. Please try again.') } finally { setLoading(false) }
  }
  return (
    <main className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(440px,0.92fr)]">
      <section className="relative hidden overflow-hidden bg-ink p-12 lg:flex lg:flex-col xl:p-16">
        <div className="absolute inset-0 opacity-30"><div className="absolute -left-20 top-24 size-96 rounded-full bg-brand-500 blur-3xl" /><div className="absolute bottom-0 right-0 size-80 rounded-full bg-blue-300 blur-3xl" /></div>
        <div className="relative flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-brand-500 text-lg font-bold text-white">H</div><div><p className="text-lg font-semibold text-white">HireSense AI</p><p className="text-sm text-slate-300">Placement Intelligence Platform</p></div></div>
        <div className="relative my-auto max-w-xl py-16"><p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">A better placement workflow</p><h1 className="text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">Bring every placement decision into focus.</h1><p className="mt-6 max-w-lg text-base leading-7 text-slate-300">HireSense AI gives your placement team, recruiters, and students one dependable workspace for campus hiring.</p><div className="mt-10 grid gap-4 sm:grid-cols-3">{[[BriefcaseBusiness, 'Partner-ready', 'Employer coordination'], [ShieldCheck, 'Role-aware', 'Purpose-built access'], [CheckCircle2, 'Placement-led', 'Clearer next steps']].map(([Icon, text, detail]) => <div className="rounded-2xl border border-white/10 bg-white/10 p-4" key={text}><Icon className="size-5 text-blue-200" /><p className="mt-5 text-sm font-semibold text-white">{text}</p><p className="mt-1 text-xs text-slate-300">{detail}</p></div>)}</div></div>
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:min-h-0 lg:px-12 xl:px-20"><div className="w-full max-w-md">
        <div className="mb-8"><p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-600">Create account</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{title}</h1><p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p></div>
        <div className="mb-6"><p className="mb-2 text-sm font-semibold text-slate-700">Select your module</p><AuthModuleSelector value={module} onChange={(value) => { setModule(value); setSubmitted(false); setError(''); setDocument(null); setDocumentError('') }} /><p className="mt-2 text-xs text-slate-500">{helper}</p></div>
        <form noValidate onSubmit={submit} className="space-y-4">
          <Field form={form} update={update} name="full_name" label="Full name" />
          <Field form={form} update={update} name="email" label={module === 'candidate' ? 'Email address' : module === 'recruiter' ? 'Official work email' : 'Official institutional email'} type="email" />
          {extras[module].map(([name, label, optional, type]) => module === 'admin_tpo' && name === 'designation' ? <label className="block" key={name}><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span><select required value={form.designation} onChange={update('designation')} className="input"><option value="">Select designation</option><option value="TPO">TPO</option><option value="Admin">Admin</option></select></label> : <Field form={form} update={update} key={name} name={name} label={label} optional={optional} type={type} />)}
          {module === 'recruiter' && <section className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-ink">Company Verification</p><p className="mt-1 text-xs leading-5 text-slate-500">Upload a PDF, JPG, or PNG company registration, authorization, or other valid company verification document.</p><label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-brand-700 hover:border-brand-400"><Upload className="size-4" /> Choose document<input className="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={chooseDocument} /></label>{document && <div className="mt-3 flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs text-slate-600"><span className="truncate pr-2">{document.name} · {document.type || 'document'} · {(document.size / 1024 / 1024).toFixed(2)} MB</span><button type="button" aria-label="Remove verification document" onClick={() => setDocument(null)} className="text-slate-400 hover:text-red-600"><X className="size-4" /></button></div>}{documentError && <p className="mt-2 text-xs text-red-600" role="alert">{documentError}</p>}</section>}
          <Field form={form} update={update} name="password" label="Password" type="password" /><Field form={form} update={update} name="confirmPassword" label="Confirm password" type="password" />
          {submitted && !valid && <p className="text-sm text-red-600" role="alert">Complete all required fields, upload a valid verification document, use a valid email, and make sure passwords match.</p>}{error && <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
          <button className="btn-primary w-full py-3" disabled={loading}>{loading ? 'Creating account…' : <>{button} <ArrowRight className="size-4" /></>}</button>
        </form>
        <p className="mt-8 text-center text-sm text-slate-500">Already have an account? <Link className="font-semibold text-brand-600 hover:text-brand-700" to="/login">Sign in</Link></p>
      </div></section>
    </main>
  )

}
