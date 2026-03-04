// ============================================
// CHARTS — Chart and visualization components
// ============================================

/**
 * Render a radar chart for muscle balance
 * @param {Object} vol - Volume data by muscle group
 * @returns {SVGSVGElement} SVG radar chart
 */
function renderRadarChart(vol) {
  const groups = Object.keys(MUSCLE_GROUPS);
  const maxV = Math.max(...groups.map(g => vol[g]?.sets || 0), 1);
  const cx = 150, cy = 150, r = 90;
  const points = groups.map((g, i) => {
    const angle = (Math.PI * 2 * i / groups.length) - Math.PI / 2;
    const val = (vol[g]?.sets || 0) / maxV;
    return { x: cx + Math.cos(angle) * r * val, y: cy + Math.sin(angle) * r * val };
  });
  const idealPoints = groups.map((_, i) => {
    const angle = (Math.PI * 2 * i / groups.length) - Math.PI / 2;
    return `${cx + Math.cos(angle) * r * 0.6},${cy + Math.sin(angle) * r * 0.6}`;
  });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 300 300');
  svg.setAttribute('class', 'radar-chart');
  svg.innerHTML = `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--card-border)" stroke-width="1"/>
    <polygon points="${idealPoints.join(' ')}" fill="none" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4,4"/>
    <polygon points="${points.map(p => `${p.x},${p.y}`).join(' ')}" fill="rgba(233,69,96,.15)" stroke="var(--accent)" stroke-width="2"/>
    ${groups.map((g, i) => {
      const angle = (Math.PI * 2 * i / groups.length) - Math.PI / 2;
      const lx = cx + Math.cos(angle) * (r + 28);
      const ly = cy + Math.sin(angle) * (r + 28);
      const sets = vol[g]?.sets || 0;
      return `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="central" fill="var(--dim)" font-size="9" font-weight="600" font-family="var(--font)">${g}</text>
        <text x="${lx}" y="${ly + 11}" text-anchor="middle" fill="var(--accent)" font-size="8" font-weight="700" font-family="var(--mono)">${sets}</text>`;
    }).join('')}
    ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="var(--accent)"/>`).join('')}
  `;
  return svg;
}

/**
 * Render a bar chart for lift progression
 * @param {Array<{date: string, weight: number}>} data - Chart data
 * @param {number} pr - Personal record value
 * @returns {HTMLElement} Bar chart element
 */
function renderBarChart(data, pr) {
  if (!data.length) {
    return el('div', { css: 'font-size:12px;color:var(--dim);text-align:center;padding:10px 0' }, 'No data yet');
  }
  const mx = Math.max(...data.map(d => d.weight), 1);
  return el('div', { cls: 'bar-chart' }, ...data.map(d => {
    const isPR = d.weight === pr && d.weight > 0;
    return el('div', { cls: 'bar-col' },
      el('div', { cls: `bar-val ${isPR ? 'pr' : ''}` }, d.weight || ''),
      el('div', { cls: `bar ${isPR ? 'pr' : ''}`, css: `height:${(d.weight / mx) * 65}px` }),
      el('div', { cls: 'bar-date' }, d.date.split(', ')[0]?.split(' ').slice(1).join(' '))
    );
  }));
}

/**
 * Render a duration trend chart
 * @param {Array} durations - Array of duration values
 * @returns {HTMLElement} Duration chart element
 */
function renderDurationChart(durations) {
  const maxDur = Math.max(...durations.map(d => d.duration || 0), 1);
  return el('div', { cls: 'dur-chart' },
    ...durations.map(h => el('div', { 
      cls: 'dur-bar',
      css: `height:${((h.duration || 0) / maxDur) * 45}px`,
      title: `${fmtDate(h.date)}: ${h.duration || 0}min` 
    }))
  );
}

/**
 * Render a heatmap grid
 * @param {number} weeks - Number of weeks to show
 * @returns {HTMLElement} Heatmap element
 */
function renderHeatmap(weeks = 12) {
  const history = Store.history || [];
  const workoutDates = {};
  for (const h of history) {
    const d = new Date(h.date).toISOString().split('T')[0];
    workoutDates[d] = (workoutDates[d] || 0) + 1;
  }
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - weeks * 7 - startDate.getDay());
  
  const heatCells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    const count = workoutDates[ds] || 0;
    const lvl = count >= 2 ? 'l3' : count === 1 ? 'l2' : '';
    heatCells.push(el('div', { 
      cls: `heatmap-cell ${lvl} ${ds === todayStr ? 'today' : ''}`, 
      css: d > today ? 'opacity:.3' : '', 
      title: ds 
    }));
  }
  
  return el('div', { css: 'display:flex' },
    el('div', { cls: 'heatmap-labels' }, ...['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => el('span', null, d))),
    el('div', { cls: 'heatmap-grid' }, ...heatCells)
  );
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderRadarChart, renderBarChart, renderDurationChart, renderHeatmap };
}
