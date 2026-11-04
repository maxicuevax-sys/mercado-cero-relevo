# Auditoría de repositorio — Oleada A (fundación)

> **Modo:** solo lectura. No se modificó código, no se hizo commit y no se ejecutaron gates que escriban artefactos.
> **Repo:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero`
> **Rama:** `design/oleada-a-fundacion`
> **HEAD:** `62c3fed6874bc500db16b4a9260fb62cf9626453`
> **Tag base:** `fase-1-handoff` → apunta al mismo commit `62c3fed` (no hay commits de Oleada A todavía).
> **Árbol:** limpio (`git status --porcelain` vacío).
> **Fecha de auditoría:** 2026-11-03 (entorno local).
> **Alcance:** inventario real, contratos de `caja-app.tsx`, puntos de extracción, compatibilidad de rutas, propiedad de archivos, staging de fuentes y matriz de aceptación.

## 0. Veredicto ejecutivo

**Oleada A puede iniciar como fundación de presentación, pero solo de forma condicionada.**

No hay base para:

- crear rutas independientes `/ventas`, `/caja`, `/fiados`, `/corte`, `/metas`, `/pendientes` como pantallas reales;
- dividir los tabs de Caja en rutas;
- extraer masivamente `caja-app.tsx` en paralelo;
- declarar una sola pantalla como “migrada”;
- declarar handoff público GO.

La base sí permite:

- congelar contratos y crear tipos/helpers compartidos sin cambiar comportamiento;
- extraer primitivas presentacionales (`Sheet`, `Toast`, `QrImage`, `StatusBadge`);
- extraer paneles controlados por props sin mover estado ni fetch de mutaciones;
- preparar un shell compartido y un contrato único de navegación;
- agregar alias de ruta **solo como redirecciones** a `/?tab=...`, sin duplicar lógica;
- integrar Hearth/Alder como canary tipográfico, sin reemplazar todavía las fuentes globales.

### 0.1 Hallazgos clave

| ID | Severidad | Hallazgo | Evidencia | Impacto en Oleada A |
|---|---|---|---|---|
| H-01 | Alta | `caja-app.tsx` es un monolito de 8,228 líneas con 107 `useState`, 33 `useEffect`, 51 `useCallback`, 39 `useRef` y 20 `fetch`. | `web/src/components/caja-app.tsx` | Cualquier carril que lo edite colisiona. Exige un solo escritor y extracción secuencial. |
| H-02 | Alta | La URL no refleja el tab activo: `selectTab` solo hace `setTab`, no `history` ni `router`. `initialTab` solo inicializa el estado. | `caja-app.tsx:677-681`, `1230-1245`; `page.tsx:22-31` | Las rutas nuevas serían cosméticas. Back/forward y deep links posteriores no funcionan. |
| H-03 | Alta | `/caja` es ambiguo: `/?tab=caja` es la pantalla de venta, pero `/inicio` usa “Caja” para `/?tab=corte`. | `inicio/page.tsx:52-66`; `caja-app.tsx:87`, `7370-7382` | No se puede activar `/caja` sin decisión de producto. |
| H-04 | Alta | Hay tres capas de tokens/shell: `globals.css` (`@theme`), `barrio.css` (dice que sus reglas mandan) e `inicio.css` (declara no importar tokens globales). | `globals.css:3-47`; `barrio.css:1-4`; `inicio/inicio.css:1-2` | “Una sola fuente de tokens” no es cierta hoy; A debe decidir el orden de migración. |
| H-05 | Alta | La evidencia full de HEAD es 21/23: fallan `tunnel` y `preflight`; `latest.json` sigue siendo de `9206ea1` (aunque diga `ok:true`) y no vale para HEAD. | `harness/evidence/runs/2026-11-04T04-37-25-913Z-full.json`; `harness/evidence/latest.json` | A puede trabajar, pero el handoff público sigue NO-GO. |
| H-06 | Media | La navegación tiene cuatro fuentes de verdad: `Tab` en Caja, `HomeTab` en `/`, `TABS` en Caja y `nav` en Inicio. | `caja-app.tsx:87`, `7360-7382`; `page.tsx:9-11`; `inicio/page.tsx:50-67` | Deriva de labels/rutas: “Ventas” abre Caja, “Caja” y “Reportes” comparten destino, `meta` vs `metas`. |
| H-07 | Media | `Sheet` inerta `.app-shell`; `CajaApp` mide `.topbar` y `.mobile-tabs` para `--mc-chrome-*`. | `caja-app.tsx:7623-7624`, `1263-1274` | Extraer el shell sin preservar clases/medición rompe foco, scroll y sheets. |
| H-08 | Media | El estado de venta, cobro, corte y tareas vive en `CajaApp`; los tabs ocultos se montan con `visitedTabs` y se remontan con keys. | `caja-app.tsx:677-742`, `105-137`, `2805-2838` | Un split de rutas pierde borrador, conteo no guardado o polling si no se mueve el estado a un layout/contexto. |
| H-09 | Media | Hearth/Alder no están integradas: `layout.tsx` sigue con Fraunces/Inter y no hay referencias a Hearth/Alder en `web/src`. | `layout.tsx:3-23`; `rg` sin resultados | El entregable tipográfico de A no existe aún; el staging es local y no viaja con la rama. |
| H-10 | Baja | `CajaPanel` recibe `onToggleText` y `showTextInput`, pero no los destructura ni los usa. | `caja-app.tsx:2647`, `2671-2672`, `3270`, `3289-3290`, `3326` | No copiar interfaz muerta al extraer; decidir si el toggle se restaura o se elimina. |
| H-11 | Baja | `inicio.css` define su propia paleta `--inicio-*` y no consume `@theme`. | `inicio/inicio.css:3-16` | Dos lenguajes visuales; la fundación no puede declarar tokens únicos sin alias. |
| H-12 | Baja | El script inline de `layout.tsx` activa alto contraste forzado solo si `location.pathname === '/inicio'`. | `layout.tsx:64-68` | Rutas nuevas que no sean `/inicio` no heredan ese comportamiento; hay que revisarlo al abrir rutas. |

### 0.2 Lo que sí puede hacer Oleada A

1. Crear un contrato único de tabs/rutas/labels y tipos compartidos, sin cambiar comportamiento.
2. Extraer `Sheet`, `Toast`, `QrImage`, `StatusBadge` y `OrderCreditNote` con props actuales.
3. Extraer `CreditList` y `HelpContent` como componentes presentacionales.
4. Preparar `AppShell`, `Sidebar`, `MobileNav` y `TopBar` con un solo escritor sobre `caja-app.tsx`.
5. Integrar Hearth/Alder como tokens nuevos en modo canary (sin reemplazar `--font-sans`/`--font-display` todavía).
6. Agregar alias de ruta redirect-only, si producto aprueba la tabla de la sección 5.
7. Medir y congelar baseline visual de `/inicio`, Caja, Fiado, Corte, Meta, Pendientes y checkout.

### 0.3 Lo que no puede hacer Oleada A

- Reescribir `caja-app.tsx` completo.
- Mover el estado de venta/cobro/corte a rutas separadas.
- Declarar “migrada” una pantalla que siga renderizada por el monolito.
- Duplicar `paymentTruth`, `creditForOrder`, `isCreditSettled` o la lógica de cada panel.
- Tocar `db.ts`, `orders.ts`, `cash.ts`, `goals.ts`, `tasks.ts`, `payment-labels.ts`, `payment-rules.ts`, `checkout.ts`, `pey*`, `api/**` financiero o `pay/**` sin dueño explícito y pruebas.
- Declarar GO de handoff con `latest.json` viejo o con `tunnel`/`preflight` fallando.

## 1. Base verificada

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Rama actual | `design/oleada-a-fundacion` | `git branch --show-current` |
| HEAD | `62c3fed6874bc500db16b4a9260fb62cf9626453` | `git rev-parse HEAD` |
| Tag `fase-1-handoff` | Mismo commit `62c3fed` | `git rev-parse fase-1-handoff` |
| Commits de A sobre el tag | Ninguno | `git log --oneline fase-1-handoff..HEAD` vacío |
| Árbol de trabajo | Limpio | `git status --porcelain` vacío |
| Static | 5/5, `ok:true`, `buildMatches:true`, `dirty:false` | `harness/evidence/latest-static.json` y run `2026-11-04T04-35-43-123Z-static.json` |
| Full sobre HEAD | 21/23; fallan `tunnel` y `preflight` | `harness/evidence/runs/2026-11-04T04-37-25-913Z-full.json` |
| Full publicado en `latest.json` | Viejo: SHA `9206ea1`, no corresponde a HEAD | `harness/evidence/latest.json` |
| Estado documentado | `harness/STATE.md` aún dice rama `design/mercado-cero-v2` y “Oleada A no iniciada” | `harness/STATE.md:3-21` |

**Lectura correcta:** la base de código está limpia y el tag coincide con HEAD, pero la evidencia full de HEAD no está consolidada en `latest.json`. El handoff público sigue **NO-GO**; Oleada A puede trabajar en local, no declarar release.

> Nota de evidencia: el run static de HEAD también trae `branch: design/mercado-cero-v2` (etiqueta vieja, previa al renombre). El SHA sí es `62c3fed`, `dirty:false` y `buildMatches:true`; la etiqueta de rama no invalida el SHA, pero la documentación debe actualizarse.

## 2. Inventario real de rutas y componentes

### 2.1 Rutas de página reales

Solo hay **4 rutas de página** (`page.tsx`) y **24 route handlers** de API.

| Ruta | Archivo | Líneas | Implementación / datos | Notas |
|---|---|---:|---|---|
| `/` | `web/src/app/page.tsx` | 35 | `CajaApp` con `initialDashboard=getDashboardData({compactPending:true})`, `initialDemoMode`, `initialTab`, `initialHelpOpen` | Default `tab=caja`; solo acepta `caja, fiado, corte, meta, pendientes`; `ayuda=1` abre ayuda. |
| `/inicio` | `web/src/app/inicio/page.tsx` | 367 | Dashboard de solo lectura; `getDashboardData`, `listGoals`, `listTasks`, `isDemoMode`; shell y CSS propios | No usa componentes de Caja. Tiene su propio sidebar/topbar y su propia paleta. |
| `/pay/[id]` | `web/src/app/pay/[id]/page.tsx` + `checkout-client.tsx` | 29 + 610 | SSR `getCheckoutData(id)`; `notFound()` si no existe; cliente con polling y demo pay | Contrato público legacy; no tocar en A. |
| `/pay/[id]/success` | `web/src/app/pay/[id]/success/page.tsx` + `success-client.tsx` | 53 + 481 | SSR `getCheckoutData(id)`; `Suspense`; estados pendiente/verificado/demo/efectivo | No hace `notFound()`; la ausencia se resuelve en cliente. |

Archivos auxiliares del checkout: `checkout-skeleton.tsx` (63 líneas), `not-found.tsx` (39 líneas). El `not-found` enlaza “Volver” a `/`.

**No existen** directorios de página para `/ventas`, `/caja`, `/fiados`, `/corte`, `/metas`, `/pendientes`, `/productos`, `/proveedores`, `/reportes`, `/ayuda`, `/ajustes` ni `/onboarding` (verificado con `Test-Path`).

### 2.2 Tabs reales de Caja

| Tab | Render | Montaje | Componentes principales |
|---|---|---|---|
| `caja` | `caja-app.tsx:2482-2744` | Siempre montado (`div hidden={tab !== "caja"}`) | `CajaPanel` (`2641`), `CajaBook` (`2690`), `PendingPayments` (`2716`), `ActivityList` (`2727`) |
| `fiado` | `2745-2790` | Solo tras `visitedTabs.has("fiado")` | `CreditList` (`2771`), aviso `creditPayNotice` (`2754`) |
| `corte` | `2791-2819` | Solo tras `visitedTabs.has("corte")` | `ClosingChecklist` (`2799`), `CashCloseCard` (`2805`), `BusinessOverview` (`2810`), `ReconcileCard` (`2815`) |
| `meta` | `2820-2833` | Solo tras `visitedTabs.has("meta")` | `GoalCard` (`2829`) |
| `pendientes` | `2834-2842` | Solo tras `visitedTabs.has("pendientes")` | `PendingTasksPanel` (`2836`) |

Overlays fuera de los tabs: `CreditPaySheet` (`2860`), `PaymentPanel` dentro de `Sheet` (`2894`), `PaidSheet` (`2945`), `HelpContent` (`2964`), `VerifyCard` (`2982`), `DemoContent` (`3002`), `Toast` (`3011`).

**Consecuencia:** el tab `caja` siempre está montado; los demás se montan de forma perezosa. Un split de rutas cambiaría el ciclo de vida, el scroll guardado (`scrollPositions`), el foco de encabezados y el estado de los paneles. No es un cambio de “solo routing”.

### 2.3 Componentes ya extraídos fuera del monolito

| Archivo | Líneas | Rol | Props/contrato | Fetch propio |
|---|---:|---|---|---|
| `components/pending-tasks.tsx` | 1,168 | Bandeja de tareas completa | `apiBase`, `headingId`, `onTasksChange`, `active` (`183-201`) | `/api/tasks`, `/api/tasks/[id]` |
| `components/closing-checklist.tsx` | 661 | Checklist “antes de cerrar” | `active`, `pendingOrders`, `onOpenOrder`, `onGoToTasks` (`50-58`) | `/api/tasks?limit=200`, PATCH tarea |
| `components/pending-payments.tsx` | 267 | Cobros pendientes | `orders`, `totalCount`, `totalCents`, `lastCheckedAt`, `error`, `onOpen`, `onRetry` (`73-88`) | No; el padre provee |
| `components/companion-preferences.tsx` | 220 | Preferencias de acompañamiento | Sin props; localStorage | No |
| `components/animated-amount.tsx` | 51 | Monto animado | `cents`, clase | No |
| `components/screen-heading.tsx` | 45 | Encabezado de pantalla | `title`, `headingId`, `subtitle`, `action`, `compactSubtitle` | No |

`PendingTasksPanel` es el **modelo de extracción** que ya funcionó: API base inyectable, `headingId`, callback de cambios y `active` para carga perezosa. Se debe replicar ese patrón, no inventar un contexto global.

### 2.4 APIs reales (24 route handlers)

| Grupo | Rutas |
|---|---|
| Lectura | `GET /api/dashboard`, `GET /api/analytics`, `GET /api/credits`, `GET /api/orders`, `GET /api/cash`, `GET /api/reconcile` |
| Ventas/pagos | `POST /api/orders`, `GET/PATCH /api/orders/[id]`, `POST /api/orders/[id]/pay`, `POST /api/demo/pay`, `POST /api/demo/reset` |
| Fiado | `POST /api/credits/[id]/pay` |
| Corte | `GET /api/cash`, `POST /api/cash/preview`, `POST /api/cash/close` |
| Metas | `GET/POST /api/goals`, `POST /api/goals/[id]/contribute` |
| Pendientes | `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/[id]` |
| Verificación/checkout | `GET /api/verify`, `GET /api/checkout/[id]` |
| Voz/audio | `POST /api/voice/parse`, `POST /api/voice/transcribe`, `POST /api/tts` |
| Webhook/salud | `POST /api/webhooks/pey`, `GET /api/health` |

No todas las APIs tienen consumidor directo en la UI actual: por ejemplo, `GET /api/credits` existe, pero `CajaApp` lee fiados desde `/api/dashboard`. La extracción no debe introducir fetch nuevos “porque la API existe”.

## 3. Mapa de contratos de `caja-app.tsx`

### 3.1 Estado y servicios del orquestador

`CajaApp` (`caja-app.tsx:657`) concentra:

- **Datos del negocio:** `dashboard`, `loading`, `dashboardError`, `retryingDashboard`, `pendingCheckedAt`, `today`, `demoMode` derivado, `merchant` (`668-675`, `823-890`, `2368-2382`).
- **Navegación:** `tab`, `visitedTabs`, `tabWipe`, `scrollPositions`, `selectTab`, medición de chrome (`677-681`, `1230-1281`).
- **Borrador de venta:** `draftItems`, `cashCents`, `creditCents`, `cashInput`, `creditInput`, `customerName`, `itemErrors`, `restoredDraftAt`, `draftReady`, `savingOrder`, `saleError`, locks y storage (`698-709`, `405-635`, `1768-2002`).
- **Cobro activo:** `activeOrder`, `resumableOrder`, `lastChange`, `paymentLoading`, `paymentMode`, `paidOverlay`, `delivering`, `deliverError`, polling (`711-719`, `2003-2113`, `2297-2333`).
- **Abono de fiado:** `creditPayId`, monto, método, nota, requestId, errores, candado (`726-739`, `1533-1554`, `2155-2296`).
- **Verificación:** `verifyId`, `verifyResult`, `verifying`, `verifyError` (`722-724`, `2114-2154`).
- **Voz/preferencias:** grabación, transcripción, texto, mute, tamaño, contraste, velocidad, TTS (`686-696`, `1206-1450`).
- **Overlays y demo:** `helpOpen`, `verifyOpen`, `demoOpen`, `resetDemo` (`683-685`, `2334-2364`).

Persistencia local que no se debe perder:

- `mercado-cero:draft:v1` (`105-112`, `405-455`)
- `mercado-cero:pending-order:v1` (`107`, `455-512`)
- `mercado-cero:sale-request:v1` (`111`, `513-573`)
- Preferencias: `mercado-cero:muted`, `:text-size`, `:contrast`, `:voice-rate` (`912-930`, `1171-1225`)

### 3.2 Contratos por componente

Líneas y props verificadas en el archivo actual.

| Componente | Líneas | Props | Fetch directo | Helpers/tipos compartidos | Riesgo de extracción |
|---|---:|---:|---|---|---|
| `CajaBook` | 3021-3263 | 13 | No | `PAYMENT_STATES`, `AnimatedAmount`, `formatMxn`, `countText`, `greetingName`, assets | Medio: recibe totales y callbacks; no muta. |
| `CajaPanel` | 3264-3989 | 36 (2 muertas) | No | `DraftItem`, `DraftItemError`, `parseMoney`, `parseMoneyInput`, `formatMoneyInput`, `newDraftItemId`, `focusDraftField`, `AnimatedAmount` | Alto: controlado por el padre; si se mueve el estado, se pierde borrador. |
| `OrderCreditNote` | 3990-4024 | 5 | No | `formatMxn`, `Credit`, `Order` | Bajo. |
| `PaymentPanel` | 4025-4476 | 15 | No | `QrImage`, `StatusBadge`, `paymentTruth`, `creditForOrder`, `isCreditSettled`, `PAYMENT_STATES`, `DEMO_CLOSE_LABEL`, `AnimatedAmount` | Alto: duplica parte del resultado de `PaidSheet`; el padre hace generate/demo/deliver. |
| `BusinessOverview` | 4477-4817 | 3 | `/api/analytics?period=` | `AnalyticsReport`, `readJsonBody`, `AnimatedAmount` | Medio: carga solo con `active`; si se rutea, `active` debe ser true. |
| `CashCloseSummary` | 4860-4984 | 2 | No | `CashClose`, `formatMxn`, `differenceText` | Bajo. |
| `CashCloseCard` | 4985-6046 | 2 | `/api/cash`, `/api/cash/preview`, `/api/cash/close` | `CashStatus`, `CashClosePreview`, `readJsonBody`, `newRequestId`, `Sheet`, `DENOMINATIONS`, helpers de dinero | Alto: ~1,060 líneas con estado propio, preview/fingerprint, `expectedVersion`, borrador local y key de remonte. |
| `GoalCard` | 6047-6283 | 2 | `/api/goals`, `/api/goals/[id]/contribute` | `Goal`, `readJsonBody`, `parseMoney`, `newRequestId`, `Sheet` | Medio: solo `goals[0]`; no hay crear/editar/historial. |
| `ReconcileCard` | 6284-6424 | 1 (`demoMode`) | `/api/reconcile` | `ReconciliationReport`, `readJsonBody` | Bajo/medio. |
| `ActivityList` | 6425-6600 | 5 | No | `paymentTruth`, `creditForOrder`, `isCreditSettled`, `PAYMENT_STATES`, `formatMxn`, `shortOrder` | Bajo. |
| `CreditList` | 6601-6752 | 8 | No | `Credit`, `initials`, `formatMxn`, `formatActivityDate`, `shortOrder`, asset libreta | Bajo: el mejor candidato de panel de dominio. |
| `CreditPaySheet` | 6753-7014 | 13 | No | `Sheet`, `Credit`, `formatMxn`, `PAYMENT_STATES` | Medio: el padre conserva monto/método/requestId y el POST. |
| `VerifyCard` | 7015-7158 | 7 | No | `VerifyResult`, `PAYMENT_STATES`, `verifySourceCopy` | Bajo: el padre hace la verificación. |
| `Toast` | 7159-7203 | 2 | No | iconos | Bajo. |
| `QrImage` | 7204-7235 | 2 | No | `qrcode` (probablemente generación local) | Bajo. |
| `StatusBadge` | 7236-7299 | 2 | No | `Order`, `PAYMENT_STATES`, `orderStatusCopy` | Bajo, pero concentra verdad de estados. |
| `paymentTruth` / `paymentSheetTitle` | 7310-7368 | funciones | No | `Order`, `PAYMENT_STATES`, `DEMO_CLOSE_LABEL` | Alto: usado por `PaymentPanel`, `PaidSheet`, `ActivityList`, `StatusBadge`. Debe vivir en un solo módulo. |
| `TABS` / `TAB_HEADINGS` | 7360-7382 | constantes | No | `Tab` | Medio: fuente de labels y foco; debe unificarse con `/inicio`. |
| `AppSidebar` | 7384-7465 | 5 | No | `Tab`, `TABS`, assets, `Image` | Bajo en código, alto en shell. |
| `TopBar` | 7466-7549 | 8 | No | merchant, `today`, `demoMode`, mute | Bajo en código, alto en shell/medición. |
| `MobileTabBar` | 7550-7593 | 2 | No | `Tab`, `TABS` | Bajo en código, alto en shell. |
| `Sheet` | 7594-7736 | 5 | No | `createPortal`, `useId`, `.app-shell`, `[data-sheet-fallback]` | Alto: foco, inert, overflow y animaciones dependen de clases globales. |
| `PaidSheet` | 7737-7923 | 7 | No | `Sheet`, `paymentTruth`, `paymentSheetTitle`, `creditForOrder`, `isCreditSettled`, `PAYMENT_STATES`, `AnimatedAmount` | Alto: repite la rama “pagado” de `PaymentPanel`; no copiar la lógica. |
| `HelpContent` | 7924-8146 | 8 | No | `TextSize`, `ContrastMode`, `VoiceRate`, `CompanionPreferences` | Bajo. |
| `DemoContent` | 8147-8205 | 2 | No | `demoMode`, `onReset` | Bajo. |
| `PendingTasksPanel` | `pending-tasks.tsx:198` | 4 | `/api/tasks` | `Task`, `ScreenHeading`, `mexico-date` | Ya extraído; solo falta integrarlo a una ruta si se decide. |

### 3.3 APIs, `lib/` y DB por flujo

| Flujo | UI que lo consume | API | `lib/` | Tablas DB |
|---|---|---|---|---|
| Dashboard / lectura | `CajaApp`, `CajaBook`, `ActivityList` | `GET /api/dashboard` | `dashboard.ts` (`getDashboardData`) | `orders`, `order_items`, `payments`, `credits`, `customers` |
| Crear venta | `CajaPanel` → `CajaApp.createOrder` | `POST /api/orders` | `orders.ts:99` (`createOrder`), `request-hash` | `orders`, `order_items`, `customers`, `credits`, `audit_log` |
| Ver/entregar pedido | `PaymentPanel`, `PaidSheet` | `GET/PATCH /api/orders/[id]` | `orders.ts:967/1018` (`fulfillOrder`, `getOrderDetail`) | `orders`, `payments`, `order_items` |
| Link/QR | `PaymentPanel` → `CajaApp.generatePayment` | `POST /api/orders/[id]/pay` | `orders.ts:366/443` (`attachPaymentLink`, `attachQr`), `pey.ts` | `orders`, `payments` |
| Pago demo | `PaymentPanel`, checkout | `POST /api/demo/pay` | `orders.ts:528` (`recordPayment`), `config` | `payments`, `orders` |
| Abono fiado | `CreditList` → `CreditPaySheet` → `CajaApp.payCredit` | `POST /api/credits/[id]/pay` | `orders.ts:791` (`recordCreditPayment`) | `credits`, `credit_payments`, `payments`, `orders` (impacto en resumen) |
| Verificar comprobante | `VerifyCard` | `GET /api/verify` | `pey.ts`, `db.ts` | `payments`, `orders` |
| Corte | `CashCloseCard` | `GET /api/cash`, `POST /api/cash/preview`, `POST /api/cash/close` | `cash.ts:200/304/335` | `cash_closes`, `orders`, `payments`, `credits` (vía `getDailySummary`) |
| Meta | `GoalCard` | `GET/POST /api/goals`, `POST /api/goals/[id]/contribute` | `goals.ts:57/76/108` | `goals`, `goal_contributions` |
| Pendientes | `PendingTasksPanel`, `ClosingChecklist` | `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/[id]` | `tasks.ts:185/236/259/276/292/328` | `tasks` |
| Analytics | `BusinessOverview` | `GET /api/analytics` | `analytics.ts` | `orders`, `payments`, `credits` |
| Conciliación | `ReconcileCard` | `GET /api/reconcile` | `reconcile.ts`, `pey.ts` | `payments`, `orders` |
| Voz/TTS | `CajaApp` | `/api/voice/parse`, `/api/voice/transcribe`, `/api/tts` | `voice.ts`, `speech.ts`, OpenAI/Piper | Ninguna |
| Reset demo | `DemoContent` | `POST /api/demo/reset` | `db.ts:2019` | Todas las tablas de demo |
| Checkout | `CheckoutClient`, `SuccessClient` | `GET /api/checkout/[id]`, `POST /api/demo/pay` | `checkout.ts`, `payment-labels.ts`, `orders.ts` | `orders`, `payments` |

Esquema DB confirmado en `db.ts:108-275`: `orders`, `order_items`, `payments`, `payment_events`, `customers`, `credits`, `credit_payments`, `audit_log`, `cash_closes`, `goals`, `goal_contributions`, `tasks`.

### 3.4 Helpers compartidos que no se deben duplicar

- `paymentTruth` (`7310`), `paymentSheetTitle` (`7332`), `creditForOrder` (`396`), `isCreditSettled` (`401`), `statusLabel` (`7302`), `paymentSheetTitle` son contrato de presentación financiera. Si se extraen, deben ir a un módulo único (`payment-truth.ts`) y ser consumidos por `PaymentPanel`, `PaidSheet`, `ActivityList`, `StatusBadge`, `CajaBook`.
- `parseMoney` (`211`), `parseMoneyInput` (`221`), `formatMoneyInput` (`228`) se usan en venta, meta y corte. Deben vivir en un módulo de dinero de cliente, no copiarse por panel.
- `readJsonBody` (`286`), `newRequestId` (`331`), `newDraftItemId` (`327`) son utilidades de cliente; `CashCloseCard` y `GoalCard` las necesitan. Extraer a `components/caja/client-utils.ts` (sin imports `node:*`).
- `draftSignature` (`295`), `hasDraftContent` (`311`) y los readers/writers de storage (`405-573`) pertenecen al orquestador de venta. No moverlos a un panel presentacional.
- `greetingName` (`243`), `countText` (`239`), `formatDayKey` (`256`) son de presentación; pueden ir a `lib/format` o a un módulo de copy, pero no duplicarse.

**Regla de frontera:** `caja-app.tsx` solo importa `type` de `dashboard.ts`/`types.ts` y funciones puras de `format.ts`/`payment-labels.ts`. Los componentes extraídos deben conservar esa frontera: nada de `@/lib/db`, `@/lib/orders`, `@/lib/cash` en cliente.

## 4. Puntos de extracción seguros y ordenados

### 4.1 Principios

1. **Mover, no reescribir:** el primer commit de cada componente conserva props, JSX, clases y comportamiento; solo cambia la ubicación.
2. **El estado se queda en `CajaApp`:** hasta que exista una decisión de rutas y un dueño de estado, `activeOrder`, `draftItems`, `creditPay*`, `cashCloseKey`, `tasksResetKey` no se mueven.
3. **Un componente por commit y un solo escritor de `caja-app.tsx`:** los demás carriles no tocan el archivo en ese intervalo.
4. **Props actuales primero:** no agrupar en contextos ni rediseñar interfaces en el mismo commit de extracción. La agrupación es un segundo paso, si hace falta.
5. **Preservar ciclo de vida:** `hidden`, `visitedTabs`, `memo`, `key={cashCloseKey}` y `key={tasksResetKey}` son parte del contrato.
6. **Preservar clases globales:** `Sheet` y el shell dependen de `.app-shell`, `.topbar`, `.mobile-tabs`, `[data-sheet-fallback]` y `main#main`.
7. **Un panel extraído no llama APIs nuevas:** conserva exactamente el endpoint y el payload que ya usa.

### 4.2 Orden recomendado

| Fase | Extraer | Archivos nuevos propuestos | Gate mínimo | Riesgo |
|---|---|---|---|---|
| 0 | Contrato de tipos y navegación | `components/caja/types.ts`, `components/caja/nav.ts` | `verify:fast` | Bajo; solo tipos/constantes. |
| 1 | Primitivas presentacionales | `components/caja/ui/sheet.tsx`, `toast.tsx`, `qr-image.tsx`, `status-badge.tsx`, `order-credit-note.tsx` | `verify:fast` + captura | Bajo. `Sheet` es el único con foco/inert. |
| 2 | Paneles de solo lectura | `credit-list.tsx`, `help-content.tsx`, `caja-book.tsx`, `activity-list.tsx` | `verify:fast` + axe/captura | Bajo/medio. |
| 3 | Paneles autocontenidos | `goal-card.tsx`, `cash-close-card.tsx`, `reconcile-card.tsx`, `business-overview.tsx` | `p0-corte`, `p0-dinero`, `p0-integracion` | Medio. Conservar `active`, preview/fingerprint, keys. |
| 4 | Paneles transaccionales | `credit-pay-sheet.tsx`, `payment-panel.tsx`, `paid-sheet.tsx`, `caja-panel.tsx` | `p0-venta`, `p0-fiado`, `webhook`, `checkout` | Alto. El padre conserva fetch/mutaciones. |
| 5 | Shell y navegación | `components/shell/app-shell.tsx`, `sidebar.tsx`, `top-bar.tsx`, `mobile-nav.tsx`, `sheet.tsx` | `mobile-320`, `hig`, `contrast`, axe | Alto. Medición de chrome, inert y foco. |
| 6 | Alias de ruta | `app/ventas/page.tsx`, etc. solo con `redirect()` | smoke de rutas + `verify:static` | Bajo si son redirect-only. |
| 7 | Rutas reales / split de tabs | No en A | `verify:full` + decisión de producto | Alto; requiere mover estado y URL. |

**Oleada A no debería pasar de fases 0, 1, 2 y 5.** Las fases 3-4 pertenecen a Oleada B/C por dominio; la fase 7 no se abre hasta resolver H-02 y H-08.

### 4.3 Interfaces mínimas propuestas

Estas firmas son de **frontera**, no una invitación a reescribir el estado. En la primera extracción se usan las props actuales; después se puede agrupar sin cambiar el comportamiento.

```ts
// components/caja/types.ts
export type CajaTab = "caja" | "fiado" | "corte" | "meta" | "pendientes";
export type ToastTone = "ok" | "error" | "info";
export type TextSize = "normal" | "large" | "xlarge";
export type ContrastMode = "normal" | "high";
export type VoiceRate = "slow" | "normal" | "fast";

export interface DraftItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface DraftItemError {
  message: string;
  field: "description" | "quantity" | "price";
}
```

```ts
// components/caja/ui/sheet.tsx
import type { ReactNode } from "react";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md";
}
```

```ts
// Paneles de dominio: contratos mínimos, sin fetch nuevos
import type { Credit } from "@/lib/types";
import type { ToastTone } from "./types";

export interface CreditListProps {
  credits: Credit[];
  totalCount: number;
  totalCustomers: number;
  balanceCents: number;
  loading: boolean;
  error: string | null;
  onStart: (credit: Credit) => void;
  onGoToCaja: () => void;
}

export interface CreditPaySheetProps {
  credit: Credit | null;
  amount: string;
  initialAmount: string;
  method: "cash" | "codi" | "card" | null;
  initialMethod: "cash" | "codi" | "card" | null;
  note: string;
  paying: boolean;
  error: string | null;
  onAmount: (value: string) => void;
  onMethod: (value: "cash" | "codi" | "card") => void;
  onNote: (value: string) => void;
  onClose: () => void;
  onPay: () => void;
}

export interface CashCloseCardProps {
  active: boolean;
  showToast: (tone: ToastTone, text: string) => void;
}

export interface GoalCardProps {
  active: boolean;
  showToast: (tone: ToastTone, text: string) => void;
}
```

```ts
// PaymentPanel: el padre conserva generate/demo/deliver
import type { Credit, Order } from "@/lib/types";

export interface PaymentPanelProps {
  order: Order | null;
  credits: Credit[];
  demoMode: boolean;
  changeCents: number;
  loading: boolean;
  mode: "link" | "qr";
  onGenerate: (mode: "link" | "qr") => void;
  onDemoPay: (method: "codi" | "card") => void;
  onClose: () => void;
  onNew: () => void;
  onCopy: (value: string) => void;
  onShare: (value: string) => void;
  onDeliver: () => void;
  delivering: boolean;
  error: string | null;
}
```

```ts
// CajaPanel: propuesta de agrupación posterior.
// El primer move debe conservar las 36 props actuales; estas dos están muertas hoy:
// showTextInput y onToggleText.
import type { DraftItem, DraftItemError } from "./types";

export interface CajaPanelProps {
  voice: {
    listening: boolean;
    transcribing: boolean;
    recordingSeconds: number;
    transcript: string;
    textInput: string;
    showTextInput: boolean;
  };
  draft: {
    items: DraftItem[];
    itemErrors: Record<string, DraftItemError>;
    creditCents: number;
    cashInput: string;
    creditInput: string;
    customerName: string;
  };
  totals: {
    draftTotal: number;
    appliedCashCents: number;
    appliedCreditCents: number;
    changeCents: number;
    digitalDue: number;
    overpay: boolean;
  };
  status: {
    savingOrder: boolean;
    saleError: string | null;
    voiceError: string | null;
  };
  actions: {
    onStart: () => void;
    onStop: () => void;
    onVoiceHelp: () => void;
    onTextInput: (value: string) => void;
    onInterpret: () => void;
    onSample: (phrase: string) => void;
    onDraftItems: (items: DraftItem[]) => void;
    onCash: (value: string) => void;
    onCashBlur: (value: string) => void;
    onCredit: (value: string) => void;
    onCreditBlur: (value: string) => void;
    onCustomer: (value: string) => void;
    onCreate: () => void;
    onClear: () => void;
  };
}
```

```ts
// Shell: el contrato debe ser único para Caja e Inicio
import type { CajaTab } from "./types";

export interface AppSidebarProps {
  tab: CajaTab;
  onTab: (tab: CajaTab, viaKeyboard?: boolean) => void;
  demoMode: boolean;
  onHelp: () => void;
  onDemo: () => void;
}

export interface TopBarProps {
  merchant: { name: string; address?: string } | undefined;
  today: string;
  demoMode: boolean;
  unavailable: boolean;
  muted: boolean;
  onToggleMuted: () => void;
  onHelp: () => void;
  onDemo: () => void;
}

export interface MobileTabBarProps {
  tab: CajaTab;
  onTab: (tab: CajaTab, viaKeyboard?: boolean) => void;
}
```

`PendingTasksPanel` ya tiene su interfaz pública en `pending-tasks.tsx:183-201`; no hace falta redefinirla. Se debe usar tal cual.

### 4.4 Puntos que NO son extracción segura todavía

- `CajaApp` completo.
- El bloque de tabs (`2482-2842`) como página independiente.
- El estado de borrador (`draftItems` y storage) fuera de `CajaApp`.
- `cashCloseKey` / `tasksResetKey` fuera de `CajaApp`.
- `CreditPaySheet` + `payCredit` juntos: el sheet es presentacional; el POST y el `requestId` son del padre.
- `PaymentPanel` + `polling` juntos: el polling vive en `CajaApp` (`2064-2112`), no en el panel.
- `Sheet` y shell en commits separados: `Sheet` inerta `.app-shell`; si el shell cambia primero, el sheet falla. Deben ir en el mismo PR o preservar la clase raíz.

## 5. Compatibilidad de rutas objetivo

### 5.1 Estado actual de `?tab=`

`web/src/app/page.tsx` valida:

- `caja` → Caja (venta)
- `fiado` → Fiado
- `corte` → Corte
- `meta` → Meta
- `pendientes` → Pendientes
- sin `tab` → `caja`
- tab desconocido → `caja` silenciosamente

`?ayuda=1` abre el sheet de ayuda. `#ajustes` se usa para desplazar dentro del sheet. `start_url` del manifest es `/inicio` (`manifest.ts:9`).

**Valores que NO existen:** `?tab=ventas`, `?tab=fiados`, `?tab=metas`, `?tab=caja-corte`. No usarlos en aliases.

### 5.2 Matriz de compatibilidad

| Ruta objetivo | ¿Puede redirigir hoy? | Canon actual | Mapeo | Condición / veredicto |
|---|---|---|---|---|
| `/inicio` | No aplica | `/inicio` | — | Se queda. Es la única pantalla nueva aprobada; no redirigir. |
| `/ventas` | Sí, **solo alias** | `/?tab=caja` | `/ventas` → `/?tab=caja` | Seguro como compatibilidad, pero “Ventas” promete historial y el tab abre venta + libro + actividad. No declararlo pantalla migrada. |
| `/fiados` | Sí | `/?tab=fiado` | `/fiados` → `/?tab=fiado` | 1:1. Alias seguro y reversible. |
| `/corte` | Sí | `/?tab=corte` | `/corte` → `/?tab=corte` | 1:1. Alias seguro. |
| `/metas` | Sí | `/?tab=meta` | `/metas` → `/?tab=meta` | 1:1, pero el query interno es singular `meta`. No pasar `metas` al query. |
| `/pendientes` | Sí | `/?tab=pendientes` | `/pendientes` → `/?tab=pendientes` | 1:1. Alias seguro. |
| `/caja` | **No** | Ambiguo | — | Bloqueado: `/?tab=caja` es venta, pero Inicio llama “Caja” a `/?tab=corte`. Decidir antes. |
| `/` | No redirigir | `/` | — | Mantener default Caja. Redirigir `/` rompe enlaces externos, `not-found` del checkout y posiblemente p0. |
| `/pay/[id]` y `/success` | No | Sin cambios | — | Contrato público congelado en A. |

**Regla:** si se agregan aliases, deben ser páginas mínimas que hagan `redirect()` (307 temporal, reversible) y **no importen `CajaApp`**. Renderizar `CajaApp` en otra ruta no es un redirect: duplica puntos de entrada y mantiene el problema de URL/estado.

### 5.3 Por qué `/caja` está bloqueado

Hay tres significados en juego:

1. `/?tab=caja` = pantalla de venta/registro (el tab interno “Caja”).
2. `/?tab=corte` = corte de caja (lo que Inicio etiqueta “Caja y corte”).
3. `/ventas` = futuro historial/consulta, que hoy también cae en `?tab=caja`.

Si `/caja` → `?tab=caja`, compite con `/ventas` y no coincide con la etiqueta “Caja” de Inicio. Si `/caja` → `?tab=corte`, el path dice “caja” pero el tab dice “corte”. Ninguna opción es honesta sin una decisión de producto. **No activar `/caja` en Oleada A.**

### 5.4 El problema real: la URL no sigue al tab

`selectTab` (`caja-app.tsx:1230-1245`) solo actualiza estado React. No hay `router.replace`, `history.pushState` ni listener de `popstate`. `initialTab` solo alimenta `useState` al montar (`677`), no hay efecto que sincronice cambios posteriores de la prop.

Consecuencias:

- Un usuario que entra a `/?tab=caja` y pulsa “Fiado” sigue viendo `/?tab=caja` en la barra.
- Back/forward no recorre tabs.
- Un alias `/fiados` que redirige a `/?tab=fiado` funciona al entrar, pero al cambiar de tab la URL queda mintiendo.
- Si mañana `/fiados` es una ruta real, el shell y los tabs deben compartir un controlador de navegación; no basta con pasar `initialTab`.

**Requisito para rutas reales (no para alias):**

1. `CajaApp` recibe `tab` controlado o un `onTab` que actualice la URL.
2. `selectTab` usa `router.replace`/`history.replaceState` y escucha `popstate`.
3. `visitedTabs` y el foco de encabezados se preservan.
4. El borrador de venta y el conteo de corte sobreviven a la navegación (layout/contexto o almacenamiento).
5. Los aliases dejan de ser redirects y pasan a rutas canónicas solo cuando 1-4 estén verdes.

### 5.5 Deuda de navegación que A debe resolver antes de cambiar links

| Archivo:línea | Link actual | Problema |
|---|---|---|
| `inicio/page.tsx:52` | “Ventas” → `/?tab=caja` | La etiqueta sugiere historial; abre venta. |
| `inicio/page.tsx:53` | “Fiados” → `/?tab=fiado` | Correcto. |
| `inicio/page.tsx:57-60` | “Caja” → `/?tab=corte` | “Caja” significa corte aquí, no el tab `caja`. |
| `inicio/page.tsx:63-66` | “Reportes” → `/?tab=corte` | Comparte destino con “Caja”; no hay reporte independiente. |
| `inicio/page.tsx:54-55` | “Productos” / “Proveedores” | `<span aria-disabled>` “Próximamente”; no son rutas. |
| `inicio/page.tsx:306` | Hero “Registrar” → `/` | Funciona por default `caja`, pero no expresa intención. |
| `inicio/page.tsx:318` | “Ver todos” → `/?tab=pendientes` | Correcto. |
| `inicio/page.tsx:359` | “Ir a ventas” → `/` | Default caja; etiqueta y destino no coinciden. |
| `inicio/page.tsx:178/182` | Ayuda/Ajustes → `/?ayuda=1` / `#ajustes` | Correcto; preservar al agregar aliases. |
| `caja-app.tsx:7399/7491` | Marca/TopBar → `/inicio` | Correcto. |
| `pay/[id]/not-found.tsx` | “Volver” → `/` | Mantener `/`; no redirigir a `/inicio`. |

**No cambiar estos links en el mismo PR que las rutas nuevas sin un contrato único de navegación.** Hoy hay cuatro fuentes de verdad (H-06) y el cambio de una sin las otras produce inconsistencias.

## 6. Propiedad de archivos y riesgos de colisión

### 6.1 Propietarios propuestos para Oleada A

| Dueño | Archivos | Modo de escritura |
|---|---|---|
| `mc-sistema-diseno` | `globals.css` (`@theme`), nuevos `components/ui/*`, `layout.tsx` (bloque de fuentes), `inicio/inicio.css` (alias de tokens), `assets/fonts/**` | Dueño de tokens y fuentes. No toca `caja-app.tsx`. |
| `mc-shell-responsive` | `components/shell/*`, `app/page.tsx`, `app/inicio/page.tsx`, secciones de shell en `caja-app.tsx` | **Único escritor** de `caja-app.tsx` durante A. No extrae paneles de dominio. |
| `mc-ventas-pagos` | `caja-panel`, `payment-panel`, `paid-sheet`, `verify-card`, `status-badge`, `qr-image`; integración con `/api/orders`, `/api/orders/[id]/pay`, `/api/demo/pay` | No toca `lib/orders.ts` sin aprobación. |
| `mc-fiado-corte` | `credit-list`, `credit-pay-sheet`, `cash-close-card`, `business-overview`, `reconcile-card`; integración con `/api/credits`, `/api/cash`, `/api/reconcile` | No toca `lib/cash.ts` sin aprobación. |
| `mc-modulos-negocio` | `goal-card`, `pending-tasks`, integración con `/api/goals`, `/api/tasks`; futuros productos/proveedores | No toca `lib/goals.ts`/`lib/tasks.ts` sin aprobación. |
| `mc-onboarding-ayuda` | `help-content`, `companion-preferences`, ayuda/ajustes | No toca el shell. |
| `mc-accesibilidad` | Sin archivos de producto; auditoría, axe, teclado, capturas | Solo lectura/reporte. |
| `mc-verificador-final` | Sin archivos de producto; veredicto y evidencia | Solo lectura/veredicto. |
| Custodio de contratos financieros | `lib/db.ts`, `lib/orders.ts`, `lib/cash.ts`, `lib/pey*.ts`, `lib/payment-rules.ts`, `lib/payment-labels.ts`, `lib/checkout.ts`, `app/api/**` financiero, `app/pay/**`, `proxy.ts`, `next.config.ts` | **Congelados en A.** Cambio solo con dueño explícito, ADR y p0. |

### 6.2 Archivos críticos y riesgo

| Archivo | Líneas | Dueño A | Riesgo | Regla |
|---|---:|---|---|---|
| `web/src/components/caja-app.tsx` | 8,228 | `mc-shell-responsive` (lease) | Crítico | Un solo PR/escritor a la vez; no merge concurrente. |
| `web/src/lib/db.ts` | 2,101 | Custodio financiero | Crítico | Congelado. Esquema, migraciones y reset demo no se tocan por UI. |
| `web/src/lib/orders.ts` | 1,026 | `mc-ventas-pagos` (custodio) | Crítico | Congelado; idempotencia, `requestId`, `recordCreditPayment`, `fulfillOrder`. |
| `web/src/lib/cash.ts` | 492 | `mc-fiado-corte` (custodio) | Alto | Congelado; `previewFingerprint`, `expectedVersion`, snapshots. |
| `web/src/lib/goals.ts` | 245 | `mc-modulos-negocio` (custodio) | Medio | Congelado; `requestId` obligatorio. |
| `web/src/lib/tasks.ts` | 343 | `mc-modulos-negocio` (custodio) | Medio | Congelado; fechas México, `TaskError`, acciones. |
| `web/src/lib/dashboard.ts` | 146 | `mc-ventas-pagos` + shell | Alto | Contrato de lectura; no agregar campos sin consumidor y prueba. |
| `web/src/app/page.tsx` | 35 | `mc-shell-responsive` | Alto | Único punto de entrada de Caja; cambios de `tab`/params afectan deep links. |
| `web/src/app/inicio/page.tsx` | 367 | `mc-sistema-diseno` + shell | Alto | Shell duplicado; no convertirlo en segunda Caja. |
| `web/src/app/layout.tsx` | 68 | `mc-sistema-diseno` | Alto | Fuentes globales y script de contraste; cambio afecta todas las rutas. |
| `web/src/app/globals.css` | 930 | `mc-sistema-diseno` | Alto | `@theme`, foco, alto contraste, text-size. |
| `web/src/app/barrio.css` | 2,342 | `mc-shell-responsive` + diseño | Alto | Se carga después de globals; sus reglas mandan. No mezclar refactors. |
| `web/src/app/inicio/inicio.css` | 1,480 | `mc-sistema-diseno` | Medio | Paleta propia; si se aliasa, probar Inicio completo. |
| `web/src/app/checkout.css` | 757 | `mc-ventas-pagos` | Medio | Contrato público; no tocar en A. |

### 6.3 Riesgos de colisión concretos

1. **Dos carriles en `caja-app.tsx`:** conflicto garantizado. Es un archivo de 8.2k líneas; aun cambios pequeños cruzan imports, helpers y JSX.
2. **Tokens en `globals.css` + overrides en `barrio.css` + paleta en `inicio.css`:** un cambio de color/tipografía puede verse distinto en Caja, Inicio y Checkout. La fundación debe definir el orden: `@theme` → alias legacy → `barrio` → `inicio`, o congelar una capa por PR.
3. **`Sheet` y `.app-shell`:** si el shell deja de usar `.app-shell`, `Sheet` no inertiza el fondo y el foco se escapa. Si cambia `[data-sheet-fallback]`, el retorno de foco falla.
4. **`TopBar`/`MobileTabBar` y `--mc-chrome-*`:** `CajaApp` mide `.topbar` y `.mobile-tabs` (`1262-1281`). Cambiar clases o alturas sin actualizar la medición rompe `scroll-padding` y anclas.
5. **Borrador de venta:** mover `draftItems` a una ruta/contexto sin preservar `saleRequestRef`, `PENDING_ORDER_KEY` y `SALE_REQUEST_STORAGE_KEY` puede duplicar ventas o perder una venta a medio escribir.
6. **Corte:** `cashCloseKey` remonta `CashCloseCard` para descartar conteo no guardado tras reset demo (`2334-2364`, `2805`). Un split de ruta pierde ese contrato y puede mostrar un conteo viejo sobre datos reiniciados.
7. **Pendientes:** `tasksResetKey` remonta `PendingTasksPanel` tras reset demo (`2836-2838`). Si el panel se monta en otra ruta, el reset debe propagarse por evento/contexto.
8. **Pago:** `paymentTruth`, `paymentSheetTitle`, `creditForOrder`, `isCreditSettled` se usan en cuatro superficies. Copiarlos produce inconsistencias de “pagado/demo/fiado/efectivo”.
9. **Checkout:** cualquier cambio de `checkout.ts`, `payment-labels.ts` o `app/pay/**` puede romper la única verdad pública; A no debe rediseñarlo.
10. **Navegación:** cambiar `/inicio` sin actualizar `TABS`/`HomeTab`/`TAB_HEADINGS` deja links a legacy o tabs sin foco.
11. **Fuentes:** reemplazar `--font-sans`/`--font-display` globalmente antes de probar métricas puede desbordar montos, tabs y checkout. Hacer canary.
12. **Evidencia:** dos carriles escribiendo `harness/evidence` o `quality-reports` generan artefactos de SHAs distintos. Solo el verificador final consolida.

## 7. Staging de fuentes `.font-staging/`

### 7.1 Inventario real

Solo hay **6 archivos**, todos esperados:

| Archivo | Bytes | SHA-256 | Git blob | Estado |
|---|---:|---|---|---|
| `Hearth[wght].woff2` | 26,396 | `B885DEA71502BC246DFD68EDBEE1FB7CF11A6E3E091669A1410376133AE2E470` | `e9d9e8d5d55ac0041a7415b054d0c8bbf4fdda0a` | Coincide con `SOURCE.md` |
| `Alder[wght].woff2` | 26,884 | `B0C178C8C48CA5B064E734591ABAB6157889AA7C9D84B5AE7D4647594C5A0B3C` | `acab6ac1e4973c423c8779099399dc5cfe4c2b7d` | Coincide con `SOURCE.md` |
| `Hearth-OFL.txt` | 4,232 | `74DE89B0BFAD86F8A42127E77E8B36349F06842992BFEA40416D1EBD09C8AB3D` | `60dc11d8d032cfa8cef32b9d7ff4fd07f8cc8104` | Coincide con `SOURCE.md` |
| `Alder-OFL.txt` | 4,231 | `F756480765D3065CF84BB8F5AD42AB404C12A047A3B4182B5F28CF45A2E3B8DD` | `064bdd01110d7dc34d767360ea111d4216f16bd9` | Coincide con `SOURCE.md` |
| `font-proof.png` | 43,007 | `AEDBCC11000489D7FDEED4B867F742C7CA6FA5C1B218EB72CB39EC59538A683C` | `fd423690a5e785844dbb7a18e3e4d0a5bb7f098d` | Prueba visual 1000×600 |
| `SOURCE.md` | 2,921 | `1388F6AE42F8EEF21D6A17519B3DC5F303E376076E1402C82468931F7F7B3693` | `3c02ccd9d083d7927739103e1da76aa5fef13370` | Documento de origen |

Los hashes SHA-256 y los Git blob de los WOFF2 coinciden con `SOURCE.md`. Las licencias son SIL Open Font License 1.1 y conservan el aviso de cada familia.

### 7.2 Seguridad y archivos ajenos

- No se encontraron patrones de secretos (`api_key`, `secret`, `token`, `password`, `BEGIN PRIVATE KEY`, `sk-`, `ghp_`, `AKIA`) en los archivos de texto. La única coincidencia de “token” es `--font-hearth`/`--font-alder` en `SOURCE.md`, que es un nombre de token CSS.
- No hay archivos extra: no hay ZIP, TTF, `.env`, `.DS_Store` ni enlaces simbólicos.
- `font-proof.png` contiene solo la prueba tipográfica (“Buen día, Lupita”, montos y botón “Registrar”); no hay datos reales ni credenciales.
- `.font-staging/` está ignorado por `.git/info/exclude:7`, **no** por `.gitignore`. No está trackeado (`git ls-files .font-staging` vacío). Es local de esta máquina/worktree.

### 7.3 Hallazgos de fuentes

1. **No están aprobadas ni integradas:** `layout.tsx:3-23` sigue usando `Fraunces` e `Inter`; no hay referencias a Hearth/Alder en `web/src`.
2. **El staging no viaja con la rama:** si otro worktree o la CI necesita las fuentes, hay que copiarlas a `web/src/assets/fonts/` y trackearlas con sus OFL. No asumir que `.font-staging/` existe en otro lado.
3. **`SOURCE.md` menciona TTF variables verificados, pero no hay TTF en el staging.** Es una discrepancia documental, no un secreto ni un bloqueo. Si se necesitan TTF para otra herramienta, hay que recuperarlos y verificar sus hashes.
4. **La prueba visual no sustituye la prueba en la app:** `font-proof.png` demuestra carga y cifras, pero no reflow a 320/390/1448, 200%, alto contraste ni montos largos.
5. **Licencia:** conservar `Hearth-OFL.txt` y `Alder-OFL.txt` junto a los WOFF2 trackeados. La nota de `SOURCE.md` pide no redistribuir fuera del proyecto; la OFL permite incrustar/redistribuir con licencia, pero se debe seguir la decisión del proyecto.

### 7.4 Recomendación de integración

- Aprobación explícita de Hearth/Alder antes de tocar `layout.tsx`.
- Copiar a `web/src/assets/fonts/` con licencias; no usar `.font-staging` como fuente de build.
- `next/font/local` o `@font-face` con `--font-hearth`/`--font-alder`; no reemplazar `--font-sans`/`--font-display` en el primer commit.
- Canary en `/inicio` y shell nuevo; luego Caja, checkout y resto.
- Probar 1448/1366/390/320, 200%, alto contraste, cifras grandes, `$`, `%`, `ñ`, `¿`, acentos y tablas.
- Si el resultado no es estable, mantener Fraunces/Inter y dejar Hearth/Alder para otra oleada. La fundación no depende de cambiar la tipografía.

## 8. Matriz de aceptación por pantalla para Oleada A

### 8.1 Niveles de aceptación

| Nivel | Significado | ¿Se puede declarar “migrada”? |
|---|---|---|
| **A0 — preservada** | La pantalla sigue funcionando igual; solo se tocó shell/tokens por fuera. | No. |
| **A1 — fundación aplicada** | Usa tokens/shell/nav compartidos, pero el contenido sigue en el monolito o en el componente legacy. | No. |
| **A2 — migrada** | Componente/pantalla propia, ruta canónica, estado y datos propios, sin legacy en el render path, evidencia completa. | Sí, solo con veredicto independiente. |

**En Oleada A no hay ninguna A2.** La meta realista es A0/A1. Cualquier reporte que diga “pantalla migrada” en A es prematuro.

### 8.2 Matriz

| Pantalla | Ruta A | Fuente actual | Contrato que no puede cambiar | Estados/acciones mínimos | Aceptación A | No declarar migrada si… |
|---|---|---|---|---|---|---|
| **Inicio** | `/inicio` | `inicio/page.tsx`, `inicio.css` | `getDashboardData` (summary y `pendingCentsTotal`), `listGoals()[0]`, `listTasks(8)` abiertas 3, `isDemoMode`, fixtures demo etiquetados | Normal, demo, sin tareas, sin meta, error de datos del servidor; CTA Registrar, Ver todos, Ayuda/Ajustes | Nav honesta y única; 4 KPI; CTA y links correctos; 1448/1366/390/320/200%/HC; axe 0; sin duplicar Caja | La navegación sigue con “Caja”/“Reportes” al mismo destino; el shell sigue separado; solo hay captura 1448 |
| **Caja / venta** | `/?tab=caja` (alias `/ventas` solo redirect) | `CajaApp`, `CajaPanel`, `CajaBook`, `PendingPayments`, `ActivityList` | `POST /api/orders`, `requestId` idempotente, draft localStorage, `paymentTruth`, polling, demo vs real, entrega solo si cubierto | Vacío, cargando, error, borrador restaurado, venta efectivo/fiado/mixta, link/QR, demo, pago verificado, entrega, cambio | `p0-venta 66/0`; sin pérdida de borrador; sheets con foco; `?tab=caja`; 1448/390/320; shell A1 | Sigue renderizada por `caja-app.tsx`; `selectTab` no actualiza URL; el draft se pierde al navegar; se copió lógica de pago |
| **Fiado** | `/?tab=fiado` (alias `/fiados`) | `CreditList`, `CreditPaySheet` | `credits` del dashboard, saldo total, `requestId`, `expectedBalanceCents`, 409 de saldo, abono no crea venta nueva | Vacío, cargando, error, truncado, abono parcial, saldado, sobrepago, duplicate | `p0-fiado 51/0`; saldo y conteo consistentes; alias redirect; 1448/390/320; teclado | Sigue siendo tab del monolito; no hay estados vacío/error; se declara “fiados completo” sin historial/búsqueda |
| **Corte** | `/?tab=corte` (alias `/corte`) | `ClosingChecklist`, `CashCloseCard`, `BusinessOverview`, `ReconcileCard` | `opening + cashSales + cashCredit - expenses - withdrawals`; `previewFingerprint`; `expectedVersion`; snapshots; demo filter; no ajustar diferencia sola | Sin corte, cargando, error, preview, stale, diferencia, corrección, historial, pendientes | `p0-corte 69/0`; `p0-dinero 45/0 + 3 KNOWN`; conteo no guardado sobrevive tab; `active` evita fetch oculto | Un split de ruta resetea el conteo; se duplica `/api/cash`; se pierde `cashCloseKey`; se mezcla demo/real |
| **Meta** | `/?tab=meta` (alias `/metas`) | `GoalCard` | `goals[0]`, `remainingCents`, `requestId`, aporte no es custodia, no supera remaining | Sin meta, cargando, meta completa, aporte, error, demo | `p0-dinero` de aporte; no crear/editar/historial todavía; `active`; 1448/390/320 | Se declara “Metas” completo; solo se muestra `goals[0]`; se inventa UI de creación |
| **Pendientes** | `/?tab=pendientes` (alias `/pendientes`) | `PendingTasksPanel` ya extraído + `ClosingChecklist` | `apiBase`, `headingId`, `active`, `onTasksChange`; fechas México; CRUD; `tasksResetKey` | Vacío, cargando, error, crear, completar, reabrir, posponer, eliminar, foco | `tasks-contract`; panel extraído sin regresión; `tasksResetKey` tras reset demo; alias redirect | Se declara migrada la pantalla solo porque el panel ya es archivo aparte; sigue dentro de Caja sin ruta canónica |
| **Checkout** | `/pay/[id]` | `checkout-client.tsx`, `checkout.css`, `checkout.ts` | `getCheckoutData`, `amountDueCents`, demo vs real, `paymentUrl`, `POST /api/demo/pay`, estados de pago | Cargando, 404, pendiente, pagado, fiado, demo, error, poll | `checkout 19/19`; sin cambios de contrato; 1448/390/320; axe | Se rediseña sin pruebas; se confirma pago en cliente; se oculta demo |
| **Success** | `/pay/[id]/success` | `success-client.tsx` | `GET /api/checkout/[id]`, `SUCCESS_COPY`, `payment`, `amountDueCents`, `isCredit`, demo/efectivo/verificado | Confirmando, pendiente, verificado, demo, efectivo, fiado, missing | `checkout 19/19`; polling estable; no confirmar por cliente; 1448/390/320 | Se pinta “pagado” desde el cliente; se rompe polling; se elimina estado missing |
| **Shell / Ayuda / Ajustes** | Sin ruta propia en A; `?ayuda=1`, `#ajustes` | `AppSidebar`, `TopBar`, `MobileTabBar`, `Sheet`, `HelpContent` | `.app-shell` inert; `.topbar`/`.mobile-tabs` medición; foco; tamaño/contraste/voz | Abrir/cerrar, foco atrapado, retorno, teclado, 200%, HC | 1448/390/320; axe 0; sin scroll trap; `?ayuda=1#ajustes` funciona; nav única | `Sheet` no inertiza; foco se escapa; “Ayuda” cambia de ruta sin alias; se duplica shell |

### 8.3 Criterios para no declarar migrada una pantalla

Una pantalla **no está migrada** si cumple cualquiera de estas:

1. Su contenido sigue renderizado por `caja-app.tsx` o por un componente legacy sin contrato propio.
2. Su URL canónica no existe o es solo un redirect a `/?tab=...`.
3. Al cambiar de tab, la URL no cambia y back/forward no funciona.
4. Perdió un estado que antes sobrevivía: borrador, conteo de corte, scroll, foco, sheet abierto.
5. Duplica lógica de `paymentTruth`, fiado, corte, metas o tareas en más de un lugar.
6. No tiene estados de carga/error/vacío o no distingue demo de real.
7. No tiene evidencia funcional: solo una captura, o solo 1448 de escritorio.
8. No pasó 390/320, 200%, alto contraste, teclado y axe.
9. No pasó los p0 de su dominio (`p0-venta`, `p0-fiado`, `p0-corte`, `p0-dinero`, `p0-integracion`) o el contrato correspondiente.
10. Sigue dependiendo de `barrio.css`/`inicio.css` como lenguaje visual principal.
11. Su link de navegación sigue apuntando a legacy o a un destino compartido ambiguo.
12. Se declara migrada por tener un componente nuevo que ninguna ruta usa.
13. Se usa una captura de `/inicio` como prueba de Caja, checkout o producto completo.
14. No hay veredicto independiente o la evidencia full no corresponde al HEAD.

### 8.4 Gates globales de Oleada A

- `npm run verify:fast` en cada commit (guard, lint, types).
- `npm run verify:static` al cerrar shell/tokens.
- `npm run verify:full` al cierre; si `tunnel`/`preflight` fallan, la corrida es 21/23 y **no** es GO.
- `npm run verify:evidence` contra el HEAD final.
- `npm run test:contracts` y p0 del dominio tocado.
- Axe normal, alto contraste y forced-colors; 1448/1366/390/320; 200%; teclado.
- Capturas por pantalla, no una sola captura de Inicio.
- `latest.json`/`latest-static.json` actualizados y con SHA del HEAD; hoy `latest.json` no lo está.

## 9. Bloqueos y orden de desbloqueo

| Bloqueo | Severidad | Dueño | Desbloquea | ¿Bloquea A? |
|---|---|---|---|---|
| B-01 Decisión semántica `/caja` vs `/corte` vs `/ventas` | Alta | Producto + `mc-shell-responsive` | Activar `/caja` y nav honesta | Sí, para rutas; no para shell. |
| B-02 URL no sincronizada con `tab` | Alta | `mc-shell-responsive` | Rutas reales/back-forward | Bloquea split de tabs, no alias redirect. |
| B-03 Sin lease de escritor único de `caja-app.tsx` | Alta | Orquestador | Extracción segura | Sí. |
| B-04 Tres capas CSS/tokens | Alta | `mc-sistema-diseno` | Fundación compartida | Sí, para A1. |
| B-05 Full 21/23 y `latest.json` viejo | Alta | `mc-verificador-final` + infra | Handoff público | No bloquea código local; sí GO. |
| B-06 Hearth/Alder sin aprobación/integración | Media | `mc-sistema-diseno` | Entregable tipográfico | No bloquea shell si se mantiene Fraunces/Inter. |
| B-07 `Sheet`/shell acoplados a `.app-shell` y chrome | Media | `mc-shell-responsive` | Extracción de shell | Sí, si se hace en PR separado. |
| B-08 Estado de draft/corte/tasks en el monolito | Alta | `mc-shell-responsive` + dominio | Split de rutas | Bloquea fase 7; no fases 0-2. |
| B-09 Navegación con cuatro fuentes de verdad | Media | `mc-sistema-diseno` + shell | Nav única | Sí para A1. |
| B-10 Accesibilidad no certificada / lector real no corrido | Media | `mc-accesibilidad` | Cierre visual | No bloquea fundación, sí veredicto. |

### 9.1 Orden recomendado

1. Ratificar la tabla de rutas y el significado de “Caja”.
2. Asignar el lease de `caja-app.tsx` a un solo carril.
3. Congelar baseline: capturas 1448/390/320, axe, contratos y SHA.
4. Crear `types.ts` + `nav.ts` sin cambiar comportamiento.
5. Extraer `Sheet`, `Toast`, `QrImage`, `StatusBadge`, `OrderCreditNote`.
6. Extraer `CreditList` y `HelpContent`.
7. Integrar tokens/fuentes en canary y luego shell.
8. Agregar alias redirect-only solo si producto los aprueba.
9. Correr `verify:static` y `verify:full`; actualizar evidencia.
10. No abrir Oleada B ni declarar pantallas migradas hasta cerrar A con veredicto.

## 10. Conclusión

La fundación compartida es viable, pero el repositorio todavía no tiene las condiciones para una migración de rutas ni para paralelizar la extracción del monolito. El camino seguro es:

- **una sola fuente de navegación y tipos;**
- **un solo escritor de `caja-app.tsx`;**
- **extracción secuencial de componentes presentacionales;**
- **aliases redirect-only, no pantallas duplicadas;**
- **ninguna pantalla declarada migrada en A;**
- **evidencia full consolidada antes de handoff.**

Con esas condiciones, Oleada A puede entregar una base sólida sin tocar el motor financiero. Sin ellas, el riesgo de romper estado, saldos, corte o pagos es mayor que el beneficio visual.

---

## Apéndice A — Comandos y evidencia usados

- `git rev-parse HEAD`, `git rev-parse fase-1-handoff`, `git log --oneline fase-1-handoff..HEAD`, `git status --porcelain`
- `git ls-files "web/src"`, `Get-ChildItem` para rutas/archivos
- `rg -n` para componentes, props, fetch, APIs, CSS y líneas
- `Get-FileHash -Algorithm SHA256` y `git hash-object` para `.font-staging/`
- Lectura de `harness/evidence/latest.json`, `latest-static.json` y runs `2026-11-04T04-37-25-913Z-full.json` / `2026-11-04T04-35-43-123Z-static.json`
- No se ejecutaron builds, tests ni gates; se usó evidencia existente para no escribir artefactos.
- **No se modificó código.** El único archivo escrito por esta auditoría es este reporte.
