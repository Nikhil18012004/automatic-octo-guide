import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import {
  ShoppingCart, Plus, RefreshCw, X, Save, Printer,
  Trash2, CheckCircle2, Package, Building2,
  Phone, Mail, MapPin, FileText, Eye,
  Send, AlertTriangle, Clock, TrendingUp,
  Star, ChevronDown, MessageCircle, ExternalLink,
  Award, AlertCircle, ThumbsUp, ThumbsDown
} from 'lucide-react'
import { fmtDate } from '../lib/format'

function fmtDateTime(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' }
function fmtNum(n) { return Number(n || 0).toLocaleString('en-IN') }
function daysBetween(a, b) {
  if (!a || !b) return null
  return Math.round((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24))
}
function genPONumber(count) {
  const d = new Date()
  return `PO-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(count + 1).padStart(3, '0')}`
}

const STATUS_STYLE = {
  draft:     'bg-slate-100 text-slate-600 border-slate-200',
  sent:      'bg-blue-100 text-blue-700 border-blue-200',
  partial:   'bg-amber-100 text-amber-700 border-amber-200',
  received:  'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-100 text-red-600 border-red-200',
}

const SEVERITY_STYLE = {
  low:      'bg-slate-100 text-slate-600',
  medium:   'bg-amber-100 text-amber-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-600',
}

const ISSUE_TYPE_LABEL = {
  quality:       'Quality Problem',
  quantity:      'Wrong Quantity',
  late_delivery: 'Late Delivery',
  wrong_item:    'Wrong Item',
  packaging:     'Packaging Issue',
  pricing:       'Pricing Dispute',
  other:         'Other',
}

const UNITS = ['kg', 'mtr', 'pcs', 'coil', 'drum', 'roll', 'box', 'set', 'litre', 'ton']

// ── Build printable PO HTML ───────────────────────────────────────────────────
function buildPOHtml(po, supplier, items) {
  const total = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0)
  return `<html><head><title>Purchase Order ${po.po_number}</title>
  <style>
    body{font-family:Arial,sans-serif;color:#1a1a1a;padding:32px;font-size:13px;}
    h1{font-size:22px;margin:0;font-weight:800;} .sub{color:#666;font-size:12px;margin-top:2px;}
    .header{display:flex;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #333;}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;}
    .section{border:1px solid #ddd;border-radius:8px;padding:12px;}
    .section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#888;margin-bottom:8px;}
    table{width:100%;border-collapse:collapse;}
    th{background:#f8f8f8;text-align:left;padding:8px 10px;font-size:11px;font-weight:700;text-transform:uppercase;color:#666;border-bottom:2px solid #e5e7eb;}
    td{padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;}
    .total-row td{font-weight:700;font-size:14px;border-top:2px solid #333;border-bottom:none;}
    .sign{display:flex;justify-content:space-between;margin-top:48px;}
    .sign div{text-align:center;} .sign span{display:block;margin-top:36px;border-top:1px solid #333;padding-top:4px;font-size:11px;color:#888;}
  </style></head><body>
  <div class="header">
    <div><h1>Indocable Industries</h1><div class="sub">Purchase Order</div></div>
    <div style="text-align:right">
      <div style="font-size:18px;font-weight:800;color:#f97316">${po.po_number}</div>
      <div style="font-size:12px;color:#666;margin-top:4px">Date: ${fmtDate(po.order_date)}</div>
      ${po.expected_date ? `<div style="font-size:12px;color:#666">Expected by: ${fmtDate(po.expected_date)}</div>` : ''}
    </div>
  </div>
  <div class="grid2">
    <div class="section">
      <div class="section-title">Supplier</div>
      <div style="font-weight:700;font-size:14px">${supplier?.name || '—'}</div>
      ${supplier?.contact_person ? `<div style="color:#666;margin-top:4px;font-size:12px">${supplier.contact_person}</div>` : ''}
      ${supplier?.address ? `<div style="color:#666;margin-top:4px;font-size:12px">${supplier.address}</div>` : ''}
      ${supplier?.gst_number ? `<div style="margin-top:4px;font-size:11px;color:#888">GST: ${supplier.gst_number}</div>` : ''}
      ${supplier?.phone ? `<div style="margin-top:4px;font-size:11px;color:#888">Ph: ${supplier.phone}</div>` : ''}
    </div>
    <div class="section">
      <div class="section-title">Ship To</div>
      <div style="font-weight:700">Indocable Industries</div>
      ${po.notes ? `<div style="margin-top:8px;color:#666;font-size:12px">${po.notes}</div>` : ''}
      ${po.promised_lead_days ? `<div style="margin-top:4px;font-size:11px;color:#888">Promised lead time: ${po.promised_lead_days} days</div>` : ''}
    </div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Material / Description</th><th>Qty</th><th>Unit</th><th style="text-align:right">Unit Price (₹)</th><th style="text-align:right">Amount (₹)</th></tr></thead>
    <tbody>
      ${items.map((item, i) => `<tr>
        <td>${i + 1}</td>
        <td>${item.description || item.materials?.name || '—'}</td>
        <td>${item.quantity}</td><td>${item.unit}</td>
        <td style="text-align:right">${item.unit_price ? fmtNum(item.unit_price) : '—'}</td>
        <td style="text-align:right">${item.unit_price ? fmtNum((parseFloat(item.quantity)||0)*(parseFloat(item.unit_price)||0)) : '—'}</td>
      </tr>`).join('')}
      ${total > 0 ? `<tr class="total-row"><td colspan="5">Total</td><td style="text-align:right">₹${fmtNum(total)}</td></tr>` : ''}
    </tbody>
  </table>
  <div class="sign">
    <div><span>Supplier Acknowledgement</span></div>
    <div><span>Authorised Signatory</span></div>
  </div>
  <div style="text-align:center;margin-top:32px;font-size:10px;color:#bbb">This is a computer-generated purchase order.</div>
  </body></html>`
}

// ── Issue PO Modal ────────────────────────────────────────────────────────────
function IssuePOModal({ po, supplier, items, onIssued, onClose }) {
  const [promising, setPromising] = useState(po.promised_lead_days?.toString() || '')
  const [issuing, setIssuing] = useState(false)

  const poText = `*Purchase Order: ${po.po_number}*\nDate: ${fmtDate(po.order_date)}${po.expected_date ? `\nExpected by: ${fmtDate(po.expected_date)}` : ''}\n\nItems:\n${items.map((it, i) => `${i + 1}. ${it.description || it.materials?.name || 'Item'} — ${it.quantity} ${it.unit}${it.unit_price ? ` @ ₹${fmtNum(it.unit_price)}` : ''}`).join('\n')}\n\nFrom: Indocable Industries`
  const waLink = `https://wa.me/${supplier?.phone?.replace(/\D/g, '') || ''}?text=${encodeURIComponent(poText)}`
  const mailLink = `mailto:${supplier?.email || ''}?subject=${encodeURIComponent(`Purchase Order ${po.po_number} from Indocable Industries`)}&body=${encodeURIComponent(poText)}`

  async function handleIssue() {
    setIssuing(true)
    const { error } = await supabase.from('purchase_orders').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      promised_lead_days: promising ? parseInt(promising) : null,
    }).eq('id', po.id)
    if (error) { toast.error(error.message); setIssuing(false); return }
    toast.success('PO issued — delivery clock started')
    onIssued()
  }

  function printPO() {
    const w = window.open('', '', 'width=900,height=700')
    w.document.write(buildPOHtml(po, supplier, items))
    w.document.close()
    w.print()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Issue Purchase Order</h2>
            <p className="text-xs text-gray-500 mt-0.5">{po.po_number} · {supplier?.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X size={20} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
            <strong>When you click Issue PO</strong>, the delivery clock starts from today. The app will track how many days it takes to actually receive stock.
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Promised Lead Time (days)</label>
            <input type="number" min="1" value={promising} onChange={e => setPromising(e.target.value)}
              placeholder="e.g. 7 (optional — for on-time tracking)"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Share with supplier</p>
            <div className="flex gap-2">
              <button onClick={printPO}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium cursor-pointer">
                <Printer size={15} /> Print
              </button>
              {supplier?.phone && (
                <a href={waLink} target="_blank" rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-xl text-sm font-medium cursor-pointer">
                  <MessageCircle size={15} /> WhatsApp
                </a>
              )}
              {supplier?.email && (
                <a href={mailLink}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-sm font-medium cursor-pointer">
                  <Mail size={15} /> Email
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">Cancel</button>
          <button onClick={handleIssue} disabled={issuing}
            className="px-6 py-2 bg-brand-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-600 cursor-pointer disabled:opacity-50 flex items-center gap-2">
            <Send size={15} /> {issuing ? 'Issuing…' : 'Issue PO'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Raise Concern Modal ───────────────────────────────────────────────────────
function RaiseConcernModal({ supplierId, poId, poItems, onSave, onClose }) {
  const [form, setForm] = useState({
    issue_type: 'quality',
    description: '',
    material_name: '',
    severity: 'medium',
    quantity_affected: '',
    unit: 'kg',
    raised_at: new Date().toISOString().slice(0, 10),
  })
  const [saving, setSaving] = useState(false)
  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    if (!form.description.trim()) { toast.error('Description is required'); return }
    setSaving(true)
    const { error } = await supabase.from('supplier_issues').insert({
      supplier_id: supplierId,
      po_id: poId || null,
      issue_type: form.issue_type,
      description: form.description,
      material_name: form.material_name || null,
      severity: form.severity,
      quantity_affected: form.quantity_affected ? parseFloat(form.quantity_affected) : 0,
      unit: form.unit,
      raised_at: form.raised_at,
      status: 'open',
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Concern raised')
    onSave()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
            <AlertTriangle size={15} className="text-red-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Raise Concern</h2>
            <p className="text-xs text-gray-500">Issue will be tracked in supplier scorecard</p>
          </div>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 cursor-pointer"><X size={18} /></button>
        </div>

        <div className="px-6 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Issue Type *</label>
              <select value={form.issue_type} onChange={e => setField('issue_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent">
                {Object.entries(ISSUE_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Severity</label>
              <select value={form.severity} onChange={e => setField('severity', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description *</label>
            <textarea value={form.description} onChange={e => setField('description', e.target.value)} rows={3}
              placeholder="Describe the issue clearly…"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Material (optional)</label>
              {poItems?.length > 0 ? (
                <select value={form.material_name} onChange={e => setField('material_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent">
                  <option value="">— Any —</option>
                  {poItems.map((it, i) => <option key={i} value={it.description || it.materials?.name}>{it.description || it.materials?.name}</option>)}
                </select>
              ) : (
                <input type="text" value={form.material_name} onChange={e => setField('material_name', e.target.value)}
                  placeholder="Material name"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Qty Affected</label>
              <input type="number" min="0" step="0.01" value={form.quantity_affected} onChange={e => setField('quantity_affected', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Unit</label>
              <select value={form.unit} onChange={e => setField('unit', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Date Raised</label>
            <input type="date" value={form.raised_at} onChange={e => setField('raised_at', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 cursor-pointer disabled:opacity-50 flex items-center gap-2">
            <AlertTriangle size={15} /> {saving ? 'Raising…' : 'Raise Concern'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Receive Against PO ────────────────────────────────────────────────────────
function ReceiveModal({ po, items, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    receipt_date: new Date().toISOString().slice(0, 10),
    notes: '',
    lines: items.map(item => ({
      po_item_id: item.id,
      description: item.description || item.materials?.name || '',
      unit: item.unit,
      ordered: parseFloat(item.quantity) || 0,
      already_received: parseFloat(item.received_qty) || 0,
      pending: Math.max(0, (parseFloat(item.quantity) || 0) - (parseFloat(item.received_qty) || 0)),
      receiving: '',
      material_id: item.material_id,
    }))
  }))
  const [saving, setSaving] = useState(false)

  const sentAt = po.sent_at
  const actualDays = sentAt ? daysBetween(sentAt, new Date().toISOString()) : null
  const onTime = po.expected_date ? new Date() <= new Date(po.expected_date + 'T23:59:59') : null

  function setLine(idx, key, val) {
    setForm(f => {
      const lines = [...f.lines]
      lines[idx] = { ...lines[idx], [key]: val }
      return { ...f, lines }
    })
  }

  async function handleSave() {
    const linesWithQty = form.lines.filter(l => parseFloat(l.receiving) > 0)
    if (!linesWithQty.length) { toast.error('Enter received quantity for at least one item'); return }

    setSaving(true)
    try {
      const { data: receipt, error: rErr } = await supabase.from('po_receipts').insert({
        po_id: po.id,
        receipt_date: form.receipt_date,
        notes: form.notes || null,
      }).select().single()
      if (rErr) throw rErr

      const { error: riErr } = await supabase.from('po_receipt_items').insert(
        linesWithQty.map(l => ({ receipt_id: receipt.id, po_item_id: l.po_item_id, received_qty: parseFloat(l.receiving) }))
      )
      if (riErr) throw riErr

      for (const l of linesWithQty) {
        const newQty = l.already_received + parseFloat(l.receiving)
        const { error: itemErr } = await supabase.from('purchase_order_items').update({ received_qty: newQty }).eq('id', l.po_item_id)
        if (itemErr) throw itemErr
      }

      const allOrdered = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0)
      const nowReceived = form.lines.reduce((s, l) => s + l.already_received + (parseFloat(l.receiving) || 0), 0)
      const newStatus = nowReceived >= allOrdered ? 'received' : 'partial'
      const updatePayload = { status: newStatus }
      if (newStatus === 'received') updatePayload.received_at = new Date().toISOString()
      const { error: poErr } = await supabase.from('purchase_orders').update(updatePayload).eq('id', po.id)
      if (poErr) throw poErr

      for (const l of linesWithQty) {
        if (l.material_id) {
          const { data: mat } = await supabase.from('materials').select('current_stock').eq('id', l.material_id).single()
          if (mat) {
            const { error: stockErr } = await supabase.from('materials').update({ current_stock: (parseFloat(mat.current_stock) || 0) + parseFloat(l.receiving) }).eq('id', l.material_id)
            if (stockErr) throw stockErr
          }
        }
      }

      toast.success('Stock received and materials updated')
      onSave()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Receive Stock</h2>
            <p className="text-sm text-gray-500">{po.po_number}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X size={20} /></button>
        </div>

        {sentAt && (
          <div className={`mx-6 mt-4 px-4 py-3 rounded-xl text-sm flex items-center gap-3 ${onTime === false ? 'bg-red-50 border border-red-100 text-red-700' : 'bg-emerald-50 border border-emerald-100 text-emerald-700'}`}>
            <Clock size={15} className="flex-shrink-0" />
            <div>
              PO issued {fmtDateTime(sentAt)} · <strong>{actualDays} day{actualDays !== 1 ? 's' : ''} elapsed</strong>
              {po.promised_lead_days && ` · Promised: ${po.promised_lead_days} days`}
              {po.expected_date && ` · Expected by: ${fmtDate(po.expected_date)}`}
              {onTime === false && ' · ⚠ LATE'}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Receipt Date</label>
              <input type="date" value={form.receipt_date} onChange={e => setForm(f => ({ ...f, receipt_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Material</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500">Ordered</th>
                  <th className="text-right py-2 text-xs font-semibold text-emerald-600">Received</th>
                  <th className="text-right py-2 text-xs font-semibold text-amber-600">Pending</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500">Now Receiving</th>
                </tr>
              </thead>
              <tbody>
                {form.lines.map((line, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 font-medium text-gray-800">{line.description} <span className="text-xs text-gray-400">({line.unit})</span></td>
                    <td className="py-2 text-right text-gray-600">{line.ordered}</td>
                    <td className="py-2 text-right text-emerald-600 font-medium">{line.already_received}</td>
                    <td className="py-2 text-right text-amber-600 font-medium">{line.pending}</td>
                    <td className="py-2 text-right">
                      <input type="number" min="0" max={line.pending} step="0.01" value={line.receiving}
                        onChange={e => setLine(i, 'receiving', e.target.value)} placeholder="0"
                        className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-brand-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-600 cursor-pointer disabled:opacity-50 flex items-center gap-2">
            <Save size={15} /> {saving ? 'Saving…' : 'Confirm Receipt'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PO Detail Modal ───────────────────────────────────────────────────────────
function PODetailModal({ po: initialPO, suppliers, onClose, onRefresh }) {
  const [po, setPO] = useState(initialPO)
  const [items, setItems] = useState([])
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('items')
  const [showReceive, setShowReceive] = useState(false)
  const [showIssue, setShowIssue] = useState(false)
  const [showIssuePO, setShowIssuePO] = useState(false)
  const supplier = suppliers.find(s => s.id === po.supplier_id)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: its }, { data: iss }] = await Promise.all([
      supabase.from('purchase_order_items').select('*, materials(name)').eq('po_id', po.id).order('created_at'),
      supabase.from('supplier_issues').select('*').eq('po_id', po.id).order('created_at', { ascending: false }),
    ])
    setItems(its || [])
    setIssues(iss || [])
    setLoading(false)
  }

  async function updateStatus(status) {
    const { error } = await supabase.from('purchase_orders').update({ status }).eq('id', po.id)
    if (error) { toast.error(error.message); return }
    setPO(p => ({ ...p, status }))
    toast.success(`PO marked as ${status}`)
    onRefresh()
  }

  async function resolveIssue(id, notes) {
    const { error } = await supabase.from('supplier_issues').update({ status: 'resolved', resolved_at: new Date().toISOString().slice(0, 10), resolution_notes: notes }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Issue resolved')
    fetchAll()
  }

  function printPO() {
    const w = window.open('', '', 'width=900,height=700')
    w.document.write(buildPOHtml(po, supplier, items))
    w.document.close()
    w.print()
  }

  const total = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0)
  const canReceive = ['sent', 'partial', 'draft'].includes(po.status)
  const canIssue = po.status === 'draft'

  const actualLeadDays = po.sent_at && po.received_at ? daysBetween(po.sent_at, po.received_at) : null
  const elapsedDays = po.sent_at && !po.received_at ? daysBetween(po.sent_at, new Date().toISOString()) : null
  const isLate = po.expected_date && !po.received_at && new Date() > new Date(po.expected_date + 'T23:59:59')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {showReceive && <ReceiveModal po={po} items={items} onSave={() => { setShowReceive(false); fetchAll(); onRefresh() }} onClose={() => setShowReceive(false)} />}
      {showIssue && <RaiseConcernModal supplierId={po.supplier_id} poId={po.id} poItems={items} onSave={() => { setShowIssue(false); fetchAll() }} onClose={() => setShowIssue(false)} />}
      {showIssuePO && <IssuePOModal po={po} supplier={supplier} items={items} onIssued={() => { setShowIssuePO(false); fetchAll(); onRefresh(); setPO(p => ({ ...p, status: 'sent', sent_at: new Date().toISOString() })) }} onClose={() => setShowIssuePO(false)} />}

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">{po.po_number}</h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLE[po.status]}`}>{po.status}</span>
              {isLate && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600 border border-red-200">LATE</span>}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{supplier?.name || '—'} · {fmtDate(po.order_date)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={printPO} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl cursor-pointer"><Printer size={16} /></button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X size={20} /></button>
          </div>
        </div>

        {/* Lead time tracker */}
        {(po.sent_at || po.received_at) && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-6 text-xs text-gray-600">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center"><Send size={10} className="text-white" /></div>
              <span>Issued {fmtDateTime(po.sent_at)}</span>
            </div>
            <div className="flex-1 h-px bg-gray-200 relative">
              {!po.received_at && (
                <div className="absolute inset-y-0 left-0 bg-amber-400" style={{ width: po.expected_date ? `${Math.min(100, (elapsedDays / po.promised_lead_days) * 100 || 50)}%` : '50%' }} />
              )}
            </div>
            {po.received_at ? (
              <div className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${actualLeadDays <= (po.promised_lead_days || 999) ? 'bg-emerald-500' : 'bg-red-500'}`}>
                  <Package size={10} className="text-white" />
                </div>
                <span>Received in <strong>{actualLeadDays}d</strong> {po.promised_lead_days ? `(promised ${po.promised_lead_days}d)` : ''}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-amber-600">
                <Clock size={13} />
                <span><strong>{elapsedDays}d</strong> elapsed {po.promised_lead_days ? `of ${po.promised_lead_days}d promised` : ''}</span>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3 border-b border-gray-100">
          {[['items', 'Items'], ['issues', `Concerns${issues.length > 0 ? ` (${issues.length})` : ''}`]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all cursor-pointer border-b-2 -mb-px ${tab === key ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? <div className="text-center py-8 text-gray-400 text-sm">Loading…</div> : (
            <>
              {tab === 'items' && (
                <>
                  {supplier && (
                    <div className="bg-gray-50 rounded-xl p-4 mb-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-1">Supplier</div>
                        <div className="font-semibold text-gray-800">{supplier.name}</div>
                        {supplier.contact_person && <div className="text-gray-500">{supplier.contact_person}</div>}
                        {supplier.phone && <div className="text-gray-500">{supplier.phone}</div>}
                      </div>
                      <div>
                        {supplier.gst_number && <><div className="text-xs font-semibold text-gray-500 mb-1">GST</div><div>{supplier.gst_number}</div></>}
                        {po.expected_date && <><div className="text-xs font-semibold text-gray-500 mt-2 mb-1">Expected</div><div>{fmtDate(po.expected_date)}</div></>}
                        {po.promised_lead_days && <><div className="text-xs font-semibold text-gray-500 mt-2 mb-1">Promised Lead</div><div>{po.promised_lead_days} days</div></>}
                      </div>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 text-xs font-semibold text-gray-500">Material</th>
                          <th className="text-right py-2 text-xs font-semibold text-gray-500">Ordered</th>
                          <th className="text-right py-2 text-xs font-semibold text-emerald-600">Received</th>
                          <th className="text-right py-2 text-xs font-semibold text-gray-500">Unit Price</th>
                          <th className="text-right py-2 text-xs font-semibold text-gray-500">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(item => {
                          const pct = item.quantity > 0 ? Math.min(100, ((parseFloat(item.received_qty) || 0) / parseFloat(item.quantity)) * 100) : 0
                          return (
                            <tr key={item.id} className="border-b border-gray-50">
                              <td className="py-3">
                                <div className="font-medium text-gray-800">{item.description || item.materials?.name || '—'}</div>
                                <div className="text-xs text-gray-400">{item.unit}</div>
                                <div className="mt-1 h-1 bg-gray-100 rounded-full w-28">
                                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                                </div>
                              </td>
                              <td className="py-3 text-right text-gray-600">{item.quantity}</td>
                              <td className="py-3 text-right font-semibold text-emerald-600">{item.received_qty || 0}</td>
                              <td className="py-3 text-right text-gray-600">{item.unit_price ? `₹${fmtNum(item.unit_price)}` : '—'}</td>
                              <td className="py-3 text-right font-medium text-gray-800">
                                {item.unit_price ? `₹${fmtNum((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0))}` : '—'}
                              </td>
                            </tr>
                          )
                        })}
                        {total > 0 && (
                          <tr>
                            <td colSpan={4} className="py-3 text-right text-sm font-bold text-gray-700">Total</td>
                            <td className="py-3 text-right text-base font-bold text-gray-900">₹{fmtNum(total)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {po.notes && <div className="mt-4 p-3 bg-amber-50 rounded-xl text-sm text-amber-800"><strong>Notes:</strong> {po.notes}</div>}
                </>
              )}

              {tab === 'issues' && (
                <div className="space-y-3">
                  {issues.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <ThumbsUp size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No concerns raised for this PO</p>
                    </div>
                  ) : issues.map(issue => (
                    <div key={issue.id} className={`rounded-xl border p-4 ${issue.status === 'resolved' ? 'bg-gray-50 border-gray-100 opacity-70' : 'bg-white border-gray-200'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-800">{ISSUE_TYPE_LABEL[issue.issue_type]}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${SEVERITY_STYLE[issue.severity]}`}>{issue.severity}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${issue.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{issue.status}</span>
                          </div>
                          <p className="text-sm text-gray-700 mt-1">{issue.description}</p>
                          {issue.material_name && <p className="text-xs text-gray-500 mt-0.5">Material: {issue.material_name} {issue.quantity_affected > 0 ? `· ${issue.quantity_affected} ${issue.unit}` : ''}</p>}
                          <p className="text-xs text-gray-400 mt-1">{fmtDate(issue.raised_at)}</p>
                          {issue.resolution_notes && <p className="text-xs text-emerald-700 mt-1 bg-emerald-50 rounded-lg px-2 py-1">Resolution: {issue.resolution_notes}</p>}
                        </div>
                        {issue.status === 'open' && (
                          <button onClick={() => {
                            const notes = window.prompt('Resolution notes (optional):') ?? null
                            if (notes !== null) resolveIssue(issue.id, notes)
                          }}
                            className="text-xs px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-semibold cursor-pointer hover:bg-emerald-100 flex-shrink-0">
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-between items-center">
          <div className="flex gap-2 flex-wrap">
            {canIssue && (
              <button onClick={() => setShowIssuePO(true)}
                className="px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-600 cursor-pointer flex items-center gap-1.5">
                <Send size={14} /> Issue PO
              </button>
            )}
            {po.status !== 'cancelled' && po.status !== 'received' && !canIssue && (
              <button onClick={() => updateStatus('cancelled')}
                className="px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 cursor-pointer">
                Cancel PO
              </button>
            )}
            <button onClick={() => setShowIssue(true)}
              className="px-4 py-2 border border-orange-200 text-orange-600 rounded-xl text-sm font-semibold hover:bg-orange-50 cursor-pointer flex items-center gap-1.5">
              <AlertTriangle size={14} /> Raise Concern
            </button>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">Close</button>
            {canReceive && po.status !== 'draft' && (
              <button onClick={() => setShowReceive(true)}
                className="px-6 py-2 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 cursor-pointer flex items-center gap-2">
                <Package size={15} /> Receive Stock
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── New PO Modal ──────────────────────────────────────────────────────────────
function NewPOModal({ suppliers, materials, onSave, onClose }) {
  const emptyItem = { material_id: '', description: '', quantity: '', unit: 'kg', unit_price: '' }
  const [form, setForm] = useState({
    supplier_id: '',
    order_date: new Date().toISOString().slice(0, 10),
    expected_date: '',
    promised_lead_days: '',
    notes: '',
    items: [{ ...emptyItem }],
  })
  const [saving, setSaving] = useState(false)

  function setField(key, val) { setForm(f => ({ ...f, [key]: val })) }
  function setItem(idx, key, val) {
    setForm(f => {
      const items = [...f.items]
      items[idx] = { ...items[idx], [key]: val }
      if (key === 'material_id' && val) {
        const mat = materials.find(m => m.id === val)
        if (mat) items[idx].unit = mat.unit
      }
      return { ...f, items }
    })
  }
  function addItem() { setForm(f => ({ ...f, items: [...f.items, { ...emptyItem }] })) }
  function removeItem(idx) { setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) })) }

  async function handleSave() {
    if (!form.supplier_id) { toast.error('Select a supplier'); return }
    if (!form.items.some(i => i.quantity)) { toast.error('Add at least one item'); return }

    setSaving(true)
    try {
      const { count } = await supabase.from('purchase_orders').select('id', { count: 'exact', head: true })
      const po_number = genPONumber(count || 0)

      const { data: po, error: poErr } = await supabase.from('purchase_orders').insert({
        po_number,
        supplier_id: form.supplier_id,
        order_date: form.order_date,
        expected_date: form.expected_date || null,
        promised_lead_days: form.promised_lead_days ? parseInt(form.promised_lead_days) : null,
        notes: form.notes || null,
      }).select().single()
      if (poErr) throw poErr

      const { error: itemErr } = await supabase.from('purchase_order_items').insert(
        form.items.filter(i => i.quantity).map(i => ({
          po_id: po.id,
          material_id: i.material_id || null,
          description: i.description || null,
          quantity: parseFloat(i.quantity),
          unit: i.unit,
          unit_price: i.unit_price ? parseFloat(i.unit_price) : 0,
          received_qty: 0,
        }))
      )
      if (itemErr) throw itemErr

      toast.success(`${po_number} created`)
      onSave()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const total = form.items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">New Purchase Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Supplier *</label>
              <select value={form.supplier_id} onChange={e => setField('supplier_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent">
                <option value="">— Select Supplier —</option>
                {suppliers.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Order Date</label>
              <input type="date" value={form.order_date} onChange={e => setField('order_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Expected Delivery</label>
              <input type="date" value={form.expected_date} onChange={e => setField('expected_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Promised Lead Time (days)</label>
              <input type="number" min="1" value={form.promised_lead_days} onChange={e => setField('promised_lead_days', e.target.value)}
                placeholder="e.g. 7"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={e => setField('notes', e.target.value)}
                placeholder="Payment terms, special instructions…"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Order Items</h3>
              <button onClick={addItem} className="text-xs text-brand-600 hover:text-brand-700 font-semibold cursor-pointer flex items-center gap-1">
                <Plus size={13} /> Add Item
              </button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="bg-gray-50 rounded-xl p-3 grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-3">
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">Material (optional)</label>
                    <select value={item.material_id} onChange={e => setItem(idx, 'material_id', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 bg-white">
                      <option value="">— None —</option>
                      {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">Description *</label>
                    <input type="text" value={item.description} onChange={e => setItem(idx, 'description', e.target.value)}
                      placeholder="Item description"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 bg-white" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">Qty *</label>
                    <input type="number" min="0" step="0.01" value={item.quantity} onChange={e => setItem(idx, 'quantity', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 bg-white" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">Unit</label>
                    <select value={item.unit} onChange={e => setItem(idx, 'unit', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 bg-white">
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">Unit Price (₹)</label>
                    <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => setItem(idx, 'unit_price', e.target.value)}
                      placeholder="0"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 bg-white" />
                  </div>
                  <div className="col-span-1 flex justify-end pb-0.5">
                    {form.items.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"><Trash2 size={13} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {total > 0 && <div className="mt-2 text-right text-sm font-bold text-gray-700">Total: ₹{fmtNum(total)}</div>}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-brand-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-600 cursor-pointer disabled:opacity-50 flex items-center gap-2">
            <Save size={15} /> {saving ? 'Creating…' : 'Create PO'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Supplier Modal ────────────────────────────────────────────────────────────
function SupplierModal({ supplier, onSave, onClose }) {
  const [form, setForm] = useState(supplier || { name: '', contact_person: '', phone: '', email: '', address: '', gst_number: '', payment_terms: '', is_active: true })
  const [saving, setSaving] = useState(false)
  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Supplier name required'); return }
    setSaving(true)
    try {
      const { error } = supplier?.id
        ? await supabase.from('suppliers').update({ ...form }).eq('id', supplier.id)
        : await supabase.from('suppliers').insert({ ...form })
      if (error) throw error
      toast.success(supplier ? 'Supplier updated' : 'Supplier added')
      onSave()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{supplier ? 'Edit Supplier' : 'Add Supplier'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X size={20} /></button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Supplier Name *</label>
              <input type="text" value={form.name} onChange={e => setField('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Contact Person</label>
              <input type="text" value={form.contact_person} onChange={e => setField('contact_person', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Phone (for WhatsApp)</label>
              <input type="tel" value={form.phone} onChange={e => setField('phone', e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setField('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">GST Number</label>
              <input type="text" value={form.gst_number} onChange={e => setField('gst_number', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Address</label>
              <textarea value={form.address} onChange={e => setField('address', e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Terms</label>
              <input type="text" value={form.payment_terms} onChange={e => setField('payment_terms', e.target.value)}
                placeholder="e.g. Net 30, COD"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-brand-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-600 cursor-pointer disabled:opacity-50 flex items-center gap-2">
            <Save size={15} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Supplier Scorecard ────────────────────────────────────────────────────────
function SupplierScorecard({ supplier, orders, issues }) {
  const supOrders = orders.filter(o => o.supplier_id === supplier.id)
  const supIssues = issues.filter(i => i.supplier_id === supplier.id)

  const receivedOrders = supOrders.filter(o => o.status === 'received' && o.sent_at && o.received_at)
  const avgLeadDays = receivedOrders.length > 0
    ? Math.round(receivedOrders.reduce((s, o) => s + daysBetween(o.sent_at, o.received_at), 0) / receivedOrders.length)
    : null

  const onTimeOrders = receivedOrders.filter(o => o.promised_lead_days && daysBetween(o.sent_at, o.received_at) <= o.promised_lead_days)
  const onTimeRate = receivedOrders.length > 0 ? Math.round((onTimeOrders.length / receivedOrders.length) * 100) : null

  const openIssues = supIssues.filter(i => i.status === 'open')
  const criticalIssues = supIssues.filter(i => i.severity === 'critical' || i.severity === 'high')

  const issuesByType = supIssues.reduce((acc, i) => { acc[i.issue_type] = (acc[i.issue_type] || 0) + 1; return acc }, {})

  // Score: start 100, -5 per open issue, -10 per critical, -5 if avg late, +0 if on time
  let score = 100
  score -= openIssues.length * 5
  score -= criticalIssues.length * 10
  if (onTimeRate !== null && onTimeRate < 80) score -= 15
  if (onTimeRate !== null && onTimeRate < 50) score -= 15
  score = Math.max(0, Math.min(100, score))

  const scoreColor = score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'
  const scoreBg = score >= 80 ? 'bg-emerald-50 border-emerald-100' : score >= 60 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 ${openIssues.length > 0 ? 'border-orange-200' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="font-bold text-gray-900">{supplier.name}</div>
          {supplier.contact_person && <div className="text-xs text-gray-500 mt-0.5">{supplier.contact_person}</div>}
          {supplier.phone && <div className="text-xs text-gray-400">{supplier.phone}</div>}
        </div>
        <div className={`px-3 py-2 rounded-xl border text-center min-w-[64px] ${scoreBg}`}>
          <div className={`text-xl font-bold ${scoreColor}`}>{supOrders.length > 0 ? score : '—'}</div>
          <div className="text-[10px] text-gray-500">Score</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4 text-center">
        <div className="bg-gray-50 rounded-xl p-2">
          <div className="text-base font-bold text-gray-800">{supOrders.length}</div>
          <div className="text-[10px] text-gray-500">Total POs</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-2">
          <div className={`text-base font-bold ${onTimeRate !== null ? (onTimeRate >= 80 ? 'text-emerald-600' : 'text-red-600') : 'text-gray-400'}`}>
            {onTimeRate !== null ? `${onTimeRate}%` : '—'}
          </div>
          <div className="text-[10px] text-gray-500">On-time</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-2">
          <div className={`text-base font-bold ${avgLeadDays !== null ? 'text-gray-800' : 'text-gray-400'}`}>
            {avgLeadDays !== null ? `${avgLeadDays}d` : '—'}
          </div>
          <div className="text-[10px] text-gray-500">Avg Lead</div>
        </div>
      </div>

      {supIssues.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-gray-500 mb-1">Issues Raised</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(issuesByType).map(([type, count]) => (
              <span key={type} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px] font-semibold">
                {ISSUE_TYPE_LABEL[type]}: {count}
              </span>
            ))}
          </div>
          {openIssues.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-orange-700 font-semibold">
              <AlertCircle size={12} /> {openIssues.length} open concern{openIssues.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {supplier.payment_terms && (
        <div className="mt-3 text-xs text-gray-500">
          <span className="font-semibold">Terms:</span> {supplier.payment_terms}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PurchaseOrders({ profile }) {
  const [tab, setTab] = useState('orders')
  const [orders, setOrders] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [allIssues, setAllIssues] = useState([])
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [showNewPO, setShowNewPO] = useState(false)
  const [showSupplier, setShowSupplier] = useState(false)
  const [editSupplier, setEditSupplier] = useState(null)
  const [detailPO, setDetailPO] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: pos }, { data: sups }, { data: mats }, { data: iss }] = await Promise.all([
      supabase.from('purchase_orders').select('*, suppliers(name, phone, email)').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('materials').select('id,name,unit').eq('is_active', true).order('name'),
      supabase.from('supplier_issues').select('*').order('created_at', { ascending: false }),
    ])
    setOrders(pos || [])
    setSuppliers(sups || [])
    setMaterials(mats || [])
    setAllIssues(iss || [])
    setLoading(false)
  }

  const filteredOrders = filterStatus === 'all' ? orders : orders.filter(o => o.status === filterStatus)

  const stats = {
    total: orders.length,
    pending: orders.filter(o => ['draft','sent','partial'].includes(o.status)).length,
    late: orders.filter(o => ['sent','partial'].includes(o.status) && o.expected_date && new Date() > new Date(o.expected_date + 'T23:59:59')).length,
    openIssues: allIssues.filter(i => i.status === 'open').length,
  }

  return (
    <div className="space-y-6">
      {detailPO && (
        <PODetailModal po={detailPO} suppliers={suppliers} onClose={() => setDetailPO(null)} onRefresh={fetchAll} />
      )}
      {showNewPO && (
        <NewPOModal suppliers={suppliers} materials={materials} onSave={() => { setShowNewPO(false); fetchAll() }} onClose={() => setShowNewPO(false)} />
      )}
      {showSupplier && (
        <SupplierModal supplier={editSupplier} onSave={() => { setShowSupplier(false); setEditSupplier(null); fetchAll() }} onClose={() => { setShowSupplier(false); setEditSupplier(null) }} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Purchase Orders</h1>
          <p className="page-sub">Procurement, delivery tracking and supplier performance</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAll} className="btn-ghost px-2.5"><RefreshCw size={16} /></button>
          {tab === 'orders' && (
            <button onClick={() => setShowNewPO(true)} className="btn-primary">
              <Plus size={15} /> New PO
            </button>
          )}
          {tab === 'suppliers' && (
            <button onClick={() => { setEditSupplier(null); setShowSupplier(true) }} className="btn-primary">
              <Plus size={15} /> Add Supplier
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total POs', value: stats.total, color: 'text-gray-900', bg: 'bg-white' },
          { label: 'Active', value: stats.pending, color: 'text-blue-600', bg: 'bg-white' },
          { label: 'Late Deliveries', value: stats.late, color: 'text-red-600', bg: stats.late > 0 ? 'bg-red-50' : 'bg-white' },
          { label: 'Open Concerns', value: stats.openIssues, color: 'text-orange-600', bg: stats.openIssues > 0 ? 'bg-orange-50' : 'bg-white' },
        ].map(s => (
          <div key={s.label} className={`card p-4 ${s.bg !== 'bg-white' ? s.bg : ''}`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[['orders', 'Purchase Orders'], ['suppliers', 'Suppliers'], ['scorecard', 'Scorecard']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Orders Tab */}
      {tab === 'orders' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {['all', 'draft', 'sent', 'partial', 'received', 'cancelled'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-all ${filterStatus === s ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {s}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="card overflow-hidden">
              {[...Array(4)].map((_,i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 last:border-0">
                  <div className="skeleton h-4 w-28 rounded-md"/>
                  <div className="skeleton h-4 w-32 rounded-md"/>
                  <div className="skeleton h-4 w-20 rounded-md"/>
                  <div className="skeleton h-5 w-16 rounded-full"/>
                  <div className="skeleton h-4 w-16 rounded-md ml-auto"/>
                </div>
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold">No purchase orders</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">PO Number</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Supplier</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Date</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Lead Time</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map(po => {
                    const isLate = ['sent','partial'].includes(po.status) && po.expected_date && new Date() > new Date(po.expected_date + 'T23:59:59')
                    const elapsed = po.sent_at && !po.received_at ? daysBetween(po.sent_at, new Date().toISOString()) : null
                    const actual = po.sent_at && po.received_at ? daysBetween(po.sent_at, po.received_at) : null
                    return (
                      <tr key={po.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${isLate ? 'bg-red-50/40' : ''}`}>
                        <td className="px-5 py-3 font-semibold text-brand-600">{po.po_number}</td>
                        <td className="px-5 py-3 text-gray-700">{po.suppliers?.name || '—'}</td>
                        <td className="px-5 py-3 text-gray-500">{fmtDate(po.order_date)}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLE[po.status]}`}>{po.status}</span>
                            {isLate && <span className="text-xs text-red-600 font-semibold">LATE</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500">
                          {actual !== null ? (
                            <span className={po.promised_lead_days && actual > po.promised_lead_days ? 'text-red-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                              {actual}d {po.promised_lead_days ? `/ ${po.promised_lead_days}d` : ''}
                            </span>
                          ) : elapsed !== null ? (
                            <span className="text-amber-600">{elapsed}d elapsed</span>
                          ) : po.promised_lead_days ? (
                            <span className="text-gray-400">{po.promised_lead_days}d promised</span>
                          ) : '—'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button onClick={() => setDetailPO(po)}
                            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium cursor-pointer flex items-center gap-1 ml-auto">
                            <Eye size={12} /> View
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Suppliers Tab */}
      {tab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suppliers.length === 0 ? (
            <div className="col-span-2 text-center py-16 text-gray-400">
              <Building2 size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold">No suppliers yet</p>
            </div>
          ) : suppliers.map(sup => (
            <div key={sup.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-gray-900">{sup.name}</div>
                  {sup.contact_person && <div className="text-sm text-gray-500 mt-0.5">{sup.contact_person}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sup.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {sup.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <button onClick={() => { setEditSupplier(sup); setShowSupplier(true) }}
                    className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg cursor-pointer">Edit</button>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-gray-500">
                {sup.phone && <div className="flex items-center gap-1.5"><Phone size={11} /> {sup.phone}</div>}
                {sup.email && <div className="flex items-center gap-1.5"><Mail size={11} /> {sup.email}</div>}
                {sup.address && <div className="flex items-center gap-1.5"><MapPin size={11} /> {sup.address}</div>}
                {sup.gst_number && <div className="flex items-center gap-1.5"><FileText size={11} /> GST: {sup.gst_number}</div>}
                {sup.payment_terms && <div className="flex items-center gap-1.5"><CheckCircle2 size={11} /> {sup.payment_terms}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scorecard Tab */}
      {tab === 'scorecard' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 flex items-start gap-2">
            <Award size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <strong>Supplier Score</strong> starts at 100 and is reduced by open concerns (−5 each), high/critical issues (−10 each), and poor on-time delivery rate (&lt;80% costs −15 pts). Add supplier phone numbers to enable WhatsApp PO sharing.
            </div>
          </div>
          {suppliers.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <TrendingUp size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold">Add suppliers to see scorecards</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suppliers.map(sup => (
                <SupplierScorecard key={sup.id} supplier={sup} orders={orders} issues={allIssues} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
