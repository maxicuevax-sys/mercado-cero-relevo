# Directorio de proveedores

**Prioridad:** P2 · **Agente dueño:** `mc-modulos-negocio` · **Referencia:** `01_REFERENCIAS/recortes/21_Asistente_Opcional.png`

## Problema humano y tarea

Sacar fechas, pedidos y saldos de la memoria sin generar más alertas.

## Jerarquía y componentes propuestos

Listado, contacto consentido, pedido programado, saldo con proveedor, historial, lista de compras, recordatorios opcionales.

## Datos / contrato financiero (NO inferir lógica desde la imagen)

No enviar WhatsApp ni revelar compras sin autorización; contacto no autoriza compartir datos.

## Estados y situaciones de prueba

Proveedor sin teléfono, sin fecha, pedido parcial, reprogramado, proveedor duplicado.

## Accesibilidad

Acciones con nombre visible, fecha local explicada, no notificar de noche por defecto.

## Definition of Done

Se completa pedido/reprogramación sin bot; recordatorios se silencian en hora de cobro.

## Entrega de subagente

- Screenshot móvil y escritorio cuando aplique, con fuente ampliada.
- Lista de componentes y archivos modificados.
- Evidencia de test en caso feliz, vacío, error, sin conexión y estado restringido.
- Confirmación de que no se tocó contabilidad ni integración bancaria salvo tarea explícita.
- Enlace a tarea/PR local o commit opcional; incluir fallos y decisiones pendientes.
