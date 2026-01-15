import { useState } from "react";
import { DialogSelectProvider } from "@/components/blocks/dialogs/dialog-select-provider";
import { DialogConnectProvider } from "@/components/blocks/dialogs/dialog-connect-provider";

type DialogState =
  | { type: "closed" }
  | { type: "select-provider" }
  | { type: "connect-provider"; providerId: string };

interface AuthSettingsProps {
  trigger?: React.ReactNode;
}

export function AuthSettings({ trigger }: AuthSettingsProps) {
  const [dialogState, setDialogState] = useState<DialogState>({ type: "closed" });

  const handleTriggerClick = () => {
    setDialogState({ type: "select-provider" });
  };

  const handleSelectProvider = (providerId: string) => {
    setDialogState({ type: "connect-provider", providerId });
  };

  const handleBackToSelect = () => {
    setDialogState({ type: "select-provider" });
  };

  const handleClose = () => {
    setDialogState({ type: "closed" });
  };

  const handleSuccess = () => {
    setDialogState({ type: "closed" });
  };

  return (
    <>
      {/* Trigger element */}
      <div onClick={handleTriggerClick}>{trigger}</div>

      {/* Select Provider Dialog */}
      <DialogSelectProvider
        open={dialogState.type === "select-provider"}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
        onSelectProvider={handleSelectProvider}
      />

      {/* Connect Provider Dialog */}
      {dialogState.type === "connect-provider" && (
        <DialogConnectProvider
          open={true}
          onOpenChange={(open) => {
            if (!open) handleClose();
          }}
          providerId={dialogState.providerId}
          onBack={handleBackToSelect}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
