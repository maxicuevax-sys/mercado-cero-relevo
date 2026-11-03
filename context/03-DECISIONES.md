# 03 · Decisiones

> **Criterio:** una decisión es “tomada” si está en el código o en un contrato vigente; “propuesta” si solo aparece en un goal/plan; “abandonada/superseded” si el código o un commit posterior la reemplazó. No se infiere intención where no hay fuente.
> **Código de referencia:** `b7154ca`.

---

## 1 · Decisiones de producto y dinero

### D1 · La tesis es certeza, no otro POS

**Estado: TOMADA.**

Mercado Cero se define como la capa de certeza entre lo que la comerciante oye y lo que el banco confirma; no compite como otro punto de venta. La frase guía es “La caja que habla”.

- `README.md:14-30` (“No es otro punto de venta… es la capa de certeza”).
- `GOAL.md:24-30` (“El competidor real no es otro POS”).
- `PITCH.md:35-58`.

**Consecuencia:** la UI debe distinguir siempre pendiente / verificado / demo / fiado / declarado. Esa distinción se implementa en `payment-labels.ts` y `paymentTruth`.

---

### D2 · Link/QR multi-método en vez de CoDi-only

**Estado: TOMADA; reemplaza una decisión anterior.**

El MVP usa links de pago de pey (CoDi + tarjeta + wallets) y deja el QR CoDi puro como segundo modo. La decisión anterior CoDi-only se descartó porque solo ~4 % de adultos había usado CoDi en 2024.

- Decisión y motivo: `README.md:34-48`.
- Implementación: `web/src/app/api/orders/[id]/pay/route.ts:75-119`; `web/src/lib/pey.ts:78-156`.
- UI: “Link de pago — CoDi + tarjeta + wallets” y “QR CoDi directo — Solo transferencia CoDi” (`caja-app.tsx:4102-4146`).

**Matiz:** el código **ofrece** las tres opciones en la UI, pero no puede garantizar que la API key real habilite tarjeta/wallets. `README.md:48` y `GOAL.md:37` exigen verificar el checkout real antes de prometerlo. No hay evidencia de esa verificación.

---

### D3 · Solo el webhook firmado transiciona un pago digital pendiente a `paid`

**Estado: TOMADA; invariante no negociable.**

- Firma Standard Webhooks sobre body crudo, tolerancia 300 s, comparación en tiempo constante (`web/src/lib/pey.ts`; `GOAL.md:77`).
- El endpoint exige firma siempre, incluso en demo (`web/src/app/api/webhooks/pey/route.ts:136-157`).
- El demo usa `/api/demo/pay`, nunca el webhook (`web/src/app/api/demo/pay/route.ts:22-87`).
- `GOAL.md:42-54`; `AGENTS.md` “Regla de oro”.

**Consecuencia:** `paid` por webhook solo aplica a pagos digitales; el efectivo se registra `paid` al crear la venta (ver D4). No simplificar.

---

### D4 · El efectivo se registra `paid` al crear la venta

**Estado: TOMADA (decisión de ledger).**

`createOrder` inserta un `payments` con `provider='cash'`, `method='cash'`, `status='paid'` y, si no queda saldo digital, deja la orden `paid`; si hay fiado, `confirmed`.

- `web/src/lib/orders.ts:284-300`, `:328-335`.
- `harness/STATE.md:86-91` lo explica como deliberado.
- `demo/STATUS.md:84`.

**Consecuencia:** la invariante correcta es “ningún pago **digital pendiente** pasa a `paid` sin webhook”; no “ningún `paid` fuera del webhook”.

---

### D5 · `demo_paid` es un estado separado y no entregable

**Estado: TOMADA.**

- `PaymentProvider = "pey" | "demo"`; `coveredStatus("demo") = "demo_paid"` (`payment-rules.ts:3-26`).
- `/api/demo/pay` exige `isDemoMode()` y solo acepta `codi|card|wallet`; el efectivo no se simula (`demo/pay/route.ts:15-27`).
- `fulfillOrder` rechaza `demo_paid` con 409 `demo_not_deliverable` (`orders.ts:967-974`).
- La UI no ofrece “Listo para entregar” para demo (`caja-app.tsx:3846-3852`, `:4008-4030`).
- Copy “Pago demo (simulado): no se entrega” (`payment-labels.ts:62-65`).

**Consecuencia:** el sello DEMO y el copy son parte del contrato, no decoración.

**Agujero confirmado (P1-1):** la decisión es correcta, pero el código no la cumple para un webhook **firmado** en `DEMO_MODE=true`: `recordPayment` crea `provider='pey'` con `demo=1` y estado `paid` (`orders.ts:591`, `:677-683`); `fulfillOrder` solo rechaza `demo_paid` (`:968-974`). El audit lo reprodujo y `master` bloqueó el merge. Ver `06-RIESGOS-Y-DUDAS.md` P0/P1.

---

### D6 · Fiado no es venta; el abono digital es “declarado”, no verificado

**Estado: TOMADA.**

- `createOrder` crea `credits` y deja la orden `confirmed` si hay fiado (`orders.ts:303-335`).
- La voz solo abre la hoja; el POST ocurre al confirmar (`caja-app.tsx:1562-1595`).
- `recordCreditPayment` usa `provider = method === "cash" ? "cash" : "declared"` (`orders.ts:902-903`).
- `getDailySummary` suma abonos digitales como `declaredDigitalCents`, no como verificados (`db.ts:1760-1773`).
- La UI dice “Fiado no es dinero recibido ni una venta nueva” (`caja-app.tsx:3061`).

**Consecuencia:** un abono de fiado no crea una venta nueva ni un pago pey; el saldo vivo manda sobre el original (`caja-app.tsx:116`, `:3966-3973`).

---

### D7 · Corte versionado, no destructivo, con snapshot y control de concurrencia

**Estado: TOMADA.**

- Fórmula y preview: `cash.ts:257-333`.
- `closeCash`: `BEGIN IMMEDIATE`, `requestId`, `expectedVersion`, `previewFingerprint`, `reason` obligatorio al corregir, snapshot de efectivo/fiado/pendiente, auditoría (`cash.ts:335-492`).
- Migración transaccional y recuperación de `cash_closes_legacy` (`db.ts:640-781`, `:809-1031`).
- UI no pisa un conteo sucio (`caja-app.tsx:4836-4904`).

**Decisión de diseño:** un corte guardado es una foto inmutable; una corrección crea otra versión con motivo. No se sobrescribe el pasado.

**Límite:** pensado para un solo proceso `next start`; multi-proceso requeriría mover la lectura del esquema dentro del lock (`demo/STATUS.md:75`).

---

### D8 · “Pendientes” es un quinto destino, no una sección escondida

**Estado: TOMADA.**

- `Tab = "caja" | "fiado" | "corte" | "meta" | "pendientes"` (`caja-app.tsx:75`).
- Quinto tab en sidebar/tab bar (`caja-app.tsx:7124-7136`).
- Backend `tasks` con crear/completar/reabrir/posponer/eliminar; soft delete (`tasks.ts:236-343`).
- UI `PendingTasksPanel` (`pending-tasks.tsx:196-1155`).
- `GOAL-ACOMPANAMIENTO.md:57-65`, `:295-305`.

**Consecuencia:** las tareas no interrumpen la venta; la tarjeta “Antes de cerrar” las consume en Corte.

---

### D9 · “Antes de cerrar” + preferencias + consultas locales antes del parser

**Estado: TOMADA (carriles cognitivos integrados en la final).**

- `ClosingChecklist` en Corte (`caja-app.tsx:2716-2729`; `closing-checklist.tsx:215-374`).
- Preferencias “¿Cómo quieres que te ayude?” con `suggestions`, `reminders`, `explanations`, persistidas en localStorage (`companion-preferences.tsx:11-108`).
- Apagar sugerencias no oculta avisos críticos de dinero (`companion-preferences.tsx:201-204`; `closing-checklist.tsx:275-285`).
- Consultas locales de deuda/preguntas antes de `/api/voice/parse` (`caja-app.tsx:1528-1543`).

**Consecuencia:** la app puede operar sin IA para la venta manual y para consultas básicas; el “Antes de cerrar” no es un chatbot ni un diagnóstico.

**Límite:** “Recordatorios” es solo una preferencia; no hay push ni notificaciones (`companion-preferences.tsx:41-45`).

---

### D10 · Sin auth de sesión; Cloudflare Access para producción

**Estado: TOMADA como límite consciente del prototipo.**

- `SECURITY.md:3-5`: el MVP es una demo de una sola comerciante sin sesión.
- `SECURITY.md:92-103`: Cloudflare Access es obligatorio fuera de la demo; el webhook queda fuera de Access y se autentica con firma.
- `SECURITY.md:168-170`: “CSRF no es autenticación”; producción real requiere sesión firmada + autorización por rol.

**Consecuencia:** no afirmar “app segura para producción” ni “multiusuario”. Es un prototipo de mostrador.

---

### D11 · SQLite + Next.js 16 para el prototipo

**Estado: TOMADA; reemplaza la idea inicial de Postgres/Next 15.**

- `README.md:121-123` dice Next 16 + SQLite `node:sqlite` para el prototipo; Postgres para producción.
- `web/package.json:36-41` (Next 16.4.3, React 19.3).
- `web/src/lib/db.ts:76-104` (`DatabaseSync`, WAL).
- `PLAN-8-DIAS.md:7` reconoce que el plan original decía Postgres/Next 15 y cambió.

**Consecuencia:** no hay ORM, no hay migraciones externas, no hay multi-instancia real. La migración es de arranque y de un proceso.

---

### D12 · Sin offline real ni exportación (fuera de alcance)

**Estado: TOMADA como exclusión; sigue pendiente como P1.**

- `README.md:75-82` (“Modo offline completo (solo borradores)… fuera del MVP”).
- `GOAL.md:153-164` (“Modo offline completo” fuera de alcance).
- `GOAL-ACOMPANAMIENTO.md:264-266` lo lista como P1-3/P1-5.
- Código: no hay service worker, IndexedDB, cola ni `/api/export` (§9 de `02-PRODUCTO.md`).

**Consecuencia:** la app requiere red para crear ventas, abonar, cortar y tareas. Los borradores locales son continuidad, no offline.

---

### D13 · La dirección visual evolucionó de “Mercado de papel” a “Mostrador claro” y luego a “amable y de barrio”

**Estado: TOMADA; la última reemplaza a las anteriores en la ruta transaccional.**

1. **“Mercado de papel”** (baseline `4d33a46`, tag `pre-hig`): papel, tinta verde, sellos, halftone. Queda como historia y en `README.md:260-276`.
2. **“Mostrador claro”** (HIG F3, commits `efb8145`…`3cf4444`): shell, tabs, tokens, 48 px, 200 %, checkout. Contrato `HIG-DESIGN.md:1-590`.
3. **“Amable y de barrio”** (commits `5d3fa30`, `72d405f`, `343c7d0`, `4f388e7`): libreta de mostrador, LCD, teclas, Atkinson + Fraunces. Contrato `DESIGN-BARRIO.md:1-59`; `HIG-DESIGN.md:619-662`.

**Consecuencia:** el código del HEAD es la libreta barrio (`layout.tsx:1-26`; `barrio.css:5-112`). El MP4 y los frames son “Mostrador claro”, no la libreta barrio.

**Contradicciones:** `GOAL-HIG.md:3` todavía dice “F3+ PARKED”; `README.md:8` dice F3 implementado/desplegado. `HIG-DESIGN.md:600` dice Manrope; el código usa Atkinson. `HIG-DESIGN.md:625-632` dice mesh; el commit `72d405f` lo quitó y el CSS es un gradiente plano. Ver `06-RIESGOS-Y-DUDAS.md`.

---

### D14 · HIG como disciplina, no como certificación Apple

**Estado: TOMADA.**

- `GOAL-HIG.md:3-7`, `:59-63`: se adaptan principios, no se copian APIs/materiales/iconos; no se afirma afiliación ni “cumple HIG”.
- `HIG-DESIGN.md:29-43`: adaptación a web, no certificación.
- `GOAL-HIG.md:271-276`: no tocar webhook/dinero; no convertir todo en vidrio/gradientes.

**Consecuencia:** “HIG” en este repo significa accesibilidad, jerarquía, tacto y estados, no un tema iOS.

---

### D15 · Harness v2: evidencia atada al build y al árbol limpio

**Estado: TOMADA.**

- `HARNESS.md:33-50`: `fast` 3, `static` 5, `full` 23, `full --with-film` 24; `build` no está en `full`.
- `HARNESS.md:118-139`: `latest.json` solo se escribe con `full ok:true`; `latest-static.json` con `static ok:true`; no se versionan; `verify:evidence` compara SHA, dirty, buildSha, artefactos y hashes.
- `harness/EVALS.md:71-83`: reglas de evidencia.
- `web/scripts/harness-gate.mjs:46-381`: catálogo y composición.

**Consecuencia:** ningún “listo” sin `latest.json`/`latest-static.json` válido. En este worktree **no hay** ninguno de los dos.

---

### D16 · El cierre se hace en modo demo; el pago real queda bloqueado

**Estado: TOMADA por limitación externa, no por preferencia.**

- `README.md:88-91`, `:178-180`: no hubo pago real; BBVA/CoDi bloqueado; demo `demo_paid`.
- `demo/STATUS.md:21`, `:82-84`.
- `GOAL-CIERRE-DEMO.md:102-107`: bloqueos conocidos.
- `SWARM/board.md:7`: “Pago real $0.01 — crear cuenta pey… único bloqueante crítico”.

**Consecuencia:** la demo se presenta como demo; no se pide al juez pagar $0.01. Cualquier afirmación de pago real es falsa.

---

## 2 · Decisiones de operación y demo

### D17 · Video/QR de respaldo, no pago real

**Estado: TOMADA.**

- `README.md:125`, `:178`: plan B local + QR impreso + MP4 histórico.
- `RUNBOOK-DEMO.md:156-167`: fallas y último recurso.
- `demo/STATUS.md:7-9`, `:59`.

**Problema:** el MP4 actual es de “Mostrador claro”, no de la libreta barrio, y el QR apunta a un túnel muerto. El “respaldo” no está actualizado. Ver `05-EVIDENCIA.md`.

---

### D18 · El servidor de demo vive en `:3000`; los gates usan puertos aislados

**Estado: TOMADA.**

- `HARNESS.md:110`: p0 en 3211–3213, checkout 3215, mobile-320 3214, security/data 3191/3192; nunca `:3000`.
- `RUNBOOK-DEMO.md:40-55`: conservar `:3000` y `cloudflared` PID 13932; detener 3125/3195/3211/3220/3230.
- `AGENTS.md`: no tocar la app compartida.

**Observación actual:** `:3000` está caído; `:3230` (preview) y `:3211` (gate) están escuchando. No se tocaron.

---

### D19 · `p0/cognitive-integration` se descarta; la integración buena es `p0/final-cognitive`

**Estado: TOMADA (handoff).**

- `HANDOFF-CIERRE.md:122-123`: “`p0/cognitive-integration` está obsoleta; no mergear. La buena es `p0/final-cognitive`.”
- Git: `p0/cognitive-integration` (`ddd87dc`) no es ancestro de `HEAD`; le faltan preferencias/verdad/cierre.

**Consecuencia:** no reutilizar esa rama para el cierre.

---

### D20 · La deuda de video se resolvió en un carril aparte, pero no se mergeó

**Estado: PROPUESTA / DEUDA ABIERTA.**

- `p0/fix-video` (`c395e3e`) añade `web/scripts/demo_ui.py` y reescribe `record-demo.py`/`film-check.py`; reporta PASS 12/12 y MP4 177.64 s en temp (`p0-fix-video-report.md`, en esa rama).
- `HANDOFF-CIERRE.md:106-110` dice que los scripts viven en `p0/fix-video`.
- `HEAD` no tiene `demo_ui.py`; `record-demo.py` es la versión anterior. La rama final no contiene el commit.

**Consecuencia:** para grabar el video final con la UI barrio hay que mergear/revisar `p0/fix-video` o adaptar los scripts. No se puede decir que el video esté resuelto.

---

### D21 · El merge a `master` queda bloqueado hasta corregir los P0 adversarios

**Estado: TOMADA (21:54), por gobernanza.**

- `master` (`a85d903`) añade a `HANDOFF-CIERRE.md`: “⛔ NO MERGEAR TODAVÍA… 2 P0… No avanzar `master` hasta integrar `p0/fix-adversarial` y leer `RELEVO-VERIFICADO.md`.”
- La auditoría `p0/adversarial` (`3939133`) documenta 2 P0:
  - reset de demo borra un pago firmado de pey (`orders.ts:591`; `db.ts:1973`);
  - `/` SSR con datos privados y `Cache-Control: public, s-maxage=60` (`page.tsx:10-18`; `next.config.ts:190-195`).
- La rama de corrección `p0/fix-adversarial` apunta a `b7154ca` y no tiene commits propios al snapshot.
- `p0/final-cognitive` (`2a786f1`) ya incluye el doc de bloqueo, pero **no** una corrección de código.

**Consecuencia:** no hacer fast-forward de `master` a la final hasta que P0-1/P0-2 estén corregidos y probados; el “full 23/23” no cubre esos casos.

---

## 3 · Propuestas no adoptadas o fuera de alcance

| Propuesta | Estado | Fuente |
|---|---|---|
| Cuenta familiar multi-usuario con permisos formales | **Fuera de alcance**; solo visión | `README.md:77`; `GOAL.md:155` |
| Catálogo con fotos, inventario, proveedores | **Fuera de alcance** | `README.md:78`; `GOAL.md:156` |
| WhatsApp Business API | **Fuera de alcance**; solo `share` link | `README.md:79` |
| Modo offline completo | **Fuera de alcance**; solo borradores | `README.md:80`; `GOAL.md:158` |
| Crédito, préstamos, suscripciones | **Fuera de alcance** | `README.md:81`; `GOAL.md:159` |
| Custodia de ahorro / acceso a cuentas familiares | **Fuera de alcance** | `README.md:82`; `GOAL.md:160` |
| Motor de recomendaciones deterministas | **P1**, no implementado | `GOAL-ACOMPANAMIENTO.md:262-263` |
| Exportación CSV/JSON | **P1**, no implementado | `AUDITORIA-CARGA-COGNITIVA.md:266` |
| Crear meta desde la UI | **Parcial**: API existe, UI no | `goals/route.ts:21-45`; `caja-app.tsx:5946-5955` |
| Cancelar/anular venta | **No implementado** | `orders.ts` solo `fulfillOrder` |
| Sesión/auth real | **No implementado**; Cloudflare Access | `SECURITY.md:3-5`, `:168-170` |
| Apple Pay oficial | **Condicional**: solo si pey/Stripe lo habilita; la UI dice “Wallet” | `GOAL-HIG.md:267`; `checkout-client.tsx:43-47` |
| Pago real $0.01 | **Bloqueado externamente** | `README.md:88-91`; `SWARM/board.md:7` |

---

## 4 · Decisiones abandonadas / superseded

| Decisión anterior | Por qué se abandonó | Evidencia |
|---|---|---|
| MVP CoDi-only | CoDi tenía adopción muy baja; el link multi-método resuelve mejor | `README.md:34-46` |
| “Mercado de papel” como dirección única | HIG “Mostrador claro” la reemplazó en la ruta transaccional | `GOAL-HIG.md:19-28`; commits `efb8145`…`3cf4444` |
| Manrope como fuente de UI | Se cambió a Atkinson Hyperlegible por legibilidad | `layout.tsx:17-26`; commit `5d3fa30` |
| Mesh ColorFlow con blooms amarillo/verde | Se quitó por legibilidad; papel plano cálido | commit `72d405f`; `barrio.css:9-10` |
| `p0/cognitive-integration` como rama de cierre | Quedó obsoleta; la buena es `p0/final-cognitive` | `HANDOFF-CIERRE.md:122-123` |
| `p0/design-final` como dirección visual | No es ancestro de `HEAD`; la dirección integrada es `p0/design-structure` | Git: `dd3e3c9` no está en `HEAD`; `5d3fa30` sí |

**Cuidado:** “abandonada” aquí significa “no está en la rama final o fue reemplazada por otra fuente”; no implica que nadie la haya descartado formalmente. Para `p0/design-final` no hay documento de descarte; se marca **no integrada**.

---

## 5 · Decisiones que el código contradice o deja a medias

| Documento dice | Código dice | Estado |
|---|---|---|
| “Manrope para UI” (`HIG-DESIGN.md:600`, `demo/STATUS.md:58`, `harness/STATE.md:79`) | Atkinson Hyperlegible (`layout.tsx:21-26`) | **CONTRADICTORIO** |
| “Mesh ColorFlow” (`DESIGN-BARRIO.md:13`; `HIG-DESIGN.md:625-632`) | Gradiente plano (`barrio.css:9-10`; commit `72d405f`) | **CONTRADICTORIO** |
| “F3+ PARKED” (`GOAL-HIG.md:3`) | F3 implementado y luego barrio (`README.md:8`; commits) | **CONTRADICTORIO** |
| “La confirmación hablada usa speechSynthesis” (`README.md:177`; `RUNBOOK-DEMO.md:177`) | TTS propio, sin fallback (`caja-app.tsx:1294-1300`, `:1336-1339`) | **CONTRADICTORIO** |
| “404 real” (`page.tsx:13-26`) | Preview devuelve 200 con UI de no encontrado | **CONTRADICTORIO / P0** |
| “Video UI vieja” (`README.md:178`, `:286`) | MP4 es “Mostrador claro” (sidebar), no la libreta barrio | **MATIZ**: desactualizado, pero no es la UI de papel original |
| “Cierre pendiente; no declarar” (`demo/STATUS.md:3`) | `GOAL-CIERRE-DEMO.md` y handoff hablan de “falta mergear, correr full y grabar” | **CONSISTENTE en el fondo**: sigue pendiente |

---

## 6 · Resumen ejecutivo de decisiones

- **Tomadas y vigentes:** D1–D19 (con matices en D2/D9/D12/D13/D15).
- **Tomadas pero no cerradas:** D16 (pago real bloqueado), D17 (video/QR desactualizados), D20 (video tooling no mergeado), D21 (merge bloqueado por P0 adversarios).
- **Propuestas/no adoptadas:** multi-usuario, inventario, WhatsApp, offline, exportación, recomendaciones, auth de sesión, crear meta UI, cancelar venta.
- **Superseded:** CoDi-only, Mercado de papel, Manrope, mesh, `p0/cognitive-integration`, `p0/design-final` (no integrada).
- **Contradicciones que hay que resolver antes del cierre:** 404 HTTP, Manrope/Atkinson, mesh/plano, F3 parked/implementado, speechSynthesis, video “UI vieja”, evidencia full ausente.
