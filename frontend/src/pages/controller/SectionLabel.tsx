import { Text } from "../../components/atoms/Text";
import { LoadingIndicator } from "../../components/atoms/LoadingIndicator";

export function SectionLabel({
  children,
  count,
  busy = false,
}: {
  children: React.ReactNode;
  count?: number;
  busy?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-b-2 border-ka-line pb-1 mb-2">
      <Text font="display" size="lg" weight="bold" tone="accent">
        {children}
      </Text>
      {count !== undefined && (
        <Text font="mono" size="lg" weight="bold" tone="dim">
          {count.toString().padStart(2, "0")}
        </Text>
      )}
      {busy && <LoadingIndicator size="sm" />}
    </div>
  );
}
