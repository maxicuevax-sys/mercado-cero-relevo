# Auditoría de repositorio — Oleada B (Caja real + historial de ventas)

**Modo:** solo lectura. No se editó código, no se hizo commit y no se ejecutaron builds ni gates con escritura.
**Rama:** `design/oleada-b-caja-ventas`
**HEAD:** `26c7741433f18e4f4d0e78b1913df76ed09dae7e` (`docs: cierre local de Oleada A`)
**Snapshot del informe:** 2026-11-04 07:52:25 (-06:00)
**Alcance:** `web/src/app`, `web/src/components`, `web/src/lib`, `web/next.config.ts`, `web/scripts`, `web/src/proxy.ts`.

> **Advertencia de estado:** el árbol **no está limpio** al momento de esta auditoría. La premisa inicial («árbol limpio, `/caja` 404») era cierta para `26c7741`, pero durante la auditoría aparecieron archivos no rastreados de una implementación B en curso. Este informe separa explícitamente **base `26c7741`** de **snapshot 07:52**. Los archivos WIP no se consideran entregados ni verificados.

---

## 0. Veredicto ejecutivo

**B es viable, pero no se puede cerrar con el snapshot actual.** La dirección correcta —reutilizar shell, endpoints y tipos, sin tocar el motor financiero— está bien encaminada. Sin embargo, hay cinco bloqueos antes de declarar `/caja` y `/ventas` terminadas:

1. **Evidencia inválida por árbol sucio.** Hay cambios `M`, un `D` y varios `??`; `verify:evidence` exige árbol limpio y SHA estable.
2. **Verdad de pago duplicada.** Los componentes nuevos (`sale-result.tsx`, `payment-panel.tsx`, `/ventas`) reimplementan etiquetas y cálculos que ya viven en `caja-app.tsx`/`payment-labels.ts`; el resultado ya mislabels efectivo, demo y fiado.
3. **Fiado original vs saldo vivo.** `/ventas` y `SaleResult` usan `order.creditCents` como si fuera deuda actual; el saldo vivo está en `Credit.balanceCents`.
4. **Pérdida del cobro pendiente.** La `/caja` nueva guarda el pedido solo en memoria; al refrescar se pierde el cobro en curso y no hay aviso de reanudación como en la Caja legacy.
5. **Dos Cajas con almacenamiento distinto.** `mercado-cero:draft:v1` y `mercado-cero:caja-draft:v2` no se migran entre sí; `/` y `/caja` pueden producir dos borradores y dos ventas.

**Recomendación:** no borrar ni redirigir `/` todavía. Hacer una extracción B0 de verdad de pago, dinero y almacenamiento de venta; después cerrar `/caja` y `/ventas`; dejar la migración de los tabs legacy (`/fiados`, `/corte`, `/metas`, `/pendientes`) para C.

---

## 1. Estado real del repositorio

### 1.1 Base y deltas observados

| Elemento | Valor |
|---|---|
| HEAD | `26c7741` |
| Rama | `design/oleada-b-caja-ventas` |
| `caja-app.tsx` en worktree | `7537fde4...` (idéntico a `HEAD`) |
| SHA-256 parcial `caja-app.tsx` | `D1FF5CED5445B49F` |
| SHA-256 parcial `app/page.tsx` | `2FC98B333248353B` |
| SHA-256 parcial `app/caja/page.tsx` | `49FAEAD5963CD899` |
| SHA-256 parcial `app/ventas/page.tsx` | `2347AEDD0F18E6CA` |

`git status --porcelain=v1` al snapshot:

```text
 M web/src/app/inicio/page.tsx
 D web/src/app/ventas/route.ts
 M web/src/components/shell/nav.ts
?? web/src/app/caja/
?? web/src/app/ventas/page.tsx
?? web/src/app/ventas/ventas.css
?? web/src/components/caja/
```

| Archivo | Estado | Qué contiene | Relevancia |
|---|---|---|---|
| `web/src/app/inicio/page.tsx` | `M` | CTA «Registrar» pasó de `/ventas` a `/caja` | Correcto para B; confirma que el alias viejo prometía otra cosa. |
| `web/src/app/ventas/route.ts` | `D` | Antiguo alias 307 a `/?tab=caja` | Necesario para que exista `page.tsx` en el mismo segmento. |
| `web/src/components/shell/nav.ts` | `M` | Agrega `/caja`, renombra `appNav`, icono de Corte | Ya estaba modificado antes del snapshot; es la nav que usa la Caja nueva. |
| `web/src/app/caja/page.tsx` | `??` | Página WIP de 17 líneas | Caja real, aún no entregada. |
| `web/src/app/ventas/page.tsx` | `??` | Historial WIP de 192 líneas | Historial real, aún no entregado. |
| `web/src/app/ventas/ventas.css` | `??` | Estilos WIP de 270 líneas | Sin verificación visual. |
| `web/src/components/caja/**` | `??` | 7 archivos WIP (1,374 a 14,515 bytes) | Implementación B en curso. |

**Consecuencia:** cualquier `latest.json`/`latest-static.json` generado ahora tendría `gitAtStart.dirty: true` y no sería GO. Los conteos de la Oleada A tampoco prueban B: `p0-venta-e2e.py` navega a `BASE` (`web/scripts/p0-venta-e2e.py:113`), es decir `/`, no `/caja`.

### 1.2 Qué significa «limpio» para B

- No se debe commitear el WIP sin resolver los hallazgos H-02 a H-08.
- `caja-app.tsx` no cambió: la Caja legacy sigue siendo el único render de `/` y de `/?tab=*`.
- La Caja nueva **no reemplaza** a la legacy todavía; convive con ella.
- La evidencia final debe generarse **después** del commit de B, con árbol limpio y `BUILD_SHA` del HEAD.

---

## 2. Inventario actualizado de `caja-app.tsx`

**Archivo:** `web/src/components/caja-app.tsx`
**Tamaño:** 8,228 líneas, 323,106 bytes.
**Conteo bruto:** ~107 usos de `useState`, 32 `useEffect`, 50 `useCallback`, 3 `useMemo`, 13 `useRef`, 20 llamadas `fetch`.

> Los conteos son del archivo completo; `CajaApp` concentra 60 `useState`, 21 `useEffect`, 47 `useCallback` y 13 `fetch` en sus 2,358 líneas (`657-3014`).

### 2.1 Componentes internos

| Componente | Líneas | Rol | Props | Estado/efectos | Fetch propio |
|---|---:|---|---:|---|---|
| `CajaApp` (default) | `657-3014` | Orquestador de tabs, venta, cobro, fiado, corte, metas, pendientes, voz y preferencias | 4 | 60 `useState`, 21 `useEffect`, 47 `useCallback`, 3 `useMemo` | 13 |
| `CajaBook` | `3021-3262` | Panel de solo lectura: KPIs, libreta «Cuánto llevo», deuda | 13 | 0 | No |
| `CajaPanel` | `3264-3983` | Composer de venta manual/voz, líneas, efectivo, fiado, cliente y confirmación | 36 | 2 `useState` (`confirmingClear`, `priceInputs`), 1 `useEffect` | No |
| `OrderCreditNote` | `3990-4024` | Nota de fiado de un pedido | 5 | 0 | No |
| `PaymentPanel` | `4025-4470` | Hoja de cobro: link, QR, demo, resultado y entrega | 15 | 0 estados propios | No; el padre hace generate/demo/deliver |
| `BusinessOverview` | `4477-4817` | Resumen por periodo | 3 | `period`, `report`, `loading`, `error`, `refreshTick` | `/api/analytics?period=` (`4508`) |
| `CashCloseSummary` | `4860-4984` | Resumen de un corte guardado | 2 | 0 | No |
| `CashCloseCard` | `4985-6046` | Corte completo: preview, fingerprint, versiones, conteo | 2 | ~30 estados; refs de campos y dirty | `/api/cash`, `/api/cash/preview`, `/api/cash/close` (`5054`, `5252`, `5308`) |
| `GoalCard` | `6047-6283` | Meta única y aporte | 2 | `goal`, `amount`, `loading`, `saving`, `error`, request refs | `/api/goals`, `/api/goals/[id]/contribute` (`6066`, `6117`) |
| `ReconcileCard` | `6284-6424` | Conciliación local vs pey | 1 (`demoMode`) | `report`, `loading`, `error` | `/api/reconcile` (`6293`) |
| `ActivityList` | `6425-6594` | Últimos movimientos, expandible | 5 | `showAll` | No |
| `CreditList` | `6601-6752` | Libreta de fiado | 8 | 0 | No |
| `CreditPaySheet` | `6753-7014` | Hoja de abono; el POST lo hace el padre | 13 | 1 estado (`discardOpen`) + efecto | No |
| `VerifyCard` | `7015-7158` | Verificación de comprobante | 7 | 0 | No |
| `Toast` | `7159-7203` | Aviso temporal | 2 | 0 | No |
| `QrImage` | `7204-7235` | Genera QR local desde un string | 2 | `src` + efecto | No (usa `qrcode` en cliente) |
| `StatusBadge` | `7236-7300` | Estado visible del pedido, con fiado abierto/saldado | 2 | 0 | No |
| `paymentTruth` / `paymentSheetTitle` | `7302-7359` | Verdad de dinero y título de resultado | funciones | — | — |
| `TABS` / `TAB_HEADINGS` | `7360-7382` | Navegación y foco de tabs | constantes | — | — |
| `AppSidebar` | `7384-7464` | Sidebar legacy con botones de tab | 5 | 0 | No |
| `TopBar` | `7466-7548` | Topbar legacy con mute/ayuda/demo | 8 | 0 | No |
| `MobileTabBar` | `7550-7592` | Tab bar móvil legacy | 2 | 0 | No |
| `Sheet` | `7594-7735` | Portal, foco, inert, scroll lock | 5 | refs + efectos de foco/inert | No |
| `PaidSheet` | `7737-7922` | Resultado pagado/demo/fiado con entrega | 7 | 0 | No |
| `HelpContent` | `7924-8146` | Ayuda, tamaño, contraste, voz | 8 | `expanded` + `CompanionPreferences` | No |
| `DemoContent` | `8147-8205` | Reset demo | 2 | `confirming` | No |
| `Memo*` | `8206-8214` | Envoltorios `memo` de paneles | — | — | — |

### 2.2 Estados de `CajaApp` por grupo

| Grupo | Estados / refs | Líneas |
|---|---|---|
| Datos y refresco | `dashboard`, `loading`, `dashboardError`, `retryingDashboard`, `pendingCheckedAt`, `tasksResetKey`, `cashCloseKey` | `668-676` |
| Navegación | `tab`, `visitedTabs`, `tabWipe`, `today`; `scrollPositions`, `keyboardTabRef` | `677-682`, `744-758` |
| Overlays y preferencias | `helpOpen`, `verifyOpen`, `demoOpen`, `muted`, `textSize`, `contrast`, `voiceRate` | `683-689` |
| Voz | `listening`, `transcribing`, `recordingSeconds`, `transcript`, `textInput`, `showTextInput`; recorder/stream/timer/TTS refs | `691-696`, `763-775` |
| Borrador | `draftItems`, `cashCents`, `creditCents`, `cashInput`, `creditInput`, `customerName`, `itemErrors`, `restoredDraftAt`, `confirmingRestoredClear`, `draftReady`, `savingOrder`; `lastSavedDraftRef`, `restoredDraftSignatureRef`, `saleRequestRef`, `saleLockRef` | `698-709`, `752-756` |
| Cobro activo | `activeOrder`, `resumableOrder`, `lastChange`, `paymentLoading`, `paymentMode`, `paidOverlay`, `delivering`, `deliverError`, `toast` | `711-720` |
| Verificación | `verifyId`, `verifyResult`, `verifying`, `verifyError` | `722-724`, `742` |
| Abono fiado | `creditPayId`, monto/initial/method/initial/note/error/notice/requestId/paying; `creditPayLockRef` | `726-739`, `754` |
| Errores | `saleError`, `voiceError`, `verifyError`, `dashboardError` | `672`, `740-742` |
| Derivados | `activityOrders`, `draftTotal`, `appliedCreditCents`, `appliedCashCents`, `changeCents`, `digitalDue`, `overpay`, `pendingCredits` | `779-788`, `1745-1766`, `2367-2369` |

### 2.3 Efectos de `CajaApp` (21)

| # | Línea | Efecto |
|---:|---:|---|
| 1 | `891` | Aborta el fetch del dashboard al desmontar. |
| 2 | `912` | Montaje: fecha, preferencias, `?ayuda=1`, `initialDashboard` o primera carga. |
| 3 | `958` | Refresco al volver a la pestaña/foco y polling de 45 s solo visible. |
| 4 | `1000` | Restaura borrador y `sale-request` desde `localStorage`. |
| 5 | `1037` | Persiste borrador con `draftSignature`. |
| 6 | `1070` | Reabre aviso de pedido pendiente vía `GET /api/orders/[id]`. |
| 7 | `1114` | Sincroniza fiado/pendiente con el dashboard (otra pestaña). |
| 8 | `1159` | Persiste/limpia `pending-order:v1` según `activeOrder`. |
| 9 | `1168` | Aplica `data-text-size`. |
| 10 | `1177` | Aplica `data-contrast`. |
| 11 | `1186` | Detecta zoom tipográfico real y ajusta `data-text-zoom`. |
| 12 | `1206` | Persiste velocidad de voz. |
| 13 | `1246` | Restaura scroll o enfoca encabezado al cambiar tab. |
| 14 | `1260` | Mide `.topbar`/`.mobile-tabs` y define `--mc-chrome-*`. |
| 15 | `1288` | Red de seguridad del barrido de tab. |
| 16 | `1296` | Limpia `deliverError` al cambiar de pedido. |
| 17 | `1302` | Detiene recorder y tracks al desmontar. |
| 18 | `1434` | Silencia TTS/audio al activar mute. |
| 19 | `1446` | Detiene voz al ocultar/cerrar la pestaña. |
| 20 | `1870` | Limpia `saleError` al corregir la venta. |
| 21 | `2064` | Polling de 3 s del pedido activo; abre resultado al pagarse. |

### 2.4 Fetch reales (20 en el archivo)

**Dentro de `CajaApp` (13):**

| Línea | Endpoint | Uso |
|---:|---|---|
| `832` | `GET /api/dashboard` | Carga inicial, foco, polling y refresco forzado. |
| `1077` | `GET /api/orders/[id]` | Restaurar pedido pendiente. |
| `1352` | `POST /api/tts` | Voz Piper. |
| `1581` | `POST /api/voice/parse` | Interpretar venta. |
| `1703` | `POST /api/voice/transcribe` | Transcribir audio. |
| `1938` | `POST /api/orders` | Crear venta. |
| `2010` | `POST /api/orders/[id]/pay` | Generar link/QR. |
| `2033` | `POST /api/demo/pay` | Simular pago digital. |
| `2072` | `GET /api/orders/[id]` | Polling de cobro. |
| `2134` | `GET /api/verify` | Verificar comprobante. |
| `2181` | `POST /api/credits/[id]/pay` | Abono de fiado. |
| `2272` | `PATCH /api/orders/[id]` | Marcar entrega. |
| `2336` | `POST /api/demo/reset` | Reiniciar demo. |

**Subcomponentes (7):** `GET /api/analytics` (`4508`), `GET /api/cash` (`5054`), `POST /api/cash/preview` (`5252`), `POST /api/cash/close` (`5308`), `GET /api/goals` (`6066`), `POST /api/goals/[id]/contribute` (`6117`), `GET /api/reconcile` (`6293`).

### 2.5 Dependencias y persistencia

**Imports principales (`1-85`):**

- `next/image`, `react` (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`, `memo`, `useId`), `createPortal`.
- Assets de marca/ilustraciones (`6-18`).
- Componentes ya extraídos: `AnimatedAmount`, `ClosingChecklist`, `CompanionPreferences`, `PendingPayments`, `PendingTasksPanel`, `ScreenHeading` (`19-24`).
- `lucide-react` (`25-56`).
- Utilidades puras: `cn`, `formatActivityDate`, `formatCompactMxn`, `formatLongDate`, `formatMxn`, `formatTime`, `initials`, `shortOrder` (`57-66`).
- `answerDebtQuery`, `PAYMENT_STATES`, `DEMO_CLOSE_LABEL`, `orderStatusCopy`, `verifySourceCopy` (`67-73`).
- Solo `type` de `DashboardData` y `types` (`74-85`).

**No importa:** `next/navigation`, `useRouter`, `usePathname`, `useSearchParams`, `next/link`, `AppShell` ni `@/lib/db`/`@/lib/orders`. La Caja legacy no controla la URL.

**Persistencia local (`105-112`):**

| Clave | Versión | Contenido | Uso |
|---|---|---|---|
| `mercado-cero:draft:v1` | 1 | `items`, `cashCents`, `creditCents`, `customerName`, `textInput`, `transcript`, `updatedAt` | Borrador de venta legacy. |
| `mercado-cero:pending-order:v1` | 1 | `orderId`, `updatedAt` | Aviso de cobro pendiente legacy. |
| `mercado-cero:sale-request:v1` | 1 | `requestId` (`sale_*`), `signature`, `updatedAt` | Idempotencia legacy. |
| `mercado-cero:muted` | — | `0/1` | Preferencia. |
| `mercado-cero:text-size` | — | `normal/large/xlarge` | Preferencia. |
| `mercado-cero:contrast` | — | `normal/high` | Preferencia. |
| `mercado-cero:voice-rate` | — | valor | Preferencia. |

**Regla de frontera vigente:** `caja-app.tsx` solo importa tipos y funciones puras de `lib/`; no importa DB ni órdenes de servidor. La Caja nueva debe conservar esa frontera.

---

## 3. Contratos y APIs reutilizables

### 3.1 Mapa de endpoints

| Endpoint | Límite / seguridad | Request | Response | Efecto real |
|---|---|---|---|---|
| `GET /api/orders` | `private, max-age=10`, ETag/304, gzip; `limit` 50 default, 200 max; `offset` | query `limit`, `offset` | `{ orders, limit, offset, total, hasMore, pagination }` | Solo lectura. Orden `created_at DESC, id DESC`. En real oculta demo; en demo incluye todo. `qrImage` se omite en listas (`null`). |
| `POST /api/orders` | 60/min; 64 KB; same-origin en proxy | `items[]`, `cashCents?`, `creditCents?`, `customerName?`, `paymentMethod?`, `requestId?` | `201 { order }`; `400 { error, issues }`; `409 { error, code }` | Crea orden, ítems, pago de efectivo y crédito; idempotente por `requestId` + hash. |
| `GET /api/orders/[id]` | `private, no-store` por `next.config`; sin rate limit propio | path `id` | `{ order, payments, credit }` o `404 { error }` | Solo lectura. `credit` trae `balanceCents` vivo. |
| `PATCH /api/orders/[id]` | 60/min; 8 KB | `{ action: "fulfill" }` o `{ status: "fulfilled" }` | `{ order }`; `400/404/409` | Marca entrega; rechaza demo, fiado abierto y pedido no cubierto. |
| `POST /api/orders/[id]/pay` | 30/min; 8 KB | `{ mode?: "link" \| "qr" }` | `{ order }` | Adjunta link/QR; deja `payment_pending` si queda saldo; no marca pagado. |
| `POST /api/demo/pay` | Solo demo (403 `demo_disabled`); 30/min; 8 KB | `{ orderId, method: "codi" \| "card" \| "wallet" }` | `{ order, transactionId }` | Simula pago digital con provider `demo`; efectivo rechazado. |
| `GET /api/dashboard` | `private, max-age=5`, ETag/304 | `ordersLimit`, `pendingLimit`, `creditsLimit`, offsets | `DashboardData` | Solo lectura. `summary` es hoy (México); pendientes/créditos son totales. |
| `GET /api/verify` | 60/min | `transactionId`, `orderId` obligatorios | `{ verified, source, reason?, message?, ... }` | Solo lectura. Local solo `provider='pey'`; demo siempre `verified:false`. |
| `GET /api/credits` | `private, max-age=10`, ETag | `limit`, `offset` | `{ credits, limit, offset, total, hasMore, pagination }` | Solo lectura de fiados. |
| `POST /api/credits/[id]/pay` | 60/min; 8 KB | `amountCents`, `method?`, `note?`, `requestId?`, `expectedBalanceCents?` | `{ credit, appliedCents, balanceCents, overpayCents, duplicate }`; `409` con `code` | Abono idempotente; no crea venta nueva. |
| `GET /api/cash`, `POST /api/cash/preview`, `POST /api/cash/close` | Rate limits propios; preview/close 16 KB | `CashStatus` / montos / `expectedVersion` + `previewFingerprint` | `CashStatus` / preview / `{ close, status }` | Corte y versiones; no tocar en B. |
| `GET /api/analytics` | 120/min; `private, max-age=30` | `period=today\|week\|month` | `AnalyticsReport` | Solo lectura. |
| `GET /api/reconcile` | 30/min; no-store | — | `ReconciliationReport` | Solo lectura. |

### 3.2 `Order` exacto

```ts
type OrderStatus =
  | "draft"
  | "confirmed"
  | "payment_pending"
  | "partially_paid"
  | "paid"
  | "demo_paid"
  | "fulfilled"
  | "cancelled";

type PaymentMethod = "codi" | "card" | "wallet" | "cash" | "mixed" | "unknown";

interface OrderItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

interface Order {
  id: string;
  merchantId: string;
  status: OrderStatus;
  totalCents: number;
  paidCents: number;
  digitalPaidCents: number;
  paymentMethod: PaymentMethod | null;
  lastPaymentProvider: string | null;
  lastPaymentDemo: boolean;
  customerName: string | null;
  creditId: string | null;
  creditCents: number;
  paymentLinkId: string | null;
  paymentUrl: string | null;
  qrId: string | null;
  qrString: string | null;
  qrImage: string | null;
  numRef: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}
```

Fuente: `web/src/lib/types.ts:1-48`.

**Campos que **no** existen y hay que calcular:**

- `dueCents` = `max(0, totalCents - paidCents - creditCents)`.
- `cashPaidCents` = `max(0, paidCents - digitalPaidCents)` (fórmula usada por `paymentTruth`, `caja-app.tsx:7310-7312`).
- `creditBalanceCents` no está en `Order`; está en `Credit.balanceCents` (`types.ts:73-83`) y en `GET /api/orders/[id].credit`.

**Trampas verificadas:**

1. **`paidCents` incluye pagos demo y digitales.** `recalculateOrderTotals` suma todos los `payments` con `status='paid'` (`lib/orders.ts:653-658`); `digitalPaidCents` suma todos los no-efectivo (`lib/db.ts:1304-1321`). No usar `paidCents` como «efectivo cobrado».
2. **`creditCents` es el monto original del fiado, no el saldo vivo.** Un abono parcial no cambia `Order.creditCents`; solo cambia `Credit.balanceCents` (`lib/orders.ts:928-930`).
3. **`status: "paid"` puede convivir con fiado abierto.** Si el digital cubre `total - credit`, `recalculateOrderTotals` marca `paid` aunque quede saldo de fiado (`lib/orders.ts:677-687`). El `StatusBadge` legacy lo corrige a «Fiado» (`caja-app.tsx:7243-7263`). La UI nueva que solo mira `status` dice «Pagado» incorrectamente.
4. **`lastPaymentDemo` no marca el efectivo demo.** `loadLastPaymentProviders` pone `demo:false` para `method='cash'` (`lib/db.ts:1352-1356`). El efectivo demo solo se distingue por el modo global y por `DailySummary.demoCashCents`.
5. **`paymentMethod` no es confiable para el método real.** En una venta solo-fiado queda `null`; en mixto puede ser `mixed`; recién se actualiza cuando hay pagos (`lib/orders.ts:664-667`).
6. **`qrImage` se omite en listas** (`lib/db.ts:1394-1396`); solo el detalle lo conserva. Si la UI nueva necesita QR desde una lista, use `qrString` + `QrImage` o pida el detalle.

### 3.3 `DashboardData` y `Credit`

`DashboardData` (`lib/dashboard.ts:49-65`):

```ts
interface DashboardData {
  merchant: { id, name, owner, address, ... };
  demoMode: boolean;
  summary: DailySummary;
  orders: Order[];
  pendingOrders: Order[];
  credits: Credit[];
  pagination: {
    orders: PageMeta;
    pendingOrders: PageMeta;
    credits: PageMeta;
  };
  creditsTotal: number;
  creditsHasMore: boolean;
  pendingCentsTotal: number;   // todos los pendientes, no solo la página
  creditsOpenTotal: number;    // todos los fiados abiertos
  creditsCustomersTotal: number;
  creditsBalanceCents: number; // saldo vivo total
}
```

`DailySummary` (`types.ts:96-116`): `salesCents` incluye fiado y pendiente; `cashCents` es efectivo real; `verifiedDigitalCents` es pey; `declaredDigitalCents` es abono digital declarado; `demoCashCents`/`demoDigitalCents` están separados; `pendingCents` solo pedidos de hoy; `creditCents` es saldo vivo (en demo incluye fixtures).

`Credit` (`types.ts:73-83`): `id`, `customerId`, `customerName?`, `orderId`, `originalCents`, `balanceCents`, `status`, `dueDate`, `createdAt`. Para deuda actual use `balanceCents`, nunca `Order.creditCents`.

### 3.4 Invariantes de contrato que la UI nueva no puede reinterpretar

1. `POST /api/orders` **clampea** `cashCents` a `totalCents` y `creditCents` a `totalCents - cashCents` (`lib/orders.ts:172-185`). El cambio se calcula en cliente; el servidor no guarda el vuelto.
2. Si `digitalDue = 0`: la orden queda `paid` si no hay fiado, o `confirmed` si hay fiado (`lib/orders.ts:328-335`). Un fiado puro **no** es `paid`.
3. `POST /api/orders` acepta `paymentMethod` en el schema (`app/api/orders/route.ts:46`), pero `createOrder` **no lo usa**; el método inicial es `cash` si hay efectivo, si no `null` (`lib/orders.ts:234-255`). No enviarlo esperando que cambie el estado.
4. El reintento idempotente devuelve **201** con la misma orden, no 200 (`app/api/orders/route.ts:86-89`; `lib/orders.ts:213-216`). La UI debe comparar `id`, no asumir que es nueva.
5. Reusar `requestId` con otro payload devuelve `409 request_id_conflict`; reusarlo en el otro modo (demo/real) también devuelve 409 (`lib/orders.ts:66-90`).
6. `GET /api/orders` no tiene filtros por fecha, estado, cliente ni búsqueda. Solo `limit`/`offset` (`app/api/orders/route.ts:50-69`).
7. `/api/dashboard` **no** acepta `compactPending`: devuelve `orders` y `pendingOrders` con posibles duplicados. La página `/` los deduplica con `activityOrders` (`caja-app.tsx:779-788`). Una pantalla nueva que una ambas listas debe deduplicar por `id`.
8. Los topes de creación: 50 ítems, 160 caracteres de descripción, cantidad 999, precio unitario 10,000,000 centavos, total 100,000,000 centavos, nombre 120, `requestId` 128 (`lib/orders.ts:27-33`).
9. `POST /api/orders/[id]/pay` solo adjunta link/QR; no confirma dinero. `POST /api/demo/pay` solo existe en demo y **rechaza efectivo** (`app/api/demo/pay/route.ts:15-20`, `22-28`, `88-93`).
10. `PATCH fulfill` rechaza `demo_paid`, fiado abierto y pedido no cubierto (`lib/orders.ts:967-1015`). La UI no debe ofrecer «Entregar» fuera de esas condiciones.
11. `/api/verify` no cambia estados. Un demo devuelve `verified:false` con `reason:"demo_payment"` (`app/api/verify/route.ts:102-117`); un comprobante local solo cuenta si `provider='pey'` (`74-80`).

---

## 4. Matriz de extracción segura para B y C

### 4.1 Principios

1. **Extraer no es reescribir:** mover props/JSX/clases y conservar comportamiento.
2. **La verdad financiera se comparte; la escritura se queda en el servidor.**
3. **B no debe tocar `CajaApp` completo.** Como máximo, un PR B0 pequeño de funciones puras con un solo escritor de `caja-app.tsx`.
4. **La Caja nueva puede duplicar layout, no reglas.**
5. **Un panel extraído no agrega endpoints nuevos:** conserva el endpoint y el payload actuales.

### 4.2 Matriz

| Módulo / regla | Ubicación actual | ¿B? | Destino propuesto | Condición | Riesgo |
|---|---|---|---|---|---|
| `AppShell`, `Sidebar`, `TopBar` shell, `MobileNav`, `PageHeader`, `CurrencyAmount`, `EmptyState` | `components/shell/*`, `components/ui/*` | **Sí, reutilizar** | Ya extraídos | Usar `activeHref` correcto y `mainId` | Bajo |
| `PendingPayments` | `components/pending-payments.tsx` | **Sí, reutilizar** | Ya extraído | No agregar fetch; el padre provee datos | Bajo |
| `PendingTasksPanel`, `ClosingChecklist`, `CompanionPreferences`, `ScreenHeading`, `AnimatedAmount` | archivos ya extraídos | **Sí, reutilizar** | Ya extraídos | No cambiar contrato | Bajo |
| `paymentTruth`, `paymentSheetTitle`, `creditForOrder`, `isCreditSettled`, `statusLabel` | `caja-app.tsx:396-403`, `7302-7359` | **Sí, B0** | `components/caja/payment-truth.ts` | Mover tal cual, tests unitarios, actualizar imports legacy | Medio: toca `caja-app.tsx`; un solo escritor y `p0-venta` |
| Parseo/formato de dinero (`parseMoney`, `parseMoneyInput`, `formatMoneyInput`, `newRequestId`) | `caja-app.tsx:211-237`, `331-338`; WIP `components/caja/types.ts` | **Sí, B0** | `components/caja/money.ts` | Unificar semántica; no duplicar regex | Medio: diferencias de formato |
| Etiquetas de estado (`orderStatusCopy`, `PAYMENT_STATES`) | `lib/payment-labels.ts:27-143` | **Sí, reutilizar** | Ya existe | Prohibido crear `statusLabel` locales | Bajo |
| `StatusBadge`, `OrderCreditNote`, `QrImage`, `Toast` | `caja-app.tsx:3990-4024`, `7159-7235` | **Sí, extraer** | `components/caja/ui/*` | Mover sin cambiar clases; consumir `payment-truth` | Bajo/medio |
| `Sheet` | `caja-app.tsx:7594-7735` | **No en B; C** | `components/caja/ui/sheet.tsx` | Requiere lease de shell/`inert` y pruebas de foco | Alto |
| `CajaBook` | `caja-app.tsx:3021-3262` | **No en B; C** | `components/caja/caja-book.tsx` | Solo si la Caja nueva muestra resumen; no duplicar | Medio |
| `ActivityList` | `caja-app.tsx:6425-6594` | **No en B; C** | `components/caja/activity-list.tsx` | Reusar en C; el historial B tiene otro layout | Bajo |
| `CreditList` | `caja-app.tsx:6601-6752` | **No en B; C** | `components/caja/credit-list.tsx` | Ruta `/fiados` sigue en C | Bajo |
| `CajaPanel` | `caja-app.tsx:3264-3983` | **No** | `components/caja/sale-composer.tsx` (C) | El estado, borrador y foco viven en `CajaApp` | Alto |
| `PaymentPanel` legacy | `caja-app.tsx:4025-4470` | **No copiar** | `components/caja/payment-panel.tsx` (nuevo B) | El nuevo debe usar `payment-truth`; no copiar el legacy | Alto |
| `PaidSheet` | `caja-app.tsx:7737-7922` | **No copiar** | `components/caja/sale-result.tsx` (nuevo B) | Duplica la rama pagada; usar la misma verdad | Alto |
| `CreditPaySheet` + `payCredit` | `caja-app.tsx:6753-7014`, `2155-2257` | **No en B; C** | `components/caja/credit-pay-sheet.tsx` | El POST y `requestId` son del padre | Alto |
| `CashCloseCard` | `caja-app.tsx:4985-6046` | **No en B; C** | `components/caja/cash-close-card.tsx` | Conservar `active`, preview, fingerprint y `expectedVersion` | Alto |
| `GoalCard` | `caja-app.tsx:6047-6283` | **No en B; C** | `components/caja/goal-card.tsx` | Conservar `requestId` y `active` | Medio |
| `BusinessOverview`, `ReconcileCard` | `caja-app.tsx:4477-4817`, `6284-6424` | **No en B; C** | `components/caja/*` | Conservar fetch y `active` | Medio |
| `HelpContent`, `DemoContent` | `caja-app.tsx:7924-8205` | **No en B; C** | `components/caja/*` | La Caja nueva enlaza a `/?ayuda=1` | Medio |
| `CajaApp` | `caja-app.tsx:657-3014` | **No** | Se queda en `/` | No mover estado ni storage | Crítico |
| Storage de borrador/pending/request | `caja-app.tsx:105-112`, `405-573`; WIP `caja-screen.tsx:31-32`, `419-429` | **Sí, B0** | `components/caja/sale-storage.ts` | Debe leer v1 y v2; migración explícita; tests | Alto |
| Shell chrome (`--mc-chrome-*`, scroll, foco de tabs) | `caja-app.tsx:1246-1286` | **No en B** | Se queda en legacy | La Caja nueva usa `AppShell` | Alto |

### 4.3 Orden recomendado

| Fase | Trabajo | Gate mínimo |
|---|---|---|
| **B0** | Extraer `payment-truth.ts`, `money.ts`, `sale-storage.ts`; actualizar imports de `caja-app.tsx` sin cambiar comportamiento; tests puros. | `npm run verify:fast` + `p0-venta` |
| **B1** | Crear `/caja` y `/ventas` usando solo módulos compartidos; corregir verdad de resultado e historial. | `verify:fast` + escenario `/caja` + `p0-venta` legacy |
| **B2** | Persistencia de pedido pendiente, paginación de historial, caché privada, a11y/responsive. | `verify:static` + mobile/axe |
| **C** | Migrar `/fiados`, `/corte`, `/metas`, `/pendientes`; extraer paneles legacy; retirar `/?tab=*`. | `verify:full` + p0 de cada dominio |

### 4.4 Qué **no** debe duplicarse

- La transición `payment_pending → paid` (solo webhook firmado o demo server).
- `paidCents` como sinónimo de efectivo.
- `creditCents` como sinónimo de saldo vivo.
- `status: "paid"` como sinónimo de pedido entregable o sin deuda.
- `paymentMethod` como sinónimo de método real.
- El cálculo de `due` sin restar `creditCents`.
- La validación de límites de orden (mejor importar constantes de `lib/orders` en un módulo compartido, no copiar números).
- `requestId`/`draftSignature`/storage keys.
- `expectedBalanceCents` y `requestId` del abono de fiado.
- `previewFingerprint`/`expectedVersion` del corte.
- `paymentTruth`, `paymentSheetTitle`, `StatusBadge` y las etiquetas de `payment-labels`.
- El foco/inert de `Sheet` y la medición del chrome.
- Los errores de dominio (`409` con `code`) convertidos a mensajes inventados; mostrar el mensaje del servidor.

### 4.5 Qué sí puede duplicarse sin tocar dominio

- Layout, CSS, breakpoints y composición visual de la venta.
- Campos controlados y validación de UX **si** importa los mismos límites y mensajes.
- Llamadas a `formatMxn`/`CurrencyAmount` (no reimplementar `Intl`).
- Copy estático no financiero (títulos, ayudas, placeholders).
- Animaciones y estados de carga locales.
- Presentación del resultado **solo** si consume `paymentTruth` y `PAYMENT_STATES`.

---

## 5. Mapa de rutas y compatibilidad

### 5.1 Rutas al snapshot

| Ruta | Implementación actual | Estado | Notas |
|---|---|---|---|
| `/` | `web/src/app/page.tsx` + `CajaApp` | **200 legacy** | Default `tab=caja`; acepta `?tab=caja\|fiado\|corte\|meta\|pendientes`; `?ayuda=1`. Sigue siendo la Caja completa. |
| `/caja` | `web/src/app/caja/page.tsx` (WIP) + `CajaScreen` | **200 WIP**; 404 en `26c7741` | Caja nueva de venta manual. No existía en la base. |
| `/ventas` | `web/src/app/ventas/page.tsx` (WIP); `route.ts` eliminado | **200 WIP**; antes 307 | Historial real. El `route.ts` 307 ya no existe en el snapshot. |
| `/inicio` | `web/src/app/inicio/page.tsx` | **200** | Shell A; CTA «Registrar» ahora `/caja` (`166-168`). |
| `/fiados` | `web/src/app/fiados/route.ts` | **307** | `tabRedirect(...,"fiado")` (`1-6`). |
| `/corte` | `web/src/app/corte/route.ts` | **307** | `tabRedirect(...,"corte")`. |
| `/metas` | `web/src/app/metas/route.ts` | **307** | `tabRedirect(...,"meta")` (singular). |
| `/pendientes` | `web/src/app/pendientes/route.ts` | **307** | `tabRedirect(...,"pendientes")`. |
| `/pay/[id]` | `web/src/app/pay/[id]/page.tsx` | **200/404** | Checkout público; SSR `getCheckoutData`; `notFound()` si no existe (`21-28`). |
| `/pay/[id]/success` | `web/src/app/pay/[id]/success/page.tsx` | **200** | Público; `Suspense`; polling cliente. |
| `/` API | 24 route handlers | **200** | Ver §3. |

**Conflicto de segmento:** en Next App Router no pueden coexistir `app/ventas/route.ts` y `app/ventas/page.tsx`. La eliminación del `route.ts` es obligatoria, no opcional. El snapshot ya la hizo (`D`).

### 5.2 `?tab=` y compatibilidad

| URL | Render | Problema / regla |
|---|---|---|
| `/` | `CajaApp`, tab `caja` | Default histórico. Mantener. |
| `/?tab=caja` | `CajaApp`, tab `caja` | Sigue siendo legacy; **no** es `/caja`. Dos Cajas. |
| `/?tab=fiado` | `CajaApp`, tab fiado | Alias `/fiados`. |
| `/?tab=corte` | `CajaApp`, tab corte | Alias `/corte`. |
| `/?tab=meta` | `CajaApp`, tab meta | Alias `/metas`; usar `meta`, no `metas` en query. |
| `/?tab=pendientes` | `CajaApp`, tab pendientes | Alias `/pendientes`. |
| `/?tab=ventas` | `CajaApp`, tab `caja` silencioso | **No usar**: no existe tab `ventas`. |
| `/?tab=desconocido` | `CajaApp`, tab `caja` silencioso | `HOME_TABS` filtra (`page.tsx:10-24`). |
| `/?ayuda=1` | `CajaApp`, sheet de ayuda tras montar | `_redirects/tab.ts:11-13` lo conserva en aliases. |
| `/ventas?tab=caja` | Antes 307 a `/?tab=caja`; ahora historial ignora query | Cambio de semántica por B. |
| `/caja?tab=caja` | La página nueva ignora `tab` | No usar query en `/caja`. |

**`selectTab` no toca la URL.** `caja-app.tsx:1229-1245` solo actualiza estado React; no hay `router.replace`, `history.pushState` ni `popstate`. `initialTab` solo alimenta `useState` al montar (`677`). Por eso:
- Un usuario en `/?tab=caja` que pulsa «Fiado» sigue viendo `/?tab=caja`.
- Back/forward no recorre tabs.
- Los aliases 307 funcionan al entrar, pero la URL queda mintiendo al cambiar de tab.
- Esto sigue siendo deuda de C, no algo que B deba resolver para `/caja`, pero **sí** hay que evitar prometer que `/caja` y `/?tab=caja` son la misma pantalla.

### 5.3 Riesgos de back/forward y estado

| Escenario | Comportamiento actual | Riesgo |
|---|---|---|
| `/caja` → `/ventas` → Atrás | Next navega; `/caja` puede restaurarse con estado de cliente o remontarse. | El borrador está en `localStorage` v2; el pedido activo no. Volver puede mostrar composer vacío o resultado viejo. |
| `/caja` con cobro pendiente → refrescar | Se pierde `order`, `view`, `changeCents`; solo queda el borrador. | **Cobro perdido de la vista**; el pedido existe en servidor, pero no se reanuda. |
| `/caja` con resultado → Atrás/Adelante | `view="result"` no está en URL; bfcache puede restaurar el resultado o el composer. | Estado visual no reproducible por URL. |
| `/caja` → liga «Volver a Caja» | `Link href="/caja"` estando ya en `/caja`. | Puede no remontar ni limpiar el resultado (ver H-12). |
| `/?tab=caja` → tabs legacy → Atrás | La URL no cambió; Atrás sale de `/`. | Confuso; deuda A/C. |
| `/fiados` 307 → `/?tab=fiado` | Redirect 307 conserva `ayuda=1` y hash; descarta otros query. | Back puede pasar por el 307; aceptable mientras sea alias. |
| `/ventas` (antes) 307 | Back podía quedar en el redirect. | Al convertirse en página, el historial cambia; probar bookmarks. |
| `/pay/[id]` | Checkout no navega al dashboard; `finish()` intenta cerrar pestaña. | No tocar. |

### 5.4 Borradores y doble registro

| Clave / mecanismo | Legacy `/` | Caja nueva `/caja` | Compatibilidad |
|---|---|---|---|
| Borrador | `mercado-cero:draft:v1` (`caja-app.tsx:105`) | `mercado-cero:caja-draft:v2` (`caja-screen.tsx:31`) | **No hay migración**; un borrador en `/` no aparece en `/caja`. |
| Pedido pendiente | `mercado-cero:pending-order:v1` (`107`) | No existe | **La Caja nueva no reanuda** un cobro tras refresh. |
| Request idempotente | `mercado-cero:sale-request:v1` (`111`) | `mercado-cero:caja-request:v2` (`32`) | Claves distintas; reintentos dentro de cada pantalla, no entre pantallas. |
| Lock de doble clic | `saleLockRef` (`1909-1912`) | `saleLockRef` (`203-209`) | Bien en una pestaña. |
| Dos pestañas | Cada una genera su `requestId` | Igual | **Pueden crear dos pedidos** con el mismo contenido. |

**Regla de aceptación:** si `/` y `/caja` conviven, deben compartir un módulo de storage con migración v1→v2 o declarar explícitamente que son borradores independientes y no prometer continuidad. Para el pedido pendiente, B debe guardar `orderId` y reanudar, o aceptar que el cobro solo vive en `/ventas` (peor UX).

### 5.5 Checkout público

- `GET /api/checkout/[id]` usa `cachedJson(..., "orders")` con ETag; `checkout-client` y `success-client` ya manejan 304/404 y polling (`checkout-client.tsx:86-153`, `success-client.tsx:42-102`).
- `/pay/[id]` y `/success` no deben cambiar en B. `not-found` enlaza a `/` (`not-found.tsx:28-30`); no redirigir `/` a `/caja`.
- `POST /api/demo/pay` es el único pago simulado; el checkout real abre `paymentUrl` (`checkout-client.tsx:192-199`).
- El link público no debe llevar a la Caja de la comerciante.

### 5.6 Caché de las páginas nuevas

`next.config.ts` fuerza `private, no-store` para `/`, `/pay/**` y varias APIs (`88-94`, `165-193`), pero **no** para `/caja` ni `/ventas`. Ambas páginas renderizan datos sensibles en HTML (merchant, resumen, pedidos, fiados). Aunque `connection()` las hace dinámicas, la política explícita debe agregarse y verificarse con `curl -I`; no confiar solo en el default de Next.

### 5.7 Links actuales que importan

| Archivo:línea | Link | Estado |
|---|---|---|
| `app/inicio/page.tsx:166-168` | «Registrar» → `/caja` | **Correcto** en el snapshot. |
| `app/inicio/page.tsx:224-226` | «Ir a ventas» → `/ventas` | **Correcto** para historial. |
| `app/inicio/page.tsx:179` | «Ver todos» → `/?tab=pendientes` | Legacy; podría apuntar a `/pendientes` (307) sin cambio funcional. |
| `components/shell/nav.ts:27` | Caja → `/caja` | **Correcto**, pero el archivo está sin commit. |
| `components/shell/nav.ts:28` | Ventas → `/ventas` | **Correcto** ahora que es historial. |
| `caja-app.tsx:7399`, `7491` | Marca/TopBar → `/inicio` | No tocar. |
| `pay/[id]/not-found.tsx:28` | «Volver» → `/` | No redirigir `/`. |
| `sale-result.tsx:119-124` | «Ver ventas» → `/ventas`; «Volver a Caja» → `/caja` | «Ver ventas» correcto; «Volver a Caja» es same-route (H-12). |
| `payment-panel.tsx:214-216` | «Ver historial» → `/ventas` | Correcto tras B. |
| `caja-screen.tsx:403-406` | «la vista anterior» → `/` | Correcto como escape legacy, pero mezcla shells. |

---

## 6. Hallazgos del snapshot (con rutas y líneas)

> Los hallazgos H-02 a H-08 se refieren a archivos WIP no rastreados. Si el WIP se descarta, siguen siendo válidos como riesgos de diseño; las líneas de `caja-app.tsx` y APIs son estables.

### H-01 — CRÍTICO — El árbol no está limpio y la evidencia no puede ser GO

**Evidencia:** `git status` con `M`, `D` y `??` (§1.1); `HARNESS.md`/`EVALS.md` exigen `gitAtStart.dirty:false` y `verify:evidence` contra HEAD.
**Impacto:** cualquier `latest.json` de B sería inválido; no se puede declarar cierre.
**Acción:** commit atómico del WIP corregido o stash; regenerar build/evidencia desde HEAD limpio.

### H-02 — ALTO — Verdad de pago duplicada y divergente

**Evidencia:**
- La verdad canónica está en `caja-app.tsx:7310-7330` (`paymentTruth`) y `lib/payment-labels.ts:27-143`.
- `sale-result.tsx:18-46` reimplementa `cashPaidCents`, `isDemo`, `isCreditOnly` y copy.
- `payment-panel.tsx:221-238` define su propio `statusLabel`.
- `ventas/page.tsx:166-191` define otro `statusLabel` y `methodLabel`.
**Impacto:** tres definiciones de «pagado», «demo» y «fiado». Ya hay contradicciones (H-03/H-04).
**Acción:** B0 `payment-truth.ts` + `status`/`method` desde `payment-labels`; prohibir `statusLabel` locales.

### H-03 — ALTO — `SaleResult` cuenta el digital como efectivo

**Evidencia:** `sale-result.tsx:18` calcula `cashPaidCents = max(0, paidCents - digitalPaidCents)`, pero en la lista de hechos (`67-73`) muestra `order.paidCents` bajo «Efectivo recibido». Si una venta es $40 efectivo + $60 digital, `paidCents=100`, `digitalPaidCents=60`; la pantalla dice «Efectivo recibido $100».
**Impacto:** cifra falsa en el resultado; viola la separación efectivo/digital.
**Acción:** usar `cashPaidCents`; mostrar digital por separado; tests de pago mixto.

### H-04 — ALTO — `status:"paid"` con fiado abierto se muestra como «Pagado»

**Evidencia:**
- `recalculateOrderTotals` marca `paid` si `paidCents + creditCents >= totalCents` (`lib/orders.ts:677-687`), aunque el fiado siga abierto.
- `ventas/page.tsx:166-175` devuelve «Pagado» antes de mirar `creditCents`.
- `sale-result.tsx:23-35` hace lo mismo («Pago confirmado por pey»).
- El `StatusBadge` legacy sí prioriza fiado abierto (`caja-app.tsx:7243-7263`).
**Impacto:** una venta con $40 de fiado y $60 digital aparece «Pagado» sin advertir la deuda.
**Acción:** la etiqueta debe priorizar `credit.status !== "settled"`/`balanceCents > 0`; mostrar «Fiado» o «Pago mixto con fiado».

### H-05 — ALTO — `/ventas` usa `order.creditCents` como deuda actual

**Evidencia:** `ventas/page.tsx:130-133` muestra «Fiado `order.creditCents`»; `SaleResult` `75-82` hace lo mismo. `creditCents` es el original (`lib/orders.ts:303-325`), no el saldo. El saldo vivo está en `Credit.balanceCents` (`types.ts:73-83`) y en `GET /api/orders/[id].credit`.
**Impacto:** un abono parcial no se refleja; el historial miente sobre lo que deben.
**Acción:** mostrar «Fiado original» si no se consulta el detalle, o cargar `credit.balanceCents`; nunca rotular como saldo actual.

### H-06 — ALTO — La Caja nueva pierde el cobro pendiente al refrescar

**Evidencia:** `caja-screen.tsx:56-69` guarda `order`/`view` solo en estado; no usa `pending-order` ni lee `GET /api/orders/[id]` al montar. La legacy sí: `caja-app.tsx:1070-1112` y `1159-1166`.
**Impacto:** si el usuario refresca o navega durante un cobro digital, el pedido queda en servidor pero la UI no lo reanuda; no hay aviso como «Continuar cobro».
**Acción:** persistir `{orderId, updatedAt}` al crear una orden con `due > 0`, restaurar al montar y ofrecer «Continuar cobro»/«Descartar aviso»; o declarar explícitamente que B no cubre reanudación y no bloquear la aceptación por ello (no recomendado).

### H-07 — ALTO — Dos borradores y dos llaves de idempotencia

**Evidencia:** `caja-app.tsx:105-112` vs `caja-screen.tsx:31-32`; no hay lectura/migración de v1 en v2. La nueva tampoco escribe `pending-order`.
**Impacto:** el borrador de `/` no se ve en `/caja`; dos pestañas pueden registrar dos ventas; un reintento en una pantalla no protege a la otra.
**Acción:** `sale-storage.ts` compartido, versión explícita, migración v1→v2 y, si es posible, lock cross-tab (`BroadcastChannel`/storage event). Si no se comparte, documentar que son borradores independientes.

### H-08 — ALTO — `/ventas` no tiene paginación real

**Evidencia:** `ventas/page.tsx:32` `listOrders(50, 0)`, `95-97` «Últimas 50» y total; no hay `offset`, `hasMore`, botón «Ver más» ni `GET /api/orders`.
**Impacto:** con más de 50 ventas, el historial no permite ver las anteriores; el título «Historial» promete más de lo que entrega.
**Acción:** server page con `searchParams.offset` + `Link`/`router.push`, o cliente con `GET /api/orders?limit=20&offset=` y manejo de ETag/304. No cargar todo.

### H-09 — MEDIO — `/ventas` importa `lib/db` directamente y duplica el read model

**Evidencia:** `ventas/page.tsx:15` importa `countOrders, listOrders` de `@/lib/db`; `29-33` hace `getDashboardData` + `listOrders` + `countOrders`. La API `GET /api/orders` existe y no tiene consumidor.
**Impacto:** tres caminos de lectura (dashboard, DB directo, API) y doble escaneo de órdenes. No toca el motor, pero acopla la página a la implementación SQLite.
**Acción:** usar un read model server (`lib/orders-read.ts`) o la API; si se usa DB, encapsular en `lib/` y no en la página.

### H-10 — MEDIO — Faltan cabeceras privadas en `/caja` y `/ventas`

**Evidencia:** `next.config.ts:88-94` define `privateHeaders`; `165-193` las aplica a APIs, `/pay/**` y `/`, pero no a `/caja` ni `/ventas`. Ambas páginas renderizan datos sensibles.
**Impacto:** riesgo de caché compartida si el default de Next cambia o un proxy cachea HTML.
**Acción:** agregar `{ source: "/caja", headers: privateHeaders }` y `{ source: "/ventas", headers: privateHeaders }`; verificar `Cache-Control` con `curl -I`.

### H-11 — MEDIO — Fechas de México resueltas en el servidor con zona local

**Evidencia:** `ventas/page.tsx:110` usa `formatActivityDate` en un server component; `lib/format.ts:65-81` usa `new Date()` y día local, sin `America/Mexico_City`. `lib/mexico-date.ts:1-19` existe justamente para evitarlo.
**Impacto:** «Hoy/Ayer» y la hora pueden desviarse si el servidor no corre en zona de México; pedidos cerca de medianoche caen en el día equivocado.
**Acción:** usar `mexicoDateKey`/helpers de `lib/mexico-date` o renderizar la fecha en cliente. Probar un pedido a las 23:59 y 00:01 de México.

### H-12 — MEDIO — «Volver a Caja» es un Link a la misma ruta

**Evidencia:** `sale-result.tsx:122-124` `<Link href="/caja">` dentro de `/caja`; el estado `view` es local y no se resetea al navegar a la misma URL.
**Impacto:** el botón puede no hacer nada; el usuario queda en el resultado y debe usar «Nueva venta».
**Acción:** reemplazar por `onNewSale` o un botón que limpie el estado; reservar `Link` para rutas distintas.

### H-13 — MEDIO — Targets de 44 px en la Caja/Historial nuevos

**Evidencia:** `caja.css:206-210` (`.mc-caja-icon-button` 44×44), `466-468` (`.mc-caja-clear` 44), `510-512` (restore 44); `ventas.css:204-211` (`summary` 44). El contrato HIG del proyecto exige 48 px.
**Impacto:** fallo de a11y/HIG en `/caja` y `/ventas`; los gates actuales no cubren estas rutas.
**Acción:** 48 px mínimo en botones/controles interactivos; axe + HIG sobre `/caja` y `/ventas`.

### H-14 — MEDIO — `CajaScreen` carga un dashboard completo para usar solo `merchant`

**Evidencia:** `app/caja/page.tsx:15` `getDashboardData({compactPending:true})`; `caja-screen.tsx:293` solo usa `initialDashboard.merchant`.
**Impacto:** consulta 30 órdenes, 50 pendientes y 100 créditos para una pantalla que no los muestra; costo innecesario.
**Acción:** pasar solo `merchant`/`demoMode` o mostrar el resumen si se va a usar. Si se usa el dashboard, no duplicar fetch.

### H-15 — MEDIO — Mensajes/labels de estado divergentes

**Evidencia:** `payment-panel.tsx:221-238` («Demo pagado», «Pendiente»), `sale-result.tsx:134-153` («Pagado», «Registrado»), `ventas/page.tsx:166-175` («Demo», «Pagado»), vs `payment-labels.ts:118-143` («Pago demo (simulado)», «Esperando confirmación»).
**Impacto:** el mismo pedido se lee distinto según la pantalla; viola la regla de una sola verdad visible.
**Acción:** importar `orderStatusCopy`/`PAYMENT_STATES`; un solo helper de presentación.

### H-16 — BAJO — `formatLongDate()` en componente cliente puede hydration-mismatch

**Evidencia:** `caja-screen.tsx:318` llama `formatLongDate()` durante render SSR y cliente. La legacy calcula `today` después del montaje (`caja-app.tsx:912-915`).
**Impacto:** cerca de medianoche o con distinta zona servidor/cliente, el texto cambia entre HTML y hidratación.
**Acción:** pasar la fecha desde el server page o calcularla en `useEffect`.

### H-17 — BAJO — `paymentMethod` del POST se acepta pero se ignora

**Evidencia:** `app/api/orders/route.ts:46` admite `paymentMethod`; `lib/orders.ts:99-361` no lo lee; el INSERT inicial usa `cashCents > 0 ? "cash" : null` (`234-255`).
**Impacto:** un cliente nuevo puede creer que enviar `paymentMethod:"codi"` deja la orden en CoDi; no ocurre.
**Acción:** no enviarlo o documentarlo; el método se deriva de los pagos (`recalculateOrderTotals`, `659-667`).

### H-18 — INFORMATIVO — `p0-venta` no cubre `/caja`

**Evidencia:** `web/scripts/p0-venta-e2e.py:113` navega a `BASE` (`/`). Los selectores son `#sale-text`, `#draft-*`, `#cash-received`, `#fiado-*` (legacy), no los `mc-caja-*` nuevos.
**Impacto:** un `p0-venta 66/0` verde no prueba la pantalla nueva.
**Acción:** agregar un E2E de `/caja` o extender el gate con un segundo `goto("/caja")` y selectores nuevos; no declarar B por el gate legacy.

---

## 7. Riesgos de usar los mismos endpoints en una pantalla nueva

### 7.1 Riesgos de dominio

| ID | Riesgo | Por qué | Mitigación |
|---|---|---|---|
| R-01 | Marcar pagado desde el cliente | El botón o `paidCents` no son prueba; solo webhook/demo server. | Mostrar `status` + `lastPaymentProvider`/`lastPaymentDemo`; nunca escribir `paid`. |
| R-02 | Efectivo inflado | `paidCents` incluye digital/demo. | `cashPaidCents = max(0, paidCents - digitalPaidCents)`. |
| R-03 | Fiado tratado como dinero | `creditCents` es deuda original. | Etiquetar «Fiado» y usar `Credit.balanceCents` para saldo. |
| R-04 | Fiado con `status paid` | Cobertura incluye crédito. | Priorizar crédito abierto en la etiqueta. |
| R-05 | Demo cash como real | `lastPaymentDemo` no marca cash demo. | Pasar `demoMode` a la pantalla de resultado/historial y etiquetar demo; no usar solo `status`. |
| R-06 | Entrega prematura | `paidCents` no implica cubierto/entregable. | Usar `canDeliver` server (PATCH) y no ofrecer el botón si hay fiado abierto o demo. |
| R-07 | Doble venta | Dos claves de request o dos pestañas. | Storage compartido + lock; probar doble click y dos tabs. |
| R-08 | Reintento crea otra venta | Request id no persistido o se borra antes de confirmar. | Persistir key+signature antes del POST; borrar solo tras 201/orden confirmada. |
| R-09 | Venta perdida al refrescar | `order` solo en memoria. | Persistir `pending-order` y restaurar. |
| R-10 | Saldo viejo en fiado | El abono en otra pestaña cambia `Credit.balanceCents`. | Usar `expectedBalanceCents`/409; refrescar detalle. |
| R-11 | Historial incompleto | `GET /api/orders` solo 200 por página; `/ventas` solo 50. | Paginación real; no mostrar «total» sin acceso. |
| R-12 | Resumen de hoy como historial | `summary` es del día México. | Etiquetar «Hoy»; no sumar páginas históricas. |
| R-13 | Duplicados dashboard | `orders` y `pendingOrders` se solapan. | Deduplicar por `id` o usar `compactPending` server. |
| R-14 | Caché vieja | `max-age=5/10` y ETag; mutaciones no invalidan el navegador. | `cache:"no-store"` tras mutación; manejar 304. |
| R-15 | Verificación interpretada como pago | `/api/verify` solo lee. | No transicionar; mostrar `verified:false` demo. |
| R-16 | Rate limit | 30/min pay, 60/min create/verify. | No reintentar en bucle; mensajes claros. |
| R-17 | Error 409 genérico | `request_id_conflict`, `credit_open`, `demo_not_deliverable`, `num_ref_exhausted`. | Mostrar `error`/`code` del servidor; no inventar. |

### 7.2 Riesgos de presentación que sí se pueden duplicar

- Layout del composer, columnas, breakpoints, tipografía, colores.
- Campos controlados y máscaras de dinero (si comparten parse/format).
- Estados de carga/disabled y copy no financiero.
- Resultado visual (icono, título) si el texto y los montos vienen de `paymentTruth`/`PAYMENT_STATES`.
- Historial visual (filas, `details`) si las etiquetas y saldos vienen de helpers compartidos.

### 7.3 Reglas que deben quedar solo en `lib/` o API

- Validación/clamp de `items`, `cashCents`, `creditCents`, `customerName`, `requestId`.
- Transiciones de estado (`confirmed`, `payment_pending`, `paid`, `demo_paid`, `fulfilled`).
- `recordPayment`/`recalculateOrderTotals`/`healOrderFromPayments`.
- `recordCreditPayment` y `expectedBalanceCents`.
- `fulfillOrder` y elegibilidad de entrega.
- `getDashboardData`, `getOrderDetail`, `listOrders`, `getDailySummary`.
- `getCashStatus`, `previewCashClose`, `closeCash`.
- `getReconciliationReport`.
- `verify`/`getPeyTransaction`.
- Idempotencia y hashes (`requestPayloadHash`).
- Modo demo/real (`isDemoMode`, filtros de `db.ts`).
- Cabeceras de caché y rate limits.

---

## 8. Criterios de aceptación verificables para Oleada B

> **Regla:** B no se declara cerrada por una captura ni por `p0-venta` legacy. Cada AC debe tener evidencia reproducible.

### 8.1 Funcionales

| ID | Criterio | Verificación |
|---|---|---|
| **AC-B01** | `/caja` responde 200, renderiza `CajaScreen` con `AppShell` y `activeHref="/caja"`; no hay 404. | `curl -sI http://localhost:3000/caja` 200; Playwright `goto("/caja")`; `aria-current="page"` en nav Caja. |
| **AC-B02** | Venta en efectivo: 2 líneas, efectivo exacto y con cambio; una sola orden; estado `paid`; `cashCents` correcto; cambio visible. | E2E `/caja`: agregar líneas, método Efectivo, confirmar; `GET /api/orders/[id]` y DB; verificar cambio. |
| **AC-B03** | Venta digital: crea orden con `due>0`, genera link y QR, estado `payment_pending`; no se marca pagada; en demo `POST /api/demo/pay` deja `demo_paid`; en real solo webhook. | E2E + `POST /api/orders/[id]/pay` dos veces (idempotente); demo pay; `p0-dinero`/`webhook`. |
| **AC-B04** | Fiado: exige nombre; monto ≤ total; estado `confirmed` (no `paid`); aparece en `/fiados`/dashboard; saldo vivo en `Credit.balanceCents`. | E2E fiado puro y mixto; `GET /api/orders/[id]` → `credit.balanceCents`; `GET /api/dashboard`. |
| **AC-B05** | Resultado separa efectivo, digital y fiado; no cuenta digital como efectivo; demo nunca dice «Pagado»; `status paid` con fiado abierto se muestra como fiado/mixto. | Casos: cash, digital, fiado, mixto, demo cash, paid+fiado. Revisar `SaleResult` y `/ventas`. |
| **AC-B06** | `/ventas` muestra historial real, orden descendente, estados verdaderos, demo etiquetado, fiado como original/saldo, y permite ver más de 50. | Crear 51+ órdenes; `?offset` o cliente; verificar fila 51; no `Cobrado` para demo. |
| **AC-B07** | Navegación: `/inicio` «Registrar» → `/caja`; «Ir a ventas» → `/ventas`; nav activa; `/ventas` ya no redirige; aliases `/fiados`, `/corte`, `/metas`, `/pendientes` siguen 307. | Playwright + `curl -I`; back/forward. |
| **AC-B08** | Borrador: refrescar `/caja` restaura líneas/método/cliente; «Limpiar» borra; pedido pendiente se reanuda o se avisa; doble click y reintento no duplican. | E2E: reload; doble click con POST lento; retry tras timeout; dos pestañas. |
| **AC-B09** | Errores: 400 de validación, 409 de idempotencia/saldo, 403 demo disabled, 404 order; se muestra mensaje del servidor, no se pierde el borrador. | Interceptar respuestas; revisar `role="alert"`. |
| **AC-B10** | A11y/responsive: 1448/1366/390/320, 200%, alto contraste, teclado, axe 0; targets ≥48 px; sin overflow. | `npx playwright`/scripts; axe; HIG; `mobile-320`. |
| **AC-B11** | Motor financiero intacto: sin cambios en `lib/orders.ts`, `lib/db.ts` (salvo lectura encapsulada), `lib/cash.ts`, `lib/pey*`, `lib/payment-rules.ts`, `lib/checkout.ts`, `app/api/**`, `app/pay/**`. | `git diff --name-only 26c7741..HEAD`; si hay cambios, ADR + p0. |
| **AC-B12** | Evidencia: `verify:fast`, `verify:static`, `verify:full` aplicable, `verify:evidence` PASS contra HEAD limpio; `p0-venta` legacy + E2E `/caja`; `webhook 40/40`; `checkout 19/19`; `p0-dinero`; `p0-fiado`; `p0-corte`. | Comandos de §8.3; `latest.json`/`latest-static.json` con `gitAtStart.dirty:false`. |

### 8.2 Escenarios mínimos de `/caja`

1. **Vacío:** sin líneas, total $0, confirmar deshabilitado; foco en «Agregar concepto».
2. **Efectivo exacto:** 2 × $35 + 1 × $20 = $90; efectivo $90; resultado «Venta cobrada en efectivo»; cambio $0.
3. **Efectivo con cambio:** total $90, efectivo $100; resultado cambio $10; orden guarda cash $90.
4. **Digital:** total $90, método Digital; orden `confirmed`; generar link; `payment_pending`; generar QR idempotente; no `paid`.
5. **Demo digital:** en demo, simular CoDi; `demo_paid`; resultado «Pago demo (simulado)»; no entregable.
6. **Fiado puro:** total $90, fiado $90, cliente «Juan»; `confirmed`; no `paid`; `/ventas` muestra fiado; `/fiados` lo lista.
7. **Mixto:** efectivo $40 + fiado $20 + digital $30; resultado separa; deuda $20; digital pendiente $30; no doble conteo.
8. **Fiado + digital pagado:** total $100, fiado $40, digital $60; estado `paid`; la UI debe seguir mostrando fiado abierto, no solo «Pagado».
9. **Refresco en cobro:** recargar `/caja` con link generado; debe reanudar o avisar; no perder.
10. **Doble submit:** POST lento, doble click; una sola orden; `requestId` repetido.
11. **Historial:** 51 órdenes; ver la 51; demo etiquetado; fiado no es «Cobrado».
12. **Navegación:** `/inicio` → Caja; Caja → Ventas; Atrás; `/caja` → Fiados (sale a legacy, documentado).

### 8.3 Gates y evidencia

Desde `web/`:

```bash
npm run verify:fast
npm run verify:static
npm run test:contracts
npm run test:harness
```

Antes del cierre runtime:

```bash
npm run build
npm run verify:full
npm run verify:evidence
```

Gates de dominio relevantes (según `harness/EVALS.md`):

- `p0-venta` (`66 PASS / 0 FAIL / 0 KNOWN`) — **solo legacy `/`**; agregar E2E `/caja`.
- `p0-fiado` (`51/0/0`).
- `p0-corte` (`69/0/0`).
- `p0-integracion` (`51/0/0`).
- `p0-dinero` (`45/0/3 KNOWN`).
- `webhook` (`40/40`).
- `checkout` (`19/19`).
- `mobile-320` (`60 PASS / 0 FAIL`).
- `hig` (`5 viewports`), `contrast` (`7 PASS / 0 FAIL`), `motion` (`19 PASS / 0 FAIL`).
- `security`, `data` (`DATOS OK`), `perf`.

**No declarar B cerrada si:**

1. `/caja` o `/ventas` solo existe en WIP sin commit.
2. `verify:evidence` tiene `dirty:true` o SHA distinto.
3. El resultado usa `paidCents` como efectivo.
4. `status:"paid"` con fiado abierto se pinta «Pagado».
5. `demo_paid` o demo cash se pinta «Pagado»/«Cobrado».
6. El cobro pendiente se pierde al refrescar sin aviso.
7. El historial no pasa de 50 o no distingue fiado/demo.
8. Se duplica `paymentTruth`/`statusLabel` en otra pantalla.
9. No hay axe/HIG en `/caja`/`/ventas`.
10. `p0-venta` legacy es la única prueba de la Caja nueva.

---

## 9. Bloqueos y orden de desbloqueo

| ID | Bloqueo | Severidad | Desbloquea | ¿Bloquea B? |
|---|---|---|---|---|
| B-01 | Árbol sucio/WIP no confirmado | Crítica | Evidencia y merge | Sí |
| B-02 | Verdad de pago duplicada | Alta | Resultado/historial correctos | Sí |
| B-03 | Fiado original vs saldo vivo | Alta | Historial y resultado | Sí |
| B-04 | Pedido pendiente no persistido | Alta | Reanudación de cobro | Sí (si B promete cobro digital) |
| B-05 | Draft/request keys divergentes | Alta | Continuidad `/` ↔ `/caja` | Sí |
| B-06 | `/ventas` sin paginación | Media | Historial real | Sí |
| B-07 | Falta `Cache-Control` privado | Media | Privacidad | Sí (verificar) |
| B-08 | Shell mixto (Caja nueva ↔ aliases legacy) | Media | Navegación honesta | No para B; sí para C |
| B-09 | Fechas de México en server | Media | Historial correcto | Sí (verificar) |
| B-10 | Targets 44 px | Media | HIG/a11y | Sí |
| B-11 | `p0-venta` no cubre `/caja` | Alta | Evidencia de la pantalla nueva | Sí |
| B-12 | `paymentMethod` ignorado | Baja | Contrato claro | No; documentar |

### Orden recomendado

1. **Congelar** el WIP actual y decidir si se conserva; si no, volver a `26c7741` limpio.
2. **B0:** extraer `payment-truth`, `money`, `sale-storage`; un solo escritor de `caja-app.tsx`; `verify:fast` + `p0-venta`.
3. **B1:** corregir `/caja` para consumir la verdad compartida; corregir `SaleResult` (efectivo/digital/fiado/demo); agregar persistencia de pendiente.
4. **B2:** corregir `/ventas` (estados, saldo, paginación, fechas); agregar `Cache-Control` privado.
5. **B3:** a11y/responsive y E2E `/caja`; correr `verify:static` y `verify:full`; evidencia.
6. **C:** migrar `/fiados`, `/corte`, `/metas`, `/pendientes` y retirar `/?tab=*` cuando URL/estado estén resueltos.

---

## 10. Conclusión

La Oleada B no necesita reescribir el motor financiero ni duplicar la Caja legacy. Necesita **una sola verdad de presentación** y **un solo almacenamiento de venta**, y luego dos pantallas delgadas:

- `/caja`: composer + cobro + resultado, consumiendo `POST /api/orders`, `POST /api/orders/[id]/pay`, `POST /api/demo/pay`, `GET /api/orders/[id]`.
- `/ventas`: historial paginado, consumiendo `GET /api/orders` o un read model server, con estados derivados de `paymentTruth` y saldos de `Credit`.

El snapshot actual demuestra que la dirección es correcta, pero también que copiar la presentación sin compartir la verdad produce exactamente los errores que el dominio quiere evitar: efectivo inflado, fiado tratado como cobrado, demo tratado como pagado y cobros que desaparecen al refrescar. Corregir eso es más barato ahora que después de conectar los tabs legacy.

**Veredicto:** **NO-GO para cierre de B** en el snapshot. **GO condicionado** para continuar si se ejecuta B0 y se corrigen H-02 a H-07 antes de la evidencia.

---

## Apéndice A — Comandos y evidencia usados

- `git rev-parse HEAD`, `git status --porcelain=v1`, `git diff --stat`, `git hash-object`, `git rev-parse HEAD:web/src/components/caja-app.tsx`.
- `Get-ChildItem -Recurse` para rutas y archivos; `Select-String`/`rg` para componentes, props, `fetch`, `useState`, `useEffect`, `href`, `id`.
- Lectura completa de `web/src/components/caja-app.tsx` por secciones; lectura de APIs, `lib/orders.ts`, `lib/db.ts` (funciones de lectura), `lib/dashboard.ts`, `lib/types.ts`, `lib/checkout.ts`, `lib/payment-labels.ts`, `lib/format.ts`, `lib/mexico-date.ts`, `next.config.ts`, `proxy.ts`, `app/page.tsx`, `app/inicio/page.tsx`, `app/pay/**`, aliases y WIP de `components/caja/**`.
- `npm run verify:list` (solo lectura) para el catálogo de gates.
- No se ejecutaron `build`, `dev`, tests ni gates con escritura; no se modificó código.
- **Único archivo escrito por esta auditoría:** este informe.

## Apéndice B — Archivos WIP observados

| Archivo | Líneas | Rol |
|---|---:|---|
| `web/src/components/caja/types.ts` | 43 | `DraftLine`, `PaymentChoice`, parseo de dinero/cantidad, totales. |
| `web/src/components/caja/sale-line-items.tsx` | 188 | Editor de líneas. |
| `web/src/components/caja/sale-summary.tsx` | 191 | Método de pago, efectivo, fiado, cliente, confirmar. |
| `web/src/components/caja/payment-panel.tsx` | 238 | Link/QR/demo/polling. |
| `web/src/components/caja/sale-result.tsx` | 153 | Resultado. |
| `web/src/components/caja/caja-screen.tsx` | 429 | Orquestador de `/caja`. |
| `web/src/components/caja/caja.css` | 915 | Estilos de Caja. |
| `web/src/app/caja/page.tsx` | 17 | Página `/caja`. |
| `web/src/app/ventas/page.tsx` | 192 | Página `/ventas`. |
| `web/src/app/ventas/ventas.css` | 270 | Estilos de historial. |

Estos archivos no están en `HEAD`; cualquier afirmación sobre ellos es del snapshot, no de la base `26c7741`.
