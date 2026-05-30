import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './shared';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.wrapper}>
          <h2 className={styles.title}>Something went wrong</h2>
          <p className={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <Button variant="primary" onClick={this.handleRetry}>
            Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
