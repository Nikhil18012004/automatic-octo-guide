/**
 * Store Access (door monitor) login credentials — TESTING ONLY.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  Set these via VITE_STORE_ACCESS_ID / VITE_STORE_ACCESS_PASSWORD in   │
 * │  .env.local (see .env.example). This is a client-side test login (no  │
 * │  database). The bundled values are still readable by anyone with the  │
 * │  built JS, so do NOT treat it as real security — it only exists to    │
 * │  test the "enter code → unlock" flow.                                 │
 * └─────────────────────────────────────────────────────────────────────┘
 */

export const STORE_ACCESS_CREDENTIALS = {
  id: import.meta.env.VITE_STORE_ACCESS_ID || 'store@indocable.com',
  password: import.meta.env.VITE_STORE_ACCESS_PASSWORD || 'Store@123',
}
