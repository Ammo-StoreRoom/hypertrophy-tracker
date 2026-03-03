// ============================================
// STORAGE — Firebase sync + localStorage fallback
// ============================================
const Storage = (() => {
  let db = null;
  let userPin = null;
  let syncCallbacks = [];

  function hashPin(pin) {
    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
      const c = pin.charCodeAt(i);
      hash = ((hash << 5) - hash) + c;
      hash |= 0;
    }
    return 'u' + Math.abs(hash).toString(36);
  }

  function initFirebase() {
    if (typeof firebase === 'undefined') return false;
    const cfg = typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey || cfg.apiKey.includes('YOUR_') || !cfg.databaseURL || cfg.databaseURL.includes('YOUR_')) {
      return false; // Skip Firebase when config is placeholder — use local only
    }
    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.database();
      return true;
    } catch(e) { console.error('Firebase init failed:', e); return false; }
  }

  function getPath(key) {
    return `users/${hashPin(userPin)}/${key}`;
  }

  // Local storage helpers — keyed per user so multiple accounts stay isolated
  function lsKey(key) {
    return userPin ? `ht-${hashPin(userPin)}-${key}` : `ht-${key}`;
  }
  function localGet(key, fallback) {
    try { const v = localStorage.getItem(lsKey(key)); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  }
  function localSet(key, val) {
    try { localStorage.setItem(lsKey(key), JSON.stringify(val)); } catch(e) { console.error('LS save fail', e); }
  }
  function migrateOldData() {
    const DATA_KEYS = ['state', 'history', 'bodyWeights'];
    if (!userPin) return;
    const prefix = `ht-${hashPin(userPin)}-`;
    if (DATA_KEYS.some(k => localStorage.getItem(prefix + k) !== null)) return;
    if (localStorage.getItem('ht-data-migrated')) return;
    for (const k of DATA_KEYS) {
      const old = localStorage.getItem('ht-' + k);
      if (old !== null) localStorage.setItem(prefix + k, old);
    }
    localStorage.setItem('ht-data-migrated', '1');
  }

  // Public API
  return {
    isLoggedIn() { return !!userPin; },
    getPin() { return userPin; },

    login(pin) {
      if (!/^\d{8}$/.test(pin)) return false;
      userPin = pin;
      try { localStorage.setItem('ht-pin', JSON.stringify(pin)); } catch {}
      migrateOldData();
      initFirebase();
      return true;
    },

    autoLogin() {
      try {
        const v = localStorage.getItem('ht-pin');
        const saved = v ? JSON.parse(v) : null;
        if (saved) { userPin = saved; migrateOldData(); initFirebase(); return true; }
      } catch {}
      return false;
    },

    logout() {
      userPin = null;
      localStorage.removeItem('ht-pin');
    },

    async get(key, fallback) {
      // Always read local first (fast)
      const local = localGet(key, fallback);

      // Try to get from Firebase with timeout so we never hang on Loading
      if (db && userPin) {
        const timeoutMs = 8000;
        try {
          const snap = await Promise.race([
            db.ref(getPath(key)).once('value'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
          ]);
          const remote = snap.val();
          if (remote !== null) {
            localSet(key, remote);
            return remote;
          } else {
            if (local !== fallback) {
              db.ref(getPath(key)).set(local).catch(() => {});
            }
            return local;
          }
        } catch(e) {
          if (e?.message === 'timeout') console.warn('Firebase read timed out, using local');
          else console.warn('Firebase read failed, using local:', e);
          return local;
        }
      }
      return local;
    },

    async set(key, val) {
      // Always save local immediately
      localSet(key, val);

      // Push to Firebase
      if (db && userPin) {
        try {
          await db.ref(getPath(key)).set(val);
        } catch(e) {
          console.warn('Firebase write failed, saved locally:', e);
        }
      }
    },

    // Listen for remote changes (real-time sync)
    listen(key, callback) {
      if (db && userPin) {
        const ref = db.ref(getPath(key));
        ref.on('value', snap => {
          const val = snap.val();
          if (val !== null) {
            localSet(key, val);
            callback(val);
          }
        });
        syncCallbacks.push({ ref, key });
      }
    },

    // Stop listening
    unlisten() {
      syncCallbacks.forEach(({ ref }) => ref.off());
      syncCallbacks = [];
    },
  };
})();
