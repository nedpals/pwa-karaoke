import { Button, type BaseButtonProps } from "../atoms/Button";
import { cn } from "../../lib/utils";

export interface IconButtonProps
  extends Omit<BaseButtonProps, "children">,
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseButtonProps | "children"> {
  icon: React.ReactNode;
  label?: string;
  showLabel?: boolean;
}

export function IconButton({ icon, label, showLabel = false, className, variant, size, ...props }: IconButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      aria-label={label}
      title={label}
      className={cn("flex flex-col items-center justify-center leading-none", className)}
      {...props}
    >
      {icon}
      {showLabel && label && <span className="mt-1 text-[0.6em] tracking-widest">{label}</span>}
    </Button>
  );
}
