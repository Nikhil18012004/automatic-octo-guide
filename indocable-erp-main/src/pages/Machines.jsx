import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { confirmToast } from '../components/confirmToast'
import { playSuccess, playError, playClick } from '../lib/sound'
import {
  Settings, RefreshCw, Edit2, Save, X, Plus, Trash2,
  Zap, Users, AlertCircle, Info
} from 'lucide-react'

function fmt(n, dec = 2) {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

const EMPTY_MACHINE = {
  process_name: '', department: '',
  power_kw: 0, num_operators: 0, num_helpers: 0,
  consumable_cost_per_hr: 0, production_rate: 1, production_unit: 'm',
  notes: '',
}

export default function Machines({ profile }) {
  const [machines, setMachines] = useState([])
  const [gvars, setGvars]       = useState({})
  const [loading, setLoading]   = useState(true)
  const [editId, setEditId]     = useState(null)
  const [editData, setEditData] = useState({})
  const [showAdd, setShowAdd]   = useState(false)
  const [newRow, setNewRow]     = useState({ ...EMPTY_MACHINE })
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: mData }, { data: gData }] = await Promise.all([
      supabase.from('machines').select('*').order('department').order('process_name'),
      supabase.from('global_variables').select('key, value'),
    ])
    setMachines(mData || [])
    const map = {}
    ;(gData || []).forEach(r => { map[r.key] = r.value })
    setGvars(map)
    setLoading(false)
  }

  function gv(key, fallback = 0) { return gvars[key] ?? fallback }

  // Computed cost per hour for a machine row
  function computeCosts(m) {
    const elec_tariff   = gv('electricity_tariff_per_unit', 7)
    const op_rate       = gv('working_days_per_month', 26) * gv('working_hours_per_day', 8)
    const op_hr_rate    = op_rate > 0 ? gv('operator_monthly_salary', 0) / op_rate : 0
    const helper_hr_rate= op_rate > 0 ? gv('helper_monthly_salary', 0) / op_rate : 0

    const elec_cost     = (m.power_kw || 0) * elec_tariff
    const ops_cost      = (m.num_operators || 0) * op_hr_rate
    const help_cost     = (m.num_helpers || 0) * helper_hr_rate
    const consumable    = m.consumable_cost_per_hr || 0
    const total_per_hr  = elec_cost + ops_cost + help_cost + consumable
    const rate          = m.production_rate || 1
    const std_per_unit  = rate > 0 ? total_per_hr / rate : 0
    return { elec_cost, ops_cost, help_cost, consumable, total_per_hr, std_per_unit }
  }

  function startEdit(m) {
    playClick()
    setEditId(m.id)
    setEditData({ ...m })
  }

  function cancelEdit() { setEditId(null); setEditData({}) }

  async function saveEdit() {
    setSaving(true)
    const { id, created_at, ...fields } = editData
    const { error } = await supabase.from('machines').update(fields).eq('id', id)
    setSaving(false)
    if (error) { playError(); toast.error('Save failed: ' + error.message); return }
    playSuccess()
    toast.success('Machine updated')
    setMachines(prev => prev.map(m => m.id === id ? { ...m, ...fields } : m))
    cancelEdit()
  }

  async function handleAdd() {
    setSaving(true)
    const { error, data } = await supabase.from('machines').insert(newRow).select().single()
    setSaving(false)
    if (error) { playError(); toast.error('Add failed: ' + error.message); return }
    playSuccess()
    toast.success('Machine added')
    setMachines(prev => [...prev, data])
    setNewRow({ ...EMPTY_MACHINE })
    setShowAdd(false)
  }

  async function handleDelete(id) {
    if (!await confirmToast('Delete this machine?')) return
    setDeleting(id)
    const { error } = await supabase.from('machines').delete().eq('id', id)
    setDeleting(null)
    if (error) { playError(); toast.error('Delete failed'); return }
    playSuccess()
    toast.success('Deleted')
    setMachines(prev => prev.filter(m => m.id !== id))
  }

  const departments = [...new Set(machines.map(m => m.department).filter(Boolean))].sort()

  const elec_tariff = gv('electricity_tariff_per_unit', 7)
  const hasGVars    = Object.keys(gvars).length > 0

  function EditableCell({ field, type = 'text', step = 'any', min, className = '' }) {
    return (
      <input
        type={type}
        step={step}
        min={min}
        value={editData[field] ?? ''}
        onChange={e => setEditData(d => ({ ...d, [field]: type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value }))}
        className={`input py-1 text-sm w-full ${className}`}
      />
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-sm">
            <Settings size={20} className="text-white" />
          </div>
          <div>
            <h1 className="page-header">Machines &amp; Processes</h1>
            <p className="page-sub">Operating cost per hour for each manufacturing process</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => { playClick(); setShowAdd(s => !s) }} className="btn-primary">
            <Plus size={15} /> Add Machine
          </button>
          <button onClick={fetchAll} className="btn-ghost px-2.5" title="Refresh">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* GVars warning */}
      {!loading && !hasGVars && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700">
            Global variables not loaded — electricity tariff and labour rates may show as 0.
            <a href="/quotations/global" className="underline ml-1 font-semibold">Set up Global Variables →</a>
          </p>
        </div>
      )}

      {/* Rate reference */}
      {hasGVars && (
        <div className="flex flex-wrap gap-3">
          {[
            { icon: Zap,   label: 'Electricity tariff', val: `₹${fmt(elec_tariff, 2)}/kWh`, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-100' },
            { icon: Users, label: 'Operator rate',      val: `₹${fmt(gv('operator_monthly_salary') / (gv('working_days_per_month', 26) * gv('working_hours_per_day', 8)), 2)}/hr`, color: 'text-brand-600', bg: 'bg-brand-50', border: 'border-brand-100' },
            { icon: Users, label: 'Helper rate',        val: `₹${fmt(gv('helper_monthly_salary') / (gv('working_days_per_month', 26) * gv('working_hours_per_day', 8)), 2)}/hr`, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          ].map(({ icon: Icon, label, val, color, bg, border }) => (
            <div key={label} className={`flex items-center gap-2 ${bg} border ${border} rounded-xl px-3 py-2`}>
              <Icon size={13} className={color} />
              <span className="text-xs text-gray-600">{label}:</span>
              <span className={`text-xs font-bold ${color}`}>{val}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
            <Info size={12} className="text-gray-400" />
            <span className="text-xs text-gray-400">From Global Variables</span>
          </div>
        </div>
      )}

      {/* Add row */}
      {showAdd && (
        <div className="card border-2 border-dashed border-brand-200 p-5 bg-brand-50/30">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Add New Machine / Process</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
            {[
              { field: 'process_name', label: 'Process Name', type: 'text' },
              { field: 'department', label: 'Department', type: 'text' },
              { field: 'power_kw', label: 'Power (kW)', type: 'number', min: 0 },
              { field: 'num_operators', label: 'Operators', type: 'number', min: 0, step: 1 },
              { field: 'num_helpers', label: 'Helpers', type: 'number', min: 0, step: 1 },
              { field: 'consumable_cost_per_hr', label: 'Consumables (₹/hr)', type: 'number', min: 0 },
              { field: 'production_rate', label: 'Production Rate', type: 'number', min: 0.01 },
              { field: 'production_unit', label: 'Unit', type: 'text' },
            ].map(({ field, label, type, min, step }) => (
              <div key={field}>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>
                <input type={type} step={step || 'any'} min={min}
                  value={newRow[field]}
                  onChange={e => setNewRow(r => ({ ...r, [field]: type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value }))}
                  className="input py-1.5 text-sm w-full" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving || !newRow.process_name} className="btn-primary">
              <Save size={14} /> {saving ? 'Saving…' : 'Save Machine'}
            </button>
            <button onClick={() => setShowAdd(false)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="card p-12 flex items-center justify-center gap-3 text-gray-400">
          <RefreshCw size={18} className="animate-spin" />
          <span className="text-sm">Loading machines…</span>
        </div>
      ) : machines.length === 0 ? (
        <div className="card p-12 flex flex-col items-center justify-center text-center">
          <Settings size={40} className="text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium text-sm">No machines found</p>
          <p className="text-gray-400 text-xs mt-1">Add a machine using the button above</p>
        </div>
      ) : (
        departments.map(dept => {
          const rows = machines.filter(m => m.department === dept)
          return (
            <div key={dept} className="card overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{dept}</span>
                <span className="badge-gray ml-auto">{rows.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100 bg-gray-50/30">
                    <tr>
                      <th className="th">Process</th>
                      <th className="th-r">Power (kW)</th>
                      <th className="th-r">Ops</th>
                      <th className="th-r">Helpers</th>
                      <th className="th-r">Consumables</th>
                      <th className="th-r">Rate</th>
                      <th className="th-r text-yellow-600">Elec ₹/hr</th>
                      <th className="th-r text-brand-600">Labour ₹/hr</th>
                      <th className="th-r font-bold text-gray-700">Total ₹/hr</th>
                      <th className="th-r font-bold text-brand-700">Std ₹/unit</th>
                      {profile.role !== 'viewer' && <th className="th" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map(m => {
                      const isEditing = editId === m.id
                      const costs = computeCosts(isEditing ? editData : m)
                      return (
                        <tr key={m.id} className={`transition-colors ${isEditing ? 'bg-brand-50/40' : 'hover:bg-gray-50/50'}`}>
                          {isEditing ? (
                            <>
                              <td className="px-4 py-2"><EditableCell field="process_name" /></td>
                              <td className="px-4 py-2"><EditableCell field="power_kw" type="number" min="0" className="text-right" /></td>
                              <td className="px-4 py-2"><EditableCell field="num_operators" type="number" min="0" step="1" className="text-right" /></td>
                              <td className="px-4 py-2"><EditableCell field="num_helpers" type="number" min="0" step="1" className="text-right" /></td>
                              <td className="px-4 py-2"><EditableCell field="consumable_cost_per_hr" type="number" min="0" className="text-right" /></td>
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-1">
                                  <EditableCell field="production_rate" type="number" min="0.01" className="text-right w-16" />
                                  <EditableCell field="production_unit" className="w-10 text-xs" />
                                </div>
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums text-yellow-600 font-medium">{fmt(costs.elec_cost)}</td>
                              <td className="px-4 py-2 text-right tabular-nums text-brand-600 font-medium">{fmt(costs.ops_cost + costs.help_cost)}</td>
                              <td className="px-4 py-2 text-right tabular-nums font-bold text-gray-900">{fmt(costs.total_per_hr)}</td>
                              <td className="px-4 py-2 text-right tabular-nums font-bold text-brand-700">{fmt(costs.std_per_unit)}</td>
                              <td className="px-4 py-2">
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
                              <td className="px-4 py-3 font-semibold text-gray-900">{m.process_name}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-600">{m.power_kw}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-600">{m.num_operators}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-600">{m.num_helpers}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-600">{fmt(m.consumable_cost_per_hr)}</td>
                              <td className="px-4 py-3 text-right text-gray-500 text-xs tabular-nums">{m.production_rate} {m.production_unit}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-yellow-600 font-medium">{fmt(costs.elec_cost)}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-brand-600 font-medium">{fmt(costs.ops_cost + costs.help_cost)}</td>
                              <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-900 bg-gray-50/50">{fmt(costs.total_per_hr)}</td>
                              <td className="px-4 py-3 text-right tabular-nums font-bold text-brand-700 bg-brand-50/30">{fmt(costs.std_per_unit)}</td>
                              {profile.role !== 'viewer' && (
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100">
                                    <button onClick={() => startEdit(m)}
                                      className="p-1.5 hover:bg-brand-50 text-gray-400 hover:text-brand-600 rounded-lg transition-colors cursor-pointer">
                                      <Edit2 size={13} />
                                    </button>
                                    <button onClick={() => handleDelete(m.id)} disabled={deleting === m.id}
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
                  <tfoot className="border-t border-gray-200 bg-gray-50">
                    <tr>
                      <td colSpan={8} className="px-5 py-2.5 text-xs font-semibold text-gray-500">Department Total</td>
                      <td className="px-4 py-2.5 text-right font-bold text-gray-900 tabular-nums">
                        ₹{fmt(rows.reduce((s, m) => s + computeCosts(m).total_per_hr, 0))}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
