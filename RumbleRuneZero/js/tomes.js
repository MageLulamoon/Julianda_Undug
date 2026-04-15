// ============================================================
//  tomes.js
//  Handles: tome definitions, inventory (max 4 slots),
//           tome effect execution, drop logic
// ============================================================

// ---------- Tome Definitions ----------
// Each tome has a unique id, name, description, and effect function.
// The effect function receives the grid and returns a list of changed cells
// so the grid can redraw them.
const TOME_DEFS = {
  burnout: {
    id: "burnout",
    name: "BURNOUT",
    desc: "Converts all Grass runes to Dark.",
    // Effect: scan entire grid, change grass → dark
    effect(grid) {
      const changed = [];
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          if (grid[r][c].type === "grass") {
            grid[r][c].type = "dark";
            changed.push({ r, c });
          }
        }
      }
      return changed;
    },
  },

  overgrow: {
    id: "overgrow",
    name: "OVERGROW",
    desc: "Each Grass rune converts Dark runes in its 3x3 area to Grass.",
    effect(grid) {
      const ROWS = grid.length;
      const COLS = grid[0].length;
      const changed = [];

      // First, collect positions of all grass runes (before conversion)
      const grassPositions = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (grid[r][c].type === "grass") {
            grassPositions.push({ r, c });
          }
        }
      }

      // For each grass rune, check its 3x3 neighborhood
      for (const pos of grassPositions) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue; // skip the grass tile itself
            const nr = pos.r + dr;
            const nc = pos.c + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
              if (grid[nr][nc].type === "dark") {
                grid[nr][nc].type = "grass";
                // Avoid duplicates in changed list
                if (!changed.find(x => x.r === nr && x.c === nc)) {
                  changed.push({ r: nr, c: nc });
                }
              }
            }
          }
        }
      }
      return changed;
    },
  },

  tidal_ruin: {
    id: "tidal_ruin",
    name: "TIDAL RUIN",
    desc: "Dark runes deal damage as Water this turn.",
    // This tome sets a flag; match.js checks it during damage calc.
    // The effect function just sets the flag and returns nothing.
    effect(_grid) {
      TomeState.tidalRuinActive = true;
      return []; // no grid tiles change visually
    },
  },

  shadow_shock: {
    id: "shadow_shock",
    name: "SHADOW SHOCK",
    desc: "Dark runes deal 2x damage if monster is below 50% HP.",
    effect(_grid) {
      TomeState.shadowShockActive = true;
      return [];
    },
  },
};

// ---------- Tome Inventory State ----------
const TomeInventory = {
  slots: [null, null, null, null], // up to 4 tomes

  // Returns true if there's at least one empty slot
  hasRoom() {
    return this.slots.some(s => s === null);
  },

  // Add a tome to the first available slot. Returns slot index or -1.
  add(tomeId) {
    const idx = this.slots.indexOf(null);
    if (idx === -1) return -1;
    this.slots[idx] = tomeId;
    return idx;
  },

  // Remove (use or trash) a tome from a slot.
  remove(slotIndex) {
    this.slots[slotIndex] = null;
  },

  // Replace a slot with a new tome (used when inventory is full and player chooses to swap).
  replace(slotIndex, tomeId) {
    this.slots[slotIndex] = tomeId;
  },

  // Use a tome at a slot index. Applies effect, then removes from slot.
  // Returns { changed, tomeId } or null if slot is empty.
  use(slotIndex, grid) {
    const tomeId = this.slots[slotIndex];
    if (!tomeId) return null;
    const def = TOME_DEFS[tomeId];
    if (!def) return null;
    const changed = def.effect(grid);
    this.remove(slotIndex);
    return { changed, tomeId };
  },
};

// ---------- Active Tome Flags ----------
// These are read by match.js during damage calculation.
const TomeState = {
  tidalRuinActive: false,   // set by tidal_ruin tome
  shadowShockActive: false, // set by shadow_shock tome

  // Call after each match resolution to clear per-match flags
  resetMatchFlags() {
    this.tidalRuinActive = false;
    this.shadowShockActive = false;
  },
};

// ---------- Drop Logic ----------
// Called by match.js when a cascade chain or kill occurs.
// Returns a tome ID to offer the player, or null if no drop.
// Drop chances:
//   - Kill: 60% chance
//   - Cascade chain: 25% chance per chain level (capped)
const ALL_TOME_IDS = Object.keys(TOME_DEFS);

function rollTomeDrop(reason) {
  let chance = 0;
  if (reason === "kill")    chance = 0.60;
  if (reason === "cascade") chance = 0.25;

  if (Math.random() < chance) {
    // Return a random tome from the pool
    return ALL_TOME_IDS[Math.floor(Math.random() * ALL_TOME_IDS.length)];
  }
  return null;
}

// Expose
window.TOME_DEFS = TOME_DEFS;
window.TomeInventory = TomeInventory;
window.TomeState = TomeState;
window.rollTomeDrop = rollTomeDrop;
