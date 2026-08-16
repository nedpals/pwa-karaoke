import type { TextTone } from "../components/atoms/Text";

export interface ScoreRating {
  label: string;
  tone: TextTone;
}

const RATINGS: { min: number; label: string; tone: TextTone }[] = [
  { min: 100, label: "Perfect", tone: "accent" },
  { min: 95, label: "Legendary", tone: "accent" },
  { min: 90, label: "Excellent", tone: "ok" },
  { min: 85, label: "Very Good", tone: "ok" },
  { min: 75, label: "Not Bad", tone: "info" },
  { min: 65, label: "Keep Practicing", tone: "dim" },
];

const LOWEST: ScoreRating = { label: "Try Again", tone: "danger" };

export function ratingFor(score: number): ScoreRating {
  const rating = RATINGS.find((candidate) => score >= candidate.min);
  return rating ? { label: rating.label, tone: rating.tone } : LOWEST;
}
