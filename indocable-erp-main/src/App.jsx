import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import { supabase } from './supabase'

// Layout shells stay eager so the app chrome paints instantly; every page is
// lazy-loaded so the initial bundle only ships the route the user actually opens.
import Layout from './components/Layout'
import PortalLayout from './components/PortalLayout'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Materials = lazy(() => import('./pages/Materials'))
const StockIn = lazy(() => import('./pages/StockIn'))
const StockOut = lazy(() => import('./pages/StockOut'))
const StockHistory = lazy(() => import('./pages/StockHistory'))
const ManageUsers = lazy(() => import('./pages/ManageUsers'))
const NewQuotation = lazy(() => import('./pages/NewQuotation'))
const QuotationList = lazy(() => import('./pages/QuotationList'))
const BomMaterials = lazy(() => import('./pages/BomMaterials'))
const GlobalVariables = lazy(() => import('./pages/GlobalVariables'))
const Machines = lazy(() => import('./pages/Machines'))
const Drums = lazy(() => import('./pages/Drums'))
const Employees = lazy(() => import('./pages/Employees'))
const ShiftPlanner = lazy(() => import('./pages/ShiftPlanner'))
const ShiftTemplates = lazy(() => import('./pages/ShiftTemplates'))
const Attendance = lazy(() => import('./pages/Attendance'))
const Leaves = lazy(() => import('./pages/Leaves'))
const Payroll = lazy(() => import('./pages/Payroll'))
const Advances = lazy(() => import('./pages/Advances'))
const HRReports = lazy(() => import('./pages/HRReports'))
const ProductionOrders = lazy(() => import('./pages/ProductionOrders'))
const Dispatch = lazy(() => import('./pages/Dispatch'))
const Maintenance = lazy(() => import('./pages/Maintenance'))
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'))
const JobWork = lazy(() => import('./pages/JobWork'))
const StoreRoom = lazy(() => import('./pages/StoreRoom'))
const StoreItems = lazy(() => import('./pages/StoreItems'))
const StoreInOut = lazy(() => import('./pages/StoreInOut'))
const StoreReturn = lazy(() => import('./pages/StoreReturn'))
const StoreAdjust = lazy(() => import('./pages/StoreAdjust'))
const StoreHistory = lazy(() => import('./pages/StoreHistory'))
const StoreLocationManager = lazy(() => import('./pages/StoreLocationManager'))
const StoreGate = lazy(() => import('./pages/StoreGate'))
const StoreAccess = lazy(() => import('./pages/StoreAccess'))
const StoreRequests = lazy(() => import('./pages/StoreRequests'))
const CatalogAdmin = lazy(() => import('./pages/CatalogAdmin'))
const EnquiryAdmin = lazy(() => import('./pages/EnquiryAdmin'))

// ── Portal pages ────────────────────────────────────────────────────────────
const PortalDashboard = lazy(() => import('./pages/portal/PortalDashboard'))
const CableCatalog = lazy(() => import('./pages/portal/CableCatalog'))
const CableDetail = lazy(() => import('./pages/portal/CableDetail'))
const CableSizer = lazy(() => import('./pages/portal/CableSizer'))
const EnquiryBuilder = lazy(() => import('./pages/portal/EnquiryBuilder'))
const MyEnquiries = lazy(() => import('./pages/portal/MyEnquiries'))
const AboutPage = lazy(() => import('./pages/portal/AboutPage'))
const RateCard = lazy(() => import('./pages/portal/RateCard'))

const PORTAL_ROLES = ['dealer', 'client']

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading Indocable…</p>
      </div>
    </div>
  )
}

export default function App() {
  const [session,      setSession]      = useState(null)
  const [profile,      setProfile]      = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [profileError, setProfileError] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id, false)
      else { setProfile(null); setProfileError(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId, showLoader = true) {
    if (showLoader) setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!data && (error?.code === 'PGRST116' || error?.message?.includes('not found') || error?.message?.includes('0 rows'))) {
      // No profile yet — check if this is a Google OAuth user and auto-create a client profile
      const { data: { user } } = await supabase.auth.getUser()
      const isGoogle = user?.app_metadata?.provider === 'google' ||
                       user?.identities?.some(i => i.provider === 'google')
      if (isGoogle) {
        const name = user.user_metadata?.full_name ||
                     user.user_metadata?.name ||
                     user.email?.split('@')[0] || 'Client'
        const { data: newProfile, error: insertErr } = await supabase
          .from('profiles')
          .insert({ id: userId, full_name: name, role: 'client' })
          .select()
          .single()
        if (newProfile) {
          setProfile(newProfile)
          setProfileError(null)
          setLoading(false)
          return
        }
        if (insertErr) {
          setProfileError(insertErr.message)
          setProfile(null)
          setLoading(false)
          return
        }
      }
    }

    if (error || !data) {
      setProfileError(error?.message || 'Profile not found')
      setProfile(null)
    } else {
      setProfile(data)
      setProfileError(null)
    }
    setLoading(false)
  }

  async function handleLogoutFromError() {
    await supabase.auth.signOut()
  }

  if (loading) {
    return <PageFallback />
  }

  if (session && profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Profile Not Found</h2>
          <p className="text-gray-500 text-sm mb-2">
            You are logged in as <strong>{session.user.email}</strong> but no profile was found.
          </p>
          <p className="text-gray-400 text-xs mb-6 bg-gray-50 rounded p-2 font-mono">{profileError}</p>
          <p className="text-gray-600 text-sm mb-4">Run this in Supabase SQL Editor:</p>
          <code className="block bg-gray-100 rounded-lg p-3 text-xs text-left text-gray-700 mb-6 whitespace-pre">
{`insert into profiles (id, full_name, role)
select id, 'Your Name', 'admin'
from auth.users
where email = '${session.user.email}'
on conflict (id) do nothing;`}
          </code>
          <button
            onClick={handleLogoutFromError}
            className="w-full bg-brand-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-600"
          >
            Sign Out & Try Again
          </button>
        </div>
      </div>
    )
  }

  const isPortalRole = session && profile && PORTAL_ROLES.includes(profile.role)

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Physical store monitor — no ERP chrome */}
        <Route path="/store-gate" element={<StoreGate />} />
        {/* Store access door monitor (login + code entry) */}
        <Route path="/store-access" element={<StoreAccess />} />

        {/* Login — redirect to correct home based on role */}
        <Route
          path="/login"
          element={
            !session ? <Login /> :
            isPortalRole ? <Navigate to="/portal" /> :
            <Navigate to="/" />
          }
        />

        {session && profile ? (
          isPortalRole ? (
            /* ── Portal routes (dealer / client) ── */
            <Route element={<PortalLayout profile={profile} />}>
              <Route path="/portal"             element={<PortalDashboard profile={profile} />} />
              <Route path="/portal/catalog"     element={<CableCatalog />} />
              <Route path="/portal/cable/:slug" element={<CableDetail profile={profile} />} />
              <Route path="/portal/sizer"       element={<CableSizer />} />
              <Route path="/portal/enquiry"     element={<EnquiryBuilder profile={profile} />} />
              <Route path="/portal/my-enquiries"element={<MyEnquiries profile={profile} />} />
              <Route path="/portal/about"       element={<AboutPage />} />
              {profile.role === 'dealer' && (
                <Route path="/portal/rate-card" element={<RateCard profile={profile} />} />
              )}
              <Route path="*" element={<Navigate to="/portal" />} />
            </Route>
          ) : (
            /* ── ERP routes (internal team) ── */
            <Route element={<Layout profile={profile} />}>
              <Route path="/" element={<Dashboard profile={profile} />} />
              <Route path="/materials"    element={<Materials profile={profile} />} />
              <Route path="/stock-in"     element={<StockIn profile={profile} />} />
              <Route path="/stock-out"    element={<StockOut profile={profile} />} />
              <Route path="/stock-history"element={<StockHistory profile={profile} />} />

              <Route path="/store"           element={<StoreRoom profile={profile} />} />
              <Route path="/store/items"     element={<StoreItems profile={profile} />} />
              <Route path="/store/request"   element={<StoreInOut profile={profile} />} />
              {/* Old separate Inward/Outward pages now redirect to the merged page */}
              <Route path="/store/receive"   element={<Navigate to="/store/request?mode=inward" replace />} />
              <Route path="/store/issue"     element={<Navigate to="/store/request?mode=outward" replace />} />
              <Route path="/store/return"    element={<StoreReturn profile={profile} />} />
              <Route path="/store/adjust"    element={<StoreAdjust profile={profile} />} />
              <Route path="/store/history"   element={<StoreHistory profile={profile} />} />
              <Route path="/store/locations" element={<StoreLocationManager profile={profile} />} />
              <Route path="/store/requests"  element={<StoreRequests profile={profile} />} />

              {['owner', 'admin'].includes(profile.role) && (
                <>
                  <Route path="/quotations"          element={<QuotationList profile={profile} />} />
                  <Route path="/quotations/new"      element={<NewQuotation profile={profile} />} />
                  <Route path="/quotations/bom"      element={<BomMaterials profile={profile} />} />
                  <Route path="/quotations/global"   element={<GlobalVariables profile={profile} />} />
                  <Route path="/quotations/machines" element={<Machines profile={profile} />} />
                  <Route path="/quotations/drums"    element={<Drums profile={profile} />} />
                </>
              )}

              {['owner','admin','production_head'].includes(profile.role) && (
                <>
                  <Route path="/labour"                  element={<Employees profile={profile} />} />
                  <Route path="/labour/shifts"           element={<ShiftPlanner profile={profile} />} />
                  <Route path="/labour/shift-templates"  element={<ShiftTemplates profile={profile} />} />
                  <Route path="/labour/attendance"       element={<Attendance profile={profile} />} />
                  <Route path="/labour/leaves"           element={<Leaves profile={profile} />} />
                  <Route path="/labour/payroll"          element={<Payroll profile={profile} />} />
                  <Route path="/labour/advances"         element={<Advances profile={profile} />} />
                  <Route path="/labour/reports"          element={<HRReports profile={profile} />} />
                </>
              )}

              {['owner','admin','production_head','operator','qc_inspector'].includes(profile.role) && (
                <Route path="/production" element={<ProductionOrders profile={profile} />} />
              )}

              {['owner','admin'].includes(profile.role) && (
                <>
                  <Route path="/dispatch"        element={<Dispatch profile={profile} />} />
                  <Route path="/purchase-orders" element={<PurchaseOrders profile={profile} />} />
                </>
              )}

              {['owner','admin','procurement'].includes(profile.role) && (
                <Route path="/job-work" element={<JobWork profile={profile} />} />
              )}

              {['owner','admin','production_head'].includes(profile.role) && (
                <Route path="/maintenance" element={<Maintenance profile={profile} />} />
              )}

              {profile.role === 'owner' && (
                <Route path="/users" element={<ManageUsers profile={profile} />} />
              )}

              {['owner','admin'].includes(profile.role) && (
                <>
                  <Route path="/catalog-admin"  element={<CatalogAdmin  profile={profile} />} />
                  <Route path="/enquiry-admin"   element={<EnquiryAdmin  profile={profile} />} />
                </>
              )}

              <Route path="*" element={<Navigate to="/" />} />
            </Route>
          )
        ) : (
          <Route path="*" element={<Navigate to="/login" />} />
        )}

        {/* Global catch-all */}
        <Route
          path="*"
          element={
            <Navigate to={
              session && profile
                ? isPortalRole ? '/portal' : '/'
                : '/login'
            } />
          }
        />
      </Routes>
    </Suspense>
  )
}
