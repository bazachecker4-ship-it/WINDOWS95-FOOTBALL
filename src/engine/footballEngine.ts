import {
  AIDifficulty,
  BLITZ_VARIANT_META,
  BallState,
  BlitzComplexity,
  BlitzModePreference,
  BlitzVariant,
  GOAL_ROWS,
  MoveOption,
  PITCH_COLS,
  PITCH_ROWS,
  PassOption,
  PitchType,
  PlayerPiece,
  PlayerRole,
  Position,
  ROLE_META,
  RoleProgression,
  ShotOption,
  SquadProgressionState,
  TacticalHint,
  TacticalMentality,
  Team,
} from "../types/game";

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
  // Authentic 11 vs 11 (4-3-2-1) formation on 32x32 pitch
  const players: PlayerPiece[] = [
    // Blue Team (Left side, attacks Right -> col 31)
    { id: "b-gk", team: "blue", role: "GK", number: 1, skinTone: 0, pos: { col: 1, row: 16 } },
    { id: "b-lb", team: "blue", role: "DEF", number: 3, skinTone: 1, pos: { col: 5, row: 5 } },
    { id: "b-cb1", team: "blue", role: "DEF", number: 4, skinTone: 2, pos: { col: 4, row: 12 } },
    { id: "b-cb2", team: "blue", role: "DEF", number: 5, skinTone: 0, pos: { col: 4, row: 20 } },
    { id: "b-rb", team: "blue", role: "DEF", number: 2, skinTone: 3, pos: { col: 5, row: 27 } },
    { id: "b-lm", team: "blue", role: "MID", number: 6, skinTone: 1, pos: { col: 10, row: 7 } },
    { id: "b-cm", team: "blue", role: "MID", number: 8, skinTone: 0, pos: { col: 9, row: 16 } },
    { id: "b-rm", team: "blue", role: "MID", number: 10, skinTone: 2, pos: { col: 10, row: 25 } },
    { id: "b-lw", team: "blue", role: "WNG", number: 11, skinTone: 3, pos: { col: 13, row: 4 } },
    { id: "b-rw", team: "blue", role: "WNG", number: 7, skinTone: 1, pos: { col: 13, row: 28 } },
    { id: "b-fwd", team: "blue", role: "FWD", number: 9, skinTone: 0, pos: { col: 14, row: 16 } },

    // Red Team (Right side, attacks Left -> col 0)
    { id: "r-gk", team: "red", role: "GK", number: 1, skinTone: 2, pos: { col: 30, row: 16 } },
    { id: "r-lb", team: "red", role: "DEF", number: 3, skinTone: 0, pos: { col: 26, row: 5 } },
    { id: "r-cb1", team: "red", role: "DEF", number: 4, skinTone: 3, pos: { col: 27, row: 12 } },
    { id: "r-cb2", team: "red", role: "DEF", number: 5, skinTone: 1, pos: { col: 27, row: 20 } },
    { id: "r-rb", team: "red", role: "DEF", number: 2, skinTone: 0, pos: { col: 26, row: 27 } },
    { id: "r-lm", team: "red", role: "MID", number: 6, skinTone: 2, pos: { col: 21, row: 7 } },
    { id: "r-cm", team: "red", role: "MID", number: 8, skinTone: 1, pos: { col: 22, row: 16 } },
    { id: "r-rm", team: "red", role: "MID", number: 10, skinTone: 0, pos: { col: 21, row: 25 } },
    { id: "r-lw", team: "red", role: "WNG", number: 11, skinTone: 1, pos: { col: 18, row: 4 } },
    { id: "r-rw", team: "red", role: "WNG", number: 7, skinTone: 3, pos: { col: 18, row: 28 } },
    { id: "r-fwd", team: "red", role: "FWD", number: 9, skinTone: 2, pos: { col: 17, row: 16 } },
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
  difficulty: AIDifficulty = "tactical"
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
  const speedBonus = prog.stats.speed >= 3 ? 1 : 0;
  const sandPenalty = pitchType === "sand" ? 2 : 0;
  const iceSlideBonus = pitchType === "ice" ? 2 : 0;

  const results: MoveOption[] = [];
  const seen = new Set<string>();
  const hasBall = ball.carrierId === player.id;

  const pushTarget = (
    col: number,
    row: number,
    isSlide = false
  ): "empty" | "enemy" | "ally" | "oob" => {
    if (!inBounds(col, row)) return "oob";
    const key = `${col},${row}`;
    if (obstacleSet.has(key)) return "oob";

    const occupant = occupiedMap.get(key);
    if (occupant) {
      if (occupant.team === player.team) return "ally";
      if (!seen.has(key)) {
        seen.add(key);
        const targetPos = { col, row };
        results.push({
          pos: targetPos,
          kind: "clash",
          opponentId: occupant.id,
          isSlide,
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
      }
      return "enemy";
    }

    if (!seen.has(key)) {
      seen.add(key);
      const isLooseBall =
        ball.carrierId === null && ball.pos.col === col && ball.pos.row === row;
      results.push({
        pos: { col, row },
        kind: isLooseBall ? "pickup" : "move",
        isSlide,
      });
    }
    return "empty";
  };

  const traceRay = (dc: number, dr: number, maxSteps: number) => {
    const effectiveMax = Math.max(1, maxSteps + iceSlideBonus);
    for (let step = 1; step <= effectiveMax; step++) {
      const nc = player.pos.col + dc * step;
      const nr = player.pos.row + dr * step;
      const isSlideStep = iceSlideBonus > 0 && step > maxSteps;
      const status = pushTarget(nc, nr, isSlideStep);
      if (status !== "empty") break;
    }
  };

  switch (player.role) {
    case "GK": {
      const gkRange = 2 + speedBonus;
      const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ];
      for (const [dc, dr] of dirs) {
        traceRay(dc, dr, gkRange);
      }
      break;
    }
    case "DEF": {
      const range = Math.max(2, 6 + speedBonus - sandPenalty);
      traceRay(1, 0, range);
      traceRay(-1, 0, range);
      traceRay(0, 1, range);
      traceRay(0, -1, range);
      if (prog.unlockedAbilities.includes("def_slide")) {
        traceRay(1, 1, 3);
        traceRay(1, -1, 3);
        traceRay(-1, 1, 3);
        traceRay(-1, -1, 3);
      }
      break;
    }
    case "MID": {
      const maestroBonus = prog.unlockedAbilities.includes("mid_maestro") ? 2 : 0;
      const range = Math.max(2, 7 + speedBonus + maestroBonus - sandPenalty);
      traceRay(1, 1, range);
      traceRay(1, -1, range);
      traceRay(-1, 1, range);
      traceRay(-1, -1, range);
      traceRay(1, 0, 2);
      traceRay(-1, 0, 2);
      traceRay(0, 1, 2);
      traceRay(0, -1, 2);
      break;
    }
    case "WNG": {
      const knightJumps = [
        [4, 2],
        [4, -2],
        [-4, 2],
        [-4, -2],
        [2, 4],
        [2, -4],
        [-2, 4],
        [-2, -4],
        [3, 1],
        [3, -1],
        [-3, 1],
        [-3, -1],
        [1, 3],
        [1, -3],
        [-1, 3],
        [-1, -3],
      ];
      for (const [dc, dr] of knightJumps) {
        pushTarget(player.pos.col + dc, player.pos.row + dr);
      }
      const stepRange = prog.unlockedAbilities.includes("wng_sprint")
        ? 5
        : speedBonus > 0
        ? 4
        : 3;
      traceRay(1, 0, stepRange);
      traceRay(-1, 0, stepRange);
      traceRay(0, 1, stepRange);
      traceRay(0, -1, stepRange);
      break;
    }
    case "FWD": {
      const baseRange = hasBall ? 5 : 7;
      const range = Math.max(2, baseRange + speedBonus - sandPenalty);
      const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ];
      for (const [dc, dr] of dirs) {
        traceRay(dc, dr, range);
      }
      break;
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
    if (Math.hypot(p.pos.col - projX, p.pos.row - projY) < 0.72) enemies++;
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
  const maxDist = 11.5 + (prog.stats.passing - 1) * 2.0 + iceBonus + gkKickBonus;
  const canLob = prog.stats.passing >= 3 || prog.unlockedAbilities.includes("mid_lob");

  const options: PassOption[] = [];
  for (const mate of players) {
    if (mate.team !== player.team || mate.id === player.id) continue;
    const dist = Math.hypot(mate.pos.col - player.pos.col, mate.pos.row - player.pos.row);
    if (dist > maxDist) continue;

    const blockers = countSegmentBlockers(player.pos, mate.pos, player.team, players, obstacles);
    const totalBlockers = blockers.enemies + blockers.obstacles;
    if (totalBlockers === 0) {
      options.push({ targetPlayerId: mate.id, pos: mate.pos, isLob: false });
    } else if (canLob && totalBlockers === 1) {
      options.push({ targetPlayerId: mate.id, pos: mate.pos, isLob: true });
    }
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
  difficulty: AIDifficulty = "tactical"
): ShotOption[] {
  if (ball.carrierId !== player.id) return [];

  const prog = getEffectiveRoleProg(player.team, player.role, progression, difficulty);
  const extraShootReach =
    prog.stats.accuracy >= 3 || prog.unlockedAbilities.includes("fwd_instinct") ? 2 : 0;

  const targetCol = player.team === "blue" ? PITCH_COLS - 1 : 0;
  const inShootingZone =
    player.team === "blue"
      ? player.pos.col >= PITCH_COLS - 8 - extraShootReach
      : player.pos.col <= 7 + extraShootReach;

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
          Math.abs(opp.pos.row - goalCell.row) <= 2
      );
    }

    if (!blocker) {
      const segBlocker = opponents.find((opp) => {
        const dx = goalCell.col - player.pos.col;
        const dy = goalCell.row - player.pos.row;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return false;
        const t = ((opp.pos.col - player.pos.col) * dx + (opp.pos.row - player.pos.row) * dy) / lenSq;
        if (t <= 0.05 || t >= 1.05) return false;
        const dist = Math.hypot(
          opp.pos.col - (player.pos.col + t * dx),
          opp.pos.row - (player.pos.row + t * dy)
        );
        return dist < 0.85;
      });
      if (segBlocker) blocker = segBlocker;
    }

    if (blocker) {
      shots.push({
        goalRow,
        isContested: true,
        defenderId: blocker.id,
        complexity: evaluateCollisionComplexity(
          player,
          blocker,
          goalCell,
          players,
          true,
          pitchType,
          blitzModePref,
          progression,
          difficulty
        ),
      });
    } else {
      shots.push({ goalRow, isContested: false });
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

  interface ScoredAction {
    score: number;
    hint: TacticalHint;
  }

  const candidates: ScoredAction[] = [];
  const carrier = ball.carrierId
    ? players.find((p) => p.id === ball.carrierId) ?? null
    : null;

  for (const p of myPlayers) {
    const isCarrier = carrier?.id === p.id;

    if (isCarrier) {
      const shots = getShotOptions(p, players, ball, pitchType, blitzModePref, progression, difficulty);
      for (const shot of shots) {
        if (!shot.isContested) {
          candidates.push({
            score: 1000,
            hint: {
              actionType: "shoot",
              playerId: p.id,
              goalRow: shot.goalRow,
              reason: `${ROLE_META[p.role].code} выходит на пустой угол ворот — бейте!`,
            },
          });
        } else {
          const distPenalty = Math.abs(p.pos.col - targetGoalCol) * 3;
          candidates.push({
            score: 175 - distPenalty,
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
      for (const pass of passes) {
        const receiver = myPlayers.find((m) => m.id === pass.targetPlayerId);
        if (!receiver) continue;

        const progress = (receiver.pos.col - p.pos.col) * attackDir;
        const receiverEnemyDist = Math.min(
          ...enemyPlayers.map((e) =>
            Math.hypot(e.pos.col - receiver.pos.col, e.pos.row - receiver.pos.row)
          )
        );
        const passerEnemyDist = Math.min(
          ...enemyPlayers.map((e) =>
            Math.hypot(e.pos.col - p.pos.col, e.pos.row - p.pos.row)
          )
        );

        let score = 25 + progress * 9 + (receiverEnemyDist - passerEnemyDist) * 5;
        if (receiver.role === "FWD" && progress > 0) score += 18;
        if (
          (team === "blue" && receiver.pos.col >= PITCH_COLS - 8) ||
          (team === "red" && receiver.pos.col <= 7)
        ) {
          score += 45;
        }

        candidates.push({
          score,
          hint: {
            actionType: "pass",
            playerId: p.id,
            targetPlayerId: receiver.id,
            targetPos: receiver.pos,
            reason: `${pass.isLob ? "Навесной пас" : "Пас"} на открытого ${ROLE_META[receiver.role].code} ускоряет атаку.`,
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

      if (mv.kind === "pickup") {
        score = 240 + forwardDelta * 6;
        reason = `${ROLE_META[p.role].code} забирает ничейный мяч.`;
      } else if (mv.kind === "clash") {
        const opp = enemyPlayers.find((e) => e.id === mv.opponentId);
        const oppHasBall = opp?.id === ball.carrierId;
        if (oppHasBall) {
          score = 165;
          if (mv.complexity?.size === 3) score += 20;
          reason = `Отбор у ${opp ? ROLE_META[opp.role].code : "соперника"}: ${mv.complexity?.variantName ?? "блиц-дуэль"}.`;
        } else if (isCarrier) {
          score = 15 - (mv.complexity?.size ?? 3) * 5;
          reason = `Силовой прорыв с мячом через блиц-дуэль.`;
        } else {
          score = 8;
          reason = `Навязывание стыка на фланге.`;
        }
      } else {
        if (isCarrier) {
          const enemyDistBefore = Math.min(
            ...enemyPlayers.map((e) =>
              Math.hypot(e.pos.col - p.pos.col, e.pos.row - p.pos.row)
            )
          );
          const enemyDistAfter = Math.min(
            ...enemyPlayers.map((e) =>
              Math.hypot(e.pos.col - mv.pos.col, e.pos.row - mv.pos.row)
            )
          );
          score =
            50 +
            forwardDelta * 10 +
            (10 - Math.min(10, distToGoalAfter)) * 3 +
            (enemyDistAfter > enemyDistBefore ? 8 : -3);
          reason = mv.isSlide
            ? `Скольжение по льду: ${ROLE_META[p.role].code} уходит в отрыв!`
            : `Дриблинг ${ROLE_META[p.role].code} ближе к штрафной соперника.`;
        } else if (carrier && carrier.team === team) {
          score = 15 + forwardDelta * 6 - distToGoalAfter * 0.8;
          if (p.role === "GK") score -= 35;
          reason = `Открывание ${ROLE_META[p.role].code} под передачу в атаку.`;
        } else if (carrier && carrier.team !== team) {
          const oppDistBefore = Math.hypot(p.pos.col - carrier.pos.col, p.pos.row - carrier.pos.row);
          const oppDistAfter = Math.hypot(mv.pos.col - carrier.pos.col, mv.pos.row - carrier.pos.row);
          score = 28 + (oppDistBefore - oppDistAfter) * 9;
          if (p.role === "GK") {
            const goalDist = Math.hypot(
              mv.pos.col - (team === "blue" ? 1 : PITCH_COLS - 2),
              mv.pos.row - 16
            );
            score += goalDist <= 3 ? 25 : -45;
          }
          reason = `${ROLE_META[p.role].code} прессингует и перекрывает зону мяча.`;
        } else {
          const distBefore = Math.hypot(p.pos.col - ball.pos.col, p.pos.row - ball.pos.row);
          score = 45 + (distBefore - distToBallAfter) * 12;
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

/**
 * FIFA Mobile-style live 11v11 off-ball dynamics:
 * Supporting teammates push into open lanes, defenders close space toward the ball,
 * and both goalkeepers shadow the ball vertically inside their 6-yard goalmouth.
 */
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

  // Score how relevant each off-ball player is to make a supporting/marking run
  const nextPlayers = players.map((p) => ({ ...p, pos: { ...p.pos } }));

  // 1. Goalkeepers dynamically track the ball's row within GOAL_ROWS (13..18)
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

  // 2. Outfield players closest to play make realistic 1-2 square tactical runs
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
      // Attacking off-ball run: push forward into lane ahead of ball while keeping wing spread
      const forwardBoost = p.role === "FWD" ? 2 : p.role === "WNG" ? 2 : p.role === "MID" ? 1 : 1;
      desiredCol = p.pos.col + attackDir * forwardBoost + mentalityShift * attackDir;
      // Subtle lane drift away from carrier row for better pass triangles
      const rowDiff = p.pos.row - carrier.pos.row;
      if (Math.abs(rowDiff) <= 2) {
        desiredRow += rowDiff >= 0 ? 1 : -1;
      }
    } else if (carrier && carrier.team !== p.team) {
      // Defensive compactness: step toward carrier's column/row without leaving goal exposed
      const goalSideCol = carrier.pos.col - attackDir * 2 + mentalityShift * attackDir;
      desiredCol = p.pos.col + Math.sign(goalSideCol - p.pos.col);
      desiredRow = p.pos.row + Math.sign(carrier.pos.row - p.pos.row);
    } else {
      // Loose ball: nearest teammates converge
      desiredCol = p.pos.col + Math.sign(ball.pos.col - p.pos.col);
      desiredRow = p.pos.row + Math.sign(ball.pos.row - p.pos.row);
    }

    // Clamp sensible zonal limits by role so defenders stay defensively anchored
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

    // Try diagonal/direct step, then axis fallbacks
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
