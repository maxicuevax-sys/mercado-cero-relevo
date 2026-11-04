# 02 — Análisis de causas raíz

## P0-01 — Fiado puro

**Causa:** `sale-result.tsx` renderizaba el banner de fiado dentro de `{openCredit ? ...}` sin consultar si había efectivo. `paidCents=0` era correcto en el ledger, pero el copy afirmaba “el efectivo sí se registró en la caja”.

**Corrección estructural:** una función pura `saleMoney()` separa `cashPaidCents`, `digitalPaidCents`, `creditCents`, `creditBalanceCents` y `dueCents`. El banner tiene tres ramas: demo, con dinero recibido y sin dinero recibido. No se tocó el motor.

## P0-02 — Mixto efectivo + digital

**Causa:** el panel solo renderizaba `dueCents`; nunca mostraba `paidCents`. La frase “El dinero aún no se considera recibido” se derivaba de `due>0`, no de `paid>0`. La fila de `/ventas` priorizaba `payment_pending` antes que `paidCents>0`.

**Corrección:** panel y fila usan la misma verdad (`saleMoney`). “Ya recibiste” y “Falta cobrar” son hechos separados. En demo se añade “Simulado: cobrado” para no convertir una simulación en dinero real.

## P1-07 — Cambio fantasma

**Causa:** el reparto aplicaba fiado primero. Con total $100, efectivo $100 y fiado $100, el fiado cubría todo, el efectivo aplicado era $0 y el cambio se calculaba como $100. El aviso “El total cambió” comparaba el fiado contra el total incluso en un split válido.

**Corrección:** el cambio se calcula sobre el efectivo aplicado, no sobre el tendido. Se bloquea solo el caso imposible: el fiado cubre todo y además se ingresó efectivo. Un split con cambio real (total $90, efectivo $100, fiado $30 → aplicado $60, cambio $40) sigue permitido. El aviso falso se eliminó.

## P1-08/P1-09 — Historial y agregados

**P1-08:** orden de ramas en el render. Se invirtió: `paidCents>0` se muestra siempre, y el estado pendiente/fiado va aparte.

**P1-09:** asimetría en `getDailySummary`/`analytics`: los pagos demo se excluían siempre, pero los abonos demo solo en modo real. Se hizo simétrica la condición `provider==='demo' || demo===1` para `credit_payments`. El abono demo pasa a `demoCashCents`/`demoDigitalCents`, nunca a cobrado confirmado.

## P1-01 — Dos Cajas

**Causa:** `caja-screen` usaba `mercado-cero:caja-*:v2`; `caja-app` usaba `mercado-cero:draft/request/pending:v1`. No había puente ni aviso.

**Corrección:** `/caja` importa v1 si no hay v2, conserva la llave de venta si existe, elimina v1 después de importar y bloquea la confirmación si ambos drafts son distintos. La Caja clásica lee el draft v2, avisa y bloquea la venta hasta que el operador elige “Usar esta Caja clásica”. La nav marca “Clásica” y el nombre accesible lo explica.

## P1-06 — Pendiente que secuestra

**Causa:** al montar se tomaba solo `pendingIds[last]` y se abría `payment` si había saldo. No existía salida a compose.

**Corrección:** se cargan todos los ids, se podan 404/terminales y se muestra una bandeja. No se abre nada automáticamente. “Seguir cobrando” abre el panel; “Nueva venta” vuelve a compose sin borrar ni cancelar el pendiente.

## P1-12 — 502 post-commit

**Causa:** un 502 se trataba como fallo normal. Si el usuario editaba, la firma cambiaba y se generaba otra `requestId`; el servidor no podía deduplicar.

**Corrección:** 502/503/504 y fallo de red pasan a `unknownResult` persistido. Se bloquean edición, métodos y “Descartar” hasta reconciliar. “Consultar si se registró” usa `GET /api/orders?requestId=...`; si existe, adopta la orden; si no, permite reintentar con la misma llave o corregir. La llave se reconstruye desde el aviso aunque se pierda el storage de la solicitud.

## P1-02/P1-03/P1-04 — Layout y reflow

- **P1-02:** el selector `.mc-caja-line__total > span` ocultaba también el `span.tabular-nums` del importe. Se etiquetó la etiqueta y se cambió el selector.
- **P1-03:** el CTA vivía al final del resumen, fuera del viewport. Se movió a una barra de cobro fija, con total y “Confirmar venta” siempre visible; “Revisar cobro” queda como acción secundaria cuando falta completar.
- **P1-04:** las columnas de línea eran px fijos. Se añadió container query por ancho útil de la tarjeta (34em), que apila a 200 % y en 768. El paginador usa wrap; la nav móvil pasa a 3+2 solo cuando el ancho en em baja de 18; la barra de cobro sube 65 px (128 px en texto grande) para no tapar la nav.

## P1-05 — Foco

**Causa:** nadie movía el foco al navegar; el `tabIndex` del `main` solo servía al skip link.

**Corrección:** `RouteFocus` mueve el foco al `h1` o a `[data-page-focus]` después de una navegación; en la primera carga conserva el orden natural para que el skip link siga primero. La paginación enfoca `#mc-ventas-list-title`, hace scroll al inicio y anuncia “página X de Y” con `aria-live`.

## P1-13 — Inicio 768

**Causa:** el arte absoluto de 463 px se ocultaba solo a ≤760; la sugerencia de tres columnas necesitaba ≥618 px y el contenido a 768 mide ~510.

**Corrección:** en 761–1100 se oculta el papel picado y la sugerencia pasa a dos columnas con el CTA debajo del texto. En móvil se mantiene el layout existente.
