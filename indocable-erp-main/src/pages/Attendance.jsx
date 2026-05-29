import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import {
  Calendar, ChevronLeft, ChevronRight, Save, RefreshCw,
  Clock, Users, CheckCircle2, AlertCircle, BarChart2,
  Upload, X, FileText, Download
} from 'lucide-react'

// ─── Status config ───────────────────────────────────────────────────────────
const STATUSES = [
  { value: 'present',  short: 'P',  label: 'Present',  active: 'bg-emerald-500 text-white border-emerald-600', cell: 'bg-emerald-100 text-emerald-800 font-bold' },
  { value: 'half_day', short: 'H',  label: 'Half Day', active: 'bg-amber-500 text-white border-amber-600',   cell: 'bg-amber-100 text-amber-800 font-bold' },
  { value: 'leave',    short: 'L',  label: 'Leave',    active: 'bg-blue-500 text-white border-blue-600',     cell: 'bg-blue-100 text-blue-800 font-bold' },
  { value: 'absent',   short: 'A',  label: 'Absent',   active: 'bg-red-500 text-white border-red-600',       cell: 'bg-red-100 text-red-800 font-bold' },
  { value: 'week_off', short: 'WO', label: 'Week Off', active: 'bg-gray-400 text-white border-gray-500',     cell: 'bg-gray-100 text-gray-600' },
  { value: 'holiday',  short: 'HO', label: 'Holiday',  active: 'bg-purple-500 text-white border-purple-600', cell: 'bg-purple-100 text-purple-800' },
]
const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.value, s]))

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toISO(d)   { return d.toISOString().split('T')[0] }
function todayISO() { return toISO(new Date()) }

function fmtDate(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}
function fmtMonth(ym) {
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}
function initials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}
const GRADIENTS = [
  'from-brand-500 to-brand-700','from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-700','from-amber-500 to-orange-600',
  'from-cyan-500 to-blue-600','from-rose-500 to-pink-600',
]
function gradient(str = '') {
  let h = 0; for (const c of str) h = ((h << 5) - h) + c.charCodeAt(0)
  return GRADIENTS[Math.abs(h) % GRADIENTS.length]
}
function calcOT(inTime, outTime, shift) {
  if (!inTime || !outTime || !shift) return 0
  const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  let shiftMins = mins(shift.end_time) - mins(shift.start_time)
  if (shiftMins <= 0) shiftMins += 1440
  const shiftNet = shiftMins - (shift.break_minutes ?? 30)
  let actual = mins(outTime) - mins(inTime)
  if (actual <= 0) actual += 1440
  return +(Math.max(0, actual - shiftNet) / 60).toFixed(1)
}
function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

// ─── CSV helpers ─────────────────────────────────────────────────────────────
const STATUS_ALIASES = {
  p: 'present', present: 'present',
  h: 'half_day', hd: 'half_day', half: 'half_day', half_day: 'half_day',
  l: 'leave', leave: 'leave',
  a: 'absent', absent: 'absent',
  wo: 'week_off', week_off: 'week_off', weekoff: 'week_off',
  ho: 'holiday', holiday: 'holiday',
}

function parseCSV(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return { rows: [], error: 'CSV must have a header row and at least one data row.' }
  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g,'_'))
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim())
    const row = {}
    header.forEach((h, idx) => { row[h] = cols[idx] || '' })
    rows.push(row)
  }
  return { rows, error: null }
}

function downloadTemplate() {
  const csv = 'employee_code,date,status,in_time,out_time\nEMP001,2026-05-12,present,08:00,17:00\nEMP002,2026-05-12,absent,,\nEMP003,2026-05-12,half_day,08:00,13:00'
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
  a.download = 'attendance_template.csv'; a.click()
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function Attendance({ profile }) {
  const [tab, setTab]       = useState('daily')
  const [date, setDate]     = useState(todayISO)
  const [month, setMonth]   = useState(todayISO().slice(0, 7))

  const [employees, setEmployees] = useState([])
  const [shifts, setShifts]       = useState([])
  const [records, setRecords]     = useState({})     // { emp_id: { status, in_time, out_time, notes } }
  const [monthData, setMonthData] = useState([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [filterDept, setFilterDept] = useState('')
  const [dirty, setDirty]     = useState(false)

  // CSV import state
  const [csvPreview, setCsvPreview] = useState(null) // [{ employee_code, date, status, in_time, out_time, _empId, _empName, _error }]
  const [csvImporting, setCsvImporting] = useState(false)
  const fileInputRef = useRef()

  const shiftMap = useMemo(() => Object.fromEntries(shifts.map(s => [s.id, s])), [shifts])
  const depts    = useMemo(() => [...new Set(employees.map(e => e.department).filter(Boolean))].sort(), [employees])

  const visibleEmployees = useMemo(() =>
    filterDept ? employees.filter(e => e.department === filterDept) : employees,
  [employees, filterDept])

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchBase = useCallback(async () => {
    setLoading(true)
    const [{ data: empData }, { data: shiftData }] = await Promise.all([
      supabase.from('employees')
        .select('id, full_name, employee_code, department, position, shift_id, weekly_off, basic_hours_per_day')
        .eq('is_active', true).order('full_name'),
      supabase.from('shifts').select('*'),
    ])
    setEmployees(empData || [])
    setShifts(shiftData || [])
    setLoading(false)
  }, [])

  const fetchDayRecords = useCallback(async () => {
    const { data } = await supabase.from('attendance').select('*').eq('date', date)
    const map = {}
    ;(data || []).forEach(r => { map[r.employee_id] = r })
    setRecords(map)
    setDirty(false)
  }, [date])

  const fetchMonthRecords = useCallback(async () => {
    const [y, m] = month.split('-')
    const start  = `${month}-01`
    const end    = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`
    const { data } = await supabase.from('attendance').select('*').gte('date', start).lte('date', end)
    setMonthData(data || [])
  }, [month])

  useEffect(() => { fetchBase() }, [fetchBase])
  useEffect(() => { if (tab === 'daily')   fetchDayRecords()   }, [tab, date, fetchDayRecords])
  useEffect(() => { if (tab === 'monthly') fetchMonthRecords() }, [tab, month, fetchMonthRecords])

  // ── Record helpers ─────────────────────────────────────────────────────────
  function setField(empId, field, value) {
    setDirty(true)
    setRecords(p => ({ ...p, [empId]: { ...(p[empId] || { status: 'absent' }), [field]: value } }))
  }

  function markAll(status) {
    setDirty(true)
    const next = {}
    visibleEmployees.forEach(e => { next[e.id] = { ...(records[e.id] || {}), status } })
    setRecords(p => ({ ...p, ...next }))
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function saveAll() {
    setSaving(true)
    const toUpsert = visibleEmployees.map(e => {
      const r     = records[e.id] || { status: 'absent' }
      const shift = shiftMap[e.shift_id]
      const showTime = r.status === 'present' || r.status === 'half_day'
      return {
        employee_id: e.id,
        date,
        shift_id:   e.shift_id || null,
        status:     r.status || 'absent',
        in_time:    showTime ? (r.in_time || null)  : null,
        out_time:   showTime ? (r.out_time || null) : null,
        ot_hours:   showTime ? calcOT(r.in_time, r.out_time, shift) : 0,
        notes:      r.notes || null,
        marked_by:  profile?.id || null,
        updated_at: new Date().toISOString(),
      }
    })
    const { error } = await supabase.from('attendance').upsert(toUpsert, { onConflict: 'employee_id,date' })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(`Attendance saved — ${toUpsert.length} employees`)
    setDirty(false)
  }

  // ── CSV import ─────────────────────────────────────────────────────────────
  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = evt => processCSV(evt.target.result)
    reader.readAsText(file)
    e.target.value = ''
  }

  function processCSV(text) {
    const { rows, error } = parseCSV(text)
    if (error) { toast.error(error); return }
    const codeMap = Object.fromEntries(employees.map(e => [e.employee_code?.toLowerCase(), e]))
    const preview = rows.map(r => {
      const emp  = codeMap[r.employee_code?.toLowerCase()]
      const stat = STATUS_ALIASES[r.status?.toLowerCase()?.trim()]
      return {
        employee_code: r.employee_code,
        date:          r.date,
        status:        r.status,
        in_time:       r.in_time || '',
        out_time:      r.out_time || '',
        _empId:        emp?.id || null,
        _empName:      emp?.full_name || null,
        _resolvedStatus: stat || null,
        _error: !emp ? 'Employee not found' : !stat ? 'Invalid status' : !r.date ? 'Missing date' : null,
      }
    })
    setCsvPreview(preview)
  }

  async function importCSV() {
    const valid = csvPreview.filter(r => !r._error)
    if (!valid.length) { toast.error('No valid rows to import'); return }
    setCsvImporting(true)
    const empIdMap = Object.fromEntries(employees.map(e => [e.id, e]))
    const toUpsert = valid.map(r => {
      const emp   = empIdMap[r._empId]
      const shift = shiftMap[emp?.shift_id]
      const showTime = r._resolvedStatus === 'present' || r._resolvedStatus === 'half_day'
      return {
        employee_id: r._empId,
        date:        r.date,
        shift_id:    emp?.shift_id || null,
        status:      r._resolvedStatus,
        in_time:     showTime && r.in_time ? r.in_time : null,
        out_time:    showTime && r.out_time ? r.out_time : null,
        ot_hours:    showTime ? calcOT(r.in_time, r.out_time, shift) : 0,
        notes:       null,
        marked_by:   profile?.id || null,
        updated_at:  new Date().toISOString(),
      }
    })
    const { error } = await supabase.from('attendance').upsert(toUpsert, { onConflict: 'employee_id,date' })
    setCsvImporting(false)
    if (error) { toast.error(error.message); return }
    toast.success(`Imported ${toUpsert.length} attendance records`)
    setCsvPreview(null)
    fetchDayRecords()
  }

  // ── Date nav ───────────────────────────────────────────────────────────────
  function shiftDate(n) {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + n)
    setDate(toISO(d))
  }
  function shiftMonth(n) {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + n, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  // ── Monthly summary ────────────────────────────────────────────────────────
  const monthlySummary = useMemo(() => {
    const byEmp = {}
    monthData.forEach(r => {
      if (!byEmp[r.employee_id]) byEmp[r.employee_id] = { present: 0, half_day: 0, leave: 0, absent: 0, week_off: 0, holiday: 0, ot: 0 }
      const s = byEmp[r.employee_id]
      if (r.status in s) s[r.status]++
      s.ot += Number(r.ot_hours || 0)
    })
    return byEmp
  }, [monthData])

  // ── Stats for today ────────────────────────────────────────────────────────
  const daySummary = useMemo(() => {
    const counts = { present: 0, half_day: 0, leave: 0, absent: 0, week_off: 0, holiday: 0, unmarked: 0 }
    employees.forEach(e => {
      const r = records[e.id]
      if (!r) counts.unmarked++
      else counts[r.status] = (counts[r.status] || 0) + 1
    })
    return counts
  }, [records, employees])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
            <CheckCircle2 size={20} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="page-header">Attendance</h1>
            <p className="page-sub">Mark daily attendance and track monthly records</p>
          </div>
        </div>
        <button onClick={tab === 'daily' ? fetchDayRecords : fetchMonthRecords} className="btn-ghost px-2.5">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl w-fit">
        {[
          { key: 'daily',   icon: Calendar,  label: 'Daily Attendance' },
          { key: 'monthly', icon: BarChart2, label: 'Monthly Summary' },
          { key: 'import',  icon: Upload,    label: 'Import CSV' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all
              ${tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* ── DAILY VIEW ─────────────────────────────────────────────────────── */}
      {tab === 'daily' && (
        <div className="space-y-4">

          {/* Date nav + quick actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl shadow-sm">
              <button onClick={() => shiftDate(-1)} className="p-2 hover:bg-gray-50 rounded-l-xl transition-colors">
                <ChevronLeft size={16} className="text-gray-500" />
              </button>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="border-0 text-sm font-semibold text-gray-900 bg-transparent px-2 py-2 focus:outline-none" />
              <button onClick={() => shiftDate(1)} className="p-2 hover:bg-gray-50 rounded-r-xl transition-colors">
                <ChevronRight size={16} className="text-gray-500" />
              </button>
            </div>
            {date !== todayISO() && (
              <button onClick={() => setDate(todayISO())} className="btn-ghost text-sm py-2">Today</button>
            )}

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <span className="text-xs text-gray-400 font-medium">Quick mark:</span>
              {STATUSES.slice(0, 4).map(s => (
                <button key={s.value} onClick={() => markAll(s.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${s.active}`}>
                  All {s.short}
                </button>
              ))}
            </div>
          </div>

          {/* Day summary strip */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { key: 'present',  label: 'Present',  color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
              { key: 'half_day', label: 'Half Day', color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
              { key: 'leave',    label: 'Leave',    color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100' },
              { key: 'absent',   label: 'Absent',   color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-100' },
              { key: 'week_off', label: 'Week Off', color: 'text-gray-500',    bg: 'bg-gray-50',    border: 'border-gray-200' },
              { key: 'unmarked', label: 'Unmarked', color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-100' },
            ].map(({ key, label, color, bg, border }) => (
              <div key={key} className={`${bg} border ${border} rounded-xl px-3 py-2 text-center`}>
                <div className={`text-xl font-bold tabular-nums ${color}`}>{daySummary[key] ?? 0}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            ))}
          </div>

          {/* Dept filter */}
          <div className="flex flex-wrap gap-2 items-center">
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="input py-2 text-sm w-auto min-w-[160px]">
              <option value="">All Departments</option>
              {depts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <div className="text-sm text-gray-500">{visibleEmployees.length} employees</div>
          </div>

          {/* Employee list */}
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
            </div>
          ) : visibleEmployees.length === 0 ? (
            <div className="card p-12 text-center">
              <Users size={36} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-400 font-medium text-sm">No active employees found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleEmployees.map(emp => {
                const r     = records[emp.id] || {}
                const shift = shiftMap[emp.shift_id]
                const st    = r.status || ''
                const showTime = st === 'present' || st === 'half_day'
                const ot    = showTime ? calcOT(r.in_time, r.out_time, shift) : 0

                return (
                  <div key={emp.id} className={`bg-white border rounded-2xl p-4 transition-all
                    ${st === 'present'  ? 'border-emerald-200 shadow-sm' :
                      st === 'absent'   ? 'border-red-100' :
                      st === 'half_day' ? 'border-amber-200 shadow-sm' :
                      st === 'leave'    ? 'border-blue-100' :
                      st === 'week_off' ? 'border-gray-200 opacity-70' :
                      'border-gray-100'}`}>
                    <div className="flex flex-wrap items-center gap-3">

                      {/* Avatar + info */}
                      <div className="flex items-center gap-3 min-w-[180px] flex-1">
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient(emp.full_name)} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white text-xs font-bold">{initials(emp.full_name)}</span>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 text-sm leading-tight">{emp.full_name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400 font-mono">{emp.employee_code}</span>
                            {emp.position && <span className="text-xs text-gray-400">· {emp.position}</span>}
                            {shift && (
                              <span className="text-xs text-indigo-500 font-medium">· {shift.name}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status buttons */}
                      <div className="flex items-center gap-1 flex-wrap">
                        {STATUSES.map(s => (
                          <button key={s.value}
                            onClick={() => setField(emp.id, 'status', s.value)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all
                              ${st === s.value ? s.active : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600'}`}>
                            {s.short}
                          </button>
                        ))}
                      </div>

                      {/* In / Out time */}
                      {showTime && (
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="text-xs text-gray-400 mb-0.5">In</div>
                            <input type="time" value={r.in_time || ''}
                              onChange={e => setField(emp.id, 'in_time', e.target.value)}
                              className="input py-1 px-2 text-xs w-28" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-400 mb-0.5">Out</div>
                            <input type="time" value={r.out_time || ''}
                              onChange={e => setField(emp.id, 'out_time', e.target.value)}
                              className="input py-1 px-2 text-xs w-28" />
                          </div>
                          {ot > 0 && (
                            <div className="text-center">
                              <div className="text-xs text-gray-400 mb-0.5">OT</div>
                              <div className="text-xs font-bold text-brand-600 bg-brand-50 border border-brand-100 rounded-lg px-2 py-1">
                                +{ot}h
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Save button */}
          {!loading && visibleEmployees.length > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 sticky bottom-0 bg-white/90 backdrop-blur-sm py-3 -mx-1 px-1">
              <div className="text-sm text-gray-500">
                {dirty && <span className="text-amber-600 font-medium flex items-center gap-1"><AlertCircle size={13} /> Unsaved changes</span>}
              </div>
              <button onClick={saveAll} disabled={saving} className="btn-primary">
                <Save size={14} />{saving ? 'Saving…' : `Save Attendance · ${fmtDate(date).split(',')[0]}`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── MONTHLY SUMMARY ────────────────────────────────────────────────── */}
      {tab === 'monthly' && (
        <div className="space-y-4">

          {/* Month nav */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm">
              <button onClick={() => shiftMonth(-1)} className="p-2 hover:bg-gray-50 rounded-l-xl transition-colors">
                <ChevronLeft size={16} className="text-gray-500" />
              </button>
              <span className="px-4 text-sm font-bold text-gray-900 min-w-[140px] text-center">{fmtMonth(month)}</span>
              <button onClick={() => shiftMonth(1)} className="p-2 hover:bg-gray-50 rounded-r-xl transition-colors">
                <ChevronRight size={16} className="text-gray-500" />
              </button>
            </div>
            {month !== todayISO().slice(0, 7) && (
              <button onClick={() => setMonth(todayISO().slice(0, 7))} className="btn-ghost text-sm py-2">This Month</button>
            )}
          </div>

          {/* Summary table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[180px]">Employee</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Dept</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-emerald-600 uppercase tracking-wider">P</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-amber-600 uppercase tracking-wider">HD</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-blue-600 uppercase tracking-wider">Leave</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-red-600 uppercase tracking-wider">Absent</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">WO</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-brand-600 uppercase tracking-wider">OT Hrs</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Marked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {employees.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-12 text-gray-400 text-sm">No employees found</td></tr>
                  ) : employees.map(emp => {
                    const s = monthlySummary[emp.id] || { present: 0, half_day: 0, leave: 0, absent: 0, week_off: 0, holiday: 0, ot: 0 }
                    const total = s.present + s.half_day + s.leave + s.absent + s.week_off + s.holiday
                    return (
                      <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${gradient(emp.full_name)} flex items-center justify-center flex-shrink-0`}>
                              <span className="text-white text-xs font-bold">{initials(emp.full_name)}</span>
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 text-sm">{emp.full_name}</div>
                              <div className="text-xs text-gray-400 font-mono">{emp.employee_code}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center text-xs text-gray-500">{emp.department || '—'}</td>
                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold">{s.present}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {s.half_day > 0
                            ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold">{s.half_day}</span>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {s.leave > 0
                            ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-100 text-blue-800 text-xs font-bold">{s.leave}</span>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {s.absent > 0
                            ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-red-100 text-red-800 text-xs font-bold">{s.absent}</span>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {s.week_off > 0
                            ? <span className="text-xs text-gray-500 font-medium">{s.week_off}</span>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {s.ot > 0
                            ? <span className="text-xs font-bold text-brand-600 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-lg">{s.ot.toFixed(1)}h</span>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-3 text-center text-xs text-gray-400">{total}/{daysInMonth(month)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            {[['P', 'Present', 'text-emerald-600'], ['HD', 'Half Day', 'text-amber-600'], ['Leave', 'Leave', 'text-blue-600'], ['Absent', 'Absent', 'text-red-600'], ['WO', 'Week Off', 'text-gray-500'], ['OT', 'Overtime Hours', 'text-brand-600']].map(([short, full, cls]) => (
              <span key={short}><span className={`font-bold ${cls}`}>{short}</span> = {full}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── IMPORT CSV ─────────────────────────────────────────────────────── */}
      {tab === 'import' && (
        <div className="space-y-5">
          {/* Instructions */}
          <div className="card p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center flex-shrink-0">
                <FileText size={18} className="text-brand-600" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-slate-800 mb-1">Import Attendance from CSV</div>
                <p className="text-sm text-slate-500 mb-4">
                  Upload a CSV file exported from your biometric machine or prepared manually.
                  The file must have headers: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">employee_code, date, status, in_time, out_time</code>
                </p>
                <div className="text-xs text-slate-500 mb-4">
                  <strong>Valid status values:</strong> present (P), half_day (HD), absent (A), leave (L), week_off (WO), holiday (HO)
                  <br />
                  <strong>Date format:</strong> YYYY-MM-DD &nbsp;·&nbsp; <strong>Time format:</strong> HH:MM (24h)
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={downloadTemplate}
                    className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-2 rounded-xl cursor-pointer transition-colors">
                    <Download size={14} /> Download Template
                  </button>
                  <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-sm font-semibold bg-brand-500 text-white px-4 py-2 rounded-xl hover:bg-brand-600 cursor-pointer transition-colors">
                    <Upload size={14} /> Choose CSV File
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Preview table */}
          {csvPreview && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <div className="font-bold text-slate-800">Preview — {csvPreview.length} rows</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    <span className="text-emerald-600 font-semibold">{csvPreview.filter(r=>!r._error).length} valid</span>
                    {csvPreview.filter(r=>r._error).length > 0 && <span className="text-red-500 font-semibold ml-2">{csvPreview.filter(r=>r._error).length} errors</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCsvPreview(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer">
                    <X size={15} />
                  </button>
                  <button onClick={importCSV} disabled={csvImporting || !csvPreview.some(r=>!r._error)}
                    className="flex items-center gap-1.5 text-sm font-semibold bg-emerald-500 text-white px-4 py-2 rounded-xl hover:bg-emerald-600 disabled:opacity-50 cursor-pointer">
                    {csvImporting ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    Import {csvPreview.filter(r=>!r._error).length} Records
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Code</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Employee</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                      <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                      <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">In</th>
                      <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Out</th>
                      <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {csvPreview.map((r, i) => (
                      <tr key={i} className={r._error ? 'bg-red-50' : 'hover:bg-slate-50'}>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{r.employee_code}</td>
                        <td className="px-4 py-2.5 text-slate-800 font-medium text-[13px]">{r._empName || <span className="text-red-500 text-xs">Not found</span>}</td>
                        <td className="px-4 py-2.5 text-slate-600 text-[13px]">{r.date}</td>
                        <td className="px-4 py-2.5 text-center">
                          {r._resolvedStatus ? (
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${STATUS_MAP[r._resolvedStatus]?.cell || 'bg-gray-100 text-gray-600'}`}>
                              {STATUS_MAP[r._resolvedStatus]?.short || r._resolvedStatus}
                            </span>
                          ) : <span className="text-red-500 text-xs">{r.status || '—'}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs text-slate-500 font-mono">{r.in_time || '—'}</td>
                        <td className="px-4 py-2.5 text-center text-xs text-slate-500 font-mono">{r.out_time || '—'}</td>
                        <td className="px-4 py-2.5 text-center">
                          {r._error
                            ? <span className="text-[11px] text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg font-medium flex items-center gap-1 justify-center"><AlertCircle size={10}/>{r._error}</span>
                            : <span className="text-[11px] text-emerald-600 font-semibold">✓ OK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
