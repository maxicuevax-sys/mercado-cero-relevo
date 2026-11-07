# Fiado, abonos y corte — revisión adversarial de Oleada B

> **Rol:** `mc-fiado-corte` · **Modo:** auditoría ejecutada de **solo lectura de producto**. No se editó código, no se hizo commit, no se tocó `.env.local` ni datos productivos.
> **Repo:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero`
> **HEAD:** `4130e71d668e5e4693a8f5b634d2d2f953d21b02` (`docs: cierre formal local de Oleada B`)
> **Árbol de producto:** limpio. El único cambio es la carpeta no rastreada `quality-reports/oleada-b-review/` (evidencia).
> **Servidor de contexto:** demo `http://127.0.0.1:3100` (`buildSha=4130e71…`, `DEMO_MODE=true`).
> **Instancias de prueba:** `3105` (mismo build, `DEMO_MODE=true`, SQLite temporal) y `3106` (mismo build, `DEMO_MODE=false`, SQLite temporal) para aislar la matriz y leer las etiquetas de `/ventas` en modo real.
> **Fecha del snapshot:** 2026-11-04, 11:20–11:25 (-06:00).

---

## 0 · Veredicto ejecutivo

**Contrato financiero probado: APTO. No encontré P0 ni P1.**

La matriz ejecutada confirma, con datos y no solo por lectura:

- el fiado crea `credits` y **no** crea `payments`; no entra al corte como efectivo;
- la venta mixta persiste `paid_cents=6000` + `credit_cents=3000` y **un solo** `payments` de 6000; el cambio de 4000 no genera asiento;
- el abono baja `credits.balance_cents`, **no** crea una venta nueva y es idempotente con el mismo `requestId`;
- `/api/cash` y `/api/cash/preview` solo cambian con efectivo (venta o abono), nunca con fiado ni con digital pendiente;
- `orders.credit_cents` se conserva como **original** y `credits.balance_cents` es el **saldo vivo**;
- el cierre guarda `snapshot_cash = cashSales + cashCredit`, `snapshot_credit` = saldo vivo de fiado y `snapshot_pending_digital` = pendiente digital, y rechaza un fingerprint viejo con 409 `totals_changed`.

**Veredicto de aceptación de la lane: GO CON OBSERVACIONES.** Queda **un P2 de presentación** en `/ventas` (fiado parcial dice “Fiado, no cobrado” después de un abono) y tres P3 de lectura/demo. Ninguno altera saldos, asientos ni el corte. Si el criterio de GO exige que `/ventas` no afirme “no cobrado” cuando ya hubo un abono parcial, hay que corregir el P2 antes de cerrar.

**Resultados:** 49/49 aserciones en la matriz demo UI (3105), 8/8 en la comprobación API sobre 3100, y 16/17 en la lectura real de `/ventas` (3106). El único FAIL de la lectura real es el P2 descrito.

| Tarea solicitada | Dónde está la evidencia |
|---|---|
| 1. Venta a fiado desde `/caja` | §2.1, `fiado-corte-t1-fiado.json` |
| 2. Venta mixta efectivo + fiado | §2.2, `fiado-corte-t2-mixto.json`, `fiado-corte-mcfc-replay-mixto.json` |
| 3. Abono parcial, saldo y `/ventas` | §2.3, `fiado-corte-t3-abono-*.json`, `fiado-corte-mcfc-real-ventas.json` |
| 4. Buckets de `/api/cash` y preview | §2.4, `fiado-corte-mcfc-ui.json`, `fiado-corte-3100.json`, `fiado-corte-mcfc-close.json` |
| 5. `orders.credit_cents` vs `credits.balance_cents` | §2.5 |
| 6. Hallazgos P0–P3 | §4 |

---

## 1 · Método y entorno

### 1.1 Por qué hay una instancia aislada

El 3100 es un servidor demo compartido con otros auditores. Durante la ventana de esta revisión se observó:

- el número de órdenes pasó de **31 a 34 en 15 s**;
- la base se resembró a las **11:05:05** (cambiaron los IDs `demo_seed_*` y apareció un segundo seed);
- el corte del 3100 acumulaba **250 708 centavos** de ventas en efectivo de otras corridas.

Para que las comparaciones antes/después no dependieran de esas escrituras, la matriz completa se ejecutó contra una instancia del **mismo build** en `3105`, con `DEMO_MODE=true` y una SQLite temporal. Después se repitió una comprobación mínima **sobre el 3100 real** (fiado + abono, 8/8) usando un marcador único. La lectura de etiquetas de `/ventas` en modo real se hizo en `3106`, también con base temporal y sin generar links de pago reales.

No se llamó a pey. El único link generado fue el link demo (`?demo=1`) del 3105; en modo real no se generó ningún link.

### 1.2 Artefactos y scripts

- `quality-reports/oleada-b-review/EVIDENCIAS/fiado-corte-capture.mjs` — captura API + SQLite read-only por paso.
- `quality-reports/oleada-b-review/EVIDENCIAS/fiado-corte-e2e.py` — matriz UI/API de fiado, mixto, efectivo, digital y abonos.
- `quality-reports/oleada-b-review/EVIDENCIAS/fiado-corte-real-ventas.py` — lectura de `/ventas` en modo real.
- `quality-reports/oleada-b-review/EVIDENCIAS/fiado-corte-3100-check.mjs` — comprobación mínima en el 3100.
- Evidencia cruda: `fiado-corte-mcfc-*.json`, `fiado-corte-t*.json` (marker `AUD-FC-111553`), `fiado-corte-3100.json`, capturas PNG.

### 1.3 Archivos auditados (HEAD)

| Archivo | SHA-256 (16) |
|---|---:|
| `web/src/lib/orders.ts` | `0403960117F3BE23` |
| `web/src/lib/cash.ts` | `73E3E7F11FCBD453` |
| `web/src/lib/db.ts` | `40C6E63A809BB89B` |
| `web/src/app/ventas/page.tsx` | `38507ABF4729F29F` |
| `web/src/components/caja/caja-screen.tsx` | `72C31D70D8288F85` |
| `web/src/components/caja/sale-result.tsx` | `7A0A43DF9C62B81D` |
| `web/src/components/caja/sale-line-items.tsx` | `18A2B555CCAF3B62` |
| `web/src/components/caja/payment-panel.tsx` | `DD1E20ABFD51D8A3` |

---

## 2 · Resultados por tarea

### 2.1 T1 — venta a fiado desde `/caja` (tarea 1)

**Ejecución UI (3105, `DEMO_MODE=true`).** Total $100.00, método **Fiado**, cliente `Cliente Fiado AUD-FC-111553`.

Payload observado en el POST:

```json
{"items":[{"description":"Venta fiado AUD-FC-111553","quantity":1,"unitPriceCents":10000}],
 "cashCents":0,"creditCents":10000,
 "customerName":"Cliente Fiado AUD-FC-111553",
 "requestId":"sale_03cd0aa6-…"}
```

| Comprobación | Resultado |
|---|---|
| Orden | `ord_81cc6e31a1eb480189c9`, `status=confirmed` |
| `paid_cents` | **0** |
| `orders.credit_cents` | **10000** |
| `credit_id` | `cred_e20b00d76d6d44adac2f` |
| `payments` de la orden | **0 filas** |
| `credits.original_cents` / `balance_cents` | **10000 / 10000**, `status=open` |
| `/api/cash` antes → después | `cashSales 0→0`, `cashCredit 0→0`, `expected 50000→50000` |
| `/api/cash/preview` | mismo fingerprint `7cfc08e9d4a576e5` |
| `/ventas` | “Saldo vivo $100.00”; no dice “cobrado” |

Evidencia: `EVIDENCIAS/fiado-corte-t1-fiado.json`, `EVIDENCIAS/fiado-corte-mcfc-ui.json` (`T1-fiado`), captura `fiado-corte-mcfc-t1-fiado-resultado.png`.

**Comprobación sobre el 3100 compartido.** Marker `AUD-FC-3100-mw2dt62r`: fiado de 3000, orden `ord_10a0ae4799224c3890af`, crédito `cred_2e655417fab1433bbe73`. 0 `payments`; `paid_cents=0`; `credit_cents=3000`; `credits.original_cents=3000`. El corte no se movió: `cashSales 250708→250708`, `cashCredit 34000→34000` (health del servidor: `4130e71…`). Evidencia: `EVIDENCIAS/fiado-corte-3100.json`.

### 2.2 T2 — venta mixta efectivo + fiado (tarea 2)

**Ejecución UI (3105).** Total $90.00, efectivo recibido $100.00, fiado $30.00, cliente `Cliente Mixto AUD-FC-111553`.

Payload observado:

```json
{"items":[{"description":"Venta mixta AUD-FC-111553","quantity":1,"unitPriceCents":9000}],
 "cashCents":6000,"creditCents":3000,
 "customerName":"Cliente Mixto AUD-FC-111553",
 "requestId":"sale_c4fcc7a6-…"}
```

| Comprobación | Resultado |
|---|---|
| Orden | `ord_91e5bd49c3d24d6d83b0`, `confirmed` |
| `paid_cents` / `orders.credit_cents` | **6000 / 3000** |
| `payments` | **1 fila cash 6000** (`pay_78f0de8e…`) |
| Asiento por cambio 4000 | **ninguno** |
| `credits` | `cred_5af8176ecf8b450e8aa8` original 3000, balance 3000, open |
| Corte | `cashSales +6000`, `cashCredit +0`, `expected 56000` |
| UI resultado | “Recibiste $100.00”, “Efectivo aplicado $60.00”, “Saldo vivo fiado $30.00”, “Cambio $40.00” |
| Replay mismo `requestId` | **misma orden**, 0 filas nuevas (orders 19, payments 16, credits 3, credit_payments 2) |

El cambio es **presentación**: no se envía al servidor, no existe columna de cambio y no se inserta como pago, gasto ni retiro. La única verdad persistida es `orders.paid_cents=6000` y `payments.amount_cents=6000`.

Evidencia: `EVIDENCIAS/fiado-corte-t2-mixto.json`, `EVIDENCIAS/fiado-corte-mcfc-replay-mixto.json`, captura `fiado-corte-mcfc-t2-mixto-resultado.png`.

### 2.3 T3 — abono parcial, replay y liquidación (tarea 3)

**Abono parcial** `POST /api/credits/cred_e20b00d76d6d44adac2f/pay` con `amountCents=4000`, `method=cash`, `requestId=cp-AUD-FC-111553-1`:

- respuesta 200: `appliedCents=4000`, `balanceCents=6000`, `duplicate=false`;
- `credits.balance_cents` 10000 → **6000**, `status=partial`;
- `orders.credit_cents` sigue en **10000** (original);
- **1** fila nueva en `credit_payments` (4000, cash, provider `cash`);
- el total de órdenes no cambió: **19 → 19**;
- `/api/cash`: `cashCredit 0→4000`, `cashSales 11000→11000`, `expected 65000`;
- `/ventas`: “Saldo vivo $60.00”.

**Replay** del mismo `requestId`: `duplicate=true`, `appliedCents=4000`, `balanceCents=6000`; **no** inserta un segundo `credit_payment`; el corte no cambia.

**Liquidación** con 6000 (`requestId=cp-AUD-FC-111553-2`): `appliedCents=6000`, `balanceCents=0`, `status=settled`; `orders.credit_cents` sigue en **10000**; total de órdenes **19 → 19**; `cashCredit +6000`; `/ventas` muestra “Fiado saldado” y ya no “Saldo vivo”.

Evidencia: `EVIDENCIAS/fiado-corte-t3-abono-parcial.json`, `fiado-corte-t3-abono-replay.json`, `fiado-corte-t3-abono-total.json`, capturas `fiado-corte-mcfc-ventas-Cliente_Fiado_AUD-FC-111553-*.png`.

> **Matiz importante (P2-01):** en modo real, la fila de `/ventas` con abono parcial muestra `FIADO` + **“Fiado, no cobrado”** + “Saldo vivo $60.00”. El saldo vivo es correcto, pero “no cobrado” es falso para los $40 ya abonados. Ver §4.

### 2.4 T4 — buckets de `/api/cash` y preview (tarea 4)

Cada paso se midió con `/api/cash` y con `POST /api/cash/preview` usando la misma apertura (50000), gastos/retiros 0 y contado = apertura. Previews y status coincidieron siempre.

| Paso | cashSales | cashCredit | expected | Preview sales/credit/expected | Fingerprint |
|---|---:|---:|---:|---|---|
| Baseline | 0 | 0 | 50000 | 0 / 0 / 50000 | `7cfc08e9d4a576e5` |
| Fiado $100 | 0 | 0 | 50000 | 0 / 0 / 50000 | `7cfc08e9d4a576e5` (igual) |
| Mixto $90 (cash 60 / fiado 30) | 6000 | 0 | 56000 | 6000 / 0 / 56000 | `66f21154fa6ae52a` |
| Efectivo $50 | 11000 | 0 | 61000 | 11000 / 0 / 61000 | `0625dcf0006dc996` |
| Digital $80 pendiente | 11000 | 0 | 61000 | 11000 / 0 / 61000 | `0625dcf0006dc996` (igual) |
| Abono parcial $40 | 11000 | 4000 | 65000 | 11000 / 4000 / 65000 | `2b2c618ca52fbd7d` |
| Replay abono $40 | 11000 | 4000 | 65000 | sin cambio (cash igual) | `2b2c618ca52fbd7d` (sin cambio) |
| Abono total $60 | 11000 | 10000 | 71000 | 11000 / 10000 / 71000 | `bb71aac223ac1e30` |

Conclusión de buckets:

- **Fiado**: Δ0 en `cashSales` y `cashCredit`; no hay `payments` de la venta.
- **Digital pendiente**: Δ0 en el corte; el resumen sube `pendingCents` (+8000) pero no efectivo. Se generó además un link demo en 3105: la orden pasó a `payment_pending`, se mostró “Demo · pendiente” y “Falta cobrar $80.00”, y el corte siguió en 11000/10000. Evidencia: `fiado-corte-mcfc-digital-link.json`.
- **Abono**: solo sube `cashCredit`; no toca `cashSales`.
- **Venta efectivo/mixto**: solo la parte efectiva sube `cashSales`; la parte fiada no.
- **Preview**: la huella cambia con efectivo/abono y permanece igual con fiado, digital y replay.

**Cierre (3105).** Se cerró con apertura 50000, contado 71000, base 50000 y el fingerprint vigente:

| Campo | Valor |
|---|---:|
| `cashSalesCents` | 11000 |
| `cashCreditCents` | 10000 |
| `expectedCents` | 71000 |
| `countedCents` | 71000 |
| `differenceCents` | 0 |
| `snapshotCashCents` | 21000 (= 11000 + 10000) |
| `snapshotCreditCents` | 8000 (seed 5000 + mixto 3000; el fiado quedó settled) |
| `snapshotPendingDigitalCents` | 20000 (seed pendiente 12000 + digital 8000) |

Un cierre posterior con el fingerprint viejo respondió **409 `totals_changed`** y no creó una segunda versión (`savedVersion=1`). Evidencia: `fiado-corte-mcfc-close.json`, `fiado-corte-mcfc-close-stale.json`.

**3100 compartido.** La comprobación mínima también pasó 8/8: fiado 3000 sin `payments`, crédito 3000→2000 tras abono 1000, `cashSales 250708` sin cambio, `cashCredit 34000→35000`. Evidencia: `fiado-corte-3100.json`.

### 2.5 T5 — `orders.credit_cents` original vs `credits.balance_cents` vivo (tarea 5)

| Orden | `orders.credit_cents` (original) | `credits.balance_cents` (vivo) | Estado |
|---|---:|---:|---|
| Fiado `ord_81cc…` al crear | 10000 | 10000 | open |
| Fiado tras abono 4000 | **10000 (sin cambio)** | **6000** | partial |
| Fiado tras abono 6000 | **10000 (sin cambio)** | **0** | settled |
| Mixto `ord_91e5…` | 3000 | 3000 | open |
| Mixto tras abono 1000 (3106) | **3000 (sin cambio)** | **2000** | partial |
| Mixto tras abono 2000 (3106) | **3000 (sin cambio)** | **0** | settled |

La lectura final de la SQLite temporal del 3106 confirma los dos casos ya liquidados: `ord_b2cd…` conserva `credit_cents=10000` con `credits.balance_cents=0`; `ord_f98e…` conserva `credit_cents=3000` con `credits.balance_cents=0`. Evidencia: `EVIDENCIAS/fiado-corte-mcfc-real-db-final.json`.

La UI nueva distingue ambos campos:

- `/caja` pide el saldo vivo al detalle (`caja-screen.tsx:296-319`) y el resultado muestra “Saldo vivo” y, si aplica, “Original” (`sale-result.tsx:101-111`).
- `/ventas` usa `credit.balanceCents` para el saldo vivo y `order.creditCents` solo como original/fallback (`ventas/page.tsx:130-132, 185-200`). Si el crédito no se puede leer, la etiqueta es “Fiado original (saldo no disponible)”, no “Saldo vivo”.
- El corte usa `summary.creditCents` (suma de saldos vivos), no `orders.credit_cents` (`cash.ts:452`).
- El abono actualiza solo `credits.balance_cents` y `status` (`orders.ts:929-930`); no toca `orders.credit_cents` ni `orders.paid_cents`.

**No encontré una confusión original/vivo en el camino nuevo `/caja` + `/ventas`.** El único punto que sigue usando el original para decidir presentación es el caso parcial de `/ventas` (§4 P2-01), pero no para calcular el saldo.

---

## 3 · Matriz de evidencia (resumen)

| Caso | Orden / crédito | Resultado | Archivo |
|---|---|---|---|
| Fiado UI $100 | `ord_81cc…` / `cred_e20b…` | 0 payments, paid 0, credit 10000, cash Δ0 | `fiado-corte-t1-fiado.json` |
| Mixto UI $90 | `ord_91e5…` / `cred_5af8…` | 1 payment 6000, paid 6000, credit 3000, cambio 4000 sin asiento | `fiado-corte-t2-mixto.json` |
| Replay mixto | mismo `ord_91e5…` | misma orden, 0 filas nuevas | `fiado-corte-mcfc-replay-mixto.json` |
| Efectivo UI $50 | `ord_3264…` | 1 payment 5000; cashSales 11000 | `fiado-corte-t4-efectivo.json` |
| Digital UI $80 | `ord_e017…` | 0 payments; pending +8000; cash Δ0 | `fiado-corte-t4-digital.json` |
| Link demo digital | `ord_e017…` | `payment_pending`; “Falta cobrar $80”; cash Δ0 | `fiado-corte-mcfc-digital-link.json` |
| Abono parcial $40 | `cred_e20b…` | balance 6000, partial, 1 credi_payment; cashCredit 4000 | `fiado-corte-t3-abono-parcial.json` |
| Replay abono | `cred_e20b…` | duplicate true, sin segunda fila, cash igual | `fiado-corte-t3-abono-replay.json` |
| Abono total $60 | `cred_e20b…` | balance 0, settled; cashCredit 10000 | `fiado-corte-t3-abono-total.json` |
| Cierre v1 | `cash_cdfa…` | expected 71000; snapshots 21000/8000/20000 | `fiado-corte-mcfc-close.json` |
| Fingerprint viejo | — | 409 `totals_changed`, sin v2 | `fiado-corte-mcfc-close-stale.json` |
| 3100 fiado+abono | `ord_10a0…` / `cred_2e65…` | 8/8; cash del corte sin cambio por fiado | `fiado-corte-3100.json` |
| `/ventas` real | `AUD-RM-111754` | 16/17; falla solo el P2 de fiado parcial | `fiado-corte-mcfc-real-ventas.json` |
| Mixto parcial real | `cred_2fdc…` | “Cobrado $60” + “Saldo vivo $20”; abono no explícito | `fiado-corte-mcfc-real-mixto-abono.json` |
| Mixto saldado real | `cred_2fdc…` | “SALDADO” + “Cobrado $60” + “Fiado saldado $30” | `fiado-corte-mcfc-real-mixto-saldado.json` |

---

## 4 · Hallazgos P0–P3

### P0 — ninguno

No encontré un asiento incorrecto, un doble cobro ni un fiado/pendiente contado como efectivo en el camino probado. El replay de la venta mixta y del abono no duplicó filas; el cierre usó los buckets correctos.

### P1 — ninguno

No encontré una duplicación ni una afirmación falsa de dinero en el flujo principal de venta/abono/corte. La venta mixta persistió el efectivo aplicado (6000), no el efectivo recibido (10000), y el cambio no creó asiento.

### P2-01 — `/ventas` dice “Fiado, no cobrado” después de un abono parcial

**Evidencia ejecutada (modo real, 3106).** Fiado de $100, abono de $40:

```text
FIADO
Pedido AADC
Fiado · Real Fiado AUD-RM-111754
$100.00
Fiado, no cobrado
Saldo vivo $60.00
```

El saldo vivo es correcto, pero “Fiado, no cobrado” afirma que no se cobró nada cuando ya se cobraron $40. El estado de la fila tampoco distingue “parcial”: el badge es `FIADO`, no `Fiado parcial`/`Abonado`.

**Código:** `web/src/app/ventas/page.tsx:161-178` decide el texto con `order.paidCents > 0` y `creditBalanceCents === 0`; para un parcial con `paidCents=0` cae en “Fiado, no cobrado”. `statusLabel` (`:251-274`) usa `creditBalanceCents > 0` y `paidCents/digitalPaidCents`, pero no `credit.status === "partial"`.

**Impacto:** el operador puede creer que no ha cobrado nada y volver a cobrar los $100, aunque la libreta muestre $60. No corrompe el saldo; es una afirmación falsa sobre dinero ya cobrado.

**Acción:** usar `credit.status === "partial"` o `creditBalanceCents < order.creditCents` para mostrar “Fiado parcial” y “Abonado $40.00 · Saldo $60.00” (o “Cobrado $40.00 de fiado”) en la fila. Añadir una aserción de T3 para el parcial.

### P3-01 — En modo demo, `/ventas` sustituye “Saldado/Cobrado” por “Demo”

**Evidencia (3105).** Las filas demo muestran `DEMO` como estado y `Demo, no es dinero real` como línea de cobro; solo `payment_pending` conserva el sufijo `Demo · pendiente`. Ejemplos:

- fiado parcial: `DEMO … Demo, no es dinero real / Saldo vivo $60.00`;
- fiado saldado: `DEMO … Demo, no es dinero real / Fiado saldado $100.00`;
- mixto: `DEMO … Demo, no es dinero real / Saldo vivo $30.00`;
- digital pendiente: `DEMO · PENDIENTE … Por cobrar / Falta cobrar $80.00`.

**Código:** `ventas/page.tsx:128-129` (`isDemoOrder = demo || …`) y `:164-178` / `:257-259` sustituyen el estado y el cobro por la etiqueta demo. La línea de fiado (`:185-200`) y la de “Falta cobrar” (`:180-184`) sí conservan el dato financiero.

**Impacto:** en una demo no se puede leer el estado “Saldado” o “Cobrado” en el badge; solo en la línea de fiado/due. En modo real sí se leen (“SALDADO”, “Cobrado $60.00”, “PAGADO”). Es una decisión de presentación demo, no un error de saldo.

**Acción:** si la demo se usa para aceptación, mostrar un estado secundario (“Demo · Saldado”, “Demo · Cobrado $60”) sin quitar el aviso de que no es dinero real.

### P3-02 — En demo, `summary.cashCents` cuenta abonos demo pero no ventas demo en efectivo

**Evidencia (3105).** Tras la venta mixta (6000) y la venta en efectivo (5000):

- `/api/cash`: `cashSalesCents=11000`, `cashCreditCents=0`;
- `/api/dashboard.summary`: `cashCents=0`, `demoCashCents=18000` (seed 7000 + 11000), `methods={}`;
- la tarjeta “Cobrado confirmado” se calcula como `summary.cashCents + verifiedDigitalCents` (`ventas/page.tsx:98`), así que en ese estado mostraba **$0.00** aunque el corte ya tenía $110.00 de efectivo demo.

Tras el abono parcial de 4000:

- `/api/cash`: `cashCreditCents=4000`;
- `/api/dashboard.summary`: `cashCents=4000`, `demoCashCents=18000`, `methods={"cash":4000}`;
- la tarjeta “Cobrado confirmado” muestra **$40.00**, aunque su subtítulo dice “Solo efectivo real y pagos verificados; demo no cuenta”.

**Código:** `web/src/lib/db.ts:1816-1846`. El loop de `payments` manda a demo todo lo que tenga `provider="demo"` **o** `demo=1`; el loop de `credit_payments` solo manda a demo si `provider="demo"` **o** (`!includeDemo && demo=1`). En demo (`includeDemo=true`) un abono demo entra a `cashCents`; una venta demo en efectivo no. La tarjeta usa `summary.cashCents + verifiedDigitalCents` (`ventas/page.tsx:95-105`).

**Impacto:** solo demo. El corte y el dinero real no se ven afectados; la tarjeta de `/ventas` y el corte pueden parecer contradictorios en una demo. En modo real los buckets coincidieron (probado en 3106: `cashCents=42000` = `cashSales=22000 + cashCredit=20000`).

**Acción:** hacer simétrico el filtro demo de ambos loops o etiquetar la tarjeta como “incluye abonos declarados/demo” cuando `demo=true`.

### P3-03 — Un mixto saldado muestra “Cobrado $60.00” y no suma el abono de $30

**Evidencia (modo real, 3106).** Mixto de $90: efectivo $60 + fiado $30; el fiado se liquida con abonos. La fila queda:

```text
SALDADO
Pedido A5E8
Efectivo + fiado · Real Mixto AUD-RM-111754
$90.00
Cobrado $60.00
Fiado saldado $30.00
```

El estado “SALDADO” y “Fiado saldado $30.00” son correctos, pero “Cobrado $60.00” usa solo `order.paidCents`; el total realmente cobrado es $90.00 ($60 efectivo + $30 abonos). No hay una línea “Abonado $30.00”.

**Código:** `ventas/page.tsx:168-178` (`Cobrado` = `order.paidCents`); `:185-200` muestra el original del fiado, no el abonado. El abono no toca `orders.paid_cents` (`orders.ts:896-930`).

**Impacto:** subestima lo cobrado en la lectura rápida; el saldo/estado sí es correcto. No es un asiento incorrecto.

**Acción:** añadir “Abonado a fiado” = `order.creditCents - credit.balanceCents` o un “Cobrado total” separado; no mezclarlo con `paid_cents`.

---

## 5 · Lo que B sí cierra respecto del informe anterior

| Hallazgo previo | Estado en `4130e71` | Evidencia |
|---|---|---|
| F-01: editar líneas durante el POST | **Cerrado por lectura**: los inputs de línea aplican `disabled` (`sale-line-items.tsx:111,123,140`; `caja-screen.tsx:485`) | `sale-line-items.tsx`, `caja-screen.tsx` |
| F-04: una sola `PENDING_KEY` | **Cerrado por lectura**: la llave guarda `{orderIds:[]}` y se reanuda el último (`caja-screen.tsx:604-628`) | `caja-screen.tsx` |
| F-06: fiado saldado seguía “Fiado, no cobrado” | **Cerrado para liquidación total**: `/ventas` muestra “SALDADO”/“Fiado saldado” (3106); **queda el parcial** (P2-01) | `fiado-corte-mcfc-real-ventas.json` |
| F-09: mixto etiquetado “Efectivo” | **Cerrado**: `methodLabel` devuelve “Efectivo + fiado” (`ventas/page.tsx:278`) | captura/real ventas |
| F-02/F-03: original vs vivo en el replay/fallback | **Cerrado**: el detalle trae `credit.balanceCents`; el fallback se etiqueta “Fiado original (saldo no disponible)” (`caja-screen.tsx:296-319`; `ventas/page.tsx:183-198`) | `fiado-corte-t1-fiado.json` |
| F-08: pendiente digital por fila | **Cerrado**: “Falta cobrar $80.00” en la fila | `fiado-corte-mcfc-ventas-digital-pendiente.png` |

---

## 6 · Límites de esta revisión

1. **No se probó pey real ni webhook.** No se generó ningún link real; el link digital probado es demo (`?demo=1`). El modo real se limitó a efectivo/fiado/abonos.
2. **No se probó doble submit concurrente ni dos pestañas** creando la misma venta con llaves distintas. Sí se probó el replay secuencial con el mismo `requestId` (venta mixta y abono), que no duplica.
3. **No se probó overpay de abono ni el 409 `balance_changed`**; solo el abono parcial, replay y liquidación exacta.
4. **No se cerró el corte en el 3100 compartido.** El cierre se probó en la instancia aislada 3105; el 3100 solo se usó para la comprobación mínima de fiado/abono.
5. **El 3100 estaba siendo escrito por otros auditores.** Los totales absolutos del corte no son estables; las aserciones del 3100 usan un marcador/orden propios y deltas inmediatos.
6. **El modo demo tapa etiquetas de `/ventas`** (P3-01); la lectura de “Saldado/Cobrado/Pendiente” se hizo en 3106 (`DEMO_MODE=false`).
7. **No se auditó el flujo legacy `/`** (`caja-app.tsx`); el alcance es la Caja nueva `/caja` y `/ventas`.

---

## 7 · Condiciones para GO de esta lane

- Corregir **P2-01** (fiado parcial: “Fiado, no cobrado” → “Fiado parcial/Abonado $40 · Saldo $60”) si el criterio de aceptación incluye abonos parciales.
- Decidir si **P3-01/P3-02/P3-03** se corrigen en esta oleada o se aceptan documentados; no afectan saldos ni corte.
- Añadir a la matriz automatizada: (a) fila `/ventas` con abono parcial, (b) fila `/ventas` de mixto saldado, (c) comparación `summary.cashCents` vs `cashSales+cashCredit` en demo.
- Re-ejecutar la matriz sobre un 3100 limpio (o la instancia aislada) después del fix y adjuntar `latest.json`/evidencia con el SHA correcto.

---

## 8 · Anexo — evidencia principal

| Archivo | Qué contiene |
|---|---|
| `EVIDENCIAS/fiado-corte-mcfc-ui.json` | Matriz UI/API completa, 49/49, marker `AUD-FC-111553` |
| `EVIDENCIAS/fiado-corte-mcfc-ui.txt` | Resumen legible de la matriz |
| `EVIDENCIAS/fiado-corte-t1-fiado.json` | DB/API después del fiado |
| `EVIDENCIAS/fiado-corte-t2-mixto.json` | DB/API después del mixto |
| `EVIDENCIAS/fiado-corte-t3-abono-parcial.json` | DB/API después del abono 4000 |
| `EVIDENCIAS/fiado-corte-t3-abono-replay.json` | Replay idempotente |
| `EVIDENCIAS/fiado-corte-t3-abono-total.json` | Liquidación 6000 |
| `EVIDENCIAS/fiado-corte-mcfc-replay-mixto.json` | Replay del POST mixto, sin filas nuevas |
| `EVIDENCIAS/fiado-corte-mcfc-close.json` | Cierre v1 y snapshots |
| `EVIDENCIAS/fiado-corte-mcfc-close-stale.json` | 409 `totals_changed` |
| `EVIDENCIAS/fiado-corte-mcfc-digital-link.json` | Link demo, `payment_pending`, cash Δ0 |
| `EVIDENCIAS/fiado-corte-3100.json` | Comprobación 8/8 en el 3100 |
| `EVIDENCIAS/fiado-corte-mcfc-real-ventas.json` | `/ventas` real 16/17; P2-01 |
| `EVIDENCIAS/fiado-corte-mcfc-real-mixto-abono.json` | Mixto parcial real: “Cobrado $60” + “Saldo vivo $20” |
| `EVIDENCIAS/fiado-corte-mcfc-real-mixto-saldado.json` | Mixto saldado real: “SALDADO” + “Cobrado $60” + “Fiado saldado $30” |
| `EVIDENCIAS/fiado-corte-mcfc-real-db-final.json` | `orders.credit_cents` original vs `credits.balance_cents` vivo en los dos casos liquidados |
| `EVIDENCIAS/fiado-corte-mcfc-t1-fiado-resultado.png` | Resultado fiado $100 |
| `EVIDENCIAS/fiado-corte-mcfc-t2-mixto-resultado.png` | Resultado mixto con cambio $40 |
| `EVIDENCIAS/fiado-corte-mcfc-t4-digital-pendiente.png` | Panel digital “Falta cobrar $80” |
| `EVIDENCIAS/fiado-corte-mcfc-ventas-digital-pendiente.png` | Fila `/ventas` demo “Demo · pendiente” |

*Fin del informe. No se modificó código, no se hizo commit y no se tocaron datos productivos. Las escrituras fueron demo (`demo=1`) o bases SQLite temporales bajo `%LOCALAPPDATA%\Temp\opencode\fiado-corte\`.*
