import { toast } from "sonner";
import JSZip from "jszip";
import html2canvas from "html2canvas-pro";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { DesignFile } from "@/hooks/use-designs";

export function copyToClipboard(html: string | undefined) {
  if (!html) {
    toast.error("No content to copy");
    return;
  }
  navigator.clipboard.writeText(html);
  toast.success("Copied to clipboard");
}

export function copyFilePath(path: string) {
  navigator.clipboard.writeText(path);
  toast.success("Path copied to clipboard");
}

export function downloadHtml(design: { html: string; title: string } | null) {
  if (!design) {
    toast.error("No design to download");
    return;
  }

  const blob = new Blob([design.html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // Use title as filename, convert to kebab-case
  const filename = design.title.toLowerCase().replace(/\s+/g, "-") + ".html";
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  toast.success(`Downloaded ${filename}`);
}

export function downloadAllDesigns(designs: DesignFile[]) {
  if (designs.length === 0) {
    toast.error("No designs to download");
    return;
  }

  // Download each design as a separate file
  designs.forEach((design, index) => {
    setTimeout(() => downloadHtml(design), index * 100);
  });
}

export async function downloadAsZip(designs: DesignFile[], zipName = "designs") {
  if (designs.length === 0) {
    toast.error("No designs to export");
    return;
  }

  const zip = new JSZip();

  // Add each design as an HTML file
  designs.forEach((design) => {
    const filename = design.title.toLowerCase().replace(/\s+/g, "-") + ".html";
    zip.file(filename, design.html);
  });

  try {
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${zipName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${designs.length} screen${designs.length > 1 ? "s" : ""} to ${zipName}.zip`);
  } catch (err) {
    toast.error(`Failed to create zip: ${err}`);
  }
}

export function copyMultipleAsHtml(designs: DesignFile[]) {
  if (designs.length === 0) {
    toast.error("No designs to copy");
    return;
  }

  // Join all HTML with separators
  const combined = designs
    .map((d) => `<!-- ${d.title} -->\n${d.html}`)
    .join("\n\n");

  navigator.clipboard.writeText(combined);
  toast.success(`Copied ${designs.length} screen${designs.length > 1 ? "s" : ""} to clipboard`);
}

interface RenderOptions {
  html: string;
  width?: number;
  height?: number;
  scale?: number;
}

const CAPTURE_CSS = `<style>*,*::before,*::after{animation:none!important;transition:none!important}[class*="animate-"],[class*="delay-"]{opacity:1!important;transform:none!important}</style>`;

/**
 * Render HTML to PNG bytes using html2canvas-pro
 */
export async function renderHtmlToPng({
  html,
  width = 393,
  height = 852,
  scale = 2,
}: RenderOptions): Promise<Uint8Array> {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = `position:fixed;left:-9999px;width:${width}px;height:${height}px;border:none;opacity:0;pointer-events:none`;
  document.body.appendChild(iframe);

  try {
    iframe.contentDocument?.open();
    iframe.contentDocument?.write(html.replace("</head>", `${CAPTURE_CSS}</head>`));
    iframe.contentDocument?.close();

    await iframe.contentDocument?.fonts?.ready?.catch(() => {});
    // Brief delay for layout/paint to settle after fonts load
    await new Promise((r) => setTimeout(r, 500));

    const canvas = await html2canvas(iframe.contentDocument!.body, {
      width,
      height,
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
    });

    const base64 = canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  } finally {
    iframe.remove();
  }
}

/**
 * Generate PNG to a specific path (no dialog)
 */
export async function generatePngToPath(
  html: string,
  outputPath: string,
  options?: Omit<RenderOptions, "html">
): Promise<void> {
  const bytes = await renderHtmlToPng({ html, ...options });
  await writeFile(outputPath, bytes);
}

/**
 * Export PNG with native save dialog
 */
export async function exportAsPng({
  html,
  title,
  width = 393,
  height = 852,
  scale = 2,
}: RenderOptions & { title: string }): Promise<void> {
  const filename = title.toLowerCase().replace(/\s+/g, "-") + ".png";
  const filePath = await save({
    defaultPath: filename,
    filters: [{ name: "PNG Image", extensions: ["png"] }],
  });

  if (!filePath) return;

  const toastId = toast.loading("Generating PNG...");
  try {
    await generatePngToPath(html, filePath, { width, height, scale });
    toast.success(`Saved ${filePath.split("/").pop()}`, { id: toastId });
  } catch (error) {
    console.error("PNG export failed:", error);
    toast.error(`Export failed: ${error instanceof Error ? error.message : "Unknown error"}`, { id: toastId });
  }
}

interface ExportImagesOptions {
  designs: DesignFile[];
  sessionName?: string;
  platform?: "mobile" | "web";
}

/**
 * Export designs as PNG images to user-selected folder
 */
export async function exportImages({
  designs,
  sessionName = "designs",
  platform = "mobile",
}: ExportImagesOptions): Promise<void> {
  if (designs.length === 0) {
    toast.error("No designs to export");
    return;
  }

  // Ask user for save location
  const zipName = `${sessionName}.zip`;
  const filePath = await save({
    defaultPath: zipName,
    filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
  });

  if (!filePath) return;

  const dimensions =
    platform === "mobile"
      ? { width: 393, height: 852 }
      : { width: 1280, height: 800 };

  const toastId = toast.loading(`Generating ${designs.length} images...`);
  const zip = new JSZip();
  
  // Create a folder inside the zip with the session name
  const folder = zip.folder(sessionName);
  if (!folder) {
    toast.error("Failed to create zip folder", { id: toastId });
    return;
  }

  try {
    for (let i = 0; i < designs.length; i++) {
      const design = designs[i];
      toast.loading(`Rendering ${i + 1}/${designs.length}: ${design.title}`, { id: toastId });
      
      const bytes = await renderHtmlToPng({
        html: design.html,
        ...dimensions,
        scale: 2,
      });
      
      const filename = design.title.toLowerCase().replace(/\s+/g, "-") + ".png";
      folder.file(filename, bytes);
    }

    toast.loading("Saving...", { id: toastId });
    const blob = await zip.generateAsync({ type: "blob" });
    const buffer = await blob.arrayBuffer();
    await writeFile(filePath, new Uint8Array(buffer));

    toast.success(`Exported ${designs.length} images`, { id: toastId });
  } catch (error) {
    console.error("Image export failed:", error);
    toast.error(`Export failed: ${error instanceof Error ? error.message : "Unknown error"}`, { id: toastId });
  }
}
