import { useState } from "react";
import { Text } from "../components/atoms/Text";
import { Card } from "../components/organisms/Card";
import { OSD } from "../components/molecules/OSD";
import { StatusBar } from "../components/organisms/StatusBar";
import { QRCode } from "../components/atoms/QRCode";

export function RiMusic2Fill(props: React.SVGProps<SVGSVGElement>) {
    return (
        // biome-ignore lint/a11y/noSvgWithoutTitle: <explanation>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
            <path fill="currentColor" d="M20 3v14a4 4 0 1 1-2-3.465V6H9v11a4 4 0 1 1-2-3.465V3z" />
        </svg>
    )
}

function PlayerHeader({ className }: {
    className?: string;
}) {
    return (
        <StatusBar
            status="Playing"
            title="Artist Name - Player Name"
            icon={<RiMusic2Fill className="w-8 h-8 mr-2 text-blue-500" />}
            count={1}
            className={className}
        />
    );
}

function VideoPlayerMock({ className }: {
    className?: string;
}) {
    return <div className={`w-screen h-screen ${className}`} style={{
        backgroundImage: "url(https://images.unsplash.com/photo-1490750967868-88aa4486c946?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D)",
        backgroundSize: "cover",
        backgroundPosition: "center",
    }} />;
}

function MainPlayerStateContent() {
    return (
        <div className="relative">
            <div className="absolute top-0 inset-x-0 z-20 max-w-7xl mx-auto pt-8">
                <PlayerHeader />
            </div>
            <OSD position="top-left" size="md">
                Pause
            </OSD>
            <VideoPlayerMock className="relative" />
        </div>
    );
}

function ConnectingStateScreen() {
    return (
        <div className="relative">
            <div className="absolute top-0 inset-x-0 h-screen w-screen z-10 flex flex-col items-center justify-center">
                <div className="max-w-5xl w-full mx-auto">
                    <Card 
                        title="System Message"
                        size="md"
                        className="w-full"
                    >
                        <Text size="lg" shadow>Connecting</Text>
                    </Card>
                </div>
            </div>

            <VideoPlayerMock className="relative" />
        </div>
    );
}

function ConnectedStateScreen() {
    const controllerUrl = `${window.location.origin}/controller`;
    
    return (
        <div className="relative">
            <div className="absolute top-0 inset-x-0 h-screen w-screen z-10 flex flex-col items-center justify-center">
                <div className="max-w-5xl w-full mx-auto">
                    <Card 
                        title="System Message"
                        size="auto"
                        className="w-full"
                    >
                        <div className="flex flex-row items-center space-x-8 py-4">
                            <div className="flex-1 space-y-4 text-left">
                                <Text size="lg" shadow>
                                    To control the karaoke system, scan the QR code or visit:
                                </Text>
                                <Text size="xl" weight="bold" shadow className="break-all">
                                    {controllerUrl}
                                </Text>
                                <Text size="base" shadow className="text-gray-300">
                                    Open the controller page on your phone or device to start adding songs to the queue.
                                </Text>
                            </div>
                            <div className="bg-white p-4 rounded-lg">
                                <QRCode data={controllerUrl} size={200} />
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            <VideoPlayerMock className="relative" />
        </div>
    );
}

function ReadyStateScreen() {
    return (
        <div className="relative">
            <div className="absolute top-0 inset-x-0 h-screen w-screen flex flex-col items-center justify-center z-10">
                <Text size="9xl" weight="bold" className="text-white text-shadow-lg text-shadow-black">Select a Song</Text>
            </div>

            <VideoPlayerMock className="relative" />
        </div>
    );
}

export default function DisplayPage2() {
    const [state] = useState<"connecting" | "connected" | "ready" | "play">("connected");

    if (state === "connecting") {
        return <ConnectingStateScreen />
    }

    if (state === "connected") {
        return <ConnectedStateScreen />;
    }

    if (state === "ready") {
        return <ReadyStateScreen />;
    }

    return (
        <MainPlayerStateContent />
    );
}