# Auditoría de carga cognitiva — Mercado Cero

> **Código auditado:** `499a30175844f33ab3ffbc7863b0bc58eb2364c2` (`p0/cognitive-audit`).
> **Contrato:** `docs/CARGA-COGNITIVA.md`.
> **Línea base histórica:** `AUDITORIA-COGNITIVA.md` (snapshot `26d06ce`, 1 nov 2026) y `GOAL-ACOMPANAMIENTO.md`.
> **Método:** lectura del código de `web/src`, de las rutas API y de los scripts E2E existentes; `npm ci`; `npm run verify:fast` (3/3); `npm run test:voice` (17/17); `npm run test:harness` (48/48); `npm run lint`; `npx tsc --noEmit`.
> **No ejecutado:** `npm run build`, `verify:full`, los E2E Playwright, pey real, TalkBack/VoiceOver, teléfono físico, estudio con comerciantes.
> **Límite:** esta es una auditoría estructural y de copy. No mide carga percibida, tiempos humanos ni comprensión real. No reemplaza una prueba con personas.

---

## 0 · Veredicto corto

La app **ya no está en el punto del snapshot `26d06ce`**. En `499a301` están implementados P0-A (venta manual y cambio), P0-B (borrador durable), P0-C (abono confirmado), P0-D (corte versionado), P0-E (cobros pendientes visibles), P0-F (shell/errores, al menos en automatizado) y P0-G (bandeja de Pendientes). Decir que “la venta depende de la IA” o que “el corte se pisa” sería repetir un veredicto viejo.

Lo que **sí sigue faltando** es el contrato de acompañamiento en su parte más humana y más peligrosa para la demo:

1. No existe **“Antes de cerrar”** como momento que reúna pendientes de hoy y cobros por confirmar con acción o “ahora no”.
2. La **verdad de los estados de pago** no es una sola: “Pagado”, “Pago verificado”, “Pago confirmado”, “Pago demo” y “Listo para entregar” conviven; el demo ofrece una entrega que el servidor rechaza.
3. Las cifras **“Hoy”**, **“Por cobrar”** y **“Cobrado”** no significan lo mismo en Caja, en la franja de cobros y en el reporte.
4. La pantalla pública de éxito afirma **“Tu pago ya salió del banco”** sin evento verificado y pide **“No cierres esta pantalla”**.
5. No existen preferencias de acompañamiento, recomendaciones explicables, operación sin conexión ni exportación.

**No se puede afirmar que el contrato esté completo.** La demo puede mostrar los flujos base; no puede prometer “cierre acompañado”, “sin IA” en consultas, “sin conexión” ni “recomendaciones”.

---

## 1 · Inventario de flujos reales

Todos los archivos citados están bajo `web/`. Los números de línea corresponden a `499a301`. No se levantó la app en este worktree, así que los pasos se reconstruyeron del código y de los E2E existentes.

### 1.1 · Caja / venta

- **Archivos:** `web/src/components/caja-app.tsx:2936-3627` (panel de Caja), `:1487-1582` (interpretación), `:1772-1897` (crear venta), `web/src/app/api/orders/route.ts:72-102`, `web/src/lib/orders.ts:73-323`.
- **Pasos:** dictar o escribir una frase → `/api/voice/parse` o “Agregar producto” → editar productos, cantidades y precios → escribir efectivo recibido y/o fiado → confirmar cliente si hay fiado → pulsar “Cobrar” → la app crea la orden y abre el cobro o el resultado.
- **Campos:** producto, cantidad, precio unitario, efectivo recibido, monto a fiado, nombre de quien queda a deber. No hay campo de “método” en la venta: el método se deduce de efectivo/fiado/saldo digital.
- **Decisiones:** usar voz o mano; cuántos productos; cuánto efectivo y cuánto fiado; si el saldo digital se cobra con link/QR; confirmar o limpiar.
- **Estados:** hoja vacía, borrador con ítems, guardando, error inline, orden `confirmed` con saldo digital, orden `paid` por efectivo, orden con fiado, orden mixta, cobro pendiente.
- **Errores:** parser 500 (“No pude interpretar…” y “Escribir productos”), micrófono denegado, audio vacío, ítem sin descripción/cantidad/precio, fiado mayor al total, fiado sin cliente, 502 del POST con reintento idempotente.
- **IA/red:** la interpretación puede usar OpenAI; la venta manual no la necesita. Crear la orden sí requiere red y servidor.
- **Prueba existente:** `web/scripts/p0-venta-e2e.py:159` (parser 500 + venta manual), `:425` (cambio $100/$90), `:402` (doble tap), `:343-356` (502 post-commit y misma `requestId`).

### 1.2 · Venta manual

- **Archivos:** `caja-app.tsx:3029-3038` (“Agregar producto”), `:3513-3527` (estado vacío con botón), `:1586-1589` (sin micrófono → escribir), `:1626-1627` (transcripción fallida → escribir), `:1512-1528` (abono por voz no escribe).
- **Pasos:** “Agregar producto” → llenar producto/cantidad/precio → repetir → efectivo/fiado → “Cobrar”.
- **Campos:** los mismos de 1.1, sin audio ni transcripción.
- **Decisiones:** qué producto y precio; si se cobra todo en efectivo, se fía o queda saldo digital.
- **Estados:** vacío, con ítems, error por ítem, guardando, orden creada.
- **Errores:** validación inline con foco en el primer campo inválido; el servidor valida de nuevo.
- **IA/red:** no depende de IA para capturar; sí de red para crear la orden.
- **Prueba existente:** `p0-venta-e2e.py:159`; el flujo manual también se usa en todos los casos de `p0-venta-e2e.py`.

### 1.3 · Voz / IA

- **Archivos:** `caja-app.tsx:1584-1657` (grabación), `:1487-1582` (interpretación y consultas), `web/src/lib/voice.ts:34-93` (transcripción y parser OpenAI), `web/src/lib/voice-local.ts:121-218` (parser local), `web/src/app/api/voice/transcribe/route.ts`, `web/src/app/api/voice/parse/route.ts`, `caja-app.tsx:1249-1339` (TTS).
- **Pasos:** mantener presionado el micrófono → se sube audio → se transcribe → se interpreta la intención (`sale`, `query`, `credit_payment`, `unknown`) → la app prellena o responde; el usuario confirma.
- **Campos:** audio, transcripción, ítems interpretados, efectivo/fiado, cliente, consulta.
- **Decisiones:** hablar o escribir; aceptar el parseo; confirmar el cobro; en abono, elegir la deuda y el método.
- **Estados:** grabando, transcribiendo, interpretando, error, transcript mostrado, venta prellenada, consulta respondida.
- **Errores:** permiso de micrófono, audio vacío, 500 de transcripción/parseo, TTS sin audio (silencio y texto), consulta no entendida.
- **IA/red:** OpenAI es opcional para el parser local si no hay `OPENAI_API_KEY`; si hay clave y la API falla, no hay fallback local para el parseo. La transcripción y el TTS dinámico requieren red.
- **Privacidad:** el audio se envía a OpenAI (`caja-app.tsx:1617`, `voice.ts:34-48`) y no hay aviso de privacidad/consentimiento más allá del permiso del navegador y el pie “pey + OpenAI” (`caja-app.tsx:2655`).
- **Prueba existente:** `p0-venta-e2e.py:154` (frase de muestra), `p0-integracion-e2e.py` (consultas de deuda y abono por voz); no hay prueba de consulta con `/api/voice/parse` caído.

### 1.4 · Fiado

- **Archivos:** `caja-app.tsx:1465-1485` (abrir hoja), `:1510-1543` (voz solo propone), `:2051-2153` (`payCredit`), `:6214-6341` (libreta), `:6348-6602` (hoja de abono), `web/src/lib/orders.ts:742-915` (idempotencia y saldo), `web/src/app/api/credits/[id]/pay/route.ts`.
- **Pasos:** entrar a Fiado o decir “Juan me pagó 50” → si hay una deuda, se abre la hoja con saldo vivo y monto → elegir método → confirmar “Registrar abono” → se aplica el monto y se muestra el saldo nuevo.
- **Campos:** cliente (desde la deuda), monto del abono, método (efectivo/digital/tarjeta), nota opcional.
- **Decisiones:** qué deuda; cuánto se aplica; qué método; si el excedente se devuelve.
- **Estados:** abierto, parcial, saldado; hoja limpia/sucia; confirmando; 409 por saldo cambiado/saldado; duplicado.
- **Errores:** monto 0, sin método, deuda ya saldada, saldo cambiado, `request_id_conflict`, respuesta perdida (reintento idempotente).
- **IA/red:** la voz es opcional; la libreta y la hoja funcionan sin IA. El POST requiere red.
- **Prueba existente:** `p0-fiado-e2e.py:332` (saldo vivo), `:344` (chip no escribe), `:465` (doble clic), `:589` (voz prellena), `:823` (reintento duplicado).

### 1.5 · Cobro pendiente

- **Archivos:** `web/src/components/pending-payments.tsx:86-244` (franja), `caja-app.tsx:2389-2410` (aviso compacto), `:2540-2550` (franja en el aside), `:1002-1044` (reanudar aviso durable), `:1960-2004` (polling de la hoja), `web/src/lib/db.ts:1283-1311` (pendientes de cualquier fecha), `caja-app.tsx:890-930` (refresh visible cada 45 s).
- **Pasos:** la Caja muestra “Cobros pendientes” → “Ver” abre el pedido → se genera link/QR o se simula el pago → la hoja espera la confirmación; si se cierra, el aviso durable ofrece “Continuar cobro” o “Descartar aviso”.
- **Campos:** ninguno propio; se usan los del cobro (link, QR, demo, verificación).
- **Decisiones:** abrir o no el pendiente; generar link/QR; esperar o cerrar; reanudar o descartar el aviso.
- **Estados:** `confirmed` (“Sin link”), `payment_pending` (“Esperando confirmación”), `partially_paid` (“Parcial”); “Última comprobación”; error de comprobación.
- **Errores:** dashboard caído (conserva filas y avisa), no hay link, pago que no llega, 409/404 de la orden, rate limit.
- **IA/red:** no usa IA. Requiere red; no hay cola offline.
- **Prueba existente:** `p0-integracion-e2e.py:475` (franja), `:482` (no abre hoja sola), `:502` (refresh por foco); `p0-venta-e2e.py:583-596` (aviso durable). El polling de 45 s no se espera en el E2E (KNOWN documentado).

### 1.6 · Checkout / success

- **Archivos:** `web/src/app/pay/[id]/page.tsx:21-29`, `web/src/app/pay/[id]/checkout-client.tsx:57-595`, `web/src/app/pay/[id]/success/success-client.tsx:17-471`, `web/src/lib/checkout.ts:53-119`, `web/src/app/api/checkout/[id]/route.ts`, `web/src/app/api/demo/pay/route.ts`, `web/src/app/api/webhooks/pey/route.ts:120-219`.
- **Pasos:** el comprador abre el link → ve comercio, folio, ítems y total → elige CoDi/tarjeta/wallet → en real se le redirige a pey; en demo se simula → la pantalla de éxito consulta el pago y muestra “Pago confirmado” o “Esperando”.
- **Campos:** método de pago; no pide datos de tarjeta.
- **Decisiones:** cómo pagar; esperar o cerrar; si mostrar el comprobante a la comerciante.
- **Estados:** link inexistente, link sin pago, pago pendiente, pago demo, pago verificado por pey, efectivo, fiado, mixto.
- **Errores:** cobro no encontrado (404), falta de link, pago que no llega, redirección a pey, webhook no recibido.
- **IA/red:** no usa IA. Depende de red y, en real, de pey.
- **Prueba existente:** `web/scripts/checkout-audit.py` (360/1280, demo, 404); `p0-dinero-e2e.py` (webhook, verify, demo). **No hay prueba de la pantalla de éxito de un pedido pendiente visitada directamente**, ni de que “Tu pago ya salió del banco” sea condicional.

### 1.7 · Corte

- **Archivos:** `caja-app.tsx:4614-5668` (`CashCloseCard`), `:4489-4611` (`CashCloseSummary`), `web/src/lib/cash.ts:200-492` (estado, preview, cierre versionado), `web/src/app/api/cash/route.ts`, `web/src/app/api/cash/preview/route.ts`, `web/src/app/api/cash/close/route.ts`.
- **Pasos:** abrir Corte → escribir total contado o contar por billetes/monedas → revisar base inicial, gastos y retiros → “Guardar corte” → el servidor calcula un preview → confirmar → se guarda una versión con snapshot; si ya había corte, se pide motivo y se crea otra versión.
- **Campos:** total contado, base inicial, gastos de caja, retiros, base para mañana, motivo de corrección.
- **Decisiones:** contar o escribir el total; qué gastos/retiros declarar; cuánto dejar de base; corregir o no; aceptar una diferencia.
- **Estados:** cargando, limpio, con cambios sin guardar, datos viejos (`stale`), preview, guardando, guardado, error, historial.
- **Errores:** contado vacío/0, base mayor que contado, esperado negativo, `reason_required`, `version_conflict` (409), `totals_changed` (409), JSON inválido, fallo de preview.
- **IA/red:** no usa IA; preview y guardado requieren red.
- **Prueba existente:** `p0-corte-e2e.py:891` (contado cero), `:1123` (resumen), `:1204` (retiro previo), `:1251` (versiones); 69 aserciones con nombre en el script.

### 1.8 · Meta

- **Archivos:** `caja-app.tsx:5670-5896` (`GoalCard`), `web/src/lib/goals.ts:56-230`, `web/src/app/api/goals/route.ts`, `web/src/app/api/goals/[id]/contribute/route.ts`.
- **Pasos:** abrir Meta → ver título, ahorro apartado, progreso y falta → escribir cuánto se apartó → “Apartar” → se suma al apartado declarado.
- **Campos:** monto a apartar; no hay formulario para crear meta en la UI.
- **Decisiones:** cuánto apartar; no hay decisión de plazo porque la meta viene sembrada.
- **Estados:** cargando, sin meta, con meta, aportando, error.
- **Errores:** meta no cargada, aporte 0, 500, meta inexistente.
- **IA/red:** no usa IA; requiere red.
- **Prueba existente:** `p0-shell-e2e.py` (error de meta y aporte), `p0-dinero-e2e.py` (meta demo); **no hay prueba de creación de meta** porque no hay UI. La API `POST /api/goals` existe (`web/src/app/api/goals/route.ts:21-45`), pero la persona no puede usarla.

### 1.9 · Pendientes

- **Archivos:** `web/src/components/pending-tasks.tsx:228-1187` (`PendingTasksPanel`), `web/src/lib/tasks.ts:182-334`, `web/src/app/api/tasks/route.ts`, `web/src/app/api/tasks/[id]/route.ts`, montaje en `caja-app.tsx:2643-2651`.
- **Pasos:** abrir Pendientes → “Anotar pendiente” → título, nota y fecha opcional → guardar → completar, posponer (más tarde hoy/mañana/en una semana/fecha), eliminar o reabrir.
- **Campos:** título (120), nota (500), fecha opcional; al posponer, fecha futura.
- **Decisiones:** qué recordar; para cuándo; completar/posponer/eliminar; reabrir.
- **Estados:** cargando, error, vacío, abiertos, hechas, ocupado, posponiendo, eligiendo fecha, confirmando eliminación.
- **Errores:** título vacío/largo, nota larga, fecha inválida/pasada, 404/409, red.
- **IA/red:** no usa IA; requiere red.
- **Prueba existente:** `p0-integracion-e2e.py:376` (crear), `:384` (completar), `:399` (posponer), `:425` (eliminar), `:919` (360/200). **No hay filtro “de hoy”** en el panel: `openTasks`/`doneTasks` no filtran por fecha (`pending-tasks.tsx:369-374`), y el corte no lo consume.

### 1.10 · Ayuda / accesibilidad

- **Archivos:** `caja-app.tsx:7474-7648` (`HelpContent`), `:7152-7293` (`Sheet` con foco atrapado), `:855-878` y `:1100-1146` (preferencias persistidas), `:1341-1351` (`readScreen`), `web/src/app/layout.tsx:61-68` (aplica texto/contraste antes del paint).
- **Pasos:** abrir Guía → ajustar tamaño de texto, contraste, velocidad de voz → “Leer esta pantalla” o “Repetir último aviso” → consultar FAQs fijas → cerrar.
- **Campos:** tamaño (normal/grande/muy grande), contraste, velocidad (lenta/normal/rápida).
- **Decisiones:** qué preferencia usar; no hay preferencia de acompañamiento ni de sugerencias.
- **Estados:** abierto/cerrado, opción seleccionada, foco atrapado; la preferencia se guarda en `localStorage`.
- **Errores:** no hay error de preferencia; si el TTS falla, queda el texto. “Leer esta pantalla” solo lee `h1`, `h2`, `role=status` y `role=alert` (`:1341-1351`), no toda la pantalla.
- **IA/red:** la guía es fija; la voz dinámica requiere red. No hay IA para ayuda.
- **Prueba existente:** `p0-shell-e2e.py:612` (skip link), `:753-755` (ayuda 1280/200), `:776-777` (verificar 360/200), `p0-shell-e2e.py:407-414` (Caja 360/200). **No hay prueba con lector de pantalla real, ni zoom de navegador real, ni 400 %.**

---

## 2 · Los doce principios del contrato

Estados: **Implementado** = la decisión existe y se puede señalar en código; **Parcial** = existe una parte, pero la decisión completa no se cumple; **Falta** = no existe.

| # | Principio | Estado | Evidencia | Por qué |
|---|---|---|---|---|
| 1 | Reconocimiento antes que memoria | **Parcial** | `caja-app.tsx:2551-2557` (actividad), `:6214-6341` (fiado); `voice-local.ts:5-18` (catálogo solo del parser) | Se reconocen operaciones y deudas recientes, pero no hay clientes ni productos recientes seleccionables: el nombre y el producto se siguen escribiendo. |
| 2 | Una tarea principal a la vez | **Parcial** | `caja-app.tsx:2357-2567` (Caja contiene venta, resumen, deuda, cobros y actividad) | La venta está primero, pero compite con “Cuánto llevo”, “Lo que me deben”, cobros pendientes y actividad en la misma pantalla. |
| 3 | Lenguaje del comerciante | **Parcial** | `caja-app.tsx:2853-2886` (“Cuánto llevo”, “Lo que me deben”), `:5024` (“Cuenta el efectivo”); `:5928` (“Conciliación”), `:4314` (“Digital verificado por pey”) | La mayor parte es familiar; “conciliación”, “verificado por pey” y “link” siguen siendo vocabulario del sistema, no del puesto. |
| 4 | Familiaridad cultural | **Implementado** | `caja-app.tsx:2853-2930` (libreta, fiado), `:5024` (corte), `:3557` (cambio), `:5844` (“Apartar”), `:5873-5875` (no es cuenta bancaria) | Libreta, fiado, cambio, corte y apartado están nombrados y explicados con el lenguaje del negocio. |
| 5 | Continuidad | **Implementado** | `caja-app.tsx:353-521` (draft/sale request en `localStorage`), `:932-1000` (restauración), `:1002-1044` (pendiente de cobro) | La venta y el cobro pendiente sobreviven a recarga; el conteo del corte no sobrevive a recargar (`P0-D-CORTE-REPORT.md:300-302`), pero el principio habla de la venta. |
| 6 | Prevención de errores | **Parcial** | `caja-app.tsx:535-555` (validación), `:3323-3352` (confirmar limpiar), `:6348-6602` (confirmar abono), `cash.ts:304-333` (preview del corte) | Hay buenas barreras, pero un parseo nuevo reemplaza el borrador actual sin confirmación (`caja-app.tsx:1546-1565`) y la UI no avisa del máximo de 50 ítems antes de enviar. |
| 7 | Recuperación | **Parcial** | `cash.ts:335-492` (versiones y motivo), `tasks.ts:319-333` (soft delete); no hay ruta para cancelar/corregir una venta (`orders.ts` no tiene `cancel`) | El corte y las tareas se recuperan con trazabilidad; una venta mal capturada no se puede corregir ni anular desde la app. |
| 8 | Complejidad progresiva | **Parcial** | `caja-app.tsx:3513-3527` (empezar por vender), `:7610-7613` (primeros pasos); `cash.ts` concentra gastos en el corte | No pide inventario ni costos, pero tampoco hay un onboarding gradual: los gastos solo aparecen al cerrar y la ayuda es un FAQ fijo. |
| 9 | Ayuda en contexto | **Parcial** | `caja-app.tsx:7504-7511` (FAQ fijo), `:6282-6285` (explicación al no haber fiado), `:2504-2509` (ayuda del micrófono) | Hay explicaciones y un botón de escucha, pero no aparecen junto al campo que las necesita (“A fiado”, “Corte”, “Pendiente”). |
| 10 | Preferencias estables | **Implementado** | `caja-app.tsx:855-878` y `:1100-1146` (texto, contraste, voz), `layout.tsx:61-68` (antes del paint) | Las preferencias existentes se guardan y no se infieren; faltan las preferencias de acompañamiento, que son otra deuda. |
| 11 | Funcionar sin IA | **Implementado** | `caja-app.tsx:3029-3038`, `:3513-3527` (venta manual), `:1586-1589`, `:1626-1627` (fallback); `p0-venta-e2e.py:159` | La venta manual existe y el E2E la prueba con `/api/voice/parse` en 500; la consulta local sí queda atada al parser (ver P1-4). |
| 12 | Salida e independencia | **Falta** | `caja-app.tsx:2653-2664` (pie con créditos, sin exportar); no hay `/api/export` ni botón de descarga | No se pueden exportar los registros; la app no ofrece una salida comprensible fuera de sus pantallas. |

---

## 3 · Las diez reglas innegociables

| # | Regla | Estado | Evidencia y texto marcado |
|---|---|---|---|
| 1 | No diagnosticar emociones | **Cumple** | No se encontraron cadenas de tristeza, fracaso, incompetencia ni diagnóstico. Los errores son funcionales (`caja-app.tsx:235-243`, `pending-tasks.tsx:203-211`). |
| 2 | No culpa, rachas, premios vacíos ni motivación genérica | **Cumple** | Los avisos son factuales (`caja-app.tsx:1869-1873`, `caja-app.tsx:4484-4486`); no hay rachas, “¡tú puedes!” ni recompensas. “Falta dinero en la caja” (`caja-app.tsx:5165`) es duro, pero no culpa a la persona; se propone neutralizarlo en copy. |
| 3 | No bloquear por IA o red | **Parcial** | La IA no bloquea la venta (`caja-app.tsx:3029-3038`; `p0-venta-e2e.py:159`). La red sí: crear venta, abonar, cerrar corte y tareas requieren `fetch` (`caja-app.tsx:1834-1838`, `:2077-2087`, `:4933-4943`; `pending-tasks.tsx:288-292`). No hay service worker ni cola local. |
| 4 | No confundir ventas con ganancias ni saldo disponible | **Parcial** | “Hoy” suma efectivo + verificado + declarado + demo + pendiente (`caja-app.tsx:2365-2372`); “Cobrado hoy” suma solo efectivo + verificado (`:2848`, `:2877`); “Cobrado” del reporte incluye declarado (`analytics.ts:221-222`, `caja-app.tsx:4277`). La misma palabra vale dos cifras. |
| 5 | No confirmar cobro bancario sin evento válido | **Parcial** | El webhook firmado es la única transición digital (`web/src/app/api/webhooks/pey/route.ts:136-157`, `orders.ts:483-582`), pero la pantalla de éxito afirma “Tu pago ya salió del banco” sin evento (`success-client.tsx:428-431`) y `/api/verify` puede responder desde la base local (`web/src/app/api/verify/route.ts:129-137`) mientras la UI dice “El dinero sí llegó” (`caja-app.tsx:2037`). |
| 6 | No recordatorios de fiado a terceros sin autorización | **Cumple (por ausencia)** | No hay SMS, WhatsApp, correo ni notificaciones a clientes. `customers.phone` existe (`db.ts:1390-1401`) pero no se usa para enviar; no hay ruta de recordatorio. |
| 7 | No voz/ubicación/datos sensibles sin necesidad y consentimiento | **Parcial** | La voz se activa con un botón explícito (`caja-app.tsx:1593`), pero el audio se manda a OpenAI (`:1617`, `voice.ts:34-48`) sin aviso de privacidad ni consentimiento informado; el pie solo dice “pey + OpenAI” (`caja-app.tsx:2655`). No hay ubicación ni contactos. |
| 8 | No cambiar la interfaz crítica por inferencias | **Cumple** | Solo cambia por preferencias explícitas: texto/contraste/voz (`caja-app.tsx:1100-1146`); el zoom se detecta para compactar, no para decidir por la persona (`:1118-1136`). |
| 9 | No presentar ahorros virtuales como fondos bancarios | **Cumple** | “Apartado declarado: no es una cuenta bancaria ni dinero custodiado. El efectivo sigue en tu resguardo.” (`caja-app.tsx:5873-5875`). |
| 10 | No dependencias propietarias innecesarias | **Cumple con salvedad** | `web/package.json:32-39`: OpenAI es dependencia de la voz, no de la venta; pey es el proveedor de pago. No hay SDK de analítica/publicidad. La venta manual funciona sin OpenAI. |

### Textos marcados por la regla 3, 4 y 5

- **Confunden total con disponible:** “Hoy $X · Por cobrar $Y” (`caja-app.tsx:2365-2372`) suma pendiente y demo; “Cobrado hoy” (`:2877`) usa otra base que “Cobrado” del reporte (`analytics.ts:221-222`).
- **Prometen una entrega que el servidor rechaza:** “Listo para entregar” sobre `demo_paid` (`caja-app.tsx:3697-3702`, `:3867`, `:7459-7467`; el servidor responde `demo_not_deliverable` en `orders.ts:922-929`).
- **Afirman un hecho bancario no verificado:** “Tu pago ya salió del banco” (`success-client.tsx:428-431`).
- **Convierten la permanencia en obligación:** “No cierres esta pantalla” (`success-client.tsx:435`).
- **“Verificado” sin decir contra qué:** “Comprobante verificado” / “El dinero sí llegó” (`caja-app.tsx:2037`, `:6713`) cuando `/api/verify` puede venir de `source: local` (`web/src/app/api/verify/route.ts:129-137`).
- **“Falta”/“Sobra”:** `caja-app.tsx:4484-4486` y `caja-app.tsx:5163-5166`; no son diagnóstico, pero “Falta dinero en la caja” se lee como reproche. Se propone “Hay $X menos de lo esperado”.

---

## 4 · Estado de los P0 del contrato

La línea base histórica (`AUDITORIA-COGNITIVA.md:83-88`) listaba P0-A a P0-F; `:261` decía que P0-D era el único P0 funcional pendiente. **Eso ya no describe `499a301`.** El estado real es:

| P0 | Estado en `499a301` | Código | Prueba existente | Nota |
|---|---|---|---|---|
| P0-A · Venta manual + efectivo con cambio + validación | **Implementado** | `caja-app.tsx:3029-3038`, `:3513-3527`, `:1671-1680`, `:535-555` | `p0-venta-e2e.py:159`, `:425` | La venta manual funciona con parser 500; $100/$90 deja cambio $10. |
| P0-B · Borrador durable y reanudación | **Implementado** | `caja-app.tsx:353-521`, `:932-1000`, `:1002-1044`, `:1772-1897` | `p0-venta-e2e.py:251`, `:915`; `:583-596` | Borrador y aviso de cobro sobreviven recarga; la llave de venta evita duplicar. |
| P0-C · Abono confirmado + saldo vivo | **Implementado** | `caja-app.tsx:1510-1543`, `:2051-2153`; `orders.ts:742-915` | `p0-fiado-e2e.py:332`, `:344`, `:465`, `:589`, `:823` | La voz solo abre la hoja; el POST ocurre al confirmar; idempotencia durable. |
| P0-D · Corte no destructivo + cierre versionado | **Implementado** | `cash.ts:200-492`; `caja-app.tsx:4614-5668` | `p0-corte-e2e.py:891`, `:1123`, `:1204`, `:1251` | Versiones inmutables, motivo obligatorio, preview con fingerprint, snapshot. Contradice el “pendiente” histórico de `:261`. |
| P0-E · Cobros pendientes visibles + fechas/refresh | **Implementado** | `db.ts:1283-1311`; `pending-payments.tsx:86-244`; `caja-app.tsx:2389-2410`, `:2540-2550`, `:890-930` | `p0-integracion-e2e.py:475`, `:482`, `:502` | La franja lista pendientes de cualquier fecha; el polling de 45 s no se espera en el E2E. |
| P0-F · Shell 200 % + estados de error | **Implementado en automatizado; parcial en humano** | `caja-app.tsx:2326-2356` (banner persistente y reintento), `:7108-7149` (tab bar), `:7152-7293` (foco atrapado) | `p0-shell-e2e.py:407-414`, `:612`, `:753-755`, `:776-777` | Hay 200 % inyectado, skip link, foco y errores honestos; no hay zoom real, TalkBack/VoiceOver ni teléfono físico. |
| P0-G · Pendientes manuales | **Implementado** | `pending-tasks.tsx:228-1187`; `caja-app.tsx:2643-2651` | `p0-integracion-e2e.py:376`, `:384`, `:399`, `:425`, `:919` | Crear/completar/reabrir/posponer/eliminar; el “de hoy” no existe como filtro. |
| P0 · Resumen de cierre basado en movimientos | **Implementado** | `cash.ts:424-458` (snapshot), `caja-app.tsx:4489-4611` | `p0-corte-e2e.py:1123` | Foto de efectivo, fiado y pendiente digital; no se altera con movimientos posteriores. |
| P0 · **“Antes de cerrar”** | **Falta** | `docs/CARGA-COGNITIVA.md:64`, `:99-100`; no hay componente/ruta. `caja-app.tsx:5100-5102` solo muestra el corte guardado; `:5439-5471` solo guarda. | **Sin prueba.** `pending-tasks.tsx:369-374` no filtra “hoy”; `pending-payments.tsx:86-244` vive en Caja, no en Corte. | No hay momento que reúna pendientes de hoy y cobros por confirmar con “acción” o “ahora no”. |
| P0 · Ayuda contextual breve | **Parcial** | `caja-app.tsx:7504-7511` (FAQ fijo), `:6282-6285` (estado vacío), `:2504-2509` (voz) | `p0-shell-e2e.py:753-755` | Explica conceptos, pero no en el campo que los necesita; no hay ayuda de “Antes de cerrar”. |
| P0 · Venta manual aunque la IA no responda | **Implementado** | `caja-app.tsx:3029-3038`, `:3513-3527`, `:1586-1589`, `:1626-1627` | `p0-venta-e2e.py:159` | Cumple el must-pass de P0. |

**Sobre las pruebas:** los scripts existen y tienen aserciones concretas, pero **no los re-ejecuté en este worktree**. Sus resultados documentados (por ejemplo, `P0-VENTA-REPORT.md`, `P0-FIADO-REPORT.md`, `P0-D-CORTE-REPORT.md`, `P0-INTEGRACION-REPORT.md`) son de commits anteriores a `499a301`; no los uso como evidencia de este HEAD. Lo único que corrí aquí fue `verify:fast` 3/3, `test:voice` 17/17, `test:harness` 48/48, lint y tipos. No hay `harness/evidence/latest.json` en este worktree; solo `p0-dinero-e2e.json`, que declara `git.sha = 2ee1e81…` y `dirty: true`.

---

## 5 · Brechas priorizadas

### P0 · Lo que no debería entrar a la demo sin resolver

#### P0-1 · “Antes de cerrar” no existe

- **Qué trabajo quita:** la lista mental de “¿qué me quedó pendiente?” y “¿quién no me ha confirmado?” al final del día.
- **Qué decisión aclara:** qué pendientes de hoy se completan, se posponen o se dejan; qué cobros se revisan o se dejan para mañana.
- **Qué error evita:** cerrar con un cobro pendiente olvidado, con una tarea de hoy sin decidir o con un pendiente de ayer que ya no aparece.
- **Cómo se probaría:** sembrar 2 tareas de hoy y 1 de ayer, 1 cobro pendiente de hoy y 1 de ayer; abrir Corte; ver solo lo de hoy + los cobros por confirmar; “posponer” y “ahora no” sin perder datos; cerrar; recargar y comprobar que nada se borró.
- **Evidencia:** `docs/CARGA-COGNITIVA.md:64`, `:99-100`; `caja-app.tsx:5100-5102` (solo resumen guardado), `:5439-5471` (solo guardar); `pending-tasks.tsx:369-374` (sin filtro de hoy); `pending-payments.tsx:86-244` (franja separada de Corte).

#### P0-2 · El demo ofrece “Listo para entregar” y el servidor lo rechaza

- **Qué trabajo quita:** la duda de qué hacer después de simular un pago.
- **Qué decisión aclara:** un pago demo no es una entrega; la persona solo cierra la simulación.
- **Qué error evita:** que en la demo se pulse “Listo para entregar” y aparezca un 409 `demo_not_deliverable`, o que alguien crea que el demo ya entregó.
- **Cómo se probaría:** simular CoDi; afirmar que el título es “Pago simulado” y que **no** existe el botón “Listo para entregar”; el botón debe ser “Cerrar”/“Entendido”; ninguno debe hacer `PATCH fulfill`; el servidor debe seguir devolviendo 409 si se intenta por API.
- **Evidencia:** `caja-app.tsx:3697-3702` (`canDeliver` incluye `demo_paid`), `:3867` y `:7459-7467` (botón), `orders.ts:922-929` (rechazo); los E2E **evitan** el botón: `hig-after-audit.py:792-794` y `mobile-audit.py:197-200` cierran la hoja con Escape; `p0-orders-atomic-contract.mjs:246-249` prueba el 409 del servidor, no la UI.

#### P0-3 · Los estados de pago no son unívocos

- **Qué trabajo quita:** traducir en la cabeza “Pagado”, “Pago verificado”, “Pago confirmado”, “Pago demo”, “Listo para entregar”.
- **Qué decisión aclara:** si el dinero ya está, si solo está declarado, si es demo o si falta confirmación.
- **Qué error evita:** entregar con un demo, tomar un declarado como verificado o no saber si el comprobante es de pey o de la base local.
- **Cómo se probaría:** recorrer los estados (efectivo, pey, demo, fiado, parcial, pendiente) y comparar etiquetas en Caja, hoja, actividad, checkout y ayuda; una sola tabla canónica; “demo” nunca debe decir “Pagado” ni “Listo para entregar”.
- **Evidencia:** `caja-app.tsx:6875-6887` (`Pagado`/`Pago demo`), `:3774-3778` (`Pago simulado`/`Pago verificado`), `checkout-client.tsx:343-361` (`Pago confirmado`), `success-client.tsx:322-352` (`Pagado`/`Simulado`), `caja-app.tsx:7506` (“Pago confirmado”), `:6712-6714` (“Comprobante verificado”) y `web/src/app/api/verify/route.ts:129-137` (`source: local`).

#### P0-4 · “Hoy”, “Por cobrar” y “Cobrado” valen cosas distintas

- **Qué trabajo quita:** cuadrar a mano tres cifras que deberían salir del mismo registro.
- **Qué decisión aclara:** cuánto se vendió, cuánto se cobró y cuánto falta por cobrar.
- **Qué error evita:** contar un pendiente o un demo como efectivo disponible; creer que un cobro de ayer desapareció porque el resumen “Por cobrar” dice $0.
- **Cómo se probaría:** un solo escenario con $100 efectivo, $50 verificado, $20 declarado, $30 demo, $60 pendiente de hoy y $40 pendiente de ayer; comprobar que “Cobrado” es idéntico en Caja y Corte, que “Por cobrar de hoy” no incluye ayer y que “Cobros pendientes” sí; que “Hoy” no suma pendiente ni demo sin decirlo.
- **Evidencia:** `caja-app.tsx:2365-2372` (“Hoy” incluye pendiente y demo), `:2848` y `:2877-2886` (“Cobrado hoy” = efectivo + verificado), `analytics.ts:221-222` (“Cobrado” incluye declarado), `caja-app.tsx:4277` (“Pagos reales recibidos”), `db.ts:1600-1620` (pendiente solo de hoy) frente a `db.ts:1283-1297` (pendientes de cualquier fecha) y `pending-payments.tsx:99` (total de la franja).

#### P0-5 · La pantalla de éxito afirma un hecho bancario no verificado y retiene al comprador

- **Qué trabajo quita:** la incertidumbre de “¿ya pagué o no?”.
- **Qué decisión aclara:** esperar la confirmación firmada o cerrar y volver al link.
- **Qué error evita:** afirmar que el banco ya debitó cuando no hay evento; que el comprador crea que debe quedarse; que la comerciante entregue con una captura.
- **Cómo se probaría:** abrir `/pay/[id]/success` de un pedido pendiente **sin** pagar; no debe decir “Tu pago ya salió del banco” ni “No cierres esta pantalla”; debe decir “Si ya pagaste, estamos esperando la confirmación firmada”; después del webhook, el texto cambia a “Pago verificado por pey”. Repetir con link inexistente y con demo.
- **Evidencia:** `success-client.tsx:428-437`; `checkout-audit.py:258-289` solo prueba el 404 y prohíbe mensajes bancarios en ese caso, no en el pendiente; `success-client.tsx:65-101` implementa el polling, pero no hay aserción de copy/estado.

### P1 · Primer mes / antes de prometer acompañamiento

| Brecha | Qué trabajo quita | Qué decisión aclara | Qué error evita | Cómo se probaría |
|---|---|---|---|---|
| **P1-1 · Preferencias de acompañamiento y apagado de sugerencias** | La persona no tiene que adivinar qué avisos recibirá ni cómo silenciarlos. | Si quiere recordatorios, explicaciones, voz y sugerencias; qué frecuencia. | Fatiga de avisos, cambios de interfaz no pedidos y que “desactivar sugerencias” oculte un aviso crítico de dinero. | Abrir “¿Cómo quieres que te ayude?”; desactivar sugerencias; forzar un cobro pendiente; el aviso crítico debe seguir visible; recargar y conservar preferencias. No existe hoy: `caja-app.tsx:7494-7603` solo tiene texto/contraste/voz; `GOAL-ACOMPANAMIENTO.md:163` pide la pantalla. |
| **P1-2 · Recomendaciones deterministas y explicables** | La persona no tiene que descubrir qué revisar; la app propone una acción pequeña. | Qué acción tomar, con qué datos y periodo, y si se puede posponer/descartar. | Recomendaciones opacas, comparaciones sin contexto, diagnósticos o acciones financieras sin aprobación. | Sembrar datos; cada recomendación debe traer id, categoría, condición, datos/periodo, urgencia, explicación, acción, posponer/descartar y frecuencia (`GOAL-ACOMPANAMIENTO.md:100-113`); pedir a una persona que explique por qué aparece. Hoy no hay motor: `analytics.ts:132-303` solo describe cifras; “Mejor día/hora” (`caja-app.tsx:4376`, `:4412`) no tiene contexto. |
| **P1-3 · Operación sin conexión** | La venta, el fiado y el corte no dependen de que el servidor esté arriba. | Si se puede seguir operando y qué queda pendiente de sincronizar. | Bloqueo total por red, promesas de pago bancario sin conexión y pérdida de una venta en curso. | `context.set_offline(true)`: abrir la app, registrar una venta en efectivo, un abono y un conteo; la app debe mostrar “sin conexión” y conservar los datos; al volver, sincronizar una sola vez. Hoy no hay service worker ni cola: `page.tsx:8-13` lee en servidor; `caja-app.tsx:1834-1838`, `:2077-2087`, `:4933-4943` y `pending-tasks.tsx:288-292` hacen `fetch`; no hay `navigator.onLine`/IndexedDB. |
| **P1-4 · Consultas locales sin IA** | “¿Cuánto vendí?” y “¿quién me debe?” no dependen del parser. | Qué se puede consultar cuando el modelo no responde. | Que una consulta local quede bloqueada por un 500 de IA, aunque `voice-debts.ts` ya sepa responder. | Con `/api/voice/parse` en 500, escribir “¿Cuánto vendí?” y “¿quién me debe?”; debe responder con `answerLocal`/`answerDebtQuery`. Hoy `interpretText` hace `fetch` primero (`caja-app.tsx:1495-1507`) y solo llama a `answerLocal` si el parser respondió `intent=query`; el `catch` muestra error (`:1575-1576`). |
| **P1-5 · Exportación e independencia** | La persona puede sacar sus registros y no depende de la app para recordarlos. | Qué se exporta (ventas, fiado, corte, tareas), en qué formato y con qué periodo. | Secuestro de datos, imposibilidad de llevar la libreta a otro lado y pérdida de confianza. | Descargar CSV/JSON desde Caja/Corte; comprobar totales, etiquetas de estado y que no haya secretos; abrirlo sin la app. Hoy no existe: el pie solo enlaza créditos de fotos (`caja-app.tsx:2653-2664`); no hay `/api/export` ni botón. |
| **P1-6 · Consentimiento y privacidad de voz** | La persona sabe que su audio se manda a un tercero y puede decidir. | Si acepta dictar, qué se guarda y por cuánto tiempo. | Recolección de voz sin consentimiento informado; desconfianza; incumplimiento de la regla 7. | Al abrir el micrófono por primera vez, mostrar aviso breve con “qué se envía, a quién, para qué, cómo borrarlo”; registrar consentimiento; opción “solo escribir”. Hoy `getUserMedia` (`caja-app.tsx:1593`) y el POST (`:1617`) no tienen aviso; el pie dice “pey + OpenAI” (`:2655`). |
| **P1-7 · Reconocimiento de productos y clientes recientes** | Menos tecleo y menos nombres/códigos recordados. | Qué producto o cliente es, sin escribir el nombre exacto. | Productos con nombres distintos, clientes duplicados, ventas más lentas. | Tras 3 ventas, ofrecer “Quesadilla” y “Juan” en la captura; elegir con teclado; no inventar precios. Hoy el catálogo solo vive en el parser (`voice-local.ts:5-18`); no hay `datalist` ni selector en `caja-app.tsx`. |
| **P1-8 · Corrección/anulación de una venta mal capturada** | No hay que “arreglar” por fuera ni crear una venta nueva para compensar. | Si se corrige el precio, se anula o se registra una devolución, y con qué rastro. | Ventas duplicadas, saldos de fiado incorrectos y pérdida de confianza. | Crear venta con precio equivocado; corregir con motivo; la actividad debe mostrar original y corrección, y el corte no debe doble contar. Hoy no hay ruta `cancel`/`void` en `orders.ts`; solo `fulfillOrder` (`:918-956`). |
| **P1-9 · Conteo cero y aviso de corte guardado** | Cerrar un día sin efectivo no obliga a inventar un número; editar después de guardar no deja un “guardado” viejo. | Si $0 contado es un dato válido; si el aviso es de la versión guardada o del borrador actual. | Datos falsos para poder cerrar; creer que los cambios nuevos ya se guardaron. | Día sin efectivo: contado 0 debe permitir “No hubo efectivo” o guardar con confirmación; editar después de guardar debe cambiar el aviso a “última versión guardada” o limpiarlo. Hoy se bloquea (`cash.ts:386-391`, `caja-app.tsx:4825-4838`) y `savedNotice` no se limpia en `markDirty` (`:4785-4790`, `:5091-5097`). |

### P2 · Después, sin fingir que ya está

| Brecha | Qué trabajo quita | Qué decisión aclara | Qué error evita | Cómo se probaría |
|---|---|---|---|---|
| Crear una meta desde la UI | No depender de una meta sembrada. | Cuánto, para qué y para cuándo. | Quedarse en “Aún no hay una meta” sin salida (`caja-app.tsx:5777-5786`). | Formulario con título/monto/plazo; API `POST /api/goals` ya existe (`web/src/app/api/goals/route.ts:21-45`). |
| Paginación de fiado, actividad y pendientes | Ver todos los registros, no solo los primeros. | Si falta algo por ver o ya no existe. | Un fiado/orden viejo desaparece de la pantalla y se cree saldado. | 101 fiados/51 pendientes/51 tareas; “ver más” con total y sin duplicados; `db.ts:1283-1297`, `pending-payments.tsx:16-17`, `pending-tasks.tsx:6`. |
| Idempotencia al crear tarea | Un doble toque no crea dos recordatorios. | Si el pendiente ya se guardó. | Lista duplicada y ruido. | Doble clic en “Guardar” con red lenta; una sola tarea; `handleCreate` no tiene candado síncrono (`pending-tasks.tsx:396-474`). |
| Persistir el conteo del corte al recargar | No volver a contar si el navegador se cerró. | Si el conteo es borrador o ya se guardó. | Perder el conteo y crear un corte con datos incompletos. | Contar, recargar, volver: el conteo sigue o se avisa que se perdió; hoy solo sobrevive tab/refresh (`P0-D-CORTE-REPORT.md:300-302`). |
| Comparaciones con contexto y calidad de datos | “Mejor día/hora” sin muestra no se lee como juicio. | Si el dato es suficiente para comparar. | Conclusiones falsas con 1 venta o sin datos. | Sembrar 0/1/10 ventas; mostrar “sin datos suficientes” cuando corresponda; `caja-app.tsx:4374-4415`. |
| Fechas en zona de México | “Hoy/Ayer” no cambia si el dispositivo está en otra zona. | Qué día es el movimiento. | Un corte o una actividad con fecha equivocada. | Cambiar `TZ` del navegador; `formatActivityDate` (`format.ts:65-81`) usa hora local; tareas sí usan México (`pending-tasks.tsx:29-80`). |
| 400 % de texto y lector de pantalla real | La interfaz sigue usable más allá del 200 % automatizado. | Si el texto ampliado conserva la tarea principal. | Controles fuera de vista, foco perdido, anuncios incompletos. | Zoom real 400 %, TalkBack/VoiceOver/NVDA, recorrido completo de venta/abono/corte; hoy solo hay 200 % inyectado (`p0-shell-e2e.py:407-414`). |
| Límites de ítems/precio/descripción en la UI | No esperar al 400 del servidor. | Si la venta cabe antes de enviarla. | Error tardío después de capturar 51 ítems o un precio enorme. | 51 ítems, precio > $100,000, descripción > 160; aviso antes del POST; `orders.ts:26-31` define límites, la UI no los muestra. |
| “Leer esta pantalla” completo | La persona con baja visión sabe qué se va a leer. | Si se leen títulos o todo el contenido. | Expectativa incumplida y dependencia de un lector externo. | Comparar texto visible vs leído; hoy solo `h1`, `h2`, `status`, `alert` (`caja-app.tsx:1341-1351`). |

---

## 6 · Copy audit

| Texto actual | Archivo:línea | Problema | Reemplazo propuesto |
|---|---|---|---|
| “Pendientes” en sidebar / “Tareas” en tab bar | `caja-app.tsx:6962-6966`, `:7130-7134` | Dos nombres para el mismo destino; el contrato pide “Pendientes”. | “Pendientes” en ambos; si no cabe a 360, “Pendientes” con tipografía menor, no “Tareas”. |
| “Hoy $X · Por cobrar $Y” | `caja-app.tsx:2365-2372` | “Hoy” suma efectivo, verificado, declarado, demo y pendiente; se lee como dinero disponible. | “Ventas registradas hoy $X · Cobrado $Y · Por cobrar de hoy $Z”. |
| “Cobrado hoy” | `caja-app.tsx:2877`, `:2885-2886` | En Caja excluye declarado; en Corte “Cobrado” lo incluye (`analytics.ts:221-222`). | “Cobrado confirmado” para efectivo + pey; “Declarado, sin verificar” aparte; o unificar la definición. |
| “Por cobrar” (cabecera) frente a “Cobros pendientes” (franja) | `caja-app.tsx:2372`; `pending-payments.tsx:99`, `:123`; `db.ts:1600-1620`, `:1283-1297` | La cabecera cuenta solo hoy; la franja cuenta cualquier fecha. | “Por cobrar de hoy” en la cabecera; “Cobros pendientes (todas las fechas)” en la franja. |
| “Pago verificado” / “Comprobante verificado” / “El dinero sí llegó” | `caja-app.tsx:3778`, `:6713`, `:2037`; `web/src/app/api/verify/route.ts:129-137` | `/api/verify` puede responder `source: local`; la UI no distingue “registrado por webhook” de “consultado ahora en pey”. | “Registrado por webhook firmado” (local) vs “Confirmado ahora por pey” (live); no afirmar “el dinero sí llegó” sin decir la fuente. |
| “Pago confirmado” en la ayuda | `caja-app.tsx:7506` | La app usa “Pago verificado”, “Pagado” y “Pago confirmado” para el mismo estado. | Una sola frase canónica: “Pagado y verificado por pey”. |
| “Listo para entregar” sobre demo | `caja-app.tsx:3697-3702`, `:3867`, `:7459-7467` | Promete una entrega que el servidor rechaza (`orders.ts:922-929`). | “Pago demo: no entregar” / botón “Cerrar demo”; nunca “Listo para entregar”. |
| “Tu pago ya salió del banco” | `success-client.tsx:428-431` | Afirma un débito bancario sin evento verificado. | “Si ya pagaste, estamos esperando la confirmación firmada de pey.” |
| “No cierres esta pantalla” | `success-client.tsx:435` | Convierte la permanencia en obligación; el link sigue siendo válido. | “Puedes cerrar; este link conserva el comprobante. Si tarda, muéstralo a la comerciante.” |
| “Falta dinero en la caja” / “Falta” / “Sobra” | `caja-app.tsx:5163-5166`; `caja-app.tsx:4484-4486` | “Falta” puede leerse como reproche; no ofrece siguiente paso. | “Hay $X menos de lo esperado. Puedes contar de nuevo, revisar retiros o guardar con motivo.” |
| “demo_paid” / “simulado” | `caja-app.tsx:6882` (`Pago demo`), `:3774` (`Pago simulado`); no aparece el identificador crudo | No hay texto crudo `demo_paid`, lo cual es correcto; el riesgo es que “Pago demo” se lea como “Pagado”. | “Pago demo (simulado, no es dinero real)” en todos los resultados. |
| “Leer esta pantalla” | `caja-app.tsx:1341-1351` | Solo lee títulos, estados y alertas, no toda la pantalla. | “Leer títulos y avisos” o leer el contenido completo de `main`. |
| “Pagos reales recibidos en el periodo” | `caja-app.tsx:4277` | `collectedCents` incluye abonos declarados sin verificar (`analytics.ts:221-222`). | “Cobrado registrado (incluye declarado); verificado por pey: $X”. |
| “Mejor día” / “Mejor hora” | `caja-app.tsx:4376`, `:4412` | Comparación sin muestra ni contexto; puede leerse como juicio de desempeño. | “Día con más ventas registradas (N ventas)” / “Hora con más ventas (N ventas)”. |
| “Corte #1 guardado…” | `caja-app.tsx:5091-5097`; `markDirty` no lo limpia (`:4785-4790`) | El aviso de guardado sigue visible mientras hay cambios sin guardar. | “Última versión guardada: #1” y limpiar/renombrar al editar; no decir “guardado” del borrador actual. |

**Vocabulario canónico propuesto**

- **Efectivo recibido**: dinero físico declarado por la comerciante.
- **Digital verificado por pey**: evento firmado; único caso de “verificado”.
- **Digital declarado (sin verificar)**: abono digital que no pasó por pey.
- **Por cobrar**: saldo digital que aún no se recibió.
- **Fiado**: deuda de un cliente; no es dinero recibido.
- **Pago demo (simulado)**: no es dinero real; nunca “Pagado” ni “Listo para entregar”.
- **Cobrado**: suma de efectivo + digital verificado + digital declarado, si se define así; si no, usar “Cobrado confirmado” para efectivo + pey.

---

## 7 · Pruebas que faltan

| Caso | Qué existe | Qué falta | Prueba propuesta |
|---|---|---|---|
| **Venta interrumpida** | `p0-venta-e2e.py:251` (continuar), `:915` (borrador de ayer), `:583-596` (pendiente durable) | Un 502 después del commit + edición del borrador + reintento; dos pestañas; un parseo nuevo que reemplaza un borrador no recuperado; link ya generado y recarga. | Dictar 2 ítems, simular 502 post-commit, editar un precio, reintentar: una sola orden o aviso explícito; recargar y continuar; dos pestañas no duplican. |
| **Cobro que no llega** | `success-client.tsx:65-101` (polling), `p0-dinero-e2e.py` (webhook/verify) | Un pedido pendiente visitado en `/success` sin pago; timeout de 1–2 minutos; link que sigue vivo; copy que no afirma débito. | Abrir `/success` de un pedido pendiente; avanzar reloj/polling; debe seguir “Esperando confirmación”, no “Pagado”; cerrar y reabrir conserva el link; después del webhook, cambia a verificado. |
| **Doble envío** | `p0-venta-e2e.py:343-356`, `:402`; `p0-fiado-e2e.py:465`, `:823`; `p0-corte-e2e.py` (requestId/expectedVersion) | Doble “Pagar” en checkout, doble “Guardar” de tarea, doble “Apartar” de meta, dos pestañas en venta y abono. | Doble clic y doble POST con la misma llave: una sola orden/abono/tarea/aporte; la UI anuncia “ya registrado” sin “devuelve” falso. |
| **Corte con diferencia** | `p0-corte-e2e.py:891` (contado cero), `:1123` (resumen), `:1204` (retiro previo) | Un faltante con tareas/pendientes de hoy; un sobrante; contado $0 en un día sin efectivo; corrección de un corte de ayer; aviso de “guardado” tras editar. | Sembrar $100 esperado, contar $90: guardar con motivo y sin culpa; el resumen dice “$10 menos”; el aviso no promete que el borrador actual está guardado; contado $0 se permite con confirmación. |
| **Sin conexión** | Ninguna. `context.set_offline` no se usa en los E2E; no hay service worker (`manifest.ts` solo declara PWA). | Abrir la app, vender en efectivo, abonar y contar sin red; estado de sincronización; no prometer pago bancario. | `context.set_offline(true)`: la app debe cargar desde caché/local, registrar la venta local, mostrar “sin conexión” y sincronizar al volver; si no hay soporte, el test debe declarar el límite, no pasar por accidente. |
| **Sugerencias desactivadas** | No existe la preferencia. | Un interruptor de sugerencias y la garantía de que los avisos críticos de dinero no se ocultan. | Desactivar sugerencias; forzar un cobro pendiente y un corte con diferencia; ambos avisos siguen visibles; las sugerencias ordinarias desaparecen. |
| **Sin IA** | `p0-venta-e2e.py:159` (parser 500 + venta manual) | Consulta “¿cuánto vendí?” con parser 500; transcripción caída; TTS caído; latencia de IA sin bloquear la venta. | Rutas `/api/voice/parse` y `/api/voice/transcribe` en 500: la venta manual sigue; “¿cuánto vendí?” responde local; el TTS falla en silencio y el texto permanece; la venta no espera al modelo. |
| **Texto ampliado, teclado y lector** | `p0-shell-e2e.py:407-414` (200 % inyectado), `:612` (skip link), `:753-755` (ayuda); `p0-integracion-e2e.py:919-924` | Zoom real 400 %, TalkBack/VoiceOver/NVDA, recorrido completo con teclado por venta/abono/corte/tareas, anuncios de “completado/pospuesto/eliminado”. | Probar con zoom 400 % y 320/360; tabular todo el flujo sin mouse; lector anuncia título, error, resultado y foco; no depender del color. |
| **Verdad del demo en la UI** | `p0-orders-atomic-contract.mjs:246-249` (servidor rechaza entrega demo) | Que la UI no ofrezca “Listo para entregar” y no haga `PATCH`; que el demo no se vea como pagado. | Simular CoDi: “Pago simulado”, sin CTA de entrega, sin `fulfill`; el botón de cerrar no deja estado “Entregado”. |
| **Success de pedido pendiente** | `checkout-audit.py:258-289` solo 404; no hay caso pendiente. | Copy condicional y salida sin obligación de permanecer. | Visitar `/success` de un pedido `payment_pending`; no debe decir “salió del banco” ni “no cierres”; el link conserva el comprobante. |
| **“Antes de cerrar”** | No existe. | Mezcla de tareas de hoy y cobros por confirmar, con posponer/ahora no. | Sembrar tareas y cobros de hoy/ayer; abrir Corte; ver solo lo de hoy + cobros; posponer/descartar; cerrar; nada se pierde; no hay diagnóstico. |
| **Copy canónico de estados** | No hay test de copy transversal. | Una tabla de etiquetas por estado y superficie. | Snapshot de Caja, hoja, actividad, checkout, success y ayuda para efectivo/pey/demo/fiado/parcial/pendiente; una sola etiqueta por estado. |

---

## 8 · Veredicto

### Listo para la demo (si se ensaya)

- Venta manual con parser caído, cambio de efectivo y validación inline.
- Borrador durable y “Continuar venta” / “Descartar borrador”.
- Cobro pendiente durable y franja de cobros pendientes con “Ver”.
- Fiado con hoja de abono, saldo vivo, método visible, sobrepago y “Saldado”.
- Corte versionado con preview del servidor, motivo y snapshot.
- Pendientes con crear/completar/reabrir/posponer/eliminar.
- Errores de dashboard/tareas/meta que no se disfrazan de vacío.
- 200 % y teclado automatizados (no equivalen a lector real).

### No listo para la demo / no se debe prometer

- **“Antes de cerrar”** con pendientes de hoy y cobros por confirmar.
- **Entrega demo** sin el CTA falso “Listo para entregar”.
- **Una sola verdad de estados** (Pagado/verificado/demo/pendiente).
- **Una sola verdad de cifras** (“Hoy”, “Por cobrar”, “Cobrado”).
- **Pantalla de éxito** que no afirme un débito bancario sin evento ni retenga al comprador.
- **Preferencias de acompañamiento** y apagado de sugerencias.
- **Recomendaciones deterministas/explicables**.
- **Operación sin conexión**.
- **Exportación** de registros.
- **Consentimiento de voz** y aviso de privacidad.
- **Corte con contado $0** y corrección de una venta mal capturada.

### Lo que no se puede afirmar

- Que la app “reduce el estrés” o la carga cognitiva en un porcentaje: no hay estudio con comerciantes (0 de 6–8), ni SUS/NASA-TLX, ni tiempos humanos.
- Que funciona con TalkBack/VoiceOver/NVDA ni en teléfono físico: no se probó.
- Que el zoom real del navegador (400 %) funciona: solo hay 200 % inyectado por CSS.
- Que el pago real de $0.01 con pey/CoDi funciona: el riel sigue bloqueado; el demo usa `demo_paid`.
- Que el full de 23/23 está verde en `499a301`: no se ejecutó en este worktree; no hay `latest.json`.
- Que los E2E de venta/fiado/corte/integración/shell pasan en este HEAD: sus reportes son de commits anteriores y no los re-ejecuté.
- Que “sin IA” cubre consultas: la venta manual sí; la consulta “¿cuánto vendí?” sigue atada al parser (P1-4).

### Mínimo para cerrar la brecha cognitiva

1. Implementar **“Antes de cerrar”** (P0-1) con tareas de hoy y cobros por confirmar, acciones “posponer/ahora no”, sin diagnóstico.
2. Quitar **“Listo para entregar”** del demo (P0-2) y unificar la **tabla de estados** (P0-3).
3. Unificar **“Hoy/Por cobrar/Cobrado”** (P0-4) y corregir la **pantalla de éxito** (P0-5).
4. Añadir **preferencias de acompañamiento**, **recomendaciones explicables**, **offline**, **consultas locales sin IA** y **exportación** (P1-1 a P1-5).
5. Convertir cada punto en una prueba de aceptación con datos sembrados y una prueba humana con 4–8 comerciantes; no declarar “carga reducida” sin eso.

---

## 9 · Método, evidencia y límites

### Comandos ejecutados en este worktree

```text
cd web
npm ci                     # OK (385 paquetes; 16 vulnerabilidades moderadas reportadas, no se tocaron)
npm run verify:fast         # 3/3 (guard, lint, types)
npm run test:voice          # 17/17
npm run test:harness        # 48/48
npm run lint                # sin errores
npx tsc --noEmit            # sin errores
```

No se ejecutó `npm run build` ni `verify:full`; no se levantó servidor; no se usaron `:3000`, `:3230` ni la preview.

### Evidencia y archivos revisados

- Contrato y goals: `docs/CARGA-COGNITIVA.md`, `GOAL-ACOMPANAMIENTO.md`, `AUDITORIA-COGNITIVA.md`.
- UI: `web/src/components/caja-app.tsx`, `pending-tasks.tsx`, `pending-payments.tsx`, `screen-heading.tsx`.
- Dominio: `web/src/lib/orders.ts`, `cash.ts`, `tasks.ts`, `goals.ts`, `analytics.ts`, `voice.ts`, `voice-local.ts`, `voice-debts.ts`, `checkout.ts`, `db.ts`.
- Rutas: `web/src/app/api/orders`, `credits`, `cash`, `tasks`, `goals`, `checkout`, `voice`, `verify`, `webhooks/pey`.
- Público: `web/src/app/pay/[id]/page.tsx`, `checkout-client.tsx`, `success/page.tsx`, `success-client.tsx`.
- Shell: `web/src/app/page.tsx`, `layout.tsx`, `manifest.ts`.
- Pruebas: `web/scripts/p0-venta-e2e.py`, `p0-fiado-e2e.py`, `p0-corte-e2e.py`, `p0-integracion-e2e.py`, `p0-shell-e2e.py`, `p0-orders-atomic-contract.mjs`, `checkout-audit.py`, `mobile-audit.py`, `hig-after-audit.py`.
- Reportes: `P0-D-CORTE-REPORT.md`, `P0-FIADO-REPORT.md`, `P0-INTEGRACION-REPORT.md`, `P0-VENTA-REPORT.md`, `harness/STATE.md`.

### Límites

- No hay estudio con personas, ni medición de carga percibida, ni tiempos.
- No hay prueba de lector de pantalla, teléfono físico ni zoom real.
- No hay pey real; el demo y los fixtures usan `demo_paid`/`demo`.
- No hay full runtime en este worktree; `harness/evidence/latest.json` no existe aquí.
- La auditoría es de código y copy; no verifica visualmente la app en este HEAD.
- El gate de esta auditoría comprobó **208 referencias `archivo:línea`**: todas existen y la línea está dentro del archivo. No valida el comportamiento en ejecución.
