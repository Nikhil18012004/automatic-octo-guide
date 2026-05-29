import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import {
  MessageCircle, Search, Filter, ChevronDown, ChevronUp,
  Phone, Building2, MapPin, Package, Clock, CheckCircle2,
  AlertCircle, XCircle, Eye, Edit3, Save, X,
} from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_CONFIG = {
  new:       { label: 'New',       color: 'bg-blue-100 text-blue-700 border-blue-200',    icon: AlertCircle },
  reviewing: { label: 'Reviewing', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Eye },
  quoted:    { label: 'Quoted',    color: 'bg-purple-100 text-purple-700 border-purple-200', icon: CheckCircle2 },
  closed:    { label: 'Closed',    color: 'bg-gray-100 text-gray-500 border-gray-200',    icon: XCircle },
}

export default function EnquiryAdmin({ profile }) {
  const [enquiries,  setEnquiries]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expanded,   setExpanded]   = useState(null)
  const [editNotes,  setEditNotes]  = useState({})
  const [savingNotes,setSavingNotes]= useState(null)
  const [updatingStatus, setUpdatingStatus] = useState(null)

  useEffect(() => { fetchEnquiries() }, [])

  async function fetchEnquiries() {
    setLoading(true)
    const { data } = await supabase
      .from('enquiries')
      .select('*, enquiry_items(*)')
      .order('created_at', { ascending: false })
    setEnquiries(data || [])
    setLoading(false)
  }

  async function updateStatus(id, status) {
    setUpdatingStatus(id)
    const { error } = await supabase
      .from('enquiries')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { toast.error('Failed to update status'); setUpdatingStatus(null); return }
    setEnquiries(prev => prev.map(e => e.id === id ? { ...e, status } : e))
    toast.success('Status updated')
    setUpdatingStatus(null)
  }

  async function saveNotes(id) {
    setSavingNotes(id)
    const notes = editNotes[id] ?? ''
    const { error } = await supabase
      .from('enquiries')
      .update({ admin_notes: notes, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { toast.error('Failed to save notes'); setSavingNotes(null); return }
    setEnquiries(prev => prev.map(e => e.id === id ? { ...e, admin_notes: notes } : e))
    toast.success('Notes saved')
    setSavingNotes(null)
    setEditNotes(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  function waLink(e) {
    const phone = e.phone?.replace(/\D/g, '')
    if (!phone) return null
    const num = phone.length === 10 ? `91${phone}` : phone
    const items = (e.enquiry_items || []).map(i => `• ${i.description}${i.quantity ? ` (${i.quantity} ${i.unit})` : ''}`).join('\n')
    const text = encodeURIComponent(
      `Hi ${e.contact_name},\nThank you for your enquiry ${e.enquiry_no}.\n\n${items ? `Items enquired:\n${items}\n\n` : ''}We are reviewing your request and will share pricing shortly.\n\n— Indocable / MICA Group\n+91 80735 33289`
    )
    return `https://wa.me/${num}?text=${text}`
  }

  const filtered = enquiries.filter(e => {
    const matchStatus = statusFilter === 'all' || e.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !q || e.enquiry_no?.toLowerCase().includes(q)
      || e.contact_name?.toLowerCase().includes(q)
      || e.company_name?.toLowerCase().includes(q)
      || e.phone?.includes(q)
      || e.project_name?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const counts = Object.fromEntries(
    Object.keys(STATUS_CONFIG).map(s => [s, enquiries.filter(e => e.status === s).length])
  )

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="page-header">Enquiry Inbox</h1>
        <p className="page-sub">Manage and respond to dealer/client enquiries</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon
          return (
            <button key={key}
              onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
              className={`card p-4 text-left transition-all ${statusFilter === key ? 'ring-2 ring-brand-500' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <Icon size={15} className="text-gray-400" />
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
              </div>
              <div className="text-2xl font-black text-gray-900">{counts[key] || 0}</div>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, company, phone, ENQ number…"
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-brand-500/30">
            <option value="all">All statuses</option>
            {Object.entries(STATUS_CONFIG).map(([k, c]) => (
              <option key={k} value={k}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <MessageCircle size={44} className="mx-auto text-gray-200 mb-4" />
          <h3 className="font-bold text-gray-500">No enquiries found</h3>
          <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(enq => {
            const isExpanded = expanded === enq.id
            const cfg = STATUS_CONFIG[enq.status] || STATUS_CONFIG.new
            const wa = waLink(enq)
            const isEditingNotes = enq.id in editNotes

            return (
              <div key={enq.id} className="card overflow-hidden">
                {/* Row header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : enq.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-gray-500">{enq.enquiry_no}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
                      {enq.enquiry_items?.length > 0 && (
                        <span className="text-xs text-gray-400">{enq.enquiry_items.length} item{enq.enquiry_items.length > 1 ? 's' : ''}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{enq.contact_name}</span>
                      {enq.company_name && <span className="text-xs text-gray-400 flex items-center gap-1"><Building2 size={11} />{enq.company_name}</span>}
                      {enq.city && <span className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={11} />{enq.city}</span>}
                      {enq.phone && <span className="text-xs text-gray-400 flex items-center gap-1"><Phone size={11} />{enq.phone}</span>}
                    </div>
                    {enq.project_name && (
                      <div className="text-xs text-brand-600 mt-0.5 font-medium">{enq.project_name}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-400 hidden sm:block">
                      {new Date(enq.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50/50 space-y-4">

                    {/* Items */}
                    {enq.enquiry_items?.length > 0 && (
                      <div>
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <Package size={12} /> Cable Items
                        </div>
                        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
                          {enq.enquiry_items.map((item, i) => (
                            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                              <span className="w-5 h-5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-black flex items-center justify-center flex-shrink-0">{i+1}</span>
                              <span className="flex-1 font-medium text-gray-800">{item.description}</span>
                              {item.quantity && (
                                <span className="text-gray-500 text-xs">{item.quantity} {item.unit}</span>
                              )}
                              {item.notes && (
                                <span className="text-gray-400 text-xs italic">"{item.notes}"</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Message */}
                    {enq.message && (
                      <div>
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Customer Message</div>
                        <p className="text-sm text-gray-700 bg-white rounded-xl border border-gray-100 px-4 py-3">{enq.message}</p>
                      </div>
                    )}

                    {/* Status + Actions row */}
                    <div className="flex flex-wrap gap-3 items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500">Status:</span>
                        <select
                          value={enq.status}
                          onChange={e => updateStatus(enq.id, e.target.value)}
                          disabled={updatingStatus === enq.id}
                          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500/30"
                        >
                          {Object.entries(STATUS_CONFIG).map(([k, c]) => (
                            <option key={k} value={k}>{c.label}</option>
                          ))}
                        </select>
                      </div>

                      {wa && (
                        <a href={wa} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors">
                          <MessageCircle size={13} /> Reply on WhatsApp
                        </a>
                      )}

                      {enq.phone && (
                        <a href={`tel:+91${enq.phone.replace(/\D/g,'')}`}
                          className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-bold transition-colors">
                          <Phone size={13} /> Call
                        </a>
                      )}
                    </div>

                    {/* Admin Notes */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Admin Notes</div>
                        {!isEditingNotes && (
                          <button
                            onClick={() => setEditNotes(prev => ({ ...prev, [enq.id]: enq.admin_notes || '' }))}
                            className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1"
                          >
                            <Edit3 size={11} /> Edit
                          </button>
                        )}
                      </div>
                      {isEditingNotes ? (
                        <div className="space-y-2">
                          <textarea
                            rows={3}
                            value={editNotes[enq.id]}
                            onChange={e => setEditNotes(prev => ({ ...prev, [enq.id]: e.target.value }))}
                            placeholder="Internal notes — pricing discussed, follow-up date, etc."
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveNotes(enq.id)}
                              disabled={savingNotes === enq.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                            >
                              <Save size={12} /> {savingNotes === enq.id ? 'Saving…' : 'Save Notes'}
                            </button>
                            <button
                              onClick={() => setEditNotes(prev => { const n = { ...prev }; delete n[enq.id]; return n })}
                              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-xs font-bold transition-colors"
                            >
                              <X size={12} /> Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className={`text-sm bg-white rounded-xl border border-gray-100 px-4 py-3 ${enq.admin_notes ? 'text-gray-700' : 'text-gray-300 italic'}`}>
                          {enq.admin_notes || 'No notes yet'}
                        </p>
                      )}
                    </div>

                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
