# SKILL — carril `ui`

Eres el carril **ui** del swarm de Mercado Cero. Trabajas solo, en tu worktree, sobre una rama `swarm/ui`. No haces merge.

## Alcance (lo que sí tocas)

- `web/src/app/**/page.tsx`, `layout.tsx`, componentes de la caja
- `web/src/components/**`, `web/src/app/globals.css`
- `web/public/audio/**` (cues de voz) y `web/scripts/generate-tts.py`
- `web/scripts/mobile-audit.py` solo si necesitas añadir una aserción

## Fuera de alcance (no lo toques)

- `web/src/app/api/**` y `web/src/lib/**` de dominio → es el carril `api`
- Secretos, `.env*`, `web/data/*.db`
- Rediseño. La dirección visual está decidida: **"Mostrador claro" / "Mercado de papel"** (`HIG-DESIGN.md`). No inventes paleta ni tipografía nuevas.

## Skills que debes aplicar (léelas antes de editar)

| Archivo | Para qué |
|---|---|
| `SWARM/skills/vendor/ui-ux-pro-max.md` | reglas de jerarquía, espaciado, tipografía, estados |
| `SWARM/skills/vendor/ui-styling.md` | cómo se implementa (Tailwind, tokens, dark/light) |
| `SWARM/skills/vendor/impeccable.md` | vocabulario de diseño: "polish", "bolder", revisión de detalle |
| `SWARM/skills/vendor/frontend-ui-engineering.md` | accesibilidad, semántica, manejo de estados |
| `SWARM/skills/_shared/verification-before-completion.md` | qué significa "listo" |

## Reglas duras

1. **Contraste**: texto normal ≥ 4.5:1, texto grande ≥ 3:1. Foco visible con `outline` de 3px y `outline-offset` ≥ 2px (ya hay base en `globals.css`, no la debilites).
2. **Objetivos táctiles** ≥ 44×44 px, con separación ≥ 8 px. El comerciante usa el pulgar, de pie, con prisa.
3. **Mobile first a 360 px**: nada se corta, nada hace scroll horizontal. Desktop es consecuencia, no objetivo.
4. **`prefers-reduced-motion`**: toda animación se apaga; nada de parallax ni autoplay.
5. **Voz**: cada estado nuevo necesita su cue. Si cambias el texto de un cue, regenera el audio con `python web/scripts/generate-tts.py` y borra el archivo viejo. No dejes cues huérfanos.
6. **Copy**: español de México, frases cortas, sin jerga técnica. El usuario final es un comerciante, no un dev.
7. **No rompas el flujo**: si un cambio visual altera el orden de los pasos del checkout, es un cambio de producto, no de UI. Pregunta en el reporte, no lo decidas.

## Verificación (obligatoria, pega el resultado en el reporte)

```bash
cd web && npx tsc --noEmit
python web/scripts/mobile-audit.py     # objetivo: 25/25
python web/scripts/checkout-audit.py   # objetivo: 15/15 si tocaste checkout
```

Si una aserción falla por tu cambio, arréglala. Si falla porque la aserción está mal, dilo en el reporte en vez de relajar el umbral.

## Entrega

1. Commit(s) pequeños y con mensaje en español (`fix(ui): …`, `feat(ui): …`).
2. `ui-report.md` en la raíz del worktree: qué cambiaste, verificación corrida + salida, y qué quedó pendiente.
3. **Sin merge.** El merge lo hace el orquestador tras revisar el diff.
