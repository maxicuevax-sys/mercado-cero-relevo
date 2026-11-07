# Shell de navegación escritorio y responsive

**Prioridad:** P0 · **Agente dueño:** `mc-shell-responsive` · **Referencia:** `01_REFERENCIAS/recortes/06_Desktop_Navegacion.png`

## Problema humano y tarea

Que se encuentre cada función sin aprender dos aplicaciones distintas en móvil y escritorio.

## Jerarquía y componentes propuestos

Desktop sidebar estable y header ligero; móvil BottomNav Inicio/Vender/Caja/Fiado/Más; acceso a ayuda y preferencias; roles.

## Datos / contrato financiero (NO inferir lógica desde la imagen)

No mostrar pantallas ni balances restringidos a roles; no duplicar navegación que permita saltarse permisos.

## Estados y situaciones de prueba

Viewport 320/375/768/1440, foco en diálogos, menú abierto, modo offline, display de dos comercios.

## Accesibilidad

Semántica nav/header/main, enlaces etiquetados, skip link, orden foco, menú cerrar por Escape.

## Definition of Done

Se puede navegar con teclado y lector de pantalla; layouts no esconden funcionalidad en zoom 400%.

## Entrega de subagente

- Screenshot móvil y escritorio cuando aplique, con fuente ampliada.
- Lista de componentes y archivos modificados.
- Evidencia de test en caso feliz, vacío, error, sin conexión y estado restringido.
- Confirmación de que no se tocó contabilidad ni integración bancaria salvo tarea explícita.
- Enlace a tarea/PR local o commit opcional; incluir fallos y decisiones pendientes.
