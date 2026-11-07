# Contrato de datos y caché (carril perf-data)

Este documento fija el contrato HTTP que consume la UI de caja. No cambia
ningún campo de dinero: los montos siguen en centavos y los buckets
`verifiedDigitalCents` / `declaredDigitalCents` / demo se conservan igual.

## Límites y paginación

Todos los endpoints de lista aceptan `limit` y `offset` (enteros). Si el
parámetro falta, es inválido o queda fuera de rango, se aplica el default o el
tope; nunca se serializa la tabla completa.

| Endpoint | Default | Tope | Parámetros |
| --- | ---: | ---: | --- |
| `GET /api/orders` | 50 | 200 | `limit`, `offset` |
| `GET /api/credits` | 100 | 200 | `limit`, `offset` |
| `GET /api/tasks` | 50 | 200 | `limit`, `offset` |
| `GET /api/dashboard` | 30 pedidos / 50 pendientes / 100 fiados | 50 / 100 / 200 | `ordersLimit`, `ordersOffset`, `pendingLimit`, `pendingOffset`, `creditsLimit`, `creditsOffset` |

Las respuestas de lista añaden metadatos sin quitar las claves históricas:

```json
{
  "orders": [],
  "limit": 50,
  "offset": 0,
  "total": 5000,
  "hasMore": true,
  "pagination": {
    "limit": 50,
    "offset": 0,
    "returned": 50,
    "total": 5000,
    "hasMore": true
  }
}
```

`/api/dashboard` conserva `merchant`, `demoMode`, `summary`, `orders`,
`pendingOrders` y `credits`, y añade `pagination.{orders,pendingOrders,credits}`,
`creditsTotal` y `creditsHasMore`. La UI actual no manda límites: recibe el
default acotado y sigue pintando la primera página. Para el carril UI:

- El botón “ver más” de fiado debe pedir `/api/credits?limit=100&offset=100`
  (o subir `creditsLimit` en el dashboard) usando `hasMore`.
- El botón “ver más” de actividad debe pedir `/api/orders?limit=50&offset=50`.
- La bandeja de pendientes debe pedir `/api/tasks?limit=50&offset=50`.
- Los payloads de dashboard ya no incluyen más de 100 fiados ni más de 50
  pendientes. `items` se conserva en cada pedido.
- Las listas (`/api/dashboard`, `/api/orders`) devuelven `qrImage: null` para
  no transportar el PNG base64. `qrString`, `qrId` y `numRef` se conservan; la
  UI actual ya dibuja el QR con `qrString` cuando `qrImage` es null. El
  detalle por id (`GET /api/orders/[id]`) sigue devolviendo `qrImage` completo.
  Si el carril UI necesita el PNG en una lista, debe abrir el detalle o pedir
  una ruta con `?includeQr=1` (no implementada todavía a propósito).

## Caché HTTP y 304

`/api/dashboard`, `/api/orders`, `/api/credits`, `/api/analytics` y `/api/tasks`
responden con:

- `ETag` calculado del payload JSON completo (si cambia un saldo, un abono o un
  pedido, cambia el hash).
- `Cache-Control: private, max-age=…, stale-while-revalidate=…`.
- `Vary: Accept-Encoding`.
- `304 Not Modified` sin cuerpo cuando `If-None-Match` coincide.

Perfiles: dashboard 5 s, orders/credits 10 s, analytics 30 s, tasks 5 s. La UI
actual usa `cache: "no-store"`; eso sigue funcionando y no envía condicionales.
Un cliente que quiera aprovechar el 304 debe conservar el `ETag` y mandarlo en
`If-None-Match`.

Las mutaciones (`POST`, `PATCH`, `/api/checkout/[id]`, `/api/reconcile`) no usan
estos perfiles. Las rutas mutables devuelven `Cache-Control: no-store` y la
conciliación también.

## Compresión

`next.config.ts` declara `compress: true` para páginas y assets. En esta versión
de Next el middleware de compresión no aplicó gzip a las respuestas de Route
Handlers JSON, así que `cachedJson` negocia `Accept-Encoding` y comprime el
payload con `gzip` cuando supera 512 bytes. Con `Accept-Encoding: gzip`, las
respuestas de dashboard/orders/credits/analytics devuelven
`Content-Encoding: gzip`; sin él devuelven el JSON en claro con
`Content-Length`. Si la app se sirve detrás de un túnel/proxy que no reenvía
`Accept-Encoding` o que comprime por su cuenta, el encabezado puede variar; el
contrato se verifica contra el servidor Next directo en `:3160+`.

## Reconciliación

`GET /api/reconcile` consulta pey con concurrencia acotada (5–10, default 6),
timeout por petición (`PEY_TIMEOUT_MS`, 10 s) y timeout global
(`RECONCILE_TIMEOUT_MS`, 20 s). No se ejecuta desde el dashboard: solo cuando la
persona abre la tarjeta de conciliación.
