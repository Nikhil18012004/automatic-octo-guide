/**
 * Store Access (door monitor) login credentials — TESTING ONLY.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  EDIT THESE to set your own monitor login id and password.            │
 * │  This is a client-side test login (no database). Anyone with the      │
 * │  app source can read these, so do NOT treat it as real security —     │
 * │  it only exists to test the "enter code → unlock" flow.               │
 * └─────────────────────────────────────────────────────────────────────┘
 */

export const STORE_ACCESS_CREDENTIALS = {
  id: 'store@indocable.com',
  password: 'Store@123',
}
