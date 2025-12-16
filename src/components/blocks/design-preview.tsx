import { Eye, Code, Download, Copy, MoreHorizontal, Smartphone, Globe, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useDesigns, type DesignFile } from "@/hooks/use-designs";
import { copyToClipboard, downloadHtml } from "@/lib/design-export";
import { DesignPreviewFrame } from "./design-preview-frame";
import { DesignCodeView } from "./design-code-view";

function DesignPreviewEmpty() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Eye className="size-6 text-muted-foreground" />
      </div>
      <h3 className="font-medium text-lg mb-2">No designs yet</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Ask the designer to create a screen or component and it will appear here.
      </p>
    </div>
  );
}

interface DesignTabProps {
  design: DesignFile;
  isActive: boolean;
  onClick: () => void;
}

function DesignTab({ design, isActive, onClick }: DesignTabProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "hover:bg-muted text-muted-foreground hover:text-foreground"
      )}
    >
      {design.screen_type === "mobile" ? (
        <Smartphone className="size-3.5" />
      ) : (
        <Globe className="size-3.5" />
      )}
      {design.title}
    </button>
  );
}

export function DesignPreview() {
  const {
    designs,
    activeDesign,
    activeIndex,
    setActiveIndex,
    viewMode,
    setViewMode,
    isLoading,
    refresh,
  } = useDesigns();

  if (designs.length === 0) {
    return <DesignPreviewEmpty />;
  }

  // Convert DesignFile to format expected by preview/code components
  const designForPreview = activeDesign ? {
    id: activeDesign.filename,
    sessionId: "",
    messageId: "",
    title: activeDesign.title,
    type: activeDesign.screen_type as "mobile" | "web",
    filePath: activeDesign.filename,
    html: activeDesign.html,
    createdAt: activeDesign.modified_at * 1000,
  } : null;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header with screen tabs and actions */}
      <div className="flex items-center justify-between border-b px-3 py-2 gap-2">
        {/* Screen tabs - scrollable */}
        <ScrollArea className="flex-1">
          <div className="flex items-center gap-1">
            {designs.map((design, index) => (
              <DesignTab
                key={design.filename}
                design={design}
                isActive={index === activeIndex}
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Refresh button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={refresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
          </Button>

          {/* View mode toggle */}
          <Tabs
            value={viewMode}
            onValueChange={(v) => setViewMode(v as "preview" | "code")}
          >
            <TabsList className="h-7">
              <TabsTrigger value="preview" className="h-5 px-2 text-xs gap-1">
                <Eye className="size-3" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="code" className="h-5 px-2 text-xs gap-1">
                <Code className="size-3" />
                Code
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2">
                <Download className="size-3" />
                <span className="text-xs">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => copyToClipboard(activeDesign?.html)}>
                <Copy className="size-4 mr-2" />
                Copy HTML
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadHtml(designForPreview)}>
                <Download className="size-4 mr-2" />
                Download HTML
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* More options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={refresh}>
                Refresh designs
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Preview content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === "preview" ? (
          <DesignPreviewFrame design={designForPreview} />
        ) : (
          <DesignCodeView design={designForPreview} />
        )}
      </div>
    </div>
  );
}
