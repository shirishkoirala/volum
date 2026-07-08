import { useState } from 'react';
import type {
  ConfirmDialogState,
  TextInputDialogState,
  TransferDialogState,
} from '../components/overlay/Dialogs';

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
