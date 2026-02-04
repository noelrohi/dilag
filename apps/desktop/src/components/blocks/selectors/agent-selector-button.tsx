import { AltArrowDown, CheckCircle } from "@solar-icons/react";
import { Button } from "@dilag/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@dilag/ui/dropdown-menu";
import { useAgents } from "@/hooks/use-agents";
import { cn } from "@/lib/utils";

// Shared selector styles for consistency
export const selectorStyles = cn(
  "h-8 gap-2 px-2.5 text-xs",
  "border-border/50 bg-transparent",
  "hover:bg-muted/50 hover:border-border/70",
  "transition-all duration-150"
);

interface AgentSelectorButtonProps {
  className?: string;
}

export function AgentSelectorButton({ className }: AgentSelectorButtonProps) {
  const { agents, selectedAgent, selectedAgentInfo, selectAgent, isLoading } =
    useAgents();

  if (isLoading || agents.length === 0) {
    return null;
  }

  // Don't show selector if only one agent
  if (agents.length === 1) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(selectorStyles, className)}
        >
          <span className="capitalize font-medium">
            {selectedAgentInfo?.name ?? "Agent"}
          </span>
          <AltArrowDown size={14} className="opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {agents.map((agent) => (
          <DropdownMenuItem
            key={agent.name}
            onClick={() => selectAgent(agent.name)}
            className="gap-2"
          >
            {agent.color && (
              <div
                className="size-2 rounded-full"
                style={{ backgroundColor: agent.color }}
              />
            )}
            <span className="flex-1 capitalize">{agent.name}</span>
            {selectedAgent === agent.name && (
              <CheckCircle size={14} className="text-muted-foreground" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
