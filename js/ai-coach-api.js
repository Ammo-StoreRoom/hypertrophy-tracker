/**
 * AI Coach API Client
 * Connects to VPS proxy server for Kimi API
 */

// VPS Proxy Server Endpoint
const API_BASE = 'http://107.20.186.71:3000';

const AICoachAPI = {
  // Check if API is available
  isAvailable() {
    return true; // Always try the VPS endpoint
  },

  /**
   * Get AI coaching advice
   * @param {string} question - User's question
   * @returns {Promise<{advice: string, tokensUsed: number, fallback: boolean}>}
   */
  async getAdvice(question) {
    try {
      const response = await fetch(`${API_BASE}/coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workouts: Store.history.slice(0, 15),
          bodyWeights: Store.bodyWeights.slice(-21),
          measurements: Store.measurements.slice(-10),
          question: question,
          program: Store.state?.program || 'standard'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        advice: data.advice,
        tokensUsed: data.tokensUsed || 0,
        fallback: data.fallback || false
      };

    } catch (error) {
      console.error('AI Coach API error:', error);
      return this.getLocalAdvice(question);
    }
  },

  /**
   * Get local (rule-based) advice as fallback
   * @param {string} question 
   * @returns {Promise<{advice: string, fallback: true}>}
   */
  async getLocalAdvice(question) {
    const context = {
      state: Store.state,
      history: Store.history,
      bodyWeights: Store.bodyWeights
    };
    
    const answer = Coach.answerQuestion(question, context);
    
    return {
      advice: answer,
      tokensUsed: 0,
      fallback: true
    };
  },

  /**
   * Get workout analysis report
   * @param {string} period - 'week' or 'month'
   * @returns {Promise<{analysis: string}>}
   */
  async getAnalysis(period = 'week') {
    if (!this.isAvailable()) {
      throw new Error('Firebase Functions not available');
    }

    const cutoff = period === 'week' 
      ? Date.now() - (7 * 24 * 60 * 60 * 1000)
      : Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    const recentWorkouts = Store.history.filter(w => 
      new Date(w.date).getTime() > cutoff
    );

    try {
      const getWorkoutAnalysis = firebase.functions().httpsCallable('getWorkoutAnalysis');
      
      const result = await getWorkoutAnalysis({
        workouts: recentWorkouts,
        period: period
      });

      return {
        analysis: result.data.analysis,
        period: result.data.period
      };

    } catch (error) {
      console.error('Analysis API error:', error);
      throw error;
    }
  },

  /**
   * Check API health status
   * @returns {Promise<{status: string}>}
   */
  async checkHealth() {
    try {
      const response = await fetch(`${API_BASE}/health`);
      const data = await response.json();
      return data;
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  },

  /**
   * Stream advice (for longer responses)
   * Note: Firebase Functions doesn't support true streaming, 
   * but we can simulate with chunked responses if needed
   */
  async getAdviceStream(question, onChunk) {
    // For now, just return full response
    // True streaming would require a different architecture
    const result = await this.getAdvice(question);
    onChunk?.(result.advice);
    return result;
  }
};

// Make available globally
window.AICoachAPI = AICoachAPI;
