// ============================================
// KEYBOARD SHORTCUTS MODULE
// Context-aware keyboard shortcuts for Hypertrophy Tracker
// ============================================

const Shortcuts = (() => {
  // ========== STATE ==========
  let shortcuts = new Map();
  let enabled = true;
  let currentScreen = 'home';
  let currentExerciseIndex = 0;
  let shortcutsModalOpen = false;
  let toastTimeout = null;
  let userPreferences = {};
  
  // Storage key for preferences
  const PREFS_KEY = 'ht-shortcuts-prefs';
  
  // ========== SCREEN DEFINITIONS ==========
  const SCREENS = {
    LOGIN: 'login',
    HOME: 'home',
    WORKOUT: 'workout',
    HISTORY: 'history',
    PROGRESS: 'progress',
    HEALTH: 'health',
    SETTINGS: 'settings',
    ADMIN: 'admin'
  };
  
  // ========== DEFAULT SHORTCUTS CONFIG ==========
  const DEFAULT_SHORTCUTS = {
    // Global shortcuts (active on all screens)
    global: {
      '?': { action: 'showHelp', label: 'Show shortcuts help', icon: '⌨️' },
      'Escape': { action: 'closeModal', label: 'Close modal / Cancel', icon: '✕' }
    },
    
    // Home screen shortcuts
    [SCREENS.HOME]: {
      'n': { action: 'startWorkout', label: 'Start next workout', icon: '▶' },
      'h': { action: 'goHistory', label: 'Go to History', icon: '📋' },
      'p': { action: 'goProgress', label: 'Go to Progress', icon: '📈' },
      'Ctrl+z': { action: 'undoWorkout', label: 'Undo last workout', icon: '↶' }
    },
    
    // Workout screen shortcuts
    [SCREENS.WORKOUT]: {
      'Ctrl+Enter': { action: 'finishWorkout', label: 'Finish workout', icon: '✓' },
      ' ': { action: 'toggleRest', label: 'Start/stop rest timer', icon: '⏱', preventDefault: true },
      '1': { action: 'rest60', label: 'Rest 60s', icon: '60s' },
      '2': { action: 'rest90', label: 'Rest 90s', icon: '90s' },
      '3': { action: 'rest120', label: 'Rest 120s', icon: '2m' },
      '4': { action: 'rest150', label: 'Rest 150s', icon: '2.5m' },
      '5': { action: 'rest180', label: 'Rest 180s', icon: '3m' },
      '6': { action: 'rest210', label: 'Rest 210s', icon: '3.5m' },
      '7': { action: 'rest240', label: 'Rest 240s', icon: '4m' },
      '8': { action: 'rest300', label: 'Rest 300s', icon: '5m' },
      '9': { action: 'rest360', label: 'Rest 360s', icon: '6m' },
      'ArrowLeft': { action: 'prevExercise', label: 'Previous exercise', icon: '←' },
      'ArrowRight': { action: 'nextExercise', label: 'Next exercise', icon: '→' },
      'j': { action: 'prevExercise', label: 'Previous exercise', icon: '↑' },
      'k': { action: 'nextExercise', label: 'Next exercise', icon: '↓' },
      'Tab': { action: 'nextInput', label: 'Next input field', icon: '⇥', preventDefault: true },
      'Shift+Tab': { action: 'prevInput', label: 'Previous input field', icon: '⇤', preventDefault: true },
      'c': { action: 'copyLast', label: 'Copy last weights', icon: '⎘' },
      'w': { action: 'toggleWarmup', label: 'Toggle warm-up', icon: '🔥' },
      'l': { action: 'togglePlates', label: 'Toggle plate calc', icon: '⚖' }
    },
    
    // History screen shortcuts
    [SCREENS.HISTORY]: {
      'e': { action: 'editWorkout', label: 'Edit selected workout', icon: '✎' },
      'd': { action: 'deleteWorkout', label: 'Delete selected workout', icon: '🗑' },
      's': { action: 'shareWorkout', label: 'Share workout', icon: '↗' },
      'ArrowUp': { action: 'selectPrev', label: 'Select previous', icon: '↑' },
      'ArrowDown': { action: 'selectNext', label: 'Select next', icon: '↓' }
    },
    
    // Progress screen shortcuts
    [SCREENS.PROGRESS]: {
      'r': { action: 'refreshData', label: 'Refresh data', icon: '↻' },
      'ArrowLeft': { action: 'prevChart', label: 'Previous chart', icon: '←' },
      'ArrowRight': { action: 'nextChart', label: 'Next chart', icon: '→' }
    }
  };
  
  // ========== HELPER FUNCTIONS ==========
  
  /**
   * Load user preferences from localStorage
   */
  function loadPreferences() {
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      if (saved) {
        userPreferences = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load shortcut preferences:', e);
      userPreferences = {};
    }
  }
  
  /**
   * Save user preferences to localStorage
   */
  function savePreferences() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(userPreferences));
    } catch (e) {
      console.warn('Failed to save shortcut preferences:', e);
    }
  }
  
  /**
   * Check if an element is an input field
   */
  function isInputFocused() {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName.toLowerCase();
    const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';
    const isContentEditable = active.isContentEditable;
    return isInput || isContentEditable;
  }
  
  /**
   * Get input type for more specific handling
   */
  function getFocusedInputType() {
    const active = document.activeElement;
    if (!active) return null;
    if (active.tagName.toLowerCase() === 'input') {
      return active.type || 'text';
    }
    return null;
  }
  
  /**
   * Build a key identifier from keyboard event
   */
  function getKeyIdentifier(e) {
    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Meta');
    
    // Handle special keys
    let key = e.key;
    if (key === ' ') key = ' ';
    
    parts.push(key);
    return parts.join('+');
  }
  
  /**
   * Show toast notification
   */
  function showToast(message, icon = '') {
    // Remove existing toast
    const existing = document.getElementById('shortcut-toast');
    if (existing) existing.remove();
    
    // Clear timeout
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.id = 'shortcut-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--card, #111122);
      border: 1px solid var(--accent, #E94560);
      border-radius: 8px;
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text, #e4e4e7);
      z-index: 9999;
      box-shadow: 0 4px 20px rgba(0,0,0,.4);
      animation: slideUp 0.2s ease-out;
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: var(--font, 'DM Sans', sans-serif);
    `;
    toast.innerHTML = `${icon ? `<span>${icon}</span>` : ''}<span>${message}</span>`;
    
    document.body.appendChild(toast);
    
    // Auto-hide after 2 seconds
    toastTimeout = setTimeout(() => {
      toast.style.animation = 'fadeOut 0.2s ease-in forwards';
      setTimeout(() => toast.remove(), 200);
    }, 2000);
  }
  
  /**
   * Execute a shortcut action
   */
  function executeAction(actionId, context = {}) {
    const action = shortcuts.get(actionId);
    if (!action || !action.callback) return false;
    
    try {
      action.callback(context);
      
      // Show toast if enabled in preferences
      if (userPreferences.showToasts !== false && action.config) {
        showToast(action.config.label, action.config.icon);
      }
      
      return true;
    } catch (e) {
      console.error('Shortcut action failed:', actionId, e);
      return false;
    }
  }
  
  /**
   * Handle keyboard events
   */
  function handleKeyDown(e) {
    if (!enabled) return;
    if (shortcutsModalOpen) {
      // Only allow Escape in modal
      if (e.key === 'Escape') {
        closeShortcutsHelp();
        e.preventDefault();
      }
      return;
    }
    
    const keyId = getKeyIdentifier(e);
    const simpleKey = e.key;
    
    // Check for registered shortcuts
    let action = shortcuts.get(keyId) || shortcuts.get(simpleKey);
    
    // Check screen-specific shortcuts
    if (!action && DEFAULT_SHORTCUTS[currentScreen]) {
      const screenShortcut = DEFAULT_SHORTCUTS[currentScreen][keyId] || DEFAULT_SHORTCUTS[currentScreen][simpleKey];
      if (screenShortcut) {
        action = { config: screenShortcut, callback: getDefaultCallback(screenShortcut.action) };
      }
    }
    
    // Check global shortcuts
    if (!action) {
      const globalShortcut = DEFAULT_SHORTCUTS.global[keyId] || DEFAULT_SHORTCUTS.global[simpleKey];
      if (globalShortcut) {
        action = { config: globalShortcut, callback: getDefaultCallback(globalShortcut.action) };
      }
    }
    
    if (!action) return;
    
    // Skip certain shortcuts when input is focused
    if (isInputFocused()) {
      // Allow these even in inputs
      const allowedInInputs = ['Escape', 'Ctrl+Enter', '?', 'Ctrl+?'];
      if (!allowedInInputs.includes(keyId) && !action.config?.allowInInput) {
        return;
      }
      
      // Space in inputs should not trigger rest timer unless explicitly allowed
      if (simpleKey === ' ' && !action.config?.allowInInput) {
        return;
      }
    }
    
    // Prevent default if specified
    if (action.config?.preventDefault) {
      e.preventDefault();
    }
    
    // Execute the action
    const context = {
      screen: currentScreen,
      exerciseIndex: currentExerciseIndex,
      event: e
    };
    
    const success = executeAction(action.id || action.config?.action, context);
    
    if (success && action.config?.preventDefault) {
      e.preventDefault();
    }
  }
  
  /**
   * Get default callback for built-in actions
   */
  function getDefaultCallback(actionName) {
    const callbacks = {
      showHelp: () => showShortcutsHelp(),
      closeModal: () => {
        if (typeof modal !== 'undefined' && modal) {
          modal = null;
          if (typeof render === 'function') render();
        }
      },
      startWorkout: () => {
        if (typeof startWorkout === 'function' && typeof getNextDay === 'function') {
          const next = getNextDay();
          if (next) startWorkout(next);
        }
      },
      goHistory: () => {
        if (typeof screen !== 'undefined') {
          screen = 'history';
          if (typeof render === 'function') render();
        }
      },
      goProgress: () => {
        if (typeof screen !== 'undefined') {
          screen = 'progress';
          if (typeof render === 'function') render();
        }
      },
      undoWorkout: () => {
        if (typeof undoLastWorkout === 'function') undoLastWorkout();
      },
      finishWorkout: () => {
        if (typeof finishWorkout === 'function') finishWorkout();
      },
      toggleRest: () => {
        if (typeof restTimer !== 'undefined') {
          if (restTimer > 0) {
            if (typeof stopRest === 'function') stopRest();
          } else {
            if (typeof startRest === 'function') startRest(90);
          }
        }
      },
      rest60: () => { if (typeof startRest === 'function') startRest(60); },
      rest90: () => { if (typeof startRest === 'function') startRest(90); },
      rest120: () => { if (typeof startRest === 'function') startRest(120); },
      rest150: () => { if (typeof startRest === 'function') startRest(150); },
      rest180: () => { if (typeof startRest === 'function') startRest(180); },
      rest210: () => { if (typeof startRest === 'function') startRest(210); },
      rest240: () => { if (typeof startRest === 'function') startRest(240); },
      rest300: () => { if (typeof startRest === 'function') startRest(300); },
      rest360: () => { if (typeof startRest === 'function') startRest(360); },
      prevExercise: () => navigateExercise(-1),
      nextExercise: () => navigateExercise(1),
      nextInput: () => navigateInput(1),
      prevInput: () => navigateInput(-1),
      copyLast: () => {
        if (typeof copyLast === 'function' && typeof workoutExercises !== 'undefined') {
          const ex = workoutExercises[currentExerciseIndex];
          if (ex) copyLast(currentExerciseIndex, ex.name);
        }
      },
      toggleWarmup: () => {
        if (typeof expandedWarmup !== 'undefined') {
          expandedWarmup[currentExerciseIndex] = !expandedWarmup[currentExerciseIndex];
          if (typeof render === 'function') render();
        }
      },
      togglePlates: () => {
        if (typeof expandedPlateCalc !== 'undefined') {
          expandedPlateCalc[currentExerciseIndex] = !expandedPlateCalc[currentExerciseIndex];
          if (typeof render === 'function') render();
        }
      }
    };
    
    return callbacks[actionName] || (() => console.log('Action:', actionName));
  }
  
  /**
   * Navigate between exercises in workout view
   */
  function navigateExercise(direction) {
    if (typeof workoutExercises === 'undefined') return;
    const newIndex = currentExerciseIndex + direction;
    if (newIndex >= 0 && newIndex < workoutExercises.length) {
      currentExerciseIndex = newIndex;
      
      // Scroll to exercise card
      const cards = document.querySelectorAll('.card');
      if (cards[newIndex]) {
        cards[newIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight effect
        cards[newIndex].style.animation = 'pulse 0.5s';
        setTimeout(() => {
          cards[newIndex].style.animation = '';
        }, 500);
      }
      
      showToast(`Exercise ${newIndex + 1}/${workoutExercises.length}`, '🎯');
    }
  }
  
  /**
   * Navigate between input fields
   */
  function navigateInput(direction) {
    const inputs = Array.from(document.querySelectorAll('input.set-input, input.bw-input, input.measure-input'));
    const current = document.activeElement;
    const currentIdx = inputs.indexOf(current);
    
    let nextIdx;
    if (currentIdx === -1) {
      nextIdx = direction > 0 ? 0 : inputs.length - 1;
    } else {
      nextIdx = currentIdx + direction;
    }
    
    if (nextIdx >= 0 && nextIdx < inputs.length) {
      inputs[nextIdx].focus();
      inputs[nextIdx].select();
    }
  }
  
  /**
   * Build the shortcuts help modal content
   */
  function buildShortcutsHelpContent() {
    const sections = [];
    
    // Current screen shortcuts
    if (DEFAULT_SHORTCUTS[currentScreen] && Object.keys(DEFAULT_SHORTCUTS[currentScreen]).length > 0) {
      sections.push({
        title: getScreenTitle(currentScreen),
        shortcuts: Object.entries(DEFAULT_SHORTCUTS[currentScreen]).map(([key, config]) => ({
          key: formatKeyDisplay(key),
          label: config.label,
          icon: config.icon
        }))
      });
    }
    
    // Global shortcuts
    sections.push({
      title: 'Global',
      shortcuts: Object.entries(DEFAULT_SHORTCUTS.global).map(([key, config]) => ({
        key: formatKeyDisplay(key),
        label: config.label,
        icon: config.icon
      }))
    });
    
    // Build HTML
    return sections.map(section => `
      <div style="margin-bottom: 16px;">
        <div style="font-size: 11px; color: var(--accent); text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 8px;">
          ${section.title}
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${section.shortcuts.map(s => `
            <div style="display: flex; align-items: center; gap: 10px; font-size: 13px;">
              <kbd style="background: var(--input-bg); border: 1px solid var(--muted); border-radius: 4px; padding: 3px 8px; font-family: var(--mono); font-size: 11px; min-width: 50px; text-align: center;">
                ${s.key}
              </kbd>
              <span style="color: var(--text);">${s.icon ? s.icon + ' ' : ''}${s.label}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }
  
  /**
   * Format key for display
   */
  function formatKeyDisplay(key) {
    return key
      .replace('ArrowLeft', '←')
      .replace('ArrowRight', '→')
      .replace('ArrowUp', '↑')
      .replace('ArrowDown', '↓')
      .replace(' ', 'Space');
  }
  
  /**
   * Get human-readable screen title
   */
  function getScreenTitle(screen) {
    const titles = {
      [SCREENS.HOME]: 'Home Screen',
      [SCREENS.WORKOUT]: 'Workout',
      [SCREENS.HISTORY]: 'History',
      [SCREENS.PROGRESS]: 'Progress',
      [SCREENS.HEALTH]: 'Health',
      [SCREENS.SETTINGS]: 'Settings',
      [SCREENS.ADMIN]: 'Admin'
    };
    return titles[screen] || screen;
  }
  
  // ========== PUBLIC API ==========
  
  /**
   * Register a new keyboard shortcut
   * @param {string} key - The key combination (e.g., 'Ctrl+Enter', 'n')
   * @param {Function} callback - Function to execute when shortcut is triggered
   * @param {Object} options - Configuration options
   * @param {string} options.label - Human-readable description
   * @param {string} options.icon - Emoji or icon character
   * @param {string[]} options.screens - Screens where this shortcut is active
   * @param {boolean} options.preventDefault - Whether to prevent default browser behavior
   * @param {boolean} options.allowInInput - Whether shortcut works when input is focused
   */
  function registerShortcut(key, callback, options = {}) {
    const id = options.id || `shortcut_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    shortcuts.set(key, {
      id,
      key,
      callback,
      config: {
        label: options.label || key,
        icon: options.icon || '',
        screens: options.screens || ['all'],
        preventDefault: options.preventDefault || false,
        allowInInput: options.allowInInput || false
      }
    });
    
    shortcuts.set(id, shortcuts.get(key));
    
    return id;
  }
  
  /**
   * Unregister a keyboard shortcut
   * @param {string} key - The key or ID to unregister
   */
  function unregisterShortcut(key) {
    const shortcut = shortcuts.get(key);
    if (shortcut) {
      shortcuts.delete(key);
      if (shortcut.id) shortcuts.delete(shortcut.id);
      return true;
    }
    return false;
  }
  
  /**
   * Enable all keyboard shortcuts
   */
  function enableShortcuts() {
    enabled = true;
    userPreferences.enabled = true;
    savePreferences();
  }
  
  /**
   * Disable all keyboard shortcuts
   */
  function disableShortcuts() {
    enabled = false;
    userPreferences.enabled = false;
    savePreferences();
  }
  
  /**
   * Show the shortcuts help modal
   */
  function showShortcutsHelp() {
    shortcutsModalOpen = true;
    
    const overlay = document.createElement('div');
    overlay.id = 'shortcuts-help-modal';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.75);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: fadeIn 0.15s;
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: var(--card, #111122);
      border: 1px solid var(--accent, #E94560);
      border-radius: 14px;
      padding: 24px;
      max-width: 380px;
      width: 100%;
      max-height: 80vh;
      overflow-y: auto;
      animation: scaleIn 0.2s;
      font-family: var(--font, 'DM Sans', sans-serif);
    `;
    
    modal.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="color: var(--white, #fff); font-size: 18px; font-weight: 800; margin: 0;">⌨️ Keyboard Shortcuts</h3>
        <button id="shortcuts-close" style="background: none; border: none; color: var(--dim); font-size: 20px; cursor: pointer; padding: 0; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 4px;">✕</button>
      </div>
      <div style="color: var(--dim); font-size: 12px; margin-bottom: 16px;">
        Current screen: <strong style="color: var(--accent);">${getScreenTitle(currentScreen)}</strong>
      </div>
      ${buildShortcutsHelpContent()}
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--card-border); font-size: 11px; color: var(--dim);">
        Press <kbd style="background: var(--input-bg); padding: 2px 6px; border-radius: 3px;">?</kbd> anytime to show this help
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Close handlers
    const close = () => closeShortcutsHelp();
    document.getElementById('shortcuts-close').onclick = close;
    overlay.onclick = (e) => {
      if (e.target === overlay) close();
    };
  }
  
  /**
   * Close the shortcuts help modal
   */
  function closeShortcutsHelp() {
    const modal = document.getElementById('shortcuts-help-modal');
    if (modal) {
      modal.style.animation = 'fadeOut 0.15s forwards';
      setTimeout(() => {
        modal.remove();
        shortcutsModalOpen = false;
      }, 150);
    }
    shortcutsModalOpen = false;
  }
  
  /**
   * Set the current active screen
   * @param {string} screenName - Name of the current screen
   */
  function setScreen(screenName) {
    currentScreen = screenName;
    currentExerciseIndex = 0;
  }
  
  /**
   * Set the current exercise index (for workout screen)
   * @param {number} index - Exercise index
   */
  function setExerciseIndex(index) {
    currentExerciseIndex = index;
  }
  
  /**
   * Get current settings
   */
  function getSettings() {
    return {
      enabled,
      showToasts: userPreferences.showToasts !== false,
      currentScreen
    };
  }
  
  /**
   * Update settings
   */
  function updateSettings(settings) {
    if (settings.enabled !== undefined) {
      enabled = settings.enabled;
      userPreferences.enabled = enabled;
    }
    if (settings.showToasts !== undefined) {
      userPreferences.showToasts = settings.showToasts;
    }
    savePreferences();
  }
  
  /**
   * Get all registered shortcuts (for settings/export)
   */
  function getAllShortcuts() {
    const result = [];
    for (const [key, value] of shortcuts) {
      if (!value.id || value.id === key) continue; // Skip duplicates
      result.push({
        key,
        id: value.id,
        config: value.config
      });
    }
    return result;
  }
  
  /**
   * Initialize the shortcuts module
   */
  function init() {
    loadPreferences();
    
    // Apply saved preferences
    if (userPreferences.enabled !== undefined) {
      enabled = userPreferences.enabled;
    }
    
    // Add global event listener
    document.addEventListener('keydown', handleKeyDown);
    
    // Add CSS animations if not present
    if (!document.getElementById('shortcuts-animations')) {
      const style = document.createElement('style');
      style.id = 'shortcuts-animations';
      style.textContent = `
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
      `;
      document.head.appendChild(style);
    }
    
    console.log('Shortcuts module initialized');
  }
  
  /**
   * Clean up the shortcuts module
   */
  function destroy() {
    document.removeEventListener('keydown', handleKeyDown);
    const modal = document.getElementById('shortcuts-help-modal');
    if (modal) modal.remove();
    const toast = document.getElementById('shortcut-toast');
    if (toast) toast.remove();
  }
  
  // Auto-initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Public API
  return {
    registerShortcut,
    unregisterShortcut,
    enableShortcuts,
    disableShortcuts,
    showShortcutsHelp,
    closeShortcutsHelp,
    setScreen,
    setExerciseIndex,
    getSettings,
    updateSettings,
    getAllShortcuts,
    init,
    destroy,
    SCREENS
  };
})();

// Export for module systems or global use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Shortcuts;
}
