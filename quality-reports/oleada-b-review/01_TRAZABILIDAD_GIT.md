# 01 — Trazabilidad Git y entorno

## Identidad evaluada

| Dato | Valor |
|---|---|
| Repo | `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero` |
| Rama | `design/oleada-b-caja-ventas` |
| HEAD | `4130e71d668e5e4693a8f5b634d2d2f953d21b02` |
| Título HEAD | `docs: cierre formal local de Oleada B` |
| Base Oleada A | tag `oleada-a-cierre` = `26c7741433f18e4f4d0e78b1913df76ed09dae7e` |
| Build servido | `/api/health` → `4130e71d668e5e4693a8f5b634d2d2f953d21b02` |
| Servidor | `http://localhost:3100` (PID 3100), `DEMO_MODE=true`, `APP_URL=http://localhost:3100` para el link local |
| Estado inicial | Árbol de producto limpio; `git status --short` vacío antes de crear `quality-reports/oleada-b-review/` |
| Estado final de la revisión | Solo `?? quality-reports/oleada-b-review/` (evidencia; no se borró ni se commiteó) |

## Commits de Oleada B

| Commit | Contenido |
|---|---|
| `d13d3df` | `feat(caja): pantallas reales de Caja y Ventas de Oleada B` |
| `af381ad` | `docs: cierre local de Oleada B` |
| `7c48902` | `perf(caja): difiere ClosingChecklist y aligera la Caja nueva` |
| `4130e71` | `docs: cierre formal local de Oleada B` |

## Diff vs. línea base

El diff `oleada-a-cierre..HEAD` incluye:

- **Nuevas páginas:** `/caja`, `/ventas`.
- **Nuevos componentes:** `components/caja/*` (6 TSX + CSS), scripts de smoke/a11y/capturas.
- **Modificados:** `next.config.ts` (Cache-Control privado para `/caja` y `/ventas`), `components/shell/nav.ts`, `app/inicio/page.tsx` (CTA a `/caja`), `scripts/oleada-a-smoke.py`.
- **Eliminado:** `app/ventas/route.ts` (redirect anterior).
- **Modificado:** `components/caja-app.tsx` **solo** para cargar `ClosingChecklist` con `next/dynamic`.
- **Documentación:** `harness/STATE.md`, matriz de migración y `quality-reports/oleada-b/*`.

## Contratos financieros

Comprobación por `git hash-object` contra `HEAD:<archivo>` y diff vacío:

`lib/orders.ts`, `lib/cash.ts`, `lib/goals.ts`, `lib/tasks.ts`, `lib/db.ts`, `lib/payment-rules.ts`, `lib/payment-labels.ts`, `lib/pey-events.ts`, `lib/checkout.ts`.

`git diff --name-status oleada-a-cierre..HEAD -- web/src/app/api web/src/app/pay` devuelve **vacío**.

**Excepción documental:** `web/src/components/caja-app.tsx` sí aparece en el diff. Es un `next/dynamic` de `ClosingChecklist` para aliviar el JS inicial de la Caja legacy de Corte. No toca venta, pagos, draft ni la Caja nueva. La entrega previa afirmaba “sin cambios” en ese archivo; esa frase es inexacta y queda corregida por esta auditoría.

## Evidencia formal

| Evidencia | Estado |
|---|---|
| `harness/evidence/latest-static.json` | `ok:true`, 5/5, `gitAtStart.sha=4130e71`, `dirty:false`, `serverBuildSha=4130e71`, `verify:evidence -- --static` PASS en la corrida original |
| `harness/evidence/latest.json` (full) | **NO actualizado**; sigue siendo de `9206ea1`. No es evidencia de B. |
| Full `--skip=tunnel,preflight` en `7c48902` | 21/23 gates en verde; solo `tunnel`/`preflight` no ejecutados. |
| Full `--skip=tunnel,preflight` durante la revisión en `4130e71` | 17/23; `truth`, `mobile`, `hig`, `rehearsal` fallaron por contaminación/concurrencia de la base demo usada por los auditores. No se usa como regresión de producto. |
| p0 actuales | p0-venta 66/0; p0-fiado 51/0; p0-corte 69/0; p0-integración 51/0; p0-dinero 45/0 + 3 KNOWN; webhook 40/40; checkout 19/19. |
| Smoke B actual | 44/44, pero sin SHA/build/timestamp y sin cubrir los P0/P1 de esta revisión. |

## Datos y límites

- Se usaron datos sintéticos/demo. La base demo compartida quedó con cientos de pedidos `demo=1` por la propia revisión; `/api/demo/reset` devolvió 409 por datos reales preexistentes y **no se forzó**.
- Los casos de fiado/corte se validaron también en servidores aislados con SQLite temporal (ver `auditorias/05_fiado_corte.md`).
- El `latest-static` válido se generó antes de crear esta carpeta. `verify:evidence -- --static` hoy fallaría solo por el untracked de la revisión, no por cambio de producto.
- No se probó pey real, QR real, webhook real contra banco, lector de pantalla, iOS/Safari, HCM real ni teclado virtual real.

## Reproducibilidad

Scripts propios de esta revisión:

- `EVIDENCIAS/routes_navigation.py`
- `EVIDENCIAS/keyboard_focus.py`
- `EVIDENCIAS/capture_review.py`
- `EVIDENCIAS/final-verify*` (verificador)
- `web/scripts/oleada-b-smoke.py`
- `web/scripts/oleada-b-a11y.py`

Los comandos y salidas están en los `.txt`/`.json` de `EVIDENCIAS/`.
