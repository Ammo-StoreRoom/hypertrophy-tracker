// ============================================
// TEMPLATES SCREEN — Template gallery & builder
// ============================================

/**
 * UI State for templates screen
 */
Store.templateUI = {
  mode: 'gallery', // 'gallery' | 'builder' | 'preview'
  selectedTemplate: null,
  editingTemplate: null,
  activeTab: 'all', // 'all' | 'builtin' | 'custom'
  searchQuery: ''
};

/**
 * Render the templates screen
 * @returns {HTMLElement} Templates screen element
 */
function renderTemplates() {
  const ui = Store.templateUI;

  if (ui.mode === 'builder') {
    return renderTemplateBuilder();
  }
  
  if (ui.mode === 'preview') {
    return renderTemplatePreview();
  }

  return renderTemplateGallery();
}

/**
 * Render template gallery view
 */
function renderTemplateGallery() {
  const ui = Store.templateUI;
  
  return el('div', { cls: 'screen' }, renderModal && renderModal(),
    // Header
    el('div', { cls: 'header' },
      el('h1', null, 'TEMPLATES'),
      el('div', { cls: 'sub' }, 'Workout programs & templates')
    ),

    // Search and filter
    el('div', { cls: 'card', css: 'padding:12px 14px' },
      el('div', { css: 'display:flex;gap:8px;margin-bottom:12px' },
        el('input', {
          type: 'text',
          cls: 'set-input',
          css: 'text-align:left;padding-left:12px;flex:1',
          placeholder: 'Search templates...',
          value: ui.searchQuery,
          oninput: (e) => {
            ui.searchQuery = e.target.value;
            Router.render();
          }
        }),
        el('button', {
          cls: 'btn-sm green',
          onclick: () => startCreateTemplate()
        }, '+ New')
      ),
      
      // Filter tabs
      el('div', { css: 'display:flex;gap:6px' },
        ...[['all', 'All'], ['builtin', 'Built-in'], ['custom', 'My Templates']].map(([tab, label]) =>
          el('button', {
            cls: `btn-sm ${ui.activeTab === tab ? 'green' : 'muted'}`,
            css: 'flex:1',
            onclick: () => {
              ui.activeTab = tab;
              Router.render();
            }
          }, label)
        )
      )
    ),

    // Template cards
    renderTemplateCards(),

    // Import section
    el('div', { cls: 'card', css: 'margin-top:20px' },
      el('div', { cls: 'label', css: 'margin-bottom:10px' }, 'Import / Export'),
      el('div', { css: 'display:flex;gap:8px' },
        el('button', {
          cls: 'btn-ghost',
          css: 'flex:1',
          onclick: importTemplates
        }, 'Import JSON'),
        el('button', {
          cls: 'btn-ghost',
          css: 'flex:1',
          onclick: exportAllTemplates
        }, 'Export All')
      )
    ),

    renderNav()
  );
}

/**
 * Render template cards grid
 */
function renderTemplateCards() {
  const ui = Store.templateUI;
  
  // Get templates based on active tab
  let templates = [];
  const builtinValues = Object.values(Templates.BUILT_IN);
  
  if (ui.activeTab === 'all' || ui.activeTab === 'builtin') {
    templates = [...templates, ...builtinValues.map(t => ({ ...t, isBuiltin: true }))];
  }
  
  // Get user templates asynchronously
  const userTemplatesPromise = Templates.getAll().then(all => {
    const user = all.filter(t => t.source !== 'builtin');
    if (ui.activeTab === 'all' || ui.activeTab === 'custom') {
      return user.map(t => ({ ...t, isBuiltin: false }));
    }
    return [];
  });

  // For initial render, show what's available synchronously
  let displayTemplates = templates;
  
  // Filter by search query
  if (ui.searchQuery) {
    const query = ui.searchQuery.toLowerCase();
    displayTemplates = displayTemplates.filter(t => 
      t.name.toLowerCase().includes(query) ||
      (t.description && t.description.toLowerCase().includes(query)) ||
      (t.tags && t.tags.some(tag => tag.toLowerCase().includes(query)))
    );
  }

  if (displayTemplates.length === 0) {
    return el('div', { cls: 'card', css: 'text-align:center;padding:40px 20px' },
      el('div', { css: 'font-size:48px;margin-bottom:12px' }, '📋'),
      el('div', { css: 'color:var(--dim);font-size:14px' }, 
        ui.searchQuery ? 'No templates match your search' : 'No templates found'
      )
    );
  }

  return el('div', { css: 'display:flex;flex-direction:column;gap:10px;padding:0 14px' },
    ...displayTemplates.map(template => renderTemplateCard(template))
  );
}

/**
 * Render a single template card
 */
function renderTemplateCard(template) {
  const exerciseCount = template.days.reduce((sum, day) => sum + (day.exercises?.length || 0), 0);
  const dayCount = template.days.length;
  
  return el('div', { 
    cls: 'card',
    css: 'cursor:pointer;transition:transform .1s',
    onclick: () => previewTemplate(template.id)
  },
    el('div', { css: 'display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px' },
      el('div', null,
        el('div', { css: 'font-size:16px;font-weight:700;color:var(--white)' }, template.name),
        el('div', { css: 'font-size:12px;color:var(--dim);margin-top:2px' }, 
          template.description || 'No description'
        )
      ),
      template.isBuiltin 
        ? el('span', { 
            cls: 'badge',
            css: 'background:var(--blue);font-size:9px'
          }, 'Built-in')
        : el('div', { css: 'display:flex;gap:4px' },
            el('button', {
              cls: 'btn-sm',
              onclick: (e) => {
                e.stopPropagation();
                duplicateTemplate(template.id);
              }
            }, 'Copy'),
            !template.isBuiltin && el('button', {
              cls: 'btn-sm red',
              onclick: (e) => {
                e.stopPropagation();
                deleteTemplateConfirm(template.id);
              }
            }, '✕')
          )
    ),
    
    // Stats
    el('div', { css: 'display:flex;gap:16px;margin:12px 0;font-size:12px;color:var(--dim)' },
      el('span', null, `📅 ${dayCount} ${dayCount === 1 ? 'day' : 'days'}`),
      el('span', null, `💪 ${exerciseCount} exercises`),
      template.type === 'program' && el('span', { css: 'color:var(--green)' }, 'Program')
    ),
    
    // Tags
    template.tags && template.tags.length > 0 && el('div', { css: 'display:flex;gap:4px;flex-wrap:wrap;margin-top:8px' },
      ...template.tags.slice(0, 4).map(tag =>
        el('span', {
          css: 'font-size:10px;background:var(--input-bg);color:var(--dim);padding:2px 8px;border-radius:10px'
        }, tag)
      )
    ),
    
    // Actions
    el('div', { css: 'display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--card-border)' },
      el('button', {
        cls: 'btn',
        css: 'flex:1;font-size:12px;padding:10px',
        onclick: (e) => {
          e.stopPropagation();
          applyTemplate(template.id);
        }
      }, template.type === 'program' ? 'Use Program' : 'Use Template'),
      !template.isBuiltin && el('button', {
        cls: 'btn-ghost',
        css: 'flex:1;font-size:12px;padding:10px',
        onclick: (e) => {
          e.stopPropagation();
          editTemplate(template.id);
        }
      }, 'Edit')
    )
  );
}

/**
 * Render template preview view
 */
function renderTemplatePreview() {
  const ui = Store.templateUI;
  const template = ui.selectedTemplate;
  
  if (!template) {
    return renderTemplateGallery();
  }

  const exerciseCount = template.days.reduce((sum, day) => sum + (day.exercises?.length || 0), 0);

  return el('div', { cls: 'screen' }, renderModal && renderModal(),
    // Header with back button
    el('div', { cls: 'header' },
      el('div', { css: 'display:flex;align-items:center;gap:12px' },
        el('button', {
          cls: 'btn-sm',
          onclick: () => {
            ui.mode = 'gallery';
            ui.selectedTemplate = null;
            Router.render();
          }
        }, '← Back'),
        el('div', null,
          el('h1', null, template.name),
          el('div', { cls: 'sub' }, 'Template Preview')
        )
      )
    ),

    // Template info
    el('div', { cls: 'card' },
      el('div', { css: 'font-size:14px;color:var(--dim);margin-bottom:12px' },
        template.description || 'No description provided'
      ),
      el('div', { css: 'display:flex;gap:16px;font-size:13px;color:var(--white)' },
        el('span', null, el('strong', null, template.days.length), ' days'),
        el('span', null, el('strong', null, exerciseCount), ' exercises'),
        el('span', { css: 'color:var(--accent)' }, template.type === 'program' ? 'Full Program' : 'Single Workout')
      ),
      template.tags && template.tags.length > 0 && el('div', { css: 'display:flex;gap:4px;flex-wrap:wrap;margin-top:12px' },
        ...template.tags.map(tag =>
          el('span', {
            css: 'font-size:10px;background:var(--input-bg);color:var(--dim);padding:3px 10px;border-radius:10px'
          }, tag)
        )
      )
    ),

    // Days preview
    ...template.days.map((day, idx) =>
      el('div', { cls: 'card' },
        el('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px' },
          el('div', { css: 'font-size:14px;font-weight:700;color:var(--white)' }, 
            day.dayLabel || `Day ${idx + 1}`
          ),
          el('div', { css: 'font-size:12px;color:var(--dim)' }, 
            `${day.exercises?.length || 0} exercises`
          )
        ),
        el('div', { css: 'display:flex;flex-direction:column;gap:6px' },
          ...(day.exercises || []).map(ex =>
            el('div', { 
              css: 'display:flex;justify-content:space-between;align-items:center;padding:8px;background:var(--input-bg);border-radius:6px;font-size:12px'
            },
              el('span', { css: 'color:var(--white);font-weight:600' }, ex.name),
              el('span', { css: 'color:var(--dim);font-family:var(--mono)' }, 
                `${ex.sets} × ${ex.reps}`
              )
            )
          )
        )
      )
    ),

    // Apply actions
    el('div', { cls: 'card', css: 'position:sticky;bottom:80px;background:var(--card);z-index:10' },
      el('div', { css: 'display:flex;gap:8px' },
        el('button', {
          cls: 'btn',
          css: 'flex:1',
          onclick: () => applyTemplate(template.id)
        }, template.type === 'program' ? 'Start This Program' : 'Use This Template'),
        !template.isBuiltin && el('button', {
          cls: 'btn-ghost',
          onclick: () => editTemplate(template.id)
        }, 'Edit')
      ),
      template.type === 'program' && el('div', { css: 'font-size:11px;color:var(--dim);margin-top:10px;text-align:center' },
        'This will replace your current program. Your workout history will be preserved.'
      )
    ),

    renderNav()
  );
}

/**
 * Render template builder view
 */
function renderTemplateBuilder() {
  const ui = Store.templateUI;
  const template = ui.editingTemplate;
  
  if (!template) {
    return renderTemplateGallery();
  }

  const isNew = !template.id || Templates.BUILT_IN[template.id];

  return el('div', { cls: 'screen' }, renderModal && renderModal(),
    // Header
    el('div', { cls: 'header' },
      el('div', { css: 'display:flex;align-items:center;gap:12px' },
        el('button', {
          cls: 'btn-sm',
          onclick: () => {
            if (confirm('Discard changes?')) {
              ui.mode = 'gallery';
              ui.editingTemplate = null;
              Router.render();
            }
          }
        }, '← Cancel'),
        el('div', null,
          el('h1', null, isNew ? 'New Template' : 'Edit Template'),
          el('div', { cls: 'sub' }, 'Build your custom workout')
        )
      )
    ),

    // Template info form
    el('div', { cls: 'card' },
      el('div', { css: 'margin-bottom:12px' },
        el('div', { cls: 'label', css: 'margin-bottom:6px' }, 'Template Name'),
        el('input', {
          type: 'text',
          cls: 'set-input',
          css: 'text-align:left;padding-left:12px',
          placeholder: 'e.g., My Custom PPL',
          value: template.name || '',
          oninput: (e) => {
            template.name = e.target.value;
          }
        })
      ),
      el('div', { css: 'margin-bottom:12px' },
        el('div', { cls: 'label', css: 'margin-bottom:6px' }, 'Description'),
        el('input', {
          type: 'text',
          cls: 'set-input',
          css: 'text-align:left;padding-left:12px',
          placeholder: 'Brief description...',
          value: template.description || '',
          oninput: (e) => {
            template.description = e.target.value;
          }
        })
      ),
      el('div', null,
        el('div', { cls: 'label', css: 'margin-bottom:6px' }, 'Type'),
        el('div', { css: 'display:flex;gap:8px' },
          el('button', {
            cls: `btn-ghost ${template.type !== 'program' ? '' : 'muted'}`,
            css: template.type !== 'program' ? 'border-color:var(--accent);color:var(--accent)' : '',
            onclick: () => {
              template.type = 'template';
              Router.render();
            }
          }, 'Single Workout'),
          el('button', {
            cls: `btn-ghost ${template.type === 'program' ? '' : 'muted'}`,
            css: template.type === 'program' ? 'border-color:var(--accent);color:var(--accent)' : '',
            onclick: () => {
              template.type = 'program';
              Router.render();
            }
          }, 'Multi-Day Program')
        )
      )
    ),

    // Days editor
    ...template.days.map((day, dayIdx) => renderDayEditor(day, dayIdx, template)),

    // Add day button
    el('div', { css: 'padding:0 14px 20px' },
      el('button', {
        cls: 'btn-ghost',
        css: 'width:100%;padding:14px',
        onclick: () => addDay(template)
      }, '+ Add Day')
    ),

    // Save button
    el('div', { cls: 'card', css: 'position:sticky;bottom:80px;background:var(--card);z-index:10' },
      el('button', {
        cls: 'btn',
        onclick: () => saveTemplate(template)
      }, isNew ? 'Create Template' : 'Save Changes')
    ),

    renderNav()
  );
}

/**
 * Render a day editor section
 */
function renderDayEditor(day, dayIdx, template) {
  return el('div', { cls: 'card' },
    // Day header
    el('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px' },
      el('div', { css: 'flex:1;margin-right:10px' },
        el('div', { cls: 'label', css: 'margin-bottom:4px' }, `Day ${dayIdx + 1} Name`),
        el('input', {
          type: 'text',
          cls: 'set-input',
          css: 'text-align:left;padding-left:10px;font-size:14px',
          value: day.dayLabel || '',
          oninput: (e) => {
            day.dayLabel = e.target.value;
          }
        })
      ),
      template.days.length > 1 && el('button', {
        cls: 'btn-sm red',
        onclick: () => removeDay(template, dayIdx)
      }, 'Remove Day')
    ),

    // Exercises
    el('div', { css: 'display:flex;flex-direction:column;gap:8px' },
      ...(day.exercises || []).map((ex, exIdx) => 
        renderExerciseEditor(ex, exIdx, day, template)
      )
    ),

    // Add exercise button
    el('button', {
      cls: 'btn-ghost muted',
      css: 'width:100%;margin-top:12px;padding:10px;font-size:12px',
      onclick: () => addExercise(day)
    }, '+ Add Exercise')
  );
}

/**
 * Render an exercise editor row
 */
function renderExerciseEditor(ex, exIdx, day, template) {
  return el('div', { 
    cls: 'card',
    css: 'margin:0;padding:12px;background:var(--input-bg);border:1px solid var(--card-border)'
  },
    el('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px' },
      el('span', { css: 'font-size:12px;color:var(--dim);font-weight:600' }, `Exercise ${exIdx + 1}`),
      el('button', {
        cls: 'btn-sm red',
        css: 'padding:4px 8px;font-size:10px',
        onclick: () => removeExercise(day, exIdx)
      }, 'Remove')
    ),
    
    // Exercise name
    el('input', {
      type: 'text',
      cls: 'set-input',
      css: 'text-align:left;padding-left:10px;margin-bottom:10px',
      placeholder: 'Exercise name...',
      value: ex.name || '',
      oninput: (e) => {
        ex.name = e.target.value;
      }
    }),

    // Sets, reps, rest row
    el('div', { css: 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px' },
      el('div', null,
        el('div', { cls: 'label', css: 'margin-bottom:4px;font-size:9px' }, 'Sets'),
        el('input', {
          type: 'number',
          cls: 'set-input',
          value: ex.sets || 3,
          oninput: (e) => {
            ex.sets = parseInt(e.target.value) || 1;
          }
        })
      ),
      el('div', null,
        el('div', { cls: 'label', css: 'margin-bottom:4px;font-size:9px' }, 'Reps'),
        el('input', {
          type: 'text',
          cls: 'set-input',
          value: ex.reps || '8-10',
          oninput: (e) => {
            ex.reps = e.target.value;
          }
        })
      ),
      el('div', null,
        el('div', { cls: 'label', css: 'margin-bottom:4px;font-size:9px' }, 'Rest (sec)'),
        el('input', {
          type: 'number',
          cls: 'set-input',
          value: ex.rest || 90,
          step: 15,
          oninput: (e) => {
            ex.rest = parseInt(e.target.value) || 0;
          }
        })
      )
    ),

    // Notes
    el('input', {
      type: 'text',
      cls: 'set-input',
      css: 'text-align:left;padding-left:10px;margin-top:10px;font-size:12px',
      placeholder: 'Notes (optional)...',
      value: ex.notes || '',
      oninput: (e) => {
        ex.notes = e.target.value;
      }
    })
  );
}

// ============================================
// ACTIONS
// ============================================

function startCreateTemplate() {
  Store.templateUI.editingTemplate = {
    name: '',
    description: '',
    type: 'template',
    days: [Templates.createEmptyDay()]
  };
  Store.templateUI.mode = 'builder';
  Router.render();
}

async function editTemplate(id) {
  const template = await Templates.get(id);
  if (template) {
    // Make editable copy
    Store.templateUI.editingTemplate = JSON.parse(JSON.stringify(template));
    Store.templateUI.mode = 'builder';
    Router.render();
  }
}

async function previewTemplate(id) {
  const template = await Templates.get(id);
  if (template) {
    Store.templateUI.selectedTemplate = template;
    Store.templateUI.mode = 'preview';
    Router.render();
  }
}

async function duplicateTemplate(id) {
  try {
    await Templates.duplicate(id);
    Store.showModal?.({
      title: 'Success',
      message: 'Template duplicated successfully'
    }) || alert('Template duplicated successfully');
    Router.render();
  } catch (e) {
    Store.showModal?.({
      title: 'Error',
      message: e.message
    }) || alert(e.message);
  }
}

function deleteTemplateConfirm(id) {
  const confirmDelete = () => {
    Templates.delete(id).then(() => {
      Router.render();
    }).catch(e => {
      alert(e.message);
    });
  };

  if (Store.showModal) {
    Store.showModal({
      title: 'Delete Template?',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: confirmDelete
    });
  } else if (confirm('Delete this template? This cannot be undone.')) {
    confirmDelete();
  }
}

function addDay(template) {
  template.days.push(Templates.createEmptyDay());
  Router.render();
}

function removeDay(template, idx) {
  if (confirm('Remove this day?')) {
    template.days.splice(idx, 1);
    Router.render();
  }
}

function addExercise(day) {
  if (!day.exercises) day.exercises = [];
  day.exercises.push(Templates.createEmptyExercise());
  Router.render();
}

function removeExercise(day, idx) {
  day.exercises.splice(idx, 1);
  Router.render();
}

async function saveTemplate(template) {
  // Ensure all days have exercises array
  template.days.forEach(day => {
    if (!day.exercises) day.exercises = [];
  });

  // Validate
  const validation = Templates.validateTemplate(template);
  if (!validation.valid) {
    Store.showModal?.({
      title: 'Validation Error',
      message: validation.errors.join('\n')
    }) || alert(validation.errors.join('\n'));
    return;
  }

  try {
    await Templates.save(template);
    Store.templateUI.mode = 'gallery';
    Store.templateUI.editingTemplate = null;
    Router.render();
  } catch (e) {
    Store.showModal?.({
      title: 'Error',
      message: e.message
    }) || alert(e.message);
  }
}

async function applyTemplate(templateId) {
  const template = await Templates.get(templateId);
  if (!template) return;

  const doApply = async () => {
    try {
      await Templates.applyToProgram(templateId, {
        startFromRampup: true
      });
      
      // Update app state if it's a program
      if (template.type === 'program') {
        // Store the custom program data temporarily
        Store.customProgram = template;
        Store.state.phase = 'rampup';
        Store.state.rampWeek = 'Week 1';
        Store.state.rampDayIdx = 0;
        await Store.setState(Store.state);
      }
      
      Store.showModal?.({
        title: 'Success',
        message: `${template.name} has been applied. Go to Home to start your workout.`,
        onConfirm: () => {
          Store.screen = 'home';
          Router.render();
        }
      }) || alert(`${template.name} applied!`);
    } catch (e) {
      Store.showModal?.({
        title: 'Error',
        message: e.message
      }) || alert(e.message);
    }
  };

  if (Store.showModal) {
    Store.showModal({
      title: `Use ${template.name}?`,
      message: template.type === 'program' 
        ? 'This will replace your current program. You can always switch back in Settings.'
        : 'This template will be available for your next workout.',
      confirmLabel: template.type === 'program' ? 'Start Program' : 'Use Template',
      onConfirm: doApply
    });
  } else if (confirm(`Use ${template.name}?`)) {
    doApply();
  }
}

async function importTemplates() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const imported = await Templates.importFromJSON(text);
      
      Store.showModal?.({
        title: 'Import Successful',
        message: `Imported ${imported.length} template(s)`
      }) || alert(`Imported ${imported.length} template(s)`);
      
      Router.render();
    } catch (err) {
      Store.showModal?.({
        title: 'Import Failed',
        message: err.message
      }) || alert('Import failed: ' + err.message);
    }
  };
  
  input.click();
}

async function exportAllTemplates() {
  try {
    const json = await Templates.exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hypertrophy-templates-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('Export failed: ' + e.message);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderTemplates };
}
