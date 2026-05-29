import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import {
  Home, Package, Calculator, MessageSquare, Info,
  Menu, X, LogOut, Phone, Mail, MessageCircle,
  TrendingUp, ChevronDown, Search,
} from 'lucide-react'
import toast from 'react-hot-toast'

const PORTAL_NAV = [
  { to: '/portal',         label: 'Home',         icon: Home,          end: true },
  { to: '/portal/catalog', label: 'Cable Catalog', icon: Package },
  { to: '/portal/sizer',   label: 'Cable Sizer',  icon: Calculator },
  { to: '/portal/enquiry', label: 'Get Quote',    icon: MessageSquare },
  { to: '/portal/about',   label: 'About Us',     icon: Info },
]

function getInitials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

export default function PortalLayout({ profile }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [menuOpen,     setMenuOpen]     = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [scrolled,     setScrolled]     = useState(false)
  const [copperPrice,  setCopperPrice]  = useState(null)
  const [alPrice,      setAlPrice]      = useState(null)

  useEffect(() => {
    fetchPrices()
    const id = setInterval(fetchPrices, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 8) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  async function fetchPrices() {
    const { data } = await supabase
      .from('global_variables')
      .select('key, value')
      .in('key', ['lme_copper_usd_per_tonne', 'lme_al_usd_per_tonne', 'usd_to_inr'])
    if (!data) return
    const vars = Object.fromEntries(data.map(d => [d.key, parseFloat(d.value)]))
    const rate  = vars.usd_to_inr || 85.5
    if (vars.lme_copper_usd_per_tonne) setCopperPrice(Math.round(vars.lme_copper_usd_per_tonne * rate / 1000))
    if (vars.lme_al_usd_per_tonne)    setAlPrice(Math.round(vars.lme_al_usd_per_tonne * rate / 1000))
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Logged out')
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fdf9f7]">

      {/* ── Top info bar ── */}
      <div style={{ background: '#0b1120' }} className="hidden sm:block">
        <div className="max-w-7xl mx-auto px-4 md:px-7 py-1.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-5 text-xs">
            {copperPrice ? (
              <>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  Cu LME <span className="text-white font-semibold ml-0.5">₹{copperPrice.toLocaleString('en-IN')}/kg</span>
                </span>
                {alPrice && (
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    Al LME <span className="text-white font-semibold ml-0.5">₹{alPrice.toLocaleString('en-IN')}/kg</span>
                  </span>
                )}
              </>
            ) : (
              <span className="text-slate-600 text-xs">Loading live prices…</span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <a href="tel:+918073533289" className="hover:text-white transition-colors">+91 80735 33289</a>
            <a href="mailto:cables@micagroup.net" className="hover:text-white transition-colors hidden md:inline">cables@micagroup.net</a>
            <a
              href="https://wa.me/918073533289?text=Hi, I'd like to enquire about Indocable cables"
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <MessageCircle size={11} />
              WhatsApp Us
            </a>
          </div>
        </div>
      </div>

      {/* ── Sticky Navbar ── */}
      <header
        className={`sticky top-0 z-50 transition-all duration-200 bg-white border-b border-gray-100 ${
          scrolled ? 'portal-nav-scrolled' : ''
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-7 py-3.5 flex items-center justify-between gap-6">

          {/* Logo */}
          <NavLink to="/portal" className="flex items-center gap-3 flex-shrink-0">
            <img src="/logo.jpg" alt="Indocable" className="w-10 h-10 rounded-xl object-cover ring-2 ring-brand-500/30" />
            <div>
              <div className="text-gray-900 font-black text-[17px] leading-tight tracking-tight">Indocable</div>
              <div className="text-[9px] text-gray-400 font-bold tracking-[0.15em] uppercase">Cable Manufacturer</div>
            </div>
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {PORTAL_NAV.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-brand-50 text-brand-600 font-semibold'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">

            {profile && (
              <NavLink
                to="/portal/my-enquiries"
                className={({ isActive }) =>
                  `hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
                    isActive ? 'bg-brand-50 text-brand-600' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`
                }
              >
                <MessageSquare size={14} />
                My Enquiries
              </NavLink>
            )}

            <NavLink
              to="/portal/enquiry"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 bg-brand-500 text-white rounded-xl text-sm font-bold hover:bg-brand-600 transition-colors shadow-glow-orange"
            >
              Get Quote
            </NavLink>

            {/* User dropdown */}
            {profile && (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(v => !v)}
                  className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{getInitials(profile.full_name)}</span>
                  </div>
                  <ChevronDown size={12} className="text-gray-400 hidden sm:block" />
                </button>

                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                        <div className="text-sm font-bold text-gray-900">{profile.full_name}</div>
                        {profile.company_name && <div className="text-xs text-gray-500">{profile.company_name}</div>}
                        <div className="text-[11px] text-brand-500 font-semibold capitalize mt-0.5">{profile.role}</div>
                      </div>
                      <div className="p-1.5">
                        {profile.role === 'dealer' && (
                          <NavLink
                            to="/portal/rate-card"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                          >
                            <TrendingUp size={14} className="text-gray-400" />
                            My Rate Card
                          </NavLink>
                        )}
                        <NavLink
                          to="/portal/my-enquiries"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                        >
                          <MessageSquare size={14} className="text-gray-400" />
                          My Enquiries
                        </NavLink>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                        >
                          <LogOut size={14} />
                          Logout
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="lg:hidden border-t border-gray-100 bg-white">
            <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-0.5">
              {PORTAL_NAV.map(({ to, icon: Icon, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive ? 'bg-brand-50 text-brand-600 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                    }`
                  }
                >
                  <Icon size={16} className="flex-shrink-0" />
                  {label}
                </NavLink>
              ))}
              {profile && (
                <NavLink
                  to="/portal/my-enquiries"
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive ? 'bg-brand-50 text-brand-600 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                    }`
                  }
                >
                  <MessageSquare size={16} /> My Enquiries
                </NavLink>
              )}
              {profile?.role === 'dealer' && (
                <NavLink
                  to="/portal/rate-card"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <TrendingUp size={16} /> Rate Card
                </NavLink>
              )}
              <div className="pt-2 mt-1 border-t border-gray-100">
                <NavLink
                  to="/portal/enquiry"
                  className="flex items-center justify-center gap-2 px-4 py-3.5 bg-brand-500 text-white rounded-xl text-sm font-bold shadow-glow-orange"
                >
                  <MessageSquare size={16} /> Get a Quote
                </NavLink>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* ── Page Content ── */}
      <main className="flex-1">
        <div key={location.pathname} className="page-enter">
          <Outlet />
        </div>
      </main>

      {/* ── Footer ── */}
      <footer style={{ background: '#0b1120' }} className="text-white">
        <div className="max-w-7xl mx-auto px-4 md:px-7 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

            {/* Brand column */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src="/logo.jpg" alt="Indocable" className="w-10 h-10 rounded-xl object-cover ring-2 ring-brand-500/30" />
                <div>
                  <div className="text-white font-black text-lg">Indocable</div>
                  <div className="text-[10px] text-slate-500 font-bold tracking-[0.15em] uppercase">by Mica Group</div>
                </div>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed mb-5">
                25+ Years of Manufacturing Excellence.<br />
                Premium cables crafted for India's infrastructure.
              </p>
              <a
                href="https://wa.me/918073533289?text=Hi, I'd like to enquire about Indocable cables"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors"
              >
                <MessageCircle size={15} /> Chat on WhatsApp
              </a>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Products</h4>
              <div className="space-y-2.5">
                {[
                  { to: '/portal/catalog?category=housing-wire',     label: 'Housing Wire' },
                  { to: '/portal/catalog?category=flexible-cables',  label: 'Flexible Cables' },
                  { to: '/portal/catalog?category=armoured-cables',  label: 'Armoured Cables' },
                  { to: '/portal/catalog?category=xlpe-cables',      label: 'XLPE Power Cables' },
                  { to: '/portal/catalog?category=submersible-cables', label: 'Submersible Cables' },
                  { to: '/portal/catalog?category=instrumentation-cables', label: 'Instrumentation Cables' },
                ].map(({ to, label }) => (
                  <NavLink key={to} to={to} className="block text-slate-400 hover:text-white text-sm transition-colors">
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Contact Us</h4>
              <div className="space-y-3">
                <a href="tel:+918073533289" className="flex items-center gap-2.5 text-slate-400 hover:text-white text-sm transition-colors">
                  <Phone size={14} className="text-brand-500 flex-shrink-0" />
                  +91 80735 33289
                </a>
                <a href="mailto:cables@micagroup.net" className="flex items-center gap-2.5 text-slate-400 hover:text-white text-sm transition-colors">
                  <Mail size={14} className="text-brand-500 flex-shrink-0" />
                  cables@micagroup.net
                </a>
                <a href="mailto:sales@indocables.com" className="flex items-center gap-2.5 text-slate-400 hover:text-white text-sm transition-colors">
                  <Mail size={14} className="text-brand-500 flex-shrink-0" />
                  sales@indocables.com
                </a>
                <div className="pt-3 border-t border-white/5">
                  <div className="text-xs text-slate-500 mb-2">Also find us at:</div>
                  <div className="flex flex-wrap gap-2">
                    {[{ label: 'Cable Sizer', to: '/portal/sizer' }, { label: 'Get Quote', to: '/portal/enquiry' }, { label: 'About Us', to: '/portal/about' }].map(({ label, to }) => (
                      <NavLink key={to} to={to} className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-slate-400 hover:text-white transition-colors">
                        {label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-slate-600 text-xs">© {new Date().getFullYear()} Indocable · Mica Group. All rights reserved.</p>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />ISI Certified</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />BIS Approved</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-purple-500" />CPRI Tested</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
