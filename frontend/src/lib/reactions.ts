import type { ReactionType } from "../types";

export interface ReactionDefinition {
  type: ReactionType;
  glyph: string;
  label: string;
}

export const REACTIONS: ReactionDefinition[] = [
  { type: "clap", glyph: "👏", label: "Clap" },
  { type: "fire", glyph: "🔥", label: "Fire" },
  { type: "heart", glyph: "❤️", label: "Heart" },
  { type: "laugh", glyph: "😂", label: "Laugh" },
  { type: "star", glyph: "⭐", label: "Star" },
  { type: "boo", glyph: "👎", label: "Boo" },
];

const REACTION_GLYPHS = Object.fromEntries(
  REACTIONS.map((reaction) => [reaction.type, reaction.glyph]),
) as Record<ReactionType, string>;

export function reactionGlyph(type: ReactionType): string {
  return REACTION_GLYPHS[type] ?? "✨";
}
