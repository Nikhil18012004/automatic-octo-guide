import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { playSuccess, playError, playClick } from '../lib/sound'
import {
  Users, UserPlus, Phone, Calendar, Briefcase,
  Edit2, Search, RefreshCw, Award, X, Save,
  AlertCircle, Clock
} from 'lucide-react'

const POSITIONS = ['Operator','Helper','QC','Engineer','Supervisor','Admin']
const DEPARTMENTS_LIST = ['Wire Drawing','Stranding','Extrusion','Assembly','Armouring','Finishing','QC','Dispatch','Maintenance','Store','Administration']
const CONTRACT_TYPES = [
  { value: 'permanent',    label: 'Permanent' },
  { value: 'contractual',  label: 'Contractual' },
  { value: 'daily_wage',   label: 'Daily Wage' },
]
const WEEKLY_OFF_DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Rotating']

const SKILL_LEVELS = [
  { value: 0, label: 'None',        cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  { value: 1, label: 'Training',    cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 2, label: 'Certified',   cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 3, label: 'Expert',      cls: 'bg-brand-100 text-brand-700 border-brand-100' },
]

const AVATAR_GRADIENTS = [
  'from-brand-500 to-brand-700', 'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-700', 'from-amber-500 to-orange-600',
  'from-cyan-500 to-blue-600', 'from-rose-500 to-pink-600',
]
function avatarGradient(str = '') {
  let h = 0; for (const c of str) h = ((h << 5) - h) + c.charCodeAt(0)
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length]
}
function initials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

const EMPTY_FORM = {
  employee_code: '', full_name: '', phone: '', department: '',
  position: '', shift_id: '', default_shift: 'morning', monthly_salary: '',
  date_of_joining: '', emergency_contact_name: '',
  emergency_contact_phone: '', notes: '', is_active: true,
  contract_type: 'permanent', basic_hours_per_day: 8,
  overtime_rate: '', weekly_off: 'sunday', probation_end_date: '',
}

export default function Employees({ profile }) {
  const [employees, setEmployees] = useState([])
  const [machines, setMachines]   = useState([])
  const [shifts, setShifts]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterPos, setFilterPos]   = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const [modal, setModal]         = useState(null) // null | 'add' | 'edit'
  const [tab, setTab]             = useState('profile')
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [skills, setSkills]       = useState({}) // { machine_id: { skill_level, ... } }
  const [saving, setSaving]       = useState(false)
  const [skillsLoading, setSkillsLoading] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: empData, error: empErr }, { data: skillData }, { data: machData }, { data: shiftData }] = await Promise.all([
      supabase.from('employees').select('*').order('full_name'),
      supabase.from('employee_skills').select('employee_id'),
      supabase.from('machines').select('id, process_name, department').order('department').order('process_name'),
      supabase.from('shifts').select('*').eq('is_active', true).order('start_time'),
    ])
    if (empErr) console.error('Employee fetch error:', empErr)
    const skillCounts = {}
    ;(skillData || []).forEach(s => { skillCounts[s.employee_id] = (skillCounts[s.employee_id] || 0) + 1 })
    const employees = (empData || []).map(e => ({ ...e, skill_count: skillCounts[e.id] || 0 }))
    setEmployees(employees)
    setMachines(machData || [])
    setShifts(shiftData || [])
    setLoading(false)
  }

  async function openEdit(emp) {
    playClick()
    setForm({ ...emp, monthly_salary: emp.monthly_salary ?? '', date_of_joining: emp.date_of_joining ?? '' })
    setTab('profile')
    setModal('edit')
    setSkillsLoading(true)
    const { data } = await supabase.from('employee_skills').select('*').eq('employee_id', emp.id)
    const map = {}
    ;(data || []).forEach(s => { map[s.machine_id] = s })
    setSkills(map)
    setSkillsLoading(false)
  }

  function openAdd() {
    playClick()
    setForm({ ...EMPTY_FORM })
    setSkills({})
    setTab('profile')
    setModal('add')
  }

  function closeModal() { setModal(null); setForm({ ...EMPTY_FORM }); setSkills({}) }

  function setSkillLevel(machineId, level) {
    setSkills(prev => {
      if (level === 0) {
        const n = { ...prev }; delete n[machineId]; return n
      }
      return { ...prev, [machineId]: { ...(prev[machineId] || {}), machine_id: machineId, skill_level: level } }
    })
  }

  function setSkillField(machineId, field, value) {
    setSkills(prev => ({ ...prev, [machineId]: { ...(prev[machineId] || { machine_id: machineId, skill_level: 1 }), [field]: value } }))
  }

  async function save() {
    if (!form.full_name?.trim()) { toast.error('Name is required'); return }
    if (!form.employee_code?.trim()) { toast.error('Employee code is required'); return }
    setSaving(true)

    const payload = { ...form }
    delete payload.id; delete payload.created_at; delete payload.skill_count
    if (payload.monthly_salary === '')    payload.monthly_salary = 0
    if (payload.overtime_rate === '')     payload.overtime_rate = 0
    if (payload.date_of_joining === '')   payload.date_of_joining = null
    if (payload.probation_end_date === '') payload.probation_end_date = null
    if (payload.shift_id === '')          payload.shift_id = null

    let empId = form.id
    if (modal === 'add') {
      const { data, error } = await supabase.from('employees').insert(payload).select().single()
      if (error) { playError(); toast.error(error.message); setSaving(false); return }
      empId = data.id
    } else {
      const { error } = await supabase.from('employees').update(payload).eq('id', form.id)
      if (error) { playError(); toast.error(error.message); setSaving(false); return }
    }

    // Save skills: delete all then re-insert active ones
    await supabase.from('employee_skills').delete().eq('employee_id', empId)
    const toInsert = Object.entries(skills)
      .filter(([, s]) => s.skill_level > 0)
      .map(([machine_id, s]) => ({
        employee_id: empId, machine_id,
        skill_level: s.skill_level,
        certified_date: s.certified_date || null,
        training_started_at: s.training_started_at || null,
        expected_completion_date: s.expected_completion_date || null,
        trainer_id: s.trainer_id || null,
        notes: s.notes || null,
      }))
    if (toInsert.length > 0) await supabase.from('employee_skills').insert(toInsert)

    setSaving(false)
    playSuccess()
    toast.success(modal === 'add' ? 'Employee added!' : 'Employee updated!')
    closeModal()
    fetchAll()
  }

  async function toggleActive(emp) {
    await supabase.from('employees').update({ is_active: !emp.is_active }).eq('id', emp.id)
    fetchAll()
  }

  const filtered = useMemo(() => employees.filter(e => {
    if (!showInactive && !e.is_active) return false
    if (filterDept && e.department !== filterDept) return false
    if (filterPos && e.position !== filterPos) return false
    if (search) {
      const q = search.toLowerCase()
      return e.full_name.toLowerCase().includes(q) ||
        (e.employee_code || '').toLowerCase().includes(q) ||
        (e.phone || '').includes(q)
    }
    return true
  }), [employees, search, filterDept, filterPos, showInactive])

  const depts    = [...new Set(employees.map(e => e.department).filter(Boolean))].sort()
  const positions = [...new Set(employees.map(e => e.position).filter(Boolean))].sort()
  const activeCnt = employees.filter(e => e.is_active).length
  const machineDepts = [...new Set(machines.map(m => m.department).filter(Boolean))].sort()

  function shiftById(id) { return shifts.find(s => s.id === id) }

  function fmtShiftTime(t) {
    if (!t) return ''
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'pm' : 'am'
    return `${h % 12 || 12}:${m.toString().padStart(2, '0')}${ampm}`
  }

  function f(field) { return (e) => setForm(p => ({ ...p, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }) ) }

  function onShiftChange(e) {
    const id = e.target.value
    const s = shifts.find(sh => sh.id === id)
    setForm(p => ({ ...p, shift_id: id, default_shift: s ? s.name.toLowerCase() : 'morning' }))
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm">
            <Users size={20} className="text-white" />
          </div>
          <div>
            <h1 className="page-header">Employees</h1>
            <p className="page-sub">Factory floor staff, skills & shift assignments</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={openAdd} className="btn-primary"><UserPlus size={15} /> Add Employee</button>
          <button onClick={fetchAll} className="btn-ghost px-2.5"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Employees', value: employees.length, color: 'text-brand-600', bg: 'bg-brand-50', border: 'border-brand-100' },
          { label: 'Active',          value: activeCnt,         color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Departments',     value: depts.length,      color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
          { label: 'Machines Covered',value: machines.length,   color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
        ].map(({ label, value, color, bg, border }) => (
          <div key={label} className={`card border ${border} p-4`}>
            <div className={`text-2xl font-bold ${color} tabular-nums`}>{value}</div>
            <div className="text-xs text-gray-500 mt-0.5 font-medium">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, code, phone…"
            className="input pl-8 py-2 text-sm" />
        </div>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="input py-2 text-sm w-auto min-w-[140px]">
          <option value="">All Departments</option>
          {depts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterPos} onChange={e => setFilterPos(e.target.value)} className="input py-2 text-sm w-auto min-w-[140px]">
          <option value="">All Positions</option>
          {positions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer px-3 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="accent-brand-500" />
          Show inactive
        </label>
      </div>

      {/* Employee grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="skeleton w-10 h-10 rounded-xl" />
                <div className="flex-1 space-y-2"><div className="skeleton h-3 rounded w-3/4" /><div className="skeleton h-2 rounded w-1/2" /></div>
              </div>
              <div className="skeleton h-2 rounded" /><div className="skeleton h-2 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 flex flex-col items-center justify-center text-center">
          <Users size={40} className="text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium text-sm">No employees found</p>
          <p className="text-gray-400 text-xs mt-1">Add your first employee using the button above</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(emp => {
            const shift    = shiftById(emp.shift_id)
            const certCount = emp.skill_count ?? 0
            return (
              <div key={emp.id}
                onClick={() => openEdit(emp)}
                className={`card p-4 cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 group ${!emp.is_active ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${avatarGradient(emp.full_name)} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <span className="text-white text-sm font-bold">{initials(emp.full_name)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {certCount > 0 && (
                      <span className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-semibold px-1.5 py-0.5 rounded-lg">
                        <Award size={10} /> {certCount}
                      </span>
                    )}
                    {!emp.is_active && <span className="badge-gray">Inactive</span>}
                  </div>
                </div>

                <div className="mb-2">
                  <div className="font-bold text-gray-900 text-sm leading-tight">{emp.full_name}</div>
                  <div className="text-xs text-gray-400 font-mono mt-0.5">{emp.employee_code}</div>
                </div>

                <div className="space-y-1.5">
                  {emp.position && (
                    <div className="flex items-center gap-1.5">
                      <Briefcase size={11} className="text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-600 font-medium">{emp.position}</span>
                      {emp.contract_type && emp.contract_type !== 'permanent' && (
                        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-md font-medium capitalize">
                          {emp.contract_type === 'daily_wage' ? 'Daily' : 'Contract'}
                        </span>
                      )}
                    </div>
                  )}
                  {emp.department && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400">{emp.department}</span>
                    </div>
                  )}
                  {emp.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone size={11} className="text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-500 font-mono">{emp.phone}</span>
                    </div>
                  )}
                  {shift && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-100 mt-1">
                      <Clock size={10} className="text-indigo-500" />
                      <span className="text-xs font-semibold text-indigo-600">
                        {shift.name} · {fmtShiftTime(shift.start_time)}–{fmtShiftTime(shift.end_time)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarGradient(form.full_name || 'New')} flex items-center justify-center flex-shrink-0`}>
                <span className="text-white text-xs font-bold">{initials(form.full_name || 'NE')}</span>
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-gray-900 text-base">{modal === 'add' ? 'New Employee' : (form.full_name || 'Edit Employee')}</h2>
                {modal === 'edit' && <p className="text-xs text-gray-400">{form.employee_code}</p>}
              </div>
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"><X size={18} /></button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-6 py-3 border-b border-gray-100 bg-gray-50/50">
              {[
                { key: 'profile', label: 'Profile' },
                { key: 'skills',  label: `Skills Matrix${Object.keys(skills).length > 0 ? ` (${Object.keys(skills).length})` : ''}` },
              ].map(t => (
                <button key={t.key} onClick={() => { playClick(); setTab(t.key) }}
                  className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-all cursor-pointer
                    ${tab === t.key ? 'bg-white shadow-sm text-brand-600 border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6">

              {tab === 'profile' && (
                <div className="space-y-5">
                  {/* Personal */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Personal Information</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">Full Name *</label>
                        <input value={form.full_name} onChange={f('full_name')} className="input" placeholder="e.g. Ramesh Kumar" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">Employee Code *</label>
                        <input value={form.employee_code} onChange={f('employee_code')} className="input font-mono" placeholder="e.g. EMP-001" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">Phone (WhatsApp)</label>
                        <input value={form.phone} onChange={f('phone')} className="input" placeholder="+91 98765 43210" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">Date of Joining</label>
                        <input type="date" value={form.date_of_joining} onChange={f('date_of_joining')} className="input" />
                      </div>
                    </div>
                  </div>

                  {/* Work */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Work Details</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">Department</label>
                        <select value={form.department} onChange={f('department')} className="input">
                          <option value="">Select department</option>
                          {DEPARTMENTS_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">Role</label>
                        <select value={form.position} onChange={f('position')} className="input">
                          <option value="">Select role</option>
                          {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">Assigned Shift</label>
                        <select value={form.shift_id} onChange={onShiftChange} className="input">
                          <option value="">No shift assigned</option>
                          {shifts.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.start_time}–{s.end_time})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">Monthly Salary (₹)</label>
                        <input type="number" value={form.monthly_salary} onChange={f('monthly_salary')} className="input" placeholder="0" />
                      </div>
                    </div>
                  </div>

                  {/* Contract & Pay */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Contract & Pay</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">Contract Type</label>
                        <select value={form.contract_type} onChange={f('contract_type')} className="input">
                          {CONTRACT_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">Weekly Off</label>
                        <select value={form.weekly_off} onChange={f('weekly_off')} className="input">
                          {WEEKLY_OFF_DAYS.map(d => <option key={d} value={d.toLowerCase()}>{d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">Basic Hours / Day</label>
                        <input type="number" min="1" max="24" step="0.5" value={form.basic_hours_per_day} onChange={f('basic_hours_per_day')} className="input" placeholder="8" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">Overtime Rate (₹/hr)</label>
                        <input type="number" min="0" value={form.overtime_rate} onChange={f('overtime_rate')} className="input" placeholder="0" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">Probation End Date</label>
                        <input type="date" value={form.probation_end_date} onChange={f('probation_end_date')} className="input" />
                      </div>
                    </div>
                  </div>

                  {/* Emergency */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Emergency Contact</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">Contact Name</label>
                        <input value={form.emergency_contact_name} onChange={f('emergency_contact_name')} className="input" placeholder="Name" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">Contact Phone</label>
                        <input value={form.emergency_contact_phone} onChange={f('emergency_contact_phone')} className="input" placeholder="+91 …" />
                      </div>
                    </div>
                  </div>

                  {/* Notes + Status */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes</label>
                      <textarea value={form.notes} onChange={f('notes')} rows={3} className="input resize-none" placeholder="Any additional notes…" />
                    </div>
                    <div className="flex flex-col justify-end">
                      <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors">
                        <input type="checkbox" checked={form.is_active} onChange={f('is_active')} className="accent-brand-500 w-4 h-4" />
                        <div>
                          <div className="text-sm font-semibold text-gray-800">Active Employee</div>
                          <div className="text-xs text-gray-400">Inactive employees won't appear in shift planning</div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'skills' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-500">Set skill level for each machine. Only machines with a skill level will appear in shift planning suggestions.</p>
                  </div>

                  {skillsLoading ? (
                    <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                      <RefreshCw size={16} className="animate-spin" /><span className="text-sm">Loading skills…</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {machineDepts.map(dept => {
                        const deptMachines = machines.filter(m => m.department === dept)
                        return (
                          <div key={dept}>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">{dept}</div>
                            <div className="space-y-1.5">
                              {deptMachines.map(m => {
                                const skill = skills[m.id]
                                const level = skill?.skill_level ?? 0
                                return (
                                  <div key={m.id} className={`rounded-xl border p-3 transition-colors ${level > 0 ? 'bg-white border-gray-200' : 'bg-gray-50/50 border-gray-100'}`}>
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                      <span className={`text-sm font-semibold ${level > 0 ? 'text-gray-900' : 'text-gray-400'}`}>{m.process_name}</span>
                                      <div className="flex items-center gap-1">
                                        {SKILL_LEVELS.map(sl => (
                                          <button key={sl.value}
                                            onClick={() => setSkillLevel(m.id, sl.value)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer
                                              ${level === sl.value ? sl.cls + ' shadow-sm' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}>
                                            {sl.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Extra fields for Training */}
                                    {level === 1 && (
                                      <div className="mt-3 grid grid-cols-2 gap-2 pt-2 border-t border-amber-100">
                                        <div>
                                          <label className="text-xs text-gray-500 mb-1 block">Training Started</label>
                                          <input type="date" value={skill?.training_started_at || ''}
                                            onChange={e => setSkillField(m.id, 'training_started_at', e.target.value)}
                                            className="input py-1.5 text-xs" />
                                        </div>
                                        <div>
                                          <label className="text-xs text-gray-500 mb-1 block">Expected Completion</label>
                                          <input type="date" value={skill?.expected_completion_date || ''}
                                            onChange={e => setSkillField(m.id, 'expected_completion_date', e.target.value)}
                                            className="input py-1.5 text-xs" />
                                        </div>
                                      </div>
                                    )}

                                    {/* Extra fields for Certified / Expert */}
                                    {level >= 2 && (
                                      <div className="mt-3 pt-2 border-t border-emerald-100">
                                        <div className="w-48">
                                          <label className="text-xs text-gray-500 mb-1 block">Certified On</label>
                                          <input type="date" value={skill?.certified_date || ''}
                                            onChange={e => setSkillField(m.id, 'certified_date', e.target.value)}
                                            className="input py-1.5 text-xs" />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}

                      {machines.length === 0 && (
                        <div className="flex flex-col items-center py-10 text-center">
                          <AlertCircle size={32} className="text-gray-200 mb-2" />
                          <p className="text-gray-500 text-sm">No machines found</p>
                          <p className="text-gray-400 text-xs mt-1">Add machines in Quotations → Machines first</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              {modal === 'edit' && (
                <button onClick={() => toggleActive(form)}
                  className={`text-xs font-semibold px-3 py-2 rounded-xl border transition-colors cursor-pointer
                    ${form.is_active ? 'text-red-500 border-red-200 hover:bg-red-50' : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}>
                  {form.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <button onClick={closeModal} className="btn-ghost">Cancel</button>
                <button onClick={save} disabled={saving} className="btn-primary">
                  <Save size={14} /> {saving ? 'Saving…' : 'Save Employee'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
