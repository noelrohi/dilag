import { cn } from "@/lib/utils";

export function DilagLogo({
  className,
  solid = false,
}: {
  className?: string;
  solid?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      className={cn("shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="0"
        y="0"
        width="1024"
        height="1024"
        rx="227"
        className={cn(
          solid ? "fill-background" : "fill-foreground/10 dark:fill-foreground/5",
        )}
      />
      <rect
        x="198"
        y="248"
        width="230"
        height="528"
        rx="36"
        fill="none"
        className="stroke-foreground/20 dark:stroke-foreground/15"
        strokeWidth="18"
      />
      <path
        d="M512 248 C696 248, 826 372, 826 512 C826 652, 696 776, 512 776 L512 248 Z"
        className="fill-foreground"
      />
    </svg>
  );
}
