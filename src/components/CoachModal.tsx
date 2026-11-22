import React, { useEffect, useState } from "react";
import {
  AIDifficulty,
  CoachAnalysis,
  MatchMistakeEvent,
  MatchStats,
  PITCH_META,
  PitchType,
  PlayerRole,
  ROLE_META,
  SquadProgressionState,
} from "../types/game";
import { AlertTriangle, BrainCircuit, Check, Play, RefreshCw, SlidersHorizontal } from "lucide-react";
import { Win95Window } from "./Win95Window";
import { PixelCoachPortrait } from "./Win95Art";

interface CoachModalProps {
  pitchType: PitchType;
  difficulty: AIDifficulty;
  scoreBlue: number;
  scoreRed: number;
  turnCount: number;
  stats: MatchStats;
  mistakes?: MatchMistakeEvent[];
  isHalftime?: boolean;
  progression: SquadProgressionState;
  zIndex: number;
  isActive: boolean;
  isMinimized?: boolean;
  cascadeIndex?: number;
  topBoundary?: number;
  onFocus: () => void;
  onMinimize?: () => void;
  onOpenSquad: () => void;
  onClose: () => void;
}

export const CoachModal: React.FC<CoachModalProps> = ({
  pitchType,
  difficulty,
  scoreBlue,
  scoreRed,
  turnCount,
  stats,
  mistakes = [],
  isHalftime = false,
  progression,
  zIndex,
  isActive,
  isMinimized,
  cascadeIndex = 4,
  topBoundary = 42,
  onFocus,
  onMinimize,
  onOpenSquad,
  onClose,
}) => {
  const [analysis, setAnalysis] = useState<CoachAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  const mostUsedRole = (Object.entries(stats.roleMoves) as Array<[PlayerRole, number]>).sort(
    (a, b) => b[1] - a[1]
  )[0][0];

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/coach-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pitchType,
          difficulty,
          scoreBlue,
          scoreRed,
          turn: turnCount,
          isHalftime,
          stats: {
            moves: stats.moves,
            passes: stats.passes,
            shots: stats.shots,
            offsides: stats.offsides,
            turnTimeouts: stats.turnTimeouts,
            blitzPlayed: stats.blitzPlayed,
            blitzWon: stats.blitzWon,
            blitzTimeouts: stats.blitzTimeouts,
            mostUsedRole: ROLE_META[mostUsedRole].name,
          },
          mistakes: mistakes.slice(0, 8).map((m) => ({
            playerLabel: m.playerLabel,
            type: m.type,
            detail: m.detail,
            turn: m.turn,
          })),
          squadSummary: (["GK", "DEF", "MID", "WNG", "FWD"] as PlayerRole[]).map((role) => ({
            role: ROLE_META[role].name,
            ...progression.roles[role].stats,
            abilities: progression.roles[role].unlockedAbilities,
          })),
          availablePoints: progression.skillPoints,
        }),
      });
      if (resp.ok) {
        const data = (await resp.json()) as CoachAnalysis;
        setAnalysis(data);
        return;
      }
      throw new Error("Bad response");
    } catch {
      const playerErrors = mistakes.slice(0, 3).map((m) => ({
        player: m.playerLabel,
        issue: m.detail,
        fix:
          m.type === "offside"
            ? "Контролируйте пунктирную линию офсайда перед пасом."
            : m.type === "timeout" || m.type === "blitz_timeout"
            ? "Планируйте ключевой пас или удар в первые 8 секунд хода."
            : "Используйте пас в свободную зону вместо лобового стыка.",
      }));
      setAnalysis({
        styleSummary: isHalftime
          ? `Перерыв (${scoreBlue}:${scoreRed}). Время скорректировать схему и восстановить темп во 2-м тайме.`
          : "Попробуйте больше использовать фланги. Соперник уязвим на краях поля и открывает зоны для рывка.",
        tacticalAdvice: [
          `Учитывайте особенности покрытия «${PITCH_META[pitchType].name}» и запас AP у игроков центра.`,
          "Используйте Вингера (Конь) для неожиданного выхода на фланг штрафной.",
        ],
        upgradeRecommendation:
          "Улучшите «Скорость» у Форварда или «Пас» у Полузащитника в разделе Команды.",
        isHalftime,
        mistakeReport: {
          overview:
            mistakes.length > 0
              ? `В 1-м тайме отмечено ${mistakes.length} тактических ошибок (офсайды: ${stats.offsides}, тайм-ауты: ${stats.turnTimeouts}).`
              : "Критичных срывов не допущено — держите компактность и реализуйте моменты.",
          playerErrors,
          secondHalfPlan:
            scoreBlue < scoreRed
              ? "Перейдите на атакующий прессинг и грузите мяч на фланги."
              : "Комбинируйте короткие пасы за 1-2 AP и берегите выносливость.",
        },
        source: "local",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [isHalftime, turnCount]);

  const blitzWinPct =
    stats.blitzPlayed > 0 ? Math.round((stats.blitzWon / stats.blitzPlayed) * 100) : 0;

  return (
    <Win95Window
      title={isHalftime ? "Перерыв — Разбор тренера" : "Советы тренера"}
      icon={<BrainCircuit className="w-3.5 h-3.5 text-amber-200 shrink-0" />}
      ariaLabel="Советы тренера"
      zIndex={zIndex}
      isActive={isActive}
      isMinimized={isMinimized}
      cascadeIndex={cascadeIndex}
      topBoundary={topBoundary}
      defaultWidth={600}
      defaultHeight={isHalftime ? 540 : 490}
      minWidth={320}
      minHeight={340}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      statusBarPanes={[
        {
          text: `${isHalftime ? "ПЕРЕРЫВ · " : ""}Счёт ${scoreBlue}:${scoreRed} · Ход ${turnCount} · ${PITCH_META[pitchType].name}`,
          flex: true,
        },
        {
          text:
            analysis?.source === "groq"
              ? "Groq AI: ONLINE"
              : analysis?.source === "gemini"
              ? "Gemini AI: ONLINE"
              : "Тренер-штаб: 95",
        },
      ]}
    >
      <div className="p-3 sm:p-4 flex-1 overflow-y-auto bg-[#c0c0c0]">
        <div className="w-full max-w-2xl mx-auto space-y-3">
          {isHalftime && (
            <div className="pc-inset-dark px-3 py-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="font-display font-bold text-amber-300">
                СВИСТОК НА ПЕРЕРЫВ · ТАЙМ 1 ЗАВЕРШЁН
              </span>
              <span className="font-mono text-[11px] text-emerald-300 font-bold">
                +25% выносливости игрокам
              </span>
            </div>
          )}

          {/* Top Coach Card */}
          <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3 items-stretch">
            <div className="pc-field p-1.5 bg-[#7da7e2] flex items-center justify-center shrink-0">
              <PixelCoachPortrait className="w-24 h-24 sm:w-28 sm:h-28" />
            </div>

            <div className="pc-field p-3 flex flex-col justify-between gap-2 text-black min-h-[132px]">
              {loading ? (
                <div className="text-xs font-bold text-[#000080] py-6 text-center">
                  Groq ИИ-Тренер анализирует ошибки игроков и тактику тайма...
                </div>
              ) : (
                analysis && (
                  <div className="space-y-2 text-xs leading-relaxed">
                    <p className="font-bold text-slate-950 text-[13px]">{analysis.styleSummary}</p>
                    <ul className="space-y-1 text-slate-800">
                      {analysis.tacticalAdvice.map((tip, idx) => (
                        <li key={idx} className="leading-snug">
                          • {tip}
                        </li>
                      ))}
                    </ul>
                    <div className="pt-1.5 border-t border-slate-300 text-[11px] font-bold text-[#000080]">
                      План прокачки:{" "}
                      <span className="font-medium text-slate-900">
                        {analysis.upgradeRecommendation}
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Groq Player Error Breakdown Section */}
          {!loading && analysis?.mistakeReport && (
            <fieldset className="win95-groupbox space-y-2 text-black">
              <legend className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                <span>Разбор ошибок игроков ({analysis.source === "groq" ? "Groq AI" : "Штаб"})</span>
              </legend>
              <p className="text-xs font-bold text-slate-900">{analysis.mistakeReport.overview}</p>

              {analysis.mistakeReport.playerErrors.length > 0 && (
                <div className="space-y-1.5">
                  {analysis.mistakeReport.playerErrors.map((err, i) => (
                    <div key={i} className="pc-field p-2 text-[11px] space-y-0.5">
                      <div className="font-bold text-red-900">
                        {err.player} — <span className="text-slate-900">{err.issue}</span>
                      </div>
                      <div className="text-[#000080] font-bold">Исправление: {err.fix}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pc-inset px-2.5 py-1.5 text-[11px] font-bold text-emerald-950">
                План на 2-й тайм: {analysis.mistakeReport.secondHalfPlan}
              </div>
            </fieldset>
          )}

          {/* Match Telemetry Bar */}
          <div className="grid grid-cols-5 gap-1.5 text-center">
            {[
              { label: "Ходы", val: stats.moves },
              { label: "Пасы", val: stats.passes },
              { label: "Удары", val: stats.shots },
              { label: "Офсайды", val: stats.offsides },
              { label: "Блиц %", val: `${blitzWinPct}%` },
            ].map((item) => (
              <div key={item.label} className="pc-inset-dark py-1.5 px-1">
                <div className="font-display text-lg font-bold tabular-nums text-emerald-300">
                  {item.val}
                </div>
                <div className="text-[10px] text-slate-300 truncate">{item.label}</div>
              </div>
            ))}
          </div>

          {/* Classic Win95 Bottom Actions */}
          <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={fetchAnalysis}
              disabled={loading}
              className="pc-btn px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Обновить разбор</span>
            </button>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onOpenSquad}
                className="pc-btn px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#000080]" />
                <span>Состав ({progression.skillPoints})</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="pc-btn-primary px-5 py-1.5 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                {isHalftime ? <Play className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                <span>{isHalftime ? "Начать 2-й тайм" : "OK"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Win95Window>
  );
};
