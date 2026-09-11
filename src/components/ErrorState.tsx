"use client";

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
    <div className="mx-auto max-w-lg rounded-2xl border border-red-900 bg-red-950/20 p-8 text-center">
      <div className="text-4xl">⚠️</div>
      <h3 className="mt-4 text-xl font-bold text-red-300">{title}</h3>
      <p className="mt-2 text-sm text-red-400/80">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

export default ErrorState;
