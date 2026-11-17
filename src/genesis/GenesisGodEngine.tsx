import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card, Btn } from "@/game/ui";
import { GenesisSection } from "@/game/genesisSection";

/**
 * Genesis-local God Engine overlay.
 *
 * The full God Engine lives in the 2D Trainer app; this overlay exposes the
 * Genesis-relevant controls (character swap, teleport, heal/XP/enemies) so they
 * can be used without switching tabs. Toggle with Ctrl+Shift+A or 5 rapid clicks
 * on the Genesis title.
 */
export function GenesisGodEngine() {
  const [open, setOpen] = useState(false);
  const tapsRef = useRef(0);
  const tapTimeRef = useRef(0);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          const now = Date.now();
          tapsRef.current = now - tapTimeRef.current < 1500 ? tapsRef.current + 1 : 1;
          tapTimeRef.current = now;
          if (tapsRef.current >= 5) {
            tapsRef.current = 0;
            setOpen(true);
          }
        }}
        className="pointer-events-auto absolute left-4 top-4 z-20 rounded-lg bg-secondary/80 px-3 py-1.5 font-display text-sm text-secondary-foreground backdrop-blur hover:bg-secondary"
        title="Open God Engine (Ctrl+Shift+A)"
      >
        ⚙ God Engine
      </button>
    );
  }

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur">
      <div className="w-full max-w-3xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-display text-2xl">⚙ God Engine — Genesis</div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            Close ✕
          </button>
        </div>
        <GenesisSection />
        <Card>
          <div className="text-sm text-muted-foreground">
            Need the full 2D God Engine (player lab, battle control, snapshots…)?{" "}
            <Link to="/" className="text-primary underline">
              Open the Trainer
            </Link>{" "}
            and press Ctrl+Shift+A there.
          </div>
        </Card>
      </div>
    </div>
  );
}
