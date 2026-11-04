# 08 — Registro de agentes e invocaciones

## Perfiles configurados

En `.opencode/agents/` existen 10 perfiles: `mc-orquestador` (primary), `mc-auditoria-repo`, `mc-verificador-final`, `mc-accesibilidad`, `mc-ventas-pagos`, `mc-fiado-corte`, `mc-modulos-negocio`, `mc-onboarding-ayuda`, `mc-shell-responsive`, `mc-sistema-diseno`.

Este harness solo expone subagentes `explore` y `general`. Por eso los perfiles `mc-*` se invocaron como **sesiones `general` con rol especializado**, no por nombre. `mc-orquestador` no se lanzó como subagente: el agente principal hizo de orquestador.

## Invocaciones efectivas

| Rol | Sesión | Tipo | Modo | Resultado |
|---|---|---|---|---|
| `mc-auditoria-repo` (integridad Caja) | `ses_e57efb1f0ffeoQ8X6dh2jFgI2e` | general | Solo lectura | Causas de P1-01/06/12, contratos y diseño de pruebas. Confirmó que el WIP estaba en curso. |
| `mc-ventas-pagos` + `mc-fiado-corte` (verdad financiera) | `ses_e57efb1eeffetrCq7s8kPJJGmb` | general | Solo lectura | Causas de P0-01/02, P1-07/08/09; alertó del gate `p0-dinero` y del saldo fiado en el panel. |
| `mc-sistema-diseno` + `mc-accesibilidad` + `mc-shell-responsive` | `ses_e57efb1eaffegkkywDKnQTG1XT` | general | Solo lectura | Causas de P1-02/03/04/05/11/13; recomendó container queries, foco persistente y nav honesta. |
| `mc-verificador-final` | `ses_e579bd1f8ffenpeDiUAB1RA4dT` | general | Solo lectura/pruebas | Verificación independiente final; ver `09_VERIFICACION_INDEPENDIENTE.md`. |
| Orquestador | sesión principal | — | Edición | Integró, ejecutó regresiones y documentó. |

## Reglas respetadas

- Auditores no editaron producto ni hicieron commits.
- Implementadores no editaron en paralelo: el orquestador fue el único escritor de `web/src`.
- El verificador independiente no implementó los cambios que aprobó.
- Ningún subagente usó la base principal para escrituras.
- Los informes de los auditores se usaron como contraste, no como sustituto de código/pruebas.

## Insumos entregados por los auditores

- **Integridad:** recomendó estado `unknown`, llave durable, bandeja de pendientes y puente v1/v2. B.1 implementó esos conceptos con un alcance menor y verificable.
- **Financiero:** identificó que `p0-dinero` codificaba el bug de abonos demo; B.1 actualizó la aserción y pasó el gate.
- **Diseño/a11y:** identificó que `RouteFocus` en AppShell se remonta y no dispara en navegación; B.1 lo resolvió con `sessionStorage` y foco en primera carga omitido. También señaló el sticky dentro de scroll; B.1 movió el CTA a una barra fija.
