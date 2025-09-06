import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
import { GlassPanel } from "./GlassPanel";
import { Text } from "../atoms/Text";

const cardVariants = cva("flex flex-col", {
  variants: {
    size: {
      sm: "h-32",
      md: "h-48",
      lg: "h-64",
      auto: "h-auto",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

export interface CardProps extends VariantProps<typeof cardVariants>, React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  children?: React.ReactNode;
  headerActions?: React.ReactNode;
}

export function Card({ title, children, headerActions, size, className, ...props }: CardProps) {
  return (
    <GlassPanel
      className={cn(cardVariants({ size }), className)}
      {...props}
    >
      {title && (
        <header className="w-full py-2 px-4 border-b border-white/40 flex flex-row justify-center text-center">
          <Text size="xl" shadow className="flex-1">
            {title}
          </Text>
          {headerActions && (
            <div className="flex items-center space-x-2">
              {headerActions}
            </div>
          )}
        </header>
      )}
      {children && (
        <div className="flex-1 px-4 py-2 flex items-center justify-center text-center">
          {children}
        </div>
      )}
    </GlassPanel>
  );
}