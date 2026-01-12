import { File } from "@pierre/diffs/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, Download, X } from "lucide-react";
import { useState, useCallback, type ReactNode } from "react";
import { copyToClipboard, downloadHtml } from "@/lib/design-export";

interface CodeViewerDialogProps {
  code: string;
  title: string;
  children: ReactNode;
}

export function CodeViewerDialog({
  code,
  title,
  children,
}: CodeViewerDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleDownload = useCallback(() => {
    downloadHtml({ html: code, title });
  }, [code, title]);

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0"
        showCloseButton={false}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
          <DialogTitle className="text-sm font-medium truncate">
            {title}
          </DialogTitle>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="size-3.5 text-green-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={handleDownload}
            >
              <Download className="size-3.5" />
            </Button>
            <div className="w-px h-4 bg-border mx-1" />
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </Button>
            </DialogClose>
          </div>
        </div>
        <div className="flex-1 overflow-auto min-h-0">
          <File
            file={{ name: `${title}.html`, contents: code, lang: "html" }}
            options={{
              disableFileHeader: true,
              overflow: "scroll",
              theme: { light: "one-light", dark: "one-dark-pro" },
            }}
            className="text-xs [&_pre]:!bg-transparent [&_pre]:!p-4"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
