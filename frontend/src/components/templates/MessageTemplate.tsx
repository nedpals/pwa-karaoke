import { Card } from "../organisms/Card";
import { FullScreenLayout } from "./FullScreenLayout";
import type { BackdropName } from "../../lib/backgrounds";

interface MessageTemplateProps {
  title?: string;
  size?: "sm" | "md" | "lg" | "auto";
  className?: string;
  children: React.ReactNode;
  backdrop?: BackdropName;
}

export function MessageTemplate({
  title = "System",
  size = "auto",
  className = "",
  children,
  backdrop = "notice",
}: MessageTemplateProps) {
  return (
    <FullScreenLayout background="image" backdrop={backdrop}>
      <div className="h-full w-full flex items-center justify-center title-safe">
        <Card title={title} size={size} className={`w-full max-w-3xl ${className}`.trim()}>
          {children}
        </Card>
      </div>
    </FullScreenLayout>
  );
}
