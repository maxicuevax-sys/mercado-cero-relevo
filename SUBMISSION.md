# Pulso — ficha del domingo 15 de noviembre de 2026

Sin llaves, sin CLABE y sin secretos. Todo lo que sigue se puede comprobar hoy en
`https://xn--hw9h.st/tablero`.

## Equipo / proyecto

Pulso, sobre Trangui

## Descripción

Pulso es el mostrador de un puesto de tianguis dentro de Trangui: anota un pedido en una
frase, lo deja por cobrar y solo lo entrega cuando el banco confirma el pago.

En `/tablero` escribes «una quesadilla y un agua» y pulsas **Anotar**. El pedido aparece en
**POR COBRAR** por $65.00. La frase solo se convierte en conceptos del puesto: no baja
inventario, no abre comanda y no marca pagado.

Desde ese mismo ticket, el botón **Cobrar con CoDi** pide el cobro a la API de pey con la
llave en vivo. El QR que aparece en pantalla lo generó pey en ese momento (`POST /codi/qr`):
no es una imagen de demostración. El pedido queda esperando confirmación y el mostrador lo
dice sin adornos: un QR no es un depósito.

La confirmación es un webhook firmado de pey (`POST /api/webhooks/pey`, firma Standard
Webhooks con secreto `whsec_…`). El endpoint exige la firma: cualquier envío sin firma válida
se rechaza con 401 y queda auditado. El evento se registra por `webhook-id` y por transacción,
así que un reintento del mismo aviso no suma la venta dos veces. Además se contrasta el monto
exacto contra el saldo pendiente, la moneda (MXN) y la referencia del pedido.

Solo cuando ese evento llega, el ticket pasa a **PRODUCIENDO**: aparece la comanda, el
inventario de los productos de ese pedido baja una sola vez y la línea de tiempo muestra
`order.created → payment.requested → pey.webhook.verified → payment.received → fulfillment.started`.

Con la llave en vivo y `DEMO_MODE=false`, CoDi cobró **dos pagos reales** desde la cuenta del
operador: **$0.01** (14 nov, 20:31 UTC) y **$1.00** (14 nov, 21:06 UTC). Ambos con webhook
firmado verificado, `provider=pey`, `method=codi`, `status=paid`, y un solo registro por
transacción. La bitácora encadenada (`audit_log` con `prev_hash` y `entry_hash`) conserva cada
`payment.recorded`. Los ensayos posteriores simularon avisos firmados para probar la
idempotencia; esos no fueron dinero real y sus pedidos se borraron.

La aplicación es pública en `https://xn--hw9h.st/tablero`, sin invitación ni contraseña. El
código está en GitHub. `https://mercado.zicua.com/tablero` es una copia detrás de Cloudflare
Access: no sirve como demo pública.

Límites que no escondemos: es single-tenant (un puesto, tres productos con existencia); no hay
app móvil ni cobro con tarjeta; el cobro llega a la cuenta vinculada a la llave de pey; CoDi
no cobra comisión por transacción, pero eso no promete que no exista comisión en otros medios;
el inventario se descuenta una vez por pedido y no se repone solo; el efectivo y el fiado se
registran a mano. La idea central: un QR no es un depósito; el dinero se da por recibido
únicamente con el webhook firmado.

## Repositorio

https://github.com/maxicuevax-sys/mercado-cero-relevo

- Aplicación en `web/`. Node 24, Next.js 16, SQLite.
- Código abierto Apache 2.0.
- El commit desplegado es el que reporta `/api/health` en producción.

## Aplicación

https://xn--hw9h.st/tablero

- Abre sin login ni invitación (verificado el 14 nov 2026 desde red externa).
- `DEMO_MODE=false`: los cobros de esta pantalla son reales y llegan a la cuenta vinculada a
  la llave de pey.
- No usar `mercado.zicua.com/tablero` como enlace de demo: está detrás de Cloudflare Access y
  pide autenticación.

## Estado de CoDi (hoy)

| Punto | Estado |
|---|---|
| Llave de pey | En vivo, en el entorno del servidor; nunca en el repositorio |
| Modo | `DEMO_MODE=false` |
| QR | Real, generado por la API de pey (`POST /codi/qr`) y dibujado en el ticket del mostrador |
| Pagos reales cobrados | **$0.01** (20:31 UTC) y **$1.00** (21:06 UTC) por CoDi, `provider=pey`, `status=paid` |
| Webhook | Firma Standard Webhooks obligatoria; envíos sin firma rechazados con 401 |
| Idempotencia | Reenvíos del mismo aviso no crean otro pago ni otra comanda; el evento responde `amountCents: 0` |
| Reconciliación | Monto exacto contra saldo, moneda MXN y `numRef`/`orderId` contrastados |

## Guion de 60 segundos (resumen)

1. Abre el mostrador. Arriba dice **LISTO** y «Anota un pedido y cobra con CoDi»; existencias
   **Agua 20 · Quesadilla 12 · Taco 15**.
2. En «Pedido en una frase» borra el texto que ya trae y escribe «una quesadilla y un agua».
   Pulsa **Anotar**. Aparece **POR COBRAR · $65.00 · 1 Quesadilla · 1 Agua**. Las existencias no
   bajan y no hay comanda.
3. Pulsa **Cobrar con CoDi**. Aparece el QR y el aviso «QR listo por $65.00. Escanea y paga».
   Sigue en **POR COBRAR**.
4. Paga desde el celular. En segundos la tarjeta pasa sola a **PRODUCIENDO**: comanda,
   existencias un número abajo (si empezaste en 20/12/15 quedan **19 / 11 / 15**) y línea de
   tiempo con «Firma verificada.»

El detalle con selectores exactos, respaldos y frases a evitar está en `GUION-DEMO-60S.md`.

## Nota de honestidad

Esta ficha sustituye la versión que decía «CoDi está rechazado en la llave y no hay un cobro
creado». Eso dejó de ser cierto: la llave está activa, el QR es real y hubo dos cobros reales
por $1.01 en total. La versión anterior también enlazaba `mercado.zicua.com` como aplicación,
pero esa dirección está protegida por Cloudflare Access y no permite que un jurado vea la demo.

Lo que no se puede afirmar todavía: no hay app móvil, no hay cobro con tarjeta, no hay
multi-puesto, no hay métricas de campo con comerciantes y la demo pública comparte un solo
tablero, así que dos personas que la abran al mismo tiempo ven los mismos tickets.
