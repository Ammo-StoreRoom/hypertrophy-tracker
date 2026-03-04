// ============================================
// AI COACH — Intelligent training recommendations
// ============================================

const Coach = (() => {
  // ========== CONSTANTS ==========
  const PLATEAU_SESSIONS = 3;        // Sessions without progress to flag plateau
  const VOLUME_CHANGE_THRESHOLD = 0.15; // 15% change is significant
  const SLEEP_WARNING_THRESHOLD = 6;  // Hours below this triggers warning
  const FATIGUE_THRESHOLD = 70;       // Fatigue score for warnings
  const PR_PROXIMITY_PCT = 0.95;      // Within 5% of PR
  const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
  const DAY_IN_MS = 24 * 60 * 60 * 1000;

  // ========== UTILITY FUNCTIONS ==========
  
  /**
   * Parse rep string (e.g., "8-10", "10-12", "AMRAP") to get target
   */
  function parseRepTarget(repStr) {
    if (!repStr) return 8;
    if (repStr.includes('AMRAP')) return 10; // Estimate for AMRAP
    const match = repStr.match(/(\d+)(?:\s*-\s*(\d+))?/);
    if (match) {
      return parseInt(match[2] || match[1]);
    }
    return 8;
  }

  /**
   * Calculate estimated 1RM using Epley formula
   */
  function calc1RM(weight, reps) {
    weight = parseFloat(weight);
    reps = parseInt(reps);
    if (!weight || !reps || reps <= 0) return 0;
    if (reps === 1) return weight;
    return Math.round(weight * (1 + reps / 30));
  }

  /**
   * Get volume for a specific time period
   */
  function getVolumeForPeriod(history, days) {
    const cutoff = Date.now() - (days * DAY_IN_MS);
    const periodWorkouts = history.filter(w => new Date(w.date).getTime() > cutoff);
    
    let totalSets = 0;
    let totalTonnage = 0;
    let totalExercises = new Set();
    
    for (const w of periodWorkouts) {
      for (const ex of (w.exercises || [])) {
        const filled = (ex.sets || []).filter(s => s.weight && s.reps);
        totalSets += filled.length;
        totalExercises.add(ex.name);
        for (const s of filled) {
          totalTonnage += (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0);
        }
      }
    }
    
    return {
      workouts: periodWorkouts.length,
      sets: totalSets,
      tonnage: Math.round(totalTonnage),
      exercises: totalExercises.size,
      avgSetsPerWorkout: periodWorkouts.length ? Math.round(totalSets / periodWorkouts.length * 10) / 10 : 0
    };
  }

  /**
   * Get exercise history sorted by date (newest first)
   */
  function getExerciseHistory(history, exerciseName) {
    const entries = [];
    for (const w of history) {
      const ex = w.exercises?.find(e => e.name === exerciseName);
      if (ex) {
        const bestWeight = Math.max(...(ex.sets || []).map(s => parseFloat(s.weight) || 0), 0);
        const bestE1RM = Math.max(...(ex.sets || []).map(s => calc1RM(s.weight, s.reps)), 0);
        const totalVolume = (ex.sets || []).reduce((sum, s) => 
          sum + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0);
        entries.push({
          date: w.date,
          weight: bestWeight,
          e1rm: bestE1RM,
          volume: totalVolume,
          sets: ex.sets?.length || 0,
          reps: ex.sets?.map(s => parseInt(s.reps) || 0),
          rir: ex.sets?.map(s => parseInt(s.rir) || 0)
        });
      }
    }
    return entries.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /**
   * Get personal record for an exercise
   */
  function getPR(history, exerciseName) {
    let best = 0;
    for (const w of history) {
      const ex = w.exercises?.find(e => e.name === exerciseName);
      if (ex) {
        for (const s of (ex.sets || [])) {
          const wt = parseFloat(s.weight) || 0;
          if (wt > best) best = wt;
        }
      }
    }
    return best;
  }

  /**
   * Calculate RIR-based intensity score
   */
  function getIntensityScore(rir) {
    if (!rir && rir !== 0) return 0.5;
    return (10 - Math.min(rir, 10)) / 10;
  }

  /**
   * Get muscle group for exercise
   */
  function getMuscleGroup(exName) {
    for (const [group, exercises] of Object.entries(MUSCLE_GROUPS || {})) {
      if (exercises.includes(exName)) return group;
    }
    return 'Other';
  }

  /**
   * Format weight with units
   */
  function fmtW(val, units = 'lbs') {
    const n = parseFloat(val);
    if (!Number.isFinite(n) || n <= 0) return '--';
    const pretty = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
    return `${pretty}${units}`;
  }

  // ========== ANALYSIS FUNCTIONS ==========

  /**
   * Detect plateaus (no progress for 3+ sessions)
   */
  function detectPlateaus(history) {
    const plateaus = [];
    const exercisesChecked = new Set();
    
    // Collect all exercises from history
    for (const w of history) {
      for (const ex of (w.exercises || [])) {
        if (exercisesChecked.has(ex.name)) continue;
        exercisesChecked.add(ex.name);
        
        const exHistory = getExerciseHistory(history, ex.name);
        if (exHistory.length < PLATEAU_SESSIONS) continue;
        
        // Check last 3 sessions for progress
        const recent = exHistory.slice(0, PLATEAU_SESSIONS);
        const weights = recent.map(r => r.weight);
        const maxWeight = Math.max(...weights);
        const minWeight = Math.min(...weights);
        
        // Check for no weight progress
        const noWeightProgress = maxWeight === minWeight;
        
        // Check for no volume progress
        const volumes = recent.map(r => r.volume);
        const maxVolume = Math.max(...volumes);
        const minVolume = Math.min(...volumes);
        const noVolumeProgress = maxVolume - minVolume < maxVolume * 0.05;
        
        if (noWeightProgress && noVolumeProgress) {
          const weeksStalled = Math.ceil(
            (new Date(recent[0].date) - new Date(recent[recent.length - 1].date)) / WEEK_IN_MS
          );
          
          let suggestion = '';
          const muscleGroup = getMuscleGroup(ex.name);
          
          if (muscleGroup === 'Calves' || muscleGroup === 'Shoulders') {
            suggestion = 'Try higher rep ranges (15-20) or drop sets for this stubborn muscle group';
          } else if (recent.every(r => r.rir.every(ri => ri <= 1))) {
            suggestion = 'You\'re training very close to failure - try backing off to 2-3 RIR for a session';
          } else if (recent.every(r => r.rir.every(ri => ri >= 3))) {
            suggestion = 'Push closer to failure (1-2 RIR) on at least your last set';
          } else {
            suggestion = 'Consider a small weight increase (2.5-5 lbs) or add an extra set';
          }
          
          plateaus.push({
            exercise: ex.name,
            weeksStalled: Math.max(weeksStalled, 1),
            currentWeight: maxWeight,
            suggestion
          });
        }
      }
    }
    
    return plateaus.sort((a, b) => b.weeksStalled - a.weeksStalled);
  }

  /**
   * Check if deload is needed based on fatigue, sleep, performance
   */
  function shouldDeload(state, history, bodyWeights) {
    const reasons = [];
    let shouldDeload = false;
    
    // Check fatigue flags from state
    if ((state.fatigueFlags || 0) >= 2) {
      shouldDeload = true;
      reasons.push('Multiple fatigue flags detected in previous workouts');
    }
    
    // Check for declining performance across multiple exercises
    const lastWeek = history.slice(0, 3);
    if (lastWeek.length >= 2) {
      let decliningExercises = 0;
      const exercisesInLast = new Set();
      lastWeek[0].exercises?.forEach(e => exercisesInLast.add(e.name));
      
      for (const exName of exercisesInLast) {
        const performances = [];
        for (const w of lastWeek) {
          const ex = w.exercises?.find(e => e.name === exName);
          if (ex) {
            const avgReps = ex.sets?.reduce((s, v) => s + (parseInt(v.reps) || 0), 0) / (ex.sets?.length || 1);
            performances.push(avgReps);
          }
        }
        if (performances.length >= 2 && performances[0] < performances[performances.length - 1] * 0.9) {
          decliningExercises++;
        }
      }
      
      if (decliningExercises >= 3) {
        shouldDeload = true;
        reasons.push(`${decliningExercises} exercises showing rep decline`);
      }
    }
    
    // Check sleep patterns
    const recentSleep = bodyWeights.slice(-7).filter(b => b.sleep);
    if (recentSleep.length >= 3) {
      const avgSleep = recentSleep.reduce((s, b) => s + b.sleep, 0) / recentSleep.length;
      if (avgSleep < SLEEP_WARNING_THRESHOLD) {
        shouldDeload = true;
        reasons.push(`Sleep average ${avgSleep.toFixed(1)}h - insufficient recovery`);
      }
    }
    
    // Check readiness scores
    const recentReadiness = bodyWeights.slice(-3).filter(b => b.readiness);
    if (recentReadiness.length >= 2) {
      const poorReadiness = recentReadiness.filter(b => b.readiness <= 2).length;
      if (poorReadiness >= 2) {
        shouldDeload = true;
        reasons.push('Poor readiness scores indicate incomplete recovery');
      }
    }
    
    // Check if it's been 3+ weeks since last deload (in PPL phase)
    if (state.phase === 'ppl' && state.mesoWeek < 4) {
      const deloadWorkouts = history.filter(h => h.weekLabel?.includes('DELOAD') || h.weekLabel?.includes('W4'));
      if (deloadWorkouts.length > 0) {
        const lastDeload = new Date(deloadWorkouts[0].date);
        const weeksSinceDeload = (Date.now() - lastDeload.getTime()) / WEEK_IN_MS;
        if (weeksSinceDeload >= 4 && state.mesoWeek === 3) {
          reasons.push(`${Math.floor(weeksSinceDeload)} weeks since last deload - plan one soon`);
        }
      }
    }
    
    return { shouldDeload, reasons };
  }

  /**
   * Calculate fatigue score based on recent training
   */
  function calculateFatigueScore(history) {
    const cutoff = Date.now() - 7 * DAY_IN_MS;
    const recent = history.filter(w => new Date(w.date).getTime() > cutoff);
    
    if (!recent.length) return 0;
    
    let totalSets = 0;
    let totalIntensity = 0;
    let consecutiveDays = 0;
    let prevDate = null;
    
    for (const w of recent) {
      for (const ex of (w.exercises || [])) {
        for (const s of (ex.sets || [])) {
          if (!s.weight || !s.reps) continue;
          totalSets++;
          const rir = parseInt(s.rir) || 3;
          totalIntensity += (10 - rir) / 10;
        }
      }
      
      // Check consecutive days
      const wDate = new Date(w.date).toDateString();
      if (prevDate) {
        const diff = (new Date(w.date) - new Date(prevDate)) / DAY_IN_MS;
        if (diff <= 1) consecutiveDays++;
      }
      prevDate = w.date;
    }
    
    const avgIntensity = totalIntensity / (totalSets || 1);
    const baseScore = totalSets * avgIntensity * 1.5;
    const consecutivePenalty = consecutiveDays * 10;
    
    return Math.min(100, Math.round(baseScore + consecutivePenalty));
  }

  /**
   * Analyze recovery metrics
   */
  function analyzeRecovery(bodyWeights) {
    const recent = bodyWeights.slice(-14);
    const withSleep = recent.filter(b => b.sleep);
    const withReadiness = recent.filter(b => b.readiness);
    
    if (!withSleep.length && !withReadiness.length) {
      return {
        score: null,
        advice: 'Start tracking sleep and readiness for recovery insights',
        metrics: {}
      };
    }
    
    // Calculate sleep metrics
    const avgSleep = withSleep.length ? 
      withSleep.reduce((s, b) => s + b.sleep, 0) / withSleep.length : 0;
    const sleepConsistency = withSleep.length >= 2 ?
      Math.sqrt(withSleep.reduce((sq, b) => sq + Math.pow(b.sleep - avgSleep, 2), 0) / withSleep.length) : 0;
    
    // Calculate readiness trend
    const avgReadiness = withReadiness.length ?
      withReadiness.reduce((s, b) => s + b.readiness, 0) / withReadiness.length : 0;
    
    // Calculate recovery score (0-100)
    let score = 50; // Base score
    
    // Sleep contribution (0-40 points)
    if (avgSleep >= 8) score += 40;
    else if (avgSleep >= 7) score += 30;
    else if (avgSleep >= 6) score += 15;
    else if (avgSleep >= 5) score += 5;
    
    // Consistency bonus (0-10 points)
    if (sleepConsistency < 0.5) score += 10;
    else if (sleepConsistency < 1) score += 5;
    
    // Readiness contribution (0-50 points)
    if (avgReadiness >= 4) score += 50;
    else if (avgReadiness >= 3) score += 35;
    else if (avgReadiness >= 2) score += 20;
    else if (avgReadiness >= 1) score += 10;
    
    score = Math.min(100, Math.round(score));
    
    // Generate advice
    let advice = '';
    if (score >= 85) {
      advice = 'Excellent recovery status - you\'re primed for hard training';
    } else if (score >= 70) {
      advice = 'Good recovery - proceed with normal training';
    } else if (score >= 50) {
      advice = 'Moderate recovery - consider reducing volume by 10-20%';
    } else {
      advice = 'Poor recovery - prioritize sleep and consider a rest day';
    }
    
    // Add specific recommendations
    const tips = [];
    if (avgSleep < 7) tips.push('Aim for 7-9 hours of sleep');
    if (sleepConsistency > 1) tips.push('Try to sleep/wake at consistent times');
    if (avgReadiness < 3) tips.push('Low readiness - add an extra rest day this week');
    
    return {
      score,
      advice,
      tips,
      metrics: {
        avgSleep: avgSleep ? avgSleep.toFixed(1) : null,
        sleepConsistency: sleepConsistency ? sleepConsistency.toFixed(2) : null,
        avgReadiness: avgReadiness ? avgReadiness.toFixed(1) : null
      }
    };
  }

  /**
   * Find exercises near PR
   */
  function findPRPotential(history, state) {
    const potential = [];
    const exercisesChecked = new Set();
    
    for (const w of history.slice(0, 5)) { // Check recent workouts
      for (const ex of (w.exercises || [])) {
        if (exercisesChecked.has(ex.name)) continue;
        exercisesChecked.add(ex.name);
        
        const pr = getPR(history, ex.name);
        if (!pr) continue;
        
        // Get best recent performance
        const exHistory = getExerciseHistory(history, ex.name);
        if (!exHistory.length) continue;
        
        const recentBest = exHistory[0];
        const proximity = recentBest.weight / pr;
        
        if (proximity >= PR_PROXIMITY_PCT && proximity < 1) {
          potential.push({
            exercise: ex.name,
            current: recentBest.weight,
            pr: pr,
            gap: pr - recentBest.weight,
            percentOfPR: Math.round(proximity * 100),
            tip: `Within ${Math.round((1 - proximity) * 100)}% of your PR - fresh up and go for it!`
          });
        } else if (proximity >= 1) {
          potential.push({
            exercise: ex.name,
            current: recentBest.weight,
            pr: pr,
            gap: 0,
            percentOfPR: Math.round(proximity * 100),
            tip: 'You\'ve hit a PR recently! Consider maintaining or microloading'
          });
        }
      }
    }
    
    return potential.sort((a, b) => b.percentOfPR - a.percentOfPR);
  }

  /**
   * Analyze volume trends
   */
  function analyzeVolumeTrends(history) {
    const thisWeek = getVolumeForPeriod(history, 7);
    const lastWeek = getVolumeForPeriod(history, 14);
    const lastWeekOnly = {
      workouts: lastWeek.workouts - thisWeek.workouts,
      sets: lastWeek.sets - thisWeek.sets,
      tonnage: lastWeek.tonnage - thisWeek.tonnage
    };
    
    const twoWeeksAgo = getVolumeForPeriod(history, 21);
    const week2Only = {
      workouts: twoWeeksAgo.workouts - lastWeek.workouts,
      sets: twoWeeksAgo.sets - lastWeek.sets,
      tonnage: twoWeeksAgo.tonnage - lastWeek.tonnage
    };
    
    const insights = [];
    
    // Compare this week to last week
    if (lastWeekOnly.sets > 0) {
      const setChange = (thisWeek.sets - lastWeekOnly.sets) / lastWeekOnly.sets;
      if (setChange > VOLUME_CHANGE_THRESHOLD) {
        insights.push(`Volume up ${Math.round(setChange * 100)}% this week - monitor fatigue`);
      } else if (setChange < -VOLUME_CHANGE_THRESHOLD) {
        insights.push(`Volume down ${Math.round(Math.abs(setChange) * 100)}% - ensure intentional deload`);
      }
    }
    
    // Check for consistent high volume
    if (thisWeek.sets > 100 && lastWeekOnly.sets > 100) {
      insights.push('Two weeks of 100+ sets - watch for overreaching signs');
    }
    
    // Tonnage trends
    if (thisWeek.tonnage > 0 && lastWeekOnly.tonnage > 0) {
      const tonnageChange = (thisWeek.tonnage - lastWeekOnly.tonnage) / lastWeekOnly.tonnage;
      if (tonnageChange > 0.2) {
        insights.push('Significant tonnage increase - prioritize recovery');
      }
    }
    
    // Workout frequency
    if (thisWeek.workouts >= 5) {
      insights.push(`${thisWeek.workouts} workouts this week - excellent consistency!`);
    } else if (thisWeek.workouts === 0 && lastWeekOnly.workouts > 0) {
      insights.push('No workouts this week - time to get back in the gym');
    }
    
    return {
      current: thisWeek,
      previous: lastWeekOnly,
      twoWeeksAgo: week2Only,
      insights
    };
  }

  /**
   * Generate personalized tips based on data patterns
   */
  function generateTips(state, history, bodyWeights) {
    const tips = [];
    const recentWorkouts = history.slice(0, 10);
    
    if (!recentWorkouts.length) {
      return ['Start logging workouts to receive personalized coaching tips'];
    }
    
    // Tip 1: Consistency streak
    let streak = 0;
    let prevDate = null;
    for (const w of recentWorkouts) {
      if (prevDate) {
        const daysDiff = (new Date(prevDate) - new Date(w.date)) / DAY_IN_MS;
        if (daysDiff <= 2) streak++;
        else break;
      }
      prevDate = w.date;
      if (!streak) streak = 1;
    }
    if (streak >= 3) {
      tips.push(`${streak} workout streak! Maintain momentum but watch for fatigue`);
    }
    
    // Tip 2: RIR compliance
    let lowRIRCount = 0;
    let highRIRCount = 0;
    for (const w of recentWorkouts.slice(0, 3)) {
      for (const ex of (w.exercises || [])) {
        for (const s of (ex.sets || [])) {
          const rir = parseInt(s.rir);
          if (!isNaN(rir)) {
            if (rir <= 1) lowRIRCount++;
            else if (rir >= 4) highRIRCount++;
          }
        }
      }
    }
    if (lowRIRCount > 5) {
      tips.push('You\'re pushing very close to failure often - add more recovery');
    } else if (highRIRCount > 5 && state.phase === 'ppl' && state.mesoWeek !== 4) {
      tips.push('Most sets at 4+ RIR - push closer to failure for better stimulus');
    }
    
    // Tip 3: Exercise variety
    const exerciseFrequency = {};
    for (const w of recentWorkouts) {
      for (const ex of (w.exercises || [])) {
        exerciseFrequency[ex.name] = (exerciseFrequency[ex.name] || 0) + 1;
      }
    }
    const frequentlyMissed = Object.entries(exerciseFrequency)
      .filter(([_, count]) => count === 1)
      .map(([name]) => name);
    if (frequentlyMissed.length > 3) {
      tips.push('Some exercises only done once recently - ensure consistent progression');
    }
    
    // Tip 4: Progressive overload check
    for (const [exName, count] of Object.entries(exerciseFrequency)) {
      if (count >= 3) {
        const exHistory = getExerciseHistory(history, exName);
        if (exHistory.length >= 3) {
          const weights = exHistory.slice(0, 3).map(h => h.weight);
          if (weights.every(w => w === weights[0]) && weights[0] > 0) {
            tips.push(`${exName}: Same weight for 3 sessions - time to increase!`);
          }
        }
      }
    }
    
    // Tip 5: Body weight changes
    const recentBW = bodyWeights.filter(b => b.weight);
    if (recentBW.length >= 2) {
      const change = recentBW[recentBW.length - 1].weight - recentBW[recentBW.length - 2].weight;
      if (Math.abs(change) > 2) {
        const direction = change > 0 ? 'up' : 'down';
        tips.push(`Weight ${direction} ${Math.abs(change).toFixed(1)}${state.units || 'lbs'} - adjust calories if unintended`);
      }
    }
    
    // Tip 6: Hydration
    const waterDays = bodyWeights.slice(-7).filter(b => (b.water || 0) >= 6).length;
    if (waterDays < 3) {
      tips.push('Low hydration tracking - aim for 6+ glasses of water daily');
    }
    
    // Tip 7: Weak point identification
    const muscleVolumes = {};
    for (const w of recentWorkouts) {
      for (const ex of (w.exercises || [])) {
        const group = getMuscleGroup(ex.name);
        muscleVolumes[group] = (muscleVolumes[group] || 0) + (ex.sets?.length || 0);
      }
    }
    const lowestVolume = Object.entries(muscleVolumes).sort((a, b) => a[1] - b[1])[0];
    if (lowestVolume && lowestVolume[1] < 6) {
      tips.push(`${lowestVolume[0]} volume is lowest - consider adding more ${lowestVolume[0].toLowerCase()} work`);
    }
    
    // Tip 8: Workout duration
    const avgDuration = recentWorkouts.reduce((s, w) => s + (w.duration || 0), 0) / recentWorkouts.length;
    if (avgDuration > 90) {
      tips.push('Workouts averaging 90+ minutes - consider supersetting to save time');
    } else if (avgDuration < 30) {
      tips.push('Short workouts - ensure you\'re doing enough volume for your goals');
    }
    
    // Tip 9: Phase-specific tips
    if (state.phase === 'rampup') {
      tips.push('Focus on form and movement patterns during ramp-up - weights will come');
    } else if (state.mesoWeek === 4) {
      tips.push('Deload week: Reduce weights 10-20% and enjoy the lighter load');
    } else if (state.mesoWeek === 3) {
      tips.push('Week 3 - push for PRs but listen to your body for deload signals');
    }
    
    // Tip 10: Sleep optimization
    const avgSleep = bodyWeights.slice(-7).filter(b => b.sleep).reduce((s, b, _, arr) => 
      arr.length ? s + b.sleep / arr.length : 0, 0);
    if (avgSleep > 0 && avgSleep < 6) {
      tips.push(`Sleep avg ${avgSleep.toFixed(1)}h - consider lighter session or nap before workout`);
    } else if (avgSleep >= 8) {
      tips.push('Great sleep habits - this is when your muscles actually grow!');
    }
    
    // Tip 11: Goal progress
    if (state.goals?.targetWeight && recentBW.length) {
      const current = recentBW[recentBW.length - 1].weight;
      const diff = Math.abs(state.goals.targetWeight - current);
      if (diff < 5) {
        tips.push('Almost at your weight goal! Stay consistent with nutrition');
      }
    }
    
    // Tip 12: Warm-up reminder
    tips.push('Warm up properly: 5-10 min light cardio, then warm-up sets on first exercise');
    
    return tips;
  }

  /**
   * Suggest workout adjustments
   */
  function suggestWorkoutAdjustments(state, history) {
    const weightAdjustments = {};
    const exerciseSwaps = [];
    
    const nextDay = state.phase === 'rampup' ? null : 
      (state.pplIdx !== undefined ? ['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B', 'Legs B'][state.pplIdx] : null);
    
    if (!nextDay || state.phase === 'rampup') {
      return { weightAdjustments, exerciseSwaps };
    }
    
    // Get exercises for next day
    const dayKey = nextDay.toLowerCase().replace(' ', '-');
    const program = PROGRAMS?.[state.program] || PROGRAMS?.standard;
    const dayData = program?.ppl?.find(p => p.key === dayKey);
    
    if (!dayData) return { weightAdjustments, exerciseSwaps };
    
    for (const ex of dayData.exercises) {
      const last = getExerciseHistory(history, ex.name)[0];
      if (!last) continue;
      
      // Suggest weight increase if hit target reps with good RIR
      const targetReps = parseRepTarget(ex.reps);
      const avgReps = last.reps?.reduce((s, r) => s + r, 0) / (last.reps?.length || 1);
      const avgRIR = last.rir?.reduce((s, r) => s + r, 0) / (last.rir?.length || 1);
      
      if (avgReps >= targetReps && avgRIR <= 2) {
        const increment = (state.units === 'kg') ? 2.5 : 5;
        weightAdjustments[ex.name] = {
          current: last.weight,
          suggested: last.weight + increment,
          reason: 'Hit target reps with low RIR - time to progress!'
        };
      }
      
      // Suggest swap if plateau detected
      const exHistory = getExerciseHistory(history, ex.name);
      if (exHistory.length >= 3) {
        const last3 = exHistory.slice(0, 3);
        const noProgress = last3.every(h => h.weight === last3[0].weight);
        if (noProgress) {
          const alternatives = (MUSCLE_GROUPS?.[getMuscleGroup(ex.name)] || [])
            .filter(a => a !== ex.name);
          if (alternatives.length) {
            exerciseSwaps.push({
              current: ex.name,
              alternatives: alternatives.slice(0, 3),
              reason: 'Stalled for 3+ sessions - try a variation for fresh stimulus'
            });
          }
        }
      }
    }
    
    return { weightAdjustments, exerciseSwaps };
  }

  /**
   * Answer specific user questions (rule-based)
   */
  function answerQuestion(question, context) {
    const q = question.toLowerCase().trim();
    const { state, history, bodyWeights } = context || {};
    
    // Common questions and answers
    const responses = {
      // Volume questions
      'volume': () => {
        const vol = getVolumeForPeriod(history || [], 7);
        return `This week: ${vol.sets} sets across ${vol.workouts} workouts (${vol.avgSetsPerWorkout} avg sets/workout)`;
      },
      
      // PR questions
      'pr': () => {
        const recentPRs = [];
        for (const w of (history || []).slice(0, 10)) {
          for (const ex of (w.exercises || [])) {
            const pr = getPR(history || [], ex.name);
            const bestInWorkout = Math.max(...(ex.sets || []).map(s => parseFloat(s.weight) || 0), 0);
            if (bestInWorkout >= pr && pr > 0) {
              recentPRs.push(`${ex.name}: ${fmtW(pr, state?.units)}`);
            }
          }
        }
        return recentPRs.length ? 
          `Recent PRs: ${recentPRs.join(', ')}` : 
          'No recent PRs - focus on progressive overload!';
      },
      
      // Plateau questions
      'plateau': () => {
        const plateaus = detectPlateaus(history || []);
        if (!plateaus.length) return 'No plateaus detected - keep pushing!';
        return `Plateaus: ${plateaus.map(p => `${p.exercise} (${p.weeksStalled} weeks)`).join(', ')}`;
      },
      
      // Deload questions
      'deload': () => {
        const check = shouldDeload(state || {}, history || [], bodyWeights || []);
        if (check.shouldDeload) {
          return `Deload recommended: ${check.reasons.join('; ')}`;
        }
        return 'No deload needed currently. Continue with planned progression.';
      },
      
      // Recovery questions
      'recovery': () => {
        const analysis = analyzeRecovery(bodyWeights || []);
        return analysis.score ? 
          `Recovery score: ${analysis.score}/100. ${analysis.advice}` :
          'Start tracking sleep and readiness for recovery insights';
      },
      
      // Sleep questions
      'sleep': () => {
        const recent = (bodyWeights || []).slice(-7).filter(b => b.sleep);
        if (!recent.length) return 'No sleep data tracked yet';
        const avg = (recent.reduce((s, b) => s + b.sleep, 0) / recent.length).toFixed(1);
        return `7-day sleep average: ${avg} hours. ${avg < 7 ? 'Try to increase for better recovery!' : 'Good sleep habits!'}`;
      },
      
      // Next workout questions
      'next': () => {
        if (!state) return 'No state available';
        const next = state.phase === 'rampup' ? 'Ramp-up day' :
          ['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B', 'Legs B'][state.pplIdx] || 'Unknown';
        const adjustments = suggestWorkoutAdjustments(state, history || []);
        const suggestions = Object.keys(adjustments.weightAdjustments).length;
        return `Next: ${next}. ${suggestions} potential weight increases identified.`;
      },
      
      // Goal questions
      'goal': () => {
        const goals = state?.goals;
        if (!goals?.targetWeight) return 'No weight goal set';
        const recent = (bodyWeights || []).filter(b => b.weight).slice(-1)[0];
        const current = recent?.weight || 0;
        const diff = Math.abs(goals.targetWeight - current);
        const direction = goals.targetWeight > current ? 'gain' : 'lose';
        return `Goal: ${fmtW(goals.targetWeight, state?.units)}. Current: ${fmtW(current, state?.units)}. Need to ${direction} ${fmtW(diff, state?.units)}.`;
      }
    };
    
    // Match question to response
    for (const [keyword, responder] of Object.entries(responses)) {
      if (q.includes(keyword)) {
        try {
          return responder();
        } catch (e) {
          return `Sorry, I couldn't answer that question right now.`;
        }
      }
    }
    
    // Default responses for common themes
    if (q.includes('weight') && q.includes('increase')) {
      return 'Increase weight when you hit your target reps with good form and 1-2 RIR remaining';
    }
    if (q.includes('form')) {
      return 'Prioritize form over weight. If form breaks down, reduce weight and build back up';
    }
    if (q.includes('rest')) {
      return 'Rest 2-3 min for compounds, 60-90s for isolation work';
    }
    if (q.includes('protein')) {
      return 'Aim for 0.7-1g protein per lb of bodyweight daily for muscle growth';
    }
    if (q.includes('warm')) {
      return 'Warm up with light cardio, then 2-3 warm-up sets before working weight';
    }
    
    return "I don't have a specific answer for that. Try asking about volume, PRs, plateaus, deload, recovery, sleep, or your next workout!";
  }

  // ========== MAIN ANALYSIS FUNCTION ==========

  /**
   * Analyze current training state and return comprehensive insights
   */
  function analyzeTrainingState(state, history, bodyWeights) {
    const insights = [];
    const warnings = [];
    const recommendations = [];
    
    // Get all analysis components
    const plateaus = detectPlateaus(history);
    const deloadCheck = shouldDeload(state, history, bodyWeights);
    const prPotential = findPRPotential(history, state);
    const volumeTrends = analyzeVolumeTrends(history);
    const recovery = analyzeRecovery(bodyWeights);
    const fatigueScore = calculateFatigueScore(history);
    
    // Add volume insights
    insights.push(...volumeTrends.insights);
    
    // Add plateau warnings
    if (plateaus.length) {
      warnings.push(`${plateaus.length} exercise(s) stalled: ${plateaus.slice(0, 2).map(p => p.exercise).join(', ')}${plateaus.length > 2 ? '...' : ''}`);
      recommendations.push('Address plateaus by varying rep ranges, adding sets, or swapping exercises');
    }
    
    // Add deload warning
    if (deloadCheck.shouldDeload) {
      warnings.push('DELOAD RECOMMENDED: ' + deloadCheck.reasons[0]);
      recommendations.push('Take a deload week - reduce weights 10-20% and volume by 30-40%');
    }
    
    // Add PR potential insights
    if (prPotential.length) {
      const readyForPR = prPotential.filter(p => p.percentOfPR >= 98);
      if (readyForPR.length) {
        insights.push(`${readyForPR.length} exercise(s) ready for PR attempt!`);
        recommendations.push(`Go for it on: ${readyForPR.slice(0, 2).map(p => p.exercise).join(', ')}`);
      }
    }
    
    // Add recovery insights
    if (recovery.score !== null) {
      if (recovery.score < 50) {
        warnings.push(`Recovery score low (${recovery.score}/100)`);
        recommendations.push('Prioritize sleep and consider an extra rest day');
      } else if (recovery.score >= 85) {
        insights.push('Excellent recovery status - prime for PRs!');
      }
    }
    
    // Add fatigue warning
    if (fatigueScore > FATIGUE_THRESHOLD) {
      warnings.push(`High fatigue detected (${fatigueScore}/100)`);
      recommendations.push('Reduce training volume by 20% this week');
    }
    
    // Add streak insights
    if (state.longestStreak) {
      insights.push(`Longest streak: ${state.longestStreak} workouts - impressive!`);
    }
    
    // Add phase-specific insights
    if (state.phase === 'ppl') {
      if (state.mesoWeek === 1) {
        insights.push('Week 1 of meso - establish baseline weights');
      } else if (state.mesoWeek === 2) {
        insights.push('Week 2 - progressive overload time');
      } else if (state.mesoWeek === 3) {
        insights.push('Week 3 - push for PRs but watch for fatigue');
      } else if (state.mesoWeek === 4) {
        insights.push('Deload week - embrace the lighter load');
      }
    }
    
    // Check for missing data
    if (!bodyWeights.length) {
      recommendations.push('Start tracking body weight for better progress insights');
    }
    if (!bodyWeights.some(b => b.sleep)) {
      recommendations.push('Track sleep to optimize recovery recommendations');
    }
    
    return {
      insights: insights.slice(0, 8),  // Cap at 8 insights
      warnings: warnings.slice(0, 5),  // Cap at 5 warnings
      recommendations: recommendations.slice(0, 5),  // Cap at 5 recommendations
      plateaus: plateaus.slice(0, 5),  // Cap at 5 plateaus
      deloadSuggested: deloadCheck.shouldDeload,
      prPotential: prPotential.slice(0, 5),  // Cap at 5 PR potentials
      fatigueScore,
      recoveryScore: recovery.score,
      volumeTrends
    };
  }

  // ========== PUBLIC API ==========
  return {
    analyzeTrainingState,
    detectPlateaus,
    shouldDeload,
    generateTips,
    analyzeRecovery,
    suggestWorkoutAdjustments,
    answerQuestion,
    
    // Additional utility functions for external use
    getVolumeForPeriod,
    getExerciseHistory,
    getPR,
    calculateFatigueScore,
    findPRPotential,
    analyzeVolumeTrends
  };
})();

// Make available globally
if (typeof window !== 'undefined') {
  window.Coach = Coach;
}
