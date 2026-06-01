import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import {
  ArrowDownToLine, ArrowUpFromLine, Search, X, Image, MapPin, Plus,
  AlertTriangle, CheckCircle2, Copy, Clock,
} from 'lucide-react'
import AccessDenied from '../components/AccessDenied'
import { groupLocationsByStore } from '../lib/storeLocationUtils'
import { STORE_ROLES } from '../lib/storeRoles'
import { STORE_CATEGORIES, STORE_UNITS, FORM_DEFAULTS, ISSUE_PURPOSE_TYPES } from '../lib/storeConstants'
import { addCode, isCodeLive, CODE_PATTERN, CODE_TTL_MINUTES } from '../lib/gateCodes'

// Anyone who could previously do Inward OR Outward can use the merged page.
const ALLOWED_ROLES = [...new Set([...STORE_ROLES.RECEIVE, ...STORE_ROLES.ISSUE])]

const EMPTY_INWARD = {
  receipt_date: FORM_DEFAULTS.TODAY,
  quantity: '',
  unit_price: '',
  supplier_name: '',
  bill_no: '',
  lot_number: '',
  location_code: '',
  notes: '',
}

const EMPTY_OUTWARD = {
  issue_date: FORM_DEFAULTS.TODAY,
  quantity: '',
  purpose_type: 'production',
  purpose: '',
  issued_to_name: '',
  location_from: '',
  notes: '',
}

const EMPTY_ITEM_FORM = {
  name: '',
  description: '',
  category: STORE_CATEGORIES[0],
  unit: STORE_UNITS[0],
}

export default function StoreInOut({ profile }) {
  if (!ALLOWED_ROLES.includes(profile?.role)) return <AccessDenied />

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState(searchParams.get('mode') === 'outward' ? 'outward' : 'inward')

  // ── Shared state ────────────────────────────────────────────────────────────
  const [items, setItems] = useState([])
  const [locations, setLocations] = useState([])
  const [itemSearch, setItemSearch] = useState('')
  const [showItemDropdown, setShowItemDropdown] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [saving, setSaving] = useState(false)
  const [activeCode, setActiveCode] = useState(null)   // last generated code (banner)
  const [timeRemaining, setTimeRemaining] = useState(null)
  const [codePrompt, setCodePrompt] = useState(null)   // movement awaiting a code
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState('')

  const itemSearchRef = useRef(null)
  const dropdownRef = useRef(null)

  // ── Inward state ────────────────────────────────────────────────────────────
  const [inForm, setInForm] = useState(EMPTY_INWARD)
  const [billFile, setBillFile] = useState(null)
  const [billPreview, setBillPreview] = useState('')
  const [uploadingBill, setUploadingBill] = useState(false)
  const billInputRef = useRef(null)
  const [showItemModal, setShowItemModal] = useState(false)
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM)
  const [savingItem, setSavingItem] = useState(false)

  // ── Outward state ───────────────────────────────────────────────────────────
  const [outForm, setOutForm] = useState(EMPTY_OUTWARD)
  const [currentStock, setCurrentStock] = useState(null)
  const [loadingStock, setLoadingStock] = useState(false)
  const [qtyError, setQtyError] = useState('')

  const isInward = mode === 'inward'

  // ── Data fetching ───────────────────────────────────────────────────────────
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

  const locationGroups = groupLocationsByStore(locations)

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

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        itemSearchRef.current && !itemSearchRef.current.contains(e.target)
      ) setShowItemDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(itemSearch.toLowerCase())
  )

  // ── Stock lookup (outward) ──────────────────────────────────────────────────
  const fetchStockAndLocation = useCallback(async (itemId) => {
    setLoadingStock(true)
    setCurrentStock(null)
    const [{ data: receipts }, { data: issues }] = await Promise.all([
      supabase.from('store_receipts').select('quantity, location_code').eq('item_id', itemId),
      supabase.from('store_issues').select('quantity').eq('item_id', itemId),
    ])
    const totalIn = (receipts || []).reduce((s, r) => s + (Number(r.quantity) || 0), 0)
    const totalOut = (issues || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0)
    setCurrentStock(totalIn - totalOut)
    if (receipts && receipts.length > 0) {
      const lastLocation = receipts[receipts.length - 1].location_code || ''
      setOutForm(f => ({ ...f, location_from: lastLocation }))
    }
    setLoadingStock(false)
  }, [])

  // Re-check stock whenever the selected item changes while in Outward mode
  useEffect(() => {
    if (mode === 'outward' && selectedItem) fetchStockAndLocation(selectedItem.id)
    if (mode === 'inward') { setCurrentStock(null); setQtyError('') }
  }, [mode, selectedItem, fetchStockAndLocation])

  // ── Item select / clear ─────────────────────────────────────────────────────
  function selectItem(item) {
    setSelectedItem(item)
    setItemSearch(item.name)
    setShowItemDropdown(false)
    setQtyError('')
  }

  function clearItem() {
    setSelectedItem(null)
    setItemSearch('')
    setCurrentStock(null)
    setQtyError('')
  }

  function handleQtyChange(val) {
    setOutForm(f => ({ ...f, quantity: val }))
    if (currentStock !== null && val && Number(val) > currentStock) {
      setQtyError(`Cannot issue more than current stock (${currentStock} ${selectedItem?.unit})`)
    } else {
      setQtyError('')
    }
  }

  // ── Bill image (inward) ─────────────────────────────────────────────────────
  function handleBillSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10 MB'); return }
    setBillFile(file)
    setBillPreview(URL.createObjectURL(file))
  }

  async function uploadBill() {
    if (!billFile) return null
    setUploadingBill(true)
    const ext = billFile.name.split('.').pop()
    const path = `bills/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('store-media').upload(path, billFile)
    setUploadingBill(false)
    if (error) { toast.error('Bill upload failed: ' + error.message); return null }
    const { data: { publicUrl } } = supabase.storage.from('store-media').getPublicUrl(path)
    return publicUrl
  }

  // ── Quick add item (inward) ─────────────────────────────────────────────────
  async function handleSaveNewItem(e) {
    e.preventDefault()
    if (!itemForm.name.trim()) { toast.error('Item name is required'); return }
    setSavingItem(true)
    const { data, error } = await supabase.from('store_items').insert([{
      name: itemForm.name.trim(),
      description: itemForm.description.trim() || null,
      category: itemForm.category,
      unit: itemForm.unit,
      is_active: true,
      created_by: profile.id,
    }]).select().single()
    setSavingItem(false)
    if (error) { toast.error('Failed to add item: ' + error.message); return }
    toast.success('Item added!')
    await fetchItems()
    selectItem(data)
    setShowItemModal(false)
    setItemForm(EMPTY_ITEM_FORM)
  }

  // ── Gate code step (after a movement is recorded) ───────────────────────────
  function openCodePrompt(ctx) {
    // Snapshot the item details before the form is cleared.
    setCodePrompt({
      ...ctx,
      item_id: selectedItem?.id,
      item_name: selectedItem?.name,
      unit: selectedItem?.unit,
    })
    setCodeInput('')
    setCodeError('')
    resetAfterSave()
  }

  function confirmCode(e) {
    e.preventDefault()
    const code = codeInput.trim()
    if (!CODE_PATTERN.test(code)) { setCodeError('Code must be exactly 8 letters/numbers'); return }
    if (isCodeLive(code)) { setCodeError('That code is already active — pick another'); return }
    const rec = addCode({
      code,
      type: codePrompt.type,
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
    toast.success('Gate code saved')
  }

  function resetAfterSave() {
    setInForm(EMPTY_INWARD)
    setOutForm(EMPTY_OUTWARD)
    setBillFile(null)
    setBillPreview('')
    clearItem()
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedItem) { toast.error('Please select an item'); return }

    if (isInward) {
      if (!inForm.quantity || Number(inForm.quantity) <= 0) { toast.error('Quantity must be greater than 0'); return }
      setSaving(true)
      const billImageUrl = await uploadBill()
      if (billFile && billImageUrl === null) { setSaving(false); return }

      const payload = {
        item_id:        selectedItem.id,
        receipt_date:   inForm.receipt_date,
        quantity:       Number(inForm.quantity),
        unit_price:     inForm.unit_price ? Number(inForm.unit_price) : null,
        supplier_name:  inForm.supplier_name.trim() || null,
        bill_no:        inForm.bill_no.trim() || null,
        lot_number:     inForm.lot_number.trim() || null,
        bill_image_url: billImageUrl,
        location_code:  inForm.location_code || null,
        notes:          inForm.notes.trim() || null,
        received_by:    profile.id,
        txn_type:       'purchase',
        verified_at:    null,
        verified_by:    null,
      }
      const { data: inserted, error } = await supabase.from('store_receipts').insert([payload]).select('id').single()
      if (error) { setSaving(false); toast.error('Failed to record inward: ' + error.message); return }
      setSaving(false)
      toast.success('Inward recorded! Stock updated.')
      openCodePrompt({
        type: 'inward',
        quantity: Number(inForm.quantity),
        location: payload.location_code || '',
        movement_table: 'store_receipts',
        movement_id: inserted?.id,
      })
    } else {
      if (!outForm.quantity || Number(outForm.quantity) <= 0) { toast.error('Quantity must be greater than 0'); return }
      if (currentStock !== null && Number(outForm.quantity) > currentStock) { toast.error('Quantity exceeds current stock'); return }
      if (!outForm.purpose.trim() && !outForm.purpose_type) { toast.error('Purpose is required'); return }
      if (!outForm.issued_to_name.trim()) { toast.error('Issued To name is required'); return }

      setSaving(true)
      const purpose = outForm.purpose.trim() || ISSUE_PURPOSE_TYPES.find(p => p.value === outForm.purpose_type)?.label || outForm.purpose_type
      const payload = {
        item_id:        selectedItem.id,
        issue_date:     outForm.issue_date,
        quantity:       Number(outForm.quantity),
        purpose_type:   outForm.purpose_type,
        purpose,
        issued_to_name: outForm.issued_to_name.trim(),
        location_from:  outForm.location_from.trim() || null,
        notes:          outForm.notes.trim() || null,
        issued_by:      profile.id,
      }
      const { data: inserted, error } = await supabase.from('store_issues').insert([payload]).select('id').single()
      if (error) { setSaving(false); toast.error('Failed to record outward: ' + error.message); return }
      setSaving(false)
      toast.success('Outward recorded! Stock updated.')
      openCodePrompt({
        type: 'outward',
        quantity: Number(outForm.quantity),
        location: payload.location_from || '',
        movement_table: 'store_issues',
        movement_id: inserted?.id,
      })
    }
  }

  function copyOtp() {
    if (!activeCode?.code) return
    navigator.clipboard.writeText(activeCode.code)
    toast.success('Code copied')
  }

  function formatTimeRemaining(seconds) {
    if (seconds === null || seconds === undefined) return ''
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }
  const otpExpiringSoon = timeRemaining !== null && timeRemaining <= 60

  const statusBadge = () => {
    if (isInward || currentStock === null) return null
    if (currentStock <= 0) return { label: 'Out of stock', cls: 'bg-red-100 text-red-700' }
    if (currentStock < 3) return { label: `Low — ${currentStock} ${selectedItem?.unit || ''}`, cls: 'bg-orange-100 text-orange-700' }
    return { label: `In stock: ${currentStock} ${selectedItem?.unit || ''}`, cls: 'bg-green-100 text-green-700' }
  }
  const status = statusBadge()

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`p-2.5 rounded-xl ${isInward ? 'bg-green-100' : 'bg-orange-100'}`}>
          {isInward
            ? <ArrowDownToLine className="text-green-600" size={22} />
            : <ArrowUpFromLine className="text-orange-600" size={22} />}
        </div>
        <div>
          <h1 className="page-header">Store Inward / Outward</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Record items moving in or out of the store — a gate code is generated automatically
          </p>
        </div>
      </div>

      {/* Generated gate code */}
      {activeCode && (
        <div className={`mb-6 rounded-xl border-2 p-6 text-center ${otpExpiringSoon ? 'border-orange-300 bg-orange-50' : 'border-brand-200 bg-brand-50'}`}>
          <p className={`text-sm font-medium mb-2 ${otpExpiringSoon ? 'text-orange-800' : 'text-brand-800'}`}>
            Gate code — enter this at the store access monitor
          </p>
          <div className="flex items-center justify-center gap-3">
            <span className={`text-4xl font-mono font-bold tracking-[0.25em] ${otpExpiringSoon ? 'text-orange-700' : 'text-brand-700'}`}>
              {activeCode.code}
            </span>
            <button type="button" onClick={copyOtp} className={`p-2 rounded-lg transition-colors ${otpExpiringSoon ? 'hover:bg-orange-100' : 'hover:bg-brand-100'}`} title="Copy">
              <Copy size={18} className={otpExpiringSoon ? 'text-orange-600' : 'text-brand-600'} />
            </button>
          </div>
          <p className={`text-sm font-mono font-bold mt-3 flex items-center justify-center gap-2 ${otpExpiringSoon ? 'text-orange-700' : 'text-brand-700'}`}>
            <Clock size={14} />
            {formatTimeRemaining(timeRemaining)}
          </p>
          <button type="button" className="mt-4 text-sm text-brand-700 underline hover:no-underline" onClick={() => { setActiveCode(null); setTimeRemaining(null) }}>
            Dismiss
          </button>
        </div>
      )}

      {/* Code entry step (after a movement is recorded) */}
      {codePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Set the gate code</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {codePrompt.type === 'inward' ? 'Inward' : 'Outward'} · {codePrompt.quantity} {codePrompt.unit || ''} of {codePrompt.item_name}
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
                  Letters and/or numbers, exactly 8 characters. Valid for {CODE_TTL_MINUTES} minutes. Enter this at the store access monitor to unlock the gate.
                </p>
                {codeError && <p className="text-xs text-red-600 mt-1">{codeError}</p>}
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" className="flex-1 bg-brand-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
                  Generate Code
                </button>
                <button type="button" onClick={() => setCodePrompt(null)}
                  className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                  Skip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inward / Outward toggle */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <button
          type="button"
          onClick={() => setMode('inward')}
          className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
            isInward ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
          }`}
        >
          <ArrowDownToLine size={18} /> Inward
        </button>
        <button
          type="button"
          onClick={() => setMode('outward')}
          className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
            !isInward ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
          }`}
        >
          <ArrowUpFromLine size={18} /> Outward
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Item selector (shared) */}
          <div>
            <label className="label">Item *</label>
            <div className="relative" ref={itemSearchRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input
                  className="input pl-9 pr-9"
                  placeholder="Search items…"
                  value={itemSearch}
                  onChange={e => { setItemSearch(e.target.value); setShowItemDropdown(true); if (!e.target.value) clearItem() }}
                  onFocus={() => setShowItemDropdown(true)}
                  autoComplete="off"
                />
                {itemSearch && (
                  <button type="button" onClick={clearItem} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
              {showItemDropdown && (
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
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                          <p className="text-xs text-gray-400">{item.category} · {item.unit}</p>
                        </div>
                      </button>
                    ))
                  }
                  {isInward && (
                    <div className="border-t border-gray-100 px-3 py-2">
                      <button type="button" onClick={() => { setShowItemDropdown(false); setShowItemModal(true) }}
                        className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium">
                        <Plus size={14} /> Quick add new item
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedItem && isInward && (
              <div className="mt-2 flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                <CheckCircle2 size={14} className="text-green-500" />
                <span className="font-medium truncate">{selectedItem.name}</span>
                <span className="text-green-500 text-xs ml-auto flex-shrink-0">Unit: {selectedItem.unit}</span>
              </div>
            )}
            {selectedItem && !isInward && (
              <div className="mt-2 flex items-center gap-2">
                {loadingStock
                  ? <span className="text-xs text-gray-400">Checking stock…</span>
                  : status
                    ? <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${status.cls}`}>{status.label}</span>
                    : null}
              </div>
            )}
          </div>

          {/* Date + Quantity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{isInward ? 'Receipt Date *' : 'Issue Date *'}</label>
              <input required type="date" className="input"
                value={isInward ? inForm.receipt_date : outForm.issue_date}
                onChange={e => isInward
                  ? setInForm(f => ({ ...f, receipt_date: e.target.value }))
                  : setOutForm(f => ({ ...f, issue_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Quantity *</label>
              <div className="flex">
                <input required type="number" min="0.001" step="any"
                  className={`input rounded-r-none ${qtyError ? 'border-red-400 focus:ring-red-400' : ''}`}
                  placeholder="0"
                  value={isInward ? inForm.quantity : outForm.quantity}
                  onChange={e => isInward
                    ? setInForm(f => ({ ...f, quantity: e.target.value }))
                    : handleQtyChange(e.target.value)}
                  disabled={!isInward && !selectedItem} />
                <span className="inline-flex items-center px-3 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 rounded-r-lg text-sm whitespace-nowrap">
                  {selectedItem?.unit || 'unit'}
                </span>
              </div>
              {qtyError && (
                <div className="flex items-center gap-1.5 mt-1.5 text-red-600 text-xs">
                  <AlertTriangle size={12} /> {qtyError}
                </div>
              )}
            </div>
          </div>

          {/* ── Inward-only fields ── */}
          {isInward && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Unit Price</label>
                  <input type="number" min="0" step="any" className="input" placeholder="0.00"
                    value={inForm.unit_price}
                    onChange={e => setInForm(f => ({ ...f, unit_price: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Supplier Name</label>
                  <input className="input" placeholder="e.g. ABC Traders"
                    value={inForm.supplier_name}
                    onChange={e => setInForm(f => ({ ...f, supplier_name: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Bill No</label>
                  <input className="input" placeholder="e.g. INV-2024-001"
                    value={inForm.bill_no}
                    onChange={e => setInForm(f => ({ ...f, bill_no: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Lot / Batch No <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input className="input font-mono" placeholder="e.g. LOT-2025-001"
                    value={inForm.lot_number}
                    onChange={e => setInForm(f => ({ ...f, lot_number: e.target.value }))} />
                </div>
              </div>

              {/* Bill photo */}
              <div>
                <label className="label">Bill Photo</label>
                {billPreview ? (
                  <div className="relative inline-block">
                    <img src={billPreview} alt="Bill preview" className="w-40 h-28 object-cover rounded-xl border border-gray-200" />
                    <button type="button" onClick={() => { setBillFile(null); setBillPreview('') }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => billInputRef.current?.click()}
                    className="flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors">
                    <Image size={16} /> Upload bill photo
                  </button>
                )}
                <input ref={billInputRef} type="file" accept="image/*" className="hidden" onChange={handleBillSelect} />
              </div>
            </>
          )}

          {/* ── Outward-only fields ── */}
          {!isInward && (
            <>
              {currentStock !== null && currentStock <= 0 && (
                <div className="flex items-center gap-1.5 text-red-600 text-xs">
                  <AlertTriangle size={12} /> This item is out of stock. Cannot issue.
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Reason / Type *</label>
                  <select required className="input" value={outForm.purpose_type}
                    onChange={e => setOutForm(f => ({ ...f, purpose_type: e.target.value }))}>
                    {ISSUE_PURPOSE_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Details / Reference</label>
                  <input className="input" placeholder="e.g. PO #45, Machine name"
                    value={outForm.purpose}
                    onChange={e => setOutForm(f => ({ ...f, purpose: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="label">Issued To *</label>
                <input required className="input" placeholder="Name of person taking the item"
                  value={outForm.issued_to_name}
                  onChange={e => setOutForm(f => ({ ...f, issued_to_name: e.target.value }))} />
              </div>
            </>
          )}

          {/* Location (shared, field name differs per mode) */}
          <div>
            <label className="label flex items-center gap-1.5">
              <MapPin size={14} className="text-brand-500" />
              {isInward ? 'Put in Shelf / Rack' : 'Location From'}
            </label>
            {locations.length === 0 ? (
              <input className="input font-mono" placeholder="e.g. ST1-A-2"
                value={isInward ? inForm.location_code : outForm.location_from}
                onChange={e => isInward
                  ? setInForm(f => ({ ...f, location_code: e.target.value }))
                  : setOutForm(f => ({ ...f, location_from: e.target.value }))} />
            ) : (
              <select className="input"
                value={isInward ? inForm.location_code : outForm.location_from}
                onChange={e => isInward
                  ? setInForm(f => ({ ...f, location_code: e.target.value }))
                  : setOutForm(f => ({ ...f, location_from: e.target.value }))}>
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
            )}
          </div>

          {/* Notes (shared) */}
          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} placeholder="Any additional notes…"
              value={isInward ? inForm.notes : outForm.notes}
              onChange={e => isInward
                ? setInForm(f => ({ ...f, notes: e.target.value }))
                : setOutForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-1">
            <button type="submit"
              disabled={saving || uploadingBill || (!isInward && (!!qtyError || (currentStock !== null && currentStock <= 0)))}
              className={`flex-1 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60 transition-colors ${
                isInward ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'
              }`}>
              {uploadingBill ? 'Uploading…' : saving ? 'Saving…' : isInward ? 'Record Inward' : 'Record Outward'}
            </button>
            <button type="button" onClick={() => navigate('/store')}
              className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* Quick Add Item Modal (inward) */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Quick Add Item</h2>
              <button onClick={() => setShowItemModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveNewItem} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Item Name *</label>
                <input required className="input" placeholder="e.g. M8 Bolt"
                  value={itemForm.name}
                  onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input resize-none" rows={2} placeholder="Optional"
                  value={itemForm.description}
                  onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={itemForm.category} onChange={e => setItemForm(f => ({ ...f, category: e.target.value }))}>
                    {STORE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Unit</label>
                  <select className="input" value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))}>
                    {STORE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={savingItem}
                  className="flex-1 bg-brand-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-60 transition-colors">
                  {savingItem ? 'Adding…' : 'Add Item'}
                </button>
                <button type="button" onClick={() => setShowItemModal(false)}
                  className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
