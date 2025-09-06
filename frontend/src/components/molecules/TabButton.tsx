import { Button, type BaseButtonProps } from "../atoms/Button";
import { cn } from "../../lib/utils";

export interface TabButtonProps extends Omit<BaseButtonProps, "variant"> {
  active?: boolean;
  onClick?: () => void;
}

export function TabButton({ active = false, className, children, ...props }: TabButtonProps) {
  return (
    <Button
      variant="glass"
      className={cn(
        "flex-1 rounded-none border-b-2",
        active
          ? "border-white bg-gradient-to-b from-gray-500/80 to-black/80"
          : "border-transparent bg-gradient-to-b from-gray-500/60 to-black/60 hover:from-gray-400/70 hover:to-black/70",
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
}