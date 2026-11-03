# STATE — Mercado Cero

> Handoff vivo para agentes. Última actualización: **2 de noviembre de 2026**.
> No reconstruyas el estado de memoria: si un dato no está aquí ni en `latest.json`/`latest-static.json`, no lo asumas.

## Identidad

- Repo: `mercado-cero`
- App: `web/` (Next.js 16, TypeScript, Tailwind, SQLite `node:sqlite`)
- Modo actual: **demo** (`demo_paid` para simulación; en el camino digital `paid` solo por webhook pey firmado; el efectivo se registra `paid` al crear la venta)
- URL local: `http://localhost:3000` (o `BASE_URL`)
- URL pública (2 nov 2026): `https://involve-picking-wellness-retreat.trycloudflare.com` — preview `397039d`, **no** el build final; quick tunnel efímero. El túnel `timing...` del QR no resuelve. Si cambia, regenerar `APP_URL`, QR y PDF (ver `demo/STATUS.md`).
- Base de datos: `web/data/mercado-cero.db` (ignorada por git)
- Evidencia: `harness/evidence/latest.json` (full) o `latest-static.json` (static), locales e ignorados; solo con `ok:true`
- Reporte: `npm run harness:report` genera la tabla desde el latest correspondiente

## Último estado verde conocido

> **Histórico, no handoff.** Esta tabla mezcla corridas de días distintos y no prueba el commit actual. El handoff vigente es `harness/evidence/latest.json` (full) o `latest-static.json` (static) + `npm run verify:evidence` contra HEAD.

| Gate | Resultado | Fecha |
|---|---|---|
| Webhook firmado | 40/40 | 2 nov 2026 |
| Verdad del comprobante | demo no verificado | 2 nov 2026 |
| HIG/WCAG 2.2 AA | 5 viewports: 320/360/390/768/1280, axe 0, 48 px, 200% | 2 nov 2026 |
| Móvil 360 px | 25/25 | 2 nov 2026 |
| Móvil 320/360 (3 motores) | 42 PASS · 0 FAIL (nuevo gate) | 2 nov 2026 |
| Checkout público | 19/19, `demo_paid` | 2 nov 2026 |
| Túnel | 8/8 | 2 nov 2026 |
| Ensayo | 3/3, 19/19 pasos, ~8.1 s, `todo en verde: True` (master `75179c7`) | 2 nov 2026 |
| Preflight | 18/18 | 2 nov 2026 |
| Motion | 19 PASS · 0 FAIL | 2 nov 2026 |
| Alto contraste | 7 PASS · 0 FAIL | 2 nov 2026 |
| P0 venta | 65 PASS · 0 FAIL · 0 KNOWN | 2 nov 2026 |
| P0 fiado | 51 PASS · 0 FAIL · 0 KNOWN | 2 nov 2026 |
| P0 corte | 69 PASS · 0 FAIL · 0 KNOWN | 2 nov 2026 |
| P0 integración | 51 PASS · 0 FAIL · 0 KNOWN | 2 nov 2026 |
| P0 dinero | 45 PASS · 0 FAIL · 3 KNOWN | 2 nov 2026 |
| P0 shell (carril aparte) | 68 PASS · 0 FAIL; HIG/axe 0 | 2 nov 2026 |
| Seguridad | contrato `SEGURIDAD OK` | 2 nov 2026 |
| Datos | 85 checks (58+20+7), `DATOS OK` | 2 nov 2026 |
| Performance | `PERF BUDGET OK` | 2 nov 2026 |
| Film check | 8 beats + contact sheet + motion sheet | 2 nov 2026 |

**Nota:** para el commit actual manda el latest correspondiente (`latest.json` para full, `latest-static.json` para static); si `verify:evidence` falla, la tabla no se usa como prueba.

## Corte actual (2 nov 2026, 22:40)

- **Rama final:** `p0/final-cognitive` = `fabe7cc`; `p0/consolidacion` = `fabe7cc` + commit de docs (SHA en la entrega).
- **`master`:** `a85d903`; 28 commits atrás de la final (29 del worktree con docs); es ancestro; fast-forward posible pero **no ejecutado**.
- **Build conocido:** `2a1f166` (2026-11-03T04:21:10Z), padre de `fabe7cc`; mismo código de app, pero `buildSha !== HEAD`.
- **Servidor `:3000`:** ❌ no responde. **Preview `:3230` / pública:** `397039d`. **`:3302`:** `2a1f166`.
- **Evidencia atada al HEAD:** ❌ pendiente. `latest.json`/`latest-static.json` **no existen** en este worktree; `full` no se corrió contra el HEAD (base `fabe7cc` + docs).
- **P0/P1 corregidos:** P0-1, P0-2, P1-1, P1-3 y P1-5 (`ac9e5a6`/`2a1f166`). Abiertos: P1-2 (auth), P1-4 (404 HTTP 200) y P2 conocidos.
- **Video:** `demo/mercado-cero-demo.mp4` es **histórico** (39.8 s, 1,704,744 B, UI vieja, muestra $570); los scripts de `p0/fix-video` no están integrados. No es respaldo actual.
- **Pruebas humanas:** **0/6–8**; TalkBack/VoiceOver y teléfono físico pendientes.
- **Pago real:** ❌ no hubo; BBVA/CoDi bloqueado; demo `demo_paid`.
- **Veredicto:** cierre pendiente; no declarar el cierre.

## Última corrida del harness

- **El SHA de la tabla de gates no se hardcodea.** El código verificado es el `gitAtStart.sha` de `harness/evidence/latest.json` (full) o `latest-static.json` (static); `npm run verify:evidence` lo compara con HEAD y exige árbol limpio, `serverBuildSha === gitAtStart.sha`, `buildSha` por gate runtime, set canónico de artefactos y hashes. El corte actual de arriba referencia `fabe7cc`/`2a1f166` para orientar, no como evidencia.
- **Catálogo actual:** **25 gates**. `fast` 3, `static` 5, `full` **23** por defecto (build fuera, film opcional) y `full --with-film` **24**.
- **Cierre de este carril de harness:** `npm run test:harness` (58/58), `node scripts/harness-gate.mjs --list`, `node scripts/checkout-gate.mjs` y el gate `p0-dinero` aislado sobre build de HEAD. No se corrió `verify:full` contra `:3000`; el full queda para el orquestador con servidor y túnel. El fix adversario dejó `p0-adversarial-e2e.py` 28/28 contra build `2a1f166`, pero sin `gitAtStart`/`dirty`.
- **`full` no se ejecutó en este worktree.** Este carril no toca `mercado-cero`, `:3000` ni `:3101`. El full requiere que el orquestador arranque el servidor **construido desde HEAD** y el túnel fuera de este carril. No se cita como verde actual.
- **Build identity:** `npm run build` sella `BUILD_SHA`/`.next/BUILD_SHA` y `/api/health` devuelve el SHA. Un servidor de otro commit se rechaza antes de correr runtime.
- **Artefactos:** los JSON/PNG de mobile, checkout, motion, contraste, mobile-320, p0, rehearsal, tunnel y film están ignorados; escribirlos no ensucia `gitAtEnd`. El JSON de `p0-dinero` está ignorado y **no trackeado**; correr ese gate deja `git status` limpio. `latest.json`/`latest-static.json` y `runs/` también son locales. El QR y el video siguen siendo entregables versionados; el MP4 existente es histórico y se regrabará.
- **Exactitud:** los markers se validan con límites de palabra. `0 FAIL` no acepta `10 FAIL`; `lint` exige `LINT OK`, no la palabra `eslint`.
- **Cobertura nueva del full:** `security`, `data`, `perf`, `p0-venta`, `p0-fiado`, `p0-corte`, `p0-integracion`, `p0-dinero`, `checkout` (aislado 3215) y `mobile-320`.
- **Voz:** el botón de $50 reproduce Kokoro `em_santa` (SHA-256 `24EF2C9F…`), 0 llamadas a `speechSynthesis`; las dinámicas van a Piper y los montos se normalizan (`70.00 pesos` → “70 pesos”). **No hay fallback a la voz del navegador**.
- **Movimiento:** barrido de papel ASLI de 300 ms entre tabs, tabs 160 ms, títulos 240 ms, listas 180 ms con stagger ≤84 ms, hojas 220 ms, marcador 180 ms, sello 240 ms y veta de scroll nativa.

## Qué está construido

- Caja: venta por voz/texto, draft, efectivo, fiado, link/QR, verificación de comprobante.
- Cobros pendientes (P0-E): franja en Caja, 3→50, fechas Hoy/Ayer, refresh en focus/visibility y polling de 45 s visible.
- Pendientes de negocio (P0-G): quinto tab, crear/completar/reabrir/posponer/eliminar, reset de demo sin tareas fantasma.
- Venta mixta: efectivo + fiado + remanente digital con Link/QR/demo; resultado “Pago mixto”.
- Voz: Kokoro `em_santa` para frases fijas, Piper para dinámicas, montos hablados.
- Corte (P0-D mergeado): borrador no destructivo, cierre versionado `cash_closes` con `snapshot_known`, retiro previo explícito, idempotencia `requestId`/`expectedVersion` 409, historial con v1, migración transaccional con recovery y `requestId` seguro también fuera de contexto seguro.
- Movimiento: sistema “papel que se asienta” en `MOTION.md`, CSS nativo, scroll trigger y reduced-motion.
- Dirección visual: “papel editorial” con Manrope + Fraunces, grano fijo, doble marco, Caja a dos columnas desde 1280, nota de mercado en sidebar y botones tipo sello. Contrato actualizado en `HIG-DESIGN.md` §16.
- Meta: apartado declarado, progreso.
- Accesibilidad: 48 px, 200%, alto contraste, voz, repetir, leer pantalla, movimiento reducido.
- Demo: `demo_paid`, sellos, video histórico, QR, runbook.
- Stageshow: `demo/stageshow/` + `web/scripts/film-check.py`.
- Harness v2: `HARNESS.md`, `harness/EVALS.md`, `harness-gate.mjs`, `harness-guard.mjs`, `check-deps.mjs`, `run-types.mjs`, `build-gate.mjs`, `lint-gate.mjs`, `verify-evidence.mjs`, `harness-report.mjs`, tests del gate y `/api/health`.

## Matiz sobre `paid` (no simplificar)

- El **webhook firmado de pey** es el único camino que transiciona un pago digital `payment_pending → paid` y valida firma, monto, moneda y `clientReferenceId`.
- El **efectivo** no pasa por `payment_pending`: `orders.ts` inserta el pago `cash` con `payments.status='paid'` y cierra la orden como `paid` (o `fulfilled` si hay fiado) al crear la venta. Eso es deliberado y no es un webhook.
- El **demo** usa `demo_paid`, nunca `paid` como estado de pago simulado.
- `paid` también aparece en **lecturas/consultas** (`WHERE status IN ('paid','demo_paid')`) y en `payments.status` del efectivo. La invariante correcta es: **ningún pago digital pendiente pasa a `paid` sin webhook firmado; el efectivo se registra como `paid` al crear la venta; el demo usa `demo_paid`**.

## F0 y P0-A/B

- **F0 completado:** `AUDITORIA-COGNITIVA.md` + `harness/f0-venta.md`, `f0-dinero.md`, `f0-shell.md`.
- **P0-A/B mergeado:** `c22e85d` — venta manual, cambio, validación inline, borrador durable y pendiente de cobro durable.
- **P0-C mergeado:** `586f1a6` — abono confirmado, saldo vivo, idempotencia durable y migración de `request_id`.
- **P0-C.1/E/G integrados:** `96381b9` + `76bfbc3` — cobros pendientes, tareas de negocio, método de abono, venta mixta, carrera de refresco, WCAG 2.5.3 y voz de $50.
- **Evidencia P0-A/B:** `web/scripts/p0-venta-e2e.py` → 65 PASS · 0 FAIL · 0 KNOWN.
- **Evidencia P0-C:** `web/scripts/p0-fiado-e2e.py` → 51 PASS · 0 FAIL · 0 KNOWN.
- **Evidencia integración:** `web/scripts/p0-integracion-e2e.py` → 51 PASS · 0 FAIL · 0 KNOWN.
- **Evidencia corte:** `web/scripts/p0-corte-e2e.py` → 69 PASS · 0 FAIL · 0 KNOWN.
- **Evidencia dinero:** `web/scripts/p0-dinero-e2e.py` → 45 PASS · 0 FAIL · 3 KNOWN.
- **Evidencia shell:** `web/scripts/p0-shell-e2e.py` → 68 PASS · 0 FAIL; HIG/axe 0. Es carril aparte, no gate del full.
- **Pagos intactos:** `orders.ts`, `pey-events.ts`, `/api/webhooks/pey` y `/api/verify` no cambiaron desde `586f1a6`; `truth` y webhook 40/40 siguen como última corrida conocida, no re-corridos contra HEAD.

## Siguiente tarea

**Corrida final y pruebas humanas.** La base de código es `fabe7cc`; el HEAD del worktree añade el commit de docs. El build conocido es `2a1f166` y no vale como identidad de ese HEAD. El harness exige `static` 5/5 y `full` 23/23 (24 con film) sobre árbol limpio y servidor con `buildSha` del mismo commit. Siguiente: construir desde el HEAD del worktree (docs ya commiteados), arrancar `:3000` con la DB correcta y `APP_URL` en `.env.local`, generar los artefactos de preflight, `npm run verify:full`, `npm run verify:evidence`, repetir los cuatro E2E cognitivos y ensayar `GUION-3-MIN.md` con cronómetro. Las pruebas humanas (0/6–8 comerciantes, SUS/NASA-TLX, TalkBack/VoiceOver, teléfono físico, zoom real) siguen pendientes y no se sustituyen con gates automáticos.

## Corrida final (instrucciones)

1. Commitear código y docs en `p0/fix-harness-p0` y verificar `git status --porcelain --untracked-files=all` vacío.
2. `cd web && npm run test:harness` → 58/58.
3. `npm run verify:static` → 5/5, `ok:true`, `serverBuildSha === gitAtStart.sha`, `gitAtEnd.dirty:false`, y `latest-static.json` (sin pisar `latest.json`).
4. `npm run verify:evidence -- --static` → PASS contra HEAD. `latest.json`/`latest-static.json` son locales y no se versionan; no los commitees.
5. Para el full: construir (`npm run build`), arrancar servidor y túnel **explícitamente** fuera de este worktree/carril, luego `npm run verify:full` → 23/23, o `npm run verify:full -- --with-film` → 24/24. Correr `npm run verify:evidence` otra vez.
6. `npm run harness:report` y pegar la tabla en este archivo solo si la corrida es de este HEAD.

## Bloqueos reales

- **Pago real de $0.01:** no hubo pago real. BBVA/CoDi se traba al seleccionar cuenta. No presentar demo como real; la demo usa `demo_paid`.
- **Teléfono físico 360/320 px + TalkBack/VoiceOver:** no probado.
- **6–8 comerciantes + SUS/NASA-TLX:** protocolo disponible en `TEST-USUARIO.md`; **0/6–8 ejecutadas**.
- **Full runtime:** no ejecutado contra el HEAD (base `fabe7cc` + docs); `:3000` no responde y el build conocido es `2a1f166`. Falta la corrida final 23/23 (24 con film) con servidor y túnel controlados por el orquestador.
- **Offline para ventas no bancarias:** no implementado.
- **Hermes:** capa separada; no iniciada en este repo.
- **Túnel:** quick tunnel efímero; vivo al 2 nov 2026: `https://involve-picking-wellness-retreat.trycloudflare.com` (preview `397039d`). El del QR (`timing...`) no resuelve. Si cambia, actualizar `APP_URL`, QR, PDF y preflight.

## Cómo refrescar este estado

```bash
cd web
npm run test:harness      # 58 tests
npm run verify:static     # 5/5, árbol limpio, buildSha === HEAD
npm run verify:evidence   # latest.json (full) o latest-static.json (--static) contra HEAD
npm run harness:report    # tabla para este archivo
```

Para el full (servidor y túnel ya vivos, fuera de este carril):

```bash
npm run verify:full                 # 23/23
npm run verify:full -- --with-film  # 24/24
npm run verify:evidence
```

## Archivos que no se deben tocar sin contexto

- `GOAL.md`: invariantes de dinero.
- `web/src/lib/orders.ts`, `web/src/app/api/webhooks/pey/route.ts`, `web/src/lib/pey-events.ts`.
- `.env.local` (no versionado).
- `demo/` generado: se regenera con scripts, no se edita a mano. El QR y el video son entregables; el MP4 existente es histórico (UI vieja) y se regrabará. Los JSON/PNG de auditorías están ignorados.
- `SWARM/`: puede ser trabajo del usuario/orquestador; leer antes de modificar.
