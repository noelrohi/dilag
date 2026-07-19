import { IconPalette as Palette } from "@tabler/icons-react"
import { DilagIcon } from "@/components/blocks/branding/dilag-icon"

export function CanvasEmptyState({ isLoading }: { isLoading?: boolean }) {
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="relative size-20 rounded-2xl bg-primary/10 mx-auto flex items-center justify-center mb-4">
            <div className="absolute inset-0 rounded-2xl bg-primary/5 animate-pulse" />
            <DilagIcon animated className="size-10 text-primary" />
          </div>
          <h3 className="font-semibold text-lg">Designing your screens...</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Your screens will appear here as they&apos;re created
          </p>
          <div className="flex gap-1.5 justify-center pt-1">
            <span className="size-1.5 rounded-full bg-primary/50 animate-pulse [animation-delay:0ms]" />
            <span className="size-1.5 rounded-full bg-primary/50 animate-pulse [animation-delay:300ms]" />
            <span className="size-1.5 rounded-full bg-primary/50 animate-pulse [animation-delay:600ms]" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="size-20 rounded-2xl bg-primary/10 mx-auto flex items-center justify-center mb-4">
          <Palette size={40} className="text-primary/60" />
        </div>
        <h3 className="font-semibold text-lg">No screens yet</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Describe what you want to design in the chat and screens will appear here
        </p>
      </div>
    </div>
  )
}
