// Installs Store Gate in your database (alternative to pasting SQL in Supabase).
// Easier way: see STORE_GATE_SETUP.md — use Supabase SQL Editor instead.
import './load-env.mjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260520_store_gate_otp.sql')

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
if (!connectionString) {
  console.error(`
Store Gate setup needs your database link.

Easiest fix: open STORE_GATE_SETUP.md and use "Step 1" (Supabase SQL Editor).
No password file needed.

Or: copy .env.example → .env.local, add DATABASE_URL, then run again.
`)
  process.exit(1)
}

const sql = fs.readFileSync(sqlPath, 'utf8')
const client = new pg.Client({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
})

try {
  await client.connect()
  console.log('Installing Store Gate…')
  await client.query(sql)
  console.log('Done! Open the ERP → Gate Request and try generating a code.')
} catch (err) {
  console.error('Setup failed:', err.message)
  if (err.message?.includes('store_items')) {
    console.error('Tip: Add store items in the ERP first (Store → Items List).')
  }
  process.exit(1)
} finally {
  await client.end()
}
