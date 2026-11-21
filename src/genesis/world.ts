/**
 * Genesis — static world obstacles (landmark pillars) used for manual collision.
 * Coordinates match the landmark boxes in GenesisScene.
 */
export type Obstacle = { x: number; z: number; w: number; d: number; h: number };

export const OBSTACLES: Obstacle[] = [
  { x: -8, z: -10, w: 1.6, d: 1.6, h: 5 },
  { x: 10, z: -14, w: 2, d: 2, h: 7 },
  { x: -14, z: 6, w: 1.4, d: 1.4, h: 3.5 },
  { x: 16, z: 8, w: 2.4, d: 2.4, h: 9 },
  { x: 0, z: -24, w: 3, d: 3, h: 12 },
  { x: -24, z: -4, w: 1.8, d: 1.8, h: 4 },
  { x: 26, z: -8, w: 2.2, d: 2.2, h: 6 },
  // Ashen Flats — keep in sync with the landmarks in GenesisScene.
  { x: 34, z: -34, w: 2.2, d: 2.2, h: 6 },
  { x: 44, z: -20, w: 1.8, d: 1.8, h: 4 },
];
