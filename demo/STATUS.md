# Estado de demo — 30 de octubre de 2026

## Verde

| Check | Resultado | Evidencia |
|---|---|---|
| Build de producción | ✅ limpio | `npm run build` |
| Servidor de producción | ✅ `next start` estable | auditorías corridas contra producción |
| Preflight de demo | ✅ 18/18 | `node scripts/preflight.mjs` |
| Webhook firmado | ✅ 27/27 | `scripts/webhook-contract.mjs` |
| Lighthouse caja | ✅ 100 accesibilidad · 100 best practices · 100 SEO | producción |
| Lighthouse checkout | ✅ 100 accesibilidad · 100 best practices · 100 SEO | producción |
| 360 px caja | ✅ 25/25 checks | `demo/mobile-audit.json` |
| Flujo completo 360 px | ✅ 10.2 s en producción (10–17 s en dev), 0 errores | `scripts/mobile-audit.py` |
| Checkout público 360 px | ✅ 15/15 checks: 3 métodos, pago demo, éxito | `demo/checkout-audit.json` |
| Túnel público | ✅ 8/8 checks por Cloudflare | `demo/tunnel-smoke.json` |
| Ensayo del guion | ✅ 3/3 corridas, 14/14 pasos, promedio 4.8 s | `demo/rehearsal.json` |
| Video de respaldo | ✅ 34 s, 1280×800, 1.4 MB | `demo/mercado-cero-demo.mp4` |
| QR imprimible | ✅ PNG + SVG + HTML + PDF | `demo/qr-demo.*` |
| Runbook | ✅ guion, fallas y Q&A | `RUNBOOK-DEMO.md` |
| Prueba de usuario | ✅ protocolo listo | `TEST-USUARIO.md` |
| Guion narrado | ✅ 311 palabras + versión de 60 s | `GUION-3-MIN.md` |
| Créditos de fotos | ✅ autores, licencias y enlaces | `web/CREDITS.md` |

## Amarillo

- Probar en un **teléfono físico** de 360 px; la auditoría actual es Playwright.
- Prueba con una **persona ajena** siguiendo `TEST-USUARIO.md`.
- El túnel actual es temporal; el QR debe regenerarse con la URL final.
- La cuarta foto no se agregó: 3 imágenes cubren hero, meta y cierre; una más solo decoraría.

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
node scripts/webhook-contract.mjs
```
