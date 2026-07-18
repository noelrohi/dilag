"use client"

import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"
import { memo } from "react"
import { Streamdown } from "streamdown"

export type MarkdownProps = ComponentProps<typeof Streamdown>

export const Markdown = memo(
  ({ className, ...props }: MarkdownProps) => (
    <Streamdown
      className={cn("typeset size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children,
)

Markdown.displayName = "Markdown"
