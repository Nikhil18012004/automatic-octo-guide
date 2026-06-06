import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import {
  IndianRupee, Calculator, CheckCircle2, ChevronLeft, ChevronRight,
  Printer, X, RefreshCw, Download, AlertCircle, Clock
} from 'lucide-react'
import { gradient } from '../lib/format'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function initials(n = '') { return n.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?' }

function workingDaysInMonth(year, month) {
  // Count Mon–Sat (exclude Sunday as default)
  let count = 0
  const days = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month, d).getDay()
    if (dow !== 0) count++ // exclude Sunday
  }
  return count
}

function calcPayroll(emp, attendance, advances) {
  const totalDays   = attendance.total_days   || 0
  const presentDays = attendance.present_days || 0
  const halfDays    = attendance.half_days    || 0
  const otHours     = attendance.ot_hours     || 0

  const salary   = parseFloat(emp.monthly_salary) || 0
  const otRate   = parseFloat(emp.overtime_rate)  || 0

  // Basic = proportional to attendance (full + half*0.5)
  const effectiveDays = presentDays + halfDays * 0.5
  const basic    = totalDays > 0 ? Math.round((effectiveDays / totalDays) * salary) : 0
  const otAmount = Math.round(otHours * otRate)
  const gross    = basic + otAmount

  // PF = 12% of basic, capped at ₹15,000 basic
  const pfBase   = Math.min(basic, 15000)
  const pf       = Math.round(pfBase * 0.12)

  // ESI = 0.75% if gross < ₹21,000
  const esi      = gross < 21000 ? Math.round(gross * 0.0075) : 0

  // Advances for this month
  const advance  = advances.reduce((s, a) => s + (parseFloat(a.deducted_amount) || 0), 0)

  const net = Math.max(0, gross - pf - esi - advance)

  return { basic, otAmount, gross, pf, esi, advance: Math.round(advance), net,
           effectiveDays: Math.round(effectiveDays * 10) / 10, otHours, totalDays }
}

function Chip({ label, value, sub }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-center min-w-[80px]">
      <div className="text-[11px] text-slate-500 mb-0.5">{label}</div>
      <div className="text-[15px] font-bold text-slate-800">{value}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function SalarySlip({ row, month, year, onClose }) {
  const slipRef = useRef()
  const monthLabel = `${MONTHS[month]} ${year}`

  function handlePrint() {
    const content = slipRef.current.innerHTML
    const w = window.open('', '', 'width=900,height=700')
    w.document.write(`
      <html><head><title>Salary Slip – ${row.emp.full_name} – ${monthLabel}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; font-size: 13px; }
        h1 { font-size: 20px; margin: 0; } h2 { font-size: 15px; color: #555; margin: 4px 0 0; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
        .row { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding: 5px 0; }
        .label { color: #555; } .value { font-weight: 600; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 15px; font-weight: 700; border-top: 2px solid #333; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
        .section { margin: 16px 0; padding: 12px; border: 1px solid #ddd; border-radius: 8px; }
        .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin-bottom: 10px; }
        .sign { margin-top: 48px; display: flex; justify-content: space-between; }
        .sign div { text-align: center; } .sign span { display: block; margin-top: 40px; border-top: 1px solid #333; padding-top: 4px; font-size: 11px; }
      </style>
      </head><body>${content}</body></html>
    `)
    w.document.close()
    w.focus()
    w.print()
    w.close()
  }

  const calc = row.calc

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Actions bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <span className="font-bold text-slate-800">Salary Slip</span>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 text-[12px] font-semibold bg-brand-500 text-white px-3 py-1.5 rounded-lg hover:bg-brand-600 cursor-pointer">
              <Printer size={13} /> Print
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Slip content */}
        <div ref={slipRef} className="p-6">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'20px'}}>
            <div>
              <h1 style={{fontSize:'20px',margin:0,fontWeight:800}}>Indocable Industries</h1>
              <h2 style={{fontSize:'13px',color:'#666',marginTop:'2px',fontWeight:400}}>Salary Slip — {monthLabel}</h2>
            </div>
            <div style={{textAlign:'right',fontSize:'11px',color:'#888'}}>
              <div>Employee Code: <strong>{row.emp.employee_code || '—'}</strong></div>
              <div>Issued: {new Date().toLocaleDateString('en-IN')}</div>
            </div>
          </div>

          {/* Employee details */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px',padding:'12px',background:'#f8f8f8',borderRadius:'8px',marginBottom:'16px'}}>
            {[
              ['Name', row.emp.full_name],
              ['Department', row.emp.department || '—'],
              ['Designation', row.emp.position || '—'],
              ['Contract', row.emp.contract_type || '—'],
              ['Working Days', calc.totalDays],
              ['Days Present', calc.effectiveDays],
            ].map(([l, v]) => (
              <div key={l} style={{display:'flex',gap:'6px',fontSize:'12px',padding:'3px 0'}}>
                <span style={{color:'#888',minWidth:'100px'}}>{l}:</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>

          {/* Earnings & Deductions */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
            <div style={{border:'1px solid #e5e7eb',borderRadius:'8px',padding:'12px'}}>
              <div style={{fontSize:'11px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'#888',marginBottom:'10px'}}>Earnings</div>
              {[
                ['Basic Salary', calc.basic],
                ...(calc.otAmount > 0 ? [['OT Amount', calc.otAmount]] : []),
              ].map(([l, v]) => (
                <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid #f3f4f6',fontSize:'12px'}}>
                  <span style={{color:'#555'}}>{l}</span>
                  <strong>₹{v.toLocaleString('en-IN')}</strong>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0 0',fontWeight:700,fontSize:'13px'}}>
                <span>Gross</span>
                <span>₹{calc.gross.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div style={{border:'1px solid #e5e7eb',borderRadius:'8px',padding:'12px'}}>
              <div style={{fontSize:'11px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'#888',marginBottom:'10px'}}>Deductions</div>
              {[
                ['PF (12%)', calc.pf],
                ...(calc.esi > 0 ? [['ESI (0.75%)', calc.esi]] : []),
                ...(calc.advance > 0 ? [['Advance Recovery', calc.advance]] : []),
                ...(row.tds > 0 ? [['TDS', row.tds]] : []),
                ...(row.other_deductions > 0 ? [['Other', row.other_deductions]] : []),
              ].map(([l, v]) => (
                <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid #f3f4f6',fontSize:'12px'}}>
                  <span style={{color:'#555'}}>{l}</span>
                  <strong style={{color:'#dc2626'}}>₹{(v||0).toLocaleString('en-IN')}</strong>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0 0',fontWeight:700,fontSize:'13px'}}>
                <span>Total Deductions</span>
                <span style={{color:'#dc2626'}}>₹{(calc.pf+calc.esi+calc.advance+(row.tds||0)+(row.other_deductions||0)).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Net Pay */}
          <div style={{marginTop:'16px',padding:'14px',background:'#0b1120',borderRadius:'10px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{color:'#aaa',fontWeight:600,fontSize:'13px'}}>NET PAY</span>
            <span style={{color:'#fff',fontWeight:800,fontSize:'22px'}}>₹{calc.net.toLocaleString('en-IN')}</span>
          </div>

          {/* Signature */}
          <div style={{display:'flex',justifyContent:'space-between',marginTop:'48px',fontSize:'11px',color:'#888'}}>
            <div style={{textAlign:'center'}}>
              <div style={{borderTop:'1px solid #999',width:'120px',paddingTop:'4px',marginTop:'32px'}}>Employee Signature</div>
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{borderTop:'1px solid #999',width:'120px',paddingTop:'4px',marginTop:'32px'}}>Authorised Signatory</div>
            </div>
          </div>

          <div style={{textAlign:'center',marginTop:'24px',fontSize:'10px',color:'#bbb'}}>
            This is a computer-generated salary slip and does not require a physical signature.
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Payroll({ profile }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year,  setYear]  = useState(now.getFullYear())

  const [employees, setEmployees] = useState([])
  const [payrollRows, setPayrollRows] = useState([]) // [{ emp, calc, saved, tds, other_deductions, status, paid_date }]
  const [loading,  setLoading]  = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [slipRow,  setSlipRow]  = useState(null)

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthLabel = `${MONTHS[month]} ${year}`
  const totalWorkingDays = workingDaysInMonth(year, month)

  useEffect(() => { fetchEmployees() }, [])
  useEffect(() => { if (employees.length) fetchPayroll() }, [employees, month, year])

  async function fetchEmployees() {
    const { data } = await supabase.from('employees').select('*').eq('is_active', true).order('full_name')
    setEmployees(data || [])
  }

  async function fetchPayroll() {
    setLoading(true)
    const empIds = employees.map(e => e.id)
    if (!empIds.length) { setLoading(false); return }

    const [{ data: saved }, { data: advances }] = await Promise.all([
      supabase.from('payroll').select('*').eq('month', monthStr).in('employee_id', empIds),
      supabase.from('salary_advances').select('*')
        .in('employee_id', empIds)
        .gte('date', `${monthStr}-01`)
        .lte('date', `${monthStr}-31`),
    ])

    const savedMap   = Object.fromEntries((saved || []).map(r => [r.employee_id, r]))
    const advanceMap = {}
    ;(advances || []).forEach(a => {
      if (!advanceMap[a.employee_id]) advanceMap[a.employee_id] = []
      advanceMap[a.employee_id].push(a)
    })

    // If saved rows exist, load them; otherwise show empty (user must generate)
    if (saved && saved.length > 0) {
      const rows = employees.map(emp => {
        const s = savedMap[emp.id]
        if (!s) return null
        const calc = {
          basic: s.basic_salary, otAmount: s.ot_amount, gross: s.gross,
          pf: s.pf_deduction, esi: s.esi_deduction, advance: s.advance_deduction,
          net: s.net_pay, effectiveDays: s.present_days, otHours: s.ot_hours,
          totalDays: s.working_days,
        }
        return { emp, calc, saved: true, tds: s.tds_deduction||0, other_deductions: s.other_deductions||0, status: s.status, paid_date: s.paid_date }
      }).filter(Boolean)
      setPayrollRows(rows)
    } else {
      setPayrollRows([])
    }
    setLoading(false)
  }

  async function generatePayroll() {
    setGenerating(true)
    try {
      // Fetch attendance summary for this month
      const empIds = employees.map(e => e.id)
      const start  = `${monthStr}-01`
      const end    = `${monthStr}-31`

      const [{ data: attData }, { data: advances }] = await Promise.all([
        supabase.from('attendance')
          .select('employee_id, status, ot_hours')
          .in('employee_id', empIds)
          .gte('date', start)
          .lte('date', end),
        supabase.from('salary_advances').select('*')
          .in('employee_id', empIds)
          .gte('date', start)
          .lte('date', end),
      ])

      const advanceMap = {}
      ;(advances || []).forEach(a => {
        if (!advanceMap[a.employee_id]) advanceMap[a.employee_id] = []
        advanceMap[a.employee_id].push(a)
      })

      // Aggregate attendance per employee
      const attMap = {}
      ;(attData || []).forEach(a => {
        if (!attMap[a.employee_id]) attMap[a.employee_id] = { present_days: 0, half_days: 0, ot_hours: 0, total_days: totalWorkingDays }
        if (a.status === 'present')   attMap[a.employee_id].present_days++
        if (a.status === 'half_day')  attMap[a.employee_id].half_days++
        if (a.ot_hours > 0)           attMap[a.employee_id].ot_hours += parseFloat(a.ot_hours) || 0
      })

      const rows = employees.map(emp => {
        const att  = attMap[emp.id] || { present_days: 0, half_days: 0, ot_hours: 0, total_days: totalWorkingDays }
        const calc = calcPayroll(emp, att, advanceMap[emp.id] || [])
        return { emp, calc, saved: false, tds: 0, other_deductions: 0, status: 'draft', paid_date: null }
      })

      setPayrollRows(rows)
      toast.success(`Payroll generated for ${monthLabel}`)
    } catch (err) {
      toast.error('Failed to generate payroll')
      console.error(err)
    }
    setGenerating(false)
  }

  async function savePayroll() {
    if (!payrollRows.length) return
    setSaving(true)
    try {
      const upserts = payrollRows.map(row => ({
        employee_id:        row.emp.id,
        month:              monthStr,
        working_days:       row.calc.totalDays,
        present_days:       row.calc.effectiveDays,
        ot_hours:           row.calc.otHours,
        basic_salary:       row.calc.basic,
        ot_amount:          row.calc.otAmount,
        gross:              row.calc.gross,
        pf_deduction:       row.calc.pf,
        esi_deduction:      row.calc.esi,
        advance_deduction:  row.calc.advance,
        tds_deduction:      row.tds || 0,
        other_deductions:   row.other_deductions || 0,
        net_pay:            Math.max(0, row.calc.gross - row.calc.pf - row.calc.esi - row.calc.advance - (row.tds||0) - (row.other_deductions||0)),
        status:             row.status || 'draft',
        paid_date:          row.paid_date || null,
      }))

      const { error } = await supabase.from('payroll').upsert(upserts, { onConflict: 'employee_id,month' })
      if (error) throw error
      toast.success('Payroll saved')
      fetchPayroll()
    } catch (err) {
      toast.error('Save failed: ' + err.message)
    }
    setSaving(false)
  }

  async function markPaid(empId) {
    const paidDate = new Date().toISOString().slice(0,10)
    const { data, error } = await supabase.from('payroll')
      .update({ status: 'paid', paid_date: paidDate })
      .eq('employee_id', empId).eq('month', monthStr)
      .select()
    if (error) { toast.error('Failed to mark paid'); return }
    if (!data || data.length === 0) { toast.error('Save the payroll before marking it paid'); return }
    setPayrollRows(rows => rows.map(r => r.emp.id === empId ? { ...r, status: 'paid', paid_date: paidDate } : r))
    toast.success('Marked as paid')
  }

  function navMonth(dir) {
    setMonth(m => {
      const nm = m + dir
      if (nm < 0) { setYear(y => y - 1); return 11 }
      if (nm > 11) { setYear(y => y + 1); return 0 }
      return nm
    })
  }

  function updateRow(empId, field, value) {
    setPayrollRows(rows => rows.map(r => {
      if (r.emp.id !== empId) return r
      const updated = { ...r, [field]: parseFloat(value) || 0 }
      // Recalculate net
      const net = Math.max(0, updated.calc.gross - updated.calc.pf - updated.calc.esi - updated.calc.advance - (updated.tds||0) - (updated.other_deductions||0))
      updated.calc = { ...updated.calc, net }
      return updated
    }))
  }

  const totals = useMemo(() => payrollRows.reduce((acc, r) => ({
    gross: acc.gross + r.calc.gross,
    pf:    acc.pf    + r.calc.pf,
    esi:   acc.esi   + r.calc.esi,
    net:   acc.net   + r.calc.net,
  }), { gross: 0, pf: 0, esi: 0, net: 0 }), [payrollRows])

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
            <IndianRupee size={20} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="page-header">Payroll</h1>
            <p className="page-sub">Monthly salary calculation & disbursement · {monthLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Month nav */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 py-1.5">
            <button onClick={() => navMonth(-1)} className="p-1 rounded-lg hover:bg-gray-100 cursor-pointer text-gray-500">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-gray-700 px-2 min-w-[130px] text-center">{monthLabel}</span>
            <button onClick={() => navMonth(1)} className="p-1 rounded-lg hover:bg-gray-100 cursor-pointer text-gray-500">
              <ChevronRight size={16} />
            </button>
          </div>

          {payrollRows.length > 0 && (
            <button onClick={savePayroll} disabled={saving} className="btn-secondary">
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Save
            </button>
          )}

          <button onClick={generatePayroll} disabled={generating} className="btn-primary">
            {generating ? <span className="spinner-sm" /> : <Calculator size={14} />}
            {payrollRows.length ? 'Regenerate' : 'Generate Payroll'}
          </button>
        </div>
      </div>

      {/* Summary stat cards */}
      {payrollRows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          {[
            { label: 'Employees',    value: payrollRows.length,                            bg: 'bg-gray-50    border-gray-100',    text: 'text-gray-800'    },
            { label: 'Working Days', value: totalWorkingDays,                              bg: 'bg-blue-50    border-blue-100',    text: 'text-blue-700'    },
            { label: 'Total Gross',  value: `₹${totals.gross.toLocaleString('en-IN')}`,   bg: 'bg-slate-50   border-slate-100',   text: 'text-slate-800'   },
            { label: 'PF',           value: `₹${totals.pf.toLocaleString('en-IN')}`,      bg: 'bg-red-50     border-red-100',     text: 'text-red-600'     },
            { label: 'ESI',          value: `₹${totals.esi.toLocaleString('en-IN')}`,     bg: 'bg-orange-50  border-orange-100',  text: 'text-orange-600'  },
            { label: 'Net Pay',      value: `₹${totals.net.toLocaleString('en-IN')}`,     bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700' },
          ].map(({ label, value, bg, text }) => (
            <div key={label} className={`rounded-2xl border p-3.5 ${bg}`}>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</div>
              <div className={`text-[15px] font-bold tabular-nums leading-tight ${text}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="card p-5 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3 items-center">
              <div className="skeleton h-8 w-8 rounded-lg flex-shrink-0" />
              <div className="skeleton h-8 w-32" />
              <div className="skeleton h-8 w-12" />
              <div className="skeleton h-8 flex-1" />
              <div className="skeleton h-8 w-20" />
              <div className="skeleton h-8 w-24" />
            </div>
          ))}
        </div>
      ) : payrollRows.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-3">
            <Calculator size={24} className="text-gray-300" />
          </div>
          <div className="text-gray-600 font-semibold mb-1">No payroll for {monthLabel}</div>
          <div className="text-gray-400 text-sm">Click "Generate Payroll" to calculate from attendance data.</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide w-52">Employee</th>
                  <th className="text-center px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Days</th>
                  <th className="text-right px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Basic</th>
                  <th className="text-right px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">OT</th>
                  <th className="text-right px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Gross</th>
                  <th className="text-right px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">PF</th>
                  <th className="text-right px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">ESI</th>
                  <th className="text-right px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Advance</th>
                  <th className="text-right px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">TDS</th>
                  <th className="text-right px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide font-bold">Net Pay</th>
                  <th className="text-center px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payrollRows.map(row => {
                  const netWithExtra = Math.max(0, row.calc.gross - row.calc.pf - row.calc.esi - row.calc.advance - (row.tds||0) - (row.other_deductions||0))
                  return (
                    <tr key={row.emp.id} className={`hover:bg-slate-50 transition-colors ${row.status==='paid' ? 'opacity-70' : ''}`}>
                      {/* Employee */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient(row.emp.full_name)} flex items-center justify-center flex-shrink-0`}>
                            <span className="text-white text-[11px] font-bold">{initials(row.emp.full_name)}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800 text-[13px] leading-tight truncate max-w-[140px]">{row.emp.full_name}</div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[140px]">{row.emp.position} · {row.emp.department}</div>
                          </div>
                        </div>
                      </td>

                      {/* Days */}
                      <td className="px-3 py-3 text-center">
                        <span className="text-slate-700 font-medium">{row.calc.effectiveDays}</span>
                        <span className="text-slate-400 text-[11px]">/{row.calc.totalDays}</span>
                        {row.calc.otHours > 0 && (
                          <div className="text-[10px] text-amber-600 flex items-center justify-center gap-0.5 mt-0.5">
                            <Clock size={9} />{row.calc.otHours.toFixed(1)}h OT
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3 text-right text-slate-700 font-medium">₹{row.calc.basic.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-3 text-right text-amber-600 font-medium">{row.calc.otAmount > 0 ? `₹${row.calc.otAmount.toLocaleString('en-IN')}` : '—'}</td>
                      <td className="px-3 py-3 text-right text-slate-800 font-semibold">₹{row.calc.gross.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-3 text-right text-red-500 font-medium">₹{row.calc.pf.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-3 text-right text-red-500 font-medium">{row.calc.esi > 0 ? `₹${row.calc.esi.toLocaleString('en-IN')}` : '—'}</td>
                      <td className="px-3 py-3 text-right text-red-500 font-medium">{row.calc.advance > 0 ? `₹${row.calc.advance.toLocaleString('en-IN')}` : '—'}</td>

                      {/* TDS editable */}
                      <td className="px-3 py-3 text-right">
                        <input
                          type="number" min="0"
                          value={row.tds || ''}
                          onChange={e => updateRow(row.emp.id, 'tds', e.target.value)}
                          placeholder="0"
                          disabled={row.status === 'paid'}
                          className="w-20 text-right bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
                        />
                      </td>

                      {/* Net Pay */}
                      <td className="px-3 py-3 text-right">
                        <span className="text-emerald-700 font-bold text-[14px]">₹{netWithExtra.toLocaleString('en-IN')}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => setSlipRow(row)} title="Salary Slip"
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 cursor-pointer transition-colors">
                            <Printer size={13} />
                          </button>
                          {row.status !== 'paid' ? (
                            <button onClick={() => markPaid(row.emp.id)}
                              className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-100 cursor-pointer border border-emerald-200 transition-colors">
                              Mark Paid
                            </button>
                          ) : (
                            <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                              Paid
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* Totals footer */}
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-4 py-3 font-bold text-slate-700 text-[13px]" colSpan={2}>Total ({payrollRows.length} employees)</td>
                  <td className="px-3 py-3 text-right font-bold text-slate-800">₹{payrollRows.reduce((s,r)=>s+r.calc.basic,0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right font-bold text-amber-600">₹{payrollRows.reduce((s,r)=>s+r.calc.otAmount,0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right font-bold text-slate-800">₹{totals.gross.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right font-bold text-red-500">₹{totals.pf.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right font-bold text-red-500">₹{totals.esi.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right font-bold text-red-500">₹{payrollRows.reduce((s,r)=>s+r.calc.advance,0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right font-bold text-red-500">₹{payrollRows.reduce((s,r)=>s+(r.tds||0),0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right font-bold text-emerald-700 text-[14px]">₹{totals.net.toLocaleString('en-IN')}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Note about advances */}
      {payrollRows.length > 0 && (
        <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1.5">
          <AlertCircle size={11} />
          Advance deductions pulled from salary_advances for {monthLabel}. PF = 12% of basic (capped at ₹15,000). ESI = 0.75% if gross &lt; ₹21,000.
        </p>
      )}

      {/* Salary slip modal */}
      {slipRow && <SalarySlip row={slipRow} month={month} year={year} onClose={() => setSlipRow(null)} />}
    </div>
  )
}
