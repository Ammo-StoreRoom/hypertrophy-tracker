// ============================================
// COACH — AI coaching logic and recommendations
// ============================================

/**
 * Get recovery status based on recent health data
 * @returns {string|null} 'warn', 'good', or null
 */
function getRecoveryStatus() {
  const bodyWeights = (typeof Store !== 'undefined' && Store.bodyWeights) || [];
  const last3 = bodyWeights.slice(-3);
  const todayH = getTodayHealth();
  const poorSleepDays = last3.filter(b => b.sleep && b.sleep < 6).length;
  const lowReadiness = todayH.readiness > 0 && todayH.readiness <= 2;
  const goodReadiness = todayH.readiness >= 4;
  const goodSleep = todayH.sleep >= 7;
  
  if (lowReadiness || poorSleepDays >= 2) return 'warn';
  if (goodReadiness && goodSleep) return 'good';
  return null;
}

/**
 * Get today's health data
 * @returns {Object} Health data for today
 */
function getTodayHealth() {
  const bodyWeights = (typeof Store !== 'undefined' && Store.bodyWeights) || [];
  const today = new Date().toISOString().split('T')[0];
  const bw = bodyWeights.find(b => b.date === today);
  return {
    weight: bw?.weight || '',
    sleep: bw?.sleep || '',
    readiness: bw?.readiness || 0,
    water: bw?.water || 0,
  };
}

/**
 * Get personalized coaching message
 * @returns {Object|null} Coaching message with type and text
 */
function getCoachMessage() {
  const state = (typeof Store !== 'undefined' && Store.state) || {};
  const history = (typeof Store !== 'undefined' && Store.history) || [];
  
  // Fatigue warning
  if ((state.fatigueFlags || 0) >= 2) {
    return {
      type: 'warning',
      title: 'Fatigue Detected',
      message: 'Your recent performance suggests accumulated fatigue. Consider an early deload.',
      action: 'Go to Deload',
      actionHandler: () => {
        state.mesoWeek = 4;
        state.fatigueFlags = 0;
        Store.setState(state);
      }
    };
  }
  
  // Recovery warning
  const recovery = getRecoveryStatus();
  if (recovery === 'warn') {
    return {
      type: 'warning',
      title: 'Low Recovery',
      message: 'Your sleep and readiness scores suggest you may want to take it easy today.',
    };
  }
  
  // Streak encouragement
  const streak = (() => { 
    let s = 0; 
    const now = new Date(); 
    for (const h2 of history) { 
      const d = new Date(h2.date); 
      if (Math.floor((now - d) / 86400000) <= s + 2) s++; 
      else break; 
    } 
    return s; 
  })();
  
  if (streak >= 5) {
    return {
      type: 'success',
      title: '🔥 Hot Streak!',
      message: `${streak} workouts in a row! Keep the momentum going!`,
    };
  }
  
  // Deload reminder
  if (state.phase === 'ppl' && state.mesoWeek === 4) {
    return {
      type: 'info',
      title: 'Deload Week',
      message: 'Light weights, focus on form and recovery. You\'ve earned it!',
    };
  }
  
  return null;
}

/**
 * Get exercise-specific coaching tip
 * @param {string} exName - Exercise name
 * @param {Object} lastPerf - Last performance data
 * @returns {string|null} Coaching tip
 */
function getExerciseTip(exName, lastPerf) {
  if (!lastPerf) return null;
  
  const state = (typeof Store !== 'undefined' && Store.state) || {};
  const pr = (() => {
    const history = (typeof Store !== 'undefined' && Store.history) || [];
    let best = 0;
    for (const w of history) {
      const ex = w.exercises?.find(e => e.name === exName);
      if (ex) {
        for (const s of (ex.sets || [])) {
          const wt = parseFloat(s.weight) || 0;
          if (wt > best) best = wt;
        }
      }
    }
    return best;
  })();
  
  const bestSet = lastPerf.sets?.reduce((best, s) => {
    const rm = calc1RM(s.weight, s.reps);
    return rm > best ? rm : best;
  }, 0);
  
  // Near PR
  if (pr > 0 && bestSet > pr * 0.95 && bestSet < pr) {
    return 'Close to your PR! Rest well and give it your best.';
  }
  
  // Significant drop
  if (pr > 0 && bestSet < pr * 0.85) {
    return 'Weight is well below your PR. Focus on form or consider if you need more rest.';
  }
  
  // RIR check
  const avgRIR = lastPerf.sets?.reduce((s, v) => s + (parseInt(v.rir) || 3), 0) / (lastPerf.sets?.length || 1);
  if (avgRIR > 3) {
    return 'You left more reps in reserve than target. Try pushing a bit harder next time!';
  }
  
  return null;
}

// Expose globally for browser usage
if (typeof window !== 'undefined') {
  window.getRecoveryStatus = getRecoveryStatus;
  window.getTodayHealth = getTodayHealth;
  window.getCoachMessage = getCoachMessage;
  window.getExerciseTip = getExerciseTip;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getRecoveryStatus, getTodayHealth, getCoachMessage, getExerciseTip };
}
