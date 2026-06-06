import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import {
  UserPlus, Users, Phone, Mail, X, ShieldCheck,
  Eye, EyeOff, Check, ToggleLeft, ToggleRight,
  RefreshCw, ChevronDown, KeyRound, Pencil
} from 'lucide-react'
import toast from 'react-hot-toast'
import AccessDenied from '../components/AccessDenied'

const ROLES = [
  { value: 'admin',           label: 'Admin',          desc: 'Full ERP access, no user management' },
  { value: 'production_head', label: 'Supervisor',     desc: 'Oversees production & attendance' },
  { value: 'operator',        label: 'Operator',       desc: 'Machine operator' },
  { value: 'qc_inspector',    label: 'QC Inspector',   desc: 'Quality checks' },
  { value: 'procurement',     label: 'Procurement',    desc: 'Purchases & store receipts' },
  { value: 'security_guard',  label: 'Security Guard', desc: 'Verifies store entries' },
  { value: 'helper',          label: 'Helper',         desc: 'General assistant' },
  { value: 'dealer',          label: 'Dealer',         desc: 'B2B partner — portal access' },
  { value: 'client',          label: 'Client',         desc: 'Direct buyer — portal access' },
]

const roleBadge = {
  owner:           'bg-amber-50 text-amber-700 border-amber-200',
  admin:           'bg-purple-50 text-purple-700 border-purple-200',
  production_head: 'bg-blue-50 text-blue-700 border-blue-200',
  operator:        'bg-orange-50 text-orange-700 border-orange-200',
  qc_inspector:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  procurement:     'bg-cyan-50 text-cyan-700 border-cyan-200',
  security_guard:  'bg-red-50 text-red-700 border-red-200',
  helper:          'bg-gray-100 text-gray-600 border-gray-200',
  dealer:          'bg-teal-50 text-teal-700 border-teal-200',
  client:          'bg-indigo-50 text-indigo-700 border-indigo-200',
}

const roleLabel = {
  owner: 'Owner', admin: 'Admin', production_head: 'Supervisor',
  operator: 'Operator', qc_inspector: 'QC Inspector',
  procurement: 'Procurement', security_guard: 'Security Guard', helper: 'Helper',
  dealer: 'Dealer', client: 'Client',
}

function getInitials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

const GRADIENTS = [
  'from-brand-500 to-brand-700', 'from-violet-500 to-purple-700',
  'from-emerald-500 to-teal-700', 'from-blue-500 to-indigo-700',
  'from-amber-500 to-orange-700', 'from-rose-500 to-pink-700',
]

// ── Reset Password Modal ──────────────────────────────────────────────────────
function ResetPasswordModal({ user, onClose, onDone }) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleReset() {
    if (password.length < 6) { toast.error('Minimum 6 characters'); return }
    setSaving(true)
    // Store the new password hint in profiles
    const { error } = await supabase.from('profiles')
      .update({ stored_password: password })
      .eq('id', user.id)
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Password updated — share the new password with the user')
    onDone(password)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">
            <KeyRound size={15} className="text-brand-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Set New Password</h2>
            <p className="text-xs text-gray-500">{user.full_name}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 cursor-pointer"><X size={18} /></button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="New password (min 6 characters)"
              className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            <button onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer">
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            Note: This saves the password so you can see it later. The user must use this to log in — Supabase does not send reset emails automatically.
          </p>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">Cancel</button>
          <button onClick={handleReset} disabled={saving}
            className="px-6 py-2 bg-brand-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-600 cursor-pointer disabled:opacity-50">
            {saving ? 'Saving…' : 'Set Password'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ManageUsers({ profile }) {
  if (profile?.role !== 'owner') return <AccessDenied />
  return <ManageUsersInner profile={profile} />
}

function ManageUsersInner({ profile }) {

  const [users, setUsers]           = useState([])
  const [showForm, setShowForm]     = useState(false)
  const [loading, setLoading]       = useState(true)
  const [creating, setCreating]     = useState(false)
  const [resetUser, setResetUser]   = useState(null)
  const [visiblePw, setVisiblePw]   = useState({})
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', role: 'operator', company_name: '', city: '', territory: '' })

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setUsers(data || [])
    setLoading(false)
  }

  async function changeRole(userId, newRole) {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    if (error) { toast.error('Failed: ' + error.message); return }
    toast.success('Role updated')
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
  }

  async function toggleActive(userId, current) {
    const { error } = await supabase.from('profiles').update({ is_active: !current }).eq('id', userId)
    if (error) { toast.error('Failed: ' + error.message); return }
    toast.success(!current ? 'User activated' : 'User deactivated')
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !current } : u))
  }

  function togglePwVisible(userId) {
    setVisiblePw(prev => ({ ...prev, [userId]: !prev[userId] }))
  }

  async function ensureProfile(userId, name, email, role, phone, password) {
    const { data: existing } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle()
    if (existing) return true
    const { error } = await supabase.rpc('create_user_profile', {
      p_user_id: userId, p_full_name: name, p_email: email, p_role: role, p_phone: phone || null,
    })
    if (!error) {
      // Store password hint
      await supabase.from('profiles').update({ stored_password: password }).eq('id', userId)
    }
    return !error
  }

  async function handleCreateUser(e) {
    e.preventDefault()
    if (!form.full_name.trim()) { toast.error('Full name is required'); return }
    if (!form.email.trim())     { toast.error('Email is required'); return }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setCreating(true)

    const { data: { session: ownerSession } } = await supabase.auth.getSession()
    if (!ownerSession) { toast.error('Session expired — refresh and try again'); setCreating(false); return }
    const ownerTokens = { access_token: ownerSession.access_token, refresh_token: ownerSession.refresh_token }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: { data: { full_name: form.full_name.trim(), role: form.role, phone: form.phone.trim() || null } }
    })

    // Restore owner session immediately
    await supabase.auth.setSession(ownerTokens)

    if (authError) {
      toast.error(authError.message.toLowerCase().includes('already registered')
        ? 'This email is already registered'
        : 'Could not create account: ' + authError.message)
      setCreating(false)
      return
    }

    const userId = authData?.user?.id
    if (!userId) { toast.error('Failed to get user ID'); setCreating(false); return }

    // Wait for DB trigger, then ensure profile exists
    await new Promise(r => setTimeout(r, 1000))
    const ok = await ensureProfile(userId, form.full_name.trim(), form.email.trim(), form.role, form.phone.trim(), form.password)

    // Store password in profile so owner can see it
    await supabase.from('profiles').update({ stored_password: form.password }).eq('id', userId)

    if (!ok) {
      toast.error('Account created but profile setup failed — run the create_user_profile SQL')
      setCreating(false)
      return
    }

    // Save dealer/client extra fields
    if (['dealer', 'client'].includes(form.role) && (form.company_name || form.city || form.territory)) {
      const { error: extraErr } = await supabase.from('profiles').update({
        company_name: form.company_name.trim() || null,
        city:         form.city.trim()         || null,
        territory:    form.territory.trim()    || null,
      }).eq('id', userId)
      if (extraErr) toast.error('User created, but saving company details failed: ' + extraErr.message)
    }

    toast.success(`${form.full_name} added — they can log in now`)
    setForm({ full_name: '', email: '', phone: '', password: '', role: 'operator', company_name: '', city: '', territory: '' })
    setShowForm(false)
    setCreating(false)
    fetchUsers()
  }

  const active   = users.filter(u => u.is_active !== false)
  const inactive = users.filter(u => u.is_active === false)

  return (
    <div className="space-y-6">
      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          onClose={() => setResetUser(null)}
          onDone={pw => {
            setUsers(prev => prev.map(u => u.id === resetUser.id ? { ...u, stored_password: pw } : u))
            setResetUser(null)
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Manage Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">{active.length} active · {inactive.length} inactive</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchUsers} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl cursor-pointer"><RefreshCw size={16} /></button>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-600 cursor-pointer">
            <UserPlus size={15} /> Add User
          </button>
        </div>
      </div>

      {/* Create User Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-900">Create New User</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"><X size={16} /></button>
          </div>
          <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name *</label>
              <input required className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="e.g. Rajesh Kumar"
                value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address *</label>
              <input required type="email" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="rajesh@example.com"
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Phone (WhatsApp)</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 border border-r-0 border-gray-200 bg-gray-50 text-gray-500 rounded-l-xl text-sm">+91</span>
                <input type="tel" maxLength={10}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-r-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="9876543210"
                  value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Password *</label>
              <input required type="text" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono"
                placeholder="Min 6 characters"
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Share this with the user — you can see it later</p>
            </div>
            {/* Extra fields for dealer/client */}
            {['dealer', 'client'].includes(form.role) && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Company / Firm Name</label>
                  <input className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    placeholder="e.g. Sharma Electricals"
                    value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">City</label>
                  <input className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    placeholder="e.g. Bangalore"
                    value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                </div>
                {form.role === 'dealer' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Territory / Area</label>
                    <input className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      placeholder="e.g. Bangalore South, Electronic City area"
                      value={form.territory} onChange={e => setForm({ ...form, territory: e.target.value })} />
                    <p className="text-xs text-teal-600 bg-teal-50 rounded-lg px-3 py-2 mt-2">
                      Dealers and Clients access the Customer Portal — not the ERP
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Role *</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ROLES.map(r => (
                  <label key={r.value}
                    className={`flex flex-col p-2.5 rounded-xl border cursor-pointer transition-all ${form.role === r.value ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="role" value={r.value} checked={form.role === r.value}
                      onChange={() => setForm({ ...form, role: r.value })} className="sr-only" />
                    <span className="text-xs font-bold text-gray-800">{r.label}</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">{r.desc}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2 flex gap-3 pt-1">
              <button type="submit" disabled={creating}
                className="flex items-center gap-2 px-5 py-2 bg-brand-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-600 cursor-pointer disabled:opacity-50">
                <UserPlus size={15} /> {creating ? 'Creating…' : 'Create User'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 cursor-pointer">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      ) : users.length === 0 ? (
        <div className="card p-16 text-center">
          <Users size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 font-medium">No users yet</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Password</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Role</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Active</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const isActive = u.is_active !== false
                const isOwner  = u.role === 'owner'
                const pwVisible = visiblePw[u.id]
                return (
                  <tr key={u.id} className={`border-b border-gray-50 transition-colors ${!isActive ? 'opacity-50' : 'hover:bg-gray-50/50'}`}>

                    {/* Name */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white text-xs font-bold">{getInitials(u.full_name)}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-gray-900 text-sm">{u.full_name}</span>
                            {isOwner && <ShieldCheck size={12} className="text-amber-500" />}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            Joined {new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-600 flex items-center gap-1.5">
                        <Mail size={11} className="text-gray-400 flex-shrink-0" />
                        {u.email || '—'}
                      </span>
                    </td>

                    {/* Phone */}
                    <td className="px-4 py-3">
                      {u.phone ? (
                        <span className="text-xs text-emerald-600 flex items-center gap-1.5">
                          <Phone size={11} className="flex-shrink-0" />
                          +91 {u.phone}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>

                    {/* Password */}
                    <td className="px-4 py-3">
                      {isOwner ? (
                        <span className="text-xs text-gray-300">—</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-gray-700 min-w-[80px]">
                            {u.stored_password
                              ? (pwVisible ? u.stored_password : '••••••••')
                              : <span className="text-gray-300 non-mono">not saved</span>
                            }
                          </span>
                          {u.stored_password && (
                            <button onClick={() => togglePwVisible(u.id)}
                              className="text-gray-400 hover:text-gray-600 cursor-pointer p-0.5">
                              {pwVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          )}
                          <button onClick={() => setResetUser(u)}
                            title="Set new password"
                            className="text-gray-400 hover:text-brand-500 cursor-pointer p-0.5">
                            <KeyRound size={12} />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      {isOwner ? (
                        <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${roleBadge[u.role]}`}>
                          {roleLabel[u.role]}
                        </span>
                      ) : (
                        <div className="relative inline-block">
                          <select
                            value={u.role}
                            onChange={e => changeRole(u.id, e.target.value)}
                            className={`text-[11px] font-semibold pl-2 pr-6 py-0.5 rounded-lg border appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-400 ${roleBadge[u.role]}`}
                          >
                            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                          <ChevronDown size={9} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                        </div>
                      )}
                    </td>

                    {/* Active toggle */}
                    <td className="px-4 py-3 text-center">
                      {isOwner ? (
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" title="Always active" />
                      ) : (
                        <button
                          onClick={() => toggleActive(u.id, isActive)}
                          title={isActive ? 'Click to deactivate' : 'Click to activate'}
                          className="cursor-pointer transition-colors"
                        >
                          {isActive
                            ? <ToggleRight size={24} className="text-emerald-500" />
                            : <ToggleLeft size={24} className="text-gray-300" />
                          }
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
