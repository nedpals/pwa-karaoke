import { cva, type VariantProps } from "class-variance-authority";
import { cn, songNumber } from "../../lib/utils";

const songNumberVariants = cva(
  "inline-flex items-center justify-center font-mono tabular-nums tracking-widest border-2 shrink-0",
  {
    variants: {
      tone: {
        default: "bg-ka-void border-ka-line-dim text-ka-amber bevel-in",
        accent: "bg-ka-amber border-ka-amber text-ka-void",
        plain: "bg-transparent border-transparent text-ka-amber",
      },
      size: {
        sm: "px-1.5 py-0.5 text-xs",
        md: "px-2 py-1 text-base",
        lg: "px-3 py-1.5 text-2xl",
        xl: "px-4 py-2 text-4xl",
      },
    },
    defaultVariants: {
      tone: "default",
      size: "md",
    },
  }
);

export interface SongNumberProps
  extends VariantProps<typeof songNumberVariants>,
    React.HTMLAttributes<HTMLSpanElement> {
  entryId: string;
}

export function SongNumber({ entryId, tone, size, className, ...props }: SongNumberProps) {
  return (
    <span className={cn(songNumberVariants({ tone, size }), className)} {...props}>
      {songNumber(entryId)}
    </span>
  );
}
