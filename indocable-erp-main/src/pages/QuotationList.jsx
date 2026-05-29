import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { confirmToast } from '../components/confirmToast'
import {
  Calculator, Plus, Eye, Trash2, Search, RefreshCw, X, Printer
} from 'lucide-react'

function fmt(n, d = 2) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toFixed(d)
}
function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—'
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}
function fmtDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STANDARD_LABELS = {
  IS_7098_P1:  'IS 7098 P1',
  IS_7098_P2:  'IS 7098 P2',
  IS_1554_P1:  'IS 1554 P1',
  IS_694:      'IS 694',
  IS_17505_P1: 'IS 17505 P1',
  BN_50288_P7: 'BN 50288 P7',
}

const STD_COLORS = {
  IS_7098_P1:  'bg-brand-50 text-brand-700 border-brand-100',
  IS_7098_P2:  'bg-orange-50 text-orange-700 border-orange-100',
  IS_1554_P1:  'bg-blue-50 text-blue-700 border-blue-100',
  IS_694:      'bg-emerald-50 text-emerald-700 border-emerald-100',
  IS_17505_P1: 'bg-violet-50 text-violet-700 border-violet-100',
  BN_50288_P7: 'bg-amber-50 text-amber-700 border-amber-100',
}

function generatePrintHtml(q) {
  const r  = q.result_snapshot || {}
  const f  = q.form_snapshot   || {}
  const ds = f.datasheet       || {}
  const fm = (n) => n != null && !isNaN(n) ? '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'
  const ft = (n, d = 2) => n != null && !isNaN(n) ? Number(n).toFixed(d) : '—'
  const date = new Date(q.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })

  const specRows = [
    ds.conductor_size_mm2  ? `<tr><td>Conductor Area</td><td><b>${ds.conductor_size_mm2} mm²</b></td><td>No. of Cores</td><td><b>${f.n_cores ?? '—'}</b></td></tr>` : '',
    ds.conductor_od_mm     ? `<tr><td>Conductor Diameter</td><td>${ft(ds.conductor_od_mm)} mm</td><td>No. of Strands</td><td>${f.n_strands ?? '—'}</td></tr>` : '',
    ds.insul_thickness_nom_mm ? `<tr><td>Insulation Thickness</td><td>${ds.insul_thickness_nom_mm} mm (nom) / ${ft(ds.insul_thickness_nom_mm * 0.8)} mm (min)</td><td>Insulation</td><td>${f.insul_material_name || '—'}</td></tr>` : '',
    ds.overall_dia_mm      ? `<tr><td>Overall Diameter</td><td>${ft(ds.overall_dia_mm)} mm</td><td>Approx. Weight</td><td>${ds.approx_weight_kg_km ? ft(ds.approx_weight_kg_km, 1) + ' kg/km' : '—'}</td></tr>` : '',
    ds.R_max_20C_ohm_km    ? `<tr><td>DC Resistance (20°C)</td><td>${ds.R_max_20C_ohm_km} Ω/km</td><td>Voltage Class</td><td>${ds.voltage_class || '—'}</td></tr>` : '',
    (f.armour_type && f.armour_type !== 'none') ? `<tr><td>Armour</td><td>${f.armour_type === 'wire' ? 'Round Wire' : 'Steel Strip'}</td><td>Outer Sheath</td><td>${f.outer_sheath_material_name || '—'}</td></tr>` : '',
    ds.inductance_mH_km    ? `<tr><td>Inductance</td><td>${ft(ds.inductance_mH_km, 4)} mH/km</td><td>Capacitance</td><td>${ft(ds.capacitance_uF_km, 4)} μF/km</td></tr>` : '',
  ].filter(Boolean).join('')

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Quotation ${q.quotation_no || 'DRAFT'} — ${q.cable_designation || ''}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:12px;color:#222;padding:32px;max-width:860px;margin:0 auto}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:3px solid #1e3a5f;margin-bottom:22px}
.co-name{font-size:22px;font-weight:900;color:#1e3a5f;letter-spacing:1px}
.co-sub{font-size:10px;color:#777;margin-top:3px}
.q-title{font-size:20px;font-weight:bold;color:#1e3a5f;letter-spacing:2px;text-align:right}
.q-meta{font-size:11px;color:#888;text-align:right;margin-top:3px}
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px}
.meta-box{background:#f7f9fc;border:1px solid #dde5f0;border-radius:6px;padding:11px}
.meta-lbl{font-size:9px;font-weight:bold;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px}
.meta-val{font-size:13px;font-weight:700;color:#1e3a5f}
.meta-sub{font-size:11px;color:#555;margin-top:2px}
.sec{font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#888;margin:18px 0 7px}
table{width:100%;border-collapse:collapse}
th{background:#1e3a5f;color:#fff;padding:7px 11px;font-size:11px;text-align:left;font-weight:600}
td{padding:6px 11px;border-bottom:1px solid #eee;font-size:11.5px}
tr:last-child td{border-bottom:none}
.pbox{background:#eef5ff;border:1px solid #c3daf8;border-radius:8px;padding:14px;display:flex;justify-content:space-around;margin:18px 0}
.pi-lbl{font-size:9px;color:#666;text-transform:uppercase;letter-spacing:.5px;text-align:center}
.pi-val{font-size:18px;font-weight:900;color:#1e3a5f;text-align:center;margin:3px 0 2px}
.pi-unit{font-size:9px;color:#999;text-align:center}
.terms{margin-top:24px;border-top:1px solid #ddd;padding-top:14px}
.terms-ttl{font-size:11px;font-weight:bold;color:#444;margin-bottom:7px}
.terms ul{padding-left:18px;color:#555;line-height:1.9}
.sigs{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:48px}
.sig-box{border-top:1px solid #aaa;padding-top:8px;font-size:11px;color:#666}
.note-box{background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:11px;margin-bottom:14px;font-size:11.5px}
.foot{color:#ccc;font-size:9px;text-align:center;margin-top:22px}
@media print{body{padding:12px}}
</style></head><body>
<div class="hdr">
  <div><div class="co-name">CHHAPERIA CABLE MATERIAL PVT. LTD.</div><div class="co-sub">23/18/1 Bisuvanahalli Village, Doddaballapur, Bengaluru Rural, KA 561203 &nbsp;|&nbsp; GSTIN: 29AAICC5462H1ZE &nbsp;|&nbsp; cables@micagroup.net &nbsp;|&nbsp; +91 8073533289</div></div>
  <div><div class="q-title">QUOTATION</div><div class="q-meta">No: ${q.quotation_no || 'DRAFT'}</div><div class="q-meta">Date: ${date}</div></div>
</div>
<div class="meta-grid">
  <div class="meta-box">
    <div class="meta-lbl">Customer</div>
    <div class="meta-val">${q.customer || 'To Whom It May Concern'}</div>
    ${f.project_name ? `<div class="meta-sub">Project: ${f.project_name}</div>` : ''}
  </div>
  <div class="meta-box">
    <div class="meta-lbl">Cable Designation</div>
    <div class="meta-val" style="font-family:monospace;font-size:15px">${q.cable_designation || '—'}</div>
    <div class="meta-sub">${STANDARD_LABELS[q.standard] || q.standard}&nbsp;|&nbsp;Order: ${f.order_km ?? '—'} km</div>
  </div>
</div>
<div class="sec">Cable Specification</div>
<table><thead><tr><th>Parameter</th><th>Value</th><th>Parameter</th><th>Value</th></tr></thead>
<tbody>${specRows || '<tr><td colspan="4" style="color:#aaa;text-align:center">No specification data saved</td></tr>'}</tbody></table>
<div class="pbox">
  <div><div class="pi-lbl">Rate per Meter</div><div class="pi-val">${fm(r.quote_per_m_with_packing)}</div><div class="pi-unit">incl. packing</div></div>
  <div><div class="pi-lbl">Rate per KM</div><div class="pi-val">${fm(r.quote_per_km)}</div><div class="pi-unit">ex-works</div></div>
  <div><div class="pi-lbl">Total for ${f.order_km ?? '—'} km</div><div class="pi-val">${fm(r.quote_total)}</div><div class="pi-unit">excl. GST</div></div>
</div>
${f.notes ? `<div class="note-box"><b>Notes:</b> ${f.notes}</div>` : ''}
<div class="terms">
  <div class="terms-ttl">Terms &amp; Conditions</div>
  <ul>
    <li>Prices are ex-works, Bisuvanahalli, Doddaballapur and exclusive of GST (applicable at 18%).</li>
    <li>Quotation validity: <b>15 days</b> from the date of issue.</li>
    <li>Payment: 50% advance, balance against dispatch documents.</li>
    <li>Delivery: 4–6 weeks from confirmed order and advance payment.</li>
    <li>Drums are chargeable and returnable within 60 days at customer's cost.</li>
    <li>Prices subject to revision based on LME copper rates at time of order confirmation.</li>
  </ul>
</div>
<div class="sigs">
  <div class="sig-box">Customer Acknowledgement<br><br><br>Name: ________________________________<br><br>Signature &amp; Stamp: ____________________</div>
  <div class="sig-box">For Chhaperia Cable Material Pvt. Ltd.<br><br><br>Authorised Signatory</div>
</div>
<div class="foot">Generated by Indocable ERP &nbsp;|&nbsp; ${new Date().toLocaleString('en-IN')}</div>
</body></html>`
}

function handlePrint(quotation) {
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) { toast.error('Allow pop-ups for this site to enable printing.'); return }
  w.document.write(generatePrintHtml(quotation))
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 400)
}

function QuotationDetailModal({ quotation, onClose }) {
  const r  = quotation.result_snapshot || {}
  const f  = quotation.form_snapshot   || {}
  const ds = f.datasheet               || {}

  function Row({ label, value, highlight }) {
    return (
      <div className={`flex justify-between py-2 border-b border-gray-50 last:border-0 ${highlight ? 'font-semibold' : ''}`}>
        <span className="text-sm text-gray-500">{label}</span>
        <span className={`text-sm font-mono ${highlight ? 'text-brand-600 font-bold' : 'text-gray-800'}`}>{value}</span>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <div className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-lg border mb-1 ${STD_COLORS[quotation.standard] || 'badge-gray'}`}>
              {STANDARD_LABELS[quotation.standard] || quotation.standard}
            </div>
            <div className="text-lg font-bold font-mono text-brand-700">{quotation.cable_designation}</div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePrint(quotation)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors"
              title="Print / Export quotation"
            >
              <Printer size={13} /> Print
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 cursor-pointer transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
              <div className="text-xs text-emerald-600 font-medium mb-0.5">Per Meter</div>
              <div className="font-bold text-emerald-700">{fmtMoney(r.quote_per_m_with_packing)}</div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
              <div className="text-xs text-blue-600 font-medium mb-0.5">Per KM</div>
              <div className="font-bold text-blue-700">{fmtMoney(r.quote_per_km)}</div>
            </div>
            <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 text-center">
              <div className="text-xs text-brand-600 font-medium mb-0.5">Total</div>
              <div className="font-bold text-brand-700">{fmtMoney(r.quote_total)}</div>
            </div>
          </div>

          {/* Meta */}
          <div className="bg-gray-50 rounded-xl p-4">
            {quotation.customer  && <Row label="Customer"  value={quotation.customer} />}
            {f.project_name      && <Row label="Project"   value={f.project_name} />}
            <Row label="Date"       value={fmtDate(quotation.created_at)} />
            <Row label="Quantity"   value={(f.order_km ?? '—') + ' km'} />
            <Row label="Margin"     value={(f.profit_margin_pct ?? '—') + '%'} />
          </div>

          {/* Weight */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Weight Breakdown (kg/km)</p>
            <div className="bg-white border border-gray-100 rounded-xl px-4 py-1">
              {r.wt_conductor_per_km    > 0 && <Row label="Conductor"    value={fmt(r.wt_conductor_per_km)} />}
              {r.wt_insul_per_km        > 0 && <Row label="Insulation"   value={fmt(r.wt_insul_per_km)} />}
              {r.wt_binding_per_km      > 0 && <Row label="Binding Tape" value={fmt(r.wt_binding_per_km)} />}
              {r.wt_inner_sheath_per_km > 0 && <Row label="Inner Sheath" value={fmt(r.wt_inner_sheath_per_km)} />}
              {r.wt_armour_per_km       > 0 && <Row label="Armour"       value={fmt(r.wt_armour_per_km)} />}
              {r.wt_outer_sheath_per_km > 0 && <Row label="Outer Sheath" value={fmt(r.wt_outer_sheath_per_km)} />}
              <Row label="Total" value={fmt(r.wt_total_per_km) + ' kg/km'} highlight />
            </div>
          </div>

          {/* Cost */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Cost Breakdown</p>
            <div className="bg-white border border-gray-100 rounded-xl px-4 py-1">
              {r.cost_conductor_material   > 0 && <Row label="Conductor"      value={fmtMoney(r.cost_conductor_material)} />}
              {r.cost_insul_material       > 0 && <Row label="Insulation"     value={fmtMoney(r.cost_insul_material)} />}
              {r.cost_binding              > 0 && <Row label="Binding Tape"   value={fmtMoney(r.cost_binding)} />}
              {r.cost_inner_sheath         > 0 && <Row label="Inner Sheath"   value={fmtMoney(r.cost_inner_sheath)} />}
              {r.cost_armour               > 0 && <Row label="Armour"         value={fmtMoney(r.cost_armour)} />}
              {r.cost_outer_sheath_material > 0 && <Row label="Outer Sheath"  value={fmtMoney(r.cost_outer_sheath_material)} />}
              <Row label="Total Material"     value={fmtMoney(r.total_material_cost)} />
              <Row label="Operating Cost"     value={fmtMoney(r.total_op_cost)} />
              <Row label="Manufacturing Cost" value={fmtMoney(r.total_mfg_cost)} />
              <Row label="Profit"             value={fmtMoney(r.profit_amount)} />
              <Row label="Quote Price"        value={fmtMoney(r.quote_per_km) + ' /km'} highlight />
            </div>
          </div>

          {/* Datasheet */}
          {ds && Object.keys(ds).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Approximate Datasheet</p>
              <div className="bg-white border border-gray-100 rounded-xl px-4 py-1">
                {ds.voltage_class          && <Row label="Voltage Rating"      value={ds.voltage_class} />}
                {ds.conductor_size_mm2     && <Row label="Conductor Area"       value={ds.conductor_size_mm2 + ' mm²'} />}
                {ds.conductor_od_mm        && <Row label="Conductor Diameter"   value={fmt(ds.conductor_od_mm) + ' mm'} />}
                {ds.R_max_20C_ohm_km       && <Row label="DC Resistance (20°C)" value={ds.R_max_20C_ohm_km + ' Ω/km'} />}
                {ds.insul_thickness_nom_mm && <Row label="Insulation Thickness" value={fmt(ds.insul_thickness_nom_mm) + ' mm'} />}
                {ds.overall_dia_mm         && <Row label="Overall Diameter"     value={fmt(ds.overall_dia_mm) + ' mm'} />}
                {ds.approx_weight_kg_km    && <Row label="Approx. Weight"       value={fmt(ds.approx_weight_kg_km) + ' kg/km'} />}
              </div>
            </div>
          )}

          {f.notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <div className="text-xs font-semibold text-amber-700 mb-1">Notes</div>
              <div className="text-sm text-amber-800">{f.notes}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function QuotationList({ profile }) {
  const navigate = useNavigate()
  const [quotations, setQuotations] = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState(null)
  const [deleting, setDeleting]     = useState(null)

  useEffect(() => { fetchQuotations() }, [])

  async function fetchQuotations() {
    setLoading(true)
    const { data, error } = await supabase.from('quotations').select('*').order('created_at', { ascending: false })
    if (error) toast.error('Error loading quotations')
    else setQuotations(data || [])
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!await confirmToast('Delete this quotation? This cannot be undone.')) return
    setDeleting(id)
    const { error } = await supabase.from('quotations').delete().eq('id', id)
    if (error) toast.error('Delete failed: ' + error.message)
    else { toast.success('Deleted'); setQuotations(prev => prev.filter(q => q.id !== id)) }
    setDeleting(null)
  }

  const filtered = quotations.filter(q => {
    const s = search.toLowerCase()
    const f = q.form_snapshot || {}
    return (
      q.cable_designation?.toLowerCase().includes(s) ||
      q.customer?.toLowerCase().includes(s) ||
      f.project_name?.toLowerCase().includes(s) ||
      STANDARD_LABELS[q.standard]?.toLowerCase().includes(s)
    )
  })

  const canDelete = ['owner', 'admin'].includes(profile.role)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center">
            <Calculator size={20} className="text-brand-600" />
          </div>
          <div>
            <h1 className="page-header">Quotations</h1>
            <p className="page-sub">{quotations.length} saved quotation{quotations.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchQuotations} className="btn-ghost">
            <RefreshCw size={15} />
          </button>
          <button onClick={() => navigate('/quotations/new')} className="btn-primary">
            <Plus size={16} /> New Quotation
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by designation, customer, project, or standard…"
          className="input pl-10"
        />
      </div>

      {/* Table / Loading / Empty */}
      {loading ? (
        <div className="card p-6 space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-12 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <Calculator size={48} className="mx-auto text-gray-200 mb-4" />
          <p className="font-semibold text-gray-500 mb-1">{search ? 'No quotations match your search' : 'No quotations yet'}</p>
          {!search && (
            <button onClick={() => navigate('/quotations/new')} className="btn-primary mt-4">
              <Plus size={16} /> Create First Quotation
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100" style={{ background: '#fafafa' }}>
                <tr>
                  <th className="th">Designation</th>
                  <th className="th">Standard</th>
                  <th className="th hidden md:table-cell">Customer</th>
                  <th className="th-r hidden sm:table-cell">Qty (km)</th>
                  <th className="th-r">₹/km</th>
                  <th className="th-r hidden lg:table-cell">Total</th>
                  <th className="th hidden md:table-cell">Date</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(q => {
                  const f = q.form_snapshot || {}
                  const r = q.result_snapshot || {}
                  return (
                    <tr key={q.id} className="hover:bg-brand-50/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-brand-700">{q.cable_designation || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-lg border ${STD_COLORS[q.standard] || 'badge-gray'}`}>
                          {STANDARD_LABELS[q.standard] || q.standard}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                        <div className="font-medium">{q.customer || <span className="text-gray-300">—</span>}</div>
                        {f.project_name && <div className="text-xs text-gray-400">{f.project_name}</div>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 hidden sm:table-cell">{f.order_km ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">{fmtMoney(r.quote_per_km)}</td>
                      <td className="px-4 py-3 text-right text-gray-600 hidden lg:table-cell">{fmtMoney(r.quote_total)}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">{fmtDate(q.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setSelected(q)} className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-500 transition-colors cursor-pointer" title="View details">
                            <Eye size={15} />
                          </button>
                          <button onClick={() => handlePrint(q)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors cursor-pointer" title="Print quotation">
                            <Printer size={15} />
                          </button>
                          {canDelete && (
                            <button onClick={() => handleDelete(q.id)} disabled={deleting === q.id}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors disabled:opacity-40 cursor-pointer">
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && <QuotationDetailModal quotation={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
