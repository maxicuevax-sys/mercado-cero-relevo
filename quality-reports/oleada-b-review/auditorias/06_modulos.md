# 06 · Módulos de negocio — revisión adversarial de Oleada B

> **Rol:** `mc-modulos-negocio` · **Modo:** solo lectura. No se editó producto ni se hizo commit.
> **Repo:** `mercado-cero` · **Rama:** `design/oleada-b-caja-ventas` · **HEAD:** `4130e71d668e5e4693a8f5b634d2d2f953d21b02`.
> **Fecha:** 4 de noviembre de 2026.
> **Alcance:** independencia de `/caja` respecto de inventario, catálogo, precios maestros y proveedores; suficiencia de conceptos manuales; mocks/hardcodes/datos ocultos; `/ventas` como superficie operativa; interfaces futuras de catálogo/SKU/stock advisory; acoplamientos que condicionan delegar Oleadas C/D.
> **Método:** lectura estática de `web/src` y documentación, más ejecución Playwright contra el build `4130e71` en dos servidores aislados: `3101` (`DEMO_MODE=true`) y `3102` (`DEMO_MODE=false`), ambos con `DATABASE_PATH` en `%TEMP%`. **No se tocó la base del repo ni código de producto.**
> **Límite:** no se ejecutaron los gates formales (`verify:fast/full/evidence`), no se probó pey real, QR real, webhook real ni lector de pantalla. Este documento no declara PASS/GO.

---

## 0 · Veredicto ejecutivo

1. **`/caja` es independiente de inventario, catálogo, precios maestros y proveedores.** No hay imports, llamadas de red, tablas ni campos de esos dominios. La venta manual de la UI demo y el `POST /api/orders` real funcionan sin tablas de productos. Runtime: 15/15 comprobaciones demo y 12/12 reales en `modulos-runtime*.txt`.
2. **Los conceptos manuales son suficientes para vender:** descripción, cantidad y precio unitario; el servidor los revalida y `order_items` guarda la foto. El payload observado lleva exactamente `description`, `quantity`, `unitPriceCents` y no lleva `productId`, `sku`, `stock` ni `supplierId`.
3. **No existe una integración falsa de catálogo.** Los únicos datos simulados son fixtures de demo, el catálogo hardcodeado del parser legacy de voz y el fixture visual “Revisar inventario” de `/inicio`; ninguno se usa en `/caja`. El riesgo real es el **modo demo implícito** cuando falta `PEY_API_KEY`, que siembra historial y un fiado de demo.
4. **`/ventas` sirve para consulta básica, no para operación completa.** Muestra folio corto, fecha/hora, cliente de fiado, método, estado, conceptos, total, cobrado (en algunos estados), pendiente digital y saldo fiado. No tiene filtros, búsqueda, detalle de pagos, folio completo, desglose efectivo/digital por fila ni acciones de cobro.
5. **Hay un P0 de verdad de dinero:** el resultado de una venta a fiado afirma “el efectivo sí se registró en la caja” aunque `paidCents=0` y no exista ningún pago en efectivo. Se reproduce en una venta 100 % fiada. No es un fallo de persistencia, pero sí una afirmación falsa sobre dinero en la pantalla que se usa para decidir la entrega.
6. **Hay P1 de operación:** cambio fantasma en Mixto (`Recibiste $100` / `Cambio $100` sobre una venta 100 % fiada), `/ventas` oculta el efectivo ya cobrado cuando un pedido mixto pasa a `payment_pending`, y los campos futuros de producto/SKU se descartan en silencio con colisión de idempotencia.
7. **No se propone iniciar Oleada C.** Las interfaces de §5 y los límites de §6 son condiciones de borde para que C/D no hereden esta deuda; no son un plan de ejecución de C.

**Veredicto de módulos:** la Caja nueva **puede venderse a mano sin catálogo** y esa independencia está bien resuelta. No está lista para declarar “verdad de dinero completa” ni para que Productos/Inventario se conecten sin corregir el contrato de ítem y el resultado de fiado.

---

## 1 · Método y evidencia

### 1.1 Estado auditado

- `git rev-parse HEAD` = `4130e71…`; rama `design/oleada-b-caja-ventas`.
- `web/.next/BUILD_SHA` = `4130e71…`; los servidores aislados reportan el mismo `buildSha`.
- `git status --short` solo muestra `?? quality-reports/oleada-b-review/` (este informe y evidencias). No hay cambios de producto.
- No se ejecutaron gates formales. La evidencia es de lectura estática y runtime acotado, no de certificación.

### 1.2 Evidencia producida

> Las rutas `EVIDENCIAS/...` de esta tabla son relativas a `quality-reports/oleada-b-review/`.

| Archivo | Contenido |
|---|---|
| `EVIDENCIAS/modulos-git.txt` | HEAD, rama, estado, buildSha y nota de bases temporales. |
| `EVIDENCIAS/modulos-dependencias-caja.txt` | Imports de `/caja`, llamadas `fetch`, búsqueda de dominios de catálogo/inventario/proveedores, esquema Zod y tablas de `db.ts`. |
| `EVIDENCIAS/modulos-esquema.txt` | Tablas y columnas reales de una base temporal sin productos/inventario/proveedores. |
| `EVIDENCIAS/modulos-runtime.txt` | Playwright demo aislado: fiado puro, cambio fantasma, payload manual, digital sin link, independencia. 15/15. |
| `EVIDENCIAS/modulos-runtime-real.txt` | Playwright real aislado: mixto con efectivo + fiado + digital, `payment_pending`, `/caja` sin datos de ventas. 12/12. |
| `EVIDENCIAS/modulos-ventas-campos.txt` | Código de consultas, resumen, fila, etiquetas y rutas de `/ventas`. |
| `EVIDENCIAS/modulos-cambio-fantasma.txt` | Fórmulas de reparto/cambio y copy incondicional del resultado. |
| `EVIDENCIAS/modulos-provenance.txt` | Runtime: `productId`/`sku` descartados; dos `productId` distintos reutilizan la misma orden. |
| `EVIDENCIAS/modulos-idempotencia.txt` | Hash actual, canonicalización y Zod que descarta claves. |
| `EVIDENCIAS/modulos-payment-method.txt` | Runtime: se envía `paymentMethod:"card"` y la orden queda con `paymentMethod:null`. |
| `EVIDENCIAS/modulos-mocks.txt` | Demo implícito, seeds, historial demo, catálogo legacy y fixture de inventario. |
| `EVIDENCIAS/modulos-demo-db.txt` | Base demo temporal: 14 pedidos `demo_hist`, 1 `demo_seed`, crédito de $50 sin `order_id`. |
| `EVIDENCIAS/modulos-acoplamientos.txt` | Dos Cajas, dos drafts, parsers y etiquetas duplicadas, N+1, `paymentMethod`, `DashboardData`. |
| `EVIDENCIAS/modulos-roadmap.txt` | Contradicción de roadmap sobre qué oleada posee Productos. |
| `EVIDENCIAS/modulos-demo-race.txt` | Dos `/api/demo/pay` concurrentes: no duplicó en este entorno, pero el endpoint sigue sin idempotencia explícita ni comprobación `order.demo`. |

> **Cómo leer los PASS de runtime:** los `PASS` de `modulos-runtime*.txt` significan “la comprobación se ejecutó y observó el comportamiento descrito”, no “el producto pasa”. Varias comprobaciones están escritas para confirmar un defecto (por ejemplo, que el banner falso aparece o que `/ventas` oculta el cobrado). El veredicto está en §7, no en el conteo de PASS.

### 1.3 Cómo se ejecutó el runtime

- Servidor demo: `PORT=3101`, `DEMO_MODE=true`, `APP_URL=http://localhost:3101`, `DATABASE_PATH=%TEMP%\mercado-cero-modulos-review.db`.
- Servidor real: `PORT=3102`, `DEMO_MODE=false`, `APP_URL=http://localhost:3102`, `DATABASE_PATH=%TEMP%\mercado-cero-modulos-real.db`.
- Ambos sobre el mismo build `4130e71`; la base real arrancó sin pedidos y sin tablas de productos.
- No se usó la base `web/data/mercado-cero.db` del repo.

---

## 2 · Tarea 1 — ¿`/caja` depende de inventario, catálogo, precios maestros o proveedores?

### 2.1 Resultado: no

| Superficie | Qué se revisó | Evidencia | Resultado |
|---|---|---|---|
| Página | `app/caja/page.tsx` solo pasa `MERCHANT` y `isDemoMode()` | `app/caja/page.tsx:12-15` | No carga dashboard, pedidos, créditos ni catálogo. |
| Imports | `components/caja/**` | `modulos-dependencias-caja.txt` | React, Next, shell, `CurrencyAmount`, `format`, `Order`, `DashboardData` (solo tipo) y piezas locales. Nada de productos/inventario/proveedores. |
| Red | `fetch` en componentes | `caja-screen.tsx:118,285,297`; `payment-panel.tsx:38,67,89,111` | Solo `/api/orders`, `/api/orders/:id`, `/api/orders/:id/pay`, `/api/demo/pay`. |
| Payload | `confirmSale` | `caja-screen.tsx:262-271` | `items[{description,quantity,unitPriceCents}]`, `cashCents`, `creditCents`, `customerName`; sin identidad de producto. |
| Servidor | Zod y `createOrder` | `api/orders/route.ts:30-48`; `orders.ts:112-159` | Solo valida descripción/cantidad/precio; no consulta stock ni precio maestro. |
| Persistencia | tablas de `db.ts` | `db.ts:108-273`; `modulos-esquema.txt` | No hay `products`, `inventory`, `suppliers` ni columnas de SKU/stock. |
| Runtime | `POST /api/orders` en base real vacía | `modulos-runtime-real.txt` | La orden se crea sin tablas de producto y sin llamadas a catálogo. |
| Copy | estado vacío | `sale-line-items.tsx:66-69` | “No necesitas inventario ni micrófono.” |

**No se encontró** ningún import, endpoint, tabla, join, validación de existencias, precio maestro ni proveedor en el camino de `/caja`.

### 2.2 Los conceptos manuales sí alcanzan

La UI pide y el servidor revalida:

| Campo | UI | Servidor | Persistencia |
|---|---|---|---|
| Descripción | `sale-line-items.tsx:28-33,175-188` | `orders.ts:136-145` (1..160) | `order_items.description` |
| Cantidad | `sale-line-items.tsx:34-37,190-200` | `orders.ts:113-122` (>0, ≤999) | `order_items.quantity` |
| Precio unitario | `sale-line-items.tsx:38-41,201-211` | `orders.ts:124-134` (>0, ≤$100,000) | `order_items.unit_price_cents` |

El total se calcula por línea y se vuelve a calcular en el servidor (`caja/types.ts:58-67`; `orders.ts:147-161`). Una venta manual puede ser efectivo, digital, fiado o mixto sin catálogo. El runtime creó `2 × $12.50` y una venta de $100 con fiado.

**Conclusión:** los tres campos mínimos son suficientes y están soportados de punta a punta. Lo que falta para catálogo es **metadata opcional de provenance**, no el mínimo vendible.

### 2.3 Dependencias residuales que no son catálogo

| Dependencia | Evidencia | Impacto | Severidad |
|---|---|---|---|
| Tipo `DashboardData` importado solo por `merchant` | `caja-screen.tsx:5,55` | La página ya no serializa el dashboard (runtime lo confirma), pero el contrato de Caja sigue apuntando a un módulo ajeno. | P3 |
| Shell/nav y `inicio.css` | `caja-screen.tsx:29` | Caja depende de la hoja global de Inicio; no afecta la venta. | P3 |
| `MERCHANT` hardcodeado | `config.ts:1-8` | Un solo comercio; no es catálogo, pero limita multi-merchant. | P3 |
| Motor `lib/orders.ts` | `api/orders/route.ts`; `orders.ts:99-362` | Es el contrato correcto: Caja usa el mismo motor que la Caja legacy. | OK |

---

## 3 · Tarea 2 — mocks, hardcodes y datos ocultos

### 3.1 Lo que existe y su clasificación

| Elemento | Dónde | ¿Se usa en `/caja` nueva? | Clasificación |
|---|---|---|---|
| Modo demo implícito si falta `PEY_API_KEY` | `config.ts:10-14` | Sí, cambia el flag y el sello visual | **Riesgo P2**: un entorno “real” sin llave arranca en demo y siembra datos. |
| `seed()`: cliente Juan, crédito de $50 sin `order_id`, venta Quesadilla $70 | `db.ts:1039-1088` | No directamente; afecta dashboard y fiados | Fixture de demo, gated por `isDemoMode()`. El crédito huérfano no aparece en `/ventas`. |
| `seedDemoHistory()`: 13 ventas + 1 pendiente + corte de ayer | `db.ts:1115-1246` | No directamente; aparece en `/ventas` demo | Fixture de demo, gated. Refuerza la sensación de historial real si no se lee el sello DEMO. |
| `CATALOG` de 12 productos con precios fijos | `voice-local.ts:5-18`; `voice.ts:55-74` | **No** | Precio maestro de facto del parser legacy de voz. Deuda P2 para cuando exista catálogo real. |
| Fixture “Revisar inventario” | `inicio/page.tsx:55-60` | No | Copy de demo, etiquetado “Ejemplo” y con nota `inicio/page.tsx:204-208`. Sugiere un módulo que no existe; P3. |
| Productos fijos del smoke (`Quesadilla`, `Agua`) | `oleada-b-smoke.py:93-103` | Solo test | Dato de prueba, no producto. |
| `demo_seed` / `demo_hist` IDs y `payments.demo=1` | `db.ts:1049-1087,1146-1190` | No | Marcados para excluirse en modo real; `listOrders` filtra `demo=0`. |

### 3.2 Lo que se verificó en runtime

- La base demo temporal tenía **14 `demo_hist` + 1 `demo_seed`**, 14 `demo_paid`, 1 `payment_pending` y un crédito de **$50 con `order_id=None`** (`modulos-demo-db.txt`).
- La base real temporal arrancó con **0 pedidos, 0 productos, 0 créditos, 0 cortes**.
- `/caja` no llamó a `/api/voice`, `/api/products`, `/api/inventory`, `/api/suppliers` ni `/api/catalog` en ninguna de las ejecuciones.
- `/caja` no serializó en HTML el ID, cliente ni conceptos de las ventas que sí existían en la base real (`modulos-runtime-real.txt`).

### 3.3 Veredicto de mocks

**No hay una integración simulada de catálogo/inventario que haga pasar por real una capacidad inexistente.** Los fixtures están concentrados en demo y el catálogo hardcodeado está en el parser legacy. El problema no es que `/caja` finja catálogo; el problema es que:

1. el modo demo puede activarse por omisión;
2. el catálogo legacy sigue siendo una segunda fuente de precios;
3. el fixture “Revisar inventario” promete una capacidad que no existe, aunque esté etiquetado como ejemplo.

---

## 4 · Tarea 3 — `/ventas`: qué hay y qué falta para operar

### 4.1 Información disponible hoy

| Dato | ¿Presente? | Fuente | Observación |
|---|---|---|---|
| Folio | Parcial | `shortOrder(order.id)` (`ventas/page.tsx:149`) | Solo últimos 4 caracteres; no sirve para buscar ni garantiza unicidad. |
| Fecha/hora | Sí | `formatActivityDate(order.createdAt)` (`:152`) | “Hoy/Ayer/fecha” con hora. |
| Cliente | Solo fiado | `order.customerName` (`:153`) | En contado la Caja nueva no pide nombre. |
| Método | Parcial | `methodLabel` (`:276-298`) | Derivado de `paymentMethod` y `digitalPaidCents`; un digital pendiente con `paymentMethod=null` se rotula “Digital”. |
| Estado | Parcial | `statusLabel` (`:251-274`) | `confirmed` cae en “Registrado” aunque falte cobrar; `payment_pending` = “Pendiente”. |
| Conceptos | Sí | `order.items` (`:155-159,202-215`) | Resumen y `<details>` con cantidad × precio. |
| Total | Sí | `order.totalCents` (`:162`) | — |
| Cobrado | Parcial | `order.paidCents` (`:168-171`) | En `payment_pending` se oculta; en demo se reemplaza por “Demo”. |
| Pendiente digital | Sí | `total - paid - credit` (`:133-136,180-184`) | Se muestra como “Falta cobrar”. |
| Fiado original | Sí | `order.creditCents` (`:185-200`) | No es saldo vivo. |
| Saldo fiado | Sí, si el crédito existe | `getCredit(order.creditId)` (`:127`) | N+1; si no existe, cae a “Fiado original (saldo no disponible)”. |
| Demo por fila | Parcial | `demo || status demo_paid || lastPaymentDemo` (`:128-129`) | En demo global todas las filas se rotulan Demo. |
| Paginación | Sí | `searchParams.page`, 25/página (`:41-50,221-238`) | Solo anterior/siguiente; sin filtros. |

### 4.2 Información ausente para operación real

| Falta | Por qué importa | Severidad |
|---|---|---|
| Filtros por fecha/estado y búsqueda por folio/cliente/concepto | La lista mezcla todos los días; encontrar una venta es recorrer páginas. | P2 |
| Detalle de venta con pagos (`provider`, `method`, `amount`, `demo`, fecha) | “Cobrado” no dice si fue efectivo, pey o demo; el `<details>` solo lista conceptos. | P2 |
| Desglose efectivo/digital/fiado por fila | Un mixto no se puede conciliar desde la lista. | P2 |
| Efectivo ya cobrado en `payment_pending` | Se oculta exactamente cuando se genera el link/QR (runtime real). | **P1** |
| Folio completo o copiable | El sufijo de 4 puede colisionar; no hay búsqueda. | P3 |
| Cliente/contacto en contado | No hay `customerId` ni historial de cliente. | P2 |
| Fecha de vencimiento y estado del fiado | `Credit.dueDate` existe, pero `/ventas` no lo muestra. | P3 |
| Acción “Cobrar saldo” o reanudar link/QR | El historial es solo lectura; no se puede retomar un pendiente desde ahí. | P2 |
| Imprimir/exportar recibo/CSV | No existe. | P3 |
| Estado de error/carga | Server component; un fallo de DB es un 500 sin recuperación. | P3 |
| Vendedor, nota, descuento, impuesto | No existen en el contrato; no se deben inventar en UI. | P3 |

### 4.3 Dependencias de módulos futuros

| Dependencia | Uso actual | Efecto |
|---|---|---|
| Fiados (`getCredit`) | Una consulta por fila (`ventas/page.tsx:127`) | N+1; el saldo vivo pertenece a Fiados, no a Ventas. |
| Pagos (`lastPaymentDemo`, `digitalPaidCents`) | Etiqueta demo y método | La lectura de pagos no está expuesta en la fila; se infiere. |
| Resumen/reportes (`getDailySummary`, `sumPendingOrderBalances`) | Tarjetas superiores | “Por cobrar digital” incluye pedidos `confirmed` sin link/QR. |
| Catálogo/productos | **Ninguna** | Correcto: el historial no necesita catálogo para mostrar la foto del ítem. |

### 4.4 Veredicto de `/ventas`

La pantalla es un **historial básico legible**, no una consola de cobranza. Para operación real falta convertirlo en un read model con:

1. fila con verdad de dinero explícita (cobrado efectivo / digital verificado / demo / fiado / pendiente);
2. filtros y búsqueda;
3. detalle de pagos;
4. batch de créditos, sin N+1;
5. acciones solo si el backend las soporta.

No se debe agregar “cancelar”, “reembolsar” ni “editar” mientras no exista transición de servidor.

---

## 5 · Tarea 4 — Interfaces de integración futura (propuesta, no implementada)

> **No se creó ningún archivo ni tabla con estos tipos.** Son contratos de borde para que Catálogo/Productos/Inventario se conecten sin reescribir Caja ni romper ventas históricas.

### 5.1 Invariantes

1. **El catálogo nunca bloquea una venta.** Si falla, tarda o no existe, la Caja sigue con concepto manual.
2. **La foto del ítem manda.** `description`, `quantity`, `unitPriceCents` y `totalCents` se guardan al vender; cambios posteriores de producto no reescriben la venta.
3. **La identidad de producto es provenance opcional.** `productId`/`sku` sirven para reportes y stock; no reconstruyen el precio histórico.
4. **El precio es sugerido, no impuesto.** La comerciante puede editarlo; el servidor no reprecio desde catálogo.
5. **El stock es advisory.** `stockQty=0` o negativo se muestra como advertencia; no deshabilita “Agregar” ni “Confirmar”.
6. **Costo y proveedor no se filtran a Caja.** `costCents` es de reportes/márgenes; `supplierId` no viaja en una venta.
7. **Compatibilidad v1.** Un cliente viejo sigue enviando `{description,quantity,unitPriceCents}` y produce el mismo hash.
8. **Servidor primero.** El servidor debe aceptar y persistir los campos opcionales antes de que el cliente los envíe; si no, Zod los descarta.
9. **Sin FK destructiva.** Borrar un producto no puede borrar ni romper una venta histórica.
10. **Sin backfill.** Las ventas manuales históricas quedan con `product_id=NULL`; no se inventa identidad.

### 5.2 Contrato de venta

```ts
// lib/sales/contracts.ts (propuesta; no existe)
export type PriceSource = "manual" | "catalog" | "catalog_override";

/** Contrato actual, congelado. */
export interface SaleItemInputV1 {
  description: string;
  quantity: number;
  unitPriceCents: number;
}

/** Aditivo, opcional; la Caja manual puede seguir enviando V1. */
export interface SaleItemInputV2 extends SaleItemInputV1 {
  productId?: string | null;
  sku?: string | null;
  priceSource?: PriceSource;
  unitLabel?: string | null;
}

/** Snapshot de lectura; nunca se reprecio desde el catálogo. */
export interface OrderItemSnapshot extends SaleItemInputV1 {
  id: string;
  totalCents: number;
  productId?: string | null;
  sku?: string | null;
  priceSource?: PriceSource | null;
  unitLabel?: string | null;
}
```

Regla: `CatalogSuggestion` **no es** `SaleItemInput`. El selector transforma una sugerencia en una línea editable; la Caja no envía el objeto de producto completo.

### 5.3 Catálogo y SKU

```ts
// lib/catalog/contracts.ts (propuesta; no existe)
export interface StockAdvisory {
  qty: number | null;              // null = no se lleva stock
  tracked: boolean;
  asOf: string | null;
  lowStockThreshold?: number | null;
}

export interface CatalogSuggestion {
  productId: string;               // estable, generado por el servidor
  sku: string | null;              // opcional; único por merchant si existe
  name: string;                    // ≤160 para caber en OrderItem.description
  defaultPriceCents: number;       // sugerencia, entero > 0
  unitLabel: string | null;        // "pieza", "kilo", "litro"...
  stock: StockAdvisory | null;
  active: boolean;
}

export interface CatalogSearchInput {
  q?: string;
  sku?: string;
  limit?: number;                  // default 8, max 20
  signal?: AbortSignal;
}

export type CatalogResult =
  | { ok: true; products: CatalogSuggestion[] }
  | { ok: false; reason: "disabled" | "unavailable" | "timeout"; message: string };

export interface CatalogPort {
  search(input: CatalogSearchInput): Promise<CatalogResult>;
  getById(productId: string): Promise<CatalogSuggestion | null>;
}
```

Reglas de SKU:

- Opcional. Un producto sin SKU es válido.
- Único por `merchantId` cuando existe; comparación case-insensitive y sin espacios externos.
- Longitud recomendada ≤64; caracteres `[A-Z0-9._-]`.
- Se guarda normalizado en `products` y **snapshot** en `order_items.sku`.
- No es llave primaria de la venta ni sustituto de `description`.
- No se backfillea en ventas históricas.

### 5.4 Precio sugerido y edición

Secuencia:

1. La persona busca “quesadilla”.
2. El selector muestra `Quesadilla · $35.00 · stock 4`.
3. Al elegir, se llena la fila de alta con descripción y precio; cantidad queda en 1 y es editable.
4. Si no toca el precio: `priceSource = "catalog"`.
5. Si lo cambia: `priceSource = "catalog_override"`.
6. Si escribe todo a mano: `priceSource = "manual"` o `null` (v1).
7. Al confirmar se envía `unitPriceCents` ya resuelto; el servidor no consulta catálogo.

Reglas:

- Precio de catálogo ≤0 o > `MAX_UNIT_PRICE_CENTS` se ignora; se pide precio manual.
- Cambiar precio/nombre en catálogo no altera líneas ya agregadas ni ventas históricas.
- No hay “precio maestro” que rechace una venta por debajo o por encima del sugerido.

### 5.5 Stock advisory

- `stockQty: null` = no se lleva stock; la UI no muestra cifra.
- `stockQty: 0` = “Sin stock registrado”; **no** deshabilita el alta ni la confirmación.
- `stockQty < 0` = advertencia; no bloquea.
- En B **no se descuenta stock** al vender. El stock es informativo/manual.
- Si una oleada posterior decide descontar, debe ser una proyección **post-commit**, idempotente por `(orderId, orderItemId, reason)`, fuera de `createOrder`.
- Ventas demo no mueven stock real; la proyección filtra `orders.demo = 0` y `status != 'demo_paid'`.
- Ítems manuales sin `productId` no generan movimiento; se reportan como “sin producto”.

### 5.6 API futura (no implementada)

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
      "stock": { "qty": 4, "tracked": true, "asOf": "2026-11-04T18:00:00Z" },
      "active": true
    }
  ],
  "total": 1,
  "hasMore": false
}
```

Semántica:

- `q` mínimo 2 caracteres; `sku` exacto puede ser 1.
- Búsqueda sin acentos y sin distinguir mayúsculas sobre `nameNormalized`.
- Orden: SKU exacto → nombre exacto → prefijo → contiene; desempate alfabético.
- `limit` default 8, máximo 20.
- Solo `active=1` por defecto; `active=0` requiere parámetro explícito.
- Nunca devuelve `costCents` en la búsqueda de Caja.
- Rate limit separado del de ventas (p. ej. 120/min).
- Si no hay catálogo, la ruta puede no existir; Caja no la llama salvo flag activo.

### 5.7 Persistencia futura

Migración aditiva, siguiendo el patrón `PRAGMA table_info` + `ALTER TABLE` de `db.ts:315-459`:

```sql
-- Catálogo (futuro)
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

-- Snapshot de venta
ALTER TABLE order_items ADD COLUMN product_id TEXT;
ALTER TABLE order_items ADD COLUMN sku TEXT;
ALTER TABLE order_items ADD COLUMN price_source TEXT;
ALTER TABLE order_items ADD COLUMN unit_label TEXT;
```

Decisiones:

- **Sin FK con `ON DELETE CASCADE`** desde `order_items.product_id` a `products.id`.
- El producto se desactiva (`active=0`), no se borra físicamente si tiene ventas.
- `sku` en `order_items` es snapshot; si el producto cambia de SKU, la venta conserva el viejo.
- `product_id` puede quedar huérfano; reportes lo tratan como “producto eliminado” y usan el snapshot.
- No se backfillea `product_id` ni `sku`.

### 5.8 Idempotencia compatible

Hash actual (`orders.ts:196-207`):

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

Para v2, incluir campos nuevos **solo cuando estén presentes**:

```ts
const hashItems = items.map((item) => ({
  description: item.description,
  quantity: item.quantity,
  unitPriceCents: item.unitPriceCents,
  ...(item.productId ? { productId: item.productId } : {}),
  ...(item.sku ? { sku: item.sku } : {}),
}));
```

- Un payload manual v1 sigue produciendo el mismo hash.
- Un payload v2 con `productId`/`sku` produce un hash distinto.
- `priceSource` no entra al hash: no cambia dinero ni identidad.
- `unitLabel` no entra: es presentación.
- **No usar `.object()` que descarte claves nuevas en silencio.** El servidor debe aceptar explícitamente los campos v2 o rechazar el payload; nunca “guardar sin provenance” como si nada.

### 5.9 Modos de falla

| Falla | Comportamiento esperado de Caja |
|---|---|
| `/api/products` 500/timeout | El selector muestra “No se pudo buscar; escribe el concepto” y el alta manual sigue operativa. |
| Búsqueda vacía | “Sin resultados”; no se inventa precio. |
| Producto desactivado entre búsqueda y confirmación | La venta se completa con el snapshot; no se bloquea. |
| Producto borrado | Igual; `productId` huérfano se reporta como “producto eliminado”. |
| Precio de catálogo 0/negativo | Se ignora; se exige precio manual >0. |
| SKU duplicado al crear producto | 409 en Productos; no afecta ventas existentes. |
| Catálogo deshabilitado | El selector no se renderiza; Caja idéntica a B. |
| Stock 0/negativo | Advertencia; “Agregar” y “Confirmar” siguen habilitados. |
| Cliente viejo envía v2 a servidor viejo | Debe ser 400 explícito o pérdida documentada; hoy Zod lo descarta en silencio. |

### 5.10 Frontera con proveedores

- Proveedores es un dominio separado: `suppliers`, `purchases`, `purchase_items`, `payments_to_suppliers`.
- Caja **no** importa, consulta ni escribe proveedores.
- `costCents` puede vivir en `products` para reportes de margen, pero **no** se devuelve en la búsqueda de Caja.
- Una compra a proveedor incrementa stock en su propia transacción; no crea ventas ni toca `orders`.
- Si se quiere margen histórico exacto, se necesita `unit_cost_cents` snapshot en `order_items`; es decisión posterior, no de B.

### 5.11 Read model futuro para `/ventas`

Para que Ventas no dependa de `db.ts` ni haga N+1:

```ts
// lib/sales/history.ts (propuesta; no existe)
export interface SalesHistoryQuery {
  limit: number;
  offset: number;
  from?: string;                    // ISO, inicio del día México
  to?: string;                      // ISO, fin exclusivo
  status?: "all" | "paid" | "pending" | "credit" | "demo";
  q?: string;                       // folio, cliente o concepto
}

export interface PaymentSummary {
  provider: string;
  method: string;
  amountCents: number;
  demo: boolean;
  createdAt: string;
}

export interface SalesHistoryRow {
  orderId: string;
  folio: string;                    // completo o copiable
  createdAt: string;
  status: Order["status"];
  totalCents: number;
  paidCents: number;
  digitalPaidCents: number;
  cashPaidCents: number;
  creditOriginalCents: number;
  creditBalanceCents: number | null;
  digitalDueCents: number;
  customerName: string | null;
  lastPaymentDemo: boolean;
  items: OrderItemSnapshot[];
  payments: PaymentSummary[];
}

export interface SalesHistoryPage {
  rows: SalesHistoryRow[];
  total: number;
  hasMore: boolean;
}
```

Reglas:

- `status=paid`: `due<=0`, saldo de crédito 0, no demo/cancelado.
- `status=pending`: `MAX(total - paid - credit, 0) > 0`.
- `status=credit`: saldo vivo >0.
- `status=demo`: `orders.demo=1` o `status=demo_paid` o último pago demo.
- `q` busca en `orders.id`, `orders.customer_name` y `EXISTS (order_items.description LIKE ?)`.
- Orden `created_at DESC, id DESC`; offset en B, keyset si crece.
- Un solo query de pedidos + un batch de créditos; nunca `getCredit` por fila.

---

## 6 · Tarea 5 — acoplamientos y duplicación que condicionan C/D

### 6.1 Matriz de acoplamientos

| ID | Acoplamiento / duplicación | Evidencia | Efecto | Sev. |
|---|---|---|---|---|
| AC-01 | **Dos Cajas**: `/` legacy `CajaApp` (7,827 líneas) y `/caja` nueva | `caja-app.tsx`; `components/caja/**`; `nav.ts`; `caja-screen.tsx:569-598` | Cualquier arreglo de venta/cambio/etiqueta debe hacerse dos veces; el pie de `/caja` manda a legacy. | P1 |
| AC-02 | **Dos drafts y dos llaves** `mercado-cero:draft:v1` vs `caja-draft:v2`; sin `BroadcastChannel` ni `storage` event | `caja-app.tsx:110-116`; `caja-screen.tsx:32-34`; `modulos-acoplamientos.txt` | No hay lock cross-tab; dos pestañas pueden crear dos ventas. | P1 |
| AC-03 | **Fórmula de reparto duplicada** (credit-first en nueva, misma en legacy) | `caja-screen.tsx:80-85`; `caja-app.tsx:1762-1771` | El bug de cambio fantasma se corrige en un lugar y reaparece en el otro. | P1 |
| AC-04 | **Etiquetas de estado/método duplicadas** | `ventas/page.tsx:251-298`; `sale-result.tsx:163-181`; `payment-panel.tsx:264-281`; `payment-labels.ts:118-143` | “Registrado” vs “Por cobrar”; el vocabulario de dinero se separa. | P2 |
| AC-05 | **Ventas lee `db.ts` directo y hace N+1** | `ventas/page.tsx:15-21,44-50,127`; `db.ts:1737-1763` | El read model no es delegable; el costo crece con filas/fiados. | P2 |
| AC-06 | **`OrderItem`/`order_items` sin identidad de producto** | `types.ts:17-23`; `db.ts:131-139`; `loadOrderItems` `db.ts:1275-1302` | Productos no puede enlazar ventas/stock sin migración aditiva. | P1 |
| AC-07 | **`paymentMethod` aceptado y no usado** | `api/orders/route.ts:46`; `orders.ts` sin `input.paymentMethod`; runtime `modulos-payment-method.txt` | Un módulo de pagos puede creer que el método quedó persistido; no es así. | P2 |
| AC-08 | **Caja tipa contra `DashboardData`** | `caja-screen.tsx:5,55` | La página ya no serializa datos, pero el borde de tipo sigue apuntando al dashboard. | P3 |
| AC-09 | **`formatMxn` duplicado** | `config.ts:20-26`; `format.ts:1-7` | Dos verdades de formato; una sin guard de `Number.isFinite`. | P3 |
| AC-10 | **`parseMoney` legacy vs `parseMoneyCents` nueva** | `caja-app.tsx:216-228`; `components/caja/types.ts:17-48` | Misma intención, distinta normalización; una venta puede diferir entre Cajas. | P3 |
| AC-11 | **`MERCHANT` hardcodeado y queries sin `merchant_id`** | `config.ts:1-8`; `db.ts:1409-1434` (`listOrders`/`countOrders`) | Un solo comercio; un producto multi-merchant exigiría reescritura. | P3 |
| AC-12 | **Dos roadmaps contradicen el dueño de Productos** | `MIGRACION_INTEGRAL_MERCADO_CERO.md` §9: C = fiados/corte, D = productos; `oleada-b/MODULOS_NEGOCIO.md` §8.2: C = Productos, D = Inventario/Proveedores; `modulos-roadmap.txt` | Dos carriles pueden tocar `orders.ts`/`types.ts`/`db.ts` a la vez. | P2 |

### 6.2 Frontera de delegación propuesta

| Dominio | Posee | Lee | Nunca debe |
|---|---|---|---|
| **Caja** | Borrador, línea manual, método, POST de venta, idempotencia, resultado, polling. | `Order`, `OrderItem`, `Credit` solo para mostrar saldo, `merchant`. | Importar productos/inventario/proveedores; validar stock; leer precios maestros; escribir catálogo. |
| **Ventas** | Lectura, filtros, detalle, historial, export. | `orders`, `order_items`, `payments`, `credits` a través de un read model. | Repreciar con catálogo; unir productos para mostrar historia; editar ventas. |
| **Fiados/Corte (C)** | Clientes, saldos, abonos, corte, conciliación. | `orders`, `payments`, `credits`, `credit_payments`, `cash_closes`. | Escribir `order_items`; reinterpretar pagos como ventas. |
| **Productos (D)** | CRUD de catálogo, búsqueda, SKU, precio sugerido, activo/inactivo, unidad. | Nada de ventas para operar; opcionalmente ventas agregadas para reportes. | Escribir `orders`, `order_items`, `payments`, `credits`; bloquear una venta; imponer precio. |
| **Inventario/Proveedores (D)** | Stock, movimientos, ajustes, mermas, compras, costos. | `order_items` con `productId`; productos. | Validar stock dentro de `createOrder`; impedir una venta; descontar demo. |
| **Contrato compartido** | `SaleItemInputV1/V2`, `OrderItemSnapshot`, `CatalogSuggestion`, `SalesHistoryRow`. | — | Depender de implementaciones concretas. |

### 6.3 Archivos que no deben tocarse en paralelo

| Archivo | Por qué |
|---|---|
| `web/src/lib/orders.ts` | `createOrder`, hash, validaciones, pagos. |
| `web/src/lib/db.ts` | Migraciones y hidratación de pedidos. |
| `web/src/lib/types.ts` | `Order`/`OrderItem` son contrato compartido. |
| `web/src/components/caja/caja-screen.tsx` | Payload y estado de la venta. |
| `web/src/app/ventas/page.tsx` | Read model y etiquetas. |

---

## 7 · Hallazgos P0–P3

### P0

#### MN-B-01 · El resultado de fiado afirma que el efectivo se registró cuando no hubo efectivo

**Severidad:** P0 (verdad de dinero).
**Dónde:** `components/caja/sale-result.tsx:133-136`.

```tsx
{openCredit ? (
  <p className="mc-caja-result__banner">
    Quedó anotado en Fiado. Solo el fiado es deuda; el efectivo sí se registró en la caja.
  </p>
) : null}
```

**Qué pasa:** `openCredit` es verdadero siempre que `creditBalanceCents > 0`. En una venta 100 % fiada no hay ningún pago en efectivo, pero el banner afirma que sí se registró. Runtime demo (`modulos-runtime.txt`):

- Pedido de $100 a fiado: `paidCents=0`, `creditCents=10000`, cero pagos cash.
- Resultado renderizado: “Quedó anotado en Fiado. Solo el fiado es deuda; **el efectivo sí se registró en la caja**.”

**Impacto:** contradice la regla de oro del repo (“fiado es deuda, no dinero recibido”) justo en la pantalla que la comerciante usa para decidir entrega y conciliación. Puede hacerle creer que el cajón tiene dinero que no entró.

**Fix esperado (sin implementar aquí):**

1. Condicionar el banner a `cashPaidCents > 0`.
2. Si `cashPaidCents === 0`, decir “No se registró efectivo; todo quedó a fiado.”
3. Si hay efectivo y fiado, decir el desglose real.
4. Añadir regresión: venta fiado total → `paidCents=0` y el DOM no contiene “el efectivo sí se registró”.

---

### P1

#### MN-B-02 · Cambio fantasma en Mixto: efectivo + fiado que cubren el total dejan “Recibiste/Cambio” sin efectivo aplicado

**Dónde:** `caja-screen.tsx:80-85` (reparto), `:194-208` (método), `:392-400` (`canConfirm`), `sale-summary.tsx:143-150` (copy de cambio).

Reproducción runtime (`modulos-runtime.txt`):

1. Concepto de $100.
2. Método **Mixto**.
3. Efectivo recibido = $100; monto a fiado = $100; cliente = “Cliente Fantasma”.
4. La UI muestra: “Cambio a devolver **$100.00**. Se aplicaron **$0.00** al cobro.”
5. “Confirmar venta” sigue habilitado.
6. La orden queda `paidCents=0`, `creditCents=10000`.
7. El resultado muestra “**Recibiste $100.00**”, “**Cambio $100.00**”, “Saldo vivo fiado $100.00”.

**Causa:** el reparto aplica primero el fiado (`appliedCredit = min(credit, total)`) y luego el efectivo (`appliedCash = min(cash, total - appliedCredit)`). Con `credit=total`, el efectivo aplicado es 0, pero `changeForSale = cash - appliedCash` conserva el efectivo tecleado. `overpay` solo compara el fiado contra el total, no el efectivo contra el remanente.

**Nota de re-auditoría:** el cambio directo Efectivo → Fiado sí está corregido: `chooseMethod("credit")` limpia `cashInput` (`caja-screen.tsx:204-207`) y el smoke F2 pasa. El defecto sobrevive por la ruta **Mixto**, que no limpia ni limita el efectivo.

**Impacto:** una venta 100 % fiada se presenta con “Recibiste” y “Cambio”, y el resultado puede inducir a devolver efectivo que el sistema no aplicó. Es un error de mostrador, no solo de copy.

**Fix esperado:** o se aplica efectivo primero y se limita el fiado al remanente, o se bloquea `cash + credit > total` en Mixto; el cambio solo debe existir si `appliedCash > 0` y el método es efectivo/mixto. Añadir regresión.

#### MN-B-03 · `/ventas` oculta el efectivo ya cobrado cuando un mixto pasa a `payment_pending`

**Dónde:** `ventas/page.tsx:164-184`.

El orden de ramas es:

```tsx
{isDemoOrder
  ? "Demo, no es dinero real"
  : order.status === "payment_pending"
    ? "Pendiente de cobro"
    : order.paidCents > 0
      ? <>Cobrado ...</>
      ...
}
```

Runtime real (`modulos-runtime-real.txt`):

- Antes de generar link: pedido mixto de $100 con `paidCents=6000`, `creditCents=1000`, `paymentMethod=cash`; la fila muestra “Cobrado $60.00”, “Falta cobrar $30.00”, “Saldo vivo $10.00”.
- Después de pasar a `payment_pending` (link generado): la fila muestra “Pendiente de cobro”, “Falta cobrar $30.00”, “Saldo vivo $10.00”; **desaparece “Cobrado $60.00”**.

**Impacto:** la verdad del dinero empeora al avanzar el flujo. La comerciante puede creer que no ha cobrado nada y volver a cobrar, o conciliar mal el cajón.

**Fix esperado:** mostrar siempre `paidCents > 0` como “Cobrado” y agregar un estado separado “Digital pendiente”; no reemplazar el cobrado por el estado global. Añadir regresión de mixto -> link.

#### MN-B-04 · `productId`/`sku` se descartan en silencio y dos productos distintos reutilizan la misma orden

**Dónde:** `api/orders/route.ts:30-48` (Zod), `orders.ts:196-207` (hash), `request-hash.ts:12-30`.

Runtime `modulos-provenance.txt`:

- POST 1 con `productId:"prd_A"`, `sku:"SKU-A"`, `priceSource:"catalog"` → 201; el ítem devuelto solo tiene `description`, `quantity`, `unitPriceCents`, `totalCents`.
- POST 2 con el mismo `requestId` y `productId:"prd_B"`, `sku:"SKU-B"`, `priceSource:"manual"` → 201 y devuelve **la misma orden** (`POST2_SAME_ORDER True`).
- `GET` del pedido: `GET_ITEM_KEYS` no incluye `productId` ni `sku`.

**Impacto:** si Productos se conecta cliente-primero, la venta “funciona” pero pierde provenance sin error; peor aún, un reintento con otro producto puede deduplicarse como la misma venta porque el hash no incluye los campos descartados. Es un bloqueo directo para delegar catálogo/SKU.

**Fix esperado:** definir el contrato v2 en servidor antes que el cliente, migración nullable, hash condicional y Zod explícito; no aceptar campos desconocidos en silencio. Añadir pruebas de payload v1/v2 y de colisión.

#### MN-B-05 · Dos Cajas, dos drafts y dos fórmulas de dinero; el lock cross-tab no existe

**Dónde:** `caja-app.tsx:110-116,1762-1771`; `caja-screen.tsx:32-34,80-85`; `modulos-acoplamientos.txt`.

- `/` sigue sirviendo 7,827 líneas de `CajaApp` con draft `mercado-cero:draft:v1`.
- `/caja` usa `caja-draft:v2`, `caja-request:v2`, `caja-pending:v2`.
- No hay `BroadcastChannel` ni listener de `storage`.
- Ambas implementan la misma regla de reparto y cambio por separado.

**Impacto:** cualquier corrección de dinero (incluido MN-B-01/02) tiene que duplicarse; dos pestañas pueden crear ventas distintas; el pie de `/caja` aún manda a la Caja clásica. Sin una fuente compartida, delegar C/D multiplica el riesgo de divergencia.

**Fix esperado:** extraer `sale-math` y `sale-status` compartidos, o retirar la Caja legacy; un solo draft/lock cross-tab. No es una propuesta de C, es una condición de borde.

#### MN-B-06 · `POST /api/demo/pay` sigue sin idempotencia explícita ni comprobación `order.demo` (heredado)

**Dónde:** `api/demo/pay/route.ts:22-28,49-85`; `payment-panel.tsx:220-235`.

- La ruta solo verifica el modo global; no verifica que el pedido sea `demo`.
- No recibe `requestId` ni usa una llave por pedido; genera `demo_txn_...` nuevo.
- La UI muestra “Simular CoDi / Simular tarjeta” según `demo` global, no según `order.demo`.
- En esta prueba, dos POST concurrentes **no duplicaron** (`modulos-demo-race.txt`: 1 pago, `demo_paid`), pero no hay garantía de idempotencia y el hueco de `order.demo` sigue.

**Impacto:** en una base demo reutilizada, un pedido real pendiente podría quedar `demo_paid` y desaparecer del modo real. Es un riesgo de verdad de estado, no de dinero real.

**Fix esperado:** decidir idempotencia por pedido o prohibir la simulación sobre pedidos no demo; como mínimo exponer `order.demo` y condicionar el botón.

---

### P2

| ID | Hallazgo | Evidencia | Efecto |
|---|---|---|---|
| MN-B-07 | `/ventas` usa etiquetas locales que contradicen `payment-labels`: un `confirmed` digital sin link se rotula “Registrado”, mientras la verdad central dice “Por cobrar”. | `ventas/page.tsx:251-274`; `payment-labels.ts:118-123`; `modulos-runtime-real.txt` | La lista no señala la cobranza pendiente; el usuario debe leer “Falta cobrar”. |
| MN-B-08 | “Por cobrar digital” dice “Links y QR de todos los días”, pero `sumPendingOrderBalances` incluye `confirmed` sin link/QR. | `ventas/page.tsx:45,107-110`; `db.ts:1475-1487`; runtime demo `$170` con un pedido nuevo sin link | Copy sobrepromete; no distingue “por cobrar” de “link generado”. |
| MN-B-09 | `/ventas` no tiene filtros, búsqueda, detalle de pagos ni breakdown; además hace N+1 de créditos. | `ventas/page.tsx:41-50,127`; no existe `app/ventas/[id]`; `db.ts:1737-1763` | Consulta operativa lenta y manual; no se puede conciliar desde la lista. |
| MN-B-10 | `Order` no expone `demo` ni un breakdown de pagos; `/ventas` infiere demo con `lastPaymentDemo`, que excluye efectivo demo. | `types.ts:25-48`; `db.ts:1352-1357`; `ventas/page.tsx:128-129` | En modo demo todo se rotula Demo; en real el filtro evita sobreafirmar, pero no hay verdad por fila. |
| MN-B-11 | `paymentMethod` se acepta en el schema y no se lee en `createOrder`. Runtime: `paymentMethod:"card"` sin efectivo deja `paymentMethod:null`. | `api/orders/route.ts:46`; `types.ts:166-174`; `modulos-payment-method.txt` | Un módulo de pagos puede creer que el método quedó guardado; no es así. |
| MN-B-12 | Modo demo implícito si falta `PEY_API_KEY`; siembra 14 pedidos demo (13 pagados + 1 pendiente) y un crédito de $50 sin `order_id`. | `config.ts:10-14`; `db.ts:1039-1088,1115-1246`; `modulos-mocks.txt`; `modulos-demo-db.txt` | Un entorno “real” mal configurado arranca con datos simulados; el crédito huérfano no aparece en `/ventas`. |
| MN-B-13 | El `CATALOG` hardcodeado del parser legacy sigue siendo un precio maestro de facto. | `voice-local.ts:5-18`; `voice.ts:55-74`; `/caja` no lo importa | Cuando exista catálogo real habrá dos fuentes de precio; la Caja nueva no debe adoptarlo. |
| MN-B-14 | Dos roadmaps asignan Productos a oleadas distintas: plan §9 dice C=fiados/corte, D=productos; auditoría previa §8.2 dice C=Productos, D=Inventario/Proveedores. | `MIGRACION_INTEGRAL_MERCADO_CERO.md` §9; `oleada-b/MODULOS_NEGOCIO.md` §8.2; `modulos-roadmap.txt` | Dos carriles pueden tocar `orders.ts`/`types.ts`/`db.ts` en paralelo. |

### P3

| ID | Hallazgo | Evidencia | Efecto |
|---|---|---|---|
| MN-B-15 | `formatMxn` duplicado en `config.ts` y `format.ts`; `parseMoney` legacy y `parseMoneyCents` nueva tienen normalizaciones distintas. | `config.ts:20-26`; `format.ts:1-7`; `caja-app.tsx:216-228`; `components/caja/types.ts:17-48` | Dos verdades de formato/parseo; una venta puede diferir entre Cajas. |
| MN-B-16 | `CajaScreen` sigue importando `DashboardData` solo para el tipo de `merchant`. | `caja-screen.tsx:5,55` | Acoplamiento de tipo innecesario; la página ya no serializa datos. |
| MN-B-17 | `MERCHANT` hardcodeado y `listOrders`/`countOrders` no filtran `merchant_id`. | `config.ts:1-8`; `db.ts:1409-1434` | Un solo comercio; multi-merchant exigiría reescritura de consultas. |
| MN-B-18 | Folio de `/ventas` = últimos 4 caracteres; puede colisionar. | `ventas/page.tsx:149`; `format.ts:91-93` | No sirve para buscar ni como identificador operativo. |
| MN-B-19 | Fixture “Revisar inventario” en `/inicio` sugiere un módulo inexistente. | `inicio/page.tsx:55-60`; etiqueta “Ejemplo” `:191`; nota `:204-208` | Deuda de contenido; no es una integración falsa, pero confunde. |
| MN-B-20 | No hay imprimir/exportar; tampoco cancelar/reembolsar/editar. | `app/ventas` solo `page.tsx`/`ventas.css`; `PATCH /api/orders/:id` solo `fulfill` | No ofrecer acciones no soportadas; el historial queda limitado. |
| MN-B-21 | `/caja` importa `inicio.css` y comparte shell/estilos globales. | `caja-screen.tsx:29` | Acoplamiento de presentación; no es bloqueo de venta. |

---

## 8 · Criterios de aceptación de B para no heredar deuda a C/D

> Esto no es un plan de Oleada C. Es el mínimo para declarar que B no deja una verdad de dinero rota ni un contrato de ítem incompleto.

### 8.1 Caja

1. Un pedido 100 % fiado muestra `paidCents=0`, `creditCents=total` y **no** dice que se registró efectivo.
2. Un mixto con efectivo+fiado no muestra “Recibiste/Cambio” si `appliedCash=0`; no se puede confirmar un reparto ambiguo.
3. El cambio solo se muestra si el método es efectivo/mixto y hay efectivo aplicado; no se envía al servidor.
4. El payload manual sigue siendo v1 (`description`, `quantity`, `unitPriceCents`).
5. La venta manual funciona con catálogo apagado, 404, 500 o timeout.

### 8.2 `/ventas`

1. `payment_pending` con `paidCents>0` muestra el cobrado; no lo reemplaza por “Pendiente de cobro”.
2. `confirmed` con saldo digital se rotula “Por cobrar” o “Digital pendiente”, no “Registrado”.
3. Una fila muestra: folio, fecha/hora, cliente/Mostrador, método real, estado, conceptos, total, cobrado, pendiente y saldo fiado.
4. El detalle de pagos existe o no se promete; no se inventa.
5. No hay N+1 de créditos; se usa un batch.
6. “Por cobrar digital” no afirma “Links y QR” si incluye pedidos sin link.

### 8.3 Contrato de producto

1. `POST /api/orders` v2 acepta `productId`, `sku`, `priceSource`, `unitLabel` opcionales y los persiste como snapshot.
2. Un payload v1 conserva el hash actual; un v2 con `productId` distinto produce hash distinto.
3. El servidor no descarta campos nuevos en silencio.
4. `order_items` tiene columnas nullable; no hay FK destructiva.
5. Stock 0/negativo no bloquea la venta.
6. Un ítem manual sin `productId` no es error y se reporta como “sin producto”.

### 8.4 Evidencia mínima

- Regresión DOM: fiado total sin “efectivo sí se registró”.
- Regresión DOM: mixto con `cash+credit>total` no confirma ni muestra cambio fantasma.
- Regresión `/ventas`: mixto confirmado vs `payment_pending` conserva “Cobrado”.
- Regresión API: payload v1/v2, hash y claves desconocidas.
- SQL reproducible para `orders.status/paid_cents/credit_cents`, `payments`, `credits.balance_cents`.
- Gates formales cuando el dueño de la ola lo autorice; este informe no los sustituye.

---

## 9 · Índice de evidencia

| Evidencia | Para qué |
|---|---|
| `EVIDENCIAS/modulos-dependencias-caja.txt` | Independencia de Caja: imports, fetch, Zod, tablas. |
| `EVIDENCIAS/modulos-esquema.txt` | No hay tablas de productos/inventario/proveedores; `order_items` sin SKU. |
| `EVIDENCIAS/modulos-runtime.txt` | P0 y P1 reproducidos en demo aislado (15/15). |
| `EVIDENCIAS/modulos-runtime-real.txt` | `/ventas` real, mixto, `payment_pending` y Caja sin datos de ventas (12/12). |
| `EVIDENCIAS/modulos-ventas-campos.txt` | Campos disponibles/ausentes y etiquetas de `/ventas`. |
| `EVIDENCIAS/modulos-cambio-fantasma.txt` | Fórmulas y copy del cambio. |
| `EVIDENCIAS/modulos-provenance.txt` | Pérdida silenciosa de `productId`/`sku` y colisión de idempotencia. |
| `EVIDENCIAS/modulos-idempotencia.txt` | Hash y Zod actuales. |
| `EVIDENCIAS/modulos-payment-method.txt` | `paymentMethod` aceptado y no persistido. |
| `EVIDENCIAS/modulos-mocks.txt` | Demo implícito, seeds, catálogo legacy y fixture. |
| `EVIDENCIAS/modulos-demo-db.txt` | 14 `demo_hist`, 1 `demo_seed`, crédito huérfano. |
| `EVIDENCIAS/modulos-acoplamientos.txt` | Dos Cajas, drafts, parsers, etiquetas, N+1. |
| `EVIDENCIAS/modulos-roadmap.txt` | Contradicción de dueño de Productos. |
| `EVIDENCIAS/modulos-demo-race.txt` | Dos `/api/demo/pay` concurrentes; sin duplicado en esta corrida, sin idempotencia explícita. |
| `EVIDENCIAS/modulos-git.txt` | HEAD, rama, estado y buildSha. |

---

## 10 · Límites y lo que no se afirma

- **No** se declara `/caja` o `/ventas` cerradas, ni GO, ni PASS de gates.
- **No** se probó pey real, QR real, webhook real, lector de pantalla, iOS/Safari ni HCM real.
- **No** se modificó producto, base del repo ni commit.
- **No** se propone iniciar Oleada C ni se asignan tareas de C/D; las interfaces de §5 son contratos de borde.
- La prueba de `/ventas` con `payment_pending` se hizo sobre una base real temporal, cambiando el estado por SQL en esa base aislada para simular el resultado de adjuntar link; no se alteró la DB del repo.
- El P0 es de **verdad visible** (copy/resultado), no de persistencia: la orden guarda correctamente `paidCents=0`. Precisamente por eso es peligroso: el dato es correcto y la pantalla lo contradice.
