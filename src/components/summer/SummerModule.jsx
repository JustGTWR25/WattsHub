/**
 * SummerModule.jsx — complete summer program UI
 *
 * All Firebase ops receive `db` as a prop from App.jsx (never call getDatabase()
 * here — that would fire before initializeApp() completes).
 *
 * Exports:
 *   SummerView      — parent dashboard: overview, weekly report, monthly report
 *   KidSummerCard   — kid-facing daily session card (drop into kid mode)
 *   SummerNavBadge  — live streak chip next to Summer nav item
 */

import { useState, useEffect } from 'react';
import { ref, onValue, push, set, update } from 'firebase/database';
import {
  PATHS, SUMMER_CONFIG, FOCUS_BY_DAY, KID_TRACKS,
  isSessionDay, isProgramActive, getWeeksElapsed, fmtDollars,
} from './summerConfig';

/* ─── Date helpers ────────────────────────────────────────────────────────── */
/* FIX: local date — toISOString() is UTC and returns wrong date after ~7PM US time */
const todayStr  = () => new Date().toLocaleDateString('en-CA');
const getDOW    = () => new Date().toLocaleDateString('en-US', { weekday: 'long' });

function getWeekKey(dateStr) {
  const d = new Date(dateStr || Date.now());
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const wk = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(wk).padStart(2, '0')}`;
}

function getMonthKey(dateStr) {
  const d = new Date(dateStr || Date.now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(monthKey) {
  const [y, m] = monthKey.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * FIX: streak counts only Mon–Thu sessions.
 * A streak continues if the previous recorded session was the previous
 * scheduled day (skipping weekends automatically).
 */
function calcNewStreak(lastSessionDate, currentStreak) {
  if (!lastSessionDate) return 1;
  const last = new Date(lastSessionDate + 'T00:00:00');
  const now  = new Date();
  // Walk backwards from yesterday to find the most recent scheduled day
  let prev = new Date(now);
  prev.setDate(prev.getDate() - 1);
  // Skip non-session days going back (max 4 days covers a weekend gap)
  let tries = 0;
  while (!isSessionDay(prev) && tries < 4) { prev.setDate(prev.getDate() - 1); tries++; }
  const prevStr = prev.toISOString().split('T')[0];
  return lastSessionDate === prevStr ? (currentStreak || 0) + 1 : 1;
}

/* ─── completeSession — writes directly using passed db instance ─────────── */
async function completeSession(db, kidId, kidName, focus, notes = '') {
  if (!db) throw new Error('Firebase not ready');
  const today = todayStr();
  const now   = Date.now();

  // Read kid summer state
  let kidState = {};
  await new Promise(r => onValue(ref(db, `${PATHS.summerKids}/${kidId}`), s => { kidState = s.val() || {}; r(); }, { onlyOnce: true }));

  const newStreak  = calcNewStreak(kidState.lastSessionDate, kidState.currentStreak);
  const hasBonus   = newStreak >= SUMMER_CONFIG.streakBonusThreshold;
  const xpAwarded  = hasBonus ? Math.round(SUMMER_CONFIG.dailyXP * SUMMER_CONFIG.streakBonusMultiplier) : SUMMER_CONFIG.dailyXP;
  const centsEarned = xpAwarded * SUMMER_CONFIG.xpToCents;

  // Write session
  await set(push(ref(db, `${PATHS.summerSessions}/${kidId}`)), {
    date: today, dayOfWeek: getDOW(), focus, completed: true,
    completedAt: now, xpAwarded, streakBonus: hasBonus,
    bonusXPAwarded: xpAwarded - SUMMER_CONFIG.dailyXP, notes,
  });

  // Batch update summer + main kid nodes
  const upd = {};
  upd[`${PATHS.summerKids}/${kidId}/totalXPEarned`]         = (kidState.totalXPEarned || 0) + xpAwarded;
  upd[`${PATHS.summerKids}/${kidId}/totalSessionsCompleted`] = (kidState.totalSessionsCompleted || 0) + 1;
  upd[`${PATHS.summerKids}/${kidId}/currentStreak`]          = newStreak;
  upd[`${PATHS.summerKids}/${kidId}/longestStreak`]          = Math.max(newStreak, kidState.longestStreak || 0);
  upd[`${PATHS.summerKids}/${kidId}/lastSessionDate`]        = today;
  upd[`${PATHS.summerKids}/${kidId}/displayName`]            = kidName;

  let mainKid = {};
  await new Promise(r => onValue(ref(db, `${PATHS.kidsRoot}/${kidId}`), s => { mainKid = s.val() || {}; r(); }, { onlyOnce: true }));
  upd[`${PATHS.kidsRoot}/${kidId}/${PATHS.XP_FIELD}`]       = (mainKid[PATHS.XP_FIELD] || 0) + xpAwarded;
  upd[`${PATHS.kidsRoot}/${kidId}/${PATHS.DOLLARS_FIELD}`]  = (mainKid[PATHS.DOLLARS_FIELD] || 0) + centsEarned;

  await update(ref(db), upd);
  return { xpAwarded, centsEarned, newStreak, hasBonus };
}

/* ─── generateWeeklyReport — builds + stores a week's summary ────────────── */
async function generateWeeklyReport(db, kids, weekKey) {
  if (!db) return;
  const now = Date.now();
  const upd = {};

  for (const kid of kids) {
    const { id: kidId, name: kidName } = kid;
    let sessions = {}, kidState = {};
    await new Promise(r => onValue(ref(db, `${PATHS.summerSessions}/${kidId}`), s => { sessions = s.val() || {}; r(); }, { onlyOnce: true }));
    await new Promise(r => onValue(ref(db, `${PATHS.summerKids}/${kidId}`),     s => { kidState = s.val() || {}; r(); }, { onlyOnce: true }));

    const wkSessions = Object.values(sessions).filter(s => getWeekKey(s.date) === weekKey);
    const xpEarned   = wkSessions.reduce((a, s) => a + (s.xpAwarded || 0), 0);

    upd[`${PATHS.reportsWeekly}/${kidId}/${weekKey}`] = {
      generatedAt: now, weekKey, kidName,
      sessionsCompleted: wkSessions.length,
      sessionsScheduled: 4,  // Mon–Thu
      attendanceRate: parseFloat((wkSessions.length / 4).toFixed(2)),
      xpEarned,
      centsEarned: xpEarned * SUMMER_CONFIG.xpToCents,
      currentStreak: kidState.currentStreak || 0,
      longestStreak: kidState.longestStreak || 0,
      mathSessions:     wkSessions.filter(s => s.focus === 'math').length,
      literacySessions: wkSessions.filter(s => s.focus === 'literacy').length,
      totalXPToDate:       kidState.totalXPEarned || 0,
      totalSessionsToDate: kidState.totalSessionsCompleted || 0,
    };
  }
  await update(ref(db), upd);
}

/* ─── generateMonthlyReport ───────────────────────────────────────────────── */
async function generateMonthlyReport(db, kids, mKey) {
  if (!db) return;
  const now = Date.now();
  const [yr, mo] = mKey.split('-').map(Number);
  const monthStart = new Date(yr, mo - 1, 1);
  const monthEnd   = new Date(yr, mo, 0);
  const upd = {};

  for (const kid of kids) {
    const { id: kidId, name: kidName } = kid;
    let sessions = {}, kidState = {};
    await new Promise(r => onValue(ref(db, `${PATHS.summerSessions}/${kidId}`), s => { sessions = s.val() || {}; r(); }, { onlyOnce: true }));
    await new Promise(r => onValue(ref(db, `${PATHS.summerKids}/${kidId}`),     s => { kidState = s.val() || {}; r(); }, { onlyOnce: true }));

    const moSessions = Object.values(sessions).filter(s => {
      const d = new Date(s.date + 'T00:00:00');
      return d >= monthStart && d <= monthEnd;
    });

    // Count scheduled Mon–Thu days in the month
    let scheduled = 0;
    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      if (isSessionDay(d)) scheduled++;
    }

    // Week breakdown
    const weeklyBreakdown = {};
    moSessions.forEach(s => {
      const wk = getWeekKey(s.date);
      if (!weeklyBreakdown[wk]) weeklyBreakdown[wk] = { xp: 0, sessions: 0 };
      weeklyBreakdown[wk].xp += s.xpAwarded || 0;
      weeklyBreakdown[wk].sessions += 1;
    });

    const totalXP = moSessions.reduce((a, s) => a + (s.xpAwarded || 0), 0);

    upd[`${PATHS.reportsMonthly}/${kidId}/${mKey}`] = {
      generatedAt: now, monthKey: mKey,
      month: getMonthLabel(mKey), kidName,
      totalSessions: moSessions.length,
      scheduledSessions: scheduled,
      attendanceRate: scheduled ? parseFloat((moSessions.length / scheduled).toFixed(2)) : 0,
      totalXPEarned:    totalXP,
      totalDollarsEarned: totalXP * SUMMER_CONFIG.xpToCents,
      bestStreak:    kidState.longestStreak || 0,
      mathSessions:     moSessions.filter(s => s.focus === 'math').length,
      literacySessions: moSessions.filter(s => s.focus === 'literacy').length,
      weeklyBreakdown,
      totalXPToDate:       kidState.totalXPEarned || 0,
      totalSessionsToDate: kidState.totalSessionsCompleted || 0,
    };
  }
  await update(ref(db), upd);
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXPORTED COMPONENTS
═══════════════════════════════════════════════════════════════════════════ */

/* ─── SummerNavBadge ──────────────────────────────────────────────────────── */
export function SummerNavBadge({ db, kidId }) {
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    if (!db) return;
    const path = kidId ? `${PATHS.summerKids}/${kidId}/currentStreak` : PATHS.summerKids;
    return onValue(ref(db, path), snap => {
      if (kidId) { setStreak(snap.val() || 0); }
      else {
        const all = snap.val() || {};
        setStreak(Object.values(all).reduce((m, k) => Math.max(m, k.currentStreak || 0), 0));
      }
    });
  }, [db, kidId]);

  if (!streak) return null;
  return (
    <span style={{ background: streak >= 5 ? 'rgba(245,166,35,0.2)' : 'rgba(108,99,255,0.15)', color: streak >= 5 ? '#f5a623' : '#9d97f7', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 10, marginLeft: 4 }}>
      {streak >= 5 ? '🔥' : '⚡'}{streak}
    </span>
  );
}

/* ─── KidSummerCard ───────────────────────────────────────────────────────── */
export function KidSummerCard({ db, kidId, kidName }) {
  const [kidState, setKidState]     = useState(null);
  const [todayDone, setTodayDone]   = useState(false);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState(null);
  const [notes, setNotes]           = useState('');
  const [showNotes, setShowNotes]   = useState(false);

  const dow      = getDOW();
  const focus    = FOCUS_BY_DAY[dow];
  const canToday = !!focus && isProgramActive();

  useEffect(() => {
    if (!db || !kidId) return;
    // Set loading false after a timeout even if Firebase is slow
    const timeout = setTimeout(() => setLoading(false), 5000);
    const u1 = onValue(ref(db, `${PATHS.summerKids}/${kidId}`), s => {
      setKidState(s.val());
      setLoading(false);
      clearTimeout(timeout);
    });
    const u2 = onValue(ref(db, `${PATHS.summerSessions}/${kidId}`), s => {
      setTodayDone(Object.values(s.val() || {}).some(x => x.date === todayStr()));
    });
    return () => { u1(); u2(); clearTimeout(timeout); };
  }, [db, kidId]);

  const handleComplete = async () => {
    if (!canToday || submitting || todayDone) return;
    setSubmitting(true);
    try {
      const r = await completeSession(db, kidId, kidName, focus, notes);
      setResult(r); setNotes(''); setShowNotes(false);
    } catch (e) { setResult({ error: e.message }); }
    finally { setSubmitting(false); }
  };

  // Show skeleton while loading — never return null so the card space is held
  if (loading) return (
    <div style={{ background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 14, padding: '1rem 1.1rem', marginBottom: '1rem', opacity: 0.5 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--pul)' }}>☀️ Summer Learning</div>
      <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 8 }}>Loading...</div>
    </div>
  );

  // Show "coming soon" if program hasn't started yet rather than hiding the card
  if (!isProgramActive()) return (
    <div style={{ background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 14, padding: '1rem 1.1rem', marginBottom: '1rem' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--pul)', marginBottom: 6 }}>☀️ Summer Learning</div>
      <div style={{ fontSize: 12, color: 'var(--tx3)' }}>Program starts {SUMMER_CONFIG.startDate} — get ready! 🚀</div>
    </div>
  );

  const streak    = kidState?.currentStreak || 0;
  const totalXP   = kidState?.totalXPEarned || 0;
  const totalSess = kidState?.totalSessionsCompleted || 0;
  const hasBonus  = streak >= SUMMER_CONFIG.streakBonusThreshold;
  const nearBonus = streak >= 3 && !hasBonus;
  const sessXP    = hasBonus ? Math.round(SUMMER_CONFIG.dailyXP * SUMMER_CONFIG.streakBonusMultiplier) : SUMMER_CONFIG.dailyXP;

  return (
    <div style={{ background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 14, padding: '1rem 1.1rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--pul)' }}>☀️ Summer Learning</div>
        <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{dow}</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {[
          { icon: hasBonus ? '🔥' : streak > 0 ? '⚡' : '○', val: streak,    lbl: 'streak'   },
          { icon: '⭐',                                        val: totalXP,   lbl: 'XP'       },
          { icon: '📚',                                        val: totalSess, lbl: 'sessions' },
        ].map(c => (
          <div key={c.lbl} style={{ flex: 1, background: 'var(--s3)', borderRadius: 8, padding: '6px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: 13 }}>{c.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--tx1)' }}>{c.val}</div>
            <div style={{ fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.lbl}</div>
          </div>
        ))}
      </div>

      {nearBonus && (
        <div style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#f5a623', marginBottom: 10 }}>
          ⚡ {SUMMER_CONFIG.streakBonusThreshold - streak} more session{SUMMER_CONFIG.streakBonusThreshold - streak !== 1 ? 's' : ''} to unlock 🔥 streak bonus (+50% XP)
        </div>
      )}
      {hasBonus && (
        <div style={{ background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.35)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#f5a623', marginBottom: 10 }}>
          🔥 Streak bonus ACTIVE — earning {sessXP} XP per session!
        </div>
      )}

      {!canToday ? (
        <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--tx3)', fontSize: 13 }}>🏖️ No session today — enjoy the break!</div>
      ) : (todayDone && !result) ? (
        <div style={{ background: 'rgba(45,212,167,0.1)', border: '1px solid rgba(45,212,167,0.25)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--te)' }}>✅ Today's session done! Great work.</div>
      ) : (result && !result.error) ? (
        <div style={{ background: 'rgba(45,212,167,0.1)', border: '1px solid rgba(45,212,167,0.25)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--te)' }}>
          ✅ +{result.xpAwarded} XP earned!{result.hasBonus ? ' 🔥 Streak bonus!' : ''} Keep it up!
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: 'var(--tx2)', marginBottom: 8 }}>
            Today: <strong style={{ color: 'var(--tx1)' }}>{focus === 'math' ? '🔢 Math' : '📖 Literacy'}</strong>
            <span style={{ float: 'right', background: 'var(--pud)', color: '#fff', borderRadius: 12, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>+{sessXP} XP</span>
          </div>
          {showNotes && (
            <textarea style={{ width: '100%', background: 'var(--s3)', border: '1px solid var(--b2)', borderRadius: 8, padding: '6px 10px', color: 'var(--tx1)', fontSize: 12, fontFamily: 'inherit', resize: 'none', marginBottom: 8, boxSizing: 'border-box' }}
              placeholder="What did you work on? (optional)" value={notes} onChange={e => setNotes(e.target.value)} rows={2}/>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ flex: 1, background: 'var(--pu)', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 0', fontSize: 14, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, fontFamily: 'inherit', minHeight: 52 }}
              onClick={handleComplete} disabled={submitting}>
              {submitting ? 'Saving...' : '✅ Session Complete'}
            </button>
            <button style={{ background: 'var(--s3)', border: '1px solid var(--b2)', borderRadius: 10, padding: '0 14px', fontSize: 14, color: 'var(--tx2)', cursor: 'pointer', fontFamily: 'inherit' }}
              onClick={() => setShowNotes(v => !v)} title="Add notes">✏️</button>
          </div>
          {result?.error && <div style={{ marginTop: 8, background: 'rgba(240,96,96,0.1)', border: '1px solid rgba(240,96,96,0.3)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: 'var(--co)' }}>⚠️ {result.error}</div>}
        </div>
      )}
    </div>
  );
}

/* ─── SummerView ──────────────────────────────────────────────────────────── */
export function SummerView({ db, kids = [], summerKids = {}, summerSessions = {}, weekly = {}, monthly = {} }) {
  const [tab, setTab]               = useState('overview');
  const [selWeek, setSelWeek]       = useState(getWeekKey(new Date()));
  const [selMonth, setSelMonth]     = useState(getMonthKey(new Date()));
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg]         = useState('');

  const kidColors = ['#6C63FF', '#FF6B9D', '#00C9A7'];

  const allWeeks  = Array.from(new Set(Object.values(weekly).flatMap(k => Object.keys(k)))).sort().reverse();
  const allMonths = Array.from(new Set(Object.values(monthly).flatMap(k => Object.keys(k)))).sort().reverse();

  // Show connecting state while db initializes — prevents blank screen on mobile
  if (!db) return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--tx3)' }}>
      <div style={{ fontSize: 24, marginBottom: 12 }}>☀️</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx2)', marginBottom: 6 }}>Summer Program</div>
      <div style={{ fontSize: 12 }}>Connecting to Firebase...</div>
    </div>
  );

  const doGenWeekly = async () => {
    setGenerating(true); setGenMsg('Generating...');
    try { await generateWeeklyReport(db, kids, selWeek); setGenMsg('✅ Weekly report saved!'); }
    catch (e) { setGenMsg('⚠️ ' + e.message); }
    finally { setGenerating(false); setTimeout(() => setGenMsg(''), 3000); }
  };

  const doGenMonthly = async () => {
    setGenerating(true); setGenMsg('Generating...');
    try { await generateMonthlyReport(db, kids, selMonth); setGenMsg('✅ Monthly report saved!'); }
    catch (e) { setGenMsg('⚠️ ' + e.message); }
    finally { setGenerating(false); setTimeout(() => setGenMsg(''), 3000); }
  };

  /* ── Shared sub-components ── */
  const StatBox = ({ val, lbl, sub, color }) => (
    <div className="rep-stat" style={{ borderTop: `2px solid ${color}` }}>
      <div className="rep-stat-val">{val}</div>
      <div className="rep-stat-lbl">{lbl}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--tx3)' }}>{sub}</div>}
    </div>
  );

  const AttBar = ({ rate, color }) => {
    const pct = Math.round((rate || 0) * 100);
    return (
      <div style={{ padding: '8px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--tx3)', marginBottom: 4 }}>
          <span>Attendance</span><span style={{ color, fontWeight: 800 }}>{pct}%</span>
        </div>
        <div style={{ background: 'var(--s4)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width .5s' }}/>
        </div>
      </div>
    );
  };

  /* ── Overview tab ── */
  const OverviewTab = () => (
    <div className="rep-grid">
      {kids.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--tx3)' }}>No kids found. Ensure wh/kids is seeded in Firebase.</div>}
      {kids.map((kid, i) => {
        const sk       = summerKids[kid.id] || {};
        const streak   = sk.currentStreak || 0;
        const totalXP  = sk.totalXPEarned || 0;
        const totalS   = sk.totalSessionsCompleted || 0;
        const expected = getWeeksElapsed() * 4;
        const attPct   = expected > 0 ? Math.round((totalS / expected) * 100) : 0;
        const dollars  = totalXP * SUMMER_CONFIG.xpToCents;
        const track    = KID_TRACKS[kid.name] || {};
        const color    = kidColors[i % 3];

        // Build last 4 weeks from sessions data
        const sessions = Object.values(summerSessions[kid.id] || {});
        const last4Weeks = Array.from(new Set(sessions.map(s => getWeekKey(s.date)))).sort().slice(-4);

        return (
          <div key={kid.id} className="rep-card" style={{ borderLeft: `4px solid ${color}` }}>
            <div className="rep-head">
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color }}>{kid.name}</div>
                <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{track.grade} · {track.track}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color }}>{streak >= 5 ? '🔥' : streak > 0 ? '⚡' : '○'}{streak}</div>
                <div style={{ fontSize: 10, color: 'var(--tx3)' }}>streak</div>
              </div>
            </div>
            <div className="rep-stat-row">
              <StatBox val={totalS}            lbl="sessions"  sub={`of ${expected} sched.`} color={color}/>
              <StatBox val={`+${totalXP}`}     lbl="total XP"  sub={`${sk.longestStreak||0} best`} color={color}/>
              <StatBox val={fmtDollars(dollars)}lbl="earned"   sub={`${SUMMER_CONFIG.dailyXP} XP/day`} color={color}/>
              <StatBox val={`${attPct}%`}      lbl="attend."   color={color}/>
            </div>
            {/* Mini week chart */}
            {last4Weeks.length > 0 && (
              <div style={{ padding: '8px 14px' }}>
                <div style={{ fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Recent weeks</div>
                {last4Weeks.map(wk => {
                  const wkSess = sessions.filter(s => getWeekKey(s.date) === wk);
                  const wkXP   = wkSess.reduce((a, s) => a + (s.xpAwarded || 0), 0);
                  const wkPct  = (wkSess.length / 4) * 100;
                  return (
                    <div key={wk} className="rep-bar-row">
                      <span style={{ width: 52, color: 'var(--tx3)', fontSize: 10, flexShrink: 0 }}>Wk {wk.split('-W')[1]}</span>
                      <div style={{ flex: 1, background: 'var(--s4)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${wkPct}%`, height: '100%', background: color }}/>
                      </div>
                      <span style={{ color, fontWeight: 700, minWidth: 36, textAlign: 'right', fontSize: 11 }}>+{wkXP}</span>
                      <span style={{ color: 'var(--tx3)', minWidth: 22, fontSize: 11 }}>{wkSess.length}d</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ padding: '6px 14px 12px', fontSize: 11, color: 'var(--tx3)', borderTop: '1px solid var(--b1)' }}>
              Season total: <strong style={{ color }}>{totalXP} XP · {fmtDollars(dollars)}</strong>
            </div>
          </div>
        );
      })}
    </div>
  );

  /* ── Weekly tab ── */
  const WeeklyTab = () => (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: 'var(--tx2)' }}>Week:</label>
        <select value={selWeek} onChange={e => setSelWeek(e.target.value)}
          style={{ background: 'var(--s3)', color: 'var(--tx1)', border: '1px solid var(--b2)', borderRadius: 7, padding: '5px 10px', fontSize: 13, fontFamily: 'inherit' }}>
          {allWeeks.length ? allWeeks.map(w => <option key={w} value={w}>{w}</option>) : <option value={selWeek}>{selWeek} (current)</option>}
        </select>
        <button onClick={doGenWeekly} disabled={generating}
          style={{ background: 'var(--pud)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: generating ? 0.7 : 1 }}>
          ⚡ Generate Now
        </button>
        {genMsg && <span style={{ fontSize: 12, color: 'var(--te)' }}>{genMsg}</span>}
      </div>

      <div className="rep-grid">
        {kids.map((kid, i) => {
          const report = weekly[kid.id]?.[selWeek];
          const color  = kidColors[i % 3];
          if (!report) return (
            <div key={kid.id} className="rep-card" style={{ borderLeft: `4px solid ${color}` }}>
              <div className="rep-head"><strong style={{ color }}>{kid.name}</strong></div>
              <div style={{ padding: '1rem', fontSize: 13, color: 'var(--tx3)' }}>No report for {selWeek} yet. Click Generate Now.</div>
            </div>
          );
          const attPct = Math.round(report.attendanceRate * 100);
          return (
            <div key={kid.id} className="rep-card" style={{ borderLeft: `4px solid ${color}` }}>
              <div className="rep-head">
                <div style={{ fontSize: 14, fontWeight: 800, color }}>{report.kidName}</div>
                <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{selWeek}</div>
              </div>
              <div className="rep-stat-row">
                <StatBox val={`${report.sessionsCompleted}/${report.sessionsScheduled}`} lbl="sessions" color={color}/>
                <StatBox val={`+${report.xpEarned}`}     lbl="XP"    color={color}/>
                <StatBox val={fmtDollars(report.centsEarned)} lbl="earned" color={color}/>
                <StatBox val={`${report.currentStreak}🔥`}   lbl="streak" color={color}/>
              </div>
              {/* Focus split */}
              <div style={{ padding: '10px 14px' }}>
                {[{ lbl: '🔢 Math', val: report.mathSessions }, { lbl: '📖 Literacy', val: report.literacySessions }].map(f => (
                  <div key={f.lbl} className="rep-bar-row">
                    <span style={{ width: 76, color: 'var(--tx2)', flexShrink: 0 }}>{f.lbl}</span>
                    <div style={{ flex: 1, background: 'var(--s4)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                      <div style={{ width: report.sessionsCompleted ? `${(f.val / report.sessionsCompleted) * 100}%` : '0%', height: '100%', background: color }}/>
                    </div>
                    <span style={{ color: 'var(--tx3)', minWidth: 16, textAlign: 'right' }}>{f.val}</span>
                  </div>
                ))}
              </div>
              <AttBar rate={report.attendanceRate} color={color}/>
              <div style={{ padding: '6px 14px 10px', fontSize: 11, color: 'var(--tx3)' }}>
                Season: {report.totalSessionsToDate} sessions · {report.totalXPToDate} XP
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  /* ── Monthly tab ── */
  const MonthlyTab = () => (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: 'var(--tx2)' }}>Month:</label>
        <select value={selMonth} onChange={e => setSelMonth(e.target.value)}
          style={{ background: 'var(--s3)', color: 'var(--tx1)', border: '1px solid var(--b2)', borderRadius: 7, padding: '5px 10px', fontSize: 13, fontFamily: 'inherit' }}>
          {allMonths.length ? allMonths.map(m => <option key={m} value={m}>{getMonthLabel(m)}</option>) : <option value={selMonth}>{getMonthLabel(selMonth)} (current)</option>}
        </select>
        <button onClick={doGenMonthly} disabled={generating}
          style={{ background: 'var(--pud)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: generating ? 0.7 : 1 }}>
          ⚡ Generate Now
        </button>
        {genMsg && <span style={{ fontSize: 12, color: 'var(--te)' }}>{genMsg}</span>}
      </div>

      <div className="rep-grid">
        {kids.map((kid, i) => {
          const report = monthly[kid.id]?.[selMonth];
          const color  = kidColors[i % 3];
          if (!report) return (
            <div key={kid.id} className="rep-card" style={{ borderLeft: `4px solid ${color}` }}>
              <div className="rep-head"><strong style={{ color }}>{kid.name}</strong></div>
              <div style={{ padding: '1rem', fontSize: 13, color: 'var(--tx3)' }}>No monthly report for {getMonthLabel(selMonth)} yet. Click Generate Now.</div>
            </div>
          );
          const attPct = Math.round(report.attendanceRate * 100);
          const weeks  = report.weeklyBreakdown ? Object.entries(report.weeklyBreakdown).sort(([a], [b]) => a.localeCompare(b)) : [];
          return (
            <div key={kid.id} className="rep-card" style={{ borderLeft: `4px solid ${color}` }}>
              <div className="rep-head">
                <div style={{ fontSize: 14, fontWeight: 800, color }}>{report.kidName}</div>
                <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{report.month}</div>
              </div>
              <div className="rep-stat-row">
                <StatBox val={`${report.totalSessions}/${report.scheduledSessions}`} lbl="sessions" color={color}/>
                <StatBox val={`+${report.totalXPEarned}`}         lbl="XP"     color={color}/>
                <StatBox val={fmtDollars(report.totalDollarsEarned)} lbl="earned" color={color}/>
                <StatBox val={`${report.bestStreak}🔥`}            lbl="best str." color={color}/>
              </div>
              <AttBar rate={report.attendanceRate} color={color}/>
              {weeks.length > 0 && (
                <div style={{ padding: '8px 14px 12px' }}>
                  <div style={{ fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Week breakdown</div>
                  {weeks.map(([wk, data]) => (
                    <div key={wk} className="rep-bar-row">
                      <span style={{ width: 52, color: 'var(--tx3)', fontSize: 10, flexShrink: 0 }}>Wk {wk.split('-W')[1]||wk}</span>
                      <div style={{ flex: 1, background: 'var(--s4)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min((data.xp / 60) * 100, 100)}%`, height: '100%', background: color }}/>
                      </div>
                      <span style={{ color, fontWeight: 700, minWidth: 36, textAlign: 'right', fontSize: 11 }}>+{data.xp}</span>
                      <span style={{ color: 'var(--tx3)', minWidth: 22, fontSize: 11 }}>{data.sessions}d</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ padding: '6px 14px 10px', fontSize: 11, color: 'var(--tx3)', borderTop: '1px solid var(--b1)' }}>
                Season: {report.totalSessionsToDate} sessions · {report.totalXPToDate} XP total
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  /* ── Main render ── */
  return (
    <div style={{ paddingBottom: '2rem' }}>
      <style>{`@media print { .no-print { display:none!important; } }`}</style>

      {/* Tab bar + PDF button */}
      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {[{ id: 'overview', lbl: '📊 Overview' }, { id: 'weekly', lbl: '📅 Weekly' }, { id: 'monthly', lbl: '📆 Monthly' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background: tab === t.id ? 'var(--pu)' : 'var(--s3)', color: tab === t.id ? '#fff' : 'var(--tx2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {t.lbl}
          </button>
        ))}
        <div style={{ flex: 1 }}/>
        <button onClick={() => window.print()}
          style={{ background: 'var(--s3)', color: 'var(--tx2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          🖨️ Export PDF
        </button>
      </div>

      {/* Status banner */}
      {isProgramActive()
        ? <div style={{ background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.25)', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: 'var(--pul)', marginBottom: 16 }}>
            ☀️ Program active · Week {getWeeksElapsed()} of ~10 · {SUMMER_CONFIG.dailyXP} XP/session · Mon–Thu · Streak bonus at {SUMMER_CONFIG.streakBonusThreshold} sessions
          </div>
        : <div style={{ background: 'rgba(45,212,167,0.08)', border: '1px solid rgba(45,212,167,0.2)', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: 'var(--te)', marginBottom: 16 }}>
            ☀️ Program starts {SUMMER_CONFIG.startDate}
          </div>
      }

      {tab === 'overview' && <OverviewTab />}
      {tab === 'weekly'   && <WeeklyTab />}
      {tab === 'monthly'  && <MonthlyTab />}
    </div>
  );
}
