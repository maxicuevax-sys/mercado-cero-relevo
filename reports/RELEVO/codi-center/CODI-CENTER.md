# Hub CoDi central en Inicio — reporte de entrega

- **Worktree:** `C:\Users\Public\Documents\MercadoCero-Visual-Sync\codi-center-worktree`
- **Rama:** `feature/codi-center` (base `092cf84`)
- **Commit de implementación:** `3925c3f` — `feat(inicio): hub CoDi central reutilizando el flujo demo de órdenes`
- **Alcance:** `/inicio`, shell/navegación y un componente nuevo `components/codi`. No se tocó `4580`, `4497`, VPS, producción ni `codi-movements-worktree`.

## Qué cambió

### 1. Bloque central “Cobrar con CoDi” (nuevo, en `/inicio`)

`web/src/components/codi/codi-hub.tsx` + `codi-hub.css`. Se renderiza en la
columna central de Inicio, entre los KPI y la tarjeta “Nueva venta”.

- **Monto real:** input en pesos (`inputMode="decimal"`, Enter cobra) + montos
  rápidos $20 / $50 / $100 / $200 + CTA grande “Cobrar $X.XX”.
- **Reutiliza el flujo existente, sin endpoint nuevo:**
  1. `POST /api/orders` con un concepto “Cobro con CoDi” y `requestId`
     idempotente (reintentar tras fallo de red no duplica el pedido).
  2. `POST /api/orders/:id/pay` con `{ mode: "qr" }` (el mismo que usa Caja).
  3. Sondeo `GET /api/orders/:id` cada 5 s + botón “Consultar estado”.
  4. Demo: `POST /api/demo/pay` (`method: "codi"`) para simular el pago.
- **Estados inline honestos** (`role="status"`/`aria-live`):
  - “Esperando pago” con el QR y “El QR está listo y no es dinero recibido…”.
  - Demo: “Pago simulado”; el texto dice “No es dinero real. No se entrega.”
    y nunca aparece “Pago recibido”.
  - Real: solo “Pago recibido” si la API devuelve `paid`; `cancelled` se
    muestra como “Cobro cancelado” (sin inventar un estado “vencido”).
- **Estética 4580 preservada:** tarjeta de papel/crema con el mismo radio,
  borde y sombra que el resto de Inicio; Hearth para titulares, Alder para
  cifras; CTA verde de la casa; se reutiliza el asset existente
  `assets/brand/ilustraciones/transparent/qr.png`. No se creó un design
  system ni se adoptó el look minimalista de Codex. La home existente
  (saludo, papel picado, KPI, tarjeta Nueva venta, accesos, Pendientes) sigue
  intacta.

### 2. Navegación con el cobro al centro

`web/src/components/shell/nav.ts`, `app-shell.tsx`, `mobile-nav.tsx`,
`sidebar.tsx`, `flow-screen.tsx` y ajustes de layout en `inicio.css` /
`reference-a2.css` / `shell.css`.

- **Barra móvil (5 posiciones):** Inicio · Movimientos · **Cobrar con CoDi
  (centro, `QR`)** · Caja · Más.
- **“Más”:** Fiados, Corte, Pendientes, Metas, Ventas, Ayuda y Ajustes. En el
  sidebar de escritorio esos destinos quedan al pie, debajo del separador,
  con Inicio y Movimientos arriba.
- **Pendientes sigue accesible** (dentro de Más) y no se borró ninguna ruta
  ni pantalla. `Caja` conserva la venta completa y sigue en la barra.
- Se ajustó el ancho de columnas de la barra y el gap/tamaño del sidebar para
  que “Movimientos” no se parta a 320–390 ni a 1448.
- La primera tarjeta de accesos rápidos “Cobrar” ahora ancla al hub
  (`/inicio#cobrar-codi`) en lugar de saltar a Caja.

### 3. Arreglo mínimo de layout

- Se agregó `overflow-x: clip` al shell móvil de Inicio: la ilustración del
  saludo sangra a la derecha por diseño y provocaba scroll horizontal en
  320–390 (defecto preexistente). No cambia el dibujo, solo evita el scroll.
- `Movimientos` se enlaza con `prefetch: false` mientras otro carril integra
  esa ruta, para no pedir un 404 en cada carga.

## Build y verificación

Servidor aislado de este worktree, **nunca 4580 ni 4497**:
`localhost:4590`, `DEMO_MODE=true`, `APP_URL=http://localhost:4590`, SQLite
local de este worktree (`web/data`, borrada antes de la captura final).

- `npm run build` → **BUILD OK** (Next 16.4.3, `.next/BUILD_SHA` con
  `092cf84…`).
- `python reports/RELEVO/codi-center/capture.py` contra el build de producción
  → **29 PASS · 0 FAIL**, `consoleErrors=0`, `pageErrors=0`
  (`capture-results.json`).
- Flujo ejercitado de verdad: crear pedido → QR visible con imagen cargada →
  “Esperando pago” → “Simular pago CoDi” → “Pago simulado”, sin afirmar dinero
  real.
- Rutas existentes en 200: `/inicio`, `/caja`, `/fiados`, `/corte`, `/metas`,
  `/pendientes`, `/ventas`, `/ajustes`, `/ayuda`. Sin scroll horizontal en
  390×693, 1448×1086 y 320×640. Targets táctiles del hub ≥ 44 px.
- Capturas Playwright (390×693 y 1448×1086, viewport y full page):
  - `inicio-390x693.png`, `inicio-390x693-full.png`
  - `inicio-1448x1086.png`, `inicio-1448x1086-full.png`
  - `390x693-hub-qr.png`, `390x693-hub-qr-full.png`,
    `390x693-hub-pagado-demo.png`, `390x693-hub-pagado-demo-full.png`
  - `1448x1086-hub-qr*.png`, `1448x1086-hub-pagado-demo*.png`
  - `inicio-320x640.png` y sanity de `/caja`, `/fiados`, `/metas`, `/ajustes`.

## Límites (documentados, no falseados)

1. **`/movimientos` todavía no existe en esta rama.** La navegación ya enlaza
   la ruta, pero responde 404 hasta que se integre el carril de movimientos.
   Por eso el enlace no se prefetchea.
2. **No hay pey live, llaves ni webhook.** El QR demo apunta a
   `${APP_URL}/pay/<id>?demo=1`; el pago demo se simula con `/api/demo/pay` y
   nunca cuenta como dinero real. En modo real, el hub solo pasaría a
   “Pago recibido” cuando el pedido llegue `paid` por el flujo existente.
3. **Sin estado “vencido” propio:** no hay endpoint de cancelación/expiración
   y no se quiso inventar; si el pedido llegara `cancelled` se muestra
   “Cobro cancelado”. No se agregó caducidad falsa al QR.
4. **Cobro simple:** un solo concepto “Cobro con CoDi” por pedido. Ticket con
   varios productos sigue en Caja (enlace en el hub y en la tarjeta “Nueva
   venta”). No se duplicó la lógica de carrito.
5. **Gates antiguos desactualizados:** `web/scripts/inicio-adoption-contract.mjs`,
   `web/scripts/inicio-compact-gate.py` y `web/scripts/a3-mobile-nav.py`
   congelan la home/navegación anteriores (p. ej. “Cobrar” → Caja, Fiados en
   la barra). No se corrieron porque este cambio los invalida por diseño; el
   integrador debe actualizarlos al hacer merge con movimientos.
6. `web/data` es la base demo local de este worktree (no versionada) y se
   borró antes de la captura final para que la evidencia salga con los datos
   demo limpios.

## Cómo reproducir

```powershell
cd C:\Users\Public\Documents\MercadoCero-Visual-Sync\codi-center-worktree\web
$env:DEMO_MODE='true'; $env:APP_URL='http://localhost:4590'
npm run build
node node_modules/next/dist/bin/next start -p 4590 -H localhost
# en otra terminal:
cd ..
$env:BASE_URL='http://localhost:4590'
python reports/RELEVO/codi-center/capture.py
```
