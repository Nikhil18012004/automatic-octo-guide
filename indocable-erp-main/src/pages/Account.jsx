import { useState } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import {
  User, KeyRound, Users, Save, Eye, EyeOff, Mail, Phone, ShieldCheck,
} from 'lucide-react'
import ManageUsers from './ManageUsers'
import { roleLabels } from '../components/Layout'

function getInitials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

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

// ── My Profile tab ──────────────────────────────────────────────────────────
function MyProfile({ profile, onProfileUpdate }) {
  const [fullName, setFullName] = useState(profile.full_name || '')
  const [phone,    setPhone]    = useState(profile.phone || '')
  const [savingProfile, setSavingProfile] = useState(false)

  const [pw,        setPw]        = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [savingPw,  setSavingPw]  = useState(false)

  const profileDirty = fullName.trim() !== (profile.full_name || '') || phone !== (profile.phone || '')

  async function saveProfile(e) {
    e.preventDefault()
    if (!fullName.trim()) { toast.error('Name cannot be empty'); return }
    setSavingProfile(true)
    const { error } = await supabase.from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim() || null })
      .eq('id', profile.id)
    setSavingProfile(false)
    if (error) { toast.error(error.message); return }
    toast.success('Profile updated')
    onProfileUpdate?.()
  }

  async function changePassword(e) {
    e.preventDefault()
    if (pw.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (pw !== pwConfirm) { toast.error('Passwords do not match'); return }
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) { toast.error(error.message); setSavingPw(false); return }
    // Keep the owner-visible password hint in sync with the real password.
    await supabase.from('profiles').update({ stored_password: pw }).eq('id', profile.id)
    setSavingPw(false)
    setPw(''); setPwConfirm('')
    toast.success('Password changed')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Identity card */}
      <div className="card p-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-lg font-bold">{getInitials(profile.full_name)}</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900 truncate">{profile.full_name}</h2>
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${roleBadge[profile.role] || roleBadge.helper}`}>
              {profile.role === 'owner' && <ShieldCheck size={10} />}
              {roleLabels[profile.role] || profile.role}
            </span>
          </div>
          {profile.email && (
            <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-1">
              <Mail size={12} /> {profile.email}
            </div>
          )}
        </div>
      </div>

      {/* Edit profile */}
      <form onSubmit={saveProfile} className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <User size={16} className="text-brand-500" />
          <h3 className="font-semibold text-gray-900">Profile details</h3>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Display name</label>
          <input value={fullName} onChange={e => setFullName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="Your name" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Phone (WhatsApp)</label>
          <div className="flex">
            <span className="inline-flex items-center px-3 border border-r-0 border-gray-200 bg-gray-50 text-gray-500 rounded-l-xl text-sm"><Phone size={13} /></span>
            <input type="tel" maxLength={10} value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-r-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              placeholder="9876543210" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
        </div>
        <input value={profile.email || '—'} disabled
          className="w-full px-3 py-2 border border-gray-100 bg-gray-50 text-gray-400 rounded-xl text-sm cursor-not-allowed -mt-3"
          title="Email cannot be changed here" />
        <div className="pt-1">
          <button type="submit" disabled={savingProfile || !profileDirty}
            className="flex items-center gap-2 px-5 py-2 bg-brand-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            <Save size={15} /> {savingProfile ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      {/* Change password */}
      <form onSubmit={changePassword} className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-brand-500" />
          <h3 className="font-semibold text-gray-900">Change password</h3>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">New password</label>
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} value={pw}
              onChange={e => setPw(e.target.value)}
              className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              placeholder="Min 6 characters" />
            <button type="button" onClick={() => setShowPw(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer">
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Confirm new password</label>
          <input type={showPw ? 'text' : 'password'} value={pwConfirm}
            onChange={e => setPwConfirm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="Re-enter password" />
        </div>
        <div className="pt-1">
          <button type="submit" disabled={savingPw || !pw}
            className="flex items-center gap-2 px-5 py-2 bg-gray-800 text-white rounded-xl text-sm font-semibold hover:bg-gray-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            <KeyRound size={15} /> {savingPw ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Account page ──────────────────────────────────────────────────────────────
export default function Account({ profile, onProfileUpdate }) {
  const canManageTeam = ['owner', 'admin'].includes(profile.role)
  const [tab, setTab] = useState('profile') // 'profile' | 'team'

  const tabs = [
    { key: 'profile', label: 'My Profile', icon: User },
    ...(canManageTeam ? [{ key: 'team', label: 'Team & Roles', icon: Users }] : []),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Account Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your profile{canManageTeam ? ' and your team' : ''}</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === 'profile'
        ? <MyProfile profile={profile} onProfileUpdate={onProfileUpdate} />
        : <ManageUsers profile={profile} />}
    </div>
  )
}
