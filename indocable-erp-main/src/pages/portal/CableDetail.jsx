import { useState, useEffect } from 'react'
import { useParams, useNavigate, NavLink } from 'react-router-dom'
import { supabase } from '../../supabase'
import {
  ChevronRight, Download, MessageSquare, MessageCircle,
  Shield, CheckCircle2, Package, ArrowLeft, X,
  Home, Zap, Activity, Droplets, Layers,
} from 'lucide-react'
import toast from 'react-hot-toast'

const CATEGORY_GRADIENTS = {
  orange:  'from-orange-500 to-amber-600',
  blue:    'from-blue-500 to-indigo-600',
  emerald: 'from-emerald-500 to-teal-600',
  purple:  'from-purple-500 to-violet-600',
  cyan:    'from-cyan-500 to-blue-600',
  amber:   'from-amber-500 to-orange-600',
}

const SPEC_LABELS = {
  standard:            'Standard',
  voltage_rating:      'Voltage Rating',
  conductor_material:  'Conductor',
  conductor_class:     'Conductor Class',
  insulation_material: 'Insulation',
  sheath_material:     'Outer Sheath',
  armour_type:         'Armour',
  flame_rating:        'Flame Rating',
  temperature_rating:  'Temperature Rating',
}

// ── Enquiry Modal ──────────────────────────────────────────────────────────────
function EnquiryModal({ product, selectedVariant, onClose, profile }) {
  const [form, setForm] = useState({
    name:     profile?.full_name || '',
    company:  profile?.company_name || '',
    phone:    profile?.phone || '',
    email:    '',
    city:     profile?.city || '',
    quantity: '',
    unit:     'meters',
    notes:    '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [done,       setDone]       = useState(false)
  const [doneWaText, setDoneWaText] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim())             { toast.error('Name is required'); return }
    if (form.phone.trim().length < 10) { toast.error('Enter a valid phone number'); return }
    setSubmitting(true)

    const enquiryNo  = `ENQ-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Date.now()).slice(-4)}`
    const variantStr = selectedVariant
      ? `${selectedVariant.cores || 1} Core × ${selectedVariant.size_sqmm} sq mm`
      : 'Specification to discuss'
    const subject = `Enquiry: ${product.name} — ${variantStr}`
    const waText  = encodeURIComponent(`Hi, I'm interested in:\n*${product.name}*\nSpec: ${variantStr}\nQty: ${form.quantity || 'TBD'} ${form.unit}\nFrom: ${form.name}, ${form.city || ''}`)

    const { data: enquiry, error } = await supabase.from('enquiries').insert({
      enquiry_no:        enquiryNo,
      contact_name:      form.name.trim(),
      company_name:      form.company.trim() || null,
      phone:             form.phone.trim(),
      email:             form.email.trim() || null,
      city:              form.city.trim() || null,
      subject,
      user_id:           profile?.id || null,
      delivery_location: form.city.trim() || null,
    }).select().single()

    if (error) { toast.error('Failed to submit. Please WhatsApp us.'); setSubmitting(false); return }

    // Insert line item
    const { error: itemErr } = await supabase.from('enquiry_items').insert({
      enquiry_id:       enquiry.id,
      cable_product_id: product.id,
      description:      `${product.name} — ${variantStr}`,
      quantity:         form.quantity ? parseFloat(form.quantity) : null,
      unit:             form.unit,
      notes:            form.notes.trim() || null,
    })
    if (itemErr) toast.error('Enquiry saved, but item details failed to attach — please WhatsApp us.')

    setSubmitting(false)
    setDoneWaText(waText)
    setDone(true)
    toast.success('Enquiry submitted! We\'ll contact you shortly.')
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-black text-gray-900 text-base">Send Enquiry</h2>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{product.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded-lg hover:bg-gray-100 flex-shrink-0 mt-0.5">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="px-6 py-10 text-center">
            <CheckCircle2 size={44} className="text-emerald-500 mx-auto mb-3" />
            <h3 className="font-black text-gray-900 text-lg mb-1">Enquiry Sent!</h3>
            <p className="text-gray-500 text-sm mb-6">Our team will call you within 2 hours.</p>
            <div className="flex flex-col gap-2">
              <a
                href={`https://wa.me/918073533289?text=${doneWaText}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm transition-colors"
              >
                <MessageCircle size={16} /> Chat on WhatsApp
              </a>
              <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 py-2">Close</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Your name"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Phone *</label>
                <input required type="tel" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g,'').slice(0,10) }))}
                  placeholder="Mobile number"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Company / Project</label>
                <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  placeholder="Company or project name (optional)"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">City</label>
                <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="Your city"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity</label>
                <div className="flex">
                  <input type="number" min="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                    placeholder="e.g. 500"
                    className="flex-1 px-3 py-2.5 border border-r-0 border-gray-200 rounded-l-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:z-10 relative" />
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="px-2 py-2.5 border border-gray-200 rounded-r-xl text-xs bg-gray-50 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500">
                    <option value="meters">m</option>
                    <option value="km">km</option>
                    <option value="rolls">rolls</option>
                    <option value="drums">drums</option>
                  </select>
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Additional Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Installation type, delivery timeline, budget range…"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={submitting}
                className="flex-1 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-bold text-sm transition-colors disabled:opacity-50 shadow-glow-orange">
                {submitting ? 'Sending…' : 'Submit Enquiry'}
              </button>
              <a href={`https://wa.me/918073533289?text=${encodeURIComponent(`Hi, I'm interested in ${product.name}`)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm transition-colors">
                <MessageCircle size={15} />
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function CableDetail({ profile }) {
  const { slug }   = useParams()
  const navigate   = useNavigate()
  const [product,         setProduct]         = useState(null)
  const [loading,         setLoading]         = useState(true)
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [enquiryOpen,     setEnquiryOpen]     = useState(false)

  useEffect(() => {
    supabase
      .from('cable_products')
      .select('*, cable_categories(name, slug, color)')
      .eq('slug', slug)
      .single()
      .then(({ data }) => {
        setProduct(data)
        const variants = data?.variants || []
        if (variants.length > 0) setSelectedVariant(variants[0])
        setLoading(false)
      })
  }, [slug])

  function downloadDatasheet() {
    if (!product) return
    const specs = Object.entries(SPEC_LABELS)
      .filter(([k]) => product[k])
      .map(([k, label]) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px">${label}</td><td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;font-weight:600;font-size:13px">${product[k]}</td></tr>`)
      .join('')

    const html = `<!DOCTYPE html><html><head><title>${product.name} — Datasheet</title>
    <style>body{font-family:DM Sans,sans-serif;padding:40px;color:#1e293b;max-width:700px;margin:0 auto}
    h1{font-size:22px;font-weight:900;margin:0 0 4px}
    .sub{color:#64748b;font-size:13px;margin-bottom:24px}
    table{width:100%;border-collapse:collapse}
    .cert{display:inline-block;padding:4px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:11px;font-weight:700;margin:0 4px 4px 0;background:#f8fafc}</style>
    </head><body>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
      <img src="/logo.jpg" style="width:44px;height:44px;border-radius:10px;object-fit:cover">
      <div><div style="font-size:20px;font-weight:900">Indocable</div><div style="font-size:11px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase">Technical Datasheet</div></div>
    </div>
    <h1>${product.name}</h1>
    <div class="sub">${product.short_description || ''}</div>
    <table>${specs}</table>
    ${product.certifications?.length ? `<div style="margin-top:20px"><strong style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8">Certifications</strong><div style="margin-top:8px">${product.certifications.map(c => `<span class="cert">${c}</span>`).join('')}</div></div>` : ''}
    ${product.applications?.length ? `<div style="margin-top:20px"><strong style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8">Applications</strong><ul style="margin-top:8px;padding-left:20px;color:#475569;font-size:13px">${product.applications.map(a => `<li style="margin-bottom:4px">${a}</li>`).join('')}</ul></div>` : ''}
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">
      Generated ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})} · Indocable by Mica Group · +91 80735 33289 · cables@micagroup.net
    </div></body></html>`

    const w = window.open('', '_blank', 'width=750,height=900')
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 300)
  }

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 md:px-7 py-10">
      <div className="skeleton h-8 w-64 rounded-xl mb-8" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="skeleton h-96 rounded-2xl" />
        <div className="space-y-4"><div className="skeleton h-10 rounded-xl" /><div className="skeleton h-48 rounded-2xl" /></div>
      </div>
    </div>
  )

  if (!product) return (
    <div className="max-w-7xl mx-auto px-4 md:px-7 py-20 text-center">
      <Package size={48} className="mx-auto text-gray-200 mb-4" />
      <h2 className="text-xl font-bold text-gray-600 mb-2">Cable not found</h2>
      <p className="text-gray-400 text-sm mb-5">This product may have been removed or the link is incorrect.</p>
      <button onClick={() => navigate('/portal/catalog')}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white rounded-xl font-bold text-sm">
        <ArrowLeft size={14} /> Back to Catalog
      </button>
    </div>
  )

  const gradient = CATEGORY_GRADIENTS[product.cable_categories?.color] || 'from-gray-400 to-gray-600'
  const variants = product.variants || []

  return (
    <>
      {enquiryOpen && (
        <EnquiryModal
          product={product}
          selectedVariant={selectedVariant}
          onClose={() => setEnquiryOpen(false)}
          profile={profile}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-7 py-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-7">
          <NavLink to="/portal/catalog" className="hover:text-brand-600 transition-colors">Catalog</NavLink>
          <ChevronRight size={13} />
          {product.cable_categories && (
            <>
              <NavLink to={`/portal/catalog?category=${product.cable_categories.slug}`} className="hover:text-brand-600 transition-colors capitalize">
                {product.cable_categories.name}
              </NavLink>
              <ChevronRight size={13} />
            </>
          )}
          <span className="text-gray-700 font-medium truncate max-w-[200px]">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* ── Left: Specs ── */}
          <div className="lg:col-span-3 space-y-5">
            {/* Product header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
              <div className={`h-2 bg-gradient-to-r ${gradient}`} />
              <div className="p-6">
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white bg-gradient-to-r ${gradient} mb-3`}>
                  {product.cable_categories?.name}
                </div>
                <h1 className="text-2xl font-black text-gray-900 leading-tight mb-2">{product.name}</h1>
                {product.short_description && <p className="text-gray-500 text-sm leading-relaxed">{product.short_description}</p>}

                {/* Certifications */}
                {product.certifications?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {product.certifications.map(c => (
                      <span key={c} className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 size={10} /> {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Technical Specs */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
              <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Shield size={16} className="text-brand-500" /> Technical Specifications
              </h2>
              <table className="w-full">
                <tbody>
                  {Object.entries(SPEC_LABELS).map(([key, label]) => {
                    if (!product[key]) return null
                    return (
                      <tr key={key} className="border-b border-gray-50 last:border-0">
                        <td className="py-2.5 pr-4 text-sm text-gray-500 w-44">{label}</td>
                        <td className="py-2.5 text-sm font-semibold text-gray-900">{product[key]}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Applications */}
            {product.applications?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
                <h2 className="font-bold text-gray-900 mb-3">Applications</h2>
                <ul className="space-y-2">
                  {product.applications.map(a => (
                    <li key={a} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Features */}
            {product.features?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
                <h2 className="font-bold text-gray-900 mb-3">Key Features</h2>
                <div className="flex flex-wrap gap-2">
                  {product.features.map(f => (
                    <span key={f} className="text-xs font-semibold text-brand-600 bg-brand-50 border border-brand-100 px-2.5 py-1.5 rounded-xl">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Variants + Actions ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Variant Selector */}
            {variants.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
                <h2 className="font-bold text-gray-900 mb-4 text-sm uppercase tracking-wide">Select Specification</h2>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {variants.map((v, i) => {
                    const isSelected = selectedVariant === v || (JSON.stringify(selectedVariant) === JSON.stringify(v))
                    const label = `${v.cores > 1 ? `${v.cores} Core × ` : ''}${v.size_sqmm} sq mm${v.od_mm ? ` · ⌀${v.od_mm}mm` : ''}`
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedVariant(v)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                            : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span>{label}</span>
                        {v.weight_kg_km && <span className="text-xs text-gray-400 font-normal">{v.weight_kg_km} kg/km</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Price / Enquiry */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Price</div>
              <div className="text-2xl font-black text-gray-900 mb-1">Request Quote</div>
              <p className="text-xs text-gray-400 mb-5">Price depends on current copper market rate and order quantity. Contact us for best rates.</p>

              <div className="space-y-2.5">
                <button
                  onClick={() => setEnquiryOpen(true)}
                  className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-bold text-sm transition-colors shadow-glow-orange flex items-center justify-center gap-2"
                >
                  <MessageSquare size={16} /> Send Enquiry
                </button>
                <a
                  href={`https://wa.me/918073533289?text=${encodeURIComponent(`Hi, I need a quote for ${product.name}${selectedVariant ? ` (${selectedVariant.size_sqmm} sq mm)` : ''}`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <MessageCircle size={16} /> WhatsApp
                </a>
                <button
                  onClick={downloadDatasheet}
                  className="w-full py-3 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-2xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Download size={15} /> Download Datasheet
                </button>
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-400">Or call us:</p>
                <a href="tel:+918073533289" className="text-sm font-bold text-gray-700 hover:text-brand-600 transition-colors">+91 80735 33289</a>
              </div>
            </div>

            {/* Trust badges */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <div className="space-y-2">
                {['ISI Certified — Bureau of Indian Standards', 'CPRI Tested — Type tested samples', 'Made in India — Manufactured in Bangalore'].map(t => (
                  <div key={t} className="flex items-center gap-2 text-xs text-gray-600">
                    <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
