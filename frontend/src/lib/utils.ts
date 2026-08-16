import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateRoomId(): string {
  const adjectives = ["fun", "cool", "awesome", "epic", "great", "super", "amazing", "stellar", "brilliant", "fantastic"];
  const nouns = ["karaoke", "party", "session", "room", "stage", "studio", "lounge", "spot", "zone", "venue"];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 1000);
  return `${adjective}-${noun}-${number}`;
}

/**
 * Karaoke decks address every track by a 5-digit songbook number. We have no
 * catalogue, so derive one from the entry id: same song, same number, on every
 * device in the room and across sessions.
 */
export function songNumber(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return String((hash % 90000) + 10000);
}

export function formatClock(seconds: number, showHours = false): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return showHours ? "--:--:--" : "--:--";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const mm = minutes.toString().padStart(2, "0");
  const ss = secs.toString().padStart(2, "0");

  if (showHours || hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }

  return `${mm}:${ss}`;
}
