import { useState } from "react";
import { Card, Btn } from "./ui";
import { sendGenesisCommand } from "../genesis/genesisBus";
import { CHARACTERS } from "../genesis/characters";

export function GenesisSection() {
  const [x, setX] = useState(0);
  const [z, setZ] = useState(0);
  return (
    <div className="space-y-3">
      <Card>
        <div className="font-display text-lg">Genesis (3D) — cross-tab command console</div>
        <div className="text-sm text-muted-foreground">
          Commands are broadcast to any open Genesis tab via the genesis bus.
        </div>
      </Card>
      <Card>
        <div className="font-display">Character</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {CHARACTERS.map((c) => (
            <Btn key={c.id} onClick={() => sendGenesisCommand({ type: "setCharacter", id: c.id })}>
              {c.name}
            </Btn>
          ))}
        </div>
      </Card>
      <Card>
        <div className="font-display">Teleport</div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            value={x}
            onChange={(e) => setX(Number(e.target.value))}
            className="w-20 rounded bg-secondary px-2 py-1 text-foreground"
          />
          <input
            type="number"
            value={z}
            onChange={(e) => setZ(Number(e.target.value))}
            className="w-20 rounded bg-secondary px-2 py-1 text-foreground"
          />
          <Btn onClick={() => sendGenesisCommand({ type: "teleport", x, y: 0, z })}>Go</Btn>
          <Btn onClick={() => sendGenesisCommand({ type: "reset" })}>Reset</Btn>
        </div>
      </Card>
    </div>
  );
}
