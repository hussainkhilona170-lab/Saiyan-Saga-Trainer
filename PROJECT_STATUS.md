# Dragon Ball RPG — PROJECT STATUS

**Last updated:** Phase 0 (project understanding) — handoff checkpoint
**Workspace:** `C:\Users\Administrator\Documents\Default Project\saiyan-training-simulator` (extracted from `Downloads/saiyan-training-simulator.zip`)
**Runtime note:** No system Node/npm/git. A portable Node 26.13.0 was extracted to `AppData\Local\Temp\opencode\node-v26.13.0-win-x64` and Git comes from GitHub Desktop (`resources/app/git/cmd/git.exe`). Prefix shell calls with
`$env:PATH = "C:\Users\Administrator\AppData\Local\Temp\opencode\node-v26.13.0-win-x64;$env:PATH"` (and `Set-ExecutionPolicy -Scope Process Bypass`) to run `npm`, `npx`, `node`.

---

## TL;DR — where the project actually stands

The codebase is **real and working**, not a mock-up. It builds clean, and all **23 existing unit tests pass**. It is, however, a *clicker/RPG prototype* — far from the vision in the master prompt. The God Engine already exists in **partial** form (a single `AdminPanel` with Player / Forms & Passes / Battle & Bosses / World & Quests / System tabs). Roughly **Phases 1–3 are done/substantially done**, and the remaining phases (4–10) are almost entirely **unimplemented**.

**Environment verification results (honest):**
- `npx vitest run` → **2 files, 23 passed**
- `npm run build` → **success** (client + ssr + nitro)
- `npx tsc --noEmit` → **success, no errors**
- ESLint → 444 errors, of which **440 are pre-existing Prettier-formatting diffs** (it appears Prettier was never enforced) and **4 real `no-empty` errors** in `store.tsx` (empty `catch {}` blocks, intentional save-error swallow). No mass-format was done — Prettier config is treated as advisory; existing style is preserved.
- `git init` + baseline checkpoint commit created (git is not on PATH; recovery works through the embedded GitHub Desktop git binary).

---

## Existing implemented features (verified by reading the code)

**Core/engine (`src/game/engine.ts`)** — pure functions, tested
- Stats: strength / agility / ki / defense; level 1–100 via quadratic XP curve `xpRequiredForLevel`
- Rank ladder (Novice → Fighter → Elite → Master → Ascendant → Divine → Legend)
- Stat soft caps `100 + (level-1)*40`, mastery 0–100% with mastery-based training multipliers
- Training actions cost stamina (1 normal / 2 gravity; god mode free), gravity levels after `gravity×25` reps, `gravMult = 1 + (gravity-1)*0.25`
- Power Level = `(STR+AGI+KI+DEF) × gravMult × formMult × 10`
- Location training multipliers (Roshi's Island ×1, Korin ×3, HTC ×10, King Kai ×40, Beerus ×150)
- 9 transformations (base → Ultra Instinct) + custom-form creator (cap 5000×), `canUnlockForm` gates (level/PL/zeni/UI pass)
- Boss roster (Raditz → Beerus) with HP/atk/PL gates; beam-clash system with agility-based pushes; saga-scaled clash pressure
- Shadow Self mirror sparring (1.75× scaled; Zenki low-HP bonus)
- Versioned save envelope (`sealSave`/`openSave`/`migrateSave`, `SAVE_VERSION=2`, legacy unversioned save support, backup rotation in the store)
- `applyShadowRewards`, `applyBattleRewards` (rolls supplied by caller)

**Persistence (`src/game/store.tsx`)**
- localStorage keys `db-training-sim-v1` (main) / `-sandbox` (sandbox clone); `-backup` rotation for the main slot
- `switchSlot` clones main → sandbox, preserves both separately; `update()` uses structuredClone
- Real-time stamina regen every 250 ms and an Auto-Train pass effect in `TICK`

**Combat arena (`src/game/arena.tsx`, `controls.ts`, `battleBus.ts`)**
- 1100×520 canvas, lava/volcano scene, anime speed lines, impact rings, screen shake, hit-stop
- Transformation hair/aura rendering; per-boss silhouettes (Frieza, Cell, Buu, Beerus, Raditz, Vegeta)
- Controls: J/Space/Left-click punch, K Ki-volley (20 ki), L Kamehameha (100 ki), Shift/Right-click Vanish (15 ki), hold C to charge, F not yet used
- Beam clash: tap/hold to push vs saga-scaled pressure; won/lost outcomes
- Web Audio synthesized SFX (punch/blast/charge/clash/win/lose/vanish/ultimate)
- God Engine can reach the live battle **only** via `battleBus.ts` commands (FORCE_WIN/FLEE/HEAL/SET_BOSS_HP/REFILL_KI/FORCE_CLASH/SPAWN_BOSS)

**UI (`src/game/ui.tsx` + `src/routes/*`)**
- Tabs: Train / Battle / Forms / Quests / Shop; profile header with PL, form, location; XP bar; stamina bar
- Quest system: 9 quests across Saiyan / Namek / Cell / Buu / Battle of Gods sagas (PL- and boss-gated; claim-once, ×2 payout prevention)
- Shop passes: 2× speed, Auto-Train, Instant Ki Charge, UI Master Pass, VIP — purchased with TP, persisted
- Dragon Ball collection + 3 wishes (zeni ×100-PL payout, stats ×2, +500 TP) — **incomplete vs. spec (see below)**
- God Engine admin panel (`Ctrl+Shift+A` or 5 clicks on title): Player Lab, Forms & Passes, Battle & Bosses, World & Quests, System (godMode, infiniteZeni, slot switch, JSON snapshot/restore/export/import, wipe) — **partial vs. spec (see below)**

## Partially implemented / known bugs

1. **Save format inconsistency.** `switchSlot` and the wipe path write `JSON.stringify(state)` (raw, unversioned) while the auto-save effect writes the versioned envelope via `sealSave`. `openSave` tolerates both, but exports (`exportSave`) also emit raw JSON. All writers should emit the versioned envelope.
2. **localStorage write storm.** The store writes on *every* state change, including the 250 ms TICK interval — 4+ serializations of the full save per second during normal play. Should be throttled/debounced.
3. **`infiniteZeni` victory hack.** `update()` hard-sets `s.zeni = 1e15` after any change while the flag is on (fights against the `Math.floor(+e.target.value || 0)` editing model and clobbers intentionally lowered values).
4. **No sandbox isolation guarantees in the spec sense** — sandbox exists and is used, but there are no snapshot schema versions, no event log, no snapshot list, and "Take snapshot" stores one opaque `JSON.stringify` in a React state (lost on close, no validation, no named snapshots).
5. **Quest/saga model is flat.** No quest graph/dependencies beyond a linear saga grouping, no objective progress tracking, no exploration/world-events, tournaments, or rivals. Dragon Balls come only from boss kills/rare train drops. Wishes are hard-coded (no stamina-cap wish, no reward-history log).
6. **Combat is a narrow slice.** No perfect-guard/parry (F), no weak points, no adaptive boss AI, no boss phases, no signature techniques, no combat grades, no combo branching, no endless survival/raids/challenge modifiers. Boss difficulty only scales as raw HP/ATK.
7. **Forms are multipliers only.** No form mastery, no form-specific combat behaviour, no upkeep/tradeoffs for high-tier forms.
8. **Locations are pure multipliers.** No distinct activities/challenges/identity; Korin×3 vs HTC×10 vs etc. is a ladder of nothing.
9. **God Engine is one modal with 5 tabs.** Spec requires a full command center: GOD/SANDBOX/REALITY modes (partially present), overview/system-health, command console with autocomplete+history, live state inspector, technique creator (custom techniques on the real combat pipeline), transformation creator (exists but no lock/unlock-all, no editing of built-in defs), scenario creator, automated battle tester, event log, snapshot manager with schema versions, import/export validation, destructive-action confirms, extreme-number guards. Only a subset is present.
10. **Economy has no transaction history** anywhere (bounties, purchases, wishes).
11. **ESLint hygiene**: 4 `no-empty` errors in `store.tsx` (swallowed `catch {}` — intentional but should be commented/typed), Prettier not enforced (440 formatting-only diffs). Not doing a big-bang reformat on a live Lovable-synced codebase.
12. **Train cadence fall-through**: `TRAIN_STAT` + `rand` undefined uses `Math.random()`; fine. `CLAIM_QUEST`/`FORCE_CLAIM_QUEST` share `payQuest`; good.
13. **`switchSlot` from main→sandbox** writes Main with raw JSON (works via legacy path) and a fresh sandbox starts as a clone — correct behaviour, wrong encoding (see #1).

## Missing features (vs. master prompt)
Training: mastery breakthroughs, streaks, milestones, advanced challenges, specialization builds (STR/AGI/KI/DEF identities affecting combat).
Progression: specialization influence, level-up milestone rewards, form mastery, gravity adaptation perks.
World: exploration/search activities, Dragon Ball clues, tournaments (World Martial Arts), recurring rival, world events, per-location challenges/identity.
Combat: F perfect-guard/parry, E/dodge windows and directional movement, combo branching, weak points, adaptive AI, boss phases with behaviour changes, signature techniques (Final Flash / Death Beam etc.), Ki Overload risk/reward, combat grades, boss rematches with anti-farm guard.
Endgame: Endless Survival, raid bosses, technique mastery, challenge modifiers, advanced transformation trials.
God Engine: see partial list above (console, inspector, creators, scenarios, tester, event log, snapshot versioning, sandbox hardening).
Systems: transaction history, equipment/inventory (Senzu Beans, Turtle Shell, Potara), consumables, saga-reward hooks, Shenron wish expansion + wish preview/history.
QA: 23 tests exist and pass; need coverage for persistence round-trips, migrations, command parser, snapshots, sandbox isolation, combat geometry, watch dog on extremes.

## Important dependencies
React 19 · TanStack Start v1.168 / Router 1.170 · Vite 8.1.5 · TS 5.8 strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) · Tailwind v4 (@tailwindcss/vite) · vitest 4.1 · jsdom · @testing-library/react · zod · Web Audio (synthesized, no assets) · HTML5 Canvas. **No state library** — custom `GameContext` + `applyAction` reducer. Lovable-connected (see `AGENTS.md`: do not rewrite published git history; push-free local checkpoints only).

## Architecture (as found)
```
src/game/engine.ts     Pure rules: applyAction(d, a), hydrate(), save envelope, battle resolver. No React.
src/game/data.ts       Content registries: TRAININGS, FORMS, BOSSES, LOCATIONS, QUESTS, PASSES, WISHES, fmt
src/game/store.tsx     GameProvider/useGame — localStorage persistence + slot switching + update()/train() helpers
src/game/controls.ts   useBattleControls — keyboard map + held-charge lifecycle (input-focus guard)
src/game/arena.tsx     Canvas renderer + synthesized battle SFX. Never contains rules.
src/game/battleBus.ts  One-way God Engine → BattleTab command channel
src/game/ui.tsx        All tabs + AdminPanel + BattleTab glue (heaviest file, ~770 lines)
src/game/router.tsx    TanStack route tree generation (routeTree.gen.ts is generated — do not hand-edit)
src/test/engine.test.ts (+ app-routing.test.tsx) — 23 passing tests
```

## Current architecture verdict & first incomplete phase

**Verdict:** Engine-first design is sound and should be preserved. The gaps are (a) half-finished save/sandbox integrity, (b) no RPG/world layer, (c) no combat depth, (d) God Engine ~40% of spec.

**First genuinely incomplete phase: Phase 3 — Save & Data Integrity** (versioned envelope exists but the writer paths are inconsistent, there is no backup recovery UX, no sandbox hardening, no transaction history foundation, and no migration test coverage). Phases 1–2 are effectively complete and stay untouched except where a real bug is found.

## Phases
- [x] Phase 0 — Project understanding (this document)
- [ ] Phase 1 — Engine foundations (verified OK; only save-writer fixes)
- [x] Phase 2 — Progression overhaul (done to spec; preserve)
- [ ] Phase 3 — Save & data integrity  ← **FIRST (this session starts here)**
- [ ] Phase 4 — Sagas, missions & exploration
- [ ] Phase 5 — Skill-based combat & AI
- [ ] Phase 6 — Equipment, inventory & endgame
- [ ] Phase 7 — God Engine foundations (full)
- [ ] Phase 8 — God Engine interface & command center
- [ ] Phase 9 — Visual & audio polish
- [ ] Phase 10 — Final project audit

## Recoverable checkpoints
1. **Baseline**: project as-extracted (git tag `baseline`), 23 tests pass, build OK.
