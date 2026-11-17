# Migration Plan — 2D Trainer → 3D Genesis

The 2D app (`src/game/`) is **frozen during Genesis**: stable, regression-tested
(155 tests), no new features. Genesis is a parallel track under `src/genesis/`.

## Phases
- **Phase 0** — engine decision (Three.js + R3F + Rapier, ADR in TECH_STACK_DECISIONS.md).
- **Phase 1** — 3D stack, `/genesis` route (code-split, client-only), character sim + tests, scene, HUD.
- **Phase 2** — procedural fighter body + pure animation layer.
- **Phase 3** — physics/camera collision (Rapier deferred; manual AABB), character selection, God Engine adapter.
- **Phase 4+** — flight, combat, progression, world, quests, bosses (Milestone B).
- **Phase 9** — God Engine ecosystem expansion.
- **Phase 10–12** — polish, optimization, desktop release.

## 2D → 3D mapping
- `engine.ts` rules → `sim/character.ts`, `sim/combat.ts`, `sim/progression.ts` (pure, testable).
- `arena.tsx` (Canvas battle) → `render/FighterRose.tsx` + `render/GenesisScene.tsx`.
- `battleBus.ts` → `genesisBus.ts` (same pattern, cross-tab).
- Save envelope v2 (2D) → `sim/save.ts` v1 (Genesis, independent).

## Reversal triggers
- Rapier re-introduced when a React-19-compatible pairing lands (TECH_STACK_DECISIONS.md §7).
- Godot 4.6 remains the runner-up engine if Three.js hits a hard blocker.
