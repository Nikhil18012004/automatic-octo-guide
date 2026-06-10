// Shared CRM constants & helpers.

// Pipeline stages map onto the existing `enquiries.status` values, so the
// pipeline works without any migration. Closed leads additionally carry an
// `outcome` (won/lost) once the migration adds that column.
export const PIPELINE_STAGES = [
  { key: 'new',       label: 'New',       dot: 'bg-blue-500',   col: 'border-blue-200 bg-blue-50/40',     head: 'text-blue-700' },
  { key: 'reviewing', label: 'Reviewing', dot: 'bg-amber-500',  col: 'border-amber-200 bg-amber-50/40',   head: 'text-amber-700' },
  { key: 'quoted',    label: 'Quoted',    dot: 'bg-purple-500', col: 'border-purple-200 bg-purple-50/40', head: 'text-purple-700' },
  { key: 'closed',    label: 'Closed',    dot: 'bg-slate-400',  col: 'border-slate-200 bg-slate-50/60',   head: 'text-slate-600' },
]

export const STAGE_LABEL = Object.fromEntries(PIPELINE_STAGES.map(s => [s.key, s.label]))

export const OUTCOME = {
  won:  { label: 'Won',  badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  lost: { label: 'Lost', badge: 'bg-red-50 text-red-700 border-red-200' },
}

export const LEAD_SOURCES = ['Portal', 'WhatsApp', 'Phone', 'Referral', 'Walk-in', 'Exhibition', 'Other']

export const TASK_PRIORITY = {
  low:    { label: 'Low',    badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  normal: { label: 'Normal', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  high:   { label: 'High',   badge: 'bg-red-50 text-red-700 border-red-200' },
}

export const ACTIVITY_TYPES = ['note', 'call', 'visit', 'email', 'whatsapp']

// A Postgres "table/column does not exist" error → migration not applied yet.
export function isMissingSchema(error) {
  if (!error) return false
  const m = `${error.message || ''} ${error.code || ''}`.toLowerCase()
  return error.code === '42P01' || error.code === '42703' ||
         m.includes('does not exist') || m.includes('schema cache')
}

// Best-effort name normaliser for matching loosely-linked records.
export function normName(s = '') {
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim()
}

export function initials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

// Display name for a lead/enquiry row.
export function leadName(e) {
  return e.company || e.contact_name || e.enquiry_no || 'Lead'
}
