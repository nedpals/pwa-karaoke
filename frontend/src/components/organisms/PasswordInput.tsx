import { useState } from "react";
import { Text } from "../atoms/Text";
import { Button } from "../atoms/Button";
import { Input } from "../atoms/Input";
import { useRoom } from "../../hooks/useRoom";

interface PasswordInputProps {
  roomId: string;
  room: ReturnType<typeof useRoom>;
}

export function PasswordInput({ roomId, room }: PasswordInputProps) {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await room.verifyAndJoinRoom(roomId, password);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-6 w-full max-w-md">
      {room.verificationError && (
        <Text size="base" shadow className="text-gray-300 text-center">
          {room.verificationError}
        </Text>
      )}

      <form onSubmit={handleSubmit} className="w-full space-y-4">
        <Input
          type="password"
          placeholder="Enter room password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isSubmitting}
          className="w-full text-center"
          autoFocus
        />

        <div className="flex gap-4">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isSubmitting || !password.trim()}
            className="flex-1"
          >
            {isSubmitting ? 'Joining...' : 'Join Room'}
          </Button>
        </div>
      </form>
    </div>
  );
}