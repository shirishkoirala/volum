import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InlineFeedback } from '../components/ui/InlineFeedback';

describe('InlineFeedback', () => {
  it('uses status semantics for success and alert semantics for errors', () => {
    const { rerender } = render(<InlineFeedback variant="success">Changes saved</InlineFeedback>);
    expect(screen.getByRole('status')).toHaveTextContent('Changes saved');

    rerender(<InlineFeedback variant="error">Save failed</InlineFeedback>);
    expect(screen.getByRole('alert')).toHaveTextContent('Save failed');
  });
});
