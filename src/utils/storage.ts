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

function createPlayerId(): string {
  return `p-${crypto.randomUUID()}`;
}

function isValidStoredPlayerId(
  value: string | null
): value is string {
  return Boolean(
    value &&
      /^[A-Za-z0-9_-]{8,64}$/.test(value)
  );
}

export function getClientPlayerId(): string {
  // 1. localStorage
  try {
    const existing =
      localStorage.getItem(
        PLAYER_ID_KEY
      );

    if (
      isValidStoredPlayerId(existing)
    ) {
      return existing;
    }
  } catch {
    // Continue to cookie/sessionStorage fallback.
  }

  // 2. Browser cookie
  try {
    const cookies =
      document.cookie
        .split(';')
        .map((item) => item.trim());

    const cookie =
      cookies.find((item) =>
        item.startsWith(
          `${PLAYER_ID_KEY}=`
        )
      );

    const existing =
      cookie
        ? decodeURIComponent(
            cookie.substring(
              PLAYER_ID_KEY.length + 1
            )
          )
        : null;

    if (
      isValidStoredPlayerId(existing)
    ) {
      try {
        localStorage.setItem(
          PLAYER_ID_KEY,
          existing
        );
      } catch {}

      return existing;
    }
  } catch {
    // Continue to sessionStorage.
  }

  // 3. sessionStorage
  try {
    const existing =
      sessionStorage.getItem(
        PLAYER_ID_KEY
      );

    if (
      isValidStoredPlayerId(existing)
    ) {
      return existing;
    }
  } catch {
    // Continue to create a new ID.
  }

  // 4. Create one stable ID
  const id =
    createPlayerId();

  try {
    localStorage.setItem(
      PLAYER_ID_KEY,
      id
    );
  } catch {}

  try {
    sessionStorage.setItem(
      PLAYER_ID_KEY,
      id
    );
  } catch {}

  try {
    document.cookie =
      `${PLAYER_ID_KEY}=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {}

  return id;
}
