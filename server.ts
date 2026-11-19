import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === "production";

interface CommentaryEventPayload {
  eventType:
    | "kickoff"
    | "move"
    | "pass"
    | "blitz_start"
    | "blitz_win"
    | "blitz_draw"
    | "save"
    | "goal"
    | "match_end";
  team: "blue" | "red";
  playerRole?: string;
  opponentRole?: string;
  blitzSize?: number;
  blitzVariant?: string;
  pitchType?: string;
  complexityReasons?: string[];
  scoreBlue: number;
  scoreRed: number;
  turn: number;
  maxTurns: number;
  winner?: "blue" | "red" | "draw";
}

interface CoachAnalysisPayload {
  pitchType: string;
  difficulty: string;
  scoreBlue: number;
  scoreRed: number;
  turn: number;
  stats: {
    moves: number;
    passes: number;
    shots: number;
    blitzPlayed: number;
    blitzWon: number;
    blitzTimeouts: number;
    mostUsedRole: string;
  };
  squadSummary: Array<{
    role: string;
    speed: number;
    accuracy: number;
    defense: number;
    passing: number;
    abilities: string[];
  }>;
  availablePoints: number;
}

interface CoachAnalysisResult {
  styleSummary: string;
  tacticalAdvice: string[];
  upgradeRecommendation: string;
  source: "gemini" | "local";
}

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    })
  : null;

function buildFallbackCommentary(payload: CommentaryEventPayload): string {
  const teamLabel = payload.team === "blue" ? "Синие" : "Красные";
  const oppLabel = payload.team === "blue" ? "Красных" : "Синих";
  const role = payload.playerRole || "игрок";
  const pitchNote =
    payload.pitchType === "ice"
      ? " на скользком льду"
      : payload.pitchType === "sand"
      ? " на вязком песке"
      : payload.pitchType === "obstacles"
      ? " среди тактических барьеров"
      : "";

  switch (payload.eventType) {
    case "kickoff":
      return `Стартовый свисток${pitchNote}! ${teamLabel} начинают атаку с центра поля — посмотрим, кто первым навяжет блиц-дуэль.`;
    case "pass":
      return `Тонкая передача${pitchNote}! ${teamLabel} выводят на позицию ${role} и перерезают линии обороны ${oppLabel}.`;
    case "blitz_start":
      return `Жёсткий стык (${payload.blitzVariant || `${payload.blitzSize || 3}×${payload.blitzSize || 3}`})! ${role} идёт в дуэль — решает скорость мысли!`;
    case "blitz_win":
      return `Чистая победа в блиц-дуэли! ${teamLabel} забирают мяч под свой контроль — отличный тайминг!`;
    case "blitz_draw":
      return `Боевая ничья на тактической сетке! Владение остаётся за оборонявшим мяч игроком.`;
    case "save":
      return `Невероятный сейв! Оборона ${oppLabel} выигрывает дуэль на линии ворот и забирает мяч!`;
    case "goal":
      return `ГОООЛ! ${teamLabel} взламывают защиту и отправляют мяч в сетку! Счёт ${payload.scoreBlue}:${payload.scoreRed}!`;
    case "match_end":
      if (payload.winner === "draw") {
        return `Финальный свисток! Напряжённая тактическая ничья ${payload.scoreBlue}:${payload.scoreRed}!`;
      }
      return `Матч завершён! ${payload.winner === "blue" ? "Синие" : "Красные"} празднуют победу со счётом ${payload.scoreBlue}:${payload.scoreRed}!`;
    default:
      return `${teamLabel} перестраивают боевые порядки${pitchNote}: ${role} занимает ключевую клетку.`;
  }
}

function buildFallbackCoachAnalysis(payload: CoachAnalysisPayload): CoachAnalysisResult {
  const { stats, pitchType, scoreBlue, scoreRed } = payload;
  const passRatio = stats.moves > 0 ? stats.passes / Math.max(1, stats.moves) : 0;
  const blitzWinRate =
    stats.blitzPlayed > 0 ? Math.round((stats.blitzWon / stats.blitzPlayed) * 100) : 0;

  let styleSummary = "Вы действуете сбалансированно, комбинируя позиционные перестроения и попытки входа в штрафную.";
  if (passRatio >= 0.45) {
    styleSummary = "Комбинационный стиль: вы активно используете перепасовку и растягиваете оборону через открытых партнёров.";
  } else if (stats.blitzPlayed >= 3 && blitzWinRate >= 60) {
    styleSummary = `Агрессивный силовой прессинг: высокий процент побед в блиц-дуэлях (${blitzWinRate}%) позволяет забирать мяч в стыках.`;
  } else if (stats.blitzTimeouts > 0) {
    styleSummary = "Осторожная позиционная игра, но в быстрых блиц-дуэлях не хватает доли секунды на завершающий ход.";
  }

  const tacticalAdvice: string[] = [];
  if (stats.passes < 2 && stats.moves >= 3) {
    tacticalAdvice.push("Чаще используйте пас полузащитником и вингером, чтобы обходить защитников без лишних 4×4 дуэлей.");
  } else {
    tacticalAdvice.push("Продолжайте переводить мяч на свободный фланг — это снижает сложность блиц-дуэлей при входе в штрафную.");
  }

  if (pitchType === "ice") {
    tacticalAdvice.push("На льду используйте скольжение +1 клетку для резких рывков в пустые зоны и дальних передач.");
  } else if (pitchType === "sand") {
    tacticalAdvice.push("На песке обычное движение замедлено — делайте ставку на прыжки Вингера (Конь) и короткий пас.");
  } else if (pitchType === "obstacles") {
    tacticalAdvice.push("Используйте Вингера для перепрыгивания барьеров и открывайте способности навесного паса у Полузащитника.");
  } else {
    tacticalAdvice.push(
      scoreBlue <= scoreRed
        ? "Выводите Форварда к линии штрафной и бейте по воротам, пока вратарь не заблокировал все углы."
        : "Удерживайте Защитника в своей половине, чтобы любые прорывы соперника превращались в сложную сетку 4×4."
    );
  }

  const upgradeRecommendation =
    stats.blitzTimeouts > 0 || blitzWinRate < 50
      ? "Вложите очки навыков в «Защиту» у Защитника/Вратаря (доп. время в блице) или откройте «Холодную голову» у Форварда."
      : passRatio < 0.35
      ? "Прокачайте «Скорость» у Форварда и «Пас» у Полузащитника, чтобы быстрее вскрывать плотную оборону."
      : "Развивайте «Точность» у Форварда и откройте способность «Скрытый пас» у Полузащитника для атак с дальней дистанции.";

  return {
    styleSummary,
    tacticalAdvice,
    upgradeRecommendation,
    source: "local",
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Gemini request timeout")), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function generateGeminiCommentary(
  payload: CommentaryEventPayload
): Promise<{ text: string; source: "gemini" | "local" }> {
  if (!ai) {
    return { text: buildFallbackCommentary(payload), source: "local" };
  }

  const teamLabel = payload.team === "blue" ? "Синие (игрок)" : "Красные (ИИ-агент)";
  const prompt = [
    `Событие: ${payload.eventType}.`,
    `Команда: ${teamLabel}.`,
    payload.pitchType ? `Тип поля: ${payload.pitchType}.` : "",
    payload.playerRole ? `Фигура/роль: ${payload.playerRole}.` : "",
    payload.opponentRole ? `Соперник: ${payload.opponentRole}.` : "",
    payload.blitzVariant ? `Вариант блиц-дуэли: ${payload.blitzVariant}.` : "",
    payload.blitzSize ? `Сетка блица: ${payload.blitzSize}x${payload.blitzSize}.` : "",
    payload.complexityReasons?.length ? `Факторы: ${payload.complexityReasons.join(", ")}.` : "",
    `Счёт: Синие ${payload.scoreBlue} — ${payload.scoreRed} Красные. Ход ${payload.turn} из ${payload.maxTurns}.`,
    payload.winner ? `Итог: ${payload.winner}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            "Ты харизматичный российский футбольный комментатор матча «Шахматный Блиц-Футбол», где игроки ходят как шахматные фигуры на разных типах полей (газон, лёд, песок, барьеры), а столкновения решаются в быстрые крестики-нолики. Ответь 1–2 живыми фразами на русском (до 155 символов), без хэштегов, без эмодзи и без кавычек.",
        },
      }),
      6500
    );
    const text = (response.text || "").trim();
    if (!text) {
      return { text: buildFallbackCommentary(payload), source: "local" };
    }
    return { text, source: "gemini" };
  } catch (err) {
    console.warn("Gemini commentary fallback:", err instanceof Error ? err.message : err);
    return { text: buildFallbackCommentary(payload), source: "local" };
  }
}

async function generateGeminiCoachAnalysis(
  payload: CoachAnalysisPayload
): Promise<CoachAnalysisResult> {
  if (!ai) {
    return buildFallbackCoachAnalysis(payload);
  }

  const prompt = JSON.stringify(payload);

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: `Данные матча и состава игрока (Синие): ${prompt}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            "Ты элитный ИИ-тренер по тактическому «Блиц-Футболу». Проанализируй статистику игрока, тип поля, счёт и текущую прокачку фигур. Дай чёткий, конкретный анализ стиля, 2 практических тактических совета на матч и 1 персональную рекомендацию по прокачке характеристик (Скорость, Точность, Защита, Пас) или уникальных способностей фигур. Пиши лаконично по-русски.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              styleSummary: {
                type: Type.STRING,
                description: "Краткий разбор стиля игры пользователя (1–2 предложения).",
              },
              tacticalAdvice: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "2 конкретных тактических совета с учётом поля и статистики.",
              },
              upgradeRecommendation: {
                type: Type.STRING,
                description: "Персональный совет, какую фигуру, характеристику или способность прокачать дальше.",
              },
            },
            required: ["styleSummary", "tacticalAdvice", "upgradeRecommendation"],
          },
        },
      }),
      6500
    );

    const raw = (response.text || "").trim();
    if (!raw) return buildFallbackCoachAnalysis(payload);
    const parsed = JSON.parse(raw) as Omit<CoachAnalysisResult, "source">;
    if (!parsed.styleSummary || !Array.isArray(parsed.tacticalAdvice)) {
      return buildFallbackCoachAnalysis(payload);
    }
    return {
      styleSummary: parsed.styleSummary,
      tacticalAdvice: parsed.tacticalAdvice.slice(0, 3),
      upgradeRecommendation: parsed.upgradeRecommendation,
      source: "gemini",
    };
  } catch (err) {
    console.warn("Gemini coach analysis fallback:", err instanceof Error ? err.message : err);
    return buildFallbackCoachAnalysis(payload);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.post("/api/commentary", async (req, res) => {
    const payload = req.body as CommentaryEventPayload;
    if (!payload || !payload.eventType) {
      res.status(400).json({ error: "Invalid event payload" });
      return;
    }
    const result = await generateGeminiCommentary(payload);
    res.json(result);
  });

  app.post("/api/coach-analysis", async (req, res) => {
    const payload = req.body as CoachAnalysisPayload;
    if (!payload || !payload.stats) {
      res.status(400).json({ error: "Invalid coach payload" });
      return;
    }
    const result = await generateGeminiCoachAnalysis(payload);
    res.json(result);
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, geminiConfigured: Boolean(ai) });
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("/{*path}", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
