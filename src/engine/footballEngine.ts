import {
  BLITZ_VARIANT_META,
  GOAL_ROWS,
  PITCH_COLS,
  PITCH_ROWS,
  ROLE_META,
} from "../types/game.ts";
import type {
  AIDifficulty,
  BallState,
  BlitzComplexity,
  BlitzModePreference,
  BlitzPace,
  BlitzVariant,
  FormationId,
  MoveOption,
  PassOption,
  PitchType,
  PlayerPiece,
  PlayerRole,
  Position,
  RoleProgression,
  ShotOption,
  SquadProgressionState,
  TacticalHint,
  TacticalMentality,
  TacticalPressureState,
  Team,
} from "../types/game.ts";

export const ACTION_AP_COSTS = {
  moveShort: 1,
  sprint: 2,
  pass: 2,
  fastPass: 1,
  clash: 3,
  shot: 3,
  superShot: 2,
} as const;

export function computePlayerTurnBudget(
  player: PlayerPiece | null,
  progression?: SquadProgressionState,
  difficulty: AIDifficulty = "tactical",
  mentality: TacticalMentality = "balance"
): number {
  if (!player) return 5;
  const prog = getEffectiveRoleProg(player.team, player.role, progression, difficulty);
  const roleBase: Record<PlayerRole, number> = {
    GK: 4,
    DEF: 5,
    MID: 6,
    WNG: 6,
    FWD: 5,
  };
  let ap = roleBase[player.role];
  if (prog.stats.speed >= 3 || prog.stats.passing >= 3) ap += 1;
  if (
    prog.unlockedAbilities.includes("mid_maestro") ||
    prog.unlockedAbilities.includes("wng_sprint")
  ) {
    ap += 1;
  }

  const onEnemyHalf =
    player.team === "blue" ? player.pos.col >= PITCH_COLS / 2 : player.pos.col < PITCH_COLS / 2;
  if (mentality === "attack" && onEnemyHalf && (player.role === "FWD" || player.role === "WNG")) {
    ap += 1;
  } else if (
    mentality === "defend" &&
    !onEnemyHalf &&
    (player.role === "DEF" || player.role === "MID")
  ) {
    ap += 1;
  }

  if ((player.stamina ?? 100) < 35) ap -= 1;
  return Math.max(3, Math.min(8, ap));
}

export function getMoveApCost(
  from: Position,
  to: Position,
  kind: MoveOption["kind"],
  hasBall: boolean
): number {
  if (kind === "clash") return ACTION_AP_COSTS.clash;
  const dist = Math.hypot(to.col - from.col, to.row - from.row);
  if (hasBall || dist > 3.2) return ACTION_AP_COSTS.sprint;
  return ACTION_AP_COSTS.moveShort;
}

export function getPassApCost(
  passer: PlayerPiece,
  progression?: SquadProgressionState,
  difficulty: AIDifficulty = "tactical"
): number {
  const prog = getEffectiveRoleProg(passer.team, passer.role, progression, difficulty);
  if (prog.stats.passing >= 3 || prog.unlockedAbilities.includes("mid_lob")) {
    return ACTION_AP_COSTS.fastPass;
  }
  return ACTION_AP_COSTS.pass;
}

export function getShotApCost(isSuperShot = false): number {
  return isSuperShot ? ACTION_AP_COSTS.superShot : ACTION_AP_COSTS.shot;
}

export function computeSituationalTurnTime(
  ball: BallState,
  blitzPace: BlitzPace = "blitz"
): number {
  if (blitzPace === "relaxed") return 34;
  const inDangerZone = ball.pos.col <= 7 || ball.pos.col >= PITCH_COLS - 8;
  const inFinalThird = ball.pos.col <= 10 || ball.pos.col >= PITCH_COLS - 11;
  if (blitzPace === "turbo") {
    return inDangerZone ? 12 : inFinalThird ? 15 : 18;
  }
  return inDangerZone ? 16 : inFinalThird ? 19 : 24;
}

export function getOffsideLineCol(
  attackingTeam: Team,
  players: PlayerPiece[],
  ball: BallState
): number {
  const defenders = players.filter((p) => p.team !== attackingTeam);
  if (attackingTeam === "blue") {
    const sorted = [...defenders].sort((a, b) => b.pos.col - a.pos.col);
    const secondLastCol = sorted[1]?.pos.col ?? sorted[0]?.pos.col ?? PITCH_COLS - 2;
    return Math.max(PITCH_COLS / 2, secondLastCol, ball.pos.col);
  }
  const sorted = [...defenders].sort((a, b) => a.pos.col - b.pos.col);
  const secondLastCol = sorted[1]?.pos.col ?? sorted[0]?.pos.col ?? 1;
  return Math.min(PITCH_COLS / 2 - 1, secondLastCol, ball.pos.col);
}

export function getOffsidePlayerIds(
  attackingTeam: Team,
  players: PlayerPiece[],
  ball: BallState
): Set<string> {
  const lineCol = getOffsideLineCol(attackingTeam, players, ball);
  const offside = new Set<string>();
  for (const p of players) {
    if (p.team !== attackingTeam || p.role === "GK" || p.id === ball.carrierId) continue;
    if (attackingTeam === "blue") {
      if (p.pos.col >= PITCH_COLS / 2 && p.pos.col > lineCol) {
        offside.add(p.id);
      }
    } else {
      if (p.pos.col <= PITCH_COLS / 2 - 1 && p.pos.col < lineCol) {
        offside.add(p.id);
      }
    }
  }
  return offside;
}

export function applyTeamFormation(
  players: PlayerPiece[],
  team: Team,
  formationId: FormationId,
  ball: BallState,
  pitchType: PitchType = "turf"
): PlayerPiece[] {
  const mirror = (col: number) => (team === "blue" ? col : PITCH_COLS - 1 - col);
  const slotCoords: Record<FormationId, Array<{ col: number; row: number }>> = {
    "4-3-3": [
      { col: 1, row: 16 },
      { col: 5, row: 5 },
      { col: 4, row: 12 },
      { col: 4, row: 20 },
      { col: 5, row: 27 },
      { col: 10, row: 7 },
      { col: 9, row: 16 },
      { col: 10, row: 25 },
      { col: 14, row: 4 },
      { col: 14, row: 28 },
      { col: 15, row: 16 },
    ],
    "4-4-2": [
      { col: 1, row: 16 },
      { col: 5, row: 5 },
      { col: 4, row: 12 },
      { col: 4, row: 20 },
      { col: 5, row: 27 },
      { col: 10, row: 4 },
      { col: 9, row: 12 },
      { col: 9, row: 20 },
      { col: 10, row: 28 },
      { col: 14, row: 11 },
      { col: 14, row: 21 },
    ],
    "3-5-2": [
      { col: 1, row: 16 },
      { col: 4, row: 7 },
      { col: 4, row: 16 },
      { col: 4, row: 25 },
      { col: 9, row: 3 },
      { col: 10, row: 10 },
      { col: 11, row: 16 },
      { col: 10, row: 22 },
      { col: 9, row: 29 },
      { col: 14, row: 11 },
      { col: 14, row: 21 },
    ],
  };

  const occupied = new Set<string>(
    getPitchObstacles(pitchType).map((o) => `${o.col},${o.row}`)
  );
  for (const p of players) {
    if (p.team !== team) occupied.add(`${p.pos.col},${p.pos.row}`);
  }

  const teamPlayers = players.filter((p) => p.team === team);
  const roleOrder: Record<PlayerRole, number> = { GK: 0, DEF: 1, MID: 2, WNG: 3, FWD: 4 };
  const sortedTeam = [...teamPlayers].sort(
    (a, b) => roleOrder[a.role] - roleOrder[b.role] || a.number - b.number
  );

  const slots = slotCoords[formationId];
  const assignedPos = new Map<string, Position>();

  sortedTeam.forEach((p, idx) => {
    if (p.id === ball.carrierId) {
      assignedPos.set(p.id, p.pos);
      occupied.add(`${p.pos.col},${p.pos.row}`);
      return;
    }
    const rawSlot = slots[idx] ?? slots[slots.length - 1];
    const desired = { col: mirror(rawSlot.col), row: rawSlot.row };
    let placed: Position = p.pos;
    outer: for (let r = 0; r <= 4; r++) {
      for (let dc = -r; dc <= r; dc++) {
        for (let dr = -r; dr <= r; dr++) {
          const nc = desired.col + dc;
          const nr = desired.row + dr;
          const key = `${nc},${nr}`;
          if (inBounds(nc, nr) && !occupied.has(key)) {
            placed = { col: nc, row: nr };
            occupied.add(key);
            break outer;
          }
        }
      }
    }
    assignedPos.set(p.id, placed);
  });

  return players.map((p) => (assignedPos.has(p.id) ? { ...p, pos: assignedPos.get(p.id)! } : p));
}

export function samePos(a: Position, b: Position): boolean {
  return a.col === b.col && a.row === b.row;
}

export function inBounds(col: number, row: number): boolean {
  return col >= 0 && col < PITCH_COLS && row >= 0 && row < PITCH_ROWS;
}

export function isInsidePenaltyBox(pos: Position, defendingTeam: Team): boolean {
  const inRows = pos.row >= 8 && pos.row <= 23;
  if (!inRows) return false;
  return defendingTeam === "blue" ? pos.col <= 5 : pos.col >= PITCH_COLS - 6;
}

export function getPitchObstacles(pitchType: PitchType): Position[] {
  if (pitchType !== "obstacles") return [];
  return [
    { col: 11, row: 10 },
    { col: 11, row: 21 },
    { col: 15, row: 7 },
    { col: 15, row: 24 },
    { col: 16, row: 7 },
    { col: 16, row: 24 },
    { col: 20, row: 10 },
    { col: 20, row: 21 },
  ];
}

export function getEffectiveRoleProg(
  team: Team,
  role: PlayerRole,
  progression?: SquadProgressionState,
  difficulty: AIDifficulty = "tactical"
): RoleProgression {
  if (team === "blue" && progression) {
    return progression.roles[role];
  }
  const aiLvl = difficulty === "pro" ? 3 : difficulty === "tactical" ? 2 : 1;
  return {
    stats: {
      speed: aiLvl,
      accuracy: aiLvl,
      defense: aiLvl,
      passing: aiLvl,
    },
    unlockedAbilities:
      difficulty === "pro"
        ? role === "GK"
          ? ["gk_glove"]
          : role === "DEF"
          ? ["def_wall"]
          : role === "MID"
          ? ["mid_lob"]
          : role === "WNG"
          ? ["wng_feint"]
          : ["fwd_ice"]
        : [],
    appearance: {
      jerseyTheme: "cobalt",
      jerseyPattern: "solid",
      hairStyle: "classic",
    },
  };
}

export function createInitialFormation(): {
  players: PlayerPiece[];
  ball: BallState;
} {
  const players: PlayerPiece[] = [
    // Blue Team (Left side, attacks Right -> col 31)
    { id: "b-gk", team: "blue", role: "GK", number: 1, skinTone: 0, stamina: 100, pos: { col: 1, row: 16 } },
    { id: "b-lb", team: "blue", role: "DEF", number: 3, skinTone: 1, stamina: 100, pos: { col: 5, row: 5 } },
    { id: "b-cb1", team: "blue", role: "DEF", number: 4, skinTone: 2, stamina: 100, pos: { col: 4, row: 12 } },
    { id: "b-cb2", team: "blue", role: "DEF", number: 5, skinTone: 0, stamina: 100, pos: { col: 4, row: 20 } },
    { id: "b-rb", team: "blue", role: "DEF", number: 2, skinTone: 3, stamina: 100, pos: { col: 5, row: 27 } },
    { id: "b-lm", team: "blue", role: "MID", number: 6, skinTone: 1, stamina: 100, pos: { col: 10, row: 7 } },
    { id: "b-cm", team: "blue", role: "MID", number: 8, skinTone: 0, stamina: 100, pos: { col: 9, row: 16 } },
    { id: "b-rm", team: "blue", role: "MID", number: 10, skinTone: 2, stamina: 100, pos: { col: 10, row: 25 } },
    { id: "b-lw", team: "blue", role: "WNG", number: 11, skinTone: 3, stamina: 100, pos: { col: 13, row: 4 } },
    { id: "b-rw", team: "blue", role: "WNG", number: 7, skinTone: 1, stamina: 100, pos: { col: 13, row: 28 } },
    { id: "b-fwd", team: "blue", role: "FWD", number: 9, skinTone: 0, stamina: 100, pos: { col: 14, row: 16 } },

    // Red Team (Right side, attacks Left -> col 0)
    { id: "r-gk", team: "red", role: "GK", number: 1, skinTone: 2, stamina: 100, pos: { col: 30, row: 16 } },
    { id: "r-lb", team: "red", role: "DEF", number: 3, skinTone: 0, stamina: 100, pos: { col: 26, row: 5 } },
    { id: "r-cb1", team: "red", role: "DEF", number: 4, skinTone: 3, stamina: 100, pos: { col: 27, row: 12 } },
    { id: "r-cb2", team: "red", role: "DEF", number: 5, skinTone: 1, stamina: 100, pos: { col: 27, row: 20 } },
    { id: "r-rb", team: "red", role: "DEF", number: 2, skinTone: 0, stamina: 100, pos: { col: 26, row: 27 } },
    { id: "r-lm", team: "red", role: "MID", number: 6, skinTone: 2, stamina: 100, pos: { col: 21, row: 7 } },
    { id: "r-cm", team: "red", role: "MID", number: 8, skinTone: 1, stamina: 100, pos: { col: 22, row: 16 } },
    { id: "r-rm", team: "red", role: "MID", number: 10, skinTone: 0, stamina: 100, pos: { col: 21, row: 25 } },
    { id: "r-lw", team: "red", role: "WNG", number: 11, skinTone: 1, stamina: 100, pos: { col: 18, row: 4 } },
    { id: "r-rw", team: "red", role: "WNG", number: 7, skinTone: 3, stamina: 100, pos: { col: 18, row: 28 } },
    { id: "r-fwd", team: "red", role: "FWD", number: 9, skinTone: 2, stamina: 100, pos: { col: 17, row: 16 } },
  ];

  return {
    players,
    ball: { pos: { col: 16, row: 16 }, carrierId: null },
  };
}

function pickBlockedCells(size: 4 | 5): number[] {
  if (size === 4) {
    const pairs = [
      [1, 14],
      [2, 13],
      [4, 11],
      [7, 8],
    ];
    return pairs[Math.floor(Math.random() * pairs.length)];
  }
  return [6, 18];
}

export function evaluateCollisionComplexity(
  initiator: PlayerPiece,
  defender: PlayerPiece,
  contestedPos: Position,
  players: PlayerPiece[],
  isShotDuel = false,
  pitchType: PitchType = "turf",
  blitzModePref: BlitzModePreference = "dynamic",
  progression?: SquadProgressionState,
  difficulty: AIDifficulty = "tactical",
  isSuperShot = false
): BlitzComplexity {
  let score = 0;
  const reasons: string[] = [];

  const initProg = getEffectiveRoleProg(initiator.team, initiator.role, progression, difficulty);
  const defProg = getEffectiveRoleProg(defender.team, defender.role, progression, difficulty);

  if (isShotDuel) {
    score += 2;
    reasons.push("Удар по воротам");
  }

  if (defender.role === "GK" || initiator.role === "GK") {
    score += 1;
    reasons.push("Участие вратаря");
  }

  if (isInsidePenaltyBox(contestedPos, defender.team)) {
    score += 1;
    reasons.push("Штрафная зона");
  }

  const isDefenderOwnHalf =
    defender.team === "blue" ? contestedPos.col <= 15 : contestedPos.col >= 16;
  if (defender.role === "DEF" && isDefenderOwnHalf) {
    score += 1;
    reasons.push("Защитник в своей зоне");
  }

  if (defProg.unlockedAbilities.includes("def_wall") && defender.team !== initiator.team) {
    score += 1;
    reasons.push("Способность «Стена»");
  }

  if (isShotDuel && initProg.unlockedAbilities.includes("fwd_instinct")) {
    score = Math.max(1, score - 1);
    reasons.push("Голевое чутьё (-сложность)");
  }

  if (isShotDuel && isSuperShot) {
    score = Math.max(0, score - 1);
    reasons.push("СУПЕР-УДАР (-сложность)");
  }

  let nearbySupport = 0;
  for (const p of players) {
    if (p.id === initiator.id || p.id === defender.id) continue;
    const dc = Math.abs(p.pos.col - contestedPos.col);
    const dr = Math.abs(p.pos.row - contestedPos.row);
    if (dc <= 3 && dr <= 3) nearbySupport++;
  }
  if (nearbySupport >= 2) {
    score += 1;
    reasons.push("Плотное окружение");
  }

  if (pitchType === "sand" || pitchType === "obstacles") {
    reasons.push(pitchType === "sand" ? "Вязкий песок" : "Барьеры на поле");
  }

  let variant: BlitzVariant;
  if (blitzModePref !== "dynamic") {
    variant = blitzModePref;
  } else if (score >= 3) {
    variant = "grand";
  } else if (score === 2 || pitchType === "sand" || pitchType === "obstacles") {
    variant = "blocked";
  } else if (score === 1 || initiator.role === "WNG" || initiator.role === "MID") {
    variant = "decay";
  } else {
    variant = "classic";
  }

  if (reasons.length === 0) reasons.push("Открытый стык 1 на 1");

  switch (variant) {
    case "classic":
      return {
        size: 3,
        winLength: 3,
        variant,
        variantName: BLITZ_VARIANT_META.classic.name,
        variantDesc: BLITZ_VARIANT_META.classic.shortDesc,
        blockedCells: [],
        maxMarksPerPlayer: null,
        reasons,
        label: "Быстрый стык",
      };
    case "decay":
      return {
        size: 3,
        winLength: 3,
        variant,
        variantName: BLITZ_VARIANT_META.decay.name,
        variantDesc: BLITZ_VARIANT_META.decay.shortDesc,
        blockedCells: [],
        maxMarksPerPlayer: 3,
        reasons,
        label: "Динамический стык",
      };
    case "blocked":
      return {
        size: 4,
        winLength: 3,
        variant,
        variantName: BLITZ_VARIANT_META.blocked.name,
        variantDesc: BLITZ_VARIANT_META.blocked.shortDesc,
        blockedCells: pickBlockedCells(4),
        maxMarksPerPlayer: null,
        reasons,
        label: "Сложный прессинг",
      };
    case "grand":
      return {
        size: 5,
        winLength: 4,
        variant,
        variantName: BLITZ_VARIANT_META.grand.name,
        variantDesc: BLITZ_VARIANT_META.grand.shortDesc,
        blockedCells: [],
        maxMarksPerPlayer: null,
        reasons,
        label: "Острейший момент",
      };
  }
}

export function computeDuelBonusTimes(
  initiator: PlayerPiece,
  defender: PlayerPiece,
  isShotDuel: boolean,
  progression?: SquadProgressionState,
  difficulty: AIDifficulty = "tactical"
): { blueBonusMs: number; redBonusMs: number } {
  let blueBonusMs = 0;
  let redBonusMs = 0;

  const applyBonus = (piece: PlayerPiece, isInitiator: boolean) => {
    const prog = getEffectiveRoleProg(piece.team, piece.role, progression, difficulty);
    let bonus = 0;
    if (!isInitiator) {
      bonus += (prog.stats.defense - 1) * 300;
    } else if (isShotDuel) {
      bonus += (prog.stats.accuracy - 1) * 250;
    }
    if (prog.unlockedAbilities.includes("gk_glove") && piece.role === "GK") bonus += 900;
    if (prog.unlockedAbilities.includes("def_wall") && piece.role === "DEF") bonus += 800;
    if (prog.unlockedAbilities.includes("wng_feint") && isInitiator && piece.role === "WNG") bonus += 900;
    if (prog.unlockedAbilities.includes("fwd_ice") && isShotDuel && piece.role === "FWD") bonus += 1000;

    if (piece.team === "blue") blueBonusMs += bonus;
    else redBonusMs += bonus;
  };

  applyBonus(initiator, true);
  applyBonus(defender, false);
  return { blueBonusMs, redBonusMs };
}

export function computeTacticalPressure(
  player: PlayerPiece,
  players: PlayerPiece[]
): TacticalPressureState {
  if (player.role === "GK") {
    return {
      level: "free",
      frontBlockers: 0,
      adjacentEnemies: 0,
      reason: "Вратарь контролирует штрафную.",
    };
  }

  const attackDir = player.team === "blue" ? 1 : -1;
  let frontBlockers = 0;
  let adjacentEnemies = 0;

  for (const opp of players) {
    if (opp.team === player.team) continue;
    const dist = Math.hypot(opp.pos.col - player.pos.col, opp.pos.row - player.pos.row);
    if (dist <= 1.65) {
      adjacentEnemies += 1;
    }

    const forwardDelta = (opp.pos.col - player.pos.col) * attackDir;
    const rowDelta = Math.abs(opp.pos.row - player.pos.row);
    const inForwardWall = forwardDelta >= 0 && forwardDelta <= 4.5 && rowDelta <= 2.6;
    const tightPress = dist <= 1.55 && forwardDelta >= -0.5;
    if (inForwardWall || tightPress) {
      frontBlockers += 1;
    }
  }

  if (frontBlockers >= 3) {
    return {
      level: "retreat_only",
      frontBlockers,
      adjacentEnemies,
      reason: `Тройной блок (${frontBlockers} защ.) — можно только отойти назад или отдать пас!`,
    };
  }
  if (frontBlockers === 2) {
    return {
      level: "forward_blocked",
      frontBlockers,
      adjacentEnemies,
      reason: "2 защитника впереди — путь вперёд закрыт! Пасуйте или уходите во фланг/назад.",
    };
  }
  if (frontBlockers === 1) {
    return {
      level: "marked",
      frontBlockers,
      adjacentEnemies,
      reason: "Опека 1 соперника впереди — ищите пас или смещайтесь в полуфланг.",
    };
  }

  return {
    level: "free",
    frontBlockers: 0,
    adjacentEnemies,
    reason: "Чистый коридор для продвижения.",
  };
}

/**
 * Checks whether a 360-degree movement corridor from `from` to `to` is free of
 * traffic walls/obstacles. Wingers (`allowSlalom = true`) can weave around 1
 * intermediate body along the lane, simulating wide 1v1 slalom dribbling.
 */
function isMovementCorridorClear(
  from: Position,
  to: Position,
  occupiedMap: Map<string, PlayerPiece>,
  obstacleSet: Set<string>,
  allowSlalom: boolean
): boolean {
  const dc = to.col - from.col;
  const dr = to.row - from.row;
  const dist = Math.hypot(dc, dr);
  if (dist <= 1.5) return true;

  const samples = Math.max(2, Math.ceil(dist * 2.2));
  const hitKeys = new Set<string>();
  let obstacleHit = false;

  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    const sc = Math.round(from.col + dc * t);
    const sr = Math.round(from.row + dr * t);
    if ((sc === from.col && sr === from.row) || (sc === to.col && sr === to.row)) continue;
    const key = `${sc},${sr}`;
    if (obstacleSet.has(key)) {
      if (!allowSlalom) return false;
      obstacleHit = true;
      hitKeys.add(key);
    } else if (occupiedMap.has(key)) {
      hitKeys.add(key);
    }
  }

  if (allowSlalom) {
    return hitKeys.size <= 1 && !obstacleHit ? true : hitKeys.size <= 1;
  }
  return hitKeys.size === 0;
}

/**
 * Modern 360° Football Kinematics Engine:
 * Replaces fixed chess-piece ray rules with role-authentic directional reach
 * envelopes, ball-weight modifiers, terrain friction, slalom corridors, and
 * tactical 2/3-defender blocking physics.
 */
export function getValidMoves(
  player: PlayerPiece,
  players: PlayerPiece[],
  ball: BallState,
  pitchType: PitchType = "turf",
  blitzModePref: BlitzModePreference = "dynamic",
  progression?: SquadProgressionState,
  difficulty: AIDifficulty = "tactical"
): MoveOption[] {
  const occupiedMap = new Map<string, PlayerPiece>();
  for (const p of players) {
    occupiedMap.set(`${p.pos.col},${p.pos.row}`, p);
  }
  const obstacleSet = new Set(getPitchObstacles(pitchType).map((o) => `${o.col},${o.row}`));

  const prog = getEffectiveRoleProg(player.team, player.role, progression, difficulty);
  const speedBonus = prog.stats.speed >= 3 ? 1.15 : prog.stats.speed >= 2 ? 0.45 : 0;
  const tiredPenalty = (player.stamina ?? 100) < 30 ? 1.25 : 0;
  const sandPenalty = pitchType === "sand" ? 1.65 : 0;
  const iceSlideBonus = pitchType === "ice" ? 2.0 : 0;

  const pressure = computeTacticalPressure(player, players);
  const attackDir = player.team === "blue" ? 1 : -1;
  const hasBall = ball.carrierId === player.id;

  // Role-specific 360-degree elliptical tactical envelopes
  let baseRadius = 5.0;
  let forwardReach = 5.0;
  let backReach = 5.0;
  let lateralReach = 5.0;
  let allowSlalom = false;

  switch (player.role) {
    case "GK": {
      const r = 3.4 + (prog.stats.speed >= 3 ? 0.8 : 0);
      baseRadius = r;
      forwardReach = r;
      backReach = r;
      lateralReach = r;
      break;
    }
    case "DEF": {
      const slideBonus = prog.unlockedAbilities.includes("def_slide") ? 0.8 : 0;
      baseRadius = Math.max(2.3, 4.9 + speedBonus + slideBonus - sandPenalty - tiredPenalty);
      forwardReach = baseRadius * 0.92;
      backReach = baseRadius * 1.04;
      lateralReach = baseRadius * 1.08;
      break;
    }
    case "MID": {
      const maestro = prog.unlockedAbilities.includes("mid_maestro") ? 1.6 : 0;
      baseRadius = Math.max(2.6, 5.8 + speedBonus + maestro - sandPenalty - tiredPenalty);
      forwardReach = baseRadius;
      backReach = baseRadius * 0.96;
      lateralReach = baseRadius * 1.05;
      break;
    }
    case "WNG": {
      const sprintBonus = prog.unlockedAbilities.includes("wng_sprint") ? 1.4 : 0;
      // Sand hinders WNG less if sprinting on touchline slalom
      const wngSand = pitchType === "sand" ? 0.85 : 0;
      baseRadius = Math.max(3.0, 5.8 + speedBonus + sprintBonus - wngSand - tiredPenalty);
      forwardReach = baseRadius * 1.12;
      backReach = baseRadius * 0.85;
      lateralReach = baseRadius * 1.08;
      allowSlalom = true;
      break;
    }
    case "FWD": {
      const raw = hasBall ? 5.3 : 6.9;
      baseRadius = Math.max(2.6, raw + speedBonus - sandPenalty - tiredPenalty);
      forwardReach = baseRadius * 1.08;
      backReach = baseRadius * 0.86;
      lateralReach = baseRadius * 0.95;
      break;
    }
  }

  const maxSpan = Math.ceil(Math.max(forwardReach, backReach, lateralReach) + iceSlideBonus);
  const results: MoveOption[] = [];

  for (let dc = -maxSpan; dc <= maxSpan; dc++) {
    for (let dr = -maxSpan; dr <= maxSpan; dr++) {
      if (dc === 0 && dr === 0) continue;
      const col = player.pos.col + dc;
      const row = player.pos.row + dr;
      if (!inBounds(col, row)) continue;

      const key = `${col},${row}`;
      if (obstacleSet.has(key)) continue;

      // GK stays disciplined near defensive half unless rushing loose ball nearby
      if (player.role === "GK") {
        const halfLimit = player.team === "blue" ? 9 : PITCH_COLS - 10;
        const crossesTooFar = player.team === "blue" ? col > halfLimit : col < halfLimit;
        if (crossesTooFar) continue;
      }

      const forwardDelta = dc * attackDir;
      const xRadius = forwardDelta >= 0 ? forwardReach : backReach;
      const normBase = Math.hypot(dc / Math.max(1, xRadius), dr / Math.max(1, lateralReach));
      const normWithIce = Math.hypot(
        dc / Math.max(1, xRadius + iceSlideBonus),
        dr / Math.max(1, lateralReach + iceSlideBonus)
      );

      if (normWithIce > 1.02) continue;
      const isSlide = iceSlideBonus > 0 && normBase > 1.02;

      const occupant = occupiedMap.get(key);
      if (occupant) {
        if (occupant.team === player.team) continue;

        // Direct-only blitz confrontation rules
        const occupantHasBall = ball.carrierId === occupant.id;
        const looseBallNear =
          ball.carrierId === null &&
          Math.hypot(occupant.pos.col - ball.pos.col, occupant.pos.row - ball.pos.row) <= 2.2;
        const directReach = Math.hypot(dc, dr) <= 2.8;
        const canForceBreakthrough =
          hasBall &&
          directReach &&
          pressure.level !== "retreat_only" &&
          !(pressure.level === "forward_blocked" && forwardDelta > 0);
        const isDirectInteraction = occupantHasBall || looseBallNear || canForceBreakthrough;

        if (!isDirectInteraction) continue;
        if (!isMovementCorridorClear(player.pos, { col, row }, occupiedMap, obstacleSet, allowSlalom)) {
          continue;
        }

        const targetPos = { col, row };
        results.push({
          pos: targetPos,
          kind: "clash",
          opponentId: occupant.id,
          isSlide,
          apCost: getMoveApCost(player.pos, targetPos, "clash", hasBall),
          complexity: evaluateCollisionComplexity(
            player,
            occupant,
            targetPos,
            players,
            false,
            pitchType,
            blitzModePref,
            progression,
            difficulty
          ),
        });
        continue;
      }

      // Tactical 2/3-defender blocking rules
      if (pressure.level === "forward_blocked" && forwardDelta > 0) continue;
      if (pressure.level === "retreat_only" && forwardDelta >= 0) continue;

      if (!isMovementCorridorClear(player.pos, { col, row }, occupiedMap, obstacleSet, allowSlalom)) {
        continue;
      }

      const isLooseBall = ball.carrierId === null && ball.pos.col === col && ball.pos.row === row;
      const targetPos = { col, row };
      const kind = isLooseBall ? "pickup" : "move";
      results.push({
        pos: targetPos,
        kind,
        isSlide,
        apCost: getMoveApCost(player.pos, targetPos, kind, hasBall),
      });
    }
  }

  // Emergency back-line escape valve if triple-blocked with zero backward cells
  if (pressure.level === "retreat_only" && results.length === 0) {
    for (const [dc, dr] of [
      [-attackDir, 1],
      [-attackDir, -1],
      [-attackDir, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nc = player.pos.col + dc;
      const nr = player.pos.row + dr;
      const key = `${nc},${nr}`;
      if (inBounds(nc, nr) && !obstacleSet.has(key) && !occupiedMap.has(key)) {
        results.push({
          pos: { col: nc, row: nr },
          kind: "move",
          apCost: ACTION_AP_COSTS.moveShort,
        });
      }
    }
  }

  return results;
}

function countSegmentBlockers(
  from: Position,
  to: Position,
  myTeam: Team,
  players: PlayerPiece[],
  obstacles: Position[]
): { enemies: number; obstacles: number } {
  const dx = to.col - from.col;
  const dy = to.row - from.row;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { enemies: 0, obstacles: 0 };

  let enemies = 0;
  let obstacleCount = 0;

  for (const p of players) {
    if (p.team === myTeam) continue;
    if (samePos(p.pos, to) || samePos(p.pos, from)) continue;
    const t = ((p.pos.col - from.col) * dx + (p.pos.row - from.row) * dy) / lenSq;
    if (t <= 0.05 || t >= 0.95) continue;
    const projX = from.col + t * dx;
    const projY = from.row + t * dy;
    if (Math.hypot(p.pos.col - projX, p.pos.row - projY) < 0.85) enemies++;
  }

  for (const obs of obstacles) {
    const t = ((obs.col - from.col) * dx + (obs.row - from.row) * dy) / lenSq;
    if (t <= 0.05 || t >= 0.95) continue;
    const projX = from.col + t * dx;
    const projY = from.row + t * dy;
    if (Math.hypot(obs.col - projX, obs.row - projY) < 0.72) obstacleCount++;
  }

  return { enemies, obstacles: obstacleCount };
}

export function getEnemyControlZones(
  team: Team,
  players: PlayerPiece[],
  pitchType: PitchType = "turf"
): Position[] {
  const occupied = new Set(players.map((p) => `${p.pos.col},${p.pos.row}`));
  for (const obs of getPitchObstacles(pitchType)) {
    occupied.add(`${obs.col},${obs.row}`);
  }
  const seen = new Set<string>();
  const zones: Position[] = [];
  const oppDir = team === "blue" ? -1 : 1;

  for (const opp of players) {
    if (opp.team === team || opp.role === "GK") continue;
    const offsets: Array<[number, number]> =
      opp.role === "DEF" || opp.role === "MID"
        ? [
            [oppDir, 0],
            [0, -1],
            [0, 1],
            [oppDir, -1],
            [oppDir, 1],
          ]
        : [
            [oppDir, 0],
            [0, -1],
            [0, 1],
          ];

    for (const [dc, dr] of offsets) {
      const col = opp.pos.col + dc;
      const row = opp.pos.row + dr;
      if (!inBounds(col, row)) continue;
      const key = `${col},${row}`;
      if (occupied.has(key) || seen.has(key)) continue;
      seen.add(key);
      zones.push({ col, row });
    }
  }
  return zones;
}

export function getValidPasses(
  player: PlayerPiece,
  players: PlayerPiece[],
  ball: BallState,
  pitchType: PitchType = "turf",
  progression?: SquadProgressionState,
  difficulty: AIDifficulty = "tactical"
): PassOption[] {
  if (ball.carrierId !== player.id) return [];

  const prog = getEffectiveRoleProg(player.team, player.role, progression, difficulty);
  const obstacles = getPitchObstacles(pitchType);
  const iceBonus = pitchType === "ice" ? 3.5 : 0;
  const gkKickBonus =
    player.role === "GK" && prog.unlockedAbilities.includes("gk_longkick") ? 6.0 : 0;
  const maxDist = 12.0 + (prog.stats.passing - 1) * 2.0 + iceBonus + gkKickBonus;
  const canLob = prog.stats.passing >= 3 || prog.unlockedAbilities.includes("mid_lob");
  const offsideSet = getOffsidePlayerIds(player.team, players, ball);
  const apCost = getPassApCost(player, progression, difficulty);
  const attackDir = player.team === "blue" ? 1 : -1;
  const enemies = players.filter((p) => p.team !== player.team);

  const options: PassOption[] = [];
  for (const mate of players) {
    if (mate.team !== player.team || mate.id === player.id) continue;
    const dist = Math.hypot(mate.pos.col - player.pos.col, mate.pos.row - player.pos.row);
    if (dist > maxDist) continue;

    const blockers = countSegmentBlockers(player.pos, mate.pos, player.team, players, obstacles);
    const totalBlockers = blockers.enemies + blockers.obstacles;
    if (totalBlockers > 1 || (totalBlockers === 1 && !canLob)) continue;

    const isOffside = offsideSet.has(mate.id);
    const forwardProgress = (mate.pos.col - player.pos.col) * attackDir;
    const recMinEnemyDist = enemies.reduce((best, opp) => {
      const d = Math.hypot(opp.pos.col - mate.pos.col, opp.pos.row - mate.pos.row);
      return d < best ? d : best;
    }, 99);
    const inTargetShootZone =
      mate.team === "blue" ? mate.pos.col >= PITCH_COLS - 9 : mate.pos.col <= 8;
    const isKeyPass =
      !isOffside &&
      mate.role !== "GK" &&
      forwardProgress >= 2 &&
      (inTargetShootZone || (recMinEnemyDist >= 2.5 && forwardProgress >= 4));
    const interceptionRisk: "safe" | "tight" =
      totalBlockers === 1 || recMinEnemyDist <= 1.75 ? "tight" : "safe";

    options.push({
      targetPlayerId: mate.id,
      pos: mate.pos,
      isLob: totalBlockers === 1,
      isOffside,
      isKeyPass,
      interceptionRisk,
      apCost,
    });
  }
  return options;
}

export function getShotOptions(
  player: PlayerPiece,
  players: PlayerPiece[],
  ball: BallState,
  pitchType: PitchType = "turf",
  blitzModePref: BlitzModePreference = "dynamic",
  progression?: SquadProgressionState,
  difficulty: AIDifficulty = "tactical",
  isSuperShot = false
): ShotOption[] {
  if (ball.carrierId !== player.id) return [];

  const prog = getEffectiveRoleProg(player.team, player.role, progression, difficulty);
  const extraShootReach =
    prog.stats.accuracy >= 3 || prog.unlockedAbilities.includes("fwd_instinct") ? 2 : 0;

  const targetCol = player.team === "blue" ? PITCH_COLS - 1 : 0;
  const inShootingZone =
    player.team === "blue"
      ? player.pos.col >= PITCH_COLS - 9 - extraShootReach
      : player.pos.col <= 8 + extraShootReach;

  if (!inShootingZone) return [];

  const opponents = players.filter((p) => p.team !== player.team);
  const shots: ShotOption[] = [];

  for (const goalRow of GOAL_ROWS) {
    const goalCell: Position = { col: targetCol, row: goalRow };
    let blocker = opponents.find((opp) => samePos(opp.pos, goalCell));

    if (!blocker) {
      blocker = opponents.find(
        (opp) =>
          opp.role === "GK" &&
          Math.abs(opp.pos.col - goalCell.col) <= 2 &&
          Math.abs(opp.pos.row - goalCell.row) <= 1
      );
    }

    if (!blocker) {
      const segBlocker = opponents.find((opp) => {
        const dx = goalCell.col - player.pos.col;
        const dy = goalCell.row - player.pos.row;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return false;
        const t = ((opp.pos.col - player.pos.col) * dx + (opp.pos.row - player.pos.row) * dy) / lenSq;
        if (t <= 0.05 || t >= 1.0) return false;
        const dist = Math.hypot(
          opp.pos.col - (player.pos.col + t * dx),
          opp.pos.row - (player.pos.row + t * dy)
        );
        return dist < 0.65;
      });
      if (segBlocker) blocker = segBlocker;
    }

    const shotApCost = getShotApCost(isSuperShot);
    if (blocker) {
      shots.push({
        goalRow,
        isContested: true,
        defenderId: blocker.id,
        apCost: shotApCost,
        complexity: evaluateCollisionComplexity(
          player,
          blocker,
          goalCell,
          players,
          true,
          pitchType,
          blitzModePref,
          progression,
          difficulty,
          isSuperShot
        ),
      });
    } else {
      shots.push({ goalRow, isContested: false, apCost: shotApCost });
    }
  }

  return shots;
}

export function findSafeKnockbackSquare(
  loser: PlayerPiece,
  occupiedPos: Position,
  players: PlayerPiece[],
  ignoreId?: string,
  pitchType: PitchType = "turf"
): Position {
  const occupied = new Set<string>();
  occupied.add(`${occupiedPos.col},${occupiedPos.row}`);
  for (const obs of getPitchObstacles(pitchType)) {
    occupied.add(`${obs.col},${obs.row}`);
  }
  for (const p of players) {
    if (p.id === loser.id || p.id === ignoreId) continue;
    occupied.add(`${p.pos.col},${p.pos.row}`);
  }

  const retreatDir = loser.team === "blue" ? -1 : 1;
  const candidates: Position[] = [];

  for (let radius = 1; radius <= 4; radius++) {
    for (let dc = -radius; dc <= radius; dc++) {
      for (let dr = -radius; dr <= radius; dr++) {
        if (dc === 0 && dr === 0) continue;
        const col = occupiedPos.col + dc;
        const row = occupiedPos.row + dr;
        if (!inBounds(col, row)) continue;
        if (occupied.has(`${col},${row}`)) continue;
        candidates.push({ col, row });
      }
    }
    if (candidates.length > 0) break;
  }

  if (candidates.length === 0) return loser.pos;

  candidates.sort((a, b) => {
    const aRetreat = (a.col - occupiedPos.col) * retreatDir;
    const bRetreat = (b.col - occupiedPos.col) * retreatDir;
    if (aRetreat !== bRetreat) return bRetreat - aRetreat;
    return Math.abs(a.row - 16) - Math.abs(b.row - 16);
  });

  return candidates[0];
}

export function computeBestTacticalMove(
  team: Team,
  players: PlayerPiece[],
  ball: BallState,
  difficulty: AIDifficulty,
  pitchType: PitchType = "turf",
  blitzModePref: BlitzModePreference = "dynamic",
  progression?: SquadProgressionState
): TacticalHint | null {
  const myPlayers = players.filter((p) => p.team === team);
  const enemyPlayers = players.filter((p) => p.team !== team);
  const attackDir = team === "blue" ? 1 : -1;
  const targetGoalCol = team === "blue" ? PITCH_COLS - 1 : 0;
  const ownGoalCol = team === "blue" ? 1 : PITCH_COLS - 2;

  interface ScoredAction {
    score: number;
    hint: TacticalHint;
  }

  const candidates: ScoredAction[] = [];
  const carrier = ball.carrierId
    ? players.find((p) => p.id === ball.carrierId) ?? null
    : null;

  const minEnemyDistAt = (pos: Position): number => {
    let best = 99;
    for (const e of enemyPlayers) {
      const d = Math.hypot(e.pos.col - pos.col, e.pos.row - pos.row);
      if (d < best) best = d;
    }
    return best;
  };

  const countOpenGoalAngles = (shooterPos: Position): number => {
    let open = 0;
    for (const gr of GOAL_ROWS) {
      const blocked = enemyPlayers.some((opp) => {
        if (opp.pos.col === targetGoalCol && opp.pos.row === gr) return true;
        if (
          opp.role === "GK" &&
          Math.abs(opp.pos.col - targetGoalCol) <= 2 &&
          Math.abs(opp.pos.row - gr) <= 2
        ) {
          return true;
        }
        const dx = targetGoalCol - shooterPos.col;
        const dy = gr - shooterPos.row;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return false;
        const t = ((opp.pos.col - shooterPos.col) * dx + (opp.pos.row - shooterPos.row) * dy) / lenSq;
        if (t <= 0.05 || t >= 1.05) return false;
        const dist = Math.hypot(
          opp.pos.col - (shooterPos.col + t * dx),
          opp.pos.row - (shooterPos.row + t * dy)
        );
        return dist < 0.85;
      });
      if (!blocked) open++;
    }
    return open;
  };

  const dangerousEnemyTarget =
    carrier && carrier.team !== team
      ? enemyPlayers
          .filter((e) => e.id !== carrier.id && e.role !== "GK")
          .sort(
            (a, b) =>
              Math.hypot(a.pos.col - ownGoalCol, a.pos.row - 16) -
              Math.hypot(b.pos.col - ownGoalCol, b.pos.row - 16)
          )[0] ?? null
      : null;

  const isPro = difficulty === "pro";
  const isTactical = difficulty === "tactical" || isPro;

  for (const p of myPlayers) {
    const isCarrier = carrier?.id === p.id;
    const stam = p.stamina ?? 100;
    const fatiguePenalty = stam < 30 ? 14 : 0;

    if (isCarrier) {
      const shots = getShotOptions(p, players, ball, pitchType, blitzModePref, progression, difficulty);
      const bestPassAvailable = getValidPasses(p, players, ball, pitchType, progression, difficulty).some(
        (pass) => {
          const rec = myPlayers.find((m) => m.id === pass.targetPlayerId);
          return rec && Math.abs(rec.pos.col - targetGoalCol) <= 6 && minEnemyDistAt(rec.pos) >= 2.2;
        }
      );

      for (const shot of shots) {
        if (!shot.isContested) {
          candidates.push({
            score: 1200,
            hint: {
              actionType: "shoot",
              playerId: p.id,
              goalRow: shot.goalRow,
              reason: `${ROLE_META[p.role].code} выходит на открытый угол ворот — бейте!`,
            },
          });
        } else {
          const distPenalty = Math.abs(p.pos.col - targetGoalCol) * 3.5;
          const sizePenalty = (shot.complexity?.size ?? 3) >= 5 ? 38 : (shot.complexity?.size ?? 3) === 4 ? 12 : 0;
          const forcePenalty = isTactical && bestPassAvailable && sizePenalty > 15 ? 45 : 0;
          candidates.push({
            score: 215 - distPenalty - sizePenalty - forcePenalty,
            hint: {
              actionType: "shoot",
              playerId: p.id,
              goalRow: shot.goalRow,
              reason: `Удар в створ: ${shot.complexity?.variantName ?? "дуэль с вратарём"}!`,
            },
          });
        }
      }

      const passes = getValidPasses(p, players, ball, pitchType, progression, difficulty);
      const passerEnemyDist = minEnemyDistAt(p.pos);
      const passerCloseEnemies = enemyPlayers.filter(
        (e) => Math.hypot(e.pos.col - p.pos.col, e.pos.row - p.pos.row) <= 3.5
      ).length;

      for (const pass of passes) {
        const receiver = myPlayers.find((m) => m.id === pass.targetPlayerId);
        if (!receiver) continue;

        const progress = (receiver.pos.col - p.pos.col) * attackDir;
        const receiverEnemyDist = minEnemyDistAt(receiver.pos);
        const recGoalDist = Math.abs(receiver.pos.col - targetGoalCol);
        const flankSwitch = Math.abs(receiver.pos.row - p.pos.row) >= 7 && passerCloseEnemies >= 2 ? 22 : 0;

        let nextShotSetup = 0;
        if (isTactical && recGoalDist <= 9) {
          const openAngles = countOpenGoalAngles(receiver.pos);
          nextShotSetup = openAngles > 0 ? 95 + openAngles * 15 : 42;
        }

        const sandPassBonus = pitchType === "sand" && progress > 0 ? 22 : 0;
        const safetyBonus = receiverEnemyDist >= 2.8 ? 18 : receiverEnemyDist <= 1.5 ? -22 : 0;
        const pressEscapeBonus = passerCloseEnemies >= 2 && receiverEnemyDist > passerEnemyDist ? 26 : 0;
        const keyPassBonus = pass.isKeyPass ? 28 : 0;

        let score =
          32 +
          progress * 9.5 +
          (receiverEnemyDist - passerEnemyDist) * 6 +
          nextShotSetup +
          flankSwitch +
          sandPassBonus +
          safetyBonus +
          pressEscapeBonus +
          keyPassBonus;

        if (receiver.role === "FWD" && progress > 0) score += 22;
        if (receiver.role === "WNG" && receiverEnemyDist >= 3 && progress > 1) score += 16;
        if (recGoalDist <= 7) score += 48;
        if (receiver.role === "GK") score -= 55;
        if (pass.isOffside) score -= isTactical ? 280 : 120;

        candidates.push({
          score,
          hint: {
            actionType: "pass",
            playerId: p.id,
            targetPlayerId: receiver.id,
            targetPos: receiver.pos,
            reason:
              nextShotSetup >= 95
                ? `Проникающий пас на ${ROLE_META[receiver.role].code} под открытый удар!`
                : pass.isKeyPass
                ? `Голевой пас на свободного ${ROLE_META[receiver.role].code} взламывает оборону!`
                : `${pass.isLob ? "Навесной пас" : "Пас"} на свободного ${ROLE_META[receiver.role].code} ускоряет атаку.`,
          },
        });
      }
    }

    const moves = getValidMoves(p, players, ball, pitchType, blitzModePref, progression, difficulty);
    for (const mv of moves) {
      let score = 0;
      let reason = "";

      const forwardDelta = (mv.pos.col - p.pos.col) * attackDir;
      const distToBallAfter = Math.hypot(mv.pos.col - ball.pos.col, mv.pos.row - ball.pos.row);
      const distToGoalAfter = Math.hypot(mv.pos.col - targetGoalCol, mv.pos.row - 16);
      const enemyDistAfter = minEnemyDistAt(mv.pos);

      if (mv.kind === "pickup") {
        score = 265 + forwardDelta * 7 + (enemyDistAfter >= 2 ? 25 : 0);
        reason = `${ROLE_META[p.role].code} забирает ничейный мяч.`;
      } else if (mv.kind === "clash") {
        const opp = enemyPlayers.find((e) => e.id === mv.opponentId);
        const oppHasBall = opp?.id === ball.carrierId;
        const sizeFactor = mv.complexity?.size ?? 3;
        if (oppHasBall) {
          const dangerToGoal = Math.max(0, 14 - Math.abs((opp?.pos.col ?? 16) - ownGoalCol)) * 4;
          score = 175 + dangerToGoal + (sizeFactor === 3 ? 28 : sizeFactor === 4 ? 8 : -15);
          reason = `Прессинг и отбор у ${opp ? ROLE_META[opp.role].code : "соперника"} (${mv.complexity?.variantName ?? "блиц"}).`;
        } else if (isCarrier) {
          const nearBoxBonus = Math.abs(mv.pos.col - targetGoalCol) <= 6 ? 35 : 0;
          score = 12 + nearBoxBonus - sizeFactor * 7;
          reason = `Силовой прорыв с мячом через блиц-дуэль.`;
        } else {
          score = 4 - sizeFactor * 2;
          reason = `Навязывание стыка на фланге.`;
        }
      } else {
        if (isCarrier) {
          const enemyDistBefore = minEnemyDistAt(p.pos);
          const entersShootZone =
            team === "blue" ? mv.pos.col >= PITCH_COLS - 8 : mv.pos.col <= 7;
          const openShotScore =
            isTactical && entersShootZone ? countOpenGoalAngles(mv.pos) * 16 + 34 : 0;
          const trapPenalty =
            isTactical && enemyDistAfter <= 1.5 && Math.abs(mv.pos.col - targetGoalCol) > 6
              ? isPro
                ? -38
                : -22
              : 0;
          const slideBonus = mv.isSlide && forwardDelta > 0 ? 18 : 0;
          const sandDribblePenalty = pitchType === "sand" && !mv.isSlide ? -10 : 0;

          score =
            58 +
            forwardDelta * 10.5 +
            (11 - Math.min(11, distToGoalAfter)) * 3.4 +
            (enemyDistAfter > enemyDistBefore ? 12 : -4) +
            openShotScore +
            trapPenalty +
            slideBonus +
            sandDribblePenalty;

          reason = mv.isSlide
            ? `Скольжение по льду: ${ROLE_META[p.role].code} уходит в отрыв!`
            : openShotScore >= 50
            ? `${ROLE_META[p.role].code} выходит на ударную позицию у штрафной!`
            : `Дриблинг ${ROLE_META[p.role].code} ближе к воротам соперника.`;
        } else if (carrier && carrier.team === team) {
          const receiverSpaceBonus = enemyDistAfter >= 3 ? 12 : -6;
          const laneSpread = Math.abs(mv.pos.row - carrier.pos.row) >= 4 ? 10 : -5;
          const wngJumpBonus = pitchType === "obstacles" && p.role === "WNG" && forwardDelta >= 3 ? 16 : 0;
          score =
            16 +
            forwardDelta * 6.5 -
            distToGoalAfter * 0.9 +
            receiverSpaceBonus +
            laneSpread +
            wngJumpBonus -
            fatiguePenalty;
          if (p.role === "GK") score -= 45;
          reason = `Открывание ${ROLE_META[p.role].code} в свободную зону под пас.`;
        } else if (carrier && carrier.team !== team) {
          const oppDistBefore = Math.hypot(p.pos.col - carrier.pos.col, p.pos.row - carrier.pos.row);
          const oppDistAfter = Math.hypot(mv.pos.col - carrier.pos.col, mv.pos.row - carrier.pos.row);

          const isGoalSide =
            team === "blue" ? mv.pos.col <= carrier.pos.col : mv.pos.col >= carrier.pos.col;
          const goalSideBonus = isGoalSide ? 18 : -16;

          let laneBlockBonus = 0;
          if (isTactical && dangerousEnemyTarget) {
            const dx = dangerousEnemyTarget.pos.col - carrier.pos.col;
            const dy = dangerousEnemyTarget.pos.row - carrier.pos.row;
            const lenSq = dx * dx + dy * dy;
            if (lenSq > 0) {
              const t =
                ((mv.pos.col - carrier.pos.col) * dx + (mv.pos.row - carrier.pos.row) * dy) / lenSq;
              if (t > 0.1 && t < 0.9) {
                const distToLine = Math.hypot(
                  mv.pos.col - (carrier.pos.col + t * dx),
                  mv.pos.row - (carrier.pos.row + t * dy)
                );
                if (distToLine < 1.6) laneBlockBonus = 24;
              }
            }
          }

          score = 30 + (oppDistBefore - oppDistAfter) * 9 + goalSideBonus + laneBlockBonus - fatiguePenalty * 0.5;
          if (p.role === "GK") {
            const goalDist = Math.hypot(mv.pos.col - ownGoalCol, mv.pos.row - Math.max(13, Math.min(18, ball.pos.row)));
            score += goalDist <= 2 ? 32 : -55;
          }
          reason =
            laneBlockBonus > 0
              ? `${ROLE_META[p.role].code} перекрывает линию передачи и страхует зону.`
              : `${ROLE_META[p.role].code} прессингует и сужает пространство у мяча.`;
        } else {
          const distBefore = Math.hypot(p.pos.col - ball.pos.col, p.pos.row - ball.pos.row);
          score = 48 + (distBefore - distToBallAfter) * 13 - fatiguePenalty * 0.4;
          if (p.role === "GK") score -= 35;
          reason = `${ROLE_META[p.role].code} сближается с ничейным мячом.`;
        }
      }

      candidates.push({
        score,
        hint: {
          actionType: "move",
          playerId: p.id,
          targetPos: mv.pos,
          reason,
        },
      });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);

  if (difficulty === "rookie" && candidates.length > 3) {
    const topSlice = candidates.slice(0, Math.min(5, candidates.length));
    return topSlice[Math.floor(Math.random() * topSlice.length)].hint;
  }

  return candidates[0].hint;
}

export function applyDynamicOffBallRuns(
  players: PlayerPiece[],
  activePlayerId: string,
  ball: BallState,
  pitchType: PitchType,
  blueMentality: TacticalMentality = "balance"
): PlayerPiece[] {
  const obstacles = getPitchObstacles(pitchType);
  const occupied = new Set<string>(
    players.map((p) => `${p.pos.col},${p.pos.row}`).concat(obstacles.map((o) => `${o.col},${o.row}`))
  );
  occupied.add(`${ball.pos.col},${ball.pos.row}`);

  const carrier = ball.carrierId ? players.find((p) => p.id === ball.carrierId) ?? null : null;
  const nextPlayers = players.map((p) => ({ ...p, pos: { ...p.pos } }));

  for (const p of nextPlayers) {
    if (p.role !== "GK" || p.id === activePlayerId || p.id === ball.carrierId) continue;
    const desiredCol = p.team === "blue" ? 1 : PITCH_COLS - 2;
    const desiredRow = Math.max(13, Math.min(18, ball.pos.row));
    const stepCol = Math.sign(desiredCol - p.pos.col);
    const stepRow = Math.sign(desiredRow - p.pos.row);
    const targetCol = p.pos.col + stepCol;
    const targetRow = p.pos.row + stepRow;
    const key = `${targetCol},${targetRow}`;
    if (inBounds(targetCol, targetRow) && !occupied.has(key)) {
      occupied.delete(`${p.pos.col},${p.pos.row}`);
      p.pos = { col: targetCol, row: targetRow };
      occupied.add(key);
    }
  }

  const outfieldCandidates = nextPlayers
    .filter((p) => p.role !== "GK" && p.id !== activePlayerId && p.id !== ball.carrierId)
    .map((p) => ({
      player: p,
      dist: Math.hypot(p.pos.col - ball.pos.col, p.pos.row - ball.pos.row),
    }))
    .sort((a, b) => a.dist - b.dist);

  let blueMoved = 0;
  let redMoved = 0;
  const maxPerTeam = 3;

  for (const { player: p } of outfieldCandidates) {
    if (p.team === "blue" && blueMoved >= maxPerTeam) continue;
    if (p.team === "red" && redMoved >= maxPerTeam) continue;

    const attackDir = p.team === "blue" ? 1 : -1;
    const mentalityShift =
      p.team === "blue"
        ? blueMentality === "attack"
          ? 2
          : blueMentality === "defend"
          ? -2
          : 0
        : 0;

    let desiredCol = p.pos.col;
    let desiredRow = p.pos.row;

    if (carrier && carrier.team === p.team) {
      const forwardBoost = p.role === "FWD" ? 2 : p.role === "WNG" ? 2 : 1;
      desiredCol = p.pos.col + attackDir * forwardBoost + mentalityShift * attackDir;
      const rowDiff = p.pos.row - carrier.pos.row;
      if (Math.abs(rowDiff) <= 3) {
        desiredRow += rowDiff >= 0 ? 2 : -2;
      }
    } else if (carrier && carrier.team !== p.team) {
      const carrierAttackDir = -attackDir;
      const goalSideCol = carrier.pos.col + carrierAttackDir * 2 + mentalityShift * attackDir;
      const defenderOrder = p.number % 3;
      const rowOffset = defenderOrder === 0 ? 0 : defenderOrder === 1 ? -1 : 1;
      desiredCol = goalSideCol;
      desiredRow = carrier.pos.row + rowOffset;
    } else {
      desiredCol = p.pos.col + Math.sign(ball.pos.col - p.pos.col);
      desiredRow = p.pos.row + Math.sign(ball.pos.row - p.pos.row);
    }

    if (p.role === "DEF") {
      desiredCol =
        p.team === "blue"
          ? Math.min(18, Math.max(3, desiredCol))
          : Math.max(13, Math.min(28, desiredCol));
    } else {
      desiredCol = Math.max(2, Math.min(PITCH_COLS - 3, desiredCol));
    }
    desiredRow = Math.max(1, Math.min(PITCH_ROWS - 2, desiredRow));

    const stepCol = Math.max(-1, Math.min(1, desiredCol - p.pos.col));
    const stepRow = Math.max(-1, Math.min(1, desiredRow - p.pos.row));
    if (stepCol === 0 && stepRow === 0) continue;

    const tryOffsets = [
      { dc: stepCol, dr: stepRow },
      { dc: stepCol, dr: 0 },
      { dc: 0, dr: stepRow },
    ];

    for (const off of tryOffsets) {
      if (off.dc === 0 && off.dr === 0) continue;
      const nc = p.pos.col + off.dc;
      const nr = p.pos.row + off.dr;
      const key = `${nc},${nr}`;
      if (inBounds(nc, nr) && !occupied.has(key)) {
        occupied.delete(`${p.pos.col},${p.pos.row}`);
        p.pos = { col: nc, row: nr };
        occupied.add(key);
        if (p.team === "blue") blueMoved += 1;
        else redMoved += 1;
        break;
      }
    }
  }

  return nextPlayers;
}

export function updateSquadStamina(
  players: PlayerPiece[],
  actorId: string,
  moveDist: number,
  mentality: TacticalMentality = "balance"
): PlayerPiece[] {
  const actor = players.find((p) => p.id === actorId);
  const actorTeam = actor?.team;
  const drain = moveDist > 0 ? Math.min(26, 9 + Math.round(moveDist * 2.2)) : 6;
  const recover = mentality === "defend" ? 12 : mentality === "attack" ? 6 : 9;

  return players.map((p) => {
    const cur = p.stamina ?? 100;
    if (p.id === actorId) {
      return { ...p, stamina: Math.max(10, cur - drain) };
    }
    if (p.team === actorTeam) {
      return { ...p, stamina: Math.min(100, cur + recover) };
    }
    return p;
  });
}

export function getQuickSwitchCandidates(
  team: Team,
  players: PlayerPiece[],
  ball: BallState,
  limit = 4
): PlayerPiece[] {
  const teamPlayers = players.filter((p) => p.team === team);
  const carrier = ball.carrierId ? teamPlayers.find((p) => p.id === ball.carrierId) ?? null : null;

  const sorted = [...teamPlayers].sort((a, b) => {
    if (carrier && a.id === carrier.id) return -1;
    if (carrier && b.id === carrier.id) return 1;
    const aGkPenalty = a.role === "GK" ? 12 : 0;
    const bGkPenalty = b.role === "GK" ? 12 : 0;
    const da = Math.hypot(a.pos.col - ball.pos.col, a.pos.row - ball.pos.row) + aGkPenalty;
    const db = Math.hypot(b.pos.col - ball.pos.col, b.pos.row - ball.pos.row) + bGkPenalty;
    return da - db;
  });

  return sorted.slice(0, limit);
}
