# 08 — Regresión y pruebas

## Resultados ejecutados en la revisión

| Suite | Resultado | Evidencia | Lectura |
|---|---|---|---|
| `p0-venta` | **66 PASS · 0 FAIL · 0 KNOWN** | `EVIDENCIAS/p0-venta.txt` | Servidor aislado; no cubre `/caja` |
| `p0-fiado` | **51 · 0 · 0** | `EVIDENCIAS/p0-subset.txt` | Legacy/aislado |
| `p0-corte` | **69 · 0 · 0** | `EVIDENCIAS/p0-subset.txt` | Legacy/aislado |
| `p0-integración` | **51 · 0 · 0** | `EVIDENCIAS/p0-subset.txt` | Legacy/aislado |
| `p0-dinero` | **45 · 0 · 3 KNOWN** | `EVIDENCIAS/p0-subset.txt` | KNOWN sin cambios: pey real no verificable, reconciliación de red, conteo posterior al cierre |
| `webhook` | **40/40** | `EVIDENCIAS/webhook.txt` | Contrato firmado; no UI nueva |
| `checkout` | **19/19** | `EVIDENCIAS/checkout.txt` | Checkout público; no UI nueva |
| `verify:static` | **5/5 PASS** en `4130e71` | `latest-static.json` | Corrida original limpia |
| `verify:evidence -- --static` | **PASS** en `4130e71` | `latest-static.json` | Antes de crear esta carpeta |
| Full `--skip=tunnel,preflight` en `7c48902` | **21/23**, todos los gates ejecutados verdes | `harness/evidence/runs/2026-11-04T16-44-44-732Z-full.json` | Solo faltan tunnel/preflight; `partial:true` |
| Full `--skip=tunnel,preflight` en `4130e71` durante revisión | **17/23** | `EVIDENCIAS/full-partial.txt` | `truth`, `mobile`, `hig`, `rehearsal` fallaron por contaminación/concurrencia de la base demo de los auditores. No se usa como regresión. |
| Smoke B | **44/44** | `EVIDENCIAS/smoke-b.txt`, `.json` | Sin SHA/build/timestamp; no cubre P0/P1 |
| A11y axe | **0 violations** normal/HC en 10 estados | `EVIDENCIAS/a11y.json` | No certificación |
| `perf` | PASS 200.1/201.0 KiB | full run | Caja nueva no rompe presupuesto |

## Comparación con Oleada A

| Área | Oleada A | Oleada B | Cambio |
|---|---|---|---|
| `/inicio` | migrado | nav + CTA a `/caja` | Sin regresión funcional; 768 visual heredado |
| `/` legacy | 200, `?tab=` | 200, `?tab=` | Sin cambios funcionales |
| `/fiados` etc. | 307 | 307 | Sin cambios |
| `/pay/**` | intacto | intacto | Sin cambios |
| Motor | p0 verdes | p0 verdes | Sin regresión |
| Nuevas rutas | aliases | `/caja`/`/ventas` reales | Avance real |
| Accesibilidad | HIG 5/5 Caja legacy | axe 0 nuevos; 200 % falla | Regresión de reflow en nuevas rutas |
| Full | 21/23 (tunnel/preflight) | 21/23 en 7c48902; 17/23 contaminado en revisión | No se declara full actual |

## Cobertura insuficiente

El 44/44 no prueba:
- el banner falso de fiado puro;
- el panel mixto que oculta $60;
- el importe por línea invisible;
- el CTA fuera del fold;
- el 200 % con solapamientos;
- dos Cajas/drafts;
- `payment_pending` con `paid>0`;
- abono demo en “Cobrado confirmado”;
- 502 + edición;
- foco de ruta/paginación.

## Datos/entorno

- La base demo compartida quedó con cientos de pedidos `demo=1` por la revisión; `/api/demo/reset` devolvió 409 por datos reales preexistentes y no se forzó.
- Los p0 usan servidores aislados con SQLite temporal; son la evidencia más limpia del motor.
- El full de 7c48902 es el último full limpio; 4130e71 solo difiere en documentación.
- `latest.json` full sigue siendo de `9206ea1`; **no** es evidencia de B.

## Conclusión

No hay regresión P0/P1 del **motor** ni de los contratos financieros. Sí hay regresiones/defectos P1 de **experiencia y verdad visible** en las rutas nuevas. Los gates verdes no compensan los P0/P1 de UI.
