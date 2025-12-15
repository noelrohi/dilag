import { Badge } from "@/components/ui/badge";
import { CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ToolState } from "@/lib/opencode";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  ClockIcon,
  XCircleIcon,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

interface CustomToolHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  state: ToolState;
  className?: string;
}

function getStatusBadge(state: ToolState) {
  const statusConfig: Record<
    ToolState["status"],
    { label: string; icon: ReactNode }
  > = {
    pending: {
      label: "Pending",
      icon: <CircleIcon className="size-4" />,
    },
    running: {
      label: "Running",
      icon: <ClockIcon className="size-4 animate-pulse" />,
    },
    completed: {
      label: "Completed",
      icon: <CheckCircleIcon className="size-4 text-green-600" />,
    },
    error: {
      label: "Error",
      icon: <XCircleIcon className="size-4 text-red-600" />,
    },
  };

  const config = statusConfig[state.status];

  return (
    <Badge className="gap-1.5 rounded-full text-xs" variant="secondary">
      {config.icon}
      {config.label}
    </Badge>
  );
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
        "flex w-full items-center justify-between gap-4 p-3",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="font-medium text-sm">{title}</span>
        {subtitle && (
          <span className="truncate text-sm text-muted-foreground">
            {subtitle}
          </span>
        )}
        {getStatusBadge(state)}
      </div>
      <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
    </CollapsibleTrigger>
  );
}
