// Reimagine: deals fresh two-sided Imagine cards from the lists in js/data.
(() => {
  "use strict";

  const PER_SIDE = 8;
  const PER_CARD = PER_SIDE * 2;
  const HISTORY_MAX = 60;
  const STORE_KEY = "reimagine:v1";

  const GROUPS = window.REIMAGINE_DATA || [];
  const CATS = GROUPS.flatMap((g) => g.categories);
  const CAT_BY_ID = new Map(CATS.map((c) => [c.id, c]));
  const TOTAL_WORDS = CATS.reduce((n, c) => n + c.words.length, 0);

  const $ = (id) => document.getElementById(id);
  const keyOf = (catId, word) => catId + "|" + word;
  const randInt = (n) => Math.floor(Math.random() * n);
  const fmt = (n) => n.toLocaleString("en-US");
  const wide = window.matchMedia("(min-width: 860px)");
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  // Random order where heavier items tend to come first
  // (Efraimidis-Spirakis weighted sampling without replacement).
  function weightedOrder(items, weight) {
    return items
      .map((item) => ({ item, key: Math.pow(Math.random(), 1 / Math.max(weight(item), 1e-9)) }))
      .sort((a, b) => b.key - a.key)
      .map((x) => x.item);
  }

  // ---------- saved state ----------

  function isCard(card) {
    return card && Number.isFinite(card.n) && Array.isArray(card.sides) && card.sides.length === 2 &&
      card.sides.every((side) => Array.isArray(side) && side.length === PER_SIDE &&
        side.every((s) => s && typeof s.w === "string" && CAT_BY_ID.has(s.c)));
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      return {};
    }
  }

  const saved = load();
  const state = {
    used: new Set(Array.isArray(saved.used) ? saved.used : []),
    // Stored as the categories switched off, so ones added later start switched on.
    enabled: new Set(CATS.map((c) => c.id).filter((id) => !(Array.isArray(saved.off) && saved.off.includes(id)))),
    history: Array.isArray(saved.history) ? saved.history.filter(isCard) : [],
    count: Number.isFinite(saved.count) ? saved.count : 0,
    index: 0,
    angle: 0, // card rotation in degrees; odd multiples of 180 show side B
  };
  if (!state.enabled.size) CATS.forEach((c) => state.enabled.add(c.id));
  state.index = Math.min(Math.max(Number.isFinite(saved.index) ? saved.index : Infinity, 0), state.history.length - 1);
  state.count = Math.max(state.count, ...state.history.map((c) => c.n), 0);

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        used: [...state.used],
        off: CATS.map((c) => c.id).filter((id) => !state.enabled.has(id)),
        history: state.history,
        index: state.index,
        count: state.count,
      }));
    } catch (err) {
      // Private mode or blocked storage: the deck still works for this visit.
    }
  }

  // ---------- dealing ----------

  function freshWords(catId) {
    return CAT_BY_ID.get(catId).words.filter((w) => !state.used.has(keyOf(catId, w)));
  }

  function freshCount() {
    let n = 0;
    for (const id of state.enabled) n += freshWords(id).length;
    return n;
  }

  function enabledTotal() {
    let n = 0;
    for (const id of state.enabled) n += CAT_BY_ID.get(id).words.length;
    return n;
  }

  function deal() {
    let reshuffled = false;
    if (freshCount() < PER_CARD) {
      for (const id of state.enabled) {
        for (const w of CAT_BY_ID.get(id).words) state.used.delete(keyOf(id, w));
      }
      reshuffled = true;
    }

    const pools = new Map();
    for (const id of state.enabled) {
      const words = freshWords(id);
      if (words.length) pools.set(id, words);
    }

    // Categories with more unseen words are picked more often, so the deck
    // runs down evenly. Each category shows up once per card when there are
    // enough of them; with fewer than 16 switched on, they repeat in turn.
    const order = weightedOrder([...pools.keys()], (id) => pools.get(id).length);
    const slots = [];
    while (slots.length < PER_CARD) {
      const before = slots.length;
      for (const id of order) {
        if (slots.length === PER_CARD) break;
        const pool = pools.get(id);
        if (pool.length) slots.push({ c: id, w: pool.splice(randInt(pool.length), 1)[0] });
      }
      if (slots.length === before) break;
    }

    for (const s of slots) state.used.add(keyOf(s.c, s.w));
    state.count += 1;
    state.history.push({
      n: state.count,
      sides: [shuffle(slots.slice(0, PER_SIDE)), shuffle(slots.slice(PER_SIDE, PER_CARD))],
    });
    if (state.history.length > HISTORY_MAX) state.history.splice(0, state.history.length - HISTORY_MAX);
    state.index = state.history.length - 1;
    state.angle = 0;
    save();
    return reshuffled;
  }

  // ---------- rendering ----------

  const faces = [$("faceA"), $("faceB")];

  function rowEl(num, slot) {
    const li = document.createElement("li");
    li.className = "row";
    li.dataset.num = String(num);

    const n = document.createElement("span");
    n.className = "num";
    n.textContent = String(num);

    const cat = document.createElement("span");
    cat.className = "cat";
    cat.textContent = CAT_BY_ID.get(slot.c).name;

    const word = document.createElement("span");
    word.className = "word";
    word.textContent = slot.w;

    li.append(n, cat, word);
    return li;
  }

  function renderCard(animate) {
    const card = state.history[state.index];
    $("cardNo").textContent = String(card.n);
    faces.forEach((face, i) => {
      face.querySelector(".rows").replaceChildren(...card.sides[i].map((slot, j) => rowEl(j + 1, slot)));
    });
    $("prev").disabled = state.index <= 0;
    $("next").disabled = state.index >= state.history.length - 1;
    renderSide(true);
    if (animate && !calm.matches) {
      const stage = $("stage");
      stage.classList.remove("deal");
      void stage.offsetWidth;
      stage.classList.add("deal");
    }
  }

  const sideShown = () => (((state.angle / 180) % 2) + 2) % 2;

  function renderSide(instant) {
    const flipper = $("flipper");
    if (instant) flipper.style.transition = "none";
    flipper.style.transform = "rotateY(" + state.angle + "deg)";
    if (instant) {
      void flipper.offsetWidth;
      flipper.style.transition = "";
    }
    const side = sideShown();
    $("sideName").textContent = side ? "Side B" : "Side A";
    document.querySelector(".sidehint").classList.toggle("flipped-b", side === 1);
    // On phones only one side is on screen; keep the hidden one out of tab order.
    faces.forEach((face, i) => { face.inert = !wide.matches && i !== side; });
  }

  function renderStatus(message) {
    const fresh = freshCount();
    const text = fresh === 1 ? "1 fresh word left" : fmt(fresh) + " fresh words left";
    $("status").textContent = message ? message + " " + text + "." : text;
    $("catCount").textContent = state.enabled.size + "/" + CATS.length;
  }

  // ---------- actions ----------

  let wakeLock = null;
  let wantAwake = false;
  async function keepAwake() {
    try {
      if ("wakeLock" in navigator && !wakeLock && document.visibilityState === "visible") {
        wakeLock = await navigator.wakeLock.request("screen");
        wakeLock.addEventListener("release", () => { wakeLock = null; });
      }
    } catch (err) {
      wakeLock = null;
    }
  }
  document.addEventListener("visibilitychange", () => { if (wantAwake) keepAwake(); });

  function draw() {
    const reshuffled = deal();
    renderCard(true);
    renderStatus(reshuffled ? "Every word has come up, so the deck was reshuffled." : "");
    wantAwake = true;
    keepAwake();
  }

  function go(delta) {
    const next = state.index + delta;
    if (next < 0 || next >= state.history.length) return;
    state.index = next;
    state.angle = 0;
    save();
    renderCard(false);
  }

  // dir > 0 turns the card to the right, dir < 0 to the left.
  function flip(dir) {
    state.angle += dir > 0 ? 180 : -180;
    renderSide(false);
  }

  let resetTimer = 0;
  function reset() {
    const button = $("reset");
    if (!resetTimer) {
      button.textContent = "Tap again to put every word back";
      button.classList.add("confirm");
      resetTimer = window.setTimeout(disarmReset, 4000);
      return;
    }
    disarmReset();
    state.used.clear();
    state.history = [];
    state.count = 0;
    deal();
    renderCard(true);
    renderStatus("Deck restarted.");
  }
  function disarmReset() {
    window.clearTimeout(resetTimer);
    resetTimer = 0;
    const button = $("reset");
    button.textContent = "Start the deck over";
    button.classList.remove("confirm");
  }

  // ---------- categories sheet ----------

  const dialog = $("catsDialog");

  function buildCategories() {
    const root = $("catGroups");
    for (const group of GROUPS) {
      const set = document.createElement("fieldset");
      const legend = document.createElement("legend");
      legend.textContent = group.group;
      const chips = document.createElement("div");
      chips.className = "chips";
      for (const cat of group.categories) {
        const label = document.createElement("label");
        label.className = "chip";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.id = "cat-" + cat.id;
        input.value = cat.id;
        const face = document.createElement("span");
        const count = document.createElement("small");
        count.textContent = String(cat.words.length);
        face.append(cat.name, count);
        label.append(input, face);
        chips.append(label);
      }
      set.append(legend, chips);
      root.append(set);
    }
    root.addEventListener("change", (e) => {
      if (e.target.type !== "checkbox") return;
      if (e.target.checked) state.enabled.add(e.target.value);
      else state.enabled.delete(e.target.value);
      afterCategoryChange();
    });
  }

  function syncCategoryInputs() {
    for (const cat of CATS) $("cat-" + cat.id).checked = state.enabled.has(cat.id);
  }

  function afterCategoryChange() {
    const none = state.enabled.size === 0;
    $("catsDone").disabled = none;
    $("catHint").textContent = none
      ? "Pick at least one category."
      : state.enabled.size + " of " + CATS.length + " on · " + fmt(enabledTotal()) + " words. Applies to the next card.";
    if (!none) {
      save();
      renderStatus("");
    }
  }

  function setAll(on) {
    state.enabled = new Set(on ? CATS.map((c) => c.id) : []);
    syncCategoryInputs();
    afterCategoryChange();
  }

  function openCategories() {
    syncCategoryInputs();
    afterCategoryChange();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  dialog.addEventListener("close", () => {
    if (!state.enabled.size) {
      CATS.forEach((c) => state.enabled.add(c.id));
      save();
    }
    renderStatus("");
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });

  // ---------- wiring ----------

  $("draw").addEventListener("click", draw);
  $("prev").addEventListener("click", () => go(-1));
  $("next").addEventListener("click", () => go(1));
  $("reset").addEventListener("click", reset);
  $("openCats").addEventListener("click", openCategories);
  $("allCats").addEventListener("click", () => setAll(true));
  $("noCats").addEventListener("click", () => setAll(false));

  // Drag or swipe the card sideways to turn it over (when one side shows at a time).
  // The card follows the finger, then finishes the turn or springs back.
  const stage = $("stage");
  const flipper = $("flipper");
  let drag = null;

  stage.addEventListener("pointerdown", (e) => {
    if (wide.matches || (e.pointerType === "mouse" && e.button !== 0)) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, active: false };
  });

  stage.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.active) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        drag = null; // a scroll, not a flip
        return;
      }
      if (Math.abs(dx) < 8) return;
      drag.active = true;
      stage.classList.add("dragging");
      stage.setPointerCapture(e.pointerId);
      flipper.style.transition = "none";
    }
    const tilt = Math.max(-100, Math.min(100, dx * 0.45));
    flipper.style.transform = "rotateY(" + (state.angle + tilt) + "deg)";
  });

  function endDrag(e, cancelled) {
    if (!drag || e.pointerId !== drag.id) return;
    const { active, x } = drag;
    drag = null;
    if (!active) return;
    stage.classList.remove("dragging");
    flipper.style.transition = "";
    const dx = e.clientX - x;
    if (!cancelled && Math.abs(dx) > 45) flip(dx);
    else renderSide(false);
  }
  stage.addEventListener("pointerup", (e) => endDrag(e, false));
  stage.addEventListener("pointercancel", (e) => endDrag(e, true));

  document.addEventListener("keydown", (e) => {
    if (dialog.open || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest("input, textarea, select")) return;
    const k = e.key.toLowerCase();
    if (k === "n") draw();
    else if (k === "f") flip(1);
    else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "ArrowRight") go(1);
    else return;
    e.preventDefault();
  });

  wide.addEventListener("change", () => renderSide(true));

  // ---------- start ----------

  buildCategories();
  if (!state.history.length) deal();
  renderCard(false);
  renderStatus("");
})();
