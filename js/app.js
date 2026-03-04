// ============================================
// HYPERTROPHY TRACKER — Main Application
// ============================================

// ========== STATE ==========
let state, history, screen, activeDay, inputs, workoutStart;
let restTimer = 0, restEndTime = null, restInterval = null;
let modal = null, expandedEntries = {};
let bodyWeights = [];
let measurements = [];
let workoutExercises = [];
let exerciseNotes = {};
let expandedPlateCalc = {};
let expandedWarmup = {};
let supersets = [], restPauseExercises = {};
let editingEntryId = null;
let showMeasureTrends = false;
let expandedPRInput = {};
let elapsedInterval = null;
let prToasts = [];
let deferredPrompt = null, installDismissed = false;
let isOnline = navigator.onLine;
let undoEntry = null, undoPrevState = null, undoTimeout = null;
let theme = 'dark';
let pullY = 0, pullActive = false, pullDist = 0;

// Admin
const ADMIN_PIN = '01131998';
const isAdmin = () => Storage.getPin() === ADMIN_PIN;
let adminUsers = null, adminExpanded = {}, adminLoading = false, adminDiag = null;

const DEFAULT_STATE = { phase: "rampup", rampWeek: "Week 1", rampDayIdx: 0, mesoWeek: 1, pplIdx: 0, program: "standard", units: "lbs", customExercises: [], fatigueFlags: 0, longestStreak: 0, allowedPrograms: ['standard', 'glute-focus'], goals: { targetWeight: 0, lifts: {} } };

// ========== INIT & AUTH ==========
async function init() {
  initTheme();
  setupPWA();
  setupOffline();
  setupPullToRefresh();
  if (!await Storage.autoLogin()) { screen = 'login'; render(); return; }
  try { await loadData(); } catch (e) { console.error('Init failed:', e); screen = 'login'; render(); }
}

async function loadData() {
  // Ensure we don't keep listeners from a previous login/session
  Storage.unlisten();
  state = await Storage.get('state', { ...DEFAULT_STATE });
  if (state.rampDayIdx === undefined) state.rampDayIdx = 0;
  if (!state.program) state.program = 'standard';
  if (!state.units) state.units = 'lbs';
  if (!state.allowedPrograms) state.allowedPrograms = ['standard', 'glute-focus'];
  if (!state.goals) state.goals = { targetWeight: 0, lifts: {} };
  if (!state.manualPRs) state.manualPRs = {};
  history = await Storage.get('history', []);
  bodyWeights = await Storage.get('bodyWeights', []);
  measurements = await Storage.get('measurements', []);
  screen = 'home'; activeDay = null; inputs = {}; workoutStart = null;
  render();
  await registerUser();
  Storage.listen('state', val => {
    if (screen !== 'workout') { state = val; if (state.rampDayIdx === undefined) state.rampDayIdx = 0; if (!state.program) state.program = 'standard'; if (!state.allowedPrograms) state.allowedPrograms = ['standard', 'glute-focus']; render(); }
  });
  Storage.listen('history', val => {
    if (screen !== 'workout') { history = val || []; render(); }
  });
  Storage.listen('bodyWeights', val => {
    bodyWeights = Array.isArray(val) ? val : [];
    if (screen !== 'workout') render();
  });
  Storage.listen('measurements', val => {
    measurements = Array.isArray(val) ? val : [];
    if (screen !== 'workout') render();
  });
}

async function registerUser() {
  await Storage.registerSelf({
    lastActive: new Date().toISOString().split('T')[0],
    program: state.program,
    phase: state.phase,
    workoutCount: history.length,
  });
}

async function doLogin(pin) {
  if (!/^\d{8}$/.test(pin)) {
    document.getElementById('login-error').textContent = 'Enter 8 digits (MMDDYYYY)';
    return;
  }
  try {
    // Admin PIN requires one-time admin password entry on this device
    if (pin === '01131998' && !localStorage.getItem('ht-admin-password')) {
      await promptAdminPassword();
    }
    const ok = await Storage.login(pin);
    if (!ok) {
      document.getElementById('login-error').textContent = 'Enter 8 digits (MMDDYYYY)';
      return;
    }
    await loadData();
  } catch (e) {
    document.getElementById('login-error').textContent =
      e?.message === 'admin_password_required'
        ? 'Admin password required.'
        : 'Login failed. Check connection / Firebase Auth.';
    console.warn('Login failed:', e);
  }
}

async function promptAdminPassword() {
  return new Promise(resolve => {
    modal = {
      title: 'Admin password',
      message: 'Enter your Firebase Auth password for ayman98a@gmail.com (saved on this device).',
      content: el('div', null,
        el('input', { id: 'admin-pw', type: 'password', cls: 'set-input', css: 'text-align:left;margin-top:10px', placeholder: 'Password' }),
      ),
      onConfirm: () => {
        const pw = document.getElementById('admin-pw')?.value || '';
        if (pw) Storage.setAdminPassword(pw);
        modal = null; render();
        resolve(true);
      }
    };
    render();
  });
}

function doLogout() {
  Storage.unlisten(); Storage.logout();
  screen = 'login'; render();
}

// ========== PWA ==========
function setupPWA() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); deferredPrompt = e;
    if (!installDismissed && screen !== 'login') render();
  });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; render(); });
}

function installApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => { deferredPrompt = null; render(); });
  }
}

function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream; }
function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone; }

function setupOffline() {
  window.addEventListener('online', () => { isOnline = true; render(); });
  window.addEventListener('offline', () => { isOnline = false; render(); });
}

async function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    const result = await Notification.requestPermission();
    render();
    return result === 'granted';
  }
  return Notification.permission === 'granted';
}

function showRestNotification() {
  if ('Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker?.ready?.then(reg => {
      reg.showNotification('Rest Complete', {
        body: 'Time for your next set!', icon: './img/icon.svg',
        vibrate: [200, 100, 200], tag: 'rest-timer', requireInteraction: false
      });
    }).catch(() => {
      new Notification('Rest Complete', { body: 'Time for your next set!', icon: './img/icon.svg' });
    });
  }
}

// ========== THEME ==========
function initTheme() {
  const saved = localStorage.getItem('ht-theme') || 'dark';
  setTheme(saved);
}

function setTheme(t) {
  theme = t;
  let actual = t;
  if (t === 'auto') actual = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', actual);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', actual === 'light' ? '#f5f5f7' : '#080810');
  localStorage.setItem('ht-theme', t);
}

// ========== HELPERS ==========
const fmtDate = d => new Date(d).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
const fmtTime = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
const parseTopRep = r => { const m = r.match(/(\d+)/); return m ? +m[1] : 0; };
function haptic(pattern = 50) { if (navigator.vibrate) navigator.vibrate(pattern); }

function getRIR() {
  if (state.phase === 'rampup') return state.rampWeek === 'Week 1' ? '4 RIR' : '2-3 RIR';
  return MESO_RIR[state.mesoWeek] || '3 RIR';
}
function curProgram() { return PROGRAMS[state.program] || PROGRAMS.standard; }
function getExercises(day) {
  const { rampup, ppl } = curProgram();
  if (state.phase === 'rampup') return rampup[state.rampWeek]?.[day] || [];
  return ppl.find(p => p.label === day)?.exercises || [];
}
function getDays() {
  const { rampup, ppl } = curProgram();
  if (state.phase === 'rampup') return Object.keys(rampup[state.rampWeek] || {});
  return ppl.map(p => p.label);
}
function getNextDay() {
  const { rampup, ppl } = curProgram();
  if (state.phase === 'rampup') {
    const days = Object.keys(rampup[state.rampWeek] || {});
    return days[state.rampDayIdx] || days[0];
  }
  return ppl[state.pplIdx]?.label;
}
function getLastForEx(name) {
  for (const w of history) { const ex = w.exercises?.find(e => e.name === name); if (ex?.sets?.some(s => s.weight)) return ex; }
  return null;
}
function getPR(name) {
  let best = 0;
  for (const w of history) { const ex = w.exercises?.find(e => e.name === name); if (ex) for (const s of (ex.sets||[])) { const wt = parseFloat(s.weight)||0; if (wt > best) best = wt; } }
  const manual = state.manualPRs?.[name];
  if (manual?.weight && parseFloat(manual.weight) > best) best = parseFloat(manual.weight);
  return best;
}
function getManualPR(name) { return state.manualPRs?.[name] || null; }
async function setManualPR(name, weight, e1rm) {
  if (!state.manualPRs) state.manualPRs = {};
  state.manualPRs[name] = { weight: parseFloat(weight) || 0, e1rm: parseFloat(e1rm) || 0, date: new Date().toISOString().split('T')[0] };
  await Storage.set('state', state);
  render();
}
function shouldIncrease(ex, rir) {
  if (!ex?.sets?.length) return false;
  const t = parseInt(rir) || 3, top = parseTopRep(ex.targetReps || '8');
  return ex.sets.every(s => (+s.reps||0) >= top && !isNaN(parseInt(s.rir)) && parseInt(s.rir) <= t);
}

// ========== UNITS ==========
function unitLabel() { return state.units || 'lbs'; }
function defaultBar() { return state.units === 'kg' ? 20 : 45; }
function convertWeight(val, toUnit, fromUnit = unitLabel()) {
  const n = parseFloat(val);
  if (!Number.isFinite(n)) return 0;
  if (toUnit === fromUnit) return n;
  return toUnit === 'kg' ? (n * 0.45359237) : (n / 0.45359237);
}
function formatWeight(val, withSpace = false) {
  const n = parseFloat(val);
  if (!Number.isFinite(n) || n <= 0) return '';
  const pretty = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
  return `${pretty}${withSpace ? ' ' : ''}${unitLabel()}`;
}
function fmtW(v) { return formatWeight(v); }

// ========== FEATURES ==========
function calcPlates(targetWeight, barWeight) {
  barWeight = barWeight || defaultBar();
  const available = state.units === 'kg' ? [20, 10, 5, 2.5, 1.25] : [45, 25, 10, 5, 2.5];
  let perSide = (targetWeight - barWeight) / 2;
  if (perSide <= 0) return [];
  const plates = [];
  for (const p of available) { while (perSide >= p) { plates.push(p); perSide -= p; } }
  return plates;
}

function getWarmupSets(workingWeight) {
  const bar = defaultBar();
  if (!workingWeight || workingWeight <= bar) return [];
  const sets = [{ weight: bar, reps: 10, label: 'Bar only' }];
  if (workingWeight > bar * 2.1) sets.push({ weight: Math.round(workingWeight * 0.5 / 5) * 5, reps: 5, label: '~50%' });
  if (workingWeight > bar * 3) sets.push({ weight: Math.round(workingWeight * 0.75 / 5) * 5, reps: 3, label: '~75%' });
  return sets;
}

function calc1RM(weight, reps) {
  weight = parseFloat(weight); reps = parseInt(reps);
  if (!weight || !reps || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

function getProgression(exName) {
  const last = getLastForEx(exName);
  if (!last?.sets?.length) return null;
  if (shouldIncrease(last, getRIR())) {
    const maxW = Math.max(...last.sets.map(s => parseFloat(s.weight) || 0));
    const increment = (state.units === 'kg') ? 2.5 : 5;
    return maxW > 0 ? maxW + increment : null;
  }
  return null;
}

function getWeeklyVolume() {
  const cutoff = Date.now() - 7 * 86400000;
  const recent = history.filter(w => new Date(w.date).getTime() > cutoff);
  const vol = {};
  for (const w of recent) {
    for (const ex of (w.exercises || [])) {
      const g = getMuscleGroup(ex.name);
      if (!vol[g]) vol[g] = { sets: 0, tonnage: 0 };
      const filled = (ex.sets || []).filter(s => s.weight && s.reps);
      vol[g].sets += filled.length;
      vol[g].tonnage += filled.reduce((t, s) => t + (parseFloat(s.weight)||0) * (parseInt(s.reps)||0), 0);
    }
  }
  return vol;
}

// ========== ANALYTICS ==========
function calcFatigueScore() {
  const cutoff = Date.now() - 7 * 86400000;
  const recent = history.filter(w => new Date(w.date).getTime() > cutoff);
  if (!recent.length) return 0;
  let totalSets = 0, totalIntensity = 0;
  for (const w of recent) {
    for (const ex of (w.exercises || [])) {
      for (const s of (ex.sets || [])) {
        if (!s.weight || !s.reps) continue;
        totalSets++;
        const rir = parseInt(s.rir) || 3;
        totalIntensity += (10 - rir) / 10;
      }
    }
  }
  return Math.min(100, Math.round((totalSets * (totalIntensity / (totalSets || 1))) * 1.5));
}

function renderRadarChart(vol) {
  const groups = Object.keys(MUSCLE_GROUPS);
  const maxV = Math.max(...groups.map(g => vol[g]?.sets || 0), 1);
  const cx = 150, cy = 150, r = 90;
  const points = groups.map((g, i) => {
    const angle = (Math.PI * 2 * i / groups.length) - Math.PI / 2;
    const val = (vol[g]?.sets || 0) / maxV;
    return { x: cx + Math.cos(angle) * r * val, y: cy + Math.sin(angle) * r * val };
  });
  const idealPoints = groups.map((_, i) => {
    const angle = (Math.PI * 2 * i / groups.length) - Math.PI / 2;
    return `${cx + Math.cos(angle) * r * 0.6},${cy + Math.sin(angle) * r * 0.6}`;
  });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 300 300');
  svg.setAttribute('class', 'radar-chart');
  svg.innerHTML = `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--card-border)" stroke-width="1"/>
    <polygon points="${idealPoints.join(' ')}" fill="none" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4,4"/>
    <polygon points="${points.map(p => `${p.x},${p.y}`).join(' ')}" fill="rgba(233,69,96,.15)" stroke="var(--accent)" stroke-width="2"/>
    ${groups.map((g, i) => {
      const angle = (Math.PI * 2 * i / groups.length) - Math.PI / 2;
      const lx = cx + Math.cos(angle) * (r + 28);
      const ly = cy + Math.sin(angle) * (r + 28);
      const sets = vol[g]?.sets || 0;
      return `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="central" fill="var(--dim)" font-size="9" font-weight="600" font-family="var(--font)">${g}</text>
        <text x="${lx}" y="${ly + 11}" text-anchor="middle" fill="var(--accent)" font-size="8" font-weight="700" font-family="var(--mono)">${sets}</text>`;
    }).join('')}
    ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="var(--accent)"/>`).join('')}
  `;
  return svg;
}

// ========== FATIGUE DETECTION ==========
function checkFatigue() {
  if (state.mesoWeek === 4) { state.fatigueFlags = 0; return; }
  const lastTwo = history.filter(h => h.dayLabel === activeDay).slice(0, 2);
  if (lastTwo.length < 2) return;
  const [curr, prev] = lastTwo;
  let drops = 0;
  for (const ex of (curr.exercises || [])) {
    const prevEx = prev.exercises?.find(e => e.name === ex.name);
    if (!prevEx) continue;
    const currAvgReps = ex.sets.reduce((s, v) => s + (parseInt(v.reps)||0), 0) / (ex.sets.length||1);
    const prevAvgReps = prevEx.sets.reduce((s, v) => s + (parseInt(v.reps)||0), 0) / (prevEx.sets.length||1);
    if (currAvgReps < prevAvgReps - 1) drops++;
  }
  if (drops >= 2) {
    state.fatigueFlags = (state.fatigueFlags || 0) + 1;
  } else {
    state.fatigueFlags = 0;
  }
}

// ========== REST TIMER ==========
function startRest(secs) {
  if (restInterval) clearInterval(restInterval);
  restEndTime = Date.now() + secs * 1000;
  restTimer = secs;
  haptic(50);
  if ('Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker?.ready?.then(reg => {
      reg.active?.postMessage({ type: 'SCHEDULE_REST', ms: secs * 1000 });
    }).catch(() => {});
  }
  render();
  restInterval = setInterval(() => {
    restTimer = Math.max(0, Math.ceil((restEndTime - Date.now()) / 1000));
    if (restTimer <= 0) {
      clearInterval(restInterval); restInterval = null; restEndTime = null;
      haptic([200, 100, 200]);
      showRestNotification();
    }
    render();
  }, 1000);
}

function stopRest() {
  if (restInterval) clearInterval(restInterval);
  if (elapsedInterval) { clearInterval(elapsedInterval); elapsedInterval = null; }
  restTimer = 0; restInterval = null; restEndTime = null; render();
}

// ========== PR DETECTION ==========
function showPRToast(name, weight) {
  prToasts.push({ name, weight, time: Date.now() });
  haptic([100, 50, 100, 50, 200]);
  setTimeout(() => { prToasts = prToasts.filter(t => Date.now() - t.time < 4000); render(); }, 4000);
  render();
}

// ========== WORKOUT FLOW ==========
function startWorkout(day) {
  activeDay = day;
  workoutExercises = getExercises(day).map(ex => ({...ex}));
  inputs = {}; exerciseNotes = {}; expandedPlateCalc = {}; expandedWarmup = {};
  supersets = []; restPauseExercises = {}; editingEntryId = null;
  workoutStart = Date.now(); screen = 'workout'; render();
}

function copyLast(ei, name) {
  const last = getLastForEx(name);
  if (!last) return;
  last.sets.forEach((s, si) => { inputs[`${ei}-${si}`] = { weight: s.weight||'', reps: s.reps||'', rir: s.rir||'' }; });
  haptic(50); render();
}

function swapExercise(ei, newName) {
  const alts = getAlternativeExercises(workoutExercises[ei].name, state.customExercises);
  const alt = alts.find(a => a === newName);
  if (alt) {
    workoutExercises[ei] = { ...workoutExercises[ei], name: alt };
    inputs = {}; // Clear inputs since exercise changed
  }
  modal = null; render();
}

async function finishWorkout() {
  undoPrevState = JSON.parse(JSON.stringify(state));
  const dur = workoutStart ? Math.round((Date.now() - workoutStart) / 60000) : 0;
  const entry = {
    id: editingEntryId || `${Date.now()}`, date: editingEntryId ? history.find(h=>h.id===editingEntryId)?.date || new Date().toISOString() : new Date().toISOString(),
    phase: state.phase,
    dayLabel: activeDay, weekLabel: state.phase === 'rampup' ? state.rampWeek : `Meso W${state.mesoWeek}`,
    rirTarget: getRIR(), duration: dur,
    exercises: workoutExercises.map((ex, ei) => ({
      name: ex.name, targetReps: ex.reps, note: exerciseNotes[ei] || '',
      sets: Array.from({ length: ex.sets }, (_, si) => {
        const d = inputs[`${ei}-${si}`]||{};
        return { weight: d.weight||'', reps: d.reps||'', rir: d.rir||'', type: d.type||'working' };
      }),
    })),
  };

  // PR detection (before adding to history)
  const newPRs = [];
  for (const ex of entry.exercises) {
    const oldPR = getPR(ex.name);
    const bestW = Math.max(...ex.sets.filter(s=>s.type==='working').map(s => parseFloat(s.weight)||0), 0);
    if (bestW > 0 && bestW > oldPR) newPRs.push({ name: ex.name, weight: bestW });
  }

  if (editingEntryId) {
    const idx = history.findIndex(h => h.id === editingEntryId);
    if (idx >= 0) history[idx] = entry;
    editingEntryId = null;
  } else {
    history.unshift(entry);
    if (history.length > 200) history = history.slice(0, 200);

    if (state.phase === 'rampup') {
      const { rampup } = curProgram();
      const days = Object.keys(rampup[state.rampWeek]||{});
      const di = days.indexOf(activeDay);
      if (di >= days.length - 1) {
        if (state.rampWeek === 'Week 1') { state.rampWeek = 'Week 2'; state.rampDayIdx = 0; }
        else { state.phase = 'ppl'; state.mesoWeek = 1; state.pplIdx = 0; }
      } else { state.rampDayIdx = di + 1; }
    } else {
      const { ppl } = curProgram();
      const ni = (state.pplIdx + 1) % ppl.length;
      state.pplIdx = ni;
      if (ni === 0) state.mesoWeek = state.mesoWeek >= 4 ? 1 : state.mesoWeek + 1;
    }
  }

  checkFatigue();

  // Track longest streak
  let curStreak = 0;
  const now2 = new Date();
  for (const h2 of history) { const d = new Date(h2.date); if (Math.floor((now2-d)/86400000) <= curStreak+2) curStreak++; else break; }
  if (curStreak > (state.longestStreak || 0)) state.longestStreak = curStreak;

  await Storage.set('state', state);
  await Storage.set('history', history);
  haptic([100, 50, 100, 50, 200]);
  activeDay = null; inputs = {}; stopRest();

  undoEntry = entry;
  if (undoTimeout) clearTimeout(undoTimeout);
  undoTimeout = setTimeout(() => { undoEntry = null; undoPrevState = null; render(); }, 30000);

  screen = 'home'; render();
  for (const pr of newPRs) showPRToast(pr.name, pr.weight);
}

async function undoLastWorkout() {
  if (!undoEntry || !undoPrevState) return;
  history = history.filter(h => h.id !== undoEntry.id);
  state = undoPrevState;
  await Storage.set('state', state);
  await Storage.set('history', history);
  undoEntry = null; undoPrevState = null;
  if (undoTimeout) clearTimeout(undoTimeout);
  haptic(50); render();
}

// ========== EXERCISE HISTORY ==========
function showExerciseHistory(name) {
  const entries = [];
  let bestEver = 0;
  for (const w of history) {
    const ex = w.exercises?.find(e => e.name === name);
    if (!ex) continue;
    const bestW = Math.max(...(ex.sets||[]).map(s => parseFloat(s.weight)||0), 0);
    if (bestW > bestEver) bestEver = bestW;
    const e1rm = Math.max(...(ex.sets||[]).map(s => calc1RM(s.weight, s.reps)), 0);
    entries.push({ date: w.date, sets: ex.sets, bestW, e1rm, isPR: bestW === bestEver && bestW > 0 });
    if (entries.length >= 20) break;
  }
  modal = {
    title: name,
    content: el('div', { cls: 'ex-history-list' },
      entries.length === 0
        ? el('div', { css: 'color:var(--dim);font-size:13px' }, 'No history yet')
        : el('div', null, ...entries.map(e =>
            el('div', { cls: 'ex-history-row' },
              el('div', { css: 'display:flex;justify-content:space-between;align-items:center' },
                el('span', { css: 'font-size:12px;color:var(--dim)' }, fmtDate(e.date)),
                el('span', { css: 'display:flex;gap:6px;align-items:center' },
                  e.e1rm > 0 ? el('span', { css: 'font-size:10px;color:var(--dim);font-family:var(--mono)' }, `e1RM: ${e.e1rm}`) : null,
                  e.isPR ? el('span', { cls: 'pr-tag', css: 'margin-left:0' }, 'PR') : null,
                ),
              ),
              el('div', { css: 'font-size:11px;color:var(--text);font-family:var(--mono);margin-top:2px' },
                e.sets.map(s => `${s.weight||'-'}x${s.reps||'-'}`).join('  ')),
            )
          )),
    ),
  };
  render();
}

// ========== WORKOUT EDITING ==========
function editWorkout(entryId) {
  const entry = history.find(h => h.id === entryId);
  if (!entry) return;
  editingEntryId = entryId;
  activeDay = entry.dayLabel;
  workoutExercises = (entry.exercises || []).map(ex => ({
    name: ex.name, sets: ex.sets?.length || 3, reps: ex.targetReps || '8-10', rest: 90,
  }));
  inputs = {};
  exerciseNotes = {};
  for (let ei = 0; ei < entry.exercises.length; ei++) {
    const ex = entry.exercises[ei];
    if (ex.note) exerciseNotes[ei] = ex.note;
    for (let si = 0; si < (ex.sets||[]).length; si++) {
      const s = ex.sets[si];
      inputs[`${ei}-${si}`] = { weight: s.weight||'', reps: s.reps||'', rir: s.rir||'', type: s.type||'working' };
    }
  }
  expandedPlateCalc = {}; expandedWarmup = {};
  supersets = []; restPauseExercises = {};
  workoutStart = Date.now();
  screen = 'workout'; render();
}

// ========== WORKOUT SHARING ==========
function shareWorkout(entry) {
  let text = `${entry.dayLabel} \u2014 ${fmtDate(entry.date)}\n`;
  for (const ex of (entry.exercises || [])) {
    text += `${ex.name}: ${ex.sets.map(s => `${s.weight||'-'}x${s.reps||'-'}`).join(', ')}\n`;
  }
  text += `Duration: ${entry.duration || '?'}min | RIR: ${entry.rirTarget}`;
  if (navigator.share) {
    navigator.share({ title: 'Workout', text }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text).then(() => {
      modal = { title: 'Copied!', message: 'Workout summary copied to clipboard.' };
      render();
    }).catch(() => {});
  }
}

// ========== EXERCISE SCHEME EDITING ==========
function editExerciseScheme(ei) {
  const ex = workoutExercises[ei];
  modal = {
    title: `Edit: ${ex.name}`,
    content: el('div', null,
      el('div', { css: 'margin-bottom:12px' },
        el('label', { cls: 'label', css: 'display:block;margin-bottom:4px' }, 'Sets'),
        el('div', { css: 'display:flex;gap:6px' },
          ...[1,2,3,4,5,6,7,8].map(n => el('button', {
            cls: `btn-sm ${ex.sets===n?'green':''}`,
            onclick: () => { workoutExercises[ei].sets = n; modal = null; render(); }
          }, String(n)))
        ),
      ),
      el('div', null,
        el('label', { cls: 'label', css: 'display:block;margin-bottom:4px' }, 'Target Reps'),
        el('input', { type: 'text', cls: 'set-input', css: 'text-align:left;font-size:14px', value: ex.reps,
          oninput: e => { workoutExercises[ei].reps = e.target.value; }
        }),
      ),
      el('button', { cls: 'btn', css: 'margin-top:12px', onclick: () => { modal = null; render(); } }, 'Done'),
    ),
  };
  render();
}

// ========== CUSTOM EXERCISES ==========
function showAddCustomExercise() {
  let name = '', group = 'Chest', sets = 3, reps = '10-12', rest = 60;
  const groups = Object.keys(MUSCLE_GROUPS);
  modal = {
    title: 'Add Custom Exercise',
    content: el('div', null,
      el('label', { cls: 'label', css: 'display:block;margin-bottom:4px' }, 'Exercise Name'),
      el('input', { type: 'text', cls: 'set-input', css: 'text-align:left;font-size:14px;margin-bottom:10px',
        placeholder: 'e.g. Smith Machine Squat',
        oninput: e => { name = e.target.value; }
      }),
      el('label', { cls: 'label', css: 'display:block;margin-bottom:4px' }, 'Muscle Group'),
      el('div', { css: 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px' },
        ...groups.map(g => el('button', { cls: `btn-sm ${group===g?'green':''}`,
          onclick: () => { group = g; render(); }
        }, g))
      ),
      el('div', { css: 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px' },
        el('div', null,
          el('label', { cls: 'label', css: 'display:block;margin-bottom:4px' }, 'Sets'),
          el('input', { type: 'number', cls: 'set-input', value: '3', oninput: e => { sets = parseInt(e.target.value)||3; } }),
        ),
        el('div', null,
          el('label', { cls: 'label', css: 'display:block;margin-bottom:4px' }, 'Reps'),
          el('input', { type: 'text', cls: 'set-input', value: '10-12', oninput: e => { reps = e.target.value; } }),
        ),
        el('div', null,
          el('label', { cls: 'label', css: 'display:block;margin-bottom:4px' }, 'Rest (s)'),
          el('input', { type: 'number', cls: 'set-input', value: '60', oninput: e => { rest = parseInt(e.target.value)||60; } }),
        ),
      ),
      el('button', { cls: 'btn btn-green', onclick: async () => {
        if (!name.trim()) return;
        if (!state.customExercises) state.customExercises = [];
        state.customExercises.push({ name: name.trim(), group, sets, reps, rest });
        await Storage.set('state', state);
        modal = null; render();
      }}, 'Add Exercise'),
    ),
  };
  render();
}

// ========== BODY WEIGHT ==========
async function logBodyWeight(weight) {
  const today = new Date().toISOString().split('T')[0];
  const idx = bodyWeights.findIndex(b => b.date === today);
  if (idx >= 0) bodyWeights[idx].weight = weight;
  else bodyWeights.push({ date: today, weight });
  bodyWeights.sort((a, b) => a.date.localeCompare(b.date));
  if (bodyWeights.length > 365) bodyWeights = bodyWeights.slice(-365);
  await Storage.set('bodyWeights', bodyWeights);
}

// ========== PULL TO REFRESH ==========
function setupPullToRefresh() {
  document.addEventListener('touchstart', e => {
    if (screen === 'home' && window.scrollY === 0) { pullY = e.touches[0].clientY; pullActive = true; pullDist = 0; }
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!pullActive) return;
    pullDist = e.touches[0].clientY - pullY;
    const ind = document.getElementById('pull-indicator');
    if (ind && pullDist > 10) {
      ind.style.height = Math.min(pullDist * 0.4, 36) + 'px';
      ind.style.opacity = Math.min(pullDist / 80, 1);
      ind.textContent = pullDist > 60 ? 'Release to sync' : 'Pull to sync';
    }
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (pullActive && pullDist > 60) loadData();
    pullActive = false; pullDist = 0;
    const ind = document.getElementById('pull-indicator');
    if (ind) { ind.style.height = '0'; ind.style.opacity = '0'; }
  });
}

// ========== DATA ==========
function exportCSV() {
  let csv = 'Date,Day,Week,Phase,RIR Target,Duration,Exercise,Set,Weight,Reps,RIR,Note\n';
  for (const w of history) for (const ex of (w.exercises||[])) for (let i = 0; i < (ex.sets||[]).length; i++) {
    const s = ex.sets[i];
    csv += `"${w.date}","${w.dayLabel}","${w.weekLabel}","${w.phase}","${w.rirTarget}","${w.duration||''}","${ex.name}","${i+1}","${s.weight}","${s.reps}","${s.rir}","${(ex.note||'').replace(/"/g,'""')}"\n`;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `hypertrophy-log-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

function importCSV() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.csv';
  input.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split('\n').slice(1).filter(l => l.trim());
    const grouped = {};
    for (const line of lines) {
      const cols = line.match(/("(?:[^"]|"")*"|[^,]*)/g)?.map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"')) || [];
      if (cols.length < 12) continue;
      const [date, day, week, phase, rir, dur, exName, setNum, weight, reps, rirVal, note] = cols;
      const key = `${date}-${day}`;
      if (!grouped[key]) grouped[key] = { date, dayLabel: day, weekLabel: week, phase, rirTarget: rir, duration: parseInt(dur)||0, exercises: {} };
      if (!grouped[key].exercises[exName]) grouped[key].exercises[exName] = { name: exName, targetReps: '', note: note || '', sets: [] };
      grouped[key].exercises[exName].sets.push({ weight, reps, rir: rirVal, type: 'working' });
      if (note) grouped[key].exercises[exName].note = note;
    }
    const newEntries = Object.values(grouped).map(g => ({
      id: `imp-${new Date(g.date).getTime()}`,
      date: g.date, dayLabel: g.dayLabel, weekLabel: g.weekLabel, phase: g.phase,
      rirTarget: g.rirTarget, duration: g.duration,
      exercises: Object.values(g.exercises),
    }));
    const existingIds = new Set(history.map(h => h.id));
    const existingDates = new Set(history.map(h => `${h.date}-${h.dayLabel}`));
    const fresh = newEntries.filter(e => !existingIds.has(e.id) && !existingDates.has(`${e.date}-${e.dayLabel}`));
    const dupes = newEntries.length - fresh.length;
    modal = {
      title: 'Import CSV',
      message: `Found ${newEntries.length} workouts. ${fresh.length} new, ${dupes} duplicates skipped.`,
      onConfirm: async () => {
        history = [...fresh, ...history].sort((a, b) => new Date(b.date) - new Date(a.date));
        if (history.length > 200) history = history.slice(0, 200);
        await Storage.set('history', history);
        modal = null; render();
      },
    };
    render();
  };
  input.click();
}

async function resetAll() {
  state = { ...DEFAULT_STATE }; history = []; bodyWeights = [];
  await Storage.set('state', state);
  await Storage.set('history', history);
  await Storage.set('bodyWeights', bodyWeights);
  modal = null; screen = 'home'; render();
}

// ========== RENDER ENGINE ==========
function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) e[k] = v;
    else if (k === 'cls') e.className = v;
    else if (k === 'css') e.style.cssText = v;
    else if (k === 'value') e.value = v;
    else e.setAttribute(k, v);
  }
  for (const c of kids) {
    if (c == null || c === false) continue;
    if (typeof c === 'string' || typeof c === 'number') e.append(String(c));
    else if (Array.isArray(c)) c.forEach(x => x && e.append(x));
    else e.append(c);
  }
  return e;
}

function renderModal() {
  if (!modal) return null;
  return el('div', { cls: 'modal-overlay', onclick: () => { modal = null; render(); } },
    el('div', { cls: 'modal', onclick: e => e.stopPropagation() },
      el('h3', null, modal.title),
      modal.message ? el('p', null, modal.message) : null,
      modal.content || null,
      modal.onConfirm ? el('div', { cls: 'modal-btns' },
        el('button', { cls: 'btn-ghost muted', onclick: () => { modal = null; render(); } }, 'Never mind'),
        el('button', { cls: 'btn btn-red', onclick: modal.onConfirm }, 'Yes, do it'),
      ) : null,
    ),
  );
}

const NAV_ITEMS = [
  ['home', '\uD83C\uDFE0', 'Home'],
  ['history', '\uD83D\uDCCB', 'History'],
  ['progress', '\uD83D\uDCC8', 'Progress'],
  ['health', '\u2764\uFE0F', 'Health'],
  ['settings', '\u2699\uFE0F', 'Settings'],
];
const isDesktop = () => window.matchMedia('(min-width:900px)').matches;

function renderNav() {
  const items = [...NAV_ITEMS];
  if (isAdmin()) items.push(['admin', '\uD83D\uDEE1\uFE0F', 'Admin']);
  return el('div', { cls: 'nav' },
    ...items.map(([k, icon, label]) =>
      el('button', { cls: screen === k ? 'active' : '', onclick: () => {
        if (screen === 'workout') return;
        screen = k;
        if (k === 'admin' && !adminUsers) loadAdminData();
        render();
      }},
        el('span', { cls: 'nav-icon' }, icon),
        el('span', { cls: 'nav-label' }, label))
    ),
  );
}

// ========== SCREENS ==========
function renderLogin() {
  return el('div', { cls: 'screen login-screen' },
    el('div', { cls: 'login-box' },
      el('div', { css: 'text-align:center;margin-bottom:32px' },
        el('h1', { css: 'font-size:28px;font-weight:900;color:var(--white);margin-bottom:4px' }, 'HYPERTROPHY'),
        el('div', { css: 'font-size:14px;color:var(--accent);font-weight:700;letter-spacing:2px' }, 'TRACKER'),
      ),
      el('div', { css: 'margin-bottom:20px' },
        el('label', { cls: 'label', css: 'display:block;margin-bottom:8px' }, 'Enter your birthday to sync'),
        el('input', { type: 'tel', id: 'pin-input', cls: 'pin-input', placeholder: 'MMDDYYYY', maxlength: '8', inputmode: 'numeric',
          onkeyup: e => { if (e.key === 'Enter') doLogin(e.target.value); }
        }),
        el('div', { id: 'login-error', css: 'color:#ef4444;font-size:12px;margin-top:6px;min-height:18px' }),
      ),
      el('button', { cls: 'btn', onclick: () => doLogin(document.getElementById('pin-input').value) }, 'START TRACKING'),
      el('div', { css: 'text-align:center;margin-top:16px;font-size:11px;color:var(--dim)' }, 'Your birthday is your sync key across devices'),
    ),
  );
}

function renderHome() {
  const next = getNextDay();
  const exCount = getExercises(next)?.length || 0;
  const streak = (() => { let s = 0; const now = new Date(); for (const h2 of history) { const d = new Date(h2.date); if (Math.floor((now-d)/86400000) <= s+2) s++; else break; } return s; })();
  const weeklyStreak = (() => {
    const weeks = {};
    for (const h2 of history) {
      const d = new Date(h2.date);
      const weekStart = new Date(d); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const key = weekStart.toISOString().split('T')[0];
      weeks[key] = (weeks[key] || 0) + 1;
    }
    const sortedWeeks = Object.entries(weeks).sort((a, b) => b[0].localeCompare(a[0]));
    let ws = 0;
    for (const [, count] of sortedWeeks) { if (count >= 3) ws++; else break; }
    return ws;
  })();
  const daysSince = history[0]?.date ? Math.floor((Date.now() - new Date(history[0].date).getTime()) / 86400000) : '-';

  return el('div', { cls: 'screen' }, renderModal(),
    el('div', { id: 'pull-indicator', cls: 'pull-indicator mobile-only', css: 'height:0;opacity:0;overflow:hidden' }),
    el('div', { cls: 'header' },
      el('div', { cls: 'header-row' },
        el('div', null,
          el('h1', null, 'HYPERTROPHY TRACKER', el('span', { cls: 'platform-badge' }, 'WEB')),
          el('div', { cls: 'sub' }, state.phase === 'rampup' ? `Ramp-Up \u2022 ${state.rampWeek}` : `PPL \u2022 Mesocycle W${state.mesoWeek}`),
        ),
        el('div', { cls: `sync-dot ${isOnline ? '' : 'offline'}`, title: isOnline ? 'Synced' : 'Offline' }),
      ),
    ),

    // Install banner
    deferredPrompt && !installDismissed ? el('div', { cls: 'install-banner' },
      el('p', null, 'Install for the best experience'),
      el('button', { cls: 'btn', onclick: installApp }, 'Install'),
      el('button', { cls: 'btn-sm', onclick: () => { installDismissed = true; render(); } }, '\u2715'),
    ) : null,
    !isStandalone() && isIOS() && !installDismissed ? el('div', { cls: 'install-banner' },
      el('p', null, 'Tap Share \u2192 Add to Home Screen'),
      el('button', { cls: 'btn-sm', onclick: () => { installDismissed = true; render(); } }, '\u2715'),
    ) : null,

    getRecoveryStatus() === 'warn' ? el('div', { cls: 'recovery-banner recovery-warn', css: 'margin:10px 14px' },
      el('span', null, '\u26A0\uFE0F Low recovery \u2014 take it easy today'),
    ) : null,

    (state.fatigueFlags || 0) >= 2 ? el('div', { cls: 'fatigue-banner' },
      el('span', null, 'Fatigue detected \u2014 consider an early deload'),
      el('button', { cls: 'btn-sm', css: 'background:rgba(255,255,255,.2);color:#fff', onclick: async () => {
        state.mesoWeek = 4; state.fatigueFlags = 0; await Storage.set('state', state); render();
      }}, 'Go to Deload'),
    ) : null,

    el('div', { cls: 'stats' },
      ...[
        [history.length, 'Workouts', 'accent'],
        [`${streak}${weeklyStreak > 0 ? ' \uD83D\uDD25' : ''}`, `Streak${weeklyStreak > 0 ? ` (${weeklyStreak}w)` : ''}`, 'green'],
        [daysSince, 'Days Ago', ''],
      ].map(([v, l, c]) => el('div', { cls: 'stat-card' }, el('div', { cls: `stat-val ${c}` }, String(v)), el('div', { cls: 'label' }, l))),
    ),
    (state.longestStreak || 0) > 0 ? el('div', { css: 'text-align:center;font-size:10px;color:var(--dim);margin-top:2px;padding:0 14px' },
      `Longest streak: ${state.longestStreak} workouts`) : null,

    // Heatmap
    history.length > 0 ? (() => {
      const workoutDates = {};
      for (const h2 of history) { const d = new Date(h2.date).toISOString().split('T')[0]; workoutDates[d] = (workoutDates[d] || 0) + 1; }
      const today2 = new Date(), todayStr = today2.toISOString().split('T')[0];
      const startDate = new Date(today2); startDate.setDate(startDate.getDate() - 12 * 7 - startDate.getDay());
      const heatCells = [];
      for (let i = 0; i < 12 * 7; i++) {
        const d = new Date(startDate); d.setDate(d.getDate() + i);
        const ds = d.toISOString().split('T')[0], count = workoutDates[ds] || 0;
        const lvl = count >= 2 ? 'l3' : count === 1 ? 'l2' : '';
        heatCells.push(el('div', { cls: `heatmap-cell ${lvl} ${ds === todayStr ? 'today' : ''}`, css: d > today2 ? 'opacity:.3' : '', title: ds }));
      }
      return el('div', { cls: 'card', css: 'margin:10px 14px' },
        el('div', { cls: 'label', css: 'margin-bottom:6px' }, 'Activity (12 weeks)'),
        el('div', { css: 'display:flex' },
          el('div', { cls: 'heatmap-labels' }, ...['S','M','T','W','T','F','S'].map(d => el('span', null, d))),
          el('div', { cls: 'heatmap-grid' }, ...heatCells),
        ),
      );
    })() : null,

    el('div', { cls: 'home-grid' },
      // Your Week summary
      (() => {
        const now = new Date(), weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const wkStr = weekStart.toISOString().split('T')[0];
        const wkWorkouts = history.filter(h2 => h2.date >= wkStr);
        const wkSets = wkWorkouts.reduce((s, w) => s + (w.exercises || []).reduce((s2, e) => s2 + (e.sets || []).filter(st => st.weight && st.reps).length, 0), 0);
        const wkBW = bodyWeights.filter(b => b.date >= wkStr);
        const wkSleep = wkBW.filter(b => b.sleep);
        const avgSl = wkSleep.length ? (wkSleep.reduce((s, b) => s + b.sleep, 0) / wkSleep.length).toFixed(1) : '--';
        const wkWater = wkBW.filter(b => (b.water || 0) >= 6).length;
        let bestLift = '', bestE1RM = 0;
        for (const w of wkWorkouts) for (const ex of (w.exercises || [])) for (const s of (ex.sets || [])) {
          const rm = calc1RM(s.weight, s.reps);
          if (rm > bestE1RM) { bestE1RM = rm; bestLift = ex.name; }
        }
        return el('div', { cls: 'card full-width' },
          el('div', { cls: 'label', css: 'margin-bottom:8px' }, 'Your Week'),
          el('div', { cls: 'health-stat-row' },
            el('div', { cls: 'health-stat' },
              el('div', { cls: 'health-stat-val accent' }, String(wkWorkouts.length)),
              el('div', { cls: 'health-stat-label' }, 'Workouts'),
            ),
            el('div', { cls: 'health-stat' },
              el('div', { cls: 'health-stat-val' }, String(wkSets)),
              el('div', { cls: 'health-stat-label' }, 'Sets'),
            ),
            el('div', { cls: 'health-stat' },
              el('div', { css: 'font-size:18px;font-weight:800;font-family:var(--mono);color:var(--purple)' }, avgSl),
              el('div', { cls: 'health-stat-label' }, 'Avg Sleep'),
            ),
          ),
          el('div', { css: 'display:flex;justify-content:space-between;font-size:11px;color:var(--dim);margin-top:6px' },
            el('span', null, `Water: ${wkWater}/${Math.min(now.getDay() + 1, 7)} days`),
            bestLift ? el('span', null, `Best: ${bestLift} ${fmtW(bestE1RM)} e1RM`) : null,
          ),
        );
      })(),

      el('div', { cls: 'card', css: 'display:flex;justify-content:space-between;align-items:center' },
        el('div', null,
          el('div', { css: 'display:flex;gap:8px;align-items:center;margin-bottom:4px' },
            el('span', { cls: 'label' }, 'Phase'),
            el('span', { cls: `badge ${state.phase==='rampup'?'badge-accent':'badge-green'}` }, state.phase==='rampup'?'RAMP-UP':'FULL PPL'),
          ),
          el('div', { css: 'font-size:13px;color:var(--dim)' }, 'RIR Target: ', el('strong', { css: 'color:var(--accent)' }, getRIR())),
          state.phase==='ppl' ? el('div', { css: 'font-size:13px;color:var(--dim)' }, `W${state.mesoWeek} \u2022 ${curProgram().ppl[state.pplIdx]?.day || ''}`) : null,
        ),
      ),

      el('div', { cls: 'card accent-border full-width' },
        el('div', { cls: 'label', css: 'margin-bottom:6px' }, 'Next Workout'),
        el('div', { css: 'font-size:20px;font-weight:800;color:var(--white);margin-bottom:2px' }, next),
        el('div', { css: 'font-size:12px;color:var(--dim);margin-bottom:14px' }, `${exCount} exercises`),
        el('button', { cls: 'btn', onclick: () => startWorkout(next) }, 'START WORKOUT'),
      ),

      el('div', { cls: 'card full-width' },
        el('span', { cls: 'label', css: 'display:block;margin-bottom:10px' }, 'All Days'),
        el('div', { cls: 'day-list' },
          ...getDays().map(d => el('button', { cls: `btn-ghost day-btn ${d===next?'':'muted'}`, onclick: () => startWorkout(d) },
            el('span', null, d), d===next ? el('span', { cls: 'next-tag' }, 'NEXT') : null)),
        ),
      ),
    ),
    renderNav(),
  );
}

function renderWorkout() {
  const exercises = workoutExercises;
  const elapsedSec = workoutStart ? Math.floor((Date.now() - workoutStart) / 1000) : 0;
  const elapsedMin = Math.floor(elapsedSec / 60);
  const elapsedRemSec = elapsedSec % 60;
  const elapsedStr = `${String(elapsedMin).padStart(2, '0')}:${String(elapsedRemSec).padStart(2, '0')}`;

  if (!elapsedInterval && workoutStart) {
    elapsedInterval = setInterval(() => {
      const timerEl = document.getElementById('elapsed-timer');
      if (!timerEl || screen !== 'workout') { clearInterval(elapsedInterval); elapsedInterval = null; return; }
      const sec = Math.floor((Date.now() - workoutStart) / 1000);
      timerEl.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    }, 1000);
  }

  return el('div', { cls: 'screen' }, renderModal(),
    !isOnline ? el('div', { cls: 'offline-banner' }, 'Offline \u2014 using local data') : null,
    el('div', { cls: 'header workout-header' },
      el('div', { cls: 'header-row' },
        el('div', null,
          el('h1', { css: 'display:flex;align-items:center;gap:10px' }, activeDay,
            el('span', { id: 'elapsed-timer', cls: 'elapsed-timer' }, elapsedStr)),
          el('div', { cls: 'sub' }, `${editingEntryId ? 'EDITING \u2022 ' : ''}Target: ${getRIR()}`)),
        el('button', { cls: 'btn-sm red', onclick: () => {
          modal = { title: 'Abandon Workout?', message: 'Your logged sets will be lost.',
            onConfirm: () => { activeDay=null; stopRest(); screen='home'; modal=null; render(); } }; render();
        }}, 'Cancel'),
      ),
    ),

    restTimer > 0 ? el('div', { cls: 'rest-bar' },
      el('span', { cls: 'rest-time' }, fmtTime(restTimer)),
      el('button', { cls: 'btn-sm', css: 'background:rgba(255,255,255,.25);color:#fff', onclick: stopRest }, 'SKIP'),
    ) : null,

    ...exercises.map((ex, ei) => {
      const last = getLastForEx(ex.name), pr = getPR(ex.name);
      const prog = getProgression(ex.name);
      const allDone = Array.from({ length: ex.sets }, (_, si) => inputs[`${ei}-${si}`]).every(s => s?.weight && s?.reps);
      const bestSet = Object.entries(inputs).filter(([k]) => k.startsWith(`${ei}-`)).reduce((best, [, v]) => {
        const rm = calc1RM(v.weight, v.reps);
        return rm > best ? rm : best;
      }, 0);
      const plateWeight = last?.sets?.[0]?.weight ? parseFloat(last.sets[0].weight) : 0;
      const warmups = expandedWarmup[ei] ? getWarmupSets(prog || plateWeight || 0) : [];

      return el('div', { cls: `card ${allDone?'green-border':''}` },
        // Exercise header + swap
        el('div', { css: 'display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px' },
          el('div', { css: 'flex:1' },
            el('div', { css: 'display:flex;align-items:center;gap:6px;flex-wrap:wrap' },
              (() => {
                let pressTimer = null;
                return el('span', { css: 'font-size:14px;font-weight:700;color:var(--white);cursor:pointer;text-decoration:underline dotted var(--muted);-webkit-user-select:none;user-select:none',
                  onmousedown: () => { pressTimer = setTimeout(() => editExerciseScheme(ei), 500); },
                  onmouseup: () => clearTimeout(pressTimer),
                  ontouchstart: () => { pressTimer = setTimeout(() => { editExerciseScheme(ei); }, 500); },
                  ontouchend: () => clearTimeout(pressTimer),
                  onclick: () => {
                    const alts = getAlternativeExercises(ex.name, state.customExercises);
                    modal = { title: ex.name,
                    content: el('div', null,
                      alts.length ? el('div', null,
                        el('div', { cls: 'label', css: 'margin-bottom:6px' }, 'Swap to:'),
                        el('div', { cls: 'swap-list' },
                          ...alts.map(a => el('button', { cls: 'swap-item', onclick: () => swapExercise(ei, a) }, a))
                        ),
                      ) : null,
                      el('button', { cls: 'btn-ghost', css: 'margin-top:8px', onclick: () => { modal=null; showExerciseHistory(ex.name); } }, 'View History'),
                    ),
                  };
                  render();
                }
              }, ex.name);
              })(),
              EXERCISE_DEMOS[ex.name] ? el('a', { href: EXERCISE_DEMOS[ex.name], target: '_blank', rel: 'noopener',
                cls: 'demo-link', onclick: e => e.stopPropagation() }, '\u24D8') : null,
              prog ? el('button', { cls: 'prog-tag prog-nudge', onclick: e => {
                e.stopPropagation();
                for (let si = 0; si < ex.sets; si++) {
                  if (!inputs[`${ei}-${si}`]) inputs[`${ei}-${si}`] = {};
                  if (!inputs[`${ei}-${si}`].weight) inputs[`${ei}-${si}`].weight = String(prog);
                }
                render();
              }}, `\u2191 ${fmtW(prog)} ${unitLabel()} \u2014 tap to apply`) : null,
            ),
            el('div', { css: 'display:flex;gap:6px;align-items:center;font-size:11px;color:var(--dim);margin-top:1px' },
              `${ex.sets}x${ex.reps} \u2022 Rest ${ex.rest}s`,
              restPauseExercises[ei] ? el('span', { cls: 'rp-badge' }, 'RP') : null,
              supersets.some(s => s.includes(ei)) ? el('span', { cls: 'ss-badge' }, 'SS') : null,
            ),
            bestSet > 0 ? el('div', { cls: 'e1rm' }, `Est. 1RM: ${fmtW(bestSet)}`) : null,
          ),
          el('div', { css: 'display:flex;gap:4px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end' },
            last ? el('button', { cls: 'btn-sm blue', onclick: () => copyLast(ei, ex.name) }, 'Copy') : null,
            el('button', { cls: 'btn-sm green', onclick: () => { expandedPlateCalc[ei] = !expandedPlateCalc[ei]; render(); } }, 'Plates'),
            el('button', { cls: `btn-sm ${restPauseExercises[ei]?'active-rp':''}`, onclick: () => { restPauseExercises[ei] = !restPauseExercises[ei]; render(); } }, 'RP'),
            ei < exercises.length - 1 ? el('button', { cls: `btn-sm ${supersets.some(s=>s[0]===ei)?'active-ss':''}`, onclick: () => {
              const idx = supersets.findIndex(s=>s[0]===ei);
              if (idx>=0) supersets.splice(idx,1); else supersets.push([ei, ei+1]);
              render();
            }}, '\u26D3') : null,
          ),
        ),

        // Plate calculator
        expandedPlateCalc[ei] ? (() => {
          const w = inputs[`${ei}-0`]?.weight || last?.sets?.[0]?.weight || '';
          const plates = w ? calcPlates(parseFloat(w)) : [];
          return el('div', { cls: 'plate-calc' },
            el('div', { css: 'font-size:11px;color:var(--dim);margin-bottom:4px' },
              w ? `${w}${unitLabel()} \u2192 Per side:` : 'Enter weight to see plates'),
            plates.length ? el('div', { cls: 'plate-calc-row' },
              ...plates.map(p => el('span', { cls: `plate-chip x${String(p).replace('.', '-')}` }, `${p}`))
            ) : null,
          );
        })() : null,

        // Warm-up toggle + sets
        el('div', { css: 'display:flex;gap:8px;margin-bottom:6px' },
          el('button', { cls: 'btn-sm', css: 'font-size:10px', onclick: () => { expandedWarmup[ei] = !expandedWarmup[ei]; render(); } },
            expandedWarmup[ei] ? 'Hide Warm-up' : 'Warm-up'),
        ),
        warmups.length ? el('div', { cls: 'warmup-section' },
          ...warmups.map(w => el('div', { cls: 'warmup-row' },
            el('span', null, w.label), el('span', null, `${fmtW(w.weight)} \u00D7 ${w.reps}`)
          )),
        ) : null,

        // Last performance
        last ? el('div', { cls: 'last-perf' },
          'Last: ' + last.sets.map(s => `${s.weight ? fmtW(s.weight) : '?'}x${s.reps||'?'}`).join('  '),
              pr > 0 ? el('span', { cls: 'pr-tag' }, `PR: ${fmtW(pr)}`) : null,
        ) : null,

        // Percentage-based suggestions
        (() => {
          const e1rm = getPR(ex.name) || 0;
          if (e1rm <= 0) return null;
          return el('div', { cls: 'pct-row' },
            el('span', { css: 'font-size:10px;color:var(--dim);margin-right:4px' }, '% 1RM:'),
            ...[70, 75, 80, 85].map(pct => {
              const w = Math.round(e1rm * pct / 100 / 2.5) * 2.5;
              return el('button', { cls: 'pct-chip', onclick: () => {
                for (let si = 0; si < ex.sets; si++) { if (!inputs[`${ei}-${si}`]) inputs[`${ei}-${si}`] = {}; inputs[`${ei}-${si}`].weight = String(w); }
                render();
              }}, `${pct}% ${w}`);
            }),
          );
        })(),

        // Set inputs
        el('div', { cls: 'set-grid-5' },
          el('div', { cls: 'label', css: 'font-size:9px' }, '#'),
          el('div', { cls: 'label', css: 'font-size:9px;text-align:center' }, unitLabel().toUpperCase()),
          el('div', { cls: 'label', css: 'font-size:9px;text-align:center' }, 'REPS'),
          el('div', { cls: 'label', css: 'font-size:9px;text-align:center' }, 'RIR'),
          el('div', { cls: 'label', css: 'font-size:9px;text-align:center' }, 'TYPE'),
          ...Array.from({ length: ex.sets }, (_, si) => {
            const k = `${ei}-${si}`, v = inputs[k]||{}, done = v.weight && v.reps;
            const setType = v.type || 'working';
            const typeLabel = setType === 'drop' ? '\u2193' : setType === 'failure' ? 'F' : '\u2022';
            return [
              el('div', { cls: `set-num ${done?'done':''}` }, done?'\u2713':String(si+1)),
              el('input', { type:'number', inputmode:'decimal', id:`in-${ei}-${si}-w`, cls:`set-input ${done?'done':''}`, placeholder:'-', value:v.weight||'',
                oninput: e => { if(!inputs[k]) inputs[k]={}; inputs[k].weight=e.target.value; },
                onkeydown: e => { if(e.key==='Enter'){const n=document.getElementById(`in-${ei}-${si}-r`);if(n){n.focus();n.select();}}} }),
              el('input', { type:'number', inputmode:'numeric', id:`in-${ei}-${si}-r`, cls:`set-input ${done?'done':''}`, placeholder:'-', value:v.reps||'',
                oninput: e => { if(!inputs[k]) inputs[k]={}; inputs[k].reps=e.target.value;
                  if(v.weight&&e.target.value){haptic(30);
                    if(restPauseExercises[ei]) startRest(15);
                  } },
                onkeydown: e => { if(e.key==='Enter'){const n=document.getElementById(`in-${ei}-${si}-i`);if(n){n.focus();n.select();}}} }),
              el('input', { type:'number', inputmode:'numeric', id:`in-${ei}-${si}-i`, cls:`set-input ${done?'done':''}`, placeholder:'-', value:v.rir||'',
                oninput: e => { if(!inputs[k]) inputs[k]={}; inputs[k].rir=e.target.value; },
                onkeydown: e => { if(e.key==='Enter'){const n=document.getElementById(`in-${ei}-${si+1}-w`)||document.getElementById(`in-${ei+1}-0-w`);if(n){n.focus();n.select();}}} }),
              el('button', { cls: `set-type-btn ${setType}`, onclick: () => {
                if(!inputs[k]) inputs[k]={};
                const cycle = { working:'drop', drop:'failure', failure:'working' };
                inputs[k].type = cycle[setType];
                render();
              }}, typeLabel),
            ];
          }).flat(),
        ),

        // Rest presets
        el('div', { cls: 'rest-presets' },
          ...[60, 90, 120, 180].map(s =>
            el('button', { cls: `rest-pill ${s === ex.rest ? 'active' : ''}`, onclick: () => startRest(s) }, `${s}s`)),
          ex.rest && ![60,90,120,180].includes(ex.rest)
            ? el('button', { cls: 'rest-pill active', onclick: () => startRest(ex.rest) }, `${ex.rest}s`)
            : null,
        ),

        // Notes
        el('textarea', { cls: 'note-input', placeholder: 'Notes (form cues, equipment settings...)',
          rows: '1', value: exerciseNotes[ei] || '',
          oninput: e => { exerciseNotes[ei] = e.target.value; }
        }),
      );
    }),

    el('div', { css: 'padding:12px 14px 90px' },
      el('button', { cls: 'btn btn-green', css: 'font-size:15px', onclick: finishWorkout }, 'FINISH WORKOUT \u2714'),
    ),
  );
}

function renderHistory() {
  // Calendar heatmap data
  const workoutDates = {};
  for (const h of history) {
    const d = new Date(h.date).toISOString().split('T')[0];
    workoutDates[d] = (workoutDates[d] || 0) + 1;
  }
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const heatCells = [];
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 16 * 7 - startDate.getDay());
  for (let i = 0; i < 16 * 7; i++) {
    const d = new Date(startDate); d.setDate(d.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    const count = workoutDates[ds] || 0;
    const lvl = count >= 2 ? 'l3' : count === 1 ? 'l2' : '';
    const isTd = ds === todayStr;
    const isFut = d > today;
    heatCells.push(el('div', { cls: `heatmap-cell ${lvl} ${isTd?'today':''}`, css: isFut?'opacity:.3':'', title: ds }));
  }

  return el('div', { cls: 'screen' }, renderModal(),
    el('div', { cls: 'header' }, el('h1', null, 'HISTORY'), el('div', { cls: 'sub' }, `${history.length} workouts`)),

    el('div', { cls: 'card' },
      el('div', { cls: 'label', css: 'margin-bottom:8px' }, 'Activity (16 weeks)'),
      el('div', { css: 'display:flex' },
        el('div', { cls: 'heatmap-labels' },
          ...['S','M','T','W','T','F','S'].map(d => el('span', null, d))
        ),
        el('div', { cls: 'heatmap-grid' }, ...heatCells),
      ),
    ),

    history.length === 0
      ? el('div', { cls: 'card', css: 'text-align:center;margin-top:20px' }, el('p', { css: 'color:var(--dim)' }, 'No workouts yet.'))
      : el('div', { cls: 'hist-grid' }, ...history.map((entry, i) => {
          const exp = expandedEntries[i];
          return el('div', { cls: 'card', css: 'cursor:pointer', onclick: () => { expandedEntries[i]=!expandedEntries[i]; render(); } },
            el('div', { css: 'display:flex;justify-content:space-between;align-items:center' },
              el('div', null,
                el('div', { css: 'font-size:15px;font-weight:700;color:var(--white)' }, entry.dayLabel),
                el('div', { css: 'font-size:11px;color:var(--dim);margin-top:2px' }, `${fmtDate(entry.date)} \u2022 ${entry.weekLabel} \u2022 ${entry.duration||'?'}min`),
              ),
              el('div', { css: 'display:flex;gap:6px;align-items:center' },
                el('span', { cls: `badge ${entry.phase==='rampup'?'badge-accent':'badge-green'}` }, entry.rirTarget),
                el('span', { css: 'color:var(--dim);font-size:16px' }, exp?'\u25B2':'\u25BC'),
              ),
            ),
            exp ? el('div', { cls: 'hist-exercises' },
              ...(entry.exercises||[]).map(ex =>
                el('div', { cls: 'hist-ex' },
                  el('div', null,
                    el('span', { cls: 'hist-ex-name', css: 'cursor:pointer;text-decoration:underline dotted var(--muted)',
                      onclick: e2 => { e2.stopPropagation(); showExerciseHistory(ex.name); } }, ex.name),
                    shouldIncrease(ex, entry.rirTarget) ? el('span', { cls: 'increase-tag' }, '\u2191 INCREASE') : null,
                  ),
                  el('div', { cls: 'hist-ex-sets' }, ex.sets?.map(s => {
                    const tt = s.type === 'drop' ? '\u2193' : s.type === 'failure' ? 'F' : '';
                    return `${s.weight ? fmtW(s.weight) : '-'}x${s.reps||'-'} @${s.rir||'?'}${tt}`;
                  }).join('  \u2022  ')),
                  ex.note ? el('div', { css: 'font-size:11px;color:var(--dim);font-style:italic;margin-top:2px' }, ex.note) : null,
                )
              ),
              el('div', { css: 'display:flex;gap:8px;margin-top:8px;border-top:1px solid var(--muted);padding-top:8px' },
                el('button', { cls: 'btn-sm blue', onclick: e2 => { e2.stopPropagation(); editWorkout(entry.id); } }, 'Edit'),
                el('button', { cls: 'btn-sm', onclick: e2 => { e2.stopPropagation(); shareWorkout(entry); } }, 'Share'),
              ),
            ) : null,
          );
        })),
    renderNav(),
  );
}

function renderProgress() {
  const vol = getWeeklyVolume();
  const maxSets = Math.max(...Object.values(vol).map(v => v.sets), 1);
  const recentDurations = history.slice(0, 12).reverse();
  const maxDur = Math.max(...recentDurations.map(h => h.duration || 0), 1);

  return el('div', { cls: 'screen screen-grid' }, renderModal(),
    el('div', { cls: 'header' }, el('h1', null, 'PROGRESS'), el('div', { cls: 'sub' }, 'Lifts, volume & trends')),

    // Compound lift charts
    ...curProgram().compounds.map(name => {
      const data = history.filter(w => w.exercises?.some(e => e.name===name)).reverse().slice(-12).map(w => {
        const ex = w.exercises.find(e => e.name===name);
        const best = ex?.sets?.reduce((b,s) => (parseFloat(s.weight)||0) > (parseFloat(b.weight)||0) ? s : b, {weight:'0'});
        return { date: fmtDate(w.date), weight: parseFloat(best?.weight)||0 };
      });
      const pr = getPR(name);
      const manualPr = getManualPR(name);
      const bestE1rm = (() => {
        let best = manualPr?.e1rm || 0;
        for (const w of history) { const ex = w.exercises?.find(e => e.name===name); if (ex) for (const s of (ex.sets||[])) { const rm = calc1RM(s.weight, s.reps); if (rm > best) best = rm; } }
        return best;
      })();
      const mx = data.length ? Math.max(...data.map(d => d.weight), 1) : 1;
      const prInputId = `pr-input-${name.replace(/\s/g, '-')}`;
      const e1rmInputId = `e1rm-input-${name.replace(/\s/g, '-')}`;
      return el('div', { cls: 'card' },
        el('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px' },
          el('span', { css: 'font-size:14px;font-weight:700;color:var(--white)' }, name),
          el('div', { css: 'display:flex;gap:8px;align-items:center' },
            el('span', { css: 'font-size:12px;color:var(--gold);font-weight:700;font-family:var(--mono)' }, `PR: ${pr ? fmtW(pr) : '--'}`),
            el('button', { cls: 'btn-sm', css: 'font-size:10px;padding:3px 8px', onclick: e2 => {
              e2.stopPropagation(); expandedPRInput[name] = !expandedPRInput[name]; render();
            }}, expandedPRInput[name] ? '\u2715' : '\u270E'),
          ),
        ),
        bestE1rm > 0 ? el('div', { css: 'font-size:10px;color:var(--dim);font-family:var(--mono);margin-bottom:6px' },
          `Est 1RM: ${fmtW(bestE1rm)}${manualPr?.date ? ` \u2022 Manual: ${manualPr.date}` : ''}`
        ) : null,
        expandedPRInput[name] ? el('div', { css: 'display:flex;gap:6px;align-items:center;margin-bottom:8px;padding:8px;background:var(--input-bg);border-radius:8px' },
          el('div', { css: 'flex:1' },
            el('div', { css: 'font-size:9px;color:var(--dim);margin-bottom:2px' }, `Weight (${unitLabel()})`),
            el('input', { type: 'number', inputmode: 'decimal', cls: 'measure-input', css: 'font-size:13px;padding:6px',
              id: prInputId, placeholder: pr ? String(pr) : '--', value: manualPr?.weight || '' }),
          ),
          el('div', { css: 'flex:1' },
            el('div', { css: 'font-size:9px;color:var(--dim);margin-bottom:2px' }, 'Est 1RM'),
            el('input', { type: 'number', inputmode: 'decimal', cls: 'measure-input', css: 'font-size:13px;padding:6px',
              id: e1rmInputId, placeholder: bestE1rm ? String(Math.round(bestE1rm)) : '--', value: manualPr?.e1rm || '' }),
          ),
          el('button', { cls: 'btn-sm green', css: 'align-self:flex-end;padding:6px 12px', onclick: () => {
            const w = document.getElementById(prInputId)?.value;
            const rm = document.getElementById(e1rmInputId)?.value;
            if (w || rm) setManualPR(name, w, rm);
          }}, 'Save'),
        ) : null,
        data.length ? el('div', { cls: 'bar-chart' }, ...data.map(d => {
          const isPR = d.weight === pr && d.weight > 0;
          return el('div', { cls: 'bar-col' },
            el('div', { cls: `bar-val ${isPR?'pr':''}` }, d.weight||''),
            el('div', { cls: `bar ${isPR?'pr':''}`, css: `height:${(d.weight/mx)*65}px` }),
            el('div', { cls: 'bar-date' }, d.date.split(', ')[0]?.split(' ').slice(1).join(' ')));
        })) : el('div', { css: 'font-size:12px;color:var(--dim);text-align:center;padding:10px 0' }, 'No data yet \u2014 log a workout or enter a PR above'),
      );
    }).filter(Boolean),


    // Weekly volume
    Object.keys(vol).length ? el('div', { cls: 'card full-width' },
      el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Weekly Volume (sets)'),
      ...Object.entries(vol).sort((a,b) => b[1].sets - a[1].sets).map(([group, data]) =>
        el('div', { cls: 'vol-item' },
          el('span', { cls: 'vol-name' }, group),
          el('div', { cls: 'vol-bar-bg' },
            el('div', { cls: 'vol-bar-fill', css: `width:${(data.sets/maxSets)*100}%` })),
          el('span', { cls: 'vol-sets' }, String(data.sets)),
        )
      ),
    ) : null,

    // Duration trend
    recentDurations.length > 1 ? el('div', { cls: 'card' },
      el('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px' },
        el('span', { cls: 'label' }, 'Workout Duration'),
        el('span', { css: 'font-size:12px;color:var(--green);font-weight:700;font-family:var(--mono)' },
          `avg ${Math.round(recentDurations.reduce((s,h) => s + (h.duration||0), 0) / recentDurations.length)}min`),
      ),
      el('div', { cls: 'dur-chart' },
        ...recentDurations.map(h => el('div', { cls: 'dur-bar',
          css: `height:${((h.duration||0)/maxDur)*45}px`,
          title: `${fmtDate(h.date)}: ${h.duration||0}min` })),
      ),
    ) : null,

    // Muscle balance radar
    Object.keys(vol).length > 2 ? el('div', { cls: 'card' },
      el('div', { cls: 'label', css: 'margin-bottom:8px' }, 'Muscle Balance (weekly sets)'),
      renderRadarChart(vol),
    ) : null,

    // Strength standards
    (() => {
      const bw = bodyWeights.length ? bodyWeights[bodyWeights.length - 1].weight : 0;
      if (!bw) return null;
      const compounds = curProgram().compounds.filter(c => STRENGTH_STANDARDS[c]);
      if (!compounds.length) return null;
      const rows = compounds.map(name => {
        const pr = getPR(name);
        const std = STRENGTH_STANDARDS[name];
        if (!std) return null;
        const ratio = pr / bw;
        let level = 'Beginner', color = 'var(--dim)', pct = 0;
        if (ratio >= std.elite) { level = 'Elite'; color = 'var(--gold)'; pct = 100; }
        else if (ratio >= std.advanced) { level = 'Advanced'; color = 'var(--green)'; pct = 75 + 25 * (ratio - std.advanced) / (std.elite - std.advanced); }
        else if (ratio >= std.intermediate) { level = 'Intermediate'; color = '#60a5fa'; pct = 50 + 25 * (ratio - std.intermediate) / (std.advanced - std.intermediate); }
        else if (ratio >= std.beginner) { level = 'Beginner'; color = 'var(--dim)'; pct = 25 + 25 * (ratio - std.beginner) / (std.intermediate - std.beginner); }
        else { pct = 25 * ratio / (std.beginner || 1); }
        return { name, pr, ratio: ratio.toFixed(2), level, color, pct: Math.min(100, Math.max(2, pct)) };
      }).filter(Boolean);
      if (!rows.length) return null;
      return el('div', { cls: 'card full-width' },
        el('div', { cls: 'label', css: 'margin-bottom:10px' }, `Strength Standards (${fmtW(bw)} BW)`),
        ...rows.map(r => el('div', { css: 'margin-bottom:8px' },
          el('div', { css: 'display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px' },
            el('span', { css: 'color:var(--white);font-weight:600' }, r.name),
            el('span', { css: `color:${r.color};font-weight:700;font-family:var(--mono)` }, `${r.level} (${r.ratio}x)`),
          ),
          el('div', { cls: 'std-bar-bg' },
            el('div', { cls: 'std-bar-fill', css: `width:${r.pct}%;background:${r.color}` }),
            el('div', { cls: 'std-markers' },
              ...[25, 50, 75].map(p => el('div', { css: `left:${p}%` })),
            ),
          ),
        )),
      );
    })(),

    // Fatigue score
    (() => {
      const score = calcFatigueScore();
      const color = score <= 40 ? 'var(--green)' : score <= 70 ? 'var(--gold)' : 'var(--accent)';
      const label = score <= 40 ? 'Fresh' : score <= 70 ? 'Moderate' : 'High Fatigue';
      return el('div', { cls: 'card' },
        el('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px' },
          el('span', { cls: 'label' }, 'Weekly Fatigue'),
          el('span', { css: `font-size:12px;font-weight:700;color:${color}` }, label),
        ),
        el('div', { cls: 'fatigue-gauge' },
          el('div', { cls: 'fatigue-fill', css: `width:${score}%;background:${color}` }),
        ),
        el('div', { css: `text-align:center;font-size:24px;font-weight:900;font-family:var(--mono);margin-top:6px;color:${color}` }, String(score)),
      );
    })(),

    renderNav(),
  );
}

// ========== RECOVERY EVALUATION ==========
function getRecoveryStatus() {
  const last3 = bodyWeights.slice(-3);
  const todayH = getTodayHealth();
  const poorSleepDays = last3.filter(b => b.sleep && b.sleep < 6).length;
  const lowReadiness = todayH.readiness > 0 && todayH.readiness <= 2;
  const goodReadiness = todayH.readiness >= 4;
  const goodSleep = todayH.sleep >= 7;
  if (lowReadiness || poorSleepDays >= 2) return 'warn';
  if (goodReadiness && goodSleep) return 'good';
  return null;
}

// ========== HEALTH TAB ==========
function todayHealthKey() { return new Date().toISOString().split('T')[0]; }

function getTodayHealth() {
  const today = todayHealthKey();
  const bw = bodyWeights.find(b => b.date === today);
  return {
    weight: bw?.weight || '',
    sleep: bw?.sleep || '',
    readiness: bw?.readiness || 0,
    water: bw?.water || 0,
  };
}

async function saveHealthField(field, value) {
  const today = todayHealthKey();
  let idx = bodyWeights.findIndex(b => b.date === today);
  if (idx < 0) { bodyWeights.push({ date: today }); idx = bodyWeights.length - 1; }
  bodyWeights[idx][field] = value;
  bodyWeights.sort((a, b) => a.date.localeCompare(b.date));
  if (bodyWeights.length > 365) bodyWeights = bodyWeights.slice(-365);
  await Storage.set('bodyWeights', bodyWeights);
  render();
}

async function saveMeasurements(data) {
  const today = todayHealthKey();
  const idx = measurements.findIndex(m => m.date === today);
  if (idx >= 0) measurements[idx] = { ...measurements[idx], ...data, date: today };
  else measurements.push({ ...data, date: today });
  measurements.sort((a, b) => a.date.localeCompare(b.date));
  if (measurements.length > 365) measurements = measurements.slice(-365);
  await Storage.set('measurements', measurements);
}

async function saveGoals(goals) {
  state.goals = goals;
  await Storage.set('state', state);
  render();
}

const MEASURE_FIELDS = [
  { key: 'chest', label: 'Chest' }, { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' }, { key: 'bicepL', label: 'Bicep L' },
  { key: 'bicepR', label: 'Bicep R' }, { key: 'thighL', label: 'Thigh L' },
  { key: 'thighR', label: 'Thigh R' }, { key: 'neck', label: 'Neck' },
];

function renderHealth() {
  const h = getTodayHealth();
  const recentBW = bodyWeights.filter(b => b.weight).slice(-20);
  const bwMax = recentBW.length ? Math.max(...recentBW.map(b => b.weight)) : 1;
  const bwMin = recentBW.length ? Math.min(...recentBW.map(b => b.weight)) : 0;
  const bwRange = bwMax - bwMin || 1;
  const prevBW = recentBW.length >= 2 ? recentBW[recentBW.length - 2].weight : null;
  const curBW = recentBW.length ? recentBW[recentBW.length - 1].weight : null;
  const bwDelta = prevBW && curBW ? curBW - prevBW : null;

  const recentSleep = bodyWeights.filter(b => b.sleep).slice(-14);
  const sleepMax = recentSleep.length ? Math.max(...recentSleep.map(b => b.sleep)) : 1;
  const avgSleep = recentSleep.length ? (recentSleep.reduce((s, b) => s + b.sleep, 0) / recentSleep.length).toFixed(1) : '-';

  const goals = state.goals || { targetWeight: 0, lifts: {} };
  const latestMeasure = measurements.length ? measurements[measurements.length - 1] : {};
  const prevMeasure = measurements.length >= 2 ? measurements[measurements.length - 2] : {};

  const waterTarget = 8;

  const recovery = getRecoveryStatus();

  return el('div', { cls: 'screen screen-grid' }, renderModal(),
    el('div', { cls: 'header' }, el('h1', null, 'HEALTH'), el('div', { cls: 'sub' }, 'Body, sleep & wellness')),

    // Recovery banner
    recovery === 'warn' ? el('div', { cls: 'recovery-banner recovery-warn' },
      el('span', null, '\u26A0\uFE0F Low recovery \u2014 consider lighter volume or a rest day'),
    ) : recovery === 'good' ? el('div', { cls: 'recovery-banner recovery-good' },
      el('span', null, '\u2705 Good recovery \u2014 ready to push today'),
    ) : null,

    // Quick stats row
    el('div', { cls: 'card full-width' },
      el('div', { cls: 'health-stat-row' },
        el('div', { cls: 'health-stat' },
          el('div', { cls: 'health-stat-val' }, curBW ? fmtW(curBW) : '--'),
          el('div', { cls: 'health-stat-label' }, `Weight (${unitLabel()})`),
          bwDelta !== null ? el('div', { cls: `health-stat-delta ${bwDelta > 0 ? 'up' : bwDelta < 0 ? 'down' : 'flat'}` },
            `${bwDelta > 0 ? '+' : ''}${bwDelta.toFixed(1)}`) : null,
        ),
        el('div', { cls: 'health-stat' },
          el('div', { cls: 'health-stat-val' }, avgSleep !== '-' ? avgSleep : '--'),
          el('div', { cls: 'health-stat-label' }, 'Avg Sleep (h)'),
        ),
        el('div', { cls: 'health-stat' },
          el('div', { cls: 'health-stat-val' }, h.readiness ? ['', '\u{1F534}', '\u{1F7E0}', '\u{1F7E1}', '\u{1F7E2}', '\u{1F7E2}'][h.readiness] || '--' : '--'),
          el('div', { cls: 'health-stat-label' }, 'Readiness'),
        ),
      ),
    ),

    // Body weight input + chart
    el('div', { cls: 'card' },
      el('div', { cls: 'label', css: 'margin-bottom:8px' }, 'Body Weight'),
      el('div', { cls: 'bw-row' },
        el('input', { type: 'number', inputmode: 'decimal', cls: 'bw-input', placeholder: unitLabel(),
          value: h.weight || '',
          onchange: e => { const w = parseFloat(e.target.value); if (w > 0) saveHealthField('weight', w); }
        }),
        el('span', { css: 'font-size:12px;color:var(--dim)' }, `${unitLabel()} today`),
      ),
      recentBW.length > 1 ? el('div', { cls: 'bw-chart', css: 'margin-top:10px' },
        ...recentBW.map(b => el('div', { cls: 'bw-bar',
          css: `height:${Math.max(((b.weight - bwMin) / bwRange) * 50 + 6, 6)}px`,
          title: `${b.date}: ${fmtW(b.weight)}` })),
      ) : null,
    ),

    // Water intake
    el('div', { cls: 'card' },
      el('div', { cls: 'label', css: 'margin-bottom:6px' }, 'Water Intake'),
      el('div', { cls: 'water-counter' },
        el('button', { cls: 'water-btn', onclick: () => { if (h.water > 0) saveHealthField('water', h.water - 1); } }, '\u2212'),
        el('div', null,
          el('div', { cls: 'water-val' }, String(h.water)),
          el('div', { cls: 'water-target' }, `of ${waterTarget} glasses`),
        ),
        el('button', { cls: 'water-btn', onclick: () => saveHealthField('water', h.water + 1) }, '+'),
      ),
      el('div', { cls: 'water-bar-row' },
        ...Array.from({ length: waterTarget }, (_, i) =>
          el('div', { cls: `water-dot ${i < h.water ? 'filled' : ''}` })
        ),
      ),
    ),

    // Sleep tracking
    el('div', { cls: 'card' },
      el('div', { cls: 'label', css: 'margin-bottom:8px' }, 'Sleep (hours)'),
      el('div', { cls: 'quick-pills' },
        ...[4, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10].map(hrs =>
          el('button', {
            cls: `quick-pill ${h.sleep === hrs ? 'active' : ''}`,
            onclick: () => saveHealthField('sleep', hrs),
          }, String(hrs))
        ),
      ),
      recentSleep.length > 1 ? el('div', { cls: 'sleep-chart', css: 'margin-top:10px' },
        ...recentSleep.map(b => el('div', null,
          el('div', { cls: 'sleep-bar', css: `height:${(b.sleep / sleepMax) * 40}px`, title: `${b.date}: ${b.sleep}h` }),
        )),
      ) : null,
    ),

    // Readiness / Recovery
    el('div', { cls: 'card' },
      el('div', { cls: 'label', css: 'margin-bottom:8px' }, 'How do you feel today?'),
      el('div', { cls: 'readiness-row' },
        ...[ [1, '\u{1F634}'], [2, '\u{1F615}'], [3, '\u{1F610}'], [4, '\u{1F60A}'], [5, '\u{1F4AA}'] ].map(([val, emoji]) =>
          el('button', {
            cls: `readiness-btn ${h.readiness === val ? 'active' : ''}`,
            onclick: () => saveHealthField('readiness', val),
          }, emoji)
        ),
      ),
      el('div', { css: 'text-align:center;margin-top:4px;font-size:11px;color:var(--dim)' },
        h.readiness ? ['', 'Exhausted', 'Tired', 'Okay', 'Good', 'Great'][h.readiness] : 'Tap to rate'),
    ),

    // Body measurements
    el('div', { cls: 'card full-width' },
      el('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px' },
        el('span', { cls: 'label' }, 'Body Measurements'),
        el('span', { css: 'font-size:10px;color:var(--dim)' }, latestMeasure.date ? `Last: ${fmtDate(latestMeasure.date)}` : ''),
      ),
      el('div', { cls: 'measure-grid' },
        ...MEASURE_FIELDS.map(f => {
          const prev = prevMeasure[f.key];
          return el('div', { cls: 'measure-item' },
            el('div', { cls: 'measure-label' }, f.label),
            el('input', {
              type: 'number', inputmode: 'decimal', cls: 'measure-input',
              placeholder: latestMeasure[f.key] ? String(latestMeasure[f.key]) : '--',
              onchange: e => {
                const v = parseFloat(e.target.value);
                if (v > 0) { latestMeasure[f.key] = v; saveMeasurements(latestMeasure); }
              },
            }),
            prev ? el('div', { cls: 'measure-last' }, `prev: ${prev} ${unitLabel()}`) : null,
          );
        }),
      ),
      measurements.length >= 3 ? el('div', { css: 'margin-top:10px' },
        el('button', { cls: 'btn-sm blue', css: 'margin-bottom:8px', onclick: () => { showMeasureTrends = !showMeasureTrends; render(); } },
          showMeasureTrends ? 'Hide Trends' : 'Show Trends'),
        showMeasureTrends ? el('div', { cls: 'measure-grid', css: 'gap:12px' },
          ...MEASURE_FIELDS.filter(f => measurements.filter(m => m[f.key]).length >= 3).map(f => {
            const pts = measurements.filter(m => m[f.key]).slice(-10);
            const vals = pts.map(m => m[f.key]);
            const mx = Math.max(...vals), mn = Math.min(...vals), rng = mx - mn || 1;
            const delta = vals.length >= 2 ? vals[vals.length - 1] - vals[vals.length - 2] : 0;
            return el('div', null,
              el('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:3px' },
                el('span', { cls: 'measure-label' }, f.label),
                el('span', { css: `font-size:10px;font-weight:700;font-family:var(--mono);color:${delta > 0 ? 'var(--red)' : delta < 0 ? 'var(--green)' : 'var(--dim)'}` },
                  delta !== 0 ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}` : '--'),
              ),
              el('div', { cls: 'measure-spark' },
                ...vals.map(v => el('div', { cls: 'measure-spark-bar', css: `height:${Math.max(((v - mn) / rng) * 28 + 4, 4)}px` })),
              ),
            );
          }),
        ) : null,
      ) : null,
    ),

    // Goals
    el('div', { cls: 'card full-width' },
      el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Goals'),

      // Weight goal
      el('div', { cls: 'goal-row' },
        el('div', { cls: 'goal-header' },
          el('span', { cls: 'goal-name' }, 'Target Weight'),
          el('span', { css: 'font-size:11px;color:var(--dim)' },
            goals.targetWeight ? `${fmtW(goals.targetWeight)} ${unitLabel()}` : 'Not set'),
        ),
        !goals.targetWeight ? el('div', { css: 'display:flex;gap:6px;align-items:center' },
          el('input', { type: 'number', inputmode: 'decimal', cls: 'measure-input', css: 'width:100px',
            placeholder: unitLabel(),
            id: 'goal-weight-input',
          }),
          el('button', { cls: 'btn-sm green', onclick: () => {
            const v = parseFloat(document.getElementById('goal-weight-input')?.value);
            if (v > 0) saveGoals({ ...goals, targetWeight: v });
          }}, 'Set'),
        ) : (() => {
          const start = recentBW.length ? recentBW[0].weight : curBW || 0;
          const diff = Math.abs(goals.targetWeight - start);
          const progress = diff > 0 && curBW ? Math.min(Math.abs(curBW - start) / diff * 100, 100) : 0;
          const remaining = curBW ? Math.abs(goals.targetWeight - curBW).toFixed(1) : '?';
          return el('div', null,
            el('div', { cls: 'goal-bar' },
              el('div', { cls: 'goal-fill', css: `width:${progress}%;background:var(--green)` }),
            ),
            el('div', { css: 'display:flex;justify-content:space-between;margin-top:2px' },
              el('span', { cls: 'goal-pct' }, `${progress.toFixed(0)}%`),
              el('span', { css: 'font-size:10px;color:var(--dim)' }, `${remaining} ${unitLabel()} to go`),
            ),
            el('button', { cls: 'btn-sm red', css: 'margin-top:6px', onclick: () => saveGoals({ ...goals, targetWeight: 0 }) }, 'Clear Goal'),
          );
        })(),
      ),

      // Lift goals
      el('div', { css: 'margin-top:12px' },
        el('div', { css: 'font-size:12px;font-weight:600;color:var(--white);margin-bottom:6px' }, 'Lift Goals'),
        ...curProgram().compounds.map(name => {
          const target = goals.lifts?.[name] || 0;
          const pr = getPR(name);
          const prVal = pr ? parseFloat(pr.weight) : 0;
          const progress = target > 0 && prVal > 0 ? Math.min((prVal / target) * 100, 100) : 0;
          return el('div', { cls: 'goal-row' },
            el('div', { cls: 'goal-header' },
              el('span', { cls: 'goal-name' }, name),
              el('span', { cls: 'goal-nums' }, target ? `${fmtW(prVal)} / ${fmtW(target)}` : `PR: ${prVal ? fmtW(prVal) : '--'}`),
            ),
            target > 0 ? el('div', null,
              el('div', { cls: 'goal-bar' },
                el('div', { cls: 'goal-fill', css: `width:${progress}%;background:${progress >= 100 ? 'var(--gold)' : 'var(--accent)'}` }),
              ),
              el('div', { cls: 'goal-pct' }, `${progress.toFixed(0)}%`),
            ) : el('div', { css: 'display:flex;gap:6px;align-items:center' },
              el('input', { type: 'number', inputmode: 'decimal', cls: 'measure-input', css: 'width:80px',
                placeholder: unitLabel(), id: `goal-lift-${name.replace(/\s/g, '-')}`,
              }),
              el('button', { cls: 'btn-sm green', onclick: () => {
                const v = parseFloat(document.getElementById(`goal-lift-${name.replace(/\s/g, '-')}`)?.value);
                if (v > 0) { const newLifts = { ...goals.lifts, [name]: v }; saveGoals({ ...goals, lifts: newLifts }); }
              }}, 'Set'),
            ),
          );
        }),
      ),
    ),

    renderNav(),
  );
}

function renderSettings() {
  const notifStatus = !('Notification' in window) ? 'unsupported' : Notification.permission;

  return el('div', { cls: 'screen screen-grid' }, renderModal(),
    el('div', { cls: 'header' }, el('h1', null, 'SETTINGS'), el('div', { cls: 'sub' }, 'Program & preferences')),

    // Theme
    el('div', { cls: 'card' },
      el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Theme'),
      el('div', { cls: 'theme-toggle' },
        ...['dark','light','auto'].map(t =>
          el('button', { cls: theme === t ? 'active' : '', onclick: () => { setTheme(t); render(); } },
            t[0].toUpperCase() + t.slice(1))
        ),
      ),
    ),

    // Units
    el('div', { cls: 'card' },
      el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Weight Units'),
      el('div', { cls: 'theme-toggle' },
        ...['lbs','kg'].map(u =>
          el('button', { cls: (state.units||'lbs') === u ? 'active' : '', onclick: async () => { state.units=u; await Storage.set('state',state); render(); } },
            u.toUpperCase())
        ),
      ),
    ),

    // Notifications
    el('div', { cls: 'card' },
      el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Rest Timer Notifications'),
      notifStatus === 'granted'
        ? el('div', { css: 'font-size:13px;color:var(--green);font-weight:600' }, '\u2713 Enabled')
        : notifStatus === 'denied'
          ? el('div', { css: 'font-size:13px;color:var(--accent)' }, 'Blocked \u2014 enable in browser settings')
          : notifStatus === 'unsupported'
            ? el('div', { css: 'font-size:13px;color:var(--dim)' }, 'Not supported in this browser')
            : el('button', { cls: 'btn-ghost', onclick: async () => { await requestNotifPermission(); render(); } }, 'Enable Notifications'),
    ),

    // Program (filtered by admin-assigned allowedPrograms)
    el('div', { cls: 'card full-width' },
      el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Workout Program'),
      el('div', { css: 'display:flex;gap:8px;flex-wrap:wrap' },
        ...ALL_PROGRAMS.filter(([k]) => (state.allowedPrograms || ['standard','glute-focus']).includes(k)).map(([k,l]) =>
          el('button', { cls: `btn-ghost ${state.program===k?'':'muted'}`,
            css: state.program===k?'border-color:var(--accent);color:var(--accent)':null,
            onclick: async () => { state.program=k; state.phase='rampup'; state.rampWeek='Week 1'; state.rampDayIdx=0; state.mesoWeek=1; state.pplIdx=0; await Storage.set('state',state); render(); } }, l)),
      ),
      el('div', { css: 'font-size:11px;color:var(--dim);margin-top:8px' },
        state.program==='glute-focus' ? 'Lower-body & glute emphasis with extra hip thrust and RDL volume' : 'Balanced push/pull/legs with strength focus'),
    ),

    // Phase
    el('div', { cls: 'card full-width' },
      el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Program Phase'),
      el('div', { css: 'display:flex;gap:8px' },
        ...[['rampup','Ramp-Up'],['ppl','Full PPL']].map(([p,l]) =>
          el('button', { cls: `btn-ghost ${state.phase===p?'':'muted'}`,
            css: state.phase===p?`border-color:${p==='rampup'?'var(--accent)':'var(--green)'};color:${p==='rampup'?'var(--accent)':'var(--green)'}`:null,
            onclick: async () => { state.phase=p; state.rampDayIdx=0; await Storage.set('state',state); render(); } }, l)),
      ),
    ),
    state.phase==='rampup' ? el('div', { cls: 'card' },
      el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Ramp-Up Week'),
      el('div', { css: 'display:flex;gap:8px' },
        ...['Week 1','Week 2'].map(w => el('button', { cls: `btn-ghost ${state.rampWeek===w?'':'muted'}`,
          onclick: async () => { state.rampWeek=w; state.rampDayIdx=0; await Storage.set('state',state); render(); } }, w))),
    ) : null,
    state.phase==='rampup' ? el('div', { cls: 'card' },
      el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Next Day'),
      el('div', { css: 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px' },
        ...Object.keys(curProgram().rampup[state.rampWeek]||{}).map((d,i) => el('button', { cls: `btn-ghost ${state.rampDayIdx===i?'':'muted'}`,
          css: `font-size:10px;padding:8px 4px${state.rampDayIdx===i?';border-color:var(--accent);color:var(--accent)':''}`,
          onclick: async () => { state.rampDayIdx=i; await Storage.set('state',state); render(); } }, d.replace(/^\w+: /,'')))),
    ) : null,
    state.phase==='ppl' ? el('div', { cls: 'card' },
      el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Mesocycle Week'),
      el('div', { css: 'display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px' },
        ...[1,2,3,4].map(w => el('button', { cls: `btn-ghost ${state.mesoWeek===w?'':'muted'}`,
          css: `font-size:12px;padding:8px 4px${state.mesoWeek===w?';border-color:var(--accent);color:var(--accent)':''}`,
          onclick: async () => { state.mesoWeek=w; await Storage.set('state',state); render(); } }, w===4?'Deload':`W${w}`))),
    ) : null,
    state.phase==='ppl' ? el('div', { cls: 'card' },
      el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Next Day'),
      el('div', { css: 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px' },
        ...curProgram().ppl.map((p,i) => el('button', { cls: `btn-ghost ${state.pplIdx===i?'':'muted'}`,
          css: `font-size:11px;padding:8px 4px${state.pplIdx===i?';border-color:var(--accent);color:var(--accent)':''}`,
          onclick: async () => { state.pplIdx=i; await Storage.set('state',state); render(); } }, p.label))),
    ) : null,

    // Custom exercises
    el('div', { cls: 'card full-width' },
      el('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px' },
        el('div', { cls: 'label' }, 'Custom Exercises'),
        el('button', { cls: 'btn-sm green', onclick: showAddCustomExercise }, '+ Add'),
      ),
      (state.customExercises||[]).length ? el('div', null,
        ...(state.customExercises||[]).map((ce, ci) => el('div', { css: 'display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--card-border)' },
          el('div', null,
            el('div', { css: 'font-size:13px;color:var(--white);font-weight:600' }, ce.name),
            el('div', { css: 'font-size:10px;color:var(--dim)' }, `${ce.group} \u2022 ${ce.sets}x${ce.reps}`),
          ),
          el('button', { cls: 'btn-sm red', onclick: async () => {
            state.customExercises.splice(ci, 1); await Storage.set('state', state); render();
          }}, '\u2715'),
        )),
      ) : el('div', { css: 'font-size:12px;color:var(--dim)' }, 'No custom exercises'),
    ),

    el('div', { cls: 'card' },
      el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Data'),
      el('div', { css: 'display:flex;gap:8px' },
        el('button', { cls: 'btn-ghost', css: 'flex:1', onclick: exportCSV }, 'Export CSV'),
        el('button', { cls: 'btn-ghost', css: 'flex:1', onclick: importCSV }, 'Import CSV'),
      ),
    ),
    el('div', { cls: 'card' },
      el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Account'),
      el('button', { cls: 'btn-ghost muted', onclick: doLogout }, 'Log Out'),
      el('div', { css: 'font-size:10px;color:var(--dim);margin-top:8px' },
        `PIN: ${Storage.getPin()?.slice(0,2)}/${Storage.getPin()?.slice(2,4)}/${Storage.getPin()?.slice(4) || ''}`),
    ),
    renderNav(),
  );
}

// ========== ADMIN PORTAL ==========
const ALL_PROGRAMS = [['standard', 'Standard PPL'], ['glute-focus', 'Glute-Focus PPL']];

async function loadAdminData() {
  adminLoading = true;
  if (screen === 'admin') render();
  try {
    const reg = await Storage.adminGetRegistry();
    adminDiag = reg._diag || null;
    delete reg._diag;
    for (const hash of Object.keys(reg)) {
      const st = await Storage.adminGetUserData(hash, 'state');
      const hist = await Storage.adminGetUserData(hash, 'history');
      const bw = await Storage.adminGetUserData(hash, 'bodyWeights');
      reg[hash].state = st || {};
      reg[hash].historyCount = Array.isArray(hist) ? hist.length : 0;
      reg[hash].lastWorkout = Array.isArray(hist) && hist.length ? hist[0].date : null;
      reg[hash].bodyWeights = Array.isArray(bw) ? bw : [];
      if (!reg[hash].program && st?.program) reg[hash].program = st.program;
      if (!reg[hash].phase && st?.phase) reg[hash].phase = st.phase;
    }
    adminUsers = reg;
  } catch(e) { console.warn('Admin load failed:', e); adminUsers = adminUsers || {}; }
  adminLoading = false;
  if (screen === 'admin') render();
}

function renderAdmin() {
  if (!isAdmin()) { screen = 'home'; render(); return el('div'); }

  const users = adminUsers ? Object.entries(adminUsers) : [];
  const totalWorkouts = users.reduce((s, [, u]) => s + (u.historyCount || 0), 0);
  const activeToday = users.filter(([, u]) => u.lastActive === new Date().toISOString().split('T')[0]).length;

  return el('div', { cls: 'screen screen-grid' }, renderModal(),
    el('div', { cls: 'header' },
      el('h1', null, 'ADMIN PORTAL'),
      el('div', { cls: 'sub' }, 'User management & programs'),
    ),

    el('div', { cls: 'stats' },
      ...[
        [users.length, 'Users', 'accent'],
        [totalWorkouts, 'Workouts', 'green'],
        [activeToday, 'Active Today', ''],
      ].map(([v, l, c]) => el('div', { cls: 'stat-card' },
        el('div', { cls: `stat-val ${c}` }, String(v)),
        el('div', { cls: 'label' }, l))),
    ),

    el('div', { css: 'padding:10px 14px;display:flex;gap:8px' },
      el('button', { cls: 'btn-ghost', css: 'flex:1', onclick: async () => { await loadAdminData(); } }, 'Refresh'),
      el('button', { cls: 'btn-ghost muted', css: 'flex:1', onclick: () => {
        const data = JSON.stringify(adminUsers, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ht-admin-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
      }}, 'Export All'),
    ),

    // Add user by PIN
    el('div', { cls: 'card full-width' },
      el('div', { css: 'display:flex;gap:8px;align-items:center' },
        el('input', { type: 'tel', id: 'admin-add-pin', cls: 'set-input', css: 'flex:1;text-align:left;font-size:14px;padding:10px 12px',
          placeholder: 'Add user by PIN (MMDDYYYY)', maxlength: '8', inputmode: 'numeric' }),
        el('button', { cls: 'btn-sm green', css: 'padding:10px 16px', onclick: async () => {
          const pin = document.getElementById('admin-add-pin')?.value;
          if (!pin || pin.length !== 8) return;
          const h = Storage.adminAddUserByPin(pin);
          if (h) await loadAdminData();
        }}, 'Add'),
      ),
    ),

    // Diagnostics
    adminDiag ? el('div', { css: 'padding:0 14px;font-size:10px;color:var(--dim);display:flex;gap:10px;flex-wrap:wrap' },
      el('span', null, `Local: ${adminDiag.local}`),
      el('span', null, `Registry: ${adminDiag.registry}`),
      el('span', null, `Firebase: ${adminDiag.usersScan}`),
      ...(adminDiag.errors || []).map(e => el('span', { css: 'color:var(--red)' }, e)),
    ) : null,

    adminLoading ? el('div', { cls: 'card full-width', css: 'text-align:center' },
      el('div', { css: 'color:var(--accent);font-weight:700' }, 'Loading user data...'),
    ) : null,

    ...users.map(([hash, user]) => renderAdminUserCard(hash, user)),

    !users.length && !adminLoading ? el('div', { cls: 'card full-width', css: 'text-align:center' },
      el('p', { css: 'color:var(--dim)' }, 'No registered users. Add a user by PIN above, or they\'ll appear after they log in.'),
    ) : null,

    renderNav(),
  );
}

function renderAdminUserCard(hash, user) {
  const exp = adminExpanded[hash];
  const pin = user.pin || '????????';
  const fmtPin = `${pin.slice(0,2)}/${pin.slice(2,4)}/${pin.slice(4)}`;
  const isSelf = user.pin === Storage.getPin();
  const progLabel = ALL_PROGRAMS.find(([k]) => k === user.state?.program)?.[1] || 'Unknown';
  const phaseLabel = user.state?.phase === 'ppl'
    ? `PPL W${user.state.mesoWeek || 1}`
    : `Ramp-Up ${user.state?.rampWeek || 'W1'}`;

  return el('div', { cls: 'card full-width admin-card' },
    el('div', { css: 'display:flex;justify-content:space-between;align-items:center;cursor:pointer',
      onclick: () => { adminExpanded[hash] = !exp; render(); } },
      el('div', null,
        el('div', { css: 'display:flex;align-items:center;gap:8px' },
          el('span', { css: 'font-size:16px;font-weight:800;color:var(--white);font-family:var(--mono)' }, fmtPin),
          isSelf ? el('span', { cls: 'admin-you-badge' }, 'YOU') : null,
          el('span', { css: `width:8px;height:8px;border-radius:50%;background:${user.lastActive === new Date().toISOString().split('T')[0] ? 'var(--green)' : 'var(--muted)'}` }),
        ),
        el('div', { css: 'font-size:11px;color:var(--dim);margin-top:3px' },
          `${progLabel} \u2022 ${phaseLabel} \u2022 ${user.historyCount || 0} workouts`),
      ),
      el('span', { css: 'color:var(--dim);font-size:16px' }, exp ? '\u25B2' : '\u25BC'),
    ),
    exp ? renderAdminUserExpanded(hash, user) : null,
  );
}

function renderAdminUserExpanded(hash, user) {
  const st = user.state || {};
  const allowed = st.allowedPrograms || ['standard', 'glute-focus'];
  const isSelf = user.pin === Storage.getPin();

  const bws = user.bodyWeights || [];
  const latestBW = bws.filter(b => b.weight).slice(-1)[0];
  const last7 = bws.slice(-7);
  const avgSleepAdmin = last7.filter(b => b.sleep).length ? (last7.filter(b => b.sleep).reduce((s, b) => s + b.sleep, 0) / last7.filter(b => b.sleep).length).toFixed(1) : null;
  const lastReadiness = last7.filter(b => b.readiness).slice(-1)[0]?.readiness;
  const waterDays = last7.filter(b => (b.water || 0) >= 6).length;

  return el('div', { cls: 'admin-expanded' },
    el('div', { css: 'font-size:11px;color:var(--dim);margin-bottom:12px' },
      `Last active: ${user.lastActive || 'Unknown'}`,
      user.lastWorkout ? ` \u2022 Last workout: ${fmtDate(user.lastWorkout)}` : ''),

    // Health snapshot
    (latestBW || avgSleepAdmin || lastReadiness) ? el('div', { cls: 'admin-section' },
      el('div', { cls: 'label', css: 'margin-bottom:6px' }, 'Health Snapshot'),
      el('div', { css: 'display:flex;gap:10px;flex-wrap:wrap;font-size:11px' },
        latestBW ? el('div', { css: 'background:var(--input-bg);border-radius:6px;padding:6px 10px' },
          el('span', { css: 'color:var(--dim)' }, 'Weight: '),
          el('span', { css: 'color:var(--white);font-weight:700;font-family:var(--mono)' }, String(latestBW.weight)),
        ) : null,
        avgSleepAdmin ? el('div', { css: 'background:var(--input-bg);border-radius:6px;padding:6px 10px' },
          el('span', { css: 'color:var(--dim)' }, 'Sleep: '),
          el('span', { css: 'color:var(--purple);font-weight:700;font-family:var(--mono)' }, `${avgSleepAdmin}h avg`),
        ) : null,
        lastReadiness ? el('div', { css: 'background:var(--input-bg);border-radius:6px;padding:6px 10px' },
          el('span', { css: 'color:var(--dim)' }, 'Readiness: '),
          el('span', null, ['', '\u{1F534}', '\u{1F7E0}', '\u{1F7E1}', '\u{1F7E2}', '\u{1F7E2}'][lastReadiness] || '?'),
        ) : null,
        el('div', { css: 'background:var(--input-bg);border-radius:6px;padding:6px 10px' },
          el('span', { css: 'color:var(--dim)' }, 'Water: '),
          el('span', { css: 'color:var(--blue);font-weight:700;font-family:var(--mono)' }, `${waterDays}/7 days`),
        ),
      ),
    ) : null,

    // Active program
    el('div', { cls: 'admin-section' },
      el('div', { cls: 'label', css: 'margin-bottom:6px' }, 'Active Program'),
      el('div', { css: 'display:flex;gap:6px;flex-wrap:wrap' },
        ...ALL_PROGRAMS.map(([k, l]) =>
          el('button', {
            cls: `btn-ghost ${st.program === k ? '' : 'muted'}`,
            css: `font-size:12px;padding:8px 12px${st.program === k ? ';border-color:var(--accent);color:var(--accent)' : ''}`,
            onclick: async () => {
              const s = { ...st, program: k, phase: 'rampup', rampWeek: 'Week 1', rampDayIdx: 0, mesoWeek: 1, pplIdx: 0 };
              await Storage.adminSetUserData(hash, 'state', s);
              if (isSelf) { state = s; await Storage.set('state', state); }
              await loadAdminData();
            }
          }, l)),
      ),
    ),

    // Allowed programs
    el('div', { cls: 'admin-section' },
      el('div', { cls: 'label', css: 'margin-bottom:6px' }, 'Allowed Programs'),
      el('div', { css: 'display:flex;gap:6px;flex-wrap:wrap' },
        ...ALL_PROGRAMS.map(([k, l]) => {
          const on = allowed.includes(k);
          return el('button', {
            cls: `btn-sm ${on ? 'green' : ''}`,
            css: 'font-size:11px',
            onclick: async () => {
              let next = [...allowed];
              if (on && next.length > 1) next = next.filter(p => p !== k);
              else if (!on) next.push(k);
              const s = { ...st, allowedPrograms: next };
              if (!next.includes(s.program)) { s.program = next[0]; s.phase = 'rampup'; s.rampWeek = 'Week 1'; s.rampDayIdx = 0; }
              await Storage.adminSetUserData(hash, 'state', s);
              if (isSelf) { state = s; await Storage.set('state', state); }
              await loadAdminData();
            }
          }, `${on ? '\u2713' : '+'} ${l}`);
        }),
      ),
    ),

    // Phase override
    el('div', { cls: 'admin-section' },
      el('div', { cls: 'label', css: 'margin-bottom:6px' }, 'Phase & Week'),
      el('div', { css: 'display:flex;gap:6px;flex-wrap:wrap' },
        ...['rampup', 'ppl'].map(p =>
          el('button', {
            cls: `btn-ghost ${st.phase === p ? '' : 'muted'}`,
            css: `font-size:12px;padding:8px 12px${st.phase === p ? ';border-color:var(--green);color:var(--green)' : ''}`,
            onclick: async () => {
              const s = { ...st, phase: p, rampDayIdx: 0 };
              if (p === 'ppl') { s.mesoWeek = 1; s.pplIdx = 0; }
              if (p === 'rampup') { s.rampWeek = 'Week 1'; s.rampDayIdx = 0; }
              await Storage.adminSetUserData(hash, 'state', s);
              if (isSelf) { state = s; await Storage.set('state', state); }
              await loadAdminData();
            }
          }, p === 'rampup' ? 'Ramp-Up' : 'Full PPL')),
        st.phase === 'ppl' ? el('div', { css: 'display:flex;gap:4px;width:100%;margin-top:4px' },
          ...[1,2,3,4].map(w => el('button', {
            cls: `btn-sm ${st.mesoWeek === w ? 'green' : ''}`,
            css: 'font-size:11px;flex:1',
            onclick: async () => {
              const s = { ...st, mesoWeek: w };
              await Storage.adminSetUserData(hash, 'state', s);
              if (isSelf) { state = s; await Storage.set('state', state); }
              await loadAdminData();
            }
          }, w === 4 ? 'Deload' : `W${w}`)),
        ) : null,
      ),
    ),

    // Units
    el('div', { cls: 'admin-section' },
      el('div', { cls: 'label', css: 'margin-bottom:6px' }, 'Units'),
      el('div', { css: 'display:flex;gap:6px' },
        ...['lbs','kg'].map(u => el('button', {
          cls: `btn-sm ${(st.units || 'lbs') === u ? 'green' : ''}`,
          css: 'font-size:11px',
          onclick: async () => {
            const s = { ...st, units: u };
            await Storage.adminSetUserData(hash, 'state', s);
            if (isSelf) { state = s; await Storage.set('state', state); }
            await loadAdminData();
          }
        }, u.toUpperCase()))),
    ),

    // Danger zone
    el('div', { cls: 'admin-section', css: 'border-top:1px solid rgba(239,68,68,.3);padding-top:10px;margin-top:4px' },
      el('div', { cls: 'label', css: 'margin-bottom:6px;color:#ef4444' }, 'Danger Zone'),
      el('div', { css: 'display:flex;gap:8px' },
        el('button', { cls: 'btn-sm red', onclick: () => {
          modal = {
            title: `Reset ${user.pin?.slice(0,2)}/${user.pin?.slice(2,4)}/${user.pin?.slice(4)}?`,
            message: 'Permanently deletes ALL workout data, history, and body weights for this user.',
            onConfirm: async () => {
              await Storage.adminResetUser(hash);
              if (isSelf) {
                state = { ...DEFAULT_STATE }; history = []; bodyWeights = [];
                await Storage.set('state', state);
                await Storage.set('history', history);
                await Storage.set('bodyWeights', bodyWeights);
              }
              modal = null; await loadAdminData();
            }
          }; render();
        }}, 'Reset All Data'),
        el('button', { cls: 'btn-sm', onclick: () => {
          modal = {
            title: 'Reset Progress Only?',
            message: 'Resets phase, week, and day back to start. Keeps workout history.',
            onConfirm: async () => {
              const s = { ...st, phase: 'rampup', rampWeek: 'Week 1', rampDayIdx: 0, mesoWeek: 1, pplIdx: 0, fatigueFlags: 0 };
              await Storage.adminSetUserData(hash, 'state', s);
              if (isSelf) { state = s; await Storage.set('state', state); }
              modal = null; await loadAdminData();
            }
          }; render();
        }}, 'Reset Progress'),
      ),
    ),
  );
}

// ========== MAIN RENDER ==========
function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const screens = {
    login: renderLogin, home: renderHome, workout: renderWorkout,
    history: renderHistory, progress: renderProgress, health: renderHealth,
    settings: renderSettings, admin: renderAdmin,
  };
  const fn = screens[screen];
  if (fn) app.appendChild(fn());

  // Global overlays
  if (!isOnline && screen !== 'workout') {
    app.prepend(el('div', { cls: 'offline-banner' }, 'Offline \u2014 using local data'));
  }
  if (undoEntry && screen === 'home') {
    app.appendChild(el('div', { cls: 'undo-toast' },
      el('span', null, 'Workout saved!'),
      el('button', { cls: 'btn-sm green', css: 'font-size:12px;padding:6px 14px', onclick: undoLastWorkout }, 'UNDO'),
    ));
  }
  if (prToasts.length > 0) {
    app.appendChild(el('div', { cls: 'pr-toast-container' },
      ...prToasts.map(t => el('div', { cls: 'pr-toast-item' }, `\uD83C\uDFC6 New PR! ${t.name}: ${fmtW(t.weight)}`))
    ));
  }
}

// Boot
init();
