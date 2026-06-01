/**
 * summerConfig.js
 * Single source of truth for all Summer Program Firebase paths and settings.
 * Edit ONLY this file when your Firebase structure changes.
 *
 * HOW TO CONFIRM YOUR PATHS:
 *  1. Open Firebase Console → Realtime Database
 *  2. Click any kid node under wh/kids/
 *  3. Check the exact field names for XP and dollars
 *  4. Update XP_FIELD and DOLLARS_FIELD below
 */

// ─── Firebase path config ─────────────────────────────────────────────────────

export const PATHS = {
  // Your existing kid nodes — confirmed: XP lives here
  kidsRoot:        'wh/kids',
  XP_FIELD:        'xp',           // ← confirmed by Greg: XP stored on each kid
  DOLLARS_FIELD:   'balanceCents', // ← UPDATE if yours is 'allowance' or 'dollars'

  // Summer program nodes (new, additive)
  summerConfig:    'wh/summerProgram/config',
  summerKids:      'wh/summerProgram/kids',
  summerSessions:  'wh/summerProgram/sessions',
  reportsWeekly:   'wh/reports/weekly',
  reportsMonthly:  'wh/reports/monthly',
};

// ─── Program settings ─────────────────────────────────────────────────────────

export const SUMMER_CONFIG = {
  startDate:              '2026-06-09',
  endDate:                '2026-08-15',
  dailyXP:                10,           // flat XP per completed session
  streakBonusThreshold:   5,            // sessions before bonus kicks in
  streakBonusMultiplier:  1.5,          // 5-day streak = 15 XP instead of 10
  daysPerWeek:            4,            // Mon–Thu
  sessionMinutes:         60,
  // 5 cents per XP → 10 XP = $0.50/day = $2.00/week perfect attendance
  // balanceCents is stored in CENTS — so 10 XP × 5 = 50 cents
  xpToCents:              5,
};

// ─── Kid schedule — focus alternates Mon/Wed = Math, Tue/Thu = Literacy ───────

export const FOCUS_BY_DAY = {
  Monday:    'math',
  Tuesday:   'literacy',
  Wednesday: 'math',
  Thursday:  'literacy',
};

// ─── Per-kid display config (grade + track label) ─────────────────────────────
// Keys match whatever name is stored in wh/kids/{id}/name
export const KID_TRACKS = {
  Tayonna: { grade: '12th',  track: 'Lit & Advanced Math',  color: '#6C63FF' },
  Brianna: { grade: '9th',   track: 'Algebra & Art',         color: '#FF6B9D' },
  Leon:    { grade: '5th',   track: 'Writing & Pre-Algebra', color: '#00C9A7' },
};
