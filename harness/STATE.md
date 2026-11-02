# STATE — Mercado Cero

> Handoff vivo para agentes. Última actualización: **2 de noviembre de 2026**.
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

- Fecha: **2 nov 2026, 04:34 UTC**
- Código verificado: **`76bfbc3`** (cierre de la revisión de integración P0); `latest.json` se generó sobre `8a440bf`, que solo añade evidencia.
- Modo: **static**, 4/4 en verde (`guard`, `lint`, `types`, `build`), `gitAtStart.dirty: false`.
- E2E: integración **50/0/0**, fiado **50/0/0**, venta **43/0/0**, shell **52/0/0**.
- HIG/axe aislado `:3101`: 360/390/768/1280 normal y 200 %, axe 0, 0 recortes, 0 controles bajo 48 px.
- Voz: el botón de $50 reproduce Kokoro `em_santa` (SHA-256 `24EF2C9F…`), 0 llamadas a `speechSynthesis`; las frases dinámicas siguen en Piper.
- No ejecutados en esta corrida: `verify:full` (truth/webhook/mobile/checkout/tunnel/preflight/film). El pago real de $0.01 sigue bloqueado.

## Qué está construido

- Caja: venta por voz/texto, draft, efectivo, fiado, link/QR, verificación de comprobante.
- Cobros pendientes (P0-E): franja en Caja, 3→50, fechas Hoy/Ayer, refresh en focus/visibility y polling de 45 s visible.
- Pendientes de negocio (P0-G): quinto tab, crear/completar/reabrir/posponer/eliminar, reset de demo sin tareas fantasma.
- Venta mixta: efectivo + fiado + remanente digital con Link/QR/demo; resultado “Pago mixto”.
- Voz: Kokoro `em_santa` para frases fijas, Piper para dinámicas, montos hablados (“50 pesos”, no “cincuenta punto cero cero”).
- Corte: conteo, diferencia, gastos/retiros, guardado.
- Meta: apartado declarado, progreso.
- Accesibilidad: 48 px, 200%, alto contraste, voz, repetir, leer pantalla, movimiento reducido.
- Demo: `demo_paid`, sellos, video, QR, runbook.
- Stageshow: `demo/stageshow/` + `web/scripts/film-check.py`.
- Harness: `HARNESS.md`, `harness/EVALS.md`, `harness-gate.mjs`, `harness-guard.mjs`, `verify-truth.mjs`.

## F0 y P0-A/B

- **F0 completado:** `AUDITORIA-COGNITIVA.md` + `harness/f0-venta.md`, `f0-dinero.md`, `f0-shell.md`.
- **P0-A/B mergeado:** `c22e85d` — venta manual, cambio, validación inline, borrador durable y pendiente de cobro durable.
- **P0-C mergeado:** `586f1a6` — abono confirmado, saldo vivo, idempotencia durable y migración de `request_id`.
- **P0-C.1/E/G integrados:** `96381b9` + `76bfbc3` — cobros pendientes, tareas de negocio, método de abono, venta mixta, carrera de refresco, WCAG 2.5.3 y voz de $50.
- **Evidencia P0-A/B:** `web/scripts/p0-venta-e2e.py` → 43 PASS · 0 FAIL · 0 KNOWN.
- **Evidencia P0-C:** `web/scripts/p0-fiado-e2e.py` → 50 PASS · 0 FAIL · 0 KNOWN.
- **Evidencia integración:** `web/scripts/p0-integracion-e2e.py` → 50 PASS · 0 FAIL · 0 KNOWN.
- **Evidencia shell:** `web/scripts/p0-shell-e2e.py` → 52 PASS · 0 FAIL; HIG/axe 0.
- **Resuelto:** la venta mixta ya ofrece cobrar el remanente digital y muestra “Pago mixto”; el fiado conserva su saldo vivo.

## Siguiente tarea

**P0-D · Corte no destructivo + resumen de cierre** (borrador local del conteo, `load()` que no pisa cambios, validación, resumen de efectivo/fiado/pendiente digital). Después: ensayo con `GUION-3-MIN.md`, contact sheet/motion check, preflight y túnel. Las pruebas humanas (6–8 comerciantes, SUS/NASA-TLX, TalkBack/VoiceOver, teléfono físico) siguen pendientes y no se sustituyen con gates automáticos.

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
