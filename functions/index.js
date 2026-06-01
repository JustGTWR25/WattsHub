/**
 * functions/index.js
 *
 * Firebase Cloud Functions for WattsHub.
 *
 * SETUP (one-time, from your project root):
 *   npm install -g firebase-tools
 *   firebase login
 *   firebase init functions   (choose existing project, JavaScript)
 *   cd functions && npm install
 *   firebase deploy --only functions
 *
 * REDEPLOY AFTER CHANGES:
 *   firebase deploy --only functions
 *
 * Node version: 18 (set in functions/package.json "engines": {"node":"18"})
 */

const { onValueWritten }              = require("firebase-functions/v2/database");
const { onSchedule }                  = require("firebase-functions/v2/scheduler");
const { initializeApp }               = require("firebase-admin/app");
const { getDatabase }                 = require("firebase-admin/database");
const { getMessaging }                = require("firebase-admin/messaging");

initializeApp();

const db        = getDatabase();
const messaging = getMessaging();

const REGION = "us-central1";
const TZ     = "America/Chicago";

/* ════════════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════════════ */

/** Send a push to a specific userId (kid or parent). */
async function pushToUser(userId, { title, body, tag, url, actions }) {
  const snap = await db.ref(`wh/fcmTokens/${userId}`).get();
  if (!snap.exists()) return;

  const { token } = snap.val();
  if (!token) return;

  const message = {
    token,
    notification: { title, body },
    webpush: {
      notification: {
        title,
        body,
        icon:  "/icon-192.png",
        badge: "/badge-72.png",
        tag:   tag  || "wattshub",
        renotify: true,
        requireInteraction: false,
        actions: actions || [],
      },
      fcmOptions: { link: url || "/" },
      data: { tag: tag || "wattshub", url: url || "/" },
    },
  };

  try {
    await messaging.send(message);
  } catch (err) {
    if (
      err.code === "messaging/registration-token-not-registered" ||
      err.code === "messaging/invalid-registration-token"
    ) {
      await db.ref(`wh/fcmTokens/${userId}`).remove();
    } else {
      console.error(`Push to ${userId} failed:`, err.message);
    }
  }
}

/** All parent userIds. */
async function getParentIds() {
  const snap = await db.ref("wh/parents").get();
  if (!snap.exists()) return [];
  return Object.keys(snap.val());
}

/** Format YYYY-MM-DD in a given timezone offset (we rely on scheduler TZ). */
function dateKeyFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Does this chore appear on this date/day-of-week? */
function choreAppearsOnDate(chore, dateKey, dow) {
  if (chore.deletedAfter && dateKey >= chore.deletedAfter) return false;
  if (chore.upForGrabs) return false;
  if (chore.freq === "weekly" || chore.freq === "monthly" || chore.freq === "once") return true;
  if (chore.scheduleType === "fixed" && chore.scheduleDays?.length) {
    return chore.scheduleDays.includes(dow);
  }
  return true;
}

/* ════════════════════════════════════════════════════════════════════
   TRIGGER 1: Chore completion status changed
   Path: wh/comps/{dateKey}/{choreKey}
════════════════════════════════════════════════════════════════════ */
exports.onCompStatusChanged = onValueWritten(
  { ref: "wh/comps/{dateKey}/{choreKey}", region: REGION },
  async (event) => {
    const before = event.data.before?.val();
    const after  = event.data.after?.val();

    if (!after) return;

    const { status, kidId, choreId } = after;
    const prevStatus = before?.status;
    if (status === prevStatus) return;

    const choreSnap = await db.ref(`wh/chores/${choreId}`).get();
    const choreName = choreSnap.exists() ? choreSnap.val().title : "a chore";

    const kidSnap = await db.ref(`wh/kids/${kidId}`).get();
    const kidName = kidSnap.exists() ? kidSnap.val().name : "Someone";

    // Kid submitted for approval → notify all parents
    if (status === "pending" && prevStatus !== "pending") {
      const parentIds = await getParentIds();
      await Promise.all(
        parentIds.map(pid =>
          pushToUser(pid, {
            title: `⏳ ${kidName} needs approval`,
            body:  `"${choreName}" is waiting for your review.`,
            tag:   `approval-${choreId}-${kidId}`,
            url:   "/",
            actions: [
              { action: "approve", title: "✓ Approve" },
              { action: "deny",    title: "✕ Deny"    },
            ],
          })
        )
      );
    }

    // Parent approved → notify kid
    if (status === "approved" && prevStatus === "pending") {
      await pushToUser(kidId, {
        title: `✅ "${choreName}" approved!`,
        body:  "Great work! XP and dollars have been added to your balance.",
        tag:   `approved-${choreId}`,
        url:   "/",
      });
    }

    // Parent denied → notify kid
    if (status === "denied" && prevStatus === "pending") {
      const denyNote = after.denyNote ? ` "${after.denyNote}"` : "";
      await pushToUser(kidId, {
        title: `❌ "${choreName}" needs a redo`,
        body:  `Parent sent it back.${denyNote}`,
        tag:   `denied-${choreId}`,
        url:   "/",
      });
    }
  }
);

/* ════════════════════════════════════════════════════════════════════
   TRIGGER 2: Per-chore scheduled reminders
   Runs every 15 minutes.
   Checks every chore for any reminder slot that matches the current
   time window (±7 minutes). For each matching reminder, pushes any
   assigned kid who hasn't marked that chore complete today.
   Respects per-kid snoozes at wh/snoozes/{kidId}/{choreId}.

   Chore shape expectation:
     chore.reminders = [
       { time: "16:00", daysOfWeek: [1,2,3,4,5] }  // 16:00 = 4pm, Mon–Fri
     ]
   Omitted daysOfWeek = every day.
════════════════════════════════════════════════════════════════════ */
exports.choreReminders = onSchedule(
  { schedule: "*/15 * * * *", timeZone: TZ, region: REGION },
  async () => {
    const now     = new Date();
    const dateKey = dateKeyFromDate(now);
    const dow     = now.getDay();
    const hhmm    = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const nowMin  = now.getHours() * 60 + now.getMinutes();

    const [choresSnap, compsSnap, kidsSnap, snoozesSnap] = await Promise.all([
      db.ref("wh/chores").get(),
      db.ref(`wh/comps/${dateKey}`).get(),
      db.ref("wh/kids").get(),
      db.ref("wh/snoozes").get(),
    ]);

    if (!choresSnap.exists() || !kidsSnap.exists()) return;

    const chores  = Object.values(choresSnap.val());
    const kids    = Object.values(kidsSnap.val());
    const comps   = compsSnap.exists() ? compsSnap.val() : {};
    const snoozes = snoozesSnap.exists() ? snoozesSnap.val() : {};
    const nowMs   = Date.now();

    for (const chore of chores) {
      if (!Array.isArray(chore.reminders) || chore.reminders.length === 0) continue;
      if (!choreAppearsOnDate(chore, dateKey, dow)) continue;

      // Any reminder slot match the current 15-minute window?
      const slotMatches = chore.reminders.some(r => {
        if (r.daysOfWeek && r.daysOfWeek.length && !r.daysOfWeek.includes(dow)) return false;
        if (!r.time) return false;
        const [h, m] = r.time.split(":").map(Number);
        if (Number.isNaN(h) || Number.isNaN(m)) return false;
        const slotMin = h * 60 + m;
        return Math.abs(slotMin - nowMin) <= 7;
      });
      if (!slotMatches) continue;

      const assignees = (chore.assignedTo || []).filter(id => kids.some(k => k.id === id));
      if (assignees.length === 0) continue;

      for (const kidId of assignees) {
        const kid = kids.find(k => k.id === kidId);
        if (!kid) continue;

        // Skip if already done (or pending)
        const ck   = `${chore.id}__${kidId}`;
        const comp = comps[ck];
        if (comp && (comp.status === "approved" || comp.status === "pending")) continue;

        // Snoozed?
        const snz = snoozes[kidId]?.[chore.id];
        if (snz?.snoozedUntil && snz.snoozedUntil > nowMs) continue;

        await pushToUser(kidId, {
          title: `⏰ Time for: ${chore.title}`,
          body:  `Hey ${kid.name}, it's ${hhmm}. Tap to get started.`,
          tag:   `remind-${chore.id}-${kidId}-${dateKey}`,
          url:   "/",
          actions: [
            { action: "snooze15", title: "😴 Snooze 15m" },
            { action: "done",     title: "✓ On it"       },
          ],
        });
      }
    }
  }
);

/* ════════════════════════════════════════════════════════════════════
   TRIGGER 3: Daily chore roll-up reminder
   Runs every day at 5:00 PM CT — one summary push per kid.
════════════════════════════════════════════════════════════════════ */
exports.dailyChoreReminder = onSchedule(
  { schedule: "0 17 * * *", timeZone: TZ, region: REGION },
  async () => {
    const now     = new Date();
    const dateKey = dateKeyFromDate(now);
    const dow     = now.getDay();

    const [kidsSnap, choresSnap, compsSnap] = await Promise.all([
      db.ref("wh/kids").get(),
      db.ref("wh/chores").get(),
      db.ref(`wh/comps/${dateKey}`).get(),
    ]);

    if (!kidsSnap.exists() || !choresSnap.exists()) return;

    const kids   = Object.values(kidsSnap.val());
    const chores = Object.values(choresSnap.val());
    const comps  = compsSnap.exists() ? compsSnap.val() : {};

    for (const kid of kids) {
      const myChores = chores.filter(c => {
        if (!(c.assignedTo || []).includes(kid.id)) return false;
        return choreAppearsOnDate(c, dateKey, dow);
      });

      const incomplete = myChores.filter(c => {
        const ck = `${c.id}__${kid.id}`;
        const comp = comps[ck];
        return !comp || comp.status === "denied";
      });

      if (incomplete.length === 0) continue;

      const titles = incomplete.map(c => c.title).slice(0, 3);
      const more   = incomplete.length > 3 ? ` +${incomplete.length - 3} more` : "";

      await pushToUser(kid.id, {
        title: `📋 ${incomplete.length} chore${incomplete.length > 1 ? "s" : ""} left today, ${kid.name}!`,
        body:  titles.join(", ") + more,
        tag:   `reminder-${dateKey}-${kid.id}`,
        url:   "/",
      });
    }
  }
);

/* ════════════════════════════════════════════════════════════════════
   TRIGGER 4: Weekly goal reminder (Sun 7pm CT)
════════════════════════════════════════════════════════════════════ */
exports.weeklyGoalReminder = onSchedule(
  { schedule: "0 19 * * 0", timeZone: TZ, region: REGION },
  async () => {
    const now  = new Date();
    const yr   = now.getFullYear();
    const jan1 = new Date(yr, 0, 1);
    const wk   = Math.ceil(((now - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    const weekKey = `${yr}-W${String(wk).padStart(2, "0")}`;

    const [kidsSnap, periodSnap] = await Promise.all([
      db.ref("wh/kids").get(),
      db.ref(`wh/periodXp/${weekKey}`).get(),
    ]);

    if (!kidsSnap.exists()) return;

    const kids     = Object.values(kidsSnap.val());
    const weeklyXp = periodSnap.exists() ? periodSnap.val() : {};

    for (const kid of kids) {
      if (!kid.goal) continue;
      const earned = weeklyXp[kid.id] || 0;
      const target = kid.goal.weeklyXpTarget || 0;
      if (earned >= target) continue;

      const remaining = target - earned;
      await pushToUser(kid.id, {
        title: `🎯 ${remaining} XP to go, ${kid.name}!`,
        body:  `You've earned ${earned}/${target} XP this week. Finish strong!`,
        tag:   `weekly-goal-${weekKey}-${kid.id}`,
        url:   "/",
      });
    }
  }
);

/* ════════════════════════════════════════════════════════════════════
   TRIGGER 5: Allowance auto-credit (daily 12:01am CT)
════════════════════════════════════════════════════════════════════ */
exports.creditAllowance = onSchedule(
  { schedule: "1 0 * * *", timeZone: TZ, region: REGION },
  async () => {
    const now = new Date();
    const dow = now.getDay();

    const snap = await db.ref("wh/kids").get();
    if (!snap.exists()) return;

    const kids = Object.values(snap.val());

    for (const kid of kids) {
      const al = kid.allowance;
      if (!al || !al.enabled || al.weeklyCents <= 0) continue;
      if (al.dayOfWeek !== dow) continue;

      const newBalance = (kid.balanceCents || 0) + al.weeklyCents;
      const txId = `tx_al_${Date.now()}_${kid.id}`;

      await Promise.all([
        db.ref(`wh/kids/${kid.id}/balanceCents`).set(newBalance),
        db.ref(`wh/txlog/${txId}`).set({
          id:     txId,
          kidId:  kid.id,
          type:   "allowance",
          xp:     0,
          cents:  al.weeklyCents,
          desc:   "Weekly allowance 📅",
          ts:     Date.now(),
        }),
      ]);

      await pushToUser(kid.id, {
        title: `💰 Allowance day, ${kid.name}!`,
        body:  `$${(al.weeklyCents / 100).toFixed(2)} has been added to your balance.`,
        tag:   `allowance-${dateKeyFromDate(now)}-${kid.id}`,
        url:   "/",
      });
    }
  }
);

/* ════════════════════════════════════════════════════════════════════
   TRIGGER 6: Cleanup stale snoozes
   Runs daily at 3am CT — removes expired snooze entries.
════════════════════════════════════════════════════════════════════ */
exports.cleanupSnoozes = onSchedule(
  { schedule: "0 3 * * *", timeZone: TZ, region: REGION },
  async () => {
    const snap = await db.ref("wh/snoozes").get();
    if (!snap.exists()) return;

    const now = Date.now();
    const snoozes = snap.val();
    const updates = {};

    for (const [kidId, kidSnoozes] of Object.entries(snoozes)) {
      for (const [choreId, s] of Object.entries(kidSnoozes || {})) {
        if (!s?.snoozedUntil || s.snoozedUntil < now) {
          updates[`wh/snoozes/${kidId}/${choreId}`] = null;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
    }
  }
);
/**
 * summer_functions_v2.js
 * PASTE INTO: functions/index.js (append below your existing functions)
 *
 * Changes from v1:
 *  - Weekly schedule moved to FRIDAY 8 PM CT (was Sunday 9 PM)
 *    → Report is ready BEFORE Sunday family check-in, not after
 *  - Monthly schedule unchanged: 1st of month 8 AM CT
 *  - generateWeeklyReport is now also an HTTP callable for in-app button
 *  - DOLLARS_FIELD updated to 'balanceCents' (matches WattsHub actual schema)
 *    → Change back to 'allowance' if your field is different
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// ─── CONFIG — verify these match your Firebase structure ─────────────────────
const PATHS = {
  kidsRoot:       'wh/kids',
  XP_FIELD:       'xp',           // confirmed: XP stored on each kid
  DOLLARS_FIELD:  'balanceCents', // ← check your actual field name
  summerConfig:   'wh/summerProgram/config',
  summerKids:     'wh/summerProgram/kids',
  summerSessions: 'wh/summerProgram/sessions',
  reportsWeekly:  'wh/reports/weekly',
  reportsMonthly: 'wh/reports/monthly',
};

const XP_TO_CENTS = 5; // 10 XP × 5¢ = $0.50/session
const TZ = 'America/Chicago';
const db = admin.database();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateString(date) {
  return date.toISOString().split('T')[0];
}

function getWeekKey(date) {
  const d = new Date(date);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getMonthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function buildWeeklyReport(kids, weekKey, now) {
  const updates = {};

  for (const [kidId, kidData] of Object.entries(kids)) {
    const sessionsSnap = await db.ref(`${PATHS.summerSessions}/${kidId}`).once('value');
    const sessions = sessionsSnap.val() || {};
    const weekSessions = Object.values(sessions).filter(s => getWeekKey(new Date(s.date)) === weekKey);
    const xpEarned = weekSessions.reduce((sum, s) => sum + (s.xpAwarded || 0), 0);

    updates[`${PATHS.reportsWeekly}/${kidId}/${weekKey}`] = {
      generatedAt: now,
      weekKey,
      kidName: kidData.displayName || kidId,
      sessionsCompleted: weekSessions.length,
      sessionsScheduled: 4,
      attendanceRate: parseFloat((weekSessions.length / 4).toFixed(2)),
      xpEarned,
      centsEarned: xpEarned * XP_TO_CENTS,
      currentStreak: kidData.currentStreak || 0,
      longestStreak: kidData.longestStreak || 0,
      mathSessions: weekSessions.filter(s => s.focus === 'math').length,
      literacySessions: weekSessions.filter(s => s.focus === 'literacy').length,
      totalXPToDate: kidData.totalXPEarned || 0,
      totalSessionsToDate: kidData.totalSessionsCompleted || 0,
    };
  }

  return updates;
}

// ─── FUNCTION 1: Complete a Summer Session (HTTP callable) ────────────────────

exports.completeSummerSession = functions.https.onCall(async (data, context) => {
  const { kidId, focus, notes = '' } = data;
  if (!kidId || !focus) throw new functions.https.HttpsError('invalid-argument', 'kidId and focus required');

  const now = Date.now();
  const todayStr = toDateString(new Date(now));
  const dayOfWeek = new Date(now).toLocaleDateString('en-US', { weekday: 'long' });

  const configSnap = await db.ref(PATHS.summerConfig).once('value');
  const config = configSnap.val() || { active: true, dailyXP: 10, streakBonusThreshold: 5, streakBonusMultiplier: 1.5 };
  if (!config.active) throw new functions.https.HttpsError('failed-precondition', 'Program not active');

  const todayCheck = await db.ref(`${PATHS.summerSessions}/${kidId}`).orderByChild('date').equalTo(todayStr).once('value');
  if (todayCheck.exists()) throw new functions.https.HttpsError('already-exists', 'Session already completed today');

  const kidSnap = await db.ref(`${PATHS.summerKids}/${kidId}`).once('value');
  const kidState = kidSnap.val() || {};

  const yesterday = toDateString(new Date(now - 86400000));
  const newStreak = kidState.lastSessionDate === yesterday ? (kidState.currentStreak || 0) + 1 : 1;
  const hasBonus = newStreak >= (config.streakBonusThreshold || 5);
  const xpAwarded = hasBonus ? Math.round((config.dailyXP || 10) * (config.streakBonusMultiplier || 1.5)) : (config.dailyXP || 10);
  const centsEarned = xpAwarded * XP_TO_CENTS;

  const sessRef = db.ref(`${PATHS.summerSessions}/${kidId}`).push();
  await sessRef.set({ date: todayStr, dayOfWeek, focus, completed: true, completedAt: now, xpAwarded, streakBonus: hasBonus, bonusXPAwarded: xpAwarded - (config.dailyXP || 10), notes });

  const updates = {};
  updates[`${PATHS.summerKids}/${kidId}/totalXPEarned`] = (kidState.totalXPEarned || 0) + xpAwarded;
  updates[`${PATHS.summerKids}/${kidId}/totalSessionsCompleted`] = (kidState.totalSessionsCompleted || 0) + 1;
  updates[`${PATHS.summerKids}/${kidId}/currentStreak`] = newStreak;
  updates[`${PATHS.summerKids}/${kidId}/longestStreak`] = Math.max(newStreak, kidState.longestStreak || 0);
  updates[`${PATHS.summerKids}/${kidId}/lastSessionDate`] = todayStr;

  const mainKidSnap = await db.ref(`${PATHS.kidsRoot}/${kidId}`).once('value');
  const mainKid = mainKidSnap.val() || {};
  updates[`${PATHS.kidsRoot}/${kidId}/${PATHS.XP_FIELD}`] = (mainKid[PATHS.XP_FIELD] || 0) + xpAwarded;
  updates[`${PATHS.kidsRoot}/${kidId}/${PATHS.DOLLARS_FIELD}`] = (mainKid[PATHS.DOLLARS_FIELD] || 0) + centsEarned;

  await db.ref('/').update(updates);
  return { success: true, xpAwarded, centsEarned, newStreak, hasStreakBonus: hasBonus };
});

// ─── FUNCTION 2: Weekly Report — FRIDAY 8 PM CT ───────────────────────────────
// Changed from Sunday 9 PM → reports ready BEFORE Sunday family check-in

exports.generateWeeklySummary = functions.pubsub
  .schedule('0 20 * * 5')   // ← FRIDAY 8 PM (was '0 21 * * 0' Sunday 9 PM)
  .timeZone(TZ)
  .onRun(async () => {
    const now = Date.now();
    const weekKey = getWeekKey(new Date(now));
    const kidsSnap = await db.ref(PATHS.summerKids).once('value');
    if (!kidsSnap.exists()) return null;
    const updates = await buildWeeklyReport(kidsSnap.val(), weekKey, now);
    await db.ref('/').update(updates);
    console.log(`Weekly summary generated for ${weekKey} (Friday run)`);
    return null;
  });

// ─── FUNCTION 3: Weekly Report — HTTP callable (for in-app "Generate Now") ───

exports.generateWeeklyReport = functions.https.onCall(async (data) => {
  const { weekKey } = data;
  const now = Date.now();
  const targetWeek = weekKey || getWeekKey(new Date(now));
  const kidsSnap = await db.ref(PATHS.summerKids).once('value');
  if (!kidsSnap.exists()) return { success: false, message: 'No kids found in summer program' };
  const updates = await buildWeeklyReport(kidsSnap.val(), targetWeek, now);
  await db.ref('/').update(updates);
  return { success: true, weekKey: targetWeek, kidsUpdated: Object.keys(updates).length };
});

// ─── FUNCTION 4: Monthly Summary — 1st of each month 8 AM CT ─────────────────

exports.generateMonthlySummary = functions.pubsub
  .schedule('0 8 1 * *')
  .timeZone(TZ)
  .onRun(async () => {
    const now = Date.now();
    const prevMonth = new Date(now);
    prevMonth.setDate(1);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const monthKey = getMonthKey(prevMonth);
    const monthStart = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
    const monthEnd = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0);
    const monthLabel = prevMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const kidsSnap = await db.ref(PATHS.summerKids).once('value');
    if (!kidsSnap.exists()) return null;

    const kids = kidsSnap.val();
    const updates = {};

    for (const [kidId, kidState] of Object.entries(kids)) {
      const sessSnap = await db.ref(`${PATHS.summerSessions}/${kidId}`)
        .orderByChild('date')
        .startAt(toDateString(monthStart))
        .endAt(toDateString(monthEnd))
        .once('value');

      const sessions = Object.values(sessSnap.val() || {});
      const weeklyBreakdown = {};
      for (const s of sessions) {
        const wk = getWeekKey(new Date(s.date));
        if (!weeklyBreakdown[wk]) weeklyBreakdown[wk] = { xp: 0, sessions: 0 };
        weeklyBreakdown[wk].xp += s.xpAwarded || 0;
        weeklyBreakdown[wk].sessions += 1;
      }

      // Count scheduled Mon–Thu days in the month
      let scheduledCount = 0;
      for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        if (dow >= 1 && dow <= 4) scheduledCount++;
      }

      const totalXP = sessions.reduce((sum, s) => sum + (s.xpAwarded || 0), 0);

      updates[`${PATHS.reportsMonthly}/${kidId}/${monthKey}`] = {
        generatedAt: now,
        monthKey,
        month: monthLabel,
        kidName: kidState.displayName || kidId,
        totalSessions: sessions.length,
        scheduledSessions: scheduledCount,
        attendanceRate: scheduledCount > 0 ? parseFloat((sessions.length / scheduledCount).toFixed(2)) : 0,
        totalXPEarned: totalXP,
        totalDollarsEarned: totalXP * XP_TO_CENTS,
        bestStreak: kidState.longestStreak || 0,
        mathSessions: sessions.filter(s => s.focus === 'math').length,
        literacySessions: sessions.filter(s => s.focus === 'literacy').length,
        weeklyBreakdown,
        totalXPToDate: kidState.totalXPEarned || 0,
        totalSessionsToDate: kidState.totalSessionsCompleted || 0,
      };
    }

    await db.ref('/').update(updates);
    console.log(`Monthly summary generated for ${monthKey}`);
    return null;
  });
