import { useState, useEffect, useRef } from "react";
import { useSearchParams, Navigate } from "react-router";
import { useRoom } from "../hooks/useRoom";
import { RoomProvider } from "../providers/RoomProviderComponent";
import { useRoomContext } from "../providers/RoomProvider";
import { LoadingIndicator } from "../components/atoms/LoadingIndicator";
import { TabNavigation, type Tab } from "../components/organisms/TabNavigation";
import { ControllerLayout } from "../components/templates/ControllerLayout";
import { SystemMessage } from "../components/templates/SystemMessage";
import { PasswordInput } from "../components/organisms/PasswordInput";
import { NicknameInput } from "../components/organisms/NicknameInput";
import { useLoudnessScore } from "../hooks/useLoudnessScore";
import { getNickname } from "../lib/nicknameStorage";
import { performanceIdOf } from "../lib/scoring";
import { SongSelectTab } from "./controller/SongSelectTab";
import { PlayerTab } from "./controller/PlayerTab";
import { QueueTab } from "./controller/QueueTab";
import { ControllerHeader } from "./controller/ControllerHeader";
import { MicCheckScreen } from "./controller/MicCheckScreen";
import { micNotice } from "./controller/micNotice";

const CONTROLLER_TABS = [
  { id: "song-select", label: "Search" },
  { id: "player", label: "Player" },
  { id: "queue", label: "Reserved" },
] as const;

function ControllerPageContent() {
  const [tab, setTab] = useState<(typeof CONTROLLER_TABS)[number]["id"]>("song-select");
  const [micAsked, setMicAsked] = useState(false);
  const { playerState, submitScore, scoringTurn } = useRoomContext();

  const mic = useLoudnessScore({
    active: scoringTurn,
    itemId: performanceIdOf(playerState),
    playState: playerState?.play_state ?? null,
    onSubmit: submitScore,
  });

  const tabs: Tab[] = CONTROLLER_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    content: t.id === "song-select" ? <SongSelectTab /> :
             t.id === "player" ? <PlayerTab notice={micNotice(mic.status, scoringTurn)} /> :
             <QueueTab />
  }));

  if (!micAsked) {
    return (
      <MicCheckScreen
        onAllow={() => {
          mic.start();
          setMicAsked(true);
        }}
        onSkip={() => {
          mic.decline();
          setMicAsked(true);
        }}
      />
    );
  }

  return (
    <ControllerLayout>
      <ControllerHeader />
      <TabNavigation
        className="flex-1 min-h-0"
        tabs={tabs}
        activeTab={tab}
        onTabChange={(tabId) => setTab(tabId as (typeof CONTROLLER_TABS)[number]["id"])}
      />
    </ControllerLayout>
  );
}

export default function ControllerPage() {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("room");
  const [nickname, setNickname] = useState<string | null>(null);
  const room = useRoom("controller", nickname);
  const hasRequestedJoin = useRef(false);

  // Held until the nickname is known, so the room learns it on the same join.
  useEffect(() => {
    if (!roomId || !nickname || hasRequestedJoin.current) return;

    hasRequestedJoin.current = true;
    room.verifyAndJoinRoom(roomId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, nickname]);

  // Redirect to home if no room specified
  if (!roomId) {
    return <Navigate to="/" replace />;
  }

  if (!nickname) {
    return (
      <SystemMessage
        title="Who Is Singing?"
        subtitle="Your nickname shows on the display next to the songs you reserve."
        variant="controller"
      >
        <NicknameInput defaultValue={getNickname()} onSubmit={setNickname} />
      </SystemMessage>
    );
  }

  if (room.isVerifying && !room.hasJoinedOnce) {
    return (
      <SystemMessage
        title="Connecting"
        subtitle="Checking access to this room."
        variant="controller"
      />
    );
  }

  if (room.verificationError) {
    if (room.requiresPassword) {
      return (
        <SystemMessage title="Password Required" variant="controller">
          <PasswordInput roomId={roomId} room={room} />
        </SystemMessage>
      );
    }

    return (
      <SystemMessage
        title="Access Denied"
        subtitle={room.verificationError}
        actions={() => <SystemMessage.BackButton />}
        variant="controller"
      />
    );
  }

  if (!room.hasJoinedOnce) {
    return (
      <SystemMessage
        title={!room.isVerified ? "Loading" : "Joining Room"}
        variant="controller"
      >
        <LoadingIndicator size="lg" />
      </SystemMessage>
    );
  }

  return (
    <RoomProvider data={room}>
      <ControllerPageContent />
    </RoomProvider>
  );
}
