import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
import { GlassPanel } from "../organisms/GlassPanel";
import { Text } from "../atoms/Text";

const osdVariants = cva("flex items-center justify-center flex-col", {
  variants: {
    size: {
      sm: "h-16 w-32 px-8 py-1",
      md: "h-24 w-48 px-12 py-2", 
      lg: "h-32 w-64 px-16 py-3",
    },
    position: {
      "top-left": "absolute top-[10%] left-[6.5%] z-20",
      "top-right": "absolute top-[10%] right-[6.5%] z-20",
      "center": "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20",
      "bottom-left": "absolute bottom-[10%] left-[6.5%] z-20",
      "bottom-right": "absolute bottom-[10%] right-[6.5%] z-20",
    },
  },
  defaultVariants: {
    size: "md",
    position: "top-left",
  },
});

export interface OSDProps extends VariantProps<typeof osdVariants>, React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  icon?: React.ReactNode;
  visible?: boolean;
}

export const OSD = forwardRef<HTMLDivElement, OSDProps>(
  ({ children, icon, visible = true, size, position, className, ...props }, ref) => {
    if (!visible) return null;
    
    return (
      <div className={cn(osdVariants({ position }), className)} {...props}>
        <GlassPanel
          ref={ref}
          className={cn(osdVariants({ size }), "m-4")}
        >
          {icon && <div className="mb-1">{icon}</div>}
          <Text size="lg" shadow>
            {children}
          </Text>
        </GlassPanel>
      </div>
    );
  }
);

OSD.displayName = "OSD";