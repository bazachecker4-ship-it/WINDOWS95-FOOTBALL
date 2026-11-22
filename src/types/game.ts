export type Team = "blue" | "red";

export type PlayerRole = "GK" | "DEF" | "MID" | "WNG" | "FWD";

export type GameMode = "ai" | "local" | "online";
export type AIDifficulty = "rookie" | "tactical" | "pro";
export type AIOpponentEngine = "classic" | "groq";
export type CameraPreset = "wide" | "tv" | "close" | "topdown" | "opposite";
export type BlitzPace = "turbo" | "blitz" | "relaxed";
export type AIPace = "normal" | "fast";

export type PitchType = "turf" | "ice" | "sand" | "obstacles";

export type TacticalMentality = "defend" | "balance" | "attack";
export type FormationId = "4-3-3" | "4-4-2" | "3-5-2";
export type PlayerActionMode = "move" | "pass" | "shoot" | "tackle";

export type BlitzVariant = "classic" | "decay" | "blocked" | "grand";
export type BlitzModePreference = "dynamic" | BlitzVariant;

export type GamePhase =
  | "TITLE_MENU"
  | "MULTIPLAYER_LOBBY"
  | "SPECTATE"
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
  isSuperShot?: boolean;
}

export interface PlayerPiece {
  id: string;
  team: Team;
  role: PlayerRole;
  number: number;
  skinTone: number; // 0..3 for realistic visual variety
  stamina: number; // 0..100 tactical stamina
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

export interface MatchMistakeEvent {
  id: string;
  turn: number;
  playerLabel: string;
  type: "timeout" | "blitz_timeout" | "blitz_lost" | "offside" | "fatigue";
  detail: string;
}

export interface MatchStats {
  moves: number;
  passes: number;
  shots: number;
  offsides: number;
  turnTimeouts: number;
  blitzPlayed: number;
  blitzWon: number;
  blitzTimeouts: number;
  roleMoves: Record<PlayerRole, number>;
}

export interface CoachMistakeItem {
  player: string;
  issue: string;
  fix: string;
}

export interface CoachAnalysis {
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
  apCost?: number;
}

export interface PassOption {
  targetPlayerId: string;
  pos: Position;
  isLob?: boolean;
  isOffside?: boolean;
  isKeyPass?: boolean;
  interceptionRisk?: "safe" | "tight";
  apCost?: number;
}

export interface ShotOption {
  goalRow: number;
  isContested: boolean;
  defenderId?: string;
  complexity?: BlitzComplexity;
  apCost?: number;
}

export type PressureLevel = "free" | "marked" | "forward_blocked" | "retreat_only";

export interface TacticalPressureState {
  level: PressureLevel;
  frontBlockers: number;
  adjacentEnemies: number;
  reason: string;
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
  isSuperShot?: boolean;
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
  source: "gemini" | "groq" | "local";
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
    chessName: "Страж ворот",
    moveSummary: "Маневрирует до 3.5 кл. в штрафной на 360° и перекрывает углы обстрела.",
    rangeLabel: "360° до 3.5 кл. (штрафная)",
  },
  DEF: {
    code: "ЗЩ",
    name: "Защитник",
    chessName: "Стоппер",
    moveSummary: "Плотный шаг на 360° по каналам обороны (до 5 кл.), держит блок и страхует линию.",
    rangeLabel: "360° канал до 5 кл.",
  },
  MID: {
    code: "ПЗ",
    name: "Полузащитник",
    chessName: "Диспетчер",
    moveSummary: "Свободное движение 360° до 6 кл. через полуфланги, разрезающие навесы и смена темпа.",
    rangeLabel: "360° обзор до 6 кл.",
  },
  WNG: {
    code: "КП",
    name: "Вингер",
    chessName: "Инсайд",
    moveSummary: "Взрывной рывок по бровке и смещение в центр до 6.5 кл. с обводкой 1 опекуна (слалом).",
    rangeLabel: "Слалом + рывок до 6.5 кл.",
  },
  FWD: {
    code: "НП",
    name: "Форвард",
    chessName: "Наконечник",
    moveSummary: "Агрессивное открывание на 360° (до 5.5 кл. с мячом / 7 кл. без мяча) и мощный удар.",
    rangeLabel: "Рывок 5.5 (без мяча 7)",
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

export interface OnlineUserInfo {
  clientId: string;
  clubName: string;
  managerName: string;
}

export interface MultiplayerRoomInfo {
  id: string;
  name: string;
  hostClientId: string;
  hostName: string;
  hostClub: string;
  pitchType: PitchType;
  blitzPace: BlitzPace;
  blitzModePref: BlitzModePreference;
  challengeCode?: string;
  status: "waiting" | "playing";
  createdAt: number;
}

export interface LobbyChatMessage {
  id: string;
  sender: string;
  clubName?: string;
  text: string;
  time: string;
  isSystem?: boolean;
}

export interface MatchTelemetryStats {
  blueTurns: number;
  redTurns: number;
  passesBlue: number;
  passesRed: number;
  shotsBlue: number;
  shotsRed: number;
  blitzBlueWon: number;
  blitzRedWon: number;
}

export interface LiveMatchSummary {
  id: string;
  kind: "pvp" | "human_ai" | "ai_league";
  roomName: string;
  hostName: string;
  guestName: string;
  scoreBlue: number;
  scoreRed: number;
  turn: number;
  maxTurns: number;
  currentTurn: Team;
  pitchType: PitchType;
  pace: BlitzPace;
  viewers: number;
  status: "playing" | "blitz" | "goal" | "finished";
  possessionBluePct: number;
  latestEvent?: string;
}

export interface ServerDuelState {
  duel: ActiveBlitzDuel;
  board: Array<"X" | "O" | "BLOCKED" | null>;
  turnMark: "X" | "O";
  xQueue: number[];
  oQueue: number[];
  winningLine: number[];
  finished: boolean;
  winnerTeam: Team | "draw" | null;
  statusMessage: string;
  wasTimeout: boolean;
}

export interface ServerMatchSnapshot {
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
  players: PlayerPiece[];
  ball: BallState;
  currentTurn: Team;
  turnCount: number;
  scoreBlue: number;
  scoreRed: number;
  status: "playing" | "blitz" | "goal" | "finished";
  winner: Team | "draw" | null;
  activeDuelState: ServerDuelState | null;
  lastMoveTrace: { from: Position; to: Position; team: Team } | null;
  ballFlight: BallFlightEvent | null;
  goalBanner: { team: Team; text: string } | null;
  callout: FloatingCallout | null;
  commentary: CommentaryItem[];
  telemetry: MatchTelemetryStats;
  viewers: number;
  updatedAt: number;
}
