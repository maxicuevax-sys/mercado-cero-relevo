# Auditoría de GitHub y alcance de verificación — 8 de noviembre de 2026

Inspección mediante GitHub CLI autenticado, solo lectura. No se publicaron comentarios ni reviews, no se cerraron issues, no se hizo merge y no se borraron ramas. Este informe distingue el estado remoto comprobado de los cambios locales de la auditoría posterior.

## Identidad comprobada

- Repositorio: [maxicuevax-sys/mercado-cero-relevo](https://github.com/maxicuevax-sys/mercado-cero-relevo), actualmente **público**, rama predeterminada `main`.
- Main consultado: `84afe873b70170e80ffc85bc7b3f4f1bf75ced9a`.
- Producción identificada al comenzar esta auditoría: `4662d7a99e2a4d46fba0b9dc7fc4e018687e6f82`. El commit `84afe87` posterior solo cambia dos archivos de pruebas de auth y añade `docs/CAJA-IPHONE-4662D7A.md`; no cambia código de runtime. Los SHA siguen siendo distintos y no se presentan como una coincidencia exacta.
- Los cambios locales posteriores de entrada invitada requieren su propio commit, build y evidencia; el CI de `84afe87` no los acredita.

## PR 15: abierto, revisión pendiente

[PR #15 — Diego/onboarding](https://github.com/maxicuevax-sys/mercado-cero-relevo/pull/15) conserva el head `b0f8f8fa44023d1b402372fd17bfdb4fa6b95e84`. Sus commits son `a91618a` (subcuentas), `816875e` (UI) y `b0f8f8f` (incorporación de main/PR 13). No hubo commits posteriores a la revisión del 8 de noviembre, 19:05 UTC.

GitHub informa `mergeable: true` y `mergeable_state: clean`, pero mantiene `reviewDecision: CHANGES_REQUESTED`. La ausencia de conflictos Git no resuelve los defectos. No hay threads inline ni comentarios generales adicionales: los hallazgos están en la [review completa](https://github.com/maxicuevax-sys/mercado-cero-relevo/pull/15#pullrequestreview-5819214937).

Los dos bloqueos permanecen en ese head:

1. `web/src/lib/pey.ts` propone `/sub-account/create` sin aportar un contrato verificado y devuelve un identificador `sub_<userId>` si la petición falla. Las rutas de cobros reconstruyen `demo_sub_<tenantId>` en vez de resolver el receptor persistido; QR/push continúan seleccionando la cuenta bancaria global. Metadata no demuestra selección del beneficiario. Falta retirar ese aprovisionamiento del lote o aportar contrato, resolución de receptor y pruebas que rechacen todo fallo sin fabricar éxito.
2. La expansión de `mc-reference-a` a Caja y `display:grid!important` en `reference-a2.css` reactivan su bottom-nav. La review exige conservar el comportamiento aprobado o separar ese cambio visual y probar acciones sin obstrucción en 320/390, reflow y render real.

Los commits funcionales propios de PR 15 no están integrados. Hay aportes anteriores de Diego que sí lo están:

| Aporte integrado | Evidencia |
| --- | --- |
| Montos al borrador y efectivo exacto, preservando reintentos y contratos de pago | [PR 11](https://github.com/maxicuevax-sys/mercado-cero-relevo/pull/11), merge `0f59dd2`, commit `4dc24b0` con coautoría de Diego |
| Legibilidad del ticket manual en teléfonos angostos | [PR 13](https://github.com/maxicuevax-sys/mercado-cero-relevo/pull/13), merge `2d0d405` |
| Receptor del ensayo de un centavo enlazado al portal y callbacks firmados | [PR 18](https://github.com/maxicuevax-sys/mercado-cero-relevo/pull/18), head `f7fa72f`, ya antecesor de main |

Recomendación: no incorporar PR 15 completo en su estado actual. Separar los ajustes visuales de los bancarios; preservar las funciones actuales de main y evitar reemplazar archivos enteros por versiones antiguas del PR. No duplicar el trabajo de PR 11 ni revertir PR 18.

## Issues 1 y 2

[Issue 1](https://github.com/maxicuevax-sys/mercado-cero-relevo/issues/1) y [issue 2](https://github.com/maxicuevax-sys/mercado-cero-relevo/issues/2) siguen abiertos y sin comentarios. Consultar sus puertos/SHA históricos no acredita el entorno actual.

La API de permisos confirmó `write` para `diegoalva99` tanto en `mercado-cero-relevo` como en `mercado-cero-refs`; no es owner ni admin de estas repos. La invitación de colaboración ya está cubierta. Los pendientes sobre Tailscale/ACL, HumanLayer y comprobación del entorno de Diego no quedan acreditados por esos permisos ni por un PR. No se cerraron issues ni se marcaron tareas externas como realizadas.

## Rama documental sin PR

La rama `docs/prompts-debug-completo`, commit [`e100c393cbff21ea802ab177214a36229727bf74`](https://github.com/maxicuevax-sys/mercado-cero-relevo/commit/e100c393cbff21ea802ab177214a36229727bf74), no tiene PR asociado. Parte de `5e0b307` y añade únicamente `docs/PROMPTS-DEBUG-COMPLETO.md` (273 líneas). Frente al main consultado está un commit adelante y tres detrás.

El documento organiza la auditoría por secciones: acceso/guest, Inicio/CoDi, Caja/voz/cámara, Ventas, Movimientos, Pendientes, Fiados, Corte, Metas, Ajustes, onboarding, accesibilidad, publicación y verificación independiente. Especifica Chromium y WebKit emulado a 320/390/1448; insiste en evidencia renderizada, aislamiento de datos y demo sin cobros reales. Su snapshot de producción/main `5e0b307` ya es antiguo.

Recomendación: recuperar selectivamente ese documento y actualizar sus identidades cuando se incorpore. No resetear main a su padre. Los prompts conservados son contexto de coordinación, no una autorización adicional para publicar, borrar ramas o crear releases.

## CI comprobado

| SHA/corrida | Resultado observado | Alcance |
| --- | --- | --- |
| `4662d7a` — [42536419369](https://github.com/maxicuevax-sys/mercado-cero-relevo/actions/runs/42536419369) | Fallo | `pilot-identity.test.mjs` todavía esperaba rechazar contraseñas fuera de 12–128; recibió 200 en vez de 400. No se presentó ese rojo como una prueba de nuevo fallo del acceso público. |
| `84afe87` — [42536762482](https://github.com/maxicuevax-sys/mercado-cero-relevo/actions/runs/42536762482) | **SUCCESS** | Contratos de identidad/aislamiento, respaldo/restauración, static/build, QR, seguridad, datos, performance y browser de dos sesiones aprobados. |
| Job Full 23/23 de esa misma corrida | **SKIPPED** | No acredita full ni el estado público de un build posterior. |
| Checks existentes del PR 15 | Static aprobado; Full omitido | No resuelven los dos defectos de la review ni sustituyen probar su integración con main actual. |

## Revisión independiente del nuevo fix invitado

El defecto reproducido por el Lead era que repetir `POST /api/access/guest` con una cookie válida reemplazaba la identidad y consumía otro cupo. Se revisaron la ruta modificada y `scripts/guest-entry.test.mjs`, sin editar ese código.

La ruta candidata reutiliza la sesión verificada antes de crear cuentas; limita el cuerpo a 64 bytes y conserva el control de origen. Las pruebas usan Better Auth y SQLite temporales reales, sin mockear la decisión de sesión ni la escritura de identidad. La revisión independiente confirmó la reutilización de invitado, conservación de cuenta registrada, origen ajeno rechazado, cuerpo inválido/oversize y modo desactivado.

Se ensayó una variante con diez altas por IP/minuto. El Lead la retiró: en el hackathon, personas legítimas comparten WiFi/NAT y una cuota nueva por IP podría bloquearlas. La versión final no añade ese límite. El cuarto test persistente verifica doce visitantes desde una misma IP y ocho reintentos con la cookie existente, sin consumir cuentas adicionales al reintentar. Se conserva el cupo SQL heredado de 100 cuentas; no se afirma acceso ilimitado ni protección por persona.

No se encontró un defecto P1/P2 en la reutilización de sesión revisada. La revisión no modificó proveedores, no ejecutó pagos y no accedió a bases productivas para estas pruebas. Los resultados de la variante de rate limit retirada no se presentan como comportamiento entregado.

## Cierre por gates sin reiniciar datos productivos

| Evidencia | Qué acredita | Qué no acredita / condición |
| --- | --- | --- |
| `verify:static` + `verify:evidence -- --static` | Guardrails, lint, tipos, dependencias y build del commit limpio final | No inspecciona render ni navega la aplicación pública. |
| `test:guest-entry`, identidad, validación, tenant y recuperación | Contratos de sesión/aislamiento y persistencia con fixtures locales | No sustituye cookies/foco/navegación en un navegador público. |
| `test:judge-accounts` | Sesiones y negocios reales sobre datos temporales, servidor local propio y mismo build | Usa Chromium; no es prueba de Safari/iPhone físico ni del origen público. |
| Matriz funcional Chromium/WebKit del canary | Flujos demo reales, render, estados, consola y red del build candidato | Debe indicar ruta, motor, viewport, SHA y datos aislados. WebKit emulado se etiqueta como emulación. |
| Comprobación pública después del corte | Health/SHA, acceso/login/guest y flujos puntuales del origen desplegado | No autoriza reset global ni convierte una muestra en auditoría completa de todas las rutas. |
| `verify:full` | Sus 23 gates solo si corren completos y se sella evidencia válida | Ejecuta reset demo antes de `truth` y `preflight`; no debe apuntarse a los datos públicos. `--skip`/`--only` son parciales. |

Orden recomendado para este cierre: integrar los cambios revisados y este informe en un commit limpio; correr static y su verificador exacto; ejecutar contratos de guest/identidad y browser de cuentas en su entorno temporal; completar la matriz de las secciones en el canary del mismo SHA; desplegar solo desde el Lead con respaldo/rollback y verificar el origen público sin reset global.

El full heredado presupone acceso a su servidor principal sin la sesión de una cuenta: su reset hace `POST BASE_URL/api/demo/reset` sin cookie. El piloto de cuentas protege esa ruta y los tests actuales de cuentas tienen su propio servidor/fixtures. No se presenta un full heredado ejecutado en modo legacy como prueba del aislamiento multiusuario. Si se necesita ejecutar Full 23/23, preparar un entorno desechable separado con el mismo commit y con los targets locales/públicos de prueba requeridos por sus gates; nunca reutilizar la base ni la URL productiva para resolver sus resets. Este informe no cambia el harness ni añade excepciones a sus reglas de evidencia.
