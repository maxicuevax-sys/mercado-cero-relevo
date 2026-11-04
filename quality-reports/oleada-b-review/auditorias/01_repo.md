# 01 — Auditoría de repositorio · Oleada B (Caja y Ventas)

> **Rol:** `mc-auditoria-repo` (subagente de revisión adversarial, solo lectura).
> **Repo:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero`
> **Rama:** `design/oleada-b-caja-ventas`
> **HEAD auditado:** `4130e71d668e5e4693a8f5b634d2d2f953d21b02`
> **Base:** tag `oleada-a-cierre` = `26c7741433f18e4f4d0e78b1913df76ed09dae7e`
> **Servidor:** `http://localhost:3100`, `buildSha=4130e71d668e5e4693a8f5b634d2d2f953d21b02`
> **Fecha:** 2026-11-04
> **Alcance:** arquitectura de `/caja` y `/ventas`, rutas/compatibilidad, duplicación y riesgo de dos Cajas. No se editó producto, no se hizo commit y no se aplicaron fixes.

---

## 0. Veredicto ejecutivo

**No hay P0 en el motor financiero** (`lib/orders.ts`, `cash.ts`, `db.ts`, webhook, `api/**`, `pay/**` no cambiaron). **Sí hay 2 P0 de verdad visible del dinero en los componentes nuevos de B**, ambos reproducidos en runtime:

1. **B-01 (P0):** una venta **100 % fiada** muestra el banner “*el efectivo sí se registró en la caja*” aunque `paidCents=0`.
2. **B-02 (P0):** una venta **mixta efectivo + digital** muestra “*El dinero aún no se considera recibido*” y oculta los $60 en efectivo ya cobrados, dejando ver solo los $40 pendientes.

Estos P0 no corrompen la base: el servidor guarda bien `paidCents`/`creditCents`. El defecto es de **presentación y verdad de dinero** en la pantalla que la comerciante usa para decidir si entrega, cobra o da cambio. Por la regla de oro del repo (“fiado es deuda, no dinero recibido”), son bloqueantes de cierre.

Además hay **5 P1**:

- Un cobro pendiente **secuestra `/caja`**: se reanuda el último pendiente y no hay “Nueva venta” ni “Descartar” en el panel; ir a `/ventas` y pulsar “Nueva venta” vuelve al cobro viejo.
- **Dos Cajas, dos borradores y dos llaves** sin migración ni lock cross-tab; la navegación nueva lleva a la Caja legacy y su pestaña “Caja” no vuelve a `/caja`.
- **Mixto** permite combinaciones que producen cambio fantasma (`efectivo $100 + fiado $100` sobre total $100 → “Cambio $100, aplicado $0”) y muestra el aviso falso “El total cambió” en un reparto válido.
- El resultado demo de un **mixto efectivo + fiado** se titula “Venta cobrada en efectivo (demo)” aunque queden $30 a fiado.
- **`/ventas` oculta el efectivo ya cobrado** cuando el pedido pasa a `payment_pending`; se pierde “Cobrado $60” y solo queda “Pendiente de cobro”.

**Conclusión:** B tiene pantallas reales, usa el mismo motor y las rutas principales funcionan; pero **no está listo para cierre, demo sin acompañamiento ni handoff público** mientras existan B-01/B-02. La arquitectura es una **reescritura paralela presentacional**, no una extracción compartida de las reglas de venta/dinero/estado. Eso es la causa raíz de las divergencias.

| Decisión | Resultado |
|---|---|
| Cierre formal de B | **NO-GO** por B-01/B-02 |
| Demo con acompañamiento | Solo después de corregir B-01/B-02; el resto puede explicarse |
| Base para Oleada C | **Condicionada**: primero verdad de dinero y storage compartido, o retirar la Caja legacy |
| Motor financiero / contratos | Sin cambios en el diff; no se encontró P0 de persistencia/webhook |

---

## 1. Verificación de premisas

### 1.1 Rama, HEAD y árbol

| Comprobación | Resultado |
|---|---|
| Rama actual | `design/oleada-b-caja-ventas` |
| HEAD | `4130e71d668e5e4693a8f5b634d2d2f953d21b02` |
| Base `oleada-a-cierre` | `26c7741433f18e4f4d0e78b1913df76ed09dae7e`, ancestro de HEAD (`git merge-base --is-ancestor` = 0) |
| Árbol de producto | Limpio. `git status --porcelain` solo muestra `?? quality-reports/oleada-b-review/` (evidencia de la revisión; no es producto) |
| Commits de la ola | `d13d3df` (pantallas), `af381ad` (docs), `7c48902` (lazy + ajustes), `4130e71` (docs/cierre) |
| `4130e71` | Solo documentación: `harness/STATE.md`, `MIGRACION...`, `ENTREGA...`, `VEREDICTO...` |

### 1.2 Build y compuertas ejecutadas

| Comprobación | Resultado |
|---|---|
| `.next/BUILD_SHA` | `{"sha":"4130e71...","builtAt":"2026-11-04T17:00:05.443Z"}` |
| `GET /api/health` | `200`, `{"ok":true,"buildSha":"4130e71...","node":"v25.7.0"}` |
| `npm run typecheck` (`next typegen && tsc --noEmit`) | PASS |
| `npx eslint` sobre `app/caja`, `app/ventas`, `components/caja`, `shell/nav.ts`, `inicio/page.tsx` | PASS, sin salida |
| `git diff --check` | Falla solo por trailing whitespace en `quality-reports/oleada-b/VEREDICTO_INDEPENDIENTE.md` (documento previo, no producto) |
| `verify:full` / `verify:evidence` | **No ejecutados en esta auditoría**; no se usan como evidencia. El build servido sí corresponde a HEAD. |

### 1.3 Diff completo `oleada-a-cierre..HEAD`

`36 files changed, 13782 insertions(+), 76 deletions(-)`. El diff está dominado por documentación (9,760 líneas en 16 archivos de `quality-reports`), no por código.

**Creados (producto y scripts):**

| Archivo | Rol |
|---|---|
| `web/src/app/caja/page.tsx` | Página real de `/caja`; pasa solo `MERCHANT` y `isDemoMode()`. |
| `web/src/app/ventas/page.tsx` | Historial server-side paginado. |
| `web/src/app/ventas/ventas.css` | Estilos del historial. |
| `web/src/components/caja/caja-screen.tsx` | Orquestador cliente: estado, draft, requestId, POST y vistas. |
| `web/src/components/caja/sale-line-items.tsx` | Alta/edición/borrado de conceptos. |
| `web/src/components/caja/sale-summary.tsx` | Total, método, efectivo/fiado, CTA. |
| `web/src/components/caja/payment-panel.tsx` | Link/QR, polling, demo y estado pendiente. |
| `web/src/components/caja/sale-result.tsx` | Resultado de la venta. |
| `web/src/components/caja/types.ts` | Tipos de línea y parsers de dinero/cantidad. |
| `web/src/components/caja/caja.css` | Layout de la Caja nueva. |
| `web/scripts/oleada-b-smoke.py`, `oleada-b-a11y.py`, `oleada-b-captures.py` | Pruebas/capturas de B. |

**Modificados:**

| Archivo | Cambio |
|---|---|
| `web/next.config.ts` | `privateHeaders` para `/caja` y `/ventas` (correcto; verificado con HTTP). |
| `web/scripts/oleada-a-smoke.py` | Ajustado a rutas reales de B; dejó de probar el alias 307 de `/ventas`. |
| `web/src/app/inicio/page.tsx` | CTA “Registrar” de `/ventas` a `/caja`. |
| `web/src/components/caja-app.tsx` | Solo `ClosingChecklist` pasa a `next/dynamic` (ver 1.5). |
| `web/src/components/shell/nav.ts` | Agrega Caja; icono de Corte; alias de nav/foot. |
| `harness/STATE.md`, `quality-reports/MIGRACION_INTEGRAL_MERCADO_CERO.md` | Documentación. |

**Eliminado:**

| Archivo | Motivo |
|---|---|
| `web/src/app/ventas/route.ts` | Antiguo 307 a `/?tab=caja`. En App Router no puede coexistir con `page.tsx` en el mismo segmento; la eliminación es obligatoria para que `/ventas` sea página real. |

### 1.4 Archivos protegidos: sin cambios

Verificado con `git diff --quiet oleada-a-cierre..HEAD -- <ruta>` para cada uno:

`web/src/lib/orders.ts`, `cash.ts`, `goals.ts`, `tasks.ts`, `db.ts`, `payment-rules.ts`, `payment-labels.ts`, `pey-events.ts`, `checkout.ts`, `web/src/app/page.tsx`, `web/src/app/api/**`, `web/src/app/pay/**` → **UNCHANGED**.

También se verificó que no hay cambios sin commitear en producto: el único untracked es el directorio de esta auditoría.

### 1.5 Único cambio en `caja-app.tsx`: lazy `ClosingChecklist`

`caja-app.tsx:20-29` reemplaza el import estático por:

```tsx
const ClosingChecklist = dynamic(
  () => import("@/components/closing-checklist").then((module) => module.ClosingChecklist),
  { ssr: false },
);
```

Se usa solo en la pestaña legacy `corte` (`caja-app.tsx:2796-2809`). **Impacto:** bajo y localizado.

- No toca venta, pagos, requestId, draft ni la Caja nueva; `/caja` nunca importó `ClosingChecklist`.
- `ssr:false` no tiene fallback: al abrir `/corte` por primera vez, la tarjeta puede aparecer vacía hasta que cargue el chunk. Es un posible flash/layout shift, no un cambio de datos.
- El commit `7c48902` también retiró iconos lucide de `sale-summary`, `sale-result`, `payment-panel` y `sale-line-items`, y agregó spinner CSS. Eso sí aligera la Caja nueva, pero es un cambio visual independiente del lazy. El mensaje “aligera la Caja nueva” no describe del todo el cambio de `caja-app.tsx`, que afecta a la Caja legacy.

**No hay regresión funcional observada por este cambio.**

---

## 2. Arquitectura de `/caja` y `/ventas`

### 2.1 `/caja`: componentes y flujo

```
app/caja/page.tsx (server, connection())
  └─ CajaScreen (client, 661 líneas)
       ├─ AppShell + TopBar + PageHeader + nav compartida
       ├─ SaleLineItems   (presentacional; alta/edición/borrado)
       ├─ SaleSummary     (presentacional; método, efectivo/fiado, CTA)
       ├─ PaymentPanel    (client; link/QR, polling 5 s, demo)
       └─ SaleResult      (presentacional; hechos y acciones)
```

**Estado y fuentes de verdad:**

| Dato | Dueño | Persistencia |
|---|---|---|
| Líneas, efectivo, fiado, cliente, método | `CajaScreen` (`useState`) | `localStorage` `mercado-cero:caja-draft:v2` |
| Total/reparto/cambio | `CajaScreen` (`useMemo`, líneas 77-90) | ninguno |
| requestId idempotente | `CajaScreen` (`requestRef` + localStorage) | `mercado-cero:caja-request:v2` |
| Pedido en curso / pendiente | `CajaScreen` (`order`, `view`) | `mercado-cero:caja-pending:v2` (array) |
| Verdad del pedido | servidor (`Order`, `paidCents`, `creditCents`, `digitalPaidCents`) | SQLite |
| Crédito vivo | `GET /api/orders/[id]` → `credit.balanceCents` | SQLite |

No hay contexto, store ni provider compartido entre `/caja`, `/ventas` y `/`. El único estado compartido es la base de datos y, en el navegador, **tres pares de claves disjuntas** con la Caja legacy.

### 2.2 `/ventas`: read model server-side

`app/ventas/page.tsx` no usa la API: importa `lib/db` directamente y hace, por request:

1. `getDailySummary()`
2. `sumPendingOrderBalances()`
3. `countOrders()`
4. `listOrders(25, offset)`
5. `getCredit(order.creditId)` por cada fila con crédito (N+1, hasta 25 consultas)

La página es dinámica (`connection()`), privada (`no-store`) y paginada de verdad (25/página). Es **solo lectura**: no tiene filtros, búsqueda, detalle, link de cobro ni acción de cobrar/reanudar.

### 2.3 ¿Extracción real o reescritura paralela?

**Reescritura paralela presentacional.** No hay un solo import de `caja-app.tsx` hacia `components/caja/**`, ni módulos compartidos de venta:

- `caja-screen.tsx` importa solo React/Next, shell, `CurrencyAmount`, `format`, tipos y sus hijos locales.
- Los hijos no importan al padre; no hay ciclos. La dependencia es unidireccional: `caja-screen → {types, sale-line-items, sale-summary, payment-panel, sale-result}`.
- No existen `payment-truth.ts`, `money.ts` ni `sale-storage.ts` (los tres recomendados por la auditoría previa). Se verificó `Test-Path` = `False` para los tres.
- La lógica de dinero/estado/almacenamiento se duplica:

| Concern | Legacy `/` | Nueva `/caja` | Divergencia ya visible |
|---|---|---|---|
| Draft | `mercado-cero:draft:v1` (`caja-app.tsx:110`) | `mercado-cero:caja-draft:v2` (`caja-screen.tsx:32`) | No hay migración; ambos coexisten. |
| requestId | `sale-request:v1` (`caja-app.tsx:116`) | `caja-request:v2` (`caja-screen.tsx:33`) | Un reintento en una pantalla no protege a la otra. |
| Pendiente | `pending-order:v1` (un id, `caja-app.tsx:112`) | `caja-pending:v2` (array, `caja-screen.tsx:34`) | Dos punteros; solo se reanuda el último de v2. |
| Parseo de dinero | `parseMoney`/`parseMoneyInput` (`caja-app.tsx:216-231`) | `parseMoneyCents` (`types.ts:17-48`) | `1.000`: legacy = $1.00; nueva = $1,000.00. |
| Etiquetas de estado | `payment-labels.ts` + `StatusBadge` (`caja-app.tsx:7241-7308`) | `statusLabel` local en `sale-result.tsx` y `ventas/page.tsx` | `confirmed` digital: legacy “Por cobrar”; nueva “Registrado”. |
| Verdad de pago | `paymentTruth` (`caja-app.tsx:7315-7334`) | lógica ad hoc en `sale-result`/`payment-panel` | Origen de B-01/B-02. |
| Reparto efectivo/fiado | `caja-app.tsx:1762-1771` | `caja-screen.tsx:80-90` | Misma fórmula copiada; el bug de Mixto se corrige dos veces o se olvida una. |
| Validación | `validateDraftItems` (`caja-app.tsx:592-610`) | `validate()` (`caja-screen.tsx:210-249`) | Mensajes/reglas separados. |

**Métricas:** 1,681 líneas TSX nuevas en `components/caja` + 1,017 de CSS; `/ventas` 298 TSX + 308 CSS; legacy `caja-app.tsx` 7,827 líneas. La Caja nueva no reutiliza el motor de venta legacy, solo los contratos de API y tipos.

**Positivo:** no hay mocks ni hardcodes de negocio en `/caja` (usa `MERCHANT` y la base real); no hay dependencias circulares; se reutilizan `AppShell`, `CurrencyAmount`, `format`, `Order` y las APIs existentes.

**Riesgo:** cualquier corrección de dinero/estado debe hacerse dos veces. Los P0 de este informe son justamente el resultado de esa bifurcación.

---

## 3. Rutas y compatibilidad

### 3.1 Matriz HTTP reproducida

Evidencia: `EVIDENCIAS/repo-http-routes.json` (script `repo-http-routes.py`, sin redirects automáticos).

| Ruta | Status | Location / observación |
|---|---|---|
| `/` | 200 | Caja legacy (`CajaApp`); `Cache-Control: private, no-store` |
| `/inicio` | 200 | Shell nuevo; CTA “Registrar” → `/caja` |
| `/caja` | 200 | Caja nueva; `private, no-store`; ignora `?tab=` |
| `/ventas` | 200 | Historial nuevo; `private, no-store`; `?page=N` funciona |
| `/ventas?page=2` | 200 | 25 filas, “página 2 de N” |
| `/ventas?page=999` | 200 | Clampa a la última página, pero **la URL sigue diciendo 999** |
| `/ventas?page=abc` | 200 | Cae a página 1 |
| `/ventas?ayuda=1` | 200 | Ignora `ayuda=1` (antes el alias 307 lo conservaba) |
| `/caja?tab=fiado` | 200 | Ignora `tab` y muestra la Caja nueva |
| `/caja/`, `/ventas/` | 308 | Redirección de barra final de Next |
| `/fiados` | 307 | `/?tab=fiado` |
| `/fiados?ayuda=1` | 307 | `/?tab=fiado&ayuda=1` |
| `/corte` | 307 | `/?tab=corte` |
| `/metas` | 307 | `/?tab=meta` |
| `/pendientes` | 307 | `/?tab=pendientes` |
| `/?tab=corte`, `/?tab=ventas` | 200 | Legacy; `?tab=ventas` **cae silenciosamente a caja** (no está en `HOME_TABS`, `app/page.tsx:9-24`) |
| `/pay/ord_nope` | **200** | Renderiza “Cobro no encontrado” con `noindex`; no 404 (heredado; ver 4.5) |
| `/pay/ord_nope/success` | **200** | Skeleton “Confirmando pago” y luego estado de cobro no encontrado; no 404 (heredado) |
| `/nope` | 404 | 404 real de Next |

**No hay bucles:** los alias 307 apuntan a `/?tab=...`, y la página raíz no redirige. `/caja` y `/ventas` no redirigen. No se observaron 404 en los destinos de la nav.

### 3.2 Navegación y enlaces

| Desde | Acción | Destino real | Evaluación |
|---|---|---|---|
| `/inicio` | “Registrar” | `/caja` | Correcto. |
| `/inicio` | “Ir a ventas” (sugerencia) | `/ventas` | El copy dice “Registra una venta…” pero lleva al historial; ver P3. |
| Nav nueva | Caja / Ventas | `/caja` / `/ventas` | Correcto; `aria-current` correcto. |
| Nav nueva | Fiados / Corte / Metas / Pendientes | `/?tab=...` legacy | Sale del shell nuevo; ver P1 dos Cajas. |
| Nav nueva | Ayuda / Ajustes | `/?ayuda=1` legacy | Sale del shell nuevo; no hay ayuda de la Caja nueva. |
| `/caja` | “Caja clásica” | `/` legacy | Explícito, pero refuerza dos Cajas. |
| `/ventas` | “Nueva venta” | `/caja` | Correcto, salvo que un pendiente secuestra `/caja`. |
| Resultado | “Volver a Caja” | `/caja` (misma ruta) | **No-op observable**; el estado `view` sigue en resultado. |
| `/pay/[id]/not-found` | “Volver” | `/` legacy | Lleva a la Caja completa (heredado). |

### 3.3 Reproducción de la trampa de dos Cajas

Evidencia: `EVIDENCIAS/repo-two-cajas.json` y `repo-two-cajas.png`.

Secuencia reproducida:

1. Se inyecta un draft v2 “Cafe nuevo” y se abre `/caja`.
2. Se pulsa “Fiados” en la nav nueva.
3. El navegador termina en `http://localhost:3100/?tab=fiado`; se renderiza la app legacy.
4. En la sidebar legacy se pulsa su botón “Caja”.
5. La URL **sigue siendo `/?tab=fiado`**; aparece la Caja legacy con el compositor vacío.
6. El draft v2 sigue en `localStorage`, pero **no se muestra**. La nueva Caja quedó fuera de la navegación.

Esto no es solo cosmético: el usuario puede creer que su venta en curso desapareció y volver a capturarla en la Caja legacy, generando dos pedidos.

### 3.4 Pérdida de contexto de cobros

- `CajaScreen` lee `caja-pending:v2` y reanuda **solo el último** id (`caja-screen.tsx:114-144`). No hay lista de pendientes en `/caja`.
- `/ventas` no tiene acciones de cobro/reanudación (`ventas/page.tsx:118-240`; verificado: 0 botones/links de cobro).
- Los pendientes antiguos solo se pueden abrir en la Caja legacy (tira de `PendingPayments`, `caja-app.tsx:2719-2731`) o en la checklist de Corte (`closing-checklist.tsx:581-613`). La entrega dice que están en “Pendientes”, pero `/pendientes` es la libreta de tareas, no de cobros: es una afirmación incorrecta de la documentación.
- Al pagar el último pendiente, `removePendingId` elimina solo ese id (`caja-screen.tsx:376`); un pendiente anterior puede volver a secuestrar `/caja` en la siguiente carga.

---

## 4. Hallazgos

### 4.1 P0 — Verdad de dinero visible

#### B-01 · P0 · Resultado de fiado afirma que se registró efectivo cuando no hubo efectivo

**Archivo:** `web/src/components/caja/sale-result.tsx:29,133-137`

```tsx
const openCredit = creditBalanceCents > 0;
...
{openCredit ? (
  <p className="mc-caja-result__banner">
    Quedó anotado en Fiado. Solo el fiado es deuda; el efectivo sí se registró en la caja.
  </p>
) : null}
```

**Reproducción (read-only, con una orden ya existente):** `EVIDENCIAS/repo-fiado-banner-p0.json` y `repo-fiado-banner-p0.png`.

- Orden `ord_58d5096d60ea48f09ceb`: `totalCents=10000`, `paidCents=0`, `creditCents=10000`.
- El resultado muestra “Venta registrada con fiado”, “Estado: Registrado”, “Saldo vivo fiado $100.00”, y aun así el banner “*el efectivo sí se registró en la caja*”.
- No hay ningún pago en efectivo en la orden.

**Impacto:** contradice la regla de oro del repo justo en la pantalla donde se decide entrega/conciliación. La comerciante puede creer que el cajón tiene $100 que nunca entraron. Es P0 de verdad visible, aunque la base esté correcta.

**Fix esperado (no aplicado):** condicionar el banner a `cashPaidCents > 0`; si no hay efectivo, decir “No se registró efectivo; todo quedó a fiado”; si es mixto, mostrar el desglose real.

**Nota de independencia:** coincide con el P0 de `06_modulos.md` y con O-02 de `07_onboarding.md`; lo reproduje con mi propio artefacto y una orden distinta.

---

#### B-02 · P0 · Panel de cobro mixto oculta el efectivo ya recibido y afirma que no se recibió dinero

**Archivo:** `web/src/components/caja/payment-panel.tsx:30,152-156`; `caja-screen.tsx:316-320`

`PaymentPanel` calcula `dueCents = total - paid - credit` (correcto: $40) pero el bloque de importe dice siempre:

> “El pedido ya está registrado. **El dinero aún no se considera recibido.**”

Aunque el bloque se titula “Cobro digital”, la frase es global: no distingue “digital pendiente $40” de “efectivo ya recibido $60”. No muestra `order.paidCents` ni el efectivo ya cobrado. `CajaScreen` le pasa el `Order` completo (con `paidCents=6000`), así que el dato está disponible.

**Reproducción:** `EVIDENCIAS/repo-mixto-cash-hidden-p0.json` y `repo-mixto-cash-hidden-p0.png`.

- Orden `ord_da74e58817a54b49aea7` (AEA7): total $100, `paidCents=$60`, `digitalPaidCents=0`, `creditCents=0`, `status=confirmed`.
- El panel muestra “Falta cobrar $40.00”, “El pedido ya está registrado. El dinero aún no se considera recibido.”
- No aparece “Recibiste $60” ni “Efectivo aplicado”.
- El chip de estado dice “REGISTRADO” (no “Parcial”).

**Impacto:** la comerciante ya tiene $60 en la caja, pero la pantalla le dice que no ha recibido dinero. Puede volver a cobrar, entregar mal o conciliar mal el cajón. Es un P0 de verdad de dinero, no de persistencia.

**Fix esperado (no aplicado):** mostrar `paidCents` como “Ya recibiste $X” y separar “Digital pendiente $Y”; no usar una frase global de “no recibido” cuando `paidCents > 0`.

**Nota de independencia:** coincide con el P0 de `07_onboarding.md` (O-01); lo reproduje con la orden AEA7 y mi propio artefacto.

---

### 4.2 P1 — Flujo y duplicación

#### B-03 · P1 · Un cobro pendiente secuestra `/caja` y no hay “Nueva venta” en el panel

**Archivos:** `caja-screen.tsx:114-144,554-556`; `payment-panel.tsx:186-250`

- Al montar, `CajaScreen` lee el último `orderId` de `caja-pending:v2` y hace `setView(due > 0 ? "payment" : "result")` (`caja-screen.tsx:115-140`).
- Si la vista es `payment`, solo renderiza `<PaymentPanel>` (`:554-556`); no hay compositor.
- Las acciones del panel son: Generar link, Generar QR, Actualizar estado, Simular CoDi/tarjeta, Ver historial de ventas y Caja clásica (`payment-panel.tsx:186-250`). **No hay “Nueva venta”, “Empezar otra venta” ni “Descartar este cobro”.**

**Reproducción:** `EVIDENCIAS/repo-pending-blocks-new-sale.json` y `.png`.

1. Se inyecta un pendiente existente en `caja-pending:v2`; `/caja` abre “Cobrar venta”.
2. Se pulsa “Ver historial de ventas” → `/ventas`.
3. Se pulsa “Nueva venta” → `/caja`.
4. Vuelve a abrir el **mismo cobro pendiente**, no el compositor.

**Agravantes:**

- `readPendingIds` elige solo el último (`caja-screen.tsx:115-117`). Un pendiente anterior no se lista ni se puede cobrar desde la Caja nueva (`repo-pending-last-only.json`).
- `/ventas` es solo lectura: no hay botón de cobrar, pagar, generar link ni reanudar (`repo-playwright-state.json`, check “/ventas exposes no cobro action”).
- `resetSale`/`clearDraft` no limpian `PENDING_KEY` (`caja-screen.tsx:164-192`), por lo que un puntero viejo puede volver a abrirse en la siguiente carga.

**Impacto:** una sola venta digital pendiente deja la Caja nueva inutilizable para registrar otra venta hasta que se pague o se limpie el almacenamiento. El workaround visible es “Caja clásica”, que es justamente la otra Caja.

**Fix esperado (no aplicado):** añadir “Nueva venta / dejar pendiente” con confirmación, listar los pendientes con acción de cobro, y no reanudar en silencio.

---

#### B-04 · P1 · Dos Cajas, dos borradores y dos llaves; sin lock cross-tab ni migración

**Archivos:** `caja-app.tsx:110-117`; `caja-screen.tsx:32-34,74`; `nav.ts:25-44`; `caja-app.tsx:7421-7439`; `caja-screen.tsx:597`

**Evidencia de estado:** `EVIDENCIAS/repo-playwright-state.json` y `repo-two-cajas.json`.

- Se inyectaron simultáneamente `draft:v1` (“Quesadilla legacy”) y `caja-draft:v2` (“Cafe nuevo”).
- `/caja` restauró **solo v2** y no mostró v1; `/` restauró **solo v1** y no mostró v2.
- Ambas claves siguen existiendo; no hay migración ni limpieza cruzada.
- `/caja` dice al pie: “los borradores de cada pantalla son independientes” (`caja-screen.tsx:597`). Es honesto, pero confirma que no hay continuidad.

**Llaves:**

| Uso | Legacy `/` | Nueva `/caja` |
|---|---|---|
| Borrador | `mercado-cero:draft:v1` | `mercado-cero:caja-draft:v2` |
| requestId | `mercado-cero:sale-request:v1` | `mercado-cero:caja-request:v2` |
| Pendiente | `mercado-cero:pending-order:v1` | `mercado-cero:caja-pending:v2` |

`requestRef` y `saleLockRef` son **por pestaña y en memoria** (`caja-screen.tsx:74`). No hay `BroadcastChannel` ni listener de `storage` para ventas; solo `closing-checklist.tsx` escucha `storage` para su propio dismiss. Dos pestañas pueden leer la llave antes de que la otra escriba y generar dos `requestId` distintos; el servidor los considera dos ventas. No se reprodujo con POST para no mutar la base; el riesgo es de código.

**Trampa de navegación:** desde `/caja` → Fiados/Corte/Metas/Pendientes se entra a la app legacy. Su sidebar “Caja” es un `button` de tab (`caja-app.tsx:7421-7439`), no un enlace a `/caja`; la URL se queda en `/?tab=...` y la Caja nueva queda fuera. Ver `repo-two-cajas.json` y `repo-two-cajas.png`.

**Impacto:** duplicación de ventas si se reintenta en la otra Caja; pérdida de contexto; dos borradores que el usuario cree uno; fixes de dinero duplicados. Es el riesgo estructural que la propia entrega reconoce como pendiente.

---

#### B-05 · P1 · Mixto puede producir cambio fantasma y un aviso falso de “el total cambió”

**Archivos:** `caja-screen.tsx:80-90`; `sale-summary.tsx:59-63,143-176`

Dos defectos reproducidos, ambos en el paso de cobro:

1. **Cambio fantasma.** Total $100, método Mixto, efectivo $100, fiado $100. El reparto aplica primero el fiado (`appliedCredit=min(100,100)=100`), luego el efectivo (`appliedCash=min(100,0)=0`), y calcula `change = cash - appliedCash = 100`. La UI muestra: “**Cambio a devolver $100.00. Se aplicaron $0.00 al cobro.**” Al escribir el nombre, el CTA queda habilitado y registraría `cashCents=0`, `creditCents=100`.
   Evidencia: `EVIDENCIAS/repo-mixto-phantom-change.json` y `.png`.
   Riesgo: una venta 100 % fiada se presenta con “Recibiste” y “Cambio”, y el resultado puede inducir a devolver efectivo que el sistema no aplicó. La causa es que `overpay` solo compara fiado contra total, no efectivo+fiado contra total (`caja-screen.tsx:90`).

2. **Aviso falso en un reparto válido.** Total $100, Mixto, efectivo $40, fiado $30, digital $30. `creditChanged` compara `creditEnteredCents !== totalCents` sin restar el efectivo (`sale-summary.tsx:59-63`) y muestra “**El total cambió. Ajusta el monto a fiado para que coincida con $100.00.**” El total no cambió; el split es válido y el CTA dice “Generar cobro $30.00”.
   Evidencia: `EVIDENCIAS/repo-mixto-hint.json` y `.png`.
   Riesgo: si la comerciante sigue el aviso y pone fiado $100, el sistema aplica $0 de efectivo y devuelve $40 de cambio; el reparto deja de ser el que quería.

**Impacto:** error de mostrador en la asignación efectivo/fiado; puede inflar la deuda o devolver efectivo no aplicado. P1.

---

#### B-06 · P1 · En demo, un mixto efectivo + fiado se titula “Venta cobrada en efectivo (demo)”

**Archivo:** `sale-result.tsx:26-34`

```tsx
const isCashDemo = (order.lastPaymentDemo || demo) && hasCash && !hasDigital;
...
: isCashDemo
  ? "Venta cobrada en efectivo (demo)"
```

`isCashDemo` no considera `openCredit`. En una orden de total $90 con `paidCents=$60`, `creditCents=$30`, `digitalPaidCents=0`, el título es “Venta cobrada en efectivo (demo)” aunque solo $60 fueron efectivo y $30 quedaron a fiado.

**Reproducción:** `EVIDENCIAS/repo-mixto-fiado-demo-title.json` y `.png` (orden `ord_7399b20bfa554ec880d0`). Los hechos muestran “EFECTIVO RECIBIDO $60.00” y “SALDO VIVO FIADO $30.00”, y el banner dice que quedó anotado en Fiado; el título los contradice.

**Impacto:** sobreafirma que toda la venta se cobró en efectivo. En modo real el título sería correcto (“Venta registrada con saldo fiado”), pero el modo demo es el que se usa para enseñar. P1 de copy/verdad.

---

#### B-07 · P1 · `/ventas` oculta el efectivo ya cobrado cuando el pedido pasa a `payment_pending`

**Archivo:** `ventas/page.tsx:164-171`

El orden de las ramas es:

```tsx
isDemoOrder
  ? "Demo, no es dinero real"
  : order.status === "payment_pending"
    ? "Pendiente de cobro"
    : order.paidCents > 0
      ? "Cobrado ..."
```

Cuando un pedido mixto con efectivo ya cobrado genera link/QR, `attachPaymentLink` lo pasa a `payment_pending` (`lib/orders.ts:409-415`). A partir de ahí, `/ventas` muestra “Pendiente de cobro” y **desaparece “Cobrado $60.00”**, aunque `paidCents` siga siendo 6000. El monto “Falta cobrar” y el saldo fiado sí se muestran; el efectivo ya recibido no.

**Evidencia:** lectura de código; en este servidor demo la rama `isDemoOrder` corta antes y muestra “Demo, no es dinero real”, por lo que no se puede reproducir el caso real sin un entorno `DEMO_MODE=false`. La lógica es determinista y coincide con el P1 de `06_modulos.md`.

**Impacto:** la verdad del dinero empeora al avanzar el flujo; la comerciante puede creer que no cobró nada y volver a cobrar. P1.

---

### 4.3 P2 — Robustez, consistencia y mantenibilidad

| ID | Hallazgo | Evidencia / archivo:línea | Impacto |
|---|---|---|---|
| B-08 | **“Volver a Caja” es un no-op**: es un `<Link href="/caja">` dentro de `/caja`; no resetea `view`. | `sale-result.tsx:151-153`; `caja-screen.tsx:70`; `EVIDENCIAS/repo-result-volver.json` y `.png` | El usuario pulsa “Volver a Caja” y sigue en el resultado. Debe ser un botón que llame a `resetSale` o eliminarse. |
| B-09 | **Un draft v2 corrupto tumba `/caja`**: solo se valida `Array.isArray(lines)`, no la forma de cada línea. `{"lines":[{"id":"bad"}]}` produce `Cannot read properties of undefined (reading 'trim')` y la pantalla “This page couldn't load”. | `caja-screen.tsx:96-105`; `types.ts:50-55`; `EVIDENCIAS/repo-bad-draft.json` y `.png` | Pérdida temporal de la Caja; el legacy sí normaliza el draft (`caja-app.tsx:410-458`). Falta `version` y validación por campo. |
| B-10 | **`method` restaurado sin validar**: `setMethod(stored.method ?? "cash")` acepta cualquier string. Con `"bitcoin"` no hay método activo y `canConfirm` puede quedar habilitado porque solo excluye cash/credit/mixed. | `caja-screen.tsx:104,392-400`; `EVIDENCIAS/repo-bad-draft.json` (caso `invalid_method`) | Estado inconsistente; edge de localStorage manipulado/versión vieja. |
| B-11 | **“Pagado” puede convivir con fiado abierto**: `SaleResult` usa `statusLabel(order.status)` para el hecho “Estado”; un pedido `paid` con crédito vivo muestra “Pagado” mientras el título/banner dicen fiado. | `sale-result.tsx:31-47,75-84,163-181`; `lib/orders.ts:677-687` (coveredCents = paid + credit) | Contradicción en la misma tarjeta; el legacy prioriza fiado abierto (`StatusBadge`, `caja-app.tsx:7248-7304`). |
| B-12 | **Reescritura paralela sin módulos compartidos** de verdad de pago, dinero, storage o validación. No hay `payment-truth.ts`, `money.ts` ni `sale-storage.ts`. | `components/caja/**`; `caja-app.tsx`; métricas de 2.3; `Test-Path` False | Cada fix de dinero se duplica; los P0/P1 de este informe son la prueba. P2 estructural, no cosmético. |
| B-13 | **`/ventas` usa `lib/db` directo y hace N+1 de créditos** (hasta 25 `getCredit` por página). | `ventas/page.tsx:15-21,44-50,127`; `db.ts:1737-1763` | Read model no delegable; costo crece con filas/fiados; no hay filtros/búsqueda/detalle de pagos. |
| B-14 | **`confirmed` digital se rotula “Registrado”** en `/ventas` y `PaymentPanel`, aunque todavía falte cobrar; la verdad central (`payment-labels.ts:118-123`) dice “Por cobrar”. | `ventas/page.tsx:260-273`; `payment-panel.tsx:264-281`; `payment-labels.ts:118-123` | La lista no señala cobranza pendiente; el usuario debe leer “Falta cobrar”. |
| B-15 | **El badge “DEMO” sustituye el estado real** en `/ventas`: todas las filas demo dicen “Demo”, incluidas fiado/pendiente/saldado. | `ventas/page.tsx:128-129,257-258`; `EVIDENCIAS/repo-ventas-desktop.png` | En el modo que se usa para enseñar se pierde la distinción fiado/pendiente. P2 de copy/estado. |
| B-16 | **“Por cobrar digital” incluye pedidos `confirmed` sin link/QR**, aunque el copy dice “Links y QR de todos los días”. | `ventas/page.tsx:45,107-110`; `db.ts:1475-1487` | El total puede incluir un pedido que aún no tiene link generado; copy sobrepromete. |

---

### 4.4 P3 — Pulido, fechas y documentación

| ID | Hallazgo | Evidencia / archivo:línea | Nota |
|---|---|---|---|
| B-17 | **Fecha calculada en render SSR/cliente**: `formatLongDate()` se llama en el render de `CajaScreen`; `formatLongDate` no fija `timeZone`. | `caja-screen.tsx:429`; `format.ts:83-88`; legacy calcula `today` tras montar (`caja-app.tsx:920`) | Posible hydration mismatch o fecha distinta cerca de medianoche/otra zona. P3. |
| B-18 | **Lazy `ClosingChecklist` sin fallback** y con `ssr:false`; solo afecta `/`/`/corte`, no `/caja`. | `caja-app.tsx:20-29,2804` | Impacto bajo; puede haber flash vacío al abrir Corte. El commit `7c48902` también cambió iconos de la Caja nueva. |
| B-19 | **CTA “Ir a ventas” con copy de registrar**: la sugerencia dice “Registra una venta…” pero `/ventas` es solo historial. | `inicio/page.tsx:222-226` | Enlace al módulo correcto para historial, copy desalineado. P3. |
| B-20 | **`/?tab=ventas` cae a caja en silencio**: no está en `HOME_TABS`. | `app/page.tsx:9-10,18-24` | No hay enlaces que lo generen, pero es un bookmark/URL heredada. P3. |
| B-21 | **`?page=999` clampa a la última página pero conserva 999 en la URL**; no canonicaliza. | `ventas/page.tsx:47-48,221-238`; `repo-ventas-pagination.json` | Cosmético/SEO interno. P3. |
| B-22 | **`?ayuda=1` en `/ventas` se ignora**; antes el 307 lo conservaba. | `repo-http-routes.json`; `app/ventas/page.tsx:34-40` | Cambio de semántica de query al convertir alias en página. P3. |
| B-23 | **Documentación desactualizada/contradictoria**: `VEREDICTO_INDEPENDIENTE.md:7-9` dice HEAD 26c7741 y árbol sucio; `STATE.md:11-15` dice commit/build 7c48902 y `caja-app.tsx` “sin cambios”; `ENTREGA:3-5,60,66` se contradice (lista el lazy y luego dice “sin cambios”). | `harness/STATE.md:11-15`; `quality-reports/oleada-b/VEREDICTO_INDEPENDIENTE.md:7-9`; `ENTREGA_OLEADA_B.md:3-5,60,66,161` | No usar estos informes como evidencia del HEAD actual. P3 de proceso. |
| B-24 | **`ENTREGA` afirma que los pendientes antiguos están en “Pendientes”**; en realidad `/pendientes` es tareas y los cobros están en Caja/Corte legacy. | `ENTREGA_OLEADA_B.md:161`; `caja-app.tsx:2719-2731`; `closing-checklist.tsx:581-613` | Documentación incorrecta que oculta el problema de continuidad. P3. |
| B-25 | **Botón “Descartar venta” mide 44 px** en viewport 390. | `EVIDENCIAS/repo-layout-bottom.py`; `sale-summary.tsx:259-261` | Si se exige 48 px HIG, es P3 de accesibilidad. |

---

### 4.5 Heredados / fuera del diff (no atribuibles a B)

| ID | Hallazgo | Archivo:línea | Severidad | Nota |
|---|---|---|---|---|
| H-01 | **`POST /api/demo/pay` sin idempotencia explícita ni comprobación `order.demo`**; genera `demo_txn_*` nuevo por llamada. B lo expone con botones demo. | `api/demo/pay/route.ts:22-28,49-85`; `payment-panel.tsx:220-235` | P1 heredado | Ya documentado en `STATE.md`; no se tocó el endpoint. Dos pestañas podrían duplicar un demo. |
| H-02 | **`/pay/[id]` y `/pay/[id]/success` inexistentes devuelven HTTP 200** con UI de “Cobro no encontrado”/skeleton, aunque el comentario de la página dice “404 real”. | `app/pay/[id]/page.tsx:13-26`; `repo-http-routes.json`; comprobación HTTP directa | P2 heredado | No es B; afecta semántica de links de pago. |
| H-03 | **La página not-found de pago enlaza a `/`**, la Caja legacy completa, sin auth. | `app/pay/[id]/not-found.tsx:28`; `app/page.tsx` | P2 heredado (privacidad) | Un cliente con un link roto puede llegar al panel de la comerciante. No hay autenticación en el proxy ni en el layout. |
| H-04 | **`paymentMethod` se acepta en Zod y `createOrder` no lo lee**; el método se deriva de payments. | `api/orders/route.ts:36-48`; `lib/orders.ts:99-206` | P2 heredado | Un módulo de pagos podría creer que persiste el método. |
| H-05 | **Modo demo implícito si falta `PEY_API_KEY`** y seeds de historial demo. | `lib/config.ts:10-14`; `db.ts:1039-1088,1115-1246` | P2 heredado | No es B; relevante para no confundir demo con real. |
| H-06 | **`productId`/`sku` se descartan en silencio** y el hash de idempotencia no los incluye; dos productos distintos con el mismo requestId devuelven la misma orden. | `api/orders/route.ts:30-48`; `lib/orders.ts:196-207`; `lib/request-hash.ts` | P2/P1 para C/D | Bloquea delegar catálogo/SKU sin contrato v2; fuera del alcance de B. |

---

## 5. Riesgo específico: dos Cajas, dos borradores, dos llaves

### 5.1 Escenarios de fallo

| Escenario | Qué pasa hoy | Severidad |
|---|---|---|
| Borrador en `/caja`, el usuario entra a Fiados y luego a la Caja legacy | Ve un compositor vacío; puede volver a capturar la misma venta. | P1 |
| Reintento tras error de red en `/caja`, luego intento en `/` | Cada pantalla tiene su `requestId`; el servidor ve dos ventas distintas. | P1 |
| Dos pestañas de `/caja` confirman a la vez | `saleLockRef` es local; si ambas leen la llave antes de escribir, dos `requestId`; dos pedidos. | P1 (riesgo, no reproducido con POST) |
| Venta pendiente en `/caja` y otra en la Caja legacy | Dos punteros (`caja-pending:v2` y `pending-order:v1`); cada pantalla reanuda el suyo. | P1/P2 |
| Draft en `/caja` + pedido pagado restaurado; “Nueva venta” | `resetSale → clearDraft` borra el draft oculto sin aviso. | P3 (raro) |
| Pendiente antiguo en `caja-pending:v2` | Solo se reanuda el último; los anteriores no se listan en `/caja` ni se cobran en `/ventas`. | P1 |

### 5.2 Evaluación

- **No hay una sola fuente de verdad de venta en el cliente.** Hay dos implementaciones y tres pares de claves.
- **No hay lock cross-tab ni migración v1→v2.** La convivencia es explícita solo en el pie de `/caja`; la Caja legacy no avisa.
- **La nav nueva promete unidad**, pero Fiados/Corte/Metas/Pendientes/Ayuda/Ajustes salen a la app legacy. El usuario aprende una nav que no corresponde a dos productos distintos.
- **Mantenibilidad:** cualquier fix de dinero (incluidos B-01/B-02/B-05) debe aplicarse dos veces; el riesgo de que una pantalla quede atrás es alto.
- **Recomendación:** antes de C, o se extrae `sale-truth`/`sale-storage` compartido y se migra v1→v2, o se retira/redirige la Caja legacy. Mantener ambas sin fuente compartida no es delegable.

---

## 6. Evidencia reproducible

Todo lo siguiente está en `quality-reports/oleada-b-review/EVIDENCIAS/`. Los scripts son de solo lectura: no hacen POST de ventas ni `/api/demo/reset`; usan órdenes existentes y `localStorage` del navegador.

| Evidencia | Qué prueba |
|---|---|
| `repo-http-routes.py` / `.json` | Matriz de rutas, redirects, headers y títulos. |
| `repo-playwright-state.py` / `.json` | `/caja` restaura v2; `/` restaura v1; ambos keys coexisten; nav correcta; `/ventas` sin acciones de cobro; `/fiados` legacy; sin errores de consola. |
| `repo-two-cajas.py` / `.json` / `.png` | Desde `/caja` → Fiados → sidebar legacy “Caja” se queda en `/?tab=fiado` y no vuelve a `/caja`; el draft v2 no se muestra. |
| `repo-pending-blocks-new-sale.py` / `.json` / `.png` | Un pendiente secuestra `/caja`; “Nueva venta” desde `/ventas` vuelve al pendiente. |
| `repo-pending-last-only.py` / `.json` | Con dos ids, solo se reanuda el último; el primero no aparece. |
| `repo-result-volver.py` / `.json` / `.png` | “Volver a Caja” no resetea la vista de resultado. |
| `repo-bad-draft.py` / `.json` / `.png` | Draft v2 corrupto tumba `/caja` con `reading 'trim'`; `method` inválido se acepta. |
| `repo-mixto-hint.py` / `.json` / `.png` | Reparto válido $40 efectivo + $30 fiado + $30 digital muestra “El total cambió…”. |
| `repo-mixto-phantom-change.py` / `.json` / `.png` | Efectivo $100 + fiado $100 sobre total $100 → “Cambio $100, aplicado $0”. |
| `repo-mixto-cash-hidden-p0.py` / `.json` / `.png` | Pedido AEA7 (paid $60, due $40) muestra “El dinero aún no se considera recibido”. |
| `repo-fiado-banner-p0.py` / `.json` / `.png` | Pedido 9CEB (100 % fiado, paid $0) muestra “el efectivo sí se registró”. |
| `repo-mixto-fiado-demo-title.py` / `.json` / `.png` | Total $90, cash $60, fiado $30 → título “Venta cobrada en efectivo (demo)”. |
| `repo-ventas-pagination.py` / `.json` | 25/página, página 2/5, clamp de 999 a 5/5, `page=abc` a 1. |
| `repo-caja-desktop.png`, `repo-ventas-desktop.png`, `repo-caja-mobile.png`, `repo-fiados-legacy.png`, `repo-root-legacy-desktop.png` | Capturas de apoyo. |

**Comandos de reproducción base:**

```powershell
cd web
python ..\quality-reports\oleada-b-review\EVIDENCIAS\repo-http-routes.py
python ..\quality-reports\oleada-b-review\EVIDENCIAS\repo-playwright-state.py
python ..\quality-reports\oleada-b-review\EVIDENCIAS\repo-two-cajas.py
python ..\quality-reports\oleada-b-review\EVIDENCIAS\repo-fiado-banner-p0.py
python ..\quality-reports\oleada-b-review\EVIDENCIAS\repo-mixto-cash-hidden-p0.py
```

> Nota: el servidor está en **modo demo** (`/api/health`, sello DEMO). Los hallazgos de `/ventas` en modo real (B-07) son de lectura de código; los demás P0/P1 se reprodujeron en este servidor.

---

## 7. Fiabilidad de los informes previos

No usé los informes como evidencia; los contrasté y encontré desactualización:

- `quality-reports/oleada-b/VEREDICTO_INDEPENDIENTE.md:7-9` declara HEAD `26c7741`, build `26c7741` y árbol sucio con WIP. El HEAD actual es `4130e71`, el build servido es `4130e71` y el árbol de producto está limpio (solo evidencia untracked).
- `harness/STATE.md:11-15` declara commit/build `7c48902` y `caja-app.tsx` “sin cambios”. `7c48902` sí cambia `caja-app.tsx` (lazy) y el build servido es `4130e71` (docs-only posterior).
- `ENTREGA_OLEADA_B.md:3-5` declara HEAD `7c48902`; `:60` lista el lazy de `caja-app.tsx`; `:66` dice “components/caja-app.tsx sin cambios”. Es una contradicción interna.
- `ENTREGA_OLEADA_B.md:161` dice que los pendientes antiguos se ven en “Pendientes”. En el código, `/pendientes` es la libreta de tareas; los cobros pendientes viven en la Caja legacy y en `ClosingChecklist` de Corte.
- `AUDITORIA_REPO.md` fue un snapshot WIP: varias cosas que marcó (headers privados, paginación real, reanudación de pendiente, payload de `/caja`) ya están corregidas en el HEAD actual. No es un veredicto vigente.

**Cross-check independiente:** coincido con `06_modulos.md` y `07_onboarding.md` en los P0 de fiado y mixto efectivo+digital; reproduje ambos con artefactos propios. También confirmé el cambio fantasma de Mixto, el aviso falso “El total cambió”, el título demo incorrecto y el callejón del pendiente. No re-audité los hallazgos de catálogo/provenance, onboarding móvil ni accesibilidad detallada, que pertenecen a esos carriles.

---

## 8. Recomendaciones (no aplicadas)

Ordenadas por riesgo, sin tocar producto en esta auditoría:

1. **Bloquear cierre por B-01/B-02.** Corregir la verdad de dinero visible antes de cualquier demo sin acompañamiento:
   - banner de fiado condicionado a `cashPaidCents > 0`;
   - panel de cobro que muestre “Ya recibiste $X” y “Falta digital $Y”, nunca “no se recibió” con `paidCents > 0`.
2. **Extraer una sola verdad de venta/pago** (`sale-truth`, `sale-status`) y usarla en `/caja`, `/ventas` y legacy. Mientras existan dos, los fixes de dinero se duplican.
3. **Unificar o retirar el almacenamiento de venta**: draft/request/pending compartidos + migración v1→v2 + lock cross-tab; o redirigir/retirar `/`.
4. **Resolver el callejón del pendiente**: “Nueva venta / dejar pendiente”, lista de pendientes con acción de cobro, y no reanudar en silencio.
5. **Corregir Mixto**: bloquear `cash + credit > total` o priorizar efectivo; comparar el fiado con `total - efectivo`; añadir regresiones para cambio fantasma y aviso falso.
6. **Corregir `/ventas`**: no ocultar `paidCents` en `payment_pending`; usar `payment-labels` para `confirmed`; añadir acciones de cobro/reanudación y detalle de pagos.
7. **Reemplazar “Volver a Caja”** por un botón que resetee el resultado (o eliminarlo).
8. **Validar el draft v2** (versión + campos) y no tumbar `/caja` por localStorage corrupto.
9. **Limpiar rutas/nav**: decidir el destino de `/`; etiquetar Ayuda/Fiados/Corte/Metas/Pendientes como legacy; corregir `/pay` not-found (404 y no enlazar al panel).
10. **Añadir regresiones** de los P0/P1 a `oleada-b-smoke.py` o a un nuevo gate; el smoke actual no cubre pendiente que secuestra la Caja, cambio fantasma, banner falso ni título demo.

---

## 9. Límites de esta auditoría

- No se ejecutó `verify:full` ni `verify:evidence`; solo build identity, typecheck y eslint. No se declara GO formal.
- No se mutó la base: no se crearon ventas ni se llamó `/api/demo/reset`. Las pruebas usan órdenes existentes y `localStorage`.
- El servidor está en modo demo; B-07 (`/ventas` real) es lectura de código, no runtime real.
- No se auditó en profundidad catálogo/SKU, accesibilidad WCAG, onboarding móvil ni todos los gates de `06/07`; esos carriles tienen sus propios informes.
- El directorio `quality-reports/oleada-b-review/EVIDENCIAS/` ya contenía evidencia de otros subagentes; esta auditoría solo agregó archivos `repo-*` y este `01_repo.md`. No se borró ni modificó evidencia ajena.
- **No se editó producto, no se hizo commit y no se aplicó ningún fix.**
