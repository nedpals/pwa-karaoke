import type { ElementType } from "react";
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

export interface BaseInputProps extends VariantProps<typeof inputVariants> {
  className?: string;
}

export interface InputProps<T extends ElementType = "input"> extends BaseInputProps {
  as?: T;
}

export function Input<T extends ElementType = "input">({
  as,
  size,
  glass,
  className,
  ...rest
}: InputProps<T> & Omit<React.ComponentPropsWithRef<T>, keyof InputProps<T>>) {
  const Component = as || ("input" as ElementType);

  return (
    <Component
      className={cn(inputVariants({ size, glass }), className)}
      {...rest}
    />
  );
}