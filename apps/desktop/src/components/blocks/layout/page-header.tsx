import { IconSquarePlus as AddSquare } from "@tabler/icons-react"
import { Button } from "@dilag/ui/button"
import { useSidebar } from "@dilag/ui/sidebar"
import { useNewDesignFlow } from "@/features/new-design/use-new-design-flow"
import { useProjectsList } from "@/hooks/use-projects"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  children?: React.ReactNode
  className?: string
}

export function PageHeader({ children, className }: PageHeaderProps) {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const { data: projects = [] } = useProjectsList()
  const { openNewDesign } = useNewDesignFlow({ projects })

  return (
    <header
      className={cn(
        "h-[44px] shrink-0 flex items-center gap-1 select-none border-b border-border pr-3 transition-[padding] duration-150 ease-out",
        isCollapsed ? "pl-(--titlebar-content-left)" : "pl-3",
        className,
      )}
    >
      {isCollapsed && (
        <Button
          variant="ghost"
          size="icon"
          className="size-6 rounded-md text-muted-foreground hover:text-foreground"
          onClick={openNewDesign}
          aria-label="New design"
          title="New design"
        >
          <AddSquare size={15} />
        </Button>
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
