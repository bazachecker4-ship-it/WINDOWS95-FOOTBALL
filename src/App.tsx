import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AIDifficulty,
  AbilityId,
  ActiveBlitzDuel,
  BallFlightEvent,
  BallState,
  BlitzModePreference,
  BlitzPace,
  CommentaryItem,
  FloatingCallout,
  GameMode,
  GamePhase,
  MAX_TURNS,
  MatchStats,
  PITCH_COLS,
  PitchType,
  PlayerPiece,
  PlayerRole,
  Position,
  ROLE_META,
  RoleAppearance,
  RoleProgression,
  SquadProgressionState,
  TARGET_GOALS,
  TacticalMentality,
  Team,
} from "./types/game";
import {
  applyDynamicOffBallRuns,
  computeBestTacticalMove,
  computeDuelBonusTimes,
  createInitialFormation,
  findSafeKnockbackSquare,
  getShotOptions,
  getValidMoves,
  getValidPasses,
  samePos,
} from "./engine/footballEngine";
import {
  awardMatchRewards,
  loadSquadProgression,
  saveSquadProgression,
  unlockRoleAbility,
  updateRoleAppearance,
  upgradeRoleStat,
} from "./engine/progression";
import { PixiPitchCanvas } from "./pixi/PixiPitchCanvas";
import { BlitzDuelModal } from "./components/BlitzDuelModal";
import { OverlayHUD } from "./components/OverlayHUD";
import { SquadModal } from "./components/SquadModal";
import { CoachModal } from "./components/CoachModal";
import { soundFX } from "./utils/sound";

interface CommentaryRequest {
  eventType:
    | "kickoff"
    | "move"
    | "pass"
    | "blitz_start"
    | "blitz_win"
    | "blitz_draw"
    | "save"
    | "goal"
    | "match_end";
  team: Team;
  playerRole?: string;
  opponentRole?: string;
  blitzSize?: number;
  blitzVariant?: string;
  pitchType: PitchType;
  complexityReasons?: string[];
  scoreBlue: number;
  scoreRed: number;
  turn: number;
  winner?: Team | "draw";
}

function emptyMatchStats(): MatchStats {
  return {
    moves: 0,
    passes: 0,
    shots: 0,
    blitzPlayed: 0,
    blitzWon: 0,
    blitzTimeouts: 0,
    roleMoves: { GK: 0, DEF: 0, MID: 0, WNG: 0, FWD: 0 },
  };
}

function instantLocalLine(req: CommentaryRequest): string {
  const teamName = req.team === "blue" ? "Синие" : "Красные";
  switch (req.eventType) {
    case "kickoff":
      return `Матч начался! ${teamName} разыгрывают мяч с центра поля.`;
    case "pass":
      return `Точный пас на ${req.playerRole || "партнёра"} — ${teamName} ускоряют атаку.`;
    case "blitz_start":
      return `Столкновение! ${req.blitzVariant || `Блиц ${req.blitzSize || 3}×${req.blitzSize || 3}`} за владение мячом!`;
    case "blitz_win":
      return `${teamName} побеждают в блиц-дуэли и забирают мяч!`;
    case "blitz_draw":
      return `Ничья в блице — мяч остаётся под текущим контролем.`;
    case "save":
      return `Сейв! Оборона выигрывает дуэль на линии ворот и забирает мяч!`;
    case "goal":
      return `ГОООЛ! ${teamName} отправляют мяч в сетку (${req.scoreBlue}:${req.scoreRed})!`;
    case "match_end":
      return req.winner === "draw"
        ? `Финальный свисток! Ничья ${req.scoreBlue}:${req.scoreRed}.`
        : `Матч окончен! ${req.winner === "blue" ? "Синие" : "Красные"} побеждают ${req.scoreBlue}:${req.scoreRed}!`;
    default:
      return `${teamName}: ${req.playerRole || "игрок"} перестраивается на поле.`;
  }
}

export default function App() {
  const initial = useMemo(() => createInitialFormation(), []);

  const [phase, setPhase] = useState<GamePhase>("TITLE_MENU");
  const [gameMode, setGameMode] = useState<GameMode>("ai");
  const [difficulty, setDifficulty] = useState<AIDifficulty>("tactical");
  const [blitzPace, setBlitzPace] = useState<BlitzPace>("blitz");
  const [pitchType, setPitchType] = useState<PitchType>("turf");
  const [blitzModePref, setBlitzModePref] = useState<BlitzModePreference>("dynamic");

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [showCoachHint, setShowCoachHint] = useState(true);

  const [squadModalOpen, setSquadModalOpen] = useState(false);
  const [coachModalOpen, setCoachModalOpen] = useState(false);
  const [progression, setProgression] = useState<SquadProgressionState>(() =>
    loadSquadProgression()
  );

  const [players, setPlayers] = useState<PlayerPiece[]>(initial.players);
  const [ball, setBall] = useState<BallState>(initial.ball);
  const [currentTurn, setCurrentTurn] = useState<Team>("blue");
  const [turnCount, setTurnCount] = useState(1);
  const [scoreBlue, setScoreBlue] = useState(0);
  const [scoreRed, setScoreRed] = useState(0);
  const [matchStats, setMatchStats] = useState<MatchStats>(emptyMatchStats);
  const [lastMatchReward, setLastMatchReward] = useState<{ xp: number; points: number } | null>(
    null
  );

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [activeDuel, setActiveDuel] = useState<ActiveBlitzDuel | null>(null);
  const [lastMoveTrace, setLastMoveTrace] = useState<{
    from: Position;
    to: Position;
    team: Team;
  } | null>(null);
  const [goalBanner, setGoalBanner] = useState<{ team: Team; text: string } | null>(null);
  const [winner, setWinner] = useState<Team | "draw" | null>(null);

  const [mentality, setMentality] = useState<TacticalMentality>("balance");
  const [momentum, setMomentum] = useState(0);
  const [comboStreak, setComboStreak] = useState(0);
  const [superDriveReady, setSuperDriveReady] = useState(false);
  const [ballFlight, setBallFlight] = useState<BallFlightEvent | null>(null);
  const [floatingCallout, setFloatingCallout] = useState<FloatingCallout | null>(null);
  const [broadcastBanner, setBroadcastBanner] = useState<{
    text: string;
    tone: "gold" | "blue" | "red";
  } | null>(null);

  const [commentaryLog, setCommentaryLog] = useState<CommentaryItem[]>([]);
  const [isCommentaryLoading, setIsCommentaryLoading] = useState(false);

  const goalTimerRef = useRef<number | null>(null);
  const aiTimerRef = useRef<number | null>(null);
  const bannerTimerRef = useRef<number | null>(null);
  const moveCounterRef = useRef(0);
  const flightNonceRef = useRef(0);
  const matchRewardedRef = useRef(false);

  useEffect(() => {
    saveSquadProgression(progression);
  }, [progression]);

  const clearTimers = () => {
    if (goalTimerRef.current !== null) {
      window.clearTimeout(goalTimerRef.current);
      goalTimerRef.current = null;
    }
    if (aiTimerRef.current !== null) {
      window.clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }
    if (bannerTimerRef.current !== null) {
      window.clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
  };

  const triggerBanner = useCallback(
    (text: string, tone: "gold" | "blue" | "red" = "gold") => {
      if (bannerTimerRef.current !== null) {
        window.clearTimeout(bannerTimerRef.current);
      }
      setBroadcastBanner({ text, tone });
      bannerTimerRef.current = window.setTimeout(() => {
        setBroadcastBanner(null);
      }, 2000);
    },
    []
  );

  const triggerCallout = useCallback((pos: Position, text: string, color = 0xfef08a) => {
    setFloatingCallout({
      id: `co-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      pos,
      text,
      color,
    });
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const speakLine = useCallback(
    (text: string) => {
      if (!ttsEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = "ru-RU";
        utter.rate = 1.08;
        window.speechSynthesis.speak(utter);
      } catch {
        // Ignore
      }
    },
    [ttsEnabled]
  );

  const pushCommentary = useCallback(
    async (req: CommentaryRequest) => {
      const id = `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const highlight: CommentaryItem["highlight"] =
        req.eventType === "goal"
          ? "goal"
          : req.eventType === "blitz_start" || req.eventType === "blitz_win"
          ? "blitz"
          : req.eventType === "save"
          ? "save"
          : "normal";

      const fallbackText = instantLocalLine(req);
      setCommentaryLog((prev) => [
        { id, turn: req.turn, text: fallbackText, source: "local", highlight },
        ...prev.slice(0, 14),
      ]);

      const shouldCallAI =
        req.eventType !== "move" || moveCounterRef.current % 2 === 0;
      moveCounterRef.current += 1;
      if (!shouldCallAI) return;

      setIsCommentaryLoading(true);
      try {
        const resp = await fetch("/api/commentary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...req,
            maxTurns: MAX_TURNS,
          }),
        });
        if (!resp.ok) return;
        const data = (await resp.json()) as { text?: string; source?: "gemini" | "local" };
        if (data.text) {
          setCommentaryLog((prev) =>
            prev.map((item) =>
              item.id === id
                ? { ...item, text: data.text!, source: data.source ?? "local" }
                : item
            )
          );
          if (req.eventType === "goal" || req.eventType === "blitz_start" || req.eventType === "save") {
            speakLine(data.text);
          }
        }
      } catch {
        // Keep local fallback
      } finally {
        setIsCommentaryLoading(false);
      }
    },
    [speakLine]
  );

  const finalizeMatchRewards = useCallback(
    (finalBlueScore: number, finalRedScore: number, statsSnapshot: MatchStats) => {
      if (matchRewardedRef.current) return;
      matchRewardedRef.current = true;
      const winBonus = finalBlueScore > finalRedScore ? 35 : finalBlueScore === finalRedScore ? 20 : 10;
      const earnedXp =
        winBonus +
        finalBlueScore * 20 +
        statsSnapshot.blitzWon * 10 +
        Math.min(20, statsSnapshot.passes * 3);

      setProgression((prev) => {
        const { next, pointsEarned } = awardMatchRewards(
          prev,
          earnedXp,
          finalBlueScore,
          statsSnapshot.blitzWon,
          true
        );
        setLastMatchReward({ xp: earnedXp, points: pointsEarned });
        return next;
      });
    },
    []
  );

  const isHumanTurn =
    phase === "PLAYING" &&
    !squadModalOpen &&
    !coachModalOpen &&
    (gameMode === "local" || currentTurn === "blue");

  const selectedPlayer = useMemo(
    () => players.find((p) => p.id === selectedPlayerId) ?? null,
    [players, selectedPlayerId]
  );

  const validMoves = useMemo(() => {
    if (!selectedPlayer || selectedPlayer.team !== currentTurn || phase !== "PLAYING") {
      return [];
    }
    return getValidMoves(
      selectedPlayer,
      players,
      ball,
      pitchType,
      blitzModePref,
      progression,
      difficulty
    );
  }, [selectedPlayer, currentTurn, phase, players, ball, pitchType, blitzModePref, progression, difficulty]);

  const validPasses = useMemo(() => {
    if (!selectedPlayer || selectedPlayer.team !== currentTurn || phase !== "PLAYING") {
      return [];
    }
    return getValidPasses(selectedPlayer, players, ball, pitchType, progression, difficulty);
  }, [selectedPlayer, currentTurn, phase, players, ball, pitchType, progression, difficulty]);

  const validShots = useMemo(() => {
    if (!selectedPlayer || selectedPlayer.team !== currentTurn || phase !== "PLAYING") {
      return [];
    }
    return getShotOptions(
      selectedPlayer,
      players,
      ball,
      pitchType,
      blitzModePref,
      progression,
      difficulty
    );
  }, [selectedPlayer, currentTurn, phase, players, ball, pitchType, blitzModePref, progression, difficulty]);

  const coachHint = useMemo(() => {
    if (!showCoachHint || !isHumanTurn) return null;
    return computeBestTacticalMove(
      currentTurn,
      players,
      ball,
      "pro",
      pitchType,
      blitzModePref,
      progression
    );
  }, [showCoachHint, isHumanTurn, currentTurn, players, ball, pitchType, blitzModePref, progression]);

  const advanceTurnOrEndMatch = useCallback(
    (
      nextBlueScore: number,
      nextRedScore: number,
      currentTurnTeam: Team,
      currTurnNum: number,
      statsSnapshot: MatchStats
    ) => {
      if (nextBlueScore >= TARGET_GOALS || nextRedScore >= TARGET_GOALS) {
        const matchWinner: Team = nextBlueScore >= TARGET_GOALS ? "blue" : "red";
        setWinner(matchWinner);
        setPhase("GAME_OVER");
        soundFX.playWhistle();
        finalizeMatchRewards(nextBlueScore, nextRedScore, statsSnapshot);
        pushCommentary({
          eventType: "match_end",
          team: matchWinner,
          pitchType,
          scoreBlue: nextBlueScore,
          scoreRed: nextRedScore,
          turn: currTurnNum,
          winner: matchWinner,
        });
        return;
      }

      const nextTurnNum = currTurnNum + 1;
      if (nextTurnNum > MAX_TURNS) {
        const matchWinner: Team | "draw" =
          nextBlueScore > nextRedScore
            ? "blue"
            : nextRedScore > nextBlueScore
            ? "red"
            : "draw";
        setWinner(matchWinner);
        setPhase("GAME_OVER");
        soundFX.playWhistle();
        finalizeMatchRewards(nextBlueScore, nextRedScore, statsSnapshot);
        pushCommentary({
          eventType: "match_end",
          team: currentTurnTeam,
          pitchType,
          scoreBlue: nextBlueScore,
          scoreRed: nextRedScore,
          turn: MAX_TURNS,
          winner: matchWinner,
        });
        return;
      }

      setTurnCount(nextTurnNum);
      const nextTeam: Team = currentTurnTeam === "blue" ? "red" : "blue";
      setCurrentTurn(nextTeam);
      setSelectedPlayerId(null);
    },
    [pitchType, pushCommentary, finalizeMatchRewards]
  );

  // FIFA Mobile Quick-Flow: Auto-focus blue ball carrier when your turn begins
  useEffect(() => {
    if (
      phase === "PLAYING" &&
      isHumanTurn &&
      !selectedPlayerId &&
      ball.carrierId
    ) {
      const carrier = players.find((p) => p.id === ball.carrierId);
      if (carrier && carrier.team === currentTurn) {
        setSelectedPlayerId(carrier.id);
      }
    }
  }, [phase, isHumanTurn, selectedPlayerId, ball.carrierId, players, currentTurn]);

  const scoreGoal = useCallback(
    (scoringTeam: Team, scorerRole: string, statsSnapshot: MatchStats) => {
      clearTimers();
      soundFX.playGoal();
      const nextBlue = scoringTeam === "blue" ? scoreBlue + 1 : scoreBlue;
      const nextRed = scoringTeam === "red" ? scoreRed + 1 : scoreRed;
      setScoreBlue(nextBlue);
      setScoreRed(nextRed);
      setSelectedPlayerId(null);
      setActiveDuel(null);

      const teamLabel = scoringTeam === "blue" ? "Синие" : "Красные";
      setGoalBanner({
        team: scoringTeam,
        text: `${teamLabel} (${scorerRole}) отправляют мяч в сетку!`,
      });
      setPhase("GOAL_CELEBRATION");

      pushCommentary({
        eventType: "goal",
        team: scoringTeam,
        playerRole: scorerRole,
        pitchType,
        scoreBlue: nextBlue,
        scoreRed: nextRed,
        turn: turnCount,
      });

      goalTimerRef.current = window.setTimeout(() => {
        setGoalBanner(null);
        if (nextBlue >= TARGET_GOALS || nextRed >= TARGET_GOALS || turnCount >= MAX_TURNS) {
          const matchWinner: Team | "draw" =
            nextBlue > nextRed ? "blue" : nextRed > nextBlue ? "red" : "draw";
          setWinner(matchWinner);
          setPhase("GAME_OVER");
          soundFX.playWhistle();
          finalizeMatchRewards(nextBlue, nextRed, statsSnapshot);
          return;
        }
        const reset = createInitialFormation();
        setPlayers(reset.players);
        setBall(reset.ball);
        setLastMoveTrace(null);
        setTurnCount((t) => t + 1);
        setCurrentTurn(scoringTeam === "blue" ? "red" : "blue");
        setPhase("PLAYING");
      }, 1850);
    },
    [scoreBlue, scoreRed, turnCount, pitchType, pushCommentary, finalizeMatchRewards]
  );

  const executeMove = useCallback(
    (player: PlayerPiece, targetPos: Position) => {
      const moves = getValidMoves(
        player,
        players,
        ball,
        pitchType,
        blitzModePref,
        progression,
        difficulty
      );
      const chosen = moves.find((m) => samePos(m.pos, targetPos));
      if (!chosen) return;

      let nextStats = matchStats;
      if (player.team === "blue") {
        nextStats = {
          ...matchStats,
          moves: matchStats.moves + 1,
          roleMoves: {
            ...matchStats.roleMoves,
            [player.role]: matchStats.roleMoves[player.role] + 1,
          },
        };
        setMatchStats(nextStats);
      }

      if (chosen.kind === "clash" && chosen.opponentId && chosen.complexity) {
        const defender = players.find((p) => p.id === chosen.opponentId);
        if (!defender) return;
        const { blueBonusMs, redBonusMs } = computeDuelBonusTimes(
          player,
          defender,
          false,
          progression,
          difficulty
        );
        soundFX.playBlitzStart();
        setSelectedPlayerId(null);
        setActiveDuel({
          initiatorId: player.id,
          defenderId: defender.id,
          contestedPos: chosen.pos,
          initiatorOrigin: player.pos,
          isShotDuel: false,
          complexity: chosen.complexity,
          ballOwnerBeforeId: ball.carrierId,
          bonusTimeMsBlue: blueBonusMs,
          bonusTimeMsRed: redBonusMs,
        });
        setPhase("BLITZ_DUEL");
        pushCommentary({
          eventType: "blitz_start",
          team: player.team,
          playerRole: ROLE_META[player.role].name,
          opponentRole: ROLE_META[defender.role].name,
          blitzSize: chosen.complexity.size,
          blitzVariant: chosen.complexity.variantName,
          pitchType,
          complexityReasons: chosen.complexity.reasons,
          scoreBlue,
          scoreRed,
          turn: turnCount,
        });
        return;
      }

      soundFX.playMove();
      setLastMoveTrace({ from: player.pos, to: chosen.pos, team: player.team });

      const movedPlayers = players.map((p) =>
        p.id === player.id ? { ...p, pos: chosen.pos } : p
      );

      let updatedBall = ball;
      if (ball.carrierId === player.id) {
        updatedBall = { pos: chosen.pos, carrierId: player.id };
      } else if (chosen.kind === "pickup") {
        updatedBall = { pos: chosen.pos, carrierId: player.id };
        triggerCallout(chosen.pos, "ПОДБОР!", 0x4ade80);
      } else if (chosen.isSlide) {
        triggerCallout(chosen.pos, "СКОЛЬЖЕНИЕ!", 0x38bdf8);
      }

      const dynamicPlayers = applyDynamicOffBallRuns(
        movedPlayers,
        player.id,
        updatedBall,
        pitchType,
        mentality
      );
      setPlayers(dynamicPlayers);
      setBall(updatedBall);

      pushCommentary({
        eventType: "move",
        team: player.team,
        playerRole: ROLE_META[player.role].name,
        pitchType,
        scoreBlue,
        scoreRed,
        turn: turnCount,
      });

      if (player.team === "blue") {
        if (superDriveReady) {
          setSuperDriveReady(false);
          setMomentum(0);
          setComboStreak(0);
          setSelectedPlayerId(player.id);
          triggerCallout(chosen.pos, "БОНУСНЫЙ ХОД!", 0xfde047);
          triggerBanner("СУПЕР-ДРАЙВ: БОНУСНЫЙ ХОД СИНИХ!", "gold");
          return;
        }
        const forwardGain = chosen.pos.col > player.pos.col ? 25 : 15;
        const nextMom = Math.min(100, momentum + forwardGain);
        setMomentum(nextMom);
        setComboStreak((c) => c + 1);
        if (nextMom >= 100) {
          setSuperDriveReady(true);
          soundFX.playMomentumMax();
          triggerCallout(chosen.pos, "СУПЕР-ДРАЙВ!", 0xfde047);
          triggerBanner("ИМПУЛЬС 100% — СУПЕР-ДРАЙВ ГОТОВ!", "gold");
        }
      }

      advanceTurnOrEndMatch(scoreBlue, scoreRed, player.team, turnCount, nextStats);
    },
    [
      players,
      ball,
      pitchType,
      blitzModePref,
      progression,
      difficulty,
      matchStats,
      mentality,
      momentum,
      superDriveReady,
      scoreBlue,
      scoreRed,
      turnCount,
      pushCommentary,
      advanceTurnOrEndMatch,
      triggerBanner,
      triggerCallout,
    ]
  );

  const executePass = useCallback(
    (passer: PlayerPiece, receiverId: string) => {
      const receiver = players.find((p) => p.id === receiverId);
      if (!receiver || ball.carrierId !== passer.id) return;

      let nextStats = matchStats;
      if (passer.team === "blue") {
        nextStats = {
          ...matchStats,
          passes: matchStats.passes + 1,
          roleMoves: {
            ...matchStats.roleMoves,
            [passer.role]: matchStats.roleMoves[passer.role] + 1,
          },
        };
        setMatchStats(nextStats);
      }

      soundFX.playPass();
      flightNonceRef.current += 1;
      const dist = Math.hypot(receiver.pos.col - passer.pos.col, receiver.pos.row - passer.pos.row);
      setBallFlight({
        nonce: flightNonceRef.current,
        from: passer.pos,
        to: receiver.pos,
        isLob: dist > 6.5,
        isShot: false,
      });
      setLastMoveTrace({ from: passer.pos, to: receiver.pos, team: passer.team });

      const updatedBall: BallState = { pos: receiver.pos, carrierId: receiver.id };
      const dynamicPlayers = applyDynamicOffBallRuns(
        players,
        receiver.id,
        updatedBall,
        pitchType,
        mentality
      );
      setPlayers(dynamicPlayers);
      setBall(updatedBall);
      triggerCallout(receiver.pos, dist > 7 ? "ДИАГОНАЛЬ!" : "ПАС!", 0xfbbf24);

      pushCommentary({
        eventType: "pass",
        team: passer.team,
        playerRole: ROLE_META[receiver.role].name,
        pitchType,
        scoreBlue,
        scoreRed,
        turn: turnCount,
      });

      if (passer.team === "blue") {
        if (superDriveReady) {
          setSuperDriveReady(false);
          setMomentum(0);
          setComboStreak(0);
          setSelectedPlayerId(receiver.id);
          triggerCallout(receiver.pos, "СТЕНОЧКА x2!", 0xfde047);
          triggerBanner("СУПЕР-ДРАЙВ: БЫСТРАЯ СТЕНОЧКА!", "gold");
          return;
        }
        const nextMom = Math.min(100, momentum + 30);
        setMomentum(nextMom);
        setComboStreak((c) => c + 1);
        if (nextMom >= 100) {
          setSuperDriveReady(true);
          soundFX.playMomentumMax();
          triggerCallout(receiver.pos, "СУПЕР-ДРАЙВ!", 0xfde047);
          triggerBanner("ИМПУЛЬС 100% — БОНУСНЫЙ ХОД!", "gold");
        }
      }

      advanceTurnOrEndMatch(scoreBlue, scoreRed, passer.team, turnCount, nextStats);
    },
    [
      players,
      ball,
      matchStats,
      pitchType,
      mentality,
      momentum,
      superDriveReady,
      scoreBlue,
      scoreRed,
      turnCount,
      pushCommentary,
      advanceTurnOrEndMatch,
      triggerBanner,
      triggerCallout,
    ]
  );

  const executeShot = useCallback(
    (shooter: PlayerPiece, goalRow: number) => {
      const shots = getShotOptions(
        shooter,
        players,
        ball,
        pitchType,
        blitzModePref,
        progression,
        difficulty
      );
      const shot = shots.find((s) => s.goalRow === goalRow);
      if (!shot) return;

      let nextStats = matchStats;
      if (shooter.team === "blue") {
        nextStats = {
          ...matchStats,
          shots: matchStats.shots + 1,
          roleMoves: {
            ...matchStats.roleMoves,
            [shooter.role]: matchStats.roleMoves[shooter.role] + 1,
          },
        };
        setMatchStats(nextStats);
      }

      const goalCol = shooter.team === "blue" ? PITCH_COLS - 1 : 0;
      flightNonceRef.current += 1;
      setBallFlight({
        nonce: flightNonceRef.current,
        from: shooter.pos,
        to: { col: goalCol, row: goalRow },
        isLob: false,
        isShot: true,
      });
      setLastMoveTrace({
        from: shooter.pos,
        to: { col: goalCol, row: goalRow },
        team: shooter.team,
      });

      if (!shot.isContested || !shot.defenderId || !shot.complexity) {
        triggerCallout({ col: goalCol, row: goalRow }, "ГОООЛ!", 0x4ade80);
        scoreGoal(shooter.team, ROLE_META[shooter.role].name, nextStats);
        return;
      }

      const keeper = players.find((p) => p.id === shot.defenderId);
      if (!keeper) {
        scoreGoal(shooter.team, ROLE_META[shooter.role].name, nextStats);
        return;
      }

      const { blueBonusMs, redBonusMs } = computeDuelBonusTimes(
        shooter,
        keeper,
        true,
        progression,
        difficulty
      );

      soundFX.playBlitzStart();
      triggerBanner("ОПАСНЫЙ УДАР! ДУЭЛЬ С ВРАТАРЁМ!", shooter.team === "blue" ? "blue" : "red");
      setSelectedPlayerId(null);
      setActiveDuel({
        initiatorId: shooter.id,
        defenderId: keeper.id,
        contestedPos: { col: goalCol, row: goalRow },
        initiatorOrigin: shooter.pos,
        isShotDuel: true,
        goalRow,
        complexity: shot.complexity,
        ballOwnerBeforeId: shooter.id,
        bonusTimeMsBlue: blueBonusMs,
        bonusTimeMsRed: redBonusMs,
      });
      setPhase("BLITZ_DUEL");

      pushCommentary({
        eventType: "blitz_start",
        team: shooter.team,
        playerRole: ROLE_META[shooter.role].name,
        opponentRole: ROLE_META[keeper.role].name,
        blitzSize: shot.complexity.size,
        blitzVariant: shot.complexity.variantName,
        pitchType,
        complexityReasons: shot.complexity.reasons,
        scoreBlue,
        scoreRed,
        turn: turnCount,
      });
    },
    [
      players,
      ball,
      pitchType,
      blitzModePref,
      progression,
      difficulty,
      matchStats,
      scoreBlue,
      scoreRed,
      turnCount,
      scoreGoal,
      pushCommentary,
    ]
  );

  const handleResolveDuel = useCallback(
    (winnerTeam: Team | "draw", _outcomeText: string, wasTimeout: boolean) => {
      if (!activeDuel) return;
      const duel = activeDuel;
      const initiator = players.find((p) => p.id === duel.initiatorId);
      const defender = players.find((p) => p.id === duel.defenderId);
      setActiveDuel(null);

      const nextStats: MatchStats = {
        ...matchStats,
        blitzPlayed: matchStats.blitzPlayed + 1,
        blitzWon: matchStats.blitzWon + (winnerTeam === "blue" ? 1 : 0),
        blitzTimeouts: matchStats.blitzTimeouts + (wasTimeout ? 1 : 0),
      };
      setMatchStats(nextStats);

      if (!initiator || !defender) {
        setPhase("PLAYING");
        return;
      }

      if (duel.isShotDuel) {
        if (winnerTeam === initiator.team) {
          scoreGoal(initiator.team, ROLE_META[initiator.role].name, nextStats);
          return;
        }
        soundFX.playSave();
        triggerCallout(defender.pos, "СЕЙВ!", 0x38bdf8);
        triggerBanner("ФЕНОМЕНАЛЬНЫЙ СЕЙВ ВРАТАРЯ!", defender.team === "blue" ? "blue" : "red");
        setBall({ pos: defender.pos, carrierId: defender.id });
        setPhase("PLAYING");
        pushCommentary({
          eventType: "save",
          team: initiator.team,
          playerRole: ROLE_META[defender.role].name,
          pitchType,
          scoreBlue,
          scoreRed,
          turn: turnCount,
        });
        advanceTurnOrEndMatch(scoreBlue, scoreRed, initiator.team, turnCount, nextStats);
        return;
      }

      const initiatorHadBall = duel.ballOwnerBeforeId === initiator.id;
      const defenderHadBall = duel.ballOwnerBeforeId === defender.id;
      const looseBallOnSquare =
        duel.ballOwnerBeforeId === null && samePos(ball.pos, duel.contestedPos);

      let initiatorWinsSquare: boolean;
      let nextCarrierId: string | null = duel.ballOwnerBeforeId;

      if (winnerTeam === "draw") {
        initiatorWinsSquare = initiatorHadBall;
        nextCarrierId = duel.ballOwnerBeforeId;
      } else if (winnerTeam === initiator.team) {
        initiatorWinsSquare = true;
        if (initiatorHadBall || defenderHadBall || looseBallOnSquare) {
          nextCarrierId = initiator.id;
        }
      } else {
        initiatorWinsSquare = false;
        if (initiatorHadBall || defenderHadBall || looseBallOnSquare) {
          nextCarrierId = defender.id;
        }
      }

      let nextPlayers: PlayerPiece[];
      if (initiatorWinsSquare) {
        soundFX.playTackle();
        const knockbackPos = findSafeKnockbackSquare(
          defender,
          duel.contestedPos,
          players,
          initiator.id,
          pitchType
        );
        nextPlayers = players.map((p) => {
          if (p.id === initiator.id) return { ...p, pos: duel.contestedPos };
          if (p.id === defender.id) return { ...p, pos: knockbackPos };
          return p;
        });
        setLastMoveTrace({ from: duel.initiatorOrigin, to: duel.contestedPos, team: initiator.team });
      } else {
        nextPlayers = players;
      }

      let finalBall = ball;
      if (nextCarrierId) {
        const carrier = nextPlayers.find((p) => p.id === nextCarrierId);
        if (carrier) finalBall = { pos: carrier.pos, carrierId: carrier.id };
      }

      const dynamicPlayers = applyDynamicOffBallRuns(
        nextPlayers,
        initiator.id,
        finalBall,
        pitchType,
        mentality
      );
      setPlayers(dynamicPlayers);
      setBall(finalBall);

      if (winnerTeam === "blue") {
        const nextMom = Math.min(100, momentum + 35);
        setMomentum(nextMom);
        setComboStreak((c) => c + 1);
        triggerCallout(duel.contestedPos, "ОТБОР!", 0x60a5fa);
        if (nextMom >= 100) {
          setSuperDriveReady(true);
          soundFX.playMomentumMax();
          triggerBanner("ИМПУЛЬС 100% — СУПЕР-ДРАЙВ ГОТОВ!", "gold");
        }
      } else if (winnerTeam === "red") {
        setMomentum((m) => Math.max(0, m - 25));
        setComboStreak(0);
        setSuperDriveReady(false);
        triggerCallout(duel.contestedPos, "ПЕРЕХВАТ!", 0xf87171);
      }

      setPhase("PLAYING");
      pushCommentary({
        eventType: winnerTeam === "draw" ? "blitz_draw" : "blitz_win",
        team: winnerTeam === "draw" ? initiator.team : winnerTeam,
        playerRole:
          winnerTeam === initiator.team
            ? ROLE_META[initiator.role].name
            : ROLE_META[defender.role].name,
        pitchType,
        scoreBlue,
        scoreRed,
        turn: turnCount,
      });

      advanceTurnOrEndMatch(scoreBlue, scoreRed, initiator.team, turnCount, nextStats);
    },
    [
      activeDuel,
      players,
      ball,
      matchStats,
      pitchType,
      mentality,
      momentum,
      scoreBlue,
      scoreRed,
      turnCount,
      scoreGoal,
      pushCommentary,
      advanceTurnOrEndMatch,
      triggerBanner,
      triggerCallout,
    ]
  );

  useEffect(() => {
    if (
      phase !== "PLAYING" ||
      gameMode !== "ai" ||
      currentTurn !== "red" ||
      squadModalOpen ||
      coachModalOpen
    ) {
      return;
    }

    aiTimerRef.current = window.setTimeout(() => {
      const action = computeBestTacticalMove(
        "red",
        players,
        ball,
        difficulty,
        pitchType,
        blitzModePref,
        progression
      );
      if (!action) {
        advanceTurnOrEndMatch(scoreBlue, scoreRed, "red", turnCount, matchStats);
        return;
      }
      const actor = players.find((p) => p.id === action.playerId);
      if (!actor) return;

      if (action.actionType === "shoot" && action.goalRow !== undefined) {
        executeShot(actor, action.goalRow);
      } else if (action.actionType === "pass" && action.targetPlayerId) {
        executePass(actor, action.targetPlayerId);
      } else if (action.actionType === "move" && action.targetPos) {
        executeMove(actor, action.targetPos);
      }
    }, 650);

    return () => {
      if (aiTimerRef.current !== null) {
        window.clearTimeout(aiTimerRef.current);
        aiTimerRef.current = null;
      }
    };
  }, [
    phase,
    gameMode,
    currentTurn,
    squadModalOpen,
    coachModalOpen,
    players,
    ball,
    difficulty,
    pitchType,
    blitzModePref,
    progression,
    scoreBlue,
    scoreRed,
    turnCount,
    matchStats,
    executeShot,
    executePass,
    executeMove,
    advanceTurnOrEndMatch,
  ]);

  const startNewMatch = useCallback(
    (
      mode: GameMode,
      diff: AIDifficulty,
      pace: BlitzPace,
      pitch: PitchType,
      blitzPref: BlitzModePreference
    ) => {
      clearTimers();
      matchRewardedRef.current = false;
      const reset = createInitialFormation();
      setGameMode(mode);
      setDifficulty(diff);
      setBlitzPace(pace);
      setPitchType(pitch);
      setBlitzModePref(blitzPref);
      setPlayers(reset.players);
      setBall(reset.ball);
      setScoreBlue(0);
      setScoreRed(0);
      setTurnCount(1);
      setCurrentTurn("blue");
      setMatchStats(emptyMatchStats());
      setLastMatchReward(null);
      setSelectedPlayerId(null);
      setActiveDuel(null);
      setLastMoveTrace(null);
      setGoalBanner(null);
      setWinner(null);
      setMomentum(0);
      setComboStreak(0);
      setSuperDriveReady(false);
      setBroadcastBanner(null);
      setCommentaryLog([]);
      setPhase("PLAYING");
      soundFX.playWhistle();

      pushCommentary({
        eventType: "kickoff",
        team: "blue",
        pitchType: pitch,
        scoreBlue: 0,
        scoreRed: 0,
        turn: 1,
      });
    },
    [pushCommentary]
  );

  const handleToggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      soundFX.enabled = next;
      return next;
    });
  };

  const handleToggleTts = () => {
    setTtsEnabled((prev) => {
      const next = !prev;
      if (!next && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  };

  const handleSelectPlayer = (playerId: string) => {
    if (!isHumanTurn) return;
    setSelectedPlayerId((prev) => (prev === playerId ? null : playerId));
  };

  const handleCellClick = (pos: Position) => {
    if (!isHumanTurn || !selectedPlayer) return;
    const isValid = validMoves.some((m) => samePos(m.pos, pos));
    if (isValid) executeMove(selectedPlayer, pos);
    else setSelectedPlayerId(null);
  };

  const handlePassToPlayer = (targetId: string) => {
    if (!isHumanTurn || !selectedPlayer) return;
    executePass(selectedPlayer, targetId);
  };

  const handleShootGoal = (goalRow: number) => {
    if (!isHumanTurn || !selectedPlayer) return;
    executeShot(selectedPlayer, goalRow);
  };

  const handleQuickPass = () => {
    if (!isHumanTurn || !selectedPlayer || validPasses.length === 0) return;
    const bestPass = [...validPasses].sort((a, b) => b.pos.col - a.pos.col)[0];
    if (bestPass) executePass(selectedPlayer, bestPass.targetPlayerId);
  };

  const handleQuickShot = () => {
    if (!isHumanTurn || !selectedPlayer || validShots.length === 0) return;
    const openShot = validShots.find((s) => !s.isContested) ?? validShots[0];
    if (openShot) executeShot(selectedPlayer, openShot.goalRow);
  };

  const handleAutoMove = () => {
    if (!isHumanTurn) return;
    const best =
      coachHint ??
      computeBestTacticalMove(
        currentTurn,
        players,
        ball,
        "pro",
        pitchType,
        blitzModePref,
        progression
      );
    if (!best) return;
    const actor = players.find((p) => p.id === best.playerId);
    if (!actor) return;
    if (best.actionType === "shoot" && best.goalRow !== undefined) {
      executeShot(actor, best.goalRow);
    } else if (best.actionType === "pass" && best.targetPlayerId) {
      executePass(actor, best.targetPlayerId);
    } else if (best.actionType === "move" && best.targetPos) {
      executeMove(actor, best.targetPos);
    }
  };

  const handleUpgradeStat = (role: PlayerRole, stat: keyof RoleProgression["stats"]) => {
    setProgression((prev) => upgradeRoleStat(prev, role, stat));
  };

  const handleUnlockAbility = (role: PlayerRole, abilityId: AbilityId, cost: number) => {
    setProgression((prev) => unlockRoleAbility(prev, role, abilityId, cost));
  };

  const handleUpdateAppearance = (role: PlayerRole, patch: Partial<RoleAppearance>) => {
    setProgression((prev) => updateRoleAppearance(prev, role, patch));
  };

  return (
    <main className="relative w-screen h-dvh overflow-hidden bg-[#0B1014]">
      <PixiPitchCanvas
        players={players}
        ball={ball}
        pitchType={pitchType}
        progression={progression}
        currentTurn={currentTurn}
        isHumanTurn={isHumanTurn}
        selectedPlayerId={selectedPlayerId}
        validMoves={validMoves}
        validPasses={validPasses}
        validShots={validShots}
        coachHint={coachHint}
        showCoachHint={showCoachHint}
        lastMoveTrace={lastMoveTrace}
        ballFlight={ballFlight}
        floatingCallout={floatingCallout}
        superDriveReady={superDriveReady}
        goalCelebrationTeam={phase === "GOAL_CELEBRATION" && goalBanner ? goalBanner.team : null}
        onSelectPlayer={handleSelectPlayer}
        onCellClick={handleCellClick}
        onPassToPlayer={handlePassToPlayer}
        onShootGoal={handleShootGoal}
      />

      <OverlayHUD
        phase={phase}
        scoreBlue={scoreBlue}
        scoreRed={scoreRed}
        turnCount={turnCount}
        currentTurn={currentTurn}
        gameMode={gameMode}
        difficulty={difficulty}
        blitzPace={blitzPace}
        pitchType={pitchType}
        blitzModePref={blitzModePref}
        mentality={mentality}
        momentum={momentum}
        comboStreak={comboStreak}
        superDriveReady={superDriveReady}
        broadcastBanner={broadcastBanner}
        canQuickPass={validPasses.length > 0}
        canQuickShot={validShots.length > 0}
        canAutoMove={isHumanTurn}
        skillPoints={progression.skillPoints}
        lastMatchReward={lastMatchReward}
        soundEnabled={soundEnabled}
        ttsEnabled={ttsEnabled}
        showCoachHint={showCoachHint}
        coachHint={coachHint}
        selectedPlayer={selectedPlayer}
        selectedHasBall={Boolean(selectedPlayer && ball.carrierId === selectedPlayer.id)}
        commentaryLog={commentaryLog}
        isCommentaryLoading={isCommentaryLoading}
        goalBanner={goalBanner}
        winner={winner}
        onStartMatch={startNewMatch}
        onResetMatch={() =>
          startNewMatch(gameMode, difficulty, blitzPace, pitchType, blitzModePref)
        }
        onOpenSetup={() => {
          clearTimers();
          setActiveDuel(null);
          setPhase("TITLE_MENU");
        }}
        onOpenSquad={() => setSquadModalOpen(true)}
        onOpenCoach={() => setCoachModalOpen(true)}
        onToggleSound={handleToggleSound}
        onToggleTts={handleToggleTts}
        onToggleCoachHint={() => setShowCoachHint((v) => !v)}
        onChangeMentality={setMentality}
        onQuickPass={handleQuickPass}
        onQuickShot={handleQuickShot}
        onAutoMove={handleAutoMove}
      />

      {phase === "BLITZ_DUEL" && activeDuel && (
        <BlitzDuelModal
          duel={activeDuel}
          players={players}
          gameMode={gameMode}
          difficulty={difficulty}
          blitzPace={blitzPace}
          onResolve={handleResolveDuel}
        />
      )}

      {squadModalOpen && (
        <SquadModal
          progression={progression}
          onUpgradeStat={handleUpgradeStat}
          onUnlockAbility={handleUnlockAbility}
          onUpdateAppearance={handleUpdateAppearance}
          onClose={() => setSquadModalOpen(false)}
        />
      )}

      {coachModalOpen && (
        <CoachModal
          pitchType={pitchType}
          difficulty={difficulty}
          scoreBlue={scoreBlue}
          scoreRed={scoreRed}
          turnCount={turnCount}
          stats={matchStats}
          progression={progression}
          onOpenSquad={() => setSquadModalOpen(true)}
          onClose={() => setCoachModalOpen(false)}
        />
      )}
    </main>
  );
}
