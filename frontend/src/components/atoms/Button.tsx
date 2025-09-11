import type { ElementType } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary: "border border-white/20 bg-gradient-to-b from-gray-500/80 to-black/80 text-white text-shadow-md text-shadow-black hover:not-disabled:from-gray-400/80 hover:not-disabled:to-black/90",
        secondary: "border border-white/20 bg-gradient-to-b from-gray-500/80 to-black/80 text-white text-shadow-md text-shadow-black hover:not-disabled:from-gray-400/80 hover:not-disabled:to-black/90",
        glass: "border border-white/80 bg-gradient-to-b from-gray-500/80 to-black/80 text-white text-shadow-md text-shadow-black",
        danger: "border border-white/20 bg-gradient-to-b from-red-600/80 to-red-800/80 text-white text-shadow-md text-shadow-black hover:not-disabled:from-red-500/80 hover:not-disabled:to-red-800/90",
      },
      size: {
        sm: "px-3 py-2 text-sm",
        md: "px-4 py-2 text-base",
        lg: "px-6 py-3 text-lg",
        xl: "px-8 py-4 text-xl",
      },
      active: {
        true: "bg-gradient-to-b from-blue-500/90 to-blue-700/90 border-blue-400/50 shadow-lg shadow-blue-500/20 hover:not-disabled:from-blue-400/90 hover:not-disabled:to-blue-600/90",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      active: false,
    },
  }
);

export type ButtonVariant = "primary" | "secondary" | "glass" | "danger";
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