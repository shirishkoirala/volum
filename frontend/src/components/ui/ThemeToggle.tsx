import { Icon } from './Icon';
import { IconButton } from './shared';

type ThemeToggleProps = {
  theme: string;
  onClick: () => void;
  className?: string;
  size?: number;
};

export function ThemeToggle({ theme, onClick, className, size = 18 }: ThemeToggleProps) {
  return (
    <IconButton
      className={className}
      onClick={onClick}
      title={theme === 'light' ? 'Dark mode' : 'Light mode'}
    >
      <Icon name={theme === 'light' ? 'weather-clear-night' : 'weather-clear'} size={size} />
    </IconButton>
  );
}
