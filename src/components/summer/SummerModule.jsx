/**
 * SummerModule.jsx
 * Place at: src/components/summer/SummerModule.jsx
 *
 * Exports three components for wiring into App.jsx:
 *   - SummerView         → full parent dashboard (/summer route, view="summer")
 *   - KidSummerCard      → kid-facing progress card (drop into kid mode / dashboard)
 *   - SummerNavBadge     → small streak badge for nav item
 *
 * WIRING INSTRUCTIONS (see PATCH_INSTRUCTIONS.md for exact line numbers):
 *   1. import { SummerView, KidSummerCard, SummerNavBadge } from './components/summer/SummerModule';
 *   2. Add nav item: { id:"summer", ic:"☀️", lbl:"Summer" }
 *   3. Add to vmeta: summer:{t:"Summer Program",s:"Learning + XP tracker"}
 *   4. Add to view switcher: {view==="summer"&&<SummerView/>}
 *   5. Add <KidSummerCard kidId={activeKid}/> inside kid mode, above chore list
 */

import { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, onValue, push, set, update } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { PATHS, SUMMER_CONFIG, FOCUS_BY_DAY, KID_TRACKS } from './summerConfig';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function getDayOfWeek() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
}

function getWeekKey(dateStr) {
  const d = new Date(dateStr || Date.now());
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function formatDollars(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function isProgramActive() {
  const today = new Date();
  const start = new Date(SUMMER_CONFIG.startDate);
  const end = new Date(SUMMER_CONFIG.endDate);
  return today >= start && today <= end;
}

function getWeeksElapsed() {
  const start = new Date(SUMMER_CONFIG.startDate);
  const today = new Date();
  return Math.max(1, Math.ceil((today - start) / (7 * 86400000)));
}

// ─── Hook: live summer kid state ──────────────────────────────────────────────

function useSummerKid(kidId) {
  const [state, setState] = useState(null);
  const [todayDone, setTodayDone] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!kidId) return;
    const db = getDatabase();

    const kidRef = ref(db, `${PATHS.summerKids}/${kidId}`);
    const unsubKid = onValue(kidRef, snap => {
      setState(snap.val());
      setLoading(false);
    });

    // Check today's session
    const sessRef = ref(db, `${PATHS.summerSessions}/${kidId}`);
    const unsubSess = onValue(sessRef, snap => {
      const sessions = snap.val() || {};
      const done = Object.values(sessions).some(s => s.date === todayStr());
      setTodayDone(done);
    });

    return () => { unsubKid(); unsubSess(); };
  }, [kidId]);

  return { state, todayDone, loading };
}

// ─── Hook: all kids' summer states (for parent view) ─────────────────────────

function useAllSummerKids(kids) {
  const [summerKids, setSummerKids] = useState({});

  useEffect(() => {
    if (!kids?.length) return;
    const db = getDatabase();
    const r = ref(db, PATHS.summerKids);
    return onValue(r, snap => setSummerKids(snap.val() || {}));
  }, [kids]);

  return summerKids;
}

// ─── Hook: reports ────────────────────────────────────────────────────────────

function useReports() {
  const [weekly, setWeekly] = useState({});
  const [monthly, setMonthly] = useState({});

  useEffect(() => {
    const db = getDatabase();
    const u1 = onValue(ref(db, PATHS.reportsWeekly), s => setWeekly(s.val() || {}));
    const u2 = onValue(ref(db, PATHS.reportsMonthly), s => setMonthly(s.val() || {}));
    return () => { u1(); u2(); };
  }, []);

  return { weekly, monthly };
}

// ─── Complete session (inline, no Cloud Function dependency) ──────────────────

async function completeSession(kidId, kidName, focus, notes = '') {
  const db = getDatabase();
  const now = Date.now();
  const today = todayStr();
  const dayOfWeek = getDayOfWeek();

  // Read current kid summer state
  const stateRef = ref(db, `${PATHS.summerKids}/${kidId}`);
  let kidState = {};
  await new Promise(resolve => {
    onValue(stateRef, snap => { kidState = snap.val() || {}; resolve(); }, { onlyOnce: true });
  });

  // Streak calc
  const yesterday = new Date(now - 86400000).toISOString().split('T')[0];
  const lastDate = kidState.lastSessionDate;
  const newStreak = lastDate === yesterday ? (kidState.currentStreak || 0) + 1 : 1;

  // XP calc
  const baseXP = SUMMER_CONFIG.dailyXP;
  const hasStreakBonus = newStreak >= SUMMER_CONFIG.streakBonusThreshold;
  const xpAwarded = hasStreakBonus
    ? Math.round(baseXP * SUMMER_CONFIG.streakBonusMultiplier)
    : baseXP;
  const centsEarned = xpAwarded * SUMMER_CONFIG.xpToCents;

  // Write session record
  const sessRef = ref(db, `${PATHS.summerSessions}/${kidId}`);
  const newSessRef = push(sessRef);
  await set(newSessRef, {
    date: today,
    dayOfWeek,
    focus,
    completed: true,
    completedAt: now,
    xpAwarded,
    streakBonus: hasStreakBonus,
    bonusXPAwarded: xpAwarded - baseXP,
    notes,
  });

  // Update summer kid state
  const updates = {};
  updates[`${PATHS.summerKids}/${kidId}/totalXPEarned`] = (kidState.totalXPEarned || 0) + xpAwarded;
  updates[`${PATHS.summerKids}/${kidId}/totalSessionsCompleted`] = (kidState.totalSessionsCompleted || 0) + 1;
  updates[`${PATHS.summerKids}/${kidId}/currentStreak`] = newStreak;
  updates[`${PATHS.summerKids}/${kidId}/longestStreak`] = Math.max(newStreak, kidState.longestStreak || 0);
  updates[`${PATHS.summerKids}/${kidId}/lastSessionDate`] = today;
  updates[`${PATHS.summerKids}/${kidId}/displayName`] = kidName;

  // Update main kid XP + dollars
  const mainKidRef = ref(db, `${PATHS.kidsRoot}/${kidId}`);
  let mainKid = {};
  await new Promise(resolve => {
    onValue(mainKidRef, snap => { mainKid = snap.val() || {}; resolve(); }, { onlyOnce: true });
  });
  updates[`${PATHS.kidsRoot}/${kidId}/${PATHS.XP_FIELD}`] = (mainKid[PATHS.XP_FIELD] || 0) + xpAwarded;
  updates[`${PATHS.kidsRoot}/${kidId}/${PATHS.DOLLARS_FIELD}`] = (mainKid[PATHS.DOLLARS_FIELD] || 0) + centsEarned;

  await update(ref(db), updates);

  return { xpAwarded, centsEarned, newStreak, hasStreakBonus };
}

// ─── Generate and store a weekly report (runs in-browser) ────────────────────

async function generateWeeklyReport(kids, weekKey) {
  const db = getDatabase();
  const updates = {};
  const now = Date.now();

  for (const kid of kids) {
    const { id: kidId, name: kidName } = kid;
    let sessions = {};
    await new Promise(resolve => {
      onValue(ref(db, `${PATHS.summerSessions}/${kidId}`), snap => {
        sessions = snap.val() || {};
        resolve();
      }, { onlyOnce: true });
    });

    const weekSessions = Object.values(sessions).filter(s => getWeekKey(s.date) === weekKey);
    let kidState = {};
    await new Promise(resolve => {
      onValue(ref(db, `${PATHS.summerKids}/${kidId}`), snap => {
        kidState = snap.val() || {};
        resolve();
      }, { onlyOnce: true });
    });

    const xpEarned = weekSessions.reduce((s, x) => s + (x.xpAwarded || 0), 0);
    const centsEarned = xpEarned * SUMMER_CONFIG.xpToCents;

    updates[`${PATHS.reportsWeekly}/${kidId}/${weekKey}`] = {
      generatedAt: now,
      weekKey,
      kidName,
      sessionsCompleted: weekSessions.length,
      sessionsScheduled: SUMMER_CONFIG.daysPerWeek,
      attendanceRate: parseFloat((weekSessions.length / SUMMER_CONFIG.daysPerWeek).toFixed(2)),
      xpEarned,
      centsEarned,
      currentStreak: kidState.currentStreak || 0,
      longestStreak: kidState.longestStreak || 0,
      mathSessions: weekSessions.filter(s => s.focus === 'math').length,
      literacySessions: weekSessions.filter(s => s.focus === 'literacy').length,
      totalXPToDate: kidState.totalXPEarned || 0,
      totalSessionsToDate: kidState.totalSessionsCompleted || 0,
    };
  }

  await update(ref(db), updates);
  return updates;
}

// ─── KID-FACING: SummerNavBadge ───────────────────────────────────────────────
// Drop next to the Summer nav label to show live streak

export function SummerNavBadge({ kidId }) {
  const { state } = useSummerKid(kidId);
  if (!state?.currentStreak) return null;
  return (
    <span style={{
      background: state.currentStreak >= 5 ? 'rgba(245,166,35,0.2)' : 'rgba(108,99,255,0.15)',
      color: state.currentStreak >= 5 ? '#f5a623' : '#9d97f7',
      fontSize: 10,
      fontWeight: 800,
      padding: '1px 6px',
      borderRadius: 10,
      marginLeft: 4,
    }}>
      {state.currentStreak >= 5 ? '🔥' : '⚡'}{state.currentStreak}
    </span>
  );
}

// ─── KID-FACING: KidSummerCard ────────────────────────────────────────────────
// Compact card showing today's session + streak + quick-complete button
// Drop inside kid mode above the chore list

export function KidSummerCard({ kidId, kidName }) {
  const { state, todayDone, loading } = useSummerKid(kidId);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const dayOfWeek = getDayOfWeek();
  const todayFocus = FOCUS_BY_DAY[dayOfWeek];
  const isScheduledDay = !!todayFocus && isProgramActive();

  const handleComplete = async () => {
    if (!isScheduledDay || submitting || todayDone) return;
    setSubmitting(true);
    try {
      const r = await completeSession(kidId, kidName, todayFocus, notes);
      setResult(r);
      setNotes('');
      setShowNotes(false);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;
  if (!isProgramActive()) return null;

  const streak = state?.currentStreak || 0;
  const totalXP = state?.totalXPEarned || 0;
  const totalSessions = state?.totalSessionsCompleted || 0;
  const hasBonus = streak >= SUMMER_CONFIG.streakBonusThreshold;
  const nearBonus = streak >= 3 && streak < SUMMER_CONFIG.streakBonusThreshold;

  return (
    <div style={{
      background: 'var(--s2)',
      border: '1px solid var(--b2)',
      borderRadius: 14,
      padding: '1rem 1.1rem',
      marginBottom: '1rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--pul)' }}>☀️ Summer Learning</div>
        <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{dayOfWeek}</div>
      </div>

      {/* Stats chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {[
          { icon: hasBonus ? '🔥' : streak > 0 ? '⚡' : '○', val: streak, label: 'streak' },
          { icon: '⭐', val: totalXP, label: 'XP' },
          { icon: '📚', val: totalSessions, label: 'sessions' },
        ].map(c => (
          <div key={c.label} style={{
            flex: 1, background: 'var(--s3)', borderRadius: 8,
            padding: '6px 4px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 13 }}>{c.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--tx1)' }}>{c.val}</div>
            <div style={{ fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Streak alerts */}
      {nearBonus && (
        <div style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#f5a623', marginBottom: 10 }}>
          ⚡ {SUMMER_CONFIG.streakBonusThreshold - streak} more day{SUMMER_CONFIG.streakBonusThreshold - streak !== 1 ? 's' : ''} to unlock the 🔥 streak bonus (+50% XP)
        </div>
      )}
      {hasBonus && (
        <div style={{ background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.35)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#f5a623', marginBottom: 10 }}>
          🔥 Streak bonus ACTIVE — earning {Math.round(SUMMER_CONFIG.dailyXP * SUMMER_CONFIG.streakBonusMultiplier)} XP per session!
        </div>
      )}

      {/* Session action */}
      {!isScheduledDay ? (
        <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--tx3)', fontSize: 13 }}>
          🏖️ No session today — enjoy your day off!
        </div>
      ) : todayDone && !result ? (
        <div style={{ background: 'rgba(45,212,167,0.1)', border: '1px solid rgba(45,212,167,0.25)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--te)' }}>
          ✅ Today's session done! Great work.
        </div>
      ) : result && !result.error ? (
        <div style={{ background: 'rgba(45,212,167,0.1)', border: '1px solid rgba(45,212,167,0.25)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--te)' }}>
          ✅ +{result.xpAwarded} XP earned!{result.hasStreakBonus ? ' 🔥 Streak bonus!' : ''} Keep it up!
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: 'var(--tx2)', marginBottom: 8 }}>
            Today's focus: <strong style={{ color: 'var(--tx1)' }}>{todayFocus === 'math' ? '🔢 Math' : '📖 Literacy'}</strong>
            <span style={{ float: 'right', background: 'var(--pud)', color: '#fff', borderRadius: 12, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
              +{hasBonus ? Math.round(SUMMER_CONFIG.dailyXP * SUMMER_CONFIG.streakBonusMultiplier) : SUMMER_CONFIG.dailyXP} XP
            </span>
          </div>

          {showNotes && (
            <textarea
              style={{ width: '100%', background: 'var(--s3)', border: '1px solid var(--b2)', borderRadius: 8, padding: '6px 10px', color: 'var(--tx1)', fontSize: 12, fontFamily: 'inherit', resize: 'none', marginBottom: 8, boxSizing: 'border-box' }}
              placeholder="What did you work on today? (optional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={{ flex: 1, background: 'var(--pu)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 0', fontSize: 14, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, fontFamily: 'inherit', minHeight: 52 }}
              onClick={handleComplete}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : '✅ Session Complete'}
            </button>
            <button
              style={{ background: 'var(--s3)', border: '1px solid var(--b2)', borderRadius: 10, padding: '12px', fontSize: 12, color: 'var(--tx2)', cursor: 'pointer', fontFamily: 'inherit' }}
              onClick={() => setShowNotes(v => !v)}
              title="Add notes"
            >
              ✏️
            </button>
          </div>

          {result?.error && (
            <div style={{ marginTop: 8, background: 'rgba(240,96,96,0.1)', border: '1px solid rgba(240,96,96,0.3)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: 'var(--co)' }}>
              ⚠️ {result.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PARENT-FACING: SummerView ────────────────────────────────────────────────
// Full reports dashboard — weekly/monthly, per-kid cards, PDF export

export function SummerView({ kids = [] }) {
  const [viewMode, setViewMode] = useState('overview');  // 'overview' | 'weekly' | 'monthly'
  const [selectedWeek, setSelectedWeek] = useState(getWeekKey(new Date()));
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState('');

  const summerKids = useAllSummerKids(kids);
  const { weekly, monthly } = useReports();

  const kidColors = ['#6C63FF', '#FF6B9D', '#00C9A7'];

  const availableWeeks = Array.from(new Set(
    Object.values(weekly).flatMap(k => Object.keys(k))
  )).sort().reverse();

  const availableMonths = Array.from(new Set(
    Object.values(monthly).flatMap(k => Object.keys(k))
  )).sort().reverse();

  const handleGenerateWeekly = async () => {
    setGenerating(true);
    setGenMsg('Generating...');
    try {
      await generateWeeklyReport(kids, selectedWeek);
      setGenMsg('✅ Weekly report saved!');
    } catch (e) {
      setGenMsg('⚠️ Error: ' + e.message);
    } finally {
      setGenerating(false);
      setTimeout(() => setGenMsg(''), 3000);
    }
  };

  const handlePrint = () => window.print();

  // ── Overview cards ──────────────────────────────────────────────────────────
  const OverviewSection = () => (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {kids.map((kid, i) => {
          const s = summerKids[kid.id] || {};
          const streak = s.currentStreak || 0;
          const totalXP = s.totalXPEarned || 0;
          const totalSessions = s.totalSessionsCompleted || 0;
          const weeksElapsed = getWeeksElapsed();
          const expectedSessions = weeksElapsed * SUMMER_CONFIG.daysPerWeek;
          const attendancePct = expectedSessions > 0
            ? Math.round((totalSessions / expectedSessions) * 100)
            : 0;
          const dollarsEarned = totalXP * SUMMER_CONFIG.xpToCents;
          const trackInfo = KID_TRACKS[kid.name] || {};
          const color = kidColors[i % 3];

          return (
            <div key={kid.id} style={{
              background: 'var(--s2)',
              border: `1px solid var(--b1)`,
              borderLeft: `4px solid ${color}`,
              borderRadius: 14,
              overflow: 'hidden',
            }}>
              {/* Kid header */}
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--b1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--tx1)' }}>{kid.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{trackInfo.grade} · {trackInfo.track}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color }}>
                    {streak >= 5 ? '🔥' : streak > 0 ? '⚡' : '○'}{streak}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--tx3)' }}>day streak</div>
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid var(--b1)' }}>
                {[
                  { val: totalSessions, label: 'sessions', sub: `of ${expectedSessions} sched.` },
                  { val: `+${totalXP}`, label: 'total XP', sub: `${s.longestStreak || 0} best streak` },
                  { val: formatDollars(dollarsEarned), label: 'earned', sub: `${SUMMER_CONFIG.dailyXP} XP/day` },
                ].map((st, j) => (
                  <div key={j} style={{ padding: '10px 8px', textAlign: 'center', borderRight: j < 2 ? '1px solid var(--b1)' : 'none' }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--tx1)' }}>{st.val}</div>
                    <div style={{ fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{st.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 2 }}>{st.sub}</div>
                  </div>
                ))}
              </div>

              {/* Attendance bar */}
              <div style={{ padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--tx3)', marginBottom: 5 }}>
                  <span>Season attendance</span>
                  <span style={{ color, fontWeight: 800 }}>{attendancePct}%</span>
                </div>
                <div style={{ background: 'var(--s4)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${attendancePct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {kids.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--tx3)' }}>
          No kid data yet. Make sure kids are set up in Firebase and have completed sessions.
        </div>
      )}
    </div>
  );

  // ── Weekly report section ───────────────────────────────────────────────────
  const WeeklySection = () => (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: 'var(--tx2)' }}>Week:</label>
        <select
          value={selectedWeek}
          onChange={e => setSelectedWeek(e.target.value)}
          style={{ background: 'var(--s3)', color: 'var(--tx1)', border: '1px solid var(--b2)', borderRadius: 7, padding: '5px 10px', fontSize: 13, fontFamily: 'inherit' }}
        >
          {availableWeeks.length
            ? availableWeeks.map(w => <option key={w} value={w}>{w}</option>)
            : <option value={selectedWeek}>{selectedWeek} (current)</option>
          }
        </select>
        <button
          onClick={handleGenerateWeekly}
          disabled={generating}
          style={{ background: 'var(--pud)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: generating ? 0.7 : 1 }}
        >
          ⚡ Generate Now
        </button>
        {genMsg && <span style={{ fontSize: 12, color: 'var(--te)' }}>{genMsg}</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {kids.map((kid, i) => {
          const report = weekly[kid.id]?.[selectedWeek];
          const color = kidColors[i % 3];
          if (!report) return (
            <div key={kid.id} style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderLeft: `4px solid ${color}`, borderRadius: 14, padding: '1rem', color: 'var(--tx3)', fontSize: 13 }}>
              <strong style={{ color: 'var(--tx1)' }}>{kid.name}</strong>
              <div style={{ marginTop: 8 }}>No report yet for {selectedWeek}. Click "Generate Now" above.</div>
            </div>
          );

          const attPct = Math.round(report.attendanceRate * 100);
          return (
            <div key={kid.id} style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderLeft: `4px solid ${color}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: 'var(--s3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color }}>{report.kidName}</div>
                <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{selectedWeek}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--b1)' }}>
                {[
                  { val: `${report.sessionsCompleted}/${report.sessionsScheduled}`, label: 'sessions' },
                  { val: `+${report.xpEarned}`, label: 'XP' },
                  { val: formatDollars(report.centsEarned), label: 'earned' },
                  { val: `${report.currentStreak}🔥`, label: 'streak' },
                ].map((st, j) => (
                  <div key={j} style={{ padding: '8px 4px', textAlign: 'center', borderRight: j < 3 ? '1px solid var(--b1)' : 'none' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--tx1)' }}>{st.val}</div>
                    <div style={{ fontSize: 9, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{st.label}</div>
                  </div>
                ))}
              </div>
              {/* Focus split */}
              <div style={{ padding: '10px 14px' }}>
                {[
                  { label: '🔢 Math', val: report.mathSessions, total: report.sessionsCompleted },
                  { label: '📖 Literacy', val: report.literacySessions, total: report.sessionsCompleted },
                ].map(f => (
                  <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
                    <span style={{ width: 72, color: 'var(--tx2)', flexShrink: 0 }}>{f.label}</span>
                    <div style={{ flex: 1, background: 'var(--s4)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                      <div style={{ width: f.total ? `${(f.val / f.total) * 100}%` : '0%', height: '100%', background: color, borderRadius: 3 }} />
                    </div>
                    <span style={{ color: 'var(--tx3)', fontSize: 11, minWidth: 12 }}>{f.val}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--tx3)', marginTop: 6 }}>
                  <span>Season: {report.totalSessionsToDate} sessions · {report.totalXPToDate} XP</span>
                  <span style={{ color, fontWeight: 800 }}>{attPct}%</span>
                </div>
                <div style={{ background: 'var(--s4)', borderRadius: 3, height: 5, overflow: 'hidden', marginTop: 4 }}>
                  <div style={{ width: `${attPct}%`, height: '100%', background: color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Monthly report section ──────────────────────────────────────────────────
  const MonthlySection = () => (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: 'var(--tx2)' }}>Month:</label>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          style={{ background: 'var(--s3)', color: 'var(--tx1)', border: '1px solid var(--b2)', borderRadius: 7, padding: '5px 10px', fontSize: 13, fontFamily: 'inherit' }}
        >
          {availableMonths.length
            ? availableMonths.map(m => <option key={m} value={m}>{m}</option>)
            : <option value={selectedMonth}>{selectedMonth} (current)</option>
          }
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {kids.map((kid, i) => {
          const report = monthly[kid.id]?.[selectedMonth];
          const color = kidColors[i % 3];
          if (!report) return (
            <div key={kid.id} style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderLeft: `4px solid ${color}`, borderRadius: 14, padding: '1rem', color: 'var(--tx3)', fontSize: 13 }}>
              <strong style={{ color: 'var(--tx1)' }}>{kid.name}</strong>
              <div style={{ marginTop: 8 }}>No monthly report yet for {selectedMonth}. Reports auto-generate on the 1st of each month.</div>
            </div>
          );

          const attPct = Math.round(report.attendanceRate * 100);
          const weeks = report.weeklyBreakdown
            ? Object.entries(report.weeklyBreakdown).sort(([a], [b]) => a.localeCompare(b))
            : [];

          return (
            <div key={kid.id} style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderLeft: `4px solid ${color}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: 'var(--s3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color }}>{report.kidName}</div>
                <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{report.month}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--b1)' }}>
                {[
                  { val: `${report.totalSessions}/${report.scheduledSessions}`, label: 'sessions' },
                  { val: `+${report.totalXPEarned}`, label: 'XP' },
                  { val: formatDollars(report.totalDollarsEarned), label: 'earned' },
                  { val: `${report.bestStreak}🔥`, label: 'best str.' },
                ].map((st, j) => (
                  <div key={j} style={{ padding: '8px 4px', textAlign: 'center', borderRight: j < 3 ? '1px solid var(--b1)' : 'none' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--tx1)' }}>{st.val}</div>
                    <div style={{ fontSize: 9, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{st.label}</div>
                  </div>
                ))}
              </div>

              {/* Attendance */}
              <div style={{ padding: '8px 14px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--tx3)', marginBottom: 4 }}>
                  <span>Monthly attendance</span>
                  <span style={{ color, fontWeight: 800 }}>{attPct}%</span>
                </div>
                <div style={{ background: 'var(--s4)', borderRadius: 3, height: 6, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ width: `${attPct}%`, height: '100%', background: color }} />
                </div>
              </div>

              {/* Week breakdown */}
              {weeks.length > 0 && (
                <div style={{ padding: '0 14px 12px' }}>
                  <div style={{ fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Week breakdown</div>
                  {weeks.map(([wk, data]) => (
                    <div key={wk} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, fontSize: 11 }}>
                      <span style={{ width: 54, color: 'var(--tx3)', flexShrink: 0, fontSize: 10 }}>{wk.split('-W')[1] ? `Wk ${wk.split('-W')[1]}` : wk}</span>
                      <div style={{ flex: 1, background: 'var(--s4)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min((data.xp / 60) * 100, 100)}%`, height: '100%', background: color }} />
                      </div>
                      <span style={{ color, fontWeight: 700, minWidth: 36 }}>+{data.xp}</span>
                      <span style={{ color: 'var(--tx3)', minWidth: 22 }}>{data.sessions}d</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '0 0 2rem' }}>
      {/* Print styles */}
      <style>{`
        @media print {
          .summer-no-print { display: none !important; }
          body { background: white !important; color: black !important; }
        }
      `}</style>

      {/* Top action bar */}
      <div className="summer-no-print" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {['overview', 'weekly', 'monthly'].map(m => (
          <button
            key={m}
            onClick={() => setViewMode(m)}
            style={{
              background: viewMode === m ? 'var(--pu)' : 'var(--s3)',
              color: viewMode === m ? '#fff' : 'var(--tx2)',
              border: '1px solid var(--b2)',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textTransform: 'capitalize',
            }}
          >
            {m === 'overview' ? '📊 Overview' : m === 'weekly' ? '📅 Weekly' : '📆 Monthly'}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={handlePrint}
          style={{ background: 'var(--s3)', color: 'var(--tx2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          🖨️ Export PDF
        </button>
      </div>

      {/* Program status banner */}
      {isProgramActive() ? (
        <div style={{ background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.25)', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: 'var(--pul)', marginBottom: 16 }}>
          ☀️ Program active · Week {getWeeksElapsed()} of ~10 · {SUMMER_CONFIG.dailyXP} XP/session · Streak bonus at {SUMMER_CONFIG.streakBonusThreshold} days
        </div>
      ) : (
        <div style={{ background: 'rgba(45,212,167,0.08)', border: '1px solid rgba(45,212,167,0.2)', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: 'var(--te)', marginBottom: 16 }}>
          Program starts {SUMMER_CONFIG.startDate} · Get the kids excited!
        </div>
      )}

      {viewMode === 'overview' && <OverviewSection />}
      {viewMode === 'weekly' && <WeeklySection />}
      {viewMode === 'monthly' && <MonthlySection />}
    </div>
  );
}
