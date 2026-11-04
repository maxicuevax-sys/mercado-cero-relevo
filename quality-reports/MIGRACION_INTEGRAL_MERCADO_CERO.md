# Migración integral de Mercado Cero

> **Estado:** Oleada A cerrada en `26c7741`; Oleada B (Caja y Ventas) implementada en local, **sin commit**. Verificador la aprueba como base para Oleada C; cierre formal y handoff público siguen pendientes.
> **Rama:** `design/oleada-b-caja-ventas` · **Base/tag:** `oleada-a-cierre` = `26c7741`
> **Árbol:** sucio (implementación B + auditorías/evidencia local). El commit de checkpoint está autorizado por el verificador; falta ejecutarlo y regenerar `latest-static`.
> **Servidor de referencia:** `http://localhost:3100` con `APP_URL=http://localhost:3100`.
> **Veredicto de Fase 1 (independiente):** **APROBADO CON LIMITACIONES** para visual/funcional/demo; **Handoff/merge RECHAZADO — NO GO**. Certificación WCAG: **NO EMITIDA**. Lector de pantalla real: **NOT RUN**.
> **Regla:** ninguna pantalla se declara migrada por tener diseño nuevo; debe conservar funciones, datos, navegación, estados y pasar verificación independiente.

## 0. Oleadas A y B

### A — cerrada

- Hearth/Alder, AppShell y componentes compartidos; `/inicio` migrado.
- Commit `d30a31c` + cierre documental `26c7741`; tag `oleada-a-cierre`.
- `latest-static` 5/5 y `verify:evidence -- --static` PASS en `26c7741`.
- Entrega: `quality-reports/oleada-a/ENTREGA_OLEADA_A.md`.

### B — local, sin commit

- **B1 Caja:** `/caja` real con venta manual, conceptos editables, efectivo/cambio, digital con link/QR, fiado, mixto y resultado. Sin IA/micrófono obligatorio.
- **B2 Ventas:** `/ventas` real, paginada, con estado, importe, método, conceptos, saldo vivo de fiado y pendiente digital.
- **B3 Navegación:** nav única Inicio/Caja/Ventas/Fiados/Corte/Metas/Pendientes; `/fiados`, `/corte`, `/metas` y `/pendientes` siguen como alias 307.
- **B4 Contratos:** sin cambios en `lib/`, APIs financieras, webhook, checkout ni `/pay/**`; Caja nueva usa las mismas APIs.
- **Evidencia local:** smoke B 44/44; A 33/33; a11y B 8/8 con axe 0 normal/HC; HIG legacy 5/5; mobile-320 60/60; p0 completos sin regresión.
- **Pendiente:** commit, `verify:static`/`verify:evidence`, full documentado como parcial, HIG específico de `/caja`/`/ventas`, decisión sobre idempotencia de `/api/demo/pay` y retiro de la Caja legacy en Oleada C.
- **Entrega:** `quality-reports/oleada-b/ENTREGA_OLEADA_B.md`.

## 1. Principios de la migración

**Se preserva:**

- Modelos y contratos de negocio.
- Persistencia SQLite, migraciones y backups.
- `orders.ts`, `cash.ts`, `goals.ts`, `tasks.ts`, `payment-rules.ts`, `payment-labels.ts`, `pey-events.ts`, `checkout.ts`, `db.ts`.
- Webhook firmado de pey como única transición digital a `paid`.
- Separación demo/real, fiado/deuda, efectivo/verificado, meta virtual/dinero custodiado.
- Idempotencia (`requestId`, hash, `webhook-id`, `transactionId`, `expectedVersion`).
- Historial, auditoría y funcionalidades que ya operan.
- Pruebas p0, webhook y contratos.

**Se transforma:**

- Shell, navegación, rutas, pantallas y jerarquía.
- Componentes, formularios, estados, modales y feedback.
- Responsive, accesibilidad, microinteracciones, copy y ayuda.
- Consistencia entre Inicio y los módulos operativos.
- Sistema tipográfico y de tokens.
- Arquitectura de presentación, no la lógica de negocio.

## 2. Línea base verificable

| Dato | Valor |
|---|---|
| Páginas reales | `/inicio`, `/`, `/pay/[id]`, `/pay/[id]/success` |
| Caja | Una página con tabs internos `caja`, `fiado`, `corte`, `meta`, `pendientes` |
| Inicio | Dashboard nuevo, solo lectura, con CTA a Caja |
| Checkout | Página pública legacy, contrato funcional |
| Auth/roles | Ausente |
| Inventario/proveedores | Ausentes |
| Onboarding | Ausente |
| Exportación | Ausente |
| `caja-app.tsx` | ~8.2k líneas; concentra Caja, venta, cobro, fiado, corte, metas, pendientes, ayuda y shell |
| Evidencia full | `latest.json` es de `9206ea1`; no vale para `b8f127d` |
| `verify:evidence` | Falla 4 chequeos; árbol sucio y artefactos de otro SHA |
| `verify:fast` | 3/3 gates verdes, `ok:false` por árbol sucio |

## 3. Inventario de rutas

| URL | Componente actual | Interfaz | Funciones disponibles | Servicios/datos | Acciones que llegan | Integración design system | Dependencias | Riesgo | Pruebas | Criterio de migración |
|---|---|---|---|---|---|---|---|---|---|---|
| `/inicio` | `web/src/app/inicio/page.tsx` + `inicio.css` | **Nueva** | Saludo, 4 KPI, hero Nueva venta, Pendientes, Sugerencia, enlaces, skip link, escala de texto, alto contraste | `getDashboardData`, `listGoals`, `listTasks`, `isDemoMode` | Sidebar de Inicio, marca de Caja, PWA (`start_url`) | Parcial: sistema propio de Inicio, no compartido aún | `dashboard`, `goals`, `tasks`, `config`, assets de Inicio | Shell duplicado; navegación a módulos legacy; `Caja`/`Reportes` comparten destino | Capturas 1448/1366/390/320/200%/HC; axe 0; veredicto pendiente | Misma experiencia que el resto; nav honesta; componentes compartidos; sin deuda de shell |
| `/` | `web/src/app/page.tsx` → `CajaApp` (`caja-app.tsx`) | **Legacy** | Caja/venta, fiado, corte, meta, pendientes, ayuda, demo, QR, verificación | `/api/dashboard`, `/api/orders`, `/api/credits`, `/api/cash`, `/api/goals`, `/api/tasks`, `/api/verify`, `/api/demo/*` | Inicio CTA, sidebar, marca, deep links `?tab=` | Baja: shell y CSS heredados | Monolito; `db.ts`; `orders.ts`; `cash.ts`; `goals.ts`; `tasks.ts` | Regresión financiera si se reescribe sin contratos; colisión de archivos | p0-venta 66/0, p0-fiado 51/0, p0-corte 69/0, p0-dinero 45/0+3 KNOWN | Rutas y componentes nuevos; misma lógica; p0 verdes; verificación independiente |
| `/pay/[id]` | `web/src/app/pay/[id]/page.tsx`, `checkout-client.tsx`, `checkout.css` | **Legacy** | Checkout público, métodos demo/reales soportados, estado, QR/link | `checkout.ts`, `/api/checkout/[id]`, `/api/demo/pay`, `/api/verify` | Link/QR generado en Caja | Baja | `checkout.ts`, `payment-labels.ts`, `orders.ts` | No mostrar demo como real; no confirmar offline | checkout 19/19, webhook 40/40 | UI nueva, mismos contratos, estados de pago inequívocos |
| `/pay/[id]/success` | `web/src/app/pay/[id]/success/page.tsx`, `success-client.tsx` | **Legacy** | Polling de estado, pendiente/verificado/demo/efectivo | `/api/checkout/[id]`, `/api/verify` | Checkout | Baja | `checkout.ts`, `payment-labels.ts` | Estado falso si se pinta sin servidor | checkout 19/19 | UI nueva; estados derivados del servidor; no confirmar por cliente |

### Rutas objetivo propuestas

> **Decisión de Oleada A:** durante la migración se mantienen los tabs con `?tab=` como fuente de verdad. Las rutas con pantalla o tab existente se exponen como alias HTTP 307; las que no tienen pantalla (`/caja`, `/reportes`, `/productos`, `/proveedores`, `/ayuda`, `/ajustes`) no se activan. `/ventas` es el alias de la pantalla de venta mientras no exista un historial separado.

| Ruta objetivo | Origen actual | Contenido |
|---|---|---|
| `/inicio` | `/inicio` | Dashboard editorial |
| `/ventas` | tab `caja` | Historial/consulta de ventas |
| `/ventas/nueva` | tab `caja` | Flujo Nueva venta |
| `/fiados` | tab `fiado` | Clientes, saldos, abonos, historial |
| `/caja` o `/corte` | tab `corte` | Corte, gastos, retiros, diferencias |
| `/pendientes` | tab `pendientes` | Tareas, vencimientos, historial |
| `/metas` | tab `meta` | Metas, aportaciones, historial |
| `/productos` | ausente | Inventario, existencias, precios |
| `/proveedores` | ausente | Fichas y pedidos |
| `/reportes` | `BusinessOverview` dentro de Corte | Reportes por periodo |
| `/ayuda` | sheet `Ayuda y ajustes` | Ayuda contextual |
| `/ajustes` | `#ajustes` dentro del sheet | Texto, contraste, voz |
| `/onboarding` | ausente | Primera venta de práctica |

Durante la migración, `/` puede seguir sirviendo Caja y `?tab=` puede redirigir a la ruta nueva. Al cerrar cada oleada, las rutas antiguas deben redirigirse o retirarse; no se declara migrada una pantalla que siga enviando a legacy.

## 4. Matriz de migración

| Ruta/módulo | Componente actual | Componente objetivo | Contratos reutilizados | Estado | Evidencia |
|---|---|---|---|---|---|
| Inicio | `inicio/page.tsx`, `inicio.css` | `InicioPage` + `AppShell`, `MetricCard`, `TaskRow`, `SuggestionCard` | `dashboard`, `goals`, `tasks`, `config` | **A (local)**: Hearth/Alder + AppShell + navegación honesta + alias 307; pendiente commit y verificación formal | Capturas `oleada-a/capturas/`, `14_EVIDENCIAS/` |
| Nueva venta | `CajaPanel`, `PaymentPanel` | `SalePage` + `Ticket`, `PaymentMethod`, `PaymentStatus`, `CurrencyAmount` | `orders`, `payment-rules`, `payment-labels`, `/api/orders`, `/api/orders/[id]/pay` | **B**: legacy visual; selector de método y shell nuevo en Oleada B | `p0-venta-e2e.json` 66/0 |
| Caja/consulta | `CajaBook`, `ActivityList` | `SalesPage` + `SaleRow`, `CurrencyAmount` | `orders`, `dashboard` | **B**: legacy visual; shell nuevo pendiente en Oleada B | p0-venta 66/0, HIG 5/5 |
| Cobros/QR | `PaymentPanel`, `QrImage`, `VerifyCard` | `PaymentPage`/`PaymentStatus` | `pey`, `checkout`, webhook, `/api/verify` | **B**: legacy visual; contrato funcional | webhook 40/40, checkout 19/19 |
| Fiado | `CreditList`, `CreditPaySheet` | `FiadoPage` + `CustomerSearch`, `CreditRow`, `PaymentSheet` | `credits`, `orders`, `/api/credits` | **B**: legacy visual; shell nuevo pendiente | p0-fiado 51/0 |
| Corte | `CashCloseCard`, `ClosingChecklist`, `BusinessOverview`, `ReconcileCard` | `CashClosePage` + `CashSummary`, `DenominationGrid`, `DifferenceBanner` | `cash`, `/api/cash`, `/api/cash/preview`, `/api/cash/close` | **B**: legacy visual; shell nuevo pendiente | p0-corte 69/0 |
| Metas | `GoalCard` | `GoalsPage` + `GoalCard`, `ContributionForm`, `ProgressIndicator` | `goals`, `/api/goals`, `/api/goals/[id]/contribute` | **B/C**: legacy visual; solo `goals[0]`, sin crear/editar/historial UI | p0-fix-datos, HIG |
| Pendientes | `PendingTasksPanel` (`pending-tasks.tsx`) | `PendingPage` + `TaskRow`, `TaskForm`, `EmptyState` | `tasks`, `/api/tasks` | **B/C**: legacy visual; CRUD real, sin agrupación/historial de posposiciones | tasks-contract, p0-integracion |
| Ayuda | `HelpContent` | `HelpPage`/`HelpSheet` + `Accordion`, `ContextHelp` | contenido estático | **B**: legacy visual; título “Ayuda y ajustes” | 08/CIERRE reports |
| Ajustes | bloque `#ajustes` | `SettingsPage` + `TextSize`, `Contrast`, `VoiceRate` | localStorage | **B/C**: legacy visual; texto/contraste/voz funcionan | navegación `?ayuda=1#ajustes` |
| Checkout público | `pay/[id]/*` | `CheckoutPage` + `PaymentStatus` | `checkout`, `verify`, demo | **B**: legacy visual; contrato funcional | checkout 19/19 |
| Reportes | `BusinessOverview` dentro de Corte | `ReportsPage` | `analytics`, `dashboard` | **D**: no hay pantalla independiente | API analytics |
| Productos/inventario | — | `ProductsPage` | Ninguno | **D**: ausente; construir modelo/API/UI | `GOAL.md` |
| Proveedores | — | `SuppliersPage` | Ninguno | **D**: ausente; construir modelo/API/UI | `GOAL.md` |
| Onboarding | — | `OnboardingPage` + práctica aislada | Ninguno | **D**: ausente; construir flujo | `GOAL.md` |
| Auth/roles | — | `Auth`/`Permissions` | Ninguno | **D**: ausente; decisión de seguridad/alcance | `SECURITY.md` |
| Exportación | — | `ExportPage`/API | Ninguno | **D**: ausente | `GOAL.md` |

## 5. Inventario de módulos y componentes

### Caja y venta

- `CajaApp` (`web/src/components/caja-app.tsx`): shell, estado global, tabs, dashboard, modales.
- `CajaBook`: resumen, accesos rápidos, actividad.
- `CajaPanel`: captura por voz/texto/manual, draft, cantidades, precio, efectivo, fiado, total, confirmar.
- `PaymentPanel`: link/QR, polling, demo, estado pendiente.
- `VerifyCard`: verificación de comprobante.
- `ActivityList`: movimientos.
- `PendingPayments`: cobros pendientes.
- `PaidSheet`: resultado del cobro.
- `QrImage`: QR real del payload; no es ilustración.
- `StatusBadge`, `paymentTruth`, `paymentSheetTitle`.

### Fiado y corte

- `CreditList`: saldo, clientes, abonos; sin búsqueda/historial/recordatorios.
- `CreditPaySheet`: abono con método, `requestId`, saldo esperado, sobrepago.
- `CashCloseCard`: fondo, ventas, abonos, gastos, retiros, esperado, contado, diferencia, versiones.
- `ClosingChecklist`: pendientes antes de cerrar.
- `BusinessOverview`: efectivo, verificado, declarado, demo, fiado.
- `ReconcileCard`: conciliación read-only.

### Metas y pendientes

- `GoalCard`: progreso, aportación, fecha, explicación de no custodia; solo primera meta.
- `PendingTasksPanel`: crear, completar, posponer, eliminar, reabrir; sin agrupación principal.
- `CompanionPreferences`: sugerencias, recordatorios, explicaciones.

### Ayuda y shell

- `HelpContent`: FAQ, accesibilidad, primeros pasos, `#ajustes`.
- `DemoContent`: reset/estado demo.
- `AppSidebar`, `TopBar`, `MobileTabBar`, `Sheet`.
- Inicio: `inicio/page.tsx`, `InicioPreferences` eliminado; preferencias por script inline de `layout.tsx`.

## 6. Contratos financieros que no se tocan

1. Solo `POST /api/webhooks/pey` con firma válida transiciona `payment_pending → paid`.
2. Una captura, un QR o una respuesta del cliente no confirman dinero.
3. `demo_paid` nunca es `paid`; no es entregable ni suma a caja real.
4. Efectivo registrado ≠ pago bancario verificado.
5. Fiado es deuda; un abono no crea venta nueva.
6. Corte: `expected = opening + cashSales + cashCredit - expenses - withdrawals`; digital no entra al cajón.
7. Meta virtual no es custodia, banco ni rendimiento.
8. Idempotencia de venta/abono/meta/corte/webhook se conserva.
9. `requestId`, hash, `webhook-id`, `transactionId`, `expectedVersion` y fingerprint no se relajan.
10. No se inventan métodos, montos, clientes, existencias ni estados si el backend no los soporta.

**Archivos congelados hasta que exista dueño explícito y pruebas:** `lib/orders.ts`, `lib/cash.ts`, `lib/db.ts`, `lib/pey-events.ts`, `lib/pey.ts`, `lib/payment-rules.ts`, `lib/payment-labels.ts`, `lib/checkout.ts`, `app/api/**` financiero, `app/pay/**`, `proxy.ts`, `next.config.ts`.

## 7. Design system objetivo

### Tokens

- Papel cálido, verde profundo, terracota, maíz.
- Superficies, bordes, radios, sombras sutiles.
- Tipografía display para marca/editorial; UI para operaciones.
- Cifras tabulares; separadores es-MX.
- Foco visible; estados hover/active/disabled/loading/success/warning/pending/error.
- Contraste normal y alto; reflow 200%; `prefers-reduced-motion`.

### Componentes objetivo

`AppShell`, `Sidebar`, `MobileNav`, `TopBar`, `PageHeader`, `Card`, `MetricCard`, `SectionHeader`, `Button`, `IconButton`, `CurrencyAmount`, `PaymentStatus`, `EmptyState`, `Modal`, `FormField`, `SearchField`, `TaskRow`, `ProgressIndicator`, `Toast`, `StatusBanner`.

### Hearth + Alder

- El código actual usa **Fraunces + Inter**.
- No hay archivos, licencias ni configuración de **Hearth + Alder** en el repo.
- **Bloqueo:** confirmar si son fuentes nuevas que se deben incorporar o nombres de rol para display/UI. No instalar ni sustituir sin autorización.
- Mientras no se confirme, no se declara el sistema tipográfico terminado.

## 8. Navegación objetivo

### Escritorio

- Sidebar compartido entre Inicio y módulos; mismo ancho, marca, iconos y estados.
- Inicio activo en `/inicio`; cada módulo con ruta propia y `aria-current`.
- `Ventas` → Nueva venta/ventas; `Fiados` → fiados; `Caja` → corte; `Reportes` → reportes; `Productos`/`Proveedores` solo cuando existan.
- `Ayuda` y `Ajustes` con destinos distintos y operativos.
- No duplicar `Caja`/`Reportes` en la misma ruta sin razón documentada.

### Móvil

- Barra inferior con accesos prioritarios: Inicio, Ventas/Nueva venta, Fiados, Caja y “Más”.
- “Más” incluye Productos, Proveedores, Reportes, Pendientes, Metas, Ayuda y Ajustes.
- No ocultar rutas; no usar scroll horizontal como única salida.
- Objetivos táctiles ≥44/48; safe areas; teclado virtual.
- No reutilizar el sidebar de escritorio como bloque de 204 px antes del contenido.

## 9. Plan por oleadas

### Oleada A — Fundación

**Dueños:** `mc-sistema-diseno` + `mc-shell-responsive`.
**Archivos propietarios:** tokens/`globals.css`, nuevos `components/ui/*`, `layout.tsx`, shell/nav. **No** editar `caja-app.tsx` en paralelo.
**Entregables:** tokens, Hearth/Alder (si se aprueban), AppShell, Sidebar, MobileNav, TopBar, Modal, FormField, estados, iconografía.
**Aceptación:** una sola fuente de tokens; sin CSS de overrides acumulados; axe normal/HC; 1448/390; teclado; capturas.

### Oleada B — Flujo principal

**Dueños:** `mc-ventas-pagos` + `mc-sistema-diseno` + `mc-shell-responsive`.
**Alcance:** Nueva venta → ticket editable → método de cobro → confirmación → comprobante/registro → retorno; Caja y consulta de ventas.
**Contratos:** `orders`, `payment-rules`, `payment-labels`, QR/webhook/verify.
**Aceptación:** p0-venta 66/0, webhook 40/40, checkout; selector de método; sin doble cobro; demo separado; capturas.

### Oleada C — Continuidad

**Dueños:** `mc-fiado-corte` + `mc-modulos-negocio`.
**Alcance:** fiados, clientes, abonos, pendientes, corte, historial/reportes relacionados.
**Aceptación:** p0-fiado 51/0, p0-corte 69/0, p0-dinero 45/0+3 KNOWN; saldos y corte conciliables; capturas.

### Oleada D — Gestión y crecimiento

**Dueños:** `mc-modulos-negocio` + `mc-onboarding-ayuda`.
**Alcance:** productos/inventario, proveedores, metas, reportes, ayuda, ajustes, onboarding.
**Nota:** inventario, proveedores y onboarding **no existen**; se construyen como alcance nuevo, no se “migran” de una UI previa.
**Aceptación:** modelo/API/UI reales; sin datos inventados; estados vacío/carga/error; capturas; pruebas.

### Oleada E — Integración total

**Dueños:** todos + `mc-accesibilidad` + `mc-verificador-final`.
**Alcance:** navegación completa, responsive, accesibilidad, assets, rendimiento, regresión, consistencia.
**Aceptación:** matriz A/B/C/D/E sin pantallas legacy presentadas como migradas; capturas de cada ruta; gates; veredicto independiente.

## 10. Estado A–E

| Estado | Significado | Módulos |
|---|---|---|
| **A** | Completo visual y funcional, aprobado | **Ninguno todavía** |
| **B** | Visual nueva o parcial; migración visual/funcional pendiente | Inicio, Caja/venta, fiado, corte, metas, pendientes, ayuda/ajustes, checkout |
| **C** | Funcionalidad pendiente | Selector de método, fiado avanzado, metas crear/editar/historial, reportes, onboarding |
| **D** | Bloqueado o ausente | Productos/inventario, proveedores, auth/roles, exportación, onboarding |
| **E** | No verificado | Migración completa; lector de pantalla real; pey real; auth |

## 10.1 Veredicto independiente de Fase 1

**Archivo:** `quality-reports/mercado-cero-final/CIERRE_FASE_1/VEREDICTO_INDEPENDIENTE.md`
**Sesión:** `ses_e5b95ac25ffe81Ui9rxpxFUEos`

| Dimensión | Resultado |
|---|---|
| Visual/funcional/demo de Inicio | **APROBADO CON LIMITACIONES** |
| Handoff / merge | **RECHAZADO — NO GO** |
| WCAG 2.2 AA | **NO EMITIDA**; lector de pantalla NOT RUN |

**Cerrado por el verificador:**

- La captura 1448×1086 es `/inicio`, no Caja. 4 KPI en fila, hero a la izquierda, Pendientes a la derecha y Sugerencia abajo.
- P0/P1 de producto anteriores cerrados: alto contraste real, assets con alfa, skip link, escala de texto, CTA móvil, reflow 200 %, foco de Ajustes y KPI sin overflow.
- Axe 0 en normal, `data-contrast=high` y forced-colors en 1448/390/320.
- Navegación Inicio ↔ Caja, deep links, `?ayuda=1#ajustes`, “Ver todos” 48 y CTA visible a 390/320.
- Sin cambios en lógica financiera, pagos, webhooks, DB ni auth. p0-venta 66/0, p0-fiado 51/0, p0-corte 69/0, p0-dinero 45/0 + 3 KNOWN, webhook 40/40.

**Pendientes P2/P3 relevantes:**

- Nav móvil de 40 px; “Caja” y “Reportes” comparten `/?tab=corte` y “Ventas” abre Caja.
- “Productos/Proveedores” con 3.64–4.07:1 y “Próximamente” no expuesto en el árbol de accesibilidad.
- Estado “hecho” de una tarea solo visual, no anunciado.
- Marca/topbar/nav/ancho/papel picado/KPI 3/tipografía de apoyo; franja de 9 px en Sugerencia.
- Breakpoint 1340 apila todo el dashboard; a 1280×800 el CTA queda en `y≈794`.
- “Ver todos” lleva a Pendientes vacío mientras Inicio muestra ejemplos demo.
- `?ayuda=1` también desplaza a Ajustes (no solo `#ajustes`).
- CSS muerto, BOM y crop del manifiesto de assets.

**Bloqueo de handoff:**

- Árbol sucio: 10 modificados + 17 assets nuevos + `quality-reports/` untracked.
- `latest.json` de `9206ea1`; no hay `latest-static.json`.
- `verify:evidence` falla 4 chequeos; no hay `static/full` sobre `b8f127d`.
- p0 con `dirty:true`; webhook sin JSON de gate.
- `harness/STATE.md` sin actualizar.

## 11. Defectos y bloqueos conocidos

1. **Fase 1 sin veredicto final** (verificador en curso). No se abre Oleada A hasta leerlo.
2. **Árbol sucio**: 10 modificados, 17 assets nuevos, `quality-reports/` untracked; sin commit autorizado.
3. **Evidencia de handoff inválida**: `latest.json` de `9206ea1`; `verify:evidence` falla; no `latest-static`.
4. **Hearth/Alder no confirmados**; el stack actual es Fraunces/Inter.
5. **Módulos ausentes**: inventario, proveedores, onboarding, auth/roles, exportación.
6. **`caja-app.tsx` monolito**: cualquier carril que lo edite colisiona; extraer antes de paralelizar.
7. **Shell duplicado** Inicio/Caja; la migración debe unificar.
8. **Navegación**: `Caja` y `Reportes` comparten `/?tab=corte`; decidir ruta/etiqueta.
9. **Caja legacy a11y**: `label-content-name-mismatch` preexistente; alto contraste con 8–10 nodos; target móvil 28×28.
10. **Pey real no validado**; webhook 40/40 es contrato sintético.
11. **Lector de pantalla real NOT RUN** (NVDA/TalkBack/VoiceOver).
12. **Inicio P2/P3**: marca/topbar/nav, sugerencia, papel picado, KPI 3, tipografía de apoyo; no bloquean la migración, pero deben resolverse en la fundación.

## 12. Evidencia y seguimiento

- Fase 1: `quality-reports/mercado-cero-final/CIERRE_FASE_1/` y `14_EVIDENCIAS/`.
- Tests actuales: `14_EVIDENCIAS/tests/` y `webhook-40-40.txt`.
- Capturas: `14_EVIDENCIAS/capturas/`, `variantes/`, `montos/`, `navegacion/`.
- Comparación: `CIERRE_FASE_1/comparacion-1448.png`.
- Este documento debe actualizarse al cerrar cada oleada con: rutas, componentes, contratos, cambios, defectos, pruebas, capturas, subagentes y bloqueos.
- No se presentará una captura de Inicio como prueba de todo el producto.

## 13. Decisiones necesarias antes de implementar

| Decisión | Opciones | Impacto |
|---|---|---|
| Autorizar commit de la Fase 1 | Commit de revisión vs snapshot equivalente | Base limpia para evidencia y handoff |
| Hearth + Alder | Fuentes nuevas con archivos/licencia vs nombres de rol para Fraunces/Inter | Sistema tipográfico y tokens |
| Rutas | Mantener `?tab=` vs rutas independientes | Navegación, deep links, PWA |
| `/` durante migración | Mantener Caja legacy vs redirigir a `/caja`/`/inicio` | Continuidad de enlaces |
| Módulos ausentes | Construir en Oleada D vs fuera de alcance | Tiempo y expectativa del producto |
| Auth/roles | Implementar vs single-user local documentado | Seguridad y permisos |
| `start_url` PWA | `/inicio` vs `/` | Entrada de la app |

## 14. Siguiente paso

1. **Fase 1 concluida con limitaciones:** el verificador independiente aprobó visual/funcional/demo, pero rechazó handoff/merge.
2. **No abrir Oleada A todavía.** Primero resolver el handoff: autorizar commit/snapshot, limpiar el árbol, ejecutar `static/full` sobre el HEAD y actualizar `harness/STATE.md`.
3. Resolver las decisiones de producto: Hearth/Alder, rutas, `/` durante la migración, módulos ausentes, auth/roles y `start_url`.
4. Validar esta matriz con `mc-auditoria-repo`.
5. Abrir **Oleada A** solo con base limpia y decisiones escritas.
6. Verificación independiente al cierre de cada oleada.

**No se declara migrada ninguna pantalla. No se declara completo el producto. Inicio es la primera expresión visual, no el producto terminado.**
