# Onboarding OC · 4 pasos clickables

Ruta: **`/onboarding`** (worktree `oc-onboarding-worktree`, rama `revision/onboarding-oc`, base `d1fe344`).
No se tocó el servidor 4497, ni los worktrees A/B, ni producto compartido. Sin merge ni push.

## Recorrido

| Paso | Pantalla | Acción real |
| --- | --- | --- |
| 1 | Bienvenida | **Empezar** → paso 2. **Ya tengo una cuenta** → `/inicio`. |
| 2 | Conozcamos tu negocio | Nombre + giro. Valida vacío, enfoca el campo que falta y guarda el perfil local. **Continuar** → paso 3. **Atrás** → paso 1. |
| 3 | Primera venta de ejemplo | **Registrar venta** guarda una venta `onboarding-demo` de 2 quesadillas · $70.00. No llama APIs, no cobra y no marca pagos. |
| 4 | Listo | **Ir a mi negocio** → `/inicio`; accesos reales a `/caja`, `/fiados` y `/corte`. |

- Progreso visible de 4 puntos y etiqueta “Paso X de 4” para lector de pantalla.
- El foco pasa al encabezado en cada paso; botones y enlaces cumplen ≥ 44 px (52–55 px reales a 390).
- “Atrás” conserva nombre y giro.
- Funciona a 320, 360, 390×693, 941×1672 y 1448×1086 sin scroll horizontal.

## Perfil local

- Clave: `mercado-cero:onboarding:v1` (`web/src/lib/onboarding-profile.ts`).
- Campos: `name`, `giro`, `sampleSale`, `completedAt`, `updatedAt`, `version: 1`.
- La venta de ejemplo se guarda como `kind: "onboarding-demo"` / `demo: true`, **sin** campo `paid`, y nunca se envía a `/api/orders`.
- Si `localStorage` no está disponible (modo privado), el recorrido sigue en memoria.
- Al recargar, nombre y giro se recuperan; el recorrido **inicia siempre en el paso 1** para que los 4 pasos se puedan repetir. Un perfil terminado conserva su venta de ejemplo.

## Archivos

- `web/src/app/onboarding/page.tsx`
- `web/src/components/onboarding/onboarding-flow.tsx`
- `web/src/components/onboarding/onboarding.css`
- `web/src/lib/onboarding-profile.ts`
- `web/scripts/onboarding-capture.py` (capturas + contrato de flujo)

No se modificó el shell, la navegación, el webhook ni la lógica de pagos.

## Capturas

En `quality-reports/onboarding-oc/` (PNG ignorados por git; el JSON sí se versiona):

- `onboarding_01_bienvenida_390x693.png`
- `onboarding_02_negocio_390x693.png`
- `onboarding_03_primera_venta_390x693.png`
- `onboarding_04_listo_390x693.png`
- las mismas 4 en `941x1672`
- `captures.json` con métricas, perfil guardado, enlaces y aserciones.

Repetir con el servidor arriba:

```bash
cd web
BASE_URL=http://localhost:4498 python scripts/onboarding-capture.py
```

## Verificación ejecutada

- `npm run lint` — OK.
- `npm run typecheck` — OK.
- `python scripts/onboarding-capture.py` — `ok: true`, 8 capturas.
  - Verifica: sin overflow horizontal, CTA y progreso visibles, validación de vacío, “Atrás” conserva nombre, foco en `h1`, targets ≥ 44 px, enlaces solo a rutas reales, cero llamadas a `/api/`, perfil sin `paid`, persistencia tras recarga.
- Navegación real: `/inicio`, `/caja`, `/fiados`, `/corte` responden 200; “Ir a mi negocio” monta `.inicio-shell`.

Pendiente al momento del commit: build/harness completo (`verify:static` / `verify:full`) y revisión visual humana. No se declara PASS de harness.
