import type { Violation, ViolationRule } from "@/hooks/use-designs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@dilag/ui/tooltip";
import { DangerTriangle } from "@solar-icons/react";

const RULE_LABELS: Record<ViolationRule, string> = {
  keyframes: "@keyframes animation",
  initial_opacity_zero: "opacity: 0 initial state",
  real_url: "external URL",
  emoji_as_icon: "emoji as icon",
  animation_css: "CSS animation shorthand",
  decorative_animation: "Tailwind animate-* utility",
};

interface Props {
  violations: Violation[];
}

export function ViolationBadge({ violations }: Props) {
  if (violations.length === 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/20"
          aria-label={`${violations.length} rule violation${violations.length === 1 ? "" : "s"}`}
        >
          <DangerTriangle weight="Bold" className="w-3 h-3" />
          <span className="font-medium tabular-nums">{violations.length}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-xs">
        <div className="space-y-1.5">
          <div className="font-medium">Design rule violations</div>
          <ul className="space-y-1 text-xs">
            {violations.map((v, i) => (
              <li key={i} className="flex flex-col">
                <span className="opacity-80">{RULE_LABELS[v.rule] ?? v.rule}</span>
                <code className="opacity-60 truncate">{v.snippet}</code>
              </li>
            ))}
          </ul>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
