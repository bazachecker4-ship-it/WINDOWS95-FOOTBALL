import React, { useEffect, useRef, useState } from "react";
import {
  ABILITIES_BY_ROLE,
  AbilityId,
  HAIR_LABELS,
  HairStyle,
  JERSEY_THEME_STYLES,
  JerseyPattern,
  JerseyTheme,
  PATTERN_LABELS,
  PlayerRole,
  ROLE_META,
  RoleAppearance,
  RoleProgression,
  SquadProgressionState,
} from "../types/game";
import { ChessPieceIcon } from "./ChessPieceIcon";
import { drawPlayerPreviewToCanvas } from "../pixi/pixelArtTextures";
import { Check, Lock, Plus, SlidersHorizontal, Sparkles } from "lucide-react";
import { Win95Window } from "./Win95Window";

interface SquadModalProps {
  progression: SquadProgressionState;
  zIndex: number;
  isActive: boolean;
  isMinimized?: boolean;
  cascadeIndex?: number;
  topBoundary?: number;
  onFocus: () => void;
  onMinimize?: () => void;
  onUpgradeStat: (role: PlayerRole, stat: keyof RoleProgression["stats"]) => void;
  onUnlockAbility: (role: PlayerRole, abilityId: AbilityId, cost: number) => void;
  onUpdateAppearance: (role: PlayerRole, patch: Partial<RoleAppearance>) => void;
  onClose: () => void;
}

const STAT_META: Array<{
  key: keyof RoleProgression["stats"];
  label: string;
  effect: string;
}> = [
  { key: "speed", label: "Скорость", effect: "Ур. 3+: +1 клетка к дальности хода" },
  { key: "accuracy", label: "Точность", effect: "Ур. 3+: +1 колонка удара и время удара" },
  { key: "defense", label: "Защита", effect: "+0.3с на ход в блиц-обороне за уровень" },
  { key: "passing", label: "Пас", effect: "Дальность паса; ур. 3+: навес через преграду" },
];

export const SquadModal: React.FC<SquadModalProps> = ({
  progression,
  zIndex,
  isActive,
  isMinimized,
  cascadeIndex = 2,
  topBoundary = 40,
  onFocus,
  onMinimize,
  onUpgradeStat,
  onUnlockAbility,
  onUpdateAppearance,
  onClose,
}) => {
  const [activeRole, setActiveRole] = useState<PlayerRole>("FWD");
  const [tab, setTab] = useState<"stats" | "look">("stats");
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const roleProg = progression.roles[activeRole];
  const abilities = ABILITIES_BY_ROLE[activeRole];
  const xpIntoLevel = progression.xp % 60;

  useEffect(() => {
    if (!previewCanvasRef.current) return;
    drawPlayerPreviewToCanvas(
      previewCanvasRef.current,
      activeRole,
      "blue",
      0,
      roleProg.appearance
    );
  }, [activeRole, roleProg.appearance]);

  return (
    <Win95Window
      title="SQUAD_MANAGER.EXE — Команда и Прокачка"
      icon={<SlidersHorizontal className="w-3.5 h-3.5 text-emerald-300 shrink-0" />}
      ariaLabel="Команда, прокачка и кастомизация"
      zIndex={zIndex}
      isActive={isActive}
      isMinimized={isMinimized}
      cascadeIndex={cascadeIndex}
      topBoundary={topBoundary}
      defaultWidth={680}
      defaultHeight={600}
      minWidth={320}
      minHeight={380}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      statusBarPanes={[
        { text: `Роль: ${ROLE_META[activeRole].name}`, flex: true },
        { text: `Очки: ${progression.skillPoints}` },
        { text: `Матчей: ${progression.matchesPlayed}` },
      ]}
    >
      <div className="p-3.5 space-y-3.5 overflow-y-auto flex-1">
          {/* Status Strip */}
          <div className="pc-inset px-3 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono tabular-nums text-slate-900">
            <span className="font-bold text-blue-900">
              Очки навыков: {progression.skillPoints}
            </span>
            <span aria-hidden="true">|</span>
            <span>Опыт: {xpIntoLevel}/60 XP</span>
            <span aria-hidden="true">|</span>
            <span>Голы: {progression.goalsScored}</span>
          </div>

          {/* Role Tabs */}
          <div className="grid grid-cols-5 gap-1.5">
            {(["GK", "DEF", "MID", "WNG", "FWD"] as PlayerRole[]).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setActiveRole(role)}
                className={`py-2 px-2 text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeRole === role ? "pc-btn-active" : "pc-btn"
                }`}
              >
                <ChessPieceIcon role={role} className="w-3.5 h-3.5 shrink-0" />
                <span>{ROLE_META[role].code}</span>
              </button>
            ))}
          </div>

          {/* Preview + Sub-Tab */}
          <div className="pc-inset p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-16 h-16 pc-inset-dark bg-[#1b6337] flex items-center justify-center shrink-0">
                <canvas
                  ref={previewCanvasRef}
                  width={48}
                  height={56}
                  style={{ imageRendering: "pixelated" }}
                  className="w-12 h-14"
                />
              </div>
              <div>
                <div className="font-display text-lg font-bold text-slate-950 leading-none">
                  {ROLE_META[activeRole].name} · {ROLE_META[activeRole].chessName}
                </div>
                <p className="text-[11px] text-slate-800 mt-1 leading-snug max-w-sm">
                  {ROLE_META[activeRole].moveSummary}
                </p>
              </div>
            </div>

            <div className="flex items-end gap-0.5 shrink-0 self-start sm:self-center">
              <button
                type="button"
                onClick={() => setTab("stats")}
                className={`px-3 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer ${
                  tab === "stats" ? "win95-tab-active" : "win95-tab"
                }`}
              >
                Навыки
              </button>
              <button
                type="button"
                onClick={() => setTab("look")}
                className={`px-3 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer ${
                  tab === "look" ? "win95-tab-active" : "win95-tab"
                }`}
              >
                Внешний вид
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {tab === "stats" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-900">
                  Характеристики (1 очко за ур.)
                </div>
                {STAT_META.map(({ key, label, effect }) => {
                  const lvl = roleProg.stats[key];
                  const canUpgrade = progression.skillPoints >= 1 && lvl < 5;
                  return (
                    <div
                      key={key}
                      className="pc-inset p-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-950">{label}</span>
                          <span className="font-mono text-xs font-bold text-blue-900 tabular-nums">
                            {lvl}/5
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-800 mt-0.5 leading-snug">{effect}</p>
                        <div className="mt-1.5 flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((step) => (
                            <div
                              key={step}
                              className={`h-2 w-5 border border-slate-700 ${
                                step <= lvl ? "bg-[#000080]" : "bg-slate-300"
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!canUpgrade}
                        onClick={() => onUpgradeStat(activeRole, key)}
                        className={`h-8 px-2.5 text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0 ${
                          canUpgrade
                            ? "pc-btn-primary cursor-pointer"
                            : "pc-inset text-slate-600 cursor-not-allowed"
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{lvl >= 5 ? "Макс" : "1"}</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-900">Уникальные способности</div>
                {abilities.map((ab) => {
                  const unlocked = roleProg.unlockedAbilities.includes(ab.id);
                  const canUnlock = !unlocked && progression.skillPoints >= ab.cost;
                  return (
                    <div
                      key={ab.id}
                      className={`p-3 ${unlocked ? "pc-inset-dark text-white" : "pc-inset text-slate-900"}`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-xs font-bold">
                            <Sparkles
                              className={`w-3.5 h-3.5 shrink-0 ${
                                unlocked ? "text-amber-300" : "text-amber-700"
                              }`}
                            />
                            <span>{ab.name}</span>
                          </div>
                          <p
                            className={`mt-1 text-[11px] leading-snug ${
                              unlocked ? "text-slate-300" : "text-slate-800"
                            }`}
                          >
                            {ab.description}
                          </p>
                        </div>

                        {unlocked ? (
                          <span className="text-xs font-bold text-emerald-300 flex items-center gap-1 shrink-0 whitespace-nowrap">
                            <Check className="w-3.5 h-3.5" />
                            <span>Акт.</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={!canUnlock}
                            onClick={() => onUnlockAbility(activeRole, ab.id, ab.cost)}
                            className={`h-8 px-2.5 text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0 ${
                              canUnlock
                                ? "pc-btn-primary cursor-pointer"
                                : "pc-inset text-slate-600 cursor-not-allowed"
                            }`}
                          >
                            <Lock className="w-3 h-3" />
                            <span>{ab.cost} оч.</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-xs font-bold text-slate-900 mb-1.5">Цвет формы</div>
                <div className="grid grid-cols-5 gap-1.5">
                  {(Object.keys(JERSEY_THEME_STYLES) as JerseyTheme[]).map((themeKey) => {
                    const t = JERSEY_THEME_STYLES[themeKey];
                    const active = roleProg.appearance.jerseyTheme === themeKey;
                    return (
                      <button
                        key={themeKey}
                        type="button"
                        onClick={() => onUpdateAppearance(activeRole, { jerseyTheme: themeKey })}
                        className={`py-2 px-2 text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                          active ? "pc-btn-active" : "pc-btn"
                        }`}
                      >
                        <span
                          className="w-3 h-3 border border-black shrink-0"
                          style={{ backgroundColor: t.swatch }}
                        />
                        <span className="hidden sm:inline">{t.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-slate-900 mb-1.5">Рисунок формы</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(PATTERN_LABELS) as JerseyPattern[]).map((pat) => (
                    <button
                      key={pat}
                      type="button"
                      onClick={() => onUpdateAppearance(activeRole, { jerseyPattern: pat })}
                      className={`py-2 px-3 text-xs font-bold whitespace-nowrap cursor-pointer ${
                        roleProg.appearance.jerseyPattern === pat ? "pc-btn-active" : "pc-btn"
                      }`}
                    >
                      {PATTERN_LABELS[pat]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-slate-900 mb-1.5">Причёска / Шлем</div>
                <div className="grid grid-cols-5 gap-1.5">
                  {(Object.keys(HAIR_LABELS) as HairStyle[]).map((hair) => (
                    <button
                      key={hair}
                      type="button"
                      onClick={() => onUpdateAppearance(activeRole, { hairStyle: hair })}
                      className={`py-2 px-2 text-xs font-bold whitespace-nowrap cursor-pointer ${
                        roleProg.appearance.hairStyle === hair ? "pc-btn-active" : "pc-btn"
                      }`}
                    >
                      {HAIR_LABELS[hair]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
      </div>
    </Win95Window>
  );
};
