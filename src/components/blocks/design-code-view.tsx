import { Copy } from "lucide-react";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/design-export";
import type { DesignScreen } from "@/context/session-store";

interface DesignCodeViewProps {
  design: DesignScreen | null;
}

export function DesignCodeView({ design }: DesignCodeViewProps) {
  if (!design) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No design selected
      </div>
    );
  }

  const markdown = "```html\n" + design.html + "\n```";

  return (
    <div className="h-full flex flex-col">
      <div className="sticky top-0 flex items-center justify-end p-2 bg-background/95 backdrop-blur border-b z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => copyToClipboard(design.html)}
          className="h-7 gap-1.5 px-2 text-xs"
        >
          <Copy className="size-3" />
          Copy
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="text-xs [&_pre]:!bg-muted/50 [&_code]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-4 [&_pre]:rounded-lg">
          <Streamdown>{markdown}</Streamdown>
        </div>
      </div>
    </div>
  );
}
