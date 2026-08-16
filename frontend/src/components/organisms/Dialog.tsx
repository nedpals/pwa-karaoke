import { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";
import { Card } from "./Card";

export interface DialogProps {
  open: boolean;
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/** Native <dialog>, so focus trapping and Escape come from the platform. */
export function Dialog({ open, title, onClose, children, footer, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className={cn(
        "m-auto bg-transparent p-0 text-ka-ink w-[92vw] max-w-2xl",
        "backdrop:bg-ka-void/85",
        className,
      )}
    >
      <Card title={title} size="auto">
        <div className="w-full space-y-4">
          {children}
          {footer && <div className="flex gap-2 pt-1">{footer}</div>}
        </div>
      </Card>
    </dialog>
  );
}
