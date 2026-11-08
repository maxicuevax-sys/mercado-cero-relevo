import Image from "next/image";
import Link from "next/link";
import { MonitorPlay } from "lucide-react";

export function BrandRays() {
  return <svg viewBox="0 0 28 30" aria-hidden="true" className="access-rays"><path d="m6 6 9-4M7 14h14M6 22l9 5" /></svg>;
}

export function AuthBrandbar({ register = false }: { register?: boolean }) {
  return <header className="access-brandbar">
    <Link className="access-brand" href="/acceso" aria-label="Trangui · Iniciar sesión">
      <Image src="/icons/trangui-192-v1.png" alt="" aria-hidden="true" className="access-shop" width={50} height={50} style={{ background: "#fff6e9", borderRadius: 8, objectFit: "contain", filter: "none" }} />
      <span>Trangui</span><BrandRays />
    </Link>
    <span className={`access-demo${register ? " access-demo--outline" : ""}`} aria-label="Modo demo">
      {!register ? <MonitorPlay aria-hidden="true" /> : null}<span>DEMO</span>
    </span>
  </header>;
}
