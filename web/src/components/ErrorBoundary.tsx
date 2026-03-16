import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-visor-bg text-white p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <h2 className="text-lg font-semibold text-visor-red">
              {this.props.fallbackMessage || "Something went wrong"}
            </h2>
            <pre className="text-xs text-gray-400 bg-visor-card border border-visor-border rounded-lg p-3 text-left overflow-auto max-h-40 whitespace-pre-wrap break-words">
              {this.state.error?.message || "Unknown error"}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-visor-accent hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
