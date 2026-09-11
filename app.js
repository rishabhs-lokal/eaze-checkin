// Daily Check-in — Eaze
// Login, modeled on the actual Dostt Free Rewards app (root.innerHTML render
// loop, animated login button, country bottom sheet) and reskinned with the
// Eaze design tokens. Every user hits the real backend in backend/ (see
// "Real backend integration" below) — EazeScore and check-in history
// persist for real.

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

const EAZE_LOGO_SRC = "assets/eaze-logo.png?v=3";
const EAZE_LOGO_WHITE_SRC = "assets/eaze-logo-white.png?v=1";
const EAZE_COIN_SRC = "assets/eaze-coin.png?v=1";

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

// Backend timestamps are stored and serialized as naive UTC (no trailing
// "Z") — without adding it back, `new Date(...)` would silently reinterpret
// them as local time instead of UTC, throwing off every hour-based bucket
// below by the browser's UTC offset.
function parseUtc(isoStr) {
  if (!isoStr) return null;
  return new Date(/[Z]|[+-]\d\d:\d\d$/.test(isoStr) ? isoStr : `${isoStr}Z`);
}

// Fixed +5:30 IST offset — every "which calendar day / what time of day"
// decision in this app uses IST specifically, regardless of the backend
// server's or the user's device's own configured timezone (must match
// backend/app/services/eaze_score.py's IST_OFFSET exactly). Returns a Date
// whose UTC* getters read as IST wall-clock time — always read this result
// with getUTCFullYear/getUTCHours/etc, never the plain (device-timezone)
// getters, or this whole point is defeated.
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
function toIST(dateObj) {
  return new Date(dateObj.getTime() + IST_OFFSET_MS);
}

// "Today" in the fixed-IST sense, as a Date whose UTC* getters read as IST
// midnight — the reference point dayLabel/daysAgoFromKey measure against.
function istTodayMidnight() {
  const ist = toIST(new Date());
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

function dayLabel(offsetFromToday) {
  if (offsetFromToday === 0) return "Today";
  const d = new Date(istTodayMidnight().getTime() - offsetFromToday * 86400000);
  return d.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
}

// Multiple check-ins a day are bucketed by (fixed IST) time of day rather
// than by weekday — that's the axis a same-day chart actually needs.
function timeOfDayLabel(dateObj) {
  const h = toIST(dateObj).getUTCHours();
  if (h >= 5 && h < 12) return "Morning";
  if (h >= 12 && h < 17) return "Afternoon";
  if (h >= 17 && h < 21) return "Evening";
  return "Night";
}

function shortDateLabel(dateObj) {
  const ist = toIST(dateObj);
  const todayMidnight = istTodayMidnight();
  const isToday =
    ist.getUTCFullYear() === todayMidnight.getUTCFullYear() &&
    ist.getUTCMonth() === todayMidnight.getUTCMonth() &&
    ist.getUTCDate() === todayMidnight.getUTCDate();
  if (isToday) return "Today";
  const asUtcMidnight = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
  return asUtcMidnight.toLocaleDateString(undefined, { weekday: "long", timeZone: "UTC" });
}

// Shows the user's own device clock, not IST — "come back at HH:MM" is only
// useful measured against the clock the user will actually look at.
function formatClockTime(dateObj) {
  return dateObj.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// HH:MM:SS remaining until targetDate — a real ticking-down clock, not a
// fixed "opens at" time. Anchored to whatever targetDate actually holds
// (state.nextCheckinAt, set from the exact moment of the user's own last
// check-in — see next_eligible_at on the backend), never a hardcoded
// duration, so it always agrees with the real cooldown the backend enforces.
function formatCountdown(targetDate) {
  const totalSeconds = Math.max(0, Math.floor((targetDate - new Date()) / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

// "YYYY-MM-DD" in fixed IST — the grouping key for the day-level chart view.
// Deliberately not the browser's own timezone: two devices in different
// zones must group the same check-in into the same IST calendar day, to
// match what the backend's streak/"today" logic also uses.
function localDateKey(dateObj) {
  const ist = toIST(dateObj);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ist.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysAgoFromKey(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const today = istTodayMidnight().getTime();
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

const POINTS_PER_CHECKIN = 10;
const WEEKLY_STREAK_BONUS = 50;

// EazeScore -> coin conversion, mirrored from the backend's compute_coins
// (app/services/eaze_score.py) so the claim card/modal can show accurate
// numbers before the user ever taps claim — never a separate source of
// truth, just the same tiered formula run client-side for display.
const COIN_HALFWAY_THRESHOLD = 250;
const COIN_LOW_RATE = 0.5;
const COIN_HIGH_RATE = 1.0;

function computeCoins(score) {
  if (score <= 0) return 0;
  const coins =
    score <= COIN_HALFWAY_THRESHOLD
      ? score * COIN_LOW_RATE
      : COIN_HALFWAY_THRESHOLD * COIN_LOW_RATE + (score - COIN_HALFWAY_THRESHOLD) * COIN_HIGH_RATE;
  // Round half up (an odd score at the 0.5 rate lands on X.5 coins, which
  // rounds up, not down) — mirrors the backend's compute_coins exactly.
  return Math.floor(coins + 0.5);
}

// ---------- Real backend integration ----------
// Every user hits the actual API so EazeScore and check-in history survive
// a refresh instead of resetting to scripted demo data every load.
// Empty/relative: the backend now serves this frontend itself (see
// backend/app/main.py's StaticFiles mount), so API calls are always
// same-origin — in local docker-compose, staging, or production alike —
// with no per-environment branching needed.
const API_BASE = "";

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
  // 204 (e.g. /checkins/banner-click) has no body — res.json() would throw
  // on the empty string.
  if (res.status === 204) return null;
  return res.json();
}

// Safety cap on how many raw check-ins stay in memory — generous relative to
// what the 7-day overview + drill-down actually need, just guards against
// unbounded growth for a very long-term, very frequent user.
const RAW_ENTRIES_CAP = 90;

// Maps the API's raw check-in list + score state into this app's UI shape
// (checkInEntries / streakDays / checkedInToday / nextCheckinAt / eazeScore).
// Does NOT set chartView/chartSelectedDate — callers decide whether to
// compute a fresh default or preserve whatever the user is browsing (see
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
    // The claimable balance, not the lifetime earned total — this is what
    // resets to 0 right after a claim (see claim_coins in
    // backend/app/routers/eaze_score.py: earned never decreases, only
    // available does).
    eazeScore: scoreState.available,
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
      // Claimable balance, not lifetime earned — see computeStateFromApi.
      eazeScore: scoreState.available,
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

  // Raw check-in entries ({ value, at: Date, message }), oldest to newest —
  // the single source both chart views (multi-day overview and single-day
  // drill-down) derive from.
  checkInEntries: [],
  // 'overview' (one averaged point per day) or 'day' (every entry on one
  // specific day) — see ensureChartViewDefault for how the initial value is
  // chosen. Null until the first real fetch resolves.
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
  // Popup celebrating a just-awarded 7-day streak bonus — replaces the old
  // inline green "+50 bonus" chip entirely (see renderDailyScore).
  showBonusModal: false,

  // Lifetime-score home page (login -> home -> checkin).
  sessionsCount: 0,
  todayEarned: 0,
  welcomeBonusJustAwarded: false,
  showRulesModal: false,
  // Which home-page stat card's info popup is open — null, "score", or
  // "sessions". Mutually exclusive with showRulesModal (that one's the
  // check-in page's own info popup).
  homeInfoModal: null,

  // eazeScore (above) IS the claimable balance — bound to the backend's
  // `available` (earned minus already-claimed), not `earned`, so it reads
  // as 0 right after a claim and builds back up from there. See
  // computeCoins for how it converts to coins.
  showClaimModal: false,
  claiming: false,
  // Set once a claim attempt resolves (success or otherwise) — the modal
  // switches from the explainer/CTA view to a confirmation view while this
  // is non-null. Cleared when the modal closes.
  claimResult: null,

  // Which view opened the terms page ("home" or "checkin") — its back
  // button returns here instead of always landing on home.
  termsReturnView: "home",
};

const sessionReady = (async function restoreSession() {
  const saved = localStorage.getItem("checkin_session");

  // Banner entry — the real production path: users arrive via a banner link
  // elsewhere in the Eaze ecosystem carrying the real Eaze platform user id
  // and (usually) phone as URL params, no typed-phone login screen involved.
  // Only honored when there's no saved session yet, so a bookmarked/
  // revisited banner URL doesn't reprocess on every later visit.
  const bannerParams = new URLSearchParams(window.location.search);
  const bannerUserId = bannerParams.get("user_id");
  let bannerPhone = bannerParams.get("phone");
  if (bannerUserId && !saved) {
    // The banner link doesn't always include phone — fall back to resolving
    // it server-side from eaze_user_id (see /auth/resolve-phone) before
    // giving up on banner entry entirely.
    if (!bannerPhone) {
      try {
        const resolved = await apiGet(`/auth/resolve-phone/${encodeURIComponent(bannerUserId)}`);
        bannerPhone = resolved.phone;
      } catch (err) {
        console.error("Phone lookup for banner entry failed", err);
      }
    }
  }
  if (bannerUserId && bannerPhone && !saved) {
    state.phone = bannerPhone;
    state.view = "home";
    try {
      await apiPost("/auth/login", { phone: bannerPhone, eaze_user_id: bannerUserId });
      localStorage.setItem("checkin_session", JSON.stringify({ phone: bannerPhone, country: state.country }));
    } catch (err) {
      console.error("Banner login failed", err);
      state.phone = "";
      state.view = "login";
      render();
    }
    return;
  }
  // bannerUserId present but no phone (param or lookup) resolved — falls
  // through to the typed-phone login screen below, same as no banner at all.

  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    state.phone = parsed.phone || "";
    state.country = parsed.country || COUNTRIES[0];
  } catch {
    return;
  }
  // Land on the EazeScore home page every time, same as right after login —
  // show the clean/zeroed shell immediately, then fetch actual persisted
  // data below (after the initial render() at the bottom of this file).
  state.view = "home";
})();

const root = document.getElementById("root");
let els = {};

function queryEls() {
  els = {
    moodPicker: document.getElementById("mood-picker"),
    moodReminder: document.getElementById("mood-reminder"),
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

// Celebration popup for the 7-day streak bonus — replaces the old inline
// green "+50 bonus" chip on the EazeScore Daily card entirely.
function bonusModal() {
  return `
    <div id="bonus-overlay" class="day-detail-overlay">
      <div class="day-detail-modal rules-modal">
        <button id="bonus-close" class="day-detail-close" type="button" aria-label="Close">✕</button>
        <span class="day-detail-emoji" aria-hidden="true">🔥</span>
        <p class="day-detail-day">7-day streak</p>
        <p class="day-detail-mood">+${WEEKLY_STREAK_BONUS} bonus added to your EazeScore</p>
        <button id="bonus-done" class="home-info-cta" type="button">Nice!</button>
      </div>
    </div>
  `;
}

// Info popups for the home page's two tappable stat cards — context for
// what the stat means plus a shortcut into the next check-in, so tapping
// either card is never a dead end.
const HOME_INFO_CONTENT = {
  score: {
    title: "EazeScore",
    subtitle: "Your current score, explained",
    points: [
      "Every check-in adds points to your EazeScore.",
      "A 7-day streak earns a +50 point bonus.",
      "Claiming coins converts your full balance and resets it to 0 — see the claim card below to convert it.",
    ],
  },
  sessions: {
    title: "Sessions completed",
    subtitle: "What counts as a session",
    points: [
      "Every check-in you save counts as one session.",
      "Sessions build your streak and your EazeScore together.",
      "Check in again once your 3-hour cooldown clears.",
    ],
  },
};

function homeInfoModal() {
  const content = HOME_INFO_CONTENT[state.homeInfoModal];
  if (!content) return "";
  return `
    <div id="home-info-overlay" class="day-detail-overlay">
      <div class="day-detail-modal rules-modal">
        <button id="home-info-close" class="day-detail-close" type="button" aria-label="Close">✕</button>
        <img src="${EAZE_LOGO_WHITE_SRC}" alt="" class="home-info-icon" />
        <p class="day-detail-day">${content.title}</p>
        <p class="day-detail-mood">${content.subtitle}</p>
        <ul class="rules-list home-info-list">
          ${content.points.map((point) => `<li>${point}</li>`).join("")}
        </ul>
        <button id="home-info-cta" class="home-info-cta" type="button">Start your next check-in</button>
      </div>
    </div>
  `;
}

// Replaces the old inline "Welcome bonus" banner — same confetti burst as a
// successful coin claim (see claimModal's result view / spawnConfetti), so
// the first-ever +20 reads as a celebrated moment instead of a static strip
// of text sitting under the header.
function welcomeBonusModal() {
  return `
    <div id="welcome-bonus-overlay" class="day-detail-overlay">
      <div class="day-detail-modal rules-modal">
        <button id="welcome-bonus-close" class="day-detail-close" type="button" aria-label="Close">✕</button>
        <div class="claim-confetti" id="welcome-bonus-confetti"></div>
        <img src="${EAZE_LOGO_WHITE_SRC}" alt="" class="home-info-icon" />
        <p class="day-detail-day">Welcome bonus</p>
        <p class="claim-result-coins">+20 added to your EazeScore</p>
        <button id="welcome-bonus-done" class="home-info-cta" type="button">Let's go</button>
      </div>
    </div>
  `;
}

// Claim modal — always the explainer/breakdown view first (so the
// conversion mechanism is seen before every claim, not just the first one),
// then swaps to a result view once handleClaimSubmit resolves.
function claimModal() {
  if (state.claimResult) {
    const r = state.claimResult;
    return `
      <div id="claim-overlay" class="day-detail-overlay">
        <div class="day-detail-modal rules-modal">
          <button id="claim-close" class="day-detail-close" type="button" aria-label="Close">✕</button>
          ${r.ok ? `<div class="claim-confetti" id="claim-confetti"></div>` : ""}
          ${
            r.ok
              ? `
                <img src="${EAZE_COIN_SRC}" alt="" class="claim-result-coin-icon" />
                <p class="day-detail-day">Coins claimed</p>
                <p class="claim-result-coins">You've received ${r.coins} coins</p>
              `
              : `
                <span class="claim-result-icon" aria-hidden="true">⏳</span>
                <p class="day-detail-day">Claim recorded</p>
                <p class="day-detail-mood">${r.coins} coins requested</p>
              `
          }
          <p class="day-detail-message">${r.message}</p>
          <button id="claim-done" class="home-info-cta" type="button">Done</button>
        </div>
      </div>
    `;
  }

  const score = state.eazeScore;
  const coins = computeCoins(score);
  const canClaim = score > 0 && !state.claiming;
  const ctaLabel = state.claiming
    ? "Claiming…"
    : score > 0
    ? `Claim ${coins} coins`
    : "Nothing to claim yet";

  return `
    <div id="claim-overlay" class="day-detail-overlay">
      <div class="day-detail-modal rules-modal">
        <button id="claim-close" class="day-detail-close" type="button" aria-label="Close">✕</button>
        <img src="${EAZE_COIN_SRC}" alt="" class="claim-modal-icon" />
        <p class="day-detail-day">Claim coins</p>
        <p class="day-detail-mood">How EazeScore converts to coins</p>
        <ul class="rules-list home-info-list">
          <li>The first ${COIN_HALFWAY_THRESHOLD} EazeScore converts at ${COIN_LOW_RATE} coins per point.</li>
          <li>Anything beyond ${COIN_HALFWAY_THRESHOLD} converts at a full ${COIN_HIGH_RATE.toFixed(0)} coin per point.</li>
          <li>Claiming takes your full available balance — your EazeScore then resets to 0 and builds up again from there.</li>
        </ul>
        <div class="claim-breakdown">
          <div class="claim-breakdown-row">
            <span>Available EazeScore</span>
            <span class="claim-breakdown-value">${score}</span>
          </div>
          <div class="claim-breakdown-row">
            <span>You'll receive</span>
            <span class="claim-breakdown-value claim-breakdown-value--accent">${coins} coins</span>
          </div>
        </div>
        <button id="claim-submit" class="home-info-cta" type="button" ${canClaim ? "" : "disabled"}>${ctaLabel}</button>
      </div>
    </div>
  `;
}

function homePage() {
  return `
    <main class="container">
      <header class="page-header">
        <div class="header-row">
          <div>
            <p class="eyebrow">EazeScore</p>
            <h1 class="headline">Your EazeScore Lifetime</h1>
          </div>
          <div class="eaze-logo" aria-label="Eaze">
            <img src="${EAZE_LOGO_WHITE_SRC}" alt="Eaze" width="44" height="44" />
          </div>
        </div>
      </header>

      <div class="home-stats-row">
        <button class="card stat-card" id="score-card" type="button" aria-haspopup="dialog">
          <span class="stat-card-header">
            <span class="stat-card-head"><img src="${EAZE_LOGO_WHITE_SRC}" alt="" class="score-icon" /> EazeScore<span class="score-label-hint" aria-hidden="true">?</span></span>
            <svg class="stat-card-chevron" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
          <span class="stat-card-value" id="score-value">0</span>
        </button>
        <button class="card stat-card" id="sessions-card" type="button" aria-haspopup="dialog">
          <span class="stat-card-header">
            <span class="stat-card-head">Sessions completed<span class="score-label-hint" aria-hidden="true">?</span></span>
            <svg class="stat-card-chevron" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
          <span class="stat-card-value" id="sessions-value">${state.sessionsCount}</span>
        </button>
      </div>

      <button
        class="home-banner${inCooldown() ? " home-banner--cooldown" : ""}"
        id="checkin-banner-btn"
        type="button"
        ${inCooldown() ? "disabled" : ""}
      >
        <span class="home-banner-emoji${inCooldown() ? " home-banner-emoji--muted" : ""}" aria-hidden="true">😄</span>
        <span class="home-banner-copy">
          ${
            inCooldown()
              ? `
                <span class="home-banner-eyebrow">Checked in · streak safe</span>
                <span class="home-banner-title">You're all set for now</span>
                <span class="home-banner-countdown-label">Next check-in in</span>
                <span class="home-banner-countdown" id="home-banner-countdown">${formatCountdown(parseUtc(state.nextCheckinAt))}</span>
              `
              : `
                <span class="home-banner-eyebrow">Check-in open · keep your streak</span>
                <span class="home-banner-title">Ready for today's <span class="home-banner-accent">check-in</span>?</span>
                <span class="home-banner-cta">
                  Check in now
                  <svg class="home-banner-arrow" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
              `
          }
        </span>
      </button>

      <button class="card claim-card" id="claim-card" type="button" aria-haspopup="dialog">
        <span class="claim-card-header">
          <span class="claim-card-label"><img src="${EAZE_COIN_SRC}" alt="" class="claim-card-coin-icon" /> Claim coins</span>
          <svg class="claim-card-chevron" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <span class="claim-card-value">${computeCoins(state.eazeScore)} coins</span>
        <span class="claim-card-caption">${
          state.eazeScore > 0
            ? `from ${state.eazeScore} EazeScore available`
            : "Check in to start earning EazeScore"
        }</span>
      </button>

      <button id="terms-btn" class="logout-link" type="button">Terms and Conditions</button>
    </main>
  `;
}

const TERMS_SECTIONS = [
  {
    n: 1,
    title: "Eligibility",
    body: "This feature is available to registered eaze users aged 18 or older. By participating in daily check-ins, you accept these Terms. eaze may suspend or restrict access for users who do not meet these requirements.",
  },
  {
    n: 2,
    title: "Daily Check-ins & EazeScore",
    body: "Each check-in you complete adds points to your EazeScore. Check-ins are subject to a cooldown period between submissions and are grouped by calendar day in Indian Standard Time (IST), regardless of your device's local time zone. Maintaining a 7-day consecutive check-in streak awards a one-time bonus of 50 EazeScore points; new users receive a one-time welcome bonus of 20 EazeScore points. Streaks and bonuses are non-transferable between accounts and have no cash value in themselves.",
  },
  {
    n: 3,
    title: "Coin Conversion & Claims",
    body: "EazeScore may be converted into coins at eaze's published conversion rate, which may apply different rates at different EazeScore thresholds and is subject to change on notice. Submitting a claim converts your entire available EazeScore balance to coins and resets your balance to zero — partial claims are not supported. Claimed coins are submitted for transfer to your eaze wallet and are subject to processing by eaze's payment systems; submission of a claim does not guarantee instant crediting, and coins may remain pending until processing completes.",
  },
  {
    n: 4,
    title: "Verification & Anti-Fraud Checks",
    body: "eaze may require identity or account verification before processing a claim, particularly where a claim is unusually large or flagged by fraud-prevention systems. eaze may delay, decline, or reverse a claim pending verification. Decisions made under this section are final.",
  },
  {
    n: 5,
    title: "Fair Play",
    body: "Any attempt to manipulate check-in timestamps or streak calculations, circumvent the check-in cooldown, use multiple or automated accounts, or exploit vulnerabilities in the check-in or coin systems will result in immediate suspension of your account and forfeiture of any accrued EazeScore, coins, or pending claims.",
  },
  {
    n: 6,
    title: "Limitation of Liability",
    body: "eaze is not liable for delays, interruptions, or failures in EazeScore calculation or coin crediting arising from technical issues, third-party payment or wallet processing systems, or other causes beyond eaze's reasonable control.",
  },
  {
    n: 7,
    title: "Modifications",
    body: "eaze reserves the right to modify, suspend, or terminate the check-in feature, EazeScore mechanics, or coin conversion rates at any time, with or without notice.",
  },
  {
    n: 8,
    title: "Not Medical Advice",
    body: "EazeScore points and streaks reflect check-in activity only — they are not a measure of your mental health or wellbeing. EazeCheckin is a self-reflection tool and does not diagnose, treat, or assess any medical or mental health condition. It is not a substitute for professional care.",
  },
];

function termsPage() {
  return `
    <main class="container">
      <button id="back-to-home-from-terms-btn" class="back-link" type="button">${ICONS.backArrow} ${
    state.termsReturnView === "checkin" ? "Daily Check-in" : "EazeScore"
  }</button>
      <header class="page-header">
        <div class="header-row">
          <div>
            <p class="eyebrow">Legal</p>
            <h1 class="headline">Terms and Conditions</h1>
          </div>
          <div class="eaze-logo" aria-label="Eaze">
            <img src="${EAZE_LOGO_WHITE_SRC}" alt="Eaze" width="44" height="44" />
          </div>
        </div>
      </header>

      <section class="card terms-card">
        ${TERMS_SECTIONS.map(
          (s) => `
          <div class="terms-section">
            <h2 class="terms-heading">${s.n}. ${s.title}</h2>
            <p class="terms-body">${s.body}</p>
          </div>
        `
        ).join("")}
      </section>
    </main>
  `;
}

function checkinPage() {
  return `
    <main class="container">
      <button id="back-to-home-btn" class="back-link" type="button">${ICONS.backArrow} EazeScore</button>
      <header class="page-header">
        <div class="header-row header-row--centered">
          <h1 class="headline headline--compact">How are you feeling right now?</h1>
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
        </div>
        <span class="score-value" id="score-value">0</span>
        <p class="score-caption" id="score-caption"></p>
      </section>

      <section class="card entry-card" id="entry-card">
        <p class="entry-prompt">Pick how you're feeling right now</p>
        <div class="mood-picker" id="mood-picker" role="radiogroup" aria-label="Select your mood"></div>
        <p class="mood-reminder" id="mood-reminder" role="status" aria-live="polite" hidden>Pick a mood above to continue</p>

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

      <button id="terms-btn" class="logout-link" type="button">Terms and Conditions</button>
    </main>
  `;
}

// ---------- Render dispatcher ----------
// Ticks the check-in page while its cooldown countdown is showing, so "next
// check-in opens at HH:MM" clears itself once true, instead of staying
// stuck disabled until the user manually reloads.
let cooldownTimer = null;
// Ticks the home page's check-in banner once a second while it's showing the
// darkened "cooldown" state, so the HH:MM:SS countdown actually counts down
// instead of sitting frozen at whatever it read on the last full render.
let homeCooldownTimer = null;

function render() {
  if (cooldownTimer) {
    clearInterval(cooldownTimer);
    cooldownTimer = null;
  }
  if (homeCooldownTimer) {
    clearInterval(homeCooldownTimer);
    homeCooldownTimer = null;
  }

  if (state.view === "login") {
    root.innerHTML = loginPage();
    wireLoginEvents();
    if (state.showCountrySheet) wireCountrySheetEvents();
  } else if (state.view === "home") {
    root.innerHTML =
      homePage() +
      (state.homeInfoModal ? homeInfoModal() : "") +
      (state.showClaimModal ? claimModal() : "") +
      (state.welcomeBonusJustAwarded ? welcomeBonusModal() : "");
    queryEls();
    wireHomeEvents();
    if (state.homeInfoModal) wireHomeInfoModal();
    if (state.showClaimModal) wireClaimModal();
    if (state.claimResult?.ok) spawnConfetti();
    if (state.welcomeBonusJustAwarded) {
      wireWelcomeBonusModal();
      spawnConfetti("welcome-bonus-confetti");
    }
    renderHome();
    if (inCooldown()) {
      homeCooldownTimer = setInterval(() => {
        if (!inCooldown()) {
          clearInterval(homeCooldownTimer);
          homeCooldownTimer = null;
          render();
          return;
        }
        const countdownEl = document.getElementById("home-banner-countdown");
        if (countdownEl) countdownEl.textContent = formatCountdown(parseUtc(state.nextCheckinAt));
      }, 1000);
    }
  } else if (state.view === "terms") {
    root.innerHTML = termsPage();
    wireTermsEvents();
  } else {
    root.innerHTML =
      checkinPage() +
      (state.selectedEntryIdx !== null ? dayDetailModal() : "") +
      (state.showRulesModal ? rulesModal() : "") +
      (state.showBonusModal ? bonusModal() : "");
    queryEls();
    wireCheckinEvents();
    if (state.selectedEntryIdx !== null) wireDayDetailModal();
    if (state.showRulesModal) wireRulesModal();
    if (state.showBonusModal) wireBonusModal();
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

      fill?.classList.remove("crawling");
      fill?.classList.add("done");
      const label = document.getElementById("login-btn-label");
      if (label) label.textContent = "✓ Logged in";

      setTimeout(async () => {
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

// ---------- Terms page wiring ----------
function wireTermsEvents() {
  document.getElementById("back-to-home-from-terms-btn")?.addEventListener("click", () => {
    const returnView = state.termsReturnView;
    state.view = returnView;
    render();
    if (returnView === "home" && state.phone) loadHomeData(state.phone);
  });
}

// ---------- Check-in page wiring ----------
function wireCheckinEvents() {
  els.saveBtn?.addEventListener("click", handleSave);

  // Tapping blank space on this card (the prompt text, the padding around
  // the picker) before choosing a mood gets the same gentle nudge Save
  // gives — note-taking is exempt, so clicking into the textarea to write
  // first is never treated as "you forgot something." Mood-option taps
  // never reach here with selectedMood still null (that button's own
  // handler already set it before this bubbles up), so they're naturally
  // excluded too.
  document.getElementById("entry-card")?.addEventListener("click", (e) => {
    if (state.selectedMood !== null || inCooldown() || state.submitting) return;
    if (e.target.closest("#reflection-text, .field-label, .note-counter")) return;
    showMoodReminder();
  });

  document.getElementById("terms-btn")?.addEventListener("click", () => {
    state.termsReturnView = "checkin";
    state.view = "terms";
    render();
  });

  document.getElementById("back-to-home-btn")?.addEventListener("click", () => {
    state.view = "home";
    render();
    if (state.phone) loadHomeData(state.phone);
  });

  // Whole card is the click target, not just the inner label — the inner
  // "EazeScore Daily" button stays as the focusable/keyboard-accessible
  // element (its own click still bubbles up here), but tapping the number
  // or caption anywhere else on the card now opens the same popup.
  document.getElementById("score-card")?.addEventListener("click", () => {
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

// Shared by the home banner and both stat-card info popups' CTA — only the
// banner also logs a CheckinBannerLog row, since that's specifically what
// that table tracks (see backend/app/routers/checkins.py).
function navigateToCheckin() {
  state.view = "checkin";
  // Only clear the transient mood pick — checkedInToday/nextCheckinAt/
  // streakDays reflect real state and must not be force-reset here, or
  // they'd desync from what's actually true until the fetch below lands.
  state.selectedMood = null;
  render();
  if (state.phone) loadRealUserData(state.phone);
}

// ---------- Home page wiring ----------
function wireHomeEvents() {
  document.getElementById("terms-btn")?.addEventListener("click", () => {
    state.termsReturnView = "home";
    state.view = "terms";
    render();
  });

  document.getElementById("score-card")?.addEventListener("click", () => {
    state.homeInfoModal = "score";
    render();
  });

  document.getElementById("sessions-card")?.addEventListener("click", () => {
    state.homeInfoModal = "sessions";
    render();
  });

  document.getElementById("checkin-banner-btn")?.addEventListener("click", () => {
    navigateToCheckin();
    if (state.phone) {
      // Fire-and-forget — logs this banner tap (see CheckinBannerLog on the
      // backend); never blocks or fails the navigation it's tracking.
      apiPost("/checkins/banner-click", { phone: state.phone }).catch((err) => {
        console.error("Failed to log banner click", err);
      });
    }
  });

  document.getElementById("claim-card")?.addEventListener("click", () => {
    state.homeInfoModal = null;
    state.showClaimModal = true;
    state.claimResult = null;
    render();
  });
}

// ---------- Home stat-card info modal wiring ----------
function wireHomeInfoModal() {
  document.getElementById("home-info-overlay")?.addEventListener("click", (e) => {
    if (e.target.id !== "home-info-overlay") return;
    state.homeInfoModal = null;
    render();
  });
  document.getElementById("home-info-close")?.addEventListener("click", () => {
    state.homeInfoModal = null;
    render();
  });
  document.getElementById("home-info-cta")?.addEventListener("click", () => {
    state.homeInfoModal = null;
    navigateToCheckin();
  });
}

// ---------- Welcome bonus modal wiring ----------
function closeWelcomeBonusModal() {
  state.welcomeBonusJustAwarded = false;
  render();
}

function wireWelcomeBonusModal() {
  document.getElementById("welcome-bonus-overlay")?.addEventListener("click", (e) => {
    if (e.target.id !== "welcome-bonus-overlay") return;
    closeWelcomeBonusModal();
  });
  document.getElementById("welcome-bonus-close")?.addEventListener("click", closeWelcomeBonusModal);
  document.getElementById("welcome-bonus-done")?.addEventListener("click", closeWelcomeBonusModal);
}

// ---------- Claim modal wiring ----------
function closeClaimModal() {
  state.showClaimModal = false;
  state.claimResult = null;
  render();
}

function wireClaimModal() {
  document.getElementById("claim-overlay")?.addEventListener("click", (e) => {
    if (e.target.id !== "claim-overlay") return;
    closeClaimModal();
  });
  document.getElementById("claim-close")?.addEventListener("click", closeClaimModal);
  document.getElementById("claim-done")?.addEventListener("click", closeClaimModal);
  document.getElementById("claim-submit")?.addEventListener("click", handleClaimSubmit);
}

const CONFETTI_COLORS = ["var(--primary-500)", "var(--primary-200)", "var(--success-500)", "var(--secondary-200)", "var(--white-100)"];
const CONFETTI_PIECE_COUNT = 26;

// Fires once per successful claim render, and once for the welcome-bonus
// popup (see the render() dispatcher) — generates fresh pieces every time
// rather than reusing a cached template, so the burst looks a little
// different on every claim.
function spawnConfetti(containerId = "claim-confetti") {
  const container = document.getElementById(containerId);
  if (!container) return;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < CONFETTI_PIECE_COUNT; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.setProperty("--x", `${Math.round(Math.random() * 100)}%`);
    piece.style.setProperty("--drift", `${Math.round((Math.random() - 0.5) * 160)}px`);
    piece.style.setProperty("--rot", `${Math.round(Math.random() * 540)}deg`);
    piece.style.setProperty("--dur", `${(1.1 + Math.random() * 0.9).toFixed(2)}s`);
    piece.style.setProperty("--delay", `${(Math.random() * 0.35).toFixed(2)}s`);
    piece.style.setProperty("--piece-color", CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
    frag.appendChild(piece);
  }
  container.appendChild(frag);
}

// Always empties the full balance — see backend/app/routers/eaze_score.py's
// claim_coins, which deducts the ledger before even attempting the coin
// transfer, so EazeScore resets to 0 regardless of whether delivery succeeds.
async function handleClaimSubmit() {
  if (state.eazeScore <= 0 || state.claiming) return;
  const coins = computeCoins(state.eazeScore);

  state.claiming = true;
  render();
  try {
    const claim = await apiPost("/eaze-score/claim", { phone: state.phone });
    const ok = claim.status === "mock_success" || claim.status === "submitted";
    state.eazeScore = 0;
    state.claimResult = {
      ok,
      coins: claim.coins_requested,
      message: ok
        ? "Your EazeScore has been converted and reset to 0."
        : "Your EazeScore was reset to 0, but the coins couldn't be delivered yet — this has been flagged for follow-up.",
    };
  } catch (err) {
    console.error("Claim failed", err);
    state.claimResult = {
      ok: false,
      coins,
      message: err.message || "Something went wrong and your claim wasn't recorded. Please try again.",
    };
  } finally {
    state.claiming = false;
    render();
  }
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

function wireBonusModal() {
  document.getElementById("bonus-overlay")?.addEventListener("click", (e) => {
    if (e.target.id !== "bonus-overlay") return;
    state.showBonusModal = false;
    render();
  });
  document.getElementById("bonus-close")?.addEventListener("click", () => {
    state.showBonusModal = false;
    render();
  });
  document.getElementById("bonus-done")?.addEventListener("click", () => {
    state.showBonusModal = false;
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

let moodReminderTimer = null;

// Gentle, self-dismissing nudge — never a blocking modal — shown when the
// user acts on this card (taps Save, taps blank space in it) before
// picking a mood. Safe to call repeatedly; it just resets its own timer.
function showMoodReminder() {
  if (!els.moodReminder) return;
  els.moodReminder.hidden = false;
  clearTimeout(moodReminderTimer);
  moodReminderTimer = setTimeout(() => {
    if (els.moodReminder) els.moodReminder.hidden = true;
  }, 2200);
}

// Picking a mood always resolves whatever the reminder was nudging about —
// hide it immediately rather than leaving it to linger out its timer
// underneath a now-selected, glowing mood.
function hideMoodReminder() {
  if (!els.moodReminder) return;
  clearTimeout(moodReminderTimer);
  els.moodReminder.hidden = true;
}

function renderMoodPicker() {
  els.moodPicker.innerHTML = "";
  const hasSelection = state.selectedMood !== null;
  MOODS.forEach((mood) => {
    const btn = document.createElement("button");
    btn.type = "button";
    const isSelected = state.selectedMood === mood.value;
    // At rest (nothing picked yet) every option stays at full, inviting
    // brightness — dimming only kicks in once a mood IS picked, to fade the
    // other four out. A dimmed resting state read as "disabled" and killed
    // engagement before the user ever tapped anything.
    btn.className =
      "mood-option" + (isSelected ? " selected" : "") + (hasSelection && !isSelected ? " dimmed" : "");
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", isSelected ? "true" : "false");
    btn.disabled = inCooldown() || state.submitting;
    btn.innerHTML = `<span class="mood-circle"><span class="emoji">${mood.emoji}</span></span><span class="mood-label">${mood.label}</span>`;
    btn.addEventListener("click", () => {
      state.selectedMood = mood.value;
      hideMoodReminder();
      renderMoodPicker();
      renderSaveButton();
    });
    els.moodPicker.appendChild(btn);
  });
}

function renderSaveButton() {
  const cooldown = inCooldown();
  // Only truly disabled (no click event at all) for reasons the reminder
  // can't help with — mid-request, or cooldown. With no mood picked yet,
  // it stays clickable (still looking just as inactive via .btn--inactive)
  // so tapping it can surface the gentle reminder below instead of doing
  // nothing silently.
  els.saveBtn.disabled = cooldown || state.submitting;
  els.saveBtn.classList.toggle("btn--inactive", !cooldown && !state.submitting && state.selectedMood === null);
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

// Home page's "EazeScore" card — the current claimable balance (resets to 0
// on claim, see handleClaimSubmit), not a lifetime total; tapping the card
// (see wireHomeEvents) surfaces the earn/streak-bonus/claim explanation that
// used to live in the progress bar's caption.
function renderCumulativeScore() {
  els.scoreValue.textContent = state.eazeScore;
}

// Check-in page's "EazeScore Daily" card — today's contribution only (0
// before saving, 10 normally, 60 on a bonus day), so it reads as "what did
// I just earn" rather than duplicating the balance shown on home.
// Bar fill is today's amount out of the max a single day can award (10 base
// + 50 bonus), so a bonus day visibly fills the bar all the way.
const MAX_DAILY_SCORE = POINTS_PER_CHECKIN + WEEKLY_STREAK_BONUS;

function renderDailyScore() {
  els.scoreValue.textContent = state.todayEarned;
  els.scoreCaption.textContent = !state.checkedInToday
    ? "Check in today to add to your EazeScore"
    : state.lastBonusAwarded || state.todayEarned >= MAX_DAILY_SCORE
    ? `+${state.todayEarned} added — includes today's streak bonus`
    : `+${state.todayEarned} added to your EazeScore`;

  if (state.lastBonusAwarded) {
    state.lastBonusAwarded = false;
    // Bar's gone — the celebratory pulse now plays on the number itself.
    els.scoreValue.classList.add("just-bonus");
    setTimeout(() => els.scoreValue.classList.remove("just-bonus"), 700);
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
  if (state.submitting || inCooldown()) return;
  if (state.selectedMood === null) {
    showMoodReminder();
    return;
  }

  state.submitting = true;
  renderEntryState();

  const mood = state.selectedMood;
  const message = pickMessage(mood);
  const now = new Date();
  // A streak dot only ever advances on the day's FIRST check-in — a 2nd or
  // 3rd same-day entry still earns points but shouldn't push the streak
  // forward again.
  const wasCheckedInToday = state.checkedInToday;

  // Persist for real, so this survives a refresh. The backend is the source
  // of truth for score/streak — we only mirror its result into local UI
  // state, never compute it ourselves.
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

    // Claimable balance, not lifetime earned — see computeStateFromApi.
    state.eazeScore = result.score.available;
    state.todayEarned = result.score.today_earned;
    state.sessionsCount = result.score.sessions_count;
    state.lastBonusAwarded = result.streak_bonus_awarded;
    state.showBonusModal = result.streak_bonus_awarded;
    state.checkedInToday = true;
    state.nextCheckinAt = result.score.next_checkin_at;
    state.submitting = false;

    // Full render (not just renderAll) when the bonus popup needs to be
    // injected into the DOM — renderAll only patches existing elements,
    // it never appends the modal overlay itself.
    if (state.showBonusModal) render();
    else renderAll();
    renderReaffirm(message);

    const dot = els.streakDots.querySelector(`[data-idx="${todayIdx}"]`);
    if (dot) dot.classList.add("just-filled");
  } catch (err) {
    console.error("Failed to save check-in", err);
    state.submitting = false;
    renderEntryState(); // re-enable Save so the user can retry
  }
}

render();

// Restored session (including a fresh banner login) for a real user:
// initial render above shows the clean shell, this fetches their actual
// persisted score/history once restoreSession has settled.
sessionReady.then(() => {
  if (state.view === "home" && state.phone) {
    loadHomeData(state.phone);
  }
});
