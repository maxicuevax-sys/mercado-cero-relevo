# PRECAUCIÓN

Este directorio contiene archivos `.opencode/agents/*.md` y `.opencode/skills/mercado-cero-design/SKILL.md` en **formatos documentados de OpenCode 1**: https://opencode.ai/docs/agents, https://opencode.ai/docs/skills.

**No reemplaces tu configuración existente.** El JSON que adjuntamos es un ejemplo para considerar `default_agent`, no un archivo para pegar. Si tu instalación usa configuración de OpenCode v2, verifica los cambios de esquema: https://opencode.ai/v2/docs/agents.

Todos los agentes omiten `model` a propósito para heredar el modelo que hayas seleccionado. Confirma proveedor y modelo real mediante `opencode models` y `opencode agent list`; no tenemos acceso a tu instalación actual.

Los agentes con `permission: edit: ask` requieren aprobación de cambios. Antes de habilitar aprobaciones generales, confirma que la rama está respaldada. Al iniciar la sesión, verifica el contexto de trabajo; si no existen rutas del kit, ajustarlas antes de delegar.
