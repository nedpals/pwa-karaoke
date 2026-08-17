import { useState } from "react";
import { Button } from "../atoms/Button";
import { Input } from "../atoms/Input";
import { Text } from "../atoms/Text";
import { MAX_NICKNAME_LENGTH, normalizeNickname, storeNickname } from "../../lib/nicknameStorage";

interface NicknameInputProps {
  defaultValue?: string;
  onSubmit: (nickname: string) => void;
}

/** Asks the remote who is holding it before it joins a room. */
export function NicknameInput({ defaultValue = "", onSubmit }: NicknameInputProps) {
  const [nickname, setNickname] = useState(defaultValue);
  const trimmed = normalizeNickname(nickname);
  const remaining = MAX_NICKNAME_LENGTH - nickname.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;

    storeNickname(trimmed);
    onSubmit(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-3">
      <Input
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder="Nickname"
        maxLength={MAX_NICKNAME_LENGTH}
        className="text-center"
        aria-label="Your nickname"
        autoFocus
      />

      <Text size="xs" tone="dim" className="block text-center">
        {remaining} character{remaining === 1 ? "" : "s"} remaining
      </Text>

      <Button type="submit" variant="accent" size="lg" disabled={!trimmed} className="w-full">
        Enter
      </Button>
    </form>
  );
}
