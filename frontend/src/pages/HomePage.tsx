import { useState } from "react";
import { useNavigate } from "react-router";
import { useDebounce } from "use-debounce";
import { Backdrop } from "../components/templates/Backdrop";
import { Panel } from "../components/atoms/Panel";
import { Text } from "../components/atoms/Text";
import { Button } from "../components/atoms/Button";
import { Input } from "../components/atoms/Input";
import { Dialog } from "../components/organisms/Dialog";
import { useCreateRoomMutation, useRoomDetails, useVerifyRoomMutation } from "../hooks/useApi";
import { useIsCompact } from "../hooks/useIsCompact";
import { storeRoomPassword } from "../lib/roomStorage";
import { generateRoomId } from "../lib/utils";

type Role = "player" | "controller";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text font="display" size="sm" tone="dim">
      {children}
    </Text>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const isCompact = useIsCompact();

  const [roomId, setRoomId] = useState(() => generateRoomId());
  const [debouncedRoomId] = useDebounce(roomId.trim(), 400);
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: roomDetails, isLoading: isCheckingRoom } = useRoomDetails(debouncedRoomId || null);
  const { trigger: createRoom } = useCreateRoomMutation();
  const { trigger: verifyRoom } = useVerifyRoomMutation();

  const settled = roomId.trim() === debouncedRoomId && !isCheckingRoom;
  const exists = settled && Boolean(roomDetails);
  const needsPassword = exists && Boolean(roomDetails?.requires_password);
  const cannotEnter = Boolean(busy) || (needsPassword && !password.trim());

  const enter = async (role: Role) => {
    const id = roomId.trim();
    if (cannotEnter) return;

    setBusy(role);
    setError(null);

    try {
      if (exists) {
        await verifyRoom({ room_id: id, password });
      } else {
        await createRoom({ room_id: id, password });
      }

      if (password) storeRoomPassword(id, password);
      navigate(`/${role}?${new URLSearchParams({ room: id }).toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that room.");
      setBusy(null);
    }
  };

  const closeDialog = () => {
    if (busy) return;
    setIsOpen(false);
    setError(null);
  };

  return (
    <div className="h-dvh w-full relative bg-ka-void overflow-hidden">
      <Backdrop name="lobby" />
      <div className="absolute inset-0 bg-ka-void/60" aria-hidden />

      <div className="relative z-10 h-full overflow-y-auto flex flex-col items-center justify-center title-safe">
        <div className="w-full max-w-2xl space-y-4">
          <Text font="display" weight="bold" stencil className="text-5xl sm:text-7xl text-center">
            PWA Karaoke
          </Text>

          <div className="flex items-stretch border-2 border-ka-line bg-ka-panel bevel">
            <div className="hidden sm:flex items-center px-3 border-r-2 border-ka-line bg-ka-raised">
              <Text font="display" size="lg" weight="bold" tone="accent">
                Room
              </Text>
            </div>
            <Input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onBlur={() => !roomId.trim() && setRoomId(generateRoomId())}
              onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && settled && setIsOpen(true)}
              font="mono"
              size={isCompact ? "md" : "lg"}
              className="border-0 bevel-in focus:border-0"
              aria-label="Room name"
            />
          </div>

          <Button
            variant="accent"
            size="xl"
            onClick={() => setIsOpen(true)}
            disabled={!roomId.trim() || !settled}
            className="w-full py-5"
          >
            Join Room
          </Button>
        </div>
      </div>

      <Dialog
        open={isOpen}
        onClose={closeDialog}
        title={
          <>
            {exists ? "Join" : "Create"}{" "}
            <span className="font-mono normal-case tracking-normal">{roomId.trim()}</span>
          </>
        }
        footer={
          <>
            {!isCompact && (
              <Button
                variant="accent"
                size="lg"
                onClick={() => enter("player")}
                disabled={cannotEnter}
                className="w-full"
              >
                {busy === "player" ? "Entering" : "Enter as Display"}
              </Button>
            )}

            <Button
              variant={isCompact ? "accent" : "default"}
              size="lg"
              onClick={() => enter("controller")}
              disabled={cannotEnter}
              className="w-full"
            >
              {busy === "controller" ? "Entering" : "Enter as Controller"}
            </Button>

            <Button
              variant="ghost"
              size="lg"
              onClick={closeDialog}
              disabled={Boolean(busy)}
              className="w-full"
            >
              Cancel
            </Button>
          </>
        }
      >
        {!exists && (
          <div className="space-y-1">
            <FieldLabel>Set a password</FieldLabel>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank for none"
            />
          </div>
        )}

        {needsPassword && (
          <div className="space-y-1">
            <FieldLabel>This room needs a password</FieldLabel>
            <Input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="Ask whoever started it"
              autoFocus
            />
          </div>
        )}

        {error && (
          <Panel tone="sunken" className="px-3 py-2">
            <Text size="sm" tone="danger">
              {error}
            </Text>
          </Panel>
        )}
      </Dialog>
    </div>
  );
}
