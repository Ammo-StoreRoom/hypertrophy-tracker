// ============================================
// CHARTS — Enhanced SVG Data Visualizations
// Pure SVG, no external dependencies
// ============================================

const Charts = (() => {
  // ========== THEME UTILITIES ==========
  function getCSSVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function getThemeColors() {
    return {
      accent: getCSSVar('--accent') || '#E94560',
      green: getCSSVar('--green') || '#22c55e',
      gold: getCSSVar('--gold') || '#facc15',
      blue: getCSSVar('--blue') || '#60a5fa',
      purple: getCSSVar('--purple') || '#7c3aed',
      orange: getCSSVar('--orange') || '#d97706',
      red: getCSSVar('--red') || '#ef4444',
      text: getCSSVar('--text') || '#e4e4e7',
      dim: getCSSVar('--dim') || '#71717a',
      muted: getCSSVar('--muted') || '#3f3f56',
      cardBorder: getCSSVar('--card-border') || '#1c1c36',
      bg: getCSSVar('--bg') || '#080810',
      card: getCSSVar('--card') || '#111122',
      white: getCSSVar('--white') || '#fff',
    };
  }

  // ========== SVG HELPERS ==========
  function createSVG(width, height, className = '') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('class', className);
    svg.style.width = '100%';
    svg.style.height = 'auto';
    svg.style.display = 'block';
    return svg;
  }

  function createLine(x1, y1, x2, y2, color, width = 1, dashArray = '') {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', width);
    if (dashArray) line.setAttribute('stroke-dasharray', dashArray);
    return line;
  }

  function createCircle(cx, cy, r, fill, stroke = '', strokeWidth = 0) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', r);
    circle.setAttribute('fill', fill);
    if (stroke) circle.setAttribute('stroke', stroke);
    if (strokeWidth) circle.setAttribute('stroke-width', strokeWidth);
    return circle;
  }

  function createRect(x, y, width, height, fill, rx = 0, stroke = '', strokeWidth = 0) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    rect.setAttribute('fill', fill);
    if (rx) rect.setAttribute('rx', rx);
    if (stroke) rect.setAttribute('stroke', stroke);
    if (strokeWidth) rect.setAttribute('stroke-width', strokeWidth);
    return rect;
  }

  function createText(x, y, text, color, fontSize = 12, anchor = 'middle', fontWeight = 'normal') {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', x);
    t.setAttribute('y', y);
    t.setAttribute('fill', color);
    t.setAttribute('font-size', fontSize);
    t.setAttribute('text-anchor', anchor);
    t.setAttribute('font-family', 'var(--font), sans-serif');
    if (fontWeight) t.setAttribute('font-weight', fontWeight);
    t.textContent = text;
    return t;
  }

  function createPath(d, fill, stroke = '', strokeWidth = 0) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', fill);
    if (stroke) path.setAttribute('stroke', stroke);
    if (strokeWidth) path.setAttribute('stroke-width', strokeWidth);
    return path;
  }

  // ========== DATA PROCESSING ==========
  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatShortDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  }

  function getWeekStart(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
  }

  function calculateMovingAverage(data, windowSize = 3) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      if (i < windowSize - 1) {
        result.push(null);
        continue;
      }
      let sum = 0;
      for (let j = 0; j < windowSize; j++) {
        sum += data[i - j];
      }
      result.push(sum / windowSize);
    }
    return result;
  }

  function calculateTrendLine(data) {
    const n = data.length;
    if (n < 2) return null;
    
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += data[i];
      sumXY += i * data[i];
      sumXX += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return {
      start: intercept,
      end: slope * (n - 1) + intercept,
      slope
    };
  }

  // ========== 1. LINE CHART FOR LIFT PROGRESS ==========
  function renderLiftProgressChart(options) {
    const {
      exercises, // Array of { name: string, data: [{date, weight, reps}] }
      width = 400,
      height = 220,
      showTrend = true,
      showTooltip = true
    } = options;

    const colors = getThemeColors();
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    // Collect all data points
    const allPoints = [];
    exercises.forEach((ex, idx) => {
      ex.data.forEach(d => {
        allPoints.push({ ...d, exerciseIndex: idx, exerciseName: ex.name });
      });
    });

    if (allPoints.length === 0) {
      const emptySvg = createSVG(width, height, 'chart-empty');
      emptySvg.appendChild(createText(width / 2, height / 2, 'No data yet', colors.dim, 14, 'middle'));
      return emptySvg;
    }

    // Sort by date
    allPoints.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate scales
    const dates = [...new Set(allPoints.map(p => p.date))];
    const minWeight = Math.min(...allPoints.map(p => p.weight)) * 0.95;
    const maxWeight = Math.max(...allPoints.map(p => p.weight)) * 1.05;
    const weightRange = maxWeight - minWeight || 1;

    const xScale = (i) => margin.left + (i / Math.max(dates.length - 1, 1)) * chartW;
    const yScale = (w) => margin.top + chartH - ((w - minWeight) / weightRange) * chartH;

    const svg = createSVG(width, height, 'chart-lift-progress');

    // Grid lines
    const gridCount = 5;
    for (let i = 0; i <= gridCount; i++) {
      const y = margin.top + (i / gridCount) * chartH;
      const weight = maxWeight - (i / gridCount) * weightRange;
      svg.appendChild(createLine(margin.left, y, width - margin.right, y, colors.muted, 0.5));
      svg.appendChild(createText(margin.left - 8, y + 4, Math.round(weight), colors.dim, 10, 'end'));
    }

    // X-axis labels
    const labelStep = Math.ceil(dates.length / 6);
    dates.forEach((date, i) => {
      if (i % labelStep === 0 || i === dates.length - 1) {
        const x = xScale(i);
        svg.appendChild(createText(x, height - 15, formatShortDate(date), colors.dim, 9, 'middle'));
      }
    });

    // Line colors
    const lineColors = [colors.accent, colors.blue, colors.green, colors.gold, colors.purple, colors.orange];

    // Draw each exercise line
    exercises.forEach((ex, idx) => {
      if (ex.data.length === 0) return;
      const sorted = ex.data.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
      const color = lineColors[idx % lineColors.length];

      // Create path
      let pathD = '';
      const points = [];
      
      sorted.forEach((d, i) => {
        const dateIdx = dates.indexOf(d.date);
        const x = xScale(dateIdx);
        const y = yScale(d.weight);
        points.push({ x, y, ...d });
        pathD += (i === 0 ? 'M' : 'L') + `${x},${y}`;
      });

      // Draw line
      svg.appendChild(createPath(pathD, 'none', color, 2));

      // Draw points
      points.forEach(p => {
        svg.appendChild(createCircle(p.x, p.y, 4, color, colors.card, 2));
      });

      // Trend line
      if (showTrend && sorted.length >= 2) {
        const weights = sorted.map(d => d.weight);
        const trend = calculateTrendLine(weights);
        if (trend) {
          const firstIdx = dates.indexOf(sorted[0].date);
          const lastIdx = dates.indexOf(sorted[sorted.length - 1].date);
          const x1 = xScale(firstIdx);
          const y1 = yScale(trend.start);
          const x2 = xScale(lastIdx);
          const y2 = yScale(trend.end);
          svg.appendChild(createLine(x1, y1, x2, y2, color, 1, '4,4'));
        }
      }
    });

    // Legend
    const legendY = 15;
    exercises.forEach((ex, idx) => {
      if (ex.data.length === 0) return;
      const color = lineColors[idx % lineColors.length];
      const legendX = margin.left + idx * 70;
      svg.appendChild(createLine(legendX, legendY, legendX + 15, legendY, color, 2));
      svg.appendChild(createText(legendX + 20, legendY + 4, ex.name.split(' ')[0], colors.text, 9, 'start'));
    });

    // Tooltip overlay
    if (showTooltip) {
      const tooltip = createRect(0, 0, 0, 0, colors.card, 6, colors.muted, 1);
      tooltip.style.opacity = '0';
      tooltip.style.pointerEvents = 'none';
      tooltip.setAttribute('class', 'chart-tooltip-bg');
      svg.appendChild(tooltip);

      const tooltipText = createText(0, 0, '', colors.text, 10, 'left');
      tooltipText.style.opacity = '0';
      tooltipText.setAttribute('class', 'chart-tooltip-text');
      svg.appendChild(tooltipText);

      // Interactive overlay
      const overlay = createRect(margin.left, margin.top, chartW, chartH, 'transparent');
      overlay.style.cursor = 'crosshair';
      
      overlay.addEventListener('mousemove', (e) => {
        const rect = svg.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const xRatio = (x - margin.left) / chartW;
        const dateIdx = Math.round(xRatio * (dates.length - 1));
        
        if (dateIdx >= 0 && dateIdx < dates.length) {
          const date = dates[dateIdx];
          const points = allPoints.filter(p => p.date === date);
          
          if (points.length > 0) {
            const tooltipContent = points.map(p => 
              `${p.exerciseName}: ${p.weight}${state?.units || 'lbs'} x ${p.reps} reps`
            ).join('\n');
            
            tooltipText.textContent = formatDate(date) + '\n' + tooltipContent;
            tooltip.style.opacity = '1';
            tooltipText.style.opacity = '1';
          }
        }
      });

      overlay.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
        tooltipText.style.opacity = '0';
      });

      svg.appendChild(overlay);
    }

    return svg;
  }

  // ========== 2. MUSCLE GROUP HEATMAP ==========
  function renderMuscleHeatmap(options) {
    const {
      data, // { muscleGroup: { sets, tonnage, workouts } }
      width = 400,
      height = 280
    } = options;

    const colors = getThemeColors();
    // Access MUSCLE_GROUPS from global scope if available
    const muscleGroups = typeof MUSCLE_GROUPS !== 'undefined' ? MUSCLE_GROUPS : {};
    const groups = Object.keys(muscleGroups);
    if (groups.length === 0) return createSVG(width, height);

    const margin = { top: 30, right: 20, bottom: 40, left: 80 };
    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    // Calculate intensity based on sets per week
    const maxSets = Math.max(...groups.map(g => data[g]?.sets || 0), 1);
    const idealSets = { 'Chest': 12, 'Back': 16, 'Shoulders': 16, 'Quads': 12, 'Hamstrings': 10, 'Glutes': 10, 'Calves': 8, 'Biceps': 12, 'Triceps': 12 };

    const svg = createSVG(width, height, 'chart-muscle-heatmap');

    // Title
    svg.appendChild(createText(width / 2, 20, 'Weekly Training Frequency (Sets)', colors.text, 12, 'middle', '600'));

    // Draw grid
    const cellHeight = chartH / groups.length;
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const cellWidth = chartW / 7;

    // Headers
    weekDays.forEach((day, i) => {
      svg.appendChild(createText(margin.left + i * cellWidth + cellWidth / 2, margin.top - 8, day, colors.dim, 9, 'middle'));
    });

    // Calculate which muscle groups were trained on which days
    const getDayOfWeek = (dateStr) => new Date(dateStr).getDay();
    // Access getMuscleGroup from global scope if available
    const getMuscleGroupFn = typeof getMuscleGroup === 'function' ? getMuscleGroup : (name) => {
      for (const [group, exercises] of Object.entries(muscleGroups)) {
        if (exercises.includes(name)) return group;
      }
      return 'Other';
    };
    
    groups.forEach((group, i) => {
      const y = margin.top + i * cellHeight;
      const groupData = data[group] || { sets: 0, tonnage: 0 };
      
      // Group label
      svg.appendChild(createText(margin.left - 8, y + cellHeight / 2 + 4, group, colors.text, 10, 'end'));
      
      // Count sets per day for this muscle group
      const setsPerDay = [0, 0, 0, 0, 0, 0, 0];
      // Access history from global scope
      const hist = typeof history !== 'undefined' ? history : [];
      if (hist && hist.length > 0) {
        const cutoff = Date.now() - 7 * 86400000;
        hist.forEach(w => {
          if (new Date(w.date).getTime() > cutoff) {
            const day = getDayOfWeek(w.date);
            w.exercises?.forEach(ex => {
              if (getMuscleGroupFn(ex.name) === group) {
                setsPerDay[day] += (ex.sets || []).filter(s => s.weight && s.reps).length;
              }
            });
          }
        });
      }

      // Draw cells
      for (let d = 0; d < 7; d++) {
        const x = margin.left + d * cellWidth;
        const sets = setsPerDay[d === 0 ? 6 : d - 1]; // Shift so Monday is first
        const intensity = sets / Math.max(idealSets[group] / 4, 3);
        const alpha = Math.min(0.1 + intensity * 0.9, 1);
        
        const color = intensity > 1.2 ? colors.red : 
                     intensity > 0.8 ? colors.green :
                     intensity > 0.3 ? colors.accent : colors.muted;
        
        const cell = createRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2, color);
        cell.setAttribute('fill-opacity', alpha);
        cell.setAttribute('rx', 3);
        
        // Tooltip
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${group} - ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]}: ${sets} sets`;
        cell.appendChild(title);
        
        svg.appendChild(cell);
      }

      // Total sets label
      svg.appendChild(createText(width - 15, y + cellHeight / 2 + 4, String(groupData.sets), colors.text, 11, 'end', '700'));
    });

    // Legend
    const legendY = height - 15;
    const legendItems = [
      { label: 'Low', color: colors.muted, alpha: 0.3 },
      { label: 'Optimal', color: colors.green, alpha: 0.7 },
      { label: 'High', color: colors.red, alpha: 0.8 }
    ];
    
    legendItems.forEach((item, i) => {
      const x = margin.left + i * 70;
      const rect = createRect(x, legendY - 8, 12, 12, item.color);
      rect.setAttribute('fill-opacity', item.alpha);
      rect.setAttribute('rx', 2);
      svg.appendChild(rect);
      svg.appendChild(createText(x + 18, legendY + 1, item.label, colors.dim, 9, 'start'));
    });

    return svg;
  }

  // ========== 3. VOLUME TREND CHART ==========
  function renderVolumeTrendChart(options) {
    const {
      history: historyData,
      width = 400,
      height = 220,
      weeks = 8
    } = options;
    
    // Use provided history or fall back to global
    const history = historyData || (typeof window !== 'undefined' && window.history) || [];

    const colors = getThemeColors();
    
    // Aggregate volume by week and muscle group
    const weeklyData = [];
    const now = new Date();
    
    for (let w = weeks - 1; w >= 0; w--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - w * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);
      
      const weekKey = weekStart.toISOString().split('T')[0];
      const volume = {};
      
      if (history) {
        history.forEach(h => {
          const hDate = new Date(h.date);
          if (hDate >= weekStart && hDate <= weekEnd) {
            h.exercises?.forEach(ex => {
              const group = getMuscleGroup(ex.name);
              if (!volume[group]) volume[group] = 0;
              volume[group] += (ex.sets || []).filter(s => s.weight && s.reps).length;
            });
          }
        });
      }
      
      weeklyData.push({ week: weekKey, volume });
    }

    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    const svg = createSVG(width, height, 'chart-volume-trend');

    // Find max for scaling
    const allVolumes = weeklyData.flatMap(w => Object.values(w.volume));
    const maxVolume = Math.max(...allVolumes, 10);

    // Groups to display
    const displayGroups = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms'];
    const groupColors = {
      'Chest': colors.accent,
      'Back': colors.blue,
      'Legs': colors.green,
      'Shoulders': colors.gold,
      'Arms': colors.purple,
      'Quads': colors.green,
      'Hamstrings': colors.orange,
      'Glutes': colors.purple,
      'Biceps': colors.blue,
      'Triceps': colors.accent,
      'Calves': colors.dim
    };

    // Grid
    const gridCount = 5;
    for (let i = 0; i <= gridCount; i++) {
      const y = margin.top + (i / gridCount) * chartH;
      const vol = Math.round(maxVolume - (i / gridCount) * maxVolume);
      svg.appendChild(createLine(margin.left, y, width - margin.right, y, colors.muted, 0.5));
      svg.appendChild(createText(margin.left - 8, y + 4, vol, colors.dim, 10, 'end'));
    }

    // Bars
    const barWidth = chartW / weeklyData.length * 0.7;
    const barSpacing = chartW / weeklyData.length;

    weeklyData.forEach((week, i) => {
      const x = margin.left + i * barSpacing + (barSpacing - barWidth) / 2;
      
      // Stack bars by muscle group
      let currentY = margin.top + chartH;
      const weekGroups = Object.entries(week.volume).sort((a, b) => b[1] - a[1]);
      
      weekGroups.forEach(([group, vol]) => {
        const barHeight = (vol / maxVolume) * chartH;
        const color = groupColors[group] || colors.accent;
        
        const rect = createRect(x, currentY - barHeight, barWidth, barHeight, color);
        rect.setAttribute('rx', 2);
        
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${group}: ${vol} sets`;
        rect.appendChild(title);
        
        svg.appendChild(rect);
        currentY -= barHeight;
      });

      // X label
      const label = new Date(week.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      svg.appendChild(createText(x + barWidth / 2, height - 20, label, colors.dim, 9, 'middle'));
    });

    return svg;
  }

  // ========== 4. WORKOUT DURATION CHART ==========
  function renderWorkoutDurationChart(options) {
    const {
      history: historyData,
      width = 400,
      height = 180,
      count = 14
    } = options;
    
    // Use provided history or fall back to global
    const history = historyData || (typeof window !== 'undefined' && window.history) || [];

    const colors = getThemeColors();
    const recent = history?.slice(0, count).reverse() || [];
    
    if (recent.length === 0) {
      const empty = createSVG(width, height, 'chart-empty');
      empty.appendChild(createText(width / 2, height / 2, 'No workout data', colors.dim, 14, 'middle'));
      return empty;
    }

    const margin = { top: 20, right: 20, bottom: 50, left: 50 };
    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    const durations = recent.map(h => h.duration || 0);
    const maxDur = Math.max(...durations, 30);
    const avgDur = durations.reduce((a, b) => a + b, 0) / durations.length;

    const svg = createSVG(width, height, 'chart-duration');

    // Average line
    const avgY = margin.top + chartH - (avgDur / maxDur) * chartH;
    svg.appendChild(createLine(margin.left, avgY, width - margin.right, avgY, colors.gold, 1, '4,4'));
    svg.appendChild(createText(width - margin.right, avgY - 4, `avg ${Math.round(avgDur)}m`, colors.gold, 9, 'end'));

    // Grid
    for (let i = 0; i <= 4; i++) {
      const y = margin.top + (i / 4) * chartH;
      const dur = Math.round(maxDur - (i / 4) * maxDur);
      svg.appendChild(createLine(margin.left, y, width - margin.right, y, colors.muted, 0.5));
      svg.appendChild(createText(margin.left - 8, y + 4, dur + 'm', colors.dim, 10, 'end'));
    }

    // Bars
    const barWidth = chartW / recent.length * 0.8;
    const barSpacing = chartW / recent.length;

    recent.forEach((h, i) => {
      const dur = h.duration || 0;
      const barHeight = (dur / maxDur) * chartH;
      const x = margin.left + i * barSpacing + (barSpacing - barWidth) / 2;
      const y = margin.top + chartH - barHeight;

      const color = dur > avgDur * 1.3 ? colors.orange : 
                   dur < avgDur * 0.7 ? colors.blue : colors.green;

      const rect = createRect(x, y, barWidth, barHeight, color);
      rect.setAttribute('rx', 2);
      
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${h.dayLabel}: ${dur} min`;
      rect.appendChild(title);
      
      svg.appendChild(rect);

      // Day label
      const dayLabel = h.dayLabel?.split(' ')[0]?.charAt(0) || '';
      svg.appendChild(createText(x + barWidth / 2, height - 30, dayLabel, colors.dim, 9, 'middle'));
      
      // Date
      const dateLabel = formatShortDate(h.date);
      svg.appendChild(createText(x + barWidth / 2, height - 18, dateLabel, colors.dim, 8, 'middle'));
    });

    return svg;
  }

  // ========== 5. BODY WEIGHT CHART ==========
  function renderBodyWeightChart(options) {
    const {
      bodyWeights,
      targetWeight = null,
      width = 400,
      height = 200
    } = options;
    
    // Get units from state if available
    const units = typeof state !== 'undefined' && state?.units ? state.units : 'lbs';

    const colors = getThemeColors();
    const data = (bodyWeights || []).filter(b => b.weight).slice(-30);
    
    if (data.length === 0) {
      const empty = createSVG(width, height, 'chart-empty');
      empty.appendChild(createText(width / 2, height / 2, 'No weight data', colors.dim, 14, 'middle'));
      return empty;
    }

    const margin = { top: 20, right: 30, bottom: 30, left: 50 };
    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    const weights = data.map(d => d.weight);
    const minWeight = Math.min(...weights) * 0.98;
    const maxWeight = Math.max(...weights, targetWeight || 0) * 1.02;
    const range = maxWeight - minWeight || 1;

    const svg = createSVG(width, height, 'chart-bodyweight');

    // Grid
    for (let i = 0; i <= 4; i++) {
      const y = margin.top + (i / 4) * chartH;
      const w = maxWeight - (i / 4) * range;
      svg.appendChild(createLine(margin.left, y, width - margin.right, y, colors.muted, 0.5));
      svg.appendChild(createText(margin.left - 8, y + 4, w.toFixed(1), colors.dim, 10, 'end'));
    }

    // Target weight line
    if (targetWeight && targetWeight > 0) {
      const targetY = margin.top + chartH - ((targetWeight - minWeight) / range) * chartH;
      svg.appendChild(createLine(margin.left, targetY, width - margin.right, targetY, colors.gold, 2));
      svg.appendChild(createText(width - margin.right, targetY - 4, `goal ${targetWeight}`, colors.gold, 9, 'end'));
    }

    // Moving average
    const ma = calculateMovingAverage(weights, 3);
    
    // Area path
    let areaD = `M${margin.left},${margin.top + chartH}`;
    let lineD = '';
    
    data.forEach((d, i) => {
      const x = margin.left + (i / (data.length - 1 || 1)) * chartW;
      const y = margin.top + chartH - ((d.weight - minWeight) / range) * chartH;
      areaD += ` L${x},${y}`;
      lineD += (i === 0 ? 'M' : 'L') + `${x},${y}`;
    });
    
    areaD += ` L${margin.left + chartW},${margin.top + chartH} Z`;

    // Draw area
    svg.appendChild(createPath(areaD, colors.accent + '20', 'none', 0));
    
    // Draw line
    svg.appendChild(createPath(lineD, 'none', colors.accent, 2));

    // Draw MA line
    let maD = '';
    ma.forEach((val, i) => {
      if (val !== null) {
        const x = margin.left + (i / (data.length - 1 || 1)) * chartW;
        const y = margin.top + chartH - ((val - minWeight) / range) * chartH;
        maD += (maD === '' ? 'M' : 'L') + `${x},${y}`;
      }
    });
    if (maD) svg.appendChild(createPath(maD, 'none', colors.blue, 1, '4,4'));

    // Draw points
    data.forEach((d, i) => {
      const x = margin.left + (i / (data.length - 1 || 1)) * chartW;
      const y = margin.top + chartH - ((d.weight - minWeight) / range) * chartH;
      
      const circle = createCircle(x, y, 3, colors.accent, colors.card, 2);
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${d.date}: ${d.weight} ${units}`;
      circle.appendChild(title);
      svg.appendChild(circle);
    });

    return svg;
  }

  // ========== 6. SLEEP QUALITY CHART ==========
  function renderSleepChart(options) {
    const {
      bodyWeights,
      history: historyData,
      width = 400,
      height = 200
    } = options;
    
    // Use provided history or fall back to global
    const history = historyData || (typeof window !== 'undefined' && window.history) || [];

    const colors = getThemeColors();
    const sleepData = (bodyWeights || []).filter(b => b.sleep).slice(-14);
    
    if (sleepData.length === 0) {
      const empty = createSVG(width, height, 'chart-empty');
      empty.appendChild(createText(width / 2, height / 2, 'No sleep data', colors.dim, 14, 'middle'));
      return empty;
    }

    const margin = { top: 20, right: 30, bottom: 40, left: 40 };
    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    const maxSleep = Math.max(...sleepData.map(d => d.sleep), 10);
    const minSleep = Math.min(...sleepData.map(d => d.sleep), 0);
    const range = maxSleep - minSleep || 10;

    const svg = createSVG(width, height, 'chart-sleep');

    // Recommended sleep zone (7-9 hours)
    const recTop = margin.top + chartH - ((9 - minSleep) / range) * chartH;
    const recBottom = margin.top + chartH - ((7 - minSleep) / range) * chartH;
    const recRect = createRect(margin.left, recTop, chartW, recBottom - recTop, colors.green + '15');
    svg.appendChild(recRect);
    svg.appendChild(createText(width - margin.right, recTop + 10, 'optimal', colors.green, 9, 'end'));

    // Grid
    for (let i = 0; i <= 5; i++) {
      const y = margin.top + (i / 5) * chartH;
      const hrs = maxSleep - (i / 5) * range;
      svg.appendChild(createLine(margin.left, y, width - margin.right, y, colors.muted, 0.5));
      svg.appendChild(createText(margin.left - 8, y + 4, hrs.toFixed(1) + 'h', colors.dim, 10, 'end'));
    }

    // Sleep bars
    const barWidth = chartW / sleepData.length * 0.7;
    const barSpacing = chartW / sleepData.length;

    sleepData.forEach((d, i) => {
      const barHeight = (d.sleep / maxSleep) * chartH;
      const x = margin.left + i * barSpacing + (barSpacing - barWidth) / 2;
      const y = margin.top + chartH - barHeight;

      const color = d.sleep >= 7 && d.sleep <= 9 ? colors.green :
                   d.sleep >= 6 ? colors.gold : colors.accent;

      const rect = createRect(x, y, barWidth, barHeight, color);
      rect.setAttribute('rx', 2);
      
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${d.date}: ${d.sleep}h sleep`;
      rect.appendChild(title);
      
      svg.appendChild(rect);

      // Date label
      const date = new Date(d.date).toLocaleDateString('en-US', { weekday: 'narrow' });
      svg.appendChild(createText(x + barWidth / 2, height - 20, date, colors.dim, 10, 'middle'));
    });

    // Correlation with workout performance
    if (history && history.length > 0) {
      const workoutDates = new Set(history.map(h => h.date));
      let workoutSleepTotal = 0;
      let workoutCount = 0;
      
      sleepData.forEach(d => {
        if (workoutDates.has(d.date)) {
          workoutSleepTotal += d.sleep;
          workoutCount++;
        }
      });
      
      if (workoutCount > 0) {
        const avgWorkoutSleep = (workoutSleepTotal / workoutCount).toFixed(1);
        svg.appendChild(createText(width / 2, 15, `Avg sleep on workout days: ${avgWorkoutSleep}h`, colors.text, 10, 'middle'));
      }
    }

    return svg;
  }

  // ========== 7. STRENGTH STANDARDS RADAR ==========
  function renderStrengthStandardsRadar(options) {
    const {
      history,
      bodyWeights,
      compounds,
      width = 300,
      height = 300
    } = options;

    const colors = getThemeColors();
    const currentBW = bodyWeights?.length ? bodyWeights[bodyWeights.length - 1].weight : 0;
    // Access STRENGTH_STANDARDS from global scope
    const strengthStandards = typeof STRENGTH_STANDARDS !== 'undefined' ? STRENGTH_STANDARDS : {};
    
    if (!currentBW || !compounds?.length) {
      const empty = createSVG(width, height, 'chart-empty');
      empty.appendChild(createText(width / 2, height / 2, 'Log body weight to see standards', colors.dim, 12, 'middle'));
      return empty;
    }

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 50;

    const svg = createSVG(width, height, 'chart-strength-radar');

    // Get PRs and calculate ratios
    const hist = history || [];
    const data = compounds.map(name => {
      let pr = 0;
      for (const w of hist) {
        const ex = w.exercises?.find(e => e.name === name);
        if (ex) {
          for (const s of (ex.sets || [])) {
            const wt = parseFloat(s.weight) || 0;
            if (wt > pr) pr = wt;
          }
        }
      }
      const std = strengthStandards?.[name];
      const ratio = pr / currentBW;
      let level = 0;
      if (std) {
        if (ratio >= std.elite) level = 1;
        else if (ratio >= std.advanced) level = 0.75 + 0.25 * (ratio - std.advanced) / (std.elite - std.advanced);
        else if (ratio >= std.intermediate) level = 0.5 + 0.25 * (ratio - std.intermediate) / (std.advanced - std.intermediate);
        else if (ratio >= std.beginner) level = 0.25 + 0.25 * (ratio - std.beginner) / (std.intermediate - std.beginner);
        else level = 0.25 * ratio / std.beginner;
      }
      return { name, ratio, level: Math.min(1, Math.max(0, level)), pr };
    }).filter(d => d.pr > 0);

    if (data.length === 0) {
      svg.appendChild(createText(cx, cy, 'Log compound lifts to see progress', colors.dim, 12, 'middle'));
      return svg;
    }

    // Background circles
    [0.25, 0.5, 0.75, 1].forEach(pct => {
      svg.appendChild(createCircle(cx, cy, radius * pct, 'none', colors.muted, 0.5));
    });

    // Ideal zone (intermediate = 60%)
    const idealPoints = data.map((_, i) => {
      const angle = (Math.PI * 2 * i / data.length) - Math.PI / 2;
      const r = radius * 0.6;
      return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
    }).join(' ');
    svg.appendChild(createPath(`M${idealPoints}Z`, 'none', colors.gold, 1, '4,4'));

    // Data polygon
    const dataPoints = data.map((d, i) => {
      const angle = (Math.PI * 2 * i / data.length) - Math.PI / 2;
      const r = radius * d.level;
      return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
    }).join(' ');
    
    svg.appendChild(createPath(`M${dataPoints}Z`, colors.accent + '20', colors.accent, 2));

    // Labels and points
    data.forEach((d, i) => {
      const angle = (Math.PI * 2 * i / data.length) - Math.PI / 2;
      const labelR = radius + 25;
      const lx = cx + Math.cos(angle) * labelR;
      const ly = cy + Math.sin(angle) * labelR;
      
      // Short name
      const shortName = d.name.replace(/Barbell |Dumbbell /g, '').split(' ')[0];
      svg.appendChild(createText(lx, ly, shortName, colors.text, 9, 'middle', '600'));
      
      // Ratio
      const ratioY = ly + 10;
      svg.appendChild(createText(lx, ratioY, d.ratio.toFixed(2) + 'x', colors.accent, 8, 'middle'));
      
      // Point
      const pointR = radius * d.level;
      const px = cx + Math.cos(angle) * pointR;
      const py = cy + Math.sin(angle) * pointR;
      svg.appendChild(createCircle(px, py, 4, colors.accent, colors.card, 2));
    });

    return svg;
  }

  // ========== 8. EXERCISE COMPARISON CHART ==========
  function renderExerciseComparisonChart(options) {
    const {
      exercises, // [{ name, currentPR, previousPR, target }]
      width = 400,
      height = 200
    } = options;

    const colors = getThemeColors();
    const margin = { top: 20, right: 30, bottom: 30, left: 120 };
    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    const svg = createSVG(width, height, 'chart-exercise-comparison');

    const maxVal = Math.max(...exercises.map(e => Math.max(e.currentPR, e.target || 0)), 1);

    // Grid
    for (let i = 0; i <= 4; i++) {
      const x = margin.left + (i / 4) * chartW;
      const val = Math.round((i / 4) * maxVal);
      svg.appendChild(createLine(x, margin.top, x, height - margin.bottom, colors.muted, 0.5));
      svg.appendChild(createText(x, height - 15, String(val), colors.dim, 9, 'middle'));
    }

    const barHeight = chartH / exercises.length * 0.6;
    const rowHeight = chartH / exercises.length;

    exercises.forEach((ex, i) => {
      const y = margin.top + i * rowHeight + (rowHeight - barHeight) / 2;
      
      // Exercise name
      const shortName = ex.name.length > 15 ? ex.name.substring(0, 15) + '...' : ex.name;
      svg.appendChild(createText(margin.left - 8, y + barHeight / 2 + 4, shortName, colors.text, 10, 'end'));

      // Previous PR bar (background)
      const prevWidth = (ex.previousPR / maxVal) * chartW;
      svg.appendChild(createRect(margin.left, y, prevWidth, barHeight, colors.muted + '40', 3));

      // Current PR bar
      const currWidth = (ex.currentPR / maxVal) * chartW;
      const color = ex.currentPR > ex.previousPR ? colors.green : colors.accent;
      const bar = createRect(margin.left, y, currWidth, barHeight, color, 3);
      
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      const change = ex.currentPR - ex.previousPR;
      const changeStr = change > 0 ? `+${change.toFixed(1)}` : change.toFixed(1);
      title.textContent = `${ex.name}: ${ex.currentPR} (${changeStr} from last month)`;
      bar.appendChild(title);
      svg.appendChild(bar);

      // Target marker
      if (ex.target && ex.target > 0) {
        const targetX = margin.left + (ex.target / maxVal) * chartW;
        svg.appendChild(createLine(targetX, y - 2, targetX, y + barHeight + 2, colors.gold, 2));
      }

      // Value label
      svg.appendChild(createText(margin.left + currWidth + 5, y + barHeight / 2 + 4, String(ex.currentPR), color, 10, 'start', '700'));
    });

    return svg;
  }

  // ========== EXPORT FUNCTIONS ==========
  function exportChart(svgElement, filename) {
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.svg';
    a.click();
    
    URL.revokeObjectURL(url);
  }

  function exportChartAsPNG(svgElement, filename, scale = 2) {
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    const rect = svgElement.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      ctx.fillStyle = getThemeColors().bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename + '.png';
        a.click();
        URL.revokeObjectURL(url);
      });
    };
    
    img.src = url;
  }

  // ========== PUBLIC API ==========
  return {
    // Chart renderers
    liftProgress: renderLiftProgressChart,
    muscleHeatmap: renderMuscleHeatmap,
    volumeTrend: renderVolumeTrendChart,
    workoutDuration: renderWorkoutDurationChart,
    bodyWeight: renderBodyWeightChart,
    sleepQuality: renderSleepChart,
    strengthStandards: renderStrengthStandardsRadar,
    exerciseComparison: renderExerciseComparisonChart,
    
    // Utilities
    getThemeColors,
    calculateMovingAverage,
    calculateTrendLine,
    formatDate,
    
    // Export
    export: exportChart,
    exportPNG: exportChartAsPNG
  };
})();

// Make available globally
window.Charts = Charts;
