# Supervisión del relevo — Mercado Cero

> **Base supervisada:** `b7154caaa2185b2cafb44a02a6bf5f8b69bef045` (`p0/final-cognitive` / `p0/supervisor`, worktree `mercado-cero-supervisor`).
> **Fecha:** 2 nov 2026, 21:38 -06.
> **Veredicto:** **NO LISTO / NO APTO PARA CIERRE**.
> **Alcance:** git, build/preview, evidencia, comandos, docs y seguridad de datos. Sin builds pesados, sin modificar la app, `:3000`, `:3230` ni la preview. Solo lecturas HTTP y de archivos; no se leyó ningún secreto.
> **Huella del handoff auditado:** `HANDOFF-CIERRE.md` SHA-256 `4402191FCCD7630BD591177ECD94FAFB5BC246D1A61C728AE358982CF149557C`.

## Veredicto en una frase

El handoff es honesto sobre lo que falta —merge, build, full, video—, pero **no es ejecutable tal cual** y el estado actual **no cumple su propia DoD**: no hay build del HEAD, no hay `latest.json` full en el worktree final, `verify:evidence` falla, el túnel y el QR de los docs están muertos, y el preflight del handoff falla por `APP_URL` y por artefactos que no existen. No se detectó fabricación de resultados: los conteos de `sin-ia` (21/0/1), `closing` (18/18), `companion` (26/26) y `verify:fast` (3/3 en `fe97c00`) existen en artefactos locales; lo que falta es atarlos al HEAD final y actualizar la operación.

## Hechos duros (fuente primaria)

| Hecho | Dato |
|---|---|
| HEAD supervisado | `b7154ca`; worktree `mercado-cero-rehearsal` limpio |
| `master` | `d35c791`; es ancestro de `p0/final-cognitive`; `final..master = 0`, `master..final = 23` |
| `:3000` | caído (conexión rechazada); no hay servidor final |
| `:3230` | vivo; `buildSha = 397039d`; preview pública `involve-picking-wellness-retreat.trycloudflare.com` |
| `:3302` | vivo; `buildSha = e6f3107`; servidor del E2E de cierre, no el HEAD final |
| `latest.json` | en el worktree `mercado-cero` (master): `mode:static`, SHA `0c052c4`, 15:36; en el worktree final **no existe** |
| `verify:evidence` | **exit 1**: falta `latest-static.json`/`latest.json` en el worktree final |
| Preview pública | HTTP 200 con `397039d`; el túnel documentado `timing...` no resuelve |
| Checkout inexistente | HTTP **200**, no 404, tanto en `:3230` como en `:3302` |
| MP4 actual | 39.76 s, 1,704,744 B, 1280x800; frame a 26 s muestra `$570.00` (histórico) |

## Tabla de afirmaciones

Estados: `VERIFICADO` = reproducible con la fuente citada; `FALSO` = la fuente primaria lo contradice; `OBSOLETO` = fue cierto o describe otro SHA/estado; `NO VERIFICADO` = no hay fuente suficiente o no se ejecutó.

| # | Afirmación | Estado | Evidencia | Corrección |
|---|---|---|---|---|
| G1 | La rama final es p0/final-cognitive en el worktree mercado-cero-rehearsal y apunta a b7154ca. | VERIFICADO | git worktree list: mercado-cero-rehearsal [p0/final-cognitive]; git rev-parse p0/final-cognitive = b7154caaa2185b2cafb44a02a6bf5f8b69bef045. HANDOFF-CIERRE.md:14. | Sin cambio. |
| G2 | p0/final-cognitive contiene master b5c59e1. | OBSOLETO | master actual = d35c791; b5c59e1 es ancestro de d35c791 (merge-base --is-ancestor exit 0). HANDOFF-CIERRE.md:15. | Sustituir b5c59e1 por d35c791; aclarar que el merge ya incorporó 23 commits de master. |
| G3 | master es ancestro de p0/final-cognitive y el avance puede ser fast-forward. | VERIFICADO | git merge-base --is-ancestor master p0/final-cognitive exit 0; rev-list --count p0/final-cognitive..master = 0; master..p0/final-cognitive = 23; master worktree limpio. | Ejecutar el ff-only; aún no ejecutado. |
| G4 | El único conflicto del merge fue web/package.json y se resolvió conservando scripts. | NO VERIFICADO | No hay artefacto del merge; web/package.json sí contiene test:payment-labels, test:fix-datos, p0-demo-real-contract y test:demo-real. HANDOFF-CIERRE.md:16-18. | No afirmar 'único conflicto' sin el registro del merge; documentar la resolución o borrar la afirmación. |
| G5 | El árbol de p0/final-cognitive está limpio. | VERIFICADO | git -C ../mercado-cero-rehearsal status --porcelain=v1 vacío; rama p0/final-cognitive. | Sin cambio. |
| G6 | p0/sin-ia, p0/cierre-cognitivo, p0/preferencias y p0/verdad-pago están dentro de p0/final-cognitive. | VERIFICADO | git merge-base --is-ancestor <rama> p0/final-cognitive exit 0 para las cuatro. HANDOFF-CIERRE.md:124-125. | Sin cambio. |
| G7 | p0/cognitive-integration está obsoleta y no debe mergearse. | VERIFICADO | No es ancestro de final (merge-base --is-ancestor exit 1); git diff --stat final..cognitive-integration = 22 archivos, 205 inserciones y 3898 borrados netos. HANDOFF-CIERRE.md:122-123. | Archivar la rama; no mergear. |
| G8 | master ya contiene p0/final-cognitive (DoD 1). | FALSO | master = d35c791; final = b7154ca; git merge-base --is-ancestor p0/final-cognitive master exit 1. HANDOFF-CIERRE.md:158. | Hacer el ff-only y volver a verificar; hoy no se cumple. |
| B1 | Build PASS sobre el código de app e6f3107. | VERIFICADO | ../mercado-cero-rehearsal/web/.next/BUILD_SHA = e6f3107..., builtAt 2026-11-03T02:49:21Z; GET :3302/api/health -> buildSha e6f3107. HANDOFF-CIERRE.md:19-20. | Etiquetarlo como build pre-final; no vale como build del HEAD final. |
| B2 | La preview actual es :3230 con build 397039d y DB %TEMP%\opencode\cognitive-final-preview.db. | VERIFICADO | GET :3230/api/health -> 397039d; proceso next start :3230 desde mercado-cero-design-structure; archivo DB existe; GET https://involve-picking-wellness-retreat.trycloudflare.com/api/health -> 397039d. HANDOFF-CIERRE.md:27-29. | Sin cambio; no presentarla como final. |
| B3 | La preview no es el build final. | VERIFICADO | Preview buildSha 397039d; HEAD final b7154ca; :3302 build e6f3107. HANDOFF-CIERRE.md:120-121. | Sin cambio. |
| B4 | La preview tiene dos pendientes de ejemplo y un cobro pendiente de fixtures. | VERIFICADO | GET :3230/api/tasks -> total 2; GET :3230/api/dashboard -> pendingOrders.total 1 (demo_hist_pending_ord...), summary 190/70/120/50. HANDOFF-CIERRE.md:30. | Sin cambio. |
| B5 | Hay servidor final en :3000 desde HEAD y /api/health devuelve el SHA final. | FALSO | GET http://127.0.0.1:3000/api/health -> conexión rechazada; no hay .next/BUILD_SHA en el worktree supervisor; :3302 devuelve e6f3107, no b7154ca. HANDOFF-CIERRE.md:36,159. | Construir desde el HEAD exacto, arrancar :3000 y verificar buildSha === HEAD. |
| B6 | La preview pública sigue viva en involve-picking-wellness-retreat.trycloudflare.com. | VERIFICADO | GET https://involve-picking-wellness-retreat.trycloudflare.com/api/health -> HTTP 200, buildSha 397039d (uptime ~4950 s). | Sin cambio; es quick tunnel efímero. |
| B7 | El túnel timing-brought-lamp-aberdeen.trycloudflare.com de STATUS/RUNBOOK/STATE/QR sigue vigente. | FALSO | GET https://timing-brought-lamp-aberdeen.trycloudflare.com/api/health -> DNS no resuelve; demo/qr-demo.html contiene esa URL; GET involve... -> 200. demo/STATUS.md:9, RUNBOOK-DEMO.md:5, harness/STATE.md:12. | Cambiar a involve... y regenerar QR/PDF; no imprimir el QR actual. |
| C1 | harness/evidence/latest.json existe y es viejo (no del HEAD final). | VERIFICADO | En mercado-cero (master) existe latest.json: mode static, sha 0c052c4, dirty false, 15:36 local; en mercado-cero-rehearsal no existe latest.json ni latest-static.json. HANDOFF-CIERRE.md:118-119. | No copiarlo; generar full nuevo en el worktree final. Renombrar el static viejo a latest-static.json o borrarlo. |
| C2 | npm run verify:evidence PASS contra el HEAD final. | FALSO | node scripts/verify-evidence.mjs (desde web) exit 1: 'falta harness\evidence\latest-static.json'; no hay latest.json/latest-static.json en el worktree final. HANDOFF-CIERRE.md:161. | Correr full + verify:evidence después del build final; hoy no se cumple. |
| C3 | npm run verify:full -> 23/23, ok:true, dirty:false. | NO VERIFICADO | No hay latest.json full; en rehearsal solo runs fast 3/3 (02:52-02:54Z). HANDOFF-CIERRE.md:160. | Ejecutar full sobre :3000 construido desde HEAD y túnel vivo. |
| C4 | payment-truth-e2e.py -> 35/35 PASS. | NO VERIFICADO | El script solo imprime resultados y guarda screenshots en %TEMP%\opencode\verdad-pago; no hay JSON versionado ni log. HANDOFF-CIERRE.md:22. | Guardar stdout/JSON con SHA y buildSha; repetir en final. |
| C5 | sin-ia-e2e.py -> 21/21 PASS + 1 NOTE. | VERIFICADO | %TEMP%\opencode\sin-ia\sin-ia-e2e.json: ok true, passed 21, failed 0, notes 1, base :3303, generatedAt 2026-11-03T02:50:18Z; no incluye SHA. | Conservar el JSON y añadir SHA/buildSha; no está atado al HEAD final. |
| C6 | closing-checklist-e2e.py -> 18/18 PASS. | VERIFICADO | %TEMP%\opencode\cierre-cognitivo\closing-checklist-e2e.json: results 18, pass 18, baseUrl :3302, escrito 20:51:42; sin SHA. | Añadir SHA/buildSha al JSON; repetir sobre el build final. |
| C7 | companion-preferences-e2e.py -> 26/26 PASS. | VERIFICADO | harness/evidence/companion-preferences-e2e.json: pass 26, fail 0 (líneas 13-14); base :3305. | Sin cambio en el conteo. |
| C8 | La evidencia de companion-preferences es válida para el cierre. | FALSO | Mismo JSON: gitAtStart.sha e6f3107, dirty:true (líneas 8-10); HARNESS exige dirty:false y SHA del HEAD. HARNESS.md:205. | Reejecutar con árbol limpio sobre el HEAD final y dirty:false. |
| C9 | npm run verify:fast -> 3/3 PASS con árbol limpio en fe97c00. | VERIFICADO | mercado-cero-rehearsal/harness/evidence/runs/2026-11-03T02-54-12-125Z-fast.json: ok true, mode fast, sha fe97c00, dirty false, 3/3. | Sin cambio; repetir tras el commit final. |
| C10 | Los cuatro E2E cognitivos están atados al HEAD final. | FALSO | Solo companion tiene JSON (dirty e6f3107); sin-ia/closing están en %TEMP% sin SHA; payment-truth no tiene JSON. El catálogo full no los incluye. HARNESS.md:108. | Reejecutar los cuatro sobre el build final y persistir JSON con SHA/buildSha. |
| C11 | verify:full 23/23 cubre los E2E cognitivos. | FALSO | node scripts/harness-gate.mjs --list: 25 gates; full 23; no aparecen payment-truth, sin-ia, closing-checklist ni companion-preferences. | No inferir los E2E del full; correrlos aparte y anexar evidencia. |
| C12 | El catálogo actual es 25 gates; full 23 (24 con film). | VERIFICADO | node scripts/harness-gate.mjs --list -> 'Catálogo total: 25 gates'; full 23; HARNESS.md:108,204. | Sin cambio. |
| D1 | node scripts/preflight.mjs existe y la ruta del handoff es correcta (desde web). | VERIFICADO | web/scripts/preflight.mjs existe; web/package.json no tiene script preflight; d35c791 corrigió 'npm run preflight' a 'node scripts/preflight.mjs'. | Mantener; asegurar cwd web. |
| D2 | El preflight del handoff da 18/18 con $env:APP_URL y el reset. | FALSO | preflight.mjs:40 usa solo env de .env.local (env.APP_URL), no process.env.APP_URL; ejecución con BASE_URL=:3302 y APP_URL=involve -> falla 'APP_URL es HTTPS' y 'QR apunta al túnel actual'; además faltan mobile-audit.json, checkout-audit.json y tunnel-smoke.json -> 6/18. HANDOFF-CIERRE.md:64-76. | Poner APP_URL en web/.env.local (y DEMO_MODE=true) o cambiar preflight a process.env.APP_URL; generar los 3 artefactos antes del preflight. |
| D3 | closing-checklist-e2e.py exige :3302 y se niega a :3000/:3230. | VERIFICADO | web/scripts/closing-checklist-e2e.py:162 default :3302; :168-170 rechaza 3000/3230; listener :3302 PID 20460 build e6f3107. | Reusar el servidor existente o detenerlo antes de lanzar otro; no duplicar :3302. |
| D4 | Los scripts de video viven en p0/fix-video (c395e3e): record-demo.py, film-check.py, demo_ui.py. | VERIFICADO | git log -1 p0/fix-video = c395e3e; git cat-file -e p0/fix-video:web/scripts/demo_ui.py exit 0; versiones de record/film difieren del HEAD (879/465 líneas de diff). HANDOFF-CIERRE.md:106-107. | Integrar/cherry-pick esos scripts al carril final antes del build; no grabar desde una rama no incluida. |
| D5 | Se puede grabar desde el HEAD final usando DEMO_BASE_URL. | FALSO | web/scripts/record-demo.py:25 hardcodea BASE='http://localhost:3000' y no lee DEMO_BASE_URL; web/scripts/film-check.py:33 usa BASE_URL, no DEMO_BASE_URL; demo_ui.py no existe en HEAD. Solo la versión de p0/fix-video soporta DEMO_BASE_URL. | Cherry-pick c395e3e o copiar los tres scripts, commitear, rebuild y recién grabar. |
| D6 | El MP4 actual es histórico: 39.8 s, 1,704,744 B, 1280x800, UI vieja, $570. | VERIFICADO | ffprobe: duration 39.76 s, size 1,704,744 B, 1280x800, h264; frame a 26 s muestra 'Debería haber $570.00'. HANDOFF-CIERRE.md:112-113. | No presentarlo como final; regrabar con $550. |
| D7 | El checkout inexistente responde HTTP 200 (no 404). | VERIFICADO | GET :3230/pay/no-existe-xyz -> HTTP 200; GET :3302/pay/no-existe-xyz -> HTTP 200; body 19553 B. HANDOFF-CIERRE.md:128. | Corregir el status o listarlo como P0 conocido; no declarar 'sin P0/P1'. |
| D8 | No hay regla @media (forced-colors: active). | VERIFICADO | 0 coincidencias en todo web/src (*.css, *.tsx, *.ts). HANDOFF-CIERRE.md:129. | Implementar o mantener como P1 conocido. |
| D9 | A 320 px/200 % Fiar/Cobrar quedan bajo el pliegue. | NO VERIFICADO | Requiere navegador/zoom real; no se ejecutó computer use en este carril. HANDOFF-CIERRE.md:130. | Verificar con Playwright/computer use antes de afirmarlo. |
| D10 | No hay auth de sesión ni offline real. | VERIFICADO | 0 auth/middleware/rutas de sesión en web/src; 0 service workers en web (sin node_modules/.next); docs lo declaran (GOAL-CIERRE-DEMO.md:104, README.md:80). | Sin cambio; no prometer auth/offline. |
| D11 | El pago real de $0.01 está bloqueado por BBVA/CoDi. | NO VERIFICADO | Es una condición externa; no hay acceso al portal/banco en este carril. Docs consistentes (demo/STATUS.md:82, RUNBOOK-DEMO.md:3). | No afirmar el estado bancario sin fuente del operador; mantener 'no ejecutado'. |
| D12 | Computer use final sin P0/P1 (DoD). | FALSO | El propio handoff lista 404 HTTP 200, forced-colors ausente y 320/200% bajo el pliegue como no resueltos (HANDOFF-CIERRE.md:128-130), y el DoD pide 'sin P0/P1' (:165). | Corregir esos P0/P1 o cambiar el DoD a 'sin P0/P1 nuevos; conocidos listados'. |
| E1 | GOAL-CIERRE-DEMO parte de master 71bc4ed y dice que falta integrar p0/design-structure. | OBSOLETO | master = d35c791; p0/design-structure es ancestro de final (exit 0); GOAL-CIERRE-DEMO.md:3-4. | Actualizar a d35c791/b7154ca y marcar design-structure integrado. |
| E2 | El gate data son 123 checks. | FALSO | HARNESS.md:97 y demo/STATUS.md:49: 85 checks (58+20+7); GOAL-CIERRE-DEMO.md:21 dice 123. | Cambiar 123 por 85; verificar contra el gate antes de publicar. |
| E3 | La preview a reapuntar es techno-committees... | OBSOLETO | La preview viva es involve-picking... (HTTP 200 397039d); timing... no resuelve. GOAL-CIERRE-DEMO.md:86. | Actualizar el link y no prometer 'mismo link' si el túnel es efímero. |
| E4 | STATUS parte de 3fe1cc9 y el servidor :3000 es 665d72e. | OBSOLETO | HEAD b7154ca; :3000 no responde; :3230 397039d; :3302 e6f3107. demo/STATUS.md:3,15-16. | Actualizar SHA/servidor o marcar STATUS como histórico. |
| E5 | El túnel vigente en STATUS/RUNBOOK/STATE es timing-brought-lamp-aberdeen. | FALSO | DNS no resuelve; QR lo usa; la preview viva es involve... demo/STATUS.md:9, RUNBOOK-DEMO.md:5, harness/STATE.md:12, demo/qr-demo.html. | Reemplazar por involve... y regenerar QR/PDF. |
| E6 | Conservar PID 13932 y detener :3230 antes de la demo. | FALSO | PID 13932 es cloudflared -> localhost:3000 (servidor caído); la preview viva corre en :3230 (next PID 37272; túneles cloudflared PID 18952/32124) y es involve... demo/STATUS.md:88, RUNBOOK-DEMO.md:44-48. | No detener :3230 (next PID 37272) ni su túnel; reasignar/actualizar el PID 13932 y conservar la preview viva. |
| E7 | AUDITORIA-CARGA-COGNITIVA es la auditoría actual con archivo:línea. | OBSOLETO | Audita 499a301 (:3, :30); HEAD b7154ca difiere en 36 archivos, +6262/-579 (git diff --stat 499a301 b7154ca -- web/src web/scripts). HANDOFF-CIERRE.md:145 la llama actual. | Etiquetarla como snapshot 499a301 o re-auditar HEAD; no citar líneas como actuales. |
| E8 | README: F3 está desplegado en producción. | NO VERIFICADO | La única URL viva es un quick tunnel :3230 (397039d); no hay evidencia de deploy de producción. README.md:8. | Cambiar 'producción' por 'preview' o aportar evidencia del deploy. |
| E9 | .env.local no está trackeado y no hay secretos versionados. | VERIFICADO | git ls-tree -r HEAD solo muestra web/.env.example; git log --all -- web/.env.local = 0; web/.gitignore:34 ignora .env*. | Sin cambio; no leer .env.local. |
| E10 | Los docs no prometen auth, offline ni pago real. | VERIFICADO | GOAL-CIERRE-DEMO.md:28,104; demo/STATUS.md:5,21-22,82; RUNBOOK-DEMO.md:3,6,85; README.md:80,88,178,212 declaran demo/no auth/no offline/no pago real. | Sin cambio; corregir solo el 'producción' de README.md:8. |

## DoD del handoff, punto por punto

| DoD (`HANDOFF-CIERRE.md:158-165`) | Estado | Evidencia |
|---|---|---|
| `master` contiene `p0/final-cognitive`; árbol limpio | **FALSO** | `master = d35c791`; `git merge-base --is-ancestor p0/final-cognitive master` exit 1. El árbol sí está limpio. |
| `npm run build` desde HEAD; `/api/health` devuelve ese SHA | **FALSO** | `:3000` caído; build existente `e6f3107`; HEAD `b7154ca`. |
| `npm run verify:full` → 23/23, `ok:true`, `dirty:false` | **NO VERIFICADO** | No hay `latest.json` full; solo tres corridas `fast` en `runs/`. |
| `npm run verify:evidence` → PASS | **FALSO** | Exit 1 por falta de `latest-static.json`/`latest.json`. |
| E2E cognitivos PASS sobre el mismo build | **NO VERIFICADO** | Conteos parciales en `%TEMP%`; companion en `dirty:true`; payment-truth sin JSON. |
| Video/Stageshow finales con corte `$550` | **FALSO** | El MP4 versionado es histórico y muestra `$570`; no hay MP4 final ni manifiesto. |
| `demo/STATUS.md`/`RUNBOOK`/`GOAL` con SHA, URL y límites | **FALSO** | Siguen con `3fe1cc9`/`665d72e`, `71bc4ed`, túnel `timing...` muerto y `data 123`. |
| Preview final y computer use sin P0/P1 | **FALSO** | Preview `397039d`; 404 HTTP 200 y forced-colors ausente siguen abiertos; no se ejecutó computer use. |

## Lo que sí está verificado (para no sobredimensionar el fallo)

- La rama final y el worktree existen y están limpios; el ff-only es posible.
- Los cuatro carriles cognitivos están integrados; `p0/cognitive-integration` no lo está y no debe mergearse.
- El build `e6f3107` es real, está sano y sirve `:3302`; el código de app es idéntico a `b7154ca` (`git diff --name-only e6f3107 b7154ca -- web` vacío).
- La preview `397039d` está viva y tiene los datos de ejemplo esperados: 2 tareas, 1 cobro pendiente, ventas `$190`, demo `$70`, pendiente `$120`, fiado `$50`.
- `verify:fast` 3/3 con árbol limpio en `fe97c00` está documentado en `runs/2026-11-03T02-54-12-125Z-fast.json`.
- Los conteos de `sin-ia` (21/0/1) y `closing` (18/18) existen en JSON temporales; companion tiene 26/26 en el JSON versionado.
- El MP4 histórico está bien descrito: 39.76 s, 1,704,744 B, 1280x800 y `$570` en el frame del corte.
- `.env.local` nunca estuvo trackeado; solo está `web/.env.example`. Los docs no prometen auth, offline ni pago real.

## Lo que no se pudo verificar

- `payment-truth-e2e.py` 35/35: no deja JSON ni log; solo screenshots en `%TEMP%`.
- `closing` y `sin-ia` atados al SHA: sus JSON no declaran commit/buildSha.
- `320 px/200 %` Fiar/Cobrar bajo el pliegue: requiere navegador/computer use.
- Pago real bloqueado por BBVA/CoDi y pruebas humanas/TalkBack/VoiceOver: condiciones externas.
- `README.md:8` "desplegado en producción": no hay evidencia de deploy de producción; la URL viva es un quick tunnel.

## Reproducción mínima

```powershell
cd "C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero-supervisor"
git rev-parse HEAD
git merge-base --is-ancestor master p0/final-cognitive; $LASTEXITCODE
git rev-list --count p0/final-cognitive..master
git -C ..\mercado-cero-rehearsal status --porcelain=v1
Invoke-RestMethod http://127.0.0.1:3230/api/health
Invoke-RestMethod http://127.0.0.1:3302/api/health
Invoke-RestMethod https://involve-picking-wellness-retreat.trycloudflare.com/api/health
cd web
node scripts/verify-evidence.mjs
node scripts/harness-gate.mjs --list
```

> Este informe no se auto-referencia: el hash del commit que lo contiene se reporta en la respuesta final y con `git log -1 --format=%H` en `p0/supervisor`.
