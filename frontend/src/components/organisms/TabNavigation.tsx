import { TabButton } from "../molecules/TabButton";

export interface Tab {
  id: string;
  label: string;
  content?: React.ReactNode;
}

export interface TabNavigationProps extends React.HTMLAttributes<HTMLDivElement> {
  tabs: readonly Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  showContent?: boolean;
}

export function TabNavigation({ tabs, activeTab, onTabChange, showContent = true, className = "", ...props }: TabNavigationProps) {
  return (
    <div className={`flex flex-col w-full h-full ${className}`.trim()} {...props}>
      <div className="flex flex-row">
        {tabs.map((tab, index) => (
          <>
            <TabButton
              key={`tab_button_${tab.id}`}
              active={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              size="lg"
            >
              {tab.label}
            </TabButton>
            {index < tabs.length - 1 && (
              <div
                key={`tab_divider_${tab.id}`}
                className="w-px bg-white/40 self-stretch"
              />
            )}
          </>
        ))}
      </div>

      {showContent && (
        <div className="flex-1 overflow-y-auto relative">
          {tabs.map((tab) => (
            <div
              key={`tab_content_${tab.id}`}
              className={`${activeTab === tab.id ? "block" : "hidden"}`}
            >
              {tab.content}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}