"use client";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
        <p className="mt-4 text-gray-400">{message}</p>
      </div>
    </main>
  );
}

export default LoadingState;
