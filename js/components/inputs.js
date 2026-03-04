// ============================================
// INPUTS — Enhanced input components and handlers
// ============================================

// ============================================
// EXERCISE AUTOCOMPLETE
// ============================================

/**
 * Fuzzy search score - matches "bp" to "Bench Press"
 * @param {string} query - Search query
 * @param {string} target - Target string to match against
 * @returns {number} Score (0 = no match, higher = better match)
 */
function fuzzyScore(query, target) {
  query = query.toLowerCase().replace(/[^a-z0-9]/g, '');
  target = target.toLowerCase();
  
  if (!query) return 0;
  if (target === query) return 1000; // Exact match
  if (target.startsWith(query)) return 900; // Starts with query
  
  // Check for acronym match (e.g., "bp" matches "Bench Press")
  const words = target.split(/\s+/);
  const acronym = words.map(w => w[0]).join('');
  if (acronym === query) return 850;
  if (acronym.startsWith(query)) return 800;
  
  // Check for consecutive character match
  let queryIdx = 0;
  let targetIdx = 0;
  let consecutiveBonus = 0;
  let matchCount = 0;
  
  while (queryIdx < query.length && targetIdx < target.length) {
    if (target[targetIdx] === query[queryIdx]) {
      matchCount++;
      if (targetIdx > 0 && target[targetIdx - 1] === query[queryIdx - 1]) {
        consecutiveBonus += 10;
      }
      queryIdx++;
    }
    targetIdx++;
  }
  
  if (matchCount === query.length) {
    return 500 + consecutiveBonus - target.length;
  }
  
  return 0;
}

/**
 * Get recent exercises from workout history
 * @param {number} limit - Max number of recent exercises to return
 * @returns {Array<{name: string, lastUsed: string, muscleGroup: string}>}
 */
function getRecentExercises(limit = 10) {
  const recent = new Map();
  const history = Store.history.slice(0, 20); // Last 20 workouts
  
  for (const workout of history) {
    for (const ex of (workout.exercises || [])) {
      if (!recent.has(ex.name)) {
        recent.set(ex.name, {
          name: ex.name,
          lastUsed: workout.date,
          muscleGroup: getMuscleGroup(ex.name)
        });
      }
      if (recent.size >= limit) break;
    }
    if (recent.size >= limit) break;
  }
  
  return Array.from(recent.values());
}

/**
 * Get all available exercises (from program data + custom exercises)
 * @returns {Array<{name: string, muscleGroup: string}>}
 */
function getAllExercises() {
  const exercises = new Set();
  const result = [];
  
  // Add from program data
  for (const [group, exList] of Object.entries(MUSCLE_GROUPS)) {
    for (const name of exList) {
      if (!exercises.has(name)) {
        exercises.add(name);
        result.push({ name, muscleGroup: group });
      }
    }
  }
  
  // Add custom exercises
  for (const custom of (Store.state?.customExercises || [])) {
    if (!exercises.has(custom.name)) {
      exercises.add(custom.name);
      result.push({ 
        name: custom.name, 
        muscleGroup: custom.group || 'Other' 
      });
    }
  }
  
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Search exercises with fuzzy matching
 * @param {string} query - Search query
 * @param {string} [muscleGroup] - Optional muscle group filter
 * @returns {Array<{name: string, muscleGroup: string, score: number}>}
 */
function searchExercises(query, muscleGroup = null) {
  const all = getAllExercises();
  const results = [];
  
  for (const ex of all) {
    if (muscleGroup && ex.muscleGroup !== muscleGroup) continue;
    
    const score = fuzzyScore(query, ex.name);
    if (score > 0) {
      results.push({ ...ex, score });
    }
  }
  
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Render exercise autocomplete dropdown
 * @param {Object} props - Component props
 * @param {string} props.value - Current value
 * @param {Function} props.onSelect - Callback when exercise selected
 * @param {Function} props.onClose - Callback to close dropdown
 * @param {HTMLElement} props.anchorEl - Element to position dropdown relative to
 * @returns {HTMLElement} Autocomplete dropdown element
 */
function renderExerciseAutocomplete({ value, onSelect, onClose, anchorEl }) {
  const recent = getRecentExercises(5);
  const muscleGroups = Object.keys(MUSCLE_GROUPS).sort();
  let selectedFilter = null;
  let searchQuery = value || '';
  
  const container = el('div', { 
    cls: 'autocomplete-container',
    onclick: e => e.stopPropagation()
  });
  
  // Search input
  const searchInput = el('input', {
    type: 'text',
    cls: 'autocomplete-search',
    placeholder: 'Search exercises...',
    value: searchQuery,
    autofocus: true,
    oninput: e => {
      searchQuery = e.target.value;
      updateResults();
    },
    onkeydown: e => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        const firstResult = container.querySelector('.autocomplete-item');
        if (firstResult) {
          firstResult.click();
        }
      }
    }
  });
  
  // Filter pills
  const filterRow = el('div', { cls: 'autocomplete-filters' },
    el('button', {
      cls: `filter-pill ${!selectedFilter ? 'active' : ''}`,
      onclick: () => { selectedFilter = null; updateResults(); }
    }, 'All'),
    ...muscleGroups.slice(0, 6).map(g => 
      el('button', {
        cls: `filter-pill ${selectedFilter === g ? 'active' : ''}`,
        onclick: () => { selectedFilter = g; updateResults(); }
      }, g)
    )
  );
  
  // Results container
  const resultsContainer = el('div', { cls: 'autocomplete-results' });
  
  container.appendChild(searchInput);
  container.appendChild(filterRow);
  container.appendChild(resultsContainer);
  
  function updateResults() {
    resultsContainer.innerHTML = '';
    
    if (!searchQuery && !selectedFilter) {
      // Show recent exercises
      if (recent.length > 0) {
        resultsContainer.appendChild(
          el('div', { cls: 'autocomplete-section' }, 'Recent')
        );
        for (const ex of recent) {
          resultsContainer.appendChild(createExerciseItem(ex));
        }
      }
      
      // Show popular exercises
      resultsContainer.appendChild(
        el('div', { cls: 'autocomplete-section' }, 'Popular')
      );
      const popular = ['Barbell Bench Press', 'Barbell Back Squat', 'Romanian Deadlift', 
                       'Overhead Press (BB)', 'Lat Pulldown (wide)'];
      for (const name of popular) {
        resultsContainer.appendChild(createExerciseItem({
          name,
          muscleGroup: getMuscleGroup(name)
        }));
      }
    } else {
      // Show search results
      const results = searchQuery 
        ? searchExercises(searchQuery, selectedFilter)
        : getAllExercises()
            .filter(ex => !selectedFilter || ex.muscleGroup === selectedFilter)
            .map(ex => ({ ...ex, score: 1 }));
      
      if (results.length === 0) {
        resultsContainer.appendChild(
          el('div', { cls: 'autocomplete-empty' }, 'No exercises found')
        );
      } else {
        resultsContainer.appendChild(
          el('div', { cls: 'autocomplete-section' }, 
            `${results.length} result${results.length !== 1 ? 's' : ''}`
          )
        );
        for (const ex of results.slice(0, 15)) {
          resultsContainer.appendChild(createExerciseItem(ex));
        }
      }
    }
  }
  
  function createExerciseItem(ex) {
    return el('button', {
      cls: 'autocomplete-item',
      onclick: () => onSelect(ex.name)
    },
      el('span', { cls: 'autocomplete-name' }, highlightMatch(ex.name, searchQuery)),
      el('span', { cls: 'autocomplete-group' }, ex.muscleGroup)
    );
  }
  
  function highlightMatch(name, query) {
    if (!query) return name;
    
    const lowerName = name.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    // Try to find the match position
    let matchStart = lowerName.indexOf(lowerQuery);
    if (matchStart === -1) {
      // Try acronym match
      const words = lowerName.split(/\s+/);
      const acronym = words.map(w => w[0]).join('');
      if (acronym.startsWith(lowerQuery)) {
        // Highlight first characters
        const parts = [];
        let queryIdx = 0;
        for (let i = 0; i < name.length && queryIdx < query.length; i++) {
          if (name[i].toLowerCase() === query[queryIdx].toLowerCase() && 
              (i === 0 || name[i-1] === ' ')) {
            parts.push(el('mark', null, name[i]));
            queryIdx++;
          } else {
            parts.push(name[i]);
          }
        }
        parts.push(name.slice(parts.length - queryIdx));
        return el('span', null, ...parts);
      }
    }
    
    if (matchStart === -1) return name;
    
    const before = name.slice(0, matchStart);
    const match = name.slice(matchStart, matchStart + query.length);
    const after = name.slice(matchStart + query.length);
    
    return el('span', null, before, el('mark', null, match), after);
  }
  
  // Close when clicking outside
  setTimeout(() => {
    const closeHandler = (e) => {
      if (!container.contains(e.target)) {
        onClose();
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  }, 0);
  
  updateResults();
  return container;
}

// ============================================
// SMART INPUT HELPERS
// ============================================

/**
 * Get last used weight for an exercise
 * @param {string} exName - Exercise name
 * @returns {number|null}
 */
function getLastUsedWeight(exName) {
  const last = Store.getLastForEx(exName);
  if (last?.sets?.length) {
    const filledSets = last.sets.filter(s => s.weight);
    if (filledSets.length) {
      return parseFloat(filledSets[filledSets.length - 1].weight);
    }
  }
  return null;
}

/**
 * Get last week's sets for ghost text
 * @param {string} exName - Exercise name
 * @returns {Array<{weight: string, reps: string, rir: string}>|null}
 */
function getLastWeekSets(exName) {
  const last = Store.getLastForEx(exName);
  if (last?.sets?.length) {
    return last.sets.map(s => ({
      weight: s.weight || '',
      reps: s.reps || '',
      rir: s.rir || ''
    }));
  }
  return null;
}

/**
 * Calculate increment amount based on units
 * @returns {number}
 */
function getIncrement() {
  return Store.state?.units === 'kg' ? 2.5 : 5;
}

/**
 * Round weight to nearest plate
 * @param {number} weight - Weight to round
 * @returns {number}
 */
function roundToNearestPlate(weight) {
  const units = Store.state?.units || 'lbs';
  const smallestPlate = units === 'kg' ? 1.25 : 2.5;
  return Math.round(weight / smallestPlate) * smallestPlate;
}

/**
 * Get increment buttons for quick weight adjustment
 * @param {number} currentWeight - Current weight value
 * @param {Function} onChange - Callback when weight changes
 * @returns {HTMLElement}
 */
function renderWeightIncrements(currentWeight, onChange) {
  const inc = getIncrement();
  const smallInc = Store.state?.units === 'kg' ? 1.25 : 2.5;
  
  return el('div', { cls: 'weight-increments' },
    el('button', {
      cls: 'inc-btn dec',
      onclick: () => {
        const newWeight = Math.max(0, (currentWeight || 0) - smallInc);
        onChange(newWeight);
      }
    }, `-${smallInc}`),
    el('button', {
      cls: 'inc-btn dec',
      onclick: () => {
        const newWeight = Math.max(0, (currentWeight || 0) - inc);
        onChange(newWeight);
      }
    }, `-${inc}`),
    el('button', {
      cls: 'inc-btn inc',
      onclick: () => onChange((currentWeight || 0) + inc)
    }, `+${inc}`),
    el('button', {
      cls: 'inc-btn inc',
      onclick: () => onChange((currentWeight || 0) + inc * 2)
    }, `+${inc * 2}`)
  );
}

/**
 * Quick RIR selector buttons
 * @param {string|number} currentRIR - Current RIR value
 * @param {Function} onChange - Callback when RIR changes
 * @returns {HTMLElement}
 */
function renderRIRSelector(currentRIR, onChange) {
  const rirValues = [0, 1, 2, 3];
  
  return el('div', { cls: 'rir-selector' },
    ...rirValues.map(rir => 
      el('button', {
        cls: `rir-btn ${String(currentRIR) === String(rir) ? 'active' : ''}`,
        onclick: () => onChange(rir)
      }, rir === 3 ? '3+' : String(rir))
    )
  );
}

// ============================================
// SET TEMPLATES
// ============================================

/**
 * Fill down first set values to all sets
 * @param {number} ei - Exercise index
 * @param {Object} ex - Exercise data
 */
function fillDownSets(ei, ex) {
  const firstSet = Store.inputs[`${ei}-0`];
  if (!firstSet) return;
  
  for (let si = 1; si < ex.sets; si++) {
    const k = `${ei}-${si}`;
    if (!Store.inputs[k]) Store.inputs[k] = {};
    Store.inputs[k].weight = firstSet.weight || '';
    Store.inputs[k].reps = firstSet.reps || '';
    Store.inputs[k].rir = firstSet.rir || '';
  }
  haptic(30);
  Router.render();
}

/**
 * Calculate ramp up (pyramid) sets
 * @param {number} ei - Exercise index
 * @param {Object} ex - Exercise data
 * @param {number} topWeight - Top working weight
 */
function calculateRampUp(ei, ex, topWeight) {
  if (!topWeight || topWeight <= 0) return;
  
  const sets = ex.sets;
  const inc = getIncrement();
  
  // For ramp up, we want lighter sets building to the top weight
  // Example: 4 sets at 225 top → 135, 175, 200, 225
  const increments = [];
  
  if (sets === 1) {
    increments.push(topWeight);
  } else if (sets === 2) {
    increments.push(Math.max(inc, topWeight - inc * 2), topWeight);
  } else if (sets === 3) {
    increments.push(
      Math.max(inc, roundToNearestPlate(topWeight * 0.6)),
      Math.max(inc, roundToNearestPlate(topWeight * 0.8)),
      topWeight
    );
  } else {
    // 4+ sets: more gradual ramp
    const step = (topWeight - (topWeight * 0.5)) / (sets - 1);
    for (let i = 0; i < sets; i++) {
      const w = topWeight * 0.5 + step * i;
      increments.push(roundToNearestPlate(Math.max(inc, w)));
    }
  }
  
  for (let si = 0; si < sets; si++) {
    const k = `${ei}-${si}`;
    if (!Store.inputs[k]) Store.inputs[k] = {};
    Store.inputs[k].weight = String(increments[si] || topWeight);
    // Keep existing reps or use target
    if (!Store.inputs[k].reps) {
      const targetReps = parseInt(ex.reps?.match(/\d+/)?.[0]) || 8;
      Store.inputs[k].reps = String(targetReps);
    }
  }
  haptic(30);
  Router.render();
}

/**
 * Render set template buttons
 * @param {number} ei - Exercise index
 * @param {Object} ex - Exercise data
 * @returns {HTMLElement}
 */
function renderSetTemplates(ei, ex) {
  const hasFirstSet = Store.inputs[`${ei}-0`]?.weight;
  const topWeight = Store.inputs[`${ei}-${ex.sets - 1}`]?.weight || 
                    Store.inputs[`${ei}-0`]?.weight;
  
  return el('div', { cls: 'set-templates' },
    el('button', {
      cls: 'template-btn',
      disabled: !hasFirstSet,
      onclick: () => fillDownSets(ei, ex)
    }, 'Fill Down'),
    el('button', {
      cls: 'template-btn',
      disabled: !topWeight,
      onclick: () => calculateRampUp(ei, ex, parseFloat(topWeight))
    }, 'Ramp Up')
  );
}

// ============================================
// ENHANCED SET INPUTS
// ============================================

/**
 * Get time since last set for an exercise
 * @param {string} exName - Exercise name
 * @returns {string} Human readable time difference
 */
function getTimeSinceLastSet(exName) {
  // Look through history for this exercise
  for (const workout of Store.history) {
    for (const ex of (workout.exercises || [])) {
      if (ex.name === exName && ex.sets?.some(s => s.weight)) {
        const workoutDate = new Date(workout.date);
        const now = new Date();
        const diffMs = now - workoutDate;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
          if (diffHours === 0) {
            const diffMins = Math.floor(diffMs / (1000 * 60));
            return diffMins < 1 ? 'Just now' : `${diffMins}m ago`;
          }
          return `${diffHours}h ago`;
        } else if (diffDays === 1) {
          return 'Yesterday';
        } else if (diffDays < 7) {
          return `${diffDays} days ago`;
        } else if (diffDays < 30) {
          return `${Math.floor(diffDays / 7)}w ago`;
        } else {
          return `${Math.floor(diffDays / 30)}mo ago`;
        }
      }
    }
  }
  return null;
}

/**
 * Create an enhanced set input with navigation and smart features
 * @param {number} ei - Exercise index
 * @param {number} si - Set index
 * @param {Object} ex - Exercise data
 * @param {Object} value - Current input values
 * @param {Function} onChange - Callback on change
 * @returns {Object} Input elements
 */
function createEnhancedSetInput(ei, si, ex, value, onChange) {
  const k = `${ei}-${si}`;
  const done = value?.weight && value?.reps;
  const setType = value?.type || 'working';
  
  // Get ghost values from last week
  const lastWeek = getLastWeekSets(ex.name);
  const ghostWeight = lastWeek?.[si]?.weight;
  const ghostReps = lastWeek?.[si]?.reps;
  const ghostRIR = lastWeek?.[si]?.rir;
  
  // Weight input
  const weightInput = el('input', {
    type: 'number',
    inputmode: 'decimal',
    id: `in-${ei}-${si}-w`,
    cls: `set-input ${done ? 'done' : ''}`,
    placeholder: ghostWeight || '-',
    value: value?.weight || '',
    'data-ghost': ghostWeight || '',
    oninput: e => {
      if (!Store.inputs[k]) Store.inputs[k] = {};
      Store.inputs[k].weight = e.target.value;
      onChange?.(ei, si, 'weight', e.target.value);
      
      // Auto-advance if reps already filled
      if (e.target.value && Store.inputs[k]?.reps) {
        document.getElementById(`in-${ei}-${si}-i`)?.focus();
      }
    },
    onkeydown: e => handleInputKeydown(e, ei, si, 'w', ex.sets),
    ondblclick: e => {
      // Double-tap to round to nearest plate
      const current = parseFloat(e.target.value);
      if (current) {
        const rounded = roundToNearestPlate(current);
        e.target.value = rounded;
        if (!Store.inputs[k]) Store.inputs[k] = {};
        Store.inputs[k].weight = String(rounded);
        onChange?.(ei, si, 'weight', String(rounded));
        haptic(20);
      }
    }
  });
  
  // Reps input
  const repsInput = el('input', {
    type: 'number',
    inputmode: 'numeric',
    id: `in-${ei}-${si}-r`,
    cls: `set-input ${done ? 'done' : ''}`,
    placeholder: ghostReps || '-',
    value: value?.reps || '',
    'data-ghost': ghostReps || '',
    oninput: e => {
      if (!Store.inputs[k]) Store.inputs[k] = {};
      Store.inputs[k].reps = e.target.value;
      if (value?.weight && e.target.value) {
        haptic(30);
        if (Store.restPauseExercises[ei]) {
          startRest(15);
        }
      }
      onChange?.(ei, si, 'reps', e.target.value);
    },
    onkeydown: e => handleInputKeydown(e, ei, si, 'r', ex.sets)
  });
  
  // RIR input - can use quick selector or direct input
  const rirInput = el('input', {
    type: 'number',
    inputmode: 'numeric',
    id: `in-${ei}-${si}-i`,
    cls: `set-input ${done ? 'done' : ''} rir-input`,
    placeholder: ghostRIR || '-',
    value: value?.rir || '',
    'data-ghost': ghostRIR || '',
    oninput: e => {
      if (!Store.inputs[k]) Store.inputs[k] = {};
      Store.inputs[k].rir = e.target.value;
      onChange?.(ei, si, 'rir', e.target.value);
    },
    onkeydown: e => handleInputKeydown(e, ei, si, 'i', ex.sets),
    onfocus: e => {
      // Show quick RIR selector on focus
      showQuickRIRPicker(e.target, ei, si, onChange);
    }
  });
  
  // Type button
  const typeBtn = el('button', {
    cls: `set-type-btn ${setType}`,
    onclick: () => {
      if (!Store.inputs[k]) Store.inputs[k] = {};
      const cycle = { working: 'warmup', warmup: 'drop', drop: 'failure', failure: 'working' };
      Store.inputs[k].type = cycle[setType];
      Router.render();
    }
  }, setType === 'warmup' ? 'W' : setType === 'drop' ? '↓' : setType === 'failure' ? 'F' : '•');
  
  return { weightInput, repsInput, rirInput, typeBtn };
}

/**
 * Handle keyboard navigation between inputs
 * @param {KeyboardEvent} e
 * @param {number} ei - Exercise index
 * @param {number} si - Set index
 * @param {string} field - Current field (w, r, i)
 * @param {number} totalSets - Total sets for this exercise
 */
function handleInputKeydown(e, ei, si, field, totalSets) {
  const fields = ['w', 'r', 'i'];
  const currentIdx = fields.indexOf(field);
  
  if (e.key === 'Tab' || e.key === 'Enter') {
    e.preventDefault();
    
    if (e.shiftKey) {
      // Go backwards
      if (currentIdx > 0) {
        const prev = document.getElementById(`in-${ei}-${si}-${fields[currentIdx - 1]}`);
        if (prev) { prev.focus(); prev.select(); }
      } else if (si > 0) {
        const prev = document.getElementById(`in-${ei}-${si - 1}-i`);
        if (prev) { prev.focus(); prev.select(); }
      }
    } else {
      // Go forwards
      if (currentIdx < fields.length - 1) {
        const next = document.getElementById(`in-${ei}-${si}-${fields[currentIdx + 1]}`);
        if (next) { next.focus(); next.select(); }
      } else if (si < totalSets - 1) {
        const next = document.getElementById(`in-${ei}-${si + 1}-w`);
        if (next) { next.focus(); next.select(); }
      } else {
        // Move to next exercise's first set
        const nextEx = document.getElementById(`in-${ei + 1}-0-w`);
        if (nextEx) { nextEx.focus(); nextEx.select(); }
      }
    }
  }
}

/**
 * Show quick RIR picker popup
 * @param {HTMLElement} inputEl - RIR input element
 * @param {number} ei - Exercise index
 * @param {number} si - Set index
 * @param {Function} onChange - Change callback
 */
function showQuickRIRPicker(inputEl, ei, si, onChange) {
  // Remove any existing picker
  const existing = document.querySelector('.rir-picker-popup');
  if (existing) existing.remove();
  
  const k = `${ei}-${si}`;
  const currentValue = Store.inputs[k]?.rir || '';
  
  const picker = el('div', { 
    cls: 'rir-picker-popup',
    onclick: e => e.stopPropagation()
  },
    ...[0, 1, 2, 3, 4].map(rir => 
      el('button', {
        cls: `rir-picker-btn ${String(currentValue) === String(rir) ? 'active' : ''}`,
        onclick: () => {
          const value = rir === 4 ? '' : String(rir);
          inputEl.value = value;
          if (!Store.inputs[k]) Store.inputs[k] = {};
          Store.inputs[k].rir = value;
          onChange?.(ei, si, 'rir', value);
          picker.remove();
          // Move to next input
          document.getElementById(`in-${ei}-${si + 1}-w`)?.focus();
        }
      }, rir === 4 ? 'Clear' : rir === 3 ? '3+' : String(rir))
    )
  );
  
  // Position near input
  const rect = inputEl.getBoundingClientRect();
  picker.style.position = 'fixed';
  picker.style.left = `${rect.left}px`;
  picker.style.top = `${rect.bottom + 4}px`;
  picker.style.zIndex = '1000';
  
  document.body.appendChild(picker);
  
  // Close on outside click
  setTimeout(() => {
    const closeHandler = (e) => {
      if (!picker.contains(e.target)) {
        picker.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  }, 0);
}

/**
 * Render enhanced set inputs with all smart features
 * @param {number} ei - Exercise index
 * @param {Object} ex - Exercise data
 * @param {Function} onInput - Callback when input changes
 * @returns {HTMLElement} Set grid element
 */
function renderSetInputs(ei, ex, onInput) {
  const container = el('div', { cls: 'set-inputs-container' });
  
  // Header row
  const header = el('div', { cls: 'set-grid-5 set-header' },
    el('div', { cls: 'label', css: 'font-size:9px' }, '#'),
    el('div', { cls: 'label', css: 'font-size:9px;text-align:center' }, unitLabel().toUpperCase()),
    el('div', { cls: 'label', css: 'font-size:9px;text-align:center' }, 'REPS'),
    el('div', { cls: 'label', css: 'font-size:9px;text-align:center' }, 'RIR'),
    el('div', { cls: 'label', css: 'font-size:9px;text-align:center' }, 'TYPE')
  );
  container.appendChild(header);
  
  // Set rows
  for (let si = 0; si < ex.sets; si++) {
    const k = `${ei}-${si}`;
    const v = Store.inputs[k] || {};
    const done = v.weight && v.reps;
    
    const { weightInput, repsInput, rirInput, typeBtn } = 
      createEnhancedSetInput(ei, si, ex, v, onInput);
    
    const row = el('div', { cls: 'set-grid-5 set-row' },
      el('div', { cls: `set-num ${done ? 'done' : ''}` }, done ? '✓' : String(si + 1)),
      weightInput,
      repsInput,
      rirInput,
      typeBtn
    );
    
    container.appendChild(row);
  }
  
  return container;
}

// ============================================
// EXERCISE CARD HEADER
// ============================================

/**
 * Render exercise progress indicator
 * @param {number} ei - Exercise index
 * @param {Object} ex - Exercise data
 * @returns {HTMLElement}
 */
function renderExerciseProgress(ei, ex) {
  const completedSets = Array.from({ length: ex.sets }, (_, si) => 
    Store.inputs[`${ei}-${si}`]
  ).filter(s => s?.weight && s?.reps).length;
  
  const percent = (completedSets / ex.sets) * 100;
  
  return el('div', { cls: 'exercise-progress' },
    el('div', { cls: 'progress-bar' },
      el('div', { 
        cls: 'progress-fill',
        css: `width:${percent}%`
      })
    ),
    el('span', { cls: 'progress-text' }, `${completedSets}/${ex.sets}`)
  );
}

/**
 * Render enhanced exercise header with swap/edit
 * @param {number} ei - Exercise index
 * @param {Object} ex - Exercise data
 * @param {number|null} prog - Progression suggestion
 * @returns {HTMLElement}
 */
function renderExerciseHeader(ei, ex, prog) {
  const timeSince = getTimeSinceLastSet(ex.name);
  
  return el('div', { cls: 'exercise-header' },
    el('div', { css: 'display:flex;justify-content:space-between;align-items:flex-start' },
      el('div', { css: 'flex:1' },
        el('div', { css: 'display:flex;align-items:center;gap:6px;flex-wrap:wrap' },
          (() => {
            let pressTimer = null;
            return el('span', { 
              cls: 'exercise-name',
              onmousedown: () => { pressTimer = setTimeout(() => editExerciseScheme(ei), 500); },
              onmouseup: () => clearTimeout(pressTimer),
              ontouchstart: () => { pressTimer = setTimeout(() => editExerciseScheme(ei), 500); },
              ontouchend: () => clearTimeout(pressTimer),
              onclick: () => showExerciseSwapModal(ei, ex)
            }, ex.name);
          })(),
          EXERCISE_DEMOS[ex.name] ? 
            el('a', { 
              href: EXERCISE_DEMOS[ex.name], 
              target: '_blank', 
              rel: 'noopener',
              cls: 'demo-link', 
              onclick: e => e.stopPropagation() 
            }, 'ⓘ') : null,
          timeSince ? el('span', { cls: 'time-since' }, timeSince) : null
        ),
        el('div', { css: 'display:flex;gap:6px;align-items:center;font-size:11px;color:var(--dim);margin-top:2px' },
          `${ex.sets}x${ex.reps} • Rest ${ex.rest}s`,
          Store.restPauseExercises[ei] ? el('span', { cls: 'rp-badge' }, 'RP') : null,
          Store.supersets.some(s => s.includes(ei)) ? el('span', { cls: 'ss-badge' }, 'SS') : null
        )
      ),
      
      // Action buttons
      el('div', { css: 'display:flex;gap:4px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end' },
        el('button', { 
          cls: 'btn-sm blue', 
          onclick: () => copyLast(ei, ex.name) 
        }, 'Copy'),
        el('button', { 
          cls: 'btn-sm green', 
          onclick: () => { 
            Store.expandedPlateCalc[ei] = !Store.expandedPlateCalc[ei]; 
            Router.render(); 
          } 
        }, 'Plates'),
        el('button', { 
          cls: `btn-sm ${Store.restPauseExercises[ei] ? 'active-rp' : ''}`, 
          onclick: () => { 
            Store.restPauseExercises[ei] = !Store.restPauseExercises[ei]; 
            Router.render(); 
          } 
        }, 'RP'),
        ei < Store.workoutExercises.length - 1 ? 
          el('button', { 
            cls: `btn-sm ${Store.supersets.some(s => s[0] === ei) ? 'active-ss' : ''}`, 
            onclick: () => {
              const idx = Store.supersets.findIndex(s => s[0] === ei);
              if (idx >= 0) Store.supersets.splice(idx, 1); 
              else Store.supersets.push([ei, ei + 1]);
              Router.render();
            }
          }, '⛓') : null
      )
    ),
    
    // Progress bar
    renderExerciseProgress(ei, ex),
    
    // Progression nudge
    prog ? el('button', { 
      cls: 'prog-tag prog-nudge', 
      onclick: e => {
        e.stopPropagation();
        for (let si = 0; si < ex.sets; si++) {
          if (!Store.inputs[`${ei}-${si}`]) Store.inputs[`${ei}-${si}`] = {};
          if (!Store.inputs[`${ei}-${si}`].weight) Store.inputs[`${ei}-${si}`].weight = String(prog);
        }
        Router.render();
      }
    }, `↑ ${fmtW(prog)} ${unitLabel()} — tap to apply`) : null
  );
}

/**
 * Show exercise swap modal with autocomplete
 * @param {number} ei - Exercise index
 * @param {Object} ex - Exercise data
 */
function showExerciseSwapModal(ei, ex) {
  Store.showModal({
    title: ex.name,
    content: el('div', { cls: 'swap-modal-content' },
      el('div', { cls: 'label', css: 'margin-bottom:6px' }, 'Swap to:'),
      renderExerciseAutocomplete({
        value: '',
        onSelect: (newName) => swapExercise(ei, newName),
        onClose: () => Store.closeModal()
      }),
      el('button', { 
        cls: 'btn-ghost', 
        css: 'margin-top:8px', 
        onclick: () => { 
          Store.closeModal(); 
          showExerciseHistory(ex.name); 
        } 
      }, 'View History')
    )
  });
}

// ============================================
// WORKOUT PROGRESS
// ============================================

/**
 * Calculate overall workout completion
 * @returns {Object} { completedSets, totalSets, percent, completedExercises, totalExercises }
 */
function getWorkoutProgress() {
  let completedSets = 0;
  let totalSets = 0;
  let completedExercises = 0;
  
  for (let ei = 0; ei < Store.workoutExercises.length; ei++) {
    const ex = Store.workoutExercises[ei];
    let exCompleted = 0;
    
    for (let si = 0; si < ex.sets; si++) {
      totalSets++;
      const input = Store.inputs[`${ei}-${si}`];
      if (input?.weight && input?.reps) {
        completedSets++;
        exCompleted++;
      }
    }
    
    if (exCompleted === ex.sets) {
      completedExercises++;
    }
  }
  
  return {
    completedSets,
    totalSets,
    percent: totalSets > 0 ? (completedSets / totalSets) * 100 : 0,
    completedExercises,
    totalExercises: Store.workoutExercises.length
  };
}

/**
 * Render workout progress bar
 * @returns {HTMLElement}
 */
function renderWorkoutProgress() {
  const progress = getWorkoutProgress();
  
  return el('div', { cls: 'workout-progress' },
    el('div', { cls: 'workout-progress-header' },
      el('span', null, 'Workout Progress'),
      el('span', { cls: 'progress-stats' }, 
        `${progress.completedSets}/${progress.totalSets} sets • ${progress.completedExercises}/${progress.totalExercises} exercises`
      )
    ),
    el('div', { cls: 'progress-bar large' },
      el('div', { 
        cls: 'progress-fill',
        css: `width:${progress.percent}%`
      })
    )
  );
}

// ============================================
// ORIGINAL COMPONENTS (preserved)
// ============================================

/**
 * Render rest timer preset buttons
 * @param {number} defaultRest - Default rest time in seconds
 * @returns {HTMLElement} Rest presets element
 */
function renderRestPresets(defaultRest) {
  const presets = [60, 90, 120, 180];
  return el('div', { cls: 'rest-presets' },
    ...presets.map(s =>
      el('button', { 
        cls: `rest-pill ${s === defaultRest ? 'active' : ''}`, 
        onclick: () => startRest(s) 
      }, `${s}s`)
    ),
    defaultRest && !presets.includes(defaultRest)
      ? el('button', { 
          cls: 'rest-pill active', 
          onclick: () => startRest(defaultRest) 
        }, `${defaultRest}s`)
      : null
  );
}

/**
 * Render percentage-based weight suggestions
 * @param {string} exName - Exercise name
 * @param {number} ei - Exercise index
 * @returns {HTMLElement|null} Percentage row element
 */
function renderPercentageRow(exName, ei) {
  const e1rm = Store.getPR(exName) || 0;
  if (e1rm <= 0) return null;
  
  return el('div', { cls: 'pct-row' },
    el('span', { css: 'font-size:10px;color:var(--dim);margin-right:4px' }, '% 1RM:'),
    ...[70, 75, 80, 85].map(pct => {
      const w = Math.round(e1rm * pct / 100 / 2.5) * 2.5;
      return el('button', { 
        cls: 'pct-chip', 
        onclick: () => {
          for (let si = 0; si < Store.workoutExercises[ei].sets; si++) {
            const k = `${ei}-${si}`;
            if (!Store.inputs[k]) Store.inputs[k] = {};
            Store.inputs[k].weight = String(w);
          }
          Router.render();
        }
      }, `${pct}% ${w}`);
    })
  );
}

/**
 * Render plate calculator display
 * @param {number} ei - Exercise index
 * @param {string} currentWeight - Current weight input
 * @returns {HTMLElement} Plate calculator element
 */
function renderPlateCalc(ei, currentWeight) {
  const plates = currentWeight ? calcPlates(parseFloat(currentWeight)) : [];
  return el('div', { cls: 'plate-calc' },
    el('div', { css: 'font-size:11px;color:var(--dim);margin-bottom:4px' },
      currentWeight ? `${currentWeight}${unitLabel()} → Per side:` : 'Enter weight to see plates'
    ),
    plates.length ? el('div', { cls: 'plate-calc-row' },
      ...plates.map(p => el('span', { 
        cls: `plate-chip x${String(p).replace('.', '-')}` 
      }, `${p}`))
    ) : null
  );
}

/**
 * Render warmup sets display
 * @param {Array} warmups - Array of warmup sets
 * @returns {HTMLElement} Warmup section element
 */
function renderWarmupSection(warmups) {
  if (!warmups.length) return null;
  
  return el('div', { cls: 'warmup-section' },
    ...warmups.map(w => el('div', { cls: 'warmup-row' },
      el('span', null, w.label), 
      el('span', null, `${fmtW(w.weight)} × ${w.reps}`)
    ))
  );
}

// ============================================
// SWIPE HANDLERS
// ============================================

/**
 * Add swipe-to-delete functionality to an element
 * @param {HTMLElement} el - Element to add swipe to
 * @param {Function} onSwipe - Callback when swiped
 */
function addSwipeToDelete(el, onSwipe) {
  let startX = 0;
  let currentX = 0;
  let isSwiping = false;
  
  el.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    isSwiping = true;
    el.style.transition = 'none';
  }, { passive: true });
  
  el.addEventListener('touchmove', e => {
    if (!isSwiping) return;
    currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    if (diff < 0) {
      el.style.transform = `translateX(${diff}px)`;
    }
  }, { passive: true });
  
  el.addEventListener('touchend', () => {
    if (!isSwiping) return;
    isSwiping = false;
    const diff = currentX - startX;
    
    if (diff < -100) {
      // Swiped far enough - trigger delete
      el.style.transition = 'transform 0.2s';
      el.style.transform = 'translateX(-100%)';
      setTimeout(onSwipe, 200);
    } else {
      // Reset
      el.style.transition = 'transform 0.2s';
      el.style.transform = '';
    }
  });
}

// ============================================
// LONG PRESS HANDLERS
// ============================================

/**
 * Add long press functionality to an element
 * @param {HTMLElement} element - Element to add long press to
 * @param {Function} onLongPress - Callback on long press
 * @param {number} duration - Duration in ms
 */
function addLongPress(element, onLongPress, duration = 500) {
  let timer = null;
  let startY = 0;
  
  const start = (e) => {
    startY = e.touches?.[0]?.clientY || e.clientY;
    timer = setTimeout(() => {
      onLongPress();
      timer = null;
    }, duration);
  };
  
  const end = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  
  const move = (e) => {
    if (timer) {
      const currentY = e.touches?.[0]?.clientY || e.clientY;
      if (Math.abs(currentY - startY) > 10) {
        clearTimeout(timer);
        timer = null;
      }
    }
  };
  
  element.addEventListener('mousedown', start);
  element.addEventListener('touchstart', start, { passive: true });
  element.addEventListener('mouseup', end);
  element.addEventListener('mouseleave', end);
  element.addEventListener('touchend', end);
  element.addEventListener('touchmove', move, { passive: true });
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Autocomplete
    fuzzyScore,
    getRecentExercises,
    getAllExercises,
    searchExercises,
    renderExerciseAutocomplete,
    
    // Smart inputs
    getLastUsedWeight,
    getLastWeekSets,
    getIncrement,
    roundToNearestPlate,
    renderWeightIncrements,
    renderRIRSelector,
    
    // Templates
    fillDownSets,
    calculateRampUp,
    renderSetTemplates,
    
    // Enhanced inputs
    getTimeSinceLastSet,
    createEnhancedSetInput,
    handleInputKeydown,
    showQuickRIRPicker,
    renderSetInputs,
    
    // Headers
    renderExerciseProgress,
    renderExerciseHeader,
    showExerciseSwapModal,
    
    // Progress
    getWorkoutProgress,
    renderWorkoutProgress,
    
    // Original components
    renderRestPresets,
    renderPercentageRow,
    renderPlateCalc,
    renderWarmupSection,
    
    // Touch handlers
    addSwipeToDelete,
    addLongPress
  };
}
