import { useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../supabase'
import {
  Package, AlertTriangle, TrendingDown, TrendingUp,
  ArrowRight, PackagePlus, PackageMinus, ClipboardList,
  Users, Warehouse, Calculator, FlaskConical, Tag,
  History, MapPin, LayoutDashboard, Zap, BarChart2, Settings, Calendar,
  Factory, Truck, Wrench, CheckCircle2, Clock, ChevronRight,
  Pencil, RefreshCw, DollarSign
} from 'lucide-react'
import { Link } from 'react-router-dom'

const timeOfDay = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function useCountUp(target, duration = 800) {
  const [val, setVal] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    if (target === prev.current) return
    const start  = prev.current
    const diff   = target - start
    const startT = performance.now()
    function step(now) {
      const p = Math.min((now - startT) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(start + diff * ease))
      if (p < 1) requestAnimationFrame(step)
      else { prev.current = target; setVal(target) }
    }
    requestAnimationFrame(step)
  }, [target, duration])
  return val
}

// All features keyed by role
const ALL_FEATURES = [
  {
    to: '/materials',
    icon: Package,
    label: 'Materials',
    desc: 'Raw material catalog & stock levels',
    gradient: 'from-blue-500 to-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    roles: ['owner','admin','production_head','operator','qc_inspector'],
  },
  {
    to: '/stock-in',
    icon: PackagePlus,
    label: 'Stock In',
    desc: 'Record incoming raw material',
    gradient: 'from-emerald-500 to-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
    roles: ['owner','operator'],
  },
  {
    to: '/stock-out',
    icon: PackageMinus,
    label: 'Stock Out',
    desc: 'Issue material to production',
    gradient: 'from-[#f97316] to-[#c2410c]',
    bg: 'bg-brand-50',
    border: 'border-brand-100',
    roles: ['owner','operator','production_head'],
  },
  {
    to: '/stock-history',
    icon: ClipboardList,
    label: 'Stock History',
    desc: 'Full log of all movements',
    gradient: 'from-slate-600 to-slate-800',
    bg: 'bg-slate-50',
    border: 'border-slate-100',
    roles: ['owner','admin','production_head','operator'],
  },
  {
    to: '/store',
    icon: Warehouse,
    label: 'Store Room',
    desc: 'Store inventory overview',
    gradient: 'from-violet-500 to-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-100',
    roles: ['owner','admin','procurement','security_guard','production_head','operator','helper','qc_inspector'],
  },
  {
    to: '/store/items',
    icon: Tag,
    label: 'Item Catalog',
    desc: 'Browse all store room items',
    gradient: 'from-cyan-500 to-cyan-700',
    bg: 'bg-cyan-50',
    border: 'border-cyan-100',
    roles: ['owner','admin','procurement','security_guard','production_head','operator','helper','qc_inspector'],
  },
  {
    to: '/store/request?mode=inward',
    icon: PackagePlus,
    label: 'Store Inward',
    desc: 'Accept items into store',
    gradient: 'from-teal-500 to-teal-700',
    bg: 'bg-teal-50',
    border: 'border-teal-100',
    roles: ['owner','admin','procurement','security_guard'],
  },
  {
    to: '/store/request?mode=outward',
    icon: PackageMinus,
    label: 'Store Outward',
    desc: 'Dispatch items from store',
    gradient: 'from-amber-500 to-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    roles: ['owner','admin','procurement','security_guard','production_head','operator'],
  },
  {
    to: '/store/history',
    icon: History,
    label: 'Store History',
    desc: 'Store transaction log',
    gradient: 'from-rose-500 to-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-100',
    roles: ['owner','admin','procurement','security_guard','production_head','operator','helper','qc_inspector'],
  },
  {
    to: '/store/locations',
    icon: MapPin,
    label: 'Locations',
    desc: 'Manage zones & store rooms',
    gradient: 'from-pink-500 to-pink-700',
    bg: 'bg-pink-50',
    border: 'border-pink-100',
    roles: ['owner','admin'],
  },
  {
    to: '/quotations',
    icon: Calculator,
    label: 'Quotations',
    desc: 'Cable pricing & quotes',
    gradient: 'from-[#f97316] to-[#c2410c]',
    bg: 'bg-brand-50',
    border: 'border-brand-100',
    roles: ['owner','admin'],
  },
  {
    to: '/quotations/bom',
    icon: FlaskConical,
    label: 'BOM Materials',
    desc: 'Cable costing database',
    gradient: 'from-indigo-500 to-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-100',
    roles: ['owner','admin'],
  },
  {
    to: '/quotations/global',
    icon: BarChart2,
    label: 'Global Variables',
    desc: 'LME copper, electricity & labour rates',
    gradient: 'from-violet-500 to-purple-700',
    bg: 'bg-violet-50',
    border: 'border-violet-100',
    roles: ['owner','admin'],
  },
  {
    to: '/quotations/machines',
    icon: Settings,
    label: 'Machines',
    desc: 'Operating cost per process',
    gradient: 'from-slate-600 to-slate-800',
    bg: 'bg-slate-50',
    border: 'border-slate-100',
    roles: ['owner','admin'],
  },
  {
    to: '/quotations/drums',
    icon: Package,
    label: 'Drums & Packing',
    desc: 'Drum sizes, prices & capacity',
    gradient: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    roles: ['owner','admin'],
  },
  {
    to: '/labour',
    icon: Users,
    label: 'Employees',
    desc: 'Staff profiles & skills matrix',
    gradient: 'from-brand-500 to-brand-700',
    bg: 'bg-brand-50',
    border: 'border-brand-100',
    roles: ['owner','admin','production_head'],
  },
  {
    to: '/labour/shifts',
    icon: Calendar,
    label: 'Shift Planner',
    desc: 'Assign staff to machines daily',
    gradient: 'from-teal-500 to-cyan-700',
    bg: 'bg-teal-50',
    border: 'border-teal-100',
    roles: ['owner','admin','production_head'],
  },
  {
    to: '/production',
    icon: Factory,
    label: 'Production',
    desc: 'Orders, output tracking & QC',
    gradient: 'from-blue-500 to-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    roles: ['owner','admin','production_head','operator','qc_inspector'],
  },
  {
    to: '/dispatch',
    icon: Truck,
    label: 'Dispatch',
    desc: 'Delivery challans & customers',
    gradient: 'from-cyan-500 to-cyan-700',
    bg: 'bg-cyan-50',
    border: 'border-cyan-100',
    roles: ['owner','admin'],
  },
  {
    to: '/maintenance',
    icon: Wrench,
    label: 'Maintenance',
    desc: 'Breakdowns & PM schedule',
    gradient: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    roles: ['owner','admin','production_head'],
  },
  {
    to: '/users',
    icon: Users,
    label: 'Manage Users',
    desc: 'Team access & roles',
    gradient: 'from-purple-500 to-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-100',
    roles: ['owner'],
  },
]

function todayISO() { return new Date().toISOString().slice(0,10) }

// ── Live Market Prices Widget ─────────────────────────────────────────────────
function LiveMarketWidget({ profile }) {
  const [mkt, setMkt]         = useState({ usdInr: null, copper: null, aluminum: null, giWire: null, lmeCu: null, lmeAl: null, lastUpdated: null })
  const [editAl, setEditAl]   = useState(null)
  const [editGi, setEditGi]   = useState(null)
  const [saving, setSaving]   = useState(false)
  const [fetching, setFetching] = useState(false)
  const [avKey, setAvKey]       = useState(() => localStorage.getItem('av_api_key') || '')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const canEdit = ['owner', 'admin'].includes(profile.role)

  useEffect(() => {
    fetchAll()
    const t = setInterval(refreshRate, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  async function refreshRate() {
    try {
      const res  = await fetch('https://open.er-api.com/v6/latest/USD')
      const data = await res.json()
      const rate = data.rates?.INR
      if (!rate) return
      setMkt(prev => ({
        ...prev,
        usdInr:  rate,
        copper:  prev.lmeCu != null ? ((prev.lmeCu) * rate / 1000) : prev.copper,
        aluminum: prev.lmeAl != null ? (prev.lmeAl * rate / 1000) : prev.aluminum,
        lastUpdated: new Date(),
      }))
    } catch {}
  }

  async function fetchAll() {
    setFetching(true)
    const { data: vars } = await supabase
      .from('global_variables')
      .select('key, value')
      .in('key', ['lme_usd_per_tonne', 'lme_premium_usd', 'usd_to_inr', 'lme_aluminum_usd', 'gi_wire_price'])

    const m = Object.fromEntries((vars || []).map(v => [v.key, parseFloat(v.value) || 0]))

    // Auto-fetch from Alpha Vantage if API key is configured and cache is stale (>6h)
    const key = localStorage.getItem('av_api_key') || ''
    if (key) {
      const lastFetch = parseInt(localStorage.getItem('av_last_fetch') || '0')
      if (Date.now() - lastFetch > 6 * 3600 * 1000) {
        try {
          const [cuRes, alRes] = await Promise.all([
            fetch(`https://www.alphavantage.co/query?function=COPPER&interval=monthly&apikey=${key}`),
            fetch(`https://www.alphavantage.co/query?function=ALUMINUM&interval=monthly&apikey=${key}`)
          ])
          const cuData = await cuRes.json()
          const alData = await alRes.json()
          // Copper unit: "cents per pound" → USD/tonne (1 tonne = 2204.62 lb)
          const cuCents = parseFloat(cuData.data?.[0]?.value)
          if (cuCents > 100) {
            const cuUsdT = Math.round(cuCents * 22.0462)
            m.lme_usd_per_tonne = cuUsdT
            await saveVar('lme_usd_per_tonne', cuUsdT, 'LME Copper (USD/MT)', 'lme_copper')
            await saveVar('lme_premium_usd', m.lme_premium_usd || 0, 'LME Premium (USD/MT)', 'lme_copper')
          }
          // Aluminum unit: "US dollars per metric ton" → already USD/tonne
          const alUsd = parseFloat(alData.data?.[0]?.value)
          if (alUsd > 500) {
            m.lme_aluminum_usd = Math.round(alUsd)
            await saveVar('lme_aluminum_usd', Math.round(alUsd), 'LME Aluminum (USD/MT)', 'lme_aluminum')
          }
          localStorage.setItem('av_last_fetch', String(Date.now()))
        } catch { /* silently degrade to stored values */ }
      }
    }

    const storedRate = m.usd_to_inr || 84
    let liveRate = storedRate
    try {
      const res  = await fetch('https://open.er-api.com/v6/latest/USD')
      const data = await res.json()
      if (data.rates?.INR) liveRate = data.rates.INR
    } catch {}

    const lmeCu = m.lme_usd_per_tonne ? (m.lme_usd_per_tonne + (m.lme_premium_usd || 0)) : null
    const lmeAl = m.lme_aluminum_usd  || null

    setMkt({
      usdInr:      liveRate,
      copper:      lmeCu  != null ? (lmeCu  * liveRate / 1000) : null,
      aluminum:    lmeAl  != null ? (lmeAl  * liveRate / 1000) : null,
      giWire:      m.gi_wire_price || null,
      lmeCu,
      lmeAl,
      lastUpdated: new Date(),
    })
    setFetching(false)
  }

  async function saveVar(key, val, label, category) {
    const { data: existing } = await supabase.from('global_variables').select('id').eq('key', key).maybeSingle()
    const { error } = existing
      ? await supabase.from('global_variables').update({ value: val }).eq('key', key)
      : await supabase.from('global_variables').insert({ key, value: val, label, category })
    if (error) toast.error(error.message)
  }

  async function saveAl() {
    const val = parseFloat(editAl)
    if (!val) { setEditAl(null); return }
    setSaving(true)
    await saveVar('lme_aluminum_usd', val, 'LME Aluminum (USD/MT)', 'lme_aluminum')
    setSaving(false); setEditAl(null); fetchAll()
  }

  async function saveGi() {
    const val = parseFloat(editGi)
    if (!val) { setEditGi(null); return }
    setSaving(true)
    await saveVar('gi_wire_price', val, 'GI Wire (INR/kg)', 'gi_wire')
    setSaving(false); setEditGi(null); fetchAll()
  }

  function saveKey() {
    const k = keyInput.trim()
    localStorage.setItem('av_api_key', k)
    localStorage.removeItem('av_last_fetch') // force re-fetch on next fetchAll
    setAvKey(k)
    setShowKeyInput(false)
    setKeyInput('')
    if (k) fetchAll()
  }

  function clearKey() {
    localStorage.removeItem('av_api_key')
    localStorage.removeItem('av_last_fetch')
    setAvKey('')
    setShowKeyInput(false)
    setKeyInput('')
  }

  const fmt = (n) => n != null ? Math.round(n).toLocaleString('en-IN') : '—'

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-brand-500" />
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Market Prices</span>
          {avKey && (
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">Auto-sync</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mkt.lastUpdated && (
            <span className="text-[11px] text-gray-400">
              {mkt.lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {canEdit && (
            <button onClick={() => { setShowKeyInput(s => !s); setKeyInput(avKey) }}
              className={`transition-colors cursor-pointer ${showKeyInput ? 'text-brand-500' : 'text-gray-400 hover:text-gray-600'}`}
              title="Configure Alpha Vantage API key for live LME prices">
              <Settings size={12} />
            </button>
          )}
          <button onClick={fetchAll} disabled={fetching}
            className="text-gray-400 hover:text-brand-500 transition-colors cursor-pointer disabled:opacity-40">
            <RefreshCw size={13} className={fetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {showKeyInput && (
        <div className="mb-3 flex gap-2 items-center p-2.5 rounded-xl bg-gray-50 border border-gray-200">
          <Settings size={11} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            placeholder="Alpha Vantage API key — free at alphavantage.co"
            onKeyDown={e => { if (e.key === 'Enter') saveKey(); if (e.key === 'Escape') setShowKeyInput(false) }}
            className="flex-1 text-xs bg-transparent border-0 focus:outline-none text-gray-700 placeholder-gray-400 min-w-0"
            autoFocus
          />
          <button onClick={saveKey}
            className="text-[11px] bg-brand-500 text-white px-2.5 py-1 rounded-lg cursor-pointer flex-shrink-0">
            Save
          </button>
          {avKey && (
            <button onClick={clearKey}
              className="text-[11px] text-red-400 hover:text-red-600 cursor-pointer flex-shrink-0">
              Clear
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* USD/INR */}
        <div className="rounded-xl p-3 border border-emerald-100 bg-emerald-50">
          <div className="flex items-center gap-1 mb-1">
            <DollarSign size={10} className="text-emerald-600" />
            <span className="text-[11px] font-semibold text-emerald-700">USD / INR</span>
          </div>
          <div className="text-xl font-bold text-emerald-800 tabular-nums">
            {mkt.usdInr ? `₹${mkt.usdInr.toFixed(2)}` : '…'}
          </div>
          <div className="text-[10px] text-emerald-500 mt-0.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            Live rate
          </div>
        </div>

        {/* LME Copper */}
        <div className="rounded-xl p-3 border border-amber-100 bg-amber-50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-amber-700">LME Copper</span>
            {avKey && <span className="text-[9px] bg-amber-200 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Auto</span>}
          </div>
          <div className="text-xl font-bold text-amber-800 tabular-nums">
            {mkt.copper != null ? `₹${fmt(mkt.copper)}/kg` : '—'}
          </div>
          <div className="text-[10px] text-amber-500 mt-0.5">
            {mkt.lmeCu ? `$${Math.round(mkt.lmeCu).toLocaleString()}/MT` : avKey ? 'Fetching…' : 'Set in Global Vars'}
          </div>
        </div>

        {/* LME Aluminum */}
        <div className="rounded-xl p-3 border border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-slate-600">LME Aluminum</span>
            <div className="flex items-center gap-1">
              {avKey && <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-medium">Auto</span>}
              {canEdit && editAl === null && (
                <button onClick={() => setEditAl(String(mkt.lmeAl || ''))}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"><Pencil size={10} /></button>
              )}
            </div>
          </div>
          {editAl !== null ? (
            <div className="flex gap-1 mt-1">
              <input type="number" value={editAl} onChange={e => setEditAl(e.target.value)}
                placeholder="USD/MT" autoFocus
                onKeyDown={e => { if (e.key === 'Enter') saveAl(); if (e.key === 'Escape') setEditAl(null) }}
                className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              <button onClick={saveAl} disabled={saving}
                className="text-[11px] bg-brand-500 text-white px-2 rounded-lg cursor-pointer">✓</button>
            </div>
          ) : (
            <>
              <div className="text-xl font-bold text-slate-700 tabular-nums">
                {mkt.aluminum != null ? `₹${fmt(mkt.aluminum)}/kg` : '—'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {mkt.lmeAl ? `$${Math.round(mkt.lmeAl).toLocaleString()}/MT` : canEdit ? 'Tap ✏ to set' : '—'}
              </div>
            </>
          )}
        </div>

        {/* GI Wire */}
        <div className="rounded-xl p-3 border border-blue-100 bg-blue-50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-blue-700">GI Wire</span>
            {canEdit && editGi === null && (
              <button onClick={() => setEditGi(String(mkt.giWire || ''))}
                className="text-blue-400 hover:text-blue-600 cursor-pointer"><Pencil size={10} /></button>
            )}
          </div>
          {editGi !== null ? (
            <div className="flex gap-1 mt-1">
              <input type="number" value={editGi} onChange={e => setEditGi(e.target.value)}
                placeholder="₹/kg" autoFocus
                onKeyDown={e => { if (e.key === 'Enter') saveGi(); if (e.key === 'Escape') setEditGi(null) }}
                className="w-full text-xs border border-blue-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              <button onClick={saveGi} disabled={saving}
                className="text-[11px] bg-brand-500 text-white px-2 rounded-lg cursor-pointer">✓</button>
            </div>
          ) : (
            <>
              <div className="text-xl font-bold text-blue-700 tabular-nums">
                {mkt.giWire ? `₹${fmt(mkt.giWire)}/kg` : '—'}
              </div>
              <div className="text-[10px] text-blue-500 mt-0.5">
                {mkt.giWire ? 'Manual rate' : canEdit ? 'Tap ✏ to set' : '—'}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const PROD_STATUS_COLOR = {
  planned:     'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  qc:          'bg-violet-100 text-violet-700',
  done:        'bg-emerald-100 text-emerald-700',
}

export default function Dashboard({ profile }) {
  const [stats, setStats]             = useState({ total: 0, lowStock: 0, activeOrders: 0, presentToday: 0 })
  const [lowStockItems, setLowStockItems]   = useState([])
  const [activeOrders,  setActiveOrders]    = useState([])
  const [pendingLeaves, setPendingLeaves]   = useState(0)
  const [openBreakdowns,setOpenBreakdowns]  = useState(0)
  const [todayAtt,      setTodayAtt]        = useState({ present:0, absent:0, total:0 })
  const [loading, setLoading]               = useState(true)

  const total        = useCountUp(stats.total)
  const lowStock     = useCountUp(stats.lowStock)
  const activeCount  = useCountUp(stats.activeOrders)
  const presentCount = useCountUp(stats.presentToday)

  useEffect(() => { fetchStats() }, [])

  async function fetchStats() {
    const since7d = new Date(Date.now() - 7 * 86400000).toISOString()
    const today   = todayISO()

    const [
      { data: materials },
      { data: prodOrders },
      { data: attToday },
      { data: leaves },
      { data: breakdowns },
    ] = await Promise.all([
      supabase.from('materials').select('id,name,unit,current_stock,min_stock_level').eq('is_active', true),
      supabase.from('production_orders')
        .select('id,order_number,product_name,target_quantity,unit,status,planned_date,production_output(*)')
        .in('status', ['planned','in_progress','qc'])
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('attendance').select('employee_id,status').eq('date', today),
      supabase.from('leave_requests').select('id').eq('status','pending'),
      supabase.from('machine_breakdowns').select('id').eq('status','open'),
    ])

    const low = (materials || []).filter(m => m.current_stock <= m.min_stock_level && m.min_stock_level > 0)
    setLowStockItems(low)
    setActiveOrders(prodOrders || [])
    setPendingLeaves((leaves || []).length)
    setOpenBreakdowns((breakdowns || []).length)

    const att = attToday || []
    const present = att.filter(a => a.status === 'present' || a.status === 'half_day').length
    setTodayAtt({ present, absent: att.filter(a=>a.status==='absent').length, total: att.length })

    setStats({
      total:        (materials || []).length,
      lowStock:     low.length,
      activeOrders: (prodOrders || []).filter(o=>o.status==='in_progress').length,
      presentToday: present,
    })
    setLoading(false)
  }

  const firstName   = profile.full_name?.split(' ')[0] || 'there'
  const visibleFeatures = ALL_FEATURES.filter(f => f.roles.includes(profile.role))

  return (
    <div className="space-y-8">

      {/* Hero header */}
      <div className="relative rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0b1120 0%, #1a0a00 60%, #0b1120 100%)' }}>
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #f97316, transparent 70%)', transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #c2410c, transparent 70%)', transform: 'translate(-30%, 30%)' }} />

        <div className="relative px-7 py-8 flex items-center justify-between gap-6">
          <div>
            <p className="text-brand-400 text-sm font-semibold mb-1 tracking-wide">{timeOfDay()}</p>
            <h1 className="text-3xl font-bold text-white tracking-tight">{firstName}</h1>
            <p className="text-slate-400 text-sm mt-1.5 max-w-xs">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-slate-300">Live System</span>
          </div>
        </div>
      </div>

      {/* Market prices */}
      {['owner','admin'].includes(profile.role) && <LiveMarketWidget profile={profile} />}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Package,       label: 'Total Materials',    value: total,        iconColor: 'text-brand-500',   iconBg: 'bg-brand-50',   ring: false,              to: '/materials' },
          { icon: AlertTriangle, label: 'Low Stock Alerts',   value: lowStock,     iconColor: 'text-red-500',     iconBg: 'bg-red-50',     ring: stats.lowStock > 0, to: '/materials' },
          { icon: Factory,       label: 'Orders In Progress', value: activeCount,  iconColor: 'text-blue-600',    iconBg: 'bg-blue-50',    ring: false,              to: '/production' },
          { icon: Users,         label: 'Present Today',      value: presentCount, iconColor: 'text-emerald-600', iconBg: 'bg-emerald-50', ring: false,              to: '/labour/attendance' },
        ].map(({ icon: Icon, label, value, iconColor, iconBg, ring, to }) => (
          <Link key={label} to={to} className={`card p-5 transition-all duration-200 hover:shadow-card-hover cursor-pointer ${ring ? 'ring-2 ring-red-200' : ''}`}>
            <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center mb-3`}>
              <Icon size={18} className={iconColor} />
            </div>
            <div className="text-2xl font-bold text-gray-900 tracking-tight">{value}</div>
            <div className="text-xs font-medium text-gray-500 mt-0.5">{label}</div>
          </Link>
        ))}
      </div>

      {/* Alert badges row */}
      {(pendingLeaves > 0 || openBreakdowns > 0) && (
        <div className="flex flex-wrap gap-3">
          {pendingLeaves > 0 && (
            <Link to="/labour/leaves" className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 hover:bg-amber-100 transition-colors">
              <Clock size={14} className="text-amber-600"/>
              <span className="text-amber-800 text-sm font-semibold">{pendingLeaves} pending leave request{pendingLeaves!==1?'s':''}</span>
              <ChevronRight size={13} className="text-amber-400"/>
            </Link>
          )}
          {openBreakdowns > 0 && (
            <Link to="/maintenance" className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 hover:bg-red-100 transition-colors">
              <Wrench size={14} className="text-red-500"/>
              <span className="text-red-700 text-sm font-semibold">{openBreakdowns} open breakdown{openBreakdowns!==1?'s':''}</span>
              <ChevronRight size={13} className="text-red-300"/>
            </Link>
          )}
        </div>
      )}

      {/* Live panels */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Active production orders */}
        {['owner','admin','production_head','operator','qc_inspector'].includes(profile.role) && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Factory size={15} className="text-blue-500"/>
                <span className="font-semibold text-gray-800 text-sm">Active Production Orders</span>
              </div>
              <Link to="/production" className="text-[12px] text-brand-600 font-semibold hover:text-brand-700 flex items-center gap-1">
                View all <ChevronRight size={12}/>
              </Link>
            </div>
            {loading ? (
              <div className="divide-y divide-gray-50">
                {[...Array(3)].map((_,i) => (
                  <div key={i} className="px-5 py-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="skeleton h-4 w-16 rounded-md"/>
                        <div className="skeleton h-4 w-32 rounded-md"/>
                      </div>
                      <div className="skeleton h-3.5 w-20 rounded-md"/>
                    </div>
                    <div className="skeleton h-1.5 w-full rounded-full"/>
                  </div>
                ))}
              </div>
            ) : activeOrders.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">No active orders</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {activeOrders.map(order => {
                  const produced = (order.production_output||[]).reduce((s,r)=>s+(parseFloat(r.quantity)||0),0)
                  const pct      = order.target_quantity > 0 ? Math.min(100, Math.round((produced/order.target_quantity)*100)) : 0
                  const isLate   = order.planned_date && order.planned_date < todayISO()
                  return (
                    <Link key={order.id} to="/production" className="block px-5 py-3.5 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${PROD_STATUS_COLOR[order.status]}`}>{order.status.replace('_',' ').toUpperCase()}</span>
                          <span className="text-[13px] font-semibold text-gray-800 truncate">{order.product_name}</span>
                          {isLate && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md border border-red-200 flex-shrink-0">LATE</span>}
                        </div>
                        <span className="text-[12px] text-gray-500 flex-shrink-0 ml-2">{produced}/{order.target_quantity} {order.unit}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-1.5 rounded-full transition-all ${pct>=100?'bg-emerald-500':order.status==='in_progress'?'bg-blue-500':'bg-slate-400'}`} style={{width:`${pct}%`}}/>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Today's attendance + low stock */}
        <div className="space-y-4">
          {/* Attendance */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-500"/>
                <span className="font-semibold text-gray-800 text-sm">Today's Attendance</span>
              </div>
              <Link to="/labour/attendance" className="text-[12px] text-brand-600 font-semibold hover:text-brand-700">Mark →</Link>
            </div>
            {loading ? (
              <div className="flex items-center gap-4">
                <div className="skeleton h-8 w-10 rounded-md"/>
                <div className="skeleton h-2 flex-1 rounded-full"/>
                <div className="skeleton h-8 w-10 rounded-md"/>
              </div>
            ) : todayAtt.total === 0 ? (
              <div className="text-gray-400 text-sm text-center py-2">
                Not marked yet today —{' '}
                <Link to="/labour/attendance" className="text-brand-600 font-semibold hover:text-brand-700">Mark now →</Link>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600">{todayAtt.present}</div>
                  <div className="text-[11px] text-gray-400">Present</div>
                </div>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden flex">
                  <div className="bg-emerald-500 h-2" style={{width:`${todayAtt.total>0?(todayAtt.present/todayAtt.total)*100:0}%`}}/>
                  <div className="bg-red-400 h-2" style={{width:`${todayAtt.total>0?(todayAtt.absent/todayAtt.total)*100:0}%`}}/>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-500">{todayAtt.absent}</div>
                  <div className="text-[11px] text-gray-400">Absent</div>
                </div>
              </div>
            )}
          </div>

          {/* Low stock */}
          {lowStockItems.length > 0 && (
            <div className="rounded-2xl overflow-hidden border border-red-100" style={{ background: 'linear-gradient(135deg, #fef2f2, #fff5f5)' }}>
              <div className="flex items-center gap-2 px-5 py-3 border-b border-red-100">
                <AlertTriangle size={13} className="text-red-500"/>
                <span className="font-semibold text-red-700 text-sm">Low Stock</span>
                <span className="ml-auto text-[11px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-lg">{lowStockItems.length}</span>
              </div>
              <div className="px-4 py-3 space-y-1.5 max-h-36 overflow-y-auto">
                {lowStockItems.map(item => (
                  <Link key={item.id} to="/materials" className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-red-50 hover:bg-red-50 transition-colors">
                    <span className="text-[13px] font-semibold text-gray-800 truncate">{item.name}</span>
                    <div className="text-right ml-3 flex-shrink-0">
                      <div className="text-[12px] font-bold text-red-600">{item.current_stock} {item.unit}</div>
                      <div className="text-[10px] text-gray-400">min: {item.min_stock_level}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Feature grid — ALL nav items */}
      <div>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Features</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {visibleFeatures.map(({ to, icon: Icon, label, desc, gradient, bg, border }) => (
            <Link
              key={to}
              to={to}
              className={`group relative card border ${border} p-4 flex flex-col gap-3 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden`}
            >
              {/* Subtle gradient blob on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-[0.04] transition-opacity duration-200 rounded-2xl`} />

              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                <Icon size={18} className="text-white" />
              </div>

              <div className="flex-1">
                <div className="font-semibold text-gray-800 text-sm leading-tight">{label}</div>
                <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">{desc}</div>
              </div>

              <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-600 group-hover:translate-x-0.5 transition-all duration-150" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
