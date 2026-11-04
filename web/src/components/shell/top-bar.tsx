import Image from "next/image";
import Link from "next/link";
import logoInk from "@/assets/inicio/logo-simbolo.svg";

export function TopBar({
  merchant,
  address,
  initial,
  demo,
  className = "",
}: {
  merchant: string;
  address: string;
  initial: string;
  demo: boolean;
  className?: string;
}) {
  return (
    <header className={`inicio-topbar ${className}`.trim()}>
      <div className="inicio-topbar__merchant">
        <Link className="inicio-topbar__icon" href="/inicio" aria-label="Ir a Inicio">
          <Image src={logoInk} alt="" aria-hidden="true" sizes="46px" />
        </Link>
        <div className="inicio-topbar__copy">
          <p className="inicio-topbar__name">{merchant}</p>
          <p className="inicio-topbar__address">{address}</p>
        </div>
      </div>
      <div className="inicio-topbar__actions">
        {demo ? (
          <span className="inicio-demo" aria-label="Datos simulados, no dinero real">
            DEMO
          </span>
        ) : null}
        <span className="inicio-avatar" aria-hidden="true">
          {initial}
        </span>
      </div>
    </header>
  );
}
