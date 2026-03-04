# Firebase Functions Setup

## Prerequisites

```bash
npm install -g firebase-tools
firebase login
```

## 1. Install Dependencies

```bash
cd functions
npm install
```

## 2. Get Kimi API Key

1. Go to https://platform.moonshot.cn
2. Create an account
3. Generate an API key
4. Copy the key (starts with `sk-`)

## 3. Configure API Key (CRITICAL - Never commit this!)

```bash
# From the project root directory
firebase functions:config:set kimi.key="YOUR_KIMI_API_KEY_HERE"
```

**NEVER** put the API key in your code or GitHub!

## 4. Deploy Functions

```bash
firebase deploy --only functions
```

## 5. Verify Deployment

```bash
# Check function health
curl -X POST https://YOUR_REGION-YOUR_PROJECT_ID.cloudfunctions.net/healthCheck \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Functions Available

### getCoachingAdvice
Main AI coach function. Accepts:
- `workouts`: Array of recent workouts
- `bodyWeights`: Array of body weight entries
- `measurements`: Array of measurements
- `question`: User's question string
- `program`: Current program name

Returns:
- `advice`: AI-generated response
- `tokensUsed`: Number of tokens consumed
- `fallback`: True if using local coach (API failed)

### getWorkoutAnalysis
Generates weekly/monthly analysis report.

### healthCheck
Returns API status.

## Rate Limiting

- 50 requests per hour per user
- Old rate limit entries auto-cleaned

## Cost Estimation

Kimi API pricing (as of 2024):
- Kimi-lite: ¥1 per 1M tokens (~$0.14 USD)
- Kimi-pro: ¥12 per 1M tokens (~$1.70 USD)

Typical coaching question: 100-300 tokens
Cost per question: ¥0.01-0.03 (~$0.0015-0.004 USD)

## Security

- API key stored in Firebase Functions config (server-side only)
- Functions require Firebase Authentication
- Rate limiting per user
- No API key in client-side code

## Troubleshooting

### "Kimi API key not configured"
Run: `firebase functions:config:set kimi.key="YOUR_KEY"`

### "Permission denied"
Make sure you're logged in: `firebase login`

### Functions not deploying
Check Node version: `node -v` (should be 18+)

## Local Testing (Optional)

```bash
# Emulate functions locally
firebase emulators:start --only functions

# In another terminal, test:
curl http://localhost:5001/YOUR_PROJECT/us-central1/getCoachingAdvice \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"data":{"question":"Should I deload?","workouts":[]}}'
```
