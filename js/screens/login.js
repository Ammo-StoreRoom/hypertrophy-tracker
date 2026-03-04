// ============================================
// LOGIN SCREEN — Authentication screen
// ============================================

/**
 * Render the login screen
 * @returns {HTMLElement} Login screen element
 */
function renderLogin() {
  return el('div', { cls: 'screen login-screen' }, renderModal(),
    el('div', { cls: 'login-box' },
      el('div', { css: 'text-align:center;margin-bottom:32px' },
        el('h1', { css: 'font-size:28px;font-weight:900;color:var(--white);margin-bottom:4px' }, 'HYPERTROPHY'),
        el('div', { css: 'font-size:14px;color:var(--accent);font-weight:700;letter-spacing:2px' }, 'TRACKER')
      ),
      el('div', { css: 'margin-bottom:20px' },
        el('label', { cls: 'label', css: 'display:block;margin-bottom:8px' }, 'Enter your birthday to sync'),
        el('input', { 
          type: 'tel', 
          id: 'pin-input', 
          cls: 'pin-input', 
          placeholder: 'MMDDYYYY', 
          maxlength: '8', 
          inputmode: 'numeric', 
          value: Store.loginPinValue,
          onkeyup: e => { 
            if (e.key === 'Enter') doLogin(e.target.value); 
          },
          oninput: e => { Store.loginPinValue = e.target.value; }
        }),
        el('div', { id: 'login-error', css: 'color:#ef4444;font-size:12px;margin-top:6px;min-height:18px' })
      ),
      el('button', { 
        cls: 'btn', 
        onclick: () => doLogin(document.getElementById('pin-input')?.value ?? Store.loginPinValue) 
      }, 'START TRACKING'),
      el('div', { css: 'text-align:center;margin-top:16px;font-size:11px;color:var(--dim)' }, 
        'Your birthday is your sync key across devices'
      )
    )
  );
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderLogin };
}
