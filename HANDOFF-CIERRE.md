# Handoff — cierre de Mercado Cero

> **Fecha:** 2 de noviembre de 2026, 22:40 (America/Mexico_City).
> **Worktree:** `mercado-cero-consolidacion` — rama `p0/consolidacion`, un commit de docs encima de la base `fabe7cc` (el SHA del commit de docs se reporta en la entrega).
> **Regla:** este documento manda sobre reportes viejos. No mergear ni declarar
> listo sin `verify:full` 23/23 y `verify:evidence` sobre el HEAD entregado.

> **⛔ NO MERGEAR TODAVÍA / NO DECLARAR LISTO.** Los P0 adversarios están
> corregidos y el código de app no ha cambiado desde el build `2a1f166`, pero
> **no existe full ni `latest.json` atado al HEAD entregado** (base `fabe7cc`
> + docs), `:3000` está
> caído, el túnel/QR documentado está muerto y el video es histórico. El
> fast-forward a `master` sigue sin ejecutarse y no debe hacerse antes de la
> evidencia final.

## 0. Estado en una frase

La rama final `p0/final-cognitive` (`fabe7cc`) contiene el diseño estructural,
los cuatro carriles cognitivos y el fix adversario; `master` (`a85d903`) sigue
28 commits atrás y es ancestro, pero **falta build/full/evidencia del HEAD,
servidor `:3000`, túnel/QR vigente y video final**. La demo no está cerrada.

## 1. SHAs y relación de ramas

Verificado con `git rev-parse`, `git merge-base --is-ancestor` y
`git rev-list --left-right --count` el 2 nov 2026.

| Objeto | SHA | Nota |
|---|---|---|
| `master` | `a85d903936af607e3c209fedceb2a40d8410a66e` | Rama publicada; solo docs de bloqueo sobre `d35c791`. |
| `p0/final-cognitive` | `fabe7cc09bca0031233ac893a4d3d9c330c921c5` | Rama final candidata. |
| Worktree de consolidación | `p0/consolidacion` = `fabe7cc` + commit de docs | El commit de docs no es auto-referenciable; `git log -1` lo da. |
| Merge-base | `a85d903` | `master` es ancestro de la final. |
| Commits que la final tiene de más | **28** | `git rev-list --count master..p0/final-cognitive` = 28; `final..master` = 0. El worktree suma 1 docs = 29. |
| Fast-forward | **Posible, no ejecutado** | `master` es ancestro de `fabe7cc` y del commit de docs; ff-only a cualquiera de los dos es posible. |
| Build conocido | `2a1f166ba5b11990b6ddd0319caba01fcf2d1990` | Construido 2026-11-03T04:21:10Z; es el padre de `fabe7cc`. |
| `:3000` | — | No responde al 2 nov 22:35. |
| Preview `:3230` | `397039d212452b2950935d745cd8a1781040923e` | Build viejo; no es la final. |
| `:3302` | `2a1f166...` | Servidor del cierre cognitivo; build conocido, no HEAD. |
| Preview pública | `https://involve-picking-wellness-retreat.trycloudflare.com` | Sirve `397039d`; quick tunnel efímero. |
| Túnel del QR y de docs históricos | `https://timing-brought-lamp-aberdeen.trycloudflare.com` | **DNS no resuelve**; los docs ya apuntan a `involve...` como preview, no como final. |

**Diferencia entre `2a1f166` y `fabe7cc`:** solo
`web/scripts/payment-truth-e2e.py` (3 líneas de asserts) y
`harness/evidence/companion-preferences-e2e.json`. **No cambia código de app**
(`git diff --name-only 2a1f166..fabe7cc -- web/src web/next.config.ts web/package.json`
vacío). Aun así, `buildSha !== HEAD`; para el cierre hay que reconstruir.

## 2. P0/P1: qué está corregido y con qué evidencia

El fix está en `ac9e5a6` (código/tests) y `7131f4e` (reporte), mergeado en
`2a1f166`. El E2E adversario se corrió contra build `2a1f166`, no contra
`fabe7cc`; el código de app es el mismo, pero la identidad no.

| ID | Estado | Evidencia verificada | Límite |
|---|---|---|---|
| **P0-1** reset con pago pey firmado | **Corregido** | `resetDemoData` bloquea con 409 si hay cualquier `provider='pey' AND status='paid'`, aunque `demo=1` (`web/src/lib/db.ts:1997-2011`); el DELETE conserva esos pagos y sus pedidos (`:2017-2049`); `preservedRealPayments` se cuenta **después** del borrado (`:2053-2058`). E2E: 409, filas sobreviven, FORCE 200 conserva pago/pedido. | `preservedRealPayments` cuenta **pedidos distintos** con pago firmado, no filas de pago; el número de filas es `realPayments`/`realPaymentCount`. El E2E compara contra `SELECT DISTINCT order_id`, por eso su PASS es consistente, pero el nombre del campo puede confundir. Varios de sus detalles imprimen "fila borrada" aun en PASS; el assert sí comprueba existencia. |
| **P0-2** `/` con caché pública | **Corregido** | `next.config.ts:187-193` aplica `private, no-store, max-age=0, must-revalidate` a `/`. Runtime en `:3302` (build `2a1f166`): `Cache-Control: private, no-store, max-age=0, must-revalidate`. E2E exige `private`, `no-store`, sin `public`/`s-maxage`. | La preview `:3230`/pública sigue sirviendo `397039d` con `public, s-maxage=60`; no es el build corregido. El HTML privado sigue en el primer paint; hace falta Access/auth para exponerlo. |
| **P1-1** webhook firmado en demo | **Corregido** | `recalculateOrderTotals` decide por `payments.demo` (`web/src/lib/orders.ts:669-687`): un pago `demo=1` deja `demo_paid`; `fulfillOrder` devuelve 409 `demo_not_deliverable` (`:967-977`); `getDailySummary` manda cualquier `payments.demo=1` al bucket demo (`web/src/lib/db.ts:1794-1808`). E2E: `demo_paid`, `verifiedDigitalCents` sin cambio, `demoDigitalCents +1000`, fulfill 409. | El caso mixto demo/real en una misma orden no está cubierto por el E2E; el webhook demo probado sí. |
| **P1-2** auth de sesión | **Abierto (limitación)** | No hay middleware/sesión; solo CSRF, rate limit y token de reset. `web/SECURITY.md` lo declara. | No presentar la demo pública como protegida. Cloudflare Access es la única barrera externa. |
| **P1-3** `/api/verify` sin referencias | **Corregido** | `hasReferenceMismatch` devuelve `true` si una transacción PAID no trae `metadata.orderId`, `externalMetadata.orderId`, `clientReferenceId` ni `payableId` (`web/src/app/api/verify/route.ts:212-248`). E2E con mock: sin refs `verified:false`/`reference_mismatch`; con `metadata.orderId` correcto `verified:true`. | Validado con mock, no con payload real de pey. |
| **P1-4** 404 de checkout/success | **Abierto** | GET `/pay/no-existe` y `/pay/no-existe/success` devuelven **HTTP 200** en `:3230` (`397039d`) y `:3302` (`2a1f166`); el body sí muestra "No encontramos este cobro". | Next 16 + Cache Components; el status HTTP no es 404. La UI es correcta, el contrato HTTP no. |
| **P1-5** totales/conteos truncados | **Corregido (honestidad, no paginación completa)** | `pendingCentsTotal`, `creditsOpenTotal`, `creditsCustomersTotal`, `creditsBalanceCents` en `web/src/lib/dashboard.ts:49-64,111-144`; queries en `db.ts:1437-1465,1670-1713`; UI muestra "50 de 52", "$171.00", "100 de 102 fiados", "$151.00" (`pending-payments.tsx:104-150,231-234`; `caja-app.tsx:3001-3008,6562-6565`). E2E contra 52 pendientes/102 fiados. | No hay botón para cargar pendientes 51+ ni fiados 101+; la UI declara el truncamiento y el total es del servidor. Límites de API siguen en 100/200. |

### P2 conocidos que siguen abiertos o parciales

- **P2-1:** "Recordatorios" y "Explicaciones" se guardan pero solo "Sugerencias"
  tiene consumidor; el E2E de preferencias prueba persistencia, no efecto.
- **P2-2:** "Antes de cerrar" sigue diciendo "Esperando confirmación" a un
  pedido `confirmed` sin link (`closing-checklist.tsx:606`).
- **P2-3:** el success de un fiado ya saldado sigue mostrando "Quedó a fiado".
- **P2-4:** el conteo de personas se corrigió en Caja con
  `creditsCustomersTotal`; no hay E2E específico de dos fiados del mismo cliente.
- **P2-5:** no hay reglas `@media (forced-colors: active)` (0 coincidencias).
- **P2-6:** `/api/demo/pay` no es atómico multi-proceso; no reproducido.
- **P2-7:** README sigue diciendo "desplegado en producción"; la única URL viva
  es un quick tunnel de preview.

## 3. Evidencia E2E: qué prueba y qué no

Todo se corrió el 2 nov entre 22:21 y 22:24, **después del build `2a1f166` y
antes del commit `fabe7cc` (22:25)**. El código de app es idéntico, pero la
evidencia no está atada a `fabe7cc` y el árbol estaba sucio en algunos casos.

| Suite | Resultado | Artefacto | Build/SHA | ¿Vale para cierre? |
|---|---|---|---|---|
| `p0-adversarial-e2e.py` | **28/28 PASS** | `mercado-cero-rehearsal/harness/evidence/p0-adversarial-e2e.json` | `buildSha=2a1f166`; sin `gitAtStart` | **No**: build viejo y sin SHA/dirty. Sirve como prueba del fix. |
| `payment-truth-e2e.py` | **35/35 declarado** | solo capturas en `%TEMP%\opencode\verdad-pago` (22:23); sin JSON | sin SHA/build | **No**: no hay artefacto machine-readable; el script cambió en `fabe7cc` **después** del build. |
| `closing-checklist-e2e.py` | **18/18 PASS** | `%TEMP%\opencode\cierre-cognitivo\closing-checklist-e2e.json` | `baseUrl=:3302`, un result dice build `2a1f166`; sin `gitAtStart` | **No**: build viejo y sin SHA/dirty. |
| `sin-ia-e2e.py` | **21/21 PASS + 1 NOTE** | `%TEMP%\opencode\sin-ia\sin-ia-e2e.json` (22:24) | sin SHA/build | **No**: sin identidad. |
| `companion-preferences-e2e.py` | **26/26 PASS** | `harness/evidence/companion-preferences-e2e.json` (versionado) | `gitAtStart.sha=2a1f166`, `dirty:true` | **No**: HARNESS exige `dirty:false` y SHA del HEAD. |

**El full 23/23 no incluye estos cuatro E2E cognitivos.** El catálogo tiene 25
gates; `full` corre 23 (24 con film). No se puede sustituir su corrida por el
full. Hay que repetirlos sobre el build del HEAD y guardar JSON con
`gitAtStart.sha`, `buildSha` y `dirty:false` (o dejar constancia explícita de
que el script no lo escribe).

## 4. Lo que falta, en orden

1. **Commit de docs** (este trabajo). Después de este commit, el HEAD de la
   rama final cambia; cualquier build/full anterior deja de ser evidencia.
2. **Build desde ese HEAD** y servidor `:3000`:
   `npm ci && npm run build`, `npx next start -H 127.0.0.1 -p 3000`.
   `/api/health` debe devolver `buildSha === HEAD`.
3. **Entorno**: en `web/.env.local` (ignorado, no versionar)
   `DEMO_MODE=true` y `APP_URL=https://<túnel-vivo>`. El preflight lee
   `APP_URL` de `.env.local`, **no** de `$env:APP_URL`.
4. **Reset demo** y artefactos que exige el preflight:
   `python scripts/mobile-audit.py`, `python scripts/checkout-audit.py`,
   `python scripts/tunnel-smoke.py`, luego `node scripts/preflight.mjs`.
   Hoy el preflight no puede dar 18/18: faltan esos tres JSON y `APP_URL`.
5. **Full 23/23** y `npm run verify:evidence` sobre el mismo HEAD. Sin
   `--skip`/`--only`; un `partial` no cuenta.
6. **Repetir E2E** sobre el mismo build y persistir JSON con SHA:
   adversarial, payment-truth, sin-ia, closing (necesita `:3302`, se niega a
   `:3000`/`:3230`) y preferences. `closing` requiere un servidor aparte;
   no reutilizar el `:3302` actual sin detenerlo/rebuild.
7. **Túnel/QR**: crear un túnel para el `:3000` final, actualizar `APP_URL`,
   regenerar `demo/qr-demo.*` y verificar el link. El QR actual apunta a
   `timing...`, que no resuelve.
8. **Video/Stageshow final**: los scripts de `p0/fix-video` (`c395e3e`)
   **no están integrados**; `demo_ui.py` no existe en HEAD y `record-demo.py`
   hardcodea `:3000`. Integrar los scripts, rebuild y grabar con corte $550.
   El MP4 actual es histórico (39.8 s, $570).
9. **Docs viejos**: README sigue diciendo "producción"; `demo/STATUS`,
   `RUNBOOK`, `STATE` y `GOAL` ya tienen el estado actualizado, pero conservan
   tablas históricas. No convertirlas en evidencia.
10. **Solo después**: `git checkout master && git merge --ff-only
    p0/consolidacion`, verificar que `master` apunta al HEAD entregado y que
    el servidor sigue sirviendo ese SHA. Si se exige que la rama final sea
    `p0/final-cognitive`, primero hay que llevar estos docs a esa rama
    (`git checkout p0/final-cognitive && git merge --ff-only p0/consolidacion`)
    y reconstruir; no construir desde `fabe7cc` y añadir docs después. No hay
    merge que resolver; el fast-forward es posible, pero **no se ejecutó en
    este carril**.

## 5. Comandos siguientes (PowerShell)

Verificación de git antes de tocar nada:

```powershell
cd "C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero-consolidacion"
git status --short
git rev-parse HEAD master p0/final-cognitive
# HEAD = commit de docs sobre fabe7cc; final = fabe7cc
git merge-base --is-ancestor master HEAD; $LASTEXITCODE   # 0
git rev-list --left-right --count master...p0/final-cognitive  # 0   28
git rev-list --left-right --count master...HEAD                # 0   29 (28 + docs)
```

Build y servidor final (desde el HEAD que se va a entregar):

```powershell
cd web
npm ci
npm run build
$env:DATABASE_PATH="$env:TEMP\opencode\demo-final.db"
$env:DEMO_MODE='true'
$env:APP_URL='https://TU-TUNEL.trycloudflare.com'
$env:OPENAI_API_KEY=''
npx next start -H 127.0.0.1 -p 3000
```

En otra terminal, `web/.env.local` (ignorado) con:

```text
DEMO_MODE=true
APP_URL=https://TU-TUNEL.trycloudflare.com
```

Reset, artefactos y preflight:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:3000/api/demo/reset `
  -ContentType 'application/json' -Body '{}'
python scripts/mobile-audit.py
python scripts/checkout-audit.py
python scripts/tunnel-smoke.py
node scripts/preflight.mjs
```

Full y evidencia:

```powershell
npm run verify:full       # 23/23, sin --skip/--only
npm run verify:evidence   # PASS, latest.json del HEAD
```

E2E cognitivos (mismo build; guardar stdout/JSON con SHA):

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

> `payment-truth-e2e.py` no escribe JSON: guarda su stdout y el
> `git rev-parse HEAD` + `/api/health` junto a las capturas. `closing` y
> `sin-ia` escriben JSON sin SHA; anexa la identidad manualmente si no se
> modifica el script. `p0-adversarial` sí escribe `buildSha`, pero no
> `gitAtStart`; no lo declares evidencia de cierre sin ese dato.

## 6. Definición de terminado

- [ ] `master` contiene la rama entregada (`p0/consolidacion`, fabe7cc + docs); árbol limpio.
- [ ] `npm run build` desde HEAD; `/api/health` devuelve ese SHA.
- [ ] `npm run verify:full` → 23/23, `ok:true`, `dirty:false`, `buildMatches`.
- [ ] `npm run verify:evidence` → PASS contra HEAD.
- [ ] E2E cognitivos PASS sobre el mismo build, con evidencia identificable.
- [ ] Preflight 18/18 con `APP_URL` en `.env.local` y los tres artefactos.
- [ ] Túnel/QR apuntan al servidor final; `tunnel-smoke` 8/8.
- [ ] Video/Stageshow finales con corte $550 y scripts integrados.
- [ ] Docs sin SHA/URL/conteos falsos; README sin "producción".
- [ ] Computer use final sin P0/P1 **nuevos**; los conocidos (404 HTTP,
      forced-colors, 320/200 %) están corregidos o listados y aceptados.
- [ ] Límites declarados: sin auth de sesión, sin pago real, sin
      TalkBack/VoiceOver ni estudio con comerciantes.

## 7. Qué no creer

- **No hay full 23/23.** No existe `harness/evidence/latest.json` en este
  worktree; el único JSON versionado de evidencia es
  `companion-preferences-e2e.json`, con `dirty:true`.
- **La preview no es la final.** `:3230` y el túnel público sirven `397039d`;
  `:3302` sirve `2a1f166`; la base de código es `fabe7cc` y el HEAD del
  worktree añade el commit de docs.
- **El túnel `timing...` está muerto.** El QR actual no se debe imprimir.
- **"35/35" de payment-truth** no tiene JSON ni SHA; el script cambió después
  del build. No es evidencia de cierre.
- **"26/26" de preferences** es un conteo real, pero la evidencia está dirty y
  atada a `2a1f166`.
- **`master` no contiene la final** (28 commits de diferencia).
- **El 404 de checkout sigue siendo HTTP 200**; no lo declares resuelto.
- **No hay auth de sesión, offline real, pago real de $0.01 ni pruebas
  humanas.** No los presentes como verdes.
- **`p0/cognitive-integration` está obsoleta**; no mergear. `p0/fix-video`
  sigue fuera de la final.

## 8. Dónde consultar

| Archivo | Para qué |
|---|---|
| `RELEVO-VERIFICADO.md` | Página de entrada: estado, hechos, pendientes y qué no creer. |
| `CONTEXTO-VERIFICADO.md` | Índice del contexto importado y de las auditorías; qué es vigente y qué es histórico. |
| `consolidation-report.md` | Método, contradicciones resueltas y límites de esta consolidación. |
| `RELEVO/claims.json` | Tabla máquina-legible de afirmaciones con estado y evidencia. |
| `GOAL-CIERRE-DEMO.md` | DoD y fases de cierre. |
| `demo/STATUS.md` | Estado de demo, cifras, video y límites. |
| `RUNBOOK-DEMO.md` | Operación, túnel, reset, QR/PDF y guion. |
| `harness/STATE.md` | Handoff del harness y estado de gates. |
| `HARNESS.md` | Catálogo real de 25 gates, full 23/24 y reglas de evidencia. |
| `AUDITORIA-ADVERSARIA.md` | Hallazgos originales (snapshot `b7154ca`). |
| `SUPERVISION-RELEVO.md` | Supervisión del handoff (snapshot `b7154ca`). |
| `context/` | Contexto recuperado (snapshot `b7154ca`/`ea1292e`). |
