import type { FileEntry } from '../api/client';

import folderIcon22 from '../assets/places/22/folder.svg?url';
import folderIcon64 from '../assets/places/64/folder.svg?url';
import driveHarddisk64 from '../assets/devices/64/drive-harddisk.svg?url';
import computerIconSvg from '../assets/devices/22/computer.svg?url';
import folderBookmarks64 from '../assets/places/64/folder-bookmarks.svg?url';
import trashIcon22 from '../assets/places/22/user-trash.svg?url';
import trashFull22 from '../assets/places/22/user-trash-full.svg?url';
import trashIcon64 from '../assets/places/64/user-trash.svg?url';
import trashFull64 from '../assets/places/64/user-trash-full.svg?url';
import preferencesIconSvg from '../assets/preferences/22/preferences-system.svg?url';
import jobIconSvg from '../assets/actions/22/system-run.svg?url';

import textGeneric22 from '../assets/mimetypes/22/text-x-generic.svg?url';
import textGeneric64 from '../assets/mimetypes/64/text-x-generic.svg?url';
import textCss22 from '../assets/mimetypes/22/text-css.svg?url';
import textCss64 from '../assets/mimetypes/64/text-css.svg?url';
import textHtml22 from '../assets/mimetypes/22/text-html.svg?url';
import textHtml64 from '../assets/mimetypes/64/text-html.svg?url';
import textScript22 from '../assets/mimetypes/22/text-x-script.svg?url';
import textScript64 from '../assets/mimetypes/64/text-x-script.svg?url';
import textMarkdown22 from '../assets/mimetypes/22/text-x-markdown.svg?url';
import textMarkdown64 from '../assets/mimetypes/64/text-x-markdown.svg?url';
import imageGeneric22 from '../assets/mimetypes/22/image-x-generic.svg?url';
import imageGeneric64 from '../assets/mimetypes/64/image-x-generic.svg?url';
import audioGeneric22 from '../assets/mimetypes/22/audio-x-generic.svg?url';
import audioGeneric64 from '../assets/mimetypes/64/audio-x-generic.svg?url';
import videoGeneric22 from '../assets/mimetypes/22/video-x-generic.svg?url';
import videoGeneric64 from '../assets/mimetypes/64/video-x-generic.svg?url';
import applicationZip22 from '../assets/mimetypes/22/application-zip.svg?url';
import applicationZip64 from '../assets/mimetypes/64/application-zip.svg?url';
import applicationPdf22 from '../assets/mimetypes/22/application-pdf.svg?url';
import applicationPdf64 from '../assets/mimetypes/64/application-pdf.svg?url';
import applicationJson22 from '../assets/mimetypes/22/application-json.svg?url';
import applicationJson64 from '../assets/mimetypes/64/application-json.svg?url';
import applicationOctet22 from '../assets/mimetypes/22/application-octet-stream.svg?url';
import applicationOctet64 from '../assets/mimetypes/64/application-octet-stream.svg?url';
import applicationDiskImage22 from '../assets/mimetypes/22/application-x-apple-diskimage.svg?url';
import applicationDiskImage64 from '../assets/mimetypes/64/application-x-apple-diskimage.svg?url';
import officeDocument22 from '../assets/mimetypes/22/x-office-document.svg?url';
import officeDocument64 from '../assets/mimetypes/64/x-office-document.svg?url';
import officePresentation22 from '../assets/mimetypes/22/x-office-presentation.svg?url';
import officePresentation64 from '../assets/mimetypes/64/x-office-presentation.svg?url';
import officeSpreadsheet22 from '../assets/mimetypes/22/x-office-spreadsheet.svg?url';
import officeSpreadsheet64 from '../assets/mimetypes/64/x-office-spreadsheet.svg?url';
import emptyIconSvg from '../assets/applets/256/empty.svg?url';
import unknown22 from '../assets/mimetypes/22/unknown.svg?url';
import unknown64 from '../assets/mimetypes/64/unknown.svg?url';

function ext(name: string) {
  const dot = name.lastIndexOf('.');
  if (dot === -1 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

const MIME_ICONS: Record<string, { s22: string; s64: string }> = {
  'application-json': { s22: applicationJson22, s64: applicationJson64 },
  'application-octet-stream': { s22: applicationOctet22, s64: applicationOctet64 },
  'application-pdf': { s22: applicationPdf22, s64: applicationPdf64 },
  'application-x-apple-diskimage': { s22: applicationDiskImage22, s64: applicationDiskImage64 },
  'application-x-raw-disk-image': { s22: applicationDiskImage22, s64: applicationDiskImage64 },
  'application-zip': { s22: applicationZip22, s64: applicationZip64 },
  'audio-x-generic': { s22: audioGeneric22, s64: audioGeneric64 },
  'image-x-generic': { s22: imageGeneric22, s64: imageGeneric64 },
  'text-css': { s22: textCss22, s64: textCss64 },
  'text-html': { s22: textHtml22, s64: textHtml64 },
  'text-plain': { s22: textGeneric22, s64: textGeneric64 },
  'text-x-generic': { s22: textGeneric22, s64: textGeneric64 },
  'text-x-markdown': { s22: textMarkdown22, s64: textMarkdown64 },
  'text-x-script': { s22: textScript22, s64: textScript64 },
  unknown: { s22: unknown22, s64: unknown64 },
  'video-x-generic': { s22: videoGeneric22, s64: videoGeneric64 },
  'x-office-document': { s22: officeDocument22, s64: officeDocument64 },
  'x-office-presentation': { s22: officePresentation22, s64: officePresentation64 },
  'x-office-spreadsheet': { s22: officeSpreadsheet22, s64: officeSpreadsheet64 },
};

const FOLDER_ICONS: Record<string, string> = {
  '22': folderIcon22,
  '64': folderIcon64,
};

export function folderIconUrl(size = '22') {
  return FOLDER_ICONS[size] ?? FOLDER_ICONS['64'] ?? folderIcon64;
}

export function folderBookmarksIconUrl() {
  return folderBookmarks64;
}

export function driveIconUrl() {
  return driveHarddisk64;
}

export function computerIconUrl() {
  return computerIconSvg;
}

export function trashIconUrl(full: boolean, size = '22') {
  if (size === '22') return full ? trashFull22 : trashIcon22;
  return full ? trashFull64 : trashIcon64;
}

export function preferencesIconUrl() {
  return preferencesIconSvg;
}

export function jobsIconUrl() {
  return jobIconSvg;
}

export function emptyIconUrl() {
  return emptyIconSvg;
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
  if (mimetype.startsWith('image-')) return s === '22' ? MIME_ICONS['image-x-generic'].s22 : MIME_ICONS['image-x-generic'].s64;
  if (mimetype.startsWith('audio-')) return s === '22' ? MIME_ICONS['audio-x-generic'].s22 : MIME_ICONS['audio-x-generic'].s64;
  if (mimetype.startsWith('video-')) return s === '22' ? MIME_ICONS['video-x-generic'].s22 : MIME_ICONS['video-x-generic'].s64;
  if (mimetype.startsWith('text-')) return s === '22' ? MIME_ICONS['text-x-generic'].s22 : MIME_ICONS['text-x-generic'].s64;
  if (mimetype.includes('spreadsheet') || mimetype.includes('excel')) return s === '22' ? MIME_ICONS['x-office-spreadsheet'].s22 : MIME_ICONS['x-office-spreadsheet'].s64;
  if (mimetype.includes('presentation') || mimetype.includes('powerpoint')) return s === '22' ? MIME_ICONS['x-office-presentation'].s22 : MIME_ICONS['x-office-presentation'].s64;
  if (mimetype.includes('document') || mimetype.includes('word')) return s === '22' ? MIME_ICONS['x-office-document'].s22 : MIME_ICONS['x-office-document'].s64;
  if (mimetype.includes('zip') || mimetype.includes('compressed') || mimetype.includes('tar') || mimetype.includes('gzip')) {
    return s === '22' ? MIME_ICONS['application-zip'].s22 : MIME_ICONS['application-zip'].s64;
  }
  if (mimetype.includes('executable') || mimetype.includes('sharedlib') || mimetype.includes('octet-stream')) {
    return s === '22' ? MIME_ICONS['application-octet-stream'].s22 : MIME_ICONS['application-octet-stream'].s64;
  }
  return unknown64;
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
