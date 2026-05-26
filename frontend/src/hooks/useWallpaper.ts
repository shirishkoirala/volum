import { useState, useEffect } from 'react';
import { loadWallpaper, saveWallpaper, wallpaperToStyle, type WallpaperConfig } from '../utils/wallpaper';

export function useWallpaper() {
  const [wallpaper, setWallpaper] = useState<WallpaperConfig>(loadWallpaper);

  useEffect(() => { saveWallpaper(wallpaper); }, [wallpaper]);

  const wallpaperStyle = wallpaperToStyle(wallpaper);

  return { wallpaper, setWallpaper, wallpaperStyle };
}
