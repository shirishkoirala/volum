export type WallpaperConfig = {
  type: 'default' | 'color' | 'gradient';
  value?: string;
  value2?: string;
};

const STORAGE_KEY = 'volum_wallpaper';

export function loadWallpaper(): WallpaperConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as WallpaperConfig;
  } catch { /* ignore */ }
  return { type: 'default' };
}

export function saveWallpaper(config: WallpaperConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function wallpaperToStyle(config: WallpaperConfig): React.CSSProperties {
  switch (config.type) {
    case 'color':
      return { backgroundColor: config.value || 'transparent' };
    case 'gradient':
      return { background: `linear-gradient(135deg, ${config.value || '#667eea'}, ${config.value2 || '#764ba2'})` };
    default:
      return {};
  }
}

export const PRESET_COLORS = [
  '#1a1a2e', '#16213e', '#0f3460', '#e94560',
  '#2d3436', '#636e72', '#b2bec3', '#dfe6e9',
  '#6c5ce7', '#a29bfe', '#fd79a8', '#e17055',
  '#00b894', '#00cec9', '#0984e3', '#fdcb6e',
];

export const PRESET_GRADIENTS: { label: string; value: string; value2: string }[] = [
  { label: 'Sunset', value: '#f093fb', value2: '#f5576c' },
  { label: 'Ocean', value: '#4facfe', value2: '#00f2fe' },
  { label: 'Forest', value: '#11998e', value2: '#38ef7d' },
  { label: 'Night', value: '#0f0c29', value2: '#302b63' },
  { label: 'Peach', value: '#ffecd2', value2: '#fcb69f' },
  { label: 'Purple Haze', value: '#7303c0', value2: '#ec38bc' },
];
