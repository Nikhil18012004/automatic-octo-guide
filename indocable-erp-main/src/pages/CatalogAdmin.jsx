import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import {
  Package, Plus, Trash2, Edit3, Save, X, ChevronDown, ChevronUp,
  Star, Eye, EyeOff, Layers, Tag, GripVertical, CheckCircle2,
} from 'lucide-react'
import toast from 'react-hot-toast'

const EMPTY_PRODUCT = {
  name: '', slug: '', category_id: '', short_description: '',
  standard: '', voltage_rating: '', conductor_material: 'Copper',
  conductor_class: 'Class 2', insulation_material: 'PVC',
  sheath_material: 'PVC ST2', armour_type: 'None',
  flame_rating: 'FR', temperature_rating: '70°C',
  variants: [],
  applications: '', features: '', certifications: '',
  markup_pct: 0, dealer_discount_pct: 0,
  is_active: true, is_featured: false, sort_order: 0,
}

const EMPTY_VARIANT = { cores: 1, size_sqmm: 1.5, od_mm: '', weight_kg_km: '', base_price_per_m: '' }

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function CatalogAdmin({ profile }) {
  const [tab,        setTab]        = useState('products')
  const [categories, setCategories] = useState([])
  const [products,   setProducts]   = useState([])
  const [loading,    setLoading]    = useState(true)

  // Product form state
  const [showForm,   setShowForm]   = useState(false)
  const [editProd,   setEditProd]   = useState(null)  // null = new
  const [form,       setForm]       = useState({ ...EMPTY_PRODUCT })
  const [saving,     setSaving]     = useState(false)
  const [expandedProd, setExpandedProd] = useState(null)

  // Category form state
  const [showCatForm, setShowCatForm] = useState(false)
  const [editCat,     setEditCat]    = useState(null)
  const [catForm,     setCatForm]    = useState({ name: '', slug: '', description: '', color: 'orange', sort_order: 0, is_active: true })
  const [savingCat,   setSavingCat]  = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [catRes, prodRes] = await Promise.all([
      supabase.from('cable_categories').select('*').order('sort_order'),
      supabase.from('cable_products').select('*, cable_categories(name, color)').order('sort_order'),
    ])
    setCategories(catRes.data || [])
    setProducts(prodRes.data || [])
    setLoading(false)
  }

  // ── Product helpers ──────────────────────────────────────────────────────────
  function openNewProduct() {
    setEditProd(null)
    setForm({ ...EMPTY_PRODUCT })
    setShowForm(true)
  }

  function openEditProduct(p) {
    setEditProd(p.id)
    setForm({
      ...EMPTY_PRODUCT, ...p,
      applications:  Array.isArray(p.applications)  ? p.applications.join('\n')  : p.applications  || '',
      features:      Array.isArray(p.features)       ? p.features.join('\n')       : p.features       || '',
      certifications:Array.isArray(p.certifications) ? p.certifications.join('\n') : p.certifications || '',
      variants:      Array.isArray(p.variants)       ? p.variants : [],
    })
    setShowForm(true)
  }

  function setField(k, v) {
    setForm(f => {
      const next = { ...f, [k]: v }
      if (k === 'name' && !editProd) next.slug = slugify(v)
      return next
    })
  }

  function addVariant() { setForm(f => ({ ...f, variants: [...f.variants, { ...EMPTY_VARIANT }] })) }
  function removeVariant(i) { setForm(f => ({ ...f, variants: f.variants.filter((_, idx) => idx !== i) })) }
  function setVariant(i, k, v) {
    setForm(f => ({ ...f, variants: f.variants.map((r, idx) => idx === i ? { ...r, [k]: v } : r) }))
  }

  async function saveProduct(e) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (!form.slug.trim()) { toast.error('Slug is required'); return }
    setSaving(true)

    const payload = {
      name:               form.name.trim(),
      slug:               form.slug.trim(),
      category_id:        form.category_id || null,
      short_description:  form.short_description.trim() || null,
      standard:           form.standard.trim() || null,
      voltage_rating:     form.voltage_rating.trim() || null,
      conductor_material: form.conductor_material || null,
      conductor_class:    form.conductor_class || null,
      insulation_material:form.insulation_material || null,
      sheath_material:    form.sheath_material || null,
      armour_type:        form.armour_type || null,
      flame_rating:       form.flame_rating || null,
      temperature_rating: form.temperature_rating || null,
      variants:           form.variants.filter(v => v.size_sqmm),
      markup_pct:         parseFloat(form.markup_pct) || 0,
      dealer_discount_pct:parseFloat(form.dealer_discount_pct) || 0,
      applications:       form.applications.split('\n').map(s=>s.trim()).filter(Boolean),
      features:           form.features.split('\n').map(s=>s.trim()).filter(Boolean),
      certifications:     form.certifications.split('\n').map(s=>s.trim()).filter(Boolean),
      is_active:          form.is_active,
      is_featured:        form.is_featured,
      sort_order:         parseInt(form.sort_order) || 0,
      updated_at:         new Date().toISOString(),
    }

    let error
    if (editProd) {
      ;({ error } = await supabase.from('cable_products').update(payload).eq('id', editProd))
    } else {
      ;({ error } = await supabase.from('cable_products').insert(payload))
    }

    if (error) {
      toast.error(error.message)
      setSaving(false)
      return
    }
    toast.success(editProd ? 'Product updated' : 'Product created')
    setSaving(false)
    setShowForm(false)
    loadAll()
  }

  async function toggleField(id, field, value) {
    const { error } = await supabase.from('cable_products').update({ [field]: value }).eq('id', id)
    if (error) { toast.error('Update failed'); return }
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  async function deleteProduct(id) {
    const { error } = await supabase.from('cable_products').delete().eq('id', id)
    if (error) { toast.error('Delete failed'); return }
    setProducts(prev => prev.filter(p => p.id !== id))
    toast.success('Product deleted')
  }

  // ── Category helpers ─────────────────────────────────────────────────────────
  function openNewCat() {
    setEditCat(null)
    setCatForm({ name: '', slug: '', description: '', color: 'orange', sort_order: categories.length, is_active: true })
    setShowCatForm(true)
  }

  function openEditCat(c) {
    setEditCat(c.id)
    setCatForm({ name: c.name, slug: c.slug, description: c.description || '', color: c.color || 'orange', sort_order: c.sort_order || 0, is_active: c.is_active })
    setShowCatForm(true)
  }

  async function saveCat(e) {
    e.preventDefault()
    if (!catForm.name.trim()) { toast.error('Name required'); return }
    setSavingCat(true)
    const payload = { name: catForm.name.trim(), slug: catForm.slug || slugify(catForm.name), description: catForm.description.trim() || null, color: catForm.color, sort_order: parseInt(catForm.sort_order) || 0, is_active: catForm.is_active }
    let error
    if (editCat) {
      ;({ error } = await supabase.from('cable_categories').update(payload).eq('id', editCat))
    } else {
      ;({ error } = await supabase.from('cable_categories').insert(payload))
    }
    if (error) { toast.error(error.message); setSavingCat(false); return }
    toast.success(editCat ? 'Category updated' : 'Category created')
    setSavingCat(false)
    setShowCatForm(false)
    loadAll()
  }

  async function deleteCat(id) {
    const { error } = await supabase.from('cable_categories').delete().eq('id', id)
    if (error) { toast.error('Cannot delete — products exist in this category'); return }
    setCategories(prev => prev.filter(c => c.id !== id))
    toast.success('Category deleted')
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-header">Cable Catalog Admin</h1>
          <p className="page-sub">Manage product catalog visible to dealers and clients</p>
        </div>
        <button
          onClick={tab === 'products' ? openNewProduct : openNewCat}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={15} /> {tab === 'products' ? 'New Product' : 'New Category'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
        {[{ id: 'products', label: `Products (${products.length})` }, { id: 'categories', label: `Categories (${categories.length})` }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{Array(6).fill(0).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : tab === 'products' ? (

        /* ── Products list ── */
        <div className="space-y-2">
          {products.length === 0 ? (
            <div className="card p-16 text-center">
              <Package size={44} className="mx-auto text-gray-200 mb-4" />
              <h3 className="font-bold text-gray-500">No products yet</h3>
              <p className="text-gray-400 text-sm mt-1 mb-5">Add your first cable product to the catalog</p>
              <button onClick={openNewProduct} className="btn-primary mx-auto flex items-center gap-2">
                <Plus size={14} /> Add First Product
              </button>
            </div>
          ) : products.map(p => {
            const isExpanded = expandedProd === p.id
            return (
              <div key={p.id} className="card overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  {/* Toggles */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      title={p.is_active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                      onClick={() => toggleField(p.id, 'is_active', !p.is_active)}
                      className={`w-8 h-4 rounded-full transition-colors ${p.is_active ? 'bg-emerald-500' : 'bg-gray-200'}`}
                    >
                      <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${p.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 text-sm">{p.name}</span>
                      {p.is_featured && <Star size={12} className="text-amber-400 fill-amber-400" />}
                      {p.cable_categories && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{p.cable_categories.name}</span>
                      )}
                      {p.standard && <span className="font-mono text-xs text-gray-400">{p.standard}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      {p.conductor_material && <span>{p.conductor_material}</span>}
                      {p.voltage_rating && <span>{p.voltage_rating}</span>}
                      {p.variants?.length > 0 && <span className="flex items-center gap-1"><Layers size={11} />{p.variants.length} variants</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => toggleField(p.id, 'is_featured', !p.is_featured)}
                      title={p.is_featured ? 'Remove from featured' : 'Mark as featured'}
                      className={`p-1.5 rounded-lg transition-colors ${p.is_featured ? 'text-amber-500 bg-amber-50' : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50'}`}
                    >
                      <Star size={14} />
                    </button>
                    <button onClick={() => openEditProduct(p)}
                      className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => deleteProduct(p.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                    <button onClick={() => setExpandedProd(isExpanded ? null : p.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {isExpanded && p.variants?.length > 0 && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3 bg-gray-50/50">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Variants</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400 uppercase tracking-wide">
                            <th className="text-left py-1 pr-4">Cores</th>
                            <th className="text-left py-1 pr-4">Size (sq mm)</th>
                            <th className="text-left py-1 pr-4">OD (mm)</th>
                            <th className="text-left py-1 pr-4">Weight (kg/km)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {p.variants.map((v, i) => (
                            <tr key={i}>
                              <td className="py-1 pr-4 font-mono">{v.cores}</td>
                              <td className="py-1 pr-4 font-mono">{v.size_sqmm}</td>
                              <td className="py-1 pr-4 font-mono">{v.od_mm || '—'}</td>
                              <td className="py-1 pr-4 font-mono">{v.weight_kg_km || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

      ) : (

        /* ── Categories list ── */
        <div className="space-y-2">
          {categories.length === 0 ? (
            <div className="card p-16 text-center">
              <Tag size={44} className="mx-auto text-gray-200 mb-4" />
              <h3 className="font-bold text-gray-500">No categories yet</h3>
              <button onClick={openNewCat} className="btn-primary mx-auto mt-4 flex items-center gap-2">
                <Plus size={14} /> Add Category
              </button>
            </div>
          ) : categories.map(c => (
            <div key={c.id} className="card flex items-center gap-3 p-4">
              <GripVertical size={14} className="text-gray-300 flex-shrink-0" />
              <div className={`w-3 h-3 rounded-full flex-shrink-0 bg-${c.color}-500`} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900">{c.name}</div>
                {c.description && <div className="text-xs text-gray-400 mt-0.5 truncate">{c.description}</div>}
              </div>
              <span className="text-xs text-gray-400 font-mono hidden sm:block">{c.slug}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${c.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                {c.is_active ? 'Active' : 'Hidden'}
              </span>
              <div className="flex gap-1">
                <button onClick={() => openEditCat(c)}
                  className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                  <Edit3 size={14} />
                </button>
                <button onClick={() => deleteCat(c.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Product Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-black text-gray-900">{editProd ? 'Edit Product' : 'New Cable Product'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X size={18} /></button>
            </div>

            <form onSubmit={saveProduct} className="p-6 space-y-6">

              {/* Basic */}
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Basic Info</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Product Name *</label>
                    <input value={form.name} onChange={e => setField('name', e.target.value)} required
                      placeholder="e.g. FR Housing Wire"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">URL Slug *</label>
                    <input value={form.slug} onChange={e => setField('slug', slugify(e.target.value))} required
                      placeholder="fr-housing-wire"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                    <select value={form.category_id} onChange={e => setField('category_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-brand-500/30">
                      <option value="">No category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Short Description</label>
                    <input value={form.short_description} onChange={e => setField('short_description', e.target.value)}
                      placeholder="One-line product summary"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                  </div>
                </div>
              </div>

              {/* Specs */}
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Technical Specs</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { k: 'standard',            label: 'Standard',            placeholder: 'IS 694, IS 1554' },
                    { k: 'voltage_rating',       label: 'Voltage Rating',      placeholder: '1100V' },
                    { k: 'conductor_material',   label: 'Conductor',           placeholder: 'Copper' },
                    { k: 'conductor_class',      label: 'Conductor Class',     placeholder: 'Class 2' },
                    { k: 'insulation_material',  label: 'Insulation',          placeholder: 'PVC' },
                    { k: 'sheath_material',      label: 'Outer Sheath',        placeholder: 'PVC ST2' },
                    { k: 'armour_type',          label: 'Armour',              placeholder: 'None / GI Wire' },
                    { k: 'flame_rating',         label: 'Flame Rating',        placeholder: 'FR / FRLS / ZHFR' },
                    { k: 'temperature_rating',   label: 'Temp Rating',         placeholder: '70°C' },
                  ].map(({ k, label, placeholder }) => (
                    <div key={k}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                      <input value={form[k]} onChange={e => setField(k, e.target.value)}
                        placeholder={placeholder}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Variants */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Variants (Size Table)</div>
                  <button type="button" onClick={addVariant}
                    className="text-xs text-brand-600 hover:text-brand-700 font-bold flex items-center gap-1">
                    <Plus size={12} /> Add Size
                  </button>
                </div>
                {form.variants.length === 0 ? (
                  <div className="text-xs text-gray-400 bg-gray-50 rounded-xl p-4 text-center">
                    No variants added yet — click "Add Size" to start
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 uppercase tracking-wide text-left">
                          <th className="pb-2 pr-3">Cores</th>
                          <th className="pb-2 pr-3">Size (sq mm) *</th>
                          <th className="pb-2 pr-3">OD (mm)</th>
                          <th className="pb-2 pr-3">Weight (kg/km)</th>
                          <th className="pb-2 pr-3">Base Price/m</th>
                          <th className="pb-2"></th>
                        </tr>
                      </thead>
                      <tbody className="space-y-2">
                        {form.variants.map((v, i) => (
                          <tr key={i}>
                            {['cores', 'size_sqmm', 'od_mm', 'weight_kg_km', 'base_price_per_m'].map(k => (
                              <td key={k} className="pr-3 pb-2">
                                <input type="number" min="0" step="0.01"
                                  value={v[k]} onChange={e => setVariant(i, k, e.target.value)}
                                  placeholder={k === 'cores' ? '1' : k === 'size_sqmm' ? '1.5' : ''}
                                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                              </td>
                            ))}
                            <td className="pb-2">
                              <button type="button" onClick={() => removeVariant(i)}
                                className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg transition-colors">
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Applications / Features */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { k: 'applications',   label: 'Applications (one per line)',   placeholder: 'Residential wiring\nPanels\nCommercial' },
                  { k: 'features',       label: 'Features (one per line)',        placeholder: 'FR rated\nISI marked\nRoHS compliant' },
                  { k: 'certifications', label: 'Certifications (one per line)', placeholder: 'IS 694\nBIS/ISI\nCPRI tested' },
                ].map(({ k, label, placeholder }) => (
                  <div key={k}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                    <textarea rows={4} value={form[k]} onChange={e => setField(k, e.target.value)}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none" />
                  </div>
                ))}
              </div>

              {/* Pricing + Flags */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Markup %</label>
                  <input type="number" min="0" step="0.1" value={form.markup_pct} onChange={e => setField('markup_pct', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Dealer Discount %</label>
                  <input type="number" min="0" step="0.1" value={form.dealer_discount_pct} onChange={e => setField('dealer_discount_pct', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Sort Order</label>
                  <input type="number" value={form.sort_order} onChange={e => setField('sort_order', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                </div>
                <div className="flex flex-col gap-3 pt-5">
                  {[['is_active', 'Active'], ['is_featured', 'Featured']].map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 cursor-pointer">
                      <div onClick={() => setField(k, !form[k])}
                        className={`w-8 h-4 rounded-full transition-colors ${form[k] ? 'bg-brand-500' : 'bg-gray-200'}`}>
                        <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${form[k] ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                      <span className="text-xs font-semibold text-gray-600">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-glow-orange">
                  <Save size={15} /> {saving ? 'Saving…' : editProd ? 'Update Product' : 'Create Product'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-5 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl font-bold text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Category Form Modal ── */}
      {showCatForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-black text-gray-900">{editCat ? 'Edit Category' : 'New Category'}</h2>
              <button onClick={() => setShowCatForm(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={saveCat} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Name *</label>
                <input value={catForm.name}
                  onChange={e => setCatForm(f => ({ ...f, name: e.target.value, slug: slugify(e.target.value) }))}
                  required placeholder="e.g. Housing Wire"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Slug</label>
                <input value={catForm.slug} onChange={e => setCatForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                <textarea rows={2} value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief category description"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Color</label>
                  <select value={catForm.color} onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-brand-500/30">
                    {['orange','blue','emerald','purple','cyan','amber','red','pink','teal'].map(c =>
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Sort Order</label>
                  <input type="number" value={catForm.sort_order} onChange={e => setCatForm(f => ({ ...f, sort_order: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setCatForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`w-8 h-4 rounded-full transition-colors ${catForm.is_active ? 'bg-brand-500' : 'bg-gray-200'}`}>
                  <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${catForm.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <span className="text-sm font-semibold text-gray-700">Active (visible in portal)</span>
              </label>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="submit" disabled={savingCat}
                  className="flex-1 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  <Save size={14} /> {savingCat ? 'Saving…' : editCat ? 'Update' : 'Create Category'}
                </button>
                <button type="button" onClick={() => setShowCatForm(false)}
                  className="px-5 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl font-bold text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
