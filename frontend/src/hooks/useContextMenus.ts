import { useRef, useState } from 'react';
import type { TrashEntry } from '../api/client';
import type { DesktopIconItem } from '../pages/DesktopView';
import type { ServiceShortcut } from '../utils/services';

export interface ContextMenus {
  trashContextMenu: { x: number; y: number; entry: TrashEntry } | null;
  setTrashContextMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number; entry: TrashEntry } | null>>;
  desktopContextMenu: { x: number; y: number; item: DesktopIconItem } | null;
  setDesktopContextMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number; item: DesktopIconItem } | null>>;
  filesEmptyMenu: { x: number; y: number } | null;
  setFilesEmptyMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  trashEmptyMenu: { x: number; y: number } | null;
  setTrashEmptyMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  jobsEmptyMenu: { x: number; y: number } | null;
  setJobsEmptyMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  serviceFormData: { initial?: ServiceShortcut } | null;
  setServiceFormData: React.Dispatch<React.SetStateAction<{ initial?: ServiceShortcut } | null>>;
  emptyMenuBlockedRef: React.MutableRefObject<boolean>;
}

export function useContextMenus(): ContextMenus {
  const [trashContextMenu, setTrashContextMenu] = useState<{ x: number; y: number; entry: TrashEntry } | null>(null);
  const [desktopContextMenu, setDesktopContextMenu] = useState<{ x: number; y: number; item: DesktopIconItem } | null>(null);
  const [filesEmptyMenu, setFilesEmptyMenu] = useState<{ x: number; y: number } | null>(null);
  const [trashEmptyMenu, setTrashEmptyMenu] = useState<{ x: number; y: number } | null>(null);
  const [jobsEmptyMenu, setJobsEmptyMenu] = useState<{ x: number; y: number } | null>(null);
  const [serviceFormData, setServiceFormData] = useState<{ initial?: ServiceShortcut } | null>(null);
  const emptyMenuBlockedRef = useRef(false);

  return {
    trashContextMenu, setTrashContextMenu,
    desktopContextMenu, setDesktopContextMenu,
    filesEmptyMenu, setFilesEmptyMenu,
    trashEmptyMenu, setTrashEmptyMenu,
    jobsEmptyMenu, setJobsEmptyMenu,
    serviceFormData, setServiceFormData,
    emptyMenuBlockedRef,
  };
}
