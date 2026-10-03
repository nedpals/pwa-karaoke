import type { ComponentType, Ref } from "react";

export interface PlayerSnapshot {
  currentTime: number;
  duration: number;
  volume: number;
  // False while buffering, matching a <video> element
  paused: boolean;
  ended: boolean;
}

export interface PlayerHandle {
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  setVolume(volume: number): void;
  snapshot(): PlayerSnapshot;
}

export type PlayerError =
  | { kind: "stream" }
  | { kind: "embed"; code: string };

export interface PlayerEvents {
  onReady(): void;
  onPlay(): void;
  onPause(): void;
  onBuffering(): void;
  onTimeUpdate(): void;
  onEnded(): void;
  onError(error: PlayerError): void;
}

interface PlayerProps {
  ref: Ref<PlayerHandle>;
  events: PlayerEvents;
  className?: string;
}

export interface NativePlayerProps extends PlayerProps {
  src: string;
}

export interface EmbedPlayerProps extends PlayerProps {
  id: string;
}

export type EmbedPlayerComponent = ComponentType<EmbedPlayerProps>;
