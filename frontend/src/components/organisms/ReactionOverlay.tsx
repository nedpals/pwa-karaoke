import { useEffect, useRef, useState } from "react";
import { reactionGlyph } from "../../lib/reactions";
import { cn } from "../../lib/utils";
import type { ReactionEvent } from "../../types";

const PARTICLE_LIFETIME_MS = 4000;
const MAX_PARTICLES = 40;
// Matches the point where kaReactionFloat starts fading a particle out
const FADE_TAIL_MS = PARTICLE_LIFETIME_MS * 0.3;

interface Particle {
  key: string;
  glyph: string;
  left: number;
  drift: number;
  rise: number;
  spin: number;
  size: number;
  expiresAt: number;
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function createParticle(event: ReactionEvent, sequence: number): Particle {
  return {
    key: `${event.id}-${sequence}`,
    glyph: reactionGlyph(event.reaction),
    left: randomBetween(8, 92),
    drift: randomBetween(-12, 12),
    rise: randomBetween(45, 72),
    spin: randomBetween(-25, 25),
    size: randomBetween(5, 9),
    expiresAt: Date.now() + PARTICLE_LIFETIME_MS,
  };
}

export interface ReactionOverlayProps {
  event: ReactionEvent | null;
  className?: string;
}

export function ReactionOverlay({ event, className }: ReactionOverlayProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const lastEventId = useRef<string | null>(null);
  const sequence = useRef(0);

  useEffect(() => {
    if (!event || event.id === lastEventId.current) return;

    lastEventId.current = event.id;
    sequence.current += 1;

    const particle = createParticle(event, sequence.current);

    setParticles((prev) => {
      const now = Date.now();
      const alive = prev.filter((p) => p.expiresAt > now);

      if (alive.length < MAX_PARTICLES) {
        return [...alive, particle];
      }

      // At the cap, only retire a particle that is already fading out, so
      // nothing ever disappears mid flight. If none is, drop the new one.
      const retiring = alive.findIndex((p) => p.expiresAt - now < FADE_TAIL_MS);
      if (retiring === -1) {
        return alive;
      }

      return [...alive.slice(0, retiring), ...alive.slice(retiring + 1), particle];
    });
  }, [event]);

  const removeParticle = (key: string) => {
    setParticles((prev) => prev.filter((p) => p.key !== key));
  };

  if (particles.length === 0) return null;

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden
    >
      {particles.map((particle) => (
        <span
          key={particle.key}
          className="reaction-float absolute bottom-[6vh] leading-none select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
          style={
            {
              left: `${particle.left}%`,
              fontSize: `${particle.size}vh`,
              "--ka-reaction-drift": `${particle.drift}vw`,
              "--ka-reaction-rise": `${particle.rise}vh`,
              "--ka-reaction-spin": `${particle.spin}deg`,
            } as React.CSSProperties
          }
          onAnimationEnd={() => removeParticle(particle.key)}
        >
          {particle.glyph}
        </span>
      ))}
    </div>
  );
}
