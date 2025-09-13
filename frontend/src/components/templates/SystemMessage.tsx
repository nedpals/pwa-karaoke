import { Text } from "../atoms/Text";
import { Button } from "../atoms/Button";
import { Link } from "react-router";
import { MessageTemplate } from "./MessageTemplate";
import { FullScreenLayout } from "./FullScreenLayout";

interface SystemMessageProps {
  title: string;
  subtitle?: string;
  actions?: () => React.ReactNode;
  children?: React.ReactNode;
  variant?: "player" | "controller";
}

function FallbackBackground({ className }: { className?: string }) {
  const backgroundImage = "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

  return (
    <FullScreenLayout
      background="image"
      backgroundImage={backgroundImage}
      className={className}
    >
      <div className="flex flex-col w-full h-full bg-black/30" />
    </FullScreenLayout>
  );
}

function ControllerBackground({ className }: { className?: string }) {
  const backgroundImage = "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

  return (
    <FullScreenLayout
      background="image"
      backgroundImage={backgroundImage}
      className={className}
    >
      <div className="flex flex-col w-full h-full bg-black/30" />
    </FullScreenLayout>
  );
}

export function SystemMessage({
  title,
  subtitle,
  actions: Actions,
  children,
  variant = "player"
}: SystemMessageProps) {
  const Background = variant === "controller" ? ControllerBackground : FallbackBackground;

  return (
    <MessageTemplate background={<Background className="relative" />}>
      <div className="flex flex-col items-center justify-center space-y-6 min-h-48 max-w-md mx-auto">
        <Text size="lg" shadow>
          {title}
        </Text>
        {subtitle && (
          <Text size="base" shadow className="text-gray-300 text-center">
            {subtitle}
          </Text>
        )}
        {children}
        {Actions && <Actions />}
      </div>
    </MessageTemplate>
  );
}

// Common action components for convenience
SystemMessage.BackButton = () => (
  <Button as={Link} to="/" variant="primary" size="lg">
    Back to Join Page
  </Button>
);