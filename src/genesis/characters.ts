/**
 * Genesis — selectable fighter roster (prototype stub).
 * Real character models land with the asset pipeline (Milestone B); these
 * entries only drive the procedural rig's palette/scale so selection logic can
 * be exercised and tested now.
 */
export type CharacterDef = {
  id: string;
  name: string;
  title: string;
  gi: string;
  under: string;
  hair: string;
  skin: string;
  scale: number;
};

export const CHARACTERS: CharacterDef[] = [
  {
    id: "saiyan",
    name: "Saiyan",
    title: "Low-class warrior",
    gi: "#f5a54a",
    under: "#2f6fa8",
    hair: "#151528",
    skin: "#ffd9a8",
    scale: 1,
  },
  {
    id: "namekian",
    name: "Namekian",
    title: "Dragon Clan",
    gi: "#35c98e",
    under: "#1f4a3a",
    hair: "#1a2a1a",
    skin: "#7fd6a8",
    scale: 1.06,
  },
  {
    id: "android",
    name: "Android",
    title: "Red Ribbon",
    gi: "#e05252",
    under: "#2a2a2a",
    hair: "#c8c8d0",
    skin: "#d8d8e0",
    scale: 0.96,
  },
];

export function characterByID(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0]!;
}

export function nextCharacterID(current: string): string {
  const i = CHARACTERS.findIndex((c) => c.id === current);
  const next = (i + 1) % CHARACTERS.length;
  return CHARACTERS[next]!.id;
}
