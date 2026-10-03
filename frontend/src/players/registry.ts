import type { EmbedSource } from "../types";
import type { EmbedPlayerComponent } from "./types";
import { YouTubeEmbedPlayer } from "./YouTubeEmbedPlayer";

const EMBED_PLAYERS: Record<string, EmbedPlayerComponent> = {
  youtube: YouTubeEmbedPlayer,
};

export function embedPlayerFor(embed: EmbedSource | null | undefined): EmbedPlayerComponent | null {
  return embed ? EMBED_PLAYERS[embed.player] ?? null : null;
}
