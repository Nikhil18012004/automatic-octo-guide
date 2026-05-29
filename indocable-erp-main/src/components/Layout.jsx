import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { supabase } from '../supabase'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, Package, PackagePlus, PackageMinus,
  ClipboardList, Users, LogOut, Menu, X, ShieldCheck,
  Calculator, FlaskConical, Warehouse, Tag, History, MapPin,
  BarChart2, Settings, Calendar, Clock, CheckCircle2,
  Umbrella, IndianRupee, TrendingUp, CreditCard, Factory,
  Truck, Wrench, ShoppingCart, Boxes, ChevronDown, ChevronRight,
  Search, Undo2, ClipboardCheck, Globe, MessageSquare, Eye,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { playNav, playClick } from '../lib/sound'

export const roleLabels = {
  owner:           'Owner',
  admin:           'Admin',
  production_head: 'Supervisor',
  operator:        'Operator',
  qc_inspector:    'QC Inspector',
  procurement:     'Procurement',
  security_guard:  'Security Guard',
  helper:          'Helper',
  dealer:          'Dealer',
  client:          'Client',
}

const roleBadgeBg = {
  owner:           'bg-amber-400/15 text-amber-300 border-amber-400/20',
  admin:           'bg-purple-400/15 text-purple-300 border-purple-400/20',
  production_head: 'bg-blue-400/15 text-blue-300 border-blue-400/20',
  operator:        'bg-brand-500/15 text-brand-300 border-brand-500/20',
  qc_inspector:    'bg-emerald-400/15 text-emerald-300 border-emerald-400/20',
  procurement:     'bg-cyan-400/15 text-cyan-300 border-cyan-400/20',
  security_guard:  'bg-red-400/15 text-red-300 border-red-400/20',
  helper:          'bg-slate-400/15 text-slate-300 border-slate-400/20',
  dealer:          'bg-teal-400/15 text-teal-300 border-teal-400/20',
  client:          'bg-indigo-400/15 text-indigo-300 border-indigo-400/20',
}

const NAV_GROUPS = [
  {
    id: 'top',
    label: null,
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['owner','admin','production_head','operator','qc_inspector'] },
    ],
  },
  {
    id: 'inventory',
    label: 'Raw Materials',
    items: [
      { to: '/materials',     icon: Package,       label: 'Materials List',   roles: ['owner','admin','production_head','operator','qc_inspector'] },
      { to: '/stock-in',      icon: PackagePlus,   label: 'Material Inward',  roles: ['owner','operator'] },
      { to: '/stock-out',     icon: PackageMinus,  label: 'Issue to Floor',   roles: ['owner','operator','production_head'] },
      { to: '/stock-history', icon: ClipboardList, label: 'Material Log',     roles: ['owner','admin','production_head','operator'] },
    ],
  },
  {
    id: 'store',
    label: 'General Store',
    items: [
      { to: '/store',          icon: Warehouse,      label: 'Store',           roles: ['owner','admin','procurement','security_guard','production_head','operator','helper','qc_inspector'] },
      { to: '/store/items',    icon: Tag,            label: 'Items List',      roles: ['owner','admin','procurement','security_guard','production_head','operator','helper','qc_inspector'] },
      { to: '/store/receive',  icon: PackagePlus,    label: 'Store Inward',    roles: ['owner','admin','procurement','security_guard'] },
      { to: '/store/issue',    icon: PackageMinus,   label: 'Store Outward',   roles: ['owner','admin','procurement','security_guard','production_head','operator'] },
      { to: '/store/return',   icon: Undo2,          label: 'Return Items',    roles: ['owner','admin','procurement','security_guard','production_head','operator'] },
      { to: '/store/adjust',   icon: ClipboardCheck, label: 'Stock Count',     roles: ['owner','admin'] },
      { to: '/store/history',  icon: History,        label: 'Movement Log',    roles: ['owner','admin','procurement','security_guard','production_head','operator','helper','qc_inspector'] },
      { to: '/store/locations',icon: MapPin,         label: 'Shelves & Racks', roles: ['owner','admin'] },
      { to: '/store/request',  icon: ShieldCheck,   label: 'Store Code Request', roles: ['owner','admin','procurement','security_guard','production_head','operator','helper'] },
      { to: '/store/requests', icon: Eye,           label: 'Code Monitor', roles: ['owner','admin','procurement','security_guard','production_head','operator','helper'] },
    ],
  },
  {
    id: 'quotations',
    label: 'Quotations',
    items: [
      { to: '/quotations',          icon: Calculator,   label: 'Quotations',       roles: ['owner','admin'] },
      { to: '/quotations/bom',      icon: FlaskConical, label: 'BOM Materials',    roles: ['owner','admin'] },
      { to: '/quotations/global',   icon: BarChart2,    label: 'Global Variables', roles: ['owner','admin'] },
      { to: '/quotations/machines', icon: Settings,     label: 'Machines',         roles: ['owner','admin'] },
      { to: '/quotations/drums',    icon: Package,      label: 'Drums & Packing',  roles: ['owner','admin'] },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { to: '/production',      icon: Factory,      label: 'Production',      roles: ['owner','admin','production_head','operator','qc_inspector'] },
      { to: '/dispatch',        icon: Truck,        label: 'Dispatch',        roles: ['owner','admin'] },
      { to: '/purchase-orders', icon: ShoppingCart, label: 'Purchase Orders', roles: ['owner','admin'] },
      { to: '/job-work',        icon: Boxes,        label: 'Job Work',        roles: ['owner','admin','procurement'] },
      { to: '/maintenance',     icon: Wrench,       label: 'Maintenance',     roles: ['owner','admin','production_head'] },
    ],
  },
  {
    id: 'hr',
    label: 'HR & Labour',
    items: [
      { to: '/labour',                 icon: Users,        label: 'Employees',        roles: ['owner','admin','production_head'] },
      { to: '/labour/shifts',          icon: Calendar,     label: 'Shift Planner',    roles: ['owner','admin','production_head'] },
      { to: '/labour/shift-templates', icon: Clock,        label: 'Shift Templates',  roles: ['owner','admin','production_head'] },
      { to: '/labour/attendance',      icon: CheckCircle2, label: 'Attendance',       roles: ['owner','admin','production_head'] },
      { to: '/labour/leaves',          icon: Umbrella,     label: 'Leave Management', roles: ['owner','admin','production_head'] },
      { to: '/labour/payroll',         icon: IndianRupee,  label: 'Payroll',          roles: ['owner','admin'] },
      { to: '/labour/advances',        icon: CreditCard,   label: 'Salary Advances',  roles: ['owner','admin'] },
      { to: '/labour/reports',         icon: TrendingUp,   label: 'HR Reports',       roles: ['owner','admin'] },
    ],
  },
  {
    id: 'portal',
    label: 'Customer Portal',
    items: [
      { to: '/catalog-admin', icon: Globe,         label: 'Cable Catalog',    roles: ['owner','admin'] },
      { to: '/enquiry-admin', icon: MessageSquare, label: 'Enquiry Inbox',    roles: ['owner','admin'] },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    items: [
      { to: '/users', icon: ShieldCheck, label: 'Manage Users', roles: ['owner'] },
    ],
  },
]

function getInitials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

function SidebarNav({ profile, openGroups, toggleGroup, t, i18n, setLang, handleLogout, onNavClick }) {
  return (
    <div className="flex flex-col h-full" style={{ background: '#0b1120' }}>

      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5 flex-shrink-0">
        <img
          src="/logo.jpg"
          alt="Indocable"
          className="w-9 h-9 rounded-xl object-cover ring-2 ring-brand-500/40"
        />
        <div>
          <div className="text-white font-bold text-[16px] leading-tight tracking-tight">Indocable</div>
          <div className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase mt-0.5">ERP System</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 py-3 overflow-y-auto sidebar-scroll space-y-0.5">
        {NAV_GROUPS.map(group => {
          const visible = group.items.filter(item => item.roles.includes(profile.role))
          if (visible.length === 0) return null

          const isOpen = !group.label || !!openGroups[group.id]

          return (
            <div key={group.id}>
              {/* Section header */}
              {group.label && (
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-2 pt-3.5 pb-1 cursor-pointer group/gh select-none"
                >
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest group-hover/gh:text-slate-400 transition-colors">
                    {group.label}
                  </span>
                  <ChevronDown
                    size={11}
                    className={`text-slate-600 group-hover/gh:text-slate-400 transition-all duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                  />
                </button>
              )}

              {/* Items with smooth collapse */}
              <div
                className="overflow-hidden"
                style={{
                  maxHeight: isOpen ? `${visible.length * 44}px` : '0',
                  transition: 'max-height 0.22s ease-out',
                }}
              >
                <div className="space-y-0.5 py-0.5">
                  {visible.map(({ to, icon: Icon, label, tKey }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === '/'}
                      onClick={() => { playNav(); onNavClick() }}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 cursor-pointer select-none px-3 py-2
                         ${isActive
                           ? 'bg-brand-500 text-white shadow-glow-orange'
                           : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                         }`
                      }
                    >
                      <Icon size={15} className="flex-shrink-0 opacity-80" />
                      <span className="truncate">{tKey ? t(tKey) : label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </nav>

      {/* Language switcher */}
      <div className="px-3 pb-2 flex-shrink-0">
        <div className="flex gap-1 bg-white/[0.04] rounded-xl p-1 border border-white/[0.06]">
          {[{ code: 'en', label: 'EN' }, { code: 'hi', label: 'हि' }, { code: 'kn', label: 'ಕ' }].map(({ code, label }) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-150 cursor-pointer
                ${i18n.language === code
                  ? 'bg-brand-500 text-white'
                  : 'text-slate-500 hover:text-slate-300'
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.04] transition-colors group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{getInitials(profile.full_name)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-[13px] font-semibold truncate leading-tight">{profile.full_name}</div>
            <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md mt-0.5 border ${roleBadgeBg[profile.role]}`}>
              {profile.role === 'owner' && <ShieldCheck size={8} />}
              {roleLabels[profile.role]}
            </span>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="text-slate-600 hover:text-brand-400 transition-colors cursor-pointer p-1 rounded-lg hover:bg-white/5 opacity-0 group-hover:opacity-100"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Command Palette ───────────────────────────────────────────────────────────
function CommandPalette({ isOpen, onClose, profile }) {
  const navigate  = useNavigate()
  const inputRef  = useRef(null)
  const [query,    setQuery]    = useState('')
  const [selected, setSelected] = useState(0)

  const allItems = useMemo(() =>
    NAV_GROUPS.flatMap(g =>
      g.items
        .filter(i => i.roles.includes(profile.role))
        .map(i => ({ ...i, group: g.label }))
    )
  , [profile.role])

  const results = useMemo(() => {
    if (!query.trim()) return allItems.slice(0, 9)
    const q = query.toLowerCase()
    return allItems.filter(i =>
      i.label.toLowerCase().includes(q) ||
      (i.group || '').toLowerCase().includes(q)
    ).slice(0, 9)
  }, [query, allItems])

  useEffect(() => {
    if (isOpen) { setQuery(''); setSelected(0); setTimeout(() => inputRef.current?.focus(), 40) }
  }, [isOpen])

  useEffect(() => { setSelected(0) }, [query])

  function go(item) { navigate(item.to); onClose() }

  function handleKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) go(results[selected])
    if (e.key === 'Escape') onClose()
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[14vh] px-4" onKeyDown={handleKey}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-up">

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Go to page…"
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
          />
          <kbd className="hidden sm:inline text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono border border-gray-200">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center text-gray-400 text-sm">No pages found for "{query}"</div>
          ) : results.map((item, i) => (
            <button
              key={item.to}
              onClick={() => go(item)}
              onMouseEnter={() => setSelected(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                i === selected ? 'bg-brand-50' : 'hover:bg-gray-50'
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                i === selected ? 'bg-brand-500' : 'bg-gray-100'
              }`}>
                <item.icon size={14} className={i === selected ? 'text-white' : 'text-gray-400'} />
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-[13px] font-semibold ${i === selected ? 'text-brand-700' : 'text-gray-700'}`}>
                  {item.label}
                </span>
                {item.group && (
                  <span className={`text-xs ml-2 ${i === selected ? 'text-brand-400' : 'text-gray-400'}`}>
                    {item.group}
                  </span>
                )}
              </div>
              {i === selected && <ChevronRight size={13} className="text-brand-400 flex-shrink-0" />}
            </button>
          ))}
        </div>

        {/* Footer hints */}
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/60 flex items-center gap-4">
          {[['↑↓', 'navigate'], ['↵', 'open'], ['Esc', 'close']].map(([key, hint]) => (
            <span key={key} className="flex items-center gap-1 text-[11px] text-gray-400">
              <kbd className="bg-white border border-gray-200 text-gray-500 px-1.5 py-0.5 rounded text-[10px] font-mono shadow-sm">{key}</kbd>
              {hint}
            </span>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

function useBreadcrumb(pathname) {
  let best = null, bestLen = -1
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.to || (item.to !== '/' && pathname.startsWith(item.to))) {
        if (item.to.length > bestLen) {
          best = { group: group.label, page: item.label }
          bestLen = item.to.length
        }
      }
    }
  }
  return best || { group: null, page: 'Dashboard' }
}

function useClock() {
  const fmt = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const [time, setTime] = useState(fmt)
  useEffect(() => {
    const id = setInterval(() => setTime(fmt()), 30000)
    return () => clearInterval(id)
  }, [])
  return time
}

export default function Layout({ profile }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { t, i18n } = useTranslation()
  const breadcrumb = useBreadcrumb(location.pathname)
  const clock      = useClock()

  const [openGroups, setOpenGroups] = useState(() => {
    try { return JSON.parse(localStorage.getItem('erp_sidebar_groups') || '{}') }
    catch { return {} }
  })
  const [cmdOpen, setCmdOpen] = useState(false)

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(v => !v) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Auto-expand the group that contains the current route
  useEffect(() => {
    for (const group of NAV_GROUPS) {
      if (!group.label) continue
      const active = group.items.some(item =>
        location.pathname === item.to ||
        (item.to !== '/' && location.pathname.startsWith(item.to))
      )
      if (active) {
        setOpenGroups(prev => {
          if (prev[group.id]) return prev
          const next = { ...prev, [group.id]: true }
          localStorage.setItem('erp_sidebar_groups', JSON.stringify(next))
          return next
        })
        break
      }
    }
  }, [location.pathname])

  function toggleGroup(id) {
    setOpenGroups(prev => {
      const next = { ...prev, [id]: !prev[id] }
      localStorage.setItem('erp_sidebar_groups', JSON.stringify(next))
      return next
    })
  }

  function setLang(code) {
    playClick()
    i18n.changeLanguage(code)
    localStorage.setItem('lang', code)
  }

  async function handleLogout() {
    playClick()
    await supabase.auth.signOut()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  const sidebarProps = {
    profile,
    openGroups,
    toggleGroup,
    t,
    i18n,
    setLang,
    handleLogout,
    onNavClick: () => setSidebarOpen(false),
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[220px] flex-shrink-0" style={{ boxShadow: '1px 0 0 rgba(0,0,0,0.08)' }}>
        <SidebarNav {...sidebarProps} />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-[240px] z-50 shadow-2xl" style={{ animation: 'slideSidebarIn 0.22s ease-out' }}>
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10 cursor-pointer p-1"
            >
              <X size={18} />
            </button>
            <SidebarNav {...sidebarProps} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile topbar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0" style={{ background: '#0b1120' }}>
          <div className="flex items-center gap-2.5">
            <img src="/logo.jpg" alt="Indocable" className="w-7 h-7 rounded-lg object-cover" />
            <span className="text-white font-bold text-sm tracking-tight">Indocable ERP</span>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="text-slate-300 hover:text-white transition-colors cursor-pointer">
            <Menu size={21} />
          </button>
        </header>

        {/* Desktop topbar — breadcrumb + ⌘K + clock */}
        <header className="hidden md:flex items-center justify-between px-7 h-11 border-b border-gray-100 bg-white flex-shrink-0">
          <div className="flex items-center gap-1.5 text-[13px]">
            {breadcrumb.group && (
              <>
                <span className="text-gray-400 font-medium">{breadcrumb.group}</span>
                <ChevronRight size={12} className="text-gray-300" />
              </>
            )}
            <span className="text-gray-700 font-semibold">{breadcrumb.page}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCmdOpen(true)}
              className="flex items-center gap-2 text-xs text-gray-400 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <Search size={11} />
              <span>Quick navigate</span>
              <kbd className="bg-white border border-gray-200 text-gray-500 px-1.5 py-0.5 rounded text-[10px] font-mono leading-none shadow-sm">⌘K</kbd>
            </button>
            <span className="text-xs text-gray-400 tabular-nums font-medium">{clock}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-[#fdf9f7]">
          <div key={location.pathname} className="max-w-7xl mx-auto px-4 md:px-7 py-7 page-enter">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} profile={profile} />
    </div>
  )
}
