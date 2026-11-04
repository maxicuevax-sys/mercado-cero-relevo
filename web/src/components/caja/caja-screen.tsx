"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { DashboardData } from "@/lib/dashboard";
import type { Order } from "@/lib/types";
import { AppShell } from "@/components/shell/app-shell";
import { TopBar } from "@/components/shell/top-bar";
import { PageHeader } from "@/components/shell/page-header";
import {
  cajaFoot,
  cajaMobileMore,
  cajaMobilePrimary,
  cajaNav,
} from "@/components/shell/nav";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { formatLongDate } from "@/lib/format";
import { SaleLineItems } from "./sale-line-items";
import { SaleSummary } from "./sale-summary";
import { PaymentPanel } from "./payment-panel";
import { SaleResult } from "./sale-result";
import {
  draftTotalCents,
  parseMoneyCents,
  parseQuantity,
  type DraftLine,
  type PaymentChoice,
} from "./types";
import "@/app/inicio/inicio.css";
import "./caja.css";

const DRAFT_KEY = "mercado-cero:caja-draft:v2";
const REQUEST_KEY = "mercado-cero:caja-request:v2";
const PENDING_KEY = "mercado-cero:caja-pending:v2";

type View = "compose" | "payment" | "result";

type StoredDraft = {
  lines: DraftLine[];
  cashInput: string;
  creditInput: string;
  customerName: string;
  method: PaymentChoice;
};

type StoredRequest = {
  requestId: string;
  signature: string;
};

export function CajaScreen({
  merchant,
  demo,
}: {
  merchant: DashboardData["merchant"];
  demo: boolean;
}) {
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [cashInput, setCashInput] = useState("");
  const [creditInput, setCreditInput] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [method, setMethod] = useState<PaymentChoice>("cash");
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [creditBalanceCents, setCreditBalanceCents] = useState(0);
  const [changeCents, setChangeCents] = useState(0);
  const [cashReceivedCents, setCashReceivedCents] = useState(0);
  const [view, setView] = useState<View>("compose");
  const [restoredNotice, setRestoredNotice] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const saleLockRef = useRef(false);
  const requestRef = useRef<StoredRequest | null>(null);

  const totalCents = useMemo(() => draftTotalCents(lines), [lines]);
  const creditCents = parseMoneyCents(creditInput);
  const cashCents = parseMoneyCents(cashInput);
  const appliedCreditCents = Math.min(Math.max(0, creditCents), totalCents);
  const appliedCashCents = Math.min(
    Math.max(0, cashCents),
    Math.max(0, totalCents - appliedCreditCents),
  );
  const changeForSale = Math.max(0, cashCents - appliedCashCents);
  const digitalDueCents = Math.max(
    0,
    totalCents - appliedCashCents - appliedCreditCents,
  );
  const overpay = creditCents > totalCents;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Partial<StoredDraft>;
        if (Array.isArray(stored.lines) && stored.lines.length > 0) {
          // El borrador vive en localStorage; el effect es la frontera con ese sistema externo.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setLines(stored.lines);
          setCashInput(typeof stored.cashInput === "string" ? stored.cashInput : "");
          setCreditInput(typeof stored.creditInput === "string" ? stored.creditInput : "");
          setCustomerName(typeof stored.customerName === "string" ? stored.customerName : "");
          setMethod(stored.method ?? "cash");
          setRestoredNotice(true);
        }
      }
    } catch {
      // Un borrador corrupto no debe bloquear una venta nueva.
      window.localStorage.removeItem(DRAFT_KEY);
    }
    setHydrated(true);

    try {
      const pendingIds = readPendingIds();
      const pendingId = pendingIds[pendingIds.length - 1];
      if (!pendingId) return;
      void fetch(`/api/orders/${pendingId}`, { cache: "no-store" })
        .then(async (response) => {
          if (response.status === 404) {
            removePendingId(pendingId);
            return null;
          }
          if (!response.ok) return null;
          return (await response.json()) as {
            order?: Order;
            credit?: { balanceCents: number } | null;
          };
        })
        .then((data) => {
          if (!data?.order) return;
          const due = Math.max(
            0,
            data.order.totalCents - data.order.paidCents - data.order.creditCents,
          );
          setOrder(data.order);
          setCreditBalanceCents(
            data.credit?.balanceCents ?? (data.order.creditCents > 0 ? data.order.creditCents : 0),
          );
          setView(due > 0 ? "payment" : "result");
        })
        .catch(() => {
          // Sin red se conserva el aviso para el siguiente intento.
        });
    } catch {
      // Un puntero corrupto no debe bloquear una venta nueva.
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (!lines.length && !cashInput && !creditInput && !customerName) {
        window.localStorage.removeItem(DRAFT_KEY);
        return;
      }
      const stored: StoredDraft = { lines, cashInput, creditInput, customerName, method };
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(stored));
    } catch {
      // Sin localStorage la venta sigue funcionando en memoria.
    }
  }, [cashInput, creditInput, customerName, hydrated, lines, method]);

  const clearDraft = useCallback(() => {
    setLines([]);
    setCashInput("");
    setCreditInput("");
    setCustomerName("");
    setMethod("cash");
    setLineErrors({});
    setError(null);
    setRestoredNotice(false);
    setOrder(null);
    setCreditBalanceCents(0);
    setChangeCents(0);
    setCashReceivedCents(0);
    setView("compose");
    requestRef.current = null;
    try {
      window.localStorage.removeItem(DRAFT_KEY);
      window.localStorage.removeItem(REQUEST_KEY);
    } catch {
      // Sin almacenamiento no hay nada que limpiar.
    }
  }, []);

  const resetSale = useCallback(() => {
    clearDraft();
    window.requestAnimationFrame(() => {
      document.getElementById("mc-caja-new-description")?.focus();
    });
  }, [clearDraft]);

  function chooseMethod(next: PaymentChoice) {
    setMethod(next);
    setError(null);
    if (next === "cash") {
      setCreditInput("");
      setCustomerName("");
    } else if (next === "digital") {
      setCashInput("");
      setCreditInput("");
      setCustomerName("");
    } else if (next === "credit") {
      setCashInput("");
      setCreditInput(totalCents > 0 ? (totalCents / 100).toFixed(2) : "");
    }
  }

  function validate(): string | null {
    if (!lines.length) return "Agrega al menos un concepto.";
    const issues: Record<string, string> = {};
    for (const line of lines) {
      if (!line.description.trim()) {
        issues[line.id] = "Escribe el concepto.";
      } else if (!parseQuantity(line.quantity)) {
        issues[line.id] = "La cantidad debe ser mayor que cero.";
      } else if (parseMoneyCents(line.price) <= 0) {
        issues[line.id] = "El precio debe ser mayor que cero.";
      }
    }
    setLineErrors(issues);
    const firstIssue = lines.find((line) => issues[line.id]);
    if (firstIssue) {
      const field = issues[firstIssue.id].includes("precio")
        ? "price"
        : issues[firstIssue.id].includes("cantidad")
          ? "quantity"
          : "description";
      window.requestAnimationFrame(() => {
        document.getElementById(`line-${field}-${firstIssue.id}`)?.focus();
      });
      return "Revisa los conceptos marcados.";
    }
    if (overpay) return "El fiado no puede superar el total.";
    if (appliedCreditCents > 0 && !customerName.trim()) {
      return "Para fiado necesito el nombre del cliente.";
    }
    if (method === "cash" && cashCents < totalCents) {
      return "El efectivo recibido no cubre el total. Agrega el faltante o elige Mixto.";
    }
    if (method === "credit" && appliedCreditCents < totalCents) {
      return "El fiado debe cubrir el total. Si hay efectivo, elige Mixto.";
    }
    if (method === "mixed" && appliedCashCents === 0 && appliedCreditCents === 0) {
      return "En Mixto agrega efectivo o fiado. Para cobrar todo en digital, elige Digital.";
    }
    return null;
  }

  async function confirmSale() {
    if (saleLockRef.current) return;
    const issue = validate();
    if (issue) {
      setError(issue);
      return;
    }
    saleLockRef.current = true;
    setSaving(true);
    setError(null);

    const payload = {
      items: lines.map((line) => ({
        description: line.description.trim(),
        quantity: parseQuantity(line.quantity),
        unitPriceCents: parseMoneyCents(line.price),
      })),
      cashCents: appliedCashCents,
      creditCents: appliedCreditCents,
      customerName: appliedCreditCents > 0 ? customerName.trim() : null,
    };
    const signature = JSON.stringify(payload);
    let requestId = newRequestId("sale");
    const request = { requestId, signature };
    try {
      const stored = requestRef.current ?? readStoredRequest();
      if (stored?.signature === signature) requestId = stored.requestId;
      else writeStoredRequest({ requestId, signature });
      requestRef.current = { requestId, signature };
    } catch {
      requestRef.current = request;
    }

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, requestId }),
      });
      const data = (await response.json()) as { order?: Order; error?: string };
      if (!response.ok || !data.order) {
        throw new Error(data.error ?? "No se pudo registrar la venta.");
      }
      let created = data.order;
      let creditBalance = created.creditCents;
      try {
        const detailResponse = await fetch(`/api/orders/${created.id}`, {
          cache: "no-store",
        });
        if (detailResponse.ok) {
          const detail = (await detailResponse.json()) as {
            order?: Order;
            credit?: { balanceCents: number } | null;
          };
          if (detail.order) created = detail.order;
          creditBalance = detail.credit?.balanceCents ?? creditBalance;
        }
      } catch {
        // La orden ya existe; si falla la lectura, se muestra la respuesta del POST.
      }
      requestRef.current = null;
      const due = Math.max(
        0,
        created.totalCents - created.paidCents - created.creditCents,
      );
      setOrder(created);
      setCreditBalanceCents(creditBalance);
      setChangeCents(changeForSale);
      setCashReceivedCents(cashCents);
      setView(due > 0 ? "payment" : "result");
      try {
        if (due > 0) {
          const pendingIds = readPendingIds();
          pendingIds.push(created.id);
          writePendingIds(pendingIds);
        }
      } catch {
        // Sin storage el resultado vive en memoria.
      }
      setLines([]);
      setCashInput("");
      setCreditInput("");
      setCustomerName("");
      setLineErrors({});
      setRestoredNotice(false);
      requestRef.current = null;
      try {
        window.localStorage.removeItem(DRAFT_KEY);
        window.localStorage.removeItem(REQUEST_KEY);
      } catch {
        // Sin storage no hay llave que limpiar.
      }
    } catch (caught) {
      setError(friendlySaleError(caught));
    } finally {
      saleLockRef.current = false;
      setSaving(false);
    }
  }

  useEffect(() => {
    if (view !== "result" && view !== "payment") return;
    const id = view === "result" ? "mc-caja-result-title" : "mc-caja-payment-title";
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.focus();
    });
  }, [view, order?.id]);

  const handleOrderUpdate = useCallback(
    (next: Order, balance?: number | null) => {
      setOrder(next);
      setCreditBalanceCents(
        balance ?? (next.creditCents > 0 ? next.creditCents : 0),
      );
      const due = Math.max(
        0,
        next.totalCents - next.paidCents - next.creditCents,
      );
      if (
        due <= 0 ||
        next.status === "paid" ||
        next.status === "demo_paid" ||
        next.status === "fulfilled"
      ) {
        setView("result");
        removePendingId(next.id);
      }
    },
    [],
  );

  function goToPayment() {
    const target = document.getElementById("mc-caja-payment-summary");
    if (!target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    window.requestAnimationFrame(() => {
      target.querySelector<HTMLElement>(".mc-caja-method--active")?.focus({ preventScroll: true });
    });
  }

  const canConfirm =
    lines.length > 0 &&
    totalCents > 0 &&
    !overpay &&
    !saving &&
    (appliedCreditCents === 0 || customerName.trim().length > 0) &&
    (method !== "cash" || cashCents >= totalCents) &&
    (method !== "credit" || appliedCreditCents >= totalCents) &&
    (method !== "mixed" || appliedCashCents > 0 || appliedCreditCents > 0);

  const initial = (merchant.owner || "M").trim().charAt(0).toUpperCase() || "M";
  const headerTotalCents = order ? order.totalCents : totalCents;

  return (
    <AppShell
      activeHref="/caja"
      mainId="caja-main"
      contentClassName="mc-caja"
      nav={cajaNav}
      foot={cajaFoot}
      mobilePrimaryItems={cajaMobilePrimary}
      mobileMoreItems={cajaMobileMore}
      topbar={
        <TopBar
          merchant={merchant.name}
          address={merchant.address}
          initial={initial}
          demo={demo}
        />
      }
    >
      <PageHeader
        eyebrow="Caja"
        title={view === "compose" ? "Nueva venta" : view === "payment" ? "Cobrar venta" : "Venta registrada"}
        titleId="caja-title"
        subtitle={
          view === "compose"
            ? `${formatLongDate()}. Agrega lo que vendiste, revisa el total y elige cómo te pagan.`
            : view === "payment"
              ? "El pedido ya está registrado. El pago sigue pendiente hasta que el banco lo confirme."
              : "Revisa el resultado antes de entregar o iniciar otra venta."
        }
        actions={
          view === "compose" ? (
            <a
              href="#mc-caja-payment-summary"
              className="mc-caja-total-chip"
            >
              <span>Total</span>
              <CurrencyAmount cents={headerTotalCents} />
              <span className="mc-caja-total-chip__cta">Ver cobro</span>
            </a>
          ) : (
            <div className="mc-caja-total-chip">
              <span>Total</span>
              <CurrencyAmount cents={headerTotalCents} />
            </div>
          )
        }
      />

      {restoredNotice && view === "compose" ? (
        <div className="mc-caja-restore" role="status">
          <p>Recuperamos una venta sin confirmar.</p>
          <div>
            <button
              type="button"
              className="mc-caja-button mc-caja-button--secondary"
              onClick={() => {
                setRestoredNotice(false);
                window.requestAnimationFrame(() => {
                  const first = lines[0];
                  const target = first
                    ? document.getElementById(`line-description-${first.id}`)
                    : document.getElementById("mc-caja-new-description");
                  target?.focus();
                });
              }}
            >
              Seguir
            </button>
            <button type="button" className="mc-caja-clear" onClick={clearDraft}>
              Empezar de nuevo
            </button>
          </div>
        </div>
      ) : null}

      {view === "compose" ? (
        <div className="mc-caja-grid">
          <SaleLineItems
            lines={lines}
            errors={lineErrors}
            disabled={saving}
            onAdd={(line) => {
              setLines((current) => [...current, line]);
              setError(null);
              setAnnouncement("Concepto agregado.");
              window.requestAnimationFrame(() => {
                document.getElementById(`line-description-${line.id}`)?.focus();
              });
            }}
            onUpdate={(id, patch) => {
              setLines((current) =>
                current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
              );
              setLineErrors((current) => {
                if (!current[id]) return current;
                const next = { ...current };
                delete next[id];
                return next;
              });
              setError(null);
            }}
            onRemove={(id) => {
              const index = lines.findIndex((line) => line.id === id);
              const next = lines[index + 1] ?? lines[index - 1];
              setLines((current) => current.filter((line) => line.id !== id));
              setError(null);
              setAnnouncement("Concepto eliminado.");
              window.requestAnimationFrame(() => {
                const target = next
                  ? document.getElementById(`line-description-${next.id}`)
                  : document.getElementById("mc-caja-new-description");
                target?.focus();
              });
            }}
          />
          <SaleSummary
            totalCents={totalCents}
            appliedCashCents={appliedCashCents}
            appliedCreditCents={appliedCreditCents}
            changeCents={changeForSale}
            digitalDueCents={digitalDueCents}
            method={method}
            cashInput={cashInput}
            creditInput={creditInput}
            customerName={customerName}
            error={error}
            saving={saving}
            canConfirm={canConfirm}
            onMethod={chooseMethod}
            onCash={(value) => {
              setCashInput(value);
              setError(null);
            }}
            onCredit={(value) => {
              setCreditInput(value);
              setError(null);
            }}
            onCustomer={(value) => {
              setCustomerName(value);
              setError(null);
            }}
            onConfirm={() => void confirmSale()}
            onClear={() => {
              if (window.confirm("¿Descartar la venta sin confirmar?")) clearDraft();
            }}
          />
        </div>
      ) : null}

      {view === "payment" && order ? (
        <PaymentPanel order={order} demo={demo} onOrder={handleOrderUpdate} />
      ) : null}

      {view === "result" && order ? (
        <SaleResult
          order={order}
          changeCents={changeCents}
          cashReceivedCents={cashReceivedCents}
          creditBalanceCents={creditBalanceCents}
          demo={demo}
          onNewSale={resetSale}
        />
      ) : null}

      {view === "compose" && lines.length > 0 ? (
        <div className="mc-caja-paybar">
          <div>
            <span>Total</span>
            <CurrencyAmount cents={totalCents} />
          </div>
          <button
            type="button"
            className="mc-caja-button mc-caja-button--secondary"
            onClick={goToPayment}
          >
            Revisar cobro
          </button>
        </div>
      ) : null}

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      <div className="mc-caja-footnote">
        <p>
          {lines.length ? `${lines.length} conceptos en curso. ` : ""}
          El total es lo que debe pagar el cliente; no es dinero recibido hasta que el método lo
          confirme.
        </p>
        <p>
          ¿Necesitas dictar o verificar un comprobante? Usa la{" "}
          <Link href="/">Caja clásica</Link>; los borradores de cada pantalla son independientes.
        </p>
      </div>
    </AppShell>
  );
}

function readPendingIds(): string[] {
  const raw = window.localStorage.getItem(PENDING_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as { orderIds?: string[]; orderId?: string };
  if (Array.isArray(parsed.orderIds)) {
    return parsed.orderIds.filter((id): id is string => typeof id === "string");
  }
  return typeof parsed.orderId === "string" ? [parsed.orderId] : [];
}

function writePendingIds(orderIds: string[]) {
  if (orderIds.length === 0) {
    window.localStorage.removeItem(PENDING_KEY);
    return;
  }
  window.localStorage.setItem(PENDING_KEY, JSON.stringify({ orderIds }));
}

function removePendingId(orderId: string) {
  try {
    writePendingIds(readPendingIds().filter((id) => id !== orderId));
  } catch {
    // Sin storage no hay puntero que limpiar.
  }
}

function friendlySaleError(caught: unknown): string {
  if (caught instanceof Error) {
    const message = caught.message;
    if (/failed to fetch|load failed|networkerror|network request failed/i.test(message)) {
      return "No sabemos si la venta quedó registrada. Revisa tu conexión y toca Reintentar. Si cambias los productos o el monto, revisa Ventas antes de cobrar otra vez.";
    }
    if (/identificador de solicitud|requestId/i.test(message)) {
      return "Esta venta ya se había registrado con otros datos. No se creó otra. Revisa Ventas antes de volver a cobrar.";
    }
    return message;
  }
  return "No sabemos si la venta quedó registrada. Revisa tu conexión y toca Reintentar.";
}

function newRequestId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function readStoredRequest(): StoredRequest | null {
  const raw = window.localStorage.getItem(REQUEST_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as Partial<StoredRequest>;
  if (!parsed.requestId || !parsed.signature) return null;
  return { requestId: parsed.requestId, signature: parsed.signature };
}

function writeStoredRequest(request: StoredRequest) {
  window.localStorage.setItem(REQUEST_KEY, JSON.stringify(request));
}
