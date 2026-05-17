import { useEffect, useRef } from "react"
import { bridge } from "@/lib/bridge"
import { generatePngToPath } from "@/lib/design-export"
import type { DesignFile } from "./use-designs"
import { getCanonicalGeneratedScreenPath } from "@dilag/desktop-bridge"

/**
 * Auto-generates PNG assets for designs when HTML is newer than PNG
 * Runs in background with debouncing to avoid excessive generation
 */
export function usePngGenerator(
  designs: DesignFile[] | undefined,
  sessionCwd: string | undefined,
  platform: "mobile" | "web" = "mobile",
) {
  const generating = useRef(new Set<string>())

  useEffect(() => {
    if (!designs?.length || !sessionCwd) return

    const dimensions =
      platform === "mobile" ? { width: 393, height: 852 } : { width: 1280, height: 800 }

    const generate = async (design: DesignFile) => {
      const basePath = design.file_path?.replace(/\.html$/, ".png")
      const pngPath =
        basePath ??
        getCanonicalGeneratedScreenPath(sessionCwd, design.filename.replace(".html", ".png"))

      // Skip if already generating (mark immediately to prevent race condition)
      if (generating.current.has(pngPath)) return
      generating.current.add(pngPath)

      try {
        // Check if PNG exists and is newer than HTML
        const pngStat = await bridge.fs.stat(pngPath).catch(() => null)
        if (pngStat && pngStat.mtimeMs >= design.modified_at * 1000) {
          return // PNG is up to date
        }

        await generatePngToPath(design.html, pngPath, dimensions)
      } catch (e) {
        console.error(`Failed to generate PNG for ${design.filename}:`, e)
      } finally {
        generating.current.delete(pngPath)
      }
    }

    // Process designs sequentially to avoid overloading
    const processAll = async () => {
      for (const design of designs) {
        await generate(design)
      }
    }

    // Debounce - wait for idle before generating
    const timeout = setTimeout(processAll, 2000)
    return () => clearTimeout(timeout)
  }, [designs, sessionCwd, platform])
}
