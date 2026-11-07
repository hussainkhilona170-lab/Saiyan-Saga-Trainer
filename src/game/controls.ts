import { useEffect, useRef } from "react";

export type BattleControls = {
  punch: () => void;
  blast: () => void;
  ultimate: () => void;
  vanish: () => void;
  charge: () => void;
  parry: () => void;
  heavy: () => void;
};

/** Owns the PC keyboard mapping and held-charge lifecycle for the battle screen. */
export function useBattleControls(actions: BattleControls) {
  const actionsRef = useRef(actions);
  const chargeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  actionsRef.current = actions;

  useEffect(() => {
    const stopCharge = () => {
      if (chargeTimerRef.current) clearInterval(chargeTimerRef.current);
      chargeTimerRef.current = null;
    };

    const onDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))) return;
      const key = event.key.toLowerCase();
      if (key === " " || key === "j") {
        event.preventDefault();
        if (!event.repeat) actionsRef.current.punch();
      } else if (key === "k") {
        event.preventDefault();
        if (!event.repeat) actionsRef.current.blast();
      } else if (key === "l") {
        event.preventDefault();
        if (!event.repeat) actionsRef.current.ultimate();
      } else if (key === "shift") {
        if (!event.repeat) actionsRef.current.vanish();
      } else if (key === "f") {
        event.preventDefault();
        if (!event.repeat) actionsRef.current.parry();
      } else if (key === "h") {
        event.preventDefault();
        if (!event.repeat) actionsRef.current.heavy();
      } else if (key === "c") {
        event.preventDefault();
        if (!event.repeat && !chargeTimerRef.current) actionsRef.current.charge();
        if (!chargeTimerRef.current) chargeTimerRef.current = setInterval(() => actionsRef.current.charge(), 110);
      }
    };

    const onUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "c") stopCharge();
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", stopCharge);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", stopCharge);
      stopCharge();
    };
  }, []);
}
