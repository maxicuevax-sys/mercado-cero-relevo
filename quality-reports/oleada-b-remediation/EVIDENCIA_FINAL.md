# Evidencia final — remediación demo-only de `POST /api/demo/pay`

> **Alcance:** cierre local de la remediación del P1 de pagos demo de Oleada B.
> **No** cierra el handoff público ni los P0/P1 de producto de Oleada B.
> **No** inicia Oleada C.
>
> **Commits de producto:** `de7e339` (núcleo idempotente) + `f863df2`
> (mensaje seguro de `requestId`). **Commit de evidencia:** `178b619`
> (auditoría + documentos). El código de producción no cambió después de
> `f863df2`.

## 1. Diagnóstico reproducible (antes)

Se reprodujo en SQLite temporal, con dos procesos Node sobre la misma base:

- Un pedido insertado con `orders.demo = 0` fue aceptado por
  `POST /api/demo/pay` y terminó en `demo_paid`, con un pago `provider=demo`.
  Evidencia: `quality-reports/oleada-b-review/EVIDENCIAS/demo-pay-non-demo-repro.txt`.
- Dos solicitudes concurrentes al mismo pedido demo de 10 000 centavos
  insertaron dos pagos de 10 000 y dejaron `paid_cents = 20000` en 3 de 6
  rondas. Evidencia:
  `quality-reports/oleada-b-review/EVIDENCIAS/demo-pay-multiprocess-repro.txt`.
- El endpoint no recibía `requestId`; la única idempotencia era el bloqueo
  visual del cliente y un `transaction_id` aleatorio. La protección no era
  persistente ni compartida entre procesos.

**Veredicto del diagnóstico: el P1 era real.**

## 2. Corrección aplicada

Archivos de producto:

- `web/src/lib/demo-payments.ts` (nuevo): núcleo `recordDemoPayment`.
- `web/src/app/api/demo/pay/route.ts`: ruta delgada que delega en el núcleo y
  acepta `requestId` opcional.
- `web/scripts/harness-guard.mjs`: el guard sigue exigiendo `provider demo`,
  ahora leyendo el módulo donde vive.
- `web/scripts/p0-demo-pay-contract.mjs` (nuevo): contrato multiproceso.
- `web/package.json`: script `npm run test:demo-pay`.

No se modificaron `web/src/lib/orders.ts`, `db.ts`, `cash.ts`,
`payment-rules.ts`, el webhook de pey, `/api/verify`, checkout, `/pay/**` ni
la UI.

Propiedades:

1. `orders.demo = 1` se valida desde SQLite, con `merchant_id`, dentro de la
   transacción. `demo = 0` responde `409 demo_order_required` y no escribe
   pagos ni cambia el estado.
2. `BEGIN IMMEDIATE` se toma antes de leer el pedido. El saldo se calcula con
   `SUM(payments.amount_cents)` donde `status = 'paid'`; no se confía en un
   `orders.paid_cents` viejo.
3. La operación usa llaves persistentes:
   - `demo:pay:v1:req:lupita:<requestId>` cuando el cliente envía `requestId`.
   - `demo:pay:v1:auto:lupita:<orderId>:<amountCents>` cuando no lo envía,
     para no romper a los clientes actuales.
4. `payment_events.idempotency_key` (UNIQUE) y `payments.transaction_id`
   (UNIQUE) son las dos barreras durables. El `transaction_id` es
   determinista: `demo_txn_<sha256(payload)[0..40]>`.
5. Evento `received`, pago (`recordPayment`, SAVEPOINT) y evento `processed`
   viven en la misma transacción. Si el pago falla, no queda evento huérfano;
   si el evento falla, no queda pago huérfano.
6. Reintento idéntico: `200` con `duplicate: true`, sin pago nuevo.
7. Misma `requestId` con otro pedido o método: `409 idempotency_conflict`.
8. Pedido ya cubierto sin `requestId`: `200` con `alreadySettled: true`, sin
   movimiento nuevo.
9. Errores seguros: `404 order_not_found`, `409 demo_order_required`,
   `409 order_cancelled`, `409 order_state_inconsistent`,
   `409 idempotency_*`, `503 demo_pay_busy`; un fallo inesperado responde
   `500` sin detalles de SQLite.
10. `demo_paid` y `paid` siguen separados. La única ruta que marca `paid`
    sigue siendo el webhook firmado de pey.

## 3. Contrato A-M — 59 PASS / 0 FAIL

Ejecutado sobre el commit `178b619`, con build sellado
`178b61957d786f3a982941dc06a946a8ed351ed6` y árbol limpio:

| Bloque | Qué prueba | Resultado |
|---|---|---|
| 0 / 0b | `health.buildSha === HEAD` y árbol limpio | PASS |
| J | modo real rechaza `/api/demo/pay` con 403 | PASS |
| A | pedido `demo=0` rechazado con 409 y sin pagos/estado demo | PASS |
| B | primera operación demo válida: un pago, un evento `processed` | PASS |
| C | reintento idéntico: replay 200, sin pago ni evento nuevos | PASS |
| D / D2 | misma `requestId` con otro método / otro pedido: 409 | PASS |
| E | pedido inexistente: 404 | PASS |
| E2 | método inválido (`cash`): 400 | PASS |
| F | pedido ya completado sin llave: 200 `alreadySettled`, sin pago | PASS |
| G1–G6 | 6 rondas de dos procesos sobre el mismo pedido: un solo pago/evento | PASS |
| G7 | carrera con llave automática: un solo pago/evento | PASS |
| G8 | dos `requestId` distintos, mismo pedido: un solo pago | PASS |
| H | reinicio de procesos + reintento: replay, sin duplicado, `paid_cents` correcto | PASS |
| I | pago sin `requestId` con llave automática: un pago/evento | PASS |
| K | fallo atómico forzado en `payments`: 500 seguro, sin evento/pago, orden intacta | PASS |
| L | lock externo de una tercera conexión: 503 seguro y reintento posterior cobra una vez | PASS |
| M | invariantes globales: ningún pedido real en `demo_paid`, ningún sobrepago, todo evento procesado con su pago y todo pago del endpoint con su evento | PASS |

Evidencia cruda: `demo-pay-contract.txt`.

## 4. Regresión financiera y de Oleada B

Corrida `harness-gate --only=p0-venta,p0-fiado,p0-corte,p0-integracion,p0-dinero,webhook,checkout`
sobre `178b619`: **7/7 gates en verde** (modo `partial` por `--only`, que no
cuenta como evidencia full).

| Gate | Resultado |
|---|---|
| `webhook` | `WEBHOOK OK` + `40/40` |
| `checkout` | `CHECKOUT OK` + `19/19` |
| `p0-venta` | `66 PASS · 0 FAIL · 0 KNOWN` |
| `p0-fiado` | `51 PASS · 0 FAIL · 0 KNOWN` |
| `p0-corte` | `69 PASS · 0 FAIL · 0 KNOWN` |
| `p0-integracion` | `51 PASS · 0 FAIL · 0 KNOWN` |
| `p0-dinero` | `45 PASS · 0 FAIL · 3 KNOWN` |

Regresión de Oleada B aislada en `:3340` con base temporal:
`44 PASS · 0 FAIL`. Dos pestañas sobre el mismo pedido demo:
`1` panel por pestaña, `1` pago, `paid_cents = 10000`.

Evidencia cruda: `runtime-after.txt`, `smoke-b-after.txt`,
`two-tabs-after.txt`.

## 5. Evidencia formal

- `npm run verify:static` en `178b619`: **5/5 PASS** (`guard`, `lint`,
  `types`, `deps`, `build`), `ok:true`.
- `npm run verify:evidence -- --static`: **PASS**, árbol limpio,
  `gitAtStart.sha = 178b61957d786f3a982941dc06a946a8ed351ed6`,
  `buildSha` idéntico.
- `latest-static.json` queda como artefacto local en
  `harness/evidence/latest-static.json` (ignorado por git).
- El `full` sigue siendo **NO-GO local** por `tunnel` y `preflight`; no se
  declara handoff público.

## 6. Decisión sobre el harness

Se agregó `npm run test:demo-pay` para que el contrato sea descubrible y
repetible. **No** se añadió como gate del catálogo `verify:full` en esta
remediación, con waiver explícito:

- el contrato levanta y detiene **tres servidores propios** en `3331–3333` y
  usa una SQLite temporal;
- `verify:full` asume un servidor principal compartido y un catálogo estable
  de 25 gates; agregar un gate de infraestructura propia cambiaría los
  conteos canónicos y podría chocar con puertos del entorno de demo;
- el contrato se ejecuta obligatoriamente antes de cerrar cualquier cambio en
  `/api/demo/pay` o `lib/demo-payments.ts`, y su salida se conserva en
  `demo-pay-contract.txt`.

Este waiver es de **proceso**, no de producto. No debilita el guard ni las
suites financieras.

## 7. Decisiones P2 registradas

| P2 | Decisión |
|---|---|
| `demo/reset` no borra `payment_events` | Aceptado. Los eventos son auditoría y no mueven dinero. Un `requestId` viejo tras reset falla cerrado con `409 idempotency_incomplete`; el cliente puede usar una llave nueva. |
| `alreadySettled` no cura una orden con estado/saldo viejo | Aceptado como deuda. No crea dinero ni duplica pagos; una orden inconsistente requiere reconciliación explícita fuera de esta remediación. |
| La llave automática no incluye el método | Aceptado. Sin `requestId`, la identidad es pedido + importe; si ya está cubierto, el método es irrelevante. Con `requestId`, el método sí forma parte del conflicto. |
| `recordPayment` captura cualquier error `UNIQUE` como carrera | Preexistente, fuera de alcance. No se modificó `orders.ts`; el contrato K y G cubren el comportamiento observable. |
| `503` sin `Retry-After` | Aceptado. El cliente puede reintentar con la misma llave; no se agregó cabecera para no cambiar el contrato HTTP en esta remediación. |
| Mensaje de `requestId` engañoso para tipo inválido | Corregido en `f863df2`: longitud y tipo inválido tienen mensajes distintos. |

## 8. Límites y NO-GO que permanecen

- **Producto/demo local:** GO para el P1 de `/api/demo/pay`.
- **Handoff público:** **NO-GO**. Faltan `tunnel`/`preflight`, `latest.json`
  full actualizado, QR/lector/iOS y la cadena pública de pey.
- **Oleada B completa:** **NO-GO local**. Siguen abiertos los 2 P0 y 13 P1
  de `quality-reports/oleada-b-review/09_HALLAZGOS_PRIORIZADOS.md`
  (fiado con banner de efectivo falso, mixto que oculta efectivo, importe de
  línea invisible, CTA bajo el pliegue, reflow 200 %, borradores/Cajas
  duales, trampa de pendientes, cambio fantasma, historial que oculta pagos,
  pagos demo a crédito en “Cobrado”, nav legacy, duplicado 502+edición,
  foco de ruta e Inicio 768).
- **Oleada C:** no iniciada. La decisión sobre este P1 queda registrada aquí
  y en `VEREDICTO_INDEPENDIENTE.md`.
