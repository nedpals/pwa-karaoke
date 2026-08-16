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
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-3">
      {room.verificationError && (
        <Text size="sm" tone="danger" className="text-center">
          {room.verificationError}
        </Text>
      )}

      <Input
        type="password"
        placeholder="Room password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={isSubmitting}
        className="text-center"
        autoFocus
      />

      <Button
        type="submit"
        variant="accent"
        size="lg"
        disabled={isSubmitting || !password.trim()}
        className="w-full"
      >
        {isSubmitting ? 'Joining' : 'Enter'}
      </Button>
    </form>
  );
}
