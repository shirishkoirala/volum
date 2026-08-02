import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Overlay,
  PanelHeader,
  Button,
  IconButton,
  StatusBadge,
  RotatedIcon,
  MutedText,
  IconImg,
} from '../components/ui/shared';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('applies primary variant class', () => {
    const { container } = render(<Button variant="primary">Save</Button>);
    expect(container.querySelector('[class*="primary"]')).toBeInTheDocument();
  });

  it('applies danger variant class', () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('dangerButton');
  });

  it('applies compact class', () => {
    const { container } = render(<Button size="compact">Small</Button>);
    expect(container.querySelector('[class*="compact"]')).toBeInTheDocument();
  });

  it('is disabled when disabled prop is set', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByText('Disabled')).toBeDisabled();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByText('Click'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('applies custom className', () => {
    const { container } = render(<Button className="my-btn">Custom</Button>);
    expect(container.querySelector('.my-btn')).toBeInTheDocument();
  });

  it('owns the disabled busy state and label', () => {
    render(
      <Button busy busyLabel="Saving...">
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Saving...' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});

describe('IconButton', () => {
  it('renders children', () => {
    render(<IconButton aria-label="icon button">X</IconButton>);
    expect(screen.getByText('X')).toBeInTheDocument();
  });
});

describe('Overlay', () => {
  it('renders children', () => {
    render(
      <Overlay>
        <div>Content</div>
      </Overlay>,
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('calls onClose when clicking the backdrop', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Overlay onClose={onClose}>
        <div>Content</div>
      </Overlay>,
    );
    await user.click(screen.getByText('Content').parentElement!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when clicking inside children', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Overlay onClose={onClose}>
        <div>Content</div>
      </Overlay>,
    );
    await user.click(screen.getByText('Content'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('PanelHeader', () => {
  it('renders title', () => {
    render(<PanelHeader title="Settings" />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<PanelHeader title="Settings" subtitle="Manage preferences" />);
    expect(screen.getByText('Manage preferences')).toBeInTheDocument();
  });

  it('renders close button when onClose is provided', () => {
    render(<PanelHeader title="Settings" onClose={vi.fn()} />);
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <PanelHeader title="Settings">
        <button type="button">Action</button>
      </PanelHeader>,
    );
    expect(screen.getByText('Action')).toBeInTheDocument();
  });
});

describe('StatusBadge', () => {
  it('renders children', () => {
    render(<StatusBadge variant="success">Completed</StatusBadge>);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('applies the variant class', () => {
    const { container } = render(<StatusBadge variant="success">OK</StatusBadge>);
    expect(container.querySelector('[class*="statusBadge"]')).toBeInTheDocument();
  });

  it('keeps danger status styling separate from danger buttons', () => {
    render(<StatusBadge variant="danger">Failed</StatusBadge>);
    expect(screen.getByText('Failed').className).toContain('dangerStatus');
  });
});

describe('RotatedIcon', () => {
  it('renders children', () => {
    render(
      <RotatedIcon>
        <span>Arrow</span>
      </RotatedIcon>,
    );
    expect(screen.getByText('Arrow')).toBeInTheDocument();
  });
});

describe('MutedText', () => {
  it('renders children', () => {
    render(<MutedText>Muted content</MutedText>);
    expect(screen.getByText('Muted content')).toBeInTheDocument();
  });
});

describe('IconImg', () => {
  it('renders img with correct attributes', () => {
    render(<IconImg src="/icon.svg" alt="icon" width={24} height={24} />);
    const img = screen.getByAltText('icon');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/icon.svg');
    expect(img).toHaveAttribute('width', '24');
    expect(img).toHaveAttribute('height', '24');
  });

  it('uses empty alt text by default', () => {
    const { container } = render(<IconImg src="/icon.svg" width={24} height={24} />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('alt', '');
  });
});
