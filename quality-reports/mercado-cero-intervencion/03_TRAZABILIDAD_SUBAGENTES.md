# 03 · Trazabilidad de subagentes

> **Hecho:** los 10 perfiles existen en `.opencode/agents/` y están trackeados. `mc-orquestador` es `mode: primary`; los otros 9 son `mode: subagent`.
> **Límite de la sesión:** la herramienta de delegación de esta sesión expone únicamente los tipos `explore` y `general`. Los perfiles `mc-*` **no aparecen como tipos invocables** en el tool `subagent`; por eso se usaron `general`/`explore` con el mismo alcance y se registra la limitación. No se finge una invocación `mc-*`.

## Perfiles disponibles

| Perfil | mode | Permisos | Uso en esta fase |
|---|---|---|---|
| `mc-orquestador` | primary | edit ask, bash ask, task `mc-*` allow | Orquestación de la sesión |
| `mc-auditoria-repo` | subagent | edit deny, bash ask | Equivalente A: `general` |
| `mc-sistema-diseno` | subagent | edit ask | Equivalente B: `general` |
| `mc-shell-responsive` | subagent | edit ask | Equivalente C: `general` |
| `mc-accesibilidad` | subagent | edit deny, bash ask | Equivalente D: `general` |
| `mc-verificador-final` | subagent | edit deny, bash ask | Equivalente E: pendiente |
| `mc-ventas-pagos` | subagent | edit ask | No invocado: no se tocó pago/venta |
| `mc-fiado-corte` | subagent | edit ask | No invocado: no se tocó fiado/corte |
| `mc-modulos-negocio` | subagent | edit ask | No invocado: no se tocó metas/inventario |
| `mc-onboarding-ayuda` | subagent | edit ask | No invocado: Ayuda solo enlazada, sin cambios de contenido |

## Invocaciones reales (sessionID)

| Fecha/fase | Rol solicitado | Tipo real | sessionID | Entregable | Evidencia |
|---|---|---|---|---|---|
| Auditoría inicial del repo | `mc-auditoria-repo` | `explore` | `ses_e5dcacb51ffejIsOMjmNqwOMnP` | Inventario de shell, tests, pantallas | Reporte devuelto en sesión |
| Inventario del kit | `mc-auditoria-repo` | `explore` | `ses_e5daa369dffekzuiseN5bKobul` | 16 pantallas, 9 agentes, tareas | Reporte devuelto |
| Auditoría sistema/shell | `mc-sistema-diseno` + `mc-shell-responsive` | `explore` | `ses_e5daa369bffezLI4uXhPENG3RE` | Brechas de tokens/shell | Reporte devuelto |
| Verificación técnica | `mc-verificador-final` | `general` | `ses_e5daa3699ffe5G177S4xM7NRYR` | Gates y regresiones | Reporte devuelto |
| Accesibilidad | `mc-accesibilidad` | `general` | `ses_e5daa3696ffescYTpqavl3yUP6` | P0/P1/P2 a11y | Reporte devuelto |
| Specs Fiado/Corte/Metas | `mc-fiado-corte` + `mc-modulos-negocio` | `explore` | `ses_e5daa3693ffeKdnLA9iaHk41E9` | Specs y bloqueos backend | Reporte devuelto |
| Paridad móvil | `mc-shell-responsive` | `general` | `ses_e5d3f2bf1ffe7djcbbjhgJmffD` | 7 pantallas vs app | Reporte + contact sheet |
| Paridad escritorio | `mc-shell-responsive` | `general` | `ses_e5d3f2befffexa5sotWpeRKhwg` | Side-by-side desktop | Reporte + hoja |
| Assets exactos | `mc-sistema-diseno` | `general` | `ses_e5d3f2beeffe8I7QCka13B3imG` | Mapeo/asset audit | Reporte devuelto |
| Paridad funcional | `mc-ventas-pagos` + `mc-fiado-corte` | `general` | `ses_e5d3f2bedffeJlyG3kbOdYIHff` | Brechas de flujo | Reporte devuelto |
| Posiciones/tokens | `mc-sistema-diseno` | `general` | `ses_e5d3f2bebffeD81x4jnuS22Akc` | Medidas DOM vs blueprint | Reporte devuelto |
| Revalidación Inicio | `mc-verificador-final` | `general` | `ses_e5cc61777ffeboUpw4RvNPiO36` | NO-GO inicial | Reporte devuelto |
| Auditoría ruta/datos | `mc-auditoria-repo` | `explore` | `ses_e5cd73c7affeZMZKDo0QIWAotI` | `/inicio` vs Caja, riesgos | Reporte devuelto |
| Verificación visual Inicio | `mc-verificador-final` | `general` | `ses_e5cd73c7bffe6z5WNDSrgJlEbY` | NO-GO con B1/B2/B3 | Reporte devuelto |
| **Auditoría A actual** | `mc-auditoria-repo` | `general` | `ses_e5cb979faffeN4ciWkoinNC7Wy` | Estado Git/acciones/riesgos | `01`, `02` |
| **Auditoría B actual** | `mc-sistema-diseno` | `general` | `ses_e5cb979f8ffeU4B6Br0islk8IN` | Sistema visual/assets | `05` |
| **Auditoría C actual** | `mc-shell-responsive` | `general` | `ses_e5cb979f5ffevoieC7PgzXqxzf` | Layout/navegación 1448/390 | `05` |
| **Auditoría D actual** | `mc-accesibilidad` | `general` | `ses_e5cb979f2ffeYmN845WKCH1nd9` | A11y `/inicio` | `05` |
| **Verificación E** | `mc-verificador-final` | `general` | `ses_e5cab6598ffed0DbBU6VBY0iRj` | Veredicto independiente | `08` |
| **Auditoría Fase 4** | `mc-auditoria-repo` | `general` | `ses_e5c9c202dffeUvCbG3caf2GIn5` | Inventario de rutas, módulos, estados y 16 escenarios | `11_PREFLIGHT_FASE_4.md` |

## Conclusión de trazabilidad

- **Sí hubo delegación real** en las fases anteriores y en las auditorías A–D; los sessionID son evidencia de la herramienta.
- **No hubo invocaciones directas `mc-*`** porque el harness de esta sesión no las expone como tipos de `subagent`; se usó el equivalente `general`/`explore`.
- **No se invocaron** `mc-ventas-pagos`, `mc-fiado-corte`, `mc-modulos-negocio` ni `mc-onboarding-ayuda` en esta última fase porque no se modificaron sus contratos; se revisó su dominio con los informes previos.
- **La verificación E está pendiente** y no se puede declarar GO sin ella.
