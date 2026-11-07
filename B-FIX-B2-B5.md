# B — Cierre B2, B5 y cabecera mixta

Rama `revision/caja-b`. Sin merge, sin push y sin operar 4497. No se tocaron A, Onboarding ni contratos de pago.

## Commits

| SHA | Contenido |
|---|---|
| `8e4e675` | Código y pruebas: B2, B5 y corrección de la cabecera digital en pago mixto |
| `393f600` | Evidencia JSON de la regresión B (73/73) |

`verify:fast` se ejecutó sobre árbol limpio en `393f600`: **3/3 PASS** (guard, lint, types). El commit de evidencia no cambia código.

## B2 · Descartar el ticket precargado en 390/320

**Problema:** en 390/320 la composición móvil de Caja oculta `.mc-caja-summary` y `.mc-caja-paybar`; por eso “Descartar venta” no existía visible y solo quedaban los tres basureros por línea.

**Cambio:**
- `web/src/components/caja/caja-spec-checkout.tsx`: nueva acción `Descartar venta` dentro del checkout móvil, con prop `onClear`.
- `web/src/components/caja/caja-spec.css`: botón de 44 px mínimos, foco visible y ancho completo.
- `web/src/components/caja/caja-screen.tsx`: `requestClearDraft` centraliza la confirmación (`¿Descartar la venta sin confirmar?`) para la acción móvil y la de escritorio.

La venta demo/referencia de tres líneas y $140 se conserva. Descartar vacía el ticket en la sesión; recargar sin borrador vuelve a mostrar el ejemplo demo. No se eliminó ninguna capacidad del ticket.

**Evidencia 390/320:**
- [390 · ticket descartado](harness/evidence/exact-parity/b-refs/390-B2-cleared.png)
- [320 · ticket descartado](harness/evidence/exact-parity/b-refs/320-B2-cleared.png)
- [390 · Caja con la acción visible](harness/evidence/exact-parity/b-refs/390-M02-caja.png)
- [320 · Caja con la acción visible](harness/evidence/exact-parity/b-refs/320-M02-caja.png)

Regresión: `web/scripts/b-refs-ui.py` comprueba que la acción es visible, mide ≥44 px, la usa con confirmación y verifica que el ticket queda en 0 líneas en ambos anchos. `web/scripts/oleada-b1-regression.py` repite la comprobación en 390.

## B5 · Copy de fiado demo sin estado redundante

**Problema:** una venta de fiado demo se guarda con estado `confirmed`; la pantalla mostraba `Estado: Demo (simulado)` por el modo demo global, aunque el estado real era “Registrado”. El estado duplicaba el aviso de demo y confundía estado con entorno.

**Cambio en `web/src/components/caja/sale-result.tsx`:**
- `Estado` muestra el estado real del pedido: `Registrado` para fiado confirmado.
- El título del fiado demo pasa a `Venta demo registrada con fiado`.
- La nota y el banner dicen que es una práctica demo: no se movió dinero real y el saldo es deuda de práctica.
- `demo_paid` se rotula `Cobro demo`, sin el redundante `(simulado)`.
- Se conserva `Comprobante de pago · DEMO`, el aviso de compartir y la distinción demo/real.

**Evidencia 390/320:**
- [390 · fiado demo confirmado](harness/evidence/exact-parity/b-refs/390-B5-fiado-confirmed.png)
- [320 · fiado demo confirmado](harness/evidence/exact-parity/b-refs/320-B5-fiado-confirmed.png)

Regresión: `oleada-b1-regression.py` exige título demo, `Estado: Registrado` y ausencia de `Demo (simulado)`; `b-refs-ui.py` lo verifica en 390 y 320 con axe sin violaciones.

## P1 · Cabecera digital en pago mixto

**Problema:** el bloque `Pago digital recibido` usaba `order.totalCents`. En un mixto con efectivo/fiado, mostraba el total de la venta como si todo fuera digital.

**Cambio:** `sale-result.tsx` usa `digitalPaidCents` en esa cabecera. Etiqueta y monto ahora coinciden.

**Regresión real:** `oleada-b1-regression.py` crea por UI un mixto con total $100, efectivo $20, digital $40 y fiado $40; simula CoDi y valida API `paidCents=6000`, `digitalPaidCents=4000`, `creditCents=4000`. La cabecera debe mostrar `$40.00` y no `$100.00`; con el código anterior fallaba.

- [Captura del mixto](quality-reports/oleada-b-estabilizacion/evidencia/p1-10-mixto-digital-fiado.png)

## Verificación ejecutada

| Comando | Resultado | SHA / evidencia |
|---|---|---|
| `npm run build` | **BUILD OK**, TypeScript y 36 páginas | `8e4e675` |
| `python scripts/b-refs-ui.py` | **92 PASS / 0 FAIL**, axe sin violaciones, 390/320 | `ui.json`: `git=gitAtEnd=8e4e675` |
| `npm run test:b1-regression` | **73 PASS / 0 FAIL** | `oleada-b1-regression.json` |
| `npm run verify:fast` | **3/3 PASS** en árbol limpio | `393f600` |

No se modificaron webhooks, `paid`, `demo_paid`, verificación bancaria, `/api/verify` ni secretos. Pendiente: revisión humana y merge del orquestador.
