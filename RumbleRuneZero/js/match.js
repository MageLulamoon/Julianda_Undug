// ============================================================
//  match.js
//  Handles: match detection on the 7x7 grid, cascade chains,
//           damage calculation dispatch, tome drop triggers
//
//  Depends on: combat.js, boss.js, tomes.js
// ============================================================

// ---------- Match Detection ----------
// Scans the entire grid and returns all matched tile positions.
// A match is 3 or more of the same type in a row or column.
// Returns an array of Sets, each Set being one connected match group.
function findAllMatches(grid) {
  const ROWS = grid.length;
  const COLS = grid[0].length;
  const matched = new Set(); // stores "r,c" strings

  // Check horizontal runs
  for (let r = 0; r < ROWS; r++) {
    let run = 1;
    for (let c = 1; c < COLS; c++) {
      const cur  = grid[r][c];
      const prev = grid[r][c - 1];
      // Null cells never match
      if (cur && prev && cur.type === prev.type) {
        run++;
      } else {
        if (run >= 3) {
          for (let k = c - run; k < c; k++) matched.add(`${r},${k}`);
        }
        run = 1;
      }
    }
    if (run >= 3) {
      for (let k = COLS - run; k < COLS; k++) matched.add(`${r},${k}`);
    }
  }

  // Check vertical runs
  for (let c = 0; c < COLS; c++) {
    let run = 1;
    for (let r = 1; r < ROWS; r++) {
      const cur  = grid[r][c];
      const prev = grid[r - 1][c];
      // Null cells never match
      if (cur && prev && cur.type === prev.type) {
        run++;
      } else {
        if (run >= 3) {
          for (let k = r - run; k < r; k++) matched.add(`${k},${c}`);
        }
        run = 1;
      }
    }
    if (run >= 3) {
      for (let k = ROWS - run; k < ROWS; k++) matched.add(`${k},${c}`);
    }
  }

  return matched; // Set of "r,c" strings
}

// Returns true if swapping two cells would create a match.
// Used to validate a player's swap before committing it.
function wouldCreateMatch(grid, r1, c1, r2, c2) {
  // Clone just the types into a lightweight 2D array for checking
  const types = grid.map(row => row.map(cell => ({ type: cell.type })));
  // Swap
  const tmp = types[r1][c1].type;
  types[r1][c1].type = types[r2][c2].type;
  types[r2][c2].type = tmp;
  const matches = findAllMatches(types);
  return matches.size > 0;
}

// ---------- Match Resolution ----------
// Called after a valid swap or cascade.
// Processes one "wave" of matches, returns result data for the caller.
//
// Parameters:
//   grid       — the live 7x7 grid array (modified in place)
//   chainLevel — 0 for the first match, +1 for each cascade
//   onAttack   — callback stored in main.js (needed for rage restart)
//
// Returns:
//   { totalDamage, matched, chainLevel, tomeDrop }
//   or null if no matches found
function resolveMatches(grid, chainLevel = 0) {
  const matchedSet = findAllMatches(grid);
  if (matchedSet.size === 0) return null;

  // Group matched tiles by rune type so each type group deals damage separately
  const groups = {}; // type → count
  for (const key of matchedSet) {
    const [r, c] = key.split(",").map(Number);
    const t = grid[r][c].type;
    groups[t] = (groups[t] || 0) + 1;
  }

  let totalDamage = 0;
  const results = [];

  for (const [runeType, count] of Object.entries(groups)) {
    let dmg = 0;
    let resultInfo = {};

    // --- Phase 2 boss handling ---
    if (CombatState.isPhase2) {
      const p2result = Boss.handlePhase2Match(runeType, count);
      if (p2result) {
        dmg = p2result.damage;
        // Apply damage to monster HP directly (bypassing type chart)
        if (dmg > 0) {
          CombatState.monster.currentHp = Math.max(0, CombatState.monster.currentHp - dmg);
        }
        resultInfo = { ...p2result, runeType, count };
      }
    } else {
      // --- Normal combat ---
      let effectiveType = runeType;

      // Tidal Ruin: treat dark as water
      if (TomeState.tidalRuinActive && runeType === "dark") {
        effectiveType = "water";
      }

      const raw = dealDamageToMonster(count, effectiveType);
      if (!raw) continue;

      let finalDmg = raw.damage;

      // Shadow Shock: 2x if dark rune and monster below 50% hp
      if (
        TomeState.shadowShockActive &&
        runeType === "dark" &&
        CombatState.monster.currentHp <= CombatState.monster.hp / 2
      ) {
        finalDmg *= 2;
        // Re-apply the extra damage (raw already subtracted once)
        CombatState.monster.currentHp = Math.max(0, CombatState.monster.currentHp - finalDmg / 2);
      }

      dmg = finalDmg;
      resultInfo = { ...raw, damage: dmg, runeType, count };
    }

    totalDamage += dmg;
    results.push(resultInfo);
  }

  // Clear matched tiles from the grid (set to null, grid.js will refill)
  for (const key of matchedSet) {
    const [r, c] = key.split(",").map(Number);
    grid[r][c] = null;
  }

  // Reset per-match tome flags
  TomeState.resetMatchFlags();

  // Check for cascade tome drop
  let tomeDrop = null;
  if (chainLevel > 0) {
    tomeDrop = rollTomeDrop("cascade");
  }

  return {
    totalDamage,
    matchedPositions: [...matchedSet].map(k => {
      const [r, c] = k.split(",").map(Number);
      return { r, c };
    }),
    groups,
    results,
    chainLevel,
    tomeDrop,
  };
}

// Expose
window.findAllMatches = findAllMatches;
window.wouldCreateMatch = wouldCreateMatch;
window.resolveMatches = resolveMatches;
