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

export interface Room {
  id: string;
  name: string;
  client_count: number;
  controllers_count: number;
  displays_count: number;
  has_leader: boolean;
  queue_length: number;
  is_active: boolean;
  is_public: boolean;
  requires_password: boolean;
  created_at: number;
  current_song: string | null;
}

export interface RoomsResponse {
  rooms: Room[];
  timestamp: number;
}

export interface CreateRoomRequest {
  room_id: string;
  is_public: boolean;
  password?: string;
}

export interface CreateRoomResponse {
  success: boolean;
  room: {
    id: string;
    is_public: boolean;
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
    is_public: boolean;
    requires_password: boolean;
  };
}
