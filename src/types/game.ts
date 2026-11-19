export type Team = "blue" | "red";

export type PlayerRole = "GK" | "DEF" | "MID" | "WNG" | "FWD";

export type GameMode = "ai" | "local";
export type AIDifficulty = "rookie" | "tactical" | "pro";
export type BlitzPace = "turbo" | "blitz" | "relaxed";

export type PitchType = "turf" | "ice" | "sand" | "obstacles";

export type TacticalMentality = "defend" | "balance" | "attack";

export type BlitzVariant = "classic" | "decay" | "blocked" | "grand";
export type BlitzModePreference = "dynamic" | BlitzVariant;

export type GamePhase =
  | "TITLE_MENU"
  | "PLAYING"
  | "BLITZ_DUEL"
  | "GOAL_CELEBRATION"
  | "GAME_OVER";

export interface Position {
  col: number;
  row: number;
}

export interface FloatingCallout {
  id: string;
  pos: Position;
  text: string;
  color: number;
}

export interface BallFlightEvent {
  nonce: number;
  from: Position;
  to: Position;
  isLob: boolean;
  isShot: boolean;
}

export interface PlayerPiece {
  id: string;
  team: Team;
  role: PlayerRole;
  number: number;
  skinTone: number; // 0..3 for realistic visual variety
  pos: Position;
}

export interface BallState {
  pos: Position;
  carrierId: string | null;
}

export interface PlayerStats {
  speed: number;
  accuracy: number;
  defense: number;
  passing: number;
}

export type AbilityId =
  | "gk_glove"
  | "gk_longkick"
  | "def_slide"
  | "def_wall"
  | "mid_lob"
  | "mid_maestro"
  | "wng_feint"
  | "wng_sprint"
  | "fwd_ice"
  | "fwd_instinct";

export interface AbilityDef {
  id: AbilityId;
  role: PlayerRole;
  name: string;
  description: string;
  cost: number;
}

export type JerseyTheme = "cobalt" | "cyan" | "violet" | "emerald" | "amber";
export type JerseyPattern = "solid" | "stripes" | "sash";
export type HairStyle = "classic" | "mohawk" | "curly" | "headband" | "helmet";

export interface RoleAppearance {
  jerseyTheme: JerseyTheme;
  jerseyPattern: JerseyPattern;
  hairStyle: HairStyle;
}

export interface RoleProgression {
  stats: PlayerStats;
  unlockedAbilities: AbilityId[];
  appearance: RoleAppearance;
}

export interface SquadProgressionState {
  skillPoints: number;
  xp: number;
  matchesPlayed: number;
  goalsScored: number;
  blitzWins: number;
  roles: Record<PlayerRole, RoleProgression>;
}

export interface MatchStats {
  moves: number;
  passes: number;
  shots: number;
  blitzPlayed: number;
  blitzWon: number;
  blitzTimeouts: number;
  roleMoves: Record<PlayerRole, number>;
}

export interface CoachAnalysis {
  styleSummary: string;
  tacticalAdvice: string[];
  upgradeRecommendation: string;
  source: "gemini" | "local";
}

export interface BlitzComplexity {
  size: 3 | 4 | 5;
  winLength: 3 | 4;
  variant: BlitzVariant;
  variantName: string;
  variantDesc: string;
  blockedCells: number[];
  maxMarksPerPlayer: number | null;
  reasons: string[];
  label: string;
}

export interface MoveOption {
  pos: Position;
  kind: "move" | "pickup" | "clash";
  opponentId?: string;
  complexity?: BlitzComplexity;
  isSlide?: boolean;
}

export interface PassOption {
  targetPlayerId: string;
  pos: Position;
  isLob?: boolean;
}

export interface ShotOption {
  goalRow: number;
  isContested: boolean;
  defenderId?: string;
  complexity?: BlitzComplexity;
}

export interface TacticalHint {
  actionType: "move" | "pass" | "shoot";
  playerId: string;
  targetPos?: Position;
  targetPlayerId?: string;
  goalRow?: number;
  reason: string;
}

export interface ActiveBlitzDuel {
  initiatorId: string;
  defenderId: string;
  contestedPos: Position;
  initiatorOrigin: Position;
  isShotDuel: boolean;
  goalRow?: number;
  complexity: BlitzComplexity;
  ballOwnerBeforeId: string | null;
  bonusTimeMsBlue: number;
  bonusTimeMsRed: number;
}

export interface CommentaryItem {
  id: string;
  turn: number;
  text: string;
  source: "gemini" | "local";
  highlight?: "goal" | "blitz" | "save" | "normal";
}

export interface RoleMeta {
  code: string;
  name: string;
  chessName: string;
  moveSummary: string;
  rangeLabel: string;
}

// 32x32 Tactical Pitch & 11v11 Football Constants
export const PITCH_COLS = 32;
export const PITCH_ROWS = 32;
export const GOAL_ROWS = [13, 14, 15, 16, 17, 18] as const;
export const MAX_TURNS = 36;
export const TARGET_GOALS = 3;

export const ROLE_META: Record<PlayerRole, RoleMeta> = {
  GK: {
    code: "ВР",
    name: "Вратарь",
    chessName: "Король",
    moveSummary: "До 3 клеток в любом направлении в зоне ворот. Усложняет блиц-дуэль в штрафной.",
    rangeLabel: "До 3 клеток (8 напр.)",
  },
  DEF: {
    code: "ЗЩ",
    name: "Защитник",
    chessName: "Ладья",
    moveSummary: "По прямой (вперёд, назад, вбок) до 6 клеток. Усиливает отбор на своей половине.",
    rangeLabel: "Прямо до 6 клеток",
  },
  MID: {
    code: "ПЗ",
    name: "Полузащитник",
    chessName: "Слон+",
    moveSummary: "По диагонали до 7 клеток, плюс шаг до 2 клеток по прямой для смены фланга.",
    rangeLabel: "Диагональ 7 + шаг 2",
  },
  WNG: {
    code: "КП",
    name: "Вингер",
    chessName: "Конь+",
    moveSummary: "Широкий прыжок «Г» (3+2 или 4+1) через игроков и барьеры, плюс рывок по прямой.",
    rangeLabel: "Прыжок «Г» + рывок 3",
  },
  FWD: {
    code: "НП",
    name: "Форвард",
    chessName: "Ферзь",
    moveSummary: "В любом направлении до 5 клеток с мячом или до 7 клеток при рывке без мяча.",
    rangeLabel: "Любое напр. 5 (без мяча 7)",
  },
};

export const PITCH_META: Record<
  PitchType,
  { name: string; subtitle: string; effectDesc: string }
> = {
  turf: {
    name: "Классический газон",
    subtitle: "Стадион 32×32",
    effectDesc: "Живой газон 32×32, сбалансированное движение 11 на 11 и точные передачи.",
  },
  ice: {
    name: "Скользкий лёд",
    subtitle: "Ледовая арена",
    effectDesc: "Рывки скользят +2 клетки дальше по прямой/диагонали; дальность пасов увеличена.",
  },
  sand: {
    name: "Песчаный пляж",
    subtitle: "Пляжный футбол",
    effectDesc: "Вязкий песок снижает бег на 2 клетки (кроме прыжка «Г»). В стыках появляются блок-клетки.",
  },
  obstacles: {
    name: "Поле с барьерами",
    subtitle: "Тактический полигон",
    effectDesc: "8 тренировочных конусов на флангах — их можно перепрыгивать Вингером или перебрасывать пасом.",
  },
};

export const BLITZ_VARIANT_META: Record<
  BlitzVariant,
  { name: string; shortDesc: string }
> = {
  classic: {
    name: "Классический блиц 3×3",
    shortDesc: "Соберите 3 в ряд на открытом стыке 1 на 1.",
  },
  decay: {
    name: "Исчезающий след 3×3",
    shortDesc: "Максимум 3 фишки на игрока — четвёртая стирает самую старую. Ничьих нет!",
  },
  blocked: {
    name: "Прессинг с блоками 4×4",
    shortDesc: "Соберите 3 в ряд на поле 4×4, обходя 2 заблокированные клетки.",
  },
  grand: {
    name: "Большая штрафная 5×5",
    shortDesc: "Соберите 4 в ряд в острейших моментах у ворот или против вратаря.",
  },
};

export const ABILITIES_BY_ROLE: Record<PlayerRole, AbilityDef[]> = {
  GK: [
    {
      id: "gk_glove",
      role: "GK",
      name: "Железная перчатка",
      description: "+0.9с времени на каждый ход в блиц-дуэли у ворот.",
      cost: 2,
    },
    {
      id: "gk_longkick",
      role: "GK",
      name: "Длинный вынос",
      description: "Вратарь может отдавать пас на 5 клеток дальше через центр поля.",
      cost: 2,
    },
  ],
  DEF: [
    {
      id: "def_slide",
      role: "DEF",
      name: "Диагональный подкат",
      description: "Открывает рывок до 3 клеток по диагонали для перехвата.",
      cost: 2,
    },
    {
      id: "def_wall",
      role: "DEF",
      name: "Непроходимая стена",
      description: "+0.8с к таймеру в блиц-стыках и усложнение атаки соперника.",
      cost: 2,
    },
  ],
  MID: [
    {
      id: "mid_lob",
      role: "MID",
      name: "Разрезающий навес",
      description: "Пас Полузащитника перелетает через одного соперника на линии.",
      cost: 2,
    },
    {
      id: "mid_maestro",
      role: "MID",
      name: "Дирижёр поля",
      description: "+2 клетки к дальности диагонального хода.",
      cost: 2,
    },
  ],
  WNG: [
    {
      id: "wng_feint",
      role: "WNG",
      name: "Двойной финт",
      description: "+0.9с времени в блиц-дуэлях при атаке.",
      cost: 2,
    },
    {
      id: "wng_sprint",
      role: "WNG",
      name: "Рывок по бровке",
      description: "Дополнительный прямой рывок до 5 клеток вперёд/вбок.",
      cost: 2,
    },
  ],
  FWD: [
    {
      id: "fwd_ice",
      role: "FWD",
      name: "Холодная голова",
      description: "+1.0с в блиц-дуэлях при ударе по воротам.",
      cost: 2,
    },
    {
      id: "fwd_instinct",
      role: "FWD",
      name: "Голевое чутьё",
      description: "Уменьшает сложность ударного блица (5×5 → 4×4) и расширяет зону удара.",
      cost: 3,
    },
  ],
};

export const JERSEY_THEME_STYLES: Record<
  JerseyTheme,
  { name: string; gradient: string; border: string; swatch: string }
> = {
  cobalt: {
    name: "Кобальт",
    gradient: "from-blue-500 to-blue-700",
    border: "border-blue-200/90",
    swatch: "#2563EB",
  },
  cyan: {
    name: "Ледяной",
    gradient: "from-sky-400 to-cyan-700",
    border: "border-sky-100/90",
    swatch: "#0284C7",
  },
  violet: {
    name: "Аметист",
    gradient: "from-violet-500 to-indigo-700",
    border: "border-violet-200/90",
    swatch: "#7C3AED",
  },
  emerald: {
    name: "Изумруд",
    gradient: "from-emerald-500 to-teal-700",
    border: "border-emerald-200/90",
    swatch: "#059669",
  },
  amber: {
    name: "Золото",
    gradient: "from-amber-400 to-orange-600",
    border: "border-amber-100/90",
    swatch: "#D97706",
  },
};

export const HAIR_LABELS: Record<HairStyle, string> = {
  classic: "Классика",
  mohawk: "Ирокез",
  curly: "Кудри",
  headband: "Повязка",
  helmet: "Шлем",
};

export const PATTERN_LABELS: Record<JerseyPattern, string> = {
  solid: "Сплошная",
  stripes: "Полосы",
  sash: "Диагональ",
};

export const BLITZ_PACE_MS: Record<BlitzPace, number | null> = {
  turbo: 2200,
  blitz: 3500,
  relaxed: null,
};
