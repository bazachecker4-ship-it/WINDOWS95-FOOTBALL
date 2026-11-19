import {
  AbilityId,
  HairStyle,
  JerseyPattern,
  JerseyTheme,
  PlayerRole,
  RoleAppearance,
  RoleProgression,
  SquadProgressionState,
} from "../types/game";

const STORAGE_KEY = "blitz_football_squad_v2";

function defaultRoleProgression(
  theme: JerseyTheme,
  pattern: JerseyPattern,
  hairStyle: HairStyle
): RoleProgression {
  return {
    stats: { speed: 1, accuracy: 1, defense: 1, passing: 1 },
    unlockedAbilities: [],
    appearance: {
      jerseyTheme: theme,
      jerseyPattern: pattern,
      hairStyle,
    },
  };
}

export function createDefaultProgression(): SquadProgressionState {
  return {
    skillPoints: 3, // Start with 3 skill points so player can immediately experiment with upgrades/abilities
    xp: 0,
    matchesPlayed: 0,
    goalsScored: 0,
    blitzWins: 0,
    roles: {
      GK: defaultRoleProgression("cyan", "solid", "helmet"),
      DEF: defaultRoleProgression("cobalt", "stripes", "classic"),
      MID: defaultRoleProgression("cobalt", "sash", "headband"),
      WNG: defaultRoleProgression("cobalt", "sash", "mohawk"),
      FWD: defaultRoleProgression("cobalt", "stripes", "curly"),
    },
  };
}

export function loadSquadProgression(): SquadProgressionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProgression();
    const parsed = JSON.parse(raw) as SquadProgressionState;
    if (!parsed || !parsed.roles || !parsed.roles.FWD) {
      return createDefaultProgression();
    }
    return parsed;
  } catch {
    return createDefaultProgression();
  }
}

export function saveSquadProgression(state: SquadProgressionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota issues
  }
}

export function upgradeRoleStat(
  state: SquadProgressionState,
  role: PlayerRole,
  stat: keyof RoleProgression["stats"]
): SquadProgressionState {
  const roleProg = state.roles[role];
  if (state.skillPoints < 1 || roleProg.stats[stat] >= 5) return state;

  return {
    ...state,
    skillPoints: state.skillPoints - 1,
    roles: {
      ...state.roles,
      [role]: {
        ...roleProg,
        stats: {
          ...roleProg.stats,
          [stat]: roleProg.stats[stat] + 1,
        },
      },
    },
  };
}

export function unlockRoleAbility(
  state: SquadProgressionState,
  role: PlayerRole,
  abilityId: AbilityId,
  cost: number
): SquadProgressionState {
  const roleProg = state.roles[role];
  if (state.skillPoints < cost || roleProg.unlockedAbilities.includes(abilityId)) {
    return state;
  }

  return {
    ...state,
    skillPoints: state.skillPoints - cost,
    roles: {
      ...state.roles,
      [role]: {
        ...roleProg,
        unlockedAbilities: [...roleProg.unlockedAbilities, abilityId],
      },
    },
  };
}

export function updateRoleAppearance(
  state: SquadProgressionState,
  role: PlayerRole,
  patch: Partial<RoleAppearance>
): SquadProgressionState {
  const roleProg = state.roles[role];
  return {
    ...state,
    roles: {
      ...state.roles,
      [role]: {
        ...roleProg,
        appearance: {
          ...roleProg.appearance,
          ...patch,
        },
      },
    },
  };
}

export function awardMatchRewards(
  state: SquadProgressionState,
  earnedXp: number,
  goalsScored: number,
  blitzWins: number,
  isMatchEnd = false
): { next: SquadProgressionState; pointsEarned: number } {
  const prevLevel = Math.floor(state.xp / 60);
  const nextXp = state.xp + earnedXp;
  const nextLevel = Math.floor(nextXp / 60);
  const pointsEarned = Math.max(0, nextLevel - prevLevel);

  return {
    pointsEarned,
    next: {
      ...state,
      xp: nextXp,
      skillPoints: state.skillPoints + pointsEarned,
      matchesPlayed: isMatchEnd ? state.matchesPlayed + 1 : state.matchesPlayed,
      goalsScored: state.goalsScored + goalsScored,
      blitzWins: state.blitzWins + blitzWins,
    },
  };
}
