import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import {
  Users, MessageSquare, Trophy, CheckSquare, TrendingUp, ArrowRight, Building2,
} from 'lucide-react'
import { fmtDate } from '../../lib/format'
import { PIPELINE_STAGES, STAGE_LABEL, isMissingSchema, leadName } from '../../lib/crm'

export default function CrmDashboard() {
  const navigate = useNavigate()
  const [leads, setLeads]   = useState([])
  const [custCount, setCustCount] = useState(0)
  const [openTasks, setOpenTasks] = useState(null) // null = unknown (not set up)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: enq }, { count: cc }, { data: tk, error: tkErr }] = await Promise.all([
      supabase.from('enquiries').select('id, contact_name, company, phone, enquiry_no, status, outcome, lead_source, created_at').order('created_at', { ascending: false }),
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase.from('crm_tasks').select('id, status').eq('status', 'open'),
    ])
    setLeads(enq || [])
    setCustCount(cc || 0)
    setOpenTasks(tkErr && isMissingSchema(tkErr) ? null : (tk?.length || 0))
    setLoading(false)
  }

  const stageCounts = useMemo(() => {
    const m = Object.fromEntries(PIPELINE_STAGES.map(s => [s.key, 0]))
    leads.forEach(l => { if (m[l.status] != null) m[l.status]++ })
    return m
  }, [leads])

  const closed = leads.filter(l => l.status === 'closed')
  const won = closed.filter(l => l.outcome === 'won').length
  const convRate = closed.length ? Math.round((won / closed.length) * 100) : 0
  const maxStage = Math.max(1, ...PIPELINE_STAGES.map(s => stageCounts[s.key]))

  const sources = useMemo(() => {
    const m = {}
    leads.forEach(l => { const s = l.lead_source || 'Unknown'; m[s] = (m[s] || 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [leads])
  const maxSource = Math.max(1, ...sources.map(s => s[1]))

  const ACCENT = {
    brand:   { box: 'bg-brand-50',   icon: 'text-brand-600' },
    emerald: { box: 'bg-emerald-50', icon: 'text-emerald-600' },
  }
  const Tile = ({ icon: Icon, label, value, onClick, accent = 'brand' }) => (
    <button onClick={onClick} disabled={!onClick}
      className={`card p-4 text-left transition-all ${onClick ? 'hover:shadow-md hover:border-brand-200 cursor-pointer' : 'cursor-default'}`}>
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-xl ${ACCENT[accent].box} flex items-center justify-center`}><Icon size={17} className={ACCENT[accent].icon} /></div>
        {onClick && <ArrowRight size={14} className="text-gray-300" />}
      </div>
      <div className="text-2xl font-bold text-gray-900 mt-3 leading-none">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </button>
  )

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Loading CRM…</div>

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-header">CRM Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">Leads, conversion and follow-ups at a glance</p>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile icon={MessageSquare} label="Total leads" value={leads.length} onClick={() => navigate('/crm/pipeline')} />
        <Tile icon={TrendingUp} label="Conversion rate" value={`${convRate}%`} accent="emerald" onClick={() => navigate('/crm/pipeline')} />
        <Tile icon={Building2} label="Customers" value={custCount} onClick={() => navigate('/crm/customers')} />
        <Tile icon={CheckSquare} label="Open tasks" value={openTasks == null ? '—' : openTasks} onClick={() => navigate('/crm/tasks')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pipeline funnel */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Pipeline</h3>
            <button onClick={() => navigate('/crm/pipeline')} className="text-xs text-brand-600 font-semibold hover:underline cursor-pointer">Open board →</button>
          </div>
          <div className="space-y-3">
            {PIPELINE_STAGES.map(s => (
              <div key={s.key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5 font-medium text-gray-600"><span className={`w-2 h-2 rounded-full ${s.dot}`} />{s.label}</span>
                  <span className="font-semibold text-gray-500">{stageCounts[s.key]}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${s.dot}`} style={{ width: `${(stageCounts[s.key] / maxStage) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2 text-sm">
            <Trophy size={15} className="text-emerald-500" />
            <span className="text-gray-600">{won} won of {closed.length} closed</span>
          </div>
        </div>

        {/* Lead sources */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Lead sources</h3>
          {sources.length === 0 ? (
            <p className="text-xs text-gray-300 py-6 text-center">No leads yet</p>
          ) : (
            <div className="space-y-3">
              {sources.map(([name, count]) => (
                <div key={name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-gray-600">{name}</span>
                    <span className="font-semibold text-gray-500">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(count / maxSource) * 100}%` }} />
                  </div>
                </div>
              ))}
              {sources.some(([n]) => n === 'Unknown') && (
                <p className="text-[11px] text-gray-400 pt-1">Tip: set a lead source on enquiries (needs CRM setup) to track this.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent leads */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Recent leads</h3>
          <button onClick={() => navigate('/crm/pipeline')} className="text-xs text-brand-600 font-semibold hover:underline cursor-pointer">View pipeline →</button>
        </div>
        {leads.length === 0 ? (
          <p className="text-xs text-gray-300 py-6 text-center">No leads yet</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {leads.slice(0, 6).map(l => (
              <div key={l.id} className="flex items-center gap-3 py-2.5">
                <Users size={14} className="text-gray-300 flex-shrink-0" />
                <span className="flex-1 min-w-0 text-sm text-gray-700 truncate">{leadName(l)}</span>
                <span className="text-[11px] text-gray-400">{STAGE_LABEL[l.status] || l.status}</span>
                <span className="text-[11px] text-gray-300 w-16 text-right">{fmtDate(l.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
