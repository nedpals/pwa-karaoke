import { cn } from "../../lib/utils";
import { Backdrop } from "./Backdrop";

export interface ControllerLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  backgroundImage?: string;
}

export function ControllerLayout({ children, backgroundImage, className, ...props }: ControllerLayoutProps) {
  return (
    <div className={cn("h-dvh w-full relative bg-ka-void overflow-hidden", className)} {...props}>
      <Backdrop name="remote" image={backgroundImage} />
      <div className="absolute inset-0 bg-ka-void/70" aria-hidden />
      <div className="relative z-10 flex flex-col h-full w-full min-h-0 overflow-x-hidden">{children}</div>
    </div>
  );
}
