import { useState } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { Zap, Mail, Lock, ArrowRight, Eye, EyeOff, Package } from 'lucide-react'

// Google OAuth must be enabled in Supabase (Auth → Providers) AND turned on here.
// Until then we default to Staff Login so users never hit a dead "provider not enabled" button.
const GOOGLE_ENABLED = import.meta.env.VITE_GOOGLE_AUTH_ENABLED === 'true'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

export default function Login() {
  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [loading,       setLoading]       = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPw,        setShowPw]        = useState(false)
  // Default to the tab that actually works in the current config.
  const [tab,           setTab]           = useState(GOOGLE_ENABLED ? 'client' : 'staff') // 'client' | 'staff'

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      // Supabase returns "provider is not enabled" when Google OAuth isn't configured.
      // Don't show the raw error — guide the user to the working Staff Login instead.
      const notEnabled = /provider is not enabled/i.test(error.message)
      toast.error(notEnabled
        ? 'Google sign-in isn’t enabled yet — please use Staff Login.'
        : error.message)
      if (notEnabled) setTab('staff')
      setGoogleLoading(false)
    }
    // On success the browser navigates to Google — this function won't continue
  }

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) toast.error(error.message)
    else toast.success('Welcome back!')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex">

      {/* Left panel – brand */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#0f172a] flex-col justify-between p-12 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-brand-600/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-brand-500/5 blur-2xl" />

        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-glow-orange">
            <Zap size={20} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-lg leading-none">Indocable</div>
            <div className="text-slate-500 text-xs font-medium tracking-widest uppercase mt-0.5">Cable Manufacturer</div>
          </div>
        </div>

        <div className="relative">
          <div className="inline-block bg-brand-500/15 text-brand-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 tracking-wide uppercase">
            25+ Years of Manufacturing Excellence
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Premium cables,<br />
            <span className="text-brand-400">live prices.</span>
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
            Browse our ISI-certified cable catalog, get instant pricing, and send enquiries — all in one place.
          </p>
          <div className="flex flex-wrap gap-2 mt-8">
            {['IS 694 Housing Wire', 'Armoured Cables', 'XLPE Power Cables', 'Submersible Cables'].map(f => (
              <span key={f} className="bg-white/5 border border-white/10 text-slate-300 text-xs px-3 py-1.5 rounded-full font-medium">
                {f}
              </span>
            ))}
          </div>
        </div>

        <div className="relative text-slate-600 text-xs">
          © {new Date().getFullYear()} Indocables. BIS / ISI Certified Manufacturing.
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-sm animate-slide-up">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-brand-gradient flex items-center justify-center shadow-glow-orange">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <div className="text-gray-900 font-bold leading-none">Indocable</div>
              <div className="text-gray-400 text-xs mt-0.5">Cable Manufacturer · Since 1999</div>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-7">
            <button
              onClick={() => setTab('client')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                tab === 'client' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Package size={14} />
              Client Portal
            </button>
            <button
              onClick={() => setTab('staff')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                tab === 'staff' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Zap size={14} />
              Staff Login
            </button>
          </div>

          {/* Client Portal tab */}
          {tab === 'client' && (
            <div>
              <div className="mb-7">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Browse our catalog</h2>
                <p className="text-sm text-gray-500 mt-1">Sign in with Google to view prices and send enquiries</p>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={googleLoading || !GOOGLE_ENABLED}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
              >
                {googleLoading ? (
                  <svg className="animate-spin h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : (
                  <GoogleIcon />
                )}
                {googleLoading ? 'Redirecting to Google…' : 'Continue with Google'}
              </button>

              {!GOOGLE_ENABLED && (
                <p className="mt-3 text-center text-xs text-gray-500">
                  Google sign-in is being set up.{' '}
                  <button onClick={() => setTab('staff')} className="text-brand-600 font-semibold hover:underline cursor-pointer">
                    Use Staff Login
                  </button>{' '}for now.
                </p>
              )}

              <div className="mt-5 bg-brand-50 border border-brand-100 rounded-xl px-4 py-3">
                <p className="text-xs text-brand-700 font-medium leading-relaxed">
                  New visitors get instant access to live cable prices, technical datasheets, and our full catalog. No manual approval needed.
                </p>
              </div>

              <p className="text-center text-xs text-gray-400 mt-6">
                Already a registered dealer?{' '}
                <button onClick={() => setTab('staff')} className="text-brand-600 font-semibold hover:underline cursor-pointer">
                  Use staff login
                </button>
              </p>
            </div>
          )}

          {/* Staff Login tab */}
          {tab === 'staff' && (
            <div>
              <div className="mb-7">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Staff sign in</h2>
                <p className="text-sm text-gray-500 mt-1">For Indocable team members and registered dealers</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="email" className="label">Email address</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@indocables.com"
                      className="input pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="label">Password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      id="password"
                      type={showPw ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="input pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                    >
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full mt-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Signing in…
                    </>
                  ) : (
                    <>Sign In <ArrowRight size={16} /></>
                  )}
                </button>
              </form>

              <p className="text-center text-xs text-gray-400 mt-8">
                Not a staff member?{' '}
                <button onClick={() => setTab('client')} className="text-brand-600 font-semibold hover:underline cursor-pointer">
                  Browse as client
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
