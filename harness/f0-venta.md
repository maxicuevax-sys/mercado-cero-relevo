# F0 · Auditoría de carga cognitiva — venta y cobro

> **Repo:** `mercado-cero` · **commit:** `26d06ce` · **fecha:** 1 de noviembre de 2026.
> **Alcance:** Caja (`CajaPanel`), cobro (`PaymentPanel`, `PaidSheet`), flujo de voz/texto, draft, `/api/voice/parse`, `/api/orders`, `/api/orders/[id]/pay`, `/api/demo/pay` y checkout público.
> **Método:** lectura de código y artefactos; dos consultas GET de solo lectura al servidor en `:3000` (`/api/dashboard`, `/api/analytics?period=today`); sin mutaciones, sin Playwright y sin gates. No se midió tiempo ni NASA-TLX con personas.
> **Límite:** esto es una auditoría estructural. No demuestra reducción de carga percibida; identifica dónde el diseño actual la impone.

**Veredicto en una frase:** el camino feliz de la demo está cuidado y la verdad `demo / efectivo / pey / fiado` del resultado del cobro es lo más sólido del flujo; pero las promesas de **“vender sin IA”**, **“borrador recuperable”** y **“pendiente inequívoco”** no se cumplen en el código actual.

---

## 0 · Resumen ejecutivo

1. **La venta depende del parser.** No hay forma de empezar un pedido manualmente desde cero: el botón “Agregar producto” solo existe cuando ya hay al menos un producto. Si `/api/voice/parse` falla, la venta no puede iniciarse. La ley “la IA no bloquea lo esencial” no se cumple.
2. **El “draft” es memoria de React, no un borrador durable.** Recargar, cerrar la pestaña o que el sistema mate la app borra productos, efectivo, fiado, cliente y transcripción. La app recuerda el tamaño de letra y la velocidad de voz, pero no la venta en curso.
3. **El efectivo real no cabe.** Si el cliente entrega $100 por una venta de $90, el campo “Efectivo recibido” se llena con 100, la app marca sobrepago y deshabilita “Confirmar venta”. No hay cambio ni campo de cambio. Es una venta de mostrador común que el diseño rechaza.
4. **El cobro pendiente se pierde.** El dashboard solo se recarga al montar y después de acciones propias; el polling existe únicamente mientras el sheet de cobro está abierto. “Por cobrar” suma solo pedidos de hoy; Actividad muestra 30 pedidos con hora, sin fecha; no hay cancelar ni vencer. Un cobro de ayer puede desaparecer de la pantalla sin haber desaparecido de SQLite.
5. **Hay escrituras duplicables y una escritura que la IA hace sola.** Crear pedido no tiene idempotencia; el pago demo no tiene tope atómico; el abono por voz se registra inmediatamente, sin confirmación, siempre como efectivo. La interfaz dice “La IA interpreta; tú confirmas”, pero en ese camino no confirmas nada.
6. **La primera línea de Caja contradice la verdad del dinero.** “Hoy $190.00 · Por cobrar $120.00 · Fiado $50.00” suma pendientes al total, no separa demo y usa el fiado global. La lógica de voz de la misma app respondería “Hoy llevas $70.00 en 1 ventas”. Dos respuestas para la misma pregunta.
7. **Los estados mienten en los bordes.** Una venta a fiado recién creada se titula “Pedido entregado”; antes de generar un link ya dice “Pago pendiente”; el QR afirma “expira en 10 minutos” para siempre; el link promete “tarjeta + wallets” sin verificación del riel.

**Lo que sí está bien y no se debe romper**

- `paymentTruth()` distingue efectivo, demo, pey, fiado y mixto sin inferir demo del flag global (`caja-app.tsx:3976-3996`). El `PaidSheet` y el resultado del `PaymentPanel` comunican esa verdad con cuidado.
- El servidor recorta efectivo y fiado al total y el webhook es idempotente por `transactionId` (según `STATE.md`; no se volvió a correr).
- El abono manual de fiado tiene confirmación de descarte y un patrón reutilizable (`caja-app.tsx:3554-3572`).
- Los targets de 48 px, el foco del sheet y el texto al 200% están resueltos; esta auditoría no propone tocar la identidad visual.

---

## 1 · Mapa del flujo actual

### 1.1 Los tres objetos que la persona vive como uno

```text
draft (solo React)
   └─ “Confirmar venta” → order (SQLite, status confirmed)
        └─ link o QR → payment_pending
             └─ webhook firmado de pey / demo_pay → paid / demo_paid / fulfilled
```

La persona ve **una venta**. El sistema tiene **tres objetos con durabilidad distinta**: el draft no sobrevive a una recarga; la orden sí; la solicitud de cobro es un campo de la orden. La interfaz no siempre hace visible esa cadena.

### 1.2 Pasos, pantallas, campos y decisiones

| # | Lo que hace la persona | Pantalla / control | Datos que entran | Decisión o estado | Si algo falla |
|---|---|---|---|---|---|
| 1 | Abre Caja | Caja | — | Ve “Hoy / Por cobrar / Fiado”; no hay bandeja de pendientes | Si `/api/dashboard` falla, el subtítulo queda “Cargando la caja…” y Actividad dice “Aún no hay ventas”; el toast dura 3 s |
| 2 | Mantiene el micrófono o escribe | Micrófono / “Escribe la venta” | Frase | Voz o texto; primera vez pide permiso | Micrófono denegado → error y campo de texto; el campo ya estaba visible |
| 3 | Suelta o toca “Interpretar” | Mismo panel | Transcripción | El parser decide `sale / query / credit_payment / unknown` | Error HTTP o IA caída → mensaje; no hay captura manual; el draft anterior puede quedar con la transcripción nueva |
| 4 | Revisa y corrige | “Pedido en curso” | Descripción, cantidad, precio por producto | Reemplazar el draft completo o editarlo; precios del catálogo si no se dijeron | Precio 0 o descripción vacía pasan el cliente y el servidor responde 400 genérico |
| 5 | Define efectivo / fiado / cliente | Campos “Efectivo recibido”, “A fiado”, nombre | Montos y nombre | Cuánto se aplica a la venta; el resto es “por cobrar con link” | Efectivo + fiado > total → botón deshabilitado sin explicación específica |
| 6 | Confirma la venta | “Confirmar venta” | Ítems + efectivo + fiado + cliente | Efectivo completo → `paid`; fiado completo → `fulfilled`; mixto → `fulfilled`; digital pendiente → `confirmed` | Error de red después de crear en servidor → el draft sigue; reintentar puede duplicar |
| 7 | Elige cómo cobrar el saldo digital | Sheet “Cobrar $X” | Ninguno | “Link de pago” vs “QR CoDi directo” | Falla → toast de 3 s; el sheet sigue igual, sin error inline |
| 8 | Comparte y espera | Sheet “Cobro pendiente” | Link o QR | Copiar, compartir, abrir checkout; esperar | Polling silencioso; si la red falla, la pantalla sigue diciendo “Esperando al banco” |
| 9 | Ve el resultado | `PaidSheet` | — | Efectivo / demo / pey / fiado / mixto | Es el punto más claro del flujo |
| 10 | Entrega o cierra | “Listo para entregar”, “Entendido”, X, backdrop, Esc | — | Marca `fulfilled` o solo cierra; el pedido sigue | Cerrar no cancela; en móvil la página de fondo dice “La caja está lista” |

### 1.3 Estados y etiquetas

| Estado real | Qué significa | Etiqueta en la UI | Qué espera la persona | Problema |
|---|---|---|---|---|
| `draft` (tipo) | No existe en servidor; el draft es React | “Pedido en curso” | Que se guarde | No sobrevive recarga; el estado `draft` del tipo `Order` no se usa |
| `confirmed` | Orden creada, **sin** link ni QR | “Por cobrar” | Que la app le diga “genera el cobro” | El sheet dice “Pago pendiente” antes de que exista una solicitud; si hubo abono parcial en efectivo, el título dice “Resultado del cobro” |
| `payment_pending` | Link o QR emitido, esperando banco | “Esperando al banco” | Que se actualice sola | Solo se actualiza con el sheet abierto y la red viva |
| `partially_paid` | Pago parcial | “Pago parcial” | Ver cuánto falta | Casi inalcanzable en el flujo actual; sin acciones |
| `paid` | Efectivo completo o pey confirmado | “Pagado” / “Efectivo recibido” | Entregar | La Actividad dice “Pagado”, no “Verificado por pey” |
| `demo_paid` | Pago simulado | “Pago demo” / “Pago simulado” | Probar | El polling no lo excluye: al abrirlo puede volver a disparar el overlay y el audio |
| `fulfilled` | Entregado **o** venta a fiado sin saldo digital | “Entregado” | Entregar / deber | Se usa `fulfilled` al crear una venta a fiado; el sheet la titula “Pedido entregado” antes de entregar |
| `cancelled` | Cancelado | “Cancelado” | Poder cancelar | No hay acción que lo produzca; “Cerrar cobro” solo oculta el sheet |

### 1.4 Éxito, error, vacío e interrupción

| Situación | Qué se ve | Qué queda | Veredicto |
|---|---|---|---|
| Éxito en efectivo | `PaidSheet` “Efectivo recibido”, total, “Listo para entregar” | Orden `paid`; draft limpio | Claro y honesto |
| Éxito demo | “Pago simulado”, “No se movió dinero real” | Orden `demo_paid` | Claro; no se presenta como verificado |
| Éxito pey | “Pago verificado”, “confirmado por pey” | Orden `paid` | Claro en el momento; la Actividad lo diluye en “Pagado” o “Entregado” |
| Error de venta | `saleError` inline; el error de voz arriba | Draft intacto (salvo el caso de red ambigua) | Parcial: los 400 de validación son genéricos y no señalan el campo |
| Error de link/demo | Toast de 3 s | Sheet intacto | Insuficiente: el error desaparece y no queda estado |
| Error de polling | Nada; sigue “Esperando al banco” | Estado viejo | Crítico: “no ha pagado” y “no puedo comprobar” se ven igual |
| Vacío | “La caja está lista / Habla o escribe arriba; el pedido aparece aquí.” | — | No ofrece “Agregar producto”; refuerza que sin voz/IA no hay venta |
| Interrupción antes de confirmar | Al volver: Caja vacía, sin aviso | Nada | Falla el must-pass de recuperación |
| Interrupción después de confirmar | El pedido existe en SQLite; la Caja no lo muestra arriba | Orden pendiente, recuperable solo desde Actividad | Parcial y escondido en móvil |

---

## 2 · Carga cognitiva

### 2.1 Lo que la persona debe recordar

- **A quién le mandó el link.** Una venta digital no pide nombre; la Actividad muestra productos y hora, no cliente. Dos pedidos parecidos solo se distinguen por el short id.
- **Cuánto efectivo recibió y cuánto falta.** En el sheet de cobro pendiente solo se ve el saldo digital; el efectivo y el fiado ya aplicados no se muestran hasta después de pagar.
- **Qué compone el total.** El draft tenía precios por producto; al confirmar, el draft se borra y el sheet muestra “2 Quesadillas · 1 Agua” sin precios. Si el cliente pregunta “¿la quesadilla a cuánto?”, la información existe en `order.items` pero no está en la pantalla.
- **Si ya generó el link o no.** La Caja no muestra links pendientes; hay que abrir Actividad y luego el pedido.
- **Qué pendiente es de hoy y cuál de ayer.** Actividad usa `formatTime` (hora), no fecha; `listOrders(30)` mezcla días.
- **Si la venta quedó confirmada o solo dictada.** Al confirmar, el draft se limpia y el fondo del modal dice “La caja está lista”, aunque el cobro siga pendiente.
- **Qué dijo exactamente.** El auto-scroll lleva al pedido y deja la transcripción y el micrófono arriba; el resumen “Escuché $X” no muestra el desglose hablado.
- **El cambio.** Para $100 sobre $90, debe calcular y escribir 90 (o el sistema rechaza la venta); no hay campo de cambio.

### 2.2 Información que ya existe en el sistema y no está en la pantalla

| Dato existente | Dónde está | Dónde falta |
|---|---|---|
| Precio unitario y subtotal de cada ítem | `Order.items` (`types.ts:17-23`) | `PaymentPanel` solo une cantidad + descripción (`caja-app.tsx:2083`); `PaidSheet` no muestra ítems; Actividad tampoco precios (`caja-app.tsx:3390-3417`) |
| Efectivo y fiado ya aplicados | `order.paidCents`, `order.creditCents` | El sheet de cobro pendiente solo muestra `due` (`caja-app.tsx:1911`); el desglose aparece después de pagar |
| Nombre del cliente | `order.customerName` | No se pide si no hay fiado; Actividad no lo muestra; el sheet digital no lo muestra |
| Fecha del pedido | `order.createdAt` | Actividad solo muestra hora (`caja-app.tsx:3396`; `format.ts:17-22`) |
| Verificado por pey vs demo | `summary.verifiedDigitalCents`, `summary.demoDigitalCents` | La línea “Hoy” de Caja los suma sin separar (`caja-app.tsx:1102-1109`); solo la voz los separa |
| Estado “sin link” vs “esperando banco” | `confirmed` vs `payment_pending` | “Por cobrar” los agrupa; la Actividad cambia el icono, pero el resumen no |
| Link/QR ya emitido | `order.paymentUrl`, `order.qrString` | La Caja no lo muestra; solo al abrir el pedido |

### 2.3 Decisiones innecesarias o mal planteadas

1. **Link vs QR al inicio del cobro.** El camino “Link de pago” ya renderiza un QR de la URL (`caja-app.tsx:2178-2181`), así que el comerciante puede elegir link y mostrar el QR. La segunda opción (“QR CoDi directo”, `2215-2228`) añade una decisión técnica (“CoDi + tarjeta + wallets” vs “Solo transferencia CoDi”) en medio de la venta.
2. **Efectivo recibido vs efectivo aplicado.** El campo se llama “Efectivo recibido” (1790), pero el sistema solo acepta hasta el total. La persona debe traducir “me dio 100” a “aplico 90”.
3. **“Cerrar cobro” vs X vs backdrop vs Esc.** Cuatro formas de cerrar el mismo sheet, ninguna dice que el cobro sigue pendiente.
4. **“Limpiar” vs borrar ítem por ítem.** “Limpiar” borra todo sin confirmación ni undo; el abono de fiado sí pide confirmación para descartar. Inconsistencia.
5. **Dos controles de voz ambiguos.** “Escuchar” junto al micrófono reproduce instrucciones, no la venta; el mute global puede hacer que no suene nada. El usuario no sabe qué va a oír.
6. **Tarjeta/wallet en el checkout demo.** La UI ofrece Tarjeta y Wallet (`checkout-client.tsx:60-86`) y el link promete “CoDi + tarjeta + wallets” (`caja-app.tsx:2109`), pero el riel real no está verificado; `GOAL.md:37` pide no prometer métodos que el checkout no ofrece.

### 2.4 Dónde se pierde el contexto

- **Auto-scroll al pedido.** Tras interpretar, `scrollIntoView` lleva a `#pedido` (`caja-app.tsx:648-650`). En 360 px, la transcripción, el micrófono y el “Escuchar” quedan arriba; el total y “Confirmar venta” quedan más abajo (`#confirmar`, 1854). La persona revisa a ciegas o hace scroll.
- **El draft se borra al crear la orden, no al terminar el cobro.** `createOrder` limpia ítems, efectivo, fiado y cliente antes de que el cobro digital exista (`801-807`). Detrás del modal, la pantalla dice “La caja está lista” (`1770-1781`), como si no hubiera nada pendiente. La captura `mobile-360-cobro.png` lo muestra literalmente.
- **La Actividad no es una bandeja.** En móvil queda después del formulario; en `home-360-full.png` el pedido “Esperando al banco” aparece a media página, con hora y sin fecha.
- **El sheet de cobro oculta el desglose.** Muestra el saldo digital, los ítems sin precio y ningún cliente; la información está en `order` pero no se presenta.
- **La primera línea de Caja mezcla tres alcances.** “Hoy” incluye pendientes; “Por cobrar” es solo de hoy; “Fiado” es el saldo global de todos los días. Tres periodos distintos en una línea.
- **La voz y la pantalla responden distinto.** Caja dice “Hoy $190.00”; la lógica de voz diría “Hoy llevas $70.00 en 1 ventas” (total cobrado, sin pendientes ni fiado). La tarjeta de analítica sí separa “Cobrado $70 / Por cobrar $120”, pero está en otra pantalla.

### 2.5 Conteo estructural (no medición con personas)

| Camino | Acciones mínimas | Campos | Decisiones | Comentario |
|---|---|---|---|---|
| Efectivo exacto | 5–6 | Frase + efectivo + n ítems | Ninguna adicional | El parser llena ítems; “Listo para entregar” es opcional |
| Efectivo con cambio | **Imposible sin alterar el monto** | Efectivo | Calcular cambio a mano | No hay campo de cambio; el sobrepago bloquea |
| Digital | 7–8 | Frase + n ítems | Link vs QR; compartir; esperar | El link ya incluye QR; la segunda opción es redundante |
| Fiado | 6–7 | Frase + fiado + nombre | Cuánto fiar | El nombre solo se pide si hay fiado; el botón se habilita sin nombre y el error aparece al hacer clic |
| Mixto efectivo + fiado + digital | 8–9 | Frase + efectivo + fiado + nombre | Reparto del pago | El saldo digital es implícito; no se ve el reparto en el cobro |
| Sin parser / IA caída | **No hay camino** | — | — | El único camino de creación es `/api/voice/parse` |

---

## 3 · Interrupciones y recuperación

| Evento | Qué sobrevive | Qué ve la persona | ¿Se recupera? |
|---|---|---|---|
| Recarga antes de “Confirmar venta” | Preferencias de accesibilidad; nada de la venta | Caja vacía, “La caja está lista” | **No.** No hay draft en servidor ni en `localStorage` |
| Recarga después de “Confirmar venta” con link pendiente | Orden en SQLite; link en `paymentUrl` | Caja normal; el pedido está en Actividad, no hay banner | **Parcial.** Hay que encontrarlo; en móvil está abajo; si es de ayer, “Por cobrar” ya no lo cuenta |
| Cierra el sheet (X, backdrop, Esc, “Cerrar cobro”) | Orden y link | Página de fondo con “La caja está lista” | **Parcial.** El pedido existe, pero no se reabre solo y la copia sugiere que se canceló |
| Recibe una llamada / manda la app al fondo | Draft en memoria si el sistema no la mata; el audio se detiene (`visibilitychange`, 502-522) | Al volver, el estado sigue | **Frágil.** La grabación no se detiene en `visibilitychange`; si el sistema recarga, se pierde todo |
| Permiso de micrófono en el primer uso | Nada aún | El usuario suelta para tocar “Permitir”; la grabación puede empezar después y seguir sola | **Bug.** `onPointerUp` llama a `stopRecording` antes de que exista el `MediaRecorder` (`728-739`); luego `getUserMedia` resuelve y `recorder.start()` queda activo (`666-726`) |
| Falla la IA al interpretar | Draft anterior (si había); transcripción nueva | Error de voz; el draft no cambia; la transcripción sí | **Ambiguo.** El bloque “Escuché $X” puede mostrar el total viejo con la frase nueva; no hay captura manual |
| Falla la red al confirmar | Draft | `saleError` “Revisa tu conexión…” | **Peligroso.** Si el servidor creó la orden y la respuesta se perdió, el draft sigue y el reintento crea otra |
| Falla la red al generar link | Orden | Toast de 3 s; el sheet sigue con los dos botones | **Parcial.** Se puede reintentar; dos pestañas o un reintento concurrente pueden crear dos links |
| Falla la red durante el polling | Orden y sheet | “Esperando al banco” para siempre; sin hora del último intento | **No se distingue** de “no ha pagado” |
| Reintenta el abono por voz | Deuda y ledger | El parser vuelve a ejecutar el POST | **Doble abono.** `recordCreditPayment` no tiene idempotencia; el segundo se recorta al saldo, pero puede dejar dos filas y duplicar el efectivo esperado |
| Dos pestañas | Dos drafts y dos órdenes posibles | Cada una con su estado | **Duplicable.** No hay clave de idempotencia ni bloqueo por orden |
| “Limpiar” | Nada del draft | Todo borrado | **No.** Sin confirmación ni undo |
| Falla la carga inicial del dashboard | Nada | “Cargando la caja…” + Actividad “Aún no hay ventas”; toast 3 s | **No.** No hay botón de reintento; parece que no hay datos |

**La recuperación que falta no es un detalle de UI:** el must-pass dice que una venta interrumpida se recupera con productos, importe, forma de pago y estado del cobro (`GOAL-ACOMPANAMIENTO.md:299`). Hoy solo se recupera la orden ya creada, y solo si la persona la busca en una lista que no es una bandeja de pendientes.

---

## 4 · Errores críticos

### 4.1 · Venta sin parser: la IA es el único camino — **CRÍTICO**

- El botón “Agregar producto” está **dentro** del bloque `draftItems.length > 0` (`caja-app.tsx:1751`); el estado vacío no lo tiene (`1770-1781`). No se puede empezar un pedido manualmente.
- `interpretText` es el único creador de ítems; si `/api/voice/parse` responde 500, solo se muestra `voiceError` (`589-596`, `657-659`). No hay fallback a `mockParse` en la excepción: `parseSale` usa mock solo si no hay clave o si el modelo no devuelve `parsed` (`voice.ts:62-64`, `99-101`).
- El campo de texto siempre visible no es un camino manual: al pulsar “Interpretar” vuelve a pasar por el parser.
- `ParsedSale.confidence` se devuelve (`voice.ts:36`) pero la UI lo ignora; un parse de baja confianza se presenta igual que uno seguro. No se separa “sugerencia” de “dato”.
- **Evidencia visual:** `stageshow/01-caja-en-reposo.png` (estado vacío sin “Agregar producto”), `stageshow/02-venta-dictada.png` (el botón aparece solo cuando ya hay 2 productos).

**Impacto:** incumple “la operación principal sigue si falla la IA” (`GOAL-ACOMPANAMIENTO.md:75`) y el must-pass de vender sin el asistente (`297`). Es un bloqueo total del negocio, no una degradación.

### 4.2 · Efectivo real y validación por ítem — **CRÍTICO / ALTO**

- `overpay = cashCents + creditCents > draftTotal` (`750`); si el cliente da $100 por $90, el botón queda deshabilitado (`1868-1878`). El hint solo dice “revisa el efectivo/fiado” (`1865`); el mensaje específico “El efectivo y el fiado no pueden superar el total” (`772-774`) es inalcanzable porque el botón está deshabilitado.
- No hay campo ni cálculo de cambio en la UI. El servidor recorta el efectivo al total (`orders.ts:50-54`), así que la solución natural es aceptar el billete, mostrar cambio y enviar el aplicado; hoy no se puede.
- **Validación en el lugar equivocado:** el cliente habilita “Confirmar venta” con `draftTotal > 0` (`751-756`), sin exigir precio > 0 ni descripción no vacía por ítem. El servidor sí lo exige (`api/orders/route.ts:5-9`) y responde “Datos de venta inválidos.” genérico. Un ítem nuevo nace con precio 0 (`1757-1761`); si hay otro ítem con precio, el total es > 0, el botón se habilita y el POST falla.
- Si todos los precios son 0, el botón se deshabilita sin mensaje; el usuario no sabe qué falta.
- **Evidencia visual:** `stageshow/02-venta-dictada.png` (campos “Efectivo recibido” y “A fiado”); `hig-after/draft-360.png` (ítems y campos, sin cambio).

**Impacto:** la venta en efectivo con billete grande es el caso más común de mostrador; hoy obliga a calcular el cambio mentalmente y mentir sobre lo recibido. La validación tardía hace fallar la venta al final, con el cliente enfrente.

### 4.3 · Doble pedido, doble link, doble demo, doble abono — **CRÍTICO**

- **Doble pedido:** `POST /api/orders` no recibe clave de idempotencia (`api/orders/route.ts:23-28`) y `createOrder` inserta siempre (`orders.ts:56-84`). Si la respuesta se pierde después del insert, el cliente conserva el draft y muestra “No pude crear la venta. Revisa tu conexión” (`824-825`); al reintentar, crea otra orden. La primera no se carga en el dashboard porque el error no llama `loadDashboard`.
- **Doble link:** `/api/orders/[id]/pay` devuelve el link existente si ya hay uno (`37`, `62`), lo cual es correcto en secuencia, pero no hay bloqueo ni transacción. Dos pestañas o dos POST concurrentes pueden crear dos links; el segundo sobrescribe `payment_link_id` (`orders.ts:128`) y el webhook rechaza el link viejo si `order.paymentLinkId !== paymentLinkId` (`pey-events.ts:113`).
- **Doble demo:** cada `/api/demo/pay` crea un `transactionId` nuevo (`demo/pay/route.ts:27`) y `recordPayment` solo deduplica por `transactionId` (`orders.ts:165-170`). El route lee el saldo antes de insertar (`demo/pay/route.ts:21-24`), pero no hay tope atómico: dos llamadas concurrentes de 90 sobre una orden de 90 pueden pasar ambas y dejar `paid_cents = 180`; el resumen demo suma 180 y la UI muestra `min(total, paid)`, ocultando el exceso (`paymentTruth` 3978).
- **Doble abono por voz:** `interpretText` no tiene guarda de concurrencia y el chip de muestra no se deshabilita durante `transcribing` (`1607-1617`); dos toques en “Juan pagó $50” pueden registrar dos abonos. `recordCreditPayment` no tiene idempotencia (`orders.ts:235-266`); el segundo se recorta al saldo, pero el ledger y el efectivo esperado quedan duplicados.

**Impacto:** incumple “continuidad + idempotencia” (`GOAL-ACOMPANAMIENTO.md:81`) y “no hay doble cobro” (`298`). El webhook de pey está protegido; la creación de la venta y el camino demo no.

### 4.4 · El cobro pendiente no se refresca y puede desaparecer — **CRÍTICO**

- El dashboard se carga al montar (`caja-app.tsx:263`) y después de acciones propias o del polling (`807`, `858`, `917`, `994`, `1020`, `1057`). No hay recarga al volver a la pestaña (`visibilitychange` solo detiene voz, `502-522`) ni al recuperar foco.
- El polling de la orden existe **solo** mientras `activeOrder` está abierto y no está `paid/fulfilled/cancelled` (`896-928`). Si el comerciante cierra el sheet, no hay polling. Si el cliente paga mientras el sheet está cerrado, la Caja sigue mostrando “Esperando al banco” y el resumen viejo hasta que otra acción recargue.
- El error de polling es silencioso (`921-923`): “no ha pagado” y “no pude comprobar” se ven igual.
- **“Por cobrar” es solo de hoy:** `getDailySummary` filtra `orders.created_at >= startOfDay` (`db.ts:612-616`). Un cobro pendiente de ayer no aparece en esa cifra.
- **Actividad es solo 30 pedidos:** `dashboard` pide `listOrders(30)` (`api/dashboard/route.ts:9`), `listOrders` ordena por fecha y limita (`db.ts:449-454`), y “Ver todo” solo alterna 5 vs 30 (`caja-app.tsx:3317`, `3428-3435`). Un pendiente viejo cae fuera y no hay otra vista.
- **No hay cancelar ni vencer:** `cancelled` existe en el tipo, pero ninguna ruta lo produce; `fulfillOrder` es la única transición de entrega y no hay transición a cancelado (`orders.ts:268-281`; `orders/[id]/route.ts:18-20`). “Cerrar cobro” solo oculta el sheet (`2246-2252`).
- **La expiración es copy fijo:** “expira en 10 minutos” (`2226`) no se calcula; `Order` no tiene `expiresAt` (`types.ts:25-46`), `attachQr` no guarda vencimiento (`orders.ts:135-147`) y el demo no vence.
- **La carga inicial rota se ve como vacío:** si `/api/dashboard` falla, el subtítulo queda “Cargando la caja…” (`1100-1111`) y Actividad “Aún no hay ventas” (`3333-3341`), sin reintento.
- **Riesgo operativo:** los links se guardan absolutos con `appUrl()` (`pey.ts:74-78`, `81-91`); el túnel es temporal (`demo/STATUS.md:32`). El pendiente vivo apunta a un túnel temporal (no a un dominio estable); respondió 200 en esta auditoría, pero un cambio de túnel deja links guardados muertos.

**Impacto:** el must-pass “Pendientes permite completar, posponer y eliminar” (`GOAL-ACOMPANAMIENTO.md:300`) no tiene implementación; peor, un pendiente puede volverse invisible sin haberse cobrado.

### 4.5 · El abono por voz se registra solo y siempre como efectivo — **CRÍTICO**

- `interpretText` detecta `intent === "credit_payment"`, busca el fiado por nombre en el texto y hace `POST /api/credits/{id}/pay` inmediatamente (`caja-app.tsx:604-632`), con `method: "cash"` fijo (`619`). No hay sheet, confirmación, ni elección de método.
- La pantalla dice “La IA interpreta; tú confirmas.” (`1576`). En este camino no confirmas: el registro ya ocurrió y el mensaje “Abono de $50 a Juan. Saldo: $0” se muestra después (`625-629`).
- Si el cliente pagó por transferencia, el abono queda como efectivo y el corte espera ese dinero en la caja (`cash.ts` suma `cashCreditCents`); aparecerá un faltante falso.
- Si el monto parseado supera el saldo, `recordCreditPayment` lo recorta (`orders.ts:245`), pero el mensaje hablado usa el monto parseado (`625-627`): dice “Abono de $100” cuando el ledger registró $50.
- El chip “Juan pagó $50” (`103-107`, `1151-1155`, `1607-1617`) dispara este camino con un toque y no está condicionado a `demoMode`; en una caja real seguiría visible.
- El abono manual (`CreditPaySheet`, `3631-3666`) sí pregunta método y tiene descarte; el camino de voz lo evita. Es la prueba de que el patrón correcto ya existe.

**Impacto:** viola “la IA no tiene autoridad financiera” (`GOAL-ACOMPANAMIENTO.md:72`) y “no se recuerda fiado a terceros sin consentimiento” (`77`). Es una escritura financiera sin aprobación humana, con método potencialmente incorrecto.

### 4.6 · Estados y cifras ambiguas — **ALTO**

- **“Pedido entregado” para una venta a fiado recién creada.** `createOrder` pone `fulfilled` cuando no hay saldo digital y hay fiado (`orders.ts:110-115`); `paymentSheetTitle` comprueba `fulfilled` antes de mirar el fiado (`3998-4012`). El sheet se titula “Pedido entregado” mientras el contenido dice “Quedó anotado” (`1965-1977`). La Actividad, en cambio, la llama “Fiado” (`3403-3415`).
- **Un abono parcial en efectivo se titula “Resultado del cobro”.** `paymentSheetTitle` devuelve ese título si `truth.isCash` (`4005`), y `isCash` es verdadero con cualquier efectivo (`3979-3990`), aunque el `status` sea `confirmed` y quede saldo digital. El cuerpo sigue en modo cobro pendiente (`1914`).
- **Ese mismo pedido se ve como “Efectivo” completo en Actividad.** `cash` se calcula con `truth.isCash` sin comprobar que `paidCents >= total` (`3348`), y la fila muestra `order.totalCents` (`3420`), no el saldo. Un pedido de $90 con $50 en efectivo y $40 por link se lee “Efectivo $90”; el pendiente desaparece de la lista.
- **“Hoy” suma pendientes y demo, y excluye fiado.** La línea `Hoy ${cash + verified + demo + pending}` (`1102-1109`) usa `pendingCents` (`db.ts:612-616`), pero no el fiado; el “Fiado” que muestra es global (`618-620`). En la lectura viva: efectivo $70, pendiente $120, fiado $50; la Caja dice “Hoy $190”, el analítica dice “Ventas $190 / Cobrado $70 / Por cobrar $120” y la voz diría “Hoy llevas $70”.
- **La voz cuenta distinto.** `answerLocal` suma `verified + demo + cash` (`564-576`), excluye pendientes y fiado, y usa `paidOrderCount`, que cuenta pedidos `fulfilled` de fiado (`db.ts:606-610`). Una venta a fiado puede producir “Hoy llevas $0.00 en 1 ventas”.
- **“Por cobrar” agrupa tres acciones distintas:** `confirmed` (falta generar link), `payment_pending` (esperando banco) y `partially_paid` (falta un pago). El sheet de `confirmed` ya dice “Pago pendiente” antes de que exista una solicitud (`1914`, `2089-2093`).
- **El registro persistente diluye “verificado”.** El `PaidSheet` dice “Pago verificado”, pero la Actividad de un pedido pey dice “Pagado” o “Entregado”, nunca “Verificado por pey” (`3403-3415`); el demo sí dice “Demo”. En la lista larga, “verificado por pey” no es una etiqueta, es una inferencia.
- **`demo_paid` vuelve a disparar el resultado.** El efecto de polling excluye `paid`, `fulfilled` y `cancelled`, pero no `demo_paid` (`898`); al abrir un pedido demo pagado, a los 3 s puede abrir otra vez el `PaidSheet` y repetir el audio (`907-917`).

**Impacto:** la persona no puede explicar con una sola cifra cuánto vendió, cuánto cobró y cuánto le deben. La fuente es la misma; las agregaciones no.

### 4.7 · Copy que promete de más o describe mal — **ALTO / MEDIO**

- “Pago pendiente; aún no entregues” (`2091`) aparece **antes** de generar link/QR; lo correcto sería “Todavía no le pediste el pago”.
- “Cerrar cobro” (`2251`) suena a cancelar; en realidad deja el pedido pendiente. La X, el backdrop y Esc hacen lo mismo sin advertencia (`1270-1274`, `4312-4317`).
- “expira en 10 minutos” (`2226`) es estático; a los 20 minutos sigue diciéndolo.
- “Link de pago · CoDi + tarjeta + wallets” (`2109`) y el checkout con Tarjeta/Wallet (`checkout-client.tsx:60-86`) prometen un riel no verificado; `GOAL.md:37` pide ajustar el pitch a lo que el checkout real ofrece.
- “Hoy llevas … en 1 ventas” (`576`): plural incorrecto y, más importante, “vendí” vs “cobré”.
- Los errores de IA/red en `interpretText` y `generatePayment` muestran `error.message` crudo (`657-659`, `859-861`); un fallo de OpenAI puede aparecer en inglés o con código técnico, mientras `createOrder` sí usa `friendlyError` (`824-825`).
- El estado `showTextInput` no controla nada: el campo “Escribe la venta” está siempre visible (`1580-1604`); no hay un modo “solo texto” real, aunque el fallback funciona por accidente.

**Impacto:** no es cosmético: “pendiente” y “cerrado” son estados financieros; el copy actual hace que la persona tome la acción equivocada.

### 4.8 · Artefactos de demo sin puerta — **MEDIO**

- Los chips “Quesadillas $90”, “Juan pagó $50” y “¿Cuánto vendí?” se renderizan siempre (`1606-1617`), sin `demoMode`. El de “Juan pagó” escribe un abono real en la libreta. En una caja en producción, un toque accidental altera el fiado.
- “Probar con un comprobante falso” también está siempre visible (`3767-3773`); no marca pagado, pero es una affordance de demo en la pantalla de cobro real.
- El QR de “QR CoDi directo” en demo codifica un JSON, no una URL pagable (`pey.ts:113-118`); el único cierre es el botón “Simular CoDi” del comerciante. La captura `stageshow/04-link-y-qr.png` muestra el QR como si fuera escaneable.

**Impacto:** la demo está declarada con el badge DEMO, pero las acciones de demo no están aisladas. La separación por pedido es buena; la separación por control no.

---

## 5 · Candidatos P0 (máximo 5)

> **Criterio de esfuerzo:** S < ½ día · M 1–2 días · L > 2 días. Los rangos son para este repo, no una promesa.
> **Regla:** ningún candidato rediseña la app ni toca el contrato del webhook. Todos reutilizan componentes existentes.

| # | Candidato | Categoría | Cambio mínimo | Impacto | Esfuerzo | Riesgo |
|---|---|---|---|---|---|---|
| **1** | **Vender sin IA y cerrar el efectivo real** | sin IA | “Agregar producto” en el estado vacío; validar descripción/precio por ítem inline; aceptar efectivo entregado > total, mostrar cambio y enviar el aplicado; fallback determinista si el parser falla | Crítico: desbloquea la venta y el caso $100/$90 | M | Medio: el ledger debe guardar el aplicado, no el cambio; probar 0/precio vacío |
| **2** | **Borrador durable y reanudación** | borrador durable | Guardar draft + `activeOrderId` en `localStorage` con versión y hora; banner “Recuperé tu venta de las HH:MM”; descartar explícito; limpiar solo con confirmación; append vs replace explícito | Alto: cumple el must-pass de interrupción | M | Medio: borrador viejo o equipo compartido; nunca auto-enviar; no guardar datos sensibles |
| **3** | **Cobros pendientes visibles y refreshed** | estado visible | Franja “Cobros pendientes” arriba de Caja con monto, ítem, hora y estado (“sin link” / “esperando banco” / “parcial”); recargar dashboard en `visibilitychange`/foco y hacer polling de pendientes mientras la pestaña está visible; mostrar “última comprobación” y error de red; fecha y saldo real en Actividad (no “Efectivo” completo si hay pendiente) | Alto: evita cobros olvidados y falsos “no me ha pagado” | M | Medio: polling y overlays duplicados; no abrir `PaidSheet` solo, usar aviso |
| **4** | **Escrituras únicas y confirmadas** | sin IA / integridad | Clave de idempotencia por draft en `POST /api/orders`; bloqueo/una sola solicitud de link por orden; tope atómico de `/api/demo/pay` al saldo; abono por voz abre el `CreditPaySheet` prellenado y exige confirmación + método; chips de demo condicionados a `demoMode` | Crítico: evita doble venta, doble link, doble demo y abono no autorizado | M | Medio: migración SQLite y flujo de confirmación; probar reintentos y dos pestañas |
| **5** | **Verdad del dinero y copy del cobro** | copy | “Cobrado hoy / Por cobrar / Fiado total” en Caja y en la voz; “Verificado por pey” en Actividad; “Pago pendiente” solo después del link; “Cerrar cobro” → “Dejar pendiente”; título de fiado sin “Pedido entregado”; mostrar precios y reparto efectivo/fiado en el sheet; una acción primaria de cobro (link, QR secundario); quitar la promesa tarjeta/wallet no verificada | Alto: elimina cifras contradictorias y estados falsos | S–M | Bajo: no toca la verdad por pedido; requiere acordar definiciones |

### P0-1 · Vender sin IA y cerrar el efectivo real

**Qué se cambia, en concreto:** el estado vacío de “Pedido en curso” gana un botón “Agregar producto” que crea una fila editable; “Confirmar venta” valida que cada ítem tenga descripción y precio > 0, enfoca el primero inválido y explica; el campo de efectivo acepta el billete entregado, calcula `cambio = max(0, recibido - (total - fiado))` y envía solo el aplicado; si el parser falla, se ofrece “Escribir productos” sin borrar lo que había.

**Por qué primero:** es la única cosa que hoy impide vender por completo si la IA no responde, y el caso del billete grande es cotidiano. No requiere cambiar el esquema de la orden: el servidor ya recorta el efectivo; hay que dejar de bloquear y mostrar el cambio.

**Cómo se prueba:** con `/api/voice/parse` devolviendo 500, crear una venta manual de 2 ítems; con total $90 y recibido $100, ver cambio $10 y orden con `paidCents = 9000`; con un ítem en $0, ver el error en ese ítem antes del POST.

### P0-2 · Borrador durable y reanudación

**Qué se cambia:** un objeto `draft` versionado en `localStorage` (`items`, `cashCents`, `creditCents`, `customerName`, `transcript`, `textInput`, `updatedAt`) y el `activeOrderId` del cobro en curso. Al montar, si hay draft, mostrar banner con hora y dos acciones: “Continuar” / “Descartar”. El draft se limpia solo con “Limpiar” confirmado o cuando la orden se crea; nunca al cerrar el sheet. “Limpiar” pide confirmación o permite undo.

**Por qué:** el must-pass de interrupción no admite “el estado vive en React”. La app ya sabe persistir preferencias; el mismo mecanismo, con consentimiento y descarte, resuelve la venta.

**Cómo se prueba:** dictar 2 ítems, recargar, continuar, confirmar; cerrar el sheet de cobro, recargar, reabrir el pendiente; verificar que no se creó una segunda orden.

**Riesgo a vigilar:** un borrador de ayer no debe enviarse solo ni mezclarse con una venta nueva; la fecha visible y el descarte explícito son parte del diseño.

### P0-3 · Cobros pendientes visibles y refreshed

**Qué se cambia:** una franja compacta arriba de Caja, derivada de `dashboard.orders`, con `confirmed` / `payment_pending` / `partially_paid`, monto y etiqueta “sin link” / “esperando banco” / “parcial”; un botón “Ver” que abre el sheet. Recargar `loadDashboard` al volver a la pestaña y al recuperar foco; polling de pendientes mientras la pestaña está visible; mostrar “Última comprobación HH:MM” y, si falla, “No pude comprobar; reintentar”. En Actividad, mostrar fecha cuando no sea hoy y no rotular “Efectivo” un pedido con saldo: mostrar el pendiente y el monto realmente cobrado.

**Por qué:** hoy el pendiente de ayer no está en “Por cobrar” y puede caer fuera de los 30; el de hoy no se refresca si el sheet está cerrado. Es el must-pass de Pendientes en su porción de cobro, sin construir el módulo completo de tareas.

**Cómo se prueba:** crear un pendiente, cerrar el sheet, pagar desde otra pestaña y ver la Caja actualizarse sin abrir el pedido; un pendiente de ayer sigue visible; “sin link” y “esperando banco” se distinguen.

**Riesgo:** no abrir `PaidSheet` automáticamente (interrumpiría); usar un aviso discreto y dejar que la persona abra el resultado.

### P0-4 · Escrituras únicas y confirmadas

**Qué se cambia:** el cliente genera un `clientRequestId` por draft y lo manda en `POST /api/orders`; el servidor lo guarda con índice único y devuelve la orden existente ante un reintento. La generación de link/QR se serializa por orden (una sola solicitud). `/api/demo/pay` no acepta un monto mayor al saldo y rechaza si el saldo es 0. El abono por voz deja de hacer POST: abre `CreditPaySheet` con cliente y monto, método editable y botón “Registrar abono”. Los chips de muestra se ocultan fuera de `demoMode` y se deshabilitan mientras `transcribing`.

**Por qué:** el webhook ya es idempotente, pero la venta y el camino demo no; y el abono por voz es una escritura que la IA hace sin aprobación. Es la ley 2 y la 11 del goal.

**Cómo se prueba:** simular pérdida de respuesta después del insert y reintentar → una sola orden; dos POST concurrentes de link → un solo `payment_link_id`; dos demo pay → `paidCents <= total`; decir “Juan me pagó 50” → sheet prellenado, ledger intacto hasta confirmar; elegir “Digital” y ver el corte correcto.

**Riesgo:** la migración de SQLite y el estado de confirmación; hacerlo con una columna nullable + índice único y un caso de prueba de reintento.

### P0-5 · Verdad del dinero y copy del cobro

**Qué se cambia:** la línea de Caja pasa a “Cobrado hoy $70 · Por cobrar $120 · Fiado total $50” (o “Vendido hoy” si se decide incluir fiado, pero con etiqueta y suma explícitas); la voz usa la misma separación; la Actividad distingue “Verificado por pey” de “Efectivo” y “Demo”; “Pago pendiente” solo aparece cuando ya hay link/QR; “Cerrar cobro” se convierte en “Dejar pendiente” con la frase “Sigue en Cobros pendientes”; una venta a fiado no se titula “Pedido entregado”; el sheet muestra los precios que ya existen en `order.items` y el reparto efectivo/fiado; se elige una acción primaria de cobro (link; QR como alternativa) y se quita “tarjeta + wallets” si no está verificado.

**Por qué:** es barato, se ve en la primera pantalla y elimina dos cifras contradictorias. No cambia la verdad por pedido; solo deja de esconderla.

**Cómo se prueba:** la Caja, la voz y la tarjeta de analítica dicen lo mismo; una venta a fiado no dice “entregado”; antes del link no dice “pago pendiente”; el total del sheet muestra el desglose.

---

## 6 · Evidencia

### 6.1 Código

| Afirmación | Archivo:línea |
|---|---|
| El draft es estado React; no hay persistencia de venta | `web/src/components/caja-app.tsx:166-170`; `localStorage` solo en `244-258` (tema/voz), no en draft |
| Se limpia el draft al crear la orden, antes de cobrar | `caja-app.tsx:800-807`; “Limpiar” sin confirmación en `1161-1168` |
| No hay “Agregar producto” en el estado vacío | `caja-app.tsx:1661-1782`; botón dentro de `draftItems.length > 0` en `1751`; vacío en `1770-1781` |
| El parser es el único camino de creación; no hay fallback en excepción | `web/src/lib/voice.ts:62-64`, `99-101`; `web/src/app/api/voice/parse/route.ts:12-17`; `caja-app.tsx:589-596`, `657-659` |
| La confianza del parser se ignora | `voice.ts:36`; `caja-app.tsx:594-654` no lee `confidence` |
| Sobrepago de efectivo bloquea; no hay cambio | `caja-app.tsx:749-756`, `1868-1878`, `1859-1866`; servidor recorta en `web/src/lib/orders.ts:50-54` |
| Ítem con precio 0 o descripción vacía pasa el cliente y falla en servidor | `caja-app.tsx:751-756`, `1668-1675`, `1729-1745`, `1757-1761`; `web/src/app/api/orders/route.ts:5-9`; cliente `786-790` |
| El abono por voz se registra solo y como efectivo | `caja-app.tsx:604-632`; `method: "cash"` en `619`; mensaje con monto parseado en `625-627`; clamp en `orders.ts:245` |
| El chip “Juan pagó” escribe y no está gateado por demo | `caja-app.tsx:103-107`, `1151-1155`, `1607-1617` |
| La UI promete “tú confirmas” en el mismo panel del abono automático | `caja-app.tsx:1576` |
| Crear orden no tiene idempotencia | `api/orders/route.ts:23-28`; `orders.ts:56-84`; reintento en `caja-app.tsx:782-797`, `824-825` |
| Link secuencial idempotente, concurrente no | `api/orders/[id]/pay/route.ts:37`, `62`; `orders.ts:128`; rechazo de link viejo en `web/src/lib/pey-events.ts:113` |
| Demo pay no tiene tope atómico ni idempotencia de intento | `api/demo/pay/route.ts:21-24`, `27`, `45-52`; `orders.ts:165-170`, `201-223` |
| Polling solo con el sheet abierto; error silencioso | `caja-app.tsx:896-928`, `921-923`; cargas en `263`, `807`, `858`, `917`, `994`, `1020`, `1057`; sin recarga en `visibilitychange` (`502-522`) |
| “Por cobrar” es solo de hoy; Actividad solo 30 | `web/src/lib/db.ts:612-616`; `api/dashboard/route.ts:9`; `db.ts:449-454`; `caja-app.tsx:3317`, `3428-3435` |
| No hay cancelar/vencer; “Cerrar cobro” solo cierra | `orders.ts:268-281`; `api/orders/[id]/route.ts:18-20`; `caja-app.tsx:2246-2252` |
| “Expira en 10 minutos” es fijo; no hay fecha de expiración | `caja-app.tsx:2226`; `types.ts:25-46`; `orders.ts:135-147`; `pey.ts:124` |
| “Hoy” suma pendientes y demo, no separa; fiado es global | `caja-app.tsx:1102-1109`; `db.ts:612-627`; `db.ts:618-620` |
| La voz resta pendientes/fiado y cuenta `fulfilled` de fiado | `caja-app.tsx:564-576`; `db.ts:606-610`; `orders.ts:110-115` |
| Una venta a fiado se titula “Pedido entregado” | `orders.ts:110-115`; `caja-app.tsx:3998-4012`; contenido `1965-1977` |
| Un abono parcial en efectivo se titula “Resultado del cobro” y se ve “Efectivo” completo | `caja-app.tsx:4005`, `3348`, `3420`, `1914`; `paymentTruth` en `3979-3990` |
| La Actividad no muestra precios, cliente ni fecha | `caja-app.tsx:3390-3417`; `format.ts:17-22`; `PaymentPanel` ítems sin precio en `2083` |
| “Pago pendiente” antes de existir link | `caja-app.tsx:1914`, `2089-2093`; `confirmed` en `orders.ts:68` |
| Link ya incluye QR; la segunda opción es redundante | `caja-app.tsx:2107-2110`, `2178-2181`, `2215-2228`, `2130-2132` |
| Promesa tarjeta/wallet no verificada | `caja-app.tsx:2109`; `web/src/app/pay/[id]/checkout-client.tsx:60-86`; `GOAL.md:37` |
| Carrera del micrófono en el primer permiso | `caja-app.tsx:666-726`, `728-739`, `1495-1508` |
| Carga inicial fallida se ve como vacío | `caja-app.tsx:225-237`, `1100-1111`, `3333-3341` |
| `demo_paid` no se excluye del polling | `caja-app.tsx:898`, `907-917` |
| La verdad por pedido sí distingue cash/demo/pey/fiado | `caja-app.tsx:3976-3996`; `PaidSheet` en `4356-4495` |
| El abono manual tiene descarte y método | `caja-app.tsx:3554-3572`, `3631-3666` |

### 6.2 Capturas

| Captura | Qué demuestra |
|---|---|
| `demo/stageshow/01-caja-en-reposo.png` | Primera pantalla: “Hoy $190 · Por cobrar $120 · Fiado $50”; chips de muestra; “Pedido en curso” vacío sin “Agregar producto” |
| `demo/stageshow/02-venta-dictada.png` | Tras dictar, el scroll deja fuera micrófono y transcripción; se ven 2 ítems, efectivo/fiado y “Confirmar venta” |
| `demo/stageshow/03-cobro-pendiente.png` | “Cobrar $90”, badge “POR COBRAR”, “Pago pendiente” antes de link, y decisión Link vs QR |
| `demo/stageshow/04-link-y-qr.png` | “Esperando al banco”, botones de simulación demo y QR; el QR demo no es una URL pagable |
| `demo/stageshow/05-pago-simulado.png` | Resultado “Pago simulado”, “No se movió dinero real”, “Listo para entregar” |
| `demo/mobile-360-fold.png` | En 360, la primera pantalla no muestra Actividad ni pedido; el resumen mezcla alcances |
| `demo/mobile-360-cobro.png` | El modal de cobro se superpone a “La caja está lista / Todavía no hay productos”; no hay cliente ni desglose; “Cerrar cobro” |
| `demo/mobile-360-pagado.png` | Resultado demo en móvil; verdad demo clara |
| `demo/hig-after/draft-360.png` | Draft en 360: ítems, efectivo/fiado; “Confirmar venta” queda debajo del pliegue |
| `demo/hig-after/home-360-full.png` | Actividad debajo del formulario; fila “Esperando al banco” con hora, sin fecha ni cliente |
| `demo/hig-after/payment-360.png` | Misma decisión Link/QR en móvil |
| `demo/hig-after/link-360.png` | Cobro pendiente con QR; “expira” no visible sin scroll |

### 6.3 Servidor vivo (solo lectura)

Consulta `GET http://localhost:3000/api/dashboard` durante la auditoría:

```text
cashCents: 7000 · pendingCents: 12000 · creditCents: 5000
orderCount: 2 · paidOrderCount: 1
```

`GET /api/analytics?period=today`:

```text
salesCents: 19000 · collectedCents: 7000 · pendingCents: 12000 · creditCents: 5000
```

La Caja muestra “Hoy $190.00 · Por cobrar $120.00 · Fiado $50.00”. El dinero realmente cobrado en efectivo es **$70**. El pendiente vivo tiene `paymentUrl` de un túnel temporal (no de un dominio estable); `curl` devolvió `200` al momento de la auditoría, pero el link es absoluto y el túnel puede cambiar. No se creó ninguna venta ni se modificó la demo.

---

## 7 · Lo que no pude verificar

- **No probé con una persona ni con 6–8 comerciantes.** No hay NASA-TLX, tiempo ni tasa de error; los pasos son un conteo estructural.
- **No usé teléfono físico, TalkBack ni VoiceOver.** La evidencia de accesibilidad es la de `STATE.md`/Playwright, no una prueba con lector de pantalla.
- **No inyecté una falla real de OpenAI.** El camino “parser 500” está inferido del código; no leí `.env.local` ni provoqué el error para no gastar una llamada ni tocar la demo.
- **No creé una venta real ni un abono.** No hay captura de un draft recargado porque ese estado no existe; la ausencia está probada por código, no por video.
- **No corrí Playwright ni `verify:*`.** No hay una regresión medida en este commit; la tabla de `STATE.md` es histórica.
- **No verifiqué el checkout real de pey** ni si la cuenta soporta tarjeta/wallet; el $0.01 sigue bloqueado según `STATE.md`.
- **No medí la latencia del parser, del TTS ni del polling** en un teléfono con red móvil.
- **No verifiqué el comportamiento de los inputs numéricos controlados al teclear** (precio/efectivo se reformatean a 2 decimales en cada cambio, `1729-1745` y `1794-1803`); sospecho saltos de cursor, pero no lo probé en dispositivo.
- **No verifiqué la política de `localStorage`** en modo privado/cuota; no hay draft que probar.
- **No verifiqué si el túnel vivo seguirá disponible** al momento de la demo; el link del pendiente respondió 200 hoy.
- **Las capturas son artefactos existentes** de `demo/stageshow` y `demo/hig-after`, no recapturas de este commit. El código de UI no cambió entre `999848f` y `26d06ce` (este último solo toca docs), pero no lo re-filmé.

---

## 8 · Promesas del goal frente al flujo actual

| Promesa (`GOAL-ACOMPANAMIENTO.md`) | Estado | Evidencia |
|---|---|---|
| Abrir, vender, cobrar, anotar y cerrar **sin el asistente de IA** (`297`) | **No** | No hay captura manual desde cero; el parser es el único creador (`1751`, `1770-1781`) |
| “Pendiente” y “verificado” inequívocos; demo nunca verificado; **no doble cobro** (`298`) | **Parcial** | La verdad por pedido es buena (`3976-3996`); “Hoy” mezcla (`1102-1109`); la orden y el demo se pueden duplicar (`orders/route.ts:23-28`, `demo/pay:27`) |
| Una venta interrumpida se recupera con productos, importe, forma de pago y estado (`299`) | **No** | Draft solo en React (`166-170`); no hay restauración de `activeOrder`; solo Actividad |
| **Pendientes** permite completar, posponer y eliminar (`300`) | **No** | No existe el módulo; `TABS` solo tiene Caja/Fiado/Corte/Meta (`4040-4045`); “Por cobrar” es de hoy (`db.ts:612-616`) |
| La operación principal sigue si falla la IA o la red; los límites se muestran (`303`) | **No** | Parser bloquea la venta; polling silencioso (`921-923`); carga inicial se ve como vacío |
| Las recomendaciones explican su origen y no diagnostican (`302`) | **Fuera de alcance de venta** | No se auditaron; el parser no expone confianza |
| Los registros se exportan y entienden (`304`) | **No auditado** | Fuera de este corte |
| No regresiones: webhook 27 aserciones de esa fase, HIG/WCAG, móvil/checkout, build (`305`) | **No ejecutado** | Instrucción de no correr gates; `STATE.md` es histórico |

**Conclusión de cumplimiento:** de los must-pass que tocan venta/cobro, hoy no se cumple completo ninguno; el más cercano es la verdad por pedido/demo, que es sólida en el resultado pero se diluye en la Caja y la Actividad. Fallan venta sin IA, recuperación de interrupción, Pendientes y operación con red/IA caída. No se puede afirmar que el flujo de venta y cobro esté listo para el P0 sin al menos P0-1, P0-2 y P0-3.

---

## 9 · Lo que se debe preservar

- **La verdad por pedido:** `paymentTruth` y el `PaidSheet` deben seguir distinguiendo efectivo, demo, pey, fiado y mixto. No reemplazar por un flag global.
- **La separación demo/real:** el sello DEMO, “Pago simulado”, “No se movió dinero real” y el rechazo de comprobantes demo son correctos.
- **Los targets y el foco:** 48 px, foco atrapado en el sheet, texto 200%, `prefers-reduced-motion`.
- **El patrón de descarte del abono manual:** sirve para el draft y para “Limpiar”.
- **La identidad “Mostrador claro”:** los cambios propuestos son estados, validaciones y copy; no un rediseño.

**No haría en P0:** chatbot, inventario, notificaciones, nuevas pestañas, un motor de recomendaciones ni un rediseño del cobro. El goal pide primero que abrir, vender, cobrar, anotar y cerrar sean claros.

---

*Auditoría de solo lectura. La única escritura de este trabajo es este archivo. No se modificó código, base de datos ni demo.*
