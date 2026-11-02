# P0-E · Cobros pendientes visibles, fechas y refresh

> Worktree: `mercado-cero-pendientes` · rama `p0/pendientes` · base `be26105`.
> Este plan se implementa cuando P0-F libere `caja-app.tsx`; no se toca el archivo mientras P0-F corre en `p0/shell`.
> Alcance: visibilidad y continuidad de cobros pendientes. No es el módulo completo de tareas “Pendientes” del negocio.

## 1 · Problema actual

- `getDailySummary.pendingCents` solo cuenta pedidos **de hoy** (`db.ts:612-616`), así que un pendiente de ayer desaparece del resumen.
- `dashboard` pide `listOrders(30)`; un pendiente viejo puede caer fuera.
- El polling de una orden existe solo con el sheet abierto (`caja-app.tsx:896-928`); si el cliente paga después de cerrarlo, la Caja no se entera.
- Actividad y Fiado muestran solo la hora, no la fecha; mezclan días.
- No hay “última comprobación” ni estado “no pude comprobar”.
- Un pendiente `confirmed` (sin link), `payment_pending` (esperando banco) y `partially_paid` (parcial) se agrupan bajo “Por cobrar”, sin distinguirse.

## 2 · Datos

Añadir al dashboard una lista independiente del resumen diario:

```ts
pendingOrders: Order[] // status IN ('confirmed','payment_pending','partially_paid')
```

- `listPendingOrders(limit = 50)` en `db.ts`: filtra por estado, ordena por `created_at ASC` (el más viejo primero), sin filtro de fecha.
- `api/dashboard/route.ts` devuelve `pendingOrders` además de `orders`.
- `DashboardData` en `caja-app.tsx` gana `pendingOrders?: Order[]` cuando se integre la UI.
- No cambiar `summary.pendingCents` en este corte (es el pendiente digital de hoy); la franja usa `pendingOrders`.
- No tocar `orders.status`, `paymentTruth` ni el webhook.

## 3 · UI

### Franja “Cobros pendientes”

Arriba de “Pedido en curso” o inmediatamente debajo del encabezado de Caja:

- Título: “Cobros pendientes” + contador.
- Filas compactas (máximo 3 visibles + “Ver todos”):
  - `Quesadillas · $90.00`
  - estado: `Sin link` (`confirmed`) / `Esperando banco` (`payment_pending`) / `Parcial` (`partially_paid`)
  - fecha: `Hoy 2:00 p.m.` / `Ayer 2:00 p.m.` / `31 oct`
  - botón “Ver” que abre `PaymentPanel` con esa orden.
- Si no hay pendientes, no mostrar la franja (o un estado vacío mínimo).
- No abrir el `PaidSheet` automáticamente; el pago se descubre, la persona decide abrir.
- Enlace “Ver todos” puede abrir una lista expandida con las 50; no crear un tab nuevo.

### Fechas

- Helper `formatActivityDate(iso)`:
  - hoy → `Hoy 2:00 p.m.`
  - ayer → `Ayer 2:00 p.m.`
  - otro → `31 oct 2:00 p.m.` (o `31 oct` si el año es el actual)
- Usarlo en Actividad y Fiado; agrupar por día si no complica el layout.
- No cambiar `formatTime` global; añadir helper.

### Refresh

- `loadDashboard` se llama al montar, al volver a la pestaña (`visibilitychange` visible) y al recuperar foco (`focus`).
- Polling ligero de pendientes cada 45 s **solo si `document.visibilityState === "visible"`**; cleanup en `visibilitychange`/unmount.
- Mostrar “Última comprobación 2:03 p.m.” en la franja.
- Si falla el refresh, mostrar “No pude comprobar; reintentar” en la franja y no borrar los datos visibles.
- No abrir sheets ni interrumpir una venta por el polling.
- No duplicar `loadDashboard` si ya hay una petición en vuelo (guard/AbortController).

## 4 · Reglas

- No tocar webhook/pey/`/api/verify`/`paymentTruth`/SQLite salvo `listPendingOrders`.
- No crear un módulo de tareas; esta franja es solo cobros.
- Mantener P0-A/B (draft/pendiente durable) y P0-C (abono/saldo vivo).
- No borrar un pendiente al abrir otra orden; `activeOrderId` sigue siendo la fuente del “Continuar cobro”.
- Un solo slot de pendiente durable es aceptable; la franja lista todos los `pendingOrders`, pero el aviso de “Continuar” solo guarda uno. Documentarlo.

## 5 · Pruebas

`web/scripts/p0-pendientes-e2e.py` (Playwright, servidor `:3101`, DB temporal):

1. Crear venta `confirmed` sin link; cerrar sheet; la franja muestra “Sin link” y el monto.
2. Generar link; estado “Esperando banco”; la franja se actualiza.
3. Pagar desde otra pestaña/API; la franja se actualiza en ≤45 s o al volver a la pestaña; no se abre un sheet solo.
4. Crear un pendiente ayer (seed/DB o `created_at` manipulado); la franja lo muestra con “Ayer”.
5. Crear `partially_paid`; se distingue “Parcial” y muestra el saldo.
6. Simular `/api/dashboard` 500: la franja muestra error/reintento, no “no hay pendientes”; los datos previos no desaparecen.
7. 360 px sin scroll horizontal; targets 48 px.
8. No requests a `:3000` si se usa `:3101`.
9. Regresión P0-A/B/C: 43/1 y 50/0 en sus scripts.

## 6 · Criterios de aceptación

- Un pendiente de ayer sigue visible después de recargar.
- “Sin link”, “Esperando banco” y “Parcial” son inequívocos.
- El dashboard se actualiza al volver a la pestaña y por polling visible; no hay polling oculto.
- La persona puede abrir el pendiente y cobrarlo; no se abre solo.
- Error de red visible, con reintento; no se disfraza de vacío.
- No hay regresiones en P0-A/B/C, webhook, HIG, móvil/checkout ni build.

## 7 · Dependencias y orden

- **P0-F** está modificando `caja-app.tsx`/`globals.css` en `p0/shell`. No editar `caja-app.tsx` en este worktree hasta que P0-F termine y se mergee.
- Implementación: primero `db.ts` + `api/dashboard` (sin conflicto), luego rebase sobre `master` con P0-F y integrar UI.
- Revisión independiente y E2E antes de merge.
