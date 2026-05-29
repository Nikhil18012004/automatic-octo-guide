import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import {
  Home, Shield, Zap, Droplets, Activity, Layers,
  ArrowRight, MessageSquare, Award, CheckCircle2,
  TrendingUp, ChevronRight, MessageCircle, Package,
  FileText, Calculator, Star,
} from 'lucide-react'
import toast from 'react-hot-toast'

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

const TRUST_POINTS = [
  { icon: Award,        title: 'ISI Certified',         desc: 'All products carry BIS/ISI mark, fully compliant with Indian standards' },
  { icon: CheckCircle2, title: 'CPRI Tested',            desc: 'Type tested at CPRI — India\'s premier electrical testing laboratory' },
  { icon: Layers,       title: '6 Product Categories',   desc: 'From housing wire to armoured cables — complete range under one roof' },
  { icon: TrendingUp,   title: 'Live Market Pricing',    desc: 'Prices updated daily with LME copper — complete transparency for buyers' },
]

function useCountUp(target, duration = 1800) {
  const [count, setCount] = useState(0)
  const started = useRef(false)
  useEffect(() => {
    if (!target || started.current) return
    started.current = true
    const begin = Date.now()
    const id = setInterval(() => {
      const p = Math.min((Date.now() - begin) / duration, 1)
      setCount(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p >= 1) clearInterval(id)
    }, 16)
    return () => clearInterval(id)
  }, [target, duration])
  return count
}

export default function PortalDashboard({ profile }) {
  const navigate = useNavigate()
  const [categories,       setCategories]       = useState([])
  const [featuredProducts, setFeaturedProducts] = useState([])
  const [prices,           setPrices]           = useState({})
  const [catLoading,       setCatLoading]       = useState(true)
  const [form,             setForm]             = useState({ name: profile?.full_name || '', phone: '', message: '' })
  const [submitting,       setSubmitting]       = useState(false)
  const [submitted,        setSubmitted]        = useState(false)

  const yearsCount = useCountUp(25)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    const [cats, featured, vars] = await Promise.all([
      supabase.from('cable_categories').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('cable_products').select('*, cable_categories(name, slug, color)').eq('is_active', true).eq('is_featured', true).limit(4),
      supabase.from('global_variables').select('key, value').in('key', ['lme_copper_usd_per_tonne', 'lme_al_usd_per_tonne', 'usd_to_inr']),
    ])
    setCategories(cats.data || [])
    setFeaturedProducts(featured.data || [])
    setCatLoading(false)
    if (vars.data) {
      const v    = Object.fromEntries(vars.data.map(d => [d.key, parseFloat(d.value)]))
      const rate = v.usd_to_inr || 85.5
      setPrices({
        copper:   v.lme_copper_usd_per_tonne ? Math.round(v.lme_copper_usd_per_tonne * rate / 1000) : null,
        aluminum: v.lme_al_usd_per_tonne     ? Math.round(v.lme_al_usd_per_tonne * rate / 1000)    : null,
      })
    }
  }

  async function handleQuickEnquiry(e) {
    e.preventDefault()
    if (!form.name.trim())              { toast.error('Please enter your name'); return }
    if (form.phone.trim().length < 10)  { toast.error('Enter a valid 10-digit phone number'); return }
    setSubmitting(true)
    const enquiryNo = `ENQ-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Date.now()).slice(-4)}`
    const { error } = await supabase.from('enquiries').insert({
      enquiry_no:   enquiryNo,
      contact_name: form.name.trim(),
      phone:        form.phone.trim(),
      message:      form.message.trim() || 'General enquiry from portal',
      user_id:      profile?.id || null,
      subject:      'General Enquiry — Portal Homepage',
    })
    setSubmitting(false)
    if (error) { toast.error('Submission failed. Please WhatsApp us directly.'); return }
    setSubmitted(true)
    toast.success('Enquiry received! We\'ll contact you within 2 hours.')
  }

  return (
    <div>
      {/* ── Dealer Welcome Bar ── */}
      {profile?.role === 'dealer' && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Star size={14} className="text-amber-500 fill-amber-400" />
              <span className="font-semibold text-amber-800">
                Welcome, {profile.full_name}{profile.company_name ? ` · ${profile.company_name}` : ''}
              </span>
              {profile.territory && <span className="text-amber-600 text-xs">· {profile.territory}</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/portal/rate-card')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors"
              >
                <FileText size={12} /> My Rate Card
              </button>
              <button
                onClick={() => navigate('/portal/sizer')}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-bold transition-colors"
              >
                <Calculator size={12} /> Cable Sizer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hero ── */}
      <section className="portal-hero">
        <div className="relative max-w-7xl mx-auto px-4 md:px-7 pt-20 pb-0">
          <div className="max-w-3xl">
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-amber-300 font-semibold mb-6 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              25+ Years of Manufacturing Excellence · ISI Certified
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-black text-white leading-[1.1] mb-5 tracking-tight">
              Precision Cables,<br />
              <span className="gradient-text-animated">
                Engineered for India
              </span>
            </h1>

            <p className="text-lg text-slate-300 leading-relaxed mb-8 max-w-xl">
              ISI certified. CPRI tested. From housing wire to armoured power cables —
              complete range with live pricing and direct factory access.
            </p>

            <div className="flex flex-wrap gap-3 pb-20">
              <button
                onClick={() => navigate('/portal/catalog')}
                className="flex items-center gap-2.5 px-6 py-3.5 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-bold text-base transition-all shadow-glow-orange"
              >
                Browse Catalog <ArrowRight size={18} />
              </button>
              <button
                onClick={() => navigate('/portal/enquiry')}
                className="flex items-center gap-2.5 px-6 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-2xl font-bold text-base transition-all backdrop-blur-sm"
              >
                <MessageSquare size={18} /> Get a Quote
              </button>
              {profile?.role === 'dealer' && (
                <button
                  onClick={() => navigate('/portal/rate-card')}
                  className="flex items-center gap-2.5 px-6 py-3.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 text-amber-300 rounded-2xl font-bold text-base transition-all backdrop-blur-sm"
                >
                  <FileText size={18} /> Rate Card
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live stats bar */}
        <div className="border-t border-white/10" style={{ background: 'rgba(0,0,0,0.35)' }}>
          <div className="max-w-7xl mx-auto px-4 md:px-7 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {[
              { label: 'Cu LME Today',     value: prices.copper   ? `₹${prices.copper.toLocaleString('en-IN')}/kg`   : '—', color: 'text-amber-400' },
              { label: 'Al LME Today',     value: prices.aluminum ? `₹${prices.aluminum.toLocaleString('en-IN')}/kg` : '—', color: 'text-blue-400'  },
              { label: 'Years Excellence', value: `${yearsCount}+`,                                                          color: 'text-brand-400'  },
              { label: 'Product Lines',    value: '6',                                                                        color: 'text-emerald-400' },
            ].map(s => (
              <div key={s.label}>
                <div className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</div>
                <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Product Categories ── */}
      <section className="max-w-7xl mx-auto px-4 md:px-7 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Our Product Range</h2>
          <p className="text-gray-500 mt-2 max-w-xl mx-auto">
            6 categories covering every wiring application — residential, commercial, and industrial
          </p>
        </div>

        {catLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {Array(6).fill(0).map((_, i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package size={44} className="mx-auto mb-3 opacity-20" />
            <p className="font-semibold text-gray-500">Catalog being built — call us for full product range</p>
            <a href="tel:+918073533289" className="inline-flex items-center gap-2 mt-4 text-brand-600 font-semibold text-sm">
              +91 80735 33289 <ArrowRight size={14} />
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {categories.map(cat => {
              const Icon     = CATEGORY_ICONS[cat.slug] || Layers
              const gradient = CATEGORY_GRADIENTS[cat.color] || 'from-gray-500 to-gray-700'
              return (
                <button
                  key={cat.id}
                  onClick={() => navigate(`/portal/catalog?category=${cat.slug}`)}
                  className="group relative overflow-hidden rounded-2xl p-6 text-left bg-white border border-gray-100 shadow-card portal-card-hover cursor-pointer"
                >
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110`}>
                    <Icon size={22} className="text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-base mb-1.5 group-hover:text-brand-600 transition-colors">{cat.name}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{cat.description}</p>
                  <div className="flex items-center gap-1 mt-3 text-brand-500 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity translate-x-0 group-hover:translate-x-0.5 duration-150">
                    View Products <ChevronRight size={13} />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Featured Products ── */}
      {featuredProducts.length > 0 && (
        <section className="bg-gray-50/70 border-y border-gray-100 py-16">
          <div className="max-w-7xl mx-auto px-4 md:px-7">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">Featured Cables</h2>
                <p className="text-gray-500 text-sm mt-1">Our most popular and in-demand products</p>
              </div>
              <button
                onClick={() => navigate('/portal/catalog')}
                className="flex items-center gap-1.5 text-brand-600 text-sm font-bold hover:gap-2.5 transition-all"
              >
                View All <ArrowRight size={15} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {featuredProducts.map(product => {
                const g = CATEGORY_GRADIENTS[product.cable_categories?.color] || 'from-gray-400 to-gray-600'
                return (
                  <button
                    key={product.id}
                    onClick={() => navigate(`/portal/cable/${product.slug}`)}
                    className="group bg-white rounded-2xl shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5 text-left overflow-hidden cursor-pointer"
                  >
                    <div className={`h-1.5 bg-gradient-to-r ${g}`} />
                    <div className="p-5">
                      <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold text-white bg-gradient-to-r ${g} mb-3`}>
                        {product.cable_categories?.name}
                      </span>
                      <h3 className="font-bold text-gray-900 text-sm mb-1 group-hover:text-brand-600 transition-colors line-clamp-2 leading-snug">{product.name}</h3>
                      <p className="text-gray-400 text-xs mb-4">{product.standard} · {product.voltage_rating}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Click to view specs →</span>
                        <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center group-hover:bg-brand-500 transition-colors flex-shrink-0">
                          <ChevronRight size={13} className="text-brand-500 group-hover:text-white transition-colors" />
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Why Indocable ── */}
      <section className="max-w-7xl mx-auto px-4 md:px-7 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Why Choose Indocable</h2>
          <p className="text-gray-500 mt-2 max-w-xl mx-auto">
            Trusted by contractors, builders, and industrial buyers across India
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {TRUST_POINTS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-card text-center">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
                <Icon size={22} className="text-brand-500" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2 text-sm">{title}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Quick Enquiry / Contact ── */}
      <section
        className="py-16"
        style={{ background: 'linear-gradient(135deg, #0b1120 0%, #1c0300 100%)' }}
      >
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Get in Touch</h2>
          <p className="text-slate-400 mb-8">Tell us what you need — we respond within 2 hours during business hours</p>

          {submitted ? (
            <div className="bg-white/10 border border-white/10 rounded-2xl p-8">
              <CheckCircle2 size={44} className="text-emerald-400 mx-auto mb-3" />
              <h3 className="text-white font-black text-xl mb-2">Enquiry Received!</h3>
              <p className="text-slate-400 text-sm mb-6">Our team will contact you within 2 hours.</p>
              <a
                href="https://wa.me/918073533289?text=Hi, I just submitted an enquiry on the Indocable portal."
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm transition-colors"
              >
                <MessageCircle size={16} /> Also chat on WhatsApp
              </a>
            </div>
          ) : (
            <form onSubmit={handleQuickEnquiry} className="bg-white/10 border border-white/10 backdrop-blur-sm rounded-2xl p-6 space-y-4 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Your Name *</label>
                  <input
                    type="text" required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Rajesh Kumar"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white placeholder-slate-600 rounded-xl text-sm focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Phone Number *</label>
                  <input
                    type="tel" required
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                    placeholder="10-digit mobile number"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white placeholder-slate-600 rounded-xl text-sm focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">What do you need?</label>
                <textarea
                  rows={3}
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Cable type, quantity, project name, location... (optional)"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white placeholder-slate-600 rounded-xl text-sm focus:outline-none focus:border-brand-500 transition-colors resize-none"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 shadow-glow-orange"
                >
                  {submitting ? 'Submitting…' : 'Send Enquiry'}
                </button>
                <a
                  href="https://wa.me/918073533289?text=Hi, I'd like to enquire about Indocable cables"
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-colors"
                >
                  <MessageCircle size={16} /> WhatsApp
                </a>
              </div>
              <p className="text-center text-xs text-slate-600">
                Email: <a href="mailto:cables@micagroup.net" className="text-slate-400 hover:text-white">cables@micagroup.net</a>
                {' · '}
                <a href="mailto:sales@indocables.com" className="text-slate-400 hover:text-white">sales@indocables.com</a>
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
