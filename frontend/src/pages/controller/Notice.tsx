import { Panel } from "../../components/atoms/Panel";
import { Text } from "../../components/atoms/Text";

export function Notice({ children, tone = "danger" }: { children: React.ReactNode; tone?: "danger" | "dim" }) {
  return (
    <Panel tone="sunken" className="px-3 py-2 mb-3">
      <Text size="sm" tone={tone}>
        {children}
      </Text>
    </Panel>
  );
}
