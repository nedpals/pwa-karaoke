import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const iconVariants = cva("", {
  variants: {
    size: {
      xs: "w-3 h-3",
      sm: "w-4 h-4",
      md: "w-5 h-5",
      lg: "w-6 h-6",
      xl: "w-8 h-8",
      "2xl": "w-10 h-10",
      "3xl": "w-12 h-12",
      "4xl": "w-16 h-16",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

export type IconSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";

export interface IconProps extends VariantProps<typeof iconVariants>, React.SVGProps<SVGSVGElement> {
  children: React.ReactNode;
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(
  ({ size, className, children, ...props }, ref) => {
    return (
      <svg
        ref={ref}
        className={cn(iconVariants({ size }), className)}
        fill="currentColor"
        role="img"
        {...props}
      >
        <title>Icon</title>
        {children}
      </svg>
    );
  }
);

Icon.displayName = "Icon";