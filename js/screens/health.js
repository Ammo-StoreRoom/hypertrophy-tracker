// ============================================
// HEALTH SCREEN — Body metrics and wellness
// ============================================

const MEASURE_FIELDS = [
  { key: 'chest', label: 'Chest' }, { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' }, { key: 'bicepL', label: 'Bicep L' },
  { key: 'bicepR', label: 'Bicep R' }, { key: 'thighL', label: 'Thigh L' },
  { key: 'thighR', label: 'Thigh R' }, { key: 'neck', label: 'Neck' }
];

/**
 * Render the health screen
 * @returns {HTMLElement} Health screen element
 */
function renderHealth() {
  const h = getTodayHealth();
  const recentBW = Store.bodyWeights.filter(b => b.weight).slice(-20);
  const bwMax = recentBW.length ? Math.max(...recentBW.map(b => b.weight)) : 1;
  const bwMin = recentBW.length ? Math.min(...recentBW.map(b => b.weight)) : 0;
  const bwRange = bwMax - bwMin || 1;
  const prevBW = recentBW.length >= 2 ? recentBW[recentBW.length - 2].weight : null;
  const curBW = recentBW.length ? recentBW[recentBW.length - 1].weight : null;
  const bwDelta = prevBW && curBW ? curBW - prevBW : null;

  const recentSleep = Store.bodyWeights.filter(b => b.sleep).slice(-14);
  const sleepMax = recentSleep.length ? Math.max(...recentSleep.map(b => b.sleep)) : 1;
  const avgSleep = recentSleep.length 
    ? (recentSleep.reduce((s, b) => s + b.sleep, 0) / recentSleep.length).toFixed(1) 
    : '-';

  const goals = Store.state.goals || { targetWeight: 0, lifts: {} };
  const latestMeasure = Store.measurements.length ? Store.measurements[Store.measurements.length - 1] : {};
  const prevMeasure = Store.measurements.length >= 2 ? Store.measurements[Store.measurements.length - 2] : {};
  const waterTarget = 8;
  const recovery = getRecoveryStatus();

  return el('div', { cls: 'screen screen-grid' }, renderModal(),
    // Header
    el('div', { cls: 'header' }, 
      el('h1', null, 'HEALTH'), 
      el('div', { cls: 'sub' }, 'Body, sleep & wellness')
    ),

    // Recovery banner
    recovery === 'warn' ? 
      el('div', { cls: 'recovery-banner recovery-warn' },
        el('span', null, '⚠️ Low recovery — consider lighter volume or a rest day')
      ) : 
    recovery === 'good' ? 
      el('div', { cls: 'recovery-banner recovery-good' },
        el('span', null, '✅ Good recovery — ready to push today')
      ) : null,

    // Quick stats
    renderHealthStats(curBW, bwDelta, avgSleep, h),

    // Body weight input + chart
    renderBodyWeightSection(h, recentBW, bwMin, bwRange),

    // Water intake
    renderWaterSection(h, waterTarget),

    // Sleep tracking
    renderSleepSection(h, recentSleep, sleepMax),

    // Readiness
    renderReadinessSection(h),

    // Body measurements
    renderMeasurementsSection(latestMeasure, prevMeasure),

    // Goals
    renderGoalsSection(goals, recentBW, curBW),

    renderNav()
  );
}

/**
 * Render health stats row
 */
function renderHealthStats(curBW, bwDelta, avgSleep, h) {
  return el('div', { cls: 'card full-width' },
    el('div', { cls: 'health-stat-row' },
      el('div', { cls: 'health-stat' },
        el('div', { cls: 'health-stat-val' }, curBW ? fmtW(curBW) : '--'),
        el('div', { cls: 'health-stat-label' }, `Weight (${unitLabel()})`),
        bwDelta !== null ? 
          el('div', { cls: `health-stat-delta ${bwDelta > 0 ? 'up' : bwDelta < 0 ? 'down' : 'flat'}` },
            `${bwDelta > 0 ? '+' : ''}${bwDelta.toFixed(1)}`
          ) : null
      ),
      el('div', { cls: 'health-stat' },
        el('div', { cls: 'health-stat-val' }, avgSleep !== '-' ? avgSleep : '--'),
        el('div', { cls: 'health-stat-label' }, 'Avg Sleep (h)')
      ),
      el('div', { cls: 'health-stat' },
        el('div', { cls: 'health-stat-val' }, 
          h.readiness ? ['', '🔴', '🟠', '🟡', '🟢', '🟢'][h.readiness] || '--' : '--'
        ),
        el('div', { cls: 'health-stat-label' }, 'Readiness')
      )
    )
  );
}

/**
 * Render body weight section
 */
function renderBodyWeightSection(h, recentBW, bwMin, bwRange) {
  return el('div', { cls: 'card' },
    el('div', { cls: 'label', css: 'margin-bottom:8px' }, 'Body Weight'),
    el('div', { cls: 'bw-row' },
      el('input', { 
        type: 'number', 
        inputmode: 'decimal', 
        cls: 'bw-input', 
        placeholder: unitLabel(),
        value: h.weight || '',
        onchange: e => { 
          const w = parseFloat(e.target.value); 
          if (w > 0) saveHealthField('weight', w); 
        }
      }),
      el('span', { css: 'font-size:12px;color:var(--dim)' }, `${unitLabel()} today`)
    ),
    recentBW.length > 1 ? 
      el('div', { cls: 'bw-chart', css: 'margin-top:10px' },
        ...recentBW.map(b => el('div', { 
          cls: 'bw-bar',
          css: `height:${Math.max(((b.weight - bwMin) / bwRange) * 50 + 6, 6)}px`,
          title: `${b.date}: ${fmtW(b.weight)}` 
        }))
      ) : null
  );
}

/**
 * Render water intake section
 */
function renderWaterSection(h, waterTarget) {
  return el('div', { cls: 'card' },
    el('div', { cls: 'label', css: 'margin-bottom:6px' }, 'Water Intake'),
    el('div', { cls: 'water-counter' },
      el('button', { 
        cls: 'water-btn', 
        onclick: () => { 
          if (h.water > 0) saveHealthField('water', h.water - 1); 
        } 
      }, '−'),
      el('div', null,
        el('div', { cls: 'water-val' }, String(h.water)),
        el('div', { cls: 'water-target' }, `of ${waterTarget} glasses`)
      ),
      el('button', { 
        cls: 'water-btn', 
        onclick: () => saveHealthField('water', h.water + 1) 
      }, '+')
    ),
    el('div', { cls: 'water-bar-row' },
      ...Array.from({ length: waterTarget }, (_, i) =>
        el('div', { cls: `water-dot ${i < h.water ? 'filled' : ''}` })
      )
    )
  );
}

/**
 * Render sleep tracking section
 */
function renderSleepSection(h, recentSleep, sleepMax) {
  return el('div', { cls: 'card' },
    el('div', { cls: 'label', css: 'margin-bottom:8px' }, 'Sleep (hours)'),
    el('div', { cls: 'quick-pills' },
      ...[4, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10].map(hrs =>
        el('button', {
          cls: `quick-pill ${h.sleep === hrs ? 'active' : ''}`,
          onclick: () => saveHealthField('sleep', hrs)
        }, String(hrs))
      )
    ),
    recentSleep.length > 1 ? 
      el('div', { cls: 'sleep-chart', css: 'margin-top:10px' },
        ...recentSleep.map(b => el('div', null,
          el('div', { 
            cls: 'sleep-bar', 
            css: `height:${(b.sleep / sleepMax) * 40}px`, 
            title: `${b.date}: ${b.sleep}h` 
          })
        ))
      ) : null
  );
}

/**
 * Render readiness section
 */
function renderReadinessSection(h) {
  return el('div', { cls: 'card' },
    el('div', { cls: 'label', css: 'margin-bottom:8px' }, 'How do you feel today?'),
    el('div', { cls: 'readiness-row' },
      ...[[1, '😴'], [2, '😕'], [3, '😐'], [4, '😊'], [5, '💪']].map(([val, emoji]) =>
        el('button', {
          cls: `readiness-btn ${h.readiness === val ? 'active' : ''}`,
          onclick: () => saveHealthField('readiness', val)
        }, emoji)
      )
    ),
    el('div', { css: 'text-align:center;margin-top:4px;font-size:11px;color:var(--dim)' },
      h.readiness ? ['', 'Exhausted', 'Tired', 'Okay', 'Good', 'Great'][h.readiness] : 'Tap to rate'
    )
  );
}

/**
 * Render measurements section
 */
function renderMeasurementsSection(latestMeasure, prevMeasure) {
  return el('div', { cls: 'card full-width' },
    el('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px' },
      el('span', { cls: 'label' }, 'Body Measurements'),
      el('span', { css: 'font-size:10px;color:var(--dim)' }, 
        latestMeasure.date ? `Last: ${fmtDate(latestMeasure.date)}` : ''
      )
    ),
    el('div', { cls: 'measure-grid' },
      ...MEASURE_FIELDS.map(f => {
        const prev = prevMeasure[f.key];
        return el('div', { cls: 'measure-item' },
          el('div', { cls: 'measure-label' }, f.label),
          el('input', {
            type: 'number', 
            inputmode: 'decimal', 
            cls: 'measure-input',
            placeholder: latestMeasure[f.key] ? String(latestMeasure[f.key]) : '--',
            onchange: e => {
              const v = parseFloat(e.target.value);
              if (v > 0) { 
                latestMeasure[f.key] = v; 
                saveMeasurements(latestMeasure); 
              }
            }
          }),
          prev ? el('div', { cls: 'measure-last' }, `prev: ${prev} ${unitLabel()}`) : null
        );
      })
    ),
    
    // Trends
    Store.measurements.length >= 3 ? 
      el('div', { css: 'margin-top:10px' },
        el('button', { 
          cls: 'btn-sm blue', 
          css: 'margin-bottom:8px', 
          onclick: () => { 
            Store.showMeasureTrends = !Store.showMeasureTrends; 
            Router.render(); 
          } 
        }, Store.showMeasureTrends ? 'Hide Trends' : 'Show Trends'),
        
        Store.showMeasureTrends ? 
          el('div', { cls: 'measure-grid', css: 'gap:12px' },
            ...MEASURE_FIELDS
              .filter(f => Store.measurements.filter(m => m[f.key]).length >= 3)
              .map(f => {
                const pts = Store.measurements.filter(m => m[f.key]).slice(-10);
                const vals = pts.map(m => m[f.key]);
                const mx = Math.max(...vals), mn = Math.min(...vals), rng = mx - mn || 1;
                const delta = vals.length >= 2 ? vals[vals.length - 1] - vals[vals.length - 2] : 0;
                
                return el('div', null,
                  el('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:3px' },
                    el('span', { cls: 'measure-label' }, f.label),
                    el('span', { 
                      css: `font-size:10px;font-weight:700;font-family:var(--mono);color:${
                        delta > 0 ? 'var(--red)' : delta < 0 ? 'var(--green)' : 'var(--dim)'
                      }` },
                      delta !== 0 ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}` : '--'
                    )
                  ),
                  el('div', { cls: 'measure-spark' },
                    ...vals.map(v => el('div', { 
                      cls: 'measure-spark-bar', 
                      css: `height:${Math.max(((v - mn) / rng) * 28 + 4, 4)}px` 
                    }))
                  )
                );
              })
          ) : null
      ) : null
  );
}

/**
 * Render goals section
 */
function renderGoalsSection(goals, recentBW, curBW) {
  return el('div', { cls: 'card full-width' },
    el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Goals'),

    // Weight goal
    el('div', { cls: 'goal-row' },
      el('div', { cls: 'goal-header' },
        el('span', { cls: 'goal-name' }, 'Target Weight'),
        el('span', { css: 'font-size:11px;color:var(--dim)' },
          goals.targetWeight ? `${fmtW(goals.targetWeight)} ${unitLabel()}` : 'Not set'
        )
      ),
      !goals.targetWeight ? 
        el('div', { css: 'display:flex;gap:6px;align-items:center' },
          el('input', { 
            type: 'number', 
            inputmode: 'decimal', 
            cls: 'measure-input', 
            css: 'width:100px',
            placeholder: unitLabel(),
            id: 'goal-weight-input'
          }),
          el('button', { 
            cls: 'btn-sm green', 
            onclick: () => {
              const v = parseFloat(document.getElementById('goal-weight-input')?.value);
              if (v > 0) saveGoals({ ...goals, targetWeight: v });
            } 
          }, 'Set')
        ) : 
        (() => {
          const start = recentBW.length ? recentBW[0].weight : curBW || 0;
          const diff = Math.abs(goals.targetWeight - start);
          const progress = diff > 0 && curBW ? Math.min(Math.abs(curBW - start) / diff * 100, 100) : 0;
          const remaining = curBW ? Math.abs(goals.targetWeight - curBW).toFixed(1) : '?';
          
          return el('div', null,
            el('div', { cls: 'goal-bar' },
              el('div', { cls: 'goal-fill', css: `width:${progress}%;background:var(--green)` })
            ),
            el('div', { css: 'display:flex;justify-content:space-between;margin-top:2px' },
              el('span', { cls: 'goal-pct' }, `${progress.toFixed(0)}%`),
              el('span', { css: 'font-size:10px;color:var(--dim)' }, `${remaining} ${unitLabel()} to go`)
            ),
            el('button', { 
              cls: 'btn-sm red', 
              css: 'margin-top:6px', 
              onclick: () => saveGoals({ ...goals, targetWeight: 0 }) 
            }, 'Clear Goal')
          );
        })()
    ),

    // Lift goals
    el('div', { css: 'margin-top:12px' },
      el('div', { css: 'font-size:12px;font-weight:600;color:var(--white);margin-bottom:6px' }, 'Lift Goals'),
      ...Store.getProgram().compounds.map(name => {
        const target = goals.lifts?.[name] || 0;
        const pr = Store.getPR(name);
        const prVal = pr ? parseFloat(pr) : 0;
        const progress = target > 0 && prVal > 0 ? Math.min((prVal / target) * 100, 100) : 0;
        
        return el('div', { cls: 'goal-row' },
          el('div', { cls: 'goal-header' },
            el('span', { cls: 'goal-name' }, name),
            el('span', { cls: 'goal-nums' }, 
              target ? `${fmtW(prVal)} / ${fmtW(target)}` : `PR: ${prVal ? fmtW(prVal) : '--'}`
            )
          ),
          target > 0 ? 
            el('div', null,
              el('div', { cls: 'goal-bar' },
                el('div', { 
                  cls: 'goal-fill', 
                  css: `width:${progress}%;background:${progress >= 100 ? 'var(--gold)' : 'var(--accent)'}` 
                })
              ),
              el('div', { cls: 'goal-pct' }, `${progress.toFixed(0)}%`)
            ) : 
            el('div', { css: 'display:flex;gap:6px;align-items:center' },
              el('input', { 
                type: 'number', 
                inputmode: 'decimal', 
                cls: 'measure-input', 
                css: 'width:80px',
                placeholder: unitLabel(), 
                id: `goal-lift-${name.replace(/\s/g, '-')}`
              }),
              el('button', { 
                cls: 'btn-sm green', 
                onclick: () => {
                  const v = parseFloat(document.getElementById(`goal-lift-${name.replace(/\s/g, '-')}`)?.value);
                  if (v > 0) { 
                    const newLifts = { ...goals.lifts, [name]: v }; 
                    saveGoals({ ...goals, lifts: newLifts }); 
                  }
                } 
              }, 'Set')
            )
        );
      })
    )
  );
}

/**
 * Save a health field for today
 */
async function saveHealthField(field, value) {
  const today = new Date().toISOString().split('T')[0];
  let idx = Store.bodyWeights.findIndex(b => b.date === today);
  if (idx < 0) { 
    Store.bodyWeights.push({ date: today }); 
    idx = Store.bodyWeights.length - 1; 
  }
  Store.bodyWeights[idx][field] = value;
  Store.bodyWeights.sort((a, b) => a.date.localeCompare(b.date));
  if (Store.bodyWeights.length > 365) Store.bodyWeights = Store.bodyWeights.slice(-365);
  await Store.setBodyWeights(Store.bodyWeights);
}

/**
 * Save measurements
 */
async function saveMeasurements(data) {
  const today = new Date().toISOString().split('T')[0];
  const idx = Store.measurements.findIndex(m => m.date === today);
  if (idx >= 0) {
    Store.measurements[idx] = { ...Store.measurements[idx], ...data, date: today };
  } else {
    Store.measurements.push({ ...data, date: today });
  }
  Store.measurements.sort((a, b) => a.date.localeCompare(b.date));
  if (Store.measurements.length > 365) Store.measurements = Store.measurements.slice(-365);
  await Store.setMeasurements(Store.measurements);
}

/**
 * Save goals
 */
async function saveGoals(goals) {
  Store.state.goals = goals;
  await Store.setState(Store.state);
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderHealth, saveHealthField, saveMeasurements, saveGoals, MEASURE_FIELDS };
}
