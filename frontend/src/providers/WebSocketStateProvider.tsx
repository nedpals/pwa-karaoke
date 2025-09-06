import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { WebSocketReturn } from "../hooks/useWebSocket";

const WebSocketStateContext = createContext<WebSocketReturn | undefined>(
  undefined,
);

export const useWebSocketState = () => {
  const context = useContext(WebSocketStateContext);
  if (context === undefined) {
    throw new Error(
      "useWebSocketState must be used within a WebSocketStateProvider",
    );
  }
  return context;
};

export function WebSocketStateProvider({
  children,
  data: ws,
}: {
  data: WebSocketReturn;
  children: ReactNode;
}) {
  return (
    <WebSocketStateContext.Provider value={ws}>
      {children}
    </WebSocketStateContext.Provider>
  );
}
