# P0 · Integración de cobros pendientes, pendientes de negocio y voz/venta mixta

> **Worktree:** `mercado-cero-integracion` · **Rama:** `p0/integracion` · **Base:** `d8b8421` (incluye P0-F).
> **Fecha:** 2 de noviembre de 2026.
> **Commits:** producto `c57a404` · evidencia E2E `3da950f` · este reporte y el gate final se commitean después.
> **Sin merge.** No se tocó `mercado-cero`, `:3000`, el webhook, pey, `/api/verify`, `paymentTruth` ni el esquema SQLite.

---

## 1 · Resultado

Los tres módulos ya construidos quedaron conectados en `web/src/components/caja-app.tsx` sin reimplementarlos:

- **P0-E:** franja de cobros pendientes visible en Caja, refresco al montar/volver a la pestaña y polling de 45 s solo con la pestaña visible.
- **P0-G:** quinto tab **Pendientes** en sidebar y tab bar, con `PendingTasksPanel` montado en el `main`.
- **P0-C.1:** consultas de fiado que suman varias deudas, método de abono tomado del parser y venta mixta con remanente digital cobrable desde el panel.

**E2E:** `web/scripts/p0-integracion-e2e.py` — **51 PASS · 0 FAIL · 0 KNOWN** en `:3101` con DB temporal. Ninguna petición a `:3000`. (La cifra 46 era el corte original; §8 recoge las correcciones y el guard de voz.)

---

## 2 · Cambios

### 2.1 · P0-E · Cobros pendientes

| Cambio | Detalle |
|---|---|
| `DashboardData.pendingOrders` | Nuevo campo opcional `Order[]`; la API ya devolvía `pendingOrders: listPendingOrders(50)`. |
| Montaje | `<PendingPayments>` debajo de `ScreenHeading` de Caja y antes de “Pedido en curso”, solo si hay filas o error. |
| `onOpen` | `setActiveOrder(order); setTab("caja")`. La hoja se abre **solo** con el botón “Ver”; no hay auto-apertura. |
| Refresh | Al montar, en `visibilitychange` visible y en `focus`. Polling de 45 s solo con `document.visibilityState === "visible"`, con cleanup en `visibilitychange` y unmount. |
| Guard/AbortController | Una sola lectura de `/api/dashboard` en vuelo; `AbortController` para el unmount. `lastCheckedAt` solo avanza con lectura exitosa. |
| Error | `pendingError = "Revisa tu conexión."`; se conserva `dashboard` y la última comprobación. No se vacían filas. |
| Fechas | `formatActivityDate` en Actividad y en “desde” de Fiado: `Hoy`/`Ayer`/fecha. |
| No interrupción | El refresco de fondo usa `{ broadcast: false }`: actualiza la Caja pero **no** dispara `mercado:refresh`, para no reiniciar el conteo del corte ni otros formularios. |

### 2.2 · P0-G · Pendientes de negocio

| Cambio | Detalle |
|---|---|
| `Tab` | `"caja" \| "fiado" \| "corte" \| "meta" \| "pendientes"`. |
| `TABS` | Quinto destino con `ListTodo` y label `Pendientes`. |
| Sidebar | Usa el mismo `TABS`; `aria-current` sin lógica extra. |
| Tab bar | `grid-cols-5`, icono + label móvil corto **Tareas**; el nombre accesible sigue siendo `Pendientes` (`aria-label`). A 360 px los cinco caben sin scroll. |
| Panel | `<PendingTasksPanel headingId="pendientes-heading" />` dentro de una sección `hidden={tab !== "pendientes"}`. No hay estado de tareas duplicado en `caja-app`. |
| Scroll | `scrollPositions` incluye `pendientes`; se conserva el scroll por tab (probado: Caja vuelve a `scrollY=500`). |

### 2.3 · P0-C.1 · Voz y venta mixta

| Cambio | Detalle |
|---|---|
| `answerLocal` | Importa `answerDebtQuery` de `@/lib/voice-debts` (módulo puro, sin OpenAI) y lo llama **antes** de la búsqueda de crédito. |
| Varias deudas | Dos fiados de Juan suman `$130.00 en 2 fiados`; consulta general suma todo; ambigüedad y “sin deuda” salen del módulo puro. |
| `openCreditPay` | Acepta `method?: "cash" \| "codi" \| "card" \| null`. La voz pasa `parsed.creditMethod`; `null` deja el método sin seleccionar. |
| `CreditPaySheet` | `method` puede ser `null`; `valid` exige método; “Registrar abono” queda deshabilitado hasta elegir. Añade **Tarjeta**. El baseline de “borrador sucio” usa `initialMethod`. |
| `payCredit` | Rechaza el POST si no hay método y envía el elegido. El servidor ya aceptaba `cash/codi/card`. |
| Venta mixta | Si hay fiado y `due = total − pagado − fiado > 0`, `PaymentPanel` ya no entra al resultado “Quedó anotado”: muestra `Fiado $20.00 · Cobrado $30.00 · Falta cobrar $40.00`, el saldo vivo y las acciones Link/QR/demo para el remanente. |
| Resultado mixto | Después de pagar el digital, `PaymentPanel` y `PaidSheet` dicen **Pago mixto** y “Fiado $20.00 + $40.00 demo/verificado”; el fiado sigue mostrando su saldo vivo. |
| Ledger | Sin cambios de contrato ni de esquema. `paymentTruth` y el estado `fulfilled` del servidor se conservan. |

---

## 3 · Pruebas

Ejecutadas desde `web/` sobre `c57a404` / `3da950f`:

| Comando | Resultado |
|---|---|
| `npm run lint` | **PASS** · sin errores |
| `npx tsc --noEmit` | **PASS** · sin salida |
| `npm run build` | **PASS** · Next.js 16.4.3, 22 rutas |
| `npm run verify:fast` | **PASS 3/3** (guard, lint, types) |
| `npm run verify:static` | **PASS 4/4** (guard, lint, types, build) |
| `npm run test:voice` | **PASS 16/16** |
| `python scripts/p0-integracion-e2e.py` | **PASS 46/0/0** en `:3101` |

`harness/evidence/latest.json` — `mode: static`, `ok: true`, `gitAtStart.sha = 3da950f`, `dirty: false`, 4/4. El `baseUrl` que imprime el harness (`:3000`) es la etiqueta estática por defecto; los gates `fast/static` no ejecutan runtime. Todo el runtime de este corte se hizo en `:3101` con DB temporal.

### 3.1 · Cobertura E2E (`p0-integracion-e2e.py`)

1. **Cinco tabs:** sidebar `Caja/Fiado/Corte/Meta/Pendientes`; tab bar a 360 con cinco botones, labels `Caja/Fiado/Corte/Meta/Tareas`, sin scroll horizontal.
2. **Tareas:** crear, completar (mueve a Hechas), reabrir, posponer (`postponedUntil` en API) y eliminar. El panel no duplica estado.
3. **Scroll por tab:** Caja a `scrollY=500`; ir a Pendientes y volver restaura 500.
4. **Cobros pendientes:** la franja muestra “Pedido para llevar” y “Esperando banco”, última comprobación y **ninguna hoja abierta** al cargar; `Ver` abre el cobro con `$120.00`.
5. **Refresh:** un pedido creado por API aparece tras `focus`; otro tras simular `visibilitychange` visible. Un texto de venta en curso y un conteo de corte (`$500`) **no se borran** con el refresco.
6. **Fechas:** Actividad usa `Hoy 9:36 p.m.`; Fiado muestra “desde Hoy”.
7. **Voz:** dos deudas de Juan ($50 + $80) → `$130.00 en 2 fiados`; consulta general suma; ninguna consulta hace POST de abono.
8. **Método de abono:** “me transfirió 50” → Digital seleccionado y botón habilitado; “me pagó 50” → sin selección y botón deshabilitado; “en efectivo” → Efectivo.
9. **Venta mixta $90:** $30 efectivo + $20 fiado + $40 digital. El panel muestra $40, “Falta cobrar $40.00” y Link/QR; no dice “Quedó anotado”. Tras “Simular CoDi”, el resultado dice **Pago mixto** y “Fiado $20.00 + $40.00 demo”. La base queda `fulfilled`, `paid_cents=7000`, `credit_cents=2000`, digital demo `$40.00` y el crédito original intacto en `$20.00`.
10. **360 px:** sin overflow horizontal. **360/200 %** (inyección `html { font-size: 200% }`): Caja y Pendientes sin palabras partidas; los cinco tabs siguen completos.
11. **Aislamiento:** 0 peticiones a `:3000`.

Artefactos: `harness/evidence/p0-integracion-e2e.json`, `harness/evidence/p0-integracion-360.png`, `harness/evidence/p0-integracion-360-text200.png`.

---

## 4 · PASS / FAIL / KNOWN

**PASS**

- Los tres módulos están integrados y compilan en una sola Caja.
- Los cinco destinos funcionan a 360 px; el quinto no oculta ningún destino.
- La venta mixta se puede terminar de cobrar desde la UI y el resultado no miente sobre el fiado.
- La voz suma deudas y respeta el método dicho; sin método no asume efectivo.
- El ledger, el webhook y la verdad por pedido no cambiaron.

**FAIL**

- Ninguno en los gates y el E2E de este corte.

**KNOWN**

1. **El polling de 45 s no se esperó en el E2E.** Se probaron `focus` y `visibilitychange` (que comparten el mismo `loadDashboard({ broadcast: false })`); el temporizador se revisó por código. No se añadieron 45 s artificiales al test.
2. **La venta mixta se probó con demo, no con pey real.** El remanente usa el link/QR existentes; el webhook firmado y `/api/verify` no se tocaron ni se ejercitaron en este carril. Un pago real de pey sobre un remanente queda pendiente de una prueba con credenciales y túnel.
3. **`pendingOrders` sigue limitado a 50** por `listPendingOrders(50)`. La franja expande 3 → 50 y avisa; no hay paginación.
4. **El polling de fondo ya no dispara `mercado:refresh`.** Es deliberado para no reiniciar el conteo del corte. Consecuencia: Resumen y Corte no se refrescan solos cada 45 s; siguen refrescándose con ventas, cobros, abonos y entregas. La Caja (incluida la franja) sí se actualiza.
5. **El guard de una lectura en vuelo descarta un refresco concurrente.** El siguiente `focus`/visibility/poll vuelve a leer; no hay cola de refrescos.
6. **El método del abono ahora es obligatorio.** Abrir una hoja desde Fiado ya no preselecciona efectivo; es el comportamiento pedido por P0-C.1, pero cambia el flujo anterior de dos toques.
7. **El label móvil del quinto tab es “Tareas”.** El nombre accesible y el sidebar siguen diciendo “Pendientes”. Es la solución compacta para cinco tabs a 360 px; no se ocultó el destino.
8. **El 200 % es inyección de `font-size`, no zoom real del navegador.** No se probaron TalkBack/VoiceOver/NVDA, alto contraste, daltonismo ni teléfono físico.
9. **`PendingTasksPanel` se monta oculto al cargar la app.** Hace su `GET /api/tasks` desde el inicio; no interrumpe Caja ni crea estado duplicado.
10. **La lista de tareas conserva el tope de 50** y no tiene recordatorios, notificaciones ni recurrencia; son límites del módulo P0-G, no de esta integración.

---

## 5 · Riesgos

- **Refresco de 45 s por pestaña visible:** una pestaña abierta hace ~80 lecturas de `/api/dashboard` por hora. Es el mismo endpoint que ya usa la app; el guard evita duplicados, pero no hay backoff si el servidor falla de forma persistente (se reintenta cada 45 s).
- **Pago mixto real:** el estado final depende del webhook para el remanente. La UI ya muestra el saldo pendiente y el polling de la hoja lo actualiza, pero la prueba con pey real sigue siendo el hueco de confianza.
- **Dos fuentes de verdad para el fiado:** se conserva `orders.creditCents` como original y `credits.balanceCents` como saldo vivo. La UI los distingue; no se unificó el ledger.
- **Corte:** el refresco de fondo ya no pisa el conteo, pero las mutaciones (venta/abono/entrega) siguen disparando `mercado:refresh` y el `load()` del corte, igual que antes de este corte. P0-D sigue pendiente.
- **Compatibilidad:** `DashboardData.pendingOrders` es opcional para no romper una API vieja; si falta, la franja simplemente no se muestra.

---

## 6 · Reproducir

```powershell
cd web
npm ci
npm run build
$env:PORT="3101"
$env:DATABASE_PATH="C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\p0-integracion.db"
$env:DEMO_MODE="true"
$env:OPENAI_API_KEY=""
npm start
# en otra terminal, desde web/
python scripts\p0-integracion-e2e.py
```

El script levanta su propio servidor en `:3101` si no se le pasa `P0_EXTERNAL_SERVER=1`, usa una DB temporal, la borra al terminar y se niega a correr contra `:3000`.

---

## 7 · Estado de entrega

- **Producto:** `web/src/components/caja-app.tsx`, `web/src/app/globals.css`.
- **Prueba:** `web/scripts/p0-integracion-e2e.py`; evidencia en `harness/evidence/p0-integracion-*`.
- **Commits:** `c57a404` (producto), `3da950f` (evidencia E2E); reporte y `harness/evidence/latest.json` en el commit de cierre.
- **Integrado en `master`:** `96381b9`; correcciones posteriores en `1812e0c` y el commit de cierre de revisión.

---

## 8 · Revisión independiente y correcciones (2 nov 2026)

La revisión independiente dictaminó **CAMBIOS NECESARIOS**. Se corrigieron antes de dar el
corte por cerrado:

| # | Hallazgo | Corrección | Evidencia |
|---|---|---|---|
| 1 | Un poll viejo podía pisar el saldo recién cobrado | `loadDashboard({ force: true })` aborta la lectura en vuelo tras cada mutación; el refresco de fondo se deduplica | `p0-integracion-e2e.py`: retiene un dashboard viejo, cobra el abono y verifica saldo $0; 51/0 |
| 2 | Reset de demo dejaba tareas fantasma | `tasksResetKey` remonta `PendingTasksPanel` al reiniciar | `p0-integracion-e2e.py`: “el reset de demo limpia las tareas visibles” |
| 3 | WCAG 2.5.3: tab “Tareas” con nombre accesible “Pendientes” | nombre accesible **“Tareas (Pendientes)”**; foco al `h1` de cada tab | `p0-integracion-e2e.py`: nombre accesible y foco `pendientes-heading` |
| 4 | La franja P0-E empujaba la venta fuera del primer viewport al 200 % | franja movida al aside, después de la venta; un solo “Reintentar” global | `p0-shell-e2e.py`: 360/768/200 con campo de venta visible; 52/0 |
| 5 | “Pedido entregado” en un mixto demo | título “Pago mixto” / “Quedó anotado” cuando hay fiado; no afirma entrega | `p0-integracion-e2e.py` |
| 6 | Gates viejos de P0-C/P0-F desactualizados | `p0-fiado` elige método; `p0-shell` espera 5 destinos; `p0-venta` retira el KNOWN del remanente | `p0-fiado` 50/0 · `p0-venta` 43/0 · `p0-shell` 52/0 |
| 7 | Evidencia de tabs/fecha engañosa | `labelFits` mide el texto real; la fecha se lee dentro de Actividad | `p0-integracion-e2e.py` 51/0 |
| 8 | La voz de $50 podía volver a Piper | guard de regresión: WAV Kokoro, hash exacto y 0 `speechSynthesis` | `p0-integracion-e2e.py` 51/0 |

**KNOWN que permanecen**

- El polling de 45 s no se espera en el E2E; se prueban `focus` y `visibilitychange`.
- El remanente digital mixto se probó con `demo_paid`/demo, no con pey real.
- `fulfilled` también cierra ventas con fiado/mixto; el estado sirve para “cobro resuelto”,
  no prueba entrega. No hay `paid` **digital** fuera del webhook; el efectivo se registra como pagado al crear la venta.
- TalkBack/VoiceOver, teléfono físico y zoom real siguen sin probar.
- Un pedido `cancelled` con fiado no está excluido explícitamente del panel de cobro.
- El timeout de `/api/dashboard` es de 20 s y no tiene backoff.
