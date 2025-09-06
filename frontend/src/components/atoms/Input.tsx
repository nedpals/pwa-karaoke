import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const inputVariants = cva(
  "w-full rounded-lg border focus:outline-none transition-colors",
  {
    variants: {
      size: {
        sm: "px-3 py-2 text-sm",
        md: "px-4 py-3 text-base",
        lg: "px-4 py-4 text-2xl",
      },
      glass: {
        true: "bg-black/40 text-white placeholder-white/70 border-white/20 focus:border-white/60 text-shadow-sm text-shadow-black shadow-lg",
        false: "bg-white text-black placeholder-gray-400 border-gray-300 focus:border-blue-500",
      },
    },
    defaultVariants: {
      size: "md",
      glass: false,
    },
  }
);

export type InputSize = "sm" | "md" | "lg";

export interface InputProps extends VariantProps<typeof inputVariants>, Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ size, glass, className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(inputVariants({ size, glass }), className)}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";