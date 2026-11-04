# 11 · Preflight de Fase 4 (solo lectura)

> **Decisión:** **FASE 4 BLOQUEADA. No se inicia la consolidación de producto, onboarding ni validación completa.**
> Fecha: 3 nov 2026 · Rama `design/mercado-cero-v2` · HEAD `b8f127d`.
> Motivo: la condición de entrada es que Inicio, Design System y Caja hayan aprobado sus criterios. Inicio está **RECHAZADO**, Fase 2 no ha comenzado y Fase 3 no ha comenzado.
> Este documento es un **preflight de lectura**, no una implementación. No se modificó código.

## 1. Gate de entrada

| Gate exigido | Estado | Evidencia |
|---|---|---|
| Inicio aprobado | **NO** | `08_VEREDICTO_INDEPENDIENTE.md` → RECHAZADO |
| Design System aprobado | **NO** | `09_GATE_FASE_2.md` |
| Caja/venta/cobros aprobados | **NO** | `10_PREFLIGHT_FASE_3.md` |
| Árbol limpio | **NO** | 3 archivos modificados + `quality-reports/` untracked |
| Evidencia del HEAD | **NO** | `latest.json` es de `9206ea1`; no hay `latest-static.json` |
| Matriz de producto validada | **NO** | Este documento es solo un inventario preliminar |

**No se debe implementar Fase 4 hasta que esos gates cambien.** La regla de `AGENTS.md` es explícita: sin `latest.json`/`latest-static.json` con `ok:true`, SHA del commit entregado, `dirty:false` y `verify:evidence` PASS, nada se considera listo.

## 2. Evidencia de esta auditoría

- Auditoría de solo lectura: `mc-auditoria-repo` equivalente, subagente `ses_e5c9c202dffeUvCbG3caf2GIn5`.
- No se editaron archivos, no se hicieron commits, no se ejecutaron pruebas runtime.
- Inventario basado en lectura de `web/src/app`, `web/src/components`, `web/src/lib`, `web/src/app/api`, `web/scripts`, `harness/` y documentación del repo.
- Estado Git comprobado: HEAD `b8f127d`; modificados `web/src/app/inicio/inicio.css`, `web/src/app/inicio/page.tsx`, `web/src/assets/inicio/sidebar-plantas.png`; `quality-reports/` untracked.

## 3. Rutas reales

Solo existen cuatro páginas:

| Ruta | Tipo | Qué hace |
|---|---|---|
| `/` | Caja | Tabs internos `caja`, `fiado`, `corte`, `meta`, `pendientes`; acepta `?tab=` y `?ayuda=1` |
| `/inicio` | Inicio | Dashboard separado; KPIs, pendientes, sugerencia y enlaces |
| `/pay/[id]` | Checkout público | Orden pública; link/QR y estados de pago |
| `/pay/[id]/success` | Confirmación pública | Polling de estado; no marca `paid` |

No existen rutas de página `/caja`, `/fiado`, `/corte`, `/meta`, `/pendientes`, `/productos`, `/proveedores` ni `/login`. Los tabs de Caja son estado interno de una sola página, no rutas.

APIs reales principales: `/api/dashboard`, `/api/orders`, `/api/orders/[id]/pay`, `/api/webhooks/pey`, `/api/credits`, `/api/credits/[id]/pay`, `/api/cash`, `/api/cash/preview`, `/api/cash/close`, `/api/goals`, `/api/goals/[id]/contribute`, `/api/tasks`, `/api/tasks/[id]`, `/api/checkout/[id]`, `/api/verify`, `/api/reconcile`, `/api/demo/*`, `/api/voice/*`, `/api/tts`, `/api/analytics`, `/api/health`.

No existen `/api/auth`, `/api/users`, `/api/customers`, `/api/inventory`, `/api/products`, `/api/suppliers`, `/api/export` ni una ruta de sincronización offline.

## 4. Matriz de módulos (preliminar)

| Módulo | Estado | Evidencia | Nota |
|---|---|---|---|
| Caja / Nueva venta | **Parcial** | `caja-app.tsx:2471-2731,3253-3967`; `orders.ts:99-362` | Voz, texto, manual, draft, efectivo, fiado, link/QR, polling y demo. Falta selección explícita Efectivo/Digital/Fiado; `paymentMethod` se acepta en API pero no se usa en `createOrder`. |
| Cobro digital / QR | **Parcial** | `PaymentPanel` `4014-4458`; `orders/[id]/pay`; `webhook/pey` | Link/QR y webhook firmado. No hay pantalla de escaneo, expiración real ni estado operativo `failed`/`expired`; “expira en 10 minutos” es copy fijo. |
| Fiado: listado y saldo | **Parcial** | `CreditList` `6590-6735`; `api/credits` | Lista plana, sin búsqueda, filtros ni historial por cliente. |
| Fiado: abonos | **Completo** | `CreditPaySheet` `6742-6997`; `orders.ts:791-964` | Abono con método, nota, `requestId`, `expectedBalanceCents`, sobrepago devuelto y saldo no negativo. |
| Fiado: recordatorios/correcciones | **Ausente** | `orders.ts:303-322` crea `due_date=null`; API solo lista y abona | No hay recordatorios, vencimiento, anulación ni corrección de abono. |
| Corte de caja | **Completo en efectivo** | `CashCloseCard` `4974-6033`; `cash.ts:200-492` | Fondo, ventas, efectivo, abonos de fiado, gastos, retiros, esperado, contado, diferencia y denominaciones. Digital verificado se reporta aparte, no se suma al cajón. |
| Corte: correcciones versionadas | **Completo** | `cash.ts:398-412`; `caja-app.tsx:5958-6020` | Exige motivo, `expectedVersion`, fingerprint y conserva versiones. |
| Metas: aportar/progreso | **Parcial** | `GoalCard` `6036-6270`; `goals.ts:108-245` | Aportación idempotente y explicación de dinero no custodiado. Solo usa `goals[0]`. |
| Metas: crear/editar/historial | **Parcial / ausente** | API `POST /api/goals`; no hay UI de creación | Crear solo por API; no hay edición ni historial visible de aportaciones. |
| Inventario/productos | **Ausente** | `db.ts:107-273` sin tabla; `inicio/page.tsx:46-47,97-104` “Próximamente” | `voice-local.ts` tiene un catálogo de nombres/precios para el parser; **no es inventario**. |
| Proveedores/pedidos | **Ausente** | Sin tabla, API ni UI | Pendientes puede anotar “pagar al proveedor”, pero no existe entidad proveedor ni pedido de compra. |
| Pendientes | **Parcial** | `pending-tasks.tsx`; `tasks.ts:236-343`; `/api/tasks/*` | CRUD real, soft delete, reabrir y “Hechas”. Sin agrupación en la pestaña principal ni historial de posposiciones. |
| Onboarding / primera venta | **Ausente** | `caja-app.tsx:8088-8095` solo “Primeros pasos” estáticos | El modo demo es un sandbox por flag, no un flujo de práctica separado. |
| Ayuda contextual | **Parcial** | `HelpContent` `7908-8129` | FAQ fija, accesibilidad y primeros pasos; no depende del estado del negocio. |
| Asistente / IA opcional | **Parcial** | `/api/voice/*`; `voice-local.ts`; `closing-checklist.tsx` | Parser de voz/texto y consultas locales. No hay asistente conversacional ni chat. |
| Recomendaciones deterministas | **Parcial** | `closing-checklist.tsx:213-218`; `inicio/page.tsx:249-256` | Solo “Antes de cerrar” es determinista; la sugerencia de Inicio es copy estático. |
| Auth / usuarios / permisos | **Ausente** | `config.ts:1-8`; `SECURITY.md:3-5,168-169`; `proxy.ts:15-34` | Un solo comerciante; sin login, sesión, roles ni autorización. `proxy.ts` solo hace CSRF, límites y rate limit. |
| Exportación de datos | **Ausente** | Sin `/api/export` ni botón | `audit_log` y SQLite son internos; `public/credits.txt` son créditos de fotos. |
| Offline / sincronización | **Parcial** | `caja-app.tsx:405-573`; `1865-1938` | Borrador local, aviso de recuperación y `requestId` estable. Sin service worker, IndexedDB, cola offline ni venta sin red. |
| Reportes | **Parcial** | `BusinessOverview` `4466-4785`; `/api/analytics` | Reporte dentro de Corte; no hay pantalla independiente de Reportes ni exportación. |
| Checkout / verificación | **Completo en contrato/demo** | `pay/[id]/*`; `checkout.ts`; `webhook/pey`; `verify` | Código y contratos; **pago real de pey no ejecutado**. |

## 5. Matriz de los 16 escenarios E2E de Fase 4

| # | Escenario | Estado | Evidencia / brecha |
|---|---|---|---|
| 1 | Primera visita y onboarding | **Ausente** | No hay onboarding, tour ni estado de primera vez. |
| 2 | Crear venta de práctica | **Ausente** | El modo demo no es una venta de práctica con separación explícita. |
| 3 | Crear venta real | **Parcial** | `p0-venta` 66 existe; no ejecutado sobre este HEAD. |
| 4 | Registrar fiado | **Parcial** | `p0-fiado` 51 y `p0-venta`; no ejecutado sobre este HEAD. |
| 5 | Abonar parcialmente | **Parcial** | `p0-fiado` 51; no ejecutado sobre este HEAD. |
| 6 | Consultar saldo actualizado | **Parcial** | `p0-fiado` 51; no ejecutado sobre este HEAD. |
| 7 | Corte con efectivo coincidente | **Parcial** | `p0-corte` 69; no ejecutado sobre este HEAD. |
| 8 | Corte con diferencia | **Parcial** | `p0-corte` 69; no ejecutado sobre este HEAD. |
| 9 | Crear y actualizar meta | **Parcial** | Aportar sí; crear solo por API; editar e historial ausentes. |
| 10 | Completar pendiente | **Parcial** | `p0-integracion` 51 y `tasks-contract.mjs` 50; no full. |
| 11 | Interrumpir y recuperar tarea | **Parcial** | Draft y pending order; continuidad de tareas en SQLite; sin prueba específica. |
| 12 | Perder conexión y recuperar sincronización | **Ausente** | Solo borrador local; no hay cola offline ni sincronización. |
| 13 | Navegar sin IA | **Parcial** | `sin-ia-e2e.py` existe standalone; no está en el full. |
| 14 | Navegar con teclado y lector de pantalla | **Parcial** | HIG/axe parcial; sin lector real ni gate de `/inicio`. |
| 15 | Exportar datos | **Ausente** | No existe función ni API. |
| 16 | Permisos de familiares/empleados | **Ausente** | No hay auth, roles ni permisos. |

## 6. Matriz de las 16 pantallas del kit

Esta matriz es distinta de los 16 escenarios E2E. Sirve para ubicar el estado visual del producto.

| # | Pantalla | Estado | Brecha principal |
|---|---|---|---|
| 01 | Inicio escritorio | **Parcial** | P0 de contraste/assets/skip link/escala; sin gate. |
| 02 | Inicio móvil | **Parcial** | CTA bajo el pliegue, recortes, assets; sin prueba 390/320/200%. |
| 03 | Nueva venta | **Parcial** | Falta selección de método; CTA y total duplicado. |
| 04 | Selección de forma de pago | **Ausente** | No existe radio-group Efectivo/Digital/Fiado. |
| 05 | Cobro QR | **Parcial** | Sin expiración real, escaneo ni estado fallido. |
| 06 | Fiado / clientes / abonos | **Parcial** | Sin búsqueda, historial, recordatorios ni correcciones. |
| 07 | Corte de caja | **Completo (efectivo)** | Digital se reporta aparte; no se suma al cajón. |
| 08 | Metas | **Parcial** | Solo primera meta; crear/editar/historial incompletos. |
| 09 | Inventario | **Ausente** | Sin modelo, API ni UI. |
| 10 | Proveedores | **Ausente** | Sin modelo, API ni UI. |
| 11 | Pendientes | **Parcial** | Sin agrupación principal ni historial de posposiciones. |
| 12 | Reportes | **Parcial** | Solo `BusinessOverview` dentro de Corte. |
| 13 | Onboarding / práctica | **Ausente** | Sin tour ni venta de práctica. |
| 14 | Asistente opcional | **Ausente como asistente** | Solo parser de voz y FAQ. |
| 15 | Accesibilidad | **Parcial** | `/inicio` fuera de HIG/axe; sin lector real. |
| 16 | Navegación / shell | **Parcial** | Shell duplicado Inicio/Caja; labels engañosos; URL no sincroniza tabs. |

**Conteo preliminar:** 1 completa (Corte en efectivo), 10 parciales, 5 ausentes (selección de método, inventario, proveedores, onboarding, asistente).

## 7. Qué es real, demo, solo UI y ausente

### Real

- Venta en efectivo y mixta, cambio, validaciones e idempotencia: `orders.ts:99-362`; `caja-app.tsx:1865-1990`.
- Fiado y abonos con saldo vivo, sobrepago devuelto y bloqueo de doble abono: `orders.ts:791-964`.
- Link/QR y polling: `orders/[id]/pay`; `caja-app.tsx:1992-2015,4299-4456`.
- Webhook firmado, idempotencia y conciliación: `webhooks/pey/route.ts:120-238`; `pey-events.ts:146-157,285-297`.
- Checkout público y estados: `pay/[id]`, `checkout.ts`, `payment-labels.ts`.
- Corte de caja en efectivo, denominaciones, diferencia y versiones: `cash.ts`; `caja-app.tsx:4974-6033`.
- Aportación a meta: `goals.ts:108-245`.
- Pendientes CRUD y soft delete: `tasks.ts:236-343`.
- Recuperación de borrador y pedido pendiente: `caja-app.tsx:405-573,2525-2563`.

### Demo / fixture

- Fiado de Juan, venta demo de quesadillas, meta “Mi primera sombrilla”, historial de 13 ventas, cobro pendiente y corte de ayer: `db.ts:1039-1245`.
- Tareas de ejemplo de Inicio: `inicio/page.tsx:71-78,241-243`; etiquetadas “Ejemplos demo; no son tareas reales”.
- Botones “Simular CoDi” / “Simular tarjeta” y `/api/demo/pay`.
- **No son fixtures:** `SAMPLE_PHRASES` (ayuda) ni `CATALOG` de `voice-local.ts` (vocabulario del parser).

### Solo UI / navegación engañosa

- “Productos” y “Proveedores” en Inicio son `span aria-disabled` “Próximamente”.
- “Ajustes” y “Ayuda” abren el mismo `/?ayuda=1`.
- “Ventas” y “Caja” apuntan ambos a `/`.
- “Reportes” apunta a `/?tab=corte`.
- “Expira en 10 minutos” del QR es copy fijo.
- La sugerencia de Inicio es copy estático.
- “Recordatorios” y “Explicaciones” de acompañamiento se guardan, pero solo “Sugerencias” tiene efecto.

### Ausente

- Inventario, existencias, precios de catálogo y reposición.
- Proveedores y pedidos de compra.
- Login, usuarios, sesiones, roles, empleados y permisos familiares.
- Exportación CSV/JSON.
- Service worker, IndexedDB, cola offline y sincronización.
- Onboarding, tutorial, tour y venta de práctica con impacto cero.
- Asistente conversacional y recomendaciones basadas en datos fuera del checklist.
- Búsqueda de fiado, historial por cliente, recordatorios y correcciones/anulaciones.
- Crear/editar meta e historial de aportaciones desde la UI.
- Estado operativo de pago fallido o QR expirado.
- Anulación/cancelación de venta.

## 8. Contratos financieros que no se tocan

1. Solo `POST /api/webhooks/pey` con firma válida transiciona `payment_pending → paid`.
2. El efectivo se registra `provider='cash'`, `method='cash'`, `status='paid'` al crear la venta; no se “verifica” con webhook.
3. `demo_paid` nunca es `paid`; no es entregable ni suma a caja real.
4. Fiado es deuda, no ingreso; el abono se aplica al saldo y no crea venta.
5. Corte: `expected = opening + cashSales + cashCredit - expenses - withdrawals`; `difference = counted - expected`. No suma digital al cajón.
6. Metas: apartado declarado, no custodia, no rendimiento, no `payment` ni `order`.
7. Idempotencia: `requestId` + hash en ventas, abonos y metas; `webhook-id`/`transactionId` en pagos; `expectedVersion`/fingerprint en corte.
8. Separación demo/real: filtros `demo=0`, `demo_paid`, ids `demo_*`; reset con backup y bloqueo por datos reales.
9. `audit_log` y `payment_events` son evidencia; no borrar ni exponer payloads completos.
10. CSRF, límites de cuerpo, rate limit y token de reset no son autenticación, pero no se desactivan.

**Archivos congelados para UI:** `lib/orders.ts`, `lib/pey-events.ts`, `lib/pey.ts`, `lib/payment-rules.ts`, `lib/payment-labels.ts`, `lib/cash.ts`, `lib/db.ts`, `app/api/webhooks/pey/**`, `app/api/orders/**`, `app/api/credits/**`, `app/api/cash/**`, `app/api/verify/**`, `app/pay/**`, `lib/checkout.ts`, `proxy.ts`, `next.config.ts`, `.env.local`.

## 9. Riesgos de ownership y colisión

| Archivo | Módulos que lo tocan | Riesgo |
|---|---|---|
| `web/src/components/caja-app.tsx` (~322 KB, ~8.2k líneas) | Caja, venta, cobro, fiado, corte, metas, pendientes, ayuda, shell, a11y | **Crítico.** Casi cualquier carril edita el mismo archivo. Serializar o extraer componentes antes de Fase 4. |
| `web/src/lib/db.ts` | Esquema, migraciones, dashboard, fiado, corte, metas, tareas, reset demo | **Crítico.** Cualquier tabla nueva toca migraciones y puede romper datos. |
| `web/src/lib/orders.ts` | Venta, pagos, fiado, checkout, webhook | **Crítico.** Corazón del dinero; no editar sin contrato y tests. |
| `web/src/lib/cash.ts` + `api/cash/*` | Corte, dashboard, reportes | **Alto.** Fórmula y versionado compartidos. |
| `web/src/app/api/webhooks/pey/**` + `lib/pey-events.ts` + `lib/pey.ts` | Pagos, checkout, verificación | **Crítico.** Congelado salvo dueño explícito y pruebas. |
| `web/src/lib/payment-labels.ts` + `payment-rules.ts` + `lib/checkout.ts` | Copy de verdad, checkout, UI | **Alto.** Un cambio de copy puede hacer que demo/declarado se lea como pagado. |
| `web/src/lib/tasks.ts` + `pending-tasks.tsx` + `closing-checklist.tsx` + `inicio/page.tsx` | Pendientes, onboarding, cierre | **Alto.** Tres superficies consumen las mismas tareas. |
| `web/src/lib/goals.ts` + `api/goals/*` + `GoalCard` | Metas | **Medio.** Cambios de UI suelen requerir API y esquema. |
| `web/src/lib/dashboard.ts` + `getDailySummary()` + `analytics.ts` | Inicio, Caja, Corte, reportes | **Crítico.** Un cambio de totales afecta varias pantallas y tests P0. |
| `web/src/app/inicio/page.tsx` + `inicio.css` | Inicio, shell, onboarding, diseño, a11y | **Alto.** Ya hay cambios sucios; no sobrescribir. |
| `web/scripts/harness-gate.mjs` + `harness/EVALS.md` + `package.json` | Verificación y gates | **Alto.** No editar desde carriles de producto. |
| `.env.local`, `web/data/*.db`, `harness/evidence/*`, `public/tts/*` | Secretos, datos, evidencia, audio | **No tocar.** |

## 10. Plan de oleadas cuando se abra Fase 4

> **No ejecutar ahora.** Este plan requiere que Inicio, Fase 2 y Fase 3 estén aprobados, el árbol esté limpio y la evidencia sea del HEAD.

| Ola | Trabajo | Dueño | Dependencia |
|---|---|---|---|
| 0 | Cerrar P0 de Inicio, Fase 2 y Fase 3; limpiar árbol; evidencia del HEAD | Orquestador + verificador | Nada |
| 1 | Auditoría final de módulos, rutas y contratos; congelar archivos | `mc-auditoria-repo` | Ola 0 |
| 2 | Fiado: búsqueda, historial, recordatorios, correcciones; Corte: revisión de integridad | `mc-fiado-corte` | Ola 1 |
| 3 | Metas, inventario, proveedores y pendientes | `mc-modulos-negocio` | Ola 1; esquema aprobado |
| 4 | Onboarding, primera venta de práctica, ayuda contextual y acompañamiento | `mc-onboarding-ayuda` | Olas 2–3 |
| 5 | Integración visual, responsive y componentes compartidos | `mc-sistema-diseno` + `mc-shell-responsive` | Olas 2–4 |
| 6 | A11y transversal, 16 escenarios E2E y capturas 1448/390 | `mc-accesibilidad` + `mc-verificador-final` | Olas 2–5 |
| 7 | Veredicto independiente y GO/NO-GO de demo | `mc-verificador-final` | Ola 6 |

**Regla de ownership:** un solo dueño por archivo y por ola. `caja-app.tsx` no puede tener dos editores simultáneos. Antes de Fase 4 debe extraerse lo que Fase 2/Fase 3 no hayan separado, o asignarse a un único integrador.

## 11. Estado de los entregables A–J

| Entregable | Estado | Nota |
|---|---|---|
| A. Inventario de assets y componentes | **Preliminar** | Este documento y la auditoría de Fase 2; falta manifiesto definitivo. |
| B. Sistema de diseño centralizado | **No iniciado** | Fase 2 bloqueada. |
| C. Componentes implementados | **No iniciado** | Fase 2 bloqueada. |
| D. Capturas antes/después | **No producidas para Fase 4** | Solo captura de Inicio en `04_COMPARACION_VISUAL.png`. |
| E. Reporte de accesibilidad | **Parcial** | `08_VEREDICTO_INDEPENDIENTE.md`; no cubre Fase 4. |
| F. Registro de recursos pendientes | **Parcial** | Hero/sugerencia/sidebar; inventario/proveedores/onboarding ausentes. |
| G. Informe independiente | **No emitido para Fase 4** | El 08 es de Inicio. |

## 12. Funcionalidades demostrables vs. no presentables

### Demostrable en hackathon, **solo después de limpiar el árbol y pasar gates**

- Venta en efectivo con cambio.
- Venta a fiado y abono parcial con saldo actualizado.
- Link/QR de cobro con estado pendiente y webhook firmado en entorno controlado.
- Checkout demo claramente etiquetado.
- Corte de caja en efectivo con denominaciones y diferencia.
- Aportación a una meta existente.
- Pendientes: crear, completar, posponer y eliminar.
- Ayuda/FAQ y preferencias de acompañamiento.
- Inicio como dashboard de resumen, **si se aprueba**.

### NO presentar como terminado

- Pago real de pey: **no ejecutado**; BBVA/CoDi sigue bloqueado.
- Selección de forma de pago como pantalla completa: no existe.
- QR con expiración real, escaneo o estado fallido: no existe.
- Fiado con búsqueda, historial por cliente, recordatorios o correcciones: no existe.
- Crear/editar meta e historial de aportaciones desde la UI: no existe.
- Inventario, existencias, precios de catálogo y reposición: no existe.
- Proveedores y pedidos de compra: no existe.
- Auth, sesión, usuarios, roles, empleados y permisos familiares: no existe.
- Exportación de datos: no existe.
- Offline real, cola de sincronización o venta sin red: no existe.
- Onboarding, tutorial o primera venta de práctica: no existe.
- Asistente conversacional: no existe.
- Recomendaciones basadas en datos: solo checklist determinista.
- Reportes como pantalla independiente: no existe.
- Corte que sume digital al cajón: **no debe hacerse**.
- Meta como cuenta de ahorro o dinero custodiado: **nunca**.
- Pago demo como pago real o entregable: **nunca**.

## 13. Decisiones necesarias

### Inmediatas (bloquean incluso la remediación de Inicio)

1. **Tres archivos sucios:** ¿conservar y commitear el fix móvil/transparencia tras revisión, o revertir solo el PNG/CSS no aprobado mediante un parche explícito?
2. **`start_url` de la PWA:** ¿`/inicio` o `/`?

### De alcance de Fase 4 (cuando se abra)

| Decisión | Opciones | Impacto |
|---|---|---|
| Inventario | Catálogo ligero vs. existencias/costos/reposición | Define tablas, APIs, migraciones y UI. |
| Proveedores | Solo fichas vs. pedidos de compra | Define modelo y flujo. |
| Auth/roles | Single-user local vs. login/roles/empleados | Seguridad y permisos; hoy no hay auth. |
| Exportación | CSV/JSON vs. no incluir | Cambia entregable y pruebas. |
| Offline | Solo borrador vs. cola de sincronización | Complejidad y riesgo financiero. |
| Asistente IA | Solo determinista vs. chat opcional | Dependencia, costo y superficie de error. |
| Inicio en Fase 4 | Incluirlo o retirarlo del alcance | Hoy está RECHAZADO. |

## 14. Criterios de salida para abrir Fase 4

1. Inicio **APROBADO** por el verificador independiente.
2. Fase 2 (design system y componentes) **APROBADA**.
3. Fase 3 (Caja/venta/cobros) **APROBADA**.
4. Árbol limpio; `latest.json`/`latest-static.json` con SHA del HEAD, `dirty:false` y `verify:evidence` PASS.
5. Matriz de módulos y rutas completa, con estados reales vs. demo.
6. Contratos financieros identificados y probados.
7. 16 escenarios E2E con evidencia ejecutada, no solo scripts existentes.
8. Auditoría a11y transversal con hallazgos y correcciones.
9. Capturas 1448×1086 y 390×844 de cada ruta, comparadas con la referencia correcta.
10. Veredicto independiente **APROBADO** o **RECHAZADO** por criterio, sin autoevaluación.

## 15. Conclusión

**FASE 4 NO-GO.**

El producto tiene un núcleo real aprovechable: venta, fiado, abono, corte en efectivo, aportación a meta, pendientes y contratos de pago firmados. Pero no es un producto completo:

- 5 pantallas del kit están ausentes y 10 son parciales.
- Faltan inventario, proveedores, onboarding, auth/roles, exportación y offline real.
- Inicio sigue RECHAZADO y no tiene gate propio.
- El árbol está sucio y la evidencia full es de otro SHA.
- `caja-app.tsx` es un monolito que impide paralelizar con seguridad.

No se declara “Mercado Cero completo” por tener pantallas diseñadas. La meta es un producto coherente, funcional, seguro y usable; hoy todavía no hay evidencia para afirmarlo.
