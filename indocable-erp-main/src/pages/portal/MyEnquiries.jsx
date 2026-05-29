import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import {
  MessageSquare, ChevronDown, ChevronUp, ArrowRight,
  MessageCircle, Clock, CheckCircle2, XCircle,
} from 'lucide-react'

const STATUS_CONFIG = {
  new:       { label: 'New',        color: 'bg-amber-100 text-amber-700 border-amber-200' },
  reviewing: { label: 'Reviewing',  color: 'bg-blue-100 text-blue-700 border-blue-200' },
  quoted:    { label: 'Quoted',     color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  closed:    { label: 'Closed',     color: 'bg-gray-100 text-gray-600 border-gray-200' },
}

export default function MyEnquiries({ profile }) {
  const navigate           = useNavigate()
  const [enquiries, setEnquiries] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [expanded,  setExpanded]  = useState({})

  useEffect(() => {
    if (!profile) return
    fetchEnquiries()
  }, [profile])

  async function fetchEnquiries() {
    setLoading(true)
    const { data } = await supabase
      .from('enquiries')
      .select('*, enquiry_items(*)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
    setEnquiries(data || [])
    setLoading(false)
  }

  function toggleExpand(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (!profile) return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center">
      <MessageSquare size={44} className="mx-auto text-gray-200 mb-4" />
      <h2 className="text-xl font-bold text-gray-600 mb-2">Sign in to view enquiries</h2>
      <p className="text-gray-400 text-sm mb-5">Log in to track all your submitted enquiries.</p>
      <button onClick={() => navigate('/login')}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white rounded-xl font-bold text-sm">
        Login <ArrowRight size={14} />
      </button>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-7 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">My Enquiries</h1>
          <p className="text-gray-500 text-sm mt-1">{enquiries.length} enquiry{enquiries.length !== 1 ? 's' : ''} submitted</p>
        </div>
        <button
          onClick={() => navigate('/portal/enquiry')}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold text-sm transition-colors shadow-glow-orange"
        >
          <MessageSquare size={14} /> New Enquiry
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : enquiries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-16 text-center">
          <MessageSquare size={44} className="mx-auto text-gray-200 mb-4" />
          <h3 className="text-gray-600 font-bold text-lg mb-1">No enquiries yet</h3>
          <p className="text-gray-400 text-sm mb-5">Submit your first enquiry and we'll get back to you within 2 hours.</p>
          <button onClick={() => navigate('/portal/enquiry')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white rounded-xl font-bold text-sm">
            <MessageSquare size={14} /> Send First Enquiry
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {enquiries.map(enq => {
            const status   = STATUS_CONFIG[enq.status] || STATUS_CONFIG.new
            const isOpen   = expanded[enq.id]
            const hasItems = enq.enquiry_items?.length > 0
            const date     = new Date(enq.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

            return (
              <div key={enq.id} className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
                {/* Row header */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                  onClick={() => toggleExpand(enq.id)}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex-shrink-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        enq.status === 'quoted' ? 'bg-emerald-100' :
                        enq.status === 'reviewing' ? 'bg-blue-100' :
                        'bg-amber-100'
                      }`}>
                        {enq.status === 'quoted'
                          ? <CheckCircle2 size={16} className="text-emerald-600" />
                          : enq.status === 'closed'
                            ? <XCircle size={16} className="text-gray-400" />
                            : <Clock size={16} className="text-amber-600" />
                        }
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm">{enq.enquiry_no || `ENQ-${enq.id.slice(0,8)}`}</span>
                        <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-lg border ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">{enq.subject || enq.message?.slice(0, 60) || 'General Enquiry'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className="text-xs text-gray-400 hidden sm:block">{date}</span>
                    {isOpen ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                    {/* Message */}
                    {enq.message && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Your Message</div>
                        <p className="text-sm text-gray-700 leading-relaxed">{enq.message}</p>
                      </div>
                    )}

                    {/* Items */}
                    {hasItems && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Cable Items</div>
                        <div className="space-y-2">
                          {enq.enquiry_items.map(item => (
                            <div key={item.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-xl px-3 py-2.5">
                              <span className="text-gray-700 font-medium">{item.description}</span>
                              {item.quantity && (
                                <span className="text-gray-500 text-xs flex-shrink-0 ml-3">{item.quantity} {item.unit}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Admin notes (if quoted or responded) */}
                    {enq.admin_notes && (
                      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                        <div className="text-xs font-semibold text-blue-600 mb-1">Response from Indocable</div>
                        <p className="text-sm text-blue-800">{enq.admin_notes}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <a
                        href={`https://wa.me/918073533289?text=${encodeURIComponent(`Hi, I'm following up on enquiry ${enq.enquiry_no || enq.id.slice(0,8)}`)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors"
                      >
                        <MessageCircle size={13} /> Follow up on WhatsApp
                      </a>
                      <a
                        href={`mailto:cables@micagroup.net?subject=Follow up: ${enq.enquiry_no || ''}&body=Hi, following up on my enquiry.`}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-50 transition-colors"
                      >
                        Email Us
                      </a>
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
