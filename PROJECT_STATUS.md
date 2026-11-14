# Dragon Ball RPG — PROJECT STATUS

**Last updated:** 2026-11-14 — post-phase-10 audit + user feedback round 2 (Turbo Clicker, automatic gravity)
**Workspace:** `C:\Users\Administrator\Documents\GitHub\Saiyan-Saga-Trainer` (git repo, Lovable-connected — see `AGENTS.md`: do not rewrite published history)
**Runtime note:** Node v24 is installed at `C:\Program Files\nodejs`. On Windows PowerShell, prefix calls with `Set-ExecutionPolicy -Scope Process Bypass -Force` and invoke `& "C:\Program Files\nodejs\npm.cmd" ...` (npm.ps1 is blocked by default policy).

---

## TL;DR — where the project actually stands

The codebase is **real and working**, not a mock-up. It builds clean, and all **23 existing unit tests pass**. It is, however, a *clicker/RPG prototype* — far from the vision in the master prompt. The God Engine already exists in **partial** form (a single `AdminPanel` with Player / Forms & Passes / Battle & Bosses / World & Quests / System tabs). Roughly **Phases 1–3 are done/substantially done**, and the remaining phases (4–10) are almost entirely **unimplemented**.

**Environment verification results (honest):**
- `npx vitest run` → **3 files, 46 passed** (23 pre-existing + 23 new save-integrity tests)
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
- Training actions cost stamina (1 normal; god mode free), `gravMult = 1 + (gravity-1)*0.25`. Applied per-click gain = raw multipliers × mastery bonus ÷ (1 + stat/statSoftCap(level)) — a deliberate soft cap. Gravity is fully automatic: `maxGravityForLevel = 1 + floor(level/2)` (one 10G step per 2 levels, Lv 100 → 510G), applied on every level-up — no manual gravity training; God Engine `SET_GRAVITY` overrides directly and is never lowered by level-ups
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

1. ~~Save format inconsistency~~ **fixed in Phase 3** — all writers emit the versioned envelope; exports are versioned JSON; import validates and reports.
2. ~~localStorage write storm~~ **fixed in Phase 3** — 750 ms throttle + page-unload flush.
3. ~~`infiniteZeni` clobber~~ **fixed in Phase 3** — override now gates only the form-unlock cost.
4. **No sandbox isolation guarantees in the spec sense** — sandbox slot exists and works, but there is no snapshot schema-versioned UI list, event log, or named snapshot manager yet (primitives shipped in `snapshots.ts`; UI in Phases 7–8).
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
- [x] Phase 1 — Engine foundations (verified OK; save-writer integrity fixed here)
- [x] Phase 2 — Progression overhaul (done to spec; preserved)
- [x] Phase 3 — Save & data integrity (checkpoint `phase-3`)
- [x] Phase 4 — Sagas, missions & exploration (checkpoint `phase-4`)
- [x] Phase 5 — Skill-based combat & AI (checkpoint `phase-5`)
- [x] Phase 6 — Equipment, inventory & endgame (checkpoint `phase-6`)
- [x] Phase 7 — God Engine foundations (full) (checkpoint `phase-7`)
- [x] Phase 8 — GOD ENGINE interface & command center (checkpoint `phase-8`)
- [x] Phase 9 — Visual & audio polish (checkpoint `phase-9`)
- [x] Phase 10 — Final project audit (checkpoint `phase-10`, see AUDIT.md)
- [x] Post-audit — user-feedback round (commit `e22b983`) + 2026-11-14 audit (see AUDIT.md)

### Post-phase-10 audit — 2026-11-14 (full detail in `AUDIT.md`)
- **Real bugs found and fixed:** custom techniques double-dipped EXPOSED (×4); variant boss ids (`endless-N` / `tournament-r*` / `raid-*`) all resolved to saga rank 0 (trivial clash pressure, wrong delays); God-Engine "Restore from backup" fed the versioned envelope into `hydrate()` and wiped the save to defaults; battle HUD used live max HP instead of the battle-start snapshot; parry mastery farmed from refused guards.
- **Accuracy/hygiene:** battle simulator now matches live combat math (form × gravity HP, real clash pressure); 6 `no-case-declarations` fixed by bracing BLAST/ULTIMATE/VANISH; extreme-number clamps on TICK/training/XP/shadow-reward writes; `FormArt` unique SVG ids per instance; **impure state updaters fixed** (God Engine toast/console output ran setState inside the `update()` updater — React renders updaters during the render phase; now previewed on a throwaway clone and dispatched pure); stale "phase 8" build text updated.
- **Verified:** 155 tests pass (9 files), `tsc --noEmit` clean, production build OK, ESLint 0 errors (13 pre-existing `react-refresh` warnings), live browser: all 8 tabs + full God Engine with 0 console errors/warnings, Lighthouse 1.00/1.00/1.00.
- **Honest note:** there is **no save-import UI** — Settings & Recovery offers export + backup restore only (console/scenario import paths exist separately).

### User feedback round 2 — 2026-11-14: Turbo Clicker + automatic gravity + honest gain meter
- **Turbo Clicker** (Train tab card): single insane-speed auto-clicker — one START/STOP button clicking at ~1000/s (1ms buffer; the browser clamps setInterval to ~4ms, so effectively ~250/s). Stat picker (STR/AGI/KI/DEF) retained; speed picker and FAST/TURBO presets removed. Clicks are batched 50-at-a-time into a single state update so the UI keeps painting at high speed. Live "+X/s" meter accumulates gains over a 1-second window (per-click gains can be sub-1) plus a session total; stamina-aware — engine no-ops are not counted; tick sound throttled to ≥200 ms; session-only state that stops when you leave the tab. Pure UI dispatcher — no engine change.
- **Gravity rework** (user: "no training for gravity, bump it higher as the level increases"): manual gravity training removed entirely. `TRAIN_GRAVITY`, `trainGravity` and the `gravityProgress` field are gone; `grantExperience` snaps `gravity = max(gravity, maxGravityForLevel(nextLevel))` on every level-up. Saves lagging the curve catch up on their next level-up; a higher gravity (God Engine `SET_GRAVITY` override) is never lowered. Train tab shows a passive Gravity Chamber card with the next-step hint. Verified live: Lv 25 → 130G, Lv 33 → 170G — exactly on the curve.
- **Honest gain reporting fix** (user: meter showed "+1.00M /s" but stats barely moved): `store.train()` returned the RAW `trainingGain` multiplier product while the engine applies the soft-capped `effectiveTrainingGain` (×(1 + mastery/200) ÷ (1 + stat/cap)) — a ~÷230 discrepancy at high stats. `train()` now returns the applied gain, so the Turbo meter and click floaters match the stat growth the player observes. The soft cap itself is intentional (progression brake; mastery and level-ups raise the yield).
- **Verified:** 155 tests pass, `tsc --noEmit` clean, ESLint 0 errors, production build OK, live browser console clean after a full reload.

### Phase 3 — completed work (checkpoint `phase-3`)
- All save writes go through the versioned envelope (`encodeSlot`/`sealSave`); sandbox clones, slot switching, export and snapshots included.
- localStorage write throttle (750 ms, trailing-edge) + `pagehide`/`beforeunload` flush — the 250 ms TICK no longer rewrites the save 4×/second.
- Backup rotation + corruption fallback wired into `resolveInitialLoad`; header shows a recovery banner when a backup is loaded; God Engine surfaces a rejected-import message instead of silent no-ops.
- Persisted values hardened: `hydrate()` clamps every currency/gravity/stamina/XP bound, dedupes forms/passes/defeated/quests, drops malformed transaction rows, caps the ledger at 200 entries.
- `infiniteZeni` no longer clobbers the wallet to 1e15; `canUnlockForm`/`UNLOCK_FORM` honor the override instead.
- `POWER LEVEL` saturates to `MAX_SAVE_NUMBER` instead of overflowing to `Infinity`.
- **New `transactions` ledger** (credit/debit, currency, amount, label, balance) — filled by boss victories, quest payouts, form unlocks, wishes and pass purchases; shown in a new Shop → Transaction History panel.
- Passes re-priced to the master table (25/50/75/150/200 TP).
- Shenron wishes now applied by the engine action `MAKE_WISH` (race-proof, validates 7 balls, pays once); added the 4th wish **Endless stamina** (+50 max stamina via persisted `maxStaminaBonus`), buy/sell passes via `BUY_PASS`.
- New `src/game/persistence.ts` (slot keys, backup fallback, pretty export) and `src/game/snapshots.ts` (schema-versioned named snapshots — foundation for the God Engine snapshot manager).
- Known honest limitation: sandbox remains a *separate save slot* (by design), not an isolated sandbox runtime; snapshot list UI arrives in Phase 7/8.

## Recoverable checkpoints
1. **Baseline**: project as-extracted (tag `baseline`), 23 tests pass, build OK.
2. **phase-3**: save integrity overhaul (tag `phase-3`), 46 tests pass, build OK.
3. **phase-4**: quest v2 + scout + tournament (tag `phase-4`), 65 tests pass, build OK.
4. **phase-5**: skill-based combat depth (tag `phase-5`), 87 tests pass, build OK.
5. **phase-6**: equipment, technique mastery, endless survival, raid bosses (tag `phase-6`), 110 tests pass, build OK.
6. **phase-7**: God Engine foundations — typed admin API, console parser, simulator, infinite Ki, custom techniques (tag `phase-7`), 139 tests pass, build OK.
7. **phase-8**: GOD ENGINE command center (tag `phase-8`), 150 tests pass, build OK.
8. **phase-9**: visual & audio polish (tag `phase-9`), 150 tests pass, build OK.
9. **phase-10**: final project audit (tag `phase-10`), see AUDIT.md — 150 tests pass, 0 console errors across all tabs.

### Post-audit verification (checkpoint `phase-10-verified`)
- Lighthouse 1.00 / 1.00 / 1.00 (a11y fixed: sequential h2 headings, `<main>` landmark)
- Performance trace during live combat: ~88 fps, one 96 ms long task (battle mount), no layout thrash, no GC pressure
- Balance probe `balance-audit.test.ts` (trainee beats Raditz; mid-game beats Frieza; endgame beats Beerus) — 154 tests pass

### Phase 10 — audit summary (checkpoint `phase-10`, full detail in `AUDIT.md`)
- Dead code eliminated (`questProgressFraction`, unused locals/imports); silent catches commented; toast timer cleanup on unmount; ESLint clean on touched modules.
- All 10 phases verified: 150 tests, production build OK, 8-tab browser pass with zero console errors, save-integrity and sandbox isolation confirmed.
- Honest limitations documented in §7 (re-fight farming, grade pooling for variant ids, prettier backlog, no human weeks-long playtest yet).
- The game is feature-complete per the master roadmap: training → sagas → combat depth → equipment/endgame → God Engine → command center → polish → audit.

### Phase 9 — completed work (checkpoint `phase-9`)
- **CSS system** (`styles.css`): unified transitions on all interactive elements, `:focus-visible` rings everywhere, custom selection color, thin themed scrollbars, `.card-hover` lift (boss cards, form cards), `.tab-active` glow, `.bar-animated` sheen on stat bars, `prefers-reduced-motion` respected, touch-action none on the arena, number-input spinners hidden.
- **Audio** (`arena.tsx`): pitch jitter on hit sounds (±10–20%), plus four new synthesized SFX — `transform` (power-up sweep, wired to Forms transform), `levelup` (quest claim + saga claim + Shenron wish), `tick` (training click), `parry` (reserved). Martial-arts feedback loop now covers training → battle → reward.
- **Tabs** marked `aria-pressed` for screen readers.
- Verified in-browser: 0 console errors on full reload; arena untouched.

### Phase 8 — completed work (checkpoint `phase-8`)
- **Full command center** in `src/game/godEngine.tsx` (replacing the old 5-tab AdminPanel): Overview · Player Lab · Transformation Lab (form comparison + custom creator + force lock/unlock) · Battle Control (roster/custom boss spawn + live battle overrides incl. new 1%/50% HP and refill) · Enemy & Boss Lab (endless waves with modifiers, raids, tournament rounds, defeat flags) · Progression (power-level scaling, Dragon Balls, Survival best) · Quest & Saga control · World (gated-bypass teleport) · **Technique Creator** (real custom techniques on the combat pipeline, with estimated damage preview) · **Scenario Creator** (capture/apply/duplicate/import/export build+boss configurations, custom forms carried inline) · **Command Console** (parser-backed, autocomplete, history, confirm-gated destructive commands, persistent output) · **Live State Inspector** (full sheet + clipboard export, save size, battle-bus status, form ownership) · **Snapshots** (schema-versioned named create/restore/delete, capped 50) · **Automated Battle Tester** (deterministic simulation with God-Build comparison) · **Event Log** (filterable, clearable) · **Settings & Recovery** (slot switching, backup restore, exports, wipe with confirmation).
- Custom techniques now castable in battle via a new "Custom" row under the action bar (cooldown-aware).
- `bossLibrary.ts` + `scenarios.ts` — testable boss-id resolution (roster/endless/raid/tournament) and schema-validated scenario persistence; harness covers capture/apply/duplicate/import/export/foreign-save re-registration of custom forms.
- Direct UI mutations now audit into the admin event log (`recordAdminEvent` wired into technique/form creation+deletion).
- Hydration clamps + canonical save paths preserved; 150 tests pass (8 new in `god-engine-ui.test.ts`).
- Verified in-browser end-to-end: console `player.inspect` executed; snapshot created; battle tester returned WIN/S-grade; custom technique created, persisted, cast-ready in battle HUD; God Engine opens via Ctrl+Shift+A and title-taps.

### Phase 7 — completed work (checkpoint `phase-7`)
- **Typed admin API** (`src/game/admin.ts`): every privileged operation funnels through `executeAdminAction` — SET/ADD stats, mastery, level/XP (cross-synced), Zeni/TP/Stamina/Gravity/Dragon Balls, form lock/unlock (admin-force), quest force-complete/reset (never refunds), god-mode / infinite-ki / infinite-zeni overrides, TELEPORT validation, Endless best, spawn routing. All writes clamped to extreme-number bounds; every action logged to a new persisted **admin event log** (`adminEvents`, capped 100) with previous/new values, actor outcome and detail; destructive verbs (unlock-all/lock-all/quest-reset/complete) flagged `confirmRequired`.
- **Command console core** (`src/game/adminConsole.ts`): parser maps text → real `AdminAction`s; strict validation (NaN, negatives, wrong stats, unknown ids rejected); `help` lists every registered command; `consoleSuggestions()` powers autocomplete; zero `eval` anywhere.
- **Deterministic battle simulator** (`src/game/battleSim.ts`) for the Automated Battle Tester — clones state, seeded rotation, returns result/grade/phase reached/damage totals; documented as a simulation, not a live canvas fight.
- **Infinite Ki override** wired into the real combat pipeline (BLAST/ULTIMATE/VANISH/CUSTOM_TECHNIQUE all honor it).
- **Custom techniques on the real pipeline**: new `CustomTechnique` model (ki/strength/agility/defense scaling, mult, kiCost, cooldown, aura) with strict hydrate sanitizers; battle-side `CUSTOM_TECHNIQUE` action deals real damage through the damage-boss path, respects cooldowns (BattleState.cooldowns), Ki costs, EXPOSED doubling and infinite-Ki.
- Hydration clamps: custom techniques (20 max, id prefix, mult ≤ 50, cooldown ≤ 15 s, scale whitelist), admin events (junk dropped, cap 100), infiniteKi flag.
- **Not yet done (Phase 8)**: the full command-center UI — this phase ships only the verified backend. The legacy 5-tab admin modal is untouched and still fully functional.
- 29 new tests in `god-engine.test.ts`; 139 total pass.

### Phase 6 — completed work (checkpoint `phase-6`)
- **Inventory & equipment**: new `EQUIPMENT` (Turtle Shell +25% DEF, Weighted Gloves +20% training, Dragon Radar +5% scout finds, Potara +10% power) and `CONSUMABLES` (Senzu Bean full HP, Energy Tonic full Ki) registries; bought with Zeni (Potara unique), one item per slot, bag ↔ loadout with full persistence (`inventory`, `equipped`), equipment feeds `powerLevel`, `trainingGain`, scout rates and effective Defense in combat.
- **Technique Mastery**: per-technique use counters (`techniqueUses`) with 5 ranks each (5 / 15 / 35 / 70 / 130 uses); concrete tactical perks — melee combo window 950→1050 ms and chain 8→10 at rank 4, Heavy finisher 1.5→1.75×, Ki Blast cost 20→15, Kamehameha overload 3 s→1.5 s, Vanish cost 15→12, Charge +25%, Perfect Guard CD 1.1→0.8 s (window 450→550 ms at rank 3). Ranks shown in the battle HUD and in Inventory.
- **Endless Survival**: rotating-roster waves with +60% HP / +45% ATK per wave scaling, optional **challenge modifiers** (Aggravated Foes ×1.5 ATK / Ironclad ×1.5 HP, both ×2 rewards), reward curve, `survivalBest` persisted; waves and modifiers selectable in the new **Endgame** tab.
- **Raid Bosses**: Broly and Super Janemba — huge scaling stat fights with signatures, first-clear full payout + a guaranteed Dragon Ball, rematches 15% (anti-farm), full rewards first time, 15% after, tracked via defeated flags.
- All new paths covered by `endgame.test.ts` (23 new tests; 110 total).
- UI: new **Inventory** (shop / loadout / consumables / technique mastery) and **Endgame** (survival + raids) tabs — arena battle route reused.

## How to test each checkpoint (Windows, this machine)
From `C:\Users\Administrator\Documents\GitHub\Saiyan-Saga-Trainer`:
```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
& "C:\Program Files\nodejs\npm.cmd" run dev   # dev server with HMR (what you want for testing)
```
Tests: `npx vitest run` · Types: `npx tsc --noEmit` · Build: `npm run build` · Checkout a checkpoint: `git checkout <tag>` (`baseline`, `phase-3`, …, `phase-10`).

### Bug fixes made outside a phase
- **God Engine 5-rapid-click access was unreachable** (all taps batched into one render) — fixed with a ref-based tap counter + 1.5 s window; verified in-browser.
- `vite preview` cannot serve this nitro build (`dist/server/server.js` doesn't exist) — use `npm run dev -- --port 3100 --strictPort` instead. A portable Node runtime is bundled inside the project at `.tools/node/` (gitignored) for machines without a global install.
- **User feedback round (in-game annotations)**: (1) power multiplier is now a typeable number input in all three creators; (2) forms render real anime-style SVG portraits (`FormArt.tsx`) in the header arena preview, Forms grid, Transformation Lab list and custom-form preview — per-form hair silhouettes, auras and eyes; not colored dots; (3) Shop gained "Market — Gear & Supplies" with every purchasable item (equipment + consumables); (4) Tournament rounds are harder (~+10–20% HP/ATK; copy telegraphs it); (5) Endgame tab fully rebuilt — hero banner, challenge-modifier cards, wave presets + slider, raid cards with stat panels.

**Phase 5 smoke-test plan**: Battle tab → Fight Raditz. H = Heavy Strike, F = Perfect Guard (parry an enemy tick → "PARRY!" message + boss exposed 2.5 s). Drop Raditz below 66% → EXPOSED banner + ×2 damage; below 33% → Critical. Phase 2+ boss casts its signature (watch the bar under the boss HP). Win with high HP → S/A grade on the boss card. Rematches pay tournament rewards only 15% after your first clear.

### Phase 5 — completed work (checkpoint `phase-5`)
- **Boss phases** (`battlePhaseOf` / `phaseNumber 1|2|3`, derived from remaining HP): below 66% → Enraged (+35% ATK), below/at 33% → Critical (+70% ATK). Crossing a phase drops the boss into a **5 s EXPOSED weak point** (player damage ×2) and telegraphs the signature 2 s out; phase banner shown in battle UI.
- **Signature moves** on every boss (Double Sunday → Hakai, ×2.1–3.0 ATK), phase 2+ only, 6 s cooldown, shown under the boss HP bar.
- **Perfect Guard / F** (`PERFECT_GUARD`): 450 ms parry window (750 ms and shorter cooldown in Ultra Instinct), 1.1 s cooldown; parry nullifies the tick and exposes the boss 2.5 s. Guard button + phase/exposed banner in UI.
- **Combo branches**: `H` Heavy Strike (finisher bonus at 4+ combo), `K` Ki-assisted combo bonus (≥3 combo), `L` Final Stretch bonus (≥5) with a 3 s vulnerability tradeoff (Ki Overload), `Shift` Vanish Punish (≥4 combo), melee-rush adaptation counter and Ki-spam adaptation read after repeated use.
- **Combat grades S/A/B/C/D** from remaining HP at victory; best grade per boss persisted (`bestGrades`, hydrated/deduped) and shown on boss cards and in the victory message.
- Battle rules stay pure (`resolveBattleAction`); all buttons wired; arena untouched.
- **Honest limits**: phases/signatures/parry windows are time-based via caller-supplied `Date.now()` (deterministic in tests); grade is stored against the boss id (tournament copies pool grades under `tournament-*` ids, by design).

### Phase 4 — completed work (checkpoint `phase-4`)
- **Quest system rebuilt to v2** (`QUESTS` typed `pl|boss|level|train|explore|collect|wish|tournament` + `prereq` chains, `count` targets). Displayed with per-saga grouping, progress bars, prereq locks, claim-once integrity; `questSummary`/`questProgressFraction`/`sagaStatus` exported for UI.
- **15 quests across the 5 sagas** (9 original ids preserved, rewards preserved; 6 new counted objectives).
- **Saga completion bonuses** via `CLAIM_SAGA` — all quests of a saga claimed → one-time Zeni/TP bonus, logged and persisted (`sagaBonuses`).
- **Scout exploration** (`SCOUT`): 2 stamina, location-scaled XP + Zeni caches (rare) + Dragon Ball finds (5%) — quest-fed.
- **Dragon Ball sources expanded**: boss drops, scout caches, wish quests — collection now gameplay-driven; wishes use `MAKE_WISH` (see Phase 3).
- **World Martial Arts Tournament**: 4 rounds (Opening/Quarterfinal/Semifinal/Grand Final), multiplier-scaled champions built on the real boss registry, first-clear full rewards, 15% rematch rewards (anti-farm), champion title at crown, persisted `tournamentRound`.
- Save schema: `questProgress` (counted courses only, unknown ids dropped), `sagaBonuses`, `tournamentRound` — all clamped/deduped on hydrate.
