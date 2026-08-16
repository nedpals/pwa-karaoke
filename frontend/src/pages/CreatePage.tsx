import { useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { FullScreenLayout } from "../components/templates/FullScreenLayout";
import { Panel } from "../components/atoms/Panel";
import { Text } from "../components/atoms/Text";
import { Button } from "../components/atoms/Button";
import { Input } from "../components/atoms/Input";
import { ToggleButtonGroup } from "../components/molecules/ToggleButtonGroup";
import { generateRoomId } from "../lib/utils";
import { useCreateRoomMutation, useRoomDetails } from "../hooks/useApi";
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
      setError("Room name already taken. Pick another.");
      setIsCreating(false);
    }
  }, [roomDetails]);

  return (
    <FullScreenLayout background="image" backdrop="lobby" className="overflow-y-auto">
      <div className="min-h-full w-full flex items-center justify-center title-safe">
        <Panel className="w-full max-w-2xl">
          <header className="px-4 py-2 bg-ka-raised border-b-2 border-ka-line">
            <Text font="display" size="2xl" weight="bold" tone="accent">
              Create Room
            </Text>
          </header>

          <div className="p-4 space-y-4">
            <Field label="Room Name">
              <Input value={roomId} onChange={handleRoomChange} size="lg" font="mono" />
            </Field>

            <Field label="Visibility">
              <ToggleButtonGroup
                value={isPublic ? "public" : "private"}
                onChange={(value) => setIsPublic(value === "public")}
                options={[
                  { value: "public", label: "Public" },
                  { value: "private", label: "Private" },
                ]}
              />
            </Field>

            <Field label="Password (optional)">
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank for no password"
                type="password"
              />
            </Field>

            {error && (
              <Panel tone="sunken" className="px-3 py-2">
                <Text size="sm" tone="danger">
                  {error}
                </Text>
              </Panel>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                onClick={() => navigateToMode("player")}
                variant="accent"
                size="lg"
                disabled={isCreating}
                className="flex flex-col py-3"
              >
                <span>{isCreating ? "Creating" : "Enter as Display"}</span>
                <span className="text-xs tracking-widest opacity-70">TV or projector</span>
              </Button>
              <Button
                onClick={() => navigateToMode("controller")}
                size="lg"
                disabled={isCreating}
                className="flex flex-col py-3"
              >
                <span>{isCreating ? "Creating" : "Enter as Remote"}</span>
                <span className="text-xs tracking-widest opacity-70">Phone or tablet</span>
              </Button>
            </div>

            <Text size="sm" tone="dim">
              {isPublic
                ? "Anyone can find this room in the list."
                : "Share the room name and password to let others in."}
            </Text>
          </div>
        </Panel>
      </div>
    </FullScreenLayout>
  );
}
