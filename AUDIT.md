# PROJECT DRAGON BALL RPG — FINAL PROJECT AUDIT
**Date:** 2026-11-07 · **Checkpoint:** `phase-10` · **Tests:** 8 files / 150 passed · **Build:** OK (client + SSR + Nitro) · **Console:** 8 tabs, 0 errors

This audit covers Phases 0–10 of the master plan and records what was verified, what was fixed during the audit, and what is honestly not finished or not verifiable in this environment.

---

## 1. Architecture review

| Concern | Status | Notes |
|---|---|---|
| Engine is React-free pure rules (`applyAction`, `resolveBattleAction`, `hydrate`) | ✅ Pass | No React/DOM imports in engine.ts, persisted across 10 phases. |
| State transitions through controlled actions | ✅ Pass | All gameplay flows use `applyAction` / `resolveBattleAction` / `executeAdminAction`; UI never pokes drafts directly (a few documented exceptions: `TRANSFORM`, `CREATE_FORM` via panel console path still go through validators). |
| Save hydration clamps every persisted field | ✅ Pass | `hydrate()` dedupes, clamps (NaN/∞→defaults), verifies registry ids, caps logs; 40+ assertions across 6 test files. |
| Dead code | ✅ Fixed in audit | Removed `questProgressFraction` (unused export); removed unused locals in battleSim; removed 8 unused imports. |
| Lint on touched modules | ✅ Clean (except repo-documented prettier exclusions) | 0 new errors; the ~440 preexisting `prettier/prettier` diffs remain untouched deliberately (live Lovable-synced repo, style preserved). |

## 2. Gameplay systems audit (as-shipped, honest)

- **Training**: stamina costs, gravity conditioning, mastery, soft caps, locations — intact and tested; Auto-Train + x2 pass verified in engine.
- **Progression**: XP curve, ranks, levels 1–100, form gates (level/PL/zeni/UI-pass), custom transform creator (cap 5000×) — intact, tested.
- **Power Level**: `(Σstats) × gravMult × formMult × 10`, saturates at `MAX_SAVE_NUMBER`; equipment bonus flows in (+Potara/Turtle Shell verified by test and browser).
- **Saga quests**: 15 quests, prereq chains, counted objectives, claim-once payouts, saga bonuses — tested (saga-quests.test.ts).
- **Dragon Balls & Shenron**: boss/scout/first-clear sources; 4 wishes (incl. +50 max stamina); one-shot application via `MAKE_WISH`; wish quest feeding (q15) — tested.
- **Combat**: melee combo chain + Heavy + branch bonuses (Ki-assist ≥3 combo, Final Stretch ≥5 combo w/ Ki Overload tradeoff, Vanish Punish ≥4), Perfect Guard/Parry (F) with EXPOSED windows, boss phases 1–3 with signatures, adaptive-read messaging, grades S–D with per-boss persistence and anti-rebuy rematch payouts (tournament/raid/endless rematches at 15%).
- **Endless Survival**: roster rotation, wave scaling (+60% HP / +45% ATK per wave), challenge modifiers (+100% rewards), best-wave tracking — tested.
- **Raid bosses**: Broly / Super Janemba with full first-clear payouts + guaranteed Dragon Ball — tested.

## 3. Save & data integrity

- Versioned envelope (`sealSave`/`openSave`/`migrateSave`), legacy v1 path, backup rotation (`-backup` key, 30 s rotation cadence), throttled writes (750 ms), `pagehide`/`beforeunload` flush.
- Corrupted main falls back to backup automatically; header shows an amber recovery banner (`recoveredFromBackup`).
- Sandbox is a separate save slot by design; fresh sandbox clones main; verified by unit test `resolveInitialLoad` + code review.
- Snapshot system: schema-versioned, named, capped 50, restore revalidates via `hydrate()`.
- Cross-save migration: no shape changes outside hydrate-driven additive fields; `SAVE_VERSION` remains **2**. Any future additive field must keep hydrate defaults — no migrations needed today.
- **Infinite-resource overrides**: no longer clobbers the wallet; godMode/infiniteKi/infiniteZeni all honored through combat.

## 4. God Engine audit

- Command console: zero `eval`, strict parser (help/autocomplete/history/confirm gates); every command maps to validated `AdminAction`s — tested (parse-purity + action mapping).
- Player Lab / Progression / Forms / Quests / World / Battle / Enemy Lab: all wired to the admin API with logged events and confirm gates on destructive verbs.
- Custom techniques run on the real combat pipeline (damage path, cooldowns, EXPOSED ×2, Infinite-Ki bypass) — engine-tested; castable from the battle "Custom" row.
- Automated Battle Tester: deterministic simulation; documented as a *simulation estimate*, not a live-match prediction.
- Event Log: capped at 100 entries; creation/deletion paths that bypass the typed API now also write audit rows (`recordAdminEvent`).
- **Destructive actions** (unlock-all forms, lock-all forms, complete/reset quests) return `confirmRequired` and every UI call site asks first.
- Sandbox isolation: separate slot; no live-battle state leaks to saves; battle commands route only through `battleBus`.

## 5. Performance & stability

- Stamina regen at 250 ms fixed cadence; TICK does not serialize the full save more than once per 750 ms (verified by code inspection).
- Canvas: `requestAnimationFrame` loop with full cleanup on unmount; no per-frame React state; resize via `ResizeObserver` with DPR cap 2.
- Event listeners: all `useEffect`-registered listeners removed on unmount; combo timers, clash intervals, charge intervals all cleared.
- No new dependencies added this project.
- Known non-blocking cosmetic issue: ~440 preexisting `prettier/prettier` formatting diffs (the repo was never prettier-enforced); deliberately untouched.

## 6. UI interactions verified (2026-11-07, live Chromium session)

All 8 tabs (Train · Battle · Forms · Quests · Shop · Tournament · Inventory · Endgame) render with **zero console errors**. Battle arena verified live (Raditz — phases, signature, ENEMY_TICK, melee chain, PERFECT_GUARD), God Engine verified via 5-title-taps and Ctrl+Shift+A, console `player.inspect` executed against the user's real save, battle tester returned WIN/grade-S, snapshot created, custom technique persisted and surfaced in the battle HUD.

## 7. Known limitations / honest gaps

1. **Tournament & Endgame rematches always pay 15%** (anti-farm), but **regular named bosses always pay full rewards on re-fight** — intentional farm design, not a bug.
2. **Best combat grades for tournament/endless variants pool under `tournament-r*/endless-N` ids**, not the base boss id — display shows per-variant grades.
3. **SNAPSHOT/export/import formats**: import accepts legacy bare state too; export always emits versioned JSON. Older saves from the very first Lovable builds load fine (hydration repair covered by tests).
4. **No multiplayer / cloud save / accounts** — local-only, as designed.
5. **This environment cannot run Lighthouse/visual regression tooling** — visual verification is manual (see §6); automated visual tests would be the next investment.
6. **Balance of the full endgame arc** (5-hour week-of-play pacing) is reasonable on paper but has not been playtested by a human for weeks — progression numbers may want a tuning pass after real player feedback.
7. **The `AGENTS.md` warning applies**: history of this git repo is local-only; the live Lovable project (if any) still holds its own state — nothing was pushed, nothing force-pushed.
8. God Engine powers are intentionally unrestricted within the game; there is **no cross-save/cross-browser sync** and no protection against a developer wiping their own main save (they can; double-confirmed).

## 8. Fixes applied during the final audit

- Removed dead code (`questProgressFraction` export; three unused locals in `battleSim.ts`).
- Annotated 6 silent `catch {}` blocks in godEngine.tsx; added unmount cleanup for the toast timer.
- Removed 8 unused imports; ESLint clean on touched modules.

## 10. Post-audit verification (2026-11-07, same session)

- **Lighthouse (live)**: Accessibility **1.00**, Best Practices **1.00**, SEO **1.00** — the two initial a11y failures (heading order, missing `main` landmark) were fixed for real (h3→h2 restructure of tab headings, `<main>` wrapper) and re-scored to 100/100/100.
- **Performance trace during active Raditz combat**: ~88 fps frame cadence (248 frames / 2.83 s), **one 96 ms long task** (Battle tab mount), no layout thrash (6 Layout calls), largest Paint 0.68 ms, MajorGC 2.6 ms. Canvas render path is healthy; no changes needed — measured, not guessed.
- **Balance audit probe** (`src/test/balance-audit.test.ts`): fresh player loses to Raditz (documented — training is mandatory), trainee (Lv 5 / 500 / Kaioken) wins, mid-game (Lv 15 / 2000 / SSJ3 / 3× gravity) beats Frieza, late-game (Lv 24 / 400K / Blue / 10× gravity) beats Beerus. Determinism check pinned.
- Test suite: **9 files / 154 passed**. Build: OK.

## 9. Checkpoint map

`baseline` (23 tests) → `phase-3` (46) → `phase-4` (65) → `phase-5` (87) → `phase-6` (110) → `phase-7` (139) → `phase-8` (150) → `phase-9` → `phase-10`

`git checkout <tag>` restores any checkpoint byte-for-byte.

---

# Post-phase-10 audit — 2026-11-14

**Tests:** 9 files / **155 passed** · **Build:** OK (client + SSR + Nitro) · **tsc:** clean · **ESLint:** 0 errors (13 pre-existing `react-refresh` warnings) · **Console:** all 8 tabs + full God Engine, **0 errors / 0 warnings** · **Lighthouse:** 1.00 / 1.00 / 1.00, 0 failures

A fresh full audit after the 2026-11-07 user-feedback round (`e22b983`). Same rules as before: engine stays React-free, UI dispatches only, battle commands only via `battleBus`; the ~440 pre-existing `prettier/prettier` line-ending noise is environmental (Windows checkout, `core.autocrlf=true`) and deliberately untouched — this audit ran with `--rule "prettier/prettier: off"` for real findings.

## Bugs found & fixed

1. **Custom techniques double-dipped EXPOSED (×4 damage)** — `CUSTOM_TECHNIQUE` applied its own `(exposed ? 2 : 1)` *and* `damageBoss` doubled again. The tech case now deals raw damage and leaves the doubling to `damageBoss` (regression test: exposed hit === 2 × normal hit, exactly).
2. **Variant boss ids broke saga scaling** — `battleSagaRank` only matched raw roster ids, so `endless-N`, `tournament-r*` and `raid-*` bosses all resolved to rank 0: trivial beam-clash pressure (9/s) and the maximum clash delay everywhere. Now: tournament variants resolve via `boss.tournament` index → template id; endless waves map through `ENDLESS_ROSTER` rotation (wave 7 wraps to wave 1); raids sit at end-of-roster pressure (`BOSSES.length - 1`). Regression test covers ranks + derived `battleClashPressure`/`battleClashDelay` for all three families (the old test asserted the *template*'s rank, not the variant's — intent fixed).
3. **"Restore from backup" wiped the save to defaults** — God Engine Settings fed the versioned envelope `{ v, data }` straight into `hydrate()`, which repairs it into a *default* state. Backup restore now goes through the same boot parser as normal load (`resolveInitialLoad(null, text).state`) and aborts with a toast when validation fails; export filename now names the active slot (`dragon-ball-rpg-{slot}-save.json`) and the backup panel reflects the current slot.
4. **Battle HUD used live max HP instead of the battle-start snapshot** — Auto-Train (x2 pass) can raise DEF mid-fight, which grew the HP bar's denominator while `maxPlayerHp` was fixed at battle start. HP bar, arena overlay, senzu "full HP" gate and the victory grade all read `battle.maxPlayerHp` now. Outcome effect deps corrected (two stale `eslint-disable-line`s removed, missing deps added).
5. **Parry mastery farmed from refused guards** — `runParry` bumped `parry` technique uses even when the guard was on cooldown and refused; the bump now sits behind the cooldown check.
6. **Battle simulator accuracy** — `battleSim.ts` now uses the live player-HP formula (`(100 + DEF×20) × formMult × gravMult`), the real `battleClashPressure(boss)` in clash ticks (was hard-coded `9`), and the dead `startKi` local is gone. Automated Battle Tester estimates now match the arena's math.
7. **Lint hygiene** — 6 `no-case-declarations` errors fixed by bracing the `BLAST`/`ULTIMATE`/`VANISH` cases in `engine.ts`; `prefer-const` in `combat-depth.test.ts`; an unnecessary `eslint-disable` in `balance-audit.test.ts` removed.
8. **Extreme-number clamps on hot paths** — `TICK` zeni, `applyTraining` stat writes, `grantExperience` XP and `applyShadowRewards` stat multiplies now saturate via `clampSaveNumber` instead of free-floating growth toward `Infinity`.
9. **FormArt duplicate SVG gradient ids** — two instances of the same form in one tree shared ids (`fa-<form>-<aura>`); ids are now `useId()`-based and unique per instance, and the portrait is `aria-hidden` decorative (it duplicated the adjacent text label).
10. **Stale build text** — God Engine "About this build" said "phase 8"; now reflects the post-audit build.
11. **Impure state updaters (setState-during-render)** — two God Engine paths called a setState *inside* the `update()` callback (`act` → `pushToast`, console → `print`); React executes updaters during the render phase, which surfaced as `Cannot update a component (AdminPanel) while rendering a different component (GameProvider)` in the console. Fixed by keeping updaters pure: the message is previewed on a throwaway `structuredClone` in the handler, then the real write dispatches; the snapshot branch now runs entirely in the handler (snapshots never touch the game draft). Verified live: admin action + console `player.inspect`/`help` with 0 console errors.

## Verification (2026-11-14)

- `npx vitest run` → 9 files / **155 passed** (154 prior + EXPOSED regression; variant-rank test replaces the template-only one).
- `npx tsc --noEmit` → clean. `npm run build` → OK (client + SSR + Nitro).
- `npx eslint src --rule "prettier/prettier: off"` → **0 errors**, 13 warnings — all pre-existing `react-refresh/only-export-components` (baseline unchanged).
- Live Chromium session (game running, user playing): all 8 tabs render, God Engine opens (5-title-taps and Ctrl+Shift+A), all panel sections verified, **0 console errors / 0 warnings**.
- Lighthouse: Accessibility **1.00**, Best Practices **1.00**, SEO **1.00**, 0 failures.

## Honest notes

- **No save *import* UI exists** — Settings & Recovery has export (versioned JSON) and backup restore, but no file-pick import path (the 2026-11-07 audit §7.3 overstated this; the console/parser can still apply states, and scenarios import/export exists separately).
- Tournament/endless grades still pool under variant ids (by design, unchanged).
- Prettier backlog unchanged: pre-existing formatting-only diffs, not touched.

---

# Audit — 2026-11-19 (PRE ALPHA 0.35)

**Scope:** audit the extracted worktree against `PLAN.md`, then execute the scoped open item.
**Result:** 255 tests / 19 files pass · `tsc --noEmit` clean · ESLint 0 errors on `src/genesis` + `src/test` · production build OK · live 2D Trainer and `/genesis` both render with 0 console errors.

## Environment findings

- **No toolchain in the extracted copy** — no global Node/npm, no `node_modules`. Installed a gitignored portable Node 24.11.1 at `.tools/node` and ran `npm ci` (548 packages).
- **No git metadata initially** — the extracted folder was not a repository. It was attached to `origin/main` (PRE ALPHA 0.34) without touching the working tree, so this round commits on top of the published history.
- **In-app browser surface auto-hides** — the tab throttles to 0 FPS when hidden, so final animation verification ran through headless Chrome (SwiftShader, ~11 FPS). Desktop in-app run was 100 FPS / 10.0 ms.
- **Doc drift** — `PROJECT_STATUS.md`'s TL;DR still describes Phases 4–10 as unimplemented, and `roadmap.md` leaves Phase 10 unchecked. `PLAN.md` is the current source of truth.

## Bugs found & fixed

1. **Boss quest completed from ordinary enemy kills** — all three Genesis quests shared one progress counter, so the "Defeat the boss" quest was satisfied by any enemy defeat. Enemy and boss counts are now separate, measured from a per-quest baseline taken when that quest activates. Rules extracted to pure `src/genesis/sim/quests.ts` with 4 tests.
2. **Imported rig run pose (PLAN open item)** — gait rotations used bone-local axes; iClone/CC skeletons have arbitrary local axes, so the Saiyan Prince folded forward at walk/run. Added pure `src/genesis/render/rigAxes.ts` (`offset = W0⁻¹ · R · W0`), a `CharacterDef.rigAxes` flag (enabled on the Saiyan Prince), and per-bone rest-orientation capture in `FighterRose` after the A-pose correction and model yaw. 5 tests cover Euler order, arbitrary rest orientations, yawed-axis mapping, identity, and non-finite guards.

3. **Enemy variety (groundwork)** — added pure `src/genesis/sim/enemies.ts` with grunt/scout/brute definitions and a tested `stepEnemy` (aggro chase, stop range, attack cooldown, home drift, dt clamp, non-finite guards). 8 tests. Not yet rendered: the scene still spawns the single 60 HP capsule.

## Files changed

- `src/genesis/render/rigAxes.ts` (new), `src/genesis/sim/quests.ts` (new), `src/genesis/sim/enemies.ts` (new)
- `src/genesis/render/FighterRose.tsx`, `src/genesis/characters.ts`
- `src/test/genesis-rig-axes.test.ts` (new), `src/test/genesis-quests.test.ts` (new), `src/test/genesis-enemies.test.ts` (new)
- `src/routeTree.gen.ts` (regenerated: `/genesis` route registration)
- `PLAN.md`, `AUDIT.md`, `PROJECT_STATUS.md`, `roadmap.md`

## Visual verification

- Trainer tab: renders, all tabs present, 0 console errors.
- `/genesis`: Vanguard / Rosé / Saiyan Prince all load; Saiyan Prince side-view sprint shows an upright torso with the intended forward lean; HUD reports 100 FPS on desktop, 11 FPS headless; no console errors.
- Quest HUD still shows `Defeat 5 enemies (0/5)` and advances only on the matching counter.

## Honest gaps

- The rig fix is verified idle + walk/run sprint; jump/fly/attack poses on the imported rig were not visually re-checked.
- Headless FPS is software-rendered and not representative of real performance; the desktop 100 FPS figure is.
- The 2D game was not regression-played beyond loading; its 155-test subset is included in the 255 passing tests.
- Enemy roster behavior is covered headless only; the three types are not yet visible in-game, so no visual check of distinct meshes/stats exists.

---

# Audit — 2026-11-21 (PRE ALPHA 0.41)

**Scope:** audit the extracted project against `PLAN.md`, then execute the open item "a second region spawn set and elite variants".
**Result:** 307 tests / 24 files pass · `tsc --noEmit` clean · ESLint 0 errors (15 pre-existing `react-refresh` / hook-dependency warnings) · production build OK · live `/genesis` 0 console errors.

## Bugs found & fixed

1. **Boss charged the player from scene load** — the 300 HP boss had no aggro gate, so it crossed the whole map immediately and would follow a player into the new region. Extracted pure `src/genesis/sim/boss.ts` with `idle → chase → return` states, a 7 m aggro radius, a 20 m leash, player-death reset and the original 2.5 m / 20 dmg / 1.5 s attack profile. God Engine `spawnBoss` still wakes it on demand.
2. **Boss hit flash reused the target-dummy flash ref** — hitting the boss flashed both combatants. Boss now owns `bossFlashRef`.
3. **Quest baseline was taken on completion, not activation** — a boss defeated under an earlier quest could instantly finish the boss quest. `questBaseline()` now snapshots only the counter the next quest reads, is called when the quest activates, and is re-seeded on God Engine reset.
4. **Transformation survived death and reset** — `formIDRef` is now cleared on player respawn and by the `reset` command.
5. **Dead command types and stale copy** — removed unused `spawnPillar` / `clearPillars` bus commands; corrected the HUD title and Master Oren's dialogue (he now mentions Ashen Flats and its two gold-marked elites).

## Feature work

- **Two regions** — Hollow Ridge keeps its grunt/scout/brute spawns; new Ashen Flats at `(36,-28)` adds cinder grunt/scout/brute plus Elite Stalker and Elite Warden. `EnemyType.id` stays unique per spawn while `archetype`, `region` and `elite` describe the variant.
- **Elite variants** — 2.6× HP, 1.6× damage, 3× XP, 8 s respawn, larger body, wider aggro/leash, gold material and a pulsing foot ring.
- **Region-aware HUD/rules** — `regionAt`, `regionByID`, `countEnemiesInRegion`; HUD shows active region and global/local enemy counts using existing design tokens. Scene landmarks were added in step with `world.ts` collision boxes.
- **Tests** — new `genesis-regions.test.ts` (6) and `genesis-boss.test.ts` (9); existing enemy/roster/quest suites extended for duplicate archetypes, per-region counts and activation baselines.

## Files changed

- `src/genesis/sim/enemies.ts`, `src/genesis/sim/boss.ts` (new), `src/genesis/sim/enemyRoster.ts`, `src/genesis/sim/quests.ts`, `src/genesis/sim/npcs.ts`
- `src/genesis/render/FighterRose.tsx`, `src/genesis/render/enemyBody.ts`, `src/genesis/render/GenesisScene.tsx`
- `src/genesis/hud/GenesisHud.tsx`, `src/genesis/world.ts`, `src/genesis/genesisBus.ts`
- `src/test/genesis-regions.test.ts` (new), `src/test/genesis-boss.test.ts` (new), `src/test/genesis-enemies.test.ts`, `src/test/genesis-enemy-roster.test.ts`, `src/test/genesis-quests.test.ts`
- `PLAN.md`, `AUDIT.md`, `PROJECT_STATUS.md`

## Visual verification

- `/genesis` loads with the corrected `Genesis — Alpha Prototype` title and `Enemies: 8/8 · 3/3 here`.
- God Engine teleport to `(36,-28)` switches the HUD to `Region: Ashen Flats · Elite territory` and `5/5 here`; no console errors before or after the command.
- A 1200×813 WebGL canvas is present and the 2D Trainer route still renders its established card/nav layout.
- Screenshot capture was unavailable because the Review-pane tab could not be kept visible in this harness; DOM text, canvas geometry and console logs were used instead.

## Honest gaps

- The extracted copy had no `.git` metadata; it was initialized and attached to the supplied GitHub remote at PRE ALPHA 0.40 and this round's 19 files were committed on top as `PRE ALPHA 0.41` without rewriting published history. The first push attempt returned 403 because the cached GitHub account lacks write access; the local commit is ready to publish once an authorized account is used.
- The in-app browser throttled to ~1 FPS while hidden; the 100 FPS figure from earlier desktop sessions is not re-measured here. Elite/boss balance has not been human-playtested.
- Boss and region rules are covered headlessly; the elite glow/ring was implemented in the renderer but only verified indirectly through the live scene + console, not by a pixel screenshot.
- A hot reload of `FighterRose.tsx` triggered a dev-only R3F/TanStack source-annotation error (`data-tsd-source`); a clean dev-server restart rendered without console errors. No production-build or test impact.
