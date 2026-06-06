import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  PackageMinus, AlertTriangle, CheckCircle2, MapPin, Search, X, Image
} from 'lucide-react'
import AccessDenied from '../components/AccessDenied'
import { useStoreForm } from '../hooks/useStoreForm'
import { groupLocationsByStore } from '../lib/storeLocationUtils'
import { STORE_ROLES } from '../lib/storeRoles'
import { ISSUE_PURPOSE_TYPES, QUANTITY_RULES, FORM_DEFAULTS } from '../lib/storeConstants'

const ALLOWED_ROLES = STORE_ROLES.ISSUE

const EMPTY_FORM = {
  item_id: '',
  issue_date: FORM_DEFAULTS.TODAY,
  quantity: '',
  purpose_type: 'production',
  purpose: '',
  issued_to_name: '',
  location_from: '',
  notes: '',
}

export default function StoreIssue({ profile }) {
  if (!ALLOWED_ROLES.includes(profile?.role)) return <AccessDenied />
  return <StoreIssueInner profile={profile} />
}

function StoreIssueInner({ profile }) {

  const navigate = useNavigate()
  const { t } = useTranslation()
  const { form, setForm, updateField, resetForm, saving, setSaving } = useStoreForm(EMPTY_FORM)

  const [items, setItems] = useState([])
  const [locations, setLocations] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [currentStock, setCurrentStock] = useState(null)
  const [loadingStock, setLoadingStock] = useState(false)
  const [qtyError, setQtyError] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [showItemDropdown, setShowItemDropdown] = useState(false)

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

  const fetchLocations = useCallback(async () => {
    const { data } = await supabase
      .from('store_locations')
      .select('store_code, store_name, zone_code, zone_label')
      .eq('is_active', true)
      .neq('zone_code', '_meta')
      .order('store_code')
      .order('zone_code')
    setLocations(data || [])
  }, [])

  useEffect(() => { fetchItems(); fetchLocations() }, [fetchItems, fetchLocations])

  const locationGroups = groupLocationsByStore(locations)

  // Close dropdown on outside click
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

  async function fetchStockAndLocation(itemId) {
    setLoadingStock(true)
    setCurrentStock(null)

    const [{ data: receipts }, { data: issues }] = await Promise.all([
      supabase.from('store_receipts').select('quantity, location_code').eq('item_id', itemId),
      supabase.from('store_issues').select('quantity').eq('item_id', itemId),
    ])

    const totalIn = (receipts || []).reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
    const totalOut = (issues || []).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)
    const stock = totalIn - totalOut
    setCurrentStock(stock)

    // Auto-fill location from most recent receipt
    if (receipts && receipts.length > 0) {
      const lastLocation = receipts[receipts.length - 1].location_code || ''
      setForm(f => ({ ...f, location_from: lastLocation }))
    }

    setLoadingStock(false)
  }

  function selectItem(item) {
    setSelectedItem(item)
    setItemSearch(item.name)
    setForm(f => ({ ...f, item_id: item.id, quantity: '' }))
    setQtyError('')
    setShowItemDropdown(false)
    fetchStockAndLocation(item.id)
  }

  function clearItem() {
    setSelectedItem(null)
    setItemSearch('')
    setCurrentStock(null)
    setQtyError('')
    setForm(EMPTY_FORM)
  }

  function handleQtyChange(val) {
    setForm(f => ({ ...f, quantity: val }))
    if (currentStock !== null && val && Number(val) > currentStock) {
      setQtyError(`Cannot issue more than current stock (${currentStock} ${selectedItem?.unit})`)
    } else {
      setQtyError('')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.item_id) { toast.error('Please select an item'); return }
    if (!form.quantity || Number(form.quantity) <= 0) { toast.error('Quantity must be greater than 0'); return }
    if (currentStock !== null && Number(form.quantity) > currentStock) {
      toast.error('Quantity exceeds current stock')
      return
    }
    if (!form.purpose.trim()) { toast.error('Purpose is required'); return }
    if (!form.issued_to_name.trim()) { toast.error('Issued To name is required'); return }

    setSaving(true)
    const { error } = await supabase.from('store_issues').insert([{
      item_id:        form.item_id,
      issue_date:     form.issue_date,
      quantity:       Number(form.quantity),
      purpose_type:   form.purpose_type,
      purpose:        form.purpose.trim() || ISSUE_PURPOSE_TYPES.find(p => p.value === form.purpose_type)?.label || form.purpose_type,
      issued_to_name: form.issued_to_name.trim(),
      location_from:  form.location_from.trim() || null,
      notes:          form.notes.trim() || null,
      issued_by:      profile.id,
    }])
    setSaving(false)

    if (error) {
      toast.error('Failed to record issue: ' + error.message)
    } else {
      toast.success('Item issued successfully!')
      navigate('/store')
    }
  }

  const stockStatus = () => {
    if (currentStock === null) return null
    if (currentStock <= 0) return { label: t('issue.outOfStock'), cls: 'bg-red-100 text-red-700' }
    if (currentStock < 3) return { label: t('issue.lowStock'), cls: 'bg-orange-100 text-orange-700' }
    return { label: `${t('issue.inStockLabel')} ${currentStock} ${selectedItem?.unit || ''}`, cls: 'bg-green-100 text-green-700' }
  }

  const status = stockStatus()

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-orange-100 p-2.5 rounded-xl">
          <PackageMinus className="text-orange-600" size={22} />
        </div>
        <div>
          <h1 className="page-header">Store Outward</h1>
          <p className="text-gray-500 text-sm mt-0.5">Record items leaving the store</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Item Selector */}
          <div>
            <label className="label">Item *</label>
            <div className="relative" ref={itemSearchRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input
                  className="input pl-9 pr-9"
                  placeholder="Search items…"
                  value={itemSearch}
                  onChange={e => {
                    setItemSearch(e.target.value)
                    setShowItemDropdown(true)
                    if (!e.target.value) clearItem()
                  }}
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
                <div
                  ref={dropdownRef}
                  className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto"
                >
                  {filteredItems.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500">No items found</div>
                  ) : (
                    filteredItems.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectItem(item)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-brand-50 text-left transition-colors"
                      >
                        <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {item.item_image_url
                            ? <img src={item.item_image_url} alt={item.name} className="w-full h-full object-cover" />
                            : <Image size={16} className="text-gray-300" />
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                          <p className="text-xs text-gray-400">{item.category} · {item.unit}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Stock badge */}
            {selectedItem && (
              <div className="mt-2 flex items-center gap-2">
                {loadingStock ? (
                  <span className="text-xs text-gray-400">{t('issue.checkingStock')}</span>
                ) : status ? (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${status.cls}`}>
                    {status.label}
                  </span>
                ) : null}
              </div>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="label">Issue Date *</label>
            <input
              required
              type="date"
              className="input"
              value={form.issue_date}
              onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))}
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="label">Quantity *</label>
            <div className="flex">
              <input
                required
                type="number"
                min="0.001"
                step="any"
                className={`input rounded-r-none ${qtyError ? 'border-red-400 focus:ring-red-400' : ''}`}
                placeholder="0"
                value={form.quantity}
                onChange={e => handleQtyChange(e.target.value)}
                disabled={!selectedItem}
              />
              <span className="inline-flex items-center px-3 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 rounded-r-lg text-sm whitespace-nowrap">
                {selectedItem?.unit || 'unit'}
              </span>
            </div>
            {qtyError && (
              <div className="flex items-center gap-1.5 mt-1.5 text-red-600 text-xs">
                <AlertTriangle size={12} />
                {qtyError}
              </div>
            )}
            {currentStock !== null && currentStock <= 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 text-red-600 text-xs">
                <AlertTriangle size={12} />
                This item is out of stock. Cannot issue.
              </div>
            )}
          </div>

          {/* Purpose Type + Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Reason / Type *</label>
              <select required className="input" value={form.purpose_type}
                onChange={e => setForm(f => ({ ...f, purpose_type: e.target.value }))}>
                {ISSUE_PURPOSE_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Details / Reference</label>
              <input
                className="input"
                placeholder="e.g. PO #45, Machine name"
                value={form.purpose}
                onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
              />
            </div>
          </div>

          {/* Issued To */}
          <div>
            <label className="label">Issued To *</label>
            <input
              required
              className="input"
              placeholder="Name of person taking the item"
              value={form.issued_to_name}
              onChange={e => setForm(f => ({ ...f, issued_to_name: e.target.value }))}
            />
          </div>

          {/* Location From */}
          <div>
            <label className="label flex items-center gap-1.5">
              <MapPin size={14} className="text-brand-500" />
              Location From
            </label>
            {locations.length === 0 ? (
              <input
                className="input font-mono"
                placeholder="e.g. ST1-A-2"
                value={form.location_from}
                onChange={e => setForm(f => ({ ...f, location_from: e.target.value }))}
              />
            ) : (
              <select
                className="input"
                value={form.location_from}
                onChange={e => setForm(f => ({ ...f, location_from: e.target.value }))}
              >
                <option value="">— Select location —</option>
                {Object.entries(locationGroups).map(([storeCode, { store_name, zones }]) => (
                  <optgroup key={storeCode} label={`${store_name} (${storeCode})`}>
                    {zones.map(zone => {
                      const code = `${storeCode}-${zone.zone_code}`
                      return (
                        <option key={code} value={code}>
                          {zone.zone_label ? `${code} — ${zone.zone_label}` : code}
                        </option>
                      )
                    })}
                  </optgroup>
                ))}
              </select>
            )}
            {form.location_from && (
              <p className="text-xs text-gray-400 mt-1">Auto-filled from last receipt. Change if needed.</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Any additional notes…"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          {/* Summary */}
          {selectedItem && form.quantity && !qtyError && Number(form.quantity) > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-800 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-orange-500 flex-shrink-0" />
              Issuing <strong>{form.quantity} {selectedItem.unit}</strong> of <strong>{selectedItem.name}</strong>
              {form.issued_to_name && <> to <strong>{form.issued_to_name}</strong></>}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || !!qtyError || (currentStock !== null && currentStock <= 0)}
              className="flex-1 bg-brand-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving…' : 'Record Issue'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/store')}
              className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
