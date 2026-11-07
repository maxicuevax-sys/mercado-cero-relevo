"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard";
import type { Order } from "@/lib/types";
import { AppShell } from "@/components/shell/app-shell";
import { TopBar } from "@/components/shell/top-bar";
import { PageHeader } from "@/components/shell/page-header";
import { BrandLockup } from "@/components/shell/brand-lockup";
import {
  cajaFoot,
  cajaMobileMore,
  
  cajaNav,
} from "@/components/shell/nav";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { formatLongDate } from "@/lib/format";
import { SaleLineItems } from "./sale-line-items";
import { SaleVoice } from "./sale-voice";
import { CajaSpecCheckout } from "./caja-spec-checkout";
import { SaleSummary } from "./sale-summary";
import { PaymentMethodScreen } from "./payment-method-screen";
import "./payment-states.css";
import { PaymentPanel } from "./payment-panel";
import { PendingTray, type PendingEntry } from "./pending-tray";
import { SaleResult } from "./sale-result";
import {
  draftTotalCents,
  newLineId,
  parseMoneyCents,
  parseQuantity,
  type DraftLine,
  type PaymentChoice,
} from "./types";
import "@/app/inicio/inicio.css";
import "./caja.css";
import "./caja-spec.css";

const DRAFT_KEY = "mercado-cero:caja-draft:v2";
const REQUEST_KEY = "mercado-cero:caja-request:v2";
const PENDING_KEY = "mercado-cero:caja-pending:v2";
const UNKNOWN_KEY = "mercado-cero:caja-unknown:v2";
const CONFIRMED_KEY = "mercado-cero:caja-confirmed:v2";
const LEGACY_DRAFT_KEY = "mercado-cero:draft:v1";
const LEGACY_REQUEST_KEY = "mercado-cero:sale-request:v1";

type View = "compose" | "method" | "payment" | "result";

type StoredDraft = {
  instanceId: string;
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

type UnknownResult = {
  requestId: string;
  signature: string;
  message: string;
};

type ConfirmedSale = {
  instanceId: string;
  requestId: string;
  signature: string;
  orderId: string;
  confirmedAt: string;
};

const CONFIRMED_TTL_MS = 10 * 60 * 1000;

type LegacyImport = {
  draft: StoredDraft;
  request: StoredRequest | null;
};

const TERMINAL_ORDER_STATUSES = new Set<Order["status"]>([
  "paid",
  "demo_paid",
  "fulfilled",
  "cancelled",
]);

export function CajaScreen({
  merchant,
  demo,
}: {
  merchant: DashboardData["merchant"];
  demo: boolean;
}) {
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [draftInstanceId, setDraftInstanceId] = useState(() => newInstanceId());
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
  const [legacyNotice, setLegacyNotice] = useState<string | null>(null);
  const [legacyConflict, setLegacyConflict] = useState(false);
  const [pendingEntries, setPendingEntries] = useState<PendingEntry[]>([]);
  const [unknownResult, setUnknownResult] = useState<UnknownResult | null>(null);
  const [reconcileMessage, setReconcileMessage] = useState<string | null>(null);
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
  // El fantasma aparece cuando el fiado ya cubre todo y, aun así, se quiere
  // devolver el efectivo completo como cambio. En un split válido el fiado
  // solo cubre una parte y el efectivo tendido puede incluir cambio real.
  const creditCoversAllWithCash =
    method === "mixed" &&
    totalCents > 0 &&
    appliedCreditCents >= totalCents &&
    cashCents > 0;
  const changeForSale = creditCoversAllWithCash
    ? 0
    : Math.max(0, cashCents - appliedCashCents);
  const digitalDueCents = Math.max(
    0,
    totalCents - appliedCashCents - appliedCreditCents,
  );
  const overpay = creditCents > totalCents;

  useEffect(() => {
    let active = true;
    let hasV2Draft = false;

    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      const storedDraft = raw ? parseStoredDraft(raw) : null;
      if (storedDraft && storedDraft.lines.length > 0 && (demo || !storedDraft.lines.some(line => line.id.startsWith("spec-demo-")))) {
        // El borrador vive en localStorage; el effect es la frontera con ese sistema externo.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLines(storedDraft.lines);
        setDraftInstanceId(storedDraft.instanceId);
        setCashInput(storedDraft.cashInput);
        setCreditInput(storedDraft.creditInput);
        setCustomerName(storedDraft.customerName);
        setMethod(storedDraft.method);
        setRestoredNotice(true);
        hasV2Draft = true;
      }
    } catch {
      // Un borrador corrupto no debe bloquear una venta nueva.
      window.localStorage.removeItem(DRAFT_KEY);
    }

    try {
      const legacy = readLegacyImport();
      if (legacy) {
        if (!hasV2Draft) {
          // Una sola fuente visible: el borrador de la Caja clásica se importa
          // a /caja, conservando la llave de idempotencia si coincide.
          setLines(legacy.draft.lines);
          setDraftInstanceId(legacy.draft.instanceId);
          setCashInput(legacy.draft.cashInput);
          setCreditInput(legacy.draft.creditInput);
          setCustomerName(legacy.draft.customerName);
          setMethod(legacy.draft.method);
          setRestoredNotice(true);
          if (legacy.request) {
            requestRef.current = legacy.request;
            writeStoredRequest(legacy.request);
          }
          window.localStorage.removeItem(LEGACY_DRAFT_KEY);
          setLegacyNotice("Recuperamos el borrador que estaba en la Caja clásica. Esta pantalla es ahora la única que lo usa.");
          hasV2Draft = true;
        } else {
          setLegacyConflict(true);
          setLegacyNotice(
            "También hay un borrador distinto en la Caja clásica. No se mezcló con este y la confirmación queda bloqueada hasta que elijas cuál usar.",
          );
        }
      }
    } catch {
      // Un borrador legacy corrupto no debe bloquear /caja.
    }

    // Ticket inicial vacío: el comerciante decide qué vender.
    setHydrated(true);

    try {
      const unknown = readStoredUnknown();
      if (unknown) {
        // La llave del intento desconocido es durable: si el storage de la
        // solicitud se perdió, se reconstruye desde el aviso para reconciliar.
        setUnknownResult(unknown);
        requestRef.current = {
          requestId: unknown.requestId,
          signature: unknown.signature,
        };
        writeStoredRequest(requestRef.current);
      }
    } catch {
      window.localStorage.removeItem(UNKNOWN_KEY);
    }

    try {
      const pendingIds = readPendingIds();
      if (pendingIds.length > 0) {
        void loadPendingEntries(pendingIds).then((entries) => {
          if (active) setPendingEntries(entries);
        });
      }
    } catch {
      // Un puntero corrupto no debe bloquear una venta nueva.
    }

    return () => {
      active = false;
    };
  }, [demo]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (!lines.length && !cashInput && !creditInput && !customerName) {
        window.localStorage.removeItem(DRAFT_KEY);
        return;
      }
      const stored: StoredDraft = {
        instanceId: draftInstanceId,
        lines,
        cashInput,
        creditInput,
        customerName,
        method,
      };
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(stored));
    } catch {
      // Sin localStorage la venta sigue funcionando en memoria.
    }
  }, [cashInput, creditInput, customerName, draftInstanceId, hydrated, lines, method]);

  const clearDraft = useCallback(() => {
    setLines([]);
    setDraftInstanceId(newInstanceId());
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

  const requestClearDraft = useCallback(() => {
    if (window.confirm("¿Descartar la venta sin confirmar?")) clearDraft();
  }, [clearDraft]);

  function discardLegacyDraft() {
    if (
      !window.confirm(
        "¿Descartar el borrador de la Caja clásica? Esta venta de la Caja nueva no se toca.",
      )
    ) {
      return;
    }
    try {
      window.localStorage.removeItem(LEGACY_DRAFT_KEY);
    } catch {
      // Sin storage no hay borrador que descartar.
    }
    setLegacyConflict(false);
    setLegacyNotice("Se descartó el borrador de la Caja clásica. Esta venta sigue intacta.");
  }

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
    if (creditCoversAllWithCash) {
      return "El fiado ya cubre el total y no se aplicó el efectivo. Ajusta el monto a fiado o el efectivo.";
    }
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
    saleLockRef.current = true;
    try {
      const locks = (
        navigator as Navigator & {
          locks?: {
            request: <T>(name: string, callback: () => Promise<T>) => Promise<T>;
          };
        }
      ).locks;
      if (locks) {
        await locks.request("mercado-cero:caja-sale", runSale);
      } else {
        await runSale();
      }
    } catch (caught) {
      setError(friendlySaleError(caught));
    } finally {
      saleLockRef.current = false;
    }
  }

  async function runSale() {
    const issue = validate();
    if (issue) {
      setError(issue);
      return;
    }
    setSaving(true);
    setError(null);

    const { payload, signature } = buildSalePayload(
      lines,
      cashInput,
      creditInput,
      customerName,
    );
    // Otra pestaña pudo dejar un intento ambiguo con la misma venta. No se
    // vuelve a enviar hasta reconciliar; esta pestaña sí puede reintentar.
    if (!unknownResult) {
      const priorUnknown = readStoredUnknown();
      if (priorUnknown?.signature === signature) {
        setUnknownResult(priorUnknown);
        requestRef.current = {
          requestId: priorUnknown.requestId,
          signature: priorUnknown.signature,
        };
        writeStoredRequest(requestRef.current);
        setReconcileMessage(
          "Otra pestaña ya intentó esta venta y el resultado es desconocido. Consulta si se registró antes de reintentar.",
        );
        return;
      }
    }

    let requestId = newRequestId("sale");
    const confirmed = readConfirmedSale();
    if (
      confirmed?.signature === signature &&
      confirmed.instanceId === draftInstanceId
    ) {
      // La misma venta ya se confirmó en esta o en otra pestaña.
      requestId = confirmed.requestId;
      requestRef.current = { requestId, signature };
      try {
        writeStoredRequest(requestRef.current);
      } catch {
        // Sin storage la llave sigue en memoria.
      }
    } else {
      const request = { requestId, signature };
      try {
        const stored = requestRef.current ?? readStoredRequest();
        if (stored?.signature === signature) requestId = stored.requestId;
        else writeStoredRequest({ requestId, signature });
        requestRef.current = { requestId, signature };
      } catch {
        requestRef.current = request;
      }
    }

    try {
      let response: Response;
      try {
        response = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, requestId }),
        });
      } catch {
        const unknown: UnknownResult = {
          requestId,
          signature,
          message:
            "La conexión falló después de enviar la venta. El servidor pudo haberla registrado.",
        };
        setUnknownResult(unknown);
        writeStoredUnknown(unknown);
        setReconcileMessage(
          "No edites ni cobres otra vez todavía. Consulta si la venta se registró.",
        );
        return;
      }

      if (response.status === 502 || response.status === 503 || response.status === 504) {
        const unknown: UnknownResult = {
          requestId,
          signature,
          message: `El servidor respondió ${response.status} después de recibir la venta. El resultado es desconocido.`,
        };
        setUnknownResult(unknown);
        writeStoredUnknown(unknown);
        setReconcileMessage(
          "No edites ni cobres otra vez todavía. Consulta si la venta se registró.",
        );
        return;
      }

      const data = (await response.json()) as { order?: Order; error?: string };
      if (!response.ok || !data.order) {
        throw new Error(data.error ?? "No se pudo registrar la venta.");
      }
      setUnknownResult(null);
      setReconcileMessage(null);
      writeStoredUnknown(null);
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
      try {
        writeConfirmedSale({
          instanceId: draftInstanceId,
          requestId,
          signature,
          orderId: created.id,
          confirmedAt: new Date().toISOString(),
        });
      } catch {
        // Sin storage la protección vive solo en esta pestaña.
      }
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
          if (!pendingIds.includes(created.id)) {
            writePendingIds([...pendingIds, created.id]);
          }
          setPendingEntries((current) => [
            { id: created.id, order: created, creditBalanceCents: creditBalance },
            ...current.filter((entry) => entry.id !== created.id),
          ]);
        } else {
          removePendingId(created.id);
          setPendingEntries((current) => current.filter((entry) => entry.id !== created.id));
        }
      } catch {
        // Sin storage el resultado vive en memoria.
      }
      setLines([]);
      setDraftInstanceId(newInstanceId());
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
        next.status === "fulfilled" ||
        next.status === "cancelled"
      ) {
        setView("result");
        removePendingId(next.id);
        setPendingEntries((current) => current.filter((entry) => entry.id !== next.id));
      } else {
        setPendingEntries((current) =>
          current.map((entry) =>
            entry.id === next.id
              ? { ...entry, order: next, creditBalanceCents: balance ?? entry.creditBalanceCents }
              : entry,
          ),
        );
      }
    },
    [],
  );

  const openPendingEntry = useCallback((entry: PendingEntry) => {
    if (!entry.order) return;
    const due = Math.max(
      0,
      entry.order.totalCents - entry.order.paidCents - entry.order.creditCents,
    );
    setOrder(entry.order);
    setCreditBalanceCents(entry.creditBalanceCents);
    setChangeCents(0);
    setCashReceivedCents(0);
    setUnknownResult(null);
    setReconcileMessage(null);
    setView(due > 0 ? "payment" : "result");
  }, []);

  const refreshPending = useCallback(async () => {
    try {
      const ids = readPendingIds();
      const entries = await loadPendingEntries(ids);
      setPendingEntries(entries);
      setAnnouncement(
        entries.length === 1
          ? "Lista actualizada. Hay 1 cobro pendiente."
          : `Lista actualizada. Hay ${entries.length} cobros pendientes.`,
      );
    } catch {
      setAnnouncement("No se pudo actualizar la lista de pendientes.");
    }
  }, []);

  const reconcileUnknown = useCallback(async () => {
    if (!unknownResult) return;
    setReconcileMessage("Consultando el estado de la venta…");
    try {
      const response = await fetch(
        `/api/orders?requestId=${encodeURIComponent(unknownResult.requestId)}`,
        { cache: "no-store" },
      );
      if (response.status === 404) {
        requestRef.current = null;
        try {
          window.localStorage.removeItem(REQUEST_KEY);
        } catch {
          // Sin storage no hay llave que limpiar.
        }
        setUnknownResult(null);
        writeStoredUnknown(null);
        setReconcileMessage(
          "No se encontró una venta con esa llave. Puedes corregir los datos y confirmar de nuevo con una llave nueva.",
        );
        return;
      }
      if (!response.ok) {
        setReconcileMessage(
          "No pudimos consultar el estado. No edites ni cobres otra vez; reintenta la consulta.",
        );
        return;
      }
      const data = (await response.json()) as { order?: Order };
      if (!data.order) {
        setReconcileMessage(
          "La consulta no devolvió la venta. No edites ni cobres otra vez; revisa Ventas.",
        );
        return;
      }

      let recovered = data.order;
      let balance = recovered.creditCents;
      try {
        const detailResponse = await fetch(`/api/orders/${recovered.id}`, {
          cache: "no-store",
        });
        if (detailResponse.ok) {
          const detail = (await detailResponse.json()) as {
            order?: Order;
            credit?: { balanceCents: number } | null;
          };
          if (detail.order) recovered = detail.order;
          balance = detail.credit?.balanceCents ?? balance;
        }
      } catch {
        // La venta ya está recuperada; el saldo se toma del listado.
      }

      const due = Math.max(
        0,
        recovered.totalCents - recovered.paidCents - recovered.creditCents,
      );
      if (due > 0) {
        const pendingIds = readPendingIds();
        if (!pendingIds.includes(recovered.id)) {
          writePendingIds([...pendingIds, recovered.id]);
        }
        setPendingEntries((current) => [
          { id: recovered.id, order: recovered, creditBalanceCents: balance },
          ...current.filter((entry) => entry.id !== recovered.id),
        ]);
      } else {
        removePendingId(recovered.id);
        setPendingEntries((current) => current.filter((entry) => entry.id !== recovered.id));
      }

      setUnknownResult(null);
      writeStoredUnknown(null);
      setReconcileMessage(null);
      setOrder(recovered);
      setCreditBalanceCents(balance);
      setChangeCents(0);
      setCashReceivedCents(0);
      setView(due > 0 ? "payment" : "result");
      setLines([]);
      setCashInput("");
      setCreditInput("");
      setCustomerName("");
      setLineErrors({});
      setRestoredNotice(false);
      setLegacyNotice(null);
      requestRef.current = null;
      try {
        window.localStorage.removeItem(DRAFT_KEY);
        window.localStorage.removeItem(REQUEST_KEY);
      } catch {
        // Sin storage no hay llave que limpiar.
      }
      setAnnouncement(
        due > 0
          ? "La venta sí estaba registrada. Se recuperó el cobro pendiente."
          : "La venta sí estaba registrada. Se recuperó el resultado.",
      );
    } catch {
      setReconcileMessage(
        "No pudimos consultar el estado. No edites ni cobres otra vez; reintenta la consulta.",
      );
    }
  }, [unknownResult]);

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
    !creditCoversAllWithCash &&
    !saving &&
    !unknownResult &&
    !legacyConflict &&
    (appliedCreditCents === 0 || customerName.trim().length > 0) &&
    (method !== "cash" || cashCents >= totalCents) &&
    (method !== "credit" || appliedCreditCents >= totalCents) &&
    (method !== "mixed" || appliedCashCents > 0 || appliedCreditCents > 0);

  useEffect(() => {
    if (view === "compose") return;
    const heading = document.getElementById("caja-title");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus();
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view]);

  const initial = (merchant.owner || "M").trim().charAt(0).toUpperCase() || "M";
  const headerTotalCents = order ? order.totalCents : totalCents;

  return (
    <AppShell
      className="mc-caja-shell inicio-shell--desktop"
      activeHref="/caja"
      mainId="caja-main"
      contentClassName="mc-caja"
      nav={cajaNav}
      foot={cajaFoot}
      mobileMoreItems={cajaMobileMore}
      topbar={
        <><TopBar
          merchant={merchant.name}
          address={merchant.address}
          initial={initial}
          demo={demo}
        /><header className="mc-caja-spec-header">
          <BrandLockup />
          <div className="mc-caja-spec-header__actions">
            <Link href="/pendientes" aria-label="Ver pendientes"><Bell aria-hidden="true" /></Link>
            <span className="mc-caja-spec-avatar" title={demo ? "Modo demo: datos simulados" : merchant.name}>{initial}</span>
          </div>
        </header></>
      }
    >
      <div className="mc-caja-heading">
      {view === "method" ? <button type="button" className="mc-caja-back" aria-label="Volver a Nueva venta" disabled={saving} onClick={() => { setView("compose"); window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".mc-spec-register")?.focus()); }}><ArrowLeft aria-hidden="true" /></button> : <Link href="/inicio" className="mc-caja-back" aria-label="Volver a Inicio"><ArrowLeft aria-hidden="true" /></Link>}
      <PageHeader
        eyebrow="Caja"
        title={view === "compose" ? "Nueva venta" : view === "method" ? "Método de pago" : view === "payment" ? "Pago QR" : order?.status === "demo_paid" ? "Pago demo" : order?.status === "paid" ? "Pago confirmado" : "Venta registrada"}
        titleId="caja-title"
        subtitle={
          view === "compose"
            ? `${formatLongDate()}. Revisa el total antes de cobrar.`
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
      </div>

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

      {legacyNotice ? (
        <div className="mc-caja-restore" role="status">
          <p>{legacyNotice}</p>
          <div>
            {legacyConflict ? (
              <>
                <button
                  type="button"
                  className="mc-caja-button mc-caja-button--secondary"
                  onClick={() => {
                    try {
                      window.localStorage.removeItem(LEGACY_DRAFT_KEY);
                    } catch {
                      // Sin storage no hay borrador legacy que descartar.
                    }
                    setLegacyConflict(false);
                    setLegacyNotice(
                      "Usarás esta venta. El borrador de la Caja clásica quedó descartado.",
                    );
                  }}
                >
                  Usar esta venta
                </button>
                <button type="button" className="mc-caja-clear" onClick={discardLegacyDraft}>
                  Descartar la de la Caja clásica
                </button>
              </>
            ) : null}
            <Link href="/" className="mc-caja-button mc-caja-button--secondary">
              Abrir Caja clásica
            </Link>
            <button
              type="button"
              className="mc-caja-clear"
              onClick={() => setLegacyNotice(null)}
            >
              Entendido
            </button>
          </div>
        </div>
      ) : null}

      {unknownResult ? (
        <section className="mc-caja-card mc-caja-unknown" role="alert">
          <p className="mc-caja-eyebrow">Estado desconocido</p>
          <h2>No sabemos si la venta quedó registrada</h2>
          <p>{unknownResult.message}</p>
          <p>
            La llave de esta operación se conserva. No edites los conceptos ni cobres otra vez
            hasta consultar o reintentar con la misma llave.
          </p>
          <div className="mc-caja-unknown__actions">
            <button
              type="button"
              className="mc-caja-button mc-caja-button--primary"
              onClick={() => void reconcileUnknown()}
              disabled={saving}
            >
              Consultar si se registró
            </button>
            <button
              type="button"
              className="mc-caja-button mc-caja-button--secondary"
              onClick={() => {
                setReconcileMessage(null);
                void confirmSale();
              }}
              disabled={saving}
            >
              Reintentar con la misma llave
            </button>
            <Link href="/ventas" className="mc-caja-button mc-caja-button--quiet">
              Ver ventas
            </Link>
          </div>
          {reconcileMessage ? (
            <p className="mc-caja-unknown__message" role="status" aria-live="polite">
              {reconcileMessage}
            </p>
          ) : null}
        </section>
      ) : null}

      {view === "compose" ? (
        <>
          <SaleVoice
            disabled={saving || Boolean(unknownResult) || legacyConflict || !hydrated}
            onAdd={(proposed) => {
              if (saving || unknownResult || legacyConflict || !hydrated) return false;
              if (lines.length + proposed.length > 50 || draftTotalCents([...lines, ...proposed]) > 100_000_000) {
                setError("El ticket excede el límite de conceptos o importe. No se añadió la propuesta.");
                return false;
              }
              setLines((current) => [...current, ...proposed]);
              setError(null);
              setAnnouncement("Conceptos dictados añadidos. Revisa el ticket antes de confirmar.");
              window.requestAnimationFrame(() => {
                document.getElementById(`line-description-${proposed[0]?.id}`)?.focus();
              });
              return true;
            }}
          />
          <PendingTray
            entries={pendingEntries}
            onOpen={openPendingEntry}
            onRefresh={() => void refreshPending()}
          />
          <div className="mc-caja-grid">
          <SaleLineItems
            lines={lines}
            errors={lineErrors}
            disabled={saving || Boolean(unknownResult)}
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
                const manual = target?.closest("details");
                if (manual) manual.open = true;
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
            locked={Boolean(unknownResult)}
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
            onClear={requestClearDraft}
          />
          </div>
          <CajaSpecCheckout totalCents={totalCents} method={method}
            disabled={saving || Boolean(unknownResult) || legacyConflict || !hydrated || !lines.length}
            onMethod={chooseMethod} onReview={() => setView("method")}
            onClear={requestClearDraft} />
        </>
      ) : null}

      {view === "method" ? <PaymentMethodScreen totalCents={totalCents} changeCents={changeForSale} method={method}
        cashInput={cashInput} creditInput={creditInput} customerName={customerName} error={error}
        canConfirm={canConfirm} disabled={saving || Boolean(unknownResult) || legacyConflict} demo={demo}
        onMethod={chooseMethod} onCash={value => { setCashInput(value); setError(null); }}
        onCredit={value => { setCreditInput(value); setError(null); }}
        onCustomer={value => { setCustomerName(value); setError(null); }} onConfirm={confirmSale} /> : null}

      {view === "payment" && order ? (
        <PaymentPanel
          order={order}
          demo={demo}
          creditBalanceCents={creditBalanceCents}
          onOrder={handleOrderUpdate}
          onNewSale={resetSale}
        />
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

      {view === "compose" && !unknownResult ? (
        <div className="mc-caja-paybar">
          <div>
            <span>Total</span>
            <CurrencyAmount cents={totalCents} />
            {!canConfirm ? (
              <button
                type="button"
                className="mc-caja-paybar__review"
                onClick={goToPayment}
              >
                Revisar cobro
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className="mc-caja-button mc-caja-button--primary mc-caja-confirm"
            onClick={() => void confirmSale()}
            disabled={!canConfirm || saving}
          >
            {saving ? "Registrando…" : "Confirmar venta"}
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
          Para revisar un comprobante también puedes abrir la{" "}
          <Link href="/">Caja clásica</Link>. Si allí queda un borrador, esta pantalla lo avisa
          antes de cobrar para que no se dupliquen ventas.
        </p>
      </div>
    </AppShell>
  );
}

function buildSalePayload(
  lines: DraftLine[],
  cashInput: string,
  creditInput: string,
  customerName: string,
) {
  const total = draftTotalCents(lines);
  const credit = Math.max(0, parseMoneyCents(creditInput));
  const appliedCredit = Math.min(credit, total);
  const cash = Math.max(0, parseMoneyCents(cashInput));
  const appliedCash = Math.min(cash, Math.max(0, total - appliedCredit));
  const payload = {
    items: lines.map((line) => ({
      description: line.description.trim(),
      quantity: parseQuantity(line.quantity),
      unitPriceCents: parseMoneyCents(line.price),
    })),
    cashCents: appliedCash,
    creditCents: appliedCredit,
    customerName: appliedCredit > 0 ? customerName.trim() : null,
  };
  return { payload, signature: JSON.stringify(payload) };
}

function parseStoredDraft(raw: string): StoredDraft | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StoredDraft>;
    if (!Array.isArray(parsed.lines)) return null;
    const lines = parsed.lines.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<DraftLine>;
      const description =
        typeof candidate.description === "string" ? candidate.description : "";
      const price =
        typeof candidate.price === "string"
          ? candidate.price
          : typeof candidate.price === "number" && Number.isFinite(candidate.price)
            ? (candidate.price / 100).toFixed(2)
            : "";
      const quantity =
        typeof candidate.quantity === "string"
          ? candidate.quantity
          : typeof candidate.quantity === "number" && Number.isFinite(candidate.quantity)
            ? String(candidate.quantity)
            : "1";
      // Un renglón sin concepto ni precio no es un borrador útil y no debe
      // romper la pantalla al leer `.trim()`.
      if (!description && !price) return [];
      return [
        {
          id:
            typeof candidate.id === "string" && candidate.id
              ? candidate.id
              : newLineId(),
          description,
          quantity,
          price,
        } satisfies DraftLine,
      ];
    });
    if (lines.length === 0) return null;
    return {
      instanceId:
        typeof parsed.instanceId === "string" && parsed.instanceId
          ? parsed.instanceId
          : newInstanceId(),
      lines,
      cashInput: typeof parsed.cashInput === "string" ? parsed.cashInput : "",
      creditInput: typeof parsed.creditInput === "string" ? parsed.creditInput : "",
      customerName:
        typeof parsed.customerName === "string" ? parsed.customerName : "",
      method: isPaymentChoice(parsed.method) ? parsed.method : "cash",
    };
  } catch {
    return null;
  }
}

type LegacyStoredItem = {
  id?: string;
  description?: string;
  quantity?: number;
  unitPriceCents?: number;
};

type LegacyStoredDraft = {
  version?: number;
  items?: LegacyStoredItem[];
  cashCents?: number;
  creditCents?: number;
  customerName?: string;
  updatedAt?: string;
};

function readLegacyImport(): LegacyImport | null {
  try {
    const raw = window.localStorage.getItem(LEGACY_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LegacyStoredDraft;
    if (parsed.version !== 1 || !Array.isArray(parsed.items)) {
      window.localStorage.removeItem(LEGACY_DRAFT_KEY);
      return null;
    }
    const lines = parsed.items.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const description = typeof item.description === "string" ? item.description : "";
      const priceCents = Number(item.unitPriceCents);
      if (!description && (!Number.isFinite(priceCents) || priceCents <= 0)) return [];
      const quantity = Number(item.quantity);
      return [
        {
          id: typeof item.id === "string" && item.id ? item.id : newLineId(),
          description,
          quantity: Number.isFinite(quantity) && quantity > 0 ? String(quantity) : "1",
          price:
            Number.isFinite(priceCents) && priceCents > 0
              ? (priceCents / 100).toFixed(2)
              : "",
        } satisfies DraftLine,
      ];
    });
    if (lines.length === 0) {
      window.localStorage.removeItem(LEGACY_DRAFT_KEY);
      return null;
    }

    const cashCents = safeLegacyCents(parsed.cashCents);
    const creditCents = safeLegacyCents(parsed.creditCents);
    const draft: StoredDraft = {
      instanceId: `legacy_${
        typeof parsed.updatedAt === "string" && parsed.updatedAt
          ? parsed.updatedAt
          : "sin_fecha"
      }`,
      lines,
      cashInput: cashCents > 0 ? (cashCents / 100).toFixed(2) : "",
      creditInput: creditCents > 0 ? (creditCents / 100).toFixed(2) : "",
      customerName:
        typeof parsed.customerName === "string" ? parsed.customerName : "",
      method:
        creditCents > 0
          ? cashCents > 0
            ? "mixed"
            : "credit"
          : cashCents > 0
            ? "cash"
            : "digital",
    };

    return { draft, request: readLegacyRequest(draft) };
  } catch {
    try {
      window.localStorage.removeItem(LEGACY_DRAFT_KEY);
    } catch {
      // Sin storage no hay nada que limpiar.
    }
    return null;
  }
}

function readLegacyRequest(draft: StoredDraft): StoredRequest | null {
  try {
    const raw = window.localStorage.getItem(LEGACY_REQUEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredRequest> & { version?: number };
    if (
      parsed.version !== 1 ||
      typeof parsed.requestId !== "string" ||
      typeof parsed.signature !== "string"
    ) {
      return null;
    }
    const { signature } = buildSalePayload(
      draft.lines,
      draft.cashInput,
      draft.creditInput,
      draft.customerName,
    );
    // Se conserva la llave aunque la firma haya cambiado: si el servidor ya
    // había registrado la operación, devolverá la misma venta o un 409 de
    // conflicto; nunca una segunda venta con la misma llave.
    return { requestId: parsed.requestId, signature };
  } catch {
    return null;
  }
}

function safeLegacyCents(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount);
}

function isPaymentChoice(value: unknown): value is PaymentChoice {
  return value === "cash" || value === "digital" || value === "credit" || value === "mixed";
}

function readStoredUnknown(): UnknownResult | null {
  try {
    const raw = window.localStorage.getItem(UNKNOWN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UnknownResult>;
    if (
      typeof parsed.requestId !== "string" ||
      typeof parsed.signature !== "string" ||
      typeof parsed.message !== "string"
    ) {
      return null;
    }
    return {
      requestId: parsed.requestId,
      signature: parsed.signature,
      message: parsed.message,
    };
  } catch {
    return null;
  }
}

function writeStoredUnknown(value: UnknownResult | null) {
  try {
    if (!value) {
      window.localStorage.removeItem(UNKNOWN_KEY);
      return;
    }
    window.localStorage.setItem(UNKNOWN_KEY, JSON.stringify(value));
  } catch {
    // Sin storage el aviso vive en memoria.
  }
}

function readConfirmedSale(): ConfirmedSale | null {
  try {
    const raw = window.localStorage.getItem(CONFIRMED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConfirmedSale>;
    if (
      typeof parsed.instanceId !== "string" ||
      typeof parsed.requestId !== "string" ||
      typeof parsed.signature !== "string" ||
      typeof parsed.orderId !== "string" ||
      typeof parsed.confirmedAt !== "string"
    ) {
      return null;
    }
    const age = Date.now() - Date.parse(parsed.confirmedAt);
    if (!Number.isFinite(age) || age < 0 || age > CONFIRMED_TTL_MS) {
      window.localStorage.removeItem(CONFIRMED_KEY);
      return null;
    }
    return {
      instanceId: parsed.instanceId,
      requestId: parsed.requestId,
      signature: parsed.signature,
      orderId: parsed.orderId,
      confirmedAt: parsed.confirmedAt,
    };
  } catch {
    return null;
  }
}

function writeConfirmedSale(value: ConfirmedSale) {
  window.localStorage.setItem(CONFIRMED_KEY, JSON.stringify(value));
}

async function loadPendingEntries(ids: string[]): Promise<PendingEntry[]> {
  const unique = [...new Set(ids)];
  const entries = await Promise.all(
    unique.map(async (id): Promise<PendingEntry | null> => {
      try {
        const response = await fetch(`/api/orders/${id}`, { cache: "no-store" });
        if (response.status === 404) {
          removePendingId(id);
          return null;
        }
        if (!response.ok) {
          return {
            id,
            order: null,
            creditBalanceCents: 0,
            error: `No se pudo leer (${response.status}).`,
          };
        }
        const data = (await response.json()) as {
          order?: Order;
          credit?: { balanceCents: number } | null;
        };
        if (!data.order) {
          return {
            id,
            order: null,
            creditBalanceCents: 0,
            error: "La respuesta no trajo el pedido.",
          };
        }
        const due = Math.max(
          0,
          data.order.totalCents - data.order.paidCents - data.order.creditCents,
        );
        if (TERMINAL_ORDER_STATUSES.has(data.order.status) || due <= 0) {
          removePendingId(id);
          return null;
        }
        return {
          id,
          order: data.order,
          creditBalanceCents:
            data.credit?.balanceCents ??
            (data.order.creditCents > 0 ? data.order.creditCents : 0),
        };
      } catch {
        return {
          id,
          order: null,
          creditBalanceCents: 0,
          error: "No se pudo leer por un problema de conexión.",
        };
      }
    }),
  );
  return entries.filter((entry): entry is PendingEntry => entry !== null);
}

function readPendingIds(): string[] {
  const raw = window.localStorage.getItem(PENDING_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { orderIds?: string[]; orderId?: string };
    if (Array.isArray(parsed.orderIds)) {
      return parsed.orderIds.filter((id): id is string => typeof id === "string");
    }
    return typeof parsed.orderId === "string" ? [parsed.orderId] : [];
  } catch {
    return [];
  }
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

function newInstanceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `draft_${crypto.randomUUID()}`;
  }
  return `draft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function newRequestId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function readStoredRequest(): StoredRequest | null {
  try {
    const raw = window.localStorage.getItem(REQUEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredRequest>;
    if (typeof parsed.requestId !== "string" || typeof parsed.signature !== "string") {
      window.localStorage.removeItem(REQUEST_KEY);
      return null;
    }
    return { requestId: parsed.requestId, signature: parsed.signature };
  } catch {
    try {
      window.localStorage.removeItem(REQUEST_KEY);
    } catch {
      // Sin storage no hay llave que limpiar.
    }
    return null;
  }
}

function writeStoredRequest(request: StoredRequest) {
  window.localStorage.setItem(REQUEST_KEY, JSON.stringify(request));
}
