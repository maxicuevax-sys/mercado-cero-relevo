# VEREDICTO INDEPENDIENTE — Oleada B (`/caja` y `/ventas`)

**Agente:** `mc-verificador-final` (subagente independiente)  
**Fecha:** 2026-11-04, 09:55 (America/Mexico_City)  
**Repo:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero`  
**Rama:** `design/oleada-b-caja-ventas`  
**HEAD / base:** `26c7741433f18e4f4d0e78b1913df76ed09dae7e` (`oleada-a-cierre`)  
**Servidor auditado:** `http://localhost:3100`, `buildSha=26c7741433f18e4f4d0e78b1913df76ed09dae7e`, build de `09:34:33`  
**Árbol:** sucio, con el WIP de Oleada B sin commit.  
**Declaración:** no implementé, no corregí producto, no hice commits, no actualicé gates ni `latest.json`. Solo leí, ejecuté lecturas/Playwright y escribí este informe.

---

## 0. Veredicto en una línea

**Oleada B es una base funcional válida para iniciar Oleada C, pero NO está formalmente cerrada y NO es apta para handoff público.**

- **P0 de producto:** ninguno.
- **P1 de producto abierto:** 1 nuevo (parser de cantidades ambiguas, con sobrecobro silencioso) + 1 heredado que B expone (demo pay no idempotente / sin comprobación de `order.demo`).
- **P0 de cierre:** árbol sucio y evidencia inválida; `verify:evidence` falla.
- **GO para C:** sí, con condiciones y sin declarar B cerrada.
- **GO para handoff público:** **NO-GO**.
- **Commit acotado:** **sí, autorizaría un commit de checkpoint**, no un commit de cierre/GO. No lo ejecuté.

---

## 1. Método y alcance real

Leí los ocho informes de `quality-reports/oleada-b/` y contrasté sus hallazgos con el código servido, no solo con lo que declaran:

- `AUDITORIA_REPO.md`, `CONTRATOS_VENTAS_PAGOS.md`, `DISENO_CAJA.md`, `SHELL_RUTAS.md`, `FIADO_CORTE.md`, `MODULOS_NEGOCIO.md`, `ONBOARDING_AYUDA.md`, `ACCESIBILIDAD.md`.
- `git status`, `git diff`, `git hash-object` contra HEAD, `git ls-files --others` para verificar que no se tocó el motor financiero.
- HTTP real: rutas, redirecciones y cabeceras.
- Playwright/Chromium headless (`es-MX`) con borradores inyectados en `localStorage` y respuestas de red simuladas. No creé ventas por la UI; no usé el smoke mutante.
- `npm run verify:fast` y `npm run verify:evidence` desde `web/`.
- Re-ejecuté `oleada-a-smoke.py` con salida en temp: **33 PASS / 0 FAIL**.

**Límite importante:** el servidor es `DEMO_MODE=true`. Todo lo observado es el camino demo. No probé modo real, pey real, webhook real, QR real ni lector de pantalla real.

### Incidencia de ejecución (transparencia)

Durante una prueba de “POST lento” retuve una petición con Playwright; al cerrar el contexto, la petición se liberó y creó **un pedido demo de $40** (`ord_040c721c06c347e08f84`, visible en `/ventas`). No se usó como evidencia, no se modificó código y no altera el veredicto. La base es demo y es reseteable. No volví a mutar datos después de detectarlo.

---

## 2. Rutas, cabeceras y contratos de archivos

### 2.1 Rutas verificadas (HTTP real)

| Ruta | Resultado | Evidencia |
|---|---|---|
| `/caja` | **200**, sin `Location` | `curl -s -D -`; build servido |
| `/ventas` | **200**, historial real | `curl`; H1 “Ventas”; 15 filas en el momento |
| `/` | **200**, Caja legacy | `curl`; `CajaApp` intacto |
| `/fiados` | **307** → `/?tab=fiado` | `curl` |
| `/corte` | **307** → `/?tab=corte` | `curl` |
| `/metas` | **307** → `/?tab=meta` | `curl` |
| `/pendientes` | **307** → `/?tab=pendientes` | `curl` |
| `/pay/test` | **200**, sin redirección al shell | `curl`; `app/pay/**` sin diff |
| `/caja` no redirige | **PASS** | `Location` vacío |
| `/fiados?ayuda=1` | **307** conserva `tab=fiado&ayuda=1` | A smoke 33/33 |

### 2.2 Cabeceras privadas

Verificado en `/caja`, `/ventas` y `/`:

```text
Cache-Control: private, no-store, max-age=0, must-revalidate
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: ...
```

`web/next.config.ts` solo añade `privateHeaders` para `/caja` y `/ventas`; es el cambio permitido. **PASS.**

### 2.3 Motor financiero: intacto

`git diff --name-only HEAD -- ...` está **vacío** para todos los archivos prohibidos. Además, los hashes de trabajo coinciden con HEAD:

| Archivo | Hash trabajo = HEAD |
|---|---|
| `web/src/lib/orders.ts` | `63d80c5ba57f...` ✅ |
| `web/src/lib/cash.ts` | `7e42e0eda563...` ✅ |
| `web/src/lib/goals.ts` | `2937fa51bdcd...` ✅ |
| `web/src/lib/tasks.ts` | `dce3ee5a3486...` ✅ |
| `web/src/lib/db.ts` | `b868ad6bc737...` ✅ |
| `web/src/lib/payment-rules.ts` | `f26ff415152c...` ✅ |
| `web/src/lib/payment-labels.ts` | `5979e5c3ca57...` ✅ |
| `web/src/lib/pey-events.ts` | `a8ceb6f9d3a1...` ✅ |
| `web/src/lib/checkout.ts` | `96734907e136...` ✅ |
| `web/src/components/caja-app.tsx` | `7537fde4ab10...` ✅ |
| `web/src/app/page.tsx` | `f186c576f0f0...` ✅ |

`web/src/app/api/**` y `web/src/app/pay/**`: **sin modificaciones y sin archivos nuevos**. No se tocaron `orders.ts`, `cash.ts`, `goals.ts`, `tasks.ts`, `db.ts`, `payment-rules.ts`, `payment-labels.ts`, `pey-events.ts`, `checkout.ts`, `api/**`, `pay/**`, `caja-app.tsx` ni `app/page.tsx`.

**Conclusión de contratos:** el motor que crea pedidos, registra pagos, confirma webhooks, calcula fiado y cortes sigue siendo el mismo. B no reimplementa el dominio; presenta sus resultados. Esto es una fortaleza real de esta oleada.

---

## 3. Criterios de cierre de Oleada B

| ID | Criterio | Resultado | Razón |
|---|---|---|---|
| **AC-B01** | `/caja` 200, `AppShell`, `activeHref="/caja"` | **PASS** | 200 real; nav Caja activa; sin redirect |
| **AC-B02** | Efectivo exacto y con cambio; una orden; `paid`; cambio correcto | **PASS** | Smoke 43/43 casos E; prueba mock: “Recibiste $100”, “Efectivo aplicado $70”, “Cambio $30” |
| **AC-B03** | Digital: link y QR, `payment_pending`, demo `demo_paid`, webhook real | **PARTIAL** | Link y demo probados; **QR real no ejercitado**; pey real no probado |
| **AC-B04** | Fiado exige nombre, ≤ total, `confirmed`, saldo vivo | **PASS** para `/caja` | Smoke M/M2/M3; validaciones visibles; `/fiados` legacy no se releyó contra el nuevo pedido |
| **AC-B05** | Resultado separa efectivo/digital/fiado; no cuenta digital como efectivo; demo no dice “Pagado”; `paid`+fiado abierto no dice solo “Pagado” | **PASS** en los casos probados | Mock de cash, mixto, demo y `paid`+fiado abierto; `sale-result.tsx` |
| **AC-B06** | `/ventas` real, descendente, demo/fiado correctos, **ver la 51** | **PARTIAL** | Página y paginación implementadas; **no se probó >25/51**; el dataset tenía 15 filas |
| **AC-B07** | Nav Inicio→Caja→Ventas, activa, aliases 307 | **PASS** | A smoke 33/33; rutas HTTP |
| **AC-B08** | Borrador, pending al recargar, doble click, reintento | **PASS** en lo probado | Smoke N/I/G/H; mi prueba de inputs bloqueados; **dos pestañas no probado** |
| **AC-B09** | Errores 400/409/403/404 con mensaje, sin perder borrador | **PARTIAL** | Error de red y 502 probados; no todos los códigos; mensaje no-JSON puede filtrar texto crudo |
| **AC-B10** | 1448/1366/390/320, 200%, HC, teclado, axe 0, targets ≥48, sin overflow | **PARTIAL** | Axe 0 con $1M normal/HC en 4 viewports; sin overflow 100%/200%; targets de bloque ≥44; **HIG 48 no cumple**; foco de ruta y lector real pendientes |
| **AC-B11** | Motor financiero intacto | **PASS** | Hashes y diff vacío |
| **AC-B12** | Evidencia limpia y gates | **FAIL** | Árbol sucio; `latest.json` de `9206ea1`; `latest-static` de la base; `verify:evidence` falla |

**Lectura:** el **recorrido funcional** de B está esencialmente cerrado; el **cierre formal de B** no.

---

## 4. Hallazgos P0 / P1 / P2 / P3

### P0 de producto: ninguno

No encontré un error que, en el camino normal, cobre mal, marque un pendiente como pagado, pierda una venta o duplique un cobro. Los P0 del snapshot inicial (efectivo inflado, demo pagado, fiado como deuda viva, pending perdido) están corregidos o ya no aplican.

### P0 de cierre/evidencia: árbol sucio y evidencia inválida

No es un bug de producto, pero bloquea cualquier GO formal:

- `git status` muestra 12 JSON de variantes modificados, `next.config.ts`, `oleada-a-smoke.py`, `inicio/page.tsx`, `nav.ts`, `ventas/route.ts` borrado y todo el WIP de B sin commit.
- `verify:evidence` falla con 4 chequeos:
  1. `gitAtStart.sha === HEAD` → `9206ea1` vs `26c7741`.
  2. árbol actual limpio → `dirty=true`.
  3. artefactos de `mobile` con SHA/tamaño distintos.
  4. `gatesOk` recalculado ≠ declarado.
- `latest.json` es de `9206ea1`; `latest-static.json` es de `26c7741` pero solo cubre 5 gates static de la base, no el WIP.
- El build servido tiene `buildSha=26c7741` (el commit base), no un SHA que identifique el árbol B. Es correcto para probar, insuficiente para handoff.

**No se puede declarar B cerrada ni actualizar `latest.json` como GO desde este estado.**

---

### P1-1 — CERRADO en re-auditoría (2026-11-04 10:02) — Parser de cantidades ambiguas

**Archivo:** `web/src/components/caja/types.ts:50-55` (`parseQuantity`), consumido por `sale-line-items.tsx:117-125` y `caja-screen.tsx:216-220, 263-267`.

`parseQuantity` elimina todo lo que no sea dígito o punto:

```ts
const normalized = value.replace(/[^\d.]/g, "");
```

Resultado medido en la UI actual, con precio $10:

| Entrada en “Cantidad” | Total mostrado | Esperado razonable |
|---|---:|---:|
| `1/2` | **$120.00** (12 unidades) | $5.00 |
| `2,5` | **$250.00** (25 unidades) | $25.00 |
| `1 1/2` | **$1,120.00** (112 unidades) | $15.00 |
| `1,000` (precio, no cantidad) | $1,000.00 | correcto |

El parser de dinero sí arregló `1,000`, `1,000.50` y `1.000,50` (`types.ts:17-48`). Pero la **cantidad** sigue reinterpretando fracciones, comas decimales, espacios y signos. El `inputMode="decimal"` no impide que un teclado físico o un pegado introduzcan `/`, espacio o coma. Es una entrada realista en un mercado (“media docena”, “1/2 kg”, “2,5 kg”) y produce un cobro 12×/10× mayor sin advertencia.

**Impacto:** viola el criterio explícito de `ONBOARDING_AYUDA.md` AC-08 (“cero reinterpretación silenciosa”) y puede ser un error de dinero en el mostrador. No es P0 porque requiere una entrada no decimal, pero es **P1** y debe corregirse antes de usar la Caja con personas.

**Actualización 10:02 — CERRADO.** `parseQuantity` ahora normaliza una coma decimal y exige `^\d+(\.\d+)?$` (`types.ts:50-55`). Resultado revalidado en la UI: `1/2` y `1 1/2` se rechazan con “La cantidad debe ser mayor que cero”; `2,5` da $25.00; `1,000` de precio sigue dando $1,000.00. Smoke B añadió E3 y pasó **44/44**. Ver §10.

**Fix esperado (histórico):** normalizar `,` decimal en cantidad, aceptar fracciones conocidas o **rechazar** `/`, espacios y comas con mensaje; añadir unit tests para `1/2`, `2,5`, `1 1/2`, `1,000`, `-1`, `0`.

---

### P1-2 (heredado, B lo expone) — `POST /api/demo/pay` no es idempotente y no comprueba que el pedido sea demo

**Archivos:** `web/src/app/api/demo/pay/route.ts:54-85`, `web/src/components/caja/payment-panel.tsx:106-126, 221-233`.

El endpoint:

- Genera un `transactionId` nuevo en cada llamada (`demo_txn_...`) y llama a `recordPayment`; no hay `requestId` ni idempotencia por pedido.
- Obtiene el pedido con `getOrder` y **no verifica `order.demo`** antes de marcarlo `demo_paid`.
- El lock de la UI (`actionLockRef`) es por pestaña/componente; dos pestañas o un remount pueden pagar dos veces.
- La UI muestra “Simular CoDi / Simular tarjeta” según el **modo global** `demo`, no según `order.demo` (`payment-panel.tsx:221-233`).

Esto ya estaba documentado como **R-01/R-08 P1** en `FIADO_CORTE.md` y no fue introducido por B, pero B lo pone en el recorrido principal de `/caja`. En un build demo con base reutilizada, un pedido real pendiente puede quedar `demo_paid` y desaparecer de la lista real. No es dinero real, pero corrompe la verdad del estado.

**No bloquea C** (catálogo), pero **sí impide afirmar que B está cerrada “sin doble pago demo”**. Debe decidirse: idempotencia por pedido o prohibir la simulación sobre pedidos no demo; como mínimo, exponer `order.demo` y condicionar el botón.

---

### P2 — Hallazgos no bloqueantes para C, pero relevantes antes de GO

1. **Un solo pendiente se reanuda** — `caja-screen.tsx:114-149` toma `pendingIds[pendingIds.length - 1]`; `604-627` guarda un array, pero la carga solo reanuda el último. El smoke I prueba uno; **F-04 sigue abierto**. Dos pedidos pendientes dejan el anterior sin aviso.
2. **Dos borradores y dos llaves** — `caja-screen.tsx:32-34` (`v2`) frente a `caja-app.tsx` (`v1`); el pie lo documenta (`caja-screen.tsx:595-598`), pero no hay migración ni lock cross-tab. **F-05 sigue abierto**; no prometer “sin duplicados entre pantallas”.
3. **`/ventas` hace N+1 y lee `db` directamente** — `ventas/page.tsx:15-21, 127` llama `getCredit(order.creditId)` por fila. Con 15/25 filas es aceptable; es deuda para C (`H-09`, `MN-03`). P2.
4. **Fechas de México resueltas con zona local del servidor** — `format.ts:24-34, 65-80` no fija `timeZone: "America/Mexico_City"`; `/ventas/page.tsx:152` usa `formatActivityDate`. Si el servidor corre en UTC, “Hoy” puede cambiar de día. No reproducible en este equipo; P2.
5. **“Por cobrar digital” agregado incluye demo en modo demo** — `ventas/page.tsx:44-45, 107-109` usa `sumPendingOrderBalances()` (`db.ts:1475-1487`), que en `isDemoMode()` no filtra demo. La tarjeta dice “No incluye fiado”, no “incluye demo”; la fila sí dice Demo. En el dataset actual mostraba **$120.00** de un pedido demo pendiente mientras “Cobrado confirmado” decía $0.00. No es una afirmación de pagado, pero mezcla alcances. P2.
6. **Foco de ruta sin gestionar** — `app-shell.tsx:36-51` no tiene `RouteFocus`; al pulsar “Nueva venta” en `/ventas` y llegar a `/caja`, `document.activeElement` es **BODY**. Es el P2-6 de `ACCESIBILIDAD.md`; no es un bloqueo de venta.
7. **Error de alta no mueve el foco** — `sale-line-items.tsx:28-41` marca `addError` y el input tiene `aria-invalid` (`187`), pero el foco se queda en “Agregar”. Verificado. El foco al quitar concepto **sí** está corregido (`caja-screen.tsx:506-517`).
8. **El total no escala con texto al 200% (text-only)** — `caja.css:331-340` usa `font-size: min(2.5rem, 11vw, 40px)`; a 1448 queda en 40 px con y sin 200%; a 320 queda en 35.2 px. **No hay overflow** (medido en 1448/1366/390/320 y 724×543 con `$1,000,000.00`), y el zoom de navegador sí escala. Si el criterio es “todo el texto al 200%”, es P2; si es “sin pérdida por zoom”, pasa.
9. **Targets de 44 vs HIG 48** — `caja.css:220-228` (`.mc-caja-icon-button` 44×44), `caja.css:478-489` (`.mc-caja-clear` 44), `ventas.css:216-224` (`summary` 44) cumplen ≥44 y WCAG 2.5.8, pero `AUDITORIA_REPO.md:592` cita un contrato HIG de 48. Hay contradicción documental (`HIG-DESIGN.md:35` dice 44 pt; `HIG-DESIGN.md:605` dice 48). **No hay HIG nuevo de `/caja`/`/ventas`**; el 5/5 es legacy. P2/waiver.
10. **Etiquetas de estado duplicadas** — `payment-panel.tsx:265-282`, `sale-result.tsx:169-188`, `ventas/page.tsx:251-274` mantienen tres `statusLabel` con vocabulario distinto (“Registrado”, “Pendiente”, “Fiado + cobro”, “Saldado”). No hay contradicción de dinero en los casos probados, pero sigue la deuda H-15/MN-11. P2/P3.
11. **Paginación >25/50 no ejercitada** — `ventas/page.tsx:41-50, 221-238` implementa 25/página y clamp; el dataset tenía 15. No se probó página 2, 51 ni `?page=99` con datos reales. El criterio AC-B06 no está cerrado. P2 de evidencia.
12. **Errores no-JSON pueden mostrar texto crudo** — `caja-screen.tsx:630-642` y `payment-panel.tsx:255-263` solo traducen red y `requestId`; un 500 HTML/`Unexpected token` se mostraría tal cual. AC-01 no está garantizado fuera del camino JSON. P3/P2.

---

### P3 — Deuda menor

- “Volver a Caja” es un `Link` a la misma ruta (`sale-result.tsx:157-159`), no una acción “nueva venta”; el botón primario “Nueva venta” sí resetea.
- El icono del resultado usa el mismo acento verde para efectivo, fiado y demo (`sale-result.tsx:68`; `caja.css:687-696`), aunque el texto lo aclara. AC-04 no se cumple al 100%.
- `window.confirm` para “Descartar venta” (`caja-screen.tsx:547-549`), en vez de un patrón inline.
- No hay `aria-busy` en “Registrando…” ni en las acciones de pago.
- Los importes se muestran como `$1,234.50` sin “MXN” textual; no se probó cómo los verbaliza un lector.
- `?page=99` se renderiza como página 1 pero la URL conserva `page=99`; no hay `aria-current` en el pager.
- No hay tarjeta agregada de fiado vivo (F-07); la tarjeta digital ya aclara que no incluye fiado.

---

## 5. Checklist específico solicitado

| Punto | Resultado | Evidencia |
|---|---|---|
| Efectivo vacío/insuficiente con CTA deshabilitado **sin mensaje** | **CORREGIDO** | CTA “Faltan $90.00” / “Faltan $40.00” + mensaje visible (`sale-summary.tsx:54-80, 126-158`; prueba runtime) |
| CTA de efectivo insuficiente rotulado “Generar cobro” | **CORREGIDO** | Ahora “Faltan $40.00”; “Generar cobro” queda solo para el faltante digital (`sale-summary.tsx:66-80`) |
| Fiado sin cliente / fiado mayor al total sin mensaje | **CORREGIDO** | Hint “Escribe el nombre…” y alert “El fiado no puede ser mayor…” (`sale-summary.tsx:160-214`); CTA deshabilitado |
| Error de red crudo y reintento | **CORREGIDO** en fetch de red | Mensaje “No sabemos si la venta quedó registrada…”; CTA “Reintentar venta”; misma `requestId` (`caja-screen.tsx:630-642`; prueba abort + smoke H) |
| Parser de “1,000” | **CORREGIDO** para dinero | `parseMoneyCents` da `$1,000.00`; **pero cantidad `1/2`/`2,5` sigue mal (P1-1)** |
| Efectivo recibido vs aplicado en resultado | **CORREGIDO** | Mock cash $70/$100: “Recibiste $100”, “Efectivo aplicado $70”, “Cambio $30” (`sale-result.tsx:89-104`) |
| Demo vs pagado en `/ventas` y resultado | **CORREGIDO** en el caso demo | Filas demo: “DEMO”, “Demo, no es dinero real”; resultado demo: “Pago demo (simulado)”; no dice Pagado (`ventas/page.tsx:128-179`; `sale-result.tsx:27-63`) |
| “Por cobrar” global vs día | **CORREGIDO en copy** | “Links y QR de todos los días. No incluye fiado.” (`ventas/page.tsx:107-109`); es global a propósito |
| Fiado saldado vs saldo vivo | **CORREGIDO** | `/ventas` usa `getCredit().balanceCents`; “Saldado”/“Fiado saldado” vs “Saldo vivo” (`ventas/page.tsx:127-200`); smoke M3 |
| Foco tras quitar concepto | **CORREGIDO** | Enfoca siguiente/anterior o alta (`caja-screen.tsx:506-517`); runtime: input de la línea restante, no BODY |
| Foco tapado por paybar/nav | **CORREGIDO** | `scroll-padding-bottom`/`scroll-margin-bottom: 190px` (`caja.css:840-852`); runtime 390/320 normal y 200%: Fiado/Mixto/efectivo no tapados; paybar 85 px y nav 65 px |
| Total `$1,000,000.00` y texto 200% | **CORREGIDO en overflow** | 1448/1366/390/320 y 724×543: `scrollWidth === clientWidth`; texto 200% sin overflow. **No escala el total (P2-8)** |
| Idempotencia por `requestId` / edición durante POST | **CORREGIDO** | Inputs de línea, métodos, efectivo, fiado y CTA `disabled` durante POST (prueba con request pendiente); smoke H reutiliza `requestId`; `saleLockRef` |
| Pedidos pendientes al recargar | **CORREGIDO para uno** | `PENDING_KEY`, `GET /api/orders/[id]`, vista payment (`caja-screen.tsx:114-149`); smoke I; **varios pendientes sigue P2** |

---

## 6. Evidencia declarada vs evidencia que realmente prueba B

| Evidencia | Qué dice | Veredicto de alcance |
|---|---|---|
| `quality-reports/oleada-b/capturas/oleada-b-smoke.json` | **43/43 PASS**, 09:37 | **Válida para el camino funcional del build 09:34**, no es gate formal; crea/resetea datos demo |
| `quality-reports/oleada-b/oleada-b-smoke.json` | 33/33, 08:55 | **Stale**: anterior a los fixes de 09:17–09:31. No usar como cierre |
| `quality-reports/oleada-b/a11y.json` | axe 0 normal/HC, targets ≥44, 200% sin overflow, 09:36 | **Solo estado vacío**. No prueba contenido/importes grandes. Mi re-ejecución con `$1,000,000` y conceptos da axe 0 normal/HC en 1448/1366/390/320 y sin overflow |
| `ACCESIBILIDAD.md` | 3 P1: foco tapado, total overflow, foco a BODY | **Pre-fix (09:27)**. El código 09:28–09:31 y el build 09:34 corrigen los tres; lo verifiqué en runtime. El informe sigue siendo evidencia histórica, no del estado actual |
| `demo/hig-after/audit.json` | HIG **5/5**, 09:11, `dirty:true` | **No es B**: `hig-after-audit.py:705` navega a `BASE` (`/`, Caja legacy), antes de que existiera `/caja` (09:12) o `/ventas` (09:23). No cubre las pantallas nuevas |
| `harness/evidence/mobile-320-e2e.json` | **60/60**, 09:03 | **No es B**: `mobile-320-e2e.py:185` hace `page.goto(BASE)` = `/` legacy. No cubre `/caja`/`/ventas` |
| `oleada-a-smoke.py` | **33/33**, reproducido por mí | **Sí es B** para shell/rutas/nav/aliases; no prueba el flujo de cobro |
| `p0-venta-e2e.json` | 66/0, 09:00, `dirty:true`, base 3211 | **Legacy `/`**: `p0-venta-e2e.py:113` hace `page.goto(BASE)`. No prueba `/caja` (H-18). Útil como no-regresión del motor |
| `p0-fiado` 51/0, `p0-corte` 69/0, `p0-integracion` 51/0, `p0-dinero` 45/0+3 KNOWN | 09:01–09:03, `dirty:true`, bases 3212/3213 | **No cubren la UI nueva**; sí el dominio legacy. No son evidencia de cierre B |
| `webhook 40/40`, `checkout 19/19` | `latest.json` de `9206ea1` | **No es el build B**: `latest.json` es de otro SHA. No re-ejecutados aquí. Los archivos financieros están intactos, pero la evidencia no es del árbol B |
| `latest-static.json` | `ok:true`, `26c7741`, limpio, 5 gates | **Base estática**, no runtime ni B |
| `latest.json` | `ok:true`, `9206ea1`, 23 gates | **Obsoleto** para `26c7741`; `verify:evidence` falla |
| `verify:fast` (mi ejecución) | 3/3 gates PASS (guard/lint/types) | **Compila, lintea y tipa**, pero el harness falla por `dirty=true`; no genera `latest` válido |
| `verify:evidence` (mi ejecución) | **FAIL, 4 chequeos** | SHA distinto, árbol sucio, artefactos mobile alterados, `gatesOk` recalculado falso |

**Conclusión de evidencia:** hay una prueba funcional buena del build actual (43/43), y mis pruebas independientes cubren los puntos que el smoke no cubre (foco, axe con contenido, 200%, parser, mock de resultados). Pero **no existe evidencia formal de cierre**: ni `latest.json` del árbol B, ni `verify:full`, ni HIG de las rutas nuevas.

---

## 7. Lo que NO se probó (límites explícitos)

- **Lector de pantalla real** (NVDA, JAWS, VoiceOver, TalkBack). Verifiqué foco, nombres y `aria-*` en DOM/Chromium; no sé cómo verbaliza `$1,234.50` ni el H2 enfocado.
- **iOS/Safari real**, safe areas y **teclado virtual real**. La simulación de 390×400 y el `scroll-margin` pasan; `interactive-widget=resizes-content` no está declarado y la paybar es `fixed`.
- **HCM real de Windows**. Solo emulación `forced-colors: active`; no lo tomo como pase ni como fallo.
- **QR real**: existe “Generar QR” y el `alt`, pero no se generó ni escaneó un QR. El smoke solo comprueba el link.
- **Pago pey real / webhook real / checkout real**: servidor `DEMO_MODE=true`; no hay `PEY_API_KEY`. Los 40/40 y 19/19 son de `9206ea1` y de un contrato sintético, no de una pasarela real.
- **Modo real (`DEMO_MODE=false`)**: no probado. La lógica de `SaleResult` para cash real sin `demo` se leyó, no se ejecutó.
- **Paginación real con >25/51 ventas**, página 2, `?page=99`, y estados `paid`/`credit` reales en filas. El dataset tenía 15.
- **Dos pestañas / dos borradores / varios pendientes**: código y documentación; no prueba de concurrencia real.
- **Full gate**: `verify:full` no ejecutado. `verify:fast` sí, 3/3, pero árbol sucio.
- **HIG/contrast/motion sobre `/caja` y `/ventas`**: no existe corrida; el HIG 5/5 es legacy.
- **Túnel/público**: el link actual de la captura es `http://localhost:3100/pay/...`; `.env.local` apunta a un `trycloudflare`. No hay handoff público válido.

---

## 8. Condiciones para commit y GO

### 8.1 Commit acotado (checkpoint): **sí, autorizado**

No lo ejecuté. Lo autorizaría como **checkpoint de rama**, nunca como commit de cierre:

**Incluir:**
- `web/src/app/caja/**`, `web/src/app/ventas/page.tsx`, `web/src/app/ventas/ventas.css`
- `web/src/components/caja/**`
- `web/src/components/shell/nav.ts`, `web/src/app/inicio/page.tsx`
- `web/src/app/ventas/route.ts` (borrado)
- `web/next.config.ts` (solo headers privados)
- `web/scripts/oleada-a-smoke.py`, `web/scripts/oleada-b-*.py`
- `quality-reports/oleada-b/**` (informe y evidencia B)

**Excluir:**
- Los 12 JSON de `quality-reports/mercado-cero-final/14_EVIDENCIAS/variantes/**` modificados (no son B).
- `.next`, capturas temporales, `harness/evidence/runs/*` generado por mi `verify:fast` si no se quiere añadir ruido.

**Mensaje:** debe declarar que es WIP/checkpoint y mencionar los P1 abiertos (parser de cantidades y demo-pay heredado). No debe decir “Oleada B cerrada”.

### 8.2 Para convertir el commit en GO de B

1. **Corregir P1-1**: normalizar/rechazar `1/2`, `2,5`, `1 1/2`, `-1` en cantidad; tests unitarios y E2E de la UI.
2. **Decidir P1-2**: idempotencia de `/api/demo/pay` por pedido o prohibir simulación sobre pedidos no demo. Si se acepta como KNOWN, documentarlo y no prometer “sin doble pago demo”.
3. **Commit limpio** y build nuevo con SHA del commit B.
4. `npm run verify:full` (o el subconjunto aplicable) y `npm run verify:evidence` **PASS** contra HEAD limpio, `gitAtStart.dirty:false`, `serverBuildSha` igual.
5. **HIG/contrast/motion/axe** sobre `/caja` y `/ventas`, no sobre `/` legacy; recapturar 1448/1366/390/320 y estados vacío, conceptos, cambio, fiado, demo, pendiente, resultado.
6. Resolver o aceptar formalmente el target 48 vs 44.
7. Probar **>25/>50 ventas**, página 2, `?page=99`; dos pestañas; varios pendientes; QR real; link en dispositivo real.
8. Probar modo real (`DEMO_MODE=false`) y, si hay pey, webhook/checkout real en un entorno aislado.
9. Revisar foco de ruta y error de alta (P2), y el total text-only si el criterio interno es 200% de texto, no solo zoom.

### 8.3 Handoff público

**Sigue NO-GO.** No se alteraron los gates, pero:

- `latest.json` es de `9206ea1`; `verify:evidence` falla.
- El árbol está sucio y el buildSha no identifica B.
- El link generado por el servidor es `http://localhost:3100/...`; el `.env.local` tiene un túnel, pero no hay una corrida pública válida.
- No hay full gate, ni pey real, ni QR real, ni lector real.
- No se debe publicar `latest.json` ni cambiar el estado de handoff hasta completar 8.2.

---

## 9. Veredicto final

| Pregunta | Respuesta |
|---|---|
| **¿Oleada B lista para Oleada C?** | **Sí, como base funcional y con condiciones.** No hay P0 de dinero en el camino principal; C (catálogo) es aditivo. Ver §10: P1-1 ya está cerrado; queda P1-2 heredado. |
| **¿B formalmente cerrada?** | **NO-GO.** Falta evidencia limpia, full gate, HIG de las rutas nuevas y resolución de P1/P2. |
| **¿Handoff público?** | **NO-GO.** Túnel/`latest.json`/buildSha/APP_URL local y ausencia de pey real lo bloquean. |
| **¿Autorizas commit acotado?** | **Sí, un commit de checkpoint**, no de cierre ni de merge. No lo ejecuté. |
| **¿P0 de producto?** | **Ninguno.** |
| **¿P1 de producto?** | **Dos históricos; P1-1 cerrado; queda P1-2 heredado (ver §10).** |

**Veredicto:** Oleada B logró lo difícil: una Caja nueva que usa el motor existente sin tocarlo, con verdad de efectivo/digital/fiado/demo mucho más honesta que el snapshot inicial. Pero “la UI compila” y “el smoke pasa” no equivalen a cierre: el demo-pay heredado sigue sin idempotencia y la evidencia formal no existe para este árbol. **Lista para construir C; no lista para declarar B cerrada ni para publicar.**

> **Actualización 10:05:** el P1 del parser quedó cerrado y el smoke subió a 44/44. El veredicto vigente es el de la **§10**, que reemplaza esta tabla en lo que respecta a P1-1.

---

## 10. Re-auditoría de fixes (2026-11-04, 10:05)

### 10.1 Qué cambió desde el informe anterior

- **Único cambio de producto:** `web/src/components/caja/types.ts` (09:51:42). `parseQuantity` ahora normaliza una coma decimal y exige `^\d+(\.\d+)?$`; el resto de fixes ya estaba en el árbol de 09:31 y en el build de 09:34.
- **Build actual:** `BUILD_ID=2zVC5ao_IW88yAOe593As`, compilado **09:52:34**, `buildSha=26c7741...`; servidor `:3100` sano.
- **Smoke actualizado:** `web/scripts/oleada-b-smoke.py` añade E3 para `1/2`; el JSON se reescribió con **44/44 PASS**.
- **`a11y.json` regenerado:** `/caja` y `/ventas`, 1448/1366/390/320, axe 0 normal/HC, `under44=0`, zoom 200% sin overflow (estado vacío).

### 10.2 Verificación ejecutada en esta re-auditoría

| Prueba | Resultado |
|---|---|
| `python scripts/oleada-b-smoke.py` | **44 PASS / 0 FAIL** |
| `python scripts/oleada-b-a11y.py` | **axe 0 normal/HC** y **under44 0** en `/caja` y `/ventas` × 4 viewports; zoom 200% sin overflow |
| Parser `1/2` | **Rechazado**: 0 líneas, “La cantidad debe ser mayor que cero” |
| Parser `1 1/2` | **Rechazado** con el mismo mensaje |
| Parser `2,5` | **$25.00** (2.5 × $10) |
| Parser `1,000` (precio) | **$1,000.00** |
| Foco al quitar renglón | Foco en `line-description-b` (siguiente); no BODY; `role=status` con “Concepto eliminado” en código |
| Foco Fiado/Mixto a 390/320 | No tapado; paybar 85 px y nav 65 px a 200%; `scroll-margin-bottom` efectivo |
| Total `$1,000,000.00` a 1448/1366/390/320 | Sin overflow a 100% y a texto 200% (medido) |
| Efectivo con cambio | Smoke E: “Recibiste $120.00; se aplicaron $105.00” + cambio $15.00 |
| Fiado saldado | Smoke M3: fila “Fiado saldado $100.00”; no “Fiado, no cobrado” |
| Demo | Smoke L: resultado “Pago demo (simulado)”, `demo_paid`; filas `/ventas` rotuladas DEMO |
| Error de red/reintento | Smoke H: mensaje accionable, “Reintentar venta”, mismo `requestId`, sin duplicado |
| Inputs durante POST | Bloqueados (`sale-line-items` recibe `disabled={saving}`); revalidado con request pendiente |
| H1 por vista | `PageHeader` usa “Nueva venta” / “Cobrar venta” / “Venta registrada” (`caja-screen.tsx:423-433`) |
| Reduced motion | `goToPayment` usa `behavior:"auto"` si `prefers-reduced-motion` (`caja-screen.tsx:382-389`) |
| Contratos financieros | Hashes de `orders.ts`, `cash.ts`, `goals.ts`, `tasks.ts`, `db.ts`, `payment-rules.ts`, `payment-labels.ts`, `pey-events.ts`, `checkout.ts`, `caja-app.tsx`, `app/page.tsx` = HEAD; `api/**` y `pay/**` sin diff |

### 10.3 P0/P1 vigentes

- **P0 de producto: ninguno.**
- **P1-1 (parser): CERRADO.** La regex rechaza fracciones y espacios; la coma decimal funciona; smoke E3 y prueba directa lo cubren.
- **P1-2 (demo pay): ABIERTO, heredado.** `POST /api/demo/pay` sigue generando un `transactionId` nuevo por llamada y no comprueba `order.demo` (`api/demo/pay/route.ts:54-85`). B lo expone en `payment-panel.tsx:221-233`. No es dinero real, pero puede duplicar un pago demo o marcar un pedido no demo como `demo_paid` en una base reutilizada. Requiere decisión (idempotencia por pedido o bloquear la simulación sobre pedidos no demo).
- **P2 que permanecen:** la cola `{orderIds:[]}` guarda varios, pero solo se reanuda el último y los anteriores no se muestran (`caja-screen.tsx:114-149`); foco de ruta sigue cayendo en BODY; el error de alta no mueve el foco; el total no crece con texto al 200% (aunque no desborda); el agregado “Por cobrar digital” incluye demo en modo demo; HIG 48 vs 44; `/ventas` N+1 y fechas con zona del servidor; paginación >25/51 no probada. Nada de esto es P1 de dinero.
- **P3:** “Volver a Caja” a la misma ruta, verde del icono de resultado para todos los estados, `window.confirm`, falta `aria-busy`, MXN no verbalizado.

### 10.4 Veredicto actualizado

| Pregunta | Respuesta |
|---|---|
| **¿Quedan P0 abiertos?** | **No.** No hay P0 de producto. |
| **¿Quedan P1 abiertos?** | **Sí, uno heredado:** demo-pay sin idempotencia/`order.demo` (P1-2). El P1 del parser está cerrado. |
| **¿Oleada B lista para Oleada C?** | **Sí, como base funcional, con la condición de no declarar B cerrada.** C (catálogo) es aditivo; el flujo de Caja/ventas ya es utilizable en demo. |
| **¿B formalmente cerrada?** | **NO-GO todavía.** Falta commit limpio, evidencia static/evidence, full gate, HIG de `/caja`/`/ventas` y decisión sobre P1-2. |
| **¿Handoff público?** | **NO-GO.** Persisten `latest.json` de `9206ea1`, árbol sucio, `verify:evidence` con 4 fallos y link `localhost`; no hay full gate ni pey real. |
| **¿Autorizas commit acotado?** | **Sí, commit de checkpoint**, con el alcance B y sin merge/tag/GO. No lo ejecuté. |
| **¿Qué falta para cierre formal?** | Commit acotado; `verify:static` y `verify:evidence` PASS contra HEAD limpio; `verify:full` (o full con tunnel omitido y documentado como parcial, nunca como `ok:true`); HIG/contrast/motion específicos de las rutas nuevas; decisión/cierre de P1-2; y, para publicación, pey/túnel/QR reales. |

**Veredicto vigente:** Oleada B ya no tiene el P1 de dinero que bloqueaba la captura de cantidades. Queda **lista para construir C** y para un **commit acotado de checkpoint**. No está lista para **cierre formal ni handoff público**: el P1 heredado de demo-pay, la evidencia sucia y la ausencia de HIG/full gate siguen siendo bloqueos reales, no cosméticos.
