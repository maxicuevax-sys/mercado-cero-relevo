# Estado de demo — 2 de noviembre de 2026

## Verde

| Check | Resultado | Evidencia |
|---|---|---|
| Build de producción | ✅ limpio y con `BUILD_SHA` | `npm run build` |
| Servidor de producción | ✅ `next start` estable en `:3000` (o `BASE_URL`) | `/api/health` devuelve `buildSha` |
| UI nueva “Mostrador claro” | ✅ F3 aprobado por verificación independiente | `VERIFICACION-F3-FINAL-5.md` |
| Preflight de demo | ✅ 18/18 | `node scripts/preflight.mjs` |
| Webhook firmado | ✅ 34/34 | `scripts/webhook-contract.mjs` |
| Verdad del comprobante | ✅ demo nunca verificado | `scripts/verify-truth.mjs` |
| Auditoría HIG | ✅ 4 viewports (360/390/768/1280), axe 0, WCAG 2.2 AA, targets 48 px, 200% | `scripts/hig-after-audit.py` |
| 360 px caja | ✅ 25/25 checks | `demo/mobile-audit.json` (generado, ignorado) |
| 320/360 px HIG | ✅ 42 PASS · 0 FAIL en Chromium/Firefox/WebKit | `harness/evidence/mobile-320-e2e.json` (generado, ignorado) |
| Flujo completo 360 px | ✅ ≈9 s, 0 errores | `scripts/mobile-audit.py` |
| Checkout público 360 px | ✅ 19/19 checks | `demo/checkout-audit.json` (generado, ignorado) |
| Túnel público | ✅ 8/8 checks | `demo/tunnel-smoke.json` (generado, ignorado) |
| Ensayo del guion | ✅ 3/3 corridas, 15/15 pasos, promedio 4.8 s | `demo/rehearsal.json` (generado, ignorado) |
| P0 venta durable | ✅ 65 PASS · 0 FAIL · 0 KNOWN | `scripts/p0-venta-e2e.py` |
| P0 fiado | ✅ 51 PASS · 0 FAIL · 0 KNOWN | `scripts/p0-fiado-e2e.py` |
| P0 corte no destructivo | ✅ 69 PASS · 0 FAIL · 0 KNOWN | `scripts/p0-corte-e2e.py` |
| P0 integración | ✅ 51 PASS · 0 FAIL · 0 KNOWN | `scripts/p0-integracion-e2e.py` |
| P0 dinero | ✅ 45 PASS · 0 FAIL · 3 KNOWN | `scripts/p0-dinero-e2e.py` |
| P0 shell (carril aparte) | ✅ 68 PASS · 0 FAIL, HIG/axe 0 | `scripts/p0-shell-e2e.py` |
| Datos | ✅ 85 checks (58+20+7), `DATOS OK` | `npm run test:fix-datos` |
| Cobros pendientes / tareas | ✅ franja, fechas, refresh, polling y quinto tab | `scripts/p0-integracion-e2e.py` |
| Carrera de refresco | ✅ un poll viejo no revive el saldo cobrado | `scripts/p0-integracion-e2e.py` |
| Voz del abono de $50 | ✅ Kokoro `em_santa`, dice “50 pesos”, 0 `speechSynthesis` | `VOZ-50-KOKORO.md` |
| Movimiento | ✅ tabs/hojas/listas 140–300 ms, barrido ASLI, scroll trigger, reduced-motion; 19 PASS · 0 FAIL | `MOTION.md` + `demo/stageshow/tab-wipe.mp4` |
| Reel de transiciones | ✅ 5.5 s, tabs + hoja de verificación | `demo/stageshow/tab-wipe.mp4` + `tab-wipe-sheet.png` |
| Harness static | ✅ 5/5 (`guard`, `lint`, `types`, `deps`, `build`), `ok:true`, `serverBuildSha === gitAtStart.sha`, árbol limpio; SHA vigente en `latest.json` (local, no versionado) | `harness/evidence/latest.json` |
| Harness full | ⏳ no ejecutado en este worktree; el catálogo actual es 25 gates y `full` son 23 (24 con film) | `harness/STATE.md` |
| Alto contraste | ✅ axe 0, foco 3 px negro y 360 px sin overflow; 0 FAIL | `harness/evidence/a11y-contrast.json` (generado, ignorado) |
| Dirección visual | ✅ papel editorial, Manrope/Fraunces, doble marco, dos columnas desde 1280 | `HIG-DESIGN.md` §16 + `MOTION.md` |
| Video de respaldo | ✅ 1280×800, MP4 1.6 MB, con la capa editorial y cierre versionado | `demo/mercado-cero-demo.mp4` |
| Film check Stageshow | ✅ 8 beats + contact sheet + motion sheet | `demo/stageshow/` |
| QR imprimible | ✅ PNG + SVG + HTML + PDF, URL nueva | `demo/qr-demo.*` |
| Voz del demo | ✅ Kokoro `em_santa` para frases fijas + Piper es-MX dinámico | `web/public/tts/` |
| Accesibilidad | ✅ texto grande, alto contraste, voz lenta, leer pantalla | `verify-a11y` |
| Runbook | ✅ guion, fallas y Q&A | `RUNBOOK-DEMO.md` |
| Prueba de usuario | ✅ protocolo listo | `TEST-USUARIO.md` |
| Guion narrado | ✅ 311 palabras + versión de 60 s | `GUION-3-MIN.md` |

## Amarillo

- Probar en un **teléfono físico** de 320/360 px; las auditorías actuales son Playwright.
- Prueba con una **persona ajena** siguiendo `TEST-USUARIO.md`.
- El túnel actual es temporal; si cambia, hay que regenerar `APP_URL` y el QR.
- La voz dinámica usa Piper es-MX; la primera frase puede tardar ~3 s si carga el modelo. Las frases fijas usan Kokoro `em_santa`.
- Faltan pruebas reales con **TalkBack/VoiceOver** en teléfono físico; la evidencia actual es Playwright + axe.
- Faltan **6–8 comerciantes** y SUS; el protocolo está en `TEST-USUARIO.md`.
- P0-D quedó verde (69/0), pero la migración está pensada para un solo proceso `next start`; si el despliegue es multi-proceso, mover la lectura del esquema dentro del lock. El 200 % es inyección de `font-size`, no zoom real.
- **Harness full pendiente:** el catálogo actual es 25 gates; `full` son 23 (24 con film) y no se corrió en este worktree. Requiere servidor **construido desde HEAD** (`buildSha === gitAtStart.sha`) y túnel vivo.
- Los artefactos de auditoría (mobile, checkout, motion, contraste, mobile-320, p0, rehearsal, tunnel, film) están ignorados por git y se regeneran con sus scripts; el QR y el video sí son entregables versionados.

## Rojo

- **Pago real de $0.01:** BBVA/CoDi se queda trabado al seleccionar cuenta. La app está lista, el contrato del webhook está en 34/34 y el modo demo está sembrado. Falta un banco/cuenta que funcione o las credenciales del hackathon.
- No se debe afirmar que el pago demo es real. El sello **DEMO** y el copy lo distinguen.
- **Matiz de `paid`:** el webhook firmado es el único camino `payment_pending → paid` para pagos digitales. El efectivo se crea directamente como `paid` (no pasa por `payment_pending`) y el demo usa `demo_paid`. `paid` también aparece en lecturas y en `payments.status` del efectivo. No afirmar “sin `paid` fuera del webhook” sin esta aclaración.

## Cómo arrancar

```powershell
cd mercado-cero\web
npm run build
npm start
```

Abrir `http://localhost:3000`. En `.env.local`, `DEMO_MODE=true`. El build sella `BUILD_SHA`; `/api/health` lo devuelve. Para verificar que el servidor es de este commit:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

Para desarrollo con recarga:

```powershell
npm run dev
```

Para regenerar QR:

```powershell
node scripts/make-demo-qr.mjs
python scripts/print-qr-pdf.py
```

Para re-grabar el video:

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
