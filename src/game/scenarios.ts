// Scenario Creator persistence: named, validated, reusable battle configurations. Pure module.
import { FORMS, type Form, type StatKey } from "./data";
import { clampSaveNumber, findForm, levelForXp, xpRequiredForLevel, type GameState } from "./engine";

export const SCENARIOS_KEY = "db-god-engine-scenarios";
const MAX_SCENARIOS = 50;

export type ScenarioBuild = {
  stats: Record<StatKey, number>;
  level: number;
  xp: number;
  mastery: Record<StatKey, number>;
  gravity: number;
  formId: string;
  /** Copies of custom transformation definitions, so custom-form scenarios survive round trips. */
  customForms: Form[];
};
export type Scenario = {
  id: string;
  name: string;
  notes: string;
  createdAt: number;
  bossId: string;
  build: ScenarioBuild;
};

export function createScenario(s: GameState, name: string, bossId: string, notes = "", now = Date.now()): Scenario {
  return {
    id: `sc-${now}-${Math.floor(Math.random() * 1e6).toString(36)}`.slice(0, 40),
    name: name.trim().slice(0, 60) || "Untitled scenario",
    notes: notes.slice(0, 200),
    createdAt: now,
    bossId: bossId.slice(0, 60),
    build: {
      stats: { strength: s.stats.strength, agility: s.stats.agility, ki: s.stats.ki, defense: s.stats.defense },
      level: s.level,
      xp: s.xp,
      mastery: { strength: s.mastery.strength, agility: s.mastery.agility, ki: s.mastery.ki, defense: s.mastery.defense },
      gravity: s.gravity,
      formId: s.activeForm,
      customForms: structuredClone(s.customForms),
    },
  };
}

const STAT_KEYS: readonly StatKey[] = ["strength", "agility", "ki", "defense"];

/** Validates scenario-carried custom forms with the same safety rules as the save hydrator. */
export function parseCustomForms(raw: unknown): Form[] {
  if (!Array.isArray(raw)) return [];
  const out: Form[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const f = entry as Partial<Form>;
    if (typeof f.id !== "string" || !f.id.startsWith("custom-")) continue;
    if (typeof f.name !== "string" || !f.name.trim() || f.name.length > 30) continue;
    const mult = typeof f.mult === "number" && isFinite(f.mult) ? Math.max(1, Math.min(1e5, f.mult)) : 1;
    const aura = typeof f.aura === "string" && f.aura.length <= 40 ? f.aura : "#ffd166";
    out.push({ id: f.id.slice(0, 40), name: f.name.trim(), mult, req: 0, cost: 0, aura, levelReq: 1, custom: true });
    if (out.length >= 20) break;
  }
  return out;
}

export function parseScenario(raw: unknown): Scenario | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Partial<Scenario>;
  if (typeof r.id !== "string" || typeof r.name !== "string" || typeof r.bossId !== "string") return null;
  if (!r.build || typeof r.build !== "object") return null;
  const build = r.build as Partial<ScenarioBuild>;
  const stats = {} as Record<StatKey, number>;
  const mastery = {} as Record<StatKey, number>;
  for (const k of STAT_KEYS) {
    stats[k] = clampSaveNumber(build.stats?.[k], 1, 1e15);
    mastery[k] = Math.max(0, Math.min(100, clampSaveNumber(build.mastery?.[k], 0, 100)));
  }
  const level = Math.max(1, Math.min(100, Math.floor(clampSaveNumber(build.level, 1, 100))));
  return {
    id: r.id.slice(0, 40),
    name: r.name.trim().slice(0, 60) || "Untitled scenario",
    notes: typeof r.notes === "string" ? r.notes.slice(0, 200) : "",
    createdAt: typeof r.createdAt === "number" && isFinite(r.createdAt) ? r.createdAt : Date.now(),
    bossId: r.bossId.slice(0, 60),
    build: {
      stats,
      level,
      xp: clampSaveNumber(build.xp, xpRequiredForLevel(level)),
      mastery,
      gravity: Math.max(1, Math.min(1000, Math.floor(clampSaveNumber(build.gravity, 1, 1000)))),
      formId: typeof build.formId === "string" && (FORMS.some((f) => f.id === build.formId) || build.formId.startsWith("custom-")) ? build.formId.slice(0, 40) : "base",
      customForms: parseCustomForms(build.customForms),
    },
  };
}

export function parseScenarioList(text: string): Scenario[] {
  try {
    const raw: unknown = JSON.parse(text);
    if (!Array.isArray(raw)) return [];
    return raw.map(parseScenario).filter((sc): sc is Scenario => sc !== null).slice(-MAX_SCENARIOS);
  } catch {
    return [];
  }
}

export function serializeScenarioList(scenarios: Scenario[]): string {
  return JSON.stringify(scenarios.slice(-MAX_SCENARIOS));
}

/** Applies a scenario build to the draft state: stats, level, XP, mastery, gravity, custom forms, and its form. Returns the form id applied. */
export function applyScenarioBuild(d: GameState, build: ScenarioBuild): string {
  for (const k of STAT_KEYS) d.stats[k] = clampSaveNumber(build.stats[k], 1, 1e15);
  d.level = Math.max(1, Math.min(100, Math.floor(build.level)));
  d.xp = clampSaveNumber(build.xp, xpRequiredForLevel(d.level));
  // Keep level and XP consistent.
  d.level = Math.max(d.level, levelForXp(d.xp));
  for (const k of STAT_KEYS) d.mastery[k] = Math.max(0, Math.min(100, build.mastery[k]));
  d.gravity = Math.max(1, Math.min(1000, Math.floor(build.gravity)));
  d.gravityProgress = 0;
  // Re-register scenario-carried custom transformations so custom-form scenarios work on any save.
  const carried = parseCustomForms(build.customForms);
  for (const form of carried) {
    if (!findForm(d, form.id) && !d.customForms.some((f) => f.id === form.id)) d.customForms.push(form);
  }
  const formId = findForm(d, build.formId) ? build.formId : "base";
  if (!d.forms.includes(formId)) d.forms.push(formId);
  d.activeForm = formId;
  return formId;
}

/** One-line human-readable summary for the scenario list (power level omitted — needs engine context). */
export const scenarioSummary = (scenario: Scenario): string =>
  `Lv ${scenario.build.level} · ${scenario.build.formId} · Gravity ${scenario.build.gravity}× · STR ${Math.floor(scenario.build.stats.strength)}/AGI ${Math.floor(scenario.build.stats.agility)}/KI ${Math.floor(scenario.build.stats.ki)}/DEF ${Math.floor(scenario.build.stats.defense)} → ${scenario.bossId}`;

