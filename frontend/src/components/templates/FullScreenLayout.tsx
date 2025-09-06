export interface FullScreenLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  background?: "black" | "image";
  backgroundImage?: string;
}

export function FullScreenLayout({
  children,
  background = "black",
  backgroundImage,
  className = "",
  ...props
}: FullScreenLayoutProps) {
  const backgroundStyles = background === "image" && backgroundImage
    ? {
      backgroundImage: `url("${backgroundImage}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    }
    : {};

  return (
    <div
      className={`h-screen w-screen relative ${background === "black" ? "bg-black" : ""} ${className}`.trim()}
      style={backgroundStyles}
      {...props}
    >
      {children}
    </div>
  );
}