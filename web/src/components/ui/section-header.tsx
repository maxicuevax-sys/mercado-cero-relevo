import type { ReactNode } from "react";

export function SectionHeader({
  title,
  titleId,
  icon,
  action,
  className = "",
  titleClassName = "",
}: {
  title: string;
  titleId?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <div className={className}>
      <div className={titleClassName}>
        {icon}
        <h2 id={titleId}>{title}</h2>
      </div>
      {action}
    </div>
  );
}
