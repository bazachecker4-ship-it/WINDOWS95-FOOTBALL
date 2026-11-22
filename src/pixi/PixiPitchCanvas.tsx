import React, { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import {
  BallFlightEvent,
  BallState,
  CameraPreset,
  FloatingCallout,
  GOAL_ROWS,
  MoveOption,
  PITCH_COLS,
  PITCH_ROWS,
  PassOption,
  PitchType,
  PlayerPiece,
  Position,
  ROLE_META,
  ShotOption,
  SquadProgressionState,
  TacticalHint,
  Team,
} from "../types/game";
import { getPitchObstacles } from "../engine/footballEngine";
import {
  PlayerAnimationFrames,
  WORLD_H,
  WORLD_W,
  cellCenter,
  cellQuad,
  createBallAnimationFrames,
  createConeTexture,
  createCornerFlagFrames,
  createPitchTexture,
  createPlayerAnimationFrames,
  gridPoint,
} from "./pixelArtTextures";
import { CRTFilterHandle, createCRTFilter } from "./crtFilter";
import { Camera, Compass, LocateFixed, Monitor, ZoomIn, ZoomOut } from "lucide-react";

const CAMERA_PRESET_META: Record<
  CameraPreset,
  { label: string; shortLabel: string; title: string; zoom: number; rot: number; skewX: number; tiltY: number }
> = {
  tv: {
    label: "ТВ-Эфир",
    shortLabel: "ТВ",
    title: "Динамическая ТВ-камера следит за мячом (клавиша V)",
    zoom: 1.42,
    rot: 0,
    skewX: 0.03,
    tiltY: 0.95,
  },
  wide: {
    label: "Всё поле",
    shortLabel: "Обзор",
    title: "Полное поле 32×32 целиком",
    zoom: 1.0,
    rot: 0,
    skewX: 0,
    tiltY: 1.0,
  },
  close: {
    label: "Крупно",
    shortLabel: "Крупно",
    title: "Приближение 1.95× + перетаскивание поля",
    zoom: 1.95,
    rot: 0,
    skewX: 0,
    tiltY: 0.96,
  },
  topdown: {
    label: "Сверху",
    shortLabel: "Сверху",
    title: "Выпрямленный тактический вид сверху",
    zoom: 1.02,
    rot: -0.22,
    skewX: -0.14,
    tiltY: 1.1,
  },
  opposite: {
    label: "Трибуна 180°",
    shortLabel: "180°",
    title: "Обратный ракурс с противоположной трибуны",
    zoom: 1.18,
    rot: Math.PI,
    skewX: 0,
    tiltY: 1.0,
  },
};

const CAMERA_PRESET_ORDER: CameraPreset[] = ["tv", "wide", "close", "topdown", "opposite"];

interface PixiPitchCanvasProps {
  players: PlayerPiece[];
  ball: BallState;
  pitchType: PitchType;
  progression: SquadProgressionState;
  currentTurn: Team;
  isHumanTurn: boolean;
  selectedPlayerId: string | null;
  validMoves: MoveOption[];
  validPasses: PassOption[];
  validShots: ShotOption[];
  coachHint: TacticalHint | null;
  showCoachHint: boolean;
  lastMoveTrace: { from: Position; to: Position; team: Team } | null;
  ballFlight: BallFlightEvent | null;
  floatingCallout: FloatingCallout | null;
  superDriveReady: boolean;
  goalCelebrationTeam: Team | null;
  cameraPreset?: CameraPreset;
  onChangeCameraPreset?: (preset: CameraPreset) => void;
  crtEnabled?: boolean;
  onToggleCrt?: () => void;
  onlineCount?: number;
  onOpenLobby?: () => void;
  hideHudWidgets?: boolean;
  onSelectPlayer: (playerId: string) => void;
  onCellClick: (pos: Position) => void;
  onPassToPlayer: (targetId: string) => void;
  onShootGoal: (goalRow: number) => void;
}

interface Particle {
  gfx: PIXI.Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

interface AmbientMote {
  col: number;
  row: number;
  vc: number;
  vr: number;
  phase: number;
  size: number;
}

interface FloatingBanner {
  container: PIXI.Container;
  life: number;
  maxLife: number;
}

interface ActiveFlightAnim {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
  duration: number;
  peakHeight: number;
  trailColor: number;
}

const PIXEL_ARROW_CURSOR =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='24' viewBox='0 0 16 20' shape-rendering='crispEdges'%3E%3Cpath d='M1 1v15l3.5-3.5 2.5 5.5 2.2-1-2.5-5.5H12L1 1z' fill='%23000000'/%3E%3Cpath d='M2 3.2v10.4l2.8-2.8 2.6 5.6.9-.4-2.6-5.6h4.1L2 3.2z' fill='%23ffffff'/%3E%3C/svg%3E") 1 1, auto`;

const PIXEL_POINTER_CURSOR =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='24' viewBox='0 0 18 20' shape-rendering='crispEdges'%3E%3Cpath d='M6 1h2v6h2V6h2v1h2v1h2v5l-1 5H6l-3-4v-3h2v1h1V1z' fill='%23000000'/%3E%3Cpath d='M7 2v9H5v1l2 3h6l1-4V9h-1v2h-1V8h-1v3h-1V7H9v4H8V2H7z' fill='%23ffffff'/%3E%3C/svg%3E") 6 1, pointer`;

export const PixiPitchCanvas: React.FC<PixiPitchCanvasProps> = (props) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const [internalPreset, setInternalPreset] = useState<CameraPreset>("tv");
  const activePreset = props.cameraPreset ?? internalPreset;
  const presetRef = useRef<CameraPreset>(activePreset);
  presetRef.current = activePreset;

  const [zoomOffset, setZoomOffset] = useState(0);
  const zoomOffsetRef = useRef(0);
  zoomOffsetRef.current = zoomOffset;

  const setCameraPreset = (next: CameraPreset) => {
    setInternalPreset(next);
    setZoomOffset(0);
    panOffsetRef.current = { x: 0, y: 0 };
    propsRef.current.onChangeCameraPreset?.(next);
  };

  const panOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    basePanX: number;
    basePanY: number;
    moved: boolean;
  }>({ active: false, startX: 0, startY: 0, basePanX: 0, basePanY: 0, moved: false });

  const [internalCrt, setInternalCrt] = useState(false);
  const crtEnabled = props.crtEnabled ?? internalCrt;
  const crtEnabledRef = useRef(crtEnabled);
  crtEnabledRef.current = crtEnabled;
  const toggleCrt = () => {
    if (propsRef.current.onToggleCrt) propsRef.current.onToggleCrt();
    else setInternalCrt((v) => !v);
  };

  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fitCanvasRef = useRef<() => void>(() => {});

  const engineRef = useRef<{
    app: PIXI.Application;
    worldContainer: PIXI.Container;
    crtHandle: CRTFilterHandle | null;
    pitchSprite: PIXI.Sprite;
    ambientGfx: PIXI.Graphics;
    ambientMotes: AmbientMote[];
    flagsLayer: PIXI.Container;
    obstaclesLayer: PIXI.Container;
    hintsLayer: PIXI.Graphics;
    hintLabelsLayer: PIXI.Container;
    hoverCursor: PIXI.Graphics;
    hoverPreviewLayer: PIXI.Graphics;
    hoverPreviewTag: PIXI.Container;
    hoverPreviewText: PIXI.Text;
    hoverPreviewBg: PIXI.Graphics;
    selectedArrow: PIXI.Graphics;
    playersLayer: PIXI.Container;
    ghostsLayer: PIXI.Container;
    ballShadow: PIXI.Graphics;
    ballSprite: PIXI.Sprite;
    ballFrames: PIXI.Texture[];
    ballFlightAnim: ActiveFlightAnim | null;
    particlesLayer: PIXI.Container;
    calloutsLayer: PIXI.Container;
    particles: Particle[];
    callouts: FloatingBanner[];
    playerVisuals: Map<
      string,
      {
        container: PIXI.Container;
        sprite: PIXI.Sprite;
        frames: PlayerAnimationFrames;
        ring: PIXI.Graphics;
        staminaBar: PIXI.Graphics;
        badge: PIXI.Text;
        passTag: PIXI.Container;
        tx: number;
        ty: number;
        facing: 1 | -1;
        animClock: number;
        ghostCooldown: number;
        kickBoost: number;
      }
    >;
    ballTarget: { x: number; y: number };
    shakeTime: number;
    goalFlashTime: number;
    coneTex: PIXI.Texture;
    lastPitchType: PitchType | null;
    lastProgressionSig: string;
    lastFlightNonce: number;
    lastCalloutId: string;
    hoverCell: Position | null;
    baseFitScale: number;
    camZoom: number;
    camX: number;
    camY: number;
    camRot: number;
    camSkewX: number;
    camTiltY: number;
  } | null>(null);

  const spawnBurst = (x: number, y: number, color: number, count = 10) => {
    const eng = engineRef.current;
    if (!eng) return;
    for (let i = 0; i < count; i++) {
      const g = new PIXI.Graphics();
      const size = 2 + Math.floor(Math.random() * 4);
      g.rect(-size / 2, -size / 2, size, size).fill({ color });
      g.x = x;
      g.y = y;
      eng.particlesLayer.addChild(g);
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.8 + Math.random() * 2.8;
      eng.particles.push({
        gfx: g,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        life: 0,
        maxLife: 20 + Math.random() * 16,
      });
    }
  };

  const spawnCallout = (pos: Position, text: string, color: number) => {
    const eng = engineRef.current;
    if (!eng) return;
    const center = cellCenter(pos);
    const container = new PIXI.Container();
    container.x = Math.max(90, Math.min(WORLD_W - 90, center.x));
    container.y = Math.max(46, center.y - 36);

    const lbl = new PIXI.Text({
      text,
      style: {
        fontFamily: "Pixelify Sans, monospace",
        fontSize: 16,
        fontWeight: "700",
        fill: color,
        stroke: { color: 0x05080f, width: 4 },
      },
    });
    lbl.anchor.set(0.5);
    container.addChild(lbl);
    eng.calloutsLayer.addChild(container);
    eng.callouts.push({ container, life: 0, maxLife: 62 });
  };

  const syncScene = () => {
    const eng = engineRef.current;
    if (!eng) return;
    const p = propsRef.current;

    // 1. Rebuild isometric pitch background & 3D cones if pitchType changed
    if (eng.lastPitchType !== p.pitchType) {
      eng.lastPitchType = p.pitchType;
      eng.pitchSprite.texture = createPitchTexture(p.pitchType);

      eng.obstaclesLayer.removeChildren();
      for (const obs of getPitchObstacles(p.pitchType)) {
        const sp = new PIXI.Sprite(eng.coneTex);
        sp.anchor.set(0.5, 0.78);
        sp.width = 28;
        sp.height = 28;
        const c = cellCenter(obs);
        sp.x = c.x;
        sp.y = c.y + 4;
        eng.obstaclesLayer.addChild(sp);
      }
    }

    // 2. Rebuild player sprites if appearance customized
    const progSig = JSON.stringify(p.progression.roles);
    const rebuildSprites = eng.lastProgressionSig !== progSig;
    if (rebuildSprites) {
      eng.lastProgressionSig = progSig;
    }

    const validPassMap = new Map(p.validPasses.map((o) => [o.targetPlayerId, o]));
    const moveMap = new Map(p.validMoves.map((m) => [`${m.pos.col},${m.pos.row}`, m]));

    // 3. Update all 22 Footballers (2.5D Isometric Standing Characters)
    for (const player of p.players) {
      const center = cellCenter(player.pos);
      let vis = eng.playerVisuals.get(player.id);

      if (!vis) {
        const container = new PIXI.Container();
        container.x = center.x;
        container.y = center.y;
        container.eventMode = "static";
        container.cursor = "pointer";

        const ring = new PIXI.Graphics();
        const staminaBar = new PIXI.Graphics();
        const frames = createPlayerAnimationFrames(
          player.role,
          player.team,
          player.skinTone,
          player.team === "blue" ? p.progression.roles[player.role].appearance : undefined
        );
        const sprite = new PIXI.Sprite(frames.idle[0]);
        // Foot anchor at cell center so torso/head rise into 2.5D vertical depth
        sprite.anchor.set(0.5, 0.84);
        const spriteW = 36;
        const spriteH = 44;
        sprite.width = spriteW;
        sprite.height = spriteH;

        const facing: 1 | -1 = player.team === "blue" ? 1 : -1;
        sprite.scale.x = facing * (spriteW / 30);

        const badge = new PIXI.Text({
          text: `${ROLE_META[player.role].code}${player.number}`,
          style: {
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: 9.5,
            fontWeight: "700",
            fill: player.team === "blue" ? 0xe0f2fe : 0xfee2e2,
            stroke: { color: 0x05080f, width: 3 },
          },
        });
        badge.anchor.set(0.5);
        badge.y = 11;

        const passTag = new PIXI.Container();
        const passBg = new PIXI.Graphics();
        passBg.rect(-15, -49, 30, 12).fill({ color: 0xfbbf24 });
        passBg.rect(-15, -49, 30, 12).stroke({ color: 0x090d16, width: 1.5 });
        const passTxt = new PIXI.Text({
          text: "ПАС",
          style: {
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: 8.5,
            fontWeight: "700",
            fill: 0x090d16,
          },
        });
        passTxt.anchor.set(0.5);
        passTxt.y = -43;
        passTag.addChild(passBg, passTxt);
        passTag.visible = false;

        container.addChild(ring, sprite, staminaBar, badge, passTag);

        container.on("pointertap", (ev) => {
          ev.stopPropagation();
          const cur = propsRef.current;
          if (!cur.isHumanTurn) return;
          const livePlayer = cur.players.find((pl) => pl.id === player.id);
          if (!livePlayer) return;

          const isPass = cur.validPasses.some((o) => o.targetPlayerId === livePlayer.id);
          const isClash = cur.validMoves.some(
            (m) =>
              m.kind === "clash" &&
              m.pos.col === livePlayer.pos.col &&
              m.pos.row === livePlayer.pos.row
          );

          if (isPass) {
            cur.onPassToPlayer(livePlayer.id);
          } else if (isClash) {
            cur.onCellClick(livePlayer.pos);
          } else if (livePlayer.team === cur.currentTurn) {
            cur.onSelectPlayer(livePlayer.id);
          }
        });

        eng.playersLayer.addChild(container);
        vis = {
          container,
          sprite,
          frames,
          ring,
          staminaBar,
          badge,
          passTag,
          tx: center.x,
          ty: center.y,
          facing,
          animClock: Math.random() * 10,
          ghostCooldown: 0,
          kickBoost: 0,
        };
        eng.playerVisuals.set(player.id, vis);
      }

      if (rebuildSprites && player.team === "blue") {
        vis.frames = createPlayerAnimationFrames(
          player.role,
          player.team,
          player.skinTone,
          p.progression.roles[player.role].appearance
        );
        vis.sprite.texture = vis.frames.idle[0];
      }

      if (vis.tx !== center.x || vis.ty !== center.y) {
        const dx = center.x - vis.tx;
        if (Math.abs(dx) > 1) {
          vis.facing = dx >= 0 ? 1 : -1;
        }
        vis.kickBoost = 1;
        const particleCol =
          p.pitchType === "ice" ? 0xbae6fd : p.pitchType === "sand" ? 0xfde68a : 0x86efac;
        spawnBurst(vis.tx, vis.ty + 2, particleCol, 5);
      }

      vis.tx = center.x;
      vis.ty = center.y;

      const isSelected = player.id === p.selectedPlayerId;
      const hasBall = p.ball.carrierId === player.id;
      const passOpt = validPassMap.get(player.id);
      const clashOpt = moveMap.get(`${player.pos.col},${player.pos.row}`);
      const isPassTarget = Boolean(passOpt && p.isHumanTurn);
      const isClashTarget = Boolean(clashOpt && clashOpt.kind === "clash" && p.isHumanTurn);
      const canClick =
        p.isHumanTurn && (player.team === p.currentTurn || isPassTarget || isClashTarget);

      vis.container.cursor = canClick ? "pointer" : "default";
      vis.passTag.visible = isPassTarget;

      // Render tactical stamina micro-bar
      vis.staminaBar.clear();
      const stam = player.stamina ?? 100;
      if (player.team === "blue" && (isSelected || hasBall || stam < 75)) {
        const barW = 22;
        const fillW = Math.max(2, Math.round((barW * stam) / 100));
        const barCol = stam >= 60 ? 0x4ade80 : stam >= 30 ? 0xfbbf24 : 0xef4444;
        vis.staminaBar.rect(-barW / 2 - 1, 16, barW + 2, 4).fill({ color: 0x05080f });
        vis.staminaBar.rect(-barW / 2, 17, fillW, 2).fill({ color: barCol });
      }

      // Isometric glowing cyan-white ring under selected player (matching Windows 95 Football!)
      vis.ring.clear();
      if (isSelected) {
        const selColor = p.superDriveReady && player.team === "blue" ? 0xfde047 : 0x22d3ee;
        vis.ring.ellipse(0, 1, 18, 9).stroke({ color: selColor, width: 3.5, alpha: 0.45 });
        vis.ring.ellipse(0, 1, 15, 7.5).stroke({ color: 0xffffff, width: 2 });
        vis.ring.ellipse(0, 1, 13, 6.2).fill({ color: selColor, alpha: 0.24 });
      } else if (isPassTarget) {
        const pCol = passOpt?.isLob ? 0xc084fc : 0xfbbf24;
        vis.ring.ellipse(0, 1, 16, 8).stroke({ color: pCol, width: 2.5 });
      } else if (isClashTarget) {
        vis.ring.ellipse(0, 1, 16, 8).stroke({ color: 0xf97316, width: 2.5 });
      } else if (hasBall) {
        vis.ring.ellipse(0, 1, 15, 7.5).stroke({ color: 0x38bdf8, width: 2, alpha: 0.9 });
      }
    }

    // 4. Ball Target + Airborne Flight Arc
    const ballCenter = cellCenter(p.ball.pos);
    const nextBx = p.ball.carrierId ? ballCenter.x + 11 : ballCenter.x;
    const nextBy = p.ball.carrierId ? ballCenter.y + 4 : ballCenter.y;
    if (eng.ballTarget.x !== nextBx || eng.ballTarget.y !== nextBy) {
      spawnBurst(eng.ballTarget.x, eng.ballTarget.y, 0xf8fafc, 5);
    }
    eng.ballTarget = { x: nextBx, y: nextBy };

    if (p.ballFlight && p.ballFlight.nonce !== eng.lastFlightNonce) {
      eng.lastFlightNonce = p.ballFlight.nonce;
      const fromPt = cellCenter(p.ballFlight.from);
      const toPt = cellCenter(p.ballFlight.to);
      const dist = Math.hypot(toPt.x - fromPt.x, toPt.y - fromPt.y);
      eng.ballFlightAnim = {
        fromX: fromPt.x,
        fromY: fromPt.y,
        toX: p.ballFlight.isShot ? toPt.x : nextBx,
        toY: p.ballFlight.isShot ? toPt.y : nextBy,
        progress: 0,
        duration: p.ballFlight.isShot ? 16 : p.ballFlight.isLob ? 24 : 15,
        peakHeight: p.ballFlight.isLob
          ? Math.min(72, 26 + dist * 0.16)
          : p.ballFlight.isShot
          ? 30
          : Math.min(24, 8 + dist * 0.06),
        trailColor: p.ballFlight.isSuperShot
          ? 0xfacc15
          : p.ballFlight.isShot
          ? 0x4ade80
          : p.ballFlight.isLob
          ? 0xc084fc
          : 0xfbbf24,
      };
    }

    // 5. Floating World Callout
    if (p.floatingCallout && p.floatingCallout.id !== eng.lastCalloutId) {
      eng.lastCalloutId = p.floatingCallout.id;
      spawnCallout(p.floatingCallout.pos, p.floatingCallout.text, p.floatingCallout.color);
    }

    // 6. Redraw Isometric Hints & Trajectories on 32x32 grid
    eng.hintsLayer.clear();
    eng.hintLabelsLayer.removeChildren();

    const selectedPlayer = p.players.find((pl) => pl.id === p.selectedPlayerId) ?? null;

    if (p.lastMoveTrace) {
      const a = cellCenter(p.lastMoveTrace.from);
      const b = cellCenter(p.lastMoveTrace.to);
      eng.hintsLayer
        .moveTo(a.x, a.y)
        .lineTo(b.x, b.y)
        .stroke({
          color: p.lastMoveTrace.team === "blue" ? 0x60a5fa : 0xf87171,
          width: 2.5,
          alpha: 0.55,
        });
    }

    if (p.isHumanTurn) {
      for (const mv of p.validMoves) {
        const quad = cellQuad(mv.pos.col, mv.pos.row, 0.08);
        const mc = cellCenter(mv.pos);

        if (mv.kind === "clash") {
          eng.hintsLayer.poly(quad).fill({ color: 0xf59e0b, alpha: 0.35 });
          eng.hintsLayer.poly(quad).stroke({ color: 0xfde047, width: 2.2 });
          const tag = new PIXI.Text({
            text: `${mv.complexity?.size ?? 3}×${mv.complexity?.size ?? 3}`,
            style: {
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 10,
              fontWeight: "700",
              fill: 0xfef08a,
              stroke: { color: 0x090d16, width: 3 },
            },
          });
          tag.anchor.set(0.5);
          tag.x = mc.x;
          tag.y = mc.y - 22;
          eng.hintLabelsLayer.addChild(tag);
        } else if (mv.kind === "pickup") {
          eng.hintsLayer.poly(quad).fill({ color: 0x34d399, alpha: 0.34 });
          eng.hintsLayer.poly(quad).stroke({ color: 0x6ee7b7, width: 2.2 });
        } else {
          const col = mv.isSlide ? 0x38bdf8 : 0x34d399;
          eng.hintsLayer.poly(quad).fill({ color: col, alpha: 0.2 });
          eng.hintsLayer
            .ellipse(mc.x, mc.y, 6, 4)
            .fill({ color: col, alpha: 0.92 })
            .stroke({ color: 0x090d16, width: 1.5 });
        }
      }

      if (selectedPlayer) {
        const from = cellCenter(selectedPlayer.pos);
        for (const pass of p.validPasses) {
          const to = cellCenter(pass.pos);
          const steps = 12;
          const color = pass.isLob ? 0xc084fc : 0xfbbf24;
          for (let s = 0; s < steps; s += 2) {
            const t1 = s / steps;
            const t2 = Math.min(1, (s + 1.2) / steps);
            eng.hintsLayer
              .moveTo(from.x + (to.x - from.x) * t1, from.y + (to.y - from.y) * t1)
              .lineTo(from.x + (to.x - from.x) * t2, from.y + (to.y - from.y) * t2)
              .stroke({ color, width: 3, alpha: 0.92 });
          }
        }

        for (const shot of p.validShots) {
          const isRight = selectedPlayer.team === "blue";
          const c0 = isRight ? PITCH_COLS : -1.45;
          const c1 = isRight ? PITCH_COLS + 1.45 : 0;
          const q0 = gridPoint(c0, shot.goalRow + 0.08);
          const q1 = gridPoint(c1, shot.goalRow + 0.08);
          const q2 = gridPoint(c1, shot.goalRow + 0.92);
          const q3 = gridPoint(c0, shot.goalRow + 0.92);
          const goalQuad = [q0.x, q0.y, q1.x, q1.y, q2.x, q2.y, q3.x, q3.y];

          const color = shot.isContested ? 0xf59e0b : 0x22c55e;
          eng.hintsLayer.poly(goalQuad).fill({ color, alpha: 0.52 });
          eng.hintsLayer.poly(goalQuad).stroke({ color: 0xffffff, width: 1.6 });

          const mouthPt = gridPoint(isRight ? PITCH_COLS : 0, shot.goalRow + 0.5);
          eng.hintsLayer
            .moveTo(from.x, from.y)
            .lineTo(mouthPt.x, mouthPt.y)
            .stroke({ color, width: 2.5, alpha: 0.85 });

          const centerGoal = gridPoint((c0 + c1) / 2, shot.goalRow + 0.5);
          const lbl = new PIXI.Text({
            text: shot.isContested ? `${shot.complexity?.size ?? 4}×${shot.complexity?.size ?? 4}` : "ГОЛ",
            style: {
              fontFamily: "Pixelify Sans, monospace",
              fontSize: 11,
              fontWeight: "700",
              fill: 0xffffff,
              stroke: { color: 0x090d16, width: 3 },
            },
          });
          lbl.anchor.set(0.5);
          lbl.x = centerGoal.x;
          lbl.y = centerGoal.y;
          eng.hintLabelsLayer.addChild(lbl);
        }
      }

      if (p.showCoachHint && p.coachHint) {
        const origin = p.players.find((pl) => pl.id === p.coachHint?.playerId);
        if (origin) {
          const oc = cellCenter(origin.pos);
          eng.hintsLayer
            .poly(cellQuad(origin.pos.col, origin.pos.row, 0.03))
            .stroke({ color: 0x38bdf8, width: 2.5, alpha: 0.95 });

          const target = p.coachHint.targetPos
            ? cellCenter(p.coachHint.targetPos)
            : p.coachHint.goalRow !== undefined
            ? gridPoint(origin.team === "blue" ? PITCH_COLS + 0.7 : -0.7, p.coachHint.goalRow + 0.5)
            : null;
          if (target) {
            eng.hintsLayer
              .moveTo(oc.x, oc.y)
              .lineTo(target.x, target.y)
              .stroke({ color: 0x38bdf8, width: 2.5, alpha: 0.82 });
          }
        }
      }
    }
  };

  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || !props.goalCelebrationTeam) return;
    eng.shakeTime = 24;
    eng.goalFlashTime = 50;
    const burstColor = props.goalCelebrationTeam === "blue" ? 0x60a5fa : 0xf87171;
    const goalCenter = gridPoint(
      props.goalCelebrationTeam === "blue" ? PITCH_COLS : 0,
      PITCH_ROWS / 2
    );
    spawnBurst(goalCenter.x, goalCenter.y - 12, burstColor, 48);
    spawnBurst(goalCenter.x, goalCenter.y - 16, 0xfde047, 34);
  }, [props.goalCelebrationTeam]);

  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || !eng.crtHandle) return;
    eng.app.stage.filters = crtEnabled ? [eng.crtHandle.filter] : [];
  }, [crtEnabled]);

  useEffect(() => {
    const containerEl = hostRef.current;
    if (!containerEl) return;

    let cancelled = false;
    let resizeObs: ResizeObserver | null = null;
    let appInstance: PIXI.Application | null = null;

    const bootPixi = async () => {
      const app = new PIXI.Application();
      await app.init({
        width: WORLD_W,
        height: WORLD_H,
        backgroundColor: 0x050911,
        backgroundAlpha: 1,
        antialias: false,
        roundPixels: true,
        resolution: Math.min(2, window.devicePixelRatio || 1),
        autoDensity: true,
      });

      if (cancelled) {
        app.destroy(true, { children: true });
        return;
      }

      app.renderer.events.cursorStyles.default = PIXEL_ARROW_CURSOR;
      app.renderer.events.cursorStyles.pointer = PIXEL_POINTER_CURSOR;

      appInstance = app;
      app.canvas.style.width = "100%";
      app.canvas.style.height = "100%";
      app.canvas.style.display = "block";
      app.canvas.style.imageRendering = "pixelated";
      containerEl.innerHTML = "";
      containerEl.appendChild(app.canvas);

      const worldContainer = new PIXI.Container();
      app.stage.addChild(worldContainer);

      let crtHandle: CRTFilterHandle | null = null;
      try {
        crtHandle = createCRTFilter();
        app.stage.filterArea = app.screen;
        if (crtEnabledRef.current) {
          app.stage.filters = [crtHandle.filter];
        }
      } catch {
        crtHandle = null;
      }

      const pitchTex = createPitchTexture(propsRef.current.pitchType);
      const pitchSprite = new PIXI.Sprite(pitchTex);
      pitchSprite.width = WORLD_W;
      pitchSprite.height = WORLD_H;

      const ambientGfx = new PIXI.Graphics();
      const ambientMotes: AmbientMote[] = Array.from({ length: 48 }, (_, i) => ({
        col: ((i * 7.3) % PITCH_COLS),
        row: ((i * 5.9) % PITCH_ROWS),
        vc: 0.008 + (i % 5) * 0.004,
        vr: ((i % 3) - 1) * 0.003,
        phase: i * 0.7,
        size: i % 4 === 0 ? 3 : 2,
      }));

      // Animated Isometric Corner Flags at the 4 Pitch Corners
      const flagsLayer = new PIXI.Container();
      const flagFrames = createCornerFlagFrames("#ef4444");
      const corners = [
        { pt: gridPoint(0, 0), flip: 1 },
        { pt: gridPoint(PITCH_COLS, 0), flip: -1 },
        { pt: gridPoint(0, PITCH_ROWS), flip: 1 },
        { pt: gridPoint(PITCH_COLS, PITCH_ROWS), flip: -1 },
      ];
      corners.forEach((c) => {
        const flag = new PIXI.AnimatedSprite(flagFrames);
        flag.anchor.set(0.25, 0.9);
        flag.width = 24;
        flag.height = 28;
        flag.scale.x *= c.flip;
        flag.x = c.pt.x;
        flag.y = c.pt.y;
        flag.animationSpeed = 0.1;
        flag.play();
        flagsLayer.addChild(flag);
      });

      const obstaclesLayer = new PIXI.Container();
      const hintsLayer = new PIXI.Graphics();
      const hintLabelsLayer = new PIXI.Container();
      const hoverPreviewLayer = new PIXI.Graphics();
      const hoverCursor = new PIXI.Graphics();
      const ghostsLayer = new PIXI.Container();
      const playersLayer = new PIXI.Container();
      const selectedArrow = new PIXI.Graphics();

      const hoverPreviewTag = new PIXI.Container();
      const hoverPreviewBg = new PIXI.Graphics();
      const hoverPreviewText = new PIXI.Text({
        text: "",
        style: {
          fontFamily: "IBM Plex Mono, monospace",
          fontSize: 10,
          fontWeight: "700",
          fill: 0xffffff,
        },
      });
      hoverPreviewText.anchor.set(0.5);
      hoverPreviewTag.addChild(hoverPreviewBg, hoverPreviewText);
      hoverPreviewTag.visible = false;

      const ballShadow = new PIXI.Graphics();
      const ballFrames = createBallAnimationFrames();
      const ballSprite = new PIXI.Sprite(ballFrames[0]);
      ballSprite.anchor.set(0.5);
      ballSprite.width = 18;
      ballSprite.height = 18;

      const particlesLayer = new PIXI.Container();
      const calloutsLayer = new PIXI.Container();

      // Exact Isometric Parallelogram Hitbox Cells
      const hitLayer = new PIXI.Container();
      hitLayer.eventMode = "static";
      for (let r = 0; r < PITCH_ROWS; r++) {
        for (let c = 0; c < PITCH_COLS; c++) {
          const cell = new PIXI.Graphics();
          cell.poly(cellQuad(c, r)).fill({ color: 0x000000, alpha: 0.001 });
          cell.eventMode = "static";
          cell.on("pointerover", () => {
            if (engineRef.current) engineRef.current.hoverCell = { col: c, row: r };
          });
          cell.on("pointerout", () => {
            if (
              engineRef.current &&
              engineRef.current.hoverCell?.col === c &&
              engineRef.current.hoverCell?.row === r
            ) {
              engineRef.current.hoverCell = null;
            }
          });
          cell.on("pointertap", () => {
            if (dragStateRef.current.moved) return;
            const cur = propsRef.current;
            if (!cur.isHumanTurn) return;

            const exactValid = cur.validMoves.some(
              (m) => m.pos.col === c && m.pos.row === r
            );
            if (exactValid) {
              cur.onCellClick({ col: c, row: r });
              return;
            }

            if (cur.selectedPlayerId) {
              let bestMoveDist = 1.25;
              let bestMovePos: Position | null = null;
              for (const mv of cur.validMoves) {
                const d = Math.hypot(mv.pos.col - c, mv.pos.row - r);
                if (d < bestMoveDist) {
                  bestMoveDist = d;
                  bestMovePos = mv.pos;
                }
              }

              let bestPassDist = 1.15;
              let bestPassId: string | null = null;
              for (const ps of cur.validPasses) {
                const d = Math.hypot(ps.pos.col - c, ps.pos.row - r);
                if (d < bestPassDist) {
                  bestPassDist = d;
                  bestPassId = ps.targetPlayerId;
                }
              }

              if (bestPassId && bestPassDist <= bestMoveDist) {
                cur.onPassToPlayer(bestPassId);
                return;
              }
              if (bestMovePos) {
                cur.onCellClick(bestMovePos);
                return;
              }
            }

            const ownNear = cur.players
              .filter((pl) => pl.team === cur.currentTurn)
              .map((pl) => ({ pl, d: Math.hypot(pl.pos.col - c, pl.pos.row - r) }))
              .filter((x) => x.d <= 1.15)
              .sort((a, b) => a.d - b.d)[0];
            if (ownNear) {
              cur.onSelectPlayer(ownNear.pl.id);
              return;
            }

            cur.onCellClick({ col: c, row: r });
          });
          hitLayer.addChild(cell);
        }
      }

      // Isometric Goal Hitboxes (Left & Right)
      const addGoalHitboxes = (isRight: boolean) => {
        const c0 = isRight ? PITCH_COLS : -1.5;
        const c1 = isRight ? PITCH_COLS + 1.5 : 0;
        for (const gRow of GOAL_ROWS) {
          const p0 = gridPoint(c0, gRow);
          const p1 = gridPoint(c1, gRow);
          const p2 = gridPoint(c1, gRow + 1);
          const p3 = gridPoint(c0, gRow + 1);
          const gBox = new PIXI.Graphics();
          gBox
            .poly([p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y])
            .fill({ color: 0x000000, alpha: 0.001 });
          gBox.eventMode = "static";
          gBox.cursor = "pointer";
          gBox.on("pointertap", () => {
            const cur = propsRef.current;
            if (!cur.isHumanTurn) return;
            const active = cur.players.find((pl) => pl.id === cur.selectedPlayerId);
            if (!active) return;
            const expectedRight = active.team === "blue";
            if (expectedRight !== isRight) return;
            if (cur.validShots.some((s) => s.goalRow === gRow)) {
              cur.onShootGoal(gRow);
            }
          });
          hitLayer.addChild(gBox);
        }
      };
      addGoalHitboxes(false);
      addGoalHitboxes(true);

      worldContainer.addChild(
        pitchSprite,
        ambientGfx,
        obstaclesLayer,
        hintsLayer,
        hintLabelsLayer,
        hoverPreviewLayer,
        hoverCursor,
        hitLayer,
        flagsLayer,
        ghostsLayer,
        playersLayer,
        selectedArrow,
        ballShadow,
        ballSprite,
        particlesLayer,
        hoverPreviewTag,
        calloutsLayer
      );

      const startBall = cellCenter(propsRef.current.ball.pos);
      ballSprite.x = startBall.x;
      ballSprite.y = startBall.y;

      engineRef.current = {
        app,
        worldContainer,
        crtHandle,
        pitchSprite,
        ambientGfx,
        ambientMotes,
        flagsLayer,
        obstaclesLayer,
        hintsLayer,
        hintLabelsLayer,
        hoverCursor,
        hoverPreviewLayer,
        hoverPreviewTag,
        hoverPreviewText,
        hoverPreviewBg,
        selectedArrow,
        playersLayer,
        ghostsLayer,
        ballShadow,
        ballSprite,
        ballFrames,
        ballFlightAnim: null,
        particlesLayer,
        calloutsLayer,
        particles: [],
        callouts: [],
        playerVisuals: new Map(),
        ballTarget: startBall,
        shakeTime: 0,
        goalFlashTime: 0,
        coneTex: createConeTexture(),
        lastPitchType: null,
        lastProgressionSig: "",
        lastFlightNonce: 0,
        lastCalloutId: "",
        hoverCell: null,
        baseFitScale: 1,
        camZoom: 1.42,
        camX: WORLD_W / 2,
        camY: WORLD_H / 2,
        camRot: 0,
        camSkewX: 0,
        camTiltY: 1,
      };

      syncScene();

      const fitCanvas = () => {
        if (!containerEl || !appInstance || !engineRef.current) return;
        const rect = containerEl.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const scale = Math.min(rect.width / WORLD_W, rect.height / WORLD_H);
        appInstance.renderer.resize(WORLD_W * scale, WORLD_H * scale);
        appInstance.stage.filterArea = appInstance.screen;
        engineRef.current.baseFitScale = scale;
      };

      const fitCanvasAfterRotate = () => {
        fitCanvas();
        window.setTimeout(fitCanvas, 80);
      };

      fitCanvasRef.current = fitCanvasAfterRotate;
      fitCanvas();
      resizeObs = new ResizeObserver(fitCanvas);
      resizeObs.observe(containerEl);
      window.addEventListener("resize", fitCanvasRef.current);
      window.addEventListener("orientationchange", fitCanvasRef.current);

      let globalClock = 0;
      app.ticker.add((ticker) => {
        const eng = engineRef.current;
        if (!eng) return;
        const dt = ticker.deltaTime;
        globalClock += dt * 0.06;

        if (eng.crtHandle && crtEnabledRef.current) {
          eng.crtHandle.setTime(globalClock);
        }

        // 1. Animate 2.5D Isometric Pitch Surface & Stadium Atmosphere
        const pType = propsRef.current.pitchType;
        eng.ambientGfx.clear();

        // Diagonal Floodlight Shimmer Sweep in Isometric Coordinates
        const sweepCol = ((globalClock * 1.4) % (PITCH_COLS + 6)) - 3;
        if (sweepCol > -2 && sweepCol < PITCH_COLS) {
          const bandCol = pType === "ice" ? 0xe0f2fe : pType === "sand" ? 0xfef3c7 : 0xbbf7d0;
          const sc0 = Math.max(0, sweepCol);
          const sc1 = Math.min(PITCH_COLS, sweepCol + 1.6);
          if (sc1 > sc0) {
            const p0 = gridPoint(sc0, 0);
            const p1 = gridPoint(sc1, 0);
            const p2 = gridPoint(sc1, PITCH_ROWS);
            const p3 = gridPoint(sc0, PITCH_ROWS);
            eng.ambientGfx
              .poly([p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y])
              .fill({ color: bandCol, alpha: pType === "ice" ? 0.08 : 0.045 });
          }
        }

        // Stadium Camera Flashes on Upper Bleachers
        for (let f = 0; f < 3; f++) {
          const flashWave = Math.sin(globalClock * 3.8 + f * 2.1);
          if (flashWave > 0.96) {
            const fc = ((Math.floor(globalClock * 2) + f * 11) * 3.7) % PITCH_COLS;
            const fp = gridPoint(fc, -1.25);
            eng.ambientGfx
              .circle(fp.x, fp.y - 24, 3.5)
              .fill({ color: 0xffffff, alpha: 0.85 });
          }
        }

        const moteColor =
          pType === "ice" ? 0xe0f2fe : pType === "sand" ? 0xfde68a : 0x86efac;
        for (const m of eng.ambientMotes) {
          const speedMult = pType === "sand" ? 1.5 : pType === "ice" ? 0.65 : 0.45;
          m.col += m.vc * speedMult * dt;
          m.row += m.vr * speedMult * dt;
          if (m.col > PITCH_COLS) m.col = 0;
          if (m.row < 0) m.row = PITCH_ROWS;
          if (m.row > PITCH_ROWS) m.row = 0;

          const mp = gridPoint(m.col, m.row);
          const twinkle = 0.25 + 0.35 * Math.sin(globalClock * 2.2 + m.phase);
          if (twinkle > 0.15) {
            eng.ambientGfx
              .rect(Math.round(mp.x), Math.round(mp.y), m.size, pType === "ice" ? 1 : m.size)
              .fill({ color: moteColor, alpha: twinkle * 0.55 });
          }
        }

        if (pType === "obstacles") {
          const pulse = 0.5 + 0.5 * Math.sin(globalClock * 3);
          for (const obs of getPitchObstacles(pType)) {
            const quad = cellQuad(obs.col, obs.row, 0.08 + pulse * 0.06);
            eng.ambientGfx
              .poly(quad)
              .stroke({ color: 0xf97316, width: 1.4, alpha: 0.28 + pulse * 0.25 });
          }
        }

        if (eng.goalFlashTime > 0) {
          eng.goalFlashTime = Math.max(0, eng.goalFlashTime - dt);
          const flashAlpha = (Math.sin(eng.goalFlashTime * 0.8) * 0.5 + 0.5) * 0.58;
          const isBlueGoal = propsRef.current.goalCelebrationTeam === "blue";
          const gc0 = isBlueGoal ? PITCH_COLS : -1.45;
          const gc1 = isBlueGoal ? PITCH_COLS + 1.45 : 0;
          const r0 = GOAL_ROWS[0];
          const r1 = GOAL_ROWS[GOAL_ROWS.length - 1] + 1;
          const gp0 = gridPoint(gc0, r0);
          const gp1 = gridPoint(gc1, r0);
          const gp2 = gridPoint(gc1, r1);
          const gp3 = gridPoint(gc0, r1);
          eng.ambientGfx
            .poly([gp0.x, gp0.y, gp1.x, gp1.y, gp2.x, gp2.y, gp3.x, gp3.y])
            .fill({
              color: isBlueGoal ? 0x60a5fa : 0xf87171,
              alpha: flashAlpha,
            });
        }

        // 2. Depth-sort 2.5D Footballers relative to camera rotation, Animate Sprints, Hops & Trails
        const sinRot = Math.sin(eng.camRot);
        const cosRot = Math.cos(eng.camRot);
        const viewFlip = cosRot >= 0 ? 1 : -1;

        eng.playersLayer.children.sort(
          (a, b) => a.x * sinRot + a.y * cosRot - (b.x * sinRot + b.y * cosRot)
        );
        eng.playerVisuals.forEach((vis, id) => {
          const dx = vis.tx - vis.container.x;
          const dy = vis.ty - vis.container.y;
          const dist = Math.hypot(dx, dy);

          vis.container.x += dx * Math.min(1, 0.24 * dt);
          vis.container.y += dy * Math.min(1, 0.24 * dt);
          vis.container.rotation = -eng.camRot;

          const isMoving = dist > 1.8;
          vis.animClock += dt * (isMoving ? 0.34 : 0.06);

          if (vis.kickBoost > 0) {
            vis.kickBoost = Math.max(0, vis.kickBoost - 0.07 * dt);
          }

          if (isMoving) {
            const frameIdx = Math.floor(vis.animClock) % vis.frames.run.length;
            vis.sprite.texture = vis.frames.run[frameIdx];
            vis.sprite.y = -Math.abs(Math.sin(vis.animClock * 1.4)) * 4;

            vis.ghostCooldown -= dt;
            if (dist > 14 && vis.ghostCooldown <= 0) {
              vis.ghostCooldown = 2.6;
              const ghost = new PIXI.Sprite(vis.sprite.texture);
              ghost.anchor.set(0.5, 0.84);
              ghost.width = 36;
              ghost.height = 44;
              ghost.scale.x = vis.facing * viewFlip * (36 / 30);
              ghost.rotation = -eng.camRot;
              ghost.alpha = 0.32;
              ghost.x = vis.container.x;
              ghost.y = vis.container.y + vis.sprite.y * cosRot;
              eng.ghostsLayer.addChild(ghost);
              eng.particles.push({
                gfx: ghost as unknown as PIXI.Graphics,
                vx: 0,
                vy: 0,
                life: 0,
                maxLife: 11,
              });
            }
          } else {
            const isSel = propsRef.current.selectedPlayerId === id;
            const frameIdx =
              Math.floor(vis.animClock * (isSel ? 1.8 : 1)) % vis.frames.idle.length;
            vis.sprite.texture = vis.frames.idle[frameIdx];
            vis.sprite.y = isSel ? -Math.abs(Math.sin(globalClock * 4.5)) * 2.5 : 0;
          }

          const stretch = 1 + vis.kickBoost * 0.14;
          vis.sprite.scale.x = vis.facing * viewFlip * (36 / 30);
          vis.sprite.scale.y = (44 / 36) * stretch;
        });

        // Counter-rotate corner flags, cones, and hint labels to keep 2.5D elements upright
        for (const ch of eng.flagsLayer.children) ch.rotation = -eng.camRot;
        for (const ch of eng.obstaclesLayer.children) ch.rotation = -eng.camRot;
        for (const ch of eng.hintLabelsLayer.children) ch.rotation = -eng.camRot;

        // 3. Ball Airborne Parabolic Flight Arc + Dynamic Ground Shadow + Spin
        eng.ballShadow.clear();
        let bx = eng.ballSprite.x;
        let by = eng.ballSprite.y;
        let loft = 0;
        let spinning = false;

        if (eng.ballFlightAnim) {
          const fa = eng.ballFlightAnim;
          fa.progress += dt / fa.duration;
          const t = Math.min(1, fa.progress);
          const groundX = fa.fromX + (fa.toX - fa.fromX) * t;
          const groundY = fa.fromY + (fa.toY - fa.fromY) * t;
          loft = Math.sin(t * Math.PI) * fa.peakHeight;
          bx = groundX + sinRot * loft;
          by = groundY - cosRot * loft;
          spinning = true;

          const trailDot = new PIXI.Graphics();
          trailDot.rect(-2, -2, 4, 4).fill({ color: fa.trailColor });
          trailDot.x = bx;
          trailDot.y = by;
          eng.particlesLayer.addChild(trailDot);
          eng.particles.push({ gfx: trailDot, vx: 0, vy: 0.18 * cosRot, life: 0, maxLife: 13 });

          eng.ballShadow
            .ellipse(groundX, groundY + 4 * cosRot, Math.max(4, 9 - loft * 0.08), 3.5)
            .fill({ color: 0x000000, alpha: Math.max(0.18, 0.42 - loft * 0.004) });

          if (t >= 1) {
            eng.ballFlightAnim = null;
          }
        } else {
          const bdx = eng.ballTarget.x - eng.ballSprite.x;
          const bdy = eng.ballTarget.y - eng.ballSprite.y;
          const ballDist = Math.hypot(bdx, bdy);
          bx = eng.ballSprite.x + bdx * Math.min(1, 0.34 * dt);
          by = eng.ballSprite.y + bdy * Math.min(1, 0.34 * dt);
          spinning = ballDist > 1.5;

          const bounceHop = spinning ? Math.abs(Math.sin(globalClock * 12)) * 3 : 0;
          eng.ballShadow
            .ellipse(bx, by + 4 * cosRot, 8, 3.2)
            .fill({ color: 0x000000, alpha: 0.38 });
          bx += sinRot * bounceHop;
          by -= cosRot * bounceHop;
        }

        eng.ballSprite.x = bx;
        eng.ballSprite.y = by;
        eng.ballSprite.rotation = -eng.camRot;
        const ballScaleBoost = 1 + loft * 0.011;
        eng.ballSprite.width = 18 * ballScaleBoost;
        eng.ballSprite.height = 18 * ballScaleBoost;

        if (spinning) {
          const bf = Math.floor(globalClock * 8) % eng.ballFrames.length;
          eng.ballSprite.texture = eng.ballFrames[bf];
        } else {
          eng.ballSprite.texture = eng.ballFrames[0];
        }

        // 4. Isometric Hover Cursor + Trajectory & Outcome Preview
        eng.hoverCursor.clear();
        eng.hoverPreviewLayer.clear();
        eng.hoverPreviewTag.visible = false;

        if (eng.hoverCell && propsRef.current.isHumanTurn) {
          const hq = cellQuad(eng.hoverCell.col, eng.hoverCell.row, 0.02);
          eng.hoverCursor.poly(hq).stroke({ color: 0xffffff, width: 2, alpha: 0.85 });

          const curProps = propsRef.current;
          const selP = curProps.players.find((pl) => pl.id === curProps.selectedPlayerId);
          if (selP) {
            const hoveredMove = curProps.validMoves.find(
              (m) => m.pos.col === eng.hoverCell!.col && m.pos.row === eng.hoverCell!.row
            );
            const hoveredPass = curProps.validPasses.find(
              (ps) => ps.pos.col === eng.hoverCell!.col && ps.pos.row === eng.hoverCell!.row
            );
            if (hoveredMove || hoveredPass) {
              const fromPt = cellCenter(selP.pos);
              const toPt = cellCenter(eng.hoverCell);
              const lineColor = hoveredPass
                ? hoveredPass.isLob
                  ? 0xc084fc
                  : 0xfbbf24
                : hoveredMove?.kind === "clash"
                ? 0xf97316
                : hoveredMove?.isSlide
                ? 0x38bdf8
                : 0x4ade80;

              eng.hoverPreviewLayer
                .moveTo(fromPt.x, fromPt.y)
                .lineTo(toPt.x, toPt.y)
                .stroke({ color: lineColor, width: 3, alpha: 0.9 });
              eng.hoverPreviewLayer
                .ellipse(toPt.x, toPt.y, 7, 4)
                .fill({ color: lineColor, alpha: 0.92 });

              const labelText = hoveredPass
                ? hoveredPass.isLob
                  ? "НАВЕС"
                  : "ПАС"
                : hoveredMove?.kind === "clash"
                ? `СТЫК ${hoveredMove.complexity?.size ?? 3}×${hoveredMove.complexity?.size ?? 3}`
                : hoveredMove?.kind === "pickup"
                ? "ПОДБОР"
                : hoveredMove?.isSlide
                ? "ЛЁД +"
                : "ХОД";

              eng.hoverPreviewText.text = labelText;
              const pillW = Math.max(44, labelText.length * 7 + 12);
              eng.hoverPreviewBg.clear();
              eng.hoverPreviewBg
                .rect(-pillW / 2, -9, pillW, 18)
                .fill({ color: 0x090d16, alpha: 0.92 })
                .stroke({ color: lineColor, width: 1.5 });
              eng.hoverPreviewTag.x = Math.max(46, Math.min(WORLD_W - 46, toPt.x - sinRot * 26));
              eng.hoverPreviewTag.y = Math.max(22, Math.min(WORLD_H - 22, toPt.y - cosRot * 26));
              eng.hoverPreviewTag.rotation = -eng.camRot;
              eng.hoverPreviewTag.visible = true;
            }
          }
        }

        // 4b. Classic Blue Downward Triangle Marker above Selected Player (matching screenshot!)
        eng.selectedArrow.clear();
        const selId = propsRef.current.selectedPlayerId;
        if (selId) {
          const selVis = eng.playerVisuals.get(selId);
          if (selVis) {
            const bob = Math.sin(globalClock * 6) * 3.0;
            const ay = -46 + bob;
            const arrowCol = propsRef.current.superDriveReady ? 0xfde047 : 0x2563eb;
            eng.selectedArrow.x = selVis.container.x;
            eng.selectedArrow.y = selVis.container.y;
            eng.selectedArrow.rotation = -eng.camRot;
            eng.selectedArrow
              .moveTo(0, ay + 7)
              .lineTo(-7, ay - 3)
              .lineTo(7, ay - 3)
              .closePath()
              .fill({ color: arrowCol })
              .stroke({ color: 0xffffff, width: 1.5 });
          }
        }

        // 5. Particles & Ghost Trails update
        for (let i = eng.particles.length - 1; i >= 0; i--) {
          const pt = eng.particles[i];
          pt.life += dt;
          pt.gfx.x += pt.vx * dt;
          pt.gfx.y += pt.vy * dt;
          pt.gfx.alpha = Math.max(0, (1 - pt.life / pt.maxLife) * 0.85);
          if (pt.life >= pt.maxLife) {
            pt.gfx.parent?.removeChild(pt.gfx);
            pt.gfx.destroy();
            eng.particles.splice(i, 1);
          }
        }

        // 6. Floating World-Space Tactical Callouts update (upright in screen space)
        for (let i = eng.callouts.length - 1; i >= 0; i--) {
          const co = eng.callouts[i];
          co.life += dt;
          co.container.rotation = -eng.camRot;
          co.container.x += sinRot * 0.45 * dt;
          co.container.y -= cosRot * 0.45 * dt;
          co.container.alpha =
            co.life > co.maxLife * 0.65
              ? Math.max(0, 1 - (co.life - co.maxLife * 0.65) / (co.maxLife * 0.35))
              : 1;
          if (co.life >= co.maxLife) {
            eng.calloutsLayer.removeChild(co.container);
            co.container.destroy({ children: true });
            eng.callouts.splice(i, 1);
          }
        }

        // 7. Camera Angle Preset + Smooth Pivot Zoom/Tilt/Rotate + Follow
        const presetCfg = CAMERA_PRESET_META[presetRef.current];
        const targetZoom = Math.max(0.95, Math.min(2.5, presetCfg.zoom + zoomOffsetRef.current));
        eng.camZoom += (targetZoom - eng.camZoom) * Math.min(1, 0.14 * dt);

        // Angular interpolation
        eng.camRot += (presetCfg.rot - eng.camRot) * Math.min(1, 0.14 * dt);
        eng.camSkewX += (presetCfg.skewX - eng.camSkewX) * Math.min(1, 0.14 * dt);
        eng.camTiltY += (presetCfg.tiltY - eng.camTiltY) * Math.min(1, 0.14 * dt);

        const sel = propsRef.current.players.find(
          (pl) => pl.id === propsRef.current.selectedPlayerId
        );
        const carrier = propsRef.current.ball.carrierId
          ? propsRef.current.players.find((pl) => pl.id === propsRef.current.ball.carrierId)
          : null;

        let desiredCamX = WORLD_W / 2 + panOffsetRef.current.x;
        let desiredCamY = WORLD_H / 2 + panOffsetRef.current.y;

        if (presetRef.current === "close") {
          const focusPt = sel ? cellCenter(sel.pos) : eng.ballTarget;
          desiredCamX = focusPt.x + panOffsetRef.current.x;
          desiredCamY = focusPt.y + panOffsetRef.current.y;
        } else if (presetRef.current === "tv" || targetZoom > 1.25) {
          const targetPt = carrier
            ? cellCenter(carrier.pos)
            : sel
            ? cellCenter(sel.pos)
            : eng.ballTarget;
          // Subtle TV broadcast blend between center & ball action
          desiredCamX =
            WORLD_W / 2 * 0.25 + targetPt.x * 0.75 + panOffsetRef.current.x;
          desiredCamY =
            WORLD_H / 2 * 0.25 + targetPt.y * 0.75 + panOffsetRef.current.y;
        }

        const halfViewW = Math.min(WORLD_W / 2, WORLD_W / (2 * Math.max(1, eng.camZoom)));
        const halfViewH = Math.min(WORLD_H / 2, WORLD_H / (2 * Math.max(1, eng.camZoom)));
        const clampedX = Math.max(halfViewW, Math.min(WORLD_W - halfViewW, desiredCamX));
        const clampedY = Math.max(halfViewH, Math.min(WORLD_H - halfViewH, desiredCamY));

        eng.camX += (clampedX - eng.camX) * Math.min(1, 0.15 * dt);
        eng.camY += (clampedY - eng.camY) * Math.min(1, 0.15 * dt);

        let shakeX = 0;
        let shakeY = 0;
        if (eng.shakeTime > 0) {
          eng.shakeTime = Math.max(0, eng.shakeTime - dt);
          const mag = (eng.shakeTime / 24) * 6;
          shakeX = (Math.random() - 0.5) * mag * 2;
          shakeY = (Math.random() - 0.5) * mag * 2;
        }

        const totalScale = eng.baseFitScale * eng.camZoom;
        eng.worldContainer.pivot.set(eng.camX, eng.camY);
        eng.worldContainer.position.set(
          (WORLD_W / 2) * eng.baseFitScale + shakeX,
          (WORLD_H / 2) * eng.baseFitScale + shakeY
        );
        eng.worldContainer.scale.set(totalScale, totalScale * eng.camTiltY);
        eng.worldContainer.rotation = eng.camRot;
        eng.worldContainer.skew.set(eng.camSkewX, 0);

        // 8. Always-visible Live Tactical Radar Minimap (Bottom-Right like Win95 Football)
        const mm = minimapCanvasRef.current;
        if (mm) {
          const mctx = mm.getContext("2d");
          if (mctx) {
            const mw = mm.width;
            const mh = mm.height;
            mctx.fillStyle = "#166534";
            mctx.fillRect(0, 0, mw, mh);
            mctx.strokeStyle = "rgba(255,255,255,0.85)";
            mctx.lineWidth = 1;
            mctx.strokeRect(2, 2, mw - 4, mh - 4);
            mctx.beginPath();
            mctx.moveTo(mw / 2, 2);
            mctx.lineTo(mw / 2, mh - 2);
            mctx.stroke();
            mctx.beginPath();
            mctx.arc(mw / 2, mh / 2, 9, 0, Math.PI * 2);
            mctx.stroke();
            mctx.strokeRect(2, mh * 0.25, 13, mh * 0.5);
            mctx.strokeRect(mw - 15, mh * 0.25, 13, mh * 0.5);

            for (const pl of propsRef.current.players) {
              const px = ((pl.pos.col + 0.5) / PITCH_COLS) * mw;
              const py = ((pl.pos.row + 0.5) / PITCH_ROWS) * mh;
              mctx.fillStyle =
                pl.id === propsRef.current.selectedPlayerId
                  ? "#fde047"
                  : pl.team === "blue"
                  ? "#ffffff"
                  : "#ef4444";
              mctx.fillRect(Math.round(px - 2), Math.round(py - 2), 4, 4);
            }
            const bxMm = ((propsRef.current.ball.pos.col + 0.5) / PITCH_COLS) * mw;
            const byMm = ((propsRef.current.ball.pos.row + 0.5) / PITCH_ROWS) * mh;
            mctx.fillStyle = "#facc15";
            mctx.fillRect(Math.round(bxMm - 2.5), Math.round(byMm - 2.5), 5, 5);

            if (eng.camZoom > 1.08) {
              const vx = ((eng.camX - halfViewW) / WORLD_W) * mw;
              const vy = ((eng.camY - halfViewH) / WORLD_H) * mh;
              const vw = ((halfViewW * 2) / WORLD_W) * mw;
              const vh = ((halfViewH * 2) / WORLD_H) * mh;
              mctx.strokeStyle = "rgba(253, 224, 71, 0.85)";
              mctx.strokeRect(vx, vy, vw, vh);
            }
          }
        }
      });
    };

    bootPixi();

    return () => {
      cancelled = true;
      if (resizeObs) resizeObs.disconnect();
      window.removeEventListener("resize", fitCanvasRef.current);
      window.removeEventListener("orientationchange", fitCanvasRef.current);
      if (appInstance) {
        appInstance.destroy(true, { children: true });
      }
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    syncScene();
  }, [
    props.players,
    props.ball,
    props.pitchType,
    props.progression,
    props.currentTurn,
    props.isHumanTurn,
    props.selectedPlayerId,
    props.validMoves,
    props.validPasses,
    props.validShots,
    props.coachHint,
    props.showCoachHint,
    props.lastMoveTrace,
    props.ballFlight,
    props.floatingCallout,
    props.superDriveReady,
  ]);

  useEffect(() => {
    panOffsetRef.current = { x: 0, y: 0 };
  }, [props.selectedPlayerId, activePreset]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const lower = e.key.toLowerCase();
      if (lower === "z") {
        setCameraPreset(presetRef.current === "close" ? "wide" : "close");
      } else if (lower === "v") {
        const idx = CAMERA_PRESET_ORDER.indexOf(presetRef.current);
        const next = CAMERA_PRESET_ORDER[(idx + 1) % CAMERA_PRESET_ORDER.length];
        setCameraPreset(next);
      } else if (lower === "r") {
        panOffsetRef.current = { x: 0, y: 0 };
        setZoomOffset(0);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const onlineCount = props.onlineCount ?? 1;

  return (
    <div className="relative z-0 w-full h-full flex items-center justify-center bg-[#070c14] pt-[46px] select-none [container-type:size]">
      {/* Full-Interior 2.5D Stadium Canvas inside WINDOWS 95 FOOTBALL Window */}
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{
          width: `min(100cqw, calc(100cqh * ${WORLD_W} / ${WORLD_H}))`,
          aspectRatio: `${WORLD_W} / ${WORLD_H}`,
        }}
      >
        <div
          ref={hostRef}
          onWheel={(e) => {
            setZoomOffset((prev) =>
              Math.max(-0.4, Math.min(0.95, prev + (e.deltaY < 0 ? 0.18 : -0.18)))
            );
          }}
          onPointerDown={(e) => {
            dragStateRef.current = {
              active: true,
              startX: e.clientX,
              startY: e.clientY,
              basePanX: panOffsetRef.current.x,
              basePanY: panOffsetRef.current.y,
              moved: false,
            };
          }}
          onPointerMove={(e) => {
            const ds = dragStateRef.current;
            if (!ds.active) return;
            const dx = e.clientX - ds.startX;
            const dy = e.clientY - ds.startY;
            if (Math.hypot(dx, dy) > 8) {
              ds.moved = true;
            }
            if (ds.moved && engineRef.current) {
              const eng = engineRef.current;
              const scale = eng.baseFitScale * eng.camZoom || 1;
              const cr = Math.cos(-eng.camRot);
              const sr = Math.sin(-eng.camRot);
              const vx = -dx / scale;
              const vy = -dy / scale;
              const wdx = vx * cr - vy * sr;
              const wdy = vx * sr + vy * cr;
              panOffsetRef.current = {
                x: Math.max(-440, Math.min(440, ds.basePanX + wdx)),
                y: Math.max(-440, Math.min(440, ds.basePanY + wdy)),
              };
            }
          }}
          onPointerUp={() => {
            dragStateRef.current.active = false;
            window.setTimeout(() => {
              dragStateRef.current.moved = false;
            }, 40);
          }}
          onPointerCancel={() => {
            dragStateRef.current.active = false;
            dragStateRef.current.moved = false;
          }}
          className="w-full h-full relative touch-none"
        />

        {crtEnabled ? (
          <div className="crt-animated-overlay absolute inset-0 z-10" />
        ) : (
          <div className="crt-scanlines absolute inset-0 pointer-events-none opacity-15" />
        )}
      </div>

      {/* Camera Angle Switcher — Centered at Top below Win95 Menu Bar */}
      {!props.hideHudWidgets && (
        <div className="fixed top-[50px] left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center justify-center gap-1 max-w-[96vw]">
          <div className="pc-window p-0.5 flex items-center gap-0.5">
            <span className="hidden md:flex items-center gap-1 px-1.5 text-[10px] font-bold text-[#000080]">
              <Camera className="w-3 h-3" />
              <span>Ракурс:</span>
            </span>
            {CAMERA_PRESET_ORDER.map((preset) => {
              const cfg = CAMERA_PRESET_META[preset];
              const isAct = activePreset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCameraPreset(preset)}
                  title={cfg.title}
                  className={`h-6 px-1.5 sm:px-2 text-[10px] font-bold whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                    isAct ? "pc-btn-active" : "pc-btn"
                  }`}
                >
                  {preset === "opposite" && <Compass className="w-3 h-3 shrink-0" />}
                  <span>{cfg.shortLabel}</span>
                </button>
              );
            })}
          </div>

          <div className="pc-window p-0.5 flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setZoomOffset((z) => Math.max(-0.4, z - 0.25))}
              title="Отдалить камеру"
              className="pc-btn h-6 w-6 flex items-center justify-center cursor-pointer"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => {
                panOffsetRef.current = { x: 0, y: 0 };
                setZoomOffset(0);
              }}
              title="Сбросить смещение и центрировать камеру (R)"
              className="pc-btn h-6 px-1.5 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <LocateFixed className="w-3 h-3 text-[#000080]" />
              <span className="hidden lg:inline">Центр</span>
            </button>
            <button
              type="button"
              onClick={() => setZoomOffset((z) => Math.min(0.95, z + 0.25))}
              title="Приблизить камеру"
              className="pc-btn h-6 w-6 flex items-center justify-center cursor-pointer"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={toggleCrt}
            title={crtEnabled ? "Отключить ЭЛТ-шейдер" : "Включить ЭЛТ-монитор 90-х"}
            className={`h-7 px-2 text-[10px] font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer ${
              crtEnabled ? "pc-btn-active" : "pc-btn"
            }`}
          >
            <Monitor className="w-3 h-3" />
            <span className="hidden sm:inline">ЭЛТ</span>
          </button>
        </div>
      )}

      {/* Bottom-Right Radar Minimap + Online Counter Badge (matching Screenshot 2) */}
      {!props.hideHudWidgets && (
        <div className="hidden sm:flex fixed bottom-2 right-2 z-20 flex-col items-stretch gap-1.5">
          <div className="pc-window p-[3px]">
            <canvas
              ref={minimapCanvasRef}
              width={142}
              height={94}
              title="Тактический радар поля — нажмите, чтобы сместить камеру"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const rx = (e.clientX - rect.left) / rect.width;
                const ry = (e.clientY - rect.top) / rect.height;
                const worldTapX = rx * WORLD_W;
                const worldTapY = ry * WORLD_H;
                const sel = propsRef.current.players.find(
                  (pl) => pl.id === propsRef.current.selectedPlayerId
                );
                const baseFocus =
                  presetRef.current === "close"
                    ? sel
                      ? cellCenter(sel.pos)
                      : engineRef.current?.ballTarget ?? { x: WORLD_W / 2, y: WORLD_H / 2 }
                    : { x: WORLD_W / 2, y: WORLD_H / 2 };
                panOffsetRef.current = {
                  x: Math.max(-450, Math.min(450, worldTapX - baseFocus.x)),
                  y: Math.max(-450, Math.min(450, worldTapY - baseFocus.y)),
                };
              }}
              className="block cursor-pointer border border-black"
              style={{ imageRendering: "pixelated" }}
            />
          </div>

          <button
            type="button"
            onClick={() => props.onOpenLobby?.()}
            title="Открыть сетевое лобби и прямые трансляции"
            className="pc-window p-[2px] cursor-pointer"
          >
            <div className="pc-inset-dark px-2.5 py-1 flex items-center justify-between gap-2 text-xs text-white font-bold">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-black inline-block" />
                <span>Онлайн: {onlineCount}</span>
              </span>
              <span className="flex items-end gap-[2px] h-3" aria-hidden="true">
                <span className="w-1 h-1 bg-emerald-400" />
                <span className="w-1 h-2 bg-emerald-400" />
                <span className="w-1 h-2.5 bg-emerald-400" />
                <span className="w-1 h-3 bg-emerald-400" />
              </span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
