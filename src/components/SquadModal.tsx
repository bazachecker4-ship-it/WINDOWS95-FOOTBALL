import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ABILITIES_BY_ROLE,
  AbilityId,
  HAIR_LABELS,
  HairStyle,
  JERSEY_THEME_STYLES,
  JerseyPattern,
  JerseyTheme,
  PATTERN_LABELS,
  PlayerPiece,
  PlayerRole,
  ROLE_META,
  RoleAppearance,
  RoleProgression,
  SquadProgressionState,
} from "../types/game";
import { ChessPieceIcon } from "./ChessPieceIcon";
import { drawPlayerPreviewToCanvas } from "../engine3d/playerPreview";
import { PixelPlayerPortrait } from "./Win95Art";
import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  ClipboardList,
  Lock,
  Plus,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Win95Window } from "./Win95Window";

interface SquadModalProps {
  progression: SquadProgressionState;
  players?: PlayerPiece[];
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
  onOpenTactics?: () => void;
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

const SQUAD_NAMES_BY_NUM: Record<number, string> = {
  1: "Соколов",
  2: "Орлов",
  3: "Волков",
  4: "Громов",
  5: "Медведев",
  6: "Лебедев",
  7: "Ковалёв",
  8: "Белов",
  9: "Морозов",
  10: "Смирнов",
  11: "Зайцев",
};

const DEFAULT_BLUE_ROSTER: Array<{ id: string; number: number; role: PlayerRole; skinTone: number }> = [
  { id: "b-fwd-9", number: 9, role: "FWD", skinTone: 0 },
  { id: "b-fwd-10", number: 10, role: "FWD", skinTone: 1 },
  { id: "b-wng-7", number: 7, role: "WNG", skinTone: 2 },
  { id: "b-wng-11", number: 11, role: "WNG", skinTone: 0 },
  { id: "b-mid-5", number: 5, role: "MID", skinTone: 1 },
  { id: "b-mid-6", number: 6, role: "MID", skinTone: 3 },
  { id: "b-mid-8", number: 8, role: "MID", skinTone: 0 },
  { id: "b-def-2", number: 2, role: "DEF", skinTone: 2 },
  { id: "b-def-3", number: 3, role: "DEF", skinTone: 1 },
  { id: "b-def-4", number: 4, role: "DEF", skinTone: 3 },
  { id: "b-gk-1", number: 1, role: "GK", skinTone: 0 },
];

function computeRoleRating(prog: RoleProgression): number {
  const s = prog.stats;
  const base = 78 + (s.speed + s.accuracy + s.defense + s.passing) * 1.4 + prog.unlockedAbilities.length * 2;
  return Math.min(99, Math.round(base));
}

export const SquadModal: React.FC<SquadModalProps> = ({
  progression,
  players,
  zIndex,
  isActive,
  isMinimized,
  cascadeIndex = 2,
  topBoundary = 42,
  onFocus,
  onMinimize,
  onUpgradeStat,
  onUnlockAbility,
  onUpdateAppearance,
  onOpenTactics,
  onClose,
}) => {
  const [selectedRowId, setSelectedRowId] = useState<string>("b-mid-5");
  const [activeRole, setActiveRole] = useState<PlayerRole>("MID");
  const [tab, setTab] = useState<"stats" | "look">("stats");
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const rosterRows = useMemo(() => {
    const bluePlayers = (players || []).filter((p) => p.team === "blue");
    const source =
      bluePlayers.length > 0
        ? bluePlayers.map((p) => ({ id: p.id, number: p.number, role: p.role, skinTone: p.skinTone }))
        : DEFAULT_BLUE_ROSTER;
    return [...source].sort((a, b) => {
      const order: Record<PlayerRole, number> = { FWD: 0, WNG: 1, MID: 2, DEF: 3, GK: 4 };
      return order[a.role] - order[b.role] || a.number - b.number;
    });
  }, [players]);

  const selectedRow =
    rosterRows.find((r) => r.id === selectedRowId && r.role === activeRole) ??
    rosterRows.find((r) => r.role === activeRole) ??
    rosterRows[0];

  const roleProg = progression.roles[activeRole];
  const abilities = ABILITIES_BY_ROLE[activeRole];
  const xpIntoLevel = progression.xp % 60;
  const currentRating = computeRoleRating(roleProg);

  useEffect(() => {
    if (!previewCanvasRef.current) return;
    drawPlayerPreviewToCanvas(
      previewCanvasRef.current,
      activeRole,
      "blue",
      selectedRow?.skinTone ?? 0,
      roleProg.appearance
    );
  }, [activeRole, roleProg.appearance, selectedRow?.skinTone]);

  const handleCycleRole = () => {
    const roles: PlayerRole[] = ["GK", "DEF", "MID", "WNG", "FWD"];
    const nextRole = roles[(roles.indexOf(activeRole) + 1) % roles.length];
    setActiveRole(nextRole);
    const match = rosterRows.find((r) => r.role === nextRole);
    if (match) setSelectedRowId(match.id);
  };

  return (
    <Win95Window
      title="Состав команды"
      icon={<SlidersHorizontal className="w-3.5 h-3.5 text-emerald-300 shrink-0" />}
      ariaLabel="Состав команды и прокачка"
      zIndex={zIndex}
      isActive={isActive}
      isMinimized={isMinimized}
      cascadeIndex={cascadeIndex}
      topBoundary={topBoundary}
      defaultWidth={760}
      defaultHeight={590}
      minWidth={320}
      minHeight={380}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      statusBarPanes={[
        { text: `Роль: ${ROLE_META[activeRole].name} · Рейтинг ${currentRating}`, flex: true },
        { text: `Очки: ${progression.skillPoints}` },
        { text: `Опыт: ${xpIntoLevel}/60 XP` },
      ]}
    >
      <div className="p-3 sm:p-4 overflow-y-auto flex-1 bg-[#c0c0c0] text-black">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-3.5 items-start">
          {/* LEFT PANE: Classic Screenshot 1 Roster Table + Player Portrait Footer */}
          <div className="space-y-2.5">
            <div className="pc-field overflow-hidden">
              <div className="grid grid-cols-[36px_1fr_52px_68px] px-2.5 py-1.5 bg-[#dfdfdf] border-b border-[#808080] text-[11px] font-bold text-slate-900">
                <span>№</span>
                <span>Игрок</span>
                <span className="text-center">Поз.</span>
                <span className="text-right">Рейтинг</span>
              </div>
              <div className="max-h-[285px] overflow-y-auto divide-y divide-slate-200">
                {rosterRows.map((row) => {
                  const isSel = selectedRow?.id === row.id;
                  const rating = computeRoleRating(progression.roles[row.role]);
                  const playerName = SQUAD_NAMES_BY_NUM[row.number] || `Игрок #${row.number}`;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => {
                        setSelectedRowId(row.id);
                        setActiveRole(row.role);
                      }}
                      className={`w-full grid grid-cols-[36px_1fr_52px_68px] px-2.5 py-1.5 text-xs text-left items-center cursor-pointer ${
                        isSel
                          ? "bg-[#000080] text-white font-bold"
                          : "bg-white text-black hover:bg-sky-100"
                      }`}
                    >
                      <span className="font-mono tabular-nums">{row.number}</span>
                      <span className="truncate">{playerName}</span>
                      <span className="text-center font-bold">{ROLE_META[row.role].code}</span>
                      <span className="text-right font-mono tabular-nums font-bold">{rating}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Player Portrait Footer (exact Screenshot 1 left bottom card) */}
            <div className="pc-inset p-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="pc-field p-0.5 shrink-0">
                  <PixelPlayerPortrait
                    role={activeRole}
                    team="blue"
                    skinTone={selectedRow?.skinTone ?? 0}
                    appearance={roleProg.appearance}
                    className="w-16 h-16"
                  />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="font-display text-lg font-bold text-[#000080] leading-tight truncate">
                    #{selectedRow?.number ?? 10}{" "}
                    {SQUAD_NAMES_BY_NUM[selectedRow?.number ?? 10] || ROLE_META[activeRole].name}
                  </div>
                  <div className="text-xs font-bold text-slate-900">
                    Позиция: {ROLE_META[activeRole].code} ({ROLE_META[activeRole].chessName})
                  </div>
                  <div className="text-xs font-bold text-emerald-800 font-mono tabular-nums">
                    Рейтинг: {currentRating} · Голы клуба: {progression.goalsScored}
                  </div>
                </div>
              </div>

              <div className="w-14 h-14 pc-inset-dark bg-[#1b6337] flex items-center justify-center shrink-0">
                <canvas
                  ref={previewCanvasRef}
                  width={48}
                  height={56}
                  style={{ imageRendering: "pixelated" }}
                  className="w-11 h-13"
                />
              </div>
            </div>

            <p className="pc-inset px-2.5 py-1.5 text-[11px] text-slate-900 leading-snug">
              <span className="font-bold text-[#000080]">Ход ({ROLE_META[activeRole].name}):</span>{" "}
              {ROLE_META[activeRole].moveSummary}
            </p>
          </div>

          {/* RIGHT PANE: Role Upgrade & Appearance + Win95 Icon Buttons */}
          <div className="space-y-3">
            {/* Status + Role Quick Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="pc-inset px-2.5 py-1 text-xs font-bold text-[#000080] tabular-nums">
                Очки навыков: {progression.skillPoints}
              </div>

              <div className="flex items-end gap-0.5">
                <button
                  type="button"
                  onClick={() => setTab("stats")}
                  className={`px-3 py-1 text-xs font-bold whitespace-nowrap cursor-pointer ${
                    tab === "stats" ? "win95-tab-active" : "win95-tab"
                  }`}
                >
                  Навыки
                </button>
                <button
                  type="button"
                  onClick={() => setTab("look")}
                  className={`px-3 py-1 text-xs font-bold whitespace-nowrap cursor-pointer ${
                    tab === "look" ? "win95-tab-active" : "win95-tab"
                  }`}
                >
                  Внешний вид
                </button>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1">
              {(["GK", "DEF", "MID", "WNG", "FWD"] as PlayerRole[]).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    setActiveRole(role);
                    const match = rosterRows.find((r) => r.role === role);
                    if (match) setSelectedRowId(match.id);
                  }}
                  className={`py-1.5 px-1 text-[11px] font-bold flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
                    activeRole === role ? "pc-btn-active" : "pc-btn"
                  }`}
                >
                  <ChessPieceIcon role={role} className="w-3.5 h-3.5 shrink-0" />
                  <span>{ROLE_META[role].code}</span>
                </button>
              ))}
            </div>

            {tab === "stats" ? (
              <div className="space-y-2.5">
                <div className="space-y-1.5">
                  {STAT_META.map(({ key, label, effect }) => {
                    const lvl = roleProg.stats[key];
                    const canUpgrade = progression.skillPoints >= 1 && lvl < 5;
                    return (
                      <div
                        key={key}
                        className="pc-inset p-2 flex items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-950">{label}</span>
                            <span className="font-mono text-xs font-bold text-blue-900 tabular-nums">
                              {lvl}/5
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-800 leading-snug">{effect}</p>
                          <div className="mt-1 flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((step) => (
                              <div
                                key={step}
                                className={`h-2 w-4 border border-slate-700 ${
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
                          className={`h-7 px-2.5 text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0 ${
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

                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-[#000080]">Уникальные способности</div>
                  {abilities.map((ab) => {
                    const unlocked = roleProg.unlockedAbilities.includes(ab.id);
                    const canUnlock = !unlocked && progression.skillPoints >= ab.cost;
                    return (
                      <div
                        key={ab.id}
                        className={`p-2.5 ${unlocked ? "pc-inset-dark text-white" : "pc-inset text-slate-900"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
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
                              className={`mt-0.5 text-[10px] leading-snug ${
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
                              className={`h-7 px-2 text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0 ${
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
              <div className="space-y-3 pc-inset p-3">
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
                          className={`py-2 px-1.5 text-[11px] font-bold flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
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
                        className={`py-1.5 px-2 text-xs font-bold whitespace-nowrap cursor-pointer ${
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
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                    {(Object.keys(HAIR_LABELS) as HairStyle[]).map((hair) => (
                      <button
                        key={hair}
                        type="button"
                        onClick={() => onUpdateAppearance(activeRole, { hairStyle: hair })}
                        className={`py-1.5 px-1.5 text-[11px] font-bold whitespace-nowrap cursor-pointer ${
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

            {/* Classic Win95 Bottom Action Row matching Screenshot 1 */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={handleCycleRole}
                className="pc-btn py-2 px-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-700" />
                <span>Замена роли</span>
              </button>

              {onOpenTactics ? (
                <button
                  type="button"
                  onClick={onOpenTactics}
                  className="pc-btn py-2 px-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ClipboardList className="w-3.5 h-3.5 text-[#000080]" />
                  <span>Тактика</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setTab(tab === "stats" ? "look" : "stats")}
                  className="pc-btn py-2 px-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ClipboardList className="w-3.5 h-3.5 text-[#000080]" />
                  <span>{tab === "stats" ? "Форма" : "Навыки"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="pc-btn py-2 px-2 text-xs font-bold flex items-center justify-center gap-1.5 text-red-900 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Назад</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Win95Window>
  );
};
