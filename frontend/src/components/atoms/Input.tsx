import type { ElementType } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const inputVariants = cva(
  "w-full border-2 bg-ka-void border-ka-line-dim text-ka-ink placeholder-ka-dim caret-ka-amber bevel-in focus:outline-none focus:border-ka-amber disabled:opacity-40 disabled:cursor-not-allowed",
  {
    variants: {
      size: {
        sm: "px-2 py-1.5 text-sm",
        md: "px-3 py-2.5 text-base",
        lg: "px-4 py-3.5 text-2xl",
      },
      font: {
        body: "font-body",
        mono: "font-mono tracking-widest",
      },
    },
    defaultVariants: {
      size: "md",
      font: "body",
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
  font,
  className,
  ...rest
}: InputProps<T> & Omit<React.ComponentPropsWithRef<T>, keyof InputProps<T>>) {
  const Component = as || ("input" as ElementType);

  return (
    <Component
      className={cn(inputVariants({ size, font }), className)}
      {...rest}
    />
  );
}
