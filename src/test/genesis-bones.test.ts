import { describe, expect, it } from "vitest";
import { normalizeBoneName, resolveBoneName, resolveBones } from "../genesis/render/boneNames";

describe("bone name resolution", () => {
  it("mirrors three.js name sanitisation", () => {
    expect(normalizeBoneName("upperArm.L")).toBe("upperarml");
    expect(normalizeBoneName("upperArm L")).toBe("upperarm_l");
    expect(normalizeBoneName("Hand:R")).toBe("handr");
    expect(normalizeBoneName("root[0]")).toBe("root0");
  });

  it("prefers an exact match", () => {
    expect(resolveBoneName(["hips", "root"], "root")).toBe("root");
  });

  it("finds dotted bones after three.js strips the dot", () => {
    const loaded = [
      "root",
      "hips",
      "spine",
      "chest",
      "neck",
      "head",
      "shoulderL",
      "upperArmL",
      "lowerArmL",
      "handL",
      "thighL",
      "shinL",
      "footL",
    ];
    expect(resolveBoneName(loaded, "upperArm.L")).toBe("upperArmL");
    expect(resolveBoneName(loaded, "shin.L")).toBe("shinL");
    expect(resolveBoneName(loaded, "hand.L")).toBe("handL");
  });

  it("returns null for bones the model does not have", () => {
    expect(resolveBoneName(["root", "hips"], "upperArm.L")).toBeNull();
  });

  it("resolves a complete rig or nothing", () => {
    const loaded = ["root", "hips", "spine", "chest", "neck", "head", "upperArmL", "lowerArmL"];
    const wanted = {
      root: "root",
      head: "head",
      upperArmL: "upperArm.L",
      lowerArmL: "lowerArm.L",
    };
    expect(resolveBones(loaded, wanted)).toEqual({
      root: "root",
      head: "head",
      upperArmL: "upperArmL",
      lowerArmL: "lowerArmL",
    });

    const partial = resolveBones(loaded, { root: "root", thighL: "thigh.L" });
    expect(partial).toBeNull();
  });
});
