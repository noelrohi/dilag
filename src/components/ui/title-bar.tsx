import { useLocation, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { DilagLogo } from "@/components/ui/dilag-logo";
import { Home, ArrowLeft } from "lucide-react";

export function TitleBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";
  const isSettings = location.pathname === "/settings";

  return (
    <div
      data-tauri-drag-region
      className="h-[38px] shrink-0 flex items-center justify-center select-none relative bg-background"
    >
      {/* Left controls - only show on non-home pages */}
      {!isHome && (
        <div className="absolute left-0 top-0 h-full flex items-center pl-[74px]">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => navigate({ to: "/" })}
          >
            {isSettings ? (
              <>
                <ArrowLeft className="size-3.5" />
                <span>Back</span>
              </>
            ) : (
              <Home className="size-3.5" />
            )}
          </Button>
        </div>
      )}

      {/* Centered logo */}
      <DilagLogo className="size-[18px]" />
    </div>
  );
}
