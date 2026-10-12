import { useSearchParams, Navigate } from "react-router";
import { Text } from "../../../components/atoms/Text";
import { Panel } from "../../../components/atoms/Panel";
import { QRCode } from "../../../components/atoms/QRCode";
import { MessageTemplate } from "../../../components/templates/MessageTemplate";

export function ConnectedStateScreen() {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("room");

  if (!roomId) {
    return <Navigate to="/" replace />;
  }

  const controllerUrl = `${window.location.origin}/controller?room=${encodeURIComponent(roomId)}`;

  return (
    <MessageTemplate title="Connect a Controller" backdrop="idle">
      <div className="flex flex-col md:flex-row items-center gap-8 w-full">
        <div className="flex-1 space-y-4">
          <Text size="lg" tone="dim">
            Scan the code or open this address on your phone:
          </Text>
          <Panel tone="sunken" className="px-4 py-3">
            <Text font="mono" size="xl" weight="bold" tone="accent" className="break-all">
              {controllerUrl}
            </Text>
          </Panel>
          <div className="flex items-center gap-3">
            <Text font="display" size="lg" tone="dim">
              Room
            </Text>
            <Text font="mono" size="xl" weight="bold">
              {roomId}
            </Text>
          </div>
        </div>
        <div className="border-2 border-ka-ink bg-white p-3 shrink-0">
          <QRCode data={controllerUrl} size={200} />
        </div>
      </div>
    </MessageTemplate>
  );
}
