import { Link, useNavigate } from "react-router";
import { useState } from "react";
import { FullScreenLayout } from "../components/templates/FullScreenLayout";
import { Panel } from "../components/atoms/Panel";
import { Text } from "../components/atoms/Text";
import { Button } from "../components/atoms/Button";
import { Input } from "../components/atoms/Input";
import { LoadingIndicator } from "../components/atoms/LoadingIndicator";
import { useRooms, useRoomDetails, useVerifyRoomMutation } from "../hooks/useApi";
import { storeRoomPassword } from "../lib/roomStorage";
import { useDebounce } from "use-debounce";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Text font="display" size="sm" tone="dim">
        {label}
      </Text>
      {children}
    </div>
  );
}

export default function JoinPage() {
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [joiningAs, setJoiningAs] = useState<"player" | "controller" | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { rooms, isLoading, error } = useRooms();
  const [debouncedRoomId] = useDebounce(selectedRoomId, 500);
  const { data: roomDetails, isLoading: isRoomDetailsLoading } = useRoomDetails(debouncedRoomId || null);
  const { trigger: verifyRoom } = useVerifyRoomMutation();
  const hasValidRoom = typeof roomDetails !== "undefined" || (selectedRoomId.trim().length > 0 && !isRoomDetailsLoading);
  const isBusy = !hasValidRoom || isVerifying || selectedRoomId !== debouncedRoomId || isRoomDetailsLoading;

  const handleRoomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedRoomId(e.target.value);
  };

  const navigateToMode = async (mode: "player" | "controller") => {
    if (!hasValidRoom) return;
    setJoiningAs(mode);
    await verifyAndNavigate(selectedRoomId.trim(), mode, passwordInput || "");
  };

  const verifyAndNavigate = async (roomId: string, mode: "player" | "controller", password: string) => {
    setIsVerifying(true);
    setVerifyError(null);

    try {
      await verifyRoom({ room_id: roomId, password });

      if (password) {
        storeRoomPassword(roomId, password);
      }

      const searchParams = new URLSearchParams();
      searchParams.set("room", roomId);
      navigate(`/${mode}?${searchParams.toString()}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to join room";
      setVerifyError(errorMessage);
      setIsVerifying(false);
    }
  };

  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(selectedRoomId.toLowerCase())
  );

  return (
    <FullScreenLayout background="image" backdrop="lobby" className="overflow-y-auto">
      <div className="min-h-full w-full flex items-center justify-center title-safe">
        <Panel className="w-full max-w-2xl">
          <header className="px-4 py-2 bg-ka-raised border-b-2 border-ka-line">
            <Text font="display" size="2xl" weight="bold" tone="accent">
              Join Room
            </Text>
          </header>

          <div className="p-4 space-y-4">
            <div>
              <div className="flex items-center gap-3 border-b-2 border-ka-line pb-1 mb-2">
                <Text font="display" size="lg" weight="bold">
                  Active Rooms
                </Text>
                <Text font="mono" size="lg" tone="dim">
                  {filteredRooms.length.toString().padStart(2, "0")}
                </Text>
              </div>

              {isLoading && (
                <div className="flex justify-center py-6">
                  <LoadingIndicator size="lg" />
                </div>
              )}

              {error && (
                <Text size="sm" tone="danger" className="py-4 text-center">
                  Failed to load rooms.
                </Text>
              )}

              {!isLoading && !error && rooms.length === 0 && (
                <div className="py-6 flex flex-col items-center gap-4">
                  <Text size="sm" tone="dim">
                    No active rooms.
                  </Text>
                  <Button as={Link} to="/create" variant="accent" size="lg">
                    Create Room
                  </Button>
                </div>
              )}

              {!isLoading && !error && rooms.length > 0 && filteredRooms.length === 0 && (
                <Text size="sm" tone="dim" className="py-4 text-center">
                  No room named "{selectedRoomId}". Make it on the Create Room page first.
                </Text>
              )}

              {filteredRooms.length > 0 && (
                <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
                  {filteredRooms.map((room, index) => {
                    const selected = selectedRoomId === room.id;

                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => setSelectedRoomId(room.id)}
                        className={`flex items-stretch border-2 text-left active:translate-y-px ${
                          selected
                            ? "bg-ka-amber border-ka-amber text-ka-void"
                            : "bg-ka-panel border-ka-line text-ka-ink bevel"
                        }`}
                      >
                        <div className="flex items-center px-2 border-r border-ka-line-dim">
                          <Text font="mono" size="sm" tone={selected ? "inverse" : "dim"}>
                            {(index + 1).toString().padStart(2, "0")}
                          </Text>
                        </div>
                        <div className="flex-1 min-w-0 px-3 py-2">
                          <Text weight="bold" truncate tone={selected ? "inverse" : "default"}>
                            {room.name}
                          </Text>
                          {room.current_song && (
                            <Text size="sm" truncate tone={selected ? "inverse" : "dim"}>
                              {room.current_song}
                            </Text>
                          )}
                        </div>
                        <div className="flex items-center gap-3 px-3 border-l border-ka-line-dim">
                          <Text font="mono" size="sm" tone={selected ? "inverse" : "dim"}>
                            {room.client_count.toString().padStart(2, "0")}p
                          </Text>
                          <Text font="mono" size="sm" tone={selected ? "inverse" : "accent"}>
                            {room.queue_length.toString().padStart(2, "0")}q
                          </Text>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <Field label="Room Name">
              <Input
                value={selectedRoomId}
                onChange={handleRoomInputChange}
                placeholder="Search or type a room name"
                font="mono"
              />
            </Field>

            <Field label="Password (if required)">
              <Input
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setVerifyError(null);
                }}
                placeholder="Room password"
                type="password"
                disabled={!roomDetails?.requires_password || isBusy}
              />
              {verifyError && (
                <Text size="sm" tone="danger">
                  {verifyError}
                </Text>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button size="lg" variant="accent" disabled={isBusy} onClick={() => navigateToMode("player")}>
                {isVerifying && joiningAs === "player" ? "Joining" : "Enter as Display"}
              </Button>
              <Button size="lg" disabled={isBusy} onClick={() => navigateToMode("controller")}>
                {isVerifying && joiningAs === "controller" ? "Joining" : "Enter as Remote"}
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </FullScreenLayout>
  );
}
