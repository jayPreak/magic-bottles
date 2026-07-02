"use strict";

// Classic water-sort palette (12 colors, hardest levels use them all)
const PALETTE = [
  "#e53935", // red
  "#ff9800", // orange
  "#fdd835", // yellow
  "#7cb342", // lime
  "#2e7d32", // dark green
  "#4fc3f7", // sky blue
  "#3949ab", // blue
  "#8e24aa", // purple
  "#ec407a", // pink
  "#795548", // brown
  "#90a4ae", // gray
  "#827717", // olive
];

const HIDDEN_COLOR = "#2b2b45";
const STORAGE_KEY = "magic-bottles-level";
const TOTAL_LEVELS = 30;

// ---------- 30-level campaign, harder over time ----------
// c = colors, cap = units per bottle, e = empty bottles,
// hidden = lower layers concealed until they reach the top (endgame twist)
const LEVELS = [
  { c: 3, cap: 4, e: 2 },              // 1
  { c: 3, cap: 4, e: 2 },              // 2
  { c: 4, cap: 4, e: 2 },              // 3
  { c: 4, cap: 4, e: 2 },              // 4
  { c: 5, cap: 4, e: 2 },              // 5
  { c: 5, cap: 4, e: 2 },              // 6
  { c: 6, cap: 4, e: 2 },              // 7  — 8 bottles
  { c: 6, cap: 4, e: 2 },              // 8
  { c: 6, cap: 5, e: 2 },              // 9
  { c: 7, cap: 4, e: 2 },              // 10
  { c: 7, cap: 5, e: 2 },              // 11
  { c: 7, cap: 5, e: 2 },              // 12
  { c: 8, cap: 4, e: 2 },              // 13
  { c: 8, cap: 5, e: 2 },              // 14
  { c: 8, cap: 5, e: 2 },              // 15
  { c: 8, cap: 6, e: 2 },              // 16
  { c: 9, cap: 5, e: 2 },              // 17
  { c: 9, cap: 5, e: 2 },              // 18
  { c: 9, cap: 6, e: 2 },              // 19
  { c: 10, cap: 5, e: 2 },             // 20
  { c: 10, cap: 6, e: 2 },             // 21
  { c: 10, cap: 6, e: 2 },             // 22
  { c: 10, cap: 7, e: 2 },             // 23
  { c: 8, cap: 4, e: 2, hidden: true },  // 24
  { c: 8, cap: 5, e: 2, hidden: true },  // 25
  { c: 9, cap: 5, e: 2, hidden: true },  // 26
  { c: 10, cap: 5, e: 2, hidden: true }, // 27
  { c: 10, cap: 6, e: 2, hidden: true }, // 28
  { c: 11, cap: 5, e: 2, hidden: true }, // 29
  { c: 12, cap: 5, e: 2, hidden: true }, // 30
];

function levelConfig(level) {
  if (level <= TOTAL_LEVELS) return LEVELS[level - 1];
  // Endless mode after level 30: cycle the hardest configs
  return LEVELS[26 + ((level - 31) % 4)];
}

// ---------- Level generation ----------
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Random fill where every bottle starts with all-different colors.
function distinctFill(colors, capacity) {
  const remaining = new Array(colors).fill(capacity);
  const bottles = [];
  for (let b = 0; b < colors; b++) {
    const bottle = [];
    for (let s = 0; s < capacity; s++) {
      const options = [];
      for (let c = 0; c < colors; c++) {
        if (remaining[c] > 0 && !bottle.includes(c)) options.push(c);
      }
      if (options.length === 0) return null; // dead end, retry
      const max = Math.max(...options.map((c) => remaining[c]));
      const best = options.filter((c) => remaining[c] >= max - 1);
      const pick = best[Math.floor(Math.random() * best.length)];
      bottle.push(pick);
      remaining[pick]--;
    }
    bottles.push(bottle);
  }
  return bottles;
}

// Guaranteed distinct fill: bottle b gets colors (b..b+cap-1) mod colors.
function latinFill(colors, capacity) {
  const relabel = shuffle([...Array(colors).keys()]);
  const bottles = [];
  for (let b = 0; b < colors; b++) {
    const bottle = [];
    for (let k = 0; k < capacity; k++) bottle.push(relabel[(b + k) % colors]);
    shuffle(bottle);
    bottles.push(bottle);
  }
  return shuffle(bottles);
}

function plainFill(colors, capacity) {
  const units = [];
  for (let c = 0; c < colors; c++) for (let i = 0; i < capacity; i++) units.push(c);
  shuffle(units);
  const bottles = [];
  for (let b = 0; b < colors; b++) bottles.push(units.slice(b * capacity, (b + 1) * capacity));
  if (bottles.some((bt) => bt.every((u) => u === bt[0]))) return null;
  return bottles;
}

// ---------- Solver (DFS with memo) so every level is guaranteed solvable ----------
function topRun(bottle) {
  if (bottle.length === 0) return { color: -1, count: 0 };
  const color = bottle[bottle.length - 1];
  let count = 1;
  for (let i = bottle.length - 2; i >= 0 && bottle[i] === color; i--) count++;
  return { color, count };
}

function isSolved(bottles, capacity) {
  return bottles.every(
    (b) => b.length === 0 || (b.length === capacity && b.every((u) => u === b[0]))
  );
}

function isSolvable(bottles, capacity, maxStates = 60000) {
  const seen = new Set();
  const key = (state) => state.map((b) => b.join(",")).sort().join("|");
  const stack = [bottles.map((b) => b.slice())];
  seen.add(key(stack[0]));

  while (stack.length > 0) {
    if (seen.size > maxStates) return true; // too big to prove; random states are ~always solvable
    const st = stack.pop();
    if (isSolved(st, capacity)) return true;

    for (let from = 0; from < st.length; from++) {
      const src = st[from];
      if (src.length === 0) continue;
      const { color, count } = topRun(src);
      if (count === src.length && src.length === capacity) continue;
      for (let to = 0; to < st.length; to++) {
        if (to === from) continue;
        const dst = st[to];
        if (dst.length >= capacity) continue;
        if (dst.length > 0 && dst[dst.length - 1] !== color) continue;
        if (dst.length === 0 && count === src.length) continue;
        const amount = Math.min(count, capacity - dst.length);
        const next = st.map((b) => b.slice());
        next[to].push(...next[from].splice(next[from].length - amount, amount));
        const k = key(next);
        if (!seen.has(k)) {
          seen.add(k);
          stack.push(next);
        }
      }
    }
  }
  return false;
}

function generateLevel(level) {
  const { c: colors, cap: capacity, e: empties, hidden } = levelConfig(level);
  for (let attempt = 0; attempt < 30; attempt++) {
    let filled = null;
    if (capacity <= colors) {
      for (let t = 0; t < 50 && !filled; t++) filled = distinctFill(colors, capacity);
      if (!filled) filled = latinFill(colors, capacity);
    } else {
      filled = plainFill(colors, capacity);
    }
    if (!filled) continue;
    const bottles = [...filled];
    for (let e = 0; e < empties; e++) bottles.push([]);
    if (isSolvable(bottles, capacity)) return { bottles, capacity, hidden: !!hidden };
  }
  const filled = latinFill(colors, capacity);
  const bottles = [...filled];
  for (let e = 0; e < empties; e++) bottles.push([]);
  return { bottles, capacity, hidden: !!hidden };
}

// ---------- Utilities ----------
function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16) + amt);
  const g = Math.min(255, ((n >> 8) & 0xff) + amt);
  const b = Math.min(255, (n & 0xff) + amt);
  return `rgb(${r},${g},${b})`;
}

function segmentStyle(colorIdx) {
  const c = PALETTE[colorIdx];
  return `linear-gradient(180deg, ${lighten(c, 45)} 0%, ${c} 28%, ${c} 100%)`;
}

// ---------- Game state ----------
const state = {
  level: parseInt(localStorage.getItem(STORAGE_KEY) || "1", 10),
  bottles: [],
  capacity: 4,
  hiddenMode: false,
  hiddenCount: [], // per bottle: how many units at the bottom are still concealed
  selected: -1,
  history: [],
  moves: 0,
  animating: false,
};

const boardEl = document.getElementById("board");
const levelNumEl = document.getElementById("level-num");
const movesEl = document.getElementById("moves-count");
const undoBtn = document.getElementById("btn-undo");
const restartBtn = document.getElementById("btn-restart");
const winOverlay = document.getElementById("win-overlay");
const winTitle = document.getElementById("win-title");
const winStats = document.getElementById("win-stats");
const nextBtn = document.getElementById("btn-next");
const confettiEl = document.getElementById("confetti");

// Show/hide also toggles display so the overlay can never appear
// before the stylesheet loads (the fade still comes from the CSS class).
function showOverlay() {
  winOverlay.style.display = "flex";
  requestAnimationFrame(() => winOverlay.classList.remove("hidden"));
  // Bottles are composited layers (filter/transform) and some GPUs paint
  // them above the fixed overlay — hide the board while the modal is up.
  setTimeout(() => (boardEl.style.visibility = "hidden"), 320);
}

function hideOverlay() {
  winOverlay.classList.add("hidden");
  winOverlay.style.display = "none";
  confettiEl.innerHTML = "";
  boardEl.style.visibility = "";
}

function startLevel() {
  const { bottles, capacity, hidden } = generateLevel(state.level);
  state.bottles = bottles;
  state.capacity = capacity;
  state.hiddenMode = hidden;
  state.hiddenCount = bottles.map((b) => (hidden ? Math.max(0, b.length - 1) : 0));
  state.selected = -1;
  state.history = [];
  state.moves = 0;
  state.animating = false;
  hideOverlay();
  buildBoard();
  render();
}

// ---------- Rendering ----------
let bottleEls = [];
let glassHeight = 144;

function buildBoard() {
  boardEl.innerHTML = "";
  bottleEls = [];
  const perRow = 4;
  const rows = Math.ceil(state.bottles.length / perRow);
  const rowGap = 26;
  const neckAndLift = 12 + 18;
  const avail = boardEl.clientHeight - 24 - (rows - 1) * rowGap;
  glassHeight = Math.max(
    22 * state.capacity,
    Math.min(36 * state.capacity, Math.floor(avail / rows) - neckAndLift)
  );
  state.bottles.forEach((_, i) => {
    const bottle = document.createElement("div");
    bottle.className = "bottle";
    bottle.dataset.index = i;

    const neck = document.createElement("div");
    neck.className = "neck";
    const glass = document.createElement("div");
    glass.className = "glass";
    glass.style.height = glassHeight + "px";
    const shine = document.createElement("div");
    shine.className = "shine";

    bottle.appendChild(neck);
    bottle.appendChild(glass);
    bottle.appendChild(shine);
    boardEl.appendChild(bottle);
    bottleEls.push(bottle);
  });
}

function syncBottleDom(i) {
  const bottle = state.bottles[i];
  const el = bottleEls[i];
  const glass = el.querySelector(".glass");
  while (glass.children.length > bottle.length) glass.removeChild(glass.lastChild);
  while (glass.children.length < bottle.length) {
    const seg = document.createElement("div");
    seg.className = "segment";
    glass.appendChild(seg);
  }
  bottle.forEach((colorIdx, s) => {
    const seg = glass.children[s];
    seg.style.transitionDuration = "";
    seg.style.height = 100 / state.capacity + "%";
    if (s < state.hiddenCount[i]) {
      seg.classList.add("hidden-seg");
      seg.style.background = HIDDEN_COLOR;
      seg.textContent = "?";
    } else {
      seg.classList.remove("hidden-seg");
      seg.style.background = segmentStyle(colorIdx);
      seg.textContent = "";
    }
  });
}

function render() {
  levelNumEl.textContent =
    state.level <= TOTAL_LEVELS ? `${state.level}/${TOTAL_LEVELS}` : `${state.level} ∞`;
  movesEl.textContent = state.moves;
  undoBtn.disabled = state.history.length === 0 || state.animating;

  state.bottles.forEach((bottle, i) => {
    syncBottleDom(i);
    const el = bottleEls[i];
    el.classList.toggle("selected", state.selected === i);
    const done =
      bottle.length === state.capacity && bottle.every((u) => u === bottle[0]);
    el.classList.toggle("done", done);
  });
}

// ---------- Interaction ----------
function canPour(from, to) {
  if (from === to) return 0;
  const src = state.bottles[from];
  const dst = state.bottles[to];
  if (src.length === 0) return 0;
  if (dst.length >= state.capacity) return 0;
  const { color, count } = topRun(src);
  if (dst.length > 0 && dst[dst.length - 1] !== color) return 0;
  return Math.min(count, state.capacity - dst.length);
}

function onBottleTap(i) {
  if (state.animating) return;
  if (!winOverlay.classList.contains("hidden")) return;

  if (state.selected === -1) {
    if (state.bottles[i].length > 0) {
      state.selected = i;
      render();
    }
    return;
  }

  if (state.selected === i) {
    state.selected = -1;
    render();
    return;
  }

  const from = state.selected;
  const amount = canPour(from, i);
  if (amount > 0) {
    state.history.push({
      bottles: state.bottles.map((b) => b.slice()),
      hiddenCount: state.hiddenCount.slice(),
    });
    const prevDstLen = state.bottles[i].length;
    const { color } = topRun(state.bottles[from]);
    const src = state.bottles[from];
    state.bottles[i].push(...src.splice(src.length - amount, amount));
    state.hiddenCount[from] = Math.min(
      state.hiddenCount[from],
      Math.max(0, state.bottles[from].length - 1)
    );
    state.moves++;
    state.selected = -1;
    animatePour(from, i, amount, color, prevDstLen);
  } else {
    const el = bottleEls[i];
    el.classList.add("shake");
    setTimeout(() => el.classList.remove("shake"), 400);
    state.selected = state.bottles[i].length > 0 ? i : -1;
    render();
  }
}

// ---------- Pour animation ----------
const FLY_MS = 200;
const UNIT_MS = 130;
const POUR_BASE_MS = 130;

function animatePour(from, to, amount, colorIdx, prevDstLen) {
  state.animating = true;
  render(); // clear selection lift before measuring

  const srcEl = bottleEls[from];
  const dstEl = bottleEls[to];
  const srcGlass = srcEl.querySelector(".glass");
  const dstGlass = dstEl.querySelector(".glass");
  // Snap the selection lift off instantly so rects are measured at rest.
  srcEl.style.transition = "none";
  void srcEl.offsetHeight;
  const boardRect = boardEl.getBoundingClientRect();
  const srcRect = srcEl.getBoundingClientRect();
  const dstRect = dstEl.getBoundingClientRect();

  // The state is already updated; rebuild the DOM as it looked BEFORE the pour.
  const oldSrc = state.bottles[from].concat(new Array(amount).fill(colorIdx));
  while (srcGlass.children.length < oldSrc.length) {
    const seg = document.createElement("div");
    seg.className = "segment";
    srcGlass.appendChild(seg);
  }
  oldSrc.forEach((c, s) => {
    const seg = srcGlass.children[s];
    seg.style.height = 100 / state.capacity + "%";
    if (s < state.hiddenCount[from] && s < oldSrc.length - amount) {
      seg.style.background = HIDDEN_COLOR;
      seg.classList.add("hidden-seg");
      seg.textContent = "?";
    } else {
      seg.style.background = segmentStyle(c);
      seg.classList.remove("hidden-seg");
      seg.textContent = "";
    }
  });
  // ...and the target back to its pre-pour fill (render() above already
  // added the new segments at full height; they must grow in during the pour).
  while (dstGlass.children.length > prevDstLen) dstGlass.removeChild(dstGlass.lastChild);

  // Fly the source bottle above the target, tilted toward it.
  const side = srcRect.left <= dstRect.left ? 1 : -1;
  const dx = dstRect.left - srcRect.left - side * 30;
  const dy = dstRect.top - srcRect.top - srcRect.height * 0.62;
  srcEl.style.zIndex = 20;
  srcEl.style.transition = `transform ${FLY_MS}ms ease-in-out`;
  srcEl.style.transform = `translate(${dx}px, ${dy}px) rotate(${side * 68}deg)`;

  const pourMs = POUR_BASE_MS + UNIT_MS * amount;

  setTimeout(() => {
    // Liquid stream falling into the target
    const stream = document.createElement("div");
    stream.className = "stream";
    const segH = glassHeight / state.capacity;
    const surfaceY = dstRect.bottom - boardRect.top - prevDstLen * segH - 4;
    const topY = dstRect.top - boardRect.top - 14;
    stream.style.left = dstRect.left - boardRect.left + dstRect.width / 2 - 3 + "px";
    stream.style.top = topY + "px";
    stream.style.height = surfaceY - topY + "px";
    stream.style.background = PALETTE[colorIdx];
    boardEl.appendChild(stream);

    // Drain the source's poured segments...
    for (let k = 0; k < amount; k++) {
      const seg = srcGlass.children[oldSrc.length - 1 - k];
      seg.style.transitionDuration = pourMs + "ms";
      seg.style.height = "0%";
    }
    // ...while the target's new segments grow.
    for (let k = 0; k < amount; k++) {
      const seg = document.createElement("div");
      seg.className = "segment";
      seg.style.height = "0%";
      seg.style.background = segmentStyle(colorIdx);
      dstGlass.appendChild(seg);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          seg.style.transitionDuration = pourMs + "ms";
          seg.style.height = 100 / state.capacity + "%";
        })
      );
    }

    setTimeout(() => {
      stream.remove();
      srcEl.style.transform = "";
      setTimeout(() => {
        srcEl.style.zIndex = "";
        srcEl.style.transition = "";
        state.animating = false;
        render();
        dstEl.classList.add("pop");
        setTimeout(() => dstEl.classList.remove("pop"), 300);
        if (isSolved(state.bottles, state.capacity)) onWin();
      }, FLY_MS + 40);
    }, pourMs + 60);
  }, FLY_MS + 30);
}

// ---------- Win ----------
function spawnConfetti() {
  confettiEl.innerHTML = "";
  for (let i = 0; i < 60; i++) {
    const p = document.createElement("div");
    p.className = "confetti-piece";
    p.style.left = Math.random() * 100 + "%";
    p.style.background = PALETTE[i % PALETTE.length];
    p.style.animationDelay = Math.random() * 0.8 + "s";
    p.style.animationDuration = 1.6 + Math.random() * 1.4 + "s";
    p.style.width = 6 + Math.random() * 6 + "px";
    p.style.height = 10 + Math.random() * 8 + "px";
    confettiEl.appendChild(p);
  }
}

function onWin() {
  setTimeout(() => {
    if (state.level === TOTAL_LEVELS) {
      winTitle.textContent = "🏆 All 30 Levels Beaten!";
      winStats.textContent = `Final level solved in ${state.moves} moves`;
      nextBtn.textContent = "Endless Mode →";
    } else {
      winTitle.textContent = "Level Complete!";
      winStats.textContent = `Solved in ${state.moves} moves`;
      nextBtn.textContent = "Next Level →";
    }
    spawnConfetti();
    showOverlay();
  }, 250);
}

undoBtn.addEventListener("click", () => {
  if (state.history.length === 0 || state.animating) return;
  const prev = state.history.pop();
  state.bottles = prev.bottles;
  state.hiddenCount = prev.hiddenCount;
  state.moves++;
  state.selected = -1;
  render();
});

restartBtn.addEventListener("click", () => {
  if (state.animating) return;
  startLevel();
});

nextBtn.addEventListener("click", () => {
  state.level++;
  localStorage.setItem(STORAGE_KEY, String(state.level));
  startLevel();
});

// Taps are hit-tested at board level with generous padding, so slightly
// off-target taps (fat fingers, synthetic clicks) still land on a bottle.
function bottleAtPoint(x, y) {
  const pad = 22;
  let best = -1;
  let bestD = Infinity;
  bottleEls.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    if (x < r.left - pad || x > r.right + pad) return;
    if (y < r.top - pad || y > r.bottom + pad + 14) return;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const d = (x - cx) ** 2 + (y - cy) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

let lastPointerTime = 0;

function handleBoardTap(e) {
  const i = bottleAtPoint(e.clientX, e.clientY);
  if (i >= 0) onBottleTap(i);
}

boardEl.addEventListener("pointerdown", (e) => {
  lastPointerTime = Date.now();
  handleBoardTap(e);
});
// Fallback for environments that don't synthesize pointer events (deduped).
boardEl.addEventListener("click", (e) => {
  if (Date.now() - lastPointerTime > 500) handleBoardTap(e);
});

window.addEventListener("resize", () => {
  if (state.animating) return;
  buildBoard();
  render();
});

startLevel();
