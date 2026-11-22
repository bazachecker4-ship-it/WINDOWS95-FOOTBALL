import React, { useEffect, useState } from "react";
import {
  AIDifficulty,
  AIOpponentEngine,
  AIPace,
  BLITZ_VARIANT_META,
  BlitzModePreference,
  BlitzPace,
  CameraPreset,
  CommentaryItem,
  FormationId,
  GameMode,
  GamePhase,
  LiveMatchSummary,
  MAX_TURNS,
  MatchStats,
  PITCH_META,
  PitchType,
  PlayerActionMode,
  PlayerPiece,
  ROLE_META,
  ServerMatchSnapshot,
  SquadProgressionState,
  TARGET_GOALS,
  TacticalHint,
  TacticalMentality,
  TacticalPressureState,
  Team,
} from "../types/game";
import { UserProfile } from "../engine/profile";
import { ChessPieceIcon, SoccerBallIcon } from "./ChessPieceIcon";
import { Win95CaptionButtons, Win95FlagIcon, Win95StatusBar } from "./Win95Chrome";
import { DesktopWindowId, WINDOW_TASKBAR_LABELS, Win95Window } from "./Win95Window";
import {
  MainMenuHeroArtwork,
  PixelClubCrest,
  PixelCommentatorPortrait,
  PixelPlayerPortrait,
  PixelTrophyIllustration,
} from "./Win95Art";
import { PlayerActionPopover } from "./PlayerActionPopover";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Bot,
  BrainCircuit,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Cpu,
  Eye,
  FastForward,
  Flag,
  Flame,
  Globe,
  Home,
  Lightbulb,
  LogOut,
  Maximize,
  Menu,
  MessageSquare,
  Minimize2,
  Monitor,
  Play,
  QrCode,
  RefreshCw,
  RotateCcw,
  Settings,
  Settings2,
  Share2,
  Shield,
  Shirt,
  SlidersHorizontal,
  Speech,
  Swords,
  Target,
  Trophy,
  User,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";

interface OverlayHUDProps {
  phase: GamePhase;
  scoreBlue: number;
  scoreRed: number;
  turnCount: number;
  currentTurn: Team;
  gameMode: GameMode;
  difficulty: AIDifficulty;
  aiEngine: AIOpponentEngine;
  aiAgentBadge?: string | null;
  localTeam?: Team;
  serverMatch?: ServerMatchSnapshot | null;
  liveMatches?: LiveMatchSummary[];
  players: PlayerPiece[];
  progression: SquadProgressionState;
  matchStats: MatchStats;
  cameraPreset: CameraPreset;
  crtEnabled: boolean;
  onlineCount: number;
  blitzPace: BlitzPace;
  aiPace: AIPace;
  pitchType: PitchType;
  blitzModePref: BlitzModePreference;
  mentality: TacticalMentality;
  momentum: number;
  comboStreak: number;
  superDriveReady: boolean;
  broadcastBanner: { text: string; tone: "gold" | "blue" | "red" } | null;
  canQuickPass: boolean;
  canQuickShot: boolean;
  canAutoMove: boolean;
  isHumanTurn: boolean;
  isSpectating: boolean;
  quickSwitchPlayers: PlayerPiece[];
  ballCarrierId: string | null;
  skillPoints: number;
  lastMatchReward: { xp: number; points: number } | null;
  soundEnabled: boolean;
  ttsEnabled: boolean;
  showCoachHint: boolean;
  coachHint: TacticalHint | null;
  selectedPlayer: PlayerPiece | null;
  selectedHasBall: boolean;
  commentaryLog: CommentaryItem[];
  isCommentaryLoading: boolean;
  goalBanner: { team: Team; text: string } | null;
  winner: Team | "draw" | null;
  openWindows: DesktopWindowId[];
  minimizedWindows: DesktopWindowId[];
  activeWindowId: DesktopWindowId | null;
  getWindowZ: (id: DesktopWindowId) => number;
  onOpenWindow: (id: DesktopWindowId) => void;
  onFocusWindow: (id: DesktopWindowId) => void;
  onMinimizeWindow: (id: DesktopWindowId) => void;
  onCloseWindow: (id: DesktopWindowId) => void;
  onToggleTaskbarWindow: (id: DesktopWindowId) => void;
  onStartMatch: (
    mode: GameMode,
    difficulty: AIDifficulty,
    pace: BlitzPace,
    pitch: PitchType,
    blitzPref: BlitzModePreference,
    aiEngine: AIOpponentEngine
  ) => void;
  onResetMatch: () => void;
  onOpenSetup: () => void;
  onToggleSound: () => void;
  onToggleTts: () => void;
  onToggleAIPace: () => void;
  onToggleCoachHint: () => void;
  onToggleCrt: () => void;
  onChangeCameraPreset: (preset: CameraPreset) => void;
  onChangeMentality: (mentality: TacticalMentality) => void;
  onChangeDifficulty: (d: AIDifficulty) => void;
  onChangeAiEngine: (e: AIOpponentEngine) => void;
  onChangeBlitzPace: (p: BlitzPace) => void;
  onChangeBlitzPref: (p: BlitzModePreference) => void;
  onSelectQuickPlayer: (playerId: string) => void;
  onSelectBestDefender: () => void;
  onCyclePlayer: () => void;
  onQuickPass: () => void;
  onQuickShot: () => void;
  onAutoMove: () => void;
  onExitSpectate: () => void;
  onSwitchSpectateMatch?: (match: LiveMatchSummary) => void;
  onSendSpectateReaction?: (text: string) => void;
  onResignOnlineMatch?: () => void;
  userProfile: UserProfile;
  actionPoints: number;
  maxActionPoints: number;
  turnTimeLeft: number;
  maxTurnTime: number;
  actionMode: PlayerActionMode | null;
  moveMinCost: number;
  passCost: number;
  shotCost: number;
  hasClashTarget: boolean;
  canSelectedMove: boolean;
  pressureState?: TacticalPressureState | null;
  showActionPopover: boolean;
  onToggleActionPopover: (show: boolean) => void;
  onSelectActionMode: (action: PlayerActionMode) => void;
  onEndTurn: () => void;
  activeFormation: FormationId;
  onApplyFormation: (formation: FormationId) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  showMatchHudPanels?: boolean;
  onToggleMatchHudPanels?: () => void;
}

const DIFFICULTY_LABELS: Record<AIDifficulty, string> = {
  rookie: "Новичок",
  tactical: "Тактик",
  pro: "Профи",
};

const PACE_LABELS: Record<BlitzPace, string> = {
  turbo: "Турбо · 2.2с",
  blitz: "Блиц · 3.5с",
  relaxed: "Без таймера",
};

const BLITZ_PREF_LABELS: Record<BlitzModePreference, string> = {
  dynamic: "По ситуации",
  classic: "3×3 Классика",
  decay: "3×3 След",
  blocked: "4×4 Блоки",
  grand: "5×5 Штрафная",
};

const PLAYER_NAMES_BY_NUM: Record<number, string> = {
  1: "Соколов",
  2: "Орлов",
  3: "Волков",
  4: "Громов",
  5: "Беллингем",
  6: "Лебедев",
  7: "Ковалёв",
  8: "Белов",
  9: "Холланд",
  10: "Месси",
  11: "Зайцев",
};

const TOURNAMENTS = [
  {
    id: "league",
    name: "Чемпионат Лиги",
    desc: "Классический чемпионат на идеальном газоне против Тактик-ИИ.",
    pitch: "turf" as PitchType,
    diff: "tactical" as AIDifficulty,
    engine: "groq" as AIOpponentEngine,
    pace: "blitz" as BlitzPace,
  },
  {
    id: "worldcup",
    name: "Кубок Мира",
    desc: "Международный турнир с участием лучших сборных мира (Groq Pro AI).",
    pitch: "turf" as PitchType,
    diff: "pro" as AIDifficulty,
    engine: "groq" as AIOpponentEngine,
    pace: "turbo" as BlitzPace,
  },
  {
    id: "champions",
    name: "Лига Чемпионов",
    desc: "Тактические барьеры на флангах и жёсткие дуэли 4×4 в штрафной.",
    pitch: "obstacles" as PitchType,
    diff: "pro" as AIDifficulty,
    engine: "groq" as AIOpponentEngine,
    pace: "blitz" as BlitzPace,
  },
  {
    id: "eurocup",
    name: "Кубок Европы",
    desc: "Зимний ледовый финал со скользкими рывками +2 клетки.",
    pitch: "ice" as PitchType,
    diff: "tactical" as AIDifficulty,
    engine: "classic" as AIOpponentEngine,
    pace: "blitz" as BlitzPace,
  },
  {
    id: "supercup",
    name: "Суперкубок",
    desc: "Пляжный суперфинал на вязком песке с блоками.",
    pitch: "sand" as PitchType,
    diff: "tactical" as AIDifficulty,
    engine: "groq" as AIOpponentEngine,
    pace: "blitz" as BlitzPace,
  },
];

const FORMATIONS: Array<{
  id: "4-3-3" | "4-4-2" | "3-5-2";
  dots: Array<[number, number]>;
}> = [
  {
    id: "4-3-3",
    dots: [
      [50, 90],
      [18, 72],
      [39, 75],
      [61, 75],
      [82, 72],
      [28, 52],
      [50, 56],
      [72, 52],
      [20, 26],
      [50, 18],
      [80, 26],
    ],
  },
  {
    id: "4-4-2",
    dots: [
      [50, 90],
      [18, 72],
      [39, 75],
      [61, 75],
      [82, 72],
      [18, 48],
      [40, 52],
      [60, 52],
      [82, 48],
      [36, 22],
      [64, 22],
    ],
  },
  {
    id: "3-5-2",
    dots: [
      [50, 90],
      [26, 75],
      [50, 77],
      [74, 75],
      [15, 50],
      [34, 54],
      [50, 44],
      [66, 54],
      [85, 50],
      [36, 20],
      [64, 20],
    ],
  },
];

const CAMERA_CYCLE_ORDER: CameraPreset[] = ["tv", "wide", "close", "topdown", "opposite"];
const CAMERA_SHORT_LABELS: Record<CameraPreset, string> = {
  tv: "ТВ",
  wide: "Обзор",
  close: "Зум",
  topdown: "Верх",
  opposite: "180°",
};

function useIsCompactViewport() {
  const [state, setState] = useState(() => {
    if (typeof window === "undefined") {
      return { isCompact: false, isLandscapePhone: false };
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    return {
      isCompact: w < 768 || h < 520,
      isLandscapePhone: w >= 560 && h < 520,
    };
  });

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setState({
        isCompact: w < 768 || h < 520,
        isLandscapePhone: w >= 560 && h < 520,
      });
    };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return state;
}

function formatClock(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const OverlayHUD: React.FC<OverlayHUDProps> = ({
  phase,
  scoreBlue,
  scoreRed,
  turnCount,
  currentTurn,
  gameMode,
  difficulty,
  aiEngine,
  aiAgentBadge,
  localTeam = "blue",
  serverMatch,
  liveMatches = [],
  players,
  progression,
  matchStats,
  cameraPreset,
  crtEnabled,
  onlineCount,
  blitzPace,
  aiPace,
  pitchType,
  blitzModePref,
  mentality,
  momentum,
  comboStreak,
  superDriveReady,
  broadcastBanner,
  canQuickPass,
  canQuickShot,
  canAutoMove,
  isHumanTurn,
  isSpectating,
  quickSwitchPlayers,
  ballCarrierId,
  skillPoints,
  lastMatchReward,
  soundEnabled,
  ttsEnabled,
  showCoachHint,
  coachHint,
  selectedPlayer,
  selectedHasBall,
  commentaryLog,
  isCommentaryLoading,
  goalBanner,
  winner,
  openWindows,
  minimizedWindows,
  activeWindowId,
  getWindowZ,
  onOpenWindow,
  onFocusWindow,
  onMinimizeWindow,
  onCloseWindow,
  onToggleTaskbarWindow,
  onStartMatch,
  onResetMatch,
  onOpenSetup,
  onToggleSound,
  onToggleTts,
  onToggleAIPace,
  onToggleCoachHint,
  onToggleCrt,
  onChangeCameraPreset,
  onChangeMentality,
  onChangeDifficulty,
  onChangeAiEngine,
  onChangeBlitzPace,
  onChangeBlitzPref,
  onSelectQuickPlayer,
  onSelectBestDefender,
  onCyclePlayer,
  onQuickPass,
  onQuickShot,
  onAutoMove,
  onExitSpectate,
  onSwitchSpectateMatch,
  onSendSpectateReaction,
  onResignOnlineMatch,
  userProfile,
  actionPoints,
  maxActionPoints,
  turnTimeLeft,
  maxTurnTime,
  actionMode,
  moveMinCost,
  passCost,
  shotCost,
  hasClashTarget,
  canSelectedMove,
  pressureState = null,
  showActionPopover,
  onToggleActionPopover,
  onSelectActionMode,
  onEndTurn,
  activeFormation: currentFormationId,
  onApplyFormation,
  isFullscreen,
  onToggleFullscreen: toggleFullscreen,
  showMatchHudPanels = false,
  onToggleMatchHudPanels,
}) => {
  const { isCompact, isLandscapePhone } = useIsCompactViewport();
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [clockTime, setClockTime] = useState(formatClock);
  const [commentaryExpanded, setCommentaryExpanded] = useState(true);
  const [playerCardCollapsed, setPlayerCardCollapsed] = useState(false);
  const [quickMatchOpen, setQuickMatchOpen] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  const [setupMode, setSetupMode] = useState<GameMode>(gameMode === "online" ? "ai" : gameMode);
  const [setupDifficulty, setSetupDifficulty] = useState<AIDifficulty>(difficulty);
  const [setupAiEngine, setSetupAiEngine] = useState<AIOpponentEngine>(aiEngine);
  const [setupPace, setSetupPace] = useState<BlitzPace>(blitzPace);
  const [setupPitch, setSetupPitch] = useState<PitchType>(pitchType);
  const [setupBlitzPref, setSetupBlitzPref] = useState<BlitzModePreference>(blitzModePref);

  const [selectedTournamentId, setSelectedTournamentId] = useState(TOURNAMENTS[1].id);
  const [formationIdx, setFormationIdx] = useState(() => {
    const idx = FORMATIONS.findIndex((f) => f.id === currentFormationId);
    return idx >= 0 ? idx : 0;
  });
  const [settingsTab, setSettingsTab] = useState<"game" | "graphics" | "sound" | "controls">("game");

  useEffect(() => {
    const timer = window.setInterval(() => setClockTime(formatClock()), 20000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const idx = FORMATIONS.findIndex((f) => f.id === currentFormationId);
    if (idx >= 0) setFormationIdx(idx);
  }, [currentFormationId]);

  useEffect(() => {
    if (phase === "TITLE_MENU") {
      setDockCollapsed(false);
    }
  }, [phase]);

  const latestCommentary = commentaryLog[0];
  const setupOpen = openWindows.includes("setup");
  const rulesOpen = openWindows.includes("rules");
  const tournamentsOpen = openWindows.includes("tournaments");
  const tacticsOpen = openWindows.includes("tactics");
  const statsOpen = openWindows.includes("stats");
  const settingsOpen = openWindows.includes("settings");

  const activePlayerCard =
    selectedPlayer ||
    (ballCarrierId ? players.find((p) => p.id === ballCarrierId) : undefined) ||
    players.find((p) => p.team === "blue" && p.role === "MID") ||
    null;

  const activeStats = activePlayerCard
    ? progression.roles[activePlayerCard.role].stats
    : { speed: 2, accuracy: 2, defense: 2, passing: 2 };

  const activeFormation = FORMATIONS[formationIdx % FORMATIONS.length];
  const activeTournament = TOURNAMENTS.find((t) => t.id === selectedTournamentId) ?? TOURNAMENTS[0];

  const leftClubLabel = serverMatch
    ? serverMatch.hostName
    : gameMode === "online" && localTeam === "red"
    ? "СОПЕРНИК"
    : userProfile.clubName;

  const rightClubLabel = serverMatch
    ? serverMatch.guestName
    : gameMode === "ai" && !isSpectating
    ? aiEngine === "groq"
      ? "GROQ ИИ"
      : "CPU 95"
    : "КРАСНЫЕ";

  const renderStartMenuPopup = (alignBottom: boolean) =>
    startMenuOpen && (
      <>
        <div
          className="fixed inset-0 z-40"
          onClick={() => setStartMenuOpen(false)}
          aria-hidden="true"
        />
        <div
          className={`absolute left-0 z-50 pc-window p-[3px] w-64 flex shadow-xl ${
            alignBottom ? "bottom-8" : "top-6"
          }`}
          role="menu"
        >
          <div className="w-7 bg-[#000080] text-white flex items-end justify-center pb-2 shrink-0">
            <span
              className="font-display text-sm font-bold tracking-widest text-slate-200 whitespace-nowrap"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              WIN <span className="text-white">95</span>
            </span>
          </div>

          <div className="flex-1 py-1 text-xs text-black space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setStartMenuOpen(false);
                onOpenSetup();
              }}
              className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left hover:bg-[#000080] hover:text-white cursor-pointer font-bold"
            >
              <Play className="w-3.5 h-3.5 shrink-0" />
              <span>Главное меню / Новый матч</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStartMenuOpen(false);
                onOpenWindow("tournaments");
              }}
              className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left hover:bg-[#000080] hover:text-white cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 shrink-0 text-amber-600" />
              <span>Турниры</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStartMenuOpen(false);
                onOpenWindow("squad");
              }}
              className="w-full px-2.5 py-1.5 flex items-center justify-between gap-2 text-left hover:bg-[#000080] hover:text-white cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                <span>Состав команды</span>
              </span>
              {skillPoints > 0 && (
                <span className="font-mono text-[10px] font-bold bg-amber-300 text-black px-1">
                  +{skillPoints}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setStartMenuOpen(false);
                onOpenWindow("tactics");
              }}
              className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left hover:bg-[#000080] hover:text-white cursor-pointer"
            >
              <ClipboardList className="w-3.5 h-3.5 shrink-0" />
              <span>Тактика команды</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStartMenuOpen(false);
                onOpenWindow("stats");
              }}
              className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left hover:bg-[#000080] hover:text-white cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5 shrink-0" />
              <span>Статистика матча</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStartMenuOpen(false);
                onOpenWindow("lobby");
              }}
              className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left hover:bg-[#000080] hover:text-white cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>Онлайн и Эфир ({onlineCount})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStartMenuOpen(false);
                onOpenWindow("challenge");
              }}
              className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left hover:bg-[#000080] hover:text-white cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 shrink-0" />
              <span>Бросить вызов (QR)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStartMenuOpen(false);
                onOpenWindow("coach");
              }}
              className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left hover:bg-[#000080] hover:text-white cursor-pointer"
            >
              <BrainCircuit className="w-3.5 h-3.5 shrink-0" />
              <span>Советы тренера</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStartMenuOpen(false);
                onOpenWindow("settings");
              }}
              className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left hover:bg-[#000080] hover:text-white cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 shrink-0" />
              <span>Настройки</span>
            </button>

            <div className="my-1 border-t border-[#808080] border-b border-b-white" />

            <button
              type="button"
              onClick={() => {
                setStartMenuOpen(false);
                onOpenWindow("profile");
              }}
              className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left hover:bg-[#000080] hover:text-white cursor-pointer"
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate font-bold">Клуб: {userProfile.clubName}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStartMenuOpen(false);
                onOpenWindow("rules");
              }}
              className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left hover:bg-[#000080] hover:text-white cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span>Помощь (HELP.HLP)</span>
            </button>
          </div>
        </div>
      </>
    );

  const cycleCameraPreset = () => {
    const idx = CAMERA_CYCLE_ORDER.indexOf(cameraPreset);
    const next = CAMERA_CYCLE_ORDER[(idx + 1) % CAMERA_CYCLE_ORDER.length];
    onChangeCameraPreset(next);
  };

  return (
    <>
      {/* ============================================================
          UNIFIED MOBILE TOP BAR (< 768px or short landscape phone < 520px height)
          Clean translucent corner scorebug by default; full bar if HUD expanded
          ============================================================ */}
      {isCompact && phase !== "TITLE_MENU" && (
        <>
          {showMatchHudPanels ? (
            <header className="fixed top-0 left-0 right-0 z-50 pc-window border-t-0 border-l-0 border-r-0 px-1.5 h-11 flex items-center justify-between gap-1.5 select-none">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="Открыть меню матча"
                className={`w-9 h-8 flex items-center justify-center shrink-0 cursor-pointer ${
                  mobileMenuOpen ? "pc-btn-active" : "pc-btn"
                }`}
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>

              <div className="flex-1 min-w-0 flex items-center justify-center gap-1.5">
                <div className="pc-window-dark px-2 py-0.5 flex items-center gap-1.5 min-w-0">
                  <span
                    className={`font-display text-xs font-bold truncate max-w-[44px] ${
                      currentTurn === "blue" ? "text-sky-300" : "text-slate-400"
                    }`}
                  >
                    {leftClubLabel.slice(0, 3)}
                  </span>
                  <span className="font-display text-base font-bold tabular-nums text-white leading-none shrink-0">
                    {scoreBlue}:{scoreRed}
                  </span>
                  <span
                    className={`font-display text-xs font-bold truncate max-w-[44px] ${
                      currentTurn === "red" ? "text-red-300" : "text-slate-400"
                    }`}
                  >
                    {rightClubLabel.slice(0, 3)}
                  </span>
                  <span className="font-mono text-[10px] text-slate-300 border-l border-slate-600 pl-1.5 tabular-nums shrink-0">
                    {String(Math.min(turnCount, MAX_TURNS)).padStart(2, "0")}/{MAX_TURNS}
                  </span>
                </div>

                {!isSpectating && (
                  <div className="pc-inset px-1.5 py-0.5 flex items-center gap-1 font-mono text-[10px] font-bold shrink-0">
                    <span className="text-[#000080] flex items-center gap-0.5 tabular-nums">
                      <Zap className="w-3 h-3 text-amber-600 shrink-0" />
                      {actionPoints}
                    </span>
                    <span className="text-slate-500">·</span>
                    <span
                      className={`tabular-nums ${
                        turnTimeLeft <= 5 && isHumanTurn ? "text-red-700" : "text-black"
                      }`}
                    >
                      {Math.ceil(turnTimeLeft)}с
                    </span>
                    {isHumanTurn && (
                      <button
                        type="button"
                        onClick={onEndTurn}
                        title="Завершить ход"
                        className="pc-btn px-1.5 py-0 text-[10px] font-bold text-[#000080] cursor-pointer ml-0.5"
                      >
                        Ход→
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={cycleCameraPreset}
                  title="Сменить ракурс камеры"
                  className="pc-btn h-8 px-1.5 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-[#000080]" />
                  <span className="hidden min-[400px]:inline">{CAMERA_SHORT_LABELS[cameraPreset]}</span>
                </button>
                {onToggleMatchHudPanels && (
                  <button
                    type="button"
                    onClick={onToggleMatchHudPanels}
                    title="Скрыть лишний интерфейс"
                    className="pc-btn-active h-8 px-1.5 text-[10px] font-bold cursor-pointer"
                  >
                    Скрыть
                  </button>
                )}
              </div>
            </header>
          ) : (
            /* Clean Translucent Corner Scorebug Pill on Mobile so pitch spans full screen */
            <div className="fixed top-1.5 left-1.5 z-40 flex items-center gap-1 bg-slate-950/70 text-white border border-white/20 px-1.5 py-1 select-none shadow-lg max-w-[calc(100vw-48px)]">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="Открыть меню матча"
                className="w-7 h-7 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white cursor-pointer shrink-0"
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>

              <div className="flex items-center gap-1 px-1 min-w-0">
                <span
                  className={`font-display text-[11px] font-bold truncate max-w-[36px] ${
                    currentTurn === "blue" ? "text-sky-300" : "text-slate-400"
                  }`}
                >
                  {leftClubLabel.slice(0, 3)}
                </span>
                <span className="font-display text-sm font-bold tabular-nums text-white leading-none shrink-0">
                  {scoreBlue}:{scoreRed}
                </span>
                <span
                  className={`font-display text-[11px] font-bold truncate max-w-[36px] ${
                    currentTurn === "red" ? "text-red-300" : "text-slate-400"
                  }`}
                >
                  {rightClubLabel.slice(0, 3)}
                </span>
                <span className="font-mono text-[10px] text-slate-300 border-l border-white/20 pl-1 tabular-nums shrink-0">
                  {String(Math.min(turnCount, MAX_TURNS)).padStart(2, "0")}/{MAX_TURNS}
                </span>
              </div>

              {!isSpectating && (
                <div className="flex items-center gap-1 border-l border-white/20 pl-1 font-mono text-[10px] font-bold shrink-0">
                  <span className="text-amber-300 tabular-nums">⚡{actionPoints}</span>
                  <span className={`tabular-nums ${turnTimeLeft <= 5 && isHumanTurn ? "text-rose-400" : "text-slate-200"}`}>
                    {Math.ceil(turnTimeLeft)}с
                  </span>
                  {pressureState &&
                    (pressureState.level === "forward_blocked" ||
                      pressureState.level === "retreat_only") && (
                      <span
                        title={pressureState.reason}
                        className={`px-1 leading-tight ${
                          pressureState.level === "retreat_only"
                            ? "bg-red-600 text-white"
                            : "bg-amber-400 text-black"
                        }`}
                      >
                        {pressureState.level === "retreat_only" ? "3+" : "2"}
                      </span>
                    )}
                  {isHumanTurn && (
                    <button
                      type="button"
                      onClick={onEndTurn}
                      title="Завершить ход"
                      className="px-1.5 py-0.5 bg-sky-600/85 hover:bg-sky-500 text-white text-[10px] font-bold cursor-pointer"
                    >
                      Ход→
                    </button>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={cycleCameraPreset}
                title="Ракурс камеры"
                className="px-1.5 py-1 bg-white/10 hover:bg-white/20 text-[10px] font-bold text-amber-300 cursor-pointer shrink-0"
              >
                {CAMERA_SHORT_LABELS[cameraPreset]}
              </button>
            </div>
          )}

          {mobileMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/45"
                onClick={() => setMobileMenuOpen(false)}
                aria-hidden="true"
              />
              <nav
                aria-label="Мобильное меню матча"
                className="fixed top-11 left-1.5 z-50 w-[min(86vw,300px)] max-h-[calc(100dvh-56px)] overflow-y-auto touch-scroll pc-window p-1.5 space-y-1 text-black shadow-2xl"
              >
                <div className="pc-titlebar px-2 py-1 text-xs font-bold flex items-center justify-between">
                  <span>Меню матча</span>
                  <span className="font-mono text-[10px] text-amber-300">Онлайн: {onlineCount}</span>
                </div>

                {[
                  {
                    label: "Главное меню / Новый матч",
                    icon: Play,
                    action: onOpenSetup,
                  },
                  {
                    label: "Тактика и схема",
                    icon: ClipboardList,
                    action: () => onOpenWindow("tactics"),
                  },
                  {
                    label:
                      skillPoints > 0
                        ? `Состав команды (+${skillPoints})`
                        : "Состав команды и AP",
                    icon: Shirt,
                    action: () => onOpenWindow("squad"),
                  },
                  {
                    label: "Статистика матча",
                    icon: BarChart3,
                    action: () => onOpenWindow("stats"),
                  },
                  {
                    label: "Советы тренера (Groq ИИ)",
                    icon: BrainCircuit,
                    action: () => onOpenWindow("coach"),
                  },
                  {
                    label: "Турниры",
                    icon: Trophy,
                    action: () => onOpenWindow("tournaments"),
                  },
                  {
                    label: `Онлайн и Эфир (${onlineCount})`,
                    icon: Globe,
                    action: () => onOpenWindow("lobby"),
                  },
                  {
                    label: "Настройки",
                    icon: Settings,
                    action: () => onOpenWindow("settings"),
                  },
                  {
                    label: "Правила и блокировки (HELP)",
                    icon: BookOpen,
                    action: () => onOpenWindow("rules"),
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        item.action();
                      }}
                      className="pc-btn w-full min-h-[42px] px-2.5 py-1.5 text-xs font-bold flex items-center gap-2.5 text-left cursor-pointer"
                    >
                      <Icon className="w-4 h-4 text-[#000080] shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}

                <div className="grid grid-cols-3 gap-1 pt-0.5">
                  <button
                    type="button"
                    onClick={onToggleCrt}
                    className={`min-h-[42px] px-1.5 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer ${
                      crtEnabled ? "pc-btn-active" : "pc-btn"
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5 shrink-0" />
                    <span>ЭЛТ</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleSound}
                    className={`min-h-[42px] px-1.5 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer ${
                      soundEnabled ? "pc-btn-active" : "pc-btn"
                    }`}
                  >
                    {soundEnabled ? (
                      <Volume2 className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>Звук</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onToggleMatchHudPanels?.();
                      setMobileMenuOpen(false);
                    }}
                    className={`min-h-[42px] px-1.5 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer ${
                      showMatchHudPanels ? "pc-btn-active" : "pc-btn"
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                    <span>HUD</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (isSpectating) onExitSpectate();
                    else onOpenSetup();
                  }}
                  className="pc-btn w-full min-h-[42px] px-2.5 py-1.5 text-xs font-bold text-red-900 flex items-center gap-2.5 text-left cursor-pointer"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>{isSpectating ? "Выйти из эфира" : "Выйти в меню"}</span>
                </button>
              </nav>
            </>
          )}
        </>
      )}

      {/* ============================================================
          IN-GAME TOP WIN95 TITLEBAR + MENU BAR (Only when HUD Panels expanded!)
          ============================================================ */}
      {!isCompact && phase !== "TITLE_MENU" && showMatchHudPanels && (
        <header className="fixed top-0 left-0 right-0 z-50 pc-window border-t-0 border-l-0 border-r-0 p-0 select-none">
          {/* Win95 Blue Titlebar */}
          <div className="pc-titlebar px-2 py-[3px] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <SoccerBallIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="font-display text-xs sm:text-sm font-bold tracking-wider truncate">
                WINDOWS 95 FOOTBALL
              </span>
              {isSpectating && (
                <span className="bg-red-700 text-white border border-white/60 px-1.5 py-0 text-[10px] font-bold flex items-center gap-1 shrink-0">
                  <span>LIVE ЭФИР</span>
                </span>
              )}
              {openWindows.length > 0 && (
                <div className="hidden lg:flex items-center gap-1 ml-2">
                  {openWindows.map((winId) => {
                    const isFocused = activeWindowId === winId && !minimizedWindows.includes(winId);
                    return (
                      <button
                        key={winId}
                        type="button"
                        onClick={() => onToggleTaskbarWindow(winId)}
                        className={`h-5 px-1.5 text-[10px] font-bold truncate max-w-[125px] cursor-pointer ${
                          isFocused ? "pc-btn-active" : "pc-btn"
                        }`}
                      >
                        {WINDOW_TASKBAR_LABELS[winId]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <Win95CaptionButtons
              onMinimize={onOpenSetup}
              onMaximize={toggleFullscreen}
              isMaximized={isFullscreen}
              onClose={isSpectating ? onExitSpectate : onOpenSetup}
              closeLabel="Выйти в главное меню"
            />
          </div>

          {/* Authentic Win95 File Menu Strip */}
          <div className="bg-[#c0c0c0] border-b border-[#808080] px-1.5 py-[2px] flex items-center justify-between gap-2 text-xs text-black relative">
            <div className="flex items-center gap-0.5 overflow-x-auto relative">
              <button
                type="button"
                onClick={() => setStartMenuOpen((v) => !v)}
                className={`px-2 py-0.5 cursor-pointer font-bold whitespace-nowrap ${
                  startMenuOpen ? "bg-[#000080] text-white" : "hover:bg-[#000080] hover:text-white"
                }`}
              >
                Игра
              </button>
              {renderStartMenuPopup(false)}

              <button
                type="button"
                onClick={() => onOpenWindow("stats")}
                className="px-2 py-0.5 hover:bg-[#000080] hover:text-white cursor-pointer whitespace-nowrap"
              >
                Матч
              </button>
              <button
                type="button"
                onClick={() => onOpenWindow("squad")}
                className="px-2 py-0.5 hover:bg-[#000080] hover:text-white cursor-pointer whitespace-nowrap"
              >
                Команды
              </button>
              <button
                type="button"
                onClick={() => onOpenWindow("tactics")}
                className="px-2 py-0.5 hover:bg-[#000080] hover:text-white cursor-pointer whitespace-nowrap"
              >
                Тактика
              </button>
              <button
                type="button"
                onClick={() => onOpenWindow("settings")}
                className="px-2 py-0.5 hover:bg-[#000080] hover:text-white cursor-pointer whitespace-nowrap"
              >
                Настройка
              </button>
              <button
                type="button"
                onClick={() => onOpenWindow("rules")}
                className="px-2 py-0.5 hover:bg-[#000080] hover:text-white cursor-pointer whitespace-nowrap"
              >
                Помощь
              </button>
            </div>

            {/* Compact right menu utilities */}
            <div className="flex items-center gap-1 shrink-0">
              {gameMode === "ai" && !isSpectating && aiEngine === "groq" && (
                <span
                  title={aiAgentBadge || "Groq ИИ-Агент активен"}
                  className="hidden xl:inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#000080] text-amber-300 text-[10px] font-bold"
                >
                  <Bot className="w-3 h-3" />
                  <span>{aiAgentBadge || "GROQ ИИ"}</span>
                </span>
              )}

              {!isSpectating && (
                <button
                  type="button"
                  onClick={onToggleCoachHint}
                  title="Подсказка лучшего хода на поле"
                  className={`h-5 px-1.5 text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                    showCoachHint ? "pc-btn-active" : "pc-btn"
                  }`}
                >
                  <Lightbulb className="w-3 h-3" />
                  <span className="hidden sm:inline">Ход</span>
                </button>
              )}

              {(gameMode === "ai" || (isSpectating && !serverMatch)) && (
                <button
                  type="button"
                  onClick={onToggleAIPace}
                  title="Темп ИИ"
                  className={`h-5 px-1.5 text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                    aiPace === "fast" ? "pc-btn-active" : "pc-btn"
                  }`}
                >
                  <FastForward className="w-3 h-3" />
                  <span>{aiPace === "fast" ? "2×" : "1×"}</span>
                </button>
              )}

              {gameMode === "online" && onResignOnlineMatch && (
                <button
                  type="button"
                  onClick={onResignOnlineMatch}
                  className="pc-btn h-5 px-1.5 text-[10px] font-bold text-red-800 flex items-center gap-1 cursor-pointer"
                >
                  <Flag className="w-3 h-3" />
                  <span className="hidden sm:inline">Сдаться</span>
                </button>
              )}

              <button
                type="button"
                onClick={onToggleSound}
                title={soundEnabled ? "Выключить звук" : "Включить звук"}
                className="pc-btn h-5 w-5 flex items-center justify-center cursor-pointer"
              >
                {soundEnabled ? (
                  <Volume2 className="w-3 h-3" />
                ) : (
                  <VolumeX className="w-3 h-3 text-slate-500" />
                )}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* ============================================================
          TOP-LEFT CLEAN TRANSLUCENT SCOREBUG (or Expanded Sidebars if HUD toggled)
          ============================================================ */}
      {!isCompact && phase !== "TITLE_MENU" && !showMatchHudPanels && (
        <div className="fixed top-2 left-2 z-20 flex flex-wrap items-center gap-1.5 select-none">
          <div className="relative flex items-center gap-2 bg-slate-950/70 text-white border border-white/20 px-2 py-1 shadow-lg">
            <button
              type="button"
              onClick={() => setStartMenuOpen((v) => !v)}
              title="Меню матча"
              className="h-6 px-1.5 bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Menu className="w-3.5 h-3.5" />
              <span>Меню</span>
            </button>
            {renderStartMenuPopup(false)}

            <div className="flex items-center gap-1.5 border-l border-white/20 pl-2">
              <span
                className={`text-[11px] font-bold uppercase truncate max-w-[78px] ${
                  currentTurn === "blue" ? "text-sky-300" : "text-slate-400"
                }`}
              >
                {leftClubLabel}
              </span>
              <span className="bg-black/60 border border-white/25 px-1.5 py-0.5 font-display text-base font-bold tabular-nums leading-none">
                {scoreBlue}:{scoreRed}
              </span>
              <span
                className={`text-[11px] font-bold uppercase truncate max-w-[78px] ${
                  currentTurn === "red" ? "text-red-300" : "text-slate-400"
                }`}
              >
                {rightClubLabel}
              </span>
            </div>

            <div className="border-l border-white/20 pl-2 font-mono text-[11px] tabular-nums text-slate-200 flex items-center gap-1.5">
              <span>
                {String(Math.min(turnCount, MAX_TURNS)).padStart(2, "0")}/{MAX_TURNS}
              </span>
              {!isSpectating && (
                <>
                  <span className="text-amber-300 font-bold">⚡{actionPoints}/{maxActionPoints}</span>
                  <span className={turnTimeLeft <= 5 && isHumanTurn ? "text-rose-400 font-bold" : "text-slate-200"}>
                    {Math.ceil(turnTimeLeft)}с
                  </span>
                </>
              )}
            </div>

            {!isSpectating && isHumanTurn && (
              <button
                type="button"
                onClick={onEndTurn}
                title="Завершить ход"
                className="h-6 px-2 bg-sky-600/85 hover:bg-sky-500 text-white text-[11px] font-bold cursor-pointer"
              >
                Ход →
              </button>
            )}

            {!isSpectating && (
              <button
                type="button"
                onClick={onToggleCoachHint}
                title="Подсказка лучшего хода"
                className={`h-6 w-6 flex items-center justify-center cursor-pointer ${
                  showCoachHint ? "bg-amber-400 text-slate-950" : "bg-white/10 hover:bg-white/20 text-amber-200"
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5" />
              </button>
            )}

            {onToggleMatchHudPanels && (
              <button
                type="button"
                onClick={onToggleMatchHudPanels}
                title="Показать все панели (клавиша H)"
                className="h-6 px-1.5 bg-white/10 hover:bg-white/20 text-[10px] font-bold text-slate-200 cursor-pointer"
              >
                HUD
              </button>
            )}
          </div>
        </div>
      )}

      {!isCompact && phase !== "TITLE_MENU" && showMatchHudPanels && (
        <div className="fixed top-[50px] sm:top-[52px] left-2 z-20 flex flex-col gap-1.5 pointer-events-none select-none">
          {/* Dark Navy Broadcast Scoreboard */}
          <div className="pointer-events-auto pc-window-dark px-2 py-1.5 flex items-center gap-2 sm:gap-2.5 max-w-[92vw]">
            <div className="flex items-center gap-1.5 min-w-0">
              <PixelClubCrest
                team="blue"
                label={leftClubLabel.slice(0, 3)}
                className="w-6 h-7 sm:w-7 sm:h-8 shrink-0"
              />
              <span
                className={`text-[10px] sm:text-xs font-bold uppercase truncate max-w-[54px] sm:max-w-[82px] ${
                  currentTurn === "blue" ? "text-white" : "text-slate-400"
                }`}
              >
                {leftClubLabel}
              </span>
            </div>

            <div className="bg-black/60 border border-slate-500 px-2 py-0.5 font-display text-lg sm:text-2xl font-bold tabular-nums text-white leading-none shrink-0">
              {scoreBlue} : {scoreRed}
            </div>

            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`text-[10px] sm:text-xs font-bold uppercase truncate max-w-[54px] sm:max-w-[82px] ${
                  currentTurn === "red" ? "text-red-300" : "text-slate-400"
                }`}
              >
                {rightClubLabel}
              </span>
              <PixelClubCrest
                team="red"
                label={rightClubLabel.slice(0, 3)}
                className="w-6 h-7 sm:w-7 sm:h-8 shrink-0"
              />
            </div>

            <div className="pl-2 border-l border-slate-600 text-center shrink-0">
              <div className="font-mono text-xs sm:text-sm font-bold text-white tabular-nums leading-none">
                {String(Math.min(turnCount, MAX_TURNS)).padStart(2, "0")}:{MAX_TURNS}
              </div>
              <div className="text-[9px] text-slate-300 leading-tight mt-0.5">
                {turnCount <= MAX_TURNS / 2 ? "1 тайм" : "2 тайм"}
              </div>
            </div>

            {onToggleMatchHudPanels && (
              <button
                type="button"
                onClick={onToggleMatchHudPanels}
                title="Скрыть боковые панели (H)"
                className="pc-btn px-1.5 py-1 text-[10px] font-bold text-[#000080] cursor-pointer shrink-0"
              >
                Скрыть
              </button>
            )}
          </div>

          {/* Slim Momentum, AP, Mentality & Situational Timer Strip */}
          {!isSpectating && (
            <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
              <div className="pc-window px-2 py-0.5 flex items-center gap-2 w-fit">
                <span
                  title="Очки действий (AP) выбранного игрока на ход"
                  className="font-mono text-[10px] sm:text-[11px] font-bold text-[#000080] flex items-center gap-0.5 tabular-nums"
                >
                  <Zap className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>
                    {actionPoints}/{maxActionPoints} AP
                  </span>
                </span>
                <span className="text-slate-400">·</span>
                <span
                  title="Ситуативный таймер хода"
                  className={`font-mono text-[10px] sm:text-[11px] font-bold tabular-nums ${
                    turnTimeLeft <= 5 && isHumanTurn ? "text-red-700" : "text-black"
                  }`}
                >
                  ⏱ {Math.ceil(turnTimeLeft)}с
                </span>
                {pressureState &&
                  (pressureState.level === "forward_blocked" ||
                    pressureState.level === "retreat_only") && (
                    <span
                      title={pressureState.reason}
                      className={`font-mono text-[10px] font-bold px-1 leading-tight ${
                        pressureState.level === "retreat_only"
                          ? "bg-red-700 text-white"
                          : "bg-amber-400 text-black"
                      }`}
                    >
                      {pressureState.level === "retreat_only" ? "🚨3+" : "⛔2"}
                    </span>
                  )}
                {mentality !== "balance" && (
                  <span
                    title={
                      mentality === "attack"
                        ? "Стиль Атака: +1 AP ВПД/ВНГ на половине соперника"
                        : "Стиль Защита: +1 AP ЗЩ/ПЗ на своей половине"
                    }
                    className={`font-mono text-[9px] font-bold px-1 leading-tight ${
                      mentality === "attack"
                        ? "bg-emerald-800 text-emerald-200"
                        : "bg-sky-900 text-sky-200"
                    }`}
                  >
                    {mentality === "attack" ? "АТК +1AP" : "ЗАЩ +1AP"}
                  </span>
                )}
                {isHumanTurn && (
                  <button
                    type="button"
                    onClick={onEndTurn}
                    title="Завершить ход и передать право хода"
                    className="pc-btn px-1.5 py-0 text-[10px] font-bold text-[#000080] cursor-pointer"
                  >
                    Ход →
                  </button>
                )}
              </div>

              <div className="pc-window px-2 py-0.5 hidden sm:flex items-center gap-1.5 w-fit">
                <Flame
                  className={`w-3 h-3 shrink-0 ${
                    superDriveReady
                      ? "text-amber-600"
                      : comboStreak >= 2
                      ? "text-emerald-700"
                      : "text-orange-700"
                  }`}
                />
                <span className="text-[10px] font-bold text-black whitespace-nowrap">
                  {superDriveReady
                    ? "СУПЕР!"
                    : comboStreak >= 2
                    ? "Тики-Така"
                    : "Импульс"}
                </span>
                <div className="w-14 h-2.5 pc-field p-[1px]">
                  <div
                    className={`h-full transition-all duration-300 ${
                      superDriveReady ? "bg-amber-500" : "win95-progress-fill"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, momentum))}%` }}
                  />
                </div>
                <span
                  title={
                    comboStreak >= 2
                      ? `Серия пасов даёт +${Math.min(900, comboStreak * 300)}мс к таймеру удара`
                      : "Накопленный импульс до Супер-Драйва"
                  }
                  className={`font-mono text-[10px] font-bold tabular-nums ${
                    comboStreak >= 2 ? "text-emerald-900" : "text-black"
                  }`}
                >
                  {comboStreak >= 2 ? `×${comboStreak}` : `${momentum}%`}
                </span>
              </div>
            </div>
          )}

          {/* Vertical Win95 Left Navigation Rail */}
          <nav
            aria-label="Навигация матча"
            className="pointer-events-auto hidden md:flex flex-col pc-window p-1 w-[132px] gap-1"
          >
            <button
              type="button"
              onClick={() => onOpenWindow("coach")}
              className="pc-btn-active px-2 py-1.5 text-xs font-bold flex items-center gap-2 text-left cursor-pointer"
            >
              <SoccerBallIcon className="w-4 h-4 shrink-0" />
              <span>Матч</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenWindow("tactics")}
              className="pc-btn px-2 py-1.5 text-xs font-bold flex items-center gap-2 text-left cursor-pointer"
            >
              <ClipboardList className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Тактика</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenWindow("squad")}
              className="pc-btn px-2 py-1.5 text-xs font-bold flex items-center justify-between gap-1 text-left cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Shirt className="w-4 h-4 text-[#000080] shrink-0" />
                <span>Состав</span>
              </span>
              {skillPoints > 0 && (
                <span className="font-mono text-[10px] font-bold text-red-700">+{skillPoints}</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onOpenWindow("stats")}
              className="pc-btn px-2 py-1.5 text-xs font-bold flex items-center gap-2 text-left cursor-pointer"
            >
              <BarChart3 className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Статистика</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenWindow("settings")}
              className="pc-btn px-2 py-1.5 text-xs font-bold flex items-center gap-2 text-left cursor-pointer"
            >
              <Settings className="w-4 h-4 text-slate-700 shrink-0" />
              <span>Настройки</span>
            </button>

            <button
              type="button"
              onClick={isSpectating ? onExitSpectate : onOpenSetup}
              className="pc-btn px-2 py-1.5 text-xs font-bold flex items-center gap-2 text-left text-red-900 cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Выход</span>
            </button>
          </nav>
        </div>
      )}

      {/* ============================================================
          TOP-RIGHT FLOATING PLAYER CARD (Only when HUD Panels expanded!)
          ============================================================ */}
      {!isCompact && phase !== "TITLE_MENU" && showMatchHudPanels && activePlayerCard && (
        <aside
          aria-label="Карточка игрока"
          className={`hidden lg:block fixed top-[52px] right-2 z-20 ${
            playerCardCollapsed ? "w-[170px]" : "w-[232px]"
          } pc-window p-[3px] pointer-events-auto select-none`}
        >
          <div className="pc-titlebar px-2 py-0.5 flex items-center justify-between gap-2">
            <span className="font-display text-xs font-bold truncate">
              {PLAYER_NAMES_BY_NUM[activePlayerCard.number] || ROLE_META[activePlayerCard.role].name}
            </span>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setPlayerCardCollapsed((v) => !v)}
                title={playerCardCollapsed ? "Развернуть карточку" : "Свернуть карточку"}
                className="pc-btn w-4 h-3.5 text-[9px] font-bold flex items-center justify-center cursor-pointer"
              >
                {playerCardCollapsed ? "+" : "−"}
              </button>
              <button
                type="button"
                onClick={() => onOpenWindow("squad")}
                title="Открыть состав и прокачку"
                className="pc-btn w-4 h-3.5 text-[9px] font-bold flex items-center justify-center cursor-pointer"
              >
                ⚙
              </button>
            </div>
          </div>

          {!playerCardCollapsed && (
            <div className="bg-[#16202a] text-white p-2 space-y-2 border border-black">
            {/* Portrait + Number/Role */}
            <div className="flex items-stretch gap-2.5">
              <div className="pc-field p-0.5 shrink-0">
                <PixelPlayerPortrait
                  role={activePlayerCard.role}
                  team={activePlayerCard.team}
                  skinTone={activePlayerCard.skinTone}
                  appearance={progression.roles[activePlayerCard.role].appearance}
                  className="w-16 h-16"
                />
              </div>
              <div className="flex-1 flex flex-col justify-between items-center text-center py-0.5 bg-[#0e161e] border border-slate-700">
                <span className="font-display text-3xl font-bold leading-none text-white tabular-nums">
                  {activePlayerCard.number}
                </span>
                <span className="font-display text-sm font-bold text-slate-200 leading-none">
                  {ROLE_META[activePlayerCard.role].code}
                </span>
                <span className="text-[9px] font-bold text-amber-300 truncate max-w-[95px] px-1">
                  {ballCarrierId === activePlayerCard.id
                    ? "С МЯЧОМ"
                    : ROLE_META[activePlayerCard.role].chessName}
                </span>
              </div>
            </div>

            {/* 6 Player Stats Table matching Screenshot 1 & 2 */}
            <div className="text-[11px] font-mono space-y-0.5 pt-0.5 border-t border-slate-700">
              {[
                { label: "Скорость", val: 75 + activeStats.speed * 4 },
                { label: "Пас", val: 74 + activeStats.passing * 4 },
                { label: "Удар", val: 73 + activeStats.accuracy * 4 },
                {
                  label: "Дриблинг",
                  val: 75 + Math.round((activeStats.speed + activeStats.passing) * 2),
                },
                { label: "Защита", val: 72 + activeStats.defense * 4 },
                { label: "Выносливость", val: activePlayerCard.stamina ?? 100 },
              ].map((st) => (
                <div key={st.label} className="flex items-center justify-between">
                  <span className="text-slate-300">{st.label}</span>
                  <span
                    className={`font-bold tabular-nums ${
                      st.val >= 90 ? "text-emerald-400" : "text-sky-300"
                    }`}
                  >
                    {st.val}
                  </span>
                </div>
              ))}
            </div>

            {/* Bright Green Stamina Progress Bar */}
            <div className="h-2.5 bg-slate-900 border border-slate-600 p-[1px]">
              <div
                className={`h-full transition-all duration-300 ${
                  (activePlayerCard.stamina ?? 100) < 35 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.max(5, activePlayerCard.stamina ?? 100)}%` }}
              />
            </div>

            {showCoachHint && coachHint && !selectedPlayer && (
              <button
                type="button"
                onClick={() => onOpenWindow("coach")}
                className="w-full pc-btn py-1 px-2 text-[10px] font-bold text-[#000080] flex items-center justify-center gap-1 cursor-pointer"
              >
                <Lightbulb className="w-3 h-3" />
                <span>Советы тренера</span>
              </button>
            )}
            </div>
          )}
        </aside>
      )}

      {/* FLOATING BROADCAST BANNER */}
      {phase !== "TITLE_MENU" && broadcastBanner && (
        <div
          className={`fixed ${
            isCompact ? "top-[48px]" : "top-[92px]"
          } left-1/2 -translate-x-1/2 z-20 pointer-events-none max-w-[92vw]`}
        >
          <div
            className={`pc-window px-3 py-1 font-display text-xs sm:text-sm font-bold tracking-wide truncate ${
              broadcastBanner.tone === "gold"
                ? "bg-[#000080] text-amber-300"
                : broadcastBanner.tone === "red"
                ? "bg-red-900 text-white"
                : "bg-emerald-900 text-emerald-200"
            }`}
          >
            {broadcastBanner.text}
          </div>
        </div>
      )}

      {/* ============================================================
          BOTTOM-LEFT COMMENTATOR WINDOW (Only when HUD Panels expanded!)
          ============================================================ */}
      {!isCompact && phase !== "TITLE_MENU" && showMatchHudPanels && (
        <aside
          className="hidden lg:block fixed bottom-2 left-2 z-20 w-[252px] xl:w-[305px] pointer-events-auto"
          aria-label="Комментатор матча"
        >
          <div className="pc-window p-[3px]">
            <div className="pc-titlebar px-2 py-0.5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setCommentaryExpanded((v) => !v)}
                className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
              >
                <MessageSquare className="w-3 h-3 shrink-0" />
                <span className="font-display text-xs font-bold whitespace-nowrap">
                  Комментатор
                </span>
                {isCommentaryLoading && (
                  <span className="text-[10px] text-amber-200 truncate">в эфире...</span>
                )}
              </button>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={onToggleTts}
                  title={ttsEnabled ? "Отключить озвучку" : "Озвучка комментатора"}
                  className={`w-[16px] h-[14px] flex items-center justify-center cursor-pointer ${
                    ttsEnabled ? "pc-btn-primary" : "pc-btn"
                  }`}
                >
                  <Speech className="w-2.5 h-2.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCommentaryExpanded((v) => !v)}
                  aria-label="Свернуть комментатора"
                  className="pc-btn w-[16px] h-[14px] flex items-center justify-center cursor-pointer"
                >
                  {commentaryExpanded ? (
                    <ChevronDown className="w-2.5 h-2.5" />
                  ) : (
                    <ChevronUp className="w-2.5 h-2.5" />
                  )}
                </button>
              </div>
            </div>

            {commentaryExpanded && (
              <div className="p-1.5 bg-[#c0c0c0] flex items-stretch gap-1.5">
                <div className="pc-field p-0.5 shrink-0 flex items-center justify-center">
                  <PixelCommentatorPortrait className="w-14 h-14" />
                </div>
                <div className="pc-field flex-1 p-2 flex flex-col justify-center text-xs text-black leading-snug">
                  <p className="font-bold line-clamp-3">
                    {latestCommentary?.text || "Матч начался! Выбирайте игрока для атаки."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ============================================================
          BOTTOM-CENTER COLLAPSIBLE ACTION DOCK (Auto-hides on AI turn & collapse!)
          ============================================================ */}
      {!isCompact && phase === "PLAYING" && !isSpectating && (
        <div
          className={`flex fixed bottom-2 left-1/2 -translate-x-1/2 z-20 flex-col items-center gap-1 transition-all duration-200 ${
            !isHumanTurn
              ? "translate-y-[130%] opacity-0 pointer-events-none"
              : "pointer-events-none"
          }`}
        >
          {dockCollapsed ? (
            <button
              type="button"
              onClick={() => setDockCollapsed(false)}
              className="pointer-events-auto px-3 py-1 bg-slate-950/75 hover:bg-slate-900 text-white border border-white/20 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow-lg"
            >
              <ChevronUp className="w-3.5 h-3.5 text-amber-300" />
              <span>Панель действий</span>
            </button>
          ) : (
            <>
              <div className="pointer-events-auto flex items-center gap-1">
                {isHumanTurn && quickSwitchPlayers.length > 0 && (
                  <div className="bg-slate-950/70 text-white border border-white/20 px-1.5 py-0.5 flex items-center gap-1">
                    {quickSwitchPlayers.map((pl) => {
                      const isSel = selectedPlayer?.id === pl.id;
                      const hasBall = ballCarrierId === pl.id;
                      return (
                        <button
                          key={pl.id}
                          type="button"
                          onClick={() => onSelectQuickPlayer(pl.id)}
                          className={`h-5 px-1.5 text-[10px] font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                            isSel
                              ? "bg-amber-400 text-slate-950"
                              : "bg-white/10 hover:bg-white/20 text-white"
                          }`}
                        >
                          <span>
                            {ROLE_META[pl.role].code}#{pl.number}
                          </span>
                          {hasBall && <span className="text-amber-300">●</span>}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={onCyclePlayer}
                      title="Следующий игрок (Tab)"
                      className="h-5 px-1.5 bg-white/10 hover:bg-white/20 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Tab</span>
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setDockCollapsed(true)}
                  title="Скрыть нижнюю панель"
                  className="h-6 px-2 bg-slate-950/70 hover:bg-slate-900 text-slate-200 border border-white/20 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <ChevronDown className="w-3 h-3" />
                  <span>Скрыть</span>
                </button>
              </div>

              {/* 5 Classic Win95 Bottom Dock Buttons inside sleek Dock */}
              <div
                className={`pointer-events-auto p-1 flex items-stretch gap-1 ${
                  showMatchHudPanels
                    ? "pc-window"
                    : "bg-slate-950/75 text-white border border-white/20 shadow-xl"
                }`}
              >
                <button
                  type="button"
                  onClick={canQuickPass ? onQuickPass : onCyclePlayer}
                  disabled={!isHumanTurn}
                  title={canQuickPass ? "Быстрый пас вперёд" : "Выбрать игрока с мячом"}
                  className={`w-[72px] py-1.5 flex flex-col items-center justify-center gap-1 text-[11px] font-bold ${
                    canQuickPass ? "pc-btn cursor-pointer" : "pc-btn opacity-80 cursor-pointer"
                  }`}
                >
              <SoccerBallIcon className="w-6 h-6" />
              <span>Пас</span>
            </button>

            <button
              type="button"
              onClick={onQuickShot}
              disabled={!canQuickShot}
              title={canQuickShot ? "Удар по воротам!" : "Выйдите на ударную позицию"}
              className={`w-[72px] py-1.5 flex flex-col items-center justify-center gap-1 text-[11px] font-bold ${
                canQuickShot
                  ? "pc-btn-primary cursor-pointer"
                  : "pc-btn opacity-75 cursor-not-allowed"
              }`}
            >
              {/* Pixel Blue Cleat Icon */}
              <svg viewBox="0 0 24 24" shapeRendering="crispEdges" className="w-6 h-6" aria-hidden="true">
                <rect x="4" y="9" width="7" height="7" fill="#1d4ed8" />
                <rect x="3" y="13" width="16" height="4" fill="#2563eb" />
                <rect x="11" y="11" width="6" height="3" fill="#60a5fa" />
                <rect x="3" y="17" width="16" height="2" fill="#0f172a" />
                <rect x="5" y="19" width="2" height="2" fill="#475569" />
                <rect x="10" y="19" width="2" height="2" fill="#475569" />
                <rect x="15" y="19" width="2" height="2" fill="#475569" />
              </svg>
              <span>{superDriveReady && canQuickShot ? "Супер!" : "Удар"}</span>
            </button>

            <button
              type="button"
              onClick={onAutoMove}
              disabled={!canAutoMove}
              title="Лучший ход / Дриблинг вперёд (Пробел)"
              className={`w-[72px] py-1.5 flex flex-col items-center justify-center gap-1 text-[11px] font-bold ${
                canAutoMove ? "pc-btn cursor-pointer" : "pc-btn opacity-70 cursor-not-allowed"
              }`}
            >
              {/* Pixel Blue Running Player Icon */}
              <svg viewBox="0 0 24 24" shapeRendering="crispEdges" className="w-6 h-6" aria-hidden="true">
                <rect x="10" y="3" width="4" height="4" fill="#1d4ed8" />
                <rect x="8" y="7" width="6" height="6" fill="#2563eb" />
                <rect x="6" y="8" width="2" height="4" fill="#1d4ed8" />
                <rect x="14" y="8" width="4" height="3" fill="#1d4ed8" />
                <rect x="7" y="13" width="3" height="6" fill="#1e3a8a" />
                <rect x="12" y="13" width="5" height="4" fill="#1e3a8a" />
                <rect x="15" y="17" width="3" height="3" fill="#1e3a8a" />
              </svg>
              <span>Дриблинг</span>
            </button>

            <button
              type="button"
              onClick={onSelectBestDefender}
              disabled={!isHumanTurn}
              title="Выбрать ближайшего защитника к мячу для отбора"
              className="pc-btn w-[72px] py-1.5 flex flex-col items-center justify-center gap-1 text-[11px] font-bold cursor-pointer"
            >
              {/* Pixel Blue Shield Icon */}
              <svg viewBox="0 0 24 24" shapeRendering="crispEdges" className="w-6 h-6" aria-hidden="true">
                <path d="M5 4h14v8l-7 8-7-8V4z" fill="#1d4ed8" stroke="#090d16" strokeWidth="1.5" />
                <path d="M7 6h10v5l-5 6-5-6V6z" fill="#60a5fa" />
                <rect x="11" y="6" width="2" height="9" fill="#ffffff" />
              </svg>
              <span>Отбор</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const order: TacticalMentality[] = ["balance", "attack", "defend"];
                const next = order[(order.indexOf(mentality) + 1) % order.length];
                onChangeMentality(next);
              }}
              title="Сменить стиль тактики (или нажмите правой кнопкой на Тактику слева)"
              className="pc-btn w-[72px] py-1.5 flex flex-col items-center justify-center gap-1 text-[11px] font-bold cursor-pointer"
            >
              {/* Pixel Blue Arrows Icon */}
              <svg viewBox="0 0 24 24" shapeRendering="crispEdges" className="w-6 h-6" aria-hidden="true">
                <path d="M6 9h10V6l5 4.5L16 15v-3H6V9z" fill="#1d4ed8" />
                <path d="M18 15H8v3l-5-4.5L8 9v3h10v3z" fill="#2563eb" />
              </svg>
              <span>
                {mentality === "attack" ? "Атака" : mentality === "defend" ? "Защита" : "Тактика"}
              </span>
            </button>
          </div>
            </>
          )}
        </div>
      )}

      {/* SPECTATOR COMPACT BAR AT BOTTOM-CENTER (Desktop Only!) */}
      {!isCompact && phase === "PLAYING" && isSpectating && (
        <div className="flex fixed bottom-2 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <div className="pc-window p-1.5 flex items-center gap-2 text-xs text-black">
            <Eye className="w-4 h-4 text-red-700 shrink-0" />
            <span className="font-bold text-[#000080] max-w-[160px] truncate">
              {serverMatch ? serverMatch.roomName : "ИИ-Дерби LIVE"}
            </span>
            {serverMatch && liveMatches.length > 1 && onSwitchSpectateMatch && (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    const idx = liveMatches.findIndex((m) => m.id === serverMatch.id);
                    const prevIdx = idx <= 0 ? liveMatches.length - 1 : idx - 1;
                    onSwitchSpectateMatch(liveMatches[prevIdx]);
                  }}
                  className="pc-btn w-6 h-6 flex items-center justify-center cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const idx = liveMatches.findIndex((m) => m.id === serverMatch.id);
                    const nextIdx = (idx + 1) % liveMatches.length;
                    onSwitchSpectateMatch(liveMatches[nextIdx]);
                  }}
                  className="pc-btn w-6 h-6 flex items-center justify-center cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {serverMatch && onSendSpectateReaction && (
              <div className="flex items-center gap-1">
                {["🔥", "👏", "⚽"].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onSendSpectateReaction(emoji)}
                    className="pc-btn h-6 px-2 text-xs cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => onOpenWindow("lobby")}
              className="pc-btn h-6 px-2 text-[11px] font-bold cursor-pointer"
            >
              Каналы ({liveMatches.length})
            </button>
            <button
              type="button"
              onClick={onExitSpectate}
              className="pc-btn h-6 px-2 text-[11px] font-bold text-red-900 cursor-pointer"
            >
              Выйти
            </button>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM THUMB DOCK (Auto-hides cleanly on AI turn or collapse!) */}
      {isCompact && phase === "PLAYING" && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-20 px-1.5 pb-[max(4px,env(safe-area-inset-bottom))] transition-all duration-200 ${
            !isHumanTurn && !isSpectating
              ? "translate-y-[130%] opacity-0 pointer-events-none"
              : "pointer-events-none"
          }`}
        >
          {isSpectating ? (
            <div className="pointer-events-auto pc-window p-1.5 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-black truncate flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-red-700 shrink-0" />
                <span>LIVE: {serverMatch ? serverMatch.roomName : "ИИ-Дерби"}</span>
              </span>
              <button
                type="button"
                onClick={onExitSpectate}
                className="pc-btn h-9 px-3 text-xs font-bold text-red-800 shrink-0 cursor-pointer"
              >
                Выйти
              </button>
            </div>
          ) : dockCollapsed ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setDockCollapsed(false)}
                className="pointer-events-auto px-3 py-1 bg-slate-950/75 text-white border border-white/20 text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-lg"
              >
                <ChevronUp className="w-3.5 h-3.5 text-amber-300" />
                <span>Действия</span>
              </button>
            </div>
          ) : isLandscapePhone ? (
            /* Ultra-slim 1-row landscape phone strip so pitch keeps 85%+ vertical space */
            <div className="pointer-events-auto bg-slate-950/75 text-white border border-white/20 px-1.5 py-1 flex items-center justify-between gap-1.5 h-11 shadow-lg">
              <div className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1">
                {isHumanTurn &&
                  quickSwitchPlayers.map((pl) => {
                    const isSel = selectedPlayer?.id === pl.id;
                    const hasBall = ballCarrierId === pl.id;
                    return (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => onSelectQuickPlayer(pl.id)}
                        className={`h-8 px-2 text-[10px] font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                          isSel ? "pc-btn-active" : "pc-btn"
                        }`}
                      >
                        {ROLE_META[pl.role].code}#{pl.number}
                        {hasBall ? "⚽" : ""}
                      </button>
                    );
                  })}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={!isHumanTurn}
                  onClick={canQuickPass ? onQuickPass : onCyclePlayer}
                  className={`h-9 px-2.5 text-[11px] font-bold cursor-pointer ${
                    canQuickPass ? "pc-btn" : "pc-btn opacity-75"
                  }`}
                >
                  Пас
                </button>
                <button
                  type="button"
                  disabled={!canQuickShot}
                  onClick={onQuickShot}
                  className={`h-9 px-2.5 text-[11px] font-bold cursor-pointer ${
                    canQuickShot ? "pc-btn-primary" : "pc-inset text-slate-500"
                  }`}
                >
                  Удар
                </button>
                <button
                  type="button"
                  disabled={!canAutoMove}
                  onClick={onAutoMove}
                  className={`h-9 px-2.5 text-[11px] font-bold cursor-pointer ${
                    canAutoMove ? "pc-btn" : "pc-inset text-slate-500"
                  }`}
                >
                  Ход
                </button>
                <button
                  type="button"
                  disabled={!isHumanTurn}
                  onClick={onSelectBestDefender}
                  className="pc-btn h-9 px-2 text-[11px] font-bold cursor-pointer"
                >
                  Отбор
                </button>
                <button
                  type="button"
                  onClick={onEndTurn}
                  disabled={!isHumanTurn}
                  className="pc-btn h-9 px-2 text-[11px] font-bold text-[#000080] cursor-pointer"
                >
                  Конец→
                </button>
                <button
                  type="button"
                  onClick={() => setDockCollapsed(true)}
                  title="Скрыть панель"
                  aria-label="Скрыть панель"
                  className="pc-btn w-8 h-9 flex items-center justify-center text-slate-700 cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            /* Portrait Mobile Thumb Dock: 2 ergonomic rows + quick collapse handle */
            <div className="pointer-events-auto bg-slate-950/78 text-white border border-white/20 p-1.5 space-y-1 shadow-xl">
              <div className="flex items-center justify-between gap-1">
                {isHumanTurn && quickSwitchPlayers.length > 0 ? (
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5 flex-1">
                  {quickSwitchPlayers.map((pl) => {
                    const isSel = selectedPlayer?.id === pl.id;
                    const hasBall = ballCarrierId === pl.id;
                    return (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => onSelectQuickPlayer(pl.id)}
                        className={`h-8 px-2 text-[11px] font-bold whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer ${
                          isSel ? "pc-btn-active" : "pc-btn"
                        }`}
                      >
                        <span>
                          {ROLE_META[pl.role].code}#{pl.number}
                        </span>
                        {hasBall && <span className="text-amber-400">●</span>}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={onCyclePlayer}
                    className="pc-btn h-8 px-2 text-[11px] font-bold shrink-0 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Ещё</span>
                  </button>
                </div>
                ) : (
                  <span className="text-[10px] text-slate-300 px-1">Панель действий</span>
                )}
                <button
                  type="button"
                  onClick={() => setDockCollapsed(true)}
                  title="Скрыть панель"
                  className="h-7 px-2 bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold shrink-0 flex items-center cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-5 gap-1">
                <button
                  type="button"
                  disabled={!isHumanTurn}
                  onClick={canQuickPass ? onQuickPass : onCyclePlayer}
                  className={`min-h-[44px] text-[11px] font-bold flex flex-col items-center justify-center leading-tight cursor-pointer ${
                    canQuickPass ? "pc-btn" : "pc-btn opacity-75"
                  }`}
                >
                  <span>Пас</span>
                </button>
                <button
                  type="button"
                  disabled={!canQuickShot}
                  onClick={onQuickShot}
                  className={`min-h-[44px] text-[11px] font-bold flex flex-col items-center justify-center leading-tight cursor-pointer ${
                    canQuickShot ? "pc-btn-primary" : "pc-inset text-slate-500"
                  }`}
                >
                  <span>{superDriveReady && canQuickShot ? "Супер!" : "Удар"}</span>
                </button>
                <button
                  type="button"
                  disabled={!canAutoMove}
                  onClick={onAutoMove}
                  className={`min-h-[44px] text-[11px] font-bold flex flex-col items-center justify-center leading-tight cursor-pointer ${
                    canAutoMove ? "pc-btn" : "pc-inset text-slate-500"
                  }`}
                >
                  <span>Дрибл.</span>
                </button>
                <button
                  type="button"
                  disabled={!isHumanTurn}
                  onClick={onSelectBestDefender}
                  className="pc-btn min-h-[44px] text-[11px] font-bold flex flex-col items-center justify-center leading-tight cursor-pointer"
                >
                  <span>Отбор</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const order: TacticalMentality[] = ["balance", "attack", "defend"];
                    const next = order[(order.indexOf(mentality) + 1) % order.length];
                    onChangeMentality(next);
                  }}
                  className="pc-btn min-h-[44px] text-[10px] font-bold flex flex-col items-center justify-center leading-tight cursor-pointer"
                >
                  <span>
                    {mentality === "attack" ? "Атака" : mentality === "defend" ? "Защита" : "Баланс"}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GOAL CELEBRATION BANNER */}
      {phase === "GOAL_CELEBRATION" && goalBanner && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="pc-window p-[3px]">
            <div className="pc-titlebar px-2.5 py-1 flex items-center justify-between gap-4">
              <span className="font-display text-xs font-bold">ГООООЛ!</span>
              <Win95CaptionButtons />
            </div>
            <div className="pc-inset-dark m-1 px-8 py-5 text-center">
              <div className="flex items-center justify-center gap-3">
                <SoccerBallIcon className="w-8 h-8" />
                <span
                  className={`font-display text-5xl font-bold tracking-tight ${
                    goalBanner.team === "blue" ? "text-sky-400" : "text-red-400"
                  }`}
                >
                  ГОООЛ!
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-200">{goalBanner.text}</p>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          WINDOWS 95 DESKTOP ENVIRONMENT (Icons z-10 UNDER z-30+ Windows!)
          ==================================================================== */}
      {phase === "TITLE_MENU" && (
        <>
          <div className="fixed inset-0 z-10 win95-desktop pb-10 p-3 select-none overflow-hidden">
            <div className="grid grid-cols-2 sm:flex sm:flex-col gap-3 w-fit">
              {[
                {
                  label: "Windows 95 Football",
                  icon: Play,
                  bg: "bg-emerald-700",
                  onClick: () => onOpenWindow("setup"),
                },
                {
                  label: "Турниры",
                  icon: Trophy,
                  bg: "bg-amber-700",
                  onClick: () => onOpenWindow("tournaments"),
                },
                {
                  label: "Онлайн и Эфир",
                  icon: Globe,
                  bg: "bg-sky-700",
                  onClick: () => onOpenWindow("lobby"),
                },
                {
                  label: "Состав команды",
                  icon: Users,
                  bg: "bg-[#000080]",
                  onClick: () => onOpenWindow("squad"),
                },
                {
                  label: "Настройки",
                  icon: Settings,
                  bg: "bg-slate-700",
                  onClick: () => onOpenWindow("settings"),
                },
                {
                  label: "Вызов QR",
                  icon: QrCode,
                  bg: "bg-teal-800",
                  onClick: () => onOpenWindow("challenge"),
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.onClick}
                    className="group w-20 flex flex-col items-center gap-1 p-1.5 hover:bg-[#000080]/45 focus:outline-none cursor-pointer"
                  >
                    <div
                      className={`w-10 h-10 ${item.bg} border-2 border-white shadow-[2px_2px_0_#000] flex items-center justify-center text-white`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold text-white px-1 bg-[#008080]/85 group-hover:bg-[#000080] leading-tight text-center drop-shadow-[1px_1px_0_#000]">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <footer className="fixed bottom-0 left-0 right-0 z-50 pc-window border-b-0 border-l-0 border-r-0 px-1.5 py-1 flex items-center justify-between gap-1.5 select-none">
            <div className="flex items-center gap-1.5 min-w-0 flex-1 relative">
              <button
                type="button"
                onClick={() => setStartMenuOpen((v) => !v)}
                className={`h-7 px-2 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  startMenuOpen ? "pc-btn-active" : "pc-btn"
                }`}
              >
                <Win95FlagIcon className="w-4 h-4 shrink-0" />
                <span>Пуск</span>
              </button>

              {renderStartMenuPopup(true)}

              <div className="h-6 w-[1px] bg-[#808080] border-r border-white shrink-0" />

              <div className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1">
                {openWindows.map((winId) => {
                  const isMin = minimizedWindows.includes(winId);
                  const isFocused = activeWindowId === winId && !isMin;
                  return (
                    <button
                      key={winId}
                      type="button"
                      onClick={() => onToggleTaskbarWindow(winId)}
                      title={WINDOW_TASKBAR_LABELS[winId]}
                      className={`h-7 px-2 text-[11px] font-bold flex items-center gap-1.5 truncate max-w-[165px] shrink-0 cursor-pointer ${
                        isFocused ? "pc-btn-active" : "pc-btn"
                      } ${isMin ? "opacity-80" : ""}`}
                    >
                      <span className="w-2 h-2 bg-current shrink-0 opacity-75" />
                      <span className="truncate">{WINDOW_TASKBAR_LABELS[winId]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pc-inset px-2 py-0.5 flex items-center gap-2 text-xs text-black shrink-0">
              <button
                type="button"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Обычный режим" : "На весь экран"}
                className="cursor-pointer flex items-center"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-3.5 h-3.5 text-[#000080]" />
                ) : (
                  <Maximize className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={onToggleSound}
                title="Звук 8-бит"
                className="cursor-pointer flex items-center"
              >
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-slate-600" />
                )}
              </button>
              <span className="font-mono text-[11px] font-bold tabular-nums">{clockTime}</span>
            </div>
          </footer>
        </>
      )}

      {/* ====================================================================
          MAIN MENU WINDOW (Screenshot 1 Top-Left: Artwork + Menu Buttons!)
          ==================================================================== */}
      {phase === "TITLE_MENU" && setupOpen && (
        <Win95Window
          title="WINDOWS 95 FOOTBALL — Главное меню"
          icon={<SoccerBallIcon className="w-4 h-4 shrink-0" />}
          ariaLabel="Главное меню Windows 95 Football"
          zIndex={getWindowZ("setup")}
          isActive={activeWindowId === "setup"}
          isMinimized={minimizedWindows.includes("setup")}
          cascadeIndex={0}
          topBoundary={6}
          bottomBoundary={42}
          defaultWidth={700}
          defaultHeight={530}
          minWidth={310}
          minHeight={360}
          onFocus={() => onFocusWindow("setup")}
          onMinimize={() => onMinimizeWindow("setup")}
          onClose={() => onCloseWindow("setup")}
          statusBarPanes={[
            {
              text: `Клуб: ${userProfile.clubName} (${userProfile.matchesWon}В/${userProfile.matchesLost}П)`,
              flex: true,
            },
            { text: `Очки: ${skillPoints}` },
            { text: `Онлайн: ${onlineCount}` },
          ]}
        >
          <div className="p-3 sm:p-4 flex-1 overflow-y-auto flex items-center justify-center bg-[#c0c0c0] text-black">
            <div className="w-full max-w-4xl space-y-3">
              {/* Crisp Retro Header Banner inside Main Menu */}
              <div className="pc-inset-dark px-3 py-2 flex items-center justify-between gap-2 text-white">
                <div className="flex items-center gap-2.5 min-w-0">
                  <PixelClubCrest
                    team="blue"
                    label={userProfile.clubName.slice(0, 3)}
                    className="w-8 h-9 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-display text-base sm:text-lg font-bold tracking-wide text-amber-300 truncate leading-tight">
                      {userProfile.clubName} · СЕЗОН 95
                    </div>
                    <div className="font-mono text-[10px] text-sky-200 truncate">
                      Менеджер: {userProfile.managerName} · Побед: {userProfile.matchesWon} · Трофеев: {userProfile.trophies}
                    </div>
                  </div>
                </div>
                <span className="font-mono text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/60 px-2 py-0.5 shrink-0">
                  32×32 · AP · БЛОК
                </span>
              </div>

              {/* Two-Column Hero: Upgraded Stadium Artwork + Elevated Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-[1.15fr_1fr] gap-3 items-stretch">
                <MainMenuHeroArtwork clubName={userProfile.clubName} />

                <div className="flex flex-col justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onStartMatch(
                        setupMode,
                        setupDifficulty,
                        setupPace,
                        setupPitch,
                        setupBlitzPref,
                        setupAiEngine
                      )
                    }
                    className="pc-btn-primary py-3 px-3.5 flex items-center justify-between gap-3 text-left cursor-pointer shadow-md"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <SoccerBallIcon className="w-8 h-8 shrink-0 text-amber-300" />
                      <span className="min-w-0 block">
                        <span className="block font-display text-xl font-bold leading-none text-white tracking-wide">
                          Новый матч
                        </span>
                        <span className="block font-mono text-[10px] text-emerald-100 mt-1 truncate">
                          {setupMode === "ai"
                            ? `${setupAiEngine === "groq" ? "Groq ИИ" : "ИИ 95"} · ${PITCH_META[setupPitch].name}`
                            : `2 игрока · ${PITCH_META[setupPitch].name}`}
                        </span>
                      </span>
                    </span>
                    <Play className="w-5 h-5 text-amber-300 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenWindow("tournaments")}
                    className="pc-btn py-2.5 px-3 flex items-center justify-between gap-2 text-left cursor-pointer"
                  >
                    <span className="flex items-center gap-3">
                      <Trophy className="w-6 h-6 text-amber-600 shrink-0" />
                      <span className="font-display text-lg font-bold leading-none text-black">
                        Турниры
                      </span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-700 font-bold">5 кубков</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenWindow("lobby")}
                    className="pc-btn py-2.5 px-3 flex items-center justify-between gap-2 text-left cursor-pointer"
                  >
                    <span className="flex items-center gap-3">
                      <Globe className="w-6 h-6 text-sky-700 shrink-0" />
                      <span className="font-display text-lg font-bold leading-none text-black">
                        Онлайн и Эфир
                      </span>
                    </span>
                    <span className="font-mono text-[11px] font-bold text-emerald-950 bg-emerald-200 px-1.5 border border-black">
                      ● {onlineCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenWindow("squad")}
                    className="pc-btn py-2.5 px-3 flex items-center justify-between gap-2 text-left cursor-pointer"
                  >
                    <span className="flex items-center gap-3">
                      <Users className="w-6 h-6 text-emerald-700 shrink-0" />
                      <span className="font-display text-lg font-bold leading-none text-black">
                        Состав и AP
                      </span>
                    </span>
                    {skillPoints > 0 && (
                      <span className="font-mono text-[11px] font-bold text-amber-950 bg-amber-300 px-1.5 border border-black">
                        +{skillPoints} очков
                      </span>
                    )}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenWindow("settings")}
                      className="pc-btn py-2 px-3 flex items-center gap-2 text-left cursor-pointer"
                    >
                      <Settings className="w-5 h-5 text-slate-700 shrink-0" />
                      <span className="font-display text-base font-bold leading-none text-black">
                        Настройки
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenWindow("rules")}
                      className="pc-btn py-2 px-3 flex items-center gap-2 text-left cursor-pointer"
                    >
                      <BookOpen className="w-5 h-5 text-[#000080] shrink-0" />
                      <span className="font-display text-base font-bold leading-none text-black">
                        Справка
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Compact Bottom Toolbar + Expandable Custom Match Setup */}
              <div className="pc-inset p-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQuickMatchOpen((v) => !v)}
                    className={`px-2.5 py-1 text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                      quickMatchOpen ? "pc-btn-active" : "pc-btn"
                    }`}
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    <span>Настроить матч ({PITCH_META[setupPitch].name})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenWindow("profile")}
                    className="pc-btn px-2.5 py-1 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-[#000080]" />
                    <span>Профиль ({userProfile.clubName})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenWindow("challenge")}
                    className="pc-btn px-2.5 py-1 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5 text-amber-800" />
                    <span>Вызов / QR</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onStartMatch(
                      setupMode,
                      setupDifficulty,
                      setupPace,
                      setupPitch,
                      setupBlitzPref,
                      setupAiEngine
                    )
                  }
                  className="pc-btn-primary px-5 py-1.5 text-xs font-bold cursor-pointer ml-auto"
                >
                  ▶ Начать матч
                </button>
              </div>

              {quickMatchOpen && (
                <fieldset className="win95-groupbox space-y-2.5">
                  <legend>Параметры быстрого матча 11×11</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <div className="text-[11px] font-bold mb-1">Режим</div>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => setSetupMode("ai")}
                          className={`py-1 text-[11px] font-bold cursor-pointer ${
                            setupMode === "ai" ? "pc-btn-active" : "pc-btn"
                          }`}
                        >
                          Против ИИ
                        </button>
                        <button
                          type="button"
                          onClick={() => setSetupMode("local")}
                          className={`py-1 text-[11px] font-bold cursor-pointer ${
                            setupMode === "local" ? "pc-btn-active" : "pc-btn"
                          }`}
                        >
                          2 игрока
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-bold mb-1">ИИ-Агент</div>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => setSetupAiEngine("groq")}
                          className={`py-1 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer ${
                            setupAiEngine === "groq" ? "pc-btn-active" : "pc-btn"
                          }`}
                        >
                          <Bot className="w-3 h-3" />
                          <span>Groq LLM</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSetupAiEngine("classic")}
                          className={`py-1 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer ${
                            setupAiEngine === "classic" ? "pc-btn-active" : "pc-btn"
                          }`}
                        >
                          <Cpu className="w-3 h-3" />
                          <span>Тактик 95</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-bold mb-1">Сложность ИИ</div>
                      <div className="grid grid-cols-3 gap-1">
                        {(["rookie", "tactical", "pro"] as AIDifficulty[]).map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setSetupDifficulty(lvl)}
                            className={`py-1 text-[10px] font-bold cursor-pointer ${
                              setupDifficulty === lvl ? "pc-btn-active" : "pc-btn"
                            }`}
                          >
                            {DIFFICULTY_LABELS[lvl]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {(["turf", "ice", "sand", "obstacles"] as PitchType[]).map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => setSetupPitch(pt)}
                        className={`py-1 px-2 text-left cursor-pointer ${
                          setupPitch === pt ? "pc-btn-active" : "pc-btn"
                        }`}
                      >
                        <div className="text-[11px] font-bold truncate">{PITCH_META[pt].name}</div>
                        <div className="text-[9px] opacity-80 truncate">{PITCH_META[pt].subtitle}</div>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={setupBlitzPref}
                      onChange={(e) => setSetupBlitzPref(e.target.value as BlitzModePreference)}
                      className="pc-field px-2 py-1 text-xs font-bold"
                    >
                      {(Object.keys(BLITZ_PREF_LABELS) as BlitzModePreference[]).map((pref) => (
                        <option key={pref} value={pref}>
                          Блиц: {BLITZ_PREF_LABELS[pref]}
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-3 gap-1">
                      {(["turbo", "blitz", "relaxed"] as BlitzPace[]).map((pace) => (
                        <button
                          key={pace}
                          type="button"
                          onClick={() => setSetupPace(pace)}
                          className={`py-1 text-[10px] font-bold cursor-pointer ${
                            setupPace === pace ? "pc-btn-active" : "pc-btn"
                          }`}
                        >
                          {PACE_LABELS[pace]}
                        </button>
                      ))}
                    </div>
                  </div>
                </fieldset>
              )}
            </div>
          </div>
        </Win95Window>
      )}

      {/* ====================================================================
          TOURNAMENTS WINDOW (Exact Screenshot 1 Турниры!)
          ==================================================================== */}
      {tournamentsOpen && (
        <Win95Window
          title="Турниры"
          icon={<Trophy className="w-3.5 h-3.5 text-amber-300 shrink-0" />}
          ariaLabel="Турниры"
          zIndex={getWindowZ("tournaments")}
          isActive={activeWindowId === "tournaments"}
          isMinimized={minimizedWindows.includes("tournaments")}
          cascadeIndex={1}
          topBoundary={phase === "TITLE_MENU" ? 4 : 42}
          bottomBoundary={phase === "TITLE_MENU" ? 38 : 12}
          defaultWidth={640}
          defaultHeight={480}
          minWidth={320}
          minHeight={340}
          onFocus={() => onFocusWindow("tournaments")}
          onMinimize={() => onMinimizeWindow("tournaments")}
          onClose={() => onCloseWindow("tournaments")}
          statusBarPanes={[
            { text: `Выбран: ${activeTournament.name}`, flex: true },
            { text: PITCH_META[activeTournament.pitch].name },
          ]}
        >
          <div className="p-3 sm:p-4 flex-1 overflow-y-auto flex items-center justify-center bg-[#c0c0c0] text-black">
            <div className="w-full max-w-2xl space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_1fr] gap-3 items-stretch">
                {/* Left Tournament Listbox */}
                <div className="pc-field p-1 space-y-0.5">
                  {TOURNAMENTS.map((t) => {
                    const isSel = t.id === selectedTournamentId;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTournamentId(t.id)}
                        className={`w-full px-2.5 py-2.5 text-xs font-bold flex items-center gap-2 text-left cursor-pointer ${
                          isSel
                            ? "bg-[#000080] text-white"
                            : "bg-white text-black hover:bg-sky-100"
                        }`}
                      >
                        <Trophy
                          className={`w-4 h-4 shrink-0 ${
                            isSel ? "text-amber-300" : "text-amber-600"
                          }`}
                        />
                        <span>{t.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Right Trophy Artwork + Description */}
                <div className="space-y-2 flex flex-col justify-between">
                  <div className="pc-field p-1">
                    <PixelTrophyIllustration className="w-full h-36" />
                  </div>
                  <div className="pc-inset p-2.5 space-y-1 flex-1">
                    <div className="font-display text-base font-bold text-[#000080]">
                      {activeTournament.name}
                    </div>
                    <p className="text-[11px] text-slate-900 leading-snug">
                      {activeTournament.desc}
                    </p>
                    <div className="text-[10px] font-bold text-emerald-800 pt-1">
                      Поле: {PITCH_META[activeTournament.pitch].name} ·{" "}
                      {DIFFICULTY_LABELS[activeTournament.diff]}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#808080]">
                <button
                  type="button"
                  onClick={() => {
                    onCloseWindow("tournaments");
                    onStartMatch(
                      "ai",
                      activeTournament.diff,
                      activeTournament.pace,
                      activeTournament.pitch,
                      "dynamic",
                      activeTournament.engine
                    );
                  }}
                  className="pc-btn-primary px-5 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Играть</span>
                </button>
                <button
                  type="button"
                  onClick={() => onCloseWindow("tournaments")}
                  className="pc-btn px-4 py-1.5 text-xs font-bold flex items-center gap-1.5 text-red-900 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Назад</span>
                </button>
              </div>
            </div>
          </div>
        </Win95Window>
      )}

      {/* ====================================================================
          TEAM TACTICS WINDOW (Exact Screenshot 1 Тактика команды!)
          ==================================================================== */}
      {tacticsOpen && (
        <Win95Window
          title="Тактика команды"
          icon={<ClipboardList className="w-3.5 h-3.5 text-emerald-300 shrink-0" />}
          ariaLabel="Тактика команды"
          zIndex={getWindowZ("tactics")}
          isActive={activeWindowId === "tactics"}
          isMinimized={minimizedWindows.includes("tactics")}
          cascadeIndex={2}
          topBoundary={phase === "TITLE_MENU" ? 4 : 42}
          bottomBoundary={phase === "TITLE_MENU" ? 38 : 12}
          defaultWidth={560}
          defaultHeight={480}
          minWidth={320}
          minHeight={340}
          onFocus={() => onFocusWindow("tactics")}
          onMinimize={() => onMinimizeWindow("tactics")}
          onClose={() => onCloseWindow("tactics")}
          statusBarPanes={[
            { text: `Схема: ${activeFormation.id} · Стиль: ${mentality}`, flex: true },
            { text: aiEngine === "groq" ? "ИИ: Groq LLM" : "ИИ: Движок 95" },
          ]}
        >
          <div className="p-3 sm:p-4 flex-1 overflow-y-auto flex items-center justify-center bg-[#c0c0c0] text-black">
            <div className="w-full max-w-xl space-y-3">
              {/* Top Formation Selector */}
              <div className="pc-inset px-3 py-1.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFormationIdx((i) => (i - 1 + FORMATIONS.length) % FORMATIONS.length)
                  }
                  className="pc-btn w-7 h-6 flex items-center justify-center cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-display text-base font-bold text-[#000080]">
                  Схема: {activeFormation.id}
                </span>
                <button
                  type="button"
                  onClick={() => setFormationIdx((i) => (i + 1) % FORMATIONS.length)}
                  className="pc-btn w-7 h-6 flex items-center justify-center cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
                {/* Left Vertical Pitch Tactical Board */}
                <div className="pc-inset p-1.5 bg-[#1b6b28] flex items-center justify-center">
                  <svg viewBox="0 0 100 110" className="w-44 h-48" aria-hidden="true">
                    <rect width="100" height="110" fill="#238832" />
                    <rect x="0" y="0" width="100" height="22" fill="#2c9e3d" />
                    <rect x="0" y="44" width="100" height="22" fill="#2c9e3d" />
                    <rect x="0" y="88" width="100" height="22" fill="#2c9e3d" />
                    <rect x="6" y="6" width="88" height="98" fill="none" stroke="#fff" strokeWidth="1.5" />
                    <line x1="6" y1="55" x2="94" y2="55" stroke="#fff" strokeWidth="1.5" />
                    <circle cx="50" cy="55" r="12" fill="none" stroke="#fff" strokeWidth="1.5" />
                    <rect x="26" y="6" width="48" height="16" fill="none" stroke="#fff" strokeWidth="1.5" />
                    <rect x="26" y="88" width="48" height="16" fill="none" stroke="#fff" strokeWidth="1.5" />
                    {activeFormation.dots.map(([cx, cy], idx) => (
                      <g key={idx}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={idx === 0 ? 4.2 : 4.5}
                          fill={idx === 0 ? "#16a34a" : "#ffffff"}
                          stroke="#0f172a"
                          strokeWidth="1.5"
                        />
                        <circle cx={cx} cy={cy} r="1.5" fill="#1d4ed8" />
                      </g>
                    ))}
                  </svg>
                </div>

                {/* Right Tactical Dropdowns wired to Real Game State */}
                <div className="space-y-2.5 flex flex-col justify-between">
                  <div>
                    <label className="block text-[11px] font-bold mb-1">Стиль игры</label>
                    <select
                      value={mentality}
                      onChange={(e) => onChangeMentality(e.target.value as TacticalMentality)}
                      className="pc-field w-full px-2 py-1.5 text-xs font-bold"
                    >
                      <option value="attack">Атакующий (+1 AP атаке впереди)</option>
                      <option value="balance">Сбалансированный</option>
                      <option value="defend">Оборонительный (+1 AP защите сзади)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold mb-1">Темп ИИ</label>
                    <select
                      value={aiPace}
                      onChange={(e) => {
                        if (e.target.value !== aiPace) onToggleAIPace();
                      }}
                      className="pc-field w-full px-2 py-1.5 text-xs font-bold"
                    >
                      <option value="normal">Обычный (1×)</option>
                      <option value="fast">Высокий (2×)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold mb-1">ИИ-Соперник</label>
                    <select
                      value={aiEngine}
                      onChange={(e) => onChangeAiEngine(e.target.value as AIOpponentEngine)}
                      className="pc-field w-full px-2 py-1.5 text-xs font-bold"
                    >
                      <option value="groq">Groq LLM ИИ-Агент</option>
                      <option value="classic">Тактик-Движок 95</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold mb-1">Режим блиц-стыков</label>
                    <select
                      value={blitzModePref}
                      onChange={(e) => onChangeBlitzPref(e.target.value as BlitzModePreference)}
                      className="pc-field w-full px-2 py-1.5 text-xs font-bold"
                    >
                      {(Object.keys(BLITZ_PREF_LABELS) as BlitzModePreference[]).map((pref) => (
                        <option key={pref} value={pref}>
                          {BLITZ_PREF_LABELS[pref]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#808080]">
                <button
                  type="button"
                  onClick={() => {
                    onApplyFormation(activeFormation.id);
                    onCloseWindow("tactics");
                  }}
                  className="pc-btn-primary px-5 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Применить ({activeFormation.id})</span>
                </button>
                <button
                  type="button"
                  onClick={() => onCloseWindow("tactics")}
                  className="pc-btn px-4 py-1.5 text-xs font-bold flex items-center gap-1.5 text-red-900 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Отмена</span>
                </button>
              </div>
            </div>
          </div>
        </Win95Window>
      )}

      {/* ====================================================================
          MATCH STATS WINDOW (Exact Screenshot 1 Статистика матча!)
          ==================================================================== */}
      {statsOpen && (
        <Win95Window
          title="Статистика матча"
          icon={<BarChart3 className="w-3.5 h-3.5 text-amber-300 shrink-0" />}
          ariaLabel="Статистика матча"
          zIndex={getWindowZ("stats")}
          isActive={activeWindowId === "stats"}
          isMinimized={minimizedWindows.includes("stats")}
          cascadeIndex={3}
          topBoundary={phase === "TITLE_MENU" ? 4 : 42}
          bottomBoundary={phase === "TITLE_MENU" ? 38 : 12}
          defaultWidth={560}
          defaultHeight={480}
          minWidth={320}
          minHeight={340}
          onFocus={() => onFocusWindow("stats")}
          onMinimize={() => onMinimizeWindow("stats")}
          onClose={() => onCloseWindow("stats")}
          statusBarPanes={[
            { text: `Счёт ${scoreBlue}:${scoreRed} · Ход ${turnCount}/${MAX_TURNS}`, flex: true },
            { text: PITCH_META[pitchType].name },
          ]}
        >
          <div className="p-3 sm:p-4 flex-1 overflow-y-auto flex items-center justify-center bg-[#c0c0c0] text-black">
            <div className="w-full max-w-lg space-y-3">
              {/* Top Club Crests & Score */}
              <div className="pc-inset p-3 flex items-center justify-around gap-3 bg-[#dfdfdf]">
                <div className="flex items-center gap-2">
                  <PixelClubCrest team="blue" label={leftClubLabel.slice(0, 3)} className="w-9 h-10" />
                  <span className="font-display text-base font-bold text-[#000080] truncate max-w-[100px]">
                    {leftClubLabel}
                  </span>
                </div>

                <div className="font-display text-3xl font-bold tabular-nums text-black">
                  {scoreBlue} : {scoreRed}
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-display text-base font-bold text-red-900 truncate max-w-[100px]">
                    {rightClubLabel}
                  </span>
                  <PixelClubCrest team="red" label={rightClubLabel.slice(0, 3)} className="w-9 h-10" />
                </div>
              </div>

              {/* Dual Blue / Red Comparison Bars */}
              <div className="pc-inset p-3 space-y-2.5 bg-[#dfdfdf]">
                {(() => {
                  const t = serverMatch?.telemetry;
                  const bluePoss = t
                    ? Math.round((t.blueTurns / Math.max(1, t.blueTurns + t.redTurns)) * 100)
                    : Math.min(82, Math.max(30, 50 + (momentum - 40) * 0.25 + (scoreBlue - scoreRed) * 8));
                  const redPoss = 100 - Math.round(bluePoss);
                  const rows = [
                    {
                      label: "Владение мячом",
                      left: `${Math.round(bluePoss)}%`,
                      right: `${redPoss}%`,
                      pct: bluePoss,
                    },
                    {
                      label: "Удары",
                      left: t ? t.shotsBlue : matchStats.shots,
                      right: t ? t.shotsRed : scoreRed + Math.floor(turnCount / 9),
                      pct:
                        ((t ? t.shotsBlue : matchStats.shots) /
                          Math.max(
                            1,
                            (t ? t.shotsBlue : matchStats.shots) +
                              (t ? t.shotsRed : scoreRed + Math.floor(turnCount / 9))
                          )) *
                        100,
                    },
                    {
                      label: "Пасы",
                      left: t ? t.passesBlue : matchStats.passes,
                      right: t ? t.passesRed : Math.floor(turnCount * 0.4),
                      pct:
                        ((t ? t.passesBlue : matchStats.passes) /
                          Math.max(
                            1,
                            (t ? t.passesBlue : matchStats.passes) +
                              (t ? t.passesRed : Math.floor(turnCount * 0.4))
                          )) *
                        100,
                    },
                    {
                      label: "Выиграно блиц-дуэлей",
                      left: t ? t.blitzBlueWon : matchStats.blitzWon,
                      right: t
                        ? t.blitzRedWon
                        : Math.max(0, matchStats.blitzPlayed - matchStats.blitzWon),
                      pct:
                        matchStats.blitzPlayed > 0
                          ? (matchStats.blitzWon / matchStats.blitzPlayed) * 100
                          : 50,
                    },
                    {
                      label: "Ходов командой",
                      left: matchStats.moves,
                      right: Math.max(0, Math.floor(turnCount / 2)),
                      pct:
                        (matchStats.moves /
                          Math.max(1, matchStats.moves + Math.floor(turnCount / 2))) *
                        100,
                    },
                  ];
                  return rows.map((row) => (
                    <div key={row.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="font-mono tabular-nums text-[#000080]">{row.left}</span>
                        <span className="text-black">{row.label}</span>
                        <span className="font-mono tabular-nums text-red-900">{row.right}</span>
                      </div>
                      <div className="h-3 pc-field p-[1px] flex">
                        <div
                          className="bg-blue-600 h-full transition-all duration-300"
                          style={{ width: `${Math.max(8, Math.min(92, row.pct))}%` }}
                        />
                        <div className="bg-red-600 h-full flex-1" />
                      </div>
                    </div>
                  ));
                })()}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenWindow("coach")}
                  className="pc-btn px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <BrainCircuit className="w-3.5 h-3.5 text-[#000080]" />
                  <span>Советы тренера</span>
                </button>
                <button
                  type="button"
                  onClick={() => onCloseWindow("stats")}
                  className="pc-btn-primary px-6 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Закрыть</span>
                </button>
              </div>
            </div>
          </div>
        </Win95Window>
      )}

      {/* ====================================================================
          SETTINGS WINDOW (Exact Screenshot 1 Настройки!)
          ==================================================================== */}
      {settingsOpen && (
        <Win95Window
          title="Настройки"
          icon={<Settings className="w-3.5 h-3.5 text-slate-200 shrink-0" />}
          ariaLabel="Настройки игры"
          zIndex={getWindowZ("settings")}
          isActive={activeWindowId === "settings"}
          isMinimized={minimizedWindows.includes("settings")}
          cascadeIndex={4}
          topBoundary={phase === "TITLE_MENU" ? 4 : 42}
          bottomBoundary={phase === "TITLE_MENU" ? 38 : 12}
          defaultWidth={540}
          defaultHeight={430}
          minWidth={320}
          minHeight={320}
          onFocus={() => onFocusWindow("settings")}
          onMinimize={() => onMinimizeWindow("settings")}
          onClose={() => onCloseWindow("settings")}
          statusBarPanes={[
            { text: `Сложность: ${DIFFICULTY_LABELS[difficulty]} · ИИ: ${aiEngine}`, flex: true },
            { text: soundEnabled ? "Звук: ВКЛ" : "Звук: ВЫКЛ" },
          ]}
        >
          <div className="px-2.5 pt-2 bg-[#c0c0c0] flex items-end gap-0.5 border-b border-white shrink-0">
            {(
              [
                { id: "game", label: "Игра" },
                { id: "graphics", label: "Графика" },
                { id: "sound", label: "Звук" },
                { id: "controls", label: "Управление" },
              ] as const
            ).map((tb) => (
              <button
                key={tb.id}
                type="button"
                onClick={() => setSettingsTab(tb.id)}
                className={`px-3 py-1.5 text-xs cursor-pointer ${
                  settingsTab === tb.id ? "win95-tab-active" : "win95-tab"
                }`}
              >
                {tb.label}
              </button>
            ))}
          </div>

          <div className="p-3.5 sm:p-4 flex-1 overflow-y-auto flex flex-col justify-between bg-[#c0c0c0] text-black">
            <div className="max-w-xl w-full mx-auto space-y-3">
              {settingsTab === "game" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2.5">
                    <div>
                      <div className="text-xs font-bold mb-1">Скорость ходов ИИ:</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px]">Обычно</span>
                        <button
                          type="button"
                          onClick={onToggleAIPace}
                          className="pc-btn flex-1 py-1 text-xs font-bold cursor-pointer"
                        >
                          {aiPace === "fast" ? "Быстро (2×)" : "Нормально (1×)"}
                        </button>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showCoachHint}
                        onChange={onToggleCoachHint}
                        className="w-4 h-4 accent-[#000080]"
                      />
                      <span>Показывать подсказки тренера</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={soundEnabled}
                        onChange={onToggleSound}
                        className="w-4 h-4 accent-[#000080]"
                      />
                      <span>Звук событий и комментариев</span>
                    </label>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-xs font-bold mb-1">Сложность ИИ:</label>
                      <select
                        value={difficulty}
                        onChange={(e) => onChangeDifficulty(e.target.value as AIDifficulty)}
                        className="pc-field w-full px-2 py-1 text-xs font-bold"
                      >
                        <option value="rookie">Новичок</option>
                        <option value="tactical">Тактик</option>
                        <option value="pro">Профи</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold mb-1">ИИ-Движок:</label>
                      <select
                        value={aiEngine}
                        onChange={(e) => onChangeAiEngine(e.target.value as AIOpponentEngine)}
                        className="pc-field w-full px-2 py-1 text-xs font-bold"
                      >
                        <option value="groq">Groq ИИ-Агент (Cloud LLM)</option>
                        <option value="classic">Тактик-Движок 95</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold mb-1">Таймер блица:</label>
                      <select
                        value={blitzPace}
                        onChange={(e) => onChangeBlitzPace(e.target.value as BlitzPace)}
                        className="pc-field w-full px-2 py-1 text-xs font-bold"
                      >
                        <option value="turbo">Турбо (2.2с)</option>
                        <option value="blitz">Блиц (3.5с)</option>
                        <option value="relaxed">Без таймера</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === "graphics" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold mb-1">Ракурс камеры на поле:</label>
                    <select
                      value={cameraPreset}
                      onChange={(e) => onChangeCameraPreset(e.target.value as CameraPreset)}
                      className="pc-field w-full px-2 py-1.5 text-xs font-bold"
                    >
                      <option value="tv">ТВ-камера (Изометрия 2.5D)</option>
                      <option value="wide">Общий план стадиона</option>
                      <option value="close">Крупный план на игрока</option>
                      <option value="topdown">Вид сверху (Тактика)</option>
                      <option value="opposite">Разворот 180°</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={crtEnabled}
                      onChange={onToggleCrt}
                      className="w-4 h-4 accent-[#000080]"
                    />
                    <span>Эффект ЭЛТ-монитора (CRT scanlines)</span>
                  </label>

                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="pc-btn px-4 py-1.5 text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    {isFullscreen ? (
                      <Minimize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Maximize className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isFullscreen ? "Выйти из полноэкранного режима" : "Открыть на весь экран"}
                    </span>
                  </button>
                </div>
              )}

              {settingsTab === "sound" && (
                <div className="space-y-2.5">
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={soundEnabled}
                      onChange={onToggleSound}
                      className="w-4 h-4 accent-[#000080]"
                    />
                    <span>8-битные звуки свистка, удара и стадиона</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ttsEnabled}
                      onChange={onToggleTts}
                      className="w-4 h-4 accent-[#000080]"
                    />
                    <span>Голосовая озвучка комментатора (Русский TTS)</span>
                  </label>
                </div>
              )}

              {settingsTab === "controls" && (
                <div className="pc-field p-3 space-y-1.5 text-xs">
                  <div>
                    <strong>ЛКМ / Тап по игроку</strong> — выбрать футболиста
                  </div>
                  <div>
                    <strong>Зелёная / жёлтая / оранжевая зона</strong> — бег / пас / блиц-стык
                  </div>
                  <div>
                    <strong>Tab</strong> — переключить ближайшего игрока
                  </div>
                  <div>
                    <strong>Пробел</strong> — лучший тактический ход / дриблинг
                  </div>
                  <div>
                    <strong>Enter</strong> — быстрый удар по воротам или пас вперёд
                  </div>
                  <div>
                    <strong>V / Z / R</strong> — сменить ракурс камеры / приблизить / сброс
                  </div>
                </div>
              )}
            </div>

            <div className="max-w-xl w-full mx-auto flex items-center justify-end gap-2 pt-3 border-t border-[#808080]">
              <button
                type="button"
                onClick={() => onCloseWindow("settings")}
                className="pc-btn-primary px-5 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Сохранить</span>
              </button>
              <button
                type="button"
                onClick={() => onCloseWindow("settings")}
                className="pc-btn px-4 py-1.5 text-xs font-bold flex items-center gap-1.5 text-red-900 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Отмена</span>
              </button>
            </div>
          </div>
        </Win95Window>
      )}

      {/* ====================================================================
          GAME OVER DIALOG
          ==================================================================== */}
      {phase === "GAME_OVER" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Матч окончен"
        >
          <div className="w-full max-w-md max-h-[95dvh] flex flex-col pc-window p-[3px]">
            <div className="pc-titlebar px-2.5 py-1 flex items-center justify-between shrink-0">
              <span className="font-display text-sm font-bold">Матч окончен</span>
              <Win95CaptionButtons onClose={onOpenSetup} closeLabel="В главное меню" />
            </div>

            <div className="p-3 sm:p-3.5 space-y-2.5 sm:space-y-3 bg-[#c0c0c0] text-black overflow-y-auto touch-scroll">
              <div className="pc-inset-dark p-3 sm:p-4 text-center space-y-2">
                <div className="flex items-center justify-around gap-2">
                  <PixelClubCrest team="blue" label={leftClubLabel.slice(0, 3)} className="w-11 h-12 sm:w-12 sm:h-13" />
                  <div className="font-display text-3xl sm:text-4xl font-bold tabular-nums text-white">
                    {scoreBlue} : {scoreRed}
                  </div>
                  <PixelClubCrest team="red" label={rightClubLabel.slice(0, 3)} className="w-11 h-12 sm:w-12 sm:h-13" />
                </div>

                <h2 className="font-display text-lg sm:text-xl font-bold text-amber-300">
                  {winner === "blue"
                    ? `Победа! ${leftClubLabel}`
                    : winner === "red"
                    ? gameMode === "ai" && !isSpectating
                      ? `Победа ${rightClubLabel}`
                      : `Победа! ${rightClubLabel}`
                    : "Боевая ничья"}
                </h2>
              </div>

              {lastMatchReward && !isSpectating && (
                <div className="pc-inset px-3 py-1.5 text-xs font-bold text-[#000080] text-center tabular-nums">
                  +{lastMatchReward.xp} XP за матч
                  {lastMatchReward.points > 0
                    ? ` · +${lastMatchReward.points} очко навыков!`
                    : ""}
                </div>
              )}

              <p className="text-[11px] text-center text-slate-800">
                Ходов: {Math.min(turnCount, MAX_TURNS)} · До {TARGET_GOALS} голов ·{" "}
                {PITCH_META[pitchType].name}
              </p>

              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => onOpenWindow("stats")}
                  className="pc-btn w-full min-h-[42px] py-2 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <BarChart3 className="w-4 h-4 text-[#000080]" />
                  <span>Статистика</span>
                </button>

                <button
                  type="button"
                  onClick={isSpectating ? onExitSpectate : onResetMatch}
                  className="pc-btn-primary w-full min-h-[42px] py-2 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{isSpectating ? "Назад в лобби" : "Продолжить (Ещё матч)"}</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenSetup}
                  className="pc-btn w-full min-h-[42px] py-2 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Home className="w-4 h-4 text-sky-800" />
                  <span>Главное меню</span>
                </button>
              </div>
            </div>

            <Win95StatusBar
              panes={[
                { text: isSpectating ? "Трансляция завершена" : "Матч сохранён в историю", flex: true },
                { text: `${scoreBlue}:${scoreRed}` },
              ]}
            />
          </div>
        </div>
      )}

      {/* STACKABLE HELP WINDOW */}
      {rulesOpen && (
        <Win95Window
          title="HELP.HLP — Тактика, Блокировки и Блиц"
          icon={<BookOpen className="w-3.5 h-3.5 text-amber-200 shrink-0" />}
          ariaLabel="Справочник ролей и правил"
          zIndex={getWindowZ("rules")}
          isActive={activeWindowId === "rules"}
          isMinimized={minimizedWindows.includes("rules")}
          cascadeIndex={4}
          topBoundary={phase === "TITLE_MENU" ? 4 : 42}
          bottomBoundary={phase === "TITLE_MENU" ? 38 : 12}
          defaultWidth={520}
          defaultHeight={530}
          minWidth={300}
          minHeight={320}
          onFocus={() => onFocusWindow("rules")}
          onMinimize={() => onMinimizeWindow("rules")}
          onClose={() => onCloseWindow("rules")}
          statusBarPanes={[
            { text: "Справочник WINDOWS 95 FOOTBALL", flex: true },
            { text: "Поле 32×32" },
          ]}
        >
          <div className="p-3.5 space-y-3 overflow-y-auto touch-scroll flex-1 text-black">
            <fieldset className="win95-groupbox space-y-1.5 bg-[#d4d0c8]">
              <legend>Тактические блокировки и блиц-дуэли</legend>
              <p className="text-xs leading-snug">
                <strong className="text-[#000080]">2 защитника спереди:</strong> проход и дриблинг вперёд заблокированы — уходите во фланг, отступайте или отдавайте разрезающий пас.
              </p>
              <p className="text-xs leading-snug">
                <strong className="text-red-800">3+ защитника в зоне контроля:</strong> игрок в жёстком прессинге и может двигаться только назад или искать пас (успешный пас из-под двойного/тройного блока возвращает +1 AP!).
              </p>
              <p className="text-xs leading-snug">
                <strong className="text-emerald-900">Блиц только при прямом стыке:</strong> крестики-нолики запускаются только при прямом отборе, прорыве сквозь защитника или ударе в перекрытый створ. Открытый удар в угол забивается сразу!
              </p>
            </fieldset>

            <fieldset className="win95-groupbox space-y-2">
              <legend>Амплуа и 360° тактические зоны</legend>
              {(["GK", "DEF", "MID", "WNG", "FWD"] as const).map((role) => {
                const meta = ROLE_META[role];
                return (
                  <div key={role} className="pc-field p-2 flex items-start gap-2.5">
                    <div className="w-7 h-7 bg-[#000080] border border-black flex items-center justify-center shrink-0 mt-0.5">
                      <ChessPieceIcon role={role} className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-black">
                        {meta.code} · {meta.name} ({meta.chessName})
                      </div>
                      <p className="text-[11px] text-slate-800 mt-0.5 leading-snug">
                        {meta.moveSummary}
                      </p>
                    </div>
                  </div>
                );
              })}
            </fieldset>

            <div className="pc-inset-dark p-3 space-y-1 text-xs">
              <div className="font-bold text-amber-300">Вариации блиц-дуэлей</div>
              {(["classic", "decay", "blocked", "grand"] as const).map((v) => (
                <p key={v} className="text-slate-300 leading-snug">
                  <strong className="text-white">{BLITZ_VARIANT_META[v].name}:</strong>{" "}
                  {BLITZ_VARIANT_META[v].shortDesc}
                </p>
              ))}
            </div>
          </div>
        </Win95Window>
      )}

      {showActionPopover && selectedPlayer && isHumanTurn && (
        <PlayerActionPopover
          player={selectedPlayer}
          progression={progression}
          hasBall={selectedHasBall}
          actionPoints={actionPoints}
          maxActionPoints={maxActionPoints}
          turnTimeLeft={turnTimeLeft}
          maxTurnTime={maxTurnTime}
          actionMode={actionMode}
          moveMinCost={moveMinCost}
          passCost={passCost}
          shotCost={shotCost}
          hasClashTarget={hasClashTarget}
          pressureState={pressureState}
          onClose={() => onToggleActionPopover(false)}
          onActionClick={(action) => onSelectActionMode(action)}
          onEndTurn={() => {
            onToggleActionPopover(false);
            onEndTurn();
          }}
          canMove={canSelectedMove}
          canPass={canQuickPass}
          canShoot={canQuickShot}
        />
      )}
    </>
  );
};
