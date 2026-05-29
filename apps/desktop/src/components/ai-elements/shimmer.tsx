"use client"

import { cn } from "@/lib/utils"
import { type CSSProperties, type ElementType, memo, useMemo } from "react"

export type TextShimmerProps = {
  children: string
  as?: ElementType
  className?: string
  duration?: number
  spread?: number
}

const ShimmerComponent = ({
  children,
  as: Component = "p",
  className,
  duration = 2,
  spread = 2,
}: TextShimmerProps) => {
  const dynamicSpread = useMemo(
    () => Math.max(16, (children?.length ?? 0) * spread),
    [children, spread],
  )

  return (
    <Component
      className={cn(
        "relative inline-block bg-clip-text text-transparent text-shimmer-sweep",
        className,
      )}
      style={
        {
          "--shimmer-duration": `${duration}s`,
          "--shimmer-spread": `${dynamicSpread}px`,
        } as CSSProperties
      }
    >
      {children}
    </Component>
  )
}

export const Shimmer = memo(ShimmerComponent)
