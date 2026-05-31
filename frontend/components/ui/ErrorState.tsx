import { ERROR_LOAD_DATA } from "@/lib/loadingMessages";

type ErrorStateProps = {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
};

export default function ErrorState({ message = ERROR_LOAD_DATA, onRetry, compact = false }: ErrorStateProps) {
  return (
    <div
      className={`alert-banner alert-banner--error${compact ? " alert-banner--compact" : ""}`}
      role="alert"
      style={{ display: "grid", gap: "0.75rem", justifyItems: compact ? "start" : "center", textAlign: compact ? "left" : "center" }}
    >
      <p style={{ margin: 0 }}>{message}</p>
      {onRetry ? (
        <button type="button" className="quick-action-btn" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
