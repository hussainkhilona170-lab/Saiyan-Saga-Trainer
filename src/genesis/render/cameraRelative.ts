import * as THREE from "three";
import type { RawKeys } from "./useKeyboard";

/** Scratch vectors reused every frame — no allocation inside the render loop. */
const lookDir = new THREE.Vector3();
const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

/** Camera-relative WASD → world-space movement intent (unit direction). */
export function moveIntent(keys: RawKeys, camera: THREE.Camera): { moveX: number; moveZ: number } {
  const f = (keys.f ? 1 : 0) - (keys.b ? 1 : 0);
  const r = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
  if (f === 0 && r === 0) return { moveX: 0, moveZ: 0 };
  camera.getWorldDirection(lookDir);
  fwd.set(lookDir.x, 0, lookDir.z);
  if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
  fwd.normalize();
  right.crossVectors(fwd, up).normalize();
  const mx = fwd.x * f + right.x * r;
  const mz = fwd.z * f + right.z * r;
  const mag = Math.hypot(mx, mz) || 1;
  return { moveX: mx / mag, moveZ: mz / mag };
}

/**
 * Pull a desired camera position in toward `target` when a ray from `target` to
 * `desired` hits an obstacle. `hitToi` is the normalized (0..1) time-of-impact
 * of the ray against the nearest collider, or null when nothing was hit.
 */
export function resolveCameraPosition(
  target: { x: number; y: number; z: number },
  desired: { x: number; y: number; z: number },
  hitToi: number | null,
  margin = 0.82,
): { x: number; y: number; z: number } {
  if (hitToi === null || !Number.isFinite(hitToi)) {
    return { x: desired.x, y: desired.y, z: desired.z };
  }
  const t = Math.min(1, Math.max(0, hitToi * margin));
  return {
    x: target.x + (desired.x - target.x) * t,
    y: target.y + (desired.y - target.y) * t,
    z: target.z + (desired.z - target.z) * t,
  };
}
