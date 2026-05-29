import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  PackagePlus, Plus, ChevronDown
} from 'lucide-react'
import AccessDenied from '../components/AccessDenied'
import StoreItemSearchDropdown from '../components/StoreItemSearchDropdown'
import { useStoreForm } from '../hooks/useStoreForm'
import { groupLocationsByStore } from '../lib/storeLocationUtils'
import { STORE_ROLES, hasStoreAccess } from '../lib/storeRoles'
import { STORE_CATEGORIES, STORE_UNITS, QUANTITY_RULES, FORM_DEFAULTS } from '../lib/storeConstants'

const ALLOWED_ROLES = STORE_ROLES.RECEIVE

const EMPTY_FORM = {
  item_id: '',
  receipt_date: FORM_DEFAULTS.TODAY,
  quantity: '',
  unit_price: '',
  supplier_name: '',
  bill_no: '',
  lot_number: '',
  location_code: '',
  notes: '',
}

const EMPTY_ITEM_FORM = {
  name: '',
  description: '',
  category: STORE_CATEGORIES[0],
  unit: STORE_UNITS[0],
}

export default function StoreReceive({ profile }) {
  if (!ALLOWED_ROLES.includes(profile?.role)) return <AccessDenied />

  const navigate = useNavigate()
  const { t } = useTranslation()
  const { form, updateField, resetForm, saving, setSaving } = useStoreForm(EMPTY_FORM)
  
  const [items, setItems] = useState([])
  const [locations, setLocations] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)

  // Bill image
  const [billFile, setBillFile] = useState(null)
  const [billPreview, setBillPreview] = useState('')
  const [uploadingBill, setUploadingBill] = useState(false)
  const billInputRef = useRef(null)

  // Quick add item modal
  const [showItemModal, setShowItemModal] = useState(false)
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM)
  const [savingItem, setSavingItem] = useState(false)

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
      // Removed - handled by StoreItemSearchDropdown component
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.item_id) { toast.error('Please select an item'); return }
    if (!form.quantity || Number(form.quantity) <= 0) { toast.error('Quantity must be greater than 0'); return }

    setSaving(true)
    const billImageUrl = await uploadBill()
    if (billFile && billImageUrl === null) { setSaving(false); return }

    const payload = {
      item_id:       form.item_id,
      receipt_date:  form.receipt_date,
      quantity:      Number(form.quantity),
      unit_price:    form.unit_price ? Number(form.unit_price) : null,
      supplier_name: form.supplier_name.trim() || null,
      bill_no:       form.bill_no.trim() || null,
      lot_number:    form.lot_number.trim() || null,
      bill_image_url: billImageUrl,
      location_code: form.location_code || null,
      notes:         form.notes.trim() || null,
      received_by:   profile.id,
      txn_type:      'purchase',
      verified_at:   null,
      verified_by:   null,
    }

    const { error } = await supabase.from('store_receipts').insert([payload])
    setSaving(false)
    if (error) {
      toast.error('Failed to save receipt: ' + error.message)
    } else {
      toast.success('Stock receipt recorded!')
      navigate('/store')
    }
  }

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
    if (error) {
      toast.error('Failed to add item: ' + error.message)
    } else {
      toast.success('Item added!')
      await fetchItems()
      selectItem(data)
      setShowItemModal(false)
      setItemForm(EMPTY_ITEM_FORM)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-green-100 p-2.5 rounded-xl">
          <PackagePlus className="text-green-600" size={22} />
        </div>
        <div>
          <h1 className="page-header">Store Inward</h1>
          <p className="text-gray-500 text-sm mt-0.5">Record items coming into the store from supplier</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Item Selector */}
          <div>
            <label className="label">{t('receive.itemLabel')}</label>
            <div className="relative" ref={itemSearchRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input
                  className="input pl-9 pr-9"
                  placeholder={t('receive.searchItems')}
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
                  <div className="border-t border-gray-100 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => { setShowItemDropdown(false); setShowItemModal(true) }}
                      className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium"
                    >
                      <Plus size={14} />
                      {t('receive.quickAddItem')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {selectedItem && (
              <div className="mt-2 flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                <div className="w-7 h-7 rounded-md bg-white border border-green-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {selectedItem.item_image_url
                    ? <img src={selectedItem.item_image_url} alt={selectedItem.name} className="w-full h-full object-cover" />
                    : <Image size={12} className="text-gray-300" />
                  }
                </div>
                <span className="font-medium truncate">{selectedItem.name}</span>
                <span className="text-green-500 text-xs ml-auto flex-shrink-0">Unit: {selectedItem.unit}</span>
              </div>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="label">{t('receive.receiptDate')}</label>
            <input
              required
              type="date"
              className="input"
              value={form.receipt_date}
              onChange={e => setForm(f => ({ ...f, receipt_date: e.target.value }))}
            />
          </div>

          {/* Quantity + Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('receive.quantity')}</label>
              <div className="flex">
                <input
                  required
                  type="number"
                  min="0.001"
                  step="any"
                  className="input rounded-r-none"
                  placeholder="0"
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                />
                <span className="inline-flex items-center px-3 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 rounded-r-lg text-sm whitespace-nowrap">
                  {selectedItem?.unit || 'unit'}
                </span>
              </div>
            </div>
            <div>
              <label className="label">{t('receive.unitPrice')}</label>
              <input
                type="number"
                min="0"
                step="any"
                className="input"
                placeholder="0.00"
                value={form.unit_price}
                onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
              />
            </div>
          </div>

          {/* Supplier + Bill No */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Supplier Name</label>
              <input
                className="input"
                placeholder="e.g. ABC Traders"
                value={form.supplier_name}
                onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">{t('receive.billNo')}</label>
              <input
                className="input"
                placeholder="e.g. INV-2024-001"
                value={form.bill_no}
                onChange={e => setForm(f => ({ ...f, bill_no: e.target.value }))}
              />
            </div>
          </div>

          {/* Lot Number */}
          <div>
            <label className="label">Lot / Batch Number <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              className="input font-mono"
              placeholder="e.g. LOT-2025-001 (for traceability)"
              value={form.lot_number}
              onChange={e => setForm(f => ({ ...f, lot_number: e.target.value }))}
            />
          </div>

          {/* Bill Photo */}
          <div>
            <label className="label">{t('receive.billPhoto')}</label>
            {billPreview ? (
              <div className="relative inline-block">
                <img
                  src={billPreview}
                  alt="Bill preview"
                  className="w-40 h-28 object-cover rounded-xl border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => { setBillFile(null); setBillPreview('') }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => billInputRef.current?.click()}
                className="flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
              >
                <Image size={16} />
                {t('receive.uploadBill')}
              </button>
            )}
            <input
              ref={billInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBillSelect}
            />
          </div>

          {/* Location */}
          <div>
            <label className="label flex items-center gap-1.5">
              <MapPin size={14} className="text-brand-500" />
              {t('receive.storageLocation')}
            </label>
            {locations.length === 0 ? (
              <p className="text-sm text-gray-400 mt-1">
                {t('receive.noLocations')}{' '}
                {['owner', 'admin'].includes(profile.role) && (
                  <a href="/store/locations" className="text-brand-500 hover:underline">{t('receive.setupLocations')}</a>
                )}
              </p>
            ) : (
              <div className="space-y-2">
                <select
                  className="input"
                  value={form.location_code}
                  onChange={e => setForm(f => ({ ...f, location_code: e.target.value }))}
                >
                  <option value="">{t('receive.selectLocation')}</option>
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
                {form.location_code && (
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-brand-500 flex-shrink-0" />
                    <span className="text-sm font-semibold text-brand-700 font-mono tracking-wide">
                      {form.location_code}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Any notes about this receipt…"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          {/* Summary */}
          {selectedItem && form.quantity && (
            <div className="bg-brand-50 border border-indigo-200 rounded-lg px-4 py-3 text-sm text-indigo-800">
              Receiving <strong>{form.quantity} {selectedItem.unit}</strong> of <strong>{selectedItem.name}</strong>
              {form.unit_price && (
                <> — {t('receive.totalValue')} <strong>₹{(Number(form.quantity) * Number(form.unit_price)).toLocaleString('en-IN')}</strong></>
              )}
              {form.location_code && <> {t('receive.at')} <strong className="font-mono">{form.location_code}</strong></>}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || uploadingBill}
              className="flex-1 bg-brand-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-60 transition-colors"
            >
              {uploadingBill ? t('receive.uploading') : saving ? t('receive.saving') : t('receive.recordReceipt')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/store')}
              className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>

      {/* Quick Add Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{t('receive.quickAdd.title')}</h2>
              <button onClick={() => setShowItemModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveNewItem} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">{t('receive.quickAdd.itemName')}</label>
                <input
                  required
                  className="input"
                  placeholder={t('receive.quickAdd.namePlaceholder')}
                  value={itemForm.name}
                  onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">{t('receive.quickAdd.description')}</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder="Optional"
                  value={itemForm.description}
                  onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('receive.quickAdd.category')}</label>
                  <select className="input" value={itemForm.category} onChange={e => setItemForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('receive.quickAdd.unit')}</label>
                  <select className="input" value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={savingItem}
                  className="flex-1 bg-brand-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-60 transition-colors"
                >
                  {savingItem ? t('receive.quickAdd.adding') : t('receive.quickAdd.addItem')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
