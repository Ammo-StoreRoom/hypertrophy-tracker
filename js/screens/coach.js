// ============================================
// COACH SCREEN — AI Training Insights
// ============================================

/**
 * Render the Coach screen with AI training insights
 * @returns {HTMLElement} Coach screen element
 */
function renderCoach() {
  const insights = Coach.analyzeTrainingState(Store.state, Store.history, Store.bodyWeights);
  const recovery = Coach.analyzeRecovery(Store.bodyWeights);
  const tips = Coach.generateTips(Store.state, Store.history, Store.bodyWeights);
  
  const nextDay = Store.getNextDay();
  const nextExercises = Store.getExercises(nextDay);
  
  return el('div', { cls: 'screen' },
    renderModal(),
    
    // Header
    el('div', { cls: 'header' },
      el('h1', null, 'AI COACH'),
      el('div', { cls: 'sub' }, 'Personalized training insights')
    ),
    
    // Start Workout Button
    el('div', { cls: 'card full-width', css: 'margin-bottom:16px;' },
      el('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px' },
        el('div', null,
          el('div', { css: 'font-size:16px;font-weight:800;color:var(--white)' }, nextDay),
          el('div', { css: 'font-size:12px;color:var(--dim);margin-top:2px' }, 
            `${nextExercises.length} exercises • Target: ${Store.getRIR()}`
          )
        ),
        el('button', { 
          cls: 'btn', 
          css: 'padding:12px 24px;',
          onclick: () => startWorkout(nextDay)
        }, 'START WORKOUT')
      )
    ),
    
    // Recovery Score Card
    el('div', { cls: 'card full-width' },
      el('div', { css: 'display:flex;align-items:center;gap:16px;margin-bottom:12px' },
        el('div', { 
          css: `width:70px;height:70px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;font-family:var(--mono);background:conic-gradient(var(--green) ${recovery.score}%, var(--muted) ${recovery.score}%)` 
        },
          el('div', { css: 'width:56px;height:56px;border-radius:50%;background:var(--card);display:flex;align-items:center;justify-content:center' },
            el('span', { css: `color:${recovery.score >= 70 ? 'var(--green)' : recovery.score >= 40 ? 'var(--gold)' : 'var(--accent)'}` }, recovery.score)
          )
        ),
        el('div', null,
          el('div', { css: 'font-size:18px;font-weight:800;color:var(--white)' }, 'Recovery Score'),
          el('div', { css: 'font-size:13px;color:var(--dim);margin-top:2px' }, 
            recovery.score >= 70 ? 'Well recovered - ready to train!' :
            recovery.score >= 40 ? 'Moderate fatigue - monitor closely' :
            'Poor recovery - prioritize rest'
          )
        )
      ),
      recovery.advice ? el('div', { css: 'font-size:13px;color:var(--text);padding:10px;background:var(--input-bg);border-radius:8px;margin-top:8px' }, 
        recovery.advice
      ) : null
    ),
    
    // Key Insights
    insights.insights.length > 0 ? el('div', { cls: 'card full-width' },
      el('div', { cls: 'label', css: 'margin-bottom:12px' }, '📊 Key Insights'),
      ...insights.insights.map(i => 
        el('div', { css: 'display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;padding:10px;background:var(--input-bg);border-radius:8px' },
          el('span', { css: 'font-size:16px' }, i.icon),
          el('div', null,
            el('div', { css: 'font-size:13px;font-weight:600;color:var(--white)' }, i.title),
            el('div', { css: 'font-size:12px;color:var(--dim);margin-top:2px' }, i.message)
          )
        )
      )
    ) : null,
    
    // Warnings
    insights.warnings.length > 0 ? el('div', { cls: 'card full-width accent-border' },
      el('div', { cls: 'label', css: 'margin-bottom:12px;color:var(--accent)' }, '⚠️ Attention Needed'),
      ...insights.warnings.map(w => 
        el('div', { css: 'display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;padding:10px;background:rgba(233,69,96,0.1);border-radius:8px;border-left:3px solid var(--accent)' },
          el('span', { css: 'font-size:16px' }, w.icon || '⚠️'),
          el('div', null,
            el('div', { css: 'font-size:13px;font-weight:600;color:var(--white)' }, w.title),
            el('div', { css: 'font-size:12px;color:var(--dim);margin-top:2px' }, w.message)
          )
        )
      )
    ) : null,
    
    // Plateaus
    insights.plateaus.length > 0 ? el('div', { cls: 'card full-width' },
      el('div', { cls: 'label', css: 'margin-bottom:12px' }, '📉 Detected Plateaus'),
      ...insights.plateaus.map(p => 
        el('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:10px;background:var(--input-bg);border-radius:8px' },
          el('div', null,
            el('div', { css: 'font-size:13px;font-weight:600;color:var(--white)' }, p.exercise),
            el('div', { css: 'font-size:11px;color:var(--dim)' }, `${p.weeksStalled} weeks stalled`)
          ),
          el('div', { css: 'font-size:11px;color:var(--gold);text-align:right;max-width:150px' }, p.suggestion)
        )
      )
    ) : null,
    
    // PR Potential
    insights.prPotential.length > 0 ? el('div', { cls: 'card full-width green-border' },
      el('div', { cls: 'label', css: 'margin-bottom:12px;color:var(--green)' }, '🔥 PR Potential'),
      ...insights.prPotential.map(pr => 
        el('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:10px;background:rgba(34,197,94,0.1);border-radius:8px' },
          el('div', null,
            el('div', { css: 'font-size:13px;font-weight:600;color:var(--white)' }, pr.exercise),
            el('div', { css: 'font-size:11px;color:var(--dim)' }, `Current: ${pr.currentWeight}`)
          ),
          el('div', { css: 'font-size:13px;font-weight:700;color:var(--green)' }, `Target: ${pr.targetWeight}`)
        )
      )
    ) : null,
    
    // Recommendations
    insights.recommendations.length > 0 ? el('div', { cls: 'card full-width' },
      el('div', { cls: 'label', css: 'margin-bottom:12px' }, '💡 Recommendations'),
      ...insights.recommendations.map((r, i) => 
        el('div', { css: 'display:flex;gap:10px;align-items:flex-start;margin-bottom:10px' },
          el('span', { css: 'font-size:13px;font-weight:700;color:var(--accent);min-width:20px' }, `${i + 1}.`),
          el('div', { css: 'font-size:13px;color:var(--text);line-height:1.5' }, r)
        )
      )
    ) : null,
    
    // Tips
    tips.length > 0 ? el('div', { cls: 'card full-width' },
      el('div', { cls: 'label', css: 'margin-bottom:12px' }, '🎯 Quick Tips'),
      ...tips.slice(0, 5).map(tip => 
        el('div', { css: 'display:flex;gap:10px;align-items:center;margin-bottom:8px;padding:8px 12px;background:var(--input-bg);border-radius:6px' },
          el('span', { css: 'font-size:14px' }, tip.icon),
          el('span', { css: 'font-size:12px;color:var(--text)' }, tip.message)
        )
      )
    ) : null,
    
    // Ask AI Section
    el('div', { cls: 'card full-width' },
      el('div', { cls: 'label', css: 'margin-bottom:12px' }, '🤔 Ask AI Coach'),
      el('div', { css: 'display:flex;gap:8px;margin-bottom:12px' },
        el('input', { 
          type: 'text',
          id: 'coach-question',
          placeholder: 'e.g., Should I deload? Why am I stalling?',
          css: 'flex:1;background:var(--input-bg);border:1px solid var(--muted);border-radius:8px;padding:12px;color:var(--white);font-size:14px;outline:none;',
          onkeydown: (e) => {
            if (e.key === 'Enter') askCoach();
          }
        }),
        el('button', { 
          cls: 'btn',
          css: 'padding:12px 20px;',
          onclick: askCoach
        }, 'Ask')
      ),
      el('div', { id: 'coach-answer', css: 'font-size:13px;color:var(--text);line-height:1.6;padding:12px;background:var(--input-bg);border-radius:8px;display:none;min-height:60px;' })
    ),
    
    // Deload Warning
    insights.deloadSuggested ? el('div', { 
      cls: 'card full-width',
      css: 'background:rgba(233,69,96,0.15);border-color:var(--accent);text-align:center;padding:20px' 
    },
      el('div', { css: 'font-size:24px;margin-bottom:8px' }, '🛑'),
      el('div', { css: 'font-size:16px;font-weight:800;color:var(--white);margin-bottom:8px' }, 'Deload Recommended'),
      el('div', { css: 'font-size:13px;color:var(--dim);margin-bottom:12px' }, 
        insights.deloadReasons?.join('. ') || 'Your fatigue levels suggest you need a recovery week.'
      ),
      el('button', { 
        cls: 'btn',
        css: 'background:var(--accent);max-width:200px;',
        onclick: () => {
          modal = {
            title: 'Start Deload Week?',
            message: 'This will set your mesoWeek to 4 (deload) and reduce volume by 40%.',
            onConfirm: async () => {
              const newState = { 
                ...Store.state, 
                phase: 'ppl',
                mesoWeek: 4,
                fatigueFlags: 0 
              };
              await Store.set('state', newState);
              modal = null;
              render();
            }
          };
          render();
        }
      }, 'Start Deload')
    ) : null,
    
    renderNav()
  );
}

/**
 * Ask the coach a question and display the answer
 * Uses AI API if available, falls back to rule-based coach
 */
async function askCoach() {
  const input = document.getElementById('coach-question');
  const answerEl = document.getElementById('coach-answer');
  const question = input.value.trim();
  
  if (!question) return;
  
  // Show loading state
  answerEl.style.display = 'block';
  answerEl.innerHTML = `<div style="display:flex;align-items:center;gap:10px;color:var(--dim)"><div class="spinner-small"></div>Thinking...</div>`;
  
  try {
    // Try AI API first
    const result = await AICoachAPI.getAdvice(question);
    
    const badge = result.fallback 
      ? '<span style="font-size:11px;background:var(--muted);padding:2px 8px;border-radius:4px;margin-left:8px;">Offline Mode</span>'
      : '<span style="font-size:11px;background:var(--green);padding:2px 8px;border-radius:4px;margin-left:8px;">AI Powered</span>';
    
    answerEl.innerHTML = `
      <strong style="color:var(--accent)">Q:</strong> ${question}${badge}<br><br>
      <strong style="color:var(--green)">A:</strong> ${result.advice}
    `;
    
  } catch (error) {
    // Fallback to local coach
    const context = {
      state: Store.state,
      history: Store.history,
      bodyWeights: Store.bodyWeights
    };
    const answer = Coach.answerQuestion(question, context);
    
    answerEl.innerHTML = `
      <strong style="color:var(--accent)">Q:</strong> ${question}
      <span style="font-size:11px;background:var(--muted);padding:2px 8px;border-radius:4px;margin-left:8px;">Offline Mode</span><br><br>
      <strong style="color:var(--green)">A:</strong> ${answer}
    `;
  }
  
  input.value = '';
}

// Make available globally
window.renderCoach = renderCoach;
