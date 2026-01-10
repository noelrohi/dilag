import { cn } from "@/lib/utils";

export type PreviewTab = "preview" | "code";

interface PreviewTabsProps {
  activeTab: PreviewTab;
  onTabChange: (tab: PreviewTab) => void;
  codeCount?: number;
  className?: string;
}

export function PreviewTabs({
  activeTab,
  onTabChange,
  codeCount = 0,
  className,
}: PreviewTabsProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <TabButton
        active={activeTab === "preview"}
        onClick={() => onTabChange("preview")}
      >
        Preview
      </TabButton>
      <TabButton
        active={activeTab === "code"}
        onClick={() => onTabChange("code")}
      >
        Code
        {codeCount > 0 && (
          <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-primary/10 text-primary">
            {codeCount}
          </span>
        )}
      </TabButton>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
    >
      {children}
    </button>
  );
}
