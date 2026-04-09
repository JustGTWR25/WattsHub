# WattsHub

Family chore and reward tracker. Built with React + Vite + Firebase Realtime Database.

---

## First-time setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Firebase

You need a Firebase project with **Realtime Database** enabled.

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a project (or use your existing one)
3. Go to **Project Settings → Your apps → Add app → Web**
4. Copy the config object values
5. In Firebase Console, go to **Realtime Database → Create database**
   - Start in **test mode** (you'll add proper rules later)
   - Choose a location close to you (us-central1 is fine)

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your Firebase values:

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

> **.env.local is git-ignored.** Never commit real API keys to git.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Deploying to Netlify

### Option A: Netlify CLI (fastest)

```bash
npm install -g netlify-cli
netlify login
netlify init          # connect to your Netlify account
netlify deploy --prod # deploy to production
```

### Option B: GitHub → Netlify (recommended for continuous deployment)

1. Push this repo to GitHub
2. Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Import from Git**
3. Select your repo
4. Build settings are auto-detected from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. **Add environment variables** in Netlify before deploying:
   - Go to **Site → Environment variables → Add variable**
   - Add all 7 `VITE_FIREBASE_*` variables from your `.env.local`
6. Click **Deploy site**

After the first deploy, every push to `main` auto-deploys.

### Adding to iPhone home screen (PWA)

On each family member's iPhone:
1. Open the Netlify URL in **Safari** (must be Safari, not Chrome)
2. Tap the **Share** button (box with arrow)
3. Tap **Add to Home Screen**
4. Tap **Add**

The app opens fullscreen like a native app with no browser chrome.

---

## Firebase Security Rules

**Before real family use**, replace test mode rules with these in
Firebase Console → Realtime Database → Rules:

```json
{
  "rules": {
    "wh": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

This locks the database to authenticated users only.
Full role-based rules (parents vs kids) come in Phase 2 with Firebase Auth.

---

## Project structure

```
wattshub/
├── index.html              # Entry point
├── vite.config.js          # Vite config
├── package.json
├── netlify.toml            # Build + routing + security headers
├── .env.example            # Template — safe to commit
├── .env.local              # Real keys — NEVER commit
├── .gitignore
├── public/
│   ├── manifest.json       # PWA manifest (Add to Home Screen)
│   └── icons/
│       ├── icon-192.svg    # App icon (replace with PNG for best iOS support)
│       └── icon-512.svg
└── src/
    ├── main.jsx            # React entry point
    ├── firebase.js         # Firebase init + typed helpers
    └── App.jsx             # Main app component
```

---

## Development workflow

```bash
npm run dev      # Start dev server with hot reload
npm run build    # Production build → dist/
npm run preview  # Preview production build locally
```

---

## Environment variables reference

| Variable | Where to find it |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Console → Project Settings → Web app config |
| `VITE_FIREBASE_AUTH_DOMAIN` | Same |
| `VITE_FIREBASE_DATABASE_URL` | Realtime Database → Data tab (the URL at the top) |
| `VITE_FIREBASE_PROJECT_ID` | Same |
| `VITE_FIREBASE_STORAGE_BUCKET` | Same |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Same |
| `VITE_FIREBASE_APP_ID` | Same |

---

## What's next (Phase 2)

- [ ] Parent PIN protection on mode switch
- [ ] Profile picker on app launch
- [ ] Firebase Authentication (Google sign-in)
- [ ] Push notifications via FCM
- [ ] Photo proof for task submission
- [ ] Edit / delete chores
- [ ] Onboarding flow for first launch
- [ ] Quests and badge system
