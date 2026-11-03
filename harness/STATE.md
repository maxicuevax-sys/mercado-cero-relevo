# STATE — Mercado Cero

> Handoff vivo para agentes. Última actualización: **3 de noviembre de 2026**.
> No reconstruyas el estado de memoria: si un dato no está aquí ni en
> `latest.json`/`latest-static.json`, no lo asumas.

## Identidad

- Repo: `mercado-cero`
- App: `web/` (Next.js 16, TypeScript, Tailwind, SQLite `node:sqlite`)
- Modo actual: **demo** (`demo_paid` para simulación; en el camino digital
  `paid` solo por webhook pey firmado; el efectivo se registra `paid` al crear
  la venta)
- URL local: `http://127.0.0.1:3000` (se reconstruye desde el HEAD de cierre)
- URL pública: `https://languages-native-greene-bit.trycloudflare.com` —
  apunta a `:3000`; **quick tunnel efímero**. La preview `:3230` **no se toca**.
  Si el túnel cambia, regenerar `APP_URL`, QR y PDF (ver `demo/STATUS.md`).
- Base de datos: `C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\final-closure.db`
  (temporal, fuera del repo)
- Evidencia: `harness/evidence/latest.json` (full) o `latest-static.json`
  (static), locales e ignorados; solo con `ok:true`
- Reporte: `npm run harness:report` genera la tabla desde el latest

## Corte actual (3 nov 2026)

- **Código base:** `3bf0482` (incluye video final) + fix de etiquetado
  demo/HIG en este HEAD.
- **Rama:** `p0/final-closure` = `3bf0482` + fix de etiquetado/HIG + docs/QR;
  HEAD de docs se confirma con `git rev-parse HEAD`.
- **`master`:** `3bf0482` al redactar; es ancestro; fast-forward a
  `p0/final-closure` **pendiente** de full/evidencia.
- **Build de cierre:** se sella al construir desde HEAD; `/api/health` debe
  devolver ese SHA. El build conocido anterior (`791b590`) **no** vale como
  identidad del HEAD de docs.
- **Servidor `:3000`:** se detiene el de otro worktree y se reconstruye desde
  este HEAD con la DB temporal. **Preview `:3230`:** no se toca.
- **Evidencia atada al HEAD:** ❌ pendiente; `latest.json`/`latest-static.json`
  no existen en este worktree. El full se ejecuta sobre este HEAD y la fuente
  es `harness/evidence/latest.json`.
- **P0/P1 corregidos:** P0-1 (reset 409), P0-2 (caché privada), P1-1 (webhook
  demo → `demo_paid`), P1-1b (checkout/success/Caja/analytics/verify no llaman
  “verificado” a `demo=1`), P1-3 (verify con referencias) y P1-5 (totales
  honestos). Abiertos: P1-2 (auth), P1-4 (404 HTTP 200) y P2 conocidos.
- **Video:** `demo/mercado-cero-demo.mp4` es **final**: 183.72 s, 5,406,880 B,
  1280×800, corte **$550/Cuadra**, 8 frames, `FILM OK`. SHA-256
  `ba4d068e…`. Grabado con build `791b590`; los fixes de etiquetado/HIG no
  cambian el guion. Detalle: `video-final-report.md`.
- **UX:** `FINAL-UX-REPORT.md` — **PASS 99/0**, sin P0/P1 nuevos; 4 knowns.
- **P1 demo:** `security-contract` 58/58, con 6 checks nuevos.
- **HIG:** `hig-after-audit.py` → `HIG OK: 5 viewports` tras `break-words`.
- **Pruebas humanas:** **0/6–8**; TalkBack/VoiceOver y teléfono físico
  pendientes.
- **Pago real:** ❌ no hubo; BBVA/CoDi bloqueado; demo `demo_paid`.
- **Veredicto:** **cierre técnico pendiente de full**; no declarar el cierre.

## Último estado verde conocido (histórico)

> **Histórico, no handoff.** Esta tabla mezcla corridas de días distintos y no
> prueba el commit actual. El handoff vigente es `latest.json` (full) o
> `latest-static.json` (static) + `npm run verify:evidence` contra HEAD.

| Gate | Resultado | Fecha |
|---|---|---|
| Webhook firmado | 40/40 | 2 nov 2026 |
| Verdad del comprobante | demo no verificado | 2 nov 2026 |
| HIG/WCAG 2.2 AA | 5 viewports: 320/360/390/768/1280, axe 0, 48 px, 200 % | 2 nov 2026 |
| Móvil 360 px | 25/25 | 2 nov 2026 |
| Móvil 320/360 (3 motores) | 60 PASS · 0 FAIL | 3 nov 2026 |
| P1 etiquetado demo | 58/58 `SEGURIDAD OK` (6 checks nuevos) | 3 nov 2026 |
| HIG aislado | `HIG OK: 5 viewports` | 3 nov 2026 |
| Checkout público | 19/19, `demo_paid` | 2 nov 2026 |
| Túnel | 8/8 | 2 nov 2026 |
| Ensayo | 3/3, 19/19 pasos, ~8.1 s (master `75179c7`) | 2 nov 2026 |
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
| Film check | 8 beats + contact sheet + motion sheet; `FILM OK` | 3 nov 2026 |
| UX final | PASS 99/0 · 0 FAIL · 4 knowns | 3 nov 2026 |

## Última corrida del harness

- **El SHA de la tabla de gates no se hardcodea.** El código verificado es el
  `gitAtStart.sha` de `harness/evidence/latest.json` (full) o
  `latest-static.json` (static); `npm run verify:evidence` lo compara con HEAD
  y exige árbol limpio, `serverBuildSha === gitAtStart.sha`, `buildSha` por
  gate runtime, set canónico de artefactos y hashes.
- **Catálogo actual:** **25 gates**. `fast` 3, `static` 5, `full` **23** por
  defecto (build fuera, film opcional) y `full --with-film` **24**.
- **`full` no se ejecutó en este worktree.** Se ejecuta sobre este HEAD con
  `:3000` reconstruido y `BASE_URL=http://127.0.0.1:3000`; el resultado vive en
  `harness/evidence/latest.json`. No se cita como verde hasta que
  `verify:evidence` dé PASS.
- **Build identity:** `npm run build` sella `BUILD_SHA`/`.next/BUILD_SHA` y
  `/api/health` devuelve el SHA. Un servidor de otro commit se rechaza antes de
  correr runtime.
- **Artefactos:** los JSON/PNG de mobile, checkout, motion, contraste,
  mobile-320, p0, rehearsal, tunnel y film están ignorados; escribirlos no
  ensucia `gitAtEnd`. `latest.json`/`latest-static.json` y `runs/` también son
  locales. El QR y el video son entregables versionados; el MP4 actual es el
  final.
- **Exactitud:** los markers se validan con límites de palabra. `0 FAIL` no
  acepta `10 FAIL`; `lint` exige `LINT OK`, no la palabra `eslint`.
- **Cobertura del full:** `security`, `data`, `perf`, `p0-venta`, `p0-fiado`,
  `p0-corte`, `p0-integracion`, `p0-dinero`, `checkout` (aislado 3215),
  `mobile-320`, `tunnel` y `preflight`.
- **Voz:** el botón de $50 reproduce Kokoro `em_santa` (SHA-256 `24EF2C9F…`),
  0 llamadas a `speechSynthesis`; las dinámicas van a Piper y los montos se
  normalizan (`70.00 pesos` → “70 pesos”). **No hay fallback a la voz del
  navegador**.
- **Movimiento:** barrido de papel ASLI de 300 ms entre tabs, tabs 160 ms,
  títulos 240 ms, listas 180 ms con stagger ≤84 ms, hojas 220 ms, marcador
  180 ms, sello 240 ms y veta de scroll nativa.

## Qué está construido

- Caja: venta por voz/texto, draft, efectivo, fiado, link/QR, verificación de
  comprobante.
- Cobros pendientes (P0-E): franja en Caja, 3→50, fechas Hoy/Ayer, refresh en
  focus/visibility y polling de 45 s visible.
- Pendientes de negocio (P0-G): quinto tab, crear/completar/reabrir/posponer/
  eliminar, reset de demo sin tareas fantasma.
- Venta mixta: efectivo + fiado + remanente digital con Link/QR/demo; resultado
  “Pago mixto”.
- Voz: Kokoro `em_santa` para frases fijas, Piper para dinámicas, montos
  hablados.
- Corte (P0-D mergeado): borrador no destructivo, cierre versionado
  `cash_closes` con `snapshot_known`, retiro previo explícito, idempotencia
  `requestId`/`expectedVersion` 409, historial con v1, migración transaccional
  con recovery y `requestId` seguro también fuera de contexto seguro.
- Movimiento: sistema “papel que se asienta” en `MOTION.md`, CSS nativo, scroll
  trigger y reduced-motion.
- Dirección visual: “papel editorial” con Manrope + Fraunces, grano fijo, doble
  marco, Caja a dos columnas desde 1280, nota de mercado en sidebar y botones
  tipo sello. Contrato actualizado en `HIG-DESIGN.md` §16.
- Meta: apartado declarado, progreso.
- Accesibilidad: 48 px, 200 %, alto contraste, voz, repetir, leer pantalla,
  movimiento reducido.
- Demo: `demo_paid`, sellos, video final, QR, runbook.
- Stageshow: `demo/stageshow/` + `web/scripts/film-check.py`.
- Harness v2: `HARNESS.md`, `harness/EVALS.md`, `harness-gate.mjs`,
  `harness-guard.mjs`, `check-deps.mjs`, `run-types.mjs`, `build-gate.mjs`,
  `lint-gate.mjs`, `verify-evidence.mjs`, `harness-report.mjs`, tests del gate
  y `/api/health`.

## Matiz sobre `paid` (no simplificar)

- El **webhook firmado de pey** es el único camino que transiciona un pago
  digital `payment_pending → paid` y valida firma, monto, moneda y
  `clientReferenceId`.
- El **efectivo** no pasa por `payment_pending`: `orders.ts` inserta el pago
  `cash` con `payments.status='paid'` y cierra la orden como `paid` (o
  `fulfilled` si hay fiado) al crear la venta. Eso es deliberado y no es un
  webhook.
- El **demo** usa `demo_paid`, nunca `paid` como estado de pago simulado.
- `paid` también aparece en **lecturas/consultas** (`WHERE status IN
  ('paid','demo_paid')`) y en `payments.status` del efectivo. La invariante
  correcta es: **ningún pago digital pendiente pasa a `paid` sin webhook
  firmado; el efectivo se registra como `paid` al crear la venta; el demo usa
  `demo_paid`**.

## F0 y P0-A/B

- **F0 completado:** `AUDITORIA-COGNITIVA.md` + `harness/f0-venta.md`,
  `f0-dinero.md`, `f0-shell.md`.
- **P0-A/B mergeado:** `c22e85d` — venta manual, cambio, validación inline,
  borrador durable y pendiente de cobro durable.
- **P0-C mergeado:** `586f1a6` — abono confirmado, saldo vivo, idempotencia
  durable y migración de `request_id`.
- **P0-C.1/E/G integrados:** `96381b9` + `76bfbc3` — cobros pendientes, tareas
  de negocio, método de abono, venta mixta, carrera de refresco, WCAG 2.5.3 y
  voz de $50.
- **Evidencia P0-A/B:** `web/scripts/p0-venta-e2e.py` → 65 PASS · 0 FAIL ·
  0 KNOWN.
- **Evidencia P0-C:** `web/scripts/p0-fiado-e2e.py` → 51 PASS · 0 FAIL ·
  0 KNOWN.
- **Evidencia integración:** `web/scripts/p0-integracion-e2e.py` → 51 PASS ·
  0 FAIL · 0 KNOWN.
- **Evidencia corte:** `web/scripts/p0-corte-e2e.py` → 69 PASS · 0 FAIL ·
  0 KNOWN.
- **Evidencia dinero:** `web/scripts/p0-dinero-e2e.py` → 45 PASS · 0 FAIL ·
  3 KNOWN.
- **Evidencia shell:** `web/scripts/p0-shell-e2e.py` → 68 PASS · 0 FAIL;
  HIG/axe 0. Es carril aparte, no gate del full.
- **Pagos intactos:** `orders.ts`, `pey-events.ts`, `/api/webhooks/pey` y
  `/api/verify` no cambiaron desde `586f1a6`; `truth` y webhook 40/40 siguen
  como última corrida conocida, no re-corridos contra HEAD.

## Siguiente tarea

**Corrida final.** El código base es `3bf0482`; el HEAD del worktree añade el
fix de etiquetado demo/HIG y los docs/QR. Construir desde ese HEAD, arrancar
`:3000` con la DB temporal y `APP_URL` en `.env.local`, resetear, generar los
artefactos de preflight, `npm run verify:full`, `npm run verify:evidence`, y
solo entonces el fast-forward de `master`. Las pruebas humanas (0/6–8
comerciantes, SUS/NASA-TLX, TalkBack/VoiceOver, teléfono físico, zoom real)
siguen pendientes y no se sustituyen con gates automáticos.

## Corrida final (instrucciones)

1. Commitear código + docs + QR y verificar
   `git status --porcelain --untracked-files=all` vacío.
2. `cd web && npm ci && npm run build` desde el HEAD.
3. `npx next start -H 127.0.0.1 -p 3000` con `DATABASE_PATH` temporal;
   `/api/health` debe devolver el HEAD.
4. `npm run test:harness` → 58/58 (opcional, no gate del full).
5. Reset + `node scripts/preflight.mjs` → 18/18.
6. `npm run verify:full` → 23/23; `npm run verify:evidence` → PASS.
7. Si un gate falla por flake conocido (webhook, p0-venta, p0-corte, data):
   repetirlo aislado, volver a correr el full y documentar el reintento.
8. Solo entonces: `git -C ..\mercado-cero merge --ff-only p0/final-closure` y
   copiar `latest.json` + artefactos ignorados al worktree master.

## Bloqueos reales

- **Pago real de $0.01:** no hubo pago real. BBVA/CoDi se traba al seleccionar
  cuenta. No presentar demo como real; la demo usa `demo_paid`.
- **Teléfono físico 360/320 px + TalkBack/VoiceOver:** no probado.
- **6–8 comerciantes + SUS/NASA-TLX:** protocolo disponible en `TEST-USUARIO.md`;
  **0/6–8 ejecutadas**.
- **Full runtime:** pendiente contra el HEAD; `latest.json` no existe aún.
- **Offline para ventas no bancarias:** no implementado.
- **Hermes:** capa separada; no iniciada en este repo.
- **Túnel:** quick tunnel efímero; vivo al 3 nov 2026:
  `https://languages-native-greene-bit.trycloudflare.com`. Si cambia,
  actualizar `APP_URL`, QR, PDF y preflight.
- **P1-2/P1-4:** sin auth de sesión; el 404 de checkout sigue siendo HTTP 200
  (se intentó mover `notFound()` antes de `connection()`/Suspense; Cache
  Components mantiene el shell y no se forzó con proxy).
- **A11y:** `forced-colors` sin reglas; a 320/200 % el nombre del comercio se
  trunca y el H1 del checkout queda topado; Fiar/Cobrar bajo el pliegue.
  `mobile-320` es **60/60**, no 42/42.
- **Cognitive:** “Antes de cerrar” etiqueta “Esperando confirmación” a
  `confirmed` sin link y no avisa truncamiento de 50; “Recordatorios” y
  “Explicaciones” solo persisten; un parseo nuevo puede pisar el borrador
  recuperado; “¿Cuánto dinero hay en caja?” responde ventas/cobrado, no
  efectivo/base/gastos/retiros.
- **Exportación/offline:** no implementados; `GOAL-ACOMPANAMIENTO` no se
  declara cumplido completo (sí PASS P0 demo con reservas).

## Cómo refrescar este estado

```bash
cd web
npm run test:harness      # 58 tests
npm run verify:static     # 5/5, árbol limpio, buildSha === HEAD
npm run verify:evidence   # latest.json (full) o latest-static.json (--static) contra HEAD
npm run harness:report    # tabla para este archivo
```

Para el full (servidor y túnel ya vivos):

```bash
npm run verify:full                 # 23/23
npm run verify:full -- --with-film  # 24/24
npm run verify:evidence
```

## Archivos que no se deben tocar sin contexto

- `GOAL.md`: invariantes de dinero.
- `web/src/lib/orders.ts`, `web/src/app/api/webhooks/pey/route.ts`,
  `web/src/lib/pey-events.ts`.
- `.env.local` (no versionado).
- `demo/` generado: se regenera con scripts, no se edita a mano. El QR y el
  video son entregables; el MP4 actual es el final. Los JSON/PNG de auditorías
  están ignorados.
- `SWARM/`: puede ser trabajo del usuario/orquestador; leer antes de modificar.
