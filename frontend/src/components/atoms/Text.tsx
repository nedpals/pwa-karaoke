import type { ElementType } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const textVariants = cva("", {
  variants: {
    font: {
      body: "font-body",
      display: "font-display uppercase tracking-wide",
      mono: "font-mono tabular-nums",
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
    tone: {
      default: "",
      dim: "text-ka-dim",
      accent: "text-ka-amber",
      danger: "text-ka-red",
      ok: "text-ka-green",
      info: "text-ka-cyan",
      inverse: "text-ka-void",
    },
    shadow: {
      true: "text-hard",
      false: "",
    },
    stencil: {
      true: "text-stencil",
      false: "",
    },
    truncate: {
      true: "truncate",
      false: "",
    },
  },
  defaultVariants: {
    font: "body",
    size: "base",
    weight: "normal",
    tone: "default",
    shadow: false,
    stencil: false,
    truncate: false,
  },
});

export type TextFont = "body" | "display" | "mono";
export type TextSize = "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl" | "8xl" | "9xl";
export type TextWeight = "normal" | "medium" | "semibold" | "bold";
export type TextTone = "default" | "dim" | "accent" | "danger" | "ok" | "info" | "inverse";

export interface BaseTextProps extends VariantProps<typeof textVariants> {
  children: React.ReactNode;
  className?: string;
}

export interface TextProps<T extends ElementType = "p"> extends BaseTextProps {
  as?: T;
}

export function Text<T extends ElementType = "p">({
  as,
  font,
  size,
  weight,
  tone,
  shadow,
  stencil,
  truncate,
  className,
  children,
  ...rest
}: TextProps<T> & Omit<React.ComponentPropsWithRef<T>, keyof TextProps<T>>) {
  const Component = as || ("p" as ElementType);

  return (
    <Component
      className={cn(textVariants({ font, size, weight, tone, shadow, stencil, truncate }), className)}
      {...rest}
    >
      {children}
    </Component>
  );
}
