// ============================================
// FORMATTERS — Date, time, weight formatting utilities
// ============================================

/**
 * Format a date for display
 * @param {string|Date} d - Date to format
 * @returns {string} Formatted date string
 */
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Format seconds as MM:SS
 * @param {number} s - Seconds
 * @returns {string} Formatted time string
 */
function fmtTime(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Get the current unit label (lbs or kg)
 * @returns {string} Unit label
 */
function unitLabel() {
  return (typeof Store !== 'undefined' && Store.state?.units) || 'lbs';
}

/**
 * Get the default bar weight based on current units
 * @returns {number} Bar weight in lbs or kg
 */
function defaultBar() {
  return unitLabel() === 'kg' ? 20 : 45;
}

/**
 * Format a weight value with units
 * @param {number|string} val - Weight value
 * @param {boolean} withSpace - Whether to include space between number and unit
 * @returns {string} Formatted weight string
 */
function formatWeight(val, withSpace = false) {
  const n = parseFloat(val);
  if (!Number.isFinite(n) || n <= 0) return '';
  const pretty = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
  return `${pretty}${withSpace ? ' ' : ''}${unitLabel()}`;
}

/**
 * Shorthand for formatWeight
 * @param {number|string} v - Weight value
 * @returns {string} Formatted weight string
 */
function fmtW(v) {
  return formatWeight(v);
}

/**
 * Convert weight between units
 * @param {number} val - Value to convert
 * @param {string} toUnit - Target unit (lbs or kg)
 * @param {string} fromUnit - Source unit (defaults to current unit)
 * @returns {number} Converted weight
 */
function convertWeight(val, toUnit, fromUnit = unitLabel()) {
  const n = parseFloat(val);
  if (!Number.isFinite(n)) return 0;
  if (toUnit === fromUnit) return n;
  return toUnit === 'kg' ? (n * 0.45359237) : (n / 0.45359237);
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { fmtDate, fmtTime, formatWeight, unitLabel, defaultBar, fmtW, convertWeight };
}
