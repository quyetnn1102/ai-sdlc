/**
 * Inline error alert for displaying API/query errors inside pages.
 */
interface Props {
  message: string | null;
  onRetry?: () => void;
}

export function ErrorAlert({ message, onRetry }: Props) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.25)] text-sm text-status-danger mb-4">
      <span className="mt-0.5 flex-shrink-0">⚠</span>
      <div className="flex-1">
        <span>{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-3 underline text-status-danger hover:opacity-80 transition-opacity"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
