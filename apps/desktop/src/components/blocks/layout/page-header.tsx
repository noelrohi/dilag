import { useSidebar } from "@dilag/ui/sidebar"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  children?: React.ReactNode
  className?: string
}

export function PageHeader({ children, className }: PageHeaderProps) {
  const { state } = useSidebar()
  const isSidebarCollapsed = state === "collapsed"

  return (
    <header
      className={cn(
        "h-[44px] shrink-0 flex items-center gap-1 select-none border-b border-border pl-3 pr-3",
        isSidebarCollapsed && "pl-[var(--titlebar-page-header-collapsed-left,144px)]",
        className,
      )}
    >
      {children}
    </header>
  )
}

interface PageHeaderLeftProps {
  children?: React.ReactNode
  className?: string
}

export function PageHeaderLeft({ children, className }: PageHeaderLeftProps) {
  return <div className={cn("flex min-w-0 items-center gap-2", className)}>{children}</div>
}

interface PageHeaderRightProps {
  children?: React.ReactNode
  className?: string
}

export function PageHeaderRight({ children, className }: PageHeaderRightProps) {
  return <div className={cn("ml-auto flex shrink-0 items-center gap-2", className)}>{children}</div>
}
