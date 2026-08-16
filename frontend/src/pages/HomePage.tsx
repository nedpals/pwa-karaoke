import { useNavigate } from "react-router";
import { FullScreenLayout } from "../components/templates/FullScreenLayout";
import { Panel } from "../components/atoms/Panel";
import { Text } from "../components/atoms/Text";

const MENU = [
  { key: "1", label: "Join Room", path: "/join" },
  { key: "2", label: "Create Room", path: "/create" },
];

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <FullScreenLayout background="image" backdrop="lobby">
      <div className="h-full w-full flex flex-col items-center justify-center title-safe">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <Text font="display" size="7xl" weight="bold" stencil>
              PWA Karaoke
            </Text>
          </div>

          <Panel className="divide-y divide-ka-line">
            {MENU.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.path)}
                className="w-full flex items-stretch text-left group active:translate-y-px"
              >
                <div className="flex items-center px-5 bg-ka-raised border-r border-ka-line group-hover:bg-ka-amber">
                  <Text font="mono" size="3xl" weight="bold" tone="accent" className="group-hover:text-ka-void">
                    {item.key}
                  </Text>
                </div>
                <div className="flex-1 px-5 py-4 group-hover:bg-ka-raised">
                  <Text font="display" size="3xl" weight="bold">
                    {item.label}
                  </Text>
                </div>
              </button>
            ))}
          </Panel>
        </div>
      </div>
    </FullScreenLayout>
  );
}
