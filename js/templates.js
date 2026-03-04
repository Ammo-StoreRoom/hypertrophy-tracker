// ============================================
// WORKOUT TEMPLATES MODULE — User-facing API
// ============================================

/**
 * Templates module provides the public interface for workout template management.
 * Built-in templates, user-created templates, and custom programs are all supported.
 * 
 * Template data structure:
 * {
 *   id: string,
 *   name: string,
 *   description: string,
 *   created: string (ISO date),
 *   type: 'template' | 'program',
 *   source: 'builtin' | 'custom' | 'imported',
 *   exercises: [{ name, sets, reps, rest, notes }],
 *   days?: [{ dayLabel, exercises: [...] }],  // For multi-day programs
 *   tags: string[]
 * }
 */

const Templates = {
  // ============================================
  // BUILT-IN TEMPLATES (Single workout templates)
  // ============================================
  BUILT_IN: {
    'strength-focus': {
      id: 'strength-focus',
      name: 'Strength Focus',
      description: 'Lower reps, higher weight for maximum strength gains',
      type: 'template',
      source: 'builtin',
      tags: ['strength', 'compound', 'heavy'],
      days: [{
        dayLabel: 'Strength Day',
        exercises: [
          { name: 'Barbell Bench Press', sets: 5, reps: '3-5', rest: 180, notes: 'Heavy compound' },
          { name: 'Barbell Back Squat', sets: 5, reps: '3-5', rest: 240, notes: 'Heavy compound' },
          { name: 'Overhead Press (BB)', sets: 4, reps: '4-6', rest: 150, notes: 'Heavy compound' },
          { name: 'Barbell Row (heavy)', sets: 4, reps: '4-6', rest: 150, notes: 'Heavy compound' },
          { name: 'Weighted Pull-Ups', sets: 4, reps: '4-6', rest: 150, notes: 'Add weight if possible' },
          { name: 'Romanian Deadlift', sets: 3, reps: '6-8', rest: 150, notes: 'Controlled descent' }
        ]
      }]
    },
    'hypertrophy-focus': {
      id: 'hypertrophy-focus',
      name: 'Hypertrophy Focus',
      description: 'Moderate reps and rest for optimal muscle growth',
      type: 'template',
      source: 'builtin',
      tags: ['hypertrophy', 'balanced', 'moderate'],
      days: [{
        dayLabel: 'Hypertrophy Day',
        exercises: [
          { name: 'Barbell Bench Press', sets: 4, reps: '8-10', rest: 120, notes: '' },
          { name: 'Incline DB Press', sets: 4, reps: '10-12', rest: 90, notes: '' },
          { name: 'Cable Flye (low-high)', sets: 3, reps: '12-15', rest: 60, notes: 'Squeeze at top' },
          { name: 'Lat Pulldown (wide)', sets: 4, reps: '10-12', rest: 90, notes: '' },
          { name: 'Cable Row (V-bar)', sets: 4, reps: '10-12', rest: 90, notes: '' },
          { name: 'Barbell Curl', sets: 3, reps: '10-12', rest: 60, notes: '' },
          { name: 'Cable Pushdown (rope)', sets: 3, reps: '12-15', rest: 60, notes: '' }
        ]
      }]
    },
    'endurance-focus': {
      id: 'endurance-focus',
      name: 'Endurance Focus',
      description: 'Higher reps, shorter rest for muscular endurance',
      type: 'template',
      source: 'builtin',
      tags: ['endurance', 'high-reps', 'quick'],
      days: [{
        dayLabel: 'Endurance Day',
        exercises: [
          { name: 'Goblet Squat (DB)', sets: 3, reps: '15-20', rest: 45, notes: 'Light weight, continuous motion' },
          { name: 'Push-Ups', sets: 3, reps: '15-20', rest: 45, notes: 'To failure' },
          { name: 'Lat Pulldown (wide)', sets: 3, reps: '15-20', rest: 45, notes: 'Controlled tempo' },
          { name: 'Walking Lunges (BW)', sets: 3, reps: '20/leg', rest: 45, notes: 'No rest between legs' },
          { name: 'Cable Face Pull', sets: 3, reps: '20', rest: 30, notes: 'Focus on rear delts' },
          { name: 'Plank', sets: 3, reps: '60s', rest: 30, notes: 'Core engagement' }
        ]
      }]
    },
    'minimalist': {
      id: 'minimalist',
      name: 'Minimalist',
      description: '3 days per week full body - maximum efficiency',
      type: 'program',
      source: 'builtin',
      tags: ['minimalist', '3-day', 'full-body', 'beginner-friendly'],
      days: [
        {
          dayLabel: 'Day A',
          exercises: [
            { name: 'Barbell Back Squat', sets: 3, reps: '8-10', rest: 120, notes: '' },
            { name: 'Barbell Bench Press', sets: 3, reps: '8-10', rest: 120, notes: '' },
            { name: 'Barbell Row (overhand)', sets: 3, reps: '8-10', rest: 90, notes: '' },
            { name: 'Overhead Press (BB)', sets: 3, reps: '8-10', rest: 90, notes: '' },
            { name: 'Lat Pulldown (wide)', sets: 3, reps: '10-12', rest: 90, notes: '' },
            { name: 'Barbell Curl', sets: 2, reps: '10-12', rest: 60, notes: '' }
          ]
        },
        {
          dayLabel: 'Day B',
          exercises: [
            { name: 'Romanian Deadlift', sets: 3, reps: '8-10', rest: 120, notes: '' },
            { name: 'Incline DB Press', sets: 3, reps: '10-12', rest: 90, notes: '' },
            { name: 'Weighted Pull-Ups', sets: 3, reps: '6-8', rest: 120, notes: '' },
            { name: 'DB Lateral Raise', sets: 3, reps: '12-15', rest: 60, notes: '' },
            { name: 'Cable Pushdown (rope)', sets: 3, reps: '10-12', rest: 60, notes: '' },
            { name: 'Standing Calf Raise', sets: 3, reps: '12-15', rest: 60, notes: '' }
          ]
        },
        {
          dayLabel: 'Day C',
          exercises: [
            { name: 'Front Squat (BB)', sets: 3, reps: '8-10', rest: 120, notes: '' },
            { name: 'DB Bench Press', sets: 3, reps: '10-12', rest: 90, notes: '' },
            { name: 'Cable Row (V-bar)', sets: 3, reps: '10-12', rest: 90, notes: '' },
            { name: 'BB Hip Thrust', sets: 3, reps: '10-12', rest: 90, notes: '' },
            { name: 'Cable Face Pull', sets: 3, reps: '15-20', rest: 60, notes: '' },
            { name: 'Seated Calf Raise', sets: 3, reps: '15-20', rest: 45, notes: '' }
          ]
        }
      ]
    },
    'bro-split': {
      id: 'bro-split',
      name: 'Bro Split',
      description: 'One muscle group per day - classic bodybuilding',
      type: 'program',
      source: 'builtin',
      tags: ['bro-split', '5-day', 'bodybuilding', 'isolation'],
      days: [
        {
          dayLabel: 'Chest Day',
          exercises: [
            { name: 'Barbell Bench Press', sets: 4, reps: '8-10', rest: 120, notes: '' },
            { name: 'Incline DB Press', sets: 4, reps: '10-12', rest: 90, notes: '' },
            { name: 'Cable Flye (low-high)', sets: 4, reps: '12-15', rest: 60, notes: 'Squeeze at top' },
            { name: 'Cable Crossover', sets: 3, reps: '12-15', rest: 60, notes: '' },
            { name: 'Weighted Dips', sets: 3, reps: '10-12', rest: 90, notes: '' }
          ]
        },
        {
          dayLabel: 'Back Day',
          exercises: [
            { name: 'Weighted Pull-Ups', sets: 4, reps: '6-8', rest: 120, notes: '' },
            { name: 'Barbell Row (heavy)', sets: 4, reps: '6-8', rest: 120, notes: '' },
            { name: 'Lat Pulldown (wide)', sets: 4, reps: '10-12', rest: 90, notes: '' },
            { name: 'DB Row (single arm)', sets: 3, reps: '10-12/side', rest: 60, notes: '' },
            { name: 'Cable Straight-Arm Pull', sets: 3, reps: '12-15', rest: 60, notes: '' }
          ]
        },
        {
          dayLabel: 'Shoulders Day',
          exercises: [
            { name: 'Overhead Press (BB)', sets: 4, reps: '6-8', rest: 120, notes: '' },
            { name: 'Arnold Press (DB)', sets: 3, reps: '10-12', rest: 90, notes: '' },
            { name: 'DB Lateral Raise', sets: 4, reps: '12-15', rest: 60, notes: '' },
            { name: 'Cable Lateral Raise', sets: 3, reps: '12-15', rest: 60, notes: '' },
            { name: 'Cable Face Pull', sets: 4, reps: '15-20', rest: 60, notes: 'Rear delt focus' }
          ]
        },
        {
          dayLabel: 'Arms Day',
          exercises: [
            { name: 'Barbell Curl', sets: 4, reps: '8-10', rest: 90, notes: '' },
            { name: 'Incline DB Curl', sets: 3, reps: '10-12', rest: 60, notes: '' },
            { name: 'Cable Hammer Curl', sets: 3, reps: '10-12', rest: 60, notes: '' },
            { name: 'Cable Pushdown (rope)', sets: 4, reps: '10-12', rest: 60, notes: '' },
            { name: 'Cable OH Tricep Ext', sets: 3, reps: '10-12', rest: 60, notes: '' },
            { name: 'Dips (BW to failure)', sets: 3, reps: 'AMRAP', rest: 60, notes: '' }
          ]
        },
        {
          dayLabel: 'Legs Day',
          exercises: [
            { name: 'Barbell Back Squat', sets: 4, reps: '6-8', rest: 180, notes: '' },
            { name: 'Romanian Deadlift', sets: 4, reps: '8-10', rest: 120, notes: '' },
            { name: 'Bulgarian Split Squat', sets: 3, reps: '10-12/leg', rest: 90, notes: '' },
            { name: 'BB Hip Thrust', sets: 3, reps: '10-12', rest: 90, notes: '' },
            { name: 'Standing Calf Raise', sets: 4, reps: '12-15', rest: 60, notes: '' },
            { name: 'Seated Calf Raise', sets: 3, reps: '15-20', rest: 45, notes: '' }
          ]
        }
      ]
    },
    'upper-lower': {
      id: 'upper-lower',
      name: 'Upper/Lower Split',
      description: 'Classic 4-day upper/lower split for balanced development',
      type: 'program',
      source: 'builtin',
      tags: ['upper-lower', '4-day', 'intermediate', 'balanced'],
      days: [
        {
          dayLabel: 'Upper A',
          exercises: [
            { name: 'Barbell Bench Press', sets: 4, reps: '6-8', rest: 120, notes: '' },
            { name: 'Weighted Pull-Ups', sets: 4, reps: '6-8', rest: 120, notes: '' },
            { name: 'Overhead Press (BB)', sets: 3, reps: '8-10', rest: 90, notes: '' },
            { name: 'Barbell Row (heavy)', sets: 3, reps: '8-10', rest: 90, notes: '' },
            { name: 'Incline DB Press', sets: 3, reps: '10-12', rest: 90, notes: '' },
            { name: 'Barbell Curl', sets: 3, reps: '10-12', rest: 60, notes: '' }
          ]
        },
        {
          dayLabel: 'Lower A',
          exercises: [
            { name: 'Barbell Back Squat', sets: 4, reps: '6-8', rest: 180, notes: '' },
            { name: 'Romanian Deadlift', sets: 4, reps: '8-10', rest: 120, notes: '' },
            { name: 'Bulgarian Split Squat', sets: 3, reps: '10-12/leg', rest: 90, notes: '' },
            { name: 'Standing Calf Raise', sets: 4, reps: '12-15', rest: 60, notes: '' },
            { name: 'Cable Pull-Through', sets: 3, reps: '12-15', rest: 60, notes: '' }
          ]
        },
        {
          dayLabel: 'Upper B',
          exercises: [
            { name: 'Incline BB Bench', sets: 4, reps: '8-10', rest: 90, notes: '' },
            { name: 'Lat Pulldown (V-bar)', sets: 4, reps: '10-12', rest: 90, notes: '' },
            { name: 'DB Bench Press', sets: 3, reps: '10-12', rest: 90, notes: '' },
            { name: 'Cable Row (V-bar)', sets: 3, reps: '10-12', rest: 90, notes: '' },
            { name: 'DB Lateral Raise', sets: 3, reps: '12-15', rest: 60, notes: '' },
            { name: 'Cable Pushdown (rope)', sets: 3, reps: '10-12', rest: 60, notes: '' }
          ]
        },
        {
          dayLabel: 'Lower B',
          exercises: [
            { name: 'Front Squat (BB)', sets: 4, reps: '8-10', rest: 120, notes: '' },
            { name: 'BB Hip Thrust', sets: 4, reps: '8-10', rest: 90, notes: '' },
            { name: 'Walking Lunges (DB)', sets: 3, reps: '12/leg', rest: 90, notes: '' },
            { name: 'Seated Calf Raise', sets: 4, reps: '15-20', rest: 45, notes: '' },
            { name: 'Stiff-Leg DL (DB)', sets: 3, reps: '10-12', rest: 90, notes: '' }
          ]
        }
      ]
    }
  },

  // ============================================
  // STORAGE KEYS
  // ============================================
  _STORAGE_KEY: 'user_templates_v1',
  _ACTIVE_TEMPLATE_KEY: 'active_template_v1',

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  /**
   * Get all templates (built-in + user-created)
   * @returns {Promise<Array>} All templates
   */
  async getAll() {
    const userTemplates = await this._getUserTemplates();
    const builtinTemplates = Object.values(this.BUILT_IN);
    return [...builtinTemplates, ...userTemplates];
  },

  /**
   * Get a specific template by ID
   * @param {string} id - Template ID
   * @returns {Promise<Object|null>} Template or null if not found
   */
  async get(id) {
    // Check built-in first
    if (this.BUILT_IN[id]) {
      return { ...this.BUILT_IN[id] };
    }
    // Check user templates
    const userTemplates = await this._getUserTemplates();
    const template = userTemplates.find(t => t.id === id);
    return template ? { ...template } : null;
  },

  /**
   * Save a new or update an existing template
   * @param {Object} template - Template object
   * @returns {Promise<Object>} Saved template
   */
  async save(template) {
    if (!template.name) {
      throw new Error('Template name is required');
    }
    if (!template.days || !Array.isArray(template.days) || template.days.length === 0) {
      throw new Error('Template must have at least one day with exercises');
    }

    const userTemplates = await this._getUserTemplates();
    const now = new Date().toISOString();

    // If updating existing
    if (template.id) {
      const idx = userTemplates.findIndex(t => t.id === template.id);
      if (idx === -1) {
        throw new Error('Template not found');
      }
      userTemplates[idx] = {
        ...userTemplates[idx],
        ...template,
        updated: now
      };
      await this._saveUserTemplates(userTemplates);
      return userTemplates[idx];
    }

    // Create new template
    const newTemplate = {
      id: this._generateId(),
      name: template.name,
      description: template.description || '',
      type: template.type || 'template',
      source: 'custom',
      tags: template.tags || ['custom'],
      days: template.days,
      created: now
    };

    userTemplates.push(newTemplate);
    await this._saveUserTemplates(userTemplates);
    return newTemplate;
  },

  /**
   * Delete a user template
   * @param {string} id - Template ID to delete
   * @returns {Promise<boolean>} Success
   */
  async delete(id) {
    // Cannot delete built-in templates
    if (this.BUILT_IN[id]) {
      throw new Error('Cannot delete built-in templates');
    }

    const userTemplates = await this._getUserTemplates();
    const filtered = userTemplates.filter(t => t.id !== id);
    
    if (filtered.length === userTemplates.length) {
      return false; // Not found
    }

    await this._saveUserTemplates(filtered);
    
    // Clear active template if it was this one
    const active = await this._getActiveTemplateId();
    if (active === id) {
      await this._setActiveTemplateId(null);
    }
    
    return true;
  },

  /**
   * Duplicate an existing template
   * @param {string} id - Template ID to duplicate
   * @returns {Promise<Object>} Duplicated template
   */
  async duplicate(id) {
    const original = await this.get(id);
    if (!original) {
      throw new Error('Template not found');
    }

    const { id: _, created, updated, ...rest } = original;
    
    const duplicate = {
      ...rest,
      id: this._generateId(),
      name: `${original.name} (Copy)`,
      source: 'custom',
      created: new Date().toISOString()
    };

    const userTemplates = await this._getUserTemplates();
    userTemplates.push(duplicate);
    await this._saveUserTemplates(userTemplates);

    return duplicate;
  },

  // ============================================
  // APPLY TEMPLATE TO PROGRAM
  // ============================================

  /**
   * Apply a template to create a custom program
   * @param {string} templateId - Template ID to apply
   * @param {Object} options - Apply options
   * @param {boolean} options.startFromRampup - Whether to start from ramp-up phase
   * @returns {Promise<Object>} Applied program info
   */
  async applyToProgram(templateId, options = {}) {
    const template = await this.get(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const { startFromRampup = true } = options;

    // Store as active custom program
    await this._setActiveTemplateId(templateId);

    // Return program configuration
    return {
      templateId,
      templateName: template.name,
      type: template.type,
      dayCount: template.days.length,
      startFromRampup,
      appliedAt: new Date().toISOString()
    };
  },

  /**
   * Get currently active template
   * @returns {Promise<Object|null>} Active template or null
   */
  async getActiveTemplate() {
    const activeId = await this._getActiveTemplateId();
    if (!activeId) return null;
    return this.get(activeId);
  },

  /**
   * Clear active template
   * @returns {Promise<void>}
   */
  async clearActiveTemplate() {
    await this._setActiveTemplateId(null);
  },

  // ============================================
  // EXPORT/IMPORT
  // ============================================

  /**
   * Export a single template as JSON
   * @param {string} templateId - Template ID to export
   * @returns {Promise<string>} JSON string
   */
  async exportToJSON(templateId) {
    const template = await this.get(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const exportData = {
      ...template,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    return JSON.stringify(exportData, null, 2);
  },

  /**
   * Export all user templates as JSON
   * @returns {Promise<string>} JSON string
   */
  async exportAll() {
    const userTemplates = await this._getUserTemplates();
    const exportData = {
      templates: userTemplates,
      exportedAt: new Date().toISOString(),
      version: '1.0',
      count: userTemplates.length
    };
    return JSON.stringify(exportData, null, 2);
  },

  /**
   * Import templates from JSON
   * @param {string} json - JSON string to import
   * @returns {Promise<Array>} Imported templates
   */
  async importFromJSON(json) {
    let data;
    try {
      data = JSON.parse(json);
    } catch (e) {
      throw new Error('Invalid JSON format');
    }

    const userTemplates = await this._getUserTemplates();
    const imported = [];

    // Handle array of templates
    const templatesToImport = data.templates || (Array.isArray(data) ? data : [data]);

    for (const template of templatesToImport) {
      // Validate required fields
      if (!template.name || !template.days || !Array.isArray(template.days)) {
        console.warn('Skipping invalid template:', template);
        continue;
      }

      // Create new template with new ID
      const newTemplate = {
        id: this._generateId(),
        name: template.name + (template.source === 'builtin' ? ' (Imported)' : ''),
        description: template.description || '',
        type: template.type || 'template',
        source: 'imported',
        tags: template.tags || ['imported'],
        days: template.days.map(day => ({
          dayLabel: day.dayLabel || 'Day',
          exercises: (day.exercises || []).map(ex => ({
            name: ex.name || 'Exercise',
            sets: ex.sets || 3,
            reps: ex.reps || '8-10',
            rest: ex.rest || 90,
            notes: ex.notes || ''
          }))
        })),
        created: new Date().toISOString()
      };

      userTemplates.push(newTemplate);
      imported.push(newTemplate);
    }

    await this._saveUserTemplates(userTemplates);
    return imported;
  },

  // ============================================
  // TEMPLATE BUILDER HELPERS
  // ============================================

  /**
   * Validate a template structure
   * @param {Object} template - Template to validate
   * @returns {Object} Validation result { valid: boolean, errors: string[] }
   */
  validateTemplate(template) {
    const errors = [];

    if (!template.name || template.name.trim().length === 0) {
      errors.push('Template name is required');
    }

    if (!template.days || !Array.isArray(template.days) || template.days.length === 0) {
      errors.push('Template must have at least one day');
    } else {
      template.days.forEach((day, idx) => {
        if (!day.exercises || !Array.isArray(day.exercises) || day.exercises.length === 0) {
          errors.push(`Day ${idx + 1} must have at least one exercise`);
        } else {
          day.exercises.forEach((ex, exIdx) => {
            if (!ex.name || ex.name.trim().length === 0) {
              errors.push(`Day ${idx + 1}, Exercise ${exIdx + 1}: Name is required`);
            }
            if (!ex.sets || ex.sets < 1) {
              errors.push(`Day ${idx + 1}, Exercise ${exIdx + 1}: Sets must be at least 1`);
            }
            if (!ex.reps || ex.reps.trim().length === 0) {
              errors.push(`Day ${idx + 1}, Exercise ${exIdx + 1}: Reps is required`);
            }
          });
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Create an empty day structure
   * @returns {Object} Empty day object
   */
  createEmptyDay() {
    return {
      dayLabel: 'New Day',
      exercises: []
    };
  },

  /**
   * Create an empty exercise structure
   * @returns {Object} Empty exercise object
   */
  createEmptyExercise() {
    return {
      name: '',
      sets: 3,
      reps: '8-10',
      rest: 90,
      notes: ''
    };
  },

  /**
   * Get exercise library for template builder
   * @returns {Array} Exercise options grouped by muscle group
   */
  getExerciseLibrary() {
    if (typeof MUSCLE_GROUPS === 'undefined') {
      return [];
    }

    return Object.entries(MUSCLE_GROUPS).map(([group, exercises]) => ({
      group,
      exercises: exercises.map(name => ({ name, group }))
    }));
  },

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  _generateId() {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  async _getUserTemplates() {
    try {
      const data = localStorage.getItem(this._STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error loading user templates:', e);
      return [];
    }
  },

  async _saveUserTemplates(templates) {
    try {
      localStorage.setItem(this._STORAGE_KEY, JSON.stringify(templates));
    } catch (e) {
      console.error('Error saving user templates:', e);
      throw new Error('Failed to save template');
    }
  },

  async _getActiveTemplateId() {
    try {
      const data = localStorage.getItem(this._ACTIVE_TEMPLATE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  async _setActiveTemplateId(id) {
    try {
      if (id) {
        localStorage.setItem(this._ACTIVE_TEMPLATE_KEY, JSON.stringify(id));
      } else {
        localStorage.removeItem(this._ACTIVE_TEMPLATE_KEY);
      }
    } catch (e) {
      console.error('Error setting active template:', e);
    }
  }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Templates;
}
