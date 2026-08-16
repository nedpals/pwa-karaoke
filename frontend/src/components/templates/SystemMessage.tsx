import { Link } from "react-router";
import { Text } from "../atoms/Text";
import { Button } from "../atoms/Button";
import { MessageTemplate } from "./MessageTemplate";

interface SystemMessageProps {
  title: string;
  subtitle?: string;
  actions?: () => React.ReactNode;
  children?: React.ReactNode;
  variant?: "player" | "controller";
}

export function SystemMessage({
  title,
  subtitle,
  actions: Actions,
  children,
  variant = "player",
}: SystemMessageProps) {
  return (
    <MessageTemplate title={title} backdrop={variant === "controller" ? "remote" : "notice"}>
      <div className="flex flex-col items-center justify-center gap-6 py-6 w-full max-w-md">
        {subtitle && (
          <Text size="lg" tone="dim" className="text-center">
            {subtitle}
          </Text>
        )}
        {children}
        {Actions && <Actions />}
      </div>
    </MessageTemplate>
  );
}

SystemMessage.BackButton = () => (
  <Button as={Link} to="/" variant="accent" size="lg">
    Back
  </Button>
);
