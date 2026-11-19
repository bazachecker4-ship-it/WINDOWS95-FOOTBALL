import React, { useEffect, useState } from "react";
import {
  AIDifficulty,
  AIOpponentEngine,
  AIPace,
  BLITZ_VARIANT_META,
  BlitzModePreference,
  BlitzPace,
  CommentaryItem,
  GameMode,
  GamePhase,
  LiveMatchSummary,
  MAX_TURNS,
  PITCH_META,
  PitchType,
  PlayerPiece,
  ROLE_META,
  ServerMatchSnapshot,
  TARGET_GOALS,
  TacticalHint,
  TacticalMentality,
  Team,
} from "../types/game";
import { UserProfile } from "../engine/profile";
import { ChessPieceIcon, SoccerBallIcon } from "./ChessPieceIcon";
import { Win95CaptionButtons, Win95FlagIcon, Win95StatusBar } from "./Win95Chrome";
import { DesktopWindowId, WINDOW_TASKBAR_LABELS, Win95Window } from "./Win95Window";
import {
  BookOpen,
  Bot,
  BrainCircuit,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Cpu,
  Eye,
  FastForward,
  Flag,
  Flame,
  Globe,
  Lightbulb,
  Maximize,
  MessageSquare,
  Minimize2,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Settings2,
  Share2,
  Shield,
  SlidersHorizontal,
  Speech,
  Swords,
  Target,
  User,
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
  onChangeMentality: (mentality: TacticalMentality) => void;
  onSelectQuickPlayer: (playerId: string) => void;
  onCyclePlayer: () => void;
  onQuickPass: () => void;
  onQuickShot: () => void;
  onAutoMove: () => void;
  onExitSpectate: () => void;
  onSwitchSpectateMatch?: (match: LiveMatchSummary) => void;
  onSendSpectateReaction?: (text: string) => void;
  onResignOnlineMatch?: () => void;
  userProfile: UserProfile;
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
  onChangeMentality,
  onSelectQuickPlayer,
  onCyclePlayer,
  onQuickPass,
  onQuickShot,
  onAutoMove,
  onExitSpectate,
  onSwitchSpectateMatch,
  onSendSpectateReaction,
  onResignOnlineMatch,
  userProfile,
}) => {
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [clockTime, setClockTime] = useState(formatClock);
  const [commentaryExpanded, setCommentaryExpanded] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 640 : true
  );
  const [setupMode, setSetupMode] = useState<GameMode>(gameMode === "online" ? "ai" : gameMode);
  const [setupDifficulty, setSetupDifficulty] = useState<AIDifficulty>(difficulty);
  const [setupAiEngine, setSetupAiEngine] = useState<AIOpponentEngine>(aiEngine);
  const [setupPace, setSetupPace] = useState<BlitzPace>(blitzPace);
  const [setupPitch, setSetupPitch] = useState<PitchType>(pitchType);
  const [setupBlitzPref, setSetupBlitzPref] = useState<BlitzModePreference>(blitzModePref);

  useEffect(() => {
    const timer = window.setInterval(() => setClockTime(formatClock()), 20000);
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen may be restricted in some embedded previews
    }
  };

  const latestCommentary = commentaryLog[0];

  const mobileGuideText = isSpectating
    ? serverMatch
      ? `LIVE: ${serverMatch.hostName} vs ${serverMatch.guestName}`
      : "LIVE ЭФИР — Наблюдение за матчем"
    : gameMode === "online"
    ? currentTurn === localTeam
      ? "Ваш ход в онлайн PvP!"
      : "Ход соперника по сети..."
    : currentTurn !== "blue" && gameMode === "ai"
    ? aiEngine === "groq"
      ? "Groq ИИ-Агент думает..."
      : "Соперник ИИ думает..."
    : selectedPlayer
    ? selectedHasBall
      ? canQuickShot
        ? `${ROLE_META[selectedPlayer.role].code}#${selectedPlayer.number}: бейте по воротам!`
        : `${ROLE_META[selectedPlayer.role].code}#${selectedPlayer.number}: ведите или пасуйте`
      : `${ROLE_META[selectedPlayer.role].code}#${selectedPlayer.number}: тапните зелёную клетку`
    : "Тапните по игроку или «Лучший ход»";

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
            alignBottom ? "bottom-8" : "top-8"
          }`}
          role="menu"
        >
          <div className="w-7 bg-[#000080] text-white flex items-end justify-center pb-2 shrink-0">
            <span
              className="font-display text-sm font-bold tracking-widest text-slate-200 whitespace-nowrap"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              BLITZ <span className="text-white">95</span>
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
              <span>Новая игра / Матч</span>
            </button>

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
                onOpenWindow("squad");
              }}
              className="w-full px-2.5 py-1.5 flex items-center justify-between gap-2 text-left hover:bg-[#000080] hover:text-white cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                <span>Команда и прокачка</span>
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
                onOpenWindow("lobby");
              }}
              className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left hover:bg-[#000080] hover:text-white cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>Сетевое лобби & Эфир</span>
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
              <span>Бросить вызов (QR/Ссылка)</span>
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
              <span>ИИ-Тренер</span>
            </button>

            <div className="my-1 border-t border-[#808080] border-b border-b-white" />

            <button
              type="button"
              onClick={() => {
                setStartMenuOpen(false);
                toggleFullscreen();
              }}
              className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left hover:bg-[#000080] hover:text-white cursor-pointer"
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Maximize className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{isFullscreen ? "Выйти из полноэкрана" : "На весь экран"}</span>
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
              <span>Справка (HELP.HLP)</span>
            </button>
          </div>
        </div>
      </>
    );

  const setupOpen = openWindows.includes("setup");
  const rulesOpen = openWindows.includes("rules");

  return (
    <>
      {/* ============================================================
          IN-GAME TOP TASKBAR / SCOREBOARD (Active during Match)
          ============================================================ */}
      {phase !== "TITLE_MENU" && (
        <header className="fixed top-1 sm:top-2 left-1/2 -translate-x-1/2 z-50 w-[min(98.5vw,1060px)] pointer-events-none select-none">
          <div className="pointer-events-auto pc-window px-1.5 sm:px-2 py-1 flex items-center justify-between gap-1 sm:gap-2">
            <div className="flex items-center gap-1.5 min-w-0 relative">
              <button
                type="button"
                onClick={() => setStartMenuOpen((v) => !v)}
                aria-expanded={startMenuOpen}
                className={`h-7 px-2 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  startMenuOpen ? "pc-btn-active" : "pc-btn"
                }`}
              >
                <Win95FlagIcon className="w-4 h-4 shrink-0" />
                <span>Пуск</span>
              </button>

              {renderStartMenuPopup(false)}

              <div className="h-5 w-[1px] bg-[#808080] border-r border-white hidden sm:block shrink-0" />

              <span className="font-display text-sm sm:text-base font-bold tracking-tight text-[#000080] whitespace-nowrap shrink-0 hidden md:inline">
                БЛИЦ 95
              </span>

              {isSpectating && (
                <span className="bg-red-700 text-white border border-black px-1.5 py-0.5 text-[10px] font-bold flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 bg-white animate-pulse" />
                  <span>ЭФИР</span>
                </span>
              )}

              {/* Compact Open Window Chips during Match so minimized windows can be restored */}
              {openWindows.length > 0 && (
                <div className="hidden lg:flex items-center gap-1 overflow-x-auto max-w-[230px]">
                  {openWindows.map((winId) => {
                    const isFocused = activeWindowId === winId && !minimizedWindows.includes(winId);
                    return (
                      <button
                        key={winId}
                        type="button"
                        onClick={() => onToggleTaskbarWindow(winId)}
                        className={`h-6 px-1.5 text-[10px] font-bold truncate max-w-[110px] cursor-pointer ${
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

            {/* Digital Scoreboard */}
            <div className="pc-inset-dark px-2 sm:px-3 py-1 flex items-center gap-1.5 sm:gap-2 shrink-0 max-w-[42vw] sm:max-w-none">
              <span
                className={`text-[10px] sm:text-xs font-bold whitespace-nowrap truncate max-w-[78px] sm:max-w-[120px] ${
                  currentTurn === "blue" ? "text-sky-300" : "text-slate-400"
                }`}
              >
                {serverMatch
                  ? serverMatch.hostName
                  : gameMode === "online"
                  ? "СИНИЕ"
                  : "СИНИЕ"}
                {gameMode === "online" && localTeam === "blue" ? " (Вы)" : ""}
              </span>
              <span className="font-display text-base sm:text-xl font-bold tabular-nums text-emerald-300 leading-none shrink-0">
                {scoreBlue}:{scoreRed}
              </span>
              <span
                className={`text-[10px] sm:text-xs font-bold whitespace-nowrap truncate max-w-[78px] sm:max-w-[120px] ${
                  currentTurn === "red" ? "text-red-300" : "text-slate-400"
                }`}
              >
                {serverMatch
                  ? serverMatch.guestName
                  : gameMode === "ai" && !isSpectating
                  ? aiEngine === "groq"
                    ? "GROQ ИИ"
                    : "ИИ"
                  : "КРАСН"}
                {gameMode === "online" && localTeam === "red" ? " (Вы)" : ""}
              </span>
              <span className="hidden sm:inline text-slate-600" aria-hidden="true">
                |
              </span>
              <span className="hidden sm:inline font-mono text-xs text-amber-300 tabular-nums whitespace-nowrap shrink-0">
                {Math.min(turnCount, MAX_TURNS)}/{MAX_TURNS}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1 shrink-0">
              {isSpectating ? (
                <button
                  type="button"
                  onClick={onExitSpectate}
                  className="pc-btn h-7 px-2 text-xs font-bold flex items-center gap-1 text-red-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Выйти из эфира</span>
                  <span className="sm:hidden">Выход</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onToggleCoachHint}
                    title="Подсказка лучшего хода на поле"
                    className={`h-7 px-2 text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                      showCoachHint ? "pc-btn-active" : "pc-btn"
                    }`}
                  >
                    <Lightbulb className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden md:inline">Ход</span>
                  </button>
                  {gameMode === "online" && onResignOnlineMatch && (
                    <button
                      type="button"
                      onClick={onResignOnlineMatch}
                      title="Завершить сетевой матч (сдаться)"
                      className="pc-btn h-7 px-2 text-xs font-bold flex items-center gap-1 text-red-800 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Flag className="w-3 h-3 shrink-0" />
                      <span className="hidden lg:inline">Сдаться</span>
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={() => onOpenWindow("squad")}
                title="Прокачка фигур, способности и внешний вид"
                className="pc-btn h-7 px-2 text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0 text-emerald-800" />
                <span className="hidden sm:inline">Команда</span>
                {skillPoints > 0 && (
                  <span className="font-mono text-[11px] font-bold text-red-700 tabular-nums">
                    +{skillPoints}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onOpenWindow("lobby")}
                title="Сетевое лобби, чат и прямые трансляции"
                aria-label="Сетевое лобби"
                className="pc-btn h-7 w-7 sm:w-auto sm:px-2 text-xs font-bold flex items-center justify-center gap-1 shrink-0 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-[#000080] shrink-0" />
                <span className="hidden xl:inline">Сеть</span>
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Обычный режим" : "На весь экран"}
                aria-label="Полный экран"
                className={`h-7 w-7 flex items-center justify-center shrink-0 cursor-pointer ${
                  isFullscreen ? "pc-btn-active" : "pc-btn"
                }`}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize className="w-3.5 h-3.5" />
                )}
              </button>

              <button
                type="button"
                onClick={onToggleSound}
                title={soundEnabled ? "Выключить 8-бит звук" : "Включить 8-бит звук"}
                aria-label={soundEnabled ? "Выключить звук" : "Включить звук"}
                className="pc-btn h-7 w-7 flex items-center justify-center shrink-0 cursor-pointer hidden xs:flex sm:flex"
              >
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>

              <button
                type="button"
                onClick={onOpenSetup}
                title="Настройки матча и рабочий стол"
                aria-label="Настройки матча"
                className="pc-btn h-7 w-7 flex items-center justify-center shrink-0 cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Momentum & Mentality Strip */}
          <div className="mt-1 flex items-center justify-between gap-2 pointer-events-none">
            <div className="pointer-events-auto pc-window px-2 py-0.5 flex items-center gap-1.5 sm:gap-2">
              <div className="flex items-center gap-1">
                <Flame
                  className={`w-3.5 h-3.5 shrink-0 ${
                    superDriveReady ? "text-amber-600 animate-pulse" : "text-orange-700"
                  }`}
                />
                <span className="text-[11px] font-bold text-black whitespace-nowrap">
                  {superDriveReady ? "СУПЕР-ДРАЙВ!" : "Импульс"}
                </span>
              </div>
              <div className="w-16 sm:w-28 h-3 pc-field p-[1px] flex items-center">
                <div
                  className={`h-full transition-all duration-300 ${
                    superDriveReady ? "bg-amber-500" : "win95-progress-fill"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, momentum))}%` }}
                />
              </div>
              <span className="font-mono text-[11px] font-bold tabular-nums text-black">
                {comboStreak > 1 ? `x${comboStreak}` : `${momentum}%`}
              </span>
            </div>

            <div className="flex items-center gap-1.5 pointer-events-auto">
              {!isSpectating && (
                <div className="pc-window p-0.5 flex items-center gap-0.5">
                  {(
                    [
                      { id: "defend", label: "Защита", icon: Shield },
                      { id: "balance", label: "Баланс", icon: Zap },
                      { id: "attack", label: "Атака", icon: Swords },
                    ] as const
                  ).map((m) => {
                    const Icon = m.icon;
                    const active = mentality === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onChangeMentality(m.id)}
                        title={`Тактика команды: ${m.label}`}
                        className={`h-6 px-1.5 text-[10px] font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                          active ? "pc-btn-active" : "pc-btn"
                        }`}
                      >
                        <Icon className="w-3 h-3 shrink-0" />
                        <span className="hidden md:inline">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {gameMode === "ai" && !isSpectating && aiEngine === "groq" && (
                <div
                  title={aiAgentBadge || "Groq LLM выбирает тактику и ходы ИИ-агента"}
                  className="pc-window h-7 px-2 text-[10px] font-bold flex items-center gap-1 text-[#000080] whitespace-nowrap"
                >
                  <Bot className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span className="hidden sm:inline">Groq ИИ</span>
                  {aiAgentBadge && (
                    <span className="hidden md:inline font-mono text-[10px] text-emerald-800">
                      · {aiAgentBadge}
                    </span>
                  )}
                </div>
              )}

              {(gameMode === "ai" || (isSpectating && !serverMatch)) && (
                <button
                  type="button"
                  onClick={onToggleAIPace}
                  title="Скорость ходов ИИ"
                  className={`pc-window h-7 px-2 text-[10px] font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                    aiPace === "fast" ? "pc-btn-active" : "pc-btn"
                  }`}
                >
                  <FastForward className="w-3 h-3 shrink-0" />
                  <span>{isSpectating ? "Темп" : "ИИ"} {aiPace === "fast" ? "2×" : "1×"}</span>
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      {/* FLOATING BROADCAST BANNER */}
      {phase !== "TITLE_MENU" && broadcastBanner && (
        <div className="fixed top-[74px] sm:top-[82px] left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div
            className={`pc-window px-3 py-1 font-display text-xs sm:text-sm font-bold tracking-wide whitespace-nowrap ${
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

      {/* DESKTOP BOTTOM-LEFT RETRO COMMENTATOR WINDOW (z-20 so popup windows cover it cleanly) */}
      {phase !== "TITLE_MENU" && (
        <aside
          className="hidden sm:block fixed bottom-2 left-2 z-20 w-[345px] pointer-events-auto"
          aria-label="Комментатор матча"
        >
          <div className="pc-window p-[3px]">
            <div className="pc-titlebar px-2 py-0.5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setCommentaryExpanded((v) => !v)}
                className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span className="font-display text-xs font-bold whitespace-nowrap">
                  RADIO_SPORT.EXE
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
                  aria-label="Озвучка комментатора"
                  className={`w-[18px] h-[16px] flex items-center justify-center cursor-pointer ${
                    ttsEnabled ? "pc-btn-primary" : "pc-btn"
                  }`}
                >
                  <Speech className="w-2.5 h-2.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCommentaryExpanded((v) => !v)}
                  aria-label="Свернуть комментатора"
                  className="pc-btn w-[18px] h-[16px] flex items-center justify-center cursor-pointer"
                >
                  {commentaryExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronUp className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>

            {commentaryExpanded && latestCommentary && (
              <div className="pc-inset-dark p-2 mt-1 space-y-1">
                <p className="text-xs leading-snug text-emerald-300">
                  &gt; {latestCommentary.text}
                </p>
                {commentaryLog.length > 1 && (
                  <p className="text-[11px] leading-snug text-slate-400 line-clamp-1">
                    {commentaryLog[1].text}
                  </p>
                )}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* DESKTOP BOTTOM-RIGHT PIECE, QUICK SWITCHER, QUICK ACTIONS (z-20) */}
      {phase === "PLAYING" && !isSpectating && (
        <div className="fixed bottom-2 right-2 z-20 max-w-[445px] pointer-events-none hidden sm:block">
          <div className="pointer-events-auto pc-window p-2.5 space-y-2">
            {isHumanTurn && quickSwitchPlayers.length > 0 && (
              <div className="flex items-center gap-1 pb-1.5 border-b border-[#808080]">
                <span className="text-[10px] font-bold text-black whitespace-nowrap mr-0.5">
                  Состав:
                </span>
                {quickSwitchPlayers.map((pl) => {
                  const isSel = selectedPlayer?.id === pl.id;
                  const hasBall = ballCarrierId === pl.id;
                  const stam = pl.stamina ?? 100;
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => onSelectQuickPlayer(pl.id)}
                      title={`${ROLE_META[pl.role].name} #${pl.number} · Силы ${stam}%`}
                      className={`h-6 px-1.5 text-[10px] font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                        isSel ? "pc-btn-active" : "pc-btn"
                      }`}
                    >
                      <span>
                        {ROLE_META[pl.role].code}#{pl.number}
                      </span>
                      {hasBall && <span className="text-amber-300 font-black">●</span>}
                      <span
                        className={`font-mono tabular-nums ${
                          isSel
                            ? stam < 30
                              ? "text-red-300"
                              : "text-emerald-300"
                            : stam < 30
                            ? "text-red-700"
                            : "text-slate-700"
                        }`}
                      >
                        {stam}%
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={onCyclePlayer}
                  title="Следующий игрок (Tab)"
                  className="pc-btn h-6 w-6 flex items-center justify-center shrink-0 cursor-pointer ml-auto"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
            )}

            {selectedPlayer ? (
              <div className="flex items-start gap-2.5">
                <div
                  className={`w-8 h-8 border-2 border-black flex items-center justify-center shrink-0 ${
                    selectedPlayer.team === "blue" ? "bg-[#000080] text-white" : "bg-red-700 text-white"
                  }`}
                >
                  <ChessPieceIcon role={selectedPlayer.role} className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 text-xs font-bold text-black">
                    <span className="truncate">
                      {ROLE_META[selectedPlayer.role].name} #{selectedPlayer.number} ·{" "}
                      <span className="text-[#000080]">
                        {ROLE_META[selectedPlayer.role].rangeLabel}
                      </span>
                    </span>
                    <span
                      className={`font-mono text-[10px] tabular-nums shrink-0 ${
                        (selectedPlayer.stamina ?? 100) < 30 ? "text-red-700" : "text-emerald-800"
                      }`}
                    >
                      Силы {selectedPlayer.stamina ?? 100}%
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-900">
                    {(selectedPlayer.stamina ?? 100) < 30
                      ? "Устал (-1 к бегу): отдайте пас или смените игрока для отдыха!"
                      : selectedHasBall
                      ? superDriveReady && canQuickShot
                        ? "СУПЕР-ДРАЙВ: бейте по воротам — удар снизит сложность дуэли!"
                        : "С мячом: зелёный = ход, жёлтый = пас, оранжевый = стык, ворота = удар."
                      : ROLE_META[selectedPlayer.role].moveSummary}
                  </p>
                </div>
              </div>
            ) : (
              showCoachHint &&
              coachHint && (
                <div className="flex items-start gap-2 text-xs text-black">
                  <Lightbulb className="w-4 h-4 text-[#000080] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Совет тренера: </span>
                    <span>{coachHint.reason}</span>
                  </div>
                </div>
              )
            )}

            {currentTurn === "blue" && (canQuickPass || canQuickShot || canAutoMove) && (
              <div className="pt-1.5 border-t border-[#808080] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[10px] text-slate-800 font-bold">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 bg-emerald-500 border border-black inline-block" />
                    Ход
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 bg-amber-400 border border-black inline-block" />
                    Пас
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 bg-orange-500 border border-black inline-block" />
                    Стык
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {canQuickShot && (
                    <button
                      type="button"
                      onClick={onQuickShot}
                      className="pc-btn-primary h-7 px-2.5 text-[11px] font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <Target className="w-3 h-3" />
                      <span>{superDriveReady ? "Супер-удар!" : "Удар!"}</span>
                    </button>
                  )}
                  {canQuickPass && (
                    <button
                      type="button"
                      onClick={onQuickPass}
                      className="pc-btn h-7 px-2.5 text-[11px] font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <Send className="w-3 h-3 text-amber-700" />
                      <span>Быстрый пас</span>
                    </button>
                  )}
                  {canAutoMove && (
                    <button
                      type="button"
                      onClick={onAutoMove}
                      title="Выполнить лучший ход (Пробел)"
                      className="pc-btn h-7 px-2.5 text-[11px] font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <Zap className="w-3 h-3 text-[#000080]" />
                      <span>Лучший ход</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DESKTOP SPECTATOR CONTROL PANEL (z-20) */}
      {phase === "PLAYING" && isSpectating && (
        <div className="fixed bottom-2 right-2 z-20 pointer-events-auto hidden sm:block">
          <div className="pc-window p-[3px] w-80">
            <div className="pc-titlebar px-2 py-0.5 flex items-center justify-between gap-2">
              <span className="font-display text-xs font-bold flex items-center gap-1.5 truncate">
                <Eye className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="truncate">
                  {serverMatch ? `LIVE TV · ${serverMatch.viewers} зрит.` : "BLITZ_TV_LIVE.EXE"}
                </span>
              </span>
              <Win95CaptionButtons onClose={onExitSpectate} closeLabel="Выйти из эфира" />
            </div>

            <div className="p-2.5 space-y-2 text-xs text-black">
              {serverMatch ? (
                <>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-bold text-[#000080] truncate">
                      {serverMatch.roomName}
                    </span>
                    {liveMatches.length > 1 && onSwitchSpectateMatch && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const idx = liveMatches.findIndex((m) => m.id === serverMatch.id);
                            const prevIdx =
                              idx <= 0 ? liveMatches.length - 1 : idx - 1;
                            onSwitchSpectateMatch(liveMatches[prevIdx]);
                          }}
                          title="Предыдущая трансляция"
                          className="pc-btn w-5 h-5 flex items-center justify-center cursor-pointer"
                        >
                          <ChevronLeft className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const idx = liveMatches.findIndex((m) => m.id === serverMatch.id);
                            const nextIdx = (idx + 1) % liveMatches.length;
                            onSwitchSpectateMatch(liveMatches[nextIdx]);
                          }}
                          title="Следующая трансляция"
                          className="pc-btn w-5 h-5 flex items-center justify-center cursor-pointer"
                        >
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Live Possession & Match Telemetry */}
                  {(() => {
                    const t = serverMatch.telemetry;
                    const tot = Math.max(1, t.blueTurns + t.redTurns);
                    const bluePct = Math.round((t.blueTurns / tot) * 100);
                    return (
                      <div className="pc-inset-dark p-2 space-y-1.5 text-[10px] text-slate-200">
                        <div className="flex justify-between font-bold">
                          <span className="text-sky-300">Владение {bluePct}%</span>
                          <span className="text-red-300">{100 - bluePct}%</span>
                        </div>
                        <div className="w-full h-2 bg-red-700 flex overflow-hidden border border-black">
                          <div
                            className="bg-sky-500 h-full transition-all duration-300"
                            style={{ width: `${bluePct}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-1 pt-0.5 text-center font-mono">
                          <div>
                            <div className="text-slate-400">Пасы</div>
                            <div className="text-amber-300 font-bold">
                              {t.passesBlue}:{t.passesRed}
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-400">Удары</div>
                            <div className="text-emerald-300 font-bold">
                              {t.shotsBlue}:{t.shotsRed}
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-400">Блиц</div>
                            <div className="text-sky-300 font-bold">
                              {t.blitzBlueWon}:{t.blitzRedWon}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Spectator Cheer Reactions */}
                  {onSendSpectateReaction && (
                    <div className="flex items-center gap-1">
                      {["🔥 Жарко!", "👏 Класс!", "⚽ Гол!"].map((reactText) => (
                        <button
                          key={reactText}
                          type="button"
                          onClick={() => onSendSpectateReaction(reactText)}
                          className="pc-btn flex-1 py-1 text-[10px] font-bold cursor-pointer whitespace-nowrap"
                        >
                          {reactText}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[11px] leading-snug">
                  Прямая трансляция локального ИИ-Дерби. Вы можете ускорить темп или переключиться на серверные матчи в Лобби.
                </p>
              )}

              <div className="flex items-center gap-1.5">
                {!serverMatch && (
                  <button
                    type="button"
                    onClick={onToggleAIPace}
                    className={`flex-1 py-1 text-[11px] font-bold cursor-pointer ${
                      aiPace === "fast" ? "pc-btn-active" : "pc-btn"
                    }`}
                  >
                    Скорость: {aiPace === "fast" ? "2× Быстро" : "1× Обычная"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOpenWindow("lobby")}
                  className="pc-btn flex-1 py-1 text-[11px] font-bold cursor-pointer"
                >
                  Каналы ({liveMatches.length})
                </button>
                <button
                  type="button"
                  onClick={onExitSpectate}
                  className="pc-btn py-1 px-3 text-[11px] font-bold text-red-800 cursor-pointer"
                >
                  Выйти
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM THUMB CONTROL DOCK (< sm, z-20) */}
      {phase === "PLAYING" && (
        <div className="sm:hidden fixed bottom-1 left-1 right-1 z-20 space-y-1 pointer-events-none">
          {commentaryExpanded && latestCommentary && (
            <div className="pointer-events-auto pc-window p-[2px]">
              <div className="pc-inset-dark px-2 py-1 flex items-start justify-between gap-2">
                <p className="text-[11px] leading-snug text-emerald-300">
                  &gt; {latestCommentary.text}
                </p>
                <button
                  type="button"
                  onClick={() => setCommentaryExpanded(false)}
                  aria-label="Скрыть комментатора"
                  className="pc-btn w-5 h-5 flex items-center justify-center shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {isSpectating ? (
            <div className="pointer-events-auto pc-window p-1.5 flex items-center justify-between gap-1.5">
              <div className="text-[11px] font-bold text-black flex items-center gap-1.5 truncate">
                <Eye className="w-3.5 h-3.5 text-red-700 shrink-0" />
                <span className="truncate">
                  {serverMatch ? `${serverMatch.roomName} (${serverMatch.viewers})` : "LIVE Эфир"}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {serverMatch && onSendSpectateReaction && (
                  <button
                    type="button"
                    onClick={() => onSendSpectateReaction("🔥 Жарко!")}
                    className="pc-btn h-7 px-2 text-[10px] font-bold"
                  >
                    🔥
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCommentaryExpanded((v) => !v)}
                  className={`h-7 px-2 text-[10px] font-bold ${
                    commentaryExpanded ? "pc-btn-active" : "pc-btn"
                  }`}
                >
                  Эфир
                </button>
                <button
                  type="button"
                  onClick={onExitSpectate}
                  className="pc-btn h-7 px-2.5 text-[10px] font-bold text-red-800"
                >
                  Выйти
                </button>
              </div>
            </div>
          ) : (
            <div className="pointer-events-auto pc-window p-1.5 space-y-1">
              {isHumanTurn && quickSwitchPlayers.length > 0 && (
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                  {quickSwitchPlayers.map((pl) => {
                    const isSel = selectedPlayer?.id === pl.id;
                    const hasBall = ballCarrierId === pl.id;
                    const stam = pl.stamina ?? 100;
                    return (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => onSelectQuickPlayer(pl.id)}
                        className={`h-6 px-1.5 text-[10px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 ${
                          isSel ? "pc-btn-active" : "pc-btn"
                        }`}
                      >
                        <span>
                          {ROLE_META[pl.role].code}#{pl.number}
                        </span>
                        {hasBall && <span className="text-amber-300">●</span>}
                        <span
                          className={`font-mono tabular-nums ${
                            isSel ? "text-emerald-300" : stam < 30 ? "text-red-700" : "text-slate-700"
                          }`}
                        >
                          {stam}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 text-[11px] text-black">
                <span className="font-bold truncate">{mobileGuideText}</span>
                <button
                  type="button"
                  onClick={() => setCommentaryExpanded((v) => !v)}
                  className={`h-6 px-1.5 text-[10px] font-bold flex items-center gap-1 shrink-0 ${
                    commentaryExpanded ? "pc-btn-active" : "pc-btn"
                  }`}
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>Эфир</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  disabled={!canQuickShot}
                  onClick={onQuickShot}
                  className={`h-8 text-xs font-bold flex items-center justify-center gap-1 ${
                    canQuickShot ? "pc-btn-primary" : "pc-inset text-slate-500 cursor-not-allowed"
                  }`}
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>{superDriveReady ? "Супер!" : "Удар!"}</span>
                </button>
                <button
                  type="button"
                  disabled={!canQuickPass}
                  onClick={onQuickPass}
                  className={`h-8 text-xs font-bold flex items-center justify-center gap-1 ${
                    canQuickPass ? "pc-btn" : "pc-inset text-slate-500 cursor-not-allowed"
                  }`}
                >
                  <Send className="w-3.5 h-3.5 text-amber-700" />
                  <span>Пас</span>
                </button>
                <button
                  type="button"
                  disabled={!canAutoMove}
                  onClick={onAutoMove}
                  className={`h-8 text-xs font-bold flex items-center justify-center gap-1 ${
                    canAutoMove ? "pc-btn" : "pc-inset text-slate-500 cursor-not-allowed"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-[#000080]" />
                  <span>Лучший ход</span>
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
              <span className="font-display text-xs font-bold">GOAL_EVENT.EXE</span>
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
          WINDOWS 95 DESKTOP ENVIRONMENT (z-10 Icons STRICTLY UNDER z-30+ Windows!)
          ==================================================================== */}
      {phase === "TITLE_MENU" && (
        <>
          {/* Win95 Teal Desktop + Icons Layer (strictly z-10, NEVER above any open window!) */}
          <div className="fixed inset-0 z-10 win95-desktop pb-10 p-3 select-none overflow-hidden">
            <div className="grid grid-cols-2 sm:flex sm:flex-col gap-3 w-fit">
              {[
                {
                  label: "Новая игра.exe",
                  icon: Play,
                  bg: "bg-emerald-700",
                  onClick: () => onOpenWindow("setup"),
                },
                {
                  label: "Мой клуб.exe",
                  icon: User,
                  bg: "bg-[#000080]",
                  onClick: () => onOpenWindow("profile"),
                },
                {
                  label: "Команда.exe",
                  icon: SlidersHorizontal,
                  bg: "bg-teal-800",
                  onClick: () => onOpenWindow("squad"),
                },
                {
                  label: "Лобби & Эфир",
                  icon: Globe,
                  bg: "bg-sky-700",
                  onClick: () => onOpenWindow("lobby"),
                },
                {
                  label: "Вызов QR",
                  icon: Share2,
                  bg: "bg-amber-700",
                  onClick: () => onOpenWindow("challenge"),
                },
                {
                  label: "HELP.HLP",
                  icon: BookOpen,
                  bg: "bg-slate-700",
                  onClick: () => onOpenWindow("rules"),
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

          {/* Authentic Windows 95 Bottom Taskbar on Desktop (z-50) */}
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

              {/* Taskbar Window Switcher Buttons (All open & minimized windows!) */}
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
                      className={`h-7 px-2 text-[11px] font-bold flex items-center gap-1.5 truncate max-w-[155px] shrink-0 cursor-pointer ${
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

            {/* Sunken System Tray (Fullscreen, Sound, Clock) */}
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
          STACKABLE, DRAGGABLE, RESIZABLE BLITZ SETUP WINDOW
          ==================================================================== */}
      {phase === "TITLE_MENU" && setupOpen && (
        <Win95Window
          title="BLITZ_FOOTBALL_95.EXE — Новая игра (2.5D Iso)"
          icon={<SoccerBallIcon className="w-4 h-4 shrink-0" />}
          ariaLabel="Настройка матча"
          zIndex={getWindowZ("setup")}
          isActive={activeWindowId === "setup"}
          isMinimized={minimizedWindows.includes("setup")}
          cascadeIndex={0}
          topBoundary={4}
          bottomBoundary={38}
          defaultWidth={620}
          defaultHeight={590}
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
            { text: "2.5D Изометрия" },
          ]}
        >
          <div className="p-2.5 sm:p-3.5 space-y-2.5 overflow-y-auto flex-1 text-black">
            <div className="pc-inset-dark p-2.5 sm:p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-emerald-300 leading-none">
                  Блиц-Футбол 95
                </h1>
                <span className="font-mono text-[10px] px-1.5 py-0.5 bg-[#000080] text-amber-300 border border-slate-500 truncate">
                  {userProfile.clubName}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
                Футбол 11 на 11 на изометрическом поле 32×32: фигуры ходят по шахматным правилам, а
                каждый стык или удар решается в молниеносный блиц.
              </p>
              <div className="grid grid-cols-3 gap-1.5 pt-1 text-[10px] sm:text-[11px]">
                <div className="bg-black/45 border border-slate-600 px-2 py-1 text-emerald-300">
                  <span className="font-bold block">1. Ход</span>
                  Зелёные клетки
                </div>
                <div className="bg-black/45 border border-slate-600 px-2 py-1 text-amber-300">
                  <span className="font-bold block">2. Пас</span>
                  Жёлтые партнёры
                </div>
                <div className="bg-black/45 border border-slate-600 px-2 py-1 text-orange-300">
                  <span className="font-bold block">3. Стык</span>
                  Блиц 3×3…5×5
                </div>
              </div>
            </div>

            <fieldset className="win95-groupbox space-y-2.5">
              <legend>Параметры матча</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <div className="text-[11px] font-bold text-black mb-1">Режим игры</div>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => setSetupMode("ai")}
                      className={`py-1.5 px-1.5 text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                        setupMode === "ai" ? "pc-btn-active" : "pc-btn"
                      }`}
                    >
                      Против ИИ
                    </button>
                    <button
                      type="button"
                      onClick={() => setSetupMode("local")}
                      className={`py-1.5 px-1.5 text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                        setupMode === "local" ? "pc-btn-active" : "pc-btn"
                      }`}
                    >
                      2 игрока
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenWindow("lobby")}
                      className="pc-btn py-1.5 px-1.5 text-[11px] font-bold text-[#000080] whitespace-nowrap cursor-pointer"
                    >
                      Онлайн PvP
                    </button>
                  </div>
                </div>

                {setupMode === "ai" && (
                  <div>
                    <div className="text-[11px] font-bold text-black mb-1">Сложность ИИ</div>
                    <div className="grid grid-cols-3 gap-1">
                      {(["rookie", "tactical", "pro"] as AIDifficulty[]).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setSetupDifficulty(lvl)}
                          className={`py-1.5 px-1 text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                            setupDifficulty === lvl ? "pc-btn-active" : "pc-btn"
                          }`}
                        >
                          {DIFFICULTY_LABELS[lvl]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {setupMode === "ai" && (
                <div className="pt-1 border-t border-[#808080]">
                  <div className="text-[11px] font-bold text-black mb-1">
                    Интеллект соперника (ИИ-Агент)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSetupAiEngine("groq")}
                      className={`py-1.5 px-2.5 text-left flex items-center gap-2 cursor-pointer ${
                        setupAiEngine === "groq" ? "pc-btn-active" : "pc-btn"
                      }`}
                    >
                      <Bot className="w-4 h-4 shrink-0 text-emerald-400" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">ИИ-Агент Groq (LLM)</div>
                        <div
                          className={`text-[10px] truncate ${
                            setupAiEngine === "groq" ? "text-slate-200" : "text-slate-700"
                          }`}
                        >
                          Облачный тактический анализ ходов
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSetupAiEngine("classic")}
                      className={`py-1.5 px-2.5 text-left flex items-center gap-2 cursor-pointer ${
                        setupAiEngine === "classic" ? "pc-btn-active" : "pc-btn"
                      }`}
                    >
                      <Cpu className="w-4 h-4 shrink-0 text-sky-400" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">Тактик-Движок 95</div>
                        <div
                          className={`text-[10px] truncate ${
                            setupAiEngine === "classic" ? "text-slate-200" : "text-slate-700"
                          }`}
                        >
                          Мгновенный локальный расчёт
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </fieldset>

            <fieldset className="win95-groupbox">
              <legend>Тип футбольного поля</legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {(["turf", "ice", "sand", "obstacles"] as PitchType[]).map((pt) => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => setSetupPitch(pt)}
                    className={`py-1.5 px-2 text-left cursor-pointer ${
                      setupPitch === pt ? "pc-btn-active" : "pc-btn"
                    }`}
                  >
                    <div className="text-xs font-bold truncate">{PITCH_META[pt].name}</div>
                    <div
                      className={`text-[10px] truncate ${
                        setupPitch === pt ? "text-slate-200" : "text-slate-700"
                      }`}
                    >
                      {PITCH_META[pt].subtitle}
                    </div>
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-900">{PITCH_META[setupPitch].effectDesc}</p>
            </fieldset>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <div className="text-[11px] font-bold text-black mb-1">Режим блиц-дуэлей</div>
                <select
                  value={setupBlitzPref}
                  onChange={(e) => setSetupBlitzPref(e.target.value as BlitzModePreference)}
                  className="pc-field w-full h-8 px-2 text-xs font-bold text-black focus:outline-none"
                >
                  {(Object.keys(BLITZ_PREF_LABELS) as BlitzModePreference[]).map((pref) => (
                    <option key={pref} value={pref}>
                      {BLITZ_PREF_LABELS[pref]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-[11px] font-bold text-black mb-1">Таймер блица</div>
                <div className="grid grid-cols-3 gap-1">
                  {(["turbo", "blitz", "relaxed"] as BlitzPace[]).map((pace) => (
                    <button
                      key={pace}
                      type="button"
                      onClick={() => setSetupPace(pace)}
                      className={`py-1.5 px-1 text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                        setupPace === pace ? "pc-btn-active" : "pc-btn"
                      }`}
                    >
                      {PACE_LABELS[pace]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#808080] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => onOpenWindow("profile")}
                  className="pc-btn px-2.5 py-1.5 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-[#000080]" />
                  <span>Профиль</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenWindow("challenge")}
                  className="pc-btn px-2.5 py-1.5 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-amber-800" />
                  <span>Вызов / QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenWindow("squad")}
                  className="pc-btn px-2.5 py-1.5 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Команда ({skillPoints})</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenWindow("lobby")}
                  className="pc-btn px-2.5 py-1.5 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5 text-[#000080]" />
                  <span>Лобби & Эфир</span>
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
                className="pc-btn-primary px-5 py-2 text-xs sm:text-sm font-bold whitespace-nowrap cursor-pointer ml-auto"
              >
                Запустить матч
              </button>
            </div>
          </div>
        </Win95Window>
      )}

      {/* GAME OVER DIALOG */}
      {phase === "GAME_OVER" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Итог матча"
        >
          <div className="w-full max-w-md pc-window p-[3px]">
            <div className="pc-titlebar px-2 py-1 flex items-center justify-between">
              <span className="font-display text-sm sm:text-base font-bold">
                MATCH_REPORT.TXT
              </span>
              <Win95CaptionButtons onClose={onOpenSetup} closeLabel="В главное меню" />
            </div>
            <div className="p-4 text-center space-y-3 text-black">
              <h2 className="font-display text-3xl font-bold text-black">
                {winner === "blue"
                  ? "Победа Синих!"
                  : winner === "red"
                  ? gameMode === "ai" && !isSpectating
                    ? "ИИ-Агент победил"
                    : "Победа Красных!"
                  : "Боевая ничья"}
              </h2>
              <div className="pc-inset-dark py-3 font-display text-4xl font-bold tabular-nums text-emerald-300">
                {scoreBlue} : {scoreRed}
              </div>
              {lastMatchReward && !isSpectating && (
                <div className="pc-inset px-3 py-1.5 text-xs font-bold text-[#000080] tabular-nums">
                  +{lastMatchReward.xp} XP за матч
                  {lastMatchReward.points > 0
                    ? ` · +${lastMatchReward.points} очко навыков!`
                    : ""}
                </div>
              )}
              <p className="text-xs text-slate-800">
                Ходов: {Math.min(turnCount, MAX_TURNS)} · До {TARGET_GOALS} голов ·{" "}
                {PITCH_META[pitchType].name}
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                {!isSpectating && (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpenWindow("coach")}
                      className="pc-btn px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <BrainCircuit className="w-3.5 h-3.5 text-[#000080]" />
                      <span>Разбор тренера</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenWindow("squad")}
                      className="pc-btn px-3 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer"
                    >
                      Прокачка ({skillPoints})
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={isSpectating ? onExitSpectate : onResetMatch}
                  className="pc-btn-primary px-4 py-1.5 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isSpectating ? "Назад в лобби" : "Ещё матч"}</span>
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

      {/* STACKABLE, RESIZABLE HELP WINDOW */}
      {rulesOpen && (
        <Win95Window
          title="HELP.HLP — Роли и Блиц"
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
            { text: "Справочник Блиц-Футбол 95", flex: true },
            { text: "Поле 32×32" },
          ]}
        >
          <div className="p-3.5 space-y-3 overflow-y-auto flex-1 text-black">
            <fieldset className="win95-groupbox space-y-2">
              <legend>Амплуа и шахматные ходы</legend>
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
    </>
  );
};
