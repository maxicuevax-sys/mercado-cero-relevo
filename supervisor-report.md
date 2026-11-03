# Supervisor report — Mercado Cero

> **Base supervisada:** `b7154caaa2185b2cafb44a02a6bf5f8b69bef045` (`p0/supervisor`, hijo de `master d35c791`).
> **Fecha:** 2 nov 2026, 21:38 -06.
> **Veredicto:** **NO LISTO / NO APTO PARA CIERRE**.
> **Tabla completa:** `SUPERVISION-RELEVO.md` (49 afirmaciones: 25 verificadas, 13 falsas, 5 obsoletas, 6 no verificadas).
> **Resumen máquina:** `supervision.json`.

## 1. Hash e identidad

| Objeto | Hash / valor |
|---|---|
| HEAD supervisado | `b7154caaa2185b2cafb44a02a6bf5f8b69bef045` |
| `master` | `d35c79136650f09597182cd24fde5d1078bc93fb` |
| Build de app pre-final | `e6f310739622b8905bd025875abfce7b04322380` (20:49) |
| Preview `:3230` / pública | `397039d212452b2950935d745cd8a1781040923e` |
| `latest.json` viejo (master) | SHA `0c052c4c4351e7224abce20acf15c3ad545fabc6`, `mode:static` |
| `HANDOFF-CIERRE.md` SHA-256 | `4402191FCCD7630BD591177ECD94FAFB5BC246D1A61C728AE358982CF149557C` |
| `companion-preferences-e2e.json` SHA-256 | `A7A80C87ABBFF7737F17747F23267E221484EC08602BCE2684418497D494C44D` |
| MP4 histórico SHA-256 | `C605F810D7B884C33A20C51110261B5B40F250B5E0268D52B24BD0A7A3403424` |
| `preflight.mjs` SHA-256 | `229531FC6B96466B184E7BDD67B479905D1C8EF787EA0A4943ECFE4B3BFB2BC2` |
| `record-demo.py` (HEAD) SHA-256 | `68B9C2A75EA8C1BF559B57BA235C85D54BCFB8B3170967C88F99AEA50A828634` |
| `film-check.py` (HEAD) SHA-256 | `1A9EF1B1E3E142072FA0C0E27B7CB7A31170469834E0A08EE2F1F62596692F63` |

El commit que contiene este informe no puede auto-referenciarse sin cambiar su propio hash; se reporta en la respuesta final y con:

```powershell
git -C "C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero-supervisor" log -1 --format=%H
```

## 2. Método

Fuentes primarias, sin confiar en el handoff ni en reportes de carril:

- **Git:** `rev-parse`, `merge-base --is-ancestor`, `rev-list --count`, `branch -vv`, `worktree list`, `status --porcelain`, `diff --stat`, `cat-file`, `log`.
- **HTTP:** `GET /api/health` en `:3000`, `:3230`, `:3302`; `GET /api/dashboard`, `/api/tasks`, `/api/cash`, `/api/goals` en `:3230`; `GET /api/health` en los dos túneles públicos; `GET /pay/no-existe-xyz` para el 404.
- **Archivos:** `HANDOFF-CIERRE.md`, `GOAL-CIERRE-DEMO.md`, `demo/STATUS.md`, `RUNBOOK-DEMO.md`, `HARNESS.md`, `harness/STATE.md`, `AUDITORIA-CARGA-COGNITIVA.md`, `README.md`, `harness/evidence/*`, `web/scripts/*`, `web/package.json`.
- **Evidencia local:** `harness/evidence/runs/*-fast.json`; JSON temporales de `closing` y `sin-ia`; JSON versionado de `companion`; screenshots de `payment-truth`.
- **Video:** `ffprobe` (duración, tamaño, resolución, códec) y extracción de frames a `%TEMP%` para leer `$570` en el corte.
- **Procesos:** `Get-CimInstance Win32_Process` y `Get-NetTCPConnection` para saber qué sirve `:3230`/`:3302` y a dónde apuntan los `cloudflared`.
- **No** se ejecutó build, `npm ci` ni `verify:full`; **no** se arrancaron/detuvieron servidores; **no** se modificó la app, `:3000`, `:3230` ni la preview.

## 3. Límites

1. El worktree `mercado-cero-supervisor` no tiene `node_modules`; no se corrieron gates que requieran dependencias.
2. `:3000` está caído; no se levantó porque este carril no debe tocar la app ni la preview.
3. Solo se hicieron lecturas HTTP; no se hizo `POST /api/demo/reset` ni se mutó ninguna DB.
4. No se usó navegador/computer use: el punto de 320 px/200 % queda **NO VERIFICADO**.
5. No hay acceso a BBVA/CoDi ni a pruebas humanas/TalkBack/VoiceOver: esos puntos quedan **NO VERIFICADOS**.
6. No se leyó `.env.local` ni ningún secreto; solo se comprobó que no está trackeado.
7. La preview observada es `397039d`, no el build final; sus datos y comportamiento no se extrapolan al HEAD.
8. Se consultó el estado de otros worktrees solo con `git status`/`Test-Path`; no se modificaron.
9. El estado puede cambiar: la supervisión es un corte a las 21:38 -06.

## 4. Veredicto

El handoff **no fabrica** los resultados que declara: el build `e6f3107` existe y responde, `verify:fast` 3/3 en `fe97c00` está en `runs/`, y los conteos de `sin-ia` (21/0/1), `closing` (18/18) y `companion` (26/26) existen en JSON. Tampoco exagera los límites: dice claramente que faltan merge, full, video y pruebas humanas.

Pero **no sirve como registro de cierre**:

- El build que existe es anterior al HEAD (`e6f3107` vs `b7154ca`); el código es idéntico, pero la regla de identidad del harness exige el SHA exacto.
- No hay `:3000` ni `latest.json` full en el worktree final; `verify:evidence` falla.
- El preflight del handoff no puede dar 18/18 con `$env:APP_URL`: el script lee `.env.local`, y además faltan tres artefactos.
- El túnel y el QR que usan STATUS/RUNBOOK/STATE están muertos; la limpieza documentada mataría la preview viva.
- Los E2E no están atados al HEAD y el full 23/23 no los cubre.
- El video final no existe y los scripts que lo graban no están en la rama final.
- Los docs de estado siguen en SHAs y conteos viejos; el DoD “sin P0/P1” contradice los P0/P1 que el propio handoff admite.

## 5. Diez hallazgos

### F1 — P0 — No hay build, servidor ni evidencia del HEAD final

`:3000` rechaza la conexión. El único build es `e6f3107` (20:49), anterior a `b7154ca` (20:56). El worktree final no tiene `latest.json` ni `latest-static.json`; `node scripts/verify-evidence.mjs` sale **1**. La DoD 1-4 no se cumple.

Evidencia: `GET :3000/api/health`; `../mercado-cero-rehearsal/web/.next/BUILD_SHA`; `verify-evidence.mjs`; `HANDOFF-CIERRE.md:158-161`.

### F2 — P0 — El preflight del handoff no puede dar 18/18

`preflight.mjs:40` usa `env.APP_URL` de `web/.env.local`, no `process.env.APP_URL`. Con el worktree final sin `.env.local`, el handoff exporta `$env:APP_URL` y aun así el script compara contra `http://localhost:3000`. Además exige `demo/mobile-audit.json`, `demo/checkout-audit.json` y `demo/tunnel-smoke.json`, ausentes. La ejecución de control con `BASE_URL=:3302` dio **6/18** (2 por `APP_URL`/QR, 3 por artefactos, 1 por la DB no demo).

Evidencia: `web/scripts/preflight.mjs:40,108-128`; `HANDOFF-CIERRE.md:64-76`.

### F3 — P0 — Túnel/QR muertos y limpieza que mata la preview

`timing-brought-lamp-aberdeen.trycloudflare.com` no resuelve; `demo/qr-demo.html` apunta ahí. La preview viva es `involve-picking-wellness-retreat.trycloudflare.com` (`397039d`). El PID 13932 que RUNBOOK manda conservar es `cloudflared --url http://localhost:3000` (servidor caído); la preview corre en `:3230` (next PID 37272; túneles cloudflared PID 18952/32124), y STATUS/RUNBOOK mandan detener `:3230`.

Evidencia: `GET` a ambos túneles; `Get-CimInstance Win32_Process` de `cloudflared`; `demo/STATUS.md:88`; `RUNBOOK-DEMO.md:44-48`; `harness/STATE.md:12`.

### F4 — P1 — El build SHA no coincide con el HEAD

`e6f3107` vs `b7154ca`. El código de app es idéntico (`git diff --name-only e6f3107 b7154ca -- web` vacío), pero `HARNESS.md:136,205` exige `serverBuildSha === gitAtStart.sha`. No se puede reutilizar el build para la evidencia final sin rebuild o sin cambiar la regla (no recomendado).

Evidencia: `.next/BUILD_SHA`; `GET :3302/api/health`; `HARNESS.md:205`.

### F5 — P1 — La evidencia E2E no está atada al HEAD

Solo `companion` tiene JSON versionado, y declara `dirty:true`/`e6f3107`. `sin-ia` y `closing` están en `%TEMP%` sin SHA. `payment-truth` no escribe JSON. El catálogo full (23 gates) no incluye ninguno de los cuatro E2E. Un full verde no prueba las afirmaciones cognitivas.

Evidencia: `harness/evidence/companion-preferences-e2e.json:8-10`; `%TEMP%\\opencode\\sin-ia\\sin-ia-e2e.json`; `%TEMP%\\opencode\\cierre-cognitivo\\closing-checklist-e2e.json`; `node scripts/harness-gate.mjs --list`.

### F6 — P1 — El pipeline de video vive fuera del carril final

`p0/fix-video` (`c395e3e`) no es ancestro de `p0/final-cognitive`. `demo_ui.py` no existe en HEAD; `record-demo.py:25` hardcodea `:3000` y no lee `DEMO_BASE_URL`; `film-check.py:33` usa `BASE_URL`. El MP4 versionado es histórico y muestra `$570`; no hay MP4 final ni `demo/record-demo.json`.

Evidencia: `git merge-base --is-ancestor p0/fix-video final` exit 1; scripts citados; `ffprobe` + frame a 26 s.

### F7 — P1 — Docs de estado obsoletos o contradictorios

`demo/STATUS.md` sigue en `3fe1cc9`/`665d72e`; `GOAL-CIERRE-DEMO.md` en `71bc4ed`, `data 123` y preview `techno`; `harness/STATE.md` en `3fe1cc9` y túnel muerto; `AUDITORIA-CARGA-COGNITIVA.md` audita `499a301`, no `b7154ca`. El handoff llama a esta última “auditoría actual”.

Evidencia: `demo/STATUS.md:3,15-16`; `GOAL-CIERRE-DEMO.md:3-4,21,86`; `harness/STATE.md:12,49-51`; `AUDITORIA-CARGA-COGNITIVA.md:3,30`; `HANDOFF-CIERRE.md:145`.

### F8 — P1 — El DoD “sin P0/P1” contradice P0/P1 conocidos

El handoff admite 404 HTTP 200, `forced-colors` ausente y 320/200% bajo el pliegue; el DoD pide computer use sin P0/P1. No se puede firmar así. El 404 se reprodujo en `:3230` y `:3302` (`/pay/no-existe-xyz` → 200).

Evidencia: `HANDOFF-CIERRE.md:128-130,165`; `GET /pay/no-existe-xyz`; 0 coincidencias de `forced-colors`.

### F9 — P2 — Higiene de git/worktrees

47 ramas y 48 worktrees; 4 punteros en `b7154ca` (`p0/final-cognitive`, `p0/adversarial`, `p0/context-recovery`, `p0/supervisor`); 4 ramas no mergeadas (`p0/cognitive-integration`, `p0/design-final`, `p0/fix-video`, `p0/perf-data`); `master` 23 commits detrás. `p0/cognitive-integration` no es ancestro y le faltan 3898 líneas netas; no mergear.

Evidencia: `git branch`, `git worktree list`, `git rev-list --count`, `git branch --no-merged final`.

### F10 — P2 — Evidencia vieja mal nombrada y artefactos citados ausentes

El `latest.json` del worktree master es `mode:static` de `0c052c4`, no un full; el worktree final no tiene latest. `demo/STATUS.md` cita `p0-dinero-e2e.json`, `mobile-audit.json`, `checkout-audit.json`, `tunnel-smoke.json` y `rehearsal.json`, todos ausentes. `README.md:8` afirma “desplegado en producción” sin evidencia; la URL viva es un quick tunnel.

Evidencia: `mercado-cero/harness/evidence/latest.json`; `demo/STATUS.md:47,55-56`; `README.md:8`.

## 6. Cinco correcciones urgentes

1. **Reconstruir desde el HEAD exacto y emitir evidencia.** Commitear docs/scripts, hacer `ff-only` de `master`, build desde ese SHA, arrancar `:3000`, reset, `verify:full` 23/23 y `verify:evidence` PASS. No reutilizar `e6f3107` ni `397039d`.
2. **Arreglar el preflight y su orden.** Poner `APP_URL` en `web/.env.local` (o leer `process.env.APP_URL`), generar `mobile-audit.json`, `checkout-audit.json` y `tunnel-smoke.json` antes del preflight, y verificar 18/18 real.
3. **Reemplazar túnel/QR y corregir la limpieza.** Usar `involve-picking-wellness-retreat.trycloudflare.com`, regenerar QR/PDF, no detener `:3230` y dejar claro que PID 13932 es `:3000`, no la preview.
4. **Integrar los scripts de video antes del build.** Traer `record-demo.py`, `film-check.py` y `demo_ui.py` de `p0/fix-video`, commitear, rebuild, grabar con `DEMO_BASE_URL`, verificar `$550`/Cuadra/manifiesto y commitear el MP4/Stageshow definitivos.
5. **Reejecutar los cuatro E2E y persistir JSON con SHA.** `payment-truth` debe escribir JSON; `closing`/`sin-ia` deben firmar SHA; `companion` debe dejar de estar `dirty`. Actualizar docs (SHA, URL, `data 85`) y resolver o declarar los P0/P1 conocidos antes de decir “sin P0/P1”.

## 7. Firma

- Informe basado en `b7154ca`; no se aplicaron cambios a `HANDOFF-CIERRE.md` ni al código.
- Archivos entregados: `SUPERVISION-RELEVO.md`, `CORRECCIONES-HANDOFF.md`, `supervisor-report.md`, `supervision.json`.
- Commit de entrega: ver `git log -1 --format=%H` en `p0/supervisor` (se reporta también en la respuesta final).
