import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { Undo2, CheckCircle2, Search, X, Image, MapPin, Copy, Clock } from 'lucide-react'
import AccessDenied from '../components/AccessDenied'
import { useStoreForm } from '../hooks/useStoreForm'
import { groupLocationsByStore } from '../lib/storeLocationUtils'
import { STORE_ROLES } from '../lib/storeRoles'
import { RETURN_REASON_TYPES, QUANTITY_RULES, FORM_DEFAULTS } from '../lib/storeConstants'
import { addCode, isCodeLive, CODE_PATTERN, CODE_TTL_MINUTES } from '../lib/gateCodes'

const ALLOWED_ROLES = STORE_ROLES.RETURN

const EMPTY_FORM = {
  item_id: '',
  return_date: FORM_DEFAULTS.TODAY,
  quantity: '',
  return_reason: '',
  returned_by_name: '',
  location_code: '',
  notes: '',
}

export default function StoreReturn({ profile }) {
  if (!ALLOWED_ROLES.includes(profile?.role)) return <AccessDenied />
  return <StoreReturnInner profile={profile} />
}

function StoreReturnInner({ profile }) {

  const navigate = useNavigate()
  const { form, setForm, updateField, resetForm, saving, setSaving } = useStoreForm(EMPTY_FORM)
  const [items, setItems] = useState([])
  const [locations, setLocations] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [currentStock, setCurrentStock] = useState(null)
  const [itemSearch, setItemSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeCode, setActiveCode] = useState(null)
  const [timeRemaining, setTimeRemaining] = useState(null)
  const [codePrompt, setCodePrompt] = useState(null)
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState('')

  const searchRef = useRef(null)
  const dropdownRef = useRef(null)

  // Code expiry countdown
  useEffect(() => {
    if (!activeCode?.expires_at) { setTimeRemaining(null); return }
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(activeCode.expires_at).getTime() - Date.now()) / 1000))
      if (diff <= 0) { setTimeRemaining(null); setActiveCode(null) }
      else setTimeRemaining(diff)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [activeCode])

  function openCodePrompt(ctx) {
    setCodePrompt({ ...ctx, item_id: selectedItem?.id, item_name: selectedItem?.name, unit: selectedItem?.unit })
    setCodeInput('')
    setCodeError('')
  }

  function confirmCode(e) {
    e.preventDefault()
    const code = codeInput.trim()
    if (!CODE_PATTERN.test(code)) { setCodeError('Code must be exactly 8 letters/numbers'); return }
    if (isCodeLive(code)) { setCodeError('That code is already active — pick another'); return }
    const rec = addCode({
      code,
      type: 'return',
      item_id: codePrompt.item_id,
      item_name: codePrompt.item_name,
      unit: codePrompt.unit,
      quantity: codePrompt.quantity,
      location: codePrompt.location,
      generated_by_id: profile.id,
      generated_by_name: profile.full_name,
      movement_table: codePrompt.movement_table,
      movement_id: codePrompt.movement_id,
    })
    setActiveCode(rec)
    setCodePrompt(null)
    setCodeInput('')
    // Reset the form for the next entry
    setSelectedItem(null); setItemSearch(''); setCurrentStock(null); setForm(EMPTY_FORM)
    toast.success('Gate code saved')
  }

  function copyCode() {
    if (!activeCode?.code) return
    navigator.clipboard.writeText(activeCode.code)
    toast.success('Code copied')
  }

  function fmtRemaining(s) {
    if (s === null || s === undefined) return ''
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  }
  const codeExpiringSoon = timeRemaining !== null && timeRemaining <= 60

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from('store_items').select('id, name, unit, item_image_url, category')
      .eq('is_active', true).order('name')
    setItems(data || [])
  }, [])

  const fetchLocations = useCallback(async () => {
    const { data } = await supabase
      .from('store_locations').select('store_code, store_name, zone_code, zone_label')
      .eq('is_active', true).neq('zone_code', '_meta')
      .order('store_code').order('zone_code')
    setLocations(data || [])
  }, [])

  useEffect(() => { fetchItems(); fetchLocations() }, [fetchItems, fetchLocations])

  const locationGroups = locations.reduce((acc, loc) => {
    if (!acc[loc.store_code]) acc[loc.store_code] = { store_name: loc.store_name, zones: [] }
    acc[loc.store_code].zones.push(loc)
    return acc
  }, {})

  useEffect(() => {
    function handleClick(e) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        searchRef.current && !searchRef.current.contains(e.target)
      ) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(itemSearch.toLowerCase())
  )

  async function fetchStock(itemId) {
    const [{ data: receipts }, { data: issues }] = await Promise.all([
      supabase.from('store_receipts').select('quantity').eq('item_id', itemId),
      supabase.from('store_issues').select('quantity').eq('item_id', itemId),
    ])
    const inn = (receipts || []).reduce((s, r) => s + (Number(r.quantity) || 0), 0)
    const out = (issues || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0)
    setCurrentStock(inn - out)
  }

  function selectItem(item) {
    setSelectedItem(item)
    setItemSearch(item.name)
    setForm(f => ({ ...f, item_id: item.id }))
    setShowDropdown(false)
    fetchStock(item.id)
  }

  function clearItem() {
    setSelectedItem(null)
    setItemSearch('')
    setCurrentStock(null)
    setForm(EMPTY_FORM)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.item_id)                              { toast.error('Please select an item'); return }
    if (!form.quantity || Number(form.quantity) <= 0) { toast.error('Quantity must be greater than 0'); return }
    if (!form.return_reason)                        { toast.error('Please select a reason'); return }
    if (!form.returned_by_name.trim())              { toast.error('"Returned by" name is required'); return }

    setSaving(true)
    const noteText = `Return — Reason: ${form.return_reason}${form.notes ? '. ' + form.notes : ''}`

    const basePayload = {
      item_id:      form.item_id,
      receipt_date: form.return_date,
      quantity:     Number(form.quantity),
      unit_price:   null,
      bill_no:      null,
      location_code: form.location_code || null,
      notes:        noteText,
      received_by:  profile.id,
      verified_at:  new Date().toISOString(),
      verified_by:  profile.id,
    }

    const returnQty = Number(form.quantity)
    const returnLocation = form.location_code || ''
    let movementId = null

    const { data: inserted, error } = await supabase.from('store_receipts').insert([{
      ...basePayload,
      txn_type:          'return',
      returned_by_name:  form.returned_by_name.trim(),
    }]).select('id').single()

    if (error && (error.message.includes('txn_type') || error.message.includes('returned_by_name'))) {
      // DB migration not yet run — insert without new columns
      const { data: inserted2, error: e2 } = await supabase.from('store_receipts').insert([{
        ...basePayload,
        bill_no: `RETURN-${Date.now()}`,
        notes:   `[RETURN by ${form.returned_by_name}] ${form.return_reason}${form.notes ? '. ' + form.notes : ''}`,
      }]).select('id').single()
      setSaving(false)
      if (e2) { toast.error('Failed: ' + e2.message); return }
      movementId = inserted2?.id
    } else if (error) {
      setSaving(false)
      toast.error('Failed to record return: ' + error.message)
      return
    } else {
      setSaving(false)
      movementId = inserted?.id
    }

    toast.success('Return recorded! Stock updated.')
    openCodePrompt({
      quantity: returnQty,
      location: returnLocation,
      movement_table: 'store_receipts',
      movement_id: movementId,
    })
  }

  return (
    <div className="max-w-2xl mx-auto">

      {/* Generated gate code */}
      {activeCode && (
        <div className={`mb-6 rounded-xl border-2 p-6 text-center ${codeExpiringSoon ? 'border-orange-300 bg-orange-50' : 'border-brand-200 bg-brand-50'}`}>
          <p className={`text-sm font-medium mb-2 ${codeExpiringSoon ? 'text-orange-800' : 'text-brand-800'}`}>
            Gate code — enter this at the store access monitor
          </p>
          <div className="flex items-center justify-center gap-3">
            <span className={`text-4xl font-mono font-bold tracking-[0.25em] ${codeExpiringSoon ? 'text-orange-700' : 'text-brand-700'}`}>
              {activeCode.code}
            </span>
            <button type="button" onClick={copyCode} className={`p-2 rounded-lg transition-colors ${codeExpiringSoon ? 'hover:bg-orange-100' : 'hover:bg-brand-100'}`} title="Copy">
              <Copy size={18} className={codeExpiringSoon ? 'text-orange-600' : 'text-brand-600'} />
            </button>
          </div>
          <p className={`text-sm font-mono font-bold mt-3 flex items-center justify-center gap-2 ${codeExpiringSoon ? 'text-orange-700' : 'text-brand-700'}`}>
            <Clock size={14} /> {fmtRemaining(timeRemaining)}
          </p>
          <button type="button" className="mt-4 text-sm text-brand-700 underline hover:no-underline" onClick={() => { setActiveCode(null); setTimeRemaining(null); navigate('/store') }}>
            Done
          </button>
        </div>
      )}

      {/* Code entry step */}
      {codePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Set the gate code</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Return · {codePrompt.quantity} {codePrompt.unit || ''} of {codePrompt.item_name}
              </p>
            </div>
            <form onSubmit={confirmCode} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Your 8-character code *</label>
                <input
                  autoFocus
                  className="input font-mono tracking-widest text-center text-lg uppercase"
                  placeholder="e.g. A1B2C3D4"
                  maxLength={8}
                  value={codeInput}
                  onChange={e => { setCodeInput(e.target.value.replace(/[^A-Za-z0-9]/g, '')); setCodeError('') }}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Letters and/or numbers, exactly 8 characters. Valid for {CODE_TTL_MINUTES} minutes.
                </p>
                {codeError && <p className="text-xs text-red-600 mt-1">{codeError}</p>}
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                  Generate Code
                </button>
                <button type="button" onClick={() => { setCodePrompt(null); navigate('/store') }}
                  className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                  Skip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-100 p-2.5 rounded-xl">
          <Undo2 className="text-blue-600" size={22} />
        </div>
        <div>
          <h1 className="page-header">Return to Store</h1>
          <p className="text-gray-500 text-sm mt-0.5">Material coming back from production or maintenance</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-5 text-sm text-blue-800">
        Use this when material was issued to the floor but was <strong>not fully used</strong> and needs to go back into the store.
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Item selector */}
          <div>
            <label className="label">Item being returned *</label>
            <div className="relative" ref={searchRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input className="input pl-9 pr-9"
                  placeholder="Search items…"
                  value={itemSearch}
                  onChange={e => { setItemSearch(e.target.value); setShowDropdown(true); if (!e.target.value) clearItem() }}
                  onFocus={() => setShowDropdown(true)}
                  autoComplete="off"
                />
                {itemSearch && (
                  <button type="button" onClick={clearItem} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
              {showDropdown && (
                <div ref={dropdownRef} className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                  {filteredItems.length === 0
                    ? <div className="px-4 py-3 text-sm text-gray-500">No items found</div>
                    : filteredItems.map(item => (
                      <button key={item.id} type="button" onClick={() => selectItem(item)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-brand-50 text-left transition-colors">
                        <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {item.item_image_url
                            ? <img src={item.item_image_url} alt={item.name} className="w-full h-full object-cover" />
                            : <Image size={16} className="text-gray-300" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-400">{item.category} · {item.unit}</p>
                        </div>
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
            {selectedItem && currentStock !== null && (
              <div className="mt-2 flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                <CheckCircle2 size={14} className="text-blue-500" />
                <span className="font-medium">{selectedItem.name}</span>
                <span className="text-blue-400 text-xs ml-auto">Current stock: {currentStock} {selectedItem.unit}</span>
              </div>
            )}
          </div>

          {/* Date + Quantity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Return Date *</label>
              <input required type="date" className="input"
                value={form.return_date}
                onChange={e => setForm(f => ({ ...f, return_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Quantity Returned *</label>
              <div className="flex">
                <input required type="number" min="0.001" step="any"
                  className="input rounded-r-none"
                  placeholder="0" value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                <span className="inline-flex items-center px-3 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 rounded-r-lg text-sm whitespace-nowrap">
                  {selectedItem?.unit || 'unit'}
                </span>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="label">Reason for Return *</label>
            <select required className="input" value={form.return_reason}
              onChange={e => setForm(f => ({ ...f, return_reason: e.target.value }))}>
              <option value="">Select reason…</option>
              {RETURN_REASON_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Returned by */}
          <div>
            <label className="label">Returned By *</label>
            <input required className="input"
              placeholder="Name of person returning the item"
              value={form.returned_by_name}
              onChange={e => setForm(f => ({ ...f, returned_by_name: e.target.value }))} />
          </div>

          {/* Location */}
          <div>
            <label className="label flex items-center gap-1.5">
              <MapPin size={14} className="text-brand-500" /> Put Back in Shelf / Rack
            </label>
            {locations.length === 0
              ? <input className="input font-mono" placeholder="e.g. ST1-A-2"
                  value={form.location_code}
                  onChange={e => setForm(f => ({ ...f, location_code: e.target.value }))} />
              : <select className="input" value={form.location_code}
                  onChange={e => setForm(f => ({ ...f, location_code: e.target.value }))}>
                  <option value="">— Select shelf / rack —</option>
                  {Object.entries(locationGroups).map(([storeCode, { store_name, zones }]) => (
                    <optgroup key={storeCode} label={`${store_name} (${storeCode})`}>
                      {zones.map(zone => {
                        const code = `${storeCode}-${zone.zone_code}`
                        return <option key={code} value={code}>{zone.zone_label ? `${code} — ${zone.zone_label}` : code}</option>
                      })}
                    </optgroup>
                  ))}
                </select>
            }
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2}
              placeholder="Any additional notes…"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          {selectedItem && form.quantity && Number(form.quantity) > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-blue-500 flex-shrink-0" />
              Returning <strong>{form.quantity} {selectedItem.unit}</strong> of <strong>{selectedItem.name}</strong> back to store
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors">
              {saving ? 'Saving…' : 'Record Return'}
            </button>
            <button type="button" onClick={() => navigate('/store')}
              className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
