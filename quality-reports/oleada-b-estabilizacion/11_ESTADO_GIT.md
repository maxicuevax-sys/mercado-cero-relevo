# 11 — Estado Git y trazabilidad

## Rama y base

- **Rama de trabajo:** `fix/oleada-b1-estabilizacion`
- **Base:** `844f759f30e53cc2ff4f77d67a3adb53123efb5b` (`design/oleada-b-caja-ventas`)
- **Handoff versionado:** `e025895bd66c579fa0260666f3fcfa10294c2b1a`
- **Producto final:** `bdfbe8b` (fix) + `8101849` (pruebas)
- **Build verificado:** `8101849`
- **Entrega documental:** HEAD que contiene esta carpeta

## Commits

| SHA | Tipo | Contenido |
|---|---|---|
| `e025895` | docs | Handoff de recuperación B.1 |
| `70b2313` | fix | Verdad financiera, integridad, foco y reflow (lotes 1–3) |
| `c3a883a` | test | `test:b1-regression` y actualización de `p0-dinero` |
| `f0bef29` | fix | Foco inicial, nav legacy, split con cambio y target 44 |
| `3f77c37` | test | Smoke B al nuevo contrato de pendientes/unknown |
| `4d4695e` | fix | Barra de cobro separada de la nav móvil a 200 % |
| `16cb40f` | fix | Reconstrucción de la llave durable del intento desconocido |
| `eab2a6f` | fix | Dos pestañas: lock + tombstone; barra fuera del sidebar |
| `626d5fd` | test | Cobertura de dos pestañas y clic de Ajustes |
| `bdfbe8b` | fix | Tombstone ligado a `instanceId` del draft |
| `8101849` | test | Cobertura de venta idéntica repetida |

Los commits de producto (`70b2313`, `f0bef29`, `4d4695e`, `16cb40f`, `eab2a6f`, `bdfbe8b`) están separados de los de prueba (`c3a883a`, `3f77c37`, `626d5fd`, `8101849`) y de los documentales (`e025895` y el commit de esta carpeta).

## Preservación

- No se hizo merge a la rama principal.
- No se hizo push ni deploy.
- No se borraron informes, evidencias ni tags.
- No se reescribieron commits.
- El tag `oleada-a-cierre` y los tags históricos siguen intactos.
- No se agregaron PNG pesadas al índice; las capturas nuevas quedan locales e ignoradas.

## Estado del árbol

Antes del commit documental el árbol contiene esta carpeta `quality-reports/oleada-b-estabilizacion/` sin seguimiento y los PNG ignorados. Después del commit documental debe quedar limpio; la verificación estática y el contrato demo-pay se ejecutan de nuevo sobre ese estado.

## Evidencia de identidad

- `web/.next/BUILD_SHA` = `8101849` al verificar el producto; la corrida final documental se sella con el HEAD de entrega.
- `/api/health` del servidor aislado devolvió el mismo `buildSha`.
- `harness/evidence/runs/2026-11-04T21-18-22-422Z-partial.json` corresponde al SHA final; es `partial` por `--only` y árbol sucio, no un full.
- `latest-static.json` y `latest.json` no se presentan como evidencia nueva hasta la corrida limpia final.
