# P0-E · Componente “Cobros pendientes”

Franja compacta y autocontenida para cobros que siguen abiertos en cualquier fecha. No abre hojas ni cobra por sí sola; solo muestra y delega en `onOpen`, `onRetry` y `onViewAll`.

**No está integrada en `caja-app.tsx`** (P0-F seguía usando ese archivo). Este documento define el punto exacto de integración.

## Archivos

- `web/src/components/pending-payments.tsx` — componente `PendingPayments` + `PendingPaymentsProps`.
- `web/src/lib/format.ts` — nuevo `formatActivityDate(iso)`; `formatTime` no cambió.
- `P0-E-COMPONENT.md` — este documento.

## Props

| Prop | Tipo | Uso |
|---|---|---|
| `orders` | `Order[]` | `dashboard.pendingOrders` (la API ya filtra `confirmed`, `payment_pending`, `partially_paid` y limita a 50, del más viejo al más nuevo). |
| `lastCheckedAt` | `string \| null` | ISO de la última lectura **exitosa**. `null` muestra “Aún no se ha comprobado.”. |
| `error` | `string \| null` | Si existe, muestra “No pude comprobar los cobros.” + `Reintentar`. No borra las filas visibles. |
| `onOpen` | `(order: Order) => void` | Solo se llama desde el botón **Ver** de cada fila. |
| `onRetry` | `() => void` | Se llama desde **Reintentar**. |
| `onViewAll` | `() => void` opcional | Aviso al expandir por primera vez. La expansión 3 → 50 ocurre dentro del componente; no navega ni crea un tab. |

## Comportamiento

- Título “Cobros pendientes” + contador y “Total pendiente”.
- El total y el saldo por fila son **saldo digital por cobrar**: `max(0, totalCents − paidCents − creditCents)`. El fiado se consulta en su libreta y no se cuenta dos veces aquí.
- Estados inequívocos, con texto además de color:
  - `confirmed` → **Sin link**
  - `payment_pending` → **Esperando banco**
  - `partially_paid` → **Parcial**, con “Pagó $X de $Y” y el saldo restante.
- Fecha con `formatActivityDate`: `Hoy 2:00 p.m.`, `Ayer 2:00 p.m.`, `31 oct 2:00 p.m.`; añade el año si no es el actual.
- Máximo 3 filas; **Ver todos** expande hasta 50 y **Ver menos** vuelve a 3. Si recibe más de 50, muestra el aviso “Mostrando los primeros 50 de N”.
- Vacío discreto: “No hay cobros pendientes.” Sin error de red no se disfraza de vacío; con error y sin filas se muestra el banner y el total dice “Sin datos”.
- Botones y enlaces con mínimo 48 px, foco visible global (`:focus-visible`), navegación por teclado nativa, `aria-expanded`/`aria-controls` en el expansor y `role="alert"` en el error.
- Sin `useEffect` ni auto-apertura: el componente es presentacional; el polling y el refresh viven en el padre.

## Punto de integración (pendiente, solo en `caja-app.tsx`)

1. Añadir `pendingOrders?: Order[]` a `DashboardData`.
2. Importar y colocar la franja debajo del encabezado de Caja, antes de “Pedido en curso”:

```tsx
import { PendingPayments } from "@/components/pending-payments";

<PendingPayments
  orders={dashboard?.pendingOrders ?? []}
  lastCheckedAt={pendingCheckedAt}
  error={pendingError}
  onOpen={(order) => {
    setActiveOrder(order);
    setTab("caja");
  }}
  onRetry={() => void loadDashboard()}
/>
```

3. En `loadDashboard`:
   - Al terminar bien: `setPendingCheckedAt(new Date().toISOString()); setPendingError(null);`
   - Al fallar: `setPendingError("Revisa tu conexión.");` y **no** vaciar `dashboard`; así las filas previas y su última comprobación siguen visibles.
   - Mantener el guard/`AbortController` para no duplicar peticiones en vuelo.
4. Refresco: llamar a `loadDashboard` al montar, en `visibilitychange` cuando la pestaña pasa a visible y en `focus`. Polling ligero cada 45 s **solo** con `document.visibilityState === "visible"`, con cleanup en `visibilitychange` y unmount. No abrir sheets ni interrumpir una venta durante el polling.
5. Fechas restantes: usar `formatActivityDate` en Actividad y Fiado al integrar; no se tocó `caja-app.tsx` en este corte.

## Verificación no mutante

Ejecutado desde `web/`:

```text
npm run lint      → sin errores
npx tsc --noEmit  → sin errores
npm run build     → compilado; 21 páginas generadas
```

Además se hizo un render SSR manual con datos de ejemplo (4 pendientes → 3 visibles, vacío inicial, vacío comprobado, error sin datos y error con datos previos): sin errores de ejecución y con los textos/estados esperados.

No hay Playwright ni runner de tests instalado en `web/`; no se inventó uno. No se ejecutó `npm run verify:full` ni servidores.

## Riesgos y límites

- El componente no tiene estado de carga: el padre decide si muestra skeleton/oculta la franja en la primera carga.
- Ante error conserva datos deliberadamente; “Última comprobación” puede ser anterior al error. El banner lo aclara.
- Sin polling propio ni actualización optimista: integración debe refrescar; si no, la franja queda congelada.
- El tope de 50 viene de `listPendingOrders(50)`; no hay paginación.
- `onViewAll` solo notifica; no cambia de tab. La lista expandida es la misma franja.
- `formatActivityDate` usa la zona local del navegador. El dashboard se carga en cliente, así que no hay desfase de hidratación esperado.
