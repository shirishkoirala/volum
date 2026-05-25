import { Icon } from './Icon';
import { IconButton } from './shared';

type LogoutButtonProps = {
  onClick: () => void;
  className?: string;
  size?: number;
};

export function LogoutButton({ onClick, className, size = 18 }: LogoutButtonProps) {
  return (
    <IconButton className={className} onClick={onClick} title="Log out">
      <Icon name="system-log-out" size={size} />
    </IconButton>
  );
}
