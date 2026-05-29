/**
 * Store Location Utilities
 * Shared logic for location grouping and management
 */

/**
 * Group locations by store code with zone information
 * Used in: StoreReceive, StoreIssue, StoreReturn, StoreAdjust
 * 
 * @param {array} locations - Array of location objects
 * @returns {object} Grouped locations: { store_code: { store_name, zones: [...] } }
 */
export function groupLocationsByStore(locations) {
  return locations.reduce((acc, loc) => {
    if (!acc[loc.store_code]) {
      acc[loc.store_code] = {
        store_name: loc.store_name,
        zones: [],
      };
    }
    acc[loc.store_code].zones.push(loc);
    return acc;
  }, {});
}

/**
 * Get a flat list of location labels for display
 * Format: "Store Name - Zone Label" or "Zone Label"
 * 
 * @param {array} locations - Array of location objects
 * @returns {array} Formatted labels
 */
export function getLocationLabels(locations) {
  return locations.map(loc => {
    const storeName = loc.store_name ? `${loc.store_name} - ` : '';
    return `${storeName}${loc.zone_label}`;
  });
}

/**
 * Find location by code
 * @param {array} locations - Array of location objects
 * @param {string} code - Location code (store_code + zone_code)
 * @returns {object|null}
 */
export function findLocation(locations, code) {
  return locations.find(loc => loc.store_code === code) || null;
}

/**
 * Format location display name
 * @param {object} location - Location object
 * @returns {string}
 */
export function formatLocationDisplay(location) {
  if (!location) return '—';
  return `${location.store_name} (${location.zone_label})`;
}
