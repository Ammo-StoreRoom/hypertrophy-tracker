// ============================================
// HYPERTROPHY TRACKER — Main Application (Modular)
// ============================================

// ========== INITIALIZATION ==========

/**
 * Initialize the application
 */
async function init() {
  // Set up PWA and offline handlers
  setupPWA();
  setupOffline();
  setupPullToRefresh();
  
  // Initialize backup module
  if (typeof Backup !== 'undefined') {
    Backup.init();
  }
  
  // Initialize router
  Router.init();
  
  // Register all screens
  Router.registerAll({
    login: renderLogin,
    home: renderHome,
    workout: renderWorkout,
    history: renderHistory,
    progress: renderProgress,
    health: renderHealth,
    settings: renderSettings,
    templates: renderTemplates,
    admin: renderAdmin
  });
  
  try {
    // Attempt auto-login
    if (!await Storage.autoLogin()) {
      Store.screen = 'login';
      Router.render();
      return;
    }
    
    // Load data and start
    await loadData();
  } catch (e) {
    console.error('Init failed:', e);
    Store.screen = 'login';
    Router.render();
  }
}

/**
 * Load user data from storage
 */
async function loadData() {
  Storage.unlisten();
  await Store.init();
  Store.screen = 'home';
  Store.activeDay = null;
  Store.inputs = {};
  Store.workoutStart = null;
  Router.render();
  
  // Register for real-time updates
  await registerUser();
}

/**
 * Register current user in registry
 */
async function registerUser() {
  await Storage.registerSelf({
    lastActive: new Date().toISOString().split('T')[0],
    program: Store.state.program,
    phase: Store.state.phase,
    workoutCount: Store.history.length
  });
}

// ========== AUTHENTICATION ==========

/**
 * Handle login with PIN
 * @param {string} pin - 8-digit PIN (MMDDYYYY)
 */
async function doLogin(pin) {
  const trimmed = String(pin ?? '').trim();
  if (!/^\d{8}$/.test(trimmed)) {
    const err = document.getElementById('login-error');
    if (err) err.textContent = 'Enter 8 digits (MMDDYYYY)';
    return;
  }
  
  try {
    // Clear stale admin password if logging in with non-admin PIN
    if (trimmed !== Store.ADMIN_PIN) {
      localStorage.removeItem('ht-admin-password');
    }
    // Admin PIN must have Firebase password set
    else if (trimmed === Store.ADMIN_PIN && !localStorage.getItem('ht-admin-password')) {
      const didSet = await promptAdminPassword();
      if (!didSet) return;
    }
    
    const ok = await Storage.login(trimmed);
    if (!ok) {
      const err = document.getElementById('login-error');
      if (err) err.textContent = 'Enter 8 digits (MMDDYYYY)';
      return;
    }
    
    await loadData();
    Store.modal = null;
  } catch (e) {
    if (e?.message === 'admin_password_required') {
      Store.loginPinValue = trimmed;
      Store.showModal({
        title: 'Admin password required',
        message: 'Enter your Firebase Auth password for ayman98a@gmail.com',
        confirmLabel: 'Set password',
        content: el('div', null,
          el('input', { 
            id: 'admin-pw-error', 
            type: 'password', 
            cls: 'set-input', 
            css: 'text-align:left;margin-top:10px', 
            placeholder: 'Password', 
            autocomplete: 'current-password' 
          })
        ),
        onConfirm: () => {
          const pw = document.getElementById('admin-pw-error')?.value || '';
          if (pw) {
            Storage.setAdminPassword(pw);
            Store.closeModal();
            doLogin(trimmed);
          }
        }
      });
    } else {
      const err = document.getElementById('login-error');
      if (err) err.textContent = 'Login failed. Check connection / Firebase Auth.';
      console.warn('Login failed:', e);
    }
  }
}

/**
 * Prompt for admin password
 * @returns {Promise<boolean>} Whether password was set
 */
async function promptAdminPassword() {
  return new Promise(resolve => {
    Store.showModal({
      title: 'Admin password',
      message: 'Enter your Firebase Auth password for ayman98a@gmail.com (saved on this device).',
      confirmLabel: 'Set password',
      content: el('div', null,
        el('input', { 
          id: 'admin-pw', 
          type: 'password', 
          cls: 'set-input', 
          css: 'text-align:left;margin-top:10px', 
          placeholder: 'Password', 
          autocomplete: 'current-password' 
        })
      ),
      onConfirm: () => {
        const pw = document.getElementById('admin-pw')?.value || '';
        if (pw) Storage.setAdminPassword(pw);
        Store.closeModal();
        resolve(true);
      },
      onCancel: () => resolve(false)
    });
  });
}

/**
 * Log out current user
 */
function doLogout() {
  Storage.unlisten();
  Storage.logout();
  Store.loginPinValue = '';
  Store.screen = 'login';
  Router.render();
}

// ========== PWA & OFFLINE ==========

/**
 * Set up PWA install prompt handling
 */
function setupPWA() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    Store.deferredPrompt = e;
    if (!Store.installDismissed && Store.screen !== 'login') Router.render();
  });
  
  window.addEventListener('appinstalled', () => {
    Store.deferredPrompt = null;
    Router.render();
  });
}

/**
 * Install the PWA
 */
function installApp() {
  if (Store.deferredPrompt) {
    Store.deferredPrompt.prompt();
    Store.deferredPrompt.userChoice.then(() => {
      Store.deferredPrompt = null;
      Router.render();
    });
  }
}

/**
 * Check if running on iOS
 * @returns {boolean}
 */
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

/**
 * Check if running as installed PWA
 * @returns {boolean}
 */
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
}

/**
 * Set up online/offline detection
 */
function setupOffline() {
  window.addEventListener('online', () => Store.updateOnlineStatus(true));
  window.addEventListener('offline', () => Store.updateOnlineStatus(false));
}

/**
 * Request notification permission
 * @returns {Promise<boolean>}
 */
async function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    const result = await Notification.requestPermission();
    return result === 'granted';
  }
  return Notification.permission === 'granted';
}

/**
 * Show rest timer notification
 */
function showRestNotification() {
  if ('Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker?.ready?.then(reg => {
      reg.showNotification('Rest Complete', {
        body: 'Time for your next set!',
        icon: './img/icon.svg',
        vibrate: [200, 100, 200],
        tag: 'rest-timer',
        requireInteraction: false
      });
    }).catch(() => {
      new Notification('Rest Complete', { 
        body: 'Time for your next set!', 
        icon: './img/icon.svg' 
      });
    });
  }
}

// ========== PULL TO REFRESH ==========

/**
 * Set up pull-to-refresh gesture
 */
function setupPullToRefresh() {
  document.addEventListener('touchstart', e => {
    if (Store.screen === 'home' && window.scrollY === 0) {
      Store.pullY = e.touches[0].clientY;
      Store.pullActive = true;
      Store.pullDist = 0;
    }
  }, { passive: true });
  
  document.addEventListener('touchmove', e => {
    if (!Store.pullActive) return;
    Store.pullDist = e.touches[0].clientY - Store.pullY;
    const ind = document.getElementById('pull-indicator');
    if (ind && Store.pullDist > 10) {
      ind.style.height = Math.min(Store.pullDist * 0.4, 36) + 'px';
      ind.style.opacity = Math.min(Store.pullDist / 80, 1);
      ind.textContent = Store.pullDist > 60 ? 'Release to sync' : 'Pull to sync';
    }
  }, { passive: true });
  
  document.addEventListener('touchend', () => {
    if (Store.pullActive && Store.pullDist > 60) {
      loadData();
    }
    Store.pullActive = false;
    Store.pullDist = 0;
    const ind = document.getElementById('pull-indicator');
    if (ind) {
      ind.style.height = '0';
      ind.style.opacity = '0';
    }
  });
}

// ========== WORKOUT FLOW ==========

/**
 * Start a new workout
 * @param {string} day - Day label to start
 */
function startWorkout(day) {
  Store.activeDay = day;
  Store.workoutExercises = Store.getExercises(day).map(ex => ({ ...ex }));
  Store.inputs = {};
  Store.exerciseNotes = {};
  Store.expandedPlateCalc = {};
  Store.expandedWarmup = {};
  Store.supersets = [];
  Store.restPauseExercises = {};
  Store.editingEntryId = null;
  Store.workoutStart = Date.now();
  Store.screen = 'workout';
  Router.render();
}

/**
 * Copy last performance for an exercise
 * @param {number} ei - Exercise index
 * @param {string} name - Exercise name
 */
function copyLast(ei, name) {
  const last = Store.getLastForEx(name);
  if (!last) return;
  last.sets.forEach((s, si) => {
    Store.inputs[`${ei}-${si}`] = { 
      weight: s.weight || '', 
      reps: s.reps || '', 
      rir: s.rir || '' 
    };
  });
  haptic(50);
  Router.render();
}

/**
 * Swap an exercise for an alternative
 * @param {number} ei - Exercise index
 * @param {string} newName - New exercise name
 */
function swapExercise(ei, newName) {
  const alts = getAlternativeExercises(Store.workoutExercises[ei].name, Store.state.customExercises);
  if (alts.includes(newName)) {
    Store.workoutExercises[ei] = { ...Store.workoutExercises[ei], name: newName };
    Store.inputs = {}; // Clear inputs since exercise changed
  }
  Store.closeModal();
}

/**
 * Finish current workout and save
 */
async function finishWorkout() {
  Store.undoPrevState = JSON.parse(JSON.stringify(Store.state));
  const dur = Store.workoutStart ? Math.round((Date.now() - Store.workoutStart) / 60000) : 0;
  
  const entry = {
    id: Store.editingEntryId || `${Date.now()}`,
    date: Store.editingEntryId 
      ? Store.history.find(h => h.id === Store.editingEntryId)?.date || new Date().toISOString()
      : new Date().toISOString(),
    phase: Store.state.phase,
    dayLabel: Store.activeDay,
    weekLabel: Store.state.phase === 'rampup' ? Store.state.rampWeek : `Meso W${Store.state.mesoWeek}`,
    rirTarget: Store.getRIR(),
    duration: dur,
    exercises: Store.workoutExercises.map((ex, ei) => ({
      name: ex.name,
      targetReps: ex.reps,
      note: Store.exerciseNotes[ei] || '',
      sets: Array.from({ length: ex.sets }, (_, si) => {
        const d = Store.inputs[`${ei}-${si}`] || {};
        return { 
          weight: d.weight || '', 
          reps: d.reps || '', 
          rir: d.rir || '', 
          type: d.type || 'working' 
        };
      })
    }))
  };

  // PR detection
  const newPRs = [];
  for (const ex of entry.exercises) {
    const oldPR = Store.getPR(ex.name);
    const bestW = Math.max(...ex.sets.filter(s => s.type === 'working').map(s => parseFloat(s.weight) || 0), 0);
    if (bestW > 0 && bestW > oldPR) newPRs.push({ name: ex.name, weight: bestW });
  }

  // Update history
  if (Store.editingEntryId) {
    const idx = Store.history.findIndex(h => h.id === Store.editingEntryId);
    if (idx >= 0) Store.history[idx] = entry;
    Store.editingEntryId = null;
  } else {
    Store.history.unshift(entry);
    if (Store.history.length > 200) Store.history = Store.history.slice(0, 200);

    // Advance program
    if (Store.state.phase === 'rampup') {
      const days = Object.keys(Store.getProgram().rampup[Store.state.rampWeek] || {});
      const di = days.indexOf(Store.activeDay);
      if (di >= days.length - 1) {
        if (Store.state.rampWeek === 'Week 1') {
          Store.state.rampWeek = 'Week 2';
          Store.state.rampDayIdx = 0;
        } else {
          Store.state.phase = 'ppl';
          Store.state.mesoWeek = 1;
          Store.state.pplIdx = 0;
        }
      } else {
        Store.state.rampDayIdx = di + 1;
      }
    } else {
      const ni = (Store.state.pplIdx + 1) % Store.getProgram().ppl.length;
      Store.state.pplIdx = ni;
      if (ni === 0) Store.state.mesoWeek = Store.state.mesoWeek >= 4 ? 1 : Store.state.mesoWeek + 1;
    }
  }

  // Check fatigue
  checkFatigue();

  // Track streak
  let curStreak = 0;
  const now2 = new Date();
  for (const h2 of Store.history) {
    const d = new Date(h2.date);
    if (Math.floor((now2 - d) / 86400000) <= curStreak + 2) curStreak++;
    else break;
  }
  if (curStreak > (Store.state.longestStreak || 0)) Store.state.longestStreak = curStreak;

  // Save
  await Storage.set('state', Store.state);
  await Storage.set('history', Store.history);
  haptic([100, 50, 100, 50, 200]);
  
  Store.activeDay = null;
  Store.inputs = {};
  stopRest();

  // Set undo
  Store.undoEntry = entry;
  if (Store.undoTimeout) clearTimeout(Store.undoTimeout);
  Store.undoTimeout = setTimeout(() => {
    Store.undoEntry = null;
    Store.undoPrevState = null;
    Router.render();
  }, 30000);

  Store.screen = 'home';
  Router.render();
  
  // Show PR toasts
  for (const pr of newPRs) showPRToast(pr.name, pr.weight);
}

/**
 * Undo last workout save
 */
async function undoLastWorkout() {
  if (!Store.undoEntry || !Store.undoPrevState) return;
  Store.history = Store.history.filter(h => h.id !== Store.undoEntry.id);
  Store.state = Store.undoPrevState;
  await Storage.set('state', Store.state);
  await Storage.set('history', Store.history);
  Store.undoEntry = null;
  Store.undoPrevState = null;
  if (Store.undoTimeout) clearTimeout(Store.undoTimeout);
  haptic(50);
  Router.render();
}

/**
 * Check for fatigue signals
 */
function checkFatigue() {
  if (Store.state.mesoWeek === 4) {
    Store.state.fatigueFlags = 0;
    return;
  }
  const lastTwo = Store.history.filter(h => h.dayLabel === Store.activeDay).slice(0, 2);
  if (lastTwo.length < 2) return;
  const [curr, prev] = lastTwo;
  let drops = 0;
  for (const ex of (curr.exercises || [])) {
    const prevEx = prev.exercises?.find(e => e.name === ex.name);
    if (!prevEx) continue;
    const currAvgReps = ex.sets.reduce((s, v) => s + (parseInt(v.reps) || 0), 0) / (ex.sets.length || 1);
    const prevAvgReps = prevEx.sets.reduce((s, v) => s + (parseInt(v.reps) || 0), 0) / (prevEx.sets.length || 1);
    if (currAvgReps < prevAvgReps - 1) drops++;
  }
  Store.state.fatigueFlags = drops >= 2 ? (Store.state.fatigueFlags || 0) + 1 : 0;
}

// ========== REST TIMER ==========

/**
 * Start rest timer
 * @param {number} secs - Seconds to rest
 */
function startRest(secs) {
  if (Store.restInterval) clearInterval(Store.restInterval);
  Store.restEndTime = Date.now() + secs * 1000;
  Store.restTimer = secs;
  haptic(50);
  
  // Schedule background notification via service worker
  if ('Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker?.ready?.then(reg => {
      reg.active?.postMessage({ type: 'SCHEDULE_REST', ms: secs * 1000 });
    }).catch(() => {});
  }
  
  Router.render();
  Store.restInterval = setInterval(() => {
    Store.restTimer = Math.max(0, Math.ceil((Store.restEndTime - Date.now()) / 1000));
    if (Store.restTimer <= 0) {
      clearInterval(Store.restInterval);
      Store.restInterval = null;
      Store.restEndTime = null;
      haptic([200, 100, 200]);
      showRestNotification();
    }
    Router.render();
  }, 1000);
}

/**
 * Stop rest timer
 */
function stopRest() {
  if (Store.restInterval) clearInterval(Store.restInterval);
  if (Store.elapsedInterval) { clearInterval(Store.elapsedInterval); Store.elapsedInterval = null; }
  Store.restTimer = 0;
  Store.restInterval = null;
  Store.restEndTime = null;
  Router.render();
}

// ========== PR NOTIFICATIONS ==========

/**
 * Show PR toast notification
 * @param {string} name - Exercise name
 * @param {number} weight - Weight achieved
 */
function showPRToast(name, weight) {
  Store.prToasts.push({ name, weight, time: Date.now() });
  haptic([100, 50, 100, 50, 200]);
  setTimeout(() => {
    Store.prToasts = Store.prToasts.filter(t => Date.now() - t.time < 4000);
    Router.render();
  }, 4000);
  Router.render();
}

// ========== UTILITIES ==========

/**
 * Trigger haptic feedback
 * @param {number|number[]} pattern - Vibration pattern
 */
function haptic(pattern = 50) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// Boot the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
