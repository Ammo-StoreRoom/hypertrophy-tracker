// ============================================
// MODALS — Modal dialog components
// ============================================

/**
 * Render the current modal if one is active
 * @returns {HTMLElement|null} Modal overlay element or null
 */
function renderModal() {
  const modal = Store.modal;
  if (!modal) return null;
  
  const close = () => { 
    Store.modal?.onCancel?.(); 
    Store.modal = null; 
    Router.render(); 
  };
  
  return el('div', { cls: 'modal-overlay', onclick: close },
    el('div', { cls: 'modal', onclick: e => e.stopPropagation() },
      el('h3', null, modal.title),
      modal.message ? el('p', null, modal.message) : null,
      modal.content || null,
      modal.onConfirm ? el('div', { cls: 'modal-btns' },
        el('button', { cls: 'btn-ghost muted', onclick: close }, 'Never mind'),
        el('button', { 
          cls: 'btn', 
          onclick: () => { 
            Store.modal?.onConfirm?.(); 
            Store.modal = null; 
            Router.render(); 
          } 
        }, modal.confirmLabel || 'Confirm')
      ) : null
    )
  );
}

/**
 * Show a confirmation modal
 * @param {string} title - Modal title
 * @param {string} message - Modal message
 * @param {Function} onConfirm - Callback when confirmed
 * @param {string} [confirmLabel='Confirm'] - Confirm button text
 */
function showConfirm(title, message, onConfirm, confirmLabel = 'Confirm') {
  Store.showModal({
    title,
    message,
    onConfirm,
    confirmLabel
  });
}

/**
 * Show an alert modal
 * @param {string} title - Modal title
 * @param {string} message - Modal message
 */
function showAlert(title, message) {
  Store.showModal({
    title,
    message,
    onConfirm: () => {},
    confirmLabel: 'OK'
  });
}

/**
 * Show exercise history modal
 * @param {string} name - Exercise name
 */
function showExerciseHistory(name) {
  const history = Store.history || [];
  const entries = [];
  let bestEver = 0;
  
  for (const w of history) {
    const ex = w.exercises?.find(e => e.name === name);
    if (!ex) continue;
    const bestW = Math.max(...(ex.sets || []).map(s => parseFloat(s.weight) || 0), 0);
    if (bestW > bestEver) bestEver = bestW;
    const e1rm = Math.max(...(ex.sets || []).map(s => calc1RM(s.weight, s.reps)), 0);
    entries.push({ date: w.date, sets: ex.sets, bestW, e1rm, isPR: bestW === bestEver && bestW > 0 });
    if (entries.length >= 20) break;
  }
  
  Store.showModal({
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
                  e.isPR ? el('span', { cls: 'pr-tag', css: 'margin-left:0' }, 'PR') : null
                )
              ),
              el('div', { css: 'font-size:11px;color:var(--text);font-family:var(--mono);margin-top:2px' },
                e.sets.map(s => `${s.weight || '-'}x${s.reps || '-'}`).join('  ')
              )
            )
          ))
    )
  });
}

/**
 * Show edit exercise scheme modal
 * @param {number} ei - Exercise index
 */
function editExerciseScheme(ei) {
  const ex = Store.workoutExercises[ei];
  Store.showModal({
    title: `Edit: ${ex.name}`,
    content: el('div', null,
      el('div', { css: 'margin-bottom:12px' },
        el('label', { cls: 'label', css: 'display:block;margin-bottom:4px' }, 'Sets'),
        el('div', { css: 'display:flex;gap:6px' },
          ...[1, 2, 3, 4, 5, 6, 7, 8].map(n => el('button', {
            cls: `btn-sm ${ex.sets === n ? 'green' : ''}`,
            onclick: () => { 
              Store.workoutExercises[ei].sets = n; 
              Store.closeModal(); 
            }
          }, String(n)))
        )
      ),
      el('div', null,
        el('label', { cls: 'label', css: 'display:block;margin-bottom:4px' }, 'Target Reps'),
        el('input', { 
          type: 'text', 
          cls: 'set-input', 
          css: 'text-align:left;font-size:14px', 
          value: ex.reps,
          oninput: e => { Store.workoutExercises[ei].reps = e.target.value; }
        })
      ),
      el('button', { 
        cls: 'btn', 
        css: 'margin-top:12px', 
        onclick: () => Store.closeModal() 
      }, 'Done')
    )
  });
}

/**
 * Show add custom exercise modal
 */
function showAddCustomExercise() {
  let name = '', group = 'Chest', sets = 3, reps = '10-12', rest = 60;
  const groups = Object.keys(MUSCLE_GROUPS);
  
  Store.showModal({
    title: 'Add Custom Exercise',
    content: el('div', null,
      el('label', { cls: 'label', css: 'display:block;margin-bottom:4px' }, 'Exercise Name'),
      el('input', { 
        type: 'text', 
        cls: 'set-input', 
        css: 'text-align:left;font-size:14px;margin-bottom:10px',
        placeholder: 'e.g. Smith Machine Squat',
        oninput: e => { name = e.target.value; }
      }),
      el('label', { cls: 'label', css: 'display:block;margin-bottom:4px' }, 'Muscle Group'),
      el('div', { css: 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px' },
        ...groups.map(g => el('button', { 
          cls: `btn-sm ${group === g ? 'green' : ''}`,
          onclick: () => { group = g; Router.render(); }
        }, g))
      ),
      el('div', { css: 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px' },
        el('div', null,
          el('label', { cls: 'label', css: 'display:block;margin-bottom:4px' }, 'Sets'),
          el('input', { 
            type: 'number', 
            cls: 'set-input', 
            value: '3', 
            oninput: e => { sets = parseInt(e.target.value) || 3; } 
          })
        ),
        el('div', null,
          el('label', { cls: 'label', css: 'display:block;margin-bottom:4px' }, 'Reps'),
          el('input', { 
            type: 'text', 
            cls: 'set-input', 
            value: '10-12', 
            oninput: e => { reps = e.target.value; } 
          })
        ),
        el('div', null,
          el('label', { cls: 'label', css: 'display:block;margin-bottom:4px' }, 'Rest (s)'),
          el('input', { 
            type: 'number', 
            cls: 'set-input', 
            value: '60', 
            oninput: e => { rest = parseInt(e.target.value) || 60; } 
          })
        )
      ),
      el('button', { 
        cls: 'btn btn-green', 
        onclick: async () => {
          if (!name.trim()) return;
          if (!Store.state.customExercises) Store.state.customExercises = [];
          Store.state.customExercises.push({ name: name.trim(), group, sets, reps, rest });
          await Store.setState(Store.state);
          Store.closeModal();
        }
      }, 'Add Exercise')
    )
  });
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderModal, showConfirm, showAlert, showExerciseHistory, editExerciseScheme, showAddCustomExercise };
}
