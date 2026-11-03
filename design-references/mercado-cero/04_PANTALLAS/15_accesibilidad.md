# Preferencias de accesibilidad

**Prioridad:** P1 · **Agente dueño:** `mc-accesibilidad` · **Referencia:** `01_REFERENCIAS/recortes/03_Sistema_Diseno.png`

## Problema humano y tarea

Permitir adaptar legibilidad y métodos de entrada sin crear aplicación segregada.

## Jerarquía y componentes propuestos

Escala de texto, contraste, lectura opcional, feedback sonoro/háptico opcional, reducción movimiento, privacidad de montos, navegación accesible.

## Datos / contrato financiero (NO inferir lógica desde la imagen)

Los ajustes son locales/por usuario según permisos; nunca alterar estados financieros por un tema visual.

## Estados y situaciones de prueba

Lector de pantalla, 200%/400% zoom, reduced motion, daltonismo, sol, mercados ruidosos, teléfono antiguo.

## Accesibilidad

WCAG 2.2 AA objetivo, contraste texto 4.5:1 y UI 3:1; target táctil objetivo 44/48, reflow sin scroll horizontal.

## Definition of Done

Ningún flujo crítico requiere color/voz/sonido; pruebas manuales TalkBack, NVDA y navegación teclado.

## Entrega de subagente

- Screenshot móvil y escritorio cuando aplique, con fuente ampliada.
- Lista de componentes y archivos modificados.
- Evidencia de test en caso feliz, vacío, error, sin conexión y estado restringido.
- Confirmación de que no se tocó contabilidad ni integración bancaria salvo tarea explícita.
- Enlace a tarea/PR local o commit opcional; incluir fallos y decisiones pendientes.
