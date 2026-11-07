export type StatKey = "strength" | "agility" | "ki" | "defense";

export const TRAININGS = [
  { id: "pushups", name: "Push-ups", stat: "strength" as StatKey, icon: "💪", desc: "Raw Strength" },
  { id: "shadow", name: "Shadow Boxing", stat: "agility" as StatKey, icon: "🥊", desc: "Speed & Agility" },
  { id: "meditate", name: "Meditation", stat: "ki" as StatKey, icon: "🧘", desc: "Ki Control" },
  { id: "armor", name: "Heavy Armor", stat: "defense" as StatKey, icon: "🛡️", desc: "Defense" },
] as const;

export type Form = { id: string; name: string; mult: number; req: number; cost: number; aura: string; levelReq: number; pass?: string; hair?: string; custom?: boolean };
export const FORMS: Form[] = [
  { id: "base", name: "Base Form", mult: 1, req: 0, cost: 0, aura: "transparent", levelReq: 1 },
  { id: "kaioken", name: "Kaioken", mult: 2, req: 500, cost: 1500, aura: "oklch(0.62 0.25 25)", levelReq: 2 },
  { id: "ssj1", name: "Super Saiyan", mult: 5, req: 8000, cost: 15000, aura: "oklch(0.88 0.18 95)", levelReq: 4 },
  { id: "ssj2", name: "Super Saiyan 2", mult: 10, req: 60000, cost: 150000, aura: "oklch(0.9 0.2 100)", levelReq: 8 },
  { id: "ssj3", name: "Super Saiyan 3", mult: 25, req: 500000, cost: 1.5e6, aura: "oklch(0.85 0.2 85)", levelReq: 12 },
  { id: "ssj4", name: "Super Saiyan 4", mult: 60, req: 4e6, cost: 2e7, aura: "oklch(0.6 0.22 20)", levelReq: 16 },
  { id: "god", name: "Super Saiyan God", mult: 150, req: 3e7, cost: 1.5e8, aura: "oklch(0.65 0.24 15)", levelReq: 20 },
  { id: "blue", name: "SSGSS Blue", mult: 400, req: 1.5e8, cost: 6e8, aura: "oklch(0.7 0.18 230)", levelReq: 24 },
  { id: "ui", name: "Ultra Instinct", mult: 1200, req: 6e8, cost: 3e9, aura: "oklch(0.92 0.04 260)", levelReq: 28, pass: "uipass" },
];

export type Boss = { id: string; name: string; hp: number; atk: number; zeni: number; tp: number; req: number; emoji: string };
export const BOSSES: Boss[] = [
  { id: "raditz", name: "Raditz", hp: 1500, atk: 10, zeni: 3000, tp: 10, req: 0, emoji: "🦹" },
  { id: "vegeta", name: "Vegeta", hp: 25000, atk: 60, zeni: 30000, tp: 30, req: 2000, emoji: "👑" },
  { id: "frieza", name: "Frieza", hp: 400000, atk: 600, zeni: 300000, tp: 80, req: 35000, emoji: "👽" },
  { id: "cell", name: "Perfect Cell", hp: 7.5e6, atk: 7500, zeni: 4e6, tp: 200, req: 8e5, emoji: "🦗" },
  { id: "buu", name: "Kid Buu", hp: 1e8, atk: 8e4, zeni: 6e7, tp: 400, req: 1.5e7, emoji: "🍬" },
  { id: "beerus", name: "Beerus", hp: 2e9, atk: 1.2e6, zeni: 2e9, tp: 1000, req: 2.5e8, emoji: "🐱" },
];

export const LOCATIONS = [
  { id: "roshi", name: "Roshi's Island", mult: 1, req: 0, bg: "oklch(0.55 0.12 220)" },
  { id: "korin", name: "Korin Tower", mult: 3, req: 3000, bg: "oklch(0.5 0.1 150)" },
  { id: "htc", name: "Hyperbolic Time Chamber", mult: 10, req: 50000, bg: "oklch(0.75 0.02 90)" },
  { id: "kingkai", name: "King Kai's Planet", mult: 40, req: 1.5e6, bg: "oklch(0.55 0.14 135)" },
  { id: "beerus", name: "Beerus's Planet", mult: 150, req: 6e7, bg: "oklch(0.4 0.14 300)" },
];

export type Quest = { id: string; saga: string; title: string; pl?: number; boss?: string; zeni: number; tp: number };
export const QUESTS: Quest[] = [
  { id: "q1", saga: "Saiyan Saga", title: "Reach Power Level 500", pl: 500, zeni: 1000, tp: 5 },
  { id: "q2", saga: "Saiyan Saga", title: "Defeat Raditz", boss: "raditz", zeni: 3000, tp: 10 },
  { id: "q3", saga: "Saiyan Saga", title: "Defeat Vegeta", boss: "vegeta", zeni: 30000, tp: 25 },
  { id: "q4", saga: "Namek Saga", title: "Reach Power Level 100,000", pl: 1e5, zeni: 100000, tp: 50 },
  { id: "q5", saga: "Namek Saga", title: "Defeat Frieza", boss: "frieza", zeni: 4e5, tp: 100 },
  { id: "q6", saga: "Cell Saga", title: "Defeat Perfect Cell", boss: "cell", zeni: 5e6, tp: 250 },
  { id: "q7", saga: "Buu Saga", title: "Defeat Kid Buu", boss: "buu", zeni: 8e7, tp: 450 },
  { id: "q8", saga: "Battle of Gods", title: "Reach Power Level 1 Billion", pl: 1e9, zeni: 1e9, tp: 600 },
  { id: "q9", saga: "Battle of Gods", title: "Defeat Beerus", boss: "beerus", zeni: 1e10, tp: 3000 },
];

export const PASSES = [
  { id: "x2", name: "2x Training Speed", desc: "Double all training gains", tp: 50 },
  { id: "auto", name: "Auto-Train", desc: "Trains your selected stat automatically", tp: 120 },
  { id: "kicharge", name: "Instant Ki Charge", desc: "Ki meter fills instantly in battle", tp: 80 },
  { id: "uipass", name: "Ultra Instinct Master Pass", desc: "Required to unlock Ultra Instinct", tp: 2000 },
  { id: "vip", name: "VIP Perks", desc: "+50% Zeni, 2x stamina regen", tp: 300 },
];

export const WISHES = [
  { id: "zeni", name: "Infinite riches", desc: "+ Zeni equal to 100× your Power Level" },
  { id: "power", name: "Become stronger", desc: "All stats ×2" },
  { id: "tp", name: "Medals of honor", desc: "+500 TP Medals" },
];

export function fmt(n: number): string {
  if (!isFinite(n)) return "∞";
  const u = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx"];
  let i = 0;
  while (Math.abs(n) >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (i === 0 ? Math.floor(n).toString() : n.toFixed(2)) + u[i];
}
