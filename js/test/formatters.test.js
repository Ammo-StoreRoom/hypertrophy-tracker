// ============================================
// FORMATTERS TESTS — Date, time, weight formatting
// ============================================

Test.describe('fmtDate - Date Formatter', () => {
  Test.it('should format ISO date string', () => {
    const result = fmtDate('2024-03-15');
    Test.expect(typeof result).toBe('string');
    Test.expect(result).toContain('15');
  });

  Test.it('should format Date object', () => {
    const date = new Date('2024-03-15T10:30:00');
    const result = fmtDate(date);
    Test.expect(typeof result).toBe('string');
    Test.expect(result.length).toBeGreaterThan(0);
  });

  Test.it('should include short weekday', () => {
    const result = fmtDate('2024-03-15'); // Friday
    // Should contain day name like "Fri"
    const hasDay = /Mon|Tue|Wed|Thu|Fri|Sat|Sun/.test(result);
    Test.expect(hasDay).toBeTruthy();
  });

  Test.it('should include month name', () => {
    const result = fmtDate('2024-03-15');
    // Should contain month like "Mar"
    const hasMonth = /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/.test(result);
    Test.expect(hasMonth).toBeTruthy();
  });
});

Test.describe('fmtTime - Time Formatter', () => {
  Test.it('should format seconds as MM:SS', () => {
    Test.expect(fmtTime(0)).toBe('0:00');
    Test.expect(fmtTime(30)).toBe('0:30');
    Test.expect(fmtTime(60)).toBe('1:00');
    Test.expect(fmtTime(90)).toBe('1:30');
    Test.expect(fmtTime(125)).toBe('2:05');
  });

  Test.it('should pad seconds with zero', () => {
    Test.expect(fmtTime(1)).toBe('0:01');
    Test.expect(fmtTime(5)).toBe('0:05');
    Test.expect(fmtTime(10)).toBe('0:10');
    Test.expect(fmtTime(61)).toBe('1:01');
  });

  Test.it('should handle large values', () => {
    Test.expect(fmtTime(3600)).toBe('60:00');
    Test.expect(fmtTime(3661)).toBe('61:01');
  });
});

Test.describe('unitLabel - Unit Label', () => {
  let originalStore;

  Test.beforeEach(() => {
    originalStore = typeof Store !== 'undefined' ? Store : undefined;
  });

  Test.afterEach(() => {
    if (originalStore !== undefined) {
      window.Store = originalStore;
    }
  });

  Test.it('should default to lbs when Store not available', () => {
    delete window.Store;
    Test.expect(unitLabel()).toBe('lbs');
  });

  Test.it('should return lbs from Store state', () => {
    window.Store = { state: { units: 'lbs' } };
    Test.expect(unitLabel()).toBe('lbs');
  });

  Test.it('should return kg from Store state', () => {
    window.Store = { state: { units: 'kg' } };
    Test.expect(unitLabel()).toBe('kg');
  });

  Test.it('should default to lbs when units not set', () => {
    window.Store = { state: {} };
    Test.expect(unitLabel()).toBe('lbs');
  });
});

Test.describe('defaultBar - Default Bar Weight', () => {
  let originalStore;

  Test.beforeEach(() => {
    originalStore = typeof Store !== 'undefined' ? Store : undefined;
  });

  Test.afterEach(() => {
    if (originalStore !== undefined) {
      window.Store = originalStore;
    }
  });

  Test.it('should return 45 for lbs', () => {
    window.Store = { state: { units: 'lbs' } };
    Test.expect(defaultBar()).toBe(45);
  });

  Test.it('should return 20 for kg', () => {
    window.Store = { state: { units: 'kg' } };
    Test.expect(defaultBar()).toBe(20);
  });

  Test.it('should default to 45 when Store not available', () => {
    delete window.Store;
    Test.expect(defaultBar()).toBe(45);
  });
});

Test.describe('formatWeight - Weight Formatter', () => {
  let originalStore;

  Test.beforeEach(() => {
    originalStore = typeof Store !== 'undefined' ? Store : undefined;
    window.Store = { state: { units: 'lbs' } };
  });

  Test.afterEach(() => {
    if (originalStore !== undefined) {
      window.Store = originalStore;
    }
  });

  Test.it('should format valid numbers with units', () => {
    Test.expect(formatWeight(135)).toBe('135lbs');
    Test.expect(formatWeight(225)).toBe('225lbs');
    Test.expect(formatWeight(45)).toBe('45lbs');
  });

  Test.it('should include space when requested', () => {
    Test.expect(formatWeight(135, true)).toBe('135 lbs');
    Test.expect(formatWeight(225, true)).toBe('225 lbs');
  });

  Test.it('should return empty string for invalid values', () => {
    Test.expect(formatWeight(0)).toBe('');
    Test.expect(formatWeight(-10)).toBe('');
    Test.expect(formatWeight(null)).toBe('');
    Test.expect(formatWeight(undefined)).toBe('');
    Test.expect(formatWeight('')).toBe('');
    Test.expect(formatWeight(NaN)).toBe('');
  });

  Test.it('should format decimals properly', () => {
    Test.expect(formatWeight(135.5)).toBe('135.5lbs');
    Test.expect(formatWeight(142.5)).toBe('142.5lbs');
    Test.expect(formatWeight(100.0)).toBe('100lbs'); // trailing .0 removed
  });

  Test.it('should format string numbers', () => {
    Test.expect(formatWeight('135')).toBe('135lbs');
    Test.expect(formatWeight('225.5')).toBe('225.5lbs');
  });

  Test.it('should use kg unit when set', () => {
    window.Store = { state: { units: 'kg' } };
    Test.expect(formatWeight(100)).toBe('100kg');
    Test.expect(formatWeight(60, true)).toBe('60 kg');
  });

  Test.it('should limit decimal precision', () => {
    Test.expect(formatWeight(135.555)).toBe('135.6lbs');
    Test.expect(formatWeight(135.549)).toBe('135.5lbs');
  });
});

Test.describe('fmtW - Weight Shorthand', () => {
  let originalStore;

  Test.beforeEach(() => {
    window.Store = { state: { units: 'lbs' } };
  });

  Test.it('should be alias for formatWeight', () => {
    Test.expect(fmtW(135)).toBe(formatWeight(135));
    Test.expect(fmtW(225)).toBe(formatWeight(225));
  });
});

Test.describe('convertWeight - Unit Conversion', () => {
  let originalStore;

  Test.beforeEach(() => {
    window.Store = { state: { units: 'lbs' } };
  });

  Test.it('should convert lbs to kg', () => {
    // 100 lbs = 45.36 kg
    const result = convertWeight(100, 'kg', 'lbs');
    Test.expect(result).toBeCloseTo(45.36, 2);
  });

  Test.it('should convert kg to lbs', () => {
    // 100 kg = 220.46 lbs
    const result = convertWeight(100, 'lbs', 'kg');
    Test.expect(result).toBeCloseTo(220.46, 2);
  });

  Test.it('should return same value when units match', () => {
    Test.expect(convertWeight(100, 'lbs', 'lbs')).toBe(100);
    Test.expect(convertWeight(100, 'kg', 'kg')).toBe(100);
  });

  Test.it('should use Store units as default from', () => {
    window.Store = { state: { units: 'lbs' } };
    const result = convertWeight(100, 'kg');
    Test.expect(result).toBeCloseTo(45.36, 2);
  });

  Test.it('should return 0 for invalid input', () => {
    Test.expect(convertWeight(null, 'kg', 'lbs')).toBe(0);
    Test.expect(convertWeight(undefined, 'kg', 'lbs')).toBe(0);
    Test.expect(convertWeight('', 'kg', 'lbs')).toBe(0);
    Test.expect(convertWeight(NaN, 'kg', 'lbs')).toBe(0);
  });

  Test.it('should handle string numbers', () => {
    const result = convertWeight('100', 'kg', 'lbs');
    Test.expect(result).toBeCloseTo(45.36, 2);
  });

  Test.it('should convert common plate weights correctly', () => {
    // 45 lbs plate
    Test.expect(convertWeight(45, 'kg', 'lbs')).toBeCloseTo(20.41, 1);
    // 25 kg plate
    Test.expect(convertWeight(25, 'lbs', 'kg')).toBeCloseTo(55.12, 1);
  });
});
