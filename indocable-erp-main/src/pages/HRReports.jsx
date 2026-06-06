import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabase'
import { RefreshCw, Users, TrendingUp, Calendar, BarChart2, IndianRupee, Clock } from 'lucide-react'
import { fmtINR } from '../lib/format'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function todayISO() { return new Date().toISOString().slice(0,10) }

// Pure-CSS horizontal bar
function Bar({ pct, color = 'bg-brand-500', height = 'h-2' }) {
  return (
    <div className={`w-full bg-slate-100 rounded-full ${height} overflow-hidden`}>
      <div className={`${color} ${height} rounded-full transition-all duration-500`} style={{ width: `${Math.min(100, pct || 0)}%` }} />
    </div>
  )
}

// Vertical bar chart (CSS only)
function VBar({ value, max, label, sub, color = 'bg-brand-500' }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-[40px]">
      <div className="text-[11px] font-bold text-slate-700">{fmtINR(value)}</div>
      <div className="w-full flex items-end justify-center" style={{ height: 80 }}>
        <div className={`w-full max-w-[40px] rounded-t-lg ${color} transition-all duration-500`} style={{ height: `${pct}%`, minHeight: value > 0 ? 4 : 0 }} />
      </div>
      <div className="text-[11px] font-semibold text-slate-600 text-center leading-tight">{label}</div>
      {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, color = 'text-brand-600', bg = 'bg-brand-50' }) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={20} className={color} />
      </div>
      <div>
        <div className="text-xl font-bold text-slate-800">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
        {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

export default function HRReports({ profile }) {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`

  const [tab, setTab] = useState('overview')
  const [attMonth, setAttMonth] = useState(currentMonth)
  const [employees, setEmployees] = useState([])
  const [attendance, setAttendance] = useState([])
  const [payrollData, setPayrollData] = useState([])
  const [leaves, setLeaves] = useState([])
  const [balances, setBalances] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])
  useEffect(() => { if (tab === 'attendance') fetchAttendance() }, [tab, attMonth])

  async function fetchAll() {
    setLoading(true)
    // Last 6 months payroll + employees + current month attendance + leaves this year
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const sixMonthStr  = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth()+1).padStart(2,'0')}`
    const yearStr      = now.getFullYear().toString()

    const [{ data: empData }, { data: payData }, { data: leafData }, { data: balData }] = await Promise.all([
      supabase.from('employees').select('id,full_name,department,position,is_active,date_of_joining,contract_type').order('full_name'),
      supabase.from('payroll').select('employee_id,month,gross,net_pay,pf_deduction,esi_deduction,status').gte('month', sixMonthStr).order('month'),
      supabase.from('leave_requests').select('employee_id,leave_type,days,status').gte('from_date', `${yearStr}-01-01`),
      supabase.from('leave_balances').select('*').eq('year', now.getFullYear()),
    ])
    setEmployees(empData || [])
    setPayrollData(payData || [])
    setLeaves(leafData || [])
    setBalances(balData || [])
    setLoading(false)
  }

  async function fetchAttendance() {
    const [y, m] = attMonth.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    const { data } = await supabase.from('attendance')
      .select('employee_id,status,ot_hours')
      .gte('date', `${attMonth}-01`)
      .lte('date', `${attMonth}-${String(lastDay).padStart(2,'0')}`)
    setAttendance(data || [])
  }

  // ── Derived: headcount ────────────────────────────────────────────────────
  const active   = employees.filter(e => e.is_active)
  const inactive = employees.filter(e => !e.is_active)

  const byDept = useMemo(() => {
    const m = {}
    active.forEach(e => {
      const d = e.department || 'Unassigned'
      m[d] = (m[d] || 0) + 1
    })
    return Object.entries(m).sort((a,b) => b[1]-a[1])
  }, [active])

  const byPosition = useMemo(() => {
    const m = {}
    active.forEach(e => { const p = e.position || 'Unassigned'; m[p] = (m[p] || 0) + 1 })
    return Object.entries(m).sort((a,b) => b[1]-a[1])
  }, [active])

  const byContract = useMemo(() => {
    const m = { permanent: 0, contractual: 0, daily_wage: 0 }
    active.forEach(e => { if (e.contract_type in m) m[e.contract_type]++ })
    return m
  }, [active])

  // ── Derived: payroll trend ────────────────────────────────────────────────
  const payByMonth = useMemo(() => {
    const m = {}
    payrollData.forEach(r => {
      if (!m[r.month]) m[r.month] = { gross: 0, net: 0, pf: 0, esi: 0 }
      m[r.month].gross += parseFloat(r.gross) || 0
      m[r.month].net   += parseFloat(r.net_pay) || 0
      m[r.month].pf    += parseFloat(r.pf_deduction) || 0
      m[r.month].esi   += parseFloat(r.esi_deduction) || 0
    })
    // Ensure last 6 months in order
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d  = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      months.push({ ym, label: MONTHS[d.getMonth()], ...(m[ym] || { gross: 0, net: 0, pf: 0, esi: 0 }) })
    }
    return months
  }, [payrollData])

  const maxPayroll = useMemo(() => Math.max(...payByMonth.map(m => m.gross), 1), [payByMonth])

  // ── Derived: attendance summary for selected month ─────────────────────────
  const attSummary = useMemo(() => {
    const byEmp = {}
    attendance.forEach(r => {
      if (!byEmp[r.employee_id]) byEmp[r.employee_id] = { present: 0, half_day: 0, leave: 0, absent: 0, ot: 0, total: 0 }
      const s = byEmp[r.employee_id]
      if (r.status in s) s[r.status]++
      s.ot    += parseFloat(r.ot_hours) || 0
      s.total++
    })

    // By department
    const byDeptAtt = {}
    active.forEach(e => {
      const d   = e.department || 'Unassigned'
      const s   = byEmp[e.id] || { present: 0, half_day: 0, leave: 0, absent: 0, ot: 0, total: 0 }
      if (!byDeptAtt[d]) byDeptAtt[d] = { present: 0, half_day: 0, leave: 0, absent: 0, ot: 0, total: 0, count: 0 }
      Object.keys(byDeptAtt[d]).forEach(k => { if (k !== 'count') byDeptAtt[d][k] += s[k] || 0 })
      byDeptAtt[d].count++
    })

    // Top OT earners
    const otList = active.map(e => ({ ...e, ot: byEmp[e.id]?.ot || 0 })).filter(e => e.ot > 0).sort((a,b) => b.ot - a.ot).slice(0, 8)

    // Overall totals
    const totals = { present: 0, half_day: 0, leave: 0, absent: 0, ot: 0, total: 0 }
    Object.values(byEmp).forEach(s => { Object.keys(totals).forEach(k => totals[k] += s[k] || 0) })

    return { byDeptAtt, otList, totals, byEmp }
  }, [attendance, active])

  // ── Derived: leave summary ────────────────────────────────────────────────
  const leaveStats = useMemo(() => {
    const approved = leaves.filter(l => l.status === 'approved')
    const byType = { el: 0, sl: 0, cl: 0, unpaid: 0 }
    approved.forEach(l => { if (l.leave_type in byType) byType[l.leave_type] += l.days || 0 })
    const totalUsed  = balances.reduce((s,b) => s + (b.el_used||0) + (b.sl_used||0) + (b.cl_used||0), 0)
    const totalAlloc = balances.reduce((s,b) => s + (b.el_total||0) + (b.sl_total||0) + (b.cl_total||0), 0)
    return { byType, totalUsed, totalAlloc, approved: approved.length, pending: leaves.filter(l=>l.status==='pending').length }
  }, [leaves, balances])

  function shiftAttMonth(n) {
    const [y, m] = attMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + n, 1)
    setAttMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
  }

  const TABS = [
    { key: 'overview',   label: 'Overview',        icon: BarChart2 },
    { key: 'payroll',    label: 'Payroll Trends',   icon: IndianRupee },
    { key: 'attendance', label: 'Attendance',       icon: Calendar },
    { key: 'leaves',     label: 'Leave Summary',    icon: Clock },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center">
          <TrendingUp size={20} className="text-violet-600" />
        </div>
        <div>
          <h1 className="page-header">HR Reports</h1>
          <p className="page-sub">Workforce analytics and insights</p>
        </div>
        <button onClick={fetchAll} className="ml-auto btn-ghost px-2.5">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit mb-6">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer
              ${tab === t.key ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
            <t.icon size={13} />{t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_,i) => <div key={i} className="card p-4 space-y-2"><div className="skeleton h-7 w-12 rounded-md"/><div className="skeleton h-4 w-24 rounded-md"/></div>)}
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {[...Array(2)].map((_,i) => (
              <div key={i} className="card p-5 space-y-3">
                <div className="skeleton h-4 w-40 rounded-md"/>
                {[...Array(4)].map((_,j) => <div key={j} className="skeleton h-4 w-full rounded-md"/>)}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* ── OVERVIEW ────────────────────────────────────────────────────── */}
          {tab === 'overview' && (
            <div className="space-y-5">
              {/* Stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={Users}       label="Active Employees"   value={active.length}   sub={`${inactive.length} inactive`}   color="text-brand-600"   bg="bg-brand-50" />
                <StatCard icon={TrendingUp}  label="Permanent Staff"    value={byContract.permanent}  sub="permanent contract"  color="text-emerald-600" bg="bg-emerald-50" />
                <StatCard icon={Calendar}    label="Contractual"        value={byContract.contractual} sub="on contract"        color="text-amber-600"  bg="bg-amber-50" />
                <StatCard icon={IndianRupee} label="Daily Wage"         value={byContract.daily_wage}  sub="daily wage"         color="text-violet-600" bg="bg-violet-50" />
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                {/* By Department */}
                <div className="card p-5">
                  <div className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Users size={15} className="text-slate-400" /> Headcount by Department
                  </div>
                  {byDept.length === 0 ? <div className="text-slate-400 text-sm text-center py-6">No department data</div> : (
                    <div className="space-y-3">
                      {byDept.map(([dept, count]) => (
                        <div key={dept}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[13px] text-slate-700 font-medium truncate max-w-[180px]">{dept}</span>
                            <span className="text-[13px] font-bold text-slate-800 ml-2">{count}</span>
                          </div>
                          <Bar pct={(count / active.length) * 100} color="bg-brand-500" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* By Position */}
                <div className="card p-5">
                  <div className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <BarChart2 size={15} className="text-slate-400" /> Headcount by Role
                  </div>
                  {byPosition.length === 0 ? <div className="text-slate-400 text-sm text-center py-6">No data</div> : (
                    <div className="space-y-3">
                      {byPosition.map(([pos, count]) => (
                        <div key={pos}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[13px] text-slate-700 font-medium">{pos}</span>
                            <span className="text-[13px] font-bold text-slate-800">{count}</span>
                          </div>
                          <Bar pct={(count / active.length) * 100} color="bg-violet-500" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── PAYROLL TRENDS ───────────────────────────────────────────────── */}
          {tab === 'payroll' && (
            <div className="space-y-5">
              <div className="card p-5">
                <div className="text-sm font-bold text-slate-700 mb-1">Monthly Payroll (Last 6 Months)</div>
                <div className="text-xs text-slate-400 mb-5">Gross salary disbursed per month</div>
                {payByMonth.every(m => m.gross === 0) ? (
                  <div className="text-center py-8 text-slate-400 text-sm">No payroll data yet. Generate payroll for past months to see trends.</div>
                ) : (
                  <div className="flex items-end gap-3 px-2" style={{ height: 140 }}>
                    {payByMonth.map(m => (
                      <VBar key={m.ym} value={m.gross} max={maxPayroll} label={m.label}
                        sub={m.gross > 0 ? fmtINR(m.gross) : '—'}
                        color={m.ym === currentMonth ? 'bg-brand-500' : 'bg-slate-300'} />
                    ))}
                  </div>
                )}
              </div>

              {/* Payroll breakdown table */}
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <div className="text-sm font-bold text-slate-700">Payroll Summary by Month</div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Month</th>
                      <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Gross</th>
                      <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">PF</th>
                      <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">ESI</th>
                      <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Net Pay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payByMonth.map(m => (
                      <tr key={m.ym} className={`hover:bg-slate-50 ${m.ym === currentMonth ? 'bg-brand-50/40' : ''}`}>
                        <td className="px-5 py-3 font-medium text-slate-700">
                          {MONTHS[parseInt(m.ym.split('-')[1])-1]} {m.ym.split('-')[0]}
                          {m.ym === currentMonth && <span className="ml-2 text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-md font-semibold">Current</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">{m.gross > 0 ? fmtINR(m.gross) : '—'}</td>
                        <td className="px-4 py-3 text-right text-red-500">{m.pf > 0 ? fmtINR(m.pf) : '—'}</td>
                        <td className="px-4 py-3 text-right text-red-500">{m.esi > 0 ? fmtINR(m.esi) : '—'}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700">{m.net > 0 ? fmtINR(m.net) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── ATTENDANCE ───────────────────────────────────────────────────── */}
          {tab === 'attendance' && (
            <div className="space-y-5">
              {/* Month picker */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-sm">
                  <button onClick={() => shiftAttMonth(-1)} className="p-2 hover:bg-slate-50 rounded-l-xl cursor-pointer">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <span className="px-4 text-sm font-bold text-slate-900 min-w-[130px] text-center">
                    {MONTHS[parseInt(attMonth.split('-')[1])-1]} {attMonth.split('-')[0]}
                  </span>
                  <button onClick={() => shiftAttMonth(1)} className="p-2 hover:bg-slate-50 rounded-r-xl cursor-pointer">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              </div>

              {/* Overall stats */}
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {[
                  { label: 'Present Days',  value: attSummary.totals.present,  color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                  { label: 'Half Days',     value: attSummary.totals.half_day, color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-100' },
                  { label: 'Leave Days',    value: attSummary.totals.leave,    color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-100' },
                  { label: 'Absent Days',   value: attSummary.totals.absent,   color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-100' },
                  { label: 'Total OT Hrs',  value: attSummary.totals.ot.toFixed(1) + 'h', color: 'text-brand-700', bg: 'bg-brand-50', border: 'border-brand-100' },
                ].map(c => (
                  <div key={c.label} className={`${c.bg} border ${c.border} rounded-xl px-3 py-3 text-center`}>
                    <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{c.label}</div>
                  </div>
                ))}
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                {/* By department */}
                <div className="card p-5">
                  <div className="text-sm font-bold text-slate-700 mb-4">Attendance by Department</div>
                  {Object.entries(attSummary.byDeptAtt).length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-sm">No attendance data for this month</div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(attSummary.byDeptAtt).sort((a,b)=>b[1].count-a[1].count).map(([dept, s]) => {
                        const pPct = s.total > 0 ? Math.round(((s.present + s.half_day * 0.5) / s.total) * 100) : 0
                        return (
                          <div key={dept}>
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-[13px] font-medium text-slate-700">{dept} <span className="text-slate-400 text-[11px]">({s.count} emp)</span></span>
                              <span className={`text-[12px] font-bold ${pPct >= 80 ? 'text-emerald-600' : pPct >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{pPct}% present</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                              <div className="bg-emerald-500 h-2 transition-all" style={{ width: `${s.total>0?(s.present/s.total)*100:0}%` }} />
                              <div className="bg-amber-400 h-2 transition-all" style={{ width: `${s.total>0?(s.half_day/s.total)*100:0}%` }} />
                              <div className="bg-blue-400 h-2 transition-all"  style={{ width: `${s.total>0?(s.leave/s.total)*100:0}%` }} />
                              <div className="bg-red-400 h-2 transition-all"   style={{ width: `${s.total>0?(s.absent/s.total)*100:0}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Top OT earners */}
                <div className="card p-5">
                  <div className="text-sm font-bold text-slate-700 mb-4">Top Overtime Workers</div>
                  {attSummary.otList.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-sm">No overtime recorded this month</div>
                  ) : (
                    <div className="space-y-2.5">
                      {attSummary.otList.map((e, i) => (
                        <div key={e.id} className="flex items-center gap-3">
                          <span className="text-[11px] font-bold text-slate-300 w-5 text-right">{i+1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold text-slate-700 truncate">{e.full_name}</div>
                            <div className="text-[11px] text-slate-400">{e.department}</div>
                          </div>
                          <span className="text-[13px] font-bold text-brand-600 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-lg">{e.ot.toFixed(1)}h</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── LEAVES ──────────────────────────────────────────────────────── */}
          {tab === 'leaves' && (
            <div className="space-y-5">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Approved (This Year)',  value: leaveStats.approved,  color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                  { label: 'Pending Requests',      value: leaveStats.pending,   color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-100' },
                  { label: 'Total Days Used',       value: leaveStats.totalUsed, color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-100' },
                  { label: 'Total Days Allocated',  value: leaveStats.totalAlloc,color: 'text-slate-700',   bg: 'bg-slate-50',   border: 'border-slate-200' },
                ].map(c => (
                  <div key={c.label} className={`${c.bg} border ${c.border} rounded-xl px-4 py-3 text-center`}>
                    <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{c.label}</div>
                  </div>
                ))}
              </div>

              {/* Leave type breakdown */}
              <div className="card p-5">
                <div className="text-sm font-bold text-slate-700 mb-4">Leave Days Used by Type (This Year)</div>
                <div className="space-y-4">
                  {[
                    { key: 'el',     label: 'Earned Leave',  color: 'bg-emerald-500', total: balances.reduce((s,b)=>s+(b.el_total||0),0), used: balances.reduce((s,b)=>s+(b.el_used||0),0) },
                    { key: 'sl',     label: 'Sick Leave',    color: 'bg-blue-500',    total: balances.reduce((s,b)=>s+(b.sl_total||0),0), used: balances.reduce((s,b)=>s+(b.sl_used||0),0) },
                    { key: 'cl',     label: 'Casual Leave',  color: 'bg-amber-500',   total: balances.reduce((s,b)=>s+(b.cl_total||0),0), used: balances.reduce((s,b)=>s+(b.cl_used||0),0) },
                    { key: 'unpaid', label: 'Unpaid Leave',  color: 'bg-red-400',     total: null, used: leaveStats.byType.unpaid },
                  ].map(t => (
                    <div key={t.key}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[13px] font-medium text-slate-700">{t.label}</span>
                        <span className="text-[12px] text-slate-500">
                          {t.total !== null ? `${t.used} / ${t.total} days` : `${t.used} days`}
                        </span>
                      </div>
                      {t.total !== null && t.total > 0 ? (
                        <Bar pct={(t.used / t.total) * 100} color={t.color} height="h-2" />
                      ) : (
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div className={`${t.color} h-2 rounded-full`} style={{ width: t.used > 0 ? '100%' : '0%' }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Employee leave balance table */}
              {balances.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100">
                    <div className="text-sm font-bold text-slate-700">Employee Leave Balances ({now.getFullYear()})</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Employee</th>
                          <th className="text-center px-3 py-3 text-[11px] font-semibold text-emerald-600 uppercase tracking-wide">EL</th>
                          <th className="text-center px-3 py-3 text-[11px] font-semibold text-blue-600 uppercase tracking-wide">SL</th>
                          <th className="text-center px-3 py-3 text-[11px] font-semibold text-amber-600 uppercase tracking-wide">CL</th>
                          <th className="text-center px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {balances.map(b => {
                          const emp = employees.find(e => e.id === b.employee_id)
                          const remaining = (b.el_total - b.el_used) + (b.sl_total - b.sl_used) + (b.cl_total - b.cl_used)
                          return (
                            <tr key={b.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-medium text-slate-800">{emp?.full_name || '—'}</td>
                              <td className="px-3 py-3 text-center text-[12px]">
                                <span className={`font-bold ${b.el_used >= b.el_total ? 'text-red-500' : 'text-emerald-700'}`}>{b.el_used}</span>
                                <span className="text-slate-400">/{b.el_total}</span>
                              </td>
                              <td className="px-3 py-3 text-center text-[12px]">
                                <span className={`font-bold ${b.sl_used >= b.sl_total ? 'text-red-500' : 'text-blue-700'}`}>{b.sl_used}</span>
                                <span className="text-slate-400">/{b.sl_total}</span>
                              </td>
                              <td className="px-3 py-3 text-center text-[12px]">
                                <span className={`font-bold ${b.cl_used >= b.cl_total ? 'text-red-500' : 'text-amber-700'}`}>{b.cl_used}</span>
                                <span className="text-slate-400">/{b.cl_total}</span>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span className={`text-[12px] font-bold px-2 py-0.5 rounded-lg ${remaining > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                                  {remaining} days left
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
