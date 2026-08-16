import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const progressVariants = cva("relative border-2 border-ka-line-dim bg-ka-void bevel-in flex-1 overflow-hidden", {
  variants: {
    size: {
      sm: "h-2",
      md: "h-4",
      lg: "h-6",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

const fillTones = {
  accent: "bg-ka-amber",
  ok: "bg-ka-green",
  danger: "bg-ka-red",
} as const;

export interface ProgressBarProps
  extends VariantProps<typeof progressVariants>,
    React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max: number;
  tone?: keyof typeof fillTones;
}

export function ProgressBar({ value, max, size, tone = "accent", className, ...props }: ProgressBarProps) {
  const percentage = max > 0 ? (value / max) * 100 : 0;

  return (
    <div
      className={cn(progressVariants({ size }), className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      {...props}
    >
      <div
        className={cn("h-full", fillTones[tone])}
        style={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }}
      />
    </div>
  );
}
