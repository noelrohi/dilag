import { cn } from "@/lib/utils";

interface IPhoneFrameProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Visual iPhone 14 Pro bezel frame
 * Content area: 260x552px (scaled from 393x852 at ~0.66x)
 */
export function IPhoneFrame({ children, className }: IPhoneFrameProps) {
  return (
    <div
      className={cn(
        "relative w-[280px] h-[572px] bg-[#1a1a1a] rounded-[44px] p-[10px] shadow-xl",
        // Outer highlight for realism
        "ring-1 ring-[#333] ring-inset",
        className
      )}
    >
      {/* Side button - right */}
      <div className="absolute -right-[2px] top-[120px] w-[3px] h-[32px] bg-[#1a1a1a] rounded-r-sm" />
      <div className="absolute -right-[2px] top-[170px] w-[3px] h-[60px] bg-[#1a1a1a] rounded-r-sm" />

      {/* Side buttons - left */}
      <div className="absolute -left-[2px] top-[100px] w-[3px] h-[28px] bg-[#1a1a1a] rounded-l-sm" />
      <div className="absolute -left-[2px] top-[145px] w-[3px] h-[50px] bg-[#1a1a1a] rounded-l-sm" />
      <div className="absolute -left-[2px] top-[205px] w-[3px] h-[50px] bg-[#1a1a1a] rounded-l-sm" />

      {/* Screen - 260x552px content area */}
      <div className="relative w-[260px] h-[552px] bg-black rounded-[34px] overflow-hidden">
        {children}
      </div>
    </div>
  );
}
