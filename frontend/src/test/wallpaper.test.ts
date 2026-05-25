import { describe, it, expect, beforeEach } from 'vitest';
import { loadWallpaper, saveWallpaper, wallpaperToStyle, PRESET_COLORS, PRESET_GRADIENTS } from '../utils/wallpaper';

describe('wallpaper utils', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadWallpaper returns default when nothing saved', () => {
    expect(loadWallpaper()).toEqual({ type: 'default' });
  });

  it('loadWallpaper returns saved config', () => {
    const config = { type: 'color' as const, value: '#ff0000' };
    localStorage.setItem('volum_wallpaper', JSON.stringify(config));
    expect(loadWallpaper()).toEqual(config);
  });

  it('loadWallpaper falls back to default on malformed data', () => {
    localStorage.setItem('volum_wallpaper', '{bad json');
    expect(loadWallpaper()).toEqual({ type: 'default' });
  });

  it('saveWallpaper persists to localStorage', () => {
    const config = { type: 'gradient' as const, value: '#000', value2: '#fff' };
    saveWallpaper(config);
    expect(JSON.parse(localStorage.getItem('volum_wallpaper')!)).toEqual(config);
  });

  it('wallpaperToStyle returns empty object for default', () => {
    expect(wallpaperToStyle({ type: 'default' })).toEqual({});
  });

  it('wallpaperToStyle returns backgroundColor for color type', () => {
    const style = wallpaperToStyle({ type: 'color', value: '#123456' });
    expect(style).toEqual({ backgroundColor: '#123456' });
  });

  it('wallpaperToStyle returns background gradient for gradient type', () => {
    const style = wallpaperToStyle({ type: 'gradient', value: '#red', value2: '#blue' });
    expect(style).toHaveProperty('background');
    expect((style as React.CSSProperties).background).toContain('linear-gradient(135deg, #red, #blue)');
  });

  it('PRESET_COLORS has 16 entries', () => {
    expect(PRESET_COLORS).toHaveLength(16);
  });

  it('PRESET_GRADIENTS has 6 entries', () => {
    expect(PRESET_GRADIENTS).toHaveLength(6);
  });

  it('PRESET_GRADIENTS entries have label, value, value2', () => {
    for (const g of PRESET_GRADIENTS) {
      expect(g).toHaveProperty('label');
      expect(g).toHaveProperty('value');
      expect(g).toHaveProperty('value2');
    }
  });
});
