import { Link } from "@tanstack/react-router";
import { Card } from "@/game/ui";

/** HUD readout updated ~2×/second by the scene loop (no per-frame React renders). */
export type HudStats = { fps: number; ms: number; action: string };

/**
 * Genesis HUD — reuses the app's Card and the established design language
 * (emoji + font-display text-xl title, muted subtitle, chart-2 accent readout),
 * per AGENTS.md UI consistency rules.
 */
export function GenesisHud({ stats }: { stats: HudStats }) {
  return (
    <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-3">
      <Card className="pointer-events-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-2xl">🌌</span>{" "}
            <span className="font-display text-xl">Genesis — Movement Prototype</span>
            <div className="text-sm text-muted-foreground">
              WASD move · Shift sprint · Space jump
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div className="font-display text-lg text-chart-2" aria-live="polite">
              {stats.fps} FPS
            </div>
            <div>{stats.ms.toFixed(1)} ms/frame</div>
            <div className="font-display text-foreground">{stats.action}</div>
          </div>
        </div>
      </Card>
      <Link
        to="/"
        className="pointer-events-auto rounded-lg bg-secondary px-3 py-2 font-display text-sm tracking-wide text-secondary-foreground transition hover:bg-secondary/70"
      >
        ← Trainer
      </Link>
    </div>
  );
}
