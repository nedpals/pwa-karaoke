// Room password storage utilities using sessionStorage

const ROOM_PASSWORD_PREFIX = 'room-password-';

export function storeRoomPassword(roomId: string, password: string): void {
  if (!password) return;
  
  try {
    sessionStorage.setItem(`${ROOM_PASSWORD_PREFIX}${roomId}`, password);
  } catch (error) {
    console.warn('Failed to store room password:', error);
  }
}

export function getRoomPassword(roomId: string): string | null {
  try {
    return sessionStorage.getItem(`${ROOM_PASSWORD_PREFIX}${roomId}`);
  } catch (error) {
    console.warn('Failed to retrieve room password:', error);
    return null;
  }
}

export function removeRoomPassword(roomId: string): void {
  try {
    sessionStorage.removeItem(`${ROOM_PASSWORD_PREFIX}${roomId}`);
  } catch (error) {
    console.warn('Failed to remove room password:', error);
  }
}

export function clearAllRoomPasswords(): void {
  try {
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith(ROOM_PASSWORD_PREFIX)) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('Failed to clear room passwords:', error);
  }
}

export function hasStoredPassword(roomId: string): boolean {
  return getRoomPassword(roomId) !== null;
}