# FINAL-CLOSURE — Mercado Cero

> **Entregado antes del full.** Este documento describe el estado de cierre, los
> comandos y los knowns. **No declara 23/23 por sí mismo**: el full se ejecuta
> sobre este HEAD y la fuente de verdad es `harness/evidence/latest.json`
> validado con `npm run verify:evidence`.
>
> **Fecha:** 3 de noviembre de 2026 (America/Mexico_City).
> **Worktree:** `mercado-cero-final-closure`.
> **Rama:** `p0/final-closure`.
> **Código base:** `3bf0482` (`feat(demo): grabar video final de la UI
> definitiva`), que incluye el video final y los scripts de demo.
> **HEAD de docs:** `git rev-parse HEAD` (este commit). Se confirma con git; no
> se hardcodea para no declarar un SHA falso.
> **`master`:** `3bf0482` al redactar; el ff-only se hace solo si full y
> evidencia pasan.

## 1. Estado de cierre

| Área | Estado |
|---|---|
| Código de app | Congelado en `3bf0482`; no se modifica en este cierre. |
| Video final | ✅ `demo/mercado-cero-demo.mp4` — 183.72 s, 5,406,880 B, 1280×800, H.264; corte **$550.00/Cuadra**; 8 frames; `FILM OK`. SHA-256 `ba4d068e…`. |
| UX final | ✅ `FINAL-UX-REPORT.md` — **PASS 99/0**, 4 knowns, **sin P0/P1 nuevos**. |
| P0/P1 de dinero | ✅ Reset 409, caché privada, webhook demo `demo_paid`, verify con referencias y totales honestos. |
| Docs | ✅ `HANDOFF-CIERRE.md`, `RELEVO-VERIFICADO.md`, `demo/STATUS.md`, `RUNBOOK-DEMO.md`, `harness/STATE.md`, este documento. |
| Full 23/23 | ⏳ **pendiente de ejecutar sobre este HEAD**; la fuente será `harness/evidence/latest.json`. |
| Evidencia PASS | ⏳ **pendiente** de `npm run verify:evidence`. |
| `master` ff | ⏳ **pendiente** de que full/evidencia pasen. |
| Preview `:3230` | **No se toca.** |

**Cierre técnico pendiente de full.** Los P0 están corregidos; lo que falta es
producir la evidencia del HEAD y avanzar `master`.

## 2. Qué incluye este HEAD

- App final `3bf0482` (sin cambios de `web/src` respecto de `791b590`; el
  commit del video solo añade demo/scripts/docs).
- Video final con la UI definitiva y corte $550/Cuadra.
- 8 frames versionados en `demo/stageshow/`.
- Reporte UX final copiado a `FINAL-UX-REPORT.md`.
- Handoff y runbook actualizados con URL, knowns y comandos de cierre.

## 3. Comandos de cierre

### 3.1 Preparar entorno (ignorado, no versionar)

`web/.env.local`:

```text
DEMO_MODE=true
APP_URL=https://auction-margaret-mapping-deputy.trycloudflare.com
OPENAI_API_KEY=
DATABASE_PATH=C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\final-closure.db
```

### 3.2 Detener el `:3000` de otro worktree y reconstruir

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3000 | Select OwningProcess
Stop-Process -Id <PID>

cd "C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero-final-closure\web"
npm ci
npm run build
npx next start -H 127.0.0.1 -p 3000
```

`/api/health` debe devolver `buildSha === git rev-parse HEAD`. La preview
`:3230` no se detiene ni se modifica.

### 3.3 Reset, preflight y full

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:3000/api/demo/reset `
  -ContentType 'application/json' -Body '{}'
node scripts/preflight.mjs

$env:DATABASE_PATH="C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\final-closure.db"
$env:BASE_URL="http://127.0.0.1:3000"
npm run verify:full       # 23/23, sin --skip/--only
npm run verify:evidence   # PASS contra HEAD
```

Si faltan `demo/mobile-audit.json`, `demo/checkout-audit.json` o
`demo/tunnel-smoke.json`, se generan con:

```powershell
python scripts/mobile-audit.py
python scripts/checkout-audit.py
python scripts/tunnel-smoke.py
```

El full también los genera antes de su gate `preflight`.

### 3.4 Criterios de éxito

- `verify:full`: **23/23**, `ok:true`, `partial:false`, `dirty:false`,
  `buildSha === HEAD`, sin `missing`/`criticalMissing`, con `latest.json`.
- `verify:evidence`: **PASS** contra HEAD, árbol limpio y artefactos con hash.
- `/api/health` devuelve el SHA del HEAD.
- Los gates runtime comparten `serverBuildSha === HEAD`.

### 3.5 Fast-forward de master (solo si 3.4 pasa)

```powershell
git -C ..\mercado-cero merge --ff-only p0/final-closure
git -C ..\mercado-cero rev-parse HEAD
```

Después, copiar al worktree master `harness/evidence/latest.json` y los
artefactos ignorados necesarios (mobile, checkout, tunnel, p0, etc.) para que
`verify:evidence` también pase allí, sin versionar archivos generados.

## 4. Knowns restantes

### UX / producto

- **Fiar/Cobrar bajo el pliegue en móvil** (320×640, 360×800 y 200 %): la
  acción principal requiere scroll corto; no hay overflow horizontal.
- **TTS dinámico 503** en este entorno: el texto sí aparece; los audios fijos
  del guion se sirven bien. No es error JS.
- **Efectivo demo vs Actividad:** una venta manual demo se rotula “Efectivo
  recibido” en Actividad y suma a “Pago demo (simulado)”; no se presenta como
  cobrado real.
- **“Ahora no” es por sesión:** “Antes de cerrar” reaparece al recargar o en
  otra pestaña; es intencional.
- **Túnel efímero:** el link/QR depende de
  `https://auction-margaret-mapping-deputy.trycloudflare.com`; si cambia,
  regenerar `APP_URL`, QR y PDF.

### Límites heredados

- **P1-2 — sin auth de sesión:** solo CSRF, rate limit y token de reset; no
  presentar la demo pública como protegida.
- **P1-4 — 404 de checkout:** `/pay/no-existe` y `/success` devuelven HTTP 200
  (comprobado el 3 nov 2026); el body muestra “No encontramos este cobro”.
- **P2-1/P2-2/P2-3/P2-5/P2-6/P2-7:** consumidores de preferencias, copy de
  “Esperando confirmación”, success de fiado saldado, `forced-colors`,
  atomicidad multi-proceso de `/api/demo/pay` y README “producción”.
- **Sin pago real:** no hubo pey/CoDi; demo `demo_paid`; el efectivo se
  registra `paid` al crear la venta.
- **Sin pruebas humanas:** 0/6–8 comerciantes; sin TalkBack/VoiceOver ni
  teléfono físico; el 200 % es inyección de `font-size`, no zoom real.

## 5. Qué no hacer

- No cambiar código de app en este cierre.
- No tocar `:3230` ni la preview.
- El merge queda pendiente de full/evidencia.
- No editar docs/tests después de la evidencia: cambia el SHA y obliga a
  reconstruir y repetir todo.
- No declarar 23/23 sin `latest.json` y `verify:evidence` PASS.
