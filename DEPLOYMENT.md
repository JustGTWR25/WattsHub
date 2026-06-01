# WattsHub — Summer Integration Batch Deployment
## Complete guide · June 2026

This is a single batch update. Deploy everything together in the order below.

---

## Files in this package

| File | Destination in your repo | What changed |
|------|--------------------------|--------------|
| `App.jsx` | `src/App.jsx` | Full rebuild with summer nav, kid mode tab, summer listeners, all existing features intact |
| `src/components/summer/SummerModule.jsx` | `src/components/summer/SummerModule.jsx` | New — full summer UI |
| `src/components/summer/summerConfig.js` | `src/components/summer/summerConfig.js` | New — config constants |
| `summer_functions_v2.js` | Append to `functions/index.js` | New cloud functions + schedule fix |
| `database.rules.json` | Project root `database.rules.json` | Adds summer + session + reports nodes |

---

## Step 1 — Confirm your Firebase field names (5 min)

Open Firebase Console → Realtime Database → `wh/kids/` → click any kid node.

Look for two fields:
- **XP field**: probably `xp` ✓ (already confirmed)
- **Dollar/balance field**: could be `balanceCents`, `allowance`, or `dollars`

If your dollar field is **not** `balanceCents`, update these two places before deploying:

**File 1 — `src/components/summer/summerConfig.js`:**
```js
DOLLARS_FIELD: 'balanceCents',  // ← change this
```

**File 2 — `functions/index.js` (the new section):**
```js
DOLLARS_FIELD: 'balanceCents',  // ← change this too
```

---

## Step 2 — Add the new component files to your repo

Create the directory if it doesn't exist:
```
src/components/summer/
```

Place these two files in it:
- `SummerModule.jsx`
- `summerConfig.js`

---

## Step 3 — Replace App.jsx

Replace `src/App.jsx` entirely with the new `App.jsx` from this package.

**What's new vs your current App.jsx:**
- ☀️ Summer nav item added to sidebar and mobile bottom nav
- Summer view wired into content router
- Kid mode gets a Summer tab (alongside Tasks/Store/Money)
- `KidSummerCard` appears in kid mode — daily session logging lives here
- `SummerNavBadge` shows live streak count next to Summer nav item
- Three new Firebase listeners: `summerProgram/kids`, `reports/weekly`, `reports/monthly`
- Summer mini-stats (sessions/XP/streak) now appear on each kid's dashboard card
- All existing features (chores, store, money, activity, focus timer, PIN, devices) are intact

---

## Step 4 — Update Cloud Functions

Open `functions/index.js`. Paste the entire contents of `summer_functions_v2.js`
at the **bottom** of the file, below all existing functions.

**Key changes:**
- `generateWeeklySummary` schedule changed from Sunday 9 PM → **Friday 8 PM CT**
  so reports are ready before your Sunday family check-in
- `generateWeeklyReport` is now also an HTTP callable (powers the "Generate Now" button)
- `completeSummerSession` callable added as a server-side fallback
  (SummerModule.jsx writes directly to Firebase by default — this is a backup)

Then deploy only the new functions:
```bash
firebase deploy --only functions:completeSummerSession,generateWeeklySummary,generateWeeklyReport,generateMonthlySummary
```

---

## Step 5 — Update Firebase security rules

Replace your `database.rules.json` with the one in this package.

Deploy:
```bash
firebase deploy --only database
```

New nodes covered:
- `wh/summerProgram/config` — read: any allowed UID, write: admin only
- `wh/summerProgram/kids/{kidId}` — read/write: any allowed UID
- `wh/summerSessions/{kidId}` — read/write: any allowed UID
- `wh/reports/*` — read/write: any allowed UID

---

## Step 6 — Seed the summer program config

In Firebase Console → Realtime Database, navigate to `wh/` and add the
`summerProgram/config` node manually, or use the Import JSON option.

Copy this JSON into the Firebase console at path `wh/summerProgram`:

```json
{
  "config": {
    "startDate": "2026-06-09",
    "endDate": "2026-08-15",
    "dailyXP": 10,
    "streakBonusThreshold": 5,
    "streakBonusMultiplier": 1.5,
    "daysPerWeek": 4,
    "sessionMinutes": 60,
    "active": true
  },
  "kids": {
    "REPLACE_TAYONNA_UID": {
      "displayName": "Tayonna",
      "grade": "12",
      "totalXPEarned": 0,
      "totalSessionsCompleted": 0,
      "currentStreak": 0,
      "longestStreak": 0,
      "lastSessionDate": null
    },
    "REPLACE_BRIANNA_UID": {
      "displayName": "Brianna",
      "grade": "9",
      "totalXPEarned": 0,
      "totalSessionsCompleted": 0,
      "currentStreak": 0,
      "longestStreak": 0,
      "lastSessionDate": null
    },
    "REPLACE_LEON_UID": {
      "displayName": "Leon",
      "grade": "5",
      "totalXPEarned": 0,
      "totalSessionsCompleted": 0,
      "currentStreak": 0,
      "longestStreak": 0,
      "lastSessionDate": null
    }
  }
}
```

Replace `REPLACE_TAYONNA_UID`, `REPLACE_BRIANNA_UID`, `REPLACE_LEON_UID` with
the actual Firebase push keys from `wh/kids/`.

---

## Step 7 — Deploy the app (Vercel)

```bash
git add .
git commit -m "feat: summer program integration — session logging, reports, kid mode tab"
git push
```

Vercel auto-deploys on push. Build takes ~60 seconds.

---

## Step 8 — Smoke test checklist

After deploy, open WattsHub and verify each of these:

**Parent mode:**
- [ ] ☀️ Summer nav item appears in sidebar
- [ ] Summer overview cards show Tayonna, Brianna, Leon with zeroed stats
- [ ] Weekly tab → "Generate Now" button works, creates a report entry
- [ ] Monthly tab loads without errors
- [ ] Dashboard kid cards show summer mini-stats chips
- [ ] PDF export (print) works from Summer view

**Kid mode (log in as Tayonna):**
- [ ] Summer tab appears in bottom tab bar
- [ ] `KidSummerCard` appears in Tasks tab above chore list
- [ ] "Session Complete" button is visible and tappable (min 52px height)
- [ ] Completing a session shows XP gained and updates streak
- [ ] Completing a session writes to Firebase: `wh/summerProgram/kids/{id}` and `wh/kids/{id}/xp`
- [ ] Streak alert appears when streak ≥ 3 (bonus pending) or ≥ 5 (bonus active)

**Mobile (≤680px):**
- [ ] Summer icon appears in bottom nav
- [ ] Session complete button is at least 52px tall and easy to tap
- [ ] No layout overflow on iPhone-sized viewport

---

## What each kid sees

When a kid opens the app and picks their profile:

1. Their **Tasks** tab shows a summer session card at the top with:
   - Today's focus (Math or Literacy, based on day of week)
   - Current streak + XP counter
   - "Session Complete" button (52px, prominent)
   - Streak bonus alert when they're close to or past 5 days

2. Their **Summer** tab shows just the session card (full focus mode)

3. The session card is hidden on weekends and non-program days automatically

## What you (parent) see

- **Dashboard** — each kid card now shows summer sessions, XP earned, and streak
- **Summer → Overview** — season stats per kid, attendance bars
- **Summer → Weekly** — week-by-week breakdown, generate any week on demand
- **Summer → Monthly** — auto-generates on the 1st; shows week breakdown
- **PDF export** — browser print from any report view

---

## Schedule reference

| Trigger | When | Notes |
|---------|------|-------|
| Weekly report auto-generate | **Friday 8 PM CT** | Ready for Sunday check-in |
| Monthly report auto-generate | 1st of month, 8 AM CT | Covers prior month |
| In-app "Generate Now" | Any time | Generates current week |

---

## XP math reference

| Scenario | XP | Cents earned |
|----------|----|-------------|
| Normal session | 10 | 50¢ |
| 5+ day streak session | 15 | 75¢ |
| Perfect 4-day week, no streak | 40 | $2.00 |
| Perfect 4-day week, streak active | 60 | $3.00 |

---

## Troubleshooting

**"Session already logged today" error:**
The duplicate check works by date string (`YYYY-MM-DD`). If you're testing and need to reset, delete the session from `wh/summerSessions/{kidId}` in the Firebase console.

**XP not writing to main kid node:**
Confirm `DOLLARS_FIELD` matches your actual Firebase field. Check `wh/kids/{id}` in the console and look for the balance field name.

**Summer nav not appearing:**
Make sure the import at the top of `App.jsx` resolves correctly:
```js
import { SummerView, KidSummerCard, SummerNavBadge } from './components/summer/SummerModule';
```
The file must be at `src/components/summer/SummerModule.jsx`.

**Cloud Functions failing:**
Check Firebase Console → Functions → Logs. The most common cause is a missing `firebase-admin` initialization in `functions/index.js`. Make sure `admin.initializeApp()` is called once at the top of your functions file, before any of the new exports.
