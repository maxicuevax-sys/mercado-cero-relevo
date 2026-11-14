import { chargeFace, type ChargeFaceName } from "./charge-face";

/**
 * Lectura del mostrador de hoy. No cobra, no llama a pey y no cambia estados.
 * PAGADO solo se escribe cuando el pedido ya está `paid` por un pago pey.
 */

export interface BoardTicketRef {
  id: string;
  status: string;
  paymentMethod: string | null;
  lastPaymentProvider: string | null;
  lastPaymentDemo: boolean;
  creditCents: number;
  paidCents: number;
  qrId: string | null;
  qrString: string | null;
  qrExpiresAt: string | null;
}

export interface BoardWord {
  word: string;
  face: ChargeFaceName | "paid" | "cash" | "credit" | "demo";
  detail: string;
}

export function mexicoCityDayBounds(now = new Date()): {
  startIso: string;
  endIso: string;
  label: string;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const wallAsUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second"),
  );
  const offsetMs = wallAsUtc - now.getTime();
  const label = `${String(value("year")).padStart(4, "0")}-${String(value("month")).padStart(2, "0")}-${String(value("day")).padStart(2, "0")}`;
  const [year, month, day] = label.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day) - offsetMs);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString(), label };
}

export function hasRealCodiQr(ticket: Pick<BoardTicketRef, "qrId" | "qrString">): boolean {
  if (!ticket.qrId || !ticket.qrString) return false;
  if (ticket.qrId.startsWith("demo_") || ticket.qrId.startsWith("local-")) return false;
  if (ticket.qrString.startsWith("local-") || ticket.qrString.includes('"demo":true')) return false;
  return true;
}

const OPEN = new Set(["draft", "confirmed", "payment_pending", "partially_paid"]);

export function pickCodiTicket<T extends BoardTicketRef>(tickets: T[]): T | null {
  const open = tickets.filter((ticket) => OPEN.has(ticket.status));
  return (
    open.find((ticket) => hasRealCodiQr(ticket)) ??
    open.find((ticket) => ticket.status === "payment_pending" || ticket.paymentMethod === "codi") ??
    open.find((ticket) => ticket.creditCents <= 0) ??
    null
  );
}

export function boardWord(
  ticket: BoardTicketRef,
  now: number | null,
  options: { simulation?: boolean; rejected?: boolean } = {},
): BoardWord {
  const simulation = options.simulation === true || ticket.status === "demo_paid" || ticket.lastPaymentDemo;
  const face = chargeFace({
    status: ticket.status,
    qrExpiresAt: ticket.qrExpiresAt,
    simulation,
    rejected: options.rejected === true,
    now,
  });

  if (simulation) {
    if (face.face === "rejected" || face.face === "late" || face.face === "expired") {
      return { word: face.label.toUpperCase(), face: face.face, detail: face.detail };
    }
    if (ticket.status === "demo_paid" || ticket.status === "paid" || ticket.status === "fulfilled") {
      return {
        word: "DEMO",
        face: "demo",
        detail: "Simulación. No es un depósito y no se entrega como pagado.",
      };
    }
    return {
      word: "DEMO · POR COBRAR",
      face: "waiting",
      detail: "Simulación. Un QR no es un depósito.",
    };
  }

  if (
    (ticket.status === "paid" || ticket.status === "fulfilled") &&
    ticket.lastPaymentProvider === "pey" &&
    !ticket.lastPaymentDemo
  ) {
    return {
      word: "PAGADO",
      face: "paid",
      detail: "pey confirmó este cobro. Ya se puede entregar.",
    };
  }

  if (
    (ticket.status === "paid" || ticket.status === "fulfilled") &&
    ticket.paymentMethod === "cash" &&
    ticket.lastPaymentProvider !== "pey"
  ) {
    return {
      word: "EFECTIVO",
      face: "cash",
      detail: "Efectivo registrado en la caja. No pasó por pey.",
    };
  }

  if (face.face === "rejected" || face.face === "late" || face.face === "expired") {
    return { word: face.label.toUpperCase(), face: face.face, detail: face.detail };
  }

  if (ticket.creditCents > 0 && ticket.paidCents <= 0) {
    return {
      word: "FIADO",
      face: "credit",
      detail: "Quedó a cuenta. No es dinero recibido.",
    };
  }

  if (ticket.status === "paid" || ticket.status === "fulfilled") {
    return {
      word: "PAGADO",
      face: "paid",
      detail: "El pedido quedó cubierto.",
    };
  }

  return {
    word: "POR COBRAR",
    face: "waiting",
    detail: hasRealCodiQr(ticket)
      ? "El QR está en pantalla. Un QR no es un depósito."
      : "Este ticket sigue abierto.",
  };
}
