/**
 * Genesis — transformations. Pure TypeScript: no three.js, React or DOM.
 *
 * A form is a temporary power-up paid for in Ki: it boosts damage and mobility,
 * then drains Ki until it collapses. All of the rules (gating, drain, scaling)
 * live here so they are headless-testable; the renderer only swaps the aura and
 * feeds the multipliers into the combat/movement path.
 */

export type GenesisForm = {
  id: string;
  name: string;
  /** Aura colour used by the renderer. */
  aura: string;
  /** Multiplier applied to melee and ki damage. */
  damageMult: number;
  /** Multiplier applied to walk/run/fly speed. */
  speedMult: number;
  /** Ki drained per second while the form is held. */
  kiDrain: number;
  /** Ki spent to transform. */
  cost: number;
  /** Minimum level required. */
  minLevel: number;
};

export const GENESIS_FORMS: readonly GenesisForm[] = [
  {
    id: "ascended",
    name: "Ascended",
    aura: "#ffd166",
    damageMult: 1.6,
    speedMult: 1.25,
    kiDrain: 6,
    cost: 20,
    minLevel: 1,
  },
];

export function formByID(id: string | null): GenesisForm | undefined {
  if (!id) return undefined;
  return GENESIS_FORMS.find((form) => form.id === id);
}

export type FormRefusal = "level" | "ki" | "already" | "unknown";

export type FormAttempt =
  { ok: true; form: GenesisForm; ki: number } | { ok: false; reason: FormRefusal };

/**
 * Can the player enter `form` right now? Returns the Ki left after paying the
 * activation cost so the caller never has to re-derive it.
 */
export function canEnterForm(
  form: GenesisForm | undefined,
  level: number,
  ki: number,
  activeID: string | null = null,
): FormAttempt {
  if (!form) return { ok: false, reason: "unknown" };
  if (activeID) return { ok: false, reason: "already" };
  const lv = Number.isFinite(level) ? level : 0;
  const k = Number.isFinite(ki) ? Math.max(0, ki) : 0;
  if (lv < form.minLevel) return { ok: false, reason: "level" };
  if (k < form.cost) return { ok: false, reason: "ki" };
  return { ok: true, form, ki: k - form.cost };
}

export type FormDrain = {
  ki: number;
  /** False once the form ran dry and collapsed. */
  active: boolean;
};

/**
 * Drain Ki for one frame. A form with no Ki left collapses immediately, so the
 * caller can clear the active form when `active` comes back false.
 */
export function drainFormKi(form: GenesisForm | undefined, ki: number, rawDt: number): FormDrain {
  const current = Number.isFinite(ki) ? Math.max(0, ki) : 0;
  if (!form) return { ki: current, active: false };
  const dt = Number.isFinite(rawDt) ? Math.min(Math.max(rawDt, 0), 0.05) : 0;
  const next = Math.max(0, current - Math.max(0, form.kiDrain) * dt);
  return { ki: next, active: next > 0 };
}

/** Damage with the form multiplier applied (rounded to whole points). */
export function formDamage(base: number, form: GenesisForm | undefined): number {
  const value = Number.isFinite(base) ? Math.max(0, base) : 0;
  if (!form) return value;
  const mult = Number.isFinite(form.damageMult) ? Math.max(1, form.damageMult) : 1;
  return value * mult;
}

/** Speed with the form multiplier applied. */
export function formSpeed(base: number, form: GenesisForm | undefined): number {
  const value = Number.isFinite(base) ? Math.max(0, base) : 0;
  if (!form) return value;
  const mult = Number.isFinite(form.speedMult) ? Math.max(1, form.speedMult) : 1;
  return value * mult;
}
