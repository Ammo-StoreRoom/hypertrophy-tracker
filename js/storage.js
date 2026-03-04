// ============================================
// STORAGE — Firebase sync + localStorage fallback
// ============================================
const Storage = (() => {
  let db = null;
  let auth = null;
  let authUid = null;
  let userPin = null;
  let syncCallbacks = [];
  const ADMIN_PIN = '01131998';
  const ADMIN_EMAIL = 'ayman98a@gmail.com';
  const PIN_EMAIL_DOMAIN = 'hypertrophy.local';
  const PIN_PASSWORD_PREFIX = 'HTPINv1-';

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
      auth = firebase.auth();
      db = firebase.database();
      return true;
    } catch(e) { console.error('Firebase init failed:', e); return false; }
  }

  function getPath(key) {
    // Prefer auth UID; fall back to legacy hash so app works without Firebase Auth enabled
    if (!userPin) return null;
    return authUid ? `users/${authUid}/${key}` : `users/${hashPin(userPin)}/${key}`;
  }

  function pinEmail(pin) {
    return `pin-${pin}@${PIN_EMAIL_DOMAIN}`;
  }
  function pinPassword(pin) {
    // Not cryptographically strong, but avoids storing plain PIN as password
    // and still enables cross-device login with birthday-only UX.
    return `${PIN_PASSWORD_PREFIX}${pin}`;
  }

  async function ensureAuthed() {
    if (!db || !auth || !userPin) return false;
    const current = auth.currentUser;
    if (current) { authUid = current.uid; return true; }

    // Admin uses real email/password
    if (userPin === ADMIN_PIN) {
      const adminPw = localStorage.getItem('ht-admin-password') || '';
      if (!adminPw) throw new Error('admin_password_required');
      await auth.signInWithEmailAndPassword(ADMIN_EMAIL, adminPw);
      authUid = auth.currentUser?.uid || null;
      return !!authUid;
    }

    // Normal users: email/password derived from PIN
    const email = pinEmail(userPin);
    const pw = pinPassword(userPin);
    try {
      await auth.signInWithEmailAndPassword(email, pw);
    } catch (e) {
      if (e?.code === 'auth/user-not-found') {
        await auth.createUserWithEmailAndPassword(email, pw);
      } else if (e?.code === 'auth/invalid-login-credentials' || e?.code === 'auth/wrong-password') {
        // If password scheme ever changed, allow account recreation flow by re-creating.
        // (Will still require temporary-open migration if old data exists.)
        await auth.createUserWithEmailAndPassword(email, pw);
      } else {
        throw e;
      }
    }
    authUid = auth.currentUser?.uid || null;
    return !!authUid;
  }

  async function migrateFirebaseIfNeeded() {
    // During "temporary open" window: copy old users/{hashPin(pin)} data into users/{uid}
    if (!db || !userPin || !authUid) return;
    try {
      const newMeta = await db.ref(`users/${authUid}/_meta`).once('value');
      if (newMeta.val()) return; // already has data
    } catch {}
    const oldHash = hashPin(userPin);
    try {
      const oldSnap = await db.ref(`users/${oldHash}`).once('value');
      const oldData = oldSnap.val();
      if (!oldData) return;
      const toCopy = {};
      for (const k of ['state', 'history', 'bodyWeights', 'measurements']) {
        if (oldData[k] != null) toCopy[k] = oldData[k];
      }
      toCopy._meta = { ...(oldData._meta || {}), migratedFrom: oldHash, migratedAt: new Date().toISOString() };
      await db.ref(`users/${authUid}`).update(toCopy);
    } catch(e) {
      console.warn('Firebase migration skipped/failed:', e?.message || e);
    }
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
    const DATA_KEYS = ['state', 'history', 'bodyWeights', 'measurements'];
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

    async login(pin) {
      if (!/^\d{8}$/.test(pin)) return false;
      userPin = pin;
      authUid = null;
      try { localStorage.setItem('ht-pin', JSON.stringify(pin)); } catch {}
      saveKnownUser();
      migrateOldData();
      initFirebase();
      try {
        await ensureAuthed();
        await migrateFirebaseIfNeeded();
      } catch (e) {
        console.warn('Auth/migration skipped, using legacy path:', e?.message || e);
      }
      return true;
    },

    async autoLogin() {
      try {
        const v = localStorage.getItem('ht-pin');
        const saved = v ? JSON.parse(v) : null;
        if (saved) {
          userPin = saved;
          authUid = null;
          saveKnownUser();
          migrateOldData();
          initFirebase();
          try {
            await ensureAuthed();
            await migrateFirebaseIfNeeded();
          } catch (e) {
            console.warn('Auth skipped, using legacy path:', e?.message || e);
          }
          return true;
        }
      } catch (e) {
        console.warn('autoLogin failed:', e);
      }
      return false;
    },

    logout() {
      userPin = null;
      authUid = null;
      localStorage.removeItem('ht-pin');
      try { auth?.signOut(); } catch {}
    },

    async get(key, fallback) {
      // Always read local first (fast)
      const local = localGet(key, fallback);

      // Try to get from Firebase with timeout so we never hang on Loading
      if (db && userPin && getPath(key)) {
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
      if (db && userPin && getPath(key)) {
        try {
          await db.ref(getPath(key)).set(val);
        } catch(e) {
          console.warn('Firebase write failed, saved locally:', e);
        }
      }
    },

    // Listen for remote changes (real-time sync)
    listen(key, callback) {
      if (db && userPin && getPath(key)) {
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

    getHash() { return authUid || (userPin ? hashPin(userPin) : null); },
    getUid() { return authUid || null; },
    setAdminPassword(pw) { try { localStorage.setItem('ht-admin-password', pw); } catch {} },

    // Register current user (writes to own Firebase path + shared registry + localStorage)
    async registerSelf(info) {
      if (!userPin) return;
      saveKnownUser();
      const meta = { pin: userPin, ...info, lastActive: new Date().toISOString().split('T')[0] };
      if (db) {
        const pathId = authUid || hashPin(userPin);
        try { await db.ref(`users/${pathId}/_meta`).update(meta); } catch {}
        if (authUid) {
          try { await db.ref(`pinIndex/${hashPin(userPin)}`).set(authUid); } catch {}
          try { await db.ref(`registry/${authUid}`).update(meta); } catch {}
        } else {
          try { await db.ref(`registry/${pathId}`).update(meta); } catch {}
        }
      }
    },

    // Admin: build user list from all available sources
    async adminGetRegistry() {
      const byPin = {}; // keyed by PIN (the unique user identifier)
      const diag = { local: 0, registry: 0, usersScan: 0, errors: [] };
      
      // Helper to add/merge user data
      const addUser = (pin, data, source) => {
        if (!pin || !/^\d{8}$/.test(pin)) return;
        if (!byPin[pin]) byPin[pin] = { pin, _sources: [] };
        byPin[pin]._sources.push(source);
        // Merge data, preferring newer data (keep existing values for critical fields)
        Object.assign(byPin[pin], data);
      };

      // 1. Local known PINs (device-local)
      try {
        const knownPins = JSON.parse(localStorage.getItem('ht-known-users') || '{}'); // pinHash -> pin
        diag.local = Object.keys(knownPins).length;
        for (const [, pin] of Object.entries(knownPins)) {
          addUser(pin, { fromLocal: true }, 'local');
        }
      } catch {}

      if (db) {
        // 2. Firebase registry
        try {
          const snap = await Promise.race([
            db.ref('registry').once('value'),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
          ]);
          const fbReg = snap.val() || {};
          for (const [uid, data] of Object.entries(fbReg)) {
            if (data?.pin) addUser(data.pin, { ...data, uid }, 'registry');
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
          for (const [uid, userData] of Object.entries(allUsers)) {
            if (userData?._meta?.pin) {
              addUser(userData._meta.pin, { ...userData._meta, uid }, 'users');
            }
          }
          diag.usersScan = Object.keys(allUsers).length;
        } catch(e) { diag.errors.push('users: ' + (e?.message || e)); }
      } else {
        diag.errors.push('Firebase not connected');
      }

      // Convert to hash-keyed object for backwards compatibility with admin UI
      // Use pinHash as the key to ensure true deduplication
      const reg = {};
      for (const [pin, data] of Object.entries(byPin)) {
        const h = hashPin(pin);
        // Only add if not already present (first source wins to avoid overwrites)
        if (!reg[h]) {
          reg[h] = { ...data, hash: h };
        }
      }
      
      reg._diag = diag;
      return reg;
    },

    // Admin: add a user by PIN (resolves hash and stores locally)
    adminAddUserByPin(pin) {
      if (!/^\d{8}$/.test(pin)) return false;
      const h = hashPin(pin); // pinHash
      try {
        const known = JSON.parse(localStorage.getItem('ht-known-users') || '{}');
        known[h] = pin;
        localStorage.setItem('ht-known-users', JSON.stringify(known));
      } catch {}
      return h; // resolved to UID later via pinIndex
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
