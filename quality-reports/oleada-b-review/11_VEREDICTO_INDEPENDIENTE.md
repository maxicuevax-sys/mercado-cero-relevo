# 11 — VEREDICTO INDEPENDIENTE DE LA REVISIÓN ADVERSARIAL — OLEADA B

**Agente:** `mc-verificador-final` (subagente independiente, solo lectura)
**Fecha:** 4 de noviembre de 2026, 18:40–19:10 (America/Mexico_City)
**Repo:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero`
**Rama:** `design/oleada-b-caja-ventas`
**HEAD:** `4130e71d668e5e4693a8f5b634d2d2f953d21b02` (`docs: cierre formal local de Oleada B`)
**Build servido:** `http://localhost:3100`, `buildSha=4130e71d668e5e4693a8f5b634d2d2f953d21b02`, `builtAt=2026-11-04T17:00:05.443Z`
**Árbol de producto:** limpio. El único untracked es `quality-reports/oleada-b-review/` (evidencia de esta revisión; **no se borró**).
**Declaración:** no implementé, no corregí producto, no hice commits ni actualicé gates/`latest.json`. Solo leí, ejecuté reproducciones read-only y agregué evidencia propia `final-*` y estos dos informes.

---

## 0. Veredicto en una línea

**Oleada B no está cerrada: tiene 2 P0 de verdad visible del dinero y 13 P1 de flujo, presentación, datos demo/accesibilidad; el motor financiero sí está intacto y no hay P0 de persistencia, webhook ni `paid`.**

| Nivel | Decisión | Lectura |
|---|---|---|
| **Cierre local de Oleada B** | **NO-GO** | Los dos P0 se reproducen en el camino principal de fiado y mixto. El 44/44 smoke no los cubre. |
| **Demo controlada** | **GO CONDICIONADO solo con guion restringido** | Válida únicamente si el guion se limita a efectivo exacto/con cambio y digital demo, con operador. **NO-GO** para un recorrido que incluya fiado puro o mixto efectivo+digital. |
| **Handoff público** | **NO-GO** | Sin pago pey real, QR real, lector real, iOS/Safari ni `latest.json` full de este HEAD. `APP_URL` es local. |

**Conteo consolidado:** **P0 = 2**, **P1 = 13**, **P2 = 18**, **P3 = 10**. Las severidades están explicadas y, cuando dos informes discrepan, se resuelven abajo con reproducción.

---

## 1. Método y alcance real

Leí los ocho informes de `quality-reports/oleada-b-review/auditorias/`, la entrega `quality-reports/oleada-b/ENTREGA_OLEADA_B.md`, el veredicto previo `quality-reports/oleada-b/VEREDICTO_INDEPENDIENTE.md`, `harness/STATE.md` y `quality-reports/MIGRACION_INTEGRAL_MERCADO_CERO.md`. No los tomé como verdad: contrasté código, base read-only y runtime.

Reproducciones propias:

- Playwright 1.64 + Chromium 156 headless, locale `es-MX`, contra `http://localhost:3100` build `4130e71`.
- Servidor aislado `http://localhost:3107`, mismo build, copia SQLite por `sqlite3.backup()`, `DEMO_MODE=false`, para el caso `/ventas` con `payment_pending` real. Se apagó al terminar.
- Base `web/data/mercado-cero.db` leída en modo read-only; **no** hice POST de ventas, **no** llamé `/api/demo/reset`, **no** borré datos.
- `git hash-object` vs `HEAD`, `git diff --name-only oleada-a-cierre..HEAD` y `npm run verify:evidence -- --static`.
- Scripts propios: `final_verify.py`, `final_extra.py`, `final_history_verify.py`, salidas `EVIDENCIAS/final-verificador*.json` y capturas `final-*.png`.

### 1.1 Reproducciones independientes

| ID | Qué probé | Resultado | Observado / evidencia |
|---|---|---|---|
| **REP-01** | Fiado puro, orden abierta `ord_58d5096d60ea48f09ceb` (`total=10000`, `paid=0`, `credit=10000`) | **P0 reproducido** | El resultado dice “Quedó anotado en Fiado. Solo el fiado es deuda; **el efectivo sí se registró en la caja**”. No hay ningún pago. `final-fiado-puro.png`, `final-verificador.json`. |
| **REP-02** | Mixto efectivo+digital, `ord_dda282fd270f4f92ad6e` (`total=10000`, `paid=6000`, `due=4000`) | **P0 reproducido** | Panel: “Falta cobrar $40.00. El pedido ya está registrado. **El dinero aún no se considera recibido**”. No muestra “Recibiste $60.00” ni el efectivo aplicado; no hay “Nueva venta”. `final-mixto-panel.png`. |
| **REP-03** | Importe de línea con 3 conceptos, 1448/1366/1280/768/390 | **P1 reproducido** | A 1448/1366/1280/768 el `span.tabular-nums` mide **1×1 px** (clip). A 390 mide **96×22.6 px** y se ve. `final-line-*.png`, `importe-linea-invisible.txt`. |
| **REP-04** | CTA “Confirmar venta” con 3 conceptos y `scrollY=0` | **P1 reproducido** | 1448×1086: `y=839.6`, dentro. 1366×768: `y=817.9`, `bottom=873.9` → fuera. 1280×800: `y=852.6` → fuera. 768×1024: `y=1447.4` → muy fuera. 390: CTA real `y=1837`, pero paybar visible `y=715–780`. `final-cta-*.png`, `shell-cta-scrolltop.json`. |
| **REP-05a** | Texto 200 % real (`html font-size=32px`), 1366×768, 3 conceptos | **P1 reproducido** | CTA `y=1359.7`, `bottom=1415.7`; `scrollWidth=1366` (el test de overflow pasa, pero el CTA desaparece). `final-text200-1366.png`, `text200-geometry.txt`. |
| **REP-05b** | `/ventas?page=2` a 320 + texto 200 % | **P1 reproducido** | `scrollWidth=337` vs `clientWidth=320`: **17 px de scroll horizontal**. `final-text200-ventas-320.png`, `a11y-text-resize.json`. |
| **REP-06a** | Dos borradores v1 (`Quesadilla legacy`) y v2 (`Cafe nuevo`) en el mismo origen | **P1 reproducido** | `/caja` restaura solo v2; v1 sigue en `localStorage` y no se avisa. Ambas llaves existen. `final-two-drafts-caja.png`. |
| **REP-06b** | `/caja` → nav “Fiados” → sidebar legacy “Caja” | **P1 reproducido** | URL final `/?tab=fiado`; composer legacy visible; composer nuevo no; v2 sigue guardado pero oculto. `final-two-cajas-nav.png`, `repo-two-cajas.json`. |
| **REP-06c** | `/` con ambos borradores | **P1 reproducido** | `/` restaura solo v1 en sus inputs; v2 sigue existiendo y no se avisa. `final-two-drafts-legacy.png`. |
| **REP-07** | “Cobrado confirmado” en `/ventas` con 9 abonos demo | **P1 reproducido** | Tarjeta: **“Cobrado confirmado $450.00”** con subtítulo “Solo efectivo real y pagos verificados; **demo no cuenta**”. La suma de `credit_payments.demo=1` es 45000 y `dashboard.summary.cashCents=45000`. `final-abono-demo-cobrado.png`. |
| **REP-08** | `/ventas` real aislado 3107, orden mixta `paid=6000` pasada a `payment_pending` | **P1 reproducido** | Fila: “PENDIENTE / Pedido AD6E / $100.00 / Pendiente de cobro / Falta cobrar $40.00”. **No** muestra “Cobrado $60.00”. `final-ventas-payment-pending.png`, `final-verificador-history.json`. |
| **REP-09** | Mixto $100: efectivo $100 + fiado $100 | **P1 reproducido** | “Cambio a devolver $100.00. Se aplicaron $0.00 al cobro.”; CTA “Registrar fiado $100.00”. `final-mixto-phantom.png`, `repo-mixto-phantom-change.json`. |
| **REP-10** | Mixto válido $40 efectivo + $30 fiado + $30 digital | **P1 reproducido** | Aviso falso “El total cambió. Ajusta el monto a fiado para que coincida con $100.00.” y CTA “Generar cobro $30.00”. `final-mixto-false-total.png`, `repo-mixto-hint.json`. |

**Nota de integridad:** el `44/44` smoke es un listado de 44 objetos `{name, ok, detail}` sin SHA, build ni timestamp. No es un gate formal y no cubre ninguno de los diez casos anteriores. Se discute en §6.

---

## 2. Motor financiero: intacto, con una excepción no financiera

### 2.1 Archivos protegidos

`git hash-object` del árbol de trabajo = `git rev-parse HEAD:<archivo>` para:

`lib/orders.ts`, `lib/cash.ts`, `lib/goals.ts`, `lib/tasks.ts`, `lib/db.ts`, `lib/payment-rules.ts`, `lib/payment-labels.ts`, `lib/pey-events.ts`, `lib/checkout.ts`, `app/page.tsx`.

Además, `git diff --name-only oleada-a-cierre..HEAD -- web/src/app/api web/src/app/pay` devuelve **vacío**. No hay una segunda base, un segundo webhook ni un segundo motor de pagos.

### 2.2 Excepción: `caja-app.tsx`

`git diff --name-only oleada-a-cierre..HEAD` sí muestra **`web/src/components/caja-app.tsx`**. El cambio es solo el `next/dynamic` de `ClosingChecklist` (`caja-app.tsx:20-29`), que afecta a la pestaña legacy de Corte y no a venta, pagos, draft ni a la Caja nueva.

**Consecuencia documental:** la frase de `ENTREGA_OLEADA_B.md` “components/caja-app.tsx sin cambios” es falsa; `01_repo.md` ya lo corrigió. El motor financiero sigue intacto, pero la documentación de cierre no es exacta.

### 2.3 Qué capa es cada hallazgo

| Hallazgo | Capa | ¿Datos? | ¿Motor? |
|---|---|---|---|
| P0-01 banner de fiado | Presentación / copy | No; `paid=0` correcto en DB | No |
| P0-02 panel mixto oculta efectivo | Presentación / verdad visible | No; `paid=6000` correcto en DB | No |
| P1-01 dos Cajas/drafts | Flujo / almacenamiento cliente | No | No |
| P1-02 importe de línea | CSS / presentación | No | No |
| P1-03 CTA fuera del fold | Layout | No | No |
| P1-04 200 % | Layout / a11y | No | No |
| P1-05 foco de ruta/paginación | A11y | No | No |
| P1-06 pendiente secuestra Caja | Flujo cliente | No | No |
| P1-07 cambio fantasma / aviso falso | Cálculo de presentación en cliente | No; el servidor recibe lo que la UI confirma | No |
| P1-08 historial oculta efectivo | Read model / presentación | No; `paid_cents=6000` correcto | No |
| P1-09 abono demo en “Cobrado confirmado” | Agregado demo en `db.ts` | **Sí, métrica demo** | No toca `payments` reales |
| P1-10 `/api/demo/pay` | API demo heredada | Sí, estado demo | **Heredado, no B** |
| P1-11 nav legacy | Navegación / producto | No | No |
| P1-12 502 + edición duplica | Flujo / `requestId` cliente | Sí, dos órdenes pagadas | No cambia `orders.ts` |
| P1-13 Inicio 768 | Layout heredado A | No | No |

**Conclusión:** no hay P0 de persistencia, webhook, `paid` ni corrupción del ledger. Los P0 son de **presentación/verdad visible**. Los P1 son de **flujo, presentación, datos demo y accesibilidad**; solo P1-10 y P1-09 tocan datos, y ambos son demo/heredados. El entorno no causa los P0; el modo demo hace visible P1-09 y permite reproducir el resto.

---

## 3. Veredicto por las 13 condiciones del encargo

> **Trazabilidad:** el encargo original no está archivado como archivo en el repo (no existe `00_ENCARGO.md` ni equivalente). Para no inventar una lista, consolido las 13 condiciones verificables a partir de los 12 AC-B de `AUDITORIA_REPO.md` §8.1 más la condición transversal de continuidad de Caja que el propio encargo exige al hablar de “dos borradores / dos Cajas”. Si el encargo las numera distinto, el contenido es el mismo y ninguna queda sin veredicto.

| ID | Condición | Resultado | Razón y evidencia |
|---|---|---|---|
| **C-01** | Rutas y shell: `/caja` 200 con AppShell, `/ventas` 200, aliases 307, `/pay/**` intacto, un solo shell visible | **PARTIAL** | Pasa lo esencial (`01_repo.md` §3, `03_shell.md` §2): `/caja` 200, `/ventas` 200, `/fiados`, `/corte`, `/metas` y `/pendientes` 307, `/pay` sin shell. Fallan `?ayuda=1` en `/caja`/`/ventas`, `?page` no canónica y la nav que presenta legacy como migrado. |
| **C-02** | Caja manual y efectivo: conceptos, cantidad, precio, efectivo exacto/con cambio, insuficiente bloquea, una sola orden | **PASS** | Smoke E/F y `pagos-ui-flow.json`; mi REP-04 confirma que el CTA existe. No re-ejecuté un POST nuevo. |
| **C-03** | Digital: link/QR, `payment_pending`, demo `demo_paid`, nunca `paid`; webhook real | **PARTIAL** | Link, QR generado, pendiente y demo funcionan (`04_ventas_pagos.md` G/H); **QR real, pey real y webhook real no se probaron**. `/api/demo/pay` sigue sin `order.demo` ni idempotencia (P1-10). |
| **C-04** | Fiado puro y mixto: nombre obligatorio, importe ≤ total, `confirmed`, saldo vivo, sin contarlo como efectivo | **FAIL** | El ledger está bien (0 payments, credit 10000; mixto 6000+3000), pero la UI miente: P0-01, P0-02, P1-07. La condición incluye verdad visible, no solo DB. |
| **C-05** | Resultado separa efectivo/digital/fiado/demo; no dice “Pagado” a demo; `paid`+fiado abierto no se pinta solo “Pagado” | **FAIL** | P0-01 y P0-02; además el título demo de mixto con fiado dice “Venta cobrada en efectivo (demo)” (P2-04) y `paid`+fiado abierto puede mostrar “Pagado” (P2, ver B-11 de `01_repo.md`). |
| **C-06** | `/ventas` real, descendente, paginada, estados verdaderos, demo etiquetado, fiado original/saldo | **FAIL** | La lista y la paginación existen (25/página; 128 órdenes; página 2 verificada), pero oculta `paid_cents` en `payment_pending` (P1-08), rotula “Fiado, no cobrado” tras abono parcial (P2-19) y suma abonos demo a “Cobrado confirmado” (P1-09). |
| **C-07** | Borrador, pendiente al recargar, doble clic, reintento, 502, errores 400/409/403/404 sin perder datos | **PARTIAL** | Borrador, doble clic y reintento con misma llave pasan (`pagos-ui-flow.json` D/F/H); fallan pendiente que secuestra la Caja (P1-06), puntero que resucita (P2-06), 502+edición que duplica (P1-12) y draft corrupto que tumba `/caja` (P2-07). |
| **C-08** | Continuidad de Caja: un solo draft/requestId/pending o migración/lock; la nav no lleva a una Caja distinta sin aviso | **FAIL** | REP-06a/b/c: dos llaves, dos drafts, dos requestId; `/caja` → Fiados → Caja legacy deja la URL en `/?tab=fiado` y el draft v2 oculto. Sin `BroadcastChannel`, `storage` listener ni migración v1→v2. |
| **C-09** | Responsive y CTA: 1448/1366/1280/390/320; total y confirmación visibles al cargar; sin recortes | **FAIL** | REP-03: importe de línea invisible a 1448/1366/1280/768. REP-04: CTA fuera a 1366/1280/768. A 390 solo hay paybar “Revisar cobro”, no confirmación. |
| **C-10** | A11y: 200 % sin pérdida, teclado, foco, axe 0, targets, HC | **FAIL** | REP-05a/b: 200 % pierde el CTA y produce 17 px de overflow en `/ventas` 320. P1-05: foco de ruta en `BODY` y paginación con foco fuera de pantalla. Sí pasan axe 0 normal/HC, skip link, labels y targets ≥44. |
| **C-11** | Motor financiero intacto | **PASS** | Hashes y diff vacío para `lib/orders.ts`, `cash.ts`, `goals.ts`, `tasks.ts`, `db.ts`, `payment-*.ts`, `pey-events.ts`, `checkout.ts`, `api/**`, `pay/**`. `caja-app.tsx` solo lazy (no financiero). |
| **C-12** | Evidencia y gates: `verify:static`, `verify:evidence`, full aplicable, árbol limpio, build = HEAD | **PARTIAL** | `latest-static.json` es de `4130e71`, `ok:true`, 5/5, limpio. `latest.json` full es de `9206ea1`, no de B. `verify:evidence -- --static` hoy falla **solo** por el untracked `quality-reports/oleada-b-review/`. 44/44 smoke no está atado a HEAD ni cubre P0/P1. |
| **C-13** | Honestidad de demo/handoff: no presentar demo como real, no publicar sin pey/QR/lector/iOS | **FAIL** | Handoff público **NO-GO**; demo solo con guion restringido; P1-09 presenta $450 demo como “Cobrado confirmado” con subtítulo “demo no cuenta”; P2-04 sobreafirma “cobrada en efectivo” en mixto demo. |

**Resumen:** 2 PASS (C-02, C-11), 4 PARTIAL (C-01, C-03, C-07, C-12), 7 FAIL (C-04, C-05, C-06, C-08, C-09, C-10, C-13). No hay una condición “no evaluada”: las que no se pudieron probar en real se marcan PARTIAL y se listan en §7.

---

## 4. Hallazgos P0 / P1 / P2

### 4.1 P0 — bloquean cierre y demo sin guion

| ID | Pantalla | Severidad | Esperado | Observado | Evidencia | Archivo | Responsable | Estado |
|---|---|---|---|---|---|---|---|---|
| **P0-01** | `/caja` resultado fiado | **P0** | Fiado puro: “No recibiste dinero; todo quedó a fiado”. Nunca afirmar efectivo. | Banner fijo: “el efectivo sí se registró en la caja” con `paidCents=0`, 0 pagos. | `final-fiado-puro.png`, `repo-fiado-banner-p0.json`, `onboarding-caja-resultado-fiado.png` | `components/caja/sale-result.tsx:133-137` | Caja UI — `mc-ventas-pagos` / `mc-onboarding-ayuda` | **Abierto** |
| **P0-02** | `/caja` cobro mixto + `/ventas` fila | **P0** | Mostrar “Ya recibiste $60.00; falta digital $40.00”. | “El dinero aún no se considera recibido”; no muestra $60; chip “REGISTRADO”; misma pérdida en la fila. | `final-mixto-panel.png`, `repo-mixto-cash-hidden-p0.json`, `onboarding-caja-mixto-efectivo-digital-panel.png` | `components/caja/payment-panel.tsx:152-156`; `app/ventas/page.tsx:128-184` | Caja/Ventas UI — `mc-ventas-pagos` / `mc-onboarding-ayuda` | **Abierto** |

### 4.2 P1 — bloquean cierre, no siempre dinero real

| ID | Pantalla | Severidad | Esperado | Observado | Evidencia | Archivo | Responsable | Estado |
|---|---|---|---|---|---|---|---|---|
| **P1-01** | `/caja`, `/`, nav | P1 | Un draft/lock o migración v1→v2; si hay dos Cajas, avisar y no permitir doble confirmación. | Dos drafts, dos requestId, dos pending; nav sale a legacy y su “Caja” no vuelve a `/caja`; riesgo de duplicar. | REP-06a/b/c; `repo-two-cajas.json`; `repo-playwright-state.json` | `caja-screen.tsx:32-34`; `caja-app.tsx:110-116`; `nav.ts:25-53` | Shell/Caja | **Abierto** |
| **P1-02** | `/caja` conceptos | P1 | Importe por línea visible en desktop/tablet. | `span` del importe 1×1 px (clip) a 1448/1366/1280/768; visible solo ≤760. | REP-03; `importe-linea-invisible.txt`; `design-caja-importe-vacio-crop.png` | `components/caja/caja.css:177-184, 950-957` | Diseño/Caja | **Abierto** |
| **P1-03** | `/caja` cobro | P1 | CTA visible en el primer viewport a 1366/1280/768 con 0 y 3 conceptos. | CTA `y=817.9` (1366), `852.6` (1280), `1447.4` (768); a 390 el CTA real está en `y=1837` y solo hay paybar. | REP-04; `shell-cta-scrolltop.json`; `shell-761-cliff.json` | `caja.css:841, 859`; `sale-summary.tsx` | Shell/Diseño | **Abierto** |
| **P1-04** | `/caja`, `/ventas` 200 % | P1 | Texto 200 % sin solapes, sin recortes y sin scroll horizontal. | CTA `y=1359.7` a 1366; cabecera CANTIDAD/PRECIO solapada; `/ventas` 320 da `scrollWidth=337`; paybar tapa total a 390/320. | REP-05a/b; `a11y-text-resize.json`; `text200-geometry.txt`; `shell-caja-1366-text200-three.png` | `caja.css` grid fijo; `ventas.css:249-260`; `shell` 760/980 | A11y/Shell | **Abierto** |
| **P1-05** | Todas las rutas, `/ventas` pager | P1 | Al navegar, foco a `main`/`h1`; al paginar, foco al encabezado y scroll al inicio. | `document.activeElement=BODY` tras nav; paginar deja foco en “Siguiente” en `y=4674`, fuera de pantalla; sin `aria-live`. | `shell-probes2.json`; `a11y-pagination.json`; `keyboard-focus.json` | `components/shell/app-shell.tsx:36-51`; `ventas/page.tsx` pager | Shell/A11y | **Abierto** |
| **P1-06** | `/caja` cobro pendiente | P1 | Poder iniciar otra venta o descartar el cobro; listar todos los pendientes. | Un pendiente reabre “Cobrar venta” sin aviso; no hay “Nueva venta/Descartar”; solo se reanuda el último id. | `repo-pending-blocks-new-sale.json`; `repo-pending-last-only.json`; REP-02 | `caja-screen.tsx:114-144, 554-556`; `payment-panel.tsx:186-250` | Caja UI | **Abierto** |
| **P1-07** | `/caja` mixto | P1 | Cambio solo si `appliedCash>0`; bloquear `cash+credit>total`; no avisar “total cambió” en split válido. | Efectivo $100 + fiado $100 → “Cambio $100, aplicado $0”; split $40+$30+$30 → “El total cambió”. | REP-09/10; `repo-mixto-phantom-change.json`; `repo-mixto-hint.json` | `caja-screen.tsx:80-90`; `sale-summary.tsx:59-63, 143-176` | Caja UI | **Abierto** |
| **P1-08** | `/ventas` fila mixta | P1 | Mostrar siempre `paidCents>0` como “Cobrado $60.00” y el faltante por separado. | Al pasar a `payment_pending`, la fila solo dice “Pendiente de cobro / Falta $40.00”; desaparece “Cobrado $60.00”. | REP-08; `final-verificador-history.json`; `modulos-runtime-real.txt` | `app/ventas/page.tsx:164-171` | Ventas UI | **Abierto** |
| **P1-09** | `/ventas` resumen | P1 | “Cobrado confirmado” no debe incluir abonos demo; o el subtítulo debe decir que sí los incluye. | “$450.00” con subtítulo “Solo efectivo real… demo no cuenta”; 9 abonos demo suman 45000 y `cashCents=45000`. | REP-07; `final-abono-demo-cobrado.png`; `pagos-ventas-stable.json` | `lib/db.ts:1832-1845`; `ventas/page.tsx:96-109` | Ventas/DB (heredado) | **Abierto** |
| **P1-10** | `/api/demo/pay`, `/caja` demo | P1 | Rechazar pedidos `demo=0`; idempotencia por pedido; nunca `paid_cents>total`. | Acepta `demo=0` y lo deja `demo_paid`; con dos procesos y lock externo inserta dos pagos de 10000 sobre total 10000 (`paid=20000`). | `pagos-demo-pay-adversarial.json`; `pagos-demo-lock-race.json`; `pagos-demo-multiproceso.json` | `app/api/demo/pay/route.ts:49-85`; `lib/orders.ts:554-555` | Pagos (heredado) | **Abierto heredado** |
| **P1-11** | Nav/shell `/caja`, `/ventas` | P1 | Marcar legacy o no presentarlo como migrado; ayuda local de la Caja nueva. | Fiados/Corte/Metas/Pendientes abren `/?tab=` legacy con otro shell; Ayuda/Ajustes también; el usuario cree que sigue en el producto nuevo. | `shell-768-inicio.png`; `onboarding-ayuda-desde-caja.png`; `03_shell.md` P1-5 | `nav.ts:25-62`; `app/*/route.ts` | Shell/Producto | **Abierto** |
| **P1-12** | `/caja` error 502 | P1 | Tratar 502 post-commit como resultado desconocido; conservar llave y no permitir editar/duplicar sin revisar. | La UI dice “El banco tardó… Reintenta” con CTA “Confirmar venta”; editar cantidad/efectivo genera nuevo `requestId` y dos órdenes pagadas (4000 y 8000). | `pagos-502-edit.json`; `pagos-502-antes-de-editar.png` | `caja-screen.tsx:630-642`; `sale-summary.tsx:64-79` | Caja UI | **Abierto** |
| **P1-13** | `/inicio` 768×1024 | P1 | CTA y H1 legibles; sin clip ni superposición. | CTA "Ir a ventas" 85 px clipeado; H1 partido; papel picado encima. | `design-capturas/design-inicio-768-clip-crop.png`; `design-capturas/design-inicio-768-h1-picado-crop.png`; `02_diseno.md` P1-04 | `inicio.css:649, 698-702, 792` | Diseño/Inicio (A) | **Abierto heredado** |

> **Notas de calibración:** P1-01 se queda en P1 (no P0) porque no reproduje una duplicación automática: exige confirmar en ambas Cajas. P1-12 se eleva de P2 (`04_ventas_pagos`) a P1 porque el resultado es **dos ventas pagadas**; el disparador es raro, pero el impacto es dinero. P1-13 es deuda heredada de Inicio (Oleada A), no una regresión de `/caja`/`/ventas`.

### 4.3 P2 — importantes, no bloquean por sí solos

| ID | Pantalla | Severidad | Esperado | Observado | Evidencia | Archivo | Responsable | Estado |
|---|---|---|---|---|---|---|---|---|
| **P2-01** | `/ventas` estados | P2 | Usar `payment-labels` ("Por cobrar") para `confirmed` digital. | `confirmed` sin link se rotula "Registrado"; el badge no señala cobranza. | `04_ventas_pagos.md`/`06_modulos.md`; `payment-labels.ts:118-123` | `ventas/page.tsx:251-274`; `payment-panel.tsx:264-281` | Ventas UI | Abierto |
| **P2-02** | `/ventas` operación | P2 | Filtros/búsqueda/detalle y sin N+1; 20/página según contrato. | Lista plana, 25/página, `getCredit` por fila (N+1), sin filtros ni detalle de pagos. | `06_modulos.md` §4; `ventas/page.tsx:41-50,127` | `ventas/page.tsx`; `db.ts:1737-1763` | Ventas/C | Abierto |
| **P2-03** | Resultado `/caja` | P2 | “Volver a Caja” resetea o se elimina. | Es un `<Link href="/caja">` a la misma ruta; no resetea `view`; sigue en “Venta registrada”. | `repo-result-volver.json`; REP-01 | `sale-result.tsx:151-153` | Caja UI | Abierto |
| **P2-04** | Resultado mixto demo | P2 | Si hay fiado abierto, no decir “cobrada en efectivo”. | “Venta cobrada en efectivo (demo)” con $60 efectivo + $30 fiado. | `repo-mixto-fiado-demo-title.json`; `pagos-ui-flow.json` J3 | `sale-result.tsx:26-34` | Caja UI | Abierto |
| **P2-05** | `/caja` “Actualizar estado” | P2 | Ignorar respuestas con `updatedAt` menor. | Una respuesta vieja devuelve `confirmed`, borra link/QR y muestra “REGISTRADO” aunque siga pendiente. | `pagos-polling-viejo.json`; `pagos-polling-viejo.png` | `payment-panel.tsx:83-96` | Caja UI | Abierto |
| **P2-06** | `/caja` “Nueva venta” | P2 | Limpiar `PENDING_KEY` al terminar o al detectar orden terminal. | Tras pagar y pulsar Nueva venta, `caja-pending:v2` sigue; recargar resucita el resultado viejo. | `pagos-ui-flow.json` K1–K3; `pagos-caja-puntero-resucitado.png` | `caja-screen.tsx:164-192` | Caja UI | Abierto |
| **P2-07** | `/caja` draft corrupto | P2 | Validar versión y campos; no tumbar la pantalla. | `{"lines":[{"id":"bad"}]}` produce `reading 'trim'` y “This page couldn't load”; `method:"bitcoin"` se acepta. | `repo-bad-draft.json`; `repo-bad-draft-lines_not_objects.png` | `caja-screen.tsx:96-105`; `types.ts:50-55` | Caja UI | Abierto |
| **P2-08** | Targets | P2 | Decidir 44 vs 48 HIG y documentarlo. | Pager, “Descartar venta” y `summary` miden 44; HIG cita 48 en un punto y 44 en otro. | `08_accesibilidad.md`; `shell-probes3.json` | `caja.css:220-228, 478-489`; `ventas.css:216-224` | A11y/Diseño | Abierto/waiver |
| **P2-09** | `/caja` forced-colors | P2 | El método seleccionado debe distinguirse sin color. | Los 4 métodos quedan idénticos; solo `aria-pressed` conserva el estado. | `a11y-forced-colors.json`; `a11y-caja-forced-colors.png` | `caja.css` métodos | A11y | Abierto |
| **P2-10** | `/caja` alta | P2 | Error de cantidad marca el campo cantidad y enfoca ese input. | Marca `aria-invalid` en “Producto” y deja foco en “Agregar”. | `a11y-forms.json`; `a11y-caja-error-zero-quantity.png` | `sale-line-items.tsx:28-41` | A11y/Caja | Abierto |
| **P2-11** | `/caja` cobro pendiente | P2 | Anunciar “PENDIENTE” y el cambio de estado. | El `h2` enfocado dice “Pedido AE9B”; el badge no tiene `role=status`/`aria-live`. | `a11y-payment.json` | `payment-panel.tsx` status | A11y | Abierto |
| **P2-12** | `/caja` paybar 360 | P2 | Monto máximo completo. | 10 px de solape: el último dígito de `$9,989,999,990.01` queda tapado por “Revisar cobro”. | `a11y-max-amounts.json`; `a11y-caja-max-360.png` | `caja.css` paybar | A11y/Diseño | Abierto |
| **P2-13** | `/pay/**` inexistente | P2 | 404 real; no enlazar al panel legacy. | `/pay/ord_nope` y `/success` responden 200 con UI de “no encontrado”; “Volver” va a `/`. | `repo-http-routes.json`; `01_repo.md` H-02/H-03 | `app/pay/[id]/page.tsx`; `not-found.tsx` | Pay (heredado) | Abierto heredado |
| **P2-14** | 404 | P2 | 404 con shell/nav en español. | 404 por defecto de Next en inglés, sin shell. | `shell-desktop-404.png`; `03_shell.md` P2-3 | falta `app/not-found.tsx` | Shell | Abierto |
| **P2-15** | Legacy tabs | P2 | URL refleja el tab; recargar conserva. | `/?tab=fiado` → click Corte deja URL `?tab=fiado`; recargar vuelve a Fiado. | `shell-nav-clicks.json`; `shell-audit.json` | `caja-app.tsx` tabs | Legacy (A/B) | Abierto |
| **P2-16** | Ayuda en `/caja`, `/ventas` | P2 | `?ayuda=1` abre ayuda local o 307 al sheet legacy. | Se ignora; el botón “Ayuda” sale a `/?ayuda=1` legacy y cerrar deja al usuario en la Caja legacy. | `shell-help-close.json`; `03_shell.md` P2-1 | `nav.ts:49-62`; páginas nuevas | Shell/Producto | Abierto |
| **P2-17** | Arranque demo | P2 | Si falta `PEY_API_KEY`, no sembrar historial sin aviso. | `DEMO_MODE` implícito, 14 pedidos demo y un crédito huérfano de $50. | `modulos-mocks.txt`; `modulos-demo-db.txt` | `config.ts:10-14`; `db.ts:1039-1246` | Config/DB (heredado) | Abierto heredado |
| **P2-18** | Contrato producto/SKU | P2 | Rechazar campos v2 o persistirlos; hash debe incluirlos. | `productId`/`sku` se descartan en silencio; dos productos distintos con mismo `requestId` devuelven la misma orden. | `modulos-provenance.txt`; `06_modulos.md` MN-B-04 | `api/orders/route.ts:30-48`; `request-hash.ts:12-30` | Productos/C-D | Abierto (deuda C/D) |

### 4.4 P3 — acabado y proceso (no bloquean)

- `ClosingChecklist` lazy sin fallback (`caja-app.tsx:20-29`): posible flash vacío en Corte.
- Fecha calculada en render sin `timeZone` fija (`caja-screen.tsx:429`, `format.ts:83-88`): riesgo de hydration/midnight.
- “Ir a ventas” de Inicio con copy de registrar (`inicio/page.tsx:222-226`).
- `/?tab=ventas` cae a Caja en silencio (`app/page.tsx:9-24`).
- “1 conceptos en curso” con plural fijo (`caja-screen.tsx:591`).
- Icono de resultado con el mismo verde para efectivo, fiado y demo.
- Falta `aria-busy` en “Registrando…” y acciones de pago.
- MXN no se verbaliza como texto; `$1,234.50` depende del lector.
- `?page=999` conserva 999 en la URL aunque muestra la última página.
- `ENTREGA`/`STATE`/`VEREDICTO` previos con SHA y árbol desactualizados; el “caja-app.tsx sin cambios” es falso.

---

## 5. Contradicciones entre informes, resueltas con reproducción

| # | Informes en conflicto | Contradicción | Resolución |
|---|---|---|---|
| 1 | `04_ventas_pagos` (P0=0) vs `01_repo`, `06_modulos`, `07_onboarding` (P0 fiado/mixto) | ¿Hay P0 o no? | **Sí hay 2 P0 de verdad visible.** `04` auditó contratos de pago/DB y no la copia del resultado; su “P0=0” significa “no hay cobro incorrecto ni pérdida”, no “la UI dice la verdad”. REP-01/02 lo confirman. |
| 2 | `05_fiado_corte` (P0=0, P1=0) vs `01/06/07` | ¿El fiado está bien? | **El ledger está bien; la presentación no.** `05` probó DB, abonos y corte: 0 payments, `paid=0`, saldo vivo correcto. El P0 es el banner del resultado, fuera de su alcance. Ambas cosas son ciertas. |
| 3 | `02_diseno` (fiado P1) vs `01/06/07` (P0) | Severidad del banner | **P0.** La regla de oro del repo es “fiado es deuda, no dinero recibido”; la pantalla afirma lo contrario en la confirmación. Una severidad de diseño P1 subestima el riesgo de mostrador. |
| 4 | `03_shell` (dos Cajas P0) vs `01/06` (P1) | Severidad de dos Cajas | **P1.** Reproduje el draft oculto y la trampa de nav, pero **no** produje una duplicación automática: hace falta confirmar en ambas pantallas. El riesgo es alto y debe corregirse, pero P0 se reserva para dinero falso/bloqueo. |
| 5 | `04` (abono demo P1) vs `05` (P3-02) | Severidad del agregado demo | **P1 en demo.** La pantalla muestra $450.00 y a la vez “demo no cuenta”; es una afirmación falsa en la superficie que se usa para demostrar. En modo real no ocurre. |
| 6 | `01` (B-07 “solo código, no reproducible en demo”) vs `06` (P1 runtime real) | ¿Se reproduce la fila que oculta efectivo? | **Sí, en modo real aislado.** Servidor 3107, copia SQLite, `DEMO_MODE=false`: la fila mostró “Pendiente de cobro / Falta $40.00” y **no** “Cobrado $60.00”. REP-08. |
| 7 | `ENTREGA` (“caja-app.tsx sin cambios”) vs `01_repo` (lazy) | ¿Se tocó el archivo? | **Sí, solo el lazy de `ClosingChecklist`.** `git diff` lo confirma. No es cambio financiero, pero la frase de la entrega es falsa. |
| 8 | `STATE`/`VEREDICTO` previos (7c48902 / 26c7741 / árbol sucio) vs HEAD | Estado del build | **HEAD y build son 4130e71**; el árbol de producto está limpio; el único untracked es esta revisión. Los documentos están desactualizados. |
| 9 | `44/44 smoke` vs P0/P1 | ¿El smoke contradice los hallazgos? | **No los contradice: no los mide.** El smoke valida camino feliz, totales y `scrollWidth`; no valida el banner de fiado, el panel mixto, el importe por línea, el CTA a 1366, los solapes a 200 %, las dos Cajas, el historial `payment_pending` ni el agregado demo. |
| 10 | `08_accesibilidad` (P0=0) vs `03_shell` (P0 dos Cajas) | ¿Hay P0 de a11y? | **No hay P0 de a11y.** `08` excluye expresamente el riesgo de producto; su P0=0 es correcto en su carril. El P0 de dos Cajas es de producto/flujo, no de accesibilidad. |

---

## 6. Por qué el 44/44 no cambia el veredicto

El smoke de B es útil como **prueba de camino feliz**, pero no es un gate de cierre:

- No tiene SHA, `buildSha` ni timestamp: `oleada-b/oleada-b-smoke.json` es una lista de 44 objetos; no está atada a `4130e71`.
- Valida totales, cambio, una venta, draft, doble clic, demo y `scrollWidth`; no valida verdad de copy ni geometría de rectángulos.
- Pasa “200 % sin overflow” a 320, pero el fallo real es **solape/recorte** con contenido; `scrollWidth === clientWidth` no detecta que el CTA esté en `y=1359` o que la paybar tape el total.
- No abre `/` para probar los dos borradores, no pasa una orden mixta a `payment_pending`, no consulta el agregado demo de `/ventas` y no prueba fiado puro contra el banner.

**Conclusión:** `44/44` es compatible con los 2 P0 y los 13 P1. No se puede usar como aprobación.

---

## 7. Qué NO se probó (límites explícitos)

- **Lector de pantalla real** (NVDA, JAWS, VoiceOver, TalkBack). Solo DOM, foco, `aria-*` y axe; no sé cómo verbaliza `$1,234.50` ni el `h2` enfocado.
- **iOS/Safari real**, safe areas, `env(safe-area-inset-top)` y **teclado virtual real**. Solo Chromium headless; la paybar es `fixed` y no se validó con teclado iOS.
- **HCM real de Windows**. Solo emulación `forced-colors: active`; no lo tomo como pase ni como fallo definitivo.
- **QR real**: se genera la imagen/alt, pero no se escaneó con una app bancaria.
- **Pey real, webhook real, checkout real**: no hay `PEY_API_KEY`; el 40/40 y 19/19 son de `9206ea1`/contratos sintéticos, no de una pasarela real.
- **Modo real completo**: abrí un servidor aislado `DEMO_MODE=false` para leer `/ventas` (REP-08), pero no cobré con pey ni ejecuté el webhook real.
- **Multiproceso natural**: el doble pago demo se reprodujo con dos procesos y un lock externo que fuerza la carrera; no es una carrera espontánea.
- **`>50` y fila 51 exacta**: vi 128 órdenes y página 2; no aislé la fila 51 ni probé 51+ con un dataset limpio.
- **Abono nuevo por UI**: el P1-09 se reprodujo con los 9 abonos demo ya existentes y la asimetría de `db.ts`; no creé un abono nuevo para no mutar la base.
- **Full gate de HEAD**: no ejecuté `verify:full`; `latest.json` es de `9206ea1`. Solo `latest-static` 5/5 de `4130e71` y el partial 6/6 de `17:16` sobre árbol sucio.
- **Túnel/handoff público**: no hay URL pública válida; `APP_URL` local.
- **Personas reales / onboarding de 5 personas**: no ejecutado; los criterios AC-01..AC-15 de `07_onboarding.md` son de diseño, no de estudio con usuarios.
- **Perf/Lighthouse/motion/contrast** de las rutas nuevas más allá de lo ya reportado.

---

## 8. Plan correctivo priorizado (no implementado)

### Fase 0 — antes de cualquier demo o cierre (P0)

1. **P0-01:** condicionar el banner de `SaleResult` a `cashPaidCents > 0`; si es fiado puro, “No recibiste dinero; todo quedó a fiado”. Añadir regresión de copy para fiado puro y mixto.
2. **P0-02:** en `PaymentPanel` mostrar `paidCents` como “Ya recibiste $X” y `dueCents` como “Falta digital $Y”; eliminar la frase global “El dinero aún no se considera recibido” cuando `paidCents>0`. Replicar la verdad en la fila de `/ventas`.
3. **Regresiones obligatorias:** incluir en el gate los dos casos P0; no volver a aprobar con un smoke que solo mide totales y `scrollWidth`.

### Fase 1 — verdad de dinero y flujo (P1)

4. Extraer una sola verdad de venta/pago (`sale-truth.ts`/`payment-truth.ts`) usada por `/caja`, `/ventas` y legacy; o retirar la Caja legacy. Mientras existan dos, cada fix se duplica.
5. Corregir Mixto: aplicar efectivo primero o bloquear `cash+credit>total`; `change` solo si `appliedCash>0`; `creditChanged` contra `total - efectivo`.
6. Corregir `/ventas`: mostrar siempre `paid` y `due` por separado; no ocultar `paidCents` en `payment_pending`; usar `payment-labels` para `confirmed`; mostrar “Fiado parcial/Abonado” cuando `credit.status=partial`.
7. Corregir el agregado demo: hacer simétrico el filtro de `credit_payments` en `db.ts` (o etiquetar “incluye demo”); añadir regresión de “Cobrado confirmado”.
8. Resolver la cola de pendientes: listar todos, “Seguir cobrando / Empezar otra venta / Dejar pendiente”, limpiar `PENDING_KEY` al terminar y al detectar orden terminal.
9. Endurecer `/api/demo/pay`: exigir `order.demo`, idempotencia por pedido y tope `amount <= due`; prueba de dos procesos.
10. Layout: mostrar el importe por línea (ocultar solo la etiqueta), CTA sticky/footer en 1366/1280/768, paybar que confirme o “Revisar cobro” claro a 390/320; validar 200 % con rectángulos disjuntos, no solo `scrollWidth`.
11. Foco: `RouteFocus` a `main`/`h1` en cada ruta; paginación al encabezado de la lista; `aria-live` para estado/página.
12. Nav honesta: ocultar o marcar “Caja clásica” Fiados/Corte/Metas/Pendientes/Ayuda/Ajustes; ayuda local de la Caja nueva.
13. Draft v2: validar versión y campos, migrar v1→v2, lock cross-tab (`BroadcastChannel`/`storage`) y no tumbar `/caja` con localStorage corrupto.

### Fase 2 — calidad y consistencia (P2)

14. `/ventas`: filtros/búsqueda/detalle, read model sin N+1, 20/página o decisión documentada, URL canónica, `aria-current`.
15. A11y: HCM con marca no cromática, error de cantidad en el campo correcto, `aria-live` de estado, monto máximo sin recorte, decisión 44/48.
16. Inicio 768, 404 propio, `/pay` 404, tabs legacy con URL, `ayuda=1`.
17. Evidencia: `verify:full` sobre HEAD limpio después de los fixes, regenerar `latest.json`; handoff solo con pey/QR/lector/iOS reales.

### Fase 3 — deuda C/D

18. Contrato v2 de `productId`/`sku`/`priceSource`, hash y Zod explícito; alinear roadmap C/D y el dueño de Productos.

---

## 9. GO / NO-GO

| Nivel | Decisión | Condición exacta |
|---|---|---|
| **Local (cierre de B)** | **NO-GO** | P0-01/P0-02 abiertos; P1-08/P1-09/P1-12 de dinero/flujo abiertos; full gate de HEAD ausente. |
| **Demo controlada** | **GO CONDICIONADO solo con guion restringido** | Efectivo exacto/con cambio + digital demo, operador, sin fiado puro ni mixto efectivo+digital, sin link público. **NO-GO** para el recorrido completo. |
| **Handoff público** | **NO-GO** | Sin pey/webhook/QR reales, sin lector/iOS, `latest.json` de `9206ea1`, `APP_URL` local, 2 P0 abiertos. |

---

## 10. Veredicto final

**Oleada B construyó pantallas reales y usa el motor existente sin corromperlo; eso es una base valiosa. Pero la verdad visible del dinero falla en los dos casos que más importan (fiado puro y mixto efectivo+digital), y el flujo arrastra dos Cajas, un pendiente que secuestra la Caja, un historial que oculta efectivo y un 200 % que rompe la acción principal. No es un problema de “44/44 smoke”: es un problema de qué mide el smoke.**

- **P0 de producto:** **2** (presentación/verdad visible; la DB está correcta).
- **P1 de producto:** **13** (flujo, presentación, datos demo, a11y; uno heredado de pagos).
- **P0 de persistencia/webhook/`paid`:** **ninguno**.
- **Motor financiero:** **intacto**, con la excepción no financiera del lazy de `caja-app.tsx`.
- **Cierre local:** **NO-GO**.
- **Demo controlada:** **solo con guion restringido y acompañamiento**.
- **Handoff público:** **NO-GO**.

No apruebo Oleada B con el estado actual. La apruebo como **base funcional para Oleada C solo después de corregir los dos P0 y los P1 de verdad de dinero/flujo**, con regresiones que impidan que el próximo smoke vuelva a dar 44/44 mientras la pantalla miente.

---

## Anexo A — Evidencia propia

`quality-reports/oleada-b-review/EVIDENCIAS/`:

- `final-verificador.json` — 18 comprobaciones REP-01..REP-07 (11 PASS / 7 FAIL; los FAIL son los defectos reproducidos).
- `final-verificador-extra.json` — REP-09/REP-10 (cambio fantasma y aviso falso).
- `final-verificador-history.json` — REP-08 (real mode aislado 3107).
- `final-fiado-puro.png`, `final-mixto-panel.png`, `final-line-*.png`, `final-cta-*.png`, `final-text200-*.png`, `final-two-*.png`, `final-abono-demo-cobrado.png`, `final-ventas-payment-pending.png`, `final-mixto-*.png`.

## Anexo B — Comandos de reproducción

```powershell
# Servidor de referencia (ya estaba arriba)
Invoke-WebRequest http://localhost:3100/api/health

# Reproducciones propias (desde web/ o con la ruta absoluta de Python)
python "C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\final_verify.py"
python "C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\final_extra.py"
python "C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\final_history_verify.py"

# Identidad del build y del árbol
cd "C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero"
git rev-parse HEAD
git status --porcelain
Get-Content web\.next\BUILD_SHA
```

Los scripts `final_*` viven en `%TEMP%\opencode` y no se commitean; su salida y capturas sí están en `EVIDENCIAS/final-*`.
