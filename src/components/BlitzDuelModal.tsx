import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AIDifficulty,
  ActiveBlitzDuel,
  BLITZ_PACE_MS,
  BlitzPace,
  GameMode,
  PlayerPiece,
  ROLE_META,
  Team,
} from "../types/game";
import { BlitzCell, checkBlitzWinner, chooseBlitzAIMove, generateWinLines } from "../engine/blitzAi";
import { ChessPieceIcon, SoccerBallIcon } from "./ChessPieceIcon";
import { soundFX } from "../utils/sound";
import { ShieldAlert } from "lucide-react";

interface BlitzDuelModalProps {
  duel: ActiveBlitzDuel;
  players: PlayerPiece[];
  gameMode: GameMode;
  difficulty: AIDifficulty;
  blitzPace: BlitzPace;
  onResolve: (winnerTeam: Team | "draw", outcomeText: string, wasTimeout: boolean) => void;
}

export const BlitzDuelModal: React.FC<BlitzDuelModalProps> = ({
  duel,
  players,
  gameMode,
  difficulty,
  blitzPace,
  onResolve,
}) => {
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

  const [board, setBoard] = useState<BlitzCell[]>(() => {
    const arr: BlitzCell[] = Array(totalCells).fill(null);
    for (const bIdx of blockedCells) {
      if (bIdx >= 0 && bIdx < totalCells) arr[bIdx] = "BLOCKED";
    }
    return arr;
  });

  const [turnMark, setTurnMark] = useState<"X" | "O">("X");
  const [xQueue, setXQueue] = useState<number[]>([]);
  const [oQueue, setOQueue] = useState<number[]>([]);
  const [winningLine, setWinningLine] = useState<number[]>([]);
  const [duelStatus, setDuelStatus] = useState<{
    finished: boolean;
    winnerTeam: Team | "draw" | null;
    message: string;
  }>({ finished: false, winnerTeam: null, message: "" });

  const getTurnTimeLimit = (mark: "X" | "O"): number | null => {
    if (baseTimeLimitMs === null) return null;
    const team = mark === "X" ? initiator.team : defender.team;
    const bonus = team === "blue" ? duel.bonusTimeMsBlue : duel.bonusTimeMsRed;
    return baseTimeLimitMs + bonus;
  };

  const currentTurnLimitMs = getTurnTimeLimit(turnMark);
  const [timeLeftMs, setTimeLeftMs] = useState<number>(currentTurnLimitMs ?? 0);

  const resolvedRef = useRef(false);
  const stateRef = useRef({ board, xQueue, oQueue });
  stateRef.current = { board, xQueue, oQueue };

  const activeTeam: Team = turnMark === "X" ? initiator.team : defender.team;
  const isAITurn = gameMode === "ai" && activeTeam === "red" && !duelStatus.finished;

  const finishDuel = (
    winnerTeam: Team | "draw",
    line: number[],
    message: string,
    wasTimeout = false
  ) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setWinningLine(line);
    setDuelStatus({ finished: true, winnerTeam, message });

    if (winnerTeam === "blue") soundFX.playBlitzWin(true);
    else if (winnerTeam === "red") soundFX.playBlitzWin(false);

    window.setTimeout(() => {
      onResolve(winnerTeam, message, wasTimeout);
    }, 950);
  };

  const applyMark = (cellIdx: number, mark: "X" | "O") => {
    if (resolvedRef.current || duelStatus.finished) return;
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

    setBoard(nextBoard);
    setXQueue(nextX);
    setOQueue(nextO);

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
      finishDuel(winTeam, res.line, msg, false);
    } else if (res.winner === "draw") {
      finishDuel("draw", [], "Ничья в блице — мяч остаётся у владельца", false);
    } else {
      const nextMark = mark === "X" ? "O" : "X";
      setTurnMark(nextMark);
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
        const loserTeam = turnMark === "X" ? initiator.team : defender.team;
        const winnerTeam: Team = loserTeam === "blue" ? "red" : "blue";
        const winLabel = winnerTeam === "blue" ? "Синие" : "Красные";
        finishDuel(winnerTeam, [], `Время вышло — ${winLabel} забирают мяч!`, loserTeam === "blue");
      }
    }, 50);

    return () => window.clearInterval(interval);
  }, [turnMark, baseTimeLimitMs, duelStatus.finished]);

  useEffect(() => {
    if (!isAITurn || resolvedRef.current) return;
    const delay = difficulty === "pro" ? 320 : difficulty === "tactical" ? 420 : 540;
    const timer = window.setTimeout(() => {
      if (resolvedRef.current) return;
      const aiMark = initiator.team === "red" ? "X" : "O";
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
  }, [isAITurn, board, size, winLength, difficulty, maxMarksPerPlayer]);

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
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Блиц-дуэль за мяч"
    >
      <div className="w-full max-w-md pc-window p-1">
        {/* Classic Old-PC Window Title Bar */}
        <div className="pc-titlebar px-2.5 py-1.5 flex items-center justify-between gap-3">
          <span className="font-display text-base font-bold tracking-wide truncate">
            BLITZ_DUEL.EXE — {variantName}
          </span>
          {currentTurnLimitMs !== null && (
            <span
              className={`font-mono text-xs font-bold tabular-nums px-1.5 py-0.5 bg-black/40 ${
                timeLeftMs < 1100 ? "text-red-300" : "text-emerald-300"
              }`}
            >
              {(timeLeftMs / 1000).toFixed(1)}с
            </span>
          )}
        </div>

        <div className="p-3.5 space-y-3">
          <div>
            <p className="text-xs text-slate-900 leading-snug font-medium">{variantDesc}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-700">
              <span className="font-bold">Условия:</span>
              {reasons.map((reason, idx) => (
                <React.Fragment key={reason}>
                  {idx > 0 && <span aria-hidden="true">·</span>}
                  <span>{reason}</span>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Segmented Retro Timer Bar */}
          {currentTurnLimitMs !== null && (
            <div className="pc-inset p-0.5 h-3.5 w-full">
              <div
                className={`h-full transition-[width] duration-75 ${
                  timeLeftMs < 1100 ? "bg-red-700" : "bg-[#000080]"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}

          {/* Duelists */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { piece: initiator, mark: "X" as const, roleDesc: "Инициатор" },
              { piece: defender, mark: "O" as const, roleDesc: "Соперник" },
            ].map(({ piece, mark, roleDesc }) => {
              const isTurn = !duelStatus.finished && turnMark === mark;
              const isBlue = piece.team === "blue";
              const bonus = isBlue ? duel.bonusTimeMsBlue : duel.bonusTimeMsRed;
              return (
                <div
                  key={piece.id}
                  className={`p-2 flex items-center justify-between gap-2 ${
                    isTurn ? "pc-btn-active" : "pc-inset text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-7 h-7 flex items-center justify-center shrink-0 border border-black ${
                        isBlue ? "bg-blue-700 text-white" : "bg-red-700 text-white"
                      }`}
                    >
                      <ChessPieceIcon role={piece.role} className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold truncate">
                        {isBlue ? "Синие" : "Красные"} · {ROLE_META[piece.role].code}
                      </div>
                      <div
                        className={`text-[10px] truncate ${
                          isTurn ? "text-slate-200" : "text-slate-700"
                        }`}
                      >
                        {roleDesc}
                        {bonus > 0 ? ` (+${(bonus / 1000).toFixed(1)}с)` : ""}
                      </div>
                    </div>
                  </div>
                  <span className="font-display text-lg font-bold shrink-0">{mark}</span>
                </div>
              );
            })}
          </div>

          {/* Recessed CRT Blitz Grid */}
          <div
            className="mx-auto pc-inset-dark p-2.5 grid gap-1.5"
            style={{
              gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
              maxWidth: size === 5 ? "300px" : size === 4 ? "270px" : "235px",
            }}
          >
            {board.map((cell, idx) => {
              const isWinCell = winningLine.includes(idx);
              const isBlocked = cell === "BLOCKED";
              const isFading =
                (turnMark === "X" && idx === fadingXIdx) ||
                (turnMark === "O" && idx === fadingOIdx);
              const canClick = cell === null && !duelStatus.finished && !isAITurn;

              return (
                <button
                  key={`blitz-cell-${idx}`}
                  type="button"
                  disabled={!canClick}
                  onClick={() => applyMark(idx, turnMark)}
                  aria-label={`Клетка блица ${idx + 1}`}
                  className={`aspect-square flex items-center justify-center font-display font-bold focus-visible:outline-2 focus-visible:outline-white ${
                    size === 5 ? "text-2xl" : size === 4 ? "text-3xl" : "text-4xl"
                  } ${
                    isBlocked
                      ? "bg-slate-800 border-2 border-slate-700 text-slate-500 cursor-not-allowed"
                      : isWinCell
                      ? "bg-emerald-700 border-2 border-emerald-300 text-white"
                      : cell !== null
                      ? `pc-inset-dark ${isFading ? "opacity-45" : ""}`
                      : canClick
                      ? "pc-btn cursor-pointer"
                      : "bg-slate-900 border border-slate-700 cursor-default"
                  }`}
                >
                  {isBlocked && <ShieldAlert className="w-5 h-5 text-slate-400" />}
                  {cell === "X" && <span className="text-sky-400">X</span>}
                  {cell === "O" && <span className="text-amber-300">O</span>}
                </button>
              );
            })}
          </div>

          {/* Status Footer */}
          <div className="pc-inset px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs font-medium text-slate-900">
            {duelStatus.finished ? (
              <div className="flex items-center gap-2 text-emerald-900 font-bold w-full justify-center">
                <SoccerBallIcon className="w-4 h-4 shrink-0" />
                <span>{duelStatus.message}</span>
              </div>
            ) : (
              <>
                <span className="truncate">
                  {isAITurn
                    ? "ИИ-агент вычисляет ход..."
                    : variant === "decay" &&
                      ((turnMark === "X" && fadingXIdx !== -1) ||
                        (turnMark === "O" && fadingOIdx !== -1))
                    ? `Ход (${turnMark}) — старая метка исчезнет`
                    : `Ваш ход (${turnMark}) — соберите ${winLength} в ряд`}
                </span>
                <span className="font-mono font-bold shrink-0">
                  {size}×{size}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
