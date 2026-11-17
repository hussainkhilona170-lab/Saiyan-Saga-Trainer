# Design System — Genesis

Genesis reuses the 2D Trainer's design tokens and components (AGENTS.md UI rules).

## Source of truth
`src/game/ui.tsx`: `Card` (`rounded-xl border border-border bg-card/80 p-4 backdrop-blur`),
`Btn` (`rounded-lg bg-primary font-display tracking-wide`), and the card pattern
(emoji + `font-display text-xl` title, `text-sm text-muted-foreground` subtitle,
right-aligned `font-display text-lg text-chart-2` accent, `text-xs` footnote).

## Tokens only
Tailwind v4 theme tokens: `primary`, `muted`, `secondary`, `chart-1/2`,
`destructive`. No inline hex, no invented radii/shadows/spacing.

## Reuse
Extend `Card`, `Btn`, `Bar`, `FormArt`. New screens must match neighboring
components and be verified in the browser with zero console errors.

## 3D-specific
- Scene palette: `SCENE.background "#191b2c"`, ground `"#262640"`, grid `"#3d3d68"`.
- Accent colors come from the same chart tokens (aura ring `#e0508c`).
- HUD reuses `Card` + tokens (see `GenesisHud.tsx`).
