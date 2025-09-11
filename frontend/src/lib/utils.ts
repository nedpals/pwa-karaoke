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