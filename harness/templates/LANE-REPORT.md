# Lane report — Mercado Cero

> Copia este archivo como `<lane>-report.md` en la raíz del worktree al terminar.
> No pegues secretos ni outputs completos; enlaza `harness/evidence/latest.json`.

## Objetivo

- Qué se pidió:
- Qué quedó fuera:

## Cambios

- Archivos:
- Decisión técnica:
- Riesgo introducido:

## Evidencia

- `npm run test:harness`:
- `verify:fast`:
- `verify:static`:
- `verify:full`:
- `verify:evidence`:
- Gates no ejecutados y por qué:
- `latest.json` (SHA / modo / `ok`):

## Verificación manual

- [ ] Lo probé en la app real, no solo en tests.
- [ ] Revisé estados vacío/carga/error.
- [ ] Revisé 360 px y texto 200%.
- [ ] No hay secretos en el diff.
- [ ] No introduje un camino digital `payment_pending → paid` fuera del webhook pey; el efectivo sigue creándose como `paid` y el demo como `demo_paid`.

## Pendientes

- 
