# Verificación independiente — Mercado Cero F3 final

> **Commit:** `efb8145` (`feat(web): complete HIG F3 and repair verification blockers`)
> **Worktree:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero-hig`
> **Rama:** `hig-redesign` · **Servidor:** `http://localhost:3001` · **DEMO_MODE:** activo
> **Fecha:** 31 de octubre de 2026
> **Veredicto: NO LISTO para F4.**

Este informe lo escribió un agente distinto del implementador. No se aceptó como prueba la sección “Estado tras las reparaciones” de `VERIFICACION-INDEPENDIENTE.md`: todas las afirmaciones de abajo se verificaron de nuevo contra `HIG-DESIGN.md`, la API y el navegador.

---

## 1 · Resumen del veredicto

F3 sigue sin pasar el gate. Hay **tres grupos de bloqueantes**:

1. **La verdad del pago sigue rota para efectivo y para demo en la UI de la comerciante.** El fiado puro y el webhook firmado sí quedaron bien, pero una venta en efectivo muestra “Pago verificado / confirmado por pey”, un pedido efectivo+fiado se anuncia como pagado y oculta el fiado, y un pago demo reaparece como “Pagado” con verde de éxito en Actividad.
2. **La trampa de foco sigue sin ser completa.** `Shift+Tab` escapa del diálogo en Guía, Cobro, Fiado, Verificar y confirmación de Corte. El backdrop cierra, pero deja el foco en `BODY` en vez de devolverlo al disparador.
3. **El 200% sigue roto en móvil, incluyendo sheets.** A 360/390 se corta el total del checkout, se corta el badge “Esperando al banco”, el botón Cerrar de Verificar queda fuera de pantalla y Corte tiene inputs de 0/11 px y analítica ilegible. El overflow está escondido con `overflow-hidden`, por lo que el audit oficial no lo detecta.

Entrega (`paid → fulfilled`), éxito del checkout con foco/`aria-live`, tabs con estado/scroll, sidebar a 768, errores inline, verificación con foco y “No entregues el pedido”, y el tamaño 40→80 px del total **sí pasan**. Los detalles están abajo.

---

## 2 · Método y evidencia ejecutada

### 2.1 Comprobaciones de calidad

| Comprobación | Resultado |
|---|---|
| `git status` al iniciar y al cerrar | limpio; HEAD `efb8145`; sin cambios de implementación |
| `git diff --stat 74730e1..efb8145` | 17 archivos; UI + API/lib + scripts; sin `.env` ni secretos |
| `npm run lint` | pasa |
| `npx tsc --noEmit` | pasa |
| `python scripts/hig-after-audit.py` | **0 fallos** (pero ver §4, M1: el audit no mide lo que dice medir) |
| `BASE_URL=http://localhost:3001 node scripts/webhook-contract.mjs` | **27/27** |
| `npm run build` | no se volvió a ejecutar para no interrumpir 3001; no se usa como prueba propia |

El puerto 3000 corresponde a otra carpeta (`mercado-cero/web`, `next start`), fuera de este worktree. No se modificó. El commit no toca esa app.

### 2.2 Pruebas propias con Playwright

Se usaron scripts propios en `C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\mc-verify-f3\`. No se editó `src`, API, libs, CSS ni scripts del proyecto.

| Suite propia | Resultado |
|---|---|
| Verdad de pago, entrega y transiciones API | 34/35; el único FAIL fue una expectativa mía demasiado estricta (esperaba `h1`, pero tras entregar el foco volvió a la fila de Actividad, que el contrato permite). Reevaluado: los 35 casos cumplen |
| Foco: trampa, Escape, backdrop y retorno | **48/66**; 18 fallos, todos de `Shift+Tab` o retorno de foco por backdrop |
| 200%: 4 viewports, pantallas y sheets, targets, axe | **87/96**; 9 fallos (detalle en §4) |
| Contrato de pantallas: tabs, sidebar, errores inline, verificación, checkout 40/80 | **26/26** |
| Gate del audit con fallos sintéticos | **6/6**: el gate sí sale 1 ante axe serio, overflow, viewport expandido, clipping, solape y target <44 |
| Medición real del propio `hig-after-audit.measure()` en Corte 360 al 200% | **0 hallazgos**, aunque la pantalla está visiblemente rota |

También se revisó el diff del commit, el código de `Sheet`, `PaymentPanel`, `checkout-client`, `orders.ts`, `db.ts` y las rutas API. Se usó axe-core en las pantallas y sheets indicados; no hubo violaciones serias/críticas en los estados normales.

---

## 3 · Bloqueantes

### B1 · La verdad del pago sigue rota fuera del caso “fiado puro” y “webhook firmado”

El implementador demostró tres casos concretos y esos tres pasan:

- **Fiado puro:** orden `fulfilled` con `creditCents=9000`, sin payment; Actividad dice “Fiado”; el sheet dice “Venta a fiado / Quedó anotado”; `/pay/{id}` dice “Quedó anotado”; no dice “Pago simulado” ni “Pago confirmado”. **Pasa.**
- **Webhook firmado en demo:** `provider=pey`; el sheet de Caja dice “Pago verificado”; `/pay/{id}` dice “Pago confirmado / Listo para entregar”; no dice simulado. **Pasa.**
- **Demo pay:** `/api/checkout/{id}` devuelve `payment.provider=demo`; `/pay/{id}` y el `PaidSheet` dicen “Pago simulado”. **Pasa.**

Pero el mismo build sigue mostrando pagos no verificados como verificados:

#### B1.1 · Una venta en efectivo se anuncia como “Pago verificado” y “confirmado por pey”

Reproducción:

```http
POST /api/orders
{"items":[{"description":"Venta efectivo pura","quantity":1,"unitPriceCents":9000}],
 "cashCents":9000}
```

Resultado API: `status=paid`, `paidCents=9000`, `creditCents=0`, `lastPaymentProvider=cash`. No hay webhook ni evento de pey.

UI medida (1280): Caja → Actividad → fila “Venta efectivo pura” → sheet:

```text
Pedido pagado
Pago verificado
Pedido pagado
$90.00
Pedido 8954 · confirmado por pey
```

El texto “confirmado por pey” es falso para un pago en efectivo. Contradice el contrato 5.6 (“`paid` solo si `webhook` confirmó”), 6.2, la máquina de estados §7 y la propia ayuda de la app (“el efectivo se registra como declarado; no es una confirmación bancaria”). Evidencia: `cash-sheet.png`.

Causa visible: `caja-app.tsx:1549-1556` usa `isPaid = order.status === "paid"` y solo distingue `demo` por `lastPaymentProvider === "demo"`; cualquier otro proveedor, incluido `cash`, entra a la rama “Pago verificado / confirmado por pey” (`1572-1595`).

#### B1.2 · Un pedido efectivo + fiado se muestra como pagado y oculta el fiado

Reproducción:

```http
POST /api/orders
{"items":[{"description":"Mixto efectivo fiado","quantity":1,"unitPriceCents":9000}],
 "cashCents":3000,"creditCents":6000,"customerName":"Cliente Mixto"}
```

API: `status=fulfilled`, `paidCents=3000`, `creditCents=6000`. `/api/checkout/{id}` devuelve `payment.provider=cash` (3000) y `order.creditCents=6000`.

UI de `/pay/{id}` (390): “Pago confirmado”, “Listo para entregar”, “$30.00”, “Método: Efectivo”, “pey confirmó este pago”. No menciona los **$60 de fiado**. Es decir: un pedido con fiado aparece como pagado, que es exactamente la verdad de pago que el gate debía eliminar.

La causa es `checkout-client.tsx:144-152`: `isCredit` exige `!data.payment`; como el pago en efectivo existe, `isPaid` gana y se salta el estado de fiado. La copia “pey confirmó” (`checkout-client.tsx:331`) tampoco distingue `cash`.

#### B1.3 · El demo reaparece como “Pagado” y con verde de éxito en la UI de la comerciante

Reproducción: pedido + link + `POST /api/demo/pay` (`method=codi`). Actividad de Caja:

```text
1 Cafe demo verdad
Pagado
$120.00
```

El icono de la fila tiene `bg-green-soft text-green` (`rgb(230,241,235)` / `rgb(11,107,79)`). Al abrir la fila, el sheet dice:

```text
Pedido pagado
Pago simulado · demo
Pedido pagado
$120.00
Pedido BA08 · simulado en modo demo
```

El checkout y el `PaidSheet` sí dicen “Pago simulado”, pero Actividad y el encabezado del sheet siguen usando el tratamiento de `paid`, con el verde reservado al pago real. Contradice 5.6 (“`demo` nunca usa `paid`”, verde solo para webhook) y 7 (“un estado nunca se muestra con el tratamiento de otro”). Evidencia: `demo-activity-row.png` y `demo-sheet.png`.

Causa visible: `ActivityList` (`caja-app.tsx:2907-2944`) usa `order.status`/`creditCents` y no `lastPaymentProvider`; `PaymentPanel` (`1582`) escribe “Pedido pagado” también cuando `demo` es verdadero.

**Veredicto de B1:** reparación parcial. Los tres casos que el implementador enumeró pasan, pero efectivo y demo siguen mintiendo en la UI principal. Es bloqueante porque toca la verdad del dinero y el contrato central.

---

### B2 · La trampa de foco sigue escapándose con `Shift+Tab`; el backdrop pierde el foco

#### B2.1 · `Shift+Tab` escapa del diálogo

Reproducción mínima y reproducible (probada a 360×800 y 1280×800):

1. Caja → “Abrir guía” (foco inicial en el `H2` “Guía”).
2. `Tab` → foco en “Cerrar”, dentro del diálogo.
3. `Shift+Tab` → foco **fuera** del diálogo.

Resultado medido:

- **360:** `document.activeElement` = `BUTTON "Meta"` (tab bar de fondo), `inDialog=false`.
- **1280:** `document.activeElement` = `A "Fotos: créditos"` (footer de fondo), `inDialog=false`.

Se repitió en **Guía, Cobro, Fiado, Verificar y confirmación de Corte**, a 360 y 1280: **10/10 fallos de `Shift+Tab`**. El `Tab` hacia adelante sí se queda dentro en las 10 combinaciones; el `Escape` sí cierra y devuelve el foco correctamente.

Causa visible: `Sheet` (`caja-app.tsx:3684-3717`) arma la lista `[titleRef, ...nodes]`. El título tiene `tabIndex={-1}` (`3764`) y es el “first” lógico, pero no es el primer elemento en el orden natural de Tab. El primer tabbable real es el botón “Cerrar” (`3769`). Al llegar a “Cerrar” y pulsar `Shift+Tab`, el navegador va al tabbable anterior del documento (fondo); la condición `document.activeElement === first` no se cumple porque `first` es el título. No hay `inert` en el fondo.

#### B2.2 · El backdrop cierra, pero deja el foco en `BODY`

Reproducción: abrir cualquiera de los sheets y hacer click en el backdrop en `(4,4)`.

Resultado: el diálogo desaparece (`[role=dialog]` count = 0), pero:

- Guía: `document.activeElement` = `BODY`; no vuelve a “Abrir guía”.
- Cobro: `BODY`; no vuelve a la fila.
- Fiado: `BODY`; no vuelve a “Registrar abono”.
- Verificar: `BODY`; no vuelve a “Verificar”.
- Corte confirmación: `BODY`; no vuelve a “Guardar corte”.

Ocurre igual a 360 y 1280. El `Escape` sí devuelve al disparador (o al `h1` con `data-sheet-fallback` en Cobro).

Causa probable: el `onMouseDown` del backdrop (`3746-3748`) dispara `onClose`; el cleanup del efecto intenta enfocar el disparador (`3726-3737`), pero el comportamiento por defecto del `mousedown`/click sobre el overlay vuelve a enfocar `BODY` después. No se probó la corrección propuesta; solo se documenta el resultado observado.

**Veredicto de B2:** el bloqueante anterior sigue abierto. No es un detalle de teclado: impide navegar el diálogo con `Shift+Tab` y pierde el foco al cerrar con backdrop.

---

### B3 · El 200% sigue roto en móvil, incluidos los sheets

No hay scroll horizontal del documento ni viewport de layout expandido: el contenido roto queda **recortado** por `overflow-hidden`. Por eso el audit oficial puede salir 0 mientras la pantalla está mal. Matriz de lo observado:

| Estado al 200% | 360×800 | 390×844 | 768×1024 | 1280×800 |
|---|---|---|---|---|
| Caja (home) | pasa | pasa | pasa* | pasa |
| Fiado | pasa | pasa | pasa | pasa |
| Corte | **falla** | **falla** | pasa* | pasa |
| Meta | pasa | pasa | pasa | pasa |
| Checkout total | **falla** | riesgo | pasa | pasa |
| Éxito | pasa | pasa | pasa | pasa |
| Guía / Demo / Fiado sheet / Corte confirmación / PaidSheet | pasa | pasa | pasa | pasa |
| Cobro (payment sheet) | **falla** | pasa | pasa | pasa |
| Cobro link / “Esperando al banco” | **falla** | **falla** | pasa | pasa |
| Verificar sheet | **falla** (Cerrar) | **falla** (Cerrar) | pasa | pasa |

\* A 768 el subtítulo del TopBar (“sábado, 31 de octubre”) se trunca con `.truncate`; es un menor, no el mismo problema.

#### B3.1 · Checkout 360: total de 80 px recortado

Medido en `/pay/{id}` a 360×800, `html { font-size: 200% }`:

- Total `$120.00`: `font-size=80px`, caja del `p` de `214px`, `scrollWidth=272px`.
- El `section` que lo contiene mide `32..328` y tiene `overflow-hidden`.
- El texto se extiende hasta `x=345`; se recortan ~17 px. En la captura se lee “$120.0”.
- A 390 el `p` mide 244 px y `scrollWidth=272`; desborda su caja, aunque la tarjeta llega a 358 y el texto termina en 345 (visible, pero frágil).
- A 768/1280 mide 80 px con 398/438 px de caja: pasa.

El contrato 6.3 exige “200% sin cortar total”. **No se cumple a 360.** Evidencia: `checkout-360-200-full.png` y `checkout-360-200-viewport.png`.

#### B3.2 · Payment sheet 360: QR y “Esperando al banco” recortados

- El texto del tile “QR CoDi directo / Solo transferencia CoDi” tiene `right=371` en un viewport de 360; el último fragmento queda cortado por el `overflow-hidden` del sheet. Evidencia: `cobro-qr-360-200.png`.
- El badge “ESPERANDO AL BANCO” mide **389 px de ancho** en un viewport de 360 (y también desborda a 390): `boundingBox` 388.65; se lee “ESPERANDO AL BANC…”. El contenido de la izquierda se desplaza y se corta: “Pedido” aparece como “edido”, el monto queda pegado al borde. Evidencia: `cobro-waiting-360-200.png`.
- El encabezado “Cobro · Pedido” + `StatusBadge` se comprime a una columna de ~30 px: el texto se parte en “Co.” y “Pedido”. Es el mismo `StatusBadge` con `whitespace-nowrap` (`caja-app.tsx:3431`).
- A 768/1280 el mismo sheet pasa.

#### B3.3 · Verificar 360/390: el botón Cerrar queda fuera de pantalla

Medido a 360 al 200%:

- Botón `aria-label="Cerrar"`: `width=88`, `left=321`, `right=409`; el viewport termina en 360. Queda 49 px fuera y el icono no se ve completo (captura `verificar-360-200.png`).
- `dialog.scrollWidth=408` vs `clientWidth=358`; el sheet oculta la parte que sobra con `overflow-hidden`.
- A 390 el botón sigue llegando a `right=409` (>390) y el diálogo mide 408 vs 388.
- A 768/1280 pasa.

Es una acción esencial perdida al 200%, no solo estética. El título largo “Verificar comprobante” no tiene `min-w-0` y empuja al botón de 88 px (`h-11 w-11` = 44 px × 2).

#### B3.4 · Corte 360/390: inputs colapsados y analítica ilegible

Medido a 360 y 390 al 200%:

- “Gastos de caja” y “Retiros”: inputs de **0 px de ancho a 360** y **11 px a 390** (alto 88). No son usables y no cumplen 44×44. A 768 miden 66 px; pasan el mínimo pero siguen estrechos.
- El total `$190.00` de la tarjeta de analítica mide 80 px, `right=345`, pero su tarjeta `relative overflow-hidden` termina en `327`: se recortan 18 px.
- Los valores de las columnas desbordan sus cajas: `$70.00` tiene `scrollWidth=126` y `clientWidth=82`; `$120.00` 149/83; `$95.00` 126/82; `$50.00` 126/83. En la captura completa se ve la analítica solapada/ilegible (“CobradoPor”, “De $120.0”, etc.).
- Las filas “Base inicial / Ventas en efectivo / Abonos de fiado” se aprietan y sus valores se montan sobre las etiquetas.
- A 768/1280 el Corte pasa (salvo el truncado del TopBar a 768).

Evidencia: `corte-360-200-full.png`, `corte-390-200-full.png`.

**Veredicto de B3:** el 200% no está resuelto. El audit de 0 no es prueba: mide solo algunos estados y su detector no ve el recorte por ancestro.

---

## 4 · Mayores

### M1 · El audit oficial no detecta los fallos que deja pasar

El **gate lógico** sí funciona. Inyectando registros sintéticos en `main()` (sin tocar el código) se comprobó que sale 1 para cada categoría:

```text
axe-serious: exit=1
overflow: exit=1
viewport-expanded: exit=1
clipping: exit=1
overlap: exit=1
under44: exit=1
clean: exit=0
```

Pero la **medición** tiene puntos ciegos:

- `measure()` no detecta recorte parcial por un ancestro con `overflow:hidden`. En una página inyectada con un `div` de 120 px que contiene un texto de 300 px, devolvió `clippedCount=0`.
- En la pantalla real **Corte 360 al 200%**, `audit.measure()` devolvió:
  `clippedCount=0`, `overlapCount=0`, `under44Count=0`, `under17Count=0`, `documentScrollWidth=360`.
  La captura completa de esa misma pantalla muestra inputs de 0 px y analítica cortada/solapada.
- Solo cuenta solapes entre elementos interactivos (`button, a[href], input, select, textarea`), no solapes/desbordes de texto.
- `under44` filtra `width > 2`; los inputs de 0 px de Corte 360 quedan fuera del conteo.
- El 200% de sheets no se prueba en absoluto. El script solo aplica 200% a home, tabs en `full_flow` y checkout/éxito; `full_flow` solo corre a 360 y 1280 (`hig-after-audit.py:383`). Por eso no vio los sheets rotos a 390.
- El audit oficial terminó con **0 fallos** en esta misma app. Es un falso negativo estructural, no solo un número de hoy.

**Consecuencia:** `python scripts/hig-after-audit.py` no puede ser el gate de F4 hasta que detecte recorte por ancestro, controles colapsados y texto desbordado, y pruebe sheets al 200% en 360/390/768/1280.

### M2 · Fiado digital: el checkout oculta la parte fiada

Un pedido de $90 con $30 a fiado y $60 digitales, pagado por demo, devuelve `status=fulfilled`, `creditCents=3000` y `payment.amountCents=6000`. `/pay/{id}` muestra “Pago simulado · demo”, “Pago simulado”, “$60.00”, método CoDi, y **no menciona los $30 de fiado**. El abono no es dinero recibido y la pantalla de éxito no lo explica.

No es el fiado puro (ese sí pasa), pero sigue siendo un estado de fiado presentado sin su saldo. Debería ser un estado mixto o “Quedó anotado” con el saldo pendiente.

### M3 · El sheet de Fiado pierde datos sin confirmación

Contrato 5.4: “Si hay cambios sin guardar, confirmación explícita”. Reproducción:

1. Fiado → “Registrar abono”.
2. Escribir nota “nota sin guardar” y monto $10.
3. `Escape`.
4. Reabrir “Registrar abono”.

Resultado: el diálogo se cerró sin confirmación; la nota quedó vacía y el monto volvió a `50.00` (el saldo completo). El backdrop hace lo mismo. Es pérdida de captura en una tarea real; no es bloqueante del núcleo del gate, pero debe corregirse antes de F4.

---

## 5 · Menores

- **Subtítulos de pantalla a 13 px.** `ScreenHeading` usa `text-[0.8125rem]` (`caja-app.tsx:3475`) en Caja, Fiado, Corte, Meta y Verificar. El contrato 6.1 pide la línea de contexto de Caja a 15 px; el body 17 sí está bien.
- **TopBar a 768/200%:** “sábado, 31 de octubre” se trunca por `.truncate` (`caja-app.tsx:3584-3586`). Es secundario, pero el contrato solo permite `truncate` para IDs/links.
- **Meta:** la foto sigue dentro de la tarjeta de progreso (`caja-app.tsx:2617-2627`), aunque el contrato 6.6 la pide fuera de la tarjeta. El estado sin meta tampoco tiene una acción.
- **`aria-busy`:** el botón de pago del checkout y el de “Listo para entregar” cambian el label a “Simulando…”/“Entregando…”, pero no exponen `aria-busy` (el contrato 5.1 lo pide).
- **Corte:** el `h1` visible es “Corte”, no “Corte de caja” (la tarjeta sí dice “Corte de caja”).
- **Body:** `body` tiene `line-height:1.45` (24.65 px con 17 px), no 24 exacto; el token `text-sm` sí es 17/24. No afecta el gate.

---

## 6 · Lo que sí pasa (verificado por mí)

- **Entrega:** “Listo para entregar” llama `PATCH /api/orders/{id}` con `{action:"fulfill"}`; la orden pasa `paid → fulfilled`; el sheet cierra; el foco vuelve a la fila de Actividad. `PATCH` rechaza una orden `confirmed` con 409 y es idempotente en `fulfilled`.
- **Éxito del checkout:** el `h1` recibe foco; la tarjeta es `role=status` con `aria-live=polite`; el checkout y `/success` distinguen real/demo correctamente (demo dice “Pago simulado”; webhook dice “Pago confirmado”).
- **Fiado puro:** nunca aparece como pagado; checkout “Quedó anotado”; el sheet no muestra “Pago simulado/verificado”; no hay payment.
- **Webhook firmado en demo:** provider `pey`; UI “Pago verificado” / “Pago confirmado”; no simulado.
- **Demo pay:** provider `demo`; checkout y `PaidSheet` “Pago simulado”; **la excepción es Actividad/encabezado del sheet, ver B1.3**.
- **Foco:** foco inicial en el título; `Tab` hacia adelante se queda dentro en los 5 sheets; `Escape` cierra y devuelve al disparador o al `h1` de respaldo; el disparador deshabilitado de Cobro cae correctamente al `h1`.
- **Tabs:** Meta conserva el valor “123” al ir y volver; Caja conserva `scrollY=600` (360).
- **Sidebar:** 767 oculta sidebar y muestra tab bar; 768 muestra sidebar de 220 y oculta tab bar; 1280 sidebar de 240.
- **Fiado:** sheet con monto, método efectivo/digital y nota; el abono no crea una orden nueva (15→15), actualiza el saldo mostrado y persiste `amount_cents=1000`, `method=codi`, `note="nota e2e verificador"` en `credit_payments`.
- **Corte normal:** task-first, “Falta/Sobra”, confirmación con diferencia, aviso durable `role=status`, persistencia en `/api/cash/close`; denominaciones de 44 px; disclosure con `aria-expanded`/`aria-controls`.
- **Errores inline:** venta (“Para fiado necesito el nombre del cliente”, foco al campo y `aria-invalid`), voz (permiso denegado, `role=alert`, muestra campo de texto) y verificación (fallo de red, `role=alert`, foco al banner). No son toasts.
- **Verificar:** “Probar con un comprobante falso” mueve el foco al resultado `role=alert` y dice “No entregues el pedido.”
- **Checkout:** total `40 px` normal y `80 px` al 200% en 360/390/768/1280 (el tamaño pasa; el recorte a 360 es B3.1). Redirección real a `order.paymentUrl` implementada en `checkout-client.tsx:181-188` (no ejecutable en demo; ver §7).
- **Normal:** sin scroll horizontal, targets ≥44 px en las pantallas/sheets normales, axe serio/crítico 0 en las pantallas y sheets probados; el audit oficial reporta axe 0.
- **Lint/tsc/webhook:** limpios, 27/27.

---

## 7 · Lo que no pude probar

- **Pago real de $0.01 / `DEMO_MODE=false` / redirect real a pey en runtime.** El código de redirección está implementado y el commit lo incluye, pero no se puede ejecutar sin modo real. El banco sigue bloqueando el pago; no se tocó `DEMO_MODE`.
- **`npm run build`** no se volvió a ejecutar para no interrumpir el dev server de 3001. No verifico de forma independiente el build del implementador; sí `lint` y `tsc`.
- **Teléfono físico 360, iOS/Safari, Android, safe area física, VoiceOver/NVDA.** No se probaron.
- **Micrófono real/transcripción:** solo se probó el error de permiso denegado; no una transcripción real.
- **QR escaneado, `navigator.share` real, webhook real de pey, conciliación real, offline, CLS/LCP/Lighthouse.** No se probaron.
- **Estados de 200% no cubiertos por mi suite:** confirmación de reset de demo al 200%, algunos pasos intermedios de checkout/error y el detalle completo de todos los sheets a 390/768; sí se probaron los sheets principales y los cuatro viewports indicados.
- **La app de :3000** no se usó ni modificó; solo se comprobó que es otra carpeta/proceso.

---

## 8 · Artefactos

- Informe del audit oficial regenerado: `demo/hig-after/audit.json` (0 fallos; falso negativo documentado).
- Resultados propios en `C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\mc-verify-f3\`:
  - `truth-results.json`, `focus-results.json`, `zoom-results.json`, `contract-results.json`, `gate-results.json`, `measure-injected.json`.
  - Capturas: `checkout-360-200-full.png`, `checkout-360-200-viewport.png`, `cobro-qr-360-200.png`, `cobro-waiting-360-200.png`, `verificar-360-200.png`, `corte-360-200-full.png`, `corte-390-200-full.png`, `cash-sheet.png`, `demo-activity-row.png`, `demo-sheet.png`, `sale-error-360.png`, `voice-error-360.png`, `verify-fake-360.png`.
- No se modificó ningún archivo de implementación (`src`, API, libs, CSS, scripts). Ejecutar el audit regeneró artefactos en `demo/hig-after/` (ignorados por git); el único archivo versionable añadido por esta verificación es este informe.

**Conclusión: NO LISTO para F4.** Se puede volver a verificar en cuanto se corrijan B1 (efectivo/demo), B2 (trampa completa y backdrop) y B3 (200% móvil y sheets), y se endurezca el audit para que mida esos casos.
