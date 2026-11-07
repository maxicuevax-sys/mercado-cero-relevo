import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { FiadosMobileBar } from "./fiados-mobile-chrome";
import "./abono.css";

/** Estado sin fiado abierto para la ruta de abono (no inventa un crédito). */
export function AbonoEmpty({
  initial,
  name,
  backHref,
}: {
  initial: string;
  name: string;
  backHref: string;
}) {
  return (
    <div className="mc-flow mc-abono">
      <FiadosMobileBar initial={initial} />
      <div className="mc-abono__sheet">
        <header className="mc-abono__head">
          <Link className="mc-abono__back" href={backHref} prefetch={false} aria-label="Volver a Fiados">
            <ArrowLeft aria-hidden="true" />
          </Link>
          <h1 className="mc-abono__title">Registrar abono</h1>
        </header>
        <div className="mc-abono__body">
          <section className="mc-abono__empty" role="status">
            <BookOpen aria-hidden="true" />
            <p className="mc-abono__empty-title">Sin fiado pendiente de {name}</p>
            <p className="mc-abono__empty-body">
              Cuando anotes una venta a fiado, su saldo aparecerá aquí para registrar
              abonos.
            </p>
            <Link className="mc-abono__empty-link" href="/fiados" prefetch={false}>
              Volver a Fiados
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
