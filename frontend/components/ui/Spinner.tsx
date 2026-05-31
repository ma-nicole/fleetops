type SpinnerProps = {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
};

const sizeClass = { sm: "spinner--sm", md: "spinner--md", lg: "spinner--lg" } as const;

export default function Spinner({ size = "md", label, className = "" }: SpinnerProps) {
  return (
    <span className={`spinner-wrap ${className}`.trim()} role="status" aria-live="polite" aria-busy="true">
      <span className={`spinner ${sizeClass[size]}`} aria-hidden="true" />
      {label ? <span className="spinner-wrap__label">{label}</span> : null}
    </span>
  );
}
