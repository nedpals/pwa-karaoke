import { Text } from "../atoms/Text";
import { LoadingSpinner } from "../atoms/LoadingSpinner";
import { FullScreenLayout } from "./FullScreenLayout";

export interface CenteredMessageLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title?: string;
  message?: string;
  loading?: boolean;
  backgroundImage?: string;
  children?: React.ReactNode;
}

export function CenteredMessageLayout({
  icon,
  title,
  message,
  loading = false,
  backgroundImage,
  children,
  className = "",
  ...props
}: CenteredMessageLayoutProps) {
  return (
    <FullScreenLayout
      background={backgroundImage ? "image" : "black"}
      backgroundImage={backgroundImage}
      className={className}
      {...props}
    >
      <div className="flex flex-col items-center justify-center h-full text-white">
        {loading && <LoadingSpinner size="xl" className="mb-8" />}
        {icon && !loading && <div className="text-8xl mb-8">{icon}</div>}
        {title && (
          <Text as="h2" size="4xl" weight="bold" className="mb-4">
            {title}
          </Text>
        )}
        {message && (
          <Text size="xl" className="opacity-70">
            {message}
          </Text>
        )}
        {children}
      </div>
    </FullScreenLayout>
  );
}