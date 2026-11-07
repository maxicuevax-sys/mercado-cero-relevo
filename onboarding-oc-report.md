# Lane report — onboarding OC

## Objetivo

- Qué se pidió: ruta `/onboarding` clickable de 4 pasos (bienvenida, negocio, primera venta de ejemplo, listo), perfil local y capturas 390×693 / 941×1672, sin romper el shell.
- Qué quedó fuera: merge/push, 4497, worktrees A/B, módulos inexistentes.

## Cambios

- Archivos:
  - `web/src/app/onboarding/page.tsx`
  - `web/src/components/onboarding/onboarding-flow.tsx`
  - `web/src/components/onboarding/onboarding.css`
  - `web/src/lib/onboarding-profile.ts`
  - `web/scripts/onboarding-capture.py`
  - `ONBOARDING-OC.md`
  - `quality-reports/onboarding-oc/captures.json`
- Decisión técnica: pantalla autocontenida con tokens de “Mercado de papel”, sin `AppShell` (es previa al mostrador). Persistencia en `localStorage` (`mercado-cero:onboarding:v1`); la venta de ejemplo es `kind: "onboarding-demo"`, no toca APIs ni `paid`.
- Riesgo introducido: ninguno en pagos/webhook; la UI nueva reutiliza ilustraciones y fuentes existentes. Si el usuario ya completó el recorrido, vuelve a iniciar en el paso 1 (a propósito, para poder repetir el demo).

## Evidencia

- `npm run test:harness`: no ejecutado.
- `verify:fast`: no ejecutado (sí lint y typecheck por separado, ambos OK).
- `verify:static`: no ejecutado.
- `verify:full`: no ejecutado.
- `verify:evidence`: no ejecutado.
- Gates no ejecutados y por qué: tiempo agotado; el Lead debe correr `npm run verify:static` o `verify:full` antes de integrar.
- `latest.json` (SHA / modo / `ok`): sin generar.

## Verificación manual

- [x] Lo probé en la app real (Playwright, servidor dev 4498), no solo en tests.
- [x] Revisé los 4 pasos, validación, “Atrás”, recarga y navegación posterior.
- [x] Revisé 320, 360, 390×693, 941×1672 y 1448×1086; sin overflow horizontal.
- [x] No hay secretos en el diff.
- [x] No introduje un camino digital `payment_pending → paid`; el onboarding no llama APIs de pago ni marca `paid`.

## Pendientes

- Correr `npm run verify:fast` y `verify:static` (o full) desde `web/` con árbol limpio y adjuntar evidencia.
- Revisión visual humana contra `references/DEFINITIVE/mobile/onboarding_0*.png`.
- Decidir si se enlaza `/onboarding` desde Ajustes o primera visita; esta lane no tocó el shell.
