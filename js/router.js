// ============================================
// ROUTER — Simple hash-based router and renderer
// ============================================

const Router = {
  // Screen renderers registry
  screens: {},
  
  /**
   * Register a screen renderer
   * @param {string} name - Screen name
   * @param {Function} renderer - Render function that returns HTMLElement
   */
  register(name, renderer) {
    this.screens[name] = renderer;
  },
  
  /**
   * Register multiple screens at once
   * @param {Object} screenMap - Object mapping screen names to renderers
   */
  registerAll(screenMap) {
    Object.assign(this.screens, screenMap);
  },
  
  /**
   * Navigate to a screen
   * @param {string} screenName - Target screen name
   * @param {boolean} [skipHistory=false] - Whether to skip adding to browser history
   */
  navigate(screenName, skipHistory = false) {
    if (!this.screens[screenName]) {
      console.error(`Screen "${screenName}" not found`);
      return;
    }
    
    // Prevent navigation away from active workout without confirmation
    if (Store.screen === 'workout' && screenName !== 'workout') {
      return;
    }
    
    Store.screen = screenName;
    
    // Update URL hash for browser history (optional)
    if (!skipHistory && window.location.hash !== `#${screenName}`) {
      window.history.pushState({ screen: screenName }, '', `#${screenName}`);
    }
    
    this.render();
  },
  
  /**
   * Render the current screen
   */
  render() {
    const app = document.getElementById('app');
    if (!app) {
      console.error('App container not found');
      return;
    }
    
    app.innerHTML = '';
    
    const renderer = this.screens[Store.screen];
    if (renderer) {
      app.appendChild(renderer());
    } else {
      app.appendChild(el('div', { css: 'padding:20px;color:var(--accent)' }, 
        `Error: Screen "${Store.screen}" not found`
      ));
    }
    
    // Render global overlays
    this.renderOverlays(app);
  },
  
  /**
   * Render global overlay elements (toasts, notifications)
   * @param {HTMLElement} app - App container
   */
  renderOverlays(app) {
    // Offline banner
    if (!Store.isOnline && Store.screen !== 'workout') {
      app.prepend(el('div', { cls: 'offline-banner' }, 'Offline — using local data'));
    }
    
    // Undo toast
    if (Store.undoEntry && Store.screen === 'home') {
      app.appendChild(el('div', { cls: 'undo-toast' },
        el('span', null, 'Workout saved!'),
        el('button', { 
          cls: 'btn-sm green', 
          css: 'font-size:12px;padding:6px 14px', 
          onclick: undoLastWorkout 
        }, 'UNDO')
      ));
    }
    
    // PR toasts
    if (Store.prToasts.length > 0) {
      app.appendChild(el('div', { cls: 'pr-toast-container' },
        ...Store.prToasts.map(t => 
          el('div', { cls: 'pr-toast-item' }, `🏆 New PR! ${t.name}: ${fmtW(t.weight)}`)
        )
      ));
    }
  },
  
  /**
   * Initialize router with popstate handling
   */
  init() {
    // Handle browser back/forward buttons
    window.addEventListener('popstate', (e) => {
      if (e.state?.screen && this.screens[e.state.screen]) {
        Store.screen = e.state.screen;
        this.render(true); // Skip history update
      }
    });
    
    // Handle initial hash
    const initialHash = window.location.hash.slice(1);
    if (initialHash && this.screens[initialHash] && Store.screen !== 'login') {
      Store.screen = initialHash;
    }
  }
};

// Make Router globally available
window.Router = Router;

// ============================================
// NAVIGATION — Navigation bar component
// ============================================

const NAV_ITEMS = [
  ['home', '🏠', 'Home'],
  ['history', '📋', 'History'],
  ['progress', '📈', 'Progress'],
  ['templates', '📑', 'Templates'],
  ['health', '❤️', 'Health'],
  ['settings', '⚙️', 'Settings']
];

const isDesktop = () => window.matchMedia('(min-width:900px)').matches;

/**
 * Render the navigation bar
 * @returns {HTMLElement} Navigation element
 */
function renderNav() {
  const items = [...NAV_ITEMS];
  if (Store.isAdmin()) items.push(['admin', '🛡️', 'Admin']);
  
  return el('div', { cls: 'nav' },
    ...items.map(([k, icon, label]) =>
      el('button', { 
        cls: Store.screen === k ? 'active' : '', 
        onclick: () => {
          if (Store.screen === 'workout') return;
          Router.navigate(k);
        }
      },
        el('span', { cls: 'nav-icon' }, icon),
        el('span', { cls: 'nav-label' }, label)
      )
    )
  );
}

// Make renderNav globally available
window.renderNav = renderNav;

// ============================================
// DOM HELPER — Element creation utility
// ============================================

/**
 * Create a DOM element with attributes and children
 * @param {string} tag - HTML tag name
 * @param {Object|null} attrs - Attributes (cls, css, onclick, etc.)
 * @param {...*} kids - Child elements or strings
 * @returns {HTMLElement} Created element
 */
function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('on')) e[k] = v;
      else if (k === 'cls') e.className = v;
      else if (k === 'css') e.style.cssText = v;
      else if (k === 'value') e.value = v;
      else e.setAttribute(k, v);
    }
  }
  for (const c of kids) {
    if (c == null || c === false) continue;
    if (typeof c === 'string' || typeof c === 'number') e.append(String(c));
    else if (Array.isArray(c)) c.forEach(x => x && e.append(x));
    else e.append(c);
  }
  return e;
}

// Make el globally available
window.el = el;
