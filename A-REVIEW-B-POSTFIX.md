# A — Revisión dirigida post-fix B (P1/B2/B5)

**Recomendación: GO condicionado para los fixes dirigidos P1, B2 y copy del comprobante B5. NO-GO para declarar cerrado el ensamblaje completo.** Los cambios revisados cumplen la comprobación dirigida; faltan evidencia estática propia de `ed70375` y una decisión humana sobre el alcance histórico de “Detalle de venta”. Este informe no aprueba merge, publicación ni pagos reales.

## Identidad y límites

- Fecha local: 6 de noviembre de 2026. Revisión dentro del timebox de 20 minutos; runtime principal registrado de 21:46:20 a 21:47:35 (UTC−6), más inspección y cierre documental.
- Worktree revisado: `integration-assembly`; HEAD y `/api/health` al inicio/final: `ed70375a81701758753b3fc012f864121e95cd78`. El sello `.next/BUILD_SHA` contiene ese mismo SHA.
- Runtime: **http://127.0.0.1:4580**. No se accedió a 4497, no se reinició ni recompiló, no hubo cambios de producto, commit, merge ni push.
- B tiene actualmente HEAD `2cdae7cbcab93c951930812824462b43126b8c34`: después de `393f600` solo añade `B-FIX-B2-B5.md`. El ensamblaje incorpora `393f600`; `git diff 393f600 ed70375 -- web/src web/scripts` está vacío.
- Ambos árboles estaban limpios antes de escribir este informe. La evidencia generada está en el directorio ignorado `harness/evidence/exact-parity/a-review-b-postfix/`; el único archivo de entrega nuevo fuera de él es este informe, sin commit.
- Navegador: Chromium mediante Playwright, viewports 390×844, 320×844 y 941×844. No constituye prueba de dispositivo físico, Safari/iOS ni accesibilidad completa.

Evidencia de identidad: [identity.json](harness/evidence/exact-parity/a-review-b-postfix/identity.json).

## Resultados dirigidos

| Criterio | Resultado independiente |
|---|---|
| P1 · mixto efectivo + digital + fiado | **PASS en render**: total $100; cobrado $60; efectivo $20; digital $40; fiado $40. La cabecera digital muestra **$40**, no $100. |
| P1 · digital puro | **PASS en render**: total/digital $100; cabecera $100. |
| P1 · demo y real | **4/4** renders del componente fuente: digital puro y mixto, demo y real sintético. Etiquetas “Pago digital simulado” y “Pago digital recibido” corresponden al modo. Además, los dos casos demo se ejercitaron sobre el build servido, en ambos anchos móviles. |
| B2 · 390 | **PASS**: Descartar visible y operable; caja **362×44 px**. Cancelar conserva las 3 líneas; aceptar deja 0 líneas, total $0 y Registrar deshabilitado. |
| B2 · 320 | **PASS**: Descartar visible y operable; caja **296×44 px**. Misma comprobación de cancelación y descarte. |
| B5 · copy del resultado | **PASS** en 390/320: digital con “Pago demo”, “Pago digital simulado”, “DEMO · sin dinero real” y Estado “Cobro demo”. Fiado con “Venta demo registrada con fiado”, Estado “Registrado”, cobrado $0 y aviso explícito de deuda de práctica sin dinero real. Sin “Demo (simulado)” en los resultados examinados. |
| Gate de B | **PASS**: `npm run verify:evidence -- --static`, ejecutado desde `../b-refs-worktree/web`, valida **5/5 gates**, HEAD/build `2cdae7c`, `ok:true`, `complete:true`, `partial:false`, árboles inicial/final/actual limpios. |
| Gate del ensamblaje | **FAIL por evidencia ausente**: el mismo comando desde `integration-assembly/web` no encuentra `harness/evidence/latest-static.json`. No se generó, por el alcance de revisión de solo lectura. |

La medición B2 se tomó tras desplazar el botón al área visible, mediante desplazamiento normal. No está oculto por CSS ni requiere un control alternativo. El descarte solo limpia el borrador local: al recargar sin borrador puede reaparecer el ticket de ejemplo demo, comportamiento conservado por B.

### Cómo se reprodujo P1 sin escribir en la DB compartida

Se cargó el **componente del build servido en 4580** y se recorrió “Consultar si se registró” con almacenamiento de un contexto desechable. Solo las dos respuestas GET del identificador `readonly_fixture` fueron satisfechas por Playwright con órdenes controladas: digital puro, mixto y fiado. No se sustituyó el componente ni el código servido. Los datos y URLs interceptadas constan en `review.json`.

Esto prueba la afirmación monetaria y el copy visibles del resultado, **no** creación/persistencia de una venta, cobro bancario, webhook ni contrato financiero de extremo a extremo. Los casos reales se verificaron mediante render sintético del componente fuente, sin servidor financiero. No se presentan como pagos pey confirmados. Las regresiones 58/58, 66/66 y 73/73 comunicadas por B no se volvieron a ejecutar ni se contabilizan como PASS independientes de A.

Evidencia: [runtime y fixtures](harness/evidence/exact-parity/a-review-b-postfix/review.json), [reproductor](harness/evidence/exact-parity/a-review-b-postfix/review.py), [4 renders fuente](harness/evidence/exact-parity/a-review-b-postfix/component.json), [reproductor fuente](harness/evidence/exact-parity/a-review-b-postfix/render-component.cjs).

Capturas y hojas **abiertas e inspeccionadas**: [B2 antes/después](harness/evidence/exact-parity/a-review-b-postfix/sheet-B2.jpg), [recibos digital/mixto/fiado](harness/evidence/exact-parity/a-review-b-postfix/sheet-receipts.jpg), [Caja/Ayuda/Ajustes](harness/evidence/exact-parity/a-review-b-postfix/sheet-smoke.jpg). Los PNG completos están en la misma carpeta.

### B5 / Detalle: límite que sigue abierto

El fix acredita el **copy del comprobante de Caja**. Se expandió de nuevo Ventas en 390/320: continúa “Ver conceptos”, con conceptos/cantidad/precio; no aparece un control “Detalle de venta” ni una etiqueta Estado dentro de ese detalle. No se certifica una nueva vista de detalle ni se equipara automáticamente con el comprobante. La petición actual concreta B5 en copy demo: ese subcriterio pasa. Para cerrar también el hallazgo anterior de Detalle hace falta delimitar su alcance mediante decisión humana.

La ausencia de la cadena redundante está acreditada en los resultados examinados, no en todo el repositorio: `payment-panel.tsx` conserva una rama `demo_paid → Demo (simulado)` fuera de esos resultados. No se declara una eliminación global.

Evidencia: [detalle expandido](harness/evidence/exact-parity/a-review-b-postfix/detail-scope.json), [390](harness/evidence/exact-parity/a-review-b-postfix/390-ventas-expanded.png), [320](harness/evidence/exact-parity/a-review-b-postfix/320-ventas-expanded.png).

## Smoke y preservación

- **27/27 rutas HTTP 200**: Inicio, Caja, Ventas, Fiados, Corte, Metas, Pendientes, Ayuda y Ajustes, en los tres anchos. Sin desbordamiento horizontal medido ni `pageerror`.
- **24/24 recorridos de navegación** desde Inicio, incluyendo el menú Más para los destinos secundarios.
- Ayuda: búsqueda de Fiados abre la explicación de deuda en los tres anchos. Ajustes: preferencia de voz persiste tras recarga en los contextos desechables; Cerrar sesión muestra el límite del prototipo.
- Los **3290 requests** registrados del recorrido principal fueron GET/HEAD/OPTIONS; **0 peticiones de escritura**, **0 peticiones a 4497**, **0 bloqueos del guard**. El guard abortaría cualquier escritura o acceso a 4497.
- `/api/orders` completo es idéntico antes/después; SHA-256 de su JSON canónico: `b180b08e75fbf8b0e8d831c86e2eff8f738c695ef10ef2443b57c8f35c84685b`. Esto acredita igualdad de esa lectura, no un hash físico de toda la SQLite. No se ejecutaron reset, simulación de pago ni formularios con escritura.

## Gate y decisión final

Prueba ejecutada y conservada: [verificador B PASS](harness/evidence/exact-parity/a-review-b-postfix/verify-evidence-b.txt), [snapshot de latest-static B](harness/evidence/exact-parity/a-review-b-postfix/b-latest-static.snapshot.json), [verificador assembly sin evidencia](harness/evidence/exact-parity/a-review-b-postfix/verify-evidence-assembly.txt).

**Recomiendo aceptar como corregidos P1, B2 y el copy del comprobante B5 dentro del alcance probado.** Para declarar terminado el ensamblaje, el responsable debe obtener static completo y `verify:evidence -- --static` PASS sobre su SHA final limpio, y resolver explícitamente si B5 incluye una vista de Detalle distinta. El static válido de B no sustituye el del merge servido. Handoff público/full, pago real, firma/replay, compartir, cámara y lectores físicos siguen fuera de esta revisión.

**Sin autoaprobación:** la recomendación queda para revisión humana; no se autoriza ni se ejecuta merge/push/deploy. No hubo mutación de producto o servidor que requiera rollback.
