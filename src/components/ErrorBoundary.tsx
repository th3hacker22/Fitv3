"use client";
import React, { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui-custom/Button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-bg p-6 text-center">
          {/* Error Icon */}
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-danger/10">
            <AlertTriangle className="h-10 w-10 text-danger" />
          </div>

          {/* Error Message */}
          <h1 className="mb-2 text-xl font-bold text-text-primary uppercase tracking-wider">
            An Unexpected Error Occurred
          </h1>
          <p className="mb-6 max-w-sm text-sm text-text-secondary">
            We encountered a slight hiccup. Please try again or head back home.
          </p>

          {/* Error Details (Dev Mode) */}
          {this.state.error && (
            <div className="glass-card mb-6 max-w-sm rounded-[--radius-card] p-4 text-left border border-danger/20">
              <p className="mb-1 text-xs font-semibold text-danger uppercase tracking-wider">
                Error Details:
              </p>
              <p className="text-xs text-text-secondary font-mono break-all">
                {this.state.error.message}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 w-full max-w-sm">
            <Button
              onClick={this.handleReload}
              variant="primary"
              className="flex-1 py-3"
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Retry
            </Button>
            <Button
              onClick={this.handleGoHome}
              variant="outline"
              className="flex-1 py-3 text-text-secondary border-border bg-bg-elevated/50"
              icon={<Home className="h-4 w-4" />}
            >
              Home
            </Button>
          </div>

          {/* App Info */}
          <p className="mt-8 text-xs text-text-secondary uppercase tracking-wider">Pulse v1.0.0</p>
        </div>
      );
    }

    return this.props.children;
  }
}
