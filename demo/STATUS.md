# Estado de demo — 2 de noviembre de 2026

## Verde

| Check | Resultado | Evidencia |
|---|---|---|
| Build de producción | ✅ limpio | `npm run build` |
| Servidor de producción | ✅ `next start` estable en `:3000` | auditorías contra producción |
| UI nueva “Mostrador claro” | ✅ F3 aprobado por verificación independiente | `VERIFICACION-F3-FINAL-5.md` |
| Preflight de demo | ✅ 18/18 | `node scripts/preflight.mjs` |
| Webhook firmado | ✅ 27/27 | `scripts/webhook-contract.mjs` |
| Verdad del comprobante | ✅ demo nunca verificado | `scripts/verify-truth.mjs` |
| Auditoría HIG | ✅ 360/390/768/1280, axe 0, WCAG 2.2 AA, targets 48 px, 200% | `scripts/hig-after-audit.py` |
| 360 px caja | ✅ 25/25 checks | `demo/mobile-audit.json` |
| Flujo completo 360 px | ✅ ≈9 s, 0 errores | `scripts/mobile-audit.py` |
| Checkout público 360 px | ✅ 15/15 checks | `demo/checkout-audit.json` |
| Túnel público | ✅ 8/8 checks | `demo/tunnel-smoke.json` |
| Ensayo del guion | ✅ 3/3 corridas, 15/15 pasos, promedio 4.6 s | `demo/rehearsal.json` |
| P0-E cobros pendientes | ✅ franja, fechas, refresh y polling visible | `harness/evidence/p0-integracion-e2e.json` |
| P0-G pendientes de negocio | ✅ quinto tab, crear/completar/reabrir/posponer/eliminar | `harness/evidence/p0-integracion-e2e.json` |
| P0-D corte no destructivo | ✅ borrador, cierre v1/v2, snapshot, idempotencia, migración | `harness/evidence/p0-corte-e2e.json` |
| Venta mixta | ✅ efectivo + fiado + remanente digital, “Pago mixto” | `harness/evidence/p0-integracion-e2e.json` |
| Carrera de refresco | ✅ un poll viejo no revive el saldo cobrado | `harness/evidence/p0-integracion-e2e.json` |
| Voz del abono de $50 | ✅ Kokoro `em_santa`, dice “50 pesos”, 0 `speechSynthesis` | `VOZ-50-KOKORO.md` |
| Movimiento | ✅ tabs/hojas/listas 140–300 ms, barrido ASLI, scroll trigger, reduced-motion | `MOTION.md` · `demo/stageshow/tab-wipe.mp4` |
| Reel de transiciones | ✅ 5.5 s, tabs + hoja de verificación | `demo/stageshow/tab-wipe.mp4` · `tab-wipe-sheet.png` |
| Harness final | ✅ full 13/13 en `219b26f`, `dirty: false` | `harness/evidence/latest.json` |
| Alto contraste | ✅ axe 0, foco 3 px negro y 360 px sin overflow | `harness/evidence/a11y-contrast.json` |
| Dirección visual | ✅ papel editorial, Manrope/Fraunces, doble marco, dos columnas desde 1280 | `HIG-DESIGN.md` §16 · `MOTION.md` |
| Video de respaldo | ✅ 1280×800, MP4 1.6 MB, con la capa editorial y cierre versionado | `demo/mercado-cero-demo.mp4` |
| Film check Stageshow | ✅ 8 beats + contact sheet + motion sheet | `demo/stageshow/` |
| QR imprimible | ✅ PNG + SVG + HTML + PDF, URL nueva | `demo/qr-demo.*` |
| Voz del demo | ✅ Kokoro `em_santa` para frases fijas + Piper es-MX dinámico | `web/public/tts/` |
| Accesibilidad | ✅ texto grande, alto contraste, voz lenta, leer pantalla | `verify-a11y` |
| Runbook | ✅ guion, fallas y Q&A | `RUNBOOK-DEMO.md` |
| Prueba de usuario | ✅ protocolo listo | `TEST-USUARIO.md` |
| Guion narrado | ✅ 311 palabras + versión de 60 s | `GUION-3-MIN.md` |

## Amarillo

- Probar en un **teléfono físico** de 360 px; la auditoría actual es Playwright.
- Prueba con una **persona ajena** siguiendo `TEST-USUARIO.md`.
- El túnel actual es temporal; si cambia, hay que regenerar `APP_URL` y el QR.
- La voz dinámica usa Piper es-MX; la primera frase puede tardar ~3 s si carga el modelo. Las frases fijas usan Kokoro `em_santa`.
- Faltan pruebas reales con **TalkBack/VoiceOver** en teléfono físico; la evidencia actual es Playwright + axe.
- Faltan **6–8 comerciantes** y SUS; el protocolo está en `TEST-USUARIO.md`.
- P0-D quedó verde (69/0), pero la migración está pensada para un solo proceso `next start`; si el despliegue es multi-proceso, mover la lectura del esquema dentro del lock. El 200 % es inyección de `font-size`, no zoom real.

## Rojo

- **Pago real de $0.01:** BBVA/CoDi se queda trabado al seleccionar cuenta. La app está lista, el contrato del webhook está en 27/27 y el modo demo está sembrado. Falta un banco/cuenta que funcione o las credenciales del hackathon.
- No se debe afirmar que el pago demo es real. El sello **DEMO** y el copy lo distinguen.

## Cómo arrancar

```powershell
cd mercado-cero\web
npm run build
npm start
```

Abrir `http://localhost:3000`. En `.env.local`, `DEMO_MODE=true`.

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
```
