import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, Search, X, Image, ArrowDownToLine, ArrowUpFromLine, Copy, Clock, AlertTriangle } from 'lucide-react'
import AccessDenied from '../components/AccessDenied'
import { STORE_ROLES } from '../lib/storeRoles'

const ALLOWED_ROLES = STORE_ROLES.GATE_REQUEST

const EMPTY_FORM = {
  request_type: 'deposit',
  item_id: '',
  quantity: '',
  notes: '',
}

export default function StoreGateRequest({ profile }) {
  if (!ALLOWED_ROLES.includes(profile?.role)) return <AccessDenied />
  return <StoreGateRequestInner profile={profile} />
}

function StoreGateRequestInner({ profile }) {

  const { t } = useTranslation()
  const [items, setItems] = useState([])
  const [itemSearch, setItemSearch] = useState('')
  const [showItemDropdown, setShowItemDropdown] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [pendingOtp, setPendingOtp] = useState(null)
  const [timeRemaining, setTimeRemaining] = useState(null)

  const itemSearchRef = useRef(null)
  const dropdownRef = useRef(null)

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from('store_items')
      .select('id, name, unit, item_image_url, category')
      .eq('is_active', true)
      .order('name')
    setItems(data || [])
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  // OTP expiry countdown timer
  useEffect(() => {
    if (!pendingOtp?.expires_at) {
      setTimeRemaining(null)
      return
    }

    const updateTimer = () => {
      const now = new Date().getTime()
      const expires = new Date(pendingOtp.expires_at).getTime()
      const diff = Math.max(0, Math.floor((expires - now) / 1000))

      if (diff <= 0) {
        setTimeRemaining(null)
        setPendingOtp(null)
        toast.error(t('gateRequest.otpExpired'))
      } else {
        setTimeRemaining(diff)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [pendingOtp, t])

  useEffect(() => {
    function handleClick(e) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        itemSearchRef.current && !itemSearchRef.current.contains(e.target)
      ) {
        setShowItemDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(itemSearch.toLowerCase())
  )

  function selectItem(item) {
    setSelectedItem(item)
    setItemSearch(item.name)
    setForm(f => ({ ...f, item_id: item.id }))
    setShowItemDropdown(false)
  }

  function clearItem() {
    setSelectedItem(null)
    setItemSearch('')
    setForm(f => ({ ...f, item_id: '' }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.item_id) { toast.error(t('gateRequest.selectItem')); return }
    if (!form.quantity || Number(form.quantity) <= 0) {
      toast.error(t('gateRequest.invalidQty'))
      return
    }

    setSaving(true)
    const { data, error } = await supabase.rpc('create_store_gate_request', {
      p_request_type: form.request_type,
      p_item_id: form.item_id,
      p_quantity: Number(form.quantity),
      p_notes: form.notes.trim() || null,
    })
    setSaving(false)

    if (error) {
      toast.error(error.message)
      return
    }

    setPendingOtp(data)
    setForm(EMPTY_FORM)
    clearItem()
    toast.success(t('gateRequest.otpCreated'))
  }

  function copyOtp() {
    if (!pendingOtp?.otp_code) return
    navigator.clipboard.writeText(pendingOtp.otp_code)
    toast.success(t('gateRequest.otpCopied'))
  }

  function formatExpiry(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function formatTimeRemaining(seconds) {
    if (seconds === null || seconds === undefined) return ''
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  function isOtpExpiringSoon() {
    return timeRemaining !== null && timeRemaining <= 60 // Less than 1 minute
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-brand-100 p-2.5 rounded-xl">
          <ShieldCheck className="text-brand-600" size={22} />
        </div>
        <div>
          <h1 className="page-header">{t('gateRequest.title')}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{t('gateRequest.subtitle')}</p>
        </div>
      </div>

      {pendingOtp && (
        <div className={`mb-6 rounded-xl border-2 p-6 text-center transition-all ${
          isOtpExpiringSoon()
            ? 'border-orange-300 bg-orange-50'
            : 'border-brand-200 bg-brand-50'
        }`}>
          <p className={`text-sm font-medium mb-2 ${
            isOtpExpiringSoon() ? 'text-orange-800' : 'text-brand-800'
          }`}>
            {t('gateRequest.showOtp')}
          </p>
          <div className="flex items-center justify-center gap-3">
            <span className={`text-4xl font-mono font-bold tracking-[0.3em] ${
              isOtpExpiringSoon() ? 'text-orange-700' : 'text-brand-700'
            }`}>
              {pendingOtp.otp_code}
            </span>
            <button
              type="button"
              onClick={copyOtp}
              className={`p-2 rounded-lg transition-colors ${
                isOtpExpiringSoon()
                  ? 'hover:bg-orange-100'
                  : 'hover:bg-brand-100'
              }`}
              title={t('gateRequest.copy')}
            >
              <Copy size={18} className={isOtpExpiringSoon() ? 'text-orange-600' : 'text-brand-600'} />
            </button>
          </div>

          {/* Countdown timer */}
          <p className={`text-sm font-mono font-bold mt-3 flex items-center justify-center gap-2 ${
            isOtpExpiringSoon() ? 'text-orange-700' : 'text-brand-700'
          }`}>
            <Clock size={14} />
            {formatTimeRemaining(timeRemaining)}
          </p>

          {/* Expiry warning */}
          {isOtpExpiringSoon() && (
            <div className="mt-3 flex items-center justify-center gap-2 text-orange-700 text-xs bg-orange-100 p-2 rounded">
              <AlertTriangle size={14} />
              {t('gateRequest.expiringWarning')}
            </div>
          )}

          <p className="text-xs text-gray-500 mt-3">{t('gateRequest.gateHint')}</p>
          <button
            type="button"
            className="mt-4 text-sm text-brand-700 underline hover:no-underline"
            onClick={() => {
              setPendingOtp(null)
              setTimeRemaining(null)
            }}
          >
            {t('gateRequest.newRequest')}
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, request_type: 'deposit' }))}
              className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                form.request_type === 'deposit'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <ArrowDownToLine size={18} />
              {t('gateRequest.deposit')}
            </button>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, request_type: 'withdraw' }))}
              className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                form.request_type === 'withdraw'
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <ArrowUpFromLine size={18} />
              {t('gateRequest.withdraw')}
            </button>
          </div>

          <div>
            <label className="label">{t('common.item')}</label>
            <div className="relative" ref={itemSearchRef}>
              {selectedItem ? (
                <div className="flex items-center gap-3 p-3 border border-brand-200 bg-brand-50 rounded-lg">
                  {selectedItem.item_image_url ? (
                    <img src={selectedItem.item_image_url} alt="" className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
                      <Image size={16} className="text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{selectedItem.name}</p>
                    <p className="text-xs text-gray-500">{selectedItem.category} · {selectedItem.unit}</p>
                  </div>
                  <button type="button" onClick={clearItem} className="p-1 hover:bg-white rounded">
                    <X size={16} className="text-gray-400" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      className="input pl-9"
                      placeholder={t('gateRequest.searchItem')}
                      value={itemSearch}
                      onChange={e => { setItemSearch(e.target.value); setShowItemDropdown(true) }}
                      onFocus={() => setShowItemDropdown(true)}
                    />
                  </div>
                  {showItemDropdown && itemSearch && (
                    <div ref={dropdownRef} className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredItems.length === 0 ? (
                        <p className="p-3 text-sm text-gray-400">{t('gateRequest.noItems')}</p>
                      ) : filteredItems.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selectItem(item)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                        >
                          {item.name} <span className="text-gray-400">({item.unit})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div>
            <label className="label">{t('common.qty')}</label>
            <input
              type="number"
              min="0.01"
              step="any"
              className="input"
              value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="label">{t('common.notes')}</label>
            <textarea
              className="input min-h-[72px]"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder={t('gateRequest.notesPlaceholder')}
            />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? t('gateRequest.generating') : t('gateRequest.generateOtp')}
          </button>
        </form>
      </div>
    </div>
  )
}
