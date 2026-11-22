import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
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
  PlayerActionMode,
  PlayerPiece,
  Position,
  ROLE_META,
  ShotOption,
  SquadProgressionState,
  TacticalHint,
  TacticalPressureState,
  Team,
} from "../types/game";
import {
  getEnemyControlZones,
  getOffsideLineCol,
  getPitchObstacles,
} from "../engine/footballEngine";
import {
  createPitchAlbedoTexture,
  createPitchBumpTexture,
  createPitchRoughnessTexture,
  updateStadiumScoreboardTexture,
} from "../engine3d/pitchTextures3d";
import {
  Ball3D,
  GrassField3D,
  PlayerRig3D,
  StadiumArena3D,
  cellToWorldX,
  cellToWorldZ,
  createBall3D,
  createCone3D,
  createGrassField3D,
  createPlayerRig3D,
  createStadiumArena3D,
  disposeObject3D,
  getAppearanceCacheKey,
  worldXToCellCol,
  worldZToCellRow,
} from "../engine3d/models3d";
import {
  Camera,
  Compass,
  LocateFixed,
  Maximize,
  Minimize2,
  Monitor,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

const CAMERA_PRESET_META: Record<
  CameraPreset,
  { label: string; shortLabel: string; title: string; zoom: number }
> = {
  tv: {
    label: "ТВ-Эфир",
    shortLabel: "ТВ",
    title: "Динамическая 3D ТВ-камера следит за мячом (клавиша V)",
    zoom: 1.0,
  },
  wide: {
    label: "Всё поле",
    shortLabel: "Обзор",
    title: "Полный 3D стадион 32×32 целиком",
    zoom: 1.0,
  },
  close: {
    label: "Крупно",
    shortLabel: "Крупно",
    title: "Приближённая экшен-камера за игроком (клавиша Z)",
    zoom: 1.35,
  },
  topdown: {
    label: "Сверху",
    shortLabel: "Сверху",
    title: "Тактический вид сверху",
    zoom: 1.0,
  },
  opposite: {
    label: "Трибуна 180°",
    shortLabel: "180°",
    title: "Обратный ракурс с противоположной трибуны",
    zoom: 1.0,
  },
};

const CAMERA_PRESET_ORDER: CameraPreset[] = ["tv", "wide", "close", "topdown", "opposite"];

export interface ThreePitchCanvasProps {
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
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onlineCount?: number;
  onOpenLobby?: () => void;
  hideHudWidgets?: boolean;
  showExtendedHud?: boolean;
  actionMode?: PlayerActionMode | null;
  actionPoints?: number;
  pressureState?: TacticalPressureState | null;
  scoreBlue?: number;
  scoreRed?: number;
  turnCount?: number;
  onSelectPlayer: (playerId: string) => void;
  onCellClick: (pos: Position) => void;
  onPassToPlayer: (targetId: string) => void;
  onShootGoal: (goalRow: number) => void;
}

interface ActiveFlightState {
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  progress: number;
  duration: number;
  peakHeight: number;
  isShot: boolean;
  isSuperShot: boolean;
}

interface ConfettiPiece {
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  color: number;
}

interface TrailDot {
  x: number;
  y: number;
  z: number;
  life: number;
  maxLife: number;
}

// Pre-allocated scratch math helpers (zero per-frame allocations inside tick)
const _scratchVec3A = new THREE.Vector3();
const _scratchVec3B = new THREE.Vector3();
const _scratchAxis = new THREE.Vector3();
const _scratchDummy = new THREE.Object3D();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export const ThreePitchCanvas: React.FC<ThreePitchCanvasProps> = (props) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const selectedBadgeRef = useRef<HTMLDivElement | null>(null);
  const calloutBadgeRef = useRef<HTMLDivElement | null>(null);

  const propsRef = useRef(props);
  propsRef.current = props;

  const [internalPreset, setInternalPreset] = useState<CameraPreset>(props.cameraPreset ?? "tv");
  const activePreset = props.cameraPreset ?? internalPreset;
  const presetRef = useRef<CameraPreset>(activePreset);
  presetRef.current = activePreset;

  const [internalCrt, setInternalCrt] = useState<boolean>(true);
  const crtEnabled = props.crtEnabled ?? internalCrt;

  const [zoomOffset, setZoomOffset] = useState<number>(0);
  const zoomOffsetRef = useRef<number>(0);
  zoomOffsetRef.current = zoomOffset;

  const [cameraDrawerOpen, setCameraDrawerOpen] = useState(false);
  const [webglLost, setWebglLost] = useState(false);

  const panOffsetRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origPanX: number;
    origPanZ: number;
    moved: boolean;
  }>({ active: false, startX: 0, startY: 0, origPanX: 0, origPanZ: 0, moved: false });

  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStateRef = useRef<{ active: boolean; startDist: number; startZoom: number }>({
    active: false,
    startDist: 0,
    startZoom: 0,
  });

  const hoverCellRef = useRef<Position | null>(null);

  const setCameraPreset = (preset: CameraPreset) => {
    setInternalPreset(preset);
    props.onChangeCameraPreset?.(preset);
    panOffsetRef.current = { x: 0, z: 0 };
    setZoomOffset(0);
  };

  const toggleCrt = () => {
    if (props.onToggleCrt) props.onToggleCrt();
    else setInternalCrt((v) => !v);
  };

  // Runtime mutable state shared with Three.js tick loop & prop sync effects
  const runtimeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    pitchMat: THREE.MeshStandardMaterial;
    pitchTex: THREE.CanvasTexture | null;
    pitchBumpTex: THREE.CanvasTexture | null;
    pitchRoughTex: THREE.CanvasTexture | null;
    currentPitchType: PitchType | null;
    lastScoreKey: string;
    hemiLight: THREE.HemisphereLight;
    skyUniforms: {
      uTopColor: { value: THREE.Color };
      uHorizonColor: { value: THREE.Color };
      uGlowColor: { value: THREE.Color };
    };
    grassField: GrassField3D;
    arena: StadiumArena3D;
    obstaclesGroup: THREE.Group;
    tacticalGroup: THREE.Group;
    playerRigs: Map<string, PlayerRig3D>;
    ball: Ball3D;
    ballWorldPos: THREE.Vector3;
    flight: ActiveFlightState | null;
    lastFlightNonce: number;
    lastGoalTeam: Team | null;
    confettiPool: THREE.InstancedMesh;
    confettiData: ConfettiPiece[];
    trailPool: THREE.InstancedMesh;
    trailData: TrailDot[];
    hoverMesh: THREE.Mesh;
    anisotropy: number;
    syncTactical: () => void;
    syncPlayersAndPitch: () => void;
  } | null>(null);

  // Sync tactical overlays whenever moves/passes/shots/selection/turn change
  const tacticalDepsKey = `${props.selectedPlayerId}|${props.currentTurn}|${props.isHumanTurn}|${
    props.hideHudWidgets ? 1 : 0
  }|${props.actionMode ?? ""}|${props.actionPoints ?? 6}|${props.showCoachHint ? 1 : 0}|${
    props.validMoves.length
  }|${props.validPasses.length}|${props.validShots.length}|${props.coachHint?.playerId ?? ""}|${
    props.lastMoveTrace?.from.col ?? -1
  },${props.lastMoveTrace?.to.col ?? -1}`;

  useEffect(() => {
    runtimeRef.current?.syncPlayersAndPitch();
    runtimeRef.current?.syncTactical();
  }, [
    props.players,
    props.ball,
    props.pitchType,
    props.progression,
    props.superDriveReady,
    props.goalCelebrationTeam,
    props.scoreBlue,
    props.scoreRed,
    props.turnCount,
    tacticalDepsKey,
  ]);

  // Keyboard camera shortcuts (V: cycle camera, Z: toggle close/tv, R: reset pan & zoom)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) {
        return;
      }
      if (e.key === "v" || e.key === "V" || e.key === "м" || e.key === "М") {
        const idx = CAMERA_PRESET_ORDER.indexOf(presetRef.current);
        const next = CAMERA_PRESET_ORDER[(idx + 1) % CAMERA_PRESET_ORDER.length];
        setCameraPreset(next);
      } else if (e.key === "z" || e.key === "Z" || e.key === "я" || e.key === "Я") {
        setCameraPreset(presetRef.current === "close" ? "tv" : "close");
      } else if (e.key === "r" || e.key === "R" || e.key === "к" || e.key === "К") {
        panOffsetRef.current = { x: 0, z: 0 };
        setZoomOffset(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Main Three.js WebGL Engine Lifecycle
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const width = Math.max(320, host.clientWidth || window.innerWidth);
    const height = Math.max(240, host.clientHeight || window.innerHeight);

    // 1. Hardware vs Software WebGL Probe (required per threejs/SKILL.md)
    const testCanvas = document.createElement("canvas");
    const gl = testCanvas.getContext("webgl2") || testCanvas.getContext("webgl");
    const dbgInfo = gl?.getExtension("WEBGL_debug_renderer_info");
    const rendererStr = dbgInfo
      ? String(gl?.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) ?? "")
      : String(gl?.getParameter(gl.RENDERER) ?? "");
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: "high-performance",
      alpha: false,
    });
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";

    host.innerHTML = "";
    host.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglLost(true);
    };
    const onContextRestored = () => {
      setWebglLost(false);
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);

    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    // 2. Scene, Sky Atmosphere Dome, Fog & PMREM Environment
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a172b);
    scene.fog = new THREE.FogExp2(0x0a172b, 0.0105);

    const skyUniforms = {
      uTopColor: { value: new THREE.Color(0x040b18) },
      uHorizonColor: { value: new THREE.Color(0x0d2140) },
      uGlowColor: { value: new THREE.Color(0x1e3a5f) },
    };
    const skyGeo = new THREE.SphereGeometry(95, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uGlowColor;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          float band = smoothstep(0.0, 0.55, max(h, 0.0));
          float floodBand = exp(-abs(h - 0.08) * 10.0) * 0.42;
          vec3 col = mix(uHorizonColor, uTopColor, pow(band, 0.72));
          col += uGlowColor * floodBand;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyDome);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmrem.dispose();

    // 3. Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 180);
    camera.position.set(0, 22, 22);
    camera.lookAt(0, 0, 0);

    // 4. Three-Point Stadium Floodlight Rig
    const hemiLight = new THREE.HemisphereLight(0xb8e1ff, 0x164228, 0.78);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e0, 1.52);
    keyLight.position.set(16, 27, 18);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 72;
    keyLight.shadow.camera.left = -21;
    keyLight.shadow.camera.right = 21;
    keyLight.shadow.camera.top = 21;
    keyLight.shadow.camera.bottom = -21;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.024;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.58);
    rimLight.position.set(-18, 16, -20);
    scene.add(rimLight);

    // Subtle warm stadium bounce fill from opposite stand corner
    const fillLight = new THREE.DirectionalLight(0xfef3c7, 0.28);
    fillLight.position.set(-14, 14, 16);
    scene.add(fillLight);

    // 5. Pitch Plane, 3D Swaying Grass Field & Stadium Arena
    const pitchMat = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.04,
    });
    const pitchPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(PITCH_COLS, PITCH_ROWS),
      pitchMat
    );
    pitchPlane.rotation.x = -Math.PI / 2;
    pitchPlane.receiveShadow = true;
    scene.add(pitchPlane);

    const grassField = createGrassField3D();
    scene.add(grassField.mesh);

    const arena = createStadiumArena3D(anisotropy);
    scene.add(arena.group);

    const obstaclesGroup = new THREE.Group();
    scene.add(obstaclesGroup);

    const tacticalGroup = new THREE.Group();
    scene.add(tacticalGroup);

    // Hover tile ring
    const hoverMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const hoverMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92), hoverMat);
    hoverMesh.rotation.x = -Math.PI / 2;
    hoverMesh.position.y = 0.032;
    hoverMesh.visible = false;
    scene.add(hoverMesh);

    // 6. Articulated Players & Telstar Ball
    const playersGroup = new THREE.Group();
    scene.add(playersGroup);
    const playerRigs = new Map<string, PlayerRig3D>();

    const ball = createBall3D(anisotropy);
    scene.add(ball.root);

    // 7. Instanced Pools for Trail Sparks & Goal Confetti (Zero GC inside tick)
    const maxTrails = 40;
    const trailGeo = new THREE.SphereGeometry(0.11, 6, 6);
    const trailMat = new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.85 });
    const trailPool = new THREE.InstancedMesh(trailGeo, trailMat, maxTrails);
    trailPool.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(trailPool);
    const trailData: TrailDot[] = Array.from({ length: maxTrails }, () => ({
      x: 0,
      y: -20,
      z: 0,
      life: 0,
      maxLife: 0.4,
    }));

    const maxConfetti = 80;
    const confettiGeo = new THREE.BoxGeometry(0.16, 0.16, 0.04);
    const confettiMat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.2 });
    const confettiPool = new THREE.InstancedMesh(confettiGeo, confettiMat, maxConfetti);
    confettiPool.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(confettiPool);
    const confettiData: ConfettiPiece[] = Array.from({ length: maxConfetti }, () => ({
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 1.5,
      color: 0xfacc15,
    }));
    const confettiPos = Array.from({ length: maxConfetti }, () => new THREE.Vector3(0, -30, 0));

    // Shared tactical material cache for clean rendering
    const makeTileMat = (color: number, opacity: number) =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });

    const syncPlayersAndPitch = () => {
      const p = propsRef.current;

      // Update live 3D Stadium Scoreboard Jumbotron when score or turn updates
      const scoreKey = `${p.scoreBlue ?? 0}|${p.scoreRed ?? 0}|${p.turnCount ?? 1}`;
      if (runtime.lastScoreKey !== scoreKey) {
        runtime.lastScoreKey = scoreKey;
        updateStadiumScoreboardTexture(
          arena.scoreboardTexture,
          p.scoreBlue ?? 0,
          p.scoreRed ?? 0,
          p.turnCount ?? 1
        );
      }

      // Update pitch surface albedo, roughness & bump maps + stadium sky atmosphere when pitchType changes
      if (runtime.currentPitchType !== p.pitchType) {
        runtime.currentPitchType = p.pitchType;
        if (runtime.pitchTex) runtime.pitchTex.dispose();
        if (runtime.pitchBumpTex) runtime.pitchBumpTex.dispose();
        if (runtime.pitchRoughTex) runtime.pitchRoughTex.dispose();

        const nextTex = createPitchAlbedoTexture(p.pitchType, anisotropy);
        const nextBump = createPitchBumpTexture(p.pitchType, anisotropy);
        const nextRough = createPitchRoughnessTexture(p.pitchType, anisotropy);
        runtime.pitchTex = nextTex;
        runtime.pitchBumpTex = nextBump;
        runtime.pitchRoughTex = nextRough;

        pitchMat.map = nextTex;
        pitchMat.bumpMap = nextBump;
        pitchMat.roughnessMap = nextRough;
        pitchMat.bumpScale = p.pitchType === "ice" ? 0.014 : 0.052;
        pitchMat.roughness = p.pitchType === "ice" ? 0.9 : p.pitchType === "sand" ? 1.0 : 0.98;
        pitchMat.metalness = p.pitchType === "ice" ? 0.16 : 0.03;
        pitchMat.needsUpdate = true;

        grassField.recolorForPitch(p.pitchType);

        // Sync atmospheric sky dome, fog & ground bounce lighting to surface biome
        if (p.pitchType === "ice") {
          scene.background = new THREE.Color(0x0a223b);
          (scene.fog as THREE.FogExp2).color.setHex(0x0a223b);
          skyUniforms.uTopColor.value.setHex(0x051326);
          skyUniforms.uHorizonColor.value.setHex(0x0e2f4f);
          skyUniforms.uGlowColor.value.setHex(0x38bdf8);
          hemiLight.groundColor.setHex(0x60a5fa);
        } else if (p.pitchType === "sand") {
          scene.background = new THREE.Color(0x1f1624);
          (scene.fog as THREE.FogExp2).color.setHex(0x1f1624);
          skyUniforms.uTopColor.value.setHex(0x0f0b18);
          skyUniforms.uHorizonColor.value.setHex(0x2e1e2b);
          skyUniforms.uGlowColor.value.setHex(0xf59e0b);
          hemiLight.groundColor.setHex(0x7c5323);
        } else {
          scene.background = new THREE.Color(0x0a172b);
          (scene.fog as THREE.FogExp2).color.setHex(0x0a172b);
          skyUniforms.uTopColor.value.setHex(0x040b18);
          skyUniforms.uHorizonColor.value.setHex(0x0d2140);
          skyUniforms.uGlowColor.value.setHex(0x1e3a5f);
          hemiLight.groundColor.setHex(0x164228);
        }

        // Rebuild 3D training cones for obstacles pitch
        while (obstaclesGroup.children.length > 0) {
          const ch = obstaclesGroup.children[0];
          obstaclesGroup.remove(ch);
          disposeObject3D(ch);
        }
        for (const obs of getPitchObstacles(p.pitchType)) {
          const cone = createCone3D();
          cone.position.set(cellToWorldX(obs.col), 0, cellToWorldZ(obs.row));
          obstaclesGroup.add(cone);
        }
      }

      // Sync player rigs
      const activeIds = new Set(p.players.map((pl) => pl.id));
      for (const [id, rig] of playerRigs.entries()) {
        if (!activeIds.has(id)) {
          playersGroup.remove(rig.root);
          disposeObject3D(rig.root);
          playerRigs.delete(id);
        }
      }

      for (const pl of p.players) {
        const app = pl.team === "blue" ? p.progression.roles[pl.role].appearance : undefined;
        const appKey = getAppearanceCacheKey(pl, app);
        const existing = playerRigs.get(pl.id);
        if (!existing || existing.lastAppearanceKey !== appKey) {
          if (existing) {
            const prevPos = existing.root.position.clone();
            const prevRot = existing.bodyPivot.rotation.y;
            playersGroup.remove(existing.root);
            disposeObject3D(existing.root);
            const rebuilt = createPlayerRig3D(pl, app, anisotropy);
            rebuilt.root.position.copy(prevPos);
            rebuilt.bodyPivot.rotation.y = prevRot;
            playersGroup.add(rebuilt.root);
            playerRigs.set(pl.id, rebuilt);
          } else {
            const created = createPlayerRig3D(pl, app, anisotropy);
            playersGroup.add(created.root);
            playerRigs.set(pl.id, created);
          }
        }
      }

      // Trigger ball parabolic flight + kicker's 3D kick swing animation
      if (p.ballFlight && p.ballFlight.nonce !== runtime.lastFlightNonce) {
        runtime.lastFlightNonce = p.ballFlight.nonce;
        const fromX = cellToWorldX(p.ballFlight.from.col);
        const fromZ = cellToWorldZ(p.ballFlight.from.row);
        const toX = cellToWorldX(p.ballFlight.to.col);
        const toZ = cellToWorldZ(p.ballFlight.to.row);
        const dist = Math.hypot(toX - fromX, toZ - fromZ);
        runtime.flight = {
          fromX,
          fromZ,
          toX,
          toZ,
          progress: 0,
          duration: p.ballFlight.isShot ? 0.36 : Math.min(0.62, 0.24 + dist * 0.024),
          peakHeight: p.ballFlight.isLob ? 2.8 : p.ballFlight.isShot ? 1.55 : 0.75,
          isShot: p.ballFlight.isShot,
          isSuperShot: Boolean(p.ballFlight.isSuperShot),
        };

        // Find player closest to origin cell to perform 3D kick motion
        let kickerRig: PlayerRig3D | null = null;
        let bestDist = 1.65;
        for (const rig of playerRigs.values()) {
          const d = Math.hypot(rig.root.position.x - fromX, rig.root.position.z - fromZ);
          if (d < bestDist) {
            bestDist = d;
            kickerRig = rig;
          }
        }
        if (kickerRig) {
          kickerRig.kickDuration = p.ballFlight.isShot ? 0.44 : 0.36;
          kickerRig.kickTimer = kickerRig.kickDuration;
          kickerRig.kickYaw = Math.atan2(toX - fromX, toZ - fromZ);
        }
      }

      // Goal celebration confetti burst
      if (p.goalCelebrationTeam && p.goalCelebrationTeam !== runtime.lastGoalTeam) {
        runtime.lastGoalTeam = p.goalCelebrationTeam;
        const goalX = p.goalCelebrationTeam === "blue" ? 15.8 : -15.8;
        const teamPalette =
          p.goalCelebrationTeam === "blue"
            ? [0x3b82f6, 0x60a5fa, 0xfacc15, 0xffffff]
            : [0xef4444, 0xf87171, 0xfacc15, 0xffffff];
        const colObj = new THREE.Color();
        for (let i = 0; i < maxConfetti; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 2.5 + Math.random() * 5.5;
          confettiPos[i].set(goalX, 1.4 + Math.random() * 1.2, (Math.random() - 0.5) * 6);
          confettiData[i].vx = Math.cos(angle) * speed;
          confettiData[i].vy = 4.5 + Math.random() * 6.5;
          confettiData[i].vz = Math.sin(angle) * speed;
          confettiData[i].maxLife = 1.4 + Math.random() * 0.9;
          confettiData[i].life = confettiData[i].maxLife;
          confettiData[i].color = teamPalette[i % teamPalette.length];
          colObj.setHex(confettiData[i].color);
          confettiPool.setColorAt(i, colObj);
        }
        if (confettiPool.instanceColor) confettiPool.instanceColor.needsUpdate = true;
      } else if (!p.goalCelebrationTeam) {
        runtime.lastGoalTeam = null;
      }
    };

    const syncTactical = () => {
      const p = propsRef.current;

      // Clear previous tactical overlays cleanly
      while (tacticalGroup.children.length > 0) {
        const ch = tacticalGroup.children[0];
        tacticalGroup.remove(ch);
        disposeObject3D(ch);
      }

      // Reset goal slots visibility
      for (const slot of arena.goalTargetMeshes) {
        slot.mesh.visible = false;
      }

      // Last move trace ribbon
      if (p.lastMoveTrace) {
        const pts = [
          new THREE.Vector3(cellToWorldX(p.lastMoveTrace.from.col), 0.08, cellToWorldZ(p.lastMoveTrace.from.row)),
          new THREE.Vector3(cellToWorldX(p.lastMoveTrace.to.col), 0.08, cellToWorldZ(p.lastMoveTrace.to.row)),
        ];
        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const lineMat = new THREE.LineBasicMaterial({
          color: p.lastMoveTrace.team === "blue" ? 0x60a5fa : 0xf87171,
          transparent: true,
          opacity: 0.65,
        });
        tacticalGroup.add(new THREE.Line(lineGeo, lineMat));
      }

      if (p.hideHudWidgets) return;

      // Offside threshold laser line when carrier is active
      if (p.ball.carrierId) {
        const carrier = p.players.find((pl) => pl.id === p.ball.carrierId);
        if (carrier) {
          const lineCol = getOffsideLineCol(carrier.team, p.players, p.ball);
          const lx = cellToWorldX(lineCol);
          const pts = [
            new THREE.Vector3(lx, 0.06, -15.8),
            new THREE.Vector3(lx, 0.06, 15.8),
          ];
          const geo = new THREE.BufferGeometry().setFromPoints(pts);
          const mat = new THREE.LineDashedMaterial({
            color: carrier.team === "blue" ? 0x38bdf8 : 0xfb7185,
            dashSize: 0.45,
            gapSize: 0.3,
            transparent: true,
            opacity: 0.55,
          });
          const line = new THREE.Line(geo, mat);
          line.computeLineDistances();
          tacticalGroup.add(line);
        }
      }

      if (!p.isHumanTurn) return;

      const tileGeo = new THREE.PlaneGeometry(0.84, 0.84);
      const selected = p.selectedPlayerId
        ? p.players.find((pl) => pl.id === p.selectedPlayerId) ?? null
        : null;

      // Enemy Control Zones (subtle danger zones near selected player)
      if (selected) {
        const zones = getEnemyControlZones(p.currentTurn, p.players, p.pitchType);
        const zMat = makeTileMat(0xef4444, 0.16);
        for (const z of zones) {
          const dist = Math.hypot(z.col - selected.pos.col, z.row - selected.pos.row);
          if (dist > 8) continue;
          const m = new THREE.Mesh(tileGeo.clone(), zMat.clone());
          m.rotation.x = -Math.PI / 2;
          m.position.set(cellToWorldX(z.col), 0.024, cellToWorldZ(z.row));
          tacticalGroup.add(m);
        }
      }

      // Valid Moves tiles
      const modeMoveFocus = p.actionMode === "move" || p.actionMode === "tackle" || !p.actionMode;
      const moveOpacityBoost = modeMoveFocus ? 1.0 : 0.45;
      const availAp = p.actionPoints ?? 8;

      for (const mv of p.validMoves) {
        const affordable = (mv.apCost ?? 1) <= availAp;
        const color =
          mv.kind === "clash"
            ? 0xf43f5e
            : mv.kind === "pickup"
            ? 0x38bdf8
            : mv.isSlide
            ? 0xa5f3fc
            : 0x22c55e;
        const op = (affordable ? 0.46 : 0.15) * moveOpacityBoost;
        const tile = new THREE.Mesh(tileGeo.clone(), makeTileMat(color, op));
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(cellToWorldX(mv.pos.col), 0.028, cellToWorldZ(mv.pos.row));
        tacticalGroup.add(tile);

        // Border frame for crisp tile target clarity
        const ringGeo = new THREE.RingGeometry(0.32, 0.42, 4);
        ringGeo.rotateZ(Math.PI / 4);
        const border = new THREE.Mesh(
          ringGeo,
          makeTileMat(affordable ? color : 0x64748b, affordable ? 0.92 * moveOpacityBoost : 0.3)
        );
        border.rotation.x = -Math.PI / 2;
        border.position.set(cellToWorldX(mv.pos.col), 0.031, cellToWorldZ(mv.pos.row));
        tacticalGroup.add(border);
      }

      // Valid Passes arched 3D tube trajectories + directional cones
      if (selected && p.validPasses.length > 0) {
        const passDim = p.actionMode === "pass" ? 1.0 : 0.72;
        for (const pass of p.validPasses) {
          const sx = cellToWorldX(selected.pos.col);
          const sz = cellToWorldZ(selected.pos.row);
          const ex = cellToWorldX(pass.pos.col);
          const ez = cellToWorldZ(pass.pos.row);
          const mx = (sx + ex) / 2;
          const mz = (sz + ez) / 2;
          const arcY = pass.isLob ? 2.45 : 0.72;

          const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(sx, 0.28, sz),
            new THREE.Vector3(mx, arcY, mz),
            new THREE.Vector3(ex, 0.28, ez)
          );
          const passColor = pass.isOffside
            ? 0xf43f5e
            : pass.isKeyPass
            ? 0xfacc15
            : pass.isLob
            ? 0x38bdf8
            : 0x34d399;
          const op = ((pass.apCost ?? 1) <= availAp ? 0.92 : 0.35) * passDim;
          const tubeGeo = new THREE.TubeGeometry(curve, 18, pass.isKeyPass ? 0.055 : 0.04, 6, false);
          const tubeMat = new THREE.MeshBasicMaterial({
            color: passColor,
            transparent: true,
            opacity: op,
          });
          tacticalGroup.add(new THREE.Mesh(tubeGeo, tubeMat));

          // Directional arrowhead cone near pass target
          const arrowPoint = curve.getPoint(0.86);
          const arrowTan = curve.getTangent(0.86);
          const arrowCone = new THREE.Mesh(
            new THREE.ConeGeometry(0.14, 0.34, 8),
            new THREE.MeshBasicMaterial({ color: passColor, transparent: true, opacity: op })
          );
          arrowCone.position.copy(arrowPoint);
          arrowCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), arrowTan.normalize());
          tacticalGroup.add(arrowCone);

          // Target ring under receiver
          const recRing = new THREE.Mesh(
            new THREE.RingGeometry(0.46, 0.64, 24),
            makeTileMat(passColor, 0.9 * passDim)
          );
          recRing.rotation.x = -Math.PI / 2;
          recRing.position.set(ex, 0.036, ez);
          tacticalGroup.add(recRing);
        }
      }

      // Valid Shots: light up opposing goal target slots & thick 3D aim beams
      if (selected && p.validShots.length > 0) {
        const targetDefendingTeam: Team = selected.team === "blue" ? "red" : "blue";
        const targetX = targetDefendingTeam === "red" ? 16.0 : -16.0;
        const sx = cellToWorldX(selected.pos.col);
        const sz = cellToWorldZ(selected.pos.row);

        for (const shot of p.validShots) {
          const slot = arena.goalTargetMeshes.find(
            (s) => s.team === targetDefendingTeam && s.goalRow === shot.goalRow
          );
          if (slot) {
            slot.mesh.visible = true;
            const mat = slot.mesh.material as THREE.MeshBasicMaterial;
            mat.color.setHex(shot.isContested ? 0xf59e0b : 0x22c55e);
            mat.opacity = p.actionMode === "shoot" ? 0.64 : 0.38;
          }

          const gz = cellToWorldZ(shot.goalRow);
          const curve = new THREE.LineCurve3(
            new THREE.Vector3(sx, 0.32, sz),
            new THREE.Vector3(targetX, 0.9, gz)
          );
          const aimTube = new THREE.Mesh(
            new THREE.TubeGeometry(curve, 4, 0.032, 6, false),
            new THREE.MeshBasicMaterial({
              color: shot.isContested ? 0xfbbf24 : 0x4ade80,
              transparent: true,
              opacity: p.actionMode === "shoot" ? 0.88 : 0.52,
            })
          );
          tacticalGroup.add(aimTube);
        }
      }

      // Coach Hint Golden Tactical 3D Ribbon & Arrowhead
      if (p.showCoachHint && p.coachHint) {
        const actor = p.players.find((pl) => pl.id === p.coachHint!.playerId);
        if (actor) {
          let tx = cellToWorldX(actor.pos.col);
          let tz = cellToWorldZ(actor.pos.row);
          if (p.coachHint.actionType === "shoot" && p.coachHint.goalRow !== undefined) {
            tx = actor.team === "blue" ? 16.0 : -16.0;
            tz = cellToWorldZ(p.coachHint.goalRow);
          } else if (p.coachHint.targetPos) {
            tx = cellToWorldX(p.coachHint.targetPos.col);
            tz = cellToWorldZ(p.coachHint.targetPos.row);
          }

          const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(cellToWorldX(actor.pos.col), 0.35, cellToWorldZ(actor.pos.row)),
            new THREE.Vector3(
              (cellToWorldX(actor.pos.col) + tx) / 2,
              1.7,
              (cellToWorldZ(actor.pos.row) + tz) / 2
            ),
            new THREE.Vector3(tx, 0.35, tz)
          );
          const hintTube = new THREE.Mesh(
            new THREE.TubeGeometry(curve, 18, 0.06, 6, false),
            new THREE.MeshBasicMaterial({ color: 0xfde047 })
          );
          tacticalGroup.add(hintTube);

          const beacon = new THREE.Mesh(
            new THREE.RingGeometry(0.45, 0.62, 24),
            makeTileMat(0xfde047, 0.94)
          );
          beacon.rotation.x = -Math.PI / 2;
          beacon.position.set(tx, 0.044, tz);
          tacticalGroup.add(beacon);
        }
      }
    };

    const runtime = {
      scene,
      camera,
      renderer,
      pitchMat,
      pitchTex: null as THREE.CanvasTexture | null,
      pitchBumpTex: null as THREE.CanvasTexture | null,
      pitchRoughTex: null as THREE.CanvasTexture | null,
      currentPitchType: null as PitchType | null,
      lastScoreKey: "",
      hemiLight,
      skyUniforms,
      grassField,
      arena,
      obstaclesGroup,
      tacticalGroup,
      playerRigs,
      ball,
      ballWorldPos: new THREE.Vector3(
        cellToWorldX(propsRef.current.ball.pos.col),
        0,
        cellToWorldZ(propsRef.current.ball.pos.row)
      ),
      flight: null as ActiveFlightState | null,
      lastFlightNonce: -1,
      lastGoalTeam: null as Team | null,
      confettiPool,
      confettiData,
      trailPool,
      trailData,
      hoverMesh,
      anisotropy,
      syncTactical,
      syncPlayersAndPitch,
    };
    runtimeRef.current = runtime;

    syncPlayersAndPitch();
    syncTactical();

    // Compile shaders on capable GPUs before first frame; software WebGL uses draw pacing cleanly
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const camLookTarget = new THREE.Vector3(0, 0, 0);
    const camDesiredPos = new THREE.Vector3(0, 22, 22);
    const camDesiredLook = new THREE.Vector3(0, 0, 0);

    let trailHead = 0;
    let trailAccum = 0;
    let disposed = false;
    let rafId = 0;
    let lastTime = performance.now();

    const drawMinimap = () => {
      const mini = minimapCanvasRef.current;
      if (!mini) return;
      const ctx = mini.getContext("2d");
      if (!ctx) return;
      const p = propsRef.current;
      const mw = mini.width;
      const mh = mini.height;

      ctx.fillStyle = p.pitchType === "ice" ? "#0369a1" : p.pitchType === "sand" ? "#92400e" : "#14532d";
      ctx.fillRect(0, 0, mw, mh);

      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 1;
      ctx.strokeRect(2, 2, mw - 4, mh - 4);
      ctx.beginPath();
      ctx.moveTo(mw / 2, 2);
      ctx.lineTo(mw / 2, mh - 2);
      ctx.stroke();

      for (const pl of p.players) {
        const mx = 4 + (pl.pos.col / (PITCH_COLS - 1)) * (mw - 8);
        const my = 4 + (pl.pos.row / (PITCH_ROWS - 1)) * (mh - 8);
        ctx.fillStyle = pl.id === p.selectedPlayerId ? "#fde047" : pl.team === "blue" ? "#60a5fa" : "#f87171";
        ctx.fillRect(Math.round(mx - 1.5), Math.round(my - 1.5), 3, 3);
      }

      const bx = 4 + (p.ball.pos.col / (PITCH_COLS - 1)) * (mw - 8);
      const by = 4 + (p.ball.pos.row / (PITCH_ROWS - 1)) * (mh - 8);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(Math.round(bx - 2), Math.round(by - 2), 4, 4);
    };

    const tick = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      const elapsed = now * 0.001;
      const p = propsRef.current;

      // Animate grass breeze & LED ad ribbon scroll
      grassField.uniforms.uTime.value = elapsed;
      arena.adTexture.offset.x = (arena.adTexture.offset.x + dt * 0.045) % 1;

      // 1. Update Biomechanical Player Articulation (Knees, Elbows, Torso Twist, Kick Swings, GK Stance) & Rings
      for (const pl of p.players) {
        const rig = playerRigs.get(pl.id);
        if (!rig) continue;

        const targetX = cellToWorldX(pl.pos.col);
        const targetZ = cellToWorldZ(pl.pos.row);
        const dx = targetX - rig.root.position.x;
        const dz = targetZ - rig.root.position.z;
        const moveDist = Math.hypot(dx, dz);

        rig.root.position.x = THREE.MathUtils.damp(rig.root.position.x, targetX, 11, dt);
        rig.root.position.z = THREE.MathUtils.damp(rig.root.position.z, targetZ, 11, dt);

        if (rig.kickTimer > 0) {
          rig.kickTimer = Math.max(0, rig.kickTimer - dt);
          const kp = 1 - rig.kickTimer / Math.max(0.01, rig.kickDuration);
          const diff = Math.atan2(
            Math.sin(rig.kickYaw - rig.bodyPivot.rotation.y),
            Math.cos(rig.kickYaw - rig.bodyPivot.rotation.y)
          );
          rig.bodyPivot.rotation.y += diff * Math.min(1, dt * 20);

          // Wind-up -> crisp follow-through snap
          const swing = kp < 0.25 ? kp * 4 * 0.72 : Math.sin(((kp - 0.25) / 0.75) * Math.PI) * -1.35 + (1 - kp) * 0.35;
          rig.rightLegPivot.rotation.x = swing;
          rig.rightKneePivot.rotation.x = kp < 0.3 ? 1.05 : 0.14;
          rig.leftLegPivot.rotation.x = 0.22;
          rig.leftKneePivot.rotation.x = 0.25;
          rig.leftArmPivot.rotation.x = -0.65;
          rig.leftArmPivot.rotation.z = -0.25;
          rig.rightArmPivot.rotation.x = 0.55;
          rig.rightArmPivot.rotation.z = 0.25;
          rig.leftElbowPivot.rotation.x = -0.6;
          rig.rightElbowPivot.rotation.x = -0.5;
          rig.torsoGroup.rotation.x = kp < 0.3 ? 0.08 : -0.14;
          rig.torsoGroup.rotation.y = kp < 0.3 ? -0.22 : 0.28;
          rig.bodyPivot.position.y = Math.sin(kp * Math.PI) * 0.06;
        } else if (moveDist > 0.04) {
          const desiredYaw = Math.atan2(dx, dz);
          const diff = Math.atan2(
            Math.sin(desiredYaw - rig.bodyPivot.rotation.y),
            Math.cos(desiredYaw - rig.bodyPivot.rotation.y)
          );
          rig.bodyPivot.rotation.y += diff * Math.min(1, dt * 14);

          const phase = elapsed * 16 + pl.number;
          const stride = Math.sin(phase) * 0.78;
          rig.leftLegPivot.rotation.x = stride;
          rig.rightLegPivot.rotation.x = -stride;

          // Natural knee bend during leg recovery
          rig.leftKneePivot.rotation.x = Math.max(0.08, Math.sin(phase + 0.75) * 1.12);
          rig.rightKneePivot.rotation.x = Math.max(0.08, Math.sin(phase + Math.PI + 0.75) * 1.12);

          // Bent swinging elbows & counter-rotating torso
          rig.leftArmPivot.rotation.x = -stride * 0.8;
          rig.rightArmPivot.rotation.x = stride * 0.8;
          rig.leftArmPivot.rotation.z = -0.08;
          rig.rightArmPivot.rotation.z = 0.08;
          rig.leftElbowPivot.rotation.x = -0.85 - Math.max(0, -stride) * 0.35;
          rig.rightElbowPivot.rotation.x = -0.85 - Math.max(0, stride) * 0.35;

          rig.torsoGroup.rotation.x = THREE.MathUtils.damp(rig.torsoGroup.rotation.x, 0.22, 10, dt);
          rig.torsoGroup.rotation.y = stride * 0.22;
          rig.bodyPivot.position.y = Math.abs(Math.sin(phase)) * 0.095;
        } else {
          const restYaw = pl.team === "blue" ? Math.PI / 2 : -Math.PI / 2;
          const diff = Math.atan2(
            Math.sin(restYaw - rig.bodyPivot.rotation.y),
            Math.cos(restYaw - rig.bodyPivot.rotation.y)
          );
          rig.bodyPivot.rotation.y += diff * Math.min(1, dt * 6);

          const isCelebrating = p.goalCelebrationTeam === pl.team;
          const isGK = pl.role === "GK";

          if (isCelebrating) {
            const hop = Math.abs(Math.sin(elapsed * 9 + pl.number));
            rig.leftLegPivot.rotation.x = -hop * 0.35;
            rig.rightLegPivot.rotation.x = -hop * 0.35;
            rig.leftKneePivot.rotation.x = hop * 0.7;
            rig.rightKneePivot.rotation.x = hop * 0.7;
            rig.leftArmPivot.rotation.x = -2.45 + Math.sin(elapsed * 12) * 0.22;
            rig.rightArmPivot.rotation.x = -2.45 - Math.sin(elapsed * 12) * 0.22;
            rig.leftArmPivot.rotation.z = -0.25;
            rig.rightArmPivot.rotation.z = 0.25;
            rig.leftElbowPivot.rotation.x = -0.45;
            rig.rightElbowPivot.rotation.x = -0.45;
            rig.torsoGroup.rotation.x = -0.08;
            rig.torsoGroup.rotation.y = 0;
            rig.bodyPivot.position.y = THREE.MathUtils.damp(rig.bodyPivot.position.y, hop * 0.38, 12, dt);
          } else if (isGK) {
            // Crouched Goalkeeper Ready Stance with gloves raised
            rig.leftLegPivot.rotation.x = THREE.MathUtils.damp(rig.leftLegPivot.rotation.x, -0.18, 10, dt);
            rig.rightLegPivot.rotation.x = THREE.MathUtils.damp(rig.rightLegPivot.rotation.x, -0.18, 10, dt);
            rig.leftKneePivot.rotation.x = THREE.MathUtils.damp(rig.leftKneePivot.rotation.x, 0.32, 10, dt);
            rig.rightKneePivot.rotation.x = THREE.MathUtils.damp(rig.rightKneePivot.rotation.x, 0.32, 10, dt);
            rig.leftArmPivot.rotation.x = THREE.MathUtils.damp(rig.leftArmPivot.rotation.x, -0.42, 10, dt);
            rig.rightArmPivot.rotation.x = THREE.MathUtils.damp(rig.rightArmPivot.rotation.x, -0.42, 10, dt);
            rig.leftArmPivot.rotation.z = -0.22;
            rig.rightArmPivot.rotation.z = 0.22;
            rig.leftElbowPivot.rotation.x = THREE.MathUtils.damp(rig.leftElbowPivot.rotation.x, -1.15, 10, dt);
            rig.rightElbowPivot.rotation.x = THREE.MathUtils.damp(rig.rightElbowPivot.rotation.x, -1.15, 10, dt);
            rig.torsoGroup.rotation.x = THREE.MathUtils.damp(rig.torsoGroup.rotation.x, 0.14, 10, dt);
            rig.torsoGroup.rotation.y = Math.sin(elapsed * 2.2) * 0.06;
            const sway = Math.abs(Math.sin(elapsed * 3.1)) * 0.03 - 0.04;
            rig.bodyPivot.position.y = THREE.MathUtils.damp(rig.bodyPivot.position.y, sway, 10, dt);
          } else {
            // Athletic poised ready stance + subtle chest breathing
            rig.leftLegPivot.rotation.x = THREE.MathUtils.damp(rig.leftLegPivot.rotation.x, -0.05, 10, dt);
            rig.rightLegPivot.rotation.x = THREE.MathUtils.damp(rig.rightLegPivot.rotation.x, 0.05, 10, dt);
            rig.leftKneePivot.rotation.x = THREE.MathUtils.damp(rig.leftKneePivot.rotation.x, 0.1, 10, dt);
            rig.rightKneePivot.rotation.x = THREE.MathUtils.damp(rig.rightKneePivot.rotation.x, 0.06, 10, dt);
            rig.leftArmPivot.rotation.x = THREE.MathUtils.damp(rig.leftArmPivot.rotation.x, 0.06, 10, dt);
            rig.rightArmPivot.rotation.x = THREE.MathUtils.damp(rig.rightArmPivot.rotation.x, -0.06, 10, dt);
            rig.leftArmPivot.rotation.z = -0.09;
            rig.rightArmPivot.rotation.z = 0.09;
            rig.leftElbowPivot.rotation.x = THREE.MathUtils.damp(rig.leftElbowPivot.rotation.x, -0.32, 10, dt);
            rig.rightElbowPivot.rotation.x = THREE.MathUtils.damp(rig.rightElbowPivot.rotation.x, -0.32, 10, dt);
            rig.torsoGroup.rotation.x = THREE.MathUtils.damp(rig.torsoGroup.rotation.x, 0.04, 10, dt);
            rig.torsoGroup.rotation.y = THREE.MathUtils.damp(rig.torsoGroup.rotation.y, 0, 10, dt);
            const idleBob =
              pl.id === p.selectedPlayerId
                ? Math.sin(elapsed * 5) * 0.04
                : Math.sin(elapsed * 2.5 + pl.number) * 0.014;
            rig.bodyPivot.position.y = THREE.MathUtils.damp(rig.bodyPivot.position.y, idleBob, 12, dt);
          }
        }

        // Expressive subtle head look toward the ball
        const bdx = runtime.ballWorldPos.x - rig.root.position.x;
        const bdz = runtime.ballWorldPos.z - rig.root.position.z;
        if (Math.hypot(bdx, bdz) > 0.5) {
          const ballYaw = Math.atan2(bdx, bdz);
          const relHead = Math.atan2(
            Math.sin(ballYaw - rig.bodyPivot.rotation.y),
            Math.cos(ballYaw - rig.bodyPivot.rotation.y)
          );
          const clampedHead = Math.max(-0.52, Math.min(0.52, relHead));
          rig.headGroup.rotation.y = THREE.MathUtils.damp(rig.headGroup.rotation.y, clampedHead, 7, dt);
        }

        const isSelected = pl.id === p.selectedPlayerId;
        rig.selectionRing.visible = isSelected && !p.hideHudWidgets;
        if (rig.selectionRing.visible) {
          const pulse = 1 + Math.sin(elapsed * 7) * 0.1;
          rig.selectionRing.scale.set(pulse, pulse, 1);
        }
        rig.carrierHalo.visible = p.ball.carrierId === pl.id;
        rig.turnReadyRing.visible =
          !p.hideHudWidgets && p.isHumanTurn && pl.team === p.currentTurn && !isSelected && p.ball.carrierId !== pl.id;
        rig.fatigueRing.visible = !p.hideHudWidgets && (pl.stamina ?? 100) < 35;
      }

      // 2. Ball Physics, Velocity-Aligned Spin, Parabolic Flight & Landing Splash
      let ballTargetX = cellToWorldX(p.ball.pos.col);
      let ballTargetZ = cellToWorldZ(p.ball.pos.row);
      let ballOffsetY = 0;

      if (p.ball.carrierId) {
        const carrierRig = playerRigs.get(p.ball.carrierId);
        const carrier = p.players.find((pl) => pl.id === p.ball.carrierId);
        if (carrierRig && carrier) {
          const sideSign = carrier.team === "blue" ? 1 : -1;
          ballTargetX = carrierRig.root.position.x + sideSign * 0.34;
          ballTargetZ = carrierRig.root.position.z + 0.18;
        }
      }

      const prevBallX = runtime.ballWorldPos.x;
      const prevBallZ = runtime.ballWorldPos.z;

      if (runtime.flight) {
        runtime.flight.progress += dt / runtime.flight.duration;
        const t = Math.min(1, runtime.flight.progress);
        const eased = 1 - Math.pow(1 - t, 2);
        const bx = THREE.MathUtils.lerp(runtime.flight.fromX, runtime.flight.toX, eased);
        const bz = THREE.MathUtils.lerp(runtime.flight.fromZ, runtime.flight.toZ, eased);
        ballOffsetY = Math.sin(t * Math.PI) * runtime.flight.peakHeight;
        runtime.ballWorldPos.set(bx, ballOffsetY, bz);

        trailAccum += dt;
        if (trailAccum > 0.016) {
          trailAccum = 0;
          const dot = trailData[trailHead];
          dot.x = bx;
          dot.y = 0.25 + ballOffsetY;
          dot.z = bz;
          dot.maxLife = runtime.flight.isSuperShot ? 0.48 : 0.28;
          dot.life = dot.maxLife;
          trailHead = (trailHead + 1) % maxTrails;
        }

        if (t >= 1) {
          // Turf impact dust splash on landing
          for (let k = 0; k < 5; k++) {
            const ang = (k / 5) * Math.PI * 2;
            const dot = trailData[trailHead];
            dot.x = bx + Math.cos(ang) * 0.28;
            dot.y = 0.14;
            dot.z = bz + Math.sin(ang) * 0.28;
            dot.maxLife = 0.24;
            dot.life = dot.maxLife;
            trailHead = (trailHead + 1) % maxTrails;
          }
          runtime.flight = null;
        }
      } else {
        runtime.ballWorldPos.x = THREE.MathUtils.damp(runtime.ballWorldPos.x, ballTargetX, 14, dt);
        runtime.ballWorldPos.z = THREE.MathUtils.damp(runtime.ballWorldPos.z, ballTargetZ, 14, dt);
        runtime.ballWorldPos.y = THREE.MathUtils.damp(runtime.ballWorldPos.y, 0, 14, dt);
      }

      const stepDx = runtime.ballWorldPos.x - prevBallX;
      const stepDz = runtime.ballWorldPos.z - prevBallZ;
      const stepDist = Math.hypot(stepDx, stepDz);

      ball.root.position.set(runtime.ballWorldPos.x, 0, runtime.ballWorldPos.z);
      ball.sphere.position.y = 0.25 + runtime.ballWorldPos.y;
      if (stepDist > 0.001) {
        _scratchAxis.set(stepDz, 0, -stepDx).normalize();
        ball.sphere.rotateOnWorldAxis(_scratchAxis, stepDist / 0.25);
      }

      const shadowScale = Math.max(0.42, 1 - runtime.ballWorldPos.y * 0.18);
      ball.shadow.scale.set(shadowScale, shadowScale, 1);
      ball.aura.visible = p.superDriveReady || Boolean(runtime.flight?.isSuperShot);
      if (ball.aura.visible) {
        const s = 1 + Math.sin(elapsed * 9) * 0.14;
        ball.aura.scale.set(s, s, 1);
      }

      // 3. Update Instanced Trail & Confetti
      for (let i = 0; i < maxTrails; i++) {
        const d = trailData[i];
        if (d.life > 0) {
          d.life = Math.max(0, d.life - dt);
          const s = (d.life / d.maxLife) * 1.1;
          _scratchDummy.position.set(d.x, d.y, d.z);
          _scratchDummy.scale.set(s, s, s);
        } else {
          _scratchDummy.position.set(0, -30, 0);
          _scratchDummy.scale.set(0.001, 0.001, 0.001);
        }
        _scratchDummy.updateMatrix();
        trailPool.setMatrixAt(i, _scratchDummy.matrix);
      }
      trailPool.instanceMatrix.needsUpdate = true;

      for (let i = 0; i < maxConfetti; i++) {
        const c = confettiData[i];
        if (c.life > 0) {
          c.life = Math.max(0, c.life - dt);
          c.vy -= 11 * dt;
          confettiPos[i].x += c.vx * dt;
          confettiPos[i].y = Math.max(0.08, confettiPos[i].y + c.vy * dt);
          confettiPos[i].z += c.vz * dt;
          const s = Math.min(1, (c.life / c.maxLife) * 1.5);
          _scratchDummy.position.copy(confettiPos[i]);
          _scratchDummy.rotation.set(elapsed * 5 + i, elapsed * 3 + i, 0);
          _scratchDummy.scale.set(s, s, s);
        } else {
          _scratchDummy.position.set(0, -30, 0);
          _scratchDummy.scale.set(0.001, 0.001, 0.001);
        }
        _scratchDummy.updateMatrix();
        confettiPool.setMatrixAt(i, _scratchDummy.matrix);
      }
      confettiPool.instanceMatrix.needsUpdate = true;

      // 4. Crowd, Corner Flag & Goal Net Sway
      for (let i = 0; i < arena.cornerFlags.length; i++) {
        arena.cornerFlags[i].rotation.y = Math.sin(elapsed * 4.5 + i) * 0.28;
      }
      for (const goal of arena.goals) {
        const isScoredGoal = p.goalCelebrationTeam && p.goalCelebrationTeam !== goal.team;
        goal.backNet.position.x =
          (goal.team === "blue" ? -18.1 : 18.1) +
          (isScoredGoal ? Math.sin(elapsed * 22) * 0.14 : Math.sin(elapsed * 2.2) * 0.015);
      }
      const crowdJumpAmp = p.goalCelebrationTeam ? 0.34 : 0.04;
      const crowdSpeed = p.goalCelebrationTeam ? 10.5 : 2.6;
      const totalCrowd = arena.crowdBaseY.length;
      for (let i = 0; i < totalCrowd; i += 2) {
        arena.crowdMesh.getMatrixAt(i, _scratchDummy.matrix);
        _scratchDummy.matrix.decompose(_scratchDummy.position, _scratchDummy.quaternion, _scratchDummy.scale);
        _scratchDummy.position.y =
          arena.crowdBaseY[i] + Math.max(0, Math.sin(elapsed * crowdSpeed + arena.crowdPhase[i])) * crowdJumpAmp;
        _scratchDummy.updateMatrix();
        arena.crowdMesh.setMatrixAt(i, _scratchDummy.matrix);
      }
      arena.crowdMesh.instanceMatrix.needsUpdate = true;

      // 5. Smooth Dynamic 3D Camera Choreography across 5 Presets + Zoom + Pan
      const aspect = Math.max(0.5, camera.aspect);
      const portraitZoomBoost = aspect < 1 ? 1.15 : 1.0;
      const userZoom = Math.max(0.58, Math.min(2.1, 1 - zoomOffsetRef.current * 0.45));
      const panX = panOffsetRef.current.x;
      const panZ = panOffsetRef.current.z;
      const preset = presetRef.current;

      const selectedPl = p.selectedPlayerId ? playerRigs.get(p.selectedPlayerId) : null;
      const focusX = selectedPl ? selectedPl.root.position.x : runtime.ballWorldPos.x;
      const focusZ = selectedPl ? selectedPl.root.position.z : runtime.ballWorldPos.z;

      if (p.hideHudWidgets) {
        // Gentle scenic sweep of the 3D stadium in main menu backdrop
        const orbit = elapsed * 0.12;
        camDesiredLook.set(0, 0.4, 0);
        camDesiredPos.set(Math.sin(orbit) * 14, 18.5, Math.cos(orbit) * 20);
      } else if (preset === "tv") {
        const tx = runtime.ballWorldPos.x * 0.42 + panX;
        const tz = runtime.ballWorldPos.z * 0.28 + panZ;
        camDesiredLook.set(tx, 0, tz);
        camDesiredPos.set(
          tx * 0.85,
          20.5 * userZoom * portraitZoomBoost,
          21.5 * userZoom * portraitZoomBoost + tz * 0.35
        );
      } else if (preset === "wide") {
        camDesiredLook.set(panX, 0, panZ + 0.5);
        camDesiredPos.set(panX, 27.5 * userZoom * portraitZoomBoost, 17.5 * userZoom * portraitZoomBoost + panZ);
      } else if (preset === "close") {
        const tx = focusX * 0.78 + panX;
        const tz = focusZ * 0.65 + panZ;
        camDesiredLook.set(tx, 0.4, tz);
        camDesiredPos.set(tx, 12.2 * userZoom, tz + 12.6 * userZoom);
      } else if (preset === "topdown") {
        camDesiredLook.set(panX, 0, panZ);
        camDesiredPos.set(panX, 31.5 * userZoom * portraitZoomBoost, 3.8 * userZoom + panZ);
      } else {
        // opposite (180° north grandstand)
        const tx = runtime.ballWorldPos.x * 0.38 + panX;
        const tz = runtime.ballWorldPos.z * 0.25 + panZ;
        camDesiredLook.set(tx, 0, tz);
        camDesiredPos.set(tx * 0.85, 21 * userZoom * portraitZoomBoost, -21 * userZoom * portraitZoomBoost + tz * 0.35);
      }

      camera.position.x = THREE.MathUtils.damp(camera.position.x, camDesiredPos.x, 7, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, camDesiredPos.y, 7, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, camDesiredPos.z, 7, dt);

      camLookTarget.x = THREE.MathUtils.damp(camLookTarget.x, camDesiredLook.x, 8, dt);
      camLookTarget.y = THREE.MathUtils.damp(camLookTarget.y, camDesiredLook.y, 8, dt);
      camLookTarget.z = THREE.MathUtils.damp(camLookTarget.z, camDesiredLook.z, 8, dt);
      camera.lookAt(camLookTarget);

      // Hover cell indicator
      if (hoverCellRef.current && !p.hideHudWidgets) {
        hoverMesh.visible = true;
        hoverMesh.position.x = cellToWorldX(hoverCellRef.current.col);
        hoverMesh.position.z = cellToWorldZ(hoverCellRef.current.row);
      } else {
        hoverMesh.visible = false;
      }

      renderer.render(scene, camera);

      // 6. Project Lightweight Semantic Badges into DOM overlays (zero React re-renders!)
      const canvasW = renderer.domElement.clientWidth || width;
      const canvasH = renderer.domElement.clientHeight || height;

      if (selectedBadgeRef.current) {
        const selRig = p.selectedPlayerId ? playerRigs.get(p.selectedPlayerId) : null;
        const selObj = p.selectedPlayerId ? p.players.find((pl) => pl.id === p.selectedPlayerId) : null;
        if (selRig && selObj && !p.hideHudWidgets && p.isHumanTurn) {
          _scratchVec3A.set(selRig.root.position.x, 2.05, selRig.root.position.z).project(camera);
          if (_scratchVec3A.z < 1) {
            const sx = ((_scratchVec3A.x + 1) / 2) * canvasW;
            const sy = ((-_scratchVec3A.y + 1) / 2) * canvasH;
            selectedBadgeRef.current.style.opacity = "1";
            selectedBadgeRef.current.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
            selectedBadgeRef.current.textContent = `${ROLE_META[selObj.role].code} №${selObj.number} · ${p.actionPoints ?? 5} ОД`;
          } else {
            selectedBadgeRef.current.style.opacity = "0";
          }
        } else {
          selectedBadgeRef.current.style.opacity = "0";
        }
      }

      if (calloutBadgeRef.current) {
        if (p.floatingCallout && !p.hideHudWidgets) {
          _scratchVec3B
            .set(cellToWorldX(p.floatingCallout.pos.col), 2.35, cellToWorldZ(p.floatingCallout.pos.row))
            .project(camera);
          if (_scratchVec3B.z < 1) {
            const cx = ((_scratchVec3B.x + 1) / 2) * canvasW;
            const cy = ((-_scratchVec3B.y + 1) / 2) * canvasH;
            calloutBadgeRef.current.style.opacity = "1";
            calloutBadgeRef.current.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0) translate(-50%, -100%)`;
            calloutBadgeRef.current.textContent = p.floatingCallout.text;
          } else {
            calloutBadgeRef.current.style.opacity = "0";
          }
        } else {
          calloutBadgeRef.current.style.opacity = "0";
        }
      }

      drawMinimap();
      scheduleNextFrame();
    };

    // Software WebGL frame-completion fenceSync pacing vs standard hardware RAF
    const afterDraw = (onIdle: () => void) => {
      if (disposed) return;
      const glCtx = renderer.getContext();
      if (isSoftwareGl && typeof WebGL2RenderingContext !== "undefined" && glCtx instanceof WebGL2RenderingContext) {
        const fence = glCtx.fenceSync(glCtx.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (!fence) {
          rafId = requestAnimationFrame(onIdle);
          return;
        }
        glCtx.flush();
        const poll = () => {
          if (disposed) {
            glCtx.deleteSync(fence);
            return;
          }
          const st = glCtx.clientWaitSync(fence, 0, 0);
          if (st === glCtx.TIMEOUT_EXPIRED) {
            setTimeout(poll, 4);
          } else {
            glCtx.deleteSync(fence);
            rafId = requestAnimationFrame(onIdle);
          }
        };
        setTimeout(poll, 0);
      } else {
        rafId = requestAnimationFrame(onIdle);
      }
    };

    const scheduleNextFrame = () => {
      afterDraw(() => tick(performance.now()));
    };

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(300, Math.floor(entry.contentRect.width));
        const h = Math.max(220, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    ro.observe(host);

    rafId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);

      if (runtime.pitchTex) runtime.pitchTex.dispose();
      if (runtime.pitchBumpTex) runtime.pitchBumpTex.dispose();
      if (runtime.pitchRoughTex) runtime.pitchRoughTex.dispose();
      envTarget.dispose();
      skyGeo.dispose();
      skyMat.dispose();
      grassField.mesh.geometry.dispose();
      (grassField.mesh.material as THREE.Material).dispose();
      disposeObject3D(arena.group);
      disposeObject3D(obstaclesGroup);
      disposeObject3D(tacticalGroup);
      disposeObject3D(playersGroup);
      disposeObject3D(ball.root);
      trailGeo.dispose();
      trailMat.dispose();
      confettiGeo.dispose();
      confettiMat.dispose();
      hoverMesh.geometry.dispose();
      hoverMat.dispose();
      pitchPlane.geometry.dispose();
      pitchMat.dispose();
      renderer.dispose();
      runtimeRef.current = null;
    };
  }, []);

  // Raycasting helper from pointer coordinates -> 3D pitch actions
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseNdcRef = useRef(new THREE.Vector2());

  const updateNdcFromClient = (clientX: number, clientY: number): boolean => {
    const host = hostRef.current;
    if (!host) return false;
    const rect = host.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    mouseNdcRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouseNdcRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return true;
  };

  const handleTapPick = (clientX: number, clientY: number, isTouch: boolean) => {
    const rt = runtimeRef.current;
    const p = propsRef.current;
    if (!rt || p.hideHudWidgets) return;
    if (!updateNdcFromClient(clientX, clientY)) return;

    raycasterRef.current.setFromCamera(mouseNdcRef.current, rt.camera);

    // 1. Check visible Goal Shot Target Slots first
    if (p.isHumanTurn && p.validShots.length > 0) {
      const visibleGoalSlots = rt.arena.goalTargetMeshes
        .filter((s) => s.mesh.visible)
        .map((s) => s.mesh);
      if (visibleGoalSlots.length > 0) {
        const goalHits = raycasterRef.current.intersectObjects(visibleGoalSlots, false);
        if (goalHits.length > 0) {
          const row = goalHits[0].object.userData?.goalRow as number | undefined;
          if (row !== undefined) {
            p.onShootGoal(row);
            return;
          }
        }
      }
    }

    // 2. Check Player Hit Cylinders
    const hitCylinders: THREE.Object3D[] = [];
    for (const rig of rt.playerRigs.values()) hitCylinders.push(rig.hitCylinder);
    const playerHits = raycasterRef.current.intersectObjects(hitCylinders, false);
    if (playerHits.length > 0) {
      const hitId = playerHits[0].object.userData?.playerId as string | undefined;
      if (hitId) {
        const clickedPl = p.players.find((pl) => pl.id === hitId);
        if (clickedPl) {
          if (p.isHumanTurn && p.validPasses.some((vp) => vp.targetPlayerId === hitId)) {
            p.onPassToPlayer(hitId);
            return;
          }
          if (
            p.isHumanTurn &&
            p.validMoves.some((vm) => vm.pos.col === clickedPl.pos.col && vm.pos.row === clickedPl.pos.row)
          ) {
            p.onCellClick(clickedPl.pos);
            return;
          }
          p.onSelectPlayer(hitId);
          return;
        }
      }
    }

    // 3. Intersect Ground Plane (y = 0) -> map to pitch grid (with forgiving touch snap)
    const hitPoint = new THREE.Vector3();
    if (!raycasterRef.current.ray.intersectPlane(_groundPlane, hitPoint)) return;

    const rawColFloat = hitPoint.x + (PITCH_COLS - 1) / 2;
    const rawRowFloat = hitPoint.z + (PITCH_ROWS - 1) / 2;

    // Also allow clicking right inside goalmouth apron to trigger nearest shot if validShots exist
    if (p.isHumanTurn && p.validShots.length > 0) {
      const targetGoalX = p.currentTurn === "blue" ? PITCH_COLS - 0.5 : -0.5;
      if (Math.abs(rawColFloat - targetGoalX) <= 2.4 && rawRowFloat >= 11.5 && rawRowFloat <= 19.5) {
        let bestShot = p.validShots[0];
        let bestD = Infinity;
        for (const s of p.validShots) {
          const d = Math.abs(s.goalRow - rawRowFloat);
          if (d < bestD) {
            bestD = d;
            bestShot = s;
          }
        }
        p.onShootGoal(bestShot.goalRow);
        return;
      }
    }

    const col = worldXToCellCol(hitPoint.x);
    const row = worldZToCellRow(hitPoint.z);

    if (isTouch && p.isHumanTurn) {
      // Touch ergonomics: snap cleanly within 2.1 grid cells to nearest valid pass/move/friendly player
      let bestDist = 2.1;
      let snapAction: (() => void) | null = null;

      for (const vp of p.validPasses) {
        const d = Math.hypot(vp.pos.col - rawColFloat, vp.pos.row - rawRowFloat);
        if (d < bestDist) {
          bestDist = d;
          snapAction = () => p.onPassToPlayer(vp.targetPlayerId);
        }
      }
      for (const vm of p.validMoves) {
        const d = Math.hypot(vm.pos.col - rawColFloat, vm.pos.row - rawRowFloat);
        if (d < bestDist) {
          bestDist = d;
          snapAction = () => p.onCellClick(vm.pos);
        }
      }
      if (!snapAction) {
        for (const pl of p.players) {
          if (pl.team !== p.currentTurn) continue;
          const d = Math.hypot(pl.pos.col - rawColFloat, pl.pos.row - rawRowFloat);
          if (d < 1.8) {
            snapAction = () => p.onSelectPlayer(pl.id);
            break;
          }
        }
      }
      if (snapAction) {
        snapAction();
        return;
      }
    }

    p.onCellClick({ col, row });
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0a1426] select-none">
      {/* Main Interactive WebGL Host */}
      <div
        ref={hostRef}
        onWheel={(e) => {
          e.preventDefault();
          const step = e.deltaY < 0 ? 0.14 : -0.14;
          setZoomOffset((z) => Math.max(-0.45, Math.min(1.05, Number((z + step).toFixed(2)))));
        }}
        onPointerDown={(e) => {
          activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (activePointersRef.current.size === 2) {
            const pts = Array.from(activePointersRef.current.values());
            const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            pinchStateRef.current = {
              active: true,
              startDist: Math.max(10, dist),
              startZoom: zoomOffsetRef.current,
            };
            dragStateRef.current.active = false;
            return;
          }
          if (e.button === 0 || e.button === 2) {
            dragStateRef.current = {
              active: true,
              startX: e.clientX,
              startY: e.clientY,
              origPanX: panOffsetRef.current.x,
              origPanZ: panOffsetRef.current.z,
              moved: false,
            };
          }
        }}
        onPointerMove={(e) => {
          if (activePointersRef.current.has(e.pointerId)) {
            activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          }

          if (pinchStateRef.current.active && activePointersRef.current.size >= 2) {
            const pts = Array.from(activePointersRef.current.values());
            const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            const scaleDelta = (dist - pinchStateRef.current.startDist) / 210;
            const nextZoom = Math.max(
              -0.45,
              Math.min(1.05, Number((pinchStateRef.current.startZoom + scaleDelta).toFixed(2)))
            );
            setZoomOffset(nextZoom);
            return;
          }

          if (dragStateRef.current.active) {
            const dx = e.clientX - dragStateRef.current.startX;
            const dy = e.clientY - dragStateRef.current.startY;
            if (Math.hypot(dx, dy) > 8) {
              dragStateRef.current.moved = true;
              const flip = presetRef.current === "opposite" ? -1 : 1;
              panOffsetRef.current = {
                x: Math.max(-13, Math.min(13, dragStateRef.current.origPanX - dx * 0.032 * flip)),
                z: Math.max(-13, Math.min(13, dragStateRef.current.origPanZ - dy * 0.032 * flip)),
              };
            }
          } else if (e.pointerType !== "touch") {
            const rt = runtimeRef.current;
            if (rt && updateNdcFromClient(e.clientX, e.clientY)) {
              raycasterRef.current.setFromCamera(mouseNdcRef.current, rt.camera);
              const hitPt = new THREE.Vector3();
              if (raycasterRef.current.ray.intersectPlane(_groundPlane, hitPt)) {
                hoverCellRef.current = {
                  col: worldXToCellCol(hitPt.x),
                  row: worldZToCellRow(hitPt.z),
                };
              } else {
                hoverCellRef.current = null;
              }
            }
          }
        }}
        onPointerUp={(e) => {
          activePointersRef.current.delete(e.pointerId);
          if (activePointersRef.current.size < 2) {
            pinchStateRef.current.active = false;
          }
          const wasMoved = dragStateRef.current.moved;
          dragStateRef.current.active = false;
          if (!wasMoved && !pinchStateRef.current.active && e.button !== 2) {
            handleTapPick(e.clientX, e.clientY, e.pointerType === "touch");
          }
          window.setTimeout(() => {
            dragStateRef.current.moved = false;
          }, 50);
        }}
        onPointerCancel={(e) => {
          activePointersRef.current.delete(e.pointerId);
          pinchStateRef.current.active = false;
          dragStateRef.current.active = false;
          dragStateRef.current.moved = false;
        }}
        onPointerLeave={() => {
          hoverCellRef.current = null;
        }}
        className="w-full h-full relative touch-none"
      />

      {/* Lightweight Projected Floating Badges (updated in Three.js tick via transform) */}
      <div
        ref={selectedBadgeRef}
        className="pointer-events-none absolute top-0 left-0 z-10 px-1.5 py-0.5 bg-slate-950/90 border border-amber-300 text-amber-200 text-[10px] font-bold tracking-tight whitespace-nowrap shadow-md transition-opacity duration-100"
        style={{ opacity: 0 }}
      />
      <div
        ref={calloutBadgeRef}
        className="pointer-events-none absolute top-0 left-0 z-10 px-2 py-0.5 bg-black/90 border border-yellow-300 text-yellow-300 text-[11px] font-black tracking-wide whitespace-nowrap shadow-lg transition-opacity duration-150"
        style={{ opacity: 0 }}
      />

      {/* WebGL Context Lost Fallback Banner */}
      {webglLost && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/85 text-white text-sm font-bold p-4">
          Восстановление 3D WebGL-контекста стадиона...
        </div>
      )}

      {/* Optional Soft Retro CRT Monitor Overlay */}
      {crtEnabled ? (
        <div className="crt-animated-overlay absolute inset-0 z-10 pointer-events-none" />
      ) : (
        <div className="crt-scanlines absolute inset-0 pointer-events-none opacity-15" />
      )}

      {/* Compact Translucent Corner Touch Rail (Phones & Landscape) */}
      {!props.hideHudWidgets && (
        <div className="md:hidden [@media(max-height:519px)]:flex fixed top-11 right-1.5 z-20 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setZoomOffset((z) => Math.min(1.05, z + 0.25))}
            title="Приблизить 3D поле"
            aria-label="Приблизить поле"
            className="w-8 h-8 flex items-center justify-center bg-slate-950/60 hover:bg-slate-900/85 text-white border border-white/20 cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              panOffsetRef.current = { x: 0, z: 0 };
              setZoomOffset(0);
            }}
            title="Центрировать 3D камеру"
            aria-label="Центрировать камеру"
            className="w-8 h-8 flex items-center justify-center bg-slate-950/60 hover:bg-slate-900/85 text-sky-300 border border-white/20 cursor-pointer"
          >
            <LocateFixed className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoomOffset((z) => Math.max(-0.45, z - 0.25))}
            title="Отдалить 3D поле"
            aria-label="Отдалить поле"
            className="w-8 h-8 flex items-center justify-center bg-slate-950/60 hover:bg-slate-900/85 text-white border border-white/20 cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          {props.onToggleFullscreen && (
            <button
              type="button"
              onClick={props.onToggleFullscreen}
              title={props.isFullscreen ? "Выйти из полного экрана" : "На весь экран"}
              aria-label="Полный экран"
              className={`w-8 h-8 flex items-center justify-center border cursor-pointer ${
                props.isFullscreen
                  ? "bg-amber-400/90 text-slate-950 border-amber-200"
                  : "bg-slate-950/60 hover:bg-slate-900/85 text-white border-white/20"
              }`}
            >
              {props.isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          )}
        </div>
      )}

      {/* Minimal Translucent Desktop Camera Pill (Clean Match Mode) OR Full Dock (Extended HUD) */}
      {!props.hideHudWidgets && !props.showExtendedHud && (
        <div className="hidden md:flex [@media(max-height:519px)]:!hidden fixed top-2 right-2 z-20 items-center gap-1">
          <button
            type="button"
            onClick={() => {
              const idx = CAMERA_PRESET_ORDER.indexOf(activePreset);
              setCameraPreset(CAMERA_PRESET_ORDER[(idx + 1) % CAMERA_PRESET_ORDER.length]);
            }}
            title="Сменить 3D ракурс (V)"
            className="h-7 px-2 text-[11px] font-bold flex items-center gap-1 bg-slate-950/65 hover:bg-slate-900/90 text-white border border-white/20 cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5 text-amber-300" />
            <span>{CAMERA_PRESET_META[activePreset].shortLabel}</span>
          </button>
          <button
            type="button"
            onClick={() => setZoomOffset((z) => Math.max(-0.45, z - 0.25))}
            title="Отдалить камеру"
            className="h-7 w-7 flex items-center justify-center bg-slate-950/65 hover:bg-slate-900/90 text-white border border-white/20 cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              panOffsetRef.current = { x: 0, z: 0 };
              setZoomOffset(0);
            }}
            title="Центрировать камеру (R)"
            className="h-7 w-7 flex items-center justify-center bg-slate-950/65 hover:bg-slate-900/90 text-sky-300 border border-white/20 cursor-pointer"
          >
            <LocateFixed className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoomOffset((z) => Math.min(1.05, z + 0.25))}
            title="Приблизить камеру"
            className="h-7 w-7 flex items-center justify-center bg-slate-950/65 hover:bg-slate-900/90 text-white border border-white/20 cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          {props.onToggleFullscreen && (
            <button
              type="button"
              onClick={props.onToggleFullscreen}
              title={props.isFullscreen ? "Выйти из полного экрана" : "На весь экран"}
              className={`h-7 w-7 flex items-center justify-center border cursor-pointer ${
                props.isFullscreen
                  ? "bg-amber-400/90 text-slate-950 border-amber-200"
                  : "bg-slate-950/65 hover:bg-slate-900/90 text-white border-white/20"
              }`}
            >
              {props.isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      )}

      {/* Extended Desktop Camera, CRT & Fullscreen Dock Bar (when HUD panels expanded) */}
      {!props.hideHudWidgets && props.showExtendedHud && (
        <div className="hidden md:flex [@media(max-height:519px)]:!hidden fixed top-[52px] right-2 lg:right-[244px] z-20 flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            <div className="xl:hidden flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCameraDrawerOpen((v) => !v)}
                title="Переключить 3D ракурс и зум камеры"
                className={`h-7 px-2 text-[10px] font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                  cameraDrawerOpen ? "pc-btn-active" : "pc-btn"
                }`}
              >
                <Camera className="w-3 h-3 text-[#000080]" />
                <span>{CAMERA_PRESET_META[activePreset].shortLabel}</span>
              </button>
            </div>

            <div className="hidden xl:flex items-center gap-1">
              <div className="pc-window p-0.5 flex items-center gap-0.5">
                {CAMERA_PRESET_ORDER.map((preset) => {
                  const cfg = CAMERA_PRESET_META[preset];
                  const isAct = activePreset === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCameraPreset(preset)}
                      title={cfg.title}
                      className={`h-6 px-2 text-[10px] font-bold whitespace-nowrap cursor-pointer flex items-center gap-1 ${
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
                  onClick={() => setZoomOffset((z) => Math.max(-0.45, z - 0.25))}
                  title="Отдалить камеру"
                  className="pc-btn h-6 w-6 flex items-center justify-center cursor-pointer"
                >
                  <ZoomOut className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    panOffsetRef.current = { x: 0, z: 0 };
                    setZoomOffset(0);
                  }}
                  title="Центрировать камеру (R)"
                  className="pc-btn h-6 w-6 flex items-center justify-center cursor-pointer"
                >
                  <LocateFixed className="w-3 h-3 text-[#000080]" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomOffset((z) => Math.min(1.05, z + 0.25))}
                  title="Приблизить камеру"
                  className="pc-btn h-6 w-6 flex items-center justify-center cursor-pointer"
                >
                  <ZoomIn className="w-3 h-3" />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleCrt}
              title={crtEnabled ? "Отключить ЭЛТ-эффект" : "Включить мягкий ЭЛТ-монитор"}
              className={`h-7 px-2 text-[10px] font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                crtEnabled ? "pc-btn-active" : "pc-btn"
              }`}
            >
              <Monitor className="w-3 h-3" />
              <span className="hidden sm:inline">ЭЛТ</span>
            </button>

            {props.onToggleFullscreen && (
              <button
                type="button"
                onClick={props.onToggleFullscreen}
                title={props.isFullscreen ? "Выйти из полного экрана" : "На весь экран"}
                className={`h-7 w-7 flex items-center justify-center cursor-pointer ${
                  props.isFullscreen ? "pc-btn-active" : "pc-btn"
                }`}
              >
                {props.isFullscreen ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>

          {cameraDrawerOpen && (
            <div className="xl:hidden pc-window p-1 flex flex-wrap items-center gap-1 max-w-[90vw] shadow-xl">
              {CAMERA_PRESET_ORDER.map((preset) => {
                const cfg = CAMERA_PRESET_META[preset];
                const isAct = activePreset === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setCameraPreset(preset);
                      setCameraDrawerOpen(false);
                    }}
                    title={cfg.title}
                    className={`h-6 px-2 text-[10px] font-bold whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                      isAct ? "pc-btn-active" : "pc-btn"
                    }`}
                  >
                    {preset === "opposite" && <Compass className="w-3 h-3 shrink-0" />}
                    <span>{cfg.shortLabel}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setZoomOffset((z) => Math.max(-0.45, z - 0.25))}
                className="pc-btn h-6 w-6 flex items-center justify-center cursor-pointer"
              >
                <ZoomOut className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  panOffsetRef.current = { x: 0, z: 0 };
                  setZoomOffset(0);
                  setCameraDrawerOpen(false);
                }}
                className="pc-btn h-6 w-6 flex items-center justify-center cursor-pointer"
              >
                <LocateFixed className="w-3 h-3 text-[#000080]" />
              </button>
              <button
                type="button"
                onClick={() => setZoomOffset((z) => Math.min(1.05, z + 0.25))}
                className="pc-btn h-6 w-6 flex items-center justify-center cursor-pointer"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Extended Bottom-Right Radar Minimap + Online Counter Badge */}
      {!props.hideHudWidgets && props.showExtendedHud && (
        <div className="hidden md:flex [@media(max-height:519px)]:!hidden fixed bottom-2 right-2 z-20 flex-col items-stretch gap-1.5">
          <div className="pc-window p-[3px]">
            <canvas
              ref={minimapCanvasRef}
              width={142}
              height={94}
              title="Тактический 3D радар — нажмите, чтобы сместить камеру"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const rx = (e.clientX - rect.left) / rect.width;
                const ry = (e.clientY - rect.top) / rect.height;
                const worldX = (rx - 0.5) * PITCH_COLS;
                const worldZ = (ry - 0.5) * PITCH_ROWS;
                panOffsetRef.current = {
                  x: Math.max(-13, Math.min(13, worldX)),
                  z: Math.max(-13, Math.min(13, worldZ)),
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
                <span>Онлайн: {props.onlineCount ?? 1}</span>
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
