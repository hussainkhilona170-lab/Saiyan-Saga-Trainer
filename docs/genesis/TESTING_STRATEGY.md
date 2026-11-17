# Testing Strategy — Genesis

## Layers
1. **Pure sim tests** (`src/test/genesis-*.test.ts`) — Vitest, headless, no three/React/DOM.
   - character (movement, jump, land, air control, dt clamp, flight, attack)
   - animation (finite poses, gait scaling, opposition)
   - bones (sanitisation, aliases, iClone rigs)
   - combat (hit detection, damage, ki)
   - progression (xp, level-up, scaling)
   - save (round-trip, version, clamping)
2. **Type check** — `tsc --noEmit` (strict, exactOptionalPropertyTypes).
3. **Lint** — eslint scoped to `src/genesis` + `src/test` (full `eslint .` has pre-existing CRLF noise).
4. **Build** — `vite build` (nitro output).
5. **Visual** — dev server `npm run dev -- --port 3100 --strictPort`, screenshot, zero console errors.

## Commands (Windows)
```
& "C:\Program Files\nodejs\node.exe" "node_modules\typescript\bin\tsc" --noEmit
& "C:\Program Files\nodejs\node.exe" "node_modules\eslint\bin\eslint.js" src/genesis src/test
& "C:\Program Files\nodejs\node.exe" "node_modules\vitest\vitest.mjs" run
& "C:\Program Files\nodejs\node.exe" "node_modules\vite\bin\vite.js" build
```

## Gates (Milestone A)
1. Character walks/runs/jumps/lands with camera collision at 60 FPS on dev machine.
2. 2D app: zero regressions — tests green + build green on every commit.
3. God Engine console drives/inspects the 3D player.
4. Visual verification per AGENTS.md (screenshots + zero console errors).

## Conventions
- Every commit: `PRE ALPHA X.Y`, update PLAN.md, push to `origin main`.
- No history rewriting (Lovable-connected).
- Tests must pass before commit.
