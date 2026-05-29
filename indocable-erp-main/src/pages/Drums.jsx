import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { confirmToast } from '../components/confirmToast'
import { playSuccess, playError, playClick } from '../lib/sound'
import {
  Package, RefreshCw, Edit2, Save, X, Plus, Trash2,
  Calculator, Table2, AlertCircle, ArrowRight
} from 'lucide-react'

function fmt(n, dec = 2) {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

// Drum capacity: π/4 × (F² - B²) × W × efficiency / (cable_OD_mm + clearance_mm)²
// All flange/barrel/width inputs in inches, cable OD in mm
// Returns meters
function calcCapacity({ flange_d_in, barrel_d_in, width_in, cable_od_mm, efficiency = 0.7, clearance_mm = 1 }) {
  if (!flange_d_in || !barrel_d_in || !width_in || !cable_od_mm) return null
  const F  = flange_d_in * 25.4   // mm
  const B  = barrel_d_in * 25.4   // mm
  const W  = width_in * 25.4      // mm
  const d  = cable_od_mm + clearance_mm
  if (d <= 0 || F <= B) return null
  const area_mm2   = (Math.PI / 4) * (F * F - B * B) * W
  const turns_area = d * d          // approx area per turn (square packing)
  const meters     = (area_mm2 * efficiency) / (turns_area * 1000)  // ÷1000 for mm→m
  return Math.floor(meters)
}

const EMPTY_DRUM = {
  drum_code: '', drum_type: 'Wooden', max_od_mm: 0,
  flange_d_in: 0, barrel_d_in: 0, width_in: 0,
  price_wood: 0, price_metal: 0, price_plywood: 0,
  notes: '',
}

export default function Drums({ profile }) {
  const [drums, setDrums]     = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('price_table')
  const [editId, setEditId]   = useState(null)
  const [editData, setEditData] = useState({})
  const [saving, setSaving]   = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newRow, setNewRow]   = useState({ ...EMPTY_DRUM })
  const [deleting, setDeleting] = useState(null)

  // Capacity calculator state
  const [calcInputs, setCalcInputs] = useState({
    cable_od_mm: '', efficiency: 70, clearance_mm: 1,
    selected_drum: '',
  })

  useEffect(() => { fetchDrums() }, [])

  async function fetchDrums() {
    setLoading(true)
    const { data, error } = await supabase.from('drums').select('*').order('max_od_mm').order('drum_code')
    if (error) toast.error('Failed to load drums')
    setDrums(data || [])
    setLoading(false)
  }

  function startEdit(d) { playClick(); setEditId(d.id); setEditData({ ...d }) }
  function cancelEdit() { setEditId(null); setEditData({}) }

  async function saveEdit() {
    setSaving(true)
    const { id, created_at, ...fields } = editData
    const { error } = await supabase.from('drums').update(fields).eq('id', id)
    setSaving(false)
    if (error) { playError(); toast.error('Save failed: ' + error.message); return }
    playSuccess()
    toast.success('Drum updated')
    setDrums(prev => prev.map(d => d.id === id ? { ...d, ...fields } : d))
    cancelEdit()
  }

  async function handleAdd() {
    setSaving(true)
    const { error, data } = await supabase.from('drums').insert(newRow).select().single()
    setSaving(false)
    if (error) { playError(); toast.error('Add failed: ' + error.message); return }
    playSuccess()
    toast.success('Drum added')
    setDrums(prev => [...prev, data].sort((a, b) => a.max_od_mm - b.max_od_mm))
    setNewRow({ ...EMPTY_DRUM })
    setShowAdd(false)
  }

  async function handleDelete(id) {
    if (!await confirmToast('Delete this drum size?')) return
    setDeleting(id)
    const { error } = await supabase.from('drums').delete().eq('id', id)
    setDeleting(null)
    if (error) { playError(); toast.error('Delete failed'); return }
    playSuccess()
    setDrums(prev => prev.filter(d => d.id !== id))
    toast.success('Deleted')
  }

  // Capacity results
  const calcResults = useMemo(() => {
    const od     = parseFloat(calcInputs.cable_od_mm)
    const eff    = parseFloat(calcInputs.efficiency) / 100
    const clear  = parseFloat(calcInputs.clearance_mm)
    if (!od || od <= 0) return []
    return drums
      .filter(d => d.flange_d_in && d.barrel_d_in && d.width_in)
      .map(d => ({
        ...d,
        capacity: calcCapacity({
          flange_d_in: d.flange_d_in, barrel_d_in: d.barrel_d_in,
          width_in: d.width_in, cable_od_mm: od,
          efficiency: eff, clearance_mm: clear,
        }),
      }))
      .filter(r => r.capacity !== null && r.capacity > 0)
      .sort((a, b) => b.capacity - a.capacity)
  }, [drums, calcInputs])

  const selectedDrum = drums.find(d => d.id === calcInputs.selected_drum)

  function EditableCell({ field, type = 'text', step = 'any', min, className = '' }) {
    return (
      <input type={type} step={step} min={min}
        value={editData[field] ?? ''}
        onChange={e => setEditData(d => ({
          ...d,
          [field]: type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value
        }))}
        className={`input py-1 text-sm ${className}`}
      />
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-sm">
            <Package size={20} className="text-white" />
          </div>
          <div>
            <h1 className="page-header">Drums &amp; Packing</h1>
            <p className="page-sub">Drum sizes, prices and capacity calculator</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {activeTab === 'price_table' && (
            <button onClick={() => { playClick(); setShowAdd(s => !s) }} className="btn-primary">
              <Plus size={15} /> Add Drum
            </button>
          )}
          <button onClick={fetchDrums} className="btn-ghost px-2.5" title="Refresh">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 bg-gray-100 rounded-2xl p-1.5">
        {[
          { key: 'price_table',  label: 'Price Table',        icon: Table2 },
          { key: 'calculator',   label: 'Capacity Calculator', icon: Calculator },
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button key={tab.key}
              onClick={() => { playClick(); setActiveTab(tab.key) }}
              className={`flex items-center gap-2 flex-1 justify-center px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer
                ${isActive ? 'bg-white shadow-sm text-brand-600' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}>
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="card p-12 flex items-center justify-center gap-3 text-gray-400">
          <RefreshCw size={18} className="animate-spin" />
          <span className="text-sm">Loading drums…</span>
        </div>
      ) : activeTab === 'price_table' ? (
        <>
          {/* Add row */}
          {showAdd && (
            <div className="card border-2 border-dashed border-brand-200 p-5 bg-brand-50/30">
              <h3 className="text-sm font-bold text-gray-800 mb-4">Add New Drum Size</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                {[
                  { field: 'drum_code',      label: 'Drum Code',       type: 'text' },
                  { field: 'drum_type',      label: 'Type',            type: 'text' },
                  { field: 'max_od_mm',      label: 'Max OD (mm)',     type: 'number', min: 0 },
                  { field: 'flange_d_in',    label: 'Flange D (in)',   type: 'number', min: 0 },
                  { field: 'barrel_d_in',    label: 'Barrel D (in)',   type: 'number', min: 0 },
                  { field: 'width_in',       label: 'Width (in)',      type: 'number', min: 0 },
                  { field: 'price_wood',     label: 'Wood (₹)',        type: 'number', min: 0 },
                  { field: 'price_metal',    label: 'Metal (₹)',       type: 'number', min: 0 },
                  { field: 'price_plywood',  label: 'Plywood (₹)',     type: 'number', min: 0 },
                ].map(({ field, label, type, min }) => (
                  <div key={field}>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>
                    <input type={type} step="any" min={min}
                      value={newRow[field]}
                      onChange={e => setNewRow(r => ({
                        ...r,
                        [field]: type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value
                      }))}
                      className="input py-1.5 text-sm w-full" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={handleAdd} disabled={saving || !newRow.drum_code} className="btn-primary">
                  <Save size={14} /> {saving ? 'Saving…' : 'Save Drum'}
                </button>
                <button onClick={() => setShowAdd(false)} className="btn-ghost">Cancel</button>
              </div>
            </div>
          )}

          {/* Price table */}
          <div className="card overflow-hidden">
            <div className="flex items-center px-5 py-3.5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm">Drum Size &amp; Price Reference</h2>
              <span className="ml-auto badge-gray">{drums.length} sizes</span>
            </div>
            {drums.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package size={40} className="text-gray-200 mb-3" />
                <p className="text-gray-500 font-medium text-sm">No drums found</p>
                <p className="text-gray-400 text-xs mt-1">Run the SQL seed script or add drums manually</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100 bg-gray-50">
                    <tr>
                      <th className="th">Code</th>
                      <th className="th">Type</th>
                      <th className="th-r">Max OD (mm)</th>
                      <th className="th-r">Flange Ø (in)</th>
                      <th className="th-r">Barrel Ø (in)</th>
                      <th className="th-r">Width (in)</th>
                      <th className="th-r text-amber-600">Wood (₹)</th>
                      <th className="th-r text-slate-600">Metal (₹)</th>
                      <th className="th-r text-emerald-600">Plywood (₹)</th>
                      {profile.role !== 'viewer' && <th className="th" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {drums.map(d => {
                      const isEditing = editId === d.id
                      return (
                        <tr key={d.id} className={`transition-colors group ${isEditing ? 'bg-brand-50/40' : 'hover:bg-gray-50/50'}`}>
                          {isEditing ? (
                            <>
                              <td className="px-3 py-2"><EditableCell field="drum_code" className="w-20" /></td>
                              <td className="px-3 py-2"><EditableCell field="drum_type" className="w-20" /></td>
                              <td className="px-3 py-2"><EditableCell field="max_od_mm" type="number" min="0" className="w-16 text-right" /></td>
                              <td className="px-3 py-2"><EditableCell field="flange_d_in" type="number" min="0" className="w-16 text-right" /></td>
                              <td className="px-3 py-2"><EditableCell field="barrel_d_in" type="number" min="0" className="w-16 text-right" /></td>
                              <td className="px-3 py-2"><EditableCell field="width_in" type="number" min="0" className="w-16 text-right" /></td>
                              <td className="px-3 py-2"><EditableCell field="price_wood" type="number" min="0" className="w-20 text-right" /></td>
                              <td className="px-3 py-2"><EditableCell field="price_metal" type="number" min="0" className="w-20 text-right" /></td>
                              <td className="px-3 py-2"><EditableCell field="price_plywood" type="number" min="0" className="w-20 text-right" /></td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1.5">
                                  <button onClick={saveEdit} disabled={saving}
                                    className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-60 cursor-pointer">
                                    <Save size={12} />
                                  </button>
                                  <button onClick={cancelEdit}
                                    className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors cursor-pointer">
                                    <X size={12} />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3 font-semibold text-gray-900">{d.drum_code}</td>
                              <td className="px-4 py-3"><span className="badge-gray">{d.drum_type}</span></td>
                              <td className="px-4 py-3 text-right font-bold text-brand-600 tabular-nums">{d.max_od_mm}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-600">{d.flange_d_in || '—'}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-600">{d.barrel_d_in || '—'}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-600">{d.width_in || '—'}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-amber-600 font-medium">₹{fmt(d.price_wood, 0)}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-slate-600 font-medium">₹{fmt(d.price_metal, 0)}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-emerald-600 font-medium">₹{fmt(d.price_plywood, 0)}</td>
                              {profile.role !== 'viewer' && (
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => startEdit(d)}
                                      className="p-1.5 hover:bg-brand-50 text-gray-400 hover:text-brand-600 rounded-lg transition-colors cursor-pointer">
                                      <Edit2 size={13} />
                                    </button>
                                    <button onClick={() => handleDelete(d.id)} disabled={deleting === d.id}
                                      className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer disabled:opacity-60">
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Capacity Calculator */
        <div className="space-y-4">
          {/* Inputs */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                <Calculator size={15} className="text-white" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 text-sm">Cable Capacity Calculator</h2>
                <p className="text-xs text-gray-400">Enter cable OD to see how many metres fit on each drum</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Cable OD (mm) *</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  placeholder="e.g. 12.5"
                  value={calcInputs.cable_od_mm}
                  onChange={e => setCalcInputs(c => ({ ...c, cable_od_mm: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Packing Efficiency (%)</label>
                <input
                  type="number"
                  step="1"
                  min="40"
                  max="90"
                  value={calcInputs.efficiency}
                  onChange={e => setCalcInputs(c => ({ ...c, efficiency: e.target.value }))}
                  className="input"
                />
                <p className="text-xs text-gray-400 mt-1">Typical: 65–75%</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Clearance per layer (mm)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={calcInputs.clearance_mm}
                  onChange={e => setCalcInputs(c => ({ ...c, clearance_mm: e.target.value }))}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Results */}
          {!calcInputs.cable_od_mm ? (
            <div className="card p-10 flex flex-col items-center justify-center text-center">
              <Calculator size={40} className="text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium text-sm">Enter cable OD above</p>
              <p className="text-gray-400 text-xs mt-1">Results will appear here for all drum sizes</p>
            </div>
          ) : calcResults.length === 0 ? (
            <div className="card p-10 flex flex-col items-center justify-center text-center">
              <AlertCircle size={40} className="text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium text-sm">No drums have dimensions set</p>
              <p className="text-gray-400 text-xs mt-1">Add flange diameter, barrel diameter and width in the Price Table</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="flex items-center px-5 py-3.5 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 text-sm">
                  Capacity for {calcInputs.cable_od_mm} mm OD cable
                </h2>
                <span className="ml-auto text-xs text-gray-400">{calcResults.length} eligible drums</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100 bg-gray-50">
                    <tr>
                      <th className="th">Drum Code</th>
                      <th className="th">Type</th>
                      <th className="th-r">Flange Ø</th>
                      <th className="th-r">Barrel Ø</th>
                      <th className="th-r">Width</th>
                      <th className="th-r">Max Cable OD</th>
                      <th className="th-r font-bold text-brand-700">Capacity (m)</th>
                      <th className="th-r text-amber-600">Wood (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {calcResults.map((d, i) => (
                      <tr key={d.id} className={`transition-colors hover:bg-brand-50/20 ${i === 0 ? 'bg-emerald-50/40' : ''}`}>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {i === 0 && <span className="badge-green mr-2 text-xs">Best fit</span>}
                          {d.drum_code}
                        </td>
                        <td className="px-4 py-3"><span className="badge-gray">{d.drum_type}</span></td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-600">{d.flange_d_in}"</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-600">{d.barrel_d_in}"</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-600">{d.width_in}"</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-500">{d.max_od_mm} mm</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-base font-bold tabular-nums ${i === 0 ? 'text-emerald-600' : 'text-brand-600'}`}>
                            {d.capacity.toLocaleString('en-IN')}
                          </span>
                          <span className="text-xs text-gray-400 ml-1">m</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-amber-600 font-medium">₹{fmt(d.price_wood, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  Formula: π/4 × (F² − B²) × W × {calcInputs.efficiency}% ÷ ({calcInputs.cable_od_mm} + {calcInputs.clearance_mm} mm)² &nbsp;|&nbsp; Dimensions in mm
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
