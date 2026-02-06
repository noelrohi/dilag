import { cn } from "@/lib/utils";

interface IPhoneFrameProps {
  children: React.ReactNode;
  className?: string;
  screenClassName?: string;
}

/**
 * Visual iPhone 14 Pro bezel frame
 * Content area: 260px wide (scaled from 393 at ~0.66x)
 */
export function IPhoneFrame({ children, className, screenClassName }: IPhoneFrameProps) {
  return (
    <div
      className={cn(
        "relative w-[280px] bg-[#1a1a1a] rounded-[44px] p-[10px] shadow-xl",
        // Outer highlight for realism
        "ring-1 ring-[#333] ring-inset",
        className
      )}
      style={{ aspectRatio: "280 / 572" }}
    >
      {/* Side button - right */}
      <div className="absolute -right-[2px] top-[120px] w-[3px] h-[32px] bg-[#1a1a1a] rounded-r-sm" />
      <div className="absolute -right-[2px] top-[170px] w-[3px] h-[60px] bg-[#1a1a1a] rounded-r-sm" />

      {/* Side buttons - left */}
      <div className="absolute -left-[2px] top-[100px] w-[3px] h-[28px] bg-[#1a1a1a] rounded-l-sm" />
      <div className="absolute -left-[2px] top-[145px] w-[3px] h-[50px] bg-[#1a1a1a] rounded-l-sm" />
      <div className="absolute -left-[2px] top-[205px] w-[3px] h-[50px] bg-[#1a1a1a] rounded-l-sm" />

      {/* Screen - 260px wide content area with iPhone aspect ratio */}
      <div
        className={cn(
          "relative w-[260px] bg-black rounded-[34px] overflow-visible",
          screenClassName
        )}
        style={{ aspectRatio: "393 / 852" }}
      >
        {children}
      </div>
    </div>
  );
}
