/**
 * Async utilities for proper cleanup and error handling
 */

/**
 * Creates a managed timeout that can be cancelled.
 * Returns a cleanup function that cancels the timeout.
 *
 * @example
 * const cleanup = createManagedTimeout(() => {
 *   console.log('Timeout fired');
 * }, 2000);
 *
 * // Later, to cancel:
 * cleanup();
 */
export function createManagedTimeout(
  callback: () => void,
  delay: number
): () => void {
  const timeoutId = setTimeout(callback, delay);
  return () => clearTimeout(timeoutId);
}

/**
 * Wraps an async operation with error handling and logging.
 * Provides consistent error handling across the app.
 *
 * @param operation - The async function to execute
 * @param context - A string describing the operation (for logging)
 * @param fallback - Optional fallback value to return on error
 *
 * @example
 * const messages = await withErrorHandler(
 *   () => sdk.session.messages({ sessionID }),
 *   'loadSessionMessages',
 *   []
 * );
 */
export async function withErrorHandler<T>(
  operation: () => Promise<T>,
  context: string,
  fallback?: T
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${context}] Error:`, message);

    if (fallback !== undefined) {
      return fallback;
    }
    throw error;
  }
}

/**
 * Tracks promises and allows cancelling them.
 * Useful for cleaning up pending operations on unmount.
 *
 * @example
 * const tracker = new PromiseTracker();
 *
 * // In your async code:
 * await tracker.track(fetchData());
 *
 * // On unmount:
 * tracker.cancelAll();
 */
export class PromiseTracker {
  private controllers: Set<AbortController> = new Set();
  private isCancelled = false;

  /**
   * Tracks a promise and returns a new promise that rejects if cancelled.
   * The original promise continues to execute, but its result is ignored.
   */
  track<T>(promise: Promise<T>): Promise<T> {
    if (this.isCancelled) {
      return Promise.reject(new Error("PromiseTracker cancelled"));
    }

    const controller = new AbortController();
    this.controllers.add(controller);

    return new Promise<T>((resolve, reject) => {
      controller.signal.addEventListener("abort", () => {
        reject(new Error("Promise cancelled"));
      });

      promise
        .then((value) => {
          if (!controller.signal.aborted) {
            resolve(value);
          }
        })
        .catch((error) => {
          if (!controller.signal.aborted) {
            reject(error);
          }
        })
        .finally(() => {
          this.controllers.delete(controller);
        });
    });
  }

  /**
   * Cancels all tracked promises.
   * Safe to call multiple times.
   */
  cancelAll(): void {
    this.isCancelled = true;
    for (const controller of this.controllers) {
      controller.abort();
    }
    this.controllers.clear();
  }

  /**
   * Resets the tracker, allowing new promises to be tracked.
   */
  reset(): void {
    this.isCancelled = false;
  }
}

/**
 * Creates a cleanup registry for managing multiple cleanup functions.
 * Useful in useEffect hooks that set up multiple subscriptions.
 *
 * @example
 * useEffect(() => {
 *   const cleanups = createCleanupRegistry();
 *
 *   cleanups.add(createManagedTimeout(callback1, 1000));
 *   cleanups.add(subscribeToEvents(handler));
 *
 *   return cleanups.runAll;
 * }, []);
 */
export function createCleanupRegistry() {
  const cleanups: (() => void)[] = [];

  return {
    add(cleanup: () => void): void {
      cleanups.push(cleanup);
    },
    runAll(): void {
      cleanups.forEach((cleanup) => cleanup());
      cleanups.length = 0;
    },
  };
}
