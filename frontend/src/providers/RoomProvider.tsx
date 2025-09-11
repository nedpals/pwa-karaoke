import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { UseRoomReturn } from "../hooks/useRoom";

const RoomContext = createContext<UseRoomReturn | undefined>(
  undefined,
);

export const useRoomContext = () => {
  const context = useContext(RoomContext);
  if (context === undefined) {
    throw new Error(
      "useRoom must be used within a RoomProvider",
    );
  }
  return context;
};

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
