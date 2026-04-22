# WattsHub Batch 1 — Deployment Checklist

This batch delivers three things in one code drop:

1. **Firebase Anonymous Auth + allowlist** (satisfies the security rules deadline)
2. **Per-chore reminders** (time-based push notifications)
3. **Focus timer** (Pomodoro with optional XP bonus, per-kid configurable)

## Files in this drop

| File | Goes to |
| --- | --- |
| `App.jsx` | `src/App.jsx` (replaces existing) |
| `firebase.js` | `src/firebase.js` (replaces existing) |
| `firebase-messaging-sw.js` | `public/firebase-messaging-sw.js` (replaces existing) |
| `functions/index.js` | `functions/index.js` (replaces existing) |
| `functions/package.json` | `functions/package.json` (replaces existing — upgrades Node from 18 → 20) |
| `database.rules.json` | Project root, then deploy via Firebase CLI |

---

## Deployment order (critical — follow exactly)

### Step 1 — Enable Anonymous Auth in Firebase

Console → Authentication → Sign-in method → Anonymous → **Enable**.

Skipping this step means sign-in fails and nobody can use the app.

### Step 2 — Deploy the app code (Vercel)

1. Replace the files listed above in your repo.
2. Commit and push.
3. Vercel will auto-deploy.
4. Open WattsHub. You'll see the Auth Gate screen — it will sign you in anonymously and display your device UID.
5. **Copy your UID** from the screen (it's selectable).

### Step 3 — Bootstrap your first admin UID

Firebase Console → Realtime Database → Data tab.

Manually create this structure (click the `+` next to root):

```
wh/
  allowedUids/
    <YOUR_COPIED_UID>/
      uid: "<YOUR_COPIED_UID>"
      label: "Greg's main device"
      role: "admin"
      approvedAt: 1745345000000  (any timestamp; value doesn't matter)
```

Use the "Import JSON" feature if easier — paste:

```json
{
  "YOUR_UID_HERE": {
    "uid": "YOUR_UID_HERE",
    "label": "Greg's main device",
    "role": "admin",
    "approvedAt": 1745345000000
  }
}
```

at path `wh/allowedUids`.

### Step 4 — Deploy the security rules

From your repo root:

```bash
firebase deploy --only database
```

If you don't already have `firebase.json` configured for rules, add this:

```json
{
  "database": { "rules": "database.rules.json" }
}
```

**From this point, the Firebase 30-day timer is satisfied. The nag email stops.**

### Step 5 — Deploy Cloud Functions

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

First deploy will prompt you to enable billing (Blaze plan) if you haven't — required for Cloud Functions, but usage will sit in the free tier.

### Step 6 — Verify

1. Refresh WattsHub in your browser. You should land on the profile picker (not the auth gate).
2. Open parent mode → Devices. You should see your own device in the approved list with "admin" badge and a blue "This device" tag.
3. Open a second browser / incognito tab and go to WattsHub. You should see the Auth Gate with "Request access." Submit a request.
4. Back in parent mode → Devices. The pending request should appear. Approve it.
5. The second tab can now be refreshed and will enter the app.

---

## Testing the three features

### Test 1 — Auth works

- Incognito window should show auth gate
- Requesting access writes to `wh/pendingAccess/<uid>`
- Approving from parent mode moves it to `wh/allowedUids/<uid>`

### Test 2 — Per-chore reminders

1. Parent mode → Chores → click any chore → Edit.
2. Scroll to "Reminders" → "+ Add reminder time."
3. Set a time about 3 minutes in the future. Click the day-of-week chips for today (or leave all off = every day).
4. Save.
5. Wait up to 15 minutes. The kid assigned to that chore will get a push notification with "Snooze 15m" and "On it" buttons.

**Debug if nothing fires:** Firebase Console → Functions → Logs. Look at the `choreReminders` function logs. It runs every 15 minutes — check the last invocation to see what it saw.

### Test 3 — Focus timer

1. Kid mode → any chore → "⏱ Focus" button.
2. Pick a preset (Quick 15/3, Standard 25/5, Deep 45/10).
3. Click "Start focus."
4. Timer runs. Try closing the tab and reopening — the timer resumes at the correct position (it uses wall-clock math).
5. When the focus period ends, audio beep fires and break starts automatically.
6. Completed sessions log to `wh/focusSessions/<id>`.

**To test XP bonus:** Parent mode → edit any kid → enable "Focus session XP bonus." Complete a 25m session as that kid → you should get +2 XP and a "🎯 Focus complete!" toast.

---

## Rollback plan

If something goes sideways:

1. **Revert the app deploy:** Vercel → Deployments → roll back to the previous green deploy.
2. **Revert the rules** (to restore access if locked out): Firebase Console → Realtime Database → Rules → paste `{"rules": {".read": "auth != null", ".write": "auth != null"}}` and publish. This still requires Firebase Auth to be enabled, so make sure you leave Step 1 in place.
3. **Nuclear option:** Firebase Console → Realtime Database → Rules → paste `{"rules": {".read": true, ".write": true}}`. Fully open for 30 more days. Use only as a last resort.

---

## What's stored under `wh/`

New paths this batch introduces:

- `wh/allowedUids/{uid}` — approved devices (`{uid, label, role, approvedBy, approvedAt}`)
- `wh/pendingAccess/{uid}` — access requests (`{uid, label, userAgent, requestedAt}`)
- `wh/snoozes/{kidId}/{choreId}` — reminder snoozes (`{snoozedUntil, setAt}`)
- `wh/focusSessions/{sessionId}` — completed focus sessions (`{kidId, choreId, duration, completedAt}`)
- Chore docs now optionally have `chore.reminders = [{time, daysOfWeek}]`
- Kid docs now optionally have `kid.focusBonus = {enabled, xp25, xp45, dailyCap}`

---

## Known minor items, for awareness

- **`firebase-messaging-sw.js`** still has placeholder strings for the config. If your service worker isn't receiving pushes, open `public/firebase-messaging-sw.js` and paste your real Firebase config values into the `firebase.initializeApp({...})` call (replacing the `REPLACE_WITH_YOUR_*` placeholders). Service workers can't read `import.meta.env`, so this file always needs real values.
- **Node 20** — the updated `functions/package.json` uses Node 20. Firebase deprecated Node 18 for new deployments. If `firebase deploy --only functions` complains, you may need to upgrade firebase-tools (`npm install -g firebase-tools@latest`).
- **Audio beep on focus timer** requires user interaction before audio context is allowed (browser rule). The first beep may be silent if the user hasn't clicked anything in the modal yet — clicking "Start focus" satisfies this.
