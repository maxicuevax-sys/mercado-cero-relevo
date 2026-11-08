import Image from "next/image";
import Link from "next/link";

export function BrandLockup({ href = "/inicio" }: { href?: string }) {
  return (
    <Link className="inicio-brand" href={href}>
      <Image
        src="/icons/trangui-192-v1.png"
        alt=""
        aria-hidden="true"
        className="inicio-brand__mark"
        sizes="76px"
        width={76}
        height={76}
        style={{ background: "#fff6e9", borderRadius: 8, objectFit: "contain", filter: "none" }}
      />
      <span className="inicio-brand__wordmark">
        <span className="inicio-brand__name">
          Trangui
        </span>
        <svg
          className="inicio-brand__rays"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M4 5.5l8 4M2 13h9M6 21l5.5-6" />
        </svg>
        <span className="sr-only">Inicio</span>
      </span>
    </Link>
  );
}
