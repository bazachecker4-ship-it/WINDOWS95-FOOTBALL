import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AIDifficulty,
  ActiveBlitzDuel,
  BLITZ_PACE_MS,
  BlitzPace,
  GameMode,
  PlayerPiece,
  ROLE_META,
  ServerDuelState,
  Team,
} from "../types/game";
import { BlitzCell, checkBlitzWinner, chooseBlitzAIMove, generateWinLines } from "../engine/blitzAi";
import { ChessPieceIcon, SoccerBallIcon } from "./ChessPieceIcon";
import { soundFX } from "../utils/sound";
import { Globe, ShieldAlert } from "lucide-react";

interface BlitzDuelModalProps {
  duel: ActiveBlitzDuel;
  players: PlayerPiece[];
  gameMode: GameMode;
  difficulty: AIDifficulty;
  blitzPace: BlitzPace;
  isSpectator?: boolean;
  localTeam?: Team;
  serverDuelState?: ServerDuelState | null;
  onServerMark?: (cellIdx: number) => void;
  onResolve: (winnerTeam: Team | "draw", outcomeText: string, wasTimeout: boolean) => void;
}

export const BlitzDuelModal: React.FC<BlitzDuelModalProps> = ({
  duel,
  players,
  gameMode,
  difficulty,
  blitzPace,
  isSpectator = false,
  localTeam = "blue",
  serverDuelState = null,
  onServerMark,
  onResolve,
}) => {
  const isServerDriven = Boolean(serverDuelState);

  const {
    size,
    winLength,
    variant,
    variantName,
    variantDesc,
    blockedCells,
    maxMarksPerPlayer,
    reasons,
  } = duel.complexity;

  const totalCells = size * size;
  const baseTimeLimitMs = BLITZ_PACE_MS[blitzPace];

  const initiator = useMemo(
    () => players.find((p) => p.id === duel.initiatorId)!,
    [players, duel.initiatorId]
  );
  const defender = useMemo(
    () => players.find((p) => p.id === duel.defenderId)!,
    [players, duel.defenderId]
  );

  const lines = useMemo(() => generateWinLines(size, winLength), [size, winLength]);

  const [localBoard, setLocalBoard] = useState<BlitzCell[]>(() => {
    const arr: BlitzCell[] = Array(totalCells).fill(null);
    for (const bIdx of blockedCells) {
      if (bIdx >= 0 && bIdx < totalCells) arr[bIdx] = "BLOCKED";
    }
    return arr;
  });

  const [localTurnMark, setLocalTurnMark] = useState<"X" | "O">("X");
  const [localXQueue, setLocalXQueue] = useState<number[]>([]);
  const [localOQueue, setLocalOQueue] = useState<number[]>([]);
  const [localWinningLine, setLocalWinningLine] = useState<number[]>([]);
  const [localDuelStatus, setLocalDuelStatus] = useState<{
    finished: boolean;
    winnerTeam: Team | "draw" | null;
    message: string;
  }>({ finished: false, winnerTeam: null, message: "" });

  const board = serverDuelState ? serverDuelState.board : localBoard;
  const turnMark = serverDuelState ? serverDuelState.turnMark : localTurnMark;
  const xQueue = serverDuelState ? serverDuelState.xQueue : localXQueue;
  const oQueue = serverDuelState ? serverDuelState.oQueue : localOQueue;
  const winningLine = serverDuelState ? serverDuelState.winningLine : localWinningLine;
  const duelStatus = serverDuelState
    ? {
        finished: serverDuelState.finished,
        winnerTeam: serverDuelState.winnerTeam,
        message: serverDuelState.statusMessage,
      }
    : localDuelStatus;

  const getTurnTimeLimit = (mark: "X" | "O"): number | null => {
    if (baseTimeLimitMs === null) return null;
    const team = mark === "X" ? initiator.team : defender.team;
    const bonus = team === "blue" ? duel.bonusTimeMsBlue : duel.bonusTimeMsRed;
    return baseTimeLimitMs + bonus;
  };

  const currentTurnLimitMs = getTurnTimeLimit(turnMark);
  const [timeLeftMs, setTimeLeftMs] = useState<number>(currentTurnLimitMs ?? 0);

  const resolvedRef = useRef(false);
  const stateRef = useRef({ board: localBoard, xQueue: localXQueue, oQueue: localOQueue });
  stateRef.current = { board: localBoard, xQueue: localXQueue, oQueue: localOQueue };

  const activeTeam: Team = turnMark === "X" ? initiator.team : defender.team;
  const isWaitingForOpponent =
    !duelStatus.finished &&
    (isSpectator ||
      (gameMode === "online" && activeTeam !== localTeam) ||
      (gameMode === "ai" && activeTeam === "red"));

  const shouldRunLocalAi =
    !isServerDriven &&
    !duelStatus.finished &&
    (isSpectator || (gameMode === "ai" && activeTeam === "red"));

  // Sound FX feedback when server duel transitions to finished
  const prevServerFinishedRef = useRef(false);
  useEffect(() => {
    if (!serverDuelState) return;
    if (serverDuelState.finished && !prevServerFinishedRef.current) {
      prevServerFinishedRef.current = true;
      if (serverDuelState.winnerTeam === localTeam) soundFX.playBlitzWin(true);
      else if (serverDuelState.winnerTeam && serverDuelState.winnerTeam !== "draw") {
        soundFX.playBlitzWin(false);
      }
    }
  }, [serverDuelState, localTeam]);

  const finishLocalDuel = (
    winnerTeam: Team | "draw",
    line: number[],
    message: string,
    wasTimeout = false
  ) => {
    if (isServerDriven || resolvedRef.current) return;
    resolvedRef.current = true;
    setLocalWinningLine(line);
    setLocalDuelStatus({ finished: true, winnerTeam, message });

    if (winnerTeam === "blue") soundFX.playBlitzWin(true);
    else if (winnerTeam === "red") soundFX.playBlitzWin(false);

    window.setTimeout(() => {
      onResolve(winnerTeam, message, wasTimeout);
    }, 950);
  };

  const applyMark = (cellIdx: number, mark: "X" | "O") => {
    if (isServerDriven) {
      if (isWaitingForOpponent || duelStatus.finished) return;
      if (board[cellIdx] !== null) return;
      soundFX.playBlitzMark(localTeam === "blue");
      onServerMark?.(cellIdx);
      return;
    }

    if (resolvedRef.current || localDuelStatus.finished) return;
    const { board: currBoard, xQueue: currX, oQueue: currO } = stateRef.current;
    if (currBoard[cellIdx] !== null) return;

    const nextBoard = [...currBoard];
    const nextX = [...currX];
    const nextO = [...currO];
    const activeQ = mark === "X" ? nextX : nextO;

    if (maxMarksPerPlayer !== null && activeQ.length >= maxMarksPerPlayer) {
      const oldestIdx = activeQ.shift()!;
      nextBoard[oldestIdx] = null;
    }

    nextBoard[cellIdx] = mark;
    activeQ.push(cellIdx);

    setLocalBoard(nextBoard);
    setLocalXQueue(nextX);
    setLocalOQueue(nextO);

    const isBlueMark = (mark === "X" ? initiator.team : defender.team) === "blue";
    soundFX.playBlitzMark(isBlueMark);

    const res = checkBlitzWinner(nextBoard, size, winLength, lines);
    if (res.winner === "X" || res.winner === "O") {
      const winTeam = res.winner === "X" ? initiator.team : defender.team;
      const winLabel = winTeam === "blue" ? "Синие" : "Красные";
      const msg = duel.isShotDuel
        ? winTeam === initiator.team
          ? `${winLabel} пробивают вратаря!`
          : `${winLabel} совершают сейв!`
        : `${winLabel} выигрывают борьбу за мяч!`;
      finishLocalDuel(winTeam, res.line, msg, false);
    } else if (res.winner === "draw") {
      finishLocalDuel("draw", [], "Ничья в блице — мяч остаётся у владельца", false);
    } else {
      const nextMark = mark === "X" ? "O" : "X";
      setLocalTurnMark(nextMark);
      const nextLimit = getTurnTimeLimit(nextMark);
      if (nextLimit !== null) setTimeLeftMs(nextLimit);
    }
  };

  useEffect(() => {
    const limit = getTurnTimeLimit(turnMark);
    if (limit === null || duelStatus.finished) return;
    setTimeLeftMs(limit);
    const start = performance.now();
    const interval = window.setInterval(() => {
      if (resolvedRef.current) return;
      const elapsed = performance.now() - start;
      const remaining = Math.max(0, limit - elapsed);
      setTimeLeftMs(remaining);
      if (remaining <= 0) {
        window.clearInterval(interval);
        if (!isServerDriven) {
          const loserTeam = turnMark === "X" ? initiator.team : defender.team;
          const winnerTeam: Team = loserTeam === "blue" ? "red" : "blue";
          const winLabel = winnerTeam === "blue" ? "Синие" : "Красные";
          finishLocalDuel(
            winnerTeam,
            [],
            `Время вышло — ${winLabel} забирают мяч!`,
            loserTeam === "blue"
          );
        }
      }
    }, 50);

    return () => window.clearInterval(interval);
  }, [turnMark, baseTimeLimitMs, duelStatus.finished, isServerDriven]);

  useEffect(() => {
    if (!shouldRunLocalAi || resolvedRef.current) return;
    const delay = isSpectator
      ? 260
      : difficulty === "pro"
      ? 320
      : difficulty === "tactical"
      ? 420
      : 540;
    const timer = window.setTimeout(() => {
      if (resolvedRef.current) return;
      const aiMark = turnMark;
      const aiQ = aiMark === "X" ? stateRef.current.xQueue : stateRef.current.oQueue;
      const humQ = aiMark === "X" ? stateRef.current.oQueue : stateRef.current.xQueue;
      const moveIdx = chooseBlitzAIMove(
        stateRef.current.board,
        size,
        winLength,
        aiMark,
        difficulty,
        maxMarksPerPlayer,
        aiQ,
        humQ
      );
      if (moveIdx !== -1) {
        applyMark(moveIdx, aiMark);
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [
    shouldRunLocalAi,
    isSpectator,
    turnMark,
    localBoard,
    size,
    winLength,
    difficulty,
    maxMarksPerPlayer,
  ]);

  const progressPct =
    currentTurnLimitMs !== null && currentTurnLimitMs > 0
      ? Math.max(0, Math.min(100, (timeLeftMs / currentTurnLimitMs) * 100))
      : 100;

  const fadingXIdx =
    variant === "decay" && maxMarksPerPlayer && xQueue.length >= maxMarksPerPlayer ? xQueue[0] : -1;
  const fadingOIdx =
    variant === "decay" && maxMarksPerPlayer && oQueue.length >= maxMarksPerPlayer ? oQueue[0] : -1;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/22 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Блиц-дуэль за мяч"
    >
      <div className="w-full max-w-lg max-h-[94dvh] flex flex-col bg-[#0d192b]/72 border-t-2 border-l-2 border-white/65 border-r-2 border-b-2 border-black/90 shadow-[6px_6px_0px_rgba(0,0,0,0.45)] p-[3px] text-white">
        {/* Classic Win95 Title Bar (Semi-Transparent) */}
        <div className="bg-gradient-to-r from-[#000080]/88 via-[#0d62b3]/88 to-[#1084d0]/88 px-2.5 py-1 flex items-center justify-between gap-3 shrink-0 border-b border-black/60">
          <span className="font-display text-sm sm:text-base font-bold tracking-wide truncate flex items-center gap-1.5 text-white drop-shadow">
            {isServerDriven && <Globe className="w-3.5 h-3.5 text-sky-300 shrink-0" />}
            <span>
              {duel.isShotDuel ? "Удар в створ! — " : "Блиц-дуэль за мяч — "}
              {variantName}
            </span>
          </span>
          {currentTurnLimitMs !== null && (
            <span
              className={`font-mono text-xs font-bold tabular-nums px-1.5 py-0.5 bg-black/55 border border-white/35 shrink-0 ${
                timeLeftMs < 1100 ? "text-red-300 animate-pulse" : "text-emerald-300"
              }`}
            >
              ⏱ {(timeLeftMs / 1000).toFixed(1)}с
            </span>
          )}
        </div>

        <div className="p-2 sm:p-3 space-y-2 bg-slate-900/48 overflow-y-auto touch-scroll">
          {/* Translucent Stadium Penalty/Duel Banner */}
          <div className="hidden min-[520px]:flex [@media(max-height:580px)]:hidden relative h-12 overflow-hidden bg-slate-950/45 border border-white/20 items-center justify-between px-2.5">
            <div className="relative z-10 bg-black/55 border border-white/30 px-2 py-0.5 text-[10px] font-bold text-slate-100 truncate">
              {variantDesc}
            </div>
            <div className="relative z-10 bg-[#000080]/75 border border-white/40 px-2 py-0.5 text-[10px] font-bold text-amber-300 hidden sm:block shrink-0">
              {reasons[0] || `${size}×${size}`}
            </div>
          </div>

          {/* Segmented Timer Bar */}
          {currentTurnLimitMs !== null && (
            <div className="bg-black/45 border border-white/25 p-[2px] h-3 w-full">
              <div
                className={`h-full transition-[width] duration-75 ${
                  timeLeftMs < 1100 ? "bg-red-500" : "bg-emerald-400"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}

          {/* Translucent Duelists */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            {[
              { piece: initiator, mark: "X" as const, roleDesc: "Атака" },
              { piece: defender, mark: "O" as const, roleDesc: "Защита" },
            ].map(({ piece, mark, roleDesc }) => {
              const isTurn = !duelStatus.finished && turnMark === mark;
              const isBlue = piece.team === "blue";
              const bonus = isBlue ? duel.bonusTimeMsBlue : duel.bonusTimeMsRed;
              const isYou = gameMode === "online" && piece.team === localTeam;
              return (
                <div
                  key={piece.id}
                  className={`p-1.5 sm:p-2 flex items-center justify-between gap-1.5 sm:gap-2 border ${
                    isTurn
                      ? "bg-[#000080]/78 border-amber-300 text-white shadow-md"
                      : "bg-slate-900/52 border-white/25 text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <div
                      className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center shrink-0 border border-black/70 ${
                        isBlue ? "bg-blue-600/85 text-white" : "bg-red-600/85 text-white"
                      }`}
                    >
                      <ChessPieceIcon role={piece.role} className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold truncate">
                        {isBlue ? "Синие" : "Красные"} · {ROLE_META[piece.role].code}
                        {isYou ? " (Вы)" : ""}
                      </div>
                      <div
                        className={`text-[10px] truncate ${
                          isTurn ? "text-amber-200 font-bold" : "text-slate-300"
                        }`}
                      >
                        {isTurn ? "▶ ХОДИТ" : roleDesc}
                        {bonus > 0 ? ` (+${(bonus / 1000).toFixed(1)}с)` : ""}
                      </div>
                    </div>
                  </div>
                  <span className="font-display text-base sm:text-lg font-bold shrink-0">{mark}</span>
                </div>
              );
            })}
          </div>

          {/* Direct Prominent Turn / Result Banner right above Grid */}
          <div
            className={`px-2.5 py-1.5 border border-white/30 flex items-center justify-between gap-2 text-xs font-bold ${
              duelStatus.finished
                ? "bg-emerald-800/80 text-white"
                : isWaitingForOpponent
                ? "bg-slate-900/65 text-slate-200"
                : "bg-[#000080]/78 text-amber-300"
            }`}
          >
            {duelStatus.finished ? (
              <div className="flex items-center gap-2 w-full justify-center">
                <SoccerBallIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">{duelStatus.message}</span>
              </div>
            ) : (
              <>
                <span className="truncate">
                  {isSpectator
                    ? `Эфир: ход (${turnMark})`
                    : gameMode === "online" && isWaitingForOpponent
                    ? `Ожидаем ход соперника (${turnMark})...`
                    : isWaitingForOpponent
                    ? "ИИ-агент вычисляет ответ..."
                    : variant === "decay" &&
                      ((turnMark === "X" && fadingXIdx !== -1) ||
                        (turnMark === "O" && fadingOIdx !== -1))
                    ? `ВАШ ХОД (${turnMark}) — старая метка исчезнет`
                    : `ВАШ ХОД (${turnMark}) — соберите ${winLength} в ряд`}
                </span>
                <span className="font-mono text-[11px] bg-black/45 px-1.5 py-0.5 border border-white/25 text-white shrink-0">
                  {size}×{size} · {winLength} в ряд
                </span>
              </>
            )}
          </div>

          {/* Translucent Blitz Grid (Scaled comfortably for fingers & mouse) */}
          <div
            className="mx-auto bg-slate-950/50 border border-white/30 p-2 sm:p-2.5 grid gap-1.5 sm:gap-2"
            style={{
              gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
              maxWidth:
                size === 5
                  ? "min(90vw, 330px)"
                  : size === 4
                  ? "min(86vw, 300px)"
                  : "min(80vw, 276px)",
            }}
          >
            {board.map((cell, idx) => {
              const isWinCell = winningLine.includes(idx);
              const isBlocked = cell === "BLOCKED";
              const isFading =
                (turnMark === "X" && idx === fadingXIdx) ||
                (turnMark === "O" && idx === fadingOIdx);
              const canClick = cell === null && !duelStatus.finished && !isWaitingForOpponent;

              return (
                <button
                  key={`blitz-cell-${idx}`}
                  type="button"
                  disabled={!canClick}
                  onClick={() => applyMark(idx, turnMark)}
                  aria-label={`Клетка блица ${idx + 1}`}
                  className={`relative aspect-square min-h-[52px] flex flex-col items-center justify-center font-display font-bold focus-visible:outline-2 focus-visible:outline-white touch-manipulation transition-all ${
                    size === 5 ? "text-2xl" : size === 4 ? "text-3xl" : "text-4xl"
                  } ${
                    isBlocked
                      ? "bg-slate-800/55 border-2 border-slate-600/60 text-slate-400 cursor-not-allowed"
                      : isWinCell
                      ? "bg-emerald-600/80 border-2 border-emerald-200 text-white"
                      : cell !== null
                      ? `bg-slate-900/62 border border-white/25 ${isFading ? "opacity-55 border-amber-400" : ""}`
                      : canClick
                      ? "bg-white/20 hover:bg-white/35 border-t-2 border-l-2 border-white/70 border-r-2 border-b-2 border-black/75 cursor-pointer active:scale-95"
                      : "bg-slate-900/45 border border-white/15 cursor-default"
                  }`}
                >
                  {isBlocked && <ShieldAlert className="w-5 h-5 text-slate-300" />}
                  {cell === "X" && <span className="text-sky-300 drop-shadow leading-none">X</span>}
                  {cell === "O" && <span className="text-amber-300 drop-shadow leading-none">O</span>}
                  {isFading && cell !== null && (
                    <span className="font-mono text-[8px] leading-none text-amber-300 uppercase mt-0.5">
                      исчезнет
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
