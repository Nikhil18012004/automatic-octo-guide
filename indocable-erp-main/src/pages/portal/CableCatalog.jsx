import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../supabase'
import {
  Search, Package, ChevronRight, Home, Shield, Zap,
  Droplets, Activity, Layers, X, SlidersHorizontal,
  ArrowRight, MessageCircle,
} from 'lucide-react'

const CATEGORY_ICONS = {
  'housing-wire':            Home,
  'flexible-cables':         Zap,
  'armoured-cables':         Shield,
  'xlpe-cables':             Activity,
  'submersible-cables':      Droplets,
  'instrumentation-cables':  Layers,
}

const CATEGORY_GRADIENTS = {
  orange:  'from-orange-500 to-amber-600',
  blue:    'from-blue-500 to-indigo-600',
  emerald: 'from-emerald-500 to-teal-600',
  purple:  'from-purple-500 to-violet-600',
  cyan:    'from-cyan-500 to-blue-600',
  amber:   'from-amber-500 to-orange-600',
}

export default function CableCatalog() {
  const navigate              = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [categories,   setCategories]   = useState([])
  const [products,     setProducts]     = useState([])
  const [catLoading,   setCatLoading]   = useState(true)
  const [prodLoading,  setProdLoading]  = useState(true)
  const [search,       setSearch]       = useState('')
  const [activeCat,    setActiveCat]    = useState(searchParams.get('category') || 'all')

  useEffect(() => {
    supabase.from('cable_categories').select('*').eq('is_active', true).order('sort_order')
      .then(({ data }) => { setCategories(data || []); setCatLoading(false) })
  }, [])

  useEffect(() => {
    fetchProducts()
    // Sync URL param
    if (activeCat !== 'all') setSearchParams({ category: activeCat })
    else setSearchParams({})
  }, [activeCat])

  async function fetchProducts() {
    setProdLoading(true)
    let q = supabase.from('cable_products').select('*, cable_categories(name, slug, color)').eq('is_active', true).order('sort_order')
    if (activeCat !== 'all') {
      const cat = categories.find(c => c.slug === activeCat)
      if (cat) q = q.eq('category_id', cat.id)
    }
    const { data } = await q
    setProducts(data || [])
    setProdLoading(false)
  }

  useEffect(() => {
    if (categories.length > 0 && activeCat !== 'all') fetchProducts()
  }, [categories])

  const filtered = products.filter(p => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      p.name?.toLowerCase().includes(q) ||
      p.standard?.toLowerCase().includes(q) ||
      p.conductor_material?.toLowerCase().includes(q) ||
      p.insulation_material?.toLowerCase().includes(q) ||
      p.flame_rating?.toLowerCase().includes(q) ||
      p.cable_categories?.name?.toLowerCase().includes(q)
    )
  })

  function selectCategory(slug) {
    setActiveCat(slug)
    setSearch('')
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-7 py-10">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Cable Catalog</h1>
        <p className="text-gray-500 mt-1.5">Browse our complete range of ISI-certified cables</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">

        {/* ── Sidebar ── */}
        <aside className="lg:w-56 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-gray-400" />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Filter by Category</span>
            </div>
            <nav className="p-2">
              <button
                onClick={() => selectCategory('all')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  activeCat === 'all'
                    ? 'bg-brand-50 text-brand-600 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Package size={15} className="flex-shrink-0" />
                All Categories
              </button>
              {catLoading
                ? Array(6).fill(0).map((_, i) => <div key={i} className="skeleton h-10 rounded-xl mt-1" />)
                : categories.map(cat => {
                    const Icon     = CATEGORY_ICONS[cat.slug] || Layers
                    const gradient = CATEGORY_GRADIENTS[cat.color] || 'from-gray-400 to-gray-600'
                    const isActive = activeCat === cat.slug
                    return (
                      <button
                        key={cat.id}
                        onClick={() => selectCategory(cat.slug)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mt-0.5 cursor-pointer ${
                          isActive
                            ? 'bg-brand-50 text-brand-600 font-semibold'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                          <Icon size={12} className="text-white" />
                        </div>
                        <span className="truncate text-left">{cat.name}</span>
                      </button>
                    )
                  })
              }
            </nav>
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0">

          {/* Search bar */}
          <div className="relative mb-6">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search cables by name, standard, conductor, application…"
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all bg-white shadow-card"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Results header */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              {prodLoading ? 'Loading…' : `${filtered.length} product${filtered.length !== 1 ? 's' : ''} found`}
            </p>
            {activeCat !== 'all' && (
              <button onClick={() => selectCategory('all')} className="text-xs text-brand-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer">
                <X size={12} /> Clear filter
              </button>
            )}
          </div>

          {/* Product grid */}
          {prodLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array(6).fill(0).map((_, i) => <div key={i} className="skeleton h-52 rounded-2xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-card">
              <Package size={48} className="mx-auto text-gray-200 mb-4" />
              {products.length === 0 ? (
                <>
                  <h3 className="text-gray-600 font-bold text-lg mb-1">Catalog Coming Soon</h3>
                  <p className="text-gray-400 text-sm mb-5 max-w-xs mx-auto">
                    Our product catalog is being set up. Call us for the complete range and pricing.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <a href="tel:+918073533289"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white rounded-xl font-bold text-sm">
                      Call +91 80735 33289
                    </a>
                    <a
                      href="https://wa.me/918073533289?text=Hi, please share the full cable catalog and pricing."
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm"
                    >
                      <MessageCircle size={15} /> WhatsApp
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-gray-600 font-bold mb-1">No cables match "{search}"</h3>
                  <p className="text-gray-400 text-sm">Try different keywords or browse all categories</p>
                  <button onClick={() => setSearch('')} className="mt-4 text-brand-600 text-sm font-semibold hover:underline">Clear search</button>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(product => {
                const g    = CATEGORY_GRADIENTS[product.cable_categories?.color] || 'from-gray-400 to-gray-600'
                const Icon = CATEGORY_ICONS[product.cable_categories?.slug] || Package
                return (
                  <button
                    key={product.id}
                    onClick={() => navigate(`/portal/cable/${product.slug}`)}
                    className="group bg-white rounded-2xl border border-gray-100 shadow-card portal-card-hover text-left overflow-hidden cursor-pointer"
                  >
                    {/* Color bar */}
                    <div className={`h-1.5 bg-gradient-to-r ${g}`} />
                    <div className="p-5">
                      {/* Category badge */}
                      <div className="flex items-center justify-between mb-3">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white bg-gradient-to-r ${g}`}>
                          <Icon size={10} />
                          {product.cable_categories?.name}
                        </div>
                        {product.is_featured && (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">Featured</span>
                        )}
                      </div>

                      {/* Name */}
                      <h3 className="font-bold text-gray-900 text-sm mb-1.5 group-hover:text-brand-600 transition-colors line-clamp-2 leading-snug">
                        {product.name}
                      </h3>

                      {/* Key specs */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {product.standard && (
                          <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg">{product.standard}</span>
                        )}
                        {product.voltage_rating && (
                          <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">{product.voltage_rating}</span>
                        )}
                        {product.flame_rating && (
                          <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg">{product.flame_rating}</span>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                        <span className="text-xs text-gray-400">{product.conductor_material} · {product.insulation_material}</span>
                        <div className="flex items-center gap-1 text-brand-500 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                          View <ChevronRight size={12} />
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
