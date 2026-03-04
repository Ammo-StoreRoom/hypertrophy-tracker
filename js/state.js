// ============================================
// STATE — Centralized reactive state management
// ============================================

const DEFAULT_STATE = {
  phase: "rampup",
  rampWeek: "Week 1",
  rampDayIdx: 0,
  mesoWeek: 1,
  pplIdx: 0,
  program: "standard",
  units: "lbs",
  customExercises: [],
  fatigueFlags: 0,
  longestStreak: 0,
  allowedPrograms: ['standard', 'glute-focus'],
  goals: { targetWeight: 0, lifts: {} },
  manualPRs: {}
};

const Store = {
  // Core state
  state: null,
  history: [],
  bodyWeights: [],
  measurements: [],
  
  // UI state (not persisted)
  screen: 'login',
  activeDay: null,
  inputs: {},
  workoutStart: null,
  restTimer: 0,
  restEndTime: null,
  restInterval: null,
  elapsedInterval: null,
  modal: null,
  expandedEntries: {},
  loginPinValue: '',
  workoutExercises: [],
  exerciseNotes: {},
  expandedPlateCalc: {},
  expandedWarmup: {},
  supersets: [],
  restPauseExercises: {},
  editingEntryId: null,
  exerciseLastSetTime: {}, // Track last set completion time per exercise
  sameWeightEnabled: {}, // Track "same weight" toggle per exercise
  showMeasureTrends: false,
  expandedPRInput: {},
  prToasts: [],
  undoEntry: null,
  undoPrevState: null,
  undoTimeout: null,
  theme: 'dark',
  isOnline: navigator.onLine,
  deferredPrompt: null,
  installDismissed: false,
  pullY: 0,
  pullActive: false,
  pullDist: 0,
  
  // Admin state
  adminUsers: null,
  adminExpanded: {},
  adminLoading: false,
  adminDiag: null,
  
  // Constants
  ADMIN_PIN: '01131998',
  ALL_PROGRAMS: [['standard', 'Standard PPL'], ['glute-focus', 'Glute-Focus PPL']],
  
  /**
   * Initialize state from storage
   */
  async init() {
    this.state = await Storage.get('state', { ...DEFAULT_STATE });
    this.history = await Storage.get('history', []);
    this.bodyWeights = await Storage.get('bodyWeights', []);
    this.measurements = await Storage.get('measurements', []);
    
    // Ensure defaults for new fields
    if (this.state.rampDayIdx === undefined) this.state.rampDayIdx = 0;
    if (!this.state.program) this.state.program = 'standard';
    if (!this.state.units) this.state.units = 'lbs';
    if (!this.state.allowedPrograms) this.state.allowedPrograms = ['standard', 'glute-focus'];
    if (!this.state.goals) this.state.goals = { targetWeight: 0, lifts: {} };
    if (!this.state.manualPRs) this.state.manualPRs = {};
    
    this.initTheme();
    this.setupListeners();
  },
  
  /**
   * Set up Firebase listeners for real-time sync
   */
  setupListeners() {
    Storage.listen('state', val => {
      if (this.screen !== 'workout' && val) {
        this.state = val;
        if (this.state.rampDayIdx === undefined) this.state.rampDayIdx = 0;
        if (!this.state.program) this.state.program = 'standard';
        if (!this.state.allowedPrograms) this.state.allowedPrograms = ['standard', 'glute-focus'];
        Router.render();
      }
    });
    
    Storage.listen('history', val => {
      if (this.screen !== 'workout') {
        this.history = val || [];
        Router.render();
      }
    });
    
    Storage.listen('bodyWeights', val => {
      this.bodyWeights = Array.isArray(val) ? val : [];
      if (this.screen !== 'workout') Router.render();
    });
    
    Storage.listen('measurements', val => {
      this.measurements = Array.isArray(val) ? val : [];
      if (this.screen !== 'workout') Router.render();
    });
  },
  
  /**
   * Update state and persist to storage
   */
  async setState(newState) {
    this.state = { ...this.state, ...newState };
    await Storage.set('state', this.state);
    Router.render();
  },
  
  /**
   * Update history and persist
   */
  async setHistory(newHistory) {
    this.history = newHistory;
    await Storage.set('history', this.history);
    Router.render();
  },
  
  /**
   * Update body weights and persist
   */
  async setBodyWeights(newBodyWeights) {
    this.bodyWeights = newBodyWeights;
    await Storage.set('bodyWeights', this.bodyWeights);
    Router.render();
  },
  
  /**
   * Update measurements and persist
   */
  async setMeasurements(newMeasurements) {
    this.measurements = newMeasurements;
    await Storage.set('measurements', this.measurements);
    Router.render();
  },
  
  /**
   * Navigate to a screen
   */
  navigateTo(screenName) {
    if (this.screen === 'workout' && screenName !== 'workout') {
      // Prevent accidental navigation away from workout
      return;
    }
    this.screen = screenName;
    if (screenName === 'admin' && !this.adminUsers) {
      // Load admin data when first visiting admin
      setTimeout(() => loadAdminData?.(), 0);
    }
    Router.render();
  },
  
  /**
   * Check if current user is admin
   */
  isAdmin() {
    return Storage.getPin() === this.ADMIN_PIN;
  },
  
  /**
   * Initialize theme from localStorage
   */
  initTheme() {
    const saved = localStorage.getItem('ht-theme') || 'dark';
    this.setTheme(saved);
  },
  
  /**
   * Set theme (dark, light, or auto)
   */
  setTheme(t) {
    this.theme = t;
    let actual = t;
    if (t === 'auto') {
      actual = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', actual);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', actual === 'light' ? '#f5f5f7' : '#080810');
    }
    localStorage.setItem('ht-theme', t);
  },
  
  /**
   * Show modal
   */
  showModal(modalConfig) {
    this.modal = modalConfig;
    Router.render();
  },
  
  /**
   * Close modal
   */
  closeModal() {
    this.modal?.onCancel?.();
    this.modal = null;
    Router.render();
  },
  
  /**
   * Check if online
   */
  updateOnlineStatus(online) {
    this.isOnline = online;
    Router.render();
  },
  
  /**
   * Get current program data
   */
  getProgram() {
    return PROGRAMS[this.state?.program] || PROGRAMS.standard;
  },
  
  /**
   * Get current RIR target
   */
  getRIR() {
    if (!this.state) return '3 RIR';
    if (this.state.phase === 'rampup') {
      return this.state.rampWeek === 'Week 1' ? '4 RIR' : '2-3 RIR';
    }
    const MESO_RIR = { 1: "3 RIR", 2: "2 RIR", 3: "1 RIR", 4: "DELOAD" };
    return MESO_RIR[this.state.mesoWeek] || '3 RIR';
  },
  
  /**
   * Get exercises for a specific day
   */
  getExercises(day) {
    const program = this.getProgram();
    if (this.state.phase === 'rampup') {
      return program.rampup[this.state.rampWeek]?.[day] || [];
    }
    return program.ppl.find(p => p.label === day)?.exercises || [];
  },
  
  /**
   * Get all days for current program/phase
   */
  getDays() {
    const program = this.getProgram();
    if (this.state.phase === 'rampup') {
      return Object.keys(program.rampup[this.state.rampWeek] || {});
    }
    return program.ppl.map(p => p.label);
  },
  
  /**
   * Get next scheduled workout day
   */
  getNextDay() {
    const program = this.getProgram();
    if (this.state.phase === 'rampup') {
      const days = Object.keys(program.rampup[this.state.rampWeek] || {});
      return days[this.state.rampDayIdx] || days[0];
    }
    return program.ppl[this.state.pplIdx]?.label;
  },
  
  /**
   * Get last performance for an exercise
   */
  getLastForEx(name) {
    for (const w of this.history) {
      const ex = w.exercises?.find(e => e.name === name);
      if (ex?.sets?.some(s => s.weight)) return ex;
    }
    return null;
  },
  
  /**
   * Get PR for an exercise
   */
  getPR(name) {
    let best = 0;
    for (const w of this.history) {
      const ex = w.exercises?.find(e => e.name === name);
      if (ex) {
        for (const s of (ex.sets || [])) {
          const wt = parseFloat(s.weight) || 0;
          if (wt > best) best = wt;
        }
      }
    }
    const manual = this.state.manualPRs?.[name];
    if (manual?.weight && parseFloat(manual.weight) > best) {
      best = parseFloat(manual.weight);
    }
    return best;
  },
  
  /**
   * Get manual PR entry
   */
  getManualPR(name) {
    return this.state.manualPRs?.[name] || null;
  },
  
  /**
   * Set manual PR
   */
  async setManualPR(name, weight, e1rm) {
    if (!this.state.manualPRs) this.state.manualPRs = {};
    this.state.manualPRs[name] = {
      weight: parseFloat(weight) || 0,
      e1rm: parseFloat(e1rm) || 0,
      date: new Date().toISOString().split('T')[0]
    };
    await this.setState(this.state);
  },
  
  /**
   * Reset all data
   */
  async resetAll() {
    this.state = { ...DEFAULT_STATE };
    this.history = [];
    this.bodyWeights = [];
    this.measurements = [];
    await Storage.set('state', this.state);
    await Storage.set('history', this.history);
    await Storage.set('bodyWeights', this.bodyWeights);
    await Storage.set('measurements', this.measurements);
    Router.render();
  }
};

// Make Store globally available
window.Store = Store;
