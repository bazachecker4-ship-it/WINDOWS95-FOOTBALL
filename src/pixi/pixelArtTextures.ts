import * as PIXI from "pixi.js";
import {
  GOAL_ROWS,
  HairStyle,
  JERSEY_THEME_STYLES,
  JerseyPattern,
  PITCH_COLS,
  PITCH_ROWS,
  PitchType,
  PlayerRole,
  RoleAppearance,
  Team,
} from "../types/game";

export const CELL_SIZE = 32;
export const GOAL_DEPTH = 44;
export const MARGIN_X = GOAL_DEPTH + 20; // 64
export const MARGIN_Y = 30;
export const WORLD_W = PITCH_COLS * CELL_SIZE + MARGIN_X * 2; // 1152
export const WORLD_H = PITCH_ROWS * CELL_SIZE + MARGIN_Y * 2; // 1084

const SKIN_PALETTES = [
  { base: "#f5c6a5", shade: "#d99b78", hair: "#3b2314" },
  { base: "#e6ae84", shade: "#c0845c", hair: "#1e1b18" },
  { base: "#bd7c52", shade: "#945a36", hair: "#111827" },
  { base: "#7c4b32", shade: "#58311e", hair: "#090d16" },
];

export function toNearestTexture(canvas: HTMLCanvasElement): PIXI.Texture {
  const tex = PIXI.Texture.from(canvas);
  tex.source.scaleMode = "nearest";
  return tex;
}

export function createPitchTexture(pitchType: PitchType): PIXI.Texture {
  // 2x pixel block scale for crisp 16-bit VGA retro fidelity
  const scale = 2;
  const w = Math.floor(WORLD_W / scale);
  const h = Math.floor(WORLD_H / scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  // Stadium track / concrete perimeter
  ctx.fillStyle = "#0e151a";
  ctx.fillRect(0, 0, w, h);

  // Subtle stadium track border texture
  ctx.fillStyle = "#162028";
  for (let x = 0; x < w; x += 6) {
    ctx.fillRect(x, 0, 3, h);
  }

  const fx = Math.floor(MARGIN_X / scale);
  const fy = Math.floor(MARGIN_Y / scale);
  const fw = Math.floor((PITCH_COLS * CELL_SIZE) / scale);
  const fh = Math.floor((PITCH_ROWS * CELL_SIZE) / scale);
  const colW = fw / PITCH_COLS;
  const rowH = fh / PITCH_ROWS;

  // Retro 90s PC Perimeter Ad Boards (Top & Bottom)
  const drawAdStrip = (yPos: number) => {
    const ads = [
      { bg: "#000080", fg: "#fef08a", txt: "BLITZ 95" },
      { bg: "#991b1b", fg: "#ffffff", txt: "VGA-CUP" },
      { bg: "#14532d", fg: "#86efac", txt: "TURBO" },
      { bg: "#1e293b", fg: "#38bdf8", txt: "32x32" },
      { bg: "#7c2d12", fg: "#fde68a", txt: "11v11" },
      { bg: "#000080", fg: "#ffffff", txt: "GOAL!" },
    ];
    const segW = Math.floor(fw / ads.length);
    ads.forEach((ad, idx) => {
      const ax = fx + idx * segW;
      const aw = idx === ads.length - 1 ? fw - idx * segW - 1 : segW - 1;
      ctx.fillStyle = ad.bg;
      ctx.fillRect(ax, yPos, aw, 9);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1;
      ctx.strokeRect(ax + 0.5, yPos + 0.5, aw - 1, 8);
      ctx.fillStyle = ad.fg;
      ctx.font = "bold 6px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ad.txt, ax + aw / 2, yPos + 4.8);
    });
  };
  drawAdStrip(fy - 11);
  drawAdStrip(fy + fh + 2);

  // Surface palette per pitch type
  const palette =
    pitchType === "ice"
      ? { a: "#1b5978", b: "#21698d", alt: "#1e6182", speck: "#bae6fd", line: "#e0f2fe" }
      : pitchType === "sand"
      ? { a: "#a87e3a", b: "#997031", alt: "#a17835", speck: "#fde68a", line: "#fef3c7" }
      : pitchType === "obstacles"
      ? { a: "#185341", b: "#144838", alt: "#164e3d", speck: "#6ee7b7", line: "#e2e8f0" }
      : { a: "#1d6839", b: "#185830", alt: "#1a6035", speck: "#86efac", line: "#f8fafc" };

  // Classic 2-column stadium mowing bands + subtle horizontal cross-check
  for (let c = 0; c < PITCH_COLS; c++) {
    const bandEven = Math.floor(c / 2) % 2 === 0;
    for (let r = 0; r < PITCH_ROWS; r++) {
      const rowEven = Math.floor(r / 2) % 2 === 0;
      if (bandEven) {
        ctx.fillStyle = rowEven ? palette.a : palette.alt;
      } else {
        ctx.fillStyle = rowEven ? palette.alt : palette.b;
      }
      ctx.fillRect(
        Math.floor(fx + c * colW),
        Math.floor(fy + r * rowH),
        Math.ceil(colW),
        Math.ceil(rowH)
      );
    }
  }

  // Deterministic pixel texture (grass tufts / ice cracks / sand ripples)
  ctx.fillStyle = palette.speck;
  for (let i = 0; i < 1200; i++) {
    const px = fx + ((i * 97 + 23) % fw);
    const py = fy + ((i * 151 + 47) % fh);
    ctx.globalAlpha = pitchType === "ice" ? 0.25 : 0.14;
    if (pitchType === "ice" && i % 5 === 0) {
      ctx.fillRect(px, py, 4, 1);
    } else if (pitchType === "sand" && i % 4 === 0) {
      ctx.fillRect(px, py, 2, 1);
    } else {
      ctx.fillRect(px, py, 1, 1);
    }
  }
  ctx.globalAlpha = 1;

  // Crisp 32x32 tactical cell grid
  ctx.fillStyle = palette.line;
  ctx.globalAlpha = 0.09;
  for (let c = 1; c < PITCH_COLS; c++) {
    ctx.fillRect(Math.round(fx + c * colW), fy, 1, fh);
  }
  for (let r = 1; r < PITCH_ROWS; r++) {
    ctx.fillRect(fx, Math.round(fy + r * rowH), fw, 1);
  }

  // Grid intersection dots for instant cell readability
  ctx.globalAlpha = 0.22;
  for (let c = 1; c < PITCH_COLS; c++) {
    for (let r = 1; r < PITCH_ROWS; r++) {
      ctx.fillRect(Math.round(fx + c * colW), Math.round(fy + r * rowH), 1, 1);
    }
  }
  ctx.globalAlpha = 1;

  // Chalk outer touchlines & goal lines
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(fx + 0.5, fy + 0.5, fw - 1, fh - 1);

  // Corner quarter-circle arcs
  const cornerR = Math.round(colW * 1.1);
  const drawArc = (cx: number, cy: number, start: number, end: number) => {
    ctx.beginPath();
    ctx.arc(cx, cy, cornerR, start, end);
    ctx.stroke();
  };
  drawArc(fx, fy, 0, Math.PI / 2);
  drawArc(fx + fw, fy, Math.PI / 2, Math.PI);
  drawArc(fx + fw, fy + fh, Math.PI, Math.PI * 1.5);
  drawArc(fx, fy + fh, Math.PI * 1.5, Math.PI * 2);

  // Halfway line & Center Circle
  const midX = Math.round(fx + fw / 2);
  const midY = Math.round(fy + fh / 2);
  ctx.fillStyle = palette.line;
  ctx.fillRect(midX, fy, 1, fh);
  ctx.beginPath();
  ctx.arc(midX, midY, Math.round(rowH * 4.2), 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillRect(midX - 2, midY - 2, 4, 4);

  // Penalty Boxes (6 cols x 16 rows: rows 8..23) & 6-yard Goal Boxes (2 cols x 10 rows: rows 11..20)
  const penTop = Math.round(fy + rowH * 8);
  const penH = Math.round(rowH * 16);
  const penW = Math.round(colW * 6);
  const boxTop = Math.round(fy + rowH * 11);
  const boxH = Math.round(rowH * 10);
  const boxW = Math.round(colW * 2);

  // Left boxes + penalty spot + arc
  ctx.strokeRect(fx + 0.5, penTop + 0.5, penW, penH);
  ctx.strokeRect(fx + 0.5, boxTop + 0.5, boxW, boxH);
  const leftSpotX = Math.round(fx + colW * 4.2);
  ctx.fillRect(leftSpotX - 1, midY - 1, 3, 3);
  ctx.beginPath();
  ctx.arc(leftSpotX, midY, Math.round(rowH * 3.1), -0.78, 0.78);
  ctx.stroke();

  // Right boxes + penalty spot + arc
  ctx.strokeRect(Math.round(fx + fw - penW) - 0.5, penTop + 0.5, penW, penH);
  ctx.strokeRect(Math.round(fx + fw - boxW) - 0.5, boxTop + 0.5, boxW, boxH);
  const rightSpotX = Math.round(fx + fw - colW * 4.2);
  ctx.fillRect(rightSpotX - 1, midY - 1, 3, 3);
  ctx.beginPath();
  ctx.arc(rightSpotX, midY, Math.round(rowH * 3.1), Math.PI - 0.78, Math.PI + 0.78);
  ctx.stroke();

  // Pixel Goal Nets (Left & Right spanning GOAL_ROWS = 13..18)
  const netW = Math.floor(GOAL_DEPTH / scale);
  const firstGoalRow = GOAL_ROWS[0];
  const netTop = Math.round(fy + rowH * firstGoalRow);
  const netH = Math.round(rowH * GOAL_ROWS.length);

  const drawGoalNet = (nx: number, isLeft: boolean) => {
    ctx.fillStyle = "rgba(8, 13, 24, 0.68)";
    ctx.fillRect(nx, netTop, netW, netH);

    // Diamond/square net mesh
    ctx.fillStyle = "rgba(241, 245, 249, 0.25)";
    for (let x = nx; x < nx + netW; x += 4) {
      ctx.fillRect(x, netTop, 1, netH);
    }
    for (let y = netTop; y < netTop + netH; y += 4) {
      ctx.fillRect(nx, y, netW, 1);
    }

    // Thick white goal frame & posts
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(nx, netTop, netW, 2);
    ctx.fillRect(nx, netTop + netH - 2, netW, 2);
    ctx.fillRect(isLeft ? nx : nx + netW - 2, netTop, 2, netH);
    // Goalposts on goal line
    const postX = isLeft ? nx + netW - 2 : nx;
    ctx.fillRect(postX, netTop - 1, 3, 3);
    ctx.fillRect(postX, netTop + netH - 2, 3, 3);
  };

  drawGoalNet(fx - netW, true);
  drawGoalNet(fx + fw, false);

  return toNearestTexture(canvas);
}

export function createConeTexture(): PIXI.Texture {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(2, 12, 12, 3);
  ctx.fillStyle = "#9a3412";
  ctx.fillRect(3, 11, 10, 2);
  ctx.fillStyle = "#f97316";
  ctx.fillRect(4, 9, 8, 2);
  ctx.fillRect(5, 5, 6, 4);
  ctx.fillRect(6, 2, 4, 3);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(5, 7, 6, 2);
  ctx.fillStyle = "#fdba74";
  ctx.fillRect(6, 3, 1, 4);
  return toNearestTexture(c);
}

export function createBallAnimationFrames(): PIXI.Texture[] {
  const frames: PIXI.Texture[] = [];
  for (let f = 0; f < 4; f++) {
    const c = document.createElement("canvas");
    c.width = 14;
    c.height = 14;
    const ctx = c.getContext("2d")!;

    // Shadow underneath
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(3, 11, 8, 2);

    // Outline
    ctx.fillStyle = "#090d16";
    ctx.fillRect(4, 1, 6, 11);
    ctx.fillRect(2, 2, 10, 9);
    ctx.fillRect(1, 4, 12, 5);

    // Leather white sphere + bottom shading
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(4, 2, 6, 9);
    ctx.fillRect(2, 4, 10, 5);
    ctx.fillRect(3, 3, 8, 7);
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(3, 9, 8, 2);

    // Rotating pentagon patches
    ctx.fillStyle = "#0f172a";
    const shift = (f % 4) - 1;
    ctx.fillRect(5 + shift, 5, 3, 3);
    ctx.fillRect(5 - shift, 2, 2, 1);
    ctx.fillRect(6 + (f % 2), 10, 2, 1);
    if (f % 2 === 0) {
      ctx.fillRect(2, 6, 1, 2);
    } else {
      ctx.fillRect(11, 6, 1, 2);
    }

    frames.push(toNearestTexture(c));
  }
  return frames;
}

export function createCornerFlagFrames(color = "#ef4444"): PIXI.Texture[] {
  const frames: PIXI.Texture[] = [];
  for (let f = 0; f < 3; f++) {
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 18;
    const ctx = c.getContext("2d")!;

    // Ground shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(2, 15, 6, 2);
    // Pole
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(3, 2, 2, 14);
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(4, 2, 1, 14);

    // Fluttering cloth
    ctx.fillStyle = color;
    if (f === 0) {
      ctx.fillRect(5, 2, 8, 3);
      ctx.fillRect(5, 5, 6, 2);
      ctx.fillStyle = "#fde047";
      ctx.fillRect(5, 4, 4, 1);
    } else if (f === 1) {
      ctx.fillRect(5, 2, 6, 2);
      ctx.fillRect(7, 4, 6, 2);
      ctx.fillRect(5, 5, 4, 2);
      ctx.fillStyle = "#fde047";
      ctx.fillRect(6, 3, 4, 1);
    } else {
      ctx.fillRect(5, 3, 8, 3);
      ctx.fillRect(5, 2, 5, 2);
      ctx.fillStyle = "#fde047";
      ctx.fillRect(5, 5, 5, 1);
    }

    frames.push(toNearestTexture(c));
  }
  return frames;
}

function darkenHex(hex: string, factor = 0.72): string {
  const clean = hex.replace("#", "");
  const r = Math.max(0, Math.floor(parseInt(clean.slice(0, 2), 16) * factor));
  const g = Math.max(0, Math.floor(parseInt(clean.slice(2, 4), 16) * factor));
  const b = Math.max(0, Math.floor(parseInt(clean.slice(4, 6), 16) * factor));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b
    .toString(16)
    .padStart(2, "0")}`;
}

function lightenHex(hex: string, add = 42): string {
  const clean = hex.replace("#", "");
  const r = Math.min(255, parseInt(clean.slice(0, 2), 16) + add);
  const g = Math.min(255, parseInt(clean.slice(2, 4), 16) + add);
  const b = Math.min(255, parseInt(clean.slice(4, 6), 16) + add);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b
    .toString(16)
    .padStart(2, "0")}`;
}

function drawFootballerFrame(
  role: PlayerRole,
  team: Team,
  skinTone: number,
  appearance: RoleAppearance | undefined,
  pose: "idle0" | "idle1" | "run0" | "run1" | "run2" | "run3"
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 24;
  c.height = 28;
  const ctx = c.getContext("2d")!;

  const skin = SKIN_PALETTES[Math.abs(skinTone) % SKIN_PALETTES.length];
  const isGK = role === "GK";

  // Distinct goalkeeper kit vs outfield team kit
  const baseJersey =
    team === "red"
      ? isGK
        ? "#9333ea"
        : "#dc2626"
      : isGK
      ? "#eab308"
      : appearance
      ? JERSEY_THEME_STYLES[appearance.jerseyTheme].swatch
      : "#2563eb";

  const jerseyDark = darkenHex(baseJersey, 0.7);
  const jerseyLight = lightenHex(baseJersey, 42);
  const shortsCol =
    team === "red" ? (isGK ? "#1e1b4b" : "#111827") : isGK ? "#0f172a" : "#f8fafc";
  const shortsShade = darkenHex(shortsCol, 0.78);
  const sockCol = baseJersey;
  const pattern: JerseyPattern =
    team === "blue" && appearance ? appearance.jerseyPattern : "solid";
  const hair: HairStyle =
    team === "blue" && appearance ? appearance.hairStyle : isGK ? "classic" : "classic";

  // Vertical bounce & stride offsets per frame
  const bodyBounceY =
    pose === "idle1" ? 1 : pose === "run0" || pose === "run2" ? -1 : 0;

  let leftLegDX = 0;
  let leftLegDY = 0;
  let rightLegDX = 0;
  let rightLegDY = 0;
  let leftArmDY = 0;
  let rightArmDY = 0;

  if (pose === "run0") {
    leftLegDX = -2;
    leftLegDY = -1;
    rightLegDX = 2;
    rightLegDY = 1;
    leftArmDY = 1;
    rightArmDY = -2;
  } else if (pose === "run1") {
    leftLegDX = 0;
    leftLegDY = 0;
    rightLegDX = 0;
    rightLegDY = 0;
    leftArmDY = 0;
    rightArmDY = 0;
  } else if (pose === "run2") {
    leftLegDX = 2;
    leftLegDY = 1;
    rightLegDX = -2;
    rightLegDY = -1;
    leftArmDY = -2;
    rightArmDY = 1;
  } else if (pose === "run3") {
    leftLegDX = 0;
    leftLegDY = 0;
    rightLegDX = 0;
    rightLegDY = 0;
    leftArmDY = 0;
    rightArmDY = 0;
  }

  // Ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(6, 24, 12, 3);
  ctx.fillRect(5, 25, 14, 1);

  // ---- LEGS, SOCKS & CLEATS ----
  const drawLeg = (lx: number, ly: number) => {
    // Upper leg skin
    ctx.fillStyle = skin.shade;
    ctx.fillRect(lx, ly, 3, 2);
    // Sock + white cuff
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(lx, ly + 2, 3, 1);
    ctx.fillStyle = sockCol;
    ctx.fillRect(lx, ly + 3, 3, 2);
    // Black boot + white cleat highlight
    ctx.fillStyle = "#090d16";
    ctx.fillRect(lx - 1, ly + 5, 4, 2);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(lx, ly + 5, 1, 1);
  };

  drawLeg(8 + leftLegDX, 19 + leftLegDY);
  drawLeg(13 + rightLegDX, 19 + rightLegDY);

  // ---- SHORTS ----
  const sy = 15 + bodyBounceY;
  ctx.fillStyle = "#090d16";
  ctx.fillRect(7, sy, 10, 5);
  ctx.fillStyle = shortsCol;
  ctx.fillRect(8, sy, 8, 4);
  ctx.fillStyle = shortsShade;
  ctx.fillRect(11, sy + 2, 2, 2);

  // ---- ARMS & HANDS (or GK GLOVES) ----
  const ay = 9 + bodyBounceY;
  const drawArm = (ax: number, dy: number) => {
    // Sleeve
    ctx.fillStyle = "#090d16";
    ctx.fillRect(ax, ay + dy, 3, 4);
    ctx.fillStyle = baseJersey;
    ctx.fillRect(ax, ay + dy + 1, 2, 2);
    // Forearm skin
    ctx.fillStyle = isGK ? baseJersey : skin.base;
    ctx.fillRect(ax, ay + dy + 3, 2, 2);
    // Hand / GK Glove
    ctx.fillStyle = isGK ? "#4ade80" : skin.shade;
    ctx.fillRect(ax, ay + dy + 5, 2, 2);
  };

  drawArm(4, leftArmDY);
  drawArm(18, rightArmDY);

  // ---- TORSO / JERSEY ----
  const ty = 8 + bodyBounceY;
  // Dark crisp silhouette outline
  ctx.fillStyle = "#090d16";
  ctx.fillRect(6, ty, 12, 8);
  ctx.fillRect(5, ty + 1, 14, 5);

  // Main jersey fill
  ctx.fillStyle = baseJersey;
  ctx.fillRect(7, ty + 1, 10, 6);
  ctx.fillRect(6, ty + 1, 12, 4);

  // Top shoulder highlight & bottom shadow
  ctx.fillStyle = jerseyLight;
  ctx.fillRect(7, ty + 1, 10, 1);
  ctx.fillStyle = jerseyDark;
  ctx.fillRect(7, ty + 6, 10, 1);

  // Pattern overlay
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  if (pattern === "stripes") {
    ctx.fillRect(8, ty + 1, 2, 6);
    ctx.fillRect(14, ty + 1, 2, 6);
  } else if (pattern === "sash") {
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(7 + i, ty + 1 + i, 2, 1);
    }
  }

  // Collar / Neck
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(10, ty + 1, 4, 1);
  ctx.fillStyle = skin.shade;
  ctx.fillRect(11, ty, 2, 1);

  // Subtle chest crest dot on left chest
  ctx.fillStyle = "#fde047";
  ctx.fillRect(14, ty + 2, 1, 1);

  // ---- HEAD, FACE & HAIR / HEADGEAR ----
  const hy = 2 + bodyBounceY;
  // Head outline
  ctx.fillStyle = "#090d16";
  ctx.fillRect(8, hy, 8, 7);
  ctx.fillRect(7, hy + 1, 10, 5);

  // Face skin
  ctx.fillStyle = skin.base;
  ctx.fillRect(9, hy + 2, 6, 4);
  ctx.fillRect(8, hy + 2, 8, 3);
  ctx.fillStyle = skin.shade;
  ctx.fillRect(9, hy + 5, 6, 1);

  // Expressive pixel eyes
  ctx.fillStyle = "#090d16";
  ctx.fillRect(10, hy + 3, 1, 1);
  ctx.fillRect(13, hy + 3, 1, 1);

  // Hair / Headgear styling
  if (hair === "mohawk") {
    ctx.fillStyle = skin.hair;
    ctx.fillRect(9, hy + 1, 6, 1);
    ctx.fillStyle = "#fde047";
    ctx.fillRect(11, hy - 2, 2, 4);
    ctx.fillRect(10, hy, 4, 2);
  } else if (hair === "curly") {
    ctx.fillStyle = skin.hair;
    ctx.fillRect(7, hy - 1, 10, 3);
    ctx.fillRect(8, hy - 2, 8, 2);
    ctx.fillStyle = lightenHex(skin.hair, 28);
    ctx.fillRect(9, hy, 1, 1);
    ctx.fillRect(14, hy, 1, 1);
  } else if (hair === "headband") {
    ctx.fillStyle = skin.hair;
    ctx.fillRect(8, hy, 8, 2);
    ctx.fillStyle = "#f43f5e";
    ctx.fillRect(8, hy + 2, 8, 1);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(10, hy + 2, 2, 1);
  } else if (hair === "helmet") {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(8, hy, 8, 3);
    ctx.fillRect(7, hy + 1, 10, 3);
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(9, hy + 2, 6, 1);
  } else {
    // Classic natural sports haircut
    ctx.fillStyle = skin.hair;
    ctx.fillRect(8, hy, 8, 2);
    ctx.fillRect(8, hy + 1, 2, 2);
    ctx.fillRect(14, hy + 1, 2, 2);
  }

  return c;
}

export interface PlayerAnimationFrames {
  idle: PIXI.Texture[];
  run: PIXI.Texture[];
}

export function createPlayerAnimationFrames(
  role: PlayerRole,
  team: Team,
  skinTone: number,
  appearance?: RoleAppearance
): PlayerAnimationFrames {
  return {
    idle: [
      toNearestTexture(drawFootballerFrame(role, team, skinTone, appearance, "idle0")),
      toNearestTexture(drawFootballerFrame(role, team, skinTone, appearance, "idle1")),
    ],
    run: [
      toNearestTexture(drawFootballerFrame(role, team, skinTone, appearance, "run0")),
      toNearestTexture(drawFootballerFrame(role, team, skinTone, appearance, "run1")),
      toNearestTexture(drawFootballerFrame(role, team, skinTone, appearance, "run2")),
      toNearestTexture(drawFootballerFrame(role, team, skinTone, appearance, "run3")),
    ],
  };
}

export function drawPlayerPreviewToCanvas(
  canvas: HTMLCanvasElement,
  role: PlayerRole,
  team: Team,
  skinTone: number,
  appearance?: RoleAppearance
) {
  const frame = drawFootballerFrame(role, team, skinTone, appearance, "idle0");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
}
