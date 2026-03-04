// ============================================
// WORKOUT SCREEN — Active workout logging
// ============================================

/**
 * Render the workout screen
 * @returns {HTMLElement} Workout screen element
 */
function renderWorkout() {
  // Guard: if workout not initialized, redirect to home
  if (!Store.workoutExercises || Store.workoutExercises.length === 0 || !Store.activeDay) {
    console.warn('Workout screen accessed without initialized workout state');
    Store.screen = 'home';
    Router.render();
    return el('div', null); // Return empty element while redirecting
  }
  
  const exercises = Store.workoutExercises;
  const elapsedSec = Store.workoutStart ? Math.floor((Date.now() - Store.workoutStart) / 1000) : 0;
  const elapsedMin = Math.floor(elapsedSec / 60);
  const elapsedRemSec = elapsedSec % 60;
  const elapsedStr = `${String(elapsedMin).padStart(2, '0')}:${String(elapsedRemSec).padStart(2, '0')}`;

  // Start elapsed timer
  if (!Store.elapsedInterval && Store.workoutStart) {
    Store.elapsedInterval = setInterval(() => {
      const timerEl = document.getElementById('elapsed-timer');
      if (!timerEl || Store.screen !== 'workout') { 
        clearInterval(Store.elapsedInterval); 
        Store.elapsedInterval = null; 
        return; 
      }
      const sec = Math.floor((Date.now() - Store.workoutStart) / 1000);
      timerEl.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    }, 1000);
  }

  return el('div', { cls: 'screen' }, renderModal(),
    // Offline banner
    !Store.isOnline ? el('div', { cls: 'offline-banner' }, 'Offline — using local data') : null,
    
    // Header
    el('div', { cls: 'header workout-header' },
      el('div', { cls: 'header-row' },
        el('div', null,
          el('h1', { css: 'display:flex;align-items:center;gap:10px' }, Store.activeDay,
            el('span', { id: 'elapsed-timer', cls: 'elapsed-timer' }, elapsedStr)
          ),
          el('div', { cls: 'sub' }, `${Store.editingEntryId ? 'EDITING • ' : ''}Target: ${Store.getRIR()}`)
        ),
        el('button', { 
          cls: 'btn-sm red', 
          onclick: () => {
            Store.showModal({ 
              title: 'Abandon Workout?', 
              message: 'Your logged sets will be lost.',
              onConfirm: () => { 
                Store.activeDay = null; 
                stopRest(); 
                Store.screen = 'home'; 
                Router.render(); 
              }
            });
          }
        }, 'Cancel')
      )
    ),

    // Workout progress bar
    renderWorkoutProgress(),

    // Rest timer bar
    Store.restTimer > 0 ? 
      el('div', { cls: 'rest-bar' },
        el('span', { cls: 'rest-time' }, fmtTime(Store.restTimer)),
        el('button', { 
          cls: 'btn-sm', 
          css: 'background:rgba(255,255,255,.25);color:#fff', 
          onclick: stopRest 
        }, 'SKIP')
      ) : null,

    // Exercise cards
    ...exercises.map((ex, ei) => renderExerciseCard(ei, ex)),

    // Finish button
    el('div', { css: 'padding:12px 14px 90px' },
      el('button', { 
        cls: 'btn btn-green', 
        css: 'font-size:15px', 
        onclick: finishWorkout 
      }, 'FINISH WORKOUT ✔')
    )
  );
}

/**
 * Render an individual exercise card
 * @param {number} ei - Exercise index
 * @param {Object} ex - Exercise data
 * @returns {HTMLElement} Exercise card element
 */
function renderExerciseCard(ei, ex) {
  const last = Store.getLastForEx(ex.name);
  const pr = Store.getPR(ex.name);
  const prog = getProgression(ex.name);
  
  // Calculate completion status
  const completedSets = Array.from({ length: ex.sets }, (_, si) => Store.inputs[`${ei}-${si}`])
    .filter(s => s?.weight && s?.reps).length;
  const allDone = completedSets === ex.sets;
  
  // Calculate best estimated 1RM
  const bestSet = Object.entries(Store.inputs)
    .filter(([k]) => k.startsWith(`${ei}-`))
    .reduce((best, [, v]) => {
      const rm = calc1RM(v.weight, v.reps);
      return rm > best ? rm : best;
    }, 0);
  
  // Get warmup sets
  const plateWeight = last?.sets?.[0]?.weight ? parseFloat(last.sets[0].weight) : 0;
  const warmups = Store.expandedWarmup[ei] ? getWarmupSets(prog || plateWeight || 0) : [];

  // Create the card element
  const card = el('div', { 
    cls: `card exercise-card ${allDone ? 'green-border' : ''}`,
    'data-exercise-index': ei
  });

  // Add swipe to delete functionality
  setTimeout(() => {
    const cardEl = document.querySelector(`[data-exercise-index="${ei}"]`);
    if (cardEl) {
      addSwipeToDelete(cardEl, () => {
        Store.showModal({
          title: 'Delete Exercise?',
          message: `Remove ${ex.name} from this workout?`,
          onConfirm: () => {
            Store.workoutExercises.splice(ei, 1);
            // Clean up inputs for deleted exercise
            for (let si = 0; si < ex.sets; si++) {
              delete Store.inputs[`${ei}-${si}`];
            }
            // Reindex remaining inputs
            const newInputs = {};
            Object.entries(Store.inputs).forEach(([k, v]) => {
              const [inputEi, inputSi] = k.split('-').map(Number);
              if (inputEi > ei) {
                newInputs[`${inputEi - 1}-${inputSi}`] = v;
              } else if (inputEi < ei) {
                newInputs[k] = v;
              }
            });
            Store.inputs = newInputs;
            Router.render();
          }
        });
      });
    }
  }, 0);

  // Add long press to copy previous workout
  setTimeout(() => {
    const headerEl = card.querySelector('.exercise-header');
    if (headerEl && last) {
      addLongPress(headerEl, () => {
        copyLast(ei, ex.name);
        // Show feedback
        haptic(50);
        const toast = el('div', { cls: 'quick-action-toast' }, 'Copied previous workout');
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 1500);
      });
    }
  }, 0);

  // Build card content
  card.appendChild(
    // Exercise header with progress
    renderExerciseHeader(ei, ex, prog)
  );

  // Plate calculator
  if (Store.expandedPlateCalc[ei]) {
    card.appendChild(
      renderPlateCalc(ei, Store.inputs[`${ei}-0`]?.weight || last?.sets?.[0]?.weight || '')
    );
  }

  // Warm-up toggle + sets
  card.appendChild(
    el('div', { css: 'display:flex;gap:8px;margin:8px 0' },
      el('button', { 
        cls: 'btn-sm', 
        css: 'font-size:10px', 
        onclick: () => { 
          Store.expandedWarmup[ei] = !Store.expandedWarmup[ei]; 
          Router.render(); 
        }
      }, Store.expandedWarmup[ei] ? 'Hide Warm-up' : 'Warm-up')
    )
  );
  
  card.appendChild(renderWarmupSection(warmups));

  // Last performance
  if (last) {
    card.appendChild(
      el('div', { cls: 'last-perf' },
        'Last: ' + last.sets.map(s => `${s.weight ? fmtW(s.weight) : '?'}x${s.reps || '?'}`).join('  '),
        pr > 0 ? el('span', { cls: 'pr-tag' }, `PR: ${fmtW(pr)}`) : null
      )
    );
  }

  // Percentage suggestions
  const pctRow = renderPercentageRow(ex.name, ei);
  if (pctRow) card.appendChild(pctRow);

  // Set templates (fill down, ramp up)
  card.appendChild(renderSetTemplates(ei, ex));

  // Set inputs
  card.appendChild(renderSetInputs(ei, ex));

  // Rest presets
  card.appendChild(renderRestPresets(ex.rest));

  // Notes
  card.appendChild(
    el('textarea', { 
      cls: 'note-input', 
      placeholder: 'Notes (form cues, equipment settings...)',
      rows: '1', 
      value: Store.exerciseNotes[ei] || '',
      oninput: e => { Store.exerciseNotes[ei] = e.target.value; }
    })
  );

  // Best estimated 1RM
  if (bestSet > 0) {
    card.appendChild(
      el('div', { cls: 'e1rm' }, `Est. 1RM: ${fmtW(bestSet)}`)
    );
  }

  return card;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderWorkout, renderExerciseCard };
}
