// ============================================
// SETTINGS SCREEN — App configuration & Data Management
// ============================================

/**
 * Render the settings screen
 * @returns {HTMLElement} Settings screen element
 */
function renderSettings() {
  const notifStatus = !('Notification' in window) ? 'unsupported' : Notification.permission;

  return el('div', { cls: 'screen screen-grid' }, renderModal(),
    // Header
    el('div', { cls: 'header' }, 
      el('h1', null, 'SETTINGS'), 
      el('div', { cls: 'sub' }, 'Program & preferences')
    ),

    // Theme
    el('div', { cls: 'card' },
      el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Theme'),
      el('div', { cls: 'theme-toggle' },
        ...['dark', 'light', 'auto'].map(t =>
          el('button', { 
            cls: Store.theme === t ? 'active' : '', 
            onclick: () => { Store.setTheme(t); Router.render(); } 
          }, t[0].toUpperCase() + t.slice(1))
        )
      )
    ),

    // Units
    el('div', { cls: 'card' },
      el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Weight Units'),
      el('div', { cls: 'theme-toggle' },
        ...['lbs', 'kg'].map(u =>
          el('button', { 
            cls: (Store.state.units || 'lbs') === u ? 'active' : '', 
            onclick: async () => { 
              Store.state.units = u; 
              await Store.setState(Store.state); 
            } 
          }, u.toUpperCase())
        )
      )
    ),

    // Notifications
    el('div', { cls: 'card' },
      el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Rest Timer Notifications'),
      notifStatus === 'granted'
        ? el('div', { css: 'font-size:13px;color:var(--green);font-weight:600' }, '✓ Enabled')
        : notifStatus === 'denied'
          ? el('div', { css: 'font-size:13px;color:var(--accent)' }, 'Blocked — enable in browser settings')
          : notifStatus === 'unsupported'
            ? el('div', { css: 'font-size:13px;color:var(--dim)' }, 'Not supported in this browser')
            : el('button', { 
                cls: 'btn-ghost', 
                onclick: async () => { 
                  await requestNotifPermission(); 
                  Router.render(); 
                } 
              }, 'Enable Notifications')
    ),

    // Program selection
    renderProgramSelection(),

    // Phase selection
    renderPhaseSelection(),

    // Custom exercises
    renderCustomExercises(),

    // === TEMPLATES SECTION ===
    renderTemplatesSection(),

    // === DATA MANAGEMENT SECTION ===
    renderDataManagement(),

    // === BACKUP & EXPORT SECTION ===
    renderBackupSection(),

    // === IMPORT SECTION ===
    renderImportSection(),

    // Account
    el('div', { cls: 'card full-width' },
      el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Account'),
      el('button', { cls: 'btn-ghost muted', onclick: doLogout }, 'Log Out'),
      el('div', { css: 'font-size:10px;color:var(--dim);margin-top:8px' },
        `PIN: ${Storage.getPin()?.slice(0, 2)}/${Storage.getPin()?.slice(2, 4)}/${Storage.getPin()?.slice(4) || ''}`
      )
    ),

    // Developer
    el('div', { cls: 'card full-width' },
      el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Developer'),
      el('button', { 
        cls: 'btn-ghost', 
        onclick: () => { window.open('test/index.html', '_blank'); }
      }, '🧪 Run Tests'),
      el('div', { css: 'font-size:10px;color:var(--dim);margin-top:8px' },
        'Run unit tests to verify app functionality'
      )
    ),

    renderNav()
  );
}

/**
 * Render program selection section
 */
function renderProgramSelection() {
  return el('div', { cls: 'card full-width' },
    el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Workout Program'),
    el('div', { css: 'display:flex;gap:8px;flex-wrap:wrap' },
      ...Store.ALL_PROGRAMS
        .filter(([k]) => (Store.state.allowedPrograms || ['standard', 'glute-focus']).includes(k))
        .map(([k, l]) =>
          el('button', { 
            cls: `btn-ghost ${Store.state.program === k ? '' : 'muted'}`,
            css: Store.state.program === k ? 'border-color:var(--accent);color:var(--accent)' : null,
            onclick: async () => { 
              Store.state.program = k; 
              Store.state.phase = 'rampup'; 
              Store.state.rampWeek = 'Week 1'; 
              Store.state.rampDayIdx = 0; 
              Store.state.mesoWeek = 1; 
              Store.state.pplIdx = 0; 
              await Store.setState(Store.state); 
            } 
          }, l)
        )
    ),
    el('div', { css: 'font-size:11px;color:var(--dim);margin-top:8px' },
      Store.state.program === 'glute-focus' 
        ? 'Lower-body & glute emphasis with extra hip thrust and RDL volume' 
        : 'Balanced push/pull/legs with strength focus'
    )
  );
}

/**
 * Render phase selection section
 */
function renderPhaseSelection() {
  return el('div', null,
    // Phase toggle
    el('div', { cls: 'card full-width' },
      el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Program Phase'),
      el('div', { css: 'display:flex;gap:8px' },
        ...[['rampup', 'Ramp-Up'], ['ppl', 'Full PPL']].map(([p, l]) =>
          el('button', { 
            cls: `btn-ghost ${Store.state.phase === p ? '' : 'muted'}`,
            css: Store.state.phase === p 
              ? `border-color:${p === 'rampup' ? 'var(--accent)' : 'var(--green)'};color:${p === 'rampup' ? 'var(--accent)' : 'var(--green)'}` 
              : null,
            onclick: async () => { 
              Store.state.phase = p; 
              Store.state.rampDayIdx = 0; 
              await Store.setState(Store.state); 
            } 
          }, l)
        )
      )
    ),

    // Ramp-up specific
    Store.state.phase === 'rampup' ? 
      el('div', { cls: 'card' },
        el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Ramp-Up Week'),
        el('div', { css: 'display:flex;gap:8px' },
          ...['Week 1', 'Week 2'].map(w => 
            el('button', { 
              cls: `btn-ghost ${Store.state.rampWeek === w ? '' : 'muted'}`,
              onclick: async () => { 
                Store.state.rampWeek = w; 
                Store.state.rampDayIdx = 0; 
                await Store.setState(Store.state); 
              } 
            }, w)
          )
        )
      ) : null,

    Store.state.phase === 'rampup' ? 
      el('div', { cls: 'card' },
        el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Next Day'),
        el('div', { css: 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px' },
          ...Object.keys(Store.getProgram().rampup[Store.state.rampWeek] || {}).map((d, i) => 
            el('button', { 
              cls: `btn-ghost ${Store.state.rampDayIdx === i ? '' : 'muted'}`,
              css: `font-size:10px;padding:8px 4px${Store.state.rampDayIdx === i ? ';border-color:var(--accent);color:var(--accent)' : ''}`,
              onclick: async () => { 
                Store.state.rampDayIdx = i; 
                await Store.setState(Store.state); 
              } 
            }, d.replace(/^\w+: /, ''))
          )
        )
      ) : null,

    // PPL specific
    Store.state.phase === 'ppl' ? 
      el('div', { cls: 'card' },
        el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Mesocycle Week'),
        el('div', { css: 'display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px' },
          ...[1, 2, 3, 4].map(w => 
            el('button', { 
              cls: `btn-ghost ${Store.state.mesoWeek === w ? '' : 'muted'}`,
              css: `font-size:12px;padding:8px 4px${Store.state.mesoWeek === w ? ';border-color:var(--accent);color:var(--accent)' : ''}`,
              onclick: async () => { 
                Store.state.mesoWeek = w; 
                await Store.setState(Store.state); 
              } 
            }, w === 4 ? 'Deload' : `W${w}`)
          )
        )
      ) : null,

    Store.state.phase === 'ppl' ? 
      el('div', { cls: 'card' },
        el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Next Day'),
        el('div', { css: 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px' },
          ...Store.getProgram().ppl.map((p, i) => 
            el('button', { 
              cls: `btn-ghost ${Store.state.pplIdx === i ? '' : 'muted'}`,
              css: `font-size:11px;padding:8px 4px${Store.state.pplIdx === i ? ';border-color:var(--accent);color:var(--accent)' : ''}`,
              onclick: async () => { 
                Store.state.pplIdx = i; 
                await Store.setState(Store.state); 
              } 
            }, p.label)
          )
        )
      ) : null
  );
}

/**
 * Render custom exercises section
 */
function renderCustomExercises() {
  return el('div', { cls: 'card full-width' },
    el('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px' },
      el('div', { cls: 'label' }, 'Custom Exercises'),
      el('button', { cls: 'btn-sm green', onclick: showAddCustomExercise }, '+ Add')
    ),
    (Store.state.customExercises || []).length ? 
      el('div', null,
        ...(Store.state.customExercises || []).map((ce, ci) => 
          el('div', { css: 'display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--card-border)' },
            el('div', null,
              el('div', { css: 'font-size:13px;color:var(--white);font-weight:600' }, ce.name),
              el('div', { css: 'font-size:10px;color:var(--dim)' }, `${ce.group} • ${ce.sets}x${ce.reps}`)
            ),
            el('button', { 
              cls: 'btn-sm red', 
              onclick: async () => {
                Store.state.customExercises.splice(ci, 1); 
                await Store.setState(Store.state); 
              } 
            }, '✕')
          )
        )
      ) : 
      el('div', { css: 'font-size:12px;color:var(--dim)' }, 'No custom exercises')
  );
}

// ============================================
// TEMPLATES SECTION
// ============================================

/**
 * Render templates management section
 */
function renderTemplatesSection() {
  return el('div', { cls: 'card full-width' },
    el('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px' },
      el('div', { cls: 'label' }, 'Workout Templates'),
      el('button', { 
        cls: 'btn-sm green', 
        onclick: () => {
          Store.templateUI = { mode: 'gallery', selectedTemplate: null, editingTemplate: null, activeTab: 'all', searchQuery: '' };
          Router.navigate('templates');
        }
      }, 'Open Gallery')
    ),
    el('div', { css: 'font-size:12px;color:var(--dim);margin-bottom:12px' },
      'Browse built-in programs, create custom templates, and manage your workout library.'
    ),
    el('div', { css: 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px' },
      el('button', { 
        cls: 'btn-ghost', 
        css: 'flex:1;font-size:12px',
        onclick: () => {
          Store.templateUI = { mode: 'gallery', selectedTemplate: null, editingTemplate: null, activeTab: 'builtin', searchQuery: '' };
          Router.navigate('templates');
        }
      }, 'Browse Built-in'),
      el('button', { 
        cls: 'btn-ghost', 
        css: 'flex:1;font-size:12px',
        onclick: () => {
          Store.templateUI = { mode: 'gallery', selectedTemplate: null, editingTemplate: null, activeTab: 'custom', searchQuery: '' };
          Router.navigate('templates');
        }
      }, 'My Templates')
    ),
    // Quick template stats
    el('div', { css: 'display:flex;gap:16px;padding-top:12px;border-top:1px solid var(--card-border)' },
      el('div', { css: 'text-align:center;flex:1' },
        el('div', { css: 'font-size:20px;font-weight:800;color:var(--accent);font-family:var(--mono)' }, 
          String(Object.keys(Templates.BUILT_IN).length)
        ),
        el('div', { css: 'font-size:10px;color:var(--dim)' }, 'Built-in')
      ),
      el('div', { css: 'text-align:center;flex:1' },
        el('div', { 
          id: 'user-template-count',
          css: 'font-size:20px;font-weight:800;color:var(--green);font-family:var(--mono)'
        }, '—'),
        el('div', { css: 'font-size:10px;color:var(--dim)' }, 'Custom')
      )
    )
  );
}

// ============================================
// DATA MANAGEMENT SECTION
// ============================================

/**
 * Render data management card
 */
function renderDataManagement() {
  return el('div', { cls: 'card full-width' },
    el('div', { cls: 'label', css: 'margin-bottom:12px' }, 'Export Data'),
    
    // Export buttons grid
    el('div', { css: 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px' },
      el('button', { 
        cls: 'btn-ghost', 
        onclick: () => showExportModal('json') 
      }, '📄 JSON'),
      el('button', { 
        cls: 'btn-ghost', 
        onclick: () => showExportModal('csv') 
      }, '📊 CSV'),
      el('button', { 
        cls: 'btn-ghost', 
        onclick: () => showExportModal('pdf') 
      }, '📑 PDF Report'),
      el('button', { 
        cls: 'btn-ghost', 
        onclick: () => showGoogleSheetsModal() 
      }, '📈 Google Sheets')
    ),
    
    // Data stats
    el('div', { css: 'background:var(--input-bg);border-radius:8px;padding:10px;margin-top:10px' },
      el('div', { css: 'font-size:11px;color:var(--dim);margin-bottom:6px' }, 'Current Data:'),
      el('div', { css: 'display:flex;justify-content:space-between;font-size:13px;color:var(--white)' },
        el('span', null, `Workouts: ${Store.history?.length || 0}`),
        el('span', null, `Body weights: ${Store.bodyWeights?.length || 0}`)
      ),
      el('div', { css: 'display:flex;justify-content:space-between;font-size:13px;color:var(--white);margin-top:4px' },
        el('span', null, `Measurements: ${Store.measurements?.length || 0}`)
      )
    )
  );
}

// ============================================
// BACKUP SECTION
// ============================================

/**
 * Render backup section
 */
function renderBackupSection() {
  const backups = Backup?.listBackups?.() || [];
  const hasBackups = backups.length > 0;

  return el('div', { cls: 'card full-width' },
    el('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px' },
      el('div', { cls: 'label' }, 'Backups & Restore'),
      el('button', { 
        cls: 'btn-sm green', 
        onclick: async () => {
          try {
            const backup = await Backup.createBackup('full');
            Store.showModal({
              title: 'Backup Created',
              message: `Backup saved with ${backup.data.stats.workoutCount} workouts`,
              confirmLabel: 'OK'
            });
            Router.render();
          } catch (e) {
            Store.showModal({
              title: 'Backup Failed',
              message: e.message,
              confirmLabel: 'OK'
            });
          }
        }
      }, '💾 Create Now')
    ),

    // Auto-backup toggle
    el('div', { css: 'display:flex;gap:6px;margin-bottom:12px' },
      el('button', { 
        cls: 'btn-ghost muted',
        css: 'flex:1;font-size:12px;padding:8px',
        onclick: () => showBackupScheduleModal()
      }, '⚙️ Auto-Backup Settings')
    ),

    // Backup list
    hasBackups ? 
      el('div', { css: 'max-height:200px;overflow-y:auto' },
        ...backups.slice(0, 5).map(b => 
          el('div', { 
            key: b.id,
            css: 'display:flex;justify-content:space-between;align-items:center;padding:8px;background:var(--input-bg);border-radius:6px;margin-bottom:6px'
          },
            el('div', null,
              el('div', { css: 'font-size:12px;color:var(--white);font-weight:600' }, b.formattedDate),
              el('div', { css: 'font-size:10px;color:var(--dim)' }, `${b.type} • ${b.formattedSize}`)
            ),
            el('div', { css: 'display:flex;gap:4px' },
              el('button', { 
                cls: 'btn-sm blue',
                css: 'font-size:10px;padding:4px 8px',
                onclick: () => showRestoreModal(b.id)
              }, 'Restore'),
              el('button', { 
                cls: 'btn-sm red',
                css: 'font-size:10px;padding:4px 8px',
                onclick: async () => {
                  Backup.deleteBackup(b.id);
                  Router.render();
                }
              }, '×')
            )
          )
        ),
        backups.length > 5 ? 
          el('div', { css: 'text-align:center;font-size:11px;color:var(--dim);padding:4px' },
            `... and ${backups.length - 5} more backups`
          ) : null
      ) :
      el('div', { css: 'text-align:center;padding:20px;color:var(--dim);font-size:12px' },
        'No backups yet. Create one to protect your data.'
      )
  );
}

// ============================================
// IMPORT SECTION
// ============================================

/**
 * Render import section
 */
function renderImportSection() {
  return el('div', { cls: 'card full-width' },
    el('div', { cls: 'label', css: 'margin-bottom:12px' }, 'Import Data'),
    
    el('div', { css: 'display:grid;grid-template-columns:1fr 1fr;gap:8px' },
      el('button', { 
        cls: 'btn-ghost', 
        onclick: () => showImportModal('json')
      }, '📄 Import JSON'),
      el('button', { 
        cls: 'btn-ghost', 
        onclick: () => showImportModal('csv')
      }, '📊 Import CSV')
    ),
    
    el('div', { css: 'font-size:10px;color:var(--dim);margin-top:10px;line-height:1.4' },
      'Imports are merged with existing data. Duplicates are detected automatically.'
    )
  );
}

// ============================================
// MODALS & DIALOGS
// ============================================

/**
 * Show export modal with options
 */
function showExportModal(format) {
  const isJSON = format === 'json';
  const isPDF = format === 'pdf';
  
  const content = el('div', null,
    // Format options
    isJSON ? el('div', { css: 'margin-bottom:12px' },
      el('div', { css: 'font-size:11px;color:var(--dim);margin-bottom:6px' }, 'Format:'),
      el('div', { css: 'display:flex;gap:8px' },
        el('label', { css: 'display:flex;align-items:center;gap:6px;font-size:13px;color:var(--white);cursor:pointer' },
          el('input', { type: 'radio', name: 'json-format', value: 'pretty', checked: true }),
          'Pretty (readable)'
        ),
        el('label', { css: 'display:flex;align-items:center;gap:6px;font-size:13px;color:var(--white);cursor:pointer' },
          el('input', { type: 'radio', name: 'json-format', value: 'compact' }),
          'Compact (smaller)'
        )
      )
    ) : null,
    
    // Date range
    el('div', { css: 'margin-bottom:12px' },
      el('div', { css: 'font-size:11px;color:var(--dim);margin-bottom:6px' }, 'Date Range:'),
      el('select', { id: 'export-date-range', cls: 'set-input', css: 'text-align:left' },
        el('option', { value: 'all' }, 'All time'),
        el('option', { value: '30days' }, 'Last 30 days'),
        el('option', { value: '90days' }, 'Last 90 days'),
        el('option', { value: 'year' }, 'Last year')
      )
    ),
    
    isPDF ? el('div', { css: 'margin-bottom:12px' },
      el('div', { css: 'font-size:11px;color:var(--dim);margin-bottom:6px' }, 'PDF Options:'),
      el('label', { css: 'display:flex;align-items:center;gap:6px;font-size:13px;color:var(--white);cursor:pointer' },
        el('input', { type: 'checkbox', id: 'include-charts', checked: true }),
        'Include charts (if available)'
      )
    ) : null
  );

  Store.showModal({
    title: `Export ${format.toUpperCase()}`,
    content,
    confirmLabel: 'Export',
    onConfirm: async () => {
      const rangeSelect = document.getElementById('export-date-range');
      const range = rangeSelect?.value || 'all';
      
      const dateRange = range === 'all' ? null : {
        start: getDateFromRange(range),
        end: new Date().toISOString()
      };

      try {
        if (format === 'json') {
          const pretty = document.querySelector('input[name="json-format"]:checked')?.value === 'pretty';
          await Backup.exportData('json', { pretty, dateRange });
        } else if (format === 'csv') {
          await Backup.exportData('csv', { dateRange });
        } else if (format === 'pdf') {
          await Backup.exportData('pdf', { includeCharts: true });
        }
        Store.closeModal();
      } catch (e) {
        alert('Export failed: ' + e.message);
      }
    }
  });
}

/**
 * Show Google Sheets export modal
 */
function showGoogleSheetsModal() {
  Store.showModal({
    title: 'Export to Google Sheets',
    message: 'This will download a CSV file that you can import into Google Sheets.',
    content: el('div', { css: 'margin-top:10px' },
      el('div', { css: 'background:var(--input-bg);border-radius:8px;padding:12px;font-size:12px;color:var(--dim)' },
        el('strong', { css: 'color:var(--white)' }, 'Steps:'),
        el('ol', { css: 'margin:8px 0 0 16px;line-height:1.6' },
          el('li', null, 'Download the CSV file'),
          el('li', null, 'Open Google Sheets'),
          el('li', null, 'Go to File → Import'),
          el('li', null, 'Upload the CSV file')
        )
      )
    ),
    confirmLabel: 'Download CSV',
    onConfirm: async () => {
      try {
        await Backup.exportData('csv');
        Store.closeModal();
      } catch (e) {
        alert('Export failed: ' + e.message);
      }
    }
  });
}

/**
 * Show import modal with smart options
 */
function showImportModal(format) {
  Store.showModal({
    title: `Import ${format.toUpperCase()}`,
    message: format === 'json' 
      ? 'Select a JSON backup file to import.' 
      : 'Select a CSV file exported from Hypertrophy Tracker.',
    content: el('div', { css: 'margin-top:12px' },
      el('div', { css: 'font-size:11px;color:var(--dim);margin-bottom:8px' }, 'Import Mode:'),
      el('select', { id: 'import-mode', cls: 'set-input', css: 'text-align:left;margin-bottom:12px' },
        el('option', { value: 'merge' }, 'Merge with existing (skip duplicates)'),
        el('option', { value: 'skip-duplicates' }, 'Skip all duplicates'),
        el('option', { value: 'replace' }, 'Replace all data ⚠️')
      ),
      el('input', { 
        type: 'file', 
        id: 'import-file', 
        accept: format === 'json' ? '.json' : '.csv',
        css: 'font-size:13px;color:var(--white)'
      })
    ),
    confirmLabel: 'Import',
    onConfirm: async () => {
      const fileInput = document.getElementById('import-file');
      const modeSelect = document.getElementById('import-mode');
      const file = fileInput?.files?.[0];
      
      if (!file) {
        alert('Please select a file');
        return;
      }

      const mode = modeSelect?.value || 'merge';
      
      try {
        const text = await file.text();
        let data;
        
        if (format === 'json') {
          data = JSON.parse(text);
        } else {
          // Parse CSV
          data = parseCSVToData(text);
        }

        // Validate
        const validation = Backup.validateImportData(data);
        if (!validation.valid) {
          alert('Invalid file: ' + validation.errors.join(', '));
          return;
        }

        // Detect duplicates
        const duplicates = Backup.detectDuplicates(data, Store.history || []);
        
        if (duplicates.length > 0 && mode !== 'replace') {
          Store.closeModal();
          showImportPreview(data, duplicates, mode);
          return;
        }

        // Proceed with import
        const result = await Backup.importData(data, { mode });
        Store.closeModal();
        
        Store.showModal({
          title: 'Import Complete',
          message: `Imported ${result.imported} workouts. ${result.skipped} skipped as duplicates.`,
          confirmLabel: 'OK'
        });
      } catch (e) {
        alert('Import failed: ' + e.message);
      }
    }
  });
}

/**
 * Show import preview with duplicates
 */
function showImportPreview(data, duplicates, mode) {
  const duplicateList = duplicates.slice(0, 5);
  
  const content = el('div', null,
    el('div', { css: 'background:rgba(234,88,12,.1);border:1px solid var(--orange);border-radius:8px;padding:12px;margin-bottom:12px' },
      el('div', { css: 'font-size:13px;color:var(--orange);font-weight:600' }, 
        `⚠️ ${duplicates.length} duplicate(s) detected`
      ),
      el('div', { css: 'font-size:11px;color:var(--dim);margin-top:4px' },
        'These workouts already exist in your history.'
      )
    ),
    
    el('div', { css: 'max-height:150px;overflow-y:auto;margin-bottom:12px' },
      ...duplicateList.map(d => 
        el('div', { 
          css: 'padding:8px;background:var(--input-bg);border-radius:6px;margin-bottom:6px'
        },
          el('div', { css: 'font-size:12px;color:var(--white)' }, 
            `${new Date(d.workout.date).toLocaleDateString()} - ${d.workout.dayLabel}`
          ),
          el('div', { css: 'font-size:10px;color:var(--dim)' }, d.reason)
        )
      )
    ),
    
    duplicates.length > 5 ? 
      el('div', { css: 'font-size:11px;color:var(--dim);text-align:center;margin-bottom:12px' },
        `... and ${duplicates.length - 5} more`
      ) : null,
    
    el('div', { css: 'font-size:11px;color:var(--dim)' }, 'Choose how to proceed:')
  );

  Store.showModal({
    title: 'Import Preview',
    content,
    confirmLabel: 'Skip Duplicates & Import',
    cancelLabel: 'Cancel',
    onConfirm: async () => {
      try {
        const result = await Backup.importData(data, { mode: 'skip-duplicates' });
        Store.closeModal();
        Store.showModal({
          title: 'Import Complete',
          message: `Imported ${result.imported} workouts. ${result.skipped} skipped as duplicates.`,
          confirmLabel: 'OK'
        });
      } catch (e) {
        alert('Import failed: ' + e.message);
      }
    }
  });
}

/**
 * Show restore from backup modal
 */
function showRestoreModal(backupId) {
  Store.showModal({
    title: 'Restore from Backup',
    message: 'This will replace your current data with the backup. This action cannot be undone.',
    content: el('div', { css: 'margin-top:10px;background:rgba(239,68,68,.1);border:1px solid var(--red);border-radius:8px;padding:12px' },
      el('div', { css: 'font-size:12px;color:var(--red)' }, 
        '⚠️ Your current data will be overwritten. Consider creating a backup first.'
      )
    ),
    confirmLabel: 'Restore Backup',
    onConfirm: async () => {
      try {
        await Backup.restoreFromBackup(backupId);
        Store.closeModal();
        Store.showModal({
          title: 'Restore Complete',
          message: 'Your data has been restored from backup.',
          confirmLabel: 'OK',
          onConfirm: () => {
            // Reload data
            location.reload();
          }
        });
      } catch (e) {
        alert('Restore failed: ' + e.message);
      }
    }
  });
}

/**
 * Show backup schedule settings modal
 */
function showBackupScheduleModal() {
  Store.showModal({
    title: 'Auto-Backup Settings',
    content: el('div', null,
      el('div', { css: 'font-size:11px;color:var(--dim);margin-bottom:8px' }, 'Frequency:'),
      el('select', { id: 'backup-frequency', cls: 'set-input', css: 'text-align:left' },
        el('option', { value: 'off' }, 'Off'),
        el('option', { value: 'daily' }, 'Daily'),
        el('option', { value: 'weekly' }, 'Weekly')
      ),
      el('div', { css: 'margin-top:12px;font-size:11px;color:var(--dim);line-height:1.5' },
        'Backups are stored locally on this device. Keep last 30 backups.'
      )
    ),
    confirmLabel: 'Save',
    onConfirm: () => {
      const freq = document.getElementById('backup-frequency')?.value || 'off';
      Backup.scheduleBackups(freq);
      Store.closeModal();
    }
  });
}

// ============================================
// UTILITIES
// ============================================

/**
 * Parse CSV to data object
 */
function parseCSVToData(csvText) {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV is empty');
  
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const grouped = {};
  
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].match(/("(?:[^"]|"")*"|[^,]*)/g)?.map(c => 
      c.replace(/^"|"$/g, '').replace(/""/g, '"')
    ) || [];
    
    if (cols.length < 12) continue;
    
    const [date, day, week, phase, rir, dur, exName, setNum, weight, reps, rirVal, note] = cols;
    const key = `${date}-${day}`;
    
    if (!grouped[key]) {
      grouped[key] = { 
        date, 
        dayLabel: day, 
        weekLabel: week, 
        phase, 
        rirTarget: rir, 
        duration: parseInt(dur) || 0, 
        exercises: {} 
      };
    }
    
    if (!grouped[key].exercises[exName]) {
      grouped[key].exercises[exName] = { name: exName, targetReps: '', note: note || '', sets: [] };
    }
    
    grouped[key].exercises[exName].sets.push({ weight, reps, rir: rirVal, type: 'working' });
    if (note) grouped[key].exercises[exName].note = note;
  }
  
  const history = Object.values(grouped).map(g => ({
    id: `imp-${new Date(g.date).getTime()}`,
    date: g.date,
    dayLabel: g.dayLabel,
    weekLabel: g.weekLabel,
    phase: g.phase,
    rirTarget: g.rirTarget,
    duration: g.duration,
    exercises: Object.values(g.exercises)
  }));
  
  return {
    version: '1.0',
    type: 'csv-import',
    exportedAt: new Date().toISOString(),
    history,
    stats: {
      workoutCount: history.length
    }
  };
}

/**
 * Get date from range option
 */
function getDateFromRange(range) {
  const now = new Date();
  switch (range) {
    case '30days':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    case '90days':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    case 'year':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return null;
  }
}

/**
 * Show add custom exercise modal
 */
function showAddCustomExercise() {
  const groups = Object.keys(MUSCLE_GROUPS);
  
  Store.showModal({
    title: 'Add Custom Exercise',
    content: el('div', null,
      el('div', { css: 'margin-bottom:12px' },
        el('div', { css: 'font-size:11px;color:var(--dim);margin-bottom:6px' }, 'Name:'),
        el('input', { id: 'ce-name', type: 'text', cls: 'set-input', css: 'text-align:left', placeholder: 'Exercise name' })
      ),
      el('div', { css: 'margin-bottom:12px' },
        el('div', { css: 'font-size:11px;color:var(--dim);margin-bottom:6px' }, 'Muscle Group:'),
        el('select', { id: 'ce-group', cls: 'set-input', css: 'text-align:left' },
          ...groups.map(g => el('option', { value: g }, g))
        )
      ),
      el('div', { css: 'display:flex;gap:12px' },
        el('div', { css: 'flex:1' },
          el('div', { css: 'font-size:11px;color:var(--dim);margin-bottom:6px' }, 'Sets:'),
          el('input', { id: 'ce-sets', type: 'number', cls: 'set-input', value: '3', min: '1', max: '10' })
        ),
        el('div', { css: 'flex:1' },
          el('div', { css: 'font-size:11px;color:var(--dim);margin-bottom:6px' }, 'Reps:'),
          el('input', { id: 'ce-reps', type: 'text', cls: 'set-input', value: '10-12', placeholder: 'e.g., 8-10' })
        )
      )
    ),
    confirmLabel: 'Add',
    onConfirm: async () => {
      const name = document.getElementById('ce-name')?.value?.trim();
      const group = document.getElementById('ce-group')?.value;
      const sets = document.getElementById('ce-sets')?.value;
      const reps = document.getElementById('ce-reps')?.value;
      
      if (!name) return;
      
      Store.state.customExercises = Store.state.customExercises || [];
      Store.state.customExercises.push({ name, group, sets: parseInt(sets) || 3, reps });
      await Store.setState(Store.state);
    }
  });
}

// ============================================
// LEGACY EXPORTS (kept for compatibility)
// ============================================

/**
 * Export workout history as CSV (legacy)
 */
function exportCSV() {
  showExportModal('csv');
}

/**
 * Import workout history from CSV (legacy)
 */
function importCSV() {
  showImportModal('csv');
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    renderSettings, 
    exportCSV, 
    importCSV,
    showExportModal,
    showImportModal,
    showBackupScheduleModal
  };
}
