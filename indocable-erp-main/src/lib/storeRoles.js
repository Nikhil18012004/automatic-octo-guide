/**
 * Store Module Role-Based Access Control
 * Single source of truth for all store operations
 */

export const STORE_ROLES = {
  // Gate/OTP Request - who can generate OTP codes
  GATE_REQUEST: [
    'owner',
    'admin',
    'procurement',
    'security_guard',
    'production_head',
    'operator',
    'helper',
  ],

  // Receive Stock - who can record inbound items
  RECEIVE: [
    'owner',
    'admin',
    'procurement',
    'security_guard',
  ],

  // Issue Stock - who can withdraw items
  ISSUE: [
    'owner',
    'admin',
    'procurement',
    'production_head',
    'operator',
    'security_guard',
  ],

  // Adjust Stock - who can adjust quantities (inventory variance)
  ADJUST: [
    'owner',
    'admin',
  ],

  // Return Stock - who can return items
  RETURN: [
    'owner',
    'admin',
    'procurement',
    'security_guard',
    'production_head',
    'operator',
  ],

  // Location Manager - who can manage store locations/zones
  LOCATIONS: [
    'owner',
    'admin',
  ],

  // Store Dashboard - who can view store operations
  STORE_VIEW: [
    'owner',
    'admin',
    'procurement',
    'production_head',
    'operator',
    'security_guard',
    'helper',
  ],
};

/**
 * Check if user has access to a store operation
 * @param {string} userRole - User's role
 * @param {string} operation - Operation key (e.g., 'GATE_REQUEST')
 * @returns {boolean}
 */
export function hasStoreAccess(userRole, operation) {
  if (!userRole || !operation) return false;
  const allowedRoles = STORE_ROLES[operation];
  if (!allowedRoles) return false;
  return allowedRoles.includes(userRole);
}

/**
 * Get all roles that can perform an operation
 * @param {string} operation - Operation key
 * @returns {array}
 */
export function getOperationRoles(operation) {
  return STORE_ROLES[operation] || [];
}
