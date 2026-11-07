# Relevo verificado — Mercado Cero

> **Para empezar aquí.** Fecha: 3 de noviembre de 2026. Worktree:
> `mercado-cero-final-closure`, rama `p0/final-closure`, código base
> `3bf0482` + fix de etiquetado demo/HIG + docs/QR (HEAD = `git rev-parse HEAD`).
> **No se ha mergeado nada; no se tocó `:3230` ni la preview.** Cada afirmación
> de abajo se contrastó con git, código, tests o `GET` de solo lectura; los
> reportes viejos se tratan como hipótesis.

## Estado en una frase

La rama **`p0/final-closure`** contiene la app final (`3bf0482` + fixes), el
**video final** (183.72 s, $550/Cuadra, 8 frames, `FILM OK`), el reporte UX
(**PASS 99/0**, sin P0/P1 nuevos) y estos documentos. Los P0/P1 de dinero y el
etiquetado demo están corregidos. **Falta el full/evidencia sobre este HEAD**:
se ejecuta con `npm run verify:full` y la fuente es
`harness/evidence/latest.json`. `master` sigue en `3bf0482`; el ff-only se hace
solo si full/evidencia pasan.

| Dato | Valor verificado |
|---|---|
| Código base | `3bf0482` (`3bf04827833e89db17384b47a0162598f947a38f`) |
| HEAD de docs | `git rev-parse HEAD` (el commit que contiene este archivo) |
| `master` | `3bf0482` al redactar; ancestro de la rama; ff-only pendiente |
| `p0/final-closure` | `3bf0482` + fix de etiquetado/HIG + docs/QR |
| Build de cierre | `git rev-parse HEAD`; se sella al construir desde HEAD |
| `:3000` | se detiene el servidor de otro worktree y se reconstruye desde HEAD |
| Preview `:3230` | **no se toca** |
| Túnel público | `https://languages-native-greene-bit.trycloudflare.com`; apunta a `:3000`; quick tunnel efímero |
| Video | `demo/mercado-cero-demo.mp4`; 5,406,880 B; 183.72 s; 1280×800; SHA-256 `ba4d068e…`; `FILM OK`; 8 frames |
| UX | `FINAL-UX-REPORT.md`: PASS 99/0; 0 FAIL; sin P0/P1 nuevos; 4 knowns |
| P1 demo | Etiquetado corregido; gate `security` 58/58 (6 checks nuevos) |
| Evidencia | `harness/evidence/latest.json` **aún no existe**; full pendiente |

## Lo que sí está hecho (verificado)

1. **P0-1 — reset seguro.** `resetDemoData` responde 409 si existe cualquier
   pago `provider='pey' AND status='paid'`, aunque `demo=1`; el 409 no borra
   pedido ni pago; `FORCE` los conserva. Código:
   `web/src/lib/db.ts:2005-2085`; `web/src/app/api/demo/reset/route.ts`.
   E2E: 409, filas sobreviven, FORCE 200. **Matiz:** `preservedRealPayments`
   cuenta pedidos distintos, no filas de pago; para filas está `realPayments`.
2. **P0-2 — `/` privada.** `next.config.ts` aplica
   `private, no-store, max-age=0, must-revalidate` a `/`; el runtime y la
   pasada UX lo comprobaron en local y por el túnel.
3. **P1-1 — webhook demo aislado y etiquetado.** Un webhook firmado en demo
   deja `demo_paid`, no suma a `verifiedDigitalCents`, suma a
   `demoDigitalCents` y `fulfill` responde 409 `demo_not_deliverable`. En este
   HEAD, `Payment.demo`/`Order.lastPaymentDemo` viajan a checkout, success y
   Caja; `/api/verify` responde `verified:false, source:demo,
   reason:demo_payment`; analytics separa el demo. Código:
   `web/src/lib/orders.ts:669-687,967-977`; `db.ts:1794-1808`;
   `app/api/verify/route.ts`; `lib/checkout.ts`; `lib/analytics.ts`.
4. **P1-3 — verify exige referencias.** Una transacción PAID sin
   `metadata.orderId`/`externalMetadata.orderId`/`clientReferenceId`/`payableId`
   devuelve `verified:false`/`reference_mismatch`; con la referencia correcta,
   `verified:true`. Código: `web/src/app/api/verify/route.ts:212-248`.
5. **P1-5 — totales honestos.** `pendingCentsTotal`, `creditsOpenTotal`,
   `creditsCustomersTotal` y `creditsBalanceCents` salen del servidor; la UI
   declara el truncamiento y muestra el total real. E2E con 52 pendientes y
   102 fiados. No hay paginación completa.
6. **HIG y security verdes en aislado.** `hig-after-audit.py` → `HIG OK: 5
   viewports` tras añadir `break-words` al bloque de pago; `security-contract`
   → `SEGURIDAD OK: 58/58`, incluidos los 6 checks del P1 demo.

## Lo que falta (bloquea el cierre)

1. **Full + evidencia del HEAD.** No existe `latest.json`; `verify:full`,
   `verify:evidence`, `serverBuildSha === HEAD` y `dirty:false` se ejecutan
   sobre este commit. La fuente será `harness/evidence/latest.json`.
2. **Servidor final `:3000` + preflight.** El servidor de otro worktree ya se
   detuvo; falta reconstruir desde este HEAD, arrancar `:3000` y correr el
   reset + preflight 18/18 con `APP_URL` en `web/.env.local`.
3. **Túnel/QR.** El túnel `auction...` está NXDOMAIN; el vivo es
   `https://languages-native-greene-bit.trycloudflare.com`, apuntando a `:3000`.
   Si el quick tunnel cambia, actualizar `APP_URL`, QR y PDF. No se toca la
   preview `:3230`.
4. **P1-4 / accesibilidad / auth / pago real.** El 404 de checkout sigue siendo
   **HTTP 200** (comprobado el 3 nov 2026); no hay `@media (forced-colors:
   active)`. No hay auth de sesión, pago real de $0.01, TalkBack/VoiceOver ni
   teléfono físico/estudio. Fiar/Cobrar queda bajo el pliegue en móvil (P2 UX).
5. **Merge y docs viejos.** `master` no contiene el commit de cierre; README
   sigue diciendo “desplegado en producción”. El merge queda pendiente de que
   1–2 estén verdes y `verify:evidence` dé PASS.

## Knowns de producto (no bloquean el full)

- Fiar/Cobrar bajo el pliegue en 320/360/200 %; la acción requiere scroll corto.
- TTS dinámico 503 en este entorno; los audios fijos del guion sí se sirven.
- Efectivo demo rotulado “Efectivo recibido” en Actividad, aunque suma al bucket
  demo; no se presenta como cobrado real.
- “Ahora no” es por sesión; “Antes de cerrar” reaparece al recargar.
- “Antes de cerrar” etiqueta “Esperando confirmación” a `confirmed` sin link y
  no avisa el truncamiento de 50 pendientes.
- “Recordatorios” y “Explicaciones” solo persisten, no tienen efecto.
- Un parseo nuevo puede pisar el borrador recuperado sin confirmación.
- “¿Cuánto dinero hay en caja?” responde ventas/cobrado, no
  efectivo/base/gastos/retiros.
- A 320/200 % el nombre del comercio se trunca y el H1 del checkout queda
  topado; `forced-colors` no tiene reglas; `mobile-320` es 60/60.
- Exportación y offline no están implementados: `GOAL-ACOMPANAMIENTO` no se
  declara cumplido completo (sí hay PASS P0 demo con reservas).
- Sin auth de sesión, sin pago real y sin pruebas humanas.

## Comandos siguientes (correctos)

```powershell
cd "C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero-final-closure"
git status --short
git rev-parse HEAD master
git merge-base --is-ancestor master HEAD; $LASTEXITCODE   # 0

cd web
npm ci
npm run build
npx next start -H 127.0.0.1 -p 3000
```

En `web/.env.local` (ignorado; no versionar):

```text
DEMO_MODE=true
APP_URL=https://languages-native-greene-bit.trycloudflare.com
OPENAI_API_KEY=
DATABASE_PATH=C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\final-closure.db
```

Reset, preflight, full y evidencia:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:3000/api/demo/reset `
  -ContentType 'application/json' -Body '{}'
node scripts/preflight.mjs
$env:DATABASE_PATH="C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\final-closure.db"
$env:BASE_URL="http://127.0.0.1:3000"
npm run verify:full       # 23/23; sin --skip/--only
npm run verify:evidence   # PASS contra HEAD
```

Si un gate falla por un flake conocido (webhook, p0-venta, p0-corte, data):
repítelo aislado y vuelve a correr el full; documenta el reintento. Si es un
bug real, detente y repórtalo.

Solo después de full/evidence:

```powershell
git -C ..\mercado-cero merge --ff-only p0/final-closure
git -C ..\mercado-cero rev-parse HEAD
```

> No prometas 23/23 antes de correrlo. Si cambias un doc o un test después del
> full, el SHA cambia y hay que reconstruir y repetir full/evidence.

## Qué no creer

- **“Full 23/23 ya está”** — no existe `latest.json`; es pendiente.
- **“La preview `:3230` es la final”** — no se toca en este cierre.
- **“El video es histórico”** — el MP4 actual es el final: 183.72 s, $550,
  Cuadra, 8 frames, `FILM OK`. Se grabó con `791b590`; los fixes posteriores de
  etiquetado/HIG no cambian el guion, pero no es un MP4 del HEAD exacto.
- **“El P1 de etiquetado demo sigue abierto”** — corregido en este HEAD y
  cubierto por el gate `security` (58/58).
- **“El 404 está resuelto”** — `/pay/no-existe` y `/success` devuelven 200.
- **“Hay auth/offline/pago real/pruebas humanas”** — no.
- **“El túnel está garantizado”** — es un quick tunnel efímero; si cambia,
  hay que regenerar `APP_URL`, QR y PDF.

## Regla de cierre

**El merge y el cierre requieren `verify:full` 23/23 y `verify:evidence`
PASS sobre el mismo HEAD, con `dirty:false`, `serverBuildSha === HEAD` y
`buildSha` por gate.** Un `--skip`, `--only`, un build de otro SHA o un JSON
`dirty:true` no cuentan.
