import React, { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import {
  BallFlightEvent,
  BallState,
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
  CELL_SIZE,
  GOAL_DEPTH,
  MARGIN_X,
  MARGIN_Y,
  PlayerAnimationFrames,
  WORLD_H,
  WORLD_W,
  createBallAnimationFrames,
  createConeTexture,
  createCornerFlagFrames,
  createPitchTexture,
  createPlayerAnimationFrames,
} from "./pixelArtTextures";
import { CRTFilterHandle, createCRTFilter } from "./crtFilter";
import { Monitor, ZoomIn, ZoomOut } from "lucide-react";

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
  x: number;
  y: number;
  vx: number;
  vy: number;
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

function cellCenter(pos: Position): { x: number; y: number } {
  return {
    x: MARGIN_X + (pos.col + 0.5) * CELL_SIZE,
    y: MARGIN_Y + (pos.row + 0.5) * CELL_SIZE,
  };
}

export const PixiPitchCanvas: React.FC<PixiPitchCanvasProps> = (props) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const [zoomed, setZoomed] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );
  const zoomRef = useRef(zoomed);
  zoomRef.current = zoomed;

  const panOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    basePanX: number;
    basePanY: number;
    moved: boolean;
  }>({ active: false, startX: 0, startY: 0, basePanX: 0, basePanY: 0, moved: false });

  const [crtEnabled, setCrtEnabled] = useState(true);
  const crtEnabledRef = useRef(true);
  crtEnabledRef.current = crtEnabled;

  const engineRef = useRef<{
    app: PIXI.Application;
    worldContainer: PIXI.Container;
    crtHandle: CRTFilterHandle | null;
    pitchSprite: PIXI.Sprite;
    ambientGfx: PIXI.Graphics;
    ambientMotes: AmbientMote[];
    obstaclesLayer: PIXI.Container;
    hintsLayer: PIXI.Graphics;
    hintLabelsLayer: PIXI.Container;
    hoverCursor: PIXI.Graphics;
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
        badge: PIXI.Text;
        passTag: PIXI.Container;
        tx: number;
        ty: number;
        facing: 1 | -1;
        animClock: number;
        ghostCooldown: number;
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
        vy: Math.sin(angle) * speed,
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
    container.x = Math.max(MARGIN_X + 52, Math.min(WORLD_W - MARGIN_X - 52, center.x));
    container.y = Math.max(MARGIN_Y + 24, center.y - 24);

    const lbl = new PIXI.Text({
      text,
      style: {
        fontFamily: "Pixelify Sans, monospace",
        fontSize: 15,
        fontWeight: "700",
        fill: color,
        stroke: { color: 0x05080f, width: 4 },
      },
    });
    lbl.anchor.set(0.5);
    container.addChild(lbl);
    eng.calloutsLayer.addChild(container);
    eng.callouts.push({ container, life: 0, maxLife: 58 });
  };

  const syncScene = () => {
    const eng = engineRef.current;
    if (!eng) return;
    const p = propsRef.current;

    // 1. Rebuild pitch background & obstacles if pitchType changed
    if (eng.lastPitchType !== p.pitchType) {
      eng.lastPitchType = p.pitchType;
      eng.pitchSprite.texture = createPitchTexture(p.pitchType);

      eng.obstaclesLayer.removeChildren();
      for (const obs of getPitchObstacles(p.pitchType)) {
        const sp = new PIXI.Sprite(eng.coneTex);
        sp.anchor.set(0.5);
        sp.width = 26;
        sp.height = 26;
        const c = cellCenter(obs);
        sp.x = c.x;
        sp.y = c.y;
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

    // 3. Update all 22 Footballers (11v11)
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
        const frames = createPlayerAnimationFrames(
          player.role,
          player.team,
          player.skinTone,
          player.team === "blue" ? p.progression.roles[player.role].appearance : undefined
        );
        const sprite = new PIXI.Sprite(frames.idle[0]);
        sprite.anchor.set(0.5, 0.56);
        sprite.width = 34;
        sprite.height = 40;

        const facing: 1 | -1 = player.team === "blue" ? 1 : -1;
        sprite.scale.x = facing * (34 / 24);

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
        badge.y = 19;

        const passTag = new PIXI.Container();
        const passBg = new PIXI.Graphics();
        passBg.rect(-15, -31, 30, 12).fill({ color: 0xfbbf24 });
        passBg.rect(-15, -31, 30, 12).stroke({ color: 0x090d16, width: 1.5 });
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
        passTxt.y = -25;
        passTag.addChild(passBg, passTxt);
        passTag.visible = false;

        container.addChild(ring, sprite, badge, passTag);

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
          badge,
          passTag,
          tx: center.x,
          ty: center.y,
          facing,
          animClock: Math.random() * 10,
          ghostCooldown: 0,
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
        const particleCol =
          p.pitchType === "ice" ? 0xbae6fd : p.pitchType === "sand" ? 0xfde68a : 0x86efac;
        spawnBurst(vis.tx, vis.ty + 10, particleCol, 4);
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

      vis.ring.clear();
      if (isSelected) {
        const selColor = p.superDriveReady && player.team === "blue" ? 0xfde047 : 0x4ade80;
        vis.ring.rect(-18, -20, 36, 38).stroke({ color: selColor, width: 2.5 });
      } else if (isPassTarget) {
        vis.ring
          .rect(-18, -20, 36, 38)
          .stroke({ color: passOpt?.isLob ? 0xc084fc : 0xfbbf24, width: 2.5 });
      } else if (isClashTarget) {
        vis.ring.rect(-18, -20, 36, 38).stroke({ color: 0xf97316, width: 2.5 });
      } else if (hasBall) {
        vis.ring.rect(-16, -18, 32, 34).stroke({ color: 0xfef08a, width: 1.5, alpha: 0.85 });
      }
    }

    // 4. Ball Target + Airborne Flight Arc
    const ballCenter = cellCenter(p.ball.pos);
    const nextBx = p.ball.carrierId ? ballCenter.x + 11 : ballCenter.x;
    const nextBy = p.ball.carrierId ? ballCenter.y + 11 : ballCenter.y;
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
        duration: p.ballFlight.isShot ? 16 : p.ballFlight.isLob ? 22 : 14,
        peakHeight: p.ballFlight.isLob
          ? Math.min(54, 18 + dist * 0.14)
          : p.ballFlight.isShot
          ? 24
          : Math.min(20, 6 + dist * 0.05),
        trailColor: p.ballFlight.isShot ? 0x4ade80 : p.ballFlight.isLob ? 0xc084fc : 0xfbbf24,
      };
    }

    // 5. Floating World Callout
    if (p.floatingCallout && p.floatingCallout.id !== eng.lastCalloutId) {
      eng.lastCalloutId = p.floatingCallout.id;
      spawnCallout(p.floatingCallout.pos, p.floatingCallout.text, p.floatingCallout.color);
    }

    // 6. Redraw Hints & Trajectories on 32x32 grid
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
        const x = MARGIN_X + mv.pos.col * CELL_SIZE + 2;
        const y = MARGIN_Y + mv.pos.row * CELL_SIZE + 2;
        const w = CELL_SIZE - 4;

        if (mv.kind === "clash") {
          eng.hintsLayer.rect(x, y, w, w).fill({ color: 0xf59e0b, alpha: 0.34 });
          eng.hintsLayer.rect(x, y, w, w).stroke({ color: 0xfde047, width: 2.2 });
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
          tag.x = x + w / 2;
          tag.y = y - 6;
          eng.hintLabelsLayer.addChild(tag);
        } else if (mv.kind === "pickup") {
          eng.hintsLayer.rect(x, y, w, w).fill({ color: 0x34d399, alpha: 0.32 });
          eng.hintsLayer.rect(x, y, w, w).stroke({ color: 0x6ee7b7, width: 2.2 });
        } else {
          const col = mv.isSlide ? 0x38bdf8 : 0x34d399;
          eng.hintsLayer.rect(x, y, w, w).fill({ color: col, alpha: 0.18 });
          const cx = x + w / 2;
          const cy = y + w / 2;
          eng.hintsLayer.rect(cx - 5, cy - 5, 10, 10).fill({ color: col, alpha: 0.9 });
          eng.hintsLayer.rect(cx - 5, cy - 5, 10, 10).stroke({ color: 0x090d16, width: 1.5 });
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
          const gx = isRight ? MARGIN_X + PITCH_COLS * CELL_SIZE : MARGIN_X - GOAL_DEPTH;
          const gy = MARGIN_Y + shot.goalRow * CELL_SIZE + 2;
          const color = shot.isContested ? 0xf59e0b : 0x22c55e;
          eng.hintsLayer.rect(gx, gy, GOAL_DEPTH, CELL_SIZE - 4).fill({ color, alpha: 0.5 });
          eng.hintsLayer.rect(gx, gy, GOAL_DEPTH, CELL_SIZE - 4).stroke({ color: 0xffffff, width: 1.5 });

          const toX = isRight ? gx + 4 : gx + GOAL_DEPTH - 4;
          const toY = gy + (CELL_SIZE - 4) / 2;
          eng.hintsLayer
            .moveTo(from.x, from.y)
            .lineTo(toX, toY)
            .stroke({ color, width: 2.5, alpha: 0.85 });

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
          lbl.x = gx + GOAL_DEPTH / 2;
          lbl.y = gy + (CELL_SIZE - 4) / 2;
          eng.hintLabelsLayer.addChild(lbl);
        }
      }

      if (p.showCoachHint && p.coachHint) {
        const origin = p.players.find((pl) => pl.id === p.coachHint?.playerId);
        if (origin) {
          const oc = cellCenter(origin.pos);
          eng.hintsLayer
            .rect(
              MARGIN_X + origin.pos.col * CELL_SIZE + 1,
              MARGIN_Y + origin.pos.row * CELL_SIZE + 1,
              CELL_SIZE - 2,
              CELL_SIZE - 2
            )
            .stroke({ color: 0x38bdf8, width: 2.5, alpha: 0.95 });

          const target = p.coachHint.targetPos
            ? cellCenter(p.coachHint.targetPos)
            : p.coachHint.goalRow !== undefined
            ? {
                x:
                  origin.team === "blue"
                    ? MARGIN_X + PITCH_COLS * CELL_SIZE + GOAL_DEPTH / 2
                    : MARGIN_X - GOAL_DEPTH / 2,
                y: MARGIN_Y + (p.coachHint.goalRow + 0.5) * CELL_SIZE,
              }
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
    eng.shakeTime = 22;
    eng.goalFlashTime = 48;
    const burstColor = props.goalCelebrationTeam === "blue" ? 0x60a5fa : 0xf87171;
    const goalX =
      props.goalCelebrationTeam === "blue"
        ? MARGIN_X + PITCH_COLS * CELL_SIZE
        : MARGIN_X;
    spawnBurst(goalX, WORLD_H / 2, burstColor, 46);
    spawnBurst(goalX, WORLD_H / 2, 0xfde047, 30);
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
        backgroundColor: 0x090e12,
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

      // Mount Old 90s CRT Monitor WebGL Shader Filter onto stage
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
        x: MARGIN_X + ((i * 197 + 31) % (PITCH_COLS * CELL_SIZE)),
        y: MARGIN_Y + ((i * 251 + 67) % (PITCH_ROWS * CELL_SIZE)),
        vx: 0.25 + (i % 5) * 0.14,
        vy: ((i % 3) - 1) * 0.08,
        phase: i * 0.7,
        size: i % 4 === 0 ? 3 : 2,
      }));

      const flagsLayer = new PIXI.Container();
      const flagFrames = createCornerFlagFrames("#ef4444");
      const corners = [
        { x: MARGIN_X, y: MARGIN_Y, flip: 1 },
        { x: MARGIN_X + PITCH_COLS * CELL_SIZE, y: MARGIN_Y, flip: -1 },
        { x: MARGIN_X, y: MARGIN_Y + PITCH_ROWS * CELL_SIZE, flip: 1 },
        { x: MARGIN_X + PITCH_COLS * CELL_SIZE, y: MARGIN_Y + PITCH_ROWS * CELL_SIZE, flip: -1 },
      ];
      corners.forEach((c) => {
        const flag = new PIXI.AnimatedSprite(flagFrames);
        flag.anchor.set(0.2, 0.9);
        flag.width = 24;
        flag.height = 26;
        flag.scale.x *= c.flip;
        flag.x = c.x;
        flag.y = c.y;
        flag.animationSpeed = 0.09;
        flag.play();
        flagsLayer.addChild(flag);
      });

      const obstaclesLayer = new PIXI.Container();
      const hintsLayer = new PIXI.Graphics();
      const hintLabelsLayer = new PIXI.Container();
      const hoverCursor = new PIXI.Graphics();
      const ghostsLayer = new PIXI.Container();
      const playersLayer = new PIXI.Container();

      const ballShadow = new PIXI.Graphics();
      const ballFrames = createBallAnimationFrames();
      const ballSprite = new PIXI.Sprite(ballFrames[0]);
      ballSprite.anchor.set(0.5);
      ballSprite.width = 18;
      ballSprite.height = 18;

      const particlesLayer = new PIXI.Container();
      const calloutsLayer = new PIXI.Container();

      const hitLayer = new PIXI.Container();
      hitLayer.eventMode = "static";
      for (let r = 0; r < PITCH_ROWS; r++) {
        for (let c = 0; c < PITCH_COLS; c++) {
          const cell = new PIXI.Graphics();
          cell
            .rect(MARGIN_X + c * CELL_SIZE, MARGIN_Y + r * CELL_SIZE, CELL_SIZE, CELL_SIZE)
            .fill({ color: 0x000000, alpha: 0.001 });
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

            // Exact cell match first
            const exactValid = cur.validMoves.some(
              (m) => m.pos.col === c && m.pos.row === r
            );
            if (exactValid) {
              cur.onCellClick({ col: c, row: r });
              return;
            }

            // Mobile/touch friendly smart snap within 1.15 cells to nearest valid move or pass
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

            // Otherwise check if user tapped near an own player (helpful on small touchscreens)
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

      const addGoalHitboxes = (isRight: boolean) => {
        const gx = isRight ? MARGIN_X + PITCH_COLS * CELL_SIZE : MARGIN_X - GOAL_DEPTH;
        for (const gRow of GOAL_ROWS) {
          const gBox = new PIXI.Graphics();
          gBox
            .rect(gx, MARGIN_Y + gRow * CELL_SIZE, GOAL_DEPTH, CELL_SIZE)
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
        hoverCursor,
        hitLayer,
        flagsLayer,
        ghostsLayer,
        playersLayer,
        ballShadow,
        ballSprite,
        particlesLayer,
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
        obstaclesLayer,
        hintsLayer,
        hintLabelsLayer,
        hoverCursor,
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
        camZoom: 1,
        camX: WORLD_W / 2,
        camY: WORLD_H / 2,
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

      fitCanvas();
      resizeObs = new ResizeObserver(fitCanvas);
      resizeObs.observe(containerEl);

      let globalClock = 0;
      app.ticker.add((ticker) => {
        const eng = engineRef.current;
        if (!eng) return;
        const dt = ticker.deltaTime;
        globalClock += dt * 0.06;

        // Update CRT Shader time for subtle flicker & sync pulse
        if (eng.crtHandle && crtEnabledRef.current) {
          eng.crtHandle.setTime(globalClock);
        }

        // 1. Animate 32x32 Pitch Surface
        const pType = propsRef.current.pitchType;
        eng.ambientGfx.clear();

        const sweepX = MARGIN_X + ((globalClock * 42) % (PITCH_COLS * CELL_SIZE + 180)) - 90;
        if (sweepX > MARGIN_X - 80 && sweepX < MARGIN_X + PITCH_COLS * CELL_SIZE) {
          const bandCol = pType === "ice" ? 0xe0f2fe : pType === "sand" ? 0xfef3c7 : 0xbbf7d0;
          eng.ambientGfx
            .rect(Math.max(MARGIN_X, sweepX), MARGIN_Y, 48, PITCH_ROWS * CELL_SIZE)
            .fill({ color: bandCol, alpha: pType === "ice" ? 0.07 : 0.04 });
        }

        const moteColor =
          pType === "ice" ? 0xe0f2fe : pType === "sand" ? 0xfde68a : 0x86efac;
        for (const m of eng.ambientMotes) {
          const speedMult = pType === "sand" ? 1.5 : pType === "ice" ? 0.65 : 0.4;
          m.x += m.vx * speedMult * dt;
          m.y += m.vy * speedMult * dt;
          if (m.x > MARGIN_X + PITCH_COLS * CELL_SIZE) m.x = MARGIN_X;
          if (m.y < MARGIN_Y) m.y = MARGIN_Y + PITCH_ROWS * CELL_SIZE;
          if (m.y > MARGIN_Y + PITCH_ROWS * CELL_SIZE) m.y = MARGIN_Y;

          const twinkle = 0.25 + 0.35 * Math.sin(globalClock * 2.2 + m.phase);
          if (twinkle > 0.15) {
            eng.ambientGfx
              .rect(Math.round(m.x), Math.round(m.y), m.size, pType === "ice" ? 1 : m.size)
              .fill({ color: moteColor, alpha: twinkle * 0.55 });
          }
        }

        if (pType === "obstacles") {
          const pulse = 0.5 + 0.5 * Math.sin(globalClock * 3);
          for (const obs of getPitchObstacles(pType)) {
            const c = cellCenter(obs);
            const r = 10 + pulse * 4;
            eng.ambientGfx
              .rect(c.x - r, c.y - r, r * 2, r * 2)
              .stroke({ color: 0xf97316, width: 1.2, alpha: 0.25 + pulse * 0.25 });
          }
        }

        if (eng.goalFlashTime > 0) {
          eng.goalFlashTime = Math.max(0, eng.goalFlashTime - dt);
          const flashAlpha = (Math.sin(eng.goalFlashTime * 0.8) * 0.5 + 0.5) * 0.55;
          const isBlueGoal = propsRef.current.goalCelebrationTeam === "blue";
          const gx = isBlueGoal ? MARGIN_X + PITCH_COLS * CELL_SIZE : MARGIN_X - GOAL_DEPTH;
          const gy = MARGIN_Y + GOAL_ROWS[0] * CELL_SIZE;
          const gh = GOAL_ROWS.length * CELL_SIZE;
          eng.ambientGfx.rect(gx, gy, GOAL_DEPTH, gh).fill({
            color: isBlueGoal ? 0x60a5fa : 0xf87171,
            alpha: flashAlpha,
          });
        }

        // 2. Depth-sort, sprint afterimage ghosts, and animate all 22 footballers
        eng.playersLayer.children.sort((a, b) => a.y - b.y);
        eng.playerVisuals.forEach((vis, id) => {
          const dx = vis.tx - vis.container.x;
          const dy = vis.ty - vis.container.y;
          const dist = Math.hypot(dx, dy);

          vis.container.x += dx * Math.min(1, 0.24 * dt);
          vis.container.y += dy * Math.min(1, 0.24 * dt);

          const isMoving = dist > 1.8;
          vis.animClock += dt * (isMoving ? 0.3 : 0.055);

          if (isMoving) {
            const frameIdx = Math.floor(vis.animClock) % vis.frames.run.length;
            vis.sprite.texture = vis.frames.run[frameIdx];

            // Kinetic sprint ghost trail on fast runs
            vis.ghostCooldown -= dt;
            if (dist > 16 && vis.ghostCooldown <= 0) {
              vis.ghostCooldown = 3;
              const ghost = new PIXI.Sprite(vis.sprite.texture);
              ghost.anchor.set(0.5, 0.56);
              ghost.width = 34;
              ghost.height = 40;
              ghost.scale.x = vis.facing * (34 / 24);
              ghost.alpha = 0.34;
              ghost.x = vis.container.x;
              ghost.y = vis.container.y;
              eng.ghostsLayer.addChild(ghost);
              eng.particles.push({
                gfx: ghost as unknown as PIXI.Graphics,
                vx: 0,
                vy: 0,
                life: 0,
                maxLife: 12,
              });
            }
          } else {
            const isSel = propsRef.current.selectedPlayerId === id;
            const frameIdx = Math.floor(vis.animClock * (isSel ? 1.8 : 1)) % vis.frames.idle.length;
            vis.sprite.texture = vis.frames.idle[frameIdx];
          }

          vis.sprite.scale.x = vis.facing * (34 / 24);
        });

        // 3. Ball Airborne Flight Arc + Shadow + Spin
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
          bx = groundX;
          by = groundY - loft;
          spinning = true;

          // Motion ribbon trail spark
          const trailDot = new PIXI.Graphics();
          trailDot.rect(-2, -2, 4, 4).fill({ color: fa.trailColor });
          trailDot.x = bx;
          trailDot.y = by;
          eng.particlesLayer.addChild(trailDot);
          eng.particles.push({ gfx: trailDot, vx: 0, vy: 0.15, life: 0, maxLife: 12 });

          eng.ballShadow
            .ellipse(groundX, groundY + 6, Math.max(4, 8 - loft * 0.08), 3)
            .fill({ color: 0x000000, alpha: 0.38 });

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

          eng.ballShadow
            .ellipse(bx, by + 6, 7, 3)
            .fill({ color: 0x000000, alpha: 0.35 });
        }

        eng.ballSprite.x = bx;
        eng.ballSprite.y = by;
        const ballScaleBoost = 1 + loft * 0.012;
        eng.ballSprite.width = 18 * ballScaleBoost;
        eng.ballSprite.height = 18 * ballScaleBoost;

        if (spinning) {
          const bf = Math.floor(globalClock * 7) % eng.ballFrames.length;
          eng.ballSprite.texture = eng.ballFrames[bf];
        } else {
          eng.ballSprite.texture = eng.ballFrames[0];
        }

        // 4. Hover pixel bracket cursor on 32x32 cell
        eng.hoverCursor.clear();
        if (eng.hoverCell && propsRef.current.isHumanTurn) {
          const hx = MARGIN_X + eng.hoverCell.col * CELL_SIZE + 1;
          const hy = MARGIN_Y + eng.hoverCell.row * CELL_SIZE + 1;
          const hw = CELL_SIZE - 2;
          const len = 7;
          eng.hoverCursor
            .moveTo(hx, hy + len).lineTo(hx, hy).lineTo(hx + len, hy)
            .moveTo(hx + hw - len, hy).lineTo(hx + hw, hy).lineTo(hx + hw, hy + len)
            .moveTo(hx, hy + hw - len).lineTo(hx, hy + hw).lineTo(hx + len, hy + hw)
            .moveTo(hx + hw - len, hy + hw).lineTo(hx + hw, hy + hw).lineTo(hx + hw, hy + hw - len)
            .stroke({ color: 0xffffff, width: 2, alpha: 0.78 });
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

        // 6. Floating World-Space Tactical Callouts update
        for (let i = eng.callouts.length - 1; i >= 0; i--) {
          const co = eng.callouts[i];
          co.life += dt;
          co.container.y -= 0.45 * dt;
          co.container.alpha = co.life > co.maxLife * 0.65
            ? Math.max(0, 1 - (co.life - co.maxLife * 0.65) / (co.maxLife * 0.35))
            : 1;
          if (co.life >= co.maxLife) {
            eng.calloutsLayer.removeChild(co.container);
            co.container.destroy({ children: true });
            eng.callouts.splice(i, 1);
          }
        }

        // 7. Camera Zoom & Smooth Follow (1x Full 32x32 Pitch or 1.85x Tactical Close-Up)
        const targetZoom = zoomRef.current ? 1.85 : 1;
        eng.camZoom += (targetZoom - eng.camZoom) * Math.min(1, 0.16 * dt);

        const sel = propsRef.current.players.find(
          (pl) => pl.id === propsRef.current.selectedPlayerId
        );
        const focusPt = sel ? cellCenter(sel.pos) : eng.ballTarget;
        const desiredCamX = zoomRef.current
          ? focusPt.x + panOffsetRef.current.x
          : WORLD_W / 2;
        const desiredCamY = zoomRef.current
          ? focusPt.y + panOffsetRef.current.y
          : WORLD_H / 2;

        const halfViewW = WORLD_W / (2 * eng.camZoom);
        const halfViewH = WORLD_H / (2 * eng.camZoom);
        const clampedX = Math.max(halfViewW, Math.min(WORLD_W - halfViewW, desiredCamX));
        const clampedY = Math.max(halfViewH, Math.min(WORLD_H - halfViewH, desiredCamY));

        eng.camX += (clampedX - eng.camX) * Math.min(1, 0.16 * dt);
        eng.camY += (clampedY - eng.camY) * Math.min(1, 0.16 * dt);

        let shakeX = 0;
        let shakeY = 0;
        if (eng.shakeTime > 0) {
          eng.shakeTime = Math.max(0, eng.shakeTime - dt);
          const mag = (eng.shakeTime / 22) * 5.5;
          shakeX = (Math.random() - 0.5) * mag * 2;
          shakeY = (Math.random() - 0.5) * mag * 2;
        }

        const totalScale = eng.baseFitScale * eng.camZoom;
        eng.worldContainer.scale.set(totalScale);
        eng.worldContainer.x = (WORLD_W / 2 - eng.camX * eng.camZoom) * eng.baseFitScale + shakeX;
        eng.worldContainer.y = (WORLD_H / 2 - eng.camY * eng.camZoom) * eng.baseFitScale + shakeY;
      });
    };

    bootPixi();

    return () => {
      cancelled = true;
      if (resizeObs) resizeObs.disconnect();
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
  }, [props.selectedPlayerId, props.ball.pos.col, props.ball.pos.row, zoomed]);

  return (
    <div className="relative w-full h-full flex items-center justify-center px-1.5 sm:px-6 pt-20 pb-24 sm:py-14 select-none">
      {/* CRT Monitor Frame around 32x32 PixiJS Pitch */}
      <div
        className="relative flex items-center justify-center pc-inset-dark p-1 sm:p-2 overflow-hidden"
        style={{
          width: "min(98vw, calc((100dvh - 180px) * 1152 / 1084))",
          aspectRatio: `${WORLD_W} / ${WORLD_H}`,
        }}
      >
        <div
          ref={hostRef}
          onWheel={(e) => {
            if (e.deltaY < 0) setZoomed(true);
            else if (e.deltaY > 0) setZoomed(false);
          }}
          onPointerDown={(e) => {
            if (!zoomRef.current) return;
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
            if (!ds.active || !zoomRef.current) return;
            const dx = e.clientX - ds.startX;
            const dy = e.clientY - ds.startY;
            if (Math.hypot(dx, dy) > 8) {
              ds.moved = true;
            }
            if (ds.moved && engineRef.current) {
              const scale = engineRef.current.baseFitScale * engineRef.current.camZoom || 1;
              panOffsetRef.current = {
                x: Math.max(-380, Math.min(380, ds.basePanX - dx / scale)),
                y: Math.max(-380, Math.min(380, ds.basePanY - dy / scale)),
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

        {/* Compact Retro Monitor Controls: CRT Shader + Camera Zoom */}
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCrtEnabled((v) => !v)}
            title={crtEnabled ? "Отключить ЭЛТ-шейдер" : "Включить ЭЛТ-монитор 90-х"}
            className={`h-7 px-2 text-[11px] font-bold flex items-center gap-1 whitespace-nowrap ${
              crtEnabled ? "pc-btn-active" : "pc-btn"
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>ЭЛТ</span>
          </button>

          <button
            type="button"
            onClick={() => setZoomed((z) => !z)}
            title={zoomed ? "Полное поле 32×32 (1×)" : "Крупный план игроков (1.8×)"}
            className="pc-btn h-7 px-2 text-[11px] font-bold flex items-center gap-1 whitespace-nowrap"
          >
            {zoomed ? (
              <>
                <ZoomOut className="w-3.5 h-3.5" />
                <span>1× Поле</span>
              </>
            ) : (
              <>
                <ZoomIn className="w-3.5 h-3.5" />
                <span>1.8× Зум</span>
              </>
            )}
          </button>
        </div>

        {/* Fallback CSS scanlines only when WebGL CRT shader is toggled off */}
        {!crtEnabled && (
          <div className="crt-scanlines absolute inset-0 pointer-events-none opacity-20" />
        )}
      </div>
    </div>
  );
};
