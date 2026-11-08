import crypto from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { appUrl, isDemoMode } from "@/lib/config";
import { getCredit, getCreditByNumRef } from "@/lib/db";
import {
  ConflictError,
  NotFoundError,
  appErrorResponse,
  unexpectedResponse,
} from "@/lib/errors";
import {
  bodyErrorResponse,
  enforceRateLimit,
  isJsonObject,
  MAX_SMALL_JSON_BYTES,
  readOptionalJsonLimited,
} from "@/lib/http-security";
import { attachCreditPaymentLink, attachCreditQr } from "@/lib/orders";
import { createCodiQr, createPaymentLink } from "@/lib/pey";

const bodySchema = z.object({
  mode: z.enum(["link", "qr"]).optional(),
  amountCents: z.number().int().positive().optional(),
});

function shortRef(creditId: string): string {
  const hash = crypto.createHash("sha256").update(creditId).digest("hex");
  return String((parseInt(hash.slice(0, 8), 16) % 900000) + 100000);
}

function nextNumRef(numRef: string): string {
  return String(((Number(numRef) + 1) % 900000) + 100000);
}

function reserveCreditNumRef(creditId: string): string {
  let numRef = shortRef(creditId);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const existing = getCreditByNumRef(numRef);
    if (!existing || existing.id === creditId) return numRef;
    numRef = nextNumRef(numRef);
  }
  throw new ConflictError(
    "No encontré un número de referencia libre para el fiado. Intenta de nuevo.",
    "num_ref_exhausted",
  );
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/credits/[id]/pay-link">,
) {
  const limited = enforceRateLimit(request, "credit-pay-link", 30, 60_000);
  if (limited) return limited;

  let body: { mode?: "link" | "qr"; amountCents?: number };
  try {
    body = await readOptionalJsonLimited<{ mode?: "link" | "qr"; amountCents?: number }>(
      request,
      MAX_SMALL_JSON_BYTES,
      {},
    );
  } catch (error) {
    return bodyErrorResponse(error);
  }

  if (!isJsonObject(body)) {
    return Response.json(
      { error: "El cuerpo debe ser un objeto JSON.", code: "invalid_json" },
      { status: 400 },
    );
  }

  try {
    const { id } = await ctx.params;
    const input = bodySchema.parse(body);

    const credit = getCredit(id);
    if (!credit) {
      throw new NotFoundError("Fiado no encontrado.", "credit_not_found");
    }

    if (credit.status === "settled" || credit.balanceCents <= 0) {
      return Response.json(
        { error: "Ese fiado ya está saldado.", code: "credit_settled" },
        { status: 409 },
      );
    }

    const amountCents = input.amountCents
      ? Math.min(input.amountCents, credit.balanceCents)
      : credit.balanceCents;

    const concept = `Abono fiado ${credit.customerName ?? "Cliente"} · ${(amountCents / 100).toFixed(2)} MXN`.slice(0, 120);
    const mode = input.mode ?? "qr";

    if (mode === "qr") {
      const numRef = credit.numRef ?? reserveCreditNumRef(credit.id);
      const qr = await createCodiQr({
        orderId: credit.orderId ?? credit.id,
        amountCents,
        concept,
        numRef,
        creditId: credit.id,
      });

      const qrValue = isDemoMode()
        ? `${appUrl()}/fiados/${credit.id}?demo=1`
        : qr.qrString;

      const qrImage =
        qr.qrImage ??
        (await QRCode.toDataURL(qrValue, {
          width: 640,
          margin: 1,
          color: { dark: "#143D2F", light: "#FFFFFF" },
        }));

      const updated = attachCreditQr(
        credit.id,
        { ...qr, qrImage },
        numRef,
      );

      return Response.json({
        credit: updated,
        qrString: updated.qrString,
        qrImage: updated.qrImage,
        numRef: updated.numRef,
        qrExpiresAt: updated.qrExpiresAt,
      });
    }

    const link = await createPaymentLink({
      orderId: credit.orderId ?? credit.id,
      amountCents,
      concept,
      creditId: credit.id,
    });

    const updated = attachCreditPaymentLink(credit.id, link);
    return Response.json({
      credit: updated,
      paymentLinkId: updated.paymentLinkId,
      paymentUrl: updated.paymentUrl,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Parámetros inválidos.", issues: error.issues },
        { status: 400 },
      );
    }
    const known = appErrorResponse(error);
    if (known) return known;
    return unexpectedResponse(error, "No se pudo generar el cobro del fiado.");
  }
}
