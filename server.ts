import "dotenv/config";
import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import {
  BLITZ_PACE_MS,
  MAX_TURNS,
  PITCH_COLS,
  ROLE_META,
  TARGET_GOALS,
} from "./src/types/game.ts";
import type {
  AIDifficulty,
  ActiveBlitzDuel,
  BallState,
  BlitzComplexity,
  BlitzModePreference,
  BlitzPace,
  CoachMistakeItem,
  CommentaryItem,
  LiveMatchSummary,
  LobbyChatMessage,
  MatchMistakeEvent,
  MultiplayerRoomInfo,
  OnlineUserInfo,
  PitchType,
  PlayerPiece,
  Position,
  ServerDuelState,
  ServerMatchSnapshot,
  Team,
} from "./src/types/game.ts";
import {
  applyDynamicOffBallRuns,
  computeBestTacticalMove,
  computeDuelBonusTimes,
  createInitialFormation,
  findSafeKnockbackSquare,
  getShotOptions,
  getValidMoves,
  getValidPasses,
  samePos,
  updateSquadStamina,
} from "./src/engine/footballEngine.ts";
import {
  checkBlitzWinner,
  chooseBlitzAIMove,
  generateWinLines,
} from "./src/engine/blitzAi.ts";
import type { BlitzCell } from "./src/engine/blitzAi.ts";

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
  isHalftime?: boolean;
  stats: {
    moves: number;
    passes: number;
    shots: number;
    offsides?: number;
    turnTimeouts?: number;
    blitzPlayed: number;
    blitzWon: number;
    blitzTimeouts: number;
    mostUsedRole: string;
  };
  mistakes?: MatchMistakeEvent[];
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
  isHalftime?: boolean;
  mistakeReport?: {
    overview: string;
    playerErrors: CoachMistakeItem[];
    secondHalfPlan: string;
  };
  source: "gemini" | "groq" | "local";
}

interface AIAgentMovePayload {
  team: Team;
  players: PlayerPiece[];
  ball: BallState;
  difficulty: AIDifficulty;
  pitchType: PitchType;
  blitzModePref: BlitzModePreference;
  scoreBlue: number;
  scoreRed: number;
  turnCount: number;
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

const GEMINI_MODEL = "gemini-3.1-flash-lite";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_PRIMARY_MODEL = "openai/gpt-oss-120b";
const GROQ_FAST_MODEL = "openai/gpt-oss-20b";
let geminiCooldownUntil = 0;
let groqCooldownUntil = 0;
let lastCommentaryCallAt = 0;
const MIN_COMMENTARY_INTERVAL_MS = 14000;

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function parseRetryCooldownMs(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (msg.includes("PerDay") || msg.includes("limit: 20") || msg.includes("daily")) {
    return 15 * 60 * 1000;
  }
  const match = msg.match(/retryDelay["']?\s*[:=]\s*["']?(\d+)s/i) || msg.match(/retry in (\d+(?:\.\d+)?)s/i);
  if (match) {
    const sec = Math.ceil(Number(match[1]));
    if (Number.isFinite(sec) && sec > 0) {
      return Math.min(300_000, Math.max(30_000, (sec + 5) * 1000));
    }
  }
  if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
    return 90_000;
  }
  return 45_000;
}

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
      return pickRandom([
        `Стартовый свисток${pitchNote}! ${teamLabel} начинают атаку с центра поля — посмотрим, кто первым навяжет блиц-дуэль.`,
        `Поехали! Команды 11 на 11 занимают позиции${pitchNote}, мяч в центре ждёт первого рывка.`,
      ]);
    case "pass":
      return pickRandom([
        `Тонкая передача${pitchNote}! ${teamLabel} выводят на позицию ${role} и перерезают линии обороны ${oppLabel}.`,
        `Отличный перевод мяча! ${role} получает снаряд в свободной зоне и разгоняет атаку.`,
        `В одно касание! ${teamLabel} растягивают защиту соперника через ${role}.`,
      ]);
    case "blitz_start":
      return pickRandom([
        `Жёсткий стык (${payload.blitzVariant || `${payload.blitzSize || 3}×${payload.blitzSize || 3}`})! ${role} идёт в дуэль — решает скорость мысли!`,
        `Искры на газоне! ${role} сходится с обороной в блиц-дуэли ${payload.blitzSize || 3}×${payload.blitzSize || 3}!`,
      ]);
    case "blitz_win":
      return pickRandom([
        `Чистая победа в блиц-дуэли! ${teamLabel} забирают мяч под свой контроль — отличный тайминг!`,
        `Хладнокровный расчёт! ${teamLabel} переигрывают оппонента на тактической сетке.`,
      ]);
    case "blitz_draw":
      return `Боевая ничья на тактической сетке! Владение остаётся за оборонявшим мяч игроком.`;
    case "save":
      return pickRandom([
        `Невероятный сейв! Оборона ${oppLabel} выигрывает дуэль на линии ворот и забирает мяч!`,
        `Стена на последнем рубеже! Вратарь ${oppLabel} читает удар и спасает команду!`,
      ]);
    case "goal":
      return pickRandom([
        `ГОООЛ! ${teamLabel} взламывают защиту и отправляют мяч в сетку! Счёт ${payload.scoreBlue}:${payload.scoreRed}!`,
        `ШЕДЕВР! ${role} завершает комбинацию точным ударом — ${payload.scoreBlue}:${payload.scoreRed}!`,
      ]);
    case "match_end":
      if (payload.winner === "draw") {
        return `Финальный свисток! Напряжённая тактическая ничья ${payload.scoreBlue}:${payload.scoreRed}!`;
      }
      return `Матч завершён! ${payload.winner === "blue" ? "Синие" : "Красные"} празднуют победу со счётом ${payload.scoreBlue}:${payload.scoreRed}!`;
    default:
      return pickRandom([
        `${teamLabel} перестраивают боевые порядки${pitchNote}: ${role} занимает ключевую клетку.`,
        `Грамотный манёвр! ${role} смещается по флангу и открывает новые линии для паса.`,
        `${teamLabel} наращивают давление${pitchNote}: ${role} выдвигается ближе к штрафной.`,
      ]);
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
    tacticalAdvice.push("Чаще используйте пас полузащитником и вингером, чтобы обходить защитников без лишних 4×4 дуэлей и беречь выносливость.");
  } else {
    tacticalAdvice.push("Чередуйте рывки свежими игроками и переводы на фланг — уставшие игроки теряют 1 клетку дальности.");
  }

  if (pitchType === "ice") {
    tacticalAdvice.push("На льду используйте скольжение +2 клетки для резких рывков в пустые зоны и дальних передач.");
  } else if (pitchType === "sand") {
    tacticalAdvice.push("На песке обычное движение замедлено — делайте ставку на прыжки Вингера (Конь) и короткий пас.");
  } else if (pitchType === "obstacles") {
    tacticalAdvice.push("Используйте Вингера для перепрыгивания барьеров и открывайте способности навесного паса у Полузащитника.");
  } else {
    tacticalAdvice.push(
      scoreBlue <= scoreRed
        ? "Накопите 100% Импульса и бейте «Супер-Ударом» — он упрощает дуэль с вратарём и даёт бонусное время."
        : "Удерживайте Защитника в своей половине, чтобы любые прорывы соперника превращались в сложную сетку 4×4."
    );
  }

  const upgradeRecommendation =
    stats.blitzTimeouts > 0 || blitzWinRate < 50
      ? "Вложите очки навыков в «Защиту» у Защитника/Вратаря (доп. время в блице) или откройте «Холодную голову» у Форварда."
      : passRatio < 0.35
      ? "Прокачайте «Скорость» у Форварда и «Пас» у Полузащитника, чтобы быстрее вскрывать плотную оборону."
      : "Развивайте «Точность» у Форварда и откройте способность «Голевое чутьё» для упрощения ударного блица.";

  const mistakes = Array.isArray(payload.mistakes) ? payload.mistakes : [];
  const playerErrors: CoachMistakeItem[] = [];
  for (const m of mistakes.slice(-4)) {
    const fix =
      m.type === "offside"
        ? "Выдерживайте линию предпоследнего защитника и отдавайте пас на ход чуть раньше."
        : m.type === "timeout"
        ? "Принимайте быстрый базовый ход (1–2 AP) до истечения таймера ситуации."
        : m.type === "blitz_timeout"
        ? "Не затягивайте решение на сетке блица — берите центр или угол сразу."
        : m.type === "fatigue"
        ? "Переключайтесь на свежих фланговых игроков и берегите выносливость."
        : "Избегайте рискованных стыков без поддержки и используйте пас в свободную зону.";
    playerErrors.push({
      player: m.playerLabel,
      issue: m.detail,
      fix,
    });
  }

  if (playerErrors.length === 0) {
    if ((stats.offsides ?? 0) > 0) {
      playerErrors.push({
        player: "ФРВ / Фланги",
        issue: `Зафиксировано ${stats.offsides} попаданий в офсайд при обостряющих передачах.`,
        fix: "Оттягивайте форварда на полшага ближе к центру перед длинным пасом.",
      });
    } else if (stats.blitzTimeouts > 0 || (stats.turnTimeouts ?? 0) > 0) {
      playerErrors.push({
        player: "Полузащита",
        issue: "Потери инициативы из-за нехватки времени на раздумье.",
        fix: "Заранее планируйте серию действий (Пас 2 AP + Открывание 1 AP) по подсветке на поле.",
      });
    } else if (stats.shots === 0 && stats.moves >= 4) {
      playerErrors.push({
        player: "Атакующая линия",
        issue: "Много перестроений без доведения атаки до ударной зоны.",
        fix: "Переводите мяч вингерам или форварду ближе к штрафной и бейте в створ (3 AP).",
      });
    } else {
      playerErrors.push({
        player: stats.mostUsedRole || "Команда",
        issue: "Позиционная игра дисциплинированная, грубых провалов в 1-м тайме не выявлено.",
        fix: "Увеличьте темп комбинаций через полузащиту (6 AP) во 2-м тайме.",
      });
    }
  }

  const secondHalfPlan =
    scoreBlue < scoreRed
      ? "Во 2-м тайме включите высокий прессинг, задействуйте вингеров с большим запасом AP и копите Импульс на Супер-удар."
      : scoreBlue > scoreRed
      ? "Контролируйте мяч короткими пасами за 1–2 AP, не открывайте тыл и сохраняйте компактность обороны."
      : "Играйте через треугольники в центре поля и ловите соперника на быстрых контратаках после перехвата.";

  const overview = payload.isHalftime
    ? `Разбор 1-го тайма (${scoreBlue}:${scoreRed}): зафиксировано ${mistakes.length} тактических недочётов. Отдохнувший состав готов ко 2-му тайму.`
    : `Текущий разбор (${scoreBlue}:${scoreRed}): проанализированы действия состава и тайминги.`;

  return {
    styleSummary,
    tacticalAdvice,
    upgradeRecommendation,
    isHalftime: payload.isHalftime,
    mistakeReport: {
      overview,
      playerErrors,
      secondHalfPlan,
    },
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

async function callGroqChat<T>(
  systemPrompt: string,
  userPrompt: string,
  options: { model?: string; timeoutMs?: number; jsonMode?: boolean; maxTokens?: number } = {}
): Promise<T | null> {
  if (!GROQ_API_KEY || Date.now() < groqCooldownUntil) return null;
  const requestedModel = options.model ?? GROQ_FAST_MODEL;
  const attempt = async (modelId: string): Promise<T | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 4500);
    try {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: modelId,
          temperature: 0.35,
          max_tokens: options.maxTokens ?? 550,
          reasoning_effort: "low",
          ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });
      if (resp.status === 429) {
        groqCooldownUntil = Date.now() + 25_000;
        return null;
      }
      if (!resp.ok) return null;
      const data = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) return null;
      if (options.jsonMode) {
        const cleaned = content.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
        return JSON.parse(cleaned) as T;
      }
      return content as unknown as T;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const first = await attempt(requestedModel);
  if (first !== null) return first;
  if (requestedModel !== GROQ_FAST_MODEL) {
    return attempt(GROQ_FAST_MODEL);
  }
  return null;
}

async function generateGroqAgentMove(payload: AIAgentMovePayload) {
  const { team, players, ball, difficulty, pitchType, blitzModePref, scoreBlue, scoreRed, turnCount } = payload;
  const fallbackHint = computeBestTacticalMove(team, players, ball, difficulty, pitchType, blitzModePref);
  if (!fallbackHint) {
    return { hint: null, source: "local" as const, tacticBadge: "Позиция" };
  }

  // Gather candidate actions for Groq tactical ranking
  const myPlayers = players.filter((p) => p.team === team);
  const enemyPlayers = players.filter((p) => p.team !== team);
  const attackDir = team === "blue" ? 1 : -1;
  const targetGoalCol = team === "blue" ? PITCH_COLS - 1 : 0;

  interface CandidateOption {
    actionType: "move" | "pass" | "shoot";
    playerId: string;
    targetPos?: Position;
    targetPlayerId?: string;
    goalRow?: number;
    summary: string;
    heuristicScore: number;
  }

  const options: CandidateOption[] = [];
  const carrier = ball.carrierId ? players.find((p) => p.id === ball.carrierId) ?? null : null;

  const minEnemyDist = (pos: Position) =>
    Math.min(...enemyPlayers.map((e) => Math.hypot(e.pos.col - pos.col, e.pos.row - pos.row)));

  for (const p of myPlayers) {
    const isCarrier = carrier?.id === p.id;
    if (isCarrier) {
      for (const s of getShotOptions(p, players, ball, pitchType, blitzModePref, undefined, difficulty)) {
        options.push({
          actionType: "shoot",
          playerId: p.id,
          goalRow: s.goalRow,
          summary: `УДАР: ${ROLE_META[p.role].code}#${p.number} (${p.pos.col},${p.pos.row}) -> угол ${s.goalRow}, ${s.isContested ? `блиц ${s.complexity?.size ?? 4}x${s.complexity?.size ?? 4}` : "ПУСТОЙ УГОЛ"}`,
          heuristicScore: s.isContested ? 200 : 1200,
        });
      }
      for (const ps of getValidPasses(p, players, ball, pitchType, undefined, difficulty)) {
        const rec = myPlayers.find((m) => m.id === ps.targetPlayerId);
        if (!rec || rec.role === "GK") continue;
        const prog = (rec.pos.col - p.pos.col) * attackDir;
        const space = minEnemyDist(rec.pos);
        options.push({
          actionType: "pass",
          playerId: p.id,
          targetPlayerId: rec.id,
          targetPos: rec.pos,
          summary: `ПАС: ${ROLE_META[p.role].code}#${p.number} -> ${ROLE_META[rec.role].code}#${rec.number} (${rec.pos.col},${rec.pos.row}), вперёд:${prog > 0 ? `+${prog}` : prog}, рядом враг:${space.toFixed(1)}`,
          heuristicScore: 40 + prog * 9 + space * 4,
        });
      }
    }

    const moves = getValidMoves(p, players, ball, pitchType, blitzModePref, undefined, difficulty);
    for (const mv of moves) {
      const fwd = (mv.pos.col - p.pos.col) * attackDir;
      const goalDist = Math.hypot(mv.pos.col - targetGoalCol, mv.pos.row - 16);
      if (mv.kind === "pickup") {
        options.push({
          actionType: "move",
          playerId: p.id,
          targetPos: mv.pos,
          summary: `ПОДБОР: ${ROLE_META[p.role].code}#${p.number} -> (${mv.pos.col},${mv.pos.row})`,
          heuristicScore: 260 + fwd * 6,
        });
      } else if (mv.kind === "clash") {
        const opp = enemyPlayers.find((e) => e.id === mv.opponentId);
        const oppHasBall = opp?.id === ball.carrierId;
        if (!oppHasBall && !isCarrier) continue;
        options.push({
          actionType: "move",
          playerId: p.id,
          targetPos: mv.pos,
          summary: `СТЫК: ${ROLE_META[p.role].code}#${p.number} атакует ${opp ? ROLE_META[opp.role].code : ""} (${mv.pos.col},${mv.pos.row}), блиц ${mv.complexity?.size ?? 3}x${mv.complexity?.size ?? 3}`,
          heuristicScore: oppHasBall ? 185 : 30,
        });
      } else if (isCarrier || (carrier && carrier.team !== team && Math.hypot(mv.pos.col - carrier.pos.col, mv.pos.row - carrier.pos.row) <= 5) || fwd >= 2) {
        const space = minEnemyDist(mv.pos);
        const base = isCarrier ? 65 + fwd * 10 + (11 - Math.min(11, goalDist)) * 3 : 35 + fwd * 5;
        options.push({
          actionType: "move",
          playerId: p.id,
          targetPos: mv.pos,
          summary: `${isCarrier ? "ДРИБЛИНГ" : "ПОЗИЦИЯ"}: ${ROLE_META[p.role].code}#${p.number} (${p.pos.col},${p.pos.row})->(${mv.pos.col},${mv.pos.row}), до ворот:${goalDist.toFixed(0)}, враг:${space.toFixed(1)}`,
          heuristicScore: base,
        });
      }
    }
  }

  options.sort((a, b) => b.heuristicScore - a.heuristicScore);
  const topOptions = options.slice(0, 8);
  if (topOptions.length === 0 || !GROQ_API_KEY || Date.now() < groqCooldownUntil) {
    return {
      hint: fallbackHint,
      source: "local" as const,
      tacticBadge: "Движок 95",
    };
  }

  // If there is a guaranteed uncontested goal, take it cleanly with Groq commentary label
  if (topOptions[0].heuristicScore >= 1000) {
    return {
      hint: {
        actionType: topOptions[0].actionType,
        playerId: topOptions[0].playerId,
        targetPos: topOptions[0].targetPos,
        targetPlayerId: topOptions[0].targetPlayerId,
        goalRow: topOptions[0].goalRow,
        reason: `Groq ИИ-Агент: открытый угол ворот — завершающий удар!`,
      },
      source: "groq" as const,
      model: GROQ_PRIMARY_MODEL,
      tacticBadge: "Решающий удар",
    };
  }

  const sysPrompt =
    "Ты элитный тактический ИИ-Агент футбола 11v11 на шахматной сетке 32x32 (Синие атакуют col 31, Красные атакуют col 0). " +
    "Выбери лучший номер варианта из списка (choiceIndex от 0 до N-1). Ответь СТРОГО в JSON: " +
    '{"choiceIndex": number, "tacticBadge": "2 слова по-русски", "reason": "1 короткая фраза по-русски до 90 символов"}.';

  const userPrompt = JSON.stringify({
    team: team === "red" ? "Красные (атака влево -> col 0)" : "Синие (атака вправо -> col 31)",
    pitchType,
    score: `${scoreBlue}:${scoreRed}`,
    turn: `${turnCount}/${MAX_TURNS}`,
    ballPos: ball.pos,
    carrier: carrier ? `${carrier.team} ${ROLE_META[carrier.role].code}#${carrier.number} at (${carrier.pos.col},${carrier.pos.row})` : "ничейный",
    candidates: topOptions.map((o, idx) => ({ idx, action: o.summary })),
  });

  const groqDecision = await callGroqChat<{
    choiceIndex?: number;
    tacticBadge?: string;
    reason?: string;
  }>(sysPrompt, userPrompt, {
    model: GROQ_FAST_MODEL,
    timeoutMs: 3200,
    jsonMode: true,
    maxTokens: 480,
  });

  if (
    groqDecision &&
    typeof groqDecision.choiceIndex === "number" &&
    Number.isInteger(groqDecision.choiceIndex) &&
    groqDecision.choiceIndex >= 0 &&
    groqDecision.choiceIndex < topOptions.length
  ) {
    const picked = topOptions[groqDecision.choiceIndex];
    return {
      hint: {
        actionType: picked.actionType,
        playerId: picked.playerId,
        targetPos: picked.targetPos,
        targetPlayerId: picked.targetPlayerId,
        goalRow: picked.goalRow,
        reason: (groqDecision.reason || fallbackHint.reason).slice(0, 110),
      },
      source: "groq" as const,
      model: GROQ_FAST_MODEL,
      tacticBadge: (groqDecision.tacticBadge || "Groq Тактика").slice(0, 28),
    };
  }

  return {
    hint: fallbackHint,
    source: "local" as const,
    tacticBadge: "Тактический расчёт",
  };
}

async function generateGeminiCommentary(
  payload: CommentaryEventPayload
): Promise<{ text: string; source: "gemini" | "groq" | "local" }> {
  const now = Date.now();
  const isCriticalEvent =
    payload.eventType === "goal" ||
    payload.eventType === "save" ||
    payload.eventType === "match_end";

  if (!isCriticalEvent && now - lastCommentaryCallAt < MIN_COMMENTARY_INTERVAL_MS) {
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

  const commentSystemPrompt =
    "Ты харизматичный российский футбольный комментатор матча «Шахматный Блиц-Футбол», где игроки ходят как шахматные фигуры на разных типах полей (газон, лёд, песок, барьеры), а столкновения решаются в быстрые крестики-нолики. Ответь 1–2 живыми фразами на русском (до 155 символов), без хэштегов, без эмодзи и без кавычек.";

  if (GROQ_API_KEY && now >= groqCooldownUntil) {
    lastCommentaryCallAt = now;
    const groqText = await callGroqChat<string>(commentSystemPrompt, prompt, {
      model: GROQ_FAST_MODEL,
      timeoutMs: 3000,
      jsonMode: false,
      maxTokens: 320,
    });
    if (groqText) {
      return { text: groqText.replace(/^["«]|["»]$/g, ""), source: "groq" };
    }
  }

  if (!ai || now < geminiCooldownUntil) {
    return { text: buildFallbackCommentary(payload), source: "local" };
  }

  lastCommentaryCallAt = now;

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          systemInstruction: commentSystemPrompt,
        },
      }),
      5500
    );
    const text = (response.text || "").trim();
    if (!text) {
      return { text: buildFallbackCommentary(payload), source: "local" };
    }
    return { text, source: "gemini" };
  } catch (err) {
    geminiCooldownUntil = Date.now() + parseRetryCooldownMs(err);
    return { text: buildFallbackCommentary(payload), source: "local" };
  }
}

async function generateGeminiCoachAnalysis(
  payload: CoachAnalysisPayload
): Promise<CoachAnalysisResult> {
  const prompt = JSON.stringify(payload);
  const fallbackResult = buildFallbackCoachAnalysis(payload);
  const coachSystemPrompt =
    "Ты элитный ИИ-тренер по тактическому «Блиц-Футболу» (11v11 на сетке 32x32 с очками действий AP, офсайдами и таймером хода). " +
    (payload.isHalftime
      ? "Сейчас ПЕРЕРЫВ матча: сделай детальный разбор тактики 1-го тайма и конкретный разбор ошибок игроков (из массива mistakes и статистики offsides, turnTimeouts, blitzTimeouts, moves, passes, shots). "
      : "Проанализируй текущую тактику, ошибки игроков из mistakes, статистику, тип поля и прокачку. ") +
    "Пиши чётко по-русски. Ответь СТРОГО в JSON: " +
    '{"styleSummary": string, "tacticalAdvice": [string, string], "upgradeRecommendation": string, "mistakeReport": {"overview": string, "playerErrors": [{"player": string, "issue": string, "fix": string}], "secondHalfPlan": string}}.';

  if (GROQ_API_KEY && Date.now() >= groqCooldownUntil) {
    const parsed = await callGroqChat<Omit<CoachAnalysisResult, "source">>(
      coachSystemPrompt,
      `Данные матча, ошибок и состава игрока (Синие): ${prompt}`,
      {
        model: GROQ_PRIMARY_MODEL,
        timeoutMs: 6500,
        jsonMode: true,
        maxTokens: 1100,
      }
    );
    if (parsed && parsed.styleSummary && Array.isArray(parsed.tacticalAdvice) && parsed.upgradeRecommendation) {
      return {
        styleSummary: parsed.styleSummary,
        tacticalAdvice: parsed.tacticalAdvice.slice(0, 3),
        upgradeRecommendation: parsed.upgradeRecommendation,
        isHalftime: payload.isHalftime,
        mistakeReport: parsed.mistakeReport?.playerErrors?.length
          ? {
              overview: parsed.mistakeReport.overview || fallbackResult.mistakeReport!.overview,
              playerErrors: parsed.mistakeReport.playerErrors.slice(0, 4),
              secondHalfPlan:
                parsed.mistakeReport.secondHalfPlan || fallbackResult.mistakeReport!.secondHalfPlan,
            }
          : fallbackResult.mistakeReport,
        source: "groq",
      };
    }
  }

  if (!ai || Date.now() < geminiCooldownUntil) {
    return fallbackResult;
  }

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Данные матча, ошибок и состава игрока (Синие): ${prompt}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          systemInstruction: coachSystemPrompt,
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
      6000
    );

    const raw = (response.text || "").trim();
    if (!raw) return fallbackResult;
    const parsed = JSON.parse(raw) as Omit<CoachAnalysisResult, "source">;
    if (!parsed.styleSummary || !Array.isArray(parsed.tacticalAdvice)) {
      return fallbackResult;
    }
    return {
      styleSummary: parsed.styleSummary,
      tacticalAdvice: parsed.tacticalAdvice.slice(0, 3),
      upgradeRecommendation: parsed.upgradeRecommendation,
      isHalftime: payload.isHalftime,
      mistakeReport: fallbackResult.mistakeReport,
      source: "gemini",
    };
  } catch (err) {
    geminiCooldownUntil = Date.now() + parseRetryCooldownMs(err);
    return fallbackResult;
  }
}

// ============================================================================
// REAL-TIME MULTIPLAYER & AUTHORITATIVE SPECTATOR BROADCAST ENGINE
// ============================================================================

interface ConnectedClient {
  ws: WebSocket;
  clientId: string;
  clubName: string;
  managerName: string;
  spectatingMatchId: string | null;
  activeMatchId: string | null;
}

interface QueueEntry {
  clientId: string;
  clubName: string;
  managerName: string;
  pitchType: PitchType;
  blitzPace: BlitzPace;
  blitzModePref: BlitzModePreference;
  joinedAt: number;
}

interface ServerMatchRecord {
  snapshot: ServerMatchSnapshot;
  spectatorIds: Set<string>;
  duelTimer: ReturnType<typeof setTimeout> | null;
  goalTimer: ReturnType<typeof setTimeout> | null;
  aiTimer: ReturnType<typeof setTimeout> | null;
  flightNonce: number;
}

const clientsBySocket = new Map<WebSocket, ConnectedClient>();
const clientsById = new Map<string, ConnectedClient>();
const openRooms = new Map<string, MultiplayerRoomInfo>();
const matchmakingQueue: QueueEntry[] = [];
const activeMatches = new Map<string, ServerMatchRecord>();

function formatClockTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const lobbyChatHistory: LobbyChatMessage[] = [
  {
    id: "sys-init-1",
    sender: "SYSOP",
    text: "Канал mIRC-Блиц 95 открыт. Создавайте комнаты, играйте PvP и смотрите прямые трансляции!",
    time: formatClockTime(),
    isSystem: true,
  },
];

function sendJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function pushLobbyChat(msg: Omit<LobbyChatMessage, "id" | "time">) {
  const full: LobbyChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    time: formatClockTime(),
    ...msg,
  };
  lobbyChatHistory.push(full);
  if (lobbyChatHistory.length > 80) lobbyChatHistory.shift();
  for (const c of clientsBySocket.values()) {
    sendJson(c.ws, { type: "chat:message", message: full });
  }
}

function summarizeMatch(rec: ServerMatchRecord): LiveMatchSummary {
  const s = rec.snapshot;
  const totalTurns = Math.max(1, s.telemetry.blueTurns + s.telemetry.redTurns);
  const possessionBluePct = Math.round((s.telemetry.blueTurns / totalTurns) * 100);
  return {
    id: s.id,
    kind: s.kind,
    roomName: s.roomName,
    hostName: s.hostName,
    guestName: s.guestName,
    scoreBlue: s.scoreBlue,
    scoreRed: s.scoreRed,
    turn: Math.min(s.turnCount, MAX_TURNS),
    maxTurns: MAX_TURNS,
    currentTurn: s.currentTurn,
    pitchType: s.pitchType,
    pace: s.pace,
    viewers: rec.spectatorIds.size,
    status: s.status,
    possessionBluePct,
    latestEvent: s.commentary[0]?.text,
  };
}

function buildLobbyPayload() {
  const onlineUsers: OnlineUserInfo[] = [];
  const seen = new Set<string>();
  for (const c of clientsBySocket.values()) {
    if (seen.has(c.clientId)) continue;
    seen.add(c.clientId);
    onlineUsers.push({
      clientId: c.clientId,
      clubName: c.clubName,
      managerName: c.managerName,
    });
  }
  const rooms = Array.from(openRooms.values()).sort((a, b) => b.createdAt - a.createdAt);
  const liveMatches = Array.from(activeMatches.values())
    .map(summarizeMatch)
    .sort((a, b) => {
      if (a.kind !== b.kind) {
        if (a.kind === "pvp") return -1;
        if (b.kind === "pvp") return 1;
      }
      return b.viewers - a.viewers;
    });

  return {
    type: "lobby:state",
    onlineUsers,
    rooms,
    liveMatches,
    queueCount: matchmakingQueue.length,
    chatHistory: lobbyChatHistory,
  };
}

function broadcastLobbyState() {
  const payload = buildLobbyPayload();
  for (const c of clientsBySocket.values()) {
    sendJson(c.ws, payload);
  }
}

function broadcastMatchState(rec: ServerMatchRecord) {
  rec.snapshot.viewers = rec.spectatorIds.size;
  rec.snapshot.updatedAt = Date.now();
  const payload = { type: "match:state", match: rec.snapshot };

  const host = clientsById.get(rec.snapshot.hostClientId);
  if (host) sendJson(host.ws, payload);
  if (rec.snapshot.guestClientId) {
    const guest = clientsById.get(rec.snapshot.guestClientId);
    if (guest && guest.clientId !== rec.snapshot.hostClientId) {
      sendJson(guest.ws, payload);
    }
  }
  for (const specId of rec.spectatorIds) {
    const spec = clientsById.get(specId);
    if (spec) sendJson(spec.ws, payload);
  }
}

function addMatchCommentary(
  rec: ServerMatchRecord,
  text: string,
  highlight: CommentaryItem["highlight"] = "normal"
) {
  const item: CommentaryItem = {
    id: `mc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    turn: rec.snapshot.turnCount,
    text,
    source: "local",
    highlight,
  };
  rec.snapshot.commentary = [item, ...rec.snapshot.commentary.slice(0, 14)];
}

function createServerDuelState(
  duel: ActiveBlitzDuel
): ServerDuelState {
  const totalCells = duel.complexity.size * duel.complexity.size;
  const board: BlitzCell[] = Array(totalCells).fill(null);
  for (const bIdx of duel.complexity.blockedCells) {
    if (bIdx >= 0 && bIdx < totalCells) board[bIdx] = "BLOCKED";
  }
  return {
    duel,
    board,
    turnMark: "X",
    xQueue: [],
    oQueue: [],
    winningLine: [],
    finished: false,
    winnerTeam: null,
    statusMessage: `Ход X · ${duel.complexity.variantName}`,
    wasTimeout: false,
  };
}

function clearMatchTimers(rec: ServerMatchRecord) {
  if (rec.duelTimer) {
    clearTimeout(rec.duelTimer);
    rec.duelTimer = null;
  }
  if (rec.goalTimer) {
    clearTimeout(rec.goalTimer);
    rec.goalTimer = null;
  }
  if (rec.aiTimer) {
    clearTimeout(rec.aiTimer);
    rec.aiTimer = null;
  }
}

function finalizeServerMatch(rec: ServerMatchRecord, forcedWinner?: Team | "draw") {
  clearMatchTimers(rec);
  const s = rec.snapshot;
  s.status = "finished";
  s.activeDuelState = null;
  s.winner =
    forcedWinner ??
    (s.scoreBlue > s.scoreRed ? "blue" : s.scoreRed > s.scoreBlue ? "red" : "draw");

  const winText =
    s.winner === "draw"
      ? `Финальный свисток! Ничья ${s.scoreBlue}:${s.scoreRed}!`
      : `Матч завершён! ${s.winner === "blue" ? s.hostName : s.guestName} побеждают ${s.scoreBlue}:${s.scoreRed}!`;
  addMatchCommentary(rec, winText, "goal");
  broadcastMatchState(rec);
  broadcastLobbyState();

  if (s.kind === "ai_league") {
    rec.goalTimer = setTimeout(() => {
      restartAiLeagueFixture(rec.snapshot.id);
    }, 5500);
  }
}

function advanceServerTurn(rec: ServerMatchRecord, actingTeam: Team) {
  const s = rec.snapshot;
  if (s.scoreBlue >= TARGET_GOALS || s.scoreRed >= TARGET_GOALS) {
    finalizeServerMatch(rec);
    return;
  }
  if (s.turnCount + 1 > MAX_TURNS) {
    finalizeServerMatch(rec);
    return;
  }
  s.turnCount += 1;
  s.currentTurn = actingTeam === "blue" ? "red" : "blue";
  s.status = "playing";
  broadcastMatchState(rec);
  broadcastLobbyState();

  if (s.kind === "ai_league") {
    scheduleAiLeagueStep(rec);
  }
}

function triggerServerGoal(rec: ServerMatchRecord, scoringTeam: Team, scorerRole: string) {
  clearMatchTimers(rec);
  const s = rec.snapshot;
  if (scoringTeam === "blue") s.scoreBlue += 1;
  else s.scoreRed += 1;

  s.activeDuelState = null;
  s.status = "goal";
  const teamLabel = scoringTeam === "blue" ? s.hostName : s.guestName;
  s.goalBanner = {
    team: scoringTeam,
    text: `${teamLabel} (${scorerRole}) отправляют мяч в сетку!`,
  };
  s.callout = {
    id: `co-${Date.now()}`,
    pos: { col: scoringTeam === "blue" ? PITCH_COLS - 1 : 0, row: 16 },
    text: "ГОООЛ!",
    color: 0x4ade80,
  };

  addMatchCommentary(
    rec,
    `ГОООЛ! ${teamLabel} (${scorerRole}) забивают мяч — счёт ${s.scoreBlue}:${s.scoreRed}!`,
    "goal"
  );
  if (s.kind === "pvp") {
    pushLobbyChat({
      sender: "LIVE TV",
      text: `ГОЛ в матче «${s.roomName}»! ${s.hostName} ${s.scoreBlue}:${s.scoreRed} ${s.guestName}`,
      isSystem: true,
    });
  }

  broadcastMatchState(rec);
  broadcastLobbyState();

  rec.goalTimer = setTimeout(() => {
    if (!activeMatches.has(s.id)) return;
    s.goalBanner = null;
    if (s.scoreBlue >= TARGET_GOALS || s.scoreRed >= TARGET_GOALS || s.turnCount >= MAX_TURNS) {
      finalizeServerMatch(rec);
      return;
    }
    const reset = createInitialFormation();
    s.players = reset.players;
    s.ball = reset.ball;
    s.lastMoveTrace = null;
    s.turnCount += 1;
    s.currentTurn = scoringTeam === "blue" ? "red" : "blue";
    s.status = "playing";
    broadcastMatchState(rec);
    broadcastLobbyState();
    if (s.kind === "ai_league") {
      scheduleAiLeagueStep(rec);
    }
  }, 1750);
}

function scheduleDuelTurnTimeout(rec: ServerMatchRecord) {
  if (rec.duelTimer) {
    clearTimeout(rec.duelTimer);
    rec.duelTimer = null;
  }
  const ds = rec.snapshot.activeDuelState;
  if (!ds || ds.finished) return;
  const baseMs = BLITZ_PACE_MS[rec.snapshot.pace];
  if (baseMs === null) return;

  const initTeam = rec.snapshot.players.find((p) => p.id === ds.duel.initiatorId)?.team ?? "blue";
  const defTeam = rec.snapshot.players.find((p) => p.id === ds.duel.defenderId)?.team ?? "red";
  const activeTeam: Team = ds.turnMark === "X" ? initTeam : defTeam;
  const bonus = activeTeam === "blue" ? ds.duel.bonusTimeMsBlue : ds.duel.bonusTimeMsRed;

  rec.duelTimer = setTimeout(() => {
    if (!rec.snapshot.activeDuelState || rec.snapshot.activeDuelState.finished) return;
    const winnerTeam: Team = activeTeam === "blue" ? "red" : "blue";
    const winLabel = winnerTeam === "blue" ? "Синие" : "Красные";
    resolveServerDuel(rec, winnerTeam, [], `Время вышло — ${winLabel} забирают мяч!`, true);
  }, baseMs + bonus + 150);
}

function resolveServerDuel(
  rec: ServerMatchRecord,
  winnerTeam: Team | "draw",
  winningLine: number[],
  message: string,
  wasTimeout: boolean
) {
  if (rec.duelTimer) {
    clearTimeout(rec.duelTimer);
    rec.duelTimer = null;
  }
  const s = rec.snapshot;
  const ds = s.activeDuelState;
  if (!ds) return;

  ds.finished = true;
  ds.winnerTeam = winnerTeam;
  ds.winningLine = winningLine;
  ds.statusMessage = message;
  ds.wasTimeout = wasTimeout;

  if (winnerTeam === "blue") s.telemetry.blitzBlueWon += 1;
  else if (winnerTeam === "red") s.telemetry.blitzRedWon += 1;

  broadcastMatchState(rec);

  rec.duelTimer = setTimeout(() => {
    if (!activeMatches.has(s.id)) return;
    const duel = ds.duel;
    const initiator = s.players.find((p) => p.id === duel.initiatorId);
    const defender = s.players.find((p) => p.id === duel.defenderId);
    s.activeDuelState = null;

    if (!initiator || !defender) {
      s.status = "playing";
      broadcastMatchState(rec);
      return;
    }

    if (duel.isShotDuel) {
      if (winnerTeam === initiator.team) {
        triggerServerGoal(rec, initiator.team, ROLE_META[initiator.role].name);
        return;
      }
      s.ball = { pos: defender.pos, carrierId: defender.id };
      s.callout = { id: `co-${Date.now()}`, pos: defender.pos, text: "СЕЙВ!", color: 0x38bdf8 };
      addMatchCommentary(rec, `Сейв! ${ROLE_META[defender.role].name} спасает ворота!`, "save");
      advanceServerTurn(rec, initiator.team);
      return;
    }

    const initiatorHadBall = duel.ballOwnerBeforeId === initiator.id;
    const defenderHadBall = duel.ballOwnerBeforeId === defender.id;
    const looseBallOnSquare =
      duel.ballOwnerBeforeId === null && samePos(s.ball.pos, duel.contestedPos);

    let initiatorWinsSquare: boolean;
    let nextCarrierId: string | null = duel.ballOwnerBeforeId;

    if (winnerTeam === "draw") {
      initiatorWinsSquare = initiatorHadBall;
      nextCarrierId = duel.ballOwnerBeforeId;
    } else if (winnerTeam === initiator.team) {
      initiatorWinsSquare = true;
      if (initiatorHadBall || defenderHadBall || looseBallOnSquare) {
        nextCarrierId = initiator.id;
      }
    } else {
      initiatorWinsSquare = false;
      if (initiatorHadBall || defenderHadBall || looseBallOnSquare) {
        nextCarrierId = defender.id;
      }
    }

    let nextPlayers = s.players;
    if (initiatorWinsSquare) {
      const knockbackPos = findSafeKnockbackSquare(
        defender,
        duel.contestedPos,
        s.players,
        initiator.id,
        s.pitchType
      );
      nextPlayers = s.players.map((p) => {
        if (p.id === initiator.id) return { ...p, pos: duel.contestedPos };
        if (p.id === defender.id) return { ...p, pos: knockbackPos };
        return p;
      });
      s.lastMoveTrace = { from: duel.initiatorOrigin, to: duel.contestedPos, team: initiator.team };
    }

    let finalBall = s.ball;
    if (nextCarrierId) {
      const carrier = nextPlayers.find((p) => p.id === nextCarrierId);
      if (carrier) finalBall = { pos: carrier.pos, carrierId: carrier.id };
    }

    s.players = updateSquadStamina(
      applyDynamicOffBallRuns(nextPlayers, initiator.id, finalBall, s.pitchType, "balance"),
      initiator.id,
      3,
      "balance"
    );
    s.ball = finalBall;
    s.callout = {
      id: `co-${Date.now()}`,
      pos: duel.contestedPos,
      text: winnerTeam === "blue" ? "ОТБОР!" : winnerTeam === "red" ? "ПЕРЕХВАТ!" : "НИЧЬЯ!",
      color: winnerTeam === "blue" ? 0x60a5fa : winnerTeam === "red" ? 0xf87171 : 0xfde047,
    };

    addMatchCommentary(
      rec,
      winnerTeam === "draw"
        ? "Ничья в блиц-дуэли — мяч остаётся у владельца."
        : `${winnerTeam === "blue" ? s.hostName : s.guestName} выигрывают блиц-дуэль!`,
      "blitz"
    );

    advanceServerTurn(rec, initiator.team);
  }, 850);
}

function applyServerBlitzMark(rec: ServerMatchRecord, cellIdx: number, expectedTeam?: Team): boolean {
  const s = rec.snapshot;
  const ds = s.activeDuelState;
  if (!ds || ds.finished) return false;

  const initiator = s.players.find((p) => p.id === ds.duel.initiatorId);
  const defender = s.players.find((p) => p.id === ds.duel.defenderId);
  if (!initiator || !defender) return false;

  const markTeam: Team = ds.turnMark === "X" ? initiator.team : defender.team;
  if (expectedTeam && expectedTeam !== markTeam) return false;
  if (cellIdx < 0 || cellIdx >= ds.board.length || ds.board[cellIdx] !== null) return false;

  const activeQ = ds.turnMark === "X" ? ds.xQueue : ds.oQueue;
  if (ds.duel.complexity.maxMarksPerPlayer !== null && activeQ.length >= ds.duel.complexity.maxMarksPerPlayer) {
    const oldest = activeQ.shift()!;
    ds.board[oldest] = null;
  }

  ds.board[cellIdx] = ds.turnMark;
  activeQ.push(cellIdx);

  const lines = generateWinLines(ds.duel.complexity.size, ds.duel.complexity.winLength);
  const res = checkBlitzWinner(ds.board, ds.duel.complexity.size, ds.duel.complexity.winLength, lines);
  if (res.winner === "X" || res.winner === "O") {
    const winTeam = res.winner === "X" ? initiator.team : defender.team;
    const winLabel = winTeam === "blue" ? "Синие" : "Красные";
    const msg = ds.duel.isShotDuel
      ? winTeam === initiator.team
        ? `${winLabel} пробивают вратаря!`
        : `${winLabel} совершают сейв!`
      : `${winLabel} выигрывают борьбу за мяч!`;
    resolveServerDuel(rec, winTeam, res.line, msg, false);
  } else if (res.winner === "draw") {
    resolveServerDuel(rec, "draw", [], "Ничья в блице — мяч остаётся у владельца", false);
  } else {
    ds.turnMark = ds.turnMark === "X" ? "O" : "X";
    ds.statusMessage = `Ход ${ds.turnMark}`;
    broadcastMatchState(rec);
    scheduleDuelTurnTimeout(rec);
  }
  return true;
}

function executeServerTacticalAction(
  rec: ServerMatchRecord,
  action: {
    actionType: "move" | "pass" | "shoot";
    playerId: string;
    targetPos?: Position;
    targetPlayerId?: string;
    goalRow?: number;
  },
  actorTeam: Team
): boolean {
  const s = rec.snapshot;
  if (s.status !== "playing" || s.currentTurn !== actorTeam) return false;
  const actor = s.players.find((p) => p.id === action.playerId);
  if (!actor || actor.team !== actorTeam) return false;

  if (actorTeam === "blue") s.telemetry.blueTurns += 1;
  else s.telemetry.redTurns += 1;

  if (action.actionType === "shoot" && action.goalRow !== undefined) {
    const shots = getShotOptions(actor, s.players, s.ball, s.pitchType, s.blitzModePref, undefined, s.difficulty);
    const shot = shots.find((opt) => opt.goalRow === action.goalRow);
    if (!shot) return false;

    if (actorTeam === "blue") s.telemetry.shotsBlue += 1;
    else s.telemetry.shotsRed += 1;

    const goalCol = actorTeam === "blue" ? PITCH_COLS - 1 : 0;
    rec.flightNonce += 1;
    s.ballFlight = {
      nonce: rec.flightNonce,
      from: actor.pos,
      to: { col: goalCol, row: shot.goalRow },
      isLob: false,
      isShot: true,
    };
    s.lastMoveTrace = { from: actor.pos, to: { col: goalCol, row: shot.goalRow }, team: actorTeam };

    if (!shot.isContested || !shot.defenderId || !shot.complexity) {
      triggerServerGoal(rec, actorTeam, ROLE_META[actor.role].name);
      return true;
    }

    const keeper = s.players.find((p) => p.id === shot.defenderId);
    if (!keeper) {
      triggerServerGoal(rec, actorTeam, ROLE_META[actor.role].name);
      return true;
    }

    const { blueBonusMs, redBonusMs } = computeDuelBonusTimes(actor, keeper, true, undefined, s.difficulty);
    const duel: ActiveBlitzDuel = {
      initiatorId: actor.id,
      defenderId: keeper.id,
      contestedPos: { col: goalCol, row: shot.goalRow },
      initiatorOrigin: actor.pos,
      isShotDuel: true,
      goalRow: shot.goalRow,
      complexity: shot.complexity,
      ballOwnerBeforeId: actor.id,
      bonusTimeMsBlue: blueBonusMs,
      bonusTimeMsRed: redBonusMs,
    };
    s.activeDuelState = createServerDuelState(duel);
    s.status = "blitz";
    addMatchCommentary(rec, `Удар по воротам! ${shot.complexity.variantName} против вратаря!`, "blitz");
    broadcastMatchState(rec);
    scheduleDuelTurnTimeout(rec);
    if (s.kind === "ai_league") scheduleAiLeagueStep(rec);
    return true;
  }

  if (action.actionType === "pass" && action.targetPlayerId) {
    const passes = getValidPasses(actor, s.players, s.ball, s.pitchType, undefined, s.difficulty);
    const chosenPass = passes.find((p) => p.targetPlayerId === action.targetPlayerId);
    const receiver = s.players.find((p) => p.id === action.targetPlayerId);
    if (!chosenPass || !receiver) return false;

    if (chosenPass.isOffside) {
      const oppDefender = s.players
        .filter((p) => p.team !== actorTeam)
        .sort(
          (a, b) =>
            Math.hypot(a.pos.col - receiver.pos.col, a.pos.row - receiver.pos.row) -
            Math.hypot(b.pos.col - receiver.pos.col, b.pos.row - receiver.pos.row)
        )[0];
      if (oppDefender) {
        s.ball = { pos: oppDefender.pos, carrierId: oppDefender.id };
        s.callout = { id: `co-${Date.now()}`, pos: receiver.pos, text: "ОФСАЙД!", color: 0xf87171 };
        addMatchCommentary(rec, `Свисток арбитра! ${ROLE_META[receiver.role].name} оказался в офсайде!`);
        advanceServerTurn(rec, actorTeam);
        return true;
      }
    }

    if (actorTeam === "blue") s.telemetry.passesBlue += 1;
    else s.telemetry.passesRed += 1;

    rec.flightNonce += 1;
    const dist = Math.hypot(receiver.pos.col - actor.pos.col, receiver.pos.row - actor.pos.row);
    s.ballFlight = {
      nonce: rec.flightNonce,
      from: actor.pos,
      to: receiver.pos,
      isLob: Boolean(chosenPass.isLob || dist > 6.5),
      isShot: false,
    };
    s.lastMoveTrace = { from: actor.pos, to: receiver.pos, team: actorTeam };
    const updatedBall: BallState = { pos: receiver.pos, carrierId: receiver.id };
    s.players = updateSquadStamina(
      applyDynamicOffBallRuns(s.players, receiver.id, updatedBall, s.pitchType, "balance"),
      actor.id,
      1.5,
      "balance"
    );
    s.ball = updatedBall;
    s.callout = { id: `co-${Date.now()}`, pos: receiver.pos, text: "ПАС!", color: 0xfbbf24 };
    addMatchCommentary(rec, `Точный пас на ${ROLE_META[receiver.role].name}!`);
    advanceServerTurn(rec, actorTeam);
    return true;
  }

  if (action.actionType === "move" && action.targetPos) {
    const moves = getValidMoves(actor, s.players, s.ball, s.pitchType, s.blitzModePref, undefined, s.difficulty);
    const chosen = moves.find((m) => samePos(m.pos, action.targetPos!));
    if (!chosen) return false;

    if (chosen.kind === "clash" && chosen.opponentId && chosen.complexity) {
      const defender = s.players.find((p) => p.id === chosen.opponentId);
      if (!defender) return false;
      const { blueBonusMs, redBonusMs } = computeDuelBonusTimes(actor, defender, false, undefined, s.difficulty);
      const duel: ActiveBlitzDuel = {
        initiatorId: actor.id,
        defenderId: defender.id,
        contestedPos: chosen.pos,
        initiatorOrigin: actor.pos,
        isShotDuel: false,
        complexity: chosen.complexity,
        ballOwnerBeforeId: s.ball.carrierId,
        bonusTimeMsBlue: blueBonusMs,
        bonusTimeMsRed: redBonusMs,
      };
      s.activeDuelState = createServerDuelState(duel);
      s.status = "blitz";
      addMatchCommentary(
        rec,
        `Стык ${ROLE_META[actor.role].code} vs ${ROLE_META[defender.role].code}: ${chosen.complexity.variantName}!`,
        "blitz"
      );
      broadcastMatchState(rec);
      scheduleDuelTurnTimeout(rec);
      if (s.kind === "ai_league") scheduleAiLeagueStep(rec);
      return true;
    }

    const moveDist = Math.hypot(chosen.pos.col - actor.pos.col, chosen.pos.row - actor.pos.row);
    const movedPlayers = s.players.map((p) =>
      p.id === actor.id ? { ...p, pos: chosen.pos } : p
    );
    let updatedBall = s.ball;
    if (s.ball.carrierId === actor.id || chosen.kind === "pickup") {
      updatedBall = { pos: chosen.pos, carrierId: actor.id };
    }
    s.lastMoveTrace = { from: actor.pos, to: chosen.pos, team: actorTeam };
    s.players = updateSquadStamina(
      applyDynamicOffBallRuns(movedPlayers, actor.id, updatedBall, s.pitchType, "balance"),
      actor.id,
      moveDist,
      "balance"
    );
    s.ball = updatedBall;
    s.callout = chosen.kind === "pickup"
      ? { id: `co-${Date.now()}`, pos: chosen.pos, text: "ПОДБОР!", color: 0x4ade80 }
      : chosen.isSlide
      ? { id: `co-${Date.now()}`, pos: chosen.pos, text: "СКОЛЬЖЕНИЕ!", color: 0x38bdf8 }
      : null;

    addMatchCommentary(
      rec,
      `${actorTeam === "blue" ? s.hostName : s.guestName}: ${ROLE_META[actor.role].name} смещается в атаку.`
    );
    advanceServerTurn(rec, actorTeam);
    return true;
  }

  return false;
}

const AI_FIXTURES: Array<{
  id: string;
  roomName: string;
  hostName: string;
  guestName: string;
  pitchType: PitchType;
  pace: BlitzPace;
}> = [
  {
    id: "ai_league_cup",
    roomName: "Финал Кубка Блиц 95",
    hostName: "FC Dynamo Pro",
    guestName: "Spartak-95 Elite",
    pitchType: "turf",
    pace: "blitz",
  },
  {
    id: "ai_league_ice",
    roomName: "Ледовое Дерби Мастеров",
    hostName: "Nordic Ice XI",
    guestName: "Arctic Blitz",
    pitchType: "ice",
    pace: "turbo",
  },
  {
    id: "ai_league_poly",
    roomName: "Тактический Полигон PRO",
    hostName: "ChessMasters 95",
    guestName: "TurboStriker FC",
    pitchType: "obstacles",
    pace: "blitz",
  },
];

function createServerMatch(params: {
  id: string;
  kind: "pvp" | "human_ai" | "ai_league";
  roomName: string;
  hostClientId: string;
  guestClientId: string | null;
  hostName: string;
  guestName: string;
  pitchType: PitchType;
  pace: BlitzPace;
  blitzModePref: BlitzModePreference;
  difficulty: AIDifficulty;
}): ServerMatchRecord {
  const init = createInitialFormation();
  const snapshot: ServerMatchSnapshot = {
    id: params.id,
    kind: params.kind,
    roomName: params.roomName,
    hostClientId: params.hostClientId,
    guestClientId: params.guestClientId,
    hostName: params.hostName,
    guestName: params.guestName,
    pitchType: params.pitchType,
    pace: params.pace,
    blitzModePref: params.blitzModePref,
    difficulty: params.difficulty,
    players: init.players,
    ball: init.ball,
    currentTurn: "blue",
    turnCount: 1,
    scoreBlue: 0,
    scoreRed: 0,
    status: "playing",
    winner: null,
    activeDuelState: null,
    lastMoveTrace: null,
    ballFlight: null,
    goalBanner: null,
    callout: null,
    commentary: [
      {
        id: `init-${Date.now()}`,
        turn: 1,
        text: `Стартовый свисток! ${params.hostName} против ${params.guestName}.`,
        source: "local",
        highlight: "normal",
      },
    ],
    telemetry: {
      blueTurns: 0,
      redTurns: 0,
      passesBlue: 0,
      passesRed: 0,
      shotsBlue: 0,
      shotsRed: 0,
      blitzBlueWon: 0,
      blitzRedWon: 0,
    },
    viewers: 0,
    updatedAt: Date.now(),
  };

  return {
    snapshot,
    spectatorIds: new Set<string>(),
    duelTimer: null,
    goalTimer: null,
    aiTimer: null,
    flightNonce: 0,
  };
}

function scheduleAiLeagueStep(rec: ServerMatchRecord) {
  if (rec.aiTimer) {
    clearTimeout(rec.aiTimer);
    rec.aiTimer = null;
  }
  const s = rec.snapshot;
  if (s.kind !== "ai_league" || s.status === "finished" || s.status === "goal") return;

  const hasSpectators = rec.spectatorIds.size > 0;
  const stepDelay =
    s.status === "blitz"
      ? hasSpectators ? 440 : 650
      : hasSpectators ? 1050 : 1750;

  rec.aiTimer = setTimeout(() => {
    if (!activeMatches.has(s.id)) return;
    if (s.status === "blitz" && s.activeDuelState && !s.activeDuelState.finished) {
      const ds = s.activeDuelState;
      const aiQ = ds.turnMark === "X" ? ds.xQueue : ds.oQueue;
      const oppQ = ds.turnMark === "X" ? ds.oQueue : ds.xQueue;
      const cellIdx = chooseBlitzAIMove(
        ds.board,
        ds.duel.complexity.size,
        ds.duel.complexity.winLength,
        ds.turnMark,
        "pro",
        ds.duel.complexity.maxMarksPerPlayer,
        aiQ,
        oppQ
      );
      if (cellIdx !== -1) {
        applyServerBlitzMark(rec, cellIdx);
      }
      if (s.status === "blitz" && s.activeDuelState && !s.activeDuelState.finished) {
        scheduleAiLeagueStep(rec);
      }
      return;
    }

    if (s.status === "playing") {
      const action = computeBestTacticalMove(
        s.currentTurn,
        s.players,
        s.ball,
        "pro",
        s.pitchType,
        s.blitzModePref
      );
      if (!action) {
        advanceServerTurn(rec, s.currentTurn);
        return;
      }
      executeServerTacticalAction(rec, action, s.currentTurn);
    }
  }, stepDelay);
}

function restartAiLeagueFixture(fixtureId: string) {
  const existing = activeMatches.get(fixtureId);
  const specIds = existing ? new Set(existing.spectatorIds) : new Set<string>();
  if (existing) clearMatchTimers(existing);

  const cfg = AI_FIXTURES.find((f) => f.id === fixtureId) ?? AI_FIXTURES[0];
  const rec = createServerMatch({
    id: cfg.id,
    kind: "ai_league",
    roomName: cfg.roomName,
    hostClientId: `bot-host-${cfg.id}`,
    guestClientId: `bot-guest-${cfg.id}`,
    hostName: cfg.hostName,
    guestName: cfg.guestName,
    pitchType: cfg.pitchType,
    pace: cfg.pace,
    blitzModePref: "dynamic",
    difficulty: "pro",
  });
  rec.spectatorIds = specIds;
  activeMatches.set(cfg.id, rec);
  broadcastMatchState(rec);
  broadcastLobbyState();
  scheduleAiLeagueStep(rec);
}

function startAiLeagueFixtures() {
  for (const fx of AI_FIXTURES) {
    restartAiLeagueFixture(fx.id);
  }
}

function pairQueueOrMatchmaking() {
  while (matchmakingQueue.length >= 2) {
    const p1 = matchmakingQueue.shift()!;
    const p2 = matchmakingQueue.shift()!;
    const c1 = clientsById.get(p1.clientId);
    const c2 = clientsById.get(p2.clientId);
    if (!c1 || !c2) {
      if (c1) matchmakingQueue.unshift(p1);
      if (c2) matchmakingQueue.unshift(p2);
      continue;
    }

    const matchId = `pvp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const rec = createServerMatch({
      id: matchId,
      kind: "pvp",
      roomName: `Ranked: ${p1.clubName} vs ${p2.clubName}`,
      hostClientId: p1.clientId,
      guestClientId: p2.clientId,
      hostName: p1.clubName,
      guestName: p2.clubName,
      pitchType: p1.pitchType,
      pace: p1.blitzPace,
      blitzModePref: p1.blitzModePref,
      difficulty: "tactical",
    });

    activeMatches.set(matchId, rec);
    c1.activeMatchId = matchId;
    c2.activeMatchId = matchId;

    sendJson(c1.ws, { type: "match:started", match: rec.snapshot, yourTeam: "blue" });
    sendJson(c2.ws, { type: "match:started", match: rec.snapshot, yourTeam: "red" });

    pushLobbyChat({
      sender: "MATCHMAKER",
      text: `Найден Ranked-матч: ${p1.clubName} против ${p2.clubName}!`,
      isSystem: true,
    });
    broadcastLobbyState();
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

  app.post("/api/ai-agent/move", async (req, res) => {
    const payload = req.body as AIAgentMovePayload;
    if (!payload || !payload.players || !payload.ball) {
      res.status(400).json({ error: "Invalid AI agent payload" });
      return;
    }
    const result = await generateGroqAgentMove(payload);
    res.json(result);
  });

  app.get("/api/mp/lobby", (_req, res) => {
    res.json(buildLobbyPayload());
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      geminiConfigured: Boolean(ai),
      groqConfigured: Boolean(GROQ_API_KEY),
      onlineUsers: clientsById.size,
      activeMatches: activeMatches.size,
    });
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

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  startAiLeagueFixtures();

  wss.on("connection", (ws) => {
    let client: ConnectedClient | null = null;

    ws.on("message", (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = String(msg.type || "");

      if (type === "hello") {
        const clientId = String(msg.clientId || `u-${Math.random().toString(36).slice(2, 9)}`);
        const clubName = String(msg.clubName || "ФК Молния 95").slice(0, 32);
        const managerName = String(msg.managerName || "Тренер").slice(0, 24);
        client = {
          ws,
          clientId,
          clubName,
          managerName,
          spectatingMatchId: null,
          activeMatchId: null,
        };
        clientsBySocket.set(ws, client);
        clientsById.set(clientId, client);
        sendJson(ws, buildLobbyPayload());
        broadcastLobbyState();
        return;
      }

      if (!client) return;

      if (type === "profile:update") {
        client.clubName = String(msg.clubName || client.clubName).slice(0, 32);
        client.managerName = String(msg.managerName || client.managerName).slice(0, 24);
        broadcastLobbyState();
        return;
      }

      if (type === "chat:send") {
        const text = String(msg.text || "").trim().slice(0, 220);
        if (!text) return;
        pushLobbyChat({
          sender: client.managerName,
          clubName: client.clubName,
          text,
        });
        return;
      }

      if (type === "room:create") {
        // Remove previous waiting room hosted by this client
        for (const [rid, r] of openRooms.entries()) {
          if (r.hostClientId === client.clientId) openRooms.delete(rid);
        }
        const roomId = String(
          msg.roomId || `room-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
        );
        const challengeCode = msg.challengeCode ? String(msg.challengeCode) : undefined;
        const room: MultiplayerRoomInfo = {
          id: roomId,
          name: String(msg.roomName || `${client.clubName} — Матч 95`).slice(0, 48),
          hostClientId: client.clientId,
          hostName: client.managerName,
          hostClub: client.clubName,
          pitchType: (msg.pitchType as PitchType) || "turf",
          blitzPace: (msg.blitzPace as BlitzPace) || "blitz",
          blitzModePref: (msg.blitzModePref as BlitzModePreference) || "dynamic",
          challengeCode,
          status: "waiting",
          createdAt: Date.now(),
        };
        openRooms.set(roomId, room);
        sendJson(ws, { type: "room:created", room });
        pushLobbyChat({
          sender: "SYSOP",
          text: `Открыта комната «${room.name}» (${room.hostClub}). Ждём второго игрока!`,
          isSystem: true,
        });
        broadcastLobbyState();
        return;
      }

      if (type === "room:cancel") {
        const roomId = String(msg.roomId || "");
        const r = openRooms.get(roomId);
        if (r && r.hostClientId === client.clientId) {
          openRooms.delete(roomId);
          broadcastLobbyState();
        }
        return;
      }

      if (type === "room:join") {
        const targetId = String(msg.roomId || "");
        const challengeCode = msg.challengeCode ? String(msg.challengeCode) : "";
        const room =
          openRooms.get(targetId) ??
          Array.from(openRooms.values()).find(
            (r) => challengeCode && r.challengeCode === challengeCode
          );

        if (!room || room.status !== "waiting") {
          sendJson(ws, { type: "mp:error", message: "Комната не найдена или матч уже начался." });
          return;
        }
        if (room.hostClientId === client.clientId) {
          sendJson(ws, { type: "mp:error", message: "Нельзя присоединиться к собственной комнате." });
          return;
        }

        const hostClient = clientsById.get(room.hostClientId);
        if (!hostClient) {
          openRooms.delete(room.id);
          broadcastLobbyState();
          sendJson(ws, { type: "mp:error", message: "Создатель комнаты вышел из сети." });
          return;
        }

        openRooms.delete(room.id);
        const matchId = `pvp-${room.id}-${Date.now().toString().slice(-4)}`;
        const rec = createServerMatch({
          id: matchId,
          kind: "pvp",
          roomName: room.name,
          hostClientId: hostClient.clientId,
          guestClientId: client.clientId,
          hostName: room.hostClub,
          guestName: client.clubName,
          pitchType: room.pitchType,
          pace: room.blitzPace,
          blitzModePref: room.blitzModePref,
          difficulty: "tactical",
        });

        activeMatches.set(matchId, rec);
        hostClient.activeMatchId = matchId;
        client.activeMatchId = matchId;

        sendJson(hostClient.ws, { type: "match:started", match: rec.snapshot, yourTeam: "blue" });
        sendJson(client.ws, { type: "match:started", match: rec.snapshot, yourTeam: "red" });
        pushLobbyChat({
          sender: "SYSOP",
          text: `Стартовал PvP матч «${room.name}»: ${room.hostClub} vs ${client.clubName}!`,
          isSystem: true,
        });
        broadcastLobbyState();
        return;
      }

      if (type === "queue:join") {
        const already = matchmakingQueue.findIndex((q) => q.clientId === client!.clientId);
        if (already === -1) {
          matchmakingQueue.push({
            clientId: client.clientId,
            clubName: client.clubName,
            managerName: client.managerName,
            pitchType: (msg.pitchType as PitchType) || "turf",
            blitzPace: (msg.blitzPace as BlitzPace) || "blitz",
            blitzModePref: (msg.blitzModePref as BlitzModePreference) || "dynamic",
            joinedAt: Date.now(),
          });
        }
        sendJson(ws, { type: "queue:status", inQueue: true, position: matchmakingQueue.length });
        pairQueueOrMatchmaking();
        broadcastLobbyState();
        return;
      }

      if (type === "queue:leave") {
        const idx = matchmakingQueue.findIndex((q) => q.clientId === client!.clientId);
        if (idx !== -1) matchmakingQueue.splice(idx, 1);
        sendJson(ws, { type: "queue:status", inQueue: false, position: 0 });
        broadcastLobbyState();
        return;
      }

      if (type === "match:action") {
        const matchId = String(msg.matchId || "");
        const rec = activeMatches.get(matchId);
        if (!rec) return;
        const yourTeam: Team | null =
          rec.snapshot.hostClientId === client.clientId
            ? "blue"
            : rec.snapshot.guestClientId === client.clientId
            ? "red"
            : null;
        if (!yourTeam) return;
        const action = msg.action as {
          actionType: "move" | "pass" | "shoot";
          playerId: string;
          targetPos?: Position;
          targetPlayerId?: string;
          goalRow?: number;
        };
        executeServerTacticalAction(rec, action, yourTeam);
        return;
      }

      if (type === "match:blitz_mark") {
        const matchId = String(msg.matchId || "");
        const cellIndex = Number(msg.cellIndex);
        const rec = activeMatches.get(matchId);
        if (!rec) return;
        const yourTeam: Team | null =
          rec.snapshot.hostClientId === client.clientId
            ? "blue"
            : rec.snapshot.guestClientId === client.clientId
            ? "red"
            : null;
        if (!yourTeam) return;
        applyServerBlitzMark(rec, cellIndex, yourTeam);
        return;
      }

      if (type === "match:resign") {
        const matchId = String(msg.matchId || "");
        const rec = activeMatches.get(matchId);
        if (!rec || rec.snapshot.status === "finished") return;
        if (rec.snapshot.hostClientId === client.clientId) {
          finalizeServerMatch(rec, "red");
        } else if (rec.snapshot.guestClientId === client.clientId) {
          finalizeServerMatch(rec, "blue");
        }
        return;
      }

      // Live streaming of Human vs AI match so other players can spectate!
      if (type === "live:publish") {
        const snapshot = msg.snapshot as ServerMatchSnapshot | undefined;
        if (!snapshot || !snapshot.id) return;
        const existing = activeMatches.get(snapshot.id);
        if (existing) {
          existing.snapshot = {
            ...snapshot,
            kind: "human_ai",
            hostClientId: client.clientId,
            viewers: existing.spectatorIds.size,
            updatedAt: Date.now(),
          };
          for (const specId of existing.spectatorIds) {
            const spec = clientsById.get(specId);
            if (spec) sendJson(spec.ws, { type: "match:state", match: existing.snapshot });
          }
          broadcastLobbyState();
        } else {
          const rec: ServerMatchRecord = {
            snapshot: {
              ...snapshot,
              kind: "human_ai",
              hostClientId: client.clientId,
              viewers: 0,
              updatedAt: Date.now(),
            },
            spectatorIds: new Set<string>(),
            duelTimer: null,
            goalTimer: null,
            aiTimer: null,
            flightNonce: 0,
          };
          activeMatches.set(snapshot.id, rec);
          client.activeMatchId = snapshot.id;
          broadcastLobbyState();
        }
        return;
      }

      if (type === "live:unpublish") {
        const matchId = String(msg.matchId || "");
        const rec = activeMatches.get(matchId);
        if (rec && rec.snapshot.kind === "human_ai" && rec.snapshot.hostClientId === client.clientId) {
          finalizeServerMatch(rec);
          setTimeout(() => {
            activeMatches.delete(matchId);
            broadcastLobbyState();
          }, 4000);
        }
        return;
      }

      if (type === "spectate:join") {
        const matchId = String(msg.matchId || "");
        if (client.spectatingMatchId && client.spectatingMatchId !== matchId) {
          const prev = activeMatches.get(client.spectatingMatchId);
          if (prev) {
            prev.spectatorIds.delete(client.clientId);
            broadcastMatchState(prev);
          }
        }
        const rec = activeMatches.get(matchId);
        if (!rec) {
          sendJson(ws, { type: "mp:error", message: "Трансляция этого матча уже завершилась." });
          return;
        }
        client.spectatingMatchId = matchId;
        rec.spectatorIds.add(client.clientId);
        sendJson(ws, { type: "spectate:joined", match: { ...rec.snapshot, viewers: rec.spectatorIds.size } });
        broadcastMatchState(rec);
        broadcastLobbyState();
        return;
      }

      if (type === "spectate:leave") {
        const targetId = client.spectatingMatchId || String(msg.matchId || "");
        if (targetId) {
          const rec = activeMatches.get(targetId);
          if (rec) {
            rec.spectatorIds.delete(client.clientId);
            broadcastMatchState(rec);
          }
        }
        client.spectatingMatchId = null;
        broadcastLobbyState();
        return;
      }

      if (type === "spectate:reaction") {
        const matchId = String(msg.matchId || client.spectatingMatchId || "");
        const text = String(msg.text || "").trim().slice(0, 28);
        const rec = activeMatches.get(matchId);
        if (!rec || !text) return;
        rec.snapshot.callout = {
          id: `react-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          pos: rec.snapshot.ball.pos,
          text,
          color: 0xfde047,
        };
        addMatchCommentary(rec, `Зритель ${client.managerName}: ${text}`);
        broadcastMatchState(rec);
        return;
      }
    });

    ws.on("close", () => {
      if (!client) return;
      clientsBySocket.delete(ws);
      if (clientsById.get(client.clientId)?.ws === ws) {
        clientsById.delete(client.clientId);
      }

      // Clean open waiting rooms
      for (const [rid, r] of openRooms.entries()) {
        if (r.hostClientId === client.clientId) openRooms.delete(rid);
      }

      // Remove from matchmaking queue
      const qIdx = matchmakingQueue.findIndex((q) => q.clientId === client!.clientId);
      if (qIdx !== -1) matchmakingQueue.splice(qIdx, 1);

      // Remove from spectating match
      if (client.spectatingMatchId) {
        const sRec = activeMatches.get(client.spectatingMatchId);
        if (sRec) {
          sRec.spectatorIds.delete(client.clientId);
          broadcastMatchState(sRec);
        }
      }

      // Handle forfeit/cleanup if disconnecting from active match
      if (client.activeMatchId) {
        const mRec = activeMatches.get(client.activeMatchId);
        if (mRec && mRec.snapshot.status !== "finished") {
          if (mRec.snapshot.kind === "pvp") {
            const forfeitWinner: Team =
              mRec.snapshot.hostClientId === client.clientId ? "red" : "blue";
            addMatchCommentary(
              mRec,
              `${client.clubName} отключились от сервера — техническая победа соперника.`,
              "goal"
            );
            finalizeServerMatch(mRec, forfeitWinner);
            setTimeout(() => {
              activeMatches.delete(mRec.snapshot.id);
              broadcastLobbyState();
            }, 6000);
          } else if (mRec.snapshot.kind === "human_ai") {
            activeMatches.delete(mRec.snapshot.id);
          }
        }
      }

      broadcastLobbyState();
    });
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
