import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { PackagePlus, CheckCircle, Clock, Image, X, ZoomIn, MapPin, Plus } from 'lucide-react'
import AccessDenied from '../components/AccessDenied'

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

const EMPTY_FORM = {
  material_id: '', quantity: '', cost_per_unit: '',
  supplier_name: '', invoice_number: '', lot_number: '',
  receipt_date: new Date().toISOString().split('T')[0],
  notes: '', location_code: '',
}

const EMPTY_LOC = { store_code: '', store_name: '', zone_code: '', zone_label: '', is_new_room: false }

export default function StockIn({ profile }) {
  if (!['owner', 'operator'].includes(profile.role)) return <AccessDenied />

  const [materials,     setMaterials]     = useState([])
  const [recent,        setRecent]        = useState([])
  const [loading,       setLoading]       = useState(false)
  const [locations,     setLocations]     = useState([])
  const [form,          setForm]          = useState(EMPTY_FORM)

  // Invoice photo
  const [billFile,      setBillFile]      = useState(null)
  const [billPreview,   setBillPreview]   = useState('')
  const [uploadingBill, setUploadingBill] = useState(false)
  const [lightboxUrl,   setLightboxUrl]   = useState(null)
  const billInputRef = useRef(null)

  // Inline location creator
  const [showLocModal,  setShowLocModal]  = useState(false)
  const [locForm,       setLocForm]       = useState(EMPTY_LOC)
  const [savingLoc,     setSavingLoc]     = useState(false)

  const fetchMaterials = useCallback(async () => {
    const { data } = await supabase
      .from('materials').select('id, name, unit, supplier_name')
      .eq('is_active', true).order('name')
    setMaterials(data || [])
  }, [])

  const fetchRecent = useCallback(async () => {
    const { data } = await supabase
      .from('stock_receipts')
      .select('id, quantity, receipt_date, supplier_name, bill_image_url, location_code, materials(name, unit)')
      .order('created_at', { ascending: false })
      .limit(5)
    setRecent(data || [])
  }, [])

  const fetchLocations = useCallback(async () => {
    const { data } = await supabase
      .from('store_locations')
      .select('store_code, store_name, zone_code, zone_label')
      .eq('is_active', true)
      .neq('zone_code', '_meta')
      .order('store_code').order('zone_code')
    setLocations(data || [])
  }, [])

  useEffect(() => {
    fetchMaterials()
    fetchRecent()
    fetchLocations()
  }, [])

  // Grouped for select optgroups
  const locationGroups = locations.reduce((acc, loc) => {
    if (!acc[loc.store_code]) acc[loc.store_code] = { store_name: loc.store_name, zones: [] }
    acc[loc.store_code].zones.push(loc)
    return acc
  }, {})

  // Store rooms available for the modal's "pick existing room" dropdown
  const storeRooms = Object.entries(locationGroups).map(([code, { store_name }]) => ({ code, store_name }))

  const selected   = materials.find(m => m.id === form.material_id)
  const totalValue = form.quantity && form.cost_per_unit
    ? (Number(form.quantity) * Number(form.cost_per_unit)).toLocaleString('en-IN')
    : null

  function handleBillSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 10 * 1024 * 1024)   { toast.error('Image must be under 10 MB'); return }
    setBillFile(file)
    setBillPreview(URL.createObjectURL(file))
  }

  async function uploadBill() {
    if (!billFile) return null
    setUploadingBill(true)
    const ext  = billFile.name.split('.').pop()
    const path = `bills/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('store-media').upload(path, billFile)
    setUploadingBill(false)
    if (error) { toast.error('Invoice upload failed: ' + error.message); return null }
    const { data: { publicUrl } } = supabase.storage.from('store-media').getPublicUrl(path)
    return publicUrl
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.material_id || !form.quantity) { toast.error('Please fill all required fields'); return }
    setLoading(true)
    const billImageUrl = await uploadBill()
    if (billFile && billImageUrl === null) { setLoading(false); return }

    const payload = {
      material_id:    form.material_id,
      quantity:       Number(form.quantity),
      unit:           selected?.unit || 'kg',
      cost_per_unit:  Number(form.cost_per_unit) || null,
      supplier_name:  form.supplier_name,
      invoice_number: form.invoice_number,
      lot_number:     form.lot_number,
      receipt_date:   form.receipt_date,
      notes:          form.notes,
      received_by:    profile.id,
      bill_image_url: billImageUrl,
    }
    // Only include location_code if the column exists — graceful fallback
    if (form.location_code) payload.location_code = form.location_code

    const { error } = await supabase.from('stock_receipts').insert([payload])
    setLoading(false)
    if (error) { toast.error('Error: ' + error.message); return }
    toast.success('Material inward recorded!')
    setForm(EMPTY_FORM)
    setBillFile(null)
    setBillPreview('')
    fetchRecent()
    fetchMaterials()
  }

  // ── Inline location creator ────────────────────────────────────────────────
  function openLocModal() {
    setLocForm(EMPTY_LOC)
    setShowLocModal(true)
  }

  async function handleSaveLoc(e) {
    e.preventDefault()
    const zoneCode = locForm.zone_code.trim().toUpperCase()
    if (!zoneCode) { toast.error('Zone code is required'); return }

    let storeCode = locForm.store_code.trim().toUpperCase().replace(/\s+/g, '')
    let storeName = ''

    if (locForm.is_new_room) {
      storeCode = locForm.store_code.trim().toUpperCase().replace(/\s+/g, '')
      storeName = locForm.store_name.trim()
      if (!storeCode || !storeName) { toast.error('Store room name and code are required'); return }
      // Create the room sentinel first
      const { error: roomErr } = await supabase.from('store_locations').insert([{
        store_code: storeCode, store_name: storeName,
        zone_code: '_meta', zone_label: 'Room anchor — do not delete', is_active: false,
      }])
      if (roomErr && roomErr.code !== '23505') {
        toast.error('Failed to create store room: ' + roomErr.message); return
      }
    } else {
      const room = storeRooms.find(r => r.code === storeCode)
      storeName = room?.store_name || storeCode
    }

    setSavingLoc(true)
    const fullCode = `${storeCode}-${zoneCode}`
    const { error } = await supabase.from('store_locations').insert([{
      store_code: storeCode,
      store_name: storeName,
      zone_code:  zoneCode,
      zone_label: locForm.zone_label.trim() || null,
      is_active:  true,
    }])
    setSavingLoc(false)
    if (error) {
      if (error.code === '23505') toast.error(`Location ${fullCode} already exists`)
      else toast.error('Failed to save location: ' + error.message)
      return
    }
    toast.success(`Location ${fullCode} created!`)
    await fetchLocations()
    setForm(f => ({ ...f, location_code: fullCode }))
    setShowLocModal(false)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
          <PackagePlus size={20} className="text-emerald-600" />
        </div>
        <div>
          <h1 className="page-header">Material Inward</h1>
          <p className="page-sub">Record raw material arriving from supplier (Gate Entry)</p>
        </div>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="label">Material *</label>
            <select required className="input" value={form.material_id}
              onChange={e => {
                const mat = materials.find(m => m.id === e.target.value)
                setForm({ ...form, material_id: e.target.value, supplier_name: mat?.supplier_name || '' })
              }}>
              <option value="">Select material…</option>
              {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Quantity Received *</label>
              <div className="flex">
                <input required type="number" step="0.001" min="0.001" className="input rounded-r-none"
                  placeholder="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
                <span className="inline-flex items-center px-3 border border-l-0 border-gray-200 bg-gray-50 text-gray-500 rounded-r-xl text-sm font-medium">
                  {selected?.unit || 'unit'}
                </span>
              </div>
            </div>
            <div>
              <label className="label">Cost per Unit (₹)</label>
              <input type="number" step="0.01" className="input" placeholder="0.00"
                value={form.cost_per_unit} onChange={e => setForm({ ...form, cost_per_unit: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Supplier Name</label>
              <input className="input" placeholder="e.g. Hindalco"
                value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} />
            </div>
            <div>
              <label className="label">Receipt / Invoice No.</label>
              <input className="input" placeholder="e.g. INV-2024-001"
                value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Lot / Batch No.</label>
              <input className="input font-mono" placeholder="e.g. LOT-2025-001"
                value={form.lot_number} onChange={e => setForm({ ...form, lot_number: e.target.value })} />
            </div>
            <div>
              <label className="label">Receipt Date *</label>
              <input required type="date" className="input"
                value={form.receipt_date} onChange={e => setForm({ ...form, receipt_date: e.target.value })} />
            </div>
          </div>

          {/* Storage Location */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label mb-0 flex items-center gap-1.5">
                <MapPin size={14} className="text-brand-500" />
                Storage Location
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <button
                type="button"
                onClick={openLocModal}
                className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-lg transition-colors"
              >
                <Plus size={12} /> New Location
              </button>
            </div>

            {locations.length === 0 ? (
              <div className="flex items-center gap-2 border border-dashed border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-400">
                <MapPin size={15} className="text-gray-300 flex-shrink-0" />
                No storage locations yet — click <strong className="text-brand-600 mx-1">New Location</strong> to add one
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  className="input flex-1"
                  value={form.location_code}
                  onChange={e => setForm({ ...form, location_code: e.target.value })}
                >
                  <option value="">Select storage location…</option>
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
              </div>
            )}

            {form.location_code && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <MapPin size={13} className="text-brand-500 flex-shrink-0" />
                <span className="text-sm font-semibold text-brand-700 font-mono">{form.location_code}</span>
                <button type="button" onClick={() => setForm({ ...form, location_code: '' })}
                  className="ml-1 text-gray-400 hover:text-gray-600">
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Invoice / Bill Photo */}
          <div>
            <label className="label flex items-center gap-1.5">
              <Image size={14} className="text-gray-400" />
              Invoice / Bill Photo
            </label>
            {billPreview ? (
              <div className="flex items-start gap-3">
                <button type="button" onClick={() => setLightboxUrl(billPreview)}
                  className="relative w-28 h-20 rounded-xl overflow-hidden border border-gray-200 hover:border-brand-400 transition-colors group flex-shrink-0">
                  <img src={billPreview} alt="Invoice preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all">
                    <ZoomIn size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
                <button type="button" onClick={() => { setBillFile(null); setBillPreview('') }}
                  className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 mt-1">
                  <X size={14} /> Remove
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => billInputRef.current?.click()}
                className="flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors">
                <Image size={16} />
                Click to upload invoice photo (JPG / PNG, max 10 MB)
              </button>
            )}
            <input ref={billInputRef} type="file" accept="image/*" className="hidden" onChange={handleBillSelect} />
          </div>

          <div>
            <label className="label">Notes / Remarks</label>
            <textarea className="input resize-none" rows={2} placeholder="Any notes about this receipt…"
              value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>

          {form.material_id && form.quantity && (
            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-sm">
              <CheckCircle size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
              <div className="text-emerald-800">
                Adding <strong>{form.quantity} {selected?.unit}</strong> of <strong>{selected?.name}</strong>
                {totalValue && <span> — Total value: <strong>₹{totalValue}</strong></span>}
                {form.supplier_name && <span> from <strong>{form.supplier_name}</strong></span>}
                {form.location_code && <span> → <strong className="font-mono">{form.location_code}</strong></span>}
              </div>
            </div>
          )}

          <button type="submit" disabled={loading || uploadingBill} className="btn-primary w-full py-3 rounded-xl justify-center">
            {uploadingBill ? <><span className="spinner-sm" /> Uploading invoice…</>
            : loading      ? <><span className="spinner-sm" /> Recording…</>
            :                <><PackagePlus size={17} /> Record Material Inward</>}
          </button>
        </form>
      </div>

      {/* Recent receipts */}
      {recent.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
            <Clock size={13} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">Recent Inward Entries</span>
          </div>
          <div className="divide-y divide-gray-50">
            {recent.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                {r.bill_image_url ? (
                  <button type="button" onClick={() => setLightboxUrl(r.bill_image_url)}
                    className="w-9 h-9 rounded-lg overflow-hidden border border-gray-200 hover:border-brand-400 transition-colors flex-shrink-0 group relative">
                    <img src={r.bill_image_url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all">
                      <ZoomIn size={12} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                    <Image size={14} className="text-gray-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{r.materials?.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {r.supplier_name && <span className="text-[11px] text-gray-400">{r.supplier_name}</span>}
                    {r.location_code && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
                        <MapPin size={8} />{r.location_code}
                      </span>
                    )}
                    <span className="text-[11px] text-gray-400">{fmtDate(r.receipt_date)}</span>
                  </div>
                </div>
                <span className="text-sm font-bold text-emerald-700 ml-4 tabular-nums flex-shrink-0">
                  +{r.quantity} <span className="text-xs font-medium text-emerald-500">{r.materials?.unit}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bill Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightboxUrl(null)}>
          <div className="relative max-w-3xl w-full max-h-[90vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightboxUrl(null)}
              className="absolute -top-4 -right-4 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 z-10">
              <X size={18} />
            </button>
            <img src={lightboxUrl} alt="Invoice" className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain" />
          </div>
        </div>
      )}

      {/* ── New Location Modal ─────────────────────────────────────────────── */}
      {showLocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <MapPin size={18} className="text-brand-500" /> Add Storage Location
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Create a location to track where this material is stored</p>
              </div>
              <button onClick={() => setShowLocModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveLoc} className="px-6 py-5 space-y-4">

              {/* Store room */}
              <div>
                <label className="label">Store Room</label>
                {storeRooms.length > 0 && !locForm.is_new_room ? (
                  <div className="space-y-2">
                    <select className="input" value={locForm.store_code}
                      onChange={e => setLocForm(f => ({ ...f, store_code: e.target.value }))}>
                      <option value="">Select store room…</option>
                      {storeRooms.map(r => (
                        <option key={r.code} value={r.code}>{r.store_name} ({r.code})</option>
                      ))}
                    </select>
                    <button type="button"
                      onClick={() => setLocForm(f => ({ ...f, is_new_room: true, store_code: '', store_name: '' }))}
                      className="text-xs text-brand-600 hover:underline font-medium">
                      + Create new store room instead
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label text-xs">Room Name</label>
                        <input required className="input" placeholder="e.g. Raw Material Store"
                          value={locForm.store_name}
                          onChange={e => setLocForm(f => ({ ...f, store_name: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label text-xs">Room Code <span className="text-gray-400 font-normal">(short)</span></label>
                        <input required className="input font-mono" placeholder="e.g. RM"
                          value={locForm.store_code}
                          onChange={e => setLocForm(f => ({ ...f, store_code: e.target.value.toUpperCase().replace(/\s/g, '') }))} />
                      </div>
                    </div>
                    {storeRooms.length > 0 && (
                      <button type="button"
                        onClick={() => setLocForm(f => ({ ...f, is_new_room: false, store_code: '', store_name: '' }))}
                        className="text-xs text-gray-500 hover:underline">
                        ← Use existing store room
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Zone / Shelf */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Zone / Shelf Code *</label>
                  <input required className="input font-mono" placeholder="e.g. A1, B-2, RACK3"
                    value={locForm.zone_code}
                    onChange={e => setLocForm(f => ({ ...f, zone_code: e.target.value.toUpperCase() }))} />
                  {locForm.zone_code && (locForm.store_code || locForm.is_new_room) && (
                    <p className="text-xs text-brand-600 font-mono mt-1">
                      Full code: {(locForm.store_code || '??').toUpperCase()}-{locForm.zone_code}
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">Label <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input className="input" placeholder="e.g. Copper drums"
                    value={locForm.zone_label}
                    onChange={e => setLocForm(f => ({ ...f, zone_label: e.target.value }))} />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={savingLoc}
                  className="flex-1 bg-brand-500 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-brand-600 disabled:opacity-60">
                  {savingLoc ? 'Saving…' : 'Create & Select'}
                </button>
                <button type="button" onClick={() => setShowLocModal(false)}
                  className="flex-1 border border-gray-300 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
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
