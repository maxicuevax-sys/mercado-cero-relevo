import { withPilotRoute } from "../../../../lib/auth/pilot-route";
import crypto from "node:crypto";
import { getDb, newId, nowIso } from "@/lib/db";
import {
  bodyErrorResponse,
  enforceRateLimit,
  MAX_WEBHOOK_BYTES,
  readTextLimited,
} from "@/lib/http-security";
import { PeyWebhookError, processPeyEvent } from "@/lib/pey-events";
import { verifyWebhookSignature } from "@/lib/pey";

/** Payload de auditoría de un rechazo no firmado: prefijo acotado + hash. */
const MAX_REJECTED_PAYLOAD_BYTES = 4 * 1024;
const DEFAULT_REJECTED_EVENT_CAP = 500;

function hashPayload(payload: string): string {
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}

function truncatePayload(payload: string, maxBytes = MAX_REJECTED_PAYLOAD_BYTES): string {
  const bytes = Buffer.from(payload, "utf8");
  if (bytes.byteLength <= maxBytes) return payload;
  return bytes.subarray(0, maxBytes).toString("utf8");
}

function rejectedEventCap(): number {
  const parsed = Number(process.env.PAYMENT_EVENT_REJECTED_CAP ?? DEFAULT_REJECTED_EVENT_CAP);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_REJECTED_EVENT_CAP;
  return Math.min(Math.floor(parsed), 10_000);
}

/**
 * Un webhook público sin firma puede generar filas para siempre si cada
 * intento trae un `webhook-id` distinto. Se conserva el prefijo/hash del
 * payload, pero solo los últimos N rechazos no firmados. La auditoría con
 * firma válida (procesada, ignorada o rechazada por dominio) no se toca.
 */
function pruneRejectedEvents(database: ReturnType<typeof getDb>): void {
  try {
    const cap = rejectedEventCap();
    const row = database
      .prepare(
        "SELECT COUNT(*) AS n FROM payment_events WHERE signature_valid = 0 AND result = 'rejected'",
      )
      .get() as { n: number };
    const excess = Number(row.n) - cap;
    if (excess <= 0) return;

    database
      .prepare(
        `DELETE FROM payment_events WHERE id IN (
           SELECT id FROM payment_events
           WHERE signature_valid = 0 AND result = 'rejected'
           ORDER BY processed_at ASC, rowid ASC
           LIMIT ?
         )`,
      )
      .run(excess);
  } catch (error) {
    console.error("[pey webhook] no se pudo podar rechazos viejos", error);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && /unique|constraint/i.test(error.message);
}

function insertEvent(input: {
  idempotencyKey: string;
  eventType: string;
  payload: string;
  payloadHash: string;
  signatureValid: boolean;
  result: "received" | "processed" | "ignored" | "rejected";
  error?: string | null;
}): string {
  const id = newId("evt");
  getDb()
    .prepare(
      `INSERT INTO payment_events
       (id, provider, event_type, idempotency_key, payload, payload_hash, signature_valid, processed_at, result, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      "pey",
      input.eventType,
      input.idempotencyKey,
      input.payload,
      input.payloadHash,
      input.signatureValid ? 1 : 0,
      nowIso(),
      input.result,
      input.error ?? null,
    );
  return id;
}

function auditEvent(input: {
  idempotencyKey: string;
  eventType: string;
  payload: string;
  payloadHash: string;
  signatureValid: boolean;
  result: "rejected";
  error: string;
}): void {
  try {
    insertEvent(input);
    if (!input.signatureValid) {
      pruneRejectedEvents(getDb());
    }
  } catch (error) {
    if (!isUniqueViolation(error)) {
      console.error("[pey webhook] no se pudo guardar el evento rechazado", error);
    }
  }
}

async function POSTImpl(request: Request) {
  const limited = enforceRateLimit(request, "webhook-pey", 120, 60_000);
  if (limited) return limited;

  let rawBody: string;
  try {
    rawBody = await readTextLimited(request, MAX_WEBHOOK_BYTES);
  } catch (error) {
    return bodyErrorResponse(error);
  }

  const payloadHash = hashPayload(rawBody);
  const webhookId = request.headers.get("webhook-id");
  const timestamp = request.headers.get("webhook-timestamp");
  const signature = request.headers.get("webhook-signature");

  const signatureValid = verifyWebhookSignature(rawBody, {
    id: webhookId,
    timestamp,
    signature,
  });

  // La firma se exige siempre. El dinero simulado usa /api/demo/pay, nunca este endpoint.
  if (!signatureValid) {
    auditEvent({
      idempotencyKey: `invalid:${webhookId ?? newId("msg")}`,
      eventType: "webhook.invalid_signature",
      // No se retiene el cuerpo completo de un intento no firmado: puede ser
      // basura arbitraria y llegar ilimitado. Hash + prefijo bastan para
      // investigar sin crecer sin control.
      payload: truncatePayload(rawBody),
      payloadHash,
      signatureValid: false,
      result: "rejected",
      error: "Firma de webhook inválida.",
    });
    return Response.json({ error: "Firma de webhook inválida." }, { status: 401 });
  }

  if (!webhookId) {
    return Response.json({ error: "Falta webhook-id." }, { status: 400 });
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    auditEvent({
      idempotencyKey: webhookId,
      eventType: "webhook.invalid_json",
      payload: rawBody,
      payloadHash,
      signatureValid: true,
      result: "rejected",
      error: "JSON inválido.",
    });
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const eventType =
    typeof event === "object" &&
    event !== null &&
    "type" in event &&
    typeof (event as { type?: unknown }).type === "string"
      ? (event as { type: string }).type
      : "unknown";

  const database = getDb();
  let eventId: string | null = null;
  let retryingRejected = false;

  try {
    // Insertar el evento y aplicarlo en la misma transacción: si el proceso
    // se cae a la mitad, no queda un evento "received" que bloquee el reintento.
    database.exec("BEGIN IMMEDIATE");

    try {
      eventId = insertEvent({
        idempotencyKey: webhookId,
        eventType,
        payload: rawBody,
        payloadHash,
        signatureValid: true,
        result: "received",
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const existing = database
        .prepare(
          "SELECT id, result FROM payment_events WHERE idempotency_key = ?",
        )
        .get(webhookId) as { id: string; result: string | null } | undefined;
      // Un replay ya procesado/ignorado se ackea sin volver a escribir. Un
      // evento rechazado sí se puede corregir: si no, el proveedor reintenta
      // con el mismo webhook-id y nunca cobra.
      if (!existing || existing.result !== "rejected") {
        database.exec("COMMIT");
        return Response.json({ ok: true, duplicate: true });
      }
      retryingRejected = true;
      eventId = existing.id;
      database
        .prepare(
          `UPDATE payment_events
           SET event_type = ?, payload = ?, payload_hash = ?, signature_valid = 1,
               result = 'received', error = NULL, processed_at = ?
           WHERE id = ?`,
        )
        .run(eventType, rawBody, payloadHash, nowIso(), existing.id);
    }

    const outcome = processPeyEvent(event);

    database
      .prepare("UPDATE payment_events SET result = ?, error = NULL WHERE id = ?")
      .run(outcome.result, eventId);
    database.exec("COMMIT");

    return Response.json({ ok: true, ...outcome });
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // La transacción pudo haberse cerrado sola.
    }

    if (error instanceof PeyWebhookError) {
      if (retryingRejected && eventId) {
        // El reintento tampoco cuadró: conserva la fila única y actualiza el
        // motivo para que el siguiente intento siga siendo posible.
        try {
          database
            .prepare(
              `UPDATE payment_events
               SET event_type = ?, payload = ?, payload_hash = ?, error = ?, processed_at = ?
               WHERE id = ?`,
            )
            .run(eventType, rawBody, payloadHash, error.message, nowIso(), eventId);
        } catch (updateError) {
          console.error(
            "[pey webhook] no se pudo actualizar el rechazo reintentado",
            updateError,
          );
        }
      } else {
        auditEvent({
          idempotencyKey: webhookId,
          eventType,
          payload: rawBody,
          payloadHash,
          signatureValid: true,
          result: "rejected",
          error: error.message,
        });
      }
      return Response.json({ error: error.message }, { status: error.status });
    }

    console.error("[pey webhook] error inesperado", error);
    return Response.json(
      { error: "No se pudo procesar el webhook." },
      { status: 500 },
    );
  }
}

export const POST = withPilotRoute(POSTImpl, { buyer: true });
