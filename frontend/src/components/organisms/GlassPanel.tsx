import { forwardRef } from "react";

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: "default" | "header" | "message";
}

const variantStyles = {
  default: "border border-white/80 rounded-lg bg-gradient-to-b from-gray-500/80 to-black/80 text-white",
  header: "rounded-4xl border border-white/10 bg-gradient-to-b from-white/70 to-black/70 text-white",
  message: "border border-white/80 rounded-lg bg-gradient-to-b from-gray-500/80 to-black/80 text-white",
};

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ variant = "default", className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`${variantStyles[variant]} ${className}`.trim()}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassPanel.displayName = "GlassPanel";