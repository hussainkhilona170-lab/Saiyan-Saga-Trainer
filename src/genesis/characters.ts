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
  /** Vegeta-style battle armor (blue chest plates + white gloves/boots). */
  armor?: boolean;
  /** GLB model path in public/assets. If set, the GLTF rig renders this model. */
  model?: string;
};

export const CHARACTERS: CharacterDef[] = [
  {
    id: "rose",
    name: "Rosé Saiyan",
    title: "Original fighter",
    gi: "#232a4a",
    under: "#b8323a",
    hair: "#0c0c14",
    skin: "#e6b08a",
    scale: 1,
    model: "/assets/characters/rose_saiyan.glb",
  },
  {
    id: "vegeta",
    name: "Saiyan Prince",
    title: "Royal warrior (GLB)",
    gi: "#2f6fd0",
    under: "#f2f2f5",
    hair: "#141424",
    skin: "#ffd9a8",
    scale: 1,
    armor: true,
    model: "/assets/characters/vegeta.glb",
  },
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
