import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary: "border border-white/20 bg-gradient-to-b from-gray-500/80 to-black/80 text-white text-shadow-md text-shadow-black hover:from-gray-400/80 hover:to-black/90",
        secondary: "border border-white/20 bg-gradient-to-b from-gray-500/80 to-black/80 text-white text-shadow-md text-shadow-black hover:from-gray-400/80 hover:to-black/90", 
        glass: "border border-white/80 bg-gradient-to-b from-gray-500/80 to-black/80 text-white text-shadow-md text-shadow-black",
        danger: "border border-white/20 bg-gradient-to-b from-red-600/80 to-red-800/80 text-white text-shadow-md text-shadow-black hover:from-red-500/80 hover:to-red-800/90",
      },
      size: {
        sm: "px-3 py-2 text-sm",
        md: "px-4 py-2 text-base",
        lg: "px-6 py-3 text-lg",
        xl: "px-8 py-4 text-xl",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export type ButtonVariant = "primary" | "secondary" | "glass" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

export interface BaseButtonProps extends VariantProps<typeof buttonVariants> {
  children: React.ReactNode;
  className?: string;
}

export interface ButtonProps extends BaseButtonProps, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseButtonProps> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, className, children, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...rest}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";