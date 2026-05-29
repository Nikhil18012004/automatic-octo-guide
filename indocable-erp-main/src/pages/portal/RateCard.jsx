import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { TrendingUp, Download, Package, ArrowRight, MessageCircle } from 'lucide-react'

export default function RateCard({ profile }) {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [prices,   setPrices]   = useState({})
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (profile?.role !== 'dealer') return
    Promise.all([
      supabase.from('cable_products').select('*, cable_categories(name, color)').eq('is_active', true).order('sort_order'),
      supabase.from('global_variables').select('key, value').in('key', ['lme_copper_usd_per_tonne', 'lme_al_usd_per_tonne', 'usd_to_inr', 'copper_freight_per_kg', 'copper_fabrication_per_kg']),
    ]).then(([prod, vars]) => {
      setProducts(prod.data || [])
      if (vars.data) {
        const v    = Object.fromEntries(vars.data.map(d => [d.key, parseFloat(d.value)]))
        const rate = v.usd_to_inr || 85.5
        setPrices({
          copper:       v.lme_copper_usd_per_tonne ? Math.round(v.lme_copper_usd_per_tonne * rate / 1000) : null,
          aluminum:     v.lme_al_usd_per_tonne     ? Math.round(v.lme_al_usd_per_tonne * rate / 1000)    : null,
          copperLanded: v.lme_copper_usd_per_tonne
            ? Math.round((v.lme_copper_usd_per_tonne * rate / 1000) + (v.copper_freight_per_kg || 0) + (v.copper_fabrication_per_kg || 0))
            : null,
        })
      }
      setLoading(false)
    })
  }, [profile])

  if (profile?.role !== 'dealer') return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <TrendingUp size={44} className="mx-auto text-gray-200 mb-4" />
      <h2 className="text-xl font-bold text-gray-600 mb-2">Dealer Access Only</h2>
      <p className="text-gray-400 text-sm mb-5">Rate cards are available for registered Indocable dealers. Contact us to become a dealer.</p>
      <div className="flex justify-center gap-3">
        <a href="https://wa.me/918073533289?text=Hi, I'm interested in becoming an Indocable dealer."
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm">
          <MessageCircle size={14} /> WhatsApp Us
        </a>
        <button onClick={() => navigate('/portal/enquiry')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white rounded-xl font-bold text-sm">
          Send Enquiry <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )

  function printRateCard() {
    const rows = products.map(p => {
      const variants = (p.variants || []).slice(0, 3).map(v =>
        `<tr>
          <td style="padding:5px 10px;border-bottom:1px solid #f1f5f9;font-size:12px">${p.name}</td>
          <td style="padding:5px 10px;border-bottom:1px solid #f1f5f9;font-size:12px">${v.cores||1} Core × ${v.size_sqmm} sq mm</td>
          <td style="padding:5px 10px;border-bottom:1px solid #f1f5f9;font-size:12px">${p.standard||'—'}</td>
          <td style="padding:5px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#6b7280">On Request</td>
        </tr>`
      ).join('')
      if (!variants) return `<tr><td style="padding:5px 10px;border-bottom:1px solid #f1f5f9;font-size:12px">${p.name}</td><td colspan="3" style="padding:5px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#94a3b8">Contact for specs</td></tr>`
      return variants
    }).join('')

    const html = `<!DOCTYPE html><html><head><title>Indocable Rate Card</title>
    <style>body{font-family:DM Sans,Arial,sans-serif;padding:32px;color:#1e293b;max-width:800px;margin:0 auto}
    h1{font-size:20px;font-weight:900;margin:0 0 2px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th{background:#f8fafc;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;border-bottom:2px solid #e2e8f0}
    .note{font-size:11px;color:#94a3b8;margin-top:16px}</style>
    </head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #e2e8f0">
      <div style="display:flex;align-items:center;gap:12px">
        <img src="/logo.jpg" style="width:44px;height:44px;border-radius:10px;object-fit:cover">
        <div><div style="font-size:18px;font-weight:900">Indocable Rate Card</div><div style="font-size:11px;color:#94a3b8;margin-top:2px">by Mica Group · cables@micagroup.net</div></div>
      </div>
      <div style="text-align:right">
        <div style="font-size:12px;color:#64748b">Dealer: <strong>${profile.full_name}${profile.company_name ? ` — ${profile.company_name}` : ''}</strong></div>
        <div style="font-size:11px;color:#94a3b8;margin-top:2px">Valid: ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</div>
        ${prices.copper ? `<div style="font-size:11px;color:#f97316;margin-top:2px">Cu LME: ₹${prices.copper.toLocaleString('en-IN')}/kg</div>` : ''}
      </div>
    </div>
    <table>
      <thead><tr><th>Cable Name</th><th>Specification</th><th>Standard</th><th>Price (₹/m)</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#94a3b8">Catalog being set up — contact us for pricing</td></tr>'}</tbody>
    </table>
    <p class="note">★ Prices on request — contact us for exact rates based on order quantity and delivery.<br>
    Prices subject to copper LME fluctuation. GST extra as applicable.<br>
    +91 80735 33289 · cables@micagroup.net · sales@indocables.com</p>
    </body></html>`

    const w = window.open('', '_blank', 'width=860,height=900')
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 300)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-7 py-10">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">My Rate Card</h1>
          <p className="text-gray-500 text-sm mt-1">
            Welcome, <strong>{profile.full_name}</strong>{profile.company_name ? ` · ${profile.company_name}` : ''}
            {profile.territory ? ` · Territory: ${profile.territory}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={printRateCard}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold text-sm transition-colors shadow-glow-orange"
          >
            <Download size={14} /> Download PDF
          </button>
        </div>
      </div>

      {/* Live prices bar */}
      {(prices.copper || prices.aluminum) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-4 mb-6 flex flex-wrap gap-6">
          {prices.copper && (
            <div>
              <div className="text-xs text-gray-400 font-semibold">LME Copper</div>
              <div className="text-lg font-black text-amber-600">₹{prices.copper.toLocaleString('en-IN')}/kg</div>
            </div>
          )}
          {prices.aluminum && (
            <div>
              <div className="text-xs text-gray-400 font-semibold">LME Aluminium</div>
              <div className="text-lg font-black text-blue-600">₹{prices.aluminum.toLocaleString('en-IN')}/kg</div>
            </div>
          )}
          {prices.copperLanded && (
            <div>
              <div className="text-xs text-gray-400 font-semibold">Copper Landed Cost</div>
              <div className="text-lg font-black text-brand-600">₹{prices.copperLanded.toLocaleString('en-IN')}/kg</div>
            </div>
          )}
          <div className="ml-auto text-right">
            <div className="text-xs text-gray-400">Prices updated</div>
            <div className="text-sm font-semibold text-gray-600">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
          </div>
        </div>
      )}

      {/* Products table */}
      {loading ? (
        <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-16 text-center">
          <Package size={44} className="mx-auto text-gray-200 mb-4" />
          <h3 className="text-gray-600 font-bold">Catalog being finalized</h3>
          <p className="text-gray-400 text-sm mt-1 mb-5">Rate card will be populated once the catalog is published.</p>
          <a href="https://wa.me/918073533289?text=Hi, please share the latest rate card."
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm">
            <MessageCircle size={14} /> Request via WhatsApp
          </a>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Cable</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Standard</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Variants</th>
                <th className="text-right px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Price</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-brand-50/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-semibold text-gray-900">{p.name}</div>
                    {p.conductor_material && <div className="text-xs text-gray-400">{p.conductor_material} · {p.insulation_material}</div>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-gray-500">{p.cable_categories?.name}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs font-mono text-gray-600">{p.standard || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {p.variants?.length > 0
                      ? <span className="text-xs text-gray-500">{p.variants.length} size{p.variants.length > 1 ? 's' : ''}</span>
                      : <span className="text-xs text-gray-300">—</span>
                    }
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-xs text-brand-600 font-bold bg-brand-50 px-2.5 py-1 rounded-lg">On Request</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-400">Contact us for exact pricing based on quantity and delivery schedule. Prices are subject to LME copper rates.</p>
          </div>
        </div>
      )}
    </div>
  )
}
