# OpenCode: un orquestador + hasta 9 subagentes

## Regla de funcionamiento

Un **agente principal** `mc-orquestador` distribuye tareas. Hay **nueve subagentes**, pero no se lanzan nueve escrituras simultáneas sobre los mismos estilos o rutas. Los subagentes reciben rutas de lectura y propiedad de escritura delimitadas por fase. Se recomienda ejecución por oleadas y un único integrador por rama. **No hay garantía de que todas las instalaciones de OpenCode o proveedores permitan la misma concurrencia**; el orquestador debe comprobar el entorno.

| Rol | Tipo | Entregable | Escritura |
| --- | --- | --- | --- |
| mc-orquestador | primary | mapa, acuerdos, validación de entregables | no implementación directa por defecto |
| mc-auditoria-repo | subagent | inventario de stack/rutas/riesgos | ninguna |
| mc-sistema-diseno | subagent | tokens, tipografía, iconos, primitivas | solo diseño global |
| mc-shell-responsive | subagent | navegación, layouts, responsive | shell y navegación |
| mc-ventas-pagos | subagent | venta rápida, cobro, estado QR | venta / pagos de UI |
| mc-fiado-corte | subagent | libreta, abonos, conciliación | módulos fiado/caja |
| mc-modulos-negocio | subagent | productos, proveedores, metas, pendientes | módulos de negocio asignados |
| mc-onboarding-ayuda | subagent | primera venta práctica y contenido | onboarding/ayuda |
| mc-accesibilidad | subagent | diagnóstico WCAG, recomendaciones, pruebas | por defecto solo análisis; parches aislados acordados |
| mc-verificador-final | subagent | revisión visual, financiera y regresiones | ninguna |

## Oleadas recomendadas

**W0 (solo lectura):** auditoría repositorio + mapa técnico + verificador inicial. El orquestador prepara `WORKPLAN.md`, `FILE_OWNERSHIP.md`, snapshot de dependencias y capturas.

**W1 (sistema base):** sistema de diseño primero. El shell empieza **solo cuando se definan contratos de tokens/componentes**.

**W2 (flujos críticos):** ventas/pagos y fiado/corte trabajan sobre ramas o directorios separados. No editar ambos la misma máquina de estados ni `package.json`. Si hay solapamiento, secuencializar.

**W3 (complementos):** módulos de negocio y onboarding se trabajan sobre áreas no solapadas. El orquestador integra con revisiones.

**W4 (QA):** accesibilidad inspecciona todas las rutas; verificador final ejecuta pruebas de estados y compara capturas; se arreglan regresiones y se publica decisión GO/NO-GO.

## Contrato de delegación

El orquestador debe enviar siempre: objetivo, contexto mínimo, referencias visuales exactas, **rutas permitidas**, rutas prohibidas, dependencias, invariantes financieras, criterios de aceptación, comandos de test y formato de retorno. El subagente debe devolver: plan, archivos tocados, pruebas, capturas, riesgos, pendientes, nota de integración. Si falla, no ocultarlo.

## Seguridad de git

- Crear rama de trabajo y realizar checkpoint antes de cambios.
- No ejecutar `git reset --hard`, `git clean -fdx`, borrar base de datos ni instalar dependencias globales.
- No introducir nuevas dependencias solo por comodidad sin aprobación.
- No utilizar push o deployment sin autorización.
- No habilitar secreto de producción en pruebas.

## Modelo DeepSeek

No se fijó `model` en los frontmatter para **heredar la selección de tu sesión**. Confirma el ID exacto con `opencode models` en tu equipo; un alias como “go/deepseek flash 4.1” no necesariamente es un ID de modelo válido. Si el proveedor tiene límites de herramientas o tareas, ajustar concurrencia después de verificar. La estructura de agentes está basada en https://opencode.ai/docs/agents y https://opencode.ai/docs/skills.
