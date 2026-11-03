# Estado de demo — 3 de noviembre de 2026

> **Corte de estado:** rama `p0/final-closure`, código base `3bf0482` (incluye
> el video final) + commit de docs; HEAD = `git rev-parse HEAD`. `master` sigue
> en `3bf0482` y el ff-only se hace **después** de que full/evidencia pasen.
> El `:3000` de otro worktree se detiene y se reconstruye desde este HEAD; la
> preview `:3230` **no se toca**.
>
> **Cierre técnico pendiente de full.** No hay `latest.json` todavía. El full y
> la evidencia se ejecutan sobre este HEAD; la fuente es
> `harness/evidence/latest.json`.
>
> **P0/P1:** P0-1 (reset con pago pey firmado → 409), P0-2 (`/` con caché
> privada), P1-1 (webhook demo → `demo_paid`, fulfill 409), P1-3 (verify con
> referencias) y P1-5 (totales honestos) están corregidos. Siguen abiertos
> P1-2 (auth de sesión) y P1-4 (404 de checkout devuelve HTTP 200). Detalle:
> `HANDOFF-CIERRE.md` §2.
>
> **UX final:** `FINAL-UX-REPORT.md` — **PASS 99/0**, sin P0/P1 nuevos; knowns:
> Fiar/Cobrar bajo el pliegue en móvil, TTS dinámico 503, efectivo demo vs
> Actividad, “Ahora no” por sesión y túnel efímero.
>
> **Video:** `demo/mercado-cero-demo.mp4` es el **video final** de la UI
> actual: 183.72 s, 5,406,880 B, 1280×800, H.264; corte **$550.00** y
> **Cuadra**; 8 frames y `FILM OK`. SHA-256
> `ba4d068e6da68c68263b9d9a96e4f451320260dfefaf4263e9213c812604bbd0`. Detalle:
> `video-final-report.md`.
>
> **Túnel vivo:** `https://auction-margaret-mapping-deputy.trycloudflare.com` —
> apunta a `:3000`; quick tunnel efímero. Si cambia la URL, regenerar `APP_URL`,
> QR y PDF.
>
> **Declaración honesta:** Estamos en modo demo: los pagos se simulan con
> `demo_paid`. No hubo pago real de $0.01; BBVA/CoDi sigue bloqueado. Solo el
> webhook firmado de pey marca `paid` en el camino digital. Las pruebas con
> comerciantes y lectores de pantalla están pendientes.

## Cierre pendiente

| Campo | Valor |
|---|---|
| Código base | `3bf0482` (video final incluido; sin cambios de `web/src`) |
| HEAD de docs | `git rev-parse HEAD` |
| `master` | `3bf0482` al redactar; ff-only a `p0/final-closure`, no ejecutado |
| Build de cierre | se sella al construir desde HEAD; `/api/health` debe devolverlo |
| Servidor `:3000` | se reconstruye desde este HEAD con DB temporal |
| Preview `:3230` | **no se toca** |
| Preview pública | `auction-margaret-mapping-deputy...`; apunta a `:3000` |
| Evidencia atada al HEAD | ❌ pendiente: `verify:full` + `verify:evidence` |
| Video | ✅ final: 183.72 s, 5,406,880 B, $550/Cuadra, 8 frames, `FILM OK` |
| UX | ✅ PASS 99/0; sin P0/P1 nuevos |
| Pruebas humanas | 0/6–8; TalkBack/VoiceOver y teléfono físico pendientes |
| Pago real | ❌ no hubo; BBVA/CoDi bloqueado; demo `demo_paid` |
| Veredicto | **Cierre técnico pendiente de full**; P0 corregidos y video/UX finales |

## Datos sembrados después del reset

Comprobado contra `/api/dashboard`, `/api/cash`, `/api/tasks` y `/api/goals`
tras el reset final de la pasada UX:

```text
Ventas de hoy:          $190.00
Cobrado confirmado:      $0.00
Por cobrar de hoy:      $120.00
Pago demo (simulado):    $70.00
Fiado:                   $50.00
Meta:                   $300.00 de $1,800.00
Corte: base $500.00 / esperado $500.00 / sin corte guardado
Pedidos: 15 · Pendientes: 1 · Créditos: 1 · Tareas: 0
```

El corte del video termina en **$550** porque el abono de Juan suma **$50 en
efectivo**: base $500 + $50 = $550. No confundir con el estado del reset
($500/$500).

## Última corrida conocida — histórica, no prueba este HEAD

> Las cifras de esta tabla son la última corrida conocida antes de este cierre
> (2 nov 2026) o conteos de scripts. Los artefactos están ignorados y se
> regeneran. **No son evidencia del HEAD** hasta que `verify:full` y
> `verify:evidence` pasen.

| Check | Resultado | Evidencia |
|---|---|---|
| Build de producción | ✅ `npm run build` limpio con `BUILD_SHA` | `npm run build` |
| Servidor de producción | 🔄 se reconstruye desde HEAD en `:3000` | `/api/health` |
| UI nueva “Mostrador claro” | ✅ F3 aprobado por verificación independiente | `VERIFICACION-F3-FINAL-5.md` |
| Preflight de demo | 🔄 se corre tras el reset; requiere `APP_URL` y 3 artefactos | `node scripts/preflight.mjs` |
| Webhook firmado | 🟡 40/40, última corrida conocida | `scripts/webhook-contract.mjs` |
| Verdad del comprobante | 🟡 demo nunca verificado, última corrida conocida | `scripts/verify-truth.mjs` |
| Auditoría HIG | 🟡 5 viewports, axe 0, WCAG 2.2 AA, targets 48 px, 200 % | `scripts/hig-after-audit.py` |
| UX final | ✅ PASS 99/0; 0 FAIL; 4 knowns; sin P0/P1 nuevos | `FINAL-UX-REPORT.md` |
| 360 px caja | 🟡 25/25, última corrida conocida | `demo/mobile-audit.json` |
| 320/360 px HIG | 🟡 42/42 PASS · 0 FAIL en 3 motores | `harness/evidence/mobile-320-e2e.json` |
| Flujo completo 360 px | 🟡 ≈9 s, 0 errores | `scripts/mobile-audit.py` |
| Checkout público 360 px | 🟡 19/19 | `demo/checkout-audit.json` |
| Túnel público | 🟡 8/8, repetir contra URL vigente | `demo/tunnel-smoke.json` |
| P0 venta durable | 🟡 65 PASS · 0 FAIL · 0 KNOWN | `scripts/p0-venta-e2e.py` |
| P0 fiado | 🟡 51 PASS · 0 FAIL · 0 KNOWN | `scripts/p0-fiado-e2e.py` |
| P0 corte no destructivo | 🟡 69 PASS · 0 FAIL · 0 KNOWN | `scripts/p0-corte-e2e.py` |
| P0 integración | 🟡 51 PASS · 0 FAIL · 0 KNOWN | `scripts/p0-integracion-e2e.py` |
| P0 dinero | 🟡 45 PASS · 0 FAIL · 3 KNOWN | `harness/evidence/p0-dinero-e2e.json` |
| P0 adversario (reset/caché/demo/verify/totales) | ✅ 28/28 contra build `2a1f166` | `p0-adversarial-e2e.json` |
| Datos | 🟡 85 checks (58+20+7), `DATOS OK` | `npm run test:fix-datos` |
| Movimiento | 🟡 19/19 PASS · 0 FAIL | `MOTION.md` |
| Harness static | 🟡 5/5 última corrida; `latest.json`/`latest-static.json` no existen | `harness/STATE.md` |
| Harness full | ❌ pendiente contra HEAD; catálogo 25, full 23 (24 con film) | `harness/STATE.md` |
| Alto contraste | 🟡 7/7 PASS · 0 FAIL | `harness/evidence/a11y-contrast.json` |
| Dirección visual | ✅ papel editorial, Manrope/Fraunces, doble marco | `HIG-DESIGN.md` §16 |
| Video | ✅ final: 183.72 s, 5,406,880 B, $550/Cuadra, 8 frames | `demo/mercado-cero-demo.mp4` + `video-final-report.md` |
| Film check Stageshow | ✅ `FRAMES 8/8`, `SHEET`, `FILM OK` | `demo/stageshow/` |
| QR imprimible | 🔄 regenerar con el túnel vigente si cambia | `demo/qr-demo.*` |
| Voz del demo | ✅ Kokoro `em_santa` fijo + Piper es-MX dinámico | `web/public/tts/` |
| Accesibilidad | 🟡 texto grande, alto contraste, voz lenta, leer pantalla; falta validación humana | `verify-a11y` |
| Runbook | 🟡 actualizado 3 nov 2026; no probado en vivo | `RUNBOOK-DEMO.md` |
| Prueba de usuario | ❌ 0/6–8 ejecutadas | `TEST-USUARIO.md` |
| Guion narrado | 🟡 311 palabras + versión de 60 s | `GUION-3-MIN.md` |

## Amarillo

- Probar en un **teléfono físico** de 320/360 px; las auditorías son Playwright.
- Prueba con **6–8 comerciantes** siguiendo `TEST-USUARIO.md`: **0/6–8**.
- Faltan pruebas reales con **TalkBack/VoiceOver** en teléfono físico.
- El túnel vivo es un **quick tunnel efímero**; si cambia, regenerar `APP_URL`,
  QR y PDF.
- La voz dinámica usa Piper es-MX; la primera frase puede tardar ~3 s. Las
  frases fijas usan Kokoro `em_santa`.
- P0-D quedó verde (69/0), pero la migración está pensada para un solo proceso
  `next start`; si el despliegue es multi-proceso, mover la lectura del esquema
  dentro del lock. El 200 % es inyección de `font-size`, no zoom real.
- **Harness full pendiente:** requiere servidor **construido desde HEAD**
  (`buildSha === gitAtStart.sha`) y túnel vivo.
- Los artefactos de auditoría están ignorados por git y se regeneran; el QR y
  el video sí son entregables versionados.

## Rojo

- **Pago real de $0.01:** **no hubo pago real**. BBVA/CoDi se queda trabado al
  seleccionar cuenta. La app está en modo demo (`demo_paid`).
- No se debe afirmar que el pago demo es real. El sello **DEMO** y el copy lo
  distinguen.
- **P1-4:** `/pay/no-existe` y `/pay/no-existe/success` devuelven **HTTP 200**;
  el body muestra “No encontramos este cobro”, pero el contrato HTTP no es 404.
- **P1-2:** no hay auth de sesión; no presentar la demo pública como protegida.
- **Matiz de `paid`:** el webhook firmado es el único camino
  `payment_pending → paid` para pagos digitales. El efectivo se crea
  directamente como `paid` (no pasa por `payment_pending`) y el demo usa
  `demo_paid`.

## Cómo arrancar (orden operativo)

1. **Limpieza:** detener el `:3000` actual (es de otro worktree); **no** tocar
   la preview `:3230`.
2. `cd web`
3. `npm ci`
4. `npm run build`
5. `npx next start -H 127.0.0.1 -p 3000` con
   `DATABASE_PATH=C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\final-closure.db`.
6. Reiniciar demo: `POST /api/demo/reset` o el botón del header.
7. `node scripts/preflight.mjs` **después** del reset, con `APP_URL` en
   `.env.local` y los artefactos mobile/checkout/túnel generados.

Abrir `http://localhost:3000`. En `.env.local`, `DEMO_MODE=true` y
`APP_URL=https://auction-margaret-mapping-deputy.trycloudflare.com` (el
preflight lee `APP_URL` de ese archivo, no de `$env:APP_URL`). El build sella
`BUILD_SHA`; `/api/health` lo devuelve.

Para verificar que el servidor es de este commit:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

Para regenerar QR y PDF del túnel vigente:

```powershell
node scripts/make-demo-qr.mjs
python scripts/print-qr-pdf.py
```

Para re-grabar el video y las hojas (servidor aislado, sin usar `:3000`):

```powershell
$env:DEMO_BASE_URL="http://127.0.0.1:3310"
python scripts/record-demo.py
python scripts/film-check.py
```

`DEMO_OUT_DIR` es opcional; sin él escribe en `demo/`. El script exige el corte
**$550.00** y **Cuadra**, y falla con screenshot + `record-demo-error.json` si
no aparecen.

Para repetir la evidencia:

```powershell
python scripts/mobile-audit.py
python scripts/checkout-audit.py
python scripts/rehearse-demo.py
BASE_URL=http://localhost:3000 node scripts/webhook-contract.mjs
npm run verify:full
npm run verify:evidence
npm run harness:report
```
