import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ERROR BOUNDARY]', error.message, info.componentStack)
  }

  private reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-xs px-6 space-y-4">
          <p className="text-white/60 text-sm leading-relaxed">
            Something went wrong with the canvas.
          </p>
          {this.state.error?.message && (
            <p className="text-white/25 text-xs font-mono break-all">
              {this.state.error.message}
            </p>
          )}
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={this.reset}
              className="text-xs text-white/50 hover:text-white border border-white/15
                         rounded-lg px-4 py-2 transition-colors"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-white/30 hover:text-white/60 px-4 py-2
                         transition-colors"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    )
  }
}
