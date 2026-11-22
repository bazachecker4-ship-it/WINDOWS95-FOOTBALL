import {
  HairStyle,
  JERSEY_THEME_STYLES,
  JerseyPattern,
  PlayerRole,
  RoleAppearance,
  Team,
} from "../types/game";

const SKIN_PALETTES = [
  { base: "#f5c6a5", shade: "#d99b78", hair: "#3b2314" },
  { base: "#e6ae84", shade: "#c0845c", hair: "#1e1b18" },
  { base: "#bd7c52", shade: "#945a36", hair: "#111827" },
  { base: "#7c4b32", shade: "#58311e", hair: "#090d16" },
];

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const n = parseInt(clean, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number) {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((1 << 24) | (clamp(r) << 16) | (clamp(g) << 8) | clamp(b))
    .toString(16)
    .slice(1)}`;
}

function lightenHex(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + amount, g + amount, b + amount);
}

function darkenHex(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r - amount, g - amount, b - amount);
}

export function drawPlayerPreviewToCanvas(
  canvas: HTMLCanvasElement,
  role: PlayerRole,
  team: Team,
  skinTone: number,
  appearance?: RoleAppearance
) {
  const c = document.createElement("canvas");
  c.width = 30;
  c.height = 36;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;

  const skin = SKIN_PALETTES[skinTone % SKIN_PALETTES.length];
  const isGK = role === "GK";

  let baseJersey = team === "blue" ? "#2563eb" : "#dc2626";
  if (team === "blue" && appearance?.jerseyTheme) {
    baseJersey = JERSEY_THEME_STYLES[appearance.jerseyTheme].swatch;
  }
  if (isGK) {
    baseJersey = team === "blue" ? "#eab308" : "#059669";
  }

  const jerseyLight = lightenHex(baseJersey, 42);
  const jerseyDark = darkenHex(baseJersey, 46);
  const shortsColor = isGK ? "#1e293b" : team === "blue" ? "#1e3a8a" : "#7f1d1d";
  const pattern: JerseyPattern = appearance?.jerseyPattern ?? "solid";
  const hair: HairStyle = appearance?.hairStyle ?? "classic";

  // Ground contact shadow
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.beginPath();
  ctx.ellipse(15, 31, 7, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs + Boots
  ctx.fillStyle = skin.shade;
  ctx.fillRect(10, 22, 3, 4);
  ctx.fillRect(17, 22, 3, 4);
  ctx.fillStyle = baseJersey;
  ctx.fillRect(10, 24, 3, 4);
  ctx.fillRect(17, 24, 3, 4);
  ctx.fillStyle = "#090d16";
  ctx.fillRect(9, 28, 5, 3);
  ctx.fillRect(16, 28, 5, 3);
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(10, 29, 3, 1);
  ctx.fillRect(17, 29, 3, 1);

  // Shorts
  ctx.fillStyle = "#090d16";
  ctx.fillRect(9, 19, 12, 5);
  ctx.fillStyle = shortsColor;
  ctx.fillRect(10, 19, 10, 4);

  // Arms & Gloves
  ctx.fillStyle = "#090d16";
  ctx.fillRect(6, 12, 4, 8);
  ctx.fillRect(20, 12, 4, 8);
  ctx.fillStyle = skin.base;
  ctx.fillRect(7, 13, 2, 5);
  ctx.fillRect(21, 13, 2, 5);
  if (isGK) {
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(6, 17, 3, 3);
    ctx.fillRect(21, 17, 3, 3);
  }

  // Torso Jersey
  ctx.fillStyle = "#090d16";
  ctx.fillRect(8, 11, 14, 10);
  ctx.fillStyle = baseJersey;
  ctx.fillRect(9, 12, 12, 8);
  ctx.fillRect(8, 13, 14, 5);

  ctx.fillStyle = jerseyLight;
  ctx.fillRect(9, 12, 11, 2);
  ctx.fillStyle = jerseyDark;
  ctx.fillRect(18, 13, 3, 7);

  ctx.fillStyle = "rgba(255,255,255,0.45)";
  if (pattern === "stripes") {
    ctx.fillRect(10, 12, 2, 8);
    ctx.fillRect(16, 12, 2, 8);
  } else if (pattern === "sash") {
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(9 + i, 12 + i, 2, 1);
    }
  }

  // Crest + collar
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(12, 12, 5, 1);
  ctx.fillStyle = "#fde047";
  ctx.fillRect(16, 14, 2, 2);

  // Head & Hair
  ctx.fillStyle = "#090d16";
  ctx.fillRect(10, 2, 10, 8);
  ctx.fillStyle = skin.base;
  ctx.fillRect(11, 4, 8, 5);
  ctx.fillStyle = "#090d16";
  ctx.fillRect(13, 6, 1, 2);
  ctx.fillRect(17, 6, 1, 2);

  if (hair === "mohawk") {
    ctx.fillStyle = "#fde047";
    ctx.fillRect(14, 0, 2, 4);
  } else if (hair === "curly") {
    ctx.fillStyle = skin.hair;
    ctx.fillRect(9, 1, 12, 3);
  } else if (hair === "headband") {
    ctx.fillStyle = skin.hair;
    ctx.fillRect(10, 2, 10, 2);
    ctx.fillStyle = "#f43f5e";
    ctx.fillRect(10, 4, 10, 1);
  } else if (hair === "helmet") {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(9, 2, 12, 4);
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(11, 4, 8, 1);
  } else {
    ctx.fillStyle = isGK ? "#1e293b" : skin.hair;
    ctx.fillRect(10, 2, 10, 2);
  }

  const outCtx = canvas.getContext("2d");
  if (!outCtx) return;
  outCtx.imageSmoothingEnabled = false;
  outCtx.clearRect(0, 0, canvas.width, canvas.height);
  outCtx.drawImage(c, 0, 0, canvas.width, canvas.height);
}
