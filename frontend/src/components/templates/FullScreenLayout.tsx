import { cn } from "../../lib/utils";
import { Backdrop } from "./Backdrop";
import type { BackdropName } from "../../lib/backgrounds";

export interface FullScreenLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  background?: "black" | "image";
  backdrop?: BackdropName;
  backgroundImage?: string;
}

export function FullScreenLayout({
  children,
  background = "black",
  backdrop = "idle",
  backgroundImage,
  className,
  ...props
}: FullScreenLayoutProps) {
  return (
    <div className={cn("h-screen w-screen relative bg-ka-void overflow-hidden", className)} {...props}>
      {background === "image" && <Backdrop name={backdrop} image={backgroundImage} />}
      <div className="relative z-10 h-full w-full">{children}</div>
    </div>
  );
}
