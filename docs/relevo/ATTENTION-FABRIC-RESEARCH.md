# ATTENTION FABRIC — investigación y diseño

**Problema real:** el goal y los subagentes siguen trabajando aunque queden preguntas, permisos o bloqueos humanos. El trabajo no se pierde, pero **la decisión sí**: se diluye entre resultados, logs y rondas automáticas. Worktrees aíslan escritura, no atención.

## Lo que hay que añadir (no un recolector)
1. **Ledger durable de obligaciones**: pregunta/permiso/bloqueo/decisión, con severidad, dueño, opciones, deadline, revisión y disposición.
2. **Gate de goal**: antes/después de cada ronda, si hay obligación `hard/system` abierta, el goal se pausa y se muestra un digest; no se auto-continúa.
3. **Contrato de worker**: ningún worker termina “esperando” sin crear una obligación; los resultados van a evidencia/resumen, no al contexto del Lead.
4. **Attention budget**: WIP limit, dedupe, silencios solo para `soft`, SLA y escalado; nada de inundar.
5. **Context/cache broker**: resumen + puntero, no logs; rotación de sesión con handoff; medir tokens/caché.
6. **Adaptadores de aprobación**: DSH, Codex/UAC y OpenCode convierten permisos en obligaciones, no en un “rechazado” silencioso.
7. **Durable execution**: si el proceso cae, la obligación y el trabajo sobreviven; el worker reclama lease y retoma.

## Open source que sí existe

| Pieza | Repo | Rol | Fit | Riesgo |
|---|---|---|---|---|
| **DSH Attention Inbox** | [QingJ01/dsh-attention-inbox](https://github.com/QingJ01/dsh-attention-inbox) · [npm](https://www.npmjs.com/package/dsh-attention-inbox) | Bandeja nativa DSH: aprobaciones, preguntas, plan review, goals bloqueados, fallos; `ctx.attention` | **Muy alto**: es exactamente el hueco | RC, `package.json` del repo `private`, npm 1.0.0 vs README rc.2; auditar antes de instalar |
| HumanLayer | [humanlayer/humanlayer](https://github.com/humanlayer/humanlayer) | Corre Claude/Codex/OpenCode en máquinas y centraliza tareas, planes, reviews; plugin OpenCode | Alto, pero es una plataforma | Apache 2.0; más pesado/cloud; self-hosting en progreso |
| Babysitter OpenCode | [a5c-ai/babysitter-opencode](https://github.com/a5c-ai/babysitter-opencode) | Plugin OpenCode event-sourced, hooks, human-in-the-loop, iteración in-turn | Alto para que OpenCode no pierda breakpoints | MIT; `session.idle` fire-and-forget; instalar en staging |
| LangGraph | [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) · [interrupts](https://docs.langchain.com/oss/javascript/langchain/frontend/human-in-the-loop) | Interrupts, checkpoints, resume, estado durable | Concepto/implementación de gate | Framework aparte; no reemplaza DSH |
| Hatchet | [hatchet-dev/hatchet](https://github.com/hatchet-dev/hatchet) | Cola/workflows durables, retries, leases | Alto para workers y approvals asíncronas | Servicio extra; verificar licencia/versión |
| Temporal / Restate | [temporalio/temporal](https://github.com/temporalio/temporal) · [restatedev/restate](https://github.com/restatedev/restate) | Durable execution/signals | Muy robusto | Más infraestructura de la necesaria hoy |
| Letta / Mem0 / Graphiti / Cognee | [letta-ai/letta](https://github.com/letta-ai/letta) · [mem0ai/mem0](https://github.com/mem0ai/mem0) · [getzep/graphiti](https://github.com/getzep/graphiti) · [topoteretes/cognee](https://github.com/topoteretes/cognee) | Memoria de largo plazo/contexto | útil post-demo | No resolver el ledger de atención |
| Langfuse / LiteLLM / Helicone / Phoenix | [langfuse/langfuse](https://github.com/langfuse/langfuse) · [BerriAI/litellm](https://github.com/BerriAI/litellm) · [Helicone/helicone](https://github.com/Helicone/helicone) · [Arize-ai/phoenix](https://github.com/Arize-ai/phoenix) | Trazas, coste/caché, routing | Necesario para medir el desgaste | Integración posterior |
| AgentOps | [AgentOps-AI/agentops](https://github.com/AgentOps-AI/agentops) | Observabilidad de agentes | Opcional | Verificar licencia/estado |

## Stack recomendado (mínimo monstruo)
**No instalar todo.** Para que funcione de verdad:
- **P0 local:** `relevo-attention` (ledger + gate + digest + worker contract), integrado con el router y el goal.
- **P1 OpenCode:** `babysitter-opencode` en un perfil staging; o HumanLayer si se necesita web/equipo.
- **P1 DSH:** auditar y, si pasa, instalar `dsh-attention-inbox` en un **perfil staging**, nunca en el perfil principal sin revisión.
- **P2 durable:** Hatchet para jobs largos y approvals asíncronas; Temporal solo si la escala lo exige.
- **P2 contexto:** AgentOS + Graphiti/Letta para memoria; LiteLLM + Langfuse para coste/caché.
- **Regla:** una sola bandeja humana; el resto son productores y consumidores de obligaciones.

## Máquina de estados de una obligación
`open → answered | acknowledged | deferred → resolved | expired | cancelled`
- `hard/system`: no se puede ignorar ni silenciar; bloquea el goal.
- `soft`: digest, defer 1h, mute por workspace.
- Cada transición exige actor + timestamp + revisión; respuesta nativa ≠ completado hasta confirmación.

## Contrato de worker
```json
{"kind":"question|approval|decision|blocker|result",
 "severity":"hard|system|soft",
 "source":"opencode:S1|codex:B|goal:round",
 "subject":"caja/mixed-payment",
 "question":"¿Aceptas el total?",
 "options":["sí","no"],
 "dedupe_key":"caja/mixed/v1",
 "owner":"lead",
 "artifact":"reports/.../evidence.json"}
```
- Resultado normal: `result` con resumen + artifact, **sin pregunta**.
- Si necesita humano: `question/approval` + `gate`.
- Si no puede continuar: `blocker` + `gate`; nunca “sigo esperando” sin obligación.

## Anti-loop / no-progress
- Presupuesto de rondas y de atención.
- Antes de continuar: si `gate` devuelve hard/system → pausar.
- Si dos rondas sin cambio de artefacto/SHA → `blocker` y parar.
- El goal no decide por el humano; solo propone y espera.

## Criterios de aceptación
1. Una pregunta creada por un worker sobrevive al cierre de su sesión y aparece en digest.
2. Un goal con obligación hard abierta no puede completarse ni seguir automáticamente.
3. No se puede cerrar una obligación sin actor/respuesta/fact de resolución.
4. Dedupe: 100 eventos del mismo sujeto → 1 obligación, no 100.
5. 0 logs de worker en el contexto del Lead; solo resumen + artifact.
6. Cada ronda reporta tokens/caché y obligaciones pendientes.
7. Si el worker muere, el lease/obligación se recupera.

## Riesgo de `dsh-attention-inbox`
Antes de instalar en el perfil real:
- Comparar npm tarball vs GitHub HEAD; verificar SHA y `private`.
- Revisar `cordis.patch.yml`, hooks, dependencias (`zod`), permisos y storage domain.
- Correr sus tests en un perfil aislado con `DSH_HOME` separado.
- Comprobar que no modifica preset/session y que desinstala limpio.
- Si falla: fork interno o extender `relevo-router`; no bloquear el demo.
