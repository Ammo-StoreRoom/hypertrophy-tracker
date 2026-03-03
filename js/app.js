// ============================================
// HYPERTROPHY TRACKER — Main Application
// ============================================
let state, history, screen, activeDay, inputs, workoutStart;
let restTimer = 0, restInterval = null, modal = null, expandedEntries = {};

const DEFAULT_STATE = { phase: "rampup", rampWeek: "Week 1", rampDayIdx: 0, mesoWeek: 1, pplIdx: 0 };

async function init() {
  // Try auto-login
  if (!Storage.autoLogin()) {
    screen = 'login';
    render();
    return;
  }
  await loadData();
}

async function loadData() {
  state = await Storage.get('state', { ...DEFAULT_STATE });
  if (state.rampDayIdx === undefined) state.rampDayIdx = 0;
  history = await Storage.get('history', []);
  screen = 'home';
  activeDay = null;
  inputs = {};
  workoutStart = null;
  render();

  // Real-time sync listeners
  Storage.listen('state', val => {
    if (screen !== 'workout') { state = val; if (state.rampDayIdx === undefined) state.rampDayIdx = 0; render(); }
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
  Storage.unlisten();
  Storage.logout();
  screen = 'login';
  render();
}

// ========== HELPERS ==========
const fmtDate = d => new Date(d).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
const fmtTime = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
const parseTopRep = r => { const m = r.match(/(\d+)/); return m ? +m[1] : 0; };

function getRIR() {
  if (state.phase === 'rampup') return state.rampWeek === 'Week 1' ? '4 RIR' : '2-3 RIR';
  return MESO_RIR[state.mesoWeek] || '3 RIR';
}
function getExercises(day) {
  if (state.phase === 'rampup') return RAMPUP[state.rampWeek]?.[day] || [];
  return PPL.find(p => p.label === day)?.exercises || [];
}
function getDays() {
  if (state.phase === 'rampup') return Object.keys(RAMPUP[state.rampWeek] || {});
  return PPL.map(p => p.label);
}
function getNextDay() {
  if (state.phase === 'rampup') {
    const days = Object.keys(RAMPUP[state.rampWeek] || {});
    return days[state.rampDayIdx] || days[0];
  }
  return PPL[state.pplIdx]?.label;
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

function startRest(secs) {
  if (restInterval) clearInterval(restInterval);
  restTimer = secs; render();
  restInterval = setInterval(() => { restTimer--; if (restTimer <= 0) { clearInterval(restInterval); restInterval = null; } render(); }, 1000);
}
function stopRest() { if (restInterval) clearInterval(restInterval); restTimer = 0; restInterval = null; render(); }

function startWorkout(day) { activeDay = day; inputs = {}; workoutStart = Date.now(); screen = 'workout'; render(); }

function copyLast(ei, name) {
  const last = getLastForEx(name);
  if (!last) return;
  last.sets.forEach((s, si) => { inputs[`${ei}-${si}`] = { weight: s.weight||'', reps: s.reps||'', rir: s.rir||'' }; });
  render();
}

async function finishWorkout() {
  const exercises = getExercises(activeDay);
  const dur = workoutStart ? Math.round((Date.now() - workoutStart) / 60000) : 0;
  const entry = {
    id: `${Date.now()}`, date: new Date().toISOString(), phase: state.phase,
    dayLabel: activeDay, weekLabel: state.phase === 'rampup' ? state.rampWeek : `Meso W${state.mesoWeek}`,
    rirTarget: getRIR(), duration: dur,
    exercises: exercises.map((ex, ei) => ({
      name: ex.name, targetReps: ex.reps,
      sets: Array.from({ length: ex.sets }, (_, si) => { const d = inputs[`${ei}-${si}`]||{}; return { weight: d.weight||'', reps: d.reps||'', rir: d.rir||'' }; }),
    })),
  };
  history.unshift(entry);
  if (history.length > 200) history = history.slice(0, 200);

  if (state.phase === 'rampup') {
    const days = Object.keys(RAMPUP[state.rampWeek]||{});
    const di = days.indexOf(activeDay);
    if (di >= days.length - 1) {
      if (state.rampWeek === 'Week 1') { state.rampWeek = 'Week 2'; state.rampDayIdx = 0; }
      else { state.phase = 'ppl'; state.mesoWeek = 1; state.pplIdx = 0; }
    } else { state.rampDayIdx = di + 1; }
  } else {
    const ni = (state.pplIdx + 1) % 6;
    state.pplIdx = ni;
    if (ni === 0) state.mesoWeek = state.mesoWeek >= 4 ? 1 : state.mesoWeek + 1;
  }

  await Storage.set('state', state);
  await Storage.set('history', history);
  activeDay = null; inputs = {}; stopRest(); screen = 'home'; render();
}

async function resetAll() {
  state = { ...DEFAULT_STATE };
  history = [];
  await Storage.set('state', state);
  await Storage.set('history', history);
  modal = null; screen = 'home'; render();
}

function exportCSV() {
  let csv = 'Date,Day,Week,Phase,RIR Target,Duration,Exercise,Set,Weight,Reps,RIR\n';
  for (const w of history) for (const ex of (w.exercises||[])) for (let i = 0; i < (ex.sets||[]).length; i++) {
    const s = ex.sets[i];
    csv += `"${w.date}","${w.dayLabel}","${w.weekLabel}","${w.phase}","${w.rirTarget}","${w.duration||''}","${ex.name}","${i+1}","${s.weight}","${s.reps}","${s.rir}"\n`;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `hypertrophy-log-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

// ========== RENDER ==========
function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) e[k] = v;
    else if (k === 'cls') e.className = v;
    else if (k === 'css') e.style.cssText = v;
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
      el('h3', null, modal.title), el('p', null, modal.message),
      el('div', { cls: 'modal-btns' },
        el('button', { cls: 'btn-ghost muted', onclick: () => { modal = null; render(); } }, 'Never mind'),
        el('button', { cls: 'btn btn-red', onclick: modal.onConfirm }, 'Yes, do it'),
      ),
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
      el('div', { css: 'text-align:center;margin-top:16px;font-size:11px;color:var(--dim)' },
        'Your birthday is your sync key across devices'),
    ),
  );
}

function renderHome() {
  const next = getNextDay();
  const exCount = getExercises(next)?.length || 0;
  const streak = (() => { let s = 0; const now = new Date(); for (const h2 of history) { const d = new Date(h2.date); if (Math.floor((now-d)/86400000) <= s+2) s++; else break; } return s; })();
  const daysSince = history[0]?.date ? Math.floor((Date.now() - new Date(history[0].date).getTime()) / 86400000) : '-';

  return el('div', { cls: 'screen' }, renderModal(),
    el('div', { cls: 'header' },
      el('div', { cls: 'header-row' },
        el('div', null,
          el('h1', null, 'HYPERTROPHY TRACKER'),
          el('div', { cls: 'sub' }, state.phase === 'rampup' ? `Ramp-Up \u2022 ${state.rampWeek}` : `PPL \u2022 Mesocycle W${state.mesoWeek}`),
        ),
        el('div', { cls: 'sync-dot', title: 'Synced' }),
      ),
    ),
    el('div', { cls: 'stats' },
      ...[
        [history.length, 'Workouts', 'accent'], [streak, 'Streak', 'green'], [daysSince, 'Days Ago', ''],
      ].map(([v, l, c]) => el('div', { cls: 'stat-card' }, el('div', { cls: `stat-val ${c}` }, String(v)), el('div', { cls: 'label' }, l))),
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
  const exercises = getExercises(activeDay);
  const elapsed = workoutStart ? Math.floor((Date.now() - workoutStart) / 60000) : 0;

  return el('div', { cls: 'screen' }, renderModal(),
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
      const allDone = Array.from({ length: ex.sets }, (_, si) => inputs[`${ei}-${si}`]).every(s => s?.weight && s?.reps);
      return el('div', { cls: `card ${allDone?'green-border':''}` },
        el('div', { css: 'display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px' },
          el('div', { css: 'flex:1' },
            el('div', { css: 'font-size:14px;font-weight:700;color:var(--white)' }, ex.name),
            el('div', { css: 'font-size:11px;color:var(--dim);margin-top:1px' }, `${ex.sets}x${ex.reps} \u2022 Rest ${ex.rest}s`),
          ),
          el('div', { css: 'display:flex;gap:4px' },
            last ? el('button', { cls: 'btn-sm blue', onclick: () => copyLast(ei, ex.name) }, 'Copy Last') : null,
            el('button', { cls: 'btn-sm', onclick: () => startRest(ex.rest) }, 'Rest'),
          ),
        ),
        last ? el('div', { cls: 'last-perf' },
          'Last: ' + last.sets.map(s => `${s.weight||'?'}x${s.reps||'?'}`).join('  '),
          pr > 0 ? el('span', { cls: 'pr-tag' }, `PR: ${pr}lbs`) : null,
        ) : null,
        el('div', { cls: 'set-grid' },
          el('div', { cls: 'label', css: 'font-size:9px' }, '#'),
          el('div', { cls: 'label', css: 'font-size:9px;text-align:center' }, 'LBS'),
          el('div', { cls: 'label', css: 'font-size:9px;text-align:center' }, 'REPS'),
          el('div', { cls: 'label', css: 'font-size:9px;text-align:center' }, 'RIR'),
          ...Array.from({ length: ex.sets }, (_, si) => {
            const k=`${ei}-${si}`, v=inputs[k]||{}, done=v.weight&&v.reps;
            return [
              el('div', { cls: `set-num ${done?'done':''}` }, done?'\u2713':String(si+1)),
              el('input', { type:'number', inputmode:'decimal', cls:`set-input ${done?'done':''}`, placeholder:'-', value:v.weight||'',
                oninput: e => { if(!inputs[k]) inputs[k]={}; inputs[k].weight=e.target.value; } }),
              el('input', { type:'number', inputmode:'numeric', cls:`set-input ${done?'done':''}`, placeholder:'-', value:v.reps||'',
                oninput: e => { if(!inputs[k]) inputs[k]={}; inputs[k].reps=e.target.value; } }),
              el('input', { type:'number', inputmode:'numeric', cls:`set-input ${done?'done':''}`, placeholder:'-', value:v.rir||'',
                oninput: e => { if(!inputs[k]) inputs[k]={}; inputs[k].rir=e.target.value; } }),
            ];
          }).flat(),
        ),
      );
    }),
    el('div', { css: 'padding:12px 14px 90px' },
      el('button', { cls: 'btn btn-green', css: 'font-size:15px', onclick: finishWorkout }, 'FINISH WORKOUT \u2714'),
    ),
  );
}

function renderHistory() {
  return el('div', { cls: 'screen' }, renderModal(),
    el('div', { cls: 'header' }, el('h1', null, 'HISTORY'), el('div', { cls: 'sub' }, `${history.length} workouts`)),
    history.length === 0
      ? el('div', { cls: 'card', css: 'text-align:center;margin-top:40px' }, el('p', { css: 'color:var(--dim)' }, 'No workouts yet.'))
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
                el('div', null, el('span', { cls: 'hist-ex-name' }, ex.name),
                  shouldIncrease(ex, entry.rirTarget) ? el('span', { cls: 'increase-tag' }, '\u2191 INCREASE') : null),
                el('div', { cls: 'hist-ex-sets' }, ex.sets?.map(s => `${s.weight||'-'}x${s.reps||'-'} @${s.rir||'?'}`).join('  \u2022  ')),
              )
            )) : null,
          );
        })),
    renderNav(),
  );
}

function renderProgress() {
  return el('div', { cls: 'screen' }, renderModal(),
    el('div', { cls: 'header' }, el('h1', null, 'PROGRESS'), el('div', { cls: 'sub' }, 'Compound lifts')),
    ...COMPOUNDS.map(name => {
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
    !history.some(w => w.exercises?.some(e => COMPOUNDS.includes(e.name)))
      ? el('div', { cls: 'card', css: 'text-align:center;margin-top:30px' }, el('p', { css: 'color:var(--dim)' }, 'Log workouts to track progress.'))
      : null,
    renderNav(),
  );
}

function renderSettings() {
  return el('div', { cls: 'screen' }, renderModal(),
    el('div', { cls: 'header' }, el('h1', null, 'SETTINGS'), el('div', { cls: 'sub' }, 'Program & account')),
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
        ...PPL.map((p,i) => el('button', { cls: `btn-ghost ${state.pplIdx===i?'':'muted'}`,
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

function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const screens = { login: renderLogin, home: renderHome, workout: renderWorkout, history: renderHistory, progress: renderProgress, settings: renderSettings };
  const fn = screens[screen];
  if (fn) app.appendChild(fn());
}

// Boot
init();
