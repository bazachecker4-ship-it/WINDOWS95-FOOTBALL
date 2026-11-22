import * as THREE from "three";
import {
  GOAL_ROWS,
  HairStyle,
  JERSEY_THEME_STYLES,
  PITCH_COLS,
  PITCH_ROWS,
  PitchType,
  PlayerPiece,
  RoleAppearance,
  Team,
} from "../types/game";
import {
  createAdBoardTexture,
  createFloodlightFlareTexture,
  createGoalNetTexture,
  createJerseyBumpTexture,
  createJerseyTexture,
  createSoccerBallBumpTexture,
  createSoccerBallTexture,
  createSoftShadowTexture,
  createStadiumScoreboardTexture,
  createTrackSurfaceTexture,
} from "./pitchTextures3d";

const SKIN_HEX = [0xf5c6a5, 0xe6ae84, 0xbd7c52, 0x7c4b32];
const HAIR_HEX = [0x3b2314, 0x1e1b18, 0x111827, 0x090d16];

export function cellToWorldX(col: number): number {
  return col - (PITCH_COLS - 1) / 2;
}

export function cellToWorldZ(row: number): number {
  return row - (PITCH_ROWS - 1) / 2;
}

export function worldXToCellCol(x: number): number {
  return Math.max(0, Math.min(PITCH_COLS - 1, Math.round(x + (PITCH_COLS - 1) / 2)));
}

export function worldZToCellRow(z: number): number {
  return Math.max(0, Math.min(PITCH_ROWS - 1, Math.round(z + (PITCH_ROWS - 1) / 2)));
}

function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export interface PlayerRig3D {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftKneePivot: THREE.Group;
  rightKneePivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftElbowPivot: THREE.Group;
  rightElbowPivot: THREE.Group;
  torsoMat: THREE.MeshStandardMaterial;
  jerseyTex: THREE.CanvasTexture;
  selectionRing: THREE.Mesh;
  turnReadyRing: THREE.Mesh;
  carrierHalo: THREE.Mesh;
  fatigueRing: THREE.Mesh;
  hitCylinder: THREE.Mesh;
  playerId: string;
  lastAppearanceKey: string;
  kickTimer: number;
  kickDuration: number;
  kickYaw: number;
}

export function getAppearanceCacheKey(
  p: PlayerPiece,
  appearance?: RoleAppearance
): string {
  return `${p.team}_${p.role}_${p.number}_${p.skinTone}_${appearance?.jerseyTheme ?? "cobalt"}_${
    appearance?.jerseyPattern ?? "solid"
  }_${appearance?.hairStyle ?? "classic"}`;
}

// Sculpted athletic torso profile (LatheGeometry rotated -PI/2 so U=0.25 chest faces +Z front!)
function createAthleticTorsoGeometry(): THREE.LatheGeometry {
  const points = [
    new THREE.Vector2(0.185, 0.0), // waist hem
    new THREE.Vector2(0.205, 0.14), // lower abs
    new THREE.Vector2(0.238, 0.28), // ribcage
    new THREE.Vector2(0.278, 0.42), // broad chest & lats
    new THREE.Vector2(0.258, 0.51), // shoulder slope
    new THREE.Vector2(0.135, 0.55), // collar opening
  ];
  const geo = new THREE.LatheGeometry(points, 18);
  geo.computeVertexNormals();
  return geo;
}

export function createPlayerRig3D(
  p: PlayerPiece,
  appearance: RoleAppearance | undefined,
  anisotropy: number
): PlayerRig3D {
  const root = new THREE.Group();
  root.position.set(cellToWorldX(p.pos.col), 0, cellToWorldZ(p.pos.row));

  const isGK = p.role === "GK";
  const isDEF = p.role === "DEF";
  const isAgile = p.role === "WNG" || p.role === "FWD";
  const skinColor = SKIN_HEX[p.skinTone % SKIN_HEX.length];
  const hairColor = HAIR_HEX[p.skinTone % HAIR_HEX.length];

  let jerseyHex = p.team === "blue" ? 0x2563eb : 0xdc2626;
  if (p.team === "blue" && appearance?.jerseyTheme) {
    jerseyHex = parseInt(JERSEY_THEME_STYLES[appearance.jerseyTheme].swatch.replace("#", ""), 16);
  }
  if (isGK) {
    jerseyHex = p.team === "blue" ? 0xeab308 : 0x059669;
  }

  const shortsColor = isGK ? 0x1e293b : p.team === "blue" ? 0x1e3a8a : 0x7f1d1d;
  const cleatAccentColor =
    p.role === "FWD" ? 0xfacc15 : p.role === "WNG" ? 0x38bdf8 : p.role === "MID" ? 0x34d399 : 0xe2e8f0;
  const irisColor = p.skinTone % 2 === 0 ? 0x1d4ed8 : 0x3f2e1d;

  // Soft Radial Ground Contact Shadow
  const shadowTex = createSoftShadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.76,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const shadowDisc = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 1.02), shadowMat);
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.015;
  root.add(shadowDisc);

  // Selection ring on pitch floor
  const selRingMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const selectionRing = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.62, 30), selRingMat);
  selectionRing.rotation.x = -Math.PI / 2;
  selectionRing.position.y = 0.026;
  selectionRing.visible = false;
  root.add(selectionRing);

  // Turn-ready floor ring
  const readyMat = new THREE.MeshBasicMaterial({
    color: p.team === "blue" ? 0x38bdf8 : 0xfb7185,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const turnReadyRing = new THREE.Mesh(new THREE.RingGeometry(0.39, 0.46, 24), readyMat);
  turnReadyRing.rotation.x = -Math.PI / 2;
  turnReadyRing.position.y = 0.021;
  turnReadyRing.visible = false;
  root.add(turnReadyRing);

  // Carrier golden floor aura
  const carrierMat = new THREE.MeshBasicMaterial({
    color: 0xfde047,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const carrierHalo = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.59, 28), carrierMat);
  carrierHalo.rotation.x = -Math.PI / 2;
  carrierHalo.position.y = 0.023;
  carrierHalo.visible = false;
  root.add(carrierHalo);

  // Fatigue warning ring
  const fatigueMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const fatigueRing = new THREE.Mesh(new THREE.RingGeometry(0.58, 0.64, 24), fatigueMat);
  fatigueRing.rotation.x = -Math.PI / 2;
  fatigueRing.position.y = 0.022;
  fatigueRing.visible = false;
  root.add(fatigueRing);

  // Articulated Body Hierarchy (bottom-center ground pivot y = 0)
  const bodyPivot = new THREE.Group();
  bodyPivot.rotation.y = p.team === "blue" ? Math.PI / 2 : -Math.PI / 2;
  const physiqueScaleX = isGK ? 1.07 : isDEF ? 1.04 : isAgile ? 0.96 : 1.0;
  const physiqueScaleY = isGK ? 1.06 : isDEF ? 1.02 : 1.0;
  bodyPivot.scale.set(physiqueScaleX, physiqueScaleY, physiqueScaleX);
  root.add(bodyPivot);

  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.58, metalness: 0.04 });
  const shortsMat = new THREE.MeshStandardMaterial({ color: shortsColor, roughness: 0.78, metalness: 0.04 });
  const trimWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6, metalness: 0.05 });
  const sockMat = new THREE.MeshStandardMaterial({
    color: p.team === "blue" ? 0xf1f5f9 : 0x1e293b,
    roughness: 0.74,
  });
  const sockStripeMat = new THREE.MeshStandardMaterial({ color: jerseyHex, roughness: 0.54 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.24, metalness: 0.3 });
  const bootAccentMat = new THREE.MeshStandardMaterial({
    color: cleatAccentColor,
    roughness: 0.24,
    metalness: 0.42,
  });
  const studMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.22, metalness: 0.88 });

  // Sculpted Legs with Hip Pivot -> Thigh -> Knee Pivot -> Calf/Sock -> Multi-Part Pro Cleat (6 studs)
  const buildLeg = (offsetX: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(offsetX, 0.62, 0);

    // Shorts leg cuff + athletic side stripe
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.114, 0.12, 0.19, 14), shortsMat);
    cuff.position.y = -0.075;
    cuff.castShadow = true;
    legPivot.add(cuff);

    const sideStripe = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.175, 0.042), trimWhiteMat);
    sideStripe.position.set(offsetX < 0 ? -0.108 : 0.108, -0.075, 0);
    legPivot.add(sideStripe);

    // Muscular bare lower thigh above knee
    const lowerThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.078, 0.12, 12), skinMat);
    lowerThigh.position.y = -0.2;
    lowerThigh.castShadow = true;
    legPivot.add(lowerThigh);

    // Knee Articulation Joint (y = -0.265 from hip -> y = 0.355 world height)
    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -0.265, 0);
    legPivot.add(kneePivot);

    const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.078, 10, 8), skinMat);
    kneeCap.scale.set(0.95, 0.9, 1.05);
    kneePivot.add(kneeCap);

    // Sock Fold-Over Hoops
    const sockTop = new THREE.Mesh(new THREE.CylinderGeometry(0.081, 0.078, 0.042, 12), sockStripeMat);
    sockTop.position.y = -0.055;
    kneePivot.add(sockTop);

    const sockBand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.079, 0.024, 12), trimWhiteMat);
    sockBand.position.y = -0.088;
    kneePivot.add(sockBand);

    // Sculpted Calf + Ankle Taper
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.077, 0.054, 0.19, 12), sockMat);
    sock.position.y = -0.185;
    sock.castShadow = true;
    kneePivot.add(sock);

    // Shin-guard contour under front of sock
    const shinGuard = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.1, 4, 8), sockMat);
    shinGuard.scale.set(1.05, 1.0, 0.45);
    shinGuard.position.set(0, -0.165, 0.056);
    kneePivot.add(shinGuard);

    // Multi-Part Pro Cleat (ankle collar, heel cup, vamp, laces, lateral swoosh bar, toebox, soleplate, 6 metallic studs)
    const heelCup = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.072, 0.092, 12), bootAccentMat);
    heelCup.position.set(0, -0.285, -0.044);
    kneePivot.add(heelCup);

    const bootUpper = new THREE.Mesh(new THREE.BoxGeometry(0.142, 0.084, 0.21), bootMat);
    bootUpper.position.set(0, -0.295, 0.042);
    bootUpper.castShadow = true;
    kneePivot.add(bootUpper);

    const bootLaces = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.02, 0.105), trimWhiteMat);
    bootLaces.position.set(0, -0.248, 0.082);
    bootLaces.rotation.x = 0.24;
    kneePivot.add(bootLaces);

    const bootToe = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 8), bootAccentMat);
    bootToe.scale.set(1.0, 0.56, 1.24);
    bootToe.position.set(0, -0.302, 0.158);
    kneePivot.add(bootToe);

    const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.148, 0.02, 0.268), bootAccentMat);
    bootSole.position.set(0, -0.335, 0.052);
    kneePivot.add(bootSole);

    // 6 metallic studs under cleat sole
    for (const [sx, sz] of [
      [-0.048, -0.04],
      [0.048, -0.04],
      [-0.05, 0.05],
      [0.05, 0.05],
      [-0.046, 0.142],
      [0.046, 0.142],
    ]) {
      const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.009, 0.02, 6), studMat);
      stud.position.set(sx, -0.346, sz);
      kneePivot.add(stud);
    }

    return { legPivot, kneePivot };
  };

  const leftLeg = buildLeg(-0.128);
  const rightLeg = buildLeg(0.128);
  const leftLegPivot = leftLeg.legPivot;
  const rightLegPivot = rightLeg.legPivot;
  const leftKneePivot = leftLeg.kneePivot;
  const rightKneePivot = rightLeg.kneePivot;
  bodyPivot.add(leftLegPivot, rightLegPivot);

  // Pelvis / Shorts Waistband
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.212, 0.244, 0.22, 16), shortsMat);
  pelvis.position.y = 0.69;
  pelvis.castShadow = true;
  bodyPivot.add(pelvis);

  const waistband = new THREE.Mesh(new THREE.CylinderGeometry(0.216, 0.216, 0.036, 16), trimWhiteMat);
  waistband.position.y = 0.785;
  bodyPivot.add(waistband);

  // Upper Body & Head group (supports sprinting lean & hip-shoulder counter-twist)
  const torsoGroup = new THREE.Group();
  torsoGroup.position.y = 0.78;
  bodyPivot.add(torsoGroup);

  // Sculpted Athletic Torso (LatheGeometry rotated -PI/2 so front chest crest & back number face true +Z / -Z!)
  const jerseyTex = createJerseyTexture(p.team, p.role, p.number, appearance, anisotropy);
  const jerseyBumpTex = createJerseyBumpTexture(anisotropy);
  const torsoMat = new THREE.MeshStandardMaterial({
    map: jerseyTex,
    bumpMap: jerseyBumpTex,
    bumpScale: 0.016,
    roughness: 0.62,
    metalness: 0.05,
  });
  const torsoGeo = createAthleticTorsoGeometry();
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.rotation.y = -Math.PI / 2;
  torso.castShadow = true;
  torso.receiveShadow = true;
  torsoGroup.add(torso);

  // Sculpted Raised Collar Rim around Neck
  const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.025, 8, 18), trimWhiteMat);
  collarRing.rotation.x = Math.PI / 2;
  collarRing.position.y = 0.545;
  torsoGroup.add(collarRing);

  const sleeveMat = new THREE.MeshStandardMaterial({
    color: jerseyHex,
    bumpMap: jerseyBumpTex,
    bumpScale: 0.012,
    roughness: 0.58,
  });
  const wristbandMat = new THREE.MeshStandardMaterial({
    color: p.team === "blue" ? 0xf8fafc : 0xfef08a,
    roughness: 0.65,
  });

  // Left & Right Articulated Arms (Shoulder -> Sleeve -> Elbow Pivot -> Forearm + Wristband + Hand/Glove)
  const buildArm = (offsetX: number, isCaptainArm: boolean) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(offsetX, 0.475, 0);

    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.088, 10, 8), sleeveMat);
    armPivot.add(shoulder);

    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.068, 0.19, 12), sleeveMat);
    sleeve.position.y = -0.095;
    sleeve.castShadow = true;
    armPivot.add(sleeve);

    const sleeveCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.024, 12), trimWhiteMat);
    sleeveCuff.position.y = -0.184;
    armPivot.add(sleeveCuff);

    if (isCaptainArm && (p.number === 9 || p.number === 10 || p.number === 1)) {
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.074, 0.074, 0.052, 12),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 })
      );
      band.position.y = -0.132;
      armPivot.add(band);
    }

    // Elbow Articulation Pivot (y = -0.21 from shoulder)
    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.21, 0);
    armPivot.add(elbowPivot);

    const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.056, 8, 8), skinMat);
    elbowPivot.add(elbowJoint);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.044, 0.21, 10), skinMat);
    forearm.position.y = -0.105;
    forearm.castShadow = true;
    elbowPivot.add(forearm);

    const sweatband = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.046, 0.04, 10), wristbandMat);
    sweatband.position.y = -0.185;
    elbowPivot.add(sweatband);

    if (isGK) {
      const strap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.058, 0.056, 0.045, 10),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.42 })
      );
      strap.position.y = -0.215;
      elbowPivot.add(strap);

      const glove = new THREE.Mesh(
        new THREE.SphereGeometry(0.088, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.38 })
      );
      glove.scale.set(0.88, 1.18, 1.28);
      glove.position.y = -0.275;
      elbowPivot.add(glove);

      const gloveThumb = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.022, 0.036, 4, 6),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 })
      );
      gloveThumb.position.set(offsetX < 0 ? 0.052 : -0.052, -0.255, 0.042);
      gloveThumb.rotation.x = 0.5;
      elbowPivot.add(gloveThumb);
    } else {
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 8), skinMat);
      palm.scale.set(0.9, 1.15, 1.0);
      palm.position.y = -0.235;
      elbowPivot.add(palm);

      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.028, 3, 6), skinMat);
      thumb.position.set(offsetX < 0 ? 0.038 : -0.038, -0.225, 0.028);
      thumb.rotation.x = 0.5;
      elbowPivot.add(thumb);
    }

    return { armPivot, elbowPivot };
  };

  const leftArm = buildArm(-0.312, true);
  const rightArm = buildArm(0.312, false);
  const leftArmPivot = leftArm.armPivot;
  const rightArmPivot = rightArm.armPivot;
  const leftElbowPivot = leftArm.elbowPivot;
  const rightElbowPivot = rightArm.elbowPivot;
  torsoGroup.add(leftArmPivot, rightArmPivot);

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.09, 0.11, 10), skinMat);
  neck.position.y = 0.575;
  torsoGroup.add(neck);

  // Expressive Sculpted Head (Cranium + Jawline + Ears + Eyes + Brows + Nose + Mouth + Hair)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.745, 0);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.198, 18, 14), skinMat);
  headMesh.scale.set(0.94, 1.04, 1.0);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Sculpted lower jaw & chin for natural athletic profile
  const jawMesh = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 10), skinMat);
  jawMesh.scale.set(0.96, 0.92, 1.04);
  jawMesh.position.set(0, -0.075, 0.042);
  headGroup.add(jawMesh);

  // Ears
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), skinMat);
    ear.scale.set(0.45, 0.95, 0.72);
    ear.position.set(side * 0.188, -0.01, -0.01);
    headGroup.add(ear);
  }

  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const irisMat = new THREE.MeshBasicMaterial({ color: irisColor });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x090d16 });
  const hairMat = new THREE.MeshStandardMaterial({
    color: hairColor,
    roughness: 0.76,
    metalness: 0.04,
  });

  for (const ex of [-0.066, 0.066]) {
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 8), eyeWhiteMat);
    sclera.scale.set(1.05, 0.84, 0.7);
    sclera.position.set(ex, 0.025, 0.172);
    headGroup.add(sclera);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.021, 8, 8), irisMat);
    iris.position.set(ex, 0.025, 0.19);
    headGroup.add(iris);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), pupilMat);
    pupil.position.set(ex, 0.025, 0.201);
    headGroup.add(pupil);

    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.042, 3, 6), hairMat);
    brow.rotation.z = Math.PI / 2 + (ex < 0 ? -0.08 : 0.08);
    brow.position.set(ex, 0.068, 0.182);
    headGroup.add(brow);
  }

  // Sculpted Nose Bridge
  const nose = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.036, 4, 6), skinMat);
  nose.position.set(0, -0.012, 0.195);
  nose.rotation.x = -0.22;
  headGroup.add(nose);

  const mouth = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.008, 0.042, 3, 6),
    new THREE.MeshBasicMaterial({ color: 0x7c2d12 })
  );
  mouth.rotation.z = Math.PI / 2;
  mouth.position.set(0, -0.075, 0.182);
  headGroup.add(mouth);

  const hairStyle: HairStyle = appearance?.hairStyle ?? "classic";
  if (hairStyle === "mohawk") {
    const fadeCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42),
      hairMat
    );
    fadeCap.position.y = 0.03;
    headGroup.add(fadeCap);

    const finMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.48 });
    for (let i = 0; i < 4; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.17 - i * 0.018, 7), finMat);
      spike.position.set(0, 0.225 - i * 0.015, 0.065 - i * 0.065);
      spike.rotation.x = -0.18 * i;
      headGroup.add(spike);
    }
  } else if (hairStyle === "curly") {
    const curls: Array<[number, number, number, number]> = [
      [0, 0.145, -0.02, 0.14],
      [-0.1, 0.125, 0.03, 0.11],
      [0.1, 0.125, 0.03, 0.11],
      [0, 0.135, 0.08, 0.1],
      [0, 0.12, -0.12, 0.12],
      [-0.12, 0.065, -0.08, 0.105],
      [0.12, 0.065, -0.08, 0.105],
      [-0.08, 0.02, -0.15, 0.09],
      [0.08, 0.02, -0.15, 0.09],
    ];
    for (const [cx, cy, cz, cr] of curls) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(cr, 8, 8), hairMat);
      puff.position.set(cx, cy, cz);
      headGroup.add(puff);
    }
  } else if (hairStyle === "headband") {
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.205, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.48),
      hairMat
    );
    crown.position.y = 0.02;
    headGroup.add(crown);

    const bandMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.42 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.206, 0.206, 0.052, 16), bandMat);
    band.position.y = 0.08;
    headGroup.add(band);

    for (const side of [-1, 1]) {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.14, 0.015), bandMat);
      tail.position.set(side * 0.035, 0.01, -0.208);
      tail.rotation.z = side * 0.35;
      tail.rotation.x = 0.28;
      headGroup.add(tail);
    }
  } else if (hairStyle === "helmet") {
    const shellMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.26, metalness: 0.48 });
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
      shellMat
    );
    helmet.position.y = 0.015;
    headGroup.add(helmet);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.06, 0.43),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.24 })
    );
    stripe.position.y = 0.204;
    headGroup.add(stripe);
  } else {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.204, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hairMat
    );
    cap.position.y = 0.025;
    headGroup.add(cap);

    for (const side of [-1, 1]) {
      const sb = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.095, 0.065), hairMat);
      sb.position.set(side * 0.172, 0.03, 0.065);
      headGroup.add(sb);
    }

    const fringe = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.14, 4, 8), hairMat);
    fringe.position.set(0.012, 0.135, 0.142);
    fringe.rotation.z = Math.PI / 2 - 0.12;
    fringe.rotation.x = 0.25;
    headGroup.add(fringe);

    if (isGK) {
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.03, 0.15),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.36 })
      );
      visor.position.set(0, 0.11, 0.188);
      headGroup.add(visor);
    }
  }

  torsoGroup.add(headGroup);

  // Invisible raycasting hit cylinder
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 1.88, 10), hitMat);
  hitCylinder.position.y = 0.94;
  hitCylinder.userData = { kind: "player", playerId: p.id };
  root.add(hitCylinder);

  return {
    root,
    bodyPivot,
    torsoGroup,
    headGroup,
    leftLegPivot,
    rightLegPivot,
    leftKneePivot,
    rightKneePivot,
    leftArmPivot,
    rightArmPivot,
    leftElbowPivot,
    rightElbowPivot,
    torsoMat,
    jerseyTex,
    selectionRing,
    turnReadyRing,
    carrierHalo,
    fatigueRing,
    hitCylinder,
    playerId: p.id,
    lastAppearanceKey: getAppearanceCacheKey(p, appearance),
    kickTimer: 0,
    kickDuration: 0.38,
    kickYaw: 0,
  };
}

export interface Ball3D {
  root: THREE.Group;
  sphere: THREE.Mesh;
  shadow: THREE.Mesh;
  aura: THREE.Mesh;
  texture: THREE.CanvasTexture;
  bumpTexture: THREE.CanvasTexture;
}

export function createBall3D(anisotropy: number): Ball3D {
  const root = new THREE.Group();
  const texture = createSoccerBallTexture(anisotropy);
  const bumpTexture = createSoccerBallBumpTexture(anisotropy);

  const sphereMat = new THREE.MeshPhysicalMaterial({
    map: texture,
    bumpMap: bumpTexture,
    bumpScale: 0.014,
    roughness: 0.34,
    metalness: 0.06,
    clearcoat: 0.42,
    clearcoatRoughness: 0.28,
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.26, 28, 22), sphereMat);
  sphere.position.y = 0.26;
  sphere.castShadow = true;
  root.add(sphere);

  const shadowTex = createSoftShadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.76,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.68), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.018;
  root.add(shadow);

  const auraMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const aura = new THREE.Mesh(new THREE.RingGeometry(0.29, 0.43, 24), auraMat);
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.025;
  aura.visible = false;
  root.add(aura);

  return { root, sphere, shadow, aura, texture, bumpTexture };
}

export interface GrassField3D {
  mesh: THREE.InstancedMesh;
  uniforms: { uTime: { value: number } };
  recolorForPitch: (pitchType: PitchType) => void;
}

// Single-draw-call InstancedMesh of 1,400 crossed tapered grass tufts swaying in wind via onBeforeCompile!
export function createGrassField3D(): GrassField3D {
  const tuftCount = 1400;

  // Build crossed dual-blade BufferGeometry with vertex Y from 0 to 0.15
  const positions = new Float32Array([
    // Blade A (X-oriented)
    -0.055, 0.0, 0.0,
    0.055, 0.0, 0.0,
    0.0, 0.145, 0.0,
    // Blade B (Z-oriented)
    0.0, 0.0, -0.055,
    0.0, 0.0, 0.055,
    0.0, 0.155, 0.0,
  ]);
  const normals = new Float32Array([
    0, 0.7, 0.7,
    0, 0.7, 0.7,
    0, 0.85, 0.5,
    0.7, 0.7, 0,
    0.7, 0.7, 0,
    0.5, 0.85, 0,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));

  const uniforms = { uTime: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform float uTime;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
           vec3 instPos = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
           float swayMask = clamp(position.y * 7.0, 0.0, 1.0);
           float gust = sin(uTime * 2.1 + instPos.x * 0.45 + instPos.z * 0.35) * 0.036;
           transformed.x += gust * swayMask;
           transformed.z += cos(uTime * 1.7 + instPos.z * 0.5) * 0.018 * swayMask;
         #endif`
      );
  };

  const mesh = new THREE.InstancedMesh(geo, mat, tuftCount);
  mesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const cols = new Float32Array(tuftCount);
  for (let i = 0; i < tuftCount; i++) {
    const col = hash2(i, 101) * (PITCH_COLS - 0.6) + 0.3;
    const row = hash2(i, 107) * (PITCH_ROWS - 0.6) + 0.3;
    cols[i] = col;
    dummy.position.set(cellToWorldX(col), 0.004, cellToWorldZ(row));
    dummy.rotation.set(0, hash2(i, 113) * Math.PI * 2, 0);
    const s = 0.78 + hash2(i, 127) * 0.52;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();

  const colorObj = new THREE.Color();
  const recolorForPitch = (pitchType: PitchType) => {
    if (pitchType === "ice") {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    for (let i = 0; i < tuftCount; i++) {
      const band = Math.floor(cols[i] / 2) % 2 === 0;
      if (pitchType === "sand") {
        colorObj.setHex(band ? 0xd9ad5b : 0xe9bf74);
      } else {
        colorObj.setHex(band ? 0x1c7a3d : 0x299a50);
      }
      mesh.setColorAt(i, colorObj);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  recolorForPitch("turf");
  return { mesh, uniforms, recolorForPitch };
}

export interface GoalNetRig {
  team: Team;
  group: THREE.Group;
  backNet: THREE.Mesh;
}

export interface StadiumArena3D {
  group: THREE.Group;
  crowdMesh: THREE.InstancedMesh;
  crowdBaseY: Float32Array;
  crowdPhase: Float32Array;
  cornerFlags: THREE.Mesh[];
  goalTargetMeshes: Array<{ team: Team; goalRow: number; mesh: THREE.Mesh }>;
  goals: GoalNetRig[];
  adTexture: THREE.CanvasTexture;
  scoreboardTexture: THREE.CanvasTexture;
}

export function createStadiumArena3D(anisotropy: number): StadiumArena3D {
  const group = new THREE.Group();

  // 1. Concrete Stadium Apron, Textured Athletics Track Lanes & Lush Synthetic Pitch Apron
  const apronMat = new THREE.MeshStandardMaterial({
    color: 0x243041,
    roughness: 0.9,
    metalness: 0.06,
  });
  const apron = new THREE.Mesh(new THREE.BoxGeometry(52, 0.36, 52), apronMat);
  apron.position.y = -0.24;
  apron.receiveShadow = true;
  group.add(apron);

  const trackTex = createTrackSurfaceTexture(anisotropy);
  const trackMat = new THREE.MeshStandardMaterial({
    map: trackTex,
    roughness: 0.84,
    metalness: 0.04,
  });
  const track = new THREE.Mesh(new THREE.BoxGeometry(37.6, 0.14, 37.6), trackMat);
  track.position.y = -0.11;
  track.receiveShadow = true;
  group.add(track);

  const turfApronMat = new THREE.MeshStandardMaterial({
    color: 0x165f31,
    roughness: 0.88,
    metalness: 0.03,
  });
  const turfApron = new THREE.Mesh(new THREE.BoxGeometry(34.8, 0.08, 34.4), turfApronMat);
  turfApron.position.y = -0.045;
  turfApron.receiveShadow = true;
  group.add(turfApron);

  // 2. Detailed Team Dugouts with Coach/Subs, Ball Crates & Technical Areas
  const buildDugout = (xCenter: number, teamColor: number) => {
    const dug = new THREE.Group();
    dug.position.set(xCenter, 0, -17.9);

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.55, roughness: 0.32 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.3,
      roughness: 0.2,
    });
    const seatMat = new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.6 });
    const suitMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.65 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xe6ae84, roughness: 0.65 });

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.35, 0.1), glassMat);
    backWall.position.set(0, 0.68, -0.45);
    dug.add(backWall);

    for (const sx of [-2.28, 2.28]) {
      const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.32, 0.95), glassMat);
      sideGlass.position.set(sx, 0.68, 0);
      dug.add(sideGlass);
    }

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.08, 1.2), frameMat);
    canopy.position.set(0, 1.38, 0);
    canopy.rotation.x = 0.12;
    canopy.castShadow = true;
    dug.add(canopy);

    for (let i = 0; i < 5; i++) {
      const sx = -1.6 + i * 0.8;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.42, 0.48), seatMat);
      seat.position.set(sx, 0.32, -0.15);
      seat.castShadow = true;
      dug.add(seat);

      if (i !== 2) {
        const subTorso = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.14, 0.42, 8),
          i === 0 ? suitMat : seatMat
        );
        subTorso.position.set(sx, 0.72, -0.12);
        dug.add(subTorso);
        const subHead = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), headMat);
        subHead.position.set(sx, 1.03, -0.12);
        dug.add(subHead);
      }
    }

    // Water bottle cooler crate next to dugout
    const cooler = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.36, 0.34),
      new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.45 })
    );
    cooler.position.set(2.65, 0.18, 0.1);
    dug.add(cooler);

    const techBoxMat = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const techBox = new THREE.Mesh(new THREE.RingGeometry(1.8, 1.88, 4), techBoxMat);
    techBox.rotation.x = -Math.PI / 2;
    techBox.rotation.z = Math.PI / 4;
    techBox.scale.set(1.5, 0.65, 1);
    techBox.position.set(0, 0.015, 1.15);
    dug.add(techBox);

    group.add(dug);
  };
  buildDugout(-6.5, 0x2563eb);
  buildDugout(6.5, 0xdc2626);

  // 3. Perimeter Animated LED Ad Boards
  const adTexture = createAdBoardTexture(anisotropy);
  const adMat = new THREE.MeshStandardMaterial({
    map: adTexture,
    roughness: 0.4,
    metalness: 0.12,
    emissive: 0x111827,
    emissiveIntensity: 0.48,
  });

  const makeAdWall = (w: number, d: number, x: number, z: number, ry = 0) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 0.68, d), adMat);
    wall.position.set(x, 0.34, z);
    wall.rotation.y = ry;
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
  };
  makeAdWall(34, 0.25, 0, -17.15);
  makeAdWall(34, 0.25, 0, 17.15);
  makeAdWall(12.2, 0.25, -17.35, -11.2, Math.PI / 2);
  makeAdWall(12.2, 0.25, -17.35, 11.2, Math.PI / 2);
  makeAdWall(12.2, 0.25, 17.35, -11.2, Math.PI / 2);
  makeAdWall(12.2, 0.25, 17.35, 11.2, Math.PI / 2);

  // 4. Pitch-Side Broadcast TV Cameras behind Goal Ends & Touchline
  const camBodyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.6 });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.15, metalness: 0.8 });
  const tripodMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.7 });

  const buildBroadcastCamera = (x: number, z: number, lookAtX: number, lookAtZ: number) => {
    const camGroup = new THREE.Group();
    camGroup.position.set(x, 0, z);
    camGroup.lookAt(lookAtX, 0.8, lookAtZ);

    for (const [lx, lz] of [
      [-0.22, -0.2],
      [0.22, -0.2],
      [0, 0.24],
    ]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 1.15, 6), tripodMat);
      leg.position.set(lx * 0.5, 0.54, lz * 0.5);
      leg.rotation.z = lx * 0.65;
      leg.rotation.x = -lz * 0.65;
      camGroup.add(leg);
    }
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.56), camBodyMat);
    body.position.set(0, 1.12, 0);
    body.castShadow = true;
    camGroup.add(body);

    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.28, 12), lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 1.12, 0.36);
    camGroup.add(lens);

    group.add(camGroup);
  };
  buildBroadcastCamera(-18.2, -5.2, 0, 0);
  buildBroadcastCamera(18.2, -5.2, 0, 0);
  buildBroadcastCamera(0, 17.6, 0, 0);

  // 5. Multi-Tier Surrounding Stadium Stands + Fascia + Canopy
  const standMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.85,
    metalness: 0.08,
  });
  const fasciaMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: 0x1d4ed8,
    emissiveIntensity: 0.28,
    roughness: 0.42,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.5,
    metalness: 0.4,
  });

  const buildGrandstand = (len: number, x: number, z: number, ry: number) => {
    const stand = new THREE.Group();
    stand.position.set(x, 0, z);
    stand.rotation.y = ry;

    for (let tier = 0; tier < 3; tier++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9 + tier * 0.9, 1.8), standMat);
      step.position.set(0, (0.9 + tier * 0.9) / 2, -tier * 1.65);
      step.receiveShadow = true;
      step.castShadow = true;
      stand.add(step);
    }

    const fascia = new THREE.Mesh(new THREE.BoxGeometry(len - 0.5, 0.32, 0.14), fasciaMat);
    fascia.position.set(0, 3.0, -3.25);
    stand.add(fascia);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(len + 1.4, 0.22, 4.9), roofMat);
    canopy.position.set(0, 4.85, -1.65);
    canopy.rotation.x = 0.12;
    canopy.castShadow = true;
    stand.add(canopy);

    for (let px = -len * 0.42; px <= len * 0.42; px += len * 0.42) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 4.9, 8), roofMat);
      pillar.position.set(px, 2.45, -3.6);
      stand.add(pillar);
    }

    group.add(stand);
  };

  buildGrandstand(36, 0, -19.8, 0);
  buildGrandstand(36, 0, 19.8, Math.PI);
  buildGrandstand(30, -19.8, 0, Math.PI / 2);
  buildGrandstand(30, 19.8, 0, -Math.PI / 2);

  // North Grandstand Overhead Live LED Scoreboard Gantry
  const scoreboardTexture = createStadiumScoreboardTexture(anisotropy);
  const sbFrame = new THREE.Mesh(
    new THREE.BoxGeometry(11.2, 2.9, 0.48),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.55, roughness: 0.4 })
  );
  sbFrame.position.set(0, 6.65, -21.1);
  group.add(sbFrame);

  const sbFace = new THREE.Mesh(
    new THREE.PlaneGeometry(10.6, 2.52),
    new THREE.MeshBasicMaterial({ map: scoreboardTexture })
  );
  sbFace.position.set(0, 6.65, -20.84);
  group.add(sbFace);

  // 6. Instanced Crowd Spectators
  const crowdGeo = new THREE.BoxGeometry(0.44, 0.64, 0.36);
  const crowdMat = new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0.05 });
  const crowdPositions: Array<{ x: number; y: number; z: number; color: number }> = [];
  const crowdColors = [0x3b82f6, 0x60a5fa, 0xef4444, 0xf87171, 0xfacc15, 0xe2e8f0, 0x34d399];

  for (const side of [-1, 1]) {
    for (let tier = 0; tier < 3; tier++) {
      const z = side * (19.8 + tier * 1.65);
      const y = 1.2 + tier * 0.9;
      for (let x = -16; x <= 16; x += 1.05) {
        crowdPositions.push({
          x: x + (tier % 2) * 0.45,
          y,
          z,
          color: crowdColors[Math.abs(Math.round(x * 7 + tier * 3 + side)) % crowdColors.length],
        });
      }
    }
  }
  for (const side of [-1, 1]) {
    for (let tier = 0; tier < 3; tier++) {
      const x = side * (19.8 + tier * 1.65);
      const y = 1.2 + tier * 0.9;
      for (let z = -13; z <= 13; z += 1.15) {
        crowdPositions.push({
          x,
          y,
          z: z + (tier % 2) * 0.45,
          color:
            side < 0
              ? tier === 0
                ? 0x3b82f6
                : 0x93c5fd
              : tier === 0
              ? 0xef4444
              : 0xfca5a5,
        });
      }
    }
  }

  const crowdMesh = new THREE.InstancedMesh(crowdGeo, crowdMat, crowdPositions.length);
  const crowdBaseY = new Float32Array(crowdPositions.length);
  const crowdPhase = new Float32Array(crowdPositions.length);
  const dummy = new THREE.Object3D();
  const cColor = new THREE.Color();

  crowdPositions.forEach((cp, idx) => {
    dummy.position.set(cp.x, cp.y, cp.z);
    dummy.rotation.set(0, Math.atan2(-cp.x, -cp.z), 0);
    dummy.scale.set(1, 0.9 + (idx % 3) * 0.1, 1);
    dummy.updateMatrix();
    crowdMesh.setMatrixAt(idx, dummy.matrix);
    cColor.setHex(cp.color);
    crowdMesh.setColorAt(idx, cColor);
    crowdBaseY[idx] = cp.y;
    crowdPhase[idx] = (idx * 0.73) % (Math.PI * 2);
  });
  crowdMesh.instanceMatrix.needsUpdate = true;
  if (crowdMesh.instanceColor) crowdMesh.instanceColor.needsUpdate = true;
  crowdMesh.computeBoundingSphere();
  group.add(crowdMesh);

  // 7. Four Corner Floodlight Towers with Truss Rings, Volumetric Beams & Lens Flare Halos
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.42, metalness: 0.68 });
  const lampEmissive = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfef08a,
    emissiveIntensity: 2.1,
  });
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfef9c3,
    transparent: true,
    opacity: 0.035,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const flareTex = createFloodlightFlareTexture();
  const flareMat = new THREE.SpriteMaterial({
    map: flareTex,
    color: 0xfef9c3,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  for (const [tx, tz] of [
    [-21.2, -21.2],
    [21.2, -21.2],
    [-21.2, 21.2],
    [21.2, 21.2],
  ]) {
    const tower = new THREE.Group();
    tower.position.set(tx, 0, tz);
    tower.lookAt(0, 0, 0);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.38, 14.2, 8), towerMat);
    mast.position.y = 7.1;
    mast.castShadow = true;
    tower.add(mast);

    for (const ry of [4.2, 8.2, 11.8]) {
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.14, 0.85), towerMat);
      collar.position.y = ry;
      tower.add(collar);
    }

    const rig = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.25, 0.44), towerMat);
    rig.position.set(0, 14.2, 0.25);
    rig.rotation.x = 0.45;
    tower.add(rig);

    const bulbPanel = new THREE.Mesh(new THREE.PlaneGeometry(2.65, 0.96), lampEmissive);
    bulbPanel.position.set(0, 14.12, 0.5);
    bulbPanel.rotation.x = 0.45;
    tower.add(bulbPanel);

    const flareSprite = new THREE.Sprite(flareMat);
    flareSprite.position.set(0, 14.2, 0.65);
    flareSprite.scale.set(6.5, 4.2, 1);
    tower.add(flareSprite);

    const beam = new THREE.Mesh(new THREE.ConeGeometry(7.2, 22, 16, 1, true), beamMat);
    beam.position.set(0, 7.6, 8.2);
    beam.rotation.x = -Math.PI * 0.32;
    tower.add(beam);

    group.add(tower);
  }

  // 8. Four Corner Flags with Spring Mount & Triangular Pennant
  const cornerFlags: THREE.Mesh[] = [];
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
  const flagMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
  const baseSpringMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });

  const pennantShape = new THREE.Shape();
  pennantShape.moveTo(0, -0.15);
  pennantShape.lineTo(0.48, 0);
  pennantShape.lineTo(0, 0.15);
  pennantShape.closePath();
  const pennantGeo = new THREE.ShapeGeometry(pennantShape);

  for (const [fx, fz] of [
    [-15.85, -15.85],
    [15.85, -15.85],
    [-15.85, 15.85],
    [15.85, 15.85],
  ]) {
    const springBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.1, 8), baseSpringMat);
    springBase.position.set(fx, 0.05, fz);
    group.add(springBase);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.035, 1.32, 8), poleMat);
    pole.position.set(fx, 0.66, fz);
    pole.castShadow = true;
    group.add(pole);

    const flag = new THREE.Mesh(pennantGeo, flagMat);
    flag.position.set(fx, 1.15, fz);
    group.add(flag);
    cornerFlags.push(flag);
  }

  // 9. Pro 3D Goals with Authentic Twine Netting, Curved Stanchions & Shot Slots
  const goalTargetMeshes: Array<{ team: Team; goalRow: number; mesh: THREE.Mesh }> = [];
  const goals: GoalNetRig[] = [];
  const postMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.24,
    metalness: 0.52,
  });
  const netTex = createGoalNetTexture(anisotropy);
  const netTexBack = netTex.clone();
  netTexBack.repeat.set(16, 7);
  netTexBack.needsUpdate = true;

  const netTexSide = netTex.clone();
  netTexSide.repeat.set(5, 7);
  netTexSide.needsUpdate = true;

  const netTexRoof = netTex.clone();
  netTexRoof.repeat.set(5, 16);
  netTexRoof.needsUpdate = true;

  const backNetMat = new THREE.MeshStandardMaterial({
    map: netTexBack,
    transparent: true,
    alphaTest: 0.18,
    opacity: 0.86,
    side: THREE.DoubleSide,
    roughness: 0.8,
  });
  const sideNetMat = new THREE.MeshStandardMaterial({
    map: netTexSide,
    transparent: true,
    alphaTest: 0.18,
    opacity: 0.86,
    side: THREE.DoubleSide,
    roughness: 0.8,
  });
  const roofNetMat = new THREE.MeshStandardMaterial({
    map: netTexRoof,
    transparent: true,
    alphaTest: 0.18,
    opacity: 0.86,
    side: THREE.DoubleSide,
    roughness: 0.8,
  });

  const minGoalZ = cellToWorldZ(GOAL_ROWS[0]) - 0.5;
  const maxGoalZ = cellToWorldZ(GOAL_ROWS[GOAL_ROWS.length - 1]) + 0.5;
  const goalWidth = maxGoalZ - minGoalZ;
  const goalCenterZ = (minGoalZ + maxGoalZ) / 2;
  const goalHeight = 2.25;
  const goalDepth = 2.1;

  const buildGoal = (defendingTeam: Team) => {
    const sign = defendingTeam === "blue" ? -1 : 1;
    const lineX = defendingTeam === "blue" ? -16.0 : 16.0;
    const backX = lineX + sign * goalDepth;
    const teamColorMat = new THREE.MeshStandardMaterial({
      color: defendingTeam === "blue" ? 0x2563eb : 0xdc2626,
      roughness: 0.45,
      metalness: 0.35,
    });

    const g = new THREE.Group();

    const postGeo = new THREE.CylinderGeometry(0.09, 0.09, goalHeight, 12);
    const northPost = new THREE.Mesh(postGeo, postMat);
    northPost.position.set(lineX, goalHeight / 2, minGoalZ);
    northPost.castShadow = true;

    const southPost = new THREE.Mesh(postGeo, postMat);
    southPost.position.set(lineX, goalHeight / 2, maxGoalZ);
    southPost.castShadow = true;

    const crossbar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.095, goalWidth + 0.2, 12),
      postMat
    );
    crossbar.rotation.x = Math.PI / 2;
    crossbar.position.set(lineX, goalHeight, goalCenterZ);
    crossbar.castShadow = true;

    const baseBack = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, goalWidth, 8),
      teamColorMat
    );
    baseBack.rotation.x = Math.PI / 2;
    baseBack.position.set(backX, 0.06, goalCenterZ);

    for (const sz of [minGoalZ, maxGoalZ]) {
      const sideBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, goalDepth, 8),
        teamColorMat
      );
      sideBase.rotation.z = Math.PI / 2;
      sideBase.position.set((lineX + backX) / 2, 0.06, sz);
      g.add(sideBase);

      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(lineX, goalHeight, sz),
        new THREE.Vector3(backX, goalHeight * 0.94, sz),
        new THREE.Vector3(backX, 0.06, sz),
      ]);
      const stanchion = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.05, 8, false), teamColorMat);
      stanchion.castShadow = true;
      g.add(stanchion);
    }

    const backNet = new THREE.Mesh(
      new THREE.PlaneGeometry(goalWidth, goalHeight * 0.94, 8, 4),
      backNetMat
    );
    backNet.rotation.y = Math.PI / 2;
    backNet.position.set(backX, (goalHeight * 0.94) / 2, goalCenterZ);

    const roofNet = new THREE.Mesh(new THREE.PlaneGeometry(goalDepth, goalWidth), roofNetMat);
    roofNet.rotation.x = Math.PI / 2;
    roofNet.position.set((lineX + backX) / 2, goalHeight * 0.96, goalCenterZ);

    const sideNetN = new THREE.Mesh(
      new THREE.PlaneGeometry(goalDepth, goalHeight * 0.94),
      sideNetMat
    );
    sideNetN.position.set((lineX + backX) / 2, (goalHeight * 0.94) / 2, minGoalZ);

    const sideNetS = new THREE.Mesh(
      new THREE.PlaneGeometry(goalDepth, goalHeight * 0.94),
      sideNetMat
    );
    sideNetS.position.set((lineX + backX) / 2, (goalHeight * 0.94) / 2, maxGoalZ);

    g.add(northPost, southPost, crossbar, baseBack, backNet, roofNet, sideNetN, sideNetS);

    for (const goalRow of GOAL_ROWS) {
      const slotMat = new THREE.MeshBasicMaterial({
        color: 0x22c55e,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.75, goalHeight * 0.85, 0.88), slotMat);
      slot.position.set(lineX - sign * 0.25, goalHeight * 0.44, cellToWorldZ(goalRow));
      slot.visible = false;
      slot.userData = { kind: "goalSlot", defendingTeam, goalRow };
      g.add(slot);
      goalTargetMeshes.push({ team: defendingTeam, goalRow, mesh: slot });
    }

    goals.push({ team: defendingTeam, group: g, backNet });
    group.add(g);
  };

  buildGoal("blue");
  buildGoal("red");

  return {
    group,
    crowdMesh,
    crowdBaseY,
    crowdPhase,
    cornerFlags,
    goalTargetMeshes,
    goals,
    adTexture,
    scoreboardTexture,
  };
}

export function createCone3D(): THREE.Group {
  const coneGroup = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.55 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });

  const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.72), baseMat);
  basePlate.position.y = 0.04;
  basePlate.castShadow = true;

  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.72, 12), baseMat);
  cone.position.y = 0.42;
  cone.castShadow = true;

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.16, 12), stripeMat);
  band.position.y = 0.44;

  coneGroup.add(basePlate, cone, band);
  return coneGroup;
}

export function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        if (std.map) std.map.dispose();
        if (std.bumpMap) std.bumpMap.dispose();
        if (std.roughnessMap) std.roughnessMap.dispose();
        m.dispose();
      }
    }
  });
}
