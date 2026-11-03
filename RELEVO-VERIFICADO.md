# Relevo verificado — Mercado Cero

> **Para empezar aquí.** Fecha: 2 nov 2026, 22:40. Worktree:
> `mercado-cero-consolidacion`, rama `p0/consolidacion`, base `fabe7cc` más un commit de docs (SHA en la entrega).
> **No se mergeó nada; no se tocó la app, `:3000`, `:3230`, la preview ni
> otros worktrees.** Cada afirmación de abajo se contrastó con git, código,
> tests o `GET` de solo lectura; los reportes viejos se tratan como hipótesis.

## Estado en una frase

La rama de trabajo **`p0/consolidacion`** contiene la final `p0/final-cognitive`
(`fabe7cc`) más los documentos verificados. `master` es su ancestro y el
fast-forward es posible **a `p0/consolidacion`**, no a la final sola. P0-1,
P0-2, P1-1, P1-3 y P1-5 están corregidos, pero **no hay build ni
`latest.json`/full del HEAD, `:3000` está caído, el túnel/QR vigente está
muerto y el video es histórico**. El cierre no está hecho y no se debe mergear
todavía.

| Dato | Valor verificado |
|---|---|
| `master` | `git rev-parse master`; al generar: `529bddb` (solo docs) |
| Rama de código | `p0/final-cognitive` = `fabe7cc09bca0031233ac893a4d3d9c330c921c5` |
| Worktree de consolidación | `p0/consolidacion` = `fabe7cc` + docs; al generar: `2eecf09` |
| Relación | `master` es ancestro de `p0/consolidacion`; **ff-only a consolidación**, no a la final sola. `master..consolidacion` = 30 al generar; verifica con git |
| Build conocido | `2a1f166ba5b11990b6ddd0319caba01fcf2d1990` (2026-11-03T04:21:10Z); padre de `fabe7cc` |
| Diferencia build→`fabe7cc` | solo `payment-truth-e2e.py` y `companion-preferences-e2e.json`; **código de app idéntico**. El HEAD de consolidación añade docs. |
| `:3000` | **no responde** |
| Preview `:3230` / pública | `2a1f166ba5b11990b6ddd0319caba01fcf2d1990` (`involve-picking-wellness-retreat.trycloudflare.com`) | Build con fixes P0; **no es el HEAD** |
| `:3302` | `2a1f166...` |
| Túnel `timing-brought-lamp-aberdeen...` | **DNS no resuelve**; el QR lo usa |
| `harness/evidence/latest*.json` | **no existen** en este worktree |
| `master` contiene la final/consolidación | **No**; la rama de trabajo está 30 commits adelante |

## 5 cosas que sí están hechas (verificadas)

1. **P0-1 — reset seguro.** `resetDemoData` responde 409 si existe cualquier
   pago `provider='pey' AND status='paid'`, aunque `demo=1`; el 409 no borra
   pedido ni pago; `FORCE` los conserva. `preservedRealPayments` se calcula
   después del borrado. Código: `web/src/lib/db.ts:1997-2078`;
   `web/src/app/api/demo/reset/route.ts`. E2E: 409, filas sobreviven, FORCE 200.
   **Matiz:** `preservedRealPayments` cuenta pedidos distintos, no filas de
   pago; para filas está `realPayments`.
2. **P0-2 — `/` privada.** `next.config.ts:187-193` aplica
   `private, no-store, max-age=0, must-revalidate` a `/`. Runtime en `:3302`
   (build `2a1f166`): header correcto. La preview `397039d` todavía sirve
   `public, s-maxage=60`; no es el build corregido.
3. **P1-1 — webhook demo aislado.** Un webhook firmado en demo deja
   `demo_paid`, no suma a `verifiedDigitalCents`, suma a `demoDigitalCents` y
   `fulfill` responde 409 `demo_not_deliverable`. Código:
   `web/src/lib/orders.ts:669-687,967-977`; `db.ts:1794-1808`. E2E lo prueba.
4. **P1-3 — verify exige referencias.** Una transacción PAID sin
   `metadata.orderId`/`externalMetadata.orderId`/`clientReferenceId`/`payableId`
   devuelve `verified:false`/`reference_mismatch`; con la referencia correcta
   devuelve `verified:true`. Código: `web/src/app/api/verify/route.ts:212-248`.
5. **P1-5 — totales honestos.** `pendingCentsTotal`, `creditsOpenTotal`,
   `creditsCustomersTotal` y `creditsBalanceCents` salen del servidor; la UI
   dice "50 de 52", "$171.00", "100 de 102 fiados", "$151.00". Código:
   `web/src/lib/dashboard.ts`, `db.ts:1437-1465,1670-1713`,
   `pending-payments.tsx`, `caja-app.tsx`. E2E con 52 pendientes/102 fiados.
   No hay paginación completa: solo se declara el truncamiento.

## 5 cosas que faltan (bloquean el cierre)

1. **Full + evidencia del HEAD.** No existe `latest.json`; el full 23/23,
   `verify:evidence`, `serverBuildSha === HEAD` y `dirty:false` siguen
   pendientes. El build conocido es `2a1f166`, no `fabe7cc`.
2. **Servidor final `:3000` + preflight.** `:3000` está caído. El preflight
   lee `APP_URL` de `web/.env.local` (no de `$env:APP_URL`) y exige
   `mobile-audit.json`, `checkout-audit.json` y `tunnel-smoke.json`; hoy no
   puede dar 18/18.
3. **Túnel/QR/video final.** El túnel vivo (`involve...`) sirve `2a1f166`
   (build con fixes P0, no el HEAD); el túnel `timing...` del QR no resuelve. El MP4 es histórico
   (39.8 s, $570); los scripts de `p0/fix-video` (`c395e3e`) no están
   integrados (`demo_ui.py` ausente; `record-demo.py` hardcodea `:3000`).
4. **P1-4 / accesibilidad / auth / pago real.** El 404 de checkout sigue
   siendo **HTTP 200**; no hay `@media (forced-colors: active)`. El audit de
   `b7154ca` reportó que a 320 px/200 % Fiar/Cobrar quedan bajo el pliegue,
   pero no se re-midió en este carril. No hay auth de sesión, pago real de
   $0.01, TalkBack/VoiceOver ni teléfono físico/estudio.
5. **Merge y docs viejos.** `master` no contiene la final; README sigue
   diciendo "desplegado en producción"; `demo/STATUS`, `RUNBOOK`, `STATE` y
   `GOAL` ya tienen el estado actualizado pero conservan tablas históricas.
   No mergear hasta que 1–3 estén verdes.

## Comandos siguientes (correctos)

```powershell
cd "C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero-consolidacion"
git status --short
git rev-parse HEAD master p0/final-cognitive
git merge-base --is-ancestor master HEAD; $LASTEXITCODE   # 0
git rev-list --left-right --count master...HEAD           # 0   28

cd web
npm ci
npm run build
$env:DATABASE_PATH="$env:TEMP\opencode\demo-final.db"
$env:DEMO_MODE='true'
$env:APP_URL='https://TU-TUNEL.trycloudflare.com'
$env:OPENAI_API_KEY=''
npx next start -H 127.0.0.1 -p 3000
```

En `web/.env.local` (ignorado; no versionar):

```text
DEMO_MODE=true
APP_URL=https://TU-TUNEL.trycloudflare.com
```

Reset, artefactos, preflight y evidencia:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:3000/api/demo/reset `
  -ContentType 'application/json' -Body '{}'
python scripts/mobile-audit.py
python scripts/checkout-audit.py
python scripts/tunnel-smoke.py
node scripts/preflight.mjs
npm run verify:full       # 23/23; no --skip/--only
npm run verify:evidence   # PASS contra HEAD
```

E2E (mismo build; cerrar `:3302` o usar otro puerto para el de cierre):

```powershell
python scripts/p0-adversarial-e2e.py
python scripts/payment-truth-e2e.py
python scripts/sin-ia-e2e.py
python scripts/companion-preferences-e2e.py

# closing-checklist exige :3302 y rechaza :3000/:3230
$env:DATABASE_PATH="$env:TEMP\opencode\closing-final.db"
$env:DEMO_MODE='true'
npx next start -p 3302
python scripts/closing-checklist-e2e.py
```

Solo después de full/evidence y de que el servidor sirva el HEAD:

```powershell
git checkout master
git merge --ff-only p0/consolidacion   # fabe7cc + docs; si se exige final, ff de final a consolidacion primero
```

> No prometas 23/23: no se ejecutó. Si cambias un doc o un test después del
> full, el SHA cambia y hay que reconstruir y repetir full/evidence.

## Qué no creer

- **"Full 23/23"** — no existe `latest.json`; es pendiente.
- **"La preview es la final"** — `:3230`/pública sirven `397039d`; `:3302`
  sirve `2a1f166`; la base de código es `fabe7cc` y el HEAD del worktree
  añade el commit de docs.
- **"El túnel/QR está vivo"** — `timing...` no resuelve; el QR actual no se
  imprime.
- **"payment-truth 35/35"** — no hay JSON ni SHA; el script cambió en
  `fabe7cc` después del build. Las capturas son de `2a1f166`.
- **"preferences 26/26 es evidencia válida"** — el JSON dice `dirty:true` y
  `sha=2a1f166`; HARNESS exige `dirty:false` y SHA del HEAD.
- **"master ya tiene la final"** — 28 commits de diferencia.
- **"El 404 está resuelto"** — `/pay/no-existe` y `/success` devuelven 200.
- **"Hay auth/offline/pago real/pruebas humanas"** — no.
- **"p0/cognitive-integration se puede mergear"** — está obsoleta. Tampoco
  está integrada `p0/fix-video`.

## Regla de cierre

**No mergear ni declarar listo sin `verify:full` 23/23 y
`verify:evidence` PASS sobre el mismo HEAD, con `dirty:false`,
`serverBuildSha === HEAD` y los E2E repetidos/identificados.** Un `--skip`,
`--only`, un build de otro SHA o un JSON `dirty:true` no cuentan.
