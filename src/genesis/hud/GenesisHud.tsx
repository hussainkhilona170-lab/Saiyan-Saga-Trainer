import { Link } from "@tanstack/react-router";
import { Card, Btn } from "@/game/ui";

export type HudStats = {
  fps: number;
  ms: number;
  action: string;
  speed: number;
  character?: string;
  targetHp?: number;
  ki?: number;
  maxKi?: number;
  level?: number;
  xp?: number;
  xpToNext?: number;
  hp?: number;
  maxHp?: number;
};

export function GenesisHud({
  stats,
  onCycleCharacter,
}: {
  stats: HudStats;
  onCycleCharacter?: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-3">
      <Card className="pointer-events-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-2xl">🌌</span>{" "}
            <span className="font-display text-xl">Genesis — Movement Prototype</span>
            <div className="text-sm text-muted-foreground">
              WASD move · Shift sprint · Space jump · F fly · Ctrl descend · J attack
              {stats.character ? ` · ${stats.character}` : ""}
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div className="font-display text-lg text-chart-2" aria-live="polite">
              {stats.fps} FPS
            </div>
            <div>{stats.ms.toFixed(1)} ms/frame</div>
            <div className="font-display text-foreground">
              {stats.action} · {stats.speed.toFixed(1)} m/s
            </div>
            {stats.targetHp !== undefined && (
              <div className="text-xs text-chart-1">Target HP: {stats.targetHp}</div>
            )}
            {stats.hp !== undefined && (
              <div className="text-xs text-chart-2">
                HP: {Math.round(stats.hp)}/{stats.maxHp ?? 100}
              </div>
            )}
            {stats.ki !== undefined && (
              <div className="text-xs text-chart-2">
                Ki: {Math.round(stats.ki)}/{stats.maxKi ?? 100}
              </div>
            )}
            {stats.level !== undefined && (
              <div className="text-xs text-chart-1">
                Lv {stats.level} · XP {Math.round(stats.xp ?? 0)}/{stats.xpToNext ?? 100}
              </div>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          {onCycleCharacter && (
            <Btn onClick={onCycleCharacter} className="text-xs">
              ↻ Character
            </Btn>
          )}
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
