import { Icon } from './Icon';

type LogoutButtonProps = {
  onClick: () => void;
  className?: string;
  size?: number;
};

export function LogoutButton({ onClick, className = 'icon-button', size = 18 }: LogoutButtonProps) {
  return (
    <button className={className} onClick={onClick} title="Log out" type="button">
      <Icon name="system-log-out" size={size} />
    </button>
  );
}
