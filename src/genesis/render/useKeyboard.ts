import { useEffect, useRef, type RefObject } from "react";

/** Raw keyboard state; camera-relative conversion happens in the scene loop. */
export type RawKeys = {
  f: boolean;
  b: boolean;
  l: boolean;
  r: boolean;
  sprint: boolean;
  jump: boolean;
  fly: boolean;
  descend: boolean;
};

function blankKeys(): RawKeys {
  return {
    f: false,
    b: false,
    l: false,
    r: false,
    sprint: false,
    jump: false,
    fly: false,
    descend: false,
  };
}

/** Collects movement keys (WASD / arrows, Shift sprint, Space jump) into a ref. */
export function useKeyboard(): RefObject<RawKeys> {
  const keys = useRef<RawKeys>(blankKeys());
  useEffect(() => {
    const apply = (e: KeyboardEvent, down: boolean) => {
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          keys.current.f = down;
          break;
        case "KeyS":
        case "ArrowDown":
          keys.current.b = down;
          break;
        case "KeyA":
        case "ArrowLeft":
          keys.current.l = down;
          break;
        case "KeyD":
        case "ArrowRight":
          keys.current.r = down;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          keys.current.sprint = down;
          break;
        case "KeyF":
          keys.current.fly = down;
          break;
        case "ControlLeft":
        case "ControlRight":
        case "KeyC":
          keys.current.descend = down;
          break;
        case "Space":
          if (down) e.preventDefault(); // keep the page from scrolling / re-clicking focused buttons
          keys.current.jump = down;
          break;
      }
    };
    const down = (e: KeyboardEvent) => apply(e, true);
    const up = (e: KeyboardEvent) => apply(e, false);
    const blur = () => {
      keys.current = blankKeys(); // a focused-away window must not leave keys stuck
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
  return keys;
}
