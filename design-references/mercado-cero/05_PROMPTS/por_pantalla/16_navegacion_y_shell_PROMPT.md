# PROMPT: Shell de navegación escritorio y responsive

**Para:** `@mc-shell-responsive` · **Prioridad:** P0

## Contexto visual

Usa `design-references/mercado-cero/01_REFERENCIAS/recortes/06_Desktop_Navegacion.png` y el PNG maestro. El PNG es inspiración, no truth source. Usa tokens `03_SISTEMA_DISENO/tokens/mercado-tokens.css`, documentación `16_navegacion_y_shell.md` y los SVG editables existentes. NO fotocopiar el mockup.

## Objetivo

Que se encuentre cada función sin aprender dos aplicaciones distintas en móvil y escritorio.

## Implementación UX requerida

Desktop sidebar estable y header ligero; móvil BottomNav Inicio/Vender/Caja/Fiado/Más; acceso a ayuda y preferencias; roles.

## Política de datos/seguridad

No mostrar pantallas ni balances restringidos a roles; no duplicar navegación que permita saltarse permisos.

## Casos límite y pruebas

Viewport 320/375/768/1440, foco en diálogos, menú abierto, modo offline, display de dos comercios.

## Accesibilidad

Semántica nav/header/main, enlaces etiquetados, skip link, orden foco, menú cerrar por Escape.

## Criterio de aceptación y devolución

Se puede navegar con teclado y lector de pantalla; layouts no esconden funcionalidad en zoom 400%.

**Proceso obligatorio:** 1. Mapear archivos actuales y dependencia; 2. mostrar diff/plan corto; 3. editar solo rutas propias; 4. ejecutar tests; 5. capturas 375px y 1440px si aplica; 6. devolver archivos, pruebas, límites, screenshots y riesgos. Si el cambio requiere modificar la capa financiera compartida, detenerse, explicar y solicitar orquestación.
