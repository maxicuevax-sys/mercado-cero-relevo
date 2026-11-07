import type { CSSProperties } from "react";
import type { StaticImageData } from "next/image";

export function MaskIcon({
  src,
  className = "",
}: {
  src: StaticImageData;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inicio-icon ${className}`.trim()}
      style={{ "--inicio-icon": `url("${src.src}")` } as CSSProperties}
    />
  );
}
