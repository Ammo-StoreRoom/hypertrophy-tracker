// ============================================
// CALCULATIONS TESTS — 1RM, plates, volume, fatigue
// ============================================

Test.describe('calc1RM - Epley Formula', () => {
  Test.it('should return 0 for invalid inputs', () => {
    Test.expect(calc1RM(0, 10)).toBe(0);
    Test.expect(calc1RM(100, 0)).toBe(0);
    Test.expect(calc1RM(null, 10)).toBe(0);
    Test.expect(calc1RM(100, -1)).toBe(0);
    Test.expect(calc1RM('', 10)).toBe(0);
  });

  Test.it('should return weight for single rep', () => {
    Test.expect(calc1RM(100, 1)).toBe(100);
    Test.expect(calc1RM(225, 1)).toBe(225);
  });

  Test.it('should calculate Epley formula correctly', () => {
    // Epley: weight * (1 + reps/30)
    // 100 lbs × 10 reps = 100 * (1 + 10/30) = 133.33... → 133
    Test.expect(calc1RM(100, 10)).toBe(133);
    // 225 lbs × 5 reps = 225 * (1 + 5/30) = 262.5 → 263
    Test.expect(calc1RM(225, 5)).toBe(263);
    // 135 lbs × 8 reps = 135 * (1 + 8/30) = 171 → 171
    Test.expect(calc1RM(135, 8)).toBe(171);
  });

  Test.it('should handle string inputs', () => {
    Test.expect(calc1RM('100', '10')).toBe(133);
    Test.expect(calc1RM('225', '5')).toBe(263);
  });

  Test.it('should handle decimal weights', () => {
    Test.expect(calc1RM(185.5, 5)).toBe(216);
    Test.expect(calc1RM(142.5, 8)).toBe(181);
  });
});

Test.describe('calcPlates - Plate Calculator', () => {
  let originalStore;

  Test.beforeEach(() => {
    // Save original Store reference
    originalStore = typeof Store !== 'undefined' ? Store : undefined;
  });

  Test.afterEach(() => {
    // Restore original Store
    if (originalStore !== undefined) {
      window.Store = originalStore;
    }
  });

  Test.it('should return empty array for bar weight only', () => {
    // Mock Store for lbs
    window.Store = { state: { units: 'lbs' } };
    Test.expect(calcPlates(45, 45)).toEqual([]);
    Test.expect(calcPlates(20, 20)).toEqual([]);
  });

  Test.it('should calculate lbs plates correctly', () => {
    window.Store = { state: { units: 'lbs' } };
    // 135 lbs total with 45 lb bar → 45 lbs per side → one 45 plate
    Test.expect(calcPlates(135, 45)).toEqual([45]);
    // 185 lbs total → 70 lbs per side → 45 + 25
    Test.expect(calcPlates(185, 45)).toEqual([45, 25]);
    // 225 lbs total → 90 lbs per side → 45 + 45
    Test.expect(calcPlates(225, 45)).toEqual([45, 45]);
    // 275 lbs total → 115 lbs per side → 45 + 45 + 25
    Test.expect(calcPlates(275, 45)).toEqual([45, 45, 25]);
  });

  Test.it('should calculate kg plates correctly', () => {
    window.Store = { state: { units: 'kg' } };
    // 60 kg total with 20 kg bar → 20 kg per side → one 20 plate
    Test.expect(calcPlates(60, 20)).toEqual([20]);
    // 100 kg total → 40 kg per side → 20 + 20
    Test.expect(calcPlates(100, 20)).toEqual([20, 20]);
    // 140 kg total → 60 kg per side → 20 + 20 + 20
    Test.expect(calcPlates(140, 20)).toEqual([20, 20, 20]);
  });

  Test.it('should use default bar weight from units', () => {
    window.Store = { state: { units: 'lbs' } };
    // Should default to 45 lb bar
    Test.expect(calcPlates(135)).toEqual([45]);
    
    window.Store = { state: { units: 'kg' } };
    // Should default to 20 kg bar
    Test.expect(calcPlates(60)).toEqual([20]);
  });

  Test.it('should handle weights below bar weight', () => {
    window.Store = { state: { units: 'lbs' } };
    Test.expect(calcPlates(40, 45)).toEqual([]);
    Test.expect(calcPlates(45, 45)).toEqual([]);
  });

  Test.it('should use available plate sizes correctly', () => {
    window.Store = { state: { units: 'lbs' } };
    // 315 lbs → 135 per side → 45 + 45 + 45
    Test.expect(calcPlates(315, 45)).toEqual([45, 45, 45]);
    // 95 lbs → 25 per side → 25
    Test.expect(calcPlates(95, 45)).toEqual([25]);
    // 65 lbs → 10 per side → 10
    Test.expect(calcPlates(65, 45)).toEqual([10]);
    // 55 lbs → 5 per side → 5
    Test.expect(calcPlates(55, 45)).toEqual([5]);
    // 50 lbs → 2.5 per side → 2.5
    Test.expect(calcPlates(50, 45)).toEqual([2.5]);
  });
});

Test.describe('getWarmupSets - Warmup Calculator', () => {
  Test.beforeEach(() => {
    window.Store = { state: { units: 'lbs' } };
  });

  Test.it('should return empty array for weight at or below bar weight', () => {
    Test.expect(getWarmupSets(0)).toEqual([]);
    Test.expect(getWarmupSets(45)).toEqual([]);
    Test.expect(getWarmupSets(30)).toEqual([]);
  });

  Test.it('should return bar only for moderate weights', () => {
    // Between bar and bar*2.1
    window.Store = { state: { units: 'lbs' } };
    const result = getWarmupSets(80);
    Test.expect(result).toHaveLength(1);
    Test.expect(result[0].weight).toBe(45);
    Test.expect(result[0].reps).toBe(10);
    Test.expect(result[0].label).toBe('Bar only');
  });

  Test.it('should add 50% warmup for heavier weights', () => {
    window.Store = { state: { units: 'lbs' } };
    // 135 lbs > 45 * 2.1 (94.5), so should have bar + 50%
    const result = getWarmupSets(135);
    Test.expect(result).toHaveLength(2);
    Test.expect(result[0].label).toBe('Bar only');
    Test.expect(result[1].label).toBe('~50%');
    Test.expect(result[1].reps).toBe(5);
    // 50% of 135 = 67.5, rounded to nearest 5 = 65 or 70
    Test.expect(result[1].weight).toBeGreaterThan(0);
  });

  Test.it('should add 75% warmup for very heavy weights', () => {
    window.Store = { state: { units: 'lbs' } };
    // 315 lbs > 45 * 3 (135), so should have all three sets
    const result = getWarmupSets(315);
    Test.expect(result).toHaveLength(3);
    Test.expect(result[0].label).toBe('Bar only');
    Test.expect(result[1].label).toBe('~50%');
    Test.expect(result[2].label).toBe('~75%');
    Test.expect(result[2].reps).toBe(3);
  });

  Test.it('should work with kg units', () => {
    window.Store = { state: { units: 'kg' } };
    // 100 kg > 20 * 3 (60), so should have all three sets
    const result = getWarmupSets(100);
    Test.expect(result).toHaveLength(3);
    Test.expect(result[0].weight).toBe(20);
  });
});

Test.describe('getWeeklyVolume - Volume Statistics', () => {
  Test.it('should return empty object with no history', () => {
    window.Store = { history: [] };
    Test.expect(getWeeklyVolume()).toEqual({});
  });

  Test.it('should calculate volume for recent workouts', () => {
    const now = Date.now();
    const oneDay = 86400000;
    
    window.Store = {
      history: [
        {
          date: new Date(now - oneDay).toISOString(),
          exercises: [
            {
              name: 'Barbell Bench Press',
              sets: [
                { weight: '135', reps: '10' },
                { weight: '185', reps: '8' }
              ]
            },
            {
              name: 'Barbell Curl',
              sets: [
                { weight: '65', reps: '12' }
              ]
            }
          ]
        }
      ]
    };

    const volume = getWeeklyVolume();
    
    // Chest: (135*10) + (185*8) = 1350 + 1480 = 2830
    Test.expect(volume['Chest']).toBeDefined();
    Test.expect(volume['Chest'].sets).toBe(2);
    Test.expect(volume['Chest'].tonnage).toBe(2830);
    
    // Biceps: 65*12 = 780
    Test.expect(volume['Biceps']).toBeDefined();
    Test.expect(volume['Biceps'].sets).toBe(1);
    Test.expect(volume['Biceps'].tonnage).toBe(780);
  });

  Test.it('should filter out workouts older than 7 days', () => {
    const now = Date.now();
    const oneDay = 86400000;
    
    window.Store = {
      history: [
        {
          date: new Date(now - oneDay).toISOString(),
          exercises: [{ name: 'Barbell Bench Press', sets: [{ weight: '135', reps: '10' }] }]
        },
        {
          date: new Date(now - 8 * oneDay).toISOString(),
          exercises: [{ name: 'Barbell Curl', sets: [{ weight: '65', reps: '10' }] }]
        }
      ]
    };

    const volume = getWeeklyVolume();
    
    // Only recent workout should count
    Test.expect(volume['Chest']).toBeDefined();
    Test.expect(volume['Biceps']).toBeUndefined();
  });

  Test.it('should skip incomplete sets', () => {
    window.Store = {
      history: [
        {
          date: new Date().toISOString(),
          exercises: [
            {
              name: 'Barbell Bench Press',
              sets: [
                { weight: '135', reps: '10' },
                { weight: '', reps: '10' },  // no weight
                { weight: '185', reps: '' },  // no reps
                { weight: '', reps: '' }      // empty
              ]
            }
          ]
        }
      ]
    };

    const volume = getWeeklyVolume();
    Test.expect(volume['Chest'].sets).toBe(1);
  });
});

Test.describe('calcFatigueScore - Fatigue Calculation', () => {
  Test.it('should return 0 with no history', () => {
    window.Store = { history: [] };
    Test.expect(calcFatigueScore()).toBe(0);
  });

  Test.it('should return 0 with no recent workouts', () => {
    const now = Date.now();
    window.Store = {
      history: [
        {
          date: new Date(now - 10 * 86400000).toISOString(),
          exercises: [{ name: 'Bench Press', sets: [{ weight: '135', reps: '10', rir: '2' }] }]
        }
      ]
    };
    Test.expect(calcFatigueScore()).toBe(0);
  });

  Test.it('should calculate fatigue based on sets and RIR', () => {
    const now = Date.now();
    window.Store = {
      history: [
        {
          date: new Date(now - 86400000).toISOString(),
          exercises: [
            {
              name: 'Bench Press',
              sets: [
                { weight: '135', reps: '10', rir: '2' },  // intensity = 0.8
                { weight: '185', reps: '8', rir: '1' }    // intensity = 0.9
              ]
            }
          ]
        }
      ]
    };

    // 2 sets, avg intensity = (0.8 + 0.9) / 2 = 0.85
    // score = 2 * 0.85 * 1.5 = 2.55 → 3
    const score = calcFatigueScore();
    Test.expect(score).toBeGreaterThan(0);
    Test.expect(score).toBeLessThan(100);
  });

  Test.it('should cap at 100', () => {
    const now = Date.now();
    const lotsOfSets = [];
    for (let i = 0; i < 50; i++) {
      lotsOfSets.push({ weight: '135', reps: '10', rir: '0' }); // max intensity
    }
    
    window.Store = {
      history: [
        {
          date: new Date(now - 86400000).toISOString(),
          exercises: [{ name: 'Bench Press', sets: lotsOfSets }]
        }
      ]
    };

    Test.expect(calcFatigueScore()).toBe(100);
  });

  Test.it('should skip sets without weight or reps', () => {
    const now = Date.now();
    window.Store = {
      history: [
        {
          date: new Date(now - 86400000).toISOString(),
          exercises: [{
            name: 'Bench Press',
            sets: [
              { weight: '135', reps: '10', rir: '2' },
              { weight: '', reps: '10', rir: '2' },
              { weight: '135', reps: '', rir: '2' }
            ]
          }]
        }
      ]
    };

    // Should only count 1 valid set
    const score = calcFatigueScore();
    Test.expect(score).toBeGreaterThan(0);
  });
});

Test.describe('getProgression - Progression Suggestion', () => {
  Test.beforeEach(() => {
    window.Store = {
      state: {
        phase: 'ppl',
        mesoWeek: 2,
        units: 'lbs'
      },
      history: []
    };
  });

  Test.it('should return null with no history', () => {
    Test.expect(getProgression('Barbell Bench Press')).toBeNull();
  });

  Test.it('should return null when no sets have weights', () => {
    window.Store.history = [{
      exercises: [{
        name: 'Barbell Bench Press',
        targetReps: '8-10',
        sets: [{ weight: '', reps: '10', rir: '2' }]
      }]
    }];
    Test.expect(getProgression('Barbell Bench Press')).toBeNull();
  });

  Test.it('should suggest progression when all targets met', () => {
    window.Store.history = [{
      exercises: [{
        name: 'Barbell Bench Press',
        targetReps: '8-10',
        sets: [
          { weight: '185', reps: '10', rir: '2' },
          { weight: '185', reps: '10', rir: '2' }
        ]
      }]
    }];
    
    const suggestion = getProgression('Barbell Bench Press');
    Test.expect(suggestion).toBe(190); // 185 + 5 lbs
  });

  Test.it('should return null when not all targets met', () => {
    window.Store.history = [{
      exercises: [{
        name: 'Barbell Bench Press',
        targetReps: '8-10',
        sets: [
          { weight: '185', reps: '7', rir: '2' },  // below target
          { weight: '185', reps: '10', rir: '2' }
        ]
      }]
    }];
    
    Test.expect(getProgression('Barbell Bench Press')).toBeNull();
  });

  Test.it('should use kg increment when in kg mode', () => {
    window.Store.state.units = 'kg';
    window.Store.history = [{
      exercises: [{
        name: 'Barbell Bench Press',
        targetReps: '8-10',
        sets: [{ weight: '80', reps: '10', rir: '2' }]
      }]
    }];
    
    const suggestion = getProgression('Barbell Bench Press');
    Test.expect(suggestion).toBe(82.5); // 80 + 2.5 kg
  });
});

Test.describe('parseTopRep - Rep Range Parser', () => {
  Test.it('should parse single number', () => {
    Test.expect(parseTopRep('10')).toBe(10);
    Test.expect(parseTopRep('8')).toBe(8);
  });

  Test.it('should parse first number from range', () => {
    Test.expect(parseTopRep('8-10')).toBe(8);
    Test.expect(parseTopRep('10-12')).toBe(10);
    Test.expect(parseTopRep('6-8')).toBe(6);
  });

  Test.it('should handle rep ranges with /leg', () => {
    Test.expect(parseTopRep('10/leg')).toBe(10);
    Test.expect(parseTopRep('12/side')).toBe(12);
  });

  Test.it('should handle AMRAP', () => {
    Test.expect(parseTopRep('AMRAP')).toBe(0);
    Test.expect(parseTopRep('AMRAP-2')).toBe(0);
  });

  Test.it('should return 0 for empty or invalid', () => {
    Test.expect(parseTopRep('')).toBe(0);
    Test.expect(parseTopRep(null)).toBe(0);
    Test.expect(parseTopRep(undefined)).toBe(0);
  });
});
