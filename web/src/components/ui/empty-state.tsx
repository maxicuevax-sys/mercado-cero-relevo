import type { ReactNode } from "react";

export function EmptyState({
  title,
  children,
  action,
  className = "",
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mc-empty ${className}`.trim()} role="status">
      <p className="mc-empty__title">{title}</p>
      {children ? <div className="mc-empty__body">{children}</div> : null}
      {action ? <div className="mc-empty__action">{action}</div> : null}
    </div>
  );
}
