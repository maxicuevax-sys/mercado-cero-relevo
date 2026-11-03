# Seleccionar forma de pago

**Prioridad:** P0 · **Agente dueño:** `mc-ventas-pagos` · **Referencia:** `01_REFERENCIAS/recortes/18_Nueva_Venta_Movil.png`

## Problema humano y tarea

Distinguir claramente efectivo, digital, fiado y pagos mixtos si el modelo financiero existente los soporta.

## Jerarquía y componentes propuestos

Resumen no editable de total arriba; opciones con icono + descripción («entra a caja», «esperando banco», «queda por cobrar»); CTA que cambie según método.

## Datos / contrato financiero (NO inferir lógica desde la imagen)

Si es fiado se registra cuenta por cobrar; si es efectivo se confirma recibido/entregado; si es digital QR no equivale a pago verificado. Pagos parciales: saldo y sumatoria explícitos.

## Estados y situaciones de prueba

Pagos mixtos con suma distinta del total; moneda MXN; cancelación durante solicitud; usuario desconectado.

## Accesibilidad

Radio-group nativo o equivalente ARIA, labels completos; sin controles seleccionados solo por color.

## Definition of Done

El usuario puede explicar la diferencia entre pago pendiente y verificado sin ayuda; no se marca un pago digital como recibido por elegir método.

## Entrega de subagente

- Screenshot móvil y escritorio cuando aplique, con fuente ampliada.
- Lista de componentes y archivos modificados.
- Evidencia de test en caso feliz, vacío, error, sin conexión y estado restringido.
- Confirmación de que no se tocó contabilidad ni integración bancaria salvo tarea explícita.
- Enlace a tarea/PR local o commit opcional; incluir fallos y decisiones pendientes.
