export interface KaraokeEntry {
  id: string;  // Changed to string to match YouTube video IDs
  title: string;
  artist: string;
  video_url: string | null;  // Made optional for lazy loading
  source: string;
  uploader: string;
  duration: number | null;
  thumbnail_url?: string | null;
}

export interface KaraokeSearchResult {
  entries: KaraokeEntry[];
  total: number;
}

export interface VideoURLResponse {
  video_url: string | null;
}

export interface DisplayPlayerState {
  entry: KaraokeEntry | null;
  /** The reservation on air. See performanceIdOf in lib/scoring. */
  item_id?: string | null;
  singer?: string | null;
  play_state: "playing" | "paused" | "finished" | "buffering" | "error" | "idle";
  current_time: number;
  duration: number;
  volume: number;
  version: number;
  timestamp: number;
}

export type ReactionType = "clap" | "fire" | "heart" | "laugh" | "star" | "boo";

export interface ReactionEvent {
  id: string;
  reaction: ReactionType;
  timestamp: number;
}

export type ScoreSource = "mic" | "auto";

export interface SongScore {
  item_id: string;
  score: number;
  source: ScoreSource;
  version: number;
  timestamp: number;
}

export interface KaraokeQueueItem {
  id: string;
  entry: KaraokeEntry;
  singer?: string | null;
}

export interface KaraokeQueue {
  items: KaraokeQueueItem[];
  version: number;
  timestamp: number;
}

export interface RoomSettings {
  autoplay: boolean;
  min_scored_seconds: number;
  version: number;
  timestamp: number;
}

export interface RoomDetails {
  id: string;
  requires_password: boolean;
  created_at: number;
}

export interface CreateRoomRequest {
  room_id: string;
  password?: string;
}

export interface CreateRoomResponse {
  success: boolean;
  room: {
    id: string;
    requires_password: boolean;
    created_at: number;
  };
}

export interface VerifyRoomRequest {
  room_id: string;
  password?: string;
}

export interface VerifyRoomResponse {
  success: boolean;
  room: {
    id: string;
    requires_password: boolean;
  };
}
