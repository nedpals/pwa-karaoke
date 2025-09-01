import type { KaraokeEntry, KaraokeSearchResult, VideoURLResponse } from '../types';

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
}

export const apiClient = new ApiClient();