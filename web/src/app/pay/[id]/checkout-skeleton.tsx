/**
 * Esqueleto del checkout con la altura del contenido final. Se usa como
 * fallback de streaming mientras el servidor lee la orden; reservar el alto
 * evita el salto de 0.401 que provocaba el spinner de pantalla completa.
 */
export function CheckoutSkeleton() {
  return (
    <main className="pay-shell min-h-dvh bg-canvas px-[16px] pb-32 pt-8 sm:pb-8">
      <p role="status" className="sr-only">
        Preparando tu cobro…
      </p>
      <div
        className="mx-auto w-full max-w-[480px] animate-pulse"
        aria-hidden="true"
      >
        <div className="pay-header flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-surface-2" />
            <div>
              <div className="h-4 w-32 rounded bg-surface-2" />
              <div className="mt-1 h-2.5 w-24 rounded bg-surface-2" />
            </div>
          </div>
          <div className="h-3 w-14 rounded-full bg-surface-2" />
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-separator bg-surface shadow-card">
          <div className="border-b border-separator bg-canvas/60 px-[18px] py-4 sm:px-5">
            <div className="h-6 w-56 max-w-full rounded bg-surface-2" />
            <div className="mt-2 h-3 w-44 max-w-full rounded bg-surface-2" />
            <div className="mt-4">
              <div className="h-2.5 w-24 rounded-full bg-surface-2" />
              <div className="mt-2 h-9 w-40 rounded-xl bg-surface-2" />
              <div className="mt-2 h-3 w-32 rounded bg-surface-2" />
            </div>
          </div>

          <div className="px-[18px] py-4 sm:px-5">
            <div className="rounded-xl border border-separator bg-surface px-3.5 py-2">
              <div className="h-10 border-b border-separator/70 py-2">
                <div className="h-3 w-40 rounded bg-surface-2" />
              </div>
              <div className="h-10 py-2">
                <div className="h-3 w-32 rounded bg-surface-2" />
              </div>
            </div>

            <div className="mt-5 h-4 w-44 rounded bg-surface-2" />
            <div className="mt-2 space-y-2">
              <div className="h-[82px] rounded-xl bg-surface-2/70" />
              <div className="h-[82px] rounded-xl bg-surface-2/70" />
              <div className="h-[82px] rounded-xl bg-surface-2/70" />
            </div>

            <div className="mt-4 h-12 rounded-xl bg-surface-2" />
          </div>
        </div>

        <div className="mx-auto mt-4 h-3 w-64 max-w-full rounded bg-surface-2" />
      </div>
    </main>
  );
}
