# DEMO REHEARSAL — FINAL

**Fecha:** 2026-11-06 22:32 America/Mexico_City
**Candidato:** `http://127.0.0.1:4580` build **`53b1f61cea9dbabddd3ccf31c3428db756cd05a0`**
**Fallback:** `http://127.0.0.1:4497` build **`d1fe344fcaa15a5625d09db10a6e049c6464ba03`**
**Rama:** `revision/assembly-2` · sin push a remoto ni merge a `main`

## Evidencia
| Gate | Resultado | SHA/nota |
|---|---|---|
| build producción + identidad | PASS | 53b1f61 |
| static 5/5 (guard/lint/types/deps/build) | PASS | 53b1f61, árbol limpio |
| `verify:evidence -- --static` | PASS | 53b1f61 |
| security | **58/58** | full candidate |
| demo-pay | **66/66** | full candidate |
| B1 regression | **73/73** | full candidate |
| rutas | **18/18** 200, 1 H1, 0 pageerrors | 4580 |
| Detalle de venta | **30 enlaces** desde `/ventas`; ruta 200, 0 errores | `ventas/[id]` |
| watchdog | activo, web/STT/SHA/MANIFEST OK | PID 19808, WARN solo colas históricas |
| attention gate | **PASS** | 4 decisiones respondidas |

## Rutas verificadas
`/`, `/inicio`, `/onboarding`, `/caja`, `/ayuda`, `/ajustes`, `/fiados`, `/fiados/nuevo`,
`/fiados/registrado`, `/fiados/juan/abono`, `/corte`, `/corte/historial`, `/metas`,
`/metas/nueva`, `/pendientes`, `/pendientes/nuevo`, `/ventas`, `/ventas/[id]`.

## Ensayo manual P0
1. Abrir 4580 en 390/320; si falla, abrir 4497.
2. Onboarding: 4 pasos → entrar.
3. Caja: ticket demo → Descartar visible; venta efectivo/digital/fiado.
4. Método de pago → QR → confirmar solo consulta → resultado demo honesto.
5. Fiados: historial, nuevo, cliente, abono, registrado.
6. Corte: día e historial.
7. Metas: activa y nueva.
8. Pendientes: hoy y nuevo.
9. Ventas → Detalle de venta → ticket/estado.
10. Ayuda/Ajustes.
No afirmar `paid` real: todo es `demo_paid`/demo.

## Límites declarados
- Paridad visual exacta de las pantallas nuevas: **verificada por build/smoke/capturas parciales, no auditoría visual completa de las 24 refs**.
- Desktop: solo Inicio tiene referencia; el resto desktop no se inventa.
- `paid` real por webhook firmado: **NO VERIFICADO** (sin `PEY_API_KEY`).
- AgentOS: **aislado del demo**; guard histórico sigue bloqueado.
- `dsh-attention-inbox`: candidato MIT en staging; **no instalado** en perfil principal.
- Hermes/OpenCode Go: arquitectura y onboarding listos; **no desplegados** aún.
- Sin merge/push; `4497` intacto.

## GO
**GO condicionado de demo** con candidato `53b1f61` y fallback `d1fe344`.
No es GO de producción: es un candidato local estable, con evidencia y límites explícitos.
