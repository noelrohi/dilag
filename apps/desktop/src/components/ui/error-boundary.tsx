import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCwIcon, AlertTriangleIcon } from "lucide-react";

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
    <div className="h-dvh flex flex-col bg-background">
      {/* Title bar drag region */}
      <div
        data-tauri-drag-region
        className="h-[38px] shrink-0 select-none"
      />

      {/* Error content - centered */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="max-w-sm w-full text-center space-y-6">
          {/* Subtle error indicator */}
          <div className="mx-auto size-16 rounded-2xl bg-muted/50 flex items-center justify-center">
            <svg
              className="size-8 text-muted-foreground/60"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-foreground">
              Something went wrong
            </h3>
            {error && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {error.message}
              </p>
            )}
          </div>

          {/* Action */}
          <Button
            variant="secondary"
            size="sm"
            onClick={onReset}
            className="gap-2"
          >
            <RefreshCwIcon className="size-3.5" />
            Try again
          </Button>

          {/* Dev hint - only show in development */}
          {error && (
            <p className="text-[11px] text-muted-foreground/50 pt-4">
              Check the console for more details
            </p>
          )}
        </div>
      </div>
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
