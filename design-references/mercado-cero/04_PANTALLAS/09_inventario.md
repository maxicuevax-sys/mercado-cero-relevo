# Productos e inventario

**Prioridad:** P1 · **Agente dueño:** `mc-modulos-negocio` · **Referencia:** `01_REFERENCIAS/recortes/23_Reportes_Simples.png`

## Problema humano y tarea

Reducir memorización de existencias, facilitar venta por producto, alinear compras.

## Jerarquía y componentes propuestos

Buscar productos, categorías simples, disponibilidad, unidad, precio, costo opcional, alerta por bajo inventario configurable, nuevo producto.

## Datos / contrato financiero (NO inferir lógica desde la imagen)

Descuento de stock vinculado a venta registrada según reglas; no asumir inventario preciso para puestos que no lo registran; venta por importe libre permanece disponible.

## Estados y situaciones de prueba

Productos sin stock, unidades mixtas, vender sin inventario, corrección manual, duplicado, compras con proveedores.

## Accesibilidad

Búsqueda tolerante, lectura de unidades, controles +/-, soporte de teclado y una mano.

## Definition of Done

No obliga a catalogar para cobrar; inventario nunca muestra certeza cuando falta registro.

## Entrega de subagente

- Screenshot móvil y escritorio cuando aplique, con fuente ampliada.
- Lista de componentes y archivos modificados.
- Evidencia de test en caso feliz, vacío, error, sin conexión y estado restringido.
- Confirmación de que no se tocó contabilidad ni integración bancaria salvo tarea explícita.
- Enlace a tarea/PR local o commit opcional; incluir fallos y decisiones pendientes.
