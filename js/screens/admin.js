// ============================================
// ADMIN SCREEN — User management portal
// ============================================

/**
 * Render the admin screen
 * @returns {HTMLElement} Admin screen element
 */
function renderAdmin() {
  if (!Store.isAdmin()) { 
    Store.screen = 'home'; 
    Router.render(); 
    return el('div'); 
  }

  const users = Store.adminUsers ? Object.entries(Store.adminUsers) : [];
  const totalWorkouts = users.reduce((s, [, u]) => s + (u.historyCount || 0), 0);
  const activeToday = users.filter(([, u]) => u.lastActive === new Date().toISOString().split('T')[0]).length;

  return el('div', { cls: 'screen screen-grid' }, renderModal(),
    // Header
    el('div', { cls: 'header' },
      el('h1', null, 'ADMIN PORTAL'),
      el('div', { cls: 'sub' }, 'User management & programs')
    ),

    // Stats
    el('div', { cls: 'stats' },
      ...[
        [users.length, 'Users', 'accent'],
        [totalWorkouts, 'Workouts', 'green'],
        [activeToday, 'Active Today', '']
      ].map(([v, l, c]) => el('div', { cls: 'stat-card' },
        el('div', { cls: `stat-val ${c}` }, String(v)),
        el('div', { cls: 'label' }, l)
      ))
    ),

    // Actions
    el('div', { css: 'padding:10px 14px;display:flex;gap:8px;flex-wrap:wrap' },
      el('button', { 
        cls: 'btn-ghost', 
        css: 'flex:1', 
        onclick: async () => { await loadAdminData(); } 
      }, 'Refresh'),
      el('button', { 
        cls: 'btn-ghost muted', 
        css: 'flex:1', 
        onclick: () => {
          const data = JSON.stringify(Store.adminUsers, null, 2);
          const blob = new Blob([data], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `ht-admin-export-${new Date().toISOString().split('T')[0]}.json`;
          a.click();
        } 
      }, 'Export All'),
      el('button', { 
        cls: 'btn-ghost', 
        css: 'flex:1', 
        onclick: () => {
          window.open('test/index.html', '_blank');
        } 
      }, '🧪 Run Tests')
    ),

    // Add user by PIN
    el('div', { cls: 'card full-width' },
      el('div', { css: 'display:flex;gap:8px;align-items:center' },
        el('input', { 
          type: 'tel', 
          id: 'admin-add-pin', 
          cls: 'set-input', 
          css: 'flex:1;text-align:left;font-size:14px;padding:10px 12px',
          placeholder: 'Add user by PIN (MMDDYYYY)', 
          maxlength: '8', 
          inputmode: 'numeric' 
        }),
        el('button', { 
          cls: 'btn-sm green', 
          css: 'padding:10px 16px', 
          onclick: async () => {
            const pin = document.getElementById('admin-add-pin')?.value;
            if (!pin || pin.length !== 8) return;
            const h = Storage.adminAddUserByPin(pin);
            if (h) await loadAdminData();
          } 
        }, 'Add')
      )
    ),

    // Diagnostics
    Store.adminDiag ? 
      el('div', { css: 'padding:0 14px;font-size:10px;color:var(--dim);display:flex;gap:10px;flex-wrap:wrap' },
        el('span', null, `Local: ${Store.adminDiag.local}`),
        el('span', null, `Registry: ${Store.adminDiag.registry}`),
        el('span', null, `Firebase: ${Store.adminDiag.usersScan}`),
        ...(Store.adminDiag.errors || []).map(e => el('span', { css: 'color:var(--red)' }, e))
      ) : null,

    // Loading
    Store.adminLoading ? 
      el('div', { cls: 'card full-width', css: 'text-align:center' },
        el('div', { css: 'color:var(--accent);font-weight:700' }, 'Loading user data...')
      ) : null,

    // User cards
    ...users.map(([hash, user]) => renderAdminUserCard(hash, user)),

    // Empty state
    !users.length && !Store.adminLoading ? 
      el('div', { cls: 'card full-width', css: 'text-align:center' },
        el('p', { css: 'color:var(--dim)' }, 'No registered users. Add a user by PIN above, or they\'ll appear after they log in.')
      ) : null,

    renderNav()
  );
}

/**
 * Render a user card in admin view
 * @param {string} hash - User hash
 * @param {Object} user - User data
 * @returns {HTMLElement} User card element
 */
function renderAdminUserCard(hash, user) {
  const exp = Store.adminExpanded[hash];
  const pin = user.pin || '';
  const fmtPin = /^\d{8}$/.test(pin) 
    ? `${pin.slice(0, 2)}/${pin.slice(2, 4)}/${pin.slice(4)}`
    : 'Unknown PIN';
  const isSelf = user.pin === Storage.getPin();
  const progLabel = Store.ALL_PROGRAMS.find(([k]) => k === user.state?.program)?.[1] || 'Unknown';
  const phaseLabel = user.state?.phase === 'ppl'
    ? `PPL W${user.state.mesoWeek || 1}`
    : `Ramp-Up ${user.state?.rampWeek || 'W1'}`;

  return el('div', { cls: 'card full-width admin-card' },
    el('div', { 
      css: 'display:flex;justify-content:space-between;align-items:center;cursor:pointer',
      onclick: () => { Store.adminExpanded[hash] = !exp; Router.render(); } 
    },
      el('div', null,
        el('div', { css: 'display:flex;align-items:center;gap:8px' },
          el('span', { css: 'font-size:16px;font-weight:800;color:var(--white);font-family:var(--mono)' }, fmtPin),
          isSelf ? el('span', { cls: 'admin-you-badge' }, 'YOU') : null,
          el('span', { 
            css: `width:8px;height:8px;border-radius:50%;background:${
              user.lastActive === new Date().toISOString().split('T')[0] ? 'var(--green)' : 'var(--muted)'
            }` 
          })
        ),
        el('div', { css: 'font-size:11px;color:var(--dim);margin-top:3px' },
          `${progLabel} • ${phaseLabel} • ${user.historyCount || 0} workouts`
        )
      ),
      el('span', { css: 'color:var(--dim);font-size:16px' }, exp ? '▲' : '▼')
    ),
    exp ? renderAdminUserExpanded(hash, user) : null
  );
}

/**
 * Render expanded user details in admin view
 * @param {string} hash - User hash
 * @param {Object} user - User data
 * @returns {HTMLElement} Expanded user details element
 */
function renderAdminUserExpanded(hash, user) {
  const st = user.state || {};
  const allowed = st.allowedPrograms || ['standard', 'glute-focus'];
  const isSelf = user.pin === Storage.getPin();
  const bws = user.bodyWeights || [];
  const latestBW = bws.filter(b => b.weight).slice(-1)[0];
  const last7 = bws.slice(-7);
  const avgSleepAdmin = last7.filter(b => b.sleep).length 
    ? (last7.filter(b => b.sleep).reduce((s, b) => s + b.sleep, 0) / last7.filter(b => b.sleep).length).toFixed(1) 
    : null;
  const lastReadiness = last7.filter(b => b.readiness).slice(-1)[0]?.readiness;
  const waterDays = last7.filter(b => (b.water || 0) >= 6).length;

  return el('div', { cls: 'admin-expanded' },
    // Last active
    el('div', { css: 'font-size:11px;color:var(--dim);margin-bottom:12px' },
      `Last active: ${user.lastActive || 'Unknown'}`,
      user.lastWorkout ? ` • Last workout: ${fmtDate(user.lastWorkout)}` : ''
    ),

    // Health snapshot
    (latestBW || avgSleepAdmin || lastReadiness) ? 
      el('div', { cls: 'admin-section' },
        el('div', { cls: 'label', css: 'margin-bottom:6px' }, 'Health Snapshot'),
        el('div', { css: 'display:flex;gap:10px;flex-wrap:wrap;font-size:11px' },
          latestBW ? 
            el('div', { css: 'background:var(--input-bg);border-radius:6px;padding:6px 10px' },
              el('span', { css: 'color:var(--dim)' }, 'Weight: '),
              el('span', { css: 'color:var(--white);font-weight:700;font-family:var(--mono)' }, String(latestBW.weight))
            ) : null,
          avgSleepAdmin ? 
            el('div', { css: 'background:var(--input-bg);border-radius:6px;padding:6px 10px' },
              el('span', { css: 'color:var(--dim)' }, 'Sleep: '),
              el('span', { css: 'color:var(--purple);font-weight:700;font-family:var(--mono)' }, `${avgSleepAdmin}h avg`)
            ) : null,
          lastReadiness ? 
            el('div', { css: 'background:var(--input-bg);border-radius:6px;padding:6px 10px' },
              el('span', { css: 'color:var(--dim)' }, 'Readiness: '),
              el('span', null, ['', '🔴', '🟠', '🟡', '🟢', '🟢'][lastReadiness] || '?')
            ) : null,
          el('div', { css: 'background:var(--input-bg);border-radius:6px;padding:6px 10px' },
            el('span', { css: 'color:var(--dim)' }, 'Water: '),
            el('span', { css: 'color:var(--blue);font-weight:700;font-family:var(--mono)' }, `${waterDays}/7 days`)
          )
        )
      ) : null,

    // Active program
    el('div', { cls: 'admin-section' },
      el('div', { cls: 'label', css: 'margin-bottom:6px' }, 'Active Program'),
      el('div', { css: 'display:flex;gap:6px;flex-wrap:wrap' },
        ...Store.ALL_PROGRAMS.map(([k, l]) =>
          el('button', {
            cls: `btn-ghost ${st.program === k ? '' : 'muted'}`,
            css: `font-size:12px;padding:8px 12px${st.program === k ? ';border-color:var(--accent);color:var(--accent)' : ''}`,
            onclick: async () => {
              const s = { ...st, program: k, phase: 'rampup', rampWeek: 'Week 1', rampDayIdx: 0, mesoWeek: 1, pplIdx: 0 };
              await Storage.adminSetUserData(hash, 'state', s);
              if (isSelf) { Store.state = s; await Store.setState(Store.state); }
              await loadAdminData();
            }
          }, l)
        )
      )
    ),

    // Allowed programs
    el('div', { cls: 'admin-section' },
      el('div', { cls: 'label', css: 'margin-bottom:6px' }, 'Allowed Programs'),
      el('div', { css: 'display:flex;gap:6px;flex-wrap:wrap' },
        ...Store.ALL_PROGRAMS.map(([k, l]) => {
          const on = allowed.includes(k);
          return el('button', {
            cls: `btn-sm ${on ? 'green' : ''}`,
            css: 'font-size:11px',
            onclick: async () => {
              let next = [...allowed];
              if (on && next.length > 1) next = next.filter(p => p !== k);
              else if (!on) next.push(k);
              const s = { ...st, allowedPrograms: next };
              if (!next.includes(s.program)) { 
                s.program = next[0]; 
                s.phase = 'rampup'; 
                s.rampWeek = 'Week 1'; 
                s.rampDayIdx = 0; 
              }
              await Storage.adminSetUserData(hash, 'state', s);
              if (isSelf) { Store.state = s; await Store.setState(Store.state); }
              await loadAdminData();
            }
          }, `${on ? '✓' : '+'} ${l}`);
        })
      )
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
              if (isSelf) { Store.state = s; await Store.setState(Store.state); }
              await loadAdminData();
            }
          }, p === 'rampup' ? 'Ramp-Up' : 'Full PPL')
        ),
        st.phase === 'ppl' ? 
          el('div', { css: 'display:flex;gap:4px;width:100%;margin-top:4px' },
            ...[1, 2, 3, 4].map(w => 
              el('button', {
                cls: `btn-sm ${st.mesoWeek === w ? 'green' : ''}`,
                css: 'font-size:11px;flex:1',
                onclick: async () => {
                  const s = { ...st, mesoWeek: w };
                  await Storage.adminSetUserData(hash, 'state', s);
                  if (isSelf) { Store.state = s; await Store.setState(Store.state); }
                  await loadAdminData();
                }
              }, w === 4 ? 'Deload' : `W${w}`)
            )
          ) : null
      )
    ),

    // Units
    el('div', { cls: 'admin-section' },
      el('div', { cls: 'label', css: 'margin-bottom:6px' }, 'Units'),
      el('div', { css: 'display:flex;gap:6px' },
        ...['lbs', 'kg'].map(u => 
          el('button', {
            cls: `btn-sm ${(st.units || 'lbs') === u ? 'green' : ''}`,
            css: 'font-size:11px',
            onclick: async () => {
              const s = { ...st, units: u };
              await Storage.adminSetUserData(hash, 'state', s);
              if (isSelf) { Store.state = s; await Store.setState(Store.state); }
              await loadAdminData();
            }
          }, u.toUpperCase())
        )
      )
    ),

    // Danger zone
    el('div', { cls: 'admin-section', css: 'border-top:1px solid rgba(239,68,68,.3);padding-top:10px;margin-top:4px' },
      el('div', { cls: 'label', css: 'margin-bottom:6px;color:#ef4444' }, 'Danger Zone'),
      el('div', { css: 'display:flex;gap:8px' },
        el('button', { 
          cls: 'btn-sm red', 
          onclick: () => {
            Store.showModal({
              title: `Reset ${user.pin?.slice(0, 2)}/${user.pin?.slice(2, 4)}/${user.pin?.slice(4)}?`,
              message: 'Permanently deletes ALL workout data, history, and body weights for this user.',
              onConfirm: async () => {
                await Storage.adminResetUser(hash);
                if (isSelf) await Store.resetAll();
                Store.closeModal();
                await loadAdminData();
              }
            });
          } 
        }, 'Reset All Data'),
        el('button', { 
          cls: 'btn-sm', 
          onclick: () => {
            Store.showModal({
              title: 'Reset Progress Only?',
              message: 'Resets phase, week, and day back to start. Keeps workout history.',
              onConfirm: async () => {
                const s = { ...st, phase: 'rampup', rampWeek: 'Week 1', rampDayIdx: 0, mesoWeek: 1, pplIdx: 0, fatigueFlags: 0 };
                await Storage.adminSetUserData(hash, 'state', s);
                if (isSelf) { Store.state = s; await Store.setState(Store.state); }
                Store.closeModal();
                await loadAdminData();
              }
            });
          } 
        }, 'Reset Progress')
      )
    )
  );
}

/**
 * Load admin user data
 */
async function loadAdminData() {
  Store.adminLoading = true;
  if (Store.screen === 'admin') Router.render();
  
  try {
    const reg = await Storage.adminGetRegistry();
    Store.adminDiag = reg._diag || null;
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
    Store.adminUsers = reg;
  } catch (e) { 
    console.warn('Admin load failed:', e); 
    Store.adminUsers = Store.adminUsers || {}; 
  }
  
  Store.adminLoading = false;
  if (Store.screen === 'admin') Router.render();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderAdmin, loadAdminData, renderAdminUserCard };
}
