// ============================================
// ERROR HANDLER — Global error boundary & reporting
// ============================================
const ErrorHandler = (() => {
  // Error storage keys
  const ERROR_LOG_KEY = 'ht-error-log';
  const MAX_STORED_ERRORS = 50;
  const ERROR_LOG_RETENTION_DAYS = 30;

  // Known error types and recovery suggestions
  const ERROR_PATTERNS = {
    network: {
      patterns: ['network', 'timeout', 'offline', 'failed to fetch', 'net::ERR', 'firebase'],
      message: 'Connection issue detected. Please check your internet connection.',
      recovery: 'Check your network connection and try again. Data is saved locally.',
    },
    storage: {
      patterns: ['localstorage', 'quota', 'storage', 'exceeded'],
      message: 'Storage issue. Your device may be low on space.',
      recovery: 'Try clearing some browser data or freeing up device storage.',
    },
    firebase: {
      patterns: ['firebase', 'auth/', 'permission_denied', 'unauthenticated'],
      message: 'Sync service issue. Working in offline mode.',
      recovery: 'Your data is saved locally. Try logging out and back in to restore sync.',
    },
    syntax: {
      patterns: ['syntaxerror', 'unexpected token', 'unexpected end'],
      message: 'Application error. The app may need to be refreshed.',
      recovery: 'Please clear your browser cache and reload the page.',
    },
    type: {
      patterns: ['typeerror', 'cannot read', 'undefined is not', 'null is not', 'of undefined', 'of null'],
      message: 'Something went wrong while displaying data.',
      recovery: 'Try refreshing the page. If the issue persists, please report it.',
    },
    memory: {
      patterns: ['out of memory', 'memory', 'heap'],
      message: 'Your device is running low on memory.',
      recovery: 'Close other apps or browser tabs and try again.',
    },
  };

  // State
  let isInitialized = false;
  let pendingErrors = [];
  let errorModalOpen = false;

  // Utility: Get user-friendly error info
  function classifyError(error) {
    const msg = (error?.message || String(error)).toLowerCase();
    
    for (const [type, config] of Object.entries(ERROR_PATTERNS)) {
      if (config.patterns.some(p => msg.includes(p))) {
        return { type, ...config };
      }
    }
    
    return {
      type: 'unknown',
      message: 'An unexpected error occurred.',
      recovery: 'Please try refreshing the page.',
    };
  }

  // Utility: Generate error ID
  function generateErrorId() {
    return `err-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  // Utility: Get error log from localStorage
  function getErrorLog() {
    try {
      const log = localStorage.getItem(ERROR_LOG_KEY);
      return log ? JSON.parse(log) : [];
    } catch {
      return [];
    }
  }

  // Utility: Save error to localStorage
  function saveErrorToLog(errorInfo) {
    try {
      let log = getErrorLog();
      
      // Add new error
      log.push({
        id: generateErrorId(),
        timestamp: new Date().toISOString(),
        ...errorInfo,
      });

      // Clean old errors
      const cutoff = Date.now() - (ERROR_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      log = log.filter(e => new Date(e.timestamp).getTime() > cutoff);

      // Limit total errors
      if (log.length > MAX_STORED_ERRORS) {
        log = log.slice(-MAX_STORED_ERRORS);
      }

      localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(log));
    } catch (e) {
      console.error('Failed to save error log:', e);
    }
  }

  // Create error info object
  function createErrorInfo(error, source, line, column, stack) {
    const classified = classifyError(error);
    const isAdmin = typeof Storage !== 'undefined' && Storage.getPin && Storage.getPin() === '01131998';
    
    return {
      message: error?.message || String(error),
      userMessage: classified.message,
      type: classified.type,
      recovery: classified.recovery,
      source: source || 'unknown',
      line: line || 0,
      column: column || 0,
      stack: stack || error?.stack || '',
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: Date.now(),
      isAdmin,
    };
  }

  // Show toast notification
  function showToast(message, isError = true) {
    // Remove existing toasts
    const existing = document.querySelector('.error-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.style.cssText = `
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: ${isError ? '#ef4444' : '#22c55e'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideDown 0.3s ease;
      max-width: 90vw;
      text-align: center;
    `;
    toast.textContent = message;

    // Add animation keyframes if not present
    if (!document.getElementById('error-animations')) {
      const style = document.createElement('style');
      style.id = 'error-animations';
      style.textContent = `
        @keyframes slideDown {
          from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  // Show error modal
  function showErrorModal(errorInfo) {
    if (errorModalOpen) return;
    errorModalOpen = true;

    const overlay = document.createElement('div');
    overlay.className = 'error-modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 20px;
    `;

    const modal = document.createElement('div');
    modal.className = 'error-modal';
    modal.style.cssText = `
      background: var(--card, #1a1a2e);
      border-radius: 12px;
      max-width: 400px;
      width: 100%;
      max-height: 80vh;
      overflow: auto;
      border: 1px solid var(--card-border, #2a2a3e);
    `;

    const isCritical = errorInfo.type === 'syntax' || errorInfo.type === 'memory';

    modal.innerHTML = `
      <div style="padding: 20px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
          <span style="font-size: 24px;">${isCritical ? '⚠️' : '🔧'}</span>
          <h3 style="margin: 0; font-size: 18px; color: var(--text, #fff);">Something Went Wrong</h3>
        </div>
        
        <p style="color: var(--text, #fff); font-size: 14px; margin-bottom: 8px; line-height: 1.5;">
          ${escapeHtml(errorInfo.userMessage)}
        </p>
        
        <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; margin: 16px 0;">
          <p style="color: var(--dim, #888); font-size: 12px; margin: 0 0 4px 0;">Suggested Fix:</p>
          <p style="color: var(--text, #fff); font-size: 13px; margin: 0; line-height: 1.4;">
            ${escapeHtml(errorInfo.recovery)}
          </p>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="error-btn-primary" style="
            flex: 1;
            min-width: 120px;
            padding: 10px 16px;
            background: var(--accent, #E94560);
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
          ">Reload App</button>
          
          ${errorInfo.isAdmin ? `
            <button class="error-btn-report" style="
              flex: 1;
              min-width: 120px;
              padding: 10px 16px;
              background: transparent;
              color: var(--accent, #E94560);
              border: 1px solid var(--accent, #E94560);
              border-radius: 8px;
              font-weight: 600;
              cursor: pointer;
            ">📋 Copy Details</button>
          ` : ''}
          
          <button class="error-btn-close" style="
            flex: 1;
            min-width: 120px;
            padding: 10px 16px;
            background: transparent;
            color: var(--dim, #888);
            border: 1px solid var(--card-border, #2a2a3e);
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
          ">Dismiss</button>
        </div>

        ${errorInfo.isAdmin ? `
          <details style="margin-top: 16px;">
            <summary style="color: var(--dim, #888); font-size: 12px; cursor: pointer;">Technical Details</summary>
            <pre style="
              background: #0a0a12;
              padding: 12px;
              border-radius: 6px;
              font-size: 11px;
              color: #888;
              overflow: auto;
              max-height: 200px;
              margin-top: 8px;
            ">${escapeHtml(JSON.stringify(errorInfo, null, 2))}</pre>
          </details>
        ` : ''}
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Event handlers
    modal.querySelector('.error-btn-primary').onclick = () => {
      window.location.reload();
    };

    const closeBtn = modal.querySelector('.error-btn-close');
    if (closeBtn) {
      closeBtn.onclick = () => {
        overlay.remove();
        errorModalOpen = false;
      };
    }

    const reportBtn = modal.querySelector('.error-btn-report');
    if (reportBtn) {
      reportBtn.onclick = () => {
        copyToClipboard(JSON.stringify(errorInfo, null, 2));
        reportBtn.textContent = '✅ Copied!';
        setTimeout(() => {
          reportBtn.textContent = '📋 Copy Details';
        }, 2000);
      };
    }

    // Close on overlay click
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.remove();
        errorModalOpen = false;
      }
    };
  }

  // Utility: Escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Utility: Copy to clipboard
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }

  // Process pending errors
  function processPendingErrors() {
    while (pendingErrors.length > 0) {
      const error = pendingErrors.shift();
      saveErrorToLog(error);
      
      // Show toast for non-critical errors
      if (error.type !== 'syntax' && error.type !== 'memory') {
        showToast(error.userMessage, true);
      }
    }
  }

  // Global error handler
  function handleError(msg, source, line, col, err) {
    const errorInfo = createErrorInfo(err || msg, source, line, col, err?.stack);
    
    // Log to console
    console.error('[ErrorHandler]', errorInfo);

    // If not initialized yet, queue for later
    if (!isInitialized) {
      pendingErrors.push(errorInfo);
      return false;
    }

    // Save and show
    saveErrorToLog(errorInfo);

    // Show appropriate UI based on severity
    const isCritical = errorInfo.type === 'syntax' || errorInfo.type === 'memory';
    if (isCritical) {
      showErrorModal(errorInfo);
    } else {
      showToast(errorInfo.userMessage, true);
    }

    // Return false to allow default browser handling as well
    return false;
  }

  // Promise rejection handler
  function handleRejection(event) {
    const error = event.reason;
    const errorInfo = createErrorInfo(
      error,
      'promise-rejection',
      0,
      0,
      error?.stack
    );

    console.error('[ErrorHandler] Unhandled Promise Rejection:', errorInfo);

    if (!isInitialized) {
      pendingErrors.push(errorInfo);
      return;
    }

    saveErrorToLog(errorInfo);

    // Don't show modal for network timeouts - they're common and handled gracefully
    if (errorInfo.type !== 'network' || !errorInfo.message?.toLowerCase().includes('timeout')) {
      showToast(errorInfo.userMessage, true);
    }
  }

  // Public API
  return {
    // Initialize global error handlers
    init() {
      if (isInitialized) return;

      // Global error handler
      window.onerror = handleError;

      // Unhandled promise rejection handler
      window.onunhandledrejection = handleRejection;

      // Monitor console.error for additional context
      const originalError = console.error;
      console.error = function(...args) {
        // Log to original console
        originalError.apply(console, args);

        // Check if this is a Firebase auth error that wasn't caught
        const errorStr = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        if (errorStr.includes('auth/') && !errorStr.includes('ErrorHandler')) {
          // This might be an uncaught auth error - log it
          const authError = new Error(args.find(a => typeof a === 'string') || 'Auth error');
          saveErrorToLog(createErrorInfo(authError, 'console', 0, 0, errorStr));
        }
      };

      isInitialized = true;
      processPendingErrors();

      console.log('[ErrorHandler] Initialized');
    },

    // Handle runtime errors programmatically
    handleError(error, context = {}) {
      const errorInfo = createErrorInfo(
        error,
        context.source || 'manual',
        context.line || 0,
        context.column || 0,
        error?.stack
      );

      console.error('[ErrorHandler] Manual error:', errorInfo);
      saveErrorToLog(errorInfo);
      showToast(errorInfo.userMessage, true);

      return errorInfo;
    },

    // Handle promise rejections programmatically
    handleRejection(reason) {
      handleRejection({ reason });
    },

    // Show user-friendly error modal
    showError(message, isCritical = false) {
      const errorInfo = createErrorInfo(new Error(message), 'manual', 0, 0, '');
      errorInfo.userMessage = message;
      
      if (isCritical) {
        showErrorModal(errorInfo);
      } else {
        showToast(message, true);
      }
    },

    // Show success toast
    showSuccess(message) {
      showToast(message, false);
    },

    // Attempt recovery for known error types
    attemptRecovery(errorType) {
      const patterns = ERROR_PATTERNS[errorType];
      if (!patterns) return false;

      console.log('[ErrorHandler] Attempting recovery for:', errorType);

      switch (errorType) {
        case 'network':
          // App works offline, nothing to do
          return true;
        
        case 'storage':
          // Try to clear some space
          try {
            // Remove old error logs first
            localStorage.removeItem(ERROR_LOG_KEY);
            return true;
          } catch {
            return false;
          }
        
        case 'firebase':
          // App falls back to localStorage
          return true;
        
        case 'syntax':
        case 'memory':
          // These require reload
          return false;
        
        default:
          return false;
      }
    },

    // Report error to admin (copy to clipboard or store for later)
    reportError(error) {
      const errorInfo = typeof error === 'object' && error.timestamp 
        ? error 
        : createErrorInfo(error, 'report', 0, 0, error?.stack);

      saveErrorToLog(errorInfo);

      // If admin, copy to clipboard
      const isAdmin = typeof Storage !== 'undefined' && Storage.getPin && Storage.getPin() === '01131998';
      if (isAdmin) {
        copyToClipboard(JSON.stringify(errorInfo, null, 2));
        showSuccess('Error details copied to clipboard');
      }

      return errorInfo;
    },

    // Get error log for debugging
    getErrorLog() {
      return getErrorLog();
    },

    // Clear error log
    clearErrorLog() {
      try {
        localStorage.removeItem(ERROR_LOG_KEY);
        return true;
      } catch {
        return false;
      }
    },

    // Check if there are recent errors
    hasRecentErrors(minutes = 5) {
      const log = getErrorLog();
      const cutoff = Date.now() - (minutes * 60 * 1000);
      return log.some(e => new Date(e.timestamp).getTime() > cutoff);
    },

    // Wrap async function with error handling
    wrapAsync(fn, context = 'async') {
      return async (...args) => {
        try {
          return await fn(...args);
        } catch (error) {
          this.handleError(error, { source: context });
          throw error;
        }
      };
    },

    // Wrap sync function with error handling
    wrap(fn, context = 'sync') {
      return (...args) => {
        try {
          return fn(...args);
        } catch (error) {
          this.handleError(error, { source: context });
          throw error;
        }
      };
    },
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ErrorHandler.init());
} else {
  ErrorHandler.init();
}
