// ============================================
// HOME SCREEN — Dashboard and workout start
// ============================================

/**
 * Render the home screen
 * @returns {HTMLElement} Home screen element
 */
function renderHome() {
  const next = Store.getNextDay();
  const exCount = Store.getExercises(next)?.length || 0;
  
  // Calculate streak
  const streak = (() => { 
    let s = 0; 
    const now = new Date(); 
    for (const h2 of Store.history) { 
      const d = new Date(h2.date); 
      if (Math.floor((now - d) / 86400000) <= s + 2) s++; 
      else break; 
    } 
    return s; 
  })();
  
  // Calculate weekly streak
  const weeklyStreak = (() => {
    const weeks = {};
    for (const h2 of Store.history) {
      const d = new Date(h2.date);
      const weekStart = new Date(d);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const key = weekStart.toISOString().split('T')[0];
      weeks[key] = (weeks[key] || 0) + 1;
    }
    const sortedWeeks = Object.entries(weeks).sort((a, b) => b[0].localeCompare(a[0]));
    let ws = 0;
    for (const [, count] of sortedWeeks) { 
      if (count >= 3) ws++; 
      else break; 
    }
    return ws;
  })();
  
  const daysSince = Store.history[0]?.date 
    ? Math.floor((Date.now() - new Date(Store.history[0].date).getTime()) / 86400000) 
    : '-';

  return el('div', { cls: 'screen' }, renderModal(),
    // Pull to refresh indicator
    el('div', { 
      id: 'pull-indicator', 
      cls: 'pull-indicator mobile-only', 
      css: 'height:0;opacity:0;overflow:hidden' 
    }),
    
    // Header
    el('div', { cls: 'header' },
      el('div', { cls: 'header-row' },
        el('div', null,
          el('h1', null, 'HYPERTROPHY TRACKER', el('span', { cls: 'platform-badge' }, 'WEB')),
          el('div', { cls: 'sub' }, Store.state.phase === 'rampup' 
            ? `Ramp-Up • ${Store.state.rampWeek}` 
            : `PPL • Mesocycle W${Store.state.mesoWeek}`
          )
        ),
        el('div', { 
          cls: `sync-dot ${Store.isOnline ? '' : 'offline'}`, 
          title: Store.isOnline ? 'Synced' : 'Offline' 
        })
      )
    ),

    // Install banner (PWA)
    Store.deferredPrompt && !Store.installDismissed ? 
      el('div', { cls: 'install-banner' },
        el('p', null, 'Install for the best experience'),
        el('button', { cls: 'btn', onclick: installApp }, 'Install'),
        el('button', { 
          cls: 'btn-sm', 
          onclick: () => { Store.installDismissed = true; Router.render(); } 
        }, '✕')
      ) : null,
    
    !isStandalone() && isIOS() && !Store.installDismissed ? 
      el('div', { cls: 'install-banner' },
        el('p', null, 'Tap Share → Add to Home Screen'),
        el('button', { 
          cls: 'btn-sm', 
          onclick: () => { Store.installDismissed = true; Router.render(); } 
        }, '✕')
      ) : null,

    // Recovery warning
    getRecoveryStatus() === 'warn' ? 
      el('div', { cls: 'recovery-banner recovery-warn', css: 'margin:10px 14px' },
        el('span', null, '⚠️ Low recovery — take it easy today')
      ) : null,

    // Fatigue warning
    (Store.state.fatigueFlags || 0) >= 2 ? 
      el('div', { cls: 'fatigue-banner' },
        el('span', null, 'Fatigue detected — consider an early deload'),
        el('button', { 
          cls: 'btn-sm', 
          css: 'background:rgba(255,255,255,.2);color:#fff', 
          onclick: async () => {
            Store.state.mesoWeek = 4; 
            Store.state.fatigueFlags = 0; 
            await Store.setState(Store.state);
          }
        }, 'Go to Deload')
      ) : null,

    // Stats
    el('div', { cls: 'stats' },
      ...[
        [Store.history.length, 'Workouts', 'accent'],
        [`${streak}${weeklyStreak > 0 ? ' 🔥' : ''}`, `Streak${weeklyStreak > 0 ? ` (${weeklyStreak}w)` : ''}`, 'green'],
        [daysSince, 'Days Ago', '']
      ].map(([v, l, c]) => el('div', { cls: 'stat-card' }, 
        el('div', { cls: `stat-val ${c}` }, String(v)), 
        el('div', { cls: 'label' }, l)
      ))
    ),
    
    (Store.state.longestStreak || 0) > 0 ? 
      el('div', { css: 'text-align:center;font-size:10px;color:var(--dim);margin-top:2px;padding:0 14px' },
        `Longest streak: ${Store.state.longestStreak} workouts`) 
      : null,

    // Heatmap
    Store.history.length > 0 ? renderHomeHeatmap() : null,

    // Main grid
    el('div', { cls: 'home-grid' },
      // Your Week summary
      renderWeekSummary(),

      // Phase card
      el('div', { cls: 'card', css: 'display:flex;justify-content:space-between;align-items:center' },
        el('div', null,
          el('div', { css: 'display:flex;gap:8px;align-items:center;margin-bottom:4px' },
            el('span', { cls: 'label' }, 'Phase'),
            el('span', { 
              cls: `badge ${Store.state.phase === 'rampup' ? 'badge-accent' : 'badge-green'}` 
            }, Store.state.phase === 'rampup' ? 'RAMP-UP' : 'FULL PPL')
          ),
          el('div', { css: 'font-size:13px;color:var(--dim)' }, 'RIR Target: ', 
            el('strong', { css: 'color:var(--accent)' }, Store.getRIR())
          ),
          Store.state.phase === 'ppl' ? 
            el('div', { css: 'font-size:13px;color:var(--dim)' }, 
              `W${Store.state.mesoWeek} • ${Store.getProgram().ppl[Store.state.pplIdx]?.day || ''}`
            ) : null
        )
      ),

      // Next workout card
      el('div', { cls: 'card accent-border full-width' },
        el('div', { cls: 'label', css: 'margin-bottom:6px' }, 'Next Workout'),
        el('div', { css: 'font-size:20px;font-weight:800;color:var(--white);margin-bottom:2px' }, next),
        el('div', { css: 'font-size:12px;color:var(--dim);margin-bottom:14px' }, `${exCount} exercises`),
        el('button', { cls: 'btn', onclick: () => startWorkout(next) }, 'START WORKOUT')
      ),

      // All days
      el('div', { cls: 'card full-width' },
        el('span', { cls: 'label', css: 'display:block;margin-bottom:10px' }, 'All Days'),
        el('div', { cls: 'day-list' },
          ...Store.getDays().map(d => 
            el('button', { 
              cls: `btn-ghost day-btn ${d === next ? '' : 'muted'}`, 
              onclick: () => startWorkout(d) 
            },
              el('span', null, d), 
              d === next ? el('span', { cls: 'next-tag' }, 'NEXT') : null
            )
          )
        )
      )
    ),
    
    renderNav()
  );
}

/**
 * Render week summary card
 * @returns {HTMLElement} Week summary element
 */
function renderWeekSummary() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const wkStr = weekStart.toISOString().split('T')[0];
  const wkWorkouts = Store.history.filter(h2 => h2.date >= wkStr);
  const wkSets = wkWorkouts.reduce((s, w) => 
    s + (w.exercises || []).reduce((s2, e) => 
      s2 + (e.sets || []).filter(st => st.weight && st.reps).length, 0
    ), 0
  );
  const wkBW = Store.bodyWeights.filter(b => b.date >= wkStr);
  const wkSleep = wkBW.filter(b => b.sleep);
  const avgSl = wkSleep.length 
    ? (wkSleep.reduce((s, b) => s + b.sleep, 0) / wkSleep.length).toFixed(1) 
    : '--';
  const wkWater = wkBW.filter(b => (b.water || 0) >= 6).length;
  
  let bestLift = '', bestE1RM = 0;
  for (const w of wkWorkouts) {
    for (const ex of (w.exercises || [])) {
      for (const s of (ex.sets || [])) {
        const rm = calc1RM(s.weight, s.reps);
        if (rm > bestE1RM) { bestE1RM = rm; bestLift = ex.name; }
      }
    }
  }

  return el('div', { cls: 'card full-width' },
    el('div', { cls: 'label', css: 'margin-bottom:8px' }, 'Your Week'),
    el('div', { cls: 'health-stat-row' },
      el('div', { cls: 'health-stat' },
        el('div', { cls: 'health-stat-val accent' }, String(wkWorkouts.length)),
        el('div', { cls: 'health-stat-label' }, 'Workouts')
      ),
      el('div', { cls: 'health-stat' },
        el('div', { cls: 'health-stat-val' }, String(wkSets)),
        el('div', { cls: 'health-stat-label' }, 'Sets')
      ),
      el('div', { cls: 'health-stat' },
        el('div', { css: 'font-size:18px;font-weight:800;font-family:var(--mono);color:var(--purple)' }, avgSl),
        el('div', { cls: 'health-stat-label' }, 'Avg Sleep')
      )
    ),
    el('div', { css: 'display:flex;justify-content:space-between;font-size:11px;color:var(--dim);margin-top:6px' },
      el('span', null, `Water: ${wkWater}/${Math.min(now.getDay() + 1, 7)} days`),
      bestLift ? el('span', null, `Best: ${bestLift} ${fmtW(bestE1RM)} e1RM`) : null
    )
  );
}

/**
 * Render activity heatmap for home
 * @returns {HTMLElement} Heatmap card element
 */
function renderHomeHeatmap() {
  const workoutDates = {};
  for (const h2 of Store.history) {
    const d = new Date(h2.date).toISOString().split('T')[0];
    workoutDates[d] = (workoutDates[d] || 0) + 1;
  }
  const today2 = new Date();
  const todayStr = today2.toISOString().split('T')[0];
  const startDate = new Date(today2);
  startDate.setDate(startDate.getDate() - 12 * 7 - startDate.getDay());
  const heatCells = [];
  for (let i = 0; i < 12 * 7; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    const count = workoutDates[ds] || 0;
    const lvl = count >= 2 ? 'l3' : count === 1 ? 'l2' : '';
    heatCells.push(el('div', { 
      cls: `heatmap-cell ${lvl} ${ds === todayStr ? 'today' : ''}`, 
      css: d > today2 ? 'opacity:.3' : '', 
      title: ds 
    }));
  }
  
  return el('div', { cls: 'card', css: 'margin:10px 14px' },
    el('div', { cls: 'label', css: 'margin-bottom:6px' }, 'Activity (12 weeks)'),
    el('div', { css: 'display:flex' },
      el('div', { cls: 'heatmap-labels' }, ...['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => el('span', null, d))),
      el('div', { cls: 'heatmap-grid' }, ...heatCells)
    )
  );
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderHome, renderWeekSummary, renderHomeHeatmap };
}
