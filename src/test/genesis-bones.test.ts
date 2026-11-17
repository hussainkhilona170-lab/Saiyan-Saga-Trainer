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

  it("prefers the first candidate that the model actually has", () => {
    // Our generated rig wins over the imported alias when both exist.
    expect(
      resolveBoneName(["upperArm.L", "arm_left_shoulder_2"], ["upperArm.L", "arm_left_shoulder_2"]),
    ).toBe("upperArm.L");
    // Missing preferred name falls through to the alias.
    expect(resolveBoneName(["arm_left_shoulder_2"], ["upperArm.L", "arm_left_shoulder_2"])).toBe(
      "arm_left_shoulder_2",
    );
  });

  it("falls back to a normalised alias when the authored name was sanitised", () => {
    // three.js strips the dot, so the alias must still match after normalisation.
    expect(resolveBoneName(["upperArmL"], ["upperArm.L", "arm_left_shoulder_2"])).toBe("upperArmL");
    // Whitespace becomes underscores, which is how sanitised iClone names survive.
    expect(resolveBoneName(["arm_left_shoulder_2"], ["Arm Left Shoulder 2"])).toBe(
      "arm_left_shoulder_2",
    );
  });

  it("resolves an imported iClone-style rig through aliases", () => {
    const iclone = [
      "RL_BoneRoot",
      "root_ground",
      "root_hips",
      "spine_lower",
      "spine_upper",
      "head_neck_lower",
      "head_neck_upper",
      "arm_left_shoulder_2",
      "arm_left_elbow",
      "arm_right_shoulder_2",
      "arm_right_elbow",
      "leg_left_thigh",
      "leg_left_knee",
      "leg_right_thigh",
      "leg_right_knee",
    ];
    const wanted = {
      root: ["root", "RL_BoneRoot", "root_ground"],
      hips: ["hips", "root_hips"],
      spine: ["spine", "spine_lower"],
      chest: ["chest", "spine_upper"],
      neck: ["neck", "head_neck_lower"],
      head: ["head", "head_neck_upper", "head_root"],
      upperArmL: ["upperArm.L", "arm_left_shoulder_2"],
      lowerArmL: ["lowerArm.L", "arm_left_elbow"],
      upperArmR: ["upperArm.R", "arm_right_shoulder_2"],
      lowerArmR: ["lowerArm.R", "arm_right_elbow"],
      thighL: ["thigh.L", "leg_left_thigh"],
      shinL: ["shin.L", "leg_left_knee"],
      thighR: ["thigh.R", "leg_right_thigh"],
      shinR: ["shin.R", "leg_right_knee"],
    } as const;

    expect(resolveBones(iclone, wanted)).toEqual({
      root: "RL_BoneRoot",
      hips: "root_hips",
      spine: "spine_lower",
      chest: "spine_upper",
      neck: "head_neck_lower",
      head: "head_neck_upper",
      upperArmL: "arm_left_shoulder_2",
      lowerArmL: "arm_left_elbow",
      upperArmR: "arm_right_shoulder_2",
      lowerArmR: "arm_right_elbow",
      thighL: "leg_left_thigh",
      shinL: "leg_left_knee",
      thighR: "leg_right_thigh",
      shinR: "leg_right_knee",
    });
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
