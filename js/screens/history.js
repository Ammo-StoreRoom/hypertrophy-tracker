// ============================================
// HISTORY SCREEN — Workout history and logs
// ============================================

/**
 * Render the history screen
 * @returns {HTMLElement} History screen element
 */
function renderHistory() {
  // Calendar heatmap data
  const workoutDates = {};
  for (const h of Store.history) {
    const d = new Date(h.date).toISOString().split('T')[0];
    workoutDates[d] = (workoutDates[d] || 0) + 1;
  }
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const heatCells = [];
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 16 * 7 - startDate.getDay());
  
  for (let i = 0; i < 16 * 7; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    const count = workoutDates[ds] || 0;
    const lvl = count >= 2 ? 'l3' : count === 1 ? 'l2' : '';
    const isTd = ds === todayStr;
    const isFut = d > today;
    heatCells.push(el('div', { 
      cls: `heatmap-cell ${lvl} ${isTd ? 'today' : ''}`, 
      css: isFut ? 'opacity:.3' : '', 
      title: ds 
    }));
  }

  return el('div', { cls: 'screen' }, renderModal(),
    // Header
    el('div', { cls: 'header' }, 
      el('h1', null, 'HISTORY'), 
      el('div', { cls: 'sub' }, `${Store.history.length} workouts`)
    ),

    // Activity heatmap
    el('div', { cls: 'card' },
      el('div', { cls: 'label', css: 'margin-bottom:8px' }, 'Activity (16 weeks)'),
      el('div', { css: 'display:flex' },
        el('div', { cls: 'heatmap-labels' },
          ...['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => el('span', null, d))
        ),
        el('div', { cls: 'heatmap-grid' }, ...heatCells)
      )
    ),

    // Workout list
    Store.history.length === 0
      ? el('div', { cls: 'card', css: 'text-align:center;margin-top:20px' }, 
          el('p', { css: 'color:var(--dim)' }, 'No workouts yet.')
        )
      : el('div', { cls: 'hist-grid' }, ...Store.history.map((entry, i) => renderHistoryEntry(entry, i))),
    
    renderNav()
  );
}

/**
 * Render a single history entry
 * @param {Object} entry - Workout entry
 * @param {number} i - Entry index
 * @returns {HTMLElement} History entry element
 */
function renderHistoryEntry(entry, i) {
  const exp = Store.expandedEntries[i];
  
  return el('div', { 
    cls: 'card', 
    css: 'cursor:pointer', 
    onclick: () => { 
      Store.expandedEntries[i] = !exp; 
      Router.render(); 
    } 
  },
    // Header row
    el('div', { css: 'display:flex;justify-content:space-between;align-items:center' },
      el('div', null,
        el('div', { css: 'font-size:15px;font-weight:700;color:var(--white)' }, entry.dayLabel),
        el('div', { css: 'font-size:11px;color:var(--dim);margin-top:2px' }, 
          `${fmtDate(entry.date)} • ${entry.weekLabel} • ${entry.duration || '?'}min`
        )
      ),
      el('div', { css: 'display:flex;gap:6px;align-items:center' },
        el('span', { 
          cls: `badge ${entry.phase === 'rampup' ? 'badge-accent' : 'badge-green'}` 
        }, entry.rirTarget),
        el('span', { css: 'color:var(--dim);font-size:16px' }, exp ? '▲' : '▼')
      )
    ),
    
    // Expanded details
    exp ? el('div', { cls: 'hist-exercises' },
      ...(entry.exercises || []).map(ex =>
        el('div', { cls: 'hist-ex' },
          el('div', null,
            el('span', { 
              cls: 'hist-ex-name', 
              css: 'cursor:pointer;text-decoration:underline dotted var(--muted)',
              onclick: e2 => { 
                e2.stopPropagation(); 
                showExerciseHistory(ex.name); 
              } 
            }, ex.name),
            shouldIncrease(ex, entry.rirTarget) ? el('span', { cls: 'increase-tag' }, '↑ INCREASE') : null
          ),
          el('div', { cls: 'hist-ex-sets' }, 
            ex.sets?.map(s => {
              const tt = s.type === 'drop' ? '↓' : s.type === 'failure' ? 'F' : '';
              return `${s.weight ? fmtW(s.weight) : '-'}x${s.reps || '-'} @${s.rir || '?'}${tt}`;
            }).join('  •  ')
          ),
          ex.note ? el('div', { css: 'font-size:11px;color:var(--dim);font-style:italic;margin-top:2px' }, ex.note) : null
        )
      ),
      // Actions
      el('div', { css: 'display:flex;gap:8px;margin-top:8px;border-top:1px solid var(--muted);padding-top:8px' },
        el('button', { 
          cls: 'btn-sm blue', 
          onclick: e2 => { 
            e2.stopPropagation(); 
            editWorkout(entry.id); 
          } 
        }, 'Edit'),
        el('button', { 
          cls: 'btn-sm', 
          onclick: e2 => { 
            e2.stopPropagation(); 
            shareWorkout(entry); 
          } 
        }, 'Share')
      )
    ) : null
  );
}

/**
 * Check if weight should be increased for an exercise
 * @param {Object} ex - Exercise data
 * @param {string} rir - RIR target
 * @returns {boolean} Whether to increase weight
 */
function shouldIncrease(ex, rir) {
  if (!ex?.sets?.length) return false;
  const t = parseInt(rir) || 3;
  const top = parseTopRep(ex.targetReps || '8');
  return ex.sets.every(s => 
    (+s.reps || 0) >= top && 
    !isNaN(parseInt(s.rir)) && 
    parseInt(s.rir) <= t
  );
}

/**
 * Edit a workout entry
 * @param {string} entryId - Entry ID to edit
 */
function editWorkout(entryId) {
  const entry = Store.history.find(h => h.id === entryId);
  if (!entry) return;
  
  Store.editingEntryId = entryId;
  Store.activeDay = entry.dayLabel;
  Store.workoutExercises = (entry.exercises || []).map(ex => ({
    name: ex.name, 
    sets: ex.sets?.length || 3, 
    reps: ex.targetReps || '8-10', 
    rest: 90
  }));
  Store.inputs = {};
  Store.exerciseNotes = {};
  
  for (let ei = 0; ei < entry.exercises.length; ei++) {
    const ex = entry.exercises[ei];
    if (ex.note) Store.exerciseNotes[ei] = ex.note;
    for (let si = 0; si < (ex.sets || []).length; si++) {
      const s = ex.sets[si];
      Store.inputs[`${ei}-${si}`] = { 
        weight: s.weight || '', 
        reps: s.reps || '', 
        rir: s.rir || '', 
        type: s.type || 'working' 
      };
    }
  }
  
  Store.expandedPlateCalc = {};
  Store.expandedWarmup = {};
  Store.supersets = [];
  Store.restPauseExercises = {};
  Store.workoutStart = Date.now();
  Store.screen = 'workout';
  Router.render();
}

/**
 * Share a workout entry
 * @param {Object} entry - Workout entry to share
 */
function shareWorkout(entry) {
  let text = `${entry.dayLabel} — ${fmtDate(entry.date)}\n`;
  for (const ex of (entry.exercises || [])) {
    text += `${ex.name}: ${ex.sets.map(s => `${s.weight || '-'}x${s.reps || '-'}`).join(', ')}\n`;
  }
  text += `Duration: ${entry.duration || '?'}min | RIR: ${entry.rirTarget}`;
  
  if (navigator.share) {
    navigator.share({ title: 'Workout', text }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text).then(() => {
      Store.showModal({ title: 'Copied!', message: 'Workout summary copied to clipboard.' });
    }).catch(() => {});
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderHistory, editWorkout, shareWorkout, shouldIncrease };
}
