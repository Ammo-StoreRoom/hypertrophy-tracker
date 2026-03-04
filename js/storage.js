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

  // Rate limiting constants
  const RATE_LIMIT_KEY = 'ht-login-attempts';
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 60 * 1000; // 1 minute

  // Legacy hash function (for backwards compatibility)
  function hashPinLegacy(pin) {
    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
      const c = pin.charCodeAt(i);
      hash = ((hash << 5) - hash) + c;
      hash |= 0;
    }
    return 'u' + Math.abs(hash).toString(36);
  }

  // Secure hash using SubtleCrypto (preferred) with legacy fallback
  async function hashPinSecure(pin) {
    // Try to use SubtleCrypto for better security
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(pin);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return 's' + hashHex.substring(0, 20); // 's' prefix indicates secure hash
      } catch (e) {
        console.warn('SubtleCrypto failed, falling back to legacy hash:', e);
      }
    }
    // Fallback to legacy hash
    return hashPinLegacy(pin);
  }

  // Synchronous hash (for backwards compatibility in non-async contexts)
  function hashPin(pin) {
    return hashPinLegacy(pin);
  }

  // Check if a PIN is weak/unsafe
  function checkPinStrength(pin) {
    const issues = [];
    
    // Check for sequential numbers
    const sequential = ['01234567', '12345678', '23456789', '98765432', '87654321', '76543210'];
    if (sequential.some(seq => pin.includes(seq))) {
      issues.push('This PIN contains sequential numbers which are easy to guess.');
    }
    
    // Check for repeated digits
    if (/^(\d)\1{7}$/.test(pin)) {
      issues.push('This PIN uses the same digit repeated 8 times.');
    }
    
    // Check for common patterns
    const commonPatterns = ['11111111', '22222222', '33333333', '44444444', '55555555', 
                           '66666666', '77777777', '88888888', '99999999', '00000000',
                           '12345678', '87654321', '00000001', '99999999'];
    if (commonPatterns.includes(pin)) {
      issues.push('This is a commonly used PIN and is not secure.');
    }
    
    // Check for date-like patterns (MMDDYYYY that are valid dates)
    const month = parseInt(pin.substring(0, 2));
    const day = parseInt(pin.substring(2, 4));
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      // It's a valid date - this is expected since we use birthdays
      // but we could check if it's a very recent/young birthday
      const year = parseInt(pin.substring(4, 8));
      const currentYear = new Date().getFullYear();
      if (year > currentYear - 13) {
        issues.push('This appears to be a very recent birthday.');
      }
    }
    
    return {
      isWeak: issues.length > 0,
      issues,
    };
  }

  // Rate limiting: Get current attempt data
  function getRateLimitData() {
    try {
      const data = localStorage.getItem(RATE_LIMIT_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to read rate limit data:', e);
    }
    return { attempts: 0, lockedUntil: 0, history: [] };
  }

  // Rate limiting: Save attempt data
  function saveRateLimitData(data) {
    try {
      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save rate limit data:', e);
    }
  }

  // Rate limiting: Check if login is allowed
  function checkRateLimit() {
    const data = getRateLimitData();
    const now = Date.now();
    
    // Check if currently locked out
    if (data.lockedUntil > now) {
      const remainingSeconds = Math.ceil((data.lockedUntil - now) / 1000);
      return {
        allowed: false,
        remainingSeconds,
        message: `Too many failed attempts. Please wait ${remainingSeconds} seconds before trying again.`,
      };
    }
    
    // Clear expired lockout
    if (data.lockedUntil > 0 && data.lockedUntil <= now) {
      data.attempts = 0;
      data.lockedUntil = 0;
      saveRateLimitData(data);
    }
    
    return { allowed: true, attemptsRemaining: MAX_LOGIN_ATTEMPTS - data.attempts };
  }

  // Rate limiting: Record a failed attempt
  function recordFailedAttempt() {
    const data = getRateLimitData();
    const now = Date.now();
    
    data.attempts = (data.attempts || 0) + 1;
    
    // Add to history
    if (!data.history) data.history = [];
    data.history.push({ timestamp: now });
    // Keep only last 20 entries
    if (data.history.length > 20) {
      data.history = data.history.slice(-20);
    }
    
    // Check if we should lock out
    if (data.attempts >= MAX_LOGIN_ATTEMPTS) {
      data.lockedUntil = now + LOCKOUT_DURATION_MS;
    }
    
    saveRateLimitData(data);
    
    return {
      attempts: data.attempts,
      lockedOut: data.lockedUntil > now,
      remainingSeconds: data.lockedUntil > now ? Math.ceil((data.lockedUntil - now) / 1000) : 0,
    };
  }

  // Rate limiting: Record a successful attempt (clear failures)
  function recordSuccessfulAttempt() {
    saveRateLimitData({ attempts: 0, lockedUntil: 0, history: [] });
  }

  // Clear PIN from memory (security best practice)
  function clearPinFromMemory() {
    // The PIN is stored in userPin variable - we can't truly delete it
    // but we can overwrite it and suggest garbage collection
    if (userPin) {
      // Overwrite with random data to help prevent memory inspection
      const len = userPin.length;
      userPin = Array(len).fill('0').join('');
      userPin = null;
    }
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

    // Security utilities
    hashPin,
    hashPinSecure,
    checkPinStrength,
    checkRateLimit,
    getRateLimitData,
    
    // Clear sensitive data from memory
    clearPinFromMemory,

    async login(pin) {
      // Check rate limiting first
      const rateLimit = checkRateLimit();
      if (!rateLimit.allowed) {
        const error = new Error(rateLimit.message);
        error.code = 'RATE_LIMITED';
        error.remainingSeconds = rateLimit.remainingSeconds;
        throw error;
      }

      // Validate PIN format
      if (!/^\d{8}$/.test(pin)) {
        recordFailedAttempt();
        return false;
      }

      // Check PIN strength and warn (but still allow)
      const strengthCheck = checkPinStrength(pin);
      if (strengthCheck.isWeak) {
        console.warn('Weak PIN detected:', strengthCheck.issues);
        // Store warning for UI to display
        try {
          localStorage.setItem('ht-last-pin-warning', JSON.stringify({
            pin: hashPin(pin),
            issues: strengthCheck.issues,
            timestamp: Date.now(),
          }));
        } catch {}
      } else {
        // Clear any previous warning
        try {
          localStorage.removeItem('ht-last-pin-warning');
        } catch {}
      }

      // Proceed with login
      userPin = pin;
      authUid = null;
      try { localStorage.setItem('ht-pin', JSON.stringify(pin)); } catch {}
      saveKnownUser();
      migrateOldData();
      initFirebase();
      try {
        await ensureAuthed();
        await migrateFirebaseIfNeeded();
        // Record successful attempt (clears failures)
        recordSuccessfulAttempt();
        return true;
      } catch (e) {
        // Record failed attempt for rate limiting (except for specific errors)
        if (e?.message !== 'admin_password_required') {
          recordFailedAttempt();
        }
        throw e;
      }
    },

    // Get any PIN strength warning from last login
    getPinWarning() {
      try {
        const warning = localStorage.getItem('ht-last-pin-warning');
        if (warning) {
          const parsed = JSON.parse(warning);
          // Only return if it's for the current PIN and recent (within 5 minutes)
          if (userPin && parsed.pin === hashPin(userPin) && Date.now() - parsed.timestamp < 5 * 60 * 1000) {
            return parsed.issues;
          }
        }
      } catch {}
      return null;
    },

    // Clear PIN warning
    clearPinWarning() {
      try {
        localStorage.removeItem('ht-last-pin-warning');
      } catch {}
    },

    async autoLogin() {
      try {
        const v = localStorage.getItem('ht-pin');
        const saved = v ? JSON.parse(v) : null;
        if (saved) {
          // Check rate limiting even for auto-login
          const rateLimit = checkRateLimit();
          if (!rateLimit.allowed) {
            console.warn('Auto-login blocked by rate limit');
            return false;
          }

          userPin = saved;
          authUid = null;
          saveKnownUser();
          migrateOldData();
          initFirebase();
          try {
            await ensureAuthed();
            await migrateFirebaseIfNeeded();
            recordSuccessfulAttempt();
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
      // Clear PIN from memory before logging out
      clearPinFromMemory();
      authUid = null;
      localStorage.removeItem('ht-pin');
      // Clear PIN warning on logout
      this.clearPinWarning();
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

    // Set data at a raw path (for backup module)
    async setRaw(path, val) {
      if (db && path) {
        try {
          await db.ref(path).set(val);
          return true;
        } catch(e) {
          console.warn('Firebase raw write failed:', e);
          return false;
        }
      }
      return false;
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
