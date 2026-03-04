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

## 3. Set Environment Variable

### Option A: Firebase Console (Easiest)

1. Go to https://console.firebase.google.com
2. Select your project
3. Go to **Build** → **Functions**
4. Click **Environment Variables** tab
5. Click **Add Variable**
   - Name: `KIMI_API_KEY`
   - Value: `sk-your-actual-key-here`
6. Click **Save**

### Option B: CLI (if available)

```bash
firebase functions:secrets:set KIMI_API_KEY
# Enter your key when prompted
```

## 4. Deploy Functions

```bash
firebase deploy --only functions
```

## 5. Verify Deployment

```bash
# Check function health in Firebase Console:
# https://console.firebase.google.com/project/_/functions

# Or check the logs:
firebase functions:log
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

- API key stored in Firebase Environment Variables (server-side only)
- Functions require Firebase Authentication
- Rate limiting per user
- No API key in client-side code

## Troubleshooting

### "KIMI_API_KEY environment variable not set"
Go to Firebase Console → Functions → Environment Variables and add `KIMI_API_KEY`

### "Permission denied"
Make sure you're logged in: `firebase login`

### Functions not deploying
Check Node version: `node -v` (should be 18+)

### Environment variable not found after setting
Redeploy the functions after setting environment variables.

## Updating the API Key

1. Go to Firebase Console → Functions → Environment Variables
2. Delete the old `KIMI_API_KEY`
3. Add new one with updated value
4. Redeploy functions: `firebase deploy --only functions`
