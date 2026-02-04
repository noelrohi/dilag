"use client";

import { Button } from "@dilag/ui/button";
import { Separator } from "@dilag/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@dilag/ui/tooltip";
import { cn } from "@/lib/utils";
import { Bookmark } from "@solar-icons/react";
import type { ComponentProps, HTMLAttributes } from "react";

export type CheckpointProps = HTMLAttributes<HTMLDivElement>;

export const Checkpoint = ({
  className,
  children,
  ...props
}: CheckpointProps) => (
  <div
    className={cn("flex items-center gap-0.5 text-muted-foreground overflow-hidden", className)}
    {...props}
  >
    {children}
    <Separator />
  </div>
);

export type CheckpointIconProps = React.SVGProps<SVGSVGElement> & { size?: number };

export const CheckpointIcon = ({
  className,
  children,
  size = 16,
  ...props
}: CheckpointIconProps) =>
  children ?? (
    <Bookmark size={size} className={cn("shrink-0", className)} {...props} />
  );

export type CheckpointTriggerProps = ComponentProps<typeof Button> & {
  tooltip?: string;
};

export const CheckpointTrigger = ({
  children,
  className,
  variant = "ghost",
  size = "sm",
  tooltip,
  ...props
}: CheckpointTriggerProps) =>
  tooltip ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size={size} type="button" variant={variant} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent align="start" side="bottom">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  ) : (
    <Button size={size} type="button" variant={variant} {...props}>
      {children}
    </Button>
  );
