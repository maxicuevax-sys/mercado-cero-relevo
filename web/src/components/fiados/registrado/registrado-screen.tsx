import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  Calendar,
  Check,
  CreditCard,
  List,
  Plus,
  ShoppingCart,
  StickyNote,
  X,
} from "lucide-react";
import { formatMxn } from "@/lib/format";
import { FiadosMobileBar } from "@/components/fiados/abono/fiados-mobile-chrome";
import { BasketCheck } from "./basket-check";
import "./registrado.css";

const PORTRAITS = ["juan", "maria", "carlos", "elena", "ana"] as const;

function portraitFor(name: string): string {
  const key = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .split(/\s+/)[0];
  return PORTRAITS.find((portrait) => portrait === key) ?? "juan";
}

export type RegistradoKind = "abono" | "fiado";

/**
 * Pantalla 20 · Fiado registrado / Abono registrado.
 *
 * La lámina muestra el modal sobre "Nuevo fiado". La ruta propia conserva esa
 * composición (fondo atenuado + tarjeta) en móvil y una tarjeta centrada en
 * escritorio. "Listo" continúa a `/fiados`; el enlace secundario abre la
 * libreta del cliente en `/fiados/<slug>`.
 */
export function RegistradoScreen({
  kind,
  name,
  balanceCents,
  amountCents,
  note,
  dateLabel,
  methodLabel,
  initial,
  listHref,
  closeHref,
}: {
  kind: RegistradoKind;
  name: string;
  balanceCents: number;
  amountCents: number;
  note: string | null;
  dateLabel: string;
  methodLabel: string | null;
  initial: string;
  listHref: string;
  closeHref: string;
}) {
  const isAbono = kind === "abono";
  const title = isAbono ? "Abono registrado" : "Fiado registrado";
  const subtitle = isAbono
    ? "El abono se guardó en tu libreta de fiados."
    : "La venta se guardó en el historial de fiados.";
  const firstName = name.trim().split(/\s+/)[0] || name;
  const portrait = portraitFor(name);

  return (
    <div className="mc-flow mc-reg">
      <FiadosMobileBar initial={initial} />

      <div className="mc-reg__behind" aria-hidden="true">
        <div className="mc-reg__behind-head">
          <ArrowLeft />
          <span>{isAbono ? "Fiado de " + firstName : "Nuevo fiado"}</span>
        </div>
        <div className="mc-reg__behind-cta">
          <Plus />
          <span>{isAbono ? "Registrar abono" : "Registrar fiado"}</span>
        </div>
      </div>
      <div className="mc-reg__scrim" aria-hidden="true" />

      <section className="mc-reg__sheet" aria-labelledby="registrado-title">
        <Link className="mc-reg__close" href={closeHref} prefetch={false} aria-label="Cerrar">
          <X aria-hidden="true" />
        </Link>

        <div className="mc-reg__art">
          {isAbono ? (
            <span className="mc-reg__coins">
              <Image
                src="/assets/spec/fiados-monedas.png"
                width={320}
                height={200}
                alt=""
                unoptimized
              />
              <span className="mc-reg__coins-badge" aria-hidden="true">
                <Check />
              </span>
            </span>
          ) : (
            <BasketCheck className="mc-reg__basket" />
          )}
        </div>

        <h1 id="registrado-title" className="mc-reg__title">{title}</h1>
        <p className="mc-reg__subtitle">{subtitle}</p>

        <section className="mc-reg__client" aria-label={`${name}, nuevo saldo`}>
          <Image
            src={`/assets/spec/fiados-retrato-${portrait}.png`}
            width={121}
            height={111}
            alt=""
            unoptimized
            className="mc-reg__portrait"
          />
          <div className="mc-reg__client-main">
            <p className="mc-reg__client-name">{name}</p>
            <p className="mc-reg__client-label">Nuevo saldo</p>
          </div>
          <p className={`mc-reg__pill${isAbono ? " mc-reg__pill--green" : ""}`}>
            {formatMxn(balanceCents)}
          </p>
        </section>

        <dl className="mc-reg__rows">
          <div className="mc-reg__row">
            <dt>
              {isAbono ? (
                <Banknote aria-hidden="true" />
              ) : (
                <ShoppingCart aria-hidden="true" />
              )}
              {isAbono ? "Abono recibido" : "Venta a fiado"}
            </dt>
            <dd>{formatMxn(amountCents)}</dd>
          </div>
          {isAbono ? (
            <div className="mc-reg__row">
              <dt>
                {methodLabel === "Tarjeta" ? (
                  <CreditCard aria-hidden="true" />
                ) : (
                  <Banknote aria-hidden="true" />
                )}
                Método
              </dt>
              <dd>{methodLabel ?? "Efectivo"}</dd>
            </div>
          ) : null}
          <div className="mc-reg__row">
            <dt>
              <Calendar aria-hidden="true" />
              Fecha
            </dt>
            <dd>{dateLabel}</dd>
          </div>
          {isAbono ? null : (
            <div className="mc-reg__row">
              <dt>
                <StickyNote aria-hidden="true" />
                Nota
              </dt>
              <dd>{note || "Sin nota"}</dd>
            </div>
          )}
        </dl>

        <div className="mc-reg__actions">
          <Link className="mc-reg__primary" href="/fiados" prefetch={false}>
            <Check aria-hidden="true" />
            Listo
          </Link>
          <Link className="mc-reg__secondary" href={listHref} prefetch={false}>
            <List aria-hidden="true" />
            Ver fiados de {firstName}
          </Link>
        </div>
      </section>
    </div>
  );
}
