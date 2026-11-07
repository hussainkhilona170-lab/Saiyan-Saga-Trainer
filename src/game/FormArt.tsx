// Combat-ready SVG portraits for every transformation — actual artwork, not colored dots.
// Style: front-facing chibi portrait with form-specific hair silhouettes, eyes and auras.
import type { ReactElement } from "react";

type FormArtProps = {
  formId: string;
  hair?: string | undefined;
  aura?: string | undefined;
  size?: number;
  className?: string;
};

const INK = "#0d0d12";

const SPIKE_HAIR =
  "M32 7 L24.5 27 L16.5 12 L19.5 31 L28.5 24.5 L32 35 L35.5 24.5 L44.5 31 L47.5 12 L39.5 27 Z";

/** Per-form drawing configuration */
type FormExtra = "kaioken" | "ssj2" | "ssj3" | "ssj4" | "god" | "blue" | "ui";
type FormCfg = { hair: string; skin: string; eye: string; aura: string; extra?: FormExtra };
const FORMS: Record<string, FormCfg> = {
  base: { hair: "#191512", skin: "#eab887", eye: "#141414", aura: "#8a8578" },
  kaioken: { hair: "#221b16", skin: "#eab887", eye: "#3d1414", aura: "#ff5a3c", extra: "kaioken" },
  ssj1: { hair: "#ffd94a", skin: "#eab887", eye: "#262606", aura: "#ffd700" },
  ssj2: { hair: "#ffd94a", skin: "#eab887", eye: "#262606", aura: "#ffef8a", extra: "ssj2" },
  ssj3: { hair: "#ffe85c", skin: "#e0ab74", eye: "#262606", aura: "#ffc93c", extra: "ssj3" },
  ssj4: { hair: "#141414", skin: "#e2a072", eye: "#f5d76e", aura: "#c0392b", extra: "ssj4" },
  god: { hair: "#7a1e14", skin: "#eab887", eye: "#ff6b57", aura: "#ff3b30", extra: "god" },
  blue: { hair: "#37b6ff", skin: "#eab887", eye: "#bdf3ff", aura: "#2ea8ff", extra: "blue" },
  ui: { hair: "#e9e9f4", skin: "#eab887", eye: "#ffffff", aura: "#cfd6ff", extra: "ui" },
};

const fallback = (_formId: string, aura?: string | undefined): FormCfg => ({
  hair: "#3a3348", skin: "#eab887", eye: "#e8e8f4", aura: aura ?? "#7c58ff",
});

export function FormArt({ formId, hair, aura, size = 72, className = "" }: FormArtProps): ReactElement {
  const base = FORMS[formId] ?? fallback(formId, aura);
  const cfg = { ...base, hair: hair ?? base.hair, aura: aura ?? base.aura };
  const uid = `fa-${formId.replace(/[^a-z0-9]/gi, "") || "custom"}-${cfg.aura.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={`select-none ${className}`} role="img" aria-label={`${formId} portrait`}>
      <defs>
        <radialGradient id={`${uid}-aura`} cx="50%" cy="58%" r="55%">
          <stop offset="0%" stopColor={cfg.aura} stopOpacity="0.85" />
          <stop offset="60%" stopColor={cfg.aura} stopOpacity="0.28" />
          <stop offset="100%" stopColor={cfg.aura} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-face`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={cfg.skin} />
          <stop offset="1" stopColor="#caa06b" />
        </linearGradient>
        <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <ellipse cx="32" cy="34" rx="30" ry="29" fill={`url(#${uid}-aura)`} />
      {/* Back flames for Super Saiyan God / Blue */}
      {(cfg.extra === "god" || cfg.extra === "blue") && (
        <g fill={cfg.extra === "god" ? "#ff7a33" : "#7de1ff"} opacity="0.9">
          <path d="M32 2 L36 12 L30 10 Z" /><path d="M18 6 L26 15 L17 15 Z" /><path d="M46 6 L38 15 L47 15 Z" />
        </g>
      )}
      {/* Body (shoulders) */}
      <path d="M12 60 Q32 42 52 60 Z" fill={cfg.extra === "ssj4" ? "#8f2f22" : "#f2792c"} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      {cfg.extra === "ssj4" && <path d="M24 51 L29 57 L34 50 L39 57 L44 51" stroke="#3a3a3a" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      {/* Face */}
      <ellipse cx="32" cy="30" rx="13" ry="14" fill={`url(#${uid}-face)`} stroke={INK} strokeWidth="1.8" />
      {/* SSJ4 red fur around face */}
      {cfg.extra === "ssj4" && <path d="M19 26 Q32 16 45 26 Q44 34 40 37 Q32 33 24 37 Q20 34 19 26 Z" fill="#c0392b" opacity="0.55" />}
      {/* Eyes — fierce angled slits */}
      <g filter={`url(#${uid}-glow)`}>
        <path d="M23 29 L30 27.6 L30 30.4 L23 31 Z" fill={cfg.eye} />
        <path d="M41 29 L34 27.6 L34 30.4 L41 31 Z" fill={cfg.eye} />
      </g>
      {/* Brows */}
      <path d="M22 25 L31 24" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M42 25 L33 24" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
      {/* Nose + mouth */}
      <path d="M32 30 L31.4 34 L32.6 34" stroke={INK} strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 37.5 Q32 38.8 36 37.5" stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* Hair */}
      <path d={SPIKE_HAIR} fill={cfg.hair} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      {/* SSJ3 long flowing hair down the sides */}
      {cfg.extra === "ssj3" && (
        <g fill={cfg.hair} stroke={INK} strokeWidth="1.6" strokeLinejoin="round">
          <path d="M18 24 Q12 40 16 54 Q22 44 24 30 Z" />
          <path d="M46 24 Q52 40 48 54 Q42 44 40 30 Z" />
        </g>
      )}
      {/* SSJ2 lightning arcs */}
      {cfg.extra === "ssj2" && (
        <g stroke="#fff7ae" strokeWidth="1.3" strokeLinecap="round" fill="none" filter={`url(#${uid}-glow)`}>
          <path d="M14 40 L10 46 L14 46 L11 52" />
          <path d="M50 40 L54 46 L50 46 L53 52" />
        </g>
      )}
      {/* Kaioken aura ring */}
      {cfg.extra === "kaioken" && <circle cx="32" cy="32" r="21" fill="none" stroke="#ff4b2c" strokeWidth="2.2" strokeDasharray="6 4" opacity="0.9" />}
      {/* Ultra Instinct heat shimmer + white eyes flare */}
      {cfg.extra === "ui" && (
        <g stroke="#ffffff" strokeWidth="1.1" fill="none" opacity="0.9" filter={`url(#${uid}-glow)`}>
          <path d="M12 22 Q17 19 22 22" /><path d="M42 22 Q47 19 52 22" />
          <path d="M15 46 Q32 41 49 46" />
        </g>
      )}
    </svg>
  );
}
