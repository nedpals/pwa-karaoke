import { useNavigate } from "react-router";
import { FullScreenLayout } from "../components/templates/FullScreenLayout";
import { Text } from "../components/atoms/Text";
import { Button } from "../components/atoms/Button";

const backgroundImage = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

export default function HomePage() {
  const navigate = useNavigate();

  const handleJoinRoom = () => {
    navigate("/join");
  };

  const handleCreateRoom = () => {
    navigate("/create");
  };

  return (
    <FullScreenLayout
      background="image"
      backgroundImage={backgroundImage}
    >
      <div className="flex flex-col items-center justify-center h-full bg-black/30 p-8">
        <div className="max-w-4xl w-full space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <Text as="h1" size="6xl" weight="bold" shadow className="text-white">
              PWA Karaoke
            </Text>
            <Text size="xl" shadow className="text-white/80 max-w-2xl mx-auto">
              Transform any space into a karaoke party.
            </Text>
          </div>

          {/* Main Options */}
          <div className="grid md:grid-cols-2 gap-8 mt-16">
            {/* Join Room Button */}
            <Button
              onClick={handleJoinRoom}
              variant="glass"
              className="h-64 flex flex-col items-center justify-center space-y-6 text-center hover:scale-[1.02] transition-transform p-8"
            >
              <div className="text-8xl">🚪</div>
              <div className="space-y-2">
                <Text size="2xl" weight="bold" shadow className="text-white">
                  Join Room
                </Text>
                <Text size="lg" shadow className="text-white/80">
                  Enter an existing karaoke session
                </Text>
              </div>
            </Button>

            {/* Create Room Button */}
            <Button
              onClick={handleCreateRoom}
              variant="glass"
              className="h-64 flex flex-col items-center justify-center space-y-6 text-center hover:scale-[1.02] transition-transform p-8"
            >
              <div className="text-8xl">🎤</div>
              <div className="space-y-2">
                <Text size="2xl" weight="bold" shadow className="text-white">
                  Create Room
                </Text>
                <Text size="lg" shadow className="text-white/80">
                  Start a new karaoke session
                </Text>
              </div>
            </Button>
          </div>
        </div>
      </div>
    </FullScreenLayout>
  );
}