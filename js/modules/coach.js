// ============================================
// AI COACH — Smart Recommendations Engine
// ============================================
// Client-side analytics for workout insights, plateau detection,
// fatigue analysis, and personalized recommendations.
// No API calls - works entirely with local data.

/**
 * Parse rep range string (e.g., "8-10", "6-8", "AMRAP") to get target reps
 * @param {string} repStr - Rep range string
 * @returns {number} Target rep number
 */
function parseTargetReps(repStr) {
  if (!repStr || repStr.toLowerCase().includes('amrap')) return 8;
  const match = repStr.match(/(\d+)(?:-(\d+))?/);
  if (!match) return 8;
  const min = parseInt(match[1], 10);
  const max = match[2] ? parseInt(match[2], 10) : min;
  return Math.round((min + max) / 2);
}

/**
 * Parse top number from rep string (handles ranges)
 * @param {string} r - Rep string
 * @returns {number} Top rep number
 */
function parseTopRep(r) {
  const m = String(r).match(/(\d+)/);
  return m ? +m[1] : 0;
}

/**
 * Calculate estimated 1-rep max using Epley formula
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
 * Get muscle group for an exercise
 * @param {string} exName - Exercise name
 * @returns {string} Muscle group name
 */
function getMuscleGroup(exName) {
  // This mirrors the function in program-data.js
  // Import MUSCLE_GROUPS if available, otherwise use fallback
  if (typeof MUSCLE_GROUPS !== 'undefined') {
    for (const [group, exercises] of Object.entries(MUSCLE_GROUPS)) {
      if (exercises.includes(exName)) return group;
    }
  }
  // Fallback muscle groups
  const fallbackGroups = {
    "Chest": ["Barbell Bench Press", "Incline DB Press", "DB Bench Press", "Cable Flye", "Cable Crossover", "Incline BB Bench", "Weighted Dips"],
    "Back": ["Weighted Pull-Ups", "Pull-Ups", "Lat Pulldown", "Barbell Row", "DB Row", "Cable Row", "Landmine Row"],
    "Shoulders": ["Overhead Press", "DB Overhead Press", "DB Lateral Raise", "Cable Lateral Raise", "Arnold Press", "Cable Face Pull"],
    "Quads": ["Barbell Back Squat", "Front Squat", "Goblet Squat", "Bulgarian Split Squat", "Walking Lunges", "Step-Ups", "Leg Press"],
    "Hamstrings": ["Romanian Deadlift", "Stiff-Leg DL", "Cable Pull-Through", "Lying Leg Curl"],
    "Glutes": ["BB Hip Thrust", "Glute Bridge", "Cable Kickback", "Sumo Deadlift"],
    "Calves": ["Standing Calf Raise", "Seated Calf Raise", "Single-Leg Calf Raise"],
    "Biceps": ["Barbell Curl", "Cable Hammer Curl", "Cable Curl", "Incline DB Curl"],
    "Triceps": ["Cable Pushdown", "Cable OH Tricep Ext"],
  };
  for (const [group, exercises] of Object.entries(fallbackGroups)) {
    for (const ex of exercises) {
      if (exName.toLowerCase().includes(ex.toLowerCase())) return group;
    }
  }
  return "Other";
}

/**
 * Get the best weight ever lifted for an exercise
 * @param {string} name - Exercise name
 * @param {Array} history - Workout history
 * @returns {number} Best weight
 */
function getPR(name, history) {
  let best = 0;
  for (const w of history) {
    const ex = w.exercises?.find(e => e.name === name);
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
 * Analyze a single workout and return insights
 * @param {Object} entry - Workout entry
 * @param {Array} history - Full workout history
 * @param {Object} state - Current app state
 * @returns {Array} Array of insight objects
 */
function analyzeWorkout(entry, history, state) {
  const insights = [];
  const entryDate = new Date(entry.date);
  
  // Analyze each exercise
  for (const ex of (entry.exercises || [])) {
    const exHistory = history.filter(h => 
      h.exercises?.some(e => e.name === ex.name)
    );
    
    // PR detection
    const prWeight = getPR(ex.name, history);
    const bestSet = ex.sets?.reduce((best, s) => {
      const w = parseFloat(s.weight) || 0;
      return w > best.weight ? { weight: w, reps: parseInt(s.reps) || 0 } : best;
    }, { weight: 0, reps: 0 });
    
    if (bestSet.weight > 0 && bestSet.weight >= prWeight) {
      insights.push({
        type: 'pr',
        priority: 'high',
        exercise: ex.name,
        message: `New PR on ${ex.name}: ${bestSet.weight}`,
        data: bestSet
      });
    } else if (bestSet.weight > 0 && bestSet.weight >= prWeight * 0.95) {
      insights.push({
        type: 'near-pr',
        priority: 'medium',
        exercise: ex.name,
        message: `Near PR on ${ex.name}! Next session go for ${Math.ceil(bestSet.weight + (state?.units === 'kg' ? 2.5 : 5))}`,
        data: { current: bestSet.weight, target: Math.ceil(bestSet.weight + (state?.units === 'kg' ? 2.5 : 5)) }
      });
    }
    
    // Volume analysis for this session
    const totalVolume = ex.sets?.reduce((sum, s) => 
      sum + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0
    ) || 0;
    
    const totalSets = ex.sets?.filter(s => s.weight && s.reps).length || 0;
    
    // Compare to previous session
    const prevSession = exHistory.find(h => new Date(h.date) < entryDate);
    if (prevSession) {
      const prevEx = prevSession.exercises?.find(e => e.name === ex.name);
      const prevVolume = prevEx?.sets?.reduce((sum, s) => 
        sum + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0
      ) || 0;
      
      if (prevVolume > 0) {
        const volChange = ((totalVolume - prevVolume) / prevVolume) * 100;
        if (volChange >= 15) {
          insights.push({
            type: 'volume-spike',
            priority: 'medium',
            exercise: ex.name,
            message: `${ex.name} volume up ${Math.round(volChange)}% - watch for fatigue`,
            data: { change: volChange, current: totalVolume, previous: prevVolume }
          });
        }
      }
    }
    
    // Target achievement check
    const targetReps = parseTargetReps(ex.targetReps);
    const rirTarget = parseInt(entry.rirTarget) || 3;
    const allSetsHitTarget = ex.sets?.every(s => {
      const reps = parseInt(s.reps) || 0;
      const rir = parseInt(s.rir) || 3;
      return reps >= targetReps && rir <= rirTarget;
    });
    
    if (allSetsHitTarget && totalSets > 0) {
      const increment = state?.units === 'kg' ? 2.5 : 5;
      insights.push({
        type: 'progress-ready',
        priority: 'high',
        exercise: ex.name,
        message: `All sets hit target on ${ex.name} - increase to ${bestSet.weight + increment} next time`,
        data: { current: bestSet.weight, suggested: bestSet.weight + increment }
      });
    }
  }
  
  // Workout duration insight
  if (entry.duration) {
    if (entry.duration > 120) {
      insights.push({
        type: 'duration',
        priority: 'low',
        message: `Long workout (${entry.duration} min) - consider splitting or reducing rest`,
        data: { duration: entry.duration }
      });
    } else if (entry.duration < 30) {
      insights.push({
        type: 'duration',
        priority: 'low',
        message: `Quick workout (${entry.duration} min) - good for busy days`,
        data: { duration: entry.duration }
      });
    }
  }
  
  return insights.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Detect plateau for a specific exercise
 * @param {string} exerciseName - Name of exercise
 * @param {Array} history - Workout history
 * @param {Object} options - Detection options
 * @returns {Object} Plateau status
 */
function detectPlateau(exerciseName, history, options = {}) {
  const sessions = history
    .filter(h => h.exercises?.some(e => e.name === exerciseName))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, options.lookbackWeeks ? options.lookbackWeeks * 2 : 6);
  
  if (sessions.length < 3) {
    return { 
      isPlateau: false, 
      confidence: 'low', 
      reason: 'Not enough data (need 3+ sessions)',
      weeksAtSameWeight: 0
    };
  }
  
  // Get best weight from each session
  const sessionWeights = sessions.map(h => {
    const ex = h.exercises?.find(e => e.name === exerciseName);
    if (!ex?.sets) return 0;
    return Math.max(...ex.sets.map(s => parseFloat(s.weight) || 0), 0);
  }).filter(w => w > 0);
  
  if (sessionWeights.length < 3) {
    return { 
      isPlateau: false, 
      confidence: 'low', 
      reason: 'Not enough weighted sets',
      weeksAtSameWeight: 0
    };
  }
  
  // Check if weight has been the same for multiple sessions
  const currentWeight = sessionWeights[0];
  const sameWeightCount = sessionWeights.filter(w => w === currentWeight).length;
  
  // Check for progression pattern
  const hasProgression = sessionWeights.some((w, i) => 
    i > 0 && w < currentWeight
  );
  
  // Calculate trend (are reps going up even if weight isn't?)
  const sessionReps = sessions.map(h => {
    const ex = h.exercises?.find(e => e.name === exerciseName);
    if (!ex?.sets) return 0;
    const workingSets = ex.sets.filter(s => s.weight > 0 && s.reps);
    if (workingSets.length === 0) return 0;
    return workingSets.reduce((sum, s) => sum + (parseInt(s.reps) || 0), 0) / workingSets.length;
  });
  
  const repTrend = sessionReps.length >= 2 
    ? sessionReps[0] - sessionReps[sessionReps.length - 1]
    : 0;
  
  const isPlateau = sameWeightCount >= 3 && !hasProgression && repTrend < 2;
  
  return {
    isPlateau,
    confidence: sameWeightCount >= 4 ? 'high' : sameWeightCount >= 3 ? 'medium' : 'low',
    currentWeight,
    weeksAtSameWeight: Math.floor(sameWeightCount / 2), // Approximate weeks
    repTrend,
    reason: isPlateau 
      ? `${sameWeightCount} sessions at ${currentWeight} ${state?.units || 'lbs'} with minimal rep progress`
      : hasProgression 
        ? 'Recent progression detected'
        : repTrend >= 2 
          ? 'Reps increasing - continue current weight'
          : 'Weight varies between sessions'
  };
}

/**
 * Calculate volume trend for a muscle group
 * @param {string} muscleGroup - Muscle group name
 * @param {Array} history - Workout history
 * @param {number} weeks - Number of weeks to analyze
 * @returns {Object} Trend analysis
 */
function calculateVolumeTrend(muscleGroup, history, weeks = 4) {
  const now = Date.now();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  
  // Group workouts by week
  const weeklyVolumes = [];
  
  for (let i = 0; i < weeks; i++) {
    const weekStart = now - (i + 1) * msPerWeek;
    const weekEnd = now - i * msPerWeek;
    
    const weekWorkouts = history.filter(h => {
      const date = new Date(h.date).getTime();
      return date >= weekStart && date < weekEnd;
    });
    
    let totalSets = 0;
    let totalTonnage = 0;
    let totalExercises = 0;
    
    for (const w of weekWorkouts) {
      for (const ex of (w.exercises || [])) {
        if (getMuscleGroup(ex.name) === muscleGroup) {
          const workingSets = ex.sets?.filter(s => s.weight && s.reps) || [];
          totalSets += workingSets.length;
          totalExercises++;
          for (const s of workingSets) {
            totalTonnage += (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0);
          }
        }
      }
    }
    
    weeklyVolumes.push({
      week: weeks - i,
      sets: totalSets,
      tonnage: totalTonnage,
      exercises: totalExercises
    });
  }
  
  // Calculate week-over-week change
  const currentWeek = weeklyVolumes[weeklyVolumes.length - 1];
  const previousWeek = weeklyVolumes[weeklyVolumes.length - 2];
  
  let trendPercent = 0;
  if (previousWeek && previousWeek.sets > 0) {
    trendPercent = ((currentWeek.sets - previousWeek.sets) / previousWeek.sets) * 100;
  }
  
  // Calculate average weekly volume
  const avgSets = weeklyVolumes.reduce((sum, w) => sum + w.sets, 0) / weeklyVolumes.length;
  const avgTonnage = weeklyVolumes.reduce((sum, w) => sum + w.tonnage, 0) / weeklyVolumes.length;
  
  // Detect concerning trends
  const alerts = [];
  if (trendPercent > 25) {
    alerts.push({
      type: 'volume-spike',
      message: `${muscleGroup} volume up ${Math.round(trendPercent)}% this week - monitor recovery`
    });
  } else if (trendPercent < -25 && currentWeek.sets > 0) {
    alerts.push({
      type: 'volume-drop',
      message: `${muscleGroup} volume down ${Math.round(Math.abs(trendPercent))}% - check if intentional`
    });
  }
  
  return {
    muscleGroup,
    trendPercent: Math.round(trendPercent),
    currentWeek,
    previousWeek: previousWeek || null,
    weeklyHistory: weeklyVolumes,
    average: { sets: Math.round(avgSets), tonnage: Math.round(avgTonnage) },
    alerts,
    isOverreaching: trendPercent > 30
  };
}

/**
 * Suggest recommendations for the next session
 * @param {string} dayLabel - Day label (e.g., "Push A")
 * @param {Array} history - Workout history
 * @param {Object} state - Current app state
 * @returns {Object} Recommendations
 */
function suggestNextSession(dayLabel, history, state) {
  const recommendations = {
    weightAdjustments: [],
    exerciseSwaps: [],
    rirAdjustment: null,
    deloadRecommended: false,
    warnings: [],
    encouragement: []
  };
  
  // Get previous sessions of this day type
  const prevSessions = history
    .filter(h => h.dayLabel === dayLabel)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const lastSession = prevSessions[0];
  
  if (!lastSession) {
    recommendations.encouragement.push('First time doing this session - focus on form and establish baselines');
    return recommendations;
  }
  
  // Analyze each exercise from previous session
  for (const ex of (lastSession.exercises || [])) {
    const exName = ex.name;
    const targetReps = parseTargetReps(ex.targetReps);
    const workingSets = ex.sets?.filter(s => s.weight && s.reps) || [];
    
    if (workingSets.length === 0) continue;
    
    const bestWeight = Math.max(...workingSets.map(s => parseFloat(s.weight) || 0));
    const avgReps = workingSets.reduce((sum, s) => sum + (parseInt(s.reps) || 0), 0) / workingSets.length;
    const avgRIR = workingSets.reduce((sum, s) => sum + (parseInt(s.rir) || 3), 0) / workingSets.length;
    
    // Check if ready to progress
    const allHitTarget = workingSets.every(s => 
      (parseInt(s.reps) || 0) >= targetReps && (parseInt(s.rir) || 3) <= 2
    );
    
    if (allHitTarget) {
      const increment = state?.units === 'kg' ? 2.5 : 5;
      recommendations.weightAdjustments.push({
        exercise: exName,
        current: bestWeight,
        suggested: bestWeight + increment,
        reason: 'All sets hit target with good RIR'
      });
    }
    
    // Check plateau status
    const plateau = detectPlateau(exName, history, { lookbackWeeks: 3 });
    if (plateau.isPlateau && plateau.confidence === 'high') {
      recommendations.warnings.push({
        type: 'plateau',
        exercise: exName,
        message: `${exName} stuck at ${plateau.currentWeight} for ${plateau.weeksAtSameWeight}+ weeks`,
        suggestion: 'Consider a deload or technique refinement'
      });
    }
    
    // Check for declining performance
    if (prevSessions.length >= 2) {
      const prevSession2 = prevSessions[1];
      const prevEx2 = prevSession2.exercises?.find(e => e.name === exName);
      if (prevEx2) {
        const prevSets2 = prevEx2.sets?.filter(s => s.weight && s.reps) || [];
        const prevAvgReps = prevSets2.reduce((sum, s) => sum + (parseInt(s.reps) || 0), 0) / (prevSets2.length || 1);
        
        if (avgReps < prevAvgReps - 1.5) {
          recommendations.warnings.push({
            type: 'declining',
            exercise: exName,
            message: `Reps declining on ${exName} (${prevAvgReps.toFixed(1)} → ${avgReps.toFixed(1)})`,
            suggestion: 'Reduce weight by 10% or add rest day'
          });
        }
      }
    }
  }
  
  // Check if deload is warranted
  const decliningCount = recommendations.warnings.filter(w => w.type === 'declining').length;
  if (decliningCount >= 2) {
    recommendations.deloadRecommended = true;
    recommendations.rirAdjustment = 'Add 1-2 RIR (leave more reps in reserve)';
  }
  
  // Check fatigue from state
  if (state?.fatigueFlags >= 2) {
    recommendations.deloadRecommended = true;
    recommendations.warnings.push({
      type: 'fatigue',
      message: 'System fatigue detected - deload strongly recommended',
      suggestion: 'Switch to deload week or reduce volume by 40%'
    });
  }
  
  // RIR guidance based on meso week
  if (state?.mesoWeek) {
    const rirByWeek = { 1: '3 RIR', 2: '2 RIR', 3: '1 RIR', 4: '4+ RIR (deload)' };
    recommendations.rirGuidance = rirByWeek[state.mesoWeek] || '2-3 RIR';
  }
  
  return recommendations;
}

/**
 * Get recovery status based on sleep and readiness data
 * @param {Array} bodyWeights - Body weight entries with sleep data
 * @param {Array} measurements - Measurements data
 * @returns {Object} Recovery status
 */
function getRecoveryStatus(bodyWeights, measurements = []) {
  const now = Date.now();
  const days7 = 7 * 24 * 60 * 60 * 1000;
  
  // Get recent entries
  const recentEntries = (bodyWeights || [])
    .filter(b => new Date(b.date).getTime() > now - days7)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (recentEntries.length === 0) {
    return {
      status: 'unknown',
      message: 'No recent health data logged',
      score: null,
      recommendations: ['Log daily weight and sleep for recovery insights']
    };
  }
  
  // Calculate averages
  const sleepHours = recentEntries
    .filter(b => b.sleep)
    .map(b => parseFloat(b.sleep))
    .filter(s => s > 0);
  
  const readinessScores = recentEntries
    .filter(b => b.readiness)
    .map(b => parseFloat(b.readiness))
    .filter(r => r > 0);
  
  const avgSleep = sleepHours.length > 0 
    ? sleepHours.reduce((a, b) => a + b, 0) / sleepHours.length 
    : 0;
  
  const avgReadiness = readinessScores.length > 0
    ? readinessScores.reduce((a, b) => a + b, 0) / readinessScores.length
    : 0;
  
  // Calculate recovery score (0-100)
  let score = 50; // Base score
  if (avgSleep >= 7) score += 25;
  else if (avgSleep >= 6) score += 15;
  else if (avgSleep >= 5) score += 5;
  
  if (avgReadiness >= 80) score += 25;
  else if (avgReadiness >= 70) score += 15;
  else if (avgReadiness >= 60) score += 5;
  
  // Determine status
  let status, message, recommendations = [];
  
  if (score >= 80) {
    status = 'excellent';
    message = 'Recovery is on point - ready to push hard';
    recommendations = ['Good time to attempt PRs', 'Can handle higher volume'];
  } else if (score >= 65) {
    status = 'good';
    message = 'Adequate recovery - proceed as planned';
    recommendations = ['Maintain current program', 'Focus on sleep quality tonight'];
  } else if (score >= 50) {
    status = 'moderate';
    message = 'Moderate recovery - monitor fatigue';
    recommendations = ['Consider extra rest between sets', 'Prioritize sleep tonight'];
  } else if (score >= 35) {
    status = 'poor';
    message = 'Poor recovery detected';
    recommendations = ['Reduce volume by 20%', 'Add 1 RIR to all sets', 'Prioritize 8+ hours sleep'];
  } else {
    status = 'critical';
    message = 'Very low recovery - consider rest day';
    recommendations = ['Take a rest day or do active recovery', 'Skip high-intensity sets', 'Focus on nutrition and sleep'];
  }
  
  // Sleep-specific warnings
  if (avgSleep > 0 && avgSleep < 6) {
    recommendations.push(`Sleep averaged ${avgSleep.toFixed(1)}h - consider deload`);
  }
  
  return {
    status,
    message,
    score: Math.round(score),
    avgSleep: avgSleep > 0 ? parseFloat(avgSleep.toFixed(1)) : null,
    avgReadiness: avgReadiness > 0 ? Math.round(avgReadiness) : null,
    dataPoints: recentEntries.length,
    recommendations
  };
}

/**
 * Detect fatigue patterns across workout history
 * @param {Array} history - Workout history
 * @returns {Object} Fatigue analysis
 */
function detectFatiguePatterns(history) {
  if (history.length < 4) {
    return { detected: false, reason: 'Not enough workout history' };
  }
  
  const recent = history.slice(0, 10); // Last 10 workouts
  const analysis = {
    detected: false,
    confidence: 'low',
    decliningExercises: [],
    overallTrend: 'stable',
    recommendation: ''
  };
  
  // Group by exercise
  const exerciseHistory = {};
  for (const h of recent) {
    for (const ex of (h.exercises || [])) {
      if (!exerciseHistory[ex.name]) exerciseHistory[ex.name] = [];
      const workingSets = ex.sets?.filter(s => s.weight && s.reps);
      if (workingSets.length > 0) {
        const avgReps = workingSets.reduce((sum, s) => sum + (parseInt(s.reps) || 0), 0) / workingSets.length;
        const bestWeight = Math.max(...workingSets.map(s => parseFloat(s.weight) || 0));
        exerciseHistory[ex.name].push({ date: h.date, avgReps, bestWeight });
      }
    }
  }
  
  // Check for declining patterns
  for (const [exName, sessions] of Object.entries(exerciseHistory)) {
    if (sessions.length < 3) continue;
    
    // Check if recent sessions show decline
    const recentReps = sessions.slice(0, 2).map(s => s.avgReps);
    const olderReps = sessions.slice(2, 4).map(s => s.avgReps);
    
    if (recentReps.length >= 2 && olderReps.length >= 2) {
      const recentAvg = recentReps.reduce((a, b) => a + b, 0) / recentReps.length;
      const olderAvg = olderReps.reduce((a, b) => a + b, 0) / olderReps.length;
      
      if (recentAvg < olderAvg - 1) {
        analysis.decliningExercises.push({
          exercise: exName,
          trend: `${olderAvg.toFixed(1)} → ${recentAvg.toFixed(1)} reps`
        });
      }
    }
  }
  
  // Determine overall fatigue
  if (analysis.decliningExercises.length >= 3) {
    analysis.detected = true;
    analysis.confidence = 'high';
    analysis.overallTrend = 'declining';
    analysis.recommendation = 'Multiple exercises showing fatigue - take a deload week';
  } else if (analysis.decliningExercises.length >= 2) {
    analysis.detected = true;
    analysis.confidence = 'medium';
    analysis.overallTrend = 'declining';
    analysis.recommendation = 'Declining reps detected - consider reducing volume';
  } else if (analysis.decliningExercises.length === 1) {
    analysis.confidence = 'low';
    analysis.recommendation = 'One exercise declining - monitor other lifts';
  }
  
  return analysis;
}

/**
 * Generate a comprehensive weekly report
 * @param {Object} data - Data object containing history, bodyWeights, state
 * @returns {Object} Weekly report
 */
function generateWeeklyReport(data) {
  const { history, bodyWeights, state } = data;
  const now = Date.now();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  
  // Get this week's workouts
  const thisWeekWorkouts = (history || [])
    .filter(h => new Date(h.date).getTime() > now - msPerWeek);
  
  // Get previous week's workouts for comparison
  const lastWeekWorkouts = (history || [])
    .filter(h => {
      const date = new Date(h.date).getTime();
      return date > now - 2 * msPerWeek && date <= now - msPerWeek;
    });
  
  // Calculate workout frequency
  const daysWorked = new Set(thisWeekWorkouts.map(h => h.date.split('T')[0])).size;
  const totalWorkouts = thisWeekWorkouts.length;
  
  // Calculate total volume by muscle group
  const volumeByGroup = {};
  let totalSets = 0;
  let totalTonnage = 0;
  
  for (const w of thisWeekWorkouts) {
    for (const ex of (w.exercises || [])) {
      const group = getMuscleGroup(ex.name);
      if (!volumeByGroup[group]) volumeByGroup[group] = { sets: 0, tonnage: 0 };
      
      const workingSets = ex.sets?.filter(s => s.weight && s.reps) || [];
      volumeByGroup[group].sets += workingSets.length;
      totalSets += workingSets.length;
      
      for (const s of workingSets) {
        const vol = (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0);
        volumeByGroup[group].tonnage += vol;
        totalTonnage += vol;
      }
    }
  }
  
  // Compare to last week
  let lastWeekSets = 0;
  for (const w of lastWeekWorkouts) {
    for (const ex of (w.exercises || [])) {
      lastWeekSets += ex.sets?.filter(s => s.weight && s.reps).length || 0;
    }
  }
  
  const volumeChange = lastWeekSets > 0 
    ? Math.round(((totalSets - lastWeekSets) / lastWeekSets) * 100)
    : 0;
  
  // PRs this week
  const prsThisWeek = [];
  const previousHistory = history?.filter(h => new Date(h.date).getTime() <= now - msPerWeek) || [];
  
  for (const w of thisWeekWorkouts) {
    for (const ex of (w.exercises || [])) {
      const currentBest = Math.max(...ex.sets?.map(s => parseFloat(s.weight) || 0) || [0], 0);
      if (currentBest > 0) {
        const previousBest = getPR(ex.name, previousHistory);
        if (currentBest > previousBest) {
          prsThisWeek.push({
            exercise: ex.name,
            weight: currentBest,
            date: w.date
          });
        }
      }
    }
  }
  
  // Recovery analysis
  const recovery = getRecoveryStatus(bodyWeights);
  
  // Fatigue check
  const fatigue = detectFatiguePatterns(history || []);
  
  // Generate insights
  const insights = [];
  
  if (volumeChange > 20) {
    insights.push(`Volume up ${volumeChange}% this week - watch for fatigue`);
  } else if (volumeChange < -20) {
    insights.push(`Volume down ${Math.abs(volumeChange)}% - was this a deload week?`);
  }
  
  if (prsThisWeek.length > 0) {
    insights.push(`Hit ${prsThisWeek.length} PR${prsThisWeek.length > 1 ? 's' : ''} this week!`);
  }
  
  if (recovery.avgSleep && recovery.avgSleep < 6) {
    insights.push(`Sleep averaged ${recovery.avgSleep.toFixed(1)}h - prioritize rest`);
  }
  
  if (fatigue.detected) {
    insights.push(fatigue.recommendation);
  }
  
  // Check for plateaus
  const plateauChecks = [];
  const compounds = state?.program === 'glute-focus'
    ? ["BB Hip Thrust", "Barbell Back Squat", "Romanian Deadlift", "Sumo Deadlift", "Barbell Bench Press"]
    : ["Barbell Bench Press", "Barbell Back Squat", "Overhead Press (BB)", "Barbell Row (heavy)", "Weighted Pull-Ups"];
  
  for (const exName of compounds) {
    const plateau = detectPlateau(exName, history || [], { lookbackWeeks: 4 });
    if (plateau.isPlateau && plateau.weeksAtSameWeight >= 2) {
      plateauChecks.push({
        exercise: exName,
        weeks: plateau.weeksAtSameWeight,
        weight: plateau.currentWeight
      });
    }
  }
  
  if (plateauChecks.length > 0) {
    const ex = plateauChecks[0];
    insights.push(`${ex.exercise} stuck at ${ex.weight} for ${ex.weeks}+ weeks - time to progress or deload`);
  }
  
  // Next week recommendations
  const recommendations = [];
  if (fatigue.detected || recovery.status === 'poor' || recovery.status === 'critical') {
    recommendations.push('Consider a deload week (reduce volume 40-50%)');
  } else if (prsThisWeek.length >= 2) {
    recommendations.push('Great week! Continue current progression');
  } else if (volumeChange < 0) {
    recommendations.push('Increase volume or intensity next week');
  }
  
  if (recovery.avgSleep && recovery.avgSleep < 7) {
    recommendations.push('Target 7-8 hours of sleep for better recovery');
  }
  
  return {
    week: {
      start: new Date(now - msPerWeek).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    },
    summary: {
      workouts: totalWorkouts,
      daysWorked,
      totalSets,
      totalTonnage: Math.round(totalTonnage),
      volumeChange,
      prs: prsThisWeek
    },
    volumeByGroup,
    recovery,
    fatigue,
    insights,
    recommendations,
    plateaus: plateauChecks
  };
}

/**
 * Get all current insights as formatted strings
 * @param {Object} data - Data object containing history, bodyWeights, state
 * @returns {Array} Formatted insight strings
 */
function getInsights(data) {
  const { history, bodyWeights, state } = data;
  const insights = [];
  
  // Recovery insights
  const recovery = getRecoveryStatus(bodyWeights);
  if (recovery.avgSleep && recovery.avgSleep < 6) {
    insights.push(`Sleep averaged ${recovery.avgSleep.toFixed(1)}h - consider deload`);
  }
  if (recovery.status === 'poor' || recovery.status === 'critical') {
    insights.push('Low recovery score - take it easy today');
  }
  
  // Volume trend insights
  const muscleGroups = ['Chest', 'Back', 'Quads', 'Hamstrings', 'Shoulders'];
  for (const group of muscleGroups) {
    const trend = calculateVolumeTrend(group, history, 2);
    if (trend.trendPercent > 20) {
      insights.push(`Volume up ${trend.trendPercent}% this week - watch for fatigue`);
      break; // Only show one volume insight
    }
  }
  
  // Fatigue detection
  const fatigue = detectFatiguePatterns(history);
  if (fatigue.detected && fatigue.decliningExercises.length > 0) {
    const ex = fatigue.decliningExercises[0];
    insights.push(`Declining reps on ${ex.exercise} - deload recommended`);
  }
  
  // State-based fatigue flags
  if (state?.fatigueFlags >= 2) {
    insights.push('System fatigue detected - consider an early deload');
  }
  
  // Check recent workouts for near-PRs
  const recent = history?.slice(0, 3) || [];
  for (const w of recent) {
    for (const ex of (w.exercises || [])) {
      const bestSet = ex.sets?.reduce((best, s) => {
        const w = parseFloat(s.weight) || 0;
        return w > best.weight ? { weight: w, reps: parseInt(s.reps) || 0 } : best;
      }, { weight: 0, reps: 0 });
      
      if (bestSet.weight > 0) {
        const pr = getPR(ex.name, history || []);
        if (bestSet.weight >= pr * 0.95 && bestSet.weight < pr) {
          const nextWeight = bestSet.weight + (state?.units === 'kg' ? 2.5 : 5);
          insights.push(`Near PR on ${ex.name}! Next session go for ${nextWeight}`);
        }
      }
    }
  }
  
  // Plateau detection
  const compounds = ["Barbell Bench Press", "Barbell Back Squat", "Weighted Pull-Ups", "BB Hip Thrust"];
  for (const exName of compounds) {
    const plateau = detectPlateau(exName, history || [], { lookbackWeeks: 3 });
    if (plateau.isPlateau && plateau.weeksAtSameWeight >= 2) {
      insights.push(`${plateau.weeksAtSameWeight} weeks at same weight on ${exName} - time to progress`);
      break;
    }
  }
  
  return insights;
}

/**
 * Suggest exercise variations based on plateau or preference
 * @param {string} exerciseName - Current exercise
 * @param {string} reason - Reason for variation ('plateau', 'boredom', 'injury')
 * @returns {Array} Suggested variations
 */
function suggestVariations(exerciseName, reason = 'plateau') {
  const variations = {
    // Chest
    "Barbell Bench Press": {
      plateau: ["Incline BB Bench", "DB Bench Press", "Weighted Dips", "Floor Press"],
      boredom: ["DB Bench Press", "Weighted Dips", "Floor Press", "Spoto Press"],
      injury: ["DB Bench Press", "Floor Press", "Push-Ups", "Machine Press"]
    },
    "Incline DB Press": {
      plateau: ["Incline BB Bench", "Landmine Press", "Cable Flye (low-high)"],
      boredom: ["Arnold Press", "Landmine Press", "Cable Crossover"],
      injury: ["Landmine Press", "Cable Flye (low-high)", "Push-Ups"]
    },
    // Back
    "Weighted Pull-Ups": {
      plateau: ["Lat Pulldown (wide)", "Barbell Row (heavy)", "Weighted Chin-Ups"],
      boredom: ["Neutral Grip Pull-Ups", "Commando Pull-Ups", "Muscle-Ups"],
      injury: ["Lat Pulldown", "Cable Row", "Chest-Supported Row"]
    },
    "Barbell Row (heavy)": {
      plateau: ["Pendlay Row", "DB Row (single arm)", "Cable Row (V-bar)"],
      boredom: ["Meadows Row", "Seal Row", "Kroc Row"],
      injury: ["Cable Row", "Chest-Supported Row", "Machine Row"]
    },
    // Legs
    "Barbell Back Squat": {
      plateau: ["Front Squat (BB)", "Bulgarian Split Squat", "Pause Squat"],
      boredom: ["Safety Bar Squat", "Zercher Squat", "Box Squat"],
      injury: ["Goblet Squat", "Leg Press", "Hack Squat"]
    },
    "BB Hip Thrust": {
      plateau: ["Sumo Deadlift", "Romanian Deadlift", "B-Stance Hip Thrust"],
      boredom: ["Single-Leg Hip Thrust", "Cable Kickback", "Frog Pump"],
      injury: ["Glute Bridge", "Cable Pull-Through", "Band Hip Thrust"]
    },
    "Romanian Deadlift": {
      plateau: ["Stiff-Leg DL (DB)", "Good Morning", "Deficit RDL"],
      boredom: ["Snatch-Grip RDL", "Single-Leg RDL", "Jefferson Curl"],
      injury: ["Cable Pull-Through", "Back Extension", "Glute-Ham Raise"]
    },
    // Shoulders
    "Overhead Press (BB)": {
      plateau: ["DB Overhead Press", "Arnold Press (DB)", "Push Press"],
      boredom: ["Landmine Press", "Z Press", "Viking Press"],
      injury: ["DB Lateral Raise", "Cable Lateral Raise", "Landmine Press"]
    },
    // Default for any exercise not listed
    "default": {
      plateau: ["Try tempo work (3-1-3)", "Add pause reps", "Increase rep range"],
      boredom: ["Try drop sets", "Add supersets", "Change grip/stance"],
      injury: ["Reduce load 50%", "Focus on mind-muscle connection", "Try isometrics"]
    }
  };
  
  const exerciseVariations = variations[exerciseName] || variations["default"];
  return exerciseVariations[reason] || exerciseVariations["plateau"];
}

/**
 * Generate a comprehensive analysis report
 * @param {Object} data - Data object containing history, bodyWeights, state
 * @returns {Object} Comprehensive report
 */
function generateReport(data) {
  const { history, bodyWeights, state } = data;
  
  return {
    timestamp: new Date().toISOString(),
    weekly: generateWeeklyReport(data),
    recovery: getRecoveryStatus(bodyWeights),
    fatigue: detectFatiguePatterns(history),
    insights: getInsights(data),
    muscleGroupTrends: ['Chest', 'Back', 'Quads', 'Hamstrings', 'Glutes', 'Shoulders'].map(g => ({
      group: g,
      ...calculateVolumeTrend(g, history, 4)
    })),
    state: {
      phase: state?.phase,
      mesoWeek: state?.mesoWeek,
      program: state?.program,
      fatigueFlags: state?.fatigueFlags
    }
  };
}

// ============================================
// Export Coach object
// ============================================
export const Coach = {
  // Core analysis functions
  analyzeWorkout,
  detectPlateau,
  calculateVolumeTrend,
  suggestNextSession,
  getRecoveryStatus,
  generateWeeklyReport,
  
  // Additional utilities
  detectFatiguePatterns,
  getInsights,
  suggestVariations,
  generateReport,
  
  // Helper functions (exposed for advanced use)
  helpers: {
    parseTargetReps,
    parseTopRep,
    calc1RM,
    getMuscleGroup,
    getPR
  }
};

// Also export as default for flexibility
export default Coach;
