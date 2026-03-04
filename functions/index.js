/**
 * Firebase Functions for Hypertrophy Tracker
 * Provides secure AI coaching via Kimi API
 * 
 * Environment Variables (set via Firebase Console):
 * - KIMI_API_KEY: Your Kimi API key
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const OpenAI = require('openai');

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Kimi client using environment variables
// Set this in Firebase Console: Functions > Environment Variables
const getKimiClient = () => {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) {
    throw new Error('KIMI_API_KEY environment variable not set. Add it in Firebase Console > Functions > Environment Variables');
  }
  
  return new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.moonshot.cn/v1'
  });
};

/**
 * Get AI coaching advice
 * Callable function - requires authentication
 */
exports.getCoachingAdvice = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be logged in to use the AI coach.'
    );
  }

  const { workouts, bodyWeights, measurements, question, program } = data;
  
  // Rate limiting - check user's recent calls
  const userId = context.auth.uid;
  const db = admin.database();
  const rateLimitRef = db.ref(`rateLimits/${userId}`);
  
  try {
    const now = Date.now();
    const snapshot = await rateLimitRef.once('value');
    const calls = snapshot.val() || {};
    
    // Count calls in last hour
    const oneHourAgo = now - (60 * 60 * 1000);
    const recentCalls = Object.values(calls).filter(t => t > oneHourAgo).length;
    
    if (recentCalls > 50) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Rate limit exceeded. Max 50 questions per hour.'
      );
    }
    
    // Record this call
    await rateLimitRef.child(Date.now().toString()).set(now);
    
    // Clean up old entries
    const oldEntries = Object.keys(calls).filter(k => calls[k] < oneHourAgo);
    for (const key of oldEntries) {
      await rateLimitRef.child(key).remove();
    }
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Continue even if rate limiting fails
  }

  try {
    const kimi = getKimiClient();
    
    // Build context from user data
    const contextData = {
      recentWorkouts: workouts?.slice(0, 10) || [],
      bodyWeightTrend: bodyWeights?.slice(-14) || [],
      measurements: measurements?.slice(-5) || [],
      currentProgram: program || 'Unknown',
      totalWorkouts: workouts?.length || 0
    };

    const response = await kimi.chat.completions.create({
      model: 'kimi-lite',  // Cheaper option: ¥1 per 1M tokens
      messages: [
        {
          role: 'system',
          content: `You are an expert hypertrophy training coach with deep knowledge of:
- Progressive overload principles
- Periodization and deload strategies
- Recovery and sleep optimization
- Exercise selection and form
- Nutrition for muscle growth

User's training context:
${JSON.stringify(contextData, null, 2)}

Provide concise, actionable advice (2-3 sentences max). Be encouraging but honest about issues. Use specific numbers from their data when relevant.`
        },
        {
          role: 'user',
          content: question
        }
      ],
      temperature: 0.7,
      max_tokens: 300
    });

    const advice = response.choices[0].message.content;
    const tokensUsed = response.usage?.total_tokens || 0;

    // Log usage for monitoring
    console.log(`Coach API call: User ${userId}, Tokens: ${tokensUsed}, Question: "${question.substring(0, 50)}..."`);

    return {
      advice,
      tokensUsed,
      cached: false
    };

  } catch (error) {
    console.error('Kimi API error:', error);
    
    // Fallback to rule-based response if API fails
    return {
      advice: getFallbackResponse(question, contextData),
      tokensUsed: 0,
      cached: false,
      fallback: true
    };
  }
});

/**
 * Get workout analysis report
 * Callable function - generates weekly/monthly analysis
 */
exports.getWorkoutAnalysis = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required');
  }

  const { workouts, period = 'week' } = data;
  
  try {
    const kimi = getKimiClient();
    
    const response = await kimi.chat.completions.create({
      model: 'kimi-lite',
      messages: [
        {
          role: 'system',
          content: 'Analyze this workout data and provide insights on volume trends, exercise balance, and recommendations. Keep it brief (3-4 bullet points).'
        },
        {
          role: 'user',
          content: `Analyze my ${period} of training:\n${JSON.stringify(workouts, null, 2)}`
        }
      ],
      temperature: 0.5,
      max_tokens: 400
    });

    return {
      analysis: response.choices[0].message.content,
      period
    };

  } catch (error) {
    console.error('Analysis API error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to generate analysis');
  }
});

/**
 * Fallback responses when API is unavailable
 */
function getFallbackResponse(question, context) {
  const q = question.toLowerCase();
  
  if (q.includes('deload')) {
    return "Based on your data, if you've been training hard for 4+ weeks without a break, consider a deload week with 40% volume reduction. Listen to your body!";
  }
  if (q.includes('volume')) {
    return `You've logged ${context.totalWorkouts} workouts. Focus on gradual volume increases of 5-10% per week rather than big jumps.`;
  }
  if (q.includes('sleep') || q.includes('recovery')) {
    return "Sleep is crucial for hypertrophy. Aim for 7-9 hours. Poor sleep = poor gains. Consider tracking sleep consistency.";
  }
  if (q.includes('plateau')) {
    return "Plateaus happen! Try: 1) Adding 1-2 sets per exercise, 2) Changing rep ranges, 3) Improving exercise execution, or 4) Taking a deload.";
  }
  if (q.includes('progress')) {
    return "Progressive overload is key - aim to add weight or reps weekly. If stuck for 3+ weeks, consider program changes.";
  }
  
  return "I'm currently experiencing connectivity issues. Please try again in a moment, or check your training data for trends.";
}

/**
 * Health check function
 * Returns API status
 */
exports.healthCheck = functions.https.onCall(async (data, context) => {
  try {
    const kimi = getKimiClient();
    // Make a minimal API call to verify connectivity
    await kimi.models.list();
    return { status: 'healthy', kimi: 'connected' };
  } catch (error) {
    return { status: 'degraded', kimi: 'disconnected', error: error.message };
  }
});
