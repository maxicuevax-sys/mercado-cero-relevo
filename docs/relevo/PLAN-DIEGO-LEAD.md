# DIVISIÓN DE TRABAJO — DIEGO + LEAD

**Producción y Pey: PAUSADOS.** No se toca prod, DNS, mail, 4497 ni pagos live.

## Regla base
Un writer por worktree. Nadie aprueba su propia pantalla. Toda pantalla requiere captura 390×693, side-by-side contra ref y `VISUAL.md`.

## Diego
- Base: rama `revision/assembly-fixes` (HEAD `275d6de`, solo `web/`).
- Worktree: `..\diego-visual`
- Rama: `diego/visual-caja-fiados`
- Puerto: **4600**
- Pantallas:
  1. `/caja` → `mobile/02_nueva_venta_941x1672.png`
  2. `/fiados` → `mobile/05_fiados_390x693.png`
- Scope permitido:
  - `web/src/app/caja/**`
  - `web/src/components/caja/**`
  - `web/src/app/fiados/**`
  - `web/src/components/fiados/**`
- Prohibido: `shell/**`, `inicio/**`, `corte/**`, 4497, VPS, refs, prod.
- Entrega: commits en su rama + `reports/RELEVO/visual/diego/` + `VISUAL.md`.

## Tú / Lead
- Worktree actual: `integration-candidate-fixes`
- Rama: `lead/visual-corte` (crear desde `53272b1`)
- Puerto: **4580**
- Pantallas:
  1. `/corte` → `mobile/06_corte_941x1672.png` (A ya lo rechazó con 5 defectos).
  2. Después: integración/verificación de Metas de OpenCode.
- Scope permitido:
  - `web/src/app/corte/**`
  - `web/src/components/corte/**`
  - `web/src/components/shell/**` solo para integración final
- No tocar Caja/Fiados de Diego ni `revision/oc-metas`.
- Entrega: commit en `lead/visual-corte`, capturas y `VISUAL.md`.

## OpenCode (no es de Diego)
- Worktree: `oc-metas-worktree`
- Rama: `revision/oc-metas`
- Puerto: **4583**
- Solo `/metas`; entrega commits y `reports/RELEVO/oc-metas/VISUAL.md`. No integra.

## Verificación cruzada
- Diego verifica Corte del Lead.
- Lead verifica Caja/Fiados de Diego.
- A (Codex) puede ser el verificador independiente final.
- Criterio: side-by-side aceptable + MAE que no empeore + build; si no, se revierte.

## Orden de hoy
1. **0–15 min:** Diego crea worktree/4600; tú creas `lead/visual-corte`.
2. **15–75 min:** Diego Caja; tú Corte.
3. **75–105 min:** cruce de capturas y correcciones.
4. **105–150 min:** Diego Fiados; tú cierras Corte / revisas Metas.
5. **150–180 min:** integración de lo aprobado; build + 18 rutas + security/demo/B1 + gate visual.
6. **Fin:** candidato aprobado o NO-GO. Sin deploy a producción.

## Integración
- Solo el Lead integra al candidato.
- Nada de merge a `main`.
- Si una pantalla no pasa, se queda fuera; no se “arregla” en la rama de otro.
