import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@dilag/ui/dialog"
import { Input } from "@dilag/ui/input"
import { Button } from "@dilag/ui/button"

interface ScreenNameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  confirmLabel: string
  initialValue: string
  onSubmit: (value: string) => void
}

export function ScreenNameDialog({
  open,
  onOpenChange,
  title,
  confirmLabel,
  initialValue,
  onSubmit,
}: ScreenNameDialogProps) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    if (open) setValue(initialValue)
  }, [open, initialValue])

  const trimmed = value.trim()
  const resultingFilename = trimmed.endsWith(".html") ? trimmed : `${trimmed}.html`

  const handleSubmit = () => {
    if (!trimmed) return
    onSubmit(trimmed)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[400px]"
        // Rendered by canvas screen nodes — stop mouse events from bubbling
        // (through the portal, along the React tree) into React Flow's node
        // handlers. See dialog-code-viewer.tsx for the original bug.
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
        >
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Screen name"
            autoFocus
          />
          {trimmed && (
            <p className="mt-1.5 text-xs text-muted-foreground truncate">
              Will be saved as {resultingFilename}
            </p>
          )}
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!trimmed}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
