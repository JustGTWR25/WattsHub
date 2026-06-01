/**
 * summerConfig.js — single source of truth for summer program settings.
 * Updated: start date set to today (June 1 2026), streak counts Mon–Thu only.
 */
export const PATHS = {
  kidsRoot:       'wh/kids',
  XP_FIELD:       'xp',
  DOLLARS_FIELD:  'balanceCents',
  summerKids:     'wh/summerProgram/kids',
  summerSessions: 'wh/summerSessions',
  reportsWeekly:  'wh/reports/weekly',
  reportsMonthly: 'wh/reports/monthly',
};

export const SUMMER_CONFIG = {
  startDate:             '2026-06-01',  // updated to today
  endDate:               '2026-08-15',
  dailyXP:               10,
  streakBonusThreshold:  5,             // 5 consecutive Mon–Thu sessions
  streakBonusMultiplier: 1.5,           // 15 XP instead of 10
  xpToCents:             5,             // 10 XP = $0.50/session
};

// Mon/Wed = Math, Tue/Thu = Literacy. Fri/Sat/Sun = no session.
export const FOCUS_BY_DAY = {
  Monday:    'math',
  Tuesday:   'literacy',
  Wednesday: 'math',
  Thursday:  'literacy',
};

export const KID_TRACKS = {
  Tayonna: { grade: '12th', track: 'Lit & Advanced Math',  color: '#6C63FF' },
  Brianna: { grade: '9th',  track: 'Algebra & Art',         color: '#FF6B9D' },
  Leon:    { grade: '5th',  track: 'Writing & Pre-Algebra', color: '#00C9A7' },
};

// Valid program session days (Mon=1 … Thu=4)
export const SESSION_DAYS = new Set([1, 2, 3, 4]);

/** Returns true if the given Date falls on a Mon–Thu */
export function isSessionDay(date) {
  return SESSION_DAYS.has(new Date(date).getDay());
}

/** Returns true if today is within the program window */
export function isProgramActive() {
  const now = new Date();
  return now >= new Date(SUMMER_CONFIG.startDate) && now <= new Date(SUMMER_CONFIG.endDate);
}

/** Weeks elapsed since program start (min 1) */
export function getWeeksElapsed() {
  const start = new Date(SUMMER_CONFIG.startDate);
  const now = new Date();
  if (now < start) return 0;
  return Math.max(1, Math.ceil((now - start) / (7 * 86400000)));
}

export function fmtDollars(cents) {
  return `$${((cents || 0) / 100).toFixed(2)}`;
}
