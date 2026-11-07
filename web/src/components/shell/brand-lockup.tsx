import Image from "next/image";
import Link from "next/link";
import brandShop from "@/assets/inicio/brand-shop-cream.svg";

export function BrandLockup({ href = "/inicio" }: { href?: string }) {
  return (
    <Link className="inicio-brand" href={href}>
      <Image
        src={brandShop}
        alt=""
        aria-hidden="true"
        className="inicio-brand__mark"
        sizes="76px"
      />
      <span className="inicio-brand__wordmark">
        <span className="inicio-brand__name">
          Mercado{" "}
          <br />
          Cero
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
