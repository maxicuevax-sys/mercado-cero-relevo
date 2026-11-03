# 05 · Evidencia: qué está probado y con qué

> **Regla de este documento:** un resultado solo cuenta si existe el artefacto o la corrida, con SHA y árbol limpio. Si solo hay un reporte que lo afirma, se marca **NO VERIFICADO**.
> **Snapshot:** 2 de noviembre de 2026, 21:43; actualizado 21:56 (America/Mexico_City).

---

## 1 · Jerarquía de fuentes

1. **Artefacto de gate** (`latest.json`, `latest-static.json`, JSON de E2E, `audit.json`) con `gitAtStart.sha`, `dirty:false`, `buildSha` y hashes.
2. **Observación directa de solo lectura** (Git, `/api/health`, estado HTTP, `ffprobe`, hash de archivo).
3. **Código** (lo que el código implementa; no prueba que se haya ejecutado).
4. **Documento/reporte** (afirmación; no es evidencia por sí mismo).

`HARNESS.md:118-139` y `harness/EVALS.md:71-83` definen las reglas de evidencia v2. `AGENTS.md` exige `latest.json`/`latest-static.json` con `ok:true`, `gitAtStart.sha` igual al commit entregado, `dirty:false` y `verify:evidence` PASS.

---

## 2 · Observaciones directas verificadas

| # | Observación | Resultado | Cómo se verificó | Vigencia |
|---|---|---|---|---|
| O1 | HEAD del worktree | `b7154caaa2185b2cafb44a02a6bf5f8b69bef045` | `git rev-parse HEAD` | 2 nov 21:43 |
| O2 | `master` | `d35c79136650f09597182cd24fde5d1078bc93fb` | `git rev-parse master` | 2 nov 21:43 |
| O3 | Relación `master` vs HEAD (snapshot) | `master` (`d35c791`) es ancestro de `b7154ca`; 23 adelante; fast-forward posible | `git merge-base --is-ancestor`; `git rev-list --left-right --count` | 2 nov 21:43 |
| O3b | Relación `master` vs final (actual) | `master` (`a85d903`) es ancestro de `2a786f1`; 24 adelante; **merge bloqueado** | `git rev-list --count master..p0/final-cognitive` = 24; `HANDOFF` en master | 2 nov 21:56 |
| O4 | Árbol de este worktree | limpio | `git status --porcelain --untracked-files=all` vacío | 2 nov 21:56 |
| O5 | Stashes / remotos | 0 / 0 | `git stash list`; `git remote` | 2 nov 21:43 |
| O6 | Worktrees | 48 | `git worktree list --porcelain` | 2 nov 21:43 |
| O7 | Tags | 4 (`pre-hig`, `hig-baseline`, `pre-hig-merge`, `pre-remediation`) | `git tag -n` | 2 nov 21:43 |
| O8 | `:3000` | **no responde** | `Invoke-RestMethod http://127.0.0.1:3000/api/health` → error de conexión | 2 nov 21:43 |
| O9 | Preview local `:3230` | **responde**, `buildSha=397039d212452b2950935d745cd8a1781040923e`, node v25.7.0, uptime 5036 s | `GET /api/health` | 2 nov 21:43 |
| O10 | Preview pública | **responde**, mismo `buildSha=397039d...`, uptime 5811 s | `GET https://involve-picking-wellness-retreat.trycloudflare.com/api/health` | 2 nov 21:43 |
| O11 | Checkout inexistente (página) | **HTTP 200** con UI “No encontramos este cobro” | `GET http://127.0.0.1:3230/pay/no-existe-404-check` | 2 nov 21:43, preview 397039d |
| O12 | Checkout inexistente (API) | **HTTP 404** | `GET http://127.0.0.1:3230/api/checkout/no-existe-404-check` | 2 nov 21:43 |
| O13 | Túnel de demo | **DNS no resuelve** | `GET https://timing-brought-lamp-aberdeen.trycloudflare.com/api/health` → “No se puede resolver el nombre remoto” | 2 nov 21:43 |
| O14 | MP4 versionado | 39.760 s, 1,704,744 B, H.264 1280×800; SHA-256 `C605F810D7B884C33A20C51110261B5B40F250B5E0268D52B24BD0A7A3403424` | `ffprobe` + `Get-FileHash` | 2 nov 21:43 |
| O15 | MP4 contenido | “Mostrador claro” (sidebar), no la libreta barrio; corte $570; meta $325 | frames extraídos a 10 s / 22 s / 30 s | 2 nov 21:43 |
| O16 | QR PDF / PNG | existen; SHA-256 PDF `65DB5D44…`, PNG `E37B3348…`; HTML apunta al túnel muerto | `Get-FileHash`; `demo/qr-demo.html:57` | 2 nov 21:43 |
| O17 | Evidencia versionada | solo `harness/evidence/README.md` y `companion-preferences-e2e.json` | `git ls-files harness/evidence` | 2 nov 21:43 |
| O18 | `latest.json` / `latest-static.json` | **ausentes** | `Get-ChildItem harness/evidence`; `.gitignore:46-50` | 2 nov 21:43 |
| O19 | `companion-preferences-e2e.json` | 26 PASS / 0 FAIL, pero `gitAtStart.dirty: true`, base `e6f3107` | leer JSON `:7-11`, `:12-15` | **evidencia no válida para handoff** |
| O20 | `web/node_modules`, `web/.env.local`, DB | ausentes en este worktree | `Test-Path` | 2 nov 21:43 |

### 2.1 · Evidencia runtime de la auditoría adversaria (21:50)

`p0/adversarial` (`3939133`) auditó `b7154ca` con un entorno aislado y dejó `adversarial.json`:

| Evidencia | Resultado | Fuente |
|---|---|---|
| Build | `BUILD OK` sobre `b7154ca` | `adversarial.json` (`method`) |
| `verify:fast` | 3/3 | ídem |
| Webhook | 40/40 en `:3193`, DB temporal, `DEMO_MODE=true` | ídem |
| Seguridad | 48/48 en `:3121`, DB temporal | ídem |
| Servidor | `next start` aislado en `:3317`, SQLite temporal | ídem |
| Playwright | 320/360/200 %, axe, límites 51/101 | ídem |
| Mock de pey | `:3320` + Next `:3318` para `/api/verify` | ídem |
| Hallazgos | 2 P0, 5 P1, 7 P2; 13 confirmados, 1 no verificado | `adversarial.json` (`counts`) |

**No es un `full` ni reemplaza `latest.json`**, pero sí es una corrida runtime con build y entorno aislado, y es más fuerte que los reportes sin JSON. Los dos P0:

- **P0-1:** reset de demo borra un pago firmado de pey y reporta `preservedRealPayments: 1`.
- **P0-2:** `/` SSR con datos privados y `Cache-Control: public, s-maxage=60`.

**Verificación de código propia:** confirmé las líneas clave de P0-1 (`orders.ts:591`; `db.ts:1848-1855`, `:1943-1957`, `:1973`, `:2005`, `:2012`) y P0-2 (`page.tsx:10-18`; `next.config.ts:190-195`). Por eso se marcan **CONFIRMADO**, no solo “el reporte lo dice”.

**Nota:** las observaciones O9–O13 son de solo lectura. No se reinició, no se hizo POST, no se modificó la preview ni el túnel.

---

## 3 · Identidad de build

- El build se sella con `BUILD_SHA` y `NEXT_PUBLIC_BUILD_SHA`; `build-gate.mjs` escribe `.next/BUILD_SHA` (`HARNESS.md:63-72`; `web/next.config.ts:13-24`).
- `/api/health` devuelve `buildSha` (`web/src/app/api/health/route.ts:10-24`).
- **No hay `.next/BUILD_SHA` en este worktree**; no hay build local. Por tanto no hay `serverBuildSha === HEAD` que probar.
- La preview sirve `397039d`, no `b7154ca`. **No es evidencia del HEAD final.**
- El `:3000` de demo no está arriba. **No hay servidor del HEAD final.**

---

## 4 · Catálogo de gates (código, no ejecución)

`web/scripts/harness-gate.mjs` define:

| Modo | Gates | Composición |
|---|---:|---|
| `fast` | 3 | `guard`, `lint`, `types` |
| `static` | 5 | `fast` + `deps` + `build` |
| `full` | 23 | `guard`, `lint`, `types`, `deps` + `truth`, `webhook`, `mobile`, `checkout`, `hig`, `motion`, `contrast`, `mobile-320`, `rehearsal`, `security`, `data`, `perf`, `p0-venta`, `p0-fiado`, `p0-corte`, `p0-integracion`, `p0-dinero`, `tunnel`, `preflight` |
| `full --with-film` | 24 | `full` + `film` |

- Catálogo total: **25** gates; `build` fuera de `full`, `film` opcional (`harness-gate.mjs:376-381`, `HARNESS.md:108`).
- `build` no corre en `full`; se valida con `static`/`npm run build` (`HARNESS.md:46-47`).
- `--only`/`--skip` dejan `partial:true` y `ok:false`; no cuentan como handoff (`HARNESS.md:59-61`).

### 4.1 Markers y conteos del código

| Gate | Marker exacto | Conteo textual en el script | Fuente |
|---|---|---:|---|
| `webhook` | `WEBHOOK OK` + `40/40` | 40 llamadas `check()` | `web/scripts/webhook-contract.mjs:70`; conteo estático |
| `preflight` | `PREFLIGHT OK` + `18/18` | 18 checks (13 directos + 5 de archivos) | `web/scripts/preflight.mjs:41-128` |
| `test:harness` | 58 tests | 58 `test()` | `web/package.json:22`; conteo estático |
| `p0-fiado` | `51 PASS` + `0 FAIL` + `0 KNOWN` | 51 `check()` | `web/scripts/p0-fiado-e2e.py` |
| `p0-corte` | `69 PASS` + `0 FAIL` + `0 KNOWN` | 69 `check()` | `web/scripts/p0-corte-e2e.py` |
| `p0-integracion` | `51 PASS` + `0 FAIL` + `0 KNOWN` | 51 `check()` | `web/scripts/p0-integracion-e2e.py` |
| `p0-dinero` | `45 PASS` + `0 FAIL` + `3 KNOWN` | 45 `check()` | `web/scripts/p0-dinero-e2e.py` |
| `p0-venta` | `65 PASS` + `0 FAIL` + `0 KNOWN` | 61 `check()` textuales (puede haber 4 en bucles) | `web/scripts/p0-venta-e2e.py`; **duda menor** |
| `p0-shell` (no gate) | `68 PASS` / `52 PASS` según documento | 73 `check()` | `p0-shell-e2e.py`; cifras históricas |
| `payment-truth` (E2E) | 35/35 | 35 `check()` | `web/scripts/payment-truth-e2e.py` |
| `sin-ia` (E2E) | 21/21 + 1 NOTE | 21 `check()` | `web/scripts/sin-ia-e2e.py` |
| `closing-checklist` (E2E) | 18/18 | 19 `check()` | `web/scripts/closing-checklist-e2e.py`; **duda menor** |
| `companion-preferences` (E2E) | 26/26 | 27 `check()` | `companion-preferences-e2e.py`; JSON confirma 26 |

**Importante:** el conteo textual no es una corrida. Solo dice que el script tiene esos checks; no dice que pasen.

---

## 5 · Matriz de resultados afirmados

Leyenda: **V** = verificado con artefacto/observación; **NV** = no verificado (solo documento); **PI** = parcial/inválido; **H** = histórico.

| Resultado afirmado | Valor | ¿Artefacto? | Estado | Fuente de la afirmación |
|---|---|---|---|---|
| `fast` 3/3 | guard, lint, types | No hay `latest` fast | **NV** para HEAD; **H** en reportes | `P0-FIADO-REPORT.md:160`; `verdad-pago-report.md:99` |
| `static` 5/5 | guard, lint, types, deps, build | No hay `latest-static.json` | **NV** para HEAD | `demo/STATUS.md:55`; `harness/STATE.md:60` |
| `full` 23/23 | 23 gates | No hay `latest.json` | **NV** para HEAD | `GOAL-CIERRE-DEMO.md:15-22`; `HARNESS.md:200-211` |
| `full --with-film` 24/24 | 24 gates | No hay `latest.json` | **NV** | `HARNESS.md:204` |
| Auditoría adversaria | 2 P0, 5 P1, 7 P2; build + webhook 40/40 + security 48/48 + servidor aislado | `adversarial.json` en `p0/adversarial` | **V** como auditoría runtime de `b7154ca`; no es full | `AUDITORIA-ADVERSARIA.md`; `adversarial.json` |
| Webhook 40/40 | firma, replay, monto, orden, timestamp, QR, 409/404 | Script con 40 checks; sin JSON de corrida | **NV** para HEAD; el conteo del script es consistente | `README.md:239`; `harness/STATE.md:23` |
| Mobile 25/25 | 360 px | `demo/mobile-audit.json` no existe | **NV** para HEAD | `README.md:287`; `demo/STATUS.md:37` |
| Checkout 19/19 | 360 px | `demo/checkout-audit.json` no existe | **NV** para HEAD | `README.md:288`; `demo/STATUS.md:40` |
| HIG 5 viewports | 320/360/390/768/1280 | `demo/hig-after/audit.json` no existe; solo `hig-before` | **NV** para HEAD | `HARNESS.md:91`; `harness/EVALS.md:21` |
| Motion 19 PASS | duraciones/reduced motion | `harness/evidence/motion*` no existe | **NV** para HEAD | `README.md:290`; `harness/STATE.md:32` |
| Contrast 7 PASS | axe/foco/360 | `harness/evidence/a11y-contrast*` no existe | **NV** para HEAD | `README.md:290`; `harness/STATE.md:33` |
| Mobile-320 42 PASS | 3 motores | `mobile-320-e2e.json` no existe | **NV** para HEAD | `README.md:295`; `harness/STATE.md:27` |
| Rehearsal 3/3, 19/19 | master `75179c7` | `demo/rehearsal.json` no existe | **NV** para HEAD; la corrida fue en `75179c7` | `README.md:290`; `demo/STATUS.md:42` |
| Security | `SEGURIDAD OK` | No hay JSON | **NV** para HEAD | `harness/STATE.md:40` |
| Data 85 | 58+20+7 | No hay JSON | **NV** para HEAD | `HARNESS.md:97`; `harness/STATE.md:41` |
| Perf budget | `PERF BUDGET OK` | No hay JSON | **NV** para HEAD | `harness/STATE.md:42` |
| p0-venta 65 | 65 PASS | No hay JSON | **NV** para HEAD | `HARNESS.md:99`; `GOAL-CIERRE-DEMO.md:19` |
| p0-fiado 51 | 51 PASS | No hay JSON | **NV** para HEAD | `HARNESS.md:100`; `P0-FIADO-REPORT.md` (50 histórico) |
| p0-corte 69 | 69 PASS | No hay JSON | **NV** para HEAD | `HARNESS.md:101`; `P0-D-CORTE-REPORT.md` |
| p0-integracion 51 | 51 PASS | No hay JSON | **NV** para HEAD | `HARNESS.md:102`; `P0-INTEGRACION-REPORT.md` |
| p0-dinero 45+3 | 45 PASS, 3 KNOWN | No hay JSON (ignorado) | **NV** para HEAD | `HARNESS.md:103`; `P0-DINERO-REPORT.md:91` |
| Tunnel 8/8 | Cloudflare | `demo/tunnel-smoke.json` no existe; túnel muerto | **NV**; además el túnel actual no responde | `README.md:289`; `demo/STATUS.md:41` |
| Preflight 18/18 | servidor/túnel/datos/QR | No hay salida; `:3000` caído; falta `tunnel-smoke.json` | **NV**; no ejecutable ahora | `README.md:294`; `preflight.mjs` |
| Payment truth 35/35 | E2E | No hay JSON; reporte en `verdad-pago-report.md` | **NV** para HEAD | `HANDOFF-CIERRE.md:22`; `verdad-pago-report.md:100` |
| Sin IA 21/21 + 1 NOTE | E2E | No hay JSON; reporte | **NV** para HEAD | `HANDOFF-CIERRE.md:23`; `sin-ia-report.md:9` |
| Closing 18/18 | E2E | No hay JSON; reporte | **NV** para HEAD | `HANDOFF-CIERRE.md:24`; `cierre-cognitivo-report.md:70` |
| Companion preferences 26/26 | E2E | JSON presente, `dirty:true` | **PI**: no es evidencia válida para handoff | `harness/evidence/companion-preferences-e2e.json:7-15` |
| Human tests 0/6–8 | 6–8 comerciantes | `demo/feedback.md` vacío | **INFERIDO**: no hay registros; los docs dicen 0 | `demo/STATUS.md:20`; `demo/feedback.md` |
| Real payment $0.01 | no ocurrió | No hay transacción, portal, webhook productivo | **NV/ausencia**: no hay evidencia de que haya ocurrido; los docs lo niegan | `README.md:88-91`; `demo/STATUS.md:82-84` |

---

## 6 · Evidencia que sí existe (pero no prueba el cierre)

### 6.1 `companion-preferences-e2e.json`

- 26 PASS, 0 FAIL (`:12-15`).
- Base `e6f3107`, branch `p0/final-cognitive`, **`dirty: true`** (`:7-11`).
- Capturas referenciadas en `%TEMP%\opencode\preferencias\...` (`:16-41`), fuera del repo; no se pueden verificar desde el árbol.
- Reporte `preferencias-report.md:60` afirma `gitAtStart.dirty: false`; el JSON dice `true`. **Contradicción directa.**
- Por las reglas de `HARNESS.md:135` y `EVALS.md:73-76`, esta evidencia **no es válida** para handoff.

### 6.2 `demo/hig-before/`

- Es la **línea base** HIG del 31 de octubre, no el estado final.
- `lighthouse-merchant.json` / `lighthouse-checkout.json`: accesibilidad 100, best practices 100, SEO 100; `fetchTime` 31 oct 21:30/21:31; performance 0 (no se usó como métrica).
- `audit.json` muestra la UI de “Mercado de papel” (H1 “Cobra hablando. El banco confirma.”), targets <44 en varios inputs, y una violación moderada `page-has-heading-one` en checkout. **No es el estado final.**
- **No hay `demo/hig-after/audit.json`.**

### 6.3 Video

- MP4: 39.760 s, 1,704,744 B, H.264, 1280×800, SHA-256 `C605F810…`.
- Contenido: “Mostrador claro” (sidebar Caja/Fiado/Corte/Meta/Pendientes; H1 de la libreta, no la barrio). Muestra venta $90, link/QR, corte $570 con “Cuadra”, meta $325.
- No es la UI barrio del HEAD; no es la UI de papel original. Es una versión intermedia.
- Los docs lo llaman “UI vieja” (`README.md:178`, `:286`; `RUNBOOK-DEMO.md:4`; `demo/STATUS.md:7`, `:59`). Esa etiqueta es **imprecisa**: no es la UI de papel, es “Mostrador claro”.
- **No hay video de la libreta barrio.**

### 6.4 Frames de stageshow

- `demo/stageshow/01…08` existen (8 PNG), pero son de “Mostrador claro” (ver `07-corte.png`: sidebar, corte $570), no de la libreta barrio.
- No hay `demo/stageshow/film-check.json` ni `contact-sheet`/`motion-sheet` versionados; están ignorados (`gitignore:31-32`).
- `film-check.py` en `HEAD` es la versión anterior; la versión que valida MP4 + 8 frames + manifiesto está en `p0/fix-video` (`c395e3e`).

### 6.5 QR

- `demo/qr-demo.html:57` apunta a `https://timing-brought-lamp-aberdeen.trycloudflare.com`.
- El túnel **no resuelve** (O13).
- `demo/qr-demo.pdf` y `.png` existen; el PDF no se pudo leer con `pdftotext` (no instalado), pero el HTML es la fuente de la URL.
- **El QR impreso no sirve hoy.**

### 6.6 Código como evidencia de implementación

El código sí prueba que las rutas y los invariantes existen; no prueba que la app funcione en el entorno. Ejemplos:

- `web/src/lib/pey-events.ts:146-157` exige monto exacto.
- `web/src/app/api/webhooks/pey/route.ts:136-157` exige firma.
- `web/src/lib/orders.ts:967-1011` rechaza demo/ﬁado abierto en entrega.
- `web/src/lib/cash.ts:335-492` versiona el corte.

Para convertirlos en evidencia de cierre hace falta una corrida con `latest.json` y `verify:evidence`.

---

## 7 · Lo que falta para poder declarar el cierre

1. **Corregir P0-1** (reset borra pago firmado de pey) y **P0-2** (`/` con caché pública de datos privados) en `p0/fix-adversarial`, con tests que reproduzcan los casos.
2. **Corregir P1-1** (webhook firmado en demo produce `paid`), **P1-3** (`/api/verify` sin referencias) y **P1-4** (404 HTTP).
3. **Avanzar `master`** a una final ya corregida, solo cuando el bloqueo se levante; el fast-forward actual está prohibido.
4. **Construir desde ese HEAD** (`npm run build`) y arrancar `next start -H 127.0.0.1 -p 3000` con DB demo reseteada.
5. **Reset demo** y `preflight` (requiere túnel vivo y `tunnel-smoke.json`).
6. **`npm run verify:full`** sin `--skip`/`--only`, con `buildSha === HEAD`.
7. **`npm run verify:evidence`** PASS contra el mismo HEAD y árbol limpio.
8. **`latest.json`** con `ok:true`, `complete:true`, `gitAtStart.dirty:false`, `gates[]` con `buildSha === HEAD`, artefactos con hash.
9. **Repetir E2E cognitivos** sobre el build final: payment-truth, sin-ia, closing-checklist, companion-preferences.
10. **Regenerar túnel/QR/PDF** y probar `tunnel-smoke` 8/8.
11. **Grabar video/Stageshow** con la UI barrio; mergear `p0/fix-video` o adaptar los scripts.
12. **Pruebas humanas** 6–8 y TalkBack/VoiceOver/teléfono físico; no se sustituyen con gates.

Sin 1–8, cualquier “listo” es una afirmación sin evidencia.

---

## 8 · Comandos reproducibles (cuando haya entorno)

```powershell
cd web
npm ci
npm run test:harness          # 58 tests
npm run verify:static         # 5/5, escribe latest-static.json
npm run build                 # build con BUILD_SHA
# en otra terminal, con DB demo y APP_URL correctos:
npx next start -H 127.0.0.1 -p 3000
npm run verify:full           # 23/23, escribe latest.json
npm run verify:evidence       # PASS contra HEAD
npm run harness:report        # tabla desde latest.json
```

Para el webhook:

```powershell
cd web
node scripts/webhook-contract.mjs   # 40 checks; requiere PEY_WEBHOOK_SECRET y :3000
```

Para el 404:

```powershell
Invoke-WebRequest http://127.0.0.1:3000/pay/no-existe -UseBasicParsing |
  Select-Object StatusCode
Invoke-WebRequest http://127.0.0.1:3000/api/checkout/no-existe -UseBasicParsing |
  Select-Object StatusCode
```

Para el video:

```powershell
cd web
$env:DEMO_BASE_URL="http://127.0.0.1:3000"
python scripts/record-demo.py
python scripts/film-check.py
```

**No ejecutar estos comandos en este worktree ahora:** falta `node_modules`, `.env.local`, DB y servidor; y el carril es documental.

---

## 9 · Conclusión de evidencia

- **Lo único verificable del cierre es el estado de Git, algunas observaciones de solo lectura y la auditoría adversaria de `b7154ca`.**
- **No hay una sola corrida `full` válida para `b7154ca`.** El único JSON versionado está sucio y es de `e6f3107`.
- **La preview `397039d` no es el HEAD final**, aunque su diseño barrio sea cercano.
- **El túnel/QR de demo no funciona.**
- **El video no es de la UI final.**
- **La auditoría adversaria encontró 2 P0 y `master` bloqueó el merge.** No se puede cerrar sin corregirlos.
- Por tanto: **cierre pendiente y merge bloqueado**, no “listo”. La frase de `demo/STATUS.md:3` (“No declarar el cierre”) sigue siendo la correcta, y ahora `master` añade “NO MERGEAR TODAVÍA”.
