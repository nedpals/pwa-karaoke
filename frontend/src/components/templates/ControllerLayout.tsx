import { forwardRef } from "react";
import { FullScreenLayout } from "./FullScreenLayout";

export interface ControllerLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  backgroundImage?: string;
}

const defaultBackgroundImage = "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

export const ControllerLayout = forwardRef<HTMLDivElement, ControllerLayoutProps>(
  ({ children, backgroundImage = defaultBackgroundImage, className = "", ...props }, ref) => {
    return (
      <FullScreenLayout
        ref={ref}
        background="image"
        backgroundImage={backgroundImage}
        className={`min-h-screen min-w-screen relative ${className}`.trim()}
        {...props}
      >
        <div className="flex flex-col w-full h-full bg-black/30 absolute top-0 inset-x-0 z-50">
          {children}
        </div>
      </FullScreenLayout>
    );
  }
);

ControllerLayout.displayName = "ControllerLayout";