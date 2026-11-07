import { useEffect, useRef } from "react";
import type { Boss } from "./data";

export type BattleAction = "idle" | "punch" | "blast" | "clash" | "vanish" | "kamehameha";
export type BattleSound = "punch" | "blast" | "charge" | "clash" | "win" | "lose" | "vanish" | "ultimate" | "transform" | "levelup" | "tick" | "parry";

type ArenaProps = {
  boss: Boss;
  formName: string;
  aura: string;
  hair?: string | undefined;
  action: BattleAction;
  actionTick: number;
  clashActive: boolean;
  clashProgress: number;
  playerHp: number;
  playerMaxHp: number;
  bossHp: number;
  darkAura?: boolean;
  onArenaClick: () => void;
  onArenaAltClick: () => void;
};

type Palette = {
  sky: string; dusk: string; rock: string; rockLight: string; lava: string; lavaBright: string;
  gi: string; blue: string; skin: string; white: string; gold: string; purple: string;
  green: string; ink: string; text: string; muted: string; primary: string; enemy: string; border: string;
};
type Particle = { x: number; y: number; speed: number; size: number; phase: number };

const W = 1100;
const H = 520;
const FLOOR = 426;

export function StickmanArena({ boss, formName, aura, hair, action, actionTick, clashActive, clashProgress, playerHp, playerMaxHp, bossHp, darkAura, onArenaClick, onArenaAltClick }: ArenaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ boss, formName, aura, hair, action, actionTick, clashActive, clashProgress, playerHp, playerMaxHp, bossHp, darkAura });
  stateRef.current = { boss, formName, aura, hair, action, actionTick, clashActive, clashProgress, playerHp, playerMaxHp, bossHp, darkAura };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const css = getComputedStyle(document.documentElement);
    const palette: Palette = {
      sky: css.getPropertyValue("--arena-sky").trim(),
      dusk: css.getPropertyValue("--arena-dusk").trim(),
      rock: css.getPropertyValue("--arena-rock").trim(),
      rockLight: css.getPropertyValue("--arena-rock-light").trim(),
      lava: css.getPropertyValue("--arena-lava").trim(),
      lavaBright: css.getPropertyValue("--arena-lava-bright").trim(),
      gi: css.getPropertyValue("--arena-gi").trim(),
      blue: css.getPropertyValue("--arena-blue").trim(),
      skin: css.getPropertyValue("--arena-skin").trim(),
      white: css.getPropertyValue("--arena-white").trim(),
      gold: css.getPropertyValue("--arena-gold").trim(),
      purple: css.getPropertyValue("--arena-purple").trim(),
      green: css.getPropertyValue("--arena-green").trim(),
      ink: css.getPropertyValue("--arena-ink").trim(),
      text: css.getPropertyValue("--foreground").trim(),
      muted: css.getPropertyValue("--muted-foreground").trim(),
      primary: css.getPropertyValue("--primary").trim(),
      enemy: css.getPropertyValue("--destructive").trim(),
      border: css.getPropertyValue("--border").trim(),
    };

    const particles: Particle[] = Array.from({ length: 70 }, (_, i) => ({
      x: (i * 173) % W,
      y: 110 + ((i * 79) % 330),
      speed: 0.18 + (i % 7) * 0.09,
      size: 1 + (i % 4) * 0.55,
      phase: i * 1.7,
    }));
    let raf = 0;
    let lastTick = -1;
    let actionStarted = 0;
    let lastTime = 0;
    let shake = 0;
    let resizeObserver: ResizeObserver | null = null;

    const strokePath = (points: [number, number][], color: string, width: number, cap: CanvasLineCap = "round") => {
      ctx.beginPath();
      points.forEach(([x, y], index) => index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = cap;
      ctx.lineJoin = "round";
      ctx.stroke();
    };

    const fillShape = (points: [number, number][], color: string, outline = palette.ink, outlineWidth = 3) => {
      ctx.beginPath();
      points.forEach(([x, y], index) => index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      if (outlineWidth > 0) {
        ctx.strokeStyle = outline;
        ctx.lineWidth = outlineWidth;
        ctx.lineJoin = "round";
        ctx.stroke();
      }
    };

    const glow = (x: number, y: number, radius: number, color: string, alpha = 0.7) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = color;
      ctx.shadowBlur = radius;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2, radius * 0.12), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const lightning = (x: number, y: number, time: number, color: string, seed: number) => {
      const flicker = Math.sin(time * 0.025 + seed * 3.1);
      if (flicker < 0.2) return;
      const points: [number, number][] = [[x, y]];
      for (let i = 1; i <= 5; i++) points.push([x + Math.sin(time * 0.013 + i * 5 + seed) * (8 + i * 2), y + i * 13]);
      ctx.save();
      ctx.globalAlpha = 0.55 + flicker * 0.35;
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
      strokePath(points, palette.white, 2.4);
      strokePath(points, color, 1);
      ctx.restore();
    };

    const drawBackground = (time: number) => {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, palette.sky);
      sky.addColorStop(0.56, palette.dusk);
      sky.addColorStop(1, palette.rock);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      const sunGlow = ctx.createRadialGradient(W * 0.5, 290, 4, W * 0.5, 290, 330);
      sunGlow.addColorStop(0, palette.lavaBright);
      sunGlow.addColorStop(0.23, palette.lava);
      sunGlow.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = sunGlow;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;

      fillShape([[0, 300], [85, 208], [154, 245], [264, 158], [359, 244], [451, 177], [550, 252], [651, 185], [755, 246], [852, 155], [957, 236], [1034, 182], [1100, 236], [1100, 435], [0, 435]], palette.rock, "transparent", 0);
      fillShape([[0, 340], [97, 274], [179, 309], [292, 222], [393, 315], [486, 246], [594, 330], [719, 246], [821, 314], [922, 233], [1020, 298], [1100, 251], [1100, 443], [0, 443]], palette.rockLight, "transparent", 0);

      ctx.globalAlpha = 0.58;
      for (let i = 0; i < 13; i++) {
        const x = ((i * 131 + time * (i % 2 ? 0.025 : -0.018)) % (W + 100) + W + 100) % (W + 100) - 50;
        const y = 195 + (i * 37) % 190;
        fillShape([[x, y], [x + 23, y - 7], [x + 41, y + 3], [x + 33, y + 13], [x + 5, y + 9]], i % 2 ? palette.rock : palette.ink, "transparent", 0);
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = palette.ink;
      ctx.fillRect(0, FLOOR, W, H - FLOOR);
      ctx.fillStyle = palette.rock;
      ctx.fillRect(0, FLOOR + 4, W, H - FLOOR);
      strokePath([[0, FLOOR], [W, FLOOR]], palette.lavaBright, 3);
      for (let i = 0; i < 14; i++) {
        const x = (i * 97 + 22) % W;
        const y = FLOOR + 9 + (i % 3) * 21;
        const drift = Math.sin(time * 0.001 + i) * 5;
        strokePath([[x, y], [x + 13 + drift, y + 5], [x + 6, y + 13], [x + 24 + drift, y + 23]], palette.lava, 1.5);
        if (i % 3 === 0) glow(x + 10, y + 10, 14, palette.lavaBright, 0.3);
      }

      for (const p of particles) {
        const x = (p.x + time * p.speed * 0.04) % W;
        const y = p.y + Math.sin(time * 0.002 + p.phase) * 12 - (time * p.speed * 0.013) % 28;
        ctx.globalAlpha = 0.25 + (Math.sin(time * 0.004 + p.phase) + 1) * 0.19;
        ctx.fillStyle = p.size > 2.2 ? palette.lavaBright : palette.white;
        ctx.fillRect(x, y, p.size, p.size * 1.8);
      }
      ctx.globalAlpha = 1;

      if (["punch", "vanish", "kamehameha"].includes(stateRef.current.action)) {
        const intensity = stateRef.current.action === "kamehameha" ? 0.52 : 0.32;
        ctx.save();
        ctx.globalAlpha = intensity;
        ctx.strokeStyle = palette.white;
        ctx.lineWidth = 3;
        for (let i = 0; i < 28; i++) {
          const angle = (i / 28) * Math.PI * 2;
          const inner = 130 + (i % 3) * 18;
          const outer = inner + 65 + (i % 5) * 22;
          ctx.beginPath();
          ctx.moveTo(W / 2 + Math.cos(angle) * inner, 295 + Math.sin(angle) * inner * 0.56);
          ctx.lineTo(W / 2 + Math.cos(angle) * outer, 295 + Math.sin(angle) * outer * 0.56);
          ctx.stroke();
        }
        ctx.restore();
      }
    };

    const drawAura = (x: number, y: number, color: string, time: number, power: number) => {
      const pulse = Math.sin(time * 0.012 + x) * 0.5 + 0.5;
      ctx.save();
      ctx.globalAlpha = 0.14 + pulse * 0.14;
      ctx.shadowColor = color;
      ctx.shadowBlur = 40 + power * 6;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x, y - 83, 55 + pulse * 10, 108 + pulse * 16, Math.sin(time * 0.001) * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      for (let i = 0; i < 5 + power; i++) {
        const phase = time * 0.004 + i * 1.25;
        const px = x + Math.sin(phase) * (38 + (i % 3) * 7);
        const py = y - ((time * (0.05 + (i % 3) * 0.015) + i * 43) % 142);
        glow(px, py, 16, color, 0.42);
        if (power >= 2 && i % 2 === 0) lightning(px, py - 22, time, color, i);
      }
    };

    const drawFighter = (x: number, ground: number, facing: number, isPlayer: boolean, time: number, current: typeof stateRef.current, elapsed: number) => {
      const id = isPlayer ? "player" : current.boss.id;
      const isFrieza = id === "frieza";
      const isCell = id === "cell";
      const isBuu = id === "buu";
      const isBeerus = id === "beerus";
      const isRaditz = id === "raditz";
      const isVegeta = id === "vegeta";
      const isShadow = id === "shadow-self";
      const primary = isShadow ? palette.ink : isPlayer ? palette.gi : isFrieza ? palette.white : isCell ? palette.green : isBuu ? palette.purple : isBeerus ? palette.purple : palette.white;
      const accent = isShadow ? palette.ink : isPlayer ? palette.blue : isFrieza ? palette.purple : isCell ? palette.ink : isBuu ? palette.gold : isBeerus ? palette.gold : palette.gold;
      const hairColor = isPlayer
        ? current.hair ? current.hair : formName.includes("Ultra") ? palette.white : formName.includes("Blue") ? palette.blue : formName.includes("God") ? palette.enemy : formName.includes("Saiyan") ? palette.gold : palette.ink
        : isShadow ? palette.ink : isFrieza ? palette.white : isCell ? palette.green : isBuu ? palette.purple : isBeerus ? palette.purple : palette.ink;
      const phase = time * 0.006 + (isPlayer ? 0 : 2.1);
      const idle = Math.sin(phase) * 3;
      let fighterX = x + idle;
      let lift = Math.abs(Math.sin(phase * 0.56)) * 5;
      let lean = isPlayer ? 0.08 : -0.03;
      let recoil = 0;

      if (isPlayer && current.action === "punch" && elapsed < 640) {
        const t = Math.min(1, elapsed / 280);
        fighterX += 125 * Math.sin(t * Math.PI * 0.5) - Math.max(0, elapsed - 280) * 0.04;
        lift += Math.sin(Math.min(1, elapsed / 640) * Math.PI) * 16;
        lean = 0.28;
      } else if (isPlayer && current.action === "vanish" && elapsed < 720) {
        const alpha = Math.sin(Math.min(1, elapsed / 720) * Math.PI);
        fighterX += elapsed < 260 ? 120 * alpha : 220 - Math.min(1, (elapsed - 260) / 240) * 150;
        lift += 35 * alpha;
      } else if (isPlayer && ["blast", "kamehameha", "clash"].includes(current.action)) {
        lean = 0.18;
        lift += current.action === "kamehameha" && elapsed < 480 ? 7 : 0;
      }

      if (!isPlayer && elapsed < 580 && ["punch", "blast", "kamehameha", "vanish"].includes(current.action)) {
        recoil = Math.sin(Math.min(1, elapsed / 580) * Math.PI) * 42;
        fighterX += facing * recoil;
        lean -= 0.18;
      }

      const auraColor = current.darkAura ? palette.purple : current.aura;
      if (isPlayer && (formName !== "Base Form" || current.darkAura)) drawAura(fighterX, ground - lift, auraColor, time, formName.includes("Ultra") || formName.includes("God") || formName.includes("Blue") || current.darkAura ? 3 : 2);
      if (isShadow) drawAura(fighterX, ground, palette.purple, time, 2);
      else if (!isPlayer && current.action === "clash") drawAura(fighterX, ground, palette.enemy, time, 1);

      ctx.save();
      ctx.translate(fighterX, ground - lift);
      ctx.scale(facing * (isPlayer ? 1 : 1.06), 1);
      ctx.rotate(lean);

      const stride = Math.sin(phase * 1.3) * 9;
      const attacking = isPlayer && current.action === "punch" && elapsed < 480;
      const charging = isPlayer && current.action === "kamehameha" && elapsed < 500;
      const armOut = isPlayer && (current.action === "blast" || current.action === "clash" || (current.action === "kamehameha" && elapsed >= 500));
      const legColor = isPlayer ? palette.blue : primary;
      const legWidth = isPlayer ? 15 : 17;
      const legA: [number, number][] = attacking ? [[-5, -44], [-17, -14], [-32, 0]] : [[-5, -43], [-17 + stride, -12], [-22 + stride, 0]];
      const legB: [number, number][] = attacking ? [[7, -44], [18, -22], [34, -8]] : [[7, -43], [18 - stride, -12], [22 - stride, 0]];
      strokePath(legA, palette.ink, legWidth + 5);
      strokePath(legA, legColor, legWidth);
      strokePath(legB, palette.ink, legWidth + 5);
      strokePath(legB, legColor, legWidth);
      if (isPlayer) {
        const footA = legA.at(-1) ?? [0, 0];
        const footB = legB.at(-1) ?? [0, 0];
        strokePath([[footA[0] - 8, 1], [footA[0] + 9, 1]], palette.blue, 9);
        strokePath([[footB[0] - 8, 1], [footB[0] + 9, 1]], palette.blue, 9);
      } else if (isFrieza) {
        glow(-22, -9, 16, palette.purple, 0.8);
        glow(22, -9, 16, palette.purple, 0.8);
      }

      if (isFrieza) {
        const tail: [number, number][] = [[-7, -51], [-38, -58 + Math.sin(phase) * 13], [-63, -82], [-88, -74 + Math.cos(phase) * 12]];
        strokePath(tail, palette.ink, 13);
        strokePath(tail, palette.white, 8);
        const tailTip = tail.at(-1) ?? [0, 0];
        ctx.beginPath(); ctx.arc(tailTip[0], tailTip[1], 8, 0, Math.PI * 2); ctx.fillStyle = palette.purple; ctx.fill();
      }
      if (isBeerus) {
        const tail: [number, number][] = [[-10, -52], [-36, -63], [-52, -85 + Math.sin(phase) * 7], [-38, -100 + Math.cos(phase) * 9]];
        strokePath(tail, palette.ink, 9); strokePath(tail, palette.purple, 5);
      }

      const torso: [number, number][] = [[-18, -103], [18, -103], [24, -68], [13, -43], [-14, -43], [-24, -68]];
      fillShape(torso, primary, palette.ink, 4);
      if (isPlayer) {
        fillShape([[-18, -101], [-2, -94], [-13, -67], [-22, -75]], palette.blue, "transparent", 0);
        fillShape([[18, -101], [2, -94], [13, -67], [22, -75]], palette.blue, "transparent", 0);
        strokePath([[-11, -47], [0, -41], [12, -48]], palette.gold, 5);
      } else if (isFrieza) {
        glow(0, -95, 22, palette.purple, 0.9);
        const gems: [number, number][] = [[-17, -93], [17, -93], [-20, -66], [20, -66], [0, -48]];
        for (const [gx, gy] of gems) {
          ctx.beginPath(); ctx.arc(gx, gy, 5, 0, Math.PI * 2); ctx.fillStyle = palette.purple; ctx.fill();
        }
      } else if (isCell) {
        for (let i = 0; i < 4; i++) {
          ctx.beginPath(); ctx.arc(i % 2 ? 13 : -13, -95 + i * 10, 3.1, 0, Math.PI * 2); ctx.fillStyle = palette.ink; ctx.fill();
        }
        fillShape([[-23, -99], [-37, -94], [-32, -67], [-20, -68]], palette.green, palette.ink, 3);
        fillShape([[23, -99], [37, -94], [32, -67], [20, -68]], palette.green, palette.ink, 3);
      } else if (isBeerus) {
        strokePath([[-19, -97], [-31, -78], [-24, -60], [22, -60], [31, -78], [19, -97]], palette.gold, 7);
        strokePath([[-17, -53], [18, -53]], palette.gold, 5);
      } else if (!isBuu) {
        fillShape([[-20, -99], [-31, -95], [-30, -66], [-19, -64]], accent, palette.ink, 3);
        fillShape([[20, -99], [31, -95], [30, -66], [19, -64]], accent, palette.ink, 3);
        strokePath([[-19, -91], [19, -91]], palette.gold, 4);
      } else {
        strokePath([[-17, -47], [0, -42], [18, -47]], palette.gold, 5);
        ctx.fillStyle = palette.ink; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.fillText("M", 0, -45);
      }

      const leftArm: [number, number][] = armOut ? [[-17, -98], [-32, -80], [-15, -68]] : [[-17, -98], [-33, -78], [-26, -58]];
      const rightArm: [number, number][] = charging
        ? [[17, -98], [31, -82], [16, -75]]
        : attacking ? [[16, -98], [40, -100], [66, -105]]
          : armOut ? [[17, -98], [38, -89], [55, -87]] : [[17, -98], [34, -78], [26, -59]];
      const arms: { points: [number, number][]; glove: string }[] = [
        { points: leftArm, glove: isPlayer ? palette.blue : accent },
        { points: rightArm, glove: isPlayer ? palette.blue : accent },
      ];
      for (const arm of arms) {
        const shoulder = arm.points[0];
        const elbow = arm.points[1];
        const hand = arm.points[2];
        if (!shoulder || !elbow || !hand) continue;
        strokePath([shoulder, elbow, hand], palette.ink, 13);
        strokePath([shoulder, elbow, hand], isPlayer ? palette.skin : primary, 8);
        ctx.beginPath(); ctx.arc(hand[0], hand[1], attacking && arm.points === rightArm ? 12 : 8, 0, Math.PI * 2); ctx.fillStyle = arm.glove; ctx.fill(); ctx.strokeStyle = palette.ink; ctx.lineWidth = 2; ctx.stroke();
      }

      if (isCell) {
        fillShape([[-16, -108], [-36, -117], [-43, -92], [-25, -84]], palette.ink, "transparent", 0);
        fillShape([[16, -108], [36, -117], [43, -92], [25, -84]], palette.ink, "transparent", 0);
      }

      const headY = -124;
      if (isBeerus) {
        fillShape([[-17, headY - 5], [-34, headY - 47], [-11, headY - 32], [-3, headY - 6]], palette.purple, palette.ink, 3);
        fillShape([[17, headY - 5], [34, headY - 47], [11, headY - 32], [3, headY - 6]], palette.purple, palette.ink, 3);
      } else if (isRaditz || isVegeta) {
        for (let i = 0; i < (isRaditz ? 9 : 7); i++) {
          const angle = Math.PI + i * Math.PI / ((isRaditz ? 9 : 7) - 1);
          const length = isRaditz ? 34 + (i % 3) * 10 : 28 + (i % 2) * 7;
          const x1 = Math.cos(angle) * 14;
          const y1 = headY + Math.sin(angle) * 13;
          const x2 = Math.cos(angle) * length;
          const y2 = headY + Math.sin(angle) * length - (i % 2 ? 9 : 0);
          fillShape([[x1 - 5, y1 + 5], [x2, y2], [x1 + 6, y1 + 7]], isRaditz ? palette.ink : palette.ink, "transparent", 0);
        }
      } else if (isCell) {
        fillShape([[-18, headY - 3], [-27, headY - 28], [-10, headY - 20], [0, headY - 38], [9, headY - 20], [27, headY - 28], [18, headY - 3]], palette.green, palette.ink, 3);
      } else if (isBuu) {
        strokePath([[0, headY - 13], [4, headY - 36], [17, headY - 52]], palette.ink, 8);
        strokePath([[0, headY - 13], [4, headY - 36], [17, headY - 52]], palette.purple, 5);
        ctx.beginPath(); ctx.arc(17, headY - 52, 4, 0, Math.PI * 2); ctx.fillStyle = palette.purple; ctx.fill();
      } else if (isPlayer && formName.includes("3")) {
        fillShape([[-17, headY + 1], [-35, headY - 15], [-31, headY + 14], [-23, headY + 67], [-8, headY + 39], [0, headY + 4]], hairColor, palette.ink, 2);
        fillShape([[17, headY + 1], [36, headY - 14], [33, headY + 24], [26, headY + 72], [9, headY + 40], [0, headY + 4]], hairColor, palette.ink, 2);
      } else if (isFrieza) {
        ctx.beginPath(); ctx.ellipse(0, headY - 6, 21, 24, 0, 0, Math.PI * 2); ctx.fillStyle = palette.white; ctx.fill(); ctx.strokeStyle = palette.ink; ctx.lineWidth = 3; ctx.stroke();
        fillShape([[-19, headY - 17], [-11, headY - 32], [0, headY - 37], [12, headY - 30], [20, headY - 16]], palette.purple, palette.ink, 2);
      } else {
        const hairSize = isPlayer ? (formName === "Base Form" ? 25 : 35) : isRaditz ? 47 : isVegeta ? 33 : 26;
        for (let i = 0; i < (isPlayer ? 7 : 6); i++) {
          const angle = Math.PI + i * Math.PI / ((isPlayer ? 7 : 6) - 1);
          const x1 = Math.cos(angle) * 14;
          const y1 = headY + Math.sin(angle) * 12;
          const x2 = Math.cos(angle) * (hairSize + (i % 3) * 5);
          const y2 = headY + Math.sin(angle) * (hairSize + (i % 3) * 5);
          fillShape([[x1 - 5, y1 + 5], [x2, y2], [x1 + 6, y1 + 7]], hairColor, "transparent", 0);
        }
      }

      if (!isFrieza) {
        ctx.beginPath(); ctx.ellipse(0, headY, isBuu ? 17 : isBeerus ? 14 : 16, isBuu ? 19 : 17, 0, 0, Math.PI * 2);
        ctx.fillStyle = isShadow ? palette.ink : isBeerus || isBuu ? palette.purple : isCell ? palette.green : isPlayer ? palette.skin : isRaditz || isVegeta ? palette.skin : palette.white;
        ctx.fill(); ctx.strokeStyle = palette.ink; ctx.lineWidth = 3; ctx.stroke();
      }
      if (isShadow) {
        ctx.beginPath(); ctx.arc(-5, headY, 2.8, 0, Math.PI * 2); ctx.fillStyle = palette.enemy; ctx.fill();
        ctx.beginPath(); ctx.arc(6, headY, 2.8, 0, Math.PI * 2); ctx.fillStyle = palette.enemy; ctx.fill();
        glow(-5, headY, 12, palette.enemy, 0.9);
        glow(6, headY, 12, palette.enemy, 0.9);
      } else if (isFrieza) {
        ctx.beginPath(); ctx.arc(7, headY - 7, 2.5, 0, Math.PI * 2); ctx.fillStyle = palette.enemy; ctx.fill();
      } else {
        strokePath([[5, headY + 1], [12, headY + 2]], palette.ink, 2.2);
        if (isRaditz) {
          ctx.fillStyle = palette.green; ctx.fillRect(5, headY - 7, 13, 5); ctx.strokeStyle = palette.lavaBright; ctx.lineWidth = 1; ctx.strokeRect(4, headY - 8, 15, 7);
        }
      }
      ctx.restore();
    };

    const drawActionFx = (time: number, elapsed: number, current: typeof stateRef.current, heroX: number, enemyX: number) => {
      if (current.action === "punch" && elapsed < 600) {
        const p = Math.min(1, elapsed / 300);
        const impactX = heroX + 80 + p * 86;
        const impactY = FLOOR - 140 - Math.sin(p * Math.PI) * 20;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, elapsed - 300) / 300);
        ctx.strokeStyle = palette.lavaBright; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(impactX, impactY, 20 + Math.min(1, elapsed / 160) * 78, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 18; i++) {
          const a = i * Math.PI / 9 + time * 0.002;
          const r = 24 + ((i * 13 + elapsed * 0.45) % 95);
          strokePath([[impactX + Math.cos(a) * r, impactY + Math.sin(a) * r], [impactX + Math.cos(a) * (r + 11), impactY + Math.sin(a) * (r + 11)]], i % 2 ? palette.white : palette.lavaBright, 3);
        }
        ctx.restore();
      }

      if (current.action === "vanish" && elapsed < 720) {
        for (let i = 1; i <= 3; i++) {
          ctx.save(); ctx.globalAlpha = Math.max(0, 0.25 - elapsed / 3000 - i * 0.035);
          ctx.fillStyle = current.aura; ctx.beginPath(); ctx.ellipse(260 + i * 65, FLOOR - 115, 28, 80, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
        if (elapsed > 230 && elapsed < 580) {
          const burst = Math.min(1, (elapsed - 230) / 60);
          ctx.save(); ctx.globalAlpha = 1 - burst * 0.5; ctx.strokeStyle = palette.white; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(enemyX - 25, FLOOR - 120, burst * 66, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
      }

      if (current.action === "blast" && elapsed < 750) {
        const progress = Math.min(1, elapsed / 450);
        const x = 365 + progress * 365;
        const y = FLOOR - 141 + Math.sin(time * 0.035) * 5;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, elapsed - 450) / 300);
        strokePath([[340, y], [x, y]], current.aura, 18); strokePath([[340, y], [x, y]], palette.white, 5);
        glow(x, y, 34, current.aura, 0.9);
        for (let i = 0; i < 8; i++) {
          const py = y + Math.sin(time * 0.017 + i) * (13 + i * 2);
          ctx.beginPath(); ctx.arc(x - i * 17, py, 4 + (i % 3) * 2, 0, Math.PI * 2); ctx.fillStyle = i % 2 ? palette.white : current.aura; ctx.fill();
        }
        ctx.restore();
      }

      if (current.action === "kamehameha" && elapsed < 1400) {
        if (elapsed < 500) {
          const charge = Math.min(1, elapsed / 500);
          const cx = 385; const cy = FLOOR - 163;
          ctx.save(); ctx.globalAlpha = 0.28 + charge * 0.55;
          ctx.beginPath(); ctx.arc(cx, cy, 8 + charge * 44 + Math.sin(time * 0.045) * 5, 0, Math.PI * 2);
          ctx.fillStyle = current.aura; ctx.shadowColor = current.aura; ctx.shadowBlur = 38; ctx.fill();
          for (let i = 0; i < 12; i++) {
            const angle = time * 0.014 + i * Math.PI / 6;
            const r = 24 + Math.sin(time * 0.01 + i) * 7;
            const px = cx + Math.cos(angle) * r; const py = cy + Math.sin(angle) * r;
            ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fillStyle = palette.white; ctx.fill();
            strokePath([[px, py], [cx + Math.cos(angle + 0.3) * 9, cy + Math.sin(angle + 0.3) * 9]], current.aura, 2);
          }
          ctx.restore();
        } else {
          const blast = Math.min(1, (elapsed - 500) / 130);
          const fade = Math.max(0, 1 - Math.max(0, elapsed - 850) / 550);
          const start = 390; const end = 1030;
          ctx.save(); ctx.globalAlpha = fade;
          const beam = ctx.createLinearGradient(start, 0, end, 0);
          beam.addColorStop(0, current.aura); beam.addColorStop(0.52, palette.white); beam.addColorStop(1, current.aura);
          ctx.shadowColor = current.aura; ctx.shadowBlur = 44;
          ctx.fillStyle = beam;
          ctx.beginPath(); ctx.moveTo(start, FLOOR - 181 - blast * 19); ctx.lineTo(end, FLOOR - 145); ctx.lineTo(end, FLOOR - 102); ctx.lineTo(start, FLOOR - 151 + blast * 16); ctx.closePath(); ctx.fill();
          ctx.globalAlpha = fade * 0.84; ctx.fillStyle = palette.white;
          ctx.beginPath(); ctx.moveTo(start, FLOOR - 159); ctx.lineTo(end, FLOOR - 139); ctx.lineTo(end, FLOOR - 124); ctx.lineTo(start, FLOOR - 143); ctx.closePath(); ctx.fill();
          for (let i = 0; i < 12; i++) {
            const y = FLOOR - 145 + Math.sin(time * 0.03 + i * 2) * 22;
            strokePath([[end - i * 40, y - 18], [end - i * 40 - 18, y], [end - i * 40 - 5, y + 10]], i % 2 ? palette.white : current.aura, 2.4);
          }
          ctx.restore();
        }
      }
    };

    const drawClash = (time: number, current: typeof stateRef.current) => {
      const middle = W / 2 + (current.clashProgress - 50) * 3.2;
      const y = FLOOR - 161;
      ctx.save();
      ctx.globalAlpha = 0.72;
      strokePath([[350, y], [middle, y]], current.aura, 34);
      strokePath([[750, y], [middle, y]], palette.enemy, 34);
      ctx.globalAlpha = 0.92;
      strokePath([[350, y], [middle, y]], palette.white, 8);
      strokePath([[750, y], [middle, y]], palette.white, 8);
      ctx.translate(middle, y);
      ctx.rotate(time * 0.009);
      ctx.shadowColor = palette.lavaBright; ctx.shadowBlur = 38;
      ctx.fillStyle = palette.white;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const r = i % 2 === 0 ? 33 + Math.sin(time * 0.035) * 5 : 17;
        const a = i * Math.PI / 8;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
      ctx.restore();
      for (let i = 0; i < 8; i++) lightning(middle + Math.sin(time * 0.01 + i) * 38, y + Math.cos(time * 0.011 + i) * 28, time, i % 2 ? current.aura : palette.enemy, i);
    };

    const drawHud = (current: typeof stateRef.current) => {
      const panel = (x: number, label: string, value: number, max: number, color: string, alignRight: boolean) => {
        const width = 335; const y = 20; const h = 53;
        ctx.save();
        ctx.fillStyle = "oklch(0.12 0.025 270 / 88%)";
        ctx.strokeStyle = color; ctx.lineWidth = 2.5;
        ctx.beginPath();
        if (alignRight) { ctx.moveTo(x + width, y); ctx.lineTo(x + 20, y); ctx.lineTo(x, y + h / 2); ctx.lineTo(x + 20, y + h); ctx.lineTo(x + width, y + h); }
        else { ctx.moveTo(x, y); ctx.lineTo(x + width - 20, y); ctx.lineTo(x + width, y + h / 2); ctx.lineTo(x + width - 20, y + h); ctx.lineTo(x, y + h); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.textAlign = alignRight ? "right" : "left";
        ctx.font = "900 22px sans-serif"; ctx.fillStyle = palette.white;
        ctx.fillText(label.toUpperCase(), alignRight ? x + width - 17 : x + 17, y + 25);
        ctx.fillStyle = palette.ink; ctx.fillRect(x + 18, y + 34, width - 36, 11);
        ctx.fillStyle = color; ctx.fillRect(x + 18, y + 34, (width - 36) * Math.max(0, Math.min(1, value / Math.max(1, max))), 11);
        ctx.restore();
      };
      panel(22, "GOKU", current.playerHp, current.playerMaxHp, current.aura, false);
      panel(W - 357, current.boss.name, current.bossHp, current.boss.hp, palette.enemy, true);
      ctx.save(); ctx.fillStyle = "oklch(0.12 0.025 270 / 90%)"; ctx.strokeStyle = palette.gold; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(W / 2 - 54, 17, 108, 42, 13); ctx.fill(); ctx.stroke();
      ctx.fillStyle = palette.white; ctx.textAlign = "center"; ctx.font = "900 17px sans-serif"; ctx.fillText("VS", W / 2, 44); ctx.restore();
    };

    const draw = (timestamp: number) => {
      const current = stateRef.current;
      const elapsedFrame = Math.min(50, Math.max(0, timestamp - lastTime));
      lastTime = timestamp;
      if (current.actionTick !== lastTick) {
        lastTick = current.actionTick;
        actionStarted = timestamp;
        if (["punch", "kamehameha", "clash"].includes(current.action)) shake = current.action === "kamehameha" ? 5 : 2;
      }
      shake *= Math.pow(0.87, elapsedFrame / 16);
      const elapsed = timestamp - actionStarted;
      const sx = shake > 0.15 ? Math.sin(timestamp * 0.09) * shake : 0;
      const sy = shake > 0.15 ? Math.cos(timestamp * 0.12) * shake * 0.6 : 0;
      ctx.clearRect(0, 0, W, H);
      ctx.save(); ctx.translate(sx, sy);
      drawBackground(timestamp);
      drawActionFx(timestamp, elapsed, current, 282, 818);
      if (current.action === "vanish" && elapsed < 720) {
        for (let i = 1; i <= 3; i++) {
          ctx.save(); ctx.globalAlpha = 0.18 - i * 0.035; ctx.translate(282 - i * 34, FLOOR - 2); ctx.scale(0.8, 0.9);
          ctx.fillStyle = current.aura; ctx.beginPath(); ctx.ellipse(0, -90, 29, 80, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
      }
      drawFighter(282, FLOOR, 1, true, timestamp, current, elapsed);
      drawFighter(current.action === "vanish" && elapsed > 260 && elapsed < 600 ? 815 : 818, FLOOR, -1, false, timestamp, current, elapsed);
      if (current.clashActive) drawClash(timestamp, current);
      drawHud(current);
      ctx.restore();
      raf = requestAnimationFrame(draw);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    };
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); resizeObserver?.disconnect(); };
  }, [formName]);

  return (
    <div className="relative overflow-hidden border-y border-border bg-background shadow-[0_0_40px_var(--arena-lava)]" onClick={(event) => { if (!clashActive) onArenaClick(); }} onContextMenu={(event) => { event.preventDefault(); if (!clashActive) onArenaAltClick(); }}>
      <canvas ref={canvasRef} width={W} height={H} className="block aspect-[11/5] w-full min-h-[250px] max-h-[560px] cursor-crosshair" aria-label={`Battle arena. Click for a punch, right-click for a vanish strike. Your ${formName} fighter versus ${boss.name}`} role="img" />
      {clashActive && <div className="pointer-events-none absolute inset-x-0 top-[46%] text-center font-display text-3xl text-foreground drop-shadow-[0_0_14px_var(--primary)]">BEAM CLASH!</div>}
      <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-md border border-border bg-background/70 px-3 py-1 text-xs text-foreground/80">CLICK / J punch · RIGHT-CLICK / SHIFT vanish</div>
      <div className="pointer-events-none absolute bottom-3 left-4 font-display text-xs uppercase text-foreground/80">{formName}</div>
      <div className="pointer-events-none absolute bottom-3 right-4 font-display text-xs uppercase text-foreground/80">{boss.name}</div>
    </div>
  );
}

let battleAudio: AudioContext | null = null;

export function playBattleSound(effect: BattleSound) {
  if (typeof window === "undefined" || !window.AudioContext) return;
  battleAudio ??= new window.AudioContext();
  const context = battleAudio;
  if (context.state === "suspended") void context.resume();
  const now = context.currentTime;
  const settings: Record<BattleSound, { from: number; to: number; duration: number; gain: number; type: OscillatorType }> = {
    punch: { from: 118, to: 42, duration: 0.2, gain: 0.19, type: "sine" },
    blast: { from: 160, to: 740, duration: 0.34, gain: 0.095, type: "sawtooth" },
    charge: { from: 76, to: 260, duration: 0.5, gain: 0.09, type: "triangle" },
    clash: { from: 130, to: 790, duration: 0.38, gain: 0.13, type: "sawtooth" },
    win: { from: 280, to: 980, duration: 0.55, gain: 0.13, type: "triangle" },
    lose: { from: 260, to: 48, duration: 0.5, gain: 0.13, type: "sawtooth" },
    vanish: { from: 720, to: 115, duration: 0.22, gain: 0.12, type: "sine" },
    ultimate: { from: 55, to: 540, duration: 0.9, gain: 0.16, type: "sawtooth" },
    transform: { from: 180, to: 880, duration: 1.0, gain: 0.17, type: "triangle" },
    levelup: { from: 523, to: 784, duration: 0.28, gain: 0.11, type: "triangle" },
    tick: { from: 950, to: 620, duration: 0.07, gain: 0.05, type: "square" },
    parry: { from: 2400, to: 950, duration: 0.12, gain: 0.14, type: "square" },
  };
  const setting = settings[effect];
  // Slight pitch jitter on hit sounds keeps rapid attacks from sounding robotic.
  const jitter = ["punch", "blast", "tick", "parry", "clash"].includes(effect) ? 0.9 + Math.random() * 0.22 : 1;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = setting.type;
  osc.frequency.setValueAtTime(setting.from * jitter, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, setting.to), now + setting.duration);
  gain.gain.setValueAtTime(setting.gain, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + setting.duration);
  osc.connect(gain); gain.connect(context.destination); osc.start(now); osc.stop(now + setting.duration);

  if (["punch", "clash", "ultimate", "win"].includes(effect)) {
    const length = Math.max(1, Math.floor(context.sampleRate * (effect === "ultimate" ? 0.7 : 0.16)));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const noise = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    filter.type = effect === "ultimate" ? "lowpass" : "bandpass";
    filter.frequency.value = effect === "ultimate" ? 700 : 1700;
    noiseGain.gain.setValueAtTime(effect === "ultimate" ? 0.14 : 0.1, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + (effect === "ultimate" ? 0.7 : 0.16));
    noise.buffer = buffer; noise.connect(filter); filter.connect(noiseGain); noiseGain.connect(context.destination); noise.start(now);
  }
}