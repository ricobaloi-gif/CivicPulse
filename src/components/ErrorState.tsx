"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-danger/30 bg-danger-muted/30 p-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-muted text-danger">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h3 className="mt-4 text-xl font-bold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 btn-primary"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Try Again</span>
        </button>
      )}
    </div>
  );
}

export default ErrorState;