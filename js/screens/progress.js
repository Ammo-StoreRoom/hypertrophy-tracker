// ============================================
// PROGRESS SCREEN — Analytics and charts
// ============================================

/**
 * Render the progress screen
 * @returns {HTMLElement} Progress screen element
 */
function renderProgress() {
  const vol = getWeeklyVolume();
  const maxSets = Math.max(...Object.values(vol).map(v => v.sets), 1);
  const recentDurations = Store.history.slice(0, 12).reverse();
  const maxDur = Math.max(...recentDurations.map(h => h.duration || 0), 1);

  return el('div', { cls: 'screen screen-grid' }, renderModal(),
    // Header
    el('div', { cls: 'header' }, 
      el('h1', null, 'PROGRESS'), 
      el('div', { cls: 'sub' }, 'Lifts, volume & trends')
    ),

    // Compound lift charts
    ...Store.getProgram().compounds.map(name => renderLiftChart(name)),

    // Weekly volume
    Object.keys(vol).length ? 
      el('div', { cls: 'card full-width' },
        el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Weekly Volume (sets)'),
        ...Object.entries(vol)
          .sort((a, b) => b[1].sets - a[1].sets)
          .map(([group, data]) =>
            el('div', { cls: 'vol-item' },
              el('span', { cls: 'vol-name' }, group),
              el('div', { cls: 'vol-bar-bg' },
                el('div', { cls: 'vol-bar-fill', css: `width:${(data.sets / maxSets) * 100}%` })
              ),
              el('span', { cls: 'vol-sets' }, String(data.sets))
            )
          )
      ) : null,

    // Duration trend
    recentDurations.length > 1 ? 
      el('div', { cls: 'card' },
        el('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px' },
          el('span', { cls: 'label' }, 'Workout Duration'),
          el('span', { css: 'font-size:12px;color:var(--green);font-weight:700;font-family:var(--mono)' },
            `avg ${Math.round(recentDurations.reduce((s, h) => s + (h.duration || 0), 0) / recentDurations.length)}min`
          )
        ),
        renderDurationChart(recentDurations)
      ) : null,

    // Muscle balance radar
    Object.keys(vol).length > 2 ? 
      el('div', { cls: 'card' },
        el('div', { cls: 'label', css: 'margin-bottom:8px' }, 'Muscle Balance (weekly sets)'),
        renderRadarChart(vol)
      ) : null,

    // Strength standards
    renderStrengthStandards(),

    // Fatigue score
    renderFatigueScore(),

    renderNav()
  );
}

/**
 * Render a lift progression chart
 * @param {string} name - Exercise name
 * @returns {HTMLElement} Lift chart card
 */
function renderLiftChart(name) {
  const data = Store.history
    .filter(w => w.exercises?.some(e => e.name === name))
    .reverse()
    .slice(-12)
    .map(w => {
      const ex = w.exercises.find(e => e.name === name);
      const best = ex?.sets?.reduce((b, s) => 
        (parseFloat(s.weight) || 0) > (parseFloat(b.weight) || 0) ? s : b, { weight: '0' }
      );
      return { date: fmtDate(w.date), weight: parseFloat(best?.weight) || 0 };
    });
  
  const pr = Store.getPR(name);
  const manualPr = Store.getManualPR(name);
  const bestE1rm = (() => {
    let best = manualPr?.e1rm || 0;
    for (const w of Store.history) {
      const ex = w.exercises?.find(e => e.name === name);
      if (ex) {
        for (const s of (ex.sets || [])) {
          const rm = calc1RM(s.weight, s.reps);
          if (rm > best) best = rm;
        }
      }
    }
    return best;
  })();
  
  const prInputId = `pr-input-${name.replace(/\s/g, '-')}`;
  const e1rmInputId = `e1rm-input-${name.replace(/\s/g, '-')}`;
  
  return el('div', { cls: 'card' },
    // Header
    el('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px' },
      el('span', { css: 'font-size:14px;font-weight:700;color:var(--white)' }, name),
      el('div', { css: 'display:flex;gap:8px;align-items:center' },
        el('span', { css: 'font-size:12px;color:var(--gold);font-weight:700;font-family:var(--mono)' }, 
          `PR: ${pr ? fmtW(pr) : '--'}`
        ),
        el('button', { 
          cls: 'btn-sm', 
          css: 'font-size:10px;padding:3px 8px', 
          onclick: e2 => { 
            e2.stopPropagation(); 
            Store.expandedPRInput[name] = !Store.expandedPRInput[name]; 
            Router.render(); 
          } 
        }, Store.expandedPRInput[name] ? '✕' : '✎')
      )
    ),
    
    // E1RM display
    bestE1rm > 0 ? 
      el('div', { css: 'font-size:10px;color:var(--dim);font-family:var(--mono);margin-bottom:6px' },
        `Est 1RM: ${fmtW(bestE1rm)}${manualPr?.date ? ` • Manual: ${manualPr.date}` : ''}`
      ) : null,
    
    // PR input form
    Store.expandedPRInput[name] ? 
      el('div', { css: 'display:flex;gap:6px;align-items:center;margin-bottom:8px;padding:8px;background:var(--input-bg);border-radius:8px' },
        el('div', { css: 'flex:1' },
          el('div', { css: 'font-size:9px;color:var(--dim);margin-bottom:2px' }, `Weight (${unitLabel()})`),
          el('input', { 
            type: 'number', 
            inputmode: 'decimal', 
            cls: 'measure-input', 
            css: 'font-size:13px;padding:6px',
            id: prInputId, 
            placeholder: pr ? String(pr) : '--', 
            value: manualPr?.weight || '' 
          })
        ),
        el('div', { css: 'flex:1' },
          el('div', { css: 'font-size:9px;color:var(--dim);margin-bottom:2px' }, 'Est 1RM'),
          el('input', { 
            type: 'number', 
            inputmode: 'decimal', 
            cls: 'measure-input', 
            css: 'font-size:13px;padding:6px',
            id: e1rmInputId, 
            placeholder: bestE1rm ? String(Math.round(bestE1rm)) : '--', 
            value: manualPr?.e1rm || '' 
          })
        ),
        el('button', { 
          cls: 'btn-sm green', 
          css: 'align-self:flex-end;padding:6px 12px', 
          onclick: () => {
            const w = document.getElementById(prInputId)?.value;
            const rm = document.getElementById(e1rmInputId)?.value;
            if (w || rm) Store.setManualPR(name, w, rm);
          } 
        }, 'Save')
      ) : null,
    
    // Chart
    renderBarChart(data, pr)
  );
}

/**
 * Render strength standards comparison
 * @returns {HTMLElement|null} Strength standards card
 */
function renderStrengthStandards() {
  const bw = Store.bodyWeights.length ? Store.bodyWeights[Store.bodyWeights.length - 1].weight : 0;
  if (!bw) return null;
  
  const compounds = Store.getProgram().compounds.filter(c => STRENGTH_STANDARDS[c]);
  if (!compounds.length) return null;
  
  const rows = compounds.map(name => {
    const pr = Store.getPR(name);
    const std = STRENGTH_STANDARDS[name];
    if (!std) return null;
    
    const ratio = pr / bw;
    let level = 'Beginner', color = 'var(--dim)', pct = 0;
    
    if (ratio >= std.elite) {
      level = 'Elite'; color = 'var(--gold)'; pct = 100;
    } else if (ratio >= std.advanced) {
      level = 'Advanced'; color = 'var(--green)';
      pct = 75 + 25 * (ratio - std.advanced) / (std.elite - std.advanced);
    } else if (ratio >= std.intermediate) {
      level = 'Intermediate'; color = '#60a5fa';
      pct = 50 + 25 * (ratio - std.intermediate) / (std.advanced - std.intermediate);
    } else if (ratio >= std.beginner) {
      level = 'Beginner'; color = 'var(--dim)';
      pct = 25 + 25 * (ratio - std.beginner) / (std.intermediate - std.beginner);
    } else {
      pct = 25 * ratio / (std.beginner || 1);
    }
    
    return { name, pr, ratio: ratio.toFixed(2), level, color, pct: Math.min(100, Math.max(2, pct)) };
  }).filter(Boolean);
  
  if (!rows.length) return null;
  
  return el('div', { cls: 'card full-width' },
    el('div', { cls: 'label', css: 'margin-bottom:10px' }, `Strength Standards (${fmtW(bw)} BW)`),
    ...rows.map(r => 
      el('div', { css: 'margin-bottom:8px' },
        el('div', { css: 'display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px' },
          el('span', { css: 'color:var(--white);font-weight:600' }, r.name),
          el('span', { css: `color:${r.color};font-weight:700;font-family:var(--mono)` }, 
            `${r.level} (${r.ratio}x)`
          )
        ),
        el('div', { cls: 'std-bar-bg' },
          el('div', { cls: 'std-bar-fill', css: `width:${r.pct}%;background:${r.color}` }),
          el('div', { cls: 'std-markers' },
            ...[25, 50, 75].map(p => el('div', { css: `left:${p}%` }))
          )
        )
      )
    )
  );
}

/**
 * Render fatigue score card
 * @returns {HTMLElement} Fatigue score element
 */
function renderFatigueScore() {
  const score = calcFatigueScore();
  const color = score <= 40 ? 'var(--green)' : score <= 70 ? 'var(--gold)' : 'var(--accent)';
  const label = score <= 40 ? 'Fresh' : score <= 70 ? 'Moderate' : 'High Fatigue';
  
  return el('div', { cls: 'card' },
    el('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px' },
      el('span', { cls: 'label' }, 'Weekly Fatigue'),
      el('span', { css: `font-size:12px;font-weight:700;color:${color}` }, label)
    ),
    el('div', { cls: 'fatigue-gauge' },
      el('div', { cls: 'fatigue-fill', css: `width:${score}%;background:${color}` })
    ),
    el('div', { css: `text-align:center;font-size:24px;font-weight:900;font-family:var(--mono);margin-top:6px;color:${color}` }, 
      String(score)
    )
  );
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderProgress, renderLiftChart, renderStrengthStandards, renderFatigueScore };
}
