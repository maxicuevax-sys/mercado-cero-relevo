# Pulso — ficha del domingo 15 de noviembre de 2026

Listo para pegar. Sin llaves, sin CLABE y sin secretos.

## Equipo / proyecto

Pulso, sobre Trangui

## Descripción

Pulso anota el pedido de un puesto de tianguis en el mostrador de Trangui.
Una frase como «una quesadilla y un agua» queda como pedido y se queda por cobrar.
El inventario y la comanda no se mueven con la frase ni con un QR.
Solo un webhook firmado de pey pasa esa tarjeta a PRODUCIENDO; hoy CoDi está rechazado en la llave y no hay un cobro creado.

## Repositorio

https://github.com/maxicuevax-sys/mercado-cero-relevo

## Aplicación

https://mercado.zicua.com/tablero

Esa dirección muestra este mostrador cuando esté desplegada la rama `cursor/codi-charge-states-070f`. El host de producción todavía no tiene ese despliegue. En local la misma pantalla es `http://localhost:3000/tablero`.

## Guion de 60 segundos

1. Abre el mostrador. El ticket CoDi dice RECHAZADO / CoDi no activo. Agua, Quesadilla y Taco siguen con su existencia.
2. En «Pedido en una frase» deja «una quesadilla y un agua» y pulsa Anotar.
3. Aparece el pedido con 1 Quesadilla y 1 Agua, en POR COBRAR. Las existencias no bajan. No hay comanda.
4. Di que PRODUCIENDO espera el webhook firmado de pey. No hay un pago de $0.01 que mostrar: la llave no tiene CoDi activo y no se creó un cobro.
