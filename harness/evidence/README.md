# Evidencia del harness

- `latest.json`: handoff local. Solo lo escriben las corridas `full` o `static` con `ok:true`; se sobrescribe en cada corrida válida y **no se versiona**.
- `runs/`: histórico local, ignorado por git (puede contener salidas largas).
- Artefactos de gates (`mobile-*`, `checkout-*`, `motion*`, `a11y-contrast*`, `mobile-320*`, `p0-*`, `demo/rehearsal.json`, `demo/tunnel-*`, `demo/stageshow/film-check.json` y hojas): generados, ignorados por git y con `sha256`/`size` dentro de `latest.json`.

Generar:

```bash
cd web
npm run verify:fast
npm run verify:static
npm run verify:full
npm run verify:evidence
npm run harness:report
```

Reglas:

- Un gate sin `ok:true`, `exitCode:0`, `reason:"ok"` y `expectedMatched:true` no cuenta.
- `latest.json` solo vale para el `gitAtStart.sha` que declara. `npm run verify:evidence` lo compara con HEAD y exige `gitAtStart.dirty:false`, árbol actual limpio, `gitAtEnd.sha` igual, `complete:true` y `serverBuildSha === gitAtStart.sha`.
- `latest.json` se genera sobre el HEAD actual y no se commitea: así no queda obsoleto. Si lo commiteas, HEAD cambia y la evidencia pasa a atestiguar el commit anterior. Las corridas `partial` o fallidas van solo a `runs/` y no pisan el handoff.
- Cada gate declara `artifacts[]` con ruta, existencia, `sha256` y tamaño. Si un artefacto falta o su hash no coincide, `verify:evidence` falla.
- En `full`, el JSON de motion/contraste y los E2E p0 declaran `code.commit`/`code.dirty`; se cruzan contra el HEAD limpio. `demo/hig-after/audit.json` también se valida si el gate HIG lo generó.
- El QR (`demo/qr-demo.*`) y el video son entregables versionados; no los genera el full.
