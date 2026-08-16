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

export function generateDisplayNickname(): string {
  const screens = ["Screen", "Stage", "Big Screen", "Monitor", "TV"];
  const screen = screens[Math.floor(Math.random() * screens.length)];
  const number = Math.floor(Math.random() * 90) + 10;
  return `${screen} ${number}`;
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
