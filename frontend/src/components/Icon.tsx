import type { FileEntry } from '../api/client';
import {
  Archive, ChevronRight, CheckSquare, Clipboard, Copy, Download,
  Eye, EyeOff, FileInput, FolderPlus, Grid3X3, Info,
  ListTree, LogOut, ListX, Pause, Pencil, Play, RefreshCw, RotateCcw,
  Scissors, Search, Square, Trash2, Upload, X, type LucideIcon,
} from 'lucide-react';
import { fileTypeIconUrl, folderIconUrl, driveIconUrl } from '../api/icons';

type IconProps = { name: string; size?: number; className?: string };

const ACTION_ICONS: Record<string, LucideIcon> = {
  'archive-create': Archive,
  'archive-extract': Archive,
  'dialog-information': Info,
  'document-import': Upload,
  'document-open': FileInput,
  'edit-copy': Copy,
  'edit-cut': Scissors,
  'edit-delete': Trash2,
  'edit-download': Download,
  'edit-find': Search,
  'edit-paste': Clipboard,
  'edit-rename': Pencil,
  'folder-new': FolderPlus,
  'go-next': ChevronRight,
  'selection-invert': ListX,
  'selection-select-all': CheckSquare,
  'media-playback-pause': Pause,
  'media-playback-start': Play,
  'process-stop': Square,
  'system-log-out': LogOut,
  'view-grid': Grid3X3,
  'view-hidden': EyeOff,
  'view-list-tree': ListTree,
  'view-preview': Eye,
  'view-refresh': RefreshCw,
  'edit-restore': RotateCcw,
  'window-close': X,
};

export function Icon({ name, size = 22, className }: IconProps) {
  const Lucide = ACTION_ICONS[name] ?? Square;
  return <Lucide aria-hidden="true" size={size} className={className} style={{ flexShrink: 0 }} strokeWidth={1.8} />;
}

export function DeviceIcon({ name, size = 64, className }: { name?: string; size?: number; className?: string }) {
  return (
    <img src={driveIconUrl()} alt="" width={size} height={size} style={{ flexShrink: 0 }} className={className} />
  );
}

export function FileIcon({ entry, size = 22 }: { entry: FileEntry; size?: number }) {
  const iconSize = size <= 22 ? '22' : '64';
  return (
    <img src={fileTypeIconUrl(entry, iconSize)} alt="" width={size} height={size} style={{ flexShrink: 0 }} />
  );
}

export function FolderIcon({ size = 22 }: { size?: number }) {
  const iconSize = size <= 22 ? '22' : '64';
  return (
    <img src={folderIconUrl(iconSize)} alt="" width={size} height={size} style={{ flexShrink: 0 }} />
  );
}
