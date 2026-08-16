import { Fragment } from "react";
import { TabButton } from "../molecules/TabButton";
import { cn } from "../../lib/utils";

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

export function TabNavigation({
  tabs,
  activeTab,
  onTabChange,
  showContent = true,
  className,
  ...props
}: TabNavigationProps) {
  return (
    <div className={cn("flex flex-col w-full h-full min-h-0", className)} {...props}>
      <div className="flex flex-row shrink-0" role="tablist">
        {tabs.map((tab, index) => (
          <Fragment key={`tab_${tab.id}`}>
            <TabButton active={activeTab === tab.id} onClick={() => onTabChange(tab.id)} size="lg">
              {tab.label}
            </TabButton>
            {index < tabs.length - 1 && <div className="w-0.5 shrink-0 bg-ka-line-dim self-stretch" />}
          </Fragment>
        ))}
      </div>

      {showContent && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {tabs.map((tab) => (
            <div key={`tab_content_${tab.id}`} className={activeTab === tab.id ? "block" : "hidden"}>
              {tab.content}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
