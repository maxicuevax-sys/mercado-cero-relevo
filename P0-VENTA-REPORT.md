# P0 · Venta durable — reporte de carril

> **Rama:** `p0/venta-durable` · **Worktree:** `mercado-cero-p0` · **Fecha:** 1 de noviembre de 2026.
> **Alcance:** P0-A (vender sin IA, validación inline, efectivo con cambio) + P0-B (borrador durable y reanudación).
> **Fuera de alcance y no tocado:** pagos, webhook, `/api/verify`, contrato de pey, esquema SQLite, `paymentTruth`/`PaidSheet`, identidad “Mostrador claro”.

## 1 · Resultado

La Caja ya permite iniciar una venta manual con el draft vacío, validar cada producto antes de enviar, aceptar un billete mayor al total y mostrar el cambio, y recuperar el borrador tras una recarga. La venta por texto/voz, el ejemplo de $90, el fiado y el reinicio de demo siguen funcionando en las pruebas de este carril.

**Archivo de producto modificado:** `web/src/components/caja-app.tsx` (único archivo de código).
**Reporte:** este archivo.

## 2 · Cambios implementados

### 2.1 · Vender sin IA

- El estado vacío de “Pedido en curso” ahora tiene un botón **“Agregar producto”** que crea la primera fila editable sin llamar a `/api/voice/parse`.
- El botón “Agregar producto” también sigue disponible debajo de los ítems existentes.
- Si el parser falla, el bloque de error ofrece **“Escribir productos”**, que agrega una fila manual sin borrar los ítems que ya había.
- La fila nueva nace con descripción vacía (placeholder “Producto”), cantidad 1 y precio 0; el foco pasa a la descripción.

### 2.2 · Validación inline por ítem

- Antes del `POST /api/orders` se valida cada ítem:
  - descripción no vacía;
  - cantidad finita y > 0;
  - precio entero/finito y > 0.
- El error se muestra **dentro de la fila** (`role="alert"`), con `aria-invalid` y `aria-describedby` en sus campos.
- Al intentar confirmar con ítems inválidos, el foco va al primer campo inválido del primer ítem inválido.
- “Confirmar venta” ya no se deshabilita por precio 0 o por exceso de efectivo: se puede pulsar para recibir la explicación. Solo se deshabilita sin ítems o mientras guarda.
- El fiado que supera el total se bloquea con mensaje junto al campo y foco en “A fiado”; no se envía un POST que el servidor recortaría en silencio.
- El fiado sin nombre también se valida antes del POST y enfoca el nombre del cliente.

### 2.3 · Efectivo real con cambio

- `cashCents` sigue siendo el **efectivo recibido** (ej. 10000 para $100).
- Se calcula:
  - `fiado aplicado = min(fiado, total)`;
  - `efectivo aplicado = min(recibido, total - fiado aplicado)`;
  - `cambio = max(0, recibido - efectivo aplicado)`;
  - `saldo digital = max(0, total - efectivo aplicado - fiado aplicado)`.
- Al servidor se envían **solo** `efectivo aplicado` y `fiado aplicado`; el cambio nunca se cuenta como pago.
- La UI muestra “Cambio $X” y “Se aplican $X al cobro” cuando hay exceso.
- `overpay` se redefinió como “el fiado supera el total” (no como “efectivo + fiado > total”). El exceso de efectivo ya no bloquea la venta.
- No se tocó `paymentTruth`, `PaidSheet` ni la lógica de pagos.

### 2.4 · Borrador durable

- Se persiste en `localStorage`, bajo `mercado-cero:draft:v1`, un objeto versionado (`version: 1`) con:
  - `items`, `cashCents` (efectivo recibido), `creditCents`, `customerName`, `textInput`, `transcript`, `updatedAt`.
- Se restaura al montar, sin auto-enviar nada.
- Se muestra un banner discreto: **“Recuperé tu venta de las HH:MM”** (si es de otro día, agrega “ayer” o la fecha) con acción **“Descartar”**.
- “Descartar” limpia la venta y el almacenamiento, y devuelve el foco a “Agregar producto”.
- El borrador se limpia al crear la orden, al confirmar “Limpiar” y al reiniciar la demo.
- No se guarda ningún dato de pago, tarjeta, link ni token. Solo los campos listados.
- Lectura defensiva: si el JSON está corrupto, la versión no coincide o no hay contenido, se descarta el registro y se sigue con la caja vacía.

### 2.5 · “Limpiar” con confirmación

- “Limpiar” abre una confirmación inline (“¿Descartar la venta sin confirmar?”) con “Cancelar” y “Sí, limpiar”.
- Al confirmar se borra el estado y el borrador persistido.

## 3 · Decisiones

1. **El estado `cashCents` representa lo recibido, no lo aplicado.** Así el campo conserva el billete real ($100) y el cambio se explica en pantalla. La conversión a aplicado ocurre solo al construir el payload.
2. **El fiado tiene prioridad para reservar parte del total; el efectivo se aplica después.** Es la única forma de que “total - fiado” sea el máximo de efectivo aplicado y el resto sea cambio, tal como pidió el alcance.
3. **Se valida en el cliente con las mismas reglas del servidor** (descripción, cantidad y precio positivos), pero no se modificó el esquema ni las rutas del servidor.
4. **El draft se guarda con firma de contenido y `updatedAt`.** Se evita reescribir la hora al solo restaurar; si el usuario edita, se actualiza la hora.
5. **“Limpiar” pide confirmación inline**, reutilizando el patrón visual existente, sin `window.confirm` y sin cambiar la identidad.
6. **No se persiste `activeOrderId`.** El alcance pedido enumera solo los campos del draft; reabrir un cobro pendiente pertenece a P0-E.
7. **La verdad del dinero no se toca.** El servidor sigue recortando efectivo/fiado y el webhook sigue siendo la única vía a `paid` digital.

## 4 · Pruebas ejecutadas

### 4.1 · Gates estáticos

| Comando | Resultado |
|---|---|
| `npm ci` (en `web/`) | OK · 385 paquetes instalados |
| `npm run lint` | **PASS** · sin errores ni warnings |
| `npx tsc --noEmit` | **PASS** · sin salida |
| `npm run build` | **PASS** · Next.js 16.4.3, compilación y TypeScript OK, 21 páginas generadas |
| `npm run verify:fast` | **PASS** · 3/3: guard, lint, types |
| `npm run verify:static` | **PASS** · 4/4: guard, lint, types y build |

Nota de tooling: el worktree recién creado no tenía `next-env.d.ts`; el primer `tsc --noEmit` falló en tipos generados de Next 16 (`RouteContext`, `LayoutProps`). `next build` generó `next-env.d.ts` y el `tsc` posterior pasó limpio. No es un error del cambio.

### 4.2 · Playwright E2E (servidor aislado)

Servidor de producción de prueba en **`:3101`** (no se tocó el servidor de `:3000`), con `DATABASE_PATH` en el directorio temporal de opencode y `DEMO_MODE=true`. Se interceptó `/api/voice/parse` con 500 cuando el caso lo requería.

Resultados observados:

1. **Parser caído:** el error “La IA no está disponible” aparece; “Escribir productos” crea una fila manual; “Limpiar” pide confirmación y limpia. ✅
2. **Validación inline:** con una fila vacía, “Confirmar venta” muestra “Escribe el producto. El precio debe ser mayor a cero.”, enfoca la descripción y **no envía ningún POST**. ✅
3. **Ítem con precio 0 y descripción válida:** muestra “El precio debe ser mayor a cero.” y enfoca el precio. ✅
4. **Cantidad 0 restaurada desde `localStorage`:** muestra el error, enfoca la cantidad y no envía POST. ✅
5. **Venta manual $90 con $100:** “Cambio $10.00”, “Se aplican $90.00 al cobro”, orden con `totalCents=9000`, `paidCents=9000`, `creditCents=0`, `status=paid`; la caja suma +$90. ✅
6. **Borrador durable:** tras recargar, banner “Recuperé tu venta de las HH:MM”, ítem “Prueba”, total $10, efectivo $20 y cambio $10 restaurados; **no se creó otra orden**; “Descartar” limpió estado y storage; una segunda recarga no mostró banner. ✅
7. **Borradores viejos:** un draft de ayer mostró “Recuperé tu venta de ayer a las HH:MM”; uno de varios días mostró la fecha. ✅
8. **“Limpiar”:** “Cancelar” conserva la venta; “Sí, limpiar” borra ítems y storage. ✅
9. **Fiado:** fiado $100 sobre total $90 se bloquea con foco en “A fiado” y sin POST. Con $100 recibidos y $30 a fiado: cambio $40, se aplican $60, orden con `paidCents=6000`, `creditCents=3000`, `status=fulfilled`; caja +$60 y fiado +$30. ✅
10. **Venta mixta:** $30 efectivo + $20 fiado sobre $90 deja $40 digitales; la orden queda `confirmed` con `paidCents=3000`, `creditCents=2000`. ✅
11. **Reiniciar demo:** limpia el borrador persistido y el estado visible. ✅
12. **Venta por texto $90:** “Dos quesadillas de 35 y un agua de 20” produce 2 ítems y $90; tras recargar se restaura el draft y se confirma **una sola vez**; orden `paidCents=9000`. ✅

No se creó ni modificó ninguna orden en la base del repo principal; todas las pruebas usaron la base temporal del worktree.

## 5 · Riesgos y lo que no probé

- **No probé con personas, lector de pantalla (TalkBack/VoiceOver/NVDA), teléfono físico, zoom real al 200 %, alto contraste ni daltonismo.** No corrí `verify:full`, `hig-after-audit.py`, `mobile-audit.py` ni `checkout-audit.py`. Los targets nuevos mantienen `min-h-12` y no se cambió la identidad visual.
- **No probé el parser real de OpenAI** ni una caída real de red/OpenAI. El caso 500 se simuló con Playwright y la venta por texto usó el parser local (`mockParse`) sin `OPENAI_API_KEY`.
- **No probé pagos reales, webhook de pey, checkout público ni `/api/verify`.** No se tocaron.
- **No probé concurrencia de dos pestañas**, cuota/`localStorage` en modo privado, ni un dispositivo compartido con un draft de otra persona. El draft incluye nombre de cliente y transcripción, como pidió el alcance; “Descartar” es explícito y no hay auto-envío.
- **Observación fuera de alcance (pre-existente):** en una venta con fiado **y** saldo digital pendiente, `PaymentPanel` entra en la rama `isCredit` y muestra “Quedó anotado” con el total, sin ofrecer el cobro del saldo digital restante. La orden queda correctamente `confirmed` con el saldo; el hueco visual/accionable ya existía y pertenece al carril de cobro/P0-C/E, no a este corte. No se modificó para no ampliar el alcance ni tocar la UI de cobro.
- **No probé el Corte tab completo**; sí verifiqué que el efectivo aplicado y el fiado nuevo se reflejan en `/api/dashboard` (caja +$90, y +$60/+$30 en el caso con fiado), que es la base del corte.
- **No abordé la idempotencia de `POST /api/orders`** (sigue siendo P0-4): si la red falla después del insert, reintentar puede duplicar la orden. Es un riesgo pre-existente y fuera del alcance de este corte.
- **No hice merge.** La rama queda solo en el worktree, como pidió el orquestador.

## 6 · Estado de entrega

- Commit de código + reporte: `fabae3c` (`feat(caja): vender sin IA, cambio y borrador durable`).
- Evidencia de harness: `harness/evidence/latest.json` en el commit siguiente de la rama, con `ok: true` y `gitAtStart.sha = fabae3c`.
- Cambios de producto: `web/src/components/caja-app.tsx`.
- Pruebas: `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run verify:fast`, `npm run verify:static` y Playwright E2E aislado.
- Sin cambios en SQLite, webhook, pey, `/api/verify`, `paymentTruth`, `PaidSheet` ni en la dirección visual.
- Sin merge a `master`.
