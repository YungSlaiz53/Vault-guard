import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const msg = String(error?.message || '');
    if (
      msg.includes("Failed to read a named property 'origin' from 'Location'") ||
      msg.includes('Blocked a frame with origin')
    ) {
      return { hasError: false, message: '' };
    }
    return { hasError: true, message: msg || 'Unexpected rendering error' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#05020D] text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full p-6 rounded-2xl bg-[#0D0620] border border-purple-400/30 space-y-4">
            <h1 className="text-lg font-bold text-white">VaultGuard Interface Recovery</h1>
            <p className="text-xs font-mono text-purple-200">{this.state.message}</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="vg-btn-primary px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Retry Workspace
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
