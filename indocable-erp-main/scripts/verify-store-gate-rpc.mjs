// Quick check: is Store Gate installed on Supabase? Run after Step 1 in STORE_GATE_SETUP.md
const url = process.env.SUPABASE_URL || 'https://jfhnkhrsojdfipuiirly.supabase.co'
const key = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmaG5raHJzb2pkZmlwdWlpcmx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODA1NjksImV4cCI6MjA5MzY1NjU2OX0.FZZuYfS1fppCZ_mxXh7eigvtcbzvKmBU3fYAjJA7k5w'

const res = await fetch(`${url}/rest/v1/rpc/create_store_gate_request`, {
  method: 'POST',
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    p_request_type: 'deposit',
    p_item_id: '00000000-0000-0000-0000-000000000001',
    p_quantity: 1,
    p_notes: null,
  }),
})

const text = await res.text()
if (res.status === 404 && text.includes('PGRST202')) {
  console.error('Not ready yet. Do Step 1 in STORE_GATE_SETUP.md (paste SQL in Supabase).')
  process.exit(1)
}
if (res.status === 401 || text.includes('Not authenticated')) {
  console.log('Ready! Store Gate is installed. Use Gate Request in the ERP.')
  process.exit(0)
}
if (res.ok || text.includes('Item not found')) {
  console.log('Ready! Store Gate is installed.')
  process.exit(0)
}
console.log(`Response ${res.status}:`, text)
process.exit(res.status === 404 ? 1 : 0)
