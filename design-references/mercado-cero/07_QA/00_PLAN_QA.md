# Plan QA: calidad visual, usabilidad, negocio, privacidad y accesibilidad

## Cuatro niveles

**Nivel A. Integridad del kit (se puede ejecutar ya):** existencia de archivos, SVG XML correcto, JSON válido, recortes dentro de imagen, contraste numérico de tokens y rutas de catálogo.

**Nivel B. Revisión estática del repositorio (OpenCode tras copiar):** arquitectura actual, lint, types, permisos, data flow, accesos a secretos, QR demo, dependencia de IA, importaciones.

**Nivel C. Pruebas de flujos funcionales (necesitan app real):** venta, fiado, abonos, cash close, pagos, desconexión, demo, roles, exportación. `escenarios_financieros.json` trae 12 escenarios deterministas; adaptar a pruebas existentes.

**Nivel D. Pruebas UX/a11y manuales:** comparativas visuales y entrevistas. TalkBack/VoiceOver/NVDA, zoom 200/400%, teclado/switch, mercados ruidosos, Android económico, no depender de audio. Automatización axe-core no garantiza WCAG.

## Gate crítico NO-GO

- Pago digital pendiente, expirado o offline aparece como «verificado».
- Duplicación de eventos webhooks o ventas tras reintento.
- Abono antiguo aumenta ventas nuevas.
- Dinero virtual de metas etiquetado como depósito en cuenta.
- Datos falsos de práctica contaminan libros reales.
- Usuario sin IA/voz no puede registrar venta.
- Datos o credenciales reales en el bundle/ZIP/demo.
- Modificación de permisos que permite ver deudas a rol no autorizado.

## Evidencia esperada por pantalla

Captura 375px + 1440px, estados happy/error/offline, zoom 200%, validación teclado, logs de pruebas, comparación de valores contables, defectos categorizados, capturas sin datos sensibles. El verificador tiene derecho a declarar NO-GO aunque la estética sea excelente.
