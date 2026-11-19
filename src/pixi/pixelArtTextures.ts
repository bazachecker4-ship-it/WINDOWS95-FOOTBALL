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
  Position,
  RoleAppearance,
  Team,
} from "../types/game";

/**
 * Subtle 2.5D Isometric Projection (Dimetric-Oblique Football Arena)
 * Keeps left-right 11v11 gameplay instantly readable while adding rich 3D depth.
 */
export const ISO_COL_DX = 32;
export const ISO_COL_DY = 3.2;
export const ISO_ROW_DX = -6.0;
export const ISO_ROW_DY = 25.0;

export const GOAL_DEPTH = 48;
export const GOAL_HEIGHT = 28;
export const PITCH_OX = 286; // Enough room for row-skew (32*6=192) + left goal + stadium stand
export const PITCH_OY = 72;

export const WORLD_W = 1396;
export const WORLD_H = 1044;

export function gridPoint(col: number, row: number): { x: number; y: number } {
  return {
    x: PITCH_OX + col * ISO_COL_DX + row * ISO_ROW_DX,
    y: PITCH_OY + col * ISO_COL_DY + row * ISO_ROW_DY,
  };
}

export function cellCenter(pos: Position): { x: number; y: number } {
  return gridPoint(pos.col + 0.5, pos.row + 0.5);
}

export function cellQuad(col: number, row: number, pad = 0): number[] {
  const p = pad;
  const tl = gridPoint(col + p, row + p);
  const tr = gridPoint(col + 1 - p, row + p);
  const br = gridPoint(col + 1 - p, row + 1 - p);
  const bl = gridPoint(col + p, row + 1 - p);
  return [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y];
}

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
  const scale = 2; // 2x pixel density for crisp 16-bit VGA pixel look
  const w = Math.floor(WORLD_W / scale);
  const h = Math.floor(WORLD_H / scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  const gp = (col: number, row: number, elev = 0) => {
    const pt = gridPoint(col, row);
    return { x: pt.x / scale, y: (pt.y - elev) / scale };
  };

  const fillPoly = (pts: Array<{ x: number; y: number }>, color: string) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };

  const strokePoly = (
    pts: Array<{ x: number; y: number }>,
    color: string,
    lineWidth = 1.2,
    closed = true
  ) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    if (closed) ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  };

  // 1. Deep night stadium backdrop
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, "#050911");
  bgGrad.addColorStop(0.5, "#0b1320");
  bgGrad.addColorStop(1, "#04070d");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle floodlight cone glow from 4 stadium corners
  const drawFloodlight = (lx: number, ly: number) => {
    const rad = ctx.createRadialGradient(lx, ly, 4, lx, ly, 190);
    rad.addColorStop(0, "rgba(224, 242, 254, 0.22)");
    rad.addColorStop(0.5, "rgba(186, 230, 253, 0.06)");
    rad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, w, h);
  };
  drawFloodlight(w * 0.16, h * 0.08);
  drawFloodlight(w * 0.86, h * 0.12);

  // 2. Isometric Concrete Track Apron around the grass
  const apronTL = gp(-1.8, -1.6, 0);
  const apronTR = gp(PITCH_COLS + 1.8, -1.6, 0);
  const apronBR = gp(PITCH_COLS + 1.8, PITCH_ROWS + 1.6, 0);
  const apronBL = gp(-1.8, PITCH_ROWS + 1.6, 0);

  // Extruded 3D Stadium Platform Slab thickness (bottom & right visible faces)
  const slabDepth = 11;
  fillPoly(
    [
      apronBL,
      apronBR,
      { x: apronBR.x, y: apronBR.y + slabDepth },
      { x: apronBL.x, y: apronBL.y + slabDepth },
    ],
    "#1e293b"
  );
  fillPoly(
    [
      apronTR,
      apronBR,
      { x: apronBR.x, y: apronBR.y + slabDepth },
      { x: apronTR.x, y: apronTR.y + slabDepth },
    ],
    "#0f172a"
  );

  // Top apron track deck
  fillPoly([apronTL, apronTR, apronBR, apronBL], "#172330");
  strokePoly([apronTL, apronTR, apronBR, apronBL], "#334155", 1);

  // 3. Top & Bottom Isometric Perimeter LED Ad Boards (3D Upright panels)
  const drawIsoAds = (rowPos: number, heightElev: number) => {
    const ads = [
      { bg: "#1e3a8a", fg: "#fef08a", txt: "FIFA BLITZ" },
      { bg: "#991b1b", fg: "#ffffff", txt: "CHAMPIONS" },
      { bg: "#14532d", fg: "#86efac", txt: "WIN 95 CUP" },
      { bg: "#1e293b", fg: "#38bdf8", txt: "32×32 ARENA" },
      { bg: "#7c2d12", fg: "#fde68a", txt: "TURBO" },
      { bg: "#312e81", fg: "#f472b6", txt: "PRO LEAGUE" },
    ];
    const span = PITCH_COLS / ads.length;
    ads.forEach((ad, idx) => {
      const c0 = idx * span + 0.12;
      const c1 = (idx + 1) * span - 0.12;
      const b0 = gp(c0, rowPos, 0);
      const b1 = gp(c1, rowPos, 0);
      const t1 = gp(c1, rowPos, heightElev);
      const t0 = gp(c0, rowPos, heightElev);
      fillPoly([t0, t1, b1, b0], ad.bg);
      strokePoly([t0, t1, b1, b0], "#38bdf8", 0.8);

      // Slanted text along board
      const cx = (b0.x + b1.x) / 2;
      const cy = (b0.y + t0.y + b1.y + t1.y) / 4;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.atan2(b1.y - b0.y, b1.x - b0.x));
      ctx.fillStyle = ad.fg;
      ctx.font = "bold 5.5px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ad.txt, 0, 0);
      ctx.restore();
    });
  };
  drawIsoAds(-0.7, 13);

  // Crowd Bleachers behind Top Ad Boards (Pixel stadium spectators)
  const fanPalette = ["#60a5fa", "#f87171", "#fde047", "#ffffff", "#4ade80", "#f472b6"];
  for (let i = 0; i < 160; i++) {
    const fc = (i * 0.2) % PITCH_COLS;
    const fr = -1.1 - ((i % 3) * 0.28);
    const fp = gp(fc, fr, 12 + (i % 3) * 3);
    ctx.fillStyle = fanPalette[i % fanPalette.length];
    ctx.fillRect(Math.round(fp.x), Math.round(fp.y), 2, 2);
  }

  // 4. Pitch Surface Palette
  const palette =
    pitchType === "ice"
      ? { a: "#1b5978", b: "#216a8f", alt: "#1e6183", rim: "#0f3b52", speck: "#bae6fd", line: "#e0f2fe" }
      : pitchType === "sand"
      ? { a: "#aa803b", b: "#966d2f", alt: "#a07635", rim: "#6b4c1e", speck: "#fde68a", line: "#fef3c7" }
      : pitchType === "obstacles"
      ? { a: "#195744", b: "#134536", alt: "#164e3d", rim: "#0c2d23", speck: "#6ee7b7", line: "#e2e8f0" }
      : { a: "#1f7d43", b: "#166233", alt: "#1a6f3b", rim: "#0e4322", speck: "#86efac", line: "#f8fafc" };

  // 3D Turf Lip along visible bottom & right outer edges
  const turfBL = gp(0, PITCH_ROWS, 0);
  const turfBR = gp(PITCH_COLS, PITCH_ROWS, 0);
  const turfTR = gp(PITCH_COLS, 0, 0);
  const turfDepth = 4;
  fillPoly(
    [turfBL, turfBR, { x: turfBR.x, y: turfBR.y + turfDepth }, { x: turfBL.x, y: turfBL.y + turfDepth }],
    palette.rim
  );
  fillPoly(
    [turfTR, turfBR, { x: turfBR.x, y: turfBR.y + turfDepth }, { x: turfTR.x, y: turfTR.y + turfDepth }],
    palette.rim
  );

  // 5. Isometric Mowing Stripes & Diamond Turf Cells (32x32)
  for (let c = 0; c < PITCH_COLS; c++) {
    const bandEven = Math.floor(c / 2) % 2 === 0;
    for (let r = 0; r < PITCH_ROWS; r++) {
      const rowEven = Math.floor(r / 2) % 2 === 0;
      const diagCheck = (c + r) % 2 === 0;
      const colFill = bandEven
        ? diagCheck
          ? palette.a
          : palette.alt
        : rowEven
        ? palette.alt
        : palette.b;

      const p0 = gp(c, r);
      const p1 = gp(c + 1, r);
      const p2 = gp(c + 1, r + 1);
      const p3 = gp(c, r + 1);
      fillPoly([p0, p1, p2, p3], colFill);
    }
  }

  // Floodlight Soft Vignette over the Pitch
  const centerPt = gp(PITCH_COLS / 2, PITCH_ROWS / 2);
  const pitchGrad = ctx.createRadialGradient(centerPt.x, centerPt.y, 18, centerPt.x, centerPt.y, w * 0.48);
  pitchGrad.addColorStop(0, "rgba(255,255,255,0.12)");
  pitchGrad.addColorStop(0.65, "rgba(0,0,0,0)");
  pitchGrad.addColorStop(1, "rgba(0,0,0,0.34)");
  const turfTL = gp(0, 0);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(turfTL.x, turfTL.y);
  ctx.lineTo(turfTR.x, turfTR.y);
  ctx.lineTo(turfBR.x, turfBR.y);
  ctx.lineTo(turfBL.x, turfBL.y);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = pitchGrad;
  ctx.fillRect(0, 0, w, h);

  // Surface texture tufts inside pitch
  ctx.fillStyle = palette.speck;
  for (let i = 0; i < 1500; i++) {
    const c = ((i * 97 + 13) % (PITCH_COLS * 10)) / 10;
    const r = ((i * 151 + 29) % (PITCH_ROWS * 10)) / 10;
    const sp = gp(c, r);
    ctx.globalAlpha = pitchType === "ice" ? 0.3 : 0.16;
    if (pitchType === "ice" && i % 4 === 0) {
      ctx.fillRect(Math.round(sp.x), Math.round(sp.y), 3, 1);
    } else {
      ctx.fillRect(Math.round(sp.x), Math.round(sp.y), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // 6. Subtle Isometric 32x32 Grid Lines & Intersections
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 0.6;
  ctx.globalAlpha = 0.13;
  for (let c = 1; c < PITCH_COLS; c++) {
    const a = gp(c, 0);
    const b = gp(c, PITCH_ROWS);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (let r = 1; r < PITCH_ROWS; r++) {
    const a = gp(0, r);
    const b = gp(PITCH_COLS, r);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = palette.line;
  for (let c = 1; c < PITCH_COLS; c++) {
    for (let r = 1; r < PITCH_ROWS; r++) {
      const pt = gp(c, r);
      ctx.fillRect(Math.round(pt.x), Math.round(pt.y), 1, 1);
    }
  }
  ctx.globalAlpha = 1;

  // 7. Chalk Pitch Markings in Isometric Perspective
  const drawChalkLine = (c1: number, r1: number, c2: number, r2: number, width = 1.4) => {
    const a = gp(c1, r1);
    const b = gp(c2, r2);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = width;
    ctx.stroke();
  };

  const drawChalkArc = (
    cc: number,
    cr: number,
    radiusCells: number,
    startAng: number,
    endAng: number
  ) => {
    const steps = 36;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const ang = startAng + ((endAng - startAng) * i) / steps;
      const pt = gp(cc + Math.cos(ang) * radiusCells, cr + Math.sin(ang) * radiusCells);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  };

  // Outer Touchlines & Goal lines
  strokePoly([turfTL, turfTR, turfBR, turfBL], palette.line, 1.5);
  // Halfway Line
  drawChalkLine(PITCH_COLS / 2, 0, PITCH_COLS / 2, PITCH_ROWS, 1.4);
  // Center Circle & Center Spot (projected to crisp isometric ellipse!)
  drawChalkArc(PITCH_COLS / 2, PITCH_ROWS / 2, 4.3, 0, Math.PI * 2);
  const cSpot = gp(PITCH_COLS / 2, PITCH_ROWS / 2);
  ctx.fillStyle = palette.line;
  ctx.fillRect(Math.round(cSpot.x - 1.5), Math.round(cSpot.y - 1.5), 3, 3);

  // Corner Quarter Arcs
  drawChalkArc(0, 0, 1.15, 0, Math.PI / 2);
  drawChalkArc(PITCH_COLS, 0, 1.15, Math.PI / 2, Math.PI);
  drawChalkArc(PITCH_COLS, PITCH_ROWS, 1.15, Math.PI, Math.PI * 1.5);
  drawChalkArc(0, PITCH_ROWS, 1.15, Math.PI * 1.5, Math.PI * 2);

  // Penalty Boxes (Left: 0..6, Right: 26..32, Rows 8..24)
  drawChalkLine(0, 8, 6, 8);
  drawChalkLine(6, 8, 6, 24);
  drawChalkLine(6, 24, 0, 24);
  drawChalkLine(0, 11, 2, 11);
  drawChalkLine(2, 11, 2, 21);
  drawChalkLine(2, 21, 0, 21);
  drawChalkArc(4.2, 16, 3.1, -0.78, 0.78);
  const lPen = gp(4.2, 16);
  ctx.fillRect(Math.round(lPen.x - 1), Math.round(lPen.y - 1), 2.5, 2.5);

  drawChalkLine(PITCH_COLS, 8, PITCH_COLS - 6, 8);
  drawChalkLine(PITCH_COLS - 6, 8, PITCH_COLS - 6, 24);
  drawChalkLine(PITCH_COLS - 6, 24, PITCH_COLS, 24);
  drawChalkLine(PITCH_COLS, 11, PITCH_COLS - 2, 11);
  drawChalkLine(PITCH_COLS - 2, 11, PITCH_COLS - 2, 21);
  drawChalkLine(PITCH_COLS - 2, 21, PITCH_COLS, 21);
  drawChalkArc(PITCH_COLS - 4.2, 16, 3.1, Math.PI - 0.78, Math.PI + 0.78);
  const rPen = gp(PITCH_COLS - 4.2, 16);
  ctx.fillRect(Math.round(rPen.x - 1), Math.round(rPen.y - 1), 2.5, 2.5);

  // 8. 3D Isometric Raised Goals (Left & Right spanning GOAL_ROWS = 13..18)
  const gRowTop = GOAL_ROWS[0];
  const gRowBot = GOAL_ROWS[GOAL_ROWS.length - 1] + 1;
  const gDepthCols = 1.45;
  const gHeightPx = GOAL_HEIGHT;

  const drawIsoGoal = (isLeft: boolean) => {
    const frontCol = isLeft ? 0 : PITCH_COLS;
    const backCol = isLeft ? -gDepthCols : PITCH_COLS + gDepthCols;

    const fbTop = gp(frontCol, gRowTop, 0);
    const fbBot = gp(frontCol, gRowBot, 0);
    const bbTop = gp(backCol, gRowTop, 0);
    const bbBot = gp(backCol, gRowBot, 0);

    const ftTop = gp(frontCol, gRowTop, gHeightPx);
    const ftBot = gp(frontCol, gRowBot, gHeightPx);
    const btTop = gp(backCol, gRowTop, gHeightPx * 0.85);
    const btBot = gp(backCol, gRowBot, gHeightPx * 0.85);

    // Goal turf floor shadow
    fillPoly([fbTop, fbBot, bbBot, bbTop], "rgba(5, 10, 20, 0.55)");

    // Net Walls + Diamond Mesh
    const drawNetPanel = (pts: Array<{ x: number; y: number }>) => {
      fillPoly(pts, "rgba(15, 23, 42, 0.45)");
      strokePoly(pts, "rgba(226, 232, 240, 0.55)", 0.7);
      // Crosshatch threads
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.clip();
      ctx.strokeStyle = "rgba(248, 250, 252, 0.28)";
      ctx.lineWidth = 0.6;
      const minX = Math.min(...pts.map((p) => p.x));
      const maxX = Math.max(...pts.map((p) => p.x));
      const minY = Math.min(...pts.map((p) => p.y));
      const maxY = Math.max(...pts.map((p) => p.y));
      for (let x = minX; x <= maxX; x += 4) {
        ctx.beginPath();
        ctx.moveTo(x, minY);
        ctx.lineTo(x, maxY);
        ctx.stroke();
      }
      for (let y = minY; y <= maxY; y += 4) {
        ctx.beginPath();
        ctx.moveTo(minX, y);
        ctx.lineTo(maxX, y);
        ctx.stroke();
      }
      ctx.restore();
    };

    // Draw back, far-side, top roof, and near-side net panels
    drawNetPanel([btTop, btBot, bbBot, bbTop]);
    drawNetPanel([ftTop, btTop, bbTop, fbTop]);
    drawNetPanel([ftTop, ftBot, btBot, btTop]);
    drawNetPanel([ftBot, btBot, bbBot, fbBot]);

    // Thick White 3D Steel Goal Frame (posts + crossbar)
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(bbTop.x, bbTop.y);
    ctx.lineTo(btTop.x, btTop.y);
    ctx.lineTo(btBot.x, btBot.y);
    ctx.lineTo(bbBot.x, bbBot.y);
    ctx.stroke();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(fbTop.x, fbTop.y);
    ctx.lineTo(ftTop.x, ftTop.y);
    ctx.lineTo(ftBot.x, ftBot.y);
    ctx.lineTo(fbBot.x, fbBot.y);
    ctx.stroke();
  };

  drawIsoGoal(true);
  drawIsoGoal(false);

  // Front isometric low ad boards along bottom-front edge (subtle frame, keeps turf visible)
  drawIsoAds(PITCH_ROWS + 0.55, 8);

  return toNearestTexture(canvas);
}

export function createConeTexture(): PIXI.Texture {
  const c = document.createElement("canvas");
  c.width = 20;
  c.height = 20;
  const ctx = c.getContext("2d")!;
  // Isometric ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(3, 15, 14, 3);
  ctx.fillRect(5, 14, 10, 5);
  // Base plate
  ctx.fillStyle = "#9a3412";
  ctx.fillRect(4, 13, 12, 3);
  // Cone body
  ctx.fillStyle = "#ea580c";
  ctx.fillRect(5, 10, 10, 3);
  ctx.fillRect(6, 7, 8, 3);
  ctx.fillRect(7, 4, 6, 3);
  ctx.fillRect(8, 2, 4, 2);
  // Reflective white band
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(6, 8, 8, 2);
  // 2.5D Left sun highlight
  ctx.fillStyle = "#fdba74";
  ctx.fillRect(7, 4, 2, 4);
  ctx.fillRect(5, 10, 2, 3);
  return toNearestTexture(c);
}

export function createBallAnimationFrames(): PIXI.Texture[] {
  const frames: PIXI.Texture[] = [];
  for (let f = 0; f < 6; f++) {
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext("2d")!;

    // Crisp outer rim
    ctx.fillStyle = "#090d16";
    ctx.fillRect(5, 2, 6, 12);
    ctx.fillRect(3, 3, 10, 10);
    ctx.fillRect(2, 5, 12, 6);

    // 3D Lit white leather sphere
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(5, 3, 6, 10);
    ctx.fillRect(3, 5, 10, 6);
    ctx.fillRect(4, 4, 8, 8);

    // Highlight top-left + shading bottom-right
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(4, 4, 3, 2);
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(4, 11, 8, 2);
    ctx.fillRect(10, 9, 2, 3);

    // Animated rotating classic Telstar pentagon panels
    ctx.fillStyle = "#0f172a";
    const px = 4 + ((f * 2) % 6);
    const py = 5 + (f % 3);
    ctx.fillRect(px, py, 3, 3);
    ctx.fillRect(Math.max(4, 11 - f), 3, 2, 1);
    ctx.fillRect(5 + (f % 3), 11, 2, 1);
    if (f % 2 === 0) {
      ctx.fillRect(3, 7, 1, 2);
    } else {
      ctx.fillRect(12, 6, 1, 2);
    }

    frames.push(toNearestTexture(c));
  }
  return frames;
}

export function createCornerFlagFrames(color = "#ef4444"): PIXI.Texture[] {
  const frames: PIXI.Texture[] = [];
  for (let f = 0; f < 4; f++) {
    const c = document.createElement("canvas");
    c.width = 18;
    c.height = 22;
    const ctx = c.getContext("2d")!;

    // Isometric ground shadow
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fillRect(2, 18, 7, 2);
    // Pole
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(4, 2, 2, 17);
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(5, 2, 1, 17);
    // Gold cap
    ctx.fillStyle = "#fde047";
    ctx.fillRect(4, 1, 2, 2);

    // Fluttering cloth
    ctx.fillStyle = color;
    const wave = f === 0 ? 0 : f === 1 ? 1 : f === 2 ? -1 : 0;
    ctx.fillRect(6, 2 + Math.max(0, wave), 8, 3);
    ctx.fillRect(6, 5 + wave, 6, 2);
    ctx.fillStyle = "#fde047";
    ctx.fillRect(6, 4 + Math.max(0, wave), 5, 1);

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

/**
 * Upgraded 30x36 High-Detail 2.5D Isometric Footballer Sprites
 */
function drawFootballerFrame(
  role: PlayerRole,
  team: Team,
  skinTone: number,
  appearance: RoleAppearance | undefined,
  pose: "idle0" | "idle1" | "run0" | "run1" | "run2" | "run3"
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 30;
  c.height = 36;
  const ctx = c.getContext("2d")!;

  const skin = SKIN_PALETTES[Math.abs(skinTone) % SKIN_PALETTES.length];
  const isGK = role === "GK";

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

  const jerseyDark = darkenHex(baseJersey, 0.68);
  const jerseyLight = lightenHex(baseJersey, 46);
  const shortsCol =
    team === "red" ? (isGK ? "#1e1b4b" : "#111827") : isGK ? "#0f172a" : "#f8fafc";
  const shortsShade = darkenHex(shortsCol, 0.76);
  const sockCol = baseJersey;
  const pattern: JerseyPattern =
    team === "blue" && appearance ? appearance.jerseyPattern : "solid";
  const hair: HairStyle =
    team === "blue" && appearance ? appearance.hairStyle : "classic";

  const bodyBounceY =
    pose === "idle1" ? 1 : pose === "run0" || pose === "run2" ? -2 : 0;

  let leftLegDX = 0;
  let leftLegDY = 0;
  let rightLegDX = 0;
  let rightLegDY = 0;
  let leftArmDY = 0;
  let rightArmDY = 0;
  let leanX = 0;

  if (pose === "run0") {
    leftLegDX = -3;
    leftLegDY = -1;
    rightLegDX = 3;
    rightLegDY = 1;
    leftArmDY = 2;
    rightArmDY = -2;
    leanX = 1;
  } else if (pose === "run1") {
    leftLegDX = -1;
    rightLegDX = 1;
    leanX = 1;
  } else if (pose === "run2") {
    leftLegDX = 3;
    leftLegDY = 1;
    rightLegDX = -3;
    rightLegDY = -1;
    leftArmDY = -2;
    rightArmDY = 2;
    leanX = 1;
  } else if (pose === "run3") {
    leftLegDX = 1;
    rightLegDX = -1;
  }

  // 2.5D Soft Elliptical Isometric Turf Shadow
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(7, 31, 16, 3);
  ctx.fillRect(5, 32, 20, 1);

  // ---- LEGS, SOCKS & BOOTS ----
  const drawLeg = (lx: number, ly: number) => {
    // Skin knee/thigh
    ctx.fillStyle = skin.shade;
    ctx.fillRect(lx, ly, 3, 2);
    // Striped top cuff + sock
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(lx, ly + 2, 3, 1);
    ctx.fillStyle = sockCol;
    ctx.fillRect(lx, ly + 3, 3, 3);
    // Defender shin guard highlight
    if (role === "DEF") {
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(lx + 1, ly + 3, 1, 2);
    }
    // Boot (FWD wears golden speed boots)
    ctx.fillStyle = role === "FWD" ? "#78350f" : "#090d16";
    ctx.fillRect(lx - 1, ly + 6, 5, 2);
    ctx.fillStyle = role === "FWD" ? "#facc15" : "#e2e8f0";
    ctx.fillRect(lx + 1, ly + 6, 2, 1);
  };

  drawLeg(10 + leftLegDX, 24 + leftLegDY);
  drawLeg(16 + rightLegDX, 24 + rightLegDY);

  // ---- SHORTS ----
  const sy = 19 + bodyBounceY;
  ctx.fillStyle = "#090d16";
  ctx.fillRect(8 + leanX, sy, 13, 6);
  ctx.fillStyle = shortsCol;
  ctx.fillRect(9 + leanX, sy + 1, 11, 4);
  ctx.fillStyle = shortsShade;
  ctx.fillRect(14 + leanX, sy + 3, 2, 2);

  // ---- ARMS & HANDS / GK GLOVES ----
  const ay = 12 + bodyBounceY;
  const drawArm = (ax: number, dy: number) => {
    ctx.fillStyle = "#090d16";
    ctx.fillRect(ax, ay + dy, 3, 5);
    ctx.fillStyle = baseJersey;
    ctx.fillRect(ax, ay + dy + 1, 2, 3);
    // Captain armband on MID
    if (role === "MID" && ax < 10) {
      ctx.fillStyle = "#fde047";
      ctx.fillRect(ax, ay + dy + 2, 2, 1);
    }
    ctx.fillStyle = isGK ? baseJersey : skin.base;
    ctx.fillRect(ax, ay + dy + 4, 2, 2);
    ctx.fillStyle = isGK ? "#4ade80" : skin.shade;
    ctx.fillRect(ax, ay + dy + 6, isGK ? 3 : 2, 2);
  };

  drawArm(5 + leanX, leftArmDY);
  drawArm(21 + leanX, rightArmDY);

  // ---- TORSO / 2.5D LIT JERSEY ----
  const ty = 10 + bodyBounceY;
  ctx.fillStyle = "#090d16";
  ctx.fillRect(8 + leanX, ty, 14, 10);
  ctx.fillRect(7 + leanX, ty + 1, 16, 7);

  ctx.fillStyle = baseJersey;
  ctx.fillRect(9 + leanX, ty + 1, 12, 8);
  ctx.fillRect(8 + leanX, ty + 2, 14, 5);

  // 2.5D top-left shoulder highlight & right shadow
  ctx.fillStyle = jerseyLight;
  ctx.fillRect(9 + leanX, ty + 1, 11, 2);
  ctx.fillStyle = jerseyDark;
  ctx.fillRect(18 + leanX, ty + 2, 3, 7);
  ctx.fillRect(9 + leanX, ty + 8, 12, 1);

  // Pattern overlay
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  if (pattern === "stripes") {
    ctx.fillRect(10 + leanX, ty + 1, 2, 8);
    ctx.fillRect(16 + leanX, ty + 1, 2, 8);
  } else if (pattern === "sash") {
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(9 + leanX + i, ty + 1 + i, 2, 1);
    }
  } else if (role === "WNG") {
    ctx.fillRect(9 + leanX, ty + 4, 12, 1);
  }

  // Collar + Club Crest
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(12 + leanX, ty + 1, 5, 1);
  ctx.fillStyle = skin.shade;
  ctx.fillRect(13 + leanX, ty, 3, 1);
  ctx.fillStyle = "#fde047";
  ctx.fillRect(16 + leanX, ty + 3, 2, 2);

  // ---- HEAD, FACE & HAIR ----
  const hy = 2 + bodyBounceY;
  ctx.fillStyle = "#090d16";
  ctx.fillRect(10 + leanX, hy, 10, 8);
  ctx.fillRect(9 + leanX, hy + 1, 12, 6);

  // Face skin + 3D cheek shade
  ctx.fillStyle = skin.base;
  ctx.fillRect(11 + leanX, hy + 2, 8, 5);
  ctx.fillRect(10 + leanX, hy + 3, 10, 3);
  ctx.fillStyle = skin.shade;
  ctx.fillRect(17 + leanX, hy + 3, 2, 4);
  ctx.fillRect(11 + leanX, hy + 6, 8, 1);

  // Expressive eyes
  ctx.fillStyle = "#090d16";
  ctx.fillRect(13 + leanX, hy + 4, 1, 2);
  ctx.fillRect(17 + leanX, hy + 4, 1, 2);

  if (hair === "mohawk") {
    ctx.fillStyle = skin.hair;
    ctx.fillRect(11 + leanX, hy + 1, 8, 1);
    ctx.fillStyle = "#fde047";
    ctx.fillRect(14 + leanX, hy - 2, 2, 4);
    ctx.fillRect(13 + leanX, hy, 4, 2);
  } else if (hair === "curly") {
    ctx.fillStyle = skin.hair;
    ctx.fillRect(9 + leanX, hy - 1, 12, 3);
    ctx.fillRect(10 + leanX, hy - 2, 10, 2);
    ctx.fillStyle = lightenHex(skin.hair, 32);
    ctx.fillRect(11 + leanX, hy, 2, 1);
    ctx.fillRect(16 + leanX, hy, 2, 1);
  } else if (hair === "headband") {
    ctx.fillStyle = skin.hair;
    ctx.fillRect(10 + leanX, hy, 10, 2);
    ctx.fillStyle = "#f43f5e";
    ctx.fillRect(10 + leanX, hy + 2, 10, 1);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(13 + leanX, hy + 2, 2, 1);
  } else if (hair === "helmet") {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(10 + leanX, hy, 10, 3);
    ctx.fillRect(9 + leanX, hy + 1, 12, 3);
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(11 + leanX, hy + 2, 8, 1);
  } else {
    ctx.fillStyle = isGK ? "#1e293b" : skin.hair;
    ctx.fillRect(10 + leanX, hy, 10, 2);
    ctx.fillRect(10 + leanX, hy + 1, 2, 3);
    ctx.fillRect(18 + leanX, hy + 1, 2, 3);
    if (isGK) {
      // Keeper cap visor
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(11 + leanX, hy + 2, 9, 1);
    }
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
