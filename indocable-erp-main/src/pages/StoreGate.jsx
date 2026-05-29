import { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabase'
import { ShieldCheck, Lock, Unlock, RotateCcw } from 'lucide-react'

const OTP_LENGTH = 6

export default function StoreGate() {
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''))
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [message, setMessage] = useState('')
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState(null)
  const inputRefs = useRef([])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  function resetForm() {
    setDigits(Array(OTP_LENGTH).fill(''))
    setStatus('idle')
    setMessage('')
    setError(null)
    setDetail(null)
    inputRefs.current[0]?.focus()
  }

  function isFormComplete() {
    return digits.every(d => d !== '') && digits.join('').length === OTP_LENGTH
  }

  function handleDigitChange(index, value) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    setDigits(next)
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return
    const next = Array(OTP_LENGTH).fill('')
    pasted.split('').forEach((d, i) => { next[i] = d })
    setDigits(next)
    if (pasted.length === OTP_LENGTH) redeemOtp(pasted)
    else inputRefs.current[pasted.length]?.focus()
  }

  async function redeemOtp(code) {
    setStatus('loading')
    setMessage('')
    setError(null)
    setDetail(null)

    const { data, error } = await supabase.rpc('redeem_store_gate_otp', {
      p_otp_code: code,
    })

    if (error) {
      setStatus('error')
      setError(error.message)
      const message = error.message || 'Invalid or expired OTP'
      
      // Check for rate limit error
      if (error.message?.includes('RATE_LIMITED')) {
        setMessage('Too many attempts. Please try again later.')
        setTimeout(resetForm, 3000)
      } else {
        setMessage(message)
        setTimeout(resetForm, 2500)
      }
      return
    }

    setStatus('success')
    setDetail(data)
    setMessage(
      data.request_type === 'deposit'
        ? `✓ Items received — ${data.quantity} × ${data.item_name}`
        : `✓ Items issued — ${data.quantity} × ${data.item_name}`
    )

    // Hardware unlock pulse
    if (data.unlock_signal && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200])
    }

    setTimeout(resetForm, 5000)
  }

  function handleSubmit() {
    if (isFormComplete()) {
      redeemOtp(digits.join(''))
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 select-none">
      <div className="w-full max-w-md text-center">
        <div className={`mx-auto mb-6 w-20 h-20 rounded-2xl flex items-center justify-center transition-colors ${
          status === 'success' ? 'bg-green-500/20' :
          status === 'error' ? 'bg-red-500/20' :
          'bg-slate-800'
        }`}>
          {status === 'success' ? (
            <Unlock size={40} className="text-green-400 animate-pulse" />
          ) : status === 'loading' ? (
            <ShieldCheck size={40} className="text-brand-400 animate-spin" />
          ) : (
            <Lock size={40} className="text-slate-400" />
          )}
        </div>

        <h1 className="text-2xl font-bold text-white mb-1">Store Gate</h1>
        <p className="text-slate-400 text-sm mb-8">Type the 6-digit code from the staff member</p>

        <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              disabled={status === 'loading' || status === 'success'}
              onChange={e => handleDigitChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className={`w-12 h-14 text-center text-2xl font-mono font-bold rounded-xl border-2 bg-slate-800 text-white outline-none transition-colors ${
                status === 'success' ? 'border-green-500' :
                status === 'error' ? 'border-red-500' :
                'border-slate-600 focus:border-brand-400'
              }`}
            />
          ))}
        </div>

        {status === 'loading' && (
          <p className="text-brand-300 text-sm animate-pulse">Verifying code…</p>
        )}
        
        {message && (
          <p className={`text-sm font-medium mb-4 ${
            status === 'success' ? 'text-green-400' : 
            status === 'error' ? 'text-red-400' : 
            'text-slate-300'
          }`}>
            {message}
          </p>
        )}

        {error && status === 'error' && (
          <p className="text-xs text-red-300 mb-4 bg-red-500/10 p-2 rounded">
            {error}
          </p>
        )}

        {status === 'success' && detail?.unlock_signal && (
          <p className="text-xs text-green-300 mb-4 flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Door unlock signal sent
          </p>
        )}

        {/* Submit button - only show when form is complete and not processing */}
        {!isFormComplete() ? (
          <p className="text-slate-400 text-xs text-center mb-6">
            {digits.filter(d => d !== '').length} / {OTP_LENGTH}
          </p>
        ) : status === 'idle' ? (
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full mb-4 py-3 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium transition-colors"
          >
            Verify Code
          </button>
        ) : null}

        {(status === 'error' || status === 'success') && (
          <button
            type="button"
            onClick={resetForm}
            className="mt-6 inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm"
          >
            <RotateCcw size={14} />
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
