import { useEffect, useState } from "react";
import { Text } from "../atoms/Text";
import { cn } from "../../lib/utils";
import { ratingFor } from "../../lib/scoring";
import { playLand, startRoll, stopRoll } from "../../lib/scoreSound";

// Applied inline rather than through the text-stencil utility, which
// tailwind-merge reads as a text colour and would drop the rating tone.
const STENCIL_SHADOW =
  "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 3px 0 rgb(0 0 0 / 0.6)";

// text-6xl is 3.75rem with a line height of 1
const RATING_SLOT = "h-[3.75rem]";

const ROLL_TICK_MIN_MS = 55;
const ROLL_TICK_MAX_MS = 320;
const LANDING_MS = 1500;
const QUICK_LANDING_MS = 600;

// Long enough to cover a score arriving late; it is cut short on the reveal
const ROLL_SECONDS = 6;
const MAX_SPREAD = 45;

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function randomBetween(low: number, high: number) {
  return low + Math.floor(Math.random() * (high - low + 1));
}

/**
 * Spins through digits while the room waits, then slows down and closes in on
 * the real score rather than jumping to it.
 */
function useScoreReveal(target: number | null, landingMs: number) {
  const [value, setValue] = useState(0);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target ?? 0);
      setSettled(target !== null);
      return;
    }

    setSettled(false);

    let frame = 0;
    let lastTick = 0;
    let landingStart: number | null = null;

    const step = (now: number) => {
      if (target !== null && landingStart === null) {
        landingStart = now;
      }

      const progress = landingStart === null ? 0 : Math.min((now - landingStart) / landingMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      if (target !== null && progress >= 1) {
        setValue(target);
        setSettled(true);
        return;
      }

      if (now - lastTick >= ROLL_TICK_MIN_MS + (ROLL_TICK_MAX_MS - ROLL_TICK_MIN_MS) * eased) {
        lastTick = now;

        if (target === null) {
          setValue(randomBetween(0, 99));
        } else {
          const spread = Math.round((1 - eased) * MAX_SPREAD);
          setValue(randomBetween(Math.max(0, target - spread), Math.min(100, target + spread)));
        }
      }

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, landingMs]);

  return { value, settled };
}

export interface ScoreScreenProps {
  /** Null while the room is still waiting for a score to land. */
  score: number | null;
  /** Lands sooner, for a score nobody stayed for. */
  quick?: boolean;
  /** Off by default so nothing outside the display makes noise. */
  sound?: boolean;
  className?: string;
}

export function ScoreScreen({ score, quick = false, sound = false, className }: ScoreScreenProps) {
  const { value, settled } = useScoreReveal(score, quick ? QUICK_LANDING_MS : LANDING_MS);
  const rating = score === null ? null : ratingFor(score);
  const revealed = settled && rating !== null;

  useEffect(() => {
    if (!sound) return;

    startRoll(ROLL_SECONDS);
    return stopRoll;
  }, [sound]);

  useEffect(() => {
    if (!sound || !revealed || score === null) return;

    stopRoll();
    playLand(score);
  }, [sound, revealed, score]);

  return (
    <div className={cn("score-pop flex flex-col items-center gap-[2vh]", className)}>
      <Text font="display" size="3xl" tone="dim" style={{ textShadow: STENCIL_SHADOW }}>
        Your Score
      </Text>

      <Text
        font="mono"
        weight="bold"
        tone={revealed ? rating.tone : "dim"}
        className={cn("leading-none", settled && "score-land")}
        style={{ fontSize: "34vh", textShadow: STENCIL_SHADOW }}
      >
        {value.toString().padStart(2, "0")}
      </Text>

      {/* A slot the height of one 6xl line, held whatever the rating says, so
          the digits above it never move. */}
      <div className={cn("flex items-center justify-center", RATING_SLOT)}>
        <Text
          font="display"
          size="6xl"
          weight="bold"
          tone={rating?.tone ?? "dim"}
          className={cn("text-center max-w-[85vw]", !revealed && "opacity-0")}
          style={{ textShadow: STENCIL_SHADOW }}
        >
          {rating?.label ?? "\u00A0"}
        </Text>
      </div>
    </div>
  );
}
