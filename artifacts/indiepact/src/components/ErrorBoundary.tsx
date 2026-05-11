import { Component, ReactNode, ErrorInfo } from "react";
import { ShieldCheck, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[IndiePact] Unhandled render error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = import.meta.env.BASE_URL || "/";
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
          <div className="max-w-md w-full flex flex-col items-center text-center gap-6">
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center"
              style={{
                background: "radial-gradient(circle at 30% 30%, rgba(239,68,68,0.2), rgba(239,68,68,0.05))",
                border: "1px solid rgba(239,68,68,0.3)",
              }}
            >
              <ShieldCheck className="h-8 w-8 text-red-400" />
            </div>

            <div className="space-y-2">
              <h1 className="text-white font-bold text-xl">Something went wrong</h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                IndiePact encountered an unexpected error. Your data is safe.
              </p>
              {this.state.error && (
                <p className="text-slate-700 text-xs font-mono mt-3 p-3 rounded-lg bg-slate-900/50 border border-slate-800 text-left break-words">
                  {this.state.error.message}
                </p>
              )}
            </div>

            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-all"
            >
              <RefreshCw className="h-4 w-4" />
              Return to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
