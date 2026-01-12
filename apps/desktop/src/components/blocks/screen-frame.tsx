import { cn } from "@/lib/utils";
import { MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ScreenFrameProps {
  title: string;
  children: React.ReactNode;
  onDelete?: () => void;
  className?: string;
}

export function ScreenFrame({
  title,
  children,
  onDelete,
  className,
}: ScreenFrameProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      {/* Figma-style title above frame */}
      <div className="flex items-center justify-between mb-2 px-0.5 group">
        <span className="text-xs text-muted-foreground font-medium truncate max-w-[200px]">
          {title}
        </span>
        {onDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1 rounded hover:bg-secondary/80 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4 mr-2" />
                Delete screen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Frame content */}
      {children}
    </div>
  );
}
