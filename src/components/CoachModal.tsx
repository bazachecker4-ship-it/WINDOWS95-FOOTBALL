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
import { BrainCircuit, RefreshCw, SlidersHorizontal, X } from "lucide-react";

interface CoachModalProps {
  pitchType: PitchType;
  difficulty: AIDifficulty;
  scoreBlue: number;
  scoreRed: number;
  turnCount: number;
  stats: MatchStats;
  progression: SquadProgressionState;
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Разбор от ИИ-Тренера"
    >
      <div className="w-full max-w-xl pc-window p-1">
        <div className="pc-titlebar px-3 py-1.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <BrainCircuit className="w-4 h-4 shrink-0" />
            <span className="font-display text-base font-bold truncate">
              AI_COACH.SYS — Тактический разбор
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть разбор тренера"
            className="pc-btn w-6 h-6 flex items-center justify-center cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
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
              onClick={() => {
                onClose();
                onOpenSquad();
              }}
              className="pc-btn-primary px-4 py-1.5 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Команда ({progression.skillPoints})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
