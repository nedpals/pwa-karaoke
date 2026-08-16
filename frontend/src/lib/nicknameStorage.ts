// Nickname storage utilities

import { generateDisplayNickname } from './utils';

const NICKNAME_KEY = 'karaoke-nickname';
const DISPLAY_NICKNAME_KEY = 'karaoke-display-nickname';

/** Kept in step with MAX_NICKNAME_LENGTH on the server. */
export const MAX_NICKNAME_LENGTH = 20;

export function normalizeNickname(nickname: string): string {
  return nickname.split(/\s+/).join(' ').trim().slice(0, MAX_NICKNAME_LENGTH);
}

export function storeNickname(nickname: string): void {
  const normalized = normalizeNickname(nickname);
  if (!normalized) return;

  try {
    localStorage.setItem(NICKNAME_KEY, normalized);
  } catch (error) {
    console.warn('Failed to store nickname:', error);
  }
}

/** The nickname this device last joined with, used to prefill the prompt. */
export function getNickname(): string {
  try {
    return normalizeNickname(localStorage.getItem(NICKNAME_KEY) ?? '');
  } catch (error) {
    console.warn('Failed to retrieve nickname:', error);
    return '';
  }
}

/** Generated once per tab, since nobody is at the screen to type one. */
export function getDisplayNickname(): string {
  try {
    const stored = sessionStorage.getItem(DISPLAY_NICKNAME_KEY);
    if (stored) return stored;

    const generated = generateDisplayNickname();
    sessionStorage.setItem(DISPLAY_NICKNAME_KEY, generated);
    return generated;
  } catch (error) {
    console.warn('Failed to read display nickname:', error);
    return generateDisplayNickname();
  }
}

export function clearNickname(): void {
  try {
    localStorage.removeItem(NICKNAME_KEY);
  } catch (error) {
    console.warn('Failed to clear nickname:', error);
  }
}
