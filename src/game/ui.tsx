import { useEffect, useRef, useState } from "react";
import { BOSSES, FORMS, LOCATIONS, PASSES, QUESTS, SAGA_ORDER, TOURNAMENT, TRAININGS, WISHES, EQUIPMENT, CONSUMABLES, TECHNIQUES, TECHNIQUE_RANKS, RAID_BOSSES, ENDLESS_MODIFIERS, fmt, type Boss, type StatKey, type EndlessModifierId } from "./data";
import { allForms, applyAction, applyBattleRewards, applyShadowRewards, applyTournamentRewards, applySurvivalRewards, applyRaidRewards, consumeItem, effectiveTrainingGain, endlessBoss, equipmentBonus, techniqueRank, bumpTechniqueUse, battleGrade, CUSTOM_FORM_MAX_MULT, findForm, battleClashDelay, battleClashPressure, canUnlockForm, formMult, gravMult, initialBattleState, levelForXp, maxGravityForLevel, powerLevel, questSummary, sagaQuests, sagaStatus, rankForLevel, resolveBattleAction, shadowDummyBoss, SHADOW_REWARD_MULT, SHADOW_ZENKAI_HP_FRACTION, SHADOW_ZENKAI_MULT, xpRequiredForLevel, type BattleState } from "./engine";
import { registerBattleHandler, type BattleCommand } from "./battleBus";
import { useBattleControls } from "./controls";
import { useGame } from "./store";
import { playBattleSound, StickmanArena, type BattleAction, type BattleSound } from "./arena";
import { FormArt } from "./FormArt";

const waveOf = (b: Boss) => Math.max(1, Math.floor(Number(b.id.split("-")[1]) || 1));

type Float = { id: number; x: number; y: number; text: string };
function useFloats() {
  const [floats, setFloats] = useState<Float[]>([]);
  const add = (e: { clientX: number; clientY: number; currentTarget: Element }, text: string) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = { id: Math.random(), x: e.clientX - r.left, y: e.clientY - r.top, text };
    setFloats((a) => [...a.slice(-15), f]);
    setTimeout(() => setFloats((a) => a.filter((x) => x.id !== f.id)), 800);
  };
  const layer = floats.map((f) => (
    <span key={f.id} className="float-num pointer-events-none absolute font-display text-xl text-primary" style={{ left: f.x, top: f.y }}>{f.text}</span>
  ));
  return { add, layer };
}

function useHold(fn: () => void) {
  const t = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => { if (t.current) clearInterval(t.current); t.current = null; };
  useEffect(() => stop, []);
  return {
    onPointerDown: () => { stop(); t.current = setInterval(fn, 90); },
    onPointerUp: stop, onPointerLeave: stop,
  };
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card/80 p-4 backdrop-blur ${className}`}>{children}</div>;
}
export function Btn({ className = "", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...p} className={`rounded-lg bg-primary px-3 py-2 font-display tracking-wide text-primary-foreground transition active:scale-95 disabled:opacity-40 hover:brightness-110 ${className}`} />;
}

function TrainButton({ t }: { t: (typeof TRAININGS)[number] }) {
  const { s, train } = useGame();
  const { add, layer } = useFloats();
  const last = useRef<{ clientX: number; clientY: number; currentTarget: Element } | null>(null);
  const hold = useHold(() => { const g = train(t.stat); if (last.current) add(last.current, "+" + fmt(g)); });
  return (
    <button
      {...hold}
      onPointerDown={(e) => { last.current = { clientX: e.clientX, clientY: e.clientY, currentTarget: e.currentTarget }; hold.onPointerDown(); }}
      onClick={(e) => { playBattleSound("tick"); add(e, "+" + fmt(train(t.stat))); }}
      className="relative select-none overflow-visible rounded-xl border-2 border-primary/40 bg-secondary p-4 text-left transition active:scale-95 hover:border-primary"
    >
      <div className="text-3xl">{t.icon}</div>
      <div className="font-display text-xl text-foreground">{t.name}</div>
      <div className="text-sm text-muted-foreground">{t.desc}</div>
      <div className="mt-1 font-display text-lg text-primary">{fmt(s.stats[t.stat])}</div>
      <div className="text-xs text-muted-foreground">Mastery {Math.floor(s.mastery[t.stat])}%</div>
      {layer}
    </button>
  );
}

export function TrainTab() {
  const { s, update } = useGame();
  const pl = powerLevel(s);
  // Gravity adapts automatically: one 10G step per 2 levels (curve), applied on
  // level-up. Saves whose gravity lags the curve snap up on the next level-up.
  const gravCurve = maxGravityForLevel(s.level);
  const gravLagging = s.gravity < gravCurve;
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="font-display text-xl">Level {s.level} · {rankForLevel(s.level)}</div>
          <div className="text-sm text-muted-foreground">{s.level >= 100 ? "MAX LEVEL" : `${fmt(s.xp)} / ${fmt(xpRequiredForLevel(s.level + 1))} XP`}</div>
        </div>
        <Bar value={s.level >= 100 ? 1 : s.xp - xpRequiredForLevel(s.level)} max={s.level >= 100 ? 1 : xpRequiredForLevel(s.level + 1) - xpRequiredForLevel(s.level)} className="mt-2 bg-chart-1" />
      </Card>
      <p className="text-sm text-muted-foreground">Click rapidly or hold a button to train. Training uses stamina, which refills on its own.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{TRAININGS.map((t) => <TrainButton key={t.id} t={t} />)}</div>
      <TurboClicker />
      <Card className="border-destructive/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-2xl">🌀</span> <span className="font-display text-xl">Gravity Chamber — {s.gravity * 10}G</span>
            <div className="text-sm text-muted-foreground">Overall training multiplier ×{gravMult(s).toFixed(2)}</div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div className="font-display text-lg text-chart-2">+{(gravLagging ? gravCurve : s.gravity + 1) * 10}G</div>
            <div>{gravLagging ? `adapts at Lv ${s.level + 1}` : 2 * s.gravity > 100 ? "chamber maximum" : `unlocks at Lv ${2 * s.gravity}`}</div>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {gravLagging
            ? `Your body is catching up — your next level-up adapts you to ${gravCurve * 10}G.`
            : "Your body adapts on its own — gravity steps up automatically as you level."}{" "}
          No training needed.
        </p>
      </Card>
      {s.passes.includes("auto") && (
        <Card><span className="font-display">Auto-Train target: </span>
          {TRAININGS.map((t) => (
            <button key={t.id} onClick={() => update((d) => { d.autoTarget = t.stat as StatKey; })}
              className={`ml-2 rounded px-2 py-1 text-sm ${s.autoTarget === t.stat ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{t.name}</button>
          ))}
        </Card>
      )}
      <ScoutCard />
      <h2 className="font-display text-2xl">Training Locations</h2>
      <div className="grid gap-2 md:grid-cols-5">
        {LOCATIONS.map((l) => {
          const ok = pl >= l.req;
          return (
            <button key={l.id} disabled={!ok} onClick={() => update((d) => { d.location = l.id; })}
              className={`rounded-lg border-2 p-3 text-left disabled:opacity-40 ${s.location === l.id ? "border-primary" : "border-border"}`}
              style={{ background: `linear-gradient(135deg, ${l.bg}, transparent)` }}>
              <div className="font-display">{l.name}</div>
              <div className="text-xs text-muted-foreground">×{l.mult} training {ok ? "" : `• needs PL ${fmt(l.req)}`}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScoutCard() {
  const { s, update } = useGame();
  const [result, setResult] = useState("");
  const loc = LOCATIONS.find((l) => l.id === s.location) ?? LOCATIONS[0]!;
  return (
    <Card>
      <div className="font-display text-2xl">🗺️ Scout {loc.name}</div>
      <p className="text-sm text-muted-foreground">Send search parties into the wilderness — 2 stamina per mission. Loot scales with the location: caches of Zeni, rare Dragon Balls, and training XP.</p>
      <Btn className="mt-2" disabled={s.stamina < 2 && !s.godMode} onClick={() => {
        const r = Math.random();
        update((d) => applyAction(d, { type: "SCOUT", rand: r }));
        setResult(r < 0.05 ? "You found a DRAGON BALL! 🟠" : r < 0.22 ? "The scouts recovered a hidden cache of Zeni." : "The scouts found nothing of value — but the trek sharpened you.");
      }}>Scout the area (2 stamina)</Btn>
      {result && <p className="mt-2 text-sm text-chart-2" role="status">{result}</p>}
    </Card>
  );
}

/* ---------- Turbo Clicker — single insane-speed auto clicker (1ms buffer) ---------- */

const CLICKS_PER_SEC = 100;

function TurboClicker() {
  const { s, train, update } = useGame();
  const sRef = useRef(s);
  sRef.current = s;
  const [on, setOn] = useState(false);
  const [stat, setStat] = useState<StatKey>("strength");
  const [meter, setMeter] = useState(0);
  const [total, setTotal] = useState(0);
  const gained = useRef(0);
  const lastSound = useRef(0);
  useEffect(() => {
    if (!on) return;
    gained.current = 0;
    setMeter(0);
    // The engine no-ops TRAIN_STAT without stamina; skip those calls so the
    // meter only counts gains that actually landed.
    const canClick = () => sRef.current.godMode || sRef.current.stamina >= 1;
    // Batch many clicks into a single state update so the UI keeps painting
    // at high speed.
    const BATCH = 5;
    const TICK_MS = 50;
    const clicker = setInterval(() => {
      if (!canClick()) return;
      let batchGain = 0;
      update((d) => {
        for (let i = 0; i < BATCH; i++) {
          if (!d.godMode && d.stamina < 1) break;
          batchGain += effectiveTrainingGain(d, stat);
          applyAction(d, { type: "TRAIN_STAT", stat });
        }
      });
      gained.current += batchGain;
      if (Date.now() - lastSound.current > 200) { playBattleSound("tick"); lastSound.current = Date.now(); }
    }, TICK_MS);
    // One-second window: per-click gains can be sub-1 at high stats, so a
    // shorter window would round to 0.
    const meterTimer = setInterval(() => {
      setMeter(gained.current);
      setTotal((t) => t + gained.current);
      gained.current = 0;
    }, 1000);
    return () => { clearInterval(clicker); clearInterval(meterTimer); };
  }, [on, stat, train, update]);
  const free = s.godMode || s.stamina >= 1;
  const rate = meter >= 1000 ? fmt(meter) : meter.toFixed(1);
  return (
    <Card className={on ? "border-primary" : ""}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-display text-2xl">⚡ Turbo Clicker — 100/s</div>
        <Btn onClick={() => setOn((v) => !v)} className={on ? "bg-destructive" : ""}>{on ? "■ STOP" : "▶ START"}</Btn>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {TRAININGS.map((t) => (
          <button key={t.id} onClick={() => setStat(t.stat as StatKey)} aria-pressed={stat === t.stat} className={`rounded px-3 py-1 text-sm font-display ${stat === t.stat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{t.icon} {t.name}</button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="font-display text-3xl text-primary" aria-live="polite">{on ? `+${rate} /s` : "—"}</div>
        <p className="text-right text-xs text-muted-foreground">
          {total > 0 && <span className="mr-2 text-chart-2">Session total: +{fmt(total)} {TRAININGS.find((t) => t.stat === stat)?.name ?? stat}</span>}
          {on && !free ? "⏳ Waiting for stamina…" : s.godMode ? "God Mode: unlimited clicks." : on ? "Running on stamina." : "Insane-speed auto-clicker (1ms buffer)."}
          {!s.godMode && " Stamina gates gains and refills on its own — God Mode (Ctrl+Shift+A) trains free."}
        </p>
      </div>
    </Card>
  );
}

export function Bar({ value, max, className = "bg-primary" }: { value: number; max: number; className?: string }) {
  return <div className="h-3 w-full overflow-hidden rounded-full bg-muted"><div className={`h-full transition-all bar-animated ${className}`} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} /></div>;
}

export function FormsTab() {
  const { s, update, triggerShake } = useGame();
  const pl = powerLevel(s);
  return (
    <div className="space-y-4">
    <FormCreator />
    <div className="grid gap-3 md:grid-cols-3">
      {allForms(s).map((f) => {
        const owned = s.forms.includes(f.id);
        const needPass = f.pass && !s.passes.includes(f.pass);
        const can = canUnlockForm(s, f.id);
        return (
          <Card key={f.id} className={`card-hover ${s.activeForm === f.id ? "ring-2 ring-primary" : ""}`}>
            <div className="flex items-center gap-3">
              <div className="transition-transform duration-150 hover:scale-105" title={f.name}>
                <FormArt formId={f.id} hair={f.hair} aura={f.aura} size={64} />
              </div>
              <div className="flex-1"><div className="font-display text-xl">{f.name}</div><div className="text-sm text-muted-foreground">×{fmt(f.mult)} power · {f.custom ? "Custom form" : `Level ${f.levelReq}`}</div></div>
              {f.custom && <button className="text-sm text-destructive underline" onClick={() => { if (confirm(`Delete ${f.name}?`)) update((d) => applyAction(d, { type: "DELETE_FORM", formId: f.id })); }}>Delete</button>}
            </div>
            <div className="mt-3">
              {owned ? (
                <Btn className="w-full" disabled={s.activeForm === f.id} onClick={() => { update((d) => applyAction(d, { type: "TRANSFORM", formId: f.id })); if (f.id !== "base") { triggerShake(); playBattleSound("transform"); } }}>
                  {s.activeForm === f.id ? "Active" : "Transform!"}
                </Btn>
              ) : (
                <Btn className="w-full" disabled={!can} onClick={() => update((d) => applyAction(d, { type: "UNLOCK_FORM", formId: f.id }))}>
                  {needPass ? "Requires UI Master Pass" : `Unlock • ${fmt(f.cost)} Zeni • PL ${fmt(f.req)} • Lv ${f.levelReq}`}
                </Btn>
              )}
            </div>
          </Card>
        );
      })}
    </div>
    </div>
  );
}

function FormCreator() {
  const { update, triggerShake } = useGame();
  const [name, setName] = useState("Super Saiyan Rosé");
  const [mult, setMult] = useState(300);
  const [aura, setAura] = useState("#ff4fa3");
  const [hair, setHair] = useState("#ff9ad0");
  const create = () => {
    const id = "custom-" + Date.now();
    update((d) => { applyAction(d, { type: "CREATE_FORM", id, name, mult, aura, hair }); applyAction(d, { type: "TRANSFORM", formId: id }); });
    triggerShake();
  };
  return (
    <Card>
      <div className="mb-3 font-display text-2xl">Transformation Creator</div>
      <div className="grid items-end gap-3 md:grid-cols-[2fr_2fr_1fr_1fr_auto]">
        <label className="text-sm">Name<input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded bg-input px-2 py-1 text-foreground" /></label>
        <label className="text-sm">Power ×
          <div className="mt-1 flex items-center gap-2">
            <input type="range" min={1} max={CUSTOM_FORM_MAX_MULT} value={mult} onChange={(e) => setMult(+e.target.value)} className="flex-1" />
            <input type="number" min={1} max={CUSTOM_FORM_MAX_MULT} className="w-20 rounded bg-input px-2 py-1 text-right text-foreground" value={mult} onChange={(e) => setMult(Math.max(1, Math.min(CUSTOM_FORM_MAX_MULT, Math.floor(+e.target.value || 1))))} aria-label="Power multiplier" />
            <span className="text-xs text-muted-foreground">×{fmt(mult)}</span>
          </div>
        </label>
        <label className="text-sm">Aura<input type="color" value={aura} onChange={(e) => setAura(e.target.value)} className="mt-1 block h-9 w-full rounded" /></label>
        <label className="text-sm">Hair<input type="color" value={hair} onChange={(e) => setHair(e.target.value)} className="mt-1 block h-9 w-full rounded" /></label>
        <Btn disabled={!name.trim()} onClick={create}>Create & Transform</Btn>
      </div>
      <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
        <FormArt formId="custom" hair={hair} aura={aura} size={56} />
        <span>Preview of your custom transformation in the arena</span>
      </div>
    </Card>
  );
}

export function BattleTab({ customBoss }: { customBoss: Boss | null }) {
  const { s, update, triggerShake } = useGame();
  const pl = powerLevel(s);
  const [battle, setBattle] = useState<BattleState>(initialBattleState);
  const boss = battle.boss;
  const hp = battle.hp;
  const php = battle.playerHp;
  const ki = battle.ki;
  const log = battle.message;
  const clashActive = battle.phase === "clash";
  const clashProgress = battle.clashProgress;
  const clashCount = battle.clashCount;
  const [soundOn, setSoundOn] = useState(true);
  const [action, setAction] = useState<BattleAction>("idle");
  const [actionTick, setActionTick] = useState(0);
  const combo = battle.combo;
  const clashStartedRef = useRef(0);
  const clashLastTickRef = useRef(0);
  const outcomeHandledRef = useRef("");
  const clashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clashTapRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clashSoundGateRef = useRef(0);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { add, layer } = useFloats();
  const fm = formMult(s) * gravMult(s);
  const maxP = (100 + s.stats.defense * 20) * fm;
  // Player HP ceiling was snapshotted at battle start; the live maxP can drift
  // (Auto-Train raises DEF mid-fight), so the HUD always reads the snapshot.
  const battleMaxHp = battle.maxPlayerHp || maxP;
  const sRef = useRef(s); sRef.current = s;
  const form = findForm(s, s.activeForm) ?? { id: "base", name: "Base Form", mult: 1, req: 0, cost: 0, aura: "transparent", levelReq: 1, hair: undefined };

  const dispatchBattle = (type: Parameters<typeof resolveBattleAction>[2]) => {
    setBattle((current) => resolveBattleAction(current, sRef.current, type));
  };

  // God Engine live overrides arrive via the command bus; the battle applies them.
  const commandRef = useRef<(c: BattleCommand) => void>(() => {});
  commandRef.current = (c) => {
    switch (c.type) {
      case "FORCE_WIN":
        setBattle((cur) => cur.boss && (cur.phase === "active" || cur.phase === "clash")
          ? { ...cur, hp: 0, phase: "won", message: `You defeated ${cur.boss.name}!` } : cur);
        break;
      case "FORCE_FLEE":
        if (clashIntervalRef.current) clearInterval(clashIntervalRef.current);
        if (clashTapRef.current) clearInterval(clashTapRef.current);
        dispatchBattle({ type: "FLEE" });
        break;
      case "HEAL_PLAYER":
        setBattle((cur) => ({ ...cur, playerHp: cur.maxPlayerHp || maxP }));
        break;
      case "SET_BOSS_HP":
        setBattle((cur) => (cur.boss ? { ...cur, hp: Math.max(1, cur.boss.hp * c.pct) } : cur));
        break;
      case "REFILL_KI":
        setBattle((cur) => ({ ...cur, ki: 100 }));
        break;
      case "FORCE_CLASH":
        if (battle.phase === "active" && boss) beginClash();
        break;
      case "SPAWN_BOSS":
        start(c.boss);
        break;
    }
  };
  useEffect(() => {
    registerBattleHandler((c) => commandRef.current(c));
    return () => registerBattleHandler(null);
  }, []);

  function beginClash() {
    clashStartedRef.current = Date.now();
    clashLastTickRef.current = clashStartedRef.current;
    dispatchBattle({ type: "CLASH_START" });
    setAction("clash");
    setActionTick((n) => n + 1);
    if (soundOn) playBattleSound("clash");
  }

  function pushClash() {
    if (!clashActive) return;
    dispatchBattle({ type: "CLASH_PUSH", agility: sRef.current.stats.agility });
    const now = Date.now();
    if (soundOn && now - clashSoundGateRef.current > 240) {
      playBattleSound("charge");
      clashSoundGateRef.current = now;
    }
  }

  useEffect(() => () => {
    if (clashIntervalRef.current) clearInterval(clashIntervalRef.current);
    if (clashTapRef.current) clearInterval(clashTapRef.current);
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
  }, []);

  useEffect(() => { if (customBoss) start(customBoss); }, [customBoss]); // eslint-disable-line

  function start(b: Boss) {
    if (clashIntervalRef.current) clearInterval(clashIntervalRef.current);
    outcomeHandledRef.current = "";
    setBattle((current) => resolveBattleAction(current, sRef.current, { type: "START_BATTLE", boss: b, playerMaxHp: maxP, initialKi: sRef.current.passes.includes("kicharge") ? 100 : 0 }));
  }

  useEffect(() => {
    if (!boss || battle.phase !== "active") return;
    const delay = battleClashDelay(boss);
    const timer = setTimeout(beginClash, delay);
    return () => clearTimeout(timer);
  }, [boss, battle.phase, clashCount]); // eslint-disable-line

  useEffect(() => {
    if (!boss || (battle.phase !== "active" && battle.phase !== "clash")) return;
    const t = setInterval(() => dispatchBattle({ type: "ENEMY_TICK", playerMaxHp: maxP, now: Date.now() }), 1000);
    return () => clearInterval(t);
  }, [boss, battle.phase, maxP]);

  useEffect(() => {
    if (!clashActive) {
      if (clashIntervalRef.current) clearInterval(clashIntervalRef.current);
      clashIntervalRef.current = null;
      return;
    }
    clashIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const deltaSeconds = (now - clashLastTickRef.current) / 1000;
      clashLastTickRef.current = now;
      if (boss) dispatchBattle({ type: "CLASH_TICK", pressurePerSecond: battleClashPressure(boss), deltaSeconds, elapsedMs: now - clashStartedRef.current });
    }, 100);
    return () => {
      if (clashIntervalRef.current) clearInterval(clashIntervalRef.current);
      clashIntervalRef.current = null;
    };
  }, [clashActive, boss]);

  useEffect(() => {
    if (!boss || battle.phase === "active" || battle.phase === "clash" || battle.phase === "idle") return;
    const outcomeId = `${boss.id}:${battle.phase}:${battle.clashCount}`;
    if (outcomeHandledRef.current === outcomeId) return;
    outcomeHandledRef.current = outcomeId;
    if (clashIntervalRef.current) clearInterval(clashIntervalRef.current);
    if (clashTapRef.current) clearInterval(clashTapRef.current);
    clashIntervalRef.current = null;
    clashTapRef.current = null;
    if (battle.phase === "won") {
      const wonBoss = boss;
      const grade = battleGrade(Math.max(0, battle.playerHp) / Math.max(1, battle.maxPlayerHp || maxP));
      update((d) => applyAction(d, { type: "RECORD_BOSS_GRADE", bossId: wonBoss.id, grade }));
      if (wonBoss.id === "shadow-self") {
        const zenkai = battle.playerHp / Math.max(1, battle.maxPlayerHp || maxP) < SHADOW_ZENKAI_HP_FRACTION;
        const factor = zenkai ? SHADOW_ZENKAI_MULT : SHADOW_REWARD_MULT;
        update((d) => applyShadowRewards(d, zenkai));
        if (soundOn) playBattleSound("win");
        setBattle((current) => ({ ...current, boss: null, phase: "idle", message: `Shadow Self conquered! All stats ×${factor}${zenkai ? " — ZENKAI BOOST! Stamina fully restored." : ""}` }));
      } else {
        const tournamentRound = wonBoss.tournament;
        if (wonBoss.id.startsWith("endless-")) {
          update((d) => applySurvivalRewards(d, wonBoss));
          setBattle((current) => ({ ...current, boss: null, phase: "idle", message: `Endless wave ${wonBoss.id.split("-")[1]} cleared! Best streak: wave ${Math.max(waveOf(wonBoss), sRef.current.survivalBest)}. Grade: ${grade}` }));
        } else if (wonBoss.id.startsWith("raid-")) {
          const raidId = wonBoss.id.replace(/^raid-/, "");
          const first = !sRef.current.defeated.includes(wonBoss.id);
          update((d) => applyRaidRewards(d, raidId));
          setBattle((current) => ({ ...current, boss: null, phase: "idle", message: `Raid cleared: ${wonBoss.name}! ${first ? "First clear — a Dragon Ball trembles…" : ""}` }));
        } else if (tournamentRound !== undefined) {
          const firstClear = sRef.current.tournamentRound === tournamentRound;
          const round = TOURNAMENT[tournamentRound];
          update((d) => applyTournamentRewards(d, tournamentRound));
          setBattle((current) => ({ ...current, boss: null, phase: "idle", message: `${round?.name ?? "Match"} won! ${firstClear ? "Bracket advanced." : "A worthy rematch."} Grade: ${grade}` }));
        } else {
          const ball = Math.random() < 0.5;
          update((d) => applyBattleRewards(d, wonBoss, ball));
          setBattle((current) => ({ ...current, boss: null, phase: "idle", message: `You defeated ${wonBoss.name}! +${fmt(wonBoss.zeni)} Zeni, +${wonBoss.tp} TP${ball ? ", found a Dragon Ball!" : ""} Grade: ${grade}` }));
        }
      }
    } else if (battle.phase === "lost") {
      if (soundOn) playBattleSound("lose");
      setBattle((current) => ({ ...current, boss: null, phase: "idle" }));
    }
  }, [battle.phase, battle.clashCount, battle.playerHp, battle.maxPlayerHp, boss, maxP, update, soundOn]);

  useEffect(() => {
    if (!clashActive || !battle.message.startsWith("Beam clash won!")) return;
    setAction("blast"); setActionTick((n) => n + 1);
    triggerShake();
    if (soundOn) playBattleSound("win");
  }, [battle.phase, battle.clashCount]); // eslint-disable-line

  useEffect(() => {
    if (!boss || battle.phase !== "active" || battle.clashCount === 0 || !battle.message.includes("overpowered")) return;
    setAction("idle"); setActionTick((n) => n + 1);
    if (soundOn) playBattleSound("lose");
  }, [battle.phase, battle.clashCount]); // eslint-disable-line

  const runPunch = (event?: React.MouseEvent) => {
    if (!boss || clashActive) return;
    dispatchBattle({ type: "PUNCH", now: Date.now() });
    update((d) => bumpTechniqueUse(d, "punch"));
    if (event) add(event, `${battle.combo > 0 ? `${battle.combo + 1} HIT · ` : "👊 "}`);
    setAction("punch"); setActionTick((n) => n + 1);
    if (soundOn) playBattleSound("punch");
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => dispatchBattle({ type: "RESET_COMBO", now: Date.now() }), 1100);
  };
  const runBlast = () => {
    const cost = techniqueRank(sRef.current, "blast") >= 2 ? 15 : 20;
    if (!boss || clashActive || ki < cost) return;
    dispatchBattle({ type: "BLAST", now: Date.now() });
    update((d) => bumpTechniqueUse(d, "blast"));
    setAction("blast"); setActionTick((n) => n + 1);
    if (soundOn) playBattleSound("blast");
  };
  const runUltimate = () => {
    if (!boss || clashActive || ki < 100) return;
    dispatchBattle({ type: "ULTIMATE", now: Date.now() });
    update((d) => bumpTechniqueUse(d, "ultimate"));
    setAction("kamehameha"); setActionTick((n) => n + 1); triggerShake();
    if (soundOn) playBattleSound("ultimate");
  };
  const runVanish = () => {
    const cost = techniqueRank(sRef.current, "vanish") >= 2 ? 12 : 15;
    if (!boss || clashActive || ki < cost) return;
    dispatchBattle({ type: "VANISH", now: Date.now() });
    update((d) => bumpTechniqueUse(d, "vanish"));
    setAction("vanish"); setActionTick((n) => n + 1);
    if (soundOn) playBattleSound("vanish");
  };
  const runHeavy = () => {
    if (!boss || clashActive) return;
    dispatchBattle({ type: "HEAVY", now: Date.now() });
    update((d) => bumpTechniqueUse(d, "heavy"));
    setAction("punch"); setActionTick((n) => n + 1); triggerShake();
    if (soundOn) playBattleSound("punch");
  };
  const runParry = () => {
    if (!boss || clashActive) return;
    if (Date.now() < battle.guardCdUntil) return; // refused guards don't train the technique
    dispatchBattle({ type: "PERFECT_GUARD", now: Date.now(), uiForm: sRef.current.activeForm === "ui" });
    update((d) => bumpTechniqueUse(d, "parry"));
    if (soundOn) playBattleSound("charge");
  };
  const runUseConsumable = (consumable: "senzu" | "tonic") => {
    if (!boss || clashActive) return;
    const itemId = consumable === "senzu" ? "senzu" : "energy-tonic";
    if (consumable === "senzu" && battle.playerHp >= battle.maxPlayerHp) return;
    if (consumable === "tonic" && ki >= 100) return;
    const have = sRef.current.inventory[itemId] ?? 0;
    if (have <= 0) return;
    update((d) => { consumeItem(d, itemId); });
    dispatchBattle({ type: "USE_CONSUMABLE", consumable });
    if (soundOn) playBattleSound("charge");
  };
  const runCharge = () => {
    if (!boss || clashActive) return;
    dispatchBattle({ type: "CHARGE", amount: 2.5 });
    update((d) => bumpTechniqueUse(d, "charge"));
  };
  useBattleControls({ punch: () => runPunch(), blast: runBlast, ultimate: runUltimate, vanish: runVanish, charge: runCharge, parry: runParry, heavy: runHeavy });
  const charge = useHold(() => dispatchBattle({ type: "CHARGE", amount: 4 }));
  const blastCost = techniqueRank(s, "blast") >= 2 ? 15 : 20;
  const vanishCost = techniqueRank(s, "vanish") >= 2 ? 12 : 15;

  if (!boss)
    return (
      <div className="space-y-3">
        {log && <Card className="font-display text-lg text-primary">{log}</Card>}
        <Card className="border-primary/50 bg-secondary/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-display text-xl">👤 Shadow Self — 1.75× your stats</div>
              <div className="text-sm text-muted-foreground">Win: all stats ×{SHADOW_REWARD_MULT} · survive below {Math.round(SHADOW_ZENKAI_HP_FRACTION * 100)}% HP for a Zenkai ×{SHADOW_ZENKAI_MULT} + full stamina · opens with a dark beam clash</div>
            </div>
            <div className="flex gap-2">
              {s.darkAura && <Btn onClick={() => update((d) => { d.darkAura = !d.darkAura; })}>Dark Ki Aura: {s.darkAura ? "ON" : "OFF"}</Btn>}
              <Btn onClick={() => start(shadowDummyBoss(s))}>Spar!</Btn>
            </div>
          </div>
        </Card>
        <div className="grid gap-3 md:grid-cols-3">
          {BOSSES.map((b) => {
            const ok = pl >= b.req;
            return (
              <Card key={b.id} className="card-hover">
                <div className="text-5xl">{b.emoji}</div>
                <div className="font-display text-2xl">{b.name} {s.defeated.includes(b.id) && "✅"} {s.bestGrades?.[b.id] && <span className="font-display text-lg text-chart-2" title="Best combat grade">({s.bestGrades[b.id]})</span>}</div>
                <div className="text-sm text-muted-foreground">HP {fmt(b.hp)} • ATK {fmt(b.atk)}/s • Reward {fmt(b.zeni)} Zeni</div>
                <Btn className="mt-2 w-full" disabled={!ok} onClick={() => start(b)}>{ok ? "Fight!" : `Needs PL ${fmt(b.req)}`}</Btn>
              </Card>
            );
          })}
        </div>
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-display text-2xl">{boss.emoji} {boss.name} <span className="text-sm text-muted-foreground">{s.godMode && "• GOD MODE"}</span></div>
        <button type="button" aria-label={soundOn ? "Mute battle sounds" : "Enable battle sounds"} title={soundOn ? "Mute battle sounds" : "Enable battle sounds"} onClick={() => setSoundOn((on) => !on)} className="rounded-md border border-border px-3 py-2 text-sm">{soundOn ? "🔊 Sound on" : "🔇 Sound off"}</button>
      </div>
      <div className="flex justify-between text-sm"><span>Opponent • {fmt(Math.max(0, hp))} HP {boss.signature ? <span className="text-muted-foreground">· ⚡ {boss.signature.name}</span> : null}</span><span>You • {fmt(Math.max(0, php))} HP</span></div>
      {battle.phase !== "idle" && <div className="text-center font-display text-xs uppercase tracking-wide text-destructive">{battle.phaseNumber === 3 ? "Critical Phase — enemy at full fury" : battle.phaseNumber === 2 ? "Enraged Phase — enemy hits harder" : "Opening Phase"}{Date.now() < battle.exposedUntil && <span className="ml-2 text-chart-2">⚠ EXPOSED ×2</span>}</div>}
      <div className="grid grid-cols-2 gap-2"><Bar value={hp} max={boss.hp} className="bg-destructive" /><Bar value={php} max={battleMaxHp} className="bg-chart-2" /></div>
      <StickmanArena boss={boss} formName={form.name} aura={form.aura} hair={form.hair} darkAura={s.darkAura} action={action} actionTick={actionTick} clashActive={clashActive} clashProgress={clashProgress} playerHp={php} playerMaxHp={battleMaxHp} bossHp={hp} onArenaClick={() => runPunch()} onArenaAltClick={runVanish} />
      {clashActive && <div className="space-y-2 border-l-2 border-primary pl-3" role="status">
        <div className="flex items-center justify-between gap-2 font-display text-sm"><span>BEAM STRUGGLE</span><span>{Math.ceil(Math.max(0, 8 - (Date.now() - clashStartedRef.current) / 1000))}s</span></div>
        <Bar value={clashProgress} max={100} className="bg-primary" />
        <button type="button" className="w-full select-none touch-manipulation rounded-md bg-primary py-3 font-display text-lg text-primary-foreground active:scale-[0.99]" onPointerDown={(event) => { event.preventDefault(); pushClash(); if (!clashTapRef.current) clashTapRef.current = setInterval(pushClash, 110); }} onPointerUp={() => { if (clashTapRef.current) clearInterval(clashTapRef.current); clashTapRef.current = null; }} onPointerLeave={() => { if (clashTapRef.current) clearInterval(clashTapRef.current); clashTapRef.current = null; }} onPointerCancel={() => { if (clashTapRef.current) clearInterval(clashTapRef.current); clashTapRef.current = null; }} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && !event.repeat) { event.preventDefault(); pushClash(); } }}>⚡ Tap or hold to overpower</button>
      </div>}
      <div className="flex justify-between text-sm"><span>Ki</span><span>{Math.floor(ki)}%</span></div>
      <Bar value={ki} max={100} className="bg-chart-1" />
      <div className="relative grid grid-cols-2 gap-2 md:grid-cols-4">
        <Btn className="py-5 text-lg" disabled={clashActive} onClick={(e) => { runPunch(e); dispatchBattle({ type: "CHARGE", amount: 2 }); }}>👊 Punch <kbd className="ml-1 text-sm">J</kbd></Btn>
        <Btn className="py-5 text-lg" disabled={ki < blastCost || clashActive} onClick={() => runBlast()}>💥 Ki Blast ·{blastCost} <kbd className="ml-1 text-sm">K</kbd></Btn>
        <Btn className="py-5 text-lg" disabled={ki < 100 || clashActive} onClick={() => runUltimate()}>🌊 Kamehameha <kbd className="ml-1 text-sm">L</kbd></Btn>
        <Btn className="py-5 text-lg" disabled={clashActive} onClick={() => runHeavy()}>🥊 Heavy Strike <kbd className="ml-1 text-sm">H</kbd></Btn>
        <button {...charge} disabled={clashActive} className="select-none rounded-lg bg-chart-1 py-5 font-display text-lg text-primary-foreground active:scale-95 disabled:opacity-40">⚡ Charge <kbd className="ml-1 text-sm">C</kbd></button>
        <Btn className="py-5 text-lg" disabled={clashActive || Date.now() < battle.guardCdUntil} onClick={() => runParry()}>🛡️ Perfect Guard <kbd className="ml-1 text-sm">F</kbd></Btn>
        <Btn className="col-span-2 py-4 text-lg md:col-span-4" disabled={ki < vanishCost || clashActive} onClick={() => runVanish()}>💨 Vanish Strike ·{vanishCost} <kbd className="ml-2 text-sm">Shift · right-click arena</kbd></Btn>
        {layer}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => runUseConsumable("senzu")} disabled={(s.inventory["senzu"] ?? 0) <= 0 || clashActive || battle.phase !== "active" || php >= battleMaxHp} title="Senzu Bean — full HP" className="rounded border border-border px-3 py-2 text-sm disabled:opacity-40">🫘 Senzu ×{s.inventory["senzu"] ?? 0}</button>
        <button type="button" onClick={() => runUseConsumable("tonic")} disabled={(s.inventory["energy-tonic"] ?? 0) <= 0 || clashActive || battle.phase !== "active" || ki >= 100} title="Energy Tonic — full Ki" className="rounded border border-border px-3 py-2 text-sm disabled:opacity-40">🧪 Tonic ×{s.inventory["energy-tonic"] ?? 0}</button>
        <span className="ml-auto text-xs text-muted-foreground" title="Technique mastery ranks">Mastery: 👊{techniqueRank(s, "punch")} 🥊{techniqueRank(s, "heavy")} 💥{techniqueRank(s, "blast")} 🌊{techniqueRank(s, "ultimate")} 💨{techniqueRank(s, "vanish")} ⚡{techniqueRank(s, "charge")} 🛡️{techniqueRank(s, "parry")}</span>
      </div>
      {s.customTechniques.length > 0 && battle.phase === "active" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Custom:</span>
          {s.customTechniques.slice(0, 4).map((tech) => {
            const cooling = Date.now() < (battle.cooldowns[tech.id] ?? 0);
            const blocked = clashActive || cooling || (!s.infiniteKi && ki < tech.kiCost);
            return (
              <button
                key={tech.id}
                disabled={blocked}
                onClick={() => dispatchBattle({ type: "CUSTOM_TECHNIQUE", techniqueId: tech.id, now: Date.now() })}
                title={`${tech.desc} · ${Math.round(tech.cooldownMs / 100) / 10}s cooldown`}
                className="select-none rounded border-2 bg-secondary px-3 py-2 text-sm font-display active:scale-95 disabled:opacity-40"
                style={{ borderColor: tech.aura }}
              >
                <span className="mr-1 inline-block h-3 w-3 rounded-full align-middle" style={{ background: tech.aura }} />
                {tech.name} ·{tech.kiCost}
              </button>
            );
          })}
        </div>
      )}
      <p className="font-display text-xs text-muted-foreground">KEYS: J / SPACE punch · H heavy strike · F perfect guard · K ki blast · L Kamehameha · C charge · SHIFT vanish · click punch · right-click vanish</p>
      {combo > 1 && <div className="font-display text-sm text-primary" role="status">{combo} HIT COMBO</div>}
      {log && <p className="font-display text-lg text-primary" role="status">{log}</p>}
      <button type="button" className="text-sm text-muted-foreground underline" onClick={() => { if (clashIntervalRef.current) clearInterval(clashIntervalRef.current); dispatchBattle({ type: "FLEE" }); }}>Flee</button>
    </div>
  );
}

const QUEST_KIND_ICON: Record<string, string> = { pl: "📈", boss: "⚔️", level: "📖", train: "💪", explore: "🗺️", collect: "🟠", wish: "🐉", tournament: "🥋" };

export function QuestsTab() {
  const { s, update } = useGame();
  return (
    <div className="space-y-4">
      {SAGA_ORDER.map((saga) => {
        const status = sagaStatus(s, saga);
        return (
          <div key={saga} className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-display text-2xl text-primary">{saga}</h2>
              <span className="text-sm text-muted-foreground">{status.claimed}/{status.total} quests</span>
            </div>
            {status.complete && !status.bonusClaimed && (
              <Card className="border-chart-1">
                <div className="font-display text-lg text-chart-1">Saga complete!</div>
                <p className="text-sm text-muted-foreground">Claim the saga bonus: {fmt(status.bonus.zeni)} Zeni · {status.bonus.tp} TP</p>
                <Btn className="mt-2" onClick={() => { playBattleSound("win"); update((d) => applyAction(d, { type: "CLAIM_SAGA", saga })); }}>Claim saga bonus</Btn>
              </Card>
            )}
            {status.bonusClaimed && <p className="text-xs text-chart-2">✓ Saga bonus claimed</p>}
            {sagaQuests(saga).map((q) => {
              const claimed = s.quests.includes(q.id);
              const summary = questSummary(s, q.id)!;
              return (
                <Card key={q.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display text-lg">{QUEST_KIND_ICON[q.kind] ?? "•"} {q.title}</div>
                    <div className="text-xs text-muted-foreground">{q.desc}</div>
                    {!claimed && !summary.locked && summary.target > 1 && (
                      <div className="mt-1 flex items-center gap-2">
                        <Bar value={summary.progress} max={summary.target} className="w-40 bg-chart-1" />
                        <span className="text-xs text-muted-foreground">{fmt(summary.progress)} / {fmt(summary.target)}</span>
                      </div>
                    )}
                    <div className="mt-0.5 text-sm text-muted-foreground">Reward: {fmt(q.zeni)} Zeni · {q.tp} TP</div>
                  </div>
                  {claimed ? (
                    <span className="whitespace-nowrap font-display text-chart-2">✓ Claimed</span>
                  ) : summary.locked ? (
                    <span className="max-w-40 text-right text-xs text-muted-foreground">🔒 Requires: {summary.prereqs.filter((p) => !s.quests.includes(p)).map((p) => QUESTS.find((x) => x.id === p)?.title ?? p).join(", ")}</span>
                  ) : (
                    <Btn disabled={!summary.done} onClick={() => { playBattleSound("levelup"); update((d) => applyAction(d, { type: "CLAIM_QUEST", questId: q.id })); }}>{summary.done ? "Claim" : "In progress"}</Btn>
                  )}
                </Card>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function ShopTab() {
  const { s, update, triggerShake } = useGame();
  const [wishing, setWishing] = useState(false);
  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl">Game Passes (TP Medals)</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {PASSES.map((p) => {
          const owned = s.passes.includes(p.id);
          return (
            <Card key={p.id}>
              <div className="font-display text-xl">{p.name}</div>
              <div className="text-sm text-muted-foreground">{p.desc}</div>
              <Btn className="mt-2 w-full" disabled={owned || s.tp < p.tp} onClick={() => update((d) => applyAction(d, { type: "BUY_PASS", passId: p.id }))}>{owned ? "Owned" : `${p.tp} TP`}</Btn>
            </Card>
          );
        })}
      </div>
      <h2 className="font-display text-2xl">Market — Gear & Supplies <span className="text-sm text-muted-foreground">(paid in Zeni)</span></h2>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {EQUIPMENT.map((item) => {
          const ownedQty = s.inventory[item.id] ?? 0;
          const equipped = s.equipped.includes(item.id);
          const done = equipped || ownedQty > 0;
          return (
            <Card key={item.id} className={`card-hover ${equipped ? "ring-2 ring-chart-2" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="text-3xl">{item.icon}</span>
                <div className="min-w-0"><div className="font-display text-base leading-tight">{item.name}</div><div className="text-xs text-muted-foreground">{item.desc}</div></div>
              </div>
              <Btn className="mt-2 w-full" disabled={done || s.zeni < item.cost} onClick={() => update((d) => applyAction(d, { type: "BUY_ITEM", itemId: item.id }))}>
                {equipped ? "Equipped ✓" : ownedQty > 0 ? "In bag — equip in Inventory" : `Buy · ${fmt(item.cost)} Zeni`}
              </Btn>
            </Card>
          );
        })}
        {CONSUMABLES.map((item) => {
          const ownedQty = s.inventory[item.id] ?? 0;
          return (
            <Card key={item.id} className="card-hover">
              <div className="flex items-center gap-2">
                <span className="text-3xl">{item.icon}</span>
                <div className="min-w-0"><div className="font-display text-base leading-tight">{item.name} <span className="text-xs text-muted-foreground">×{ownedQty}</span></div><div className="text-xs text-muted-foreground">{item.desc}</div></div>
              </div>
              <Btn className="mt-2 w-full" disabled={s.zeni < item.cost} onClick={() => update((d) => applyAction(d, { type: "BUY_ITEM", itemId: item.id }))}>Buy · {fmt(item.cost)} Zeni</Btn>
            </Card>
          );
        })}
      </div>
      <h2 className="font-display text-2xl">Dragon Balls</h2>
      <Card>
        <div className="flex gap-2 text-3xl">{Array.from({ length: 7 }, (_, i) => <span key={i} className={i < s.dragonBalls ? "" : "opacity-20 grayscale"}>🟠</span>)}</div>
        <p className="mt-2 text-sm text-muted-foreground">Found from bosses and rare training drops. Gather all 7 to summon Shenron.</p>
        {!wishing ? (
          <Btn className="mt-2" disabled={s.dragonBalls < 7} onClick={() => { setWishing(true); triggerShake(); }}>🐉 Summon Shenron</Btn>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="font-display text-xl text-chart-2">"State your wish. I will grant one."</p>
            {WISHES.map((w) => (
              <Btn key={w.id} className="mr-2" onClick={() => {
                playBattleSound("levelup");
                update((d) => applyAction(d, { type: "MAKE_WISH", wishId: w.id }));
                setWishing(false);
              }}>{w.name} — {w.desc}{w.id === "zeni" ? ` (≈ ${fmt(powerLevel(s) * 100)})` : ""}</Btn>
            ))}
          </div>
        )}
      </Card>
      <h2 className="font-display text-2xl">Transaction History</h2>
      <Card>
        {s.transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet — boss victories, quest payouts, wishes and gear purchases will appear here.</p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {[...s.transactions].reverse().slice(0, 50).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 border-b border-border pb-1">
                <span className="text-muted-foreground">{new Date(t.at).toLocaleString()} · {t.label}</span>
                <span className={t.kind === "credit" ? "text-chart-2" : "text-destructive"}>{t.kind === "credit" ? "+" : "−"}{fmt(t.amount)} {t.currency === "zeni" ? "Zeni" : "TP"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

type TournamentBoss = Boss & { tournament: number };
export function TournamentTab({ onFight }: { onFight: (boss: TournamentBoss) => void }) {
  const { s } = useGame();
  const pl = powerLevel(s);
  const cleared = s.tournamentRound;
  const champion = cleared >= TOURNAMENT.length;
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-display text-3xl">🥋 World Martial Arts Tournament</h2>
        <p className="mt-1 text-sm text-muted-foreground">Four rounds, one champion. These are real fights — every round is effectively at story strength, so you cannot button-mash your way to the title. First-time clears pay the listed reward; rematches pay 15%.</p>
        {champion ? (
          <div className="mt-2 rounded-lg border border-chart-1 bg-secondary p-3 font-display text-xl text-chart-1">👑 Tenkaichi Budokai Champion — your name is carved into tournament history.</div>
        ) : (
          <div className="mt-1 text-xs text-muted-foreground">{cleared}/{TOURNAMENT.length} rounds cleared</div>
        )}
      </Card>
      <ol className="space-y-3">
        {TOURNAMENT.map((round, i) => {
          const template = BOSSES.find((b) => b.id === round.bossId)!;
          const boss: TournamentBoss = {
            ...template,
            id: `tournament-${round.id}`,
            name: round.bossName,
            hp: Math.max(1, Math.floor(template.hp * round.hpMult)),
            atk: Math.max(1, Math.floor(template.atk * round.atkMult)),
            zeni: round.zeni,
            tp: round.tp,
            req: round.entry,
            emoji: round.emoji,
            tournament: i,
          };
          const done = i < cleared;
          const current = i === cleared;
          const future = i > cleared;
          const canEnter = pl >= round.entry && !future;
          return (
            <Card key={round.id} className={current ? "border-primary" : future ? "opacity-60" : ""}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-display text-xl">{round.emoji} Round {i + 1} — {round.name}</div>
                  <div className="text-sm text-muted-foreground">vs {round.bossName} · HP {fmt(boss.hp)} · Entry: Power Level {fmt(round.entry)}+</div>
                  <div className="text-sm text-chart-2">Reward: {fmt(round.zeni)} Zeni · {round.tp} TP{done ? " (rematch: 15%)" : ""}</div>
                </div>
                {done ? (
                  <Btn onClick={() => onFight(boss)}>Rematch (15% rewards)</Btn>
                ) : future ? (
                  <span className="text-sm text-muted-foreground">🔒 Clear round {i} first</span>
                ) : (
                  <Btn disabled={!canEnter} onClick={() => onFight(boss)}>{canEnter ? "Fight!" : `Needs PL ${fmt(round.entry)}`}</Btn>
                )}
              </div>
            </Card>
          );
        })}
      </ol>
    </div>
  );
}

type EndgameBoss = Boss;
export function InventoryTab() {
  const { s, update } = useGame();
  const equip = equipmentBonus(s);
  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl">Equipment <span className="text-sm text-muted-foreground">(paid in Zeni)</span></h2>
      <div className="grid gap-3 md:grid-cols-2">
        {EQUIPMENT.map((item) => {
          const ownedQty = s.inventory[item.id] ?? 0;
          const equipped = s.equipped.includes(item.id);
          return (
            <Card key={item.id} className={equipped ? "ring-2 ring-chart-2" : ""}>
              <div className="flex items-center gap-3">
                <span className="text-4xl">{item.icon}</span>
                <div className="min-w-0"><div className="font-display text-lg">{item.name} <span className="text-xs uppercase text-muted-foreground">· {item.slot}</span></div><div className="text-sm text-muted-foreground">{item.desc}</div></div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-sm text-chart-2">{fmt(item.cost)} Zeni</span>
                {equipped ? (
                  <Btn onClick={() => update((d) => applyAction(d, { type: "UNEQUIP_ITEM", itemId: item.id }))}>Unequip</Btn>
                ) : ownedQty > 0 ? (
                  <Btn onClick={() => update((d) => applyAction(d, { type: "EQUIP_ITEM", itemId: item.id }))}>Equip</Btn>
                ) : (
                  <Btn disabled={s.zeni < item.cost} onClick={() => update((d) => applyAction(d, { type: "BUY_ITEM", itemId: item.id }))}>Buy</Btn>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      <Card>
        <div className="font-display text-lg">Loadout bonus</div>
        <div className="mt-1 flex flex-wrap gap-3 text-sm">
          <span>🛡️ Effective DEF ×{(1 + equip.defenseMult).toFixed(2)}</span>
          <span>💪 Power ×{(1 + equip.allStatsMult).toFixed(2)}</span>
          <span>🏋️ Training ×{(1 + equip.trainingMult).toFixed(2)}</span>
          <span>🧭 Scout find rate +{Math.round(equip.scoutBallBonus * 100)}%</span>
        </div>
        {s.equipped.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Nothing equipped — try the Turtle Shell first (+25% effective Defense).</p>}
      </Card>
      <h2 className="font-display text-2xl">Consumables</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {CONSUMABLES.map((item) => {
          const ownedQty = s.inventory[item.id] ?? 0;
          return (
            <Card key={item.id}>
              <div className="flex items-center gap-3">
                <span className="text-4xl">{item.icon}</span>
                <div><div className="font-display text-lg">{item.name} <span className="text-xs text-muted-foreground">×{ownedQty} owned</span></div><div className="text-sm text-muted-foreground">{item.desc}</div></div>
              </div>
              <Btn className="mt-2 w-full" disabled={s.zeni < item.cost} onClick={() => update((d) => applyAction(d, { type: "BUY_ITEM", itemId: item.id }))}>Buy · {fmt(item.cost)} Zeni</Btn>
              <p className="mt-1 text-xs text-muted-foreground">Usable only during battle (buttons under the arena).</p>
            </Card>
          );
        })}
      </div>
      <h2 className="font-display text-2xl">Technique Mastery</h2>
      <p className="text-sm text-muted-foreground">Techniques level up with real use. Ranks unlock concrete tactical bonuses — not just bigger numbers.</p>
      <div className="space-y-2">
        {TECHNIQUES.map((t) => {
          const uses = Math.floor(s.techniqueUses[t.id] ?? 0);
          const rank = techniqueRank(s, t.id);
          const next = TECHNIQUE_RANKS[rank];
          const floor = rank === 0 ? 0 : TECHNIQUE_RANKS[rank - 1]!;
          return (
            <Card key={t.id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-display">{t.icon} {t.name} <span className="text-chart-2">· Rank {rank}{rank >= TECHNIQUE_RANKS.length ? " (MAX)" : ""}</span></div>
                <div className="text-xs text-muted-foreground">{t.uses}: {fmt(uses)}{next !== undefined ? ` · next rank at ${next} uses` : " · mastered"}</div>
                <div className="text-xs text-chart-1">{t.perks.join(" · ")}</div>
              </div>
              <Bar value={Math.max(0, uses - floor)} max={next !== undefined ? next - floor : 1} className="w-40 bg-chart-1" />
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function EndgameTab({ onFight }: { onFight: (boss: EndgameBoss) => void }) {
  const { s } = useGame();
  const pl = powerLevel(s);
  const [wave, setWave] = useState(() => Math.max(1, Math.min(9999, s.survivalBest + 1)));
  const [modifier, setModifier] = useState<EndlessModifierId>("none");
  const preview = endlessBoss(wave, modifier);
  const modChoice = ENDLESS_MODIFIERS.find((m) => m.id === modifier) ?? ENDLESS_MODIFIERS[0]!;
  const wavePresets = [1, 5, 10, 25, 50, 100];
  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-primary/50 bg-gradient-to-br from-chart-5 via-secondary to-background p-6 shadow-[0_0_60px_-20px_var(--primary)]">
        <div className="pointer-events-none absolute -right-10 -top-16 select-none text-[9rem] leading-none opacity-10">♾️</div>
        <div className="relative">
          <div className="font-display text-xs uppercase tracking-[0.3em] text-chart-1">The Infinite Gauntlet</div>
          <h2 className="mt-1 font-display text-5xl leading-none text-foreground drop-shadow">Endless<br /><span className="text-primary">Survival</span></h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">A gauntlet without an end. Every wave is deadlier than the last — climb as high as your legs will carry you. What you win every clear, you get to keep. Forever.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-chart-2 bg-chart-2/10 px-3 py-1 font-display text-chart-2">🏆 Best: Wave {s.survivalBest}</span>
            <span className="rounded-full border border-chart-1 bg-chart-1/10 px-3 py-1 font-display text-chart-1">Tokens scale every wave</span>
            <span className="rounded-full border border-primary/50 px-3 py-1 font-display text-primary">No continues. No mercy.</span>
          </div>
        </div>
      </div>

      {/* Modifier cards */}
      <section aria-label="Challenge modifiers">
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="font-display text-xl text-muted-foreground">Challenge Modifiers</h3>
          <span className="text-xs text-muted-foreground">Payout ×{modChoice.rewardMult}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {ENDLESS_MODIFIERS.map((m) => {
            const active = modifier === m.id;
            return (
              <button key={m.id} onClick={() => setModifier(m.id)} aria-pressed={active}
                className={`rounded-xl border-2 p-3 text-left transition-all duration-150 ${active ? "border-primary bg-primary/10 shadow-[0_0_25px_-10px_var(--primary)]" : "border-border bg-card/60 hover:border-primary/50"}`}>
                <div className="font-display text-lg leading-tight">{m.id === "none" ? "⚪" : m.id === "aggression" ? "😡" : "🧊"} {m.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{m.desc}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Wave selection */}
      <section aria-label="Wave selection" className="rounded-xl border border-border bg-card/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Choose your wave</div>
            <div className="font-display text-6xl text-primary leading-none">{wave}</div>
          </div>
          <div className="flex-1 min-w-56">
            <input type="range" min={1} max={9999} value={wave} onChange={(e) => setWave(Math.max(1, Math.min(9999, Math.floor(+e.target.value || 1))))} className="w-full" aria-label="Wave" />
            <div className="mt-1 flex flex-wrap gap-1">
              {wavePresets.map((p) => <button key={p} onClick={() => setWave(p)} className={`rounded px-2 py-0.5 text-xs font-display ${wave === p ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{p}</button>)}
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="text-xs text-muted-foreground">Opponent</div>
            <div className="font-display text-lg">vs {preview.name.split("— ")[1]}</div>
            <div className="text-xs text-muted-foreground">HP {fmt(preview.hp)} · ATK {fmt(preview.atk)}</div>
            <div className="mt-1 text-chart-2">{fmt(preview.zeni)} Zeni · {preview.tp} TP</div>
            <Btn className="mt-2 px-6 py-3 text-xl" onClick={() => onFight(preview)}>Fight Wave {wave} →</Btn>
          </div>
        </div>
      </section>

      {/* Raid bosses */}
      <section aria-label="Raid bosses">
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="font-display text-xl text-muted-foreground">🐉 Raid Bosses — For the Legends Only</h3>
          <span className="text-xs text-muted-foreground">First-clear: guaranteed Dragon Ball</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {RAID_BOSSES.map((raid, idx) => {
            const cleared = s.defeated.includes(raid.base.id);
            const canEnter = pl >= raid.entry;
            const grad = idx === 0
              ? "from-green-950 via-emerald-900/40 to-background"
              : "from-red-950 via-rose-900/40 to-background";
            return (
              <div key={raid.id} className={`relative overflow-hidden rounded-2xl border-2 ${canEnter ? "border-chart-5" : "border-border"} bg-gradient-to-br ${grad} p-5 transition-transform hover:-translate-y-0.5`}>
                <div className="absolute -right-3 -top-6 select-none text-8xl opacity-15">{raid.emoji}</div>
                <div className="relative">
                  <div className="font-display text-xs uppercase tracking-widest text-chart-5">{cleared ? "Felled — rematch pays 15%" : "Raid target"}</div>
                  <div className="mt-1 font-display text-2xl leading-tight">{raid.name}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{raid.desc}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="rounded bg-background/50 p-2"><div className="text-muted-foreground">ENTRY GATE</div><div className="font-display text-sm text-foreground">{fmt(raid.entry)} PL</div></div>
                    <div className="rounded bg-background/50 p-2"><div className="text-muted-foreground">REWARD</div><div className="font-display text-sm text-chart-2">{fmt(raid.zeni)} Zeni · {raid.tp} TP</div></div>
                    <div className="rounded bg-background/50 p-2"><div className="text-muted-foreground">HP</div><div className="font-display text-sm text-foreground">{fmt(raid.base.hp)}</div></div>
                    <div className="rounded bg-background/50 p-2"><div className="text-muted-foreground">ATK</div><div className="font-display text-sm text-foreground">{fmt(raid.base.atk)}</div></div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-sm text-chart-2">{raid.ballOnFirstClear ? "🟠 First clear grants a Dragon Ball" : "Bonus TP payout"}</div>
                    <Btn className="px-5" disabled={!canEnter} onClick={() => onFight({ ...raid.base })}>{canEnter ? "Challenge" : `🔒 ${fmt(raid.entry)} PL`}</Btn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

