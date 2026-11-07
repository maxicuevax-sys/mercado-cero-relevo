# 06 · Riesgos, contradicciones y dudas

> **Criterio:** cada fila lleva `VERIFICADO`, `INFERIDO` o `DESCONOCIDO`. `NO VERIFICADO` significa que el documento lo afirma pero no hay artefacto.
> **Snapshot:** código `b7154ca`, 2 de noviembre de 2026 21:43; actualizado 21:56 con la auditoría adversaria y el bloqueo de merge.

---

## 1 · Contradicciones entre documentos, código y evidencia

### C1 · `master` no contiene la rama final

- **Afirmación A:** `HANDOFF-CIERRE.md:14` dice que la rama final es `p0/final-cognitive`.
- **Afirmación B:** `HANDOFF-CIERRE.md:34-37` dice que `master` es ancestro y que se puede hacer fast-forward.
- **Realidad (21:56):** ambas son ciertas, pero **`master` sigue en `a85d903`**; no se hizo el avance. Hay 24 commits de diferencia entre `master` y `2a786f1`.
- **Además:** `master` (`a85d903`) dice “⛔ NO MERGEAR TODAVÍA” por los P0 adversarios (C23–C25).
- **Riesgo:** desplegar/grabar desde `master` pierde el cierre; mergear ahora propaga P0.
- **Estado:** **VERIFICADO**.

### C2 · No hay evidencia `full` para el HEAD final

- **Afirmación A:** `GOAL-CIERRE-DEMO.md:15-22` exige `full` 23/23 y `verify:evidence`.
- **Afirmación B:** `demo/STATUS.md:3` dice “No hay `latest.json`… la evidencia está pendiente”.
- **Realidad:** `harness/evidence/latest.json` y `latest-static.json` **no existen**; solo está `companion-preferences-e2e.json`. La auditoría adversaria aporta un `adversarial.json` con build y runtime, pero **no es el full**.
- **Riesgo:** cualquier “23/23” es una afirmación sin artefacto.
- **Estado:** **VERIFICADO** (ausencia).

### C3 · El único JSON de evidencia está sucio y no prueba el HEAD

- **Afirmación A:** `preferencias-report.md:60` dice “árbol limpio (`gitAtStart.dirty: false`)”.
- **Afirmación B:** `harness/evidence/companion-preferences-e2e.json:7-11` dice `"sha": "e6f3107...", "dirty": true`.
- **Realidad:** el JSON contradice al reporte. Además, `HARNESS.md:135` exige `dirty:false` para que la evidencia cuente.
- **Estado:** **CONTRADICTORIO / VERIFICADO**.

### C4 · El 404 del checkout es 200 aunque la UI diga “no encontrado”

- **Afirmación A:** `web/src/app/pay/[id]/page.tsx:13-14` dice “un id inexistente puede devolver un 404 real, no un shell con 200”.
- **Afirmación B:** `HANDOFF-CIERRE.md:127-128` reconoce que el status sigue siendo 200.
- **Observación:** `GET /pay/no-existe-404-check` en la preview `397039d` devuelve **200** con la UI “No encontramos este cobro”; `GET /api/checkout/no-existe` devuelve **404**.
- **Prueba existente:** `checkout-audit.py:290-333` mide la UI y la consola, **no** el status HTTP; por eso 19/19 puede pasar con 200.
- **Riesgo:** un link inventado se sirve como 200; SEO/monitoreo y semántica HTTP incorrectos.
- **Estado:** **VERIFICADO** en `397039d`; **INFERIDO** para `b7154ca` (no hay build/servidor del HEAD final).

### C5 · El túnel de demo está muerto y el QR apunta ahí

- **Afirmación A:** `README.md:291`, `RUNBOOK-DEMO.md:5`, `demo/STATUS.md:9` dicen que el túnel vigente es `https://timing-brought-lamp-aberdeen.trycloudflare.com`.
- **Observación:** el host **no resuelve** (`Invoke-RestMethod` → “No se puede resolver el nombre remoto”).
- **Riesgo:** el QR impreso y el link público no funcionan; el “plan B” de demo pública no existe.
- **Estado:** **VERIFICADO**.

### C6 · La preview no es el build final

- **Afirmación A:** `HANDOFF-CIERRE.md:27-30` dice que la preview sirve `397039d`, no el build final.
- **Observación:** `/api/health` de `:3230` y de la URL pública devuelve `397039d`; el HEAD es `b7154ca`.
- **Riesgo:** una demo desde la preview muestra el diseño barrio, pero no incluye los merges cognitivos finales (`e6f3107`, `fe97c00`, `b7154ca`).
- **Estado:** **VERIFICADO**.

### C7 · Manrope vs Atkinson

- **Afirmación A:** `HIG-DESIGN.md:600` dice “Manrope para UI”; `demo/STATUS.md:58` y `harness/STATE.md:79` repiten “Manrope”.
- **Afirmación B:** `HIG-DESIGN.md:619-623` dice que la sección 18 reemplaza la composición de §16; `layout.tsx:21-26` usa **Atkinson Hyperlegible**; `DESIGN-BARRIO.md:15` también dice Atkinson.
- **Realidad:** el código usa Atkinson; los docs tienen una sección vieja sin actualizar.
- **Estado:** **CONTRADICTORIO / VERIFICADO**.

### C8 · Mesh ColorFlow vs papel plano

- **Afirmación A:** `DESIGN-BARRIO.md:13` dice “Papel cálido con mesh ColorFlow”; `HIG-DESIGN.md:625-632` describe cuatro manchas radiales.
- **Afirmación B:** el commit `72d405f` (“quitar mesh amarillo/verde y dejar papel plano”) reemplazó el mesh por un gradiente lineal; `barrio.css:9-10` lo confirma.
- **Realidad:** el código es plano; los docs siguen describiendo mesh.
- **Estado:** **CONTRADICTORIO / VERIFICADO**.

### C9 · “F3 implementado” vs “F3+ PARKED”

- **Afirmación A:** `README.md:8` dice “F3 implementado, verificado de forma independiente y desplegado en producción”.
- **Afirmación B:** `GOAL-HIG.md:3` dice “F3+ PARKED: no se toca la UI antes del 7 de noviembre sin una decisión explícita”.
- **Realidad:** F3 se implementó y luego se siguió rediseñando a barrio; el header de `GOAL-HIG.md` quedó congelado en el estado anterior.
- **Estado:** **CONTRADICTORIO**; la parte operativa vigente es el código/commits.

### C10 · `speechSynthesis` como fallback

- **Afirmación A:** `README.md:177` y `RUNBOOK-DEMO.md:177` dicen que la confirmación hablada usa `speechSynthesis` del navegador.
- **Afirmación B:** `caja-app.tsx:1294-1300` y `:1336-1339` dicen explícitamente “no caemos a la voz del navegador”; `harness/STATE.md:67` lo confirma.
- **Realidad:** no hay fallback a `speechSynthesis`; si Piper/Kokoro falla, hay silencio + texto.
- **Estado:** **CONTRADICTORIO / VERIFICADO**.

### C11 · “Video UI vieja” vs contenido real del MP4

- **Afirmación A:** `README.md:178`, `:286`; `RUNBOOK-DEMO.md:4`; `demo/STATUS.md:7`, `:59` dicen “UI vieja, muestra $570”.
- **Observación:** el MP4 (39.76 s) muestra **Mostrador claro** (sidebar, no la libreta barrio), con venta $90, corte $570 y meta $325. No es la UI de papel original; es una versión intermedia.
- **Realidad:** el “$570” es correcto; “UI vieja” es impreciso; **no es la UI final** (barrio).
- **Estado:** **CONTRADICTORIO en el adjetivo, VERIFICADO en duración/size/$570**.

### C12 · El video “se regrabará”, pero el tooling no está en la final

- **Afirmación A:** `RUNBOOK-DEMO.md:114` y `demo/STATUS.md:59` dicen que se regrabará.
- **Afirmación B:** `p0/fix-video` (`c395e3e`) tiene los scripts nuevos; no es ancestro de `HEAD`; `HEAD` no tiene `web/scripts/demo_ui.py`.
- **Riesgo:** no se puede grabar el video final con la UI barrio usando el HEAD actual sin mergear/adaptar.
- **Estado:** **VERIFICADO**.

### C13 · `master` en los goals vs `master` real

- **Afirmación A:** `GOAL-CIERRE-DEMO.md:3` dice “Estado de partida: master `71bc4ed`”.
- **Realidad:** `master` es `a85d903`; `71bc4ed` fue una punta anterior (2 nov 16:49). `master` avanzó con docs después (`d35c791` y `a85d903`).
- **Estado:** **HISTÓRICO / VERIFICADO**.

### C14 · `demo/STATUS` base `3fe1cc9` vs HEAD `b7154ca`

- **Afirmación A:** `demo/STATUS.md:3`, `:15` dicen que la base auditada es `3fe1cc9`.
- **Realidad:** `3fe1cc9` es un commit del 2 nov 14:39; el código final es `b7154ca` (20:56), 23 commits después, y la punta documental es `2a786f1`.
- **Estado:** **HISTÓRICO / VERIFICADO**.

### C15 · Handoff base `b5c59e1` vs final `d35c791`

- **Afirmación A:** `HANDOFF-CIERRE.md:15` dice “Contiene `master b5c59e1` + diseño estructural + carriles cognitivos”.
- **Realidad:** la final (`2a786f1`) contiene `master a85d903` (que incluye `b5c59e1` + docs posteriores) y está 24 adelante de `master`.
- **Estado:** **HISTÓRICO / VERIFICADO**.

### C16 · Cifras de webhook: 34/34 vs 40/40

- **Afirmación A:** `SWARM/board.md:14` y `P0-DINERO-REPORT.md:89` dicen 34/34.
- **Afirmación B:** `README.md:239`, `HARNESS.md:88`, `harness/STATE.md:23` dicen 40/40.
- **Realidad:** el script actual tiene **40** llamadas `check()` (`webhook-contract.mjs:70`); 34/34 es histórico de una fase anterior.
- **Estado:** **HISTÓRICO vs VIGENTE**; no es una contradicción del código actual, pero confunde.

### C17 · Cifras de p0: 50 vs 51 (fiado) y 52/68 (shell)

- **Fiado:** `P0-FIADO-REPORT.md` documenta 50 PASS en una fase; `HARNESS.md:100` y `STATE.md:35` dicen 51; el script actual tiene 51 `check()`. La cifra 51 es la más reciente, pero no hay JSON.
- **Shell:** `P0-SHELL-REPORT.md:125` dice 52 PASS; `harness/STATE.md:39` dice 68; el script actual tiene 73 `check()`. Es un carril aparte, no gate del full.
- **Estado:** **HISTÓRICO / NO VERIFICADO**.

### C18 · `p0/perf-data` versiona `latest.json`

- **Afirmación:** `HARNESS.md:139` y `EVALS.md:80` dicen que `latest.json` no se versiona.
- **Realidad:** la rama `p0/perf-data` (`87ebd0c`) contiene un `harness/evidence/latest.json` trackeado en su diff contra `HEAD`.
- **Riesgo:** si se mergea sin limpiar, se commitea evidencia local y se rompe la regla.
- **Estado:** **VERIFICADO en esa rama**; no está en `HEAD`.

### C19 · Shift de la UI: preview barrio vs video Mostrador claro

- **Afirmación A:** la preview `397039d` es “preview” y no final (`HANDOFF:27-30`).
- **Observación:** la preview sirve el diseño barrio (HTML con “Cuánto llevo”, “¿Qué vendiste?”), pero no los merges cognitivos finales.
- **Afirmación B:** el video es “Mostrador claro”, no barrio.
- **Riesgo:** confundir “preview barrio” con “video final”; ninguno es el HEAD final.
- **Estado:** **VERIFICADO**.

### C20 · Conteo textual de `p0-venta` 61 vs 65

- **Afirmación:** `HARNESS.md:99` y `GOAL-CIERRE-DEMO.md:19` dicen 65 PASS.
- **Observación:** el script `p0-venta-e2e.py` tiene 61 llamadas `check()` textuales; podrían existir 4 en bucles o el conteo del documento incluir otra fase.
- **Estado:** **DESCONOCIDO**; no se ejecutó. No se usa como prueba de que 65 sea falso, sino como duda a resolver con una corrida.

### C21 · Conteo `closing-checklist` 19 vs 18

- **Afirmación:** `HANDOFF-CIERRE.md:24` y `cierre-cognitivo-report.md:70` dicen 18/18.
- **Observación:** el script tiene 19 `check()` textuales.
- **Estado:** **DESCONOCIDO**; puede haber un check en una rama no ejecutada. No se ejecutó.

### C22 · Documentos que dicen “todo verde” y no incluyen el JSON

- `P0-FIADO-REPORT.md:163` cita `latest.json` static con `sha=1181967`; ese archivo no está en el repo.
- `P0-SHELL-REPORT.md:87` cita `latest.json` static `sha=27d42c8`; no está.
- `PREFERENCIAS-REPORT.md:60` cita JSON con dirty false; el JSON dice true.
- **Estado:** **NO VERIFICADO / CONTRADICTORIO**.

### C23 · El handoff decía “mergear”; `master` ahora dice “NO MERGEAR”

- **Afirmación A:** `HANDOFF-CIERRE.md:3-4` (versión 20:55) dice “El objetivo es mergear, verificar y grabar”.
- **Afirmación B:** el mismo archivo en `master` (`a85d903`, 21:54) añade “⛔ NO MERGEAR TODAVÍA” por 2 P0.
- **Realidad:** la segunda es la decisión vigente; la primera es histórica. `p0/final-cognitive` (`2a786f1`) ya incluye el bloqueo, pero no la corrección.
- **Estado:** **VERIFICADO**.

### C24 · El reset de demo puede borrar un pago firmado de pey

- **Código:** `recordPayment` marca `demo=1` si `isDemoMode()` incluso para `provider='pey'` (`orders.ts:591`); `resetDemoData` borra `payments WHERE demo=1` (`db.ts:1973`) y calcula `preservedRealPayments` antes del borrado (`db.ts:2005`, `:2012`).
- **Auditoría:** reproducido en `:3317`; el reset responde `200` con `preservedRealPayments:1` y luego el pago ya no existe (`adversarial.json` P0-1).
- **Contradice:** `README.md:231` y `SECURITY.md:84-86` prometen 409 si hay pago real.
- **Estado:** **VERIFICADO por código + auditoría**.

### C25 · `/` SSR con datos privados y caché pública

- **Código:** `page.tsx:10-18` renderiza `getDashboardData`; `next.config.ts:190-195` declara `Cache-Control: public, max-age=0, s-maxage=60`.
- **Auditoría:** el HTML contiene nombres, “100 personas”, saldo de fiado, `paymentUrl` y `qrString` (`adversarial.json` P0-2).
- **Riesgo:** una caché compartida puede servir datos privados de la caja.
- **Estado:** **VERIFICADO por código + auditoría**.

### C26 · Un webhook firmado en demo produce `paid` y permite entregar

- **Código:** `recordPayment` pone `paid` si `provider='pey'` (`orders.ts:677-683`), aunque `demo=1`; `fulfillOrder` solo rechaza `demo_paid` (`orders.ts:968-974`).
- **Auditoría:** en `DEMO_MODE=true`, el webhook firmado deja `status=paid`, `payments.demo=1`, `provider=pey`; `PATCH fulfill=200`; `verifiedDigitalCents=1000`, `demoDigitalCents=0` (`adversarial.json` P1-1).
- **Contradice:** la promesa “demo solo `demo_paid`” (`payment-rules.ts:24-26`; `harness/STATE.md:88-91`).
- **Estado:** **VERIFICADO por código + auditoría**.

### C27 · `/api/verify` acepta una transacción PAID sin referencias

- **Código:** `hasReferenceMismatch` solo compara referencias si el payload las trae (`verify/route.ts:212-245`).
- **Auditoría:** un mock PAID con monto correcto y sin `payableId`/`metadata`/`clientReferenceId` devuelve `verified:true` (`adversarial.json` P1-3).
- **Estado:** **VERIFICADO con mock**.

### C28 · Totales de cobros/fiado sobre páginas truncadas

- **Código:** `pagination.ts:13-16` fija límites; `dashboard.ts:97-102` corta pendientes; `pending-payments.tsx:99-103` suma lo cargado; `caja-app.tsx:3035-3040` usa `credits.length`.
- **Auditoría:** 51 pendientes → 50; total visible $169 vs `summary.pendingCents` $171; 101 créditos → 100; “100 personas” vs 103.
- **Estado:** **VERIFICADO por auditoría**; el código es consistente con el hallazgo.

---

## 2 · Riesgos P0 (no deberían entrar a la demo sin resolver)

| ID | Riesgo | Por qué es P0 | Evidencia | Estado |
|---|---|---|---|---|
| P0-1 | **No hay `full`/`latest` del HEAD final** | Sin eso no se puede declarar cierre; el jurado técnico puede preguntar por la evidencia | `harness/evidence` solo tiene companion JSON; `demo/STATUS.md:3` | **VERIFICADO** |
| P0-2 | **`master` no contiene la final y además bloquea el merge** | Un deploy/grabación desde `master` pierde 24 commits; el fast-forward está prohibido hasta corregir P0 | `git rev-list --count master..p0/final-cognitive` = 24; `HANDOFF` (master) “NO MERGEAR” | **VERIFICADO** |
| P0-3 | **No hay servidor del HEAD final** | `:3000` caído; preview `397039d` no es `b7154ca` | `:3000` connection refused; `/api/health` preview 397039d | **VERIFICADO** |
| P0-4 | **Túnel/QR de demo muerto** | El QR impreso no abre; el plan B público no existe | DNS failure; `demo/qr-demo.html:57` | **VERIFICADO** |
| P0-5 | **404 de checkout = HTTP 200** | Link inexistente semánticamente incorrecto; P0 reconocido por el handoff | observación 200; `HANDOFF:127-128` | **VERIFICADO en 397039d / INFERIDO en HEAD** |
| P0-6 | **Pago real $0.01 no probado** | La tesis del producto es la certeza del banco; sin pago real es demo | `README.md:88-91`; `SWARM/board.md:7` | **VERIFICADO como ausencia** |
| P0-7 | **Sin auth/sesión** | Cualquiera con el link puede operar la caja si el túnel está abierto; CSRF no es auth | `SECURITY.md:3-5`, `:168-170` | **VERIFICADO** |
| P0-8 | **Pruebas humanas 0/6–8** | No se puede afirmar usabilidad ni accesibilidad real | `demo/feedback.md` vacío; `demo/STATUS.md:20` | **INFERIDO** |
| P0-9 | **Evidencia companion sucia** | El único JSON versionado no cumple las reglas; no se puede citar como prueba | JSON `:7-11`; `HARNESS.md:135` | **VERIFICADO** |
| P0-10 | **Video/Stageshow no son de la UI final** | El respaldo muestra una UI anterior; no prueba la barrio | MP4 39.76 s, frames “Mostrador claro” | **VERIFICADO** |
| P0-11 | **El reset de demo borra un pago firmado de pey** | Destruye evidencia de un pago y reporta que lo conservó; contradice README/SECURITY | `orders.ts:591`; `db.ts:1848-1855`, `:1943-1957`, `:1973`, `:2005`, `:2012`; `adversarial.json` P0-1 | **VERIFICADO por código + auditoría** |
| P0-12 | **`/` SSR con datos privados y caché pública** | Una caché compartida puede servir nombres, saldos y links | `page.tsx:10-18`; `next.config.ts:190-195`; `adversarial.json` P0-2 | **VERIFICADO por código + auditoría** |
| P0-13 | **Webhook firmado en demo produce `paid` y permite entregar** | Rompe “demo solo `demo_paid`” | `orders.ts:591`, `:677-683`, `:968-974`; `adversarial.json` P1-1 | **VERIFICADO por código + auditoría** |
| P0-14 | **`/api/verify` acepta PAID sin referencias** | Se puede entregar con un comprobante de otra operación del mismo monto | `verify/route.ts:212-245`; `adversarial.json` P1-3 | **VERIFICADO con mock** |
| P0-15 | **Totales de cobros/fiado truncados** | La libreta y el cierre subestiman deudas al pasar de 50/100 filas | `pagination.ts:13-16`; `dashboard.ts:97-102`; `pending-payments.tsx:99-103`; `caja-app.tsx:3035-3040`; `adversarial.json` P1-5 | **VERIFICADO por auditoría** |

---

## 3 · Riesgos P1 (primer mes / antes de prometer acompañamiento)

| ID | Riesgo | Evidencia | Estado |
|---|---|---|---|
| P1-1 | `forced-colors` no implementado | `HANDOFF:129`; grep sin `@media (forced-colors)` | **VERIFICADO** |
| P1-2 | Conteo cero del corte rechazado | `cash.ts:318-323`, `:386-391`; auditoría P1-9 | **VERIFICADO** |
| P1-3 | Sin offline real / cola | no service worker; `AUDITORIA-CARGA:264` | **VERIFICADO** |
| P1-4 | Sin exportación | no `/api/export`; `AUDITORIA-CARGA:266` | **VERIFICADO** |
| P1-5 | Sin cancelar/anular venta | `orders.ts` solo `fulfillOrder`; auditoría P1-8 | **VERIFICADO** |
| P1-6 | Sin crear meta desde UI | `caja-app.tsx:5946-5955`; API existe | **VERIFICADO** |
| P1-7 | Sin reconocimiento de productos/clientes recientes | `AUDITORIA-CARGA:268` | **VERIFICADO** |
| P1-8 | Preferencia “Recordatorios” no envía nada | `companion-preferences.tsx:41-45` | **VERIFICADO** |
| P1-9 | Rate limit en memoria, por proceso | `SECURITY.md:14`, `:64-65` | **VERIFICADO** |
| P1-10 | Migración de un solo proceso | `demo/STATUS.md:75` | **VERIFICADO** |
| P1-11 | 320 px / 200 %: Fiar/Cobrar bajo el pliegue | `HANDOFF:130` | **NO VERIFICADO** en HEAD; reportado |
| P1-12 | TTS depende de Piper local; si falta, 503 | `api/tts/route.ts:67-73`; `harness/EVALS.md:40` | **VERIFICADO** |
| P1-13 | Sin consentimiento explícito de voz (solo aviso) | `companion-preferences.tsx:206-216`; auditoría P1-6 | **PARCIAL** |
| P1-14 | `p0/fix-video` no mergeado | `HEAD` sin `demo_ui.py`; `c395e3e` aislado | **VERIFICADO** |

---

## 4 · Riesgos P2 / deuda técnica

| ID | Riesgo | Evidencia | Estado |
|---|---|---|---|
| P2-1 | 49 worktrees y listeners en `:3211` / `:3230` | `git worktree list`; `Get-NetTCPConnection` | **VERIFICADO** |
| P2-2 | `p0/perf-data` versiona `latest.json` | diff de esa rama | **VERIFICADO** |
| P2-3 | `p0/design-final` es una dirección alternativa no integrada | `dd3e3c9` no ancestro de `HEAD` | **VERIFICADO** |
| P2-4 | `p0/cognitive-integration` obsoleta | `HANDOFF:122-123` | **VERIFICADO** |
| P2-5 | Docs con cifras de gates de fases anteriores | 34/34, 50/51, 52/68 | **VERIFICADO** |
| P2-6 | `GOAL-HIG`/`PLAN-8-DIAS` congelados en “F3 parked” | `GOAL-HIG:3`; `PLAN:9` | **VERIFICADO** |
| P2-7 | Duplicación de `latest.json`/evidencia en ramas | `p0/perf-data` | **VERIFICADO** |
| P2-8 | Sin remoto: solo copias locales | `git remote` vacío | **VERIFICADO** |

---

## 5 · Preguntas abiertas

1. **¿Cuál es la rama de entrega?** `p0/final-cognitive` (`2a786f1`, código `b7154ca`) es la candidata; `master` (`a85d903`) está 24 atrás y **bloquea el merge** hasta corregir 2 P0. ¿Se entrega desde la final o se espera la corrección? **DESCONOCIDO** (decisión humana/orquestador).
2. **¿Se mergea `p0/fix-video`?** El handoff dice que los scripts viven ahí, pero no está en la final. **DESCONOCIDO**.
3. **¿Se actualiza la preview al HEAD final?** `GOAL-CIERRE-DEMO.md:86` lo pide; la preview sigue en `397039d`. **DESCONOCIDO**.
4. **¿Se relanza el túnel de demo?** El host actual no resuelve. **DESCONOCIDO**.
5. **¿El 404 HTTP se corrige o se acepta?** El handoff lo lista como P0 abierto; `GOAL-CIERRE-DEMO.md:44` lo incluye en el merge de diseño. **ABIERTO**.
6. **¿Hay un pago real fuera del repo?** No hay evidencia; los docs dicen que no. **DESCONOCIDO fuera del repo**.
7. **¿Se hicieron pruebas humanas?** `demo/feedback.md` vacío; docs 0/6–8. **INFERIDO que no**.
8. **¿La UI barrio se probó en un dispositivo real?** No hay captura/artefacto del HEAD final; solo código y preview. **NO VERIFICADO**.
9. **¿El video “histórico” es la UI de papel o Mostrador claro?** Es Mostrador claro (sidebar), no papel. **VERIFICADO**; el adjetivo del doc es impreciso.
10. **¿`p0/design-final` fue abandonada o es una alternativa viva?** No hay documento de descarte. **DESCONOCIDO**.
11. **¿Por qué `p0/perf-data` tiene `latest.json` trackeado?** No hay explicación; viola la regla. **DESCONOCIDO**.
12. **¿El build de `b7154ca` compila?** No se ejecutó; no hay `node_modules` ni `.next`. **DESCONOCIDO**.
13. **¿El `p0-venta` de 65 checks realmente pasa?** El script tiene 61 `check()` textuales; no se ejecutó. **DESCONOCIDO**.
14. **¿El `closing-checklist` de 18/18 se sostiene?** El script tiene 19 `check()`; no se ejecutó. **DESCONOCIDO**.
15. **¿La migración de SQLite funciona en una DB vieja?** El código tiene migraciones y tests, pero no se corrieron aquí. **NO VERIFICADO**.
16. **¿Quién corrige P0-1/P0-2 y con qué tests?** `p0/fix-adversarial` está vacía al snapshot. **DESCONOCIDO**.
17. **¿Se acepta el 200 del checkout o se corrige?** El audit lo marca P1-4; el handoff anterior lo llamaba P0. **ABIERTO**.
18. **¿Se mergea `p0/fix-video` antes de grabar?** Sin eso no hay tooling nuevo. **DESCONOCIDO**.

---

## 6 · Lo que no se puede afirmar hoy

- “Full 23/23” → **no hay `latest.json`**.
- “Todo verde” → **no hay JSON de los gates**.
- “El reset es seguro” → **falso**: P0-1 borra un pago firmado de pey en demo.
- “La home no expone datos privados” → **falso**: P0-2 SSR + caché pública.
- “Demo solo produce `demo_paid`” → **falso**: P1-1, un webhook firmado en demo produce `paid`.
- “La demo está lista” → **no hay servidor del HEAD, túnel muerto, QR roto, video viejo, y el merge está bloqueado**.
- “Pago real confirmado” → **no hay evidencia**.
- “Accesibilidad completa” → **faltan personas, TalkBack/VoiceOver, teléfono físico**.
- “La UI final es la del video” → **falso**: el video es Mostrador claro; la final es barrio.
- “El 404 está resuelto” → **falso en la preview**: la página devuelve 200.
- “Manrope” / “mesh” → **falso en el código**: Atkinson y papel plano.
- “`master` tiene el cierre” → **falso**: está 24 commits atrás y bloquea el merge por P0.

---

## 7 · Prioridad recomendada (sin cambiar código)

1. **Decidir y ejecutar el avance de `master`** (fast-forward) con revisión humana.
2. **Mergear/revisar `p0/fix-video`** o adaptar los scripts de video.
3. **Construir el HEAD final**, arrancar `:3000`, resetear demo.
4. **Corregir/decidir el 404 HTTP** antes del full (o documentarlo como límite).
5. **Relanzar túnel** y regenerar QR/PDF.
6. **Correr `full` + `verify:evidence`** y guardar `latest.json`.
7. **Grabar video/Stageshow** con la UI barrio.
8. **Pruebas humanas** y accesibilidad real.
9. **Limpiar documentación contradictoria** (Manrope, mesh, “F3 parked”, “UI vieja”, cifras 34/50/52).
10. **No tocar** los worktrees de otros carriles ni los servidores ajenos.

---

## 8 · Conclusión

El proyecto tiene **código y decisiones suficientes para una demo coherente**, pero **no tiene evidencia de cierre y tiene 2 P0 confirmados**. La combinación más peligrosa es:

> `master` bloqueado + 2 P0 (reset borra pago pey; home cachea datos privados) + sin `latest.json` + `:3000` caído + túnel muerto + QR roto + video de una UI anterior.

Eso no se arregla con un documento: se arregla con correcciones de código probadas, una corrida real desde el HEAD final, un túnel vivo y una decisión humana sobre qué rama se entrega.
