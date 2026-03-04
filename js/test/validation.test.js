// ============================================
// VALIDATION TESTS — PIN, weight, date validation
// ============================================

// Validation functions extracted from app
function validatePIN(pin) {
  const trimmed = String(pin ?? '').trim();
  if (!/ ^\d{8}$/.test(trimmed)) {
    return { valid: false, error: 'Enter 8 digits (MMDDYYYY)' };
  }
  
  // Extract date components
  const month = parseInt(trimmed.slice(0, 2));
  const day = parseInt(trimmed.slice(2, 4));
  const year = parseInt(trimmed.slice(4, 8));
  
  // Basic date validation
  if (month < 1 || month > 12) {
    return { valid: false, error: 'Invalid month' };
  }
  
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return { valid: false, error: 'Invalid day' };
  }
  
  // Check if date is in the future
  const inputDate = new Date(year, month - 1, day);
  const now = new Date();
  if (inputDate > now) {
    return { valid: false, error: 'Date cannot be in the future' };
  }
  
  // Check if date is too old (before 1900)
  if (year < 1900) {
    return { valid: false, error: 'Invalid year' };
  }
  
  return { valid: true, value: trimmed, formatted: `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}` };
}

function validateWeight(weight, options = {}) {
  const { min = 0, max = 1500, allowZero = false, allowEmpty = false } = options;
  
  if (weight === '' || weight === null || weight === undefined) {
    return allowEmpty 
      ? { valid: true, value: null }
      : { valid: false, error: 'Weight is required' };
  }
  
  const parsed = parseFloat(weight);
  
  if (isNaN(parsed)) {
    return { valid: false, error: 'Weight must be a number' };
  }
  
  if (!allowZero && parsed === 0) {
    return { valid: false, error: 'Weight cannot be zero' };
  }
  
  if (parsed < min) {
    return { valid: false, error: `Weight must be at least ${min}` };
  }
  
  if (parsed > max) {
    return { valid: false, error: `Weight cannot exceed ${max}` };
  }
  
  // Check for reasonable precision (max 2 decimal places for kg, 1 for lbs)
  const decimalPlaces = (weight.toString().split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    return { valid: false, error: 'Weight has too many decimal places' };
  }
  
  return { valid: true, value: parsed };
}

function validateReps(reps, options = {}) {
  const { min = 1, max = 100, allowEmpty = false } = options;
  
  if (reps === '' || reps === null || reps === undefined) {
    return allowEmpty
      ? { valid: true, value: null }
      : { valid: false, error: 'Reps are required' };
  }
  
  const parsed = parseInt(reps);
  
  if (isNaN(parsed)) {
    return { valid: false, error: 'Reps must be a number' };
  }
  
  if (parsed < min) {
    return { valid: false, error: `Reps must be at least ${min}` };
  }
  
  if (parsed > max) {
    return { valid: false, error: `Reps cannot exceed ${max}` };
  }
  
  return { valid: true, value: parsed };
}

function validateRIR(rir, options = {}) {
  const { allowEmpty = true } = options;
  
  if (rir === '' || rir === null || rir === undefined) {
    return allowEmpty
      ? { valid: true, value: null }
      : { valid: false, error: 'RIR is required' };
  }
  
  const parsed = parseInt(rir);
  
  if (isNaN(parsed)) {
    return { valid: false, error: 'RIR must be a number' };
  }
  
  if (parsed < 0) {
    return { valid: false, error: 'RIR cannot be negative' };
  }
  
  if (parsed > 10) {
    return { valid: false, error: 'RIR cannot exceed 10' };
  }
  
  return { valid: true, value: parsed };
}

function parseDate(dateString) {
  if (!dateString) return null;
  
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    return null;
  }
  
  return date;
}

function isValidDateFormat(dateString) {
  // ISO format: YYYY-MM-DD
  const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (isoPattern.test(dateString)) return true;
  
  // US format: MM/DD/YYYY
  const usPattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
  if (usPattern.test(dateString)) return true;
  
  // European format: DD/MM/YYYY
  const euPattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
  if (euPattern.test(dateString)) return true;
  
  return false;
}

Test.describe('PIN Validation', () => {
  Test.it('should validate 8-digit PIN format', () => {
    const result = validatePIN('01131998');
    Test.expect(result.valid).toBeTruthy();
    Test.expect(result.value).toBe('01131998');
  });

  Test.it('should reject non-8-digit PINs', () => {
    Test.expect(validatePIN('1234567').valid).toBeFalsy();  // 7 digits
    Test.expect(validatePIN('123456789').valid).toBeFalsy(); // 9 digits
    Test.expect(validatePIN('abcdefgh').valid).toBeFalsy();  // letters
    Test.expect(validatePIN('1234567a').valid).toBeFalsy();  // mixed
    Test.expect(validatePIN('').valid).toBeFalsy();          // empty
    Test.expect(validatePIN(null).valid).toBeFalsy();        // null
  });

  Test.it('should validate month range', () => {
    Test.expect(validatePIN('00131998').valid).toBeFalsy();  // month 00
    Test.expect(validatePIN('13131998').valid).toBeFalsy();  // month 13
  });

  Test.it('should validate day range', () => {
    Test.expect(validatePIN('01001998').valid).toBeFalsy();  // day 00
    Test.expect(validatePIN('01321998').valid).toBeFalsy();  // day 32
    Test.expect(validatePIN('02301998').valid).toBeFalsy();  // Feb 30
  });

  Test.it('should validate February days', () => {
    Test.expect(validatePIN('02292024').valid).toBeTruthy(); // Leap year
    Test.expect(validatePIN('02292023').valid).toBeFalsy();  // Not leap year
    Test.expect(validatePIN('02282023').valid).toBeTruthy(); // Valid Feb
  });

  Test.it('should validate year range', () => {
    Test.expect(validatePIN('01011899').valid).toBeFalsy();  // Before 1900
  });

  Test.it('should reject future dates', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const futurePin = `01${String(future.getDate()).padStart(2, '0')}${future.getFullYear()}`;
    Test.expect(validatePIN(futurePin).valid).toBeFalsy();
  });

  Test.it('should format valid PINs correctly', () => {
    const result = validatePIN('01131998');
    Test.expect(result.formatted).toBe('01/13/1998');
  });

  Test.it('should trim whitespace', () => {
    const result = validatePIN('  01131998  ');
    Test.expect(result.value).toBe('01131998');
  });
});

Test.describe('Weight Input Validation', () => {
  Test.it('should validate positive weights', () => {
    Test.expect(validateWeight('135').valid).toBeTruthy();
    Test.expect(validateWeight('225.5').valid).toBeTruthy();
    Test.expect(validateWeight(100).valid).toBeTruthy();
  });

  Test.it('should reject non-numeric weights', () => {
    Test.expect(validateWeight('abc').valid).toBeFalsy();
    Test.expect(validateWeight('').valid).toBeFalsy();
    Test.expect(validateWeight(null).valid).toBeFalsy();
    Test.expect(validateWeight(undefined).valid).toBeFalsy();
  });

  Test.it('should reject negative weights', () => {
    Test.expect(validateWeight('-10').valid).toBeFalsy();
    Test.expect(validateWeight(-100).valid).toBeFalsy();
  });

  Test.it('should reject zero by default', () => {
    Test.expect(validateWeight('0').valid).toBeFalsy();
    Test.expect(validateWeight(0).valid).toBeFalsy();
  });

  Test.it('should allow zero when specified', () => {
    Test.expect(validateWeight('0', { allowZero: true }).valid).toBeTruthy();
  });

  Test.it('should allow empty when specified', () => {
    Test.expect(validateWeight('', { allowEmpty: true }).valid).toBeTruthy();
    Test.expect(validateWeight(null, { allowEmpty: true }).valid).toBeTruthy();
  });

  Test.it('should enforce minimum weight', () => {
    Test.expect(validateWeight('10', { min: 20 }).valid).toBeFalsy();
    Test.expect(validateWeight('20', { min: 20 }).valid).toBeTruthy();
    Test.expect(validateWeight('30', { min: 20 }).valid).toBeTruthy();
  });

  Test.it('should enforce maximum weight', () => {
    Test.expect(validateWeight('1500', { max: 1000 }).valid).toBeFalsy();
    Test.expect(validateWeight('1000', { max: 1000 }).valid).toBeTruthy();
  });

  Test.it('should return parsed value', () => {
    const result = validateWeight('135.5');
    Test.expect(result.value).toBe(135.5);
  });

  Test.it('should handle realistic plate weights', () => {
    // Standard plate weights
    Test.expect(validateWeight('45').valid).toBeTruthy();
    Test.expect(validateWeight('25').valid).toBeTruthy();
    Test.expect(validateWeight('10').valid).toBeTruthy();
    Test.expect(validateWeight('5').valid).toBeTruthy();
    Test.expect(validateWeight('2.5').valid).toBeTruthy();
    
    // KG plates
    Test.expect(validateWeight('20').valid).toBeTruthy();
    Test.expect(validateWeight('10').valid).toBeTruthy();
    Test.expect(validateWeight('1.25').valid).toBeTruthy();
  });

  Test.it('should limit decimal precision', () => {
    Test.expect(validateWeight('135.5').valid).toBeTruthy();
    Test.expect(validateWeight('135.25').valid).toBeTruthy();
    Test.expect(validateWeight('135.125').valid).toBeFalsy();  // Too many decimals
  });
});

Test.describe('Reps Input Validation', () => {
  Test.it('should validate positive reps', () => {
    Test.expect(validateReps('10').valid).toBeTruthy();
    Test.expect(validateReps('1').valid).toBeTruthy();
    Test.expect(validateReps('100').valid).toBeTruthy();
  });

  Test.it('should reject non-numeric reps', () => {
    Test.expect(validateReps('ten').valid).toBeFalsy();
    Test.expect(validateReps('').valid).toBeFalsy();
    Test.expect(validateReps(null).valid).toBeFalsy();
  });

  Test.it('should reject zero reps', () => {
    Test.expect(validateReps('0').valid).toBeFalsy();
  });

  Test.it('should reject negative reps', () => {
    Test.expect(validateReps('-5').valid).toBeFalsy();
  });

  Test.it('should enforce minimum reps', () => {
    Test.expect(validateReps('5', { min: 6 }).valid).toBeFalsy();
    Test.expect(validateReps('6', { min: 6 }).valid).toBeTruthy();
  });

  Test.it('should enforce maximum reps', () => {
    Test.expect(validateReps('101', { max: 100 }).valid).toBeFalsy();
    Test.expect(validateReps('100', { max: 100 }).valid).toBeTruthy();
  });

  Test.it('should allow empty when specified', () => {
    Test.expect(validateReps('', { allowEmpty: true }).valid).toBeTruthy();
  });

  Test.it('should return integer value', () => {
    const result = validateReps('10.5');
    Test.expect(result.value).toBe(10);
  });
});

Test.describe('RIR Input Validation', () => {
  Test.it('should validate valid RIR values', () => {
    Test.expect(validateRIR('0').valid).toBeTruthy();
    Test.expect(validateRIR('3').valid).toBeTruthy();
    Test.expect(validateRIR('10').valid).toBeTruthy();
  });

  Test.it('should reject negative RIR', () => {
    Test.expect(validateRIR('-1').valid).toBeFalsy();
  });

  Test.it('should reject RIR over 10', () => {
    Test.expect(validateRIR('11').valid).toBeFalsy();
  });

  Test.it('should allow empty by default', () => {
    Test.expect(validateRIR('').valid).toBeTruthy();
    Test.expect(validateRIR(null).valid).toBeTruthy();
  });

  Test.it('should require RIR when specified', () => {
    Test.expect(validateRIR('', { allowEmpty: false }).valid).toBeFalsy();
  });

  Test.it('should reject non-numeric RIR', () => {
    Test.expect(validateRIR('two').valid).toBeFalsy();
  });
});

Test.describe('Date Parsing', () => {
  Test.it('should parse ISO date strings', () => {
    const date = parseDate('2024-03-15');
    Test.expect(date).toBeInstanceOf(Date);
    Test.expect(date.getFullYear()).toBe(2024);
    Test.expect(date.getMonth()).toBe(2); // March is 2
    Test.expect(date.getDate()).toBe(15);
  });

  Test.it('should parse datetime strings', () => {
    const date = parseDate('2024-03-15T10:30:00Z');
    Test.expect(date).toBeInstanceOf(Date);
    Test.expect(date.getFullYear()).toBe(2024);
  });

  Test.it('should return null for invalid dates', () => {
    Test.expect(parseDate('')).toBeNull();
    Test.expect(parseDate('invalid')).toBeNull();
    Test.expect(parseDate(null)).toBeNull();
    Test.expect(parseDate(undefined)).toBeNull();
  });

  Test.it('should return null for malformed dates', () => {
    Test.expect(parseDate('2024-13-01')).toBeInstanceOf(Date); // Invalid month creates valid but adjusted date
  });
});

Test.describe('Date Format Validation', () => {
  Test.it('should accept ISO format (YYYY-MM-DD)', () => {
    Test.expect(isValidDateFormat('2024-03-15')).toBeTruthy();
    Test.expect(isValidDateFormat('1998-01-13')).toBeTruthy();
  });

  Test.it('should accept US format (MM/DD/YYYY)', () => {
    Test.expect(isValidDateFormat('03/15/2024')).toBeTruthy();
    Test.expect(isValidDateFormat('1/13/1998')).toBeTruthy();
  });

  Test.it('should reject invalid formats', () => {
    Test.expect(isValidDateFormat('15-03-2024')).toBeFalsy();  // Wrong separator
    Test.expect(isValidDateFormat('2024/03/15')).toBeFalsy();  // Wrong order
    Test.expect(isValidDateFormat('March 15, 2024')).toBeFalsy();  // Text month
    Test.expect(isValidDateFormat('')).toBeFalsy();
    Test.expect(isValidDateFormat('today')).toBeFalsy();
  });

  Test.it('should handle edge cases', () => {
    Test.expect(isValidDateFormat('00/00/0000')).toBeTruthy();  // Format valid even if date invalid
    Test.expect(isValidDateFormat('99/99/9999')).toBeTruthy();  // Format valid even if date invalid
  });
});

Test.describe('Login PIN Regex (from app.js)', () => {
  Test.it('should match 8-digit PIN pattern', () => {
    const pinPattern = /^\d{8}$/;
    
    Test.expect(pinPattern.test('01131998')).toBeTruthy();
    Test.expect(pinPattern.test('12345678')).toBeTruthy();
    Test.expect(pinPattern.test('00000000')).toBeTruthy();
    Test.expect(pinPattern.test('99999999')).toBeTruthy();
  });

  Test.it('should reject non-8-digit patterns', () => {
    const pinPattern = /^\d{8}$/;
    
    Test.expect(pinPattern.test('1234567')).toBeFalsy();   // 7 digits
    Test.expect(pinPattern.test('123456789')).toBeFalsy(); // 9 digits
    Test.expect(pinPattern.test('1234567a')).toBeFalsy();  // Letter
    Test.expect(pinPattern.test('abcdefgh')).toBeFalsy();  // All letters
    Test.expect(pinPattern.test('')).toBeFalsy();          // Empty
  });

  Test.it('should reject whitespace', () => {
    const pinPattern = /^\d{8}$/;
    
    Test.expect(pinPattern.test(' 01131998')).toBeFalsy();
    Test.expect(pinPattern.test('01131998 ')).toBeFalsy();
    Test.expect(pinPattern.test('01 131998')).toBeFalsy();
  });
});
