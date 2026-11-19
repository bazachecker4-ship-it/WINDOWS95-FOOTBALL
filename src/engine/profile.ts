export interface UserProfile {
  managerName: string;
  clubName: string;
  emblemColor: string;
  homeStadium: string;
  trophies: number;
  matchesWon: number;
  matchesLost: number;
  created: boolean;
}

const PROFILE_STORAGE_KEY = "chess_blitz_user_profile_v1";

export function loadUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      return {
        managerName: "Менеджер '95",
        clubName: "FC Victory '95",
        emblemColor: "#000080",
        homeStadium: "Стадион 'Динамо-95'",
        trophies: 2,
        matchesWon: 5,
        matchesLost: 2,
        created: false,
      };
    }
    return JSON.parse(raw) as UserProfile;
  } catch {
    return {
      managerName: "Менеджер '95",
      clubName: "FC Victory '95",
      emblemColor: "#000080",
      homeStadium: "Стадион 'Динамо-95'",
      trophies: 2,
      matchesWon: 5,
      matchesLost: 2,
      created: false,
    };
  }
}

export function saveUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota
  }
}
