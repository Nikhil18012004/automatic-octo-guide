import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { playSuccess, playError, playClick } from '../lib/sound'
import {
  Calendar, ChevronLeft, ChevronRight, Sun, Sunset, Moon,
  Save, RefreshCw, Bell, CheckCircle2, AlertTriangle,
  Users, UserCheck, UserX, Info
} from 'lucide-react'

const SHIFTS = [
  { value: 'morning',   label: 'Morning',   time: '6am – 2pm',  icon: Sun,    active: 'bg-amber-500 text-white', indicator: 'bg-amber-400' },
  { value: 'afternoon', label: 'Afternoon', time: '2pm – 10pm', icon: Sunset, active: 'bg-orange-500 text-white', indicator: 'bg-orange-400' },
  { value: 'night',     label: 'Night',     time: '10pm – 6am', icon: Moon,   active: 'bg-indigo-600 text-white', indicator: 'bg-indigo-500' },
]

const SKILL_BADGE = {
  0: null,
  1: { label: 'Training', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  2: { label: 'Certified', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  3: { label: 'Expert',    cls: 'bg-brand-50 text-brand-700 border border-brand-100' },
}

function fmtDate(d) {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
function toISO(d) { return d.toISOString().split('T')[0] }
function isToday(d) { return toISO(d) === toISO(new Date()) }

export default function ShiftPlanner({ profile }) {
  const [date, setDate]         = useState(new Date())
  const [shift, setShift]       = useState('morning')
  const [machines, setMachines] = useState([])
  const [employees, setEmployees] = useState([])
  const [skillMap, setSkillMap] = useState({}) // { employee_id: { machine_id: skill_level } }
  const [assignments, setAssignments] = useState({}) // { machine_id: { operator_id, helper_id, job_description } }
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [dirty, setDirty]       = useState(false)

  const dateStr = toISO(date)

  const fetchBase = useCallback(async () => {
    const [{ data: mData }, { data: eData }, { data: skData }] = await Promise.all([
      supabase.from('machines').select('id, process_name, department').order('department').order('process_name'),
      supabase.from('employees').select('id, full_name, employee_code, department, position, default_shift').eq('is_active', true).order('full_name'),
      supabase.from('employee_skills').select('employee_id, machine_id, skill_level'),
    ])
    setMachines(mData || [])
    setEmployees(eData || [])
    // Build skill lookup: skillMap[employee_id][machine_id] = skill_level
    const sm = {}
    ;(skData || []).forEach(s => {
      if (!sm[s.employee_id]) sm[s.employee_id] = {}
      sm[s.employee_id][s.machine_id] = s.skill_level
    })
    setSkillMap(sm)
  }, [])

  const fetchAssignments = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('shift_assignments')
      .select('*')
      .eq('assignment_date', dateStr)
      .eq('shift', shift)
    const map = {}
    ;(data || []).forEach(a => {
      if (!map[a.machine_id]) map[a.machine_id] = { operator_id: '', helper_id: '', job_description: '' }
      if (a.role_in_shift === 'operator') map[a.machine_id].operator_id = a.employee_id
      if (a.role_in_shift === 'helper')   map[a.machine_id].helper_id   = a.employee_id
      if (a.job_description) map[a.machine_id].job_description = a.job_description
    })
    setAssignments(map)
    setDirty(false)
    setLoading(false)
  }, [dateStr, shift])

  useEffect(() => { fetchBase() }, [fetchBase])
  useEffect(() => { fetchAssignments() }, [fetchAssignments])

  function setAssign(machineId, field, value) {
    setAssignments(prev => ({
      ...prev,
      [machineId]: { ...(prev[machineId] || { operator_id: '', helper_id: '', job_description: '' }), [field]: value }
    }))
    setDirty(true)
  }

  async function saveAll() {
    setSaving(true)
    const machineIds = machines.map(m => m.id)

    // Delete existing assignments for this date+shift for all machines
    await supabase.from('shift_assignments')
      .delete()
      .eq('assignment_date', dateStr)
      .eq('shift', shift)
      .in('machine_id', machineIds)

    // Re-insert
    const rows = []
    for (const [machineId, a] of Object.entries(assignments)) {
      const jobDesc = a.job_description || null
      if (a.operator_id) rows.push({
        assignment_date: dateStr, shift, machine_id: machineId,
        employee_id: a.operator_id, role_in_shift: 'operator',
        job_description: jobDesc, assigned_by: profile.id, status: 'scheduled',
      })
      if (a.helper_id) rows.push({
        assignment_date: dateStr, shift, machine_id: machineId,
        employee_id: a.helper_id, role_in_shift: 'helper',
        job_description: jobDesc, assigned_by: profile.id, status: 'scheduled',
      })
    }

    if (rows.length > 0) {
      const { error } = await supabase.from('shift_assignments').insert(rows)
      if (error) { playError(); toast.error('Save failed: ' + error.message); setSaving(false); return }
    }

    setSaving(false)
    setDirty(false)
    playSuccess()
    toast.success(`${shift.charAt(0).toUpperCase() + shift.slice(1)} shift saved — ${rows.length} assignments`)
  }

  function notifyAll() {
    toast('WhatsApp notifications coming soon — requires Twilio integration', { icon: '📱' })
  }

  function prevDay() { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d) }
  function nextDay() { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d) }

  // Employee options for a dropdown, sorted by skill level for the machine
  function empOptions(machineId, excludeId = '') {
    return [...employees]
      .filter(e => e.id !== excludeId)
      .map(e => ({ ...e, skillLevel: skillMap[e.id]?.[machineId] ?? 0 }))
      .sort((a, b) => b.skillLevel - a.skillLevel)
  }

  function skillBadge(employeeId, machineId) {
    const level = skillMap[employeeId]?.[machineId] ?? 0
    const meta = SKILL_BADGE[level]
    if (!meta) return null
    return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${meta.cls}`}>{meta.label}</span>
  }

  const departments = [...new Set(machines.map(m => m.department).filter(Boolean))].sort()
  const assignedCount = Object.values(assignments).filter(a => a.operator_id || a.helper_id).length
  const totalMachines = machines.length
  const activeShift = SHIFTS.find(s => s.value === shift)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm">
            <Calendar size={20} className="text-white" />
          </div>
          <div>
            <h1 className="page-header">Shift Planner</h1>
            <p className="page-sub">Assign employees to machines by shift</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {dirty && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <AlertTriangle size={12} /> Unsaved changes
            </span>
          )}
          <button onClick={notifyAll} className="btn-secondary">
            <Bell size={14} /> Notify All
          </button>
          <button onClick={saveAll} disabled={saving || !dirty} className="btn-primary">
            <Save size={14} /> {saving ? 'Saving…' : 'Save Shift'}
          </button>
        </div>
      </div>

      {/* Date navigation + shift tabs */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Date nav */}
        <div className="flex items-center gap-1 bg-white rounded-2xl border border-gray-200 shadow-sm p-1">
          <button onClick={prevDay} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors cursor-pointer">
            <ChevronLeft size={16} />
          </button>
          <div className="px-4 text-center min-w-[160px]">
            <div className={`text-sm font-bold ${isToday(date) ? 'text-brand-600' : 'text-gray-900'}`}>{fmtDate(date)}</div>
            {isToday(date) && <div className="text-xs text-brand-400 font-semibold">Today</div>}
          </div>
          <button onClick={nextDay} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors cursor-pointer">
            <ChevronRight size={16} />
          </button>
          <button onClick={() => setDate(new Date())}
            className="px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 rounded-xl transition-colors cursor-pointer ml-1">
            Today
          </button>
        </div>

        {/* Shift tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 flex-1">
          {SHIFTS.map(s => {
            const Icon = s.icon
            const isActive = shift === s.value
            return (
              <button key={s.value} onClick={() => { playClick(); setShift(s.value) }}
                className={`flex items-center gap-2 flex-1 justify-center py-2.5 px-3 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer
                  ${isActive ? s.active + ' shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'}`}>
                <Icon size={14} />
                <span className="hidden sm:inline">{s.label}</span>
                <span className="text-xs font-normal opacity-75 hidden lg:inline">({s.time})</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 px-4 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${activeShift?.indicator}`} />
          <span className="text-sm font-semibold text-gray-700">{activeShift?.label} Shift</span>
          <span className="text-xs text-gray-400">{activeShift?.time}</span>
        </div>
        <div className="h-4 w-px bg-gray-200" />
        <div className="flex items-center gap-1.5 text-sm">
          <UserCheck size={14} className="text-emerald-500" />
          <span className="font-bold text-emerald-600">{assignedCount}</span>
          <span className="text-gray-400">of {totalMachines} machines assigned</span>
        </div>
        <div className="ml-auto">
          {loading && <RefreshCw size={14} className="animate-spin text-gray-400" />}
        </div>
      </div>

      {/* Machine assignment table */}
      {loading ? (
        <div className="card p-12 flex items-center justify-center gap-3 text-gray-400">
          <RefreshCw size={18} className="animate-spin" />
          <span className="text-sm">Loading assignments…</span>
        </div>
      ) : machines.length === 0 ? (
        <div className="card p-12 flex flex-col items-center justify-center text-center">
          <AlertTriangle size={36} className="text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium text-sm">No machines found</p>
          <p className="text-gray-400 text-xs mt-1">Add machines in Quotations → Machines first</p>
        </div>
      ) : (
        departments.map(dept => {
          const deptMachines = machines.filter(m => m.department === dept)
          return (
            <div key={dept} className="card overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{dept}</span>
                <span className="badge-gray ml-auto">{deptMachines.length}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {deptMachines.map(m => {
                  const a   = assignments[m.id] || { operator_id: '', helper_id: '', job_description: '' }
                  const ops = empOptions(m.id, a.helper_id)
                  const hps = empOptions(m.id, a.operator_id)
                  const isAssigned = a.operator_id || a.helper_id
                  return (
                    <div key={m.id} className={`px-5 py-4 transition-colors ${isAssigned ? 'bg-emerald-50/20' : 'hover:bg-gray-50/40'}`}>
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1.5fr] gap-3 items-start">

                        {/* Machine name */}
                        <div className="flex items-center gap-2.5">
                          {isAssigned
                            ? <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                            : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-200 flex-shrink-0" />}
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{m.process_name}</div>
                          </div>
                        </div>

                        {/* Operator */}
                        <div>
                          <label className="text-xs font-semibold text-gray-400 mb-1 block">Operator</label>
                          <div className="flex items-center gap-2">
                            <select
                              value={a.operator_id}
                              onChange={e => setAssign(m.id, 'operator_id', e.target.value)}
                              className={`input py-1.5 text-sm flex-1 ${a.operator_id ? 'border-emerald-200 bg-emerald-50/30' : ''}`}>
                              <option value="">— Unassigned —</option>
                              {ops.map(e => (
                                <option key={e.id} value={e.id}>
                                  {e.full_name}{e.skillLevel >= 2 ? ' ✓' : e.skillLevel === 1 ? ' ~' : ''}
                                </option>
                              ))}
                            </select>
                            {a.operator_id && skillBadge(a.operator_id, m.id)}
                          </div>
                          {a.operator_id && (skillMap[a.operator_id]?.[m.id] ?? 0) === 0 && (
                            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                              <AlertTriangle size={10} /> Not trained for this machine
                            </p>
                          )}
                        </div>

                        {/* Helper */}
                        <div>
                          <label className="text-xs font-semibold text-gray-400 mb-1 block">Helper</label>
                          <div className="flex items-center gap-2">
                            <select
                              value={a.helper_id}
                              onChange={e => setAssign(m.id, 'helper_id', e.target.value)}
                              className={`input py-1.5 text-sm flex-1 ${a.helper_id ? 'border-brand-200 bg-brand-50/20' : ''}`}>
                              <option value="">— Unassigned —</option>
                              {hps.map(e => (
                                <option key={e.id} value={e.id}>{e.full_name}</option>
                              ))}
                            </select>
                            {a.helper_id && skillBadge(a.helper_id, m.id)}
                          </div>
                        </div>

                        {/* Job description */}
                        <div>
                          <label className="text-xs font-semibold text-gray-400 mb-1 block">Job / Notes</label>
                          <input
                            value={a.job_description}
                            onChange={e => setAssign(m.id, 'job_description', e.target.value)}
                            placeholder="e.g. 4C 16mm XLPE, 500m on D-500/1000"
                            className="input py-1.5 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}

      {/* Bottom save bar */}
      {dirty && (
        <div className="sticky bottom-4 flex justify-center">
          <div className="flex items-center gap-3 bg-gray-900 text-white rounded-2xl px-5 py-3 shadow-2xl">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-sm font-medium">You have unsaved changes</span>
            <button onClick={saveAll} disabled={saving} className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-1.5 rounded-xl text-sm font-bold transition-colors cursor-pointer disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Now'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
