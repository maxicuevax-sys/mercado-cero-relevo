# Lane report — fix flujos (P0 + P2/P3)

Base: `7bb0dc5` · Rama: `p0/fix-flujos` · Worktree: `mercado-cero-fix-flujos`
Alcance: auditoría de flujos. **No** se tocó seed/webhook/verify/`orders.ts`, middleware/API auth, checkout/success ni scripts de a11y. Sin merge.

## Objetivo

- P0: teclear dinero no debe reformatear el texto en cada tecla. Precio, efectivo y fiado guardan su string crudo y sólo se formatean con `toFixed(2)` al salir.
- P2/P3: base para mañana real, reset demo con conteo local, acción de abono visible a 360 px, reconciliación de fiado/cobro pagado en otra pestaña, pendientes vivos, recibo del corte completo y detalles de copy/formato.

## Cambios

### P0 — tecleo de dinero

- `web/src/components/caja-app.tsx`
  - `priceInputs` por producto, `cashInput` y `creditInput` como texto crudo.
  - `parseMoneyInput` parsea en `onChange`; `formatMoneyInput` aplica `toFixed(2)` sólo en `onBlur`.
  - Los tres campos pasan a `type="text"` + `inputMode="decimal"` + `autoComplete="off"`. Con `type="number"` el navegador descarta estados intermedios como `35.` y vuelve a introducir el bug; el teclado numérico móvil se conserva con `inputMode`.
  - `onFocus` selecciona el contenido para reemplazar sin concatenar.
  - Restauración de borrador, voz, limpieza y reset sincronizan el texto crudo con los cents.
- `web/scripts/p0-venta-e2e.py`
  - Nuevo caso 3b con `press_sequentially` (no `fill`): precio 35, efectivo 100, fiado 40 sobre 35 × 2; cambio $70 y orden con precio 3500, efectivo 3000, fiado 4000.
  - Selectores de precio actualizados de `spinbutton` a `textbox` por el cambio de tipo de input.

### P2/P3

1. **Base para mañana**: `fillFromStatus` usa `data.saved?.baseNextCents ?? data.openingCents` (antes `40000` fijo).
2. **Reset demo**: `CashCloseCard` se remonta con `cashCloseKey`; el copy ahora dice “ventas, fiado, corte, meta y pendientes; también se pierde el conteo no guardado”.
3. **Hoja de abono a 360**: la acción primaria vive en un footer `sticky bottom-0` dentro del área scrolleable (sólo la acción, no toda la hoja). Verificado a 360 × 640: botón visible en y≈560.
4. **Reconciliación**:
   - Si el dashboard ya no tiene abierto el crédito de la hoja, se limpia la hoja y se muestra “Ese fiado ya está saldado. No se registró nada.” (toast + aviso persistente en Fiado).
   - Si `resumableOrder` ya está pagado/entregado, se limpia el aviso y `localStorage`, y se muestra “Ese cobro ya se pagó.” También se cubre el aviso restaurado al montar cuando la orden ya no está pendiente.
5. **Pendientes** (`web/src/components/pending-tasks.tsx`): refresco en `focus`/`visibilitychange`; 404/409 recargan la lista antes de avisar; `aria-controls` sólo si el formulario/panel existe; “Completar” es un `button` con nombre accesible, sin `role="checkbox"` unilateral.
6. **Recibo del corte**: `CashCloseSummary` muestra `expectedCents`, `withdrawalsCents` y `baseNextCents` del cierre inmutable.
7. **P3**: plurales con `countText` (“1 venta”, “1 pedido”, etc.); “Mejor día” con `Intl.DateTimeFormat("es-MX")` y `America/Mexico_City` en vez de `slice(5)`; `PendingPayments` recibe `error={dashboardError}`; con un campo de corte inválido no se muestra una diferencia falsa, sino “Corrige los montos marcados…”.
8. **QR/link vencido**: sin cambio de producto; queda documentado como KNOWN abajo.
- `web/scripts/p0-fiado-e2e.py`: el check final acepta cualquier puerto aislado distinto de `:3000` (la corrida de este carril fue en `:3126`); el localizador del aviso de saldo saldado usa la última coincidencia visible cuando también existe el aviso persistente en Fiado.

## Evidencia

Servidor externo aislado en `http://localhost:3126`, `DATABASE_PATH` temporal, `DEMO_MODE=true`, build de producción.

- `npm run lint`: **PASS**
- `npx tsc --noEmit`: **PASS**
- `npm run build`: **PASS** (Next 16.4.3)
- `python scripts/p0-venta-e2e.py`: **51 PASS · 0 FAIL · 0 KNOWN**
- `python scripts/p0-fiado-e2e.py` (`P0_EXTERNAL_SERVER=1`, `P0_DB_PATH`): **50 PASS · 0 FAIL · 0 KNOWN**
- `python scripts/p0-corte-e2e.py` (`P0_EXTERNAL_SERVER=1`, `P0_DB_PATH`): **61 PASS · 0 FAIL · 1 KNOWN**

Evidencia JSON:

- `harness/evidence/p0-venta-e2e.json`
- `harness/evidence/p0-fiado-e2e.json`
- `harness/evidence/p0-corte-e2e.json`

Verificación manual adicional con Playwright (360 × 640 y 1280):

- base para mañana precargada en `$500.00` desde el cierre anterior del seed;
- acción “Registrar abono” visible sin scroll en 360 px;
- conteo no guardado desaparece tras reiniciar demo y el copy nuevo está presente;
- fiado saldado desde fuera cierra la hoja y muestra el aviso;
- cobro pendiente pagado desde fuera limpia aviso + `localStorage` y muestra “Ese cobro ya se pagó.”;
- pendientes se refresca al volver el foco; 404 recarga la lista; `aria-controls` condicional; “Completar” ya no es checkbox;
- diferencia del corte oculta con montos inválidos.

## KNOWN

- **QR/link vencido — dead-end de demo**: `PaymentPanel` muestra el QR con el texto fijo “expira en 10 minutos” (`caja-app.tsx`, bloque de `order.qrString`), pero `Order` no guarda emisión/expiración y no existe acción de regeneración. Al vencer, la única salida es crear otro cobro/pedido. No se inventó caducidad ni se cambió el contrato del carril de dinero.
- **p0-corte**: la migración de esquema viejo no corre con `P0_EXTERNAL_SERVER=1`; el script la reporta como KNOWN y se ejecuta en modo aislado.

## Pendientes / notas

- No hay cambios de firma compartida ni de API.
- No se ejecutaron `verify:full` ni los scripts de a11y (`hig-after-audit.py`, `p0-shell-e2e.py`, `motion-check.py`); no se editaron.
- Sin merge a `master`.
