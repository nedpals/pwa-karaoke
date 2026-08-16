import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
import { Panel } from "../atoms/Panel";
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

export interface CardProps
  extends VariantProps<typeof cardVariants>,
    Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  children?: React.ReactNode;
  headerActions?: React.ReactNode;
}

export function Card({ title, children, headerActions, size, className, ...props }: CardProps) {
  return (
    <Panel className={cn(cardVariants({ size }), className)} {...props}>
      {title && (
        <header className="w-full py-1.5 px-4 bg-ka-raised border-b-2 border-ka-line flex flex-row items-center gap-3">
          <Text font="display" size="xl" weight="bold" tone="accent" className="flex-1">
            {title}
          </Text>
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </header>
      )}
      {children && <div className="flex-1 px-6 py-5 flex items-center justify-center">{children}</div>}
    </Panel>
  );
}
