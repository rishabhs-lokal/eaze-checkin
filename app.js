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
  if (offsetFromToday === 1) return "Yday";
  const d = new Date();
  d.setDate(d.getDate() - offsetFromToday);
  return d.toLocaleDateString(undefined, { weekday: "short" });
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

function buildMoodHistory(seedValues) {
  // Whether there's history to show is a property of the scenario (has this
  // person ever logged a mood?), not of the current streak count — a broken
  // streak still has a past, it just isn't consecutive up to today.
  if (!seedValues || !seedValues.length) return [];
  const n = 7;
  // Chronological order — index 0 = oldest, last index = most recent. The
  // chart reads left-to-right like a normal timeline; the streak row is a
  // separate component and keeps its own today-on-the-left orientation.
  return Array.from({ length: n }, (_, i) => {
    const value = seedValues[i % seedValues.length];
    return { value, label: dayLabel(n - i), message: pickMessage(value) };
  });
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
  return {
    moodHistory: buildMoodHistory(s.moodValues),
    streakDays: buildStreakDays(s.streakCount),
    // 10 points per day of the current streak — a 3-day streak is 30 points,
    // full stop. Mood history is a separate concept (the last 7 calendar
    // days, whether or not they're consecutive) and doesn't factor in here.
    eazeScore: s.streakCount * POINTS_PER_CHECKIN,
    lastBonusAwarded: false,
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

// Calendar-day difference between two "YYYY-MM-DD" strings, computed in UTC
// to match the backend's date() comparisons — avoids local-timezone drift
// around midnight.
function daysBetween(fromStr, toStr) {
  const [fy, fm, fd] = fromStr.split("-").map(Number);
  const [ty, tm, td] = toStr.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

// Maps the API's raw check-in list + score state into this app's existing
// UI shape (moodHistory / streakDays / submittedToday / eazeScore) — same
// shape scenarioState() produces, so rendering code doesn't need to know
// whether the data came from a scenario or the real backend.
function computeStateFromApi(checkIns, scoreState) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const sorted = [...checkIns].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const last7 = sorted.slice(-7);
  const moodHistory = last7.map((c) => {
    const entryDateStr = c.created_at.slice(0, 10);
    const daysAgo = daysBetween(entryDateStr, todayStr);
    return { value: c.mood, label: dayLabel(daysAgo), message: pickMessage(c.mood) };
  });

  const hasCheckedInToday =
    sorted.length > 0 && sorted[sorted.length - 1].created_at.slice(0, 10) === todayStr;

  return {
    moodHistory,
    // scoreState.streak already counts today when checked in (see the
    // backend's GET /eaze-score) — it's exactly the dot count to show, no
    // adjustment needed.
    streakDays: buildFilledStreakDays(scoreState.streak),
    submittedToday: hasCheckedInToday,
    eazeScore: scoreState.earned,
    lastBonusAwarded: false,
    sessionsCount: scoreState.sessions_count,
    todayEarned: scoreState.today_earned,
  };
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
    });
  } catch (err) {
    console.error("Failed to load EazeScore home data", err);
    Object.assign(state, {
      eazeScore: 0,
      streakDays: buildStreakDays(0),
      sessionsCount: 0,
      todayEarned: 0,
      welcomeBonusJustAwarded: false,
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
  } catch (err) {
    console.error("Failed to load EazeScore/check-in history", err);
    Object.assign(state, {
      moodHistory: [],
      streakDays: buildStreakDays(0),
      submittedToday: false,
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

  moodHistory: [],
  streakDays: buildStreakDays(0),
  selectedMood: null,
  submittedToday: false,
  submitting: false,
  selectedDayIdx: null,
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
  const day = state.moodHistory[state.selectedDayIdx];
  if (!day) return "";
  const mood = moodByValue(day.value);
  return `
    <div id="day-detail-overlay" class="day-detail-overlay">
      <div class="day-detail-modal">
        <button id="day-detail-close" class="day-detail-close" type="button" aria-label="Close">✕</button>
        <span class="day-detail-emoji">${mood.emoji}</span>
        <p class="day-detail-day">${day.label === "Today" ? "Today" : day.label}</p>
        <p class="day-detail-mood">Feeling ${mood.label.toLowerCase()}</p>
        <p class="day-detail-message">${day.message}</p>
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
          <li>Check in daily to earn 10 points.</li>
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
            <h1 class="headline">How are you feeling today?</h1>
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
          <div class="score-bar-fill" id="score-bar-fill"></div>
        </div>
        <p class="score-caption" id="score-caption"></p>
      </section>

      <section class="card entry-card" id="entry-card">
        <p class="entry-prompt">Pick how today felt</p>
        <div class="mood-picker" id="mood-picker" role="radiogroup" aria-label="Select your mood"></div>

        <label class="field-label" for="reflection-text">Add a note <span class="optional-tag">(optional)</span></label>
        <textarea
          id="reflection-text"
          class="reflection-textarea"
          placeholder="Write freely — this is just for you…"
          rows="3"
        ></textarea>

        <button class="btn btn--filled" id="save-btn" disabled>
          <span id="save-btn-label">Save</span>
        </button>

        <p class="done-note" id="done-note" hidden>
          You've checked in today — come back tomorrow to keep your streak going.
        </p>
      </section>

      <section class="card reaffirm-card" id="reaffirm-card" hidden>
        <p class="reaffirm-text" id="reaffirm-text"></p>
      </section>

      <div class="grid-two">
        <section class="card chart-card">
          <h2 class="section-label"><span class="section-icon">${ICONS.trend}</span>Mood Over Time</h2>
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
function render() {
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
      (state.selectedDayIdx !== null ? dayDetailModal() : "") +
      (state.showRulesModal ? rulesModal() : "");
    queryEls();
    wireCheckinEvents();
    if (state.isTester) wireTesterToolbar();
    if (state.showTestModal) wireTestModal();
    if (state.selectedDayIdx !== null) wireDayDetailModal();
    if (state.showRulesModal) wireRulesModal();
    renderAll();
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
      state.submittedToday = false;
      // Simulated home-page fields — testers never hit the real backend, so
      // these are derived locally instead of coming from GET /eaze-score.
      // "Fresh Start" doubles as the demo for a first-ever login: the
      // welcome bonus fires once, same as it would for a real new user.
      state.sessionsCount = state.moodHistory.length;
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
    state.submittedToday = false;
    render();
  });

  document.getElementById("tester-sim-reset")?.addEventListener("click", () => {
    Object.assign(state, scenarioState(state.testMode || "active"));
    state.sessionsCount = state.moodHistory.length;
    state.todayEarned = 0;
    state.selectedMood = null;
    state.submittedToday = false;
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
  state.submittedToday = false;
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

  els.chart?.addEventListener("click", (e) => {
    const hit = e.target.closest("[data-idx]");
    if (!hit) return;
    state.selectedDayIdx = Number(hit.dataset.idx);
    render();
  });
}

// ---------- Home page wiring ----------
function wireHomeEvents() {
  document.getElementById("logout-btn")?.addEventListener("click", logout);

  document.getElementById("checkin-banner-btn")?.addEventListener("click", () => {
    state.view = "checkin";
    // Only clear the transient mood pick — submittedToday/streakDays reflect
    // real (or tester-simulated) state and must not be force-reset here, or
    // they'd desync from what's actually true until the fetch below lands.
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
    state.selectedDayIdx = null;
    render();
  });
  document.getElementById("day-detail-close")?.addEventListener("click", () => {
    state.selectedDayIdx = null;
    render();
  });
}

function currentStreakCount() {
  // Filled days are always contiguous starting from the leftmost circle.
  return state.streakDays.filter(Boolean).length;
}

function renderMoodPicker() {
  els.moodPicker.innerHTML = "";
  MOODS.forEach((mood) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mood-option" + (state.selectedMood === mood.value ? " selected" : "");
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", state.selectedMood === mood.value ? "true" : "false");
    btn.disabled = state.submittedToday || state.submitting;
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
  els.saveBtn.disabled = state.submittedToday || state.submitting || state.selectedMood === null;
  els.saveBtnLabel.innerHTML = state.submitting
    ? '<span class="spinner"></span> Thinking…'
    : state.submittedToday
    ? "Saved"
    : "Save";
}

function renderEntryState() {
  els.textarea.disabled = state.submittedToday || state.submitting;
  els.doneNote.hidden = !state.submittedToday;
  renderMoodPicker();
  renderSaveButton();
}

function renderReaffirm(message) {
  if (!message) {
    els.reaffirmCard.hidden = true;
    return;
  }
  els.reaffirmText.textContent = message;
  els.reaffirmCard.hidden = false;
}

function renderChart() {
  const points = state.moodHistory;
  // Fresh Start users have zero history — show the chart the moment they
  // submit their first entry rather than waiting to accumulate several.
  const MIN_POINTS = 1;

  if (points.length < MIN_POINTS) {
    els.chartWrap.hidden = true;
    els.chartEmpty.hidden = false;
    return;
  }
  els.chartWrap.hidden = false;
  els.chartEmpty.hidden = true;

  const H = 200;
  // Fixed pixel spacing per day rather than stretching to fill the card —
  // about 4 days fit in view at once, the rest reachable by scrolling right,
  // oldest to newest matching the streak row's left-to-right direction.
  const SLOT = 64, PAD_X = 24, PAD_TOP = 22, PAD_BOTTOM = 18;
  const usableH = H - PAD_TOP - PAD_BOTTOM;
  const n = points.length;
  const W = PAD_X * 2 + (n - 1) * SLOT;

  // One fixed height per mood value (1-5) — the y-axis, not a continuous scale.
  const valueToY = (value) => PAD_TOP + usableH * (1 - (value - 1) / 4);

  const coords = points.map((p, i) => [PAD_X + i * SLOT, valueToY(p.value)]);

  // Straight segments only — the line must land exactly on each day's mood
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
      const emojiSize = isMostRecent ? 19 : 16;
      const emoji = moodByValue(points[i].value).emoji;
      return `
        <g class="chart-point" data-idx="${i}">
          <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${backingR}" fill="${
        isMostRecent ? "rgba(255,158,68,0.22)" : "rgba(19,13,33,0.5)"
      }" stroke="${isMostRecent ? "#FF9E44" : "rgba(255,255,255,0.12)"}" stroke-width="${isMostRecent ? 2 : 1}" />
          <text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${emojiSize}" text-anchor="middle" dominant-baseline="central">${emoji}</text>
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
    const isTodayPending = !state.submittedToday && i === count;
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
  els.scoreCaption.textContent = !state.submittedToday
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
  if (state.selectedMood === null || state.submitting || state.submittedToday) return;

  state.submitting = true;
  renderEntryState();

  const mood = state.selectedMood;
  const message = pickMessage(mood);

  if (!state.isTester) {
    // Real user: persist for real, so this survives a refresh. The backend
    // is the source of truth for score/streak — we only mirror its result
    // into local UI state, never compute it ourselves.
    try {
      const note = els.textarea.value.trim() || null;
      const result = await apiPost("/checkins", { phone: state.phone, mood, note });

      state.moodHistory = [...state.moodHistory, { value: mood, label: "Today", message }].slice(-7);
      const todayIdx = state.streakDays.indexOf(false);
      if (todayIdx !== -1) state.streakDays[todayIdx] = true;

      state.eazeScore = result.score.earned;
      state.todayEarned = result.score.today_earned;
      state.sessionsCount = result.score.sessions_count;
      state.lastBonusAwarded = result.streak_bonus_awarded;
      state.submitting = false;
      state.submittedToday = true;

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

  // One entry per day: today's check-in joins the history at the end (chart
  // is chronological, oldest to newest), oldest day drops off the front so
  // it always shows a fixed 7-day window, never growing unbounded. The
  // message is stored with the day so tapping this point later shows the
  // exact same reassurance, not a freshly re-rolled one.
  state.moodHistory = [...state.moodHistory, { value: mood, label: "Today", message }].slice(-7);
  // Fill whichever circle comes right after the current streak — filled days
  // are always contiguous starting from the leftmost circle.
  const streakBefore = currentStreakCount();
  const todayIdx = state.streakDays.indexOf(false);
  if (todayIdx !== -1) state.streakDays[todayIdx] = true;
  const streakAfter = currentStreakCount();

  // Every check-in earns points; completing a full 7-day week on top of that
  // earns the one-time weekly bonus, awarded exactly on the save that gets
  // the streak from below 7 to 7.
  state.eazeScore += POINTS_PER_CHECKIN;
  state.lastBonusAwarded = streakBefore < 7 && streakAfter >= 7;
  state.todayEarned = POINTS_PER_CHECKIN + (state.lastBonusAwarded ? WEEKLY_STREAK_BONUS : 0);
  if (state.lastBonusAwarded) state.eazeScore += WEEKLY_STREAK_BONUS;
  state.sessionsCount += 1;

  state.submitting = false;
  state.submittedToday = true;

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
