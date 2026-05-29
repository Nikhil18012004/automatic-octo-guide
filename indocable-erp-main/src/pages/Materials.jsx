import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabase'
import { Plus, Search, AlertTriangle, CheckCircle, Package, X } from 'lucide-react'
import toast from 'react-hot-toast'

function StockBar({ current, min }) {
  if (!min || min === 0) return null
  const pct = Math.min(100, Math.round((current / min) * 100))
  const ok   = current > min
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-1 rounded-full transition-all ${ok ? 'bg-emerald-400' : 'bg-red-400'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`text-[10px] font-semibold tabular-nums ${ok ? 'text-emerald-600' : 'text-red-500'}`}>
        {pct}%
      </span>
    </div>
  )
}

export default function Materials({ profile }) {
  const [materials,   setMaterials]   = useState([])
  const [categories,  setCategories]  = useState([])
  const [search,      setSearch]      = useState('')
  const [activeCat,   setActiveCat]   = useState('all')
  const [showForm,    setShowForm]    = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [form, setForm] = useState({
    name: '', category_id: '', unit: 'kg',
    min_stock_level: '', reorder_quantity: '', cost_per_unit: '', supplier_name: '', notes: ''
  })

  const canEdit = profile.role === 'owner' || profile.role === 'admin'

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: mats }, { data: cats }] = await Promise.all([
      supabase.from('materials').select('*, material_categories(name, id)').eq('is_active', true).order('name'),
      supabase.from('material_categories').select('*').order('name'),
    ])
    setMaterials(mats || [])
    setCategories(cats || [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('materials').insert([{
      ...form,
      min_stock_level:  Number(form.min_stock_level) || 0,
      reorder_quantity: Number(form.reorder_quantity) || 0,
      cost_per_unit:    Number(form.cost_per_unit) || 0,
    }])
    setSaving(false)
    if (error) { toast.error('Error: ' + error.message); return }
    toast.success('Material added!')
    setForm({ name: '', category_id: '', unit: 'kg', min_stock_level: '', reorder_quantity: '', cost_per_unit: '', supplier_name: '', notes: '' })
    setShowForm(false)
    fetchAll()
  }

  const lowCount = useMemo(
    () => materials.filter(m => m.min_stock_level > 0 && m.current_stock <= m.min_stock_level).length,
    [materials]
  )

  const filtered = useMemo(() => materials.filter(m => {
    const matchSearch = !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.material_categories?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.supplier_name || '').toLowerCase().includes(search.toLowerCase())
    const matchCat = activeCat === 'all' || m.material_categories?.id === activeCat
    return matchSearch && matchCat
  }), [materials, search, activeCat])

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center">
            <Package size={20} className="text-brand-600" />
          </div>
          <div>
            <h1 className="page-header">Materials</h1>
            <p className="page-sub">Raw materials catalog · {materials.length} items</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lowCount > 0 && (
            <span className="badge-red gap-1.5">
              <AlertTriangle size={11} /> {lowCount} low
            </span>
          )}
          {canEdit && (
            <button onClick={() => setShowForm(!showForm)} className="btn-primary">
              <Plus size={16} /> Add Material
            </button>
          )}
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="card p-6 border-brand-100">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-900">New Material</h2>
            <button onClick={() => setShowForm(false)} className="btn-ghost p-1.5"><X size={16} /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Material Name *</label>
              <input required className="input" placeholder="e.g. Copper Conductor 25mm²"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Category *</label>
              <select required className="input" value={form.category_id}
                onChange={e => setForm({ ...form, category_id: e.target.value })}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Unit of Measure *</label>
              <select className="input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                <option value="kg">kg — Kilograms</option>
                <option value="meter">meter — Metres</option>
                <option value="roll">roll — Rolls</option>
                <option value="piece">piece — Pieces</option>
                <option value="litre">litre — Litres</option>
              </select>
            </div>
            <div>
              <label className="label">Supplier Name</label>
              <input className="input" placeholder="e.g. Hindalco Industries"
                value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} />
            </div>
            <div>
              <label className="label">Min Stock Level</label>
              <input type="number" className="input" placeholder="0"
                value={form.min_stock_level} onChange={e => setForm({ ...form, min_stock_level: e.target.value })} />
            </div>
            <div>
              <label className="label">Reorder Quantity</label>
              <input type="number" className="input" placeholder="0"
                value={form.reorder_quantity} onChange={e => setForm({ ...form, reorder_quantity: e.target.value })} />
            </div>
            <div>
              <label className="label">Cost per Unit (₹)</label>
              <input type="number" step="0.01" className="input" placeholder="0.00"
                value={form.cost_per_unit} onChange={e => setForm({ ...form, cost_per_unit: e.target.value })} />
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" placeholder="Any additional info"
                value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex gap-3 pt-1">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? <><span className="spinner-sm" /> Saving…</> : 'Save Material'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Search + Category filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            className="input pl-10 pr-9"
            placeholder="Search name, category, supplier…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category pills */}
        {categories.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveCat('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                activeCat === 'all'
                  ? 'bg-brand-500 text-white border-brand-500 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              All
            </button>
            {categories.map(cat => {
              const count = materials.filter(m => m.material_categories?.id === cat.id).length
              if (count === 0) return null
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCat(activeCat === cat.id ? 'all' : cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                    activeCat === cat.id
                      ? 'bg-brand-500 text-white border-brand-500 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {cat.name}
                  <span className={`ml-1.5 text-[10px] font-bold ${activeCat === cat.id ? 'text-white/70' : 'text-gray-400'}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="card p-6 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="skeleton h-9 flex-1" />
              <div className="skeleton h-9 w-24" />
              <div className="skeleton h-9 w-28" />
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr style={{ background: '#fafafa' }}>
                  <th className="th">Material</th>
                  <th className="th">Category</th>
                  <th className="th-r">Stock Level</th>
                  <th className="th-r">Cost / Unit</th>
                  <th className="th">Supplier</th>
                  <th className="th" style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-3">
                        <Package size={24} className="text-gray-300" />
                      </div>
                      <p className="text-gray-500 font-semibold text-sm">
                        {search || activeCat !== 'all' ? 'No materials match your filters' : 'No materials yet'}
                      </p>
                      {(search || activeCat !== 'all') && (
                        <button
                          onClick={() => { setSearch(''); setActiveCat('all') }}
                          className="mt-2 text-brand-600 text-xs font-semibold hover:underline cursor-pointer"
                        >
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : filtered.map(m => {
                  const isLow = m.min_stock_level > 0 && m.current_stock <= m.min_stock_level
                  return (
                    <tr key={m.id} className={`transition-colors duration-100 ${isLow ? 'bg-red-50/40 hover:bg-red-50' : 'hover:bg-brand-50/20'}`}>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-gray-900">{m.name}</span>
                        {m.notes && <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[180px]">{m.notes}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge-gray text-[11px]">{m.material_categories?.name || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-right min-w-[110px]">
                        <div>
                          <span className={`font-bold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>{m.current_stock}</span>
                          <span className="text-gray-400 text-xs ml-1">{m.unit}</span>
                        </div>
                        <StockBar current={m.current_stock} min={m.min_stock_level} />
                        {m.min_stock_level > 0 && (
                          <div className="text-[10px] text-gray-400 mt-0.5">min: {m.min_stock_level} {m.unit}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 font-medium">
                        {m.cost_per_unit > 0 ? `₹${Number(m.cost_per_unit).toLocaleString('en-IN')}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-[13px]">{m.supplier_name || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-center">
                        {isLow
                          ? <span className="badge-red text-[11px]"><AlertTriangle size={9} /> Low</span>
                          : <span className="badge-green text-[11px]"><CheckCircle size={9} /> OK</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Footer count */}
          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                Showing {filtered.length} of {materials.length} materials
              </span>
              {lowCount > 0 && (
                <span className="text-xs text-red-500 font-semibold flex items-center gap-1">
                  <AlertTriangle size={11} /> {lowCount} item{lowCount !== 1 ? 's' : ''} need restocking
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
