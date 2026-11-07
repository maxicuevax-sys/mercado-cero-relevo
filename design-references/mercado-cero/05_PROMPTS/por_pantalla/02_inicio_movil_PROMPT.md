# PROMPT: Inicio móvil

**Para:** `@mc-shell-responsive` · **Prioridad:** P0

## Contexto visual

Usa `design-references/mercado-cero/01_REFERENCIAS/recortes/17_Inicio_Movil.png` y el PNG maestro. El PNG es inspiración, no truth source. Usa tokens `03_SISTEMA_DISENO/tokens/mercado-tokens.css`, documentación `02_inicio_movil.md` y los SVG editables existentes. NO fotocopiar el mockup.

## Objetivo

Permitir registrar la siguiente venta en segundos desde teléfono económico y observar pendientes sin saturación.

## Implementación UX requerida

Identidad compacta, resumen de dos cifras clave, CTA «Nueva venta», accesos secundarios y dos pendientes, barra inferior Inicio/Vender/Caja/Fiado/Más.

## Política de datos/seguridad

Usar datos reales y permitir ocultar montos en público; no colocar notificaciones dentro de flujo de cobro.

## Casos límite y pruebas

Sin conexión; sin historial; sin sesión; primer uso con práctica; fuente grande; solo una mano.

## Accesibilidad

Botones mínimo 44x44 CSS px; reflow al 400%; sin dependencia de gestos; barra inferior con labels.

## Criterio de aceptación y devolución

En iPhone 320px y Android 360px se completa acción sin textos truncados y el teclado virtual no tapa CTA.

**Proceso obligatorio:** 1. Mapear archivos actuales y dependencia; 2. mostrar diff/plan corto; 3. editar solo rutas propias; 4. ejecutar tests; 5. capturas 375px y 1440px si aplica; 6. devolver archivos, pruebas, límites, screenshots y riesgos. Si el cambio requiere modificar la capa financiera compartida, detenerse, explicar y solicitar orquestación.
