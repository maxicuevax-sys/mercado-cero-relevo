# P0 perf UI — SSR inicial y checkout sin spinner

Rama: `p0/perf-ui` · base `c0248ba` · worktree `mercado-cero-perf-ui`.
Sin merge. Sin tocar `mercado-cero`, `:3000` ni `:3101`.

## Qué cambió

- `web/src/lib/dashboard.ts`: `getDashboardData(limits)` es la fuente única de
  `/api/dashboard` y del render del servidor. `compactPending` evita mandar dos
  veces los pedidos pendientes en el HTML inicial.
- `web/src/app/page.tsx`: server component con `await connection()`, dashboard
  real y `initialDashboard`/`initialDemoMode` para `CajaApp`. `instant = false`
  para que la ruta bloquee hasta tener cifras reales, sin shell vacío.
- `web/src/components/caja-app.tsx`: `initialDashboard` inicializa `data` y
  `loading=false`; no hay fetch inicial. Los paneles ocultos se montan al
  visitar su pestaña y `analytics`/`cash`/`goals`/`tasks` no se piden al abrir
  Caja. `memo` por panel y `CreditPaySheet` movido al shell para que la voz
  siga abriendo el abono aunque Fiado no esté montado.
- `web/src/lib/checkout.ts` + `web/src/app/api/checkout/[id]/route.ts`: una sola
  traducción de `getOrderDetail` para la API y el servidor, con ETag/304.
- `web/src/app/pay/[id]/page.tsx`: lee la orden en el servidor y pasa
  `initialOrder`; `checkout-client.tsx` ya no muestra “Abriendo tu cobro…”.
  `checkout-skeleton.tsx` reserva el alto final en el fallback de streaming.
- `success/page.tsx` + `success-client.tsx`: SSR del estado de pago; un pedido
  inexistente muestra “Este cobro no existe”, nunca el falso “banco”.
- `web/src/lib/qr.ts`: `qrcode` en su propio módulo dinámico (chunk separado).
- Polling del checkout: 3 → 10 → 30 s, se pausa con `document.hidden`, envía
  `If-None-Match` y acepta 304. La caja conserva su polling visible de 45 s y
  ahora también usa ETag/304.
- `web/scripts/perf-budget.mjs`: con Cache Components una ruta dinámica deja
  `index.html` vacío. El gate ahora cae a los manifests del build, en vez de
  reportar 0 KiB y pasar en falso.
- `HIG-DESIGN.md` §17: nota de rendimiento, sin cambios visuales.

## Antes / después

Condición del addendum: 360×740, Slow 3G 400 kbps / 400 ms, CPU 4× y 6×,
build de producción en `:3195` con DB temporal.

| Métrica | Antes (baseline) | Después | Δ |
|---|---:|---:|---:|
| Home LCP 4× | 3.84–9.67 s | **2.87 s** | −0.97 a −6.80 s |
| Home LCP 6× | 12.17–12.62 s | **3.36 s** | −8.81 a −9.26 s |
| Home TBT 4× | 1.67–4.19 s | **0.85 s** | −0.82 a −3.34 s |
| Home TBT 6× | — | **1.08 s** | — |
| Home CLS | 0.078–0.288 | **0.000** | −0.078 a −0.288 |
| Checkout LCP 4× | 7.96–9.39 s | **2.46 s** | −5.50 a −6.93 s |
| Checkout LCP 6× | 7.96–9.39 s | **2.78 s** | −5.18 a −6.61 s |
| Checkout CLS | 0.401 | **0.002 / 0.0005** | −0.399 |
| Checkout TBT 4×/6× | — | **0.59 / 0.91 s** | — |
| INP tab 4× | 272 ms | **129–178 ms** | < 200 ms |
| INP tab 6× | 592 ms | **210–550 ms** | −42 a −382 ms |
| Fetches iniciales API | 7 | **0** | −7 |
| JS inicial (gzip) | 195.7 KiB | **188.1 KiB** | −7.6 KiB |
| HTML home | 43.3 KB | **66.1 KB** (11.8 KB gzip) | +datos SSR |
| HTML checkout | 4.1 KB | **34.3 KB** (10.5 KB gzip) | +datos SSR |
| `qrcode` en bundle inicial | sí | **no** (chunk 23.4 KiB aparte) | — |

Lighthouse móvil (misma build, `:3195`):

| Corrida | Perf | FCP | LCP | TBT | CLS |
|---|---:|---:|---:|---:|---:|
| Home antes | 69 | 1.24 s | 4.34 s | 638 ms | 0 |
| Home después | **86** | 1.06 s | **1.06 s** | 544 ms | 0 |
| Checkout antes | 95 | 0.82 s | 0.82 s* | 271 ms | 0 |
| Checkout después | **90** | 0.83 s | 0.83 s* | 418 ms | 0 |

\* Lighthouse simulado mide el primer paint del HTML; en el baseline ese paint
era el spinner. El LCP real está en la tabla de Playwright.

HTML servido: home incluye `Hoy $280.00 · Por cobrar $210.00 · Fiado $50.00`
y no contiene “Cargando la caja”; checkout incluye “Pagar a …” y `$90.00`, sin
`animate-pulse` de “Abriendo tu cobro…”. `/api/dashboard` sigue en 12,868 B
(2,123 B gzip) y responde 304 con ETag; el checkout también.

## Gates

| Gate | Resultado |
|---|---|
| `npm run lint` | PASS · 0 errores, 1 warning preexistente (`harness-gate.mjs`) |
| `npm run typecheck` / `tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `npm run test:fix-datos` | **40/40 PASS** |
| `npm run test:security` | **29/29 PASS** |
| `npm run test:harness` | **44/44 PASS** |
| `npm run test:perf-budget` | **PASS 9/9** (188.1 KiB JS, 13.2 KiB CSS, 260.9 KiB total, 11 requests) |
| Webhook firmado | **34/34 PASS** |
| `verify-truth` | PASS (`demo` no verificado) |
| `p0-venta-e2e` | **51/51 PASS** |
| `p0-fiado-e2e` | **50/50 PASS** |
| `p0-corte-e2e` | **69/69 PASS** |
| `p0-integracion-e2e` | **51/51 PASS** |
| `p0-dinero-e2e` | **45 PASS · 0 FAIL · 3 KNOWN** (conocidos de pey) |
| `test:perf-data` / `test:perf-data:http` | PASS · ETag 304, gzip 2,123 B |
| HIG 360/390/768/1280 + axe | PASS · 0 violaciones |
| `motion-check.py` | **19/19 PASS** |
| `a11y-contrast.py` | **7/7 PASS** |
| `checkout-audit.py` | **15/15 PASS** |
| `mobile-audit.py` | **25/25 PASS** |

Notas de medición:
- TBT/LCP varían con el host. Se corrieron varias veces; la tabla usa la corrida
  final pareada. El número determinista es el presupuesto del build.
- INP de tab a 4× ya cumple < 200 ms; a 6× la primera visita a Caja/Corte queda
  por encima (210–550 ms) por el montaje del formulario, aunque baja vs. 592 ms
  del baseline. No se hizo un refactor de los cinco tabs para no arriesgar
  dinero/a11y.
- El primer render de una pestaña oculta dispara su API (`cash`, `analytics`,
  `goals`, `tasks`) recién al visitarla; ya no en el primer paint.

## Conflictos previsibles con `p0/fix-mobile-qa`

- `caja-app.tsx`: probable conflicto en la firma de `CajaApp` (nuevo
  `initialDashboard`), el bloque de secciones/tabs (montaje por visita y
  `memo`) y el `CreditPaySheet` movido al shell. Al integrar, conservar ambas
  cosas: gating por visita + arreglos móviles; re-correr `mobile-audit`,
  `hig-after`, `motion` y `p0-integracion`.
- `pending-tasks.tsx`: esta rama añade `active` y secuencia de carga
  (`loadSeq`). Si el otro carril toca el layout de la bandeja, combinar sin
  perder el gating ni el foco a `pendientes-heading`.
- `pay/[id]/checkout-client.tsx`: se eliminó el estado `loading` y el spinner.
  Cualquier parche de QA móvil sobre ese bloque debe aplicar sobre el skeleton.
- `api/dashboard/route.ts` y `page.tsx`: la ruta usa `getDashboardData`; el
  `compactPending` es solo del render SSR. La API mantiene `orders` con los
  pendientes para no romper consumidores/contratos.
- `HIG-DESIGN.md`: la nota §17 puede convivir con cambios de diseño; no toca
  tokens ni reglas visuales.

## Pendientes / KNOWN

- El payload de `/api/dashboard` sigue repitiendo los pendientes dentro de
  `orders`; el HTML inicial ya no. Compactarlo en la API exige actualizar
  consumidores (por ejemplo `checkout-audit.py` busca pendientes en `orders`) y
  se dejó fuera para no romper contratos en este carril.
- TBT de Lighthouse sigue por encima del objetivo de 300 ms (544 ms). La
  hidratación de la caja completa es el costo dominante; bajar más exige
  separar los paneles inline en archivos/módulos, fuera del alcance seguro.
- El checkout conserva un fetch inicial de polling a los 3 s para confirmar el
  estado; después usa ETag/304 y backoff. No hay fetch de datos para pintar.
