// ============================================
// BACKUP MODULE — Automatic & Manual Data Backup
// ============================================

/**
 * Backup Manager — Handles local, cloud, and scheduled backups
 * Integrates with Storage module for data persistence
 */
const Backup = (() => {
  // Configuration
  const CONFIG = {
    MAX_LOCAL_BACKUPS: 30,      // Keep last 30 days
    MAX_CLOUD_BACKUPS: 10,      // Keep last 10 cloud backups per provider
    BACKUP_KEY_PREFIX: 'ht-backup-',
    METADATA_KEY: 'ht-backup-metadata',
    SCHEDULE_KEY: 'ht-backup-schedule',
    AUTO_BACKUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
  };

  // Google API configuration
  const GOOGLE_CONFIG = {
    DISCOVERY_DOC: 'https://sheets.googleapis.com/$discovery/rest?version=v4',
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.body.read https://www.googleapis.com/auth/drive.file',
    SCRIPT_ID: null, // Set via init if using Apps Script
  };

  // Provider configurations
  const PROVIDERS = {
    firebase: { name: 'Firebase', icon: '🔥', enabled: true },
    googledrive: { name: 'Google Drive', icon: '📁', enabled: false },
    dropbox: { name: 'Dropbox', icon: '📦', enabled: false },
  };

  // State
  let googleToken = null;
  let backupIntervalId = null;

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  function getUserHash() {
    return Storage.getHash() || 'default';
  }

  function lsKey(key) {
    return `${CONFIG.BACKUP_KEY_PREFIX}${getUserHash()}-${key}`;
  }

  function getMetadata() {
    try {
      const data = localStorage.getItem(lsKey(CONFIG.METADATA_KEY));
      return data ? JSON.parse(data) : { backups: [], lastAutoBackup: null, cloudBackups: {} };
    } catch (e) {
      return { backups: [], lastAutoBackup: null, cloudBackups: {} };
    }
  }

  function saveMetadata(meta) {
    try {
      localStorage.setItem(lsKey(CONFIG.METADATA_KEY), JSON.stringify(meta));
    } catch (e) {
      console.warn('Failed to save backup metadata:', e);
    }
  }

  function generateBackupId() {
    return `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  function formatBackupDate(date) {
    const d = new Date(date);
    return d.toLocaleString('en-US', { 
      month: 'short', day: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
  }

  function getBackupSize(data) {
    const str = JSON.stringify(data);
    return str.length;
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  // ============================================
  // DATA COLLECTION
  // ============================================

  async function collectAllData(type = 'full') {
    const data = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      type,
      userHash: getUserHash(),
    };

    if (type === 'full' || type === 'workouts-only') {
      data.history = await Storage.get('history', []);
    }

    if (type === 'full') {
      data.state = await Storage.get('state', {});
      data.bodyWeights = await Storage.get('bodyWeights', []);
      data.measurements = await Storage.get('measurements', []);
    }

    // Stats for verification
    data.stats = {
      workoutCount: data.history?.length || 0,
      bodyWeightEntries: data.bodyWeights?.length || 0,
      measurementEntries: data.measurements?.length || 0,
      earliestWorkout: data.history?.length > 0 
        ? data.history[data.history.length - 1]?.date 
        : null,
      latestWorkout: data.history?.length > 0 
        ? data.history[0]?.date 
        : null,
    };

    return data;
  }

  function filterByDateRange(data, startDate, endDate) {
    const filtered = { ...data };
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (data.history) {
      filtered.history = data.history.filter(w => {
        const d = new Date(w.date);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }

    if (data.bodyWeights) {
      filtered.bodyWeights = data.bodyWeights.filter(bw => {
        const d = new Date(bw.date);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }

    if (data.measurements) {
      filtered.measurements = data.measurements.filter(m => {
        const d = new Date(m.date);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }

    return filtered;
  }

  // ============================================
  // LOCAL BACKUP
  // ============================================

  async function createLocalBackup(type = 'full') {
    const data = await collectAllData(type);
    const backupId = generateBackupId();
    const backup = {
      id: backupId,
      timestamp: Date.now(),
      type,
      size: getBackupSize(data),
      data,
    };

    // Save backup data
    try {
      localStorage.setItem(lsKey(backupId), JSON.stringify(backup));
    } catch (e) {
      // If quota exceeded, try removing old backups
      if (e.name === 'QuotaExceededError') {
        cleanupOldBackups(5); // Keep only 5 oldest
        try {
          localStorage.setItem(lsKey(backupId), JSON.stringify(backup));
        } catch (e2) {
          throw new Error('Storage quota exceeded. Please export and clear old data.');
        }
      } else {
        throw e;
      }
    }

    // Update metadata
    const meta = getMetadata();
    meta.backups.unshift({
      id: backupId,
      timestamp: backup.timestamp,
      type: backup.type,
      size: backup.size,
    });

    // Keep only max backups
    while (meta.backups.length > CONFIG.MAX_LOCAL_BACKUPS) {
      const old = meta.backups.pop();
      try {
        localStorage.removeItem(lsKey(old.id));
      } catch (e) {}
    }

    saveMetadata(meta);
    return backup;
  }

  function getLocalBackup(backupId) {
    try {
      const data = localStorage.getItem(lsKey(backupId));
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  function deleteLocalBackup(backupId) {
    try {
      localStorage.removeItem(lsKey(backupId));
      const meta = getMetadata();
      meta.backups = meta.backups.filter(b => b.id !== backupId);
      saveMetadata(meta);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ============================================
  // IMPORT & VALIDATION
  // ============================================

  function validateImportData(data) {
    const errors = [];

    if (!data) {
      errors.push('No data provided');
      return { valid: false, errors };
    }

    // Check version
    if (!data.version) {
      errors.push('Unknown data format (no version)');
    }

    // Validate structure
    if (data.history && !Array.isArray(data.history)) {
      errors.push('Invalid history format');
    }

    if (data.state && typeof data.state !== 'object') {
      errors.push('Invalid state format');
    }

    // Validate workouts
    if (data.history) {
      data.history.forEach((w, i) => {
        if (!w.date) errors.push(`Workout ${i + 1}: Missing date`);
        if (!w.dayLabel) errors.push(`Workout ${i + 1}: Missing day label`);
        if (!Array.isArray(w.exercises)) errors.push(`Workout ${i + 1}: Invalid exercises`);
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  function detectDuplicates(importData, existingHistory) {
    const duplicates = [];
    const existingKeys = new Set();

    // Build set of existing workout keys
    existingHistory.forEach(w => {
      existingKeys.add(`${w.date}-${w.dayLabel}`);
    });

    // Check imports
    (importData.history || []).forEach((w, index) => {
      const key = `${w.date}-${w.dayLabel}`;
      if (existingKeys.has(key)) {
        duplicates.push({
          index,
          workout: w,
          key,
          reason: 'Same date and day',
        });
      }
    });

    return duplicates;
  }

  async function importData(data, options = {}) {
    const { 
      mode = 'merge', // 'merge', 'replace', 'skip-duplicates'
      onProgress = null,
    } = options;

    // Validate
    const validation = validateImportData(data);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const currentHistory = Store.history || [];
    const duplicates = detectDuplicates(data, currentHistory);

    // Handle based on mode
    if (mode === 'replace') {
      // Replace all data
      if (data.state) await Store.setState(data.state);
      if (data.history) await Store.setHistory(data.history);
      if (data.bodyWeights) await Store.setBodyWeights(data.bodyWeights);
      if (data.measurements) await Store.setMeasurements(data.measurements);
      return { imported: data.history?.length || 0, duplicates: 0, skipped: 0 };
    }

    // Merge mode
    let newWorkouts = [...currentHistory];
    let imported = 0;
    let skipped = 0;

    for (const workout of (data.history || [])) {
      const isDuplicate = duplicates.some(d => 
        d.workout.date === workout.date && d.workout.dayLabel === workout.dayLabel
      );

      if (isDuplicate) {
        if (mode === 'skip-duplicates') {
          skipped++;
          continue;
        }
        // In merge mode, we could update existing - for now skip
        skipped++;
        continue;
      }

      newWorkouts.push(workout);
      imported++;

      if (onProgress) {
        onProgress({ imported, total: data.history.length });
      }
    }

    // Sort by date descending
    newWorkouts.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Limit to 200
    if (newWorkouts.length > 200) {
      newWorkouts = newWorkouts.slice(0, 200);
    }

    await Store.setHistory(newWorkouts);

    // Merge other data
    if (data.bodyWeights) {
      const merged = [...Store.bodyWeights || []];
      for (const bw of data.bodyWeights) {
        if (!merged.some(m => m.date === bw.date)) {
          merged.push(bw);
        }
      }
      merged.sort((a, b) => new Date(b.date) - new Date(a.date));
      await Store.setBodyWeights(merged);
    }

    return { imported, duplicates: duplicates.length, skipped };
  }

  // ============================================
  // EXPORT FORMATS
  // ============================================

  async function exportJSON(options = {}) {
    const { 
      pretty = true, 
      dateRange = null,
      includeAll = true,
    } = options;

    let data = await collectAllData(includeAll ? 'full' : 'workouts-only');

    if (dateRange) {
      data = filterByDateRange(data, dateRange.start, dateRange.end);
    }

    const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().split('T')[0];
    a.download = `hypertrophy-backup-${date}.json`;
    a.click();
    
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { size: json.length, filename: a.download };
  }

  function generateCSV(data) {
    let csv = 'Date,Day,Week,Phase,RIR Target,Duration,Exercise,Set,Weight,Reps,RIR,Note\n';
    
    for (const w of (data.history || [])) {
      for (const ex of (w.exercises || [])) {
        for (let i = 0; i < (ex.sets || []).length; i++) {
          const s = ex.sets[i];
          const note = (ex.note || '').replace(/"/g, '""');
          csv += `"${w.date}","${w.dayLabel}","${w.weekLabel}","${w.phase}","${w.rirTarget}","${w.duration || ''}","${ex.name}","${i + 1}","${s.weight}","${s.reps}","${s.rir}","${note}"\n`;
        }
      }
    }
    
    return csv;
  }

  async function exportCSV(options = {}) {
    const { dateRange = null } = options;
    
    let data = await collectAllData('full');
    if (dateRange) {
      data = filterByDateRange(data, dateRange.start, dateRange.end);
    }

    const csv = generateCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().split('T')[0];
    a.download = `hypertrophy-log-${date}.csv`;
    a.click();
    
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { size: csv.length, filename: a.download };
  }

  async function generatePDF(options = {}) {
    const { month, year, includeCharts = true } = options;
    
    // Generate HTML for PDF
    let data = await collectAllData('full');
    
    // Filter by month/year if specified
    if (month !== undefined && year !== undefined) {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      data = filterByDateRange(data, start, end);
    }

    // Create PDF HTML content
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Hypertrophy Tracker Report</title>
  <style>
    body { font-family: 'DM Sans', Arial, sans-serif; margin: 20px; color: #333; }
    h1 { color: #E94560; border-bottom: 2px solid #E94560; padding-bottom: 10px; }
    h2 { color: #666; margin-top: 30px; }
    .summary { background: #f5f5f7; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
    .stat { text-align: center; }
    .stat-value { font-size: 28px; font-weight: bold; color: #E94560; }
    .stat-label { font-size: 12px; color: #666; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #E94560; color: white; padding: 10px; text-align: left; }
    td { padding: 8px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) { background: #f9f9f9; }
    .workout-date { font-weight: bold; }
    .exercise-name { color: #666; }
    .sets { font-family: monospace; }
  </style>
</head>
<body>
  <h1>🏋️ Hypertrophy Tracker Report</h1>
  <p>Generated: ${new Date().toLocaleDateString()}</p>
  
  <div class="summary">
    <h2>Summary</h2>
    <div class="summary-grid">
      <div class="stat">
        <div class="stat-value">${data.stats.workoutCount}</div>
        <div class="stat-label">Workouts</div>
      </div>
      <div class="stat">
        <div class="stat-value">${data.bodyWeights?.length || 0}</div>
        <div class="stat-label">Weight Entries</div>
      </div>
      <div class="stat">
        <div class="stat-value">${data.measurements?.length || 0}</div>
        <div class="stat-label">Measurements</div>
      </div>
    </div>
  </div>

  <h2>Workout History</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Day</th>
        <th>Duration</th>
        <th>Exercises</th>
      </tr>
    </thead>
    <tbody>
      ${(data.history || []).slice(0, 50).map(w => `
        <tr>
          <td class="workout-date">${new Date(w.date).toLocaleDateString()}</td>
          <td>${w.dayLabel}</td>
          <td>${w.duration || '-'} min</td>
          <td>${w.exercises?.length || 0}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ${data.history?.length > 50 ? `<p><em>... and ${data.history.length - 50} more workouts</em></p>` : ''}
</body>
</html>`;

    // Open in new window for printing/saving as PDF
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    
    // Auto-trigger print dialog
    setTimeout(() => {
      printWindow.print();
    }, 500);

    return { success: true, workoutCount: data.history?.length || 0 };
  }

  // ============================================
  // GOOGLE INTEGRATION (OAuth2)
  // ============================================

  async function initGoogleAuth(clientId) {
    if (typeof google === 'undefined') {
      throw new Error('Google API not loaded');
    }

    GOOGLE_CONFIG.CLIENT_ID = clientId;

    return new Promise((resolve, reject) => {
      google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_CONFIG.SCOPES,
        callback: (tokenResponse) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error));
          } else {
            googleToken = tokenResponse.access_token;
            resolve(googleToken);
          }
        },
      }).requestAccessToken();
    });
  }

  async function exportToGoogleSheets(options = {}) {
    if (!googleToken) {
      throw new Error('Not authenticated with Google');
    }

    const data = await collectAllData('full');
    const csv = generateCSV(data);
    const rows = csv.split('\n').map(line => line.split(','));

    // This would use the Google Sheets API to create/update a spreadsheet
    // For now, we'll create a downloadable CSV that can be imported to Sheets
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `hypertrophy-for-sheets-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    
    return { 
      success: true, 
      message: 'CSV downloaded. Open Google Sheets and use File > Import to upload.',
      rows: rows.length - 1 
    };
  }

  // ============================================
  // CLOUD BACKUP
  // ============================================

  async function exportToFirebase(data = null) {
    if (!data) {
      data = await collectAllData('full');
    }

    const backupId = generateBackupId();
    const backupData = {
      id: backupId,
      timestamp: Date.now(),
      data,
      userHash: getUserHash(),
    };

    // Store in Firebase under user's backup path
    const path = `users/${Storage.getUid() || getUserHash()}/backups/${backupId}`;
    await Storage.setRaw?.(path, backupData) || 
      firebase?.database()?.ref(path)?.set(backupData);

    return { success: true, backupId };
  }

  // ============================================
  // SCHEDULED BACKUPS
  // ============================================

  function scheduleBackups(frequency = 'daily') {
    // Clear existing
    if (backupIntervalId) {
      clearInterval(backupIntervalId);
      backupIntervalId = null;
    }

    // Save schedule preference
    try {
      localStorage.setItem(lsKey(CONFIG.SCHEDULE_KEY), JSON.stringify({
        frequency,
        enabled: true,
        lastCheck: Date.now(),
      }));
    } catch (e) {}

    if (frequency === 'off') {
      return { enabled: false };
    }

    const intervals = {
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
    };

    const interval = intervals[frequency] || intervals.daily;

    // Check and backup on schedule
    backupIntervalId = setInterval(async () => {
      const meta = getMetadata();
      const lastBackup = meta.lastAutoBackup;
      const now = Date.now();

      if (!lastBackup || (now - lastBackup) >= interval) {
        try {
          await createLocalBackup('full');
          meta.lastAutoBackup = now;
          saveMetadata(meta);
          console.log('[Backup] Auto-backup completed');
        } catch (e) {
          console.warn('[Backup] Auto-backup failed:', e);
        }
      }
    }, 60 * 60 * 1000); // Check every hour

    return { enabled: true, frequency, interval };
  }

  function init() {
    // Check for scheduled backup on init
    try {
      const schedule = JSON.parse(localStorage.getItem(lsKey(CONFIG.SCHEDULE_KEY)));
      if (schedule?.enabled && schedule.frequency !== 'off') {
        scheduleBackups(schedule.frequency);
      }
    } catch (e) {}

    return { initialized: true };
  }

  // ============================================
  // PUBLIC API
  // ============================================

  return {
    // Initialization
    init,

    // Backup operations
    async createBackup(type = 'full') {
      return await createLocalBackup(type);
    },

    listBackups() {
      const meta = getMetadata();
      return meta.backups.map(b => ({
        ...b,
        formattedDate: formatBackupDate(b.timestamp),
        formattedSize: formatSize(b.size),
      }));
    },

    getBackup(backupId) {
      return getLocalBackup(backupId);
    },

    async restoreFromBackup(backupId) {
      const backup = getLocalBackup(backupId);
      if (!backup) {
        throw new Error('Backup not found');
      }

      return await importData(backup.data, { mode: 'replace' });
    },

    deleteBackup(backupId) {
      return deleteLocalBackup(backupId);
    },

    cleanupOldBackups(keepCount = 10) {
      const meta = getMetadata();
      while (meta.backups.length > keepCount) {
        const old = meta.backups.pop();
        try {
          localStorage.removeItem(lsKey(old.id));
        } catch (e) {}
      }
      saveMetadata(meta);
      return { cleaned: meta.backups.length };
    },

    // Scheduling
    scheduleBackups,

    // Import/Export
    async exportData(format = 'json', options = {}) {
      switch (format) {
        case 'json':
          return await exportJSON(options);
        case 'csv':
          return await exportCSV(options);
        case 'pdf':
          return await generatePDF(options);
        default:
          throw new Error(`Unknown format: ${format}`);
      }
    },

    async importData(data, options = {}) {
      return await importData(data, options);
    },

    validateImportData,
    detectDuplicates,

    // Cloud providers
    async initGoogleAuth(clientId) {
      return await initGoogleAuth(clientId);
    },

    async exportToGoogleSheets(options) {
      return await exportToGoogleSheets(options);
    },

    async exportToCloud(provider) {
      switch (provider) {
        case 'firebase':
          return await exportToFirebase();
        case 'googledrive':
          throw new Error('Google Drive export requires OAuth setup');
        case 'dropbox':
          throw new Error('Dropbox export not yet implemented');
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
    },

    // Utilities
    getConfig: () => ({ ...CONFIG }),
    getProviders: () => ({ ...PROVIDERS }),
    
    async getStats() {
      const data = await collectAllData('full');
      return {
        ...data.stats,
        totalSize: formatSize(getBackupSize(data)),
      };
    },
  };
})();

// Make Backup globally available
window.Backup = Backup;
