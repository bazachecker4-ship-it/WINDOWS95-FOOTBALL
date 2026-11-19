import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AIDifficulty,
  AIOpponentEngine,
  AIPace,
  AbilityId,
  ActiveBlitzDuel,
  BallFlightEvent,
  BallState,
  BlitzModePreference,
  BlitzPace,
  CameraPreset,
  CommentaryItem,
  FloatingCallout,
  GameMode,
  GamePhase,
  LiveMatchSummary,
  MAX_TURNS,
  MatchStats,
  MatchTelemetryStats,
  PITCH_COLS,
  PitchType,
  PlayerPiece,
  PlayerRole,
  Position,
  ROLE_META,
  RoleAppearance,
  RoleProgression,
  ServerMatchSnapshot,
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
  getQuickSwitchCandidates,
  getShotOptions,
  getValidMoves,
  getValidPasses,
  samePos,
  updateSquadStamina,
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
import { MultiplayerLobbyModal } from "./components/MultiplayerLobbyModal";
import { ProfileModal } from "./components/ProfileModal";
import { ChallengeModal } from "./components/ChallengeModal";
import { DesktopWindowId } from "./components/Win95Window";
import { UserProfile, loadUserProfile, saveUserProfile } from "./engine/profile";
import { LobbySnapshotState, mpClient } from "./services/multiplayerClient";
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

function pickLine(options: string[]): string {
  return options[Math.floor(Math.random() * options.length)];
}

function instantLocalLine(req: CommentaryRequest): string {
  const teamName = req.team === "blue" ? "Синие" : "Красные";
  const role = req.playerRole || "игрок";
  switch (req.eventType) {
    case "kickoff":
      return pickLine([
        `Матч начался! ${teamName} разыгрывают мяч с центра поля.`,
        `Стартовый свисток! Команды 11 на 11 вступают в борьбу.`,
      ]);
    case "pass":
      return pickLine([
        `Точный пас на ${role} — ${teamName} ускоряют атаку.`,
        `Отличный перевод! ${role} открывается в свободной зоне.`,
        `В касание! ${teamName} разыгрывают комбинацию через ${role}.`,
      ]);
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
      return pickLine([
        `${teamName}: ${role} перестраивается на поле.`,
        `Динамичный рывок: ${role} занимает выгодную клетку.`,
        `${teamName} смещают акцент атаки через ${role}.`,
      ]);
  }
}

export default function App() {
  const initial = useMemo(() => createInitialFormation(), []);

  const [phase, setPhase] = useState<GamePhase>("TITLE_MENU");
  const [gameMode, setGameMode] = useState<GameMode>("ai");
  const [difficulty, setDifficulty] = useState<AIDifficulty>("tactical");
  const [aiEngine, setAiEngine] = useState<AIOpponentEngine>("groq");
  const [aiAgentBadge, setAiAgentBadge] = useState<string | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("tv");
  const [blitzPace, setBlitzPace] = useState<BlitzPace>("blitz");
  const [aiPace, setAiPace] = useState<AIPace>("normal");
  const [pitchType, setPitchType] = useState<PitchType>("turf");
  const [blitzModePref, setBlitzModePref] = useState<BlitzModePreference>("dynamic");

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [showCoachHint, setShowCoachHint] = useState(true);
  const [crtEnabled, setCrtEnabled] = useState(true);

  const [userProfile, setUserProfile] = useState<UserProfile>(() => loadUserProfile());
  const [openWindows, setOpenWindows] = useState<DesktopWindowId[]>(() =>
    userProfile.created ? ["setup"] : ["setup", "profile"]
  );
  const [minimizedWindows, setMinimizedWindows] = useState<DesktopWindowId[]>([]);
  const [isSpectating, setIsSpectating] = useState(false);
  const [localAiDerby, setLocalAiDerby] = useState(false);

  const [lobbyState, setLobbyState] = useState<LobbySnapshotState>(() => mpClient.getState());
  const [onlineMatchId, setOnlineMatchId] = useState<string | null>(null);
  const [localTeam, setLocalTeam] = useState<Team>("blue");
  const [spectateMatchId, setSpectateMatchId] = useState<string | null>(null);
  const [serverMatch, setServerMatch] = useState<ServerMatchSnapshot | null>(null);

  const openWindow = useCallback((id: DesktopWindowId) => {
    setMinimizedWindows((prev) => prev.filter((w) => w !== id));
    setOpenWindows((prev) => [...prev.filter((w) => w !== id), id]);
  }, []);

  const focusWindow = useCallback((id: DesktopWindowId) => {
    setMinimizedWindows((prev) => prev.filter((w) => w !== id));
    setOpenWindows((prev) => {
      if (!prev.includes(id)) return [...prev, id];
      if (prev[prev.length - 1] === id) return prev;
      return [...prev.filter((w) => w !== id), id];
    });
  }, []);

  const minimizeWindow = useCallback((id: DesktopWindowId) => {
    setMinimizedWindows((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const closeWindow = useCallback((id: DesktopWindowId) => {
    setOpenWindows((prev) => prev.filter((w) => w !== id));
    setMinimizedWindows((prev) => prev.filter((w) => w !== id));
  }, []);

  const activeWindowId = useMemo<DesktopWindowId | null>(() => {
    for (let i = openWindows.length - 1; i >= 0; i--) {
      if (!minimizedWindows.includes(openWindows[i])) {
        return openWindows[i];
      }
    }
    return null;
  }, [openWindows, minimizedWindows]);

  const toggleTaskbarWindow = useCallback(
    (id: DesktopWindowId) => {
      if (minimizedWindows.includes(id) || activeWindowId !== id) {
        focusWindow(id);
      } else {
        minimizeWindow(id);
      }
    },
    [minimizedWindows, activeWindowId, focusWindow, minimizeWindow]
  );

  const getWindowZ = useCallback(
    (id: DesktopWindowId) => {
      const idx = openWindows.indexOf(id);
      return idx === -1 ? 30 : 30 + idx;
    },
    [openWindows]
  );

  const hasVisibleModalWindow = useMemo(
    () =>
      openWindows.some(
        (w) => w !== "setup" && !minimizedWindows.includes(w)
      ),
    [openWindows, minimizedWindows]
  );

  const pendingInviteRef = useRef<{ roomId: string; challengeCode?: string; club?: string } | null>(null);
  const lastBallFlightNonceRef = useRef<number>(0);
  const lastCalloutIdRef = useRef<string | null>(null);
  const humanAiLiveIdRef = useRef<string | null>(null);

  useEffect(() => {
    mpClient.updateProfile(userProfile.clubName, userProfile.managerName);
  }, [userProfile.clubName, userProfile.managerName]);

  useEffect(() => {
    const unsubLobby = mpClient.subscribeLobby((next) => setLobbyState(next));
    return () => unsubLobby();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const roomId = params.get("room");
      const challengeCode = params.get("challenge") ?? undefined;
      const club = params.get("club") ?? undefined;
      if (roomId || challengeCode) {
        pendingInviteRef.current = {
          roomId: roomId || `chal-${challengeCode}`,
          challengeCode,
          club,
        };
        triggerBanner(
          `⚔️ Вызов${club ? ` от «${club}»` : ""}! Подключаемся к комнате...`,
          "gold"
        );
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, "", cleanUrl);
      }
    }
  }, []);

  useEffect(() => {
    if (lobbyState.connected && pendingInviteRef.current) {
      const invite = pendingInviteRef.current;
      pendingInviteRef.current = null;
      mpClient.joinRoom(invite.roomId, invite.challengeCode);
    }
  }, [lobbyState.connected]);

  const handleSaveProfile = (p: UserProfile) => {
    setUserProfile(p);
    saveUserProfile(p);
    mpClient.updateProfile(p.clubName, p.managerName);
    closeWindow("profile");
    triggerBanner(`Профиль и клуб «${p.clubName}» успешно сохранены!`, "gold");
  };

  const handleSpectateLiveMatch = useCallback(
    (match: LiveMatchSummary) => {
      closeWindow("lobby");
      if (humanAiLiveIdRef.current) {
        mpClient.unpublishLiveMatch(humanAiLiveIdRef.current);
        humanAiLiveIdRef.current = null;
      }
      setOnlineMatchId(null);
      setLocalAiDerby(false);
      mpClient.joinSpectate(match.id);
      triggerBanner(`👁️ Подключение к трансляции: ${match.roomName}...`, "gold");
    },
    [closeWindow]
  );

  const handleSwitchSpectateMatch = useCallback((match: LiveMatchSummary) => {
    mpClient.joinSpectate(match.id);
    triggerBanner(`📺 Переключение канала: ${match.roomName}`, "gold");
  }, []);

  const handleSendSpectateReaction = useCallback(
    (text: string) => {
      if (!spectateMatchId) return;
      mpClient.sendSpectateReaction(spectateMatchId, text);
    },
    [spectateMatchId]
  );

  const handleExitSpectate = useCallback(() => {
    clearTimers();
    if (spectateMatchId) {
      mpClient.leaveSpectate(spectateMatchId);
    }
    setSpectateMatchId(null);
    setServerMatch(null);
    setActiveDuel(null);
    setIsSpectating(false);
    setLocalAiDerby(false);
    setPhase("TITLE_MENU");
    openWindow("lobby");
  }, [spectateMatchId, openWindow]);

  const handleAcceptChallenge = useCallback(
    (roomOrOpponent: string, challengeCode?: string) => {
      closeWindow("challenge");
      if (challengeCode || roomOrOpponent.startsWith("chal-") || roomOrOpponent.startsWith("room-")) {
        mpClient.joinRoom(roomOrOpponent, challengeCode);
        triggerBanner(`⚔️ Подключение к дуэли ${challengeCode ? `#${challengeCode}` : ""}...`, "gold");
      } else {
        startNewMatch("ai", "tactical", blitzPace, pitchType, blitzModePref, false, "groq");
        triggerBanner(`⚔️ Вызов принят! Матч против «${roomOrOpponent}»`, "gold");
      }
    },
    [closeWindow, blitzPace, pitchType, blitzModePref]
  );

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

  const lastAiCommentaryAtRef = useRef(0);

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

      if (req.eventType === "goal" || req.eventType === "save") {
        speakLine(fallbackText);
      }

      // Only request Gemini commentary for major highlights & respect rate-limit budget
      const now = Date.now();
      const isHighlight =
        req.eventType === "goal" ||
        req.eventType === "save" ||
        req.eventType === "match_end" ||
        req.eventType === "kickoff" ||
        req.eventType === "blitz_win";
      const isCritical =
        req.eventType === "goal" || req.eventType === "save" || req.eventType === "match_end";

      if (!isHighlight) return;
      if (!isCritical && now - lastAiCommentaryAtRef.current < 15000) return;

      lastAiCommentaryAtRef.current = now;
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
        const data = (await resp.json()) as {
          text?: string;
          source?: "gemini" | "groq" | "local";
        };
        if (data.text) {
          setCommentaryLog((prev) =>
            prev.map((item) =>
              item.id === id
                ? { ...item, text: data.text!, source: data.source ?? "local" }
                : item
            )
          );
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
    (
      finalBlueScore: number,
      finalRedScore: number,
      statsSnapshot: MatchStats,
      teamSide: Team = "blue"
    ) => {
      if (matchRewardedRef.current || isSpectating) return;
      matchRewardedRef.current = true;
      const myScore = teamSide === "blue" ? finalBlueScore : finalRedScore;
      const oppScore = teamSide === "blue" ? finalRedScore : finalBlueScore;
      const winBonus = myScore > oppScore ? 35 : myScore === oppScore ? 20 : 10;
      const earnedXp =
        winBonus +
        myScore * 20 +
        statsSnapshot.blitzWon * 10 +
        Math.min(20, statsSnapshot.passes * 3);

      setProgression((prev) => {
        const { next, pointsEarned } = awardMatchRewards(
          prev,
          earnedXp,
          myScore,
          statsSnapshot.blitzWon,
          true
        );
        setLastMatchReward({ xp: earnedXp, points: pointsEarned });
        return next;
      });

      setUserProfile((prev) => {
        const won = myScore > oppScore ? 1 : 0;
        const lost = oppScore > myScore ? 1 : 0;
        const updated: UserProfile = {
          ...prev,
          matchesWon: prev.matchesWon + won,
          matchesLost: prev.matchesLost + lost,
          trophies: prev.trophies + won,
        };
        saveUserProfile(updated);
        return updated;
      });
    },
    [isSpectating]
  );

  const isHumanTurn =
    phase === "PLAYING" &&
    !isSpectating &&
    !hasVisibleModalWindow &&
    (gameMode === "local" ||
      (gameMode === "online" ? currentTurn === localTeam : currentTurn === "blue"));

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

  const quickSwitchPlayers = useMemo(
    () => getQuickSwitchCandidates(currentTurn, players, ball, 4),
    [currentTurn, players, ball]
  );

  const validShots = useMemo(() => {
    if (!selectedPlayer || selectedPlayer.team !== currentTurn || phase !== "PLAYING") {
      return [];
    }
    const useSuperShot = superDriveReady && currentTurn === "blue";
    return getShotOptions(
      selectedPlayer,
      players,
      ball,
      pitchType,
      blitzModePref,
      progression,
      difficulty,
      useSuperShot
    );
  }, [
    selectedPlayer,
    currentTurn,
    phase,
    players,
    ball,
    pitchType,
    blitzModePref,
    progression,
    difficulty,
    superDriveReady,
  ]);

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

  // FIFA Mobile Quick-Flow: Auto-focus ball carrier OR closest defender when your turn begins
  useEffect(() => {
    if (phase === "PLAYING" && isHumanTurn && !selectedPlayerId) {
      const carrier = ball.carrierId
        ? players.find((p) => p.id === ball.carrierId) ?? null
        : null;
      if (carrier && carrier.team === currentTurn) {
        setSelectedPlayerId(carrier.id);
      } else if (quickSwitchPlayers.length > 0) {
        setSelectedPlayerId(quickSwitchPlayers[0].id);
      }
    }
  }, [phase, isHumanTurn, selectedPlayerId, ball.carrierId, players, currentTurn, quickSwitchPlayers]);

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
      if (gameMode === "online" && onlineMatchId) {
        soundFX.playMove();
        setSelectedPlayerId(null);
        mpClient.sendMatchAction(onlineMatchId, {
          actionType: "move",
          playerId: player.id,
          targetPos,
        });
        return;
      }

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

      const moveDist = Math.hypot(chosen.pos.col - player.pos.col, chosen.pos.row - player.pos.row);
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

      const dynamicPlayers = updateSquadStamina(
        applyDynamicOffBallRuns(movedPlayers, player.id, updatedBall, pitchType, mentality),
        player.id,
        moveDist,
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
      gameMode,
      onlineMatchId,
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
      if (gameMode === "online" && onlineMatchId) {
        soundFX.playPass();
        setSelectedPlayerId(null);
        mpClient.sendMatchAction(onlineMatchId, {
          actionType: "pass",
          playerId: passer.id,
          targetPlayerId: receiverId,
        });
        return;
      }

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
      const dynamicPlayers = updateSquadStamina(
        applyDynamicOffBallRuns(players, receiver.id, updatedBall, pitchType, mentality),
        passer.id,
        1.5,
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
      gameMode,
      onlineMatchId,
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
      if (gameMode === "online" && onlineMatchId) {
        soundFX.playMove();
        setSelectedPlayerId(null);
        mpClient.sendMatchAction(onlineMatchId, {
          actionType: "shoot",
          playerId: shooter.id,
          goalRow,
        });
        return;
      }

      const useSuperShot = superDriveReady && shooter.team === "blue";
      const shots = getShotOptions(
        shooter,
        players,
        ball,
        pitchType,
        blitzModePref,
        progression,
        difficulty,
        useSuperShot
      );
      const shot = shots.find((s) => s.goalRow === goalRow);
      if (!shot) return;

      if (useSuperShot) {
        setSuperDriveReady(false);
        setMomentum(0);
        setComboStreak(0);
      }

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
        isSuperShot: useSuperShot,
      });
      setLastMoveTrace({
        from: shooter.pos,
        to: { col: goalCol, row: goalRow },
        team: shooter.team,
      });

      if (!shot.isContested || !shot.defenderId || !shot.complexity) {
        triggerCallout({ col: goalCol, row: goalRow }, useSuperShot ? "СУПЕР-ГОЛ!" : "ГОООЛ!", 0x4ade80);
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
      const superBonus = useSuperShot ? 1000 : 0;

      soundFX.playBlitzStart();
      triggerBanner(
        useSuperShot ? "СУПЕР-УДАР ПО ВОРОТАМ!" : "ОПАСНЫЙ УДАР! ДУЭЛЬ С ВРАТАРЁМ!",
        useSuperShot ? "gold" : shooter.team === "blue" ? "blue" : "red"
      );
      setSelectedPlayerId(null);
      setActiveDuel({
        initiatorId: shooter.id,
        defenderId: keeper.id,
        contestedPos: { col: goalCol, row: goalRow },
        initiatorOrigin: shooter.pos,
        isShotDuel: true,
        isSuperShot: useSuperShot,
        goalRow,
        complexity: shot.complexity,
        ballOwnerBeforeId: shooter.id,
        bonusTimeMsBlue: blueBonusMs + superBonus,
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
      gameMode,
      onlineMatchId,
      players,
      ball,
      pitchType,
      blitzModePref,
      progression,
      difficulty,
      superDriveReady,
      matchStats,
      scoreBlue,
      scoreRed,
      turnCount,
      scoreGoal,
      pushCommentary,
      triggerBanner,
      triggerCallout,
    ]
  );

  const handleResolveDuel = useCallback(
    (winnerTeam: Team | "draw", _outcomeText: string, wasTimeout: boolean) => {
      if (gameMode === "online" || isSpectating) return;
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

      const dynamicPlayers = updateSquadStamina(
        applyDynamicOffBallRuns(nextPlayers, initiator.id, finalBall, pitchType, mentality),
        initiator.id,
        3,
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
      gameMode,
      isSpectating,
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

  // Real-time Server WebSocket Match & Spectator State Sync
  useEffect(() => {
    const unsub = mpClient.subscribeMatchEvents((ev) => {
      if (ev.type === "mp:error") {
        if (ev.message) triggerBanner(ev.message, "red");
        return;
      }

      if (!ev.match) return;
      const snap = ev.match;

      if (ev.type === "match:started") {
        clearTimers();
        matchRewardedRef.current = false;
        if (humanAiLiveIdRef.current) {
          mpClient.unpublishLiveMatch(humanAiLiveIdRef.current);
          humanAiLiveIdRef.current = null;
        }
        const mySide: Team = ev.yourTeam ?? "blue";
        setOpenWindows([]);
        setMinimizedWindows([]);
        setIsSpectating(false);
        setLocalAiDerby(false);
        setSpectateMatchId(null);
        setGameMode("online");
        setLocalTeam(mySide);
        setOnlineMatchId(snap.id);
        setServerMatch(snap);
        setPitchType(snap.pitchType);
        setBlitzPace(snap.pace);
        setBlitzModePref(snap.blitzModePref);
        setDifficulty(snap.difficulty);
        setPlayers(snap.players);
        setBall(snap.ball);
        setScoreBlue(snap.scoreBlue);
        setScoreRed(snap.scoreRed);
        setTurnCount(snap.turnCount);
        setCurrentTurn(snap.currentTurn);
        setLastMoveTrace(snap.lastMoveTrace);
        setGoalBanner(snap.goalBanner);
        setWinner(snap.winner);
        setActiveDuel(snap.activeDuelState?.duel ?? null);
        setCommentaryLog(snap.commentary);
        setMatchStats(emptyMatchStats());
        setLastMatchReward(null);
        setSelectedPlayerId(null);
        setMomentum(0);
        setComboStreak(0);
        setSuperDriveReady(false);
        setPhase("PLAYING");
        soundFX.playWhistle();
        triggerBanner(
          `⚔️ Онлайн-матч начался! Вы играете за ${mySide === "blue" ? "Синих" : "Красных"}`,
          mySide
        );
        return;
      }

      if (ev.type === "spectate:joined") {
        clearTimers();
        setOpenWindows([]);
        setMinimizedWindows([]);
        setIsSpectating(true);
        setLocalAiDerby(false);
        setOnlineMatchId(null);
        setSpectateMatchId(snap.id);
        setServerMatch(snap);
        setPitchType(snap.pitchType);
        setBlitzPace(snap.pace);
        setBlitzModePref(snap.blitzModePref);
        setDifficulty(snap.difficulty);
        setPlayers(snap.players);
        setBall(snap.ball);
        setScoreBlue(snap.scoreBlue);
        setScoreRed(snap.scoreRed);
        setTurnCount(snap.turnCount);
        setCurrentTurn(snap.currentTurn);
        setLastMoveTrace(snap.lastMoveTrace);
        setGoalBanner(snap.goalBanner);
        setWinner(snap.winner);
        setActiveDuel(snap.activeDuelState?.duel ?? null);
        setCommentaryLog(snap.commentary);
        setSelectedPlayerId(null);
        setPhase(
          snap.status === "blitz" && snap.activeDuelState
            ? "BLITZ_DUEL"
            : snap.status === "goal" && snap.goalBanner
            ? "GOAL_CELEBRATION"
            : snap.status === "finished"
            ? "GAME_OVER"
            : "PLAYING"
        );
        triggerBanner(`📺 BLITZ TV LIVE: ${snap.roomName}`, "gold");
        return;
      }

      if (ev.type === "match:state") {
        if (snap.id !== onlineMatchId && snap.id !== spectateMatchId) return;
        setServerMatch(snap);
        setPlayers(snap.players);
        setBall(snap.ball);
        setScoreBlue(snap.scoreBlue);
        setScoreRed(snap.scoreRed);
        setTurnCount(snap.turnCount);
        setCurrentTurn(snap.currentTurn);
        setLastMoveTrace(snap.lastMoveTrace);
        setGoalBanner(snap.goalBanner);
        setWinner(snap.winner);
        setActiveDuel(snap.activeDuelState?.duel ?? null);
        setCommentaryLog(snap.commentary);

        if (snap.ballFlight && snap.ballFlight.nonce !== lastBallFlightNonceRef.current) {
          lastBallFlightNonceRef.current = snap.ballFlight.nonce;
          setBallFlight(snap.ballFlight);
          if (snap.ballFlight.isShot) soundFX.playGoal();
          else soundFX.playPass();
        }
        if (snap.callout && snap.callout.id !== lastCalloutIdRef.current) {
          lastCalloutIdRef.current = snap.callout.id;
          setFloatingCallout(snap.callout);
        }

        const nextPhase: GamePhase =
          snap.status === "blitz" && snap.activeDuelState
            ? "BLITZ_DUEL"
            : snap.status === "goal" && snap.goalBanner
            ? "GOAL_CELEBRATION"
            : snap.status === "finished"
            ? "GAME_OVER"
            : "PLAYING";
        setPhase(nextPhase);

        if (snap.status === "finished" && gameMode === "online" && !isSpectating && !matchRewardedRef.current) {
          soundFX.playWhistle();
          const won = snap.telemetry.blitzBlueWon;
          const myBlitzWon = localTeam === "blue" ? won : snap.telemetry.blitzRedWon;
          finalizeMatchRewards(
            snap.scoreBlue,
            snap.scoreRed,
            {
              ...emptyMatchStats(),
              passes: localTeam === "blue" ? snap.telemetry.passesBlue : snap.telemetry.passesRed,
              shots: localTeam === "blue" ? snap.telemetry.shotsBlue : snap.telemetry.shotsRed,
              blitzWon: myBlitzWon,
            },
            localTeam
          );
        }
      }
    });
    return () => unsub();
  }, [onlineMatchId, spectateMatchId, gameMode, isSpectating, localTeam, finalizeMatchRewards, triggerBanner]);

  // Broadcast live Human-vs-AI match telemetry so spectators can watch from the Lobby
  useEffect(() => {
    if (gameMode !== "ai" || isSpectating || phase === "TITLE_MENU") return;
    if (!humanAiLiveIdRef.current) {
      humanAiLiveIdRef.current = `live-${mpClient.getClientId()}-${Date.now().toString(36)}`;
    }
    const telemetry: MatchTelemetryStats = {
      blueTurns: Math.ceil(turnCount / 2),
      redTurns: Math.floor(turnCount / 2),
      passesBlue: matchStats.passes,
      passesRed: Math.max(0, Math.floor(turnCount / 3)),
      shotsBlue: matchStats.shots,
      shotsRed: scoreRed,
      blitzBlueWon: matchStats.blitzWon,
      blitzRedWon: Math.max(0, matchStats.blitzPlayed - matchStats.blitzWon),
    };
    const status: ServerMatchSnapshot["status"] =
      phase === "BLITZ_DUEL"
        ? "blitz"
        : phase === "GOAL_CELEBRATION"
        ? "goal"
        : phase === "GAME_OVER"
        ? "finished"
        : "playing";

    mpClient.publishLiveMatch({
      id: humanAiLiveIdRef.current,
      kind: "human_ai",
      roomName: `${userProfile.clubName} vs ${aiEngine === "groq" ? "Groq ИИ" : "Тактик-ИИ"}`,
      hostClientId: mpClient.getClientId(),
      guestClientId: null,
      hostName: userProfile.clubName,
      guestName: aiEngine === "groq" ? "Groq ИИ-Агент" : "Тактик-ИИ 95",
      pitchType,
      pace: blitzPace,
      blitzModePref,
      difficulty,
      players,
      ball,
      currentTurn,
      turnCount,
      scoreBlue,
      scoreRed,
      status,
      winner,
      activeDuelState: null,
      lastMoveTrace,
      ballFlight,
      goalBanner,
      callout: floatingCallout,
      commentary: commentaryLog,
      telemetry,
      viewers: 0,
      updatedAt: Date.now(),
    });
  }, [
    gameMode,
    isSpectating,
    phase,
    userProfile.clubName,
    aiEngine,
    pitchType,
    blitzPace,
    blitzModePref,
    difficulty,
    players,
    ball,
    currentTurn,
    turnCount,
    scoreBlue,
    scoreRed,
    winner,
    lastMoveTrace,
    ballFlight,
    goalBanner,
    floatingCallout,
    commentaryLog,
    matchStats,
  ]);

  // AI opponent turn + Local AI-vs-AI Derby simulation
  useEffect(() => {
    const isAiTurn = gameMode === "ai" && currentTurn === "red" && !isSpectating;
    const isLocalDerbyTurn =
      isSpectating && localAiDerby && !serverMatch && (currentTurn === "blue" || currentTurn === "red");

    if (
      phase !== "PLAYING" ||
      (!isAiTurn && !isLocalDerbyTurn) ||
      hasVisibleModalWindow
    ) {
      return;
    }

    const controller = new AbortController();
    const aiDelay = aiPace === "fast" ? 160 : 380;

    aiTimerRef.current = window.setTimeout(async () => {
      const activeTeam = currentTurn;
      let action = computeBestTacticalMove(
        activeTeam,
        players,
        ball,
        difficulty,
        pitchType,
        blitzModePref,
        progression
      );

      if (isAiTurn && aiEngine === "groq") {
        try {
          const resp = await fetch("/api/ai-agent/move", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              team: activeTeam,
              players,
              ball,
              difficulty,
              pitchType,
              blitzModePref,
              scoreBlue,
              scoreRed,
              turnCount,
            }),
          });
          if (resp.ok) {
            const data = (await resp.json()) as {
              hint?: typeof action;
              source?: "groq" | "local";
              tacticBadge?: string;
            };
            if (data.hint) {
              action = data.hint;
            }
            if (data.tacticBadge) {
              setAiAgentBadge(
                data.source === "groq" ? `GROQ · ${data.tacticBadge}` : data.tacticBadge
              );
            }
          }
        } catch {
          if (controller.signal.aborted) return;
        }
      } else {
        setAiAgentBadge(null);
      }

      if (controller.signal.aborted) return;

      if (!action) {
        advanceTurnOrEndMatch(scoreBlue, scoreRed, activeTeam, turnCount, matchStats);
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
    }, aiDelay);

    return () => {
      controller.abort();
      if (aiTimerRef.current !== null) {
        window.clearTimeout(aiTimerRef.current);
        aiTimerRef.current = null;
      }
    };
  }, [
    phase,
    gameMode,
    isSpectating,
    localAiDerby,
    serverMatch,
    aiEngine,
    currentTurn,
    aiPace,
    hasVisibleModalWindow,
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
      blitzPref: BlitzModePreference,
      spectate = false,
      engine: AIOpponentEngine = aiEngine,
      localDerby = false
    ) => {
      clearTimers();
      if (humanAiLiveIdRef.current) {
        mpClient.unpublishLiveMatch(humanAiLiveIdRef.current);
        humanAiLiveIdRef.current = null;
      }
      if (spectateMatchId) {
        mpClient.leaveSpectate(spectateMatchId);
      }
      setOnlineMatchId(null);
      setSpectateMatchId(null);
      setServerMatch(null);
      setLocalTeam("blue");
      setAiAgentBadge(null);
      setAiEngine(engine);
      setLocalAiDerby(localDerby);
      matchRewardedRef.current = false;
      const reset = createInitialFormation();
      setIsSpectating(spectate);
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
      setOpenWindows([]);
      setMinimizedWindows([]);
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
    [aiEngine, spectateMatchId, pushCommentary]
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

  const handleCyclePlayer = useCallback(() => {
    if (!isHumanTurn || quickSwitchPlayers.length === 0) return;
    const idx = quickSwitchPlayers.findIndex((p) => p.id === selectedPlayerId);
    const nextIdx = idx === -1 ? 0 : (idx + 1) % quickSwitchPlayers.length;
    setSelectedPlayerId(quickSwitchPlayers[nextIdx].id);
  }, [isHumanTurn, quickSwitchPlayers, selectedPlayerId]);

  const handleSelectBestDefender = useCallback(() => {
    if (!isHumanTurn) return;
    const candidates = players
      .filter((p) => p.team === currentTurn && p.role !== "GK")
      .sort(
        (a, b) =>
          Math.hypot(a.pos.col - ball.pos.col, a.pos.row - ball.pos.row) -
          Math.hypot(b.pos.col - ball.pos.col, b.pos.row - ball.pos.row)
      );
    if (candidates.length > 0) {
      setSelectedPlayerId(candidates[0].id);
      triggerCallout(candidates[0].pos, "ОТБОР!", 0x60a5fa);
    }
  }, [isHumanTurn, players, currentTurn, ball.pos, triggerCallout]);

  const handleAutoMove = useCallback(() => {
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
  }, [
    isHumanTurn,
    coachHint,
    currentTurn,
    players,
    ball,
    pitchType,
    blitzModePref,
    progression,
    executeShot,
    executePass,
    executeMove,
  ]);

  // Keyboard shortcuts for desktop convenience (Tab = switch, Space = best move, Enter = shoot/pass, Esc = deselect)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isHumanTurn) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) {
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        handleCyclePlayer();
      } else if (e.code === "Space") {
        e.preventDefault();
        handleAutoMove();
      } else if (e.key === "Enter") {
        if (validShots.length > 0 && selectedPlayer) {
          e.preventDefault();
          const openShot = validShots.find((s) => !s.isContested) ?? validShots[0];
          if (openShot) executeShot(selectedPlayer, openShot.goalRow);
        } else if (validPasses.length > 0 && selectedPlayer) {
          e.preventDefault();
          const bestPass = [...validPasses].sort((a, b) => b.pos.col - a.pos.col)[0];
          if (bestPass) executePass(selectedPlayer, bestPass.targetPlayerId);
        }
      } else if (e.key === "Escape") {
        setSelectedPlayerId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    isHumanTurn,
    handleCyclePlayer,
    handleAutoMove,
    validShots,
    validPasses,
    selectedPlayer,
    executeShot,
    executePass,
  ]);

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
    <main className="relative w-screen h-dvh overflow-hidden win95-desktop">
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
        cameraPreset={cameraPreset}
        onChangeCameraPreset={setCameraPreset}
        crtEnabled={crtEnabled}
        onToggleCrt={() => setCrtEnabled((v) => !v)}
        onlineCount={lobbyState.onlineUsers.length}
        onOpenLobby={() => openWindow("lobby")}
        hideHudWidgets={phase === "TITLE_MENU"}
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
        aiEngine={aiEngine}
        aiAgentBadge={aiAgentBadge}
        localTeam={localTeam}
        serverMatch={serverMatch}
        liveMatches={lobbyState.liveMatches}
        players={players}
        progression={progression}
        matchStats={matchStats}
        cameraPreset={cameraPreset}
        crtEnabled={crtEnabled}
        onlineCount={lobbyState.onlineUsers.length}
        blitzPace={blitzPace}
        aiPace={aiPace}
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
        isHumanTurn={isHumanTurn}
        isSpectating={isSpectating}
        quickSwitchPlayers={quickSwitchPlayers}
        ballCarrierId={ball.carrierId}
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
        openWindows={openWindows}
        minimizedWindows={minimizedWindows}
        activeWindowId={activeWindowId}
        getWindowZ={getWindowZ}
        onOpenWindow={openWindow}
        onFocusWindow={focusWindow}
        onMinimizeWindow={minimizeWindow}
        onCloseWindow={closeWindow}
        onToggleTaskbarWindow={toggleTaskbarWindow}
        onStartMatch={(mode, diff, pace, pitch, blitzPref, engine) =>
          startNewMatch(mode, diff, pace, pitch, blitzPref, false, engine, false)
        }
        onResetMatch={() =>
          startNewMatch(
            gameMode === "online" ? "ai" : gameMode,
            difficulty,
            blitzPace,
            pitchType,
            blitzModePref,
            false,
            aiEngine,
            false
          )
        }
        onOpenSetup={() => {
          clearTimers();
          if (humanAiLiveIdRef.current) {
            mpClient.unpublishLiveMatch(humanAiLiveIdRef.current);
            humanAiLiveIdRef.current = null;
          }
          if (spectateMatchId) {
            mpClient.leaveSpectate(spectateMatchId);
          }
          setOnlineMatchId(null);
          setSpectateMatchId(null);
          setServerMatch(null);
          setLocalAiDerby(false);
          setActiveDuel(null);
          setIsSpectating(false);
          setPhase("TITLE_MENU");
          openWindow("setup");
        }}
        onToggleSound={handleToggleSound}
        onToggleTts={handleToggleTts}
        onToggleAIPace={() => setAiPace((p) => (p === "normal" ? "fast" : "normal"))}
        onToggleCoachHint={() => setShowCoachHint((v) => !v)}
        onToggleCrt={() => setCrtEnabled((v) => !v)}
        onChangeCameraPreset={setCameraPreset}
        onChangeMentality={setMentality}
        onChangeDifficulty={setDifficulty}
        onChangeAiEngine={setAiEngine}
        onChangeBlitzPace={setBlitzPace}
        onChangeBlitzPref={setBlitzModePref}
        onSelectQuickPlayer={(id) => setSelectedPlayerId(id)}
        onSelectBestDefender={handleSelectBestDefender}
        onCyclePlayer={handleCyclePlayer}
        onQuickPass={handleQuickPass}
        onQuickShot={handleQuickShot}
        onAutoMove={handleAutoMove}
        onExitSpectate={handleExitSpectate}
        onSwitchSpectateMatch={handleSwitchSpectateMatch}
        onSendSpectateReaction={handleSendSpectateReaction}
        onResignOnlineMatch={() => {
          if (onlineMatchId) mpClient.resignMatch(onlineMatchId);
        }}
        userProfile={userProfile}
      />

      {phase === "BLITZ_DUEL" && activeDuel && (
        <BlitzDuelModal
          duel={activeDuel}
          players={players}
          gameMode={gameMode}
          difficulty={difficulty}
          blitzPace={blitzPace}
          isSpectator={isSpectating}
          localTeam={localTeam}
          serverDuelState={serverMatch?.activeDuelState ?? null}
          onServerMark={(cellIdx) => {
            if (onlineMatchId) {
              mpClient.sendBlitzMark(onlineMatchId, cellIdx);
            }
          }}
          onResolve={handleResolveDuel}
        />
      )}

      {openWindows.includes("lobby") && (
        <MultiplayerLobbyModal
          clubName={userProfile.clubName}
          managerName={userProfile.managerName}
          zIndex={getWindowZ("lobby")}
          isActive={activeWindowId === "lobby"}
          isMinimized={minimizedWindows.includes("lobby")}
          cascadeIndex={1}
          topBoundary={phase === "TITLE_MENU" ? 4 : 42}
          onFocus={() => focusWindow("lobby")}
          onMinimize={() => minimizeWindow("lobby")}
          onStartVsAiMatch={(pitch, pace) => {
            closeWindow("lobby");
            startNewMatch("ai", difficulty, pace, pitch, blitzModePref, false, aiEngine, false);
          }}
          onSpectateMatch={handleSpectateLiveMatch}
          onStartLocalAiDerby={(pitch, pace) => {
            closeWindow("lobby");
            startNewMatch("ai", "pro", pace, pitch, "dynamic", true, "classic", true);
            triggerBanner("🤖 Локальное ИИ-Дерби запущено!", "gold");
          }}
          onOpenChallenge={() => openWindow("challenge")}
          onClose={() => closeWindow("lobby")}
        />
      )}

      {openWindows.includes("profile") && (
        <ProfileModal
          profile={userProfile}
          progression={progression}
          zIndex={getWindowZ("profile")}
          isActive={activeWindowId === "profile"}
          isMinimized={minimizedWindows.includes("profile")}
          cascadeIndex={2}
          topBoundary={phase === "TITLE_MENU" ? 4 : 42}
          onFocus={() => focusWindow("profile")}
          onMinimize={() => minimizeWindow("profile")}
          onSaveProfile={handleSaveProfile}
          onOpenSquad={() => openWindow("squad")}
          onOpenChallenge={() => openWindow("challenge")}
          onClose={() => closeWindow("profile")}
        />
      )}

      {openWindows.includes("challenge") && (
        <ChallengeModal
          clubName={userProfile.clubName}
          pitchType={pitchType}
          blitzPace={blitzPace}
          zIndex={getWindowZ("challenge")}
          isActive={activeWindowId === "challenge"}
          isMinimized={minimizedWindows.includes("challenge")}
          cascadeIndex={3}
          topBoundary={phase === "TITLE_MENU" ? 4 : 42}
          onFocus={() => focusWindow("challenge")}
          onMinimize={() => minimizeWindow("challenge")}
          onAcceptChallenge={handleAcceptChallenge}
          onClose={() => closeWindow("challenge")}
        />
      )}

      {openWindows.includes("squad") && (
        <SquadModal
          progression={progression}
          players={players}
          zIndex={getWindowZ("squad")}
          isActive={activeWindowId === "squad"}
          isMinimized={minimizedWindows.includes("squad")}
          cascadeIndex={2}
          topBoundary={phase === "TITLE_MENU" ? 4 : 42}
          onFocus={() => focusWindow("squad")}
          onMinimize={() => minimizeWindow("squad")}
          onUpgradeStat={handleUpgradeStat}
          onUnlockAbility={handleUnlockAbility}
          onUpdateAppearance={handleUpdateAppearance}
          onOpenTactics={() => openWindow("tactics")}
          onClose={() => closeWindow("squad")}
        />
      )}

      {openWindows.includes("coach") && (
        <CoachModal
          pitchType={pitchType}
          difficulty={difficulty}
          scoreBlue={scoreBlue}
          scoreRed={scoreRed}
          turnCount={turnCount}
          stats={matchStats}
          progression={progression}
          zIndex={getWindowZ("coach")}
          isActive={activeWindowId === "coach"}
          isMinimized={minimizedWindows.includes("coach")}
          cascadeIndex={3}
          topBoundary={phase === "TITLE_MENU" ? 4 : 42}
          onFocus={() => focusWindow("coach")}
          onMinimize={() => minimizeWindow("coach")}
          onOpenSquad={() => openWindow("squad")}
          onClose={() => closeWindow("coach")}
        />
      )}
    </main>
  );
}
