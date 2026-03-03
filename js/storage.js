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

  // Track all known users in localStorage so admin always has them
  function saveKnownUser() {
    if (!userPin) return;
    try {
      const known = JSON.parse(localStorage.getItem('ht-known-users') || '{}');
      known[hashPin(userPin)] = userPin;
      localStorage.setItem('ht-known-users', JSON.stringify(known));
    } catch {}
  }

  // Public API
  return {
    isLoggedIn() { return !!userPin; },
    getPin() { return userPin; },

    login(pin) {
      if (!/^\d{8}$/.test(pin)) return false;
      userPin = pin;
      try { localStorage.setItem('ht-pin', JSON.stringify(pin)); } catch {}
      saveKnownUser();
      migrateOldData();
      initFirebase();
      return true;
    },

    autoLogin() {
      try {
        const v = localStorage.getItem('ht-pin');
        const saved = v ? JSON.parse(v) : null;
        if (saved) { userPin = saved; saveKnownUser(); migrateOldData(); initFirebase(); return true; }
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

    getHash() { return userPin ? hashPin(userPin) : null; },

    // Register current user (writes to own Firebase path + shared registry + localStorage)
    async registerSelf(info) {
      if (!userPin) return;
      saveKnownUser();
      const meta = { pin: userPin, ...info, lastActive: new Date().toISOString().split('T')[0] };
      if (db) {
        const h = hashPin(userPin);
        try { await db.ref(`users/${h}/_meta`).update(meta); } catch {}
        try { await db.ref(`registry/${h}`).update(meta); } catch {}
      }
    },

    // Admin: build user list from all available sources
    async adminGetRegistry() {
      const reg = {};
      const diag = { local: 0, registry: 0, usersScan: 0, errors: [] };
      // 1. Local known users (always works)
      try {
        const known = JSON.parse(localStorage.getItem('ht-known-users') || '{}');
        for (const [hash, pin] of Object.entries(known)) {
          reg[hash] = { pin };
        }
        diag.local = Object.keys(known).length;
      } catch {}
      if (db) {
        // 2. Firebase registry (may fail if rules expired)
        try {
          const snap = await Promise.race([
            db.ref('registry').once('value'),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
          ]);
          const fbReg = snap.val() || {};
          for (const [hash, data] of Object.entries(fbReg)) {
            reg[hash] = { ...(reg[hash] || {}), ...data };
          }
          diag.registry = Object.keys(fbReg).length;
        } catch(e) { diag.errors.push('registry: ' + (e?.message || e)); }
        // 3. Scan Firebase users/ path directly for _meta entries
        try {
          const usersSnap = await Promise.race([
            db.ref('users').once('value'),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
          ]);
          const allUsers = usersSnap.val() || {};
          for (const [hash, userData] of Object.entries(allUsers)) {
            if (!reg[hash]) reg[hash] = {};
            if (userData?._meta) {
              reg[hash] = { ...reg[hash], ...userData._meta };
            }
          }
          diag.usersScan = Object.keys(allUsers).length;
        } catch(e) { diag.errors.push('users: ' + (e?.message || e)); }
      } else {
        diag.errors.push('Firebase not connected');
      }
      reg._diag = diag;
      return reg;
    },

    // Admin: add a user by PIN (resolves hash and stores locally)
    adminAddUserByPin(pin) {
      if (!/^\d{8}$/.test(pin)) return false;
      const h = hashPin(pin);
      try {
        const known = JSON.parse(localStorage.getItem('ht-known-users') || '{}');
        known[h] = pin;
        localStorage.setItem('ht-known-users', JSON.stringify(known));
      } catch {}
      return h;
    },

    // Admin: read another user's data (Firebase first, localStorage fallback)
    async adminGetUserData(userHash, key) {
      if (db) {
        try {
          const snap = await db.ref(`users/${userHash}/${key}`).once('value');
          const val = snap.val();
          if (val !== null) return val;
        } catch {}
      }
      try {
        const ls = localStorage.getItem(`ht-${userHash}-${key}`);
        return ls ? JSON.parse(ls) : null;
      } catch { return null; }
    },

    // Admin: write another user's data
    async adminSetUserData(userHash, key, val) {
      try { localStorage.setItem(`ht-${userHash}-${key}`, JSON.stringify(val)); } catch {}
      if (db) {
        try { await db.ref(`users/${userHash}/${key}`).set(val); return true; }
        catch(e) { console.warn('Admin write failed:', e); }
      }
      return false;
    },

    // Admin: delete all data for a user
    async adminResetUser(userHash) {
      const DATA_KEYS = ['state', 'history', 'bodyWeights', 'measurements', '_meta'];
      for (const k of DATA_KEYS) {
        try { localStorage.removeItem(`ht-${userHash}-${k}`); } catch {}
      }
      try {
        const known = JSON.parse(localStorage.getItem('ht-known-users') || '{}');
        delete known[userHash];
        localStorage.setItem('ht-known-users', JSON.stringify(known));
      } catch {}
      if (db) {
        try { await db.ref(`users/${userHash}`).remove(); } catch {}
        try { await db.ref(`registry/${userHash}`).remove(); } catch {}
      }
      return true;
    },
  };
})();
