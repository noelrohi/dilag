"use client"

import { cn } from "@/lib/utils"
import { motion, type UseInViewOptions } from "motion/react"
import React, { type ElementType, memo, useEffect, useMemo, useRef, useState } from "react"

export interface ShimmeringTextProps {
  /** Text to display with shimmer effect */
  text: string
  /** Animation duration in seconds */
  duration?: number
  /** Delay before starting animation */
  delay?: number
  /** Whether to repeat the animation */
  repeat?: boolean
  /** Pause duration between repeats in seconds */
  repeatDelay?: number
  /** Custom className */
  className?: string
  /** Whether to start animation when component enters viewport */
  startOnView?: boolean
  /** Whether to animate only once */
  once?: boolean
  /** Margin for in-view detection (rootMargin) */
  inViewMargin?: UseInViewOptions["margin"]
  /** Shimmer spread multiplier */
  spread?: number
  /** Base text color */
  color?: string
  /** Shimmer gradient color */
  shimmerColor?: string
}

export function ShimmeringText({
  text,
  duration = 2,
  delay = 0,
  repeat = true,
  repeatDelay = 0.5,
  className,
  startOnView = true,
  once = false,
  inViewMargin,
  spread = 2,
  color,
  shimmerColor,
}: ShimmeringTextProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [isInView, setIsInView] = useState(!startOnView)

  useEffect(() => {
    if (!startOnView) {
      setIsInView(true)
      return
    }

    if (typeof IntersectionObserver === "undefined") {
      setIsInView(true)
      return
    }

    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setIsInView(true)
        if (once) observer.disconnect()
      },
      { rootMargin: inViewMargin },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [inViewMargin, once, startOnView])

  const dynamicSpread = useMemo(() => {
    return text.length * spread
  }, [text, spread])

  const shouldAnimate = !startOnView || isInView

  return (
    <motion.span
      ref={ref}
      className={cn(
        "relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent",
        "[--base-color:var(--muted-foreground)] [--shimmer-color:var(--foreground)]",
        "[background-repeat:no-repeat,padding-box]",
        "[--shimmer-bg:linear-gradient(90deg,transparent_calc(50%-var(--spread)),var(--shimmer-color),transparent_calc(50%+var(--spread)))]",
        "dark:[--base-color:var(--muted-foreground)] dark:[--shimmer-color:var(--foreground)]",
        className,
      )}
      style={
        {
          "--spread": `${dynamicSpread}px`,
          ...(color && { "--base-color": color }),
          ...(shimmerColor && { "--shimmer-color": shimmerColor }),
          backgroundImage: `var(--shimmer-bg), linear-gradient(var(--base-color), var(--base-color))`,
        } as React.CSSProperties
      }
      initial={{
        backgroundPosition: "100% center",
        opacity: 0,
      }}
      animate={
        shouldAnimate
          ? {
              backgroundPosition: "0% center",
              opacity: 1,
            }
          : {}
      }
      transition={{
        backgroundPosition: {
          repeat: repeat ? Infinity : 0,
          duration,
          delay,
          repeatDelay,
          ease: "linear",
        },
        opacity: {
          duration: 0.3,
          delay,
        },
      }}
    >
      {text}
    </motion.span>
  )
}

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
  duration,
  spread,
}: TextShimmerProps) => (
  <Component className={cn("inline-flex", className)}>
    <ShimmeringText
      text={children}
      duration={duration}
      spread={spread}
      startOnView={false}
      className="min-w-0 truncate"
    />
  </Component>
)

export const Shimmer = memo(ShimmerComponent)
