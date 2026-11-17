# Project Vision — Genesis

**Genesis** transforms the Dragon Ball Trainer (a 2D clicker/RPG) into a third-person
3D action RPG. Desktop PC (Windows), Kakarot-inspired, **original assets only** —
no copyrighted likenesses (Dragon Ball FighterZ/iClone ports, CGTrader models,
"exactly like Goku Black" are all refused).

## Pillars
1. **Movement first** — walk/run/jump/fly feel great before anything else.
2. **Original identity** — procedural/original characters (Vanguard, Rosé Saiyan);
   CC0 placeholders (Quaternius/Kenney) only for Milestones A–B.
3. **Engine-first rules** — pure TS sim in `src/genesis/sim/`, render layer only
   applies state. Testable headless.
4. **God Engine parity** — admin panel drives/inspects the 3D player via
   `genesisBus` (cross-tab), same pattern as the 2D battle.
5. **2D stays stable** — the 2D app is frozen (155 tests) during Genesis; no
   regressions on any commit.

## Milestones
- **A (Phases 0–2):** preservation + architecture + playable 3D character. ← current
- **B (Phases 3–8):** flight, combat, RPG progression, world, quests, bosses.
- **C (Phase 9):** God Engine ecosystem expansion.
- **D (Phases 10–12):** polish, optimization, desktop release.

## Alpha 0.1 target
1 region, 1–2 characters, movement + flight, melee + Ki combat, 2–3 enemy types,
1 boss, 3–5 quests, NPCs, XP/levels, 1 transformation, save/load, basic God Engine.

## Non-goals (for now)
- Mobile, multiplayer, asset-store purchases, copyrighted likenesses.
