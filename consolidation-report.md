# Reporte de consolidación — Mercado Cero

> **Worktree:** `mercado-cero-consolidacion`
> **Rama:** `p0/consolidacion`
> **Base:** `fabe7cc09bca0031233ac893a4d3d9c330c921c5` (`p0/final-cognitive`)
> **Fecha:** 2 de noviembre de 2026, 22:40 (America/Mexico_City)
> **Hash de este commit:** no es auto-referenciable; se reporta en la entrega
> final y con `git log -1 --format=%H` en `p0/consolidacion`. El commit
> anterior a estos docs es `fabe7cc`.

## 1. Objetivo y método

Consolidar el relevo **sin confiar en el orquestador ni en los reportes**.
Cada afirmación se trató como hipótesis hasta verificarla en Git, código,
tests o una observación HTTP de solo lectura.

Método aplicado:

1. **Git primario:** `rev-parse`, `merge-base --is-ancestor`,
   `rev-list --left-right --count`, `log --graph --decorate`, `branch -vv`,
   `worktree list`, `status --porcelain`, `diff --name-only/--stat`,
   `show`, `cat-file`.
2. **Código actual de `fabe7cc`:** `web/src/lib/db.ts`, `orders.ts`,
   `dashboard.ts`, `verify/route.ts`, `demo/reset/route.ts`, `next.config.ts`,
   `page.tsx`, `pending-payments.tsx`, `caja-app.tsx`,
   `closing-checklist.tsx`, `companion-preferences.tsx`.
3. **Tests:** `p0-adversarial-e2e.py`, `security-contract.mjs`,
   `webhook-contract.mjs`, `payment-truth-e2e.py`, `closing-checklist-e2e.py`,
   `sin-ia-e2e.py`, `companion-preferences-e2e.py`; se leyó el assert, no solo
   el PASS.
4. **Evidencia local:** JSON en `harness/evidence/` y `%TEMP%\opencode\...`;
   fechas, `baseUrl`, `buildSha`, `gitAtStart`, `dirty`.
5. **HTTP de solo lectura:** `GET /api/health` en `:3000`, `:3230`, `:3302`
   y los dos túneles; `GET /` para `Cache-Control`; `GET /pay/no-existe` y
   `/pay/no-existe/success` para el status.
6. **Importación documental:** `git checkout <rama> -- <archivos>` de
   `p0/context-recovery`, `p0/supervisor` y `p0/adversarial`; no se copió app
   ni código.

No se ejecutó build, `npm ci`, `verify:full` ni E2E propios. No se tocó la app,
`:3000`, `:3230`, `:3302` (solo GET), la preview, el túnel ni otros worktrees.
No se leyó `.env.local` ni ningún secreto.

## 2. Acciones de consolidación

1. Se importaron `context/` (10 archivos), las tres piezas de supervisión, las
   tres de auditoría adversaria y `fix-adversarial-report.md` ya estaba en la
   rama.
2. Se reescribió `HANDOFF-CIERRE.md` desde cero para el estado `fabe7cc`.
3. Se actualizaron mínimamente `GOAL-CIERRE-DEMO.md`, `demo/STATUS.md`,
   `RUNBOOK-DEMO.md` y `harness/STATE.md`.
4. Se crearon `RELEVO-VERIFICADO.md`, `CONTEXTO-VERIFICADO.md`,
   `consolidation-report.md` y `RELEVO/claims.json`.
5. **No se cambió código de app, tests ni configuración.**

## 3. Contradicciones resueltas

| # | Afirmación encontrada | Estado | Resolución verificada |
|---|---|---|---|
| 1 | `master` es `71bc4ed` / `b5c59e1` / `d35c791` | **OBSOLETO** | `master = a85d903`. Los tres SHAs son ancestros. |
| 2 | La final es `b7154ca` / `2a786f1` | **OBSOLETO** | La final es `fabe7cc`. |
| 3 | Hay 23/24 commits de diferencia | **OBSOLETO** | **28** (`master..fabe7cc`; `fabe7cc..master` = 0). |
| 4 | P0-1 (reset borra pey firmado) sigue abierto | **OBSOLETO** | Corregido en `ac9e5a6`; 409, filas sobreviven, FORCE conserva. Evidencia E2E 28/28. |
| 5 | P0-2 (`/` pública) sigue abierto | **OBSOLETO** | Corregido en `next.config.ts:187-193`; runtime `private, no-store`. |
| 6 | P1-1/P1-3/P1-5 siguen abiertos | **OBSOLETO** | Corregidos en `ac9e5a6`; probados en E2E 28/28. |
| 7 | P1-2 (auth) está resuelto | **FALSO** | No hay sesión/middleware; solo CSRF/rate limit/token. |
| 8 | P1-4 (404 HTTP) está resuelto | **FALSO** | `/pay/no-existe` y `/success` devuelven **200** en `:3230` y `:3302`. |
| 9 | El full 23/23 está hecho | **NO VERIFICADO** | No hay `latest.json` ni `latest-static.json`; no se ejecutó full. |
| 10 | El build del HEAD es `e6f3107`/`397039d` | **OBSOLETO** | Base `fabe7cc` + docs; build conocido `2a1f166`; preview `397039d`. |
| 11 | El túnel `timing...` está vivo | **FALSO** | DNS no resuelve; el vivo es `involve...`, que sirve `397039d`. |
| 12 | Hay que detener `:3230` y conservar PID 13932 | **FALSO** | `:3230` es la preview viva; PID 13932 es el túnel de `:3000` (caído). |
| 13 | Data son 123 checks | **FALSO** | 85 (58+20+7) según `HARNESS.md:97` y el gate. |
| 14 | `preservedRealPayments` cuenta pagos | **FALSO (nombre engañoso)** | Cuenta pedidos distintos con pago pey firmado; `realPayments`/`realPaymentCount` cuenta filas. El E2E compara contra `DISTINCT order_id`, por eso pasa. |
| 15 | El E2E de payment-truth 35/35 es evidencia de cierre | **NO VERIFICADO** | No hay JSON/SHA; solo capturas. El script cambió en `fabe7cc` después del build `2a1f166`. |
| 16 | Preferences 26/26 es evidencia válida | **FALSO para cierre** | JSON `gitAtStart.sha=2a1f166`, `dirty:true`; HARNESS exige `dirty:false` y SHA del HEAD. |
| 17 | El 404 de checkout se corrigió con el fix adversario | **FALSO** | Sigue 200; no está en el alcance del fix. |
| 18 | `p0/fix-video` está integrado | **FALSO** | No es ancestro de HEAD; `demo_ui.py` no existe; `record-demo.py` hardcodea `:3000`. |
| 19 | `p0/cognitive-integration` es la rama buena | **FALSO/OBSOLETO** | No es ancestro; la buena es `p0/final-cognitive`/`fabe7cc`. |
| 20 | README está desplegado en producción | **NO VERIFICADO** | La única URL viva es un quick tunnel de preview (`397039d`). |

## 4. Fix P0/P1: veredicto corto

- **P0-1:** **VERIFICADO** en código y E2E. El reset bloquea con 409 si hay
  cualquier pago pey `paid` (incluido `demo=1`), no borra filas en el 409 y
  conserva pagos/pedidos con `FORCE`; el conteo se hace después del borrado.
  **Caveat:** `preservedRealPayments` cuenta pedidos, no pagos.
- **P0-2:** **VERIFICADO**. Header privado/no-store en `/`; el HTML sigue
  conteniendo datos privados, así que hace falta Access/auth para exponerlo.
- **P1-1:** **VERIFICADO** para el camino webhook demo: `demo_paid`, no
  `verifiedDigitalCents`, `fulfill` 409. El caso mixto demo/real no está
  cubierto por el E2E.
- **P1-3:** **VERIFICADO** con mock; falta payload real de pey.
- **P1-5:** **VERIFICADO** en totales/conteos y copy; no hay paginación
  completa (solo se declara el truncamiento).
- **P1-2/P1-4:** **ABIERTOS**. No son parte del fix.

**Sobre los asserts confusos:** `p0-adversarial-e2e.py` pasa el detalle `"fila borrada"` a dos `check()` que en realidad verifican que las filas *siguen existiendo*; el detalle se imprime también en PASS. El assert de existencia es correcto, pero el texto es engañoso. No se editó el test porque es código y movería el HEAD/evidencia; queda como deuda de test documentada. Lo mismo aplica al nombre `preservedRealPayments`: el E2E compara contra `SELECT DISTINCT order_id`, no contra filas de pago.

## 5. Evidencia: qué acepté y qué no

| Evidencia | Qué prueba | Qué no prueba |
|---|---|---|
| `p0-adversarial-e2e.json` (28/28, build `2a1f166`) | Los cinco fixes en runtime aislado. | No prueba `fabe7cc` ni árbol limpio; no tiene `gitAtStart`. |
| `closing-checklist-e2e.json` (18/18, `:3302`, build `2a1f166`) | El cierre cognitivo sobre ese build. | No prueba HEAD; no tiene `gitAtStart`. |
| `sin-ia-e2e.json` (21/21 + 1 NOTE) | Venta manual sobre `:3303`. | No tiene SHA/build; no prueba HEAD. |
| `companion-preferences-e2e.json` (26/26) | Persistencia/foco de preferencias sobre `:3305`. | `dirty:true`, `sha=2a1f166`; **no es evidencia de cierre**. |
| Capturas `payment-truth` (22:23) | Que se corrió una UI; no hay JSON. | No hay 35/35 machine-readable ni SHA; el script cambió después. |
| `:3302` header `/` | P0-2 en `2a1f166`. | No prueba `fabe7cc`. |
| `:3230`/pública `397039d` | Preview histórica. | No es la final. |
| `:3000` caído | No hay servidor final. | No prueba build del HEAD. |

## 6. Límites de este trabajo

- **No se ejecutó build, `npm ci`, `verify:full` ni E2E propios.** No se
  afirma que el full pase.
- **No se arrancó ni detuvo ningún servidor.** `:3302` ya estaba vivo y solo
  se leyó; `:3000` no responde; `:3230` y la preview solo se leyeron.
- **No se probó** el 320 px/200 % con navegador real, TalkBack/VoiceOver,
  teléfono físico ni estudio con comerciantes.
- **No se probó** pago real, BBVA/CoDi, payload real de pey ni Access.
- **La evidencia E2E existente es de `2a1f166`**, no de `fabe7cc`; el código
  de app es idéntico, pero la identidad de build no.
- **No se verificó** el contenido completo de todos los docs viejos; se
  corrigieron los mínimos solicitados y se marcaron las tablas históricas.
- **No se leyó** `.env.local` ni secretos; no se copió app ni código de otros
  worktrees.
- **El hash del commit de este informe** no puede auto-referenciarse; se
  reporta en la entrega final.

## 7. Qué haría falsa esta consolidación

- Que `npm run verify:full` falle o no cubra los 23 gates.
- Que el build del HEAD entregado no devuelva `buildSha === HEAD`.
- Que `verify:evidence` falle por `dirty`, `latest` ausente o artefactos.
- Que el reset vuelva a borrar un pago firmado o que `preservedRealPayments`
  se calcule antes del borrado (ya no ocurre en `fabe7cc`).
- Que `/` vuelva a servirse con `public`/`s-maxage`.
- Que el webhook demo vuelva a producir `paid` o `fulfill` 200.
- Que `/api/verify` acepte PAID sin referencias.
- Que la UI vuelva a calcular totales sobre la página truncada.
- Que el 404 de checkout se declare resuelto sin un assert de status.

## 8. Reproducción mínima

```powershell
cd "C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero-consolidacion"
git rev-parse HEAD master p0/final-cognitive
git merge-base --is-ancestor master HEAD; $LASTEXITCODE
git rev-list --left-right --count master...HEAD
git status --short

# Código de los fixes
Select-String -Path web\src\lib\db.ts -Pattern "resetDemoData|listRealPeyPayments|preservedRealPayments"
Select-String -Path web\src\lib\orders.ts -Pattern "demo_paid|demo_not_deliverable"
Select-String -Path web\src\app\api\verify\route.ts -Pattern "hasReferenceMismatch|reference_mismatch"
Select-String -Path web\next.config.ts -Pattern "private, no-store|source: \"/\""

# Evidencia y estado
Get-ChildItem harness\evidence
Invoke-RestMethod http://127.0.0.1:3230/api/health
Invoke-RestMethod http://127.0.0.1:3302/api/health
curl.exe -s -o NUL -w "%{http_code}`n" http://127.0.0.1:3302/pay/no-existe-xyz
```

> **Conclusión:** la consolidación documental está hecha y los P0/P1 del fix
> están verificados, pero **el cierre sigue bloqueado** por full/evidencia del
> HEAD, servidor `:3000` + preflight/túnel/QR y video final; además quedan
> abiertos P1-2 (auth), P1-4 (404 HTTP) y varios P2.
