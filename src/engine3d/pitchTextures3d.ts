import * as THREE from "three";
import {
  GOAL_ROWS,
  JERSEY_THEME_STYLES,
  JerseyPattern,
  PITCH_COLS,
  PITCH_ROWS,
  PitchType,
  PlayerRole,
  ROLE_META,
  RoleAppearance,
  Team,
} from "../types/game";

function makeTex(
  canvas: HTMLCanvasElement,
  anisotropy = 4,
  isColor = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

// Deterministic fast hash for procedural grass/sand/ice micro-grain
function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function createPitchAlbedoTexture(
  pitchType: PitchType,
  anisotropy = 4
): THREE.CanvasTexture {
  const size = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const px = (col: number) => (col / PITCH_COLS) * size;
  const py = (row: number) => (row / PITCH_ROWS) * size;
  const cellW = size / PITCH_COLS;
  const cellH = size / PITCH_ROWS;

  // 1. Alternating Broadcast Mower Bands (rich 2-column & subtle 1-column tonal rhythm)
  for (let c = 0; c < PITCH_COLS; c++) {
    const band = Math.floor(c / 2) % 2 === 0;
    const sub = c % 2 === 0;
    if (pitchType === "ice") {
      ctx.fillStyle = band ? (sub ? "#9fd8f5" : "#a8ddf7") : sub ? "#bce8fb" : "#c6edfd";
    } else if (pitchType === "sand") {
      ctx.fillStyle = band ? (sub ? "#dcb366" : "#e1b96d") : sub ? "#ebc67d" : "#efcb85";
    } else if (pitchType === "obstacles") {
      ctx.fillStyle = band ? (sub ? "#196f36" : "#1c783b") : sub ? "#248c46" : "#29954c";
    } else {
      ctx.fillStyle = band ? (sub ? "#187037" : "#1b783c") : sub ? "#248f47" : "#28974d";
    }
    ctx.fillRect(px(c), 0, cellW + 1, size);
  }

  // 2. Subtle Cross-Cut Mower Sheen (2-row alternating light/dark overlay)
  for (let r = 0; r < PITCH_ROWS; r++) {
    if (Math.floor(r / 2) % 2 === 0) {
      ctx.fillStyle =
        pitchType === "ice"
          ? "rgba(255,255,255,0.04)"
          : pitchType === "sand"
          ? "rgba(155,95,22,0.04)"
          : "rgba(255,255,255,0.032)";
      ctx.fillRect(0, py(r), size, cellH + 1);
    }
  }

  // 3. Rich Organic Grass Blades / Sand Ripples / Ice Rink Creases & Scratches
  if (pitchType === "ice") {
    ctx.fillStyle = "rgba(56, 189, 248, 0.24)";
    ctx.fillRect(0, py(11), px(3.4), py(10));
    ctx.fillRect(size - px(3.4), py(11), px(3.4), py(10));

    // Blue-line / red-line rink accents
    ctx.fillStyle = "rgba(220, 38, 38, 0.28)";
    ctx.fillRect(size * 0.5 - 6, 8, 12, size - 16);
    ctx.fillStyle = "rgba(37, 99, 235, 0.22)";
    ctx.fillRect(px(10.5) - 5, 8, 10, size - 16);
    ctx.fillRect(size - px(10.5) - 5, 8, 10, size - 16);

    ctx.strokeStyle = "rgba(255,255,255,0.52)";
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 95; i++) {
      const sx = hash2(i, 1) * (size - 160) + 80;
      const sy = hash2(i, 2) * (size - 160) + 80;
      const len = 36 + hash2(i, 3) * 110;
      const ang = (hash2(i, 4) - 0.5) * 1.1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
      ctx.stroke();
    }
  } else if (pitchType === "sand") {
    for (let i = 0; i < 2400; i++) {
      const sx = hash2(i, 7) * size;
      const sy = hash2(i, 9) * size;
      ctx.fillStyle =
        i % 3 === 0 ? "rgba(120, 68, 20, 0.09)" : "rgba(255, 248, 225, 0.095)";
      ctx.fillRect(sx, sy, 7 + (i % 6), 2.2);
    }
  } else {
    // 6,000 realistic grass micro-tufts + subtle clover/chlorophyll speckles
    for (let i = 0; i < 6000; i++) {
      const gx = hash2(i, 11) * size;
      const gy = hash2(i, 17) * size;
      const w = 1.8 + Math.floor(hash2(i, 23) * 2.5);
      const h = 4 + Math.floor(hash2(i, 29) * 6);
      ctx.fillStyle =
        i % 3 === 0
          ? "rgba(8, 48, 20, 0.16)"
          : i % 3 === 1
          ? "rgba(134, 239, 172, 0.08)"
          : "rgba(34, 197, 94, 0.065)";
      ctx.fillRect(gx, gy, w, h);
    }

    // High-traffic turf wear & subtle divots around Goalmouths, Penalty Spots & Center Spot
    const drawWearZone = (cx: number, cy: number, rx: number, ry: number, alpha: number) => {
      const grad = ctx.createRadialGradient(cx, cy, rx * 0.12, cx, cy, Math.max(rx, ry));
      grad.addColorStop(0, `rgba(125, 90, 44, ${alpha})`);
      grad.addColorStop(0.55, `rgba(105, 82, 42, ${alpha * 0.55})`);
      grad.addColorStop(1, "rgba(105, 82, 42, 0)");
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
      ctx.translate(-cx, -cy);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(rx, ry), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    drawWearZone(px(1.25), size / 2, cellW * 2.2, cellH * 4.5, 0.34);
    drawWearZone(size - px(1.25), size / 2, cellW * 2.2, cellH * 4.5, 0.34);
    drawWearZone(px(4.2), size / 2, cellW * 1.15, cellH * 1.25, 0.22);
    drawWearZone(size - px(4.2), size / 2, cellW * 1.15, cellH * 1.25, 0.22);
    drawWearZone(size / 2, size / 2, cellW * 1.85, cellH * 1.85, 0.16);
  }

  // 4. Subtle Tactical Grid Lines (low-contrast so pitch turf looks organic & readable)
  ctx.strokeStyle =
    pitchType === "ice"
      ? "rgba(14, 116, 144, 0.12)"
      : pitchType === "sand"
      ? "rgba(120, 53, 15, 0.11)"
      : "rgba(255, 255, 255, 0.055)";
  ctx.lineWidth = 1.5;
  for (let i = 1; i < PITCH_COLS; i++) {
    const p = px(i);
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
  }
  for (let i = 1; i < PITCH_ROWS; i++) {
    const p = py(i);
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  // 5. Regulation FIFA Chalk Pitch Markings with crisp edge bleed
  const lineCol =
    pitchType === "ice"
      ? "rgba(255,255,255,0.95)"
      : pitchType === "sand"
      ? "rgba(255,251,235,0.92)"
      : "rgba(248,250,252,0.95)";
  ctx.strokeStyle = lineCol;
  ctx.fillStyle = lineCol;
  ctx.lineWidth = 10;

  ctx.strokeRect(8, 8, size - 16, size - 16);

  // Halfway line
  ctx.beginPath();
  ctx.moveTo(size / 2, 8);
  ctx.lineTo(size / 2, size - 8);
  ctx.stroke();

  // Center circle + center spot
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, cellW * 3.85, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 14, 0, Math.PI * 2);
  ctx.fill();

  // Penalty Boxes, 6-yard Boxes, Penalty Spots & D-Arcs
  ctx.strokeRect(8, py(8), px(6), py(16));
  ctx.strokeRect(8, py(12), px(2.3), py(8));
  ctx.beginPath();
  ctx.arc(px(4.2), size / 2, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px(4.2), size / 2, cellW * 2.9, -0.68, 0.68);
  ctx.stroke();

  ctx.strokeRect(size - px(6) - 8, py(8), px(6), py(16));
  ctx.strokeRect(size - px(2.3) - 8, py(12), px(2.3), py(8));
  ctx.beginPath();
  ctx.arc(size - px(4.2), size / 2, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(size - px(4.2), size / 2, cellW * 2.9, Math.PI - 0.68, Math.PI + 0.68);
  ctx.stroke();

  // Corner Arcs & 9.15m Alignment Ticks
  const arcR = cellW * 0.85;
  ctx.beginPath();
  ctx.arc(8, 8, arcR, 0, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size - 8, 8, arcR, Math.PI / 2, Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size - 8, size - 8, arcR, Math.PI, Math.PI * 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(8, size - 8, arcR, Math.PI * 1.5, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 7;
  const tickDist = cellW * 3.1;
  for (const [tx, ty] of [
    [tickDist, 0],
    [size - tickDist, 0],
    [tickDist, size],
    [size - tickDist, size],
    [0, tickDist],
    [0, size - tickDist],
    [size, tickDist],
    [size, size - tickDist],
  ]) {
    ctx.beginPath();
    if (ty === 0 || ty === size) {
      ctx.moveTo(tx, ty === 0 ? 8 : size - 26);
      ctx.lineTo(tx, ty === 0 ? 26 : size - 8);
    } else {
      ctx.moveTo(tx === 0 ? 8 : size - 26, ty);
      ctx.lineTo(tx === 0 ? 26 : size - 8, ty);
    }
    ctx.stroke();
  }

  // Subtle floodlight radial sheen + stadium vignette edge
  const vignette = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.22,
    size * 0.5,
    size * 0.5,
    size * 0.72
  );
  vignette.addColorStop(0, "rgba(255,255,255,0.03)");
  vignette.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);

  // Goalmouth color accent zones (Blue home vs Red away goal line glow)
  const gTop = py(GOAL_ROWS[0]);
  const gHeight = py(GOAL_ROWS.length);
  ctx.fillStyle = "rgba(59, 130, 246, 0.16)";
  ctx.fillRect(0, gTop, cellW * 0.45, gHeight);
  ctx.fillStyle = "rgba(239, 68, 68, 0.16)";
  ctx.fillRect(size - cellW * 0.45, gTop, cellW * 0.45, gHeight);

  return makeTex(canvas, anisotropy, true);
}

// Linear-space Roughness Map: authentic TV broadcast mower nap sheen + glossy ice streaks
export function createPitchRoughnessTexture(
  pitchType: PitchType,
  anisotropy = 4
): THREE.CanvasTexture {
  const size = 1024;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;

  const px = (col: number) => (col / PITCH_COLS) * size;
  const cellW = size / PITCH_COLS;

  if (pitchType === "ice") {
    ctx.fillStyle = "rgb(42, 42, 42)"; // smooth specular ice (~0.16 roughness)
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "rgb(115, 115, 115)"; // rougher skate-carved scratches
    ctx.lineWidth = 2;
    for (let i = 0; i < 120; i++) {
      const sx = hash2(i, 81) * size;
      const sy = hash2(i, 83) * size;
      const ang = (hash2(i, 87) - 0.5) * 1.4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(ang) * 70, sy + Math.sin(ang) * 70);
      ctx.stroke();
    }
  } else if (pitchType === "sand") {
    ctx.fillStyle = "rgb(238, 238, 238)";
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 2000; i++) {
      const x = hash2(i, 91) * size;
      const y = hash2(i, 93) * size;
      const lum = Math.floor(215 + hash2(i, 97) * 38);
      ctx.fillStyle = `rgb(${lum},${lum},${lum})`;
      ctx.fillRect(x, y, 4, 2);
    }
  } else {
    // Alternating mower nap roughness bands (dew catches stadium lights differently!)
    for (let cCol = 0; cCol < PITCH_COLS; cCol++) {
      const band = Math.floor(cCol / 2) % 2 === 0;
      const lum = band ? 216 : 178; // 0.85 vs 0.70 roughness
      ctx.fillStyle = `rgb(${lum},${lum},${lum})`;
      ctx.fillRect(px(cCol), 0, cellW + 1, size);
    }

    // Worn dirt patches at goalmouths have higher matte roughness (~0.94)
    for (const cx of [px(1.25), size - px(1.25)]) {
      const grad = ctx.createRadialGradient(cx, size / 2, 10, cx, size / 2, cellW * 3.5);
      grad.addColorStop(0, "rgb(242,242,242)");
      grad.addColorStop(1, "rgba(242,242,242,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, size / 2, cellW * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return makeTex(c, anisotropy, false);
}

// Linear-space Bump Map for turf/sand/ice micro-relief under floodlights
export function createPitchBumpTexture(
  pitchType: PitchType,
  anisotropy = 4
): THREE.CanvasTexture {
  const size = 1024;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);

  if (pitchType === "ice") {
    ctx.strokeStyle = "#b8b8b8";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 65; i++) {
      const sx = hash2(i, 31) * size;
      const sy = hash2(i, 37) * size;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 48, sy + (hash2(i, 41) - 0.5) * 32);
      ctx.stroke();
    }
  } else {
    const count = pitchType === "sand" ? 5500 : 8500;
    for (let i = 0; i < count; i++) {
      const x = hash2(i, 43) * size;
      const y = hash2(i, 47) * size;
      const lum = Math.floor(88 + hash2(i, 53) * 135);
      ctx.fillStyle = `rgb(${lum},${lum},${lum})`;
      ctx.fillRect(x, y, pitchType === "sand" ? 3.5 : 1.8, pitchType === "sand" ? 1.8 : 4);
    }
  }

  const tex = makeTex(c, anisotropy, false);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

// Woven Athletic Mesh Bump Map for Player Jerseys
export function createJerseyBumpTexture(anisotropy = 4): THREE.CanvasTexture {
  const w = 256;
  const h = 128;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, w, h);

  // Breathable mesh knit dimples
  for (let y = 0; y < h; y += 4) {
    for (let x = (y % 8 === 0 ? 0 : 2); x < w; x += 4) {
      ctx.fillStyle = "#5c5c5c";
      ctx.fillRect(x, y, 2, 2);
      ctx.fillStyle = "#9c9c9c";
      ctx.fillRect(x + 1, y + 1, 1, 1);
    }
  }

  // Subtle vertical jersey fold creases
  for (let i = 0; i < 6; i++) {
    const fx = (i / 6) * w + 18;
    const grad = ctx.createLinearGradient(fx - 10, 0, fx + 10, 0);
    grad.addColorStop(0, "rgba(128,128,128,0)");
    grad.addColorStop(0.5, "rgba(185,185,185,0.45)");
    grad.addColorStop(1, "rgba(128,128,128,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(fx - 10, 16, 20, h - 24);
  }

  return makeTex(c, anisotropy, false);
}

// Running Track Texture with authentic painted track lanes & white edge curbs
export function createTrackSurfaceTexture(anisotropy = 4): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = "#913318";
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 2800; i++) {
    const x = hash2(i, 61) * size;
    const y = hash2(i, 67) * size;
    ctx.fillStyle = i % 2 === 0 ? "rgba(0,0,0,0.16)" : "rgba(255,210,180,0.09)";
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.strokeStyle = "rgba(248, 250, 252, 0.78)";
  ctx.lineWidth = 3;
  for (const inset of [10, 24, 38, 52]) {
    ctx.strokeRect(inset, inset, size - inset * 2, size - inset * 2);
  }

  return makeTex(c, anisotropy, true);
}

// Crisp Hex/Square Diamond Twine Texture for Realistic Football Goal Nets
export function createGoalNetTexture(anisotropy = 4): THREE.CanvasTexture {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;

  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(248, 250, 252, 0.94)";
  ctx.lineWidth = 4;

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size, size);
  ctx.moveTo(size, 0);
  ctx.lineTo(0, size);
  ctx.stroke();

  ctx.strokeStyle = "rgba(226, 232, 240, 0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, size, size);

  const tex = makeTex(c, anisotropy, true);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Soft Radial Ground Contact Shadow Texture
export function createSoftShadowTexture(): THREE.CanvasTexture {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;

  const grad = ctx.createRadialGradient(size / 2, size / 2, 3, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(4, 8, 16, 0.72)");
  grad.addColorStop(0.55, "rgba(4, 8, 16, 0.36)");
  grad.addColorStop(1, "rgba(4, 8, 16, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Floodlight Volumetric Lens Glow Sprite Texture
export function createFloodlightFlareTexture(): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;

  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255, 252, 235, 0.95)");
  grad.addColorStop(0.22, "rgba(254, 240, 138, 0.48)");
  grad.addColorStop(0.55, "rgba(186, 230, 253, 0.14)");
  grad.addColorStop(1, "rgba(186, 230, 253, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createJerseyTexture(
  team: Team,
  role: PlayerRole,
  number: number,
  appearance?: RoleAppearance,
  anisotropy = 4
): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;

  const isGK = role === "GK";
  let baseColor = team === "blue" ? "#2563eb" : "#dc2626";
  if (team === "blue" && appearance?.jerseyTheme) {
    baseColor = JERSEY_THEME_STYLES[appearance.jerseyTheme].swatch;
  }
  if (isGK) {
    baseColor = team === "blue" ? "#eab308" : "#059669";
  }

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, w, h);

  // Subtle breathable mesh micro-dots across fabric
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  for (let y = 8; y < h; y += 8) {
    for (let x = y % 16 === 0 ? 4 : 8; x < w; x += 8) {
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // Torso muscle / lighting shading gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(255,255,255,0.2)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.02)");
  grad.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const pattern: JerseyPattern = appearance?.jerseyPattern ?? "solid";
  ctx.fillStyle = "rgba(255,255,255,0.34)";
  if (pattern === "stripes") {
    for (let x = 22; x < w; x += 68) {
      ctx.fillRect(x, 0, 26, h);
    }
  } else if (pattern === "sash") {
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(w * 0.3, h);
    ctx.lineTo(w * 0.78, 0);
    ctx.lineTo(w * 0.48, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    // Side ventilation panels & 3 shoulder stripes
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(0, 20, 18, h - 34);
    ctx.fillRect(w * 0.5 - 9, 20, 18, h - 34);
    ctx.fillRect(w - 18, 20, 18, h - 34);

    ctx.fillStyle = "rgba(255,255,255,0.46)";
    for (const sx of [w * 0.14, w * 0.36, w * 0.62, w * 0.86]) {
      ctx.fillRect(sx - 12, 0, 6, 36);
      ctx.fillRect(sx, 0, 6, 36);
      ctx.fillRect(sx + 12, 0, 6, 36);
    }
  }

  // Layered V-neck Collar & Waist Hem Trim
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, w, 20);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 20, w, 5);
  ctx.fillStyle = "rgba(0,0,0,0.26)";
  ctx.fillRect(0, h - 16, w, 16);

  // V-neck collar notch centered at w * 0.25 (mapped cleanly onto chest +Z when torso.rotation.y = -PI/2)
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.moveTo(w * 0.21, 0);
  ctx.lineTo(w * 0.25, 38);
  ctx.lineTo(w * 0.29, 0);
  ctx.closePath();
  ctx.fill();

  // Golden Club Shield Crest on Left Chest
  ctx.fillStyle = "#fde047";
  ctx.beginPath();
  ctx.arc(w * 0.33, h * 0.3, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = team === "blue" ? "#1d4ed8" : "#b91c1c";
  ctx.beginPath();
  ctx.arc(w * 0.33, h * 0.3, 8, 0, Math.PI * 2);
  ctx.fill();

  // Crisp Sponsor Accent Bar on Front Chest
  ctx.fillStyle = "rgba(15, 23, 42, 0.58)";
  ctx.fillRect(w * 0.14, h * 0.64, w * 0.22, 22);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "900 13px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("BLITZ·95", w * 0.25, h * 0.64 + 11);

  // Crisp Front Chest Number & Bold Back Number + Role Code
  const numColor = isGK && team === "blue" ? "#0f172a" : "#ffffff";
  ctx.fillStyle = numColor;
  ctx.strokeStyle = "rgba(0,0,0,0.72)";
  ctx.lineWidth = 8;

  const numStr = String(number);
  ctx.font = "900 44px 'IBM Plex Mono', monospace";
  ctx.strokeText(numStr, w * 0.19, h * 0.35);
  ctx.fillText(numStr, w * 0.19, h * 0.35);

  const roleTag = ROLE_META[role]?.code ?? role;
  ctx.font = "900 22px 'IBM Plex Mono', monospace";
  ctx.strokeText(roleTag, w * 0.75, h * 0.25);
  ctx.fillText(roleTag, w * 0.75, h * 0.25);

  ctx.font = "900 96px 'IBM Plex Mono', monospace";
  ctx.strokeText(numStr, w * 0.75, h * 0.58);
  ctx.fillText(numStr, w * 0.75, h * 0.58);

  return makeTex(c, anisotropy, true);
}

export function createSoccerBallTexture(anisotropy = 4): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, size, size);

  const drawPentagon = (cx: number, cy: number, r: number) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = "#0f172a";
    ctx.fill();
  };

  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 2.5;
  const rows = [32, 96, 160, 224];
  const cols = [32, 96, 160, 224];
  for (let ri = 0; ri < rows.length; ri++) {
    for (let ci = 0; ci < cols.length; ci++) {
      const cx = cols[ci] + (ri % 2 === 0 ? 0 : 28);
      const cy = rows[ri];
      if ((ri + ci) % 2 === 0) {
        drawPentagon(cx % size, cy, 19);
      } else {
        ctx.beginPath();
        ctx.arc(cx % size, cy, 20, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  return makeTex(c, anisotropy, true);
}

export function createSoccerBallBumpTexture(anisotropy = 4): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = "#c8c8c8";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#484848";
  ctx.lineWidth = 3;

  const rows = [32, 96, 160, 224];
  const cols = [32, 96, 160, 224];
  for (let ri = 0; ri < rows.length; ri++) {
    for (let ci = 0; ci < cols.length; ci++) {
      const cx = (cols[ci] + (ri % 2 === 0 ? 0 : 28)) % size;
      const cy = rows[ri];
      ctx.beginPath();
      ctx.arc(cx, cy, 21, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  return makeTex(c, anisotropy, false);
}

export function createAdBoardTexture(anisotropy = 4): THREE.CanvasTexture {
  const w = 1024;
  const h = 64;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;

  const panels = [
    { bg: "#000080", fg: "#fde047", text: "BLITZ-95 CUP" },
    { bg: "#0f766e", fg: "#ffffff", text: "WIN95 STADIUM 3D" },
    { bg: "#991b1b", fg: "#fef08a", text: "GROQ TACTICAL AI" },
    { bg: "#1e293b", fg: "#38bdf8", text: "360 KINEMATICS" },
  ];
  const pw = w / panels.length;
  panels.forEach((p, idx) => {
    ctx.fillStyle = p.bg;
    ctx.fillRect(idx * pw, 0, pw, h);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 4;
    ctx.strokeRect(idx * pw + 2, 2, pw - 4, h - 4);
    ctx.fillStyle = p.fg;
    ctx.font = "900 24px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.text, idx * pw + pw / 2, h / 2);
  });

  const tex = makeTex(c, anisotropy, true);
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

export function createStadiumScoreboardTexture(anisotropy = 4): THREE.CanvasTexture {
  const w = 512;
  const h = 128;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const tex = makeTex(c, anisotropy, true);
  updateStadiumScoreboardTexture(tex, 0, 0, 1);
  return tex;
}

export function updateStadiumScoreboardTexture(
  tex: THREE.CanvasTexture,
  scoreBlue: number,
  scoreRed: number,
  turnCount: number
) {
  const c = tex.image as HTMLCanvasElement;
  if (!c) return;
  const w = c.width;
  const h = c.height;
  const ctx = c.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#050b16";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  // Subtle LED matrix scanline texture
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  for (let y = 8; y < h - 8; y += 6) {
    ctx.fillRect(8, y, w - 16, 2);
  }

  ctx.fillStyle = "#facc15";
  ctx.font = "900 20px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText("BLITZ-95 ARENA · LIVE", w / 2, 30);

  // Team pills & live score
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(28, 48, 128, 48);
  ctx.fillStyle = "#b91c1c";
  ctx.fillRect(w - 156, 48, 128, 48);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 26px 'IBM Plex Mono', monospace";
  ctx.fillText("BLUE", 92, 81);
  ctx.fillText("RED", w - 92, 81);

  ctx.fillStyle = "#fef08a";
  ctx.font = "900 44px 'IBM Plex Mono', monospace";
  ctx.fillText(`${scoreBlue} : ${scoreRed}`, w / 2, 86);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "700 14px 'IBM Plex Mono', monospace";
  ctx.fillText(`ХОД ${Math.max(1, turnCount)} / 24`, w / 2, 114);

  tex.needsUpdate = true;
}
