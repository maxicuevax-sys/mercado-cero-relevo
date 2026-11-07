export function ProgressIndicator({
  value,
  label,
  className = "",
  barClassName = "",
}: {
  value: number;
  label: string;
  className?: string;
  barClassName?: string;
}) {
  const safe = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe}
      className={className}
    >
      <span className={barClassName} style={{ width: `${safe}%` }} />
    </div>
  );
}
