import type { FileEntry } from '../api/client';
import {
  actionIconUrl,
  deviceIconUrl,
  fileTypeIconUrl,
  folderIconUrl,
} from '../api/icons';

type IconProps = {
  name: string;
  size?: number;
  className?: string;
};

export function Icon({ name, size = 22, className }: IconProps) {
  return (
    <img
      src={actionIconUrl(name)}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ flexShrink: 0 }}
    />
  );
}

export function DeviceIcon({ name, size = 64, className }: { name: string; size?: number; className?: string }) {
  return (
    <img
      src={deviceIconUrl(name, String(size))}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ flexShrink: 0 }}
    />
  );
}

export function FileIcon({ entry, size = 64 }: { entry: FileEntry; size?: number }) {
  return (
    <img
      src={fileTypeIconUrl(entry, String(size))}
      alt=""
      width={size}
      height={size}
      style={{ flexShrink: 0 }}
    />
  );
}

export function FolderIcon({ size = 64 }: { size?: number }) {
  return (
    <img
      src={folderIconUrl(String(size))}
      alt=""
      width={size}
      height={size}
      style={{ flexShrink: 0 }}
    />
  );
}
