/**
 * Genesis — procedural enemy bodies.
 *
 * The roster is data-driven, so each archetype gets a silhouette built from
 * primitives: a slim scout with a visor and antenna, a broad horned brute, and
 * a baseline grunt. The renderer only mirrors roster state onto these groups;
 * no gameplay rules live here.
 */
import * as THREE from "three";
import { ELITE_COLOR, type EnemyType } from "../sim/enemies";

export type EnemyBody = {
  group: THREE.Group;
  /** Emissive chest core, pulsed by the attack telegraph. */
  coreMaterial: THREE.MeshStandardMaterial;
  /** Gold foot ring on elite variants, pulsed by the scene. */
  eliteRingMaterial: THREE.MeshStandardMaterial | null;
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
};

export function createEnemyBody(def: EnemyType): EnemyBody {
  const group = new THREE.Group();
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];

  const total = def.height + def.radius * 2;
  const r = def.radius;
  const half = total / 2;
  const base = new THREE.Color(def.color);
  const dark = base.clone().multiplyScalar(0.52);
  const skin = base.clone().lerp(new THREE.Color("#e8d5c4"), 0.4);
  const accent = base.clone().lerp(new THREE.Color("#ffffff"), 0.35);

  const mat = (
    color: THREE.Color,
    emissive: THREE.Color = color,
    emissiveIntensity = 0,
  ): THREE.MeshStandardMaterial => {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.72,
      metalness: 0.05,
      flatShading: true,
      emissive,
      emissiveIntensity,
    });
    materials.push(material);
    return material;
  };

  const part = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1],
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    group.add(mesh);
    geometries.push(geometry);
    return mesh;
  };

  const coreMaterial = new THREE.MeshStandardMaterial({
    color: def.elite ? ELITE_COLOR : accent,
    emissive: def.elite ? ELITE_COLOR : accent,
    emissiveIntensity: 0.35,
    roughness: 0.35,
  });
  materials.push(coreMaterial);

  // Legs and boots.
  const legGeo = new THREE.CapsuleGeometry(r * 0.34, half * 0.62, 5, 8);
  const bootGeo = new THREE.BoxGeometry(r * 0.85, r * 0.38, r * 1.25);
  for (const side of [-1, 1] as const) {
    part(legGeo, mat(dark), [side * r * 0.45, -half / 2, 0]);
    part(bootGeo, mat(dark, dark, 0.05), [side * r * 0.45, -half + r * 0.19, r * 0.1]);
  }

  // Torso, belt, shoulders, arms.
  const torsoGeo = new THREE.CapsuleGeometry(r, total * 0.28, 5, 10);
  const torso = part(torsoGeo, mat(base), [0, total * 0.16, 0]);
  if (def.archetype === "scout") torso.scale.set(0.82, 1, 0.82);
  if (def.archetype === "brute") torso.scale.set(1.18, 1, 1.1);

  part(new THREE.BoxGeometry(r * 2.05, total * 0.055, r * 1.55), mat(dark), [0, total * 0.045, 0]);

  const shoulderGeo = new THREE.SphereGeometry(r * 0.62, 8, 6);
  const shoulderScale: [number, number, number] =
    def.archetype === "brute"
      ? [1.55, 0.95, 1.55]
      : def.archetype === "scout"
        ? [0.8, 0.7, 0.8]
        : [1.1, 0.85, 1.1];
  const armGeo = new THREE.CapsuleGeometry(r * 0.3, total * 0.22, 5, 8);
  for (const side of [-1, 1] as const) {
    part(
      shoulderGeo,
      mat(dark, dark, 0.04),
      [side * r * 1.08, total * 0.31, 0],
      [0, 0, 0],
      shoulderScale,
    );
    part(armGeo, mat(skin), [side * r * 1.16, total * 0.15, 0], [0, 0, side * -0.12]);
  }

  // Head.
  const headR = r * 0.92;
  part(new THREE.SphereGeometry(headR, 12, 10), mat(skin), [0, total * 0.37, 0]);

  if (def.elite) {
    // Gold brow crests, so elites read at a glance.
    const crestGeo = new THREE.ConeGeometry(r * 0.13, total * 0.16, 5);
    for (const side of [-1, 1] as const) {
      part(
        crestGeo,
        coreMaterial,
        [side * r * 0.42, total * 0.37 + headR * 0.95, 0],
        [0, 0, side * 0.3],
      );
    }
  }

  if (def.archetype === "scout") {
    // Wide emissive visor and a swept antenna.
    part(new THREE.BoxGeometry(r * 1.35, r * 0.34, r * 0.16), mat(accent, accent, 1.1), [
      0,
      total * 0.385,
      headR * 0.84,
    ]);
    part(
      new THREE.ConeGeometry(r * 0.16, total * 0.24, 5),
      mat(dark, dark, 0.08),
      [0, total * 0.37 + headR * 1.05, -r * 0.15],
      [-0.35, 0, 0],
    );
  } else if (def.archetype === "brute") {
    // Horns and a heavy chest plate.
    part(
      new THREE.ConeGeometry(r * 0.2, total * 0.2, 5),
      mat(dark, dark, 0.08),
      [-r * 0.55, total * 0.37 + headR * 0.85, 0],
      [0, 0, 0.42],
    );
    part(
      new THREE.ConeGeometry(r * 0.2, total * 0.2, 5),
      mat(dark, dark, 0.08),
      [r * 0.55, total * 0.37 + headR * 0.85, 0],
      [0, 0, -0.42],
    );
    part(new THREE.BoxGeometry(r * 1.75, total * 0.15, r * 0.32), mat(dark, dark, 0.06), [
      0,
      total * 0.2,
      r * 0.92,
    ]);
  } else {
    // Grunt: headband tail.
    part(new THREE.BoxGeometry(r * 1.85, r * 0.28, r * 0.18), mat(accent, accent, 0.4), [
      0,
      total * 0.43,
      headR * 0.72,
    ]);
  }

  // Eyes (the scout's visor replaces them).
  if (def.archetype !== "scout") {
    const eyeGeo = new THREE.SphereGeometry(r * 0.13, 8, 8);
    const pupilGeo = new THREE.SphereGeometry(r * 0.06, 6, 6);
    const eyeMat = mat(new THREE.Color("#ffffff"));
    const pupilMat = mat(new THREE.Color("#14141f"));
    for (const side of [-1, 1] as const) {
      part(eyeGeo, eyeMat, [side * r * 0.32, total * 0.39, headR * 0.82]);
      part(pupilGeo, pupilMat, [side * r * 0.32, total * 0.39, headR * 0.94]);
    }
  }

  // Chest core — the telegraph light.
  part(new THREE.SphereGeometry(r * 0.28, 10, 8), coreMaterial, [0, total * 0.18, r * 0.93]);

  // Elite gold foot ring. The scene pulses it so elites stay identifiable from
  // a distance without adding another HUD element.
  let eliteRingMaterial: THREE.MeshStandardMaterial | null = null;
  if (def.elite) {
    eliteRingMaterial = new THREE.MeshStandardMaterial({
      color: ELITE_COLOR,
      emissive: ELITE_COLOR,
      emissiveIntensity: 0.55,
      roughness: 0.35,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    materials.push(eliteRingMaterial);
    const ring = part(
      new THREE.RingGeometry(r * 0.9, r * 1.5, 28),
      eliteRingMaterial,
      [0, -half + 0.03, 0],
      [-Math.PI / 2, 0, 0],
    );
    ring.castShadow = false;
  }

  return { group, coreMaterial, eliteRingMaterial, materials, geometries };
}

export function disposeEnemyBody(body: EnemyBody): void {
  for (const geometry of body.geometries) geometry.dispose();
  for (const material of body.materials) material.dispose();
}
