import type { TextTone } from "../components/atoms/Text";

const SCORE_FLOOR = 60;
const SCORE_CEILING = 100;

// Shared with the rolled scores so a room cannot tell the two paths apart
const MIC_BAND_BOTTOM = 82;
const MIC_JITTER = 2;

function clamp(score: number): number {
  return Math.min(Math.max(Math.round(score), SCORE_FLOOR), SCORE_CEILING);
}

function between(low: number, high: number): number {
  return low + Math.floor(Math.random() * (high - low + 1));
}

export function scoreFromPerformance(performance: number): number {
  const bounded = Math.min(Math.max(performance, 0), 1);
  const scored = MIC_BAND_BOTTOM + bounded * (SCORE_CEILING - MIC_BAND_BOTTOM);

  return clamp(scored + (Math.random() * 2 - 1) * MIC_JITTER);
}

export function rollScore(): number {
  const draw = Math.random();
  if (draw < 0.7) return between(88, SCORE_CEILING);
  if (draw < 0.92) return between(75, 87);

  return between(SCORE_FLOOR, 74);
}

export interface ScoreRating {
  label: string;
  tone: TextTone;
}

const RATINGS: { min: number; label: string; tone: TextTone }[] = [
  { min: 100, label: "Perfect!", tone: "accent" },
  { min: 95, label: "Superstar!", tone: "accent" },
  { min: 90, label: "Excellent!", tone: "ok" },
  { min: 85, label: "Very Good!", tone: "ok" },
  { min: 75, label: "Not Bad!", tone: "info" },
  { min: 65, label: "Keep Practicing!", tone: "dim" },
];

const LOWEST: ScoreRating = { label: "Better Luck Next Time!", tone: "danger" };

export function ratingFor(score: number): ScoreRating {
  const rating = RATINGS.find((candidate) => score >= candidate.min);
  return rating ? { label: rating.label, tone: rating.tone } : LOWEST;
}
