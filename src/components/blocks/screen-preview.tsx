import { Loader2 } from "lucide-react";
import { useMemo } from "react";

// Render at iPhone 14 Pro logical resolution, scale down to fit frame
const RENDER_WIDTH = 393;
const RENDER_HEIGHT = 852;
const DISPLAY_WIDTH = 260;
const DISPLAY_HEIGHT = 552;
const SCALE = DISPLAY_WIDTH / RENDER_WIDTH; // ~0.66

export interface ScreenData {
  id: string;
  name: string;
  html: string;
  status: "generating" | "streaming" | "success" | "error";
  error?: string;
}

interface ScreenPreviewProps {
  screen: ScreenData;
}

export function ScreenPreview({ screen }: ScreenPreviewProps) {
  // Build the srcDoc for the iframe
  const srcDoc = useMemo(() => {
    if (!screen.html) return null;

    // If already a complete HTML document, inject our sizing styles
    if (screen.html.includes("<!DOCTYPE") || screen.html.includes("<html")) {
      // Inject sizing CSS into existing HTML for the render size
      const sizingCSS = `
        <style id="preview-sizing">
          html, body {
            width: ${RENDER_WIDTH}px !important;
            height: ${RENDER_HEIGHT}px !important;
            max-width: ${RENDER_WIDTH}px !important;
            max-height: ${RENDER_HEIGHT}px !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        </style>
      `;
      // Insert before </head> if possible, otherwise at start
      if (screen.html.includes("</head>")) {
        return screen.html.replace("</head>", `${sizingCSS}</head>`);
      }
      return sizingCSS + screen.html;
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=${RENDER_WIDTH}, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${RENDER_WIDTH}px;
      height: ${RENDER_HEIGHT}px;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
  </style>
</head>
<body>
${screen.html}
</body>
</html>`;
  }, [screen.html]);

  // Show loading state while generating
  if (screen.status === "generating" || !srcDoc) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/50">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
          <span className="text-xs">Generating...</span>
        </div>
      </div>
    );
  }

  // Show error state
  if (screen.status === "error") {
    return (
      <div className="w-full h-full flex items-center justify-center bg-destructive/10">
        <div className="flex flex-col items-center gap-2 text-destructive">
          <span className="text-sm font-medium">Error</span>
          <span className="text-xs">{screen.error || "Failed to generate"}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: DISPLAY_WIDTH,
        height: DISPLAY_HEIGHT,
        overflow: "hidden"
      }}
    >
      <iframe
        srcDoc={srcDoc}
        title={screen.name}
        className="border-0 origin-top-left"
        style={{
          width: RENDER_WIDTH,
          height: RENDER_HEIGHT,
          transform: `scale(${SCALE})`,
        }}
        sandbox="allow-scripts"
      />
    </div>
  );
}
