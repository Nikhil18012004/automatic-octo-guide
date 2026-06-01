import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Materials from './pages/Materials'
import StockIn from './pages/StockIn'
import StockOut from './pages/StockOut'
import StockHistory from './pages/StockHistory'
import ManageUsers from './pages/ManageUsers'
import NewQuotation from './pages/NewQuotation'
import QuotationList from './pages/QuotationList'
import BomMaterials from './pages/BomMaterials'
import GlobalVariables from './pages/GlobalVariables'
import Machines from './pages/Machines'
import Drums from './pages/Drums'
import Employees from './pages/Employees'
import ShiftPlanner from './pages/ShiftPlanner'
import ShiftTemplates from './pages/ShiftTemplates'
import Attendance from './pages/Attendance'
import Leaves from './pages/Leaves'
import Payroll from './pages/Payroll'
import Advances from './pages/Advances'
import HRReports from './pages/HRReports'
import ProductionOrders from './pages/ProductionOrders'
import Dispatch from './pages/Dispatch'
import Maintenance from './pages/Maintenance'
import PurchaseOrders from './pages/PurchaseOrders'
import JobWork from './pages/JobWork'
import StoreRoom from './pages/StoreRoom'
import StoreItems from './pages/StoreItems'
import StoreInOut from './pages/StoreInOut'
import StoreReturn from './pages/StoreReturn'
import StoreAdjust from './pages/StoreAdjust'
import StoreHistory from './pages/StoreHistory'
import StoreLocationManager from './pages/StoreLocationManager'
import StoreGate from './pages/StoreGate'
import StoreAccess from './pages/StoreAccess'
import StoreRequests from './pages/StoreRequests'
import Layout from './components/Layout'
import CatalogAdmin from './pages/CatalogAdmin'
import EnquiryAdmin from './pages/EnquiryAdmin'

// ── Portal imports ────────────────────────────────────────────────────────────
import PortalLayout from './components/PortalLayout'
import PortalDashboard from './pages/portal/PortalDashboard'
import CableCatalog from './pages/portal/CableCatalog'
import CableDetail from './pages/portal/CableDetail'
import CableSizer from './pages/portal/CableSizer'
import EnquiryBuilder from './pages/portal/EnquiryBuilder'
import MyEnquiries from './pages/portal/MyEnquiries'
import AboutPage from './pages/portal/AboutPage'
import RateCard from './pages/portal/RateCard'

const PORTAL_ROLES = ['dealer', 'client']

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Indocable…</p>
        </div>
      </div>
    )
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
select id, 'Parth Chhaperia', 'admin'
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
    <>
      <Toaster position="top-right" />
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
    </>
  )
}
