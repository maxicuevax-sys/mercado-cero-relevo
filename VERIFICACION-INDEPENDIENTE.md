# Verificación independiente — F3 en curso

> Ejecutada por un agente distinto al implementador el **31 de octubre de 2026**.
> Alcance: worktree `mercado-cero-hig` (rama `hig-redesign`), servidor `http://localhost:3001`.
> Modo: solo lectura de código; sí puede ejecutar pruebas y resetear la demo. No edita archivos.
> Conclusión: **NO LISTO para F4.**

---

## Veredicto

El shell, la Caja task-first y el flujo demo ya funcionan, pero la app todavía **miente sobre pagado/fiado/demo**, rompe **foco y 200%**, y no cumple el contrato de entrega. No hay gate para F4.

---

## Bloqueantes

### B1 · La UI confunde pago real, demo y fiado

- Un evento firmado de pey en modo demo devuelve `provider: pey` y `status: paid`, pero el sheet muestra **“Pago simulado · demo”**. Causa: `demo = demoMode && isPaid` en `caja-app.tsx:1415` y `demo = demoMode && !isCredit` en `caja-app.tsx:3371`; el checkout usa el flag global en `checkout-client.tsx:220` y `success-client.tsx:73`, no la fuente del pago.
- Pedido a fiado sin pago digital: `status: fulfilled`, `creditCents=9000`, `amountDueCents=0`; `/pay/{id}` muestra **“Pago simulado”** con método vacío. Causa: `isPaid = Boolean(payment) || amountDue <= 0` en `checkout-client.tsx:141-144`; `orders.ts:114` marca `fulfilled` cuando hay fiado.
- Actividad muestra el pedido fiado con **check verde y “Entregado”**, no como fiado (`caja-app.tsx:2639-2652`, `3005`, `3038`).

### B2 · El foco de los sheets no está atrapado y no vuelve al disparador

- Con el foco inicial en el título, **`Shift+Tab` escapa a “Meta”**, detrás del diálogo. Medido en Guía y Cobro: `{text:"Meta", inDialog:false}`. El trap solo reacciona si el foco está en el primer/último focusable (`caja-app.tsx:3292-3300`), y el título tiene `tabIndex={-1}` (`3336`).
- Al cerrar el sheet de cobro, el foco queda en **`BODY`**, no en “Confirmar venta” ni en la fila del pedido. `createOrder` limpia el draft y deshabilita el botón (`caja-app.tsx:480-483`); el retorno usa `previousFocus.current?.focus()` (`3309`), que no funciona sobre un botón deshabilitado.
- El Tab hacia adelante sí queda dentro; Escape sí cierra; Guía sí devuelve el foco. El fallo es `Shift+Tab` y el retorno del cobro.

### B3 · El 200% rompe Caja a 1280

- Con `html { font-size:200% }`: inputs de efectivo y fiado miden **2 × 88 px**; textos de Actividad con `clientWidth` 10–26 px y `scrollWidth` 79–111 px; el `h1` mide 82 px para un texto de 102 px.
- Capturas: `demo/hig-after/home-1280-text200.png` y `home-200-verify.png`.
- Causa: columnas fijas `xl:grid-cols-[minmax(0,640px)_360px]` (`caja-app.tsx:712`), aside de 360 (`779`) y `ScreenHeading` sin wrap (`3054-3061`). El `scrollWidth` del documento pasa, pero el contenido está cortado/solapado.

### B4 · “Listo para entregar” no marca entregado

- Tras pulsarlo, el sheet cierra pero la orden sigue en **`paid`**, no `fulfilled`. `PaidSheet` solo hace `onClose={() => setPaidOverlay(null)}` (`caja-app.tsx:910-914`); el botón no llama a ninguna API (`3410-3415`). Contrato 6.2: “cierra y marca entregado”.
- Medido: `afterDeliverStatus: "paid"`.

### B5 · El éxito del checkout no se anuncia ni recibe foco

- Tras pagar en demo, `document.activeElement` es **`BODY`** y no hay `aria-live`, `role=status` ni `role=alert` en la pantalla de éxito (`checkout-client.tsx:219-291`). Contrato 9: “pago con aria-live/status”.
- El `PaidSheet` de la comerciante sí tiene `aria-live` (`3375`), pero el checkout público no.

---

## Mayores

- **Tipografía base de 14 px, no 17.** En 360, `under17Count=97/130`; 147 usos de `text-sm` (p. ej. `1028`); subtítulo de Caja 13 px (`3061`).
- **Los tabs no conservan estado ni scroll.** Campo de Meta “123” → `""` al volver; scroll 500 → 0. Render condicional en `caja-app.tsx:710-846`.
- **A 768 no hay sidebar.** Sidebar `lg:flex` (`3087`) y tab bar `lg:hidden` (`3213`); `lg=1024`. Contrato 10: sidebar 220 a 768.
- **Fiado no usa sheet.** “Registrar abono” abre fila inline (`fiadoDialogCount=0`; `caja-app.tsx:2760-2802`), siempre `method:"cash"` (`640-644`), sin selector efectivo/digital ni nota.
- **Corte no es task-first y guarda sin confirmar.** A 360 el primer viewport es analítica; el corte queda debajo (`caja-app.tsx:828-836`; `corte-360.png`). “Guardar corte” hace POST inmediato con diferencia (`2246-2254`) y solo muestra “Diferencia” (`2187-2207`), no “Falta/Sobra”.
- **Errores críticos siguen en toast.** Venta, voz y verificación usan `showToast` (`448-455`, `500-503`, `622-624`); dura 4 s (`161`), no 3 s.
- **axe serious en el sheet de cobro.** `color-contrast` 4.38:1 en “Por cobrar” (`#a6532f` sobre `#f4e5de`, `3021`) y 4.41:1 en “CoDi + tarjeta + wallets” (`text-white/75`, `1519`). También `landmark-unique` a 1280: dos `aside` sin nombre (`779`, `3087`).
- **Verificar no mueve el foco al resultado.** Tras “Probar con un comprobante falso”, el foco sigue en el botón, no en el resultado (`2870-2905`); el copy no incluye “No entregues el pedido”.
- **El total del checkout no escala a 200% en móvil.** 40 px → **43.2 px a 360** y **46.8 px a 390**; a 768/1280 sí llega a 80 px. `text-[min(2.5rem,12vw)]` (`checkout-client.tsx:328`).
- **El checkout real no completa el pago.** En modo no-demo lanza “Este prototipo no procesa pagos reales…” (`checkout-client.tsx:165-168`); no hay redirección a pey. No verificado en runtime.
- **Targets/ARIA incompletos:** inputs de denominaciones de Corte **39 px** (`2179`); refresh solo `title` (`2057`); disclosure sin `aria-expanded` (`2153`).

---

## Menores

- “Compartir link” solo copia (`1570-1577`), no comparte.
- QR de 192 px (`h-48 w-48`, `1556`) frente a 200 del contrato.
- Sheet `max-h-[92dvh]`/`max-w-lg` (512) frente a 90dvh/560 (`3328-3330`).
- Actividad muestra los 30 pedidos en scroll, sin “Ver todo” (`2619-2677`).
- Foto de Meta dentro de la tarjeta de progreso (`2352`); estado vacío sin acción (`2328-2337`).
- `success/page.tsx` conserva tokens viejos de papel (`13-16`); `globals.css` conserva `.grain`, `.receipt-edge`, `.stamp`, `.halftone`, `.pop`, `--color-yellow` (`32`, `102-345`), aunque no se usen en TSX.
- Copy “webhook/API key” en UI primaria: footer (`857`), `PaidSheet` (`3407`) y Reconcile (`2507`).
- Sin `aria-busy` en botones de carga; labels esenciales de 12 px; varios `primary` en Caja (mic, Interpretar, Confirmar).
- `hig-after-audit.py` termina 0 aunque haya `axe=1`; no detecta clipping/solapamiento, `Shift+Tab`, retorno de foco, `/success` ni sheets al 200%.
- `webhook-contract.mjs` apunta a **3000** por defecto (`scripts/webhook-contract.mjs:28`); sin `BASE_URL` da 22/27 contra otra base y resetea la demo de 3000.
- F3 sigue **sin commit**: 6 archivos modificados; `demo/hig-after`, `hig-after-audit.py`, `test-flow.py` sin trackear. `git diff` no toca `api/` ni `lib/`; no hay regresión de dinero en backend.

---

## Lo que sí está bien

- 4 destinos con `aria-current`.
- Caja task-first: mic 262–326, draft inicia 637 en 360×800.
- Sheet de cobro; bloque demo separado; reset de demo con confirmación.
- Papel retirado del TSX.
- Targets 44 en la mayoría; `h1` por pantalla; sin scroll horizontal normal.
- Lint/tsc limpios; contrato de webhook **27/27**; flujo demo completo 360/1280 sin errores de consola.

---

## Pruebas ejecutadas

- `git status`, `diff --stat`, `log`: rama `hig-redesign`; 6 archivos UI modificados; sin cambios en `api/lib`.
- `npm run lint` → pass; `npx tsc --noEmit` → pass.
- `BASE_URL=http://localhost:3001 node scripts/webhook-contract.mjs` → **27/27**.
- `python scripts/hig-after-audit.py` → 55.5 s; 360/390/768 home axe 0; 1280 `landmark-unique`; sheet de cobro 2 violaciones serias de contraste; `under44=0` en home normal; Corte 43×44; el script sale 0 aunque haya axe/200% roto.
- Playwright propio: foco (`Shift+Tab` escapa), retorno a BODY, 200% 1280 (inputs 2 px, clipping), checkout 40→43.2/46.8 px, fiado mostrado como pagado, webhook real mostrado como demo, “Listo para entregar” sin cambiar estado, tabs sin estado/scroll, Fiado inline, Corte sin confirmación y 39 px.
- Revisión visual: capturas en `demo/hig-after/` y `Temp\opencode\mc-verify\`.

**NO ejecutadas:** `npm run build` (para no interrumpir 3001); modo real `DEMO_MODE=false` y pago real; micrófono/transcripción y persistencia de mute; VoiceOver/NVDA, Safari/iOS, Android, safe area física; 200% de sheets/paid/help/corte/meta; Lighthouse/CLS/LCP; QR directo; flujo completo de teclado por todos los destinos; persona real.

---

## Próximos pasos, en orden

1. **Verdad del pago:** exponer `provider`/`demo` por pedido y pago; no inferir demo del flag global; tratar `fulfilled` con fiado como **Fiado/attention**; checkout con estado “Fiado”, nunca “Pagado” por `amountDue<=0`. E2E de fiado, webhook real en demo y demo pay con `DEMO_MODE=false`.
2. **Contrato de sheet:** trap real incluyendo el título y `inert` en el fondo; capturar un disparador que siga enfocable o enfocar la fila del pedido; probar `Shift+Tab`, Tab, Escape, backdrop y retorno en Guía, Cobro, Verificar y Demo.
3. **Reflujo 200% real:** quitar columnas fijas en Caja, permitir wrap del `h1`/acción, ancho mínimo de efectivo/fiado y reflujo de Actividad; ampliar el audit para detectar intersecciones y clipping.
4. **Checkout/entrega:** `h1` “Pago confirmado” solo real y “Pago simulado” solo demo; `aria-live`/foco al cambiar a éxito; “Listo para entregar” debe llamar a una transición `fulfilled`.
5. **Barrido de contrato:** body 17, contraste 4.5, 44 px en denominaciones, `aria-label`/`aria-expanded`, errores inline, Fiado como sheet, confirmación de Corte, sidebar a 768, copy sin "webhook", limpieza de CSS de papel.

---

## Estado tras las reparaciones — 31 de octubre de 2026

> Sección escrita por el implementador. **No sustituye la verificación independiente**: el veredicto vigente sigue siendo **NO LISTO para F4** hasta que un agente distinto repita la revisión sobre este commit.

### Bloqueantes reparados

- **B1 · Verdad del pago.** `Order.lastPaymentProvider` sale de `payments.provider`; demo se deriva del pago (`provider === "demo"`), no del flag global. Fiado (`fulfilled` con `creditCents > 0`) se muestra como **Fiado/Quedó anotado**, nunca como pagado. Un webhook firmado en demo muestra **Pago verificado**. Verificado con E2E: fiado, webhook real y `/pay/[id]` de ambos.
- **B2 · Foco de sheets.** El título entra en la trampa (`Shift+Tab` ya no escapa), Escape cierra, y el retorno usa el disparador o el `h1` de respaldo cuando el disparador quedó deshabilitado. Verificado en Guía, Cobro, Fiado, Verificar y confirmación de Corte.
- **B3 · 200%.** Caja usa container query y pista de campos de una columna; se eliminaron anchos fijos que expandían el viewport de layout. El audit mide `innerWidth` contra `visualViewport` y detecta viewport expandido, clipping, solapes y texto recortado. **360/390/768/1280 y 200% pasan.**
- **B4 · Entrega.** “Listo para entregar” llama `PATCH /api/orders/[id]` con `{action:"fulfill"}`; la orden pasa `paid → fulfilled`, el sheet cierra y el foco vuelve al `h1`. Verificado.
- **B5 · Éxito del checkout.** El `h1` de éxito recibe foco y la tarjeta es `role="status"` + `aria-live="polite"`; también en `/success`.

### Mayores reparados

- **Body 17/24:** tokens `--text-sm` 17/24 y `--text-xs` 13/18; el texto principal ya no usa 14.
- **Tabs:** las cuatro pantallas quedan montadas; conservan estado local y scroll por destino. Probado con el campo de Meta y scroll.
- **Sidebar a 768:** `md:flex`, contenido con `md:pl-[220px]` y tab bar solo bajo 768.
- **Fiado:** hoja real con monto, método efectivo/digital y nota; la nota se persiste en `credit_payments.note` (migración segura). El abono no crea venta.
- **Corte:** conteo primero, banner **Falta/Sobra/Cuadra**, desglose debajo, guardado con confirmación cuando hay diferencia, aviso durable y denominaciones de 44 px. Disclosure con `aria-expanded`/`aria-controls`; refresh con `aria-label`.
- **Errores inline:** venta (incluido “Para fiado necesito el nombre del cliente” con foco al campo), voz y verificación usan banner `role="alert"`; el toast queda solo para avisos no críticos y dura 3 s.
- **Contraste:** `--color-attention` #9C4E2B (4.84:1 sobre terracotta-soft) y subtítulo del link a `text-white/90`. Axe serio = 0 en los cuatro viewports.
- **Verificar:** el resultado recibe foco y el caso no verificado dice “No entregues el pedido.”
- **Checkout:** total 40 → 80 px al 200%; en modo real redirige a `order.paymentUrl` en lugar de lanzar; copy sin “webhook” en UI primaria.
- **Menores:** compartir con `navigator.share` y fallback a copiar; QR 200 px; sheet 90dvh/560; Actividad con “Ver todo”; tokens de papel retirados; `webhook-contract.mjs` toma `BASE_URL`, luego `APP_URL` de `.env.local`.

### Evidencia ejecutada (implementador)

- `python scripts/hig-after-audit.py` → **PASÓ**: 360/390/768/1280, axe 0, `under44=0`, 200% en Caja/Fiado/Corte/Meta/checkout/éxito, sin overflow, clipping ni solapes; el script ahora sale distinto de 0 si falla.
- `BASE_URL=http://localhost:3001 node scripts/webhook-contract.mjs` → **27/27**.
- `npm run lint`, `npx tsc --noEmit`, `npm run build` → limpios.
- Playwright propio: foco y 200% de Guía/Cobro/Fiado/Corte; verdad de pago; entrega `paid→fulfilled`; tabs con estado/scroll; sidebar 768; error inline de fiado con foco.

### Pendiente antes de F4

1. **Re-verificación independiente** de este commit (obligatoria).
2. Pago real de $0.01 por pey/CoDi: sigue bloqueado por BBVA/CoDi; el redirect real está implementado pero **no probado en runtime**.
3. Validación en teléfono físico de 360 px y prueba con persona desconocida.
4. Regenerar video/QR y revalidar la demo completa solo después del merge.

---

## Segunda ronda tras la verificación independiente

> El verificador independiente revisó el commit `efb8145` y emitió **NO LISTO** en `VERIFICACION-F3-FINAL.md` (B1 efectivo/demo, B2 foco, B3 200% móvil, M1 audit falso negativo, M2 fiado digital, M3 pérdida de datos en Fiado). Esta sección documenta la segunda reparación; **tampoco sustituye** una nueva verificación independiente.

### Correcciones de la segunda ronda

- **B1:** `paymentTruth()` distingue efectivo, demo, pey y fiado. Efectivo dice “Efectivo recibido / cobrado en caja”, demo dice “Pago simulado” también en Actividad y encabezado, y los mixtos muestran recibido + saldo fiado. `lastPaymentProvider` prioriza el pago digital y el checkout ya no trata efectivo como pago pey.
- **B2:** la trampa de foco intercepta todos los `Tab`/`Shift+Tab` con índice explícito; el backdrop hace `preventDefault` y devuelve el foco al disparador o al `h1` de respaldo.
- **B3:** checkout con padding físico, total 80 px sin recorte; badge y tiles del cobro con wrap; encabezado del sheet con `min-w-0`; Corte apilado, inputs de 172 px y analítica sin clipping; Meta apilado.
- **M1:** el audit ahora detecta `text-overflow`, `collapsed-control`, `ancestor-clip` (respetando scroll y `.truncate`) y mide sheets al 200% en 360/390/768/1280.
- **M2:** el checkout mixto digital+fiado muestra “Recibiste $X … + $Y a fiado”.
- **M3:** cerrar el sheet de Fiado con cambios pide confirmación explícita (“Seguir editando / Descartar abono”).
- **Menores:** subtítulos a 15 px, `line-height: 24px`, TopBar con wrap, `h1` “Corte de caja”, `aria-busy` en pago/entrega/apartar, foto de Meta fuera de la tarjeta de progreso.

### Evidencia de la segunda ronda

- `python scripts/hig-after-audit.py` → **PASÓ** con los nuevos detectores y sheets 200%.
- Regresión propia: verdad efectivo/demo/mixto, foco en 5 sheets (Tab, Shift+Tab, backdrop, retorno), Fiado con descarte, checkout 80 px, Corte 200%, todo en verde.
- `npm run lint`, `npx tsc --noEmit`, `npm run build` → limpios.
- `BASE_URL=http://localhost:3001 node scripts/webhook-contract.mjs` → **27/27**.

**Pendiente:** nueva verificación independiente de este segundo commit. No hay gate F4 hasta que pase.
