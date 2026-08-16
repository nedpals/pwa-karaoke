import { useState } from "react";
import { Button } from "../atoms/Button";
import { Input } from "../atoms/Input";
import { MAX_NICKNAME_LENGTH, normalizeNickname, storeNickname } from "../../lib/nicknameStorage";

interface NicknameInputProps {
  defaultValue?: string;
  onSubmit: (nickname: string) => void;
}

/** Asks the remote who is holding it before it joins a room. */
export function NicknameInput({ defaultValue = "", onSubmit }: NicknameInputProps) {
  const [nickname, setNickname] = useState(defaultValue);
  const trimmed = normalizeNickname(nickname);

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

      <Button type="submit" variant="accent" size="lg" disabled={!trimmed} className="w-full">
        Enter
      </Button>
    </form>
  );
}
