import { Card } from "../organisms/Card";

interface MessageTemplateProps {
  title?: string;
  size?: "sm" | "md" | "lg" | "auto";
  className?: string;
  children: React.ReactNode;
  background?: React.ReactNode;
}

export function MessageTemplate({ 
  title = "System Message", 
  size = "auto", 
  className = "",
  children,
  background
}: MessageTemplateProps) {
  return (
    <div className="relative">
      <div className="absolute top-0 inset-x-0 h-screen w-screen z-10 flex flex-col items-center justify-center">
        <div className="max-w-5xl w-full mx-auto">
          <Card
            title={title}
            size={size}
            className={`w-full ${className}`}
          >
            {children}
          </Card>
        </div>
      </div>

      {background}
    </div>
  );
}