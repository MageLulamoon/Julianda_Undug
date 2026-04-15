# Rumble Rune Zero

A Match-3 puzzle RPG where you play as a mage casting elemental rune spells to defeat monsters in a dungeon crawl.

## Team
- Julianda
- Undug

## How to Run
1. Clone the repository
2. Open `index.html` in a browser — no build step needed
3. Everything runs client-side

## Controls
- **Click** a rune tile to select it
- **Click** an adjacent tile to swap and attempt a match
- **Click** a Tome slot (bottom bar) to use that tome
- Tomes can be trashed in the pickup modal when your inventory is full

## Game Description
Match 3 or more runes of the same type to deal damage to the enemy monster. Type matchups matter:
- Fire beats Grass
- Grass beats Water
- Water beats Fire
- Dark is only super-effective vs Dark

Monsters attack on a real-time timer. Chain enough matches to trigger **Rage Mode**, making the monster attack faster. Collect **Tomes** (one-use spells) from kills and cascade chains.

The dungeon has 4 regular monsters, 1 boss minion, and a final boss — the **Void Sovereign**. At 50% HP the boss enters Phase 2, forcing you to match runes in a specific sequence to deal damage.

## File Structure
```
rumble-rune-zero/
├── index.html      — structure and screen layout
├── style.css       — all styling (pixel art theme)
├── README.md
└── js/
    ├── main.js     — entry point, game flow, screen transitions
    ├── grid.js     — 7x7 grid, input, cascades, gravity, refill
    ├── match.js    — match detection, damage dispatch
    ├── combat.js   — monster data, type chart, attack timer, rage mode
    ├── boss.js     — Phase 2 sequence mechanic
    ├── tomes.js    — tome definitions, inventory, effects
    └── ui.js       — all DOM rendering and UI updates
```

## Adding Sprites
All sprites are currently placeholder colored rectangles. To add real 16×16 pixel art sprites:
1. Export sprites as PNG with transparent backgrounds
2. Load them using `new Image()` in the relevant JS file
3. Replace `ctx.fillRect(...)` placeholder blocks with `ctx.drawImage(sprite, x, y, 64, 64)`

## Screenshots
_(Add screenshots of final build here)_
