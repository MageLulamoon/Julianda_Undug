// ============================================================
//  boss.js
//  Handles: Phase 2 sequence mechanic for the Void Sovereign
//  Phase 2 activates at 50% boss HP (triggered by combat.js).
//
//  How it works:
//    - A random 3-rune sequence is generated (non-dark only)
//    - Player must match runes in that exact order
//    - Matching the wrong rune deals 0 damage but doesn't break chain
//    - Matching a dark rune always deals 0 damage (boss is immune)
//    - Completing the sequence reshuffles a new one
// ============================================================

const PHASE2_RUNE_POOL = ["fire", "water", "grass"]; // dark excluded from sequence

const Phase2State = {
  active: false,
  sequence: [],        // e.g. ["water", "water", "grass"]
  progress: 0,         // index of the next rune the player must match (0, 1, or 2)
};

// ---------- Phase 2 Start ----------
function startPhase2() {
  Phase2State.active = true;
  Phase2State.progress = 0;
  Phase2State.sequence = generateSequence();
}

// Generate a random 3-rune sequence from the pool (fire, water, grass)
function generateSequence() {
  const seq = [];
  for (let i = 0; i < 3; i++) {
    seq.push(PHASE2_RUNE_POOL[Math.floor(Math.random() * PHASE2_RUNE_POOL.length)]);
  }
  return seq;
}

// ---------- Phase 2 Match Handler ----------
// Called by match.js whenever the player makes a match during phase 2.
// runeType: the type of rune matched
// matchCount: how many tiles matched (used for damage)
//
// Returns:
//   { damage, sequenceAdvanced, sequenceComplete, newSequence }
function handlePhase2Match(runeType, matchCount) {
  if (!Phase2State.active) return null;

  // Dark is always immune in phase 2
  if (runeType === "dark") {
    return { damage: 0, immune: true, sequenceAdvanced: false, sequenceComplete: false };
  }

  const expected = Phase2State.sequence[Phase2State.progress];

  // Wrong rune: no damage, no chain break, no progress
  if (runeType !== expected) {
    return { damage: 0, wrongRune: true, sequenceAdvanced: false, sequenceComplete: false };
  }

  // Correct rune: advance sequence
  Phase2State.progress++;

  // Base damage: same formula as normal (matchCount - 2, min 1)
  const baseDmg = Math.max(1, matchCount - 2);
  // No type multipliers in phase 2 — sequence hits all deal flat damage
  const damage = baseDmg;

  // Check if sequence is complete
  if (Phase2State.progress >= Phase2State.sequence.length) {
    Phase2State.progress = 0;
    Phase2State.sequence = generateSequence(); // shuffle new sequence
    return { damage, sequenceAdvanced: true, sequenceComplete: true, newSequence: Phase2State.sequence };
  }

  return { damage, sequenceAdvanced: true, sequenceComplete: false };
}

// ---------- Getters ----------
function getPhase2Sequence() { return Phase2State.sequence; }
function getPhase2Progress() { return Phase2State.progress; }
function isPhase2Active()     { return Phase2State.active; }

// Expose
window.Phase2State = Phase2State;
window.Boss = {
  startPhase2,
  handlePhase2Match,
  getPhase2Sequence,
  getPhase2Progress,
  isPhase2Active,
};
