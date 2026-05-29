import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'
import { confirmToast } from '../components/confirmToast'
import {
  Factory, Plus, RefreshCw, X, Save, ChevronRight,
  Play, CheckCircle2, FlaskConical, XCircle, Package,
  Users, Clock, Calendar, AlertCircle, Trash2,
  PackageMinus, BarChart2, Layers
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUSES = {
  planned:     { label: 'Planned',     color: 'bg-slate-100 text-slate-700 border-slate-200',   dot: 'bg-slate-400' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800 border-blue-200',      dot: 'bg-blue-500' },
  qc:          { label: 'In QC',       color: 'bg-violet-100 text-violet-800 border-violet-200', dot: 'bg-violet-500' },
  done:        { label: 'Done',        color: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  cancelled:   { label: 'Cancelled',   color: 'bg-red-100 text-red-700 border-red-200',          dot: 'bg-red-400' },
}
const UNITS = ['pcs', 'kg', 'mtr', 'coil', 'drum', 'roll', 'box', 'set']
const GRADIENTS = ['from-brand-500 to-brand-700','from-emerald-500 to-teal-600','from-violet-500 to-purple-700','from-amber-500 to-orange-600','from-cyan-500 to-blue-600','from-rose-500 to-pink-600']
function gradient(s=''){let h=0;for(const c of s)h=((h<<5)-h)+c.charCodeAt(0);return GRADIENTS[Math.abs(h)%GRADIENTS.length]}
function initials(n=''){return n.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?'}
function fmtDate(d){return d?new Date(d+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'}):'—'}
function genOrderNumber(count) {
  const d = new Date()
  const ym = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
  return `PO-${ym}-${String(count+1).padStart(3,'0')}`
}

const EMPTY_FORM = {
  product_name: '', product_code: '', target_quantity: '', unit: 'pcs',
  machine_id: '', planned_date: '', notes: '',
}
const EMPTY_MAT_ROW = { material_id: '', material_name: '', planned_qty: '', unit: '' }

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUSES[status] || STATUSES.planned
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${s.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, max, color = 'bg-brand-500' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ProductionOrders({ profile }) {
  const canManage = ['owner','admin','production_head'].includes(profile.role)
  const canQC     = ['owner','admin','production_head','qc_inspector'].includes(profile.role)

  const [orders,    setOrders]    = useState([])
  const [employees, setEmployees] = useState([])
  const [machines,  setMachines]  = useState([])
  const [materials, setMaterials] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

  // New order modal
  const [showNewModal, setShowNewModal] = useState(false)
  const [form,         setForm]         = useState({ ...EMPTY_FORM })
  const [matRows,      setMatRows]      = useState([])
  const [opIds,        setOpIds]        = useState([]) // selected operator employee ids
  const [saving,       setSaving]       = useState(false)
  const [editOrder,    setEditOrder]    = useState(null)

  // Detail modal
  const [detailOrder, setDetailOrder] = useState(null)
  const [detailTab,   setDetailTab]   = useState('overview')
  const [outputForm,  setOutputForm]  = useState({ date: new Date().toISOString().slice(0,10), quantity: '', notes: '' })
  const [outputSaving,setOutputSaving]= useState(false)
  const [qcForm,      setQcForm]      = useState({ inspector_id: '', pass_qty: '', fail_qty: '', rework_qty: '', defect_notes: '' })
  const [qcSaving,    setQcSaving]    = useState(false)
  const [stockOutSaving, setStockOutSaving] = useState(false)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchMeta = useCallback(async () => {
    const [{ data: empData }, { data: machData }, { data: matData }] = await Promise.all([
      supabase.from('employees').select('id,full_name,position,department').eq('is_active',true).order('full_name'),
      supabase.from('machines').select('id,process_name,department').order('department').order('process_name'),
      supabase.from('materials').select('id,name,unit,current_stock').eq('is_active',true).order('name'),
    ])
    setEmployees(empData || [])
    setMachines(machData || [])
    setMaterials(matData || [])
  }, [])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('production_orders')
      .select(`
        *,
        production_order_operators(employee_id),
        production_order_materials(*),
        production_output(*),
        production_qc(*)
      `)
      .order('created_at', { ascending: false })
    if (error) console.error(error)
    setOrders(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchMeta(); fetchOrders() }, [fetchMeta, fetchOrders])

  const empMap  = useMemo(() => Object.fromEntries(employees.map(e=>[e.id,e])), [employees])
  const machMap = useMemo(() => Object.fromEntries(machines.map(m=>[m.id,m])), [machines])
  const matMap  = useMemo(() => Object.fromEntries(materials.map(m=>[m.id,m])), [materials])

  // ── Filtered orders ────────────────────────────────────────────────────────
  const visible = useMemo(() => {
    if (statusFilter === 'all') return orders
    return orders.filter(o => o.status === statusFilter)
  }, [orders, statusFilter])

  const counts = useMemo(() => {
    const m = { all: orders.length }
    orders.forEach(o => { m[o.status] = (m[o.status] || 0) + 1 })
    return m
  }, [orders])

  // ── Helpers ────────────────────────────────────────────────────────────────
  function totalOutput(order) {
    return (order.production_output || []).reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0)
  }

  function openNew() {
    setForm({ ...EMPTY_FORM, planned_date: new Date().toISOString().slice(0,10) })
    setMatRows([{ ...EMPTY_MAT_ROW }])
    setOpIds([])
    setEditOrder(null)
    setShowNewModal(true)
  }

  function openEdit(order) {
    setForm({
      product_name: order.product_name, product_code: order.product_code || '',
      target_quantity: order.target_quantity, unit: order.unit,
      machine_id: order.machine_id || '', planned_date: order.planned_date || '', notes: order.notes || '',
    })
    setMatRows(order.production_order_materials?.length
      ? order.production_order_materials.map(r => ({ material_id: r.material_id||'', material_name: r.material_name, planned_qty: r.planned_qty, unit: r.unit||'' }))
      : [{ ...EMPTY_MAT_ROW }])
    setOpIds((order.production_order_operators||[]).map(o=>o.employee_id))
    setEditOrder(order)
    setShowNewModal(true)
  }

  function openDetail(order) {
    setDetailOrder(order)
    setDetailTab('overview')
    setOutputForm({ date: new Date().toISOString().slice(0,10), quantity: '', notes: '' })
    const existingQC = order.production_qc?.[0]
    setQcForm(existingQC ? {
      inspector_id: existingQC.inspector_id||'',
      pass_qty: existingQC.pass_qty||'', fail_qty: existingQC.fail_qty||'',
      rework_qty: existingQC.rework_qty||'', defect_notes: existingQC.defect_notes||'',
    } : { inspector_id: '', pass_qty: '', fail_qty: '', rework_qty: '', defect_notes: '' })
  }

  // Update detailOrder when orders list refreshes
  useEffect(() => {
    if (detailOrder) {
      const updated = orders.find(o => o.id === detailOrder.id)
      if (updated) setDetailOrder(updated)
    }
  }, [orders])

  // ── Material row helpers ───────────────────────────────────────────────────
  function setMatRow(i, field, value) {
    setMatRows(rows => rows.map((r, idx) => {
      if (idx !== i) return r
      const updated = { ...r, [field]: value }
      if (field === 'material_id' && value) {
        const mat = matMap[value]
        if (mat) { updated.material_name = mat.name; updated.unit = mat.unit }
      }
      return updated
    }))
  }

  // ── Save order ─────────────────────────────────────────────────────────────
  async function saveOrder() {
    if (!form.product_name.trim()) { toast.error('Product name required'); return }
    if (!form.target_quantity || parseFloat(form.target_quantity) <= 0) { toast.error('Enter target quantity'); return }
    setSaving(true)
    try {
      let orderId = editOrder?.id
      const orderPayload = {
        product_name:     form.product_name.trim(),
        product_code:     form.product_code.trim() || null,
        target_quantity:  parseFloat(form.target_quantity),
        unit:             form.unit,
        machine_id:       form.machine_id || null,
        planned_date:     form.planned_date || null,
        notes:            form.notes.trim() || null,
        updated_at:       new Date().toISOString(),
      }

      if (!editOrder) {
        // Generate order number
        const orderNum = genOrderNumber(orders.length)
        const { data: newOrder, error } = await supabase.from('production_orders')
          .insert({ ...orderPayload, order_number: orderNum, status: 'planned', created_by: profile.id })
          .select().single()
        if (error) throw error
        orderId = newOrder.id
      } else {
        const { error } = await supabase.from('production_orders').update(orderPayload).eq('id', orderId)
        if (error) throw error
      }

      // Operators: delete then insert
      await supabase.from('production_order_operators').delete().eq('order_id', orderId)
      if (opIds.length) {
        await supabase.from('production_order_operators').insert(opIds.map(eid => ({ order_id: orderId, employee_id: eid })))
      }

      // Materials: delete then insert
      await supabase.from('production_order_materials').delete().eq('order_id', orderId)
      const validMats = matRows.filter(r => r.material_name.trim() && parseFloat(r.planned_qty) > 0)
      if (validMats.length) {
        await supabase.from('production_order_materials').insert(validMats.map(r => ({
          order_id:      orderId,
          material_id:   r.material_id || null,
          material_name: r.material_name.trim(),
          planned_qty:   parseFloat(r.planned_qty),
          unit:          r.unit || null,
          actual_qty:    0,
        })))
      }

      toast.success(editOrder ? 'Order updated' : 'Order created')
      setShowNewModal(false)
      fetchOrders()
    } catch (err) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  // ── Status transitions ─────────────────────────────────────────────────────
  async function updateStatus(order, newStatus) {
    const updates = { status: newStatus, updated_at: new Date().toISOString() }
    if (newStatus === 'in_progress' && !order.start_date) updates.start_date = new Date().toISOString().slice(0,10)
    if (newStatus === 'done') updates.end_date = new Date().toISOString().slice(0,10)
    const { error } = await supabase.from('production_orders').update(updates).eq('id', order.id)
    if (error) { toast.error(error.message); return }
    toast.success(`Order marked as ${STATUSES[newStatus]?.label}`)
    fetchOrders()
  }

  async function deleteOrder(order) {
    if (!await confirmToast(`Delete ${order.order_number}? This cannot be undone.`)) return
    await supabase.from('production_orders').delete().eq('id', order.id)
    setDetailOrder(null)
    toast.success('Order deleted')
    fetchOrders()
  }

  // ── Output recording ───────────────────────────────────────────────────────
  async function recordOutput() {
    if (!outputForm.quantity || parseFloat(outputForm.quantity) <= 0) { toast.error('Enter quantity'); return }
    setOutputSaving(true)
    const { error } = await supabase.from('production_output').insert({
      order_id:    detailOrder.id,
      date:        outputForm.date,
      quantity:    parseFloat(outputForm.quantity),
      notes:       outputForm.notes || null,
      recorded_by: profile.id,
    })
    setOutputSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Output recorded')
    setOutputForm(f => ({ ...f, quantity: '', notes: '' }))
    fetchOrders()
  }

  // ── Material actual qty ───────────────────────────────────────────────────
  async function updateActualQty(matRowId, qty) {
    await supabase.from('production_order_materials').update({ actual_qty: parseFloat(qty)||0 }).eq('id', matRowId)
    fetchOrders()
  }

  // ── Stock out from materials ───────────────────────────────────────────────
  async function recordStockOut() {
    const mats = detailOrder.production_order_materials?.filter(r => r.actual_qty > 0 && r.material_id) || []
    if (!mats.length) { toast.error('No materials with actual quantity set'); return }
    setStockOutSaving(true)
    try {
      await supabase.from('stock_issues').insert(mats.map(r => ({
        material_id: r.material_id,
        quantity:    r.actual_qty,
        unit:        r.unit || matMap[r.material_id]?.unit || '',
        purpose:     `Production - ${detailOrder.order_number}`,
        issued_to:   'Production Floor',
        issue_date:  new Date().toISOString().slice(0,10),
        issued_by:   profile.id,
      })))
      toast.success(`Stock out recorded for ${mats.length} material(s)`)
    } catch (err) {
      toast.error(err.message)
    }
    setStockOutSaving(false)
  }

  // ── QC submit ──────────────────────────────────────────────────────────────
  async function submitQC() {
    const pass   = parseFloat(qcForm.pass_qty) || 0
    const fail   = parseFloat(qcForm.fail_qty) || 0
    const rework = parseFloat(qcForm.rework_qty) || 0
    if (pass + fail === 0) { toast.error('Enter pass or fail quantity'); return }
    const status = fail === 0 ? 'pass' : pass === 0 ? 'fail' : 'partial'
    setQcSaving(true)
    const existingQC = detailOrder.production_qc?.[0]
    const qcPayload = {
      order_id:      detailOrder.id,
      inspector_id:  qcForm.inspector_id || null,
      pass_qty:      pass, fail_qty: fail, rework_qty: rework,
      defect_notes:  qcForm.defect_notes || null,
      status, checked_at: new Date().toISOString(),
    }
    const { error } = existingQC
      ? await supabase.from('production_qc').update(qcPayload).eq('id', existingQC.id)
      : await supabase.from('production_qc').insert(qcPayload)
    setQcSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('QC result saved')
    fetchOrders()
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
            <Factory size={20} className="text-blue-600" />
          </div>
          <div>
            <h1 className="page-header">Production Orders</h1>
            <p className="page-sub">Plan, track and complete production runs</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchOrders} className="btn-ghost px-2.5">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          {canManage && (
            <button onClick={openNew} className="btn-primary">
              <Plus size={14} /> New Order
            </button>
          )}
        </div>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[['all','All'], ...Object.entries(STATUSES).map(([k,v])=>[k,v.label])].map(([key,label]) => (
          <button key={key} onClick={() => setStatusFilter(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer
              ${statusFilter === key ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
            {label}
            {counts[key] > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${statusFilter===key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5">
              <div className="flex items-start gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="skeleton h-4 w-20 rounded-md" />
                    <div className="skeleton h-5 w-24 rounded-lg" />
                  </div>
                  <div className="skeleton h-5 w-48 rounded-md" />
                  <div className="flex gap-3 mt-2">
                    <div className="skeleton h-4 w-16 rounded-md" />
                    <div className="skeleton h-4 w-24 rounded-md" />
                    <div className="skeleton h-4 w-20 rounded-md" />
                  </div>
                </div>
                <div className="w-36 space-y-2">
                  <div className="skeleton h-4 w-full rounded-md" />
                  <div className="skeleton h-2 w-full rounded-full" />
                  <div className="skeleton h-3 w-8 rounded-md ml-auto" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="card p-12 text-center">
          <Factory size={40} className="mx-auto text-slate-300 mb-3" />
          <div className="text-slate-600 font-semibold mb-1">No production orders</div>
          <div className="text-slate-400 text-sm mb-4">
            {statusFilter !== 'all' ? `No ${STATUSES[statusFilter]?.label.toLowerCase()} orders right now.` : 'Nothing in the queue yet.'}
          </div>
          {statusFilter !== 'all' ? (
            <button onClick={() => setStatusFilter('all')} className="btn-ghost text-sm">Show all orders</button>
          ) : (
            <button onClick={openNew} className="btn-primary">
              <Plus size={14} /> New Order
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(order => {
            const produced = totalOutput(order)
            const pct      = order.target_quantity > 0 ? Math.min(100, Math.round((produced / order.target_quantity) * 100)) : 0
            const ops      = (order.production_order_operators||[]).map(o=>empMap[o.employee_id]).filter(Boolean)
            const machine  = machMap[order.machine_id]
            const qc       = order.production_qc?.[0]
            const isLate   = order.planned_date && order.status !== 'done' && order.status !== 'cancelled' && new Date(order.planned_date) < new Date()

            return (
              <div key={order.id}
                className="card p-5 hover:shadow-card-hover hover:-translate-y-0.5 transition-all cursor-pointer"
                onClick={() => openDetail(order)}>
                <div className="flex flex-wrap items-start gap-4">
                  {/* Left: order info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-[11px] text-slate-400 font-semibold">{order.order_number}</span>
                      <StatusBadge status={order.status} />
                      {isLate && <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md">OVERDUE</span>}
                      {qc?.status === 'pass' && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">QC PASSED</span>}
                      {qc?.status === 'fail' && <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md">QC FAILED</span>}
                    </div>
                    <div className="font-bold text-slate-800 text-[16px] leading-tight">{order.product_name}</div>
                    {order.product_code && <div className="text-[11px] text-slate-400 font-mono mt-0.5">{order.product_code}</div>}

                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[12px] text-slate-500">
                      <span className="flex items-center gap-1"><Layers size={11}/> {order.target_quantity} {order.unit}</span>
                      {machine && <span className="flex items-center gap-1"><Factory size={11}/> {machine.process_name}</span>}
                      {order.planned_date && <span className={`flex items-center gap-1 ${isLate?'text-red-500 font-semibold':''}`}><Calendar size={11}/> {fmtDate(order.planned_date)}</span>}
                    </div>
                  </div>

                  {/* Right: progress + operators */}
                  <div className="flex flex-col items-end gap-2 min-w-[140px]">
                    {/* Progress */}
                    <div className="w-full">
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-500">Output</span>
                        <span className={`font-bold ${pct>=100?'text-emerald-600':'text-slate-700'}`}>{produced}/{order.target_quantity} {order.unit}</span>
                      </div>
                      <ProgressBar value={produced} max={order.target_quantity}
                        color={pct >= 100 ? 'bg-emerald-500' : order.status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-400'} />
                      <div className="text-right text-[10px] text-slate-400 mt-0.5">{pct}%</div>
                    </div>

                    {/* Operators */}
                    {ops.length > 0 && (
                      <div className="flex items-center">
                        {ops.slice(0,4).map((op,i) => (
                          <div key={op.id} title={op.full_name}
                            className={`w-6 h-6 rounded-full bg-gradient-to-br ${gradient(op.full_name)} border-2 border-white flex items-center justify-center ${i>0?'-ml-1.5':''}`}>
                            <span className="text-white text-[8px] font-bold">{initials(op.full_name)}</span>
                          </div>
                        ))}
                        {ops.length > 4 && <span className="text-[10px] text-slate-400 ml-1.5">+{ops.length-4}</span>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick actions (stop propagation) */}
                {canManage && order.status !== 'done' && order.status !== 'cancelled' && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                    {order.status === 'planned' && (
                      <button onClick={() => updateStatus(order,'in_progress')}
                        className="flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-100 cursor-pointer">
                        <Play size={10}/> Start
                      </button>
                    )}
                    {order.status === 'in_progress' && (
                      <button onClick={() => updateStatus(order,'qc')}
                        className="flex items-center gap-1 text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-200 px-2.5 py-1 rounded-lg hover:bg-violet-100 cursor-pointer">
                        <FlaskConical size={10}/> Send to QC
                      </button>
                    )}
                    {order.status === 'in_progress' && (
                      <button onClick={() => updateStatus(order,'done')}
                        className="flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg hover:bg-emerald-100 cursor-pointer">
                        <CheckCircle2 size={10}/> Mark Done
                      </button>
                    )}
                    {order.status === 'qc' && (
                      <button onClick={() => updateStatus(order,'done')}
                        className="flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg hover:bg-emerald-100 cursor-pointer">
                        <CheckCircle2 size={10}/> Mark Done
                      </button>
                    )}
                    <span className="text-slate-200">|</span>
                    <button onClick={() => openEdit(order)}
                      className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer px-1">
                      Edit
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── NEW / EDIT ORDER MODAL ────────────────────────────────────────────── */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-6">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <span className="font-bold text-slate-800 text-[16px]">{editOrder ? `Edit ${editOrder.order_number}` : 'New Production Order'}</span>
              <button onClick={() => setShowNewModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"><X size={16}/></button>
            </div>

            <div className="p-6 space-y-5">
              {/* Product */}
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-3">Product Details</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="label">Product Name *</label>
                    <input value={form.product_name} onChange={e=>setForm(f=>({...f,product_name:e.target.value}))}
                      placeholder="e.g. 1.5 sq mm 2-core cable"
                      className="input" />
                  </div>
                  <div>
                    <label className="label">Product Code</label>
                    <input value={form.product_code} onChange={e=>setForm(f=>({...f,product_code:e.target.value}))}
                      placeholder="e.g. CBL-1.5-2C"
                      className="input" />
                  </div>
                  <div>
                    <label className="label">Planned Date</label>
                    <input type="date" value={form.planned_date} onChange={e=>setForm(f=>({...f,planned_date:e.target.value}))}
                      className="input" />
                  </div>
                  <div>
                    <label className="label">Target Quantity *</label>
                    <input type="number" min="1" value={form.target_quantity} onChange={e=>setForm(f=>({...f,target_quantity:e.target.value}))}
                      placeholder="e.g. 500"
                      className="input" />
                  </div>
                  <div>
                    <label className="label">Unit</label>
                    <select value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}
                      className="input">
                      {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Machine */}
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-3">Machine & Operators</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="label">Machine</label>
                    <select value={form.machine_id} onChange={e=>setForm(f=>({...f,machine_id:e.target.value}))}
                      className="input">
                      <option value="">No machine assigned</option>
                      {machines.map(m=><option key={m.id} value={m.id}>{m.process_name}{m.department?` (${m.department})`:''}</option>)}
                    </select>
                  </div>
                </div>
                {/* Operators */}
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-slate-600 mb-2">Operators <span className="text-slate-400 font-normal">(select all assigned)</span></label>
                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {employees.map(emp => (
                      <label key={emp.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={opIds.includes(emp.id)}
                          onChange={e => setOpIds(ids => e.target.checked ? [...ids,emp.id] : ids.filter(id=>id!==emp.id))}
                          className="accent-brand-500" />
                        <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${gradient(emp.full_name)} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white text-[9px] font-bold">{initials(emp.full_name)}</span>
                        </div>
                        <div>
                          <div className="text-[13px] font-medium text-slate-700">{emp.full_name}</div>
                          <div className="text-[11px] text-slate-400">{emp.position} · {emp.department}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Materials */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Raw Materials Plan</div>
                  <button onClick={() => setMatRows(r=>[...r,{...EMPTY_MAT_ROW}])}
                    className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 cursor-pointer flex items-center gap-1">
                    <Plus size={11}/> Add Row
                  </button>
                </div>
                <div className="space-y-2">
                  {matRows.map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select value={row.material_id} onChange={e=>setMatRow(i,'material_id',e.target.value)}
                        className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500">
                        <option value="">Select material…</option>
                        {materials.map(m=><option key={m.id} value={m.id}>{m.name} (stock: {m.current_stock} {m.unit})</option>)}
                      </select>
                      <input type="number" min="0" step="0.001" value={row.planned_qty} onChange={e=>setMatRow(i,'planned_qty',e.target.value)}
                        placeholder="Qty"
                        className="w-24 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                      <span className="text-xs text-slate-400 w-8">{row.unit}</span>
                      <button onClick={() => setMatRows(rows=>rows.filter((_,idx)=>idx!==i))}
                        className="text-slate-300 hover:text-red-500 cursor-pointer p-1"><Trash2 size={14}/></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label">Notes</label>
                <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                  placeholder="Any special instructions or notes…" rows={2}
                  className="input resize-none" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowNewModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveOrder} disabled={saving} className="btn-primary">
                {saving ? <RefreshCw size={13} className="animate-spin"/> : <Save size={13}/>} {editOrder ? 'Update' : 'Create Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ORDER DETAIL MODAL ────────────────────────────────────────────────── */}
      {detailOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-6">
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-slate-400 font-semibold">{detailOrder.order_number}</span>
                  <StatusBadge status={detailOrder.status} />
                </div>
                <div className="font-bold text-slate-800 text-[17px] leading-tight">{detailOrder.product_name}</div>
              </div>
              <button onClick={() => setDetailOrder(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer flex-shrink-0"><X size={16}/></button>
            </div>

            {/* Detail tabs */}
            <div className="flex gap-1 p-1.5 bg-slate-50 border-b border-slate-200 overflow-x-auto">
              {[
                { key:'overview', icon:BarChart2,   label:'Overview' },
                { key:'output',   icon:Layers,      label:'Output' },
                { key:'materials',icon:Package,     label:'Materials' },
                { key:'qc',       icon:FlaskConical,label:'QC' },
              ].map(t => (
                <button key={t.key} onClick={() => setDetailTab(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all cursor-pointer whitespace-nowrap
                    ${detailTab===t.key ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                  <t.icon size={12}/>{t.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* OVERVIEW */}
              {detailTab === 'overview' && (() => {
                const produced = totalOutput(detailOrder)
                const pct      = detailOrder.target_quantity > 0 ? Math.min(100, Math.round((produced / detailOrder.target_quantity) * 100)) : 0
                const ops      = (detailOrder.production_order_operators||[]).map(o=>empMap[o.employee_id]).filter(Boolean)
                const machine  = machMap[detailOrder.machine_id]
                return (
                  <div className="space-y-5">
                    {/* Progress */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-semibold text-slate-700">Production Progress</span>
                        <span className="font-bold text-slate-800">{produced} / {detailOrder.target_quantity} {detailOrder.unit} ({pct}%)</span>
                      </div>
                      <ProgressBar value={produced} max={detailOrder.target_quantity}
                        color={pct>=100?'bg-emerald-500':detailOrder.status==='in_progress'?'bg-blue-500':'bg-slate-400'} />
                    </div>

                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ['Machine',    machine?.process_name || '—'],
                        ['Planned Date', fmtDate(detailOrder.planned_date)],
                        ['Start Date',   fmtDate(detailOrder.start_date)],
                        ['End Date',     fmtDate(detailOrder.end_date)],
                      ].map(([l,v])=>(
                        <div key={l} className="bg-slate-50 rounded-xl p-3">
                          <div className="text-[11px] text-slate-400 mb-0.5">{l}</div>
                          <div className="text-[13px] font-semibold text-slate-700">{v}</div>
                        </div>
                      ))}
                    </div>

                    {/* Operators */}
                    {ops.length > 0 && (
                      <div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Assigned Operators</div>
                        <div className="flex flex-wrap gap-2">
                          {ops.map(op => (
                            <div key={op.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                              <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${gradient(op.full_name)} flex items-center justify-center flex-shrink-0`}>
                                <span className="text-white text-[9px] font-bold">{initials(op.full_name)}</span>
                              </div>
                              <div>
                                <div className="text-[12px] font-semibold text-slate-700">{op.full_name}</div>
                                <div className="text-[10px] text-slate-400">{op.position}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {detailOrder.notes && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                        <span className="font-semibold">Notes: </span>{detailOrder.notes}
                      </div>
                    )}

                    {/* Status actions */}
                    {canManage && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                        {detailOrder.status === 'planned' && (
                          <button onClick={() => updateStatus(detailOrder,'in_progress')}
                            className="flex items-center gap-1.5 bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-600 cursor-pointer">
                            <Play size={13}/> Start Production
                          </button>
                        )}
                        {detailOrder.status === 'in_progress' && <>
                          <button onClick={() => updateStatus(detailOrder,'qc')}
                            className="flex items-center gap-1.5 bg-violet-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-violet-600 cursor-pointer">
                            <FlaskConical size={13}/> Send to QC
                          </button>
                          <button onClick={() => updateStatus(detailOrder,'done')}
                            className="flex items-center gap-1.5 bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-600 cursor-pointer">
                            <CheckCircle2 size={13}/> Mark Done
                          </button>
                        </>}
                        {detailOrder.status === 'qc' && (
                          <button onClick={() => updateStatus(detailOrder,'done')}
                            className="flex items-center gap-1.5 bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-600 cursor-pointer">
                            <CheckCircle2 size={13}/> Mark Done
                          </button>
                        )}
                        {['owner','admin'].includes(profile.role) && !['done'].includes(detailOrder.status) && (
                          <button onClick={() => updateStatus(detailOrder,'cancelled')}
                            className="flex items-center gap-1.5 border border-red-200 text-red-600 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-50 cursor-pointer">
                            <XCircle size={13}/> Cancel
                          </button>
                        )}
                        {['owner','admin'].includes(profile.role) && (
                          <button onClick={() => deleteOrder(detailOrder)}
                            className="flex items-center gap-1.5 border border-slate-200 text-slate-500 px-3 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 cursor-pointer ml-auto">
                            <Trash2 size={13}/> Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* OUTPUT */}
              {detailTab === 'output' && (() => {
                const outputs  = detailOrder.production_output || []
                const produced = outputs.reduce((s,r)=>s+(parseFloat(r.quantity)||0),0)
                return (
                  <div className="space-y-5">
                    {/* Record output form */}
                    {['in_progress','qc'].includes(detailOrder.status) && (
                      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                        <div className="text-sm font-bold text-blue-800 mb-3">Record Output</div>
                        <div className="flex flex-wrap gap-3 items-end">
                          <div>
                            <label className="block text-[11px] font-semibold text-blue-700 mb-1">Date</label>
                            <input type="date" value={outputForm.date} onChange={e=>setOutputForm(f=>({...f,date:e.target.value}))}
                              className="border border-blue-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-blue-700 mb-1">Quantity ({detailOrder.unit})</label>
                            <input type="number" min="0.001" step="0.001" value={outputForm.quantity} onChange={e=>setOutputForm(f=>({...f,quantity:e.target.value}))}
                              placeholder="e.g. 50"
                              className="border border-blue-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-32" />
                          </div>
                          <div className="flex-1 min-w-[120px]">
                            <label className="block text-[11px] font-semibold text-blue-700 mb-1">Notes</label>
                            <input value={outputForm.notes} onChange={e=>setOutputForm(f=>({...f,notes:e.target.value}))}
                              placeholder="Optional…"
                              className="w-full border border-blue-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          </div>
                          <button onClick={recordOutput} disabled={outputSaving}
                            className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 cursor-pointer">
                            {outputSaving?<RefreshCw size={13} className="animate-spin"/>:<Save size={13}/>} Save
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Progress summary */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 font-semibold">Total Produced: <span className="text-slate-900 font-bold">{produced} {detailOrder.unit}</span></span>
                      <span className="text-slate-500">Target: {detailOrder.target_quantity} {detailOrder.unit}</span>
                    </div>
                    <ProgressBar value={produced} max={detailOrder.target_quantity}
                      color={produced>=detailOrder.target_quantity?'bg-emerald-500':'bg-blue-500'} />

                    {/* Output log */}
                    {outputs.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-sm">No output recorded yet.</div>
                    ) : (
                      <div className="space-y-2">
                        {[...outputs].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).map(row => (
                          <div key={row.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                            <div className="flex items-center gap-3">
                              <span className="text-[12px] text-slate-500 font-mono">{fmtDate(row.date)}</span>
                              {row.notes && <span className="text-[12px] text-slate-400 italic">{row.notes}</span>}
                            </div>
                            <span className="font-bold text-slate-800 text-[14px]">+{row.quantity} {detailOrder.unit}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* MATERIALS */}
              {detailTab === 'materials' && (() => {
                const mats = detailOrder.production_order_materials || []
                return (
                  <div className="space-y-4">
                    {mats.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-sm">No materials planned for this order.</div>
                    ) : (
                      <>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide rounded-l-xl">Material</th>
                              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Planned</th>
                              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Actual Used</th>
                              <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide rounded-r-xl">In Stock</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {mats.map(row => {
                              const stockMat = matMap[row.material_id]
                              const over     = row.actual_qty > row.planned_qty
                              return (
                                <tr key={row.id}>
                                  <td className="px-4 py-3 font-medium text-slate-800">{row.material_name}</td>
                                  <td className="px-4 py-3 text-right text-slate-600">{row.planned_qty} {row.unit}</td>
                                  <td className="px-4 py-3 text-right">
                                    <input type="number" min="0" step="0.001"
                                      defaultValue={row.actual_qty || ''}
                                      onBlur={e => updateActualQty(row.id, e.target.value)}
                                      placeholder="0"
                                      className={`w-24 text-right border rounded-lg px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-brand-500 ${over?'border-amber-400 bg-amber-50':'border-slate-200'}`} />
                                    <span className="text-[11px] text-slate-400 ml-1">{row.unit}</span>
                                    {over && <div className="text-[10px] text-amber-600 mt-0.5">Over planned by {(row.actual_qty-row.planned_qty).toFixed(3)}</div>}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {stockMat
                                      ? <span className={`text-[12px] font-bold ${stockMat.current_stock < row.planned_qty?'text-red-600':'text-emerald-600'}`}>
                                          {stockMat.current_stock} {stockMat.unit}
                                        </span>
                                      : <span className="text-slate-300 text-xs">—</span>}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>

                        {canManage && (
                          <button onClick={recordStockOut} disabled={stockOutSaving}
                            className="flex items-center gap-1.5 border border-slate-200 bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-100 cursor-pointer disabled:opacity-60">
                            {stockOutSaving?<RefreshCw size={13} className="animate-spin"/>:<PackageMinus size={13}/>}
                            Record Stock Out (from actual quantities)
                          </button>
                        )}
                        <p className="text-[11px] text-slate-400">Enter actual quantities used, then click "Record Stock Out" to deduct from inventory.</p>
                      </>
                    )}
                  </div>
                )
              })()}

              {/* QC */}
              {detailTab === 'qc' && (() => {
                const existingQC = detailOrder.production_qc?.[0]
                const qcInspectors = employees.filter(e => e.position === 'QC' || ['qc_inspector'].includes(e.role))
                const produced = totalOutput(detailOrder)
                return (
                  <div className="space-y-5">
                    {existingQC && (
                      <div className={`border rounded-2xl p-4 ${existingQC.status==='pass'?'bg-emerald-50 border-emerald-200':existingQC.status==='fail'?'bg-red-50 border-red-200':'bg-amber-50 border-amber-200'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-bold text-sm ${existingQC.status==='pass'?'text-emerald-700':existingQC.status==='fail'?'text-red-700':'text-amber-700'}`}>
                            QC Result: {existingQC.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-[12px] text-slate-600">
                          Pass: <strong>{existingQC.pass_qty}</strong> · Fail: <strong>{existingQC.fail_qty}</strong> · Rework: <strong>{existingQC.rework_qty}</strong>
                        </div>
                        {existingQC.defect_notes && <div className="text-[12px] text-slate-500 mt-1 italic">{existingQC.defect_notes}</div>}
                      </div>
                    )}

                    {canQC && (
                      <div className="space-y-4">
                        <div className="text-sm font-bold text-slate-700">{existingQC ? 'Update QC Result' : 'Record QC Inspection'}</div>
                        <div className="text-[12px] text-slate-500">Total produced: <strong>{produced} {detailOrder.unit}</strong></div>

                        <div>
                          <label className="label">QC Inspector</label>
                          <select value={qcForm.inspector_id} onChange={e=>setQcForm(f=>({...f,inspector_id:e.target.value}))}
                            className="input">
                            <option value="">Select inspector…</option>
                            {employees.map(e=><option key={e.id} value={e.id}>{e.full_name} ({e.position})</option>)}
                          </select>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-emerald-700 mb-1.5">Pass Qty *</label>
                            <input type="number" min="0" step="0.001" value={qcForm.pass_qty} onChange={e=>setQcForm(f=>({...f,pass_qty:e.target.value}))}
                              placeholder="0"
                              className="w-full border border-emerald-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-red-600 mb-1.5">Fail Qty</label>
                            <input type="number" min="0" step="0.001" value={qcForm.fail_qty} onChange={e=>setQcForm(f=>({...f,fail_qty:e.target.value}))}
                              placeholder="0"
                              className="w-full border border-red-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-amber-600 mb-1.5">Rework Qty</label>
                            <input type="number" min="0" step="0.001" value={qcForm.rework_qty} onChange={e=>setQcForm(f=>({...f,rework_qty:e.target.value}))}
                              placeholder="0"
                              className="w-full border border-amber-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400" />
                          </div>
                        </div>

                        <div>
                          <label className="label">Defect Notes</label>
                          <textarea value={qcForm.defect_notes} onChange={e=>setQcForm(f=>({...f,defect_notes:e.target.value}))}
                            placeholder="Describe any defects, rejection reason, rework instructions…" rows={3}
                            className="input resize-none" />
                        </div>

                        <button onClick={submitQC} disabled={qcSaving}
                          className="flex items-center gap-1.5 bg-violet-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-600 disabled:opacity-60 cursor-pointer">
                          {qcSaving?<RefreshCw size={13} className="animate-spin"/>:<FlaskConical size={13}/>}
                          {existingQC ? 'Update QC Result' : 'Submit QC Result'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
