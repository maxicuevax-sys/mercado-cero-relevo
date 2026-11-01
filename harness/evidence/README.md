# Evidencia del harness

- `latest.json`: último resultado del gate para el handoff. Se sobrescribe en cada corrida.
- `runs/`: histórico local, ignorado por git (puede contener salidas largas).

No editar a mano. Generar con:

```bash
cd web
npm run verify:fast
npm run verify:static
npm run verify:full
```

Un gate sin `ok: true` en `latest.json` no cuenta como verde, aunque una corrida anterior haya pasado.
