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

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  retryCondition?: (error: Error, response?: Response) => boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    const protocol = window.location.protocol;
    const host = window.location.host.includes('localhost')
      ? 'localhost:8000'
      : window.location.host;
    this.baseUrl = `${protocol}//${host}`;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private shouldRetry(error: Error, response?: Response): boolean {
    // Network errors (fetch failures)
    if (!response) return true;

    // Server errors (5xx)
    if (response.status >= 500) return true;

    // Rate limiting
    if (response.status === 429) return true;

    // Proxy authentication errors
    if (response.status === 407) return true;

    // Timeout errors
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) return true;

    return false;
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    retryOptions: RetryOptions = {}
  ): Promise<Response> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      retryCondition = this.shouldRetry
    } = retryOptions;

    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);

        if (response.ok) {
          return response;
        }

        // Create an error for non-ok responses
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        lastError = error;

        // Check if we should retry
        if (attempt < maxRetries && retryCondition(error, response)) {
          const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
          const jitter = Math.random() * 0.1 * delay;
          const totalDelay = delay + jitter;

          console.log(`Request failed (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}. Retrying in ${Math.round(totalDelay)}ms...`);
          await this.delay(totalDelay);
          continue;
        }

        throw error;

      } catch (error) {
        lastError = error as Error;

        // Check if we should retry
        if (attempt < maxRetries && retryCondition(lastError)) {
          const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
          const jitter = Math.random() * 0.1 * delay;
          const totalDelay = delay + jitter;

          console.log(`Request failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError.message}. Retrying in ${Math.round(totalDelay)}ms...`);
          await this.delay(totalDelay);
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  async search(query: string): Promise<KaraokeSearchResult> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/search?query=${encodeURIComponent(query)}`,
      {},
      {
        maxRetries: 2, // Fewer retries for search to keep it responsive
        baseDelay: 1000,
      }
    );

    return response.json();
  }

  async getVideoUrl(entry: KaraokeEntry): Promise<VideoURLResponse> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/get_video_url`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      },
      {
        maxRetries: 3,
        baseDelay: 1500, // Slightly longer delay for video URL fetching
      }
    );

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