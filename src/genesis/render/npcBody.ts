/**
 * Genesis — procedural NPC bodies.
 *
 * A friendly silhouette built from primitives: robe, hood, mantle and staff,
 * plus a soft accent ring at the feet so the mentor reads as an interactable
 * character rather than scenery. No gameplay rules live here.
 */
import * as THREE from "three";
import type { NpcDef } from "../sim/npcs";

export type NpcBody = {
  group: THREE.Group;
  /** Ring at the feet, pulsed while the player is close enough to talk. */
  ringMaterial: THREE.MeshStandardMaterial;
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
};

export function createNpcBody(def: NpcDef): NpcBody {
  const group = new THREE.Group();
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];

  const robe = new THREE.Color(def.robe);
  const accent = new THREE.Color(def.accent);
  const skin = new THREE.Color("#e6c39a");
  const dark = robe.clone().multiplyScalar(0.55);

  const mat = (
    color: THREE.Color,
    emissive: THREE.Color = color,
    emissiveIntensity = 0,
  ): THREE.MeshStandardMaterial => {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      metalness: 0.04,
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

  // Robe: a wide cone for the skirt and a tapered torso above it.
  part(new THREE.ConeGeometry(0.42, 1.0, 10), mat(robe), [0, 0.5, 0]);
  part(new THREE.CapsuleGeometry(0.24, 0.5, 5, 10), mat(robe), [0, 1.16, 0]);

  // Sash and mantle.
  part(
    new THREE.TorusGeometry(0.27, 0.045, 6, 14),
    mat(accent, accent, 0.25),
    [0, 0.86, 0],
    [Math.PI / 2, 0, 0],
  );
  part(new THREE.ConeGeometry(0.34, 0.3, 10), mat(dark), [0, 1.4, 0]);

  // Arms tucked into the sleeves.
  const sleeveGeo = new THREE.CapsuleGeometry(0.1, 0.42, 5, 8);
  for (const side of [-1, 1] as const) {
    part(sleeveGeo, mat(robe), [side * 0.29, 1.12, 0.04], [0.18, 0, side * 0.26]);
    part(new THREE.SphereGeometry(0.075, 8, 6), mat(skin), [side * 0.36, 0.9, 0.14]);
  }

  // Head and hood with a hanging tail.
  part(new THREE.SphereGeometry(0.19, 12, 10), mat(skin), [0, 1.55, 0]);
  part(new THREE.SphereGeometry(0.22, 12, 10), mat(dark), [0, 1.6, -0.03], [0, 0, 0], [1, 0.95, 1]);
  part(new THREE.ConeGeometry(0.11, 0.42, 6), mat(dark), [0, 1.32, -0.2], [0.5, 0, 0]);

  // Eyes.
  const eyeGeo = new THREE.SphereGeometry(0.025, 8, 6);
  const eyeMat = mat(new THREE.Color("#1c1c26"));
  for (const side of [-1, 1] as const) {
    part(eyeGeo, eyeMat, [side * 0.075, 1.55, 0.17]);
  }

  // Staff: shaft plus a glowing head, held at the right hand.
  part(
    new THREE.CylinderGeometry(0.028, 0.028, 1.8, 6),
    mat(dark),
    [0.42, 0.9, 0.18],
    [0, 0, -0.06],
  );
  part(new THREE.OctahedronGeometry(0.1, 0), mat(accent, accent, 0.9), [0.47, 1.78, 0.18]);

  // Interactable ring on the ground.
  const ringMaterial = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 0.2,
    transparent: true,
    opacity: 0.55,
    roughness: 0.4,
  });
  materials.push(ringMaterial);
  const ringGeometry = new THREE.TorusGeometry(0.62, 0.03, 6, 28);
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.02;
  group.add(ring);
  geometries.push(ringGeometry);

  return { group, ringMaterial, materials, geometries };
}

export function disposeNpcBody(body: NpcBody): void {
  for (const geometry of body.geometries) geometry.dispose();
  for (const material of body.materials) material.dispose();
}
