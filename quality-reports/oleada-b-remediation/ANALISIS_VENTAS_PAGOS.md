# Análisis de remediación — P1 `POST /api/demo/pay`

> **Rol:** `mc-ventas-pagos` · **Modo:** solo lectura, sin cambios de producto ni commits.
> **Repo:** `mercado-cero` · **HEAD:** `4130e71` · **Rama:** `design/oleada-b-caja-ventas` · **Build de referencia:** `4130e71`.
> **Fecha:** 2026-11-04.
>
> Este documento es el único artefacto escrito. **No implementa** la corrección: propone el diseño mínimo, el esquema de idempotencia, el diff conceptual por archivo, la matriz A-J y los criterios de aceptación. La implementación queda para el carril ejecutor, con revisión del dueño de pagos.

---

## 0. Veredicto ejecutivo

El P1 es real y se puede cerrar con un cambio **demo-only**, **sin migración de esquema** y **sin tocar webhook/pey/real**.

La corrección mínima tiene cuatro capas que deben ir juntas:

1. **`BEGIN IMMEDIATE` antes de leer el pedido.** El saldo se lee dentro del lock de escritura de SQLite, no antes.
2. **Guard server-side de `orders.demo = 1`.** `getOrder` en modo demo devuelve también pedidos `demo=0`; el endpoint actual nunca consulta la bandera.
3. **Idempotencia durable por operación** en `payment_events.idempotency_key` (UNIQUE) y `payments.transaction_id` (UNIQUE), con `transaction_id` determinista, no aleatorio.
4. **Evento + pago + actualización de la orden + auditoría en una sola transacción.** Hoy el evento se inserta en autocommit y `recordPayment` abre un SAVEPOINT después; un fallo intermedio deja evento sin pago.

El lock de UI de `PaymentPanel` no es parte de la garantía: es UX por pestaña/proceso y no sobrevive a recargas, dos pestañas ni dos procesos Node.

**Condición de cierre:** A-J verdes contra **dos procesos Node sobre la misma SQLite temporal**, árbol limpio, build sellado con el SHA entregado y sin cambios en webhook/pey/verify/real. Reparar datos ya corrompidos es una decisión separada, con aprobación del dueño.

---

## 1. Estado actual y causa raíz

### 1.1 El guard de modo no es un guard de pedido

`web/src/app/api/demo/pay/route.ts:22-31` solo comprueba `isDemoMode()`. Después, `getOrder(body.orderId)` en `web/src/lib/db.ts:1489-1499` devuelve cualquier fila cuando el proceso está en demo:

```ts
if (!isDemoMode() && (Number(row.demo) === 1 || id.startsWith("demo_"))) {
  return null;
}
```

Es decir, en modo demo un pedido `demo=0` es visible y pagable. La ruta nunca lee `orders.demo` (`route.ts:49-57`). Resultado reproducido por la auditoría: un pedido `demo=0`, `payment_pending`, pasa a `demo_paid` con un pago `provider=demo`, `demo=1`, y desaparece del historial real por el filtro de visibilidad (`db.ts:1506-1510`).

**Causa:** el modo del proceso se usó como sustituto de la bandera del pedido. Son cosas distintas cuando una base demo se reutiliza con datos reales.

### 1.2 La carrera de dos procesos

La secuencia actual es:

1. `getOrder` y cálculo de `amountCents` **fuera de cualquier transacción** (`route.ts:49-54`).
2. `INSERT INTO payment_events` en **autocommit** (`route.ts:62-76`).
3. `recordPayment` abre un `SAVEPOINT` local (`orders.ts:557-624`), pero el `SAVEPOINT` no impide que otro proceso haya leído el mismo saldo antes.
4. `recordPayment` solo corta si `amountCents <= 0` (`orders.ts:554-555`); no compara contra el saldo pendiente ni bloquea el pedido.
5. El `transactionId` es aleatorio (`route.ts:60`), así que `payments.transaction_id UNIQUE` no detecta dos pagos distintos de la misma operación.
6. La `idempotency_key` del evento es ese mismo `transactionId` aleatorio, así que `payment_events.idempotency_key UNIQUE` tampoco detecta nada.

Con dos procesos que leen antes de que el otro escriba, ambos ven `due=10000`, ambos insertan un pago de `10000` y `recalculateOrderTotals` suma `20000`. La auditoría lo reprodujo en 3 de 6 rondas.

**Causa:** la sección crítica empieza después de leer el saldo. Ningún `SAVEPOINT` ni índice único puede arreglar una decisión tomada con datos viejos.

### 1.3 Evento sin pago

El `INSERT` del evento ocurre antes de `recordPayment` y fuera de su SAVEPOINT. Si `recordPayment` falla (trigger, error de UPDATE, cierre), el evento queda en autocommit y el pago no. La ruta actual no vuelve a limpiarlo. Es el caso inverso al que se quiere evitar y hay que cerrarlo con una transacción externa.

### 1.4 Lo que ya existe y se debe reutilizar

- `payments.transaction_id TEXT UNIQUE` (`db.ts:141-154`).
- `payment_events.idempotency_key TEXT UNIQUE NOT NULL` (`db.ts:156-165`), más las columnas `result`, `error` y `payload_hash` que agrega la migración (`db.ts:362-378`).
- `recordPayment` ya:
  - valida el proveedor con `assertPaymentProvider`,
  - corta en `amountCents <= 0`,
  - detecta un `transactionId` existente antes del SAVEPOINT y cura la orden (`orders.ts:547-552`),
  - repite la comprobación dentro del SAVEPOINT y traduce `UNIQUE` a `healOrderFromPayments` (`orders.ts:563-600`),
  - recalcula `paid_cents`, método y estado desde `payments` (`orders.ts:634-707`).
- `payment_events` ya se usa con el patrón `received → processed` y transacción externa en el webhook (`web/src/app/api/webhooks/pey/route.ts:191-236`).

No hace falta tocar `recordPayment` ni el esquema. Hace falta **envolver** su uso en una transacción que empiece antes de leer el saldo y usar llaves deterministas.

---

## 2. Alcance y no-objetivos

### 2.1 Dentro del alcance

| Archivo | Cambio |
|---|---|
| `web/src/lib/demo-payments.ts` (nuevo) | Núcleo demo-only: transacción, guard `demo=1`, llaves, replay, errores. |
| `web/src/app/api/demo/pay/route.ts` | Validar `requestId` opcional y delegar; quitar SQL de dinero de la ruta. |
| `web/scripts/p0-demo-pay-contract.mjs` (nuevo) | Matriz A-J con dos procesos y SQLite temporal. |
| `web/package.json` | Script `test:demo-pay` (opcional, recomendado). |
| `payment-panel.tsx` / `checkout-client.tsx` | **Opcional, no bloqueante:** enviar `requestId` por intento. |

### 2.2 Fuera del alcance (bloqueante si aparece en el diff)

- `web/src/app/api/webhooks/pey/**`, `web/src/lib/pey*.ts`, `web/src/lib/reconcile.ts`.
- `web/src/app/api/verify/**`.
- `web/src/lib/orders.ts`: **no cambiar** la semántica de `recordPayment`, `fulfillOrder` ni `recalculateOrderTotals`. Se usa tal cual.
- Esquema/migraciones de `db.ts`.
- Flujo real, links/QR reales, pey, webhook firmado.
- Reparación automática de filas ya corrompidas (sección 7).
- Rediseño de la UI o exposición de `orders.demo` en el `Order` público.

---

## 3. Diseño de la corrección

### 3.1 Invariantes que debe cumplir

| ID | Invariante |
|---|---|
| I1 | Solo un pedido con `orders.demo = 1` puede recibir un pago por este endpoint. |
| I2 | Dos solicitudes concurrentes de la misma operación no pueden insertar dos pagos. |
| I3 | Después de la operación, `paid_cents = SUM(payments.amount_cents WHERE status='paid')` y `paid_cents <= total_cents`. |
| I4 | Evento, pago, actualización de la orden y auditoría son una sola unidad. No hay evento sin pago ni pago sin evento para filas nuevas. |
| I5 | Un reintento de la misma operación devuelve el resultado original; una llave usada con otro pedido/método es 409. |
| I6 | Modo real, pey, webhook y verify no cambian de comportamiento. |

### 3.2 Flujo

```text
POST /api/demo/pay
  -> ¿DEMO_MODE? Si no: 403 demo_disabled
  -> rate limit (sin cambios)
  -> leer JSON limitado + zod
  -> recordDemoPayment()
       BEGIN IMMEDIATE                    <-- lock de escritura SQLite
       SELECT order crudo (demo, status, total, credit, link)
       si no existe            -> 404 order_not_found
       si demo != 1            -> 409 demo_order_required
       si status = cancelled   -> 409 order_cancelled
       paid = SUM(payments paid)          <-- fuente de verdad del saldo
       due  = max(0, total - paid - credit)
       si requestId:
          evento = SELECT por K_req
          si existe           -> replay / 409
       si due <= 0            -> 200 no-op (alreadySettled)
       si status paid/demo_paid y due > 0 -> 409 order_state_inconsistent
       K = requestId ? K_req : K_auto(due)
       si no requestId:
          evento = SELECT por K_auto
          si existe           -> replay / 409
       si existe payment por T(K) -> 409 idempotency_incomplete
       INSERT payment_events (recibido)
       recordPayment(...)                 <-- SAVEPOINT interno
       UPDATE payment_events (procesado)
       COMMIT
  -> 200 { order, transactionId?, duplicate?, alreadySettled? }
```

**Regla dura:** entre `BEGIN IMMEDIATE` y `COMMIT` no puede haber ningún `await`. Toda la sección crítica es síncrona (`node:sqlite`). Si se introduce un `await`, se pierde la garantía dentro del mismo proceso.

### 3.3 Esquema exacto de llaves

Sea `P = "demo:pay:v1"` y `MERCHANT.id = "lupita"`:

| Caso | Llave de idempotencia (`payment_events.idempotency_key`) | Cuándo |
|---|---|---|
| Cliente envía `requestId` | `demo:pay:v1:req:lupita:<requestId>` | `requestId` no vacío, recortado, ≤128 caracteres |
| Cliente **no** envía `requestId` | `demo:pay:v1:auto:lupita:<orderId>:<amountCents>` | Compatibilidad con clientes actuales |

Normalización:

- `requestId` se recorta con `trim()`.
- Vacío o solo espacios ⇒ `null` ⇒ se usa la llave automática.
- Máximo `MAX_REQUEST_ID_CHARS = 128` (`orders.ts:33`). Es case-sensitive; no se normaliza a minúsculas ni se acepta por header.
- No se usa `orders.request_id`: es otra identidad (creación de pedido), no la operación de cobro.
- El prefijo `demo:pay:v1` separa estas llaves de los `webhook-id` (`msg_...`) y de las llaves `invalid:...` del webhook.

**Transaction ID determinista:**

```text
T(K) = "demo_txn_" + sha256(canonicalJson({ key: K })).slice(0, 40)
```

Se implementa con `requestPayloadHash({ key: K })` (`web/src/lib/request-hash.ts:25-30`). Propiedades:

- Es estable entre procesos, reinicios y recargas.
- 160 bits de SHA-256 reducen la colisión a algo despreciable.
- El prefijo `demo_txn_` queda reservado y no choca con los `transaction_id` de pey.
- Si en el futuro se cambia el cálculo, hay que subir a `demo:pay:v2`; no se puede cambiar en caliente o se rompe el replay.

**Payload del evento:**

```json
{
  "v": 1,
  "key": "demo:pay:v1:req:lupita:req-123",
  "orderId": "ord_...",
  "method": "card",
  "amountCents": 10000,
  "requestId": "req-123",
  "transactionId": "demo_txn_..."
}
```

`payload_hash = requestPayloadHash(payload)`. Se guarda en `payment_events.payload_hash`. El hash permite detectar un evento manipulado o corrupto y es el mismo mecanismo que ya usa el webhook.

### 3.4 Uso de `payment_events` y `payments.transaction_id`

El evento se inserta con:

```sql
INSERT INTO payment_events
  (id, provider, event_type, idempotency_key, payload, payload_hash,
   signature_valid, processed_at, result, error)
VALUES
  (?, 'demo', 'demo.payment', ?, ?, ?, 0, ?, 'received', NULL);
```

Al terminar `recordPayment`, dentro de la misma transacción:

```sql
UPDATE payment_events SET result = 'processed', error = NULL WHERE id = ?;
```

El pago lo inserta `recordPayment` con `provider = 'demo'`, `demo = 1`, `status = 'paid'`, `transaction_id = T(K)`. No se inserta un segundo pago a mano.

**Por qué las dos unicidades importan y no se sustituyen:**

- `payment_events.idempotency_key UNIQUE` deduplica **la operación** y permite replay. Las consultas de replay se limitan a `provider = 'demo'` y a la llave exacta; el prefijo ya separa estas llaves de las del webhook.
- `payments.transaction_id UNIQUE` deduplica **la fila de dinero**.
- Ninguna de las dos, por separado, impide que dos `requestId` distintos paguen dos veces el mismo saldo. Eso lo impide el `BEGIN IMMEDIATE` + relectura del saldo.
- Juntas dan tres capas: lock → evento único → pago único. Si una falla, las otras dos no permiten doble dinero.

### 3.5 Pseudocódigo del núcleo (`demo-payments.ts`)

```ts
export type DemoPaymentMethod = "codi" | "card" | "wallet";

export interface DemoPaymentResult {
  order: Order;
  transactionId: string | null;
  duplicate: boolean;
  alreadySettled: boolean;
}

const P = "demo:pay:v1";

function reqKey(requestId: string): string {
  return `${P}:req:${MERCHANT.id}:${requestId}`;
}

function autoKey(orderId: string, amountCents: number): string {
  return `${P}:auto:${MERCHANT.id}:${orderId}:${amountCents}`;
}

function txnIdFor(key: string): string {
  return `demo_txn_${requestPayloadHash({ key }).slice(0, 40)}`;
}

function normalizeDemoRequestId(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_REQUEST_ID_CHARS) {
    throw new ValidationError(
      `El requestId no puede pasar de ${MAX_REQUEST_ID_CHARS} caracteres.`,
      "request_id_invalid",
    );
  }
  return trimmed;
}

export function recordDemoPayment(input: {
  orderId: string;
  method: DemoPaymentMethod;
  requestId?: string | null;
}): DemoPaymentResult {
  if (!isDemoMode()) {
    throw new AppError(403, "demo_disabled", "El modo demo está desactivado.");
  }

  const requestId = normalizeDemoRequestId(input.requestId); // trim, ≤128, "" -> null
  const db = getDb();

  try {
    db.exec("BEGIN IMMEDIATE");
  } catch (error) {
    if (/busy|locked/i.test(String(error))) {
      throw new AppError(503, "demo_pay_busy", "El cobro está ocupado. Reintenta en un momento.");
    }
    throw error;
  }

  let committed = false;
  try {
    const row = db.prepare(`
      SELECT id, demo, status, total_cents, paid_cents, credit_cents, payment_link_id
      FROM orders
      WHERE id = ? AND merchant_id = ?
    `).get(input.orderId, MERCHANT.id) as OrderRow | undefined;

    if (!row) throw new NotFoundError("Pedido no encontrado.", "order_not_found");
    if (Number(row.demo) !== 1) {
      throw new ConflictError(
        "Este pedido no es de demo. La simulación solo aplica a pedidos demo.",
        "demo_order_required",
      );
    }
    if (row.status === "cancelled") {
      throw new ConflictError("El pedido está cancelado; no se puede simular un pago.", "order_cancelled");
    }

    // Fuente de verdad: payments, no orders.paid_cents.
    const paid = Number(db.prepare(
      "SELECT COALESCE(SUM(amount_cents), 0) AS total FROM payments WHERE order_id = ? AND status = 'paid'",
    ).get(row.id).total);
    const due = Math.max(0, Number(row.total_cents) - paid - Number(row.credit_cents));

    const rKey = requestId ? reqKey(requestId) : null;
    if (rKey) {
      const event = findEvent(db, rKey);
      if (event) {
        const result = replay(db, event, row, input.method, due);
        db.exec("COMMIT");
        committed = true;
        return result;
      }
    }

    if (due <= 0) {
      const current = getOrder(row.id);
      if (!current) throw new NotFoundError("Pedido no encontrado.", "order_not_found");
      db.exec("COMMIT");
      committed = true;
      return { order: current, transactionId: null, duplicate: false, alreadySettled: true };
    }

    if (row.status === "paid" || row.status === "demo_paid") {
      throw new ConflictError(
        "El pedido ya está marcado como cubierto pero conserva saldo. No se registró otro pago.",
        "order_state_inconsistent",
      );
    }

    const key = rKey ?? autoKey(row.id, due);
    if (!rKey) {
      const event = findEvent(db, key);
      if (event) {
        const result = replay(db, event, row, input.method, due);
        db.exec("COMMIT");
        committed = true;
        return result;
      }
    }

    const txn = txnIdFor(key);
    if (findPayment(db, txn)) {
      // Pago con la llave determinista pero sin evento. No se crea otro pago.
      throw new ConflictError(
        "La operación tiene un pago sin evento. No se registró otro; requiere revisión.",
        "idempotency_incomplete",
      );
    }

    const payload = {
      v: 1,
      key,
      orderId: row.id,
      method: input.method,
      amountCents: due,
      requestId,
      transactionId: txn,
    };
    const eventId = newId("evt");
    db.prepare(`
      INSERT INTO payment_events
        (id, provider, event_type, idempotency_key, payload, payload_hash,
         signature_valid, processed_at, result, error)
      VALUES (?, 'demo', 'demo.payment', ?, ?, ?, 0, ?, 'received', NULL)
    `).run(
      eventId,
      key,
      JSON.stringify(payload),
      requestPayloadHash(payload),
      nowIso(),
    );

    const updated = recordPayment(row.id, {
      provider: "demo",
      method: input.method,
      amountCents: due,
      transactionId: txn,
      paymentLinkId: row.payment_link_id,
      rawEvent: JSON.stringify({
        demo: true,
        method: input.method,
        requestId,
        idempotencyKey: key,
      }),
    });

    db.prepare("UPDATE payment_events SET result = 'processed', error = NULL WHERE id = ?").run(eventId);
    db.exec("COMMIT");
    committed = true;
    return { order: updated, transactionId: txn, duplicate: false, alreadySettled: false };
  } finally {
    if (!committed) {
      try { db.exec("ROLLBACK"); } catch { /* SQLite pudo cerrar la transacción sola. */ }
    }
  }
}
```

**Replay / conflictos:**

```ts
function replay(
  db: DatabaseSync,
  event: EventRow,
  row: OrderRow,
  method: DemoPaymentMethod,
  dueCents: number,
): DemoPaymentResult {
  let payload: StoredPayload;
  try {
    payload = JSON.parse(event.payload) as StoredPayload;
  } catch {
    throw new ConflictError("El evento de idempotencia está corrupto.", "idempotency_incomplete");
  }

  const expectedHash = requestPayloadHash(payload as unknown as Record<string, unknown>);
  const storedHash = event.payload_hash ?? expectedHash;
  if (storedHash !== expectedHash) {
    throw new ConflictError("El evento de idempotencia no coincide con su hash.", "idempotency_conflict");
  }
  if (payload.orderId !== row.id) {
    throw new ConflictError("Ese requestId ya se usó en otro pedido.", "idempotency_conflict");
  }
  // Solo la llave de requestId tiene identidad de método. La automática es
  // "este pedido + este importe"; el método es informativo.
  if (event.idempotency_key.startsWith(`${P}:req:`) && payload.method !== method) {
    throw new ConflictError("Ese requestId ya se usó con otro método.", "idempotency_conflict");
  }
  if (event.result === "rejected" || event.result === "ignored") {
    throw new ConflictError("Ese evento no es aplicable a un pago demo.", "idempotency_conflict");
  }

  const txn = txnIdFor(event.idempotency_key);
  const payment = findPayment(db, txn);

  if (payment) {
    if (
      payment.order_id !== row.id ||
      Number(payment.amount_cents) !== Number(payload.amountCents) ||
      payment.status !== "paid"
    ) {
      throw new ConflictError(
        "El pago existente no coincide con el pedido o el importe del evento.",
        "idempotency_incomplete",
      );
    }
    if (event.result !== "processed") {
      db.prepare("UPDATE payment_events SET result = 'processed', error = NULL WHERE id = ?").run(event.id);
    }
    // recordPayment detecta el transactionId existente y cura la orden si
    // paid_cents/status quedaron viejos. No inserta otro pago.
    const healed = recordPayment(row.id, {
      provider: "demo",
      method: payload.method,
      amountCents: Number(payload.amountCents),
      transactionId: txn,
      paymentLinkId: row.payment_link_id,
      rawEvent: JSON.stringify({ demo: true, replayed: true, idempotencyKey: event.idempotency_key }),
    });
    return { order: healed, transactionId: txn, duplicate: true, alreadySettled: false };
  }

  if (event.result === "processed") {
    throw new ConflictError(
      "El evento figura procesado pero no tiene pago. No se registró dinero.",
      "idempotency_incomplete",
    );
  }
  if (dueCents <= 0 || dueCents !== Number(payload.amountCents)) {
    throw new ConflictError(
      "El saldo del pedido cambió desde la primera solicitud. Usa un requestId nuevo.",
      "idempotency_state_changed",
    );
  }

  // Evento sin pago con el mismo importe: se falla cerrado. No se crea dinero
  // a partir de un evento que pudo quedar de una versión anterior o de una
  // manipulación manual. Para reintentar, el cliente usa un requestId nuevo.
  throw new ConflictError(
    "La operación quedó sin pago y no se completó. No se registró dinero.",
    "idempotency_incomplete",
  );
}
```

**Decisión deliberada:** un evento sin pago **no se auto-cura**. Se falla con 409 y se deja el evento para diagnóstico. La ruta anterior podía dejar un evento en autocommit si `recordPayment` fallaba; ese evento tiene una llave vieja (`demo_txn_tx_...`) que no colisiona con las nuevas. Si apareciera una llave nueva sin pago, es corrupción, no un reintento legítimo. Crear dinero para "curar" sería peor que fallar.

`findPayment` debe consultar por `transaction_id` **sin filtrar `status`**. La rama de replay valida `status = 'paid'`; la rama de pago huérfano necesita detectar también un pago `pending`/`failed` con la misma llave para no insertar otro.

### 3.6 Tabla de decisión

| Evento por K | Pago por T(K) | `due` vs evento | Estado del pedido | Acción |
|---|---|---|---|---|
| No existe | No existe | `due > 0` | `confirmed`/`payment_pending`/`partially_paid`/`draft`/`fulfilled` | Insertar evento + `recordPayment` |
| No existe | No existe | `due <= 0` | cualquiera no cancelado | 200 no-op, sin evento nuevo |
| No existe | Existe | `due > 0` | cualquiera | 409 `idempotency_incomplete`; nunca segundo pago |
| No existe | Existe | `due <= 0` | cualquiera no cancelado | 200 no-op; el pago ya cubrió el saldo |
| Existe | Existe | cualquiera | cualquiera | 200 replay; `duplicate: true`; mismo `transactionId` |
| Existe | No existe | `due == amount` | cualquiera | 409 `idempotency_incomplete` (falla cerrada) |
| Existe | No existe | `due != amount` o `due <= 0` | cualquiera | 409 `idempotency_state_changed` |
| Existe | No existe | — | `event.result = processed` | 409 `idempotency_incomplete` |
| No existe | No existe | `due > 0` | `paid`/`demo_paid` | 409 `order_state_inconsistent` |
| No existe | No existe | `due > 0` | `cancelled` | 409 `order_cancelled` (se comprueba antes) |

Notas:

- Si `event.result = 'processed'` y no hay pago, gana `idempotency_incomplete` sobre cualquier comparación de saldo: es una inconsistencia, no un cambio de importe.
- `fulfilled` con `due > 0` se permite: es un pedido entregado con saldo, y `recordPayment` **no** degrada `fulfilled` (`orders.ts:679-680`). El pago solo actualiza `paid_cents`.
- `paid`/`demo_paid` con `due > 0` se rechaza: pagar ahí podría degradar la verdad del pedido. Es un estado inconsistente que requiere revisión.
- `cancelled` se rechaza siempre, incluso si `due = 0`, para no simular un cobro sobre un pedido cancelado.

### 3.7 Misma `requestId` con orden/método/importe distinto

La regla exacta:

| Dimensión | Regla | Código |
|---|---|---|
| Otro `orderId` | 409 siempre, aunque el primer pago ya exista. | `idempotency_conflict` |
| Otro `method` | 409 siempre, aunque el primer pago ya exista. | `idempotency_conflict` |
| Otro importe, sin pago aplicado | 409. El saldo cambió y la operación nunca se aplicó. | `idempotency_state_changed` |
| Otro importe, con pago aplicado | **200 replay**, no 409. | — |

La última fila es la sutileza importante. El cliente **no envía** `amountCents`; el servidor lo deriva dentro del lock. Después de un pago exitoso, el saldo pendiente cambia a 0. Si se comparara el importe recién derivado (0) contra el importe guardado (10000), un reintento legítimo después de una respuesta perdida daría 409 y rompería la idempotencia. Por eso:

- Si el pago existe, el replay devuelve el resultado original y no compara el saldo actual.
- Si el pago no existe, el importe guardado sigue siendo la intención original; si el saldo actual ya no coincide, 409.

Si en el futuro se quiere un 409 estricto por importe incluso después de un pago, se debe añadir un `expectedDueCents` opcional al body, incluirlo en el payload y compararlo antes del replay. **No se hace en este parche** para no cambiar el contrato de los clientes actuales.

### 3.8 Uso de `recordPayment` y SAVEPOINT

No se modifica `recordPayment`. La secuencia es:

```text
recordDemoPayment: BEGIN IMMEDIATE
  └─ INSERT payment_events (recibido)
  └─ recordPayment:
       ├─ SELECT pedido / transactionId existente
       ├─ SAVEPOINT payment_record
       ├─ INSERT payments (transaction_id = T(K))
       ├─ recalcula paid_cents/status desde payments
       ├─ audit payment.recorded
       └─ RELEASE SAVEPOINT
  └─ UPDATE payment_events (procesado)
COMMIT
```

- Si `recordPayment` falla, su `finally` hace `ROLLBACK TO SAVEPOINT` y relanza; el `finally` de `recordDemoPayment` hace `ROLLBACK` de la transacción externa. El evento también desaparece.
- Si `recordPayment` detecta un `transactionId` existente, no inserta: llama a `healOrderFromPayments` y devuelve la orden curada. El replay ya validó que ese pago pertenece al pedido y al importe.
- El `recordPayment` de la rama de replay se llama con el `transactionId` determinista; no inserta nada, solo cura si hace falta.
- No hay `Map`, `Set` ni caché de idempotencia en memoria. La única memoria es la conexión SQLite (`getDb`), que no guarda estado de operaciones.

### 3.9 Errores y códigos HTTP

| Código | HTTP | Cuándo | Escribe dinero |
|---|---:|---|---|
| `demo_disabled` | 403 | `DEMO_MODE=false` | No |
| `order_not_found` | 404 | No existe el pedido (o no es del comercio) | No |
| `demo_order_required` | 409 | `orders.demo != 1` | No |
| `order_cancelled` | 409 | Pedido cancelado | No |
| `order_state_inconsistent` | 409 | `paid`/`demo_paid` con saldo pendiente | No |
| `idempotency_conflict` | 409 | Mismo `requestId`, otro pedido/método; payload/hash corrupto | No |
| `idempotency_state_changed` | 409 | Evento sin pago y saldo distinto | No |
| `idempotency_incomplete` | 409 | Evento sin pago con el mismo saldo, o pago sin evento | No |
| `demo_pay_busy` | 503 | `SQLITE_BUSY` al abrir la transacción | No |
| `invalid_method` | 400 | Método fuera de `codi\|card\|wallet` (incluye `cash`) | No |
| `invalid_order_id` | 400 | Falta `orderId` o está vacío | No |
| `request_id_invalid` | 400 | `requestId` > 128 caracteres | No |

Los errores de dominio se lanzan como `AppError`/`ConflictError`/`NotFoundError` y la ruta los traduce con `appErrorResponse` (`web/src/lib/errors.ts:56-66`). No se devuelve el mensaje crudo de SQLite.

### 3.10 Compatibilidad con clientes actuales

- El body actual `{ orderId, method }` sigue siendo válido. Sin `requestId` se usa `K_auto`.
- `method` sigue con default `"card"`; `cash` sigue devolviendo 400.
- La respuesta exitosa conserva `order`; agrega `transactionId` como antes y, solo en replay/no-op, `duplicate`/`alreadySettled`. Los clientes actuales ignoran campos extra.
- En no-op (`due <= 0`) se devuelve `order` como hoy (más `alreadySettled: true`); no se inventa un `transactionId`.
- No hay migración ni cambio de tablas. Una base vieja sigue arrancando.
- El lock de `PaymentPanel` se mantiene como UX. No es la garantía; la garantía es el servidor.
- Un pedido con efectivo parcial + pago demo sigue quedando `mixed` (comportamiento actual de `recalculateOrderTotals`); este parche no impone un método único.

---

## 4. Diff mínimo por archivo

### 4.1 Nuevo: `web/src/lib/demo-payments.ts`

Contenido según el pseudocódigo de 3.5. Responsabilidades:

- `normalizeDemoRequestId`
- `reqKey`, `autoKey`, `txnIdFor`
- `findEvent`, `findPayment`
- `recordDemoPayment`
- `replay`
- Tipos `DemoPaymentMethod`, `DemoPaymentResult`, `StoredPayload`

No importa `getOrder` para el guard; usa SQL crudo con `merchant_id`. Sí usa `getOrder` para el no-op y `recordPayment` para el pago/replay. No toca `orders.ts`.

### 4.2 `web/src/app/api/demo/pay/route.ts`

Diff conceptual:

```diff
-import { getDb, getOrder, newId, nowIso } from "@/lib/db";
+import { recordDemoPayment } from "@/lib/demo-payments";
 import { appErrorResponse } from "@/lib/errors";
-import { recordPayment } from "@/lib/orders";
+import { MAX_REQUEST_ID_CHARS } from "@/lib/orders";
@@
 const bodySchema = z.object({
   orderId: z.string().trim().min(1),
   method: z.enum(["codi", "card", "wallet"]).default("card"),
+  requestId: z.string().trim().max(MAX_REQUEST_ID_CHARS).optional(),
 });
@@
-    const order = getOrder(body.orderId);
-    if (!order) {
-      return Response.json({ error: "Pedido no encontrado." }, { status: 404 });
-    }
-
-    const amountCents = Math.max(0, order.totalCents - order.paidCents - order.creditCents);
-    if (amountCents <= 0) {
-      return Response.json({ order });
-    }
-
-    const method = body.method;
-    const transactionId = `demo_txn_${newId("tx")}`;
-    const database = getDb();
-    database
-      .prepare(
-        `INSERT INTO payment_events
-         (id, provider, event_type, idempotency_key, payload, signature_valid, processed_at)
-         VALUES (?, ?, ?, ?, ?, ?, ?)`,
-      )
-      .run(
-        newId("evt"),
-        "demo",
-        "demo.payment",
-        transactionId,
-        JSON.stringify({ orderId: order.id, method, amountCents }),
-        0,
-        nowIso(),
-      );
-
-    const updated = recordPayment(order.id, {
-      provider: "demo",
-      method,
-      amountCents,
-      transactionId,
-      paymentLinkId: order.paymentLinkId,
-      rawEvent: JSON.stringify({ demo: true, method }),
-    });
-
-    return Response.json({ order: updated, transactionId });
+    const result = recordDemoPayment({
+      orderId: body.orderId,
+      method: body.method,
+      requestId: body.requestId || null,
+    });
+
+    return Response.json({
+      order: result.order,
+      ...(result.transactionId ? { transactionId: result.transactionId } : {}),
+      ...(result.duplicate ? { duplicate: true } : {}),
+      ...(result.alreadySettled ? { alreadySettled: true } : {}),
+    });
```

Manejo de Zod: conservar el mensaje actual de método para `path[0] === "method"`; agregar mensajes para `orderId` y `requestId`. No devolver el mensaje de método cuando el error es de `requestId`.

```diff
 if (error instanceof z.ZodError) {
+  const field = error.issues[0]?.path?.[0];
+  if (field === "orderId") {
+    return Response.json(
+      { error: "Falta el pedido a cobrar.", code: "invalid_order_id" },
+      { status: 400 },
+    );
+  }
+  if (field === "requestId") {
+    return Response.json(
+      { error: `El requestId no puede pasar de ${MAX_REQUEST_ID_CHARS} caracteres.`, code: "request_id_invalid" },
+      { status: 400 },
+    );
+  }
   return Response.json(
     { error: "Método demo inválido. Usa codi, card o wallet; el efectivo no se simula.", code: "invalid_method" },
     { status: 400 },
   );
 }
```

La ruta sigue haciendo, en este orden: `isDemoMode()` → rate limit → lectura limitada → `isJsonObject` → zod → helper. No se agrega ninguna lectura de DB antes del helper.

### 4.3 Opcional: `web/src/components/caja/payment-panel.tsx`

No es necesario para cerrar el P1: la llave automática cubre a los clientes que no envían `requestId`. Si se quiere trazabilidad por intento:

```diff
 async function demoPay(method: "codi" | "card" | "wallet") {
   ...
+  const requestId = crypto.randomUUID();
   const response = await fetch("/api/demo/pay", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
-    body: JSON.stringify({ orderId: order.id, method }),
+    body: JSON.stringify({ orderId: order.id, method, requestId }),
   });
```

Y el mismo cambio en `web/src/app/pay/[id]/checkout-client.tsx:181-185`.

**Recomendación:** dejarlo para una segunda fase. Si se hace, generar el `requestId` una vez por intento y reutilizarlo solo si se reintenta exactamente el mismo pedido+método; no generar uno nuevo tras un error de red ambiguo. Un `useRef` con `{ orderId, method, requestId }` es suficiente; no es una fuente de verdad, solo una ayuda de UX. El servidor ya es idempotente sin esto.

### 4.4 Nuevo: `web/scripts/p0-demo-pay-contract.mjs`

Basarse en `web/scripts/p0-demo-real-contract.mjs`:

- `mkdtemp` para DB, backups y logs.
- Dos servidores `next start` en `:3296` y `:3297`, mismo `DATABASE_PATH`, `DEMO_MODE=true`, `DATABASE_BACKUP_DIR` temporal, `APP_URL` por puerto.
- Arrancar A, esperar `/api/health`; arrancar B, esperar. Evita la carrera de migración/seed de dos procesos sobre una DB nueva.
- Tercera conexión `DatabaseSync` para el lock externo y las aserciones.
- `fetch` con timeout; `x-forwarded-for` único si hace falta para no tocar el rate limit de 30/min.
- `taskkill /PID ... /T /F` en Windows; `SIGTERM` en el resto.
- `finally` que cierra DB, mata servidores y borra el temporal.
- Salida `PASS/FAIL` por check y exit code 1 si algo falla.

### 4.5 `web/package.json`

```diff
+    "test:demo-pay": "node scripts/p0-demo-pay-contract.mjs",
```

Opcional: agregarlo a la lista de gates P1. No meterlo en `test:fix-datos` si se quiere mantener ese comando rápido; sí ejecutarlo en la aceptación del carril.

### 4.6 Archivos que no se tocan

- `web/src/lib/db.ts` (esquema, migraciones, `getOrder`).
- `web/src/lib/orders.ts` (`recordPayment`, `healOrderFromPayments`, `recalculateOrderTotals`).
- `web/src/app/api/webhooks/pey/**`.
- `web/src/lib/pey.ts`, `pey-events.ts`, `reconcile.ts`.
- `web/src/app/api/verify/**`.
- `web/src/app/api/orders/[id]/pay/route.ts` (link/QR real).
- `web/src/lib/types.ts` (no se expone `demo` en `Order` en este parche).

---

## 5. Matriz de pruebas A-J

> **Propuesta de mapeo.** Si el encargo ya fijó otro orden para A-J, conservar los IDs y remapear las aserciones; la cobertura debe ser la misma.

### 5.1 Montaje

- Build del commit a entregar (`npm run build`).
- DB temporal vacía; dos servidores demo sobre la misma DB.
- Cada check imprime `PASS/FAIL` y el detalle; el script termina con `P1 DEMO PAY · X PASS · Y FAIL`.
- Las pruebas D y H se repiten **6 rondas** para imitar la reproducción 3/6 de la auditoría. No basta una sola ronda.
- Para forzar la carrera, el test abre `BEGIN IMMEDIATE` en una tercera conexión, dispara los dos POST, espera ~500 ms y libera con `COMMIT`. Los dos servidores quedan bloqueados en su propio `BEGIN IMMEDIATE`; uno gana y el otro lee el estado ya commiteado. Si el entorno es lento, subir la espera a 1000 ms; el `busy_timeout` de 5 s da margen.
- El test conoce el esquema exacto de llaves y consulta por `idempotency_key` (`demo:pay:v1:req:lupita:<R>` y `demo:pay:v1:auto:lupita:<orderId>:<amount>`); no infiere por `payload` salvo para las consultas de invariantes.
- Salvo las consultas globales de 5.3, los conteos de pagos/eventos se limitan al `order_id` de la prueba.

### 5.2 Casos

| ID | Nombre | Preparación / acción | Aserciones |
|---|---|---|---|
| **A** | Pedido demo válido paga una vez | Crear pedido demo de 10000 (sin efectivo/fiado). `POST /api/demo/pay {orderId, method:"card"}`. | 200; `order.status="demo_paid"`; `order.paidCents=10000`; `transactionId` presente. DB: 1 pago `provider=demo`, `demo=1`, `amount=10000`; 1 evento `provider=demo`, `result=processed`; orden `paid_cents=10000`. |
| **B** | Pedido `demo=0` rechazado | Insertar por SQL un pedido `demo=0`, `payment_pending`, total 5000. `POST /api/demo/pay`. | 409 `demo_order_required`. DB: pedido sigue `payment_pending`, `paid_cents=0`; 0 pagos; 0 eventos. |
| **C** | Pedido inexistente | `POST /api/demo/pay {orderId:"ord_no_existe"}`. | 404 `order_not_found`; no hay filas nuevas. |
| **D** | Dos procesos, mismo `requestId` (6 rondas) | Por ronda: pedido demo 10000 y un `requestId` nuevo (`req-race-<ronda>`); lock externo; dos POST simultáneos a :3296 y :3297 con ese mismo `requestId` y método; liberar lock. | Ambos 200 (ninguno 500/409); exactamente 1 pago y 1 evento; `paid_cents=10000`; los dos `transactionId` coinciden; al menos una respuesta trae `duplicate:true` (la que llegó segunda). Repetir 6/6 con llaves distintas por ronda. |
| **E** | Replay secuencial mismo `requestId` | Pedido demo 10000; POST con `requestId=R`; repetir el mismo body. | Primer 200; segundo 200 `duplicate:true`; mismo `transactionId`; 1 pago; 1 evento; `paid_cents=10000`. El segundo replay ocurre con `due=0`: debe devolver 200, no 409 por “importe distinto”. |
| **F** | Mismo `requestId`, otro pedido | Pedidos demo A y B de 10000; pagar A con `R`; POST B con el mismo `R`. | Segundo 409 `idempotency_conflict`; B sin pagos/eventos; A intacto; 1 evento total. |
| **G1** | Mismo `requestId`, otro método | Pedido demo; pagar con `R`, `method:"card"`; reintentar con `R`, `method:"codi"`. | Segundo 409 `idempotency_conflict`; 1 pago; 1 evento; sin cambio de método. |
| **G2** | Mismo `requestId`, otro importe sin pago | Pedido demo 10000; insertar pago parcial 4000 `status=paid` (legacy) y actualizar orden a `partially_paid/paid=4000`; insertar evento con `R`, `amountCents=10000`, `result=NULL`, sin pago con `T(R)`; POST `R` método card. | 409 `idempotency_state_changed` (due 6000 ≠ 10000); no se inserta pago; sigue habiendo 1 pago legacy y el evento incompleto. |
| **H** | Dos procesos, sin `requestId` (6 rondas, cliente actual) | Igual que D pero el body solo `{orderId, method}`. | Ambos 200; exactamente 1 pago y 1 evento; `paid_cents=10000`; el segundo puede ser `alreadySettled:true`; repetir 6/6. |
| **I** | Estados terminales y método inválido | (a) Repetir A sin `requestId`; (b) pedido demo cancelado; (c) pedido demo `paid`/`demo_paid` con `due>0`; (d) pedido demo `fulfilled` con `due>0`; (e) `method:"cash"`. | (a) 200 no-op, 0 pagos nuevos; (b) 409 `order_cancelled`; (c) 409 `order_state_inconsistent`; (d) 200, 1 pago, status sigue `fulfilled`; (e) 400, 0 pagos. |
| **J** | Atomicidad, huérfanos y no regresión real | (1) Trigger que aborta el UPDATE de la orden; POST con `R`; drop trigger; reintentar `R`. (2) Evento sin pago con mismo importe; POST `R2`. (3) Pago existente con `T(R3)` pero sin evento y `due>0`; POST `R3`. (4) Servidor real con `DEMO_MODE=false`; POST demo pay. (5) `GET /api/verify` con un `transactionId` demo. | (1) Primer POST 500; 0 eventos y 0 pagos con esa llave; `paid_cents=0`; segundo POST 200 con 1 pago/1 evento. (2) 409 `idempotency_incomplete`; 0 pagos nuevos. (3) 409 `idempotency_incomplete`; 0 pagos nuevos. (4) 403 `demo_disabled`. (5) 200 `verified:false` (demo no es pey). (6) Invariantes finales: ningún pedido demo con `paid_cents>total_cents`; ningún `demo=0` con pago demo o estado `demo_paid`; todo pago demo nuevo tiene evento; todo evento procesado tiene pago. |

J puede ampliarse con una corrupción de importe: un pago existente cuyo `amount_cents` no coincide con el payload del evento debe responder 409 `idempotency_incomplete`, no insertar otro pago.

El servidor real de J(4) usa una DB temporal aparte; el endpoint responde 403 antes de tocarla, así que no contamina la base demo de las otras pruebas.

### 5.3 Consultas de invariantes al final del script

```sql
-- Nunca paid > total en pedidos demo
SELECT COUNT(*) AS n FROM orders WHERE demo = 1 AND paid_cents > total_cents;

-- Nunca un pedido real con pago demo o estado demo_paid
SELECT COUNT(*) AS n
FROM orders o
WHERE o.demo = 0
  AND (o.status = 'demo_paid'
       OR EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.provider = 'demo'));

-- Pagos demo nuevos sin evento (correlación por payload)
SELECT COUNT(*) AS n
FROM payments p
WHERE p.provider = 'demo'
  AND p.transaction_id LIKE 'demo_txn_%'
  AND p.transaction_id NOT LIKE 'demo_txn_tx_%'
  AND NOT EXISTS (
    SELECT 1 FROM payment_events e
    WHERE json_valid(e.payload)
      AND json_extract(e.payload, '$.transactionId') = p.transaction_id
  );

-- Eventos demo procesados sin pago
SELECT COUNT(*) AS n
FROM payment_events e
WHERE e.provider = 'demo' AND e.result = 'processed'
  AND json_valid(e.payload)
  AND NOT EXISTS (
    SELECT 1 FROM payments p
    WHERE p.transaction_id = json_extract(e.payload, '$.transactionId')
  );
```

Si el SQLite de `node:sqlite` no tuviera JSON1, sustituir `json_extract(...)` por una correlación con `e.payload LIKE '%' || p.transaction_id || '%'`; el test debe seguir pasando.

### 5.4 Comandos de aceptación

```powershell
cd web
npm run build
npm run test:demo-pay        # A-J, dos procesos, DB temporal
npm run test:demo-real       # regresión demo→real existente
npm run test:security        # CSRF/requestId/límites
npm run test:fix-datos       # orders atómicos, db guards, demo/real
npm run verify:fast
npm run verify:static        # o verify:full si el entorno lo permite
npm run verify:evidence
```

El script A-J no reemplaza `verify:full`: lo complementa. La evidencia debe quedar atada al commit entregado (`gitAtStart.sha`, `dirty:false`, `buildSha`).

---

## 6. Riesgos, carreras y mitigaciones

| # | Riesgo | Escenario | Mitigación | Residual |
|---|---|---|---|---|
| R1 | Carrera de lectura de saldo | Dos procesos leen `due` antes de que el otro escriba. | `BEGIN IMMEDIATE` antes de leer; relectura de `SUM(payments)` dentro del lock. | Si el lock dura más de `busy_timeout`, el segundo recibe 503 y reintenta; no duplica. |
| R2 | Dos `requestId` distintos, mismo pedido | Dos clientes/pestañas pagan a la vez con llaves distintas. | El lock serializa; el segundo ve `due=0` y devuelve no-op. La llave automática también cambia a `due=0` y no inserta. | Ninguno de dinero. El segundo puede recibir `alreadySettled`. |
| R3 | Evento sin pago | `recordPayment` falla después del INSERT del evento. | Evento y pago en la misma transacción externa; si falla, rollback total. | Un evento de una versión vieja con llave nueva no existe; si apareciera, 409 `idempotency_incomplete`. |
| R4 | Pago sin evento | Se borra/manipula el evento o una versión vieja dejó el pago. | Si `due>0` y existe `T(K)`, 409 y no se inserta otro pago. Si `due=0`, no-op. | El pago huérfano queda para diagnóstico; no se duplica. |
| R5 | Pedido ya completado | `paid`/`demo_paid` con `due>0`, o `fulfilled` con saldo. | `paid`/`demo_paid` con saldo: 409. `fulfilled`: se permite cobrar saldo y nunca se degrada. `due<=0`: no-op. | Un estado inconsistente requiere revisión; no se auto-corrige con dinero. |
| R6 | Pedido inexistente | ID inválido o de otro comercio. | SELECT crudo con `merchant_id`; 404 antes de escribir. | Ninguno. |
| R7 | Método incorrecto | `cash`, `mixed`, `unknown` o body inválido. | Zod allowlist antes de la transacción; 400. | Ninguno. No se confía en el método para decidir demo. |
| R8 | Modo real | `DEMO_MODE=false` o pedido `demo=0`. | 403 en ruta y helper; 409 `demo_order_required` para pedido real en demo. | La UI demo puede seguir mostrando botones sobre un pedido real; el servidor lo rechaza (P2 de UI). |
| R9 | `SQLITE_BUSY` | Otro proceso retiene el lock más de 5 s. | `busy_timeout=5000`; mapear a 503 `demo_pay_busy`; el cliente reintenta. | `node:sqlite` es síncrono: el proceso puede bloquear su event loop hasta 5 s. Mantener la sección crítica corta; no añadir `await`. |
| R10 | Commit incierto | El commit se aplica pero la respuesta se pierde. | Reintento con mismo `requestId` → replay; sin `requestId` → `due=0` no-op. | Ninguno de dinero. |
| R11 | Reset demo concurrente | El reset borra el pedido/pago después del commit. | `resetDemoData` también usa `BEGIN IMMEDIATE`; la respuesta usa el `Order` leído dentro de la transacción, no una lectura post-commit. | El reset es destructivo por diseño; el cliente puede ver éxito de un pedido ya borrado. |
| R12 | `requestId` reutilizado tras reset | El evento demo sobrevive al reset (hoy no se borra `payment_events`). | Llave nueva por operación; no reutilizar `requestId` después de un reset. Limpiar eventos demo en el reset es un follow-up. | Un `requestId` viejo contra un pedido nuevo da 409; es correcto para la llave, pero puede sorprender en ensayos. |
| R13 | Datos ya corrompidos | Pedidos `demo=0` con `demo_paid` o pagos demo; `paid_cents>total` por la carrera. | El fix no crea más corrupción; reparación separada (sección 7). | Sin reparación, la fila sigue mal. No se debe “arreglar” marcando `paid` sin evidencia pey. |
| R14 | Crecimiento de eventos demo | Un evento por pago demo; el reset no los borra. | Volumen bajo; retención/limpieza futura. | Tabla `payment_events` crece con la demo. |
| R15 | UI ofrece acción inválida | `Order` público no expone `demo`; el panel usa el modo global. | Guard server-side; mensaje 409 claro. | P2 de UI: ocultar botones demo para pedidos `demo=0` requiere exponer `demo` o un flag en el detalle. |

---

## 7. Datos ya corrompidos: diagnóstico y reparación

El fix es forward-looking. No repara filas que la carrera o el cruce demo/real ya hayan dejado mal. Antes de cerrar el P1 hay que **inventariar** (solo lectura) y decidir con el dueño.

### 7.1 Consultas de inventario

```sql
-- Pedidos reales contaminados con estado/pago demo
SELECT o.id, o.status, o.paid_cents, o.total_cents,
       (SELECT COUNT(*) FROM payments p
         WHERE p.order_id = o.id AND p.provider = 'demo') AS demo_payments
FROM orders o
WHERE o.demo = 0
  AND (o.status = 'demo_paid'
       OR EXISTS (SELECT 1 FROM payments p
                  WHERE p.order_id = o.id AND p.provider = 'demo'));

-- Pedidos demo con sobre-pago
SELECT id, total_cents, paid_cents, status
FROM orders
WHERE demo = 1 AND paid_cents > total_cents;

-- Eventos demo sin pago (posible evento de la ruta vieja)
SELECT e.id, e.idempotency_key, e.result, e.processed_at
FROM payment_events e
WHERE e.provider = 'demo'
  AND json_valid(e.payload)
  AND NOT EXISTS (
    SELECT 1 FROM payments p
    WHERE p.transaction_id = json_extract(e.payload, '$.transactionId')
  );

-- Pagos demo sin evento
SELECT p.id, p.order_id, p.transaction_id, p.amount_cents, p.status
FROM payments p
WHERE p.provider = 'demo'
  AND NOT EXISTS (
    SELECT 1 FROM payment_events e
    WHERE json_valid(e.payload)
      AND json_extract(e.payload, '$.transactionId') = p.transaction_id
  );
```

### 7.2 Política de reparación (fuera de este parche)

1. **No** cambiar un pedido a `paid` sin un webhook pey firmado. La regla de oro de `AGENTS.md` sigue vigente.
2. Un pago `provider=demo` no es dinero real. En una base real, esos pagos deben anularse/eliminarse y `paid_cents`/`status` deben recalcularse desde los pagos `pey`/`cash` reales.
3. Si el pedido no tiene ningún pago real, debe volver a `payment_pending`/`confirmed` según su saldo, no a `paid`.
4. En una base demo, `POST /api/demo/reset` con `force` (y backup) elimina pedidos/pagos demo; los `payment_events` demo hoy sobreviven. Si se reutilizan `requestId` en ensayos, limpiar eventos demo o usar llaves nuevas.
5. Cualquier reparación de datos reales requiere aprobación del dueño de pagos y evidencia antes/después. No se automatiza en este P1.

---

## 8. Criterios de aceptación

### 8.1 Funcionales

- [ ] A-J verdes en dos procesos sobre la misma SQLite temporal, con 6/6 rondas en D y H.
- [ ] Un pedido `demo=0` responde 409 `demo_order_required` y no cambia de estado ni recibe pagos/eventos.
- [ ] Un pedido demo válido queda `demo_paid`, con `paid_cents = total_cents` y exactamente un pago demo.
- [ ] Un reintento con el mismo `requestId` devuelve el mismo `transactionId` y no inserta filas.
- [ ] Un `requestId` usado con otro pedido/método responde 409 sin escribir.
- [ ] Un pedido ya cubierto responde 200 no-op sin pagos nuevos.
- [ ] `cash` responde 400; `codi|card|wallet` funcionan.
- [ ] `DEMO_MODE=false` responde 403; `/api/verify` con `transactionId` demo responde `verified:false`.

### 8.2 Invariantes de datos

- [ ] `SELECT COUNT(*) FROM orders WHERE demo=1 AND paid_cents > total_cents` = 0.
- [ ] `SELECT COUNT(*) FROM orders WHERE demo=0 AND status='demo_paid'` = 0.
- [ ] Ningún pedido `demo=0` tiene pagos `provider='demo'` después de las pruebas.
- [ ] Todo pago demo nuevo tiene un evento con el mismo `transactionId` en su payload.
- [ ] Todo evento demo `processed` tiene su pago.
- [ ] No hay `payments.transaction_id` duplicado (la UNIQUE lo impide) ni `payment_events.idempotency_key` duplicada.

### 8.3 No regresión

- [ ] `npm run test:demo-real` PASS.
- [ ] `npm run test:security` PASS.
- [ ] `npm run test:fix-datos` PASS (incluye `p0-orders-atomic`, `p0-db-guards`, `p0-demo-real`).
- [ ] Webhook pey: contrato/firma/idempotencia sin cambios; `webhook-contract`/gate PASS.
- [ ] `/api/verify` sigue rechazando demo y aceptando solo pey real.
- [ ] `fulfillOrder` sigue bloqueando `demo_paid`.
- [ ] El diff no toca `webhook/pey/reconcile/verify/real` ni el esquema.

### 8.4 Evidencia y build

- [ ] `npm run verify:fast` PASS.
- [ ] `npm run verify:static` PASS; `verify:full` si el entorno lo permite (tunnel/preflight pueden quedar parciales y documentados, nunca `ok:true`).
- [ ] `harness/evidence/latest.json` (o `latest-static.json`) con `ok:true`, `gitAtStart.sha` = commit entregado, `gitAtStart.dirty:false`, `buildSha` coincidente.
- [ ] `npm run verify:evidence` PASS.
- [ ] El test A-J se ejecutó contra el build de ese commit, no contra un servidor viejo.

### 8.5 Criterio de “P1 cerrado”

El P1 se cierra solo si se cumplen **todas**:

1. Guard `demo=1` server-side.
2. Lock + saldo releído dentro del lock.
3. Llaves durables y `transaction_id` determinista.
4. Evento/pago/orden/auditoría en una transacción.
5. A-J verdes, incluida la carrera multiproceso 6/6.
6. Sin cambios en real/webhook/pey/verify.
7. Decisión escrita sobre datos ya corrompidos (reparar, waiver o reset demo).

Si falta 2, 3 o 5, el P1 sigue abierto aunque el guard `demo=1` esté puesto.

---

## 9. Rollback

- No hay migración de esquema: revertir el commit es suficiente.
- Los pagos/eventos creados por la versión nueva usan columnas existentes y son compatibles con la versión anterior.
- Si se revierte, el endpoint viejo vuelve a generar `transactionId` aleatorio y reabre la carrera. Un rollback es solo una medida de emergencia; no debe considerarse una salida aceptable del P1.
- Ante un incidente en demo: detener el endpoint o desplegar el commit anterior, hacer backup y usar `POST /api/demo/reset` con `force` si la base es demo. No borrar datos reales.

---

## 10. Decisiones abiertas y recomendaciones

1. **409 vs 404 para `demo=0`.** Recomendación: 409 `demo_order_required`, porque es accionable y evita un “no encontrado” engañoso. Si seguridad prefiere no revelar existencia, cambiar a 404; el resto del diseño no cambia.
2. **`requestId` en el cliente.** No es necesario para el P1. Recomendación: dejarlo para una segunda fase; si se agrega, que sea por intento y reutilizado solo ante un error ambiguo del mismo pedido/método.
3. **Exponer `demo` en `Order`.** Permitiría ocultar los botones demo en pedidos `demo=0`. Es un cambio de contrato más amplio; recomendación: P2 de UI, no bloquear el P1.
4. **Limpiar `payment_events` demo en `resetDemoData`.** Útil para ensayos que reutilizan `requestId`; no es necesario para la corrección. Recomendación: follow-up con el dueño de datos.
5. **Reparación de datos ya corrompidos.** Requiere aprobación y evidencia; no se mezcla con el fix de código.
6. **`expectedDueCents` opcional.** Útil si en el futuro se quiere un 409 estricto por importe incluso en replay. No se agrega ahora para no cambiar el contrato.
7. **Integración en gates.** Recomendación: `test:demo-pay` como gate P1 separado; no dentro de `test:fix-datos` si se quiere mantener ese comando rápido.

---

## 11. Referencias

### Código

| Archivo | Líneas | Qué muestra |
|---|---:|---|
| `web/src/app/api/demo/pay/route.ts` | 15-20, 47-87, 88-98 | Body, cálculo de saldo, evento autocommit, `recordPayment`, manejo de errores. |
| `web/src/lib/orders.ts` | 528-627 | `recordPayment`, pre-check de `transactionId`, SAVEPOINT, heal. |
| `web/src/lib/orders.ts` | 634-707 | Recálculo de `paid_cents`/status desde `payments`; no degrada `fulfilled`. |
| `web/src/lib/orders.ts` | 709-742 | `healOrderFromPayments`. |
| `web/src/lib/db.ts` | 141-165 | `payments.transaction_id UNIQUE`, `payment_events.idempotency_key UNIQUE`. |
| `web/src/lib/db.ts` | 362-378 | Columnas `result`, `error`, `payload_hash`. |
| `web/src/lib/db.ts` | 1489-1499 | `getOrder` en demo devuelve también `demo=0`. |
| `web/src/lib/db.ts` | 1506-1510 | Clausura de visibilidad real. |
| `web/src/lib/db.ts` | 2019-2064 | `resetDemoData`; no borra `payment_events`. |
| `web/src/lib/request-hash.ts` | 25-30 | Hash canónico SHA-256. |
| `web/src/lib/errors.ts` | 9-66 | `AppError`, `ConflictError`, `appErrorResponse`. |
| `web/src/app/api/webhooks/pey/route.ts` | 191-236 | Patrón evento+procesamiento en una transacción. |
| `web/src/app/api/verify/route.ts` | 74-117, 159-164 | Verify solo pey; demo responde `verified:false`. |
| `web/src/components/caja/payment-panel.tsx` | 105-125, 220-235 | Botones demo y lock de UI. |
| `web/src/app/pay/[id]/checkout-client.tsx` | 173-200 | Pago demo del checkout. |

### Evidencia de la auditoría

- `quality-reports/oleada-b-review/auditorias/04_ventas_pagos.md` §P1-1.
- `quality-reports/oleada-b-review/09_HALLAZGOS_PRIORIZADOS.md` P1-10.
- `quality-reports/oleada-b-review/11_VEREDICTO_INDEPENDIENTE.md` P1-10.
- `quality-reports/oleada-b-review/10_PLAN_CORRECTIVO.md` fila 11.
- Evidencias citadas por la auditoría: `pagos-demo-pay-adversarial.json`, `pagos-demo-lock-race.json`, `pagos-demo-multiproceso.json`.

### Reglas del repo

- `AGENTS.md` — regla de oro: solo el webhook firmado de pey transiciona a `paid`; demo usa `demo_paid`.
- `web/AGENTS.md` — Next.js 16 y verificación.
- `quality-reports/oleada-b/CONTRATOS_VENTAS_PAGOS.md` §5 — contrato actual de `/api/demo/pay` y R-01/R-08.

---

## 12. Resumen para el orquestador

- **Qué corregir:** guard `orders.demo=1`, lock + saldo releído, llave durable por operación, `transaction_id` determinista, evento/pago en una transacción.
- **Qué no tocar:** webhook, pey, verify, rutas reales, `recordPayment`, esquema.
- **Qué probar:** A-J, con D/H en 6 rondas multiproceso, más `test:demo-real`, `test:security`, `test:fix-datos` y evidencia del commit.
- **Qué queda fuera:** reparar filas ya corrompidas, ocultar botones demo en UI, limpiar eventos demo en reset, `expectedDueCents`.
- **Condición:** si no hay prueba multiproceso 6/6 y no se cumple la atomicidad evento+pago, no se declara cerrado.

---

*Fin del análisis. No se modificó producto, no se ejecutaron pruebas de aceptación y no se hizo commit.*
