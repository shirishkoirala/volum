import { PRESET_COLORS, PRESET_GRADIENTS, type WallpaperConfig } from '../../utils/wallpaper';
import styles from './WallpaperPicker.module.css';

type WallpaperPickerProps = {
  wallpaper: WallpaperConfig;
  onChange: (config: WallpaperConfig) => void;
};

export function WallpaperPicker({ wallpaper, onChange }: WallpaperPickerProps) {
  return (
    <section className={styles.section}>
      <h4>Desktop Background</h4>
      <div className={styles.row}>
        <button
          type="button"
          className={`${styles.option}${wallpaper.type === 'default' ? ` ${styles.active}` : ''}`}
          onClick={() => onChange({ type: 'default' })}
        >
          <div className={styles.preview} style={{ background: 'var(--color-bg)' }} />
          <span>Default</span>
        </button>
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`${styles.option}${wallpaper.type === 'color' && wallpaper.value === color ? ` ${styles.active}` : ''}`}
            onClick={() => onChange({ type: 'color', value: color })}
          >
            <div className={styles.preview} style={{ backgroundColor: color }} />
            <span>{color}</span>
          </button>
        ))}
      </div>

      <div className={styles.row}>
        <small>Custom Color</small>
        <div className={styles.customColor}>
          <input
            type="color"
            className={styles.colorInput}
            value={wallpaper.type === 'color' && wallpaper.value ? wallpaper.value : '#1a1a2e'}
            onChange={(e) => onChange({ type: 'color', value: e.target.value })}
          />
          <span>{wallpaper.type === 'color' ? wallpaper.value : '#1a1a2e'}</span>
        </div>
      </div>

      <h4>Gradients</h4>
      <div className={styles.row}>
        {PRESET_GRADIENTS.map((g) => (
          <button
            key={g.label}
            type="button"
            className={`${styles.option}${wallpaper.type === 'gradient' && wallpaper.value === g.value ? ` ${styles.active}` : ''}`}
            onClick={() => onChange({ type: 'gradient', value: g.value, value2: g.value2 })}
          >
            <div className={styles.preview} style={{ background: `linear-gradient(135deg, ${g.value}, ${g.value2})` }} />
            <span>{g.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
