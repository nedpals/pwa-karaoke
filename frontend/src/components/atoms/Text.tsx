import type { ElementType } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const textVariants = cva("", {
  variants: {
    variant: {
      heading: "font-bold",
      body: "",
      caption: "opacity-70",
      display: "font-bold",
    },
    size: {
      xs: "text-xs",
      sm: "text-sm",
      base: "text-base",
      lg: "text-lg",
      xl: "text-xl",
      "2xl": "text-2xl",
      "3xl": "text-3xl",
      "4xl": "text-4xl",
      "5xl": "text-5xl",
      "6xl": "text-6xl",
      "7xl": "text-7xl",
      "8xl": "text-8xl",
      "9xl": "text-9xl",
    },
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
    shadow: {
      true: "text-shadow-md text-shadow-black",
      false: "",
    },
    truncate: {
      true: "truncate",
      false: "",
    },
  },
  defaultVariants: {
    variant: "body",
    size: "base",
    weight: "normal",
    shadow: false,
    truncate: false,
  },
});

export type TextVariant = "heading" | "body" | "caption" | "display";
export type TextSize = "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl" | "8xl" | "9xl";
export type TextWeight = "normal" | "medium" | "semibold" | "bold";

export interface BaseTextProps extends VariantProps<typeof textVariants> {
  children: React.ReactNode;
  className?: string;
}

export interface TextProps<T extends ElementType = "p"> extends BaseTextProps {
  as?: T;
}

export function Text<T extends ElementType = "p">({
  as,
  variant,
  size,
  weight,
  shadow,
  truncate,
  className,
  children,
  ...rest
}: TextProps<T> & Omit<React.ComponentPropsWithRef<T>, keyof TextProps<T>>) {
  const Component = as || ("p" as ElementType);

  return (
    <Component
      className={cn(textVariants({ variant, size, weight, shadow, truncate }), className)}
      {...rest}
    >
      {children}
    </Component>
  );
}