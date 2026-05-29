import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { confirmToast } from '../components/confirmToast'
import {
  Boxes, Plus, RefreshCw, X, Save, Trash2, Eye,
  PackagePlus, PackageMinus, RotateCcw, Truck, FileText,
  ChevronDown, Printer, AlertCircle
} from 'lucide-react'

function fmtDate(d) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' }
function fmtNum(n, dec = 2) { return Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: dec }) }
function genJWNumber(count) {
  const d = new Date()
  return `JW-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(count + 1).padStart(3, '0')}`
}

const STATUS_STYLE = {
  open:       'bg-blue-100 text-blue-700 border-blue-200',
  in_progress:'bg-amber-100 text-amber-700 border-amber-200',
  completed:  'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled:  'bg-red-100 text-red-600 border-red-200',
}

const UNITS = ['kg', 'mtr', 'pcs', 'coil', 'drum', 'roll', 'box', 'set', 'litre', 'ton']

// ── Material Balance for a JW Order ──────────────────────────────────────────
function computeBalance(receipts, consumption, returns) {
  const received = receipts.reduce((s, r) => {
    const key = r.material_name + '|' + r.unit
    s[key] = (s[key] || 0) + parseFloat(r.quantity)
    return s
  }, {})
  const consumed = consumption.reduce((s, c) => {
    const key = c.material_name + '|' + c.unit
    s[key] = (s[key] || 0) + parseFloat(c.quantity)
    return s
  }, {})
  const returned = returns.reduce((s, r) => {
    const key = r.material_name + '|' + r.unit
    s[key] = (s[key] || 0) + parseFloat(r.quantity)
    return s
  }, {})

  const allKeys = new Set([...Object.keys(received), ...Object.keys(consumed), ...Object.keys(returned)])
  return Array.from(allKeys).map(key => {
    const [name, unit] = key.split('|')
    const rec = received[key] || 0
    const con = consumed[key] || 0
    const ret = returned[key] || 0
    const balance = rec - con - ret
    return { name, unit, received: rec, consumed: con, returned: ret, balance }
  })
}

// ── Print Job Work Challan ────────────────────────────────────────────────────
function PrintJWChallan({ order, dispatch: dispatchList, onClose }) {
  function handlePrint() {
    const w = window.open('', '', 'width=900,height=700')
    w.document.write(`<html><head><title>Job Work Challan ${order.jw_number}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#1a1a1a;padding:32px;font-size:13px;}
      h1{font-size:22px;margin:0;font-weight:800;}
      .header{display:flex;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #333;}
      table{width:100%;border-collapse:collapse;margin-top:16px;}
      th{background:#f8f8f8;text-align:left;padding:8px 10px;font-size:11px;font-weight:700;text-transform:uppercase;color:#666;border-bottom:2px solid #e5e7eb;}
      td{padding:8px 10px;border-bottom:1px solid #f3f4f6;}
      .sign{display:flex;justify-content:space-between;margin-top:48px;}
      .sign span{display:block;margin-top:36px;border-top:1px solid #333;padding-top:4px;font-size:11px;color:#888;}
    </style></head><body>
    <div class="header">
      <div><h1>Indocable Industries</h1><div style="color:#666;font-size:12px;margin-top:2px">Job Work Delivery Challan</div></div>
      <div style="text-align:right">
        <div style="font-size:18px;font-weight:800;color:#f97316">${order.jw_number}</div>
        <div style="font-size:12px;color:#666;margin-top:4px">Client: ${order.client_name}</div>
      </div>
    </div>
    <div style="margin-bottom:20px">
      <strong>Product:</strong> ${order.product_description}<br/>
      ${order.client_gst ? `<strong>Client GST:</strong> ${order.client_gst}` : ''}
    </div>
    <table>
      <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th>Vehicle</th><th>Driver</th><th>Challan No</th><th>Date</th></tr></thead>
      <tbody>
        ${dispatchList.map((d, i) => `<tr>
          <td>${i + 1}</td><td>${d.description}</td><td>${d.quantity}</td><td>${d.unit}</td>
          <td>${d.vehicle_number || '—'}</td><td>${d.driver_name || '—'}</td>
          <td>${d.challan_number || '—'}</td><td>${fmtDate(d.dispatch_date)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="sign">
      <div style="text-align:center"><span>Client Signature</span></div>
      <div style="text-align:center"><span>Authorised Signatory</span></div>
    </div>
    <div style="text-align:center;margin-top:32px;font-size:10px;color:#bbb">Computer-generated challan.</div>
    </body></html>`)
    w.document.close()
    w.print()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
        <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-4">
          <Printer size={22} className="text-brand-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Print Challan</h3>
        <p className="text-sm text-gray-500 mb-6">{order.jw_number}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">Cancel</button>
          <button onClick={handlePrint} className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-600 cursor-pointer">Print</button>
        </div>
      </div>
    </div>
  )
}

// ── Record Modal (generic for receive / consume / return / dispatch) ───────────
function RecordModal({ title, icon: Icon, fields, onSave, onClose }) {
  const initial = fields.reduce((a, f) => ({ ...a, [f.key]: f.default ?? '' }), {})
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    const required = fields.filter(f => f.required)
    for (const f of required) {
      if (!form[f.key] && form[f.key] !== 0) { toast.error(`${f.label} is required`); return }
    }
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      toast.error(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">
            <Icon size={16} className="text-brand-600" />
          </div>
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 cursor-pointer"><X size={18} /></button>
        </div>
        <div className="px-6 py-4 space-y-3">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label}{f.required ? ' *' : ''}</label>
              {f.type === 'select' ? (
                <select value={form[f.key]} onChange={e => setField(f.key, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent">
                  {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea value={form[f.key]} onChange={e => setField(f.key, e.target.value)} rows={2}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none" />
              ) : (
                <input type={f.type || 'text'} value={form[f.key]} onChange={e => setField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
              )}
            </div>
          ))}
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

// ── JW Order Detail Modal ─────────────────────────────────────────────────────
function JWDetailModal({ order: initialOrder, onClose, onRefresh }) {
  const [order, setOrder] = useState(initialOrder)
  const [tab, setTab] = useState('ledger')
  const [receipts, setReceipts] = useState([])
  const [consumption, setConsumption] = useState([])
  const [returns, setReturns] = useState([])
  const [dispatches, setDispatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(null) // 'receive'|'consume'|'return'|'dispatch'
  const [showPrint, setShowPrint] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: r }, { data: c }, { data: ret }, { data: d }] = await Promise.all([
      supabase.from('jw_material_receipts').select('*').eq('jw_order_id', order.id).order('created_at'),
      supabase.from('jw_consumption').select('*').eq('jw_order_id', order.id).order('created_at'),
      supabase.from('jw_returns').select('*').eq('jw_order_id', order.id).order('created_at'),
      supabase.from('jw_dispatch').select('*').eq('jw_order_id', order.id).order('created_at'),
    ])
    setReceipts(r || [])
    setConsumption(c || [])
    setReturns(ret || [])
    setDispatches(d || [])
    setLoading(false)
  }

  async function updateStatus(status) {
    const { error } = await supabase.from('job_work_orders').update({ status }).eq('id', order.id)
    if (error) { toast.error(error.message); return }
    setOrder(o => ({ ...o, status }))
    toast.success(`Status updated to ${status}`)
    onRefresh()
  }

  async function deleteRow(table, id, label) {
    if (!await confirmToast(`Delete this ${label}?`)) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Deleted')
    fetchAll()
  }

  const balance = computeBalance(receipts, consumption, returns)

  const receiveFields = [
    { key: 'material_name', label: 'Material Name', required: true, placeholder: 'e.g. XLPE Compound' },
    { key: 'quantity', label: 'Quantity', type: 'number', required: true, placeholder: '0' },
    { key: 'unit', label: 'Unit', type: 'select', options: UNITS.map(u => ({ value: u, label: u })), default: 'kg' },
    { key: 'location', label: 'Storage Location', placeholder: 'e.g. Rack A-2, Bay 3' },
    { key: 'challan_number', label: 'Client Challan No.', placeholder: 'Optional' },
    { key: 'receipt_date', label: 'Receipt Date', type: 'date', required: true, default: new Date().toISOString().slice(0, 10) },
    { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Optional' },
  ]

  const consumeFields = [
    { key: 'material_name', label: 'Material Name', required: true, placeholder: 'Must match received material' },
    { key: 'quantity', label: 'Quantity Consumed', type: 'number', required: true, placeholder: '0' },
    { key: 'unit', label: 'Unit', type: 'select', options: UNITS.map(u => ({ value: u, label: u })), default: 'kg' },
    { key: 'consumed_date', label: 'Date', type: 'date', required: true, default: new Date().toISOString().slice(0, 10) },
    { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Optional' },
  ]

  const returnFields = [
    { key: 'material_name', label: 'Material Name', required: true, placeholder: 'Material being returned' },
    { key: 'quantity', label: 'Quantity Returned', type: 'number', required: true, placeholder: '0' },
    { key: 'unit', label: 'Unit', type: 'select', options: UNITS.map(u => ({ value: u, label: u })), default: 'kg' },
    { key: 'return_date', label: 'Return Date', type: 'date', required: true, default: new Date().toISOString().slice(0, 10) },
    { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Optional' },
  ]

  const dispatchFields = [
    { key: 'description', label: 'Description', required: true, placeholder: 'e.g. 1000 mtr XLPE Cable 4C×95 sqmm' },
    { key: 'quantity', label: 'Quantity', type: 'number', required: true, placeholder: '0' },
    { key: 'unit', label: 'Unit', type: 'select', options: UNITS.map(u => ({ value: u, label: u })), default: 'pcs' },
    { key: 'dispatch_date', label: 'Dispatch Date', type: 'date', required: true, default: new Date().toISOString().slice(0, 10) },
    { key: 'vehicle_number', label: 'Vehicle Number', placeholder: 'e.g. MH 04 AB 1234' },
    { key: 'driver_name', label: 'Driver Name', placeholder: 'Optional' },
    { key: 'challan_number', label: 'Outward Challan No.', placeholder: 'Optional' },
    { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Optional' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {showPrint && <PrintJWChallan order={order} dispatch={dispatches} onClose={() => setShowPrint(false)} />}

      {showModal === 'receive' && (
        <RecordModal title="Receive Material from Client" icon={PackagePlus} fields={receiveFields}
          onSave={async form => {
            const { error } = await supabase.from('jw_material_receipts').insert({ jw_order_id: order.id, ...form, quantity: parseFloat(form.quantity) })
            if (error) throw error
            toast.success('Material receipt recorded')
            fetchAll()
          }}
          onClose={() => setShowModal(null)} />
      )}
      {showModal === 'consume' && (
        <RecordModal title="Record Production Consumption" icon={PackageMinus} fields={consumeFields}
          onSave={async form => {
            const { error } = await supabase.from('jw_consumption').insert({ jw_order_id: order.id, ...form, quantity: parseFloat(form.quantity) })
            if (error) throw error
            toast.success('Consumption recorded')
            fetchAll()
          }}
          onClose={() => setShowModal(null)} />
      )}
      {showModal === 'return' && (
        <RecordModal title="Return Material to Client" icon={RotateCcw} fields={returnFields}
          onSave={async form => {
            const { error } = await supabase.from('jw_returns').insert({ jw_order_id: order.id, ...form, quantity: parseFloat(form.quantity) })
            if (error) throw error
            toast.success('Return recorded')
            fetchAll()
          }}
          onClose={() => setShowModal(null)} />
      )}
      {showModal === 'dispatch' && (
        <RecordModal title="Dispatch Finished Goods" icon={Truck} fields={dispatchFields}
          onSave={async form => {
            const { error } = await supabase.from('jw_dispatch').insert({ jw_order_id: order.id, ...form, quantity: parseFloat(form.quantity) })
            if (error) throw error
            toast.success('Dispatch recorded')
            fetchAll()
          }}
          onClose={() => setShowModal(null)} />
      )}

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">{order.jw_number}</h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLE[order.status]}`}>{order.status.replace('_', ' ')}</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{order.client_name} · {order.product_description}</p>
          </div>
          <div className="flex items-center gap-2">
            {dispatches.length > 0 && (
              <button onClick={() => setShowPrint(true)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl cursor-pointer"><Printer size={16} /></button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X size={20} /></button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-6 py-3 border-b border-gray-50 flex gap-2 flex-wrap">
          <button onClick={() => setShowModal('receive')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold hover:bg-emerald-100 cursor-pointer">
            <PackagePlus size={13} /> Receive Material
          </button>
          <button onClick={() => setShowModal('consume')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-semibold hover:bg-amber-100 cursor-pointer">
            <PackageMinus size={13} /> Record Consumption
          </button>
          <button onClick={() => setShowModal('return')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold hover:bg-blue-100 cursor-pointer">
            <RotateCcw size={13} /> Return to Client
          </button>
          <button onClick={() => setShowModal('dispatch')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-700 border border-brand-200 rounded-xl text-xs font-semibold hover:bg-brand-100 cursor-pointer">
            <Truck size={13} /> Dispatch Goods
          </button>
          <div className="ml-auto flex gap-2">
            {order.status === 'open' && (
              <button onClick={() => updateStatus('in_progress')}
                className="px-3 py-1.5 bg-amber-500 text-white rounded-xl text-xs font-semibold hover:bg-amber-600 cursor-pointer">
                Start Work
              </button>
            )}
            {order.status === 'in_progress' && (
              <button onClick={() => updateStatus('completed')}
                className="px-3 py-1.5 bg-emerald-500 text-white rounded-xl text-xs font-semibold hover:bg-emerald-600 cursor-pointer">
                Mark Complete
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3 border-b border-gray-100">
          {[['ledger', 'Material Ledger'], ['receipts', 'Receipts'], ['consumption', 'Consumption'], ['returns', 'Returns'], ['dispatch', 'Dispatch']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all cursor-pointer border-b-2 -mb-px ${tab === key ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? <div className="text-center py-10 text-gray-400 text-sm">Loading…</div> : (
            <>
              {/* Ledger Tab */}
              {tab === 'ledger' && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">Material balance: received − consumed − returned</p>
                  {balance.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">No material movements recorded yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-2 text-xs font-semibold text-gray-500">Material</th>
                            <th className="text-right py-2 text-xs font-semibold text-emerald-600">Received</th>
                            <th className="text-right py-2 text-xs font-semibold text-amber-600">Consumed</th>
                            <th className="text-right py-2 text-xs font-semibold text-blue-600">Returned</th>
                            <th className="text-right py-2 text-xs font-semibold text-gray-600">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {balance.map((row, i) => (
                            <tr key={i} className="border-b border-gray-50">
                              <td className="py-2.5 font-medium text-gray-800">{row.name} <span className="text-xs text-gray-400">({row.unit})</span></td>
                              <td className="py-2.5 text-right text-emerald-600 font-semibold">{fmtNum(row.received)}</td>
                              <td className="py-2.5 text-right text-amber-600 font-semibold">{fmtNum(row.consumed)}</td>
                              <td className="py-2.5 text-right text-blue-600 font-semibold">{fmtNum(row.returned)}</td>
                              <td className="py-2.5 text-right">
                                <span className={`font-bold ${row.balance < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                                  {fmtNum(row.balance)}
                                  {row.balance < 0 && <AlertCircle size={12} className="inline ml-1" />}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Receipts Tab */}
              {tab === 'receipts' && (
                <div className="space-y-2">
                  {receipts.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">No material receipts yet.</div> : (
                    receipts.map(r => (
                      <div key={r.id} className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                        <div>
                          <div className="font-semibold text-gray-800">{r.material_name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {fmtDate(r.receipt_date)} · {r.quantity} {r.unit}
                            {r.location && ` · 📍 ${r.location}`}
                            {r.challan_number && ` · Challan: ${r.challan_number}`}
                          </div>
                          {r.notes && <div className="text-xs text-gray-400 mt-0.5">{r.notes}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-700 font-bold text-sm">{r.quantity} {r.unit}</span>
                          <button onClick={() => deleteRow('jw_material_receipts', r.id, 'receipt')}
                            className="p-1 text-red-400 hover:text-red-600 cursor-pointer"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Consumption Tab */}
              {tab === 'consumption' && (
                <div className="space-y-2">
                  {consumption.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">No consumption recorded yet.</div> : (
                    consumption.map(c => (
                      <div key={c.id} className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                        <div>
                          <div className="font-semibold text-gray-800">{c.material_name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{fmtDate(c.consumed_date)} · {c.quantity} {c.unit}</div>
                          {c.notes && <div className="text-xs text-gray-400 mt-0.5">{c.notes}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-amber-700 font-bold text-sm">{c.quantity} {c.unit}</span>
                          <button onClick={() => deleteRow('jw_consumption', c.id, 'entry')}
                            className="p-1 text-red-400 hover:text-red-600 cursor-pointer"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Returns Tab */}
              {tab === 'returns' && (
                <div className="space-y-2">
                  {returns.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">No returns recorded yet.</div> : (
                    returns.map(r => (
                      <div key={r.id} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                        <div>
                          <div className="font-semibold text-gray-800">{r.material_name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{fmtDate(r.return_date)} · {r.quantity} {r.unit}</div>
                          {r.notes && <div className="text-xs text-gray-400 mt-0.5">{r.notes}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-blue-700 font-bold text-sm">{r.quantity} {r.unit}</span>
                          <button onClick={() => deleteRow('jw_returns', r.id, 'return entry')}
                            className="p-1 text-red-400 hover:text-red-600 cursor-pointer"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Dispatch Tab */}
              {tab === 'dispatch' && (
                <div className="space-y-2">
                  {dispatches.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">No dispatches yet.</div> : (
                    dispatches.map(d => (
                      <div key={d.id} className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
                        <div>
                          <div className="font-semibold text-gray-800">{d.description}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {fmtDate(d.dispatch_date)} · {d.quantity} {d.unit}
                            {d.vehicle_number && ` · ${d.vehicle_number}`}
                            {d.challan_number && ` · ${d.challan_number}`}
                          </div>
                          {d.notes && <div className="text-xs text-gray-400 mt-0.5">{d.notes}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-brand-700 font-bold text-sm">{d.quantity} {d.unit}</span>
                          <button onClick={() => deleteRow('jw_dispatch', d.id, 'dispatch entry')}
                            className="p-1 text-red-400 hover:text-red-600 cursor-pointer"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">Close</button>
        </div>
      </div>
    </div>
  )
}

// ── New JW Order Modal ────────────────────────────────────────────────────────
function NewJWModal({ onSave, onClose }) {
  const [form, setForm] = useState({
    client_name: '',
    client_phone: '',
    client_gst: '',
    product_description: '',
    order_date: new Date().toISOString().slice(0, 10),
    expected_date: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    if (!form.client_name.trim()) { toast.error('Client name required'); return }
    if (!form.product_description.trim()) { toast.error('Product description required'); return }

    setSaving(true)
    try {
      const { count } = await supabase.from('job_work_orders').select('id', { count: 'exact', head: true })
      const jw_number = genJWNumber(count || 0)

      const { error } = await supabase.from('job_work_orders').insert({
        jw_number,
        ...form,
        expected_date: form.expected_date || null,
        notes: form.notes || null,
      })
      if (error) throw error
      toast.success(`${jw_number} created`)
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
          <h2 className="text-lg font-bold text-gray-900">New Job Work Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X size={20} /></button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Client Name *</label>
              <input type="text" value={form.client_name} onChange={e => setField('client_name', e.target.value)}
                placeholder="Company / Person"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Client Phone</label>
              <input type="tel" value={form.client_phone} onChange={e => setField('client_phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Client GST</label>
              <input type="text" value={form.client_gst} onChange={e => setField('client_gst', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Product / Work Description *</label>
              <input type="text" value={form.product_description} onChange={e => setField('product_description', e.target.value)}
                placeholder="e.g. Manufacture 1000 mtr XLPE Cable 4C×95 sqmm"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
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
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} rows={2}
                placeholder="Special instructions, terms, etc."
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none" />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-brand-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-600 cursor-pointer disabled:opacity-50 flex items-center gap-2">
            <Save size={15} /> {saving ? 'Creating…' : 'Create Order'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function JobWork({ profile }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [showNew, setShowNew] = useState(false)
  const [detailOrder, setDetailOrder] = useState(null)

  useEffect(() => { fetchOrders() }, [])

  async function fetchOrders() {
    setLoading(true)
    const { data } = await supabase.from('job_work_orders').select('*').order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  const filtered = filterStatus === 'all' ? orders : orders.filter(o => o.status === filterStatus)

  const stats = {
    total: orders.length,
    open: orders.filter(o => o.status === 'open').length,
    in_progress: orders.filter(o => o.status === 'in_progress').length,
    completed: orders.filter(o => o.status === 'completed').length,
  }

  return (
    <div className="space-y-6">
      {showNew && <NewJWModal onSave={() => { setShowNew(false); fetchOrders() }} onClose={() => setShowNew(false)} />}
      {detailOrder && <JWDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} onRefresh={fetchOrders} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Job Work</h1>
          <p className="page-sub">Track sub-contract manufacturing from client material to finished goods</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchOrders} className="btn-ghost px-2.5"><RefreshCw size={16} /></button>
          <button onClick={() => setShowNew(true)} className="btn-primary">
            <Plus size={15} /> New Job Work
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Orders', value: stats.total, color: 'text-gray-900' },
          { label: 'Open', value: stats.open, color: 'text-blue-600' },
          { label: 'In Progress', value: stats.in_progress, color: 'text-amber-600' },
          { label: 'Completed', value: stats.completed, color: 'text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'open', 'in_progress', 'completed', 'cancelled'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-all ${filterStatus === s ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 flex items-start gap-2">
        <FileText size={16} className="flex-shrink-0 mt-0.5" />
        <div>
          <strong>How Job Work works:</strong> Client sends raw material → you receive it (with location) → use in production (consumption) → return unused material → dispatch finished goods back to client. The Material Ledger shows the running balance.
        </div>
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_,i) => (
            <div key={i} className="card p-5 flex items-center justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="skeleton h-4 w-24 rounded-md"/>
                  <div className="skeleton h-5 w-20 rounded-full"/>
                </div>
                <div className="skeleton h-5 w-40 rounded-md"/>
                <div className="skeleton h-4 w-56 rounded-md"/>
                <div className="skeleton h-3.5 w-36 rounded-md"/>
              </div>
              <div className="skeleton h-9 w-20 rounded-xl"/>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Boxes size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="font-semibold text-gray-500">No job work orders</p>
          <p className="text-sm text-gray-400 mt-1">Create an order when a client sends material for manufacturing</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => (
            <div key={order.id} className="card p-5 flex items-center justify-between hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-brand-600 text-sm">{order.jw_number}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLE[order.status]}`}>{order.status.replace('_', ' ')}</span>
                  {order.expected_date && new Date(order.expected_date) < new Date() && order.status !== 'completed' && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600 border border-red-200">Overdue</span>
                  )}
                </div>
                <div className="mt-1 font-semibold text-gray-800">{order.client_name}</div>
                <div className="text-sm text-gray-500 mt-0.5">{order.product_description}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {fmtDate(order.order_date)}{order.expected_date ? ` · Expected: ${fmtDate(order.expected_date)}` : ''}
                  {order.client_phone && ` · ${order.client_phone}`}
                </div>
              </div>
              <button onClick={() => setDetailOrder(order)}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium cursor-pointer ml-4">
                <Eye size={14} /> Open
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
