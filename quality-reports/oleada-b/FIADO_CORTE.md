# Fiado, abonos y corte — Oleada B (`/caja` y `/ventas`)

> **Rol:** `mc-fiado-corte` · **Modo:** auditoría de **solo lectura**. No se editó código, no se hizo commit, no se ejecutaron gates ni pruebas que escribieran datos.
> **Repo:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero`
> **Rama:** `design/oleada-b-caja-ventas`
> **HEAD:** `26c7741` (`docs: cierre local de Oleada A`)
> **Árbol:** **sucio** (4 archivos modificados/borrados + WIP no rastreado). No es evidencia válida de cierre.
> **Snapshot de este informe:** 2026-11-04 09:27 (-06:00).
> **Alcance:** nueva venta de `/caja`, creación de fiado, venta mixta, abonos, corte de caja, `/ventas` como lectura, idempotencia y pedidos pendientes.

> **Nota de snapshot:** el WIP se movió durante la auditoría (últimos cambios: `caja-screen.tsx`/`sale-result.tsx` 09:26; `ventas/page.tsx` 09:23; `payment-panel.tsx` 09:20; `sale-summary.tsx` 09:19). Los hashes auditados están en §1.3. Si el WIP cambia otra vez, las líneas pueden desplazarse y hay que revalidar.

---

## 0 · Veredicto ejecutivo

**Veredicto de contrato financiero (por lectura): APTO EN EL CAMINO FELIZ.**
No encontré un error P0 de fórmula ni un doble asiento en el camino normal de efectivo, fiado, abono o corte. La venta nueva reutiliza `createOrder`; el fiado crea una fila en `credits` y **no** crea `payments`; el efectivo se inserta una sola vez; el corte suma `payments` (efectivo de venta) y `credit_payments` (abonos), no `orders.total_cents`. La venta mixta envía montos ya aplicados y el cambio es solo presentación.

**Veredicto de aceptación de Oleada B: NO-GO.**
No se puede declarar que “la nueva venta no rompe fiado, abonos ni corte” porque:

1. **P1 residual — doble registro si se editan las líneas durante el POST.** La pérdida de la llave sin `localStorage` **ya está corregida** con `requestRef` (`caja-screen.tsx:75, 274-284`) y el detalle posterior trae el saldo vivo (`296-319`). Queda que los inputs de línea no se deshabilitan mientras `saving` (`sale-line-items.tsx:94-128`): si el POST es lento, el usuario edita y la respuesta se pierde después del commit, el reintento cambia la firma y genera otra llave (`F-01`).
2. **P2 — `/ventas` no refleja abonos de fiado**: un fiado saldado puede seguir mostrando “Fiado, no cobrado” y estado “Registrado” (`F-06`). `F-02` (replay) y `F-03` (original vs vivo) quedaron cerrados.
3. **P3 (no bloqueante) — no hay tarjeta agregada de fiado vivo** (`F-07`); la tarjeta “Por cobrar digital” ya aclara que no incluye fiado y `F-08` (pendiente digital por fila) quedó cerrado.
4. **P2 — un solo `PENDING_KEY`** (`F-04`); los dos borradores independientes ya están documentados en la UI (`caja-screen.tsx:596-598`), pero no hay lock cross-tab (`F-05`).
5. **Cero evidencia ejecutada sobre `/caja` para fiado/corte.** El smoke existente es de las 08:55, el código auditado es de las 09:26, y el script no consulta `/api/cash`, `payments`, `credit_payments` ni `balance_cents`. No prueba nada de lo que este informe necesita.

**Para pasar a GO:** deshabilitar las líneas durante `saving` (F-01 residual), corregir `F-06` (abonos en la fila) y decidir `F-04`/`F-05`, ejecutar la matriz T1–T11 de §6 sobre un commit limpio y generar evidencia con `verify:evidence`.

---

## 1 · Método, árbol y evidencia

### 1.1 Qué se leyó

- **Venta nueva:** `web/src/components/caja/caja-screen.tsx`, `sale-summary.tsx`, `sale-line-items.tsx`, `sale-result.tsx`, `payment-panel.tsx`, `types.ts`.
- **Páginas:** `web/src/app/caja/page.tsx`, `web/src/app/ventas/page.tsx`, `web/src/app/page.tsx`, `web/src/app/ventas/route.ts` (borrado), `web/next.config.ts`, `web/src/components/shell/nav.ts`.
- **Motor financiero (sin cambios en este WIP):** `web/src/lib/orders.ts`, `cash.ts`, `db.ts`, `types.ts`, `request-hash.ts`.
- **APIs:** `web/src/app/api/orders/route.ts`, `api/orders/[id]/route.ts`, `api/orders/[id]/pay/route.ts`, `api/credits/[id]/pay/route.ts`, `api/demo/pay/route.ts`, `api/cash/*`.
- **Caja legacy (comparación):** `web/src/components/caja-app.tsx`.
- **Pruebas existentes:** `web/scripts/oleada-b-smoke.py`, `p0-venta-e2e.py`, `p0-dinero-e2e.py`, `p0-fiado-e2e.py`, `p0-corte-e2e.py`.

No se ejecutaron `npm run verify:*`, Playwright ni consultas de escritura. Todo lo que sigue es análisis estático y comparación con el contrato del repo.

### 1.2 Estado del árbol

```text
 M web/next.config.ts
 M web/src/app/inicio/page.tsx
 D web/src/app/ventas/route.ts
 M web/src/components/shell/nav.ts
?? web/src/app/caja/
?? web/src/app/ventas/page.tsx
?? web/src/app/ventas/ventas.css
?? web/src/components/caja/
```

`web/src/lib/orders.ts`, `web/src/lib/cash.ts` y `web/src/lib/db.ts` **no** aparecen modificados: el motor financiero es el de `26c7741`. El riesgo de B está en el payload y la presentación nueva, no en una reescritura del servidor.

Con este árbol, cualquier `latest.json` tendría `gitAtStart.dirty:true`; `verify:evidence` no puede dar GO (`AGENTS.md`, `HARNESS.md`).

### 1.3 Snapshot de archivos auditados

| Archivo | SHA-256 (16) | mtime |
|---|---|---:|
| `web/src/components/caja/caja-screen.tsx` | `91CAB63BAB07DAAF` | 09:26 |
| `web/src/components/caja/sale-line-items.tsx` | `6DB73E2CB12FD16A` | 09:17 |
| `web/src/components/caja/sale-summary.tsx` | `5C8406B93C320C7C` | 09:19 |
| `web/src/components/caja/sale-result.tsx` | `8ACF4E3131A4A7A2` | 09:26 |
| `web/src/components/caja/payment-panel.tsx` | `0C35543901FA5F96` | 09:20 |
| `web/src/components/caja/types.ts` | `5278E9F2E941446B` | 09:17 |
| `web/src/app/caja/page.tsx` | `62204D7B41538BE7` | 09:12 |
| `web/src/app/ventas/page.tsx` | `896B79ED50038BDD` | 09:23 |
| `web/src/components/caja-app.tsx` (legacy) | `D1FF5CED5445B49F` | — |
| `web/src/lib/orders.ts` | `0403960117F3BE23` | — |
| `web/src/lib/cash.ts` | `73E3E7F11FCBD453` | — |
| `web/src/lib/db.ts` | `40C6E63A809BB89B` | — |

---

## 2 · Lo que sí está bien (verificado por lectura)

### 2.1 Fiado: crea crédito, no efectivo

La venta nueva envía `creditCents` y `customerName` (`caja-screen.tsx:264-272`). El servidor:

- recorta primero efectivo y después fiado (`orders.ts:172-185`);
- inserta la orden con `paid_cents = cashCents` y `credit_cents = creditCents` (`orders.ts:234-255`);
- inserta **un** `payments` de efectivo solo si `cashCents > 0` (`orders.ts:284-301`);
- inserta **un** `credits` con `original_cents = balance_cents = creditCents`, `status='open'`, y actualiza `orders.credit_id` (`orders.ts:303-326`);
- todo ocurre dentro de `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK` (`orders.ts:222-355`).

Consecuencia: el fiado no genera un `payments`; por tanto no puede entrar en `cashSalesCents`. El corte de efectivo solo consulta `payments` (`cash.ts:226-234`) y `credit_payments` (`cash.ts:236-243`). El resumen diario separa efectivo (`db.ts:1816-1830`) de crédito (`db.ts:1879-1906`).

**Estado:** cumple por lectura. **No ejecutado.**

### 2.2 Venta mixta: envía aplicados y el cambio es presentación

La Caja calcula:

```text
creditAplicado = min(max(0, creditInput), total)
cashAplicado   = min(max(0, cashInput), total - creditAplicado)
cambio         = max(0, cashInput - cashAplicado)
```

(`caja-screen.tsx:77-90`). Envía exactamente `cashCents: appliedCashCents` y `creditCents: appliedCreditCents` (`caja-screen.tsx:264-272`), no el efectivo crudo recibido. El servidor recorta, pero como `cashAplicado + creditAplicado <= total`, no reasigna nada (`orders.ts:172-185`).

El ejemplo del smoke (total 90, recibido 100, fiado 30) produce payload 6000/3000, orden `paid_cents=6000`, `credit_cents=3000`, cambio 4000. El cambio **no** se envía, no existe columna de cambio (`db.ts:108-129`) y no se inserta como pago, gasto ni retiro. La única verdad persistida es `orders.paid_cents = 6000` y `payments.amount_cents = 6000` (`orders.ts:284-301`). El resultado nuevo separa “Recibiste” de “Efectivo aplicado” (`sale-result.tsx:89-104`), así que el cambio se explica sin inventar un movimiento; sigue sin persistirse tras recargar.

**Estado:** cumple por construcción. **No ejecutado.** No se puede comparar contra un “cambio del servidor” porque el servidor no lo guarda; se compara contra `payments.amount_cents` y el cálculo local.

### 2.3 Corte: buckets correctos y sin doble fuente

| Concepto | Fuente | Línea |
|---|---|---|
| `cashSalesCents` | `SUM(payments.amount_cents)` con `method='cash'`, `status IN ('paid','demo_paid')`, `provider != 'demo'` | `cash.ts:226-234` |
| `cashCreditCents` | `SUM(credit_payments.amount_cents)` con `method='cash'`, `provider != 'demo'` | `cash.ts:236-243` |
| `expectedCents` | `opening + cashSales + cashCredit - expenses - withdrawals` | `cash.ts:257-258` |
| `snapshot_cash_cents` | `cashSales + cashCredit` | `cash.ts:451` |
| `snapshot_credit_cents` | `summary.creditCents` (saldo vivo de fiado) | `cash.ts:452`; `db.ts:1879-1906` |
| `snapshot_pending_digital_cents` | `summary.pendingCents` (saldo de pedidos, sin fiado) | `cash.ts:453`; `db.ts:1862-1868` |

La venta nueva inserta **una** fila de efectivo por la parte cobrada en efectivo, **cero** filas por la parte fiada y **cero** por la parte digital hasta que se pague. No hay una consulta del corte que sume `orders.total_cents` como si fuera efectivo. Por tanto, el camino normal no duplica ni inventa movimientos.

**Estado:** cumple por lectura. **No ejecutado.**

### 2.4 `/ventas` en el camino normal: lectura y saldo vivo

La página solo llama funciones de lectura: `getDailySummary`, `sumPendingOrderBalances`, `countOrders`, `listOrders`, `getCredit` (`ventas/page.tsx:15-21, 44-50, 127`). No hay POST/PATCH, ni formulario, ni mutación de `updated_at`.

El saldo de fiado se obtiene de `credit?.balanceCents` (`ventas/page.tsx:130-132`), que en `getCredit` sale de `credits.balance_cents` (`db.ts:1737-1763`), y se muestra como “Saldo vivo” (`ventas/page.tsx:183-198`). Si el crédito no se puede leer, la fila dice “Fiado original (saldo no disponible)”, no “Saldo vivo”. El `statusLabel` mira el saldo de crédito antes de `paid` (`ventas/page.tsx:249-268`), así que un pedido `paid` con fiado abierto no se rotula “Pagado” (esto cierra el hallazgo H-04 de `AUDITORIA_REPO.md`).

**Estado:** cumple en el camino normal. **No ejecutado.** La falta de abonos en la fila `F-06` sigue abierta; `F-02` y `F-03` quedaron cerrados.

### 2.5 Idempotencia del servidor (independiente del cliente)

El servidor es correcto:

- hash canónico con ítems, `cashCents`, `creditCents`, `customerName` (`orders.ts:196-207`);
- búsqueda antes y dentro de la transacción (`orders.ts:211-232`);
- índice único `(merchant_id, request_id)` (`db.ts:350`);
- mismo payload → mismo pedido; payload distinto → 409 (`orders.ts:56-91`).

El cliente conserva la llave en `requestRef` y en `localStorage` (`caja-screen.tsx:75, 274-284`): el ref cubre la misma pantalla y el storage la recarga. El hueco restante es editar la venta mientras el POST está en vuelo (`F-01`).

---

## 3 · Matriz de requisitos

| Requisito | Evidencia estática | Estado |
|---|---|---|
| Fiado crea crédito | `orders.ts:303-326`; `credits.balance_cents` | **CUMPLE POR LECTURA** · no ejecutado |
| Fiado no cuenta como efectivo | `cash.ts:226-243`; `db.ts:1816-1846` | **CUMPLE POR LECTURA** · no ejecutado |
| Mixto envía montos aplicados | `caja-screen.tsx:77-90, 264-272` | **CUMPLE POR LECTURA** · no ejecutado |
| Cambio coincide con el servidor | no hay campo de cambio; solo `payments.amount_cents` y `orders.paid_cents` | **CUMPLE POR CONSTRUCCIÓN** · no hay verdad server de “cambio” |
| Corte usa `cashSalesCents`/`cashCreditCents` | `cash.ts:226-243, 257-258` | **CUMPLE POR LECTURA** · no ejecutado |
| Corte no duplica | una fila cash por venta; fiado sin `payments` | **CUMPLE POR LECTURA** · no ejecutado |
| `/ventas` no escribe | `ventas/page.tsx:15-21, 44-50, 127` | **CUMPLE POR LECTURA** · no ejecutado |
| `/ventas` muestra saldo vivo | `ventas/page.tsx:130-132, 183-198`; `db.ts:1737-1763` | **CUMPLE POR LECTURA** · original etiquetado si falta el crédito |
| `/ventas` muestra pendiente digital | `ventas/page.tsx:133-136, 178-182` | **CUMPLE POR LECTURA** · no ejecutado |
| Abono no duplica venta | `orders.ts:928-930` solo toca `credits` | **CUMPLE POR LECTURA** · fila de `/ventas` no lo refleja (`F-06`) |
| Doble registro | `orders.ts:211-232` + llave cliente | **RIESGO ABIERTO** `F-01` residual/`F-05` |
| Dos borradores / dos llaves | v2 nueva vs v1 legacy; independencia ya declarada en UI | **RIESGO DOCUMENTADO** `F-05` |
| Pendientes huérfanos | `PENDING_KEY` única | **RIESGO ABIERTO** `F-04` |

---

## 4 · Hallazgos

> Severidad: **P0** = dinero/asiento incorrecto en camino normal; **P1** = duplicado o afirmación falsa de dinero en un flujo realista; **P2** = saldo/estado mal presentado o riesgo operativo; **P3** = copy/consistencia.

### F-01 — P1 residual — La llave ya no se pierde sin `localStorage`, pero la UI permite editar líneas durante el POST

**Evidencia.**
- **Corregido:** `caja-screen.tsx:75` añade `requestRef`; `274-284` hace `const stored = requestRef.current ?? readStoredRequest()`, guarda `requestRef.current = { requestId, signature }` y, si el storage lanza, conserva la llave en memoria. Esto cierra la pérdida de llave que tenía la primera pasada.
- **Sigue abierto:** `SaleLineItems` recibe `disabled={saving}` (`caja-screen.tsx:490`) pero los inputs de descripción, cantidad y precio **no** aplican `disabled` (`sale-line-items.tsx:94-128`); solo el botón de quitar y el de agregar lo usan (`:143`, `:198`). El payload ya se envió en `caja-screen.tsx:264-293`.
- Si el usuario edita una línea mientras el POST está en vuelo y la respuesta se pierde después del commit, el reintento tiene otra firma → `stored?.signature !== signature` → **nueva llave** → segunda venta. `friendlySaleError` avisa “si cambias los productos o el monto, revisa Ventas” (`caja-screen.tsx:605-616`), pero no bloquea la edición.

**Impacto.** Segunda orden, segundo `payments` cash y segundo `credits`; el corte suma ambos efectivos. Es el camino de doble registro que `requestId` debía evitar, ahora acotado a la ventana de edición durante un POST lento.

**Acción.** Deshabilitar todos los inputs de línea mientras `saving` (o bloquear la edición con un overlay) y mantener el aviso de “reintentar sin editar”. Probar T6b/T6d.

---

### F-02 — CERRADO durante la auditoría — El replay ya refresca el saldo vivo

**Primera pasada.** El POST hacía `setCreditBalanceCents(created.creditCents)` y el resultado podía mostrar el fiado original como saldo vivo.

**Estado actual (snapshot 09:26).** `caja-screen.tsx:296-319` hace un `GET /api/orders/{created.id}` después del POST, reemplaza `created` por el detalle y usa `detail.credit?.balanceCents` para `setCreditBalanceCents`. El fallback al original solo queda si el GET de detalle falla (`308`), y en ese caso se muestra la respuesta del POST. **F-02 queda cerrado en el camino normal.** T2/T3 con replay siguen siendo obligatorios.

---

### F-03 — CERRADO durante la auditoría — `/ventas` ya distingue el original de un saldo vivo

**Primera pasada.** Si `getCredit` devolvía `null`, la fila usaba `order.creditCents` y lo rotulaba “Saldo vivo”.

**Estado actual (snapshot 09:23).** `ventas/page.tsx:130-132` calcula `creditKnown` y el saldo; `183-198` muestra:
- “Saldo vivo” solo si `creditKnown && creditBalanceCents > 0`;
- “Fiado saldado” si el crédito existe y el saldo es 0;
- “Fiado original (saldo no disponible)” si no se pudo leer el crédito.

El monto original ya no se presenta como deuda viva. **F-03 queda cerrado.** `statusLabel` (`249-268`) todavía usa el fallback para decidir “Fiado”, pero no afirma que sea saldo vivo. T5 con un fixture sin crédito sigue siendo obligatorio.

---

### F-04 — P2 — `PENDING_KEY` es una sola ranura; el segundo cobro pisa al primero

**Evidencia.**
- Una sola llave: `PENDING_KEY = "mercado-cero:caja-pending:v2"` (`caja-screen.tsx:34`).
- Se sobrescribe al crear otro pedido con saldo: `caja-screen.tsx:325-327`.
- `clearDraft()` **ya no** la elimina: solo borra `DRAFT_KEY` y `REQUEST_KEY` (`caja-screen.tsx:166-186`). Ese cambio de la primera pasada está bien.
- La restauración solo lee una llave (`caja-screen.tsx:114-149`).

**Impacto.** Si hay dos cobros digitales pendientes, solo el último se reanuda. El primero sigue existiendo y aparece en `listPendingOrders` (`db.ts:1441-1456`) y en `/pendientes`, pero la Caja nueva ya no lo recuerda; el operador puede volver a registrar la misma venta. **No es un huérfano contable** (la orden existe y es visible en pendientes), es un **huérfano de reanudación** con riesgo de duplicado.

**Acción.** Guardar una lista/cola de `orderId` o mostrar “tienes N cobros pendientes” con enlace a `/pendientes`; no prometer que la Caja reanuda más de uno. Probar T7b.

---

### F-05 — P2 — Dos Cajas, dos borradores y dos llaves independientes (documentado, sin lock)

**Evidencia.**
- Nueva: `mercado-cero:caja-draft:v2`, `...:caja-request:v2`, `...:caja-pending:v2` (`caja-screen.tsx:32-34`).
- Legacy: `mercado-cero:draft:v1`, `...:sale-request:v1`, `...:pending-order:v1` (`caja-app.tsx:105-112`).
- `/` sigue renderizando la Caja legacy (`app/page.tsx:13-33`); la Caja nueva enlaza a la Caja clásica y **ya declara** que “los borradores de cada pantalla son independientes” (`caja-screen.tsx:596-598`); la nav apunta “Caja” a `/caja` (`nav.ts:27`).
- No hay migración v1→v2 ni `BroadcastChannel`/lock entre pestañas.

**Impacto.**
- Un borrador empezado en `/` no se ve en `/caja` y viceversa: **dos borradores**. La UI ahora lo advierte; no es una promesa de continuidad.
- La misma venta física puede registrarse en las dos pantallas: **dos llaves**, dos órdenes, dos pagos, dos créditos.
- Dos pestañas de la misma `/caja` comparten `DRAFT_KEY` (last-write-wins) pero cada una genera su propia llave; un doble confirm puede crear dos ventas.

**Acción.** O compartir un `sale-storage.ts` con migración v1→v2 y lock cross-tab, o aceptar formalmente la independencia ya documentada y no prometer “sin duplicados” entre pantallas. Probar T6e/T7.

---

### F-06 — P2 — `/ventas` no refleja abonos de fiado: en modo real, un fiado saldado sigue mostrando “Fiado, no cobrado”

**Evidencia.**
- La fila decide el texto del cobro así (`ventas/page.tsx:161-198`): `isDemoOrder` → “Demo, no es dinero real”; `payment_pending` → “Pendiente de cobro”; `paidCents > 0` → “Cobrado”; `creditCents > 0` → “Fiado, no cobrado”; si no, “Sin cobro confirmado”.
- `order.paidCents` solo contiene efectivo/digital de la venta; **no** contiene abonos de fiado. `recordCreditPayment` actualiza `credits.balance_cents` e inserta `credit_payments`, pero no toca `orders.paid_cents` ni `orders.status` (`orders.ts:928-930`).
- Para un fiado de $100 pagado completo por abono, en modo real (`isDemoOrder=false`): `order.paidCents=0`, `order.status='confirmed'`, `credit.balanceCents=0`. La fila queda: estado “Registrado” (`ventas/page.tsx:249-268`), “Fiado, no cobrado” (`172-173`) y “Fiado saldado $100” (`183-198`). Es contradictorio.
- El total de la página sí incluye el abono en `summary.cashCents` (`db.ts:1832-1846`), así que la fila y el resumen no cuadran.

**Impacto.** El historial puede decir que no se cobró un fiado que sí se cobró. No corrompe saldos, pero es justo la reconciliación fiado/abono que este carril debía verificar.

**Acción.** Mostrar “Abonado a fiado” = `order.creditCents - credit.balanceCents` y un estado “Fiado saldado”/“Pagado por abonos”; o calcular un “Cobrado total” separado (efectivo/digital + abonos) sin mezclarlo con `paid_cents`. Probar T3/T5.

---

### F-07 — P3 residual — No hay tarjeta agregada de fiado vivo (la tarjeta digital ya es honesta)

**Primera pasada.** “Por cobrar” usaba `pendingCentsTotal`, que excluye el fiado, y se leía como si todo lo pendiente fuera cero.

**Estado actual (snapshot 09:23).** La tarjeta se llama “Por cobrar digital” y dice “Links y QR de todos los días. No incluye fiado.” (`ventas/page.tsx:106-110`). Ya no hay una promesa falsa de que el fiado esté incluido. Lo que falta es una tarjeta agregada de fiado vivo; el saldo sí está en `summary.creditCents` (`db.ts:1906`) y en cada fila.

**Impacto.** El operador tiene que sumar las filas para saber el fiado total. No es un error de saldo ni de corte; es una comodidad de lectura.

**Acción.** Opcional: añadir “Fiado vivo” con `summary.creditCents`; no bloquea. Probar T1/T3/T6.

---

### F-08 — CERRADO durante la auditoría — `/ventas` ya muestra el pendiente digital por pedido

**Primera pasada.** La fila no mostraba `due = total - paid - credit`.

**Estado actual (snapshot 09:23).** `ventas/page.tsx:133-136` calcula `digitalDueCents` y `178-182` muestra “Falta cobrar” con el monto. El caso total $100 / efectivo $20 / fiado $50 / digital $30 ahora dice “Cobrado $20”, “Falta cobrar $30”, “Saldo vivo $50”. **F-08 queda cerrado.** T9 sigue siendo obligatorio.

---

### F-09 — P3 — La venta mixta efectivo+fiado se etiqueta “Efectivo” en `/ventas`

**Evidencia.** El servidor pone `payment_method='cash'` siempre que `cashCents > 0` (`orders.ts:247`); `/ventas` traduce `cash` a “Efectivo” (`ventas/page.tsx:270-288`). `methodLabel` sí mejora el caso fiado puro (`creditCents > 0 && !paymentMethod` → “Fiado”, `272`) y el digital sin método (`273`), pero no el mixto con efectivo. El `paymentMethod` del request se acepta pero se ignora (`api/orders/route.ts:46`; `orders.ts` no lo lee). Una venta de $60 efectivo + $30 fiado se muestra “Efectivo” y “Saldo vivo $30”.

**Impacto.** Copy/reporte inconsistente, no un asiento incorrecto. Puede ocultar el fiado en una lectura rápida o en un export.

**Acción.** Derivar la etiqueta de `creditCents > 0 && paidCents > 0` → “Mixto”/“Efectivo + fiado”; o eliminar `paymentMethod` del contrato de entrada.

---

### F-10 — CERRADO durante la auditoría — `parseMoneyCents` y separador de miles

**Primera pasada.** `types.ts:17-25` reemplazaba todas las comas por puntos y `Number("1.000")` daba `1`; “1,000” se registraba como $1.00. Era un riesgo de captura preexistente (la Caja legacy tenía el mismo problema en `caja-app.tsx:211-215`).

**Estado actual (snapshot 09:17).** El parser ya distingue miles y decimales (`types.ts:17-48`): “1,000” y “1.000” → 100000 centavos; “1,000.50” y “1.000,50” → 100050; “35.5” → 3550. **F-10 queda cerrado por lectura.** T10 sigue siendo obligatorio para que no se regrese.

---

---

### Riesgos heredados que B no corrige

| ID | Severidad | Riesgo | Evidencia | Efecto en B |
|---|---|---|---|---|
| R-01 | P1 | `/api/demo/pay` no es idempotente por pedido; dos llamadas crean dos `transactionId` y dos pagos | `api/demo/pay/route.ts:54-85`; `payment-panel.tsx:24, 106-126` | El lock de `PaymentPanel` es por pestaña/componente; dos pestañas o un remount pueden doble-pagar un pedido demo. Prueba T8d. |
| R-08 | P1 | `/api/demo/pay` no exige que la orden sea demo; en una base reutilizada puede marcar una orden real como `demo_paid` | `api/demo/pay/route.ts:49-54`; `db.ts:1489-1499`; `payment-panel.tsx:217-232`; `caja-screen.tsx:560` | La Caja nueva muestra “Simular” según el modo global, no según `order.demo` (no expuesto). Una orden real pendiente puede desaparecer de la lista real y dejar su crédito abierto. Prueba T8e. |

Estos no son regresiones de B, pero impiden declarar “demo/real no se mezclan” solo porque la Caja nueva compile.

---

## 5 · Riesgos de doble registro, dos borradores, dos llaves y pendientes

### 5.1 Doble registro

| Camino | ¿Duplica? | Condición | Evidencia |
|---|---:|---|---|
| Doble clic en “Confirmar” | **No** | `saleLockRef` síncrono | `caja-screen.tsx:254-261, 348-349` |
| Reintento con misma firma y storage sano | **No** | misma `requestId` | `caja-screen.tsx:274-284`; `orders.ts:211-232` |
| Reintento sin storage, misma pantalla | **No** | `requestRef` conserva la llave | `caja-screen.tsx:75, 274-284` |
| Reintento sin storage tras recarga/remount | **Sí** | el `useRef` se pierde y no hay llave persistida | `F-01`; `caja-screen.tsx:75, 274-284` |
| Edición de líneas durante POST + respuesta perdida | **Sí** | firma cambia | `F-01`; `sale-line-items.tsx:94-128` |
| Dos pestañas de `/caja` | **Sí** | cada una genera su llave; `DRAFT_KEY` compartida last-write-wins | `F-05` |
| `/` legacy + `/caja` | **Sí** | llaves v1 vs v2 independientes | `F-05` |
| Mismo `requestId` con otro payload | **No** (409) | servidor rechaza | `orders.ts:84-89` |
| `requestId` demo reutilizado en real | **No** (409) | servidor rechaza cross-mode | `orders.ts:66-91` |

### 5.2 Dos borradores

- Nuevo: `mercado-cero:caja-draft:v2` (`caja-screen.tsx:32`).
- Legacy: `mercado-cero:draft:v1` (`caja-app.tsx:105`).
- No hay lectura/migración v1→v2. El borrador de una pantalla no se ve en la otra. La UI nueva **ya lo declara**: “los borradores de cada pantalla son independientes” (`caja-screen.tsx:596-598`), así que no hay una promesa de continuidad; el doble registro entre pantallas sigue siendo posible.

### 5.3 Dos llaves

- Nuevo `REQUEST_KEY` v2 (`caja-screen.tsx:33`) vs `SALE_REQUEST_STORAGE_KEY` v1 (`caja-app.tsx:111`).
- La idempotencia del servidor es por `requestId`; si cada pantalla/pestaña usa una llave distinta, el servidor no puede saber que es “la misma venta”.
- No hay `BroadcastChannel` ni lock de storage.

### 5.4 Pedidos pendientes huérfanos

- **No hay huérfanos contables**: un pedido digital pendiente sigue en `orders` con `status='confirmed'` y `due>0`, y `listPendingOrders` lo devuelve (`db.ts:1441-1456`).
- **Sí hay huérfanos de reanudación**: `PENDING_KEY` es una sola ranura (`F-04`); al crear otro pendiente, la Caja nueva pisa el puntero anterior. `clearDraft` ya no borra la llave. El operador puede volver a vender lo mismo.
- Si el pedido se paga por fuera, la próxima visita a `/caja` lo detecta (`caja-screen.tsx:114-149`); si el `orderId` da 404, borra la llave. Ese camino está bien.

---

## 6 · Pruebas que deben pasar

> **Estado de esta sección: NOT RUN.** Son las pruebas mínimas para convertir el análisis en evidencia. No se ejecutó ninguna.

### 6.1 Setup

1. Servidor y `DATABASE_PATH` aislados (temp), build del commit que se va a entregar. Para dinero real, `DEMO_MODE=false`; para demo, una corrida separada.
2. Snapshot SQL antes/después de cada caso:
   ```sql
   SELECT id,status,total_cents,paid_cents,credit_cents,payment_method,updated_at FROM orders;
   SELECT id,order_id,provider,method,amount_cents,status,demo FROM payments;
   SELECT id,order_id,original_cents,balance_cents,status FROM credits;
   SELECT id,credit_id,amount_cents,method,provider FROM credit_payments;
   SELECT * FROM cash_closes ORDER BY date,version;
   ```
3. Capturar el **payload de red** de `POST /api/orders` y la respuesta.
4. Para `/ventas` read-only, hacer un “warm-up” de `getDb()` antes del snapshot (el primer arranque en demo puede migrar/sembrar; después la visita no debe cambiar nada).

### 6.2 Matriz T1–T11

| ID | Caso | Aserciones mínimas |
|---|---|---|
| **T1** | Fiado total por `/caja` | Payload `cashCents=0`, `creditCents=10000`, `customerName="Cliente B"`, `requestId` presente. Orden `confirmed`, `paidCents=0`, `creditCents=10000`, `creditId` ≠ null. DB: 0 filas `payments` para la orden; 1 `credits` (`original=10000`, `balance=10000`, `status='open'`). `/api/cash`: `cashSalesCents` Δ0, `cashCreditCents` Δ0. `/api/dashboard`: `salesCents` +10000, `cashCents` Δ0, `pendingCents` Δ0, `creditCents` +10000. `/ventas`: fila “Fiado”, “Fiado, no cobrado”, “Saldo vivo $100.00”; no “Pagado”. |
| **T2** | Mixto efectivo+fiado con cambio | Total 90, recibido 100, fiado 30. UI “Cambio $40.00”. Payload `cashCents=6000`, `creditCents=3000` (**no** 10000). Orden `paidCents=6000`, `creditCents=3000`, `confirmed`. DB: 1 `payments` cash 6000; 1 `credits` 3000 open; **ningún** pago/gasto/retiro por 4000. `/api/cash`: `cashSalesCents` +6000, `cashCreditCents` Δ0. `/ventas`: “Cobrado $60.00”, “Saldo vivo $30.00”. |
| **T3** | Abono en efectivo al fiado | POST `/api/credits/{id}/pay` 4000 cash. Respuesta `appliedCents=4000`, `balanceCents=6000`, `duplicate=false`. DB: `credits.balance=6000`, `status='partial'`; 1 `credit_payments` cash 4000. `orders.paidCents` y `orders.creditCents` **sin cambio**. `/api/cash`: `cashCreditCents` +4000, `cashSalesCents` Δ0. `/api/dashboard`: `cashCents` +4000, `creditCents` −4000. `/ventas`: “Saldo vivo $60.00”, no “$100.00”. Repetir misma `requestId`: `duplicate=true`, sin nueva fila, saldo igual. |
| **T4** | Abono digital declarado | POST abono 1000 `method="codi"`. DB: `credit_payments` provider `declared`, method `codi`; `credits.balance` baja. `/api/cash`: `cashCreditCents` Δ0 (no es efectivo). `/api/dashboard`: `declaredDigitalCents` +1000, `cashCents` Δ0, `verifiedDigitalCents` Δ0. `/ventas`: saldo vivo baja; “Cobrado confirmado” no suma este abono (por diseño: solo efectivo + pey). |
| **T5** | `/ventas` es lectura y saldo vivo | Snapshot de counts/sums/`updated_at` de `orders`, `payments`, `credits`, `credit_payments`, `cash_closes`, `audit_log`. GET `/ventas`, `/ventas?page=2`, `/ventas?page=999` (se clampa). Todo idéntico; 0 POST/PATCH en el log de red. Fiado 100 + abono 40: la fila muestra “Saldo vivo $60.00”, no $100.00; abono total: “Fiado saldado”/“Saldo vivo $0.00”, nunca “Saldo vivo $100.00” **ni “Fiado, no cobrado”**. |
| **T6** | Idempotencia y doble registro | (a) doble clic → 1 orden, 1 cash, 1 crédito. (b) respuesta perdida tras commit → reintento misma firma → mismo `order.id`, 1 orden. (c) mismo `requestId` otro payload → 409, sin segunda orden. (d) `localStorage` bloqueado + respuesta perdida + reintento **en la misma pantalla** → 1 orden (`requestRef`); tras **recarga/remount** → se espera FAIL (el `useRef` se pierde) hasta persistir la llave de otra forma. (e) dos pestañas → 1 orden si hay lock; hoy se espera 2; documentar/fix. |
| **T7** | Pendiente y reanudación | Crear digital 5000: `PENDING_KEY={orderId}`; reload `/caja` → panel “Pedido XXXX”, sin segunda orden. Crear segundo digital: la primera orden sigue en `/pendientes`; la UI solo reanuda la segunda (documentar `F-04`). “Limpiar venta”: la orden sigue en DB/`/pendientes`; `PENDING_KEY` **ya no se borra**; al recargar debe reanudar el pendiente. `PENDING_KEY` con id 404 → se borra. |
| **T8** | Digital y demo | Digital 5000: 0 `payments`, `/api/cash` Δ0, `summary.pendingCents` +5000. Generar link → `payment_pending`, 0 pagos, cash Δ0. Demo pay tarjeta → 1 `payments` provider demo, method card, 5000; `demo_paid`; `demoDigitalCents` +5000; `cashCents`/`cashSales` Δ0; `/ventas` “Demo”. Doble demo pay concurrente: **hoy se espera FAIL** (R-01); debe quedar 1 pago. |
| **T9** | Mixto con digital pendiente | Total 100, cash 20, fiado 50, digital 30. Payload 2000/5000; orden `paid=2000`, `credit=5000`, `due=3000`. `/api/cash`: cashSales +2000, cashCredit 0. `summary`: cash +2000, credit +5000, pending +3000. `/ventas` antes de pagar: “Cobrado $20”, “Falta cobrar $30”, “Saldo vivo $50”. Pagar digital 3000: `paid=5000`, `credit=5000`, status cubierto; la fila deja de mostrar “Falta cobrar”, mantiene “Cobrado $50” y “Saldo vivo $50”; no doble conteo. |
| **T10** | Captura de dinero | `"1,000"`, `"1.000"`, `"1,000.50"` no deben producir $1.00/$1.50 silenciosos. Si se aceptan como miles, el total debe ser 100000/100050; si no, deben rechazarse con error visible. |
| **T11** | Corte y fingerprint | Preview → crear una venta → cerrar con el fingerprint viejo: **409 `totals_changed`**, sin fila nueva. Preview nuevo → close: `cashSalesCents`/`cashCreditCents` iguales a `/api/cash` al cerrar; `snapshot_cash = cashSales + cashCredit`; `snapshot_credit = summary.creditCents`; `snapshot_pending_digital = summary.pendingCents`; `expected = opening + cashSales + cashCredit - expenses - withdrawals`. Repetir GET `/api/cash` no duplica. |

### 6.3 Criterio de aprobación de las pruebas

- T1–T4, T9–T11: **0 FAIL**.
- T5 tiene dos partes: lectura (debe pasar) y abono saldado (hoy se espera **FAIL** en “no Fiado, no cobrado” hasta F-06).
- T6a–T6d (misma pantalla): **0 FAIL**; T6d tras recarga y T6e (dos pestañas) se reportan **KNOWN** hasta persistir la llave/lock.
- T7 de un solo pendiente: **0 FAIL**; la cola de dos pendientes se reporta **KNOWN** (`F-04`).
- T8 pago demo simple: **0 FAIL**; el doble demo concurrente es **KNOWN** hasta R-01.
- Cualquier caso no ejecutado se reporta **NOT RUN**, nunca PASS.

---

## 7 · Lo que NO se puede declarar sin ejecutar

1. **“La nueva venta no rompe fiado.”** No hay una corrida de T1/T3 contra `/caja`; el smoke no consulta `credits` ni `credit_payments`.
2. **“El corte está correcto.”** No hay T4/T11 contra `/caja`; `p0-corte-e2e.py` navega a `/` (legacy) y usa selectores legacy (`p0-corte-e2e.py:582, 589, 628`). No prueba la pantalla nueva.
3. **“`/ventas` es solo lectura.”** Por código no hay mutaciones, pero no hay snapshot de tablas antes/después (T5). Además, el primer `getDb()` en demo puede migrar/sembrar (`db.ts:76-103, 1039-1041, 1115-1121`); hay que calentar la base antes de medir.
4. **“No hay doble registro.”** T6a–T6c no cubren edición durante el POST (F-01), reintento sin storage tras recarga (el `useRef` se pierde), dos pestañas ni dos Cajas (F-05).
5. **“El cambio coincide con el servidor.”** El servidor no tiene campo de cambio; lo único verificable es que `payments.amount_cents`/`orders.paid_cents` igualen el efectivo aplicado y que la UI muestre `recibido − aplicado`. No se puede decir “el servidor guarda/confirma el cambio”.
6. **“El fiado muestra saldo vivo.”** El camino normal sí; F-02 (replay) y F-03 (fallback) quedaron cerrados. F-06 sigue mostrando “Fiado, no cobrado” en un fiado saldado. Sin T3/T5 no se puede afirmar que siempre.
7. **“Los abonos se reflejan.”** F-06: la fila de `/ventas` no muestra abonos y un fiado saldado puede seguir “Fiado, no cobrado”. Sin T3/T5 no se puede afirmar.
8. **“Demo y real no se mezclan.”** R-01/R-08 siguen abiertos; la Caja nueva no valida `order.demo` antes de ofrecer “Simular”.
9. **“B está listo / GO.”** El árbol está sucio; `verify:evidence` exige `gitAtStart.dirty:false` y `gitAtStart.sha` igual al commit entregado (`AGENTS.md`, `HARNESS.md`). Ningún `latest.json` actual sirve.

---

## 8 · Evidencia existente y por qué no alcanza

| Artefacto | Qué dice | Por qué no prueba B |
|---|---|---|
| `quality-reports/oleada-b/oleada-b-smoke.json` | 33 PASS declarados | Generado a las **08:55**; `caja-screen.tsx`/`sale-result.tsx` (09:26), `ventas/page.tsx` (09:23), `payment-panel.tsx` (09:20), `sale-summary.tsx` (09:19), `sale-line-items.tsx`/`types.ts` (09:17) son posteriores. Es un snapshot anterior. Además, el script **no** consulta `/api/cash`, `payments`, `credit_payments`, `credits.balance_cents` ni `cashSalesCents`/`cashCreditCents`. Sus casos M/M2 solo leen la respuesta de `/api/orders` (`oleada-b-smoke.py:200-231`). No prueba corte, abonos ni lectura de `/ventas`. |
| `harness/evidence/p0-venta-e2e.json` (66/0), `p0-fiado-e2e.json` (51/0), `p0-corte-e2e.json` (69/0), `p0-dinero-e2e.json` (45/0 + 3 KNOWN) | Baseline del motor y de la UI legacy | Son de `26c7741`/`9206ea1`, con la Caja legacy en `/`. `p0-venta-e2e.py:113` hace `page.goto(BASE)` = `/`, no `/caja`; los selectores son legacy. No cubren el WIP nuevo. |
| `harness/evidence/latest-static.json` | `ok:true` static de `26c7741` | No es runtime/UI ni cubre el WIP. |
| `harness/evidence/latest.json` | `ok:true` de `9206ea1` | SHA distinto y UI legacy; no sirve. |

**Conclusión de evidencia:** hoy no existe una corrida que demuestre T1/T3/T4/T6/T11 sobre `/caja`. El smoke es útil para el layout y el camino feliz de la venta, pero no para fiado/corte/abonos.

---

## 9 · Veredicto para B

### 9.1 Veredicto de dominio

**B es compatible con el motor de fiado, abonos y corte en el camino feliz, por lectura.** No hay un P0 de fórmula: el fiado crea crédito y no efectivo, el efectivo se inserta una vez, el corte separa `cashSales`/`cashCredit`/`snapshot_credit`/`snapshot_pending_digital`, y el abono solo toca `credits` y `credit_payments`.

### 9.2 Veredicto de aceptación

**NO-GO.** Bloqueos:

1. **F-01 residual (P1)** — doble venta posible si se editan líneas durante un POST lento y la respuesta se pierde después del commit. La pérdida de llave sin `localStorage` ya está corregida con `requestRef`; falta deshabilitar los inputs.
2. **F-06 (P2)** — `/ventas` no refleja abonos de fiado: un fiado saldado sigue “Fiado, no cobrado”. Obligatorio para aceptar el historial como lectura de fiado.
3. **F-07 (P3)** — no hay tarjeta agregada de fiado vivo; la tarjeta digital ya aclara que no incluye fiado. No bloquea.
4. **F-04/F-05 (P2)** — pendiente en una sola ranura; dos Cajas/llaves ya documentadas pero sin lock. Decidir; si se acepta el riesgo, no prometer “sin duplicados” entre pantallas.
5. **F-02/F-03/F-08/F-10 (cerrados por lectura)** — replay con saldo vivo, original etiquetado, pendiente digital por fila y parser de miles; T2/T3/T5/T9/T10 siguen siendo obligatorios.
6. **Evidencia** — árbol sucio, smoke stale, cero T1–T11 ejecutadas.

### 9.3 Condiciones para GO

- Deshabilitar los inputs de línea durante `saving` (F-01 residual); el respaldo `requestRef` ya está.
- Corregir `F-06` (mostrar abonado/saldado en la fila) y, opcionalmente, `F-07` (tarjeta de fiado vivo).
- Decidir `F-04` (cola de pendientes) y `F-05` (lock cross-tab o aceptar formalmente la independencia ya documentada).
- Ejecutar T1–T11 sobre un commit limpio y generar `latest.json`/`verify:evidence` con el SHA correcto.
- No declarar “fiado/corte sin regresiones” hasta que T1–T4, T7 (un pendiente), T8 (pago demo simple), T9–T11 y la parte de lectura de T5 estén verdes; F-04 (cola de pendientes), F-06 (abono saldado), T6 (recarga/dos pestañas) y el doble demo de T8 quedan **KNOWN** hasta corregirse.

---

## 10 · Anexo: referencias rápidas

| Tema | Archivo:línea |
|---|---|
| Payload de venta nueva | `web/src/components/caja/caja-screen.tsx:264-272` |
| Cálculo aplicado/cambio | `web/src/components/caja/caja-screen.tsx:77-90` |
| Llave de idempotencia | `web/src/components/caja/caja-screen.tsx:274-284, 631-641` |
| Respaldo legacy de llave | `web/src/components/caja-app.tsx:755, 1925-1933` |
| Resultado y saldo fiado | `web/src/components/caja/sale-result.tsx:24, 32-63, 78-135` |
| Inputs editables durante save | `web/src/components/caja/sale-line-items.tsx:94-128` |
| Pendiente único | `web/src/components/caja/caja-screen.tsx:34, 114-149, 166-186, 325-327` |
| Polling / demo pay | `web/src/components/caja/payment-panel.tsx:24, 31, 34-60, 106-126, 217-232` |
| Claves v1 legacy | `web/src/components/caja-app.tsx:105-112` |
| `/ventas` stats | `web/src/app/ventas/page.tsx:85-103` |
| `/ventas` saldo vivo/fallback | `web/src/app/ventas/page.tsx:130-132, 161-198, 249-268` |
| `/ventas` método | `web/src/app/ventas/page.tsx:270-288` |
| Cortes | `web/src/lib/cash.ts:226-243, 257-258, 451-453` |
| Creación de orden/cash/credit | `web/src/lib/orders.ts:172-185, 234-255, 284-326, 328-335` |
| Idempotencia server | `web/src/lib/orders.ts:56-91, 196-232`; `web/src/lib/db.ts:350` |
| Abono | `web/src/lib/orders.ts:791-964, 928-930`; `web/src/app/api/credits/[id]/pay/route.ts:19-42` |
| Resumen diario | `web/src/lib/db.ts:1774-1912` |
| Pendientes | `web/src/lib/db.ts:1441-1456, 1475-1487` |
| `getCredit` | `web/src/lib/db.ts:1737-1763` |
| Esquema de orden/pagos | `web/src/lib/db.ts:108-154` |
| Demo pay sin idempotencia | `web/src/app/api/demo/pay/route.ts:49-85` |
| `paymentMethod` ignorado | `web/src/app/api/orders/route.ts:46`; `web/src/lib/orders.ts:99-362` |
| Parser de dinero | `web/src/components/caja/types.ts:17-48` |
| Rutas/nav | `web/src/components/shell/nav.ts:27-44`; `web/src/app/page.tsx:13-33` |
| Headers privados | `web/next.config.ts:194-195` |

---

*Fin del informe. No se modificó código, no se hizo commit y no se ejecutaron pruebas. Cualquier afirmación de PASS/GO requiere la matriz de §6 sobre un commit limpio y evidencia con SHA.*
