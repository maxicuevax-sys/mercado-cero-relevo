# CODI-MOVEMENTS · Historial central de solicitudes y pagos CoDi

- **Rama:** `feature/codi-movements`
- **Base:** `092cf84`
- **Commit de implementación:** `be160ea` (`feat(movimientos): historial central de solicitudes y pagos CoDi`)
- **Fecha:** 2026-11-07
- **Carril:** MOVIMIENTOS CODI · subagente de implementación

## 1. Qué se entregó

### `/movimientos` — historial

- Listado central de solicitudes y pagos digitales, ordenado por creación.
- Filtros simples por URL: **Todos**, **Pendientes** y **Pagados**, con conteos
  calculados en servidor (no en el cliente).
- Resumen de tres verdades separadas:
  - **Por cobrar** (saldo de solicitudes abiertas; nunca suma un QR como ingreso),
  - **Dinero recibido** (solo efectivo real y pagos verificados por pey; demo no cuenta),
  - **Pago demo** (simulación; no es dinero real ni se entrega).
- Cada fila muestra dos líneas explícitas: **Solicitud** (QR / link / sin QR) y
  **Dinero** (sin pago / efectivo / verificado / pago demo). Un QR generado
  nunca aparece como cobro.
- Paginación server-side de 20 movimientos por página.
- Empty state ilustrado para base sin movimientos y empty compacto para un
  filtro sin resultados.
- CTA `Nuevo cobro` hacia `/caja`; no se modificó el shell ni la navegación.

### `/movimientos/[id]` — detalle

- Hero verde con folio, total, estado y fecha, con la ilustración de QR.
- **Solicitud:** conceptos, total, creada, última actualización, cliente y
  referencia.
- **Cobro digital:** QR (imagen guardada) y/o link de cobro, con la leyenda
  explícita de que no son un pago. Para QR vencido se muestra el aviso derivado.
- **Dinero recibido:** efectivo real, verificado por pey, pago demo separado,
  por cobrar y fiado como deuda. El total demo nunca se suma al real.
- **Pagos registrados:** cada pago con método, proveedor, fecha, estado,
  transacción y sello `Demo` / `Verificado` / `Efectivo`.
- Notas de límites al pie (QR vencido derivado, cancelación sin acción, lectura
  sin mutaciones).
- `not-found.tsx` para ids inexistentes, de otro modo o que no son CoDi.

### Capa de datos

`web/src/lib/codi-movements.ts` es **solo lectura**: consulta `orders`,
`payments`, `order_items` y reutiliza `getOrderDetail` para el detalle. No crea
tablas, endpoints, estados nuevos ni escribe dinero. No se modificaron
`db.ts`, `orders.ts`, `payment-rules.ts`, webhook, `/ventas`, `/caja`,
`/fiados` ni `/corte`.

## 2. Archivos

| Archivo | Cambio |
|---|---|
| `web/src/lib/codi-movements.ts` | Nuevo. Tipos, derivación de estados, resumen y consultas read-only. |
| `web/src/app/movimientos/page.tsx` | Nuevo. Listado, filtros, KPIs, paginación y empty states. |
| `web/src/app/movimientos/movimientos.css` | Nuevo. Estilos `.mc-mov-*` (papel/crema, verde, Hearth/Alder). |
| `web/src/app/movimientos/[id]/page.tsx` | Nuevo. Detalle de solicitud, QR/link, dinero y pagos. |
| `web/src/app/movimientos/[id]/detalle-movimiento.css` | Nuevo. Estilos `.mc-mvd-*`. |
| `web/src/app/movimientos/[id]/not-found.tsx` | Nuevo. Estado no encontrado con el mismo shell. |
| `web/next.config.ts` | `Cache-Control: private, no-store` para `/movimientos` y `/movimientos/:path*`. |
| `reports/RELEVO/codi-movements/capture.py` | Nuevo. Capturas + smoke de las rutas. |
| `reports/RELEVO/codi-movements/capture-empty.py` | Nuevo. Captura del empty state con base vacía. |
| `reports/RELEVO/codi-movements/captures/` | Nuevo. 28 PNG + `smoke.json`. |

No se tocó `web/src/components/shell/**`, `nav.ts`, `/inicio`,
`codi-center-worktree`, VPS ni producción.

## 3. Contrato de datos y estados

### Fuente de verdad

- `orders`: estado, total, `paid_cents`, `credit_cents`, QR (`qr_id`,
  `qr_string`, `qr_image`, `num_ref`), link (`payment_url`,
  `payment_link_id`), fechas.
- `payments`: monto, método, proveedor, `demo`, estado y fecha. **La suma de
  pagos `paid` es la fuente del dinero mostrado**, no `paid_cents` aislado.
- `order_items`: conceptos del detalle.
- `credits` (solo detalle): saldo actual del fiado, que es deuda y nunca se
  suma a “Dinero recibido”.

### Qué entra al historial

1. Pedidos con QR o link de cobro (solicitud digital).
2. Pedidos con un pago CoDi registrado (aunque no se haya guardado el QR).
3. Pedidos abiertos con saldo (`confirmed`, `payment_pending`,
   `partially_paid`) que todavía no tienen QR ni link (solicitud creada).

Quedan fuera las ventas de efectivo cerradas y los pagos de tarjeta/wallet que
no tengan QR/link, porque no son movimientos CoDi. **Límite:** el esquema no
persiste la “intención digital” al crear la venta; por eso una venta abierta
con saldo se presenta como solicitud creada, aunque el comerciante hubiera
pensado cobrarla en efectivo. Ver §4.

### Estados derivados

| Estado | Etiqueta UI | Derivación |
|---|---|---|
| `created` | Solicitud creada | Sin pagos `paid`, sin QR y sin link; saldo > 0. |
| `awaiting` | Esperando pago | Sin pagos `paid`; QR o link generado. |
| `expired` | QR vencido | Sin pagos `paid`; QR generado y `updated_at` con más de 10 min. Derivado, no persistido. |
| `paid` | Pago recibido | Hay pago real (efectivo `demo=0` o `provider='pey'`, `demo=0`) y saldo 0. |
| `partial` | Pago parcial | Hay pago real y todavía queda saldo. |
| `demo_paid` | Pago demo | Hay pagos, pero todos son demo (`provider='demo'` o `demo=1`). |
| `cancelled` | Cancelada | `orders.status = 'cancelled'` ya guardado en la base. |

- Un pago demo **no** produce “Pago recibido”: produce “Pago demo”. En la fila
  se lee `Pago demo $X (simulado)` y en el detalle el importe demo va en su
  propia línea.
- Un QR o link generado **no** produce ningún estado de pago: sigue en
  “Esperando pago” con “Sin pago registrado”.
- “Pagados” en el filtro significa “tiene al menos un pago `paid`”, incluido
  demo; la etiqueta de la fila distingue el tipo. Un pago parcial aparece en
  Pagados y conserva “Falta cobrar”.
- “Pendientes” excluye canceladas; una cancelada solo aparece en “Todos”.

### La derivación de “QR vencido”

`lib/pey.ts` solicita el QR CoDi con `expiration: 600` (10 minutos), pero el
contrato local no guarda `expires_at`. La vista deriva el vencimiento de
`updated_at`:

- `updated_at` se escribe al adjuntar el QR y solo puede moverse hacia
  adelante por acciones posteriores.
- Si ya pasaron más de 10 minutos desde `updated_at`, con más razón pasaron
  desde el QR. La derivación **no tiene falsos positivos**; puede tener falsos
  negativos si otra acción actualizó el pedido después.
- El aviso no cancela la solicitud ni bloquea un pago tardío. Si el pago llega
  después, se registra y el estado cambia.
- En demo el QR es un enlace local que no expira en pey; el estado se muestra
  igual porque la simulación representa la vigencia de 10 minutos y la UI lo
  declara como derivado. En real el QR de pey sí vence a los 600 s.

### Límites declarados

1. **No existe un estado `expired` persistido** en `OrderStatus`; el que se ve
   es una lectura derivada y está documentada en la UI y aquí.
2. **No existe una acción de cancelar** en la app: “Cancelada” solo se pinta si
   la base ya tiene `status = 'cancelled'`. No se agregó endpoint ni botón. Si
   una cancelada conservara pagos registrados, el estado sigue siendo
   “Cancelada” y la línea de dinero muestra esos pagos; no se ocultan.
3. **No existe un estado `failed`/`rejected`** de pago en el flujo actual. Si
   una fila vieja tuviera `payments.status` distinto de `paid`, se muestra su
   estado real, pero no se inventa una transición.
4. La **hora exacta de generación del QR** no se guarda; se usa `updated_at`
   como referencia conservadora.
5. El listado no carga `qr_image` por peso; el detalle sí. Es una decisión de
   rendimiento, no un dato faltante.
6. El detalle de un id inexistente devuelve la UI de no encontrado con status
   HTTP 200 por el shell PPR de Next 16, igual que `/ventas/[id]` en esta base.
7. **En `DEMO_MODE=true` no se puede producir un pago real**: `recordPayment`
   marca `demo=1` por diseño. Las capturas muestran los estados demo. El camino
   “Pago recibido” real está implementado y tipado, pero no se capturó con
   dinero real para no fabricar evidencia falsa.
8. El listado incluye solicitudes con QR/link y pagos CoDi; no incluye pagos de
   tarjeta/wallet sin QR/link. Si el Lead quiere una vista 100 % digital, es un
   cambio de una condición en `CODI_SELECTION` y `isCodiMovement`.

## 4. Estética y responsive

- Se reutiliza el shell, `OperationalPage`, `PageHeader`, `CurrencyAmount` y
  los tokens de `operational-tokens.css` / `operational.css`. No hay design
  system nuevo ni tokens nuevos.
- Papel/crema, verde profundo, Hearth para títulos, Alder para UI e importes
  tabulares; tarjetas 22 px, radios 12 px en controles, sombra única
  `0 2px 8px rgb(31 38 34 / 5%)`, targets de 48 px.
- Medallones de marca (`qr-telefono`, `recibo`, `tienda`, `camión`) en filas y
  conceptos; sello de estado con borde y rotación; ilustración de QR en hero y
  empty; `papel-picado` en la esquina superior derecha del listado.
- Sin navegación nueva en el shell: `/movimientos` no está en `appNav` ni en el
  menú móvil. **El Lead debe agregar la entrada**; la página ya usa
  `activeHref="/movimientos"` para que el ítem se marque solo.
- Responsive verificado a 320, 390 y 1448:
  - listado: KPIs en 3 columnas (1 columna a ≤359), filtros en una fila a 390,
    fila con importe y “Ver detalle” en la misma línea a 390,
  - detalle: hero de 2 columnas a 390, QR a una columna, metadatos 2×2,
    pagos apilados.
- `prefers-reduced-motion`: solo transiciones de color de 180 ms; no hay
  animaciones de importe ni parallax.
- Foco visible en enlaces/controles, H1 único, sellos con texto (no solo
  color), `aria-label` en filtros y alt del QR con folio, referencia e importe.

## 5. Verificación ejecutada

Desde `web/`:

| Comando | Resultado |
|---|---|
| `npm run typecheck` | **PASS** (`next typegen` + `tsc --noEmit`). |
| `npm run lint` | **0 errores**, 2 warnings preexistentes en `ventas/page.tsx` y `shell/app-shell.tsx` (archivos no tocados). |
| `npm run build` | **BUILD OK**. `/movimientos` (ƒ) y `/movimientos/[id]` (◐) en la tabla de rutas. |
| `python reports/RELEVO/codi-movements/capture.py` | **26 capturas**, 0 fallos, 0 errores de consola. |
| `python reports/RELEVO/codi-movements/capture-empty.py` | 2 capturas, `emptyState: true`, 0 errores. |
| Smoke de rutas | 14 rutas clave (`/`, `/inicio`, `/caja`, `/ventas`, `/fiados`, `/corte`, `/corte/historial`, `/metas`, `/pendientes`, `/ayuda`, `/ajustes`, `/movimientos`, filtros) → **200, 0 fallos**. |
| `GET /api/orders?limit=5` | **200**, datos existentes intactos. |
| Overflow horizontal | 320 y 390, texto `large` y `xlarge`: **sin overflow**. |
| Cache-Control | `/movimientos` y detalle: `private, no-store, max-age=0, must-revalidate`. |
| Id de venta de efectivo | `/movimientos/<cash-only>` renderiza “No encontramos este movimiento”; no se mezcla con el historial CoDi. |

`BUILD-SHA.txt` (agregado después del commit de implementación) registra el SHA
exacto del build final y las rutas generadas.

## 6. Evidencia visual

Carpeta: `reports/RELEVO/codi-movements/captures/`.

- Listado:
  - `listado-todos-390x693.png` / `listado-todos-1448x1086.png`
  - `listado-pendientes-390x693.png` / `listado-pendientes-1448x1086.png`
  - `listado-pagados-390x693.png` / `listado-pagados-1448x1086.png`
  - `listado-todos-390-scroll-390x693.png` (filas)
  - `listado-pagados-390-scroll-390x693.png` (pago demo vs QR)
  - `listado-pagados-1448-scroll-1448x1086.png` (filas completas)
- Detalle:
  - `detalle-creada-*`, `detalle-link-*`, `detalle-qr-*`, `detalle-vencida-*`,
    `detalle-demo-*`, `detalle-cancelada-*` a 390 y 1448.
  - `detalle-qr-*-scroll-*` (QR + referencia + aviso),
  - `detalle-vencida-390-scroll-390x693.png` (aviso de vencimiento),
  - `detalle-demo-*-scroll-*` (`Dinero recibido`, demo separado y pagos).
- Empty state:
  - `empty-390x693.png` / `empty-1448x1086.png`, capturados con una base
    temporal sin datos (`DEMO_MODE=false`, `DATABASE_PATH=data/empty-evidence.db`)
    que se eliminó después.
- `smoke.json`: status, errores de consola y archivo por captura.
- `capture.py` y `capture-empty.py`: reproducen las capturas.

### Fixtures de las capturas

La base demo local se pobló con fixtures **solo para evidencia**. No están en
el repo (`web/data/` está ignorado):

| Fixture | Id | Cómo se creó |
|---|---|---|
| Solicitud creada | `ord_5c3c119cd1e946a99903` | `POST /api/orders` con conceptos, sin efectivo ni fiado. |
| QR esperando | `ord_f9feec5678a1400e9a86` | `POST /api/orders` + `POST /api/orders/<id>/pay` `{mode:"qr"}`. |
| QR vencido | `ord_24020334a41d407ba901` | Igual que el anterior; luego `created_at`/`updated_at` a −25 min. |
| Cancelada | `ord_7eb5247aaba6484b8ff1` | Igual que QR; luego `status='cancelled'` en la base local. |
| Pago demo | `demo_hist_4_ord_6a9091556aeb4dfdb768` | Fixture de `seedDemoHistory` (3 pagos CoDi demo). |
| Link generado | `demo_hist_pending_ord_44e3a29878b047a2a846` | Fixture de `seedDemoHistory` (link pendiente). |

`capture.py` usa esos ids. Si se reinicia la demo (`/api/demo/reset`) o se
cambia la base, hay que volver a montar los fixtures o ajustar los ids antes de
repetir las capturas de detalle.

## 7. Lo que falta / siguiente

- **Integración de navegación:** agregar `/movimientos` a `appNav` y al menú
  móvil (el shell no se tocó por instrucción explícita).
- **Decisión de producto:** confirmar si el historial debe incluir también
  pagos de tarjeta/wallet sin QR/link. Hoy se excluyen por ser un historial
  CoDi; el cambio es localizado.
- **Persistencia futura (no implementada):** si se quiere un “vencida” exacto y
  auditable, guardar `qr_expires_at` al adjuntar el QR y derivar de ese campo;
  no se agregó columna en este carril.
- **Cancelación real:** no existe endpoint ni transición; si se necesita, es un
  cambio de backend aparte (no se simuló un botón).
- **Evidencia de pago real:** `DEMO_MODE=true` no produce pagos reales. Para
  capturar “Pago recibido” con pey hace falta un entorno con llaves y webhook
  firmado; no se falsificó un pago en la demo.
