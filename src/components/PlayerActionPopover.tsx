import React from "react";
import {
  PlayerActionMode,
  PlayerPiece,
  ROLE_META,
  SquadProgressionState,
  TacticalPressureState,
} from "../types/game";
import { PixelPlayerPortrait } from "./Win95Art";
import { Zap, Move, Send, Target, Shield, X, Clock, SkipForward } from "lucide-react";

interface PlayerActionPopoverProps {
  player: PlayerPiece;
  progression: SquadProgressionState;
  hasBall: boolean;
  actionPoints: number;
  maxActionPoints: number;
  turnTimeLeft: number;
  maxTurnTime: number;
  actionMode: PlayerActionMode | null;
  moveMinCost: number;
  passCost: number;
  shotCost: number;
  clashCost?: number;
  hasClashTarget: boolean;
  pressureState?: TacticalPressureState | null;
  onClose: () => void;
  onActionClick: (action: PlayerActionMode) => void;
  onEndTurn: () => void;
  canMove: boolean;
  canPass: boolean;
  canShoot: boolean;
}

export const PlayerActionPopover: React.FC<PlayerActionPopoverProps> = ({
  player,
  progression,
  hasBall,
  actionPoints,
  maxActionPoints,
  turnTimeLeft,
  maxTurnTime,
  actionMode,
  moveMinCost,
  passCost,
  shotCost,
  clashCost = 3,
  hasClashTarget,
  pressureState = null,
  onClose,
  onActionClick,
  onEndTurn,
  canMove,
  canPass,
  canShoot,
}) => {
  const meta = ROLE_META[player.role];
  const isUrgent = turnTimeLeft <= 5;
  const apPct = Math.max(0, Math.min(100, (actionPoints / Math.max(1, maxActionPoints)) * 100));
  const timePct = Math.max(0, Math.min(100, (turnTimeLeft / Math.max(1, maxTurnTime)) * 100));
  const isBlockedWarning =
    pressureState &&
    (pressureState.level === "forward_blocked" || pressureState.level === "retreat_only");

  return (
    <div
      role="dialog"
      aria-label="Действия игрока"
      className="fixed bottom-[max(92px,calc(88px+env(safe-area-inset-bottom)))] [@media(max-height:519px)]:bottom-[54px] md:bottom-[114px] left-1.5 right-1.5 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[340px] mx-auto max-w-[440px] z-30 pc-window p-[3px] select-none animate-fade-in"
    >
      <div className="pc-titlebar px-2 py-1 md:py-0.5 flex items-center justify-between gap-2">
        <span className="font-display text-xs font-bold truncate flex items-center gap-1.5">
          <span className="truncate">
            {meta.name} #{player.number} {hasBall ? "⚽" : ""}
          </span>
          <span className="md:hidden font-mono text-[10px] text-amber-300 shrink-0">
            ⚡{actionPoints}/{maxActionPoints}
          </span>
          <span
            className={`md:hidden font-mono text-[10px] shrink-0 ${
              isUrgent ? "text-red-300 animate-pulse" : "text-sky-200"
            }`}
          >
            ⏱{Math.ceil(turnTimeLeft)}с
          </span>
        </span>
        <button
          type="button"
          onClick={onClose}
          title="Закрыть панель действий"
          className="pc-btn w-6 h-5 md:w-4 md:h-3.5 text-[10px] font-bold flex items-center justify-center cursor-pointer shrink-0"
        >
          <X className="w-3 h-3 md:w-2.5 md:h-2.5" />
        </button>
      </div>

      {/* Compact Mobile Thumb Strip (< md or short landscape) */}
      <div className="md:hidden [@media(max-height:519px)]:block bg-[#101820] text-white p-1.5 space-y-1.5 border border-black">
        {isBlockedWarning && pressureState && (
          <div
            className={`px-2 py-1 text-[10px] font-bold leading-tight border ${
              pressureState.level === "retreat_only"
                ? "bg-red-950/90 border-red-400 text-red-200"
                : "bg-amber-950/90 border-amber-400 text-amber-200"
            }`}
          >
            {pressureState.level === "retreat_only"
              ? `🚨 ${pressureState.frontBlockers} защитника — только отход назад или пас!`
              : `⛔ ${pressureState.frontBlockers} защитника спереди — пас, фланг или отход`}
          </div>
        )}
        <div className="grid grid-cols-5 gap-1">
          <button
            type="button"
            disabled={!canMove || actionPoints < moveMinCost}
            onClick={() => onActionClick("move")}
            className={`min-h-[44px] px-1 py-1 text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              actionMode === "move" ? "pc-btn-active" : "pc-btn"
            } ${!canMove || actionPoints < moveMinCost ? "opacity-45 cursor-not-allowed" : ""}`}
          >
            <Move className="w-3.5 h-3.5 text-[#000080]" />
            <span className="leading-none text-black">Пути</span>
            <span className="font-mono text-[9px] bg-amber-200 text-black px-1 leading-tight">
              {moveMinCost} AP
            </span>
          </button>

          <button
            type="button"
            disabled={!hasBall || !canPass || actionPoints < passCost}
            onClick={() => onActionClick("pass")}
            className={`min-h-[44px] px-1 py-1 text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              actionMode === "pass" ? "pc-btn-active" : "pc-btn"
            } ${
              !hasBall || !canPass || actionPoints < passCost
                ? "opacity-45 cursor-not-allowed"
                : ""
            }`}
          >
            <Send className="w-3.5 h-3.5 text-emerald-800" />
            <span className="leading-none text-black">Пас</span>
            <span className="font-mono text-[9px] bg-amber-200 text-black px-1 leading-tight">
              {passCost} AP
            </span>
          </button>

          <button
            type="button"
            disabled={!hasBall || !canShoot || actionPoints < shotCost}
            onClick={() => onActionClick("shoot")}
            className={`min-h-[44px] px-1 py-1 text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              actionMode === "shoot" ? "pc-btn-active" : "pc-btn"
            } ${
              !hasBall || !canShoot || actionPoints < shotCost
                ? "opacity-45 cursor-not-allowed"
                : ""
            }`}
          >
            <Target className="w-3.5 h-3.5 text-red-800" />
            <span className="leading-none text-black">Удар</span>
            <span className="font-mono text-[9px] bg-amber-200 text-black px-1 leading-tight">
              {shotCost} AP
            </span>
          </button>

          <button
            type="button"
            disabled={!hasClashTarget || actionPoints < clashCost}
            onClick={() => onActionClick("tackle")}
            className={`min-h-[44px] px-1 py-1 text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              actionMode === "tackle" ? "pc-btn-active" : "pc-btn"
            } ${!hasClashTarget || actionPoints < clashCost ? "opacity-45 cursor-not-allowed" : ""}`}
          >
            <Shield className="w-3.5 h-3.5 text-sky-900" />
            <span className="leading-none text-black">Стык</span>
            <span className="font-mono text-[9px] bg-amber-200 text-black px-1 leading-tight">
              {clashCost} AP
            </span>
          </button>

          <button
            type="button"
            onClick={onEndTurn}
            className="pc-btn min-h-[44px] px-1 py-1 text-[10px] font-bold text-[#000080] flex flex-col items-center justify-center gap-0.5 cursor-pointer"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span className="leading-none">Ход →</span>
            <span className="font-mono text-[9px] text-slate-700 leading-tight">Сброс</span>
          </button>
        </div>
      </div>

      {/* Desktop Full Popover (md+ and tall screens) */}
      <div className="hidden md:block [@media(max-height:519px)]:!hidden bg-[#101820] text-white p-2.5 space-y-2 border border-black">
        {isBlockedWarning && pressureState && (
          <div
            className={`px-2 py-1 text-[10px] font-bold leading-tight border ${
              pressureState.level === "retreat_only"
                ? "bg-red-950/90 border-red-400 text-red-200"
                : "bg-amber-950/90 border-amber-400 text-amber-200"
            }`}
          >
            {pressureState.level === "retreat_only"
              ? `🚨 ${pressureState.frontBlockers} защитника впереди — только отход назад или пас!`
              : `⛔ ${pressureState.frontBlockers} защитника спереди — проход закрыт, пасуйте или смещайтесь`}
          </div>
        )}
        {/* Top bar: Portrait + AP Points & Situational Turn Timer */}
        <div className="flex items-center gap-2.5">
          <div className="pc-field p-0.5 shrink-0 bg-[#090d16]">
            <PixelPlayerPortrait
              role={player.role}
              team={player.team}
              skinTone={player.skinTone}
              appearance={progression.roles[player.role].appearance}
              className="w-12 h-12"
            />
          </div>

          <div className="flex-1 space-y-1 min-w-0">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-200 flex items-center gap-1 font-bold">
                <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Очки хода (AP):</span>
              </span>
              <span className="font-mono text-amber-300 font-bold tabular-nums">
                {actionPoints} / {maxActionPoints}
              </span>
            </div>
            {/* AP Bar */}
            <div className="h-2 bg-slate-900 border border-slate-700 p-[1px]">
              <div
                className="h-full bg-amber-400 transition-all duration-200"
                style={{ width: `${apPct}%` }}
              />
            </div>

            {/* Situational Turn Timer bar */}
            <div className="flex items-center justify-between text-[10px] pt-0.5">
              <span className="flex items-center gap-1 text-slate-300">
                <Clock className={`w-3 h-3 ${isUrgent ? "text-red-400 animate-pulse" : "text-sky-400"}`} />
                <span>Лимит хода:</span>
              </span>
              <span
                className={`font-mono font-bold tabular-nums ${
                  isUrgent ? "text-red-400" : "text-sky-300"
                }`}
              >
                {Math.ceil(turnTimeLeft)}с
              </span>
            </div>
            <div className="h-1 bg-slate-900 border border-slate-700">
              <div
                className={`h-full transition-all duration-500 ${
                  isUrgent ? "bg-red-500" : "bg-sky-400"
                }`}
                style={{ width: `${timePct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons Grid with Dynamic AP Costs */}
        <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-700">
          <button
            type="button"
            disabled={!canMove || actionPoints < moveMinCost}
            onClick={() => onActionClick("move")}
            className={`px-2 py-1.5 text-xs font-bold flex items-center justify-between cursor-pointer ${
              actionMode === "move" ? "pc-btn-active" : "pc-btn"
            } ${!canMove || actionPoints < moveMinCost ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <span className="flex items-center gap-1.5 text-[#000080]">
              <Move className="w-3.5 h-3.5" />
              <span>Пути</span>
            </span>
            <span className="font-mono text-[10px] bg-amber-200 text-black px-1 font-bold">
              {moveMinCost} AP
            </span>
          </button>

          <button
            type="button"
            disabled={!hasBall || !canPass || actionPoints < passCost}
            onClick={() => onActionClick("pass")}
            className={`px-2 py-1.5 text-xs font-bold flex items-center justify-between cursor-pointer ${
              actionMode === "pass" ? "pc-btn-active" : "pc-btn"
            } ${
              !hasBall || !canPass || actionPoints < passCost
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
          >
            <span className="flex items-center gap-1.5 text-emerald-800">
              <Send className="w-3.5 h-3.5" />
              <span>Пас</span>
            </span>
            <span className="font-mono text-[10px] bg-amber-200 text-black px-1 font-bold">
              {passCost} AP
            </span>
          </button>

          <button
            type="button"
            disabled={!hasBall || !canShoot || actionPoints < shotCost}
            onClick={() => onActionClick("shoot")}
            className={`px-2 py-1.5 text-xs font-bold flex items-center justify-between cursor-pointer ${
              actionMode === "shoot" ? "pc-btn-active" : "pc-btn"
            } ${
              !hasBall || !canShoot || actionPoints < shotCost
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
          >
            <span className="flex items-center gap-1.5 text-red-800">
              <Target className="w-3.5 h-3.5" />
              <span>Удар</span>
            </span>
            <span className="font-mono text-[10px] bg-amber-200 text-black px-1 font-bold">
              {shotCost} AP
            </span>
          </button>

          <button
            type="button"
            disabled={!hasClashTarget || actionPoints < clashCost}
            onClick={() => onActionClick("tackle")}
            className={`px-2 py-1.5 text-xs font-bold flex items-center justify-between cursor-pointer ${
              actionMode === "tackle" ? "pc-btn-active" : "pc-btn"
            } ${!hasClashTarget || actionPoints < clashCost ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <span className="flex items-center gap-1.5 text-sky-900">
              <Shield className="w-3.5 h-3.5" />
              <span>Стык</span>
            </span>
            <span className="font-mono text-[10px] bg-amber-200 text-black px-1 font-bold">
              {clashCost} AP
            </span>
          </button>
        </div>

        {/* Footer action hint + End Turn */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
          <span className="text-[10px] text-slate-400 truncate">
            {actionMode === "pass"
              ? "Выберите партнёра или жмите Пас"
              : actionMode === "shoot"
              ? "Выберите створ ворот"
              : actionMode === "tackle"
              ? "Нажмите на соперника для блица"
              : "Кликните подсвеченную клетку"}
          </span>
          <button
            type="button"
            onClick={onEndTurn}
            className="pc-btn px-2 py-1 text-[10px] font-bold text-[#000080] flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <SkipForward className="w-3 h-3" />
            <span>Конец хода</span>
          </button>
        </div>
      </div>
    </div>
  );
};
