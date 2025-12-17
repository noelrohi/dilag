import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component to catch JavaScript errors anywhere in the child
 * component tree, log those errors, and display a fallback UI.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary fallback={<CustomFallback />}>
 *   <ComponentThatMightError />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
}

function DefaultErrorFallback({ error, onReset }: DefaultErrorFallbackProps) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
      <AlertTriangleIcon className="h-10 w-10 text-destructive" />
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-destructive">
          Something went wrong
        </h3>
        {error && (
          <p className="max-w-md text-sm text-muted-foreground">
            {error.message}
          </p>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onReset}
        className="gap-2"
      >
        <RefreshCwIcon className="h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}

/**
 * A minimal error fallback for inline/small components
 */
export function InlineErrorFallback({ message }: { message?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-destructive">
      <AlertTriangleIcon className="h-3 w-3" />
      {message ?? "Error"}
    </span>
  );
}

/**
 * HOC to wrap a component with an error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}
