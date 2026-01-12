import { toast } from "sonner";
import JSZip from "jszip";
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
