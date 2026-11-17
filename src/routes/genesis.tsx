import { lazy, Suspense, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GenesisGodEngine } from "@/genesis/GenesisGodEngine";

export const Route = createFileRoute("/genesis")({
  head: () => ({
    meta: [
      { title: "Genesis — Saiyan Saga Trainer" },
      { name: "description", content: "Genesis 3D action RPG prototype — third-person movement." },
    ],
  }),
  component: GenesisPage,
});

// Code-split: three.js (and the scene) only load when /genesis is visited.
// The lazy import is never touched during SSR because GenesisPage returns null pre-mount.
const GenesisScene = lazy(() => import("@/genesis/render/GenesisScene"));

function GenesisPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-background">
          <span className="font-display text-xl text-muted-foreground">🌌 Loading Genesis…</span>
        </div>
      }
    >
      <GenesisScene />
      <GenesisGodEngine />
    </Suspense>
  );
}
