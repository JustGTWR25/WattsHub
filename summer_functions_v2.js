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
