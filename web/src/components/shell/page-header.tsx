import type { ReactNode } from "react";

export function PageHeader({
  title,
  titleId,
  eyebrow,
  subtitle,
  actions,
  className = "",
}: {
  title: string;
  titleId?: string;
  eyebrow?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`mc-page-header ${className}`.trim()}>
      <div className="min-w-0">
        {eyebrow ? <p className="mc-page-header__eyebrow">{eyebrow}</p> : null}
        <h1 id={titleId} className="mc-page-header__title">
          {title}
        </h1>
        {subtitle ? <p className="mc-page-header__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="mc-page-header__actions">{actions}</div> : null}
    </header>
  );
}
