<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep animated combat presentation, battle-specific visuals, and combat sound helpers in a dedicated game arena module so battle mechanics remain isolated from the general game UI.
- Game rules and state transitions live in src/game/engine.ts as pure functions (applyAction, hydrate); React store only dispatches — keeps rules testable and saves backward-compatible.
- The God Engine admin panel reaches the live battle only through src/game/battleBus.ts (sendBattleCommand); BattleTab owns BattleState and applies commands — never edit battle state from the panel directly.

### UI consistency (mandatory)

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
