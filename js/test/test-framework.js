// ============================================
// TEST FRAMEWORK — Simple dependency-free testing
// ============================================

/**
 * Simple test framework with no dependencies
 * Supports: describe/it blocks, matchers, beforeEach/afterEach hooks
 */
const Test = {
  suites: [],
  currentSuite: null,
  beforeEachFn: null,
  afterEachFn: null,
  running: false,
  results: [],

  /**
   * Create a test suite
   * @param {string} name - Suite name
   * @param {Function} fn - Suite function containing tests
   */
  describe(name, fn) {
    const suite = {
      name,
      tests: [],
      beforeEach: null,
      afterEach: null
    };
    this.suites.push(suite);
    this.currentSuite = suite;
    fn();
    this.currentSuite = null;
  },

  /**
   * Create a test case
   * @param {string} name - Test name
   * @param {Function} fn - Test function
   */
  it(name, fn) {
    if (!this.currentSuite) {
      throw new Error('it() must be called inside describe()');
    }
    this.currentSuite.tests.push({ name, fn, status: 'pending' });
  },

  /**
   * Skip a test case
   * @param {string} name - Test name
   * @param {Function} fn - Test function (ignored)
   */
  it.skip(name, fn) {
    if (!this.currentSuite) return;
    this.currentSuite.tests.push({ name, fn, status: 'skipped' });
  },

  /**
   * Run only this test (for debugging)
   * @param {string} name - Test name
   * @param {Function} fn - Test function
   */
  it.only(name, fn) {
    if (!this.currentSuite) return;
    this.currentSuite.tests.push({ name, fn, status: 'only' });
  },

  /**
   * Setup hook - runs before each test
   * @param {Function} fn - Setup function
   */
  beforeEach(fn) {
    if (this.currentSuite) {
      this.currentSuite.beforeEach = fn;
    } else {
      this.beforeEachFn = fn;
    }
  },

  /**
   * Teardown hook - runs after each test
   * @param {Function} fn - Teardown function
   */
  afterEach(fn) {
    if (this.currentSuite) {
      this.currentSuite.afterEach = fn;
    } else {
      this.afterEachFn = fn;
    }
  },

  /**
   * Assertion helper
   * @param {*} actual - Actual value
   * @returns {Object} Matchers object
   */
  expect(actual) {
    return {
      /**
       * Strict equality check (===)
       * @param {*} expected - Expected value
       */
      toBe(expected) {
        if (actual !== expected) {
          throw new Error(`Expected ${Test._fmt(expected)} but got ${Test._fmt(actual)}`);
        }
      },

      /**
       * Loose equality check (==)
       * @param {*} expected - Expected value
       */
      toEqual(expected) {
        if (!Test._deepEqual(actual, expected)) {
          throw new Error(`Expected ${Test._fmt(expected)} but got ${Test._fmt(actual)}`);
        }
      },

      /**
       * Float comparison with precision
       * @param {number} expected - Expected value
       * @param {number} precision - Decimal places (default: 2)
       */
      toBeCloseTo(expected, precision = 2) {
        const multiplier = Math.pow(10, precision);
        const actualRounded = Math.round(actual * multiplier) / multiplier;
        const expectedRounded = Math.round(expected * multiplier) / multiplier;
        if (actualRounded !== expectedRounded) {
          throw new Error(`Expected ${expected} (±${Math.pow(10, -precision)}) but got ${actual}`);
        }
      },

      /**
       * Check if value is truthy
       */
      toBeTruthy() {
        if (!actual) {
          throw new Error(`Expected truthy value but got ${Test._fmt(actual)}`);
        }
      },

      /**
       * Check if value is falsy
       */
      toBeFalsy() {
        if (actual) {
          throw new Error(`Expected falsy value but got ${Test._fmt(actual)}`);
        }
      },

      /**
       * Check if array/string contains item
       * @param {*} item - Item to search for
       */
      toContain(item) {
        const isContained = Array.isArray(actual) 
          ? actual.includes(item)
          : typeof actual === 'string' && actual.includes(item);
        if (!isContained) {
          throw new Error(`Expected ${Test._fmt(actual)} to contain ${Test._fmt(item)}`);
        }
      },

      /**
       * Check if array/string does not contain item
       * @param {*} item - Item to search for
       */
      notToContain(item) {
        const isContained = Array.isArray(actual) 
          ? actual.includes(item)
          : typeof actual === 'string' && actual.includes(item);
        if (isContained) {
          throw new Error(`Expected ${Test._fmt(actual)} not to contain ${Test._fmt(item)}`);
        }
      },

      /**
       * Check if function throws
       * @param {string|RegExp} [message] - Expected error message pattern
       */
      toThrow(message) {
        let threw = false;
        let thrownError = null;
        try {
          actual();
        } catch (e) {
          threw = true;
          thrownError = e;
        }
        if (!threw) {
          throw new Error('Expected function to throw but it did not');
        }
        if (message) {
          const errorMessage = thrownError?.message || String(thrownError);
          if (typeof message === 'string' && !errorMessage.includes(message)) {
            throw new Error(`Expected error message to contain "${message}" but got "${errorMessage}"`);
          }
          if (message instanceof RegExp && !message.test(errorMessage)) {
            throw new Error(`Expected error message to match ${message} but got "${errorMessage}"`);
          }
        }
      },

      /**
       * Check if value is greater than expected
       * @param {number} expected - Value to compare against
       */
      toBeGreaterThan(expected) {
        if (!(actual > expected)) {
          throw new Error(`Expected ${actual} to be greater than ${expected}`);
        }
      },

      /**
       * Check if value is less than expected
       * @param {number} expected - Value to compare against
       */
      toBeLessThan(expected) {
        if (!(actual < expected)) {
          throw new Error(`Expected ${actual} to be less than ${expected}`);
        }
      },

      /**
       * Check if value is defined (not undefined)
       */
      toBeDefined() {
        if (actual === undefined) {
          throw new Error('Expected value to be defined but got undefined');
        }
      },

      /**
       * Check if value is null
       */
      toBeNull() {
        if (actual !== null) {
          throw new Error(`Expected null but got ${Test._fmt(actual)}`);
        }
      },

      /**
       * Check if value is an instance of a class
       * @param {Function} constructor - Constructor function
       */
      toBeInstanceOf(constructor) {
        if (!(actual instanceof constructor)) {
          throw new Error(`Expected instance of ${constructor.name} but got ${Test._fmt(actual)}`);
        }
      },

      /**
       * Check if array/object has specific length
       * @param {number} length - Expected length
       */
      toHaveLength(length) {
        const actualLength = actual?.length ?? actual?.size ?? Object.keys(actual).length;
        if (actualLength !== length) {
          throw new Error(`Expected length ${length} but got ${actualLength}`);
        }
      }
    };
  },

  /**
   * Format a value for error messages
   * @param {*} value - Value to format
   * @returns {string} Formatted string
   * @private
   */
  _fmt(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value).slice(0, 100);
      } catch {
        return '[Object]';
      }
    }
    return String(value);
  },

  /**
   * Deep equality check
   * @param {*} a - First value
   * @param {*} b - Second value
   * @returns {boolean} Whether values are deeply equal
   * @private
   */
  _deepEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;
    
    if (typeof a === 'object') {
      if (Array.isArray(a) !== Array.isArray(b)) return false;
      
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      
      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this._deepEqual(a[key], b[key])) return false;
      }
      return true;
    }
    
    return false;
  },

  /**
   * Run all registered tests
   * @param {Object} options - Run options
   * @param {boolean} options.silent - Don't log to console
   * @returns {Promise<Object>} Test results summary
   */
  async runAll(options = {}) {
    if (this.running) {
      throw new Error('Tests are already running');
    }
    
    this.running = true;
    this.results = [];
    
    const summary = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      suites: []
    };

    const startTime = performance.now();

    for (const suite of this.suites) {
      const suiteResult = {
        name: suite.name,
        tests: [],
        passed: 0,
        failed: 0,
        skipped: 0
      };

      if (!options.silent) {
        console.group(`📦 ${suite.name}`);
      }

      for (const test of suite.tests) {
        if (test.status === 'skipped') {
          suiteResult.skipped++;
          summary.skipped++;
          suiteResult.tests.push({ name: test.name, status: 'skipped' });
          if (!options.silent) {
            console.log(`⚪ ${test.name} (skipped)`);
          }
          continue;
        }

        summary.total++;

        // Run beforeEach hooks
        if (this.beforeEachFn) await this._runHook(this.beforeEachFn, 'beforeEach');
        if (suite.beforeEach) await this._runHook(suite.beforeEach, 'beforeEach');

        try {
          await test.fn();
          suiteResult.passed++;
          summary.passed++;
          test.status = 'passed';
          suiteResult.tests.push({ name: test.name, status: 'passed' });
          if (!options.silent) {
            console.log(`✅ ${test.name}`);
          }
        } catch (error) {
          suiteResult.failed++;
          summary.failed++;
          test.status = 'failed';
          test.error = error;
          suiteResult.tests.push({ name: test.name, status: 'failed', error: error.message });
          if (!options.silent) {
            console.error(`❌ ${test.name}`);
            console.error(`   ${error.message}`);
          }
        }

        // Run afterEach hooks
        if (suite.afterEach) await this._runHook(suite.afterEach, 'afterEach');
        if (this.afterEachFn) await this._runHook(this.afterEachFn, 'afterEach');
      }

      if (!options.silent) {
        console.groupEnd();
      }

      summary.suites.push(suiteResult);
    }

    summary.duration = Math.round(performance.now() - startTime);
    this.results = summary;
    this.running = false;

    if (!options.silent) {
      console.log('');
      console.log('─'.repeat(50));
      console.log(`📊 Test Results: ${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped (${summary.duration}ms)`);
      if (summary.failed === 0) {
        console.log('🎉 All tests passed!');
      }
    }

    // Dispatch event for test runner page
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tests-complete', { detail: summary }));
    }

    return summary;
  },

  /**
   * Run a hook and handle errors
   * @param {Function} fn - Hook function
   * @param {string} name - Hook name
   * @private
   */
  async _runHook(fn, name) {
    try {
      await fn();
    } catch (error) {
      console.error(`Hook "${name}" failed:`, error);
    }
  },

  /**
   * Clear all registered tests
   */
  clear() {
    this.suites = [];
    this.currentSuite = null;
    this.beforeEachFn = null;
    this.afterEachFn = null;
    this.results = [];
  },

  /**
   * Generate HTML report of test results
   * @returns {string} HTML string
   */
  getReport() {
    if (!this.results || this.results.suites.length === 0) {
      return '<p>No test results available. Run tests first.</p>';
    }

    const { passed, failed, skipped, duration, suites } = this.results;
    const total = passed + failed + skipped;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    const statusColor = failed === 0 ? '#22c55e' : '#ef4444';
    const statusEmoji = failed === 0 ? '🎉' : '⚠️';

    let html = `
      <div class="test-report" style="font-family:system-ui,-apple-system,sans-serif;max-width:800px;margin:0 auto;padding:20px;">
        <div style="text-align:center;margin-bottom:30px;padding:20px;background:#f8fafc;border-radius:12px;">
          <div style="font-size:48px;margin-bottom:10px;">${statusEmoji}</div>
          <h2 style="margin:0 0 10px;color:#1f2937;">Test Results</h2>
          <div style="font-size:14px;color:#6b7280;">${total} tests in ${duration}ms</div>
        </div>
        
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:30px;">
          <div style="text-align:center;padding:16px;background:#dcfce7;border-radius:8px;">
            <div style="font-size:32px;font-weight:700;color:#16a34a;">${passed}</div>
            <div style="font-size:12px;color:#166534;text-transform:uppercase;">Passed</div>
          </div>
          <div style="text-align:center;padding:16px;background:${failed > 0 ? '#fee2e2' : '#dcfce7'};border-radius:8px;">
            <div style="font-size:32px;font-weight:700;color:${failed > 0 ? '#dc2626' : '#16a34a'};">${failed}</div>
            <div style="font-size:12px;color:${failed > 0 ? '#991b1b' : '#166534'};text-transform:uppercase;">Failed</div>
          </div>
          <div style="text-align:center;padding:16px;background:#f3f4f6;border-radius:8px;">
            <div style="font-size:32px;font-weight:700;color:#6b7280;">${skipped}</div>
            <div style="font-size:12px;color:#4b5563;text-transform:uppercase;">Skipped</div>
          </div>
          <div style="text-align:center;padding:16px;background:#eff6ff;border-radius:8px;">
            <div style="font-size:32px;font-weight:700;color:#2563eb;">${passRate}%</div>
            <div style="font-size:12px;color:#1e40af;text-transform:uppercase;">Pass Rate</div>
          </div>
        </div>
    `;

    for (const suite of suites) {
      const suiteFailed = suite.tests.some(t => t.status === 'failed');
      html += `
        <div style="margin-bottom:20px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <div style="padding:12px 16px;background:${suiteFailed ? '#fef2f2' : '#f9fafb'};border-bottom:1px solid #e5e7eb;">
            <strong style="color:${suiteFailed ? '#dc2626' : '#374151'};">${suite.name}</strong>
            <span style="float:right;font-size:12px;color:#6b7280;">
              ${suite.passed}✓ ${suite.failed > 0 ? `${suite.failed}✗ ` : ''}${suite.skipped > 0 ? `${suite.skipped}○` : ''}
            </span>
          </div>
          <div style="padding:8px 0;">
      `;

      for (const test of suite.tests) {
        const icon = test.status === 'passed' ? '✅' : test.status === 'failed' ? '❌' : '⚪';
        const color = test.status === 'passed' ? '#16a34a' : test.status === 'failed' ? '#dc2626' : '#9ca3af';
        html += `
          <div style="padding:8px 16px;display:flex;align-items:center;gap:8px;">
            <span>${icon}</span>
            <span style="color:${color};flex:1;">${test.name}</span>
            ${test.error ? `<span style="color:#dc2626;font-size:12px;">${test.error}</span>` : ''}
          </div>
        `;
      }

      html += '</div></div>';
    }

    html += '</div>';
    return html;
  },

  /**
   * Mock localStorage for isolated tests
   * @returns {Object} Mock storage object
   */
  createMockStorage() {
    const storage = {};
    return {
      getItem: (key) => storage[key] ?? null,
      setItem: (key, value) => { storage[key] = String(value); },
      removeItem: (key) => { delete storage[key]; },
      clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
      key: (index) => Object.keys(storage)[index] ?? null,
      get length() { return Object.keys(storage).length; },
      _data: storage
    };
  },

  /**
   * Create a mock Store for testing
   * @returns {Object} Mock Store object
   */
  createMockStore() {
    return {
      state: {
        phase: 'rampup',
        rampWeek: 'Week 1',
        rampDayIdx: 0,
        mesoWeek: 1,
        pplIdx: 0,
        program: 'standard',
        units: 'lbs',
        customExercises: [],
        fatigueFlags: 0,
        longestStreak: 0,
        allowedPrograms: ['standard', 'glute-focus'],
        goals: { targetWeight: 0, lifts: {} },
        manualPRs: {}
      },
      history: [],
      bodyWeights: [],
      measurements: [],
      screen: 'home',
      isOnline: true,
      theme: 'dark'
    };
  },

  /**
   * Get current test statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const suite of this.suites) {
      for (const test of suite.tests) {
        total++;
        if (test.status === 'passed') passed++;
        else if (test.status === 'failed') failed++;
        else if (test.status === 'skipped') skipped++;
      }
    }

    return { total, passed, failed, skipped };
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.Test = Test;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Test };
}
