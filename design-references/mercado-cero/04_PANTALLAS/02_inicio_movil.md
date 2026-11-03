# Inicio móvil

**Prioridad:** P0 · **Agente dueño:** `mc-shell-responsive` · **Referencia:** `01_REFERENCIAS/recortes/17_Inicio_Movil.png`

## Problema humano y tarea

Permitir registrar la siguiente venta en segundos desde teléfono económico y observar pendientes sin saturación.

## Jerarquía y componentes propuestos

Identidad compacta, resumen de dos cifras clave, CTA «Nueva venta», accesos secundarios y dos pendientes, barra inferior Inicio/Vender/Caja/Fiado/Más.

## Datos / contrato financiero (NO inferir lógica desde la imagen)

Usar datos reales y permitir ocultar montos en público; no colocar notificaciones dentro de flujo de cobro.

## Estados y situaciones de prueba

Sin conexión; sin historial; sin sesión; primer uso con práctica; fuente grande; solo una mano.

## Accesibilidad

Botones mínimo 44x44 CSS px; reflow al 400%; sin dependencia de gestos; barra inferior con labels.

## Definition of Done

En iPhone 320px y Android 360px se completa acción sin textos truncados y el teclado virtual no tapa CTA.

## Entrega de subagente

- Screenshot móvil y escritorio cuando aplique, con fuente ampliada.
- Lista de componentes y archivos modificados.
- Evidencia de test en caso feliz, vacío, error, sin conexión y estado restringido.
- Confirmación de que no se tocó contabilidad ni integración bancaria salvo tarea explícita.
- Enlace a tarea/PR local o commit opcional; incluir fallos y decisiones pendientes.
