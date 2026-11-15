# Pulso — ficha de entrega

Sin llaves, sin CLABE y sin secretos. Verificable hoy en `https://xn--hw9h.st/tablero`.

## Equipo / proyecto

Pulso, sobre Trangui

## Descripción

Pulso es el mostrador de un puesto de tianguis dentro de Trangui: anota un pedido en una frase,
lo deja por cobrar y solo lo entrega cuando el banco confirma el pago.

El problema: en un puesto de tianguis, anotar y cobrar son dos mundos. El pedido se apunta en
una libreta y el cobro se cobra aparte, a veces sin que nadie sepa si el dinero entró. Pulso
junta las dos cosas en una pantalla.

En `/tablero` escribes «una quesadilla y un agua» y pulsas **Anotar**. El pedido aparece en
**POR COBRAR** por $65.00. La frase solo se convierte en conceptos del puesto: no baja
inventario, no abre comanda y no marca pagado.

Desde ese mismo ticket, **Cobrar con CoDi** pide el cobro al API de pey con la llave en vivo.
El QR lo genera pey en ese momento (`POST /codi/qr`): no es una imagen de demostración. El
pedido queda esperando confirmación y el mostrador lo dice sin adornos: un QR no es un depósito.

La confirmación es un webhook firmado de pey (`POST /api/webhooks/pey`, Standard Webhooks con
secreto `whsec_…`). El endpoint exige la firma: lo que no firma se rechaza con 401 y queda
auditado. El evento se registra por `webhook-id` y por transacción, así que un reintento no suma
la venta dos veces. Se contrasta el monto exacto contra el saldo pendiente, la moneda (MXN) y la
referencia del pedido.

Solo cuando ese evento llega, el ticket pasa a **PRODUCIENDO**: aparece la comanda, el
inventario de los productos de ese pedido baja una sola vez y la línea de tiempo muestra
`order.created → payment.requested → pey.webhook.verified → payment.received → fulfillment.started`.

Con la llave en vivo y `DEMO_MODE=false`, CoDi cobró **dos pagos reales** desde la cuenta del
operador: **$0.01** (14 nov, 20:31 UTC) y **$1.00** (14 nov, 21:06 UTC), `provider=pey`,
`method=codi`, `status=paid`, un solo registro por transacción. La bitácora encadenada
(`audit_log` con `prev_hash` y `entry_hash`) conserva cada `payment.recorded`.

Límites declarados: single-tenant (un puesto, tres productos); sin app móvil ni cobro con
tarjeta; el inventario se descuenta una vez y no se repone solo; efectivo y fiado se registran a
mano. La idea central: un QR no es un depósito; el dinero se da por recibido únicamente con el
webhook firmado.

## Declaración de componentes previos y de terceros (§10.1.5)

Ver **[DECLARACION-PREVIO-Y-NUEVO.md](./DECLARACION-PREVIO-Y-NUEVO.md)**: tabla con lo que
existía antes del 14 de noviembre (Trangui y la integración base de pey) y lo construido durante
el periodo (mostrador `/tablero`, pedido por frase, botón **Cobrar con CoDi**, PRODUCIENDO con
comanda e inventario). Incluye el riesgo de la §6.5 sobre «integración nueva» y las dependencias
de terceros.

## Instrucciones para probar (§10.1.6)

Ver **[INSTRUCCIONES-DE-PRUEBA.md](./INSTRUCCIONES-DE-PRUEBA.md)**: recorrido de 3 minutos, qué
observar y pruebas negativas sin gastar.

## Demo pública (§10.1.2)

https://xn--hw9h.st/tablero

- Abre sin login ni invitación.
- `DEMO_MODE=false`: los cobros son reales y llegan a la cuenta vinculada a la llave de pey.
- `https://mercado.zicua.com/tablero` está detrás de Cloudflare Access: **no** sirve como demo
  pública.

## Video de demostración (§10.1.3)

*(pendiente de publicar; máximo 3 minutos, flujo completo de un cobro CoDi.)*

## Repositorio (§10.1.4)

https://github.com/maxicuevax-sys/mercado-cero-relevo

- Aplicación en `web/`. Node 24, Next.js 16, SQLite.
- Código abierto Apache 2.0.
- El commit desplegado es el que reporta `/api/health` en producción.

## Estado de CoDi (hoy)

| Punto | Estado |
|---|---|
| Llave de pey | En vivo, en el entorno del servidor; nunca en el repositorio |
| Modo | `DEMO_MODE=false` |
| QR | Real, generado por el API de pey (`POST /codi/qr`) y dibujado en el ticket |
| Pagos reales cobrados | **$0.01** (20:31 UTC) y **$1.00** (21:06 UTC) por CoDi, `provider=pey`, `status=paid` |
| Webhook | Firma Standard Webhooks obligatoria; envíos sin firma rechazados con 401 |
| Idempotencia | Reenvíos del mismo aviso no crean otro pago ni otra comanda; responden `amountCents: 0` |
| Reconciliación | Monto exacto contra saldo, moneda MXN y `numRef`/`orderId` contrastados |

## Guion de 60 segundos (resumen)

1. Abre el mostrador: **LISTO**, existencias **20 / 12 / 15**.
2. Escribe «una quesadilla y un agua» → **Anotar** → **POR COBRAR · $65.00**.
3. **Cobrar con CoDi** → QR real → «QR listo por $65.00».
4. Paga desde el celular → **PRODUCIENDO**, comanda y existencias **19 / 11 / 15**.

## Nota de honestidad

Esta ficha sustituye versiones anteriores que decían que CoDi estaba rechazado y que el host no
tenía el despliegue. Hoy la llave está activa, el QR es real y hubo dos cobros reales por $1.01
en total. Lo que no se puede afirmar: no hay app móvil, no hay cobro con tarjeta, no hay
multi-puesto, no hay métricas de campo con comerciantes y la demo comparte un solo tablero.
