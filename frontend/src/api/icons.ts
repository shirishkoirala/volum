import type { FileEntry } from '../api/client';

import folderIcon from '../assets/places/folder.svg?url';
import driveHarddisk from '../assets/drive-harddisk.svg?url';
import multidiskIcon from '../assets/drive-multidisk.svg?url';
import computerIconSvg from '../assets/computer.svg?url';
import filesIconSvg from '../assets/files.svg?url';
import folderBookmarksIcon from '../assets/places/folder-bookmarks.svg?url';
import desktopIconSvg from '../assets/places/desktop.svg?url';
import goHomeIcon from '../assets/go-home.svg?url';
import trashIcon from '../assets/places/user-trash.svg?url';
import trashFullIcon from '../assets/places/user-trash-full.svg?url';
import preferencesIconSvg from '../assets/preferences-system.svg?url';
import jobIconSvg from '../assets/system-config-samba.svg?url';

function ext(name: string) {
  const dot = name.lastIndexOf('.');
  if (dot === -1 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

const MIMETYPE_ASSETS = import.meta.glob<string>('../assets/mimetypes/*.svg', { eager: true, query: '?url', import: 'default' });

const MIME_ICON_URLS = Object.fromEntries(
  Object.entries(MIMETYPE_ASSETS).map(([path, url]) => {
    const filename = path.split('/').pop() ?? 'unknown.svg';
    return [filename.replace(/\.svg$/, ''), url];
  }),
) as Record<string, string>;

function findMimetypeAssetUrl(mimetype: string) {
  const alias = MIMETYPE_ALIASES[mimetype];
  return MIME_ICON_URLS[mimetype] ?? (alias ? MIME_ICON_URLS[alias] : undefined);
}

function mimetypeAssetUrl(mimetype: string) {
  return findMimetypeAssetUrl(mimetype) ?? MIME_ICON_URLS.unknown ?? folderIcon;
}

const FOLDER_ICONS: Record<string, string> = {
  '22': folderIcon,
  '64': folderIcon,
};

export function folderIconUrl(size = '22') {
  return FOLDER_ICONS[size] ?? FOLDER_ICONS['64'] ?? folderIcon;
}

export function folderBookmarksIconUrl() {
  return folderBookmarksIcon;
}

export function filesIconUrl() {
  return filesIconSvg;
}

export function desktopDockIconUrl() {
  return desktopIconSvg;
}

export function homeIconUrl() {
  return goHomeIcon;
}

export function driveIconUrl() {
  return driveHarddisk;
}

export function computerIconUrl() {
  return computerIconSvg;
}

export function multidiskIconUrl() {
  return multidiskIcon;
}

export function trashIconUrl(full: boolean) {
  return full ? trashFullIcon : trashIcon;
}

export function preferencesIconUrl() {
  return preferencesIconSvg;
}

export function jobsIconUrl() {
  return jobIconSvg;
}

export function warningIconUrl() {
  return mimetypeAssetUrl('unknown');
}

export function emptyIconUrl() {
  return folderIcon;
}

export function fileTypeIconUrl(entry: FileEntry, size = '22') {
  if (entry.type === 'directory') return folderIconUrl(size);
  if (entry.permissions.includes('x')) return mimetypeAssetUrl('station');
  return mimetypeIconUrl(entry.name);
}

function mimetypeIconUrl(filename: string): string {
  const e = ext(filename);
  const m = MIMETYPE_MAP[e];
  if (m) return pickIcon(m);
  return pickIcon('unknown');
}

function pickIcon(mimetype: string): string {
  const exact = findMimetypeAssetUrl(mimetype);
  if (exact) return exact;
  return genericMimetypeIcon(mimetype);
}

function genericMimetypeIcon(mimetype: string) {
  if (mimetype.startsWith('image-')) return mimetypeAssetUrl('image-x-generic');
  if (mimetype.startsWith('audio-')) return mimetypeAssetUrl('audio-x-generic');
  if (mimetype.startsWith('video-')) return mimetypeAssetUrl('video-x-generic');
  if (mimetype.startsWith('text-')) return mimetypeAssetUrl('text-x-generic');
  if (mimetype.includes('spreadsheet') || mimetype.includes('excel')) return mimetypeAssetUrl('x-office-spreadsheet');
  if (mimetype.includes('presentation') || mimetype.includes('powerpoint')) return mimetypeAssetUrl('x-office-presentation');
  if (mimetype.includes('document') || mimetype.includes('word')) return mimetypeAssetUrl('x-office-document');
  if (mimetype.includes('zip') || mimetype.includes('compressed') || mimetype.includes('tar') || mimetype.includes('gzip')) {
    return mimetypeAssetUrl('application-zip');
  }
  if (mimetype.includes('executable') || mimetype.includes('sharedlib') || mimetype.includes('octet-stream')) {
    return mimetypeAssetUrl('application-octet-stream');
  }
  return mimetypeAssetUrl('unknown');
}

const MIMETYPE_ALIASES: Record<string, string> = {
  'application-msword': 'x-office-document',
  'application-vnd.sqlite3': 'application-x-sqlite2',
  'application-vnd.ms-excel': 'x-office-spreadsheet',
  'application-vnd.ms-powerpoint': 'x-office-presentation',
  'application-vnd.oasis.opendocument.graphics': 'x-office-drawing',
  'application-vnd.oasis.opendocument.presentation': 'x-office-presentation',
  'application-vnd.oasis.opendocument.spreadsheet': 'x-office-spreadsheet',
  'application-vnd.oasis.opendocument.text': 'x-office-document',
  'application-vnd.openxmlformats-officedocument.presentationml.presentation': 'x-office-presentation',
  'application-vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'x-office-spreadsheet',
  'application-vnd.openxmlformats-officedocument.wordprocessingml.document': 'x-office-document',
  'application-x-cd-image': 'application-x-iso',
  'application-x-cbr': 'application-vnd.comicbook+zip',
  'application-x-compressed-tar': 'application-x-tar',
  'application-x-executable': 'application-x-ms-dos-executable',
  'application-x-lzip': 'application-zip',
  'application-x-rar': 'application-zip',
  'application-x-rpm': 'rpm',
  'application-x-sharedlib': 'application-x-sharedlib',
  'application-x-xz': 'application-zip',
  'application-x-xz-compressed-tar': 'application-x-tar',
  'application-x-java-archive': 'application-x-jar',
  'application-x-raw-disk-image': 'application-x-iso',
  'audio-flac': 'audio-x-flac',
  'audio-mpeg': 'audio-x-generic',
  'audio-x-ogg': 'application-ogg',
  'audio-x-wav': 'audio-x-generic',
  'font-otf': 'font-x-generic',
  'font-ttf': 'application-x-font-ttf',
  'image-x-adobe-dng': 'image-x-psd',
  'image-x-adobe-illustrator': 'image-x-generic',
  'image-bmp': 'image-x-bmp',
  'image-gif': 'image-x-gif',
  'image-ico': 'image-x-ico',
  'image-jpeg': 'image-x-jpeg',
  'image-png': 'image-x-generic',
  'image-svg+xml': 'image-x-svg+xml',
  'image-tiff': 'image-x-tiff',
  'text-csv': 'x-office-spreadsheet',
  'text-javascript': 'application-x-javascript',
  'text-markdown': 'text-x-markdown',
  'text-plain': 'text-x-generic',
  'text-rtf': 'text-rtf',
  'text-xml': 'application-xml',
  'video-mp4': 'video-x-generic',
  'video-mpeg': 'video-x-generic',
  'video-webm': 'video-x-generic',
  'video-x-flv': 'video-x-generic',
  'video-x-matroska': 'video-x-generic',
  'video-x-msvideo': 'video-x-generic',
  'video-x-wmv': 'video-x-generic',
};

const MIMETYPE_MAP: Record<string, string> = {
  '7z': 'application-x-7z-compressed',
  aac: 'audio-x-generic',
  ai: 'image-x-adobe-illustrator',
  apk: 'package-x-generic',
  avi: 'video-x-msvideo',
  avif: 'image-x-generic',
  bash: 'text-x-script',
  bat: 'text-x-script',
  bmp: 'image-bmp',
  bz2: 'application-x-bzip',
  bz: 'application-x-bzip',
  c: 'text-x-csrc',
  'c++': 'text-x-c++src',
  cbr: 'application-x-cbr',
  cbz: 'application-x-cbr',
  cc: 'text-x-c++src',
  cfg: 'text-x-generic',
  conf: 'text-x-generic',
  cpp: 'text-x-c++src',
  css: 'text-css',
  csv: 'text-csv',
  dat: 'text-x-generic',
  db: 'application-vnd.sqlite3',
  deb: 'application-x-deb',
  diff: 'text-x-diff',
  dll: 'application-x-sharedlib',
  dmg: 'application-x-iso',
  doc: 'application-msword',
  docx: 'application-vnd.openxmlformats-officedocument.wordprocessingml.document',
  dylib: 'application-x-sharedlib',
  env: 'text-plain',
  epub: 'application-epub+zip',
  exe: 'application-x-executable',
  flac: 'audio-flac',
  flv: 'video-x-flv',
  gif: 'image-gif',
  go: 'text-x-go',
  gz: 'application-x-gzip',
  h: 'text-x-chdr',
  hpp: 'text-x-c++hdr',
  htm: 'text-html',
  html: 'text-html',
  ico: 'image-x-ico',
  img: 'application-x-iso',
  ini: 'text-x-generic',
  iso: 'application-x-iso',
  java: 'text-x-java',
  jar: 'application-x-java-archive',
  jpeg: 'image-jpeg',
  jpg: 'image-jpeg',
  js: 'text-javascript',
  json: 'application-json',
  jsx: 'text-javascript',
  log: 'text-x-log',
  lua: 'text-x-lua',
  lz: 'application-x-lzip',
  m4a: 'audio-x-generic',
  m4v: 'video-x-generic',
  md: 'text-markdown',
  mdx: 'text-markdown',
  mkv: 'video-x-matroska',
  mobi: 'application-x-mobipocket-ebook',
  mov: 'video-x-generic',
  mp3: 'audio-mpeg',
  mp4: 'video-mp4',
  mpeg: 'video-mpeg',
  mpg: 'video-mpeg',
  odp: 'application-vnd.oasis.opendocument.presentation',
  ods: 'application-vnd.oasis.opendocument.spreadsheet',
  odt: 'application-vnd.oasis.opendocument.text',
  ogg: 'audio-x-ogg',
  opus: 'audio-x-generic',
  otf: 'font-otf',
  patch: 'text-x-patch',
  pdf: 'application-pdf',
  php: 'text-x-php',
  png: 'image-png',
  ppt: 'application-vnd.ms-powerpoint',
  pptx: 'application-vnd.openxmlformats-officedocument.presentationml.presentation',
  psd: 'image-x-adobe-dng',
  py: 'text-x-python',
  rar: 'application-x-rar',
  rb: 'text-x-ruby',
  rpm: 'application-x-rpm',
  rs: 'text-x-rust',
  rtf: 'text-rtf',
  sh: 'text-x-script',
  so: 'application-x-sharedlib',
  sql: 'text-x-sql',
  sqlite: 'application-vnd.sqlite3',
  svg: 'image-svg+xml',
  swf: 'application-x-shockwave-flash',
  tar: 'application-x-tar',
  taz: 'application-x-compressed-tar',
  tiff: 'image-tiff',
  tif: 'image-tiff',
  toml: 'text-x-generic',
  ts: 'text-x-generic',
  tsx: 'text-x-generic',
  ttf: 'font-ttf',
  txt: 'text-plain',
  txz: 'application-x-xz-compressed-tar',
  vue: 'text-x-generic',
  wav: 'audio-x-wav',
  webm: 'video-webm',
  webp: 'image-x-generic',
  wma: 'audio-x-generic',
  wmv: 'video-x-wmv',
  xcf: 'image-x-xcf',
  xls: 'application-vnd.ms-excel',
  xlsx: 'application-vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xml: 'text-xml',
  xz: 'application-x-xz',
  yaml: 'text-x-generic',
  yml: 'text-x-generic',
  zip: 'application-zip',
};
