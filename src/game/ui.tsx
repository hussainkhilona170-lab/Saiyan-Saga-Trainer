import { useEffect, useRef, useState } from "react";
import { BOSSES, FORMS, LOCATIONS, PASSES, QUESTS, TRAININGS, WISHES, fmt, type Boss, type StatKey } from "./data";
import { allForms, applyAction, applyBattleRewards, applyShadowRewards, CUSTOM_FORM_MAX_MULT, findForm, battleClashDelay, battleClashPressure, canUnlockForm, formMult, gravMult, openSave, initialBattleState, levelForXp, powerLevel, questDone, rankForLevel, resolveBattleAction, shadowDummyBoss, SHADOW_REWARD_MULT, SHADOW_ZENKAI_HP_FRACTION, SHADOW_ZENKAI_MULT, xpRequiredForLevel, type BattleState } from "./engine";
import { exportSlotText } from "./persistence";
import { registerBattleHandler, sendBattleCommand, type BattleCommand } from "./battleBus";
import { useBattleControls } from "./controls";
import { useGame } from "./store";
import { playBattleSound, StickmanArena, type BattleAction, type BattleSound } from "./arena";

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
      onClick={(e) => add(e, "+" + fmt(train(t.stat)))}
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
  const { s, update, trainGravity } = useGame();
  const { add, layer } = useFloats();
  const pl = powerLevel(s);
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
      <button onClick={(e) => { trainGravity(); add(e, "G↑"); }} className="relative w-full select-none rounded-xl border-2 border-destructive/50 bg-secondary p-4 text-left active:scale-[0.98]">
        <div className="flex items-center justify-between">
          <div><span className="text-2xl">🌀</span> <span className="font-display text-xl">Gravity Chamber — {s.gravity * 10}G</span>
            <div className="text-sm text-muted-foreground">Overall multiplier ×{gravMult(s).toFixed(2)}</div></div>
        </div>
        <Bar value={s.gravityProgress} max={s.gravity * 25} className="mt-2 bg-destructive" />
        {layer}
      </button>
      {s.passes.includes("auto") && (
        <Card><span className="font-display">Auto-Train target: </span>
          {TRAININGS.map((t) => (
            <button key={t.id} onClick={() => update((d) => { d.autoTarget = t.stat as StatKey; })}
              className={`ml-2 rounded px-2 py-1 text-sm ${s.autoTarget === t.stat ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{t.name}</button>
          ))}
        </Card>
      )}
      <h3 className="font-display text-2xl">Training Locations</h3>
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

export function Bar({ value, max, className = "bg-primary" }: { value: number; max: number; className?: string }) {
  return <div className="h-3 w-full overflow-hidden rounded-full bg-muted"><div className={`h-full transition-all ${className}`} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} /></div>;
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
          <Card key={f.id} className={s.activeForm === f.id ? "ring-2 ring-primary" : ""}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full" style={{ background: f.aura, boxShadow: `0 0 20px ${f.aura}` }} />
              <div className="flex-1"><div className="font-display text-xl">{f.name}</div><div className="text-sm text-muted-foreground">×{fmt(f.mult)} power · {f.custom ? "Custom form" : `Level ${f.levelReq}`}</div></div>
              {f.custom && <button className="text-sm text-destructive underline" onClick={() => { if (confirm(`Delete ${f.name}?`)) update((d) => applyAction(d, { type: "DELETE_FORM", formId: f.id })); }}>Delete</button>}
            </div>
            <div className="mt-3">
              {owned ? (
                <Btn className="w-full" disabled={s.activeForm === f.id} onClick={() => { update((d) => applyAction(d, { type: "TRANSFORM", formId: f.id })); if (f.id !== "base") triggerShake(); }}>
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
        <label className="text-sm">Power ×{fmt(mult)}<input type="range" min={1} max={CUSTOM_FORM_MAX_MULT} value={mult} onChange={(e) => setMult(+e.target.value)} className="mt-2 w-full" /></label>
        <label className="text-sm">Aura<input type="color" value={aura} onChange={(e) => setAura(e.target.value)} className="mt-1 block h-9 w-full rounded" /></label>
        <label className="text-sm">Hair<input type="color" value={hair} onChange={(e) => setHair(e.target.value)} className="mt-1 block h-9 w-full rounded" /></label>
        <Btn disabled={!name.trim()} onClick={create}>Create & Transform</Btn>
      </div>
      <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
        <div className="h-8 w-8 rounded-full" style={{ background: aura, boxShadow: `0 0 18px ${aura}` }} />
        <div className="h-8 w-8 rounded-full border-2 border-border" style={{ background: hair }} />
        <span>Preview of aura and hair colour in the arena</span>
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
    const t = setInterval(() => dispatchBattle({ type: "ENEMY_TICK", playerMaxHp: maxP }), 1000);
    return () => clearInterval(t);
  }, [boss, battle.phase, maxP]); // eslint-disable-line

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
  }, [clashActive, boss]); // eslint-disable-line

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
      if (wonBoss.id === "shadow-self") {
        const zenkai = battle.playerHp / Math.max(1, maxP) < SHADOW_ZENKAI_HP_FRACTION;
        const factor = zenkai ? SHADOW_ZENKAI_MULT : SHADOW_REWARD_MULT;
        update((d) => applyShadowRewards(d, zenkai));
        if (soundOn) playBattleSound("win");
        setBattle((current) => ({ ...current, boss: null, phase: "idle", message: `Shadow Self conquered! All stats ×${factor}${zenkai ? " — ZENKAI BOOST! Stamina fully restored." : ""}` }));
      } else {
        const ball = Math.random() < 0.5;
        update((d) => applyBattleRewards(d, wonBoss, ball));
        setBattle((current) => ({ ...current, boss: null, phase: "idle", message: `You defeated ${wonBoss.name}! +${fmt(wonBoss.zeni)} Zeni, +${wonBoss.tp} TP${ball ? ", found a Dragon Ball!" : ""}` }));
      }
    } else if (battle.phase === "lost") {
      if (soundOn) playBattleSound("lose");
      setBattle((current) => ({ ...current, boss: null, phase: "idle" }));
    }
  }, [battle.phase, battle.clashCount, boss, update, soundOn]);

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
    if (event) add(event, `${battle.combo > 0 ? `${battle.combo + 1} HIT · ` : "👊 "}`);
    setAction("punch"); setActionTick((n) => n + 1);
    if (soundOn) playBattleSound("punch");
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => dispatchBattle({ type: "RESET_COMBO", now: Date.now() }), 1100);
  };
  const runBlast = () => {
    if (!boss || clashActive || ki < 20) return;
    dispatchBattle({ type: "BLAST" });
    setAction("blast"); setActionTick((n) => n + 1);
    if (soundOn) playBattleSound("blast");
  };
  const runUltimate = () => {
    if (!boss || clashActive || ki < 100) return;
    dispatchBattle({ type: "ULTIMATE" });
    setAction("kamehameha"); setActionTick((n) => n + 1); triggerShake();
    if (soundOn) playBattleSound("ultimate");
  };
  const runVanish = () => {
    if (!boss || clashActive || ki < 15) return;
    dispatchBattle({ type: "VANISH" });
    setAction("vanish"); setActionTick((n) => n + 1);
    if (soundOn) playBattleSound("vanish");
  };
  const runCharge = () => dispatchBattle({ type: "CHARGE", amount: 2.5 });
  useBattleControls({ punch: () => runPunch(), blast: runBlast, ultimate: runUltimate, vanish: runVanish, charge: runCharge });
  const charge = useHold(() => dispatchBattle({ type: "CHARGE", amount: 4 }));

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
              <Card key={b.id}>
                <div className="text-5xl">{b.emoji}</div>
                <div className="font-display text-2xl">{b.name} {s.defeated.includes(b.id) && "✅"}</div>
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
      <div className="flex justify-between text-sm"><span>Opponent • {fmt(Math.max(0, hp))} HP</span><span>You • {fmt(Math.max(0, php))} HP</span></div>
      <div className="grid grid-cols-2 gap-2"><Bar value={hp} max={boss.hp} className="bg-destructive" /><Bar value={php} max={maxP} className="bg-chart-2" /></div>
      <StickmanArena boss={boss} formName={form.name} aura={form.aura} hair={form.hair} darkAura={s.darkAura} action={action} actionTick={actionTick} clashActive={clashActive} clashProgress={clashProgress} playerHp={php} playerMaxHp={maxP} bossHp={hp} onArenaClick={() => runPunch()} onArenaAltClick={runVanish} />
      {clashActive && <div className="space-y-2 border-l-2 border-primary pl-3" role="status">
        <div className="flex items-center justify-between gap-2 font-display text-sm"><span>BEAM STRUGGLE</span><span>{Math.ceil(Math.max(0, 8 - (Date.now() - clashStartedRef.current) / 1000))}s</span></div>
        <Bar value={clashProgress} max={100} className="bg-primary" />
        <button type="button" className="w-full select-none touch-manipulation rounded-md bg-primary py-3 font-display text-lg text-primary-foreground active:scale-[0.99]" onPointerDown={(event) => { event.preventDefault(); pushClash(); if (!clashTapRef.current) clashTapRef.current = setInterval(pushClash, 110); }} onPointerUp={() => { if (clashTapRef.current) clearInterval(clashTapRef.current); clashTapRef.current = null; }} onPointerLeave={() => { if (clashTapRef.current) clearInterval(clashTapRef.current); clashTapRef.current = null; }} onPointerCancel={() => { if (clashTapRef.current) clearInterval(clashTapRef.current); clashTapRef.current = null; }} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && !event.repeat) { event.preventDefault(); pushClash(); } }}>⚡ Tap or hold to overpower</button>
      </div>}
      <div className="flex justify-between text-sm"><span>Ki</span><span>{Math.floor(ki)}%</span></div>
      <Bar value={ki} max={100} className="bg-chart-1" />
      <div className="relative grid grid-cols-2 gap-2 md:grid-cols-4">
        <Btn className="py-5 text-lg" disabled={clashActive} onClick={(e) => { runPunch(e); dispatchBattle({ type: "CHARGE", amount: 2 }); }}>👊 Punch <kbd className="ml-1 text-sm">J</kbd></Btn>
        <Btn className="py-5 text-lg" disabled={ki < 20 || clashActive} onClick={() => runBlast()}>💥 Ki Blast <kbd className="ml-1 text-sm">K</kbd></Btn>
        <Btn className="py-5 text-lg" disabled={ki < 100 || clashActive} onClick={() => runUltimate()}>🌊 Kamehameha <kbd className="ml-1 text-sm">L</kbd></Btn>
        <button {...charge} disabled={clashActive} className="select-none rounded-lg bg-chart-1 py-5 font-display text-lg text-primary-foreground active:scale-95 disabled:opacity-40">⚡ Charge <kbd className="ml-1 text-sm">C</kbd></button>
        <Btn className="col-span-2 py-4 text-lg md:col-span-4" disabled={ki < 15 || clashActive} onClick={() => runVanish()}>💨 Vanish Strike <kbd className="ml-2 text-sm">Shift · right-click arena</kbd></Btn>
        {layer}
      </div>
      <p className="font-display text-xs text-muted-foreground">KEYS: J / SPACE punch · K ki blast · L Kamehameha · C charge · SHIFT vanish · click punch · right-click vanish</p>
      {combo > 1 && <div className="font-display text-sm text-primary" role="status">{combo} HIT COMBO</div>}
      {log && <p className="font-display text-lg text-primary" role="status">{log}</p>}
      <button type="button" className="text-sm text-muted-foreground underline" onClick={() => { if (clashIntervalRef.current) clearInterval(clashIntervalRef.current); dispatchBattle({ type: "FLEE" }); }}>Flee</button>
    </div>
  );
}

export function QuestsTab() {
  const { s, update } = useGame();
  let saga = "";
  return (
    <div className="space-y-2">
      {QUESTS.map((q) => {
        const header = q.saga !== saga ? (saga = q.saga, <h3 className="mt-3 font-display text-2xl text-primary">{q.saga}</h3>) : null;
        const claimed = s.quests.includes(q.id); const done = questDone(s, q.id);
        return (
          <div key={q.id}>{header}
            <Card className="flex items-center justify-between">
              <div><div className="font-display text-lg">{q.title}</div><div className="text-sm text-muted-foreground">Reward: {fmt(q.zeni)} Zeni, {q.tp} TP</div></div>
              <Btn disabled={claimed || !done} onClick={() => update((d) => applyAction(d, { type: "CLAIM_QUEST", questId: q.id }))}>{claimed ? "Claimed" : done ? "Claim" : "In progress"}</Btn>
            </Card>
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
      <h3 className="font-display text-2xl">Game Passes (TP Medals)</h3>
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
      <h3 className="font-display text-2xl">Dragon Balls</h3>
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
                update((d) => applyAction(d, { type: "MAKE_WISH", wishId: w.id }));
                setWishing(false);
              }}>{w.name} — {w.desc}{w.id === "zeni" ? ` (≈ ${fmt(powerLevel(s) * 100)})` : ""}</Btn>
            ))}
          </div>
        )}
      </Card>
      <h3 className="font-display text-2xl">Transaction History</h3>
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

type GodTab = "player" | "forms" | "battle" | "world" | "system";
const GOD_TABS: { id: GodTab; label: string }[] = [
  { id: "player", label: "Player Lab" },
  { id: "forms", label: "Forms & Passes" },
  { id: "battle", label: "Battle & Bosses" },
  { id: "world", label: "World & Quests" },
  { id: "system", label: "System" },
];

export function AdminPanel({ onClose, onSpawn }: { onClose: () => void; onSpawn: (b: Boss) => void }) {
  const { s, update, reset, slot, switchSlot, restore } = useGame();
  const [tab, setTab] = useState<GodTab>("player");
  const [snapshot, setSnapshot] = useState("");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [name, setName] = useState("Broly");
  const [hp, setHp] = useState("1000000");
  const [atk, setAtk] = useState("5000");
  const row = "flex items-center justify-between gap-2 border-b border-border py-2";
  const field = "w-32 rounded bg-input px-2 py-1 text-right text-foreground";
  const grid = "grid grid-cols-2 gap-2";
  const mode = s.godMode ? "GOD MODE" : slot === "sandbox" ? "SANDBOX MODE" : "REALITY MODE";
  const modeClass = s.godMode ? "border-destructive text-destructive" : slot === "sandbox" ? "border-chart-1 text-chart-1" : "border-border text-muted-foreground";
  const statRows: [string, StatKey][] = [["Strength", "strength"], ["Agility", "agility"], ["Ki", "ki"], ["Defense", "defense"]];
  const exportSave = () => {
    const blob = new Blob([exportSlotText(s)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `god-engine-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Esc closes the panel (except while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)))) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border-2 border-primary/60 bg-card shadow-[0_0_45px_rgba(124,88,255,0.28)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-3">
            <span className="font-display text-2xl text-primary">⚙ GOD ENGINE</span>
            <span className={`rounded border px-2 py-0.5 font-display text-xs ${modeClass}`}>{mode}</span>
          </div>
          <button aria-label="Close God Engine" onClick={onClose} className="px-2 text-lg">✕</button>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-b border-border p-2">
          {GOD_TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`whitespace-nowrap rounded px-3 py-1.5 font-display text-sm ${tab === t.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{t.label}</button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
          {tab === "player" && (
            <div className="space-y-1">
              <div className="flex justify-between font-display text-lg"><span>Power Level</span><span className="text-primary">{fmt(powerLevel(s))}</span></div>
              {statRows.map(([label, k]) => (
                <div key={k} className={row}>
                  <span>{label}</span>
                  <input type="number" min={0} aria-label={label} value={Math.round(s.stats[k] * 100) / 100} onChange={(e) => update((d) => { d.stats[k] = Math.max(0, +e.target.value || 0); })} className={field} />
                </div>
              ))}
              <div className={row}>
                <span>Level</span>
                <input type="number" min={1} max={100} aria-label="Level" value={s.level} onChange={(e) => update((d) => { const lv = Math.max(1, Math.min(100, Math.floor(+e.target.value || 1))); d.level = lv; d.xp = xpRequiredForLevel(lv); })} className={field} />
              </div>
              <div className={row}>
                <span>XP</span>
                <input type="number" min={0} aria-label="XP" value={Math.floor(s.xp)} onChange={(e) => update((d) => { d.xp = Math.max(0, Math.floor(+e.target.value || 0)); d.level = levelForXp(d.xp); })} className={field} />
              </div>
              {statRows.map(([label, k]) => (
                <div key={k} className={row}>
                  <span>Mastery · {label}</span>
                  <input type="number" min={0} max={100} aria-label={`${label} mastery`} value={Math.round(s.mastery[k])} onChange={(e) => update((d) => { d.mastery[k] = Math.max(0, Math.min(100, +e.target.value || 0)); })} className={field} />
                </div>
              ))}
              <div className={row}>
                <span>Stamina</span>
                <div className="flex gap-2">
                  <input type="number" min={0} aria-label="Stamina" value={Math.floor(s.stamina)} onChange={(e) => update((d) => { d.stamina = Math.max(0, +e.target.value || 0); })} className={field} />
                  <Btn onClick={() => update((d) => { d.stamina = d.maxStamina; })}>Max</Btn>
                </div>
              </div>
              <div className={row}>
                <span>Zeni</span>
                <input type="number" min={0} aria-label="Zeni" value={Math.floor(s.zeni)} onChange={(e) => update((d) => { d.zeni = Math.max(0, Math.floor(+e.target.value || 0)); })} className={field} />
              </div>
              <div className={row}>
                <span>TP Medals</span>
                <input type="number" min={0} aria-label="TP Medals" value={Math.floor(s.tp)} onChange={(e) => update((d) => { d.tp = Math.max(0, Math.floor(+e.target.value || 0)); })} className={field} />
              </div>
              <div className={row}>
                <span>Gravity</span>
                <input type="number" min={1} max={1000} aria-label="Gravity" value={s.gravity} onChange={(e) => update((d) => { d.gravity = Math.max(1, Math.floor(+e.target.value || 1)); d.gravityProgress = 0; })} className={field} />
              </div>
              <div className={`${grid} pt-3`}>
                <Btn onClick={() => update((d) => (Object.keys(d.stats) as StatKey[]).forEach((k) => { d.stats[k] = d.stats[k] * 10 + 100; }))}>Stats ×10</Btn>
                <Btn onClick={() => update((d) => (Object.keys(d.mastery) as StatKey[]).forEach((k) => { d.mastery[k] = 100; }))}>Max Mastery</Btn>
                <Btn onClick={() => update((d) => { d.zeni += 1e9; d.tp += 1000; })}>+1B Zeni · +1000 TP</Btn>
                <Btn onClick={() => update((d) => { d.stamina = d.maxStamina; })}>Refill Stamina</Btn>
              </div>
            </div>
          )}

          {tab === "forms" && (
            <div className="space-y-1">
              <div className={`${grid} pb-2`}>
                <Btn onClick={() => update((d) => { d.forms = [...FORMS.map((f) => f.id), ...d.customForms.map((f) => f.id)]; })}>Unlock all forms</Btn>
                <Btn onClick={() => update((d) => { d.forms = ["base"]; d.activeForm = "base"; })}>Lock all → Base</Btn>
              </div>
              {allForms(s).map((f) => {
                const owned = s.forms.includes(f.id);
                return (
                  <div key={f.id} className={row}>
                    <div className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full" style={{ background: f.aura }} />
                      <span>{f.name}</span>
                      <span className="text-muted-foreground">×{fmt(f.mult)}</span>
                    </div>
                    <div className="flex gap-1">
                      {owned ? (
                        <>
                          <Btn disabled={s.activeForm === f.id} onClick={() => update((d) => { d.activeForm = f.id; })}>{s.activeForm === f.id ? "Active" : "Set active"}</Btn>
                          {f.id !== "base" && <Btn onClick={() => update((d) => { d.forms = d.forms.filter((x) => x !== f.id); if (d.activeForm === f.id) d.activeForm = "base"; })}>Lock</Btn>}
                        </>
                      ) : (
                        <Btn onClick={() => update((d) => { d.forms.push(f.id); })}>Unlock</Btn>
                      )}
                    </div>
                  </div>
                );
              })}
              <h4 className="pt-3 font-display text-lg">Game Passes</h4>
              {PASSES.map((p) => {
                const owned = s.passes.includes(p.id);
                return (
                  <div key={p.id} className={row}>
                    <span>{p.name}</span>
                    <Btn onClick={() => update((d) => { if (owned) d.passes = d.passes.filter((x) => x !== p.id); else d.passes.push(p.id); })}>{owned ? "Owned ✓ (remove)" : "Grant"}</Btn>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "battle" && (
            <div className="space-y-3">
              <h4 className="font-display text-lg">Boss roster — spawn instantly</h4>
              <div className={grid}>
                {BOSSES.map((b) => <Btn key={b.id} onClick={() => onSpawn(b)}>{b.emoji} {b.name}</Btn>)}
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 font-display">Custom boss creator</div>
                <div className="grid grid-cols-3 gap-2">
                  <input value={name} onChange={(e) => setName(e.target.value)} className="rounded bg-input px-2 py-1 text-foreground" placeholder="Name" aria-label="Boss name" />
                  <input value={hp} onChange={(e) => setHp(e.target.value)} className="rounded bg-input px-2 py-1 text-foreground" placeholder="HP" aria-label="Boss HP" />
                  <input value={atk} onChange={(e) => setAtk(e.target.value)} className="rounded bg-input px-2 py-1 text-foreground" placeholder="ATK" aria-label="Boss ATK" />
                </div>
                <Btn className="mt-2 w-full" onClick={() => onSpawn({ id: "custom-" + Date.now(), name: name || "Mystery Foe", hp: +hp || 1, atk: +atk || 0, zeni: (+hp || 1) / 4, tp: 10, req: 0, emoji: "😈" })}>Spawn & Fight</Btn>
              </div>
              <div className="rounded-lg border border-primary/40 p-3">
                <div className="font-display">Live battle overrides</div>
                <p className="mb-2 text-xs text-muted-foreground">Apply to the fight currently running in the Battle tab.</p>
                <div className={grid}>
                  <Btn onClick={() => sendBattleCommand({ type: "FORCE_WIN" })}>Instant Kill Boss</Btn>
                  <Btn onClick={() => sendBattleCommand({ type: "HEAL_PLAYER" })}>Heal Player</Btn>
                  <Btn onClick={() => sendBattleCommand({ type: "SET_BOSS_HP", pct: 0.01 })}>Boss → 1% HP</Btn>
                  <Btn onClick={() => sendBattleCommand({ type: "REFILL_KI" })}>Refill Ki</Btn>
                  <Btn onClick={() => sendBattleCommand({ type: "FORCE_CLASH" })}>Force Beam Clash</Btn>
                  <Btn onClick={() => sendBattleCommand({ type: "FORCE_FLEE" })}>Force Flee</Btn>
                </div>
              </div>
            </div>
          )}

          {tab === "world" && (
            <div className="space-y-3">
              <h4 className="font-display text-lg">Teleport to any location</h4>
              <div className={grid}>
                {LOCATIONS.map((l) => (
                  <Btn key={l.id} onClick={() => update((d) => { d.location = l.id; })}>{s.location === l.id ? `${l.name} ✓` : l.name}</Btn>
                ))}
              </div>
              <h4 className="pt-2 font-display text-lg">Saga quests</h4>
              <div className={grid}>
                <Btn onClick={() => update((d) => { QUESTS.forEach((q) => applyAction(d, { type: "FORCE_CLAIM_QUEST", questId: q.id })); })}>Complete & Claim All</Btn>
                <Btn onClick={() => update((d) => { d.quests = []; })}>Reset all quests</Btn>
              </div>
              {QUESTS.map((q) => {
                const claimed = s.quests.includes(q.id);
                return (
                  <div key={q.id} className={row}>
                    <span>{q.saga} · {q.title}</span>
                    <Btn onClick={() => update((d) => { if (claimed) d.quests = d.quests.filter((x) => x !== q.id); else applyAction(d, { type: "FORCE_CLAIM_QUEST", questId: q.id }); })}>{claimed ? "Claimed ✓ (reset)" : "Force claim"}</Btn>
                  </div>
                );
              })}
              <h4 className="pt-2 font-display text-lg">Dragon Balls</h4>
              <div className="flex flex-wrap items-center gap-2">
                <span>{s.dragonBalls}/7 collected</span>
                <Btn onClick={() => update((d) => { d.dragonBalls = Math.min(7, d.dragonBalls + 1); })}>+1</Btn>
                <Btn onClick={() => update((d) => { d.dragonBalls = Math.max(0, d.dragonBalls - 1); })}>−1</Btn>
                <Btn onClick={() => update((d) => { d.dragonBalls = 7; })}>Set 7</Btn>
                <Btn onClick={() => update((d) => { d.dragonBalls = 0; })}>Set 0</Btn>
              </div>
              <h4 className="pt-2 font-display text-lg">Boss defeat flags</h4>
              {BOSSES.map((b) => {
                const done = s.defeated.includes(b.id);
                return (
                  <div key={b.id} className={row}>
                    <span>{b.emoji} {b.name}</span>
                    <Btn onClick={() => update((d) => { if (done) d.defeated = d.defeated.filter((x) => x !== b.id); else d.defeated.push(b.id); })}>{done ? "Defeated ✓ (reset)" : "Mark defeated"}</Btn>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "system" && (
            <div className="space-y-3">
              <div className={row}><span>God Mode — no damage taken, no stamina cost</span><Btn onClick={() => update((d) => { d.godMode = !d.godMode; })}>{s.godMode ? "ON" : "OFF"}</Btn></div>
              <div className={row}><span>Unlimited Zeni</span><Btn onClick={() => update((d) => { d.infiniteZeni = !d.infiniteZeni; if (!d.infiniteZeni) d.zeni = 0; })}>{s.infiniteZeni ? "ON" : "OFF"}</Btn></div>
              <h4 className="pt-2 font-display text-lg">Operating mode</h4>
              <p className="text-xs text-muted-foreground">Sandbox keeps experiments in a separate save file — main progress stays untouched. A fresh sandbox starts as a clone of your main save.</p>
              <div className={grid}>
                <Btn disabled={slot === "main"} onClick={() => switchSlot("main")}>{slot === "main" ? "REALITY (active)" : "Switch to REALITY"}</Btn>
                <Btn disabled={slot === "sandbox"} onClick={() => switchSlot("sandbox")}>{slot === "sandbox" ? "SANDBOX (active)" : "Switch to SANDBOX"}</Btn>
              </div>
              <h4 className="pt-2 font-display text-lg">Snapshot</h4>
              <div className={grid}>
                <Btn onClick={() => setSnapshot(exportSlotText(s))}>Take snapshot</Btn>
                <Btn disabled={!snapshot} onClick={() => { const st = openSave(snapshot); if (st) { restore(st); setSnapshot(""); } else setImportError("Snapshot failed to validate — discarded."); }}>Restore snapshot</Btn>
              </div>
              <h4 className="pt-2 font-display text-lg">Save management</h4>
              <div className={grid}>
                <Btn onClick={exportSave}>Export versioned JSON</Btn>
                <Btn onClick={() => { setImportText(exportSlotText(s)); setImportError(""); }}>Load current into box</Btn>
              </div>
              <textarea value={importText} onChange={(e) => { setImportText(e.target.value); setImportError(""); }} rows={4} placeholder="Paste save JSON here, then Import" aria-label="Save JSON import" className="w-full rounded bg-input p-2 font-mono text-xs text-foreground" />
              {importError && <p className="text-xs text-destructive" role="alert">{importError}</p>}
              <Btn className="w-full" onClick={() => { const st = openSave(importText); if (st) { restore(st); setImportText(""); } else setImportError("Not a valid save file — imported data failed validation and was rejected."); }}>Import save</Btn>
              <Btn className="w-full" onClick={() => { if (confirm(`Wipe this ${slot === "main" ? "main" : "sandbox"} save completely?`)) reset(); }}>Wipe save (factory reset)</Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
