// ============================================
// HYPERTROPHY TRACKER — Keyboard Shortcuts & Voice Input
// ============================================

// ========== KEYBOARD SHORTCUTS MODULE ==========
const Shortcuts = (function() {
  'use strict';

  // State tracking
  let helpModalOpen = false;
  let voiceListening = false;
  let voiceRecognition = null;
  let currentFocusIndex = -1;
  let inputElements = [];

  // Rest timer durations mapped to keys 1-9
  const REST_PRESETS = {
    '1': 60,   '2': 90,   '3': 120,
    '4': 150,  '5': 180,  '6': 210,
    '7': 240,  '8': 300,  '9': 360
  };

  // Shortcut definitions for help modal
  const SHORTCUTS = [
    { key: 'Ctrl+Enter', desc: 'Finish workout', context: 'Workout' },
    { key: 'Space', desc: 'Start/stop rest timer', context: 'Workout (when not typing)' },
    { key: '1-9', desc: 'Quick-select rest time (60s-360s)', context: 'Workout' },
    { key: 'Escape', desc: 'Close modal / Cancel', context: 'Global' },
    { key: '↑ ↓ ← →', desc: 'Navigate between input fields', context: 'Workout' },
    { key: '/ or ?', desc: 'Show this help', context: 'Global' },
    { key: 'n', desc: 'Start new workout (from home)', context: 'Home' },
    { key: 'h', desc: 'Go to history', context: 'Global' },
    { key: 'p', desc: 'Go to progress', context: 'Global' },
    { key: 's', desc: 'Go to settings', context: 'Global' },
    { key: 'Ctrl+z', desc: 'Undo last workout', context: 'Home' },
  ];

  // Voice command patterns
  const VOICE_PATTERNS = {
    logSet: /(?:log|set|entered?|did)\s+(\d+(?:\.\d+)?)\s*(?:for|x|times?)?\s*(\d+)\s*(?:reps?)?/i,
    timer: /(?:set\s+)?timer\s+(\d+)\s*(?:seconds?|sec|s)?/i,
    nextExercise: /(?:next\s+exercise|next|skip)/i,
    finishWorkout: /(?:finish|complete|done|end)\s+(?:workout|session)?/i,
    startRest: /(?:start\s+)?rest\s+(?:for\s+)?(\d+)\s*(?:seconds?|sec|s)?/i,
  };

  // ========== UTILITY FUNCTIONS ==========

  function isInputFocused() {
    const activeEl = document.activeElement;
    return activeEl && (
      activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.isContentEditable
    );
  }

  function isModalOpen() {
    return !!document.querySelector('.modal-overlay');
  }

  function getScreen() {
    // Access the global screen variable from app.js
    // Note: window.screen is a built-in browser property, so we check for the app's screen variable differently
    try {
      // The app uses a global 'screen' variable (not window.screen)
      if (typeof screen !== 'undefined' && screen !== window.screen) {
        return screen;
      }
      // Fallback: check if app.js has defined it globally
      if (typeof appScreen !== 'undefined') return appScreen;
      return 'login';
    } catch (e) {
      return 'login';
    }
  }

  function haptic(pattern = 50) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  // ========== INPUT NAVIGATION ==========

  function updateInputList() {
    inputElements = Array.from(document.querySelectorAll(
      'input[type="number"], input[type="text"], input[type="tel"], textarea'
    )).filter(el => !el.disabled && el.offsetParent !== null);
  }

  function focusInput(index) {
    updateInputList();
    if (index >= 0 && index < inputElements.length) {
      currentFocusIndex = index;
      inputElements[index].focus();
      inputElements[index].select();
    }
  }

  function navigateInputs(direction) {
    updateInputList();
    if (inputElements.length === 0) return;

    const activeEl = document.activeElement;
    const currentIndex = inputElements.indexOf(activeEl);

    let newIndex;
    if (direction === 'next') {
      newIndex = currentIndex >= 0 ? (currentIndex + 1) % inputElements.length : 0;
    } else if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : inputElements.length - 1;
    } else if (direction === 'down') {
      // Find next input in same column (roughly)
      newIndex = currentIndex >= 0 ? Math.min(currentIndex + 3, inputElements.length - 1) : 0;
    } else if (direction === 'up') {
      // Find prev input in same column
      newIndex = currentIndex > 0 ? Math.max(currentIndex - 3, 0) : inputElements.length - 1;
    }

    focusInput(newIndex);
  }

  // ========== REST TIMER FUNCTIONS ==========

  function toggleRestTimer() {
    // Access global restTimer state from app.js
    if (typeof restTimer !== 'undefined' && restTimer > 0) {
      if (typeof stopRest === 'function') stopRest();
    } else {
      // Start default 90s rest
      if (typeof startRest === 'function') startRest(90);
    }
  }

  function quickRestTimer(key) {
    const seconds = REST_PRESETS[key];
    if (seconds && typeof startRest === 'function') {
      startRest(seconds);
      haptic(30);
    }
  }

  // ========== SCREEN NAVIGATION ==========

  function navigateTo(targetScreen) {
    // Don't navigate if in workout screen (unless going to history/progress for reference)
    if (getScreen() === 'workout' && targetScreen !== 'workout') {
      // Show confirmation modal for leaving workout
      if (typeof modal !== 'undefined') {
        modal = {
          title: 'Leave Workout?',
          message: 'Your progress will be lost if you navigate away.',
          onConfirm: () => {
            if (typeof activeDay !== 'undefined') activeDay = null;
            if (typeof stopRest === 'function') stopRest();
            if (typeof appScreen !== 'undefined') window.appScreen = targetScreen;
            if (typeof render === 'function') render();
          }
        };
        if (typeof render === 'function') render();
      }
      return;
    }

    if (typeof appScreen !== 'undefined') window.appScreen = targetScreen;
    if (typeof render === 'function') render();
    haptic(30);
  }

  function startNewWorkout() {
    if (getScreen() !== 'home') return;
    
    // Find the next workout button
    const nextBtn = document.querySelector('.btn:not(.btn-sm):not(.btn-ghost):not(.red)');
    if (nextBtn && nextBtn.textContent.includes('START')) {
      nextBtn.click();
    }
  }

  function undoWorkout() {
    if (getScreen() !== 'home') return;
    if (typeof undoLastWorkout === 'function') {
      undoLastWorkout();
    }
  }

  function finishWorkout() {
    if (getScreen() !== 'workout') return;
    
    // Find and click the finish button
    const finishBtn = document.querySelector('.btn-green');
    if (finishBtn && finishBtn.textContent.includes('FINISH')) {
      finishBtn.click();
    }
  }

  // ========== HELP MODAL ==========

  function showHelpModal() {
    helpModalOpen = true;
    
    const content = document.createElement('div');
    content.innerHTML = `
      <div style="max-height:60vh;overflow-y:auto">
        <div style="margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:8px">KEYBOARD SHORTCUTS</div>
          <div style="display:grid;gap:8px">
            ${SHORTCUTS.map(s => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--card-border)">
                <div>
                  <div style="font-size:13px;color:var(--white);font-weight:600">${s.desc}</div>
                  <div style="font-size:10px;color:var(--dim)">${s.context}</div>
                </div>
                <kbd style="background:var(--input-bg);padding:4px 8px;border-radius:4px;font-family:var(--mono);font-size:12px;color:var(--accent);white-space:nowrap">${s.key}</kbd>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div style="margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:8px">VOICE COMMANDS</div>
          <div style="display:grid;gap:8px">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">
              <span style="font-size:13px;color:var(--white)">"Log 185 for 8 reps"</span>
              <span style="font-size:11px;color:var(--dim)">Fill weight & reps</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">
              <span style="font-size:13px;color:var(--white)">"Set timer 90 seconds"</span>
              <span style="font-size:11px;color:var(--dim)">Start rest timer</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">
              <span style="font-size:13px;color:var(--white)">"Next exercise"</span>
              <span style="font-size:11px;color:var(--dim)">Scroll to next</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">
              <span style="font-size:13px;color:var(--white)">"Finish workout"</span>
              <span style="font-size:11px;color:var(--dim)">Complete session</span>
            </div>
          </div>
        </div>

        <div style="font-size:11px;color:var(--dim);text-align:center;padding-top:8px;border-top:1px solid var(--card-border)">
          Press <kbd style="background:var(--input-bg);padding:2px 6px;border-radius:3px">?</kbd> anytime to show this help
        </div>
      </div>
    `;

    if (typeof modal !== 'undefined' && typeof el === 'function') {
      modal = {
        title: '⌨️ Shortcuts & Voice',
        content: content,
        onCancel: () => { helpModalOpen = false; modal = null; if (typeof render === 'function') render(); }
      };
      if (typeof render === 'function') render();
    }
  }

  function closeModal() {
    if (isModalOpen()) {
      if (typeof modal !== 'undefined') {
        modal = null;
        if (typeof render === 'function') render();
      }
      helpModalOpen = false;
      return true;
    }
    return false;
  }

  // ========== VOICE INPUT ==========

  function initVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.log('Speech recognition not supported');
      return false;
    }

    voiceRecognition = new SpeechRecognition();
    voiceRecognition.continuous = true;
    voiceRecognition.interimResults = true;
    voiceRecognition.lang = 'en-US';

    voiceRecognition.onstart = () => {
      voiceListening = true;
      showVoiceIndicator();
      haptic([50, 50]);
    };

    voiceRecognition.onend = () => {
      voiceListening = false;
      hideVoiceIndicator();
      // Auto-restart if still in workout
      if (getScreen() === 'workout' && voiceRecognition) {
        setTimeout(() => {
          if (getScreen() === 'workout') startVoiceInput();
        }, 500);
      }
    };

    voiceRecognition.onresult = (event) => {
      const results = event.results;
      const lastResult = results[results.length - 1];
      const transcript = lastResult[0].transcript.trim();
      
      if (lastResult.isFinal) {
        processVoiceCommand(transcript);
      } else {
        updateVoiceTranscript(transcript);
      }
    };

    voiceRecognition.onerror = (event) => {
      console.log('Voice recognition error:', event.error);
      voiceListening = false;
      hideVoiceIndicator();
    };

    return true;
  }

  function startVoiceInput() {
    if (!voiceRecognition && !initVoiceRecognition()) {
      // Show browser not supported message
      if (typeof modal !== 'undefined') {
        modal = {
          title: 'Voice Not Supported',
          message: 'Your browser doesn\'t support voice recognition. Try Chrome or Edge.'
        };
        if (typeof render === 'function') render();
      }
      return;
    }

    try {
      voiceRecognition.start();
    } catch (e) {
      // Already started or other error
    }
  }

  function stopVoiceInput() {
    if (voiceRecognition) {
      try {
        voiceRecognition.stop();
      } catch (e) {}
    }
    voiceListening = false;
    hideVoiceIndicator();
  }

  function showVoiceIndicator() {
    let indicator = document.getElementById('voice-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'voice-indicator';
      indicator.innerHTML = `
        <div class="voice-pulse"></div>
        <span class="voice-text">🎤 Listening...</span>
        <span class="voice-transcript"></span>
      `;
      indicator.style.cssText = `
        position:fixed;
        bottom:80px;
        left:50%;
        transform:translateX(-50%);
        background:rgba(233,69,96,0.95);
        color:white;
        padding:12px 20px;
        border-radius:30px;
        display:flex;
        align-items:center;
        gap:10px;
        font-size:14px;
        font-weight:600;
        z-index:10000;
        box-shadow:0 4px 20px rgba(0,0,0,0.3);
        animation:voiceSlideUp 0.3s ease;
      `;
      document.body.appendChild(indicator);
      
      // Add animation styles
      if (!document.getElementById('voice-styles')) {
        const style = document.createElement('style');
        style.id = 'voice-styles';
        style.textContent = `
          @keyframes voiceSlideUp {
            from { opacity:0; transform:translateX(-50%) translateY(20px); }
            to { opacity:1; transform:translateX(-50%) translateY(0); }
          }
          .voice-pulse {
            width:10px;
            height:10px;
            background:#fff;
            border-radius:50%;
            animation:voicePulse 1.5s infinite;
          }
          @keyframes voicePulse {
            0%, 100% { transform:scale(1); opacity:1; }
            50% { transform:scale(1.3); opacity:0.7; }
          }
          .voice-transcript {
            font-size:11px;
            opacity:0.8;
            max-width:200px;
            overflow:hidden;
            text-overflow:ellipsis;
            white-space:nowrap;
          }
        `;
        document.head.appendChild(style);
      }
    }
    indicator.style.display = 'flex';
  }

  function hideVoiceIndicator() {
    const indicator = document.getElementById('voice-indicator');
    if (indicator) {
      indicator.style.opacity = '0';
      indicator.style.transform = 'translateX(-50%) translateY(20px)';
      indicator.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        indicator.style.display = 'none';
        indicator.style.opacity = '1';
        indicator.style.transform = 'translateX(-50%) translateY(0)';
      }, 300);
    }
  }

  function updateVoiceTranscript(text) {
    const transcript = document.querySelector('.voice-transcript');
    if (transcript) {
      transcript.textContent = text;
    }
  }

  function processVoiceCommand(transcript) {
    console.log('Voice command:', transcript);
    
    // Log set: "Log 185 for 8 reps"
    const logMatch = transcript.match(VOICE_PATTERNS.logSet);
    if (logMatch && getScreen() === 'workout') {
      const weight = logMatch[1];
      const reps = logMatch[2];
      fillCurrentSet(weight, reps);
      haptic([30, 30, 30]);
      return;
    }

    // Set timer: "Set timer 90 seconds"
    const timerMatch = transcript.match(VOICE_PATTERNS.timer) || 
                       transcript.match(VOICE_PATTERNS.startRest);
    if (timerMatch) {
      const seconds = parseInt(timerMatch[1]);
      if (seconds && typeof startRest === 'function') {
        startRest(seconds);
        haptic(50);
      }
      return;
    }

    // Next exercise
    if (VOICE_PATTERNS.nextExercise.test(transcript) && getScreen() === 'workout') {
      scrollToNextExercise();
      return;
    }

    // Finish workout
    if (VOICE_PATTERNS.finishWorkout.test(transcript) && getScreen() === 'workout') {
      finishWorkout();
      return;
    }
  }

  function fillCurrentSet(weight, reps) {
    // Find the first unfilled set input
    updateInputList();
    
    for (let i = 0; i < inputElements.length; i += 3) {
      const weightInput = inputElements[i];
      const repsInput = inputElements[i + 1];
      
      if (weightInput && repsInput && (!weightInput.value || !repsInput.value)) {
        weightInput.value = weight;
        repsInput.value = reps;
        
        // Trigger input events
        weightInput.dispatchEvent(new Event('input', { bubbles: true }));
        repsInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Move to next input
        focusInput(i + 3);
        
        // Show confirmation
        showVoiceFeedback(`✓ Logged ${weight}×${reps}`);
        return;
      }
    }
  }

  function scrollToNextExercise() {
    const cards = document.querySelectorAll('.card');
    const scrollY = window.scrollY;
    
    for (const card of cards) {
      if (card.offsetTop > scrollY + 100) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        haptic(30);
        break;
      }
    }
  }

  function showVoiceFeedback(message) {
    let feedback = document.getElementById('voice-feedback');
    if (!feedback) {
      feedback = document.createElement('div');
      feedback.id = 'voice-feedback';
      feedback.style.cssText = `
        position:fixed;
        top:80px;
        left:50%;
        transform:translateX(-50%);
        background:var(--green);
        color:white;
        padding:10px 20px;
        border-radius:20px;
        font-size:13px;
        font-weight:600;
        z-index:10001;
        opacity:0;
        transition:opacity 0.3s;
      `;
      document.body.appendChild(feedback);
    }
    
    feedback.textContent = message;
    feedback.style.opacity = '1';
    setTimeout(() => {
      feedback.style.opacity = '0';
    }, 2000);
  }

  // ========== KEYBOARD HANDLER ==========

  function handleKeydown(e) {
    const key = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    const inInput = isInputFocused();
    const modalOpen = isModalOpen();
    const currentScreen = getScreen();

    // Escape: Close modal (always works)
    if (key === 'Escape') {
      if (closeModal()) {
        e.preventDefault();
        return;
      }
    }

    // ? or /: Show help (when not typing)
    if ((key === '?' || key === '/') && !inInput && !modalOpen) {
      e.preventDefault();
      showHelpModal();
      return;
    }

    // If modal is open, only Escape works
    if (modalOpen) return;

    // Ctrl+Enter: Finish workout
    if (ctrl && key === 'Enter' && currentScreen === 'workout') {
      e.preventDefault();
      finishWorkout();
      return;
    }

    // Ctrl+Z: Undo last workout
    if (ctrl && (key === 'z' || key === 'Z') && currentScreen === 'home') {
      e.preventDefault();
      undoWorkout();
      return;
    }

    // Navigation shortcuts (don't work in inputs)
    if (!inInput) {
      // Space: Toggle rest timer
      if (key === ' ' && currentScreen === 'workout') {
        e.preventDefault();
        toggleRestTimer();
        return;
      }

      // Number keys: Quick rest timer
      if (currentScreen === 'workout' && /^[1-9]$/.test(key)) {
        e.preventDefault();
        quickRestTimer(key);
        return;
      }

      // N: Start new workout (home screen)
      if ((key === 'n' || key === 'N') && currentScreen === 'home') {
        e.preventDefault();
        startNewWorkout();
        return;
      }

      // H: Go to history
      if ((key === 'h' || key === 'H')) {
        e.preventDefault();
        navigateTo('history');
        return;
      }

      // P: Go to progress
      if ((key === 'p' || key === 'P')) {
        e.preventDefault();
        navigateTo('progress');
        return;
      }

      // S: Go to settings
      if ((key === 's' || key === 'S')) {
        e.preventDefault();
        navigateTo('settings');
        return;
      }

      // Arrow keys: Navigate inputs
      if (currentScreen === 'workout') {
        if (key === 'ArrowRight' || key === 'ArrowDown') {
          e.preventDefault();
          navigateInputs(key === 'ArrowRight' ? 'next' : 'down');
          return;
        }
        if (key === 'ArrowLeft' || key === 'ArrowUp') {
          e.preventDefault();
          navigateInputs(key === 'ArrowLeft' ? 'prev' : 'up');
          return;
        }
      }
    }
  }

  // ========== PUBLIC API ==========

  function init() {
    document.addEventListener('keydown', handleKeydown);
    
    // Auto-start voice when entering workout
    const originalRender = window.render;
    if (originalRender) {
      window.render = function() {
        const prevScreen = getScreen();
        originalRender.apply(this, arguments);
        const newScreen = getScreen();
        
        // Start/stop voice based on screen
        if (newScreen === 'workout' && prevScreen !== 'workout') {
          // Small delay to let render complete
          setTimeout(startVoiceInput, 500);
        } else if (newScreen !== 'workout' && prevScreen === 'workout') {
          stopVoiceInput();
        }
      };
    }

    console.log('Keyboard shortcuts initialized');
  }

  // Expose public methods
  return {
    init,
    showHelp: showHelpModal,
    toggleVoice: () => voiceListening ? stopVoiceInput() : startVoiceInput(),
    isVoiceListening: () => voiceListening
  };
})();

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', Shortcuts.init);
} else {
  Shortcuts.init();
}
