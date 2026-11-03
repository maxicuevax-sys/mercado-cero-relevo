# Mercado Cero — Rescate de paridad visual (03-Nov-2026)

**Este parche sustituye las instrucciones de paridad ambiguas del kit anterior para el módulo Inicio.**

## Hallazgo bloqueante

El comparativo recibido no es válido: la izquierda muestra `Inicio` y la aplicación de la derecha muestra `Caja`. Las referencias usan 1448×1086 y la app se capturó a 1440×1000. La implementación trató la referencia como guía cromática y conservó la arquitectura equivocada.

No se debe modificar la lógica contable o pagos para obtener similitud visual. El objetivo es implementar la pantalla **Inicio** y su composición, preservar **Caja** como flujo aparte y hacer la comparación bajo condiciones idénticas.

## Orden de uso

1. Abrir `00_REFERENCIA_CANONICA_INICIO_1448x1086.png` y `01_DIAGNOSTICO_RECIBIDO_COMPARACION.png`.
2. Pegar íntegro `02_PROMPT_DE_RESCATE_OPENCODE.md` al orquestador.
3. Exigir la entrega de la Fase 0 **antes** de permitir cambios de UI.
4. Verificar resultado según `04_CRITERIOS_DE_ACEPTACION.md` y `05_PROTOCOLO_DE_CAPTURAS.md`.
5. Solo después de Inicio, continuar Caja, fiados, corte y móvil.

**No instales este paquete como código de producción**. Es un contrato de diseño, enrutamiento, medición y QA. Las imágenes son referencias raster, no componentes ni imágenes de producción listos para incrustar como screenshot.
