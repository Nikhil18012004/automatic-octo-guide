import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { confirmToast } from '../components/confirmToast'
import { Clock, Plus, Edit2, Trash2, X, Save, Moon, Sun, RefreshCw } from 'lucide-react'

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return `${h12}:${m.toString().padStart(2, '0')}${ampm}`
}

function calcHours(start, end) {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) mins += 24 * 60
  return (mins / 60).toFixed(1)
}

const CARD_COLORS = [
  'from-amber-400 to-orange-500',
  'from-orange-400 to-rose-500',
  'from-indigo-500 to-purple-600',
  'from-emerald-400 to-teal-500',
  'from-blue-400 to-cyan-500',
  'from-rose-400 to-pink-500',
]

const EMPTY = { name: '', start_time: '06:00', end_time: '14:00', break_minutes: 30, is_overnight: false, is_active: true }

export default function ShiftTemplates({ profile }) {
  const [shifts, setShifts]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState({ ...EMPTY })
  const [saving, setSaving]     = useState(false)

  useEffect(() => { fetchShifts() }, [])

  async function fetchShifts() {
    setLoading(true)
    const { data } = await supabase.from('shifts').select('*').order('start_time')
    setShifts(data || [])
    setLoading(false)
  }

  function openAdd() { setForm({ ...EMPTY }); setEditing(null); setShowForm(true) }

  function openEdit(s) {
    setForm({ name: s.name, start_time: s.start_time, end_time: s.end_time, break_minutes: s.break_minutes, is_overnight: s.is_overnight, is_active: s.is_active })
    setEditing(s.id)
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditing(null) }

  function f(field) {
    return (e) => setForm(p => ({ ...p, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  }

  async function save() {
    if (!form.name.trim()) { toast.error('Shift name is required'); return }
    if (!form.start_time || !form.end_time) { toast.error('Start and end time are required'); return }
    setSaving(true)
    const payload = { ...form, break_minutes: Number(form.break_minutes) || 0 }
    const { error } = editing
      ? await supabase.from('shifts').update(payload).eq('id', editing)
      : await supabase.from('shifts').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(editing ? 'Shift updated!' : 'Shift created!')
    closeForm()
    fetchShifts()
  }

  async function toggleActive(s) {
    const { error } = await supabase.from('shifts').update({ is_active: !s.is_active }).eq('id', s.id)
    if (error) { toast.error(error.message); return }
    fetchShifts()
  }

  async function deleteShift(s) {
    if (!await confirmToast(`Delete "${s.name}" shift? Employees assigned to it will lose their shift.`)) return
    const { error } = await supabase.from('shifts').delete().eq('id', s.id)
    if (error) { toast.error(error.message); return }
    toast.success('Shift deleted')
    fetchShifts()
  }

  const hours = calcHours(form.start_time, form.end_time)
  const netHours = Math.max(0, (hours * 60 - Number(form.break_minutes || 0)) / 60).toFixed(1)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
            <Clock size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="page-header">Shift Templates</h1>
            <p className="page-sub">Define shift timings used across scheduling and attendance</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchShifts} className="btn-ghost px-2.5">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openAdd} className="btn-primary"><Plus size={15} /> New Shift</button>
        </div>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="card p-6 border-brand-100">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-900">{editing ? 'Edit Shift' : 'New Shift'}</h2>
            <button onClick={closeForm} className="btn-ghost p-1.5"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">Shift Name *</label>
              <input className="input" placeholder="e.g. Morning, A-Shift, General" value={form.name} onChange={f('name')} />
            </div>
            <div>
              <label className="label">Start Time *</label>
              <input type="time" className="input" value={form.start_time} onChange={f('start_time')} />
            </div>
            <div>
              <label className="label">End Time *</label>
              <input type="time" className="input" value={form.end_time} onChange={f('end_time')} />
            </div>
            <div>
              <label className="label">Break Duration (minutes)</label>
              <input type="number" className="input" placeholder="30" min="0" max="120" value={form.break_minutes} onChange={f('break_minutes')} />
            </div>
            <div className="flex flex-col gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.is_overnight} onChange={f('is_overnight')} className="accent-brand-500 w-4 h-4" />
                <span className="text-sm font-medium text-gray-700">Overnight (crosses midnight)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.is_active} onChange={f('is_active')} className="accent-brand-500 w-4 h-4" />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
            {form.start_time && form.end_time && (
              <div className="flex items-center">
                <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 w-full">
                  <div className="text-xs text-brand-500 font-semibold mb-1">Calculated Hours</div>
                  <div className="font-bold text-brand-700 text-lg">{netHours}h net</div>
                  <div className="text-xs text-brand-400">{hours}h total − {form.break_minutes || 0}min break</div>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100">
            <button onClick={save} disabled={saving} className="btn-primary">
              <Save size={14} />{saving ? 'Saving…' : 'Save Shift'}
            </button>
            <button onClick={closeForm} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Shifts grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}
        </div>
      ) : shifts.length === 0 ? (
        <div className="card p-16 text-center">
          <Clock size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 font-medium">No shifts defined yet</p>
          <p className="text-gray-400 text-xs mt-1">Create your first shift template above</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shifts.map((s, i) => {
            const totalH = calcHours(s.start_time, s.end_time)
            const netH   = Math.max(0, (totalH * 60 - s.break_minutes) / 60).toFixed(1)
            return (
              <div key={s.id} className={`card p-5 ${!s.is_active ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${CARD_COLORS[i % CARD_COLORS.length]} flex items-center justify-center shadow-sm`}>
                    {s.is_overnight ? <Moon size={17} className="text-white" /> : <Sun size={17} className="text-white" />}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {s.is_overnight && (
                      <span className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-lg font-semibold">
                        <Moon size={9} /> Overnight
                      </span>
                    )}
                    {!s.is_active && <span className="badge-gray text-xs">Inactive</span>}
                  </div>
                </div>

                <div className="font-bold text-gray-900 text-base mb-0.5">{s.name}</div>
                <div className="text-sm text-gray-500 font-medium mb-3">
                  {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
                  <span className="font-semibold text-gray-700">{netH}h net</span>
                  <span>·</span>
                  <span>{totalH}h total</span>
                  <span>·</span>
                  <span>{s.break_minutes}min break</span>
                </div>

                <div className="flex items-center gap-1.5 pt-3 border-t border-gray-100">
                  <button onClick={() => openEdit(s)} className="btn-ghost py-1.5 px-3 text-xs">
                    <Edit2 size={11} /> Edit
                  </button>
                  <button
                    onClick={() => toggleActive(s)}
                    className={`btn-ghost py-1.5 px-3 text-xs ${s.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                  >
                    {s.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => deleteShift(s)} className="btn-ghost py-1.5 px-3 text-xs text-red-400 hover:bg-red-50 ml-auto">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
