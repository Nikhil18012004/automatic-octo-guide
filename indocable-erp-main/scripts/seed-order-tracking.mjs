// One-off seed: creates a sample Purchase Order (issued + partially received)
// and a dispatched shipment linked to a production order, so all three
// order-tracking views in the ERP have realistic data to show.
//
// Auth: signs in as a real owner/admin user (RLS requires it).
// Usage: SEED_EMAIL=... SEED_PASSWORD=... node scripts/seed-order-tracking.mjs
import './load-env.mjs'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
const email = process.env.SEED_EMAIL
const password = process.env.SEED_PASSWORD
if (!url || !key) { console.error('Missing Supabase env (.env.local)'); process.exit(1) }
if (!email || !password) { console.error('Set SEED_EMAIL and SEED_PASSWORD'); process.exit(1) }

const sb = createClient(url, key, { auth: { persistSession: false } })
const die = (label, error) => { if (error) { console.error(`✗ ${label}:`, error.message); process.exit(1) } }
const today = () => new Date().toISOString().slice(0, 10)

// ── number generators (mirror the app) ───────────────────────────────────────
function genPONumber(count) {
  const d = new Date()
  return `PO-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(count + 1).padStart(3, '0')}`
}
async function genChallanNo() {
  const d = new Date()
  const m = d.getMonth() + 1, yr = d.getFullYear()
  const fyStart = m >= 4 ? yr : yr - 1
  const fyStr = `${String(fyStart).slice(-2)}-${String(fyStart + 1).slice(-2)}`
  const { data } = await sb.from('dispatch_orders').select('challan_number')
    .like('challan_number', `DC-%/${fyStr}`).order('created_at', { ascending: false }).limit(1)
  let seq = 1
  if (data?.[0]) { const mat = data[0].challan_number.match(/^DC-(\d+)\//); if (mat) seq = parseInt(mat[1]) + 1 }
  return `DC-${String(seq).padStart(3, '0')}/${fyStr}`
}

// find-or-create helper
async function ensure(table, match, create) {
  const { data: found } = await sb.from(table).select('*').match(match).limit(1)
  if (found?.[0]) return { row: found[0], created: false }
  const { data, error } = await sb.from(table).insert(create).select().single()
  die(`create ${table}`, error)
  return { row: data, created: true }
}

// ── 1. sign in ────────────────────────────────────────────────────────────────
const { data: auth, error: authErr } = await sb.auth.signInWithPassword({ email, password })
die('sign in', authErr)
console.log(`✓ signed in as ${auth.user.email}`)

const { data: profile, error: profErr } = await sb.from('profiles').select('*').eq('id', auth.user.id).single()
die('load profile', profErr)
console.log(`✓ profile role: ${profile.role}`)
if (!['owner', 'admin'].includes(profile.role)) {
  console.error(`✗ role "${profile.role}" cannot access Purchase Orders / Dispatch. Need owner or admin.`)
  process.exit(1)
}

// ── 2. prerequisites: supplier, customer, production order ────────────────────
const { row: supplier, created: supNew } = await ensure(
  'suppliers', { name: 'Bharat Copper Pvt Ltd' },
  { name: 'Bharat Copper Pvt Ltd', phone: '9876543210', email: 'sales@bharatcopper.example' }
)
console.log(`${supNew ? '✓ created' : '· using'} supplier: ${supplier.name}`)

const { row: customer, created: custNew } = await ensure(
  'customers', { name: 'Skyline Electricals' },
  { name: 'Skyline Electricals', phone: '9123456780', address: 'Peenya Industrial Area, Bengaluru 560058' }
)
console.log(`${custNew ? '✓ created' : '· using'} customer: ${customer.name}`)

const { row: prodOrder, created: poNew } = await ensure(
  'production_orders', { order_number: 'SEED-PRD-001' },
  {
    order_number: 'SEED-PRD-001', product_name: 'XLPE Cable 3C x 2.5sqmm',
    product_code: 'XLPE-3C-2.5', target_quantity: 500, unit: 'mtr',
    status: 'in_progress', planned_date: today(), created_by: profile.id,
  }
)
console.log(`${poNew ? '✓ created' : '· using'} production order: ${prodOrder.order_number} (target ${prodOrder.target_quantity} ${prodOrder.unit})`)

// ── 3. Purchase Order: create → issue (sent) → partial receipt ────────────────
const { count } = await sb.from('purchase_orders').select('id', { count: 'exact', head: true })
const po_number = genPONumber(count || 0)
const { data: po, error: poErr } = await sb.from('purchase_orders').insert({
  po_number, supplier_id: supplier.id, order_date: today(),
  expected_date: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
  promised_lead_days: 7, notes: 'Sample PO seeded for order-tracking demo',
}).select().single()
die('create PO', poErr)

const orderedQty = 500
const { data: poItem, error: itemErr } = await sb.from('purchase_order_items').insert({
  po_id: po.id, material_id: null, description: 'Copper Rod 8mm',
  quantity: orderedQty, unit: 'kg', unit_price: 720, received_qty: 0,
}).select().single()
die('create PO item', itemErr)

// issue → status sent, delivery clock starts
die('issue PO', (await sb.from('purchase_orders').update({
  status: 'sent', sent_at: new Date().toISOString(), promised_lead_days: 7,
}).eq('id', po.id)).error)

// partial receipt: receive 200 of 500
const receivedNow = 200
const { data: receipt, error: rErr } = await sb.from('po_receipts')
  .insert({ po_id: po.id, receipt_date: today(), notes: 'First partial delivery' }).select().single()
die('create receipt', rErr)
die('create receipt item', (await sb.from('po_receipt_items')
  .insert({ receipt_id: receipt.id, po_item_id: poItem.id, received_qty: receivedNow })).error)
die('update item received_qty', (await sb.from('purchase_order_items')
  .update({ received_qty: receivedNow }).eq('id', poItem.id)).error)
die('set PO partial', (await sb.from('purchase_orders').update({ status: 'partial' }).eq('id', po.id)).error)
console.log(`✓ Purchase Order ${po_number}: SENT → PARTIAL (received ${receivedNow}/${orderedQty} kg)`)

// ── 4. Dispatch challan: create → dispatched, item linked to production order ─
const challan_number = await genChallanNo()
const dispatchedQty = 120
const { data: challan, error: chErr } = await sb.from('dispatch_orders').insert({
  challan_number, customer_id: customer.id, date: today(), status: 'dispatched',
  vehicle_number: 'KA01AB1234', driver_name: 'Ramesh', lr_number: 'LR-55021',
  destination_address: customer.address || 'Bengaluru',
  notes: 'Sample shipment seeded for order-tracking demo', created_by: profile.id,
}).select().single()
die('create challan', chErr)

die('create dispatch item', (await sb.from('dispatch_items').insert({
  dispatch_id: challan.id, description: `${prodOrder.product_name} (${prodOrder.order_number})`,
  quantity: dispatchedQty, unit: 'mtr', rate: 95, amount: dispatchedQty * 95,
  hsn_code: '85444909', production_order_id: prodOrder.id,
})).error)
console.log(`✓ Dispatch ${challan_number}: DISPATCHED (${dispatchedQty} mtr, linked to ${prodOrder.order_number})`)

// ── summary ───────────────────────────────────────────────────────────────────
console.log('\n── Seeded. Open the app to verify: ──')
console.log(`  Purchase Orders  → ${po_number}  (status: PARTIAL, ${receivedNow}/${orderedQty} kg received)`)
console.log(`  Dispatch ▸ Challans      → ${challan_number}  (status: DISPATCHED)`)
console.log(`  Dispatch ▸ Order Tracking → ${prodOrder.order_number}  (${dispatchedQty}/${prodOrder.target_quantity} mtr dispatched, ${prodOrder.target_quantity - dispatchedQty} remaining)`)
await sb.auth.signOut()
