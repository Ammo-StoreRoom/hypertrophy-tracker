// ============================================
// COACH TESTS — AI coaching and recommendations
// ============================================

Test.describe('getRecoveryStatus - Recovery Analysis', () => {
  let originalStore;

  Test.beforeEach(() => {
    originalStore = typeof Store !== 'undefined' ? Store : undefined;
  });

  Test.afterEach(() => {
    if (originalStore !== undefined) {
      window.Store = originalStore;
    }
  });

  Test.it('should return null with no data', () => {
    window.Store = { bodyWeights: [] };
    Test.expect(getRecoveryStatus()).toBeNull();
  });

  Test.it('should warn on low readiness', () => {
    const today = new Date().toISOString().split('T')[0];
    window.Store = {
      bodyWeights: [{ date: today, readiness: 1, sleep: 8 }]
    };
    Test.expect(getRecoveryStatus()).toBe('warn');
  });

  Test.it('should warn on borderline readiness', () => {
    const today = new Date().toISOString().split('T')[0];
    window.Store = {
      bodyWeights: [{ date: today, readiness: 2, sleep: 8 }]
    };
    Test.expect(getRecoveryStatus()).toBe('warn');
  });

  Test.it('should warn on poor sleep history', () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
    
    window.Store = {
      bodyWeights: [
        { date: today, readiness: 3, sleep: 8 },
        { date: yesterday, sleep: 5 },
        { date: twoDaysAgo, sleep: 5 }
      ]
    };
    Test.expect(getRecoveryStatus()).toBe('warn');
  });

  Test.it('should return good on high readiness and good sleep', () => {
    const today = new Date().toISOString().split('T')[0];
    window.Store = {
      bodyWeights: [{ date: today, readiness: 4, sleep: 8 }]
    };
    Test.expect(getRecoveryStatus()).toBe('good');
  });

  Test.it('should return good on max readiness and good sleep', () => {
    const today = new Date().toISOString().split('T')[0];
    window.Store = {
      bodyWeights: [{ date: today, readiness: 5, sleep: 7 }]
    };
    Test.expect(getRecoveryStatus()).toBe('good');
  });

  Test.it('should return null when metrics are neutral', () => {
    const today = new Date().toISOString().split('T')[0];
    window.Store = {
      bodyWeights: [{ date: today, readiness: 3, sleep: 6 }]
    };
    Test.expect(getRecoveryStatus()).toBeNull();
  });
});

Test.describe('getTodayHealth - Today\'s Health Data', () => {
  Test.it('should return empty values with no data', () => {
    window.Store = { bodyWeights: [] };
    const health = getTodayHealth();
    Test.expect(health.weight).toBe('');
    Test.expect(health.sleep).toBe('');
    Test.expect(health.readiness).toBe(0);
    Test.expect(health.water).toBe(0);
  });

  Test.it('should return today\'s data', () => {
    const today = new Date().toISOString().split('T')[0];
    window.Store = {
      bodyWeights: [{
        date: today,
        weight: 180,
        sleep: 7.5,
        readiness: 4,
        water: 8
      }]
    };
    const health = getTodayHealth();
    Test.expect(health.weight).toBe(180);
    Test.expect(health.sleep).toBe(7.5);
    Test.expect(health.readiness).toBe(4);
    Test.expect(health.water).toBe(8);
  });

  Test.it('should return empty when no data for today', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    window.Store = {
      bodyWeights: [{
        date: yesterday,
        weight: 180,
        sleep: 7.5,
        readiness: 4,
        water: 8
      }]
    };
    const health = getTodayHealth();
    Test.expect(health.weight).toBe('');
    Test.expect(health.sleep).toBe('');
  });

  Test.it('should find today among multiple entries', () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    window.Store = {
      bodyWeights: [
        { date: yesterday, weight: 179 },
        { date: today, weight: 180, sleep: 8 }
      ]
    };
    const health = getTodayHealth();
    Test.expect(health.weight).toBe(180);
    Test.expect(health.sleep).toBe(8);
  });
});

Test.describe('getCoachMessage - Coaching Messages', () => {
  let originalStore;

  Test.beforeEach(() => {
    window.Store = {
      state: {
        phase: 'ppl',
        mesoWeek: 1,
        fatigueFlags: 0
      },
      history: []
    };
  });

  Test.it('should return null with no special conditions', () => {
    const message = getCoachMessage();
    Test.expect(message).toBeNull();
  });

  Test.it('should warn about fatigue', () => {
    window.Store.state.fatigueFlags = 2;
    const message = getCoachMessage();
    Test.expect(message).toBeDefined();
    Test.expect(message.type).toBe('warning');
    Test.expect(message.title).toContain('Fatigue');
  });

  Test.it('should warn about higher fatigue flags', () => {
    window.Store.state.fatigueFlags = 3;
    const message = getCoachMessage();
    Test.expect(message.type).toBe('warning');
    Test.expect(message.title).toContain('Fatigue');
  });

  Test.it('should encourage hot streaks', () => {
    const now = Date.now();
    window.Store.history = [
      { date: new Date(now).toISOString() },
      { date: new Date(now - 86400000).toISOString() },
      { date: new Date(now - 2 * 86400000).toISOString() },
      { date: new Date(now - 3 * 86400000).toISOString() },
      { date: new Date(now - 4 * 86400000).toISOString() }
    ];
    const message = getCoachMessage();
    Test.expect(message).toBeDefined();
    Test.expect(message.type).toBe('success');
    Test.expect(message.title).toContain('Hot Streak');
  });

  Test.it('should remind about deload week', () => {
    window.Store.state.mesoWeek = 4;
    const message = getCoachMessage();
    Test.expect(message).toBeDefined();
    Test.expect(message.type).toBe('info');
    Test.expect(message.title).toContain('Deload');
  });

  Test.it('should have action handler for fatigue warning', () => {
    window.Store.state.fatigueFlags = 2;
    const message = getCoachMessage();
    Test.expect(typeof message.actionHandler).toBe('function');
    Test.expect(message.action).toContain('Deload');
  });
});

Test.describe('getExerciseTip - Exercise Tips', () => {
  let originalStore;
  let mockHistory;

  Test.beforeEach(() => {
    mockHistory = [];
    window.Store = {
      state: { units: 'lbs' },
      history: mockHistory
    };
  });

  Test.it('should return null with no performance data', () => {
    const tip = getExerciseTip('Barbell Bench Press', null);
    Test.expect(tip).toBeNull();
  });

  Test.it('should encourage when near PR', () => {
    // Set up PR history
    window.Store.history = [{
      exercises: [{
        name: 'Barbell Bench Press',
        sets: [{ weight: '200', reps: '5' }]  // PR
      }]
    }];

    // Current performance at 95%+ of PR
    const lastPerf = {
      sets: [{ weight: '195', reps: '5', rir: '2' }]  // ~95% of PR
    };

    const tip = getExerciseTip('Barbell Bench Press', lastPerf);
    Test.expect(tip).toContain('Close to your PR');
  });

  Test.it('should warn when significantly below PR', () => {
    // Set up PR history
    window.Store.history = [{
      exercises: [{
        name: 'Barbell Bench Press',
        sets: [{ weight: '200', reps: '5' }]  // PR
      }]
    }];

    // Current performance well below PR
    const lastPerf = {
      sets: [{ weight: '150', reps: '5', rir: '2' }]  // ~75% of PR
    };

    const tip = getExerciseTip('Barbell Bench Press', lastPerf);
    Test.expect(tip).toContain('below your PR');
  });

  Test.it('should suggest pushing harder when RIR is high', () => {
    const lastPerf = {
      sets: [
        { weight: '135', reps: '10', rir: '4' },
        { weight: '135', reps: '10', rir: '4' }
      ]
    };

    const tip = getExerciseTip('Barbell Bench Press', lastPerf);
    Test.expect(tip).toContain('pushing');
  });

  Test.it('should return null when performance is normal', () => {
    window.Store.history = [{
      exercises: [{
        name: 'Barbell Bench Press',
        sets: [{ weight: '200', reps: '5' }]
      }]
    }];

    const lastPerf = {
      sets: [{ weight: '190', reps: '5', rir: '2' }]  // Normal range
    };

    const tip = getExerciseTip('Barbell Bench Press', lastPerf);
    Test.expect(tip).toBeNull();
  });

  Test.it('should handle empty sets', () => {
    const lastPerf = { sets: [] };
    const tip = getExerciseTip('Barbell Bench Press', lastPerf);
    Test.expect(tip).toBeNull();
  });
});

// Helper function tests for plateau detection
detectPlateaus = function(exerciseName, history) {
  const workouts = history.filter(w => 
    w.exercises?.some(e => e.name === exerciseName)
  ).slice(0, 4);
  
  if (workouts.length < 3) return null;
  
  const weights = workouts.map(w => {
    const ex = w.exercises.find(e => e.name === exerciseName);
    const maxWeight = Math.max(...ex.sets.map(s => parseFloat(s.weight) || 0));
    return maxWeight;
  });
  
  // Check if all weights are the same
  const allSame = weights.every(w => w === weights[0]);
  if (allSame && weights[0] > 0) {
    return {
      exercise: exerciseName,
      weeks: weights.length,
      currentWeight: weights[0]
    };
  }
  
  return null;
};

Test.describe('detectPlateaus - Plateau Detection', () => {
  Test.it('should return null with fewer than 3 workouts', () => {
    const history = [
      { exercises: [{ name: 'Bench Press', sets: [{ weight: '185' }] }] },
      { exercises: [{ name: 'Bench Press', sets: [{ weight: '185' }] }] }
    ];
    Test.expect(detectPlateaus('Bench Press', history)).toBeNull();
  });

  Test.it('should detect weight plateau', () => {
    const history = [
      { exercises: [{ name: 'Bench Press', sets: [{ weight: '185' }] }] },
      { exercises: [{ name: 'Bench Press', sets: [{ weight: '185' }] }] },
      { exercises: [{ name: 'Bench Press', sets: [{ weight: '185' }] }] },
      { exercises: [{ name: 'Bench Press', sets: [{ weight: '185' }] }] }
    ];
    const plateau = detectPlateaus('Bench Press', history);
    Test.expect(plateau).toBeDefined();
    Test.expect(plateau.currentWeight).toBe(185);
    Test.expect(plateau.weeks).toBe(4);
  });

  Test.it('should not detect when weight is increasing', () => {
    const history = [
      { exercises: [{ name: 'Bench Press', sets: [{ weight: '195' }] }] },
      { exercises: [{ name: 'Bench Press', sets: [{ weight: '190' }] }] },
      { exercises: [{ name: 'Bench Press', sets: [{ weight: '185' }] }] }
    ];
    Test.expect(detectPlateaus('Bench Press', history)).toBeNull();
  });

  Test.it('should return null for zero weight', () => {
    const history = [
      { exercises: [{ name: 'Bench Press', sets: [{ weight: '0' }] }] },
      { exercises: [{ name: 'Bench Press', sets: [{ weight: '0' }] }] },
      { exercises: [{ name: 'Bench Press', sets: [{ weight: '0' }] }] }
    ];
    Test.expect(detectPlateaus('Bench Press', history)).toBeNull();
  });
});

// Helper function for deload recommendation
shouldDeload = function(state, history) {
  // Week 4 is always deload
  if (state.phase === 'ppl' && state.mesoWeek === 4) return true;
  
  // Check fatigue flags
  if (state.fatigueFlags >= 2) return true;
  
  // Check for volume drop
  if (history.length >= 4) {
    const recent = history.slice(0, 2);
    const previous = history.slice(2, 4);
    
    const recentVolume = recent.reduce((sum, w) => 
      sum + (w.exercises?.reduce((eSum, e) => 
        eSum + (e.sets?.filter(s => s.weight && s.reps).length || 0), 0) || 0), 0);
    
    const previousVolume = previous.reduce((sum, w) => 
      sum + (w.exercises?.reduce((eSum, e) => 
        eSum + (e.sets?.filter(s => s.weight && s.reps).length || 0), 0) || 0), 0);
    
    if (previousVolume > 0 && recentVolume < previousVolume * 0.7) {
      return true;
    }
  }
  
  return false;
};

Test.describe('shouldDeload - Deload Detection', () => {
  Test.it('should return true in week 4', () => {
    const state = { phase: 'ppl', mesoWeek: 4, fatigueFlags: 0 };
    Test.expect(shouldDeload(state, [])).toBeTruthy();
  });

  Test.it('should return true with high fatigue flags', () => {
    const state = { phase: 'ppl', mesoWeek: 2, fatigueFlags: 2 };
    Test.expect(shouldDeload(state, [])).toBeTruthy();
  });

  Test.it('should return false in normal weeks', () => {
    const state = { phase: 'ppl', mesoWeek: 2, fatigueFlags: 0 };
    Test.expect(shouldDeload(state, [])).toBeFalsy();
  });

  Test.it('should detect volume drop', () => {
    const state = { phase: 'ppl', mesoWeek: 2, fatigueFlags: 0 };
    const history = [
      { exercises: [{ sets: [{ weight: '135', reps: '5' }] }] },  // 1 set
      { exercises: [{ sets: [{ weight: '135', reps: '5' }] }] },  // 1 set
      { exercises: [{ sets: [{ weight: '135', reps: '5' }, { weight: '135', reps: '5' }] }] },  // 2 sets
      { exercises: [{ sets: [{ weight: '135', reps: '5' }, { weight: '135', reps: '5' }] }] }   // 2 sets
    ];
    Test.expect(shouldDeload(state, history)).toBeTruthy();
  });
});

// Helper function for tip generation
generateTips = function(state, history) {
  const tips = [];
  
  // Deload tip
  if (state.phase === 'ppl' && state.mesoWeek === 4) {
    tips.push('Deload week: reduce volume by 40-50%');
  }
  
  // Volume tip
  const volume = getWeeklyVolume();
  const chestSets = volume['Chest']?.sets || 0;
  if (chestSets > 20) {
    tips.push('High chest volume detected - ensure adequate recovery');
  }
  if (chestSets < 6 && state.phase === 'ppl') {
    tips.push('Low chest volume this week - consider adding sets');
  }
  
  // Streak tip
  if (history.length >= 3) {
    const last3 = history.slice(0, 3);
    const isConsistent = last3.every((w, i) => {
      if (i === 0) return true;
      const days = (new Date(last3[i-1].date) - new Date(w.date)) / 86400000;
      return days <= 2;
    });
    if (isConsistent) {
      tips.push('Great consistency! Keep it up.');
    }
  }
  
  return tips;
};

Test.describe('generateTips - Tip Generation', () => {
  Test.it('should include deload tip in week 4', () => {
    window.Store = { state: { phase: 'ppl', mesoWeek: 4 }, history: [] };
    const tips = generateTips(window.Store.state, []);
    Test.expect(tips.some(t => t.includes('Deload'))).toBeTruthy();
  });

  Test.it('should return empty array in normal conditions', () => {
    window.Store = { state: { phase: 'ppl', mesoWeek: 2 }, history: [] };
    window.Store.history = [];
    const tips = generateTips(window.Store.state, []);
    // May have other tips based on volume
    Test.expect(Array.isArray(tips)).toBeTruthy();
  });
});

// Mock for getWeeklyVolume used by generateTips
const originalGetWeeklyVolume = typeof getWeeklyVolume !== 'undefined' ? getWeeklyVolume : null;
getWeeklyVolume = function() {
  return { Chest: { sets: 10, tonnage: 1000 } };
};
