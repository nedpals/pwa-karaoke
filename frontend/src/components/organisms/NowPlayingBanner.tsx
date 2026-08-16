import { cn } from "../../lib/utils";
import { Text } from "../atoms/Text";
import { MarqueeText } from "../molecules/MarqueeText";

export type BannerTone = "playing" | "paused" | "next" | "queued";

const toneStyles: Record<BannerTone, string> = {
  playing: "bg-ka-amber text-ka-void",
  paused: "bg-ka-dim text-ka-void",
  next: "bg-ka-cyan text-ka-void",
  queued: "bg-ka-green text-ka-void",
};

export interface NowPlayingBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  status: string;
  tone?: BannerTone;
  title: string;
  songNumber?: string;
  /** Songs waiting behind this one. */
  reservedCount?: number;
}

/** Also serves as the up-next announcement before the current song ends. */
export function NowPlayingBanner({
  status,
  tone = "playing",
  title,
  songNumber,
  reservedCount,
  className,
  ...props
}: NowPlayingBannerProps) {
  return (
    <div
      className={cn(
        "flex items-stretch w-full border-y-2 border-ka-ink bg-ka-void/85 text-ka-ink",
        className
      )}
      {...props}
    >
      <div className={cn("flex items-center px-4 py-1.5 shrink-0", toneStyles[tone])}>
        <Text font="display" size="2xl" weight="bold">
          {status}
        </Text>
      </div>

      {songNumber && (
        <div className="hidden sm:flex items-center px-4 border-r-2 border-ka-line">
          <Text font="mono" size="2xl" weight="bold" tone="accent">
            {songNumber}
          </Text>
        </div>
      )}

      <div className="flex-1 min-w-0 flex items-center px-4">
        <MarqueeText size="2xl" weight="bold" speed="slow">
          {title}
        </MarqueeText>
      </div>

      {reservedCount !== undefined && (
        <div className="flex items-center gap-3 px-4 border-l-2 border-ka-line shrink-0">
          <Text font="display" size="lg" tone="dim" className="hidden sm:block">
            Reserved
          </Text>
          <Text font="mono" size="2xl" weight="bold" tone="accent">
            {reservedCount.toString().padStart(2, "0")}
          </Text>
        </div>
      )}
    </div>
  );
}
