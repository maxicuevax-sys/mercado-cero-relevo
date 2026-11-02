# P0 · Fiado confirmado y saldo vivo — reporte de carril

> **Rama:** `p0/fiado` · **Worktree:** `mercado-cero-fiado` · **Base:** `6e0e7e5` (incluye P0-A/B).
> **Fecha:** 1 de noviembre de 2026.
> **Alcance:** P0-C del goal de carga cognitiva: la voz deja de escribir sola, la hoja de abono muestra saldo vivo/aplicado/devuelto, y detalle/hoja/actividad leen el crédito vivo en lugar de `orders.creditCents`.
> **Fuera de alcance y no tocado:** webhook pey, `/api/verify`, `paymentTruth`, la lógica de verdad de `PaidSheet`, esquema SQLite, identidad “Mostrador claro”, `orders.creditCents`, el servidor `:3000` y `mercado-cero`.

---

## 1 · Resultado

“Juan me pagó $50” ya **no registra un abono**. La frase abre `CreditPaySheet` con el cliente, el saldo vivo y el monto interpretado; el `POST /api/credits/:id/pay` solo ocurre al pulsar **Registrar abono**. La hoja distingue lo que se aplica de lo que se devuelve, exige un método visible con check/estado y conserva la confirmación de descarte. El detalle del pedido, la hoja de abono y Actividad muestran el saldo vivo y llaman “original” al monto de `orders.creditCents`; un crédito liquidado se muestra como **Saldado**.

**Commit de producto:** `972d5f2` (`feat(fiado): confirmar abonos y unificar saldo vivo`).
**Commit de evidencia de gates:** `20ad960` (`chore(harness): record p0 fiado static gate`).
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
7. Si hay exactamente uno, abre `CreditPaySheet` con:
   - cliente;
   - saldo vivo y original;
   - monto interpretado prellenado;
   - método efectivo visible por defecto;
   - nota vacía.
8. La hoja se abre sobre Caja (no cambia de pestaña); el `POST` queda a la espera de **Registrar abono**.

El transcript dice “Revisa el abono… Todavía no se registra”; la voz dice “Revisa el abono de $X a Juan”, no “Abono registrado”.

### 2.2 · Hoja de abono honesta

`CreditPaySheet` ahora muestra:

- **Saldo vivo** del crédito y **original**; si hay abonos previos, también “abonado $X”.
- **Se aplican $X** calculado como `min(monto escrito, saldo vivo)`.
- Si el monto escrito supera el saldo: **“Recibiste $X: devuelve $Y. El saldo no queda negativo.”**
- Método con check visible, texto **ELEGIDO**, borde/fondo y `focus-within` (no depende solo del color).
- Botón **Registrar abono** deshabilitado con monto inválido, saldo liquidado o petición en vuelo.
- Confirmación de descarte si el monto, el método o la nota cambiaron; se conserva “Seguir editando” / “Descartar abono”.
- El `POST` envía `appliedCents`, no el billete completo. El servidor sigue recortando por seguridad y nunca deja saldo negativo.

Justo antes del `POST`, la hoja relee `/api/dashboard` y compara el saldo vivo:

- si el crédito ya está saldado, no escribe y avisa “Ese fiado ya está saldado. No se registró nada.”;
- si el saldo cambió, no escribe y avisa “El saldo cambió a $X. Revisa el monto y confirma de nuevo.”;
- si coincide, registra el abono aplicado.

Esto evita el falso éxito de una hoja vieja abierta en otra pestaña.

### 2.3 · Un solo saldo visible

Se añadió `creditForOrder(order, credits)` y una nota compartida `OrderCreditNote`:

| Superficie | Antes | Ahora |
|---|---|---|
| Detalle del pedido (`PaymentPanel`) | “Saldo pendiente: `order.creditCents`” (original) | “Saldo vivo: `credit.balanceCents` · original `order.creditCents`”; si liquidado, **Saldado** + original |
| Hoja de pago (`PaidSheet`) | Mismo original como “Saldo pendiente” | Misma nota de saldo vivo/original/Saldado (presentación; no se tocó `paymentTruth`) |
| Actividad | “Fiado” o “Pago mixto”, sin saldo | “Fiado · saldo $X”, “Fiado · Saldado” o “original $X” si el crédito no está disponible |
| Libreta de Fiado | Solo saldo vivo y “N clientes” contando créditos | Saldo vivo, `original $X` si hubo abonos, `Pedido ####` o “sin pedido”, y “N clientes” contando personas |

`orders.creditCents` **no se modifica**: sigue siendo el monto original que usa la verdad del pago. La lectura es la que cambia.

### 2.4 · Idempotencia mínima

- Candado síncrono `creditPayLockRef`: un doble clic en “Registrar abono” no alcanza a mandar dos `POST`. Se probó con `dblclick` y con conteo de peticiones/`credit_payments`.
- Relectura del saldo antes de escribir para no anunciar un abono que otra pestaña ya hizo.
- **No se añadió `requestId` ni tabla/columna de idempotencia.** La idempotencia durable (reintento tras respuesta perdida, dos dispositivos/procesos) queda explícitamente para **P0-4**. Sin migración SQLite en este corte.

### 2.5 · `/api/credits` deja de ser un snapshot de build

El build de Next 16 con Cache Components prerenderizaba `GET /api/credits` como `○ (Static)`. Se añadió `await connection()` en `web/src/app/api/credits/route.ts` para que la ruta sea `ƒ (Dynamic)` y pueda leerse como saldo vivo. No cambia el esquema ni la lógica de crédito.

### 2.6 · Guion y pruebas de demo actualizados

- `web/scripts/mobile-audit.py` y `web/scripts/rehearse-demo.py` ahora abren la hoja y pulsan **Registrar abono**; ya no esperan el abono de un toque.
- `GUION-3-MIN.md`, `RUNBOOK-DEMO.md` y la tabla del `README.md` describen la confirmación.

---

## 3 · Decisiones

1. **La IA no tiene autoridad financiera.** La voz solo prellena; la persona confirma monto, cliente y método.
2. **Ambigüedad = no ejecutar.** Es más seguro pedir que se elija la deuda en Fiado que adivinar entre dos créditos del mismo cliente.
3. **El sobrepago se muestra, no se esconde.** Se aplica el saldo y se indica el cambio a devolver; el `POST` envía solo lo aplicado. No se bloquea el caso cotidiano de “me dio $100 y debía $50”.
4. **El original se conserva y se etiqueta.** `orders.creditCents` no se toca; se muestra como “original” para no confundirlo con el saldo vivo.
5. **“Saldado” manda sobre “pendiente”.** Si `credits.balance_cents = 0` o `status = settled`, el detalle y Actividad dicen Saldado y conservan el original.
6. **El método por defecto sigue siendo efectivo, pero es visible y editable.** No hay default silencioso: la hoja muestra check, texto ELEGIDO y foco.
7. **Idempotencia durable no se simula.** El candado de UI y la relectura cubren el doble clic y la pestaña vieja; la llave persistente es P0-4.
8. **No se cambió la verdad del pago.** Ni `paymentTruth`, ni webhook, ni `/api/verify`, ni `PaidSheet` en su lógica de verdad.

---

## 4 · Pruebas ejecutadas

### 4.1 · Gates

Ejecutados desde `web/`, sobre el commit de producto `972d5f2`:

| Comando | Resultado |
|---|---|
| `npm run lint` | **PASS** · sin errores ni warnings |
| `npx tsc --noEmit` | **PASS** · sin salida |
| `npm run build` | **PASS** · Next.js 16.4.3; `/api/credits` ahora `ƒ (Dynamic)` |
| `npm run verify:fast` | **PASS** · 3/3 (guard, lint, types) |
| `npm run verify:static` | **PASS** · 4/4 (guard, lint, types, build) |

Evidencia de gate: `harness/evidence/latest.json`, `mode: static`, `gitAtStart.sha = 972d5f2`, `dirty: false`, `ok: true`.

> Los gates `static` no contactan `:3000`; el banner `http://localhost:3000` del harness es informativo y no se ejecutó ningún gate runtime contra ese servidor.

### 4.2 · E2E aislado

**Archivo:** `web/scripts/p0-fiado-e2e.py` (nuevo, reproducible).
**Servidor:** el propio script levanta `npm start` en **`:3101`** con `DATABASE_PATH` temporal y `DEMO_MODE=true`; reinicia la demo entre casos y borra la base al terminar. Se niega a correr contra `:3000`. También acepta `P0_EXTERNAL_SERVER=1` + `P0_DB_PATH` para un servidor ya aislado.

**Resultado:** **26 PASS · 0 FAIL · 0 KNOWN**.
**Evidencia:** `harness/evidence/p0-fiado-e2e.json` (`code.commit = 20ad960`, `code.dirty = false`).

Casos cubiertos:

1. “Juan pagó $50” abre la hoja con `Saldo vivo: $50.00` y original; el saldo y `credit_payments` no cambian antes de confirmar.
2. Cancelar/descartar un borrador sucio deja el saldo intacto y no inserta abono.
3. Confirmar registra exactamente un `credit_payment` de $50 con método `codi`; el aviso dice que Juan debe $0.00.
4. Sobrepago de $100 sobre $50 muestra “Se aplican $50.00” y “devuelve $50.00”; se registra $50 y el saldo queda en 0 (no negativo).
5. Doble clic en “Registrar abono”: un solo `POST` y un solo `credit_payment`.
6. Un abono liquidado en otra pestaña no duplica ni anuncia falso éxito; muestra “ya está saldado”.
7. Dos deudas de Juan no ejecutan nada sin elección: 0 `POST` y los dos saldos intactos.
8. Actividad muestra `saldo $100.00`; el detalle muestra “Saldo vivo: $100.00 · original $100.00” y no “Saldo pendiente”.
9. Tras abono parcial de $40, Actividad muestra `saldo $60.00` y la hoja de abono muestra `Saldo vivo: $60.00 · original $100.00 · abonado $40.00`.
10. Tras liquidar, Actividad dice `Saldado` y el detalle “Fiado Saldado · original $100.00”.
11. Ninguna petición del navegador fue a `:3000`; el carril corrió en `:3101`.

### 4.3 · Regresión P0-A/B

Se corrió `web/scripts/p0-venta-e2e.py` contra el servidor aislado `:3101` (base temporal), sobre el mismo árbol:

**43 PASS · 0 FAIL · 1 KNOWN** (el KNOWN es el hueco pre-existente del `PaymentPanel` mixto con saldo digital, ya reportado en P0-A/B). Se conservan venta manual, borrador durable, `activeOrderId`, cambio y validación inline.

### 4.4 · Chequeo móvil de la hoja

Con viewport 360 px: la hoja no produce scroll horizontal (`documentElement.scrollWidth = 360`, diálogo 358), el método seleccionado muestra check + ELEGIDO y el botón queda visible. No se reemplazó por una prueba con lector de pantalla ni teléfono físico.

---

## 5 · Riesgos y KNOWN

- **Idempotencia durable (P0-4):** no hay `requestId` persistido ni deduplicación en SQLite. El candado de UI y la relectura cubren el doble clic y la pestaña vieja; un reintento tras una respuesta perdida o dos dispositivos/procesos concurrentes no están garantizados por una llave durable. No se simuló una migración.
- **Sin polling de saldo:** la hoja y las superficies usan `dashboard.credits` al cargar; si otra pestaña abona mientras la pantalla está quieta, el cambio se ve al refrescar o al confirmar (la relectura previa al `POST` evita el falso éxito). Actualización viva/polling es P0-E.
- **“Saldado” en la libreta:** la libreta solo lista créditos abiertos, así que un crédito liquidado deja de aparecer ahí; “Saldado” se muestra en detalle, hoja de abono y Actividad. No se añadió historial de saldados (P0-2/P1).
- **Título del detalle:** `paymentSheetTitle` sigue devolviendo “Pedido entregado” para un pedido `fulfilled` con crédito abierto. Es el riesgo R5/P0-5 de la auditoría, no se tocó en este corte; la nota de saldo vivo sí es correcta.
- **`PaidSheet` con crédito:** se actualizó su presentación para no mostrar el original como “Saldo pendiente”, pero el flujo normal de fiado abre `PaymentPanel`, no `PaidSheet`. La rama de `PaidSheet` con crédito no es alcanzable en el camino probado.
- **Voz real:** se probó el chip y `interpretText` con el parser local (`mockParse`). No se probó micrófono real, `MediaRecorder`, transcripción OpenAI ni una frase con nombre que el parser devuelva distinto al nombre del cliente. Si el nombre del parser no coincide exactamente, la app no ejecuta (comportamiento seguro).
- **Métodos:** solo se ofrecen Efectivo y Digital (`codi`), como antes. No se añadieron tarjeta/wallet.
- **Sin personas, lector de pantalla, alto contraste, daltonismo ni teléfono físico.** No se ejecutó `verify:full`, `mobile-audit.py` contra `:3000`, `rehearse-demo.py` contra `:3000` ni auditorías HIG. Los scripts móviles/ensayo se actualizaron, pero no se corrieron porque apuntan a `:3000`, que estaba prohibido.

---

## 6 · Estado de entrega

- **Producto:** `web/src/components/caja-app.tsx`, `web/src/app/api/credits/route.ts`.
- **Prueba reproducible:** `web/scripts/p0-fiado-e2e.py`.
- **Guion/demo actualizados:** `mobile-audit.py`, `rehearse-demo.py`, `GUION-3-MIN.md`, `RUNBOOK-DEMO.md`, `README.md`.
- **Evidencia:** `harness/evidence/p0-fiado-e2e.json` (26 PASS), `harness/evidence/latest.json` (static 4/4, commit `972d5f2`, `dirty: false`).
- **Commits:** `972d5f2` (producto) y `20ad960` (gate). El reporte y la evidencia E2E se commitean después de este archivo.
- **Sin merge a `master`.** Sin tocar `mercado-cero` ni el servidor `:3000`.

### Reproducir

```powershell
cd web
npm ci
npm run build
python scripts\p0-fiado-e2e.py
```

El script levanta su propio servidor en `:3101` con base temporal. Para usar un servidor externo aislado:

```powershell
$env:P0_EXTERNAL_SERVER="1"
$env:P0_DB_PATH="C:\ruta\temporal\p0-fiado.db"
python scripts\p0-fiado-e2e.py
```
