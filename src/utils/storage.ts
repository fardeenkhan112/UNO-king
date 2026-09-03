import { UserProfile } from '../types';

const PROFILE_KEY = 'unu_king_profile';
const SOUND_KEY = 'unu_king_sound';

export function loadProfile(): UserProfile {
  try {
    const saved = localStorage.getItem(PROFILE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.name === 'string') {
        return {
          name: parsed.name.slice(0, 16) || 'Player',
          avatar: parsed.avatar || '👑',
        };
      }
    }
  } catch {
    // ignore
  }

  // Default guest profile
  const guestNum = Math.floor(100 + Math.random() * 900);
  const defaultProfile: UserProfile = {
    name: `Player_${guestNum}`,
    avatar: '👑',
  };
  saveProfile(defaultProfile);
  return defaultProfile;
}

export function saveProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

export function loadSoundSetting(): boolean {
  try {
    const saved = localStorage.getItem(SOUND_KEY);
    if (saved !== null) {
      return saved === 'true';
    }
  } catch {
    // ignore
  }
  return true;
}

export function saveSoundSetting(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, enabled.toString());
  } catch {
    // ignore
  }
}


const PLAYER_ID_KEY = 'uno-king-player-id';

export function getClientPlayerId(): string {
  try {
    const existing = localStorage.getItem(PLAYER_ID_KEY);
    if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;
    const id = `p-${crypto.randomUUID()}`;
    localStorage.setItem(PLAYER_ID_KEY, id);
    return id;
  } catch {
    return `p-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  }
}
