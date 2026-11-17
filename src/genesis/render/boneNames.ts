/**
 * Rigged GLB bone lookup.
 *
 * glTF exporters keep dotted bone names (`upperArm.L`), but three.js runs every
 * node name through `PropertyBinding.sanitizeNodeName` on load, which strips
 * `.` `:` `/` `[` `]` and turns whitespace into underscores. Looking a bone up
 * by its authored name therefore silently fails and the rig never animates.
 *
 * Models also disagree about naming. The two rigs in this project are:
 *   - our own generated rig:  root, hips, spine, chest, neck, head, upperArm.L …
 *   - the imported iClone-style rig: RL_BoneRoot, root_hips, spine_lower,
 *     arm_left_shoulder_2, leg_left_knee …
 * so each logical bone resolves against a prioritised list of candidates.
 */

const RESERVED = /[[\].:/]/g;

/** Mirrors three.js `PropertyBinding.sanitizeNodeName`, lower-cased. */
export function normalizeBoneName(name: string): string {
  return name.replace(/\s/g, "_").replace(RESERVED, "").toLowerCase();
}

/**
 * Resolve `wanted` against the bone names a loaded model actually exposes.
 * Candidates are tried in order: exact match first for every candidate, then a
 * normalised match, so a preferred name always wins over a fallback.
 */
export function resolveBoneName(
  available: readonly string[],
  wanted: string | readonly string[],
): string | null {
  const candidates = typeof wanted === "string" ? [wanted] : wanted;

  for (const candidate of candidates) {
    if (available.includes(candidate)) return candidate;
  }

  const byNormalized = new Map<string, string>();
  for (const name of available) {
    const key = normalizeBoneName(name);
    if (!byNormalized.has(key)) byNormalized.set(key, name);
  }
  for (const candidate of candidates) {
    const hit = byNormalized.get(normalizeBoneName(candidate));
    if (hit) return hit;
  }
  return null;
}

/** Resolve a whole rig at once. Returns null if any required bone is missing. */
export function resolveBones<K extends string>(
  available: readonly string[],
  wanted: Record<K, string | readonly string[]>,
): Record<K, string> | null {
  const out = {} as Record<K, string>;
  for (const key of Object.keys(wanted) as K[]) {
    const found = resolveBoneName(available, wanted[key]);
    if (!found) return null;
    out[key] = found;
  }
  return out;
}
