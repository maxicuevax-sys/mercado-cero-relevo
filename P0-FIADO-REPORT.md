# P0 · Fiado confirmado, saldo vivo e idempotencia durable — reporte de carril

> **Rama:** `p0/fiado` · **Worktree:** `mercado-cero-fiado` · **Base:** `6e0e7e5` (incluye P0-A/B).
> **Fecha:** 2 de noviembre de 2026.
> **Alcance:** P0-C del goal de carga cognitiva: la voz deja de escribir sola, la hoja de abono muestra saldo vivo/aplicado/devuelto, el abono tiene idempotencia durable y atomicidad, y detalle/actividad leen el crédito vivo en lugar de `orders.creditCents`.
> **Fuera de alcance y no tocado:** webhook pey, `/api/verify`, `paymentTruth`, la lógica de verdad de `PaidSheet`, identidad “Mostrador claro”, `orders.creditCents`, el servidor `:3000` y el repo principal.
> **Cambio de esquema acotado:** `credit_payments.request_id TEXT` nullable + índice único parcial. Es la migración que pide este corte; no se tocó ninguna otra tabla.

---

## 1 · Resultado

“Juan me pagó $50” ya **no registra un abono**. La frase abre `CreditPaySheet` con el cliente, el saldo vivo y el monto interpretado; el `POST /api/credits/:id/pay` solo ocurre al pulsar **Registrar abono**. La hoja distingue lo que se aplica de lo que se devuelve, exige un método visible con check/estado y conserva la confirmación de descarte.

El abono ahora tiene **idempotencia durable** (`requestId` en SQLite + índice único parcial), **transacción `BEGIN IMMEDIATE`** para leer saldo, insertar y descontar, y respuestas explícitas `409` para crédito saldado o saldo incompatible. El cliente genera una llave estable por intento de hoja y usa `appliedCents`/`overpayCents` de la respuesta.

El detalle del pedido (`PaymentPanel`) y Actividad muestran el saldo vivo y llaman “original” al monto de `orders.creditCents`; al liquidar, ambos dicen **Saldado** y conservan el original.

**Commits de esta corrección:**
- `0eddea2` — producto y E2E (`feat(fiado): idempotencia durable y borrador honesto`).
- `7ea5f67` — evidencia de regresión P0-A/B.
- `62ca6f2` — evidencia E2E P0-C + captura 360.
- `5a857f8` — evidencia de gate estático.

**Sin merge.** La rama queda solo en el worktree.

---

## 2 · Cambios

### 2.1 · La voz propone; no escribe

`interpretText` ya no hace `POST` en la rama `credit_payment`. Ahora:

1. Exige `creditCents > 0`.
2. Busca candidatos entre `dashboard.credits` abiertos (`status !== "settled"` y `balanceCents > 0`).
3. Si el parser devolvió `customerName`, compara por nombre normalizado (sin acentos, minúsculas y espacios colapsados). No usa `substring` sobre la transcripción cuando el parser ya dio nombre.
4. Si el parser no devolvió nombre, solo acepta una mención completa del nombre del cliente en la frase (límite de palabra), no una subcadena.
5. Si hay **cero** candidatos, muestra error y no ejecuta.
6. Si hay **más de uno** (p. ej. dos deudas de Juan), no elige al azar: muestra “Juan tiene N fiados abiertos. Elige la deuda en Fiado; no registré nada”.
7. Si hay exactamente uno, abre `CreditPaySheet` con cliente, saldo vivo, original, monto interpretado prellenado, método efectivo visible y nota vacía.
8. La hoja se abre sobre Caja (no cambia de pestaña); el `POST` queda a la espera de **Registrar abono**.

El transcript dice “Revisa el abono… Todavía no se registra”; la voz dice “Revisa el abono de $X a Juan”, no “Abono registrado”.

**Prueba de nombre exacto del parser:** la frase `Me pagó a Juana 50 del fiado de Ana` devuelve `customerName = "Juana"` con el parser local. La hoja abre la deuda de Juana ($200) aunque la transcripción mencione a Ana; no abre la de Ana ni se declara ambigua.

### 2.2 · Hoja de abono honesta y baseline real del borrador

`CreditPaySheet` ahora muestra:

- **Saldo vivo** del crédito y **original**; si hay abonos previos, también “abonado $X”.
- **Se aplican $X** calculado como `min(monto escrito, saldo vivo)`.
- Si el monto escrito supera el saldo: **“Recibiste $X: devuelve $Y. El saldo no queda negativo.”**
- Método con check visible, texto **ELEGIDO**, borde/fondo y `focus-within` (no depende solo del color).
- Botón **Registrar abono** deshabilitado con monto inválido, saldo liquidado o petición en vuelo.
- Confirmación de descarte si el monto, el método o la nota cambiaron; se conserva “Seguir editando” / “Descartar abono”.

**Corrección del falso “borrador sucio”:** el baseline de `dirty` es el monto con el que se abrió la hoja (`initialAmount`), no `balanceCents`. Abrir por voz “me pagó 50” sobre un crédito de $200 y cerrar sin editar **no pide confirmación**; editar a $60 **sí** la pide. La prueba está en el E2E.

### 2.3 · Idempotencia y atomicidad durable

**Esquema (`web/src/lib/db.ts`):**

- `credit_payments.request_id TEXT` nullable.
- Migración compatible: si una DB existente no tiene la columna, `ALTER TABLE ... ADD COLUMN request_id TEXT`; después se crea `CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_payments_request_id ... WHERE request_id IS NOT NULL`.
- Los abonos viejos conservan `request_id NULL`; el índice parcial permite múltiples `NULL`.
- Probado con una DB de esquema viejo creada a mano: al arrancar, la columna se agrega, el índice se crea y la fila vieja queda con `request_id = NULL`.

**`recordCreditPayment` (`web/src/lib/orders.ts`):**

```ts
recordCreditPayment(
  creditId,
  amountCents,
  method = "cash",
  note = null,
  requestId = null,
  expectedBalanceCents = null,
): CreditPaymentResult
```

- Abre `BEGIN IMMEDIATE` antes de leer el saldo.
- Si `requestId` ya existe en el mismo crédito, devuelve el abono existente con `duplicate: true` y **no inserta**.
- Si `requestId` existe en otro crédito, devuelve `409 request_id_conflict`.
- Si el crédito está saldado o el saldo es 0, no escribe y devuelve `409 credit_settled`.
- Si `expectedBalanceCents` no coincide con el saldo actual, no escribe y devuelve `409 balance_changed`.
- Si el monto pedido supera el saldo, aplica el saldo y reporta `overpayCents`; no lo recorta en silencio.
- Inserta `credit_payment`, actualiza `credits.balance_cents/status` y `audit("credit.payment")` dentro de la misma transacción; `COMMIT` solo al final. Si algo falla, `ROLLBACK`.
- Devuelve `credit`, `appliedCents`, `balanceCents`, `overpayCents` y `duplicate`.

**API (`/api/credits/[id]/pay`):**

- Acepta `requestId` y `expectedBalanceCents` opcionales.
- Devuelve los campos del resultado.
- Devuelve `409` con `code`, `credit`, `appliedCents`, `balanceCents`, `overpayCents` y `duplicate: false` para `credit_settled`, `balance_changed` y `request_id_conflict`.

**Cliente:**

- Genera `requestId` una vez al abrir la hoja (`crypto.randomUUID()` con fallback) y lo conserva mientras la hoja sigue abierta.
- Envía `amountCents` pedido (no el aplicado), `requestId` y `expectedBalanceCents` del saldo con el que abrió.
- Usa `appliedCents`/`overpayCents` de la respuesta para el mensaje; si `duplicate: true`, avisa “Abono ya registrado… No se duplicó”.
- Si recibe `409`, muestra el mensaje del servidor, refresca el dashboard y no anuncia un abono falso.

**Referencia correcta:** esto cierra el candidato de auditoría **P0-1 / P0-C**, no una tarea P0-4. La idempotencia durable ya está implementada en este corte.

### 2.4 · Un solo saldo visible

Se añadió `creditForOrder(order, credits)` y una nota compartida `OrderCreditNote`:

| Superficie | Antes | Ahora |
|---|---|---|
| Detalle del pedido (`PaymentPanel`) | “Saldo pendiente: `order.creditCents`” (original) | “Saldo vivo: `credit.balanceCents` · original `order.creditCents`”; si liquidado, **Saldado** + original |
| Hoja de pago (`PaidSheet`) | Mismo original como “Saldo pendiente” | Misma nota de saldo vivo/original/Saldado (presentación; no se tocó `paymentTruth`) |
| Actividad | “Fiado” o “Pago mixto”, sin saldo | “Fiado · saldo $X”, “Fiado · Saldado” o “original $X” si el crédito no está disponible |
| Libreta de Fiado | Solo saldo vivo y “N clientes” contando créditos | Saldo vivo, `original $X` si hubo abonos, `Pedido ####` o “sin pedido”, y “N clientes” contando **customerId distintos** (no créditos) |

`orders.creditCents` **no se modifica**: sigue siendo el monto original que usa la verdad del pago. La lectura es la que cambia.

**Corrección de alcance:** la rama “Saldado” de `CreditPaySheet` existe como guarda, pero **no es alcanzable en el flujo normal**, porque la hoja solo recibe créditos de `pendingCredits` (`status !== settled`). “Saldado” se muestra en el detalle (`PaymentPanel`) y en Actividad; no se afirma que se vea en la hoja de abono.

### 2.5 · `/api/credits` deja de ser un snapshot de build

El build de Next 16 con Cache Components prerenderizaba `GET /api/credits` como `○ (Static)`. Se añadió `await connection()` en `web/src/app/api/credits/route.ts` para que la ruta sea `ƒ (Dynamic)` y pueda leerse como saldo vivo. No cambia la lógica de crédito.

### 2.6 · Guion y pruebas de demo actualizados

- `web/scripts/mobile-audit.py` y `web/scripts/rehearse-demo.py` abren la hoja y pulsan **Registrar abono**; ya no esperan el abono de un toque.
- `GUION-3-MIN.md`, `RUNBOOK-DEMO.md` y la tabla del `README.md` describen la confirmación.

---

## 3 · Decisiones

1. **La IA no tiene autoridad financiera.** La voz solo prellena; la persona confirma monto, cliente y método.
2. **Ambigüedad = no ejecutar.** Es más seguro pedir que se elija la deuda en Fiado que adivinar entre dos créditos del mismo cliente.
3. **El sobrepago se muestra, no se esconde.** Se aplica el saldo y se indica el cambio a devolver; el `POST` envía el monto pedido, el servidor aplica el saldo y devuelve `overpayCents`. No se bloquea el caso cotidiano de “me dio $100 y debía $50”.
4. **El original se conserva y se etiqueta.** `orders.creditCents` no se toca; se muestra como “original” para no confundirlo con el saldo vivo.
5. **“Saldado” manda sobre “pendiente”.** Si `credits.balance_cents = 0` o `status = settled`, el detalle y Actividad dicen Saldado y conservan el original.
6. **El método por defecto sigue siendo efectivo, pero es visible y editable.** No hay default silencioso: la hoja muestra check, texto ELEGIDO y foco. La frase “me transfirió” no cambia el método automáticamente; la persona debe elegir Digital.
7. **Una llave por intento de hoja.** `requestId` se genera al abrir la hoja y se reutiliza en los reintentos de esa hoja; una hoja nueva genera otra llave. La deduplicación durable cubre el reintento de la misma llave, no “dos intenciones distintas”.
8. **Saldo esperado explícito.** El cliente envía `expectedBalanceCents` para que una hoja abierta con saldo viejo reciba 409 en vez de escribir sobre un saldo que cambió.
9. **No se cambió la verdad del pago.** Ni `paymentTruth`, ni webhook, ni `/api/verify`, ni `PaidSheet` en su lógica de verdad.

---

## 4 · Pruebas ejecutadas

### 4.1 · Gates

Ejecutados desde `web/` sobre el árbol de producto `0eddea2` (los commits posteriores solo agregan evidencia/reporte):

| Comando | Resultado |
|---|---|
| `npm run lint` | **PASS** · sin errores ni warnings |
| `npx tsc --noEmit` | **PASS** · sin salida |
| `npm run build` | **PASS** · Next.js 16.4.3; `/api/credits` ahora `ƒ (Dynamic)` |
| `npm run verify:fast` | **PASS** · 3/3 (guard, lint, types) |
| `npm run verify:static` | **PASS** · 4/4 (guard, lint, types, build) |

Evidencia de gate: `harness/evidence/latest.json`, `mode: static`, `gitAtStart.sha = 62ca6f2`, `dirty: false`, `ok: true`. El gate se ejecutó después de las evidencias E2E, sobre el mismo código de producto (`0eddea2`); no hubo cambios de producto entre esos commits.

> Los gates `static` no contactan `:3000`; el banner `http://localhost:3000` del harness es informativo y no se ejecutó ningún gate runtime contra ese servidor.

### 4.2 · E2E P0-C

**Archivo:** `web/scripts/p0-fiado-e2e.py`.
**Servidor:** el propio script levanta `npm start` en **`:3101`** con `DATABASE_PATH` temporal, `DEMO_MODE=true` y `OPENAI_API_KEY=""`; reinicia la demo entre casos y borra la base al terminar. Se niega a correr contra `:3000`. También acepta `P0_EXTERNAL_SERVER=1` + `P0_DB_PATH`.

**Resultado:** **48 PASS · 0 FAIL · 0 KNOWN**.
**Evidencia:** `harness/evidence/p0-fiado-e2e.json` (`baseUrl = http://localhost:3101`, `code.commit = 7ea5f67`, `code.dirty = false`; el código de producto es `0eddea2`, entre ambos commits solo cambió el JSON de regresión P0-A/B).
**Artefacto 360:** `harness/evidence/p0-fiado-360.png` (capturado por el E2E; documentScrollWidth 360, diálogo 358).

Casos cubiertos:

1. “Juan pagó $50” abre la hoja con `Saldo vivo: $50.00` y original; el saldo y `credit_payments` no cambian antes de confirmar.
2. Doble clic en “Registrar abono”: un solo `POST` y un solo `credit_payment`.
3. Cancelar/descartar un borrador sucio deja el saldo intacto y no inserta abono.
4. Confirmar registra exactamente un `credit_payment` de $50 con método `codi`; el aviso dice que Juan debe $0.00.
5. Sobrepago de $100 sobre $50: la API devuelve `appliedCents = 5000`, `overpayCents = 5000`, `duplicate = false`; se registra $50 y el saldo queda en 0 (no negativo).
6. Un crédito ya saldado devuelve `409 credit_settled`; no duplica ni anuncia falso éxito.
7. Un saldo que cambió entre abrir la hoja y confirmar devuelve `409 balance_changed` con el saldo nuevo; no duplica.
8. Dos deudas de Juan no ejecutan nada sin elección: 0 `POST` y los dos saldos intactos.
9. Nombre exacto del parser: `Me pagó a Juana 50 del fiado de Ana` devuelve `customerName = "Juana"`, abre la deuda de Juana ($200) y no la de Ana.
10. Baseline de borrador: cerrar el monto prellenado de $50 sin editar no pide confirmación; editar a $60 sí.
11. Actividad muestra `saldo $100.00`; el detalle muestra “Saldo vivo: $100.00 · original $100.00” y no “Saldo pendiente”.
12. Confirmar desde la hoja un abono parcial de $40 sobre $100 deja saldo $60; Actividad y detalle siguen el saldo.
13. La hoja de abono muestra `Saldo vivo: $60.00 · original $100.00 · abonado $40.00`.
14. Liquidar desde la hoja registra el abono final; `orders.credit_cents` sigue siendo 10000 en SQLite.
15. Tras liquidar, Actividad dice `Saldado` y el detalle “Fiado Saldado · original $100.00”.
16. La misma `requestId` dos veces devuelve `duplicate: true` y un solo `credit_payment`; con otro monto tampoco duplica.
17. La hoja a 360 px no desborda horizontalmente y muestra el método con estado; el artefacto queda en `harness/evidence/p0-fiado-360.png`.
18. Ninguna petición del navegador fue a `:3000`; el carril corrió en `:3101`.

### 4.3 · Migración de una DB existente

Prueba manual separada del E2E, sobre una DB temporal con el esquema viejo de `credit_payments` (sin `request_id`):

- Al arrancar la app, `PRAGMA table_info(credit_payments)` muestra `request_id`.
- Se crea `idx_credit_payments_request_id` (índice único parcial).
- La fila vieja `cp_old` conserva `request_id = NULL`.
- `/api/dashboard` responde 200 y el seed funciona.

No se tocó la DB del repo principal ni el servidor `:3000`.

### 4.4 · Regresión P0-A/B

Se corrió `web/scripts/p0-venta-e2e.py` contra un servidor aislado `:3101` con DB temporal, `OPENAI_API_KEY=""`, sobre el árbol P0-C:

**43 PASS · 0 FAIL · 1 KNOWN**.

Evidencia: `harness/evidence/p0-venta-e2e.json` (`baseUrl = http://localhost:3101`, `code.commit = 0eddea2`, `code.dirty = false`). El KNOWN es el hueco pre-existente del `PaymentPanel` mixto con saldo digital, ya reportado en P0-A/B.

### 4.5 · Chequeo 360

El E2E incluye un viewport 360 × 800, captura `harness/evidence/p0-fiado-360.png` y comprueba:

- `documentElement.scrollWidth = 360` (sin scroll horizontal).
- `dialog.scrollWidth = 358`.
- El método seleccionado muestra check + ELEGIDO.

No sustituye una prueba con lector de pantalla, alto contraste, daltonismo ni teléfono físico.

---

## 5 · Riesgos y KNOWN

- **Consulta de voz con varias deudas:** `answerLocal` sigue devolviendo el primer crédito que coincide al preguntar “¿cuánto me debe Juan?”. No suma varias deudas ni desambigua. El abono sí bloquea la ambigüedad; la consulta no. Es un KNOWN de P0-E/P1.
- **Método “me transfirió”:** el parser no devuelve método y la hoja abre en Efectivo. La persona debe elegir Digital; no se infiere de la frase. Es visible, no silencioso, pero sigue siendo un paso manual.
- **“Saldado” en la hoja de abono:** la rama existe como guarda, pero no es alcanzable porque la hoja solo recibe créditos pendientes. “Saldado” se ve en detalle y Actividad. No se afirma lo contrario.
- **Historial de saldados:** la libreta solo lista créditos abiertos; un crédito liquidado desaparece de la libreta. No hay sección de historial de saldados (P0-2/P1).
- **Título del detalle:** `paymentSheetTitle` sigue devolviendo “Pedido entregado” para un pedido `fulfilled` con crédito abierto. Es el riesgo R5/P0-5 de la auditoría; la nota de saldo vivo sí es correcta.
- **`PaidSheet` con crédito:** se actualizó su presentación para no mostrar el original como “Saldo pendiente”, pero el flujo normal de fiado abre `PaymentPanel`, no `PaidSheet`. La rama de `PaidSheet` con crédito no es alcanzable en el camino probado.
- **Sin polling:** la hoja y las superficies usan `dashboard.credits` al cargar. Si otra pestaña abona mientras la pantalla está quieta, el cambio se ve al refrescar o al confirmar (el `expectedBalanceCents` produce 409). Actualización viva/polling es P0-E.
- **Idempotencia por intención:** `requestId` se genera por hoja abierta. Si la primera petición llegó al servidor pero se perdió la respuesta y la persona **cierra y vuelve a abrir** la hoja, se genera otra llave y el nuevo intento no está deduplicado contra el anterior. El reintento dentro de la misma hoja sí está cubierto. No hay reintento automático.
- **Atomicidad:** la transacción `BEGIN IMMEDIATE` cubre el camino normal y los conflictos; no se forzó una caída entre `INSERT` y `UPDATE` ni se probó concurrencia multi-proceso. SQLite usa `busy_timeout = 5000` y el proceso es único en el prototipo.
- **Migración:** se probó contra una DB de esquema viejo; no se probó contra una DB con `request_id` duplicados preexistentes (el índice único fallaría, como debe).
- **Voz real:** se probó el chip y `interpretText` con el parser local (`mockParse`). No se probó micrófono real, `MediaRecorder`, transcripción OpenAI ni una frase con nombre que el parser devuelva distinto al nombre del cliente. Si el nombre del parser no coincide exactamente, la app no ejecuta (comportamiento seguro).
- **Métodos:** solo se ofrecen Efectivo y Digital (`codi`), como antes. No se añadieron tarjeta/wallet.
- **“N clientes”:** cuenta `customerId` distintos, no créditos. No deduplica personas por nombre; “José” y “Jose” siguen siendo dos clientes.
- **Sin personas, lector de pantalla, alto contraste, daltonismo ni teléfono físico.** No se ejecutó `verify:full`, `mobile-audit.py` contra `:3000`, `rehearse-demo.py` contra `:3000` ni auditorías HIG. Los scripts móviles/ensayo se actualizaron, pero no se corrieron porque apuntan a `:3000`, que estaba prohibido.
- **DB local del worktree:** el build/migración puede abrir `web/data/mercado-cero.db` al generar rutas; el E2E usa una DB temporal y no se tocó `:3000` ni el repo principal. La DB local del worktree es la única afectada por la migración de desarrollo.

---

## 6 · Estado de entrega

- **Producto:** `web/src/components/caja-app.tsx`, `web/src/app/api/credits/[id]/pay/route.ts`, `web/src/lib/orders.ts`, `web/src/lib/db.ts`, `web/src/lib/types.ts`.
- **Prueba reproducible:** `web/scripts/p0-fiado-e2e.py`.
- **Guion/demo actualizados:** `mobile-audit.py`, `rehearse-demo.py`, `GUION-3-MIN.md`, `RUNBOOK-DEMO.md`, `README.md`.
- **Evidencia:**
  - `harness/evidence/p0-fiado-e2e.json` (48 PASS · 0 FAIL · 0 KNOWN, `:3101`, `dirty: false`).
  - `harness/evidence/p0-fiado-360.png` (artefacto 360).
  - `harness/evidence/p0-venta-e2e.json` (43 PASS · 0 FAIL · 1 KNOWN, `:3101`, `code.commit = 0eddea2`, `dirty: false`).
  - `harness/evidence/latest.json` (static 4/4, `gitAtStart.sha = 62ca6f2`, `dirty: false`).
- **Commits:** `0eddea2` (producto), `7ea5f67` (regresión P0-A/B), `62ca6f2` (E2E P0-C + 360), `5a857f8` (gate estático). El reporte se commitea después de este archivo.
- **Sin merge a `master`.** Sin tocar `mercado-cero` ni el servidor `:3000`.

### Reproducir P0-C

```powershell
cd web
npm ci
npm run build
python scripts\p0-fiado-e2e.py
```

El script levanta su propio servidor en `:3101` con base temporal y `OPENAI_API_KEY=""`. Para usar un servidor externo aislado:

```powershell
$env:P0_EXTERNAL_SERVER="1"
$env:P0_DB_PATH="C:\ruta\temporal\p0-fiado.db"
python scripts\p0-fiado-e2e.py
```

### Reproducir P0-A/B

```powershell
# terminal 1, desde web/
$env:PORT="3101"
$env:DATABASE_PATH="C:\ruta\temporal\p0-venta.db"
$env:DEMO_MODE="true"
$env:OPENAI_API_KEY=""
npm start

# terminal 2, desde web/
$env:P0_BASE_URL="http://localhost:3101"
python scripts\p0-venta-e2e.py
```
