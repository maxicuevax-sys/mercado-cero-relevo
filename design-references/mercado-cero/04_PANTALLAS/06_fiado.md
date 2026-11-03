# Fiado / clientes / abonos

**Prioridad:** P0 · **Agente dueño:** `mc-fiado-corte` · **Referencia:** `01_REFERENCIAS/recortes/19_Libreta_Fiados_Movil.png`

## Problema humano y tarea

Reemplazar una libreta de deudas sin perder el lenguaje familiar y sin confundir ventas pendientes con ingresos cobrados.

## Jerarquía y componentes propuestos

Saldo total y clientes, barra buscar; cada cliente nombre + saldo + fecha de último movimiento; detalle con movimientos cronológicos; CTA Registrar fiado / Registrar abono separados.

## Datos / contrato financiero (NO inferir lógica desde la imagen)

Crear fiado es venta con saldo por cobrar; abono antiguo reduce deuda y puede aumentar cobrado del día sin crear venta nueva. Mantener registro auditado de correcciones.

## Estados y situaciones de prueba

Cliente homónimo, abono parcial, saldo cero, condonación, cancelación, fecha previa, offline, rol sin permiso.

## Accesibilidad

Saldos con texto y moneda, secuencia cronológica por lector de pantalla, acciones de edición explican consecuencias.

## Definition of Done

Saldo no se vuelve negativo sin política definida; abono parcial correcto, rectificaciones con auditoría.

## Entrega de subagente

- Screenshot móvil y escritorio cuando aplique, con fuente ampliada.
- Lista de componentes y archivos modificados.
- Evidencia de test en caso feliz, vacío, error, sin conexión y estado restringido.
- Confirmación de que no se tocó contabilidad ni integración bancaria salvo tarea explícita.
- Enlace a tarea/PR local o commit opcional; incluir fallos y decisiones pendientes.
