/**
 * Character-space pose rotations for rigs whose bones carry arbitrary local
 * axes (imported iClone / Character Creator skeletons). Pure math — no three.js,
 * React or DOM, so it is headless-testable.
 *
 * Pose angles are authored in character space (pitch about X, yaw about Y, roll
 * about Z). A procedural rig's bones share that orientation, but an imported
 * rig rotates its bones about arbitrary local axes, which folded the torso
 * forward during walk/run.
 *
 * A bone's rest world orientation `W0` is captured relative to the character
 * root. Applying character-space rotation `R` then needs the local offset
 *
 *   offset = W0⁻¹ · R · W0
 *
 * which is right-multiplied onto the bone's rest local quaternion: the bone's
 * world orientation becomes `W0 · offset = R · W0`.
 */

export type Quat = { x: number; y: number; z: number; w: number };
export type Vec3 = { x: number; y: number; z: number };

export const IDENTITY_QUAT: Quat = { x: 0, y: 0, z: 0, w: 1 };

export function setIdentityInto(out: Quat): Quat {
  out.x = 0;
  out.y = 0;
  out.z = 0;
  out.w = 1;
  return out;
}

export function isFiniteQuat(q: Quat): boolean {
  return (
    Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z) && Number.isFinite(q.w)
  );
}

/** Hamilton product `a · b` (apply b, then a). Safe when `out` aliases inputs. */
export function quatMultiplyInto(out: Quat, a: Quat, b: Quat): Quat {
  const x = a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y;
  const y = a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x;
  const z = a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w;
  const w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z;
  out.x = x;
  out.y = y;
  out.z = z;
  out.w = w;
  return out;
}

export function quatConjugateInto(out: Quat, q: Quat): Quat {
  const x = -q.x;
  const y = -q.y;
  const z = -q.z;
  const w = q.w;
  out.x = x;
  out.y = y;
  out.z = z;
  out.w = w;
  return out;
}

/** Mirrors three.js `Quaternion.setFromEuler(x, y, z, "XYZ")`: R = Rx · Ry · Rz. */
export function setFromEulerXYZInto(out: Quat, x: number, y: number, z: number): Quat {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return setIdentityInto(out);
  }
  const s1 = Math.sin(x / 2);
  const c1 = Math.cos(x / 2);
  const s2 = Math.sin(y / 2);
  const c2 = Math.cos(y / 2);
  const s3 = Math.sin(z / 2);
  const c3 = Math.cos(z / 2);
  out.x = s1 * c2 * c3 + c1 * s2 * s3;
  out.y = c1 * s2 * c3 - s1 * c2 * s3;
  out.z = c1 * c2 * s3 + s1 * s2 * c3;
  out.w = c1 * c2 * c3 - s1 * s2 * s3;
  return out;
}

export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const len = Math.hypot(axis.x, axis.y, axis.z);
  if (!Number.isFinite(len) || len < 1e-9 || !Number.isFinite(angle)) {
    return { ...IDENTITY_QUAT };
  }
  const half = angle / 2;
  const s = Math.sin(half) / len;
  return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(half) };
}

const SCRATCH_R: Quat = { ...IDENTITY_QUAT };
const SCRATCH_CONJ: Quat = { ...IDENTITY_QUAT };

/**
 * Character-space Euler angles → bone-local offset for a bone whose rest world
 * orientation (relative to the character root) is `restWorld`.
 *
 * Write into `out`; safe when `out` aliases `restWorld`, and allocation-free so
 * the render loop can reuse one scratch quaternion.
 */
export function characterSpaceOffsetInto(
  out: Quat,
  restWorld: Quat,
  x: number,
  y: number,
  z: number,
): Quat {
  if (!isFiniteQuat(restWorld)) return setIdentityInto(out);
  setFromEulerXYZInto(SCRATCH_R, x, y, z);
  quatConjugateInto(SCRATCH_CONJ, restWorld);
  quatMultiplyInto(SCRATCH_CONJ, SCRATCH_CONJ, SCRATCH_R);
  return quatMultiplyInto(out, SCRATCH_CONJ, restWorld);
}
