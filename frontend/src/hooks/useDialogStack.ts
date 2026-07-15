import { useState } from 'react';
import type { ConfirmDialogState } from '../components/overlay/ConfirmDialog';
import type { TextInputDialogState } from '../components/overlay/TextInputDialog';
import type { TransferDialogState } from '../components/overlay/TransferDialog';

export function useDialogStack() {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
  const [textInputDialog, setTextInputDialog] = useState<TextInputDialogState>(null);
  const [transferDialog, setTransferDialog] = useState<TransferDialogState>(null);
  const [shareDialogPath, setShareDialogPath] = useState<{ path: string; name: string } | null>(
    null,
  );
  const [sharesOpen, setSharesOpen] = useState(false);

  return {
    confirmDialog,
    setConfirmDialog,
    textInputDialog,
    setTextInputDialog,
    transferDialog,
    setTransferDialog,
    shareDialogPath,
    setShareDialogPath,
    sharesOpen,
    setSharesOpen,
  };
}
