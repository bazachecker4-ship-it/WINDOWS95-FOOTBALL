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
import { BrainCircuit, RefreshCw, SlidersHorizontal } from "lucide-react";
import { Win95Window } from "./Win95Window";

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
  topBoundary = 40,
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
          "Вы развиваете атаки через центр поля. Добавьте больше диагональных пасов, чтобы обходить защитников без сложных дуэлей.",
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
      title="AI_COACH.SYS — Тактический разбор"
      icon={<BrainCircuit className="w-3.5 h-3.5 shrink-0" />}
      ariaLabel="Разбор от ИИ-Тренера"
      zIndex={zIndex}
      isActive={isActive}
      isMinimized={isMinimized}
      cascadeIndex={cascadeIndex}
      topBoundary={topBoundary}
      defaultWidth={580}
      defaultHeight={530}
      minWidth={320}
      minHeight={340}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      statusBarPanes={[
        { text: `Счёт ${scoreBlue}:${scoreRed} · Ход ${turnCount}`, flex: true },
        {
          text:
            analysis?.source === "groq"
              ? "Groq AI: ONLINE"
              : analysis?.source === "gemini"
              ? "Gemini AI: ONLINE"
              : "Анализ: LOCAL",
        },
      ]}
    >
      <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <div className="text-xs text-slate-800 font-medium">
            Покрытие: {PITCH_META[pitchType].name} · Ведущая фигура: {ROLE_META[mostUsedRole].name}
          </div>

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
                <div className="text-[11px] text-slate-400">{item.label}</div>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="pc-inset-dark py-8 text-center text-xs text-emerald-300">
              C:\COACH&gt; Анализ телеметрии матча...
            </div>
          ) : (
            analysis && (
              <div className="space-y-2.5">
                <div className="pc-inset-dark p-3">
                  <div className="text-xs font-bold text-sky-300 mb-1">
                    Анализ стиля игры
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {analysis.styleSummary}
                  </p>
                </div>

                <div className="pc-inset-dark p-3">
                  <div className="text-xs font-bold text-emerald-300 mb-1">
                    Тактические рекомендации
                  </div>
                  <ul className="space-y-1 text-xs text-slate-200">
                    {analysis.tacticalAdvice.map((tip, idx) => (
                      <li key={idx} className="leading-snug">
                        {idx + 1}. {tip}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pc-inset-dark p-3">
                  <div className="text-xs font-bold text-amber-300 mb-1">
                    План прокачки фигур
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {analysis.upgradeRecommendation}
                  </p>
                </div>
              </div>
            )
          )}

          <div className="pt-1 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={fetchAnalysis}
              disabled={loading}
              className="pc-btn px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Обновить</span>
            </button>

            <button
              type="button"
              onClick={onOpenSquad}
              className="pc-btn-primary px-4 py-1.5 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Команда ({progression.skillPoints})</span>
            </button>
          </div>
        </div>
    </Win95Window>
  );
};
