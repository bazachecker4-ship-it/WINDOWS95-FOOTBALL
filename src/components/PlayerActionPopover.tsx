import React from "react";
import { PlayerPiece, ROLE_META, SquadProgressionState, Team } from "../types/game";
import { PixelPlayerPortrait } from "./Win95Art";
import { Zap, Move, Send, Target, Shield, X, Clock } from "lucide-react";

interface PlayerActionPopoverProps {
  player: PlayerPiece;
  progression: SquadProgressionState;
  hasBall: boolean;
  actionPoints: number;
  maxActionPoints: number;
  turnTimeLeft: number;
  maxTurnTime: number;
  onClose: () => void;
  onActionClick: (action: "move" | "pass" | "shoot" | "tackle" | "dribble") => void;
  canPass: boolean;
  canShoot: boolean;
}

const ACTION_COSTS = {
  move: 1,
  pass: 2,
  dribble: 2,
  tackle: 3,
  shoot: 3,
};

export const PlayerActionPopover: React.FC<PlayerActionPopoverProps> = ({
  player,
  progression,
  hasBall,
  actionPoints,
  maxActionPoints,
  turnTimeLeft,
  maxTurnTime,
  onClose,
  onActionClick,
  canPass,
  canShoot,
}) => {
  const meta = ROLE_META[player.role];
  const stats = progression.roles[player.role].stats;

  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-30 w-80 pc-window p-[3px] select-none shadow-2xl animate-fade-in">
      <div className="pc-titlebar px-2 py-0.5 flex items-center justify-between gap-2">
        <span className="font-display text-xs font-bold truncate">
          {meta.name} #{player.number} · {meta.code}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="pc-btn w-4 h-3.5 text-[9px] font-bold flex items-center justify-center cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div className="bg-[#101820] text-white p-2.5 space-y-2 border border-black">
        {/* Top bar: Portrait + AP Points & Turn Timer */}
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

          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 flex items-center gap-1 font-bold">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Очки хода (AP):</span>
              </span>
              <span className="font-mono text-amber-300 font-bold">
                {actionPoints} / {maxActionPoints}
              </span>
            </div>
            {/* AP Bar */}
            <div className="h-2 bg-slate-900 border border-slate-700 p-[1px]">
              <div
                className="h-full bg-amber-400 transition-all duration-300"
                style={{ width: `${Math.max(10, (actionPoints / Math.max(1, maxActionPoints)) * 100)}%` }}
              />
            </div>

            {/* Turn Timer bar */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-sky-400" />
                <span>Таймер хода:</span>
              </span>
              <span className="font-mono text-sky-300 font-bold">{Math.ceil(turnTimeLeft)}с</span>
            </div>
          </div>
        </div>

        {/* Action Buttons Grid with AP Costs */}
        <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-700">
          <button
            type="button"
            disabled={actionPoints < ACTION_COSTS.move}
            onClick={() => onActionClick("move")}
            className={`pc-btn px-2 py-1.5 text-xs font-bold flex items-center justify-between cursor-pointer ${
              actionPoints < ACTION_COSTS.move ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <span className="flex items-center gap-1.5 text-[#000080]">
              <Move className="w-3.5 h-3.5" />
              <span>Ход</span>
            </span>
            <span className="font-mono text-[10px] bg-amber-200 text-black px-1 font-bold">
              {ACTION_COSTS.move} AP
            </span>
          </button>

          <button
            type="button"
            disabled={!hasBall || !canPass || actionPoints < ACTION_COSTS.pass}
            onClick={() => onActionClick("pass")}
            className={`pc-btn px-2 py-1.5 text-xs font-bold flex items-center justify-between cursor-pointer ${
              !hasBall || !canPass || actionPoints < ACTION_COSTS.pass ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <span className="flex items-center gap-1.5 text-emerald-800">
              <Send className="w-3.5 h-3.5" />
              <span>Пас</span>
            </span>
            <span className="font-mono text-[10px] bg-amber-200 text-black px-1 font-bold">
              {ACTION_COSTS.pass} AP
            </span>
          </button>

          <button
            type="button"
            disabled={!hasBall || !canShoot || actionPoints < ACTION_COSTS.shoot}
            onClick={() => onActionClick("shoot")}
            className={`pc-btn px-2 py-1.5 text-xs font-bold flex items-center justify-between cursor-pointer ${
              !hasBall || !canShoot || actionPoints < ACTION_COSTS.shoot ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <span className="flex items-center gap-1.5 text-red-800">
              <Target className="w-3.5 h-3.5" />
              <span>Удар</span>
            </span>
            <span className="font-mono text-[10px] bg-amber-200 text-black px-1 font-bold">
              {ACTION_COSTS.shoot} AP
            </span>
          </button>

          <button
            type="button"
            disabled={actionPoints < ACTION_COSTS.tackle}
            onClick={() => onActionClick("tackle")}
            className={`pc-btn px-2 py-1.5 text-xs font-bold flex items-center justify-between cursor-pointer ${
              actionPoints < ACTION_COSTS.tackle ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <span className="flex items-center gap-1.5 text-sky-800">
              <Shield className="w-3.5 h-3.5" />
              <span>Отбор</span>
            </span>
            <span className="font-mono text-[10px] bg-amber-200 text-black px-1 font-bold">
              {ACTION_COSTS.tackle} AP
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
