# P0-C.1 · Cerrar KNOWN de fiado y voz

> Worktree: `mercado-cero-knowns` · rama `p0/knowns` · base `be26105`.
> Entra después de P0-F y antes de P0-E/P0-G, porque toca `caja-app.tsx`, `voice.ts` y `PaymentPanel`.
> Alcance: los KNOWN de P0-C que no son el slot/polling de P0-E.

## 1 · Venta mixta con fiado + saldo digital

**Problema:** una venta de $90 con $30 efectivo + $20 fiado + $40 digitales queda `confirmed` correctamente, pero `PaymentPanel` entra en `if (isPaid || isCredit)` y muestra “Quedó anotado” por el total; no muestra el saldo digital ni ofrece link/QR para cobrarlo.

**Cambio:**
- `PaymentPanel` debe distinguir:
  - `dueDigital = total - paid - credit` (el remanente).
  - Si `isCredit && dueDigital > 0`: mostrar resumen “Fiado $20 · Cobrado $30 · Falta cobrar $40” y las acciones **Link de pago / QR CoDi** para el remanente.
  - No mostrar el total como si estuviera completamente cubierto.
  - Después de generar link/QR, mantener visible el bloque de fiado y el estado “Esperando banco” del remanente.
  - Los botones de demo “Simular CoDi” deben seguir visibles y simular solo el saldo digital, no el fiado.
- `paymentTruth` y el ledger no cambian; el estado `confirmed` se conserva hasta que el digital se cubra o se entregue.
- `PaidSheet`/resultado final: si el pago digital cubre el remanente y hay fiado, el resultado debe decir “Pago mixto” con “$30 efectivo + $20 fiado + $40 verificado/demo”, no “Quedó anotado” por el total.
- No tocar webhook/pey.

**Aceptación:**
- Venta $90 = $30 efectivo + $20 fiado + $40 digital: el panel muestra los $40 y permite generar link/QR.
- Pagar los $40 (demo o pey) deja la orden `fulfilled`/`paid` según corresponda, con el fiado original intacto.
- No se puede “entregar” antes de que el saldo digital esté resuelto o la persona decida explícitamente entregar a fiado.
- El fiado no se cuenta como digital.

## 2 · Consulta de voz con varias deudas

**Problema:** `answerLocal` busca `credits.find(...)` y devuelve el primer crédito de Juan; con dos deudas responde una, no la suma.

**Cambio:**
- Para “¿cuánto me debe Juan?”:
  - filtrar todos los créditos abiertos del cliente (por nombre normalizado);
  - sumar `balanceCents`;
  - responder: “Juan te debe $130.00 en 2 fiados.” Si hay uno: “Juan te debe $50.00.”
  - si no hay coincidencia: “No encontré deudas abiertas de Juan.”
- Si el nombre coincide con varios clientes (José/Jose), no adivinar: “Tengo dos clientes con ese nombre; dime cuál.”
- Si la consulta es general (“¿cuánto me deben?”), sumar todos y decir el total + número de clientes/deudas.
- No cambiar el flujo de abono (P0-C) ni la búsqueda de `credit_payment`.

**Aceptación:**
- Dos deudas de Juan ($50 + $80) → “$130.00 en 2 fiados”.
- Una deuda → monto correcto.
- Sin deuda → mensaje claro.
- No se ejecuta ningún POST por una consulta.

## 3 · “Me transfirió” debe preseleccionar Digital

**Problema:** todo abono por voz abre `CreditPaySheet` con `cash` por defecto. “Juan me transfirió 50” queda como efectivo y el corte espera dinero que no está en la caja.

**Cambio:**
- Extender el parser (`voice.ts`/`ParsedSale`) con `creditMethod?: "cash" | "codi" | "card"` (o `paymentMethod` para abono).
- Reglas locales:
  - “efectivo”, “en efectivo”, “billetes” → `cash`.
  - “transferencia”, “transfirió”, “me transfirió”, “CoDi”, “depósito”, “digital” → `codi`.
  - “tarjeta”, “débito”, “crédito” → `card`.
  - Si no hay señal → `undefined`, no asumir; la hoja exige elección o deja el método sin seleccionar.
- OpenAI prompt/schema: pedir el método si está explícito; no inventarlo.
- `caja-app.tsx` usa `parsed.creditMethod` al abrir la hoja; si es `undefined`, no preselecciona y el botón “Registrar abono” queda deshabilitado hasta elegir.
- La hoja muestra el método con check/ELEGIDO; P0-C ya lo hace.
- No tocar el contrato de pago ni el ledger.

**Aceptación:**
- “Juan me transfirió 50” abre la hoja con **Digital** seleccionado.
- “Juan me pagó 50 en efectivo” abre **Efectivo**.
- “Juan me pagó 50” sin método no preselecciona y exige elección.
- El `POST` lleva el método elegido; el corte separa efectivo/digital.

## 4 · Slot único de pendiente y polling

**No se implementa aquí.** Pertenece a **P0-E**:
- lista de `pendingOrders` (no un solo slot);
- polling visible y refresh al volver a la pestaña;
- fechas y “última comprobación”.
P0-C.1 solo debe asegurar que sus cambios no rompan el slot actual.

## 5 · Pruebas

`web/scripts/p0-knowns-e2e.py` (Playwright, `:3101`, DB temporal):

1. Venta mixta $30 efectivo + $20 fiado + $40 digital: panel muestra $40 y link/QR.
2. Generar link y pagar demo $40: orden final mixta correcta, fiado original intacto.
3. Dos deudas de Juan: consulta de voz devuelve suma $130 y “2 fiados”.
4. Una deuda/sin deuda: mensajes correctos.
5. “Me transfirió” → Digital seleccionado; “en efectivo” → Efectivo; sin método → sin selección.
6. Confirmar el abono con método digital: `credit_payments.method = codi` y el corte no lo suma como efectivo.
7. Regresión P0-A/B/C: 43/1 y 50/0.
8. 360 px sin overflow; 200 % legible (cuando P0-F esté mergeado).

## 6 · Criterios de aceptación

- La venta mixta se puede terminar de cobrar desde la UI, no solo por API.
- La voz suma deudas, no devuelve la primera.
- La voz no fuerza efectivo cuando la persona dijo transferencia.
- El ledger y el corte reflejan el método elegido.
- Sin regresiones en webhook, `paymentTruth`, P0-A/B/C.
- Revisión independiente y gate antes de merge.

## 7 · Orden

1. P0-F (shell) libera `caja-app.tsx`.
2. P0-C.1 en `p0/knowns`.
3. P0-E en `p0/pendientes` (incluye #4).
4. P0-G en `p0/pendientes-negocio`.
