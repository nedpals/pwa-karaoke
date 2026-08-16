import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
import { Panel } from "../atoms/Panel";
import { Text } from "../atoms/Text";

const osdVariants = cva("absolute z-30", {
  variants: {
    position: {
      "top-left": "top-[5vh] left-[5vw]",
      "top-right": "top-[5vh] right-[5vw]",
      center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
      "bottom-left": "bottom-[5vh] left-[5vw]",
      "bottom-right": "bottom-[5vh] right-[5vw]",
    },
  },
  defaultVariants: {
    position: "top-left",
  },
});

const bodyVariants = cva("flex items-center", {
  variants: {
    size: {
      sm: "min-w-36 px-3 py-1.5 gap-3",
      md: "min-w-52 px-4 py-2 gap-4",
      lg: "min-w-72 px-6 py-3 gap-6",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

const labelSize = { sm: "base", md: "xl", lg: "3xl" } as const;
const barHeight = { sm: "h-2", md: "h-3", lg: "h-4" } as const;

export interface OSDProps
  extends VariantProps<typeof osdVariants>,
    VariantProps<typeof bodyVariants>,
    React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Readout printed after the bar, e.g. a volume percentage. */
  value?: string;
  /** 0..1. Draws a segmented bar between the label and the value. */
  meter?: number;
  /** Width of the box when it carries a meter. */
  meterWidth?: string;
  visible?: boolean;
}

const METER_SEGMENTS = 20;

export function OSD({
  children,
  value,
  meter,
  meterWidth = "w-[70vw] max-w-5xl",
  visible = true,
  size = "md",
  position,
  className,
  ...props
}: OSDProps) {
  if (!visible) return null;

  const hasMeter = meter !== undefined;
  const filled = hasMeter ? Math.round(Math.min(Math.max(meter, 0), 1) * METER_SEGMENTS) : 0;

  return (
    <div className={cn(osdVariants({ position }), className)} {...props}>
      <Panel tone="overlay" className={cn(bodyVariants({ size }), hasMeter && meterWidth)}>
        <Text font="display" size={labelSize[size ?? "md"]} weight="bold">
          {children}
        </Text>

        {hasMeter && (
          <div className={cn("flex gap-1 flex-1", barHeight[size ?? "md"])} aria-hidden>
            {Array.from({ length: METER_SEGMENTS }, (_, i) => (
              <span key={i} className={cn("flex-1", i < filled ? "bg-ka-amber" : "bg-ka-line-dim")} />
            ))}
          </div>
        )}

        {value && (
          <Text font="mono" size={labelSize[size ?? "md"]} weight="bold" tone="accent">
            {value}
          </Text>
        )}
      </Panel>
    </div>
  );
}
