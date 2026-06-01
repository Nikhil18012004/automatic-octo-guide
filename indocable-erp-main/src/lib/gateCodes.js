/**
 * Store Gate Codes — browser-only (localStorage) implementation.
 *
 * TESTING BUILD: codes, their 10-minute expiry, the access log, and the
 * 30-minute "store access" unlock window all live in this browser's
 * localStorage. They are NOT synced to the database or across devices.
 * When the real door monitor is wired up, this module is the single place
 * to swap for a DB-backed version.
 */

const CODES_KEY = 'store_gate_codes_v1'
const UNLOCK_KEY = 'store_access_unlock_v1'

export const CODE_TTL_MINUTES = 10
export const STOCK_ACCESS_MINUTES = 30
export const CODE_PATTERN = /^[A-Za-z0-9]{8}$/

const CHANGE_EVENT = 'gatecodes-changed'

function emitChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Subscribe to any change (same tab + other tabs). Returns an unsubscribe fn. */
export function onCodesChange(handler) {
  const storageHandler = (e) => {
    if (!e.key || e.key === CODES_KEY || e.key === UNLOCK_KEY) handler()
  }
  window.addEventListener(CHANGE_EVENT, handler)
  window.addEventListener('storage', storageHandler)
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler)
    window.removeEventListener('storage', storageHandler)
  }
}

function readRaw() {
  try { return JSON.parse(localStorage.getItem(CODES_KEY) || '[]') }
  catch { return [] }
}

function writeRaw(list) {
  localStorage.setItem(CODES_KEY, JSON.stringify(list))
  emitChange()
}

function newId() {
  try { return crypto.randomUUID() }
  catch { return `c_${Date.now()}_${Math.floor(Math.random() * 1e6)}` }
}

/** Mark any active-but-past-expiry codes as expired, persist if changed. */
function sweep(list) {
  const now = Date.now()
  let changed = false
  list.forEach(c => {
    if (c.status === 'active' && new Date(c.expires_at).getTime() <= now) {
      c.status = 'expired'
      changed = true
    }
  })
  return changed
}

/** All codes, newest first, with expiry applied. */
export function getCodes() {
  const list = readRaw()
  if (sweep(list)) writeRaw(list)
  return [...list].sort((a, b) => new Date(b.generated_at) - new Date(a.generated_at))
}

/** True if a code string is currently a live (active, unexpired) code. */
export function isCodeLive(code) {
  const now = Date.now()
  return readRaw().some(c =>
    c.status === 'active' &&
    new Date(c.expires_at).getTime() > now &&
    String(c.code).toUpperCase() === String(code).toUpperCase()
  )
}

/**
 * Store a new code.
 * entry: { code, type, item_id, item_name, unit, quantity, location,
 *          generated_by_id, generated_by_name, movement_table, movement_id }
 */
export function addCode(entry) {
  const list = readRaw()
  const now = new Date()
  const rec = {
    id: newId(),
    status: 'active',
    generated_at: now.toISOString(),
    expires_at: new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000).toISOString(),
    used_at: null,
    used_by: null,
    ...entry,
  }
  list.push(rec)
  writeRaw(list)
  return rec
}

/**
 * Verify a code entered at the access monitor. On success the code is marked
 * used. Returns { ok, record? }.
 */
export function verifyCode(code, accessId) {
  const list = readRaw()
  sweep(list)
  const now = Date.now()
  const rec = list.find(c =>
    c.status === 'active' &&
    new Date(c.expires_at).getTime() > now &&
    String(c.code).toUpperCase() === String(code).toUpperCase()
  )
  if (!rec) { writeRaw(list); return { ok: false } }
  rec.status = 'used'
  rec.used_at = new Date().toISOString()
  rec.used_by = accessId || 'monitor'
  writeRaw(list)
  return { ok: true, record: rec }
}

// ── Stock-count "store access" unlock window ──────────────────────────────────

/** Unlock the store for N minutes from now. */
export function unlockStore(minutes = STOCK_ACCESS_MINUTES, accessId = null) {
  const until = Date.now() + minutes * 60 * 1000
  localStorage.setItem(UNLOCK_KEY, JSON.stringify({ until, at: Date.now(), minutes, by: accessId }))
  emitChange()
  return until
}

export function lockStore() {
  localStorage.removeItem(UNLOCK_KEY)
  emitChange()
}

/** Current unlock state: { unlocked, until, by, secondsLeft }. */
export function getUnlockState() {
  let raw = null
  try { raw = JSON.parse(localStorage.getItem(UNLOCK_KEY) || 'null') } catch { raw = null }
  if (!raw || !raw.until) return { unlocked: false, until: null, secondsLeft: 0 }
  const secondsLeft = Math.max(0, Math.floor((raw.until - Date.now()) / 1000))
  return { unlocked: secondsLeft > 0, until: raw.until, by: raw.by || null, secondsLeft }
}
