// Daily Check-in — Eaze
// Login + tester-mode scenario system, modeled on the actual Dostt Free
// Rewards app (root.innerHTML render loop, animated login button, country
// bottom sheet, test-phone -> scenario picker, persistent tester toolbar with
// live overrides) and reskinned with the Eaze design tokens.
// Real users hit the backend in backend/ (see "Real backend integration"
// below) — EazeScore and check-in history persist for real. Testers stay on
// the local scenario simulator and never touch the real API, so QA/demo data
// can never pollute a real account.

const MOODS = [
  { value: 1, emoji: "😞", label: "Rough" },
  { value: 2, emoji: "😕", label: "Low" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
];

// Manually authored copy (see eaze-checkin-reaffirmations.md) — one of the
// five is chosen at random per mood, independent of any note text. No AI
// involvement in generating or selecting these.
const REAFFIRM_MESSAGES = {
  Rough: [
    "Today was heavy, and you're still here. That's not nothing — that's strength showing up quietly.",
    "It's okay for a day to just be hard. You don't have to make sense of it tonight.",
    "You made it through something difficult today. That deserves to be noticed, even by no one but you.",
    "Some days ask more of us than we have to give. Showing up here, even like this, still counts.",
    "You don't need to explain the rough days. Feeling them fully is its own kind of honesty.",
  ],
  Low: [
    "It sounds like today felt like a weight. You don't have to carry it alone or explain it away.",
    "Low days don't erase the good ones — they just mean today needs a little more gentleness.",
    "You noticed how you felt instead of pushing past it. That's a quiet act of self-respect.",
    "It's alright to not be okay today. Naming it is already a way of taking care of yourself.",
    "Some days feel dimmer, and that's real. You're still moving through it, one moment at a time.",
  ],
  Okay: [
    "A steady, \"okay\" day is still a day you got through. That's worth acknowledging too.",
    "Not every day needs to be remarkable. Okay is its own kind of stable ground.",
    "You showed up for yourself today, even in an ordinary way. That consistency matters.",
    "It's fine for today to be unremarkable. You don't need a big feeling to justify checking in.",
    "Middle-of-the-road days build the foundation the brighter ones stand on. This one counts.",
  ],
  Good: [
    "Today felt good, and you let yourself notice that. That's worth holding onto for a moment.",
    "It's good to see you here on an easier day, not just the hard ones. That balance matters.",
    "You gave yourself credit for a good day. That's a habit worth keeping.",
    "A good day is a gift you can actually feel. Glad this one landed that way for you.",
    "Noticing when things feel good is its own kind of self-awareness. Keep doing that.",
  ],
  Great: [
    "Today felt great, and you took a moment to really feel that. Let it sink in fully.",
    "It's wonderful when a day lifts you up like this. You deserve every bit of it.",
    "Great days are worth savoring, not rushing past. Take this feeling with you into tomorrow.",
    "You showed up on a great day too, not just to track the hard ones. That's balance.",
    "Hold onto this feeling for a bit. Days like this are proof of what's possible.",
  ],
};

const COUNTRIES = [
  { flag: "🇮🇳", name: "India", code: "+91" },
  { flag: "🇸🇦", name: "Saudi Arabia", code: "+966" },
  { flag: "🇳🇵", name: "Nepal", code: "+977" },
  { flag: "🇧🇩", name: "Bangladesh", code: "+880" },
  { flag: "🇧🇭", name: "Bahrain", code: "+973" },
  { flag: "🇶🇦", name: "Qatar", code: "+974" },
  { flag: "🇴🇲", name: "Oman", code: "+968" },
  { flag: "🇦🇪", name: "UAE", code: "+971" },
  { flag: "🇰🇼", name: "Kuwait", code: "+965" },
  { flag: "🇱🇰", name: "Sri Lanka", code: "+94" },
  { flag: "🇬🇧", name: "United Kingdom", code: "+44" },
  { flag: "🇺🇸", name: "United States", code: "+1" },
];

const TEST_PHONES = ["9999999999"];
const EAZE_LOGO_SRC = "assets/eaze-logo.png?v=3";
const EAZE_LOGO_WHITE_SRC = "assets/eaze-logo-white.png?v=1";

// One outline icon family: thin stroke, rounded joins, no fill — used in
// place of decorative emoji anywhere an emoji would otherwise sit inside a
// colored/rounded container (mood emoji stay as emoji — that's the user's
// own selected data, not decoration).
const ICONS = {
  flame:
    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3c1.2 2.4 3.6 3.9 3.6 7.2a3.6 3.6 0 0 1-1.2 2.7c1.8-.3 3-1.8 3-3.9 1.5 1.8 2.4 3.9 2.4 6 0 3.6-3 6-7.8 6S4.2 19.6 4.2 16c0-4.2 3-6.6 4.8-9.6.3 1.8 1.5 3 1.5 3S9 6.6 12 3Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // Filled variant of the same flame — marks the streak as active, per the
  // handbook's outline/filled pairing convention.
  flameFilled:
    '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 3c1.2 2.4 3.6 3.9 3.6 7.2a3.6 3.6 0 0 1-1.2 2.7c1.8-.3 3-1.8 3-3.9 1.5 1.8 2.4 3.9 2.4 6 0 3.6-3 6-7.8 6S4.2 19.6 4.2 16c0-4.2 3-6.6 4.8-9.6.3 1.8 1.5 3 1.5 3S9 6.6 12 3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  trend:
    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 16l5-5 4 4 7-8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7h4v4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  flask:
    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 3h6M10 3v5.5L5.5 17a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 8.5V3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  backArrow:
    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14" style="vertical-align:-2px"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function moodByValue(value) {
  return MOODS.find((m) => m.value === value) || MOODS[2];
}

function pickMessage(value) {
  const options = REAFFIRM_MESSAGES[moodByValue(value).label];
  return options[Math.floor(Math.random() * options.length)];
}

function dayLabel(offsetFromToday) {
  if (offsetFromToday === 0) return "Today";
  const d = new Date();
  d.setDate(d.getDate() - offsetFromToday);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

// Backend timestamps are stored and serialized as naive UTC (no trailing
// "Z") — without adding it back, `new Date(...)` would silently reinterpret
// them as local time instead of UTC, throwing off every hour-based bucket
// below by the browser's UTC offset.
function parseUtc(isoStr) {
  if (!isoStr) return null;
  return new Date(/[Z]|[+-]\d\d:\d\d$/.test(isoStr) ? isoStr : `${isoStr}Z`);
}

// Multiple check-ins a day are bucketed by local time of day rather than by
// weekday — that's the axis a same-day chart actually needs.
function timeOfDayLabel(dateObj) {
  const h = dateObj.getHours();
  if (h >= 5 && h < 12) return "Morning";
  if (h >= 12 && h < 17) return "Afternoon";
  if (h >= 17 && h < 21) return "Evening";
  return "Night";
}

function shortDateLabel(dateObj) {
  const now = new Date();
  const isToday = dateObj.toDateString() === now.toDateString();
  if (isToday) return "Today";
  return dateObj.toLocaleDateString(undefined, { weekday: "long" });
}

function formatClockTime(dateObj) {
  return dateObj.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// "YYYY-MM-DD" in LOCAL time — the grouping key for the day-level chart view.
// Deliberately not UTC: a 11pm check-in and a 1am check-in the same local
// night should land in different day groups exactly the way the user
// experienced them, which UTC slicing would get wrong near midnight.
function localDateKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysAgoFromKey(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((today - target) / 86400000);
}

// How many recent days the multi-day overview shows — a week, matching the
// streak row's own 7-day window.
const OVERVIEW_DAYS_WINDOW = 7;

// One point per calendar day (averaged, so a 3-check-in day still reads as a
// single trend point) — the top level of the Health-app-style drill-down.
function groupEntriesByDay(entries) {
  const map = new Map();
  entries.forEach((e) => {
    const key = localDateKey(e.at);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  });
  const days = [...map.entries()]
    .map(([dateKey, dayEntries]) => ({
      dateKey,
      avgValue: dayEntries.reduce((sum, e) => sum + e.value, 0) / dayEntries.length,
      count: dayEntries.length,
    }))
    .sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1));
  return days.slice(-OVERVIEW_DAYS_WINDOW);
}

// Every check-in on one specific day, oldest to newest — the drill-down
// level, showing each individual mood the user logged that day.
function entriesForDay(entries, dateKey) {
  return entries.filter((e) => localDateKey(e.at) === dateKey).sort((a, b) => a.at - b.at);
}

// ---------- Tester scenarios ----------
// Mirrors the reference app's api / direct_select / bypass / real tester
// modes: pick a scenario from a modal, get preset data, tweak it live from a
// persistent toolbar — reworked here around streak/mood data instead of spend.
function buildStreakDays(pastCount) {
  // Filled days occupy the leftmost circles (0..n-1) with no gap before them.
  // Today's still-pending check-in isn't one of these — it's whichever slot
  // comes right after the filled streak (handled at render/save time).
  const n = Math.max(0, Math.min(6, pastCount));
  return Array.from({ length: 7 }, (_, i) => i < n);
}

// Same shape, but for when the exact total filled count is already known
// (restoring real data from the API) and there's no later "flip today's
// dot" step coming — unlike buildStreakDays, doesn't reserve a slot.
function buildFilledStreakDays(filledCount) {
  const n = Math.max(0, Math.min(7, filledCount));
  return Array.from({ length: 7 }, (_, i) => i < n);
}

// Spreads the scenario's 7 seed values across the last 4 calendar days (2-2-1-2
// entries), at varied times of day, so testers see the same two-level chart a
// real multiple-check-ins-a-day user would: a multi-day overview, and a
// same-day drill-down with several time-of-day points.
const SEED_DAY_OFFSETS = [3, 3, 2, 2, 1, 0, 0];
const SEED_HOURS = [9, 19, 10, 20, 14, 8, 20];

function buildCheckInEntries(seedValues) {
  // Whether there's history to show is a property of the scenario (has this
  // person ever logged a mood?), not of the current streak count — a broken
  // streak still has a past, it just isn't consecutive up to today.
  if (!seedValues || !seedValues.length) return [];
  const now = new Date();
  return seedValues
    .map((value, i) => {
      const at = new Date(now);
      at.setDate(at.getDate() - SEED_DAY_OFFSETS[i % SEED_DAY_OFFSETS.length]);
      at.setHours(SEED_HOURS[i % SEED_HOURS.length], 0, 0, 0);
      return { value, at, message: pickMessage(value) };
    })
    .sort((a, b) => a.at - b.at);
}

const SCENARIOS = {
  fresh: {
    label: "Fresh Start",
    desc: "Brand new user · no streak, no mood history yet",
    streakCount: 0,
    moodValues: [],
  },
  active: {
    label: "Active Streak",
    desc: "3-day streak · a week of mood history (default)",
    streakCount: 3,
    moodValues: [3, 4, 3, 5, 4, 4, 5],
  },
  full: {
    label: "Full Week",
    desc: "6-day streak · one check-in away from a full week",
    streakCount: 6,
    moodValues: [4, 4, 5, 4, 5, 5, 4],
  },
  broken: {
    label: "Broken Streak",
    desc: "Streak just reset to 0 · rougher recent moods",
    streakCount: 0,
    moodValues: [4, 3, 2, 3, 2, 3, 2],
  },
};

const POINTS_PER_CHECKIN = 10;
const WEEKLY_STREAK_BONUS = 50;

function scenarioState(key) {
  const s = SCENARIOS[key] || SCENARIOS.active;
  const checkInEntries = buildCheckInEntries(s.moodValues);
  const days = groupEntriesByDay(checkInEntries);
  return {
    checkInEntries,
    streakDays: buildStreakDays(s.streakCount),
    // 10 points per day of the current streak — a 3-day streak is 30 points,
    // full stop. Mood history is a separate concept (the last 7 calendar
    // days, whether or not they're consecutive) and doesn't factor in here.
    eazeScore: s.streakCount * POINTS_PER_CHECKIN,
    lastBonusAwarded: false,
    // One day of history or less -> skip straight to the drill-down view (a
    // single-dot "overview" isn't useful); several days -> start at the
    // Health-app-style multi-day overview.
    chartView: days.length <= 1 ? "day" : "overview",
    chartSelectedDate: days.length ? days[days.length - 1].dateKey : null,
    chartViewUserSet: false,
  };
}

// ---------- Real backend integration ----------
// Testers are unaffected by any of this — they stay on the local scenario
// simulator above. Non-tester users hit the actual API so EazeScore and
// check-in history survive a refresh instead of resetting to scripted demo
// data every load.
const API_BASE = "http://localhost:8000";

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.detail || `POST ${path} failed: ${res.status}`);
  }
  return res.json();
}

// Safety cap on how many raw check-ins stay in memory — generous relative to
// what the 7-day overview + drill-down actually need, just guards against
// unbounded growth for a very long-term, very frequent user.
const RAW_ENTRIES_CAP = 90;

// Maps the API's raw check-in list + score state into this app's existing
// UI shape (checkInEntries / streakDays / checkedInToday / nextCheckinAt /
// eazeScore) — same shape scenarioState() produces, so rendering code
// doesn't need to know whether the data came from a scenario or the real
// backend. Does NOT set chartView/chartSelectedDate — callers decide whether
// to compute a fresh default or preserve whatever the user is browsing (see
// ensureChartViewDefault).
function computeStateFromApi(checkIns, scoreState) {
  const checkInEntries = [...checkIns]
    .map((c) => ({ value: c.mood, at: parseUtc(c.created_at), message: pickMessage(c.mood) }))
    .sort((a, b) => a.at - b.at)
    .slice(-RAW_ENTRIES_CAP);

  return {
    checkInEntries,
    // scoreState.streak already counts today when checked in (see the
    // backend's GET /eaze-score) — it's exactly the dot count to show, no
    // adjustment needed.
    streakDays: buildFilledStreakDays(scoreState.streak),
    checkedInToday: scoreState.checked_in_today,
    nextCheckinAt: scoreState.next_checkin_at,
    eazeScore: scoreState.earned,
    lastBonusAwarded: false,
    sessionsCount: scoreState.sessions_count,
    todayEarned: scoreState.today_earned,
  };
}

// Picks (or re-picks) the chart's view: a single day of history goes
// straight to the drill-down, several days start at the multi-day overview.
// Keeps recomputing on every fetch — a user who only had today's entry
// yesterday and has 4 days of history now should see the overview appear,
// not stay stuck on day-1 forever. The ONE exception is once the user has
// manually navigated the chart themselves (drilled into a day, or hit "All
// days") — chartViewUserSet then latches true and this becomes a no-op, so a
// background refetch never yanks them out of a day they deliberately opened.
function ensureChartViewDefault() {
  if (state.chartViewUserSet) return;
  const days = groupEntriesByDay(state.checkInEntries);
  if (days.length <= 1) {
    state.chartView = "day";
    state.chartSelectedDate = days.length ? days[days.length - 1].dateKey : null;
  } else {
    state.chartView = "overview";
    state.chartSelectedDate = null;
  }
}

// EazeScore home page (real users) — lighter than loadRealUserData: only
// needs the score/streak/session totals, not the full mood history. Calling
// this is also what triggers the one-time welcome bonus server-side (see
// GET /eaze-score/{phone}) — safe to call every time the home page loads,
// since the backend only ever pays it out once per user.
async function loadHomeData(phone) {
  try {
    const scoreState = await apiGet(`/eaze-score/${phone}`);
    Object.assign(state, {
      eazeScore: scoreState.earned,
      streakDays: buildFilledStreakDays(scoreState.streak),
      sessionsCount: scoreState.sessions_count,
      todayEarned: scoreState.today_earned,
      welcomeBonusJustAwarded: scoreState.welcome_bonus_awarded_now,
      checkedInToday: scoreState.checked_in_today,
      nextCheckinAt: scoreState.next_checkin_at,
    });
  } catch (err) {
    console.error("Failed to load EazeScore home data", err);
    Object.assign(state, {
      eazeScore: 0,
      streakDays: buildStreakDays(0),
      sessionsCount: 0,
      todayEarned: 0,
      welcomeBonusJustAwarded: false,
      checkedInToday: false,
      nextCheckinAt: null,
    });
  }
  render();
}

// Fire-and-forget: called right after the first render so the logged-in
// shell shows instantly, then re-renders once real data arrives. On
// failure, falls back to an honest zeroed state rather than fake demo
// numbers — a real user should never see scripted data.
async function loadRealUserData(phone) {
  try {
    const [scoreState, checkIns] = await Promise.all([
      apiGet(`/eaze-score/${phone}`),
      apiGet(`/checkins/${phone}`),
    ]);
    Object.assign(state, computeStateFromApi(checkIns, scoreState));
    ensureChartViewDefault();
  } catch (err) {
    console.error("Failed to load EazeScore/check-in history", err);
    Object.assign(state, {
      checkInEntries: [],
      streakDays: buildStreakDays(0),
      checkedInToday: false,
      nextCheckinAt: null,
      eazeScore: 0,
      lastBonusAwarded: false,
    });
  }
  render();
}

// ---------- State ----------
const state = {
  view: "login",
  phone: "",
  country: COUNTRIES[0],
  showCountrySheet: false,
  countrySearch: "",

  isTester: false,
  testMode: null,
  showTestModal: false,

  // Raw check-in entries ({ value, at: Date, message }), oldest to newest —
  // the single source both chart views (multi-day overview and single-day
  // drill-down) derive from.
  checkInEntries: [],
  // 'overview' (one averaged point per day) or 'day' (every entry on one
  // specific day) — see ensureChartViewDefault for how the initial value is
  // chosen. Null until the first real fetch (or tester scenario) resolves.
  chartView: null,
  // Date key ("YYYY-MM-DD", local) the 'day' view is currently drilled into.
  chartSelectedDate: null,
  // True once the user has manually drilled into a day or hit "All days" —
  // stops ensureChartViewDefault from auto-managing chartView any further
  // this session (see its comment).
  chartViewUserSet: false,
  // Index into that day's entries (from entriesForDay) for the open
  // individual-entry modal, or null when it's closed.
  selectedEntryIdx: null,
  streakDays: buildStreakDays(0),
  selectedMood: null,
  // Whether today already has a check-in (drives the streak dot) — separate
  // from the cooldown below, since a user can be checked in for today and
  // still be waiting on their next 3-hour window.
  checkedInToday: false,
  // ISO timestamp (UTC) of when the next check-in becomes eligible for
  // points, or null if one can be submitted right now.
  nextCheckinAt: null,
  submitting: false,
  eazeScore: 0,
  lastBonusAwarded: false,

  // Lifetime-score home page (login -> home -> checkin).
  sessionsCount: 0,
  todayEarned: 0,
  welcomeBonusJustAwarded: false,
  showRulesModal: false,
};

(function restoreSession() {
  const saved = localStorage.getItem("checkin_session");
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    state.phone = parsed.phone || "";
    state.country = parsed.country || COUNTRIES[0];
  } catch {
    return;
  }
  state.isTester = TEST_PHONES.includes(state.phone);
  if (state.isTester) {
    const savedMode = localStorage.getItem("checkin_testMode");
    if (savedMode && SCENARIOS[savedMode]) {
      state.testMode = savedMode;
      Object.assign(state, scenarioState(savedMode));
      state.view = "checkin";
    } else {
      state.showTestModal = true;
    }
  } else {
    // Real user: land on the EazeScore home page every time, same as right
    // after login — show the clean/zeroed shell immediately, then fetch
    // actual persisted data below (after the initial render() at the bottom
    // of this file). No more scripted demo scores.
    state.view = "home";
  }
})();

const root = document.getElementById("root");
let els = {};

function queryEls() {
  els = {
    moodPicker: document.getElementById("mood-picker"),
    textarea: document.getElementById("reflection-text"),
    saveBtn: document.getElementById("save-btn"),
    saveBtnLabel: document.getElementById("save-btn-label"),
    doneNote: document.getElementById("done-note"),
    noteCounter: document.getElementById("note-counter"),
    reaffirmCard: document.getElementById("reaffirm-card"),
    reaffirmText: document.getElementById("reaffirm-text"),
    streakPillText: document.getElementById("streak-pill-text"),
    chart: document.getElementById("mood-chart"),
    chartAxis: document.getElementById("chart-axis"),
    chartEmpty: document.getElementById("chart-empty"),
    chartWrap: document.getElementById("chart-wrap"),
    chartScroll: document.getElementById("chart-scroll"),
    streakDots: document.getElementById("streak-dots"),
    streakCaption: document.getElementById("streak-caption"),
    scoreValue: document.getElementById("score-value"),
    scoreBonusChip: document.getElementById("score-bonus-chip"),
    scoreBarFill: document.getElementById("score-bar-fill"),
    scoreCaption: document.getElementById("score-caption"),
    sessionsValue: document.getElementById("sessions-value"),
  };
}

// ---------- Templates ----------
function loginPage() {
  return `
    <div class="login-screen">
      <div class="login-inner">
        <div class="login-brand">
          <img src="${EAZE_LOGO_SRC}" alt="Eaze" class="login-logo" />
          <span class="login-wordmark">eazeapp</span>
        </div>

        <h1 class="login-headline">Login to get started</h1>

        <div class="login-input-row">
          <button id="country-picker-btn" class="country-picker-btn" type="button">
            <span class="country-flag">${state.country.flag}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="country-code">${state.country.code}</span>
          </button>
          <input
            id="phone-input"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            maxlength="10"
            placeholder="Enter mobile number"
            value="${state.phone}"
            class="phone-input"
          />
        </div>

        <div id="login-btn-wrap" class="login-btn-wrap">
          <div id="login-progress-fill" class="login-progress-fill"></div>
          <button id="login-btn" class="login-btn" type="button">
            <span id="login-btn-label">Login</span>
          </button>
        </div>
        <p class="login-error" id="login-error"></p>

        <p class="login-hint">Tester number: ${TEST_PHONES[0]}</p>
      </div>
    </div>
    ${state.showCountrySheet ? countrySheet() : ""}
  `;
}

function countrySheet() {
  const query = state.countrySearch.toLowerCase();
  const filtered = COUNTRIES.filter(
    (c) => c.name.toLowerCase().includes(query) || c.code.includes(query)
  );
  return `
    <div id="sheet-overlay" class="sheet-overlay"></div>
    <div id="country-sheet" class="country-sheet">
      <div class="sheet-handle-wrap"><div class="sheet-handle"></div></div>
      <div class="sheet-search-wrap">
        <input id="country-search" type="text" placeholder="Search for country" autocomplete="off"
          value="${state.countrySearch}" class="sheet-search" />
      </div>
      <div class="sheet-list">
        ${filtered
          .map(
            (c) => `
          <button class="country-option" data-code="${c.code}" data-flag="${c.flag}" data-name="${c.name}">
            <span class="country-option-flag">${c.flag}</span>
            <span class="country-option-name">${c.name} (${c.code})</span>
          </button>`
          )
          .join("")}
      </div>
    </div>
  `;
}

function testModeModal() {
  return `
    <div id="test-modal-overlay" class="test-modal-overlay">
      <div class="test-modal">
        <div class="test-modal-title"><span class="test-modal-title-icon">${ICONS.flask}</span><h2>Tester Mode</h2></div>
        <p class="test-modal-subtitle">You're logged in with a test number. Choose a scenario to preview:</p>
        <div class="test-modal-options">
          ${Object.entries(SCENARIOS)
            .map(
              ([key, s]) => `
            <button class="test-option" data-scenario="${key}" type="button">
              <span class="test-option-label">${s.label}</span>
              <span class="test-option-desc">${s.desc}</span>
            </button>`
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function dayDetailModal() {
  const entries = entriesForDay(state.checkInEntries, state.chartSelectedDate);
  const entry = entries[state.selectedEntryIdx];
  if (!entry) return "";
  const mood = moodByValue(entry.value);
  const bucket = timeOfDayLabel(entry.at);
  const dateLbl = shortDateLabel(entry.at);
  return `
    <div id="day-detail-overlay" class="day-detail-overlay">
      <div class="day-detail-modal">
        <button id="day-detail-close" class="day-detail-close" type="button" aria-label="Close">✕</button>
        <span class="day-detail-emoji">${mood.emoji}</span>
        <p class="day-detail-day">${bucket} · ${dateLbl}</p>
        <p class="day-detail-mood">Feeling ${mood.label.toLowerCase()}</p>
        <p class="day-detail-message">${entry.message}</p>
      </div>
    </div>
  `;
}

function rulesModal() {
  return `
    <div id="rules-overlay" class="day-detail-overlay">
      <div class="day-detail-modal rules-modal">
        <button id="rules-close" class="day-detail-close" type="button" aria-label="Close">✕</button>
        <p class="day-detail-day">EazeScore Daily</p>
        <p class="day-detail-mood">How today's score works</p>
        <ul class="rules-list">
          <li>Check in every 3 hours to earn 10 points.</li>
          <li>A 7-day streak earns a 50-point bonus.</li>
          <li>A missed day resets streak, not score.</li>
          <li>Every point adds to your EazeScore.</li>
        </ul>
      </div>
    </div>
  `;
}

function testerToolbar() {
  const scenario = SCENARIOS[state.testMode] || SCENARIOS.active;
  return `
    <div class="tester-toolbar">
      <div class="tester-toolbar-row">
        <span class="tester-badge">🧪 ${scenario.label}</span>
        <button id="tester-change-btn" class="tester-link-btn" type="button">Change</button>
        <button id="tester-logout-btn" class="tester-link-btn" type="button">Log out</button>
      </div>
      <div class="tester-toolbar-row tester-sim-row">
        <span class="tester-sim-label">Simulate streak:</span>
        <input id="tester-streak-input" type="number" min="0" max="6" value="${currentStreakCount()}" class="tester-sim-input" />
        <button id="tester-sim-set" class="tester-mini-btn tester-mini-btn--set" type="button">Set</button>
        <button id="tester-sim-reset" class="tester-mini-btn" type="button">Reset</button>
      </div>
    </div>
  `;
}

function homePage() {
  return `
    ${state.isTester ? testerToolbar() : ""}
    <main class="container">
      <header class="page-header">
        <div class="header-row">
          <div>
            <p class="eyebrow">EazeScore</p>
            <h1 class="headline">Your lifetime EazeScore</h1>
          </div>
          <div class="eaze-logo" aria-label="Eaze">
            <img src="${EAZE_LOGO_WHITE_SRC}" alt="Eaze" width="44" height="44" />
          </div>
        </div>
      </header>

      ${
        state.welcomeBonusJustAwarded
          ? `<p class="welcome-bonus-banner" id="welcome-bonus-banner">Welcome bonus — +20 added to your EazeScore</p>`
          : ""
      }

      <section class="card score-card" id="score-card">
        <div class="score-header">
          <span class="score-label"><img src="${EAZE_LOGO_WHITE_SRC}" alt="" class="score-icon" /> EazeScore</span>
          <span class="score-value-row">
            <span class="score-value" id="score-value">0</span>
            <span class="score-bonus-text" id="score-bonus-chip" hidden>+${WEEKLY_STREAK_BONUS} bonus</span>
          </span>
        </div>
        <div class="score-bar-track">
          <div class="score-bar-ticks"><span></span><span></span><span></span><span></span><span></span></div>
          <div class="score-bar-fill" id="score-bar-fill"></div>
        </div>
        <p class="score-caption" id="score-caption"></p>
      </section>

      <section class="card sessions-card">
        <p class="sessions-label">Sessions completed</p>
        <p class="sessions-value" id="sessions-value">${state.sessionsCount}</p>
        <p class="sessions-caption">Check-ins that built this score</p>
      </section>

      <button class="home-banner" id="checkin-banner-btn" type="button">
        <span class="home-banner-text">
          <span class="home-banner-title">Ready for today's check-in?</span>
          <span class="home-banner-sub">Check in now to keep your streak going</span>
        </span>
        <svg class="home-banner-arrow" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>

      ${!state.isTester ? `<button id="logout-btn" class="logout-link" type="button">Log out</button>` : ""}
    </main>
  `;
}

function checkinPage() {
  return `
    ${state.isTester ? testerToolbar() : ""}
    <main class="container">
      <button id="back-to-home-btn" class="back-link" type="button">${ICONS.backArrow} EazeScore</button>
      <header class="page-header">
        <div class="header-row">
          <div>
            <p class="eyebrow">Daily Check-in</p>
            <h1 class="headline">How are you feeling right now?</h1>
          </div>
          <div class="eaze-logo" aria-label="Eaze">
            <img src="${EAZE_LOGO_WHITE_SRC}" alt="Eaze" width="44" height="44" />
          </div>
        </div>
        <div class="streak-row" id="streak-pill">
          <span class="streak-icon">${ICONS.flameFilled}</span>
          <span class="streak-text" id="streak-pill-text"></span>
        </div>
      </header>

      <section class="card score-card" id="score-card">
        <div class="score-header">
          <button class="score-label" id="daily-rules-btn" type="button" aria-haspopup="dialog">
            <img src="${EAZE_LOGO_WHITE_SRC}" alt="" class="score-icon" /> EazeScore Daily
            <span class="score-label-hint" aria-hidden="true">?</span>
          </button>
          <span class="score-value-row">
            <span class="score-value" id="score-value">0</span>
            <span class="score-bonus-text" id="score-bonus-chip" hidden>+${WEEKLY_STREAK_BONUS} bonus</span>
          </span>
        </div>
        <div class="score-bar-track">
          <div class="score-bar-ticks"><span></span><span></span><span></span><span></span><span></span></div>
          <div class="score-bar-fill" id="score-bar-fill"></div>
        </div>
        <p class="score-caption" id="score-caption"></p>
      </section>

      <section class="card entry-card" id="entry-card">
        <p class="entry-prompt">Pick how you're feeling right now</p>
        <div class="mood-picker" id="mood-picker" role="radiogroup" aria-label="Select your mood"></div>

        <label class="field-label" for="reflection-text">Add a note <span class="optional-tag">(optional, 100 words max)</span></label>
        <textarea
          id="reflection-text"
          class="reflection-textarea"
          placeholder="Write freely — this is just for you…"
          rows="2"
        ></textarea>
        <p class="note-counter" id="note-counter">0/100 words</p>

        <button class="btn btn--filled" id="save-btn" disabled>
          <span id="save-btn-label">Save</span>
        </button>

        <p class="done-note" id="done-note" hidden></p>
      </section>

      <section class="card reaffirm-card" id="reaffirm-card" hidden>
        <p class="reaffirm-text" id="reaffirm-text"></p>
      </section>

      <div class="grid-two">
        <section class="card chart-card">
          <div class="chart-card-header">
            <h2 class="section-label"><span class="section-icon">${ICONS.trend}</span>Mood Over Time</h2>
            ${
              state.chartView === "day" && groupEntriesByDay(state.checkInEntries).length > 1
                ? `<button id="chart-back-btn" class="chart-back-btn" type="button">${ICONS.backArrow} All days</button>`
                : ""
            }
          </div>
          <div id="chart-wrap" class="chart-wrap">
            <div id="chart-scroll" class="chart-scroll">
              <svg id="mood-chart"></svg>
              <div class="chart-axis" id="chart-axis"></div>
            </div>
          </div>
          <p class="chart-empty" id="chart-empty" hidden>
            Check in today and your mood chart will start showing up here.
          </p>
        </section>

        <section class="card streak-card">
          <h2 class="section-label"><span class="section-icon">${ICONS.flame}</span>Your Streak</h2>
          <div class="streak-dots" id="streak-dots"></div>
          <p class="streak-caption" id="streak-caption"></p>
        </section>
      </div>

      ${!state.isTester ? `<button id="logout-btn" class="logout-link" type="button">Log out</button>` : ""}
    </main>
  `;
}

// ---------- Render dispatcher ----------
// Ticks the check-in page while its cooldown countdown is showing, so "next
// check-in opens at HH:MM" clears itself once true, instead of staying
// stuck disabled until the user manually reloads.
let cooldownTimer = null;

function render() {
  if (cooldownTimer) {
    clearInterval(cooldownTimer);
    cooldownTimer = null;
  }

  if (state.view === "login") {
    root.innerHTML = loginPage() + (state.showTestModal ? testModeModal() : "");
    wireLoginEvents();
    if (state.showCountrySheet) wireCountrySheetEvents();
    if (state.showTestModal) wireTestModal();
  } else if (state.view === "home") {
    root.innerHTML = homePage() + (state.showTestModal ? testModeModal() : "");
    queryEls();
    wireHomeEvents();
    if (state.isTester) wireTesterToolbar();
    if (state.showTestModal) wireTestModal();
    renderHome();
  } else {
    root.innerHTML =
      checkinPage() +
      (state.showTestModal ? testModeModal() : "") +
      (state.selectedEntryIdx !== null ? dayDetailModal() : "") +
      (state.showRulesModal ? rulesModal() : "");
    queryEls();
    wireCheckinEvents();
    if (state.isTester) wireTesterToolbar();
    if (state.showTestModal) wireTestModal();
    if (state.selectedEntryIdx !== null) wireDayDetailModal();
    if (state.showRulesModal) wireRulesModal();
    renderAll();
    if (inCooldown()) {
      cooldownTimer = setInterval(() => {
        if (inCooldown()) {
          renderEntryState();
        } else {
          clearInterval(cooldownTimer);
          cooldownTimer = null;
          renderAll();
        }
      }, 30000);
    }
  }
}

// ---------- Login wiring ----------
function wireLoginEvents() {
  const loginBtn = document.getElementById("login-btn");
  if (!loginBtn) return;

  loginBtn.addEventListener("click", () => {
    const input = document.getElementById("phone-input");
    const phone = (input ? input.value : "").replace(/\D/g, "");
    if (phone.length < 7) {
      input.focus();
      return;
    }

    state.phone = phone;
    loginBtn.disabled = true;
    document.getElementById("login-btn-label").textContent = "Logging in…";
    document.getElementById("login-error").textContent = "";

    const fill = document.getElementById("login-progress-fill");
    const btnWrap = document.getElementById("login-btn-wrap");
    fill?.classList.add("crawling");
    btnWrap?.classList.add("loading");

    setTimeout(() => {
      localStorage.setItem("checkin_session", JSON.stringify({ phone, country: state.country }));
      state.isTester = TEST_PHONES.includes(phone);

      fill?.classList.remove("crawling");
      fill?.classList.add("done");
      const label = document.getElementById("login-btn-label");
      if (label) label.textContent = "✓ Logged in";

      setTimeout(async () => {
        if (state.isTester) {
          state.testMode = null;
          state.showTestModal = true;
          render();
        } else {
          // Resolves/creates the user row up front (see app/routers/auth.py)
          // so the home page's first GET /eaze-score call below always finds
          // a real user and can award the welcome bonus correctly.
          try {
            await apiPost("/auth/login", { phone });
          } catch (err) {
            console.error("Login call failed", err);
          }
          state.view = "home";
          render();
          loadHomeData(phone);
        }
      }, 350);
    }, 1100);
  });

  const phoneInput = document.getElementById("phone-input");
  if (phoneInput) {
    phoneInput.addEventListener("input", (e) => {
      state.phone = e.target.value.replace(/\D/g, "");
      e.target.value = state.phone;
    });
    phoneInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("login-btn")?.click();
    });
  }

  document.getElementById("country-picker-btn")?.addEventListener("click", () => {
    state.showCountrySheet = true;
    state.countrySearch = "";
    render();
  });
}

function wireCountrySheetEvents() {
  document.getElementById("sheet-overlay")?.addEventListener("click", () => {
    state.showCountrySheet = false;
    render();
  });

  document.getElementById("country-search")?.addEventListener("input", (e) => {
    state.countrySearch = e.target.value;
    const sheet = document.getElementById("country-sheet");
    if (!sheet) return;
    const query = state.countrySearch.toLowerCase();
    const filtered = COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(query) || c.code.includes(query)
    );
    const listEl = sheet.querySelector(".sheet-list");
    if (listEl) {
      listEl.innerHTML = filtered
        .map(
          (c) => `
        <button class="country-option" data-code="${c.code}" data-flag="${c.flag}" data-name="${c.name}">
          <span class="country-option-flag">${c.flag}</span>
          <span class="country-option-name">${c.name} (${c.code})</span>
        </button>`
        )
        .join("");
      wireCountryOptionEvents();
    }
  });

  wireCountryOptionEvents();
}

function wireCountryOptionEvents() {
  document.querySelectorAll(".country-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.country = { flag: btn.dataset.flag, name: btn.dataset.name, code: btn.dataset.code };
      state.showCountrySheet = false;
      state.countrySearch = "";
      render();
    });
  });
}

// ---------- Tester modal / toolbar wiring ----------
function wireTestModal() {
  document.querySelectorAll(".test-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.scenario;
      state.testMode = key;
      localStorage.setItem("checkin_testMode", key);
      state.showTestModal = false;
      Object.assign(state, scenarioState(key));
      state.selectedMood = null;
      state.checkedInToday = false;
      state.nextCheckinAt = null;
      // Simulated home-page fields — testers never hit the real backend, so
      // these are derived locally instead of coming from GET /eaze-score.
      // "Fresh Start" doubles as the demo for a first-ever login: the
      // welcome bonus fires once, same as it would for a real new user.
      state.sessionsCount = state.checkInEntries.length;
      state.todayEarned = 0;
      state.welcomeBonusJustAwarded = key === "fresh";
      if (state.welcomeBonusJustAwarded) state.eazeScore += 20;
      state.view = "home";
      render();
    });
  });
}

function wireTesterToolbar() {
  document.getElementById("tester-change-btn")?.addEventListener("click", () => {
    state.showTestModal = true;
    render();
  });

  document.getElementById("tester-logout-btn")?.addEventListener("click", logout);

  document.getElementById("tester-sim-set")?.addEventListener("click", () => {
    const input = document.getElementById("tester-streak-input");
    const n = Math.max(0, Math.min(6, Number(input.value) || 0));
    state.streakDays = buildStreakDays(n);
    state.eazeScore = n * POINTS_PER_CHECKIN;
    state.lastBonusAwarded = false;
    state.todayEarned = 0;
    state.selectedMood = null;
    state.checkedInToday = false;
    state.nextCheckinAt = null;
    render();
  });

  document.getElementById("tester-sim-reset")?.addEventListener("click", () => {
    Object.assign(state, scenarioState(state.testMode || "active"));
    state.sessionsCount = state.checkInEntries.length;
    state.todayEarned = 0;
    state.selectedMood = null;
    state.checkedInToday = false;
    state.nextCheckinAt = null;
    render();
  });
}

function logout() {
  localStorage.removeItem("checkin_session");
  localStorage.removeItem("checkin_testMode");
  state.view = "login";
  state.phone = "";
  state.country = COUNTRIES[0];
  state.isTester = false;
  state.testMode = null;
  state.showTestModal = false;
  state.showCountrySheet = false;
  state.selectedMood = null;
  state.checkedInToday = false;
  state.nextCheckinAt = null;
  state.sessionsCount = 0;
  state.todayEarned = 0;
  state.welcomeBonusJustAwarded = false;
  state.showRulesModal = false;
  Object.assign(state, scenarioState("active"));
  render();
}

// ---------- Check-in page wiring ----------
function wireCheckinEvents() {
  els.saveBtn?.addEventListener("click", handleSave);
  document.getElementById("logout-btn")?.addEventListener("click", logout);

  document.getElementById("back-to-home-btn")?.addEventListener("click", () => {
    state.view = "home";
    render();
    if (!state.isTester && state.phone) loadHomeData(state.phone);
  });

  document.getElementById("daily-rules-btn")?.addEventListener("click", () => {
    state.showRulesModal = true;
    render();
  });

  document.getElementById("chart-back-btn")?.addEventListener("click", () => {
    state.chartView = "overview";
    state.chartSelectedDate = null;
    state.chartViewUserSet = true;
    render();
  });

  els.chart?.addEventListener("click", (e) => {
    const hit = e.target.closest("[data-idx]");
    if (!hit) return;
    const idx = Number(hit.dataset.idx);
    if (state.chartView === "overview") {
      const day = groupEntriesByDay(state.checkInEntries)[idx];
      if (!day) return;
      state.chartView = "day";
      state.chartSelectedDate = day.dateKey;
      state.chartViewUserSet = true;
    } else {
      state.selectedEntryIdx = idx;
    }
    render();
  });

  els.textarea?.addEventListener("input", () => {
    const words = els.textarea.value.trim().split(/\s+/).filter(Boolean);
    if (words.length > NOTE_WORD_LIMIT) {
      els.textarea.value = words.slice(0, NOTE_WORD_LIMIT).join(" ");
    }
    renderNoteCounter();
  });
}

// ---------- Home page wiring ----------
function wireHomeEvents() {
  document.getElementById("logout-btn")?.addEventListener("click", logout);

  document.getElementById("checkin-banner-btn")?.addEventListener("click", () => {
    state.view = "checkin";
    // Only clear the transient mood pick — checkedInToday/nextCheckinAt/
    // streakDays reflect real (or tester-simulated) state and must not be
    // force-reset here, or they'd desync from what's actually true until the
    // fetch below lands.
    state.selectedMood = null;
    render();
    if (!state.isTester && state.phone) loadRealUserData(state.phone);
  });
}

// ---------- Rules modal wiring ----------
function wireRulesModal() {
  document.getElementById("rules-overlay")?.addEventListener("click", (e) => {
    if (e.target.id !== "rules-overlay") return;
    state.showRulesModal = false;
    render();
  });
  document.getElementById("rules-close")?.addEventListener("click", () => {
    state.showRulesModal = false;
    render();
  });
}

function wireDayDetailModal() {
  document.getElementById("day-detail-overlay")?.addEventListener("click", (e) => {
    if (e.target.id !== "day-detail-overlay") return;
    state.selectedEntryIdx = null;
    render();
  });
  document.getElementById("day-detail-close")?.addEventListener("click", () => {
    state.selectedEntryIdx = null;
    render();
  });
}

function currentStreakCount() {
  // Filled days are always contiguous starting from the leftmost circle.
  return state.streakDays.filter(Boolean).length;
}

// True while the user is waiting out the cooldown between check-ins — the
// entry form gates on this instead of "already checked in today," since
// several check-ins a day are now allowed.
function inCooldown() {
  if (!state.nextCheckinAt) return false;
  return new Date() < parseUtc(state.nextCheckinAt);
}

const NOTE_WORD_LIMIT = 100;

function renderNoteCounter() {
  if (!els.noteCounter || !els.textarea) return;
  const words = els.textarea.value.trim() ? els.textarea.value.trim().split(/\s+/).length : 0;
  els.noteCounter.textContent = `${words}/${NOTE_WORD_LIMIT} words`;
  els.noteCounter.classList.toggle("note-counter--limit", words >= NOTE_WORD_LIMIT);
}

function renderMoodPicker() {
  els.moodPicker.innerHTML = "";
  const hasSelection = state.selectedMood !== null;
  MOODS.forEach((mood) => {
    const btn = document.createElement("button");
    btn.type = "button";
    const isSelected = state.selectedMood === mood.value;
    // Dimming tracks selection, not save/lock-in — the moment any mood is
    // picked the other four dull, whether or not Save has been tapped yet.
    btn.className =
      "mood-option" + (isSelected ? " selected" : "") + (hasSelection && !isSelected ? " dimmed" : "");
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", isSelected ? "true" : "false");
    btn.disabled = inCooldown() || state.submitting;
    btn.innerHTML = `<span class="mood-circle"><span class="emoji">${mood.emoji}</span></span><span class="mood-label">${mood.label}</span>`;
    btn.addEventListener("click", () => {
      state.selectedMood = mood.value;
      renderMoodPicker();
      renderSaveButton();
    });
    els.moodPicker.appendChild(btn);
  });
}

function renderSaveButton() {
  const cooldown = inCooldown();
  els.saveBtn.disabled = cooldown || state.submitting || state.selectedMood === null;
  els.saveBtnLabel.innerHTML = state.submitting
    ? '<span class="spinner"></span> Thinking…'
    : cooldown
    ? "Saved"
    : "Save";
}

function renderEntryState() {
  const cooldown = inCooldown();
  els.textarea.disabled = cooldown || state.submitting;
  els.doneNote.hidden = !cooldown;
  if (cooldown) {
    els.doneNote.textContent = `Nice check-in! Your next one opens at ${formatClockTime(parseUtc(state.nextCheckinAt))}.`;
  }
  renderMoodPicker();
  renderSaveButton();
  renderNoteCounter();
}

function renderReaffirm(message) {
  if (!message) {
    els.reaffirmCard.hidden = true;
    return;
  }
  els.reaffirmText.textContent = message;
  els.reaffirmCard.hidden = false;
}

// Health-app-style two-level chart: 'overview' plots one averaged dot per
// day (tap a day -> drill in); 'day' plots every individual check-in from
// one specific day as an emoji marker on a Morning/Afternoon/Evening/Night
// axis (tap an entry -> open its detail modal). Both share the same line/
// area/axis rendering below — only how `points` is built differs.
function renderChart() {
  if (state.checkInEntries.length === 0) {
    els.chartWrap.hidden = true;
    els.chartEmpty.hidden = false;
    return;
  }

  const isDayView = state.chartView === "day";
  const points = isDayView
    ? entriesForDay(state.checkInEntries, state.chartSelectedDate).map((e) => ({
        value: e.value,
        label: timeOfDayLabel(e.at),
        emoji: moodByValue(e.value).emoji,
      }))
    : groupEntriesByDay(state.checkInEntries).map((d) => ({
        value: d.avgValue,
        label: dayLabel(daysAgoFromKey(d.dateKey)),
        emoji: null,
      }));

  if (points.length === 0) {
    els.chartWrap.hidden = true;
    els.chartEmpty.hidden = false;
    return;
  }
  els.chartWrap.hidden = false;
  els.chartEmpty.hidden = true;

  const H = 200;
  // Fixed pixel spacing per point rather than stretching to fill the card —
  // about 4 fit in view at once, the rest reachable by scrolling right,
  // oldest to newest matching the streak row's left-to-right direction.
  const SLOT = 64, PAD_X = 24, PAD_TOP = 22, PAD_BOTTOM = 18;
  const usableH = H - PAD_TOP - PAD_BOTTOM;
  const n = points.length;
  const W = PAD_X * 2 + (n - 1) * SLOT;

  // One fixed height per mood value (1-5) — the y-axis, not a continuous scale.
  const valueToY = (value) => PAD_TOP + usableH * (1 - (value - 1) / 4);

  const coords = points.map((p, i) => [PAD_X + i * SLOT, valueToY(p.value)]);

  // Straight segments only — the line must land exactly on each point's mood
  // row, never curve past it between points.
  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath =
    `${linePath} L${coords[n - 1][0].toFixed(1)},${(H - PAD_BOTTOM).toFixed(1)}` +
    ` L${coords[0][0].toFixed(1)},${(H - PAD_BOTTOM).toFixed(1)} Z`;

  const gridlines = MOODS.map((mood) => {
    const y = valueToY(mood.value).toFixed(1);
    return `<line x1="${PAD_X}" y1="${y}" x2="${W - PAD_X}" y2="${y}" stroke="rgba(255,255,255,0.08)" stroke-width="1" stroke-dasharray="2 6" />`;
  }).join("");

  const markers = coords
    .map(([x, y], i) => {
      const isMostRecent = i === n - 1;
      const backingR = isMostRecent ? 15 : 12;
      // Day view: the actual mood emoji, since each point is one real entry.
      // Overview: a plain dot, since an averaged day has no single emoji —
      // matches the clean trend-line look of iOS Health's own overview.
      const inner = points[i].emoji
        ? `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${isMostRecent ? 19 : 16}" text-anchor="middle" dominant-baseline="central">${points[i].emoji}</text>`
        : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${isMostRecent ? 6 : 5}" fill="${isMostRecent ? "#FF9E44" : "#FFC998"}" />`;
      return `
        <g class="chart-point" data-idx="${i}">
          <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${backingR}" fill="${
        isMostRecent ? "rgba(255,158,68,0.22)" : "rgba(19,13,33,0.5)"
      }" stroke="${isMostRecent ? "#FF9E44" : "rgba(255,255,255,0.12)"}" stroke-width="${isMostRecent ? 2 : 1}" />
          ${inner}
        </g>
      `;
    })
    .join("");

  els.chart.setAttribute("viewBox", `0 0 ${W} ${H}`);
  els.chart.setAttribute("width", W);
  els.chart.setAttribute("height", H);
  els.chart.innerHTML = `
    <defs>
      <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FF9E44" stop-opacity="0.35" />
        <stop offset="100%" stop-color="#FF9E44" stop-opacity="0" />
      </linearGradient>
    </defs>
    ${gridlines}
    <path d="${areaPath}" fill="url(#moodFill)" stroke="none" />
    <path d="${linePath}" fill="none" stroke="#FF9E44" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.85" />
    ${markers}
  `;

  els.chartScroll.style.width = `${W}px`;
  els.chartAxis.style.width = `${W}px`;
  els.chartAxis.innerHTML = points
    .map(
      (p, i) =>
        `<span style="left:${(PAD_X + i * SLOT).toFixed(1)}px">${p.label}</span>`
    )
    .join("");

  // Always open scrolled to the newest entries — now the right edge, since
  // the chart reads oldest-to-newest left to right. Setting scrollLeft past
  // the max is automatically clamped to the true max by the browser, so this
  // works regardless of exact content width.
  els.chartWrap.scrollLeft = els.chartWrap.scrollWidth;
}

function renderStreak() {
  const count = currentStreakCount();
  els.streakDots.innerHTML = "";
  state.streakDays.forEach((filled, i) => {
    // Today's pending slot is whichever circle comes right after the filled
    // streak — not a fixed position — since filled days start at index 0.
    const isTodayPending = !state.checkedInToday && i === count;
    const dot = document.createElement("div");
    dot.className = "streak-dot" + (filled ? " filled" : isTodayPending ? " today-pending" : "");
    dot.dataset.idx = i;
    if (filled) dot.style.backgroundImage = `url("${EAZE_LOGO_SRC}")`;
    els.streakDots.appendChild(dot);
  });

  els.streakCaption.innerHTML =
    count === 0
      ? "Start a new streak today"
      : `<span class="stat-num">${count}</span> day${count === 1 ? "" : "s"} in a row`;
  els.streakPillText.innerHTML =
    count === 0 ? "Start today" : `<span class="stat-num">${count}</span> day streak`;
}

// Home page's "cumulative EazeScore" card — the lifetime total, with the
// bar showing progress toward the next 7-day streak bonus. Unchanged from
// the score bar/caption logic this app always had; it just lives on the
// home page now instead of the check-in page.
function renderCumulativeScore() {
  const count = currentStreakCount();
  const pct = Math.round((Math.min(count, 7) / 7) * 100);
  els.scoreValue.textContent = state.eazeScore;
  els.scoreBarFill.style.width = `${pct}%`;
  els.scoreCaption.innerHTML =
    count >= 7
      ? "Full week complete — weekly bonus earned"
      : `<span class="stat-num">${count}</span>/<span class="stat-num">7</span> days checked in this week · +<span class="stat-num">${WEEKLY_STREAK_BONUS}</span> bonus at <span class="stat-num">7</span>`;

  // One-shot celebration: show it for this render only, then consume the flag
  // so it doesn't reappear on unrelated re-renders.
  els.scoreBonusChip.hidden = !state.lastBonusAwarded;
  if (state.lastBonusAwarded) {
    state.lastBonusAwarded = false;
    els.scoreBarFill.classList.add("just-bonus");
    setTimeout(() => els.scoreBarFill.classList.remove("just-bonus"), 700);
  }
}

// Check-in page's "EazeScore Daily" card — today's contribution only (0
// before saving, 10 normally, 60 on a bonus day), so it reads as "what did
// I just earn" rather than duplicating the lifetime total shown on home.
// Bar fill is today's amount out of the max a single day can award (10 base
// + 50 bonus), so a bonus day visibly fills the bar all the way.
const MAX_DAILY_SCORE = POINTS_PER_CHECKIN + WEEKLY_STREAK_BONUS;

function renderDailyScore() {
  const pct = Math.round((Math.min(state.todayEarned, MAX_DAILY_SCORE) / MAX_DAILY_SCORE) * 100);
  els.scoreValue.textContent = state.todayEarned;
  els.scoreBarFill.style.width = `${pct}%`;
  els.scoreCaption.textContent = !state.checkedInToday
    ? "Check in today to add to your EazeScore"
    : state.lastBonusAwarded || state.todayEarned >= MAX_DAILY_SCORE
    ? `+${state.todayEarned} added — includes today's streak bonus`
    : `+${state.todayEarned} added to your EazeScore`;

  els.scoreBonusChip.hidden = !state.lastBonusAwarded;
  if (state.lastBonusAwarded) {
    state.lastBonusAwarded = false;
    els.scoreBarFill.classList.add("just-bonus");
    setTimeout(() => els.scoreBarFill.classList.remove("just-bonus"), 700);
  }
}

function renderAll() {
  renderEntryState();
  renderChart();
  renderStreak();
  renderDailyScore();
}

function renderHome() {
  renderCumulativeScore();
  if (els.sessionsValue) els.sessionsValue.textContent = state.sessionsCount;
}

async function handleSave() {
  if (state.selectedMood === null || state.submitting || inCooldown()) return;

  state.submitting = true;
  renderEntryState();

  const mood = state.selectedMood;
  const message = pickMessage(mood);
  const now = new Date();
  // A streak dot only ever advances on the day's FIRST check-in — a 2nd or
  // 3rd same-day entry still earns points but shouldn't push the streak
  // forward again.
  const wasCheckedInToday = state.checkedInToday;

  if (!state.isTester) {
    // Real user: persist for real, so this survives a refresh. The backend
    // is the source of truth for score/streak — we only mirror its result
    // into local UI state, never compute it ourselves.
    try {
      const note = els.textarea.value.trim() || null;
      const result = await apiPost("/checkins", { phone: state.phone, mood, note });

      state.checkInEntries = [...state.checkInEntries, { value: mood, at: now, message }].slice(-RAW_ENTRIES_CAP);
      if (state.chartView === "day" && !state.chartSelectedDate) {
        state.chartSelectedDate = localDateKey(now);
      }

      let todayIdx = -1;
      if (!wasCheckedInToday) {
        todayIdx = state.streakDays.indexOf(false);
        if (todayIdx !== -1) state.streakDays[todayIdx] = true;
      }

      state.eazeScore = result.score.earned;
      state.todayEarned = result.score.today_earned;
      state.sessionsCount = result.score.sessions_count;
      state.lastBonusAwarded = result.streak_bonus_awarded;
      state.checkedInToday = true;
      state.nextCheckinAt = result.score.next_checkin_at;
      state.submitting = false;

      renderAll();
      renderReaffirm(message);

      const dot = els.streakDots.querySelector(`[data-idx="${todayIdx}"]`);
      if (dot) dot.classList.add("just-filled");
    } catch (err) {
      console.error("Failed to save check-in", err);
      state.submitting = false;
      renderEntryState(); // re-enable Save so the user can retry
    }
    return;
  }

  // Tester: local-only simulation, exactly as before — testers never touch
  // the real backend.
  await new Promise((resolve) => setTimeout(resolve, 700));

  // Newest check-in joins the history at the end (chart is chronological,
  // oldest to newest), oldest entry drops off the front so it always shows a
  // fixed window, never growing unbounded. The message is stored with the
  // entry so tapping this point later shows the exact same reassurance, not
  // a freshly re-rolled one.
  state.checkInEntries = [...state.checkInEntries, { value: mood, at: now, message }].slice(-RAW_ENTRIES_CAP);
  if (state.chartView === "day" && !state.chartSelectedDate) {
    state.chartSelectedDate = localDateKey(now);
  }

  // Fill whichever circle comes right after the current streak — filled days
  // are always contiguous starting from the leftmost circle. Only on the
  // day's first check-in, same rule as the real-user path above.
  let todayIdx = -1;
  let streakAfter = currentStreakCount();
  if (!wasCheckedInToday) {
    const streakBefore = currentStreakCount();
    todayIdx = state.streakDays.indexOf(false);
    if (todayIdx !== -1) state.streakDays[todayIdx] = true;
    streakAfter = currentStreakCount();
    state.lastBonusAwarded = streakBefore < 7 && streakAfter >= 7;
  } else {
    state.lastBonusAwarded = false;
  }

  // Every check-in earns points, regardless of how many already happened
  // today; completing a full 7-day week earns the one-time weekly bonus,
  // awarded exactly on the day's first check-in that gets the streak to 7.
  state.eazeScore += POINTS_PER_CHECKIN;
  state.todayEarned += POINTS_PER_CHECKIN + (state.lastBonusAwarded ? WEEKLY_STREAK_BONUS : 0);
  if (state.lastBonusAwarded) state.eazeScore += WEEKLY_STREAK_BONUS;
  state.sessionsCount += 1;
  state.checkedInToday = true;
  // Simulated cooldown, same 3-hour window the real backend enforces.
  state.nextCheckinAt = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();

  state.submitting = false;

  renderAll();
  renderReaffirm(message);

  const dot = els.streakDots.querySelector(`[data-idx="${todayIdx}"]`);
  if (dot) dot.classList.add("just-filled");
}

render();

// Restored session for a real (non-tester) user: initial render above shows
// the clean shell, this fetches their actual persisted score/history.
if (state.view === "home" && !state.isTester && state.phone) {
  loadHomeData(state.phone);
}
