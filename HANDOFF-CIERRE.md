# Handoff — cierre de Mercado Cero

> **Lee esto primero.** No abras carriles nuevos ni agregues producto. El objetivo
> es mergear, verificar y grabar. Fecha: 2 nov 2026.

> **⛔ NO MERGEAR TODAVÍA.** La supervisión independiente (`p0/supervisor`,
> `ca3f95c`) y la auditoría adversaria (`p0/adversarial`, `3939133`) encontraron
> 13 afirmaciones falsas/obsoletas en este handoff y **2 P0**: el reset de demo
> puede borrar un pago firmado de pey, y `/` se sirve con caché pública aunque
> contiene datos privados. No avanzar `master` hasta integrar
> `p0/fix-adversarial` y leer `RELEVO-VERIFICADO.md`.

## 0. Estado en una frase

La app integrada ya tiene la venta manual sin IA, el cierre acompañado
(“Antes de cerrar”), las preferencias de acompañamiento y la verdad de pago
demo/verificado/pendiente. **Falta mergear, correr el full y grabar el video.**

## 1. Lo que ya está hecho y verificado

- Rama final: **`p0/final-cognitive`** (worktree `mercado-cero-rehearsal`).
  Contiene `master b5c59e1` + diseño estructural + los carriles cognitivos.
- El merge final se resolvió. **Único conflicto:** `web/package.json` (scripts);
  se conservaron `test:payment-labels`, `test:fix-datos` con
  `p0-demo-real-contract` y `test:demo-real`.
- **Build PASS** sobre el código de app `e6f3107`:
  `BUILD SHA e6f310739622b8905bd025875abfce7b04322380`.
- E2E sobre ese build:
  - `payment-truth-e2e.py` → **35/35 PASS**
  - `sin-ia-e2e.py` → **21/21 PASS + 1 NOTE**
  - `closing-checklist-e2e.py` → **18/18 PASS**
  - `companion-preferences-e2e.py` → **26/26 PASS**
- `npm run verify:fast` → **3/3 PASS** con árbol limpio (commit `fe97c00`).
- Preview actual (no es el build final):
  **https://involve-picking-wellness-retreat.trycloudflare.com**
  → `:3230`, build `397039d`, DB `%TEMP%\opencode\cognitive-final-preview.db`.
- La preview tiene dos pendientes de ejemplo y el cobro pendiente de fixtures.

## 2. Lo que falta, en orden

1. **Revisar y avanzar master** a `p0/final-cognitive` (fast-forward; master es
   ancestro). No hay merge que resolver.
2. **Build final** desde ese HEAD, servidor `:3000` desde HEAD, DB demo
   reseteada, `preflight`.
3. **Docs antes del full:** `demo/STATUS.md`, `RUNBOOK-DEMO.md`,
   `GOAL-CIERRE-DEMO.md` con SHA, URL, video y límites. Si cambia el SHA, el full
   va después de ese commit.
4. **Full 23/23** + `verify:evidence` sobre el mismo HEAD.
5. **Video final** con la UI y el corte $550; no usar el MP4 viejo.
6. **Preview final** desde el build de master; mismo link o túnel nuevo.
7. **Computer use final** sobre ese build.

## 3. Comandos exactos (PowerShell)

```powershell
cd "C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero"
git status --short
git merge-base --is-ancestor master p0/final-cognitive   # debe salir 0
git checkout master
git merge --ff-only p0/final-cognitive
git log --oneline -3

cd web
npm ci
npm run build
```

Servidor final (seguir `RUNBOOK-DEMO.md` para el entorno exacto):

```powershell
$env:DATABASE_PATH="$env:TEMP\opencode\demo-final.db"
$env:DEMO_MODE='true'
$env:APP_URL='https://TU-TUNEL.trycloudflare.com'
$env:OPENAI_API_KEY=''
npx next start -H 127.0.0.1 -p 3000
```

Reset + preflight:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:3000/api/demo/reset `
  -ContentType 'application/json' -Body '{}'
node scripts/preflight.mjs
```

Full y evidencia:

```powershell
npm run verify:full       # 23/23, sin --skip/--only
npm run verify:evidence   # PASS, latest.json del HEAD
```

E2E cognitivos (repetir sobre el build final):

```powershell
python scripts/payment-truth-e2e.py
python scripts/sin-ia-e2e.py
python scripts/companion-preferences-e2e.py

# closing-checklist necesita un servidor ya levantado en :3302:
$env:DATABASE_PATH="$env:TEMP\opencode\closing-final.db"
$env:DEMO_MODE='true'
npx next start -p 3302
python scripts/closing-checklist-e2e.py
```

> Los E2E de pago, sin-ia y preferencias levantan su propio servidor aislado.
> `closing-checklist-e2e.py` exige `:3302` y se niega a correr contra
> `:3000`/`:3230`.

## 4. Video final

- Los scripts viven en la rama **`p0/fix-video`** (`c395e3e`):
  `web/scripts/record-demo.py`, `film-check.py`, `demo_ui.py`.
- Grabar **después** del merge/build final, con `DEMO_BASE_URL` apuntando al
  servidor final y DB demo reseteada.
- Verificar: Caja “¿Qué vendiste?”, corte **$550**, “Cuadra”, duración y
  frames/Stageshow.
- El `demo/mercado-cero-demo.mp4` actual es **histórico** (UI vieja, $570).
  No presentarlo como final.
- Commitear MP4/Stageshow solo cuando sea el definitivo.

## 5. Qué no creer / qué no está hecho

- **`harness/evidence/latest.json` es viejo** (no es del HEAD final). El full
  final lo reemplaza.
- **La preview no es el build final**: sirve `397039d`, no el merge
  `e6f3107`/`fe97c00`.
- **`p0/cognitive-integration` está obsoleta**; no mergear. La buena es
  `p0/final-cognitive`.
- Los carriles `p0/sin-ia`, `p0/cierre-cognitivo`, `p0/preferencias` y
  `p0/verdad-pago` ya están dentro de `p0/final-cognitive`; **no re-mergear**.
- P0/P1 que siguen sin resolverse y no se deben afirmar:
  - `404` de checkout: HTTP 200 por Next 16 + Cache Components (la UI es
    correcta; el status no).
  - `forced-colors`: no hay regla `@media (forced-colors: active)`.
  - A 320 px/200 % Fiar/Cobrar quedan bajo el pliegue (alcanzables por scroll).
  - Pago real $0.01 bloqueado por BBVA/CoDi; demo `demo_paid`.
  - Sin auth de sesión; rate limit/IP en memoria; túnel quick efímero.
  - Sin offline real, exportación, motor completo de recomendaciones,
    proveedores/inventario, consentimiento de voz completo ni corrección/anulación
    de venta.
  - Sin TalkBack/VoiceOver, teléfono físico ni estudio con 4–8 comerciantes.
  - No afirmar reducción de estrés/carga sin estudio.

## 6. Dónde consultar

| Archivo | Para qué |
|---|---|
| `GOAL-CIERRE-DEMO.md` | DoD, fases, orden de cierre y límites |
| `GOAL-ACOMPANAMIENTO.md` | Contrato de carga cognitiva y acompañamiento |
| `AUDITORIA-CARGA-COGNITIVA.md` | Auditoría actual con `archivo:línea` y P0/P1 |
| `docs/CARGA-COGNITIVA.md` | Resumen operativo del contrato |
| `HARNESS.md` | Gates, evidencia y reglas del full |
| `RUNBOOK-DEMO.md` | Entorno, túnel, reset, QR/PDF y operación |
| `demo/STATUS.md` | Estado de demo y cifras |
| `sin-ia-report.md` | Venta manual, borrador y consultas locales |
| `cierre-cognitivo-report.md` | “Antes de cerrar” |
| `verdad-pago-report.md` | Estados, demo, success y cifras |
| `preferencias-report.md` | “¿Cómo quieres que te ayude?” |
| `cognitive-audit-report.md` | Resumen de la auditoría |

## 7. Definición de terminado

- [ ] `master` contiene `p0/final-cognitive`; árbol limpio.
- [ ] `npm run build` desde HEAD; `/api/health` devuelve ese SHA.
- [ ] `npm run verify:full` → 23/23, `ok:true`, `dirty:false`.
- [ ] `npm run verify:evidence` → PASS.
- [ ] E2E cognitivos PASS sobre el mismo build.
- [ ] Video/Stageshow finales con corte $550.
- [ ] `demo/STATUS.md`/`RUNBOOK`/`GOAL` con SHA, URL y límites.
- [ ] Preview final y computer use sin P0/P1.
