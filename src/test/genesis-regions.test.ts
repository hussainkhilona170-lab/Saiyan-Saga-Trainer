import { describe, expect, it } from "vitest";
import {
  ELITE_COLOR,
  ELITE_SCALE,
  ENEMY_TYPES,
  REGIONS,
  archetypeByID,
  regionAt,
  regionByID,
} from "../genesis/sim/enemies";

describe("Genesis regions", () => {
  it("ships two authored regions with unique ids and valid bowls", () => {
    expect(REGIONS).toHaveLength(2);
    expect(new Set(REGIONS.map((region) => region.id)).size).toBe(REGIONS.length);
    expect(new Set(REGIONS.map((region) => region.name)).size).toBe(REGIONS.length);
    for (const region of REGIONS) {
      expect(region.radius).toBeGreaterThan(0);
      expect(Number.isFinite(region.center.x)).toBe(true);
      expect(Number.isFinite(region.center.z)).toBe(true);
      expect(region.spawns.length).toBeGreaterThan(0);
    }
  });

  it("keeps every spawn inside its own region and maps it to a resolved enemy", () => {
    const ids = REGIONS.flatMap((region) => region.spawns.map((spawn) => spawn.id));
    expect(new Set(ids).size).toBe(ids.length);

    for (const region of REGIONS) {
      for (const spawn of region.spawns) {
        const distance = Math.hypot(
          spawn.x - region.center.x,
          spawn.z - region.center.z,
        );
        expect(distance).toBeLessThanOrEqual(region.radius);
        expect(archetypeByID(spawn.archetype)).toBeTruthy();

        const resolved = ENEMY_TYPES.find((def) => def.id === spawn.id);
        expect(resolved).toBeTruthy();
        expect(resolved).toMatchObject({
          archetype: spawn.archetype,
          region: region.id,
          elite: spawn.elite === true,
          home: { x: spawn.x, z: spawn.z },
        });
      }
    }
  });

  it("gives both regions a full grunt/scout/brute spawn set", () => {
    for (const region of REGIONS) {
      expect(new Set(region.spawns.map((spawn) => spawn.archetype))).toEqual(
        new Set(["grunt", "scout", "brute"]),
      );
    }
    expect(regionByID("flats")!.spawns.filter((spawn) => spawn.elite)).toHaveLength(2);
  });

  it("resolves the region under the player, falling back safely", () => {
    expect(regionAt({ x: 0, z: 0 }).id).toBe("ridge");
    expect(regionAt({ x: 5, z: 7 }).id).toBe("ridge");
    expect(regionAt({ x: 36, z: -28 }).id).toBe("flats");
    expect(regionAt({ x: 44, z: -26 }).id).toBe("flats");
    // Outside every bowl: nearest centre wins.
    expect(regionAt({ x: 100, z: 100 }).id).toBe("ridge");
    // Non-finite input never blanks the HUD.
    expect(regionAt({ x: Number.NaN, z: 0 }).id).toBe("ridge");
    expect(regionByID("missing")).toBeUndefined();
  });
});

describe("Genesis elite variants", () => {
  it("scales elites above their base archetype and marks them gold", () => {
    const elites = ENEMY_TYPES.filter((def) => def.elite);
    expect(elites.length).toBeGreaterThanOrEqual(2);

    for (const elite of elites) {
      const base = archetypeByID(elite.archetype)!;
      expect(elite.region).toBe("flats");
      expect(elite.color).toBe(ELITE_COLOR);
      expect(elite.hp).toBe(Math.round(base.hp * ELITE_SCALE.hp));
      expect(elite.damage).toBe(Math.round(base.damage * ELITE_SCALE.damage));
      expect(elite.xp).toBe(Math.round(base.xp * ELITE_SCALE.xp));
      expect(elite.respawn).toBe(ELITE_SCALE.respawn);
      expect(elite.radius).toBeCloseTo(base.radius * ELITE_SCALE.radius, 6);
      expect(elite.height).toBeCloseTo(base.height * ELITE_SCALE.height, 6);
      expect(elite.hp).toBeGreaterThan(base.hp);
      expect(elite.xp).toBeGreaterThan(base.xp);
    }
  });

  it("gives elites distinct names and homes from their base spawns", () => {
    const elites = ENEMY_TYPES.filter((def) => def.elite);
    const baseSpawns = ENEMY_TYPES.filter((def) => !def.elite);
    expect(new Set(elites.map((def) => def.name)).size).toBe(elites.length);
    for (const elite of elites) {
      expect(elite.name.toLowerCase()).toContain("elite");
      expect(baseSpawns.some((def) => def.home.x === elite.home.x && def.home.z === elite.home.z)).toBe(
        false,
      );
    }
  });
});
