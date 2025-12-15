import { CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ToolState } from "@/lib/opencode";
import {
  CheckCircleIcon,
  ChevronRightIcon,
  Loader2Icon,
  XCircleIcon,
  type LucideIcon,
} from "lucide-react";

interface CustomToolHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  state: ToolState;
  className?: string;
}

function StatusIcon({ status }: { status: ToolState["status"] }) {
  switch (status) {
    case "pending":
    case "running":
      return <Loader2Icon className="size-3 animate-spin text-muted-foreground" />;
    case "completed":
      return <CheckCircleIcon className="size-3 text-green-600" />;
    case "error":
      return <XCircleIcon className="size-3 text-red-600" />;
  }
}

export function CustomToolHeader({
  icon: Icon,
  title,
  subtitle,
  state,
  className,
}: CustomToolHeaderProps) {
  return (
    <CollapsibleTrigger
      className={cn(
        "group flex w-full items-center gap-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors",
        className
      )}
    >
      <ChevronRightIcon className="size-3 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
      <Icon className="size-4 shrink-0" />
      <span className="font-medium text-foreground">{title}</span>
      {subtitle && (
        <span className="truncate text-muted-foreground">{subtitle}</span>
      )}
      <StatusIcon status={state.status} />
    </CollapsibleTrigger>
  );
}
