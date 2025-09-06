import { useState } from "react";

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
        <header className={`w-full border border-white/80 rounded-lg bg-gradient-to-b from-gray-500/80 to-black/80 text-white ${className}`}>
            <div className="flex items-stretch">
                <div className="w-[10%] py-2 border-r border-white/40 flex items-center justify-center">
                    <p className="text-xl text-shadow-md text-shadow-black truncate">Playing</p>
                </div>
                <div className="flex-1 py-2 px-4 flex items-center justify-left">
                    <p className="text-xl text-shadow-md text-shadow-black truncate">Artist Name - Player Name</p>
                </div>
                <div className="w-[10%] py-2 border-l border-white/40 flex items-center justify-center">
                    <RiMusic2Fill className="w-8 h-8 mr-2 text-blue-500" />
                    <p className="text-2xl text-shadow-md text-shadow-black">1</p>
                </div>
            </div>
        </header>
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
            <div className="absolute top-[10%] left-[6.5%] z-20">
                <div className="m-4 px-12 py-2 h-24 w-48 border border-white/80 rounded-lg bg-gradient-to-b from-gray-500/80 to-black/80 text-white text-shadow-md text-shadow-black flex items-center justify-center flex-col">
                    <p className="text-lg">Pause</p>
                </div>
            </div>
            <VideoPlayerMock className="relative" />
        </div>
    );
}

function LoadingStateScreen() {
    return (
        <div className="relative">
            <div className="absolute top-0 inset-x-0 h-screen w-screen z-10 flex flex-col items-center justify-center">
                <div className="max-w-5xl w-full mx-auto">
                    <div className="w-full h-48 flex flex-col border border-white/80 rounded-lg bg-gradient-to-b from-gray-500/80 to-black/80 text-white">
                        <header className="w-full py-2 px-4 border-b border-white/40 text-shadow-md text-shadow-black flex flex-row justify-center text-center">
                            <p className="text-xl">System Message</p>
                        </header>
                        <div className="flex-1 px-4 py-2 text-shadow-md text-shadow-black text-lg flex items-center justify-center text-center">
                            <p>No controllers connected. Please connect a controller to start playing.</p>
                        </div>
                    </div>
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
                <p className="text-9xl text-white font-bold text-shadow-lg text-shadow-black">Select a Song</p>
            </div>

            <VideoPlayerMock className="relative" />
        </div>
    );
}

export default function DisplayPage2() {
    const [state] = useState<"loading" | "ready" | "play">("loading");

    if (state === "loading") {
        return <LoadingStateScreen />;
    }

    if (state === "ready") {
        return <ReadyStateScreen />;
    }

    return (
        <MainPlayerStateContent />
    );
}