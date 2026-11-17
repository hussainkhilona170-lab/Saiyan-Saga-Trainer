# Dragon Ball RPG — Development Plan

**Version:** PRE ALPHA 0.28
**Last updated:** 2026-11-17
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
src/game/data.ts        Content registries: TRAININGS, FORMS, BOSSES, LOCATIONS, QUESTS, PASSES, WISHES, fmt
src/game/store.tsx      GameProvider/useGame — localStorage persistence + slot switching + update()/train()
src/game/controls.ts    useBattleControls — keyboard map + held-charge lifecycle
src/game/arena.tsx      Canvas renderer + synthesized battle SFX. Never contains rules.
src/game/battleBus.ts   One-way God Engine → BattleTab command channel
src/game/ui.tsx         All tabs + AdminPanel + BattleTab glue
src/game/router.tsx     TanStack route tree generation (routeTree.gen.ts is generated — do not hand-edit)
src/game/FormArt.tsx    Form portrait rendering (sprite images + SVG fallback)
src/genesis/sim/        GENESIS 3D: pure gameplay simulation (no three/React/DOM) — headless-testable
src/genesis/render/     GENESIS 3D: R3F scene + keyboard collection; renders sim state only
src/genesis/hud/        GENESIS 3D: HUD reusing Card + design tokens (AGENTS.md UI rules apply)
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

### User feedback round 4 (UI polish)
- **Turbo Clicker restyle** — card rebuilt to match the Train tab design language (Gravity Chamber pattern): emoji + `text-xl` title, muted status subtitle, right-aligned `chart-2` accent meter, Auto-Train-style stat pills, standard `Btn` START/STOP

### Genesis Phase 1 (commits `0.4`–`0.6`, 2026-11-16)
- **Engine decision APPROVED** — Three.js + React Three Fiber + Rapier (ADR in `TECH_STACK_DECISIONS.md` §12; full matrix + Godot runner-up with reversal trigger)
- **3D stack installed** — three 0.187.0, @react-three/fiber 9.8.2, @react-three/rapier 2.2.0
- **`/genesis` route** — code-split (three.js loads only there), client-only mount, 2D app untouched
- **Character sim** (`src/genesis/sim/character.ts`) — pure TS state machine: idle/walk/run/jump/fall/land, analog-ready input scaling, air control, landing recovery, dt clamp; **13 headless tests**
- **Scene** — theme-matched capsule character (emissive), grid ground, chart-colored landmark pillars, fog, shadows, camera-relative WASD + Shift sprint + Space jump, smooth third-person follow
- **HUD** — reuses `Card` + design tokens; live FPS/ms/action readout
- **Live-verified**: 100 FPS on the dev machine, action readout tracks input, zero console errors

### Genesis Phase 2 — animated fighter (`0.7`, 2026-11-16)
- **Procedural fighter body** (`src/genesis/render/Fighter.tsx`) — original low-poly rig built from primitives (orange gi, blue undershirt, spiked hair, boots); no licensed assets, so the prototype is not blocked on the asset pipeline
- **Pure animation layer** (`src/genesis/sim/animation.ts`) — joint poses per action, distance-driven gait clock (footfalls stay planted at any speed), smooth action blending, allocation-free hot path; **16 headless tests**
- **Locomotion feel** — walk/run arm-leg counter-swing, speed-scaled stride, forward lean when sprinting, tucked jump pose, braced landing crouch, idle breathing
- **Scene** — distant ridge line so the horizon reads, ki aura ring that brightens with speed, 2K shadows, HUD now shows live `action · m/s`
- **Live-verified**: 100 FPS, poses animate, zero console errors

### Genesis Phase 3 — Physics & camera collision (`0.8`–`0.9`, 2026-11-16)
- **Physics evaluated**: @react-three/rapier 2.2.0 suspends indefinitely under React 19 in this environment ("useRapier must be used within <Physics />" / WASM init hang); Rapier deferred per TECH_STACK_DECISIONS.md §7 reversal trigger, to be re-introduced when a React-19-compatible pairing lands
- **Manual collision (interim)** — capsule-vs-AABB push-out against landmark pillars; sim keeps its plane ground; character slides along walls
- **Camera collision** — slab ray-vs-AABB pulls the follow cam in when geometry occludes the view (`resolveCameraPosition`, pure + tested)
- **Character selection** — `CHARACTERS` roster (Saiyan / Namekian / Android) with palette + scale swap, HUD cycle button; logic pure + tested
- **God Engine adapter** — `genesisBus` (BroadcastChannel + same-tab fallback) + GenesisSection in the admin panel (character swap, teleport, reset); GenesisScene applies commands; cross-tab verified
- **Character visual upgrade** — cel-shaded (toon) Saiyan fighter: spiky layered hair, orange gi with blue undershirt/wristbands, belt with knot, boots, expressive eyes/eyebrows; smoother geometry (8–24 segments) and per-character scaling. No licensed assets used.
- **Live-verified**: 100 FPS, 10.0 ms/frame, walk/run verified, character swap works, zero console errors

### Rosé Saiyan — original GLB character (`0.15`)
- **Original character built in Blender** (`assets/source/rose_saiyan.py` → `public/assets/characters/rose_saiyan.glb`, 20-bone humanoid rig, 57 mesh parts, CC0-original geometry)
- Dark indigo gi, crimson sash/wristbands, spiky black hair, pale warm skin, rose aura
- **Procedural bone animation** (`FighterRose.tsx`): drives the 20-bone rig from the same pure `Pose` state machine — walk/run/jump/land limb motion with no baked clips (fixes the static "stuck" FBX problem)
- Set as the default character; cycle with the Character button

### Asset library (`assets/`, 2026-11-16)
- **13 CC0 character models** downloaded from Cinevva (Quaternius + Kenney), served from `public/assets/characters/`
- All CC0 (public domain) — free for commercial use, no attribution required
- Models are rigged GLBs with embedded animations (17-32 clips each)
- `public/assets/README.md` documents sources, tri counts, rig types, and usage
- Loaded with `fetch` + `GLTFLoader.parse` (drei is not a dependency)

### Vanguard — higher-fidelity original character (`0.17`)
- **Rebuilt procedural character pipeline**: `assets/source/vanguard_lib.py` (lofted elliptical cross-sections, rotation-minimizing tube frames, analytic two-bone skin weights, studio render helpers) + `assets/source/vanguard.py` (body spec)
- `public/assets/characters/vanguard.glb` — 10,924 tris, 20-bone humanoid rig, 13 material slots, no baked clips
- **Fixed a real deformation bug**: `Vector.rotation_difference(Z, -Z)` is degenerate for straight-down limbs, so every earlier downward tube got a randomly flipped cross-section (broken knees/boots). Replaced with a rotation-minimizing frame that walks the tangent along the path.
- Silhouette built from tapered muscle profiles instead of stacked spheres; separate cloth shells (open-front gi with a real V opening, trousers tucked into cuffed boots, obi with knot + tails, forearm wraps)
- **Open-front gi**: the jacket is lofted as an arc with a V-shaped angular gap (`v_gap`), so the chest skin shows through the actual opening — no floating patch geometry
- Face: tapered jaw, small eyes with iris/pupil/highlight, brows, wedge nose, mouth lines, inset ears; hair is a sheared skull cap plus tapered locks anchored 45% inside the skull so only the tips emerge
- Skin weights are analytic (nearest two bone segments, inverse-distance^3.6) instead of rigid per-part binding, so joints bend smoothly
- Set as the default character; cycle with the Character button
- Before/after previews rendered headlessly with Cycles (`preview_dir` arg) — no desktop window is touched

### Boss fight (`0.28`)
- **Red boss capsule** (300 HP) spawns at (8, 0, -6): chases at 3 m/s, attacks for 20 HP on a 1.5 s cooldown; respawns after 30 s.
- Melee/ki hits damage the boss and award 200 XP on defeat (plus per-hit XP); boss HP shown in the HUD.
- God Engine gains a `spawnBoss` command (button in GenesisSection).

### God Engine Genesis expansion (`0.27`)
- **Extended genesis bus**: `heal`, `giveXp`, `killEnemies` commands; GenesisScene queues them and FighterRose applies them (full HP/Ki, XP award with level-up, enemy wipe).
- **GenesisSection** (God Engine panel) gained a "Live controls" card: Heal, Kill enemies, and a numeric Give XP input.

### Genesis entry point in Trainer (`0.26`)
- **Nav link + Train-tab card** in the 2D Trainer app: a `🌌 Genesis` button in the tab bar and a "Enter Genesis →" card on the Train tab both route to `/genesis` (TanStack `Link`), so the 3D game is reachable from inside the Trainer without typing a URL.

### Save / load (`0.25`)
- **Versioned save envelope** for Genesis: `src/genesis/sim/save.ts` with `serializeSave`/`parseSave` (version check, clamping, malformed-input rejection).
- FighterRose loads on mount (level, xp, position, hp, ki) and persists every 5 s plus on unmount.
- **Tests**: 4 save cases → **238 tests / 16 files**.

### Enemy AI (`0.24`)
- **Purple enemy capsule** at (-4, 0, 0): chases the player within 2 m, attacks for 8 HP on a 1.2 s cooldown; respawns after 4 s when defeated.
- **Player HP** tracked and shown in the HUD; death triggers a 3 s respawn at the origin with full resources.

### RPG progression — XP & levels (`0.23`)
- **Pure progression module** `src/genesis/sim/progression.ts`: `Progress`, `createProgress`, `awardXp` (multi-level in one award), `xpToNextLevel`, `maxKiForLevel`/`maxHpForLevel`.
- **XP awards**: melee hit 5, ki hit 8, kill 50; level-up scales max Ki (+10) and max HP (+15) per level.
- HUD shows `Lv X · XP Y/Z`; player Ki/maxKi scale with level.
- **Tests**: 9 progression cases → **234 tests / 15 files**.

### Ki blasts (`0.22`)
- **Key K fires a ki blast** (costs 15 Ki, 18 damage, 12 m range) when the player has enough Ki; a glowing sphere travels in the facing direction at 16 m/s and damages the target dummy on impact.
- **Ki resource**: player combatant starts at 100/100 and regens 8/s; displayed in the HUD alongside target HP.
- HUD hint updated.

### Melee combat foundation (`0.21`)
- **Attack action** in the character sim: `J` triggers a wind-up/recovery (`ATTACK_DURATION 0.32 s`, `ATTACK_COOLDOWN 0.45 s`) that locks horizontal motion and plays an `attack` pose; `CharacterState` gains `attackTimer`/`attackCooldown`.
- **Pure combat module** `src/genesis/sim/combat.ts`: `Combatant`, `createCombatant`, `meleeHits` (range + frontal cone), `applyDamage`, `spendKi`/`regenKi`, `kiBlastHits`, `facingVector`, `planarDistance`.
- **Target dummy** in the scene (red capsule at (3, 0, 0)): melee hits reduce its HP; at 0 HP it hides and respawns after 3 s with a flash on hit. Target HP shown in the HUD.
- `useKeyboard` collects `attack` (KeyJ); HUD hint updated.
- **Tests**: 14 combat cases + 4 attack cases → **225 tests / 14 files**.

### Flight — vertical movement (`0.20`)
- **Powered flight** in the character sim: `F` toggles flight (takeoff lift, gravity off, altitude capped at 60 m); `Space` ascends at 5 m/s, `Ctrl`/`C` descends; hover holds altitude; touching the ground while descending lands with recovery.
- **Speeds**: 12 m/s base, 18 m/s sprint; obstacle push-out is skipped when the character flies over a pillar, and the camera ray uses the pillar's real height so the follow cam doesn't clip through tall obstacles.
- **Animation**: new `fly` action (distance-driven limb flutter, arms swept back, legs trailing, forward lean under thrust; hover pose with arms out).
- `CharacterState` gains `flying`; `CharacterInput` gains `toggleFly`/`ascend`/`descend` (optional, so existing tests and callers stay valid).
- HUD hint updated; `useKeyboard` collects `fly` (F) and `descend` (Ctrl/C).
- **Tests**: 9 new flight cases (takeoff, hover, climb, land, horizontal/sprint speed, altitude clamp, drop on toggle-off, landing recovery) → **211 tests / 13 files**.

### Imported rig support — Saiyan Prince (`0.19`)
- **The `vegeta.glb` bugs**: 374-joint iClone/CC rig, five *zero-duration* clips (so the bind pose is the T-pose and nothing can play), armature transforms baked in (`T=0, 0.58, 0` + `S=0.01`) which made the model hover, and its front authored on **+Z** so it walked backwards.
- **Bone aliases** — `BONE_WANTED` resolves each logical bone against a prioritised candidate list: our generated rig (`upperArm.L`, `thigh.L`) first, then iClone names (`arm_left_shoulder_2`, `leg_left_knee`). The iClone `*_upper_1`/`*_lower_1` bones are leaf helpers, not the deform chain, so they are deliberately excluded.
- **T-pose → A-pose on load** — `aimBone()` rotates a limb bone so its child points at a chosen world direction, independent of the rig's local axes. Applied to the shoulders *and* the forearms.
- **Auto scale + grounding** — models whose measured height is outside `[1.35, 2.15] m` are scaled to 1.75 m, then the root is lifted so `box.min.y === 0`. Fixes the imported rig's baked lift/centimetre scale generally, not just this asset.
- **Per-character flags** — `tPose` and `modelYaw` on `CharacterDef`; the Saiyan Prince sets both.
- **Quaternion rest-pose composition** — pose offsets are now `rest.quaternion * delta` instead of adding Euler angles, so the load-time A-pose correction survives every frame.
- **Hip bob moved to the outer group** — works for rigs whose root bone sits under a scaled armature.
- `src/test/genesis-bones.test.ts` extended with alias priority, normalised-alias fallback, and a whole iClone rig → **202 tests / 13 files**
- **Known issue (backlog):** on imported rigs the run pose folds forward — the gait rotates bones about their *local* axes, which don't match the character's axes on an iClone skeleton. A character-space axis matrix was prototyped and visibly keeps the torso upright; ship it as a per-rig `rigAxes` flag.

### Rig bone-name resolution fix (`0.18`)
- **Root cause of the "model loads but never animates" bug**: GLB exports keep dotted bone names (`upperArm.L`), but three.js runs every node name through `PropertyBinding.sanitizeNodeName` on load, which strips `.` `:` `/` `[` `]` and converts whitespace to underscores. `FighterRose.tsx` looked bones up by the authored name, so every lookup returned `null`, the bone map became `null`, and no pose was ever applied.
- **Fix**: new pure helper `src/genesis/render/boneNames.ts` — `normalizeBoneName` mirrors three's sanitisation, `resolveBoneName` prefers an exact match then a normalised match, `resolveBones` resolves a whole rig or reports failure. `FighterRose` now collects the names the skeleton actually exposes, resolves through the helper, and warns with the available names when a rig is missing.
- Verified at runtime by loading `vanguard.glb` through the real `GLTFLoader`: exported `upperArm.L` comes back as `upperArmL` and every required bone resolves.
- `src/test/genesis-bones.test.ts` (5 tests) covers sanitisation parity, exact-match preference, dotted-bone resolution, missing-bone null, and all-or-nothing rig resolution → **199 tests / 13 files**

> **PAUSED during Genesis (active direction, see §10):** the 2D feature list below is
> frozen while the 3D action RPG is developed. Revisit after Milestone B. The 2D app
> stays stable and regression-tested (155 tests) but takes no new features.

### High priority (paused)
- [ ] Boss Rush mode — fight all saga bosses back-to-back, escalating rewards
- [ ] Combat skill tree — spend TP on combat perks (crit, ki regen, guard window, clash power, vanish cooldown)
- [ ] Achievement system — badge/medal collection for milestones with small rewards

### Medium priority (paused)
- [ ] Save import (JSON) — import from file/paste; closes last save-integrity gap
- [ ] Location identity — distinct activities per location instead of pure multipliers
- [ ] Saga Story Mode — guided campaign with dialogue and cutscenes
- [ ] Boss AI patterns — distinct attack patterns, telegraphs, phase-specific behaviors

### Low priority / nice-to-have (paused)
- [ ] Weather & time of day — affects training multipliers and visuals
- [ ] Training minigames — rhythm/timing for bonus gains
- [ ] Companion system — pet with passive bonuses
- [ ] Seasonal events — limited-time challenges with exclusive rewards
- [ ] Async PvP (ghosts) — fight AI ghosts of saved builds
- [ ] World map exploration — node-based map replacing location dropdown
- [ ] Crafting system — combine materials into gear/consumables

## 6. Open items / bugs

- **Imported rig run pose (Saiyan Prince):** torso folds forward at walk/run because gait rotations use bone-local axes; imported iClone skeletons need character-space axes. Fix scoped, prototype validated.
- **`vegeta.glb` provenance** — bone names reference Dragon Ball FighterZ/iClone; confirm licensing matches the project's "no copyrighted likenesses" rule before any public release.
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

### UI consistency (mandatory)
From AGENTS.md — applies to every new screen, feature card, panel or button:

1. Existing UI is the source of truth. Never invent a new visual style for a feature.
2. Inspect before implementing. Examine existing screens, components, CSS, design tokens and layouts before creating UI.
3. Reuse components. Extend existing cards, buttons, panels and layouts rather than creating duplicates.
4. No arbitrary styling. Don't introduce random colors, spacing, border radii, shadows or typography.
5. Match neighboring components. New elements must look like they belong to the same application.
6. Visual verification is mandatory. Run the application and compare new screens with established screens.
7. No unnecessary redesigns. Don't change existing UI unless explicitly requested.

In this project, that means:
- **Source of truth:** the design language of `src/game/ui.tsx` — `Card` (`rounded-xl border border-border bg-card/80 p-4 backdrop-blur`), `Btn` (`rounded-lg bg-primary font-display tracking-wide`), and the card pattern used across tabs: emoji + `font-display text-xl` title, `text-sm text-muted-foreground` subtitle, right-aligned `font-display text-lg text-chart-2` accent value, `text-xs` muted footnote.
- **Tokens only:** Tailwind v4 theme tokens (`primary`, `muted`, `secondary`, `chart-1/2`, `destructive`) — no inline hex colors, no invented radii, shadows, or spacing values.
- **Reuse:** extend `Card`, `Btn`, `Bar`, `FormArt`, and existing tab sections instead of writing parallel components.
- **Visual verification:** run the dev server (`npm run dev -- --port 3100 --strictPort`), verify the new screen in the browser against an established screen (e.g., the Train tab), with zero console errors — before committing.
- **Restyles only on request:** existing UI is never restyled or rearranged unless the user explicitly asks (see the Turbo Clicker restyle, PRE ALPHA 0.2).

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

### Commit versioning & push (mandatory)
- Every commit message must be `PRE ALPHA X.Y` with an incrementing version number (0.1, 0.2, 0.3, …). Each commit increments the patch number by 1.
- After every commit, push to `origin main` immediately (`git push origin main`).
- PLAN.md must be updated on every commit (features, bugs, upcoming, instructions). Keep it current so any other AI/human can pick up.
- Do not rewrite published history (no force push, rebase, amend, or squash of pushed commits).

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
- `f41d75c` — PRE ALPHA 0.2 (Turbo Clicker restyle)
- `37599cc` — PRE ALPHA 0.3 (UI consistency rules in AGENTS.md + PLAN.md)
- `03e0dfd` — PRE ALPHA 0.4 (Genesis Phase 0: TECH_STACK_DECISIONS.md + GENESIS section)
- `100ee19` — PRE ALPHA 0.5 (engine decision approved, ADR filled)
- `8f8f86d` — PRE ALPHA 0.6 (Genesis Phase 1: 3D stack, /genesis route, character sim + tests, scene, HUD)
- `7585349` — PRE ALPHA 0.7 (Genesis Phase 2: procedural fighter body + pure animation layer + scene polish)
- `5df29ca` — PRE ALPHA 0.8 (Genesis Phase 3: Rapier attempt + camera collision + character selection; pushed)
- `dd5ef3c` — PRE ALPHA 0.9 (manual collision + God Engine adapter + genesisBus)
- `971caff` — PRE ALPHA 0.17 (Vanguard procedural character)
- `8aee660` — PRE ALPHA 0.18 (rig bone-name resolution fix)
- PRE ALPHA 0.19 (imported rig support: aliases, A-pose, auto-scale/grounding, yaw)
- PRE ALPHA 0.20 (flight: powered flight, ascend/descend, hover, altitude clamp)
- PRE ALPHA 0.21 (melee combat foundation: attack action, combat module, target dummy)
- PRE ALPHA 0.22 (ki blasts: projectile, ki resource, regen, HUD)
- PRE ALPHA 0.23 (RPG progression: XP & levels, HUD)
- PRE ALPHA 0.24 (enemy AI: chase, attack, respawn, player HP)
- PRE ALPHA 0.25 (save/load: versioned envelope, persist on interval + unmount)
- PRE ALPHA 0.26 (Genesis entry point in Trainer: nav link + Train-tab card)
- PRE ALPHA 0.27 (God Engine Genesis expansion: heal, giveXp, killEnemies)
- PRE ALPHA 0.28 (boss fight: 300 HP boss, chase/attack, respawn, XP)

## 9. Test counts

- Engine tests: 22
- Genesis character-sim tests: 13
- Genesis animation tests: 16
- Genesis logic tests: 11 (characters + camera collision)
- Genesis bone-resolution tests: 8 (sanitisation, aliases, iClone rigs)
- Genesis flight tests: 9 (takeoff, hover, climb, land, speed, clamp, drop, recovery)
- Genesis combat tests: 14 (hit detection, damage, ki, ki blast)
- Genesis attack tests: 4 (wind-up, motion lock, cooldown, recovery)
- Genesis progression tests: 9 (xp, level-up, overflow, multi-level, scaling)
- Genesis save tests: 4 (round-trip, version, malformed, clamping)
- Total: 238 (16 files)
- All passing as of last commit

## 10. GENESIS — 3D Action RPG (active direction)

**Vision:** transform the 2D Trainer into a third-person 3D action RPG
(desktop PC, Windows; Kakarot-inspired, original assets only). Full direction
and rules: the user's Genesis master prompt (12 phases → Milestones A–D).

### Decisions locked (2026-11-16)
- **2D features paused** (§5) — the 2D app stays stable and regression-tested, no new features during Genesis.
- **God Engine = parallel track** — an adapter (`genesisBus`, console, Live Inspector, snapshots on Genesis state) ships with Phase 1, not Phase 9. The existing God Engine pattern (16 labs, 26+ typed actions) transfers.
- **Prototype assets:** CC0 placeholder packs (Quaternius/Kenney GLTF) for Milestones A–B; original/licensed assets gated before Alpha 0.1. Kakarot assets are off-limits.
- **Engine decision: APPROVED 2026-11-16** — Three.js + React Three Fiber + Rapier (see `TECH_STACK_DECISIONS.md` §6/§12; Godot 4.6 remains the runner-up with a defined switch trigger). Phase 1 unlocked.

### Roadmap (user-approved structure)
- **Milestone A (Phases 0–2):** preservation + architecture + playable 3D character. ← current
- **Milestone B (Phases 3–8):** flight, combat, RPG progression, world, quests, bosses.
- **Milestone C (Phase 9):** God Engine ecosystem expansion.
- **Milestone D (Phases 10–12):** polish, optimization, desktop release, post-launch.
- **Alpha 0.1 target:** 1 region, 1–2 characters, movement + flight, melee + Ki combat, 2–3 enemy types, 1 boss, 3–5 quests, NPCs, XP/levels, 1 transformation, save/load, basic God Engine.

### Milestone A exit gates (all must pass)
1. Character walks/runs/jumps/lands with camera collision at 60 FPS on the dev machine.
2. 2D app: zero regressions — 155 tests green + build green on every commit.
3. God Engine console can drive/inspect the 3D player (parallel-track rule).
4. Visual verification per AGENTS.md UI consistency rules (screenshots + zero console errors).

### Genesis documents
`TECH_STACK_DECISIONS.md` (engine decision, pending review) — Phase 0 continues with
PROJECT_VISION / ARCHITECTURE / MIGRATION_PLAN / DESIGN_SYSTEM / GAME_SYSTEMS /
ASSET_PIPELINE / TESTING_STRATEGY after the engine is approved.
