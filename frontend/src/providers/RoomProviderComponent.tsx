import type { ReactNode } from "react";
import type { UseRoomReturn } from "../hooks/useRoom";
import { RoomContext } from "./RoomProvider";

export function RoomProvider({
  children,
  data: room,
}: {
  data: UseRoomReturn;
  children: ReactNode;
}) {
  return (
    <RoomContext.Provider value={room}>
      {children}
    </RoomContext.Provider>
  );
}
