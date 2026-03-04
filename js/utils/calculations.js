// ============================================
// CALCULATIONS — 1RM, volume, fatigue, and plate calculations
// ============================================

/**
 * Calculate estimated 1RM using Epley formula
 * @param {number} weight - Weight lifted
 * @param {number} reps - Reps performed
 * @returns {number} Estimated 1RM
 */
function calc1RM(weight, reps) {
  weight = parseFloat(weight);
  reps = parseInt(reps);
  if (!weight || !reps || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

/**
 * Get plate breakdown for a target weight
 * @param {number} targetWeight - Total weight to load
 * @param {number} barWeight - Bar weight (defaults based on units)
 * @returns {number[]} Array of plate weights per side
 */
function calcPlates(targetWeight, barWeight) {
  const units = (typeof Store !== 'undefined' && Store.state?.units) || 'lbs';
  barWeight = barWeight || (units === 'kg' ? 20 : 45);
  const available = units === 'kg' ? [20, 10, 5, 2.5, 1.25] : [45, 25, 10, 5, 2.5];
  let perSide = (targetWeight - barWeight) / 2;
  if (perSide <= 0) return [];
  const plates = [];
  for (const p of available) {
    while (perSide >= p) {
      plates.push(p);
      perSide -= p;
    }
  }
  return plates;
}

/**
 * Get warmup sets for a working weight
 * @param {number} workingWeight - Target working weight
 * @returns {Array<{weight: number, reps: number, label: string}>} Warmup sets
 */
function getWarmupSets(workingWeight) {
  const units = (typeof Store !== 'undefined' && Store.state?.units) || 'lbs';
  const bar = units === 'kg' ? 20 : 45;
  if (!workingWeight || workingWeight <= bar) return [];
  const sets = [{ weight: bar, reps: 10, label: 'Bar only' }];
  if (workingWeight > bar * 2.1) {
    sets.push({ weight: Math.round(workingWeight * 0.5 / 5) * 5, reps: 5, label: '~50%' });
  }
  if (workingWeight > bar * 3) {
    sets.push({ weight: Math.round(workingWeight * 0.75 / 5) * 5, reps: 3, label: '~75%' });
  }
  return sets;
}

/**
 * Get weekly volume statistics by muscle group
 * @returns {Object} Volume data keyed by muscle group
 */
function getWeeklyVolume() {
  const history = (typeof Store !== 'undefined' && Store.history) || [];
  const cutoff = Date.now() - 7 * 86400000;
  const recent = history.filter(w => new Date(w.date).getTime() > cutoff);
  const vol = {};
  for (const w of recent) {
    for (const ex of (w.exercises || [])) {
      const g = getMuscleGroup(ex.name);
      if (!vol[g]) vol[g] = { sets: 0, tonnage: 0 };
      const filled = (ex.sets || []).filter(s => s.weight && s.reps);
      vol[g].sets += filled.length;
      vol[g].tonnage += filled.reduce((t, s) => t + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0);
    }
  }
  return vol;
}

/**
 * Calculate fatigue score based on recent training
 * @returns {number} Fatigue score (0-100)
 */
function calcFatigueScore() {
  const history = (typeof Store !== 'undefined' && Store.history) || [];
  const cutoff = Date.now() - 7 * 86400000;
  const recent = history.filter(w => new Date(w.date).getTime() > cutoff);
  if (!recent.length) return 0;
  let totalSets = 0, totalIntensity = 0;
  for (const w of recent) {
    for (const ex of (w.exercises || [])) {
      for (const s of (ex.sets || [])) {
        if (!s.weight || !s.reps) continue;
        totalSets++;
        const rir = parseInt(s.rir) || 3;
        totalIntensity += (10 - rir) / 10;
      }
    }
  }
  return Math.min(100, Math.round((totalSets * (totalIntensity / (totalSets || 1))) * 1.5));
}

/**
 * Get progression suggestion for an exercise
 * @param {string} exName - Exercise name
 * @returns {number|null} Suggested weight or null
 */
function getProgression(exName) {
  const history = (typeof Store !== 'undefined' && Store.history) || [];
  const state = (typeof Store !== 'undefined' && Store.state) || {};
  
  // Find last performance
  let last = null;
  for (const w of history) {
    const ex = w.exercises?.find(e => e.name === exName);
    if (ex?.sets?.some(s => s.weight)) {
      last = ex;
      break;
    }
  }
  
  if (!last?.sets?.length) return null;
  
  // Check if ready to increase
  const rirTarget = state.phase === 'rampup' 
    ? (state.rampWeek === 'Week 1' ? 4 : 2)
    : parseInt((({ 1: "3 RIR", 2: "2 RIR", 3: "1 RIR", 4: "DELOAD" })[state.mesoWeek] || '3').match(/\d+/)?.[0] || 3);
  
  const targetReps = parseInt((last.targetReps || '8').match(/\d+/)?.[0] || 8);
  const allMetTarget = last.sets.every(s => {
    const reps = parseInt(s.reps) || 0;
    const rir = parseInt(s.rir) || 3;
    return reps >= targetReps && rir <= rirTarget;
  });
  
  if (allMetTarget) {
    const maxW = Math.max(...last.sets.map(s => parseFloat(s.weight) || 0));
    const increment = (state.units === 'kg') ? 2.5 : 5;
    return maxW > 0 ? maxW + increment : null;
  }
  return null;
}

/**
 * Parse the top rep number from a rep range string
 * @param {string} r - Rep range (e.g., "8-10")
 * @returns {number} Top rep number
 */
function parseTopRep(r) {
  const m = r.match(/(\d+)/);
  return m ? +m[1] : 0;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    calc1RM, calcPlates, getWarmupSets, getWeeklyVolume, 
    calcFatigueScore, getProgression, parseTopRep 
  };
}
