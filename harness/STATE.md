# STATE — Mercado Cero

> Handoff vivo para agentes. Última actualización: **1 de noviembre de 2026**.
> No reconstruyas el estado de memoria: si un dato no está aquí ni en `latest.json`, no lo asumas.

## Identidad

- Repo: `mercado-cero`
- App: `web/` (Next.js 16, TypeScript, Tailwind, SQLite `node:sqlite`)
- Modo actual: **demo** (`demo_paid` para simulación; `paid` solo por webhook pey)
- URL local: `http://localhost:3000`
- URL pública: túnel temporal de Cloudflare (ver `demo/STATUS.md`; si cambió, regenerar QR)
- Base de datos: `web/data/mercado-cero.db` (ignorada por git)
- Evidencia: `harness/evidence/latest.json`

## Último estado verde conocido

| Gate | Resultado | Fecha |
|---|---|---|
| Webhook firmado | 27/27 | 1 nov 2026 |
| Verdad del comprobante | demo no verificado | 1 nov 2026 |
| HIG/WCAG 2.2 AA | 360/390/768/1280, axe 0, 48 px, 200% | 1 nov 2026 |
| Móvil 360 px | 25/25 | 1 nov 2026 |
| Checkout público | 15/15, `demo_paid` | 1 nov 2026 |
| Túnel | 8/8 | 1 nov 2026 |
| Ensayo | 3/3, promedio 3.9 s | 1 nov 2026 |
| Preflight | 18/18 | 1 nov 2026 |
| Film check | 8 beats + contact sheet + motion sheet | 1 nov 2026 |

**Nota:** esta tabla es histórica. Para el commit actual, manda `harness/evidence/latest.json` con `ok: true`.

## Última corrida del harness

- Fecha: **1 nov 2026, 19:59 UTC**
- Commit: **`999848f`** (`gitAtStart.dirty: false`)
- Modo: **full**, 11/11 en verde
- Evidencia: `harness/evidence/latest.json`
- No ejecutados en esa corrida: `build` (corre con `verify:static`), `film` (corre con `--with-film`)
- Estado de datos: demo reiniciada antes de `truth` y antes de `preflight`

## Qué está construido

- Caja: venta por voz/texto, draft, efectivo, fiado, link/QR, verificación de comprobante.
- Corte: conteo, diferencia, gastos/retiros, guardado.
- Meta: apartado declarado, progreso.
- Accesibilidad: 48 px, 200%, alto contraste, voz, repetir, leer pantalla, movimiento reducido.
- Demo: `demo_paid`, sellos, video, QR, runbook.
- Stageshow: `demo/stageshow/` + `web/scripts/film-check.py`.
- Harness: `HARNESS.md`, `harness/EVALS.md`, `harness-gate.mjs`, `harness-guard.mjs`, `verify-truth.mjs`.

## Siguiente tarea

**F0 de `GOAL-ACOMPANAMIENTO.md`:** auditoría de carga cognitiva de los flujos actuales (venta, caja, fiado, corte, meta, verificación), con pasos/campos/decisiones/interrupciones/errores. Entregable: `AUDITORIA-COGNITIVA.md` con hallazgos priorizados y propuesta P0. **No** implementar P0 antes de revisar los hallazgos.

## Bloqueos reales

- **Pago real de $0.01:** BBVA/CoDi se traba al seleccionar cuenta. No presentar demo como real.
- **Teléfono físico 360 px + TalkBack/VoiceOver:** no probado.
- **6–8 comerciantes + SUS/NASA-TLX:** protocolo listo en `TEST-USUARIO.md`; no ejecutado.
- **Offline para ventas no bancarias:** no implementado.
- **Hermes:** capa separada; no iniciada en este repo.
- **Túnel:** temporal; si cambia, actualizar `APP_URL`, QR y `preflight`.

## Cómo refrescar este estado

```bash
cd web
npm run verify:full
```

Después:

1. Revisa `harness/evidence/latest.json`.
2. Actualiza esta tabla solo con los gates que corriste.
3. Registra riesgos nuevos y la siguiente acción.
4. No borres bloqueos humanos; se cierran con evidencia, no con optimismo.

## Archivos que no se deben tocar sin contexto

- `GOAL.md`: invariantes de dinero.
- `web/src/lib/orders.ts`, `web/src/app/api/webhooks/pey/route.ts`, `web/src/lib/pey-events.ts`.
- `.env.local` (no versionado).
- `demo/` generado: se regenera con scripts, no se edita a mano.
- `SWARM/`: puede ser trabajo del usuario/orquestador; leer antes de modificar.
