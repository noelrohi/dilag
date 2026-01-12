/**
 * Creates a simple placeholder image for a design
 * This is more reliable than trying to capture complex HTML
 */
function createPlaceholderBlob(
  title: string,
  width: number,
  height: number
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  // Background
  ctx.fillStyle = "#f8f9fa";
  ctx.fillRect(0, 0, width, height);

  // Border
  ctx.strokeStyle = "#e9ecef";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // Icon placeholder
  const iconSize = Math.min(width, height) * 0.15;
  const centerX = width / 2;
  const centerY = height / 2 - 20;

  ctx.fillStyle = "#dee2e6";
  ctx.beginPath();
  ctx.roundRect(centerX - iconSize / 2, centerY - iconSize / 2, iconSize, iconSize, 8);
  ctx.fill();

  // Title text
  ctx.fillStyle = "#495057";
  ctx.font = `500 ${Math.max(12, width * 0.025)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  // Truncate title if too long
  const maxWidth = width * 0.8;
  let displayTitle = title;
  while (ctx.measureText(displayTitle).width > maxWidth && displayTitle.length > 10) {
    displayTitle = displayTitle.slice(0, -4) + "...";
  }
  ctx.fillText(displayTitle, centerX, centerY + iconSize / 2 + 30);

  // "Screen" label
  ctx.fillStyle = "#adb5bd";
  ctx.font = `400 ${Math.max(10, width * 0.018)}px system-ui, sans-serif`;
  ctx.fillText("Design Screen", centerX, centerY + iconSize / 2 + 50);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to create placeholder blob"));
      },
      "image/png",
      0.9
    );
  });
}

/**
 * Renders HTML string to an image blob
 * Falls back to a placeholder if capture fails
 */
export async function htmlToImageBlob(
  html: string,
  options: {
    width?: number;
    height?: number;
    scale?: number;
    title?: string;
  } = {}
): Promise<Blob> {
  const { width = 1280, height = 800, scale = 0.5, title = "Screen" } = options;
  const scaledWidth = Math.round(width * scale);
  const scaledHeight = Math.round(height * scale);

  try {
    // Try dynamic import of html2canvas
    const html2canvas = (await import("html2canvas")).default;

    // Create a hidden container
    const container = document.createElement("div");
    container.style.cssText = `
      position: fixed;
      left: -9999px;
      top: 0;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: white;
    `;

    // Create iframe to render HTML
    const iframe = document.createElement("iframe");
    iframe.style.cssText = `
      width: ${width}px;
      height: ${height}px;
      border: none;
      background: white;
    `;

    container.appendChild(iframe);
    document.body.appendChild(container);

    try {
      // Write HTML to iframe
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error("Could not access iframe document");

      // Strip problematic CSS color functions before rendering
      const sanitizedHtml = html
        .replace(/oklab\([^)]+\)/gi, "#888888")
        .replace(/oklch\([^)]+\)/gi, "#888888")
        .replace(/color\([^)]+\)/gi, "#888888");

      iframeDoc.open();
      iframeDoc.write(sanitizedHtml);
      iframeDoc.close();

      // Wait for iframe to load
      await new Promise((resolve) => {
        iframe.onload = resolve;
        setTimeout(resolve, 500);
      });

      // Wait for Tailwind CDN to compile (it needs time to fetch, parse, and apply styles)
      // Check for Tailwind's style injection or just wait
      await new Promise<void>((resolve) => {
        let attempts = 0;
        const maxAttempts = 30; // 3 seconds max
        
        const checkReady = () => {
          attempts++;
          const iframeWin = iframe.contentWindow as Window & { tailwind?: unknown };
          const hasTailwind = iframeWin?.tailwind !== undefined;
          const hasStyles = iframeDoc.head?.querySelectorAll('style').length > 0;
          
          if ((hasTailwind && hasStyles) || attempts >= maxAttempts) {
            // Give a bit more time for final rendering
            setTimeout(resolve, 200);
          } else {
            setTimeout(checkReady, 100);
          }
        };
        
        checkReady();
      });

      // Capture with html2canvas
      const canvas = await html2canvas(iframeDoc.body, {
        width,
        height,
        scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        removeContainer: true,
      });

      // Convert to blob
      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to create blob"));
          },
          "image/png",
          0.9
        );
      });
    } finally {
      document.body.removeChild(container);
    }
  } catch (err) {
    console.warn("html2canvas failed, using placeholder:", err);
    // Fall back to placeholder
    return createPlaceholderBlob(title, scaledWidth, scaledHeight);
  }
}

/**
 * Converts HTML to a File object suitable for attachments
 */
export async function htmlToImageFile(
  html: string,
  filename: string,
  options?: {
    width?: number;
    height?: number;
    scale?: number;
  }
): Promise<File> {
  const blob = await htmlToImageBlob(html, { ...options, title: filename });
  return new File([blob], `${filename}.png`, { type: "image/png" });
}

/**
 * Converts HTML to a base64 data URL
 */
export async function htmlToBase64(
  html: string,
  options?: {
    width?: number;
    height?: number;
    scale?: number;
  }
): Promise<string> {
  const blob = await htmlToImageBlob(html, options);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
