import type { FileEntry } from '../api/client';
import { actionIconUrl, fileTypeIconUrl, folderIconUrl } from '../api/icons';

type IconProps = {
  name: string;
  size?: number;
  className?: string;
};

const deviceIconUrl = (name: string) =>
  new URL(`../assets/devices/22/${name}.svg`, import.meta.url).href;

export function Icon({ name, size = 22, className }: IconProps) {
  const src = actionIconUrl(name);
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ flexShrink: 0 }}
    />
  );
}

export function DeviceIcon({ name, size = 22, className }: { name: string; size?: number; className?: string }) {
  const src = deviceIconUrl(name);
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ flexShrink: 0 }}
    />
  );
}

export function FileIcon({ entry, size = 22 }: { entry: FileEntry; size?: number }) {
  const src = fileTypeIconUrl(entry);
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ flexShrink: 0 }}
    />
  );
}

export function FolderIcon({ size = 22 }: { size?: number }) {
  const src = folderIconUrl();
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ flexShrink: 0 }}
    />
  );
}
