import { useState, useRef, useEffect, useCallback } from "react";
import { QRCode } from "../../../components/atoms/QRCode";
import { Text } from "../../../components/atoms/Text";
import { useRoomContext } from "../../../providers/RoomProvider";
import { usePlayerState } from "../context";
import { cn } from "../../../lib/utils";

export function MiniQRWidget() {
  const { roomId, controllerCount } = useRoomContext();
  const { appState } = usePlayerState();

  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const controllerUrl = roomId
    ? `${window.location.origin}/controller?room=${encodeURIComponent(roomId)}`
    : "";

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!controllerUrl) return;

      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(controllerUrl);
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = controllerUrl;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy link:", err);
      }
    },
    [controllerUrl]
  );

  // Only show after the first controller is connected and full-screen prompt is gone
  if (
    !roomId ||
    controllerCount === 0 ||
    appState === "connected" ||
    appState === "awaiting-interaction" ||
    appState === "connecting"
  ) {
    return null;
  }

  const isPlaying = appState === "playing";

  return (
    <div
      ref={widgetRef}
      className={cn(
        "relative flex items-center justify-end gap-2.5 transition-opacity duration-300",
        isPlaying ? "opacity-60 hover:opacity-100 focus-within:opacity-100" : "opacity-100"
      )}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => {
        setIsOpen(false);
        setCopied(false);
      }}
    >
      {/* Minimal pop-out link pill to the left of the QR */}
      <div
        className={cn(
          "transition-all duration-200 ease-out transform origin-right",
          isOpen
            ? "opacity-100 translate-x-0 scale-100 pointer-events-auto"
            : "opacity-0 translate-x-3 scale-95 pointer-events-none"
        )}
      >
        <div className="bg-ka-void/90 backdrop-blur-sm border-2 border-ka-line p-2 bevel shadow-2xl flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 px-0.5">
            <Text font="display" size="xs" tone="dim" className="text-[11px] tracking-wider">
              Room:
            </Text>
            <Text font="mono" size="xs" weight="bold" tone="accent" className="text-[12px]">
              {roomId}
            </Text>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            title="Click to copy link"
            className="group/btn flex items-center gap-2 px-2 py-1 bg-ka-panel hover:bg-ka-raised border border-ka-line/60 hover:border-ka-line transition-colors cursor-pointer"
          >
            <Text
              font="mono"
              size="xs"
              tone="info"
              className="max-w-[190px] sm:max-w-[260px] truncate text-[11px] select-all group-hover/btn:underline"
            >
              {controllerUrl}
            </Text>
            <span
              className={cn(
                "text-[10px] font-display uppercase tracking-wider px-1.5 py-0.5 border transition-all shrink-0",
                copied
                  ? "bg-ka-amber text-ka-void border-ka-amber font-bold"
                  : "bg-ka-raised text-ka-dim border-ka-line/50 group-hover/btn:text-ka-ink group-hover/btn:border-ka-line"
              )}
            >
              {copied ? "Copied!" : "Copy"}
            </span>
          </button>
        </div>
      </div>

      {/* Mini QR badge */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="group flex flex-col items-center bg-ka-panel border-2 border-ka-line bevel p-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-ka-amber transition-transform active:scale-95 shrink-0"
        aria-label="Toggle controller link details"
        title={isOpen ? "Click to close link" : "Scan to connect controller"}
      >
        <div className="bg-white p-1 border border-ka-line bevel-in">
          <QRCode data={controllerUrl} size={72} />
        </div>
        <div className="w-full text-center mt-1 py-0.5 bg-ka-raised border border-ka-line">
          <Text
            font="display"
            size="xs"
            weight="bold"
            tone="accent"
            className="tracking-wider text-[10px] leading-tight block"
          >
            JOIN
          </Text>
        </div>
      </button>
    </div>
  );
}
