# Módulos de negocio — Oleada B (`/caja` y `/ventas`)

> **Rol:** `mc-modulos-negocio` · **Modo:** solo lectura. No se editó código ni se hizo commit.
> **Repo:** `mercado-cero` · **Rama:** `design/oleada-b-caja-ventas` · **Base:** `26c7741` (`docs: cierre local de Oleada A`).
> **Fecha:** 4 de noviembre de 2026.
> **Alcance:** independencia de la Caja nueva respecto de inventario, productos, precios maestros y proveedores; contrato de conceptos manuales; interfaces para el catálogo futuro; `/ventas` como historial operativo; acoplamientos y deuda que condicionan delegar Caja/Productos en Oleadas C/D.
> **Fuera de alcance:** implementar, migrar datos, cambiar contratos financieros, tocar `orders.ts`, `db.ts`, APIs, webhook o `/pay/**`.
> **Método:** lectura estática de `web/src`, `web/scripts` y documentación del repo. **No se ejecutó ningún gate, build, smoke ni prueba de navegador.** Este documento no declara PASS de runtime.

---

## 0 · Veredicto ejecutivo

1. **La Caja nueva no depende de inventario, productos, precios maestros ni proveedores.** No importa esos dominios, no llama endpoints de catálogo y su payload de venta solo lleva descripción, cantidad y precio unitario. La única mención a inventario es copy de la interfaz (“No necesitas inventario ni micrófono”).
2. **Los conceptos manuales tienen los tres campos mínimos** —descripción, cantidad y precio— y el servidor los revalida. `OrderItem`, la tabla `order_items` y `POST /api/orders` los soportan de punta a punta.
3. **El catálogo futuro puede integrarse de forma aditiva**, sin reescribir la Caja: un selector opcional que devuelve `productId`, `sku`, precio sugerido y stock opcional; la Caja sigue enviando el precio editado y el servidor guarda la foto del ítem.
4. **`/ventas` muestra lo básico** (folio corto, fecha, cliente si hay fiado, método, estado, conceptos, total, cobrado y saldo fiado), pero **no alcanza para consulta operativa**: no tiene filtros, búsqueda, detalle de pagos ni desglose real/demo, y su etiqueta de estado oculta ventas `confirmed` con dinero por cobrar.
5. **No hay bloqueo P0 para Oleada C.** Sí hay deuda P1 que debe resolverse antes de que Productos toque Caja: la página `/caja` serializa el dashboard completo al cliente, `/ventas` sobrelee datos y hace N+1, y el contrato de ítems aún no tiene identidad de producto/SKU.
6. **El riesgo contractual más delicado** es el hash de idempotencia: agregar campos nuevos sin conservar el hash de los payloads manuales antiguos puede convertir un reintento legítimo en `409 request_id_conflict`.

---

## 1 · Estado del árbol y de la evidencia

El árbol de trabajo **no está limpio**. Al momento de esta lectura:

```text
 M web/next.config.ts
 M web/scripts/oleada-a-smoke.py
 M web/src/app/inicio/page.tsx
 D web/src/app/ventas/route.ts
 M web/src/components/shell/nav.ts
?? quality-reports/oleada-b/
?? web/scripts/oleada-b-a11y.py
?? web/scripts/oleada-b-captures.py
?? web/scripts/oleada-b-smoke.py
?? web/src/app/caja/
?? web/src/app/ventas/page.tsx
?? web/src/app/ventas/ventas.css
?? web/src/components/caja/
```

Consecuencias:

- Cualquier `verify:full` que se ejecute ahora tendrá `gitAtStart.dirty:true` y **no será evidencia válida** hasta que el dueño del carril commitee o revierta.
- Este documento es una auditoría estática, no una certificación. No se declara `ok:true` ni PASS de los gates.
- La evidencia existente de Oleada A (`latest-static.json` en `26c7741`) sirve como base estática de la rama, no como prueba de la Caja nueva.

---

## 2 · Resumen de hallazgos

| ID | Sev. | Hallazgo | Evidencia | Efecto |
|---|---|---|---|---|
| MN-01 | P1 | `/caja` recibe `DashboardData` completo en un client component; solo usa `merchant`. | `app/caja/page.tsx:15-16`; `caja-screen.tsx:51-57,367`; `dashboard.ts:104-123` | Se serializan hasta 30 pedidos + 50 pendientes + 100 créditos con clientes e ítems al navegador. Acopla Caja a Ventas/Fiados y engorda el payload. |
| MN-02 | P1 | `/ventas` llama `getDashboardData` y además `listOrders` por separado. | `ventas/page.tsx:40-43`; `dashboard.ts:104-110` | Carga tres listas que no usa (pedidos, pendientes, créditos) y duplica la consulta de pedidos. |
| MN-03 | P1 | `/ventas` hace una consulta `getCredit` por fila. | `ventas/page.tsx:112` | N+1 con 25 filas; crece con la página y con el número de fiados. |
| MN-04 | P1 | `OrderItem` no tiene `productId`, `sku` ni origen de precio. | `types.ts:17-23`; `db.ts:131-139`; `orders.ts:269-282` | El catálogo no puede enlazar ventas históricas, stock ni reportes por producto sin una migración aditiva. |
| MN-05 | P1 | El hash de idempotencia no está preparado para campos nuevos. | `orders.ts:196-207`; `request-hash.ts:12-30` | Agregar `productId: null` cambia el hash de payloads manuales antiguos y puede romper reintentos. |
| MN-06 | P1 | `/ventas` etiqueta `confirmed` con saldo como “Registrado” y un digital pendiente como “Sin método”/“Efectivo”. | `ventas/page.tsx:208-235`; `payment-labels.ts:118-143` | La comerciante no distingue en la lista qué venta falta cobrar ni por qué vía. |
| MN-07 | P1 | Cambiar de efectivo a fiado conserva el efectivo previo y produce un “Cambio” fantasma. | `caja-screen.tsx:82,189-203,291`; `sale-result.tsx:106-112` | Una venta 100 % fiada puede mostrar “Cambio $100.00” aunque `paidCents=0`. |
| MN-08 | P2 | El catálogo hardcodeado del parser legacy sigue siendo un precio maestro de facto. | `voice-local.ts:5-18`; `voice.ts:55-57,68-74` | La Caja nueva no lo usa, pero Productos tendría dos fuentes de precio si no se retira o adapta. |
| MN-09 | P2 | El cliente solo se persiste cuando hay fiado; no hay `customerId` en `Order`. | `caja-screen.tsx:262`; `orders.ts:187-194,303-326`; `types.ts:25-48` | `/ventas` no puede consultar “cliente” en ventas de contado; un módulo de clientes no tiene identidad estable. |
| MN-10 | P2 | `Order` no expone `demo`; el efectivo demo queda `paid` y `/ventas` lo rotula “Pagado/Cobrado”. | `types.ts:25-48`; `orders.ts:234-255,284-301`; `db.ts:1354-1357`; `ventas/page.tsx:208-219` | En modo demo, una venta simulada en efectivo puede leerse como dinero real salvo por el sello global. |
| MN-11 | P2 | `/ventas` reimplementa etiquetas de estado en vez de usar `payment-labels.ts`. | `ventas/page.tsx:208-235`; `payment-labels.ts:118-143` | Dos verdades para el mismo estado: `confirmed` es “Por cobrar” en un módulo y “Registrado” en otro. |
| MN-12 | P3 | El fixture “Revisar inventario” y el enlace a la Caja legacy sugieren módulos que no existen. | `inicio/page.tsx:58`; `caja-screen.tsx:507-509`; `nav.ts:20-24` | Deuda de contenido, no dependencia funcional. |
| MN-13 | P3 | Zod descarta claves desconocidas; el servidor viejo ignoraría `productId`/`sku` en silencio. | `api/orders/route.ts:30-48` | El orden de despliegue importa: primero contrato servidor, después cliente. |
| MN-14 | P3 | `/ventas` no tiene filtros, búsqueda, detalle de pagos ni estado de carga/error. | `ventas/page.tsx:29-46,98-197` | La consulta operativa depende de recorrer páginas de 25 y abrir `<details>`. |

**No se encontraron** hallazgos de: imports de productos/inventario/proveedores en Caja, llamadas a endpoints de catálogo, escritura de stock, validación de stock, o lectura de precios maestros por la Caja nueva.

---

## 3 · ¿La Caja nueva depende de inventario, productos, precios maestros o proveedores?

### 3.1 Evidencia de independencia

| Superficie | Qué se revisó | Evidencia | Resultado |
|---|---|---|---|
| Imports de Caja | `web/src/components/caja/**` y `web/src/app/caja/**` | `caja-screen.tsx:3-30`; `sale-line-items.tsx:3-6`; `sale-summary.tsx:3-6`; `payment-panel.tsx:3-8`; `sale-result.tsx:3-7` | Solo React, Next, Lucide, shell, `CurrencyAmount`, `format`, `Order`, `DashboardData` y piezas locales. Nada de productos, inventario ni proveedores. |
| Llamadas de red | `fetch` en componentes de Caja | `caja-screen.tsx:116,281`; `payment-panel.tsx:39,68,90,112` | Solo `/api/orders`, `/api/orders/:id`, `/api/orders/:id/pay` y `/api/demo/pay`. Ningún endpoint de catálogo. |
| Payload de venta | `confirmSale` | `caja-screen.tsx:254-263` | `items[]` con `description`, `quantity`, `unitPriceCents`; más `cashCents`, `creditCents`, `customerName` y `requestId`. No hay `productId`, `sku`, `stock` ni `supplierId`. |
| Validación de línea | UI y servidor | `sale-line-items.tsx:28-52`; `caja-screen.tsx:205-241`; `api/orders/route.ts:30-48`; `orders.ts:112-159` | Solo exige descripción no vacía, cantidad > 0 y precio > 0. No consulta existencias. |
| Escritura en base | `createOrder` | `orders.ts:234-343` | Escribe `orders`, `order_items`, `payments` y `credits`. No toca stock, productos ni proveedores. |
| Esquema | `db.ts` | `db.ts:108-300` | No hay tablas `products`, `inventory`, `suppliers` ni equivalentes. `order_items` es una foto plana. |
| Navegación | `nav.ts` | `nav.ts:20-24` | `/productos` y `/proveedores` no se muestran “hasta que existan”. No hay rutas ni enlaces falsos. |
| Copy | Estado vacío de conceptos | `sale-line-items.tsx:66-70` | “Agrega uno a mano. No necesitas inventario ni micrófono.” |
| IA / voz | Caja nueva | `caja-screen.tsx` (sin `/api/voice`); `oleada-b-smoke.py:82-88,269-270` | La venta manual no llama a voz ni a IA. El smoke lo verifica. |
| Precio | Entrada manual | `sale-line-items.tsx:23-25,155-174`; `caja-screen.tsx:256-259` | El precio nace del input y viaja como `unitPriceCents`. No hay lookup de precio maestro. |
| Proveedores | Búsqueda en Caja | `grep` de `proveedor/supplier` en `components/caja` y `app/caja` | Sin coincidencias. |

### 3.2 Lo que existe y no es dependencia de la Caja nueva

1. **`CATALOG` hardcodeado del parser legacy** (`voice-local.ts:5-18`). Lo consume `voice.ts:55-57` para el prompt de OpenAI y `mockParse` como apoyo. La Caja nueva no importa `voice-local` ni `voice`. Es deuda del carril legacy `/`, no de `/caja`.
2. **Fixture “Revisar inventario”** en `/inicio` (`inicio/page.tsx:58`). Es una tarea de demo, no una ruta ni una lectura de inventario. Aun así, sugiere una capacidad inexistente; conviene reemplazarla o etiquetarla como “próximamente” cuando se ordene el contenido.
3. **Enlace a la Caja clásica** en el pie de `/caja` (`caja-screen.tsx:507-509`). Apunta a `/`, que sigue usando `CajaApp` y el parser con catálogo. Si Oleada C retira la Caja legacy, este enlace debe actualizarse.
4. **Comentario de `nav.ts`** (`nav.ts:20-24`). Documenta correctamente que Productos/Proveedores no se muestran hasta que existan. No es dependencia; es una regla de producto.

### 3.3 Dependencia real: el dashboard, no el catálogo

La Caja nueva **sí** depende de `DashboardData`, pero no de productos:

- `app/caja/page.tsx:15-16` llama `getDashboardData({ compactPending: true })`.
- `caja-screen.tsx:51-57` recibe `initialDashboard: DashboardData`.
- `caja-screen.tsx:367` solo usa `initialDashboard.merchant`.
- `dashboard.ts:104-123` carga `listOrders(30)`, `listPendingOrders(50)`, `listCredits(100)`, `getDailySummary()` y totales.
- `pagination.ts:11-16` fija esos defaults.

Efecto: el payload RSC de `/caja` incluye pedidos, ítems, clientes y créditos que la pantalla no muestra. No es una fuga de secretos de autenticación (no hay auth), pero sí es **minimización de datos y rendimiento**: la pantalla de cobro no debería cargar el historial para pintar el nombre del comercio.

**Veredicto de independencia:** la Caja nueva es independiente de inventario/productos/precios/proveedores en código y contrato. Está acoplada al dashboard por una prop demasiado ancha, y ese es el primer arreglo para delegarla limpiamente.

---

## 4 · Conceptos manuales: campos mínimos y contrato real

### 4.1 UI: qué pide y qué valida

`DraftLine` (`components/caja/types.ts:1-6`):

```ts
type DraftLine = {
  id: string;
  description: string;
  quantity: string;
  price: string;
};
```

La fila de alta (`sale-line-items.tsx:139-185`) pide:

| Campo | Control | Validación de alta | Evidencia |
|---|---|---|---|
| Descripción | Texto, placeholder “Ej. Quesadilla” | `trim()` no vacío | `sale-line-items.tsx:28-33` |
| Cantidad | Texto, `inputMode="decimal"`, default `1` | `parseQuantity > 0` | `sale-line-items.tsx:34-37`; `types.ts:27-32` |
| Precio unitario | Texto, `inputMode="decimal"`, placeholder `0.00` | `parseMoneyCents > 0` | `sale-line-items.tsx:38-41`; `types.ts:17-25` |

Después de agregar, cada fila es editable (`sale-line-items.tsx:80-136`) y se puede quitar. El total por fila se calcula con `lineTotalCents` (`types.ts:34-39`) y el total de la venta con `draftTotalCents` (`types.ts:41-43`). La aritmética de la UI redondea cada línea y suma, igual que el servidor (`orders.ts:147-161`).

Validación antes de confirmar (`caja-screen.tsx:205-241`):

1. Al menos un concepto.
2. Descripción no vacía.
3. Cantidad > 0.
4. Precio > 0.
5. Fiado no mayor al total.
6. Fiado requiere nombre.
7. Efectivo debe cubrir el total si el método es efectivo.
8. Fiado debe cubrir el total si el método es fiado.

### 4.2 Servidor: qué acepta y qué revalida

`POST /api/orders` (`api/orders/route.ts:30-48`) valida con Zod:

```ts
{
  description: string,       // 1..160
  quantity: number,          // > 0, <= 999
  unitPriceCents: number     // entero, > 0, <= 10,000,000
}
```

`createOrder` (`orders.ts:112-159`) vuelve a validar y normaliza:

- `quantity` finita, > 0, ≤ `MAX_ITEM_QUANTITY` (999).
- `unitPriceCents` redondeado, > 0, ≤ `MAX_UNIT_PRICE_CENTS` (10,000,000 = $100,000.00).
- `description` con `trim`, no vacía, ≤ `MAX_ITEM_DESCRIPTION_CHARS` (160).
- `totalCents` por ítem entero seguro y > 0.
- Total de venta > 0 y ≤ `MAX_ORDER_TOTAL_CENTS` (100,000,000 = $1,000,000.00).
- Máximo `MAX_ORDER_ITEMS` (50) ítems.

Límites declarados en `orders.ts:27-33`:

| Constante | Valor |
|---|---:|
| `MAX_ORDER_ITEMS` | 50 |
| `MAX_ITEM_DESCRIPTION_CHARS` | 160 |
| `MAX_ITEM_QUANTITY` | 999 |
| `MAX_UNIT_PRICE_CENTS` | 10,000,000 |
| `MAX_ORDER_TOTAL_CENTS` | 100,000,000 |
| `MAX_CUSTOMER_NAME_CHARS` | 120 |
| `MAX_REQUEST_ID_CHARS` | 128 |

### 4.3 `OrderItem`, base de datos y lectura

Tipo (`types.ts:17-23`):

```ts
interface OrderItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}
```

Tabla (`db.ts:131-139`):

```sql
CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
```

Lectura (`db.ts:1275-1302`): `loadOrderItems` mapea exactamente esos cinco campos. `GET /api/orders` y `GET /api/orders/:id` los devuelven; `/ventas` los consume (`ventas/page.tsx:134-137,162-169`); el checkout público también (`checkout.ts:112-118`).

**Veredicto:** los tres campos mínimos están completos y soportados de punta a punta. No hay blockers para vender manualmente. Lo que falta es **metadata opcional de catálogo**, no el mínimo vendible.

### 4.4 Brechas del contrato de ítem

| Campo | Hoy | Impacto | Cuándo hace falta |
|---|---|---|---|
| `productId` | No existe | No se puede enlazar una venta con un producto del catálogo, ni calcular stock/ventas por producto. | Oleada C, opcional |
| `sku` | No existe | No se puede buscar/identificar por código; el nombre es la única identidad. | Oleada C, opcional |
| `priceSource` | No existe | No se distingue precio sugerido de precio editado a mano. | Oleada C, opcional |
| `unitLabel` | No existe | Vender por kilo/gramo obliga a poner la unidad dentro de `description`. | Oleada C, opcional |
| `customerId` | No existe; solo `customerName` en `Order` | El cliente solo se crea/reutiliza cuando hay fiado (`orders.ts:303-326`). No hay historial de cliente para contado. | Módulo de clientes, futuro |
| `demo` en `Order` | No se mapea, aunque `orders.demo` existe | `/ventas` no puede etiquetar por fila el efectivo demo. | Oleada B/C, verdad de dinero |
| Descuento / impuesto / nota | No existen | Fuera del mínimo; no inventar en Caja. | Futuro, con contrato explícito |
| Moneda | No existe; todo es MXN | Correcto para el producto actual. | Solo si se internacionaliza |

---

## 5 · Interfaces para el catálogo futuro

### 5.1 Invariantes de diseño

1. **El catálogo nunca bloquea una venta.** Si la búsqueda falla, tarda o no existe, la Caja sigue funcionando con conceptos manuales.
2. **La foto del ítem manda.** `description`, `quantity`, `unitPriceCents` y `totalCents` se guardan al vender; cambios posteriores de nombre o precio del producto no reescriben la venta.
3. **La identidad de producto es provenance opcional.** `productId`/`sku` sirven para reports y stock, no para reconstruir el precio histórico.
4. **El precio es sugerido, no impuesto.** La comerciante puede editarlo; el servidor no reprecio desde el catálogo.
5. **El stock es advisory.** `stockQty` se muestra si existe; 0 o negativo no deshabilita “Agregar” ni “Confirmar”.
6. **Costo y proveedor no se filtran a Caja.** `costCents` pertenece a reportes/márgenes, no al mostrador.
7. **Compatibilidad hacia atrás.** Los clientes viejos siguen enviando el payload v1 sin campos nuevos.

### 5.2 Contratos propuestos

```ts
// lib/catalog/types.ts (futuro)
export interface CatalogProduct {
  id: string;                    // estable, generado por el servidor
  merchantId: string;
  sku: string | null;            // único por merchant si existe
  name: string;                  // <= 160 para caber en OrderItem.description
  nameNormalized: string;        // minúsculas, sin acentos, para búsqueda
  defaultPriceCents: number;     // sugerencia, entero > 0
  unitLabel: string | null;      // "pieza", "kilo", "litro"...
  stockQty: number | null;       // null = sin control de stock
  stockTracked: boolean;
  costCents: number | null;      // solo reportes; nunca en búsqueda de Caja
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogSuggestion {
  productId: string;
  sku: string | null;
  name: string;
  defaultPriceCents: number;
  unitLabel: string | null;
  stockQty: number | null;
  stockTracked: boolean;
  match: "sku" | "name_exact" | "name_prefix" | "name_contains";
}
```

Contrato de venta v1 (el actual, congelado):

```ts
export interface SaleItemInputV1 {
  description: string;
  quantity: number;
  unitPriceCents: number;
}
```

Contrato de venta v2 (aditivo, opcional):

```ts
export type PriceSource = "manual" | "catalog" | "catalog_override";

export interface SaleItemInputV2 extends SaleItemInputV1 {
  productId?: string | null;
  sku?: string | null;
  priceSource?: PriceSource;
  unitLabel?: string | null;
}
```

`OrderItem` v2 (lectura):

```ts
export interface OrderItem {
  id: string;
  description: string;          // snapshot
  quantity: number;
  unitPriceCents: number;       // snapshot
  totalCents: number;
  productId?: string | null;    // provenance, no FK obligatoria
  sku?: string | null;          // snapshot del SKU al vender
  priceSource?: PriceSource | null;
  unitLabel?: string | null;
}
```

**Regla:** `CatalogSuggestion` no es `SaleItemInput`. El selector transforma una sugerencia en una línea editable; la Caja nunca envía un objeto de catálogo completo.

### 5.3 API de búsqueda

Propuesta:

```http
GET /api/products?q=ques&limit=8&active=1
GET /api/products?sku=QUE-001
GET /api/products/:id
```

Respuesta de búsqueda:

```json
{
  "products": [
    {
      "productId": "prd_...",
      "sku": "QUE-001",
      "name": "Quesadilla",
      "defaultPriceCents": 3500,
      "unitLabel": "pieza",
      "stockQty": 4,
      "stockTracked": true,
      "match": "name_prefix"
    }
  ],
  "total": 1,
  "hasMore": false
}
```

Semántica:

- `q` mínimo 2 caracteres para nombre; `sku` exacto puede ser 1.
- Búsqueda sin acentos y sin distinguir mayúsculas sobre `nameNormalized`; el SKU se normaliza aparte.
- Orden: SKU exacto → nombre exacto → prefijo → contiene; desempate alfabético.
- `limit` default 8, máximo 20.
- Solo `active=1` por defecto; `active=0` requiere parámetro explícito.
- Nunca devuelve `costCents` en la búsqueda de Caja.
- Rate limit separado del de ventas (por ejemplo 120/min).
- Si no hay catálogo, la ruta puede no existir; la Caja no la llama salvo que el flag esté activo.

### 5.4 SKU

- Opcional. Un producto sin SKU es válido.
- Único por `merchantId` cuando existe, comparación case-insensitive y sin espacios externos.
- Longitud recomendada ≤ 64; caracteres `[A-Z0-9._-]`.
- Se guarda `sku` normalizado en el producto y **snapshot** en `order_items.sku`.
- No se usa como llave primaria de la venta ni como sustituto de `description`.
- No se backfillean ventas históricas: quedan con `sku = NULL`.

### 5.5 Precio sugerido y edición

Secuencia:

1. La persona busca “quesadilla”.
2. El selector muestra `Quesadilla · $35.00 · stock 4`.
3. Al elegir, se llena la fila de alta con descripción y precio; la cantidad queda en 1 y es editable.
4. Si la persona no toca el precio, `priceSource = "catalog"`.
5. Si lo cambia, `priceSource = "catalog_override"`.
6. Si escribe todo a mano, `priceSource = "manual"` o `null` (v1).
7. Al confirmar, se envía `unitPriceCents` ya resuelto. El servidor no vuelve a consultar el catálogo para repreciar.

Reglas:

- Un precio de catálogo ≤ 0 o > `MAX_UNIT_PRICE_CENTS` se ignora; se muestra error de dato y se permite escribir a mano.
- Un cambio de precio en el catálogo no actualiza líneas ya agregadas al borrador.
- Un cambio de nombre en el catálogo no actualiza líneas ya agregadas.
- No hay “precio maestro” que rechace una venta por debajo o por encima del sugerido.

### 5.6 Stock opcional

- `stockQty: null` significa “no se lleva stock”; la UI no muestra cifra.
- `stockQty: 0` muestra “Sin stock registrado”; **no** deshabilita el alta ni la confirmación.
- `stockQty < 0` se muestra como advertencia; no bloquea.
- En Oleada C **no se descuenta stock** al vender. El stock es informativo/manual.
- Si Oleada D decide descontar, debe ser una proyección posterior al commit de la venta, idempotente por `(orderId, orderItemId, reason)`, y nunca dentro de `createOrder`.
- Ventas demo no deben mover stock real. Si el catálogo se comparte entre demo/real, la proyección filtra `orders.demo = 0` y `status != 'demo_paid'`.
- Ítems manuales sin `productId` no generan movimiento de stock; es correcto y debe reportarse como “sin producto”.

### 5.7 Evolución de base de datos

Migración aditiva, siguiendo el patrón `PRAGMA table_info` + `ALTER TABLE` de `db.ts:315-459`:

```sql
-- Catálogo (Oleada C)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  sku TEXT,
  sku_normalized TEXT,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  default_price_cents INTEGER NOT NULL,
  unit_label TEXT,
  stock_qty REAL,
  stock_tracked INTEGER NOT NULL DEFAULT 0,
  cost_cents INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku
  ON products(merchant_id, sku_normalized)
  WHERE sku_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_name
  ON products(merchant_id, name_normalized);

-- Snapshot de venta (Oleada C)
ALTER TABLE order_items ADD COLUMN product_id TEXT;
ALTER TABLE order_items ADD COLUMN sku TEXT;
ALTER TABLE order_items ADD COLUMN price_source TEXT;
ALTER TABLE order_items ADD COLUMN unit_label TEXT;
```

Decisiones:

- **Sin FK con `ON DELETE CASCADE`** desde `order_items.product_id` a `products.id`: borrar un producto no puede borrar ni romper la venta histórica.
- El producto se desactiva (`active = 0`), no se borra físicamente si tiene ventas.
- `sku` en `order_items` es snapshot; si el producto cambia de SKU, la venta conserva el viejo.
- `product_id` puede quedar huérfano si el producto se borra; los reportes lo tratan como “producto eliminado” y usan el snapshot.
- No se backfillea `product_id` en ventas históricas: no hay forma fiable de inferirlo desde una descripción libre.

### 5.8 Idempotencia compatible

El hash actual (`orders.ts:196-207`) incluye:

```ts
{
  items: items.map(({ description, quantity, unitPriceCents }) => ({
    description, quantity, unitPriceCents,
  })),
  cashCents,
  creditCents,
  customerName,
}
```

Para v2, **incluir los campos nuevos solo cuando están presentes**:

```ts
const hashItems = items.map((item) => ({
  description: item.description,
  quantity: item.quantity,
  unitPriceCents: item.unitPriceCents,
  ...(item.productId ? { productId: item.productId } : {}),
  ...(item.sku ? { sku: item.sku } : {}),
}));
```

Así:

- Un payload manual v1 sigue produciendo el mismo hash que antes del despliegue.
- Un payload v2 con `productId`/`sku` produce un hash distinto, como debe ser.
- `priceSource` no necesita entrar al hash: no cambia el dinero ni la identidad del ítem. Si se incluye, que sea solo cuando exista, para no romper v1.
- `unitLabel` no entra al hash: es presentación.

**Orden de despliegue:** primero el servidor con el esquema Zod v2 y las columnas; después el cliente que envía los campos. Si se hace al revés, Zod los descarta en silencio (`api/orders/route.ts:30-48`) y la venta se guarda sin provenance, sin error visible.

### 5.9 Secuencia de integración sin reescribir Caja

| Paso | Cambio | Archivo | Riesgo |
|---:|---|---|---|
| 1 | Agregar campos opcionales a `DraftLine` | `components/caja/types.ts` | Bajo; no cambia el mínimo |
| 2 | Crear `CatalogPicker` como componente aislado | `components/caja/catalog-picker.tsx` (nuevo) | Bajo; se puede no renderizar |
| 3 | Al elegir, llenar la fila de alta (no agregar directo) | `sale-line-items.tsx` | Bajo; conserva edición y cantidad |
| 4 | Propagar `productId`/`sku`/`priceSource` al payload | `caja-screen.tsx:254-263` | Bajo; campos opcionales |
| 5 | Ampliar Zod y `createOrder` | `api/orders/route.ts`; `orders.ts` | Medio; hash y migración |
| 6 | Persistir y mapear columnas nuevas | `orders.ts:269-282`; `db.ts:1275-1302` | Medio; nullable |
| 7 | Mostrar provenance en `/ventas` (opcional) | `ventas/page.tsx` | Bajo; usar snapshot, no join |
| 8 | Reportes por producto/SKU | nuevo query/report | Diferido; no bloquea Caja |

No se requiere reescribir `CajaScreen`, `SaleSummary`, `PaymentPanel` ni `SaleResult`. El cambio máximo es una prop opcional y un componente de selección.

### 5.10 Modos de falla del catálogo

| Falla | Comportamiento esperado de Caja |
|---|---|
| `/api/products` 500 / timeout | El selector muestra “No se pudo buscar; escribe el concepto” y el alta manual sigue operativa. |
| Búsqueda vacía | “Sin resultados”; no se inventa precio. |
| Producto desactivado entre búsqueda y confirmación | La venta se completa con el snapshot; no se bloquea. |
| Producto borrado entre búsqueda y confirmación | Igual: snapshot; `productId` puede quedar huérfano y se reporta como tal. |
| Precio de catálogo inválido (0/negativo) | Se ignora la sugerencia; se exige precio manual > 0. |
| SKU duplicado al crear producto | 409 en el módulo de productos; no afecta ventas existentes. |
| Catálogo deshabilitado | El selector no se renderiza; la Caja es idéntica a la de Oleada B. |
| Stock 0 | Advertencia visible; “Agregar” y “Confirmar” siguen habilitados. |

### 5.11 Frontera con proveedores

- Proveedores es un dominio separado: `suppliers`, `purchases`, `purchase_items`, `payments_to_suppliers`.
- La Caja **no** importa, consulta ni escribe proveedores.
- `costCents` puede vivir en `products` para reportes de margen, pero **no** se devuelve en la búsqueda de Caja.
- Una compra a proveedor incrementa stock en su propia transacción; no crea ventas ni toca `orders`.
- Si se quiere margen histórico exacto, se necesita `unit_cost_cents` snapshot en `order_items`; es una decisión de Oleada D, no de B. Sin ese snapshot, el margen se calcula con el costo actual y puede mentir sobre el pasado.

---

## 6 · `/ventas` como historial operativo

### 6.1 Qué muestra hoy

| Dato | ¿Presente? | Fuente | Observación |
|---|---|---|---|
| Folio | Parcial | `shortOrder(order.id)` (`ventas/page.tsx:127`) | Solo últimos 4 caracteres; puede colisionar y no sirve para buscar. |
| Fecha/hora | Sí | `formatActivityDate(order.createdAt)` (`ventas/page.tsx:130`) | Formato “Hoy/Ayer/fecha”. |
| Cliente | Solo fiado | `order.customerName` (`ventas/page.tsx:131`) | En contado se envía `null` desde la Caja nueva. |
| Método | Parcial | `methodLabel(order)` (`ventas/page.tsx:130,221-235`) | Usa `paymentMethod` escalar; no refleja digital pendiente ni desglose. |
| Estado | Parcial | `statusLabel` (`ventas/page.tsx:121-126,208-219`) | `confirmed` con saldo se rotula “Registrado”. |
| Conceptos | Sí | `order.items` (`ventas/page.tsx:134-137,159-172`) | Resumen y `<details>` con cantidad × precio. |
| Total | Sí | `order.totalCents` | — |
| Cobrado | Parcial | `order.paidCents` (`ventas/page.tsx:142-148`) | Incluye pagos demo; no desglosa efectivo/digital. |
| Fiado | Parcial | `order.creditCents` + `getCredit` (`ventas/page.tsx:112-114,150-157`) | Muestra saldo vivo si el crédito existe; N+1. |
| Paginación | Sí | `searchParams.page`, 25 por página | Solo anterior/siguiente. |

### 6.2 Qué falta para consulta operativa

| Falta | Por qué importa | Prioridad |
|---|---|---|
| Filtro por fecha (hoy/7 días/rango) | La lista mezcla todos los días; el resumen es solo “hoy”. | P1 |
| Filtro por estado (pagadas, por cobrar, fiado, demo) | No se puede aislar la cobranza pendiente. | P1 |
| Búsqueda por folio, cliente o concepto | Con 25 por página, encontrar una venta es manual. | P1 |
| Desglose de pagos | “Cobrado” no dice cuánto fue efectivo, digital verificado, demo o fiado. | P1 |
| Estado “por cobrar” en la fila | Una venta `confirmed` con saldo digital no se distingue de una venta registrada sin deuda. | P1 |
| Detalle de venta | El `<details>` solo lista conceptos; no muestra pagos, timestamps ni saldo vivo completo. | P2 |
| Acción “Cobrar saldo” | Una venta con digital pendiente no se puede retomar desde el historial. | P2 |
| Enlace a Fiados | El saldo fiado se muestra, pero no se navega al cliente/crédito. | P2 |
| Etiqueta demo por fila | El sello global DEMO no distingue una fila demo de una real si la base se reutiliza. | P2 |
| Cliente en contado | El cliente solo existe si hay fiado; no hay `customerId`. | P2 |
| Imprimir/exportar | No hay recibo ni CSV. | P3 |
| Estado de carga/error | La página es server component; un fallo de DB es un 500 sin recuperación. | P3 |

### 6.3 Problemas de verdad del dinero en `/ventas`

1. **`statusLabel` no coincide con `payment-labels.ts`.**
   - `payment-labels.orderStatusCopy("confirmed")` devuelve `pending` → “Por cobrar” (`payment-labels.ts:118-123`).
   - `/ventas` devuelve “Registrado” para `confirmed` sin crédito y con saldo (`ventas/page.tsx:208-219`).
   - Efecto: la lista no señala la cobranza digital pendiente antes de generar link/QR.

2. **`methodLabel` usa el escalar `paymentMethod`.**
   - Una venta solo digital queda `paymentMethod = null` al crear (`orders.ts:244-248`) y `/ventas` muestra “Sin método”.
   - Una venta efectivo + digital pendiente queda `paymentMethod = "cash"` y `/ventas` muestra “Efectivo”, aunque falte cobrar la parte digital.
   - El método real debería derivarse de `payments` + `due` + `credit`, no solo del campo escalar.

3. **`paidCents` incluye pagos demo.**
   - `createOrder` en demo con efectivo exacto deja `status = paid` y `payments.demo = 1` (`orders.ts:234-255,284-301`).
   - `Order` no expone `demo` (`types.ts:25-48`; `db.ts:1375-1401` no lo mapea).
   - `/ventas` muestra “Pagado” y “Cobrado” (`ventas/page.tsx:142-148,214`). El sello DEMO del shell es la única señal.
   - En modo real los pedidos demo se filtran (`db.ts:1409-1424`), pero en modo demo con base reutilizada puede haber filas reales y demo mezcladas.

4. **El cliente no es una identidad, es un nombre de fiado.**
   - `customerName` se guarda en `orders`; `customerId` no existe en `Order`.
   - `findOrCreateCustomer` solo se llama si `creditCents > 0` (`orders.ts:303-326`).
   - Una venta de contado con nombre de cliente no tiene entidad para consultar historial.

5. **No hay desglose de pagos.**
   - `Order` tiene `paidCents`, `digitalPaidCents`, `creditCents`, `lastPaymentProvider`, `lastPaymentDemo`, pero `/ventas` solo muestra `paidCents` y `creditCents`.
   - No se puede responder “¿cuánto entró en efectivo y cuánto por pey?” desde la fila.

### 6.4 Contrato de consulta propuesto

Extender `listOrders` sin romper llamadas actuales:

```ts
listOrders({
  limit?: number,
  offset?: number,
  from?: string,          // ISO, inicio del día México
  to?: string,            // ISO, fin exclusivo
  status?: "all" | "paid" | "pending" | "credit" | "demo",
  customer?: string,
  q?: string,             // folio, cliente o concepto
});
```

Reglas:

- `status=paid`: `due <= 0` y saldo de crédito 0 y no demo/cancelado.
- `status=pending`: `MAX(total - paid - credit, 0) > 0` (digital o parcial).
- `status=credit`: saldo de crédito vivo > 0.
- `status=demo`: `orders.demo = 1` o `status = demo_paid` o último pago demo.
- `q` busca en `orders.id`, `orders.customer_name` y `EXISTS (SELECT 1 FROM order_items WHERE order_id = orders.id AND description LIKE ?)`.
- Orden `created_at DESC, id DESC`; paginación por offset en B, keyset en C si crece.
- Devolver `pagination` con `total` y `hasMore`.
- Batch de créditos: `getCreditsByOrderIds(ids)` para eliminar el N+1.
- Si se expone `GET /api/orders`, aceptar los mismos parámetros; `/ventas` puede seguir leyendo por servidor con la misma función.

Detalle:

- Reutilizar `GET /api/orders/:id` (`api/orders/[id]/route.ts:11-18`), que devuelve `{ order, payments, credit }`.
- Mostrar pagos con `provider`, `method`, `amountCents`, `demo`, `createdAt`.
- No unir con catálogo para mostrar la venta; usar el snapshot de `order_items`.

### 6.5 Criterios de aceptación de `/ventas`

1. Cada fila muestra: folio completo o copiable, fecha/hora, cliente o “Mostrador”, método real, estado, conceptos, total, cobrado real, pendiente y saldo fiado.
2. `confirmed` con saldo se muestra como “Por cobrar”, no “Registrado”.
3. Un digital pendiente se muestra como “Digital pendiente” o “Por cobrar”, no “Sin método”.
4. Un pago demo se marca como demo en la fila; no se suma a “Cobrado confirmado”.
5. Filtros de fecha, estado y búsqueda funcionan por URL y sobreviven a refresh/atrás.
6. El detalle muestra desglose de pagos y saldo vivo; no solo conceptos.
7. No hay N+1: una consulta de pedidos y una consulta batched de créditos.
8. La página funciona sin tablas de productos/inventario/proveedores.
9. Empty state y error state son explícitos; no se muestra `$0` como verdad si la lectura falló.
10. La lista no promete acciones que el backend no soporta (cancelar, reembolsar, editar).

---

## 7 · Dependencias ocultas, acoplamientos y deuda

### 7.1 MN-01 — `/caja` serializa el dashboard completo al cliente

**Evidencia:**

- `app/caja/page.tsx:15-16`: `getDashboardData({ compactPending: true })`.
- `caja-screen.tsx:1` es `"use client"`.
- `caja-screen.tsx:51-57`: prop `initialDashboard: DashboardData`.
- `caja-screen.tsx:367`: solo `initialDashboard.merchant`.
- `dashboard.ts:104-123`: carga pedidos, pendientes, créditos y resumen.
- `pagination.ts:11-16`: 30 pedidos, 50 pendientes, 100 créditos por defecto.

**Impacto:** payload grande, datos de clientes/créditos que la pantalla no necesita, y acoplamiento a los módulos de Ventas/Fiados. Si mañana Productos agrega datos al dashboard, Caja no debería enterarse.

**Fix mínimo:** cambiar la prop a `merchant: typeof MERCHANT` y `demo: boolean`; en la página pasar `MERCHANT` e `isDemoMode()`. Eliminar el import de `DashboardData`. No cambia el comportamiento visible.

**Criterio:** el HTML/RSC de `/caja` no contiene pedidos, ítems, créditos ni nombres de clientes del dashboard.

### 7.2 MN-02/MN-03 — `/ventas` sobrelee y hace N+1

**Evidencia:**

- `ventas/page.tsx:40`: `getDashboardData({ compactPending: true })`.
- `ventas/page.tsx:41-43`: `listOrders(25, offset)`, `countOrders()`.
- `dashboard.ts:104-110`: otra `listOrders(30)`, `listPendingOrders(50)`, `listCredits(100)`.
- `ventas/page.tsx:112`: `getCredit(order.creditId)` por cada fila.

**Impacto:** hasta 80 pedidos hidratados con ítems (30 recientes + 50 pendientes) y 100 créditos para pintar 25 filas; N+1 de créditos; tiempo de respuesta y memoria. No es un problema de producto, pero sí de escalabilidad y de límites entre módulos.

**Fix:** crear una lectura específica de Ventas:

```ts
const merchant = MERCHANT;
const demo = isDemoMode();
const summary = getDailySummary();
const pendingCentsTotal = sumPendingOrderBalances();
const orders = listOrders(limit, offset);
const total = countOrders();
const credits = getCreditsByOrderIds(orders.map(o => o.id));
```

No reutilizar `getDashboardData` para una pantalla que no es el dashboard.

### 7.3 MN-04/MN-05 — Identidad de producto e idempotencia

**Evidencia:**

- `types.ts:17-23`: `OrderItem` mínimo.
- `db.ts:131-139`: tabla plana.
- `orders.ts:269-282`: inserción de ítems.
- `orders.ts:196-207`: hash solo con descripción/cantidad/precio.
- `request-hash.ts:12-30`: canonicalización; agregar una clave cambia el hash.

**Impacto:** sin `productId`, el catálogo no puede reportar ventas por producto ni descontar stock. Sin cuidado con el hash, un reintento de una venta manual creada antes del despliegue puede responder `409` y la persona reintenta con otra llave, duplicando la venta.

**Fix:** migración nullable + hash condicional (ver §5.7 y §5.8). No backfill.

### 7.4 MN-06/MN-07 — Semántica de estado/método y cambio fantasma

**Evidencia:**

- `ventas/page.tsx:208-219`: `confirmed` → “Registrado”.
- `ventas/page.tsx:221-235`: método desde `paymentMethod`.
- `payment-labels.ts:118-143`: `confirmed` → “Por cobrar”.
- `caja-screen.tsx:189-203`: `chooseMethod("credit")` no limpia `cashInput`.
- `caja-screen.tsx:82`: `changeForSale = cashCents - appliedCashCents`.
- `caja-screen.tsx:291`: `setChangeCents(changeForSale)`.
- `sale-result.tsx:106-112`: muestra “Cambio” si `changeCents > 0`.

**Reproducción del cambio fantasma:**

1. Agregar un concepto de $100.
2. Escribir “Efectivo recibido” = 100.
3. Pulsar “Fiado” (el método cambia, pero `cashInput` sigue en 100).
4. `creditInput` se llena con 100; `appliedCredit = 100`; `appliedCash = 0`.
5. Confirmar: el payload envía `cashCents=0`, `creditCents=100`.
6. El resultado muestra “Cambio $100.00” aunque no entró efectivo.

**Fix:** al elegir `credit`, limpiar `cashInput`; o calcular `changeForSale` solo si `method === "cash" || method === "mixed"`. Preferible lo segundo como invariante, y limpiar también al cambiar de método para no arrastrar estado.

**Fix de verdad:** usar `payment-labels.ts` en `/ventas` y derivar el método de las filas de pago + saldo, no del escalar. Agregar `demo` a `Order` o un `paymentBreakdown` para etiquetar por fila.

### 7.5 MN-08 — Catálogo hardcodeado legacy

**Evidencia:**

- `voice-local.ts:5-18`: 12 productos con precios fijos.
- `voice.ts:55-57`: el prompt se construye con `CATALOG`.
- `voice.ts:68-74`: “usa el precio del catálogo”.
- La Caja nueva no importa `voice-local` ni `voice`.

**Impacto:** hoy no afecta `/caja`. Mañana, si Productos crea un catálogo real, el parser legacy seguirá con precios hardcodeados y duplicados. También el prompt crecerá si el catálogo se vuelve grande; no conviene inyectar todo el catálogo en el prompt.

**Recomendación:** cuando exista catálogo, reemplazar `CATALOG` por una lectura de los top-N productos relevantes o por un `CatalogPort`; si no, retirar la voz legacy. La Caja nueva no debe adoptar este catálogo como dependencia.

### 7.6 MN-09/MN-10 — Cliente y demo

**Cliente:**

- `caja-screen.tsx:262`: `customerName` solo si `appliedCreditCents > 0`.
- `orders.ts:187-194`: el nombre se guarda aunque no haya fiado, pero la UI no lo pide.
- `orders.ts:303-326`: `findOrCreateCustomer` solo en fiado.
- `types.ts:25-48`: no hay `customerId` en `Order`.

**Demo:**

- `orders.ts:234-255`: `status` inicial `confirmed`; `orders.demo` se guarda.
- `orders.ts:284-301`: pago cash demo con `demo=1`.
- `orders.ts:328-335`: si `digitalDue <= 0` y no hay crédito, `status='paid'`.
- `db.ts:1354-1357`: `lastPaymentDemo` solo se marca para métodos distintos de cash.
- `ventas/page.tsx:208-219`: `paid` → “Pagado”.

**Recomendación:** exponer `demo: boolean` en `Order` (mapear `orders.demo`) o un `paymentBreakdown` que permita etiquetar la fila. No cambiar la regla de negocio: el efectivo demo sigue siendo efectivo simulado, no pey.

### 7.7 MN-11/MN-12 — Etiquetas duplicadas y contenido que promete módulos

- `/ventas` tiene su propio `statusLabel` y `methodLabel`; `payment-labels.ts` ya tiene la verdad central. Unificar para que Caja, Ventas y checkout no digan cosas distintas.
- `inicio/page.tsx:58` muestra “Revisar inventario” como tarea fixture. No hay módulo; es una promesa visual.
- `caja-screen.tsx:507-509` enlaza a la Caja legacy “mientras migramos el resto de los módulos”. Si se retira `/`, actualizar el enlace.

### 7.8 MN-13/MN-14 — Despliegue y operación

- Zod `.object` descarta claves desconocidas: si el cliente v2 se despliega antes que el servidor, `productId`/`sku` se pierden sin error. Desplegar servidor primero.
- `/ventas` no tiene filtros ni detalle de pagos. Es la deuda funcional más visible para Oleada C/D.

---

## 8 · Fronteras de delegación para Oleadas C/D

### 8.1 Matriz de propiedad

| Dominio | Posee | Lee | Nunca debe |
|---|---|---|---|
| **Caja** | Borrador, línea manual, selección de método, POST de venta, idempotencia, resultado, polling del cobro. | `Order`, `OrderItem`, `Credit` (solo para mostrar saldo), `merchant`. | Importar productos/inventario/proveedores; validar stock; leer precios maestros; escribir catálogo. |
| **Productos** | CRUD de catálogo, búsqueda, SKU, precio sugerido, activo/inactivo, unidad. | Nada de ventas para operar; opcionalmente ventas agregadas para reportes. | Escribir `orders`, `order_items`, `payments` o `credits`; bloquear una venta; imponer precio. |
| **Inventario** | Stock, movimientos, ajustes, mermas, compras internas. | `order_items` con `productId`; productos. | Validar stock dentro de `createOrder`; impedir una venta; descontar demo. |
| **Proveedores** | Proveedores, compras, costos, cuentas por pagar. | Productos. | Tocar Caja, ventas o precios de venta; exponer costos en la búsqueda de Caja. |
| **Ventas** | Lectura, filtros, detalle, historial. | `orders`, `order_items`, `payments`, `credits`. | Repreciar con catálogo; unir productos para mostrar historia; editar ventas. |
| **Contrato compartido** | `SaleItemInputV1/V2`, `OrderItem`, `CatalogSuggestion`. | — | Depender de implementaciones concretas. |

### 8.2 Secuencia recomendada

**Oleada B (ahora):**

1. Congelar `SaleItemInputV1` y documentar que el mínimo es descripción/cantidad/precio.
2. Arreglar MN-01 (prop de Caja), MN-02/03 (lectura de Ventas), MN-06/07 (verdad de estado/cambio).
3. Agregar pruebas estáticas de independencia y payload.
4. No crear tablas de productos todavía.

**Oleada C (Productos):**

1. Migración aditiva de `products` y columnas nullable en `order_items`.
2. API de búsqueda/CRUD.
3. `CatalogPicker` detrás de flag; la Caja manual sigue siendo el camino por defecto.
4. Enviar `productId`/`sku`/`priceSource` opcionales.
5. Reportes por producto con bucket “sin producto” para ventas manuales.
6. No stock automático.

**Oleada D (Inventario/Proveedores):**

1. `suppliers`, `purchases`, `stock_movements` y proyección de stock.
2. Movimiento de venta **post-commit**, idempotente, opcional.
3. Si falla la proyección, la venta sigue siendo válida; reconciliación posterior.
4. Costos y márgenes en reportes, no en Caja.

### 8.3 Archivos que no deben tocarse en paralelo

| Archivo | Por qué | Sugerencia |
|---|---|---|
| `web/src/lib/orders.ts` | `createOrder`, hash, validaciones, pagos. | Un solo dueño por ola; coordinar C. |
| `web/src/lib/db.ts` | Migraciones y hidratación de pedidos. | Un solo dueño; migraciones aditivas. |
| `web/src/lib/types.ts` | `OrderItem`/`Order` son contrato compartido. | Cambios con revisión de Caja y Ventas. |
| `web/src/components/caja/caja-screen.tsx` | Payload y estado de la venta. | C no lo reescribe; solo prop opcional. |
| `web/src/app/ventas/page.tsx` | Read model y etiquetas. | Puede ir en carril separado si no toca Caja. |

### 8.4 Rollback

- **Flag de catálogo apagado:** la Caja vuelve al alta manual sin cambios de datos.
- **Columnas nullable:** no rompen consultas viejas; los ítems históricos quedan con `NULL`.
- **Sin backfill:** no hay migración de datos que revertir.
- **API v2 opcional:** un cliente viejo sigue funcionando con v1.
- **Stock post-commit:** si se desactiva la proyección, las ventas siguen; solo se pierde el stock actualizado.

---

## 9 · Criterios de aceptación

### 9.1 Caja Oleada B — independencia y mínimo vendible

1. **Independencia estática:** en `web/src/app/caja/**` y `web/src/components/caja/**` no hay imports de `products`, `catalog`, `inventory`, `suppliers` ni equivalentes; solo aparecen en copy/comentarios.
2. **Independencia de red:** las únicas llamadas son a `/api/orders`, `/api/orders/:id`, `/api/orders/:id/pay` y `/api/demo/pay`.
3. **Build sin catálogo:** `npm run build` funciona sin tablas `products`/`inventory`/`suppliers`.
4. **Payload mínimo:** una venta manual envía exactamente `items[{description,quantity,unitPriceCents}]`, `cashCents`, `creditCents`, `customerName`, `requestId`; no envía `productId`/`sku`.
5. **Persistencia:** `order_items` tiene una fila por concepto con `description`, `quantity`, `unit_price_cents`, `total_cents`.
6. **Revalidación:** el servidor rechaza descripción vacía, cantidad ≤ 0 o precio ≤ 0 aunque la UI falle.
7. **Medios:** efectivo exacto, efectivo con cambio, efectivo + fiado, fiado total, digital y mixto funcionan sin catálogo.
8. **Sin IA:** la venta manual no llama `/api/voice` ni depende de OpenAI.
9. **Payload RSC:** `/caja` no serializa pedidos, créditos ni clientes del dashboard; solo el comercio y el flag demo.
10. **Cambio fantasma:** una venta 100 % fiada nunca muestra “Cambio” por efectivo previo.
11. **Borrador/idempotencia:** recargar conserva el borrador; reintentar con la misma llave no duplica.
12. **Ventas:** la venta nueva aparece en `/ventas` con conceptos, total y estado correctos.

### 9.2 Catálogo Oleada C — integración aditiva

1. `GET /api/products?q=` devuelve ≤ 20 sugerencias con `productId`, `sku`, `name`, `defaultPriceCents`, `unitLabel`, `stockQty`, `stockTracked`; nunca `costCents`.
2. Búsqueda por SKU exacto funciona sin acentos y sin distinguir mayúsculas.
3. SKU duplicado por merchant devuelve 409 al crear/editar producto; una venta existente no se rompe.
4. El selector llena descripción y precio, pero la persona puede editar cantidad y precio antes de agregar.
5. `priceSource` distingue `catalog`, `catalog_override` y `manual`.
6. Un precio de catálogo inválido no bloquea: se ignora y se pide precio manual.
7. Stock 0/negativo no deshabilita “Agregar” ni “Confirmar”.
8. Producto desactivado/borrado después de elegirlo no bloquea la venta; se guarda el snapshot.
9. Cambiar el precio del catálogo no altera líneas ya agregadas ni ventas históricas.
10. `order_items` guarda `product_id`, `sku` y `price_source` cuando vienen; `NULL` cuando no.
11. El hash de idempotencia de un payload v1 sigue siendo idéntico al actual; un payload v2 con `productId`/`sku` produce hash distinto.
12. El checkout público sigue mostrando solo descripción/cantidad/precio; no expone costo ni datos internos.
13. Reportes: ventas manuales caen en “sin producto”; no se inventa identidad.
14. Si `/api/products` responde 500/timeout, la Caja completa la venta manual sin error bloqueante.

### 9.3 `/ventas` — consulta operativa

1. Fila con folio, fecha, cliente/Mostrador, método real, estado, conceptos, total, cobrado real, pendiente y saldo fiado.
2. `confirmed` con saldo → “Por cobrar”; `payment_pending` → “Esperando confirmación”; `paid` con pey → “Verificado”; `paid` con cash → “Efectivo”; `demo_paid` → “Demo”; crédito vivo → “Fiado”.
3. Un pago demo no se suma a “Cobrado confirmado” ni se rotula “Pagado” sin marca demo.
4. Filtros de fecha, estado y búsqueda por folio/cliente/concepto, con estado en URL.
5. Detalle con pagos (`provider`, `method`, `amountCents`, `demo`, fecha), ítems y saldo vivo.
6. Una sola consulta de pedidos + una batched de créditos; sin N+1.
7. Sin dependencia de catálogo para mostrar historia.
8. Empty state y error state explícitos.
9. No se ofrecen cancelar/reembolsar/editar si el backend no lo soporta.

### 9.4 Pruebas negativas obligatorias

| Caso | Resultado esperado |
|---|---|
| Catálogo apagado / 404 | Caja manual funciona; no hay error global. |
| Catálogo 500/timeout | Se muestra ayuda local; la venta se completa. |
| Producto desactivado después de agregar | Venta se completa con snapshot. |
| Producto borrado después de agregar | Venta se completa; `productId` huérfano se reporta. |
| Precio de catálogo 0/negativo | Se ignora; se exige precio manual > 0. |
| SKU duplicado al crear producto | 409 en Productos; ventas intactas. |
| Stock 0/negativo | Advertencia; venta permitida. |
| Payload v1 después de desplegar v2 | Mismo hash; reintento devuelve el mismo pedido. |
| Payload v2 con `productId` distinto, mismo precio | Hash distinto; no se reutiliza la venta vieja. |
| Cliente viejo envía campos nuevos a servidor viejo | Zod los descarta; no hay error, pero se pierde provenance (documentar orden de despliegue). |
| Venta demo en efectivo | No se cuenta como efectivo real; se etiqueta demo. |
| Venta manual sin `productId` | Aparece en reportes como “sin producto”. |

### 9.5 Evidencia que debería existir (no ejecutada aquí)

- `npm run verify:fast` desde `web/` con árbol limpio.
- `npm run verify:full` con `latest.json` que declare el SHA entregado, `dirty:false` y `serverBuildSha` igual.
- `npm run verify:evidence`.
- `python scripts/oleada-b-smoke.py` con PASS de los casos A–T que apliquen.
- Consultas SQL reproducibles:

```sql
SELECT id, status, total_cents, paid_cents, credit_cents
FROM orders WHERE id = ?;

SELECT description, quantity, unit_price_cents, total_cents,
       product_id, sku, price_source
FROM order_items WHERE order_id = ?;
```

- Prueba de independencia: grep estático en `web/src/app/caja` y `web/src/components/caja`.
- Prueba de payload: interceptar `POST /api/orders` y afirmar que no contiene `productId`/`sku` en una venta manual.
- Prueba de RSC: revisar que `/caja` no incluya `orders`/`credits` del dashboard en el payload.
- Prueba de falla de catálogo: interceptar `/api/products` y devolver 500; completar una venta.
- Prueba de cambio fantasma: reproducir el caso de §7.4 y afirmar que no aparece “Cambio”.

Un caso no ejecutado se reporta `NOT RUN`, no `PASS`. La evidencia actual de la rama no es válida con el árbol sucio.

---

## 10 · Límites documentados

1. **No hay catálogo, inventario ni proveedores en Oleada B.** No se crean tablas, rutas ni componentes de esos dominios.
2. **No hay precio maestro.** El precio de la venta es el que escribe la persona; el catálogo futuro solo sugiere.
3. **No hay validación de stock.** La venta nunca se bloquea por existencias.
4. **No hay descuento automático de stock.** Si Oleada D lo implementa, será post-commit y opcional.
5. **No hay búsqueda de productos, SKU ni código de barras en la Caja B.** El alta es manual.
6. **No hay costo ni margen en Caja.** `costCents` pertenece a reportes/proveedores.
7. **No hay cliente para ventas de contado.** `customerName` solo se pide cuando hay fiado; no hay `customerId`.
8. **No hay multiusuario ni autenticación.** `merchant_id` existe y se usa, pero el producto es de un solo comercio.
9. **No hay edición, cancelación ni reembolso de ventas.** El backend no los soporta; la UI no debe inventarlos.
10. **No hay backfill de ventas históricas a productos.** Las ventas manuales quedan sin `productId`.
11. **No hay reportes por producto en B.** Llegan con el catálogo y el bucket “sin producto”.
12. **No hay offline.** La Caja depende de la red para registrar; el borrador local no es una venta.
13. **No hay multi-moneda.** Todo es MXN.
14. **No hay promociones, impuestos ni descuentos por línea.** Fuera del mínimo; requieren contrato explícito.

---

## 11 · Decisiones que requieren aprobación

| Tema | Estado actual | Recomendación | Dueño |
|---|---|---|---|
| Prop de Caja | `DashboardData` completo | Pasar solo `merchant` + `demo` | Oleada B |
| Estado `confirmed` con saldo | “Registrado” en `/ventas` | “Por cobrar”; usar `payment-labels.ts` | Oleada B |
| Método en `/ventas` | Escalar `paymentMethod` | Derivar de pagos + saldo; mostrar desglose | Oleada B/C |
| Demo por fila | No expuesto | Agregar `demo` a `Order` o `paymentBreakdown` | Oleada B/C |
| `productId`/`sku` | No existen | Columnas nullable + API v2 opcional | Oleada C |
| Precio de catálogo | No existe | Sugerencia editable; nunca impuesta | Oleada C |
| Stock | No existe | Advisory; sin descuento automático en C | Oleada C/D |
| Costo/margen | No existe | `costCents` solo en reportes; snapshot de costo si se necesita margen histórico | Oleada D |
| Cliente de contado | Solo fiado | `customerId` opcional + campo opcional en Caja | Futuro |
| Demo/real en catálogo | No definido | Catálogo compartido; stock excluye ventas demo | Oleada C/D |
| SKU obligatorio | No definido | Opcional; único cuando existe | Oleada C |
| Búsqueda | No existe | `nameNormalized` + `skuNormalized`; no FTS en C | Oleada C |
| Filtros de Ventas | No existen | Server-side, URL state, una consulta batched | Oleada B/C |
| Caja legacy `/` | Sigue con voz y `CATALOG` | Retirar o adaptar cuando Productos exista | Oleada C/D |

---

## 12 · Conclusión

La Caja nueva **puede venderse sin inventario y sin módulos inexistentes**: el flujo manual está completo y el contrato mínimo está soportado por `OrderItem` y `POST /api/orders`. La deuda que impide delegarla limpiamente no es de productos; es de **acoplamiento al dashboard**, **verdad de estado/método en Ventas** y **falta de metadata opcional de producto** en el ítem.

La integración con el catálogo futuro debe ser **aditiva, opcional y tolerante a fallos**: búsqueda que sugiere, SKU que identifica, precio que se puede editar, stock que se muestra pero no bloquea, y snapshot que conserva la historia. Con esas condiciones, Oleada C puede agregar Productos sin reescribir Caja, y Oleada D puede agregar Inventario/Proveedores sin convertir la venta en una transacción de stock.
