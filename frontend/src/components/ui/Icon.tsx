import type { FileEntry } from '../../api/client';
import {
  AlertTriangle, Archive, ArrowRight, ArrowUpDown, Bookmark, ChevronDown, ChevronRight, ChevronUp, CheckSquare,
  CircleStop, CircleUser, Clipboard, Columns3, Copy, Download, Eye, EyeOff, FileInput, Folder,
  FolderPlus, Globe, Grid3X3, HelpCircle, Home, Info, ListChecks, ListTree, LogOut,
  List, ListX, Monitor, Moon, MoreHorizontal, Pause, Pencil, Play, RefreshCw, RotateCcw,
  Scissors, Search, Send, Settings, Square, Sun, Trash2, Upload, Usb, X, HardDrive, ArrowDown,
  type LucideIcon,
} from 'lucide-react';
import { IconImg } from './shared';
import { fileTypeIconUrl, folderIconUrl, driveIconUrl, trashIconUrl } from '../../api/icons';

type IconProps = { name: string; size?: number; className?: string };

const ACTION_ICONS: Record<string, LucideIcon> = {
  'archive-create': Archive,
  'archive-extract': Archive,
  'bookmark-new': Bookmark,
  'dialog-information': Info,
  'dialog-warning': AlertTriangle,
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
  'go-previous': ChevronRight,
  'go-up': ChevronUp,
  'go-down': ArrowDown,
  'selection-invert': ListX,
  'selection-select-all': CheckSquare,
  'media-playback-pause': Pause,
  'media-playback-start': Play,
  'media-removable': Usb,
  monitor: Monitor,
  'process-stop': CircleStop,
  'system-log-out': LogOut,
  'view-grid': Grid3X3,
  'view-hidden': EyeOff,
  'view-list': List,
  'view-list-column': Columns3,
  'view-list-tree': ListTree,
  'view-more': MoreHorizontal,
  'view-preview': Eye,
  'view-refresh': RefreshCw,
  'mail-send': Send,
  'edit-restore': RotateCcw,
  'drive-harddisk': HardDrive,
  'help-about': HelpCircle,
  'preferences-system': Settings,
  'weather-clear': Sun,
  'weather-clear-night': Moon,
  'window-close': X,
  'sort-desc': ArrowUpDown,
  'go-home': Home,
  'internet-web-browser': Globe,
  'pan-down': ChevronDown,
  'avatar-default': CircleUser,
  'folder': Folder,
  'document-properties': ListChecks,
  'go-jump': ArrowRight,
  'job-copy': Copy,
  'job-move': ArrowRight,
  'job-archive': Archive,
  'job-extract': FileInput,
  'job-upload': Upload,
  'job-checksum': ListChecks,
};

export function Icon({ name, size = 22, className }: IconProps) {
  const Lucide = ACTION_ICONS[name] ?? Square;
  return <Lucide aria-hidden="true" size={size} className={`icon-img ${className ?? ''}`} strokeWidth={1.8} />;
}

export function DeviceIcon({ size = 64, className }: { name?: string; size?: number; className?: string }) {
  return <IconImg src={driveIconUrl()} alt="" width={size} height={size} className={className} />;
}

export function FileIcon({ entry, size = 22 }: { entry: FileEntry; size?: number }) {
  const iconSize = size <= 22 ? '22' : '64';
  return <IconImg src={fileTypeIconUrl(entry, iconSize)} alt="" width={size} height={size} />;
}

export function FolderIcon({ size = 22 }: { size?: number }) {
  const iconSize = size <= 22 ? '22' : '64';
  return <IconImg src={folderIconUrl(iconSize)} alt="" width={size} height={size} />;
}

export function TrashIcon({ full = false, size = 22 }: { full?: boolean; size?: number }) {
  return <IconImg src={trashIconUrl(full)} alt="" width={size} height={size} />;
}
