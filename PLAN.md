# Dragon Ball RPG — Development Plan

**Version:** PRE ALPHA 0.1
**Last updated:** 2026-11-14
**Branch:** main (Lovable-connected — do not rewrite published history)

## Vision

A Dragon Ball clicker/RPG: train stats, unlock transformations, fight saga bosses, collect Dragon Balls, make wishes, and grow from a Saiyan rookie to a legend. Engine-first architecture (pure rules in `engine.ts`, React store only dispatches).

## Architecture (as found)

```
src/game/engine.ts     Pure rules: applyAction, hydrate, save envelope, battle resolver. No React.
src/game/data.ts       Content registries: TRAININGS, FORMS, BOSSES, LOCATIONS, QUESTS, PASSES, WISHES, fmt
src/game/store.tsx     GameProvider/useGame — localStorage persistence + slot switching + update()/train()
src/game/controls.ts   useBattleControls — keyboard map + held-charge lifecycle
src/game/arena.tsx     Canvas renderer + synthesized battle SFX. Never contains rules.
src/game/battleBus.ts  One-way God Engine → BattleTab command channel
src/game/ui.tsx        All tabs + AdminPanel + BattleTab glue
src/game/router.tsx    TanStack route tree generation
src/game/FormArt.tsx   Form portrait rendering (sprite images + SVG fallback)
```

## Completed (Phases 0–10 + post-audit + user feedback)

- [x] Phase 0 — Project understanding
- [x] Phase 1 — Engine foundations
- [x] Phase 2 — Progression overhaul
- [x] Phase 3 — Save & data integrity (versioned envelope, backup rotation, migration)
- [x] Phase 4 — Sagas, missions & exploration
- [x] Phase 5 — Skill-based combat & AI (phases, signatures, parry, grades, combos)
- [x] Phase 6 — Equipment, inventory & endgame (endless survival, raids)
- [x] Phase 7 — God Engine foundations (typed admin API, console, simulator)
- [x] Phase 8 — God Engine command center
- [x] Phase 9 — Visual & audio polish
- [x] Phase 10 — Final project audit
- [x] Post-audit — 11 fixes, docs, commit `f5c98b8`

### User feedback round 1 (commit `e22b983`)
- Power multiplier typeable input in creators
- Real anime-style SVG portraits (`FormArt.tsx`)
- Shop "Market — Gear & Supplies"
- Tournament rounds harder
- Endgame tab rebuilt

### User feedback round 2 (commits `0e23820`, `0b93e6c`, `59e0b26`)
- **Turbo Clicker** — single insane-speed auto-clicker (~100/s, batched), live `+X/s` meter + session total, stamina-aware, honest gain reporting
- **Gravity auto-adaptation** — manual training removed; gravity snaps to `maxGravityForLevel(level)` on level-up; `SET_GRAVITY` keeps override
- **Honest gain meter** — `store.train()` reports `effectiveTrainingGain` (soft-capped) so meter matches stat growth
- **FormArt portraits** — cropped transparent sprites from reference sheet (pixelated), SVG fallback for custom forms

### User feedback round 3 (commits `3421109`, `d964f22`, `ee2e5bb`, `1420556`, `72a5a11`, `0fee3ab`)
- **Shenron wish expansion** — 4 new wishes (Mastery, Gravity, Technique, Form), preview + history
- **Form mastery** — per-form XP/levels with +2% power per level (cap 10)
- **Prestige / New Game+** — reset for permanent bonuses (+10% training, +1 gravity, +10 stamina per prestige)
- **Combat weak points** — first exposed strike = 3× "WEAK POINT!" hit
- **Boss phases & signatures+** — 4th phase (≤10% HP), per-phase signature moves, enrage timer (+25% after 60s)
- **Ascension skill tree** — 8 nodes spendable with prestige points (training, stamina, gravity, form XP, zeni, clash, ki, ascendant)

## Current state

- Tests: 155 passing (9 files)
- `tsc --noEmit`: clean
- ESLint: 0 errors (13 pre-existing `react-refresh` warnings)
- Production build: OK
- Dev server: `npm run dev -- --port 3100 --strictPort`
- Working tree: clean (push-free local checkpoints only)

## Next steps (planned)

### High priority
- [ ] Boss Rush mode — fight all saga bosses back-to-back, escalating rewards
- [ ] Combat skill tree — spend TP on combat perks (crit, ki regen, guard window, clash power, vanish cooldown)
- [ ] Achievement system — badge/medal collection for milestones with small rewards

### Medium priority
- [ ] Save import (JSON) — import from file/paste; closes last save-integrity gap
- [ ] Location identity — distinct activities per location instead of pure multipliers
- [ ] Saga Story Mode — guided campaign with dialogue and cutscenes
- [ ] Boss AI patterns — distinct attack patterns, telegraphs, phase-specific behaviors

### Low priority / nice-to-have
- [ ] Weather & time of day — affects training multipliers and visuals
- [ ] Training minigames — rhythm/timing for bonus gains
- [ ] Companion system — pet with passive bonuses
- [ ] Seasonal events — limited-time challenges with exclusive rewards
- [ ] Async PvP (ghosts) — fight AI ghosts of saved builds
- [ ] World map exploration — node-based map replacing location dropdown
- [ ] Crafting system — combine materials into gear/consumables

## Open items

- Form portraits: sprites in place; true photo-realistic anime art still needs AI image credits (optional)
- `gold.png` and `ssj1-red.png` extras are unused — available for reassignment
- Prestige threshold (Lv 50) and ascension node costs are initial values — may need balance tuning
- Combat weak point multiplier (3×) and enrage timer (60s) are initial values — may need tuning

## Notes

- Lovable-connected: do not rewrite published git history (no force push, rebase, amend, squash of pushed commits).
- Node v24 at `C:\Program Files\nodejs`. PowerShell needs `Set-ExecutionPolicy -Scope Process Bypass -Force`.
- `vite preview` cannot serve this nitro build — use `npm run dev`.
- `routeTree.gen.ts` is generated — do not hand-edit.
