# Auditoría por secciones — Trangui, 8 de noviembre de 2026

Estado de inicio: main `84afe87`, producción/canary `4662d7a`. La coincidencia de código runtime entre esos commits no equivale a coincidencia de SHA. Este informe es una matriz de trabajo; no declara completa la auditoría.

## Hallazgos reproducidos y correcciones del candidato

1. **Entrada invitada:** dos POST con cookie válida creaban dos cuentas y cambiaban el negocio visible. La prueba contra canary confirmó `repeatedGuestPreservesIdentity:false`. El candidato reutiliza la sesión verificada, conserva también las cuentas registradas y no consume nuevas plazas al reintentar. Valida un cuerpo vacío o `{}` de hasta 64 bytes. Se conserva el cupo SQL existente de 100 cuentas. No se añade un nuevo límite por IP que bloquee a personas compartiendo el WiFi del evento.
2. **Corte:** la fila «Cobros» repetía `salesCents`, incluyendo pendientes y fiados. El candidato separa efectivo/digital verificado, cobros demo y digital declarado sin verificar. Dos pruebas con SQLite real verifican ventas pendientes sin cobro, abonos, distinción demo/real e idempotencia.

3. **Cantidades y precios decimales por voz:** `0.5` y `0,5` se segmentaban como `5`, proponiendo diez veces el importe. La corrección conserva decimales y precios con punto/coma; se prueba contra ejemplos y catálogo sin duplicar conceptos.

Estas correcciones están probadas localmente; necesitan gates, build y verificación del candidato antes de llamarlas publicadas.

## Matriz de ejecución

| Sección | Evidencia del baseline | Qué sigue pendiente |
| --- | --- | --- |
| Acceso, registro, sesión | Chromium/WebKit, 390/1448: contraseña de un carácter, mostrar/ocultar, signup, logout, login y recuperación de la orden propia | Reintento invitado con el candidato; iPhone físico no acreditado |
| Onboarding | Giro elegido, persistencia y llegada a Inicio en las cuatro combinaciones anteriores | Verificación pública del candidato |
| Inicio | Capturas de render en 390/1448, navegación visible y propuesta de venta | Matriz transversal 320 y estados ampliados no se deducen de HTTP 200 |
| CoDi | Centavo demo, consultar, QR, simular y estado demo_paid; cero pagos reales | Retestar el candidato y registrar lectura del QR si se afirma escaneabilidad |
| Caja y Nueva venta | Sugerencia Jitomate, interpretar con API real, ticket, efectivo demo 25 y nueva venta vacía | Respuesta perdida y reintento; micrófono según capacidades del navegador |
| Ventas y Movimientos | Render y comprobaciones de órdenes por identificador en curso | No declarar cerrados todos los filtros/detalles por render de la lista |
| Fiados | Cuenta propia: deuda 50, abono 20, saldo 30 e historial persistido | Matriz y casos de borde finales |
| Corte | Defecto de Cobros reproducido; corrección local con dos pruebas financieras | Inspección render del candidato y cierre de caja completo |
| Metas | Crear meta 100 con ahorro 5 y añadir 5 produce 10 | Matriz y validaciones finales |
| Pendientes | Crear con 503 inyectado, error visible, reintento real; completar/reabrir y cancelar borrado | Matriz final y revalidación del candidato |
| Ajustes, Ayuda, Notificaciones | Navegación y render en curso; logout por enlace visible ya probado | Controles, accesibilidad y persistencia completos |

Las capturas y JSON de los agentes están bajo `web/test-results/full-audit/` y los directorios de QA de cada carril; son artefactos locales ignorados. Deben inspeccionarse y relacionarse con el build antes de usar una captura como prueba de cierre.

## Capas transversales comprobadas

- CI de main `84afe87`: [SUCCESS](https://github.com/maxicuevax-sys/mercado-cero-relevo/actions/runs/42536762482), incluido browser de dos sesiones. Full 23/23 fue omitido, no aprobado.
- Contratos locales: tenant 8/8 y perfiles 6/6 PASS. El contrato de seguridad local no se ejecutó por falta de build local; el CI sí lo ejecutó. No se transforma esa precondición en un fallo del producto.
- Anónimo público: `/inicio` puede responder HTTP 200 por streaming de Next; contextos Chromium/WebKit sin cookies a 390/1448 terminaron en `/acceso`, sin controles de tenant. No se encontró fuga con esa prueba.
- Caché pública observada: acceso/registro privados y no-store; health no-store; Inicio privado/no-store; doce recursos Next con hash en el HTML de acceso. No hubo cabeceras CF-Cache-Status/X-LiteSpeed-Cache en esas respuestas. Eso no inventaría un diagnóstico global de red.
- Escaneo estrecho de patrones de credenciales en archivos Git actuales: sin coincidencias; sin `.env`, runtime.env, SQLite o DB rastreados en los patrones consultados. No equivale a auditoría completa del historial ni de secretos remotos.
- Pruebas de escritura/venta no ejecutan pagos reales. Los datos mutados por la auditoría pertenecen a cuentas propias del canary, salvo comprobaciones públicas expresamente identificadas.

## GitHub

El detalle está en [GITHUB-AUDIT-2026-11-08.md](GITHUB-AUDIT-2026-11-08.md). PR 15 conserva cambios solicitados por receptor bancario no acreditado y navegación de Caja. Issues 1/2 mantienen pendientes de onboarding externo; permiso write en ambas repos está confirmado. Se recuperó selectivamente [PROMPTS-DEBUG-COMPLETO.md](PROMPTS-DEBUG-COMPLETO.md) desde la rama documental sin mezclar código antiguo.

No se aprobaron PRs, no se cerraron issues, no se eliminaron ramas y no se crearon tags/releases como sustituto de comprobar sus requisitos.
