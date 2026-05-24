import { Icon } from './Icon';

type ThemeToggleProps = {
  theme: string;
  onClick: () => void;
  className?: string;
  size?: number;
};

export function ThemeToggle({ theme, onClick, className = 'icon-button', size = 18 }: ThemeToggleProps) {
  return (
    <button
      className={className}
      onClick={onClick}
      title={theme === 'light' ? 'Dark mode' : 'Light mode'}
      type="button"
    >
      <Icon name={theme === 'light' ? 'weather-clear-night' : 'weather-clear'} size={size} />
    </button>
  );
}
