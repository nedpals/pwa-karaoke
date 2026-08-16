import { useState } from "react";
import { useNavigate } from "react-router";
import { useDebounce } from "use-debounce";
import { Backdrop } from "../components/templates/Backdrop";
import { Panel } from "../components/atoms/Panel";
import { Text } from "../components/atoms/Text";
import { Button } from "../components/atoms/Button";
import { Input } from "../components/atoms/Input";
import { ToggleButtonGroup } from "../components/molecules/ToggleButtonGroup";
import { Dialog } from "../components/organisms/Dialog";
import { LiveRoomsTicker } from "../components/organisms/LiveRoomsTicker";
import {
  useCreateRoomMutation,
  useRoomDetails,
  useRooms,
  useVerifyRoomMutation,
} from "../hooks/useApi";
import { useIsCompact } from "../hooks/useIsCompact";
import { storeRoomPassword } from "../lib/roomStorage";
import { cn, generateRoomId } from "../lib/utils";

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
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { rooms } = useRooms();
  const { data: roomDetails, isLoading: isCheckingRoom } = useRoomDetails(debouncedRoomId || null);
  const { trigger: createRoom } = useCreateRoomMutation();
  const { trigger: verifyRoom } = useVerifyRoomMutation();

  const settled = roomId.trim() === debouncedRoomId && !isCheckingRoom;
  const exists = settled && Boolean(roomDetails);
  const needsPassword = exists && Boolean(roomDetails?.requires_password);
  const liveRoom = rooms.find((room) => room.id === debouncedRoomId);

  const status = () => {
    if (!roomId.trim()) return { tone: "dim" as const, dot: "bg-ka-line", text: "Type a room name." };
    if (!settled) return { tone: "dim" as const, dot: "bg-ka-line", text: "Checking..." };
    if (exists) {
      const singers = liveRoom
        ? `${liveRoom.client_count} ${liveRoom.client_count === 1 ? "singer" : "singers"} here`
        : "Nobody connected yet";
      return { tone: "ok" as const, dot: "bg-ka-green", text: `Room exists. ${singers}.` };
    }
    return { tone: "accent" as const, dot: "bg-ka-amber", text: "New room. It gets created when you enter." };
  };

  const state = status();

  const enter = async (role: Role) => {
    const id = roomId.trim();
    if (busy || (needsPassword && !password.trim())) return;

    setBusy(role);
    setError(null);

    try {
      if (exists) {
        await verifyRoom({ room_id: id, password });
      } else {
        await createRoom({ room_id: id, is_public: isPublic, password });
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

      <div className="relative z-10 h-full flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center title-safe">
          <div className="w-full max-w-2xl space-y-4">
            <Text
              font="display"
              weight="bold"
              stencil
              className="text-5xl sm:text-7xl text-center"
            >
              PWA Karaoke
            </Text>

            <div className="space-y-1">
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

              <div className="flex items-center gap-2 px-1">
                <span className={cn("w-2 h-2 shrink-0", state.dot)} />
                <Text size="sm" tone={state.tone}>
                  {state.text}
                </Text>
              </div>
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

            {rooms.length > 0 && (
              <div className="space-y-1 pt-2">
                <FieldLabel>Live rooms</FieldLabel>
                <div className="flex flex-col gap-1">
                  {rooms.map((room) => {
                    const selected = room.id === debouncedRoomId;

                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => setRoomId(room.id)}
                        className={cn(
                          "flex items-stretch border-2 text-left active:translate-y-px",
                          selected
                            ? "bg-ka-amber border-ka-amber text-ka-void"
                            : "bg-ka-panel border-ka-line text-ka-ink bevel hover:bg-ka-raised",
                        )}
                      >
                        <div className="flex-1 min-w-0 px-3 py-2">
                          <Text font="mono" weight="bold" truncate tone={selected ? "inverse" : "default"}>
                            {room.name}
                          </Text>
                          {room.current_song && (
                            <Text size="sm" truncate tone={selected ? "inverse" : "dim"}>
                              {room.current_song}
                            </Text>
                          )}
                        </div>
                        <div className="flex items-center px-3 border-l-2 border-ka-line-dim">
                          <Text font="mono" size="sm" tone={selected ? "inverse" : "accent"}>
                            {room.client_count.toString().padStart(2, "0")}
                          </Text>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <LiveRoomsTicker rooms={rooms} />
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
            <Button variant="default" size="lg" onClick={closeDialog} disabled={Boolean(busy)} className="flex-1">
              Cancel
            </Button>

            {/* A phone is never the screen, so this option is not offered there. */}
            {!isCompact && (
              <Button
                variant="accent"
                size="lg"
                onClick={() => enter("player")}
                disabled={Boolean(busy) || (needsPassword && !password.trim())}
                className="flex-[2]"
              >
                {busy === "player" ? "Entering" : "Enter as Display"}
              </Button>
            )}

            <Button
              variant={isCompact ? "accent" : "default"}
              size="lg"
              onClick={() => enter("controller")}
              disabled={Boolean(busy) || (needsPassword && !password.trim())}
              className="flex-[2]"
            >
              {busy === "controller" ? "Entering" : "Enter as Controller"}
            </Button>
          </>
        }
      >
        {!exists && (
          <div className="space-y-3">
            <div className="space-y-1">
              <FieldLabel>Visibility</FieldLabel>
              <ToggleButtonGroup
                value={isPublic ? "public" : "private"}
                onChange={(value) => setIsPublic(value === "public")}
                options={[
                  { value: "public", label: "Public" },
                  { value: "private", label: "Private" },
                ]}
              />
            </div>
            <div className="space-y-1">
              <FieldLabel>Set a password</FieldLabel>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank for none"
              />
            </div>
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
