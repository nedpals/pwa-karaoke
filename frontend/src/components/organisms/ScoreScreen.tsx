import { useEffect, useState } from "react";
import { Panel } from "../atoms/Panel";
import { Text } from "../atoms/Text";
import { cn } from "../../lib/utils";
import { ratingFor } from "../../lib/scoring";

// Applied inline rather than through the text-hard and text-stencil utilities,
// which tailwind-merge reads as text colours and would drop the rating tone.
const HARD_SHADOW = "2px 2px 0 rgb(0 0 0 / 0.85)";
const STENCIL_SHADOW =
  "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 3px 0 rgb(0 0 0 / 0.6)";

const ROLL_TICK_MIN_MS = 55;
const ROLL_TICK_MAX_MS = 320;
const LANDING_MS = 1500;
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
function useScoreReveal(target: number | null) {
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

      const progress = landingStart === null ? 0 : Math.min((now - landingStart) / LANDING_MS, 1);
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
  }, [target]);

  return { value, settled };
}

export interface ScoreScreenProps {
  /** Null while the room is still waiting for a score to land. */
  score: number | null;
  title?: string;
  className?: string;
}

export function ScoreScreen({ score, title, className }: ScoreScreenProps) {
  const { value, settled } = useScoreReveal(score);
  const rating = settled && score !== null ? ratingFor(score) : null;

  return (
    <Panel
      tone="overlay"
      className={cn(
        "score-pop px-[6vw] py-[5vh] min-w-[50vw] flex flex-col items-center gap-[2vh]",
        className,
      )}
    >
      <Text font="display" size="3xl" tone="dim">
        Your Score
      </Text>

      {title && (
        <Text size="lg" truncate className="max-w-[60vw] text-center">
          {title}
        </Text>
      )}

      <Text
        font="mono"
        weight="bold"
        tone={rating?.tone ?? "dim"}
        className={cn("leading-none", settled && "score-land")}
        style={{ fontSize: "26vh", textShadow: HARD_SHADOW }}
      >
        {value.toString().padStart(2, "0")}
      </Text>

      {rating ? (
        <Text
          font="display"
          size="5xl"
          weight="bold"
          tone={rating.tone}
          style={{ textShadow: STENCIL_SHADOW }}
        >
          {rating.label}
        </Text>
      ) : (
        <Text font="display" size="3xl" tone="dim">
          Scoring
        </Text>
      )}
    </Panel>
  );
}
