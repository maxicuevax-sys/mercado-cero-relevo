# Instrucciones para probar Pulso

Conforme al requisito **10.1.6** de las Reglas del Hackatón México 2026 (máximo 1000 palabras).

## Qué es

Pulso es el mostrador de un puesto de tianguis dentro de Trangui. Anotas un pedido en una
frase, el ticket queda por cobrar, y solo pasa a producción cuando el banco confirma el pago
por el webhook firmado de pey.

- Demo pública: **https://xn--hw9h.st/tablero**
- No requiere cuenta ni invitación. Ábrela desde cualquier red.
- `DEMO_MODE=false`: los cobros de esta pantalla son **reales**.

## Requisitos para probar

- Navegador moderno (Chrome, Safari, Firefox).
- Un teléfono con la app de tu banco que soporte CoDi, para escanear el QR.
- Dinero real: el pedido mínimo del puesto es Agua $20.00. La prueba más barata cuesta $20.

## Recorrido completo (3 minutos)

1. Abre **https://xn--hw9h.st/tablero**.
   - Debes ver **LISTO**, «Anota un pedido y cobra con CoDi», existencias **Agua 20 ·
     Quesadilla 12 · Taco 15** y «Hoy todavía no hay tickets».
2. En **«Pedido en una frase»**, borra el texto que trae y escribe:
   `un agua`
   Pulsa **Anotar**.
   - Resultado esperado: un ticket **POR COBRAR · $20.00 · 1 Agua**, sin comanda y con las
     existencias intactas.
3. En ese ticket, pulsa **Cobrar con CoDi**.
   - Resultado esperado: aparece un **QR CoDi real**, generado en ese momento por el API de pey,
     y el aviso «QR listo por $20.00. Escanea y paga».
   - El ticket sigue en **POR COBRAR**: un QR no es un depósito.
4. Escanea el QR con tu app bancaria y paga el monto.
   - Resultado esperado: en segundos, sin recargar ni tocar la pantalla, la tarjeta pasa a
     **PRODUCIENDO**, aparece la **comanda** con 1 Agua y **Agua baja de 19**.
5. (Opcional) Comprueba la idempotencia: no reenvíes el aviso a mano; el endpoint está
   protegido por firma. Si pey reintenta el mismo evento, el sistema responde con
   `amountCents: 0` y no descuenta dos veces.
6. (Opcional) Revisa la línea de tiempo del ticket:
   `order.created → payment.requested → pey.webhook.verified → payment.received → fulfillment.started`.

## Qué observar

- El QR solo aparece al pedirlo; antes no hay cobro.
- La frase **no** baja inventario ni crea comanda.
- Solo el webhook firmado mueve el ticket a PRODUCIENDO.
- El inventario baja una sola vez por pedido.

## Pruebas negativas (sin gastar)

- Abre **https://xn--hw9h.st/api/health**: responde `ok:true`, `demoMode:false` y el commit
  desplegado.
- Envía un `POST` a **https://xn--hw9h.st/api/webhooks/pey** sin firma: responde **401** y el
  evento queda auditado como rechazado.

## Si no puedes pagar con CoDi

El video de demostración muestra el flujo completo, desde la generación del Mensaje de Cobro
hasta la reacción al webhook. Enlace del video: *(pendiente de publicar)*.

## Límites conocidos

- Un solo puesto (`lupita`) y un solo tablero: si dos personas lo abren al mismo tiempo, ven los
  mismos tickets.
- No hay app móvil ni cobro con tarjeta.
- El inventario no se repone solo; el efectivo y el fiado se registran a mano.
- El cobro llega a la cuenta vinculada a la llave de pey del operador.
