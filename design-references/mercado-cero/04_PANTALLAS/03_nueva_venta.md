# Nueva venta / composición de ticket

**Prioridad:** P0 · **Agente dueño:** `mc-ventas-pagos` · **Referencia:** `01_REFERENCIAS/recortes/18_Nueva_Venta_Movil.png`

## Problema humano y tarea

Registrar una venta rápidamente por catálogo o descripción manual, con dictado solo si está autorizado y disponible.

## Jerarquía y componentes propuestos

Título Nueva venta; campo «¿Qué vendiste?»; catálogo reciente opcional; lista de ítems editable; total tabular visible; CTA seleccionar cómo pagar; indicador de borrador si interrumpida.

## Datos / contrato financiero (NO inferir lógica desde la imagen)

El importe/total se calcula una vez en lógica de negocio; registrar venta NO significa haber recibido dinero. La IA propone interpretación y el usuario CONFIRMA productos, cantidades y precios.

## Estados y situaciones de prueba

Input vacío, producto inexistente, dictado erróneo, sin conexión, borrador recuperado, IVA según configuración del comercio, retorno desde llamada.

## Accesibilidad

Labels visibles, inputmode decimal adecuado MXN, botones +/- accesibles, errores conectados con aria-describedby, sin texto incrustado en ilustraciones.

## Definition of Done

Registrar y corregir venta con una mano; confirmar cambios; no duplica folio tras reintento; test de importes mayores y decimales.

## Entrega de subagente

- Screenshot móvil y escritorio cuando aplique, con fuente ampliada.
- Lista de componentes y archivos modificados.
- Evidencia de test en caso feliz, vacío, error, sin conexión y estado restringido.
- Confirmación de que no se tocó contabilidad ni integración bancaria salvo tarea explícita.
- Enlace a tarea/PR local o commit opcional; incluir fallos y decisiones pendientes.
