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
