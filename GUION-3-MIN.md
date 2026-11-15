# Guion de 3 minutos — Pulso en producción

Para el evento y para el video de demostración del Hackatón México (máximo 3 minutos, flujo
completo de un cobro CoDi).

Pantalla: **https://xn--hw9h.st/tablero** en monitor grande.
Pago: desde un celular con app bancaria que soporte CoDi. `DEMO_MODE=false`.

## Antes de grabar

- Laptop con corriente e internet estable; celular con la sesión del banco abierta.
- Tablero vacío: **LISTO**, «Hoy todavía no hay tickets», existencias **20 / 12 / 15**.
- Nadie más usando el tablero (es single-tenant: dos personas ven los mismos tickets).
- Tener a la mano la frase **«una quesadilla y un agua»** ($65) o **«un agua»** ($20).

## 0:00–0:25 · Qué es

ACCIÓN: Mostrar el tablero completo, sin tocar nada.

VOZ: «Este es el mostrador de una fonda de tianguis. Anotar el pedido y cobrar son dos mundos:
una libreta y una terminal. Pulso los junta en una pantalla. Todo lo que van a ver corre en
producción, con la llave de pey en vivo.»

## 0:25–0:55 · El pedido nace

ACCIÓN: En «Pedido en una frase», escribir **una quesadilla y un agua** y pulsar **Anotar**.

VOZ: «Escribo el pedido como lo diría el cliente. Aparece por cobrar, sesenta y cinco pesos, una
quesadilla y un agua. Y aquí está lo importante: todavía no es dinero. No bajó inventario y no
salió comanda.»

## 0:55–1:25 · El QR es real

ACCIÓN: Pulsar **Cobrar con CoDi**.

VOZ: «El ticket pide su propio cobro. Este QR lo acaba de generar el API de pey, no es una
imagen de demo. Un QR no es un depósito: hasta que el banco confirme, el ticket sigue por
cobrar.»

## 1:25–2:00 · El pago

ACCIÓN: Escanear el QR desde el celular y pagar. Dejar la pantalla quieta.

VOZ: «El cliente paga desde su app del banco. Nadie toca la pantalla. En segundos, el webhook
firmado de pey voltea el ticket: PRODUCIENDO.»

## 2:00–2:30 · Comanda e inventario

ACCIÓN: Señalar **PRODUCIENDO**, la comanda y las existencias (**19 / 11 / 15**).

VOZ: «Aquí está la comanda. El inventario bajó una sola vez. Si pey reintenta el aviso, el
sistema lo reconoce y no descuenta de nuevo.»

## 2:30–3:00 · Cierre

ACCIÓN: Mostrar la línea de tiempo del ticket.

VOZ: «Toda la confianza está en la línea de tiempo: pedido anotado, QR pedido, firma verificada,
pago recibido, comanda en el puesto. Cobrar con CoDi, sin comisión por transacción y sin pedirle
al cliente que descargue otra app. Eso es Pulso.»

## Qué no decir

- No digas «demo» ni «simulado» mientras muestras el pago real.
- No prometas «sin comisiones para siempre»: di «CoDi no cobra comisión por transacción».
- No afirmes app móvil, cobro con tarjeta ni multi-puesto: no existen todavía.
- No muestres capturas viejas como si fueran el sistema actual.

## Plan B si falla el internet o el pago

1. Recargar `/tablero` una vez; el webhook puede tardar unos segundos.
2. Si el QR no aparece, mostrar el aviso de error y pasar al video ya grabado.
3. Si no hay red, usar el video de demostración (flujo completo, mismo build).
