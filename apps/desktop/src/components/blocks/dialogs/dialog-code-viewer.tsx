import { File } from "@pierre/diffs/react"
import { Dialog, DialogContent, DialogTitle, DialogTrigger, DialogClose } from "@dilag/ui/dialog"
import { Button } from "@dilag/ui/button"
import { Textarea } from "@dilag/ui/textarea"
import {
  IconCopy as Copy,
  IconCircleCheck as CheckCircle,
  IconDownload as Download,
  IconCircleX as CloseCircle,
  IconPencil as Pencil,
} from "@tabler/icons-react"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { copyToClipboard, downloadHtml } from "@/lib/design-export"
import { bridge } from "@/lib/bridge"
import type { Violation } from "@dilag/desktop-bridge"

interface CodeViewerDialogProps {
  code: string
  title: string
  /**
   * Optional trigger. Omit it (and control `open`/`onOpenChange` instead) when
   * opening from a context-menu item — mounting the dialog inside an open
   * Radix menu leaks dialog interactions into the menu's item handling.
   */
  children?: ReactNode
  /** Controlled open state; pair with `onOpenChange`. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  sessionCwd?: string
  filename?: string
  /** True while the session is busy — disables entering edit mode. */
  readOnly?: boolean
  onSaved?: () => void
}

export function CodeViewerDialog({
  code,
  title,
  children,
  open: controlledOpen,
  onOpenChange,
  sessionCwd,
  filename,
  readOnly,
  onSaved,
}: CodeViewerDialogProps) {
  const canEdit = Boolean(sessionCwd && filename && !readOnly)

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const [copied, setCopied] = useState(false)
  // The view-mode content. Kept in sync with the `code` prop while the dialog
  // is closed, and updated locally on a successful save so the dialog
  // reflects the write immediately (before query invalidation round-trips).
  const [savedCode, setSavedCode] = useState(code)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(code)
  const [isSaving, setIsSaving] = useState(false)
  const [violations, setViolations] = useState<Violation[]>([])

  useEffect(() => {
    if (!open) setSavedCode(code)
  }, [code, open])

  const isDirty = draft !== savedCode
  const displayCode = isEditing ? draft : savedCode

  const resetEditState = useCallback(() => {
    setIsEditing(false)
    setDraft(savedCode)
    setViolations([])
  }, [savedCode])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isEditing && isDirty) {
        if (!window.confirm("Discard unsaved changes?")) return
      }
      if (!nextOpen) resetEditState()
      setOpen(nextOpen)
    },
    [isEditing, isDirty, resetEditState, setOpen],
  )

  const handleCopy = useCallback(() => {
    copyToClipboard(displayCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [displayCode])

  const handleDownload = useCallback(() => {
    downloadHtml({ html: displayCode, title })
  }, [displayCode, title])

  const handleEdit = useCallback(() => {
    setDraft(savedCode)
    setViolations([])
    setIsEditing(true)
  }, [savedCode])

  const handleCancel = useCallback(() => {
    if (isDirty && !window.confirm("Discard unsaved changes?")) return
    resetEditState()
  }, [isDirty, resetEditState])

  const handleSave = useCallback(async () => {
    if (!sessionCwd || !filename) return
    setIsSaving(true)
    try {
      const result = await bridge.designs.write({ sessionCwd, filename, html: draft })
      if (result.ok) {
        setSavedCode(draft)
        setIsEditing(false)
        setViolations([])
        onSaved?.()
      } else if (result.violations && result.violations.length > 0) {
        setViolations(result.violations)
      } else {
        toast.error(result.reason)
      }
    } finally {
      setIsSaving(false)
    }
  }, [sessionCwd, filename, draft, onSaved])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children !== undefined && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent
        className="max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0"
        showCloseButton={false}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
          <DialogTitle className="text-sm font-medium truncate">{title}</DialogTitle>
          <div className="flex items-center gap-0.5">
            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => void handleSave()}
                  disabled={!isDirty || isSaving}
                >
                  Save
                </Button>
                <div className="w-px h-4 bg-border mx-1" />
              </>
            ) : (
              canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  onClick={handleEdit}
                >
                  <Pencil size={14} />
                </Button>
              )
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
            >
              {copied ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={handleDownload}
            >
              <Download size={14} />
            </Button>
            <div className="w-px h-4 bg-border mx-1" />
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
              >
                <CloseCircle size={14} />
              </Button>
            </DialogClose>
          </div>
        </div>
        {violations.length > 0 && (
          <div className="px-4 py-2 border-b bg-destructive/5 space-y-1">
            {violations.map((violation, index) => (
              <p key={index} className="text-xs text-destructive">
                <span className="font-medium">{violation.rule}</span>:{" "}
                <span>{violation.snippet}</span>
              </p>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-auto min-h-0 flex flex-col">
          {isEditing ? (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="flex-1 min-h-[50vh] rounded-none border-0 font-mono text-xs resize-none focus-visible:ring-0"
            />
          ) : (
            <File
              file={{ name: `${title}.html`, contents: displayCode, lang: "html" }}
              options={{
                disableFileHeader: true,
                overflow: "scroll",
                theme: { light: "one-light", dark: "one-dark-pro" },
              }}
              className="text-xs [&_pre]:!bg-transparent [&_pre]:!p-4"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
