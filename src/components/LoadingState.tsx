"use client";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />
        <p className="mt-4 text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}

export default LoadingState;