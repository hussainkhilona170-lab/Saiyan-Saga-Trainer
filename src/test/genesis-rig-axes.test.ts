import { describe, expect, it } from "vitest";
import {
  IDENTITY_QUAT,
  characterSpaceOffsetInto,
  quatFromAxisAngle,
  quatMultiplyInto,
  setFromEulerXYZInto,
  type Quat,
} from "../genesis/render/rigAxes";

function newQuat(): Quat {
  return { ...IDENTITY_QUAT };
}

function expectQuatClose(actual: Quat, expected: Quat, digits = 6) {
  // q and -q represent the same rotation.
  const dot =
    actual.x * expected.x + actual.y * expected.y + actual.z * expected.z + actual.w * expected.w;
  const sign = dot < 0 ? -1 : 1;
  expect(actual.x).toBeCloseTo(expected.x * sign, digits);
  expect(actual.y).toBeCloseTo(expected.y * sign, digits);
  expect(actual.z).toBeCloseTo(expected.z * sign, digits);
  expect(actual.w).toBeCloseTo(expected.w * sign, digits);
}

describe("rigAxes — character-space pose offsets", () => {
  it("builds XYZ Euler rotations in three.js order (Rx · Ry · Rz)", () => {
    const actual = setFromEulerXYZInto(newQuat(), 0.31, -0.42, 0.57);

    const qx = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.31);
    const qy = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, -0.42);
    const qz = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, 0.57);
    const expected = newQuat();
    const tmp = newQuat();
    quatMultiplyInto(tmp, qy, qz);
    quatMultiplyInto(expected, qx, tmp);

    expectQuatClose(actual, expected);
  });

  it("maps a character-space rotation R onto a bone with arbitrary rest world orientation W0", () => {
    // A bone whose rest orientation is not axis-aligned — the imported-rig case.
    const rest = newQuat();
    quatMultiplyInto(
      rest,
      quatFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2),
      quatFromAxisAngle({ x: 0, y: 0, z: 1 }, 0.33),
    );
    const offset = characterSpaceOffsetInto(newQuat(), rest, 0.4, 0.1, -0.2);

    // Bone world orientation = W0 · offset; it must equal R · W0.
    const world = newQuat();
    quatMultiplyInto(world, rest, offset);
    const r = setFromEulerXYZInto(newQuat(), 0.4, 0.1, -0.2);
    const expected = newQuat();
    quatMultiplyInto(expected, r, rest);

    expectQuatClose(world, expected);
  });

  it("turns character X into the bone's local equivalent (yawed rest)", () => {
    // Rest yawed 90° about Y: character-space pitch must rotate about local +Z.
    const rest = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2);
    const offset = characterSpaceOffsetInto(newQuat(), rest, 0.5, 0, 0);
    expectQuatClose(offset, quatFromAxisAngle({ x: 0, y: 0, z: 1 }, 0.5));
  });

  it("is a no-op for axis-aligned rigs (rest = identity)", () => {
    const offset = characterSpaceOffsetInto(
      newQuat(),
      { ...IDENTITY_QUAT },
      0.25,
      -0.15,
      0.05,
    );
    expectQuatClose(offset, setFromEulerXYZInto(newQuat(), 0.25, -0.15, 0.05));
  });

  it("returns identity for non-finite input", () => {
    expectQuatClose(
      characterSpaceOffsetInto(newQuat(), { ...IDENTITY_QUAT }, Number.NaN, 0, 0),
      IDENTITY_QUAT,
    );
    expectQuatClose(
      characterSpaceOffsetInto(newQuat(), { x: Number.NaN, y: 0, z: 0, w: 1 }, 0.2, 0, 0),
      IDENTITY_QUAT,
    );
  });
});
