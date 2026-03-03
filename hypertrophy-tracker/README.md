# Hypertrophy Tracker

A Progressive Web App for tracking your 6-day Push/Pull/Legs hypertrophy program with cloud sync across devices.

## Quick Setup (5 minutes)

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" → name it `hypertrophy-tracker`
3. Disable Google Analytics → Create project

### Step 2: Set Up Realtime Database
1. Go to Build → Realtime Database → Create Database
2. Choose your region → Start in test mode → Enable

### Step 3: Add Security Rules
In Realtime Database → Rules tab, paste:
```json
{
  "rules": {
    "users": {
      "$pin": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

### Step 4: Get Your Firebase Config
1. Gear icon → Project settings → Your apps → Web icon
2. Register app → Copy the firebaseConfig values

### Step 5: Add Your Config
Open `js/firebase-config.js` and replace placeholder values.

### Step 6: Deploy to GitHub Pages
```bash
git init && git add . && git commit -m "deploy"
git remote add origin https://github.com/YOU/hypertrophy-tracker.git
git push -u origin main
```
Then: Settings → Pages → Deploy from main branch.

### Step 7: Install on Phone
Open URL in Chrome → menu → "Add to Home Screen"

## Usage
1. Enter birthday as MMDDYYYY
2. Start logging workouts
3. Data syncs across all devices using same PIN
