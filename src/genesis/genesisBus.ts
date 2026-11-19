/**
 * Genesis — cross-tab command bus.
 *
 * The God Engine (2D app) and the Genesis scene (a separate browser tab) cannot
 * share in-memory state, so commands travel over a BroadcastChannel (with a
 * same-tab CustomEvent fallback). GenesisScene owns its state and applies
 * commands; the panel never mutates Genesis state directly (AGENTS.md rule).
 */
export type GenesisCommand =
  | { type: "setCharacter"; id: string }
  | { type: "teleport"; x: number; y: number; z: number }
  | { type: "reset" }
  | { type: "spawnPillar"; x: number; z: number; h: number }
  | { type: "clearPillars" }
  | { type: "heal" }
  | { type: "giveXp"; amount: number }
  | { type: "killEnemies" }
  | { type: "spawnBoss" }
  | { type: "transform" };

const CHANNEL_NAME = "genesis-bus";
const LOCAL_EVENT = "genesis-command";

export function sendGenesisCommand(cmd: GenesisCommand): void {
  if (typeof window === "undefined") return;
  try {
    const bc = new BroadcastChannel(CHANNEL_NAME);
    bc.postMessage(cmd);
    bc.close();
  } catch {
    // BroadcastChannel unavailable — fall through to the local event only.
  }
  window.dispatchEvent(new CustomEvent(LOCAL_EVENT, { detail: cmd }));
}

export function subscribeGenesisCommands(handler: (cmd: GenesisCommand) => void): () => void {
  if (typeof window === "undefined") return () => {};
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(CHANNEL_NAME);
    bc.onmessage = (ev) => handler(ev.data as GenesisCommand);
  } catch {
    bc = null;
  }
  const onLocal = (ev: Event) => handler((ev as CustomEvent<GenesisCommand>).detail);
  window.addEventListener(LOCAL_EVENT, onLocal);
  return () => {
    if (bc) bc.close();
    window.removeEventListener(LOCAL_EVENT, onLocal);
  };
}
