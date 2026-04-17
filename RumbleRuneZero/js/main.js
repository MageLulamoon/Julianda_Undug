// ============================================================
//  main.js
//  Entry point. Connects all modules together.
//  Handles: screen navigation, game start/reset,
//           monster progression, attack timer callback,
//           monster death, game over, victory
// ============================================================

// ---------- Game Over Gate ----------
// Set to true the instant the mage dies. Every async path checks
// this before doing anything — prevents tome modals bleeding into
// the game over screen.
let isGameOver = false;

// ---------- Persistent attack timer callback ----------
function onMonsterAttack(result) {
  if (isGameOver) return;
  UI.onMageDamage(result);
  if (result.mageDead) {
    endGame(false);
  }
}
// Expose so ui.js can restart the timer after closing the tome modal
window._onMonsterAttack = onMonsterAttack;

// ---------- Combo idle reset ----------
let comboResetTimer = null;

function resetComboAfterIdle() {
  clearTimeout(comboResetTimer);
  comboResetTimer = setTimeout(() => {
    resetCombo();
  }, 3000);
}

// ---------- Game Start ----------
function startGame() {
  // Clear the game over gate for a fresh run
  isGameOver = false;

  // Reset mage HP
  CombatState.mageHp = CombatState.mageMaxHp;

  // Reset inventory
  TomeInventory.slots = [null, null, null, null];
  UI.renderTomeSlots();

  // Load first monster
  loadMonster(0);

  // Show game screen
  UI.showScreen("screen-game");

  // Initialize grid
  initGrid(document.getElementById("grid-canvas"));

  // Render monster info and HP bars
  UI.renderMonsterInfo();
  UI.updateMageHp();
  UI.hidePhase2UI();

  // Start attack timer
  startAttackTimer(onMonsterAttack);

  // Set up tome slot click handlers
  UI.setupTomeSlotClicks();
}

// ---------- Monster Defeated ----------
// Called by grid.js after a match kills the current monster.
window.onMonsterDefeated = function(matchResult) {
  if (isGameOver) return;
  stopAttackTimer();

  const tomeDrop = rollTomeDrop("kill");

  setTimeout(async () => {
    if (isGameOver) return;

    if (tomeDrop) {
      await new Promise(resolve => {
        window._resolveTomeDecision = resolve;
        UI.showTomeDrop(tomeDrop);
      });
    }

    if (isGameOver) return;

    if (isLastMonster()) {
      endGame(true);
      return;
    }

    const nextIdx = nextMonsterIndex();
    loadMonster(nextIdx);

    initGrid(document.getElementById("grid-canvas"));
    UI.renderMonsterInfo();
    UI.updateMageHp();
    UI.updateRageIndicator();
    UI.hidePhase2UI();

    startAttackTimer(onMonsterAttack);
  }, 600);
};

// ---------- Game End ----------
function endGame(victory) {
  if (isGameOver && !victory) return; // prevent double-trigger on death
  isGameOver = true;

  stopAttackTimer();
  clearTimeout(comboResetTimer);

  // Force-close any tome modal that might be open right now
  const modal = document.getElementById("tome-modal");
  modal.classList.add("hidden");
  // Resolve any pending tome promise so the cascade doesn't hang
  if (window._resolveTomeDecision) {
    const res = window._resolveTomeDecision;
    window._resolveTomeDecision = null;
    res();
  }

  if (victory) {
    UI.showScreen("screen-victory");
  } else {
    UI.showScreen("screen-gameover");
  }
}

// ---------- Button Wiring ----------
document.addEventListener("DOMContentLoaded", () => {

  // Main menu
  document.getElementById("btn-start").addEventListener("click", startGame);
  document.getElementById("btn-howto").addEventListener("click", () => UI.showScreen("screen-howto"));
  document.getElementById("btn-back").addEventListener("click",  () => UI.showScreen("screen-menu"));

  // Game over
  document.getElementById("btn-retry").addEventListener("click", startGame);
  document.getElementById("btn-menu").addEventListener("click",  () => UI.showScreen("screen-menu"));

  // Victory
  document.getElementById("btn-retry-win").addEventListener("click", startGame);
  document.getElementById("btn-menu-win").addEventListener("click",  () => UI.showScreen("screen-menu"));

  // Show the main menu on load
  UI.showScreen("screen-menu");
});

// ---------- Phase 2 UI trigger hook ----------
const _origTriggerPhase2 = window.triggerPhase2;
window.triggerPhase2 = function() {
  _origTriggerPhase2();
  UI.showPhase2UI();
};

// ---------- Rage Mode UI hook ----------
const _origRestartAttackTimer = window.restartAttackTimer;
window.restartAttackTimer = function(isRage, onAttack) {
  _origRestartAttackTimer(isRage, onAttack || onMonsterAttack);
  if (isRage) {
    UI.updateRageIndicator();
  }
};
