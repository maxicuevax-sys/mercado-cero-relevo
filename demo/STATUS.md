# Estado de demo — 2 de noviembre de 2026

> **Corte de estado:** SHA de partida de esta rama (base auditada) `3fe1cc9` (`p0/fix-demo-docs`). El servidor de producción observado en `:3000` es `665d72e`, **no** la base. No hay `latest.json` en el árbol ni una corrida `full` atada a `3fe1cc9`: la evidencia está **pendiente**. **No declarar el cierre.**
>
> **Declaración honesta:** Estamos en modo demo: los pagos se simulan con `demo_paid`. No hubo pago real de $0.01; BBVA/CoDi sigue bloqueado. Solo el webhook firmado de pey marca paid. Las pruebas con comerciantes y lectores de pantalla están pendientes.
>
> **Video:** `demo/mercado-cero-demo.mp4` es **histórico** (39.8 s, 1,704,744 B, UI vieja, muestra $570). No es respaldo actual; se regrabará tras el rediseño. No borrar.
>
> **Túnel vigente (2 nov 2026):** `https://timing-brought-lamp-aberdeen.trycloudflare.com` — quick tunnel efímero. Si cambia, regenerar `APP_URL`, QR y PDF; el anterior deja de servir.

## Cierre pendiente

| Campo | Valor |
|---|---|
| SHA de partida | `3fe1cc9` (rama `p0/fix-demo-docs`; base auditada) |
| Servidor `:3000` | `665d72e` — build anterior, no coincide con la base |
| Evidencia atada a la base | ❌ pendiente (`latest.json` local no versionado; `full` no corrido contra `3fe1cc9`) |
| Video | histórico: 39.8 s, 1,704,744 B, UI vieja, $570; regrabar tras el rediseño |
| Ensayo del guion | ✅ 3/3 corridas, 19/19 pasos, ~8.1 s, todo en verde (master `75179c7`) |
| Pruebas humanas | 0/6–8; TalkBack/VoiceOver y teléfono físico pendientes |
| Pago real | ❌ no hubo; BBVA/CoDi bloqueado; demo `demo_paid` |
| Veredicto | **Cierre pendiente**; demo mode ejecutable, sin pago real |

## Última corrida conocida — no prueba el HEAD

> Las cifras de esta tabla son la última corrida conocida del **2 nov 2026**. Los artefactos (mobile, checkout, motion, contraste, mobile-320, p0, rehearsal, tunnel, film) están ignorados y no están en este árbol. No son evidencia de `3fe1cc9` ni del servidor `665d72e`. Para el cierre: build desde HEAD, `verify:full` y `verify:evidence`. El ensayo se corrió en master `75179c7`, que **no está incluido en este worktree de docs**; el script de ensayo de la base `3fe1cc9` conserva el corte viejo, así que no se usa como evidencia aquí.

| Check | Resultado | Evidencia |
|---|---|---|
| Build de producción | 🟡 última corrida conocida: limpio y con `BUILD_SHA` | `npm run build` |
| Servidor de producción | ⚠️ `665d72e` en `:3000`; no coincide con HEAD `3fe1cc9` | `/api/health` devuelve `buildSha` |
| UI nueva “Mostrador claro” | ✅ F3 aprobado por verificación independiente | `VERIFICACION-F3-FINAL-5.md` |
| Preflight de demo | 🟡 18/18, última corrida conocida (2 nov 2026); correr tras el reset | `node scripts/preflight.mjs` |
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
| P0 shell (carril aparte) | 🟡 68 PASS · 0 FAIL; HIG/axe 0 — última corrida conocida | `scripts/p0-shell-e2e.py` |
| Datos | 🟡 85 checks (58+20+7), `DATOS OK` — última corrida conocida | `npm run test:fix-datos` |
| Cobros pendientes / tareas | 🟡 franja, fechas, refresh, polling y quinto tab — última corrida conocida | `scripts/p0-integracion-e2e.py` |
| Carrera de refresco | 🟡 un poll viejo no revive el saldo cobrado — última corrida conocida | `scripts/p0-integracion-e2e.py` |
| Voz del abono de $50 | 🟡 Kokoro `em_santa`, dice “50 pesos”, 0 `speechSynthesis` — última corrida conocida | `VOZ-50-KOKORO.md` |
| Movimiento | 🟡 19/19 PASS · 0 FAIL; tabs/hojas/listas 140–300 ms, barrido ASLI, scroll trigger, reduced-motion — última corrida conocida | `MOTION.md` + `demo/stageshow/tab-wipe.mp4` |
| Reel de transiciones | 🟡 5.5 s, tabs + hoja de verificación — última corrida conocida | `demo/stageshow/tab-wipe.mp4` + `tab-wipe-sheet.png` |
| Harness static | 🟡 5/5 última corrida conocida; `latest.json` es local y no está en el árbol | `harness/evidence/latest.json` |
| Harness full | ❌ no ejecutado contra HEAD; el catálogo actual es 25 gates y `full` son 23 (24 con film) | `harness/STATE.md` |
| Alto contraste | 🟡 7/7 PASS · 0 FAIL; axe 0, foco 3 px negro y 360 px sin overflow — última corrida conocida | `harness/evidence/a11y-contrast.json` (generado, ignorado) |
| Dirección visual | ✅ papel editorial, Manrope/Fraunces, doble marco, dos columnas desde 1280 | `HIG-DESIGN.md` §16 + `MOTION.md` |
| Video | ⚠️ **histórico**: 39.8 s, 1,704,744 B, UI vieja, muestra $570; regrabar tras el rediseño. No es respaldo actual | `demo/mercado-cero-demo.mp4` |
| Film check Stageshow | 🟡 8 beats + contact sheet + motion sheet — última corrida conocida; los sheets se generan y no se versionan | `demo/stageshow/` |
| QR imprimible | 🟡 PNG + SVG + HTML + PDF con la URL vigente al 2 nov 2026 en `qr-demo.html`; verificar antes de imprimir y regenerar si cambia el túnel | `demo/qr-demo.*` |
| Voz del demo | ✅ Kokoro `em_santa` para frases fijas + Piper es-MX dinámico | `web/public/tts/` |
| Accesibilidad | 🟡 texto grande, alto contraste, voz lenta, leer pantalla implementados; falta validación con personas y lectores | `verify-a11y` |
| Runbook | 🟡 corregido en `p0/fix-demo-docs`; no probado en vivo | `RUNBOOK-DEMO.md` |
| Prueba de usuario | ❌ 0/6–8 ejecutadas; protocolo disponible | `TEST-USUARIO.md` |
| Guion narrado | 🟡 311 palabras + versión de 60 s; ensayo 3/3, 19/19, ~8.1 s | `GUION-3-MIN.md` |

## Amarillo

- Probar en un **teléfono físico** de 320/360 px; las auditorías actuales son Playwright.
- Prueba con **6–8 comerciantes** siguiendo `TEST-USUARIO.md`: **0/6–8 ejecutadas**.
- Faltan pruebas reales con **TalkBack/VoiceOver** en teléfono físico; la evidencia actual es Playwright + axe.
- El túnel actual es un **quick tunnel efímero**; si cambia, hay que regenerar `APP_URL`, QR y PDF.
- La voz dinámica usa Piper es-MX; la primera frase puede tardar ~3 s si carga el modelo. Las frases fijas usan Kokoro `em_santa`.
- P0-D quedó verde (69/0), pero la migración está pensada para un solo proceso `next start`; si el despliegue es multi-proceso, mover la lectura del esquema dentro del lock. El 200 % es inyección de `font-size`, no zoom real.
- **Harness full pendiente:** el catálogo actual es 25 gates; `full` son 23 (24 con film) y no se corrió contra `3fe1cc9`. Requiere servidor **construido desde HEAD** (`buildSha === gitAtStart.sha`) y túnel vivo.
- **Evidencia no atada al HEAD:** el servidor `:3000` es `665d72e`; `harness/evidence/latest.json` es local y no está en el árbol. La corrida de cierre sigue pendiente.
- Los artefactos de auditoría (mobile, checkout, motion, contraste, mobile-320, p0, rehearsal, tunnel, film) están ignorados por git y se regeneran con sus scripts; el QR y el video sí son entregables versionados. El MP4 es histórico y se regrabará.

## Rojo

- **Pago real de $0.01:** **no hubo pago real**. BBVA/CoDi se queda trabado al seleccionar cuenta. La app está en modo demo (`demo_paid`), el contrato del webhook está en 40/40 (última corrida conocida) y el ensayo pasó 19/19. Falta un banco/cuenta que funcione o las credenciales del hackathon.
- No se debe afirmar que el pago demo es real. El sello **DEMO** y el copy lo distinguen.
- **Matiz de `paid`:** el webhook firmado es el único camino `payment_pending → paid` para pagos digitales. El efectivo se crea directamente como `paid` (no pasa por `payment_pending`) y el demo usa `demo_paid`. `paid` también aparece en lecturas y en `payments.status` del efectivo. No afirmar “sin `paid` fuera del webhook” sin esta aclaración.

## Cómo arrancar (orden operativo)

1. **Limpieza:** conservar solo el servidor de demo en `:3000` y `cloudflared` **PID 13932**; detener `:3125`, `:3195`, `:3211`, `:3220`, `:3230` y el túnel del `:3230`. **No ejecutar esta limpieza desde el carril de docs.**
2. `cd web`
3. `npm run build`
4. `next start -H 127.0.0.1` (o `npm start -- -H 127.0.0.1`) en `:3000`.
5. Reiniciar demo: `POST /api/demo/reset` o el botón del header.
6. `node scripts/preflight.mjs` **después** del reset.

Abrir `http://localhost:3000`. En `.env.local`, `DEMO_MODE=true`. El build sella `BUILD_SHA`; `/api/health` lo devuelve. Para verificar que el servidor es de este commit:

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
