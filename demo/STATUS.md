# Estado de demo — 2 de noviembre de 2026

> **Corte de estado (23:10, revisado):** rama de trabajo `p0/consolidacion`; `master` = `git rev-parse master` (al corte `3d8e6c8`, solo docs; ff-only a consolidación, **no ejecutado**). Build de código = `0d7251d`; `:3000` responde con ese build y el túnel público `auction...` lo sirve. El build de cierre se hace sobre el commit de docs; **no hay `latest.json` ni `full` atado al HEAD todavía**: cierre pendiente, no declarar listo.
>
> **P0/P1:** P0-1 (reset con pago pey firmado), P0-2 (`/` privado), P1-1 (webhook demo → `demo_paid`, fulfill 409), P1-3 (verify sin referencias) y P1-5 (totales honestos) están corregidos en `ac9e5a6`/`fabe7cc`. Siguen abiertos P1-2 (auth), P1-4 (404 HTTP 200) y varios P2. Detalle: `HANDOFF-CIERRE.md` §2.
>
> **Declaración honesta:** Estamos en modo demo: los pagos se simulan con `demo_paid`. No hubo pago real de $0.01; BBVA/CoDi sigue bloqueado. Solo el webhook firmado de pey marca `paid`. Las pruebas con comerciantes y lectores de pantalla están pendientes.
>
> **Video:** `demo/mercado-cero-demo.mp4` es **histórico** (39.8 s, 1,704,744 B, UI vieja, muestra $570). No es respaldo actual; se regrabará tras el rediseño. No borrar. Los scripts de `p0/fix-video` (`c395e3e`) **no están integrados** en HEAD.
>
> **Túnel vivo (2 nov 2026):** `https://auction-margaret-mapping-deputy.trycloudflare.com` — sirve `:3000` con build de código `0d7251d`; quick tunnel efímero. El túnel `timing-brought-lamp-aberdeen...` de este documento y del QR **no resuelve**. Si cambia la URL, regenerar `APP_URL`, QR y PDF.

## Cierre pendiente

| Campo | Valor |
|---|---|
| HEAD de la rama de trabajo | `git rev-parse HEAD`; al generar `0d7251d` (código) + docs pendientes |
| `master` | `3d8e6c8`; ancestro; ff-only a consolidación, no ejecutado |
| Build de código | `0d7251d`; el build de cierre se sella sobre el commit de docs |
| Servidor `:3000` | ✅ responde con `0d7251d` |
| Preview pública | `auction-margaret-mapping-deputy...`; sirve `:3000` con `0d7251d` |
| Evidencia atada al HEAD | ❌ pendiente: no hay `latest.json`; full no corrido contra el HEAD de docs |
| E2E adversario | ✅ 28/28 contra build `2a1f166` (código de app equivalente; no es evidencia de cierre) |
| E2E cognitivos | 35/35, 18/18, 21/21, 26/26 sobre `2a1f166`; no atados al HEAD de cierre |
| Video | histórico: 39.8 s, 1,704,744 B, UI vieja, $570; regrabar con $550 |
| Ensayo del guion | ✅ 3/3 corridas, 19/19 pasos, ~8.1 s (master `75179c7`, histórico) |
| Pruebas humanas | 0/6–8; TalkBack/VoiceOver y teléfono físico pendientes |
| Pago real | ❌ no hubo; BBVA/CoDi bloqueado; demo `demo_paid` |
| Veredicto | **Cierre pendiente**; P0 corregidos, full y operación final pendientes |

## Última corrida conocida — no prueba el HEAD

> Las cifras de esta tabla son la última corrida conocida del **2 nov 2026** o conteos del script. Los artefactos (mobile, checkout, motion, contraste, mobile-320, p0, rehearsal, tunnel, film) están ignorados y no están en este árbol. **No son evidencia del HEAD (base `fabe7cc` + docs) ni del servidor `:3000`** (que no existe). Para el cierre: build desde HEAD, `verify:full` y `verify:evidence`. El ensayo se corrió en master `75179c7`, histórico; no se usa como evidencia del HEAD.

| Check | Resultado | Evidencia |
|---|---|---|
| Build de producción | 🟡 última corrida conocida: limpio y con `BUILD_SHA` | `npm run build` |
| Servidor de producción | ❌ `:3000` no responde; no hay servidor del HEAD (base `fabe7cc` + docs) | `/api/health` devuelve `buildSha` |
| UI nueva “Mostrador claro” | ✅ F3 aprobado por verificación independiente | `VERIFICACION-F3-FINAL-5.md` |
| Preflight de demo | ❌ no ejecutable hoy: falta `APP_URL` en `.env.local` y `mobile-audit.json`, `checkout-audit.json`, `tunnel-smoke.json`; la última corrida conocida fue 18/18 | `node scripts/preflight.mjs` |
| Webhook firmado | 🟡 40/40, última corrida conocida (2 nov 2026) | `scripts/webhook-contract.mjs` |
| Verdad del comprobante | 🟡 demo nunca verificado, última corrida conocida | `scripts/verify-truth.mjs` |
| Auditoría HIG | 🟡 5 viewports (320/360/390/768/1280), axe 0, WCAG 2.2 AA, targets 48 px, 200% — última corrida conocida | `scripts/hig-after-audit.py` |
| 360 px caja | 🟡 25/25, última corrida conocida | `demo/mobile-audit.json` (generado, ignorado) |
| 320/360 px HIG | 🟡 42/42 PASS · 0 FAIL en Chromium/Firefox/WebKit — última corrida conocida | `harness/evidence/mobile-320-e2e.json` (generado, ignorado) |
| Flujo completo 360 px | 🟡 ≈9 s, 0 errores — última corrida conocida | `scripts/mobile-audit.py` |
| Checkout público 360 px | 🟡 19/19, última corrida conocida | `demo/checkout-audit.json` (generado, ignorado) |
| Túnel público | 🟡 8/8, última corrida conocida; repetir contra la URL vigente | `demo/tunnel-smoke.json` (generado, ignorado) |
| Ensayo del guion | ✅ 3/3 corridas, 19/19 pasos, ~8.1 s, `todo en verde: True` (master `75179c7`) | `demo/rehearsal.json` (generado, ignorado) |
| P0 venta durable | 🟡 65 PASS · 0 FAIL · 0 KNOWN — última corrida conocida | `scripts/p0-venta-e2e.py` |
| P0 fiado | 🟡 51 PASS · 0 FAIL · 0 KNOWN — última corrida conocida | `scripts/p0-fiado-e2e.py` |
| P0 corte no destructivo | 🟡 69 PASS · 0 FAIL · 0 KNOWN — última corrida conocida | `scripts/p0-corte-e2e.py` |
| P0 integración | 🟡 51 PASS · 0 FAIL · 0 KNOWN — última corrida conocida | `scripts/p0-integracion-e2e.py` |
| P0 dinero | 🟡 45 PASS · 0 FAIL · 3 KNOWN — el JSON del árbol es de `2ee1e81`, árbol sucio; no prueba HEAD | `harness/evidence/p0-dinero-e2e.json` |
| P0 adversario (reset/caché/demo/verify/totales) | ✅ 28/28 contra build `2a1f166`; sin `gitAtStart` ni `dirty` | `mercado-cero-rehearsal/harness/evidence/p0-adversarial-e2e.json` |
| P0 shell (carril aparte) | 🟡 68 PASS · 0 FAIL; HIG/axe 0 — última corrida conocida | `scripts/p0-shell-e2e.py` |
| Datos | 🟡 85 checks (58+20+7), `DATOS OK` — última corrida conocida | `npm run test:fix-datos` |
| Cobros pendientes / tareas | 🟡 franja, fechas, refresh, polling y quinto tab — última corrida conocida | `scripts/p0-integracion-e2e.py` |
| Carrera de refresco | 🟡 un poll viejo no revive el saldo cobrado — última corrida conocida | `scripts/p0-integracion-e2e.py` |
| Voz del abono de $50 | 🟡 Kokoro `em_santa`, dice “50 pesos”, 0 `speechSynthesis` — última corrida conocida | `VOZ-50-KOKORO.md` |
| Movimiento | 🟡 19/19 PASS · 0 FAIL; tabs/hojas/listas 140–300 ms, barrido ASLI, scroll trigger, reduced-motion — última corrida conocida | `MOTION.md` + `demo/stageshow/tab-wipe.mp4` |
| Reel de transiciones | 🟡 5.5 s, tabs + hoja de verificación — última corrida conocida | `demo/stageshow/tab-wipe.mp4` + `tab-wipe-sheet.png` |
| Harness static | 🟡 5/5 última corrida conocida; `latest.json`/`latest-static.json` **no existen** en este worktree | `harness/evidence/latest.json` |
| Harness full | ❌ no ejecutado contra HEAD; el catálogo actual es 25 gates y `full` son 23 (24 con film) | `harness/STATE.md` |
| Alto contraste | 🟡 7/7 PASS · 0 FAIL; axe 0, foco 3 px negro y 360 px sin overflow — última corrida conocida | `harness/evidence/a11y-contrast.json` (generado, ignorado) |
| Dirección visual | ✅ papel editorial, Manrope/Fraunces, doble marco, dos columnas desde 1280 | `HIG-DESIGN.md` §16 + `MOTION.md` |
| Video | ⚠️ **histórico**: 39.8 s, 1,704,744 B, UI vieja, muestra $570; regrabar tras el rediseño. No es respaldo actual | `demo/mercado-cero-demo.mp4` |
| Film check Stageshow | 🟡 8 beats + contact sheet + motion sheet — última corrida conocida; los sheets se generan y no se versionan | `demo/stageshow/` |
| QR imprimible | ❌ el HTML apunta a `timing-brought-lamp-aberdeen...`, que **no resuelve**; no imprimir. Regenerar con el túnel final | `demo/qr-demo.*` |
| Voz del demo | ✅ Kokoro `em_santa` para frases fijas + Piper es-MX dinámico | `web/public/tts/` |
| Accesibilidad | 🟡 texto grande, alto contraste, voz lenta, leer pantalla implementados; falta validación con personas y lectores | `verify-a11y` |
| Runbook | 🟡 actualizado 2 nov 2026; no probado en vivo | `RUNBOOK-DEMO.md` |
| Prueba de usuario | ❌ 0/6–8 ejecutadas; protocolo disponible | `TEST-USUARIO.md` |
| Guion narrado | 🟡 311 palabras + versión de 60 s; ensayo 3/3, 19/19, ~8.1 s | `GUION-3-MIN.md` |

## Amarillo

- Probar en un **teléfono físico** de 320/360 px; las auditorías actuales son Playwright.
- Prueba con **6–8 comerciantes** siguiendo `TEST-USUARIO.md`: **0/6–8 ejecutadas**.
- Faltan pruebas reales con **TalkBack/VoiceOver** en teléfono físico; la evidencia actual es Playwright + axe.
- El túnel vivo es un **quick tunnel efímero** y sirve la preview `397039d`, no la final. El túnel `timing...` del QR está muerto; hay que regenerar `APP_URL`, QR y PDF con el servidor final.
- La voz dinámica usa Piper es-MX; la primera frase puede tardar ~3 s si carga el modelo. Las frases fijas usan Kokoro `em_santa`.
- P0-D quedó verde (69/0), pero la migración está pensada para un solo proceso `next start`; si el despliegue es multi-proceso, mover la lectura del esquema dentro del lock. El 200 % es inyección de `font-size`, no zoom real.
- **Harness full pendiente:** el catálogo actual es 25 gates; `full` son 23 (24 con film) y no se corrió contra el HEAD (base `fabe7cc` + docs). Requiere servidor **construido desde HEAD** (`buildSha === gitAtStart.sha`) y túnel vivo.
- **Evidencia no atada al HEAD:** `:3000` no responde; el build conocido es `2a1f166`; `latest.json`/`latest-static.json` no existen en este worktree. La corrida de cierre sigue pendiente.
- Los artefactos de auditoría (mobile, checkout, motion, contraste, mobile-320, p0, rehearsal, tunnel, film) están ignorados por git y se regeneran con sus scripts; el QR y el video sí son entregables versionados. El MP4 es histórico y se regrabará.

## Rojo

- **Pago real de $0.01:** **no hubo pago real**. BBVA/CoDi se queda trabado al seleccionar cuenta. La app está en modo demo (`demo_paid`), el contrato del webhook está en 40/40 (última corrida conocida) y el ensayo pasó 19/19. Falta un banco/cuenta que funcione o las credenciales del hackathon.
- No se debe afirmar que el pago demo es real. El sello **DEMO** y el copy lo distinguen.
- **Matiz de `paid`:** el webhook firmado es el único camino `payment_pending → paid` para pagos digitales. El efectivo se crea directamente como `paid` (no pasa por `payment_pending`) y el demo usa `demo_paid`. `paid` también aparece en lecturas y en `payments.status` del efectivo. No afirmar “sin `paid` fuera del webhook” sin esta aclaración.

## Cómo arrancar (orden operativo)

1. **Limpieza:** conservar el servidor de demo en `:3000` cuando exista y la preview `:3230` (sirve `397039d`; **no la detengas** si vas a mostrar el link/QR actual). El `cloudflared` PID 13932 apunta a `:3000` (caído), no a la preview; no lo uses como túnel vigente. Detener solo servidores de gates/carriles que no estés usando. **No ejecutar esta limpieza desde el carril de docs.**
2. `cd web`
3. `npm run build`
4. `next start -H 127.0.0.1` (o `npm start -- -H 127.0.0.1`) en `:3000`.
5. Reiniciar demo: `POST /api/demo/reset` o el botón del header.
6. `node scripts/preflight.mjs` **después** del reset, con `APP_URL` en `.env.local` y los artefactos mobile/checkout/túnel generados.

Abrir `http://localhost:3000`. En `.env.local`, `DEMO_MODE=true` y `APP_URL=https://<túnel-vivo>` (el preflight lee `APP_URL` de ese archivo, no de `$env:APP_URL`). El build sella `BUILD_SHA`; `/api/health` lo devuelve. Para verificar que el servidor es de este commit:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

Para desarrollo con recarga:

```powershell
npm run dev
```

Para regenerar QR y PDF del túnel vigente:

```powershell
node scripts/make-demo-qr.mjs
python scripts/print-qr-pdf.py
```

Para re-grabar el video (pendiente; el MP4 existente es histórico y muestra la UI vieja):

```powershell
python scripts/record-demo.py
```

Para repetir la evidencia:

```powershell
python scripts/mobile-audit.py
python scripts/checkout-audit.py
python scripts/rehearse-demo.py
BASE_URL=http://localhost:3000 node scripts/webhook-contract.mjs
npm run verify:static
npm run harness:report
```
