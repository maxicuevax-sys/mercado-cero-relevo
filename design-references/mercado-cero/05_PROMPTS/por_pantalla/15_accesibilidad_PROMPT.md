# PROMPT: Preferencias de accesibilidad

**Para:** `@mc-accesibilidad` · **Prioridad:** P1

## Contexto visual

Usa `design-references/mercado-cero/01_REFERENCIAS/recortes/03_Sistema_Diseno.png` y el PNG maestro. El PNG es inspiración, no truth source. Usa tokens `03_SISTEMA_DISENO/tokens/mercado-tokens.css`, documentación `15_accesibilidad.md` y los SVG editables existentes. NO fotocopiar el mockup.

## Objetivo

Permitir adaptar legibilidad y métodos de entrada sin crear aplicación segregada.

## Implementación UX requerida

Escala de texto, contraste, lectura opcional, feedback sonoro/háptico opcional, reducción movimiento, privacidad de montos, navegación accesible.

## Política de datos/seguridad

Los ajustes son locales/por usuario según permisos; nunca alterar estados financieros por un tema visual.

## Casos límite y pruebas

Lector de pantalla, 200%/400% zoom, reduced motion, daltonismo, sol, mercados ruidosos, teléfono antiguo.

## Accesibilidad

WCAG 2.2 AA objetivo, contraste texto 4.5:1 y UI 3:1; target táctil objetivo 44/48, reflow sin scroll horizontal.

## Criterio de aceptación y devolución

Ningún flujo crítico requiere color/voz/sonido; pruebas manuales TalkBack, NVDA y navegación teclado.

**Proceso obligatorio:** 1. Mapear archivos actuales y dependencia; 2. mostrar diff/plan corto; 3. editar solo rutas propias; 4. ejecutar tests; 5. capturas 375px y 1440px si aplica; 6. devolver archivos, pruebas, límites, screenshots y riesgos. Si el cambio requiere modificar la capa financiera compartida, detenerse, explicar y solicitar orquestación.
