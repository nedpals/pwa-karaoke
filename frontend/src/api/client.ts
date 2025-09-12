import type { 
  KaraokeEntry, 
  KaraokeSearchResult, 
  VideoURLResponse, 
  Room, 
  RoomsResponse,
  CreateRoomRequest,
  CreateRoomResponse,
  VerifyRoomRequest,
  VerifyRoomResponse
} from '../types';

class ApiClient {
  private baseUrl: string;

  constructor() {
    const protocol = window.location.protocol;
    const host = window.location.host.includes('localhost') 
      ? 'localhost:8000' 
      : window.location.host;
    this.baseUrl = `${protocol}//${host}`;
  }

  async search(query: string): Promise<KaraokeSearchResult> {
    const response = await fetch(
      `${this.baseUrl}/search?query=${encodeURIComponent(query)}`
    );
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getVideoUrl(entry: KaraokeEntry): Promise<VideoURLResponse> {
    const response = await fetch(`${this.baseUrl}/get_video_url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(entry),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch video URL: ${response.statusText}`);
    }

    return response.json();
  }

  async getRooms(): Promise<RoomsResponse> {
    const response = await fetch(`${this.baseUrl}/rooms`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch rooms: ${response.statusText}`);
    }
    
    return response.json();
  }

  async createRoom(request: CreateRoomRequest): Promise<CreateRoomResponse> {
    const response = await fetch(`${this.baseUrl}/rooms/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Failed to create room: ${response.statusText}`);
    }

    return response.json();
  }

  async getRoomDetails(roomId: string): Promise<Room> {
    const response = await fetch(`${this.baseUrl}/rooms/${roomId}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Failed to get room details: ${response.statusText}`);
    }
    
    return response.json();
  }

  async verifyRoomAccess(request: VerifyRoomRequest): Promise<VerifyRoomResponse> {
    const response = await fetch(`${this.baseUrl}/rooms/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Failed to verify room access: ${response.statusText}`);
    }

    return response.json();
  }

  async heartbeat(): Promise<{ status: string; timestamp: number }> {
    const response = await fetch(`${this.baseUrl}/heartbeat`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      throw new Error(`Heartbeat failed: ${response.statusText}`);
    }

    return response.json();
  }
}

export const apiClient = new ApiClient();