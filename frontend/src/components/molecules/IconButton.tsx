import { Button, type BaseButtonProps } from "../atoms/Button";
import { cn } from "../../lib/utils";

export interface IconButtonProps extends Omit<BaseButtonProps, "children">, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseButtonProps | "children"> {
  icon: React.ReactNode;
  label?: string;
  showLabel?: boolean;
}

export function IconButton({ icon, label, showLabel = false, className, variant, size, ...props }: IconButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        "flex items-center justify-center",
        showLabel && "space-x-2",
        className
      )}
      {...props}
    >
      {icon}
      {showLabel && label && <span>{label}</span>}
    </Button>
  );
}