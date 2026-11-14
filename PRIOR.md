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

No hay una app nueva ni otro webhook. Pulso vive en el mostrador de Trangui, ruta `/tablero`. El cobro sigue siendo `POST /api/orders/[id]/pay` y la confirmación sigue siendo `POST /api/webhooks/pey`.

### Pulso — nuevo en esta entrega

Un puesto (`lupita`) y tres productos con existencia: Agua, Quesadilla y Taco. La tarjeta CoDi no pide un cobro desde el mostrador.

Una frase corta, por ejemplo «una quesadilla y un agua», solo se interpreta como conceptos del puesto. El pedido queda **POR COBRAR**. Esa lectura no marca `paid`, no baja inventario y no abre la comanda.

- Sin QR real, la tarjeta dice **RECHAZADO** / CoDi no activo. No es un depósito ni un pedido en producción.
- Con QR real y sin webhook, se queda en **POR COBRAR**.
- Cuando el webhook firmado verifica el pago, esa misma tarjeta pasa a **PRODUCIENDO**: aparece la comanda, el inventario de los productos de ese pedido baja una vez, y la línea de tiempo muestra `order.created` → `payment.requested` → `pey.webhook.verified` → `payment.received` → `fulfillment.started`.
- El paso del webhook dice que la firma se verificó. Un segundo envío del mismo `webhook-id` no descuenta otra vez ni crea otra comanda.

Tardío y vencido siguen visibles en un QR que sí existe, y tampoco cobran. Efectivo se lee EFECTIVO. La simulación se lee DEMO, no PRODUCIENDO.

`PRIOR.md` es el documento de esta distinción. No incluye llaves, CLABE ni secretos.
