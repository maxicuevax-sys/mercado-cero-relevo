# A — Revisión independiente del ensamblaje B

**Veredicto: NO-GO condicionado para aceptar el ensamblaje como terminado.** El smoke de lectura y navegación pasa; hay un defecto nuevo de verdad financiera visible, B2 sigue abierto y falta evidencia válida del harness. Esta revisión no autoriza merge, publicación ni pagos reales.

## Identidad y límites

- Revisado el 6 de noviembre de 2026, dentro del timebox de 25 minutos.
- Worktree: `integration-assembly`; rama `revision/assembly-2`.
- HEAD/build servido: `f9389bc17c8dbf673edc6ce3677e327f0aaf5021`.
- Padres del merge: `d1fe344fcaa15a5625d09db10a6e049c6464ba03` y `d15027862fb93884440cb6d91962d4c59000649e` (`revision/caja-b`).
- Diff examinado: `d1fe344..revision/caja-b`, 24 archivos, +695/−369 líneas. El diff del ensamblaje frente a `d1fe344` tiene el mismo alcance.
- Runtime inspeccionado: **http://127.0.0.1:4580**. No se accedió a 4497, no se reinició el servidor, no se recompiló, no se hizo merge/push/commit ni se editó producto.
- El árbol ya venía sucio: `quality-reports/oleada-b-estabilizacion/evidencia/oleada-b1-regression.json`. Se conservó. Los scripts de esta revisión y las capturas viven en el directorio ignorado `harness/evidence/exact-parity/a-review-b/`.
- Navegador: Chromium de Playwright, 390×844, 320×844 y 941×844. Es evidencia de escritorio con viewport ajustado, no de Safari/iOS ni dispositivo físico.

## Hallazgos priorizados

### P1 · Nuevo en B: la cabecera atribuye al pago digital el total de una venta mixta

**Ubicación:** `web/src/components/caja/sale-result.tsx:98-100`.

Siempre que `hasDigital` es verdadero, la nueva tarjeta muestra `order.totalCents`, seguido de **“Pago digital recibido” / “Cobrado”**. El total puede incluir efectivo y deuda de fiado. Antes el importe estaba rotulado “Total de la venta”.

Se reprodujo con el componente real mediante `renderToStaticMarkup`, sin servidor, API ni escritura al ledger: total **$100**, recibido **$60** ($20 efectivo + $40 digital), fiado **$40**, saldo digital por cobrar **$0**. `saleMoney` devuelve `openCredit:true`, pero la tarjeta renderiza **“$100.00 / Pago digital recibido / Cobrado”**. Aunque el desglose inferior distingue los importes, la afirmación principal es incorrecta.

**Evidencia:** [render del componente y datos](harness/evidence/exact-parity/a-review-b/mixed-receipt-component.json), [reproductor](harness/evidence/exact-parity/a-review-b/render-component.cjs). Es una reproducción sintética del componente, **no un pago real ni una venta creada en 4580**.

**Condición de cierre:** mostrar `digitalPaidCents` si la etiqueta es “Pago digital recibido”, o conservar “Total de la venta” y separar cobrado/fiado. Verificar digital puro y mixto efectivo/digital/fiado, en demo y entorno real aislado. No basta ajustar el desglose inferior.

### P1 · B2 sigue abierto: ticket de ejemplo sin Descartar accesible a 390 px

**Ubicaciones:** `caja-screen.tsx:206-214`, `caja-spec.css:36-40`, `sale-summary.tsx:250-253` dentro de `web/src/components/caja/`.

Con un contexto nuevo, Caja carga Tortilla/Huevo/Refresco y total **$140**. A 390 px hay un botón “Descartar venta” en el DOM, pero su contenedor `.mc-caja-summary` tiene `display:none`: **0 botones accesibles**, `visible:false`. No hay sustituto visible en M02. Se pueden quitar conceptos individualmente, pero eso no cumple Descartar. La captura tampoco presenta una advertencia visible de ticket de ejemplo/demo en M02; la advertencia aparece después, en M03.

**Evidencia:** [medición B2](harness/evidence/exact-parity/a-review-b/smoke.json), [Caja 390](harness/evidence/exact-parity/a-review-b/390-caja.png), [Caja 320](harness/evidence/exact-parity/a-review-b/320-caja.png). El intento inicial de pulsarlo terminó en timeout por invisibilidad; no hubo descarte ni mutación del servidor.

**Origen:** limitación heredada de `d1fe344`, conservada por B; no se atribuye como regresión nueva. Sí bloquea cerrar el B2 solicitado.

**Condición de cierre:** advertir que es un ejemplo antes de registrar y ofrecer Descartar visible/operable a 390 y 320, conservando la confirmación y los borradores reales.

### P1 · Gate de entrega sin acreditar: árbol sucio y latest estático ausente

Se ejecutó `npm run verify:fast`: **guard, lint y types PASS (3/3)**, pero el harness terminó **FALLÓ / ok:false** por `gitAtStart.dirty=true` y árbol sucio al final. No equivale a un gate de entrega aprobado.

Se ejecutó `npm run verify:evidence -- --static`: **FAIL**, falta `harness/evidence/latest-static.json`. Tampoco existe `latest.json` full en este worktree. La evidencia del informe de B para otros commits no acredita automáticamente el merge `f9389bc`.

**Evidencia:** [verify:fast](harness/evidence/exact-parity/a-review-b/verify-fast.txt), [verify:evidence](harness/evidence/exact-parity/a-review-b/verify-evidence-static.txt), corrida `harness/evidence/runs/2026-11-07T03-23-04-159Z-fast.json`.

**Condición de cierre:** el dueño debe resolver la suciedad sin perder trabajo ajeno, generar static completo sobre el SHA final limpio y obtener `verify:evidence -- --static` PASS. Para handoff público se requieren además los gates full y sus dependencias; esta revisión no los sustituye.

### P2 · B5 / Detalle de venta: cobertura parcial, no cierre

El componente del comprobante sí contiene **Estado → “Demo (simulado)”** (`sale-result.tsx:116-117`) y `isDemoSale` considera modo demo, `demo_paid` y `lastPaymentDemo`. El texto es semánticamente honesto, aunque no es la cadena literal “Estado: Demo”.

Sin embargo, en `/ventas` solo se encontró **“Ver conceptos”**: al expandir muestra conceptos, cantidad y precio. No hay un control “Detalle de venta” ni una etiqueta “Estado” dentro del detalle expandido en ninguno de los tres anchos. `/ventas/[id]` no está implementada; un sondeo inicial a esa URL supuesta devolvió 404 y fue excluido del smoke válido. No se presenta como enlace roto del producto.

**Evidencia:** [interacciones](harness/evidence/exact-parity/a-review-b/interactions.json), [Ventas expandida](harness/evidence/exact-parity/a-review-b/390-ventas-expanded.png), `web/src/app/ventas/page.tsx:317-332`.

**Origen:** ausencia ya presente en la base; el diff B no modifica Ventas. **Condición:** acreditar la entrada y vista esperadas de Detalle de venta, o delimitar explícitamente que B5 se acepta en el comprobante. No declarar ambos equivalentes sin decisión humana.

## Comprobaciones independientes

| Prueba | Resultado y alcance |
|---|---|
| Identidad del build existente | `.next/BUILD_SHA` y `/api/health` coinciden con `f9389bc…`. Prueba identidad y servicio; no certifica una nueva compilación ni static PASS. |
| Smoke de 10 rutas × 3 anchos | **30/30 HTTP 200**, 0 `pageerror`, 0 desbordamientos horizontales. Capturas inspeccionadas; esto no demuestra los flujos que escriben datos. |
| Navegación desde Inicio | **24/24** recorridos: Ventas, Fiados, Caja y, mediante Más, Corte, Metas, Pendientes, Ayuda y Ajustes, en los tres anchos. |
| Caja/M03 móvil | Ticket y método renderizan a 390/320; Registrar abre M03, Continuar abre revisión y Volver regresa a composición. A 941 se conserva el formulario de cobro de escritorio; M03 no se presenta como recorrido desktop probado. |
| Ayuda | Búsqueda “fiados” abre explicación correcta; Enviar mensaje informa que soporte no está conectado. |
| Ajustes | Voz desactivada persiste tras recarga; Cerrar sesión explica que no existe sesión local que cerrar. Sin cambio de entorno ni backend. |
| M04 pendiente | Recuperado un pedido existente mediante el puntero local de pendientes. “Confirmar pago · consultar estado” conserva íntegro el objeto del servidor: `payment_pending`, `paidCents:0`, en los tres anchos. |
| Comprobante demo público | `/pay/demo_hist_2_ord_487ea8b88b9a45fa8ce3` muestra “Pago demo (simulado)” y “No es dinero real. No se entrega.” No es la nueva tarjeta de resultado de Caja. |
| Verify demo | GET con identificador demo devuelve **`verified:false`**; también se consultó el identificador mostrado por el comprobante. `reason:not_found` no acredita un pago pey. |
| Verdad del diff | No cambia `lib/`, APIs financieras, webhook, `/pay/**`, shell/nav compartido, Inicio, Fiados, Corte, Metas ni Pendientes. No se encontró un nuevo camino de cliente que escriba `paid`. |

Rutas del smoke: `/inicio`, `/caja`, `/ventas`, `/fiados`, `/corte`, `/metas`, `/pendientes`, `/ayuda`, `/ajustes`, `/pay/demo_hist_2_ord_487ea8b88b9a45fa8ce3`.

Evidencia: [smoke](harness/evidence/exact-parity/a-review-b/smoke.json), [navegación](harness/evidence/exact-parity/a-review-b/navigation.json), [interacciones](harness/evidence/exact-parity/a-review-b/interactions.json), [verify demo](harness/evidence/exact-parity/a-review-b/verify-actual-demo.json). Hojas visuales de A inspeccionadas: [390](harness/evidence/exact-parity/a-review-b/inspected-sheet-390.jpg), [320](harness/evidence/exact-parity/a-review-b/inspected-sheet-320.jpg), [941](harness/evidence/exact-parity/a-review-b/inspected-sheet-941.jpg). Los PNG completos permanecen junto a ellas.

## Verdad de pago y cobertura pendiente

Se inspeccionaron el rechazo 401 previo al procesamiento cuando la firma no es válida (`api/webhooks/pey/route.ts:136-160`), las validaciones de monto/moneda/referencia e idempotencia en `lib/pey-events.ts`, y el filtro `provider='pey'` en `/api/verify`. El diff conserva esas rutas. La consulta explícita de M04 hace GET; la simulación sigue separada en `/api/demo/pay`.

**No se enviaron POST/PUT/PATCH/DELETE desde los recorridos de navegador** (`non_read_requests:[]`). Solo se usó almacenamiento de contextos de navegador desechables para preferencias y recuperación de un pendiente existente. No se crearon ventas ni se simuló pago en la base compartida.

Por ese límite de lectura, no se generó un QR nuevo, no se abrió la nueva pantalla final de Caja mediante un pago, no se ejercitó compartir, ni se repitieron firma/replay/webhook, full, seguridad, cobro real, cámara, 200%/alto contraste, axe o lectores físicos. El pendiente existente tenía link, pero **no `qrImage`**: la captura M04 no prueba el QR generado. Los PASS históricos de B no se promovieron a PASS de esta revisión.

## Decisión condicionada

**NO-GO actual** para cerrar B/ensamblaje: corregir la afirmación monetaria nueva, cerrar B2, acreditar los gates del SHA final y resolver el alcance de B5/Detalle. Después, repetir las pruebas dirigidas y someter la evidencia a revisión humana. El smoke de A no mostró una rotura nueva en las rutas o navegación inspeccionadas; tampoco equivale a aprobar abonos, cierres, metas o pendientes que escriben datos. Sin autoaprobación.
