# 06 — Pruebas de regresión

**Producto:** `bdfbe8b` (fix) + `8101849` (pruebas)
**Build verificado:** `8101849`
**Entorno:** Windows, Node 25.7.0, Next 16.4.3, SQLite temporal por suite. No se usó `web/data/mercado-cero.db` para escrituras.

## Suites

| Suite | Comando | Resultado | Notas |
|---|---|---|---|
| B.1 regression | `npm run test:b1-regression` | **65 PASS · 0 FAIL** | Servidor propio/efímero, SQLite temporal; incluye seed 7000, dos pestañas, venta idéntica repetida y clic de Ajustes |
| p0-venta | `npm run verify:full -- --only=...` | **66 PASS · 0 FAIL · 0 KNOWN** | Servidor propio 3211 |
| p0-fiado | idem | **51 PASS · 0 FAIL · 0 KNOWN** | Servidor propio |
| p0-corte | idem | **69 PASS · 0 FAIL · 0 KNOWN** | Servidor propio |
| p0-integración | idem | **51 PASS · 0 FAIL · 0 KNOWN** | Servidor propio |
| p0-dinero | idem | **45 PASS · 0 FAIL · 3 KNOWN** | KNOWN: pey real, reconciliación de red, conteo post-cierre |
| webhook | idem | **40/40** | Servidor aislado con secreto de `.env.local` |
| checkout | idem | **19/19** | Servidor propio 3215 |
| demo-pay | `npm run test:demo-pay` | **58 PASS** en árbol sucio; ver nota | 0b exige árbol limpio; se repite tras el commit documental |
| Smoke A | `python scripts/oleada-a-smoke.py` | **33/33** | `BASE_URL=http://localhost:3340` |
| Smoke B | `python scripts/oleada-b-smoke.py` | **45/45** | Incluye fiado, mixto, 502, pendientes y 200 % |
| HIG | `python scripts/hig-after-audit.py` | **HIG OK · 5 viewports** | 320/360/390/768/1280 |
| A11y B | `python scripts/oleada-b-a11y.py` | axe 0 normal/HC; 0 under44; zoom sin overflow | 1448/1366/390/320 |
| Mobile 320/360 | `node scripts/mobile-320-gate.mjs` | **60/60** | Chromium, Firefox, WebKit |
| Seguridad | `npm run test:security` | **58/58** | Guardas de reset, backups y errores |
| Harness | `npm run test:harness` | **58/58** | Gate y evidencia |
| Build | `npm run build` | **BUILD OK** | Sella BUILD_SHA |
| Static | `npm run verify:static` | **5/5 gates** | `guard`, `lint`, `types`, `deps`, `build`; el 5/5 formal se repite en árbol limpio |

## `verify:full`

- Se ejecutó `--only=p0-venta,p0-fiado,p0-corte,p0-integracion,p0-dinero,webhook,checkout`.
- Resultado: **7/7 gates verdes**, pero el harness marca `partial` y `ok:false` porque `--only` no cuenta como full y el árbol estaba sucio por la evidencia.
- Evidencia: `harness/evidence/runs/2026-11-04T21-18-22-422Z-partial.json`.
- **No se declara full 23/23.** `tunnel` y `preflight` siguen sin infraestructura válida.

## Demostración de que las pruebas fallaban antes

- P0-01/P0-02 están reproducidos en `quality-reports/oleada-b-review/EVIDENCIAS/final-*`.
- P1-07/P1-12/P1-01/P1-06 están reproducidos en `oleada-b-review` y en los smoke previos.
- La nueva suite B.1 se diseñó con aserciones de copy, DB/API y geometría; no solo `scrollWidth`.

## Observaciones de proceso

- El disco C llegó a 0 bytes por acumulación de temporales de gates. Se limpiaron únicamente directorios `mercado-cero-*` y `opencode\b1*` generados por las pruebas. No se borraron datos del proyecto ni la base principal.
- Un servidor viejo en 3390 con DB contaminada provocó una corrida 56/60. La suite ahora verifica el seed aislado; la corrida válida es 65/65 en puerto efímero.
- `p0-venta` mostró dos fallos intermitentes de sincronización del diálogo legacy en corridas consecutivas; la corrida final y las dos posteriores dieron 66/0.
