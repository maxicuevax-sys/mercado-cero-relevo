# SWARM/skills — qué sabe cada carril

Cada carril de `SWARM/fire.sh` arranca con un pack de skills propio. El pack se le pasa en el prompt (`Lee SWARM/skills/<lane>.md`) y el propio pack apunta a los archivos vendorizados. Nada de esto se instala globalmente: vive en el repo, se versiona y viaja a cada worktree.

## Estructura

```
SWARM/skills/
  ui.md  api.md  payments.md     ← pack del carril: alcance, reglas duras, verificación, entrega
  _shared/                       ← skills transversales (los tres carriles las leen)
    verification-before-completion.md
    api-and-interface-design.md
    security-and-hardening.md
  vendor/                        ← copias literales de repos externos, con licencia y SHA
    MANIFEST.json                ← repo, ruta original, licencia, commit exacto
```

`vendor/` no se edita a mano. Para actualizar, vuelve a bajar del SHA del `MANIFEST.json` o cambia el SHA y anota por qué.

## Origen de cada skill

| Archivo | Repo (★ al 2026-11-01) | Licencia | Por qué está aquí |
|---|---|---|---|
| `_shared/verification-before-completion.md` | `obra/superpowers` (310k) | MIT | La regla que más carriles rompen: no digas "listo" sin salida de verificación. |
| `_shared/api-and-interface-design.md` | `addyosmani/agent-skills` (112k) | MIT | Contratos, códigos de estado, validación en el borde. |
| `_shared/security-and-hardening.md` | `addyosmani/agent-skills` | MIT | Firma, idempotencia, fugas. Es el eje del jurado. |
| `vendor/ui-ux-pro-max.md` | `nextlevelbuilder/ui-ux-pro-max-skill` (144k) | MIT | Jerarquía, espaciado, estados: lo que hace que la caja no parezca un formulario. |
| `vendor/ui-styling.md` | `nextlevelbuilder/ui-ux-pro-max-skill` | MIT | Cómo se implementa en Tailwind sin inventar tokens. |
| `vendor/impeccable.md` | `pbakaus/impeccable` (99k) | Apache-2.0 | Vocabulario de crítica de diseño ("polish", "bolder") para que el carril se autocritique. |
| `vendor/frontend-ui-engineering.md` | `addyosmani/agent-skills` | MIT | Accesibilidad y semántica, no solo pixeles. |
| `vendor/test-driven-development.md` | `obra/superpowers` | MIT | Escribir la aserción que falla antes del fix. |
| `vendor/systematic-debugging.md` | `obra/superpowers` | MIT | Hipótesis → evidencia → fix. Corta el "arreglo a ciegas". |
| `vendor/ponytail-review.md` | `DietrichGebert/ponytail` (182k) | MIT | El mejor diff es el más pequeño. Frena al agente que reescribe todo. |
| `vendor/caveman-evidence-review.md` | `JuliusBrussee/caveman` (117k) | Apache-2.0 | Revisión basada en evidencia citada: ideal para anti-fraude. |

## Lo que se descartó (y por qué)

- **`tt-ali/archify`** (★72.5k en la infografía): el repo devuelve 404. No existe o lo renombraron. No se vendoriza lo que no se puede citar.
- **`Graphify-Labs/graphify`** (★140k): un solo `SKILL.md` de 47 KB + 30 MB de repo. Convierte el código en grafo consultable; útil para explorar un codebase de 100k líneas, no para tres carriles de un repo de 8 días. Costo/beneficio malo.
- **`Egonex-AI/Understand-Anything`** (★90k): visualización de conocimiento. Nuestro cuello de botella es el demo, no entender el repo.
- **`ComposioHQ/awesome-claude-skills`** (★78k): es una lista curada, no una skill. Sirve para descubrir, no para ejecutar.
- **`caveman` (skill principal)**: comprime el prompt a estilo cavernícola para ahorrar tokens. Divertido, pero degrada la precisión en español. Sí conservamos su `evidence-review`.
- **`superpowers/dispatching-parallel-agents`**: ya lo implementa `fire.sh`; duplicarlo confunde al worker sobre quién orquesta.

## Regla de convivencia

Si un pack de carril y una skill vendorizada se contradicen, **gana el pack del carril** (es específico del proyecto) y el worker lo anota en su reporte. Si la contradicción es real, se corrige el pack en `master`, no en el worktree.
