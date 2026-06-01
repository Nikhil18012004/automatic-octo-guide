import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, Search, X, Image, TrendingUp, TrendingDown, Minus, Lock, Unlock, Clock } from 'lucide-react'
import AccessDenied from '../components/AccessDenied'
import { unlockStore, lockStore, getUnlockState, onCodesChange, STOCK_ACCESS_MINUTES } from '../lib/gateCodes'

const ALLOWED_ROLES = ['owner', 'admin']
const ADJUST_REASONS = [
  'Physical count difference',
  'Damaged / broken',
  'Expired / unusable',
  'Lost / missing',
  'Recording error correction',
  'Transfer discrepancy',
  'Other',
]
const TODAY = new Date().toISOString().split('T')[0]

export default function StoreAdjust({ profile }) {
  if (!ALLOWED_ROLES.includes(profile?.role)) return <AccessDenied />

  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [itemSearch, setItemSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [systemStock, setSystemStock] = useState(null)
  const [loadingStock, setLoadingStock] = useState(false)
  const [physicalQty, setPhysicalQty] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [adjustDate, setAdjustDate] = useState(TODAY)
  const [saving, setSaving] = useState(false)

  const searchRef = useRef(null)
  const dropdownRef = useRef(null)

  // Store-access unlock window (30 min)
  const [unlock, setUnlock] = useState(getUnlockState())
  useEffect(() => {
    const refresh = () => setUnlock(getUnlockState())
    refresh()
    const id = setInterval(refresh, 1000)
    const off = onCodesChange(refresh)
    return () => { clearInterval(id); off() }
  }, [])
  const fmtUnlock = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from('store_items').select('id, name, unit, item_image_url, category')
      .eq('is_active', true).order('name')
    setItems(data || [])
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

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

  async function fetchSystemStock(itemId) {
    setLoadingStock(true)
    setSystemStock(null)
    const [{ data: receipts }, { data: issues }] = await Promise.all([
      supabase.from('store_receipts').select('quantity').eq('item_id', itemId),
      supabase.from('store_issues').select('quantity').eq('item_id', itemId),
    ])
    const inn = (receipts || []).reduce((s, r) => s + (Number(r.quantity) || 0), 0)
    const out = (issues || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0)
    setSystemStock(inn - out)
    setLoadingStock(false)
  }

  function selectItem(item) {
    setSelectedItem(item)
    setItemSearch(item.name)
    setShowDropdown(false)
    setPhysicalQty('')
    fetchSystemStock(item.id)
  }

  function clearItem() {
    setSelectedItem(null)
    setItemSearch('')
    setSystemStock(null)
    setPhysicalQty('')
  }

  const diff = systemStock !== null && physicalQty !== '' ? Number(physicalQty) - systemStock : null

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedItem)  { toast.error('Please select an item'); return }
    if (physicalQty === '') { toast.error('Enter physical count'); return }
    if (!reason)        { toast.error('Please select a reason'); return }
    if (diff === 0)     { toast.success('No adjustment needed — system matches physical count'); return }

    setSaving(true)
    const absDiff = Math.abs(diff)
    const shortNote = `Stock count: system ${systemStock} → physical ${physicalQty} (${diff > 0 ? '+' : ''}${diff}). ${reason}${notes ? '. ' + notes : ''}`

    if (diff > 0) {
      // Physical > System → add the difference as a receipt
      const payload = {
        item_id:      selectedItem.id,
        receipt_date: adjustDate,
        quantity:     absDiff,
        unit_price:   null,
        bill_no:      `ADJ-${adjustDate}`,
        notes:        shortNote,
        received_by:  profile.id,
        verified_at:  new Date().toISOString(),
        verified_by:  profile.id,
      }
      const { error } = await supabase.from('store_receipts').insert([{ ...payload, txn_type: 'adjustment' }])
      if (error && error.message.includes('txn_type')) {
        const { error: e2 } = await supabase.from('store_receipts').insert([payload])
        if (e2) { toast.error('Failed: ' + e2.message); setSaving(false); return }
      } else if (error) {
        toast.error('Failed: ' + error.message); setSaving(false); return
      }
    } else {
      // Physical < System → remove the difference as an issue
      const payload = {
        item_id:        selectedItem.id,
        issue_date:     adjustDate,
        quantity:       absDiff,
        purpose:        `Stock Count Adjustment — ${reason}`,
        issued_to_name: 'Physical Count',
        notes:          shortNote,
        issued_by:      profile.id,
      }
      const { error } = await supabase.from('store_issues').insert([{ ...payload, purpose_type: 'adjustment' }])
      if (error && error.message.includes('purpose_type')) {
        const { error: e2 } = await supabase.from('store_issues').insert([payload])
        if (e2) { toast.error('Failed: ' + e2.message); setSaving(false); return }
      } else if (error) {
        toast.error('Failed: ' + error.message); setSaving(false); return
      }
    }

    setSaving(false)
    toast.success(`Stock adjusted: ${diff > 0 ? '+' : ''}${diff} ${selectedItem.unit}`)
    navigate('/store')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-purple-100 p-2.5 rounded-xl">
          <ClipboardCheck className="text-purple-600" size={22} />
        </div>
        <div>
          <h1 className="page-header">Stock Count</h1>
          <p className="text-gray-500 text-sm mt-0.5">Correct stock when physical count doesn't match system</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-sm text-amber-800">
        <strong>When to use:</strong> During monthly physical count, or when you find a discrepancy between what the system shows and what is actually in the store.
        Only Owner / Admin can perform adjustments.
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Item */}
          <div>
            <label className="label">Select Item *</label>
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
          </div>

          {/* System stock display */}
          {selectedItem && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">System Stock</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {loadingStock ? '…' : systemStock !== null ? systemStock : '—'}
                    <span className="text-base font-normal text-gray-500 ml-1">{selectedItem.unit}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-700">{selectedItem.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">as per system records</p>
                </div>
              </div>
            </div>
          )}

          {/* Physical count */}
          {selectedItem && systemStock !== null && (
            <>
              <div>
                <label className="label">Physical Count — What you actually counted *</label>
                <div className="flex">
                  <input required type="number" min="0" step="any"
                    className="input rounded-r-none text-lg font-bold"
                    placeholder="0" value={physicalQty}
                    onChange={e => setPhysicalQty(e.target.value)} />
                  <span className="inline-flex items-center px-3 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 rounded-r-lg text-sm whitespace-nowrap">
                    {selectedItem.unit}
                  </span>
                </div>
              </div>

              {diff !== null && (
                <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                  diff === 0 ? 'bg-green-50 border border-green-200' :
                  diff > 0  ? 'bg-emerald-50 border border-emerald-200' :
                               'bg-red-50 border border-red-200'
                }`}>
                  {diff === 0 ? <Minus size={18} className="text-green-500" /> :
                   diff > 0  ? <TrendingUp size={18} className="text-emerald-600" /> :
                                <TrendingDown size={18} className="text-red-500" />}
                  <div className="flex-1">
                    <p className={`font-semibold text-sm ${
                      diff === 0 ? 'text-green-700' : diff > 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}>
                      {diff === 0
                        ? 'Perfect match — no adjustment needed'
                        : diff > 0
                        ? `Found ${diff} extra ${selectedItem.unit} — will be added to stock`
                        : `Short by ${Math.abs(diff)} ${selectedItem.unit} — will be removed from stock`}
                    </p>
                    <p className={`text-xs mt-0.5 ${diff === 0 ? 'text-green-500' : diff > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                      {systemStock} → {Number(physicalQty)} {selectedItem.unit} after adjustment
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Count date */}
          <div>
            <label className="label">Count Date *</label>
            <input required type="date" className="input"
              value={adjustDate}
              onChange={e => setAdjustDate(e.target.value)} />
          </div>

          {/* Reason */}
          <div>
            <label className="label">Reason for Difference *</label>
            <select required className="input" value={reason}
              onChange={e => setReason(e.target.value)}>
              <option value="">Select reason…</option>
              {ADJUST_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2}
              placeholder="Additional details about this count…"
              value={notes}
              onChange={e => setNotes(e.target.value)} />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="submit"
              disabled={saving || diff === 0 || diff === null || !reason}
              className="flex-1 bg-purple-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-60 transition-colors">
              {saving ? 'Saving…'
                : diff === 0 ? 'No Adjustment Needed'
                : diff > 0  ? `Add +${diff} to Stock`
                : diff !== null ? `Remove ${Math.abs(diff)} from Stock`
                : 'Submit Adjustment'}
            </button>
            <button type="button" onClick={() => navigate('/store')}
              className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* Store Access — unlock the gate for a physical count */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-5">
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded-lg ${unlock.unlocked ? 'bg-green-100' : 'bg-gray-100'}`}>
            {unlock.unlocked ? <Unlock className="text-green-600" size={18} /> : <Lock className="text-gray-500" size={18} />}
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">Store Access</h2>
            <p className="text-xs text-gray-500">
              Unlock the store gate for {STOCK_ACCESS_MINUTES} minutes to do a physical count. It re-locks automatically when time runs out.
            </p>
          </div>
        </div>
        {unlock.unlocked ? (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 flex items-center gap-1.5">
              <Clock size={12} /> Unlocked — {fmtUnlock(unlock.secondsLeft)} left
            </span>
            <button type="button" onClick={() => lockStore()} className="text-sm text-red-600 underline hover:no-underline">
              Lock now
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => unlockStore(STOCK_ACCESS_MINUTES, profile?.full_name || profile?.id)}
            className="bg-purple-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <Unlock size={15} /> Unlock store for {STOCK_ACCESS_MINUTES} min
          </button>
        )}
      </div>
    </div>
  )
}
