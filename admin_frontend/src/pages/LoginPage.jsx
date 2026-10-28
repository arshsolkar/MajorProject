import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { login } from '../lib/authApi'
import { useAuth } from '../auth/AuthContext'
import AuthModuleSelector from '../components/AuthModuleSelector'

const initialForm = { email: '', password: '', remember: false }

export default function LoginPage() {
  const [form, setForm] = useState(initialForm)
  const [showPassword, setShowPassword] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [module, setModule] = useState('admin_tpo')
  const navigate = useNavigate()
  const location = useLocation()
  const { setAuthSession } = useAuth()

  const emailError = submitted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
  const passwordError = submitted && form.password.length < 1

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitted(true)
    setLoginError('')

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) || form.password.length < 1) {
      return
    }

    setIsLoading(true)
    try {
      const response = await login({ module, email: form.email, password: form.password })
      const user = await setAuthSession(response.token, form.remember)
      if (!user) {
        throw new Error('Unable to verify your session. Please try again.')
      }
      navigate(user.module === 'recruiter' ? '/dashboard' : '/admin', { replace: true })
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Unable to sign in. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(440px,0.92fr)]">
      <section className="relative hidden overflow-hidden bg-ink p-12 lg:flex lg:flex-col xl:p-16">
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <div className="absolute -left-20 top-24 size-96 rounded-full bg-brand-500 blur-3xl" />
          <div className="absolute bottom-0 right-0 size-80 rounded-full bg-blue-300 blur-3xl" />
        </div>
        <div className="relative flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-brand-500 text-lg font-bold text-white shadow-lg shadow-blue-950/25">H</div>
          <div><p className="text-lg font-semibold text-white">HireSense AI</p><p className="text-sm text-slate-300">Placement Intelligence Platform</p></div>
        </div>
        <div className="relative my-auto max-w-xl py-16">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">A better placement workflow</p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">Bring every placement decision into focus.</h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-300">HireSense AI gives your placement team, recruiters, and students one dependable workspace for campus hiring.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[[BriefcaseBusiness, 'Partner-ready', 'Employer coordination'], [ShieldCheck, 'Role-aware', 'Purpose-built access'], [CheckCircle2, 'Placement-led', 'Clearer next steps']].map(([Icon, title, detail]) => <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm" key={title}><Icon className="size-5 text-blue-200" /><p className="mt-5 text-sm font-semibold text-white">{title}</p><p className="mt-1 text-xs leading-5 text-slate-300">{detail}</p></div>)}
          </div>
        </div>
        <p className="relative text-sm text-slate-400">© 2026 HireSense AI · Campus placement, made considered.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:min-h-0 lg:px-12 xl:px-20">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden"><div className="grid size-10 place-items-center rounded-xl bg-brand-500 font-bold text-white">H</div><div><p className="font-semibold text-ink">HireSense AI</p><p className="text-xs text-slate-500">Placement Intelligence Platform</p></div></div>
          <div className="mb-8"><p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-600">Welcome back</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Sign in to your account</h2><p className="mt-2 text-sm leading-6 text-slate-500">Use your institution-issued email to access your HireSense workspace.</p></div>
          <div className="mb-6"><p className="mb-2 text-sm font-semibold text-slate-700">Select your module</p><AuthModuleSelector value={module} onChange={setModule} /></div>
          {location.state?.registered && <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">Account created. Sign in with your new credentials.</div>}
          <form noValidate onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="email">Email address</label>
              <div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input id="email" type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} aria-invalid={emailError} aria-describedby={emailError ? 'email-error' : undefined} className={`input pl-10 ${emailError ? '!border-red-500 focus:!ring-red-100' : ''}`} placeholder="you@institution.edu" /></div>
              {emailError && <p id="email-error" className="mt-1.5 text-sm text-red-600" role="alert">Enter a valid email address.</p>}
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3"><label className="text-sm font-semibold text-slate-700" htmlFor="password">Password</label><button type="button" className="text-sm font-medium text-brand-600 hover:text-brand-700 focus:outline-none focus:underline">Forgot password?</button></div>
              <div className="relative"><LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} aria-invalid={passwordError} aria-describedby={passwordError ? 'password-error' : undefined} className={`input pl-10 pr-11 ${passwordError ? '!border-red-500 focus:!ring-red-100' : ''}`} placeholder="Enter your password" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-100" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>
              {passwordError && <p id="password-error" className="mt-1.5 text-sm text-red-600" role="alert">Password is required.</p>}
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600"><input type="checkbox" checked={form.remember} onChange={(event) => setForm({ ...form, remember: event.target.checked })} className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />Remember me on this device</label>
            {loginError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700" role="alert">{loginError}</div>}
            <button type="submit" disabled={isLoading} className="btn-primary w-full py-3">{isLoading ? <><span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Signing in…</> : <>Sign in <ArrowRight className="size-4" /></>}</button>
          </form>
          <p className="mt-8 text-center text-sm leading-6 text-slate-500">New to HireSense AI? <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">Create an account</Link></p>
        </div>
      </section>
    </main>
  )
}
