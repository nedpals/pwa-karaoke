import { cn } from "../../lib/utils";
import { BACKDROPS, type BackdropName } from "../../lib/backgrounds";

export interface BackdropProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: BackdropName;
  image?: string;
}

export function Backdrop({ name = "idle", image, className, ...props }: BackdropProps) {
  const src = image ?? BACKDROPS[name];

  return (
    <div className={cn("absolute inset-0 bg-ka-void overflow-hidden", className)} aria-hidden {...props}>
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30 saturate-50"
        style={{ backgroundImage: `url("${src}")` }}
      />
      <div className="absolute inset-0 bg-linear-to-b from-ka-void/80 via-ka-void/40 to-ka-void/90" />
    </div>
  );
}
