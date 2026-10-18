import { createContext, useContext } from "react";
import type { UseRoomReturn } from "../hooks/useRoom";

export const RoomContext = createContext<UseRoomReturn | undefined>(
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
