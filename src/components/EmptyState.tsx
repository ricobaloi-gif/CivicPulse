"use client";

interface EmptyStateProps {
  icon?: string;
  title: string;
  message?: string;
}

export function EmptyState({ icon = "📭", title, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl">{icon}</div>
      <h3 className="mt-4 text-xl font-bold text-gray-300">{title}</h3>
      {message && (
        <p className="mt-2 max-w-md text-sm text-gray-500">{message}</p>
      )}
    </div>
  );
}

export default EmptyState;
