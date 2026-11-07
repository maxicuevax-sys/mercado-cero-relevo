# P0-C.1 · Cerrar KNOWN de fiado y voz

> Worktree: `mercado-cero-knowns` · rama `p0/knowns` · base `be26105`.
> Entra después de P0-F y antes de P0-E/P0-G, porque toca `caja-app.tsx`, `voice.ts` y `PaymentPanel`.
> Alcance: los KNOWN de P0-C que no son el slot/polling de P0-E.

## 0 · Estado del carril (`p0/knowns`, 2026-11-01)

| Bloque | Estado |
| --- | --- |
| #2 Consulta de voz con varias deudas | **Hecho (puro).** `answerDebtQuery` en `voice-debts.ts`, re-exportada por `voice.ts`; falta conectarla en `answerLocal`. |
| #3 “Me transfirió” → Digital | **Hecho (parser + schema).** Falta que `openCreditPay` use `parsed.creditMethod` y exija elección si es `null`. |
| #1 Venta mixta con fiado | **Pendiente.** Toca `PaymentPanel`/`caja-app.tsx`; no se hizo en este carril para no chocar con P0-F. |
| #4 Slot único y polling | **Fuera de alcance** (P0-E). |
| Pruebas | `web/scripts/voice-debts-test.mjs`: 16/16. `npm run lint`, `npx tsc --noEmit`, `npm run build`: verdes. E2E Playwright pendiente. |

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

**Estado en este carril:** implementado como función pura en
`web/src/lib/voice-debts.ts` y re-exportada desde `web/src/lib/voice.ts`
(sin OpenAI para que `caja-app.tsx` pueda importarla sin cargar el SDK en el
cliente):

```ts
answerDebtQuery(transcript, credits): DebtQueryAnswer | null
```

- `null` si la frase no es consulta de deuda.
- `kind: "customer"` con `customerName`, `totalCents`, `debtCount` y `answer`.
- `kind: "general"` con `totalCents`, `debtCount`, `customerCount` y `answer`.
- `kind: "ambiguous"` con `candidates` y un `answer` que pide elegir (no elige).
- `kind: "not_found"` / `"needs_name"` para los casos sin deuda o sin nombre.

Agrupa por `customerId` (dos fiados del mismo cliente suman). Si el nombre
coincide exactamente con varios clientes distintos, o solo coincide por prefijo
con varios, responde ambigua. No hace fetch, no muta los créditos y no escribe
el ledger.

**Falta para integrar:** en `answerLocal` de `caja-app.tsx`, importar
`answerDebtQuery` desde `@/lib/voice-debts` (no desde `@/lib/voice`, para no
meter OpenAI al bundle del cliente), llamarla primero y devolver
`result.answer` cuando no sea `null`; después conservar el resto del flujo
actual. No tocar el abono.

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

**Estado en este carril:** parser y schema listos:

- El parser local vive en `web/src/lib/voice-local.ts` (sin OpenAI) y
  `voice.ts` lo re-exporta; así las pruebas Node no cargan el SDK.
- `ParsedSale.creditMethod: "cash" | "codi" | "card" | null` y
  `creditMethod` en `saleSchema` (OpenAI).
- `detectCreditMethod`: `efectivo/billetes` → `cash`;
  `transferencia/transfirió/CoDi/depósito/digital` → `codi`;
  `tarjeta/débito/crédito` → `card`; sin señal → `null`.
- `mockParse` ahora reconoce `me transfirió/depositó` sin exigir la palabra
  “fiado” (`Juan me transfirió 50` → `credit_payment`, `codi`) y
  `Juan me pagó 50 [en efectivo]` → `credit_payment` con método `cash`/`null`.
  Una venta como `dos quesadillas, me pagó con 100` sigue siendo `sale`.
- Se corrigió la captura de nombre para que “tarjeta del fiado” no devuelva
  `customerName = "Del"` (regex anclada a inicio de palabra).

**Falta para integrar:** `openCreditPay` sigue fijando `"cash"`. Debe aceptar
un método inicial (`parsed.creditMethod`), dejar el método **sin seleccionar**
cuando sea `null` y deshabilitar “Registrar abono” hasta elegir. `card` se
parsea, pero la hoja actual solo ofrece Efectivo/Digital: decidir si se añade
tarjeta o se muestra como no disponible (ver KNOWN #3).

## 4 · Slot único de pendiente y polling

**No se implementa aquí.** Pertenece a **P0-E**:
- lista de `pendingOrders` (no un solo slot);
- polling visible y refresh al volver a la pestaña;
- fechas y “última comprobación”.
P0-C.1 solo debe asegurar que sus cambios no rompan el slot actual.

## 5 · Pruebas

**Prueba pura de este carril (ya existe y pasa):**

```bash
cd web
npm run test:voice
```

`web/scripts/voice-debts-test.mjs` (Node `node:test`, 16 casos):
- dos deudas abiertas de Juan → `$130.00 en 2 fiados`; una liquidada no suma;
- una deuda → `$25.00 en 1 fiado`;
- sin deuda (saldo 0 o liquidada) → “No encontré deudas abiertas de …”;
- consulta general → total `$155.00`, 3 fiados, 2 clientes; sin deudas → “No hay deudas abiertas.”;
- `José` vs `Jose` → ambiguo, pide elegir y no muestra un total inventado;
- dos fiados del mismo `customerId` → no ambiguo (y completa el nombre si un fiado no lo trae);
- “cuánto me debe” sin nombre → pide el nombre;
- no muta créditos y no llama `fetch`;
- `me transfirió 50 del fiado` → `credit_payment` + `codi`;
- `Juan me transfirió 50` → `credit_payment` + `codi` sin decir “fiado”;
- `CoDi`/`depósito` → `codi`; `tarjeta` → `card`; `en efectivo` → `cash`; sin señal → `null`;
- venta normal y “dos quesadillas, me pagó con 100” siguen siendo `sale`.

**E2E pendiente** (`web/scripts/p0-knowns-e2e.py`, Playwright, `:3101`, DB temporal):

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

## 8 · KNOWN de este carril

1. **`answerDebtQuery` todavía no está conectada.** `answerLocal` en
   `caja-app.tsx` sigue devolviendo el primer crédito. La integración es
   `import { answerDebtQuery } from "@/lib/voice-debts"` y, al inicio de
   `answerLocal`, `const debt = answerDebtQuery(text, dashboard.credits); if (debt) return debt.answer;`.
   Se importa del módulo puro, no de `voice.ts`, porque `voice.ts` importa el
   SDK de OpenAI y `caja-app.tsx` es un componente cliente.
2. **`creditMethod` se parsea, pero la hoja aún abre en efectivo.**
   `openCreditPay` fija `setCreditPayMethod("cash")`. La integración debe
   recibir el método, no preseleccionar si es `null`, y deshabilitar
   “Registrar abono” hasta que la persona elija.
3. **`card` se parsea pero la hoja no lo ofrece.** `PaymentMethod` y
   `POST /api/credits/:id/pay` ya aceptan `card`, y el corte solo suma
   `method = 'cash'` (no inflaría efectivo). Pero `CreditPaySheet` solo muestra
   Efectivo/Digital (`cash|codi`). Integración debe decidir si añade la opción
   Tarjeta o si `card` se presenta como método no disponible; no lo mandes a un
   estado que la hoja no pueda representar.
4. **La ambigüedad es por nombre, no difusa.** Se prefiere coincidencia exacta
   normalizada (sin acentos/mayúsculas); si no hay exacta, se admiten prefijos
   (`Juan` ↔ `Juan Pérez`). Varias coincidencias → pregunta. No hay fuzzy
   matching ni Levenshtein.
5. **Heurística del parser local.** `startsWithCustomerName` evita que una
   venta (“dos quesadillas, me pagó 100”) se vuelva abono, pero un nombre que
   empiece con artículo/número (“La Señora me pagó 50” sin “fiado”) puede caer
   en `unknown`. El parser de OpenAI no tiene esa limitación. Las pruebas de la
   demo usan “Juan me pagó 50 …”.
6. **La prueba pura importa `voice-local.ts` y `voice-debts.ts` directo con
   type stripping de Node** (Node ≥ 22.18/23.6, verificado en v25.7), sin SDK
   de OpenAI. No usa `tsx` ni compila a `dist`. Si el CI corre Node viejo,
   `npm run test:voice` fallará por sintaxis TS; en ese caso hay que mover el
   test a un runner con soporte TS.
7. **Sin cambios de contrato.** No se tocaron webhook, `paymentTruth`, ledger,
   `caja-app.tsx` ni `PaymentPanel`. `answerDebtQuery` es pura: no hace POST,
   no escribe DB y no muta la lista de créditos.
