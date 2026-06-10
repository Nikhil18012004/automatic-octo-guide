import { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Phone, Mail, MapPin, FileText, Truck, MessageSquare,
  Plus, Tag, X, CheckSquare, Square, Send, Receipt, Trophy,
} from 'lucide-react'
import { gradient, fmtINR, fmtDate } from '../../lib/format'
import { initials, isMissingSchema, normName, ACTIVITY_TYPES } from '../../lib/crm'

const ACT_ICON = { note: MessageSquare, call: Phone, visit: MapPin, email: Mail, whatsapp: Send }

export default function CustomerDetail({ profile }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [schemaWarn, setSchemaWarn] = useState(false)

  const [enquiries, setEnquiries] = useState([])
  const [quotes, setQuotes]       = useState([])
  const [dispatches, setDispatches] = useState([])
  const [activities, setActivities] = useState([])
  const [tasks, setTasks]         = useState([])

  const [newTag, setNewTag]   = useState('')
  const [notes, setNotes]     = useState('')
  const [actType, setActType] = useState('note')
  const [actBody, setActBody] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDue, setTaskDue]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: cust } = await supabase.from('customers').select('*').eq('id', id).single()
    if (!cust) { setLoading(false); return }
    setCustomer(cust)
    setNotes(cust.crm_notes || '')

    // Dispatches — real FK link.
    const { data: disp } = await supabase
      .from('dispatch_orders').select('*, dispatch_items(quantity, amount)').eq('customer_id', id)
      .order('created_at', { ascending: false })
    setDispatches(disp || [])

    // Enquiries & quotes — loosely matched by name/phone/email (no FK in schema).
    const nk = normName(cust.name)
    const { data: enq } = await supabase.from('enquiries')
      .select('id, contact_name, company, phone, email, enquiry_no, status, outcome, created_at')
      .order('created_at', { ascending: false })
    setEnquiries((enq || []).filter(e =>
      (cust.phone && e.phone && e.phone.replace(/\D/g, '') === cust.phone.replace(/\D/g, '')) ||
      (cust.email && e.email && e.email.toLowerCase() === cust.email.toLowerCase()) ||
      (nk && (normName(e.company) === nk || normName(e.contact_name) === nk))))

    const { data: qts } = await supabase.from('quotations')
      .select('id, customer, total, created_at').order('created_at', { ascending: false })
    setQuotes((qts || []).filter(q => nk && normName(q.customer) === nk))

    // CRM-only tables (need migration).
    const { data: acts, error: actErr } = await supabase.from('crm_activities')
      .select('*').eq('customer_id', id).order('created_at', { ascending: false })
    if (actErr && isMissingSchema(actErr)) setSchemaWarn(true)
    setActivities(acts || [])

    const { data: tks, error: tkErr } = await supabase.from('crm_tasks')
      .select('*').eq('customer_id', id).order('due_date', { ascending: true })
    if (tkErr && isMissingSchema(tkErr)) setSchemaWarn(true)
    setTasks(tks || [])

    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function saveTags(tags) {
    const prev = customer.tags || []
    setCustomer(c => ({ ...c, tags }))
    const { error } = await supabase.from('customers').update({ tags }).eq('id', id)
    if (error) {
      setCustomer(c => ({ ...c, tags: prev }))
      if (isMissingSchema(error)) { setSchemaWarn(true); toast.error('Run CRM setup SQL to use tags') }
      else toast.error(error.message)
    }
  }
  function addTag() {
    const t = newTag.trim()
    if (!t) return
    if ((customer.tags || []).includes(t)) { setNewTag(''); return }
    saveTags([...(customer.tags || []), t]); setNewTag('')
  }
  function removeTag(t) { saveTags((customer.tags || []).filter(x => x !== t)) }

  async function saveNotes() {
    const { error } = await supabase.from('customers').update({ crm_notes: notes }).eq('id', id)
    if (error) { isMissingSchema(error) ? setSchemaWarn(true) : toast.error(error.message); return }
    toast.success('Notes saved')
  }

  async function addActivity() {
    if (!actBody.trim()) return
    const { error } = await supabase.from('crm_activities')
      .insert({ customer_id: id, type: actType, body: actBody.trim(), created_by: profile.id })
    if (error) { isMissingSchema(error) ? setSchemaWarn(true) : toast.error(error.message); if (isMissingSchema(error)) toast.error('Run CRM setup SQL to log activities'); return }
    setActBody(''); toast.success('Logged'); load()
  }

  async function addTask() {
    if (!taskTitle.trim()) return
    const { error } = await supabase.from('crm_tasks').insert({
      title: taskTitle.trim(), due_date: taskDue || null, customer_id: id, created_by: profile.id,
    })
    if (error) { isMissingSchema(error) ? setSchemaWarn(true) : toast.error(error.message); if (isMissingSchema(error)) toast.error('Run CRM setup SQL to add tasks'); return }
    setTaskTitle(''); setTaskDue(''); toast.success('Task added'); load()
  }

  async function toggleTask(t) {
    const done = t.status !== 'done'
    setTasks(ts => ts.map(x => x.id === t.id ? { ...x, status: done ? 'done' : 'open' } : x))
    await supabase.from('crm_tasks').update({
      status: done ? 'done' : 'open', completed_at: done ? new Date().toISOString() : null,
    }).eq('id', t.id)
  }

  // Unified interaction timeline.
  const timeline = useMemo(() => {
    const items = []
    activities.forEach(a => items.push({ at: a.created_at, kind: a.type, label: a.body }))
    enquiries.forEach(e => items.push({ at: e.created_at, kind: 'enquiry', label: `Enquiry ${e.enquiry_no || ''} — ${e.status}${e.outcome ? ` (${e.outcome})` : ''}` }))
    quotes.forEach(q => items.push({ at: q.created_at, kind: 'quote', label: `Quotation${q.total ? ` — ${fmtINR(q.total)}` : ''}` }))
    dispatches.forEach(d => items.push({ at: d.created_at || d.date, kind: 'dispatch', label: `Dispatch ${d.challan_number || ''} — ${d.status}` }))
    return items.filter(i => i.at).sort((a, b) => new Date(b.at) - new Date(a.at))
  }, [activities, enquiries, quotes, dispatches])

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
  if (!customer) return (
    <div className="card p-16 text-center">
      <p className="text-gray-400">Customer not found.</p>
      <button onClick={() => navigate('/crm/customers')} className="mt-3 text-brand-600 font-semibold text-sm cursor-pointer">Back to customers</button>
    </div>
  )

  const dispatchValue = dispatches.reduce((s, d) => s + (d.dispatch_items || []).reduce((x, i) => x + (parseFloat(i.amount) || 0), 0), 0)
  const wonCount = enquiries.filter(e => e.outcome === 'won').length

  const Stat = ({ icon: Icon, label, value }) => (
    <div className="card p-3 flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0"><Icon size={15} className="text-brand-600" /></div>
      <div className="min-w-0"><div className="text-base font-bold text-gray-900 leading-none">{value}</div><div className="text-[11px] text-gray-400 mt-0.5">{label}</div></div>
    </div>
  )

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/crm/customers')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 cursor-pointer">
        <ArrowLeft size={15} /> Customers
      </button>

      {schemaWarn && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-2.5">
          Tags, notes, tasks &amp; activity logging need the CRM database setup — see <span className="font-mono">CRM_SETUP.md</span>.
        </div>
      )}

      {/* Header */}
      <div className="card p-5 flex flex-wrap items-center gap-4">
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient(customer.name)} flex items-center justify-center flex-shrink-0`}>
          <span className="text-white text-lg font-bold">{initials(customer.name)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-gray-900 truncate">{customer.name}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
            {customer.phone && <span className="flex items-center gap-1"><Phone size={12} />{customer.phone}</span>}
            {customer.email && <span className="flex items-center gap-1"><Mail size={12} />{customer.email}</span>}
            {customer.address && <span className="flex items-center gap-1"><MapPin size={12} />{customer.address}</span>}
            {customer.gst_number && <span className="flex items-center gap-1"><Receipt size={12} />GST {customer.gst_number}</span>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={MessageSquare} label="Enquiries" value={enquiries.length} />
        <Stat icon={Trophy} label="Won" value={wonCount} />
        <Stat icon={FileText} label="Quotations" value={quotes.length} />
        <Stat icon={Truck} label="Dispatch value" value={fmtINR(dispatchValue)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="space-y-5">
          {/* Tags */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3"><Tag size={15} className="text-brand-500" /><h3 className="font-semibold text-gray-900 text-sm">Tags</h3></div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(customer.tags || []).map(t => (
                <span key={t} className="flex items-center gap-1 text-[11px] font-semibold bg-brand-50 text-brand-700 border border-brand-100 rounded-lg px-2 py-0.5">
                  {t}<button onClick={() => removeTag(t)} className="text-brand-400 hover:text-brand-600 cursor-pointer"><X size={10} /></button>
                </span>
              ))}
              {(customer.tags || []).length === 0 && <span className="text-xs text-gray-300">No tags</span>}
            </div>
            <div className="flex gap-2">
              <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()}
                placeholder="Hot, VIP, South…" className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
              <button onClick={addTag} className="px-3 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-semibold hover:bg-gray-900 cursor-pointer">Add</button>
            </div>
          </div>

          {/* Notes */}
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-2">Notes</h3>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
              placeholder="Internal notes about this customer…"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none" />
            <button onClick={saveNotes} className="mt-2 px-4 py-1.5 bg-brand-500 text-white rounded-lg text-xs font-semibold hover:bg-brand-600 cursor-pointer">Save notes</button>
          </div>

          {/* Tasks */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3"><CheckSquare size={15} className="text-brand-500" /><h3 className="font-semibold text-gray-900 text-sm">Follow-ups</h3></div>
            <div className="space-y-1.5 mb-3">
              {tasks.length === 0 && <span className="text-xs text-gray-300">No follow-ups</span>}
              {tasks.map(t => (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <button onClick={() => toggleTask(t)} className="cursor-pointer text-gray-400 hover:text-brand-500">
                    {t.status === 'done' ? <CheckSquare size={15} className="text-emerald-500" /> : <Square size={15} />}
                  </button>
                  <span className={`flex-1 ${t.status === 'done' ? 'line-through text-gray-300' : 'text-gray-700'}`}>{t.title}</span>
                  {t.due_date && <span className="text-[10px] text-gray-400">{fmtDate(t.due_date)}</span>}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Call back, send quote…"
                className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
              <input type="date" value={taskDue} onChange={e => setTaskDue(e.target.value)}
                className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
              <button onClick={addTask} className="px-3 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-semibold hover:bg-gray-900 cursor-pointer"><Plus size={13} /></button>
            </div>
          </div>
        </div>

        {/* Right column: log + timeline */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Log an interaction</h3>
            <div className="flex gap-2 mb-2">
              <select value={actType} onChange={e => setActType(e.target.value)}
                className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm cursor-pointer capitalize focus:outline-none focus:ring-1 focus:ring-brand-400">
                {ACTIVITY_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
              <input value={actBody} onChange={e => setActBody(e.target.value)} onKeyDown={e => e.key === 'Enter' && addActivity()}
                placeholder="What happened?" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
              <button onClick={addActivity} className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-semibold hover:bg-brand-600 cursor-pointer">Log</button>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">Activity timeline</h3>
            {timeline.length === 0 ? (
              <p className="text-xs text-gray-300 py-6 text-center">No activity yet</p>
            ) : (
              <div className="space-y-3">
                {timeline.map((it, i) => {
                  const Icon = ACT_ICON[it.kind] || (it.kind === 'enquiry' ? MessageSquare : it.kind === 'quote' ? FileText : it.kind === 'dispatch' ? Truck : MessageSquare)
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0"><Icon size={13} className="text-gray-500" /></div>
                      <div className="min-w-0 flex-1 pb-3 border-b border-gray-50 last:border-0">
                        <div className="text-sm text-gray-700">{it.label}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5 capitalize">{it.kind} · {fmtDate(it.at)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
