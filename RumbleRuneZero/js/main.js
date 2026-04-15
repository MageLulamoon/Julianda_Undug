// ============================================================
//  main.js
//  Entry point. Connects all modules together.
//  Handles: screen navigation, game start/reset,
//           monster progression, attack timer callback,
//           monster death, game over, victory
// ============================================================

// ---------- Persistent attack timer callback ----------
// Defined here so restartAttackTimer can reference it.
function onMonsterAttack(result) {
  UI.onMageDamage(result);
  if (result.mageDead) {
    endGame(false);
  }
}

// ---------- Combo idle reset ----------
// If the player stops hitting for 3 seconds, reset the combo counter.
let comboResetTimer = null;

function resetComboAfterIdle() {
  clearTimeout(comboResetTimer);
  comboResetTimer = setTimeout(() => {
    resetCombo();
    // If rage mode was active but combo dropped, keep rage on until next fight
    // (design choice: rage only expires when the monster dies)
  }, 3000);
}

// ---------- Game Start ----------
function startGame() {
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
  stopAttackTimer();

  // Roll for tome drop on kill
  const tomeDrop = rollTomeDrop("kill");

  // Brief pause before advancing
  setTimeout(async () => {
    if (tomeDrop) {
      UI.showTomeDrop(tomeDrop);
      await new Promise(resolve => { window._resolveTomeDecision = resolve; });
    }

    if (isLastMonster()) {
      endGame(true); // Victory!
      return;
    }

    // Load next monster
    const nextIdx = nextMonsterIndex();
    loadMonster(nextIdx);

    // Reset grid for new fight
    initGrid(document.getElementById("grid-canvas"));

    UI.renderMonsterInfo();
    UI.updateMageHp();
    UI.updateRageIndicator();
    UI.hidePhase2UI();

    // Restart attack timer for the new monster
    startAttackTimer(onMonsterAttack);

  }, 600);
};

// ---------- Game End ----------
async function endGame(victory) {
  stopAttackTimer();
  clearTimeout(comboResetTimer);

  if (victory) {
    UI.showScreen("screen-victory");
    return;
  }

  // On death: roll tome drops for each filled inventory slot and show them
  // before the game over screen so the player sees what they had
  const deathDrops = [];
  // Give 1 guaranteed tome on death as a consolation
  const drop = rollTomeDrop("kill"); // reuse kill-rate drop
  if (drop) deathDrops.push(drop);

  if (deathDrops.length > 0) {
    for (const tomeId of deathDrops) {
      // Only offer if there's room (inventory might already be full)
      if (TomeInventory.hasRoom()) {
        await new Promise(resolve => {
          window._resolveTomeDecision = resolve;
          UI.showTomeDrop(tomeId);
        });
      }
    }
  }

  UI.showScreen("screen-gameover");
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
// combat.js calls Boss.startPhase2() which we intercept here
// by overriding the triggerPhase2 wrapper.
const _origTriggerPhase2 = window.triggerPhase2;
window.triggerPhase2 = function() {
  _origTriggerPhase2();
  UI.showPhase2UI();
};

// ---------- Rage Mode UI hook ----------
// Override checkRageMode to also update UI when rage triggers.
const _origRestartAttackTimer = window.restartAttackTimer;
window.restartAttackTimer = function(isRage, onAttack) {
  _origRestartAttackTimer(isRage, onAttack || onMonsterAttack);
  if (isRage) {
    UI.updateRageIndicator();
  }
};
