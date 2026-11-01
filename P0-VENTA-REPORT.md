# P0 · Venta durable — reporte de carril (revisión 2)

> **Rama:** `p0/venta-durable` · **Worktree:** `mercado-cero-p0` · **Fecha:** 1 de noviembre de 2026.
> **Alcance:** P0-A (vender sin IA, validación inline, efectivo con cambio) + P0-B (borrador durable, `activeOrderId` y reanudación).
> **Revisión:** corrige los hallazgos de la revisión independiente antes del merge.
> **Fuera de alcance y no tocado:** pagos, webhook, `/api/verify`, contrato de pey, esquema SQLite, `paymentTruth`/`PaidSheet` en su lógica de verdad, identidad “Mostrador claro”.

## 1 · Resultado

La Caja permite iniciar una venta manual con el draft vacío, validar cada producto antes de enviar, aceptar un billete mayor al total y mostrar el cambio, recuperar el borrador tras una recarga y reabrir un cobro pendiente con “Continuar/Descartar” sin duplicar la orden ni abrir el cobro automáticamente. La venta por texto, el ejemplo de $90, el fiado, el resumen del dashboard (base del corte) y el reinicio de demo siguen funcionando; el camino de voz comparte `interpretText`, pero no se probó con micrófono real.

**Archivos de producto:** `web/src/components/caja-app.tsx` y `web/scripts/p0-venta-e2e.py` (nuevo, reproducible).
**Reporte:** este archivo.

## 2 · Correcciones de la revisión

### 2.1 · Borrar todos los ítems limpia los pagos viejos

- `updateDraftItems` detecta `items.length === 0` y limpia `cashCents`, `creditCents`, `customerName` y `restoredDraftAt`.
- `confirmingClear` se resetea al quedar sin ítems (efecto en `CajaPanel` y también en `commitItems`).
- La restauración y la persistencia normalizan el draft: si no hay ítems, nunca se guardan efectivo, fiado ni cliente. Un draft con 0 ítems no es pagable.
- Prueba: $90 + efectivo $100 + fiado $10 + cliente → borrar el último ítem → agregar un producto nuevo: efectivo y fiado vacíos, cliente ausente, confirmación de “Limpiar” cerrada y `localStorage` con `cashCents: 0`, `creditCents: 0`.

### 2.2 · Banner de recuperación: Continuar o descartar

- El banner solo se muestra si el draft restaurado tiene ítems.
- Un parseo nuevo (`sale`) limpia `restoredDraftAt` de forma explícita.
- Un efecto compara la firma del draft actual con la firma restaurada; cualquier edición, venta nueva o borrado de ítems oculta el banner.
- **“Continuar venta”** mantiene el draft y oculta el banner; enfoca el primer producto.
- **“Descartar borrador”** compara firmas: si el draft cambió, no borra nada; oculta el banner y avisa que se use “Limpiar”. Así no puede borrar una venta nueva sin confirmación.
- Las etiquetas accesibles son distintas: “Continuar la venta recuperada” y “Descartar el borrador de venta”.
- Prueba: recargar un draft → “Continuar venta” → el banner desaparece, el ítem y el `localStorage` siguen. Un parseo nuevo también oculta el banner y conserva la venta nueva.

### 2.3 · El cambio se conserva después de confirmar

- Al crear la orden se captura el cambio calculado antes de limpiar el draft y se asocia al `order.id` en estado local.
- `PaidSheet` muestra **“Cambio $X”** para la orden pagada en efectivo.
- `PaymentPanel` (resultado de fiado) y el toast de venta registrada muestran el cambio cuando la orden queda `fulfilled`.
- El ledger no cambia: el servidor sigue recibiendo solo efectivo aplicado y fiado aplicado.
- Pruebas: $90 con $100 → “Cambio $10.00”; $90 con $100 recibidos y $30 a fiado → “Cambio $40.00” (`paidCents=6000`, `creditCents=3000`).

### 2.4 · Foco tras “Sí, limpiar”

- Al confirmar “Sí, limpiar”, el foco pasa a `draft-add-empty` (“Agregar producto”) después de que el estado vacío se renderiza.
- Prueba Playwright: `document.activeElement.id === "draft-add-empty"`.

### 2.5 · P0-B: `activeOrderId` + “Continuar/Descartar” implementado

- Se persistió el pendiente en una clave separada, `mercado-cero:pending-order:v1`, con `orderId` y `updatedAt`. No se mezcla con el draft pagable.
- **El borrado es por id.** `clearStoredPendingOrder(orderId?)` solo elimina la clave si no se pasa id o si coincide con el `orderId` guardado. Así, crear o abrir una orden pagada/fulfilled **distinta** no borra el pendiente ajeno.
- Se borra cuando la orden del slot se paga, se entrega o se cancela, al reiniciar demo, o al abrir/crear esa misma orden si ya no es pendiente. Abrir o crear una orden pagada/fulfilled **distinta** no lo borra.
- `closeActiveOrder` conserva el aviso si la orden cerrada es otra y solo lo limpia si la orden cerrada es la misma.
- Al recargar, se consulta la orden y se muestra un aviso discreto: “Tienes un cobro pendiente de $X · Pedido ####” con **Continuar cobro** y **Descartar aviso** (aria-labels “Continuar el cobro pendiente” y “Descartar el aviso de cobro pendiente”). No se abre el cobro automáticamente y **no se crea otra orden**.
- “Continuar cobro” abre el mismo pedido. “Descartar aviso” quita el aviso y el almacenamiento, deja la orden en Actividad y enfoca el H1 de Caja (`caja-heading`).
- **Solo hay un slot de pendiente:** si se crea otro pendiente, reemplaza al anterior. No hay polling del aviso mientras está inactivo; eso pertenece a **P0-E**.
- Pruebas Playwright: (a) pendiente $60 → crear una venta pagada de $10 → la clave y el aviso siguen → recargar → Continuar abre el mismo id → pagar el pendiente borra el aviso; (b) flujo pendiente → recargar → Continuar/Descartar sin duplicar y con foco en Caja.
- **No se modificó `AUDITORIA-COGNITIVA.md`:** la enmienda condicional no aplica porque `activeOrderId` + “Continuar/Descartar” se implementó y probó. Además, ese archivo no está versionado en este worktree; vive como archivo no rastreado en el repo principal, que no se debía tocar.

### 2.6 · Venta mixta con saldo digital — hueco conocido

- La creación de la orden mixta es correcta: $30 efectivo + $20 fiado sobre $90 deja $40 digitales; `paidCents=3000`, `creditCents=2000`, `status=confirmed`.
- El `PaymentPanel` existente, cuando `creditCents > 0`, entra en la rama de resultado (“Quedó anotado”) y no ofrece la acción para cobrar el saldo digital restante. Es un hueco **pre-existente de P0-C/E**, no una regresión de este corte.
- **No se contó como experiencia ✅**: se registra como `KNOWN` en el script E2E y como riesgo abierto en este reporte.

## 3 · Recomendados

- **51 ítems:** se eliminó el truncamiento silencioso de 50; el draft restaura los 51 ítems. Prueba Playwright con 51 filas.
- **`aria-invalid`:** ahora solo se marca el campo que corresponde al primer error del ítem, no los tres. Prueba: descripción inválida → `desc=true, qty=false, price=false`; precio inválido → `price=true`.
- **JSON corrupto:** el `catch` de `readStoredDraft` elimina la clave dañada. Prueba: se inyecta `{corrupto`, se recarga y la clave queda en `null`, sin banner.
- **`confirmingClear`:** se resetea al quedar sin ítems y al editar/borrar ítems.
- **Script E2E:** `web/scripts/p0-venta-e2e.py` es reproducible, configurable con `P0_BASE_URL` (por defecto `http://localhost:3101`), reinicia la demo entre casos y no toca `:3000`.

## 4 · Decisiones

1. **`cashCents` = efectivo recibido, no aplicado.** El cambio se calcula en UI y se envía solo lo aplicado.
2. **El fiado reserva primero el total; el efectivo se aplica después.** Así el cambio es `recibido - (total - fiado)`.
3. **El draft vacío no es pagable.** Sin ítems no se guardan ni se restauran dinero ni cliente.
4. **El banner de recuperación es para el draft intacto.** “Continuar venta” lo oculta sin borrar; “Descartar borrador” solo borra si la firma sigue intacta.
5. **`activeOrderId` va en clave aparte del draft y se borra por id.** El draft se limpia al crear la orden, pero el pendiente de cobro sobrevive a otras órdenes y se reabre solo por aviso. Hay un único slot de pendiente.
6. **La reapertura es un aviso, no una apertura automática.** Respeta la regla de no interrumpir con el cobro.
7. **La verdad del dinero no se toca.** El servidor sigue recortando efectivo/fiado y el webhook sigue siendo la única vía a `paid` digital.

## 5 · Pruebas ejecutadas

### 5.1 · Gates estáticos

| Comando | Resultado |
|---|---|
| `npm run lint` | **PASS** · sin errores ni warnings |
| `npx tsc --noEmit` | **PASS** · sin salida |
| `npm run build` | **PASS** · Next.js 16.4.3, TypeScript y 21 páginas |
| `npm run verify:fast` | **PASS** · 3/3 (guard, lint, types) |
| `npm run verify:static` | **PASS** · 4/4 (guard, lint, types, build) |

Nota de tooling: el worktree no tenía `next-env.d.ts`; `next build` lo genera y el `tsc` posterior pasa limpio.

### 5.2 · Playwright E2E reproducible

Servidor de producción de prueba en **`:3101`**, `DATABASE_PATH` en el directorio temporal de opencode y `DEMO_MODE=true`. No se tocó `:3000` ni la base del repo principal.

Si Playwright no está instalado:

```powershell
pip install playwright
python -m playwright install chromium
```

```powershell
cd web
$env:PORT="3101"
$env:DATABASE_PATH="C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\mercado-cero-p0-e2e.db"
$env:DEMO_MODE="true"
npm start
# en otra terminal, desde web/
python scripts\p0-venta-e2e.py
```

Último resultado: **31 PASS · 0 FAIL · 1 KNOWN**. El script escribe `harness/evidence/p0-venta-e2e.json` con resultados, base URL, comandos y requisitos.

Cubre:
1. Parser en 500: “Escribir productos” crea una fila manual.
2. Borrar el último ítem limpia efectivo, fiado, cliente, banner y confirmación de “Limpiar”; el draft nuevo no guarda dinero sin ítems.
3. Un parseo nuevo oculta el banner de recuperación y conserva la venta nueva; quedar sin ítems también elimina el draft pagable.
4. “Continuar venta” mantiene el draft y oculta el banner; las etiquetas “Descartar borrador” y “Descartar aviso” son distintas.
5. $90/$100 conserva “Cambio $10.00” en el `PaidSheet` y la orden queda `paidCents=9000`.
6. $100 con $30 fiado conserva “Cambio $40.00” en el resultado y la orden queda `paidCents=6000`, `creditCents=3000`.
7. “Sí, limpiar” enfoca `draft-add-empty`.
8. `activeOrderId`: el pendiente se guarda, recargar muestra el aviso sin abrir el cobro, Continuar reabre el mismo id sin duplicar, Descartar aviso no borra la orden, enfoca `caja-heading` y el aviso no reaparece.
9. **Pendiente ajeno:** $60 pendientes → crear una venta pagada de $10 → la clave y el aviso siguen → abrir y cerrar otra orden pagada → el aviso sigue → recargar → Continuar abre el mismo id → pagar el pendiente borra el aviso.
10. La orden mixta conserva $30 efectivo, $20 fiado y $40 digitales; se marca el hueco de UI como `KNOWN` de P0-C/E.
11. 51 ítems se restauran sin truncar.
12. `aria-invalid` solo en descripción o precio, según el error.
13. JSON corrupto se elimina y no bloquea la caja.
14. Reiniciar demo limpia draft y pendiente.

### 5.3 · Regresión adicional

Con el build final también se probaron: precio 0 con foco en el precio, cantidad 0 restaurada con foco y sin POST, y banners de un draft de ayer y de varios días. Todos pasaron. El caso de parser 500 + escritura manual está ahora en el script E2E.

## 6 · Riesgos y lo que no probé

- **No probé con personas**, lector de pantalla, teléfono físico, zoom real al 200 %, alto contraste ni daltonismo. No corrí `verify:full`, `hig-after-audit.py`, `mobile-audit.py` ni `checkout-audit.py`.
- **No probé la grabación de micrófono real** (`MediaRecorder`/`/api/voice/transcribe`). La venta por texto y el parser local sí se probaron; el camino de voz comparte `interpretText`.
- **No probé OpenAI ni pey reales**, webhook real, checkout público ni `/api/verify`. El parser 500 se simuló; la venta por texto usó `mockParse`.
- **No probé concurrencia de dos pestañas** ni `localStorage` en modo privado/cuota. El aviso de pendiente se resuelve al recargar o al abrir la caja; **no hay polling del aviso mientras está inactivo (P0-E)**. **Solo hay un slot de pendiente**: si se guarda otro pendiente, reemplaza al anterior; una orden pagada/fulfilled distinta ya no lo borra.
- **El cambio mostrado tras confirmar es de sesión.** Si se recarga y se reabre una orden pagada, el cambio no se vuelve a mostrar porque no se guardó en el ledger ni en SQLite. El ledger es correcto; es una limitación de presentación.
- **Hueco de P0-C/E:** una venta mixta con fiado y saldo digital correcto en datos no ofrece cobrar el remanente desde el `PaymentPanel` existente. No se tocó la UI de cobro para no ampliar el alcance.
- **No abordé la idempotencia de `POST /api/orders`** (P0-4): un fallo de red después del insert y un reintento pueden duplicar. Es pre-existente y fuera de este corte.
- **No hice merge.** La rama queda solo en el worktree.

## 7 · Estado de entrega

- Commit de código: `37286fe` (`fix(caja): aislar pendiente por id y aclarar avisos`).
- Commit final de evidencia + script/reporte: el tip de la rama (`chore(harness): record p0 revision 3 evidence`).
- Evidencia de harness: `harness/evidence/latest.json` con `ok: true` y `gitAtStart.sha = 37286fe`.
- Evidencia E2E: `harness/evidence/p0-venta-e2e.json` (31 PASS · 0 FAIL · 1 KNOWN).
- Cambios de producto: `web/src/components/caja-app.tsx`.
- Prueba reproducible: `web/scripts/p0-venta-e2e.py`.
- Sin cambios en SQLite, webhook, pey, `/api/verify`, `paymentTruth`, `PaidSheet` (lógica de verdad) ni en la dirección visual.
- Sin merge a `master`.
