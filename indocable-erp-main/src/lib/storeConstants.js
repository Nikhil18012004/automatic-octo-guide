/**
 * Store Operations Constants
 * Centralized validation rules, categories, units for all store pages
 */

export const STORE_CATEGORIES = [
  'Electrical',
  'Mechanical',
  'Tools',
  'Consumables',
  'Hardware',
  'Safety',
  'Other',
];

export const STORE_UNITS = [
  'pcs',
  'kg',
  'm',
  'box',
  'roll',
  'set',
  'ltr',
];

export const QUANTITY_RULES = {
  MIN: 0.01,
  MAX: 999999,
  STEP: 'any', // Allow decimals
};

export const ISSUE_PURPOSE_TYPES = [
  { value: 'production', label: 'Production — sent to factory floor' },
  { value: 'maintenance', label: 'Maintenance / Repair' },
  { value: 'sample', label: 'Sample / Testing' },
  { value: 'scrap', label: 'Scrap / Write-off (damaged / expired)' },
  { value: 'other', label: 'Other' },
];

export const RETURN_REASON_TYPES = [
  { value: 'defective', label: 'Defective / Damaged' },
  { value: 'excess', label: 'Excess / Over-ordered' },
  { value: 'not_used', label: 'Not Used / Returned by staff' },
  { value: 'expired', label: 'Expired' },
  { value: 'quality_issue', label: 'Quality Issue' },
  { value: 'other', label: 'Other' },
];

export const GATE_OTP_CONFIG = {
  LENGTH: 6,
  VALIDITY_MINUTES: 5,
  MIN_ATTEMPTS_BEFORE_LOCK: 5,
  LOCK_DURATION_MINUTES: 15,
};

export const FILE_UPLOAD_CONFIG = {
  MAX_SIZE_MB: 5,
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_EXTENSIONS: ['jpg', 'jpeg', 'png', 'webp'],
};

export const FORM_DEFAULTS = {
  TODAY: new Date().toISOString().split('T')[0],
};
