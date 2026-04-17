// ============================================================
//  grid.js
//  Handles: 7x7 grid initialization, tile spawning,
//           player swap input (click-to-select), gravity/refill,
//           cascade loop, drawing placeholder sprites
//
//  Depends on: match.js, combat.js, tomes.js, ui.js
// ============================================================

const GRID_ROWS = 7;
const GRID_COLS = 7;
const TILE_SIZE = 64; // 16px sprite scaled ×4

const RUNE_TYPES = ["fire", "water", "grass", "dark"];

// Rune placeholder colors (used until real sprites are added)
const RUNE_COLORS = {
  fire:  "#ff6030",
  water: "#30aaff",
  grass: "#40d060",
  dark:  "#9060d0",
};

// Rune short labels for placeholder rendering
const RUNE_LABELS = {
  fire:  "F",
  water: "W",
  grass: "G",
  dark:  "D",
};

// ---------- Grid State ----------
const GridState = {
  grid: [],            // 2D array [row][col] of { type, sprite? }
  selectedCell: null,  // { r, c } of currently selected tile
  isLocked: false,     // prevents input during animations/cascades
  canvas: null,
  ctx: null,
};

// ---------- Initialization ----------
function initGrid(canvasEl) {
  GridState.canvas = canvasEl;
  GridState.ctx = canvasEl.getContext("2d");
  GridState.grid = createGrid();
  GridState.selectedCell = null;
  GridState.isLocked = false;

  // Resolve any matches that happen to appear on spawn (unlikely but safe)
  resolveStartingMatches();

  drawGrid();
  attachGridInput();
}

// Build a fresh 7x7 grid with random rune types.
// Dark runes are rare on spawn (only 10% chance) to keep the board balanced.
function createGrid() {
  const g = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    g[r] = [];
    for (let c = 0; c < GRID_COLS; c++) {
      g[r][c] = { type: randomRune() };
    }
  }
  return g;
}

function randomRune() {
  const roll = Math.random();
  if (roll < 0.10) return "dark";  // 10% dark
  const normals = ["fire", "water", "grass"];
  return normals[Math.floor(Math.random() * normals.length)];
}

// Clear any matches present on the starting board to avoid free damage.
function resolveStartingMatches() {
  let found = true;
  while (found) {
    const matched = findAllMatches(GridState.grid);
    if (matched.size === 0) { found = false; break; }
    for (const key of matched) {
      const [r, c] = key.split(",").map(Number);
      GridState.grid[r][c] = { type: randomRune() };
    }
  }
}

// ---------- Drawing ----------
function drawGrid() {
  const { ctx, grid, selectedCell } = GridState;
  if (!ctx) return;

  ctx.clearRect(0, 0, GRID_COLS * TILE_SIZE, GRID_ROWS * TILE_SIZE);

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const x = c * TILE_SIZE;
      const y = r * TILE_SIZE;
      const cell = grid[r][c];

      // Background tile
      ctx.fillStyle = "#1a1a28";
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

      // Subtle border
      ctx.strokeStyle = "#2a2a3a";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);

      if (!cell) continue;

      // ----- Placeholder sprite: colored rectangle + label -----
      // Replace this block with ctx.drawImage() once real sprites are ready.
      const padding = 6;
      ctx.fillStyle = RUNE_COLORS[cell.type] || "#888";
      ctx.fillRect(x + padding, y + padding, TILE_SIZE - padding * 2, TILE_SIZE - padding * 2);

      // Inner darker shade for depth
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(x + padding + 2, y + padding + 2, TILE_SIZE - padding * 2 - 4, TILE_SIZE - padding * 2 - 4);

      // Letter label
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(RUNE_LABELS[cell.type] || "?", x + TILE_SIZE / 2, y + TILE_SIZE / 2);
      // ----- End placeholder -----

      // Selection highlight
      if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
        ctx.strokeStyle = "#ffd040";
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      }
    }
  }
}

// ---------- Input ----------
function attachGridInput() {
  const canvas = GridState.canvas;
  canvas.addEventListener("click", onGridClick);
}

function onGridClick(e) {
  if (GridState.isLocked) return;

  const rect = GridState.canvas.getBoundingClientRect();
  // Account for CSS scaling if canvas is displayed at a different size
  const scaleX = GridState.canvas.width / rect.width;
  const scaleY = GridState.canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;

  const c = Math.floor(mx / TILE_SIZE);
  const r = Math.floor(my / TILE_SIZE);

  if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) return;

  handleCellClick(r, c);
}

function handleCellClick(r, c) {
  const { selectedCell, grid } = GridState;

  if (!selectedCell) {
    // Select this cell
    GridState.selectedCell = { r, c };
    drawGrid();
    return;
  }

  // If clicking the same cell, deselect
  if (selectedCell.r === r && selectedCell.c === c) {
    GridState.selectedCell = null;
    drawGrid();
    return;
  }

  // Check if adjacent (only cardinal directions allowed)
  const dr = Math.abs(r - selectedCell.r);
  const dc = Math.abs(c - selectedCell.c);

  if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
    // Attempt the swap
    attemptSwap(selectedCell.r, selectedCell.c, r, c);
    GridState.selectedCell = null;
  } else {
    // Not adjacent — select the new cell instead
    GridState.selectedCell = { r, c };
    drawGrid();
  }
}

// ---------- Swap & Cascade ----------
function attemptSwap(r1, c1, r2, c2) {
  const grid = GridState.grid;

  // Preview the swap
  const tmp = grid[r1][c1];
  grid[r1][c1] = grid[r2][c2];
  grid[r2][c2] = tmp;

  // Check if the swap creates a match
  const matches = findAllMatches(grid);
  if (matches.size === 0) {
    // Revert — invalid swap
    const tmp2 = grid[r1][c1];
    grid[r1][c1] = grid[r2][c2];
    grid[r2][c2] = tmp2;
    drawGrid();
    return;
  }

  // Lock input during resolution
  GridState.isLocked = true;
  drawGrid();

  // Begin cascade resolution loop
  runCascadeLoop(0);
}

// Cascade loop: resolves one wave at a time, then falls tiles and repeats.
// chainLevel tracks depth (0 = initial match, 1+ = cascades).
async function runCascadeLoop(chainLevel) {
  // Stop immediately if the game ended mid-cascade
  if (window.isGameOver) {
    GridState.isLocked = false;
    return;
  }

  const result = resolveMatches(GridState.grid, chainLevel);

  if (!result) {
    GridState.isLocked = false;
    drawGrid();
    return;
  }

  // Flash matched tiles
  drawGridWithHighlights(result.matchedPositions);
  await sleep(250);

  if (window.isGameOver) { GridState.isLocked = false; return; }

  // Apply gravity FIRST so no null cells remain on the grid
  applyGravity();
  refillGrid();
  drawGrid();
  await sleep(150);

  if (window.isGameOver) { GridState.isLocked = false; return; }

  // Apply damage to monster and update UI
  UI.onMatchResult(result);

  // Check if monster died
  if (CombatState.monster && CombatState.monster.currentHp <= 0) {
    GridState.isLocked = false;
    window.onMonsterDefeated(result);
    return;
  }

  // Handle tome drop AFTER board is fully filled — skip if game already over
  if (result.tomeDrop && !window.isGameOver) {
    await handleTomeDrop(result.tomeDrop);
  }

  if (window.isGameOver) { GridState.isLocked = false; return; }

  // Check for further cascades
  runCascadeLoop(chainLevel + 1);
}

// Safe tome drop handler — always resolves, never deadlocks
async function handleTomeDrop(tomeId) {
  return new Promise(resolve => {
    // Override the global resolve so the modal/auto-add can call it
    window._resolveTomeDecision = resolve;
    UI.showTomeDrop(tomeId);
  });
}

// Draws the grid with highlighted (matched) cells in white flash
function drawGridWithHighlights(positions) {
  drawGrid(); // base draw
  const ctx = GridState.ctx;
  for (const { r, c } of positions) {
    const x = c * TILE_SIZE;
    const y = r * TILE_SIZE;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  }
}

// Gravity: shift non-null tiles down within each column
function applyGravity() {
  const grid = GridState.grid;
  for (let c = 0; c < GRID_COLS; c++) {
    // Collect all non-null tiles in this column from bottom to top
    const tiles = [];
    for (let r = GRID_ROWS - 1; r >= 0; r--) {
      if (grid[r][c] !== null) tiles.push(grid[r][c]);
    }
    // Refill column: tiles at the bottom, nulls at the top
    for (let r = GRID_ROWS - 1; r >= 0; r--) {
      grid[r][c] = tiles.shift() || null;
    }
  }
}

// Refill: spawn new random tiles to replace any null cells (top fills first)
function refillGrid() {
  const grid = GridState.grid;
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (grid[r][c] === null) {
        grid[r][c] = { type: randomRune() };
      }
    }
  }
}

// ---------- Tome Effect on Grid ----------
// Called by ui.js after a tome is used. Redraws affected tiles.
function applyTomeEffect(changedCells) {
  drawGrid();
  // Highlight changed cells briefly
  const ctx = GridState.ctx;
  for (const { r, c } of changedCells) {
    const x = c * TILE_SIZE;
    const y = r * TILE_SIZE;
    ctx.fillStyle = "rgba(255,208,64,0.35)";
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  }
  setTimeout(() => {
    drawGrid();
    // After tome, check for new matches that cascade
    GridState.isLocked = true;
    runCascadeLoop(0);
  }, 400);
}

// ---------- Helpers ----------
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Expose
window.GridState = GridState;
window.initGrid = initGrid;
window.drawGrid = drawGrid;
window.applyTomeEffect = applyTomeEffect;
