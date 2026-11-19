import React, { useEffect, useState } from "react";
import {
  AIDifficulty,
  CoachAnalysis,
  MatchStats,
  PITCH_META,
  PitchType,
  PlayerRole,
  ROLE_META,
  SquadProgressionState,
} from "../types/game";
import { BrainCircuit, Check, RefreshCw, SlidersHorizontal } from "lucide-react";
import { Win95Window } from "./Win95Window";
import { PixelCoachPortrait } from "./Win95Art";

interface CoachModalProps {
  pitchType: PitchType;
  difficulty: AIDifficulty;
  scoreBlue: number;
  scoreRed: number;
  turnCount: number;
  stats: MatchStats;
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
          stats: {
            moves: stats.moves,
            passes: stats.passes,
            shots: stats.shots,
            blitzPlayed: stats.blitzPlayed,
            blitzWon: stats.blitzWon,
            blitzTimeouts: stats.blitzTimeouts,
            mostUsedRole: ROLE_META[mostUsedRole].name,
          },
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
      }
    } catch {
      setAnalysis({
        styleSummary:
          "Попробуйте больше использовать фланги. Соперник уязвим на краях поля и открывает зоны для рывка.",
        tacticalAdvice: [
          `Учитывайте особенности покрытия «${PITCH_META[pitchType].name}» при планировании рывков.`,
          "Используйте Вингера (Конь) для неожиданного выхода на фланг штрафной.",
        ],
        upgradeRecommendation:
          "Улучшите «Скорость» у Форварда или «Пас» у Полузащитника в разделе Команды.",
        source: "local",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, []);

  const blitzWinPct =
    stats.blitzPlayed > 0 ? Math.round((stats.blitzWon / stats.blitzPlayed) * 100) : 0;

  return (
    <Win95Window
      title="Советы тренера"
      icon={<BrainCircuit className="w-3.5 h-3.5 text-amber-200 shrink-0" />}
      ariaLabel="Советы тренера"
      zIndex={zIndex}
      isActive={isActive}
      isMinimized={isMinimized}
      cascadeIndex={cascadeIndex}
      topBoundary={topBoundary}
      defaultWidth={560}
      defaultHeight={460}
      minWidth={320}
      minHeight={320}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      statusBarPanes={[
        { text: `Счёт ${scoreBlue}:${scoreRed} · Ход ${turnCount} · ${PITCH_META[pitchType].name}`, flex: true },
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
      <div className="p-3.5 sm:p-4 flex-1 overflow-y-auto flex items-center justify-center bg-[#c0c0c0]">
        <div className="w-full max-w-2xl space-y-3">
          {/* Top Coach Card matching Screenshot 1 (Portrait left + White Win95 speech box right) */}
          <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-3 items-stretch">
            <div className="pc-field p-1.5 bg-[#7da7e2] flex items-center justify-center shrink-0">
              <PixelCoachPortrait className="w-28 h-28 sm:w-32 sm:h-32" />
            </div>

            <div className="pc-field p-3 flex flex-col justify-between gap-2 text-black min-h-[144px]">
              {loading ? (
                <div className="text-xs font-bold text-[#000080] py-6 text-center">
                  ИИ-Тренер изучает расстановку и телеметрию матча...
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
                      План прокачки: <span className="font-medium text-slate-900">{analysis.upgradeRecommendation}</span>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Match Telemetry Bar */}
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: "Ходы", val: stats.moves },
              { label: "Пасы", val: stats.passes },
              { label: "Удары", val: stats.shots },
              { label: "Блиц %", val: `${blitzWinPct}%` },
            ].map((item) => (
              <div key={item.label} className="pc-inset-dark py-2 px-1">
                <div className="font-display text-xl font-bold tabular-nums text-emerald-300">
                  {item.val}
                </div>
                <div className="text-[11px] text-slate-300">{item.label}</div>
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
              <span>Обновить совет</span>
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
                className="pc-btn-primary px-6 py-1.5 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>OK</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Win95Window>
  );
};
