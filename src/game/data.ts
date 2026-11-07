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

export type CustomTechniqueScale = "ki" | "strength" | "agility" | "defense";
export type CustomTechnique = { id: string; name: string; desc: string; scale: CustomTechniqueScale; mult: number; kiCost: number; cooldownMs: number; aura: string };

export const MAX_CUSTOM_TECHNIQUES = 20;
export const MAX_CUSTOM_TECHNIQUE_MULT = 50;

export type BossSignature = { name: string; mult: number };
export type EndlessModifierId = "none" | "aggression" | "heavyweight";
export type Boss = { id: string; name: string; hp: number; atk: number; zeni: number; tp: number; req: number; emoji: string; tournament?: number; signature?: BossSignature; endlessModifier?: EndlessModifierId };
export const BOSSES: Boss[] = [
  { id: "raditz", name: "Raditz", hp: 1500, atk: 10, zeni: 3000, tp: 10, req: 0, emoji: "🦹", signature: { name: "Double Sunday", mult: 2.1 } },
  { id: "vegeta", name: "Vegeta", hp: 25000, atk: 60, zeni: 30000, tp: 30, req: 2000, emoji: "👑", signature: { name: "Final Flash", mult: 2.4 } },
  { id: "frieza", name: "Frieza", hp: 400000, atk: 600, zeni: 300000, tp: 80, req: 35000, emoji: "👽", signature: { name: "Death Beam", mult: 2.4 } },
  { id: "cell", name: "Perfect Cell", hp: 7.5e6, atk: 7500, zeni: 4e6, tp: 200, req: 8e5, emoji: "🦗", signature: { name: "Perfect Beam Barrage", mult: 2.6 } },
  { id: "buu", name: "Kid Buu", hp: 1e8, atk: 8e4, zeni: 6e7, tp: 400, req: 1.5e7, emoji: "🍬", signature: { name: "Planet Buster", mult: 2.8 } },
  { id: "beerus", name: "Beerus", hp: 2e9, atk: 1.2e6, zeni: 2e9, tp: 1000, req: 2.5e8, emoji: "🐱", signature: { name: "Hakai", mult: 3.0 } },
];

export const LOCATIONS = [
  { id: "roshi", name: "Roshi's Island", mult: 1, req: 0, bg: "oklch(0.55 0.12 220)" },
  { id: "korin", name: "Korin Tower", mult: 3, req: 3000, bg: "oklch(0.5 0.1 150)" },
  { id: "htc", name: "Hyperbolic Time Chamber", mult: 10, req: 50000, bg: "oklch(0.75 0.02 90)" },
  { id: "kingkai", name: "King Kai's Planet", mult: 40, req: 1.5e6, bg: "oklch(0.55 0.14 135)" },
  { id: "beerus", name: "Beerus's Planet", mult: 150, req: 6e7, bg: "oklch(0.4 0.14 300)" },
];

export type QuestKind = "pl" | "boss" | "level" | "train" | "explore" | "collect" | "wish" | "tournament";
export type Quest = {
  id: string;
  saga: string;
  title: string;
  desc: string;
  kind: QuestKind;
  count: number;
  stat?: StatKey;
  boss?: string;
  prereq?: string[];
  zeni: number;
  tp: number;
};

export const QUESTS: Quest[] = [
  { id: "q1", saga: "Saiyan Saga", title: "Reach Power Level 500", desc: "Prove your Saiyan blood by powering up to 500.", kind: "pl", count: 500, zeni: 1000, tp: 5 },
  { id: "q11", saga: "Saiyan Saga", title: "Complete 100 training reps", desc: "Every warrior is forged one rep at a time.", kind: "train", count: 100, zeni: 1500, tp: 5 },
  { id: "q12", saga: "Saiyan Saga", title: "Reach Fighter rank (Level 5)", desc: "Level 5 unlocks the true path of the warrior.", kind: "level", count: 5, zeni: 2000, tp: 8 },
  { id: "q2", saga: "Saiyan Saga", title: "Defeat Raditz", desc: "The first Saiyan to stand in your way.", kind: "boss", count: 1, boss: "raditz", prereq: ["q1"], zeni: 3000, tp: 10 },
  { id: "q3", saga: "Saiyan Saga", title: "Defeat Vegeta", desc: "The prideful Saiyan Prince awaits.", kind: "boss", count: 1, boss: "vegeta", prereq: ["q2"], zeni: 30000, tp: 25 },
  { id: "q10", saga: "Saiyan Saga", title: "Scout the wilds — 5 missions", desc: "Search Roshi's Island for caches and the Dragon Balls.", kind: "explore", count: 5, prereq: ["q2"], zeni: 2500, tp: 8 },
  { id: "q13", saga: "Saiyan Saga", title: "Gather 3 Dragon Balls", desc: "Three orbs of wish-granting power, scattered across the world.", kind: "collect", count: 3, prereq: ["q10"], zeni: 5000, tp: 15 },
  { id: "q4", saga: "Namek Saga", title: "Reach Power Level 100,000", desc: "Train under Korin and beyond.", kind: "pl", count: 1e5, prereq: ["q2"], zeni: 100000, tp: 50 },
  { id: "q5", saga: "Namek Saga", title: "Defeat Frieza", desc: "The Emperor of the Universe must fall.", kind: "boss", count: 1, boss: "frieza", prereq: ["q4"], zeni: 4e5, tp: 100 },
  { id: "q6", saga: "Cell Saga", title: "Defeat Perfect Cell", desc: "A bio-engineered nightmare stands guard.", kind: "boss", count: 1, boss: "cell", prereq: ["q5"], zeni: 5e6, tp: 250 },
  { id: "q7", saga: "Buu Saga", title: "Defeat Kid Buu", desc: "Pure, childish chaos consumes the earth.", kind: "boss", count: 1, boss: "buu", prereq: ["q6"], zeni: 8e7, tp: 450 },
  { id: "q14", saga: "Buu Saga", title: "Enter the World Martial Arts Tournament", desc: "Win at least one match in the Tenkaichi Budokai.", kind: "tournament", count: 1, prereq: ["q5"], zeni: 250000, tp: 120 },
  { id: "q15", saga: "Buu Saga", title: "Summon Shenron", desc: "Gather all seven Dragon Balls and make one wish.", kind: "wish", count: 1, prereq: ["q13"], zeni: 1e6, tp: 300 },
  { id: "q8", saga: "Battle of Gods", title: "Reach Power Level 1 Billion", desc: "Only the divine may stand at a billion.", kind: "pl", count: 1e9, prereq: ["q7"], zeni: 1e9, tp: 600 },
  { id: "q9", saga: "Battle of Gods", title: "Defeat Beerus", desc: "The God of Destruction judges all life.", kind: "boss", count: 1, boss: "beerus", prereq: ["q8"], zeni: 1e10, tp: 3000 },
];

export const SAGA_BONUSES: Record<string, { zeni: number; tp: number }> = {
  "Saiyan Saga": { zeni: 20000, tp: 30 },
  "Namek Saga": { zeni: 1000000, tp: 150 },
  "Cell Saga": { zeni: 10000000, tp: 300 },
  "Buu Saga": { zeni: 150000000, tp: 600 },
  "Battle of Gods": { zeni: 2e10, tp: 3000 },
};
export const SAGA_ORDER = ["Saiyan Saga", "Namek Saga", "Cell Saga", "Buu Saga", "Battle of Gods"];

export type TournamentRound = { id: string; name: string; bossId: string; bossName: string; hpMult: number; atkMult: number; entry: number; zeni: number; tp: number; emoji: string };
export const TOURNAMENT: TournamentRound[] = [
  { id: "r1", name: "Opening Match", bossId: "raditz", bossName: "Yamu the Challenger", hpMult: 0.75, atkMult: 0.75, entry: 300, zeni: 10000, tp: 40, emoji: "🥊" },
  { id: "r2", name: "Quarterfinal", bossId: "vegeta", bossName: "Quarterfinal — Vegeta", hpMult: 0.8, atkMult: 0.8, entry: 1500, zeni: 75000, tp: 120, emoji: "👑" },
  { id: "r3", name: "Semifinal", bossId: "cell", bossName: "Semifinal — Cell", hpMult: 0.8, atkMult: 0.8, entry: 60000, zeni: 1500000, tp: 400, emoji: "🦗" },
  { id: "r4", name: "Grand Final", bossId: "beerus", bossName: "Grand Final — Beerus", hpMult: 0.6, atkMult: 0.6, entry: 2.5e7, zeni: 5e9, tp: 1500, emoji: "🐱" },
];

export const PASSES = [
  { id: "x2", name: "2x Training Speed", desc: "Double all training gains", tp: 25 },
  { id: "auto", name: "Auto-Train", desc: "Trains your selected stat automatically", tp: 50 },
  { id: "kicharge", name: "Instant Ki Charge", desc: "Ki meter fills instantly in battle", tp: 75 },
  { id: "uipass", name: "Ultra Instinct Master Pass", desc: "Required to unlock Ultra Instinct", tp: 150 },
  { id: "vip", name: "VIP Perks", desc: "+50% Zeni, 2x stamina regen", tp: 200 },
];

export const WISHES = [
  { id: "zeni", name: "Infinite riches", desc: "+ Zeni equal to 100× your Power Level" },
  { id: "power", name: "Become stronger", desc: "All stats ×2" },
  { id: "tp", name: "Medals of honor", desc: "+500 TP Medals" },
  { id: "stamina", name: "Endless stamina", desc: "+50 max stamina, permanently" },
];

export type EquipmentSlot = "body" | "accessory" | "hands";
export type EquipmentDef = {
  id: string; slot: EquipmentSlot; name: string; desc: string; cost: number; icon: string;
  /** Effect knobs read by the engine; all additive. */
  defenseMult?: number; allStatsMult?: number; trainingMult?: number; scoutBallBonus?: number;
};
export const EQUIPMENT: EquipmentDef[] = [
  { id: "turtle-shell", slot: "body", name: "Turtle Shell", desc: "A legendary training shell. +25% effective Defense.", cost: 50000, icon: "🐢", defenseMult: 0.25 },
  { id: "weighted-gloves", slot: "hands", name: "Weighted Training Gloves", desc: "Constant pressure while training. +20% training gains.", cost: 25000, icon: "🥊", trainingMult: 0.2 },
  { id: "dragon-radar", slot: "accessory", name: "Dragon Radar", desc: "Pinpoints Dragon Balls. Scout finds orbs +5% more often.", cost: 100000, icon: "📡", scoutBallBonus: 0.05 },
  { id: "potara", slot: "accessory", name: "Potara Earrings", desc: "Gift of the Supreme Kai. +10% to your total Power.", cost: 2e8, icon: "💍", allStatsMult: 0.1 },
];

export type ConsumableDef = { id: string; name: string; desc: string; cost: number; icon: string; battleOnly: boolean; battleUse: "senzu" | "tonic" };
export const CONSUMABLES: ConsumableDef[] = [
  { id: "senzu", name: "Senzu Bean", desc: "Fully restores HP. Usable in battle.", cost: 5000, icon: "🫘", battleOnly: true, battleUse: "senzu" },
  { id: "energy-tonic", name: "Energy Tonic", desc: "Completely refills your Ki. Usable in battle.", cost: 3000, icon: "🧪", battleOnly: true, battleUse: "tonic" },
];

export type TechniqueId = "punch" | "heavy" | "blast" | "ultimate" | "vanish" | "charge" | "parry";
export type TechniqueDef = { id: TechniqueId; name: string; icon: string; uses: string; perks: string[] };
export const TECHNIQUES: TechniqueDef[] = [
  { id: "punch", name: "Melee Rush Combo", icon: "👊", uses: "Melee hits landed", perks: ["Rank 2 — longer combo window (950→1050ms)", "Rank 4 — combo chain extends to 10 hits"] },
  { id: "heavy", name: "Heavy Strike", icon: "🥊", uses: "Heavy Strikes landed", perks: ["Rank 2 — finisher bonus 1.5× → 1.75× at 4+ combo"] },
  { id: "blast", name: "Ki Blast", icon: "💥", uses: "Ki blasts fired", perks: ["Rank 2 — Ki cost 20 → 15"] },
  { id: "ultimate", name: "Kamehameha", icon: "🌊", uses: "Kamehameha unleashed", perks: ["Rank 3 — Ki Overload vulnerability 3s → 1.5s"] },
  { id: "vanish", name: "Vanish Strike", icon: "💨", uses: "Vanish Strikes landed", perks: ["Rank 2 — Ki cost 15 → 12"] },
  { id: "charge", name: "Ki Charge", icon: "⚡", uses: "Charge ticks held", perks: ["Rank 2 — charging yields +25% Ki (2.5 → 3.125)"] },
  { id: "parry", name: "Perfect Guard", icon: "🛡️", uses: "Guards braced", perks: ["Rank 2 — cooldown 1.1s → 0.8s", "Rank 3 — window 450 → 550ms"] },
];
/** Uses required for ranks 1..5 */
export const TECHNIQUE_RANKS = [5, 15, 35, 70, 130];

export const ENDLESS_MODIFIERS: { id: EndlessModifierId; name: string; desc: string; rewardMult: number }[] = [
  { id: "none", name: "Standard", desc: "Classic climb — no gimmicks, no gimme.", rewardMult: 1 },
  { id: "aggression", name: "Aggravated Foes", desc: "Boss ATK ×1.5 · rewards ×2.", rewardMult: 2 },
  { id: "heavyweight", name: "Ironclad", desc: "Boss HP ×1.5 · rewards ×2.", rewardMult: 2 },
];
export const ENDLESS_ROSTER = ["raditz", "vegeta", "frieza", "cell", "buu", "beerus"] as const;

export type RaidDef = { id: string; name: string; emoji: string; desc: string; entry: number; bossId?: string; base: Boss; zeni: number; tp: number; ballOnFirstClear: boolean };
export const RAID_BOSSES: RaidDef[] = [
  { id: "broly", name: "Broly — Legendary Super Saiyan", emoji: "🟢", desc: "A tidal wave of uncontrollable power. Even his name makes soldiers flee.", entry: 5e7, base: { id: "raid-broly", name: "Broly", hp: 5e9, atk: 2e6, zeni: 3e10, tp: 600, req: 5e7, emoji: "🟢", signature: { name: "Eraser Cannon", mult: 3.2 } }, zeni: 3e10, tp: 600, ballOnFirstClear: true },
  { id: "janemba", name: "Super Janemba", emoji: "👹", desc: "Unleashed from pride and greed — he ends the world twice over.", entry: 2e8, base: { id: "raid-janemba", name: "Super Janemba", hp: 9e10, atk: 9e6, zeni: 1e11, tp: 1200, req: 2e8, emoji: "👹", signature: { name: "Wasabi Split", mult: 3.4 } }, zeni: 1e11, tp: 1200, ballOnFirstClear: true },
];

export function fmt(n: number): string {
  if (!isFinite(n)) return "∞";
  const u = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx"];
  let i = 0;
  while (Math.abs(n) >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (i === 0 ? Math.floor(n).toString() : n.toFixed(2)) + u[i];
}
