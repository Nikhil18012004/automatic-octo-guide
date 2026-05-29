import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { playSuccess, playError, playClick } from '../lib/sound'
import {
  Zap, Users, TrendingUp, Wrench, BarChart2,
  Save, RefreshCw, Edit2, X, ChevronRight,
  ArrowRight, AlertCircle
} from 'lucide-react'

const TABS = [
  { key: 'lme_copper',  label: 'LME Copper',    icon: TrendingUp, gradient: 'from-amber-500 to-orange-600',  bg: 'bg-amber-50',   border: 'border-amber-100',   text: 'text-amber-600' },
  { key: 'electricity', label: 'Electricity',    icon: Zap,        gradient: 'from-yellow-400 to-amber-500',  bg: 'bg-yellow-50',  border: 'border-yellow-100',  text: 'text-yellow-600' },
  { key: 'labour',      label: 'Labour',         icon: Users,      gradient: 'from-brand-500 to-brand-700',   bg: 'bg-brand-50',   border: 'border-brand-100',   text: 'text-brand-600' },
  { key: 'job_work',    label: 'Job Work',       icon: Wrench,     gradient: 'from-emerald-500 to-teal-600',  bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-600' },
  { key: 'overhead',    label: 'Overhead',       icon: BarChart2,  gradient: 'from-violet-500 to-purple-700', bg: 'bg-violet-50',  border: 'border-violet-100',  text: 'text-violet-600' },
]

function fmt(n, dec = 2) {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

export default function GlobalVariables({ profile }) {
  const [vars, setVars]       = useState({})
  const [editing, setEditing] = useState({})
  const [saving, setSaving]   = useState({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('lme_copper')

  useEffect(() => { fetchVars() }, [])

  async function fetchVars() {
    setLoading(true)
    const { data, error } = await supabase.from('global_variables').select('*').order('category').order('label')
    if (error) { toast.error('Failed to load variables'); setLoading(false); return }
    const map = {}
    ;(data || []).forEach(row => { map[row.key] = row })
    setVars(map)
    setLoading(false)
  }

  function v(key) { return vars[key]?.value ?? 0 }

  // Live LME computations
  const lme = useMemo(() => {
    const lme_usd  = v('lme_usd_per_tonne')
    const prem     = v('lme_premium_usd')
    const rate     = v('usd_to_inr')
    const freight  = v('copper_freight_per_kg')
    const fab      = v('copper_fabrication_per_kg')
    const tinning  = v('tinning_extra_per_kg')
    const base     = (lme_usd + prem) * rate / 1000
    const bare     = base + freight + fab
    const tinned   = bare + tinning
    return { base, freight, fab, bare, tinning, tinned }
  }, [vars])

  // Labour hourly rates
  const labour = useMemo(() => {
    const days  = v('working_days_per_month') || 26
    const hours = v('working_hours_per_day')  || 8
    const denom = days * hours
    const rate  = (key) => denom > 0 ? v(key) / denom : 0
    return {
      supervisor: rate('supervisor_monthly_salary'),
      operator:   rate('operator_monthly_salary'),
      helper:     rate('helper_monthly_salary'),
      cleaner:    rate('cleaner_monthly_salary'),
    }
  }, [vars])

  function startEdit(key) {
    playClick()
    setEditing(e => ({ ...e, [key]: String(vars[key]?.value ?? '') }))
  }

  function cancelEdit(key) {
    setEditing(e => { const n = { ...e }; delete n[key]; return n })
  }

  async function saveVar(key) {
    const newVal = parseFloat(editing[key])
    if (isNaN(newVal)) { toast.error('Enter a valid number'); return }
    setSaving(s => ({ ...s, [key]: true }))
    const { error } = await supabase.from('global_variables')
      .update({ value: newVal, updated_at: new Date().toISOString() })
      .eq('key', key)
    setSaving(s => { const n = { ...s }; delete n[key]; return n })
    if (error) { playError(); toast.error('Save failed: ' + error.message); return }
    playSuccess()
    setVars(prev => ({ ...prev, [key]: { ...prev[key], value: newVal } }))
    cancelEdit(key)
    toast.success('Saved')
  }

  const categoryVars = (cat) =>
    Object.values(vars).filter(r => r.category === cat).sort((a, b) => a.label.localeCompare(b.label))

  function VarRow({ row }) {
    const isEditing = row.key in editing
    const isSaving  = saving[row.key]
    return (
      <div className="flex items-center justify-between py-3 px-4 hover:bg-slate-50/60 rounded-xl group transition-colors">
        <div className="flex-1 min-w-0 mr-4">
          <div className="text-sm font-semibold text-gray-800">{row.label}</div>
          {row.description && <div className="text-xs text-gray-400 mt-0.5">{row.description}</div>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isEditing ? (
            <>
              <input
                type="number"
                step="any"
                value={editing[row.key]}
                onChange={e => setEditing(ed => ({ ...ed, [row.key]: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveVar(row.key)
                  if (e.key === 'Escape') cancelEdit(row.key)
                }}
                className="input w-28 text-right py-1.5 text-sm"
                autoFocus
              />
              <span className="text-xs text-gray-400 w-10 text-left">{row.unit}</span>
              <button onClick={() => saveVar(row.key)} disabled={isSaving}
                className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-60 cursor-pointer">
                <Save size={12} />
              </button>
              <button onClick={() => cancelEdit(row.key)}
                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors cursor-pointer">
                <X size={12} />
              </button>
            </>
          ) : (
            <>
              <span className="text-base font-bold text-gray-900 tabular-nums">
                {row.value !== null ? fmt(row.value, row.unit?.includes('%') ? 1 : 2) : '—'}
              </span>
              <span className="text-xs text-gray-400 w-10 text-left">{row.unit}</span>
              {profile.role !== 'viewer' && (
                <button onClick={() => startEdit(row.key)}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-brand-50 text-gray-400 hover:text-brand-600 transition-all cursor-pointer">
                  <Edit2 size={12} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  const activeTabMeta = TABS.find(t => t.key === activeTab)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm">
          <BarChart2 size={20} className="text-white" />
        </div>
        <div>
          <h1 className="page-header">Global Variables</h1>
          <p className="page-sub">System-wide cost rates used across all quotations</p>
        </div>
        <button onClick={fetchVars} className="btn-ghost ml-auto px-2.5" title="Refresh">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1.5 bg-gray-100 rounded-2xl p-1.5 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => { playClick(); setActiveTab(tab.key) }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap cursor-pointer flex-shrink-0
                ${isActive
                  ? `bg-white shadow-sm ${tab.text}`
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="card p-12 flex items-center justify-center gap-3 text-gray-400">
          <RefreshCw size={18} className="animate-spin" />
          <span className="text-sm">Loading variables…</span>
        </div>
      ) : (
        <div className="space-y-4">

          {/* LME Copper — special layout with live calculator */}
          {activeTab === 'lme_copper' && (
            <>
              {/* Input variables */}
              <div className="card overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                    <TrendingUp size={15} className="text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900 text-sm">Market Inputs</h2>
                    <p className="text-xs text-gray-400">Update these to recalculate copper price</p>
                  </div>
                </div>
                <div className="px-2 py-2 divide-y divide-gray-50">
                  {categoryVars('lme_copper').map(row => <VarRow key={row.key} row={row} />)}
                </div>
              </div>

              {/* Live computed price chain */}
              <div className="rounded-2xl overflow-hidden border border-amber-100" style={{ background: 'linear-gradient(135deg, #fffbeb, #fff7ed)' }}>
                <div className="flex items-center gap-3 px-5 py-4 border-b border-amber-100">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                    <ArrowRight size={15} className="text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-amber-900 text-sm">Live Copper Price Chain</h2>
                    <p className="text-xs text-amber-600">Computed from market inputs above</p>
                  </div>
                </div>
                <div className="p-5 grid sm:grid-cols-2 gap-4">
                  {/* Left: breakdown */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-2 px-3 bg-white/60 rounded-xl">
                      <span className="text-xs text-gray-600">LME + Premium × USD/INR ÷ 1000</span>
                      <span className="font-bold text-gray-900 tabular-nums">₹ {fmt(lme.base)}/kg</span>
                    </div>
                    <div className="flex justify-between items-center py-2 px-3 bg-white/60 rounded-xl">
                      <span className="text-xs text-gray-600">+ Freight</span>
                      <span className="font-semibold text-gray-700 tabular-nums">₹ {fmt(lme.freight)}/kg</span>
                    </div>
                    <div className="flex justify-between items-center py-2 px-3 bg-white/60 rounded-xl">
                      <span className="text-xs text-gray-600">+ Fabrication / drawing</span>
                      <span className="font-semibold text-gray-700 tabular-nums">₹ {fmt(lme.fab)}/kg</span>
                    </div>
                    <div className="flex justify-between items-center py-2.5 px-3 bg-amber-100 rounded-xl border border-amber-200">
                      <span className="text-sm font-bold text-amber-800">= Bare Copper</span>
                      <span className="text-lg font-bold text-amber-700 tabular-nums">₹ {fmt(lme.bare)}/kg</span>
                    </div>
                    <div className="flex justify-between items-center py-2 px-3 bg-white/60 rounded-xl">
                      <span className="text-xs text-gray-600">+ Tinning charge</span>
                      <span className="font-semibold text-gray-700 tabular-nums">₹ {fmt(lme.tinning)}/kg</span>
                    </div>
                    <div className="flex justify-between items-center py-2.5 px-3 rounded-xl border-2 border-amber-400" style={{ background: 'linear-gradient(135deg, #f97316, #c2410c)' }}>
                      <span className="text-sm font-bold text-white">= Tinned Copper</span>
                      <span className="text-lg font-bold text-white tabular-nums">₹ {fmt(lme.tinned)}/kg</span>
                    </div>
                  </div>

                  {/* Right: summary cards */}
                  <div className="flex flex-col gap-3 justify-center">
                    <div className="bg-white rounded-2xl p-4 border border-amber-100 text-center shadow-sm">
                      <p className="text-xs text-gray-500 mb-1">Bare Copper Price</p>
                      <p className="text-3xl font-bold text-amber-600 tabular-nums">₹{fmt(lme.bare, 0)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">per kg</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 border border-orange-100 text-center shadow-sm">
                      <p className="text-xs text-gray-500 mb-1">Tinned Copper Price</p>
                      <p className="text-3xl font-bold text-brand-600 tabular-nums">₹{fmt(lme.tinned, 0)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">per kg</p>
                    </div>
                    <p className="text-xs text-gray-400 text-center">Auto-updates when you change inputs</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Electricity */}
          {activeTab === 'electricity' && (
            <div className="card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center">
                  <Zap size={15} className="text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-sm">Electricity Tariffs</h2>
                  <p className="text-xs text-gray-400">Used to compute machine running costs per hour</p>
                </div>
              </div>
              <div className="px-2 py-2 divide-y divide-gray-50">
                {categoryVars('electricity').map(row => <VarRow key={row.key} row={row} />)}
              </div>
            </div>
          )}

          {/* Labour */}
          {activeTab === 'labour' && (
            <>
              <div className="card overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                    <Users size={15} className="text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900 text-sm">Staffing &amp; Salaries</h2>
                    <p className="text-xs text-gray-400">Monthly salaries and working schedule</p>
                  </div>
                </div>
                <div className="px-2 py-2 divide-y divide-gray-50">
                  {categoryVars('labour').map(row => <VarRow key={row.key} row={row} />)}
                </div>
              </div>

              {/* Computed hourly rates */}
              <div className="rounded-2xl overflow-hidden border border-brand-100" style={{ background: 'linear-gradient(135deg, #fff7ed, #fdf9f7)' }}>
                <div className="flex items-center gap-3 px-5 py-4 border-b border-brand-100">
                  <ArrowRight size={15} className="text-brand-600" />
                  <h2 className="font-bold text-brand-900 text-sm">Computed Hourly Rates</h2>
                  <span className="ml-auto text-xs text-brand-600 font-medium">Salary ÷ (Days × Hours)</span>
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Supervisor', rate: labour.supervisor },
                    { label: 'Operator',   rate: labour.operator },
                    { label: 'Helper',     rate: labour.helper },
                    { label: 'Cleaner',    rate: labour.cleaner },
                  ].map(({ label, rate }) => (
                    <div key={label} className="bg-white rounded-xl p-3 border border-brand-50 text-center shadow-sm">
                      <p className="text-xs text-gray-500 mb-1">{label}</p>
                      <p className="text-xl font-bold text-brand-600 tabular-nums">₹{fmt(rate, 2)}</p>
                      <p className="text-xs text-gray-400">/hour</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Job Work */}
          {activeTab === 'job_work' && (
            <div className="card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <Wrench size={15} className="text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-sm">Job Work Rates</h2>
                  <p className="text-xs text-gray-400">Outsourced process rates per unit</p>
                </div>
              </div>
              {categoryVars('job_work').length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle size={32} className="text-gray-200 mb-3" />
                  <p className="text-gray-500 text-sm font-medium">No job work rates found</p>
                  <p className="text-gray-400 text-xs mt-1">Add rows to the global_variables table with category = 'job_work'</p>
                </div>
              ) : (
                <div className="px-2 py-2 divide-y divide-gray-50">
                  {categoryVars('job_work').map(row => <VarRow key={row.key} row={row} />)}
                </div>
              )}
            </div>
          )}

          {/* Overhead */}
          {activeTab === 'overhead' && (
            <div className="card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
                  <BarChart2 size={15} className="text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-sm">Overhead &amp; Margins</h2>
                  <p className="text-xs text-gray-400">Applied as percentage add-ons in quotations</p>
                </div>
              </div>
              {categoryVars('overhead').length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle size={32} className="text-gray-200 mb-3" />
                  <p className="text-gray-500 text-sm font-medium">No overhead rates found</p>
                  <p className="text-gray-400 text-xs mt-1">Add rows to the global_variables table with category = 'overhead'</p>
                </div>
              ) : (
                <div className="px-2 py-2 divide-y divide-gray-50">
                  {categoryVars('overhead').map(row => <VarRow key={row.key} row={row} />)}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
