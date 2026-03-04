// ============================================
// WORKOUT TEMPLATES — Save, load, and manage workout templates
// ============================================

/**
 * Template data structure:
 * {
 *   id: string,           // Unique identifier
 *   name: string,         // Display name
 *   description: string,  // Optional description
 *   created: string,      // ISO date string
 *   type: 'template' | 'program',  // Template = single workout, Program = weekly schedule
 *   source: 'builtin' | 'custom' | 'imported',  // Origin
 *   exercises: [{
 *     name: string,
 *     sets: number,
 *     reps: string,
 *     rest: number,       // seconds
 *     notes: string
 *   }],
 *   tags: string[],       // e.g., ['strength', 'hypertrophy', 'quick']
 *   // For programs only:
 *   schedule?: [{ day: string, dayLabel: string, exercises: [...] }]
 * }
 */

const Templates = (() => {
  // Storage keys (prefixed automatically by Storage module)
  const TEMPLATES_KEY = 'templates';
  const PROGRAMS_KEY = 'customPrograms';
  const ACTIVE_PROGRAM_KEY = 'activeCustomProgram';

  // Generate unique ID
  function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Deep clone helper
  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // ============================================
  // BUILT-IN TEMPLATE LIBRARY
  // ============================================
  const BUILTIN_TEMPLATES = [
    {
      id: 'builtin-strength-focus',
      name: 'Strength Focus',
      description: 'Lower reps, heavier weight, longer rest periods for maximum strength gains.',
      created: new Date().toISOString(),
      type: 'template',
      source: 'builtin',
      exercises: [
        { name: 'Barbell Bench Press', sets: 5, reps: '3-5', rest: 180, notes: 'Heavy compound' },
        { name: 'Barbell Back Squat', sets: 5, reps: '3-5', rest: 240, notes: 'Heavy compound' },
        { name: 'Overhead Press (BB)', sets: 4, reps: '4-6', rest: 150, notes: 'Heavy compound' },
        { name: 'Barbell Row (heavy)', sets: 4, reps: '4-6', rest: 150, notes: 'Heavy compound' },
        { name: 'Weighted Pull-Ups', sets: 4, reps: '4-6', rest: 150, notes: 'Add weight if possible' },
        { name: 'Romanian Deadlift', sets: 3, reps: '6-8', rest: 150, notes: 'Controlled descent' },
      ],
      tags: ['strength', 'compound', 'heavy']
    },
    {
      id: 'builtin-hypertrophy-focus',
      name: 'Hypertrophy Focus',
      description: 'Moderate reps and rest for optimal muscle growth.',
      created: new Date().toISOString(),
      type: 'template',
      source: 'builtin',
      exercises: [
        { name: 'Barbell Bench Press', sets: 4, reps: '8-10', rest: 120, notes: '' },
        { name: 'Incline DB Press', sets: 4, reps: '10-12', rest: 90, notes: '' },
        { name: 'Cable Flye (low-high)', sets: 3, reps: '12-15', rest: 60, notes: 'Squeeze at top' },
        { name: 'Lat Pulldown (wide)', sets: 4, reps: '10-12', rest: 90, notes: '' },
        { name: 'Cable Row (V-bar)', sets: 4, reps: '10-12', rest: 90, notes: '' },
        { name: 'Barbell Curl', sets: 3, reps: '10-12', rest: 60, notes: '' },
        { name: 'Cable Pushdown (rope)', sets: 3, reps: '12-15', rest: 60, notes: '' },
      ],
      tags: ['hypertrophy', 'balanced', 'moderate']
    },
    {
      id: 'builtin-time-efficient',
      name: 'Time-Efficient',
      description: 'Supersets and shorter rest for quick but effective workouts.',
      created: new Date().toISOString(),
      type: 'template',
      source: 'builtin',
      exercises: [
        { name: 'Barbell Bench Press', sets: 3, reps: '8-10', rest: 60, notes: 'Superset with rows' },
        { name: 'Barbell Row (overhand)', sets: 3, reps: '8-10', rest: 60, notes: 'Superset with bench' },
        { name: 'Overhead Press (BB)', sets: 3, reps: '8-10', rest: 60, notes: 'Superset with pulldowns' },
        { name: 'Lat Pulldown (wide)', sets: 3, reps: '10-12', rest: 60, notes: 'Superset with OHP' },
        { name: 'Goblet Squat (DB)', sets: 3, reps: '12-15', rest: 60, notes: 'Superset with RDL' },
        { name: 'Romanian Deadlift', sets: 3, reps: '10-12', rest: 60, notes: 'Superset with squats' },
      ],
      tags: ['quick', 'supersets', 'time-efficient']
    },
    {
      id: 'builtin-deload-week',
      name: 'Deload Week',
      description: 'Reduce volume by 50% to allow recovery while maintaining movement patterns.',
      created: new Date().toISOString(),
      type: 'template',
      source: 'builtin',
      exercises: [
        { name: 'Barbell Bench Press', sets: 2, reps: '8-10', rest: 90, notes: 'Use 60% of normal weight' },
        { name: 'Barbell Back Squat', sets: 2, reps: '8-10', rest: 90, notes: 'Use 60% of normal weight' },
        { name: 'Lat Pulldown (wide)', sets: 2, reps: '12-15', rest: 60, notes: 'Light weight, focus on form' },
        { name: 'Overhead Press (BB)', sets: 2, reps: '8-10', rest: 90, notes: 'Use 60% of normal weight' },
        { name: 'Cable Face Pull', sets: 2, reps: '15-20', rest: 45, notes: 'Light, controlled' },
        { name: 'Barbell Curl', sets: 2, reps: '12-15', rest: 45, notes: 'Light weight' },
      ],
      tags: ['deload', 'recovery', 'light']
    },
    {
      id: 'builtin-upper-body',
      name: 'Upper Body Focus',
      description: 'Complete upper body workout targeting chest, back, shoulders, and arms.',
      created: new Date().toISOString(),
      type: 'template',
      source: 'builtin',
      exercises: [
        { name: 'Barbell Bench Press', sets: 4, reps: '6-8', rest: 120, notes: '' },
        { name: 'Weighted Pull-Ups', sets: 4, reps: '6-8', rest: 120, notes: '' },
        { name: 'Overhead Press (BB)', sets: 4, reps: '6-8', rest: 120, notes: '' },
        { name: 'Barbell Row (heavy)', sets: 4, reps: '6-8', rest: 120, notes: '' },
        { name: 'Incline DB Press', sets: 3, reps: '10-12', rest: 90, notes: '' },
        { name: 'DB Lateral Raise', sets: 3, reps: '12-15', rest: 60, notes: '' },
        { name: 'Barbell Curl', sets: 3, reps: '10-12', rest: 60, notes: '' },
        { name: 'Cable Pushdown (rope)', sets: 3, reps: '10-12', rest: 60, notes: '' },
      ],
      tags: ['upper', 'balanced', 'strength']
    },
    {
      id: 'builtin-lower-body',
      name: 'Lower Body Focus',
      description: 'Intense lower body session targeting quads, hamstrings, glutes, and calves.',
      created: new Date().toISOString(),
      type: 'template',
      source: 'builtin',
      exercises: [
        { name: 'Barbell Back Squat', sets: 4, reps: '6-8', rest: 180, notes: 'Depth focus' },
        { name: 'Romanian Deadlift', sets: 4, reps: '8-10', rest: 120, notes: 'Hamstring stretch' },
        { name: 'Bulgarian Split Squat', sets: 3, reps: '10-12/leg', rest: 90, notes: 'Control the descent' },
        { name: 'BB Hip Thrust', sets: 3, reps: '10-12', rest: 90, notes: 'Squeeze glutes at top' },
        { name: 'Walking Lunges (DB)', sets: 3, reps: '12/leg', rest: 90, notes: '' },
        { name: 'Standing Calf Raise', sets: 4, reps: '12-15', rest: 60, notes: 'Full range of motion' },
        { name: 'Seated Calf Raise', sets: 3, reps: '15-20', rest: 45, notes: 'Slow tempo' },
      ],
      tags: ['lower', 'legs', 'strength']
    }
  ];

  // ============================================
  // BUILT-IN CUSTOM PROGRAMS
  // ============================================
  const BUILTIN_PROGRAMS = [
    {
      id: 'builtin-3day-fullbody',
      name: '3-Day Full Body',
      description: 'Three full-body workouts per week for beginners or maintenance.',
      created: new Date().toISOString(),
      type: 'program',
      source: 'builtin',
      tags: ['beginner', 'full-body', '3-day'],
      schedule: [
        {
          day: 'Monday',
          dayLabel: 'Full Body A',
          exercises: [
            { name: 'Barbell Back Squat', sets: 3, reps: '8-10', rest: 120, notes: '' },
            { name: 'Barbell Bench Press', sets: 3, reps: '8-10', rest: 120, notes: '' },
            { name: 'Barbell Row (overhand)', sets: 3, reps: '8-10', rest: 90, notes: '' },
            { name: 'Overhead Press (BB)', sets: 3, reps: '8-10', rest: 90, notes: '' },
            { name: 'Lat Pulldown (wide)', sets: 3, reps: '10-12', rest: 90, notes: '' },
            { name: 'Barbell Curl', sets: 2, reps: '10-12', rest: 60, notes: '' },
          ]
        },
        {
          day: 'Wednesday',
          dayLabel: 'Full Body B',
          exercises: [
            { name: 'Romanian Deadlift', sets: 3, reps: '8-10', rest: 120, notes: '' },
            { name: 'Incline DB Press', sets: 3, reps: '10-12', rest: 90, notes: '' },
            { name: 'Weighted Pull-Ups', sets: 3, reps: '6-8', rest: 120, notes: '' },
            { name: 'DB Lateral Raise', sets: 3, reps: '12-15', rest: 60, notes: '' },
            { name: 'Cable Pushdown (rope)', sets: 3, reps: '10-12', rest: 60, notes: '' },
            { name: 'Standing Calf Raise', sets: 3, reps: '12-15', rest: 60, notes: '' },
          ]
        },
        {
          day: 'Friday',
          dayLabel: 'Full Body C',
          exercises: [
            { name: 'Front Squat (BB)', sets: 3, reps: '8-10', rest: 120, notes: '' },
            { name: 'DB Bench Press', sets: 3, reps: '10-12', rest: 90, notes: '' },
            { name: 'Cable Row (V-bar)', sets: 3, reps: '10-12', rest: 90, notes: '' },
            { name: 'BB Hip Thrust', sets: 3, reps: '10-12', rest: 90, notes: '' },
            { name: 'Cable Face Pull', sets: 3, reps: '15-20', rest: 60, notes: '' },
            { name: 'Seated Calf Raise', sets: 3, reps: '15-20', rest: 45, notes: '' },
          ]
        }
      ]
    },
    {
      id: 'builtin-4day-upperlower',
      name: '4-Day Upper/Lower',
      description: 'Classic upper/lower split for balanced development.',
      created: new Date().toISOString(),
      type: 'program',
      source: 'builtin',
      tags: ['intermediate', 'upper-lower', '4-day'],
      schedule: [
        {
          day: 'Monday',
          dayLabel: 'Upper A',
          exercises: [
            { name: 'Barbell Bench Press', sets: 4, reps: '6-8', rest: 120, notes: '' },
            { name: 'Weighted Pull-Ups', sets: 4, reps: '6-8', rest: 120, notes: '' },
            { name: 'Overhead Press (BB)', sets: 3, reps: '8-10', rest: 90, notes: '' },
            { name: 'Barbell Row (heavy)', sets: 3, reps: '8-10', rest: 90, notes: '' },
            { name: 'Incline DB Press', sets: 3, reps: '10-12', rest: 90, notes: '' },
            { name: 'Barbell Curl', sets: 3, reps: '10-12', rest: 60, notes: '' },
          ]
        },
        {
          day: 'Tuesday',
          dayLabel: 'Lower A',
          exercises: [
            { name: 'Barbell Back Squat', sets: 4, reps: '6-8', rest: 180, notes: '' },
            { name: 'Romanian Deadlift', sets: 4, reps: '8-10', rest: 120, notes: '' },
            { name: 'Bulgarian Split Squat', sets: 3, reps: '10-12/leg', rest: 90, notes: '' },
            { name: 'Standing Calf Raise', sets: 4, reps: '12-15', rest: 60, notes: '' },
            { name: 'Cable Pull-Through', sets: 3, reps: '12-15', rest: 60, notes: '' },
          ]
        },
        {
          day: 'Thursday',
          dayLabel: 'Upper B',
          exercises: [
            { name: 'Incline BB Bench', sets: 4, reps: '8-10', rest: 90, notes: '' },
            { name: 'Lat Pulldown (V-bar)', sets: 4, reps: '10-12', rest: 90, notes: '' },
            { name: 'DB Bench Press', sets: 3, reps: '10-12', rest: 90, notes: '' },
            { name: 'Cable Row (V-bar)', sets: 3, reps: '10-12', rest: 90, notes: '' },
            { name: 'DB Lateral Raise', sets: 3, reps: '12-15', rest: 60, notes: '' },
            { name: 'Cable Pushdown (rope)', sets: 3, reps: '10-12', rest: 60, notes: '' },
          ]
        },
        {
          day: 'Friday',
          dayLabel: 'Lower B',
          exercises: [
            { name: 'Front Squat (BB)', sets: 4, reps: '8-10', rest: 120, notes: '' },
            { name: 'BB Hip Thrust', sets: 4, reps: '8-10', rest: 90, notes: '' },
            { name: 'Walking Lunges (DB)', sets: 3, reps: '12/leg', rest: 90, notes: '' },
            { name: 'Seated Calf Raise', sets: 4, reps: '15-20', rest: 45, notes: '' },
            { name: 'Stiff-Leg DL (DB)', sets: 3, reps: '10-12', rest: 90, notes: '' },
          ]
        }
      ]
    }
  ];

  // ============================================
  // STORAGE HELPERS
  // ============================================
  async function getTemplatesFromStorage() {
    return await Storage.get(TEMPLATES_KEY, []);
  }

  async function saveTemplatesToStorage(templates) {
    await Storage.set(TEMPLATES_KEY, templates);
  }

  async function getProgramsFromStorage() {
    return await Storage.get(PROGRAMS_KEY, []);
  }

  async function saveProgramsToStorage(programs) {
    await Storage.set(PROGRAMS_KEY, programs);
  }

  // ============================================
  // TEMPLATE MANAGEMENT
  // ============================================

  /**
   * Save current workout as a template
   * @param {string} name - Template name
   * @param {Object} workoutData - Workout data from app state
   * @param {string} description - Optional description
   * @returns {Promise<Object>} The saved template
   */
  async function saveAsTemplate(name, workoutData, description = '') {
    if (!name || !workoutData) {
      throw new Error('Name and workoutData are required');
    }

    const template = {
      id: generateId(),
      name: name.trim(),
      description: description.trim(),
      created: new Date().toISOString(),
      type: 'template',
      source: 'custom',
      exercises: workoutData.exercises.map(ex => ({
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        rest: ex.rest || 90,
        notes: ex.notes || ''
      })),
      tags: inferTags(workoutData.exercises)
    };

    const templates = await getTemplatesFromStorage();
    templates.push(template);
    await saveTemplatesToStorage(templates);

    return template;
  }

  /**
   * Infer tags based on exercises
   */
  function inferTags(exercises) {
    const tags = ['custom'];
    const avgRest = exercises.reduce((sum, ex) => sum + (ex.rest || 90), 0) / exercises.length;
    const avgSets = exercises.reduce((sum, ex) => sum + ex.sets, 0) / exercises.length;
    
    // Infer training style based on volume and rest
    if (avgRest >= 150) tags.push('strength');
    else if (avgRest <= 60) tags.push('quick');
    else tags.push('hypertrophy');

    // Check for muscle groups
    const muscleGroups = new Set();
    for (const ex of exercises) {
      if (typeof getMuscleGroup === 'function') {
        muscleGroups.add(getMuscleGroup(ex.name));
      }
    }
    
    if (muscleGroups.has('Chest') && muscleGroups.has('Back')) {
      tags.push('upper');
    }
    if (muscleGroups.has('Quads') || muscleGroups.has('Hamstrings')) {
      if (!tags.includes('upper')) tags.push('lower');
      else tags.push('full-body');
    }

    return tags;
  }

  /**
   * Load template into active workout format
   * @param {string} templateId - Template ID to load
   * @returns {Promise<Object>} Workout data ready for use
   */
  async function loadTemplate(templateId) {
    const template = await getTemplateById(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return {
      exercises: clone(template.exercises),
      fromTemplate: template.id,
      templateName: template.name
    };
  }

  /**
   * Get a template by ID (searches both custom and builtin)
   */
  async function getTemplateById(templateId) {
    // Check builtins first
    const builtin = BUILTIN_TEMPLATES.find(t => t.id === templateId);
    if (builtin) return builtin;

    // Check custom templates
    const templates = await getTemplatesFromStorage();
    return templates.find(t => t.id === templateId) || null;
  }

  /**
   * Delete a template
   * @param {string} templateId - Template ID to delete
   * @returns {Promise<boolean>} Success
   */
  async function deleteTemplate(templateId) {
    // Cannot delete builtins
    if (templateId.startsWith('builtin-')) {
      throw new Error('Cannot delete built-in templates');
    }

    const templates = await getTemplatesFromStorage();
    const filtered = templates.filter(t => t.id !== templateId);
    
    if (filtered.length === templates.length) {
      return false; // Not found
    }

    await saveTemplatesToStorage(filtered);
    return true;
  }

  /**
   * Get all templates (built-in + custom)
   * @param {Object} filters - Optional filters
   * @param {string} filters.tag - Filter by tag
   * @param {string} filters.search - Search in name/description
   * @returns {Promise<Array>} All templates
   */
  async function getTemplates(filters = {}) {
    const customTemplates = await getTemplatesFromStorage();
    const allTemplates = [...BUILTIN_TEMPLATES, ...customTemplates];

    let filtered = allTemplates;

    if (filters.tag) {
      filtered = filtered.filter(t => t.tags.includes(filters.tag));
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(search) ||
        (t.description && t.description.toLowerCase().includes(search))
      );
    }

    // Sort: builtins first, then by name
    return filtered.sort((a, b) => {
      if (a.source === 'builtin' && b.source !== 'builtin') return -1;
      if (a.source !== 'builtin' && b.source === 'builtin') return 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Export template as JSON string
   * @param {string} templateId - Template ID to export
   * @returns {Promise<string>} JSON string
   */
  async function exportTemplate(templateId) {
    const template = await getTemplateById(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const exportData = {
      ...clone(template),
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import template from JSON string
   * @param {string} jsonString - JSON string to import
   * @returns {Promise<Object>} Imported template
   */
  async function importTemplate(jsonString) {
    let data;
    try {
      data = JSON.parse(jsonString);
    } catch (e) {
      throw new Error('Invalid JSON format');
    }

    // Validate required fields
    if (!data.name || !data.exercises || !Array.isArray(data.exercises)) {
      throw new Error('Invalid template format: missing required fields');
    }

    // Create new template with new ID
    const imported = {
      id: generateId(),
      name: data.name + (data.source === 'builtin' ? ' (Imported)' : ''),
      description: data.description || '',
      created: new Date().toISOString(),
      type: data.type || 'template',
      source: 'imported',
      exercises: data.exercises.map(ex => ({
        name: ex.name,
        sets: ex.sets || 3,
        reps: ex.reps || '8-10',
        rest: ex.rest || 90,
        notes: ex.notes || ''
      })),
      tags: data.tags || ['imported']
    };

    const templates = await getTemplatesFromStorage();
    templates.push(imported);
    await saveTemplatesToStorage(templates);

    return imported;
  }

  /**
   * Duplicate an existing template
   * @param {string} templateId - Template ID to duplicate
   * @param {string} newName - Name for the duplicate
   * @returns {Promise<Object>} Duplicated template
   */
  async function duplicateTemplate(templateId, newName) {
    const original = await getTemplateById(templateId);
    if (!original) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const duplicate = {
      ...clone(original),
      id: generateId(),
      name: newName || `${original.name} (Copy)`,
      created: new Date().toISOString(),
      source: 'custom'
    };

    const templates = await getTemplatesFromStorage();
    templates.push(duplicate);
    await saveTemplatesToStorage(templates);

    return duplicate;
  }

  /**
   * Update a custom template
   * @param {string} templateId - Template ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated template
   */
  async function updateTemplate(templateId, updates) {
    if (templateId.startsWith('builtin-')) {
      throw new Error('Cannot edit built-in templates');
    }

    const templates = await getTemplatesFromStorage();
    const idx = templates.findIndex(t => t.id === templateId);
    
    if (idx === -1) {
      throw new Error(`Template not found: ${templateId}`);
    }

    templates[idx] = {
      ...templates[idx],
      ...updates,
      id: templateId, // Prevent ID change
      updated: new Date().toISOString()
    };

    await saveTemplatesToStorage(templates);
    return templates[idx];
  }

  // ============================================
  // CUSTOM PROGRAM BUILDER
  // ============================================

  /**
   * Create a custom program with weekly schedule
   * @param {string} name - Program name
   * @param {Array} schedule - Array of {day, dayLabel, exercises}
   * @param {string} description - Optional description
   * @returns {Promise<Object>} Created program
   */
  async function createCustomProgram(name, schedule, description = '') {
    if (!name || !schedule || !Array.isArray(schedule)) {
      throw new Error('Name and schedule array are required');
    }

    const program = {
      id: generateId(),
      name: name.trim(),
      description: description.trim(),
      created: new Date().toISOString(),
      type: 'program',
      source: 'custom',
      schedule: schedule.map(day => ({
        day: day.day,
        dayLabel: day.dayLabel || day.day,
        exercises: day.exercises.map(ex => ({
          name: ex.name,
          sets: ex.sets || 3,
          reps: ex.reps || '8-10',
          rest: ex.rest || 90,
          notes: ex.notes || ''
        }))
      })),
      tags: inferProgramTags(schedule)
    };

    const programs = await getProgramsFromStorage();
    programs.push(program);
    await saveProgramsToStorage(programs);

    return program;
  }

  function inferProgramTags(schedule) {
    const tags = ['custom'];
    const dayCount = schedule.length;
    
    if (dayCount <= 3) tags.push('3-day');
    else if (dayCount <= 4) tags.push('4-day');
    else if (dayCount <= 5) tags.push('5-day');
    else tags.push('6-day');

    return tags;
  }

  /**
   * Edit an existing custom program
   * @param {string} programId - Program ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated program
   */
  async function editProgram(programId, updates) {
    if (programId.startsWith('builtin-')) {
      throw new Error('Cannot edit built-in programs');
    }

    const programs = await getProgramsFromStorage();
    const idx = programs.findIndex(p => p.id === programId);
    
    if (idx === -1) {
      throw new Error(`Program not found: ${programId}`);
    }

    programs[idx] = {
      ...programs[idx],
      ...updates,
      id: programId,
      updated: new Date().toISOString()
    };

    await saveProgramsToStorage(programs);
    return programs[idx];
  }

  /**
   * Delete a custom program
   * @param {string} programId - Program ID to delete
   * @returns {Promise<boolean>} Success
   */
  async function deleteProgram(programId) {
    if (programId.startsWith('builtin-')) {
      throw new Error('Cannot delete built-in programs');
    }

    const programs = await getProgramsFromStorage();
    const filtered = programs.filter(p => p.id !== programId);
    
    if (filtered.length === programs.length) {
      return false;
    }

    await saveProgramsToStorage(filtered);

    // Clear active program if it was this one
    const activeId = await getActiveProgramId();
    if (activeId === programId) {
      await clearActiveProgram();
    }

    return true;
  }

  /**
   * Get all available programs (built-in + custom)
   * @returns {Promise<Array>} All programs
   */
  async function getPrograms() {
    const customPrograms = await getProgramsFromStorage();
    return [...BUILTIN_PROGRAMS, ...customPrograms];
  }

  /**
   * Get a specific program by ID
   */
  async function getProgramById(programId) {
    const builtin = BUILTIN_PROGRAMS.find(p => p.id === programId);
    if (builtin) return builtin;

    const programs = await getProgramsFromStorage();
    return programs.find(p => p.id === programId) || null;
  }

  /**
   * Set active custom program
   * @param {string} programId - Program ID to activate
   */
  async function setActiveProgram(programId) {
    const program = await getProgramById(programId);
    if (!program) {
      throw new Error(`Program not found: ${programId}`);
    }

    await Storage.set(ACTIVE_PROGRAM_KEY, {
      programId,
      activatedAt: new Date().toISOString()
    });

    return program;
  }

  /**
   * Get currently active program ID
   */
  async function getActiveProgramId() {
    const active = await Storage.get(ACTIVE_PROGRAM_KEY, null);
    return active?.programId || null;
  }

  /**
   * Get currently active program full data
   */
  async function getActiveProgram() {
    const programId = await getActiveProgramId();
    if (!programId) return null;
    return await getProgramById(programId);
  }

  /**
   * Clear active program setting
   */
  async function clearActiveProgram() {
    await Storage.set(ACTIVE_PROGRAM_KEY, null);
  }

  /**
   * Convert a program day to a workout template
   * @param {string} programId - Program ID
   * @param {string} dayLabel - Day label to convert
   */
  async function getProgramDayAsTemplate(programId, dayLabel) {
    const program = await getProgramById(programId);
    if (!program) {
      throw new Error(`Program not found: ${programId}`);
    }

    const day = program.schedule.find(d => d.dayLabel === dayLabel);
    if (!day) {
      throw new Error(`Day not found: ${dayLabel}`);
    }

    return {
      name: `${program.name} - ${day.dayLabel}`,
      exercises: clone(day.exercises),
      fromProgram: programId
    };
  }

  // ============================================
  // EXPORT PUBLIC API
  // ============================================
  return {
    // Template Management
    saveAsTemplate,
    loadTemplate,
    deleteTemplate,
    getTemplates,
    getTemplateById,
    exportTemplate,
    importTemplate,
    duplicateTemplate,
    updateTemplate,

    // Custom Program Builder
    createCustomProgram,
    editProgram,
    deleteProgram,
    getPrograms,
    getProgramById,
    setActiveProgram,
    getActiveProgramId,
    getActiveProgram,
    clearActiveProgram,
    getProgramDayAsTemplate,

    // Built-in access (for UI reference)
    BUILTIN_TEMPLATES,
    BUILTIN_PROGRAMS
  };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Templates;
}
