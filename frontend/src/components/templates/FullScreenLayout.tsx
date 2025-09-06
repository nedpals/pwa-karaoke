import { forwardRef } from "react";

export interface FullScreenLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  background?: "black" | "image";
  backgroundImage?: string;
}

export const FullScreenLayout = forwardRef<HTMLDivElement, FullScreenLayoutProps>(
  ({ 
    children, 
    background = "black", 
    backgroundImage,
    className = "", 
    ...props 
  }, ref) => {
    const backgroundStyles = background === "image" && backgroundImage
      ? {
          backgroundImage: `url("${backgroundImage}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : {};
    
    return (
      <div
        ref={ref}
        className={`h-screen w-screen relative ${background === "black" ? "bg-black" : ""} ${className}`.trim()}
        style={backgroundStyles}
        {...props}
      >
        {children}
      </div>
    );
  }
);

FullScreenLayout.displayName = "FullScreenLayout";