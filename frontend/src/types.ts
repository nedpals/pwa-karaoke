export interface KaraokeEntry {
  id: string;  // Changed to string to match YouTube video IDs
  title: string;
  artist: string;
  video_url: string | null;  // Made optional for lazy loading
  source: string;
  uploader: string;
  duration: number | null;
}

export interface KaraokeSearchResult {
  entries: KaraokeEntry[];
}

export interface VideoURLResponse {
  video_url: string | null;
}

export interface DisplayPlayerState {
  entry: KaraokeEntry | null;
  play_state: "playing" | "paused" | "finished" | "buffering";
  current_time: number;
  duration: number;
  volume: number;
  version: number;
  timestamp: number;
}

export interface KaraokeQueueItem {
  id: string;
  entry: KaraokeEntry;
}

export interface KaraokeQueue {
  items: KaraokeQueueItem[];
  version: number;
  timestamp: number;
}
