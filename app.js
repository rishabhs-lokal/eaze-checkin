// Daily Check-in — Eaze
// Login + tester-mode scenario system, modeled on the actual Dostt Free
// Rewards app (root.innerHTML render loop, animated login button, country
// bottom sheet, test-phone -> scenario picker, persistent tester toolbar with
// live overrides) and reskinned with the Eaze design tokens.
// Mockup only: no backend. Session/test-mode persist to localStorage the same
// way the reference app does; check-in data itself stays in memory per scenario.

const MOODS = [
  { value: 1, emoji: "😞", label: "Rough" },
  { value: 2, emoji: "😕", label: "Low" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
];

const REAFFIRM_MESSAGES = {
  low: [
    "Thanks for being honest about a hard day. Naming it is already a step forward — be gentle with yourself tonight.",
    "Rough days don't erase the good ones. You showed up here anyway, and that counts for something.",
    "It's okay to not be okay. Your feelings are valid — take it slow, one moment at a time.",
  ],
  mid: [
    "An okay day is still a day you showed up for yourself. That's worth noticing.",
    "Not every day needs to be remarkable. Thanks for taking a moment to check in with how you actually feel.",
    "Steady days matter too — they're the quiet foundation the good ones are built on.",
  ],
  high: [
    "Love that energy. Whatever's going right for you today, let yourself enjoy it fully.",
    "That's a great mood to log — nice work carrying it with you today.",
    "Good days deserve to be noticed just as much as hard ones. Glad today was one of them.",
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
const EAZE_LOGO_SRC = "assets/eaze-logo.png";

function moodByValue(value) {
  return MOODS.find((m) => m.value === value) || MOODS[2];
}

function moodBucket(value) {
  if (value <= 2) return "low";
  if (value === 3) return "mid";
  return "high";
}

function pickMessage(value) {
  const bucket = REAFFIRM_MESSAGES[moodBucket(value)];
  return bucket[Math.floor(Math.random() * bucket.length)];
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

function scenarioState(key) {
  const s = SCENARIOS[key] || SCENARIOS.active;
  return {
    moodHistory: buildMoodHistory(s.moodValues),
    streakDays: buildStreakDays(s.streakCount),
  };
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
    Object.assign(state, scenarioState("active"));
    state.view = "checkin";
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
  };
}

// ---------- Templates ----------
function loginPage() {
  return `
    <div class="login-screen">
      <div class="login-inner">
        <div class="login-brand">
          <img src="${EAZE_LOGO_SRC}" alt="Eaze" class="login-logo" />
          <span class="login-wordmark">eaze</span>
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
        <div class="test-modal-title"><span>🧪</span><h2>Tester Mode</h2></div>
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

function checkinPage() {
  return `
    ${state.isTester ? testerToolbar() : ""}
    <main class="container">
      <header class="page-header">
        <div class="header-row">
          <div>
            <p class="eyebrow">Daily Check-in</p>
            <h1 class="headline">How are you feeling today?</h1>
          </div>
          <div class="eaze-logo" aria-label="Eaze">
            <img src="${EAZE_LOGO_SRC}" alt="Eaze" width="44" height="44" />
          </div>
        </div>
        <div class="streak-pill" id="streak-pill">
          <span class="streak-pill-icon">🔥</span>
          <span id="streak-pill-text"></span>
        </div>
      </header>

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

        <button class="pill-btn pill-btn--primary" id="save-btn" disabled>
          <span id="save-btn-label">Save</span>
        </button>

        <p class="done-note" id="done-note" hidden>
          You've checked in today ✨ — come back tomorrow to keep your streak going.
        </p>
      </section>

      <section class="card reaffirm-card" id="reaffirm-card" hidden>
        <p class="reaffirm-text" id="reaffirm-text"></p>
      </section>

      <div class="grid-two">
        <section class="card chart-card">
          <h2 class="section-label"><span class="section-icon">📈</span>Mood Over Time</h2>
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
          <h2 class="section-label"><span class="section-icon">🔥</span>Your Streak</h2>
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
  } else {
    root.innerHTML =
      checkinPage() +
      (state.showTestModal ? testModeModal() : "") +
      (state.selectedDayIdx !== null ? dayDetailModal() : "");
    queryEls();
    wireCheckinEvents();
    if (state.isTester) wireTesterToolbar();
    if (state.showTestModal) wireTestModal();
    if (state.selectedDayIdx !== null) wireDayDetailModal();
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
      if (label) label.textContent = "✓ Logged in!";

      setTimeout(() => {
        if (state.isTester) {
          state.testMode = null;
          state.showTestModal = true;
          render();
        } else {
          Object.assign(state, scenarioState("active"));
          state.view = "checkin";
          render();
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
      state.view = "checkin";
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
    state.selectedMood = null;
    state.submittedToday = false;
    render();
  });

  document.getElementById("tester-sim-reset")?.addEventListener("click", () => {
    Object.assign(state, scenarioState(state.testMode || "active"));
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
  Object.assign(state, scenarioState("active"));
  render();
}

// ---------- Check-in page wiring ----------
function wireCheckinEvents() {
  els.saveBtn?.addEventListener("click", handleSave);
  document.getElementById("logout-btn")?.addEventListener("click", logout);

  els.chart?.addEventListener("click", (e) => {
    const hit = e.target.closest("[data-idx]");
    if (!hit) return;
    state.selectedDayIdx = Number(hit.dataset.idx);
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

  const caption =
    count === 0 ? "Start a new streak today" : `${count} day${count === 1 ? "" : "s"} in a row`;
  els.streakCaption.textContent = caption;
  els.streakPillText.textContent = count === 0 ? "Start today" : `${count} day streak`;
}

function renderAll() {
  renderEntryState();
  renderChart();
  renderStreak();
}

async function handleSave() {
  if (state.selectedMood === null || state.submitting || state.submittedToday) return;

  state.submitting = true;
  renderEntryState();

  await new Promise((resolve) => setTimeout(resolve, 700));

  const mood = state.selectedMood;
  const message = pickMessage(mood);
  // One entry per day: today's check-in joins the history at the end (chart
  // is chronological, oldest to newest), oldest day drops off the front so
  // it always shows a fixed 7-day window, never growing unbounded. The
  // message is stored with the day so tapping this point later shows the
  // exact same reassurance, not a freshly re-rolled one.
  state.moodHistory = [...state.moodHistory, { value: mood, label: "Today", message }].slice(-7);
  // Fill whichever circle comes right after the current streak — filled days
  // are always contiguous starting from the leftmost circle.
  const todayIdx = state.streakDays.indexOf(false);
  if (todayIdx !== -1) state.streakDays[todayIdx] = true;
  state.submitting = false;
  state.submittedToday = true;

  renderAll();
  renderReaffirm(message);

  const dot = els.streakDots.querySelector(`[data-idx="${todayIdx}"]`);
  if (dot) dot.classList.add("just-filled");
}

render();
