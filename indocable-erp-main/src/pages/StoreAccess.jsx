import { useState, useEffect, useRef } from 'react'
import { ShieldCheck, Lock, Unlock, LogOut, RotateCcw, Clock } from 'lucide-react'
import { verifyCode, getUnlockState, onCodesChange } from '../lib/gateCodes'
import { STORE_ACCESS_CREDENTIALS } from '../lib/storeAccessConfig'

/**
 * Store Access monitor (TESTING). A standalone screen for the door device:
 * log in with the monitor credentials, then type a code generated in the ERP.
 * Matching → "Access Granted" (green), otherwise "Access Denied" (red).
 */
export default function StoreAccess() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [idInput, setIdInput] = useState('')
  const [pwInput, setPwInput] = useState('')
  const [loginError, setLoginError] = useState('')

  const [code, setCode] = useState('')
  const [result, setResult] = useState(null) // null | { granted, record? }
  const codeRef = useRef(null)

  // Live store-unlock window (from Stock Count "Store Access")
  const [unlock, setUnlock] = useState(getUnlockState())
  useEffect(() => {
    const refresh = () => setUnlock(getUnlockState())
    refresh()
    const id = setInterval(refresh, 1000)
    const off = onCodesChange(refresh)
    return () => { clearInterval(id); off() }
  }, [])

  useEffect(() => { if (loggedIn) codeRef.current?.focus() }, [loggedIn])

  function handleLogin(e) {
    e.preventDefault()
    if (idInput.trim() === STORE_ACCESS_CREDENTIALS.id && pwInput === STORE_ACCESS_CREDENTIALS.password) {
      setLoggedIn(true)
      setLoginError('')
      setPwInput('')
    } else {
      setLoginError('Invalid id or password')
    }
  }

  function handleVerify(e) {
    e.preventDefault()
    const c = code.trim()
    if (!c) return
    const res = verifyCode(c, idInput.trim() || 'monitor')
    setResult(res.ok ? { granted: true, record: res.record } : { granted: false })
    setCode('')
    if ('vibrate' in navigator) navigator.vibrate(res.ok ? [200, 80, 200] : [400])
    setTimeout(() => { setResult(null); codeRef.current?.focus() }, 5000)
  }

  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  // ── Login screen ────────────────────────────────────────────────────────────
  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
        <form onSubmit={handleLogin} className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center">
            <ShieldCheck size={40} className="text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Store Access</h1>
          <p className="text-slate-400 text-sm mb-8">Log in to the door monitor</p>

          <input
            type="text"
            placeholder="Monitor ID"
            value={idInput}
            onChange={e => { setIdInput(e.target.value); setLoginError('') }}
            className="w-full mb-3 px-4 py-3 rounded-xl bg-slate-800 text-white placeholder-slate-500 border-2 border-slate-700 focus:border-brand-400 outline-none"
            autoComplete="off"
          />
          <input
            type="password"
            placeholder="Password"
            value={pwInput}
            onChange={e => { setPwInput(e.target.value); setLoginError('') }}
            className="w-full mb-3 px-4 py-3 rounded-xl bg-slate-800 text-white placeholder-slate-500 border-2 border-slate-700 focus:border-brand-400 outline-none"
          />
          {loginError && <p className="text-red-400 text-sm mb-3">{loginError}</p>}
          <button type="submit" className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium transition-colors">
            Log in
          </button>
        </form>
      </div>
    )
  }

  // ── Result overlay ──────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 select-none ${result.granted ? 'bg-green-600' : 'bg-red-600'}`}>
        <div className="text-center">
          <div className="mx-auto mb-6 w-24 h-24 rounded-3xl bg-white/20 flex items-center justify-center">
            {result.granted ? <Unlock size={52} className="text-white" /> : <Lock size={52} className="text-white" />}
          </div>
          <h1 className="text-5xl font-extrabold text-white tracking-tight mb-3">
            {result.granted ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
          </h1>
          {result.granted && result.record && (
            <p className="text-white/90 text-lg font-medium">
              {result.record.type === 'outward' ? 'Issue' : result.record.type === 'return' ? 'Return' : 'Inward'} ·{' '}
              {result.record.quantity} {result.record.unit || ''} · {result.record.item_name}
              {result.record.location ? ` · ${result.record.location}` : ''}
            </p>
          )}
          {!result.granted && (
            <p className="text-white/90 text-lg">Code is wrong, already used, or expired.</p>
          )}
          <button onClick={() => { setResult(null); codeRef.current?.focus() }}
            className="mt-8 inline-flex items-center gap-2 text-white/90 hover:text-white text-sm">
            <RotateCcw size={14} /> Enter another code
          </button>
        </div>
      </div>
    )
  }

  // ── Code entry screen ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 select-none">
      <button onClick={() => { setLoggedIn(false); setIdInput(''); setCode(''); setResult(null) }}
        className="absolute top-5 right-5 inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm">
        <LogOut size={15} /> Log out
      </button>

      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center">
          <Lock size={40} className="text-slate-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Store Gate</h1>
        <p className="text-slate-400 text-sm mb-6">Type the code from the staff member</p>

        {/* Stock-count unlock window status */}
        {unlock.unlocked && (
          <div className="mb-6 inline-flex items-center gap-2 bg-green-500/15 text-green-300 px-4 py-2 rounded-xl text-sm font-medium">
            <Unlock size={15} /> Store is unlocked
            <span className="font-mono inline-flex items-center gap-1"><Clock size={12} /> {fmt(unlock.secondsLeft)} left</span>
          </div>
        )}

        <form onSubmit={handleVerify}>
          <input
            ref={codeRef}
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
            maxLength={8}
            placeholder="········"
            className="w-full text-center text-3xl font-mono font-bold tracking-[0.4em] uppercase rounded-2xl border-2 bg-slate-800 text-white border-slate-600 focus:border-brand-400 outline-none py-4 mb-5"
            autoComplete="off"
          />
          <button type="submit" disabled={!code.trim()}
            className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium transition-colors">
            Verify Code
          </button>
        </form>
      </div>
    </div>
  )
}
