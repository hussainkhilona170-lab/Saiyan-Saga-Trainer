# TECH_STACK_DECISIONS.md — Genesis 3D Engine Decision

**Status: PENDING USER REVIEW** — no engine chosen yet; nothing 3D is installed or built.
**Prepared:** 2026-11-16 · **Project:** Saiyan Saga Trainer: Genesis (3D action RPG)
**Decision gate:** user approval of a recommendation below unlocks Phase 1 (Genesis foundation).

> Research method: live web verification via Tavily (2026-11-16) against vendor pages,
> release archives, and community sources. Engine versions below are **verified current
> as of this date**. The repository analysis is verified against actual code
> (see PLAN.md §2 and GAME_SYSTEMS.md).

---

## 1. What the decision must satisfy

From the Genesis vision (third-person 3D action RPG, desktop PC, Kakarot-inspired but
original assets) and the verified state of this repository:

1. **Third-person character controller** with walk/run/jump/dodge — and **flight** as a core mechanic.
2. **Real-time combat**: melee combos, lock-on, dodge/block/perfect-guard, Ki blasts and beams, aerial combat.
3. **Data-driven RPG progression** — the existing 1,202-line pure-TS `engine.ts` (stats, XP, forms,
   mastery, zeni/TP, quests, techniques, prestige, ascension) and `data.ts` registries are an asset to keep.
4. **One save envelope** shared with the 2D Trainer (`db-training-sim-v1`, v2, migration chain).
5. **OpenCode-driven development**: GLM 5.3 / BEAM implement and review everything through text.
   Tools that require heavy editor round-trips weaken this workflow.
6. **Windows desktop packaging** at release (Phase 11).
7. **Stylized anime look** — achievable rendering, not photorealAAA.
8. **Long-lived project** (12 phases) — maintainability and tooling maturity matter.

## 2. Evaluation criteria and weights (sum = 100)

| # | Criterion | Weight | Rationale |
|---|-----------|-------:|-----------|
| 1 | OpenCode / AI-agent workflow compatibility | 15 | Every line of this project is written through coding agents; editor-centric tools cost us most |
| 2 | Reuse of existing TypeScript systems | 12 | engine.ts, data.ts, save envelope, battleSim are verified assets; porting them is pure loss |
| 3 | Physics & character controller quality | 12 | The controller and flight feel are the first proof of the whole project |
| 4 | Animation systems | 12 | Character/enemy animation volume is large; tooling decides content throughput |
| 5 | Real-time combat feasibility | 12 | Hit detection, locks, cancels, aerial state must be buildable, not fought against |
| 6 | 3D rendering & world tooling | 10 | Stylized quality + region-building efficiency |
| 7 | Asset pipeline | 10 | GLTF/mesh/animation import; CC0 placeholders first, real assets later |
| 8 | Desktop performance & packaging | 8 | Windows target; 60 FPS goal on modest hardware |
| 9 | Long-term maintainability | 9 | 12 phases; team = AI agents + one human; licensing stability |

Scores are 1–5 per criterion (5 = best fit). Weighted total out of 500.

## 3. Verified engine landscape (as of 2026-11-16)

| Engine | Current version | License / cost | Language |
|---|---|---|---|
| Godot | **4.6.2 stable** (4.6.3-rc May 2026) | MIT, free | GDScript / C# (.NET) |
| Unity | Unity 6 (6.x line) | Runtime Fee **cancelled**; free < $200k revenue; Pro ≈ $2,200/user/yr above | C# |
| Unreal | **5.8** (June 23, 2026) | 5% royalty after $1M gross / free for most indies | C++ / Blueprints |
| Three.js + React Three Fiber | three r1xx (WebGL2 stable; **WebGPU renderer still experimental**) | MIT, free | TypeScript |
| @react-three/rapier | **v2** (supports R3F v9 / React 19) | MIT/Apache, free (Rapier WASM) | TypeScript |
| Babylon.js | 8.x | MIT/Apache, free | TypeScript |
| Tauri (packaging) | 2.x stable | MIT/Apache, free | Rust shell |
| Bevy | 0.1x | MIT, free | Rust |

## 4. Scoring matrix

| Criterion (weight) | Godot 4.6 | Unity 6 | Unreal 5.8 | **R3F + Rapier** | Babylon.js |
|---|---:|---:|---:|---:|---:|
| OpenCode/AI workflow (15) | 2 | 2 | 1 | **5** | 4 |
| TS system reuse (12) | 1 | 1 | 0 | **5** | 3 |
| Physics & controller (12) | 4 | 4 | 4 | **3** | 3 |
| Animation systems (12) | 4 | 5 | 5 | **3** | 3 |
| Combat feasibility (12) | 3 | 4 | 4 | **3** | 3 |
| Rendering & world tooling (10) | 4 | 4 | 5 | **3** | 3 |
| Asset pipeline (10) | 4 | 4 | 4 | **3** | 3 |
| Desktop perf & packaging (8) | 5 | 4 | 4 | **3** | 3 |
| Maintainability (9) | 4 | 3 | 3 | **4** | 4 |
| **Weighted total** | **330** | **337** | **320** | **373** | **312** |
| **Share** | 66% | 67% | 64% | **75%** | 62% |

Reading of the matrix: the native engines genuinely win engine-feature rows
(physics, animation, rendering, packaging). The R3F stack wins the rows this
project cannot avoid — agent-driven development and zero-cost reuse of the
existing TypeScript engine — and loses no row by more than 2 points.

## 5. Candidate deep dives

### Godot 4.6 — strongest native-engine alternative
- **Pros:** MIT/free, mature 3D, built-in physics (Jolt option), excellent animation tooling, first-class Windows export, text-based `.tscn` scenes.
- **Cons for this project:** GDScript/C# — the entire verified TS engine (progression, saves, simulators, God Engine adapters) must be rewritten or dual-maintained; scene/asset authoring is editor-centric, which slows an agent-driven loop; no TypeScript reuse.
- **Verdict:** best fallback; see the switch trigger in §7.

### Unity 6 — the industry default
- **Pros:** strongest animation/asset ecosystem (Mecanim, Asset Store), huge talent/tool pool, solid combat samples.
- **Cons:** C# port of everything TS; per-seat cost above $200k revenue; editor-centric; version-churn and licensing history make long-term bets uncomfortable.
- **Verdict:** viable, but strictly worse for this workflow than the two leaders.

### Unreal 5.8 — wrong scale
- **Pros:** unmatched rendering, Chaos physics, MetaHuman/animation stack.
- **Cons:** C++/Blueprints, heavyweight for stylized anime scope; hardest for AI agents to drive safely; royalty terms.
- **Verdict:** eliminated — overkill and workflow-hostile here.

### Three.js + React Three Fiber + @react-three/rapier — recommended
- **Pros:**
  - 100% TypeScript: `engine.ts`, `data.ts`, `save envelope`, `battleSim.ts` import **directly, with zero porting**; one language across UI, sim, and render.
  - Same repo, same Vite build, same vitest, same God Engine panel patterns (`battleBus` → `genesisBus`).
  - OpenCode drives every layer text-first; the headless sim layer is unit-testable like the existing 155 tests.
  - R3F v9 + rapier v2 ecosystem "matured in 2025" — browser combat prototypes are proven territory.
  - MIT/Apache end to end, zero licensing risk.
- **Cons (honest):**
  - No editor-grade animation tooling — GLTF + `AnimationMixer`, Blender becomes a real dependency for custom assets.
  - Character controller, camera collision, and combat feel are hand-built (Rapier gives physics, not gameplay).
  - Web rendering perf on low-end GPUs < native engines; WebGPU renderer still experimental in 2026, so WebGL2 is the target.
  - Desktop packaging caveat: **Tauri's WebView2 has documented WebGL performance issues in build mode** (tauri#8020). Mitigation: Electron fallback (bundles Chromium, consistent perf, bigger bundle), decided at Phase 11 with a perf spike.

### Babylon.js — the eliminated web engine
- Capable and free, but no React reconciliation fit, smaller game-oriented community than R3F, same web limitations, and no advantage over the stack that reuses our TS.

### Bevy / other native Rust — eliminated
- Rapidly evolving, but Rust + agent iteration speed + no editor tooling = worst of both worlds for this team.

## 6. Recommendation

**Three.js + React Three Fiber + @react-three/rapier (TypeScript), packaged for Windows with Tauri 2 (Electron as evaluated fallback).**

Reasons in order of weight:
1. Only option that **reuses the verified asset** — the pure-TS engine — instead of rewriting it.
2. Only option the **OpenCode agent workflow can drive end-to-end** without editor round-trips.
3. One codebase = one test suite = one save system = one God Engine, exactly the integration the vision demands.
4. MIT/Apache throughout; no per-seat or royalty cost ever.
5. Its weaknesses (animation tooling, controller labor, web perf ceiling) are **labor we control**, while the native engines' weaknesses (TS rewrite, editor round-trips) are **structural costs paid every day for 12 phases**.

## 7. Reversibility trigger (honest exit ramp)

The decision is cheap to reverse **before Milestone B combat** (Phases 0–2 are mostly portable concepts: state machines, data, tests). Switch to Godot 4.6 if, at the end of Milestone A:
- the character controller cannot hold 60 FPS with flight + combat dummies on the target machine, **or**
- animation authoring via Blender/GLTF proves to block content throughput at Phase 4–6 scale.

At that point engine.ts/data.ts/battleSim get ported to C# (Godot .NET), a bounded cost paid once.

## 8. Migration impact (verified systems, Task E)

| System (verified) | Disposition (R3F path) | Disposition (Godot path) |
|---|---|---|
| `engine.ts` progression rules (1,202 ln) | **Preserve as-is** — imported by both apps | Rewrite to C# |
| `data.ts` content registries | **Preserve as-is** | Rewrite |
| Save envelope v2 + `migrateSave` + backups | **Preserve**; add v3 migration (3D fields) | Rewrite serialization |
| `battleSim.ts` headless balance sim | **Preserve/extend** | Rewrite |
| God Engine console/snapshots/tester pattern | **Migrate** — re-point at Genesis state, keep 2D actions | Rebuild in Godot tooling |
| `battleBus.ts` pattern | **Migrate** → `genesisBus` | N/A (different IPC) |
| `store.tsx` provider pattern | **Extract** pattern → Genesis sim store | Rewrite |
| `controls.ts` input mapping | **Migrate** concepts → controller input | Rewrite |
| `arena.tsx` 2D battle renderer (607 ln) | **Rewrite** (3D combat is new) — keep sound-synth ideas | Rewrite |
| `FormArt.tsx` sprites | **Preserve** in 2D app; 3D needs models | Same |
| 2D app (`ui.tsx`, routes) | **Preserve untouched** — stays default experience | Same |
| Assets | **New** — CC0 GLTF placeholders (Quaternius/Kenney) now; original assets gated before Alpha 0.1 | Same |

## 9. Integration strategy (R3F path)

1. Same repository, new `/genesis` route, code-split (`React.lazy`) — three.js loads only there; the 2D Trainer remains the default experience and the Lovable branch stays green.
2. `src/genesis/sim/` — pure TS gameplay state (input → physics → combat → progression), no React, unit-tested headless.
3. `src/genesis/render/` — R3F components consuming sim state only.
4. `src/genesis/hud/` — reuses the verified design tokens (oklch palette, Bangers/Rajdhani, Card/Btn patterns per AGENTS.md UI rules).
5. One save envelope: Genesis reads/writes the same slot; v3 migration adds 3D-only fields.
6. God Engine gains a Genesis adapter (console commands, Live Inspector, snapshots) from Phase 1 — the parallel-track rule.
7. Tauri 2 wraps the production build (Phase 11), with the WebGL-perf spike deciding Tauri vs Electron.

## 10. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| GLTF/animation assets (biggest external dependency) | High | CC0 packs for Milestones A–B; commission/purchase gated before Alpha 0.1; Blender pipeline documented in ASSET_PIPELINE.md |
| Tauri WebView2 WebGL perf | Medium | Perf spike at Phase 11 start; Electron fallback is a config-level change, not a rewrite |
| Agent-driven 3D debugging is harder than 2D | Medium | Headless sim layer + God Engine telemetry (FPS/frame-time/entity inspector) from Phase 1 |
| Web perf ceiling vs native | Medium | Stylized scope, budgeted draw calls, 60 FPS gate per Milestone A exit criteria |
| Scope (Kakarot-scale ambition) | High | 12-phase roadmap with hard exit gates; Alpha 0.1 slice defined; pause-on-verify discipline |

## 11. Sources (verified 2026-11-16)

- Godot download archive / release blog (4.6.2 stable, 4.6.3-rc) — godotengine.org
- Unity 6 launch + Runtime Fee cancellation — CNBC, Oct 2024; Unity pricing page
- Unreal Engine 5.8 release — unrealengine.com, June 23 2026
- @react-three/rapier v2 release notes — pmndrs.github.io/react-three-rapier
- Tauri 2 + WebGL perf issue #8020 — github.com/tauri-apps/tauri
- three.js WebGPU renderer status — threejs manual / community guides ("experimental"; WebGLRenderer recommended)
- Repository facts — verified by direct code inspection (see PLAN.md §2, §9)

## 12. Decision record (ADR — fill on approval)

- **Decision:** _pending user review of §6_
- **Date / approver:** —
- **Reversal trigger:** §7
- **Consequences:** unlocks Phase 1 (Genesis foundation) per DEVELOPMENT_ROADMAP.md
