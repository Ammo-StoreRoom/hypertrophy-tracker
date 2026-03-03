// ============================================
// HYPERTROPHY TRACKER — Main Application
// ============================================

// ========== STATE ==========
let state, history, screen, activeDay, inputs, workoutStart;
let restTimer = 0, restEndTime = null, restInterval = null;
let modal = null, expandedEntries = {};
let bodyWeights = [];
let workoutExercises = [];
let exerciseNotes = {};
let expandedPlateCalc = {};
let expandedWarmup = {};
let deferredPrompt = null, installDismissed = false;
let isOnline = navigator.onLine;
let undoEntry = null, undoPrevState = null, undoTimeout = null;
let theme = 'dark';
let pullY = 0, pullActive = false, pullDist = 0;

const DEFAULT_STATE = { phase: "rampup", rampWeek: "Week 1", rampDayIdx: 0, mesoWeek: 1, pplIdx: 0, program: "standard" };

// ========== INIT & AUTH ==========
async function init() {
  initTheme();
  setupPWA();
  setupOffline();
  setupPullToRefresh();
  if (!Storage.autoLogin()) { screen = 'login'; render(); return; }
  try { await loadData(); } catch (e) { console.error('Init failed:', e); screen = 'login'; render(); }
}

async function loadData() {
  state = await Storage.get('state', { ...DEFAULT_STATE });
  if (state.rampDayIdx === undefined) state.rampDayIdx = 0;
  if (!state.program) state.program = 'standard';
  history = await Storage.get('history', []);
  bodyWeights = await Storage.get('bodyWeights', []);
  screen = 'home'; activeDay = null; inputs = {}; workoutStart = null;
  render();
  Storage.listen('state', val => {
    if (screen !== 'workout') { state = val; if (state.rampDayIdx === undefined) state.rampDayIdx = 0; if (!state.program) state.program = 'standard'; render(); }
  });
  Storage.listen('history', val => {
    if (screen !== 'workout') { history = val || []; render(); }
  });
}

async function doLogin(pin) {
  if (!Storage.login(pin)) {
    document.getElementById('login-error').textContent = 'Enter 8 digits (MMDDYYYY)';
    return;
  }
  await loadData();
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
  return best;
}
function shouldIncrease(ex, rir) {
  if (!ex?.sets?.length) return false;
  const t = parseInt(rir) || 3, top = parseTopRep(ex.targetReps || '8');
  return ex.sets.every(s => (+s.reps||0) >= top && !isNaN(parseInt(s.rir)) && parseInt(s.rir) <= t);
}

// ========== FEATURES ==========
function calcPlates(targetWeight, barWeight) {
  barWeight = barWeight || 45;
  const available = [45, 25, 10, 5, 2.5];
  let perSide = (targetWeight - barWeight) / 2;
  if (perSide <= 0) return [];
  const plates = [];
  for (const p of available) { while (perSide >= p) { plates.push(p); perSide -= p; } }
  return plates;
}

function getWarmupSets(workingWeight) {
  if (!workingWeight || workingWeight <= 45) return [];
  const sets = [{ weight: 45, reps: 10, label: 'Bar only' }];
  if (workingWeight > 95) sets.push({ weight: Math.round(workingWeight * 0.5 / 5) * 5, reps: 5, label: '~50%' });
  if (workingWeight > 135) sets.push({ weight: Math.round(workingWeight * 0.75 / 5) * 5, reps: 3, label: '~75%' });
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
    return maxW > 0 ? maxW + 5 : null;
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
  restTimer = 0; restInterval = null; restEndTime = null; render();
}

// ========== WORKOUT FLOW ==========
function startWorkout(day) {
  activeDay = day;
  workoutExercises = getExercises(day).map(ex => ({...ex}));
  inputs = {}; exerciseNotes = {}; expandedPlateCalc = {}; expandedWarmup = {};
  workoutStart = Date.now(); screen = 'workout'; render();
}

function copyLast(ei, name) {
  const last = getLastForEx(name);
  if (!last) return;
  last.sets.forEach((s, si) => { inputs[`${ei}-${si}`] = { weight: s.weight||'', reps: s.reps||'', rir: s.rir||'' }; });
  haptic(50); render();
}

function swapExercise(ei, newName) {
  const alts = getAlternativeExercises(workoutExercises[ei].name);
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
    id: `${Date.now()}`, date: new Date().toISOString(), phase: state.phase,
    dayLabel: activeDay, weekLabel: state.phase === 'rampup' ? state.rampWeek : `Meso W${state.mesoWeek}`,
    rirTarget: getRIR(), duration: dur,
    exercises: workoutExercises.map((ex, ei) => ({
      name: ex.name, targetReps: ex.reps, note: exerciseNotes[ei] || '',
      sets: Array.from({ length: ex.sets }, (_, si) => {
        const d = inputs[`${ei}-${si}`]||{};
        return { weight: d.weight||'', reps: d.reps||'', rir: d.rir||'' };
      }),
    })),
  };
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

  await Storage.set('state', state);
  await Storage.set('history', history);
  haptic([100, 50, 100, 50, 200]);
  activeDay = null; inputs = {}; stopRest();

  undoEntry = entry;
  if (undoTimeout) clearTimeout(undoTimeout);
  undoTimeout = setTimeout(() => { undoEntry = null; undoPrevState = null; render(); }, 30000);

  screen = 'home'; render();
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

function renderNav() {
  return el('div', { cls: 'nav' },
    ...['home','history','progress','settings'].map(k =>
      el('button', { cls: screen === k ? 'active' : '', onclick: () => { if (screen !== 'workout') { screen = k; render(); } } },
        k[0].toUpperCase() + k.slice(1))
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
  const daysSince = history[0]?.date ? Math.floor((Date.now() - new Date(history[0].date).getTime()) / 86400000) : '-';
  const todayBW = bodyWeights.find(b => b.date === new Date().toISOString().split('T')[0]);

  return el('div', { cls: 'screen' }, renderModal(),
    el('div', { id: 'pull-indicator', cls: 'pull-indicator', css: 'height:0;opacity:0;overflow:hidden' }),
    el('div', { cls: 'header' },
      el('div', { cls: 'header-row' },
        el('div', null,
          el('h1', null, 'HYPERTROPHY TRACKER'),
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

    el('div', { cls: 'stats' },
      ...[
        [history.length, 'Workouts', 'accent'], [streak, 'Streak', 'green'], [daysSince, 'Days Ago', ''],
      ].map(([v, l, c]) => el('div', { cls: 'stat-card' }, el('div', { cls: `stat-val ${c}` }, String(v)), el('div', { cls: 'label' }, l))),
    ),

    // Body weight
    el('div', { cls: 'card' },
      el('div', { cls: 'label', css: 'margin-bottom:8px' }, 'Body Weight'),
      el('div', { cls: 'bw-row' },
        el('input', { type: 'number', inputmode: 'decimal', cls: 'bw-input', placeholder: 'lbs',
          value: todayBW?.weight || '',
          onchange: e => { const w = parseFloat(e.target.value); if (w > 0) logBodyWeight(w); }
        }),
        el('span', { css: 'font-size:12px;color:var(--dim)' }, 'lbs today'),
        bodyWeights.length > 1 ? el('span', { css: 'font-size:12px;color:var(--dim);margin-left:auto' },
          `Trend: ${bodyWeights.slice(-1)[0]?.weight || '-'} lbs`
        ) : null,
      ),
    ),

    el('div', { cls: 'card', css: 'display:flex;justify-content:space-between;align-items:center' },
      el('div', null,
        el('div', { css: 'display:flex;gap:8px;align-items:center;margin-bottom:4px' },
          el('span', { cls: 'label' }, 'Phase'),
          el('span', { cls: `badge ${state.phase==='rampup'?'badge-accent':'badge-green'}` }, state.phase==='rampup'?'RAMP-UP':'FULL PPL'),
        ),
        el('div', { css: 'font-size:13px;color:var(--dim)' }, 'RIR Target: ', el('strong', { css: 'color:var(--accent)' }, getRIR())),
        state.phase==='ppl' ? el('div', { css: 'font-size:13px;color:var(--dim)' }, `W${state.mesoWeek} \u2022 ${PPL[state.pplIdx]?.day}`) : null,
      ),
    ),

    el('div', { cls: 'card accent-border' },
      el('div', { cls: 'label', css: 'margin-bottom:6px' }, 'Next Workout'),
      el('div', { css: 'font-size:20px;font-weight:800;color:var(--white);margin-bottom:2px' }, next),
      el('div', { css: 'font-size:12px;color:var(--dim);margin-bottom:14px' }, `${exCount} exercises`),
      el('button', { cls: 'btn', onclick: () => startWorkout(next) }, 'START WORKOUT'),
    ),

    el('div', { cls: 'card' },
      el('span', { cls: 'label', css: 'display:block;margin-bottom:10px' }, 'All Days'),
      el('div', { cls: 'day-list' },
        ...getDays().map(d => el('button', { cls: `btn-ghost day-btn ${d===next?'':'muted'}`, onclick: () => startWorkout(d) },
          el('span', null, d), d===next ? el('span', { cls: 'next-tag' }, 'NEXT') : null)),
      ),
    ),
    renderNav(),
  );
}

function renderWorkout() {
  const exercises = workoutExercises;
  const elapsed = workoutStart ? Math.floor((Date.now() - workoutStart) / 60000) : 0;

  return el('div', { cls: 'screen' }, renderModal(),
    !isOnline ? el('div', { cls: 'offline-banner' }, 'Offline \u2014 using local data') : null,
    el('div', { cls: 'header workout-header' },
      el('div', { cls: 'header-row' },
        el('div', null, el('h1', null, activeDay), el('div', { cls: 'sub' }, `Target: ${getRIR()} \u2022 ${elapsed}min`)),
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
              el('span', { css: 'font-size:14px;font-weight:700;color:var(--white);cursor:pointer;text-decoration:underline dotted var(--muted)',
                onclick: () => {
                  const alts = getAlternativeExercises(ex.name);
                  if (!alts.length) return;
                  modal = { title: 'Swap Exercise',
                    content: el('div', { cls: 'swap-list' },
                      ...alts.map(a => el('button', { cls: 'swap-item', onclick: () => swapExercise(ei, a) }, a))
                    ),
                  };
                  render();
                }
              }, ex.name),
              prog ? el('span', { cls: 'prog-tag' }, `\u2191 Try ${prog}lbs`) : null,
            ),
            el('div', { css: 'font-size:11px;color:var(--dim);margin-top:1px' }, `${ex.sets}x${ex.reps} \u2022 Rest ${ex.rest}s`),
            bestSet > 0 ? el('div', { cls: 'e1rm' }, `Est. 1RM: ${bestSet}lbs`) : null,
          ),
          el('div', { css: 'display:flex;gap:4px;flex-shrink:0' },
            last ? el('button', { cls: 'btn-sm blue', onclick: () => copyLast(ei, ex.name) }, 'Copy') : null,
            el('button', { cls: 'btn-sm', onclick: () => startRest(ex.rest) }, 'Rest'),
            el('button', { cls: 'btn-sm green', onclick: () => { expandedPlateCalc[ei] = !expandedPlateCalc[ei]; render(); } }, 'Plates'),
          ),
        ),

        // Plate calculator
        expandedPlateCalc[ei] ? (() => {
          const w = inputs[`${ei}-0`]?.weight || last?.sets?.[0]?.weight || '';
          const plates = w ? calcPlates(parseFloat(w)) : [];
          return el('div', { cls: 'plate-calc' },
            el('div', { css: 'font-size:11px;color:var(--dim);margin-bottom:4px' },
              w ? `${w}lbs \u2192 Per side:` : 'Enter weight to see plates'),
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
            el('span', null, w.label), el('span', null, `${w.weight}lbs \u00D7 ${w.reps}`)
          )),
        ) : null,

        // Last performance
        last ? el('div', { cls: 'last-perf' },
          'Last: ' + last.sets.map(s => `${s.weight||'?'}x${s.reps||'?'}`).join('  '),
          pr > 0 ? el('span', { cls: 'pr-tag' }, `PR: ${pr}lbs`) : null,
        ) : null,

        // Set inputs
        el('div', { cls: 'set-grid' },
          el('div', { cls: 'label', css: 'font-size:9px' }, '#'),
          el('div', { cls: 'label', css: 'font-size:9px;text-align:center' }, 'LBS'),
          el('div', { cls: 'label', css: 'font-size:9px;text-align:center' }, 'REPS'),
          el('div', { cls: 'label', css: 'font-size:9px;text-align:center' }, 'RIR'),
          ...Array.from({ length: ex.sets }, (_, si) => {
            const k = `${ei}-${si}`, v = inputs[k]||{}, done = v.weight && v.reps;
            return [
              el('div', { cls: `set-num ${done?'done':''}` }, done?'\u2713':String(si+1)),
              el('input', { type:'number', inputmode:'decimal', id:`in-${ei}-${si}-w`, cls:`set-input ${done?'done':''}`, placeholder:'-', value:v.weight||'',
                oninput: e => { if(!inputs[k]) inputs[k]={}; inputs[k].weight=e.target.value; },
                onkeydown: e => { if(e.key==='Enter'){const n=document.getElementById(`in-${ei}-${si}-r`);if(n){n.focus();n.select();}}} }),
              el('input', { type:'number', inputmode:'numeric', id:`in-${ei}-${si}-r`, cls:`set-input ${done?'done':''}`, placeholder:'-', value:v.reps||'',
                oninput: e => { if(!inputs[k]) inputs[k]={}; inputs[k].reps=e.target.value;
                  if(v.weight&&e.target.value){haptic(30);} },
                onkeydown: e => { if(e.key==='Enter'){const n=document.getElementById(`in-${ei}-${si}-i`);if(n){n.focus();n.select();}}} }),
              el('input', { type:'number', inputmode:'numeric', id:`in-${ei}-${si}-i`, cls:`set-input ${done?'done':''}`, placeholder:'-', value:v.rir||'',
                oninput: e => { if(!inputs[k]) inputs[k]={}; inputs[k].rir=e.target.value; },
                onkeydown: e => { if(e.key==='Enter'){const n=document.getElementById(`in-${ei}-${si+1}-w`)||document.getElementById(`in-${ei+1}-0-w`);if(n){n.focus();n.select();}}} }),
            ];
          }).flat(),
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
      : el('div', null, ...history.map((entry, i) => {
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
            exp ? el('div', { cls: 'hist-exercises' }, ...(entry.exercises||[]).map(ex =>
              el('div', { cls: 'hist-ex' },
                el('div', null,
                  el('span', { cls: 'hist-ex-name' }, ex.name),
                  shouldIncrease(ex, entry.rirTarget) ? el('span', { cls: 'increase-tag' }, '\u2191 INCREASE') : null,
                ),
                el('div', { cls: 'hist-ex-sets' }, ex.sets?.map(s => `${s.weight||'-'}x${s.reps||'-'} @${s.rir||'?'}`).join('  \u2022  ')),
                ex.note ? el('div', { css: 'font-size:11px;color:var(--dim);font-style:italic;margin-top:2px' }, ex.note) : null,
              )
            )) : null,
          );
        })),
    renderNav(),
  );
}

function renderProgress() {
  const vol = getWeeklyVolume();
  const maxSets = Math.max(...Object.values(vol).map(v => v.sets), 1);
  const recentBW = bodyWeights.slice(-20);
  const bwMax = recentBW.length ? Math.max(...recentBW.map(b => b.weight)) : 1;
  const bwMin = recentBW.length ? Math.min(...recentBW.map(b => b.weight)) : 0;
  const bwRange = bwMax - bwMin || 1;
  const recentDurations = history.slice(0, 12).reverse();
  const maxDur = Math.max(...recentDurations.map(h => h.duration || 0), 1);

  return el('div', { cls: 'screen' }, renderModal(),
    el('div', { cls: 'header' }, el('h1', null, 'PROGRESS'), el('div', { cls: 'sub' }, 'Lifts, volume & trends')),

    // Compound lift charts
    ...curProgram().compounds.map(name => {
      const data = history.filter(w => w.exercises?.some(e => e.name===name)).reverse().slice(-12).map(w => {
        const ex = w.exercises.find(e => e.name===name);
        const best = ex?.sets?.reduce((b,s) => (parseFloat(s.weight)||0) > (parseFloat(b.weight)||0) ? s : b, {weight:'0'});
        return { date: fmtDate(w.date), weight: parseFloat(best?.weight)||0 };
      });
      if (!data.length) return null;
      const mx = Math.max(...data.map(d => d.weight),1), pr = Math.max(...data.map(d => d.weight));
      return el('div', { cls: 'card' },
        el('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px' },
          el('span', { css: 'font-size:14px;font-weight:700;color:var(--white)' }, name),
          el('span', { css: 'font-size:12px;color:var(--gold);font-weight:700;font-family:var(--mono)' }, `PR: ${pr}lbs`)),
        el('div', { cls: 'bar-chart' }, ...data.map(d => {
          const isPR = d.weight===pr && d.weight>0;
          return el('div', { cls: 'bar-col' },
            el('div', { cls: `bar-val ${isPR?'pr':''}` }, d.weight||''),
            el('div', { cls: `bar ${isPR?'pr':''}`, css: `height:${(d.weight/mx)*65}px` }),
            el('div', { cls: 'bar-date' }, d.date.split(', ')[0]?.split(' ').slice(1).join(' ')));
        })),
      );
    }).filter(Boolean),

    !history.some(w => w.exercises?.some(e => curProgram().compounds.includes(e.name)))
      ? el('div', { cls: 'card', css: 'text-align:center;margin-top:20px' }, el('p', { css: 'color:var(--dim)' }, 'Log workouts to track compound lifts.'))
      : null,

    // Weekly volume
    Object.keys(vol).length ? el('div', { cls: 'card' },
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

    // Body weight trend
    recentBW.length > 1 ? el('div', { cls: 'card' },
      el('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px' },
        el('span', { cls: 'label' }, 'Body Weight'),
        el('span', { css: 'font-size:12px;color:var(--accent);font-weight:700;font-family:var(--mono)' },
          `${recentBW[recentBW.length-1].weight}lbs`),
      ),
      el('div', { cls: 'bw-chart' },
        ...recentBW.map(b => el('div', { cls: 'bw-bar',
          css: `height:${Math.max(((b.weight - bwMin) / bwRange) * 50 + 6, 6)}px`,
          title: `${b.date}: ${b.weight}lbs` })),
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

    renderNav(),
  );
}

function renderSettings() {
  const notifStatus = !('Notification' in window) ? 'unsupported' : Notification.permission;

  return el('div', { cls: 'screen' }, renderModal(),
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

    // Program
    el('div', { cls: 'card' },
      el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Workout Program'),
      el('div', { css: 'display:flex;gap:8px;flex-wrap:wrap' },
        ...[['standard','Standard PPL'],['glute-focus','Glute-Focus PPL']].map(([k,l]) =>
          el('button', { cls: `btn-ghost ${state.program===k?'':'muted'}`,
            css: state.program===k?'border-color:var(--accent);color:var(--accent)':null,
            onclick: async () => { state.program=k; state.phase='rampup'; state.rampWeek='Week 1'; state.rampDayIdx=0; state.mesoWeek=1; state.pplIdx=0; await Storage.set('state',state); render(); } }, l)),
      ),
      el('div', { css: 'font-size:11px;color:var(--dim);margin-top:8px' },
        state.program==='glute-focus' ? 'Lower-body & glute emphasis with extra hip thrust and RDL volume' : 'Balanced push/pull/legs with strength focus'),
    ),

    // Phase
    el('div', { cls: 'card' },
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

    el('div', { cls: 'card' },
      el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Export Data'),
      el('button', { cls: 'btn-ghost', onclick: exportCSV }, 'Download CSV Backup'),
    ),
    el('div', { cls: 'card' },
      el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Account'),
      el('button', { cls: 'btn-ghost muted', onclick: doLogout }, 'Log Out'),
    ),
    el('div', { cls: 'card', css: 'border-color:#ef4444' },
      el('div', { cls: 'label', css: 'margin-bottom:10px;color:#ef4444' }, 'Danger Zone'),
      el('button', { cls: 'btn btn-red', onclick: () => {
        modal = { title: 'Reset Everything?', message: 'Deletes ALL data on all devices permanently.',
          onConfirm: resetAll }; render();
      }}, 'RESET EVERYTHING'),
    ),
    renderNav(),
  );
}

// ========== MAIN RENDER ==========
function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const screens = {
    login: renderLogin, home: renderHome, workout: renderWorkout,
    history: renderHistory, progress: renderProgress, settings: renderSettings
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
}

// Boot
init();
