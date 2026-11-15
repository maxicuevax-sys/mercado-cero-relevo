# Declaración de componentes previos y de terceros

Conforme a la **sección 9.2** y al requisito **10.1.5** de las Reglas del Hackatón México 2026
(última actualización: 4 de noviembre de 2026).

Periodo de Construcción: **14 de noviembre – 12 de diciembre de 2026**.
Fecha de corte de esta declaración: **14 de noviembre de 2026**.

## Regla que aplica

> §9.2. Un Equipo puede reutilizar código, diseños, contenidos, productos o empresas que ya
> existían, propios o de terceros, siempre que: (a) tenga derecho a usarlos; (b) los declare en
> la Entrega, indicando qué existía antes y qué se construyó durante el Hackatón; y (c) el
> Jurado pueda distinguir ambas partes. Lo no declarado se presume construido durante el
> Hackatón.

> §10.1.5. Declaración de componentes previos y de terceros conforme a la sección 9.

## Qué existía antes del 14 de noviembre de 2026

Todo lo de esta tabla se declara **previo** y no se presenta como trabajo del hackatón.

| Componente | Evidencia | Nota |
|---|---|---|
| Producto Trangui: Caja, efectivo, fiado, corte, ventas, movimientos, autenticación con Better Auth y SQLite | Commits del 6 al 13 de noviembre de 2026 en `main`; primer commit de la app `f35f76c` (2026-11-06) | Producto preexistente, en producción |
| `POST /api/orders/[id]/pay` — crea link, QR CoDi o aviso al celular contra el API de pey | `f35f76c`, 2026-11-06 | Integración base con pey, **previa al arranque** |
| `POST /api/webhooks/pey` — verifica firma Standard Webhooks y aplica el pago | `f35f76c`, 2026-11-06 | Igual que arriba |
| `POST /api/verify` — verificación de comprobantes | `f35f76c`, 2026-11-06 | |
| Centro de cobro de la Caja (`codi-hub.tsx`) que ya pedía `{mode:"qr"}` | Previo al 14 de noviembre | Reutilizado, no nuevo |
| Despliegue: contenedor Docker, LiteSpeed, CPU/STT, llaves en el entorno del servidor | Previo al 14 de noviembre | Ver `docs/container-runtime.md` |

## Qué se construyó durante el periodo (nuevo)

Todo lo de esta tabla es del **14 de noviembre de 2026** y sí se presenta como trabajo del
hackatón.

| Componente | Evidencia | Qué hace |
|---|---|---|
| Pantalla `/tablero` (mostrador del puesto) | PR #44, commit `dd404ee`, 2026-11-14 | Muestra tickets del día, existencias y línea de tiempo |
| `POST /api/tablero/frase` — pedido a partir de una frase | PR #44, 2026-11-14 | Convierte «una quesadilla y un agua» en conceptos del puesto |
| **Botón «Cobrar con CoDi» dentro del ticket** | PR #47, commit `5a2f6db`, 2026-11-14 | Pide el QR a pey desde el mostrador y lo dibuja en la tarjeta |
| `pulso-apply.ts` — PRODUCIENDO solo con pago verificado | PR #44, 2026-11-14 | Comanda, descuento de inventario una sola vez, timeline |
| `stall_products` / `inventory_moves` / `order_timeline` | PR #44, 2026-11-14 | Un puesto (`lupita`) y tres productos con existencia |
| Corrección del webhook QR para aceptar el payload plano de pey sin `currency` | PR #46, commit `6727f8e`, 2026-11-14 | Permite procesar el evento real de CoDi |
| Ajuste visual del tablero (palabra sin recorte, primer fotograma honesto) | PR #48, 2026-11-14 | Legibilidad en pantalla grande y móvil |

Los cobros reales ocurrieron el **14 de noviembre**: $0.01 (20:31 UTC) y $1.00 (21:06 UTC),
`provider=pey`, `method=codi`, `status=paid`. Los ensayos posteriores que simularon avisos
firmados para probar idempotencia **no fueron dinero real** y sus pedidos se borraron.

## Dependencias y servicios de terceros (§9.4)

| Tercero | Uso | Licencia / término |
|---|---|---|
| pey API | Generación de Mensajes de Cobro CoDi y webhooks de estatus | Términos del API de pey |
| Next.js 16, React 19 | Framework y UI | MIT |
| Better Auth | Sesiones de la app | MIT |
| `node:sqlite` (Node 24) | Base de datos local | MIT |
| QRCode (npm) | Dibujo del QR en pantalla | MIT |
| Playwright | Pruebas de navegador | Apache 2.0 |
| Docker / LiteSpeed | Despliegue en el VPS | Sus propias licencias |

Herramientas de IA usadas para construir el proyecto: se usaron y, conforme a §9.3, no se
requiere declararlas. El Equipo responde por el resultado.

## Riesgo de elegibilidad que el Equipo declara

La §6.5 pide que, cuando participa un producto existente, «la integración con CoDi y el API de
pey […] debe ser nueva». En este proyecto la integración **base** con pey (rutas de cobro y
webhook) existía desde el 6 de noviembre, es decir, antes del arranque. Lo construido **dentro**
del periodo es el flujo completo de mostrador: el pedido por frase, el botón que genera el QR
CoDi desde el ticket, y la reacción idempotente del webhook que pasa a PRODUCIENDO con comanda e
inventario.

Para resolver la duda antes del cierre de Postulación, el Equipo puede hacer una consulta
vinculante a `legal@pey.mx`, como permite la §7.7. Esta declaración no oculta el hecho: lo deja
a la vista para que el Jurado pueda distinguir las dos partes, como exige la §9.2(c).
