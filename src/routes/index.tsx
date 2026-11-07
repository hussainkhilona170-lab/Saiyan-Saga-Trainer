import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FORMS, LOCATIONS, fmt, type Boss } from "@/game/data";
import { allForms } from "@/game/engine";
import { GameProvider, powerLevel, useGame } from "@/game/store";
import { AdminPanel, BattleTab, FormsTab, QuestsTab, ShopTab, TournamentTab, TrainTab, Bar } from "@/game/ui";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Saiyan Training Simulator — Dragon Ball Clicker RPG" },
      { name: "description", content: "Click to train, transform up to Ultra Instinct, and battle Raditz to Beerus in this Dragon Ball training RPG." },
      { property: "og:title", content: "Saiyan Training Simulator" },
      { property: "og:description", content: "Tap-to-train Dragon Ball RPG: forms, bosses, sagas, and Shenron wishes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <GameProvider><Game /></GameProvider>,
});

const TABS = ["Train", "Battle", "Forms", "Quests", "Shop", "Tournament"] as const;

function Game() {
  const { s, shake, slot, recoveredFromBackup } = useGame();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Train");
  const [admin, setAdmin] = useState(false);
  const [taps, setTaps] = useState(0);
  const [customBoss, setCustomBoss] = useState<Boss | null>(null);
  const [shaking, setShaking] = useState(false);
  const form = allForms(s).find((f) => f.id === s.activeForm) ?? FORMS.find((f) => f.id === "base")!;
  const loc = LOCATIONS.find((l) => l.id === s.location) ?? LOCATIONS.find((l) => l.id === "roshi")!;

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") { e.preventDefault(); setAdmin((a) => !a); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => { if (!shake) return; setShaking(true); const t = setTimeout(() => setShaking(false), 500); return () => clearTimeout(t); }, [shake]);

  return (
    <div className={`min-h-screen ${shaking ? "screen-shake" : ""}`} style={{ background: `radial-gradient(ellipse at top, ${loc.bg}, var(--background) 70%)` }}>
      <div className="mx-auto max-w-6xl p-4">
        <header className="mb-4 flex flex-wrap items-center gap-4">
          <h1 className="cursor-default select-none font-display text-4xl text-primary drop-shadow" onClick={() => { const n = taps + 1; setTaps(n); if (n >= 5) { setAdmin(true); setTaps(0); } }}>
            Saiyan Training Sim
          </h1>
          <div className="ml-auto flex flex-wrap gap-3 font-display text-lg">
            <span>💰 {fmt(s.zeni)}</span><span>🏅 {fmt(s.tp)} TP</span><span>🐉 {s.dragonBalls}/7</span>
            {s.godMode && <span className="rounded border border-destructive px-2 py-0.5 text-xs text-destructive">GOD MODE</span>}
            {slot === "sandbox" && <span className="rounded border border-chart-1 px-2 py-0.5 text-xs text-chart-1">SANDBOX</span>}
          </div>
        </header>

        <div className="mb-4 grid items-center gap-4 rounded-xl border border-border bg-card/70 p-4 backdrop-blur md:grid-cols-[auto_1fr]">
          <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
            {(form.id !== "base" || s.darkAura) && <div className="aura absolute inset-0 rounded-full" style={{ background: s.darkAura ? "oklch(0.45 0.2 300)" : form.aura, boxShadow: `0 0 60px 20px ${s.darkAura ? "oklch(0.45 0.2 300)" : form.aura}` }} />}
            <span className="relative text-6xl">🥋</span>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">{form.name} • {loc.name} ×{loc.mult}</div>
            <div className="font-display text-5xl text-foreground">Power Level {fmt(powerLevel(s))}</div>
            <div className="mt-1 flex flex-wrap gap-4 text-sm">
              <span>💪 STR {fmt(s.stats.strength)}</span><span>⚡ AGI {fmt(s.stats.agility)}</span>
              <span>🔥 KI {fmt(s.stats.ki)}</span><span>🛡 DEF {fmt(s.stats.defense)}</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm"><span className="w-20">Stamina</span><Bar value={s.stamina} max={s.maxStamina} className="bg-chart-2" /><span className="w-24 text-right">{Math.floor(s.stamina)}/{s.maxStamina}</span></div>
          </div>
        </div>

        <nav className="mb-4 flex gap-2 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-2 font-display text-lg ${tab === t ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{t}</button>
          ))}
        </nav>

        {recoveredFromBackup && (
          <div role="alert" className="mb-4 rounded-lg border border-chart-1 bg-secondary p-3 text-sm text-chart-1">
            ⚠ Your main save could not be read, so a recovered backup was loaded. Your most recent play may be missing — export a backup from the God Engine (Ctrl+Shift+A) to protect it.
          </div>
        )}

        {tab === "Train" && <TrainTab />}
        {tab === "Battle" && <BattleTab customBoss={customBoss} />}
        {tab === "Forms" && <FormsTab />}
        {tab === "Quests" && <QuestsTab />}
        {tab === "Shop" && <ShopTab />}
        {tab === "Tournament" && <TournamentTab onFight={(b) => { setCustomBoss({ ...b }); setTab("Battle"); }} />}
      </div>
      {admin && <AdminPanel onClose={() => setAdmin(false)} onSpawn={(b) => { setCustomBoss({ ...b }); setTab("Battle"); }} />}
    </div>
  );
}
