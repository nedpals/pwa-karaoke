import { Button, type BaseButtonProps } from "../atoms/Button";
import { cn } from "../../lib/utils";

export interface TabButtonProps extends Omit<BaseButtonProps, "variant"> {
  active?: boolean;
  onClick?: () => void;
}

export function TabButton({ active = false, className, children, ...props }: TabButtonProps) {
  return (
    <Button
      variant="default"
      className={cn(
        "flex-1 min-w-0 px-2 truncate border-x-0 border-t-0 border-b-4",
        active
          ? "bg-ka-amber border-b-ka-amber text-ka-void"
          : "bg-ka-panel border-b-ka-line-dim text-ka-dim",
        className
      )}
      aria-selected={active}
      role="tab"
      {...props}
    >
      {children}
    </Button>
  );
}
