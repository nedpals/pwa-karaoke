import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const panelVariants = cva("border-2", {
  variants: {
    tone: {
      default: "bg-ka-panel border-ka-line text-ka-ink bevel",
      raised: "bg-ka-raised border-ka-line text-ka-ink bevel",
      sunken: "bg-ka-void border-ka-line-dim text-ka-ink bevel-in",
      accent: "bg-ka-amber border-ka-amber text-ka-void",
      overlay: "bg-ka-void/85 border-ka-ink text-ka-ink",
    },
  },
  defaultVariants: {
    tone: "default",
  },
});

export type PanelTone = NonNullable<VariantProps<typeof panelVariants>["tone"]>;

export interface PanelProps
  extends VariantProps<typeof panelVariants>,
    React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Panel({ tone, className, children, ...props }: PanelProps) {
  return (
    <div className={cn(panelVariants({ tone }), className)} {...props}>
      {children}
    </div>
  );
}
