/**
 * AI Coach API Client
 * Connects to Firebase Functions for advanced AI coaching
 */

const AICoachAPI = {
  // Check if Firebase Functions is available
  isAvailable() {
    return typeof firebase !== 'undefined' && firebase.functions;
  },

  /**
   * Get AI coaching advice
   * @param {string} question - User's question
   * @returns {Promise<{advice: string, tokensUsed: number, fallback: boolean}>}
   */
  async getAdvice(question) {
    if (!this.isAvailable()) {
      console.warn('Firebase Functions not available');
      return this.getLocalAdvice(question);
    }

    try {
      const getCoachingAdvice = firebase.functions().httpsCallable('getCoachingAdvice');
      
      const result = await getCoachingAdvice({
        workouts: Store.history.slice(0, 15),
        bodyWeights: Store.bodyWeights.slice(-21),
        measurements: Store.measurements.slice(-10),
        question: question,
        program: Store.state?.program || 'standard'
      });

      return {
        advice: result.data.advice,
        tokensUsed: result.data.tokensUsed,
        fallback: result.data.fallback || false
      };

    } catch (error) {
      console.error('AI Coach API error:', error);
      // Fallback to local coach
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
    if (!this.isAvailable()) {
      return { status: 'unavailable', kimi: 'not_configured' };
    }

    try {
      const healthCheck = firebase.functions().httpsCallable('healthCheck');
      const result = await healthCheck({});
      return result.data;
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
