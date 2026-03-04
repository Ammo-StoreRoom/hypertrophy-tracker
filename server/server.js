/**
 * Hypertrophy Tracker - AI Coach Proxy Server
 * Securely proxies requests to Kimi API
 * 
 * Environment Variables:
 * - KIMI_API_KEY: Your Kimi API key
 * - PORT: Server port (default: 3000)
 * - ALLOWED_ORIGINS: Comma-separated list of allowed origins
 */

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());

// CORS - Allow your GitHub Pages domain
// CORS - Allow all origins (GitHub Pages requires this)
app.use(cors({
  origin: '*',
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting - 50 requests per hour per IP
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: { error: 'Too many requests, please try again later.' }
});

app.use('/coach', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    kimiConfigured: !!process.env.KIMI_API_KEY
  });
});

// Main coaching endpoint
app.post('/coach', async (req, res) => {
  try {
    const { workouts, bodyWeights, measurements, question, program } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }
    
    if (!process.env.KIMI_API_KEY) {
      return res.status(500).json({ error: 'Kimi API key not configured' });
    }

    const contextData = {
      recentWorkouts: workouts?.slice(0, 10) || [],
      bodyWeightTrend: bodyWeights?.slice(-14) || [],
      measurements: measurements?.slice(-5) || [],
      currentProgram: program || 'Unknown',
      totalWorkouts: workouts?.length || 0
    };

    const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.KIMI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'kimi-lite',
        messages: [
          {
            role: 'system',
            content: `You are an expert hypertrophy training coach. User data: ${JSON.stringify(contextData)}. Provide concise, actionable advice (2-3 sentences).`
          },
          { role: 'user', content: question }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    });

    if (!response.ok) {
      throw new Error('Kimi API request failed');
    }

    const data = await response.json();
    
    res.json({
      advice: data.choices[0].message.content,
      tokensUsed: data.usage?.total_tokens || 0,
      fallback: false
    });

  } catch (error) {
    console.error('Error:', error);
    res.json({
      advice: getFallbackResponse(req.body.question),
      tokensUsed: 0,
      fallback: true
    });
  }
});

function getFallbackResponse(question) {
  const q = question.toLowerCase();
  if (q.includes('deload')) return "Consider a deload week after 4+ hard weeks. Reduce volume by 40%.";
  if (q.includes('volume')) return "Gradual volume increases of 5-10% per week work best.";
  if (q.includes('sleep')) return "Aim for 7-9 hours sleep. It's crucial for recovery and gains.";
  if (q.includes('plateau')) return "Try adding sets, changing rep ranges, or improving exercise execution.";
  return "I'm experiencing connectivity issues. Please try again later.";
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Coach proxy server running on port ${PORT}`);
});
