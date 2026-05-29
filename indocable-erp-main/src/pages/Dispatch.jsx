import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import {
  Truck, Plus, RefreshCw, X, Save, Printer, Edit2,
  Users, Trash2, CheckCircle2, Search, MessageSquare,
  Mail, Phone, Building2, MapPin, Star, Send,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────
const GRADIENTS = ['from-brand-500 to-brand-700','from-emerald-500 to-teal-600','from-violet-500 to-purple-700','from-amber-500 to-orange-600','from-cyan-500 to-blue-600','from-rose-500 to-pink-600']
function gradient(s=''){let h=0;for(const c of s)h=((h<<5)-h)+c.charCodeAt(0);return GRADIENTS[Math.abs(h)%GRADIENTS.length]}
function fmtDate(d){return d?new Date(d+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'—'}
function fmtPhone(p){return(p||'').replace(/[^0-9]/g,'')}
function fmtWA(p){const d=fmtPhone(p);return d.length===10?'91'+d:d}

const UNITS = ['pcs','kg','mtr','coil','drum','roll','box','set','ltr','nos']
const EMPTY_ITEM = { description:'', quantity:'', unit:'pcs', weight:'', rate:'', hsn_code:'', pallets:'', production_order_id:'' }

const STATUS = {
  draft:      { label:'DRAFT',      cls:'bg-slate-100 text-slate-600 border-slate-200' },
  dispatched: { label:'DISPATCHED', cls:'bg-blue-100 text-blue-700 border-blue-200' },
  delivered:  { label:'DELIVERED',  cls:'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelled:  { label:'CANCELLED',  cls:'bg-red-100 text-red-600 border-red-200' },
}
const STATUS_ORDER = { draft:0, dispatched:1, delivered:2, cancelled:3 }

// ── DB-safe challan number (DC-001/26-27 financial-year format) ───────────────
async function genChallanNo() {
  const d = new Date()
  const m = d.getMonth() + 1
  const yr = d.getFullYear()
  const fyStart = m >= 4 ? yr : yr - 1
  const fyStr = `${String(fyStart).slice(-2)}-${String(fyStart+1).slice(-2)}`
  const { data } = await supabase.from('dispatch_orders')
    .select('challan_number').like('challan_number',`DC-%/${fyStr}`)
    .order('created_at',{ascending:false}).limit(1)
  let seq = 1
  if (data?.[0]) { const mat = data[0].challan_number.match(/^DC-(\d+)\//) ; if(mat) seq = parseInt(mat[1])+1 }
  return `DC-${String(seq).padStart(3,'0')}/${fyStr}`
}

// ── Transport enquiry message ─────────────────────────────────────────────────
function buildMessage(challan, customer, items) {
  const totalWeight  = items.reduce((s,i)=>(s+(parseFloat(i.weight)||0)*(parseFloat(i.quantity)||0)),0)
  const totalPallets = items.reduce((s,i)=>s+(parseInt(i.pallets)||0),0)
  const div = '─────────────────────'
  const lines = items.map((it,i)=>{
    const meta = [
      `Qty: ${it.quantity} ${it.unit}`,
      it.weight ? `Wt: ${(parseFloat(it.weight)*parseFloat(it.quantity||0)).toFixed(1)} kg` : '',
      it.pallets ? `Pallets: ${it.pallets}` : '',
    ].filter(Boolean).join('  |  ')
    return `${i+1}. *${it.description}*\n    ${meta}`
  }).join('\n')
  const summary = [
    totalWeight  > 0 ? `*Total Weight:* ${totalWeight.toFixed(1)} kg`   : '',
    totalPallets > 0 ? `*Total Pallets:* ${totalPallets}`               : '',
  ].filter(Boolean).join('\n')
  return `*FREIGHT ENQUIRY — Indocable Industries*\n\n*Challan No.:* ${challan.challan_number}\n*Date:* ${fmtDate(challan.date)}\n*Consignee:* ${customer?.name||'—'}\n\n*From:* Indocable Industries, Bengaluru\n*To:* ${challan.destination_address||'Please confirm delivery address'}\n\n${div}\n*GOODS*\n${div}\n${lines}\n${div}${summary?`\n${summary}\n${div}`:''}\n\nKindly quote your best freight rate for the above consignment. Please confirm pickup availability and expected transit time.\n\n*Indocable Industries*\nBengaluru, Karnataka`
}

// ── Print Challan ─────────────────────────────────────────────────────────────
function ChallanPrint({ challan, customer, items, agency, onClose }) {
  const [threeC, setThreeC] = useState(false)
  const total        = items.reduce((s,i)=>(s+(parseFloat(i.quantity)||0)*(parseFloat(i.rate)||0)),0)
  const totalWeight  = items.reduce((s,i)=>(s+(parseFloat(i.weight)||0)*(parseFloat(i.quantity)||0)),0)
  const totalPallets = items.reduce((s,i)=>s+(parseInt(i.pallets)||0),0)

  function handlePrint() {
    let frame = document.getElementById('__challan_print__')
    if (frame) frame.remove()
    frame = document.createElement('iframe')
    frame.id = '__challan_print__'
    frame.style.cssText = 'position:fixed;left:-9999px;top:0;width:210mm;height:297mm;border:none'
    document.body.appendChild(frame)
    const doc = frame.contentDocument || frame.contentWindow.document

    const challanBody = `
<div class="hdr">
  <div>
    <div class="co">Indocable Industries</div>
    <div class="co-sub">Delivery Challan</div>
    <div class="lbl" style="margin-top:3px;font-size:11px">GSTIN: 29AAICC5462H1ZE | Bengaluru, Karnataka</div>
  </div>
  <div style="text-align:right">
    <div class="lbl" style="font-size:10px;margin-bottom:2px">CHALLAN NO.</div>
    <div class="ch-no">${challan.challan_number}</div>
    <div class="lbl" style="margin-top:4px">Date: ${fmtDate(challan.date)}</div>
    ${challan.lr_number?`<div class="lbl" style="margin-top:3px;font-size:11px">LR No.: <strong>${challan.lr_number}</strong></div>`:''}
    <span class="badge b-${challan.status||'draft'}">${(challan.status||'draft').toUpperCase()}</span>
    ${challan.eway_bill_number?`<div class="lbl" style="margin-top:5px;font-size:11px">E-Way Bill: <strong>${challan.eway_bill_number}</strong></div>`:''}
  </div>
</div>
<div class="grid3">
  <div class="box">
    <div class="box-title">Bill To</div>
    <div style="font-weight:700;font-size:14px">${customer?.name||'—'}</div>
    ${customer?.address?`<div class="lbl" style="margin-top:4px">${customer.address}</div>`:''}
    ${customer?.phone?`<div class="lbl" style="margin-top:3px">Ph: ${customer.phone}</div>`:''}
    ${customer?.gst_number?`<div class="lbl" style="margin-top:3px">GSTIN: ${customer.gst_number}</div>`:''}
  </div>
  <div class="box">
    <div class="box-title">Delivery Address</div>
    <div style="font-size:13px;line-height:1.6">${challan.destination_address||'—'}</div>
  </div>
  <div class="box">
    <div class="box-title">Transport</div>
    ${agency?`<div style="font-weight:700">${agency.name}</div>${agency.contact_person?`<div class="lbl" style="margin-top:3px">${agency.contact_person}</div>`:''}${agency.phone?`<div class="lbl" style="margin-top:3px">Ph: ${agency.phone}</div>`:''}`:agency===null&&challan.vehicle_number?'':`<div class="lbl">Self / Own</div>`}
    ${challan.vehicle_number?`<div style="margin-top:4px"><span class="lbl">Vehicle: </span><strong>${challan.vehicle_number}</strong></div>`:''}
    ${challan.driver_name?`<div style="margin-top:3px"><span class="lbl">Driver: </span><strong>${challan.driver_name}</strong></div>`:''}
    ${challan.lr_number?`<div style="margin-top:3px"><span class="lbl">LR No.: </span><strong>${challan.lr_number}</strong></div>`:''}
    ${challan.agreed_rate?`<div style="margin-top:3px"><span class="lbl">Freight: </span><strong>₹${Number(challan.agreed_rate).toLocaleString('en-IN')}</strong></div>`:''}
  </div>
</div>
<table>
  <thead><tr><th style="width:24px">#</th><th>Description</th><th style="width:52px">HSN</th><th style="width:52px">Qty</th><th style="width:40px">Unit</th><th style="width:55px">Wt/unit</th><th style="width:48px">Pallets</th><th style="width:80px;text-align:right">Rate (₹)</th><th style="width:94px;text-align:right">Amount (₹)</th></tr></thead>
  <tbody>
    ${items.map((it,i)=>`<tr><td style="color:#9ca3af">${i+1}</td><td>${it.description}</td><td style="color:#6b7280;font-size:11px">${it.hsn_code||'—'}</td><td>${it.quantity}</td><td style="color:#6b7280">${it.unit}</td><td style="color:#6b7280">${it.weight?`${it.weight} kg`:'—'}</td><td style="color:#6b7280">${it.pallets||'—'}</td><td style="text-align:right">${it.rate?Number(it.rate).toLocaleString('en-IN'):'—'}</td><td style="text-align:right;font-weight:600">${(it.rate&&it.quantity)?((parseFloat(it.quantity))*(parseFloat(it.rate))).toLocaleString('en-IN'):'—'}</td></tr>`).join('')}
  </tbody>
</table>
<div class="tot"><div class="tot-box">
  ${totalWeight>0?`<div class="tr" style="color:#6b7280"><span>Total Weight</span><span>${totalWeight.toFixed(1)} kg</span></div>`:''}
  ${totalPallets>0?`<div class="tr" style="color:#6b7280"><span>Total Pallets</span><span>${totalPallets}</span></div>`:''}
  ${total>0?`<div class="tr"><span>Subtotal</span><span>₹${total.toLocaleString('en-IN')}</span></div>`:''}
  ${challan.agreed_rate?`<div class="tr"><span>Freight</span><span>₹${Number(challan.agreed_rate).toLocaleString('en-IN')}</span></div>`:''}
  ${total>0?`<div class="tr tf"><span>Grand Total</span><span>₹${(total+(parseFloat(challan.agreed_rate)||0)).toLocaleString('en-IN')}</span></div>`:''}
</div></div>
${challan.notes?`<div style="margin-top:14px;padding:10px 14px;background:#f9fafb;border-radius:6px;font-size:12px;color:#374151"><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af">Notes: </span>${challan.notes}</div>`:''}
<div class="sign"><div class="sb"><div class="sl">Customer Signature</div></div><div class="sb"><div class="sl">Driver / Transporter</div></div><div class="sb"><div class="sl">Authorised Signatory</div></div></div>
<div class="footer">Subject to Bengaluru jurisdiction. Goods once dispatched will not be taken back without prior approval. E.&amp;O.E.<br>Computer-generated delivery challan — Indocable Industries</div>`

    const labels = ['ORIGINAL — FOR CONSIGNEE','DUPLICATE — FOR TRANSPORTER','TRIPLICATE — OFFICE COPY']
    const copies = threeC ? 3 : 1
    const pages = Array.from({length:copies},(_,i)=>
      (copies>1?`<div class="copy-lbl">${labels[i]}</div>`:'')+challanBody+(i<copies-1?'<div class="pg-break"></div>':'')
    ).join('')

    doc.open()
    doc.write(`<!DOCTYPE html><html><head><title>DC ${challan.challan_number}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;color:#111;padding:24px 32px;font-size:13px}
.copy-lbl{text-align:center;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;padding:4px 0;font-size:10px;font-weight:700;letter-spacing:.12em;color:#6b7280;margin-bottom:16px}
.pg-break{margin:24px 0}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #111;padding-bottom:16px;margin-bottom:20px}
.co{font-size:24px;font-weight:900;letter-spacing:-1px}.co-sub{color:#888;font-size:11px;margin-top:2px;text-transform:uppercase;letter-spacing:.1em}
.ch-no{font-size:20px;font-weight:800;color:#f97316;text-align:right}
.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.05em;margin-top:6px}
.b-draft{background:#f1f5f9;color:#475569;border:1px solid #cbd5e1}
.b-dispatched{background:#dbeafe;color:#1d4ed8;border:1px solid #93c5fd}
.b-delivered{background:#d1fae5;color:#065f46;border:1px solid #6ee7b7}
.b-cancelled{background:#fee2e2;color:#991b1b;border:1px solid #fca5a5}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px}
.box{border:1px solid #e5e7eb;border-radius:8px;padding:12px}
.box-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#9ca3af;margin-bottom:8px}
.lbl{color:#6b7280;font-size:11px}
table{width:100%;border-collapse:collapse}
thead tr{background:#f9fafb}
th{text-align:left;padding:9px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;border-bottom:2px solid #e5e7eb}
td{padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;vertical-align:middle}
.tot{margin-top:14px;display:flex;justify-content:flex-end}
.tot-box{border:1px solid #e5e7eb;border-radius:8px;padding:12px 20px;min-width:200px}
.tr{display:flex;justify-content:space-between;padding:3px 0;font-size:13px}
.tf{font-weight:800;font-size:15px;padding-top:8px;margin-top:6px;border-top:2px solid #111}
.sign{display:flex;justify-content:space-between;margin-top:48px;padding-top:16px;border-top:1px solid #e5e7eb}
.sb{text-align:center;width:28%}
.sl{border-top:1px solid #374151;margin-top:40px;padding-top:6px;font-size:10px;color:#6b7280}
.footer{text-align:center;margin-top:22px;font-size:10px;color:#9ca3af;padding-top:10px;border-top:1px solid #f3f4f6;line-height:1.6}
@media print{@page{margin:10mm}body{padding:0}.pg-break{page-break-after:always}}
</style></head><body>${pages}</body></html>`)
    doc.close()
    let printed = false
    const doPrint = () => { if(printed)return; printed=true; frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(()=>frame.remove(),1500) }
    frame.onload = doPrint
    setTimeout(doPrint, 400)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <span className="font-bold text-slate-800">{challan.challan_number}</span>
          <div className="flex gap-2">
            <button onClick={()=>setThreeC(t=>!t)}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${threeC?'bg-slate-800 text-white border-slate-800':'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'}`}>
              3 copies
            </button>
            <button onClick={handlePrint} className="flex items-center gap-1.5 text-[12px] font-semibold bg-brand-500 text-white px-3 py-1.5 rounded-lg hover:bg-brand-600 cursor-pointer">
              <Printer size={13}/> Print / Save PDF
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"><X size={16}/></button>
          </div>
        </div>
        <div className="p-5 space-y-2.5 text-sm max-h-[70vh] overflow-y-auto">
          <div className="flex justify-between"><span className="text-slate-500">Customer</span><strong>{customer?.name||'—'}</strong></div>
          <div className="flex justify-between"><span className="text-slate-500">Date</span><strong>{fmtDate(challan.date)}</strong></div>
          {challan.lr_number&&<div className="flex justify-between"><span className="text-slate-500">LR No.</span><strong>{challan.lr_number}</strong></div>}
          {challan.destination_address&&<div className="flex justify-between gap-4"><span className="text-slate-500 flex-shrink-0">Deliver to</span><span className="text-right text-slate-700 text-[12px]">{challan.destination_address}</span></div>}
          {agency&&<div className="flex justify-between"><span className="text-slate-500">Transporter</span><strong>{agency.name}</strong></div>}
          {challan.vehicle_number&&<div className="flex justify-between"><span className="text-slate-500">Vehicle</span><strong>{challan.vehicle_number}</strong></div>}
          {challan.agreed_rate&&<div className="flex justify-between"><span className="text-slate-500">Freight</span><strong>₹{Number(challan.agreed_rate).toLocaleString('en-IN')}</strong></div>}
          {challan.eway_bill_number&&<div className="flex justify-between"><span className="text-slate-500">E-Way Bill</span><strong>{challan.eway_bill_number}</strong></div>}
          <div className="border-t border-slate-100 pt-2.5 space-y-1.5">
            {items.map((item,i)=>(
              <div key={i} className="flex justify-between text-[12px] gap-2">
                <span className="text-slate-600">{item.description} — {item.quantity} {item.unit}{item.weight?` · ${item.weight}kg/unit`:''}{item.pallets?` · ${item.pallets}plt`:''}</span>
                {item.rate&&<span className="font-semibold flex-shrink-0">₹{((parseFloat(item.quantity)||0)*(parseFloat(item.rate)||0)).toLocaleString('en-IN')}</span>}
              </div>
            ))}
          </div>
          {total>0&&<div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-2"><span>Total</span><span>₹{total.toLocaleString('en-IN')}</span></div>}
          {threeC&&<div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-[11px] text-amber-700 font-medium">Prints 3 copies: Original / Duplicate / Triplicate</div>}
        </div>
      </div>
    </div>
  )
}

// ── Quote Modal ───────────────────────────────────────────────────────────────
function QuoteModal({ challan, customer, items, agencies, quotes, onClose, onRefresh }) {
  const [localQ, setLocalQ] = useState(() => {
    const m = {}
    quotes.forEach(q=>{ m[q.agency_id]={ amount:q.quoted_amount||'', notes:q.notes||'', sent:q.enquiry_sent, id:q.id, selected:q.is_selected } })
    return m
  })
  const [saving, setSaving] = useState(null)
  const [selecting, setSelecting] = useState(null)

  const message = buildMessage(challan, customer, items)
  const subject  = `Transport Enquiry — Indocable Industries — ${fmtDate(challan.date)}`

  function updQ(agId, k, v){ setLocalQ(p=>({...p,[agId]:{...p[agId]||{},[k]:v}})) }

  async function saveQuote(agId) {
    const q = localQ[agId]||{}
    setSaving(agId)
    const existing = quotes.find(x=>x.agency_id===agId)
    const payload = { quoted_amount:q.amount||null, notes:q.notes||null, enquiry_sent:true, enquiry_sent_at:new Date().toISOString() }
    if (existing) await supabase.from('transport_quotes').update(payload).eq('id',existing.id)
    else await supabase.from('transport_quotes').insert({ dispatch_id:challan.id, agency_id:agId, ...payload })
    updQ(agId,'sent',true)
    setSaving(null)
    toast.success('Quote saved')
  }

  async function selectQuote(agId, amount) {
    setSelecting(agId)
    await supabase.from('transport_quotes').update({is_selected:false}).eq('dispatch_id',challan.id)
    const existing = quotes.find(x=>x.agency_id===agId)
    if (existing) await supabase.from('transport_quotes').update({is_selected:true}).eq('id',existing.id)
    else await supabase.from('transport_quotes').insert({ dispatch_id:challan.id, agency_id:agId, is_selected:true, quoted_amount:amount||null, enquiry_sent:true })
    await supabase.from('dispatch_orders').update({ selected_agency_id:agId, agreed_rate:amount||null, status:'dispatched' }).eq('id',challan.id)
    toast.success('Agency selected — challan marked as Dispatched')
    setSelecting(null)
    onRefresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <div className="font-bold text-slate-800">Request Transport Quotes</div>
            <div className="text-[12px] text-slate-400 mt-0.5">{challan.challan_number} · {customer?.name}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"><X size={16}/></button>
        </div>

        {challan.destination_address&&(
          <div className="mx-5 mt-4 px-4 py-3 bg-slate-50 rounded-xl flex items-start gap-2 text-sm">
            <MapPin size={14} className="text-slate-400 mt-0.5 flex-shrink-0"/>
            <span className="text-slate-600"><strong>Delivery to:</strong> {challan.destination_address}</span>
          </div>
        )}

        {agencies.length===0
          ? <div className="p-8 text-center text-slate-400 text-sm">No transport agencies added. Add them in the Transport tab first.</div>
          : <div className="p-5 space-y-3">
              {agencies.map(ag=>{
                const q = localQ[ag.id]||{}
                const isSelected = quotes.find(x=>x.agency_id===ag.id&&x.is_selected)
                return (
                  <div key={ag.id} className={`border rounded-2xl p-4 transition-all ${isSelected?'border-emerald-300 bg-emerald-50':'border-slate-200 bg-white'}`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient(ag.name)} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white text-[11px] font-bold">{ag.name.slice(0,2).toUpperCase()}</span>
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            {ag.name} {isSelected&&<CheckCircle2 size={14} className="text-emerald-500"/>}
                          </div>
                          {ag.contact_person&&<div className="text-[11px] text-slate-400">{ag.contact_person}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {ag.phone&&(
                          <a href={`https://wa.me/${fmtWA(ag.phone)}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"
                            onClick={()=>updQ(ag.id,'sent',true)}
                            className="flex items-center gap-1 text-[11px] font-semibold bg-green-50 text-green-700 border border-green-200 px-2.5 py-1.5 rounded-xl hover:bg-green-100 cursor-pointer">
                            <MessageSquare size={11}/> WhatsApp
                          </a>
                        )}
                        {ag.email&&(
                          <a href={`mailto:${ag.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}
                            onClick={()=>updQ(ag.id,'sent',true)}
                            className="flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-xl hover:bg-blue-100 cursor-pointer">
                            <Mail size={11}/> Email
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">Quoted Rate (₹)</label>
                        <input type="number" min="0" value={q.amount||''} onChange={e=>updQ(ag.id,'amount',e.target.value)}
                          placeholder="Enter quote amount…"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">Notes</label>
                        <input value={q.notes||''} onChange={e=>updQ(ag.id,'notes',e.target.value)} placeholder="Delivery time, conditions…"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={()=>saveQuote(ag.id)} disabled={saving===ag.id}
                        className="flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-xl hover:bg-slate-200 cursor-pointer disabled:opacity-50">
                        {saving===ag.id?<RefreshCw size={10} className="animate-spin"/>:<Save size={10}/>} Save Quote
                      </button>
                      {q.amount&&(
                        <button onClick={()=>selectQuote(ag.id,q.amount)} disabled={selecting===ag.id}
                          className={`flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-xl cursor-pointer disabled:opacity-50 ${isSelected?'bg-emerald-100 text-emerald-700 border border-emerald-300':'bg-brand-500 text-white hover:bg-brand-600'}`}>
                          {selecting===ag.id?<RefreshCw size={10} className="animate-spin"/>:<Star size={10}/>}
                          {isSelected?'Selected ✓':'Select This Quote'}
                        </button>
                      )}
                      {q.sent&&<span className="text-[10px] text-emerald-600 font-semibold ml-1">Enquiry sent ✓</span>}
                    </div>
                  </div>
                )
              })}
            </div>
        }
        <div className="px-5 pb-5 flex justify-end border-t border-slate-100 pt-4 mt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 cursor-pointer">Close</button>
        </div>
      </div>
    </div>
  )
}

// ── Challan Modal (create / edit) ─────────────────────────────────────────────
function ChallanModal({ mode, challan, customers, prodOrders, profile, onSave, onClose }) {
  const isEdit = mode==='edit'
  const origStatus = isEdit ? challan.status : 'draft'
  const [form, setForm] = useState(isEdit ? {
    customer_id:challan.customer_id||'', date:challan.date||new Date().toISOString().slice(0,10),
    vehicle_number:challan.vehicle_number||'', driver_name:challan.driver_name||'',
    notes:challan.notes||'', status:challan.status||'draft',
    destination_address:challan.destination_address||'',
    eway_bill_number:challan.eway_bill_number||'',
    lr_number:challan.lr_number||'',
  } : {
    customer_id:'', date:new Date().toISOString().slice(0,10),
    vehicle_number:'', driver_name:'', notes:'', status:'draft', destination_address:'',
    eway_bill_number:'', lr_number:'',
  })
  const [items, setItems] = useState(()=>
    isEdit&&challan.dispatch_items?.length
      ? challan.dispatch_items.map(i=>({ id:i.id, description:i.description, quantity:String(i.quantity), unit:i.unit, weight:i.weight?String(i.weight):'', rate:i.rate?String(i.rate):'', hsn_code:i.hsn_code||'', pallets:i.pallets?String(i.pallets):'', production_order_id:i.production_order_id||'' }))
      : [{...EMPTY_ITEM}]
  )
  const [saving, setSaving] = useState(false)

  const setF = (k,v) => setForm(f=>({...f,[k]:v}))
  function setItem(i,k,v){
    setItems(p=>p.map((item,idx)=>{
      if(idx!==i) return item
      const u={...item,[k]:v}
      if(k==='production_order_id'&&v){ const po=prodOrders.find(p=>p.id===v); if(po) u.description=`${po.product_name} (${po.order_number})` }
      return u
    }))
  }

  async function handleSave() {
    if(!form.customer_id){ toast.error('Select a customer'); return }
    if(STATUS_ORDER[form.status] < STATUS_ORDER[origStatus] && !confirm(`Moving status backwards from ${origStatus.toUpperCase()} to ${form.status.toUpperCase()}. Are you sure?`)) return
    const valid = items.filter(i=>i.description.trim()&&parseFloat(i.quantity)>0)
    if(!valid.length){ toast.error('Add at least one item with description and quantity'); return }
    setSaving(true)
    try {
      const payload = {
        customer_id:form.customer_id, date:form.date, status:form.status,
        vehicle_number:form.vehicle_number||null, driver_name:form.driver_name||null,
        notes:form.notes||null, destination_address:form.destination_address||null,
        eway_bill_number:form.eway_bill_number||null,
        lr_number:form.lr_number||null,
      }
      const mkItems = (dispatch_id) => valid.map(i=>({
        dispatch_id, description:i.description.trim(),
        quantity:parseFloat(i.quantity), unit:i.unit,
        weight:parseFloat(i.weight)||null,
        rate:parseFloat(i.rate)||0,
        hsn_code:i.hsn_code||null,
        pallets:parseInt(i.pallets)||null,
        amount:(parseFloat(i.quantity)||0)*(parseFloat(i.rate)||0),
        production_order_id:i.production_order_id||null,
      }))
      if(isEdit){
        const {error} = await supabase.from('dispatch_orders').update(payload).eq('id',challan.id)
        if(error) throw error
        await supabase.from('dispatch_items').delete().eq('dispatch_id',challan.id)
        await supabase.from('dispatch_items').insert(mkItems(challan.id))
        toast.success('Challan updated')
      } else {
        const challanNo = await genChallanNo()
        const {data:ch,error} = await supabase.from('dispatch_orders').insert({...payload, challan_number:challanNo, created_by:profile.id}).select().single()
        if(error) throw error
        await supabase.from('dispatch_items').insert(mkItems(ch.id))
        toast.success(`Challan ${challanNo} created`)
      }
      onSave()
    } catch(err){ toast.error(err.message) }
    setSaving(false)
  }

  const total = items.reduce((s,i)=>(s+(parseFloat(i.quantity)||0)*(parseFloat(i.rate)||0)),0)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <span className="font-bold text-slate-800 text-[16px]">{isEdit?`Edit — ${challan.challan_number}`:'New Delivery Challan'}</span>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"><X size={16}/></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Status</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS).map(([k,v])=>(
                <button key={k} onClick={()=>setF('status',k)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${form.status===k?v.cls:'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Customer *</label>
              <select value={form.customer_id} onChange={e=>setF('customer_id',e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500">
                <option value="">Select customer…</option>
                {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Delivery Address</label>
              <textarea value={form.destination_address} onChange={e=>setF('destination_address',e.target.value)}
                placeholder="Full delivery / consignment destination address…" rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date</label>
              <input type="date" value={form.date} onChange={e=>setF('date',e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Vehicle Number</label>
              <input value={form.vehicle_number} onChange={e=>setF('vehicle_number',e.target.value)} placeholder="e.g. MH 12 AB 1234"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Driver Name</label>
              <input value={form.driver_name} onChange={e=>setF('driver_name',e.target.value)} placeholder="Driver name"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes</label>
              <input value={form.notes} onChange={e=>setF('notes',e.target.value)} placeholder="Special instructions…"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">LR Number</label>
              <input value={form.lr_number} onChange={e=>setF('lr_number',e.target.value)} placeholder="Lorry Receipt No. from transporter"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">E-Way Bill No.</label>
              <input value={form.eway_bill_number} onChange={e=>setF('eway_bill_number',e.target.value)} placeholder="12-digit e.g. 331234567890"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
            </div>
          </div>

          {/* Items table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Items *</div>
              <button onClick={()=>setItems(p=>[...p,{...EMPTY_ITEM}])}
                className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 cursor-pointer flex items-center gap-1">
                <Plus size={11}/> Add Row
              </button>
            </div>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide gap-2">
                <div className="flex-1">Description</div>
                <div className="w-16 flex-shrink-0">HSN</div>
                <div className="w-14 flex-shrink-0">Qty</div>
                <div className="w-16 flex-shrink-0">Unit</div>
                <div className="w-14 flex-shrink-0">Wt/unit</div>
                <div className="w-14 flex-shrink-0">Pallets</div>
                <div className="w-16 flex-shrink-0">Rate ₹</div>
                <div className="w-6 flex-shrink-0"/>
              </div>
              {items.map((item,i)=>(
                <div key={i} className="flex border-t border-slate-100 items-center gap-2 px-3 py-2">
                  <div className="flex-1 space-y-1 min-w-0">
                    {prodOrders.length>0&&(
                      <select value={item.production_order_id} onChange={e=>setItem(i,'production_order_id',e.target.value)}
                        className="w-full bg-slate-50 rounded-lg px-2 py-1 text-[10px] focus:outline-none text-slate-400 border-0">
                        <option value="">Link production order…</option>
                        {prodOrders.map(p=><option key={p.id} value={p.id}>{p.order_number} — {p.product_name}</option>)}
                      </select>
                    )}
                    <input value={item.description} onChange={e=>setItem(i,'description',e.target.value)} placeholder="Product / goods description"
                      className="w-full px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 rounded-lg border-0"/>
                  </div>
                  <input value={item.hsn_code} onChange={e=>setItem(i,'hsn_code',e.target.value)} placeholder="HSN"
                    className="w-16 flex-shrink-0 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
                  <input type="number" min="0.001" step="0.001" value={item.quantity} onChange={e=>setItem(i,'quantity',e.target.value)} placeholder="0"
                    className="w-14 flex-shrink-0 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
                  <select value={item.unit} onChange={e=>setItem(i,'unit',e.target.value)}
                    className="w-16 flex-shrink-0 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500">
                    {UNITS.map(u=><option key={u}>{u}</option>)}
                  </select>
                  <input type="number" min="0" step="0.01" value={item.weight} onChange={e=>setItem(i,'weight',e.target.value)} placeholder="kg"
                    className="w-14 flex-shrink-0 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
                  <input type="number" min="0" step="1" value={item.pallets} onChange={e=>setItem(i,'pallets',e.target.value)} placeholder="0"
                    className="w-14 flex-shrink-0 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
                  <input type="number" min="0" step="0.01" value={item.rate} onChange={e=>setItem(i,'rate',e.target.value)} placeholder="₹"
                    className="w-16 flex-shrink-0 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
                  <button onClick={()=>setItems(p=>p.filter((_,idx)=>idx!==i))}
                    className="w-6 flex-shrink-0 text-slate-300 hover:text-red-500 cursor-pointer p-0.5 rounded flex items-center justify-center">
                    <Trash2 size={13}/>
                  </button>
                </div>
              ))}
              {total>0&&(
                <div className="border-t-2 border-slate-200 bg-slate-50 px-3 py-2 flex justify-end">
                  <span className="text-sm font-bold text-slate-700">Total: ₹{total.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 cursor-pointer">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 bg-brand-500 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-brand-600 disabled:opacity-60 cursor-pointer">
            {saving?<RefreshCw size={13} className="animate-spin"/>:<Save size={13}/>} {isEdit?'Save Changes':'Create Challan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Agency Modal ──────────────────────────────────────────────────────────────
function AgencyModal({ agency, onSave, onClose }) {
  const [form, setForm] = useState(agency
    ? { name:agency.name, contact_person:agency.contact_person||'', phone:agency.phone||'', email:agency.email||'', address:agency.address||'', notes:agency.notes||'' }
    : { name:'', contact_person:'', phone:'', email:'', address:'', notes:'' }
  )
  const [saving, setSaving] = useState(false)
  const setF = (k,v) => setForm(f=>({...f,[k]:v}))

  async function handleSave() {
    if(!form.name.trim()){ toast.error('Agency name required'); return }
    setSaving(true)
    const payload = { name:form.name.trim(), contact_person:form.contact_person||null, phone:form.phone||null, email:form.email||null, address:form.address||null, notes:form.notes||null }
    const {error} = agency
      ? await supabase.from('transport_agencies').update(payload).eq('id',agency.id)
      : await supabase.from('transport_agencies').insert(payload)
    setSaving(false)
    if(error){ toast.error(error.message); return }
    toast.success(agency?'Agency updated':'Agency added')
    onSave()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <span className="font-bold text-slate-800">{agency?'Edit Agency':'Add Transport Agency'}</span>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"><X size={16}/></button>
        </div>
        <div className="p-5 space-y-3">
          {[
            {k:'name',label:'Agency Name *',ph:'e.g. Sharma Transport Co.'},
            {k:'contact_person',label:'Contact Person',ph:'e.g. Ramesh Sharma'},
            {k:'phone',label:'Phone / WhatsApp (10-digit or with +91)',ph:'9876543210'},
            {k:'email',label:'Email',ph:'info@transport.com'},
            {k:'address',label:'Address',ph:'Office address…'},
            {k:'notes',label:'Notes',ph:'e.g. Best for Mumbai routes, handles oversized loads'},
          ].map(f=>(
            <div key={f.k}>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">{f.label}</label>
              <input value={form[f.k]} onChange={e=>setF(f.k,e.target.value)} placeholder={f.ph}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 cursor-pointer">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 bg-brand-500 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-brand-600 disabled:opacity-60 cursor-pointer">
            {saving?<RefreshCw size={13} className="animate-spin"/>:<Save size={13}/>} Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Customer Modal ────────────────────────────────────────────────────────────
function CustomerModal({ customer, onSave, onClose }) {
  const [form, setForm] = useState(customer
    ? { name:customer.name, phone:customer.phone||'', email:customer.email||'', address:customer.address||'', gst_number:customer.gst_number||'' }
    : { name:'', phone:'', email:'', address:'', gst_number:'' }
  )
  const [saving, setSaving] = useState(false)
  const setF = (k,v) => setForm(f=>({...f,[k]:v}))

  async function handleSave() {
    if(!form.name.trim()){ toast.error('Customer name required'); return }
    setSaving(true)
    const payload = { name:form.name.trim(), phone:form.phone||null, email:form.email||null, address:form.address||null, gst_number:form.gst_number||null }
    const {error} = customer
      ? await supabase.from('customers').update(payload).eq('id',customer.id)
      : await supabase.from('customers').insert(payload)
    setSaving(false)
    if(error){ toast.error(error.message); return }
    toast.success(customer?'Customer updated':'Customer added')
    onSave()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <span className="font-bold text-slate-800">{customer?'Edit Customer':'Add Customer'}</span>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"><X size={16}/></button>
        </div>
        <div className="p-5 space-y-3">
          {[{k:'name',label:'Company / Name *',ph:'e.g. Rahul Electricals'},{k:'phone',label:'Phone',ph:'9876543210'},{k:'email',label:'Email',ph:'accounts@company.com'},{k:'gst_number',label:'GST Number',ph:'27AABCU9603R1ZX'}].map(f=>(
            <div key={f.k}>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">{f.label}</label>
              <input value={form[f.k]} onChange={e=>setF(f.k,e.target.value)} placeholder={f.ph}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Address</label>
            <textarea value={form.address} onChange={e=>setF('address',e.target.value)} placeholder="Full address…" rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"/>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 cursor-pointer">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 bg-brand-500 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-brand-600 disabled:opacity-60 cursor-pointer">
            {saving?<RefreshCw size={13} className="animate-spin"/>:<Save size={13}/>} Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dispatch({ profile }) {
  const [tab, setTab] = useState('challans')
  const [challans, setChallans]   = useState([])
  const [customers, setCustomers] = useState([])
  const [agencies, setAgencies]   = useState([])
  const [prodOrders, setProdOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  const [challanModal, setChallanModal]   = useState(null)
  const [quoteModal, setQuoteModal]       = useState(null)
  const [agencyModal, setAgencyModal]     = useState(null)
  const [customerModal, setCustomerModal] = useState(null)
  const [printChallan, setPrintChallan]   = useState(null)

  const canManage = ['owner','admin'].includes(profile.role)

  useEffect(()=>{ fetchAll() },[])

  async function fetchAll() {
    setLoading(true)
    try {
      const [{ data:chData, error:e1 },{ data:cuData },{ data:agData },{ data:poData }] = await Promise.all([
        supabase.from('dispatch_orders').select('*, dispatch_items(*), transport_quotes(*)').order('created_at',{ascending:false}),
        supabase.from('customers').select('*').order('name'),
        supabase.from('transport_agencies').select('*').order('name'),
        supabase.from('production_orders').select('id,order_number,product_name').order('order_number'),
      ])
      if(e1) throw e1
      setChallans(chData||[])
      setCustomers(cuData||[])
      setAgencies(agData||[])
      setProdOrders(poData||[])
    } catch(err){ toast.error('Failed to load data: '+err.message) }
    setLoading(false)
  }

  const custMap   = useMemo(()=>Object.fromEntries(customers.map(c=>[c.id,c])),[customers])
  const agencyMap = useMemo(()=>Object.fromEntries(agencies.map(a=>[a.id,a])),[agencies])

  const stats = useMemo(()=>({
    total:      challans.length,
    draft:      challans.filter(c=>c.status==='draft').length,
    dispatched: challans.filter(c=>c.status==='dispatched').length,
    delivered:  challans.filter(c=>c.status==='delivered').length,
    cancelled:  challans.filter(c=>c.status==='cancelled').length,
  }),[challans])

  const filtered = useMemo(()=>challans.filter(ch=>{
    const cust = custMap[ch.customer_id]
    const q = search.toLowerCase()
    const matchSearch = !search ||
      ch.challan_number?.toLowerCase().includes(q) ||
      cust?.name?.toLowerCase().includes(q) ||
      ch.vehicle_number?.toLowerCase().includes(q) ||
      ch.destination_address?.toLowerCase().includes(q) ||
      ch.driver_name?.toLowerCase().includes(q)
    return matchSearch && (filterStatus==='all' || ch.status===filterStatus)
  }),[challans,custMap,search,filterStatus])

  async function updateStatus(id, status) {
    const {error} = await supabase.from('dispatch_orders').update({status}).eq('id',id)
    if(error){ toast.error(error.message); return }
    setChallans(c=>c.map(ch=>ch.id===id?{...ch,status}:ch))
    toast.success(`Marked as ${status}`)
  }

  async function deleteChallan(id, no) {
    if(!confirm(`Delete challan ${no}? This cannot be undone.`)) return
    await supabase.from('dispatch_orders').delete().eq('id',id)
    setChallans(c=>c.filter(ch=>ch.id!==id))
    toast.success('Challan deleted')
  }

  async function deleteAgency(id) {
    if(!confirm('Delete this transport agency?')) return
    await supabase.from('transport_agencies').delete().eq('id',id)
    setAgencies(a=>a.filter(ag=>ag.id!==id))
    toast.success('Deleted')
  }

  async function deleteCustomer(id) {
    if(!confirm('Delete this customer?')) return
    await supabase.from('customers').delete().eq('id',id)
    setCustomers(c=>c.filter(cu=>cu.id!==id))
    toast.success('Deleted')
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
            <Truck size={20} className="text-blue-600"/>
          </div>
          <div>
            <h1 className="page-header">Dispatch</h1>
            <p className="page-sub">Challans · Transport agencies · Delivery management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAll} className="btn-ghost px-2.5">
            <RefreshCw size={15} className={loading?'animate-spin':''}/>
          </button>
          {canManage && tab==='challans' && (
            <button onClick={()=>setChallanModal({mode:'new'})} className="btn-primary">
              <Plus size={14}/> New Challan
            </button>
          )}
          {canManage && tab==='agencies' && (
            <button onClick={()=>setAgencyModal({})} className="btn-primary">
              <Plus size={14}/> Add Agency
            </button>
          )}
          {canManage && tab==='customers' && (
            <button onClick={()=>setCustomerModal({})} className="btn-primary">
              <Plus size={14}/> Add Customer
            </button>
          )}
        </div>
      </div>

      {/* Stats (challans tab) */}
      {tab==='challans' && !loading && (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 mb-5">
          {[
            {label:'Total',value:stats.total,cls:'text-slate-700',filter:'all'},
            {label:'Draft',value:stats.draft,cls:'text-slate-500',filter:'draft'},
            {label:'Dispatched',value:stats.dispatched,cls:'text-blue-600',filter:'dispatched'},
            {label:'Delivered',value:stats.delivered,cls:'text-emerald-600',filter:'delivered'},
            ...(stats.cancelled>0?[{label:'Cancelled',value:stats.cancelled,cls:'text-red-500',filter:'cancelled'}]:[]),
          ].map(s=>(
            <button key={s.label} onClick={()=>setFilterStatus(s.filter)}
              className={`card px-4 py-3 text-left transition-all cursor-pointer ${filterStatus===s.filter?'border-brand-300 shadow-card-hover':'hover:shadow-card-hover hover:-translate-y-0.5'}`}>
              <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit mb-5">
        {[{key:'challans',icon:Truck,label:'Challans'},{key:'agencies',icon:Building2,label:'Transport'},{key:'customers',icon:Users,label:'Customers'}].map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${tab===t.key?'bg-white shadow-sm text-slate-900':'text-slate-500 hover:text-slate-700'}`}>
            <t.icon size={14}/>{t.label}
          </button>
        ))}
      </div>

      {loading
        ? (
          <div className="space-y-3">
            {[...Array(3)].map((_,i)=>(
              <div key={i} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="skeleton h-3.5 w-24 rounded-md"/>
                      <div className="skeleton h-5 w-20 rounded-lg"/>
                    </div>
                    <div className="skeleton h-5 w-40 rounded-md"/>
                    <div className="flex gap-3">
                      <div className="skeleton h-4 w-20 rounded-md"/>
                      <div className="skeleton h-4 w-32 rounded-md"/>
                    </div>
                  </div>
                  <div className="skeleton h-8 w-20 rounded-xl"/>
                </div>
              </div>
            ))}
          </div>
        ) : (
        <>
          {/* ── CHALLANS ──────────────────────────────────────────────────── */}
          {tab==='challans' && (
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="flex-1 min-w-[200px] relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input value={search} onChange={e=>setSearch(e.target.value)}
                    placeholder="Search by challan no., customer, destination, vehicle…"
                    className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"/>
                  {search&&<button onClick={()=>setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 cursor-pointer"><X size={13}/></button>}
                </div>
                <div className="flex gap-1">
                  {['all','draft','dispatched','delivered','cancelled'].map(s=>(
                    <button key={s} onClick={()=>setFilterStatus(s)}
                      className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${filterStatus===s?(s==='all'?'bg-slate-800 text-white border-slate-800':STATUS[s]?.cls):'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {filtered.length===0 ? (
                  <div className="card p-12 text-center">
                    <Truck size={40} className="mx-auto text-slate-300 mb-3"/>
                    <div className="text-slate-600 font-semibold">{challans.length===0?'No challans yet':'No results found'}</div>
                    <div className="text-slate-400 text-sm mt-1">{challans.length===0?'Create your first delivery challan.':'Try a different search or filter.'}</div>
                  </div>
                ) : filtered.map(ch=>{
                  const cust   = custMap[ch.customer_id]
                  const items  = ch.dispatch_items||[]
                  const total  = items.reduce((s,i)=>s+(parseFloat(i.amount)||0),0)
                  const agency = ch.selected_agency_id ? agencyMap[ch.selected_agency_id] : null
                  const sCfg   = STATUS[ch.status]||STATUS.draft
                  const qCount = (ch.transport_quotes||[]).length
                  return (
                    <div key={ch.id} className="card p-5 hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-mono text-[11px] text-slate-400 font-semibold">{ch.challan_number}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${sCfg.cls}`}>{sCfg.label}</span>
                            {qCount>0&&<span className="text-[10px] text-violet-600 font-semibold bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-lg">{qCount} quote{qCount!==1?'s':''}</span>}
                            {ch.eway_bill_number
                              ? <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">EWB: {ch.eway_bill_number}</span>
                              : (total>50000||ch.status==='dispatched')&&<a href="https://ewaybillgst.gov.in" target="_blank" rel="noreferrer" className="text-[10px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg hover:bg-amber-100">+ E-Way Bill</a>
                            }
                          </div>
                          <div className="font-bold text-slate-800 text-[15px]">{cust?.name||'Unknown Customer'}</div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[12px] text-slate-500">
                            <span>{fmtDate(ch.date)}</span>
                            {ch.destination_address&&<span className="flex items-center gap-0.5 max-w-[240px] truncate"><MapPin size={10} className="flex-shrink-0"/> {ch.destination_address.split('\n')[0]}</span>}
                          </div>
                          {(agency||ch.vehicle_number||ch.driver_name||ch.lr_number)&&(
                            <div className="flex flex-wrap items-center gap-x-3 mt-0.5 text-[12px] text-slate-400">
                              {agency&&<span>via {agency.name}</span>}
                              {ch.vehicle_number&&<span>{ch.vehicle_number}</span>}
                              {ch.driver_name&&<span>{ch.driver_name}</span>}
                              {ch.lr_number&&<span className="font-medium text-slate-500">LR: {ch.lr_number}</span>}
                              {ch.agreed_rate&&<span className="text-slate-600 font-semibold">Freight ₹{Number(ch.agreed_rate).toLocaleString('en-IN')}</span>}
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {items.slice(0,3).map((it,i)=>(
                              <span key={i} className="text-[11px] bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg text-slate-600">
                                {it.description} × {it.quantity} {it.unit}{it.weight?` · ${it.weight}kg/unit`:''}{it.pallets?` · ${it.pallets}plt`:''}
                              </span>
                            ))}
                            {items.length>3&&<span className="text-[11px] text-slate-400">+{items.length-3} more</span>}
                            {total>0&&<span className="text-[11px] font-semibold text-slate-700 ml-1">₹{total.toLocaleString('en-IN')}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                          <button onClick={()=>setPrintChallan(ch)} title="Print"
                            className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors">
                            <Printer size={14}/>
                          </button>
                          {canManage&&(
                            <>
                              <button onClick={()=>setChallanModal({mode:'edit',challan:ch})} title="Edit"
                                className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors">
                                <Edit2 size={14}/>
                              </button>
                              {ch.status==='draft'&&(
                                <button onClick={()=>setQuoteModal(ch)}
                                  className="flex items-center gap-1 text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-200 px-2.5 py-1.5 rounded-xl hover:bg-violet-100 cursor-pointer">
                                  <Send size={11}/> Get Quotes
                                </button>
                              )}
                              {ch.status==='draft'&&(
                                <button onClick={()=>updateStatus(ch.id,'dispatched')}
                                  className="flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-xl hover:bg-blue-100 cursor-pointer">
                                  <Truck size={11}/> Dispatch
                                </button>
                              )}
                              {ch.status==='dispatched'&&(
                                <button onClick={()=>updateStatus(ch.id,'delivered')}
                                  className="flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-xl hover:bg-emerald-100 cursor-pointer">
                                  <CheckCircle2 size={11}/> Delivered
                                </button>
                              )}
                              <button onClick={()=>deleteChallan(ch.id,ch.challan_number)}
                                className="p-2 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 cursor-pointer transition-colors">
                                <Trash2 size={14}/>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── TRANSPORT AGENCIES ──────────────────────────────────────── */}
          {tab==='agencies' && (
            <div className="space-y-2">
              {agencies.length===0 ? (
                <div className="card p-12 text-center">
                  <Building2 size={40} className="mx-auto text-slate-300 mb-3"/>
                  <div className="text-slate-600 font-semibold mb-1">No transport agencies yet</div>
                  <div className="text-slate-400 text-sm">Add agencies to request quotes via WhatsApp and email when creating challans.</div>
                </div>
              ) : agencies.map(ag=>(
                <div key={ag.id} className="card px-5 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient(ag.name)} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white text-[11px] font-bold">{ag.name.slice(0,2).toUpperCase()}</span>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">{ag.name}</div>
                      <div className="text-[12px] text-slate-400 flex flex-wrap gap-3 mt-0.5">
                        {ag.contact_person&&<span>{ag.contact_person}</span>}
                        {ag.phone&&<span className="flex items-center gap-1"><Phone size={10}/>{ag.phone}</span>}
                        {ag.email&&<span className="flex items-center gap-1"><Mail size={10}/>{ag.email}</span>}
                      </div>
                      {ag.notes&&<div className="text-[11px] text-slate-400 mt-0.5 italic">{ag.notes}</div>}
                    </div>
                  </div>
                  {canManage&&(
                    <div className="flex items-center gap-2">
                      <button onClick={()=>setAgencyModal(ag)} className="text-[12px] font-semibold text-slate-500 hover:text-slate-700 cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-100">Edit</button>
                      <button onClick={()=>deleteAgency(ag.id)} className="p-1.5 text-slate-300 hover:text-red-500 cursor-pointer transition-colors"><Trash2 size={13}/></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── CUSTOMERS ───────────────────────────────────────────────── */}
          {tab==='customers' && (
            <div className="space-y-2">
              {customers.length===0 ? (
                <div className="card p-12 text-center">
                  <Users size={40} className="mx-auto text-slate-300 mb-3"/>
                  <div className="text-slate-600 font-semibold">No customers yet</div>
                </div>
              ) : customers.map(cu=>{
                const cuC = challans.filter(c=>c.customer_id===cu.id)
                return (
                  <div key={cu.id} className="card px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient(cu.name)} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white text-[11px] font-bold">{cu.name.slice(0,2).toUpperCase()}</span>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">{cu.name}</div>
                        <div className="text-[12px] text-slate-400 flex flex-wrap gap-3 mt-0.5">
                          {cu.phone&&<span>{cu.phone}</span>}
                          {cu.gst_number&&<span>GST: {cu.gst_number}</span>}
                          {cu.address&&<span className="truncate max-w-[180px]">{cu.address}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {cuC.length>0&&(
                        <div className="text-right hidden sm:block">
                          <div className="text-[13px] font-bold text-slate-700">{cuC.length} challan{cuC.length!==1?'s':''}</div>
                          <div className="text-[11px] text-slate-400">{cuC.filter(c=>c.status==='delivered').length} delivered</div>
                        </div>
                      )}
                      {canManage&&(
                        <div className="flex items-center gap-2">
                          <button onClick={()=>setCustomerModal(cu)} className="text-[12px] font-semibold text-slate-500 hover:text-slate-700 cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-100">Edit</button>
                          <button onClick={()=>deleteCustomer(cu.id)} className="p-1.5 text-slate-300 hover:text-red-500 cursor-pointer transition-colors"><Trash2 size={13}/></button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {challanModal&&(
        <ChallanModal mode={challanModal.mode} challan={challanModal.challan} customers={customers}
          prodOrders={prodOrders} profile={profile}
          onSave={()=>{setChallanModal(null);fetchAll()}} onClose={()=>setChallanModal(null)}/>
      )}
      {quoteModal&&(
        <QuoteModal challan={quoteModal} customer={custMap[quoteModal.customer_id]}
          items={quoteModal.dispatch_items||[]} agencies={agencies}
          quotes={quoteModal.transport_quotes||[]}
          onClose={()=>setQuoteModal(null)} onRefresh={fetchAll}/>
      )}
      {agencyModal&&(
        <AgencyModal agency={agencyModal.id?agencyModal:null}
          onSave={()=>{setAgencyModal(null);fetchAll()}} onClose={()=>setAgencyModal(null)}/>
      )}
      {customerModal&&(
        <CustomerModal customer={customerModal.id?customerModal:null}
          onSave={()=>{setCustomerModal(null);fetchAll()}} onClose={()=>setCustomerModal(null)}/>
      )}
      {printChallan&&(
        <ChallanPrint challan={printChallan} customer={custMap[printChallan.customer_id]}
          items={printChallan.dispatch_items||[]}
          agency={printChallan.selected_agency_id?agencyMap[printChallan.selected_agency_id]:null}
          onClose={()=>setPrintChallan(null)}/>
      )}
    </div>
  )
}
