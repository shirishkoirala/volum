import type { HTMLAttributes } from 'react';
import styles from './InlineFeedback.module.css';

type InlineFeedbackProps = HTMLAttributes<HTMLParagraphElement> & {
  variant: 'success' | 'error';
};

export function InlineFeedback({
  variant,
  className,
  children,
  role = variant === 'error' ? 'alert' : 'status',
  ...props
}: InlineFeedbackProps) {
  return (
    <p
      className={[styles.feedback, styles[variant], className].filter(Boolean).join(' ')}
      role={role}
      {...props}
    >
      {children}
    </p>
  );
}
