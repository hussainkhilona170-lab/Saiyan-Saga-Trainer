// GOD ENGINE — the command center. Every control is wired to real APIs; nothing is decorative.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LOCATIONS, QUESTS, SAGA_ORDER, TOURNAMENT, RAID_BOSSES, BOSSES, fmt, type Boss } from "./data";
import { allForms, applyAction, CUSTOM_FORM_MAX_MULT, findForm, gravMult, powerLevel, questSummary, sagaStatus, type GameState } from "./engine";
import { executeAdminAction, adminActionRequiresConfirmation, inspectPlayer, adminModeOf, recordAdminEvent, type AdminAction } from "./admin";
import { parseAdminCommand, consoleSuggestions } from "./adminConsole";
import { simulateBossFight } from "./battleSim";
import { buildBossFromId, bossIdSuggestions } from "./bossLibrary";
import { createScenario, parseScenarioList, serializeScenarioList, applyScenarioBuild, scenarioSummary, SCENARIOS_KEY, type Scenario } from "./scenarios";
import { createSnapshot, parseSnapshotList, SNAPSHOTS_KEY, type Snapshot } from "./snapshots";
import { exportSlotText, backupKey, slotKey, resolveInitialLoad } from "./persistence";
import { sendBattleCommand, isBattleLive } from "./battleBus";
import { Card, Btn } from "./ui";
import { useGame } from "./store";

type Section =
  | "overview" | "player" | "forms" | "battle" | "enemy" | "progression" | "quests" | "world"
  | "techniques" | "scenarios" | "console" | "inspector" | "snapshots" | "tester" | "events" | "system";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "player", label: "Player Lab" },
  { id: "forms", label: "Transformation Lab" },
  { id: "battle", label: "Battle Control" },
  { id: "enemy", label: "Enemy & Boss Lab" },
  { id: "progression", label: "Progression" },
  { id: "quests", label: "Quest & Saga" },
  { id: "world", label: "World" },
  { id: "techniques", label: "Technique Creator" },
  { id: "scenarios", label: "Scenario Creator" },
  { id: "console", label: "Command Console" },
  { id: "inspector", label: "Live Inspector" },
  { id: "snapshots", label: "Snapshots" },
  { id: "tester", label: "Battle Tester" },
  { id: "events", label: "Event Log" },
  { id: "system", label: "Settings & Recovery" },
];

export function AdminPanel({ onClose, onSpawn }: { onClose: () => void; onSpawn: (b: Boss) => void }) {
  const { s, update, reset, switchSlot, restore, slot } = useGame();
  const [section, setSection] = useState<Section>("overview");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  const pushToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  }, []);

  const act = useCallback((action: AdminAction, skipConfirm = false) => {
    if (!skipConfirm && adminActionRequiresConfirmation(action)) {
      if (!window.confirm(`Confirm: ${action.type} — this cannot be undone.`)) return;
    }
    update((d) => {
      const result = executeAdminAction(d, action);
      pushToast(result.message);
    });
  }, [update, pushToast]);

  // Esc closes the panel (except while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)))) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mode = adminModeOf(s, slot);
  const modeClass = mode === "god" ? "border-destructive text-destructive" : mode === "sandbox" ? "border-chart-1 text-chart-1" : "border-border text-muted-foreground";
  const modeLabel = mode === "god" ? "GOD MODE" : mode === "sandbox" ? "SANDBOX MODE" : "REALITY MODE";

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-background/90 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden border-r-2 border-primary/50 bg-card md:flex-row" onClick={(e) => e.stopPropagation()}>
        {/* Left rail */}
        <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-border bg-secondary/40 p-2 md:w-48 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r md:p-2">
          <div className="hidden md:block">
            <div className="px-2 pt-2 font-display text-xl text-primary">⚙ GOD ENGINE</div>
            <div className={`mx-2 mt-1 rounded border px-2 py-0.5 text-center font-display text-xs ${modeClass}`}>{modeLabel}</div>
            <div className="mx-2 mb-2 mt-1 text-[10px] text-muted-foreground">Slot: {slot === "main" ? "main (REALITY)" : "sandbox (SANDBOX)"}</div>
          </div>
          {SECTIONS.map((item) => (
            <button key={item.id} onClick={() => setSection(item.id)} className={`whitespace-nowrap rounded px-2 py-2 text-left font-display text-sm transition md:px-3 ${section === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>{item.label}</button>
          ))}
          <button onClick={onClose} className="whitespace-nowrap rounded border border-destructive/50 px-2 py-2 text-left font-display text-sm text-destructive hover:bg-destructive/10 md:mt-auto md:px-3">Close ✕</button>
        </nav>
        {/* Content */}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3 md:p-4">
          {section === "overview" && <OverviewSection s={s} act={act} slot={slot} />}
          {section === "player" && <PlayerSection s={s} act={act} />}
          {section === "forms" && <TransformationSection s={s} act={act} update={update} />}
          {section === "battle" && <BattleControlSection s={s} onSpawn={onSpawn} />}
          {section === "enemy" && <EnemySection s={s} onSpawn={onSpawn} />}
          {section === "progression" && <ProgressionSection s={s} act={act} />}
          {section === "quests" && <QuestControlSection s={s} act={act} />}
          {section === "world" && <WorldSection s={s} act={act} />}
          {section === "techniques" && <TechniqueSection s={s} update={update} pushToast={pushToast} />}
          {section === "scenarios" && <ScenarioSection s={s} update={update} onSpawn={onSpawn} pushToast={pushToast} />}
          {section === "console" && <ConsoleSection s={s} update={update} pushToast={pushToast} onSpawn={onSpawn} />}
          {section === "inspector" && <InspectorSection s={s} update={update} pushToast={pushToast} act={act} />}
          {section === "snapshots" && <SnapshotsSection s={s} slot={slot} restore={restore} />}
          {section === "tester" && <BattleTesterSection s={s} />}
          {section === "events" && <EventLogSection s={s} update={update} />}
          {section === "system" && <SystemSection s={s} slot={slot} switchSlot={switchSlot} reset={reset} restore={restore} update={update} pushToast={pushToast} />}
        </div>
      </div>
      {toast && <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded border border-chart-2 bg-background/95 px-4 py-2 font-display text-sm text-chart-2 shadow-lg" role="status">{toast}</div>}
    </div>
  );
}

/* ---------- Overview ---------- */

function OverviewSection({ s, act, slot }: { s: GameState; act: (a: AdminAction) => void; slot: string }) {
  const loc = LOCATIONS.find((l) => l.id === s.location);
  const recent = [...s.adminEvents].reverse().slice(0, 6);
  return (
    <div className="space-y-3">
      <h2 className="font-display text-2xl">Command Overview</h2>
      <Card>
        <div className="grid gap-2 md:grid-cols-3">
          <div><div className="text-xs text-muted-foreground">Power Level</div><div className="font-display text-3xl text-primary">{fmt(powerLevel(s))}</div></div>
          <div><div className="text-xs text-muted-foreground">Level · Form</div><div className="font-display text-xl">Lv {s.level} · {findForm(s, s.activeForm)?.name ?? s.activeForm}</div></div>
          <div><div className="text-xs text-muted-foreground">Location</div><div className="font-display text-xl">{loc?.name ?? s.location}</div></div>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          <span>💰 {fmt(s.zeni)}</span><span>🏅 {fmt(s.tp)} TP</span><span>🐉 {s.dragonBalls}/7</span><span>⚡ {Math.floor(s.stamina)}/{s.maxStamina}</span>
        </div>
      </Card>
      <Card>
        <div className="font-display text-lg">Operating overrides</div>
        <p className="text-xs text-muted-foreground">Each override is independent and reversible.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Btn className={s.godMode ? "bg-destructive" : ""} onClick={() => act({ type: "SET_GOD_MODE", flag: !s.godMode })}>God Mode: {s.godMode ? "ON" : "OFF"}</Btn>
          <Btn className={s.infiniteKi ? "bg-chart-1" : ""} onClick={() => act({ type: "SET_INFINITE_KI", flag: !s.infiniteKi })}>Infinite Ki: {s.infiniteKi ? "ON" : "OFF"}</Btn>
          <Btn className={s.infiniteZeni ? "bg-chart-2" : ""} onClick={() => act({ type: "SET_INFINITE_ZENI", flag: !s.infiniteZeni })}>Infinite Zeni: {s.infiniteZeni ? "ON" : "OFF"}</Btn>
          <Btn onClick={() => act({ type: "SET_STAMINA", value: s.maxStamina })}>Refill Stamina</Btn>
        </div>
      </Card>
      <Card>
        <div className="font-display text-lg">Recent developer actions</div>
        {recent.length === 0 ? <p className="text-sm text-muted-foreground">No admin actions recorded yet.</p> : (
          <ul className="mt-1 space-y-1 text-xs">
            {recent.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 border-b border-border pb-1">
                <span><span className="text-chart-1">{e.action}</span> · {e.target} → {e.newValue}</span>
                <span className="text-muted-foreground">{new Date(e.at).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <div className="font-display text-lg">System health</div>
        <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
          <span>Save slot: <b className="text-foreground">{slot === "main" ? "main (REALITY)" : "sandbox (SANDBOX)"}</b></span>
          <span>Battle live: <b className="text-foreground">{isBattleLive() ? "yes" : "no"}</b></span>
          <span>Forms discovered: <b className="text-foreground">{s.forms.length}/{allForms(s).length}</b></span>
          <span>Custom techniques: <b className="text-foreground">{s.customTechniques.length}</b></span>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Player Lab ---------- */

const row = "flex items-center justify-between gap-2 border-b border-border py-1.5";
const field = "w-28 rounded bg-input px-2 py-1 text-right text-foreground";

function PlayerSection({ s, act }: { s: GameState; act: (a: AdminAction, skipConfirm?: boolean) => void }) {
  const stats: [string, "strength" | "agility" | "ki" | "defense"][] = [["Strength", "strength"], ["Agility", "agility"], ["Ki", "ki"], ["Defense", "defense"]];
  const step = (stepVal: number, k: "strength" | "agility" | "ki" | "defense") => act({ type: "ADD_STAT", stat: k, delta: stepVal });
  return (
    <div className="space-y-1">
      <h2 className="font-display text-2xl">Player Lab</h2>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-display text-xl">Power Level: <span className="text-primary">{fmt(powerLevel(s))}</span></div>
          <div className="flex gap-1">
            <Btn onClick={() => act({ type: "SET_POWER_LEVEL", target: powerLevel(s) * 10 })}>PL ×10</Btn>
            <Btn onClick={() => { const stats: ("strength" | "agility" | "ki" | "defense")[] = ["strength", "agility", "ki", "defense"]; for (const k of stats) act({ type: "SET_STAT", stat: k, value: 1e6 }, true); }}>God Build</Btn>
            <Btn onClick={() => { const stats: ("strength" | "agility" | "ki" | "defense")[] = ["strength", "agility", "ki", "defense"]; for (const k of stats) act({ type: "SET_STAT", stat: k, value: 100 }); }}>Balanced 100</Btn>
          </div>
        </div>
      </Card>
      {stats.map(([label, k]) => (
        <div key={k} className={row}>
          <span className="flex items-center gap-2">{label} <span className="text-xs text-muted-foreground">({Math.floor(s.mastery[k])}% mastery)</span></span>
          <div className="flex items-center gap-1">
            <button className="rounded bg-muted px-2 py-0.5" onClick={() => step(-10, k)}>−10</button>
            <input type="number" min={0} aria-label={label} className={field} value={Math.floor(s.stats[k])} onChange={(e) => act({ type: "SET_STAT", stat: k, value: Math.max(0, +e.target.value || 0) })} />
            <button className="rounded bg-muted px-2 py-0.5" onClick={() => step(10, k)}>+10</button>
            <button className="rounded bg-muted px-2 py-0.5" onClick={() => step(1000, k)}>+1K</button>
          </div>
        </div>
      ))}
      <div className={row}><span>Level</span><input type="number" min={1} max={100} className={field} value={s.level} onChange={(e) => act({ type: "SET_LEVEL", level: Math.max(1, Math.min(100, Math.floor(+e.target.value || 1))) })} /></div>
      <div className={row}><span>XP</span><input type="number" min={0} className={field} value={Math.floor(s.xp)} onChange={(e) => act({ type: "SET_XP", xp: Math.max(0, Math.floor(+e.target.value || 0)) })} /></div>
      <div className={row}><span>Stamina</span><div className="flex items-center gap-1"><input type="number" min={0} className={field} value={Math.floor(s.stamina)} onChange={(e) => act({ type: "SET_STAMINA", value: Math.max(0, +e.target.value || 0) })} /><Btn onClick={() => act({ type: "SET_STAMINA", value: s.maxStamina })}>Max</Btn></div></div>
      <div className={row}><span>Zeni</span><input type="number" min={0} className={field} value={Math.floor(s.zeni)} onChange={(e) => act({ type: "SET_ZENI", amount: Math.max(0, Math.floor(+e.target.value || 0)) })} /></div>
      <div className={row}><span>TP Medals</span><input type="number" min={0} className={field} value={Math.floor(s.tp)} onChange={(e) => act({ type: "SET_TP", amount: Math.max(0, Math.floor(+e.target.value || 0)) })} /></div>
      <div className={row}><span>Gravity</span><input type="number" min={1} max={1000} className={field} value={s.gravity} onChange={(e) => act({ type: "SET_GRAVITY", gravity: Math.max(1, Math.min(1000, Math.floor(+e.target.value || 1))) })} /></div>
      <div className={row}><span>Dragon Balls</span><input type="number" min={0} max={7} className={field} value={s.dragonBalls} onChange={(e) => act({ type: "SET_DRAGON_BALLS", count: Math.max(0, Math.min(7, Math.floor(+e.target.value || 0))) })} /></div>
      {stats.map(([label, k]) => (
        <div key={k} className={row}><span>Mastery · {label}</span><input type="number" min={0} max={100} className={field} value={Math.floor(s.mastery[k])} onChange={(e) => act({ type: "SET_MASTERY", stat: k, value: Math.max(0, Math.min(100, +e.target.value || 0)) })} /></div>
      ))}
      <div className="grid grid-cols-2 gap-2 pt-2">
        <Btn onClick={() => act({ type: "ADD_ZENI", amount: 1e9 })}>+1B Zeni</Btn>
        <Btn onClick={() => act({ type: "ADD_TP", amount: 1000 })}>+1000 TP</Btn>
      </div>
    </div>
  );
}

/* ---------- Transformation Lab ---------- */

function TransformationSection({ s, act, update }: { s: GameState; act: (a: AdminAction) => void; update: (fn: (d: GameState) => void) => void }) {
  const [a, setA] = useState("base");
  const [b, setB] = useState("ssj4");
  const formA = findForm(s, a), formB = findForm(s, b);
  const [name, setName] = useState("Super Saiyan Rosé");
  const [mult, setMult] = useState(300);
  const [aura, setAura] = useState("#ff4fa3");
  return (
    <div className="space-y-3">
      <h2 className="font-display text-2xl">Transformation Lab</h2>
      <div className="flex flex-wrap gap-2">
        <Btn onClick={() => act({ type: "UNLOCK_ALL_FORMS" })}>Unlock all forms</Btn>
        <Btn onClick={() => act({ type: "LOCK_ALL_FORMS" })}>Lock all → Base</Btn>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {allForms(s).map((f) => {
          const owned = s.forms.includes(f.id);
          return (
            <div key={f.id} className={`${row} ${s.activeForm === f.id ? "border-chart-2" : ""}`}>
              <div className="flex items-center gap-2"><span className="h-5 w-5 rounded-full border border-border" style={{ background: f.aura }} /><span>{f.name} <span className="text-xs text-muted-foreground">×{fmt(f.mult)}</span></span></div>
              <div className="flex gap-1">
                {owned ? (
                  <>
                    <Btn className={s.activeForm === f.id ? "bg-chart-2 text-primary-foreground" : ""} onClick={() => act({ type: "SET_ACTIVE_FORM", formId: f.id })}>{s.activeForm === f.id ? "Active" : "Set"}</Btn>
                    {f.id !== "base" && <Btn className="bg-muted text-foreground" onClick={() => act({ type: "LOCK_FORM", formId: f.id })}>Lock</Btn>}
                  </>
                ) : (
                  <Btn onClick={() => act({ type: "UNLOCK_FORM_ADMIN", formId: f.id })}>Unlock</Btn>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <Card>
        <div className="font-display">Form comparison</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
          <select className="rounded bg-input px-2 py-1" value={a} onChange={(e) => setA(e.target.value)} aria-label="Form A">{allForms(s).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
          <span>vs</span>
          <select className="rounded bg-input px-2 py-1" value={b} onChange={(e) => setB(e.target.value)} aria-label="Form B">{allForms(s).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
        </div>
        {formA && formB && (
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="text-muted-foreground">Stat</div><div>{formA.name}</div><div>{formB.name}</div>
            <div className="text-left text-muted-foreground">Multiplier</div><div className="font-display text-primary">×{fmt(formA.mult)}</div><div className="font-display text-primary">×{fmt(formB.mult)}</div>
            <div className="text-left text-muted-foreground">Your PL in form</div><div>{fmt(Math.floor((s.stats.strength + s.stats.agility + s.stats.ki + s.stats.defense) * gravMult(s) * formA.mult * 10))}</div><div>{fmt(Math.floor((s.stats.strength + s.stats.agility + s.stats.ki + s.stats.defense) * gravMult(s) * formB.mult * 10))}</div>
          </div>
        )}
      </Card>
      <Card>
        <div className="font-display">Custom transformation creator</div>
        <div className="mt-1 grid items-end gap-2 sm:grid-cols-[2fr_2fr_1fr_auto]">
          <input className="rounded bg-input px-2 py-1" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} aria-label="Form name" />
          <label className="text-xs">Power ×{fmt(mult)}<input type="range" min={1} max={CUSTOM_FORM_MAX_MULT} value={mult} onChange={(e) => setMult(+e.target.value)} className="w-full" /></label>
          <input type="color" value={aura} onChange={(e) => setAura(e.target.value)} className="h-9 w-full rounded" aria-label="Aura color" />
          <Btn disabled={!name.trim()} onClick={() => {
            const id = `custom-${Date.now()}`;
            update((d) => {
              applyAction(d, { type: "CREATE_FORM", id, name, mult, aura, hair: aura });
              recordAdminEvent(d, "CREATE_FORM", name.trim(), "", `×${mult}`, "ok");
            });
          }}>Create</Btn>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Custom forms persist in your save and work in the arena immediately.</p>
      </Card>
    </div>
  );
}

/* ---------- Battle Control (live battle) ---------- */

function BattleControlSection({ s, onSpawn }: { s: GameState; onSpawn: (b: Boss) => void }) {
  const [customName, setCustomName] = useState("The Tempest");
  const [customHp, setCustomHp] = useState("5000000");
  const [customAtk, setCustomAtk] = useState("200000");
  return (
    <div className="space-y-3">
      <h2 className="font-display text-2xl">Battle Control</h2>
      <Card>
        <div className="font-display">Spawn roster boss instantly</div>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BOSSES.map((b) => <Btn key={b.id} onClick={() => onSpawn({ ...b })}>{b.emoji} {b.name}</Btn>)}
        </div>
      </Card>
      <Card>
        <div className="font-display">Custom boss creator</div>
        <div className="mt-1 grid grid-cols-3 gap-2">
          <input className="rounded bg-input px-2 py-1" value={customName} onChange={(e) => setCustomName(e.target.value)} aria-label="Boss name" />
          <input type="number" min={1} className="rounded bg-input px-2 py-1" value={customHp} onChange={(e) => setCustomHp(e.target.value)} aria-label="Boss HP" />
          <input type="number" min={0} className="rounded bg-input px-2 py-1" value={customAtk} onChange={(e) => setCustomAtk(e.target.value)} aria-label="Boss ATK" />
        </div>
        <Btn className="mt-2 w-full" onClick={() => onSpawn({ id: `custom-boss-${Date.now()}`, name: customName || "Mystery Foe", hp: Math.max(1, Math.floor(+customHp || 1)), atk: Math.max(0, Math.floor(+customAtk || 0)), zeni: Math.floor((+customHp || 1) / 10), tp: 50, req: 0, emoji: "👹" })}>Spawn custom boss</Btn>
      </Card>
      <Card>
        <div className="font-display">Live battle overrides</div>
        <p className="mb-1 text-xs text-muted-foreground">Applies to the fight currently running in the Battle tab.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Btn onClick={() => sendBattleCommand({ type: "FORCE_WIN" })}>Instant Kill</Btn>
          <Btn onClick={() => sendBattleCommand({ type: "HEAL_PLAYER" })}>Heal Player</Btn>
          <Btn onClick={() => sendBattleCommand({ type: "SET_BOSS_HP", pct: 0.01 })}>Boss → 1% HP</Btn>
          <Btn onClick={() => sendBattleCommand({ type: "SET_BOSS_HP", pct: 0.5 })}>Boss → 50% HP</Btn>
          <Btn onClick={() => sendBattleCommand({ type: "REFILL_KI" })}>Refill Ki</Btn>
          <Btn onClick={() => sendBattleCommand({ type: "FORCE_CLASH" })}>Force Beam Clash</Btn>
          <Btn onClick={() => sendBattleCommand({ type: "FORCE_FLEE" })}>Force Flee</Btn>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{isBattleLive() ? "✔ A battle is live — overrides will land immediately." : "No live battle. Start a fight in the Battle tab first."}</p>
      </Card>
    </div>
  );
}

/* ---------- Enemy & Boss Lab ---------- */

function EnemySection({ s, onSpawn }: { s: GameState; onSpawn: (b: Boss) => void }) {
  const [wave, setWave] = useState(5);
  const [modifier, setModifier] = useState<"none" | "aggression" | "heavyweight">("none");
  return (
    <div className="space-y-3">
      <h2 className="font-display text-2xl">Enemy & Boss Lab</h2>
      <Card>
        <div className="font-display">Endless Survival wave</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input type="number" min={1} max={9999} className="w-20 rounded bg-input px-2 py-1" value={wave} onChange={(e) => setWave(Math.max(1, Math.min(9999, Math.floor(+e.target.value || 1))))} aria-label="Wave" />
          {(["none", "aggression", "heavyweight"] as const).map((m) => (
            <button key={m} onClick={() => setModifier(m)} className={`rounded border px-2 py-1 text-sm ${modifier === m ? "border-primary text-primary" : "border-border"}`}>{m}</button>
          ))}
          <Btn onClick={() => { const boss = buildBossFromId(`endless-${wave}`); if (boss) onSpawn({ ...boss, endlessModifier: modifier, atk: modifier === "aggression" ? Math.floor(boss.atk * 1.5) : boss.atk, hp: modifier === "heavyweight" ? Math.floor(boss.hp * 1.5) : boss.hp, zeni: modifier === "none" ? boss.zeni : boss.zeni * 2, tp: modifier === "none" ? boss.tp : boss.tp * 2 }); }}>Spawn Wave {wave}</Btn>
        </div>
      </Card>
      <Card>
        <div className="font-display">Raid Bosses</div>
        <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {RAID_BOSSES.map((raid) => (
            <Btn key={raid.id} onClick={() => onSpawn({ ...raid.base })}>{raid.emoji} {raid.name}</Btn>
          ))}
        </div>
      </Card>
      <Card>
        <div className="font-display">Tournament Queens</div>
        <p className="mb-1 text-xs text-muted-foreground">Spawn any bracket round, starting at its tournament HP/ATK scaling.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TOURNAMENT.map((round, i) => <Btn key={round.id} onClick={() => { const boss = buildBossFromId(`tournament-${round.id}`); if (boss) onSpawn(boss); }}>Round {i + 1} — {round.name}</Btn>)}
        </div>
      </Card>
      <Card>
        <div className="font-display">Boss defeat flags</div>
        <div className="mt-1 space-y-1">
          {BOSSES.map((b) => {
            const done = s.defeated.includes(b.id);
            return <div key={b.id} className={row}><span>{b.emoji} {b.name}</span><Btn onClick={() => onSpawn({ ...b })}>{done ? "Rematch" : "Fight"}</Btn></div>;
          })}
        </div>
      </Card>
    </div>
  );
}

/* ---------- Progression Editor ---------- */

function ProgressionSection({ s, act }: { s: GameState; act: (a: AdminAction) => void }) {
  const [plTarget, setPlTarget] = useState("1000000");
  const [survival, setSurvival] = useState(String(s.survivalBest));
  return (
    <div className="space-y-3">
      <h2 className="font-display text-2xl">Progression Editor</h2>
      <Card>
        <div className="text-sm text-muted-foreground">Current Power Level: <span className="font-display text-primary">{fmt(powerLevel(s))}</span></div>
        <div className="mt-1 flex items-center gap-2">
          <input className="w-40 rounded bg-input px-2 py-1" type="number" min={0} value={plTarget} onChange={(e) => setPlTarget(e.target.value)} aria-label="Power Level target" />
          <Btn onClick={() => act({ type: "SET_POWER_LEVEL", target: Math.max(0, Math.floor(+plTarget || 0)) })}>Scale stats to PL</Btn>
        </div>
      </Card>
      <Card>
        <div className="font-display">Dragon Balls</div>
        <div className="mt-1 flex flex-wrap gap-2">
          <Btn onClick={() => act({ type: "SET_DRAGON_BALLS", count: Math.min(7, s.dragonBalls + 1) })}>+1</Btn>
          <Btn onClick={() => act({ type: "SET_DRAGON_BALLS", count: Math.max(0, s.dragonBalls - 1) })}>−1</Btn>
          <Btn onClick={() => act({ type: "SET_DRAGON_BALLS", count: 7 })}>Set 7</Btn>
          <Btn onClick={() => act({ type: "SET_DRAGON_BALLS", count: 0 })}>Set 0</Btn>
        </div>
      </Card>
      <Card>
        <div className="font-display">Endless Survival record</div>
        <div className="mt-1 flex items-center gap-2">
          <input type="number" min={0} max={9999} className="w-20 rounded bg-input px-2 py-1" value={survival} onChange={(e) => setSurvival(e.target.value)} aria-label="Best wave" />
          <Btn onClick={() => act({ type: "SET_SURVIVAL_BEST", wave: Math.max(0, Math.floor(+survival || 0)) })}>Save best</Btn>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Waves are pure combat — this only edits the record.</p>
      </Card>
      <Card>
        <div className="font-display">Training snapshot</div>
        <ul className="mt-1 grid grid-cols-2 gap-1 text-sm">
          <li>Strength: {fmt(s.stats.strength)} <span className="text-xs text-muted-foreground">({Math.floor(s.mastery.strength)}%)</span></li>
          <li>Agility: {fmt(s.stats.agility)} <span className="text-xs text-muted-foreground">({Math.floor(s.mastery.agility)}%)</span></li>
          <li>Ki: {fmt(s.stats.ki)} <span className="text-xs text-muted-foreground">({Math.floor(s.mastery.ki)}%)</span></li>
          <li>Defense: {fmt(s.stats.defense)} <span className="text-xs text-muted-foreground">({Math.floor(s.mastery.defense)}%)</span></li>
          <li>Level: {s.level} <span className="text-xs text-muted-foreground">({fmt(s.xp)} XP)</span></li>
          <li>Gravity: {s.gravity}× <span className="text-xs text-muted-foreground">(×{gravMult(s).toFixed(2)})</span></li>
        </ul>
      </Card>
    </div>
  );
}

/* ---------- Quest & Saga Control ---------- */

function QuestControlSection({ s, act }: { s: GameState; act: (a: AdminAction) => void }) {
  return (
    <div className="space-y-2">
      <h2 className="font-display text-2xl">Quest & Saga Control</h2>
      <div className="flex flex-wrap gap-2">
        <Btn onClick={() => act({ type: "COMPLETE_QUEST", questId: "all" })}>Complete & claim all</Btn>
        <Btn className="bg-muted text-foreground" onClick={() => act({ type: "RESET_QUEST", questId: "all" })}>Reset all claims</Btn>
      </div>
      {QUESTS.map((q) => {
        const claimed = s.quests.includes(q.id);
        const done = questSummary(s, q.id)?.done;
        return (
          <div key={q.id} className={`${row} ${claimed ? "opacity-60" : ""}`}>
            <div><div className="font-display">{q.id} · {q.title}</div><div className="text-xs text-muted-foreground">{q.saga} · {fmt(q.zeni)} Zeni · {q.tp} TP</div></div>
            <div className="flex gap-1">
              {claimed ? (
                <Btn className="bg-muted text-foreground" onClick={() => act({ type: "RESET_QUEST", questId: q.id })}>Reset</Btn>
              ) : (
                <Btn disabled={!done} onClick={() => act({ type: "COMPLETE_QUEST", questId: q.id })}>{done ? "Claim" : "Not ready"}</Btn>
              )}
            </div>
          </div>
        );
      })}
      <Card>
        <div className="font-display">Saga bonuses</div>
        <div className="mt-1 flex flex-wrap gap-2">
          {SAGA_ORDER.map((saga) => {
            const status = sagaStatus(s, saga);
            return (
              <div key={saga} className={`rounded border px-2 py-1 text-sm ${status.bonusClaimed ? "border-chart-2 text-chart-2" : status.complete ? "border-primary" : "border-border"}`}>
                <div>{saga}</div>
                <div className="text-xs text-muted-foreground">{status.claimed}/{status.total}</div>
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Saga bonuses are claimed on the Quests tab once every quest in the saga is done.</p>
      </Card>
    </div>
  );
}

/* ---------- World Control ---------- */

function WorldSection({ s, act }: { s: GameState; act: (a: AdminAction) => void }) {
  const pl = powerLevel(s);
  return (
    <div className="space-y-3">
      <h2 className="font-display text-2xl">World Control</h2>
      <Card>
        <div className="font-display">Teleport</div>
        <div className="mt-1 flex flex-wrap gap-2">
          {LOCATIONS.map((loc) => (
            <Btn key={loc.id} onClick={() => act({ type: "TELEPORT", locationId: loc.id })}>{s.location === loc.id ? `${loc.name} ✓` : loc.name}{pl < loc.req ? ` (Lv gate ${fmt(loc.req)} — bypassed)` : ""}</Btn>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">God Engine teleports bypass location gates — the normal PL requirement is displayed for reference only.</p>
      </Card>
      <Card>
        <div className="font-display">World snapshot</div>
        <ul className="mt-1 text-sm text-muted-foreground space-y-1">
          <li>🐉 Dragon Balls: {s.dragonBalls}/7</li>
          <li>🥋 Tournament bracket: {s.tournamentRound}/{TOURNAMENT.length} rounds cleared</li>
          <li>🧭 Endless Survival best: Wave {s.survivalBest}</li>
          <li>✅ Bosses defeated: {s.defeated.length} ({s.defeated.join(", ") || "none"})</li>
        </ul>
      </Card>
    </div>
  );
}

/* ---------- Technique Creator ---------- */

function TechniqueSection({ s, update, pushToast }: { s: GameState; update: (fn: (d: GameState) => void) => void; pushToast: (m: string) => void }) {
  const [name, setName] = useState("Super Nova Fist");
  const [desc, setDesc] = useState("A devastating light-palm strike");
  const [scale, setScale] = useState<"ki" | "strength" | "agility" | "defense">("ki");
  const [mult, setMult] = useState(2.5);
  const [kiCost, setKiCost] = useState(35);
  const [cooldownMs, setCooldownMs] = useState(1200);
  const [aura, setAura] = useState("#ffd166");
  const formMultNow = (findForm(s, s.activeForm)?.mult ?? 1) * gravMult(s);
  const statNow = scale === "ki" ? s.stats.ki : scale === "strength" ? s.stats.strength : scale === "agility" ? s.stats.agility : s.stats.defense;
  const estimated = Math.floor(statNow * mult * formMultNow);
  return (
    <div className="space-y-3">
      <h2 className="font-display text-2xl">Technique Creator</h2>
      <Card>
        <div className="font-display">Design a new technique</div>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          <input className="rounded bg-input px-2 py-1" placeholder="Name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} aria-label="Technique name" />
          <input className="rounded bg-input px-2 py-1" placeholder="Description" maxLength={200} value={desc} onChange={(e) => setDesc(e.target.value)} aria-label="Technique description" />
          <label className="text-sm">Scaling stat
            <select className="ml-2 rounded bg-input px-2 py-1" value={scale} onChange={(e) => setScale(e.target.value as typeof scale)} aria-label="Scaling stat">
              <option value="ki">Ki</option><option value="strength">Strength</option><option value="agility">Agility</option><option value="defense">Defense</option>
            </select>
          </label>
          <label className="text-sm">Power ×{mult.toFixed(1)}<input type="range" min={0.5} max={20} step={0.5} value={mult} onChange={(e) => setMult(+e.target.value)} className="mt-1 block w-full" /></label>
          <label className="text-sm">Ki cost {kiCost}<input type="range" min={0} max={100} value={kiCost} onChange={(e) => setKiCost(+e.target.value)} className="mt-1 block w-full" /></label>
          <label className="text-sm">Cooldown {(cooldownMs / 1000).toFixed(1)}s<input type="range" min={0} max={15000} step={100} value={cooldownMs} onChange={(e) => setCooldownMs(+e.target.value)} className="mt-1 block w-full" /></label>
          <label className="flex items-center gap-2 text-sm">Aura<input type="color" value={aura} onChange={(e) => setAura(e.target.value)} className="h-9 w-16 rounded" /></label>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Estimated damage in your current build: <span className="font-display text-chart-2">≈ {fmt(estimated)}</span> (×2 if EXPOSED)</span>
          <Btn disabled={!name.trim()} onClick={() => {
            update((d) => {
              d.customTechniques.push({ id: `custom-tech-${Date.now()}`, name: name.trim(), desc: desc.trim(), scale, mult, kiCost, cooldownMs, aura });
              recordAdminEvent(d, "CREATE_TECHNIQUE", name.trim(), "", `${scale} ×${mult} · ${kiCost} Ki`, "ok");
            });
            pushToast(`Technique "${name.trim()}" created — cast it from the Custom row in battle.`);
          }}>Create technique</Btn>
        </div>
      </Card>
      <div className="space-y-2">
        {s.customTechniques.length === 0 && <p className="text-sm text-muted-foreground">No custom techniques yet.</p>}
        {s.customTechniques.map((tech) => (
          <div key={tech.id} className={row}>
            <div>
              <div className="font-display"><span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ background: tech.aura }} />{tech.name}</div>
              <div className="text-xs text-muted-foreground">{tech.scale} ×{tech.mult} · {tech.kiCost} Ki · {(tech.cooldownMs / 1000).toFixed(1)}s cd · {tech.desc}</div>
            </div>
            <Btn className="bg-muted text-foreground" onClick={() => update((d) => { d.customTechniques = d.customTechniques.filter((t) => t.id !== tech.id); recordAdminEvent(d, "DELETE_TECHNIQUE", tech.name, `${tech.scale} ×${tech.mult}`, "deleted", "ok"); })}>Delete</Btn>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Custom techniques cast from the "Custom" row under the battle action bar. They obey Ki costs, cooldowns and EXPOSED doubling.</p>
    </div>
  );
}

/* ---------- Scenario Creator ---------- */

function ScenarioSection({ s, update, onSpawn, pushToast }: { s: GameState; update: (fn: (d: GameState) => void) => void; onSpawn: (b: Boss) => void; pushToast: (m: string) => void }) {
  const [scenarios, setScenarios] = useState<Scenario[]>(() => {
    try { return parseScenarioList(localStorage.getItem(SCENARIOS_KEY) ?? "[]"); } catch { return []; }
  });
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [bossId, setBossId] = useState("raditz");
  const [importText, setImportText] = useState("");
  const [error, setError] = useState("");
  const persist = (list: Scenario[]) => {
    setScenarios(list);
    try { localStorage.setItem(SCENARIOS_KEY, serializeScenarioList(list)); } catch { /* storage unavailable */ }
  };
  const bossOptions = bossIdSuggestions();
  return (
    <div className="space-y-3">
      <h2 className="font-display text-2xl">Scenario Creator</h2>
      <Card>
        <div className="font-display">Capture current build</div>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          <input className="rounded bg-input px-2 py-1" placeholder="Scenario name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} aria-label="Scenario name" />
          <select className="rounded bg-input px-2 py-1" value={bossId} onChange={(e) => setBossId(e.target.value)} aria-label="Boss id">{bossOptions.map((id) => <option key={id} value={id}>{id}</option>)}</select>
        </div>
        <input className="mt-2 w-full rounded bg-input px-2 py-1" placeholder="Notes (optional)" maxLength={200} value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" />
        <Btn className="mt-2" disabled={!name.trim()} onClick={() => persist([...scenarios, createScenario(s, name, bossId, notes)].slice(-50))}>Save scenario</Btn>
      </Card>
      <div className="space-y-2">
        {scenarios.length === 0 && <p className="text-sm text-muted-foreground">No scenarios saved yet.</p>}
        {[...scenarios].reverse().map((sc) => (
          <div key={sc.id} className={row}>
            <div><div className="font-display">{sc.name}</div><div className="text-xs text-muted-foreground">{scenarioSummary(sc)}{sc.notes ? ` · ${sc.notes}` : ""}</div></div>
            <div className="flex gap-1">
              <Btn onClick={() => {
                update((d) => { applyScenarioBuild(d, sc.build); });
                const boss = buildBossFromId(sc.bossId);
                if (boss) onSpawn(boss);
                pushToast(`Scenario "${sc.name}" applied — fight started.`);
              }}>Apply & Fight</Btn>
              <Btn className="bg-muted text-foreground" onClick={() => persist(scenarios.map((x) => x.id === sc.id ? { ...x, id: `sc-${Date.now()}` } : x))}>Duplicate</Btn>
              <Btn className="bg-muted text-foreground" onClick={() => persist(scenarios.filter((x) => x.id !== sc.id))}>Delete</Btn>
            </div>
          </div>
        ))}
      </div>
      <Card>
        <div className="flex items-center justify-between gap-2">
          <div className="font-display">Export / Import scenarios</div>
          <Btn onClick={() => {
            const blob = new Blob([JSON.stringify(scenarios, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "god-engine-scenarios.json";
            a.click();
            URL.revokeObjectURL(a.href);
          }}>Download JSON</Btn>
        </div>
        <textarea rows={4} value={importText} onChange={(e) => { setImportText(e.target.value); setError(""); }} placeholder="Paste scenarios JSON, then Import" aria-label="Scenario import" className="mt-1 w-full rounded bg-input p-2 font-mono text-xs" />
        {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
        <Btn className="mt-1" onClick={() => {
          const parsed = parseScenarioList(importText);
          if (parsed.length === 0) { setError("Import failed — unrecognized format. Wrapped JSON array of scenarios required."); return; }
          persist([...scenarios, ...parsed].slice(-50));
          setImportText("");
        }}>Import scenarios</Btn>
      </Card>
    </div>
  );
}

/* ---------- Command Console ---------- */

function ConsoleSection({ s, update, pushToast, onSpawn }: { s: GameState; update: (fn: (d: GameState) => void) => void; pushToast: (m: string) => void; onSpawn: (b: Boss) => void }) {
  const [cmd, setCmd] = useState("");
  const [output, setOutput] = useState<{ id: number; line: string; ok: boolean }[]>(() => {
    try { return JSON.parse(localStorage.getItem("db-god-console-log") ?? "[]"); } catch { return []; }
  });
  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("db-god-console-history") ?? "[]"); } catch { return []; }
  });
  const [historyIdx, setHistoryIdx] = useState(-1);
  const idRef = useRef(0);
  const print = useCallback((line: string, okLine: boolean) => {
    setOutput((prev) => {
      const next = [...prev, { id: ++idRef.current, line, ok: okLine }].slice(-80);
      try { localStorage.setItem("db-god-console-log", JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);
  const suggestions = consoleSuggestions(cmd).slice(0, 8);
  const showSuggestions = cmd.length >= 2 && suggestions.length > 0;
  const execute = useCallback(() => {
    const raw = cmd.trim();
    if (!raw) return;
    const result = parseAdminCommand(raw, s);
    let okLine = result.ok;
    if (result.action) {
      const needsConfirm = adminActionRequiresConfirmation(result.action);
      if (needsConfirm && !window.confirm(`Apply ${result.action.type}? This cannot be undone.`)) {
        print("Blocked — confirmation denied.", false);
        okLine = false;
      } else if (result.action.type === "SPAWN_BOSS") {
        const boss = buildBossFromId(result.action.bossId);
        if (boss) { onSpawn(boss); print(result.message, true); } else print("Unknown boss.", false);
      } else if (result.action.type === "SNAPSHOT_CREATE") {
        const snapName = (result.action as { name: string }).name;
        update((d) => {
          try {
            const snap = createSnapshot(d, snapName, "main");
            const rawList = localStorage.getItem(SNAPSHOTS_KEY);
            const list = rawList ? [...parseSnapshotList(rawList), snap].slice(-50) : [snap];
            localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(list));
          } catch { /* storage unavailable */ }
        });
        print(result.message, true);
      } else {
        update((d) => { const out = executeAdminAction(d, result.action!); print(out.message, out.ok); });
      }
    } else {
      print(result.message, okLine);
    }
    setHistory((h) => {
      const next = [raw, ...h.filter((x) => x !== raw)].slice(0, 50);
      try { localStorage.setItem("db-god-console-history", JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
    setCmd("");
    setHistoryIdx(-1);
  }, [cmd, s, update, print, onSpawn]);
  return (
    <div className="flex h-full flex-col space-y-2">
      <h2 className="font-display text-2xl">Command Console</h2>
      <div className="min-h-32 flex-1 overflow-y-auto rounded border border-border bg-black/40 p-2 font-mono text-xs">
        {output.length === 0 && <p className="text-muted-foreground">Type `help` to list every command. Nothing here executes real code — commands map to validated admin actions only.</p>}
        {output.map((entry) => (
          <div key={entry.id} className={entry.ok ? "text-chart-2" : "text-destructive"}>{entry.ok ? "› " : "✕ "}{entry.line}</div>
        ))}
      </div>
      <div className="relative">
        <input
          className="w-full rounded border border-primary/40 bg-input px-3 py-2 font-mono text-sm text-foreground"
          value={cmd}
          onChange={(e) => { setCmd(e.target.value); setHistoryIdx(-1); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); execute(); }
            else if (e.key === "ArrowUp") { e.preventDefault(); const idx = Math.min(history.length - 1, historyIdx + 1); setHistoryIdx(idx); if (idx >= 0) setCmd(history[idx]!); }
            else if (e.key === "ArrowDown") { e.preventDefault(); const idx = Math.max(-1, historyIdx - 1); setHistoryIdx(idx); setCmd(idx < 0 ? "" : history[idx]!); }
            else if (e.key === "Tab" && showSuggestions) { e.preventDefault(); setCmd(suggestions[0]!.name + " "); }
          }}
          placeholder="player.inspect — or type help"
          aria-label="God Engine console"
          autoFocus
        />
        {showSuggestions && (
          <div className="absolute bottom-full z-10 mb-1 w-full overflow-hidden rounded border border-border bg-card shadow-lg">
            {suggestions.map((sug) => (
              <button key={sug.name} className="flex w-full items-baseline gap-2 px-3 py-1 text-left text-xs hover:bg-secondary" onMouseDown={(e) => { e.preventDefault(); setCmd(sug.name + " "); }}>
                <span className="font-mono text-chart-1">{sug.name}</span>
                <span className="truncate text-muted-foreground">{sug.usage}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">⚠ Destructive commands require confirmation. Console history persists locally.</p>
        <button className="text-xs text-muted-foreground underline" onClick={() => { setOutput([]); try { localStorage.removeItem("db-god-console-log"); } catch { /* storage unavailable */ } }}>Clear output</button>
      </div>
    </div>
  );
}

/* ---------- Live State Inspector ---------- */

function InspectorSection({ s, update, pushToast, act }: { s: GameState; update: (fn: (d: GameState) => void) => void; pushToast: (m: string) => void; act: (a: AdminAction) => void }) {
  const copyState = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(s, null, 2)); pushToast("Full state copied to clipboard"); }
    catch { pushToast("Clipboard unavailable — check permissions"); }
  };
  const saveBytes = useMemo(() => {
    try { return (localStorage.getItem(slotKey("main")) ?? "").length; } catch { return -1; }
  }, []);
  const backupExists = useMemo(() => {
    try { return localStorage.getItem(backupKey("main")) !== null; } catch { return false; }
  }, []);
  return (
    <div className="space-y-3">
      <h2 className="font-display text-2xl">Live State Inspector</h2>
      <Card>
        <div className="flex items-center justify-between gap-2">
          <div className="font-display">Full character sheet</div>
          <Btn onClick={copyState}>Copy state JSON</Btn>
        </div>
        <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap text-xs text-muted-foreground">{inspectPlayer(s)}</pre>
      </Card>
      <div className="grid gap-2 sm:grid-cols-2">
        <Card><div className="text-xs text-muted-foreground">Active form</div><div className="font-display">{findForm(s, s.activeForm)?.name} <span className="text-xs text-muted-foreground">(×{fmt(findForm(s, s.activeForm)?.mult ?? 1)})</span></div></Card>
        <Card><div className="text-xs text-muted-foreground">Berry/TP wallets</div><div className="font-display">{fmt(s.zeni)} / {fmt(s.tp)} TP</div></Card>
        <Card><div className="text-xs text-muted-foreground">Save size (main)</div><div className="font-display">{saveBytes >= 0 ? `${(saveBytes / 1024).toFixed(1)} KB` : "unavailable"}{backupExists && <span className="ml-2 text-xs text-chart-2">backup ✓</span>}</div></Card>
        <Card><div className="text-xs text-muted-foreground">Battle bus</div><div className="font-display">{isBattleLive() ? "live fight detected" : "no battle mounted"}</div></Card>
      </div>
      <Card>
        <div className="font-display">Transformation ownership</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {allForms(s).map((f) => (
            <span key={f.id} className={`rounded border px-2 py-0.5 text-xs ${s.forms.includes(f.id) ? "border-chart-2 text-chart-2" : "border-border text-muted-foreground opacity-50"}`}>{f.name}</span>
          ))}
        </div>
      </Card>
      <p className="text-xs text-muted-foreground">Edits belong in the Lab tabs — this view is read-only by design. Batch exports go through Settings & Recovery.</p>
    </div>
  );
}

/* ---------- Snapshots ---------- */

function SnapshotsSection({ s, slot, restore }: { s: GameState; slot: string; restore: (state: unknown) => void }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => {
    try { return parseSnapshotList(localStorage.getItem(SNAPSHOTS_KEY) ?? "[]"); } catch { return []; }
  });
  const [name, setName] = useState("");
  const persist = (list: Snapshot[]) => {
    setSnapshots(list);
    try { localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(list.slice(-50))); } catch { /* storage unavailable */ }
  };
  return (
    <div className="space-y-3">
      <h2 className="font-display text-2xl">Snapshots & Time Reversal</h2>
      <Card>
        <div className="font-display">Create named snapshot</div>
        <p className="text-xs text-muted-foreground">Full-state capture with schema versioning. Snapshots live in localStorage — never uploaded anywhere.</p>
        <div className="mt-1 flex gap-2">
          <input className="flex-1 rounded bg-input px-2 py-1" placeholder="Snapshot name (e.g. Before Cell)" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} aria-label="Snapshot name" />
          <Btn onClick={() => persist([...snapshots, createSnapshot(s, name, slot === "sandbox" ? "sandbox" : "main")].slice(-50))}>Create</Btn>
        </div>
      </Card>
      <div className="space-y-2">
        {snapshots.length === 0 && <p className="text-sm text-muted-foreground">No snapshots yet.</p>}
        {[...snapshots].reverse().map((snap, i) => (
          <div key={`${snap.createdAt}-${i}`} className={row}>
            <div><div className="font-display">{snap.name}</div><div className="text-xs text-muted-foreground">{new Date(snap.createdAt).toLocaleString()} · {snap.slot} · schema v{snap.version}</div></div>
            <div className="flex gap-1">
              <Btn onClick={() => { if (window.confirm(`Restore "${snap.name}"? Your current save will be overwritten.`)) restore(snap.state); }}>Restore</Btn>
              <Btn className="bg-muted text-foreground" onClick={() => persist(snapshots.filter((x) => x !== snap))}>Delete</Btn>
            </div>
          </div>
        ))}
      </div>
      <Btn className="w-full bg-muted text-foreground" onClick={() => { if (window.confirm("Delete ALL snapshots?")) persist([]); }}>Clear all snapshots</Btn>
    </div>
  );
}

/* ---------- Automated Battle Tester ---------- */

function BattleTesterSection({ s }: { s: GameState }) {
  const [bossId, setBossId] = useState("raditz");
  const [result, setResult] = useState<{ summary: string; detail: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const options = bossIdSuggestions();
  const runSim = (build: GameState) => {
    const boss = buildBossFromId(bossId);
    if (!boss) { setResult({ summary: "Unknown boss", detail: `Could not resolve "${bossId}"`, ok: false }); return null; }
    const r = simulateBossFight(build, boss, 240);
    return r;
  };
  return (
    <div className="space-y-3">
      <h2 className="font-display text-2xl">Automated Battle Tester</h2>
      <p className="text-xs text-muted-foreground">Deterministic simulation: your build vs the boss, punched/blast-rotation with zero human reflexes. It measures the simulation model — it is not a substitute for a live canvas fight.</p>
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <select className="rounded bg-input px-2 py-1" value={bossId} onChange={(e) => setBossId(e.target.value)} aria-label="Boss to simulate">{options.map((id) => <option key={id} value={id}>{id}</option>)}</select>
          <Btn disabled={busy} onClick={() => {
            setBusy(true);
            const r = runSim(s);
            if (r) setResult({ summary: `${r.result.toUpperCase()} — grade ${r.grade} — in ${r.seconds}s`, detail: `Damage dealt: ${Math.floor(r.damageDealt)} · taken: ${Math.floor(r.damageTaken)} · boss HP left: ${Math.floor(r.bossHpLeft)} · your HP left: ${Math.floor(r.playerHpLeft)} · phase reached: ${r.bossPhaseReached}`, ok: r.result === "win" });
            setBusy(false);
          }}>Simulate current build</Btn>
          <Btn className="bg-secondary text-foreground" disabled={busy} onClick={() => {
            setBusy(true);
            const godBuild = { ...structuredClone(s), stats: { strength: 1e6, agility: 1e6, ki: 1e6, defense: 1e6 } };
            const r = runSim(godBuild);
            if (r) setResult({ summary: `GOD BUILD: ${r.result.toUpperCase()} — grade ${r.grade} — ${r.seconds}s`, detail: `Damage dealt: ${Math.floor(r.damageDealt)} · boss HP left: ${Math.floor(r.bossHpLeft)} · phase reached: ${r.bossPhaseReached}`, ok: r.result === "win" });
            setBusy(false);
          }}>Compare: God Build</Btn>
        </div>
      </Card>
      {result && (
        <Card className={result.ok ? "border-chart-2" : "border-destructive"}>
          <div className={`font-display text-xl ${result.ok ? "text-chart-2" : "text-destructive"}`}>{result.summary}</div>
          <div className="text-sm text-muted-foreground">{result.detail}</div>
        </Card>
      )}
      <Card>
        <div className="font-display">Reference roster</div>
        <div className="mt-1 text-xs text-muted-foreground">Quick pre-flight: Raditz is the intended first fight. Frieza and beyond assume you have mastered Kamehameha and your forms.</div>
      </Card>
    </div>
  );
}

/* ---------- Event Log ---------- */

function EventLogSection({ s, update }: { s: GameState; update: (fn: (d: GameState) => void) => void }) {
  const [filter, setFilter] = useState<"all" | "ok" | "blocked" | "failed">("all");
  const shown = [...s.adminEvents].reverse().filter((e) => filter === "all" || e.outcome === filter).slice(0, 60);
  return (
    <div className="space-y-2">
      <h2 className="font-display text-2xl">Event Log</h2>
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "ok", "blocked", "failed"] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`rounded px-3 py-1 text-sm ${filter === f ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{f}</button>)}
        <Btn className="ml-auto bg-muted text-foreground" onClick={() => { if (window.confirm("Clear the entire admin event log?")) update((d) => { d.adminEvents = []; }); }}>Clear log</Btn>
      </div>
      <div className="max-h-[60vh] space-y-1 overflow-y-auto">
        {shown.length === 0 && <p className="text-sm text-muted-foreground">No events match.</p>}
        {shown.map((e) => (
          <div key={e.id} className="flex flex-wrap items-baseline gap-2 border-b border-border py-1 text-xs">
            <span className="text-muted-foreground">{new Date(e.at).toLocaleTimeString()}</span>
            <span className={e.outcome === "ok" ? "text-chart-2" : e.outcome === "blocked" ? "text-chart-1" : "text-destructive"}>{e.outcome === "ok" ? "✓" : e.outcome === "blocked" ? "⊘" : "✕"} {e.action}</span>
            <span className="text-muted-foreground">{e.target}</span>
            <span>{e.previousValue} → <b>{e.newValue}</b></span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Settings & Recovery ---------- */

function SystemSection({ s, slot, switchSlot, reset, restore, update, pushToast }: { s: GameState; slot: string; switchSlot: (t: "main" | "sandbox") => void; reset: () => void; restore: (state: unknown) => void; update: (fn: (d: GameState) => void) => void; pushToast: (m: string) => void }) {
  const exportSave = (which: "main" | "sandbox") => {
    const blob = new Blob([exportSlotText(which === "sandbox" ? { ...s } : s)], { type: "application/json" });
    // Note: exporting current live state — sandbox exports require switching to the sandbox first.
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `god-engine-${which}-save.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const backupInfo = useMemo(() => {
    try {
      const text = localStorage.getItem(backupKey("main"));
      const result = text ? resolveInitialLoad(null, text) : null;
      return result?.state ? { ok: true as const } : null;
    } catch { return null; }
  }, []);
  return (
    <div className="space-y-3">
      <h2 className="font-display text-2xl">Settings & Recovery</h2>
      <Card>
        <div className="font-display">Operating mode</div>
        <p className="text-xs text-muted-foreground">Sandbox is a separate save file. Experiment freely — your main save is never touched by sandbox changes.</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Btn disabled={slot === "main"} onClick={() => switchSlot("main")}>{slot === "main" ? "REALITY (active)" : "Switch → REALITY"}</Btn>
          <Btn disabled={slot === "sandbox"} onClick={() => switchSlot("sandbox")}>{slot === "sandbox" ? "SANDBOX (active)" : "Switch → SANDBOX"}</Btn>
        </div>
      </Card>
      <Card>
        <div className="font-display">Recovery</div>
        {backupInfo ? (
          <div className="mt-1">
            <p className="text-xs text-chart-2">A backup of your main save exists.</p>
            <Btn className="mt-1" onClick={() => { if (window.confirm("Restore the backup? Your current main save will be overwritten (a fresh backup of it is kept as -backup).")) { try { restore(JSON.parse(localStorage.getItem(backupKey("main"))!)); } catch { pushToast("Backup failed validation — aborted."); } } }}>Restore from backup</Btn>
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">No backup found. Export a copy now if you care about this save.</p>
        )}
        <div className="mt-2 grid grid-cols-1 gap-2">
          <Btn onClick={() => exportSave("main")}>Export current save (versioned JSON)</Btn>
          <Btn onClick={() => { if (window.confirm("Wipe the CURRENT slot completely? This is your live save.")) reset(); }}>Wipe current slot</Btn>
        </div>
      </Card>
      <Card>
        <div className="font-display">About this build</div>
        <p className="text-xs text-muted-foreground">Saiyan Training Sim — phase 8 (GOD ENGINE command center). Save version 2 · quest schema v2 · custom techniques on the live combat pipeline.</p>
      </Card>
    </div>
  );
}

