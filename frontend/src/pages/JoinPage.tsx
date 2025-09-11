import { Link, useNavigate } from "react-router";
import { useState } from "react";
import { FullScreenLayout } from "../components/templates/FullScreenLayout";
import { Text } from "../components/atoms/Text";
import { Button } from "../components/atoms/Button";
import { Input } from "../components/atoms/Input";
import { LoadingSpinner } from "../components/atoms/LoadingSpinner";
import { useRooms, useRoomDetails, useVerifyRoomMutation } from "../hooks/useApi";
import { storeRoomPassword } from "../lib/roomStorage";
import { useDebounce } from "use-debounce";

const backgroundImage = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

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

  const handleRoomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedRoomId(e.target.value);
  };

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoomId(roomId);
  };

  const handlePasswordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordInput(e.target.value);
    setVerifyError(null);
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

      // Store password if provided and verification successful
      if (password) {
        storeRoomPassword(roomId, password);
      }

      // Navigate to the room
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
    <FullScreenLayout
      background="image"
      backgroundImage={backgroundImage}
    >
      <div className="flex flex-col items-center justify-center h-full bg-black/30 p-8">
        <div className="max-w-4xl w-full space-y-8">
          <div className="text-center space-y-4">
            <Text as="h1" size="6xl" weight="bold" shadow className="text-white">
              Join Room
            </Text>
            <Text size="xl" shadow className="text-white/80 max-w-2xl mx-auto">
              Browse active rooms or enter a room name to join.
            </Text>
          </div>

          <div className="max-w-xl mx-auto w-full bg-black/60 p-8 rounded-xl border border-white/20">
            <div>
              <Text size="lg" shadow className="text-white mb-4 text-center">
                Active Rooms
              </Text>

              {isLoading && (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="lg" />
                </div>
              )}

              {error && (
                <div className="text-center py-4">
                  <Text size="base" className="text-red-400">
                    Failed to load rooms. Please try again.
                  </Text>
                </div>
              )}

              {!isLoading && !error && filteredRooms.length === 0 && rooms.length === 0 && (
                <div className="text-center py-8 space-y-8">
                  <Text size="base" className="text-white/60">
                    No active rooms found. Create a new room to get started!
                  </Text>
                  <Button
                    as={Link}
                    to="/create"
                    variant="primary"
                    size="lg"
                  >
                    Create Room
                  </Button>
                </div>
              )}

              {!isLoading && !error && filteredRooms.length === 0 && rooms.length > 0 && selectedRoomId.length > 0 && (
                <div className="text-center py-4">
                  <Text size="base" className="text-white/60">
                    No rooms match "{selectedRoomId}". Press enter to join/create this room.
                  </Text>
                </div>
              )}

              {filteredRooms.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {filteredRooms.map((room) => (
                    <Button
                      key={room.id}
                      onClick={() => handleRoomSelect(room.id)}
                      variant={selectedRoomId === room.id ? "primary" : "glass"}
                      className="w-full p-4 text-left hover:scale-[1.01] transition-transform"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                          <Text size="lg" weight="bold" className={selectedRoomId === room.id ? "text-white" : "text-white"}>
                            {room.name}
                          </Text>
                          {room.current_song && (
                            <Text size="sm" className={selectedRoomId === room.id ? "text-white/70" : "text-white/50"}>
                              Playing: {room.current_song}
                            </Text>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <Text size="sm" className={selectedRoomId === room.id ? "text-white/80" : "text-white/60"}>
                            {room.client_count} users
                          </Text>
                          {room.queue_length > 0 && (
                            <Text size="sm" className={selectedRoomId === room.id ? "text-white/60" : "text-white/40"}>
                              • {room.queue_length} songs
                            </Text>
                          )}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-4">
              <Text shadow className="text-white mb-2">
                Or enter Room Name
              </Text>
              <Input
                value={selectedRoomId}
                onChange={handleRoomInputChange}
                placeholder="Search rooms or enter room name"
                size="md"
                glass
              />
            </div>

            <div className="mb-4">
              <Text shadow className="text-white mb-2">
                Room Password (If Required)
              </Text>
              <Input
                value={passwordInput}
                onChange={handlePasswordInputChange}
                placeholder="Enter room password"
                type="password"
                glass
                disabled={!roomDetails?.requires_password || isVerifying || selectedRoomId !== debouncedRoomId || isRoomDetailsLoading}
              />
              {verifyError && (
                <Text size="sm" className="text-red-400">
                  {verifyError}
                </Text>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Button
                size="lg"
                disabled={!hasValidRoom || isVerifying || selectedRoomId !== debouncedRoomId || isRoomDetailsLoading}
                onClick={() => navigateToMode("player")}
              >
                {isVerifying && joiningAs === "player" ? "Joining..." : "Join as Player"}
              </Button>
              <Button
                size="lg"
                disabled={!hasValidRoom || isVerifying || selectedRoomId !== debouncedRoomId || isRoomDetailsLoading}
                onClick={() => navigateToMode("controller")}
              >
                {isVerifying && joiningAs === "controller" ? "Joining..." : "Join as Controller"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </FullScreenLayout>
  );
}
