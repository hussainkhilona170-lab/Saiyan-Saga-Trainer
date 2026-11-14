// Detailed anime-style SVG portraits for every transformation.
// Hand-crafted (no image assets) — front-facing bust with form-specific hair,
// eyes, aura and effects. Not photo-realistic; true anime sprites would require
// AI image generation (see PROJECT_STATUS.md "user feedback round 2").
import { useId, type ReactElement } from "react";

type FormArtProps = {
  formId: string;
  hair?: string | undefined;
  aura?: string | undefined;
  size?: number;
  className?: string;
};

const INK = "#0a0a10";

type FormExtra = "kaioken" | "ssj2" | "ssj3" | "ssj4" | "god" | "blue" | "ui";
type FormCfg = { hair: string; skin: string; eye: string; iris: string; aura: string; hairPath: string; extra?: FormExtra };
const FORMS: Record<string, FormCfg> = {
  base: {
    hair: "#1a1410", skin: "#eab887", eye: "#1a1410", iris: "#3a2a18", aura: "#9a9280",
    hairPath: "M14 30 Q16 12 32 9 Q48 12 50 30 Q46 18 40 16 Q36 12 32 11 Q28 12 24 16 Q18 18 14 30 Z M16 26 L13 18 L19 22 Z M22 20 L19 11 L26 17 Z M29 16 L27 7 L33 15 Z M35 16 L37 7 L31 15 Z M42 20 L45 11 L38 17 Z M48 26 L51 18 L45 22 Z",
  },
  kaioken: {
    hair: "#221b16", skin: "#eab887", eye: "#3d1414", iris: "#7a1a1a", aura: "#ff5a3c",
    hairPath: "M14 30 Q16 12 32 9 Q48 12 50 30 Q46 18 40 16 Q36 12 32 11 Q28 12 24 16 Q18 18 14 30 Z M16 26 L13 18 L19 22 Z M22 20 L19 11 L26 17 Z M29 16 L27 7 L33 15 Z M35 16 L37 7 L31 15 Z M42 20 L45 11 L38 17 Z M48 26 L51 18 L45 22 Z",
    extra: "kaioken",
  },
  ssj1: {
    hair: "#ffd94a", skin: "#eab887", eye: "#262606", iris: "#7a6a10", aura: "#ffd700",
    hairPath: "M10 34 Q11 6 32 4 Q53 6 54 34 Q50 14 44 12 Q38 7 32 6 Q26 7 20 12 Q14 14 10 34 Z M12 28 L8 16 L16 22 Z M18 20 L14 8 L22 16 Z M24 14 L22 3 L29 12 Z M29 11 L28 1 L33 10 Z M35 11 L36 1 L31 10 Z M40 14 L42 3 L35 12 Z M46 20 L50 8 L42 16 Z M52 28 L56 16 L48 22 Z",
  },
  ssj2: {
    hair: "#ffd94a", skin: "#eab887", eye: "#262606", iris: "#7a6a10", aura: "#ffef8a",
    hairPath: "M10 34 Q11 6 32 4 Q53 6 54 34 Q50 14 44 12 Q38 7 32 6 Q26 7 20 12 Q14 14 10 34 Z M12 28 L8 16 L16 22 Z M18 20 L14 8 L22 16 Z M24 14 L22 3 L29 12 Z M29 11 L28 1 L33 10 Z M35 11 L36 1 L31 10 Z M40 14 L42 3 L35 12 Z M46 20 L50 8 L42 16 Z M52 28 L56 16 L48 22 Z",
    extra: "ssj2",
  },
  ssj3: {
    hair: "#ffe85c", skin: "#e0ab74", eye: "#262606", iris: "#7a6a10", aura: "#ffc93c",
    hairPath: "M8 32 Q9 4 32 2 Q55 4 56 32 Q52 12 46 10 Q40 5 32 4 Q24 5 18 10 Q12 12 8 32 Z M10 26 L6 14 L14 20 Z M16 18 L12 6 L20 14 Z M22 12 L20 1 L27 10 Z M28 9 L27 -1 L32 8 Z M36 9 L37 -1 L32 8 Z M42 12 L44 1 L37 10 Z M48 18 L52 6 L44 14 Z M54 26 L58 14 L50 20 Z",
    extra: "ssj3",
  },
  ssj4: {
    hair: "#141414", skin: "#e2a072", eye: "#f5d76e", iris: "#b8922a", aura: "#c0392b",
    hairPath: "M14 34 Q16 14 32 11 Q48 14 50 34 Q46 20 40 18 Q36 14 32 13 Q28 14 24 18 Q18 20 14 34 Z M16 30 L12 22 L19 26 Z M22 24 L18 15 L26 21 Z M29 20 L26 11 L33 18 Z M35 20 L38 11 L31 18 Z M42 24 L46 15 L38 21 Z M48 30 L52 22 L45 26 Z",
    extra: "ssj4",
  },
  god: {
    hair: "#7a1e14", skin: "#eab887", eye: "#ff6b57", iris: "#c03020", aura: "#ff3b30",
    hairPath: "M14 30 Q16 12 32 9 Q48 12 50 30 Q46 18 40 16 Q36 12 32 11 Q28 12 24 16 Q18 18 14 30 Z M16 26 L13 18 L19 22 Z M22 20 L19 11 L26 17 Z M29 16 L27 7 L33 15 Z M35 16 L37 7 L31 15 Z M42 20 L45 11 L38 17 Z M48 26 L51 18 L45 22 Z",
    extra: "god",
  },
  blue: {
    hair: "#37b6ff", skin: "#eab887", eye: "#bdf3ff", iris: "#1a7ab8", aura: "#2ea8ff",
    hairPath: "M14 30 Q16 12 32 9 Q48 12 50 30 Q46 18 40 16 Q36 12 32 11 Q28 12 24 16 Q18 18 14 30 Z M16 26 L13 18 L19 22 Z M22 20 L19 11 L26 17 Z M29 16 L27 7 L33 15 Z M35 16 L37 7 L31 15 Z M42 20 L45 11 L38 17 Z M48 26 L51 18 L45 22 Z",
    extra: "blue",
  },
  ui: {
    hair: "#e9e9f4", skin: "#eab887", eye: "#ffffff", iris: "#8a9ab8", aura: "#cfd6ff",
    hairPath: "M14 30 Q16 12 32 9 Q48 12 50 30 Q46 18 40 16 Q36 12 32 11 Q28 12 24 16 Q18 18 14 30 Z M16 26 L13 18 L19 22 Z M22 20 L19 11 L26 17 Z M29 16 L27 7 L33 15 Z M35 16 L37 7 L31 15 Z M42 20 L45 11 L38 17 Z M48 26 L51 18 L45 22 Z",
    extra: "ui",
  },
};

const fallback = (formId: string, aura?: string): FormCfg => ({
  hair: "#3a3348", skin: "#eab887", eye: "#e8e8f4", iris: "#7c58ff", aura: aura ?? "#7c58ff",
  hairPath: "M14 30 Q16 12 32 9 Q48 12 50 30 Q46 18 40 16 Q36 12 32 11 Q28 12 24 16 Q18 18 14 30 Z",
});

const CANON_FORMS = new Set(["base", "kaioken", "ssj1", "ssj2", "ssj3", "ssj4", "god", "blue", "ui"]);

export function FormArt({ formId, hair, aura, size = 72, className = "" }: FormArtProps): ReactElement {
  const uid = `fa${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (CANON_FORMS.has(formId)) {
    return (
      <img src={`/forms/${formId}.png`} width={size} height={size} alt="" aria-hidden="true" className={`select-none ${className}`} style={{ imageRendering: "pixelated", objectFit: "contain" }} />
    );
  }
  const base = FORMS[formId] ?? fallback(formId, aura);
  const cfg = { ...base, hair: hair ?? base.hair, aura: aura ?? base.aura };
  const isSsj4 = cfg.extra === "ssj4";
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={`select-none ${className}`} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${uid}-aura`} cx="50%" cy="58%" r="58%">
          <stop offset="0%" stopColor={cfg.aura} stopOpacity="0.9" />
          <stop offset="55%" stopColor={cfg.aura} stopOpacity="0.35" />
          <stop offset="100%" stopColor={cfg.aura} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-face`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={cfg.skin} />
          <stop offset="1" stopColor="#b8875a" />
        </linearGradient>
        <linearGradient id={`${uid}-hair`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={cfg.hair} />
          <stop offset="1" stopColor="#000000" stopOpacity="0.35" />
        </linearGradient>
        <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Aura */}
      <ellipse cx="32" cy="34" rx="30" ry="29" fill={`url(#${uid}-aura)`} />

      {/* Back flames for God / Blue */}
      {(cfg.extra === "god" || cfg.extra === "blue") && (
        <g fill={cfg.extra === "god" ? "#ff7a33" : "#7de1ff"} opacity="0.9" filter={`url(#${uid}-glow)`}>
          <path d="M32 1 L37 13 L30 11 Z" /><path d="M17 5 L26 16 L16 16 Z" /><path d="M47 5 L38 16 L48 16 Z" />
          <path d="M24 2 L29 10 L22 9 Z" /><path d="M40 2 L35 10 L42 9 Z" />
        </g>
      )}

      {/* Back flames for God / Blue */}
      {(cfg.extra === "god" || cfg.extra === "blue") && (
        <g fill={cfg.extra === "god" ? "#ff7a33" : "#7de1ff"} opacity="0.9" filter={`url(#${uid}-glow)`}>
          <path d="M32 1 L37 13 L30 11 Z" /><path d="M17 5 L26 16 L16 16 Z" /><path d="M47 5 L38 16 L48 16 Z" />
          <path d="M24 2 L29 10 L22 9 Z" /><path d="M40 2 L35 10 L42 9 Z" />
        </g>
      )}

      {/* Body / shoulders */}
      <path d="M10 62 Q32 44 54 62 Z" fill={isSsj4 ? "#8f2f22" : "#f2792c"} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 62 Q32 44 54 62 Z" fill="none" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      {isSsj4 && <path d="M23 52 L28 58 L33 51 L38 58 L43 52" stroke="#2a2a2a" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      {/* Gi collar */}
      <path d="M26 46 L32 52 L38 46" stroke="#ffffff" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      {/* Neck */}
      <rect x="29" y="40" width="6" height="6" fill={`url(#${uid}-face)`} stroke={INK} strokeWidth="1" />

      {/* Face */}
      <ellipse cx="32" cy="30" rx="12.5" ry="13.5" fill={`url(#${uid}-face)`} stroke={INK} strokeWidth="1.8" />
      {/* Cheek shading */}
      <ellipse cx="25" cy="36" rx="4" ry="2" fill="#d99a6c" opacity="0.35" />
      <ellipse cx="39" cy="36" rx="4" ry="2" fill="#d99a6c" opacity="0.35" />

      {/* Ears */}
      <ellipse cx="19.5" cy="31" rx="2.2" ry="3.2" fill={`url(#${uid}-face)`} stroke={INK} strokeWidth="1.2" />
      <ellipse cx="44.5" cy="31" rx="2.2" ry="3.2" fill={`url(#${uid}-face)`} stroke={INK} strokeWidth="1.2" />

      {/* SSJ4 red fur around face */}
      {isSsj4 && <path d="M19 27 Q32 17 45 27 Q44 33 40 36 Q32 32 24 36 Q20 33 19 27 Z" fill="#c0392b" opacity="0.5" />}

      {/* Hair (back layer for SSJ3 long hair) */}
      {cfg.extra === "ssj3" && (
        <g fill={`url(#${uid}-hair)`} stroke={INK} strokeWidth="1.4" strokeLinejoin="round">
          <path d="M17 24 Q11 40 15 56 Q21 45 23 30 Z" />
          <path d="M47 24 Q53 40 49 56 Q43 45 41 30 Z" />
        </g>
      )}

      {/* Hair (main) */}
      <path d={cfg.hairPath} fill={`url(#${uid}-hair)`} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />

      {/* Eyes */}
      <g>
        {/* Left eye */}
        <path d="M22.5 27 Q26.5 25.5 30 27.2 L30 31.2 Q26.5 32.2 22.5 30.8 Z" fill="#ffffff" stroke={INK} strokeWidth="0.9" />
        <ellipse cx="26.2" cy="29" rx="2.1" ry="2.3" fill={cfg.iris} />
        <circle cx="26.2" cy="29" r="1.15" fill={cfg.eye} />
        <circle cx="25.6" cy="28.2" r="0.55" fill="#ffffff" opacity="0.95" />
        {/* Right eye */}
        <path d="M41.5 27 Q37.5 25.5 34 27.2 L34 31.2 Q37.5 32.2 41.5 30.8 Z" fill="#ffffff" stroke={INK} strokeWidth="0.9" />
        <ellipse cx="37.8" cy="29" rx="2.1" ry="2.3" fill={cfg.iris} />
        <circle cx="37.8" cy="29" r="1.15" fill={cfg.eye} />
        <circle cx="38.4" cy="28.2" r="0.55" fill="#ffffff" opacity="0.95" />
      </g>

      {/* Brows */}
      <path d="M22 24.2 Q26 22.8 30 24" stroke={INK} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M42 24.2 Q38 22.8 34 24" stroke={INK} strokeWidth="1.6" strokeLinecap="round" fill="none" />

      {/* Nose */}
      <path d="M32 30.5 L31.3 33.6 L32.7 33.6" stroke={INK} strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* Mouth */}
      <path d="M28.5 37.5 Q32 39 35.5 37.5" stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" />

      {/* SSJ2 lightning arcs */}
      {cfg.extra === "ssj2" && (
        <g stroke="#fff7ae" strokeWidth="1.4" strokeLinecap="round" fill="none" filter={`url(#${uid}-glow)`}>
          <path d="M13 40 L9 47 L13 47 L10 54" />
          <path d="M51 40 L55 47 L51 47 L54 54" />
        </g>
      )}

      {/* Kaioken aura ring */}
      {cfg.extra === "kaioken" && (
        <circle cx="32" cy="32" r="22" fill="none" stroke="#ff4b2c" strokeWidth="2.4" strokeDasharray="7 5" opacity="0.9" filter={`url(#${uid}-glow)`} />
      )}

      {/* Ultra Instinct shimmer */}
      {cfg.extra === "ui" && (
        <g stroke="#ffffff" strokeWidth="1.1" fill="none" opacity="0.9" filter={`url(#${uid}-glow)`}>
          <path d="M12 21 Q17 18 22 21" /><path d="M42 21 Q47 18 52 21" />
          <path d="M14 47 Q32 42 50 47" />
        </g>
      )}

      {/* God/Blue back flames (already drawn above) handled via aura */}
    </svg>
  );
}
