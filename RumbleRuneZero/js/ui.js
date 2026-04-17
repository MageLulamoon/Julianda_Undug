// ============================================================
//  ui.js
//  Handles: HP bar updates, damage floating numbers,
//           monster sprite rendering (placeholder),
//           tome slot rendering, tome pickup modal,
//           phase 2 sequence display, rage indicator,
//           screen transitions
// ============================================================

// ---------- Screen Manager ----------
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(id);
  if (target) target.classList.add("active");
}

// ---------- HP Bars ----------
function updateMonsterHp() {
  const monster = CombatState.monster;
  if (!monster) return;

  const bar = document.getElementById("monster-hp-bar");
  const txt = document.getElementById("monster-hp-text");
  const pct = Math.max(0, monster.currentHp / monster.hp) * 100;

  bar.style.width = pct + "%";
  txt.textContent = `${monster.currentHp}/${monster.hp}`;

  // Color thresholds
  bar.classList.remove("hp-bar-mid", "hp-bar-low");
  if (pct <= 25) bar.classList.add("hp-bar-low");
  else if (pct <= 50) bar.classList.add("hp-bar-mid");
}

function updateMageHp() {
  const bar = document.getElementById("mage-hp-bar");
  const txt = document.getElementById("mage-hp-text");
  const pct = Math.max(0, CombatState.mageHp / CombatState.mageMaxHp) * 100;

  bar.style.width = pct + "%";
  txt.textContent = `${CombatState.mageHp}/${CombatState.mageMaxHp}`;

  bar.classList.remove("hp-bar-mid", "hp-bar-low");
  if (pct <= 25) bar.classList.add("hp-bar-low");
  else if (pct <= 50) bar.classList.add("hp-bar-mid");
}

// ---------- Monster Info ----------
function renderMonsterInfo() {
  const monster = CombatState.monster;
  if (!monster) return;

  const nameEl = document.getElementById("monster-name");
  const badgeEl = document.getElementById("monster-type-badge");

  nameEl.textContent = monster.name;
  nameEl.classList.toggle("rage", CombatState.isRageMode);

  badgeEl.textContent = monster.type.toUpperCase();
  badgeEl.className = `type-badge ${monster.type}`;

  updateMonsterHp();
  renderMonsterSprite();
}

// ---------- Monster Sprite Placeholder ----------
// Draws a pixel-art placeholder on the monster canvas.
// Replace ctx.fillRect calls with ctx.drawImage(sprite, ...) once assets are ready.
function renderMonsterSprite() {
  const monster = CombatState.monster;
  if (!monster) return;

  const canvas = document.getElementById("monster-canvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw a simple pixel block creature as placeholder
  const color = monster.spriteColor || "#888";
  ctx.imageSmoothingEnabled = false;

  // Body
  ctx.fillStyle = color;
  ctx.fillRect(20, 20, 40, 40);

  // Eyes
  ctx.fillStyle = "#fff";
  ctx.fillRect(26, 28, 8, 8);
  ctx.fillRect(46, 28, 8, 8);

  // Pupils
  ctx.fillStyle = "#000";
  ctx.fillRect(28, 30, 4, 4);
  ctx.fillRect(48, 30, 4, 4);

  // Mouth
  ctx.fillStyle = "#000";
  ctx.fillRect(28, 44, 24, 4);

  // Rage glow
  if (CombatState.isRageMode) {
    ctx.strokeStyle = "#ff2020";
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, 44, 44);
  }
}

// ---------- Rage Mode ----------
function updateRageIndicator() {
  const el = document.getElementById("rage-indicator");
  const nameEl = document.getElementById("monster-name");

  el.classList.toggle("hidden", !CombatState.isRageMode);
  nameEl.classList.toggle("rage", CombatState.isRageMode);
  renderMonsterSprite(); // redraw sprite with or without glow
}

// ---------- Floating Damage Numbers ----------
// Spawned as DOM elements that animate upward then remove themselves.
// canvasRect: DOMRect of the grid canvas, used to position floats near tiles.
function spawnDamageFloat(damage, multiplier, x, y) {
  const el = document.createElement("div");
  el.classList.add("dmg-float");

  let label = `-${damage}`;
  if (multiplier > 1.0) {
    el.classList.add("super");
    label = `💥 -${damage}`;
  } else if (multiplier < 1.0 && multiplier > 0) {
    el.classList.add("resist");
  }
  el.textContent = label;

  el.style.left = x + "px";
  el.style.top  = y + "px";
  document.body.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

function spawnMageDamageFloat(damage, x, y) {
  const el = document.createElement("div");
  el.classList.add("dmg-float");
  el.style.color = "#ff4040";
  el.textContent = `-${damage}`;
  el.style.left = x + "px";
  el.style.top  = y + "px";
  document.body.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

function spawnComboFloat(chainLevel, x, y) {
  if (chainLevel < 1) return;
  const el = document.createElement("div");
  el.classList.add("combo-float");
  el.textContent = `CHAIN x${chainLevel + 1}!`;
  el.style.left = x + "px";
  el.style.top  = y + "px";
  document.body.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

// ---------- Match Result Handler ----------
// Called by grid.js after each match wave resolves.
function onMatchResult(result) {
  if (!result) return;

  // Update monster HP bar
  updateMonsterHp();

  // Spawn a floating number near the center of the grid
  const gridCanvas = document.getElementById("grid-canvas");
  const rect = gridCanvas.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  for (const r of result.results) {
    if (r.damage > 0) {
      spawnDamageFloat(r.damage, r.multiplier || 1, cx + (Math.random() * 60 - 30), cy - 20);
    }
  }

  // Combo float
  if (result.chainLevel > 0) {
    spawnComboFloat(result.chainLevel, cx - 40, cy - 60);
  }

  // Phase 2 UI update
  if (CombatState.isPhase2) {
    updatePhase2UI();
  }
}

// Called by combat.js when mage takes damage
function onMageDamage(result) {
  updateMageHp();
  // Floating number near mage area
  const mageBar = document.getElementById("mage-hp-bar-wrap");
  const rect = mageBar.getBoundingClientRect();
  spawnMageDamageFloat(result.damage, rect.left + 20, rect.top - 20);
}

// ---------- Phase 2 UI ----------
function showPhase2UI() {
  const ui = document.getElementById("phase2-ui");
  ui.classList.remove("hidden");
  updatePhase2UI();
}

function hidePhase2UI() {
  document.getElementById("phase2-ui").classList.add("hidden");
}

function updatePhase2UI() {
  const seq = Boss.getPhase2Sequence();
  const progress = Boss.getPhase2Progress();

  // Sequence icons
  const seqEl = document.getElementById("phase2-sequence");
  seqEl.innerHTML = "";
  seq.forEach((type, i) => {
    const div = document.createElement("div");
    div.classList.add("seq-rune", type);
    if (i < progress) div.classList.add("matched");
    div.textContent = type[0].toUpperCase(); // F, W, G
    seqEl.appendChild(div);
  });

  // Progress dots
  const progEl = document.getElementById("phase2-progress");
  progEl.innerHTML = "";
  for (let i = 0; i < seq.length; i++) {
    const dot = document.createElement("div");
    dot.classList.add("progress-dot");
    if (i < progress) dot.classList.add("filled");
    progEl.appendChild(dot);
  }
}

// ---------- Tome Slots ----------
function renderTomeSlots() {
  const slots = document.querySelectorAll(".tome-slot");
  slots.forEach((slot, i) => {
    const tomeId = TomeInventory.slots[i];
    slot.innerHTML = "";
    slot.classList.remove("filled");

    if (tomeId) {
      const def = TOME_DEFS[tomeId];
      slot.classList.add("filled");
      slot.textContent = def.name;
      slot.title = def.desc;
    }
  });
}

// ---------- Tome Pickup Modal ----------
// Shown when a tome drops. Player can put it in a slot or trash it.
function showTomeDrop(tomeId) {
  const def = TOME_DEFS[tomeId];
  if (!def) {
    // Unknown tome — resolve immediately so cascade doesn't stall
    if (window._resolveTomeDecision) window._resolveTomeDecision();
    return;
  }

  // If there's an empty slot, auto-add with a notification — no modal needed
  if (TomeInventory.hasRoom()) {
    TomeInventory.add(tomeId);
    renderTomeSlots();
    showTomeNotification(`TOME: ${def.name}`);
    // Use setTimeout(0) so _resolveTomeDecision is guaranteed to be set
    // before we call it (the Promise is created right before showTomeDrop)
    setTimeout(() => {
      if (window._resolveTomeDecision) {
        const res = window._resolveTomeDecision;
        window._resolveTomeDecision = null;
        res();
      }
    }, 0);
    return;
  }

  // Inventory full — pause monster attacks while player decides
  stopAttackTimer();

  const modal  = document.getElementById("tome-modal");
  const infoEl = document.getElementById("tome-modal-info");
  const actEl  = document.getElementById("tome-modal-actions");

  infoEl.innerHTML = `<strong>${def.name}</strong><br><br>${def.desc}`;
  actEl.innerHTML  = "";
  modal.classList.remove("hidden");

  TomeInventory.slots.forEach((slotTomeId, i) => {
    const slotDef = TOME_DEFS[slotTomeId];
    const btn = document.createElement("button");
    btn.classList.add("tome-action-btn");
    btn.textContent = `Replace slot ${i + 1}: ${slotDef ? slotDef.name : "empty"}`;
    btn.addEventListener("click", () => {
      TomeInventory.replace(i, tomeId);
      renderTomeSlots();
      closeTomeModal();
    });
    actEl.appendChild(btn);
  });

  // Trash option
  const trashBtn = document.createElement("button");
  trashBtn.classList.add("tome-action-btn", "trash");
  trashBtn.textContent = "✕ DISCARD THIS TOME";
  trashBtn.addEventListener("click", closeTomeModal);
  actEl.appendChild(trashBtn);
}

function closeTomeModal() {
  document.getElementById("tome-modal").classList.add("hidden");
  // Resume monster attacks now that the player has made their decision
  startAttackTimer(window._onMonsterAttack);
  if (window._resolveTomeDecision) {
    const res = window._resolveTomeDecision;
    window._resolveTomeDecision = null;
    res();
  }
}

// ---------- Tome Drop Notification ----------
function showTomeNotification(text) {
  const el = document.createElement("div");
  el.classList.add("tome-drop-notif");
  el.textContent = text;
  document.body.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

// ---------- Tome Use from Slot ----------
// Called when player clicks a filled tome slot during gameplay
function setupTomeSlotClicks() {
  document.querySelectorAll(".tome-slot").forEach((slot, i) => {
    slot.addEventListener("click", () => {
      if (!TomeInventory.slots[i]) return;
      if (GridState.isLocked) return;

      const result = TomeInventory.use(i, GridState.grid);
      if (!result) return;

      renderTomeSlots();

      // Animate changed tiles and trigger cascade
      applyTomeEffect(result.changed);

      const def = TOME_DEFS[result.tomeId];
      showTomeNotification(`${def.name} USED!`);
    });
  });
}

// Expose
window.UI = {
  showScreen,
  updateMonsterHp,
  updateMageHp,
  renderMonsterInfo,
  updateRageIndicator,
  onMatchResult,
  onMageDamage,
  showPhase2UI,
  hidePhase2UI,
  updatePhase2UI,
  renderTomeSlots,
  showTomeDrop,
  showTomeNotification,
  setupTomeSlotClicks,
};
