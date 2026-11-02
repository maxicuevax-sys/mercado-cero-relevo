# Evidencia del harness

- `latest.json`: último resultado del gate para el handoff. Se sobrescribe en cada corrida, **no se versiona** y **no se edita a mano**.
- `runs/`: histórico local, ignorado por git (puede contener salidas largas).

Generar:

```bash
cd web
npm run verify:fast
npm run verify:static
npm run verify:full
npm run verify:evidence
```

Reglas:

- Un gate sin `ok: true` en `latest.json` no cuenta como verde, aunque una corrida anterior haya pasado.
- `latest.json` solo vale para el `gitAtStart.sha` que declara. `npm run verify:evidence` lo compara con HEAD y exige `gitAtStart.dirty:false`, `gitAtEnd.sha` igual y `complete:true`.
- `latest.json` se genera sobre el HEAD actual y no se commitea: así no queda obsoleto. Si lo commiteas, HEAD cambia y la evidencia pasa a atestiguar el commit anterior.
- En `full`, `verify:evidence` cruza `motion-check.json` y `a11y-contrast.json` contra el mismo commit limpio. `demo/hig-after/audit.json` está ignorado: si falta, es warning.
