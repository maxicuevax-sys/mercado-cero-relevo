import Image from "next/image";
import Link from "next/link";
import logoInk from "@/assets/inicio/logo-simbolo.svg";
import logoCream from "@/assets/inicio/brand-shop-cream.svg";
import bellIcon from "@/assets/inicio/icons/campana.svg";
import { MaskIcon } from "@/components/ui/icon";

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
      <Link className="inicio-topbar__mobile-brand" href="/inicio" aria-label="Trangui · Ir a Inicio">
        <Image src={logoInk} alt="" aria-hidden="true" sizes="48px" />
        <span>Trangui<svg className="inicio-topbar__brand-rays" aria-hidden="true" viewBox="0 0 20 24"><path d="M4 6 13 2M5 12h12M4 18l9 4" /></svg></span>
      </Link>
      <div className="inicio-topbar__merchant">
        <Link className="inicio-topbar__icon" href="/inicio" aria-label="Ir a Inicio">
          <Image src={logoInk} alt="" aria-hidden="true" className="inicio-topbar__symbol--desktop" sizes="46px" />
          <Image src={logoCream} alt="" aria-hidden="true" className="inicio-topbar__symbol--mobile" sizes="32px" />
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
        <Link href="/notificaciones" className="inicio-topbar__alerts" aria-label="Ver notificaciones">
          <MaskIcon src={bellIcon} className="inicio-topbar__bell" />
        </Link>
        <span className="inicio-avatar" aria-hidden="true">
          {initial}
        </span>
      </div>
    </header>
  );
}
