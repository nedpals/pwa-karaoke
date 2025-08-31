export interface KaraokeEntry {
  id: number;
  title: string;
  artist: string;
  video_url: string;
  source: string;
  uploader: string;
  duration: number | null;
}

export interface DisplayPlayerState {
  entry: KaraokeEntry | null;
  play_state: "playing" | "paused" | "finished";
  current_time: number;
  duration: number;
}

export interface KaraokeQueueItem {
  id: string;
  entry: KaraokeEntry;
}

export interface KaraokeQueue {
  items: KaraokeQueueItem[];
}
