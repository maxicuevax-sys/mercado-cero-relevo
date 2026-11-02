import { getDb, newId, nowIso } from "@/lib/db";
import { PeyWebhookError, processPeyEvent } from "@/lib/pey-events";
import { verifyWebhookSignature } from "@/lib/pey";

const MAX_BODY_CHARS = 64 * 1024;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && /unique|constraint/i.test(error.message);
}

function insertEvent(input: {
  idempotencyKey: string;
  eventType: string;
  payload: string;
  signatureValid: boolean;
  result: "received" | "processed" | "ignored" | "rejected";
  error?: string | null;
}): string {
  const id = newId("evt");
  getDb()
    .prepare(
      `INSERT INTO payment_events
       (id, provider, event_type, idempotency_key, payload, signature_valid, processed_at, result, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      "pey",
      input.eventType,
      input.idempotencyKey,
      input.payload,
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
  signatureValid: boolean;
  result: "rejected";
  error: string;
}): void {
  try {
    insertEvent(input);
  } catch (error) {
    if (!isUniqueViolation(error)) {
      console.error("[pey webhook] no se pudo guardar el evento rechazado", error);
    }
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_CHARS) {
    return Response.json({ error: "Payload demasiado grande." }, { status: 413 });
  }

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
      payload: rawBody,
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
           SET event_type = ?, payload = ?, signature_valid = 1,
               result = 'received', error = NULL, processed_at = ?
           WHERE id = ?`,
        )
        .run(eventType, rawBody, nowIso(), existing.id);
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
               SET event_type = ?, payload = ?, error = ?, processed_at = ?
               WHERE id = ?`,
            )
            .run(eventType, rawBody, error.message, nowIso(), eventId);
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
