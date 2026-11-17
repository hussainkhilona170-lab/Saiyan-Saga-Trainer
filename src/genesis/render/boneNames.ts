/**
 * Rigged GLB bone lookup.
 *
 * glTF exporters keep dotted bone names (`upperArm.L`), but three.js runs every
 * node name through `PropertyBinding.sanitizeNodeName` on load, which strips
 * `.` `:` `/` `[` `]` and turns whitespace into underscores. Looking a bone up
 * by its authored name therefore silently fails and the rig never animates.
 *
 * These helpers normalise both sides so the lookup survives sanitisation.
 */

const RESERVED = /[[\].:/]/g;

/** Mirrors three.js `PropertyBinding.sanitizeNodeName`, lower-cased. */
export function normalizeBoneName(name: string): string {
  return name.replace(/\s/g, "_").replace(RESERVED, "").toLowerCase();
}

/**
 * Resolve `wanted` against the bone names a loaded model actually exposes.
 * Prefers an exact match, then the sanitised form, then a normalised match.
 */
export function resolveBoneName(available: readonly string[], wanted: string): string | null {
  if (available.includes(wanted)) return wanted;
  const target = normalizeBoneName(wanted);
  for (const name of available) {
    if (normalizeBoneName(name) === target) return name;
  }
  return null;
}

/** Resolve a whole rig at once. Returns null if any required bone is missing. */
export function resolveBones<K extends string>(
  available: readonly string[],
  wanted: Record<K, string>,
): Record<K, string> | null {
  const out = {} as Record<K, string>;
  for (const key of Object.keys(wanted) as K[]) {
    const found = resolveBoneName(available, wanted[key]);
    if (!found) return null;
    out[key] = found;
  }
  return out;
}
