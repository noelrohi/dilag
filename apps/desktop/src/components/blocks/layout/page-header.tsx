import { SidebarTrigger, useSidebar } from "@dilag/ui/sidebar"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  children?: React.ReactNode
  className?: string
}

export function PageHeader({ children, className }: PageHeaderProps) {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <header
      className={cn(
        "h-[42px] pt-1 shrink-0 flex items-center gap-2 select-none border-b border-border pr-3",
        isCollapsed ? "pl-[74px]" : "pl-3",
        className,
      )}
    >
      {isCollapsed && (
        <SidebarTrigger
          className="-ml-1 size-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Open sidebar"
        />
      )}
      {children}
    </header>
  )
}

interface PageHeaderLeftProps {
  children?: React.ReactNode
  className?: string
}

export function PageHeaderLeft({ children, className }: PageHeaderLeftProps) {
  return <div className={cn("flex items-center gap-2", className)}>{children}</div>
}

interface PageHeaderRightProps {
  children?: React.ReactNode
  className?: string
}

export function PageHeaderRight({ children, className }: PageHeaderRightProps) {
  return <div className={cn("flex items-center gap-2 ml-auto", className)}>{children}</div>
}
