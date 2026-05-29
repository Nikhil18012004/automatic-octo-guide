import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import {
  CalendarDays, Plus, CheckCircle2, XCircle, Clock,
  RefreshCw, X, Save, ChevronDown, AlertCircle
} from 'lucide-react'

const LEAVE_TYPES = [
  { value: 'el',     label: 'Earned Leave',   short: 'EL',  color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'sl',     label: 'Sick Leave',     short: 'SL',  color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'cl',     label: 'Casual Leave',   short: 'CL',  color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'unpaid', label: 'Unpaid Leave',   short: 'UL',  color: 'bg-red-100 text-red-800 border-red-200' },
]
const LT = Object.fromEntries(LEAVE_TYPES.map(t => [t.value, t]))

const STATUS_STYLE = {
  pending:  'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
}

function initials(n = '') { return n.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase() || '?' }
function fmtDate(d) { return d ? new Date(d+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '' }
function daysBetween(a, b) {
  if (!a || !b) return 0
  const diff = new Date(b) - new Date(a)
  return Math.max(0, Math.round(diff / 86400000) + 1)
}
const GRADIENTS = ['from-brand-500 to-brand-700','from-emerald-500 to-teal-600','from-violet-500 to-purple-700','from-amber-500 to-orange-600','from-cyan-500 to-blue-600','from-rose-500 to-pink-600']
function gradient(s=''){let h=0;for(const c of s)h=((h<<5)-h)+c.charCodeAt(0);return GRADIENTS[Math.abs(h)%GRADIENTS.length]}

const EMPTY_FORM = { employee_id: '', leave_type: 'el', from_date: '', to_date: '', reason: '' }

export default function Leaves({ profile }) {
  const [tab, setTab] = useState('applications')
  const [year, setYear] = useState(new Date().getFullYear())

  const [employees, setEmployees] = useState([])
  const [requests,  setRequests]  = useState([])
  const [balances,  setBalances]  = useState([])

  const [loading, setLoading]   = useState(true)
  const [saving,  setSaving]    = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ ...EMPTY_FORM })
  const [rejectModal, setRejectModal] = useState(null) // { id }
  const [rejectReason, setRejectReason] = useState('')
  const [filterStatus, setFilterStatus] = useState('pending')

  useEffect(() => { fetchAll() }, [])
  useEffect(() => { if (tab === 'balances') fetchBalances() }, [tab, year])

  async function fetchAll() {
    setLoading(true)
    const [{ data: empData }, { data: reqData }] = await Promise.all([
      supabase.from('employees').select('id, full_name, employee_code, department, position').eq('is_active', true).order('full_name'),
      supabase.from('leave_requests').select('*, employee:employees(full_name, employee_code, department)').order('created_at', { ascending: false }),
    ])
    setEmployees(empData || [])
    setRequests(reqData || [])
    setLoading(false)
  }

  async function fetchBalances() {
    const { data } = await supabase.from('leave_balances')
      .select('*, employee:employees(full_name, employee_code, department)')
      .eq('year', year).order('employee_id')
    setBalances(data || [])
  }

  // ── Init balances for all employees ───────────────────────────────────────
  async function initBalances() {
    const existing = new Set(balances.map(b => b.employee_id))
    const toInsert = employees.filter(e => !existing.has(e.id)).map(e => ({
      employee_id: e.id, year, el_total: 12, sl_total: 6, cl_total: 6,
      el_used: 0, sl_used: 0, cl_used: 0,
    }))
    if (toInsert.length === 0) { toast('All employees already initialised'); return }
    const { error } = await supabase.from('leave_balances').insert(toInsert)
    if (error) { toast.error(error.message); return }
    toast.success(`Initialised ${toInsert.length} employees for ${year}`)
    fetchBalances()
  }

  // ── Apply leave ────────────────────────────────────────────────────────────
  async function submitLeave() {
    if (!form.employee_id) { toast.error('Select an employee'); return }
    if (!form.from_date || !form.to_date) { toast.error('Select dates'); return }
    if (form.to_date < form.from_date) { toast.error('End date must be after start date'); return }
    const days = daysBetween(form.from_date, form.to_date)
    setSaving(true)
    const { error } = await supabase.from('leave_requests').insert({
      ...form, days, status: 'pending',
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Leave applied successfully')
    setShowForm(false)
    setForm({ ...EMPTY_FORM })
    fetchAll()
  }

  // ── Approve ────────────────────────────────────────────────────────────────
  async function approveRequest(req) {
    setSaving(true)
    await supabase.from('leave_requests').update({
      status: 'approved', approved_by: profile?.id, approved_at: new Date().toISOString(),
    }).eq('id', req.id)

    // Update used balance
    if (req.leave_type !== 'unpaid') {
      const field = `${req.leave_type}_used`
      const yr = new Date(req.from_date).getFullYear()
      const { data: bal } = await supabase.from('leave_balances')
        .select('*').eq('employee_id', req.employee_id).eq('year', yr).single()
      if (bal) {
        await supabase.from('leave_balances')
          .update({ [field]: (bal[field] || 0) + Number(req.days) }).eq('id', bal.id)
      } else {
        await supabase.from('leave_balances').insert({
          employee_id: req.employee_id, year: yr,
          el_total: 12, sl_total: 6, cl_total: 6,
          el_used: 0, sl_used: 0, cl_used: 0,
          [field]: Number(req.days),
        })
      }
    }
    setSaving(false)
    toast.success('Leave approved')
    fetchAll()
    if (tab === 'balances') fetchBalances()
  }

  // ── Reject ─────────────────────────────────────────────────────────────────
  async function rejectRequest() {
    if (!rejectModal) return
    await supabase.from('leave_requests').update({
      status: 'rejected', rejection_reason: rejectReason,
      approved_by: profile?.id, approved_at: new Date().toISOString(),
    }).eq('id', rejectModal.id)
    toast.success('Leave rejected')
    setRejectModal(null); setRejectReason('')
    fetchAll()
  }

  // ── Balance cell edit ──────────────────────────────────────────────────────
  async function updateBalance(id, field, value) {
    await supabase.from('leave_balances').update({ [field]: Number(value) }).eq('id', id)
    setBalances(p => p.map(b => b.id === id ? { ...b, [field]: Number(value) } : b))
  }

  function f(field) { return e => setForm(p => ({ ...p, [field]: e.target.value })) }

  const filteredRequests = useMemo(() =>
    filterStatus === 'all' ? requests : requests.filter(r => r.status === filterStatus),
  [requests, filterStatus])

  const days = daysBetween(form.from_date, form.to_date)

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
            <CalendarDays size={20} className="text-blue-600" />
          </div>
          <div>
            <h1 className="page-header">Leave Management</h1>
            <p className="page-sub">Apply, approve and track employee leaves</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAll} className="btn-ghost px-2.5"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
          <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={15} /> Apply Leave</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl w-fit">
        {[{ key: 'applications', label: 'Applications' }, { key: 'balances', label: 'Leave Balances' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all
              ${tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
            {t.key === 'applications' && requests.filter(r=>r.status==='pending').length > 0 && (
              <span className="ml-2 bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {requests.filter(r=>r.status==='pending').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Apply Leave Form */}
      {showForm && (
        <div className="card p-6 border-brand-100">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-900">Apply Leave</h2>
            <button onClick={() => setShowForm(false)} className="btn-ghost p-1.5"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">Employee *</label>
              <select value={form.employee_id} onChange={f('employee_id')} className="input">
                <option value="">Select employee</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}
              </select>
            </div>
            <div>
              <label className="label">Leave Type *</label>
              <select value={form.leave_type} onChange={f('leave_type')} className="input">
                {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">From Date *</label>
              <input type="date" value={form.from_date} onChange={f('from_date')} className="input" />
            </div>
            <div>
              <label className="label">To Date *</label>
              <input type="date" value={form.to_date} onChange={f('to_date')} min={form.from_date} className="input" />
            </div>
            <div>
              <label className="label">Total Days</label>
              <div className="input bg-gray-50 font-bold text-gray-900">{days > 0 ? `${days} day${days > 1 ? 's' : ''}` : '—'}</div>
            </div>
            <div>
              <label className="label">Reason</label>
              <input value={form.reason} onChange={f('reason')} className="input" placeholder="Optional" />
            </div>
          </div>
          <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100">
            <button onClick={submitLeave} disabled={saving} className="btn-primary">
              <Save size={14} />{saving ? 'Submitting…' : 'Submit Leave'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* ── APPLICATIONS TAB ────────────────────────────────────────────── */}
      {tab === 'applications' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {['pending','approved','rejected','all'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all capitalize
                  ${filterStatus === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                {s}
                {s === 'pending' && requests.filter(r=>r.status==='pending').length > 0 && (
                  <span className="ml-1.5 bg-amber-500 text-white text-xs px-1 py-0.5 rounded-full">{requests.filter(r=>r.status==='pending').length}</span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-2">{[...Array(4)].map((_,i)=><div key={i} className="skeleton h-20 rounded-2xl"/>)}</div>
          ) : filteredRequests.length === 0 ? (
            <div className="card p-12 text-center">
              <CalendarDays size={36} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-400 text-sm font-medium">No {filterStatus === 'all' ? '' : filterStatus} leave requests</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRequests.map(req => {
                const lt = LT[req.leave_type]
                const emp = req.employee
                return (
                  <div key={req.id} className="card p-4 hover:shadow-card-hover transition-all">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient(emp?.full_name||'')} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white text-xs font-bold">{initials(emp?.full_name)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900 text-sm">{emp?.full_name}</span>
                          <span className="text-xs text-gray-400 font-mono">{emp?.employee_code}</span>
                          {emp?.department && <span className="text-xs text-gray-400">· {emp.department}</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {lt && <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${lt.color}`}>{lt.label}</span>}
                          <span className="text-xs text-gray-600 font-medium">{fmtDate(req.from_date)} → {fmtDate(req.to_date)}</span>
                          <span className="text-xs text-gray-500">({req.days} day{req.days > 1 ? 's' : ''})</span>
                          {req.reason && <span className="text-xs text-gray-400 italic">"{req.reason}"</span>}
                        </div>
                        {req.status === 'rejected' && req.rejection_reason && (
                          <p className="text-xs text-red-500 mt-1">Rejected: {req.rejection_reason}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-xl border capitalize ${STATUS_STYLE[req.status]}`}>
                          {req.status === 'pending' ? <><Clock size={10} className="inline mr-1" />Pending</> : req.status}
                        </span>
                        {req.status === 'pending' && (
                          <>
                            <button onClick={() => approveRequest(req)} disabled={saving}
                              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-colors">
                              <CheckCircle2 size={12} /> Approve
                            </button>
                            <button onClick={() => { setRejectModal(req); setRejectReason('') }}
                              className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-xl transition-colors">
                              <XCircle size={12} /> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── BALANCES TAB ────────────────────────────────────────────────── */}
      {tab === 'balances' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
              <span className="text-sm font-semibold text-gray-700">Year:</span>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className="border-0 text-sm font-bold bg-transparent focus:outline-none">
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button onClick={initBalances} className="btn-ghost text-sm">
              <Plus size={13} /> Init Missing Employees
            </button>
            <p className="text-xs text-gray-400">{balances.length} of {employees.length} employees initialised</p>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[180px]">Employee</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-emerald-600 uppercase tracking-wider" colSpan={2}>EL</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-blue-600 uppercase tracking-wider" colSpan={2}>SL</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-amber-600 uppercase tracking-wider" colSpan={2}>CL</th>
                  </tr>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th></th>
                    {['EL Total','EL Used','SL Total','SL Used','CL Total','CL Used'].map(h=>(
                      <th key={h} className="px-3 py-2 text-center text-xs text-gray-400 font-medium">{h.split(' ')[1]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {balances.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">
                      No balances for {year}. Click "Init Missing Employees" to create them.
                    </td></tr>
                  ) : balances.map(b => {
                    const emp = b.employee
                    const elLeft = b.el_total - b.el_used
                    const slLeft = b.sl_total - b.sl_used
                    const clLeft = b.cl_total - b.cl_used
                    return (
                      <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${gradient(emp?.full_name||'')} flex items-center justify-center`}>
                              <span className="text-white text-xs font-bold">{initials(emp?.full_name)}</span>
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 text-sm">{emp?.full_name}</div>
                              <div className="text-xs text-gray-400 font-mono">{emp?.employee_code}</div>
                            </div>
                          </div>
                        </td>
                        {/* EL */}
                        <td className="px-2 py-3 text-center">
                          <input type="number" min="0" step="0.5" value={b.el_total}
                            onChange={e => updateBalance(b.id,'el_total',e.target.value)}
                            className="w-14 text-center text-xs border border-gray-200 rounded-lg px-1 py-1 focus:outline-none focus:border-brand-400" />
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className={`text-xs font-bold px-2 py-1 rounded-lg ${elLeft >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                            {b.el_used}/{b.el_total}
                          </span>
                        </td>
                        {/* SL */}
                        <td className="px-2 py-3 text-center">
                          <input type="number" min="0" step="0.5" value={b.sl_total}
                            onChange={e => updateBalance(b.id,'sl_total',e.target.value)}
                            className="w-14 text-center text-xs border border-gray-200 rounded-lg px-1 py-1 focus:outline-none focus:border-brand-400" />
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className={`text-xs font-bold px-2 py-1 rounded-lg ${slLeft >= 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-600'}`}>
                            {b.sl_used}/{b.sl_total}
                          </span>
                        </td>
                        {/* CL */}
                        <td className="px-2 py-3 text-center">
                          <input type="number" min="0" step="0.5" value={b.cl_total}
                            onChange={e => updateBalance(b.id,'cl_total',e.target.value)}
                            className="w-14 text-center text-xs border border-gray-200 rounded-lg px-1 py-1 focus:outline-none focus:border-brand-400" />
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className={`text-xs font-bold px-2 py-1 rounded-lg ${clLeft >= 0 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'}`}>
                            {b.cl_used}/{b.cl_total}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-gray-400">Total column is editable — click a value to change the annual entitlement. Used/Total shown in each cell.</p>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-900 mb-1">Reject Leave Request</h3>
            <p className="text-sm text-gray-500 mb-4">Provide a reason for rejection (optional).</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              rows={3} className="input resize-none w-full mb-4" placeholder="Reason for rejection…" />
            <div className="flex gap-3">
              <button onClick={rejectRequest} className="btn-primary bg-red-500 hover:bg-red-600 border-red-600">
                <XCircle size={14} /> Reject Leave
              </button>
              <button onClick={() => setRejectModal(null)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
