import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useUpdater } from "@/hooks/use-updater";
import { Download, Sparkles } from "lucide-react";

export function UpdateDialog() {
  const {
    updateAvailable,
    updateInfo,
    downloading,
    downloadProgress,
    installUpdate,
    dismissUpdate,
  } = useUpdater();

  if (!updateAvailable || !updateInfo) {
    return null;
  }

  return (
    <Dialog open={updateAvailable} onOpenChange={(open) => !open && dismissUpdate()}>
      <DialogContent showCloseButton={!downloading}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Update Available
          </DialogTitle>
          <DialogDescription>
            A new version of Dilag is ready to install.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Current version</span>
            <span className="font-mono">v{updateInfo.currentVersion}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">New version</span>
            <span className="font-mono text-primary">v{updateInfo.version}</span>
          </div>

          {downloading && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Downloading...</span>
                <span className="font-mono">{downloadProgress}%</span>
              </div>
              <Progress value={downloadProgress} className="h-2" />
            </div>
          )}
        </div>

        <DialogFooter>
          {!downloading ? (
            <>
              <Button variant="outline" onClick={dismissUpdate}>
                Later
              </Button>
              <Button onClick={installUpdate}>
                <Download className="size-4" />
                Update Now
              </Button>
            </>
          ) : (
            <Button disabled>
              Installing...
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
