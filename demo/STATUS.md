# Estado de demo — 1 de noviembre de 2026

## Verde

| Check | Resultado | Evidencia |
|---|---|---|
| Build de producción | ✅ limpio | `npm run build` |
| Servidor de producción | ✅ `next start` estable en `:3000` | auditorías contra producción |
| UI nueva “Mostrador claro” | ✅ F3 aprobado por verificación independiente | `VERIFICACION-F3-FINAL-5.md` |
| Preflight de demo | ✅ 18/18 | `node scripts/preflight.mjs` |
| Webhook firmado | ✅ 27/27 | `scripts/webhook-contract.mjs` |
| Auditoría HIG | ✅ 360/390/768/1280, axe 0, 200% | `scripts/hig-after-audit.py` |
| 360 px caja | ✅ 25/25 checks | `demo/mobile-audit.json` |
| Flujo completo 360 px | ✅ 9.3 s, 0 errores | `scripts/mobile-audit.py` |
| Checkout público 360 px | ✅ 15/15 checks | `demo/checkout-audit.json` |
| Túnel público | ✅ 8/8 checks | `demo/tunnel-smoke.json` |
| Ensayo del guion | ✅ 3/3 corridas, 15/15 pasos, promedio 3.6 s | `demo/rehearsal.json` |
| Video de respaldo | ✅ 36 s, 1280×800, 0.8 MB | `demo/mercado-cero-demo.mp4` |
| QR imprimible | ✅ PNG + SVG + HTML + PDF, URL nueva | `demo/qr-demo.*` |
| Voz del demo | ✅ Kokoro `ef_dora` pre-renderizada + fallback | `web/public/tts/` |
| Runbook | ✅ guion, fallas y Q&A | `RUNBOOK-DEMO.md` |
| Prueba de usuario | ✅ protocolo listo | `TEST-USUARIO.md` |
| Guion narrado | ✅ 311 palabras + versión de 60 s | `GUION-3-MIN.md` |

## Amarillo

- Probar en un **teléfono físico** de 360 px; la auditoría actual es Playwright.
- Prueba con una **persona ajena** siguiendo `TEST-USUARIO.md`.
- El túnel actual es temporal; si cambia, hay que regenerar `APP_URL` y el QR.
- La voz dinámica que no está pre-renderizada usa la voz del navegador; las frases fijas del demo usan Kokoro.

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
