import { useState, useEffect } from "react";
import { useSearchParams, Navigate } from "react-router";
import { useRoom } from "../hooks/useRoom";
import { LoadingIndicator } from "../components/atoms/LoadingIndicator";
import { SystemMessage } from "../components/templates/SystemMessage";
import { PasswordInput } from "../components/organisms/PasswordInput";
import { RoomProvider } from "../providers/RoomProvider";
import { getDisplayNickname } from "../lib/nicknameStorage";
import { usePlayerState } from "./player/context";
import { PlayerStateProviderInternal } from "./player/PlayerStateProvider";
import { ReactionLayer } from "./player/screens/ReactionLayer";
import { StatusStrip } from "./player/screens/StatusStrip";
import { PlayingStateContent } from "./player/screens/PlayingStateContent";
import { ConnectedStateScreen } from "./player/screens/ConnectedStateScreen";
import { ScoringStateScreen } from "./player/screens/ScoringStateScreen";
import { ReadyStateScreen } from "./player/screens/ReadyStateScreen";
import { AwaitingInteractionStateScreen } from "./player/screens/AwaitingInteractionStateScreen";

function PlayerPageContent() {
  const { appState } = usePlayerState();

  switch (appState) {
    case "awaiting-interaction":
      return <AwaitingInteractionStateScreen />;
    case "connected":
      return <ConnectedStateScreen />;
    case "ready":
      return <ReadyStateScreen />;
    case "scoring":
      return <ScoringStateScreen />;
    case "playing":
      return <PlayingStateContent />;
    default:
      return <SystemMessage title="Connecting" variant="player" />;
  }
}

export default function PlayerPage() {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("room");
  const [nickname] = useState(getDisplayNickname);
  const room = useRoom("display", nickname);

  useEffect(() => {
    if (roomId) {
      room.verifyAndJoinRoom(roomId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect to home if no room specified
  if (!roomId) {
    return <Navigate to="/" replace />;
  }

  if (room.isVerifying && !room.hasJoinedOnce) {
    return (
      <SystemMessage
        title="Connecting"
        subtitle="Checking access to this room."
        variant="player"
      />
    );
  }

  if (room.verificationError) {
    if (room.requiresPassword) {
      return (
        <SystemMessage title="Password Required" variant="player">
          <PasswordInput roomId={roomId} room={room} />
        </SystemMessage>
      );
    }

    return (
      <SystemMessage
        title="Access Denied"
        subtitle={room.verificationError}
        actions={() => <SystemMessage.BackButton />}
        variant="player"
      />
    );
  }

  if (!room.hasJoinedOnce) {
    return (
      <SystemMessage title={!room.isVerified ? "Loading" : "Joining Room"} variant="player">
        <LoadingIndicator size="lg" />
      </SystemMessage>
    );
  }

  return (
    <RoomProvider data={room}>
      <PlayerStateProviderInternal>
        <div className="relative">
          <PlayerPageContent />
          <ReactionLayer />
          <div className="absolute bottom-[3vh] left-[3vw] z-30">
            <StatusStrip />
          </div>
        </div>
      </PlayerStateProviderInternal>
    </RoomProvider>
  );
}
