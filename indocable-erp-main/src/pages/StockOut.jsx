import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { PackageMinus, AlertTriangle, Clock } from 'lucide-react'
import AccessDenied from '../components/AccessDenied'

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export default function StockOut({ profile }) {
  if (!['owner', 'operator', 'production_head'].includes(profile.role)) return <AccessDenied />

  const [materials, setMaterials] = useState([])
  const [recent,    setRecent]    = useState([])
  const [loading,   setLoading]   = useState(false)
  const [form, setForm] = useState({
    material_id: '', quantity: '', purpose: '',
    issued_to: '', issue_date: new Date().toISOString().split('T')[0], notes: ''
  })

  const fetchMaterials = useCallback(async () => {
    const { data } = await supabase.from('materials').select('id, name, unit, current_stock').eq('is_active', true).order('name')
    setMaterials(data || [])
  }, [])

  const fetchRecent = useCallback(async () => {
    const { data } = await supabase
      .from('stock_issues')
      .select('id, quantity, issue_date, purpose, issued_to, materials(name, unit)')
      .order('created_at', { ascending: false })
      .limit(5)
    setRecent(data || [])
  }, [])

  useEffect(() => {
    fetchMaterials()
    fetchRecent()
  }, [])

  const selected       = materials.find(m => m.id === form.material_id)
  const isInsufficient = selected && form.quantity && Number(form.quantity) > selected.current_stock
  const remaining      = selected && form.quantity ? (selected.current_stock - Number(form.quantity)) : null

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.material_id || !form.quantity) { toast.error('Please fill all required fields'); return }
    if (isInsufficient) { toast.error(`Not enough stock! Available: ${selected.current_stock} ${selected.unit}`); return }
    setLoading(true)
    const { error } = await supabase.from('stock_issues').insert([{
      material_id: form.material_id,
      quantity:    Number(form.quantity),
      unit:        selected?.unit || 'kg',
      purpose:     form.purpose,
      issued_to:   form.issued_to,
      issue_date:  form.issue_date,
      notes:       form.notes,
      issued_by:   profile.id,
    }])
    setLoading(false)
    if (error) { toast.error('Error: ' + error.message); return }
    toast.success('Stock issued!')
    setForm({ material_id: '', quantity: '', purpose: '', issued_to: '', issue_date: new Date().toISOString().split('T')[0], notes: '' })
    fetchMaterials()
    fetchRecent()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center">
          <PackageMinus size={20} className="text-brand-600" />
        </div>
        <div>
          <h1 className="page-header">Issue to Floor</h1>
          <p className="page-sub">Record raw material sent to the production floor</p>
        </div>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="label">Material *</label>
            <select required className="input" value={form.material_id}
              onChange={e => setForm({ ...form, material_id: e.target.value, quantity: '' })}>
              <option value="">Select material…</option>
              {materials.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} — Available: {m.current_stock} {m.unit}
                </option>
              ))}
            </select>
          </div>

          {/* Stock indicator */}
          {selected && (
            <div className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm border ${
              selected.current_stock <= 0
                ? 'bg-red-50 border-red-100 text-red-700'
                : 'bg-emerald-50 border-emerald-100 text-emerald-700'
            }`}>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${selected.current_stock <= 0 ? 'bg-red-400' : 'bg-emerald-400'}`} />
              Current stock: <strong>{selected.current_stock} {selected.unit}</strong>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Quantity to Issue *</label>
              <div className="flex">
                <input required type="number" step="0.001" min="0.001"
                  className={`input rounded-r-none ${isInsufficient ? 'border-red-400 bg-red-50 focus:ring-red-400/30 focus:border-red-400' : ''}`}
                  placeholder="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
                <span className="inline-flex items-center px-3 border border-l-0 border-gray-200 bg-gray-50 text-gray-500 rounded-r-xl text-sm font-medium">
                  {selected?.unit || 'unit'}
                </span>
              </div>
              {isInsufficient && (
                <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                  <AlertTriangle size={11} /> Exceeds available stock
                </p>
              )}
            </div>
            <div>
              <label className="label">Issue Date *</label>
              <input required type="date" className="input"
                value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Purpose / Order</label>
              <input className="input" placeholder="e.g. Production Order #45"
                value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} />
            </div>
            <div>
              <label className="label">Issued To</label>
              <input className="input" placeholder="e.g. Production Floor"
                value={form.issued_to} onChange={e => setForm({ ...form, issued_to: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} placeholder="Any notes…"
              value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>

          {/* Preview */}
          {form.material_id && form.quantity && !isInsufficient && (
            <div className="flex items-start gap-3 bg-brand-50 border border-brand-100 rounded-xl p-4 text-sm">
              <PackageMinus size={16} className="text-brand-500 mt-0.5 flex-shrink-0" />
              <div className="text-brand-800">
                Issuing <strong>{form.quantity} {selected?.unit}</strong> of <strong>{selected?.name}</strong>
                {remaining !== null && (
                  <span> — Remaining: <strong className={remaining < 0 ? 'text-red-600' : ''}>{remaining.toFixed(3)} {selected?.unit}</strong></span>
                )}
              </div>
            </div>
          )}

          <button type="submit" disabled={loading || !!isInsufficient} className="btn-primary w-full py-3 rounded-xl justify-center">
            {loading ? <><span className="spinner-sm" /> Recording…</> : <><PackageMinus size={17} /> Record Stock Issue</>}
          </button>
        </form>
      </div>

      {/* Recent issues */}
      {recent.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
            <Clock size={13} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">Recent Issues</span>
          </div>
          <div className="divide-y divide-gray-50">
            {recent.map(r => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{r.materials?.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {r.purpose ? `${r.purpose} · ` : ''}{r.issued_to ? `${r.issued_to} · ` : ''}{fmtDate(r.issue_date)}
                  </p>
                </div>
                <span className="text-sm font-bold text-brand-600 ml-4 tabular-nums flex-shrink-0">
                  −{r.quantity} <span className="text-xs font-medium text-brand-400">{r.materials?.unit}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
