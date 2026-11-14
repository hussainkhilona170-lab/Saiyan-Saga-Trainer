# Dragon Ball RPG — Development Plan

**Version:** PRE ALPHA 0.1
**Last updated:** 2026-11-14
**Branch:** main (Lovable-connected — do not rewrite published history)

> This is the living plan document. It must be updated on every commit: completed
> features, in-progress work, upcoming features, bugs, open items, and all
> project instructions/conventions.

---

## 1. Project overview

A Dragon Ball clicker/RPG: train stats, unlock transformations, fight saga bosses,
collect Dragon Balls, make wishes, and grow from a Saiyan rookie to a legend.
Engine-first architecture (pure rules in `engine.ts`, React store only dispatches).

- **Runtime:** Node v24, Vite 8, React 19, TanStack Start/Router, Tailwind v4
- **State:** custom `GameContext` + `applyAction` reducer (no state library)
- **Persistence:** localStorage (main/sandbox/backup), versioned save envelope
- **Combat:** HTML5 Canvas arena + Web Audio SFX
- **Admin:** God Engine command center (Ctrl+Shift+A or 5 rapid title clicks)

## 2. Architecture

```
src/game/engine.ts     Pure rules: applyAction, hydrate, save envelope, battle resolver. No React.
src/game/data.ts       Content registries: TRAININGS, FORMS, BOSSES, LOCATIONS, QUESTS, PASSES, WISHES, fmt
src/game/store.tsx     GameProvider/useGame — localStorage persistence + slot switching + update()/train()
src/game/controls.ts   useBattleControls — keyboard map + held-charge lifecycle
src/game/arena.tsx     Canvas renderer + synthesized battle SFX. Never contains rules.
src/game/battleBus.ts  One-way God Engine → BattleTab command channel
src/game/ui.tsx        All tabs + AdminPanel + BattleTab glue
src/game/router.tsx    TanStack route tree generation (routeTree.gen.ts is generated — do not hand-edit)
src/game/FormArt.tsx   Form portrait rendering (sprite images + SVG fallback)
```

**Rules:**
- Game rules and state transitions live in `src/game/engine.ts` as pure functions (`applyAction`, `hydrate`). React store only dispatches — keeps rules testable and saves backward-compatible.
- Animated combat presentation, battle-specific visuals, and combat sound helpers live in a dedicated game arena module so battle mechanics remain isolated from general game UI.
- The God Engine admin panel reaches the live battle only through `src/game/battleBus.ts` (`sendBattleCommand`); `BattleTab` owns `BattleState` and applies commands — never edit battle state from the panel directly.

## 3. Tech stack

- React 19 · TanStack Start v1.168 / Router 1.170 · Vite 8.1.5 · TS 5.8 strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`)
- Tailwind v4 (@tailwindcss/vite) · vitest 4.1 · jsdom · @testing-library/react · zod
- Web Audio (synthesized, no assets) · HTML5 Canvas
- Lovable-connected (see AGENTS.md: do not rewrite published history; push-free local checkpoints only)

## 4. Completed features

### Phases 0–10 (all complete)
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

### Post-audit fixes (commit `f5c98b8`)
- Custom techniques double-dipped EXPOSED (×4)
- Variant boss ids (endless-N / tournament-r* / raid-*) resolved to saga rank 0
- God-Engine "Restore from backup" fed versioned envelope into `hydrate()` and wiped save
- Battle HUD used live max HP instead of battle-start snapshot
- Parry mastery farmed from refused guards
- Impure state updaters fixed (God Engine toast/console)
- Extreme-number clamps, FormArt unique SVG ids, stale build text updated

### User feedback round 1 (commit `e22b983`)
- Power multiplier typeable input in creators
- Real anime-style SVG portraits (`FormArt.tsx`)
- Shop "Market — Gear & Supplies"
- Tournament rounds harder
- Endgame tab rebuilt

### User feedback round 2 (commits `0e23820`, `0b93e6c`, `59e0b26`)
- **Turbo Clicker** — single auto-clicker (~100/s, batched), live `+X/s` meter + session total, stamina-aware, honest gain reporting
- **Gravity auto-adaptation** — manual training removed; gravity snaps to `maxGravityForLevel(level)` on level-up; `SET_GRAVITY` keeps override
- **Honest gain meter** — `store.train()` reports `effectiveTrainingGain` (soft-capped) so meter matches stat growth
- **FormArt portraits** — cropped transparent sprites from reference sheet (pixelated), SVG fallback for custom forms

### User feedback round 3 (commits `3421109`, `d964f22`, `ee2e5bb`, `1420556`, `72a5a11`, `0fee3ab`, `59e0b26`)
- **Shenron wish expansion** — 4 new wishes (Mastery, Gravity, Technique, Form), preview + history
- **Form mastery** — per-form XP/levels with +2% power per level (cap 10)
- **Prestige / New Game+** — reset for permanent bonuses (+10% training, +1 gravity, +10 stamina per prestige)
- **Combat weak points** — first exposed strike = 3× "WEAK POINT!" hit
- **Boss phases & signatures+** — 4th phase (≤10% HP), per-phase signature moves, enrage timer (+25% after 60s)
- **Ascension skill tree** — 8 nodes spendable with prestige points

## 5. In-progress / upcoming features

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

## 6. Open items / bugs

- Form portraits: sprites in place; true photo-realistic anime art still needs AI image credits (optional)
- `gold.png` and `ssj1-red.png` extras are unused — available for reassignment
- Prestige threshold (Lv 50) and ascension node costs are initial values — may need balance tuning
- Combat weak point multiplier (3×) and enrage timer (60s) are initial values — may need tuning
- No save-import UI yet (export + backup restore exist)

## 7. Instructions & conventions

### From AGENTS.md (Lovable)
- This project is connected to Lovable. Avoid rewriting published git history — force pushing, or rebasing/amending/squashing commits that are already pushed.
- Commits pushed to the connected branch sync back to Lovable and show up in the editor — keep the branch in a working state.
- Push-free local checkpoints only.

### Coding conventions
- Game rules and state transitions live in `src/game/engine.ts` as pure functions (`applyAction`, `hydrate`). React store only dispatches.
- Animated combat presentation, battle-specific visuals, and combat sound helpers live in a dedicated game arena module.
- The God Engine admin panel reaches the live battle only through `src/game/battleBus.ts` (`sendBattleCommand`); `BattleTab` owns `BattleState` and applies commands — never edit battle state from the panel directly.
- `routeTree.gen.ts` is generated — do not hand-edit.
- Keep animated combat presentation, battle-specific visuals, and combat sound helpers in a dedicated game arena module so battle mechanics remain isolated from the general game UI.

### Build / test commands (Windows)
```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
& "C:\Program Files\nodejs\npm.cmd" run dev -- --port 3100 --strictPort   # dev server
& "C:\Program Files\nodejs\npm.cmd" test                                   # vitest
& "C:\Program Files\nodejs\npx.cmd" tsc --noEmit                           # type check
& "C:\Program Files\nodejs\npm.cmd" run build                              # production build
```
- `vite preview` cannot serve this nitro build — use `npm run dev`.
- Node v24 at `C:\Program Files\nodejs`.

### Plan document rule
- **Every commit must update this PLAN.md**: completed features, in-progress work, upcoming features, bugs, open items, and instructions. Keep it current.

## 8. Recoverable checkpoints

- `baseline` — project as-extracted, 23 tests
- `phase-3` … `phase-10` — phase checkpoints
- `f5c98b8` — post-phase-10 audit
- `e22b983` — user feedback round 1
- `0e23820` — Turbo Clicker + gravity + honest meter
- `0b93e6c` — detailed SVG form portraits
- `59e0b26` — reference sprite portraits + turbo 100/s
- `3421109` — Shenron wish expansion
- `d964f22` — form mastery
- `ee2e5bb` — Prestige / New Game+
- `1420556` — combat weak points
- `72a5a11` — boss phases & signatures+
- `0fee3ab` — ascension skill tree
- `5f7a822` — PRE ALPHA 0.1 (plan + battleSim fix)
- `59e0b26` — reference sprites + turbo 100/s

## 9. Test counts

- Engine tests: 22
- Total: 155 (9 files)
- All passing as of last commit
