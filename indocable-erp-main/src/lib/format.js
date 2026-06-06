// Shared formatting helpers. These were previously copy-pasted (byte-identical)
// across many pages; keep one source of truth here.

// Tailwind gradient classes used for avatar / initial chips.
export const GRADIENTS = [
  'from-brand-500 to-brand-700',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-700',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-blue-600',
  'from-rose-500 to-pink-600',
]

// Deterministically pick a gradient from a string (e.g. a name), so the same
// entity always gets the same colour.
export function gradient(s = '') {
  let h = 0
  for (const c of s) h = ((h << 5) - h) + c.charCodeAt(0)
  return GRADIENTS[Math.abs(h) % GRADIENTS.length]
}

// "₹1,23,456" — Indian-grouped rupee amount, 0 for non-numbers.
export function fmtINR(n) {
  return '₹' + (Number(n) || 0).toLocaleString('en-IN')
}

// "5 Jan 2026" — date-only value rendered in Indian locale. Adds a noon time so
// a bare "YYYY-MM-DD" doesn't shift across timezones. Returns the given
// placeholder (default "—") for empty values.
export function fmtDate(d, placeholder = '—') {
  if (!d) return placeholder
  return new Date(d + 'T12:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
