import type { Metadata } from "next";
import Link from "next/link";
import "@/app/checkout.css";

export const metadata: Metadata = {
  title: "Cobro no encontrado · Trangui",
  description: "Este link no corresponde a un cobro de Trangui.",
};

export default function CheckoutNotFound() {
  return (
    <main className="pay-shell grid min-h-dvh place-items-center px-[16px] py-8">
      <section className="receipt-stack receipt-stack--layered w-full">
        <div className="receipt-paper">
          <div className="receipt-paper__perf" aria-hidden="true" />
          <div className="receipt-result">
            <div className="receipt-result__stamp">
              <span className="stamp stamp--cash">Extraviado</span>
            </div>
            <p className="receipt-result__method">Cobro no disponible</p>
            <h1>No encontramos este cobro</h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">
              Este link no corresponde a un cobro de Trangui. Pide a la
              comerciante que genere uno nuevo.
            </p>
          </div>
          <div className="receipt-body">
            <Link href="/" className="result-exit">
              Volver
            </Link>
            <p className="mt-3 text-center text-xs leading-relaxed text-ink-2">
              Si llegaste desde una tienda, pide un link nuevo antes de pagar.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
