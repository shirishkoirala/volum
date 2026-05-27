import type { FileEntry } from '../api/client';

import folderIcon from '../assets/places/folder.svg?url';
import driveHarddisk from '../assets/drive-harddisk.svg?url';
import computerIconSvg from '../assets/computer.svg?url';
import folderBookmarksIcon from '../assets/places/folder-bookmarks.svg?url';
import desktopIconSvg from '../assets/places/desktop.svg?url';
import trashIcon from '../assets/places/user-trash.svg?url';
import trashFullIcon from '../assets/places/user-trash-full.svg?url';
import preferencesIconSvg from '../assets/preferences-system.svg?url';
import jobIconSvg from '../assets/utilities-terminal.svg?url';

import textGenericIcon from '../assets/mimetypes/text-x-generic.svg?url';
import textCssIcon from '../assets/mimetypes/text-css.svg?url';
import textHtmlIcon from '../assets/mimetypes/text-html.svg?url';
import textScriptIcon from '../assets/mimetypes/text-x-script.svg?url';
import textMarkdownIcon from '../assets/mimetypes/text-x-markdown.svg?url';
import imageGenericIcon from '../assets/mimetypes/image-x-generic.svg?url';
import audioGenericIcon from '../assets/mimetypes/audio-x-generic.svg?url';
import videoGenericIcon from '../assets/mimetypes/video-x-generic.svg?url';
import applicationZipIcon from '../assets/mimetypes/application-zip.svg?url';
import applicationPdfIcon from '../assets/mimetypes/application-pdf.svg?url';
import applicationJsonIcon from '../assets/mimetypes/application-json.svg?url';
import applicationOctetIcon from '../assets/mimetypes/application-octet-stream.svg?url';
import applicationDiskImageIcon from '../assets/mimetypes/application-x-apple-diskimage.svg?url';
import officeDocumentIcon from '../assets/mimetypes/x-office-document.svg?url';
import officePresentationIcon from '../assets/mimetypes/x-office-presentation.svg?url';
import officeSpreadsheetIcon from '../assets/mimetypes/x-office-spreadsheet.svg?url';
import unknownIcon from '../assets/mimetypes/unknown.svg?url';

function ext(name: string) {
  const dot = name.lastIndexOf('.');
  if (dot === -1 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

const iconPair = (url: string) => ({ s22: url, s64: url });

const MIME_ICONS: Record<string, { s22: string; s64: string }> = {
  'application-json': iconPair(applicationJsonIcon),
  'application-octet-stream': iconPair(applicationOctetIcon),
  'application-pdf': iconPair(applicationPdfIcon),
  'application-x-apple-diskimage': iconPair(applicationDiskImageIcon),
  'application-x-raw-disk-image': iconPair(applicationDiskImageIcon),
  'application-zip': iconPair(applicationZipIcon),
  'audio-x-generic': iconPair(audioGenericIcon),
  'image-x-generic': iconPair(imageGenericIcon),
  'text-css': iconPair(textCssIcon),
  'text-html': iconPair(textHtmlIcon),
  'text-plain': iconPair(textGenericIcon),
  'text-x-generic': iconPair(textGenericIcon),
  'text-x-markdown': iconPair(textMarkdownIcon),
  'text-x-script': iconPair(textScriptIcon),
  unknown: iconPair(unknownIcon),
  'video-x-generic': iconPair(videoGenericIcon),
  'x-office-document': iconPair(officeDocumentIcon),
  'x-office-presentation': iconPair(officePresentationIcon),
  'x-office-spreadsheet': iconPair(officeSpreadsheetIcon),
};

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
  return folderIcon;
}

export function desktopDockIconUrl() {
  return desktopIconSvg;
}

export function driveIconUrl() {
  return driveHarddisk;
}

export function computerIconUrl() {
  return computerIconSvg;
}

export function trashIconUrl(full: boolean, size = '22') {
  return full ? trashFullIcon : trashIcon;
}

export function preferencesIconUrl() {
  return preferencesIconSvg;
}

export function jobsIconUrl() {
  return jobIconSvg;
}

export function warningIconUrl() {
  return unknownIcon;
}

export function emptyIconUrl() {
  return folderIcon;
}

export function fileTypeIconUrl(entry: FileEntry, size = '22') {
  if (entry.type === 'directory') return folderIconUrl(size);
  return mimetypeIconUrl(entry.name, size);
}

function mimetypeIconUrl(filename: string, size = '22'): string {
  const e = ext(filename);
  const m = MIMETYPE_MAP[e];
  if (m) return pickIcon(m, size);
  return pickIcon('unknown', size);
}

function pickIcon(mimetype: string, size: string): string {
  const entry = MIME_ICONS[mimetype];
  if (entry) return size === '22' ? entry.s22 : entry.s64;
  return genericMimetypeIcon(mimetype, size);
}

function genericMimetypeIcon(mimetype: string, size: string) {
  const s = size === '22' ? '22' : '64';
  if (mimetype.startsWith('image-')) return s === '22' ? MIME_ICONS['image-x-generic']!.s22 : MIME_ICONS['image-x-generic']!.s64;
  if (mimetype.startsWith('audio-')) return s === '22' ? MIME_ICONS['audio-x-generic']!.s22 : MIME_ICONS['audio-x-generic']!.s64;
  if (mimetype.startsWith('video-')) return s === '22' ? MIME_ICONS['video-x-generic']!.s22 : MIME_ICONS['video-x-generic']!.s64;
  if (mimetype.startsWith('text-')) return s === '22' ? MIME_ICONS['text-x-generic']!.s22 : MIME_ICONS['text-x-generic']!.s64;
  if (mimetype.includes('spreadsheet') || mimetype.includes('excel')) return s === '22' ? MIME_ICONS['x-office-spreadsheet']!.s22 : MIME_ICONS['x-office-spreadsheet']!.s64;
  if (mimetype.includes('presentation') || mimetype.includes('powerpoint')) return s === '22' ? MIME_ICONS['x-office-presentation']!.s22 : MIME_ICONS['x-office-presentation']!.s64;
  if (mimetype.includes('document') || mimetype.includes('word')) return s === '22' ? MIME_ICONS['x-office-document']!.s22 : MIME_ICONS['x-office-document']!.s64;
  if (mimetype.includes('zip') || mimetype.includes('compressed') || mimetype.includes('tar') || mimetype.includes('gzip')) {
    return s === '22' ? MIME_ICONS['application-zip']!.s22 : MIME_ICONS['application-zip']!.s64;
  }
  if (mimetype.includes('executable') || mimetype.includes('sharedlib') || mimetype.includes('octet-stream')) {
    return s === '22' ? MIME_ICONS['application-octet-stream']!.s22 : MIME_ICONS['application-octet-stream']!.s64;
  }
  return unknownIcon;
}

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
  dmg: 'application-x-raw-disk-image',
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
  img: 'application-x-raw-disk-image',
  ini: 'text-x-generic',
  iso: 'application-x-cd-image',
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
