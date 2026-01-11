import { cn } from "@/lib/utils";
import type { SVGProps } from "react";

interface DilagIconProps extends SVGProps<SVGSVGElement> {
  animated?: boolean;
}

export function DilagIcon({ className, animated, ...props }: DilagIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-4", className)}
      {...props}
    >
      {/* Ghost rectangle - the outline element */}
      <rect
        x="4"
        y="6"
        width="6"
        height="12"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className={cn("opacity-35", animated && "animate-ghost-shimmer")}
      />
      {/* Organic morph - the solid half-circle/blob */}
      <path
        d="M12 6 C18 6, 20 9.5, 20 12 C20 14.5, 18 18, 12 18 L12 6 Z"
        fill="currentColor"
        className={cn(animated && "animate-morph-breathe origin-center")}
      />
    </svg>
  );
}
