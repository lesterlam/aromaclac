import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary component that catches React errors and displays a fallback UI.
 *
 * Note: This must remain a class component — React's error boundary lifecycle
 * methods (getDerivedStateFromError, componentDidCatch) have no Hook equivalent.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950">
            <h2 className="mb-2 text-lg font-semibold text-red-900 dark:text-red-100">
              Something went wrong
            </h2>
            <p className="mb-4 text-sm text-red-700 dark:text-red-300">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              type="button"
              onClick={this.resetError}
              className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Inline error fallback component for smaller error cases.
 */
export function InlineErrorFallback({
  message = 'Something went wrong',
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="rounded border border-red-200 bg-red-50 p-4 text-sm dark:border-red-800 dark:bg-red-950">
      <p className="font-medium text-red-900 dark:text-red-100">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 text-xs underline text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100"
        >
          Try again
        </button>
      )}
    </div>
  )
}