# PRIOR — qué ya estaba y qué agrega esta entrega

Declaración para el hackatón. Fecha de corte: **14 de noviembre de 2026**. Nada de lo anterior a esa fecha se presenta como trabajo nuevo.

## Ya existía antes del 14 de noviembre de 2026

Trangui ya era el mostrador de un puesto de tianguis, no un prototipo solo de demo.

- **Caja:** venta, efectivo, fiado y corte, con la dirección visual de mercado de papel.
- **Cobro pey de verdad:** `POST /api/orders/[id]/pay` crea el link (`/payment-link/create`), el QR CoDi (`/codi/qr`) o el aviso al celular (`/codi/pn`) cuando hay `PEY_API_KEY`. La caja ya pedía ese QR al abrir el cobro digital.
- **Confirmación:** `POST /api/webhooks/pey` verifica la firma Standard Webhooks. Solo ese evento pasa `payment_pending` a `paid`. Un evento repetido no vuelve a sumar la venta. Se contrastan monto, moneda y referencia con el pedido.
- **Simulación:** sin llave, o con `DEMO_MODE=true`, el mismo recorrido usa `demo_paid`. `/api/verify` solo acepta comprobantes con `provider = 'pey'`.
- **Despliegue:** la aplicación ya estaba en producción, con el webhook de pey apuntando al servidor. Las llaves viven en el entorno del servidor, no en el repositorio.
- **Repositorio:** [mercado-cero-relevo](https://github.com/maxicuevax-sys/mercado-cero-relevo), aplicación en `web/`, Node 24, Next.js 16, SQLite.

El texto histórico de Mercado Cero, debajo del separador del README, es de una etapa anterior. No es esta declaración.

## Qué agrega el cambio posterior a esa fecha

No hay un segundo checkout ni otro webhook. El cobro sigue saliendo de `POST /api/orders/[id]/pay` y la confirmación sigue siendo `POST /api/webhooks/pey`.

Se agrega el mostrador `/tablero`: los tickets de hoy (hora de Ciudad de México) en una sola pantalla. Un ticket abierto de CoDi pide el QR por esa ruta. Cuando el webhook firmado marca el pedido `paid`, esa misma tarjeta dice **PAGADO**. Un evento repetido no cambia el monto: la idempotencia ya estaba en el webhook. Efectivo se lee EFECTIVO. La simulación se lee DEMO, no PAGADO.

En el cobro abierto siguen visibles, sin cobrar:

- **Tardío:** el QR sigue vigente y quedan dos minutos o menos.
- **Vencido:** pasó `qrExpiresAt` y no hay pago. Un webhook posterior todavía puede registrarlo.
- **Rechazado:** pey no creó el cobro. El pedido sigue sin pagar.

Esas palabras también están en la caja, en el cobro CoDi de inicio y, si el pedido está pendiente, en Ventas.

`PRIOR.md` es el documento de esta distinción. No incluye llaves, CLABE ni secretos.
