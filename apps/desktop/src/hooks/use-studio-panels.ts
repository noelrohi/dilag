import { useCallback, useEffect, useRef, useState } from "react"
import type { ImperativePanelHandle } from "react-resizable-panels"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useChatWidth } from "@/hooks/use-chat-width"

interface StudioPanelsState {
  chatCollapsed: boolean
  canvasOpen: boolean
  setChatCollapsed: (chatCollapsed: boolean) => void
  setCanvasOpen: (canvasOpen: boolean) => void
}

/**
 * Panel layout shared by the new-session composer and the studio. Persisted so
 * toggling the titlebar controls on either page carries into the next session.
 */
export const useStudioPanels = create<StudioPanelsState>()(
  persist(
    (set) => ({
      chatCollapsed: false,
      canvasOpen: true,
      setChatCollapsed: (chatCollapsed) => set({ chatCollapsed }),
      setCanvasOpen: (canvasOpen) => set({ canvasOpen }),
    }),
    { name: "dilag-studio-panels" },
  ),
)

/**
 * Full chat/canvas panel behavior for pages that render the studio layout:
 * panel refs, collapse/expand toggles, toggle animation, and mount sizes.
 * Both the studio session page and the new-session composer page use this so
 * the titlebar panel controls behave identically on each.
 */
export function useStudioPanelLayout() {
  const { canvasOpen, chatCollapsed, setCanvasOpen, setChatCollapsed } = useStudioPanels()
  const chatPanelRef = useRef<ImperativePanelHandle>(null)
  const canvasPanelRef = useRef<ImperativePanelHandle>(null)
  const { size: chatSize, updateSize, minSize } = useChatWidth()

  // Animate panel sizes only for button/menu toggles, never while dragging the
  // handle — a transition during drag would make resizing feel laggy.
  const [isPanelAnimating, setIsPanelAnimating] = useState(false)
  const panelAnimationTimeout = useRef<number | null>(null)

  const animatePanels = useCallback(() => {
    setIsPanelAnimating(true)
    if (panelAnimationTimeout.current) {
      window.clearTimeout(panelAnimationTimeout.current)
    }
    panelAnimationTimeout.current = window.setTimeout(() => setIsPanelAnimating(false), 300)
  }, [])

  useEffect(
    () => () => {
      if (panelAnimationTimeout.current) {
        window.clearTimeout(panelAnimationTimeout.current)
      }
    },
    [],
  )

  const panelAnimationClass = isPanelAnimating
    ? "transition-[flex-grow] duration-[250ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
    : undefined

  const toggleChatPanel = useCallback(() => {
    const panel = chatPanelRef.current
    if (!panel) return

    animatePanels()

    if (panel.isCollapsed()) {
      panel.expand(minSize)
      requestAnimationFrame(() => panel.resize(Math.max(chatSize, minSize)))
      return
    }

    // Collapsing the chat while the canvas is hidden would leave an empty window.
    if (!canvasOpen) return

    const currentSize = panel.getSize()
    if (currentSize > 0) {
      updateSize(currentSize)
    }
    panel.collapse()
  }, [chatSize, minSize, updateSize, canvasOpen, animatePanels])

  const toggleCanvasPanel = useCallback(() => {
    const canvasPanel = canvasPanelRef.current
    if (!canvasPanel) return

    animatePanels()

    if (canvasOpen) {
      const chatPanel = chatPanelRef.current
      if (chatPanel?.isCollapsed()) {
        chatPanel.expand(minSize)
      }
      canvasPanel.collapse()
      return
    }

    const nextChatSize = Math.min(Math.max(chatSize, minSize), 50)
    canvasPanel.expand(100 - nextChatSize)
    requestAnimationFrame(() => canvasPanel.resize(100 - nextChatSize))
  }, [canvasOpen, chatSize, minSize, animatePanels])

  // Expand the canvas to full width (collapsing the chat), or restore the chat.
  const toggleExpandCanvas = useCallback(() => {
    const chatPanel = chatPanelRef.current
    const canvasPanel = canvasPanelRef.current
    if (!chatPanel || !canvasPanel) return

    animatePanels()

    if (chatPanel.isCollapsed()) {
      chatPanel.expand(minSize)
      requestAnimationFrame(() => chatPanel.resize(Math.max(Math.min(chatSize, 50), minSize)))
      return
    }

    const currentSize = chatPanel.getSize()
    if (currentSize > 0) {
      updateSize(currentSize)
    }
    if (canvasPanel.isCollapsed()) {
      canvasPanel.expand()
    }
    chatPanel.collapse()
  }, [chatSize, minSize, updateSize, animatePanels])

  // Mount sizes that honor the persisted layout. Only read on first render;
  // afterwards the imperative panel handles own the sizes.
  const chatDefaultSize = !canvasOpen ? 100 : chatCollapsed ? 0 : Math.min(chatSize, 50)
  const canvasDefaultSize = 100 - chatDefaultSize

  return {
    chatPanelRef,
    canvasPanelRef,
    canvasOpen,
    chatCollapsed,
    setCanvasOpen,
    setChatCollapsed,
    updateSize,
    minSize,
    panelAnimationClass,
    toggleChatPanel,
    toggleCanvasPanel,
    toggleExpandCanvas,
    chatDefaultSize,
    canvasDefaultSize,
  }
}
