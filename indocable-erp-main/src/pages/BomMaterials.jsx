import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import {
  Package, Plus, Edit2, Trash2, Search, X, Database, RefreshCw
} from 'lucide-react'

const CATEGORIES = ['conductor', 'insulation', 'sheathing', 'tape', 'filler', 'other']

const CATEGORY_BADGE = {
  conductor: 'bg-brand-100 text-brand-700',
  insulation: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  sheathing:  'bg-green-100 text-green-700',
  armour:     'bg-orange-100 text-orange-700',
  tape:       'bg-purple-100 text-purple-700',
  filler:     'bg-yellow-100 text-yellow-700',
  other:      'bg-gray-100 text-gray-600',
}

const DEFAULT_SEED = [
  { name: 'Aluminium (EC Grade)',       category: 'conductor',  density: 2.703, resistivity: 0.028264, temp_coeff: 0.00403, base_price: 370,   freight: 2,  scrap_value: 210  },
  { name: 'Aluminium (CG Grade)',       category: 'conductor',  density: 2.703, resistivity: 0.029,    temp_coeff: 0.00403, base_price: 290,   freight: 10, scrap_value: 750  },
  { name: 'Copper (ETP Grade)',         category: 'conductor',  density: 8.89,  resistivity: 0.017241, temp_coeff: 0.00393, base_price: 1337,  freight: 5,  scrap_value: 750  },
  { name: 'Copper (CC Grade)',          category: 'conductor',  density: 8.89,  resistivity: 0.017241, temp_coeff: 0.00393, base_price: 1337,  freight: 4,  scrap_value: 1100 },
  { name: 'Copper (Tinned)',            category: 'conductor',  density: 8.89,  resistivity: 0.017241, temp_coeff: 0.00393, base_price: 1412,  freight: 4,  scrap_value: 750  },
  { name: 'PVC Compound (Type A)',      category: 'insulation', density: 1.5,   base_price: 90,   freight: 10, scrap_value: 30   },
  { name: 'PVC Compound (Type A FR)',   category: 'insulation', density: 1.5,   base_price: 125,  freight: 5,  scrap_value: 30   },
  { name: 'PVC Compound (Type A FRLS)',  category: 'insulation', density: 1.5,  base_price: 100,  freight: 10, scrap_value: 30   },
  { name: 'PVC Compound (Type C)',      category: 'insulation', density: 1.5,   base_price: 110,  freight: 10, scrap_value: 30   },
  { name: 'PVC Compound (Type C FRLS)', category: 'insulation', density: 1.5,   base_price: 160,  freight: 10, scrap_value: 30   },
  { name: 'PVC Compound (ST1)',         category: 'sheathing',  density: 1.5,   base_price: 85,   freight: 0,  scrap_value: null },
  { name: 'PVC Compound (ST1 FRLS)',    category: 'sheathing',  density: 1.5,   base_price: 90,   freight: 5,  scrap_value: 30   },
  { name: 'PVC Compound (ST2)',         category: 'sheathing',  density: 1.5,   base_price: 95,   freight: 0,  scrap_value: null },
  { name: 'PVC Compound (ST2 FRLS)',    category: 'sheathing',  density: 1.5,   base_price: 140,  freight: 5,  scrap_value: null },
  { name: 'RP (ST Compound)',           category: 'sheathing',  density: 1.5,   base_price: 75,   freight: 10, scrap_value: 35   },
  { name: 'XLPE Compound',             category: 'insulation', density: 0.95,  base_price: 114.5, freight: 10, scrap_value: 20  },
  { name: 'LSZH Insulation Compound',  category: 'insulation', density: 1.55,  base_price: 160,  freight: 10, scrap_value: 30   },
  { name: 'ZHFR Sheathing Compound',   category: 'sheathing',  density: 1.55,  base_price: 140,  freight: 10, scrap_value: null },
  { name: 'GI Strip (Armour)',         category: 'other',      density: 7.85,  base_price: 77,   freight: 13, scrap_value: 25   },
  { name: 'GI Round Wire (Armour)',    category: 'other',      density: 7.85,  base_price: 77,   freight: 8,  scrap_value: 25   },
  { name: 'AL Strip (Armour)',         category: 'other',      density: 2.703, resistivity: 0.028264, base_price: 344, freight: 2, scrap_value: 210 },
  { name: 'AL Round Wire (Armour)',    category: 'other',      density: 2.703, resistivity: 0.028264, base_price: 344, freight: 2, scrap_value: 210 },
  { name: 'AL MYLAR',                  category: 'tape',       surface_density: 65,  base_price: 400, freight: 1,  scrap_value: 0    },
  { name: 'Polyester Tape',            category: 'tape',       surface_density: 35,  base_price: 200, freight: 0,  scrap_value: 0    },
  { name: 'Polyester Tape (numbered)', category: 'tape',       surface_density: 35,  base_price: 260, freight: 0,  scrap_value: null },
  { name: 'Binder Yarn',               category: 'tape',       base_price: 100, freight: 10, scrap_value: 0    },
  { name: 'WBR',                       category: 'filler',     density: 0.3,   base_price: 350, freight: 2,  scrap_value: 0    },
  { name: 'Masterbatch (Color)',       category: 'other',      density: 1.2,   base_price: 250, freight: 10, scrap_value: 0    },
]

const EMPTY_FORM = {
  name: '',
  category: 'conductor',
  density: '',
  surface_density: '',
  resistivity: '',
  temp_coeff: '',
  base_price: '',
  freight: '',
  scrap_value: '',
  is_active: true,
}

function numOrNull(val) {
  if (val === '' || val === null || val === undefined) return null
  const n = Number(val)
  return isNaN(n) ? null : n
}

function fmt(val, decimals = 4) {
  if (val === null || val === undefined || val === '') return '—'
  return Number(val).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })
}

function fmtPrice(val) {
  if (val === null || val === undefined || val === '') return '—'
  return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function showDensity(mat) {
  if (mat.surface_density !== null && mat.surface_density !== undefined) {
    return `${fmt(mat.surface_density, 1)} g/m²`
  }
  if (mat.density !== null && mat.density !== undefined) {
    return `${fmt(mat.density, 3)} g/cm³`
  }
  return '—'
}

function landedCost(mat) {
  const b = Number(mat.base_price) || 0
  const f = Number(mat.freight) || 0
  return b + f
}

export default function BomMaterials({ profile }) {
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const canWrite = profile?.role === 'owner' || profile?.role === 'admin'

  const fetchMaterials = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('bom_materials')
      .select('*')
      .order('category')
      .order('name')
    if (error) {
      toast.error('Failed to load materials: ' + error.message)
    } else {
      setMaterials(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchMaterials() }, [fetchMaterials])

  const filtered = materials.filter(m => {
    const matchSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.category.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === 'all' || m.category === catFilter
    return matchSearch && matchCat
  })

  function openAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(mat) {
    setEditingId(mat.id)
    setForm({
      name: mat.name || '',
      category: mat.category || 'conductor',
      density: mat.density ?? '',
      surface_density: mat.surface_density ?? '',
      resistivity: mat.resistivity ?? '',
      temp_coeff: mat.temp_coeff ?? '',
      base_price: mat.base_price ?? '',
      freight: mat.freight ?? '',
      scrap_value: mat.scrap_value ?? '',
      is_active: mat.is_active ?? true,
    })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function fieldVisible(field) {
    const cat = form.category
    switch (field) {
      case 'density':
        return cat !== 'tape'
      case 'surface_density':
        return cat === 'tape'
      case 'resistivity':
        return cat === 'conductor' || cat === 'other'
      case 'temp_coeff':
        return cat === 'conductor'
      default:
        return true
    }
  }

  function buildPayload() {
    return {
      name: form.name.trim(),
      category: form.category,
      density: fieldVisible('density') ? numOrNull(form.density) : null,
      surface_density: fieldVisible('surface_density') ? numOrNull(form.surface_density) : null,
      resistivity: fieldVisible('resistivity') ? numOrNull(form.resistivity) : null,
      temp_coeff: fieldVisible('temp_coeff') ? numOrNull(form.temp_coeff) : null,
      base_price: numOrNull(form.base_price) ?? 0,
      freight: numOrNull(form.freight) ?? 0,
      scrap_value: numOrNull(form.scrap_value) ?? 0,
      is_active: form.is_active,
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    const payload = buildPayload()

    let error
    if (editingId) {
      ;({ error } = await supabase.from('bom_materials').update(payload).eq('id', editingId))
    } else {
      ;({ error } = await supabase.from('bom_materials').insert([payload]))
    }

    setSaving(false)
    if (error) {
      toast.error('Save failed: ' + error.message)
    } else {
      toast.success(editingId ? 'Material updated!' : 'Material added!')
      closeModal()
      fetchMaterials()
    }
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('bom_materials').delete().eq('id', id)
    if (error) {
      toast.error('Delete failed: ' + error.message)
    } else {
      toast.success('Material deleted.')
      setDeleteId(null)
      fetchMaterials()
    }
  }

  async function handleSeed() {
    if (materials.length > 0) {
      toast.error('Table is not empty. Clear it first.')
      return
    }
    setSeeding(true)
    const { error } = await supabase.from('bom_materials').insert(
      DEFAULT_SEED.map(m => ({
        ...m,
        scrap_value: m.scrap_value ?? 0,
        is_active: true,
      }))
    )
    setSeeding(false)
    if (error) {
      toast.error('Seed failed: ' + error.message)
    } else {
      toast.success('Default materials seeded!')
      fetchMaterials()
    }
  }

  const computedLanded =
    (numOrNull(form.base_price) || 0) + (numOrNull(form.freight) || 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="page-header flex items-center gap-2">
            <Package size={24} className="text-brand-600" />
            Bill of Materials
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Cable manufacturing costing database</p>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {materials.length === 0 && !loading && (
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="flex items-center gap-2 border border-brand-300 text-brand-700 bg-brand-50 hover:bg-brand-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                <Database size={15} />
                {seeding ? 'Seeding…' : 'Seed Defaults'}
              </button>
            )}
            <button
              onClick={openAdd}
              className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
            >
              <Plus size={16} />
              Add Material
            </button>
          </div>
        )}
      </div>

      {/* Search + Refresh */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            placeholder="Search by name or category…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={fetchMaterials}
          className="p-2.5 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {['all', ...CATEGORIES].map(cat => (
          <button
            key={cat}
            onClick={() => setCatFilter(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors border ${
              catFilter === cat
                ? 'bg-brand-500 text-white border-brand-500'
                : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400 hover:text-brand-600'
            }`}
          >
            {cat === 'all' ? 'All' : cat}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-2" />
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center py-16 text-center">
          <Package size={40} className="text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium mb-1">
            {materials.length === 0 ? 'No materials yet' : 'No results found'}
          </p>
          <p className="text-gray-400 text-sm mb-5">
            {materials.length === 0
              ? 'Seed the default material list to get started.'
              : 'Try adjusting your search or category filter.'}
          </p>
          {materials.length === 0 && canWrite && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-2 bg-brand-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-60"
            >
              <Database size={15} />
              {seeding ? 'Seeding…' : 'Seed Default Materials'}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Category</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Density / Surface</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Resistivity (Ω·mm²/m)</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Base Price</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Freight</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap bg-green-50">Landed Cost</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Scrap Value</th>
                  {canWrite && (
                    <th className="text-center px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(mat => (
                  <tr key={mat.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap max-w-xs">
                      {mat.name}
                      {!mat.is_active && (
                        <span className="ml-2 text-xs text-gray-400 font-normal">(inactive)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${CATEGORY_BADGE[mat.category] || 'bg-gray-100 text-gray-600'}`}>
                        {mat.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                      {showDensity(mat)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                      {mat.resistivity !== null && mat.resistivity !== undefined
                        ? fmt(mat.resistivity, 6)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                      {fmtPrice(mat.base_price)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                      {fmtPrice(mat.freight)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700 bg-green-50 whitespace-nowrap">
                      {fmtPrice(landedCost(mat))}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                      {mat.scrap_value !== null && mat.scrap_value !== undefined
                        ? fmtPrice(mat.scrap_value)
                        : '—'}
                    </td>
                    {canWrite && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEdit(mat)}
                            className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-md transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteId(mat.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400">
            {filtered.length} material{filtered.length !== 1 ? 's' : ''}
            {catFilter !== 'all' || search ? ` (filtered from ${materials.length})` : ''}
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Edit Material' : 'Add Material'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="label">Material Name *</label>
                <input
                  required
                  className="input"
                  placeholder="e.g. Copper (ETP Grade)"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              {/* Category */}
              <div>
                <label className="label">Category *</label>
                <select
                  className="input"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>

              {/* Physical Properties */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {fieldVisible('density') && (
                  <div>
                    <label className="label">Density (g/cm³)</label>
                    <input
                      type="number"
                      step="any"
                      className="input"
                      placeholder="e.g. 8.89"
                      value={form.density}
                      onChange={e => setForm(f => ({ ...f, density: e.target.value }))}
                    />
                  </div>
                )}
                {fieldVisible('surface_density') && (
                  <div>
                    <label className="label">Surface Density (g/m²)</label>
                    <input
                      type="number"
                      step="any"
                      className="input"
                      placeholder="e.g. 65"
                      value={form.surface_density}
                      onChange={e => setForm(f => ({ ...f, surface_density: e.target.value }))}
                    />
                  </div>
                )}
                {fieldVisible('resistivity') && (
                  <div>
                    <label className="label">Resistivity (Ω·mm²/m)</label>
                    <input
                      type="number"
                      step="any"
                      className="input"
                      placeholder="e.g. 0.017241"
                      value={form.resistivity}
                      onChange={e => setForm(f => ({ ...f, resistivity: e.target.value }))}
                    />
                  </div>
                )}
                {fieldVisible('temp_coeff') && (
                  <div>
                    <label className="label">Temp. Coefficient (/°C)</label>
                    <input
                      type="number"
                      step="any"
                      className="input"
                      placeholder="e.g. 0.00393"
                      value={form.temp_coeff}
                      onChange={e => setForm(f => ({ ...f, temp_coeff: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Base Price (Rs/kg) *</label>
                  <input
                    required
                    type="number"
                    step="any"
                    className="input"
                    placeholder="0.00"
                    value={form.base_price}
                    onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Freight (Rs/kg)</label>
                  <input
                    type="number"
                    step="any"
                    className="input"
                    placeholder="0.00"
                    value={form.freight}
                    onChange={e => setForm(f => ({ ...f, freight: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Landed Cost (Rs/kg)</label>
                  <div className="input bg-green-50 border-green-200 text-green-800 font-semibold cursor-not-allowed select-none">
                    {computedLanded > 0 ? `₹${computedLanded.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    <span className="ml-2 text-xs font-normal text-green-600">(base + freight)</span>
                  </div>
                </div>
                <div>
                  <label className="label">Scrap Value (Rs/kg)</label>
                  <input
                    type="number"
                    step="any"
                    className="input"
                    placeholder="0.00"
                    value={form.scrap_value}
                    onChange={e => setForm(f => ({ ...f, scrap_value: e.target.value }))}
                  />
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.is_active ? 'bg-brand-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      form.is_active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-700">
                  {form.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-brand-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-60 transition-colors"
                >
                  {saving ? 'Saving…' : editingId ? 'Update Material' : 'Add Material'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Delete Material</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-gray-900">
                {materials.find(m => m.id === deleteId)?.name || 'this material'}
              </span>
              ?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 border border-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
