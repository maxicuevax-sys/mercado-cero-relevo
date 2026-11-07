# Handoff — cierre de Mercado Cero

> **Fecha:** 3 de noviembre de 2026 (America/Mexico_City).
> **Worktree:** `mercado-cero-final-closure` — rama `p0/final-closure`.
> **Código base:** `3bf0482` (`feat(demo): grabar video final de la UI definitiva`),
> que incluye el video final y los scripts de grabación. Este HEAD añade el
> fix de etiquetado demo (P1), el wrapping de HIG y los docs/QR del túnel nuevo.
> **HEAD de docs:** el commit que contiene este archivo; se confirma con
> `git rev-parse HEAD`. No se hardcodea aquí para no declarar un SHA falso.
> **Estado:** **cierre técnico pendiente de full.** Los P0/P1 de dinero y el
> etiquetado demo están corregidos; el video/UX finales están integrados. El
> full y la evidencia se ejecutan sobre este HEAD; la fuente es
> `harness/evidence/latest.json`.
> **Regla:** no se mergea ni se declara listo hasta que `verify:full` y
> `verify:evidence` pasen sobre el mismo HEAD, con `dirty:false` y
> `buildSha === HEAD`.

## 0. Estado en una frase

La rama **`p0/final-closure`** contiene la app final (`3bf0482` + fix de
etiquetado demo/HIG + docs/QR), el **video final** (183.72 s, corte
**$550/Cuadra**, 8 frames, `FILM OK`), el reporte UX (**PASS 99/0**, sin P0/P1
nuevos) y estos documentos. `master` sigue en `3bf0482` y el fast-forward a esta
rama está pendiente de que full/evidencia pasen. `:3000` se reconstruye desde
este HEAD y el túnel `languages...` apunta a `:3000`; la preview `:3230` no se
toca.

## 1. SHAs y relación de ramas

Verifica siempre con git: el commit de docs cambia el HEAD.

| Objeto | Valor | Nota |
|---|---|---|
| Código base | `3bf0482` (`3bf04827833e89db17384b47a0162598f947a38f`) | Incluye el video final y los scripts; este HEAD añade fix de demo/HIG. |
| HEAD de docs | `git rev-parse HEAD` | Este documento vive en ese commit; es el SHA que se construye y verifica. |
| `master` | `3bf0482` al redactar | Ancestro de `p0/final-closure`; el ff-only se ejecuta **después** del full/evidencia. |
| `p0/final-closure` | `3bf0482` + fix de etiquetado/HIG + docs/QR | Rama entregable. |
| Build de cierre | `git rev-parse HEAD` | `npm run build` sella `BUILD_SHA`; `/api/health` debe devolver ese SHA. |
| Servidor local | `http://127.0.0.1:3000` | Se detiene el `:3000` de otro worktree y se reconstruye desde este HEAD. |
| Preview `:3230` | **no se toca** | Queda fuera de este cierre. |
| URL pública | `https://languages-native-greene-bit.trycloudflare.com` | Quick tunnel que apunta a `:3000`; si cambia, actualizar `APP_URL`, QR y PDF. |

**Video vs. código:** el MP4 se grabó con build `791b590`. Después se añadieron
el video, los frames y los docs (`3bf0482`), y en este HEAD un fix de
etiquetado demo (P1) y un wrapping CSS de HIG. Ninguno de esos fixes cambia el
guion, el corte ni el flujo de la demo; el video sigue siendo representativo de
la UI final. Si se exigiera un MP4 del HEAD exacto, habría que regrabarlo; no se
hizo.

## 2. P0/P1: qué está corregido

| ID | Estado | Evidencia verificada | Límite |
|---|---|---|---|
| **P0-1** reset con pago pey firmado | **Corregido** | `resetDemoData` responde 409 si existe cualquier pago `provider='pey' AND status='paid'`, aunque `demo=1`; el 409 no borra pedido ni pago y `FORCE` los conserva. Código: `web/src/lib/db.ts:2005-2085`; E2E adversario: 409, filas sobreviven, FORCE 200. | `preservedRealPayments` cuenta pedidos distintos con pago firmado, no filas de pago; para filas está `realPayments`. |
| **P0-2** `/` con caché pública | **Corregido** | `next.config.ts` aplica `private, no-store, max-age=0, must-revalidate` a `/`; runtime y UX lo comprobaron. | El HTML privado sigue en el primer paint; no hay auth de sesión. |
| **P1-1** webhook demo | **Corregido** | Un pago `demo=1` deja `demo_paid`; `fulfillOrder` responde 409 `demo_not_deliverable`; el resumen manda el demo al bucket `demoDigitalCents`. E2E: `demo_paid`, sin cambio en `verifiedDigitalCents`, fulfill 409. | El caso mixto demo/real en una misma orden no está cubierto por el E2E. |
| **P1-1b** etiquetado de webhook pey demo | **Corregido en este HEAD** | `Payment.demo`/`Order.lastPaymentDemo` viajan desde SQLite; checkout, success y Caja usan `demo=1` como demo; `/api/verify` responde `verified:false, source:demo, reason:demo_payment`; analytics separa `demoDigitalCents`. El gate `security` añade 6 checks (checkout HTML, success HTML, API verify, dashboard, analytics, datos). | La UI no usa un `verified` por orden; Caja se cubre por contrato de datos (`lastPaymentDemo`) y la hoja de resultado. |
| **P1-3** `/api/verify` sin referencias | **Corregido** | `hasReferenceMismatch` rechaza una transacción PAID sin `metadata.orderId`, `externalMetadata.orderId`, `clientReferenceId` ni `payableId`: `verified:false`/`reference_mismatch`; con la referencia correcta, `verified:true`. Código: `web/src/app/api/verify/route.ts:212-248`. | Validado con mock, no con payload real de pey. |
| **P1-5** totales/conteos truncados | **Corregido (honestidad, no paginación completa)** | `pendingCentsTotal`, `creditsOpenTotal`, `creditsCustomersTotal` y `creditsBalanceCents` salen del servidor; la UI declara el truncamiento ("50 de 52", "100 de 102 fiados") y muestra el total real. | No hay botón para cargar pendientes 51+ ni fiados 101+; los límites de API siguen en 100/200. |

### Knowns y límites heredados

- **P1-2 — auth de sesión: abierto.** No hay middleware/sesión; solo CSRF,
  rate limit y token de reset. `web/SECURITY.md` lo declara. No presentar la
  demo pública como protegida; Cloudflare Access es la única barrera externa.
- **P1-4 — 404 de checkout/success: abierto.** `GET /pay/no-existe` y
  `/pay/no-existe/success` devuelven **HTTP 200** (comprobado el 3 nov 2026 tras
  intentar mover `notFound()` antes de `connection()`/Suspense). El body sí
  muestra “No encontramos este cobro”. Next 16 + Cache Components mantiene el
  shell parcial; no se fuerza un 404 con proxy para no romper la página.
- **P2-1** “Recordatorios” y “Explicaciones” se guardan pero solo “Sugerencias”
  tiene consumidor; el E2E prueba persistencia, no efecto.
- **P2-2** “Antes de cerrar” puede decir “Esperando confirmación” a un pedido
  `confirmed` sin link y no avisa el truncamiento de 50 pendientes.
- **P2-3** el success de un fiado ya saldado sigue mostrando “Quedó a fiado”.
- **P2-5** no hay reglas `@media (forced-colors: active)`; no afirmar que
  forced-colors está cubierto.
- **P2-6** `/api/demo/pay` no es atómico multi-proceso; no reproducido.
- **P2-7** README sigue diciendo “desplegado en producción”; la única URL viva
  es un quick tunnel de preview.
- **P2-8** un parseo nuevo puede pisar el borrador recuperado sin confirmación.
- **P2-9** “¿Cuánto dinero hay en caja?” responde ventas/cobrado, no
  efectivo/base/gastos/retiros.
- **P2-10** a 320 px/200 % el nombre del comercio se trunca y el H1 del
  checkout queda topado; Fiar/Cobrar queda bajo el pliegue.
- **P2-11** exportación y offline no están implementados; `GOAL-ACOMPANAMIENTO`
  no se puede declarar cumplido completo (sí hay PASS P0 demo con reservas).
- **Sin pago real:** no hubo pago pey/CoDi; la verificación es de modo demo.
  El efectivo se registra `paid` al crear la venta; el demo usa `demo_paid`.

## 3. Verificaciones de cierre (carriles externos)

- **`p0/verify-cognitive` (`165eec2`)**: PASS P0 demo con reservas; **NO-GO**
  para declarar cumplido todo `GOAL-ACOMPANAMIENTO` (faltan exportación y
  offline). Knowns: “Antes de cerrar” etiqueta “Esperando confirmación” a
  `confirmed` sin link y no avisa truncamiento de 50; “Recordatorios” y
  “Explicaciones” solo persisten, no tienen efecto; un parseo nuevo puede pisar
  el borrador recuperado; “¿Cuánto dinero hay en caja?” responde ventas/cobrado,
  no efectivo/base/gastos/retiros.
- **`p0/verify-video-docs` (`2feb7ca`)**: video PASS. `RUNBOOK` ya cierra con
  **Cerrar demo** (no el copy de entrega real); docs actualizados sin video
  histórico ni SHAs viejos como estado actual.
- **`p0/verify-ops` (`100e338`)**: el túnel `auction...` y `timing...` están
  NXDOMAIN. Se levantó un quick tunnel nuevo
  (`https://languages-native-greene-bit.trycloudflare.com`, PID 32532) y se
  regeneraron QR/PDF; el `paymentUrl` del pendiente se re-siembra con `APP_URL`
  al reiniciar/resetear.
- **`p0/verify-security` (`10fb07a`)**: P1 de etiquetado demo corregido en este
  HEAD; el gate `security` cubre checkout/success/API verify/dashboard/analytics
  con un pago `pey` + `demo=1`.
- **`p0/verify-a11y` (`a127a0b`)**: 404 sigue en HTTP 200 (P1 conocido);
  `forced-colors` sin reglas (P2 conocido); Fiar/Cobrar bajo el pliegue y
  truncamiento a 320/200 % (P2 conocidos). El 200 % es inyección de `font-size`,
  no zoom real. `mobile-320` se actualiza a **60/60**, no 42/42.
- **Reintentos del full:** el primer full de `212408a` dio 21/23 por HIG (2
  recortes de 4 px en `paymentText200`) y `p0-venta` (timeout de Playwright).
  Ambos pasaron aislados; se añadió `break-words` al bloque de pago y se
  corrigió el etiquetado demo. El full definitivo se repite en el HEAD final.

## 4. Video final

| Artefacto | Valor |
|---|---|
| MP4 | `demo/mercado-cero-demo.mp4` |
| SHA-256 | `ba4d068e6da68c68263b9d9a96e4f451320260dfefaf4263e9213c812604bbd0` |
| Bytes | `5,406,880` |
| Duración | `183.72 s` (3:03.7) |
| Resolución / códec | `1280×800`, H.264, 25 fps |
| Frames | `demo/stageshow/01-caja-en-reposo.png` … `08-meta.png` (8) |
| Verificación | `python scripts/film-check.py` → `FRAMES 8/8`, `SHEET …`, `FILM OK` |
| Corte | **$550.00** y **Cuadra**; 5 × $100 + 1 × $50 + 0 × $20; `Corte #1` guardado |
| Meta | `$325.00` tras apartar `$25` |

Manifiesto de la grabación: `demo/record-demo.json` (15/15 checks; ignorado por
git). Contact/motion sheets en `demo/stageshow/` (generados, ignorados).
Detalle: `video-final-report.md`.

## 5. UX final

`FINAL-UX-REPORT.md` (copiado del carril `p0/final-ux`):

- **PASS 99/0**, 4 knowns, **sin P0/P1 nuevos**.
- Superficies: local y túnel público; Playwright/Chromium 320×640, 360×800,
  1280×1000 y texto al 200 %.
- Flujos verificados: salud/build/caché, Caja (parser 500, venta manual,
  borrador, consultas locales), Fiado (sin doble POST), Corte (“Antes de
  cerrar”, $550/Cuadra, no destructivo), pago demo/fulfill 409, checkout
  pendiente, preferencias y reset final.
- **Knowns UX:** Fiar/Cobrar bajo el pliegue en móvil; TTS dinámico 503 en este
  entorno; efectivo demo rotulado “Efectivo recibido” en Actividad; “Ahora no”
  solo por sesión; link/QR dependen del túnel efímero.
- **Salvedad:** 0 pageerrors y 0 errores de consola JS; los 4 errores de red son
  1 × 500 forzado por la prueba y 3 × 503 esperados de `/api/tts`.

## 6. Lo que falta, en orden

1. **Commit de código + docs + QR** (este trabajo). Ese commit es el HEAD
   final; cualquier build/full anterior deja de ser evidencia.
2. **`web/.env.local`** (ignorado, no versionar):
   `DEMO_MODE=true`, `APP_URL=https://languages-native-greene-bit.trycloudflare.com`,
   `OPENAI_API_KEY=` y
   `DATABASE_PATH=C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\final-closure.db`.
3. **Detener el `:3000` actual** (es de otro worktree) y reconstruir desde este
   HEAD: `npm ci`, `npm run build`,
   `npx next start -H 127.0.0.1 -p 3000` con la DB temporal.
4. **Reset demo** y `node scripts/preflight.mjs` → **18/18**. Los artefactos
   `mobile-audit.json`, `checkout-audit.json` y `tunnel-smoke.json` se generan
   con sus scripts o con el propio full antes de su gate `preflight`.
5. **Full** con `DATABASE_PATH` y `BASE_URL=http://127.0.0.1:3000` en el
   entorno: `npm run verify:full` → **23/23**, `ok:true`, `dirty:false`,
   `buildSha === HEAD`.
6. **Evidencia:** `npm run verify:evidence` → **PASS** contra `latest.json`.
7. **Solo si 5–6 pasan:** fast-forward de `master` a `p0/final-closure` desde el
   worktree master (`git -C ..\mercado-cero merge --ff-only p0/final-closure`)
   y copiar a ese worktree `harness/evidence/latest.json` y los artefactos
   ignorados necesarios para que `verify:evidence` también pase allí.
8. **No editar archivos después de la evidencia.** Un doc o test tocado después
   del full cambia el SHA y obliga a reconstruir y repetir full/evidencia.

## 7. Comandos de cierre (PowerShell)

```powershell
cd "C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero-final-closure"
git status --short
git rev-parse HEAD master

# Detener el :3000 de otro worktree (identifica el PID antes)
Get-NetTCPConnection -State Listen -LocalPort 3000 | Select OwningProcess
Stop-Process -Id <PID>

cd web
npm ci
npm run build
npx next start -H 127.0.0.1 -p 3000
```

En otra terminal:

```powershell
cd "C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero-final-closure\web"
Invoke-RestMethod -Method Post http://127.0.0.1:3000/api/demo/reset -ContentType 'application/json' -Body '{}'
node scripts/preflight.mjs

$env:DATABASE_PATH="C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\final-closure.db"
$env:BASE_URL="http://127.0.0.1:3000"
npm run verify:full       # 23/23, sin --skip/--only
npm run verify:evidence   # PASS contra HEAD
```

Solo después:

```powershell
git -C ..\mercado-cero merge --ff-only p0/final-closure
git -C ..\mercado-cero rev-parse HEAD
```

## 8. Definición de terminado

- [ ] `master` contiene la rama entregada (`p0/final-closure`) y apunta al
      mismo SHA; árbol limpio.
- [ ] `npm run build` desde HEAD; `/api/health` devuelve ese SHA.
- [ ] `npm run verify:full` → 23/23, `ok:true`, `dirty:false`,
      `buildSha === HEAD`; la fuente es `harness/evidence/latest.json`.
- [ ] `npm run verify:evidence` → PASS contra HEAD.
- [ ] Preflight 18/18 con `APP_URL` en `.env.local` y los tres artefactos.
- [ ] Túnel/QR apuntan al servidor final; `tunnel-smoke` 8/8.
- [ ] Video final con corte $550/Cuadra y `FILM OK`; frames versionados.
- [ ] UX PASS 99/0 sin P0/P1 nuevos; knowns listados y aceptados.
- [ ] P1 de etiquetado demo corregido y cubierto por el gate `security`;
      `mobile-320` 60/60; HIG completo en verde.
- [ ] 404 de checkout/success documentado como P1 conocido (HTTP 200).
- [ ] Docs sin SHA/URL/conteos falsos.
- [ ] Límites declarados: sin auth de sesión, sin pago real, sin
      TalkBack/VoiceOver ni estudio con comerciantes.

## 9. Qué no creer

- **“Ya hay full 23/23”** — no se declara aquí; se comprueba en
  `harness/evidence/latest.json` y `npm run verify:evidence`.
- **“La preview `:3230` es la final”** — no se toca en este cierre.
- **“El video es histórico”** — el MP4 actual es el final: 183.72 s, $550,
  Cuadra, 8 frames.
- **“El 404 de checkout está resuelto”** — `/pay/no-existe` y `/success`
  siguen devolviendo HTTP 200.
- **“Hay auth/offline/pago real/pruebas humanas”** — no.
- **“El túnel `timing...` sirve”** — no resuelve; el vigente es
  `languages-native-greene-bit.trycloudflare.com`.

## 10. Dónde consultar

| Archivo | Para qué |
|---|---|
| `FINAL-UX-REPORT.md` | Pasada UX final: PASS 99/0, knowns y capturas. |
| `video-final-report.md` | Grabación, hashes, frames y `FILM OK`. |
| `FINAL-CLOSURE.md` | Estado de cierre, comandos y knowns. |
| `RELEVO-VERIFICADO.md` | Página de entrada y qué no creer. |
| `demo/STATUS.md` | Estado de demo, cifras, video y límites. |
| `RUNBOOK-DEMO.md` | Operación, túnel, reset, QR/PDF y guion. |
| `harness/STATE.md` | Handoff del harness y estado de gates. |
| `HARNESS.md` | Catálogo real de 25 gates, full 23/24 y reglas de evidencia. |
| `AUDITORIA-ADVERSARIA.md` | Hallazgos originales (snapshot `b7154ca`). |
| `SUPERVISION-RELEVO.md` | Supervisión del handoff (snapshot `b7154ca`). |
| `context/` | Contexto recuperado (snapshot `b7154ca`/`ea1292e`). |
