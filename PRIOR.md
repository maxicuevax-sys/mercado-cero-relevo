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

Ningún cobro real de CoDi ocurrió antes de esa fecha. La primera vez que la llave generó un QR real y cobró fue el **14 de noviembre**, y eso va abajo, no aquí.

El texto histórico de Mercado Cero, debajo del separador del README, es de una etapa anterior. No es esta declaración.

## Qué agrega el cambio posterior a esa fecha

No hay una app nueva ni otro webhook. Pulso vive en el mostrador de Trangui, ruta `/tablero`. El cobro sigue siendo `POST /api/orders/[id]/pay` y la confirmación sigue siendo `POST /api/webhooks/pey`; ambos existen desde el 6 de noviembre de 2026. Lo que se agrega es la pantalla del puesto y la prueba de que el camino completo, QR real incluido, funciona con dinero real.

### Componentes previos que esta entrega reutiliza (no se presentan como nuevos)

- `web/src/app/api/orders/[id]/pay/route.ts` — crea el link, el QR CoDi o el aviso al celular con `PEY_API_KEY`.
- `web/src/app/api/webhooks/pey/route.ts` — verifica la firma, exige `webhook-id`, registra el evento y aplica el pago.
- `web/src/app/api/verify/route.ts` — solo acepta comprobantes con `provider='pey'` y `demo=0`.
- Caja, efectivo, fiado y corte (`/caja`, `/fiados`, `/corte`), el modo demo con `demo_paid` y el despliegue con la llave en el entorno del servidor.

### Pulso — nuevo en esta entrega

Todo lo siguiente es del 14 de noviembre y vive en `web/src/components/tablero/`, `web/src/app/tablero/` y `web/src/lib/pulso-apply.ts`:

- **Un puesto y tres productos con existencia:** `lupita`, Agua 20 a $20.00, Quesadilla 12 a $45.00, Taco 15 a $35.00. El tablero muestra el día en curso y las existencias.
- **Una frase solo se vuelve conceptos del puesto.** «Una quesadilla y un agua» crea el pedido en **POR COBRAR** por $65.00. Esa lectura no marca pagado, no baja inventario y no abre comanda.
- **El ticket abierto pide su propio cobro.** El botón **Cobrar con CoDi** hace `POST /api/orders/[id]/pay` con `{mode:"qr"}`; la API de pey responde el `qrString` y el servidor dibuja el QR dentro del ticket. No es una imagen de demostración: se generó en ese momento con la llave en vivo.
- **El QR no es un depósito.** Mientras no llegue la confirmación, la tarjeta sigue en **POR COBRAR**. Un QR en pantalla, vencido o rechazado no cobra.
- **La única puerta al pago es el webhook firmado.** `POST /api/webhooks/pey` exige la firma: los envíos sin firma válida se rechazan con 401 y quedan auditados. El evento se deduplica por `webhook-id` y, además, por transacción: un reenvío del mismo aviso responde `amountCents: 0` y no suma otra venta ni crea otra comanda. Se contrastan monto exacto contra el saldo pendiente, moneda MXN y `numRef`/`orderId`.
- **PRODUCIENDO solo con el pago confirmado.** Cuando el webhook firmado entra, la misma tarjeta pasa a **PRODUCIENDO**: aparece la comanda, el inventario de los productos de ese pedido baja una sola vez (`inventory_moves` con `INSERT OR IGNORE`) y la línea de tiempo muestra `order.created → payment.requested → pey.webhook.verified → payment.received → fulfillment.started`, con «Firma verificada.» en el paso del webhook.
- **Estado real de CoDi hoy:** llave en vivo, `DEMO_MODE=false` y **dos cobros CoDi reales** desde la cuenta del operador: $0.01 (20:31 UTC) y $1.00 (21:06 UTC), `provider=pey`, `method=codi`, `status=paid`. Los ensayos posteriores simularon avisos firmados para probar idempotencia; esos eventos no fueron dinero real y sus pedidos se borraron. La evidencia de los dos cobros reales vive en `audit_log` (`prev_hash`/`entry_hash`), no en un ticket visible.

### Límites de esta entrega (declarados, no maquillados)

- Es **single-tenant**: un puesto, un tablero. Dos personas que abran la demo al mismo tiempo ven los mismos tickets.
- No hay app móvil, no hay cobro con tarjeta y no hay multi-puesto.
- El efectivo y el fiado se registran a mano; el inventario se descuenta una vez por pedido y no se repone solo.
- El tablero vacío ya no muestra «RECHAZADO / CoDi no activo»: hoy dice **LISTO** y «Anota un pedido y cobra con CoDi».

`PRIOR.md` es el documento de esta distinción. No incluye llaves, CLABE ni secretos.

---

### Trazabilidad de fechas (para sostener la declaración)

| Archivo | Primer commit en `main` |
|---|---|
| `web/src/app/api/webhooks/pey/route.ts` | `f35f76c`, 2026-11-06 |
| `web/src/app/api/orders/[id]/pay/route.ts` | `f35f76c`, 2026-11-06 |
| `web/src/app/api/verify/route.ts` | `f35f76c`, 2026-11-06 |
| `web/src/app/tablero/page.tsx` | `dd404ee`, 2026-11-14 (#44) |
| `web/src/components/tablero/stall-board.tsx` | `dd404ee`, 2026-11-14 (#44) |
| `web/src/lib/pulso-apply.ts` | `dd404ee`, 2026-11-14 (#44) |
| Botón «Cobrar con CoDi» | `5a2f6db`, 2026-11-14 (#47) |
| Cobros reales $0.01 y $1.00 | 2026-11-14, 20:31 y 21:06 UTC |
