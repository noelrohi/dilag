import { toast } from "sonner";
import type { DesignScreen } from "@/context/session-store";

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

export function downloadHtml(design: DesignScreen | null) {
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

export function downloadAllDesigns(designs: DesignScreen[]) {
  if (designs.length === 0) {
    toast.error("No designs to download");
    return;
  }

  // Download each design as a separate file
  designs.forEach((design, index) => {
    setTimeout(() => downloadHtml(design), index * 100);
  });
}
