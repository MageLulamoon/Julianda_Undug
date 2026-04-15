// ============================================================
//  combat.js
//  Handles: type chart, monster definitions, attack timer,
//           rage mode tracking, damage calculation
// ============================================================

// ---------- Type Effectiveness Chart ----------
// Usage: TYPE_CHART[attackingRune][monsterType] = multiplier
const TYPE_CHART = {
  fire:  { fire: 1.0, water: 0.7, grass: 1.3, dark: 1.0 },
  water: { fire: 1.3, water: 1.0, grass: 0.7, dark: 1.0 },
  grass: { fire: 0.7, water: 1.3, grass: 1.0, dark: 1.0 },
  dark:  { fire: 1.0, water: 1.0, grass: 1.0, dark: 1.3 },
};

// Returns the damage multiplier for a rune type vs a monster type.
function getTypeMultiplier(runeType, monsterType) {
  if (TYPE_CHART[runeType] && TYPE_CHART[runeType][monsterType] !== undefined) {
    return TYPE_CHART[runeType][monsterType];
  }
  return 1.0; // fallback neutral
}

// ---------- Monster Definitions ----------
// Each monster has:
//   name, type, hp, damage, attackInterval (ms), sprite color (placeholder)
// The dungeon order: regular1 → regular2 → regular3 → regular4 → bossMinion → boss
const MONSTER_DATA = [
  {
    id: "ember_sprite",
    name: "EMBER SPRITE",
    type: "fire",
    hp: 15,
    damage: 2,
    attackInterval: 5000,   // attacks every 5 seconds
    spriteColor: "#ff6030",
    isBoss: false,
    isMinion: false,
  },
  {
    id: "marsh_toad",
    name: "MARSH TOAD",
    type: "water",
    hp: 25,                  // tanky
    damage: 3,               // high attack
    attackInterval: 6000,
    spriteColor: "#30aaff",
    isBoss: false,
    isMinion: false,
  },
  {
    id: "briar_wolf",
    name: "BRIAR WOLF",
    type: "grass",
    hp: 14,                  // fast / high attack
    damage: 4,
    attackInterval: 3500,    // attacks faster
    spriteColor: "#40d060",
    isBoss: false,
    isMinion: false,
  },
  {
    id: "cinder_golem",
    name: "CINDER GOLEM",
    type: "fire",
    hp: 20,                  // balanced
    damage: 3,
    attackInterval: 4500,
    spriteColor: "#e05020",
    isBoss: false,
    isMinion: false,
  },
  {
    id: "shade_wraith",
    name: "SHADE WRAITH",   // boss minion — dark type
    type: "dark",
    hp: 18,
    damage: 3,
    attackInterval: 4000,
    spriteColor: "#9060d0",
    isBoss: false,
    isMinion: true,
  },
  {
    id: "void_sovereign",
    name: "VOID SOVEREIGN", // final boss — dark type, has phase 2
    type: "dark",
    hp: 45,
    damage: 4,
    attackInterval: 4500,
    spriteColor: "#6030a0",
    isBoss: true,
    isMinion: false,
  },
];

// ---------- Combat State ----------
// This object is the single source of truth for the current fight.
// main.js reads and writes to this via the functions below.
const CombatState = {
  monsterIndex: 0,       // which monster we're currently fighting
  monster: null,         // copy of current MONSTER_DATA entry + current hp
  mageHp: 50,
  mageMaxHp: 50,

  // Attack timer
  attackTimer: null,     // setInterval handle
  isRageMode: false,
  comboHits: 0,          // hits landed this "window" — triggers rage at threshold
  RAGE_COMBO_THRESHOLD: 5,          // hits needed to enter rage
  RAGE_SPEED_MULTIPLIER: 0.70,      // rage makes attacks 30% faster (interval × 0.70)

  // Phase 2 (boss only)
  isPhase2: false,
};

// ---------- Combat Functions ----------

// Load a monster by dungeon index into CombatState.
function loadMonster(index) {
  const data = MONSTER_DATA[index];
  CombatState.monsterIndex = index;
  CombatState.monster = {
    ...data,
    currentHp: data.hp,
  };
  CombatState.isRageMode = false;
  CombatState.comboHits = 0;
  CombatState.isPhase2 = false;
}

// Deal damage to the current monster. Returns an object with result info.
// matchCount: number of runes matched in one move (3 = base, 4 = +1, etc.)
// runeType: which rune was matched
function dealDamageToMonster(matchCount, runeType) {
  const monster = CombatState.monster;
  if (!monster) return null;

  // Base damage: 1 per tile matched (3-match = 1, 4-match = 2, etc.)
  let baseDamage = matchCount - 2;

  // Type modifier
  // During boss phase 2, dark runes deal 0 damage (immune)
  let effectiveRuneType = runeType;
  if (CombatState.isPhase2 && runeType === "dark") {
    return { damage: 0, multiplier: 0, immune: true };
  }

  let multiplier = getTypeMultiplier(effectiveRuneType, monster.type);

  // Shadow Shock tome effect is handled externally in tomes.js
  // — it sets a flag that doubles multiplier when applied

  let finalDamage = Math.max(1, Math.round(baseDamage * multiplier));

  // Apply damage
  monster.currentHp = Math.max(0, monster.currentHp - finalDamage);

  // Track combo for rage
  CombatState.comboHits++;
  checkRageMode();

  // Check boss phase 2 trigger (50% hp)
  if (monster.isBoss && !CombatState.isPhase2 && monster.currentHp <= monster.hp / 2) {
    triggerPhase2();
  }

  return {
    damage: finalDamage,
    multiplier,
    isSuper: multiplier > 1.0,
    isResist: multiplier < 1.0,
    monsterDead: monster.currentHp <= 0,
    phase2Triggered: CombatState.isPhase2,
  };
}

// Deal damage to the mage (called by attack timer).
function dealDamageToMage() {
  const dmg = CombatState.monster ? CombatState.monster.damage : 1;
  CombatState.mageHp = Math.max(0, CombatState.mageHp - dmg);
  return { damage: dmg, mageDead: CombatState.mageHp <= 0 };
}

// ---------- Rage Mode ----------
function checkRageMode() {
  if (!CombatState.isRageMode && CombatState.comboHits >= CombatState.RAGE_COMBO_THRESHOLD) {
    CombatState.isRageMode = true;
    // Restart the attack timer at increased speed
    restartAttackTimer(true);
  }
}

function resetCombo() {
  // Called after a short idle window from main.js
  CombatState.comboHits = 0;
}

// ---------- Attack Timer ----------
// onAttack: callback function called each time monster attacks
function startAttackTimer(onAttack) {
  stopAttackTimer();
  const interval = CombatState.monster
    ? CombatState.monster.attackInterval
    : 4000;
  CombatState.attackTimer = setInterval(() => {
    const result = dealDamageToMage();
    onAttack(result);
  }, interval);
}

function restartAttackTimer(isRage, onAttack) {
  stopAttackTimer();
  if (!CombatState.monster) return;
  let interval = CombatState.monster.attackInterval;
  if (isRage) interval = Math.round(interval * CombatState.RAGE_SPEED_MULTIPLIER);
  // onAttack stored globally in main.js; we re-pass it here via argument
  if (onAttack) {
    CombatState.attackTimer = setInterval(() => {
      const result = dealDamageToMage();
      onAttack(result);
    }, interval);
  }
}

function stopAttackTimer() {
  if (CombatState.attackTimer) {
    clearInterval(CombatState.attackTimer);
    CombatState.attackTimer = null;
  }
}

// ---------- Boss Phase 2 ----------
function triggerPhase2() {
  CombatState.isPhase2 = true;
  // Phase2State is managed in boss.js
  Boss.startPhase2();
}

// ---------- Dungeon Progress ----------
function isLastMonster() {
  return CombatState.monsterIndex >= MONSTER_DATA.length - 1;
}

function nextMonsterIndex() {
  return CombatState.monsterIndex + 1;
}

// Expose on window so other scripts can access
window.CombatState = CombatState;
window.MONSTER_DATA = MONSTER_DATA;
window.TYPE_CHART = TYPE_CHART;
window.getTypeMultiplier = getTypeMultiplier;
window.loadMonster = loadMonster;
window.dealDamageToMonster = dealDamageToMonster;
window.dealDamageToMage = dealDamageToMage;
window.startAttackTimer = startAttackTimer;
window.restartAttackTimer = restartAttackTimer;
window.stopAttackTimer = stopAttackTimer;
window.triggerPhase2 = triggerPhase2;
window.resetCombo = resetCombo;
window.isLastMonster = isLastMonster;
window.nextMonsterIndex = nextMonsterIndex;
