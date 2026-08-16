import type { ElementType } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "border-2 font-display uppercase tracking-wide select-none disabled:opacity-45 disabled:saturate-0 disabled:cursor-not-allowed active:not-disabled:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "bg-ka-raised border-ka-line text-ka-ink bevel hover:not-disabled:bg-ka-line-dim active:not-disabled:bevel-in",
        accent:
          "bg-ka-amber border-ka-amber text-ka-void bevel hover:not-disabled:bg-ka-ink hover:not-disabled:border-ka-ink active:not-disabled:bevel-in",
        danger:
          "bg-ka-red border-ka-red text-ka-ink bevel hover:not-disabled:brightness-115 active:not-disabled:bevel-in",
        ghost:
          "bg-transparent border-transparent text-ka-dim hover:not-disabled:text-ka-ink hover:not-disabled:border-ka-line-dim",
      },
      size: {
        sm: "px-2 py-1 text-sm",
        md: "px-4 py-2 text-base",
        lg: "px-6 py-2.5 text-xl",
        xl: "px-8 py-3.5 text-2xl",
      },
      active: {
        true: "bg-ka-amber border-ka-amber text-ka-void hover:not-disabled:bg-ka-amber",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      active: false,
    },
  }
);

export type ButtonVariant = "default" | "accent" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

export interface BaseButtonProps extends VariantProps<typeof buttonVariants> {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
}

export interface ButtonProps<T extends ElementType = "button"> extends BaseButtonProps {
  as?: T;
}

export function Button<T extends ElementType = "button">({
  as,
  variant,
  size,
  active,
  className,
  children,
  ...rest
}: ButtonProps<T> & Omit<React.ComponentPropsWithRef<T>, keyof ButtonProps<T>>) {
  const Component = as || ("button" as ElementType);

  return (
    <Component
      className={cn(buttonVariants({ variant, size, active }), className)}
      {...rest}
    >
      {children}
    </Component>
  );
}
