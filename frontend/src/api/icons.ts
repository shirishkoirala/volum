import type { FileEntry } from '../api/client';

function ext(name: string) {
  const dot = name.lastIndexOf('.');
  if (dot === -1 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

const iconUrl = (category: string, size: string, name: string) =>
  new URL(`../assets/${category}/${size}/${name}.svg`, import.meta.url).href;

export function folderIconUrl() {
  return iconUrl('places', '22', 'folder');
}

export function fileTypeIconUrl(entry: FileEntry) {
  if (entry.type === 'directory') return folderIconUrl();
  return mimetypeIconUrl(entry.name);
}

function mimetypeIconUrl(filename: string): string {
  const e = ext(filename);
  const m = MIMETYPE_MAP[e];
  if (m) return iconUrl('mimetypes', '22', m);
  return iconUrl('mimetypes', '22', 'unknown');
}

export function actionIconUrl(name: string) {
  return iconUrl('actions', '22', name);
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
