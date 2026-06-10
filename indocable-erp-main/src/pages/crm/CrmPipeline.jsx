import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase'
import toast from 'react-hot-toast'
import {
  RefreshCw, Search, Phone, Package, Trophy, X as XIcon, MessageCircle,
} from 'lucide-react'
import { PIPELINE_STAGES, OUTCOME, isMissingSchema, leadName } from '../../lib/crm'
import { fmtDate } from '../../lib/format'

export default function CrmPipeline() {
  const [leads, setLeads]     = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [schemaWarn, setSchemaWarn] = useState(false)

  useEffect(() => { fetchLeads() }, [])

  async function fetchLeads() {
    setLoading(true)
    const { data, error } = await supabase
      .from('enquiries')
      .select('*, enquiry_items(id)')
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    setLeads(data || [])
    setLoading(false)
  }

  async function move(lead, status) {
    const prev = lead.status
    setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, status } : l))
    const { error } = await supabase.from('enquiries')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', lead.id)
    if (error) {
      toast.error(error.message)
      setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, status: prev } : l))
    }
  }

  async function setOutcome(lead, outcome) {
    setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, outcome } : l))
    const { error } = await supabase.from('enquiries')
      .update({ outcome, updated_at: new Date().toISOString() }).eq('id', lead.id)
    if (error) {
      if (isMissingSchema(error)) { setSchemaWarn(true); toast.error('Run the CRM setup SQL to track Won/Lost') }
      else toast.error(error.message)
      setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, outcome: lead.outcome } : l))
    } else {
      toast.success(`Marked ${OUTCOME[outcome].label}`)
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return leads
    return leads.filter(l =>
      leadName(l).toLowerCase().includes(q) ||
      l.contact_name?.toLowerCase().includes(q) ||
      l.enquiry_no?.toLowerCase().includes(q) ||
      l.phone?.includes(q))
  }, [leads, search])

  const byStage = useMemo(() => {
    const m = Object.fromEntries(PIPELINE_STAGES.map(s => [s.key, []]))
    filtered.forEach(l => { (m[l.status] || (m[l.status] = [])).push(l) })
    return m
  }, [filtered])

  const closed = leads.filter(l => l.status === 'closed')
  const won = closed.filter(l => l.outcome === 'won').length
  const convRate = closed.length ? Math.round((won / closed.length) * 100) : 0

  function waLink(l) {
    const p = l.phone?.replace(/\D/g, '')
    if (!p) return null
    return `https://wa.me/${p.length === 10 ? '91' + p : p}`
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-header">Sales Pipeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {leads.length} leads · {won} won · {convRate}% conversion
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads…"
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent w-52" />
          </div>
          <button onClick={fetchLeads} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl cursor-pointer"><RefreshCw size={16} /></button>
        </div>
      </div>

      {schemaWarn && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-2.5">
          Won/Lost tracking needs the CRM database setup — see <span className="font-mono">CRM_SETUP.md</span>.
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading pipeline…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {PIPELINE_STAGES.map(stage => (
            <div key={stage.key} className={`rounded-2xl border ${stage.col} p-3 min-h-[200px]`}>
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                  <span className={`text-sm font-bold ${stage.head}`}>{stage.label}</span>
                </div>
                <span className="text-xs font-semibold text-gray-400 bg-white rounded-md px-1.5 py-0.5 border border-gray-100">
                  {byStage[stage.key]?.length || 0}
                </span>
              </div>

              <div className="space-y-2">
                {(byStage[stage.key] || []).map(lead => (
                  <div key={lead.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 text-sm truncate">{leadName(lead)}</div>
                        {lead.contact_name && lead.company && (
                          <div className="text-[11px] text-gray-400 truncate">{lead.contact_name}</div>
                        )}
                      </div>
                      {lead.enquiry_no && <span className="font-mono text-[10px] text-gray-400 flex-shrink-0">{lead.enquiry_no}</span>}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-500">
                      {lead.phone && <span className="flex items-center gap-1"><Phone size={10} />{lead.phone}</span>}
                      {lead.enquiry_items?.length > 0 && <span className="flex items-center gap-1"><Package size={10} />{lead.enquiry_items.length}</span>}
                      <span>{fmtDate(lead.created_at)}</span>
                      {lead.lead_source && <span className="bg-gray-100 rounded px-1.5 py-0.5">{lead.lead_source}</span>}
                    </div>

                    {lead.status === 'closed' && (
                      <div className="flex items-center gap-1.5 mt-2">
                        {lead.outcome
                          ? <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${OUTCOME[lead.outcome].badge}`}>{OUTCOME[lead.outcome].label}</span>
                          : <>
                              <button onClick={() => setOutcome(lead, 'won')} className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-0.5 hover:bg-emerald-100 cursor-pointer"><Trophy size={10} />Won</button>
                              <button onClick={() => setOutcome(lead, 'lost')} className="flex items-center gap-1 text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-0.5 hover:bg-red-100 cursor-pointer"><XIcon size={10} />Lost</button>
                            </>
                        }
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-gray-50">
                      <select value={lead.status} onChange={e => move(lead, e.target.value)}
                        className="flex-1 text-[11px] font-medium border border-gray-200 rounded-lg px-2 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-400">
                        {PIPELINE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                      {waLink(lead) && (
                        <a href={waLink(lead)} target="_blank" rel="noreferrer" title="WhatsApp"
                          className="text-green-600 hover:text-green-700 cursor-pointer"><MessageCircle size={14} /></a>
                      )}
                    </div>
                  </div>
                ))}
                {(byStage[stage.key] || []).length === 0 && (
                  <div className="text-center text-[11px] text-gray-300 py-6">No leads</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
