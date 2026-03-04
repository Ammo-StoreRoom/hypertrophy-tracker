# Hypertrophy Tracker - Agent Guide

## Project Overview

Hypertrophy Tracker is a **Progressive Web App (PWA)** for tracking 6-day Push/Pull/Legs (PPL) hypertrophy training programs with cloud sync across devices. It uses a **vanilla JavaScript** architecture with **Firebase** for backend services.

### Key Characteristics
- **No build process** - static files served directly (HTML/CSS/JS)
- **Offline-first** with localStorage fallback
- **PIN-based authentication** (user's birthday as MMDDYYYY)
- **Real-time sync** via Firebase Realtime Database
- **PWA features** - installable, service worker caching, push notifications

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla JavaScript (ES6+), no frameworks |
| Styling | CSS3 with CSS variables for theming |
| Backend | Firebase (Authentication + Realtime Database) |
| Storage | localStorage (offline) + Firebase (cloud sync) |
| Icons/Assets | SVG |

### External Dependencies
- Firebase SDK v9.23.0 (loaded via CDN):
  - `firebase-app-compat.js`
  - `firebase-database-compat.js`
  - `firebase-auth-compat.js`
- Google Fonts: DM Sans, JetBrains Mono

---

## Project Structure

```
/
├── index.html          # Single-page app entry point
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker for caching/offline
├── firebase.json       # Firebase CLI config (deployment)
├── database.rules.json # Firebase Realtime DB security rules
├── css/
│   └── styles.css      # All styles, responsive breakpoints
├── js/
│   ├── app.js                  # Main entry point (~300 lines) - init and router
│   ├── router.js               # Simple hash-based router and DOM helper
│   ├── state.js                # Centralized state management with Store object
│   ├── storage.js              # Firebase + localStorage abstraction
│   ├── error-handler.js        # Global error boundary & reporting
│   ├── shortcuts.js            # Keyboard shortcuts & voice input
│   ├── program-data.js         # Exercise definitions & programs
│   ├── templates.js            # Workout templates & custom programs
│   ├── firebase-config.js      # Firebase credentials
│   ├── screens/                # Screen renderers
│   │   ├── login.js            # Authentication screen
│   │   ├── home.js             # Dashboard with next workout, stats
│   │   ├── workout.js          # Active workout logging
│   │   ├── history.js          # Past workouts list
│   │   ├── progress.js         # Lift charts, volume analysis
│   │   ├── templates.js        # Template gallery & builder
│   │   ├── health.js           # Body weight, sleep, measurements
│   │   ├── settings.js         # Theme, units, program selection
│   │   └── admin.js            # User management portal
│   ├── components/             # Reusable UI components
│   │   ├── charts.js           # Radar, bar, duration charts
│   │   ├── modals.js           # Modal dialogs and overlays
│   │   └── inputs.js           # Set inputs, rest presets
│   ├── utils/                  # Utility functions
│   │   ├── formatters.js       # Date, time, weight formatting
│   │   ├── calculations.js     # 1RM, volume, fatigue, plates
│   │   └── coach.js            # AI coaching logic
│   └── test/                   # Unit testing framework
│       ├── test-framework.js   # Core testing framework
│       ├── calculations.test.js
│       ├── formatters.test.js
│       ├── coach.test.js
│       ├── state.test.js
│       └── validation.test.js
├── test/
│   ├── index.html        # Test runner page
│   └── visual.html       # Visual regression test page
└── img/
    └── icon.svg        # App icon
```

---

## Code Organization

### Main Modules (`js/`)

#### 1. `firebase-config.js`
Contains Firebase project credentials. Replace with your own when setting up:
```javascript
const FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
};
```

#### 2. `program-data.js` (~350 lines)
Defines all exercise programs:
- `RAMPUP`, `RAMPUP_GF` - 2-week ramp-up phases (standard & glute-focus)
- `PPL`, `PPL_GF` - 6-day Push/Pull/Legs splits
- `COMPOUNDS`, `COMPOUNDS_GF` - Main compound lifts per program
- `PROGRAMS` - Registry routing by `state.program`
- `MUSCLE_GROUPS` - Exercise categorization
- `EXERCISE_DEMOS` - Links to exrx.net exercise demonstrations
- `STRENGTH_STANDARDS` - Bodyweight ratio benchmarks (beginner to elite)

#### 3. `templates.js` (~600 lines)
Workout templates & custom program builder:
- **Built-in templates**: 5+ ready-to-use programs (Strength, Hypertrophy, Endurance, Minimalist, Bro-Split, Upper/Lower)
- **User templates**: Create, edit, duplicate custom templates
- **Template types**: Single workout templates or multi-day programs
- **Import/Export**: JSON format for sharing templates
- **Apply flow**: Preview before overwriting current program

**Template Structure:**
```javascript
{
  id: "unique-id",
  name: "Template Name",
  description: "...",
  type: "template" | "program",
  source: "builtin" | "custom" | "imported",
  tags: ["strength", "hypertrophy"],
  days: [{
    dayLabel: "Day 1",
    exercises: [{
      name: "Exercise Name",
      sets: 3,
      reps: "8-10",
      rest: 90,
      notes: "..."
    }]
  }]
}
```

**Key Methods:**
- `Templates.getAll()` - Get all templates (built-in + user)
- `Templates.save(template)` - Create or update template
- `Templates.delete(id)` - Remove user template
- `Templates.duplicate(id)` - Clone existing template
- `Templates.applyToProgram(id)` - Activate template as current program
- `Templates.importFromJSON(json)` - Import templates from file
- `Templates.exportAll()` - Export all user templates

#### 3. `storage.js` (~600 lines)
Storage abstraction layer with Firebase + localStorage fallback:
- `Storage.login(pin)` - Authenticates with PIN-derived credentials
- `Storage.autoLogin()` - Restore session from localStorage
- `Storage.get(key, fallback)` - Reads from Firebase (with timeout) or localStorage
- `Storage.set(key, value)` - Writes to both Firebase and localStorage
- `Storage.listen(key, callback)` - Real-time sync listener
- `Storage.registerSelf(info)` - Register user metadata
- Admin functions: `adminGetRegistry()`, `adminSetUserData()`, `adminResetUser()`

**PIN Security Features:**
- `Storage.hashPinSecure(pin)` - Secure hash using SubtleCrypto SHA-256 (with legacy fallback)
- `Storage.checkPinStrength(pin)` - Detect weak PINs (sequential, repeated digits, common patterns)
- `Storage.checkRateLimit()` - Rate limiting for login attempts (max 5 attempts, 1min lockout)
- `Storage.clearPinFromMemory()` - Clear PIN from memory after auth

**PIN to Auth Mapping:**
- Normal users: PIN → email `pin-{PIN}@hypertrophy.local` + password `HTPINv1-{PIN}`
- Admin PIN (`01131998`): Uses real email/password (ayman98a@gmail.com)

#### 4. `error-handler.js` (~500 lines)
Global error boundary and reporting system:
- `ErrorHandler.init()` - Sets up global error handlers
- `ErrorHandler.handleError()` - Handle runtime errors with user-friendly messages
- `ErrorHandler.showError()` - Show error modal with recovery suggestions
- `ErrorHandler.showSuccess()` - Show success toast
- `ErrorHandler.wrapAsync()` - Wrap async functions with error handling
- `ErrorHandler.getErrorLog()` - Retrieve stored errors for debugging

**Error Classification:**
- Network errors (timeout, offline, Firebase issues)
- Storage errors (localStorage quota exceeded)
- Firebase auth errors
- Syntax/runtime errors with recovery suggestions

#### 4. `app.js` (~300 lines)
Main application entry point:
- `init()` - Initialize app, setup PWA, load data
- `doLogin()` - Handle PIN authentication
- `loadData()` - Load state from storage
- `startWorkout()` - Begin workout session
- `finishWorkout()` - Save workout and advance program
- `startRest()` / `stopRest()` - Rest timer control

#### 5. `router.js` (~200 lines)
Simple hash-based router:
- `Router.register(name, renderer)` - Register screen renderers
- `Router.navigate(screenName)` - Navigate between screens
- `Router.render()` - Render current screen
- `el()` - DOM element creation helper
- `renderNav()` - Navigation bar component

#### 6. `state.js` (~400 lines)
Centralized state management via global `Store` object:

**Persistent State (synced with Firebase):**
```javascript
Store.state       // App state (phase, week, program, etc.)
Store.history     // Workout history array
Store.bodyWeights // Body weight entries
Store.measurements // Body measurements
```

**UI State (transient):**
```javascript
Store.screen            // Current screen name
Store.activeDay         // Current workout day
Store.inputs            // Workout set inputs
Store.restTimer         // Active rest timer
Store.modal             // Current modal config
Store.workoutExercises  // Current workout exercises
```

**Key Methods:**
- `Store.init()` - Initialize from storage
- `Store.setState(newState)` - Update and persist state
- `Store.getProgram()` - Get current program data
- `Store.getExercises(day)` - Get exercises for a day
- `Store.getPR(name)` - Get PR for an exercise
- `Store.isAdmin()` - Check if current user is admin

#### 7. Screen Modules (`js/screens/`)
Each screen exports a `renderXxx()` function:

| Screen | File | Function | Description |
|--------|------|----------|-------------|
| `login` | `login.js` | `renderLogin()` | PIN entry screen |
| `home` | `home.js` | `renderHome()` | Dashboard with stats, heatmap |
| `workout` | `workout.js` | `renderWorkout()` | Active workout logging |
| `history` | `history.js` | `renderHistory()` | Past workouts list |
| `progress` | `progress.js` | `renderProgress()` | Charts, volume, standards |
| `templates` | `templates.js` | `renderTemplates()` | Template gallery & builder |
| `health` | `health.js` | `renderHealth()` | Weight, sleep, measurements |
| `settings` | `settings.js` | `renderSettings()` | Preferences, data import/export |
| `admin` | `admin.js` | `renderAdmin()` | User management portal |

#### 8. Component Modules (`js/components/`)
Reusable UI components:

- `charts.js`: `renderRadarChart()`, `renderBarChart()`, `renderHeatmap()`
- `modals.js`: `renderModal()`, `showConfirm()`, `showExerciseHistory()`
- `inputs.js`: `renderSetInputs()`, `renderRestPresets()`, `renderPlateCalc()`

#### 9. Utility Modules (`js/utils/`)
Pure utility functions:

- `formatters.js`: `fmtDate()`, `fmtTime()`, `formatWeight()`, `unitLabel()`
- `calculations.js`: `calc1RM()`, `calcPlates()`, `getProgression()`, `calcFatigueScore()`
- `coach.js`: `getRecoveryStatus()`, `getCoachMessage()`, `getExerciseTip()`

---

## Architecture Patterns

### State Management
Global state object stored in `state` variable, synced automatically with Firebase:

```javascript
const DEFAULT_STATE = {
  phase: "rampup",        // "rampup" | "ppl"
  rampWeek: "Week 1",     // "Week 1" | "Week 2"
  rampDayIdx: 0,          // 0-2 for ramp-up days
  mesoWeek: 1,            // 1-4 (4 = deload)
  pplIdx: 0,              // 0-5 for PPL rotation
  program: "standard",    // "standard" | "glute-focus"
  units: "lbs",           // "lbs" | "kg"
  customExercises: [],
  fatigueFlags: 0,
  longestStreak: 0,
  allowedPrograms: ['standard', 'glute-focus'],
  goals: { targetWeight: 0, lifts: {} },
  manualPRs: {}
};
```

### Data Flow
```
User Action → Modify State → Storage.set() → localStorage (immediate)
                                      ↓
                              Firebase (async)
                              ↓
                         Real-time listeners update other clients
```

### Authentication Flow
1. User enters 8-digit PIN (birthday as MMDDYYYY)
2. PIN is hashed to create a Firebase Auth email/password pair
3. Admin PIN (`01131998`) uses real email/password authentication
4. Auth state persisted in `localStorage` under `ht-pin`

### DOM Rendering
Custom `el()` helper function for DOM creation (no template engine):

```javascript
function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) e[k] = v;
    else if (k === 'cls') e.className = v;
    else if (k === 'css') e.style.cssText = v;
    else if (k === 'value') e.value = v;
    else e.setAttribute(k, v);
  }
  // ... append children
  return e;
}
```

---

## Key Features Implementation

### Rest Timer
- Background notifications via Service Worker `postMessage`
- `SCHEDULE_REST` message type triggers `setTimeout` in SW
- Notifications use native Web Notifications API
- Preset buttons: 60s, 90s, 120s, 180s

### Plate Calculator
- Calculates plates per side based on bar weight (45 lbs / 20 kg)
- Available plates: `[45, 25, 10, 5, 2.5]` lbs or `[20, 10, 5, 2.5, 1.25]` kg
- Color-coded plate chips in UI

### PR Detection
- Compares current workout against historical data
- `getPR(name)` returns best weight ever lifted for exercise
- Manual PRs can be set in Progress screen
- PR toasts shown on new records

### Fatigue Detection
- Compares last 2 workouts for same day
- If 2+ exercises show rep decline, increments `fatigueFlags`
- Flags >= 2 triggers deload recommendation banner

### Warm-up Sets
- `getWarmupSets(workingWeight)` calculates progressive warm-up
- Bar only → 50% → 75% of working weight

### 1RM Calculation
- Uses Epley formula: `weight * (1 + reps / 30)`

### Progression Logic
- `shouldIncrease()` checks if all sets hit target reps at target RIR
- Suggests weight increment (5 lbs / 2.5 kg)

---

## Security Model

### Firebase Security Rules (`database.rules.json`)
```json
{
  "rules": {
    "users": {
      ".read": "auth != null && auth.token.email === 'ayman98a@gmail.com'",
      "$uid": {
        ".read": "auth != null && (auth.uid === $uid || auth.token.email === 'ayman98a@gmail.com')",
        ".write": "auth != null && (auth.uid === $uid || auth.token.email === 'ayman98a@gmail.com')"
      }
    },
    "registry": {
      ".read": "auth != null && auth.token.email === 'ayman98a@gmail.com'",
      "$uid": { ".write": "auth != null && (auth.uid === $uid || auth.token.email === 'ayman98a@gmail.com')"
      }
    },
    "pinIndex": {
      ".read": "auth != null && auth.token.email === 'ayman98a@gmail.com'",
      "$pinHash": { ".write": "auth != null" }
    }
  }
}
```

### Admin PIN
- Hardcoded: `01131998`
- Requires Firebase password stored in `localStorage` under `ht-admin-password`

### PIN Security Model

**Rate Limiting:**
- Max 5 failed login attempts per 1-minute window
- Failed attempts tracked in localStorage (`ht-login-attempts`)
- Lockout duration: 60 seconds after exceeding threshold

**PIN Strength Validation:**
- Detects sequential numbers (e.g., `12345678`, `87654321`)
- Detects repeated digits (e.g., `11111111`)
- Warns users about weak PINs but allows login
- Stored in `ht-last-pin-warning` for UI display

**Secure Hashing:**
- Primary: SubtleCrypto SHA-256 (async) - `'s'` prefix
- Fallback: Legacy DJB2 hash (sync) - `'u'` prefix
- Backwards compatible with existing user data
- Grants access to Admin Portal for user management
- Admin email: `ayman98a@gmail.com`

---

## Service Worker (`sw.js`)

### Caching Strategy
- **Cache name**: `ht-v17` (bump version for updates)
- **Assets cached**: All static files (HTML, CSS, JS, manifest, icon)
- **JS/CSS**: Network-first (for quick updates)
- **Other assets**: Cache-first
- **Firebase/Google APIs**: Pass-through (no caching)

### Background Notifications
- Listens for `SCHEDULE_REST` message from main thread
- Uses `setTimeout` + `registration.showNotification()`
- Handles notification clicks to focus/open window

---

## CSS Architecture

### Theme Variables
```css
:root, [data-theme="dark"] {
  --bg: #080810; --card: #111122; --card-border: #1c1c36;
  --accent: #E94560; --green: #22c55e; --gold: #facc15;
  --text: #e4e4e7; --dim: #71717a; --muted: #3f3f56;
  --font: 'DM Sans', -apple-system, sans-serif;
  --mono: 'JetBrains Mono', monospace;
}
```

### Responsive Breakpoints
| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Mobile (default) | <640px | Bottom nav, single column |
| Tablet | 640px+ | Centered content, max-width 560px |
| Desktop | 900px+ | Sidebar nav (220px), two-column grids |
| Wide Desktop | 1200px+ | Wider sidebar (260px), max-width 900px |

---

## Development Guidelines

### Adding a New Program

1. **Define program data** in `program-data.js`:
```javascript
const RAMPUP_XXX = { /* week/day structure */ };
const PPL_XXX = [ /* day objects with exercises */ ];
const COMPOUNDS_XXX = [ /* main lifts */ ];
```

2. **Register in PROGRAMS object**:
```javascript
const PROGRAMS = {
  standard: { rampup: RAMPUP, ppl: PPL, compounds: COMPOUNDS },
  "glute-focus": { rampup: RAMPUP_GF, ppl: PPL_GF, compounds: COMPOUNDS_GF },
  "xxx": { rampup: RAMPUP_XXX, ppl: PPL_XXX, compounds: COMPOUNDS_XXX },
};
```

3. **Add to ALL_PROGRAMS** in `app.js`:
```javascript
const ALL_PROGRAMS = [
  ['standard', 'Standard PPL'],
  ['glute-focus', 'Glute-Focus PPL'],
  ['xxx', 'Your Program']
];
```

### Adding a Built-in Template

Add to `Templates.BUILT_IN` in `js/templates.js`:

```javascript
'my-template': {
  id: 'my-template',
  name: 'My Template',
  description: 'Description here',
  type: 'template',  // or 'program' for multi-day
  source: 'builtin',
  tags: ['tag1', 'tag2'],
  days: [{
    dayLabel: 'Day 1',
    exercises: [
      { name: 'Exercise', sets: 3, reps: '8-10', rest: 90, notes: '' }
    ]
  }]
}
```

### Adding a New Screen

1. **Create screen file** `js/screens/myscreen.js`:
```javascript
function renderMyScreen() {
  return el('div', { cls: 'screen' },
    el('div', { cls: 'header' }, el('h1', null, 'MY SCREEN')),
    // ... content
    renderNav()
  );
}
```

2. **Register in `js/app.js`** - Add script tag to `index.html`:
```html
<script src="js/screens/myscreen.js"></script>
```

3. **Register in router** - In `init()` function:
```javascript
Router.registerAll({
  // ... existing screens
  myscreen: renderMyScreen
});
```

4. **Add navigation** (optional) - Add to `NAV_ITEMS` in `router.js`:
```javascript
const NAV_ITEMS = [
  // ... existing items
  ['myscreen', '🔥', 'My Screen']
];
```

### Exercise Structure
```javascript
{
  name: "Exercise Name",
  sets: 3,
  reps: "8-10",      // Can be "10-12", "AMRAP", "10/leg", etc.
  rest: 90           // Seconds
}
```

---

## Testing

### Unit Testing Framework

A custom, dependency-free test framework is included in `js/test/`:

```
js/test/
├── test-framework.js      # Core testing framework
├── calculations.test.js   # 1RM, plates, volume, fatigue tests
├── formatters.test.js     # Date, time, weight formatting tests
├── coach.test.js          # Recovery, plateau, deload tests
├── state.test.js          # Store operations and mutations
└── validation.test.js     # PIN, weight, date validation tests
```

**Test Runner Pages:**
- `test/index.html` - Interactive test runner with UI
- `test/visual.html` - Visual regression test reference

**Running Tests:**
1. **In Browser**: Open `test/index.html`
2. **Via Settings**: Settings → Developer → Run Tests
3. **Via Admin**: Admin Portal → Run Tests (admin only)
4. **Auto-run**: Add `?run` param to URL: `test/index.html?run`

**Test Framework API:**
```javascript
// Basic test structure
Test.describe('Suite Name', () => {
  Test.beforeEach(() => { /* setup */ });
  Test.afterEach(() => { /* cleanup */ });
  
  Test.it('should do something', () => {
    Test.expect(actual).toBe(expected);
    Test.expect(actual).toEqual({ obj: 'ect' });
    Test.expect(actual).toBeCloseTo(1.23, 2);
    Test.expect(actual).toBeTruthy();
    Test.expect(actual).toContain('item');
    Test.expect(fn).toThrow('error message');
  });
});

// Run all tests
const results = await Test.runAll({ silent: false });
// Returns: { total, passed, failed, skipped, duration, suites }

// Mock utilities
const mockStorage = Test.createMockStorage();
const mockStore = Test.createMockStore();
```

**Test Isolation:**
- Tests use mock `localStorage` to avoid polluting user data
- Mock `Store` objects are created fresh for each test suite
- Global `Store` is backed up and restored in before/after hooks

### Manual Testing Checklist

1. **Offline functionality** - Disable network, verify data saves/loads from localStorage
2. **Sync** - Log workout on device A, verify appears on device B
3. **PWA install** - Check `beforeinstallprompt` and app installation
4. **Admin features** - Login with admin PIN, verify user management works
5. **Responsive** - Test on mobile (375px), tablet (768px), desktop (1200px+)
6. **Service Worker** - Verify caching, background notifications

---

## Deployment

### GitHub Pages (Recommended)
```bash
git init && git add . && git commit -m "deploy"
git remote add origin https://github.com/YOU/hypertrophy-tracker.git
git push -u origin main
```
Then: Settings → Pages → Deploy from main branch.

### Firebase Hosting (Alternative)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

---

## Data Export/Import

### CSV Export Format
```csv
Date,Day,Week,Phase,RIR Target,Duration,Exercise,Set,Weight,Reps,RIR,Note
"2024-01-15","Push A","Meso W1","ppl","3 RIR","45","Barbell Bench Press","1","185","8","2",""
```

### Import Behavior
- Groups rows by Date+Day combination
- Skips duplicates (same date+day already in history)
- Maximum 200 workouts stored

---

## Browser Compatibility

- **Required**: ES6+ (arrow functions, spread, destructuring, async/await)
- **Required**: CSS Grid, Flexbox, CSS Variables
- **Required**: Service Workers, Web Notifications
- **Tested**: Chrome/Edge (desktop/mobile), Safari iOS, Firefox

---

## Known Limitations

1. **No TypeScript** - Pure JavaScript with runtime checks
2. **No bundler** - All code in global scope, manual script tag ordering matters
3. **Single admin** - Hardcoded to `ayman98a@gmail.com`
4. **PIN security** - Not cryptographically strong, but practical for fitness app
5. **No multi-user on same device** - Switching PINs requires logout/login
6. **200 workout limit** - History truncated to prevent storage issues

---

## File Size Reference

| File | Lines | Purpose |
|------|-------|---------|
| `js/app.js` | ~300 | Main entry point |
| `js/router.js` | ~200 | Router and DOM helper |
| `js/state.js` | ~400 | State management |
| `js/storage.js` | ~400 | Firebase/localStorage abstraction |
| `js/program-data.js` | ~350 | Exercise definitions |
| `js/templates.js` | ~600 | Workout templates & custom programs |
| `js/screens/*.js` | ~1800 | Screen renderers (9 files) |
| `js/components/*.js` | ~600 | UI components (3 files) |
| `js/utils/*.js` | ~400 | Utility functions (3 files) |
| `css/styles.css` | ~486 | All styling |
| `sw.js` | ~71 | Service worker |
