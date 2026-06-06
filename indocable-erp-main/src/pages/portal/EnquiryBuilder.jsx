import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import {
  MessageSquare, Plus, Trash2, CheckCircle2,
  MessageCircle, X, ArrowLeft,
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function EnquiryBuilder({ profile }) {
  const navigate = useNavigate()
  const [contact, setContact] = useState({
    name:     profile?.full_name    || '',
    company:  profile?.company_name || '',
    phone:    profile?.phone        || '',
    email:    '',
    city:     profile?.city         || '',
  })
  const [project, setProject] = useState({
    project_name:      '',
    delivery_location: '',
    message:           '',
  })
  const [items, setItems] = useState([
    { description: '', quantity: '', unit: 'meters', notes: '' }
  ])
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [enquiryNo,  setEnquiryNo]  = useState('')

  function addItem()       { setItems(prev => [...prev, { description: '', quantity: '', unit: 'meters', notes: '' }]) }
  function removeItem(i)   { setItems(prev => prev.filter((_, idx) => idx !== i)) }
  function updateItem(i, k, v) {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [k]: v } : item))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!contact.name.trim())             { toast.error('Name is required'); return }
    if (contact.phone.trim().length < 10) { toast.error('Enter a valid phone number'); return }
    const filledItems = items.filter(it => it.description.trim())
    if (filledItems.length === 0)         { toast.error('Add at least one cable item'); return }

    setSubmitting(true)
    const no      = `ENQ-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Date.now()).slice(-4)}`
    const subject = project.project_name
      ? `RFQ: ${project.project_name} (${filledItems.length} items)`
      : `Multi-item RFQ — ${filledItems.length} cable type${filledItems.length > 1 ? 's' : ''}`

    const { data: enquiry, error } = await supabase.from('enquiries').insert({
      enquiry_no:        no,
      contact_name:      contact.name.trim(),
      company_name:      contact.company.trim() || null,
      phone:             contact.phone.trim(),
      email:             contact.email.trim()   || null,
      city:              contact.city.trim()    || null,
      subject,
      message:           project.message.trim() || null,
      project_name:      project.project_name.trim()      || null,
      delivery_location: project.delivery_location.trim() || null,
      user_id:           profile?.id || null,
    }).select().single()

    if (error) {
      toast.error('Failed to submit. Please WhatsApp us directly.')
      setSubmitting(false)
      return
    }

    // Insert items
    const itemRows = filledItems.map(it => ({
      enquiry_id:  enquiry.id,
      description: it.description.trim(),
      quantity:    it.quantity ? parseFloat(it.quantity) : null,
      unit:        it.unit,
      notes:       it.notes.trim() || null,
    }))
    const { error: itemsErr } = await supabase.from('enquiry_items').insert(itemRows)
    if (itemsErr) toast.error('Enquiry saved, but item details failed to attach — please WhatsApp us the list.')

    setEnquiryNo(no)
    setSubmitting(false)
    setSubmitted(true)
    toast.success('Enquiry submitted! We\'ll contact you soon.')
  }

  const waText = encodeURIComponent(
    `Hi, I submitted a multi-item cable enquiry (${enquiryNo}). Please review and share pricing.\nProject: ${project.project_name || 'N/A'}\nItems: ${items.filter(i=>i.description).map(i=>`${i.description} ${i.quantity||''}${i.unit}`).join(', ')}`
  )

  if (submitted) return (
    <div className="max-w-2xl mx-auto px-4 md:px-7 py-20 text-center">
      <CheckCircle2 size={56} className="text-emerald-500 mx-auto mb-4" />
      <h1 className="text-2xl font-black text-gray-900 mb-2">Enquiry Submitted!</h1>
      <p className="text-gray-500 mb-2">Reference: <span className="font-mono font-bold text-gray-700">{enquiryNo}</span></p>
      <p className="text-gray-400 text-sm mb-8">Our team will contact you within 2 hours during business hours.</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <a
          href={`https://wa.me/918073533289?text=${waText}`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm transition-colors"
        >
          <MessageCircle size={16} /> Also send on WhatsApp
        </a>
        {profile && (
          <button
            onClick={() => navigate('/portal/my-enquiries')}
            className="flex items-center justify-center gap-2 px-5 py-3 border border-gray-200 text-gray-700 rounded-2xl font-bold text-sm hover:bg-gray-50 transition-colors"
          >
            View My Enquiries
          </button>
        )}
        <button
          onClick={() => navigate('/portal/catalog')}
          className="flex items-center justify-center gap-2 px-5 py-3 border border-gray-200 text-gray-700 rounded-2xl font-bold text-sm hover:bg-gray-50 transition-colors"
        >
          Back to Catalog
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-7 py-10">

      {/* Header */}
      <div className="mb-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-4 cursor-pointer transition-colors">
          <ArrowLeft size={14} /> Back
        </button>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Request for Quotation</h1>
        <p className="text-gray-500 mt-1">Add multiple cable items and get a project-level quote from us</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Contact Details */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-brand-500 text-white text-xs font-black flex items-center justify-center">1</div>
            Your Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full Name *</label>
              <input required value={contact.name} onChange={e => setContact(c => ({ ...c, name: e.target.value }))}
                placeholder="Your name"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone (WhatsApp) *</label>
              <input required type="tel" value={contact.phone}
                onChange={e => setContact(c => ({ ...c, phone: e.target.value.replace(/\D/g,'').slice(0,10) }))}
                placeholder="10-digit mobile"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Company / Organisation</label>
              <input value={contact.company} onChange={e => setContact(c => ({ ...c, company: e.target.value }))}
                placeholder="Company or firm name"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
              <input type="email" value={contact.email} onChange={e => setContact(c => ({ ...c, email: e.target.value }))}
                placeholder="your@email.com"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">City / Location</label>
              <input value={contact.city} onChange={e => setContact(c => ({ ...c, city: e.target.value }))}
                placeholder="Delivery city or location"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
            </div>
          </div>
        </div>

        {/* Project Details */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-brand-500 text-white text-xs font-black flex items-center justify-center">2</div>
            Project Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Project Name</label>
              <input value={project.project_name}
                onChange={e => setProject(p => ({ ...p, project_name: e.target.value }))}
                placeholder="e.g. Residential Complex Wiring"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Delivery Location</label>
              <input value={project.delivery_location}
                onChange={e => setProject(p => ({ ...p, delivery_location: e.target.value }))}
                placeholder="Delivery address or city"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Additional Notes</label>
              <textarea rows={2} value={project.message}
                onChange={e => setProject(p => ({ ...p, message: e.target.value }))}
                placeholder="Delivery timeline, budget range, special requirements…"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none" />
            </div>
          </div>
        </div>

        {/* Cable Items */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-brand-500 text-white text-xs font-black flex items-center justify-center">3</div>
              Cable Items
            </h2>
            <span className="text-xs text-gray-400">{items.length} item{items.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3 relative group">
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-sm"
                  >
                    <X size={11} />
                  </button>
                )}
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-lg bg-gray-100 text-gray-500 text-[10px] font-black flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <input
                    value={item.description}
                    onChange={e => updateItem(i, 'description', e.target.value)}
                    placeholder="Cable description — e.g. 4 Core × 2.5 sq mm FRLS, IS 694, Copper"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex">
                    <input
                      type="number" min="0" step="0.1"
                      value={item.quantity}
                      onChange={e => updateItem(i, 'quantity', e.target.value)}
                      placeholder="Qty"
                      className="flex-1 px-3 py-2 border border-r-0 border-gray-200 rounded-l-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                    />
                    <select value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)}
                      className="px-2 py-2 border border-gray-200 rounded-r-xl text-xs bg-gray-50 focus:ring-2 focus:ring-brand-500/30">
                      <option value="meters">m</option>
                      <option value="km">km</option>
                      <option value="rolls">rolls</option>
                      <option value="drums">drums</option>
                    </select>
                  </div>
                  <input
                    value={item.notes}
                    onChange={e => updateItem(i, 'notes', e.target.value)}
                    placeholder="Notes (optional)"
                    className="col-span-2 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="mt-3 flex items-center gap-2 text-sm text-brand-600 font-bold hover:text-brand-700 cursor-pointer transition-colors"
          >
            <Plus size={15} /> Add Another Cable
          </button>
        </div>

        {/* Submit */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-4 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-black text-base transition-colors disabled:opacity-50 shadow-glow-orange flex items-center justify-center gap-2"
          >
            <MessageSquare size={18} />
            {submitting ? 'Submitting…' : 'Submit RFQ'}
          </button>
          <a
            href={`https://wa.me/918073533289?text=${encodeURIComponent(`Hi, I'd like to enquire about multiple cables.\nProject: ${project.project_name || 'N/A'}\nItems: ${items.filter(i=>i.description).map(i=>`${i.description} ${i.quantity||''}${i.unit}`).join(', ')}`)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-colors"
          >
            <MessageCircle size={18} /> WhatsApp Instead
          </a>
        </div>
      </form>
    </div>
  )
}
