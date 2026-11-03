# Evidencia del harness

- `latest.json`: handoff local de `full`. Solo lo escriben las corridas `full` con `ok:true`; se sobrescribe en cada corrida válida y **no se versiona**.
- `latest-static.json`: handoff local de `static`. Solo lo escriben las corridas `static` con `ok:true`; **nunca pisa** `latest.json` y tampoco se versiona.
- `runs/`: histórico local, ignorado por git (puede contener salidas largas).
- Artefactos de gates (`mobile-*`, `checkout-*`, `motion*`, `a11y-contrast*`, `mobile-320*`, `p0-*`, `demo/rehearsal.json`, `demo/tunnel-*`, `demo/stageshow/film-check.json` y hojas): generados, ignorados por git y con `sha256`/`size` dentro del latest correspondiente.

Generar:

```bash
cd web
npm run verify:fast
npm run verify:static
npm run verify:full
npm run verify:evidence
npm run verify:evidence -- --static
npm run harness:report
```

Reglas:

- Un gate sin `ok:true`, `exitCode:0`, `reason:"ok"` y `expectedMatched:true` no cuenta; `verify:evidence` además recalcula el `expected` contra `outputTail`.
- `latest.json` (full) o `latest-static.json` (static) solo valen para el `gitAtStart.sha` que declaran. `npm run verify:evidence` compara con HEAD y exige `gitAtStart.dirty:false`, árbol actual limpio, `gitAtEnd.sha` igual, `complete:true`, `serverBuildSha === gitAtStart.sha` y `buildSha` por gate runtime.
- Los latest se generan sobre el HEAD actual y no se commitean: así no quedan obsoletos. Si los commiteas, HEAD cambia y la evidencia pasa a atestiguar el commit anterior. Las corridas `partial` o fallidas van solo a `runs/` y no pisan el handoff.
- Cada gate declara `artifacts[]` con ruta, existencia, `sha256` y tamaño, y debe cubrir el set canónico del catálogo. Si falta un artefacto, su hash no coincide o aparece un path fuera del set, `verify:evidence` falla.
- En `full`, el JSON de motion/contraste y los E2E p0 declaran `code.commit`/`code.dirty`; `p0-dinero` declara `git.sha`/`git.dirty` (no `code`) y se cruza contra el HEAD limpio. `demo/hig-after/audit.json` también se valida si el gate HIG lo generó. El JSON de `p0-dinero` está ignorado y no trackeado.
- El QR (`demo/qr-demo.*`) y el video son entregables versionados; no los genera el full.
