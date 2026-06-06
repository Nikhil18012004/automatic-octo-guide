import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { MapPin, Plus, Trash2, RefreshCw, ChevronDown, ChevronRight, X, Zap } from 'lucide-react'
import AccessDenied from '../components/AccessDenied'

const ALLOWED_ROLES = ['owner', 'admin']

function Badge({ children, color = 'gray' }) {
  const cls = {
    green:  'bg-green-100 text-green-700',
    red:    'bg-red-100 text-red-600',
    indigo: 'bg-brand-100 text-brand-700',
    gray:   'bg-gray-100 text-gray-600',
  }[color]
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {children}
    </span>
  )
}

export default function StoreLocationManager({ profile }) {
  if (!ALLOWED_ROLES.includes(profile?.role)) return <AccessDenied />
  return <StoreLocationManagerInner profile={profile} />
}

function StoreLocationManagerInner({ profile }) {

  const [locations, setLocations]         = useState([])
  const [loading, setLoading]             = useState(true)
  const [expanded, setExpanded]           = useState({})

  // Add store room modal
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [roomForm, setRoomForm]           = useState({ store_name: '', store_code: '' })
  const [savingRoom, setSavingRoom]       = useState(false)

  // Add single zone modal
  const [showZoneModal, setShowZoneModal] = useState(false)
  const [zoneTarget, setZoneTarget]       = useState(null)   // { store_code, store_name }
  const [zoneForm, setZoneForm]           = useState({ zone_code: '', zone_label: '' })
  const [savingZone, setSavingZone]       = useState(false)

  // Batch generate modal
  const [showBatch, setShowBatch]         = useState(false)
  const [batchTarget, setBatchTarget]     = useState(null)   // { store_code, store_name }
  const [batchRacks, setBatchRacks]       = useState('A,B,C,D')
  const [batchLevels, setBatchLevels]     = useState('1,2,3,4')
  const [batchSaving, setBatchSaving]     = useState(false)

  const [deleteTarget, setDeleteTarget]   = useState(null)
  const { t } = useTranslation()

  const fetchLocations = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('store_locations')
      .select('*')
      .order('store_code')
      .order('zone_code')
    if (error) toast.error('Failed to load locations')
    setLocations(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchLocations() }, [fetchLocations])

  // Group by store_code
  const grouped = locations.reduce((acc, loc) => {
    if (!acc[loc.store_code]) {
      acc[loc.store_code] = { store_name: loc.store_name, store_code: loc.store_code, zones: [] }
    }
    acc[loc.store_code].zones.push(loc)
    return acc
  }, {})

  function toggleExpand(code) {
    setExpanded(e => ({ ...e, [code]: !e[code] }))
  }

  // ── Add store room ─────────────────────────────────────────────────────────
  async function handleAddRoom(e) {
    e.preventDefault()
    const name = roomForm.store_name.trim()
    const code = roomForm.store_code.trim().toUpperCase().replace(/\s+/g, '')
    if (!name || !code) { toast.error('Name and code are required'); return }
    if (grouped[code]) { toast.error(`Store code "${code}" already exists`); return }
    setSavingRoom(true)
    // A store room is represented by at least a placeholder zone — we just record the metadata
    // by adding a placeholder "meta" entry that the UI ignores visually
    // Actually we don't need a placeholder — just update the UI to allow rooms with 0 zones
    // We store a "sentinel" row so the store room exists in the grouped view
    const { error } = await supabase.from('store_locations').insert([{
      store_name: name,
      store_code: code,
      zone_code: '_meta',
      zone_label: 'Room anchor — do not delete',
      is_active: false,
    }])
    setSavingRoom(false)
    if (error) { toast.error('Failed to create store room: ' + error.message); return }
    toast.success(`Store room ${code} created!`)
    setShowRoomModal(false)
    setRoomForm({ store_name: '', store_code: '' })
    fetchLocations()
    setExpanded(e => ({ ...e, [code]: true }))
  }

  // ── Add single zone ────────────────────────────────────────────────────────
  function openAddZone(store) {
    setZoneTarget(store)
    setZoneForm({ zone_code: '', zone_label: '' })
    setShowZoneModal(true)
  }

  async function handleAddZone(e) {
    e.preventDefault()
    const code = zoneForm.zone_code.trim().toUpperCase()
    if (!code) { toast.error('Zone code is required'); return }
    setSavingZone(true)
    const { error } = await supabase.from('store_locations').insert([{
      store_name: zoneTarget.store_name,
      store_code: zoneTarget.store_code,
      zone_code: code,
      zone_label: zoneForm.zone_label.trim() || null,
      is_active: true,
    }])
    setSavingZone(false)
    if (error) {
      if (error.code === '23505') toast.error('Zone code already exists in this store room')
      else toast.error('Failed to add zone: ' + error.message)
      return
    }
    toast.success(`Zone ${zoneTarget.store_code}-${code} added!`)
    setShowZoneModal(false)
    fetchLocations()
  }

  // ── Batch generate ─────────────────────────────────────────────────────────
  function openBatch(store) {
    setBatchTarget(store)
    setBatchRacks('A,B,C,D')
    setBatchLevels('1,2,3,4')
    setShowBatch(true)
  }

  function batchPreview() {
    const racks  = batchRacks.split(',').map(r => r.trim().toUpperCase()).filter(Boolean)
    const levels = batchLevels.split(',').map(l => l.trim()).filter(Boolean)
    const codes  = []
    for (const r of racks) for (const l of levels) codes.push(`${r}-${l}`)
    return codes
  }

  async function handleBatchGenerate(e) {
    e.preventDefault()
    const codes = batchPreview()
    if (codes.length === 0) { toast.error('No zones to generate'); return }
    setBatchSaving(true)
    const rows = codes.map(zc => ({
      store_name: batchTarget.store_name,
      store_code: batchTarget.store_code,
      zone_code: zc,
      zone_label: null,
      is_active: true,
    }))
    const { error } = await supabase.from('store_locations').upsert(rows, {
      onConflict: 'store_code,zone_code',
      ignoreDuplicates: true,
    })
    setBatchSaving(false)
    if (error) { toast.error('Batch failed: ' + error.message); return }
    toast.success(`${codes.length} zones generated!`)
    setShowBatch(false)
    fetchLocations()
  }

  // ── Toggle active ──────────────────────────────────────────────────────────
  async function toggleActive(loc) {
    const { error } = await supabase
      .from('store_locations')
      .update({ is_active: !loc.is_active })
      .eq('id', loc.id)
    if (error) toast.error('Update failed: ' + error.message)
    else fetchLocations()
  }

  // ── Delete zone ────────────────────────────────────────────────────────────
  async function handleDelete(id) {
    const { error } = await supabase.from('store_locations').delete().eq('id', id)
    if (error) toast.error('Delete failed: ' + error.message)
    else { toast.success('Zone deleted'); setDeleteTarget(null); fetchLocations() }
  }

  const roomList = Object.values(grouped)

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="page-header flex items-center gap-2">
            <MapPin size={24} className="text-brand-600" />
            {t('locations.title')}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{t('locations.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={fetchLocations}
            className="p-2.5 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowRoomModal(true)}
            className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600"
          >
            <Plus size={16} />
            {t('locations.addStoreRoom')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-2" /> Loading…
        </div>
      ) : roomList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <MapPin size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium mb-1">{t('locations.noStoreRooms')}</p>
          <p className="text-gray-400 text-sm mb-5">{t('locations.noStoreRoomsHint')}</p>
          <button
            onClick={() => setShowRoomModal(true)}
            className="inline-flex items-center gap-2 bg-brand-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-600"
          >
            <Plus size={15} /> {t('locations.addFirstStoreRoom')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {roomList.map(room => {
            const visibleZones = room.zones.filter(z => z.zone_code !== '_meta')
            const isOpen = expanded[room.store_code] !== false  // default open
            const activeCount = visibleZones.filter(z => z.is_active).length

            return (
              <div key={room.store_code} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Room header */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer select-none hover:bg-gray-50 transition-colors"
                  onClick={() => toggleExpand(room.store_code)}
                >
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{room.store_name}</span>
                        <Badge color="indigo">{room.store_code}</Badge>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {visibleZones.length} zone{visibleZones.length !== 1 ? 's' : ''} · {activeCount} active
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => openBatch(room)}
                      className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
                    >
                      <Zap size={13} /> {t('locations.batchGenerate')}
                    </button>
                    <button
                      onClick={() => openAddZone(room)}
                      className="flex items-center gap-1.5 text-xs font-medium text-brand-700 bg-brand-50 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-brand-100 transition-colors"
                    >
                      <Plus size={13} /> {t('locations.addZone')}
                    </button>
                  </div>
                </div>

                {/* Zone list */}
                {isOpen && (
                  visibleZones.length === 0 ? (
                    <div className="px-5 py-6 text-center text-gray-400 text-sm border-t border-gray-100">
                      {t('locations.noZonesHint')}
                    </div>
                  ) : (
                    <div className="border-t border-gray-100 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">{t('locations.fullCode')}</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">{t('locations.zone')}</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">{t('locations.label')}</th>
                            <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">{t('common.status')}</th>
                            <th className="px-4 py-2.5" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {visibleZones.map(zone => (
                            <tr key={zone.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-5 py-3">
                                <span className="font-mono font-semibold text-brand-700 text-sm">
                                  {zone.store_code}-{zone.zone_code}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-700">{zone.zone_code}</td>
                              <td className="px-4 py-3 text-gray-500 text-xs">{zone.zone_label || '—'}</td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => toggleActive(zone)}
                                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                                    zone.is_active ? 'bg-green-500' : 'bg-gray-300'
                                  }`}
                                >
                                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                    zone.is_active ? 'translate-x-4.5' : 'translate-x-0.5'
                                  }`} />
                                </button>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => setDeleteTarget(zone)}
                                  className="p-1.5 text-red-400 hover:bg-red-50 rounded-md transition-colors"
                                  title="Delete zone"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Add Store Room Modal ──────────────────────────────────────────── */}
      {showRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{t('locations.addRoomModal.title')}</h2>
              <button onClick={() => setShowRoomModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddRoom} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">{t('locations.addRoomModal.name')}</label>
                <input
                  required className="input"
                  placeholder={t('locations.addRoomModal.namePlaceholder')}
                  value={roomForm.store_name}
                  onChange={e => setRoomForm(f => ({ ...f, store_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">{t('locations.addRoomModal.code')} <span className="text-gray-400 font-normal">{t('locations.addRoomModal.codeHint')}</span></label>
                <input
                  required className="input font-mono"
                  placeholder={t('locations.addRoomModal.codePlaceholder')}
                  value={roomForm.store_code}
                  onChange={e => setRoomForm(f => ({ ...f, store_code: e.target.value.toUpperCase().replace(/\s/g, '') }))}
                />
                <p className="text-xs text-gray-400 mt-1">{t('locations.addRoomModal.codeDescription')}</p>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={savingRoom}
                  className="flex-1 bg-brand-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-60">
                  {savingRoom ? t('locations.addRoomModal.creating') : t('locations.addRoomModal.create')}
                </button>
                <button type="button" onClick={() => setShowRoomModal(false)}
                  className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Single Zone Modal ─────────────────────────────────────────── */}
      {showZoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t('locations.addZoneModal.title')}</h2>
                <p className="text-xs text-gray-400">{zoneTarget?.store_name} ({zoneTarget?.store_code})</p>
              </div>
              <button onClick={() => setShowZoneModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddZone} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">{t('locations.addZoneModal.code')} <span className="text-gray-400 font-normal">{t('locations.addZoneModal.codeHint')}</span></label>
                <input
                  required className="input font-mono"
                  placeholder={t('locations.addZoneModal.codePlaceholder')}
                  value={zoneForm.zone_code}
                  onChange={e => setZoneForm(f => ({ ...f, zone_code: e.target.value.toUpperCase() }))}
                />
                {zoneForm.zone_code && (
                  <p className="text-xs text-brand-600 mt-1 font-mono">
                    Full code: {zoneTarget?.store_code}-{zoneForm.zone_code}
                  </p>
                )}
              </div>
              <div>
                <label className="label">{t('locations.addZoneModal.label')} <span className="text-gray-400 font-normal">{t('locations.addZoneModal.labelHint')}</span></label>
                <input
                  className="input"
                  placeholder={t('locations.addZoneModal.labelPlaceholder')}
                  value={zoneForm.zone_label}
                  onChange={e => setZoneForm(f => ({ ...f, zone_label: e.target.value }))}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={savingZone}
                  className="flex-1 bg-brand-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-60">
                  {savingZone ? t('locations.addZoneModal.adding') : t('locations.addZoneModal.add')}
                </button>
                <button type="button" onClick={() => setShowZoneModal(false)}
                  className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Batch Generate Modal ──────────────────────────────────────────── */}
      {showBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Zap size={18} className="text-amber-500" /> {t('locations.batchModal.title')}
                </h2>
                <p className="text-xs text-gray-400">{batchTarget?.store_name} ({batchTarget?.store_code})</p>
              </div>
              <button onClick={() => setShowBatch(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleBatchGenerate} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">{t('locations.batchModal.racks')} <span className="text-gray-400 font-normal">{t('locations.batchModal.racksHint')}</span></label>
                <input
                  className="input font-mono"
                  placeholder="A,B,C,D"
                  value={batchRacks}
                  onChange={e => setBatchRacks(e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <label className="label">{t('locations.batchModal.levels')} <span className="text-gray-400 font-normal">{t('locations.batchModal.levelsHint')}</span></label>
                <input
                  className="input font-mono"
                  placeholder="1,2,3,4"
                  value={batchLevels}
                  onChange={e => setBatchLevels(e.target.value)}
                />
              </div>
              {/* Preview */}
              {batchPreview().length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2">
                    Will generate {batchPreview().length} zones:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {batchPreview().map(code => (
                      <span key={code} className="font-mono text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-md">
                        {batchTarget?.store_code}-{code}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={batchSaving || batchPreview().length === 0}
                  className="flex-1 bg-amber-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-60">
                  {batchSaving ? t('locations.batchModal.generating') : `Generate ${batchPreview().length} Zones`}
                </button>
                <button type="button" onClick={() => setShowBatch(false)}
                  className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ───────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-2">{t('locations.deleteModal.title')}</h3>
            <p className="text-sm text-gray-500 mb-5">
              {t('locations.deleteModal.body', { code: `${deleteTarget.store_code}-${deleteTarget.zone_code}` })}
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteTarget.id)}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700">
                {t('locations.deleteModal.delete')}
              </button>
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 border border-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
