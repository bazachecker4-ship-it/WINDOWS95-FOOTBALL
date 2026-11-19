import React, { useState } from "react";
import {
  AIDifficulty,
  BLITZ_VARIANT_META,
  BlitzModePreference,
  BlitzPace,
  CommentaryItem,
  GameMode,
  GamePhase,
  MAX_TURNS,
  PITCH_META,
  PitchType,
  PlayerPiece,
  ROLE_META,
  TARGET_GOALS,
  TacticalHint,
  TacticalMentality,
  Team,
} from "../types/game";
import { ChessPieceIcon, SoccerBallIcon } from "./ChessPieceIcon";
import {
  BookOpen,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  Flame,
  Lightbulb,
  MessageSquare,
  RotateCcw,
  Send,
  Settings2,
  Shield,
  SlidersHorizontal,
  Speech,
  Swords,
  Target,
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
  blitzPace: BlitzPace;
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
  onStartMatch: (
    mode: GameMode,
    difficulty: AIDifficulty,
    pace: BlitzPace,
    pitch: PitchType,
    blitzPref: BlitzModePreference
  ) => void;
  onResetMatch: () => void;
  onOpenSetup: () => void;
  onOpenSquad: () => void;
  onOpenCoach: () => void;
  onToggleSound: () => void;
  onToggleTts: () => void;
  onToggleCoachHint: () => void;
  onChangeMentality: (mentality: TacticalMentality) => void;
  onQuickPass: () => void;
  onQuickShot: () => void;
  onAutoMove: () => void;
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

export const OverlayHUD: React.FC<OverlayHUDProps> = ({
  phase,
  scoreBlue,
  scoreRed,
  turnCount,
  currentTurn,
  gameMode,
  difficulty,
  blitzPace,
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
  onStartMatch,
  onResetMatch,
  onOpenSetup,
  onOpenSquad,
  onOpenCoach,
  onToggleSound,
  onToggleTts,
  onToggleCoachHint,
  onChangeMentality,
  onQuickPass,
  onQuickShot,
  onAutoMove,
}) => {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [commentaryExpanded, setCommentaryExpanded] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 640 : true
  );
  const [setupMode, setSetupMode] = useState<GameMode>(gameMode);
  const [setupDifficulty, setSetupDifficulty] = useState<AIDifficulty>(difficulty);
  const [setupPace, setSetupPace] = useState<BlitzPace>(blitzPace);
  const [setupPitch, setSetupPitch] = useState<PitchType>(pitchType);
  const [setupBlitzPref, setSetupBlitzPref] = useState<BlitzModePreference>(blitzModePref);

  const latestCommentary = commentaryLog[0];

  const mobileGuideText =
    currentTurn !== "blue" && gameMode === "ai"
      ? "Соперник ИИ думает..."
      : selectedPlayer
      ? selectedHasBall
        ? canQuickShot
          ? `${ROLE_META[selectedPlayer.role].code}#${selectedPlayer.number}: бейте по воротам!`
          : `${ROLE_META[selectedPlayer.role].code}#${selectedPlayer.number}: ведите или пасуйте`
        : `${ROLE_META[selectedPlayer.role].code}#${selectedPlayer.number}: тапните зелёную клетку`
      : "Тапните по синему игроку или «Лучший ход»";

  return (
    <>
      {/* TOP RETRO PC TASKBAR / SCOREBOARD */}
      <header className="fixed top-1.5 sm:top-2.5 left-1/2 -translate-x-1/2 z-30 w-[min(98vw,1000px)] pointer-events-none">
        <div className="pointer-events-auto pc-window px-2 sm:px-3 py-1 sm:py-1.5 flex items-center justify-between gap-1.5 sm:gap-3">
          {/* Brand + Pitch */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-display text-base sm:text-xl font-bold tracking-tight text-[#000080] whitespace-nowrap shrink-0">
              <span className="hidden sm:inline">БЛИЦ-ФУТБОЛ 95</span>
              <span className="sm:hidden">БЛИЦ 95</span>
            </span>
            <span className="hidden lg:inline text-xs text-slate-700 whitespace-nowrap truncate">
              {PITCH_META[pitchType].name}
            </span>
          </div>

          {/* Recessed Digital Scoreboard */}
          <div className="pc-inset-dark px-3 py-1 flex items-center gap-2.5 shrink-0">
            <span
              className={`text-xs font-bold whitespace-nowrap ${
                currentTurn === "blue" ? "text-sky-300" : "text-slate-400"
              }`}
            >
              СИНИЕ
            </span>
            <span className="font-display text-lg sm:text-xl font-bold tabular-nums text-emerald-300 leading-none">
              {scoreBlue}:{scoreRed}
            </span>
            <span
              className={`text-xs font-bold whitespace-nowrap ${
                currentTurn === "red" ? "text-red-300" : "text-slate-400"
              }`}
            >
              {gameMode === "ai" ? "ИИ" : "КРАСН"}
            </span>
            <span className="hidden sm:inline text-slate-600" aria-hidden="true">
              |
            </span>
            <span className="hidden sm:inline font-mono text-xs text-amber-300 tabular-nums whitespace-nowrap">
              {Math.min(turnCount, MAX_TURNS)}/{MAX_TURNS}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onToggleCoachHint}
              title="Подсказка лучшего хода на поле"
              className={`h-8 px-2 text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                showCoachHint ? "pc-btn-active" : "pc-btn"
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Ход</span>
            </button>

            <button
              type="button"
              onClick={onOpenCoach}
              title="ИИ-Тренер: анализ стиля и советы"
              className="pc-btn h-8 px-2 text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <BrainCircuit className="w-3.5 h-3.5 shrink-0 text-[#000080]" />
              <span className="hidden sm:inline">Тренер</span>
            </button>

            <button
              type="button"
              onClick={onOpenSquad}
              title="Прокачка фигур, способности и внешний вид"
              className="pc-btn h-8 px-2 text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
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
              onClick={() => setRulesOpen(true)}
              title="Роли фигур и блиц-режимы"
              aria-label="Справочник ролей"
              className="pc-btn h-8 w-8 flex items-center justify-center shrink-0 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onToggleSound}
              title={soundEnabled ? "Выключить 8-бит звук" : "Включить 8-бит звук"}
              aria-label={soundEnabled ? "Выключить звук" : "Включить звук"}
              className="pc-btn h-8 w-8 flex items-center justify-center shrink-0 cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
            </button>

            <button
              type="button"
              onClick={onOpenSetup}
              title="Настройки матча и выбор поля"
              aria-label="Настройки матча"
              className="pc-btn h-8 w-8 flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* FIFA-style Compact Momentum & Mentality Tactical Strip */}
        {phase !== "TITLE_MENU" && (
          <div className="mt-1 flex items-center justify-between gap-2 pointer-events-none">
            <div className="pointer-events-auto pc-window px-2 py-1 flex items-center gap-1.5 sm:gap-2">
              <div className="flex items-center gap-1">
                <Flame
                  className={`w-3.5 h-3.5 shrink-0 ${
                    superDriveReady ? "text-amber-600 animate-pulse" : "text-orange-700"
                  }`}
                />
                <span className="text-[11px] font-bold text-slate-900 whitespace-nowrap">
                  {superDriveReady ? "СУПЕР-ДРАЙВ!" : "Импульс"}
                </span>
              </div>
              <div className="w-16 sm:w-28 h-3 pc-inset-dark p-0.5 flex items-center">
                <div
                  className={`h-full transition-all duration-300 ${
                    superDriveReady
                      ? "bg-amber-400"
                      : momentum >= 60
                      ? "bg-emerald-400"
                      : "bg-sky-400"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, momentum))}%` }}
                />
              </div>
              <span className="font-mono text-[11px] font-bold tabular-nums text-slate-900">
                {comboStreak > 1 ? `x${comboStreak}` : `${momentum}%`}
              </span>
            </div>

            <div className="pointer-events-auto pc-window p-0.5 flex items-center gap-0.5">
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
          </div>
        )}
      </header>

      {/* FLOATING BROADCAST BANNER (doesn't squeeze mobile bars) */}
      {phase !== "TITLE_MENU" && broadcastBanner && (
        <div className="fixed top-[82px] sm:top-[88px] left-1/2 -translate-x-1/2 z-30 pointer-events-none">
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

      {/* DESKTOP BOTTOM-LEFT RETRO COMMENTATOR WINDOW */}
      {phase !== "TITLE_MENU" && (
        <aside
          className="hidden sm:block fixed bottom-2.5 left-2.5 z-30 w-[350px] pointer-events-auto"
          aria-label="Комментатор матча"
        >
          <div className="pc-window p-1">
            <div className="pc-titlebar px-2 py-1 flex items-center justify-between gap-2">
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
                  className={`w-5 h-5 flex items-center justify-center cursor-pointer ${
                    ttsEnabled ? "pc-btn-primary" : "pc-btn"
                  }`}
                >
                  <Speech className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setCommentaryExpanded((v) => !v)}
                  aria-label="Свернуть комментатора"
                  className="pc-btn w-5 h-5 flex items-center justify-center cursor-pointer"
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

      {/* DESKTOP BOTTOM-RIGHT PIECE, QUICK ACTIONS & COLOR LEGEND */}
      {phase === "PLAYING" && (selectedPlayer || (showCoachHint && coachHint) || canAutoMove) && (
        <div className="fixed bottom-2.5 right-2.5 z-30 max-w-[420px] pointer-events-none hidden sm:block">
          <div className="pointer-events-auto pc-window p-2.5 space-y-2">
            {selectedPlayer ? (
              <div className="flex items-start gap-2.5">
                <div
                  className={`w-8 h-8 border-2 border-black flex items-center justify-center shrink-0 ${
                    selectedPlayer.team === "blue" ? "bg-blue-700 text-white" : "bg-red-700 text-white"
                  }`}
                >
                  <ChessPieceIcon role={selectedPlayer.role} className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-950">
                    {ROLE_META[selectedPlayer.role].name} ({ROLE_META[selectedPlayer.role].chessName}) ·{" "}
                    <span className="text-[#000080]">
                      {ROLE_META[selectedPlayer.role].rangeLabel}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-800">
                    {selectedHasBall
                      ? "С мячом: зелёный = ход, жёлтый = пас, оранжевый = блиц-стык, ворота = удар."
                      : ROLE_META[selectedPlayer.role].moveSummary}
                  </p>
                </div>
              </div>
            ) : (
              showCoachHint &&
              coachHint && (
                <div className="flex items-start gap-2 text-xs text-slate-900">
                  <Lightbulb className="w-4 h-4 text-[#000080] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Совет тренера: </span>
                    <span>{coachHint.reason}</span>
                  </div>
                </div>
              )
            )}

            {/* 1-Tap Quick Action Controls */}
            {currentTurn === "blue" && (canQuickPass || canQuickShot || canAutoMove) && (
              <div className="pt-1.5 border-t border-slate-400 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[10px] text-slate-700 font-medium">
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
                      <span>Удар!</span>
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

      {/* MOBILE BOTTOM THUMB CONTROL DOCK (< sm) */}
      {phase === "PLAYING" && (
        <div className="sm:hidden fixed bottom-1.5 left-1.5 right-1.5 z-30 space-y-1 pointer-events-none">
          {commentaryExpanded && latestCommentary && (
            <div className="pointer-events-auto pc-window p-1">
              <div className="pc-inset-dark px-2 py-1.5 flex items-start justify-between gap-2">
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

          <div className="pointer-events-auto pc-window p-1.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-900">
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
                className={`h-9 text-xs font-bold flex items-center justify-center gap-1 ${
                  canQuickShot ? "pc-btn-primary" : "pc-inset text-slate-500 cursor-not-allowed"
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>Удар!</span>
              </button>
              <button
                type="button"
                disabled={!canQuickPass}
                onClick={onQuickPass}
                className={`h-9 text-xs font-bold flex items-center justify-center gap-1 ${
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
                className={`h-9 text-xs font-bold flex items-center justify-center gap-1 ${
                  canAutoMove ? "pc-btn" : "pc-inset text-slate-500 cursor-not-allowed"
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-[#000080]" />
                <span>Лучший ход</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GOAL CELEBRATION BANNER */}
      {phase === "GOAL_CELEBRATION" && goalBanner && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="pc-window p-1">
            <div className="pc-titlebar px-3 py-1 font-display text-xs font-bold">
              GOAL_EVENT.EXE
            </div>
            <div className="pc-inset-dark px-8 py-5 text-center">
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

      {/* TITLE / MATCH SETUP DIALOG */}
      {phase === "TITLE_MENU" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Настройка матча"
        >
          <div className="w-full max-w-xl max-h-[92dvh] overflow-y-auto pc-window p-1">
            <div className="pc-titlebar px-3 py-1.5 flex items-center justify-between gap-3">
              <span className="font-display text-base font-bold tracking-wide">
                BLITZ_FOOTBALL_95.EXE — Новая игра (PixiJS)
              </span>
              <SoccerBallIcon className="w-4 h-4 shrink-0" />
            </div>

            <div className="p-3 sm:p-4 space-y-3">
              <div className="pc-inset-dark p-3 space-y-2">
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-emerald-300 leading-none">
                  Блиц-Футбол 95
                </h1>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Футбол 11 на 11 на поле 32×32: фигуры ходят по шахматным правилам, а каждый стык
                  или удар решается в молниеносный блиц.
                </p>
                <div className="grid grid-cols-3 gap-1.5 pt-1 text-[10px] sm:text-[11px]">
                  <div className="bg-black/35 border border-slate-700 px-2 py-1 text-emerald-300">
                    <span className="font-bold block">1. Ход</span>
                    Зелёные клетки
                  </div>
                  <div className="bg-black/35 border border-slate-700 px-2 py-1 text-amber-300">
                    <span className="font-bold block">2. Пас</span>
                    Жёлтые партнёры
                  </div>
                  <div className="bg-black/35 border border-slate-700 px-2 py-1 text-orange-300">
                    <span className="font-bold block">3. Стык</span>
                    Блиц 3×3…5×5
                  </div>
                </div>
              </div>

              {/* Game Mode + Difficulty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-900 mb-1">Режим игры</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSetupMode("ai")}
                      className={`py-1.5 px-2 text-xs font-bold whitespace-nowrap cursor-pointer ${
                        setupMode === "ai" ? "pc-btn-active" : "pc-btn"
                      }`}
                    >
                      Против ИИ
                    </button>
                    <button
                      type="button"
                      onClick={() => setSetupMode("local")}
                      className={`py-1.5 px-2 text-xs font-bold whitespace-nowrap cursor-pointer ${
                        setupMode === "local" ? "pc-btn-active" : "pc-btn"
                      }`}
                    >
                      2 игрока
                    </button>
                  </div>
                </div>

                {setupMode === "ai" && (
                  <div>
                    <div className="text-xs font-bold text-slate-900 mb-1">Сложность ИИ</div>
                    <div className="grid grid-cols-3 gap-1">
                      {(["rookie", "tactical", "pro"] as AIDifficulty[]).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setSetupDifficulty(lvl)}
                          className={`py-1.5 px-1.5 text-xs font-bold whitespace-nowrap cursor-pointer ${
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

              {/* Pitch Type */}
              <div>
                <div className="text-xs font-bold text-slate-900 mb-1">Тип футбольного поля</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(["turf", "ice", "sand", "obstacles"] as PitchType[]).map((pt) => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setSetupPitch(pt)}
                      className={`py-2 px-2 text-left cursor-pointer ${
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
                <p className="mt-1.5 text-[11px] text-slate-800">{PITCH_META[setupPitch].effectDesc}</p>
              </div>

              {/* Blitz Variation + Pace */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-900 mb-1">Режим блиц-дуэлей</div>
                  <select
                    value={setupBlitzPref}
                    onChange={(e) => setSetupBlitzPref(e.target.value as BlitzModePreference)}
                    className="pc-inset w-full h-8 px-2 text-xs font-bold text-slate-950 focus:outline-none"
                  >
                    {(Object.keys(BLITZ_PREF_LABELS) as BlitzModePreference[]).map((pref) => (
                      <option key={pref} value={pref}>
                        {BLITZ_PREF_LABELS[pref]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-900 mb-1">Таймер блица</div>
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

              <div className="pt-2 border-t border-slate-400 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onOpenSquad}
                    className="pc-btn px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-800" />
                    <span>Команда ({skillPoints})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRulesOpen(true)}
                    className="pc-btn px-3 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer"
                  >
                    Справка
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onStartMatch(setupMode, setupDifficulty, setupPace, setupPitch, setupBlitzPref)
                  }
                  className="pc-btn-primary px-5 py-2 text-xs sm:text-sm font-bold whitespace-nowrap cursor-pointer"
                >
                  Запустить матч
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER DIALOG */}
      {phase === "GAME_OVER" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Итог матча"
        >
          <div className="w-full max-w-md pc-window p-1">
            <div className="pc-titlebar px-3 py-1.5 font-display text-base font-bold">
              MATCH_REPORT.TXT
            </div>
            <div className="p-5 text-center space-y-3">
              <h2 className="font-display text-3xl font-bold text-slate-950">
                {winner === "blue"
                  ? "Победа Синих!"
                  : winner === "red"
                  ? gameMode === "ai"
                    ? "ИИ-Агент победил"
                    : "Победа Красных!"
                  : "Боевая ничья"}
              </h2>
              <div className="pc-inset-dark py-3 font-display text-4xl font-bold tabular-nums text-emerald-300">
                {scoreBlue} : {scoreRed}
              </div>
              {lastMatchReward && (
                <div className="text-xs font-bold text-blue-900 tabular-nums">
                  +{lastMatchReward.xp} XP за матч
                  {lastMatchReward.points > 0
                    ? ` · +${lastMatchReward.points} очко навыков!`
                    : ""}
                </div>
              )}
              <p className="text-xs text-slate-700">
                Ходов: {Math.min(turnCount, MAX_TURNS)} · До {TARGET_GOALS} голов ·{" "}
                {PITCH_META[pitchType].name}
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={onOpenCoach}
                  className="pc-btn px-3 py-2 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <BrainCircuit className="w-3.5 h-3.5 text-[#000080]" />
                  <span>Разбор тренера</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenSquad}
                  className="pc-btn px-3 py-2 text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  Прокачка ({skillPoints})
                </button>
                <button
                  type="button"
                  onClick={onResetMatch}
                  className="pc-btn-primary px-4 py-2 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Ещё матч</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RULES & ROLES REFERENCE DIALOG */}
      {rulesOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Справочник ролей и правил"
        >
          <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto pc-window p-1">
            <div className="pc-titlebar px-3 py-1.5 flex items-center justify-between gap-4">
              <span className="font-display text-base font-bold">HELP.HLP — Роли и Блиц</span>
              <button
                type="button"
                onClick={() => setRulesOpen(false)}
                aria-label="Закрыть правила"
                className="pc-btn w-6 h-6 flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="space-y-2">
                {(["GK", "DEF", "MID", "WNG", "FWD"] as const).map((role) => {
                  const meta = ROLE_META[role];
                  return (
                    <div key={role} className="pc-inset p-2.5 flex items-start gap-2.5">
                      <div className="w-7 h-7 bg-blue-700 border border-black flex items-center justify-center shrink-0 mt-0.5">
                        <ChessPieceIcon role={role} className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-950">
                          {meta.code} · {meta.name} ({meta.chessName})
                        </div>
                        <p className="text-[11px] text-slate-800 mt-0.5 leading-snug">
                          {meta.moveSummary}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

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
          </div>
        </div>
      )}
    </>
  );
};
