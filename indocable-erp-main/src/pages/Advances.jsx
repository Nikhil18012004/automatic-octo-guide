import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { confirmToast } from '../components/confirmToast'
import {
  IndianRupee, Plus, Trash2, RefreshCw, X, Save,
  ChevronDown, AlertCircle, CheckCircle2
} from 'lucide-react'
import { gradient, fmtINR } from '../lib/format'

function initials(n=''){return n.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?'}
function fmtDate(d){return d?new Date(d+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):''}

const EMPTY_FORM = { employee_id: '', date: new Date().toISOString().slice(0,10), amount: '', purpose: '' }

export default function Advances({ profile }) {
  const [employees, setEmployees] = useState([])
  const [advances,  setAdvances]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [form,      setForm]      = useState({ ...EMPTY_FORM })
  const [filterEmp, setFilterEmp] = useState('')
  const [deductModal, setDeductModal] = useState(null) // { id, amount, deducted_amount }
  const [deductAmt,   setDeductAmt]   = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: empData }, { data: advData }] = await Promise.all([
      supabase.from('employees').select('id,full_name,employee_code,department,position').eq('is_active',true).order('full_name'),
      supabase.from('salary_advances').select('*').order('date', { ascending: false }),
    ])
    setEmployees(empData || [])
    setAdvances(advData || [])
    setLoading(false)
  }

  const empMap = useMemo(() => Object.fromEntries(employees.map(e=>[e.id,e])), [employees])

  async function saveAdvance() {
    if (!form.employee_id) { toast.error('Select an employee'); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter a valid amount'); return }
    if (!form.date) { toast.error('Select a date'); return }
    setSaving(true)
    const { error } = await supabase.from('salary_advances').insert({
      employee_id:      form.employee_id,
      date:             form.date,
      amount:           parseFloat(form.amount),
      purpose:          form.purpose || null,
      deducted_amount:  0,
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Advance recorded')
    setShowModal(false)
    setForm({ ...EMPTY_FORM })
    fetchAll()
  }

  async function deleteAdvance(id, deducted) {
    if (deducted > 0) { toast.error('Cannot delete — partial deduction already made'); return }
    if (!await confirmToast('Delete this advance record?')) return
    const { error } = await supabase.from('salary_advances').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Deleted')
    fetchAll()
  }

  async function saveDeduction() {
    const amt = parseFloat(deductAmt)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    const row = advances.find(a => a.id === deductModal.id)
    const newDeducted = (parseFloat(row.deducted_amount)||0) + amt
    if (newDeducted > parseFloat(row.amount)) { toast.error('Deduction exceeds advance amount'); return }
    const { error } = await supabase.from('salary_advances').update({ deducted_amount: newDeducted }).eq('id', deductModal.id)
    if (error) { toast.error(error.message); return }
    toast.success('Deduction recorded')
    setDeductModal(null)
    setDeductAmt('')
    fetchAll()
  }

  const filtered = filterEmp ? advances.filter(a => a.employee_id === filterEmp) : advances

  const totals = useMemo(() => filtered.reduce((acc, a) => ({
    given:    acc.given    + (parseFloat(a.amount)||0),
    deducted: acc.deducted + (parseFloat(a.deducted_amount)||0),
  }), { given: 0, deducted: 0 }), [filtered])
  totals.pending = totals.given - totals.deducted

  // Per-employee outstanding (for sidebar)
  const empTotals = useMemo(() => {
    const m = {}
    advances.forEach(a => {
      if (!m[a.employee_id]) m[a.employee_id] = { given: 0, pending: 0 }
      m[a.employee_id].given   += parseFloat(a.amount)||0
      m[a.employee_id].pending += (parseFloat(a.amount)||0) - (parseFloat(a.deducted_amount)||0)
    })
    return m
  }, [advances])

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="page-header">Salary Advances</h1>
          <p className="page-sub">Track loans given to employees and deductions</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAll} className="btn-ghost px-2.5">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => { setForm({ ...EMPTY_FORM }); setShowModal(true) }} className="btn-primary">
            <Plus size={14} /> Add Advance
          </button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total Advances Given', value: fmtINR(totals.given),    color: 'text-slate-800' },
          { label: 'Total Deducted',       value: fmtINR(totals.deducted), color: 'text-emerald-700' },
          { label: 'Outstanding Balance',  value: fmtINR(totals.pending),  color: 'text-red-600' },
        ].map(c => (
          <div key={c.label} className="card px-4 py-3">
            <div className="text-[11px] text-slate-500 mb-1">{c.label}</div>
            <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filter + employees with outstanding */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)}
          className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 min-w-[200px]">
          <option value="">All Employees</option>
          {employees.map(e => (
            <option key={e.id} value={e.id}>
              {e.full_name}{empTotals[e.id]?.pending > 0 ? ` (₹${empTotals[e.id].pending.toLocaleString('en-IN')} pending)` : ''}
            </option>
          ))}
        </select>
        {filterEmp && (
          <button onClick={() => setFilterEmp('')} className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer">Clear filter</button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="card overflow-hidden">
          {[...Array(4)].map((_,i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-gray-50 last:border-0">
              <div className="skeleton h-4 w-28 rounded-md"/>
              <div className="skeleton h-4 w-20 rounded-md"/>
              <div className="skeleton h-4 w-32 rounded-md flex-1"/>
              <div className="skeleton h-4 w-20 rounded-md"/>
              <div className="skeleton h-4 w-20 rounded-md"/>
              <div className="skeleton h-5 w-16 rounded-full"/>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <IndianRupee size={36} className="mx-auto text-slate-300 mb-3" />
          <div className="text-slate-600 font-semibold mb-1">No advances recorded</div>
          <div className="text-slate-400 text-sm">Click "Add Advance" to record a salary advance given to an employee.</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Employee</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Purpose</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Deducted</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Balance</th>
                <th className="text-center px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-center px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(adv => {
                const emp     = empMap[adv.employee_id]
                const amount  = parseFloat(adv.amount) || 0
                const deducted= parseFloat(adv.deducted_amount) || 0
                const balance = amount - deducted
                const pct     = amount > 0 ? Math.round((deducted / amount) * 100) : 0
                const cleared = balance <= 0

                return (
                  <tr key={adv.id} className={`hover:bg-slate-50 transition-colors ${cleared ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      {emp ? (
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient(emp.full_name)} flex items-center justify-center flex-shrink-0`}>
                            <span className="text-white text-[11px] font-bold">{initials(emp.full_name)}</span>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 text-[13px] leading-tight">{emp.full_name}</div>
                            <div className="text-[11px] text-slate-400">{emp.position} · {emp.department}</div>
                          </div>
                        </div>
                      ) : <span className="text-slate-400 text-xs">Unknown</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-[13px]">{fmtDate(adv.date)}</td>
                    <td className="px-4 py-3 text-slate-500 text-[13px] max-w-[160px] truncate">{adv.purpose || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmtINR(amount)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-medium">{deducted > 0 ? fmtINR(deducted) : '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">{cleared ? <span className="text-emerald-600">Cleared</span> : fmtINR(balance)}</td>
                    <td className="px-4 py-3">
                      {cleared ? (
                        <div className="flex justify-center">
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                            <CheckCircle2 size={10} /> Cleared
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-full max-w-[80px] bg-slate-200 rounded-full h-1.5">
                            <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-400">{pct}% recovered</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {!cleared && (
                          <button onClick={() => { setDeductModal({ id: adv.id }); setDeductAmt('') }}
                            className="px-2 py-1 rounded-lg bg-brand-50 text-brand-700 text-[11px] font-semibold hover:bg-brand-100 cursor-pointer border border-brand-200 transition-colors whitespace-nowrap">
                            Record Deduction
                          </button>
                        )}
                        <button onClick={() => deleteAdvance(adv.id, deducted)}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 cursor-pointer transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Advance Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <span className="font-bold text-slate-800">Record Salary Advance</span>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Employee *</label>
                <select value={form.employee_id} onChange={e => setForm(f=>({...f,employee_id:e.target.value}))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500">
                  <option value="">Select employee…</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date *</label>
                  <input type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Amount (₹) *</label>
                  <input type="number" min="1" value={form.amount} onChange={e => setForm(f=>({...f,amount:e.target.value}))}
                    placeholder="e.g. 5000"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Purpose</label>
                <input type="text" value={form.purpose} onChange={e => setForm(f=>({...f,purpose:e.target.value}))}
                  placeholder="e.g. Medical emergency, festival advance…"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 cursor-pointer">Cancel</button>
              <button onClick={saveAdvance} disabled={saving}
                className="flex items-center gap-1.5 bg-brand-500 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-brand-600 disabled:opacity-60 cursor-pointer">
                {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Deduction Modal */}
      {deductModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <span className="font-bold text-slate-800">Record Deduction</span>
              <button onClick={() => setDeductModal(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-600">Enter the amount recovered from this month's salary.</p>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Deduction Amount (₹)</label>
                <input type="number" min="1" value={deductAmt} onChange={e => setDeductAmt(e.target.value)}
                  placeholder="e.g. 2000" autoFocus
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100">
              <button onClick={() => setDeductModal(null)} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 cursor-pointer">Cancel</button>
              <button onClick={saveDeduction}
                className="flex items-center gap-1.5 bg-emerald-500 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-600 cursor-pointer">
                <CheckCircle2 size={13} /> Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
