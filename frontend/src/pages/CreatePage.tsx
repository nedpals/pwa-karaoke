import { useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { FullScreenLayout } from "../components/templates/FullScreenLayout";
import { Text } from "../components/atoms/Text";
import { Button } from "../components/atoms/Button";
import { Input } from "../components/atoms/Input";
import { LoadingSpinner } from "../components/atoms/LoadingSpinner";
import { ToggleButtonGroup } from "../components/molecules/ToggleButtonGroup";
import { generateRoomId } from "../lib/utils";
import { useCreateRoomMutation, useRoomDetails } from "../hooks/useApi";
import { storeRoomPassword } from "../lib/roomStorage";
import { useDebounce } from "use-debounce";

const backgroundImage = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

export default function CreatePage() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState(() => generateRoomId());
  const [isPublic, setIsPublic] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [debouncedRoomId] = useDebounce(roomId, 500);
  const { trigger: createRoom } = useCreateRoomMutation();
  const { data: roomDetails, mutate: changeRoomDetails } = useRoomDetails(debouncedRoomId || null);

  const handleRoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    changeRoomDetails(() => undefined);
    setRoomId(value.trim() || generateRoomId());
    setError(null);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };

  const navigateToMode = async (mode: "player" | "controller") => {
    if (isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      await createRoom({
        room_id: roomId,
        is_public: isPublic,
        password,
      });

      if (password) {
        storeRoomPassword(roomId, password);
      }

      // Navigate to the mode
      const searchParams = new URLSearchParams();
      searchParams.set("room", roomId);
      navigate(`/${mode}?${searchParams.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
      setIsCreating(false);
    }
  };

  useEffect(() => {
    if (roomDetails) {
      setError("Room ID already exists. Please choose a different one.");
      setIsCreating(false);
    }
  }, [roomDetails]);

  return (
    <FullScreenLayout
      background="image"
      backgroundImage={backgroundImage}
    >
      <div className="flex flex-col items-center justify-center h-full bg-black/30 p-8">
        <div className="max-w-4xl w-full space-y-8">
          <div className="text-center space-y-4">
            <Text as="h1" size="6xl" weight="bold" shadow className="text-white">
              Create Room
            </Text>
            <Text size="xl" shadow className="text-white/80 max-w-2xl mx-auto">
              Start a new karaoke session for everyone to join.
            </Text>
          </div>

          <div className="max-w-xl mx-auto w-full bg-black/60 p-8 rounded-xl border border-white/20 space-y-4">
            <div>
              <Text size="lg" shadow className="text-white mb-4 text-center">
                Room Name
              </Text>
              <Input
                value={roomId}
                onChange={handleRoomChange}
                placeholder="Enter custom room name or use generated name"
                size="lg"
                glass
              />
            </div>

            <div>
              <Text size="base" shadow className="text-white mb-2 text-center">
                Select room visibility
              </Text>
              <ToggleButtonGroup
                value={isPublic ? "public" : "private"}
                onChange={(value) => setIsPublic(value === "public")}
                options={[
                  { value: "public", label: "Public" },
                  { value: "private", label: "Private" },
                ]}
              />
            </div>

            <div>
              <Text size="base" shadow className="text-white mb-2 text-center">
                Room Password
              </Text>
              <Input
                value={password}
                onChange={handlePasswordChange}
                placeholder="Enter a password for your private room"
                type="password"
                glass
              />
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Button
                onClick={() => navigateToMode("player")}
                variant="glass"
                disabled={isCreating}
                className="flex flex-col items-center justify-center space-y-4 text-center hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isCreating ? (
                  <LoadingSpinner size="xl" />
                ) : (
                  <div className="text-6xl">🖥️</div>
                )}
                <div className="space-y-2">
                  <Text size="xl" weight="bold" shadow className="text-white">
                    {isCreating ? "Creating Room..." : "Enter as Display"}
                  </Text>
                  {!isCreating && (
                    <Text shadow className="text-white/80">
                      Connect to TV or projector to show videos
                    </Text>
                  )}
                </div>
              </Button>
              <Button
                onClick={() => navigateToMode("controller")}
                variant="glass"
                disabled={isCreating}
                className="flex flex-col items-center justify-center space-y-4 text-center hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isCreating ? (
                  <LoadingSpinner size="xl" />
                ) : (
                  <div className="text-6xl">📱</div>
                )}
                <div className="space-y-2">
                  <Text size="xl" weight="bold" shadow className="text-white">
                    {isCreating ? "Creating Room..." : "Enter as Controller"}
                  </Text>
                  {!isCreating && (
                    <Text shadow className="text-white/80">
                      Search songs and control the karaoke session
                    </Text>
                  )}
                </div>
              </Button>
            </div>

            {error && (
              <div className="text-center py-2">
                <Text size="base" className="text-red-400">
                  {error}
                </Text>
              </div>
            )}

            <Text size="sm" shadow className="text-white/60 text-center mt-8">
              {isPublic
                ? "Share this room name with others to join the same karaoke session"
                : "Share both the room name and password with others to join"
              }
            </Text>
          </div>
        </div>
      </div>
    </FullScreenLayout>
  );
}