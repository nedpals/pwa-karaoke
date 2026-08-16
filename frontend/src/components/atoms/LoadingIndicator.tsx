import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const cellVariants = cva("bg-ka-amber", {
  variants: {
    size: {
      sm: "h-2 w-2",
      md: "h-3 w-3",
      lg: "h-4 w-4",
      xl: "h-6 w-6",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

const gapBySize = {
  sm: "gap-1",
  md: "gap-1.5",
  lg: "gap-2",
  xl: "gap-2.5",
} as const;

export type LoadingSize = "sm" | "md" | "lg" | "xl";

export interface LoadingIndicatorProps
  extends VariantProps<typeof cellVariants>,
    React.HTMLAttributes<HTMLDivElement> {}

export function LoadingIndicator({ size = "md", className, ...props }: LoadingIndicatorProps) {
  return (
    <div
      className={cn("flex items-center", gapBySize[size ?? "md"], className)}
      role="status"
      aria-label="Loading"
      {...props}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={cellVariants({ size })}
          style={{
            animation: "kaMarch 0.9s steps(1, end) infinite",
            animationDelay: `${index * 0.3}s`,
          }}
        />
      ))}
    </div>
  );
}
